import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { TargetWorker } from "../../packages/target-worker/src/controller.mjs";
import { buildTrustedRuntime } from "../../packages/target-worker/src/runtime-broker.mjs";
import { admitDirectory } from "../../packages/target-worker/src/admission.mjs";
import { WORKSHOP_CANDIDATE_SHA } from "../../packages/differential/src/workshop-policy.mjs";
import { WORKSHOP_PROFILE } from "../../packages/target-worker/runtime/profile.mjs";
import { observeBuild } from "../../packages/agent-real/src/runtime.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));

async function checkDockerZeroResources() {
  const containers = execFileSync("docker", [
    "ps", "-a", "--filter", "label=metamorph.target-worker=true", "--format", "{{.ID}}"
  ], { encoding: "utf8" }).trim();
  const volumes = execFileSync("docker", [
    "volume", "ls", "--filter", "label=metamorph.target-worker=true", "--format", "{{.Name}}"
  ], { encoding: "utf8" }).trim();
  return {
    containersCount: containers ? containers.split("\n").filter(Boolean).length : 0,
    volumesCount: volumes ? volumes.split("\n").filter(Boolean).length : 0,
  };
}

async function runTrial(runtime, bundle, trialIndex, mode) {
  const worker = new TargetWorker(runtime, bundle, "real", { profile: WORKSHOP_PROFILE });
  let error = null;
  let g1Observed = null;
  const started = performance.now();
  let provisionElapsed = 0;
  try {
    const provStarted = performance.now();
    await worker.provision();
    provisionElapsed = performance.now() - provStarted;
    g1Observed = observeBuild(worker, "workshop-business");
  } catch (err) {
    error = err;
    try {
      g1Observed = observeBuild(worker, "workshop-business");
    } catch {}
  } finally {
    try {
      await worker.close();
    } catch (cleanupErr) {
      console.error(`Trial ${trialIndex} cleanup error:`, cleanupErr);
    }
  }
  const totalElapsed = performance.now() - started;
  const zeroRes = await checkDockerZeroResources();
  const buildReceipt = worker.evidence.build;
  let parsedChecks = null;
  try {
    if (buildReceipt?.stdout) {
      parsedChecks = JSON.parse(buildReceipt.stdout).checks;
    }
  } catch {}

  const typecheckCheck = parsedChecks?.[0] ?? null;
  const buildCheck = parsedChecks?.[1] ?? null;

  return {
    trialIndex,
    mode,
    provisionElapsedMs: Math.round(provisionElapsed),
    dockerBuildCmdElapsedMs: buildReceipt?.elapsedMs ? Math.round(buildReceipt.elapsedMs) : null,
    typecheckElapsedMs: typecheckCheck?.elapsedMs ?? null,
    buildElapsedMs: buildCheck?.elapsedMs ?? null,
    typecheckExitCode: typecheckCheck?.exitCode ?? null,
    typecheckSignal: typecheckCheck?.signal ?? null,
    typecheckError: typecheckCheck?.error ?? null,
    buildExitCode: buildCheck?.exitCode ?? null,
    buildSignal: buildCheck?.signal ?? null,
    buildError: buildCheck?.error ?? null,
    buildTimedOut: buildReceipt?.timedOut ?? false,
    g1Verdict: g1Observed?.build?.verdict ?? (error ? "ERROR" : "UNKNOWN"),
    g1FindingCodes: g1Observed?.build?.findingCodes ?? [],
    executedTestIds: g1Observed?.build?.executedTestIds ?? [],
    sidecarCode: g1Observed?.buildPhaseDiagnostics?.code ?? null,
    cleanupVerified: worker.evidence.cleanupVerified,
    zeroResourcesVerified: zeroRes.containersCount === 0 && zeroRes.volumesCount === 0,
    error: error?.message ?? null,
  };
}

async function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function main() {
  console.log("=== MMP-167 G1 Live Qualification Harness ===");
  const headSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  console.log("HEAD SHA:", headSha);

  console.log("Building trusted runtime...");
  const runtime = await buildTrustedRuntime();
  console.log("Trusted Runtime Image:", runtime.imageId);
  console.log("Admitting workshop fixture...");
  const bundle = await admitDirectory(
    join(root, "packages/target-worker/fixtures/workshop"),
    WORKSHOP_CANDIDATE_SHA
  );
  console.log("Admitted candidateSha:", bundle.candidateSha);

  const results = [];

  console.log("\n=== 5 COLD TRIALS (fresh container invocation with pause) ===");
  for (let i = 1; i <= 5; i++) {
    if (i > 1) {
      await sleep(3000);
    }
    console.log(`Starting cold trial ${i}...`);
    const res = await runTrial(runtime, bundle, i, "cold");
    console.log(`Cold ${i}: G1=${res.g1Verdict}, typecheck=${res.typecheckElapsedMs}ms, build=${res.buildElapsedMs}ms, dockerCmd=${res.dockerBuildCmdElapsedMs}ms, clean=${res.zeroResourcesVerified}`);
    results.push(res);
  }

  console.log("\n=== 5 WARM TRIALS (back-to-back sequential) ===");
  for (let i = 1; i <= 5; i++) {
    console.log(`Starting warm trial ${i}...`);
    const res = await runTrial(runtime, bundle, i + 5, "warm");
    console.log(`Warm ${i}: G1=${res.g1Verdict}, typecheck=${res.typecheckElapsedMs}ms, build=${res.buildElapsedMs}ms, dockerCmd=${res.dockerBuildCmdElapsedMs}ms, clean=${res.zeroResourcesVerified}`);
    results.push(res);
  }

  console.log("\n=== SUMMARY TABLE ===");
  console.log(JSON.stringify(results, null, 2));
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
