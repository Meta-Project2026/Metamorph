// Original TEST data. No provider/worker execution; uses actual diagnostic and
// report producers. Schema-valid TEST receipts never grant production authority.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { SOURCE } from "@metamorph/oracle";
import { sha256, validateBundle } from "../../target-worker/src/admission.mjs";
import { custodyVerificationLink } from "../src/custody-checkpoint.mjs";
import { receiptFor } from "../src/custody-contract.mjs";
import { G1_RECOVERY_MODE } from "../src/g1-repair-eligibility.mjs";
import { bindMigrationContext } from "../src/migration-context.mjs";
import { generationPreflight } from "../src/migration-preflight.mjs";
import { publicAttempt } from "../src/report.mjs";
import { observeBuild } from "../src/runtime.mjs";

export const sourceInput = readFileSync(
  new URL("../../../research/mmp-061/public-source.json", import.meta.url),
  "utf8",
);
export const testContext = () => bindMigrationContext(sourceInput);
export const workflowBytes = () =>
  readFileSync(
    new URL(
      "../../../.github/workflows/meta-paid-migration.yml",
      import.meta.url,
    ),
  );
export const clean = () => ({
  status: "VERIFIED_ZERO_RESOURCES",
  containers: 0,
  volumes: 0,
  emergencyRemoved: 0,
});
export function failedAttempt(bundle, code = "TS2339", overrides = {}) {
  const phase = {
    phase: "typecheck",
    exitCode: 2,
    signal: null,
    error: null,
    stdout: `src/main.ts(2,1): error ${code}: PRIVATE_COMPILER_MESSAGE\n`,
    stderr: "",
    ...overrides,
  };
  const worker = {
    image: "sha256:TEST",
    bundle,
    evidence: {
      build: {
        args: ["sha256:TEST", "/opt/worker/build.mjs"],
        exitCode: 2,
        signal: null,
        timedOut: false,
        cancelled: false,
        overflow: false,
        spawnError: null,
        stdout: JSON.stringify({ checks: [phase], artifacts: [] }),
      },
    },
  };
  const observed = observeBuild(worker, "workshop-business");
  const attemptId = randomUUID();
  return {
    attemptId,
    candidateSha: bundle.candidateSha,
    errorCode: null,
    pairs: [
      {
        headSha: "a".repeat(40),
        attemptId,
        candidateSha: bundle.candidateSha,
        pairId: randomUUID(),
        scenarioId: "workshop-business",
        gates: [],
        build: observed.build,
        compilerDiagnostics: observed.compilerDiagnostics,
        buildPhaseDiagnostics: observed.buildPhaseDiagnostics,
        cleanup: "VERIFIED_ZERO_RESOURCES",
        errorCode: null,
        packs: [1, 2].map(() => ({
          id: `oracle-${randomUUID()}`,
          sha256: "e".repeat(64),
          reference: "safe/index.json",
        })),
      },
    ],
  };
}
export function g1Fixture(
  code = "TS2339",
  {
    headSha = "a".repeat(40),
    runId = "180001",
    receipt,
    custody,
    bundle: inputBundle,
    plan: inputPlan,
  } = {},
) {
  const context = testContext();
  const content = `// ORIGINAL_PRIVATE_SOURCE_MARKER\nexport const value = {}.missing;\n`;
  const bundle =
    inputBundle ??
    validateBundle([{ path: "src/main.ts", content, sha256: sha256(content) }]);
  const plan =
    inputPlan ??
    generationPreflight({
      context,
      headSha,
      workflowBytes: workflowBytes(),
      actor: "barbalatv",
      maxEstimatedUsd: 1,
      plan: G1_RECOVERY_MODE,
      confirmation: "I_ACCEPT_TWO_PAID_ATTEMPTS_NO_HARD_CAP",
      now: Date.parse("2026-11-04T08:00:00Z"),
    });
  const auth = {
    plan: G1_RECOVERY_MODE,
    attempt: 1,
    actor: plan.actor,
    runId,
    headSha,
    sourceSha: context.sourceSha,
    contextSha256: context.contextSha256,
    manifestSha256: context.manifestSha256,
    model: plan.model,
    bodySha256: plan.requestBodySha256,
    preflightSha256: plan.sha256,
    workflowSha256: plan.workflowSha256,
  };
  const generation = receipt ?? {
    format: "meta-generation-v1",
    authorization: auth,
    sourceSha: context.sourceSha,
    contextSha256: context.contextSha256,
    manifestSha256: context.manifestSha256,
    generationKind: "REAL_INFERENCE",
    status: "PASS",
    code: null,
    modelId: plan.model,
    attempt: 1,
    action: "generate",
    attemptedRequests: 1,
    confirmedResponseCount: 1,
    networkSend: "RESPONSE_RECEIVED",
    requestId: "TEST-response",
    inputSha256: plan.requestBodySha256,
    responseSha256: "c".repeat(64),
    candidateSha: bundle.candidateSha,
    estimatedCostUsd: 0.01,
  };
  const stored =
    custody ??
    receiptFor(
      "STORED_UNVERIFIED",
      {
        runId,
        runAttempt: "1",
        headSha,
        sourceSha: SOURCE.commit,
        candidateSha: bundle.candidateSha,
        attemptId: randomUUID(),
      },
      { sha256: "d".repeat(64), bytes: 1000 },
      "VERIFIED_ZERO_RESOURCES",
    );
  const attempt = publicAttempt(failedAttempt(bundle, code));
  const verification = {
    candidateSha: bundle.candidateSha,
    attempts: [attempt],
    publicG1: "FAIL",
    publicG2: "INCONCLUSIVE",
    publicG3: "INCONCLUSIVE",
    G0: "INCONCLUSIVE",
    G4: "INCONCLUSIVE",
    product: "NOT_ESTABLISHED",
    blockers: ["BUILD_FAILED", "MISSING_COVERAGE"],
    cleanup: clean(),
    custodyLink: custodyVerificationLink(stored.identity, [attempt.attemptId]),
  };
  return {
    bundle,
    evidence: {
      plan,
      generation,
      verification,
      custody: stored,
      independentCleanup: clean(),
      firstTypecheckNormal: true,
    },
  };
}
