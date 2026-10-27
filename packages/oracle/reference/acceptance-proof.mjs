// Trusted controller only. Upstream PHP and DB parsing execute exclusively inside Docker.
import { randomUUID } from "node:crypto";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { compareSqlite, snapshotSqlite } from "../dist/index.js";
import {
  DockerReferenceTransport,
  isolation,
  provisionRuntime,
} from "../dist/reference/docker.js";
import { PrivateEvidence } from "../dist/reference/evidence.js";
import {
  ensure,
  MANIFEST,
  MANIFEST_SHA256,
  ReferenceWorkerError,
  SOURCE,
  stepId,
} from "../dist/reference/manifest.js";
import { dockerCommand } from "../dist/reference/process.js";
import { publicSummary } from "../dist/reference/public.js";
import { PhpReferenceWorker } from "../dist/reference/worker.js";
import {
  assertRepeat,
  describeDb,
  digest,
  httpDigest,
  observe,
  publicCorpus,
  rows,
} from "./acceptance.mjs";
import { syntheticControls } from "./acceptance-controls.mjs";
import { Resources } from "./acceptance-resources.mjs";

export async function runAcceptance() {
  const oracleRoot = fileURLToPath(new URL("..", import.meta.url));
  const publicRoot = resolve(oracleRoot, "../..");
  const output = resolve(
    process.env.WORKSHOP_PUBLIC_OUTPUT ?? "reference-public",
  );
  mkdirSync(output, { recursive: true });
  let phase = "admission",
    worker,
    resources,
    evidence,
    failure,
    corpus;
  let shutdown;
  const abort = new AbortController();
  const stop = () => abort.abort();
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  const signal = AbortSignal.any([
    abort.signal,
    AbortSignal.timeout(12 * 60 * 1000),
  ]);
  let inventory;
  try {
    ensure(
      process.platform === "linux" && process.arch === "x64",
      "LINUX_X64_REQUIRED",
    );
    process.umask(0o077);
    const headSha = process.env.REFERENCE_HEAD_SHA;
    ensure(/^[a-f0-9]{40}$/.test(headSha), "HEAD_SHA");
    const parent =
      process.env.WORKSHOP_PRIVATE_PARENT ??
      process.env.ORACLE_PRIVATE_PARENT ??
      mkdtempSync(join(tmpdir(), "mmp009a-private-"));
    if (
      !process.env.WORKSHOP_PRIVATE_PARENT &&
      !process.env.ORACLE_PRIVATE_PARENT
    )
      chmodSync(parent, 0o700);
    evidence = new PrivateEvidence(parent, publicRoot, {
      headSha,
      source: SOURCE,
      manifestSha256: MANIFEST_SHA256,
      manifest: MANIFEST,
    });
    resources = new Resources(dockerCommand(evidence), parent);
    const command = resources.command;
    const directory = mkdtempSync(join(parent, "source-"));
    phase = "provision";
    const runtime = await provisionRuntime({
      command,
      directory,
      oracleRoot,
      signal,
      evidence,
    });
    // Public, hash-admitted OSS archive only; private records remain0600.
    chmodSync(runtime.archivePath, 0o444);
    phase = "source-files";
    const sourceName = `mmp009a-control-${randomUUID()}`;
    const source = await command(
      [
        "run",
        "--rm",
        ...isolation(sourceName),
        "--mount",
        `type=bind,src=${runtime.archivePath},dst=/input.tgz,readonly`,
        runtime.imageId,
        "timeout",
        "10",
        "sh",
        "-c",
        "set -eu; for file in api.php config.php; do tar -xOzf /input.tgz --wildcards \"*/$file\" | sha256sum | cut -d ' ' -f 1; done",
      ],
      signal,
    );
    const hashes = source.stdout.toString().trim().split("\n");
    ensure(hashes.length === 2, "SOURCE_DIGEST");
    const sourceFiles = { apiPhpSha256: hashes[0], configPhpSha256: hashes[1] };
    phase = "mapping-controls";
    const transport = new DockerReferenceTransport(runtime, command);
    const fixturePath = join(directory, "original-trusted-fixture.sqlite");
    const sqlPath = join(oracleRoot, "reference", "fixture.sql");
    const db = new DatabaseSync(fixturePath);
    try {
      db.exec(readFileSync(sqlPath, "utf8"));
    } finally {
      db.close();
    }
    const original = snapshotSqlite(fixturePath);
    const isolated = await transport.inspectFixture(sqlPath, signal);
    ensure(
      compareSqlite(original, isolated.snapshot).length === 0,
      "MAPPING_MISMATCH",
    );
    const types = new Set(
      original.tables.flatMap((t) => t.rows.flat().map((c) => c.type)),
    );
    ensure(
      ["integer", "real", "text", "blob", "null"].every((t) => types.has(t)),
      "CONTROL_COVERAGE",
    );
    evidence.write("mapping", { original, isolated });
    const controls = await syntheticControls(original);
    phase = "process-controls";
    for (const kind of ["exit", "timeout", "cancel"]) {
      const name = `mmp009a-control-${randomUUID()}`;
      const expected = {
        exit: "COMMAND_START_ERROR",
        timeout: "WORKER_TIMEOUT",
        cancel: "WORKER_ABORTED",
      }[kind];
      await command(
        [
          "create",
          ...isolation(name),
          runtime.imageId,
          "timeout",
          "--signal=KILL",
          "10",
          "php",
          "-r",
          kind === "exit" ? "exit(7);" : "sleep(60);",
        ],
        signal,
      );
      const ac = new AbortController();
      const timer =
        kind === "cancel" ? setTimeout(() => ac.abort(), 500) : undefined;
      let code;
      try {
        await command(
          ["start", "-ai", name],
          kind === "cancel" ? ac.signal : signal,
          undefined,
          kind === "timeout" ? 500 : 5000,
        );
      } catch (e) {
        code = e.code;
      } finally {
        clearTimeout(timer);
        await command(["rm", "-f", name], AbortSignal.timeout(5000));
      }
      ensure(code === expected, "CONTROL_INEFFECTIVE");
      controls.push({
        id: `process-${kind}`,
        kind: "ISOLATED_PROCESS",
        effective: true,
        codes: [code],
      });
    }
    const passes = [],
      rawPasses = [],
      packs = [];
    let businessHttp = 0,
      bootstrapHttp = 0,
      inspections = 0,
      resets = 0;
    for (let pass = 1; pass <= 2; pass++) {
      const pack = new PrivateEvidence(parent, publicRoot, {
        headSha,
        source: SOURCE,
        manifestSha256: MANIFEST_SHA256,
        pass,
      });
      packs.push(pack);
      const actual = new DockerReferenceTransport(runtime, command);
      const seenHttp = [];
      const counted = {
        reset: async (s) => {
          await actual.reset(s);
          resets++;
        },
        http: async (request, s) => {
          const r = await actual.http(request, s);
          seenHttp.push(r);
          return r;
        },
        inspect: async (s) => {
          const r = await actual.inspect(s);
          inspections++;
          return r;
        },
        close: () => actual.close(),
      };
      worker = new PhpReferenceWorker(
        counted,
        pack,
        MANIFEST.map((s) => s.id),
      );
      const scenarios = [],
        rawScenarios = [];
      for (const scenario of MANIFEST) {
        phase = `${scenario.id}-pass-${pass}`;
        const offset = seenHttp.length;
        await worker.reset(signal);
        ensure(seenHttp.length === offset + 1, "BOOTSTRAP_COVERAGE");
        bootstrapHttp++;
        const initial = await worker.snapshot(signal);
        ensure(
          rows(initial, "appointments").length === 0 &&
            rows(initial, "mechanics").length === 5,
          "DIRTY_RESET",
        );
        const entry = {
          scenarioId: scenario.id,
          initialSha256: digest(initial),
          initialDatabase: describeDb(initial),
          bootstrapSha256: httpDigest(seenHttp[offset].observation),
          steps: [],
        };
        const raw = {
          initial,
          bootstrap: seenHttp[offset].observation,
          steps: [],
        };
        let before = initial;
        for (const [i, request] of scenario.requests.entries()) {
          const http = await worker.requestStep(
            scenario.id,
            stepId(i),
            request,
            signal,
          );
          businessHttp++;
          const after = await worker.snapshot(signal);
          entry.steps.push(observe(scenario, i, http, before, after));
          raw.steps.push({ http, before, after });
          before = after;
        }
        scenarios.push(entry);
        rawScenarios.push(raw);
      }
      phase = `close-pass-${pass}`;
      await worker.close(AbortSignal.timeout(15000));
      worker = undefined;
      passes.push({ pass, scenarios });
      rawPasses.push(rawScenarios);
    }
    phase = "repeatability";
    for (let s = 0; s < MANIFEST.length; s++) {
      ensure(
        compareSqlite(rawPasses[0][s].initial, rawPasses[1][s].initial)
          .length === 0 &&
          httpDigest(rawPasses[0][s].bootstrap) ===
            httpDigest(rawPasses[1][s].bootstrap),
        "REPLAY_INITIAL",
      );
      for (let i = 0; i < MANIFEST[s].requests.length; i++)
        assertRepeat(rawPasses[0][s].steps[i], rawPasses[1][s].steps[i]);
    }
    ensure(
      resets === 6 &&
        businessHttp === 34 &&
        bootstrapHttp === 6 &&
        inspections === 114,
      "CORPUS_COVERAGE",
    );
    evidence.write("completion", {
      headSha,
      resets,
      businessHttp,
      bootstrapHttp,
      inspections,
      passes,
      controls,
    });
    phase = "cleanup";
    inventory = await resources.reap();
    evidence.write("inventory", inventory);
    phase = "post-cleanup-verification";
    const packHashes = packs.map((p) => p.seal());
    packs.forEach((p, i) => {
      ensure(
        PrivateEvidence.verify(p.path, packHashes[i]) > 34,
        "EVIDENCE_INCOMPLETE",
      );
    });
    const aggregate = evidence.seal();
    ensure(
      PrivateEvidence.verify(evidence.path, aggregate) > 100,
      "EVIDENCE_INCOMPLETE",
    );
    corpus = publicCorpus({
      headSha,
      imageId: runtime.imageId,
      packSha256: [aggregate, ...packHashes],
      passes,
      controls,
      inventory,
      sourceFiles,
    });
    const legacy = publicSummary({
      headSha,
      imageId: runtime.imageId,
      packSha256: aggregate,
      attempts: resets,
      steps: businessHttp,
      replayEqual: true,
      mappingEqual: true,
      privateVerified: true,
    });
    writeFileSync(
      join(output, "reference-summary.json"),
      `${JSON.stringify({ ...legacy, acceptanceCorpus: corpus }, null, 2)}\n`,
    );
    console.log(
      "PHP reference acceptance: 6 clean resets, 34 business steps, 6 bootstraps, 114 replay inspections; repeatability and post-cleanup packs verified. PHP-to-TS gates NOT_RUN.",
    );
  } catch (e) {
    failure = e;
    const code =
      e instanceof ReferenceWorkerError && /^[A-Z_]{1,64}$/.test(e.code)
        ? e.code
        : "TRUSTED_ERROR";
    if (evidence) {
      try {
        evidence.write("failure", {
          phase,
          code,
          diagnostic: String(e.stack ?? e),
        });
      } catch {
        /* retain original fault */
      }
    }
    if (worker) {
      try {
        await worker.close(AbortSignal.timeout(15000));
      } catch {
        shutdown = "CLEANUP_ERROR";
      }
    }
    try {
      inventory = await resources?.reap();
    } catch {
      shutdown = "CLEANUP_ERROR";
    }
    writeFileSync(
      join(output, "reference-summary.json"),
      `${JSON.stringify(
        {
          format: "workshop-reference-error-v1",
          status: "ERROR",
          phase,
          code: shutdown ?? code,
          operationCode: code,
          cleanup: inventory && !shutdown ? "VERIFIED_ZERO_RESOURCES" : "ERROR",
          externalRetention: "EXTERNAL_RETENTION_NOT_RUN",
        },
        null,
        2,
      )}\n`,
    );
    console.error(
      "PHP reference acceptance ERROR; see allowlisted error summary. Raw diagnostics remain private.",
    );
    process.exitCode = 1;
  } finally {
    process.removeListener("SIGTERM", stop);
    process.removeListener("SIGINT", stop);
  }
  return failure ? undefined : corpus;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await runAcceptance();
