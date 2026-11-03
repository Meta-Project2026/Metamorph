// Source-backed, deterministic operator card. No credentials, account lookup,
// provider invocation or authority can be obtained from this public data.
import { closeSync, fsyncSync, openSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { sha256 } from "../../target-worker/src/admission.mjs";
import { META_OWNERS, META_REPOSITORY } from "./github-meta-guard.mjs";
import { prepareMetaMigration } from "./meta-migration.mjs";
import {
  PAID_POLICY,
  paidProjection,
  repairProjection,
} from "./meta-paid-authorization.mjs";
import { META_STANDARD_TARIFF } from "./meta-tariff.mjs";
import { insist, isMigrationContext } from "./migration-context.mjs";

const confirmations = {
  single_generation: "I_ACCEPT_ONE_PAID_ATTEMPT_NO_HARD_CAP",
  generate_then_repair: "I_ACCEPT_TWO_PAID_ATTEMPTS_NO_HARD_CAP",
};

export function generationPreflight({
  context,
  headSha,
  workflowBytes,
  actor,
  maxEstimatedUsd,
  plan = "single_generation",
  confirmation,
  now = Date.now(),
}) {
  insist(isMigrationContext(context), "SOURCE_IDENTITY");
  insist(
    /^[a-f0-9]{40}$/.test(headSha) &&
      Buffer.isBuffer(workflowBytes) &&
      workflowBytes.length > 0 &&
      workflowBytes.length <= 65536 &&
      Object.hasOwn(META_OWNERS, actor) &&
      (plan === "single_generation" || plan === "generate_then_repair") &&
      (confirmation === undefined || confirmation === confirmations[plan]),
    "WORKFLOW_IDENTITY_BLOCKED",
  );
  insist(
    Number.isFinite(now) &&
      now >= Date.parse(META_STANDARD_TARIFF.verifiedOn) &&
      now < Date.parse(PAID_POLICY.tariffExpires),
    "TARIFF_EXPIRED",
  );
  const body = prepareMetaMigration(context, {
    unitId: "workshop-api",
    tier: "spark",
    action: "generate",
    attempt: 1,
    repairFeedback: null,
  });
  const projection = paidProjection(body);
  const repair = plan === "generate_then_repair" ? repairProjection() : null;
  // Both sends of the signed two-attempt plan are projected before the first
  // POST; the allowance must cover the pessimistic aggregate, not one send.
  insist(
    [0.1, 0.2, 0.25, 0.5, 0.75, 1].includes(maxEstimatedUsd) &&
      projection.worstCaseEstimatedUsd + (repair?.worstCaseEstimatedUsd ?? 0) <=
        maxEstimatedUsd,
    "ESTIMATED_BUDGET_BLOCKED",
  );
  const card = {
    format: "mmp154-generation-preflight-v1",
    repository: META_REPOSITORY,
    headSha,
    workflowPath: ".github/workflows/meta-paid-migration.yml",
    workflowSha256: sha256(workflowBytes),
    actor,
    actorId: META_OWNERS[actor],
    sourceSha: context.sourceSha,
    sourceArchiveSha256: context.sourceArchiveSha256,
    contextSha256: context.contextSha256,
    manifestSha256: context.manifestSha256,
    model: META_STANDARD_TARIFF.model,
    mode: META_STANDARD_TARIFF.mode,
    tariff: META_STANDARD_TARIFF,
    requestBodySha256: sha256(body),
    requestBytes: Buffer.byteLength(body),
    ...projection,
    maxEstimatedUsd,
    maximumPosts: plan === "generate_then_repair" ? 2 : 1,
    maximumRepairs: plan === "generate_then_repair" ? 1 : 0,
    ...(repair
      ? {
          plan,
          repairWireBytes: PAID_POLICY.repairWireBytes,
          // The serializable computed projection object, never the function:
          // the signed card must survive structuredClone and JSON round-trips.
          repairProjection: repair,
          aggregateWorstCaseEstimatedUsd:
            projection.worstCaseEstimatedUsd + repair.worstCaseEstimatedUsd,
        }
      : {}),
    automaticRetries: 0,
    monetaryCap: "NO_PROVIDER_HARD_CAP",
    providerBilling: "TOKEN_BASED_PAY_AS_YOU_GO",
    accountCreditTerms: "UNKNOWN",
    accountBalanceUsd: null,
    availableCreditUsd: null,
    chargedCostUsd: null,
    timeoutExposure: "POSSIBLY_BILLED_NO_RETRY",
    confirmation: confirmation ?? confirmations[plan],
    initiator: "AUTHENTICATED_OWNER_WORKFLOW_DISPATCH_ON_REVIEWED_MAIN",
    admission: "NOT_GRANTED_BY_THIS_CARD",
  };
  return Object.freeze({ ...card, sha256: sha256(JSON.stringify(card)) });
}

/** Attempt-2 card, committed durably before the repair POST. It binds the
 * exact repair request body — the genuine previous model changes plus only
 * allowlisted public feedback codes — and re-checks the aggregate estimate
 * against the recorded first-attempt observation. */
export function repairPreflight({
  context,
  headSha,
  workflowBytes,
  actor,
  maxEstimatedUsd,
  feedback,
  previousChanges,
  firstAttemptEstimatedUsd,
  firstAttemptCandidateSha,
  confirmation,
  now = Date.now(),
}) {
  insist(isMigrationContext(context), "SOURCE_IDENTITY");
  insist(
    /^[a-f0-9]{40}$/.test(headSha) &&
      Buffer.isBuffer(workflowBytes) &&
      workflowBytes.length > 0 &&
      workflowBytes.length <= 65536 &&
      Object.hasOwn(META_OWNERS, actor) &&
      typeof feedback === "string" &&
      feedback.length > 0 &&
      Buffer.byteLength(feedback) <= 512 &&
      Array.isArray(previousChanges) &&
      previousChanges.length > 0 &&
      Number.isFinite(firstAttemptEstimatedUsd) &&
      firstAttemptEstimatedUsd >= 0 &&
      typeof firstAttemptCandidateSha === "string" &&
      /^[a-f0-9]{64}$/.test(firstAttemptCandidateSha) &&
      confirmation === confirmations.generate_then_repair,
    "WORKFLOW_IDENTITY_BLOCKED",
  );
  insist(
    Number.isFinite(now) &&
      now >= Date.parse(META_STANDARD_TARIFF.verifiedOn) &&
      now < Date.parse(PAID_POLICY.tariffExpires),
    "TARIFF_EXPIRED",
  );
  const body = prepareMetaMigration(
    context,
    {
      unitId: "workshop-api",
      tier: "spark",
      action: "repair",
      attempt: 2,
      repairFeedback: feedback,
    },
    previousChanges,
  );
  insist(Buffer.byteLength(body) <= PAID_POLICY.repairWireBytes, "INPUT_LIMIT");
  const projection = paidProjection(body);
  insist(
    [0.1, 0.2, 0.25, 0.5, 0.75, 1].includes(maxEstimatedUsd) &&
      firstAttemptEstimatedUsd + projection.worstCaseEstimatedUsd <=
        maxEstimatedUsd,
    "ESTIMATED_BUDGET_BLOCKED",
  );
  const card = {
    format: "mmp154-repair-preflight-v1",
    repository: META_REPOSITORY,
    headSha,
    workflowPath: ".github/workflows/meta-paid-migration.yml",
    workflowSha256: sha256(workflowBytes),
    actor,
    actorId: META_OWNERS[actor],
    sourceSha: context.sourceSha,
    sourceArchiveSha256: context.sourceArchiveSha256,
    contextSha256: context.contextSha256,
    manifestSha256: context.manifestSha256,
    model: META_STANDARD_TARIFF.model,
    mode: META_STANDARD_TARIFF.mode,
    tariff: META_STANDARD_TARIFF,
    requestBodySha256: sha256(body),
    requestBytes: Buffer.byteLength(body),
    ...projection,
    maxEstimatedUsd,
    attempt: 2,
    action: "repair",
    repairFeedbackCodes: feedback,
    firstAttemptEstimatedUsd,
    firstAttemptCandidateSha,
    aggregateWorstCaseEstimatedUsd:
      firstAttemptEstimatedUsd + projection.worstCaseEstimatedUsd,
    maximumPosts: 2,
    maximumRepairs: 1,
    automaticRetries: 0,
    monetaryCap: "NO_PROVIDER_HARD_CAP",
    providerBilling: "TOKEN_BASED_PAY_AS_YOU_GO",
    accountCreditTerms: "UNKNOWN",
    accountBalanceUsd: null,
    availableCreditUsd: null,
    chargedCostUsd: null,
    timeoutExposure: "POSSIBLY_BILLED_NO_RETRY",
    confirmation,
    initiator: "AUTHENTICATED_OWNER_WORKFLOW_DISPATCH_ON_REVIEWED_MAIN",
    admission: "NOT_GRANTED_BY_THIS_CARD",
  };
  return Object.freeze({ ...card, sha256: sha256(JSON.stringify(card)) });
}

// Exclusive creation; a partial record also prevents replay. No overwrite/resume.
// Linux directory fsync is required in production; Windows is preview/test only.
export function commitPreflight(path, card) {
  let fd;
  try {
    fd = openSync(path, "wx", 0o600);
    writeFileSync(fd, `${JSON.stringify(card, null, 2)}\n`);
    fsyncSync(fd);
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
  if (process.platform === "linux") {
    const directory = openSync(dirname(path), "r");
    try {
      fsyncSync(directory);
    } finally {
      closeSync(directory);
    }
  }
}
