// Explicit Linux Docker entrypoint. No model, private audit, or high-level manifest adapter.
import { chmodSync, mkdirSync, mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { validateTargetClock } from "../../packages/differential/src/clock.mjs";
import { atomicJson } from "../../packages/differential/src/private-run.mjs";
import { Resources } from "../../packages/differential/src/resources.mjs";
import {
  requireCheck,
  strictJson,
} from "../../packages/differential/src/strict.mjs";
import {
  DockerReferenceTransport,
  provisionRuntime,
} from "../../packages/oracle/dist/reference/docker.js";
import { PrivateEvidence } from "../../packages/oracle/dist/reference/evidence.js";
import { SOURCE } from "../../packages/oracle/dist/reference/manifest.js";
import { dockerCommand } from "../../packages/oracle/dist/reference/process.js";
import { WORKSHOP_PROFILE } from "../../packages/target-worker/runtime/profile.mjs";
import { admitDirectory } from "../../packages/target-worker/src/admission.mjs";
import {
  FIXED_ENV,
  requireSuccess,
  TargetWorker,
} from "../../packages/target-worker/src/controller.mjs";
import { buildTrustedRuntime } from "../../packages/target-worker/src/runtime-broker.mjs";
import { git, root, verifyPins } from "./config.mjs";
import { CASES_SHA, errorCode, runSchedule, summarize } from "./driver.mjs";
import { atomic, finalize } from "./finalize.mjs";
import {
  JS_SEMANTICS,
  PHP_SEMANTICS,
  publicRecord,
  publicSemantics,
} from "./public-evidence.mjs";

if (process.argv.includes("--validate-imports")) process.exit(0);
process.umask(0o077);
const output = resolve(
  process.env.MMP044_OUTPUT ?? join(tmpdir(), "mmp044-public"),
);
mkdirSync(output, { recursive: true });
const headSha = git("rev-parse", "HEAD").toString().trim();
const start = performance.now();
const abort = new AbortController();
const stop = () => abort.abort();
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
const timeout = setTimeout(stop, 20 * 60 * 1000);
const signal = abort.signal;
let parent,
  evidence,
  resources,
  serial = 0,
  results = [],
  config,
  runtimeIdentity,
  failure,
  cleanup;
const cleanupHistory = { normalCleanupError: false, emergencyRemoved: 0 };
let lastCommandFailure;
const publicRecords = [];
let projectionFailed = false;
const record = (kind, value) =>
  evidence.write(
    `entry-${++serial}-${kind.replaceAll(/[^a-z0-9-]/g, "-")}`,
    value,
  );
try {
  // A Windows preflight deliberately cannot produce runtime success.
  config = verifyPins({ strictCheckout: process.platform === "linux" });
  requireCheck(
    process.platform === "linux" && process.arch === "x64",
    "LINUX_REQUIRED",
  );
  requireCheck(
    headSha === process.env.MMP044_HEAD_SHA && /^[a-f0-9]{40}$/.test(headSha),
    "HEAD_IDENTITY",
  );
  git(
    "diff",
    "--exit-code",
    "HEAD",
    "--",
    "research/mmp-044",
    "packages/oracle",
    "packages/target-worker",
    "packages/differential",
  );
  signal.throwIfAborted();
  parent =
    process.env.MMP044_PARENT ?? mkdtempSync(join(tmpdir(), "mmp044-private-"));
  if (process.env.MMP044_PARENT) mkdirSync(parent, { mode: 0o700 });
  chmodSync(parent, 0o700);
  evidence = new PrivateEvidence(parent, root, {
    headSha,
    casesSha256: CASES_SHA,
    designation: "PUBLIC_INDEPENDENT_REPRO",
  });
  resources = new Resources(join(parent, "resources.json"), record);
  // Never reap a generic worker/provenance prefix belonging to another job.
  resources.names.prefixes = [];
  resources.persist();
  const rawCommand = dockerCommand({
    write: (id, value) => {
      evidence.write(id, value);
      if (value.exitCode !== 0 || value.fault) {
        const stderr = Buffer.from(
          value.stderrBase64 ?? "",
          "base64",
        ).toString();
        const rules = [
          [
            "DOCKER_MOUNT_PERMISSION",
            /permission denied|operation not permitted/i,
          ],
          [
            "DOCKER_MISSING_RESOURCE",
            /no such (?:file|container|volume)|not found/i,
          ],
          ["DOCKER_INVALID_MOUNT", /invalid mount|invalid argument/i],
          ["PHP_PARSE_ERROR", /PHP Parse error:/],
          ["DOCKER_DAEMON_ERROR", /Error response from daemon:/],
        ];
        lastCommandFailure = {
          exitCode: value.exitCode,
          fault: value.fault,
          category:
            rules.find((r) => r[1].test(stderr))?.[0] ?? "COMMAND_FAILED",
        };
      }
    },
  });
  const tracked = async (args, ...rest) => {
    resources.track(args);
    const receipt = await rawCommand(args, ...rest);
    // Preserve strict inspector stdout parsing in addition to its original decoder.
    if (args.includes("/inspector.php") && args[0] === "run")
      strictJson(receipt.stdout.toString());
    return receipt;
  };
  const directory = mkdtempSync(join(parent, "source-"));
  const phpRuntime = await provisionRuntime({
    command: tracked,
    directory,
    oracleRoot: join(root, "packages/oracle"),
    signal,
    evidence,
  });
  // provisionRuntime's create mode is subject to our 077 umask. The verified
  // public OSS archive must be readable by uid 65534 through its readonly bind.
  chmodSync(phpRuntime.archivePath, 0o444);
  requireCheck(
    (statSync(phpRuntime.archivePath).mode & 0o777) === 0o444,
    "PROVENANCE_MISMATCH",
  );
  // Existing broker joins its bounded build/provenance/cleanup before returning.
  // Cancellation is checked after joining; no new operation starts on a late result.
  const runtime = await buildTrustedRuntime((name, receipt) => {
    const at = receipt.args?.indexOf("--name") ?? -1;
    const owned =
      at >= 0
        ? receipt.args[at + 1]
        : name === "provenance-cleanup.json"
          ? receipt.args?.at(-1)
          : null;
    if (owned && /^mmp007-provenance-[a-f0-9-]{36}$/.test(owned)) {
      resources.names.brokerContainers = [
        ...new Set([...(resources.names.brokerContainers ?? []), owned]),
      ];
      resources.persist();
    }
    record("runtime", { name, receipt });
  });
  signal.throwIfAborted();
  requireCheck(
    runtime.provenance.recipeSha === config.pins.targetRecipeSha256,
    "PIN_MISMATCH",
  );
  const bundle = await admitDirectory(
    join(root, "packages/target-worker/fixtures/workshop"),
    config.pins.candidateSha256,
  );
  runtimeIdentity = {
    phpImageId: phpRuntime.imageId,
    phpBaseImage: phpRuntime.baseImage,
    sourceSha256: phpRuntime.sourceSha256,
    targetImageId: runtime.imageId,
    recipeSha256: runtime.provenance.recipeSha,
    targetNode: runtime.provenance.measured.node,
    targetSqlite: runtime.provenance.measured.sqlite,
  };
  results = await runSchedule(
    config.corpus,
    async () => {
      // Ledger exists and ownership is persisted before either provision operation.
      const target = new TargetWorker(runtime, bundle, "fixed-experiment", {
        profile: WORKSHOP_PROFILE,
      });
      resources.target(target.runId);
      let phpName;
      const php = new DockerReferenceTransport(phpRuntime, (args, ...rest) => {
        const at = args.indexOf("--name");
        if (at >= 0 && /^mmp-reference-[a-f0-9-]{36}$/.test(args[at + 1]))
          phpName = args[at + 1];
        return tracked(args, ...rest);
      });
      return {
        target,
        php,
        resources,
        diagnostics: () => lastCommandFailure,
        identity: (identity) => ({
          runtimeId: identity.runtimeId,
          volume: target.runtime.volume,
        }),
        cleanupVerified: () => target.evidence.cleanupVerified === true,
        clock: async (workSignal) => {
          const receipt = requireSuccess(
            await target.cmd(
              [
                "exec",
                ...FIXED_ENV,
                target.runtime.name,
                "node",
                "/opt/worker/clock.mjs",
              ],
              { signal: workSignal },
            ),
          );
          const clock = strictJson(receipt.stdout);
          validateTargetClock(clock);
          record("clock", clock);
          const phpDiagnostic = await tracked(
            ["exec", phpName, "php", "-r", PHP_SEMANTICS],
            workSignal,
          );
          const tsDiagnostic = requireSuccess(
            await target.cmd(
              [
                "exec",
                target.runtime.name,
                "node",
                "--input-type=module",
                "-e",
                JS_SEMANTICS,
              ],
              { signal: workSignal },
            ),
          );
          const semantics = publicSemantics(
            strictJson(phpDiagnostic.stdout.toString(), 4096),
            strictJson(tsDiagnostic.stdout, 4096),
          );
          record("public-semantics", semantics);
          return {
            fixedUtc: clock.before.date,
            monotonicDeltaMs: clock.monotonicDeltaMs,
            node: clock.node,
            sqlite: clock.sqlite,
            semantics,
          };
        },
      };
    },
    signal,
    (id, kind, value) => {
      try {
        const projection = publicRecord(config.corpus, id, kind, value);
        if (projection) publicRecords.push(projection);
      } catch {
        projectionFailed = true;
      }
      if (kind === "case-receipt") {
        cleanupHistory.normalCleanupError ||=
          value.normalCleanup !== "PASS" ||
          value.emergencyRemoved > 0 ||
          value.errorCode === "CLEANUP_ERROR";
        cleanupHistory.emergencyRemoved += value.emergencyRemoved;
        atomic(join(parent, "cleanup-history.json"), cleanupHistory);
      }
      record(`${id}-${kind}`, value);
    },
  );
} catch (error) {
  failure = signal.aborted ? "ABORTED" : errorCode(error);
} finally {
  clearTimeout(timeout);
  process.removeListener("SIGINT", stop);
  process.removeListener("SIGTERM", stop);
  try {
    if (parent) cleanup = await finalize(parent, record);
  } catch {
    cleanup = { status: "ERROR", emergencyRemoved: null, inventory: null };
  }
}
let summary;
if (config) summary = summarize(config.corpus, results);
else
  summary = {
    classification: "NOT_ESTABLISHED",
    harness: "ERROR",
    parity: "INCONCLUSIVE",
    cases: [],
    coverage: { http: 0, sqlite: 0, completedPairs: 0 },
    gates: {
      G0: "INCONCLUSIVE",
      G1: "NOT_RUN",
      G2: "NOT_RUN",
      G3: "NOT_RUN",
      G4: "INCONCLUSIVE",
    },
    product: "NOT_ESTABLISHED",
  };
if (failure || cleanup?.status !== "PASS") {
  summary.harness = "ERROR";
  summary.parity = "INCONCLUSIVE";
}
Object.assign(summary, {
  designation: "PUBLIC_INDEPENDENT_REPRO",
  headSha,
  casesSha256: CASES_SHA,
  candidateSha256: config?.pins.candidateSha256,
  sourceCommit: SOURCE.commit,
  manifestSha256: config?.pins.manifestSha256,
  normalizationVersion: "oracle-exact-v1",
  runtime: runtimeIdentity ?? null,
  runtimeExecution: results.length ? "STARTED" : "DOCKER_NOT_RUN",
  errorCode: failure ?? null,
  commandFailure: lastCommandFailure ?? null,
  cleanup: cleanup ?? {
    status: "NOT_RUN",
    inventory: null,
    emergencyRemoved: null,
  },
  durationMs: Math.round(performance.now() - start),
});
if (evidence) {
  const index = evidence.seal();
  PrivateEvidence.verify(evidence.path, index);
}
summary.publicEvidence = {
  status:
    !projectionFailed &&
    publicRecords.length === 76 &&
    summary.harness === "SUCCESS"
      ? "ALLOWLIST_VERIFIED"
      : "NOT_PUBLISHED",
  records: publicRecords.length,
};
if (summary.publicEvidence.status === "ALLOWLIST_VERIFIED")
  atomicJson(
    join(output, "public-repro.json"),
    {
      designation: "PUBLIC_INDEPENDENT_REPRO",
      headSha,
      casesSha256: CASES_SHA,
      projection:
        "PUBLIC_NUMERIC_IDS_DATES_COUNTS_ONLY_NO_MESSAGES_OR_SEED_IDENTITIES",
      records: publicRecords,
    },
    0o644,
  );
atomicJson(join(output, "summary.json"), summary, 0o644);
console.log(
  JSON.stringify({
    harness: summary.harness,
    classification: summary.classification,
    coverage: summary.coverage,
    errorCode: summary.errorCode,
  }),
);
if (summary.harness !== "SUCCESS") process.exitCode = 1;
