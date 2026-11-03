// Always-run, credential-free workflow projection; no network or candidate reads.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  generationScorecard,
  repairExecutionStatus,
  repairScorecard,
} from "../../packages/agent-real/src/live-experiment.mjs";
import { commitPreflight } from "../../packages/agent-real/src/migration-preflight.mjs";
import { readPrivateJson } from "../../packages/agent-real/src/private-diagnostics.mjs";

export function recordScorecard(env) {
  if (env.MODEL_API_KEY) throw Error("CREDENTIAL_ISOLATION");
  const output = join(env.RUNNER_TEMP, "meta-paid-public");
  const read = (path) => {
    try { return readPrivateJson(path, 1024 * 1024, false).value; }
    catch (error) { if (error.code === "ENOENT") return null; throw error; }
  };
  const hasEntries = (path) => {
    try { return existsSync(path) && readdirSync(path).length > 0; }
    catch { return true; }
  };
  // The repair-executed verdict is bound across the signed plan card, the
  // digest-valid repair card and the repair receipt for this exact run; the
  // scorecard stays evidence and never grants spend authority or a retry.
  //
  // Attempt-2 evidence scan (trusted read-only producer, existsSync over
  // specific paths only — no file contents are published). Production stage
  // order is monotonic and every write is exclusive-create (wx/no-clobber):
  // reserve ledger -> pre-send receipt -> response receipt -> repair card ->
  // custody spool -> repair trial -> scorecard. Presence of ANY of these
  // while no confirmed receipt binds means the attempt state is unknown; it
  // may already have been billed and is never claimed unsent.
  const repairEvidencePresent =
    existsSync(join(output, "generation-repair.json")) ||
    existsSync(join(output, "preflight-repair.json")) ||
    existsSync(join(output, "trial-repair.json")) ||
    existsSync(
      join(env.RUNNER_TEMP, `mmp078-${env.GITHUB_RUN_ID}-attempt-2.json`),
    ) ||
    hasEntries(join(output, "repair-send-receipts")) ||
    hasEntries(join(env.RUNNER_TEMP, "mmp115-custody-repair"));
  const repairExecution = repairExecutionStatus({
    preflight: read(join(output, "preflight.json")),
    generation: read(join(output, "generation.json")),
    trial: read(join(output, "trial.json")),
    repairGeneration: read(join(output, "generation-repair.json")),
    repairPreflight: read(join(output, "preflight-repair.json")),
    repairEvidencePresent,
    runId: env.GITHUB_RUN_ID,
    headSha: env.GITHUB_SHA,
  });
  const scorecard = generationScorecard({
    preflight: read(join(output, "preflight.json")),
    generation: read(join(output, "generation.json")),
    trial: read(join(output, "trial.json")),
    stored: read(join(output, "custody-stored.json")),
    transport: read(join(env.RUNNER_TEMP, "mmp115-custody/transport.json")),
    finalizer: read(join(output, "finalizer.json")),
    runId: env.GITHUB_RUN_ID,
    headSha: env.GITHUB_SHA,
    repairExecution,
  });
  commitPreflight(join(output, "scorecard.json"), scorecard);
  // The signed two-attempt plan adds its own attempt-2 projection; the final
  // verdict stays per-trial and never grants product acceptance.
  if (existsSync(join(output, "trial-repair.json"))) {
    const repair = repairScorecard({
      preflight: read(join(output, "preflight-repair.json")),
      generation: read(join(output, "generation-repair.json")),
      trial: read(join(output, "trial-repair.json")),
      stored: read(join(output, "custody-repair-stored.json")),
      transport: read(join(env.RUNNER_TEMP, "mmp115-custody-repair/transport.json")),
      finalizer: read(join(output, "finalizer.json")),
      runId: env.GITHUB_RUN_ID,
      headSha: env.GITHUB_SHA,
      firstAttempt: {
        candidateSha: scorecard.candidateSha,
        headSha: scorecard.headSha,
        estimatedCostUsd: scorecard.observedEstimatedCostUsd,
      },
    });
    commitPreflight(join(output, "scorecard-repair.json"), repair);
  }
  return scorecard;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const scorecard = recordScorecard(process.env);
    console.log(`MMP154 ${scorecard.execution}; ${scorecard.outcome.status}; product=NOT_ESTABLISHED`);
  } catch {
    console.error("MMP154_SCORECARD_ERROR; no result established");
    process.exitCode = 1;
  }
}
