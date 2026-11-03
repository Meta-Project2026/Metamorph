// Offline controls for the MMP-165 custody-capture diagnostics: the coarse
// allowlisted stage classifier, the credential-free readiness probe with an
// injected Docker runner, and the capture-failure scorecard stop reason.
// No Docker, age, network, candidate bytes or paid action.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  CUSTODY_CAPTURE_STAGES,
  classifyCollectorOutcome,
} from "../src/custody-capture.mjs";
import {
  CUSTODY_READINESS,
  custodyReadiness,
} from "../src/custody-readiness.mjs";
import { generationScorecard } from "../src/live-experiment.mjs";
import { bindMigrationContext } from "../src/migration-context.mjs";
import { generationPreflight } from "../src/migration-preflight.mjs";
import { DIAGNOSTIC_POLICY } from "../src/private-diagnostics.mjs";

const head = "a".repeat(40);
const source = readFileSync(
  new URL("../../../research/mmp-061/public-source.json", import.meta.url),
  "utf8",
);
const context = () => bindMigrationContext(source);

test("custody capture stages are a closed allowlisted enum", () => {
  for (const stage of [
    "CAPSULE_REJECTED",
    "COLLECTOR_ABORTED",
    "COLLECTOR_TIMEOUT",
    "COLLECTOR_KILLED",
    "COLLECTOR_ERROR",
    "COLLECTOR_EXITED",
    "SOURCE_LEASE_CHANGED",
    "HOST_RECEIPT_INVALID",
    "UNKNOWN",
  ])
    assert.ok(CUSTODY_CAPTURE_STAGES.includes(stage));
  assert.equal(CUSTODY_CAPTURE_STAGES.length, 9);
});

test("collector outcome classifier pins every coarse stage", () => {
  assert.equal(classifyCollectorOutcome({ ok: true }), null);
  assert.equal(
    classifyCollectorOutcome({ ok: false, aborted: true }),
    "COLLECTOR_ABORTED",
  );
  assert.equal(
    classifyCollectorOutcome({ ok: false, timedOut: true, killed: true }),
    "COLLECTOR_TIMEOUT",
  );
  assert.equal(
    classifyCollectorOutcome({ ok: false, killed: true }),
    "COLLECTOR_KILLED",
  );
  assert.equal(
    classifyCollectorOutcome({ ok: false, errored: true }),
    "COLLECTOR_ERROR",
  );
  assert.equal(
    classifyCollectorOutcome({ ok: false, overflow: true }),
    "COLLECTOR_KILLED",
  );
  assert.equal(
    classifyCollectorOutcome({ ok: false, code: 1, termSignal: "SIGTERM" }),
    "COLLECTOR_KILLED",
  );
  assert.equal(
    classifyCollectorOutcome({ ok: false, code: 1, termSignal: null }),
    "COLLECTOR_EXITED",
  );
  assert.equal(
    classifyCollectorOutcome({ ok: false, code: null, termSignal: null }),
    "COLLECTOR_EXITED",
  );
});

test("readiness probe returns fixed verdicts with an injected runner", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "mmp165-readiness-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const agePath = join(dir, "age");
  const goodAge = Buffer.from("pinned age tool bytes");
  writeFileSync(agePath, goodAge, { mode: 0o600 });
  const workerPath = fileURLToPath(
    new URL("../../../research/mmp-089/encrypt-worker.mjs", import.meta.url),
  );
  const expected = createHash("sha256").update(goodAge).digest("hex");
  const base = {
    agePath,
    workerPath,
    image: DIAGNOSTIC_POLICY.image,
    expectedAgeSha256: expected,
  };
  const fakeDocker = (calls) => async (args) => {
    calls.push(args[0]);
    return { ok: true, code: 0, bytes: Buffer.from("ok") };
  };
  const calls = [];
  assert.equal(
    await custodyReadiness({ ...base, runDocker: fakeDocker(calls) }),
    "READY",
  );
  assert.deepEqual(calls, ["version", "image"]);
  // Deterministic negative verdicts.
  assert.equal(
    await custodyReadiness({ ...base, agePath: join(dir, "missing") }),
    "AGE_TOOL_MISSING",
  );
  writeFileSync(agePath, Buffer.from("tampered"), { mode: 0o600 });
  assert.equal(await custodyReadiness(base), "AGE_TOOL_HASH_MISMATCH");
  writeFileSync(agePath, goodAge, { mode: 0o600 });
  assert.equal(
    await custodyReadiness({
      ...base,
      workerPath: join(dir, "missing-worker.mjs"),
    }),
    "ENCRYPT_WORKER_MISSING",
  );
  assert.equal(
    await custodyReadiness({
      ...base,
      runDocker: async () => ({ ok: false, code: 1, bytes: Buffer.alloc(0) }),
    }),
    "DOCKER_UNAVAILABLE",
  );
  let second = false;
  assert.equal(
    await custodyReadiness({
      ...base,
      runDocker: async () => {
        if (!second) {
          second = true;
          return { ok: true, code: 0, bytes: Buffer.from("ok") };
        }
        return { ok: false, code: 1, bytes: Buffer.alloc(0) };
      },
    }),
    "ENCRYPT_IMAGE_MISSING",
  );
  assert.equal(
    await custodyReadiness({
      ...base,
      runDocker: async () => {
        throw new Error("PRIVATE_PATH_CANARY");
      },
    }),
    "PROBE_ERROR",
  );
  // The verdict enum is closed.
  for (const verdict of CUSTODY_READINESS)
    assert.ok(typeof verdict === "string");
});

test("capture-failed trials stop with an explicit no-Oracle reason and stage", () => {
  const { generationScorecard: score } = { generationScorecard };
  const planFixture = buildFixture();
  const captured = generationScorecard({
    ...planFixture,
    trial: {
      ...planFixture.trial,
      blockers: ["CUSTODY_CAPTURE_FAILED"],
      custodyCaptureStage: "COLLECTOR_EXITED",
      publicG1: "NOT_RUN",
      publicG2: "NOT_RUN",
      publicG3: "NOT_RUN",
      attempts: [],
      coverage: undefined,
    },
  });
  assert.equal(captured.stopReason, "CUSTODY_CAPTURE_FAILED_NO_ORACLE");
  assert.equal(captured.outcome.publicVerdict, "INCONCLUSIVE");
  assert.equal(captured.product, "NOT_ESTABLISHED");
  assert.equal(captured.repairs, 0);
  // Baseline key order is unchanged: no new keys were introduced.
  assert.equal(Object.hasOwn(captured, "custodyCaptureStage"), false);
  // Other incomplete runs keep their historical reasons.
  const other = generationScorecard(planFixture);
  assert.notEqual(other.stopReason, "CUSTODY_CAPTURE_FAILED_NO_ORACLE");
});

function buildFixture() {
  const planCard = generationPreflight({
    context: context(),
    headSha: head,
    actor: "barbalatv",
    workflowBytes: Buffer.from("synthetic workflow"),
    maxEstimatedUsd: 1,
    plan: "generate_then_repair",
    confirmation: "I_ACCEPT_TWO_PAID_ATTEMPTS_NO_HARD_CAP",
    now: Date.parse("2026-11-03T16:00:00Z"),
  });
  const generation = {
    format: "meta-generation-v1",
    generationKind: "REAL_INFERENCE",
    status: "PASS",
    sourceSha: planCard.sourceSha,
    contextSha256: planCard.contextSha256,
    manifestSha256: planCard.manifestSha256,
    inputSha256: planCard.requestBodySha256,
    responseSha256: "c".repeat(64),
    candidateSha: "b".repeat(64),
    modelId: "muse-spark-1.3",
    attempt: 1,
    action: "generate",
    attemptedRequests: 1,
    confirmedResponseCount: 1,
    networkSend: "RESPONSE_RECEIVED",
    inputTokens: 100,
    outputTokens: 200,
    cachedInputTokens: 0,
    estimatedCostUsd: 0.01,
    chargedCostUsd: null,
    usageStatus: "ESTIMATE_ONLY",
    authorization: {
      runId: "154001",
      headSha: head,
      attempt: 1,
      plan: "generate_then_repair",
      preflightSha256: planCard.sha256,
      workflowSha256: planCard.workflowSha256,
    },
  };
  return {
    preflight: planCard,
    generation,
    trial: {
      format: "mmp078-public-paid-trial-v1",
      headSha: head,
      candidateSha: "b".repeat(64),
      publicG1: "PASS",
      publicG2: "FAIL",
      publicG3: "FAIL",
      G0: "INCONCLUSIVE",
      G4: "INCONCLUSIVE",
      product: "NOT_ESTABLISHED",
      attempts: [],
      blockers: [],
      cleanup: {
        status: "NOT_RUN",
        containers: null,
        volumes: null,
        emergencyRemoved: null,
      },
    },
    stored: null,
    transport: null,
    finalizer: null,
    runId: "154001",
    headSha: head,
  };
}
