// Pure fail-closed validation and sanitization for MMP-174 G1 stress qualification.
// Strictly enforces allowlist projection; no stdout, stderr, raw paths, secrets, or unadmitted markers.

export const ALLOWED_TIERS = Object.freeze(["baseline", "moderate", "heavy"]);
export const ALLOWED_PHASES = Object.freeze(["typecheck", "build"]);
export const ALLOWED_VERDICTS = Object.freeze([
  "PASS",
  "FAIL",
  "ERROR",
  "TIMEOUT",
  "UNKNOWN",
]);
export const ALLOWED_SIDECAR_CODES = Object.freeze([
  "BUILD_PHASE_TIMEOUT",
  "BUILD_PHASE_SIGNAL",
  "BUILD_PHASE_SPAWN_ERROR",
  "BUILD_PHASE_OUTPUT_OVERFLOW",
  "BUILD_PHASE_UNKNOWN",
]);

export const DECISION_ENUMS = Object.freeze({
  STABLE_WITHIN_TESTED_TIERS: "STABLE_WITHIN_TESTED_TIERS",
  COMPILER_TIMEOUT_REPRODUCED: "COMPILER_TIMEOUT_REPRODUCED",
  COMPILER_FAIL_NON_TIMEOUT: "COMPILER_FAIL_NON_TIMEOUT",
  ENVIRONMENT_UNAVAILABLE: "ENVIRONMENT_UNAVAILABLE",
  INSUFFICIENT_EVIDENCE: "INSUFFICIENT_EVIDENCE",
});

const SECRET_PATTERNS = [
  /gh[pousr]_[A-Za-z0-9]/,
  /github_pat_/,
  /AKIA[A-Z0-9]{16}/,
  /-----BEGIN[^\r\n]*PRIVATE KEY-----/,
  /AGE-SECRET-KEY-/,
  /\bBearer\s+\S/,
  /\b(?:MODEL_API_KEY|ACTIONS_ID_TOKEN_REQUEST_TOKEN|ACTIONS_RUNTIME_TOKEN|AWS_SECRET_ACCESS_KEY)\b/,
  /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\./,
];

export function rejectSecrets(text) {
  if (typeof text !== "string") return;
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(text)) {
      throw new Error("SANITIZER_REJECTED: secret or credential marker detected");
    }
  }
}

/** Sanitize an error or signal token to a safe bounded alphanumeric/underscore literal. */
export function sanitizeToken(token) {
  if (token === null || token === undefined) return null;
  const str = String(token).split(":")[0].replace(/[^A-Za-z0-9_-]/g, "");
  rejectSecrets(str);
  return str.slice(0, 64) || null;
}

/** Sanitize an executed test ID preserving scenario and phase delimiter (:). */
export function sanitizeTestId(id) {
  if (typeof id !== "string") return null;
  rejectSecrets(id);
  const clean = id.replace(/[^A-Za-z0-9_:-]/g, "").slice(0, 64);
  return clean || null;
}

/**
 * Strict finite allowlist projection for a trial record.
 * Strips raw stdout, stderr, compiler output, stack traces, and filesystem paths.
 */
export function sanitizeTrialRecord(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("SANITIZER_REJECTED: trial is not an object");
  }

  // Ensure raw object doesn't leak secrets anywhere in stringified form
  const rawString = JSON.stringify(raw);
  rejectSecrets(rawString);

  const checks = Array.isArray(raw.checks)
    ? raw.checks.map((c) => {
        if (!c || typeof c !== "object") return null;
        const phase = ALLOWED_PHASES.includes(c.phase) ? c.phase : "unknown";
        return {
          phase,
          exitCode: Number.isInteger(c.exitCode) ? c.exitCode : null,
          signal: sanitizeToken(c.signal),
          error: sanitizeToken(c.error),
        };
      })
    : null;

  return {
    trialIndex: Number.isInteger(raw.trialIndex) ? raw.trialIndex : -1,
    tier: ALLOWED_TIERS.includes(raw.tier) ? raw.tier : "unknown",
    provisionElapsedMs:
      typeof raw.provisionElapsedMs === "number" && Number.isFinite(raw.provisionElapsedMs)
        ? Math.round(raw.provisionElapsedMs)
        : null,
    dockerBuildCmdElapsedMs:
      typeof raw.dockerBuildCmdElapsedMs === "number" && Number.isFinite(raw.dockerBuildCmdElapsedMs)
        ? Math.round(raw.dockerBuildCmdElapsedMs)
        : null,
    typecheckDuration: "NOT_AVAILABLE_FROM_PRODUCTION_RECEIPT",
    buildDuration: "NOT_AVAILABLE_FROM_PRODUCTION_RECEIPT",
    buildExitCode: Number.isInteger(raw.buildExitCode) ? raw.buildExitCode : null,
    buildSignal: sanitizeToken(raw.buildSignal),
    buildError: sanitizeToken(raw.buildError),
    buildTimedOut: Boolean(raw.buildTimedOut),
    checks,
    g1Verdict: ALLOWED_VERDICTS.includes(raw.g1Verdict) ? raw.g1Verdict : "UNKNOWN",
    g1FindingCodes: Array.isArray(raw.g1FindingCodes)
      ? raw.g1FindingCodes.map(sanitizeToken).filter(Boolean)
      : [],
    executedTestIds: Array.isArray(raw.executedTestIds)
      ? raw.executedTestIds.map(sanitizeTestId).filter(Boolean)
      : [],
    sidecarCode: ALLOWED_SIDECAR_CODES.includes(raw.sidecarCode) ? raw.sidecarCode : null,
    cleanupVerified: Boolean(raw.cleanupVerified),
    zeroResourcesVerified: Boolean(raw.zeroResourcesVerified),
    error: sanitizeToken(raw.error),
    cleanupError: sanitizeToken(raw.cleanupError),
  };
}

const EXPECTED_PHASE_NAMES = Object.freeze(["typecheck", "build"]);
const EXPECTED_TEST_IDS = Object.freeze([
  "workshop-business:typecheck",
  "workshop-business:build",
]);

/**
 * Validate a single qualification trial record.
 */
export function validateTrial(trial, expectedTier) {
  const reasons = [];

  if (!trial || typeof trial !== "object") {
    return { valid: false, reasons: ["TRIAL_NOT_AN_OBJECT"] };
  }

  if (expectedTier && trial.tier !== expectedTier) {
    reasons.push(`TIER_MISMATCH:${trial.tier}!==${expectedTier}`);
  }

  if (trial.g1Verdict !== "PASS") {
    reasons.push(`UNEXPECTED_G1_VERDICT:${trial.g1Verdict ?? "MISSING"}`);
  }

  if (trial.buildExitCode !== 0) {
    reasons.push(`UNEXPECTED_BUILD_EXIT:${trial.buildExitCode}`);
  }

  if (trial.cleanupVerified !== true) {
    reasons.push("CLEANUP_NOT_VERIFIED");
  }

  if (trial.zeroResourcesVerified !== true) {
    reasons.push("RESIDUAL_OWNED_RESOURCES");
  }

  if (trial.cleanupError !== null && trial.cleanupError !== undefined) {
    reasons.push(`CLEANUP_FAULT:${trial.cleanupError}`);
  }

  if (trial.error !== null && trial.error !== undefined) {
    reasons.push(`WORKER_ERROR:${trial.error}`);
  }

  if (trial.buildTimedOut) {
    reasons.push("BUILD_TIMED_OUT");
  }

  if (trial.sidecarCode !== null && trial.sidecarCode !== undefined) {
    reasons.push(`ABNORMAL_PHASE_SIDECAR:${trial.sidecarCode}`);
  }

  if (
    !Array.isArray(trial.executedTestIds) ||
    trial.executedTestIds.length !== EXPECTED_TEST_IDS.length ||
    !EXPECTED_TEST_IDS.every((id) => trial.executedTestIds.includes(id))
  ) {
    reasons.push(
      `INCOMPLETE_EXECUTED_TEST_IDS:${JSON.stringify(trial.executedTestIds ?? [])}`,
    );
  }

  if (!Array.isArray(trial.checks) || trial.checks.length !== 2) {
    reasons.push(
      `INVALID_CHECKS_COUNT:${Array.isArray(trial.checks) ? trial.checks.length : "NOT_ARRAY"}`,
    );
  } else {
    for (const [index, phaseName] of EXPECTED_PHASE_NAMES.entries()) {
      const check = trial.checks[index];
      if (!check || typeof check !== "object") {
        reasons.push(`PHASE_${phaseName.toUpperCase()}_CHECK_INVALID`);
      } else {
        if (check.phase !== phaseName) {
          reasons.push(`PHASE_NAME_MISMATCH:${check.phase}!==${phaseName}`);
        }
        if (check.exitCode !== 0) {
          reasons.push(`PHASE_${phaseName.toUpperCase()}_NONZERO_EXIT:${check.exitCode}`);
        }
        if (check.signal !== null) {
          reasons.push(`PHASE_${phaseName.toUpperCase()}_SIGNAL:${check.signal}`);
        }
        if (check.error !== null) {
          reasons.push(`PHASE_${phaseName.toUpperCase()}_ERROR:${check.error}`);
        }
      }
    }
  }

  if (
    typeof trial.dockerBuildCmdElapsedMs !== "number" ||
    !Number.isFinite(trial.dockerBuildCmdElapsedMs) ||
    trial.dockerBuildCmdElapsedMs <= 0
  ) {
    reasons.push("INVALID_DOCKER_BUILD_DURATION");
  }

  return {
    valid: reasons.length === 0,
    reasons,
  };
}

function calculateStats(values) {
  if (values.length === 0) return { min: 0, median: 0, max: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 !== 0
      ? sorted[mid]
      : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  return {
    min: sorted[0],
    median,
    max: sorted[sorted.length - 1],
  };
}

/**
 * Validate an entire batch across tiers.
 */
export function validateBatchResults(results, expectedTrialsPerTier) {
  const failures = [];
  const tierMap = new Map();

  for (const tier of ALLOWED_TIERS) {
    tierMap.set(tier, []);
  }

  for (const trial of results) {
    if (!trial || typeof trial !== "object") {
      failures.push("MALFORMED_TRIAL_RECORD");
      continue;
    }
    const tierList = tierMap.get(trial.tier);
    if (!tierList) {
      failures.push(`UNRECOGNIZED_TIER:${trial.tier}`);
      continue;
    }
    tierList.push(trial);
  }

  const tierSummaries = {};

  for (const tier of ALLOWED_TIERS) {
    const trials = tierMap.get(tier) ?? [];
    if (trials.length < expectedTrialsPerTier) {
      failures.push(`INSUFFICIENT_TRIALS_${tier.toUpperCase()}:${trials.length}<${expectedTrialsPerTier}`);
    }

    let passed = 0;
    let failed = 0;
    let errors = 0;
    let timeouts = 0;
    const dockerCmdDurations = [];
    const provisionDurations = [];

    for (const trial of trials) {
      const trialValidation = validateTrial(trial, tier);
      if (!trialValidation.valid) {
        failures.push(`TRIAL_${trial.trialIndex}_[${tier}]_INVALID:${trialValidation.reasons.join(",")}`);
      }

      if (trial.dockerBuildCmdElapsedMs) dockerCmdDurations.push(trial.dockerBuildCmdElapsedMs);
      if (trial.provisionElapsedMs) provisionDurations.push(trial.provisionElapsedMs);

      if (trial.g1Verdict === "PASS" && trial.buildExitCode === 0) {
        passed++;
      } else if (trial.sidecarCode === "BUILD_PHASE_TIMEOUT" || trial.buildTimedOut) {
        timeouts++;
        errors++;
      } else if (trial.g1Verdict === "FAIL") {
        failed++;
      } else {
        errors++;
      }
    }

    tierSummaries[tier] = {
      expected: expectedTrialsPerTier,
      totalRun: trials.length,
      passed,
      failed,
      errors,
      timeouts,
      dockerCmdMs: calculateStats(dockerCmdDurations),
      provisionMs: calculateStats(provisionDurations),
    };
  }

  return {
    passed: failures.length === 0,
    summary: {
      expectedTotal: expectedTrialsPerTier * ALLOWED_TIERS.length,
      executedTotal: results.length,
      failuresCount: failures.length,
    },
    tierSummaries,
    failures,
  };
}

/**
 * Classify the overall stress qualification decision based on batch evidence.
 */
export function classifyExperimentDecision(batchValidation, runtimeRecipeMatchesPin) {
  if (!runtimeRecipeMatchesPin) {
    return DECISION_ENUMS.ENVIRONMENT_UNAVAILABLE;
  }

  if (!batchValidation || typeof batchValidation !== "object" || !batchValidation.tierSummaries) {
    return DECISION_ENUMS.INSUFFICIENT_EVIDENCE;
  }

  const { tierSummaries } = batchValidation;

  // Check if any tier had environment error
  for (const tier of ALLOWED_TIERS) {
    const s = tierSummaries[tier];
    if (!s || s.totalRun === 0) return DECISION_ENUMS.INSUFFICIENT_EVIDENCE;
  }

  // Check if timeout occurred
  for (const tier of ALLOWED_TIERS) {
    const s = tierSummaries[tier];
    if (s.timeouts > 0) {
      return DECISION_ENUMS.COMPILER_TIMEOUT_REPRODUCED;
    }
  }

  // Check if non-timeout compiler fail occurred
  for (const tier of ALLOWED_TIERS) {
    const s = tierSummaries[tier];
    if (s.failed > 0) {
      return DECISION_ENUMS.COMPILER_FAIL_NON_TIMEOUT;
    }
  }

  // Check if all tiers passed without error
  let allTiersPassed = true;
  for (const tier of ALLOWED_TIERS) {
    const s = tierSummaries[tier];
    if (s.passed !== s.expected || s.errors > 0) {
      allTiersPassed = false;
    }
  }

  if (allTiersPassed && batchValidation.passed) {
    return DECISION_ENUMS.STABLE_WITHIN_TESTED_TIERS;
  }

  return DECISION_ENUMS.INSUFFICIENT_EVIDENCE;
}
