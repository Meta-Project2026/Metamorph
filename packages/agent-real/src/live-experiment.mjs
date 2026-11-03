// Read-only evidence projection; no provider, custody or repair authority.
import { sha256 } from "../../target-worker/src/admission.mjs";
import { publicRepairDecision } from "./autonomous-repair.mjs";
import { artifactMetadata } from "./custody-checkpoint.mjs";
import { receiptFor, validateReceipt } from "./custody-contract.mjs";
import { META_REPOSITORY } from "./github-meta-guard.mjs";
import { MetaWireError } from "./meta-wire.mjs";
import { CODES } from "./report.mjs";

const hash = (v) =>
  typeof v === "string" && /^[a-f0-9]{64}$/.test(v) ? v : null;
const head = (v) =>
  typeof v === "string" && /^[a-f0-9]{40}$/.test(v) ? v : null;
const count = (v) => (Number.isSafeInteger(v) && v >= 0 ? v : null);
const cost = (v) => (Number.isFinite(v) && v >= 0 ? v : null);
const verdict = (v) =>
  ["PASS", "FAIL", "ERROR", "INCONCLUSIVE", "NOT_RUN"].includes(v)
    ? v
    : "INCONCLUSIVE";
const clean = (v) =>
  v?.status === "VERIFIED_ZERO_RESOURCES" &&
  v.containers === 0 &&
  v.volumes === 0 &&
  v.emergencyRemoved === 0;
const safe = new Set([
  "VERIFICATION_INCOMPLETE",
  "G1_FAILED",
  "CLEANUP_ERROR",
  "SOURCE_IDENTITY",
  "REPAIR_FEEDBACK",
  "PUBLIC_DOCKER_ERROR",
  "CUSTODY_NOT_ESTABLISHED",
]);

export function publicTrialOutcome(trial) {
  if (!trial || !Array.isArray(trial.attempts) || trial.attempts.length === 0) {
    return {
      status: "PUBLIC_VERIFICATION_NOT_RUN",
      publicVerdict: "INCONCLUSIVE",
      complete: false,
      feedbackCodes: [],
      repair: "NOT_AUTHORIZED_BY_THIS_REPORT",
      code: "VERIFICATION_NOT_RUN",
    };
  }
  try {
    const decision = publicRepairDecision(trial, trial.candidateSha);
    return {
      status: `COMPLETE_PUBLIC_${decision.verdict}`,
      publicVerdict: decision.verdict,
      complete: true,
      feedbackCodes: decision.feedback?.split(";") ?? [],
      repair: "NOT_AUTHORIZED_BY_THIS_REPORT",
      code: null,
    };
  } catch (error) {
    const infrastructureError =
      ["publicG1", "publicG2", "publicG3"].some(
        (g) => trial?.[g] === "ERROR",
      ) ||
      trial?.blockers?.includes("PUBLIC_DOCKER_ERROR") ||
      (trial?.cleanup &&
        trial.cleanup.status !== "NOT_RUN" &&
        !clean(trial.cleanup));
    return {
      status: infrastructureError
        ? "PUBLIC_VERIFICATION_ERROR"
        : "PUBLIC_VERIFICATION_INCONCLUSIVE",
      publicVerdict: infrastructureError ? "ERROR" : "INCONCLUSIVE",
      complete: false,
      feedbackCodes: [],
      repair: "NOT_AUTHORIZED_BY_THIS_REPORT",
      code: safe.has(error?.code) ? error.code : "VERIFICATION_INCOMPLETE",
    };
  }
}

function recordedCustody(trial, stored, transport, expected, attempt = 1) {
  try {
    const capture = validateReceipt(
      trial?.custody,
      expected,
      "CAPTURED_UNVERIFIED",
    );
    validateReceipt(stored, capture.identity, "STORED_UNVERIFIED");
    if (
      stored.ciphertextSha256 !== capture.ciphertextSha256 ||
      stored.ciphertextBytes !== capture.ciphertextBytes
    )
      return false;
    const ready = receiptFor(
      "CHECKPOINT_READY_UNVERIFIED",
      capture.identity,
      { sha256: capture.ciphertextSha256, bytes: capture.ciphertextBytes },
      capture.collectorCleanup,
    );
    artifactMetadata(
      ready,
      transport?.artifact,
      transport?.run,
      transport?.ack,
      attempt,
    );
    return (
      JSON.stringify(capture.identity) ===
        JSON.stringify(trial?.custodyLink?.identity) &&
      JSON.stringify(trial?.custodyLink?.verifierAttemptIds) ===
        JSON.stringify(trial?.attempts?.map((a) => a.attemptId))
    );
  } catch {
    return false;
  }
}

function cardValid(card) {
  if (!card || !hash(card.sha256)) return false;
  const { sha256: digest, ...content } = card;
  return (
    digest === sha256(JSON.stringify(content)) &&
    card.format === "mmp154-generation-preflight-v1" &&
    card.repository === META_REPOSITORY &&
    card.model === "muse-spark-1.3" &&
    card.mode === "STANDARD" &&
    // The signed two-attempt plan reserves both sends on one card.
    ((card.maximumPosts === 1 && card.maximumRepairs === 0) ||
      (card.maximumPosts === 2 &&
        card.maximumRepairs === 1 &&
        card.plan === "generate_then_repair"))
  );
}

export function generationScorecard({
  preflight,
  generation,
  trial,
  stored,
  transport,
  finalizer,
  runId,
  headSha,
}) {
  const validCard = cardValid(preflight) && preflight.headSha === headSha;
  const receipt = generation ?? trial?.modelReceipts?.[0];
  const bound =
    validCard &&
    receipt?.format === "meta-generation-v1" &&
    receipt.sourceSha === preflight.sourceSha &&
    receipt.contextSha256 === preflight.contextSha256 &&
    receipt.manifestSha256 === preflight.manifestSha256 &&
    receipt.inputSha256 === preflight.requestBodySha256 &&
    receipt.modelId === preflight.model &&
    receipt.attempt === 1 &&
    receipt.action === "generate" &&
    receipt.authorization?.runId === runId &&
    receipt.authorization.headSha === headSha &&
    receipt.authorization.preflightSha256 === preflight.sha256 &&
    receipt.authorization.workflowSha256 === preflight.workflowSha256;
  const attempted =
    receipt?.attemptedRequests === 0 || receipt?.attemptedRequests === 1
      ? receipt.attemptedRequests
      : null;
  const execution =
    bound && receipt.generationKind === "REAL_INFERENCE" && attempted === 1
      ? "REAL_META"
      : receipt?.generationKind?.startsWith("SYNTHETIC")
        ? "SYNTHETIC"
        : "NOT_ESTABLISHED";
  const custody =
    bound &&
    receipt?.candidateSha === trial?.candidateSha &&
    recordedCustody(trial, stored, transport, {
      runId,
      runAttempt: "1",
      headSha,
      sourceSha: preflight.sourceSha,
      candidateSha: trial?.candidateSha,
    });
  const independentZero =
    head(headSha) !== null &&
    finalizer?.headSha === headSha &&
    finalizer.status === "PASS" &&
    finalizer.inventory?.containers === 0 &&
    finalizer.inventory?.volumes === 0 &&
    finalizer.emergencyRemoved === 0;
  const independentFailure =
    finalizer?.status === "ERROR" ||
    finalizer?.emergencyRemoved > 0 ||
    finalizer?.inventory?.containers > 0 ||
    finalizer?.inventory?.volumes > 0;
  const outcome = publicTrialOutcome(trial);
  if (
    outcome.complete &&
    (!custody ||
      !independentZero ||
      execution !== "REAL_META" ||
      receipt?.status !== "PASS")
  ) {
    outcome.status = independentFailure
      ? "PUBLIC_VERIFICATION_ERROR"
      : "PUBLIC_VERIFICATION_INCONCLUSIVE";
    outcome.publicVerdict = independentFailure ? "ERROR" : "INCONCLUSIVE";
    outcome.complete = false;
    outcome.feedbackCodes = [];
    outcome.code = !custody
      ? "CUSTODY_NOT_ESTABLISHED"
      : !independentZero
        ? "CLEANUP_ERROR"
        : "SOURCE_IDENTITY";
  }
  const coverage = trial?.attempts?.[0]?.coverage;
  const gateCounts = Object.fromEntries(
    ["G1", "G2", "G3", "G4"].map((g) => [
      g,
      count(
        trial?.attempts?.[0]?.gates?.find((v) => v.gate === g)?.executedTestIds
          ?.length,
      ),
    ]),
  );
  const stopReason = outcome.complete
    ? outcome.publicVerdict === "PASS"
      ? "FIRST_PUBLIC_PASS_STOP"
      : "PUBLIC_FAIL_SIGNED_REPAIR_NOT_IMPLEMENTED"
    : receipt?.status === "ERROR" && attempted === 1
      ? "GENERATION_ERROR_NO_RETRY"
      : execution === "NOT_ESTABLISHED"
        ? "LIVE_EXECUTION_NOT_ESTABLISHED"
        : outcome.code;
  return {
    format: "mmp154-generation-scorecard-v1",
    evidenceBasis: "RECORDED_TRUSTED_ADAPTER_RECEIPTS",
    execution,
    repository: META_REPOSITORY,
    runId:
      typeof runId === "string" && /^[1-9][0-9]{0,19}$/.test(runId)
        ? runId
        : null,
    headSha: head(headSha),
    workflowSha256: validCard ? hash(preflight.workflowSha256) : null,
    preflightSha256: validCard ? preflight.sha256 : null,
    sourceSha: validCard ? head(preflight.sourceSha) : null,
    model: "muse-spark-1.3",
    providerModel:
      receipt?.status === "PASS" && bound ? "muse-spark-1.3" : null,
    generationStatus: ["PASS", "ERROR"].includes(receipt?.status)
      ? receipt.status
      : "NOT_RUN",
    generationCode:
      receipt?.code === new MetaWireError(receipt?.code).code
        ? receipt.code
        : null,
    mode: "STANDARD",
    tariff:
      validCard &&
      /^meta-standard-\d{4}-\d{2}-\d{2}$/.test(preflight.tariff?.version)
        ? preflight.tariff.version
        : null,
    maximumPosts: 1,
    attemptedRequests: attempted,
    confirmedResponses:
      receipt?.confirmedResponseCount === 1
        ? 1
        : receipt?.confirmedResponseCount === 0
          ? 0
          : null,
    networkSend: ["NOT_ATTEMPTED", "UNKNOWN", "RESPONSE_RECEIVED"].includes(
      receipt?.networkSend,
    )
      ? receipt.networkSend
      : "UNKNOWN",
    requestBodySha256: hash(receipt?.inputSha256),
    responseSha256: hash(receipt?.responseSha256),
    candidateSha: hash(trial?.candidateSha),
    inputTokens: count(receipt?.inputTokens),
    outputTokens: count(receipt?.outputTokens),
    cachedInputTokens: count(receipt?.cachedInputTokens),
    projectedUpperEstimateUsd: validCard
      ? cost(preflight.worstCaseEstimatedUsd)
      : null,
    observedEstimatedCostUsd: cost(receipt?.estimatedCostUsd),
    chargedCostUsd: null,
    monetaryCap: "NO_PROVIDER_HARD_CAP",
    accountBalanceUsd: null,
    usageStatus:
      receipt?.usageStatus === "ESTIMATE_ONLY" ? "ESTIMATE_ONLY" : "UNKNOWN",
    publicG1: verdict(trial?.publicG1),
    publicG2: verdict(trial?.publicG2),
    publicG3: verdict(trial?.publicG3),
    coverage: {
      http: count(coverage?.http),
      requiredHttp: 17,
      sqlite: count(coverage?.sqlite),
      requiredSqlite: 20,
      gateCounts,
    },
    custody: {
      status: custody ? "RECORDED_STORED_READBACK" : "NOT_ESTABLISHED",
      artifactId:
        custody && /^[1-9][0-9]{0,19}$/.test(transport.ack.artifactId)
          ? transport.ack.artifactId
          : null,
      archiveSha256: custody ? hash(transport.ack.archiveSha256) : null,
      ciphertextSha256: custody ? hash(stored.ciphertextSha256) : null,
    },
    cleanup: {
      normal: clean(trial?.cleanup)
        ? "VERIFIED_ZERO_RESOURCES"
        : "NOT_ESTABLISHED",
      independent: independentZero
        ? "VERIFIED_ZERO_RESOURCES"
        : "NOT_ESTABLISHED",
    },
    outcome,
    stopReason,
    publicFindingCodes: [
      ...new Set(
        trial?.attempts?.flatMap(
          (a) =>
            a.gates?.flatMap(
              (g) => g.findingCodes?.filter((c) => CODES.has(c)) ?? [],
            ) ?? [],
        ) ?? [],
      ),
    ],
    repairs: 0,
    G0: "INCONCLUSIVE",
    G4: "INCONCLUSIVE",
    product: "NOT_ESTABLISHED",
  };
}

/** Attempt-2 (signed repair) projection. Binding mirrors generationScorecard
 * against the repair preflight card, the repair receipt and the repair
 * custody chain; the first attempt's recorded identity is carried for
 * provenance but grants nothing by itself. */
function repairCardValid(card) {
  if (!card || !hash(card.sha256)) return false;
  const { sha256: digest, ...content } = card;
  return (
    digest === sha256(JSON.stringify(content)) &&
    card.format === "mmp154-repair-preflight-v1" &&
    card.repository === META_REPOSITORY &&
    card.model === "muse-spark-1.3" &&
    card.mode === "STANDARD" &&
    card.maximumPosts === 2 &&
    card.maximumRepairs === 1 &&
    card.attempt === 2 &&
    card.action === "repair" &&
    typeof card.repairFeedbackCodes === "string" &&
    card.repairFeedbackCodes.length > 0
  );
}
export function repairScorecard({
  preflight,
  generation,
  trial,
  stored,
  transport,
  finalizer,
  runId,
  headSha,
  firstAttempt,
}) {
  const validCard = repairCardValid(preflight) && preflight.headSha === headSha;
  const receipt = generation ?? trial?.modelReceipts?.[0];
  const bound =
    validCard &&
    receipt?.format === "meta-generation-v1" &&
    receipt.attempt === 2 &&
    receipt.action === "repair" &&
    receipt.sourceSha === preflight.sourceSha &&
    receipt.contextSha256 === preflight.contextSha256 &&
    receipt.manifestSha256 === preflight.manifestSha256 &&
    receipt.inputSha256 === preflight.requestBodySha256 &&
    receipt.modelId === preflight.model &&
    receipt.authorization?.runId === runId &&
    receipt.authorization.headSha === headSha &&
    receipt.authorization.preflightSha256 === preflight.sha256 &&
    receipt.authorization.workflowSha256 === preflight.workflowSha256;
  const attempted =
    receipt?.attemptedRequests === 0 || receipt?.attemptedRequests === 1
      ? receipt.attemptedRequests
      : null;
  const execution =
    bound && receipt.generationKind === "REAL_INFERENCE" && attempted === 1
      ? "REAL_META"
      : receipt?.generationKind?.startsWith("SYNTHETIC")
        ? "SYNTHETIC"
        : "NOT_ESTABLISHED";
  const custody =
    bound &&
    receipt?.candidateSha === trial?.candidateSha &&
    recordedCustody(
      trial,
      stored,
      transport,
      {
        runId,
        runAttempt: "1",
        headSha,
        sourceSha: preflight.sourceSha,
        candidateSha: trial?.candidateSha,
      },
      2,
    );
  const independentZero =
    head(headSha) !== null &&
    finalizer?.headSha === headSha &&
    finalizer.status === "PASS" &&
    finalizer.inventory?.containers === 0 &&
    finalizer.inventory?.volumes === 0 &&
    finalizer.emergencyRemoved === 0;
  const outcome = publicTrialOutcome(trial);
  // First-candidate provenance: the signed attempt-2 admission/card and the
  // recorded first attempt must name the same candidate. A complete repair
  // outcome without this binding is refused, never silently accepted.
  const firstAttemptBound =
    hash(firstAttempt?.candidateSha) !== null &&
    firstAttempt?.headSha === headSha &&
    firstAttempt?.candidateSha ===
      trial?.budgetAuth?.firstAttemptCandidateSha &&
    firstAttempt?.candidateSha === preflight?.firstAttemptCandidateSha;
  if (
    outcome.complete &&
    (!custody ||
      !independentZero ||
      !firstAttemptBound ||
      execution !== "REAL_META" ||
      receipt?.status !== "PASS")
  ) {
    outcome.status = "PUBLIC_VERIFICATION_INCONCLUSIVE";
    outcome.publicVerdict = "INCONCLUSIVE";
    outcome.complete = false;
    outcome.feedbackCodes = [];
    outcome.code = !custody
      ? "CUSTODY_NOT_ESTABLISHED"
      : !independentZero || !firstAttemptBound
        ? !firstAttemptBound
          ? "SOURCE_IDENTITY"
          : "CLEANUP_ERROR"
        : "SOURCE_IDENTITY";
  }
  const stopReason = outcome.complete
    ? outcome.publicVerdict === "PASS"
      ? "REPAIR_PUBLIC_PASS_STOP"
      : "COMPLETE_PUBLIC_FAIL_AFTER_SIGNED_REPAIR"
    : receipt?.status === "ERROR" && attempted === 1
      ? "REPAIR_ERROR_NO_RETRY"
      : execution === "NOT_ESTABLISHED"
        ? "LIVE_EXECUTION_NOT_ESTABLISHED"
        : outcome.code;
  return {
    format: "mmp154-repair-scorecard-v1",
    evidenceBasis: "RECORDED_TRUSTED_ADAPTER_RECEIPTS",
    execution,
    repository: META_REPOSITORY,
    runId: /^[1-9][0-9]{0,19}$/.test(runId ?? "") ? runId : null,
    headSha: head(headSha),
    workflowSha256: validCard ? hash(preflight.workflowSha256) : null,
    preflightSha256: validCard ? preflight.sha256 : null,
    sourceSha: validCard ? head(preflight.sourceSha) : null,
    model: "muse-spark-1.3",
    providerModel:
      receipt?.status === "PASS" && bound ? "muse-spark-1.3" : null,
    attempt: 2,
    action: "repair",
    repairFeedbackCodes: validCard ? preflight.repairFeedbackCodes : null,
    generationStatus: ["PASS", "ERROR"].includes(receipt?.status)
      ? receipt.status
      : "NOT_RUN",
    generationCode:
      receipt?.code === new MetaWireError(receipt?.code).code
        ? receipt.code
        : null,
    mode: "STANDARD",
    maximumPosts: validCard ? preflight.maximumPosts : null,
    attemptedRequests: attempted,
    requestBodySha256: hash(receipt?.inputSha256),
    responseSha256: hash(receipt?.responseSha256),
    candidateSha: hash(trial?.candidateSha),
    firstAttempt: {
      candidateSha: hash(firstAttempt?.candidateSha),
      bound: firstAttemptBound,
      estimatedCostUsd: cost(firstAttempt?.estimatedCostUsd),
    },
    inputTokens: count(receipt?.inputTokens),
    outputTokens: count(receipt?.outputTokens),
    cachedInputTokens: count(receipt?.cachedInputTokens),
    projectedUpperEstimateUsd: validCard
      ? cost(preflight.worstCaseEstimatedUsd)
      : null,
    firstAttemptEstimatedUsd: validCard
      ? cost(preflight.firstAttemptEstimatedUsd)
      : null,
    aggregateWorstCaseEstimatedUsd: validCard
      ? cost(preflight.aggregateWorstCaseEstimatedUsd)
      : null,
    observedEstimatedCostUsd: cost(receipt?.estimatedCostUsd),
    chargedCostUsd: null,
    monetaryCap: "NO_PROVIDER_HARD_CAP",
    accountBalanceUsd: null,
    usageStatus:
      receipt?.usageStatus === "ESTIMATE_ONLY" ? "ESTIMATE_ONLY" : "UNKNOWN",
    publicG1: verdict(trial?.publicG1),
    publicG2: verdict(trial?.publicG2),
    publicG3: verdict(trial?.publicG3),
    coverage: {
      http: count(trial?.attempts?.[0]?.coverage?.http),
      requiredHttp: 17,
      sqlite: count(trial?.attempts?.[0]?.coverage?.sqlite),
      requiredSqlite: 20,
    },
    custody: {
      status: custody ? "RECORDED_STORED_READBACK" : "NOT_ESTABLISHED",
      artifactId:
        custody && /^[1-9][0-9]{0,19}$/.test(transport.ack.artifactId)
          ? transport.ack.artifactId
          : null,
      archiveSha256: custody ? hash(transport.ack.archiveSha256) : null,
      ciphertextSha256: custody ? hash(stored.ciphertextSha256) : null,
    },
    cleanup: {
      normal: clean(trial?.cleanup)
        ? "VERIFIED_ZERO_RESOURCES"
        : "NOT_ESTABLISHED",
      independent: independentZero
        ? "VERIFIED_ZERO_RESOURCES"
        : "NOT_ESTABLISHED",
    },
    outcome,
    stopReason,
    repairs: 1,
    G0: "INCONCLUSIVE",
    G4: "INCONCLUSIVE",
    product: "NOT_ESTABLISHED",
  };
}
