// Pure, strict classifier. A result is public data and NEVER a capability.
// Production authority additionally requires the private host journal, actual
// verifier origin, authenticated custody/readback and a same-process token.
import { sha256, validateBundle } from "../../target-worker/src/admission.mjs";
import { compilerFeedback } from "./g1-repair-feedback.mjs";

export const G1_RECOVERY_MODE = "generate_then_repair_g1_v2";
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const requireFact = (v) => {
  if (!v)
    throw Object.assign(new Error("G1_REPAIR_NO_GO"), {
      code: "G1_REPAIR_NO_GO",
    });
};
export const zeroResources = (v) =>
  v?.status === "VERIFIED_ZERO_RESOURCES" &&
  v.containers === 0 &&
  v.volumes === 0 &&
  v.emergencyRemoved === 0;

export function compilerRepairDecision(evidence, inputBundle) {
  try {
    const {
      plan,
      generation: r,
      verification: v,
      custody,
      independentCleanup,
      firstTypecheckNormal,
    } = evidence;
    const auth = r.authorization;
    requireFact(
      plan.format === "mmp180-generation-preflight-v2" &&
        plan.plan === G1_RECOVERY_MODE &&
        plan.maximumPosts === 2 &&
        plan.maximumRepairs === 1 &&
        plan.automaticRetries === 0 &&
        same(plan.allowedRepairKinds, ["G1_BUILD_RECOVERABLE"]) &&
        plan.confirmation === "I_ACCEPT_TWO_PAID_ATTEMPTS_NO_HARD_CAP",
    );
    const { sha256: digest, ...card } = plan;
    requireFact(
      sha256(JSON.stringify(card)) === digest &&
        auth.plan === G1_RECOVERY_MODE &&
        auth.attempt === 1 &&
        auth.preflightSha256 === digest &&
        auth.workflowSha256 === plan.workflowSha256 &&
        auth.actor === plan.actor &&
        auth.model === plan.model &&
        auth.headSha === plan.headSha &&
        auth.sourceSha === plan.sourceSha &&
        auth.contextSha256 === plan.contextSha256 &&
        auth.manifestSha256 === plan.manifestSha256 &&
        auth.bodySha256 === plan.requestBodySha256 &&
        r.format === "meta-generation-v1" &&
        r.status === "PASS" &&
        r.code === null &&
        r.generationKind === "REAL_INFERENCE" &&
        r.modelId === plan.model &&
        r.attempt === 1 &&
        r.action === "generate" &&
        r.attemptedRequests === 1 &&
        r.confirmedResponseCount === 1 &&
        r.networkSend === "RESPONSE_RECEIVED" &&
        r.inputSha256 === plan.requestBodySha256 &&
        r.sourceSha === plan.sourceSha &&
        r.contextSha256 === plan.contextSha256 &&
        r.manifestSha256 === plan.manifestSha256 &&
        /^[a-f0-9]{64}$/.test(r.responseSha256) &&
        typeof r.requestId === "string" &&
        r.requestId.length > 0 &&
        Number.isFinite(r.estimatedCostUsd) &&
        r.estimatedCostUsd >= 0,
    );
    const bundle = validateBundle(inputBundle.files, r.candidateSha);
    const a = v.attempts?.[0],
      p = a?.pairs?.[0];
    requireFact(
      v.candidateSha === bundle.candidateSha &&
        v.attempts.length === 1 &&
        v.publicG1 === "FAIL" &&
        v.publicG2 === "INCONCLUSIVE" &&
        v.publicG3 === "INCONCLUSIVE" &&
        v.G0 === "INCONCLUSIVE" &&
        v.G4 === "INCONCLUSIVE" &&
        v.product === "NOT_ESTABLISHED" &&
        same(v.blockers, ["BUILD_FAILED", "MISSING_COVERAGE"]) &&
        zeroResources(v.cleanup) &&
        zeroResources(independentCleanup) &&
        firstTypecheckNormal === true &&
        a.candidateSha === bundle.candidateSha &&
        a.pairs.length === 1 &&
        same(a.coverage, {
          http: 0,
          sqlite: 0,
          requiredHttp: 17,
          requiredSqlite: 20,
        }) &&
        a.gates.length === 5 &&
        same(
          a.gates.map((g) => g.gate),
          ["G0", "G1", "G2", "G3", "G4"],
        ) &&
        same(a.gates[1], {
          gate: "G1",
          verdict: "FAIL",
          executedTestIds: ["workshop-business:typecheck"],
          findingCodes: ["BUILD_FAILED"],
        }) &&
        [0, 2, 3, 4].every(
          (i) =>
            a.gates[i].verdict === "INCONCLUSIVE" &&
            a.gates[i].executedTestIds.length === 0,
        ) &&
        p.scenarioId === "workshop-business" &&
        p.cleanup === "VERIFIED_ZERO_RESOURCES" &&
        p.gates.length === 0 &&
        !p.buildPhaseDiagnostics &&
        (!Object.hasOwn(a, "errorCode") || a.errorCode === null),
    );
    const link = v.custodyLink;
    requireFact(
      custody.state === "STORED_UNVERIFIED" &&
        custody.collectorCleanup === "VERIFIED_ZERO_RESOURCES" &&
        custody.storage === "ACKNOWLEDGED_RETRIEVED" &&
        custody.identity.runId === auth.runId &&
        custody.identity.runAttempt === "1" &&
        custody.identity.headSha === plan.headSha &&
        custody.identity.sourceSha === plan.sourceSha &&
        custody.identity.candidateSha === bundle.candidateSha &&
        link.format === "mmp115-custody-verifier-link-v1" &&
        same(link.identity, custody.identity) &&
        same(link.verifierAttemptIds, [a.attemptId]) &&
        a.attemptId !== custody.identity.attemptId &&
        [a.attemptId, p.pairId, custody.identity.attemptId].every((id) =>
          /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
            id,
          ),
        ),
    );
    const d = p.compilerDiagnostics;
    requireFact(
      d &&
        Object.keys(d).sort().join() ===
          "attemptId,candidateSha,entries,errorCount,format,g1Verdict,pairId,sourceSha,status,truncated" &&
        d.format === "mmp082-g1-diagnostics-v1" &&
        d.status === "AVAILABLE" &&
        d.errorCount === 1 &&
        d.truncated === false &&
        d.entries.length === 1 &&
        d.g1Verdict === "FAIL" &&
        d.sourceSha === plan.sourceSha &&
        d.candidateSha === bundle.candidateSha &&
        d.attemptId === a.attemptId &&
        d.pairId === p.pairId,
    );
    const entry = d.entries[0];
    requireFact(
      Object.keys(entry).sort().join() === "code,column,line,path,phase" &&
        entry.phase === "typecheck",
    );
    const identity = {
      runId: auth.runId,
      actor: auth.actor,
      headSha: plan.headSha,
      workflowSha256: plan.workflowSha256,
      sourceSha: plan.sourceSha,
      contextSha256: plan.contextSha256,
      manifestSha256: plan.manifestSha256,
      model: plan.model,
      requestSha256: r.inputSha256,
      responseSha256: r.responseSha256,
      requestId: r.requestId,
      candidateSha: bundle.candidateSha,
      custodyAttemptId: custody.identity.attemptId,
      oracleAttemptId: a.attemptId,
      pairId: p.pairId,
    };
    const feedback = compilerFeedback({
      format: "mmp160-g1-feedback-v1",
      code: entry.code,
      path: entry.path,
      line: entry.line,
      column: entry.column,
      bindingDigest: sha256(
        JSON.stringify({
          format: "mmp180-public-binding-v2",
          identity,
          diagnostic: d,
        }),
      ),
    });
    const lines = bundle.files
      .find((f) => f.path === feedback.path)
      ?.content.split(/\r?\n/);
    requireFact(
      lines &&
        feedback.line <= lines.length &&
        feedback.column <= lines[feedback.line - 1].length + 1,
    );
    return Object.freeze({ kind: "G1_BUILD_RECOVERABLE", feedback });
  } catch {
    requireFact(false);
  }
}
