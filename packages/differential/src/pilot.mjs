// Trusted CLI only. No candidate import/eval, no third-party PHP/SQLite on host.
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  chmodSync,
  DockerReferenceTransport,
  dockerCommand,
  PhpReferenceWorker,
  PrivateEvidence,
  provisionRuntime,
  SOURCE,
  verifyPair,
} from "@metamorph/oracle";
import { admitDirectory, sha256 } from "../../target-worker/src/admission.mjs";
import {
  command,
  FIXED_ENV,
  requireSuccess,
  sandboxArgs,
  TargetWorker,
} from "../../target-worker/src/controller.mjs";
import { buildTrustedRuntime } from "../../target-worker/src/runtime-broker.mjs";
import { validateTargetClock } from "./clock.mjs";
import { BASE_SHA, PUBLIC_CANDIDATE_SHA, SCENARIOS } from "./policy.mjs";
import { atomicJson, privateRun, retainOracle } from "./private-run.mjs";
import { publicSummary } from "./public.mjs";
import { Resources } from "./resources.mjs";
import { BridgeError, requireCheck, strictJson } from "./strict.mjs";
import { TargetOracleAdapter } from "./target-adapter.mjs";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const output = resolve(
  process.env.PILOT_PUBLIC_OUTPUT ?? join(tmpdir(), "mmp008a-public"),
);
mkdirSync(output, { recursive: true });
const oldMask = process.umask(0o077);
let state;
let resources;
let reference;
let transport;
let target;
let phase = "admission";
let failure = null;
let actual;
let phpRuntime;
let targetRuntime;
let result;
let cleanup = "ERROR";
let serial = 0;
let phpCommandFailure = "NONE";
const record = (kind, value) =>
  state.bridge.write(`bridge-${++serial}-${kind}`, value);
try {
  const headSha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  requireCheck(
    headSha === process.env.PILOT_HEAD_SHA && /^[a-f0-9]{40}$/.test(headSha),
    "HEAD_IDENTITY",
  );
  state = privateRun(root, {
    headSha,
    baseSha: BASE_SHA,
    source: SOURCE,
    candidateSha: PUBLIC_CANDIDATE_SHA,
    scenarios: SCENARIOS,
    manifestSha: sha256(JSON.stringify(SCENARIOS)),
    startedUtc: new Date().toISOString(),
  });
  resources = new Resources(join(state.parent, "resources.json"), record);
  const initialResources = await resources.inventory();
  requireCheck(
    !initialResources.containers.length && !initialResources.volumes.length,
    "DIRTY_SANDBOX",
  );
  const originalCommand = dockerCommand(state.php);
  const phpCommand = async (args, ...rest) => {
    resources.track(args);
    try {
      return await originalCommand(args, ...rest);
    } catch (error) {
      phpCommandFailure =
        typeof error.code === "string" ? error.code : "PHP_COMMAND_ERROR";
      throw error;
    }
  };
  const signal = AbortSignal.timeout(12 * 60 * 1000);
  phase = "php-provision";
  phpRuntime = await provisionRuntime({
    command: phpCommand,
    directory: mkdtempSync(join(tmpdir(), "mmp008a-source-")),
    oracleRoot: join(root, "packages/oracle"),
    signal,
    evidence: state.php,
  });
  // umask077 protects raw evidence, but the verified public OSS archive must be
  // readable by sandbox UID65534 through its sole readonly file bind.
  chmodSync(phpRuntime.archivePath, 0o444);
  transport = new DockerReferenceTransport(phpRuntime, phpCommand);
  const phpClock = await transport.inspectFixture(
    join(root, "packages/oracle/reference/fixture.sql"),
    signal,
  );
  record("php-clock", phpClock.raw);
  phase = "target-trusted-build";
  targetRuntime = await buildTrustedRuntime(async (_name, receipt) =>
    record("target-runtime", receipt),
  );
  record("target-provenance", targetRuntime.provenance);
  const clockProof = async (activeWorker) => {
    let receipt;
    if (activeWorker)
      receipt = await activeWorker.cmd(
        [
          "exec",
          ...FIXED_ENV,
          activeWorker.runtime.name,
          "node",
          "/opt/worker/clock.mjs",
        ],
        { signal },
      );
    else {
      const name = `mmp008a-clock-${randomUUID()}`;
      const args = [
        "run",
        ...sandboxArgs(name),
        ...FIXED_ENV,
        targetRuntime.imageId,
        "node",
        "/opt/worker/clock.mjs",
      ];
      resources.track(args);
      try {
        receipt = await command(args, { signal, timeoutMs: 15000 });
      } finally {
        const removal = await command(["rm", "--force", name], {
          timeoutMs: 5000,
        });
        record("clock-cleanup", removal);
        requireSuccess(removal, "CLEANUP_ERROR");
      }
    }
    record("target-clock", receipt);
    requireSuccess(receipt);
    validateTargetClock(strictJson(receipt.stdout));
  };
  phase = "target-clock";
  await clockProof();
  phase = "target-admission";
  const bundle = await admitDirectory(
    join(root, "packages/target-worker/fixtures/public"),
    PUBLIC_CANDIDATE_SHA,
  );
  const worker = new TargetWorker(targetRuntime, bundle, "fixed-experiment");
  resources.target(worker.runId);
  target = new TargetOracleAdapter(worker, SCENARIOS, { record });
  phase = "target-provision";
  await target.provision(signal);
  phase = "active-target-clock";
  await clockProof(worker);
  reference = new PhpReferenceWorker(
    transport,
    state.php,
    SCENARIOS.map((s) => s.id),
  );
  phase = "verify-pair";
  // Real, unchanged Oracle. Initial mismatch skips all business HTTP comparisons.
  result = await verifyPair({
    reference,
    candidate: target,
    scenarios: SCENARIOS,
    artifactParent: state.oracleParent,
    operationTimeoutMs: 30000,
  });
  phase = "retain-oracle";
  actual = retainOracle(result, state.oracleParent, state.bridge);
  if (actual.gates.some((gate) => gate.verdict === "ERROR"))
    failure = { code: "ORACLE_OPERATION_ERROR", phase: "verify-pair" };
  requireCheck(
    JSON.stringify(actual.manifest.scenarioIds) ===
      JSON.stringify(SCENARIOS.map((s) => s.id)) &&
      actual.manifest.expectedSteps === 6,
    "ORACLE_MANIFEST",
  );
} catch (error) {
  failure = {
    code:
      error instanceof BridgeError || typeof error.code === "string"
        ? error.code
        : ["ENVIRONMENT_ERROR", "CLEANUP_ERROR"].includes(error.message)
          ? error.message
          : "PILOT_ERROR",
    phase,
  };
  if (state)
    record("failure", {
      failure,
      diagnostic: String(error.message),
      targetFailure: target?.failure ?? null,
    });
} finally {
  const statuses = await Promise.allSettled([
    reference
      ? reference.close(AbortSignal.timeout(30000))
      : transport?.close(),
    target?.close(AbortSignal.timeout(30000)),
  ]);
  try {
    requireCheck(
      statuses.every((s) => s.status === "fulfilled"),
      "CLEANUP_ERROR",
    );
    const inventory = await resources.reap();
    requireCheck(
      !inventory.before.containers.length && !inventory.before.volumes.length,
      "CLEANUP_RECOVERED_ERROR",
    );
    cleanup = "VERIFIED_ZERO_RESOURCES";
  } catch {
    failure ??= { code: "CLEANUP_ERROR", phase: "cleanup" };
  }
  if (state) {
    try {
      record("completion", {
        actualGateResults: result?.gateResults ?? null,
        targetEvidence: target?.worker.evidence ?? null,
        targetFailure: target?.failure ?? null,
        failure,
        cleanup,
      });
      const phpPackSha = state.php.seal();
      const bridgePackSha = state.bridge.seal();
      PrivateEvidence.verify(state.php.path, phpPackSha);
      PrivateEvidence.verify(state.bridge.path, bridgePackSha);
      if (!failure && actual) {
        const readiness = target.worker.evidence.readiness;
        const phpBootstrap = strictJson(
          readFileSync(
            join(state.php.path, "attempt-1-bootstrap.json"),
            "utf8",
          ),
        );
        requireCheck(
          phpBootstrap.scenarioId === "workshop-business" &&
            phpBootstrap.response.status === 200,
          "PHP_BOOTSTRAP_EVIDENCE",
        );
        const summary = publicSummary({
          headSha: process.env.PILOT_HEAD_SHA,
          phpImage: phpRuntime.imageId,
          targetImage: targetRuntime.imageId,
          recipeSha: targetRuntime.provenance.recipeSha,
          phpPackSha,
          bridgePackSha,
          gates: actual.gates,
          initialDiffs: actual.initialDiffs,
          cleanup,
          counts: {
            phpBootstrap: 1,
            targetReadinessAttempts: readiness.length,
            targetReadinessSuccesses: readiness.filter((r) => r.ready).length,
            targetResetsIncludingProvision: target.worker.resetCount,
            targetOperations: target.worker.operationCount,
            targetOracleSnapshots: target.stats.snapshots,
            targetHttpRequests: target.stats.requests,
          },
        });
        atomicJson(join(output, "summary.json"), summary, 0o644);
        const [g2, g3, g4] = actual.gates;
        requireCheck(
          g2.verdict === "INCONCLUSIVE" &&
            g2.executedTestIds.length === 0 &&
            g3.verdict === "FAIL" &&
            JSON.stringify(g3.executedTestIds) ===
              '["workshop-business:initial"]' &&
            g4.verdict === "INCONCLUSIVE" &&
            actual.initialDiffs.some((d) => d.code === "DB_SCHEMA"),
          "UNEXPECTED_PILOT_RESULT",
        );
        console.log(
          "Real verifyPair completed: G2 INCONCLUSIVE, G3 FAIL (initial DB schema), G4 INCONCLUSIVE; HTTP comparisons0, initial DB comparison1; zero resources; external retention NOT_RUN.",
        );
      }
    } catch (error) {
      failure ??= {
        code: error instanceof BridgeError ? error.code : "EVIDENCE_ERROR",
        phase: "publication",
      };
    }
  }
  if (failure) {
    // Never print raw error text, worker diagnostics, observations or private paths.
    const safeCodes = new Set([
      "CLOCK_PARITY_BLOCKED",
      "HEAD_IDENTITY",
      "CLEANUP_ERROR",
      "CLEANUP_RECOVERED_ERROR",
      "UNEXPECTED_PILOT_RESULT",
      "ENVIRONMENT_ERROR",
      "BUILD_FAILED",
      "RUNTIME_FAILED",
      "TIMEOUT",
      "CANCELLED",
      "OBSERVATION_ERROR",
      "TARGET_IDENTITY",
      "TARGET_RESET_RECEIPT",
      "OBSERVATION_IDENTITY",
      "OBSERVATION_RECEIPT",
      "STALE_RUNTIME",
      "DB_WIRE",
      "DB_FORMAT",
      "DB_IDENTITY",
      "DB_SCHEMA_ORDER",
      "DB_COLUMN",
      "DB_LIMIT",
      "WIRE_DUPLICATE_KEY",
      "PRIVATE_FILE",
      "PRIVATE_PERMISSIONS",
      "PRIVATE_LINK",
      "ORACLE_ROOT",
      "ORACLE_PUBLICATION",
      "ORACLE_INDEX",
      "ORACLE_MANIFEST",
      "DIRTY_TARGET_RESET",
      "EVIDENCE_ERROR",
      "PILOT_ERROR",
      "ORACLE_OPERATION_ERROR",
      "COMMAND_EXEC_ERROR",
      "COMMAND_RUN_ERROR",
      "COMMAND_VOLUME_ERROR",
      "COMMAND_IMAGE_ERROR",
      "COMMAND_PAUSE_ERROR",
      "COMMAND_UNPAUSE_ERROR",
      "PHP_CLIENT_PARSE_ERROR",
      "WORKER_ABORTED",
      "WORKER_TIMEOUT",
      "EVIDENCE_WRITE_ERROR",
      "STEP_IDENTITY",
      "RESET_SCHEDULE",
      "INCOMPLETE_SCENARIO",
      "PRIVATE_LIMIT",
      "TARGET_OPERATION_ERROR",
    ]);
    atomicJson(
      join(output, "error.json"),
      {
        status: "ERROR",
        code: safeCodes.has(failure.code) ? failure.code : "PILOT_ERROR",
        phase: failure.phase,
        cleanup,
        targetOperationCode: safeCodes.has(target?.failure?.operationCode)
          ? target.failure.operationCode
          : target?.failure
            ? "TARGET_OPERATION_ERROR"
            : "NONE",
        targetCleanupCode:
          target?.failure?.cleanupCode === "CLEANUP_ERROR"
            ? "CLEANUP_ERROR"
            : "NONE",
        phpCommandCode: safeCodes.has(phpCommandFailure)
          ? phpCommandFailure
          : "PHP_COMMAND_ERROR",
        gates: result
          ? result.gateResults.map((gate) => ({
              gate: gate.gate,
              verdict: gate.verdict,
              executedCount: gate.executedTestIds.length,
            }))
          : [],
        externalRetention: "EXTERNAL_RETENTION_NOT_RUN",
      },
      0o644,
    );
    console.error(
      `DIFFERENTIAL_PILOT_ERROR phase=${failure.phase}; cleanup=${cleanup}`,
    );
    process.exitCode = 1;
  }
  process.umask(oldMask);
}
