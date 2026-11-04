// SYNTHETIC_UNIT_ONLY: deterministic unit tests for MMP-174 G1 stress qualification,
// workload generator admission, sanitizer allowlisting, and fail-closed batch validation.

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runMockUnit } from "../../../research/mmp-174/measure-stress.mjs";
import {
  DECISION_ENUMS,
  rejectSecrets,
  sanitizeTrialRecord,
} from "../../../research/mmp-174/validator.mjs";
import {
  buildTierBundle,
  generateSyntheticModules,
} from "../../../research/mmp-174/workload-generator.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const workshopRoot = join(root, "packages/target-worker/fixtures/workshop");

test("MMP-174: synthetic workload generator produces deterministic tiers", () => {
  const mod1 = generateSyntheticModules(24);
  const mod2 = generateSyntheticModules(24);
  assert.equal(mod1.length, 24);
  assert.equal(mod2.length, 24);
  for (let i = 0; i < 24; i++) {
    assert.equal(mod1[i].path, mod2[i].path);
    assert.equal(mod1[i].content, mod2[i].content);
    assert.equal(mod1[i].sha256, mod2[i].sha256);
  }

  const baseline = buildTierBundle("baseline", workshopRoot);
  assert.equal(baseline.fileCount, 2);
  assert.equal(baseline.totalBytes, 13249);
  assert.equal(
    baseline.candidateSha,
    "34c8325a89db434bf5e869bbcb0999b9d2ef2496e4cff2db577a1e19c95f1334",
  );

  const moderate = buildTierBundle("moderate", workshopRoot);
  assert.equal(moderate.fileCount, 8);
  const modAdded = moderate.totalBytes - 13249;
  assert.ok(modAdded >= 10 * 1024 && modAdded <= 40 * 1024);

  const heavy = buildTierBundle("heavy", workshopRoot);
  assert.equal(heavy.fileCount, 26);
  const heavyAdded = heavy.totalBytes - 13249;
  assert.ok(heavyAdded >= 40 * 1024 && heavyAdded <= 120 * 1024);
});

test("MMP-174: sanitizer rejects secret patterns and raw outputs", () => {
  assert.throws(
    () => rejectSecrets("ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345"),
    /SANITIZER_REJECTED/,
  );
  assert.throws(
    () => rejectSecrets("-----BEGIN EC PRIVATE KEY-----"),
    /SANITIZER_REJECTED/,
  );

  const sanitized = sanitizeTrialRecord({
    trialIndex: 1,
    tier: "moderate",
    provisionElapsedMs: 12000,
    dockerBuildCmdElapsedMs: 10400,
    buildExitCode: 0,
    buildTimedOut: false,
    checks: [{ phase: "typecheck", exitCode: 0, stdout: "SECRET_LEAK" }],
    g1Verdict: "PASS",
    executedTestIds: ["workshop-business:typecheck", "workshop-business:build"],
    cleanupVerified: true,
    zeroResourcesVerified: true,
  });

  assert.equal(sanitized.checks[0].stdout, undefined);
  assert.equal(
    sanitized.typecheckDuration,
    "NOT_AVAILABLE_FROM_PRODUCTION_RECEIPT",
  );
  assert.equal(
    sanitized.buildDuration,
    "NOT_AVAILABLE_FROM_PRODUCTION_RECEIPT",
  );
});

test("MMP-174: batch validation and decision classification enforce fail-closed semantics", () => {
  const passRun = runMockUnit("pass", 3);
  assert.equal(passRun.validation.passed, true);
  assert.equal(passRun.decision, DECISION_ENUMS.STABLE_WITHIN_TESTED_TIERS);

  const failRun = runMockUnit("fail", 3);
  assert.equal(failRun.validation.passed, false);
  assert.equal(failRun.decision, DECISION_ENUMS.COMPILER_FAIL_NON_TIMEOUT);

  const timeoutRun = runMockUnit("timeout", 3);
  assert.equal(timeoutRun.validation.passed, false);
  assert.equal(timeoutRun.decision, DECISION_ENUMS.COMPILER_TIMEOUT_REPRODUCED);

  const leakRun = runMockUnit("leak", 3);
  assert.equal(leakRun.validation.passed, false);

  const cleanupFailRun = runMockUnit("cleanup-fail", 3);
  assert.equal(cleanupFailRun.validation.passed, false);
});
