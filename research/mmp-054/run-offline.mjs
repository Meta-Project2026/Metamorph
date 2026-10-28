// Manual milestone only. Run after approval, inside an isolated Linux context.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  appendFileSync,
  chmodSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { isolation } from "../../packages/oracle/dist/reference/docker.js";
import { sandboxArgs } from "../../packages/target-worker/src/controller.mjs";
import { verifyPublic } from "../mmp-049/verify.mjs";
import { plan } from "./docker-gateway.mjs";
import {
  artifact,
  assertHead,
  checkPrepared,
  json,
  outside,
  PUBLIC,
  ROLES,
  root,
  run,
  sha,
  write,
} from "./lib.mjs";
import { hostControls, NODE_DENY, PHP_DENY, topology } from "./network.mjs";
import { offlineFetch } from "./offline-preload.mjs";

const [mode, bundleArg, outputArg, head] = process.argv.slice(2);
assert.equal(
  mode,
  "--run",
  "USAGE: run-offline.mjs --run ABSOLUTE_BUNDLE ABSOLUTE_NEW_OUTPUT EXACT_SHA",
);
assert.equal(process.argv.length, 6);
assert.equal(
  process.platform,
  "linux",
  "OFFLINE_NETWORK_ISOLATION_NOT_PROVEN: requires isolated Linux context and native daemon",
);
assert.equal(process.arch, "x64");
const bundleDir = outside(realpathSync(bundleArg));
const output = outside(outputArg);
process.umask(0o077);
mkdirSync(output, { mode: 0o700 });
outside(realpathSync(output));
const privateDir = join(output, "raw-local-only");
mkdirSync(privateDir, { mode: 0o700 });
const home = join(privateDir, "home");
mkdirSync(home, { mode: 0o700 });
const docker = run("/usr/bin/which", ["docker"]);
assert.ok(
  !docker.endsWith("/bin/docker") || !docker.includes("mmp054"),
  "RECURSIVE_GATEWAY",
);
// Drop credentials, proxy variables, Node injections and Docker remote contexts.
process.env = {
  PATH: `${dirname(process.execPath)}:/usr/local/bin:/usr/bin:/bin`,
  HOME: home,
  LANG: "C.UTF-8",
  TZ: "UTC",
  DOCKER_HOST: "unix:///var/run/docker.sock",
  DOCKER_CONFIG: home,
  CI: "1",
  COREPACK_ENABLE_NETWORK: "0",
  DO_NOT_TRACK: "1",
  PNPM_DISABLE_SELF_UPDATE_CHECK: "1",
  npm_config_offline: "true",
  npm_config_audit: "false",
  npm_config_fund: "false",
  PNPM_HOME: dirname(json(join(bundleDir, "prepared.json")).pnpm),
};
const receipt = {
  format: "mmp054-offline-v1",
  headSha: head,
  status: "OFFLINE_PROOF_NOT_RUN",
  mode: "isolated-linux-context-native-daemon-v1",
  provider: "offline-deterministic-replay",
  localLlm: "LOCAL_LLM_GENERATION_NOT_RUN",
  remoteAi: "NOT_RUN",
  paidCalls: 0,
  G0: "INCONCLUSIVE",
  G4: "INCONCLUSIVE",
  product: "NOT_ESTABLISHED",
  historicalAudit: "UNCHANGED",
  steps: [],
  cleanup: {
    status: "NOT_RUN",
    containers: null,
    volumes: null,
    emergencyRemoved: 0,
  },
};
const started = Date.now();
const abort = new AbortController();
const stop = () => abort.abort();
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
const totalDeadline = setTimeout(stop, 58 * 60000);
// On deadline/interrupt, join the driver before the independent finalizer. A child
// refusing its cleanup grace is killed and can never supply successful evidence.
async function stage(file, bound) {
  return await new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [
        "--import",
        pathToFileURL(join(root, "research/mmp-054/offline-preload.mjs")).href,
        join(root, "research/mmp-049", file),
      ],
      { env: stageEnv, cwd: root, stdio: ["ignore", "pipe", "pipe"] },
    );
    let grace;
    let cancelled = false;
    let bytes = 0;
    const halt = () => {
      if (cancelled) return;
      cancelled = true;
      child.kill("SIGTERM");
      grace = setTimeout(() => child.kill("SIGKILL"), 20000);
    };
    const deadline = setTimeout(halt, bound * 60000);
    abort.signal.addEventListener("abort", halt, { once: true });
    if (abort.signal.aborted) halt();
    const record = (data) => {
      bytes += data.length;
      if (bytes > 8 * 1024 * 1024) halt();
      else
        try {
          appendFileSync(join(privateDir, "stages.log"), data);
        } catch {
          halt();
        }
    };
    child.stdout.on("data", record);
    child.stderr.on("data", record);
    child.on("error", halt);
    child.on("close", (status, signal) => {
      clearTimeout(deadline);
      clearTimeout(grace);
      abort.signal.removeEventListener("abort", halt);
      resolve({ status: cancelled ? null : status, signal, cancelled });
    });
  });
}
let stageEnv;
let b;
let workStarted = false;
try {
  receipt.network = {
    before: topology(),
    controlsBefore: await hostControls(),
    workers: [],
  };
  b = checkPrepared(bundleDir, head, docker);
  const { SOURCE } = await import(
    "../../packages/oracle/dist/reference/manifest.js"
  );
  assert.deepEqual(b.source, SOURCE);
  const info = JSON.parse(run(docker, ["info", "--format", "{{json .}}"]));
  assert.equal(info.OSType, "linux");
  assert.ok(["x86_64", "amd64"].includes(info.Architecture));
  assert.equal(
    run(docker, ["ps", "-aq"]),
    "",
    "DEDICATED_EMPTY_DAEMON_REQUIRED",
  );
  assert.equal(
    run(docker, ["volume", "ls", "-q"]),
    "",
    "DEDICATED_EMPTY_DAEMON_REQUIRED",
  );
  receipt.runner = {
    platform: "linux/amd64",
    node: process.version,
    pnpm: b.pnpmVersion,
    dockerServer: JSON.parse(
      run(docker, ["version", "--format", "{{json .Server}}"]),
    ),
    osReleaseSha256: artifact("/etc/os-release").sha256,
    daemonIdSha256: sha(info.ID),
    tools: Object.fromEntries(
      Object.entries(b.toolchain).map(([n, t]) => [
        n,
        { bytes: t.bytes, sha256: t.sha256 },
      ]),
    ),
  };
  // Real daemon registry attempt, deliberately NOT the gateway. No auth, no model API.
  const registry = spawnSync(
    docker,
    [
      "pull",
      "registry-1.docker.io/metamorph-offline-denial/nonexistent:control",
    ],
    { timeout: 12000, encoding: "utf8" },
  );
  assert.ok(
    !registry.error && registry.status !== 0 && registry.status !== null,
    "DAEMON_DENIAL_NOT_OBSERVED",
  );
  assert.match(
    registry.stderr,
    /network is unreachable|no such host|connection refused|i\/o timeout|context deadline exceeded|temporary failure|timeout/i,
    "DAEMON_CONTROL_WRONG_FAILURE",
  );
  receipt.network.daemonRegistry = "DENIED";
  const fetchLocal = offlineFetch(b, bundleDir);
  await assert.rejects(
    () => fetchLocal("https://api.meta.com/offline-control"),
    /OFFLINE_REMOTE_FORBIDDEN/,
  );
  receipt.network.remoteFallback = "DENIED_BEFORE_NETWORK";
  assert.throws(
    () => plan(["pull", "registry.invalid/missing:offline"], b),
    /OFFLINE_IMAGE_MISS/,
  );
  receipt.network.missingImage = "REJECTED_BEFORE_NETWORK";
  const bin = join(privateDir, "bin");
  mkdirSync(bin);
  const gateway = join(root, "research/mmp-054/docker-gateway.mjs");
  chmodSync(gateway, 0o755);
  symlinkSync(gateway, join(bin, "docker"));
  const transportLog = join(privateDir, "transport.jsonl");
  const dockerLog = join(privateDir, "docker.jsonl");
  writeFileSync(transportLog, "");
  writeFileSync(dockerLog, "");
  stageEnv = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    MMP054_GATEWAY: "1",
    MMP054_PRELOAD: "1",
    MMP054_BUNDLE: bundleDir,
    MMP054_BUNDLE_SHA: artifact(join(bundleDir, "prepared.json")).sha256,
    MMP054_PRIVATE: privateDir,
    MMP054_REAL_DOCKER: docker,
    MMP054_DOCKER_LOG: dockerLog,
    MMP054_TRANSPORT_LOG: transportLog,
    MMP049_OUTPUT: output,
    MMP049_HEAD_SHA: head,
    MMP049_PROBE_PARENT: join(privateDir, "probe"),
    MMP049_PROOF_PARENT: join(privateDir, "proof"),
    MMP049_AGENT_PARENT: join(privateDir, "agent"),
  };
  // Actual frozen offline install; no package-manager bootstrap is permitted.
  run(b.pnpm, [
    "install",
    "--offline",
    "--frozen-lockfile",
    "--store-dir",
    join(bundleDir, "store"),
  ]);
  receipt.offlineInstall = "PASS";
  // Explicit real network attempts under every worker/build/inspector policy.
  for (const role of ROLES) {
    abort.signal.throwIfAborted();
    const name = `mmp054-control-${randomUUID()}`;
    const php = role.startsWith("php");
    const image =
      role === "php-probe"
        ? b.images.php.ref
        : role === "node-probe"
          ? b.images.node.ref
          : php
            ? b.images.phpRuntime.id
            : b.images.targetRuntime.id;
    const args = [
      "run",
      "--rm",
      ...(php ? isolation(name) : sandboxArgs(name)),
      image,
      ...(php
        ? ["php", "-r", PHP_DENY]
        : ["node", "--input-type=module", "-e", NODE_DENY]),
    ];
    // No candidate/reference code, only the predeclared trusted network probe.
    const result = spawnSync(join(bin, "docker"), args, {
      env: stageEnv,
      encoding: "utf8",
      timeout: 20000,
    });
    const present = run(docker, ["ps", "-aq", "--filter", `name=^/${name}$`]);
    if (present) {
      receipt.cleanup.emergencyRemoved++;
      run(docker, ["rm", "--force", name]);
    }
    assert.equal(present, "", "NETWORK_CONTROL_CLEANUP_ERROR");
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, "WORKER_DENIAL_CONTROL_ERROR");
    const tests = JSON.parse(result.stdout);
    assert.deepEqual(tests, ["ipv4", "ipv6", "dns"]);
    receipt.network.workers.push({
      role,
      network: "none",
      imageId: Object.values(b.images).find(
        (i) => i.id === image || i.ref === image,
      ).id,
      tests,
      exitCode: result.status,
      status: "DENIED",
      cleanup: "PASS",
    });
  }
  workStarted = true;
  for (const [name, file, bound] of [
    ["probe", "probe.mjs", 3],
    ["proof", "run-proof.mjs", 28],
    ["agent", "run-agent.mjs", 13],
  ]) {
    abort.signal.throwIfAborted();
    const r = await stage(file, bound);
    receipt.steps.push({ name, exitCode: r.status, cancelled: r.cancelled });
    assert.equal(r.status, 0, `STAGE_ERROR:${name}`);
  }
} catch (e) {
  receipt.status = workStarted ? "ERROR" : "OFFLINE_PROOF_NOT_RUN";
  receipt.errorCode =
    e.message.includes("OFFLINE_NETWORK_ISOLATION_NOT_PROVEN") ||
    e.message.includes("OUTSIDE_OFFLINE_CONTEXT") ||
    e.message.includes("EXTERNAL_OR_PEER_INTERFACE")
      ? "OFFLINE_NETWORK_ISOLATION_NOT_PROVEN"
      : abort.signal.aborted
        ? "CANCELLED"
        : "OFFLINE_ADMISSION_OR_EXECUTION_ERROR";
} finally {
  try {
    if (stageEnv) {
      // Independent fresh process, same exact three ledgers; never invent empty cleanup.
      const r = spawnSync(
        process.execPath,
        [join(root, "research/mmp-049/finalize.mjs")],
        { env: stageEnv, cwd: root, encoding: "utf8", timeout: 120000 },
      );
      receipt.steps.push({ name: "finalizer", exitCode: r.status });
      assert.equal(r.status, 0);
      const f = json(join(output, "finalizer.json"));
      assert.equal(f.status, "PASS");
      assert.equal(f.stages.length, 3);
      assert.ok(
        f.stages.every((s) => s.status === "PASS" && s.emergencyRemoved === 0),
      );
      assert.equal(run(docker, ["ps", "-aq"]), "");
      assert.equal(run(docker, ["volume", "ls", "-q"]), "");
      receipt.cleanup = {
        status: "PASS",
        containers: 0,
        volumes: 0,
        emergencyRemoved: receipt.cleanup.emergencyRemoved,
      };
      assert.equal(receipt.cleanup.emergencyRemoved, 0);
    }
    if (workStarted) {
      receipt.network.after = topology();
      receipt.network.controlsAfter = await hostControls();
      checkPrepared(bundleDir, head, docker);
      assertHead(head);
      verifyPublic((n) => readFileSync(join(output, n)), head);
      assert.ok(receipt.steps.every((s) => s.exitCode === 0));
      assert.equal(
        receipt.errorCode,
        undefined,
        "PRIMARY_ERROR_CANNOT_BE_ERASED",
      );
      abort.signal.throwIfAborted();
      const rows = (name) =>
        readFileSync(join(privateDir, name), "utf8")
          .trim()
          .split("\n")
          .filter(Boolean)
          .map(JSON.parse);
      const gateway = rows("docker.jsonl");
      const transport = rows("transport.jsonl");
      // Some worker readiness/negative controls intentionally exit nonzero. Their original
      // receipts are checked by verifyPublic; provisioning actions must all succeed.
      receipt.network.gatewayErrors = gateway.filter(
        (r) =>
          [
            "cached-pull",
            "prepared-php-toolchain",
            "prepared-ts-toolchain",
          ].includes(r.kind) && r.status !== 0,
      ).length;
      receipt.network.preparedPhpUses = gateway.filter(
        (r) => r.kind === "prepared-php-toolchain",
      ).length;
      receipt.network.preparedTsUses = gateway.filter(
        (r) => r.kind === "prepared-ts-toolchain",
      ).length;
      receipt.network.localArchiveUses = transport.filter(
        (r) => r.event === "LOCAL_SOURCE_ARCHIVE",
      ).length;
      assert.ok(transport.every((r) => r.event === "LOCAL_SOURCE_ARCHIVE"));
      receipt.bundleSha256 = artifact(join(bundleDir, "prepared.json")).sha256;
      receipt.gatewayLogSha256 = artifact(
        join(privateDir, "docker.jsonl"),
      ).sha256;
      receipt.transportLogSha256 = artifact(
        join(privateDir, "transport.jsonl"),
      ).sha256;
      receipt.publicFiles = Object.fromEntries(
        PUBLIC.map((n) => [n, artifact(join(output, n))]),
      );
      receipt.images = Object.fromEntries(
        Object.entries(b.images).map(([n, i]) => [n, i.id]),
      );
      receipt.sourceSha256 = b.source.archiveSha256;
      const proof = json(join(output, "summary.json"));
      const agent = json(join(output, "agent.json"));
      receipt.coverage = {
        pairs: proof.groups.reduce((n, g) => n + g.result.pairs, 0),
        http: proof.groups.reduce((n, g) => n + g.result.http, 0),
        sqlite: proof.groups.reduce((n, g) => n + g.result.sqlite, 0),
        agentPairs: agent.attempts.reduce((n, a) => n + a.pairs.length, 0),
        agentHttp: agent.attempts.reduce((n, a) => n + a.coverage.http, 0),
        agentSqlite: agent.attempts.reduce((n, a) => n + a.coverage.sqlite, 0),
      };
      receipt.elapsedMs = Date.now() - started;
      receipt.status = "OFFLINE_PUBLIC_PASS_SCOPED";
      const { verifyEnvelope } = await import("./verify.mjs");
      verifyEnvelope(receipt, head);
    }
  } catch {
    receipt.status = "ERROR";
    receipt.errorCode = "OFFLINE_AUDIT_OR_CLEANUP_ERROR";
  }
  receipt.elapsedMs = Date.now() - started;
  write(join(output, "offline.json"), receipt);
  clearTimeout(totalDeadline);
  process.removeListener("SIGTERM", stop);
  process.removeListener("SIGINT", stop);
}
console.log(
  JSON.stringify({
    status: receipt.status,
    errorCode: receipt.errorCode ?? null,
    G0: receipt.G0,
    G4: receipt.G4,
    product: receipt.product,
  }),
);
if (receipt.status !== "OFFLINE_PUBLIC_PASS_SCOPED") process.exitCode = 1;
