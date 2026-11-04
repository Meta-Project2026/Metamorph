// Offline fail-closed controls for the signed two-attempt repair vertical
// (MMP-158). No Meta credential, OIDC, Docker, network or paid action. The
// real sanitized receipt of paid run #41703793337 is used as read-only
// feedback evidence; it contains hashes and identifiers only, never candidate
// text, reference observations or key material.
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
import { MANIFEST, MANIFEST_SHA256, SOURCE } from "@metamorph/oracle";
import { sha256, validateBundle } from "../../target-worker/src/admission.mjs";
import {
  publicRepairDecision,
  REPAIR_POLICY,
} from "../src/autonomous-repair.mjs";
import { requireMigrationMode } from "../src/autonomous-repair-policy.mjs";
import { candidateArtifactName } from "../src/custody-checkpoint.mjs";
import {
  CUSTODY,
  CUSTODY_LICENSE,
  validateCapsule,
} from "../src/custody-contract.mjs";
import { validateWorkflowIdentity } from "../src/github-meta-guard.mjs";
import { repairScorecard } from "../src/live-experiment.mjs";
import {
  createOfflineMetaWireHarness,
  prepareMetaMigration,
} from "../src/meta-migration.mjs";
import {
  PAID_POLICY,
  repairProjection,
} from "../src/meta-paid-authorization.mjs";
import { bindMigrationContext } from "../src/migration-context.mjs";
import {
  generationPreflight,
  repairPreflight,
} from "../src/migration-preflight.mjs";

const head = "a".repeat(40);
const firstCandidateSha = "4".repeat(64);
const now = Date.parse("2026-11-03T16:00:00Z");
const source = readFileSync(
  new URL("../../../research/mmp-061/public-source.json", import.meta.url),
  "utf8",
);
const context = () => bindMigrationContext(source);
const signal = () => new AbortController().signal;
const previous = [
  { path: "src/main.ts", content: "export const genuinePriorModelOutput = 1;" },
];
const envelope = () => ({
  id: "chatcmpl-repair-test",
  object: "chat.completion",
  created: 1,
  model: "muse-spark-1.3",
  choices: [
    {
      index: 0,
      finish_reason: "stop",
      logprobs: null,
      message: {
        role: "assistant",
        content: JSON.stringify({
          changes: [
            {
              path: "src/main.ts",
              content: "export const repairedModelOutput = 2;",
            },
          ],
        }),
        refusal: null,
      },
    },
  ],
  usage: {
    prompt_tokens: 1000,
    completion_tokens: 100,
    total_tokens: 1100,
    prompt_tokens_details: { cached_tokens: 0 },
    completion_tokens_details: { reasoning_tokens: 0 },
  },
});
const reply = () => ({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify(envelope()),
});
const hostedValues = () => ({
  GITHUB_EVENT_NAME: "workflow_dispatch",
  GITHUB_REPOSITORY: "Meta-Project2026/Metamorph",
  GITHUB_REF: "refs/heads/main",
  GITHUB_SHA: head,
  GITHUB_ACTOR: "barbalatv",
  GITHUB_ACTOR_ID: "85129726",
  GITHUB_RUN_ATTEMPT: "1",
  GITHUB_RUN_ID: "12345",
  RUNNER_ENVIRONMENT: "github-hosted",
  GITHUB_WORKFLOW_REF:
    "Meta-Project2026/Metamorph/.github/workflows/meta-paid-migration.yml@refs/heads/main",
});
const twoAttemptInputs = () => ({
  reviewed_sha: head,
  execution_mode: "generate_then_repair",
  confirm_paid: "I_ACCEPT_TWO_PAID_ATTEMPTS_NO_HARD_CAP",
  max_estimated_usd: "1.00",
  model_provider: "meta",
});
const workflowBytes = () =>
  readFileSync(
    new URL(
      "../../../.github/workflows/meta-paid-migration.yml",
      import.meta.url,
    ),
  );
const realTrial = () =>
  JSON.parse(
    readFileSync(
      new URL("fixtures/mmp158-real-trial-41703793337.json", import.meta.url),
      "utf8",
    ),
  );

test("real paid run #41703793337 receipt is a complete eligible public FAIL", () => {
  const trial = realTrial();
  assert.equal(
    trial.candidateSha,
    "045d2433abdba38b7f15f7c18d10fc6c6c50d97f2322b159b09d64f9e2a9013e",
  );
  const decision = publicRepairDecision(trial, trial.candidateSha);
  assert.equal(decision.verdict, "FAIL");
  assert.equal(decision.feedback, "HTTP_JSON_TYPE");
  assert.ok(decision.attemptId);
  assert.equal(decision.pairIds.length, MANIFEST.length);
  // Incomplete or tampered receipts never admit repair.
  for (const mutate of [
    (t) => {
      t.publicG2 = "INCONCLUSIVE";
    },
    (t) => {
      t.candidateSha = "0".repeat(64);
    },
    (t) => {
      t.attempts[0].coverage.http = 16;
    },
    (t) => {
      t.attempts[0].gates[1].verdict = "FAIL";
    },
    (t) => {
      t.cleanup.status = "ERROR";
    },
  ]) {
    const copy = structuredClone(trial);
    mutate(copy);
    if (copy.candidateSha === trial.candidateSha)
      assert.throws(() => publicRepairDecision(copy, trial.candidateSha));
  }
});

test("repair prompt carries only genuine prior changes and public feedback codes", () => {
  const body = JSON.parse(
    prepareMetaMigration(
      context(),
      {
        unitId: "workshop-api",
        tier: "spark",
        action: "repair",
        attempt: 2,
        repairFeedback: "HTTP_JSON_TYPE",
      },
      previous,
    ),
  ).messages[1].content;
  const inner = JSON.parse(body);
  assert.equal(inner.action, "repair");
  assert.deepEqual(inner.repairCodes, ["HTTP_JSON_TYPE"]);
  assert.deepEqual(inner.previousGeneratedChanges, previous);
  // No held-out fixtures, replay answers, credentials or reference outputs
  // ride along; the context itself is the pinned public source only.
  assert.doesNotMatch(
    body,
    /workshop-compat-v1|replayProvider|MODEL_API_KEY|correctedReplay|HELD_OUT|PRIVATE_PATH/,
  );
  assert.throws(
    () =>
      prepareMetaMigration(
        context(),
        {
          unitId: "workshop-api",
          tier: "spark",
          action: "repair",
          attempt: 2,
          repairFeedback: "MADE_UP_CODE",
        },
        previous,
      ),
    { code: "REPAIR_FEEDBACK" },
  );
});

test("PDO JSON type contract is present in both generation and repair prompts; schema contract unchanged", () => {
  const generateWire = JSON.parse(
    prepareMetaMigration(context(), {
      unitId: "workshop-api",
      tier: "spark",
      action: "generate",
      attempt: 1,
      repairFeedback: null,
    }),
  );
  const repairWire = JSON.parse(
    prepareMetaMigration(
      context(),
      {
        unitId: "workshop-api",
        tier: "spark",
        action: "repair",
        attempt: 2,
        repairFeedback: "HTTP_JSON_TYPE",
      },
      previous,
    ),
  );
  for (const wire of [generateWire, repairWire]) {
    const target = JSON.parse(wire.messages[1].content).context.target;
    // The shared target context carries the source-grounded PDO JSON types.
    assert.match(target.jsonContract, /PDO::lastInsertId\(\)/);
    assert.match(
      target.jsonContract,
      /fetchAll\(\) yields SQLite numeric columns/,
    );
    assert.match(target.jsonContract, /is_full is a JSON boolean/);
    assert.match(
      target.jsonContract,
      /non-NULL fetched column as a JSON string/,
    );
    assert.match(target.jsonContract, /SQL NULL as JSON null/);
    // P0: success must never be described as a string.
    assert.match(target.jsonContract, /success is always a JSON boolean/);
    assert.doesNotMatch(
      target.jsonContract,
      /success, message and error_type string/,
    );
    assert.doesNotMatch(target.jsonContract, /success.*string fields/);
    assert.match(
      target.jsonContract,
      /error_type appears only as a JSON string in the source branches/,
    );
    assert.match(
      target.jsonContract,
      /Do not globally stringify or numericize/,
    );
    // The MMP-156 schema DDL contract is untouched.
    assert.match(target.schemaContract, /exact stored sqlite_schema DDL text/);
    assert.match(target.schemaContract, /byte-for-byte/);
  }
});

test("repair session sends exactly one attempt-2 request with the genuine prior changes", async () => {
  const bodies = [];
  const h = createOfflineMetaWireHarness(
    context(),
    async ({ body }) => {
      bodies.push(body);
      return reply();
    },
    { firstAttempt: 2, previousChanges: previous },
  );
  const response = await h.provider.generate(
    {
      unitId: "workshop-api",
      tier: "spark",
      action: "repair",
      attempt: 2,
      repairFeedback: "HTTP_JSON_TYPE",
    },
    signal(),
  );
  assert.equal(response.changes.length, 1);
  assert.equal(bodies.length, 1);
  const inner = JSON.parse(JSON.parse(bodies[0]).messages[1].content);
  assert.deepEqual(inner.previousGeneratedChanges, previous);
  assert.deepEqual(inner.repairCodes, ["HTTP_JSON_TYPE"]);
  assert.equal(h.receipts()[0].attempt, 2);
  assert.equal(h.receipts()[0].action, "repair");
  assert.equal(h.receipts()[0].generationKind, "SYNTHETIC_WIRE_TEST");
  // No third send: the session stops after its single repair request.
  await assert.rejects(
    h.provider.generate(
      {
        unitId: "workshop-api",
        tier: "spark",
        action: "repair",
        attempt: 2,
        repairFeedback: "HTTP_JSON_TYPE",
      },
      signal(),
    ),
    { code: "SESSION_STOPPED" },
  );
});

test("attempt sequences stay strict in both directions", async () => {
  const repair = createOfflineMetaWireHarness(context(), async () => reply(), {
    firstAttempt: 2,
    previousChanges: previous,
  });
  await assert.rejects(
    repair.provider.generate(
      {
        unitId: "workshop-api",
        tier: "spark",
        action: "generate",
        attempt: 1,
        repairFeedback: null,
      },
      signal(),
    ),
    { code: "REQUEST_SEQUENCE" },
  );
  const fresh = createOfflineMetaWireHarness(context(), async () => reply());
  await assert.rejects(
    fresh.provider.generate(
      {
        unitId: "workshop-api",
        tier: "spark",
        action: "repair",
        attempt: 2,
        repairFeedback: "HTTP_JSON_TYPE",
      },
      signal(),
    ),
    { code: "REQUEST_SEQUENCE" },
  );
  assert.throws(
    () =>
      createOfflineMetaWireHarness(context(), async () => reply(), {
        firstAttempt: 2,
      }),
    { code: "CONFIG_DENIED" },
  );
  assert.throws(
    () =>
      createOfflineMetaWireHarness(context(), async () => reply(), {
        firstAttempt: 3,
        previousChanges: previous,
      }),
    { code: "CONFIG_DENIED" },
  );
});

test("workflow identity pairs the two-attempt mode with its explicit confirmation", () => {
  const values = hostedValues();
  validateWorkflowIdentity(values, head, twoAttemptInputs(), true);
  for (const bad of [
    {
      ...twoAttemptInputs(),
      confirm_paid: "I_ACCEPT_ONE_PAID_ATTEMPT_NO_HARD_CAP",
    },
    { ...twoAttemptInputs(), execution_mode: "single_generation" },
    { ...twoAttemptInputs(), execution_mode: "autonomous_repair" },
    { ...twoAttemptInputs(), max_estimated_usd: "0.05" },
    { ...twoAttemptInputs(), reviewed_sha: "0".repeat(40) },
  ])
    assert.throws(
      () => validateWorkflowIdentity(values, head, bad, true),
      Error,
    );
  // The single-generation default keeps its exact pairing.
  validateWorkflowIdentity(
    values,
    head,
    {
      reviewed_sha: head,
      confirm_paid: "I_ACCEPT_ONE_PAID_ATTEMPT_NO_HARD_CAP",
      max_estimated_usd: "1.00",
      model_provider: "meta",
    },
    true,
  );
  requireMigrationMode("generate_then_repair");
  assert.throws(() => requireMigrationMode("autonomous_repair"), {
    code: "BLOCKED_BUDGET_GUARANTEE",
  });
  assert.throws(() => requireMigrationMode("other"), {
    code: "MIGRATION_MODE_BLOCKED",
  });
});

test("plan card reserves both sends before the first POST", () => {
  const card = generationPreflight({
    context: context(),
    headSha: head,
    workflowBytes: workflowBytes(),
    actor: "barbalatv",
    maxEstimatedUsd: 1,
    plan: "generate_then_repair",
    confirmation: "I_ACCEPT_TWO_PAID_ATTEMPTS_NO_HARD_CAP",
    now,
  });
  assert.equal(card.maximumPosts, 2);
  assert.equal(card.maximumRepairs, 1);
  assert.equal(card.plan, "generate_then_repair");
  assert.equal(card.repairWireBytes, REPAIR_POLICY.repairWireBytes);
  assert.equal(
    card.aggregateWorstCaseEstimatedUsd,
    card.worstCaseEstimatedUsd + repairProjection().worstCaseEstimatedUsd,
  );
  assert.ok(card.aggregateWorstCaseEstimatedUsd <= 1);
  assert.ok(Math.abs(card.aggregateWorstCaseEstimatedUsd - 0.840829) < 1e-9);
  assert.equal(card.confirmation, "I_ACCEPT_TWO_PAID_ATTEMPTS_NO_HARD_CAP");
  // An allowance that cannot cover the pessimistic aggregate is refused.
  assert.throws(
    () =>
      generationPreflight({
        context: context(),
        headSha: head,
        workflowBytes: workflowBytes(),
        actor: "barbalatv",
        maxEstimatedUsd: 0.75,
        plan: "generate_then_repair",
        confirmation: "I_ACCEPT_TWO_PAID_ATTEMPTS_NO_HARD_CAP",
        now,
      }),
    { code: "ESTIMATED_BUDGET_BLOCKED" },
  );
  // The single-generation card is unchanged.
  const single = generationPreflight({
    context: context(),
    headSha: head,
    workflowBytes: workflowBytes(),
    actor: "barbalatv",
    maxEstimatedUsd: 0.25,
    now,
  });
  assert.equal(single.maximumPosts, 1);
  assert.equal(single.maximumRepairs, 0);
  assert.equal(single.confirmation, "I_ACCEPT_ONE_PAID_ATTEMPT_NO_HARD_CAP");
});

test("repair card binds the exact repair body and re-checks the aggregate", () => {
  const repairBody = () =>
    prepareMetaMigration(
      context(),
      {
        unitId: "workshop-api",
        tier: "spark",
        action: "repair",
        attempt: 2,
        repairFeedback: "HTTP_JSON_TYPE",
      },
      previous,
    );
  const card = repairPreflight({
    context: context(),
    headSha: head,
    workflowBytes: workflowBytes(),
    actor: "barbalatv",
    maxEstimatedUsd: 1,
    feedback: "HTTP_JSON_TYPE",
    previousChanges: previous,
    firstAttemptEstimatedUsd: 0.05110625,
    firstAttemptCandidateSha: firstCandidateSha,
    confirmation: "I_ACCEPT_TWO_PAID_ATTEMPTS_NO_HARD_CAP",
    now,
  });
  assert.equal(card.format, "mmp154-repair-preflight-v1");
  assert.equal(card.attempt, 2);
  assert.equal(card.action, "repair");
  assert.equal(card.requestBodySha256, sha256(repairBody()));
  assert.equal(card.repairFeedbackCodes, "HTTP_JSON_TYPE");
  assert.equal(card.firstAttemptCandidateSha, firstCandidateSha);
  assert.equal(
    card.aggregateWorstCaseEstimatedUsd,
    0.05110625 + card.worstCaseEstimatedUsd,
  );
  assert.ok(card.requestBytes <= PAID_POLICY.repairWireBytes);
  // Observed first-attempt estimate plus the repair projection must fit.
  assert.throws(
    () =>
      repairPreflight({
        context: context(),
        headSha: head,
        workflowBytes: workflowBytes(),
        actor: "barbalatv",
        maxEstimatedUsd: 0.5,
        feedback: "HTTP_JSON_TYPE",
        previousChanges: previous,
        firstAttemptEstimatedUsd: 0.55,
        firstAttemptCandidateSha: firstCandidateSha,
        confirmation: "I_ACCEPT_TWO_PAID_ATTEMPTS_NO_HARD_CAP",
        now,
      }),
    { code: "ESTIMATED_BUDGET_BLOCKED" },
  );
  // A repair body beyond the reserved wire bound is refused.
  const oversize = [{ path: "src/main.ts", content: "x".repeat(200 * 1024) }];
  assert.throws(
    () =>
      repairPreflight({
        context: context(),
        headSha: head,
        workflowBytes: workflowBytes(),
        actor: "barbalatv",
        maxEstimatedUsd: 1,
        feedback: "HTTP_JSON_TYPE",
        previousChanges: oversize,
        firstAttemptEstimatedUsd: 0.05,
        firstAttemptCandidateSha: firstCandidateSha,
        confirmation: "I_ACCEPT_TWO_PAID_ATTEMPTS_NO_HARD_CAP",
        now,
      }),
    { code: "INPUT_LIMIT" },
  );
});

test("attempt-2 custody capsule shape is exact and fail-closed", () => {
  const license = JSON.parse(source).license;
  const file = {
    path: "src/main.ts",
    content: `${license.trim()}\nexport const mmp158Synthetic = 1;\n`,
  };
  const bundle = validateBundle([{ ...file, sha256: sha256(file.content) }]);
  const publicContext = bindMigrationContext(source);
  const base = (attemptKind, generationAttempt) => ({
    format: CUSTODY.format,
    verification: "UNVERIFIED",
    attemptKind,
    identity: {
      runId: "123",
      runAttempt: "1",
      headSha: head,
      sourceSha: SOURCE.commit,
      candidateSha: bundle.candidateSha,
      attemptId: randomUUID(),
    },
    admission: {
      generationAttempt,
      // The generation capsule independently pins the canonical attempt-1
      // request body; the repair capsule's body is admitted per attempt-2
      // authorization and only shape-checked here.
      requestBodySha256:
        generationAttempt === 1
          ? sha256(
              prepareMetaMigration(context(), {
                unitId: "workshop-api",
                tier: "spark",
                action: "generate",
                attempt: 1,
                repairFeedback: null,
              }),
            )
          : "1".repeat(64),
      responseSha256: "2".repeat(64),
      contextSha256: publicContext.contextSha256,
      manifestSha256: MANIFEST_SHA256,
    },
    license: CUSTODY_LICENSE,
    manifest: bundle.files.map((f) => ({
      path: f.path,
      bytes: Buffer.byteLength(f.content),
      sha256: f.sha256,
    })),
    files: bundle.files,
  });
  const expected = {
    candidateSha: bundle.candidateSha,
    headSha: head,
    sourceSha: SOURCE.commit,
  };
  validateCapsule(base("REPAIR_CUSTODY", 2), expected);
  validateCapsule(base("GENERATION_CUSTODY", 1), expected);
  for (const [attemptKind, generationAttempt] of [
    ["REPAIR_CUSTODY", 1],
    ["GENERATION_CUSTODY", 2],
    ["UNKNOWN_KIND", 2],
  ])
    assert.throws(() =>
      validateCapsule(base(attemptKind, generationAttempt), expected),
    );
  const wrongCandidate = base("REPAIR_CUSTODY", 2);
  wrongCandidate.identity.candidateSha = "0".repeat(64);
  assert.throws(() => validateCapsule(wrongCandidate, expected));
});

test("canonical artifact names keep the two attempts distinct", () => {
  assert.equal(candidateArtifactName("123", 1), "mmp107-candidate-123-1");
  assert.equal(
    candidateArtifactName("123", 2),
    "mmp107-candidate-123-1-repair",
  );
  assert.throws(() => candidateArtifactName("123", 3));
});

test("repair scorecard refuses unbound or tampered projections", () => {
  const card = repairPreflight({
    context: context(),
    headSha: head,
    workflowBytes: workflowBytes(),
    actor: "barbalatv",
    maxEstimatedUsd: 1,
    feedback: "HTTP_JSON_TYPE",
    previousChanges: previous,
    firstAttemptEstimatedUsd: 0.05110625,
    firstAttemptCandidateSha: firstCandidateSha,
    confirmation: "I_ACCEPT_TWO_PAID_ATTEMPTS_NO_HARD_CAP",
    now,
  });
  const trial = {
    format: "mmp078-public-repair-trial-v1",
    headSha: head,
    sourceSha: SOURCE.commit,
    candidateSha: "4".repeat(64),
    publicG1: "NOT_RUN",
    publicG2: "NOT_RUN",
    publicG3: "NOT_RUN",
    G0: "INCONCLUSIVE",
    G4: "INCONCLUSIVE",
    product: "NOT_ESTABLISHED",
    attempts: [],
    cleanup: {
      status: "NOT_RUN",
      containers: null,
      volumes: null,
      emergencyRemoved: null,
    },
  };
  const scorecard = repairScorecard({
    preflight: card,
    generation: null,
    trial,
    stored: null,
    transport: null,
    finalizer: null,
    runId: "12345",
    headSha: head,
    firstAttempt: {
      candidateSha: "5".repeat(64),
      headSha: head,
      estimatedCostUsd: 0.05,
    },
  });
  assert.equal(scorecard.execution, "NOT_ESTABLISHED");
  assert.equal(scorecard.custody.status, "NOT_ESTABLISHED");
  assert.equal(scorecard.stopReason, "LIVE_EXECUTION_NOT_ESTABLISHED");
  assert.equal(scorecard.repairs, 1);
  assert.equal(scorecard.attempt, 2);
  assert.equal(scorecard.product, "NOT_ESTABLISHED");
  // Tampered card (digest mismatch) stays NOT_ESTABLISHED.
  const tampered = { ...card, sha256: "0".repeat(64) };
  assert.equal(
    repairScorecard({
      preflight: tampered,
      generation: null,
      trial,
      stored: null,
      transport: null,
      finalizer: null,
      runId: "12345",
      headSha: head,
      firstAttempt: null,
    }).execution,
    "NOT_ESTABLISHED",
  );
});

test("repair gate admits exactly the eligible complete FAIL with stored custody", {
  skip: process.platform !== "linux",
}, async (t) => {
  const { repairGate } = await import(
    "../../../research/mmp-078/repair-gate.mjs"
  );
  const { commitRecord } = await import("../src/custody-files.mjs");
  const build = (mutateTrial, mutateStored, withStored = true) => {
    const directory = mkdtempSync(join(tmpdir(), "mmp158-gate-"));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const output = join(directory, "meta-paid-public");
    const privateRoot = join(directory, "meta-paid-private");
    mkdirSync(output, { recursive: true, mode: 0o700 });
    mkdirSync(privateRoot, { recursive: true, mode: 0o700 });
    const trial = mutateTrial(realTrial());
    trial.headSha = head;
    trial.trialRunId = "12345";
    writeFileSync(join(output, "trial.json"), JSON.stringify(trial), {
      mode: 0o600,
    });
    if (withStored) {
      const stored = {
        format: "mmp115-custody-v1",
        state: "STORED_UNVERIFIED",
        verification: "UNVERIFIED",
        identity: {
          runId: "12345",
          runAttempt: "1",
          headSha: head,
          sourceSha: trial.sourceSha,
          candidateSha: trial.candidateSha,
          attemptId: randomUUID(),
        },
        recipientFingerprint: "f".repeat(64),
        ciphertextSha256: "c".repeat(64),
        ciphertextBytes: 1000,
        collectorCleanup: "VERIFIED_ZERO_RESOURCES",
        storage: "ACKNOWLEDGED_RETRIEVED",
      };
      commitRecord(
        join(output, "custody-stored.json"),
        mutateStored?.(stored) ?? stored,
      );
    }
    return {
      RUNNER_TEMP: directory,
      GITHUB_SHA: head,
      GITHUB_RUN_ID: "12345",
      GITHUB_RUN_ATTEMPT: "1",
    };
  };
  const eligible = repairGate(build((t2) => t2));
  assert.equal(eligible.eligible, true);
  assert.equal(eligible.firstAttemptVerdict, "FAIL");
  assert.equal(eligible.feedback, "HTTP_JSON_TYPE");
  assert.equal(eligible.custodyVerified, true);
  assert.equal(eligible.repair, "NOT_AUTHORIZED_BY_THIS_RECORD");
  // Missing stored custody: no repair send.
  assert.equal(repairGate(build((t2) => t2, null, false)).eligible, false);
  // Custody bound to a different candidate: no repair send.
  assert.equal(
    repairGate(
      build(
        (t2) => t2,
        (s) => ({
          ...s,
          identity: { ...s.identity, candidateSha: "0".repeat(64) },
        }),
      ),
    ).eligible,
    false,
  );
  // Incomplete verification (stale INCONCLUSIVE receipt): no repair send.
  const incomplete = repairGate(
    build((t2) => ({ ...t2, publicG2: "INCONCLUSIVE" })),
  );
  assert.equal(incomplete.eligible, false);
  assert.equal(incomplete.firstAttemptVerdict, null);
  assert.equal(
    incomplete.firstAttemptIncompleteCode,
    "VERIFICATION_INCOMPLETE",
  );
});
