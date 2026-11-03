// All records in this file are synthetic. No network or candidate execution.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { parseDocument } from "yaml";
import { recordScorecard } from "../../../research/mmp-154/scorecard.mjs";
import { receiptFor } from "../src/custody-contract.mjs";
import {
  generationScorecard,
  publicTrialOutcome,
} from "../src/live-experiment.mjs";
import { generationPreflight } from "../src/migration-preflight.mjs";
import {
  context,
  syntheticVerification,
} from "./autonomous-repair-fixture.mjs";
import { artifactFixture } from "./custody-fixture.mjs";

function fixture(fail = false) {
  const headSha = "a".repeat(40),
    runId = "154001",
    candidateSha = "b".repeat(64);
  const preflight = generationPreflight({
    context: context(),
    headSha,
    actor: "barbalatv",
    workflowBytes: Buffer.from("synthetic workflow"),
    maxEstimatedUsd: 0.25,
    now: Date.parse("2026-11-03T16:00:00Z"),
  });
  const generation = {
    format: "meta-generation-v1",
    generationKind: "REAL_INFERENCE",
    status: "PASS",
    sourceSha: preflight.sourceSha,
    contextSha256: preflight.contextSha256,
    manifestSha256: preflight.manifestSha256,
    inputSha256: preflight.requestBodySha256,
    responseSha256: "c".repeat(64),
    candidateSha,
    modelId: preflight.model,
    attempt: 1,
    action: "generate",
    attemptedRequests: 1,
    confirmedResponseCount: 1,
    networkSend: "RESPONSE_RECEIVED",
    inputTokens: 100,
    outputTokens: 200,
    cachedInputTokens: 0,
    estimatedCostUsd: 0.000975,
    chargedCostUsd: null,
    usageStatus: "ESTIMATE_ONLY",
    authorization: {
      runId,
      headSha,
      preflightSha256: preflight.sha256,
      workflowSha256: preflight.workflowSha256,
    },
  };
  const trial = syntheticVerification(candidateSha, fail);
  const identity = {
    runId,
    runAttempt: "1",
    headSha,
    sourceSha: preflight.sourceSha,
    candidateSha,
    attemptId: randomUUID(),
  };
  const cipher = { sha256: "d".repeat(64), bytes: 200 };
  trial.custody = receiptFor(
    "CAPTURED_UNVERIFIED",
    identity,
    cipher,
    "VERIFIED_ZERO_RESOURCES",
  );
  trial.custodyLink = {
    identity,
    verifierAttemptIds: trial.attempts.map((a) => a.attemptId),
  };
  const stored = receiptFor(
    "STORED_UNVERIFIED",
    identity,
    cipher,
    "VERIFIED_ZERO_RESOURCES",
  );
  const transport = artifactFixture(stored);
  const finalizer = {
    headSha,
    status: "PASS",
    inventory: { containers: 0, volumes: 0 },
    emergencyRemoved: 0,
  };
  return {
    preflight,
    generation,
    trial,
    stored,
    transport,
    finalizer,
    runId,
    headSha,
  };
}

test("complete public PASS/FAIL are distinct completed comparisons; no report grants repair", () => {
  for (const fail of [false, true]) {
    const v = syntheticVerification("a".repeat(64), fail),
      result = publicTrialOutcome(v);
    assert.equal(
      result.status,
      fail ? "COMPLETE_PUBLIC_FAIL" : "COMPLETE_PUBLIC_PASS",
    );
    assert.equal(result.complete, true);
    assert.deepEqual(result.feedbackCodes, fail ? ["HTTP_JSON_TYPE"] : []);
    assert.equal(result.repair, "NOT_AUTHORIZED_BY_THIS_REPORT");
  }
});

test("incomplete coverage, stale candidate, G1 failure and failed public controls never become complete model FAIL", () => {
  for (const mutate of [
    (v) => {
      v.attempts[0].coverage.http = 16;
    },
    (v) => {
      v.attempts[0].candidateSha = "e".repeat(64);
    },
    (v) => {
      v.publicG1 = "FAIL";
      v.attempts[0].gates[1].verdict = "FAIL";
    },
    (v) => {
      v.attempts[0].gates[4].executedTestIds.pop();
    },
    (v) => {
      v.attempts[0].pairs[0].gates[2].findingCodes = ["CONTROL_FAILURE"];
    },
  ]) {
    const value = syntheticVerification("a".repeat(64), true);
    mutate(value);
    const result = publicTrialOutcome(value);
    assert.equal(result.complete, false);
    assert.equal(result.publicVerdict, "INCONCLUSIVE");
    assert.deepEqual(result.feedbackCodes, []);
  }
  const value = syntheticVerification("a".repeat(64), true);
  value.publicG2 = "ERROR";
  assert.equal(publicTrialOutcome(value).publicVerdict, "ERROR");
  value.publicG2 = "FAIL";
  value.cleanup.emergencyRemoved = 1;
  assert.equal(publicTrialOutcome(value).publicVerdict, "ERROR");
});

test("scorecard projects recorded generation, per-gate counts, custody, usage and explicit stop", () => {
  for (const fail of [false, true]) {
    const score = generationScorecard(fixture(fail));
    assert.equal(score.execution, "REAL_META"); // Classification of synthetic records only.
    assert.equal(score.evidenceBasis, "RECORDED_TRUSTED_ADAPTER_RECEIPTS");
    assert.equal(score.outcome.publicVerdict, fail ? "FAIL" : "PASS");
    assert.equal(
      score.stopReason,
      fail
        ? "PUBLIC_FAIL_SIGNED_REPAIR_NOT_IMPLEMENTED"
        : "FIRST_PUBLIC_PASS_STOP",
    );
    assert.equal(score.attemptedRequests, 1);
    assert.deepEqual(score.coverage.gateCounts, {
      G1: 6,
      G2: 17,
      G3: 20,
      G4: 27,
    });
    assert.equal(score.custody.status, "RECORDED_STORED_READBACK");
    assert.equal(score.custody.artifactId, "115002");
    assert.equal(score.chargedCostUsd, null);
    assert.equal(score.observedEstimatedCostUsd, 0.000975);
    assert.equal(score.repairs, 0);
    assert.equal(score.G4, "INCONCLUSIVE");
    assert.equal(score.product, "NOT_ESTABLISHED");
  }
});

test("signed two-attempt scorecards never misstate the authorized maximum or the executed repair", () => {
  const planFixture = fixture(true);
  const planCard = generationPreflight({
    context: context(),
    headSha: planFixture.headSha,
    actor: "barbalatv",
    workflowBytes: Buffer.from("synthetic workflow"),
    maxEstimatedUsd: 1,
    plan: "generate_then_repair",
    confirmation: "I_ACCEPT_TWO_PAID_ATTEMPTS_NO_HARD_CAP",
    now: Date.parse("2026-11-03T16:00:00Z"),
  });
  planFixture.preflight = planCard;
  planFixture.generation.authorization.preflightSha256 = planCard.sha256;
  planFixture.generation.authorization.workflowSha256 = planCard.workflowSha256;
  planFixture.generation.inputSha256 = planCard.requestBodySha256;
  // Confirmed repair response: the attempt-1 scorecard reports the executed
  // signed repair and the authorized two-send maximum; it never fabricates a
  // first-Oracle PASS or product acceptance.
  const executed = generationScorecard({
    ...planFixture,
    repairAttempted: true,
  });
  assert.equal(executed.maximumPosts, 2);
  assert.equal(executed.maximumRepairs, 1);
  assert.equal(executed.repairs, 1);
  assert.equal(executed.stopReason, "FIRST_PUBLIC_FAIL_SIGNED_REPAIR_EXECUTED");
  assert.equal(executed.outcome.publicVerdict, "FAIL");
  assert.equal(executed.outcome.status, "COMPLETE_PUBLIC_FAIL");
  assert.equal(executed.product, "NOT_ESTABLISHED");
  // Authorized but not dispatched: honest intermediate state, still 2 posts.
  const notDispatched = generationScorecard({
    ...planFixture,
    repairAttempted: false,
  });
  assert.equal(
    notDispatched.stopReason,
    "FIRST_PUBLIC_FAIL_SIGNED_REPAIR_NOT_DISPATCHED",
  );
  assert.equal(notDispatched.maximumPosts, 2);
  assert.equal(notDispatched.maximumRepairs, 1);
  assert.equal(notDispatched.repairs, 0);
  // Single-generation reporting is byte-for-byte the historical semantics.
  const single = generationScorecard(fixture(true));
  assert.equal(single.maximumPosts, 1);
  assert.equal(single.maximumRepairs, 0);
  assert.equal(single.stopReason, "PUBLIC_FAIL_SIGNED_REPAIR_NOT_IMPLEMENTED");
  assert.equal(single.repairs, 0);
  // The real run #41703793337 receipt under a plan card is never promoted to
  // PASS by this projection; custody remains unbound in the fixture.
  const realTrial = JSON.parse(
    readFileSync(
      new URL("fixtures/mmp158-real-trial-41703793337.json", import.meta.url),
      "utf8",
    ),
  );
  const realScore = generationScorecard({
    ...planFixture,
    trial: realTrial,
    repairAttempted: true,
  });
  assert.equal(realScore.outcome.publicVerdict, "INCONCLUSIVE");
  assert.equal(realScore.product, "NOT_ESTABLISHED");
});

test("foreign run/head/body/card/candidate/artifact/Oracle or abnormal cleanup suppress complete result", () => {
  for (const mutate of [
    (v) => {
      v.headSha = "e".repeat(40);
    },
    (v) => {
      v.generation.inputSha256 = "e".repeat(64);
    },
    (v) => {
      v.generation.authorization.runId = "154002";
    },
    (v) => {
      v.preflight.maximumPosts = 2;
    },
    (v) => {
      v.generation.candidateSha = "e".repeat(64);
    },
    (v) => {
      v.transport.artifact.name = "mmp107-candidate-154002-1";
    },
    (v) => {
      v.transport.run.head_sha = "e".repeat(40);
    },
    (v) => {
      v.transport.ack.archiveSha256 = "e".repeat(64);
    },
    (v) => {
      v.transport.ack.downloadOutcome = "failure";
    },
    (v) => {
      v.stored = null;
    },
    (v) => {
      v.trial.custodyLink.verifierAttemptIds = [randomUUID()];
    },
    (v) => {
      v.finalizer.emergencyRemoved = 1;
    },
    (v) => {
      v.generation.generationKind = "SYNTHETIC_WIRE_TEST";
    },
    (v) => {
      v.generation.status = "ERROR";
    },
  ]) {
    const v = structuredClone(fixture(true));
    mutate(v);
    const result = generationScorecard(v);
    assert.equal(result.outcome.complete, false);
    assert.notEqual(result.outcome.publicVerdict, "PASS");
    assert.deepEqual(result.outcome.feedbackCodes, []);
  }
});

test("ambiguous send keeps unknown charge, actual counts and no retry; arbitrary raw diagnostics do not leak", () => {
  const v = fixture();
  v.generation.networkSend = "UNKNOWN";
  v.generation.status = "ERROR";
  v.generation.confirmedResponseCount = 0;
  v.generation.usageStatus = "UNKNOWN";
  for (const key of [
    "inputTokens",
    "outputTokens",
    "cachedInputTokens",
    "estimatedCostUsd",
  ])
    v.generation[key] = null;
  v.trial = null;
  v.stored = null;
  v.transport = null;
  v.finalizer = null;
  const result = generationScorecard(v);
  assert.equal(result.execution, "REAL_META");
  assert.equal(result.attemptedRequests, 1);
  assert.equal(result.confirmedResponses, 0);
  assert.equal(result.networkSend, "UNKNOWN");
  assert.equal(result.chargedCostUsd, null);
  assert.equal(result.observedEstimatedCostUsd, null);
  assert.equal(result.outcome.complete, false);
  assert.equal(result.stopReason, "GENERATION_ERROR_NO_RETRY");
  const raw = fixture(true);
  raw.generation.requestId = "LLM_123_PRIVATE_SENTINEL";
  raw.generation.error = "Bearer PRIVATE_SENTINEL";
  raw.trial.blockers = ["raw SQL PRIVATE_SENTINEL"];
  raw.trial.debug = "<?php PRIVATE_SENTINEL";
  assert.doesNotMatch(
    JSON.stringify(generationScorecard(raw)),
    /PRIVATE_SENTINEL|Bearer|raw SQL|<\?php/,
  );
  assert.equal(generationScorecard({}).execution, "NOT_ESTABLISHED");
  const dirty = fixture();
  dirty.finalizer.status = "ERROR";
  dirty.finalizer.emergencyRemoved = 1;
  assert.equal(generationScorecard(dirty).outcome.publicVerdict, "ERROR");
});

test("always-run scorecard reads bounded records, tolerates missing files and refuses overwrite/credentials", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "mmp154-scorecard-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  // The workflow output directory exists from guard/paid-run.
  const env = {
    RUNNER_TEMP: dir,
    GITHUB_RUN_ID: "154001",
    GITHUB_SHA: "a".repeat(40),
  };
  const output = join(dir, "meta-paid-public");
  // Use the same Node filesystem boundary as the actual CLI, no subprocess mocks.
  t.assert.throws(() => recordScorecard({ ...env, MODEL_API_KEY: "TEST" }));
  mkdirSync(output, { mode: 0o700 });
  const result = recordScorecard(env);
  assert.equal(result.execution, "NOT_ESTABLISHED");
  assert.equal(result.outcome.complete, false);
  assert.throws(() => recordScorecard(env));
  rmSync(join(output, "scorecard.json"));
  writeFileSync(join(output, "trial.json"), "{", { mode: 0o600 });
  assert.throws(() => recordScorecard(env));
});

test("workflow scorecard follows finalizer, always runs without Meta credentials, and uploads fixed receipts", () => {
  const raw = readFileSync(
    new URL(
      "../../../.github/workflows/meta-paid-migration.yml",
      import.meta.url,
    ),
    "utf8",
  );
  const steps = parseDocument(raw).toJS().jobs["generate-and-verify"].steps;
  const index = steps.findIndex(
    (s) => s.run === "node research/mmp-154/scorecard.mjs",
  );
  assert.ok(index > steps.findIndex((s) => s.id === "finalizer"));
  assert.match(steps[index].if, /always\(\)/);
  assert.equal(steps[index].env?.MODEL_API_KEY, undefined);
  const upload = steps.at(-1).with.path;
  assert.match(upload, /scorecard.json/);
  assert.match(upload, /send-receipts\/1.json/);
  assert.match(upload, /send-receipts\/2.json/);
});
