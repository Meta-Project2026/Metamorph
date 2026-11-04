// Deterministic unit tests for MMP-174 G1 compiler stress qualification.
// Tests synthetic generator determinism, admission constraints, sanitizer allowlisting,
// and fail-closed batch validation logic.

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  TIERS,
  TIER_CONFIGS,
  buildTierBundle,
  generateSyntheticModules,
  loadBaselineFiles,
} from "./workload-generator.mjs";
import {
  ALLOWED_PHASES,
  ALLOWED_TIERS,
  ALLOWED_VERDICTS,
  DECISION_ENUMS,
  classifyExperimentDecision,
  rejectSecrets,
  sanitizeTestId,
  sanitizeToken,
  sanitizeTrialRecord,
  validateBatchResults,
  validateTrial,
} from "./validator.mjs";
import { runMockUnit } from "./measure-stress.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const workshopRoot = join(root, "packages/target-worker/fixtures/workshop");

test("workload generator: produces byte-deterministic modules and hashes", () => {
  const run1 = generateSyntheticModules(24);
  const run2 = generateSyntheticModules(24);

  assert.equal(run1.length, 24);
  assert.equal(run2.length, 24);

  for (let i = 0; i < 24; i++) {
    assert.equal(run1[i].path, run2[i].path);
    assert.equal(run1[i].content, run2[i].content);
    assert.equal(run1[i].sha256, run2[i].sha256);
  }
});

test("workload generator: baseline tier matches canonical workshop fixture", () => {
  const bundle = buildTierBundle("baseline", workshopRoot);
  assert.equal(bundle.tier, "baseline");
  assert.equal(bundle.fileCount, 2);
  assert.equal(bundle.totalBytes, 13249);
  assert.equal(
    bundle.candidateSha,
    "34c8325a89db434bf5e869bbcb0999b9d2ef2496e4cff2db577a1e19c95f1334",
  );
});

test("workload generator: moderate tier stays within design bounds", () => {
  const bundle = buildTierBundle("moderate", workshopRoot);
  assert.equal(bundle.tier, "moderate");
  assert.equal(bundle.fileCount, 8); // 2 baseline + 6 synthetic
  const addedBytes = bundle.totalBytes - 13249;
  assert.ok(
    addedBytes >= 10 * 1024 && addedBytes <= 40 * 1024,
    `Moderate added bytes ${addedBytes} out of [10KiB, 40KiB] range`,
  );
  assert.ok(bundle.candidateSha.length === 64);
});

test("workload generator: heavy tier stays within design bounds", () => {
  const bundle = buildTierBundle("heavy", workshopRoot);
  assert.equal(bundle.tier, "heavy");
  assert.equal(bundle.fileCount, 26); // 2 baseline + 24 synthetic
  const addedBytes = bundle.totalBytes - 13249;
  assert.ok(
    addedBytes >= 40 * 1024 && addedBytes <= 120 * 1024,
    `Heavy added bytes ${addedBytes} out of [40KiB, 120KiB] range`,
  );
  assert.ok(bundle.candidateSha.length === 64);
});

test("workload generator: enforces TargetWorker admission limits", () => {
  // All tiers must have totalBytes <= 1 MiB and <= 64 files
  for (const tier of TIERS) {
    const bundle = buildTierBundle(tier, workshopRoot);
    assert.ok(bundle.fileCount <= 64, `Tier ${tier} has > 64 files`);
    assert.ok(bundle.totalBytes <= 1024 * 1024, `Tier ${tier} has > 1MiB bytes`);
    for (const f of bundle.files) {
      assert.ok(Buffer.byteLength(f.content) <= 256 * 1024, `File ${f.path} > 256KiB`);
    }
  }

  // Reject invalid module count
  assert.throws(() => generateSyntheticModules(-1), /INVALID_MODULE_COUNT/);
  assert.throws(() => generateSyntheticModules(999), /INVALID_MODULE_COUNT/);

  // Reject unknown tier
  assert.throws(() => buildTierBundle("nonexistent", workshopRoot), /UNKNOWN_TIER/);
});

test("sanitizer: rejects secret patterns", () => {
  assert.throws(
    () => rejectSecrets("token: ghp_123456789012345678901234567890123456"),
    /SANITIZER_REJECTED/,
  );
  assert.throws(
    () => rejectSecrets("-----BEGIN RSA PRIVATE KEY-----"),
    /SANITIZER_REJECTED/,
  );
  assert.throws(
    () => rejectSecrets("AGE-SECRET-KEY-1029384756"),
    /SANITIZER_REJECTED/,
  );
  assert.throws(
    () => rejectSecrets("Bearer ya29.1234567890"),
    /SANITIZER_REJECTED/,
  );
  assert.doesNotThrow(() => rejectSecrets("ordinary safe log token"));
});

test("sanitizer: strict allowlist projection strips raw outputs and paths", () => {
  const raw = {
    trialIndex: 1,
    tier: "moderate",
    provisionElapsedMs: 12000,
    dockerBuildCmdElapsedMs: 10500,
    buildExitCode: 0,
    buildSignal: null,
    buildError: null,
    buildTimedOut: false,
    checks: [
      {
        phase: "typecheck",
        exitCode: 0,
        signal: null,
        error: null,
        stdout: "UNSANITIZED_RAW_STDOUT_LEAK",
        stderr: "UNSANITIZED_RAW_STDERR_LEAK",
      },
      {
        phase: "build",
        exitCode: 0,
        signal: null,
        error: null,
        stdout: "EMITTED_BYTE_TEXT",
      },
    ],
    g1Verdict: "PASS",
    g1FindingCodes: ["NONE"],
    executedTestIds: ["workshop-business:typecheck", "workshop-business:build"],
    sidecarCode: null,
    cleanupVerified: true,
    zeroResourcesVerified: true,
    error: null,
    cleanupError: null,
    rawSecretPath: "/home/runner/work/secret/path.ts",
  };

  const sanitized = sanitizeTrialRecord(raw);

  assert.equal(sanitized.trialIndex, 1);
  assert.equal(sanitized.tier, "moderate");
  assert.equal(sanitized.typecheckDuration, "NOT_AVAILABLE_FROM_PRODUCTION_RECEIPT");
  assert.equal(sanitized.buildDuration, "NOT_AVAILABLE_FROM_PRODUCTION_RECEIPT");
  assert.equal(sanitized.checks.length, 2);
  assert.equal(sanitized.checks[0].stdout, undefined);
  assert.equal(sanitized.checks[0].stderr, undefined);
  assert.equal(sanitized.checks[1].stdout, undefined);
  assert.equal(sanitized.rawSecretPath, undefined);
  assert.deepEqual(sanitized.executedTestIds, [
    "workshop-business:typecheck",
    "workshop-business:build",
  ]);
});

test("validator: fail-closed on trial anomalies", () => {
  const validTrial = {
    trialIndex: 1,
    tier: "baseline",
    provisionElapsedMs: 12000,
    dockerBuildCmdElapsedMs: 10500,
    buildExitCode: 0,
    buildSignal: null,
    buildError: null,
    buildTimedOut: false,
    checks: [
      { phase: "typecheck", exitCode: 0, signal: null, error: null },
      { phase: "build", exitCode: 0, signal: null, error: null },
    ],
    g1Verdict: "PASS",
    g1FindingCodes: [],
    executedTestIds: ["workshop-business:typecheck", "workshop-business:build"],
    sidecarCode: null,
    cleanupVerified: true,
    zeroResourcesVerified: true,
    error: null,
    cleanupError: null,
  };

  assert.equal(validateTrial(validTrial, "baseline").valid, true);

  // Tier mismatch
  assert.equal(validateTrial(validTrial, "heavy").valid, false);

  // Non-zero exit code
  assert.equal(
    validateTrial({ ...validTrial, buildExitCode: 2 }, "baseline").valid,
    false,
  );

  // Timeout flag
  assert.equal(
    validateTrial({ ...validTrial, buildTimedOut: true }, "baseline").valid,
    false,
  );

  // Cleanup failure
  assert.equal(
    validateTrial({ ...validTrial, cleanupVerified: false }, "baseline").valid,
    false,
  );

  // Residual resources leak
  assert.equal(
    validateTrial({ ...validTrial, zeroResourcesVerified: false }, "baseline").valid,
    false,
  );

  // Abnormal phase sidecar
  assert.equal(
    validateTrial(
      { ...validTrial, sidecarCode: "BUILD_PHASE_TIMEOUT" },
      "baseline",
    ).valid,
    false,
  );
});

test("decision classification: maps outcomes accurately", () => {
  // Nominal pass mock run
  const passMock = runMockUnit("pass", 3);
  assert.equal(passMock.validation.passed, true);
  assert.equal(passMock.decision, DECISION_ENUMS.STABLE_WITHIN_TESTED_TIERS);

  // Timeout mock run
  const timeoutMock = runMockUnit("timeout", 3);
  assert.equal(timeoutMock.validation.passed, false);
  assert.equal(timeoutMock.decision, DECISION_ENUMS.COMPILER_TIMEOUT_REPRODUCED);

  // Compiler failure mock run
  const failMock = runMockUnit("fail", 3);
  assert.equal(failMock.validation.passed, false);
  assert.equal(failMock.decision, DECISION_ENUMS.COMPILER_FAIL_NON_TIMEOUT);

  // Recipe mismatch -> ENVIRONMENT_UNAVAILABLE
  assert.equal(
    classifyExperimentDecision(passMock.validation, false),
    DECISION_ENUMS.ENVIRONMENT_UNAVAILABLE,
  );
});
