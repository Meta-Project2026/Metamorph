// Pure fail-closed validation for G1 qualification batch and trial records.
// No raw candidate source, stack traces, paths, or secrets are accepted or emitted.

const EXPECTED_PHASE_NAMES = Object.freeze(["typecheck", "build"]);
const EXPECTED_TEST_IDS = Object.freeze([
  "workshop-business:typecheck",
  "workshop-business:build",
]);

/**
 * Validate a single qualification trial record.
 * Returns { valid: true } or { valid: false, reasons: string[] }.
 */
export function validateTrial(trial) {
  const reasons = [];

  if (!trial || typeof trial !== "object") {
    return { valid: false, reasons: ["TRIAL_NOT_AN_OBJECT"] };
  }

  if (trial.g1Verdict !== "PASS") {
    reasons.push(`UNEXPECTED_G1_VERDICT:${trial.g1Verdict ?? "MISSING"}`);
  }

  if (trial.buildExitCode !== 0) {
    reasons.push(`UNEXPECTED_BUILD_EXIT:${trial.buildExitCode}`);
  }

  if (trial.buildTimedOut !== false) {
    reasons.push("BUILD_TIMED_OUT");
  }

  if (trial.buildSignal !== null) {
    reasons.push(`UNEXPECTED_BUILD_SIGNAL:${trial.buildSignal}`);
  }

  if (trial.buildError !== null) {
    reasons.push(`UNEXPECTED_BUILD_ERROR:${trial.buildError}`);
  }

  if (trial.error !== null) {
    reasons.push(`UNEXPECTED_WORKER_ERROR:${trial.error}`);
  }

  if (trial.cleanupError !== null && trial.cleanupError !== undefined) {
    reasons.push(`CLEANUP_FAULT:${trial.cleanupError}`);
  }

  if (trial.cleanupVerified !== true) {
    reasons.push("CLEANUP_NOT_VERIFIED");
  }

  if (trial.zeroResourcesVerified !== true) {
    reasons.push("RESIDUAL_OWNED_RESOURCES");
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

  if (
    typeof trial.provisionElapsedMs !== "number" ||
    !Number.isFinite(trial.provisionElapsedMs) ||
    trial.provisionElapsedMs <= 0
  ) {
    reasons.push("INVALID_PROVISION_DURATION");
  }

  return reasons.length === 0
    ? { valid: true }
    : { valid: false, reasons };
}

/**
 * Validate a batch of qualification trial records.
 * Returns { passed: true, summary } or { passed: false, failures: [...], summary }.
 */
export function validateBatchResults(results, expectedCount = 10) {
  if (!Array.isArray(results)) {
    return {
      passed: false,
      failures: [{ trialIndex: -1, reasons: ["RESULTS_NOT_AN_ARRAY"] }],
      summary: { total: 0, expected: expectedCount, passed: 0, failed: 1 },
    };
  }

  if (results.length !== expectedCount) {
    return {
      passed: false,
      failures: [
        {
          trialIndex: -1,
          reasons: [`TRIAL_COUNT_MISMATCH:received_${results.length}_expected_${expectedCount}`],
        },
      ],
      summary: {
        total: results.length,
        expected: expectedCount,
        passed: 0,
        failed: Math.abs(results.length - expectedCount),
      },
    };
  }

  const failures = [];
  let passedCount = 0;

  for (const [index, trial] of results.entries()) {
    const trialValidation = validateTrial(trial);
    if (!trialValidation.valid) {
      failures.push({
        trialIndex: trial?.trialIndex ?? index + 1,
        reasons: trialValidation.reasons,
      });
    } else {
      passedCount++;
    }
  }

  const passed = failures.length === 0;
  return {
    passed,
    failures,
    summary: {
      total: results.length,
      expected: expectedCount,
      passed: passedCount,
      failed: failures.length,
    },
  };
}
