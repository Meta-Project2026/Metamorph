// MMP-174: Fail-closed, bounded G1 compiler stress qualification runner.
// Tests graded synthetic public TypeScript workload tiers on trusted isolated Docker runtime.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

import { TargetWorker } from "../../packages/target-worker/src/controller.mjs";
import { buildTrustedRuntime } from "../../packages/target-worker/src/runtime-broker.mjs";
import { WORKSHOP_PROFILE } from "../../packages/target-worker/runtime/profile.mjs";
import { observeBuild, RECIPE_PIN } from "../../packages/agent-real/src/runtime.mjs";

import {
  TIERS,
  TIER_CONFIGS,
  buildTierBundle,
} from "./workload-generator.mjs";
import {
  classifyExperimentDecision,
  sanitizeTrialRecord,
  validateBatchResults,
} from "./validator.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));

async function checkDockerZeroResources() {
  const containers = execFileSync(
    "docker",
    ["ps", "-a", "--filter", "label=metamorph.target-worker=true", "--format", "{{.ID}}"],
    { encoding: "utf8" },
  ).trim();
  const volumes = execFileSync(
    "docker",
    ["volume", "ls", "--filter", "label=metamorph.target-worker=true", "--format", "{{.Name}}"],
    { encoding: "utf8" },
  ).trim();
  return {
    containersCount: containers ? containers.split("\n").filter(Boolean).length : 0,
    volumesCount: volumes ? volumes.split("\n").filter(Boolean).length : 0,
  };
}

async function runTrial(runtime, bundle, trialIndex, tierName, mockMode = null) {
  const worker = new TargetWorker(runtime, bundle, "real", { profile: WORKSHOP_PROFILE });
  let error = null;
  let cleanupError = null;
  let g1Observed = null;
  let provisionElapsed = 0;

  try {
    const provStarted = performance.now();
    await worker.provision();
    provisionElapsed = performance.now() - provStarted;
    g1Observed = observeBuild(worker, "workshop-business");

    if (mockMode === "timeout") {
      g1Observed = {
        build: {
          verdict: "ERROR",
          findingCodes: ["ENVIRONMENT_ERROR"],
          executedTestIds: ["workshop-business:typecheck"],
        },
        buildPhaseDiagnostics: { code: "BUILD_PHASE_TIMEOUT" },
      };
    } else if (mockMode === "fail") {
      g1Observed = {
        build: {
          verdict: "FAIL",
          findingCodes: ["BUILD_FAILED"],
          executedTestIds: ["workshop-business:typecheck"],
        },
        buildPhaseDiagnostics: null,
      };
    }
  } catch (err) {
    error = err.code ?? err.message?.split(":")[0] ?? "UNKNOWN_ERROR";
    try {
      g1Observed = observeBuild(worker, "workshop-business");
    } catch {}
  } finally {
    try {
      await worker.close();
      if (mockMode === "cleanup-fail") {
        throw new Error("CLEANUP_ERROR: simulated cleanup failure");
      }
    } catch (cleanupErr) {
      cleanupError = cleanupErr.code ?? cleanupErr.message?.split(":")[0] ?? "CLEANUP_ERROR";
      console.error(`Trial ${trialIndex} [${tierName}] cleanup fault: ${cleanupError}`);
    }
  }

  const zeroRes = await checkDockerZeroResources();
  if (mockMode === "leak") {
    zeroRes.containersCount = 1;
  }

  const buildReceipt = worker.evidence.build;
  let parsedChecks = null;
  try {
    if (buildReceipt?.stdout) {
      parsedChecks = JSON.parse(buildReceipt.stdout).checks;
    }
  } catch {}

  const rawRecord = {
    trialIndex,
    tier: tierName,
    provisionElapsedMs: provisionElapsed,
    dockerBuildCmdElapsedMs: buildReceipt?.elapsedMs ? Math.round(buildReceipt.elapsedMs) : null,
    buildExitCode: buildReceipt?.exitCode ?? (mockMode === "pass" ? 0 : mockMode ? 2 : null),
    buildSignal: buildReceipt?.signal ?? null,
    buildError: buildReceipt?.spawnError ?? null,
    buildTimedOut: buildReceipt?.timedOut ?? false,
    checks: parsedChecks,
    g1Verdict: g1Observed?.build?.verdict ?? (error ? "ERROR" : "UNKNOWN"),
    g1FindingCodes: g1Observed?.build?.findingCodes ?? [],
    executedTestIds: g1Observed?.build?.executedTestIds ?? [],
    sidecarCode: g1Observed?.buildPhaseDiagnostics?.code ?? null,
    cleanupVerified: mockMode === "cleanup-fail" ? false : worker.evidence.cleanupVerified,
    zeroResourcesVerified: zeroRes.containersCount === 0 && zeroRes.volumesCount === 0,
    error,
    cleanupError,
  };

  return sanitizeTrialRecord(rawRecord);
}

function runMockUnit(mode, trialsPerTier = 3) {
  const results = [];
  let trialCounter = 1;

  for (const tier of TIERS) {
    for (let i = 1; i <= trialsPerTier; i++) {
      const isFailing = mode !== "pass" && tier === "heavy" && i === 1;
      const trialMode = isFailing ? mode : "pass";

      const record = {
        trialIndex: trialCounter++,
        tier,
        provisionElapsedMs: 1200,
        dockerBuildCmdElapsedMs: 1100,
        typecheckDuration: "NOT_AVAILABLE_FROM_PRODUCTION_RECEIPT",
        buildDuration: "NOT_AVAILABLE_FROM_PRODUCTION_RECEIPT",
        buildExitCode: trialMode === "pass" ? 0 : 2,
        buildSignal: null,
        buildError: null,
        buildTimedOut: trialMode === "timeout",
        checks: [
          { phase: "typecheck", exitCode: 0, signal: null, error: null },
          {
            phase: "build",
            exitCode: trialMode === "pass" ? 0 : 2,
            signal: null,
            error: null,
          },
        ],
        g1Verdict: trialMode === "pass" ? "PASS" : trialMode === "fail" ? "FAIL" : "ERROR",
        g1FindingCodes: trialMode === "pass" ? [] : ["BUILD_FAILED"],
        executedTestIds:
          trialMode === "pass"
            ? ["workshop-business:typecheck", "workshop-business:build"]
            : ["workshop-business:typecheck"],
        sidecarCode: trialMode === "timeout" ? "BUILD_PHASE_TIMEOUT" : null,
        cleanupVerified: trialMode !== "cleanup-fail",
        zeroResourcesVerified: trialMode !== "leak",
        error: null,
        cleanupError: trialMode === "cleanup-fail" ? "CLEANUP_FAULT" : null,
      };

      results.push(sanitizeTrialRecord(record));
    }
  }

  const validation = validateBatchResults(results, trialsPerTier);
  const decision = classifyExperimentDecision(validation, true);

  return { results, validation, decision };
}

async function main() {
  const args = process.argv.slice(2);

  const mockUnitArg = args.find((a) => a.startsWith("--mock-unit="));
  if (mockUnitArg) {
    const mode = mockUnitArg.split("=")[1];
    const { results, validation, decision } = runMockUnit(mode);
    console.log(`Mock unit [${mode}] decision: ${decision}`);
    console.log("Validation passed:", validation.passed);
    if (!validation.passed && mode === "pass") {
      process.exit(1);
    }
    process.exit(0);
  }

  const trialsArg = args.find((a) => a.startsWith("--trials-per-tier="));
  const trialsPerTier = trialsArg ? Number.parseInt(trialsArg.split("=")[1], 10) : 3;
  assert.ok(trialsPerTier >= 1 && trialsPerTier <= 5, "Trials per tier must be between 1 and 5");

  const outArg = args.find((a) => a.startsWith("--out="));
  const outputPath = outArg
    ? resolve(outArg.split("=")[1])
    : join(root, "research/mmp-174/stress-results.json");

  console.log("=== MMP-174 Fail-Closed G1 Compiler Stress Qualification ===");

  const gitStatus = execFileSync("git", ["status", "--porcelain=v1"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  const headSha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  console.log("HEAD SHA:", headSha);
  console.log("Git Clean:", gitStatus.length === 0);

  console.log("\nBuilding trusted runtime...");
  const runtime = await buildTrustedRuntime();
  console.log("Trusted Runtime Image:", runtime.imageId);
  console.log("Runtime Recipe SHA:", runtime.provenance?.recipeSha);
  console.log("Expected RECIPE_PIN:", RECIPE_PIN);

  const recipeMatchesPin = runtime.provenance?.recipeSha === RECIPE_PIN;
  console.log("Recipe matches pin:", recipeMatchesPin);

  if (!recipeMatchesPin) {
    console.error("FATAL: Runtime recipeSha does not match committed RECIPE_PIN!");
    process.exit(1);
  }

  const workshopRoot = join(root, "packages/target-worker/fixtures/workshop");
  const tierBundles = {};
  for (const tier of TIERS) {
    console.log(`\nAdmitting tier: ${tier}...`);
    const bundle = buildTierBundle(tier, workshopRoot);
    tierBundles[tier] = bundle;
    console.log(
      `  Files: ${bundle.fileCount}, Total Bytes: ${bundle.totalBytes}, candidateSha: ${bundle.candidateSha}`,
    );
  }

  const results = [];
  let stopBatch = false;
  let trialCounter = 1;

  for (const tier of TIERS) {
    if (stopBatch) break;
    console.log(`\n=== TIER [${tier.toUpperCase()}]: ${trialsPerTier} TRIALS ===`);
    const bundle = tierBundles[tier];

    for (let i = 1; i <= trialsPerTier; i++) {
      if (stopBatch) break;
      const trialIndex = trialCounter++;
      console.log(`Starting trial ${trialIndex} (tier: ${tier}, run ${i}/${trialsPerTier})...`);
      const trialRecord = await runTrial(runtime, bundle, trialIndex, tier);
      console.log(
        `  Trial ${trialIndex} [${tier}]: G1=${trialRecord.g1Verdict}, dockerCmd=${trialRecord.dockerBuildCmdElapsedMs}ms, provision=${trialRecord.provisionElapsedMs}ms, clean=${trialRecord.cleanupVerified && trialRecord.zeroResourcesVerified}`,
      );
      results.push(trialRecord);

      if (!trialRecord.zeroResourcesVerified || trialRecord.cleanupError) {
        console.error(`ABORTING BATCH: cleanup failure on trial ${trialIndex} to prevent resource compounding.`);
        stopBatch = true;
      }
    }
  }

  const validation = validateBatchResults(results, trialsPerTier);
  const decision = classifyExperimentDecision(validation, recipeMatchesPin);

  const outputPayload = {
    format: "mmp174-g1-stress-v1",
    executedAt: new Date().toISOString(),
    headSha,
    environment: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      runnerOs: process.env.RUNNER_OS || process.platform,
      isHostedRunner: Boolean(process.env.GITHUB_ACTIONS),
      recipeMatchesPin,
    },
    runtimeImageId: runtime.imageId,
    runtimeRecipeSha: runtime.provenance?.recipeSha,
    expectedRecipePin: RECIPE_PIN,
    tierConfigs: Object.fromEntries(
      TIERS.map((tier) => [
        tier,
        {
          moduleCount: tierBundles[tier].moduleCount,
          fileCount: tierBundles[tier].fileCount,
          candidateSha: tierBundles[tier].candidateSha,
          totalBytes: tierBundles[tier].totalBytes,
          description: TIER_CONFIGS[tier].description,
        },
      ]),
    ),
    trialsPerTier,
    decision,
    validation,
    trials: results,
  };

  writeFileSync(outputPath, `${JSON.stringify(outputPayload, null, 2)}\n`, {
    mode: 0o644,
  });
  console.log(`\nSaved sanitized machine-readable stress results to ${outputPath}`);

  console.log(`\n=== QUALIFICATION DECISION: ${decision} ===`);
  console.log(`Passed: ${validation.passed}`);
  if (!validation.passed) {
    console.error("Failures:", JSON.stringify(validation.failures, null, 2));
    process.exit(1);
  }

  console.log("All stress qualification criteria met.");
  process.exit(0);
}

export { runMockUnit, runTrial, checkDockerZeroResources };

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((err) => {
    console.error("FATAL_STRESS_ERROR:", err.code ?? err.message?.split(":")[0] ?? "UNKNOWN");
    process.exit(1);
  });
}
