import { syntheticSample } from "./sampler.mjs";
import {
  canonical,
  commitment,
  digest,
  id,
  object,
  RegistryError,
  requireThat,
  unique,
  validateFreeze,
  validateRegistration,
} from "./validation.mjs";

export const EMPTY_HASH = "0".repeat(64);

export function initialState() {
  return { stage: "EMPTY", attempts: [] };
}

export function signers(type, trust) {
  const roles = {
    REGISTER: [...trust.owners, trust.custodian, trust.reviewer],
    FREEZE: [...trust.owners, trust.author, trust.custodian, trust.reviewer],
    DRAW_STARTED: [trust.custodian, trust.reviewer],
    SELECTION: [trust.custodian, trust.reviewer],
    AUTHORIZE_ATTEMPT: [...trust.owners, trust.custodian, trust.reviewer],
    START_ATTEMPT: [trust.custodian, trust.reviewer],
    RECORD_BEHAVIORAL_FAIL: [trust.custodian, trust.reviewer],
    FINISH_ATTEMPT: [trust.custodian, trust.reviewer],
    ABORT: [trust.custodian, trust.reviewer],
  };
  requireThat(Object.hasOwn(roles, type), "UNKNOWN_TRANSITION");
  return [...new Set(roles[type])].sort();
}

function opening(payload, key, domain, value) {
  digest(payload.opening);
  digest(payload[key]);
  requireThat(
    commitment(domain, payload.opening, value) === payload[key],
    "COMMITMENT_MISMATCH",
  );
}

function selectionValid(reg, selected) {
  requireThat(
    Array.isArray(selected) && selected.length <= 256,
    "INVALID_SELECTION",
  );
  selected.forEach(id);
  unique(selected, "DUPLICATE_SELECTED_CASE");
  requireThat(
    selected.every((caseId) => reg.pool.some((entry) => entry.id === caseId)),
    "UNKNOWN_SELECTED_CASE",
  );
  requireThat(
    reg.policy.mandatoryCaseIds.every((caseId) => selected.includes(caseId)),
    "MANDATORY_CASE_MISSING",
  );
  const orderedStrata = selected.map((caseId) =>
    reg.policy.strata.findIndex(
      (row) => row.id === reg.pool.find((entry) => entry.id === caseId).stratum,
    ),
  );
  requireThat(
    orderedStrata.every(
      (value, index) => index === 0 || value >= orderedStrata[index - 1],
    ),
    "STRATA_ORDER_DRIFT",
  );
  for (const stratum of reg.policy.strata) {
    requireThat(
      selected.filter(
        (caseId) =>
          reg.pool.find((entry) => entry.id === caseId).stratum === stratum.id,
      ).length === stratum.count,
      "STRATUM_COUNT_DRIFT",
    );
  }
}

export function apply(state, event, trust, eventHash = null) {
  const p = event.payload;
  const next = {
    ...state,
    attempts: state.attempts.map((attempt) => ({ ...attempt })),
  };
  switch (event.type) {
    case "REGISTER": {
      requireThat(state.stage === "EMPTY", "REGISTRATION_ALREADY_EXISTS");
      object(p, ["registration", "opening", "registrationCommitment"]);
      validateRegistration(p.registration, trust);
      opening(
        p,
        "registrationCommitment",
        "MMP-056-REGISTRATION-V1",
        p.registration,
      );
      next.registration = p.registration;
      next.registrationCommitment = p.registrationCommitment;
      next.openings = [p.opening];
      next.stage = "REGISTERED";
      break;
    }
    case "FREEZE": {
      requireThat(state.stage === "REGISTERED", "FREEZE_ORDER");
      object(p, [
        "freeze",
        "opening",
        "candidateCommitment",
        "registrationCommitment",
      ]);
      requireThat(
        p.registrationCommitment === state.registrationCommitment,
        "REGISTRATION_MISMATCH",
      );
      validateFreeze(p.freeze, state.registration);
      opening(p, "candidateCommitment", "MMP-056-CANDIDATE-V1", p.freeze);
      requireThat(!state.openings.includes(p.opening), "NONCE_REUSE");
      next.freeze = p.freeze;
      next.candidateCommitment = p.candidateCommitment;
      next.openings = [...state.openings, p.opening];
      next.stage = "CANDIDATE_FROZEN";
      break;
    }
    case "DRAW_STARTED": {
      requireThat(state.stage === "CANDIDATE_FROZEN", "DRAW_ORDER_OR_REPEAT");
      object(p, ["drawId", "candidateCommitment", "registrationCommitment"]);
      id(p.drawId);
      requireThat(
        p.candidateCommitment === state.candidateCommitment &&
          p.registrationCommitment === state.registrationCommitment,
        "FREEZE_MISMATCH",
      );
      next.drawId = p.drawId;
      next.stage = "DRAW_STARTED";
      break;
    }
    case "SELECTION": {
      requireThat(state.stage === "DRAW_STARTED", "SELECTION_ORDER");
      object(p, [
        "drawId",
        "selected",
        "opening",
        "drawEntropy",
        "selectionCommitment",
      ]);
      requireThat(p.drawId === state.drawId, "DRAW_MISMATCH");
      selectionValid(state.registration, p.selected);
      digest(p.drawEntropy);
      requireThat(
        canonical(syntheticSample(state.registration, p.drawEntropy)) ===
          canonical(p.selected),
        "SAMPLER_TRANSCRIPT_MISMATCH",
      );
      opening(p, "selectionCommitment", "MMP-056-SELECTION-V1", {
        drawId: p.drawId,
        drawEntropy: p.drawEntropy,
        selected: p.selected,
        candidateCommitment: state.candidateCommitment,
        registrationCommitment: state.registrationCommitment,
      });
      requireThat(
        !state.openings.includes(p.opening) &&
          !state.openings.includes(p.drawEntropy) &&
          p.opening !== p.drawEntropy,
        "NONCE_REUSE",
      );
      next.selected = p.selected;
      next.selectionCommitment = p.selectionCommitment;
      next.openings = [...state.openings, p.opening, p.drawEntropy];
      next.stage = "SELECTION_COMMITTED";
      break;
    }
    case "AUTHORIZE_ATTEMPT": {
      requireThat(
        ["SELECTION_COMMITTED", "ATTEMPT_TERMINAL"].includes(state.stage),
        "AUTHORIZATION_ORDER",
      );
      object(p, [
        "attemptId",
        "candidateCommitment",
        "selectionCommitment",
        "retryOf",
        "selectionReusable",
        "validUntil",
      ]);
      id(p.attemptId);
      requireThat(
        typeof p.validUntil === "string" &&
          /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(p.validUntil) &&
          Number.isFinite(Date.parse(p.validUntil)) &&
          new Date(p.validUntil).toISOString() === p.validUntil,
        "AUTHORIZATION_TIME_INVALID",
      );
      requireThat(
        p.validUntil >= event.at &&
          Date.parse(p.validUntil) - Date.parse(event.at) <= 300000,
        "AUTHORIZATION_EXPIRED",
      );
      requireThat(
        !state.attempts.some((attempt) => attempt.id === p.attemptId),
        "ATTEMPT_DUPLICATE",
      );
      requireThat(
        p.candidateCommitment === state.candidateCommitment &&
          p.selectionCommitment === state.selectionCommitment,
        "AUTHORIZATION_STALE",
      );
      requireThat(
        state.attempts.length < state.registration.policy.maxAttempts,
        "ATTEMPT_LIMIT",
      );
      if (state.attempts.length === 0) {
        requireThat(
          p.retryOf === null && p.selectionReusable === false,
          "FIRST_ATTEMPT_INVALID",
        );
      } else {
        const previous = state.attempts.at(-1);
        requireThat(
          previous.outcome === "ERROR" &&
            !previous.behavioralFailSeen &&
            state.registration.policy.retryOn.includes(previous.errorClass),
          "RETRY_FORBIDDEN",
        );
        requireThat(
          p.retryOf === previous.id && p.selectionReusable === true,
          "RETRY_NOT_ATTESTED",
        );
      }
      next.pendingAttempt = p.attemptId;
      next.authorizationExpires = p.validUntil;
      next.stage = "AUTHORIZED_RUN";
      break;
    }
    case "START_ATTEMPT": {
      requireThat(state.stage === "AUTHORIZED_RUN", "ATTEMPT_START_ORDER");
      object(p, [
        "attemptId",
        "freeze",
        "selectionCommitment",
        "authorizationHash",
      ]);
      requireThat(
        p.attemptId === state.pendingAttempt &&
          p.authorizationHash === event.prev,
        "AUTHORIZATION_STALE",
      );
      requireThat(
        event.at <= state.authorizationExpires,
        "AUTHORIZATION_EXPIRED",
      );
      requireThat(
        canonical(p.freeze) === canonical(state.freeze) &&
          p.selectionCommitment === state.selectionCommitment,
        "CANDIDATE_DRIFT",
      );
      next.attempts.push({
        id: p.attemptId,
        outcome: "RUNNING",
        behavioralFailSeen: false,
      });
      next.stage = "RUNNING";
      break;
    }
    case "RECORD_BEHAVIORAL_FAIL": {
      requireThat(state.stage === "RUNNING", "BEHAVIORAL_FAIL_ORDER");
      object(p, ["attemptId"]);
      const attempt = next.attempts.at(-1);
      requireThat(
        p.attemptId === attempt.id && !attempt.behavioralFailSeen,
        "BEHAVIORAL_FAIL_DUPLICATE",
      );
      attempt.behavioralFailSeen = true;
      break;
    }
    case "FINISH_ATTEMPT": {
      requireThat(state.stage === "RUNNING", "ATTEMPT_FINISH_ORDER");
      object(p, [
        "attemptId",
        "freeze",
        "outcome",
        "errorClass",
        "executedCaseIds",
      ]);
      const attempt = next.attempts.at(-1);
      requireThat(
        p.attemptId === attempt.id &&
          canonical(p.freeze) === canonical(state.freeze),
        "CANDIDATE_DRIFT",
      );
      requireThat(
        ["PASS", "FAIL", "ERROR", "INCONCLUSIVE"].includes(p.outcome),
        "INVALID_OUTCOME",
      );
      requireThat(
        Array.isArray(p.executedCaseIds) &&
          p.executedCaseIds.length <= state.selected.length,
        "INVALID_COVERAGE",
      );
      p.executedCaseIds.forEach(id);
      unique(p.executedCaseIds, "DUPLICATE_EXECUTION");
      requireThat(
        p.executedCaseIds.every((caseId) => state.selected.includes(caseId)),
        "UNKNOWN_EXECUTED_CASE",
      );
      if (p.outcome === "PASS") {
        requireThat(!attempt.behavioralFailSeen, "BEHAVIORAL_FAIL_STICKY");
        requireThat(
          canonical(p.executedCaseIds) === canonical(state.selected),
          "INCOMPLETE_COVERAGE",
        );
      }
      requireThat(
        p.outcome === "ERROR"
          ? [
              "ENVIRONMENT_ERROR",
              "HARNESS_ERROR",
              "UNCLASSIFIED_ERROR",
            ].includes(p.errorClass)
          : p.errorClass === null,
        "INVALID_ERROR_CLASS",
      );
      attempt.outcome = p.outcome;
      attempt.behavioralFailSeen ||= p.outcome === "FAIL";
      attempt.errorClass = p.errorClass;
      attempt.terminalReceiptAt = event.at;
      attempt.terminalWitnessRef = eventHash;
      next.stage = "ATTEMPT_TERMINAL";
      break;
    }
    case "ABORT": {
      requireThat(!["EMPTY", "ABORTED"].includes(state.stage), "ABORT_ORDER");
      object(p, ["reason"]);
      requireThat(
        [
          "OPERATOR_STOP",
          "INTERRUPTED",
          "EXPOSURE",
          "INTEGRITY_ERROR",
        ].includes(p.reason),
        "INVALID_ABORT",
      );
      if (next.stage === "RUNNING") {
        next.attempts.at(-1).outcome = "ABORTED";
        next.attempts.at(-1).terminalReceiptAt = event.at;
        next.attempts.at(-1).terminalWitnessRef = eventHash;
      }
      next.stage = "ABORTED";
      break;
    }
    default:
      throw new RegistryError("UNKNOWN_TRANSITION");
  }
  return next;
}
