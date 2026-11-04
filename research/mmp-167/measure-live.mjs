import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { TargetWorker } from "../../packages/target-worker/src/controller.mjs";
import { buildTrustedRuntime } from "../../packages/target-worker/src/runtime-broker.mjs";
import { admitDirectory } from "../../packages/target-worker/src/admission.mjs";
import { WORKSHOP_CANDIDATE_SHA } from "../../packages/differential/src/workshop-policy.mjs";
import { WORKSHOP_PROFILE } from "../../packages/target-worker/runtime/profile.mjs";
import { observeBuild } from "../../packages/agent-real/src/runtime.mjs";
import { validateBatchResults } from "./harness-validator.mjs";

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

async function runTrial(runtime, bundle, trialIndex, mode, mockFailMode = null) {
  const worker = new TargetWorker(runtime, bundle, "real", { profile: WORKSHOP_PROFILE });
  let error = null;
  let cleanupError = null;
  let g1Observed = null;
  const started = performance.now();
  let provisionElapsed = 0;

  try {
    const provStarted = performance.now();
    await worker.provision();
    provisionElapsed = performance.now() - provStarted;
    g1Observed = observeBuild(worker, "workshop-business");

    if (mockFailMode === "g1-error") {
      g1Observed = {
        build: {
          verdict: "ERROR",
          findingCodes: ["ENVIRONMENT_ERROR"],
          executedTestIds: ["workshop-business:typecheck"],
        },
        buildPhaseDiagnostics: { code: "BUILD_PHASE_TIMEOUT" },
      };
    }
  } catch (err) {
    error = err.code ?? err.message.split(":")[0];
    try {
      g1Observed = observeBuild(worker, "workshop-business");
    } catch {}
  } finally {
    try {
      await worker.close();
      if (mockFailMode === "cleanup-failure") {
        throw new Error("CLEANUP_ERROR: simulated failure");
      }
    } catch (cleanupErr) {
      cleanupError = cleanupErr.code ?? cleanupErr.message.split(":")[0];
      console.error(`Trial ${trialIndex} cleanup fault: ${cleanupError}`);
    }
  }

  const zeroRes = await checkDockerZeroResources();
  if (mockFailMode === "resource-leak") {
    zeroRes.containersCount = 1;
  }

  const buildReceipt = worker.evidence.build;
  let parsedChecks = null;
  try {
    if (buildReceipt?.stdout) {
      parsedChecks = JSON.parse(buildReceipt.stdout).checks;
    }
  } catch {}

  return {
    trialIndex,
    mode,
    provisionElapsedMs: Math.round(provisionElapsed),
    dockerBuildCmdElapsedMs: buildReceipt?.elapsedMs ? Math.round(buildReceipt.elapsedMs) : null,
    // Production recipe does not emit per-phase elapsedMs; explicitly marked as unavailable
    typecheckDuration: "NOT_AVAILABLE_FROM_PRODUCTION_RECEIPT",
    buildDuration: "NOT_AVAILABLE_FROM_PRODUCTION_RECEIPT",
    buildExitCode: buildReceipt?.exitCode ?? null,
    buildSignal: buildReceipt?.signal ?? null,
    buildError: buildReceipt?.spawnError ?? null,
    buildTimedOut: buildReceipt?.timedOut ?? false,
    checks: parsedChecks,
    g1Verdict: g1Observed?.build?.verdict ?? (error ? "ERROR" : "UNKNOWN"),
    g1FindingCodes: g1Observed?.build?.findingCodes ?? [],
    executedTestIds: g1Observed?.build?.executedTestIds ?? [],
    sidecarCode: g1Observed?.buildPhaseDiagnostics?.code ?? null,
    cleanupVerified: mockFailMode === "cleanup-failure" ? false : worker.evidence.cleanupVerified,
    zeroResourcesVerified: zeroRes.containersCount === 0 && zeroRes.volumesCount === 0,
    error,
    cleanupError,
  };
}

async function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function main() {
  const args = process.argv.slice(2);

  // Fast deterministic CLI test seam without Docker execution
  const mockUnitArg = args.find((a) => a.startsWith("--mock-unit="));
  if (mockUnitArg) {
    const mode = mockUnitArg.split("=")[1];
    const results = [
      {
        trialIndex: 1,
        mode: "mock-unit",
        provisionElapsedMs: 100,
        dockerBuildCmdElapsedMs: 80,
        typecheckDuration: "NOT_AVAILABLE_FROM_PRODUCTION_RECEIPT",
        buildDuration: "NOT_AVAILABLE_FROM_PRODUCTION_RECEIPT",
        buildExitCode: mode === "pass" ? 0 : 2,
        buildSignal: null,
        buildError: null,
        buildTimedOut: false,
        checks: [
          { phase: "typecheck", exitCode: 0, signal: null, error: null, stdout: "", stderr: "" },
          {
            phase: "build",
            exitCode: mode === "pass" ? 0 : 2,
            signal: null,
            error: null,
            stdout: "",
            stderr: "",
          },
        ],
        g1Verdict: mode === "pass" ? "PASS" : "ERROR",
        g1FindingCodes: mode === "pass" ? [] : ["BUILD_FAILED"],
        executedTestIds:
          mode === "pass"
            ? ["workshop-business:typecheck", "workshop-business:build"]
            : ["workshop-business:typecheck"],
        sidecarCode: null,
        cleanupVerified: mode === "pass",
        zeroResourcesVerified: true,
        error: null,
        cleanupError: null,
      },
    ];
    const validation = validateBatchResults(results, 1);
    if (!validation.passed) {
      console.error("\n*** QUALIFICATION FAILED (FAIL-CLOSED) ***");
      console.error(JSON.stringify(validation.failures, null, 2));
      process.exit(1);
    }
    console.log("\n*** QUALIFICATION PASSED (ALL CRITERIA MET) ***");
    process.exit(0);
  }

  const mockFailArg = args.find((a) => a.startsWith("--mock-fail="));
  const mockFailMode = mockFailArg ? mockFailArg.split("=")[1] : null;

  const trialsArg = args.find((a) => a.startsWith("--trials="));
  const totalTrials = trialsArg ? Number.parseInt(trialsArg.split("=")[1], 10) : 10;
  assert.ok(totalTrials >= 2, "Minimum 2 trials required");
  const freshCount = Math.floor(totalTrials / 2);
  const warmCount = totalTrials - freshCount;

  console.log("=== MMP-167 Fail-Closed G1 Live Qualification Harness ===");
  const headSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  console.log("HEAD SHA:", headSha);

  console.log("Building trusted runtime...");
  const runtime = await buildTrustedRuntime();
  console.log("Trusted Runtime Image:", runtime.imageId);
  console.log("Runtime Recipe SHA:", runtime.provenance?.recipeSha);

  console.log("Admitting workshop fixture...");
  const bundle = await admitDirectory(
    join(root, "packages/target-worker/fixtures/workshop"),
    WORKSHOP_CANDIDATE_SHA,
  );
  console.log("Admitted candidateSha:", bundle.candidateSha);

  const results = [];
  let stopBatch = false;

  console.log(`\n=== BATCH 1: ${freshCount} FRESH-CONTAINER / REPEATED-IMAGE TRIALS ===`);
  for (let i = 1; i <= freshCount; i++) {
    if (stopBatch) break;
    if (i > 1) {
      await sleep(3000);
    }
    console.log(`Starting fresh-container trial ${i}...`);
    const mock = i === 1 ? mockFailMode : null;
    const res = await runTrial(runtime, bundle, i, "fresh-container/repeated-image", mock);
    console.log(
      `Trial ${i} [fresh]: G1=${res.g1Verdict}, dockerCmd=${res.dockerBuildCmdElapsedMs}ms, provision=${res.provisionElapsedMs}ms, clean=${res.cleanupVerified && res.zeroResourcesVerified}`,
    );
    results.push(res);
    if (!res.zeroResourcesVerified || res.cleanupError) {
      console.error(`ABORTING BATCH: cleanup failure on trial ${i} to prevent compounding leaks.`);
      stopBatch = true;
    }
  }

  console.log(`\n=== BATCH 2: ${warmCount} BACK-TO-BACK WARM-CONTAINER TRIALS ===`);
  for (let i = 1; i <= warmCount; i++) {
    if (stopBatch) break;
    const trialIndex = freshCount + i;
    console.log(`Starting warm-container trial ${trialIndex}...`);
    const res = await runTrial(runtime, bundle, trialIndex, "back-to-back-warm-container", null);
    console.log(
      `Trial ${trialIndex} [warm]: G1=${res.g1Verdict}, dockerCmd=${res.dockerBuildCmdElapsedMs}ms, provision=${res.provisionElapsedMs}ms, clean=${res.cleanupVerified && res.zeroResourcesVerified}`,
    );
    results.push(res);
    if (!res.zeroResourcesVerified || res.cleanupError) {
      console.error(`ABORTING BATCH: cleanup failure on trial ${trialIndex} to prevent compounding leaks.`);
      stopBatch = true;
    }
  }

  const validation = validateBatchResults(results, totalTrials);

  const outputPayload = {
    format: "mmp167-g1-qualification-v1",
    executedAt: new Date().toISOString(),
    headSha,
    runtimeImageId: runtime.imageId,
    runtimeRecipeSha: runtime.provenance?.recipeSha,
    candidateSha: bundle.candidateSha,
    totalTrials,
    freshContainerTrials: freshCount,
    warmContainerTrials: warmCount,
    validation,
    trials: results,
  };

  const outputPath = join(root, "research/mmp-167/qualification-results.json");
  writeFileSync(outputPath, `${JSON.stringify(outputPayload, null, 2)}\n`, {
    mode: 0o644,
  });
  console.log(`Saved machine-readable qualification results to ${outputPath}`);

  if (!validation.passed) {
    console.error("\n*** QUALIFICATION FAILED (FAIL-CLOSED) ***");
    console.error(`Passed: ${validation.summary.passed}/${validation.summary.expected}`);
    console.error(`Failed: ${validation.summary.failed}/${validation.summary.expected}`);
    console.error("Failures:", JSON.stringify(validation.failures, null, 2));
    process.exit(1);
  }

  console.log("\n*** QUALIFICATION PASSED (ALL CRITERIA MET) ***");
  console.log(`All ${validation.summary.passed}/${validation.summary.expected} trials passed fail-closed validation.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("FATAL_HARNESS_ERROR:", err.code ?? err.message.split(":")[0]);
  process.exit(1);
});
