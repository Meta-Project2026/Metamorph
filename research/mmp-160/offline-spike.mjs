// OFFLINE_ONLY / NO_PRODUCTION_AUTHORITY. No provider, disk, env or subprocess API.
// Only original in-memory TEST_ONLY snapshots; authenticate is an injected test seam.

import { classifyAbnormalPhase } from "../../packages/agent-real/src/build-phase-diagnostics.mjs";
import {
  sha256,
  validateBundle,
} from "../../packages/target-worker/src/admission.mjs";

const hash = /^[a-f0-9]{64}$/;
const commit = /^[a-f0-9]{40}$/;
const uuid =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const exact = (v, keys) =>
  v !== null &&
  typeof v === "object" &&
  !Array.isArray(v) &&
  Object.keys(v).sort().join() === [...keys].sort().join();
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const requireEvidence = (ok, code) => {
  if (!ok) throw new Error(code);
};
const identityKeys = [
  "runId",
  "runAttempt",
  "headSha",
  "workflowSha256",
  "sourceSha",
  "contextSha256",
  "manifestSha256",
  "modelId",
  "requestSha256",
  "responseSha256",
  "candidateSha",
  "custodyAttemptId",
  "oracleAttemptId",
  "pairId",
];
const clean = (v) =>
  exact(v, [
    "status",
    "containers",
    "volumes",
    "emergencyRemoved",
    "pendingOperations",
  ]) &&
  v.status === "VERIFIED_ZERO_RESOURCES" &&
  v.containers === 0 &&
  v.volumes === 0 &&
  v.emergencyRemoved === 0 &&
  v.pendingOperations === 0;
const diagnosticKeys = [
  "format",
  "sourceSha",
  "candidateSha",
  "attemptId",
  "pairId",
  "g1Verdict",
  "status",
  "entries",
  "errorCount",
  "truncated",
];
const reasons = new Set([
  "SNAPSHOT_INVALID",
  "UNAUTHENTICATED",
  "IDENTITY_MISMATCH",
  "PLAN_REJECTED",
  "GENERATION_REJECTED",
  "CANDIDATE_REJECTED",
  "CUSTODY_REJECTED",
  "CLEANUP_REJECTED",
  "G1_REJECTED",
  "DIAGNOSTIC_REJECTED",
  "LOCATION_REJECTED",
  "DOWNSTREAM_REJECTED",
  "ATTEMPT2_REJECTED",
]);

// Ordered, public metadata only; never hash a private source/message into a public
// feedback field. snapshotSha256 (which includes TEST source) stays inside the port.
export function publicBindingDigest(identity, diagnostic) {
  return sha256(
    JSON.stringify({
      format: "mmp160-public-binding-v1",
      identity: Object.fromEntries(identityKeys.map((k) => [k, identity[k]])),
      diagnosticSha256: sha256(
        JSON.stringify(
          Object.fromEntries(diagnosticKeys.map((k) => [k, diagnostic[k]])),
        ),
      ),
    }),
  );
}

export function createOfflineSpike({ authenticate }) {
  requireEvidence(typeof authenticate === "function", "TEST_PORT_REQUIRED");
  const privateContexts = new WeakMap();
  const consumedRuns = new Set(); // TEST-only, in memory; NOT a durable paid ledger.
  const report = (status, reason, feedback = null) =>
    Object.freeze({
      format: "mmp160-offline-decision-v1",
      execution: "OFFLINE_ONLY",
      authority: "NO_PRODUCTION_AUTHORITY",
      status,
      reason,
      feedback: feedback === null ? null : Object.freeze(feedback),
      G2: "INCONCLUSIVE",
      G3: "INCONCLUSIVE",
      http: 0,
      sqlite: 0,
      requiredHttp: 17,
      requiredSqlite: 20,
      G0: "INCONCLUSIVE",
      G4: "INCONCLUSIVE",
      product: "NOT_ESTABLISHED",
    });
  function evaluate(input) {
    try {
      // Snapshot once before authentication. All later reads use this private copy.
      const e = structuredClone(input);
      requireEvidence(
        exact(e, [
          "format",
          "execution",
          "identity",
          "plan",
          "generation",
          "bundle",
          "custody",
          "cleanup",
          "independentCleanup",
          "g1",
          "diagnostic",
          "downstream",
          "attempt2",
        ]) &&
          e.format === "mmp160-offline-evidence-v1" &&
          e.execution === "TEST_ONLY",
        "SNAPSHOT_INVALID",
      );
      requireEvidence(
        authenticate(sha256(JSON.stringify(e))) === true,
        "UNAUTHENTICATED",
      );
      const i = e.identity;
      requireEvidence(
        exact(i, identityKeys) &&
          typeof i.runId === "string" &&
          /^[1-9][0-9]{0,19}$/.test(i.runId) &&
          i.runAttempt === "1" &&
          commit.test(i.headSha) &&
          commit.test(i.sourceSha) &&
          i.modelId === "TEST_MODEL" &&
          [
            "workflowSha256",
            "contextSha256",
            "manifestSha256",
            "requestSha256",
            "responseSha256",
            "candidateSha",
          ].every((k) => hash.test(i[k])) &&
          ["custodyAttemptId", "oracleAttemptId", "pairId"].every((k) =>
            uuid.test(i[k]),
          ),
        "IDENTITY_MISMATCH",
      );
      const p = e.plan;
      requireEvidence(
        exact(p, [
          "format",
          "allowedRepairKinds",
          "binding",
          "mode",
          "maximumPosts",
          "maximumRepairs",
          "signedBeforeSend1",
          "reservedPosts",
        ]) &&
          p.format === "mmp160-proposed-two-post-plan-v2" &&
          equal(p.allowedRepairKinds, ["G1_BUILD_RECOVERABLE"]) &&
          equal(p.binding, i) &&
          p.mode === "generate_then_repair" &&
          p.maximumPosts === 2 &&
          p.maximumRepairs === 1 &&
          p.signedBeforeSend1 === true &&
          p.reservedPosts === 2,
        "PLAN_REJECTED",
      );
      const g = e.generation;
      requireEvidence(
        exact(g, [
          "binding",
          "status",
          "kind",
          "attempt",
          "confirmedResponseCount",
          "attemptedRequests",
          "sendState",
        ]) &&
          equal(g.binding, i) &&
          g.status === "PASS" &&
          g.kind === "TEST_GENUINE_RESPONSE_SHAPE" &&
          g.attempt === 1 &&
          g.confirmedResponseCount === 1 &&
          g.attemptedRequests === 1 &&
          g.sendState === "RESPONSE_RECEIVED",
        "GENERATION_REJECTED",
      );
      let bundle;
      try {
        requireEvidence(
          exact(e.bundle, ["files", "candidateSha"]) &&
            e.bundle.candidateSha === i.candidateSha,
          "CANDIDATE_REJECTED",
        );
        bundle = validateBundle(e.bundle.files, i.candidateSha);
      } catch {
        throw new Error("CANDIDATE_REJECTED");
      }
      const c = e.custody;
      requireEvidence(
        exact(c, [
          "binding",
          "stored",
          "authenticatedReadback",
          "sameRunLease",
          "oracleLink",
        ]) &&
          equal(c.binding, i) &&
          c.stored === true &&
          c.authenticatedReadback === true &&
          c.sameRunLease === true &&
          exact(c.oracleLink, [
            "custodyAttemptId",
            "oracleAttemptId",
            "pairId",
          ]) &&
          c.oracleLink.custodyAttemptId === i.custodyAttemptId &&
          c.oracleLink.oracleAttemptId === i.oracleAttemptId &&
          c.oracleLink.pairId === i.pairId,
        "CUSTODY_REJECTED",
      );
      requireEvidence(
        clean(e.cleanup) && clean(e.independentCleanup),
        "CLEANUP_REJECTED",
      );
      const b = e.g1;
      requireEvidence(
        exact(b, [
          "binding",
          "verdict",
          "stage",
          "executedTestIds",
          "findingCodes",
          "checks",
          "timedOut",
          "cancelled",
          "overflow",
          "spawnError",
        ]) &&
          equal(b.binding, i) &&
          b.verdict === "FAIL" &&
          b.stage === "FIRST_TYPECHECK" &&
          equal(b.executedTestIds, ["workshop-business:typecheck"]) &&
          equal(b.findingCodes, ["BUILD_FAILED"]) &&
          b.timedOut === false &&
          b.cancelled === false &&
          b.overflow === false &&
          b.spawnError === null &&
          Array.isArray(b.checks) &&
          b.checks.length === 1 &&
          exact(b.checks[0], ["phase", "exitCode", "error", "signal"]) &&
          b.checks[0].phase === "typecheck" &&
          Number.isSafeInteger(b.checks[0].exitCode) &&
          b.checks[0].exitCode > 0 &&
          b.checks[0].error === null &&
          b.checks[0].signal === null &&
          classifyAbnormalPhase(b.checks[0]) === null,
        "G1_REJECTED",
      );
      const d = e.diagnostic;
      requireEvidence(
        exact(d, diagnosticKeys) &&
          d.format === "mmp082-g1-diagnostics-v1" &&
          d.sourceSha === i.sourceSha &&
          d.candidateSha === i.candidateSha &&
          d.attemptId === i.oracleAttemptId &&
          d.pairId === i.pairId &&
          d.g1Verdict === "FAIL" &&
          d.status === "AVAILABLE" &&
          d.errorCount === 1 &&
          d.truncated === false &&
          Array.isArray(d.entries) &&
          d.entries.length === 1,
        "DIAGNOSTIC_REJECTED",
      );
      const entry = d.entries[0];
      requireEvidence(
        exact(entry, ["phase", "code", "path", "line", "column"]) &&
          entry.phase === "typecheck" &&
          ["TS2339", "TS2769"].includes(entry.code),
        "DIAGNOSTIC_REJECTED",
      );
      const file = bundle.files.find((f) => f.path === entry.path);
      const lines = file?.content.split(/\r?\n/);
      requireEvidence(
        typeof entry.path === "string" &&
          entry.path.length <= 240 &&
          /^src\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.ts$/.test(entry.path) &&
          !/gh[pousr]_|github_pat_|eyJ[A-Za-z0-9_-]{8}|(?:^|[/_-])(?:secret|token|password|credential|jwt|oidc)(?:[/_.-]|$)/i.test(
            entry.path,
          ) &&
          Number.isSafeInteger(entry.line) &&
          entry.line > 0 &&
          entry.line <= (lines?.length ?? 0) &&
          Number.isSafeInteger(entry.column) &&
          entry.column > 0 &&
          entry.column <= lines[entry.line - 1].length + 1,
        "LOCATION_REJECTED",
      );
      requireEvidence(
        equal(e.downstream, {
          G2: "INCONCLUSIVE",
          G3: "INCONCLUSIVE",
          http: 0,
          sqlite: 0,
          requiredHttp: 17,
          requiredSqlite: 20,
          executedTestIds: [],
        }),
        "DOWNSTREAM_REJECTED",
      );
      requireEvidence(
        equal(e.attempt2, {
          state: "ABSENT",
          reserved: false,
          sent: false,
          sendUnknown: false,
        }) && !consumedRuns.has(i.runId),
        "ATTEMPT2_REJECTED",
      );
      const feedback = {
        format: "mmp160-g1-feedback-v1",
        code: entry.code,
        path: entry.path,
        line: entry.line,
        column: entry.column,
        bindingDigest: publicBindingDigest(i, d),
      };
      const decision = report("G1_BUILD_RECOVERABLE", null, feedback);
      privateContexts.set(decision, {
        runId: i.runId,
        previousGeneratedChanges: bundle.files.map(({ path, content }) => ({
          path,
          content,
        })),
      });
      return decision;
    } catch (error) {
      return report(
        "NO_GO",
        reasons.has(error?.message) ? error.message : "SNAPSHOT_INVALID",
      );
    }
  }
  function consumeTestContext(decision) {
    const context = privateContexts.get(decision);
    requireEvidence(
      context && !consumedRuns.has(context.runId),
      "TEST_CONTEXT_REPLAY_REJECTED",
    );
    consumedRuns.add(context.runId); // before returning, including reentrant callers
    privateContexts.delete(decision);
    return structuredClone({
      format: "mmp160-private-test-context-v1",
      execution: "TEST_ONLY",
      diagnosticFeedback: decision.feedback,
      previousGeneratedChanges: context.previousGeneratedChanges,
    });
  }
  return Object.freeze({ evaluate, consumeTestContext });
}
