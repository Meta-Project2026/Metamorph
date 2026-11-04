// Original TEST_ONLY strings; no benchmark, historical candidate or private data.

import {
  publicCompilerDiagnostics,
  summarizeCompilerDiagnostics,
} from "../../packages/agent-real/src/compiler-diagnostics.mjs";
import {
  sha256,
  validateBundle,
} from "../../packages/target-worker/src/admission.mjs";
import { createOfflineSpike } from "./offline-spike.mjs";

export const sourceMarker = "TEST_ONLY_PREVIOUS_GENERATED_CODE";
export const messageMarker = "TEST_ONLY_DISCARDED_COMPILER_MESSAGE";
export function fixture(code = "TS2339") {
  const content = `// ${sourceMarker}\nexport const value = { n: 1 };\nvalue.missing;\n`;
  const bundle = validateBundle([
    { path: "src/main.ts", content, sha256: sha256(content) },
  ]);
  const identity = {
    runId: "160001",
    runAttempt: "1",
    headSha: "a".repeat(40),
    workflowSha256: "b".repeat(64),
    sourceSha: "c".repeat(40),
    contextSha256: "d".repeat(64),
    manifestSha256: "e".repeat(64),
    modelId: "TEST_MODEL",
    requestSha256: "1".repeat(64),
    responseSha256: "2".repeat(64),
    candidateSha: bundle.candidateSha,
    custodyAttemptId: "11111111-1111-4111-8111-111111111111",
    oracleAttemptId: "22222222-2222-4222-8222-222222222222",
    pairId: "33333333-3333-4333-8333-333333333333",
  };
  const checks = [
    {
      phase: "typecheck",
      exitCode: 2,
      error: null,
      signal: null,
      stdout: `src/main.ts(3,7): error ${code}: ${messageMarker}`,
      stderr: "",
    },
  ];
  const diagnostic = publicCompilerDiagnostics(
    summarizeCompilerDiagnostics(checks, bundle),
    {
      sourceSha: identity.sourceSha,
      candidateSha: bundle.candidateSha,
      attemptId: identity.oracleAttemptId,
      pairId: identity.pairId,
      g1Verdict: "FAIL",
    },
  );
  const binding = () => structuredClone(identity);
  const cleanup = () => ({
    status: "VERIFIED_ZERO_RESOURCES",
    containers: 0,
    volumes: 0,
    emergencyRemoved: 0,
    pendingOperations: 0,
  });
  const evidence = {
    format: "mmp160-offline-evidence-v1",
    execution: "TEST_ONLY",
    identity,
    plan: {
      format: "mmp160-proposed-two-post-plan-v2",
      allowedRepairKinds: ["G1_BUILD_RECOVERABLE"],
      binding: binding(),
      mode: "generate_then_repair",
      maximumPosts: 2,
      maximumRepairs: 1,
      signedBeforeSend1: true,
      reservedPosts: 2,
    },
    generation: {
      binding: binding(),
      status: "PASS",
      kind: "TEST_GENUINE_RESPONSE_SHAPE",
      attempt: 1,
      confirmedResponseCount: 1,
      attemptedRequests: 1,
      sendState: "RESPONSE_RECEIVED",
    },
    bundle,
    custody: {
      binding: binding(),
      stored: true,
      authenticatedReadback: true,
      sameRunLease: true,
      oracleLink: {
        custodyAttemptId: identity.custodyAttemptId,
        oracleAttemptId: identity.oracleAttemptId,
        pairId: identity.pairId,
      },
    },
    cleanup: cleanup(),
    independentCleanup: cleanup(),
    g1: {
      binding: binding(),
      verdict: "FAIL",
      stage: "FIRST_TYPECHECK",
      executedTestIds: ["workshop-business:typecheck"],
      findingCodes: ["BUILD_FAILED"],
      checks: checks.map(({ phase, exitCode, error, signal }) => ({
        phase,
        exitCode,
        error,
        signal,
      })),
      timedOut: false,
      cancelled: false,
      overflow: false,
      spawnError: null,
    },
    diagnostic,
    downstream: {
      G2: "INCONCLUSIVE",
      G3: "INCONCLUSIVE",
      http: 0,
      sqlite: 0,
      requiredHttp: 17,
      requiredSqlite: 20,
      executedTestIds: [],
    },
    attempt2: {
      state: "ABSENT",
      reserved: false,
      sent: false,
      sendUnknown: false,
    },
  };
  return {
    evidence,
    checks,
    seal() {
      // This is deliberately NOT cryptographic authentication. It models a trusted
      // verifier's immutable exact snapshot. Production authenticators are NOT_RUN.
      const digest = sha256(JSON.stringify(evidence));
      return createOfflineSpike({
        authenticate: (actual) => actual === digest,
      });
    },
  };
}
