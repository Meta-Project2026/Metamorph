import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import type { HttpObservation } from "../http.js";
import { validateHttp } from "../http.js";
import type { ScenarioRequest } from "../runner.js";
import type { SqliteSnapshot } from "../sqlite.js";
import type { PrivateEvidence } from "./evidence.js";
import { ensure, SOURCE, sha256 } from "./manifest.js";
import { mapPhpSnapshot } from "./mapping.js";
import type { Command } from "./process.js";

export interface Runtime {
  imageId: string;
  archivePath: string;
  inspectorPath: string;
  sourceSha256: string;
  baseImage: string;
}
const clock = [
  "env",
  "TZ=UTC",
  "LD_PRELOAD=/usr/lib/x86_64-linux-gnu/faketime/libfaketime.so.1",
  `FAKETIME=${SOURCE.clock}`,
  "FAKETIME_DONT_FAKE_MONOTONIC=1",
];
export function isolation(name: string): string[] {
  return [
    "--name",
    name,
    "--network",
    "none",
    "--read-only",
    "--user",
    "65534:65534",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--cpus",
    "1",
    "--memory",
    "256m",
    "--memory-swap",
    "256m",
    "--pids-limit",
    "64",
    "--ulimit",
    "nofile=128:128",
    "--log-driver",
    "none",
    "--tmpfs",
    "/work:rw,noexec,nosuid,nodev,size=32m,mode=0700,uid=65534,gid=65534",
    "--tmpfs",
    "/tmp:rw,noexec,nosuid,nodev,size=8m,mode=0700,uid=65534,gid=65534",
  ];
}
function bind(path: string, destination: string): string[] {
  ensure(isAbsolute(path) && !path.includes(","), "BIND_PATH");
  return ["--mount", `type=bind,src=${path},dst=${destination},readonly`];
}
export function validateRuntime(runtime: Runtime): void {
  ensure(
    runtime.sourceSha256 === SOURCE.archiveSha256 &&
      runtime.baseImage === SOURCE.image,
    "PROVENANCE_MISMATCH",
  );
  ensure(/^sha256:[a-f0-9]{64}$/.test(runtime.imageId), "IMAGE_DIGEST");
  ensure(
    sha256(readFileSync(runtime.archivePath)) === SOURCE.archiveSha256,
    "SOURCE_DIGEST",
  );
}
/** Network-enabled provisioning precedes admission of source to any executing sandbox. */
export async function provisionRuntime(input: {
  command: Command;
  directory: string;
  oracleRoot: string;
  signal: AbortSignal;
  evidence: PrivateEvidence;
}): Promise<Runtime> {
  const { command, directory, oracleRoot, signal, evidence } = input;
  await command(["pull", SOURCE.image], signal, undefined, 180000);
  const iidfile = join(directory, "image-id");
  await command(
    [
      "build",
      "--build-arg",
      `PHP_IMAGE=${SOURCE.image}`,
      "--iidfile",
      iidfile,
      "-f",
      join(oracleRoot, "probes", "Dockerfile"),
      join(oracleRoot, "probes"),
    ],
    signal,
    undefined,
    300000,
  );
  const imageId = readFileSync(iidfile, "utf8").trim();
  ensure(/^sha256:[a-f0-9]{64}$/.test(imageId), "IMAGE_DIGEST");
  const response = await fetch(
    `https://codeload.github.com/${SOURCE.repository}/tar.gz/${SOURCE.commit}`,
    {
      signal: AbortSignal.any([signal, AbortSignal.timeout(45000)]),
      redirect: "error",
    },
  );
  ensure(response.ok && response.body, "SOURCE_DOWNLOAD");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    ensure(size <= 10 * 1024 * 1024, "SOURCE_LIMIT");
    chunks.push(chunk);
  }
  const archive = Buffer.concat(chunks);
  ensure(sha256(archive) === SOURCE.archiveSha256, "SOURCE_DIGEST");
  const archivePath = join(directory, "source.tgz");
  // Public, verified OSS archive; 0444 lets unprivileged sandbox read the file bind.
  writeFileSync(archivePath, archive, { flag: "wx", mode: 0o444 });
  const runtime = {
    imageId,
    archivePath,
    inspectorPath: join(oracleRoot, "reference", "inspector.php"),
    sourceSha256: sha256(archive),
    baseImage: SOURCE.image,
  };
  evidence.write("runtime", {
    ...runtime,
    source: SOURCE,
    inspectorSha256: sha256(readFileSync(runtime.inspectorPath)),
    dockerfileSha256: sha256(
      readFileSync(join(oracleRoot, "probes", "Dockerfile")),
    ),
  });
  return runtime;
}

// Executed by the immutable PHP binary as a loopback client; no inspector or evidence mount.
const client = String.raw`$r=json_decode(base64_decode($argv[1]),true,512,JSON_THROW_ON_ERROR); $o=['method'=>$r['method'],'ignore_errors'=>true,'follow_location'=>0,'timeout'=>5,'header'=>"Connection: close\r\n"]; if($r['method']==='POST'){$o['content']=$r['body']??'';$o['header'].="Content-Type: application/x-www-form-urlencoded\r\n";} $s=fopen('http://127.0.0.1:8080'.$r['path'],'r',false,stream_context_create(['http'=>$o])); if(!$s)exit(1); $b=stream_get_contents($s,1048577); fclose($s); if(strlen($b)>1048576)exit(1); $h=$http_response_header; if(!preg_match('~^HTTP/[^ ]+ ([0-9]{3})~',$h[0],$m))exit(1); $stable=[]; foreach(array_slice($h,1) as $line){$p=explode(':',$line,2);if(count($p)===2){$k=strtolower(trim($p[0]));if(in_array($k,['content-type','location','cache-control','allow','content-disposition'],true)){if(isset($stable[$k]))exit(1);$stable[$k]=trim($p[1]);}}} echo json_encode(['status'=>(int)$m[1],'headers'=>(object)$stable,'rawHeaders'=>$h,'bodyBase64'=>base64_encode($b)],JSON_THROW_ON_ERROR);`;

export function decodeHttp(bytes: Uint8Array): {
  observation: HttpObservation;
  raw: unknown;
} {
  ensure(bytes.length <= 2 * 1024 * 1024, "HTTP_LIMIT");
  const raw = JSON.parse(Buffer.from(bytes).toString());
  ensure(
    raw &&
      Object.keys(raw).sort().join(",") ===
        "bodyBase64,headers,rawHeaders,status",
    "HTTP_WIRE",
  );
  ensure(
    typeof raw.bodyBase64 === "string" &&
      Array.isArray(raw.rawHeaders) &&
      raw.rawHeaders.every((s: unknown) => typeof s === "string"),
    "HTTP_WIRE",
  );
  const body = Buffer.from(raw.bodyBase64, "base64");
  ensure(body.toString("base64") === raw.bodyBase64, "HTTP_BASE64");
  const observation = { status: raw.status, headers: raw.headers, body };
  validateHttp(observation);
  return { observation, raw };
}
export interface Inspection {
  snapshot: SqliteSnapshot;
  legacySha256: string;
  raw: unknown;
}
export function decodeInspection(bytes: Uint8Array): Inspection {
  ensure(bytes.length <= 8 * 1024 * 1024, "SNAPSHOT_LIMIT");
  const raw = JSON.parse(Buffer.from(bytes).toString());
  if (
    raw &&
    Object.keys(raw).join(",") === "errorCode" &&
    [
      "INSPECTOR_ADMIT",
      "INSPECTOR_SCHEMA",
      "INSPECTOR_CLOCK",
      "INSPECTOR_VERSION",
    ].includes(raw.errorCode)
  ) {
    ensure(false, raw.errorCode);
  }
  ensure(
    raw &&
      Object.keys(raw).sort().join(",") === "legacySha256,runtime,stateBase64",
    "INSPECTOR_WIRE",
  );
  ensure(
    typeof raw.legacySha256 === "string" &&
      /^[a-f0-9]{64}$/.test(raw.legacySha256),
    "INSPECTOR_DIGEST",
  );
  ensure(
    raw.runtime.php === "7.4.33" &&
      raw.runtime.sqlite === "3.34.1" &&
      raw.runtime.phpUtc === SOURCE.clock &&
      raw.runtime.sqliteUtc === SOURCE.clock &&
      raw.runtime.monotonicMs >= 40 &&
      raw.runtime.monotonicMs < 2000,
    "RUNTIME_MISMATCH",
  );
  ensure(
    Array.isArray(raw.runtime.extensions) &&
      ["PDO", "pdo_sqlite", "mbstring"].every((s) =>
        raw.runtime.extensions.includes(s),
      ),
    "EXTENSIONS_MISSING",
  );
  ensure(
    raw.runtime.clockNoticeSha256 ===
      "6c361c87f8a9a7999ffab9924fabaaf499b372379cd8a7c19e7eca94d43df7ef",
    "CLOCK_PROVENANCE",
  );
  ensure(
    raw.runtime.clockPackageVersion === "0.9.8-9" &&
      /^[a-f0-9]{64}$/.test(raw.runtime.clockLibrarySha256),
    "CLOCK_PROVENANCE",
  );
  ensure(typeof raw.stateBase64 === "string", "INSPECTOR_WIRE");
  const state = Buffer.from(raw.stateBase64, "base64");
  ensure(
    state.toString("base64") === raw.stateBase64 &&
      sha256(state) === raw.legacySha256,
    "INSPECTOR_DIGEST",
  );
  return {
    snapshot: mapPhpSnapshot(JSON.parse(state.toString())),
    legacySha256: raw.legacySha256,
    raw,
  };
}

export class DockerReferenceTransport {
  private app: string | undefined;
  private inspectors = new Set<string>();
  constructor(
    readonly runtime: Runtime,
    private readonly command: Command,
  ) {
    validateRuntime(runtime);
  }
  private async image(signal: AbortSignal): Promise<void> {
    const result = await this.command(
      ["image", "inspect", "--format", "{{.Id}}", this.runtime.imageId],
      signal,
    );
    ensure(
      result.stdout.toString().trim() === this.runtime.imageId,
      "IMAGE_DIGEST",
    );
  }
  async reset(signal: AbortSignal): Promise<void> {
    await this.close();
    validateRuntime(this.runtime);
    await this.image(signal);
    const name = `mmp-reference-${randomUUID()}`;
    this.app = name;
    const boot = `set -eu; mkdir /work/app /work/state; tar -xzf /input.tgz -C /work/app --strip-components=1 --no-same-owner --no-same-permissions; test "$(sha256sum /work/app/LICENSE | cut -d ' ' -f 1)" = '${SOURCE.licenseSha256}'; cd /work/app; exec env SQLITE_FILE=/work/state/reference.sqlite ${clock.join(" ").replace(`FAKETIME=${SOURCE.clock}`, `"FAKETIME=${SOURCE.clock}"`)} php -d display_errors=0 -d log_errors=1 -S 127.0.0.1:8080 -t /work/app > /work/server.log 2>&1`;
    await this.command(
      [
        "run",
        "-d",
        ...isolation(name),
        ...bind(this.runtime.archivePath, "/input.tgz"),
        this.runtime.imageId,
        "timeout",
        "--signal=KILL",
        "600",
        "sh",
        "-c",
        boot,
      ],
      signal,
    );
    for (let i = 0; i < 40; i++) {
      try {
        await this.command(
          [
            "exec",
            name,
            "php",
            "-r",
            "$s=@fsockopen('127.0.0.1',8080);if(!$s)exit(1);fclose($s);",
          ],
          signal,
        );
        return;
      } catch {
        signal.throwIfAborted();
      }
    }
    throw new Error("WORKER_NOT_READY");
  }
  async http(
    request: ScenarioRequest,
    signal: AbortSignal,
  ): Promise<{ observation: HttpObservation; raw: unknown }> {
    ensure(this.app, "WORKER_NOT_RESET");
    // Syntax-check original trusted client inside the sandbox before executing it.
    await this.command(
      ["exec", "-i", this.app, "php", "-l"],
      signal,
      Buffer.from(`<?php\n${client}`),
    );
    const result = await this.command(
      [
        "exec",
        this.app,
        "php",
        "-d",
        "display_errors=0",
        "-r",
        client,
        Buffer.from(JSON.stringify(request)).toString("base64"),
      ],
      signal,
    );
    return decodeHttp(result.stdout);
  }
  async inspect(signal: AbortSignal): Promise<Inspection> {
    ensure(this.app, "WORKER_NOT_RESET");
    await this.command(["pause", this.app], signal);
    let copied: Uint8Array;
    try {
      copied = (
        await this.command(["cp", `${this.app}:/work/state/.`, "-"], signal)
      ).stdout;
    } finally {
      await this.command(["unpause", this.app], AbortSignal.timeout(5000));
    }
    return this.inspectCopy(copied, signal);
  }
  private async inspectCopy(
    tar: Uint8Array,
    signal: AbortSignal,
  ): Promise<Inspection> {
    const name = `mmp-inspector-${randomUUID()}`;
    this.inspectors.add(name);
    try {
      await this.image(signal);
      const result = await this.command(
        [
          "run",
          "--rm",
          "-i",
          ...isolation(name),
          ...bind(this.runtime.inspectorPath, "/inspector.php"),
          this.runtime.imageId,
          "timeout",
          "--signal=KILL",
          "12",
          "sh",
          "-c",
          'set -eu; tar -xf - -C /work --no-same-owner --no-same-permissions; exec "$@"',
          "sh",
          ...clock,
          "php",
          "-d",
          "memory_limit=64M",
          "/inspector.php",
        ],
        signal,
        tar,
      );
      return decodeInspection(result.stdout);
    } finally {
      await this.remove(name);
      this.inspectors.delete(name);
    }
  }
  async inspectFixture(
    sqlPath: string,
    signal: AbortSignal,
  ): Promise<Inspection> {
    const name = `mmp-inspector-${randomUUID()}`;
    this.inspectors.add(name);
    try {
      await this.image(signal);
      const result = await this.command(
        [
          "run",
          "--rm",
          ...isolation(name),
          ...bind(this.runtime.inspectorPath, "/inspector.php"),
          ...bind(sqlPath, "/fixture.sql"),
          this.runtime.imageId,
          "timeout",
          "--signal=KILL",
          "12",
          ...clock,
          "php",
          "-d",
          "memory_limit=64M",
          "/inspector.php",
          "fixture",
        ],
        signal,
      );
      return decodeInspection(result.stdout);
    } finally {
      await this.remove(name);
      this.inspectors.delete(name);
    }
  }
  private async remove(name: string): Promise<void> {
    // --rm may already have removed a completed inspector. Query exact name first.
    const found = await this.command(
      ["ps", "-aq", "--filter", `name=^/${name}$`],
      AbortSignal.timeout(5000),
    );
    if (found.stdout.toString().trim())
      await this.command(["rm", "-f", name], AbortSignal.timeout(5000));
    const remaining = await this.command(
      ["ps", "-aq", "--filter", `name=^/${name}$`],
      AbortSignal.timeout(5000),
    );
    ensure(!remaining.stdout.toString().trim(), "CLEANUP_ERROR");
  }
  async close(): Promise<void> {
    let failed = false;
    if (this.app) {
      // Preserve server stdout/stderr through the private command channel before removal.
      try {
        await this.command(
          ["exec", this.app, "cat", "/work/server.log"],
          AbortSignal.timeout(5000),
        );
      } catch {
        failed = true;
      }
    }
    for (const name of [...this.inspectors, ...(this.app ? [this.app] : [])]) {
      try {
        await this.remove(name);
        this.inspectors.delete(name);
        if (name === this.app) this.app = undefined;
      } catch {
        failed = true;
      }
    }
    ensure(!failed, "CLEANUP_ERROR");
  }
}
