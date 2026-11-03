// Always-run, credential-free workflow projection; no network or candidate reads.
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { generationScorecard } from "../../packages/agent-real/src/live-experiment.mjs";
import { commitPreflight } from "../../packages/agent-real/src/migration-preflight.mjs";
import { readPrivateJson } from "../../packages/agent-real/src/private-diagnostics.mjs";

export function recordScorecard(env) {
  if (env.MODEL_API_KEY) throw Error("CREDENTIAL_ISOLATION");
  const output = join(env.RUNNER_TEMP, "meta-paid-public");
  const read = (path) => {
    try { return readPrivateJson(path, 1024 * 1024, false).value; }
    catch (error) { if (error.code === "ENOENT") return null; throw error; }
  };
  const scorecard = generationScorecard({
    preflight: read(join(output, "preflight.json")),
    generation: read(join(output, "generation.json")),
    trial: read(join(output, "trial.json")),
    stored: read(join(output, "custody-stored.json")),
    transport: read(join(env.RUNNER_TEMP, "mmp115-custody/transport.json")),
    finalizer: read(join(output, "finalizer.json")),
    runId: env.GITHUB_RUN_ID,
    headSha: env.GITHUB_SHA,
  });
  commitPreflight(join(output, "scorecard.json"), scorecard);
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
