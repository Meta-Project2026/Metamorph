import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseDocument } from "yaml";
import { publicRepairDecision } from "../src/autonomous-repair.mjs";
import {
  compilerRepairDecision,
  G1_RECOVERY_MODE,
} from "../src/g1-repair-eligibility.mjs";
import { compilerFeedback } from "../src/g1-repair-feedback.mjs";
import {
  consumeG1Capability,
  g1CapabilityDetails,
  startG1Recovery,
} from "../src/g1-repair-host.mjs";
import {
  consumeNativeResponseOrigin,
  prepareMetaMigration,
} from "../src/meta-migration.mjs";
import { authorizePaidWorkflow } from "../src/meta-paid-authorization.mjs";
import {
  generationPreflight,
  repairPreflight,
} from "../src/migration-preflight.mjs";
import { takeG1VerificationOrigin } from "../src/migration-trial.mjs";
import {
  isNormalFirstTypecheck,
  observeBuild,
  trustedFirstTypecheck,
} from "../src/runtime.mjs";
import {
  g1Fixture,
  testContext,
  workflowBytes,
} from "./g1-recovery-fixture.mjs";

for (const code of ["TS2339", "TS2769"])
  test(`${code}: trusted producer projection -> separate strict compiler feedback`, () => {
    const f = g1Fixture(code);
    const decision = compilerRepairDecision(f.evidence, f.bundle);
    assert.equal(decision.kind, "G1_BUILD_RECOVERABLE");
    assert.equal(decision.feedback.code, code);
    assert.deepEqual(Object.keys(decision.feedback), [
      "format",
      "code",
      "path",
      "line",
      "column",
      "bindingDigest",
    ]);
    const wire = JSON.parse(
      prepareMetaMigration(
        testContext(),
        {
          unitId: "workshop-api",
          tier: "spark",
          action: "repair",
          attempt: 2,
          repairFeedback: decision.feedback,
        },
        f.bundle.files.map(({ path, content }) => ({ path, content })),
      ),
    );
    const inner = JSON.parse(wire.messages[1].content);
    assert.deepEqual(inner.compilerFeedback, decision.feedback);
    assert.equal(Object.hasOwn(inner, "repairCodes"), false);
    assert.equal(
      inner.previousGeneratedChanges[0].content,
      f.bundle.files[0].content,
    );
    assert.throws(
      () =>
        publicRepairDecision(f.evidence.verification, f.bundle.candidateSha),
      { code: "G1_FAILED" },
    );
    assert.doesNotMatch(
      JSON.stringify(decision),
      /PRIVATE_|stdout|stderr|stack|missing/,
    );
  });

const negatives = {
  single: (e) => {
    e.plan.plan = "single_generation";
  },
  legacy: (e) => {
    e.plan.plan = "generate_then_repair";
  },
  upgrade: (e) => {
    e.generation.authorization.plan = "single_generation";
  },
  noOptIn: (e) => {
    e.plan.allowedRepairKinds = [];
  },
  confirmation: (e) => {
    e.plan.confirmation = "I_ACCEPT_ONE_PAID_ATTEMPT_NO_HARD_CAP";
  },
  head: (e) => {
    e.generation.authorization.headSha = "b".repeat(40);
  },
  actor: (e) => {
    e.generation.authorization.actor = "l1ncolny";
  },
  workflow: (e) => {
    e.generation.authorization.workflowSha256 = "b".repeat(64);
  },
  source: (e) => {
    e.generation.sourceSha = "b".repeat(40);
  },
  context: (e) => {
    e.generation.contextSha256 = "b".repeat(64);
  },
  manifest: (e) => {
    e.generation.manifestSha256 = "b".repeat(64);
  },
  model: (e) => {
    e.generation.modelId = "OTHER_MODEL";
  },
  request: (e) => {
    e.generation.inputSha256 = "b".repeat(64);
  },
  responseUnknown: (e) => {
    e.generation.confirmedResponseCount = 0;
  },
  sendUnknown: (e) => {
    e.generation.networkSend = "UNKNOWN";
  },
  extraSend: (e) => {
    e.generation.attemptedRequests = 2;
  },
  wrongAttempt: (e) => {
    e.generation.attempt = 2;
  },
  candidate: (e) => {
    e.generation.candidateSha = "b".repeat(64);
  },
  normalCleanup: (e) => {
    e.verification.cleanup.status = "ERROR";
  },
  independentCleanup: (e) => {
    e.independentCleanup.status = "NOT_RUN";
  },
  resource: (e) => {
    e.independentCleanup.containers = 1;
  },
  emergency: (e) => {
    e.verification.cleanup.emergencyRemoved = 1;
  },
  pending: (e) => {
    e.firstTypecheckNormal = false;
  },
  g1Error: (e) => {
    e.verification.publicG1 = "ERROR";
  },
  g2Pass: (e) => {
    e.verification.publicG2 = "PASS";
  },
  g3Pass: (e) => {
    e.verification.publicG3 = "PASS";
  },
  coverage: (e) => {
    e.verification.attempts[0].coverage.http = 1;
  },
  g2Execution: (e) => {
    e.verification.attempts[0].gates[2].executedTestIds = [
      "workshop-business:step-0",
    ];
  },
  extraExecuted: (e) => {
    e.verification.attempts[0].gates[1].executedTestIds.push(
      "workshop-business:build",
    );
  },
  oracleId: (e) => {
    e.verification.attempts[0].attemptId = e.custody.identity.attemptId;
  },
  link: (e) => {
    e.verification.custodyLink.verifierAttemptIds = [];
  },
  custodyRun: (e) => {
    e.custody.identity.runId = "180002";
  },
  custodyAttempt: (e) => {
    e.custody.identity.attemptId = "00000000-0000-4000-8000-000000000001";
  },
  readback: (e) => {
    e.custody.storage = "NOT_ESTABLISHED";
  },
  extraPair: (e) => {
    e.verification.attempts[0].pairs.push(e.verification.attempts[0].pairs[0]);
  },
  missingDiagnostic: (e) => {
    e.verification.attempts[0].pairs[0].compilerDiagnostics = null;
  },
  phaseError: (e) => {
    e.verification.attempts[0].pairs[0].buildPhaseDiagnostics = {
      status: "AVAILABLE",
    };
  },
};
for (const [name, mutate] of Object.entries(negatives))
  test(`compiler NO_GO: ${name}`, () => {
    const f = g1Fixture();
    const evidence = structuredClone(f.evidence);
    mutate(evidence);
    assert.throws(() => compilerRepairDecision(evidence, f.bundle), {
      code: "G1_REPAIR_NO_GO",
    });
  });
for (const [name, mutate] of Object.entries({
  count: (d) => {
    d.errorCount = 2;
  },
  truncated: (d) => {
    d.truncated = true;
  },
  extra: (d) => {
    d.entries.push(d.entries[0]);
  },
  unavailable: (d) => {
    d.status = "DIAGNOSTIC_UNAVAILABLE";
  },
  raw: (d) => {
    d.stderr = "PRIVATE_COMPILER_MESSAGE";
  },
  pair: (d) => {
    d.pairId = "f".repeat(36);
  },
  code: (d) => {
    d.entries[0].code = "TS2322";
  },
  phase: (d) => {
    d.entries[0].phase = "build";
  },
  file: (d) => {
    d.entries[0].path = "src/missing.ts";
  },
  unsafe: (d) => {
    d.entries[0].path = "../src/main.ts";
  },
  secret: (d) => {
    d.entries[0].path = "src/token.ts";
  },
  line: (d) => {
    d.entries[0].line = 9999;
  },
  column: (d) => {
    d.entries[0].column = 9999;
  },
  zero: (d) => {
    d.entries[0].line = 0;
  },
  message: (d) => {
    d.entries[0].message = "PRIVATE_MESSAGE";
  },
}))
  test(`diagnostic NO_GO: ${name}`, () => {
    const f = g1Fixture(),
      evidence = structuredClone(f.evidence);
    mutate(evidence.verification.attempts[0].pairs[0].compilerDiagnostics);
    assert.throws(() => compilerRepairDecision(evidence, f.bundle), {
      code: "G1_REPAIR_NO_GO",
    });
  });

test("public data, cloned receipts and a fake eligibility boolean cannot mint authority", async () => {
  const f = g1Fixture(),
    decision = compilerRepairDecision(f.evidence, f.bundle),
    context = testContext();
  for (const fake of [
    {},
    decision,
    structuredClone(decision),
    { eligible: true },
  ]) {
    assert.throws(() => g1CapabilityDetails(fake, context), {
      code: "G1_REPAIR_NO_GO",
    });
    assert.throws(() => consumeG1Capability(fake, context), {
      code: "G1_REPAIR_NO_GO",
    });
    assert.throws(() => takeG1VerificationOrigin(fake), {
      code: "G1_REPAIR_NO_GO",
    });
    assert.equal(trustedFirstTypecheck(fake), false);
  }
  assert.throws(
    () =>
      startG1Recovery(
        context,
        f.evidence.generation.authorization,
        "irrelevant",
      ),
    { code: "PAID_DISPATCH_NOT_AUTHORIZED" },
  );
  assert.throws(
    () =>
      consumeNativeResponseOrigin(
        f.evidence.generation,
        f.evidence.generation.authorization,
      ),
    { code: "RESPONSE_INVALID" },
  );
  await assert.rejects(
    authorizePaidWorkflow(context, {
      plan: G1_RECOVERY_MODE,
      attempt: 2,
      feedback: decision.feedback,
      previousChanges: [],
      firstAttemptCandidateSha: f.bundle.candidateSha,
      firstAttemptEstimatedUsd: 0.01,
      g1Capability: {},
    }),
    { code: "CONFIG_DENIED" },
  );
});

test("actual runtime brands only normal first typecheck; outer and phase abnormalities never qualify", () => {
  const f = g1Fixture();
  const worker = () => ({
    image: "sha256:TEST",
    bundle: f.bundle,
    evidence: {
      build: {
        args: ["sha256:TEST", "/opt/worker/build.mjs"],
        exitCode: 2,
        signal: null,
        timedOut: false,
        cancelled: false,
        overflow: false,
        spawnError: null,
        stdout: JSON.stringify({
          checks: [
            {
              phase: "typecheck",
              exitCode: 2,
              error: null,
              signal: null,
              stdout:
                "src/main.ts(2,1): error TS2339: PRIVATE_COMPILER_MESSAGE",
              stderr: "",
            },
          ],
          artifacts: [],
        }),
      },
    },
  });
  const valid = observeBuild(worker(), "workshop-business").build;
  assert.equal(isNormalFirstTypecheck(valid), true);
  assert.equal(isNormalFirstTypecheck(structuredClone(valid)), false);
  assert.equal(trustedFirstTypecheck({ pairs: [{ build: valid }] }), false);
  for (const flags of [
    { signal: "SIGTERM" },
    { timedOut: true },
    { cancelled: true },
    { overflow: true },
    { spawnError: "ENOENT" },
    { exitCode: 1 },
  ]) {
    const w = worker();
    Object.assign(w.evidence.build, flags);
    assert.equal(
      isNormalFirstTypecheck(observeBuild(w, "workshop-business").build),
      false,
    );
  }
  for (const flags of [
    { signal: "SIGTERM" },
    { error: "ETIMEDOUT" },
    { error: "ENOBUFS" },
    { error: "ENOENT" },
    { exitCode: null },
    { phase: "build" },
  ]) {
    const w = worker(),
      out = JSON.parse(w.evidence.build.stdout);
    Object.assign(out.checks[0], flags);
    w.evidence.build.stdout = JSON.stringify(out);
    try {
      assert.equal(
        isNormalFirstTypecheck(observeBuild(w, "workshop-business").build),
        false,
      );
    } catch (e) {
      assert.equal(e.code, "EVIDENCE_ERROR");
    }
  }
});

test("v2 fresh financial cards keep exact old request and conservative aggregate; DTO cannot carry messages", () => {
  const f = g1Fixture(),
    feedback = compilerRepairDecision(f.evidence, f.bundle).feedback;
  assert.ok(
    Math.abs(f.evidence.plan.aggregateWorstCaseEstimatedUsd - 0.840829) < 1e-9,
  );
  const args = {
    context: testContext(),
    headSha: "a".repeat(40),
    workflowBytes: workflowBytes(),
    actor: "barbalatv",
    maxEstimatedUsd: 1,
    plan: G1_RECOVERY_MODE,
    confirmation: "I_ACCEPT_TWO_PAID_ATTEMPTS_NO_HARD_CAP",
    now: Date.parse("2026-11-04T08:00:00Z"),
  };
  assert.throws(() => generationPreflight({ ...args, maxEstimatedUsd: 0.75 }), {
    code: "ESTIMATED_BUDGET_BLOCKED",
  });
  assert.throws(
    () => generationPreflight({ ...args, now: Date.parse("2030-01-01") }),
    { code: "TARIFF_EXPIRED" },
  );
  const card = repairPreflight({
    ...args,
    feedback,
    previousChanges: f.bundle.files,
    firstAttemptEstimatedUsd: 0.01,
    firstAttemptCandidateSha: f.bundle.candidateSha,
  });
  assert.equal(card.format, "mmp180-repair-preflight-v2");
  assert.deepEqual(card.compilerFeedback, feedback);
  assert.throws(() => compilerFeedback({ ...feedback, message: "PRIVATE" }), {
    code: "REPAIR_FEEDBACK",
  });
});

test("workflow retains the failed validator and exact legacy gate; v2 routing requires persisted G1 evidence", () => {
  const workflow = parseDocument(workflowBytes().toString()).toJS();
  const steps = workflow.jobs["generate-and-verify"].steps;
  const byId = (id) => steps.find((s) => s.id === id);
  assert.equal(byId("validation")["continue-on-error"], undefined);
  assert.equal(
    byId("repair-gate").if,
    // biome-ignore lint/suspicious/noTemplateCurlyInString: literal GitHub Actions expression
    "${{ !inputs.validate_only && inputs.execution_mode == 'generate_then_repair' && steps.validation.outcome == 'success' }}",
  );
  assert.match(
    byId("g1-repair-gate").if,
    /always\(\).*generate_then_repair_g1_v2.*generation.outcome == 'success'.*custody-stored.outcome == 'success'.*validation.outcome == 'failure'/,
  );
  assert.equal(byId("g1-repair-gate").env, undefined);
  assert.equal(
    workflow.on.workflow_dispatch.inputs.execution_mode.default,
    "single_generation",
  );
  assert.equal(
    steps.some((s) => /workflow run|gh run rerun/.test(s.run ?? "")),
    false,
  );
  const host = readFileSync(
    new URL("../src/g1-repair-host.mjs", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    host,
    /createOfflineSpike|authenticate\(|eligible === true/,
  );
});
