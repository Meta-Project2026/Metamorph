// Fresh process/step with no MODEL_API_KEY. Candidate only executes inside Docker.
// Attempt 2 (repair) validates the repaired candidate from its own custody chain.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { bindMigrationContext } from "../../packages/agent-real/src/migration-context.mjs";
import { validateCustodiedMigration } from "../../packages/agent-real/src/migration-trial.mjs";
import { requireStoredCheckpoint } from "../../packages/agent-real/src/custody-checkpoint.mjs";
import { publicTrialOutcome } from "../../packages/agent-real/src/live-experiment.mjs";
const root = fileURLToPath(new URL("../../", import.meta.url));
const attempt = process.argv[2] === "repair" ? 2 : 1;
const suffix = attempt === 2 ? "-repair" : "";
const output = join(process.env.RUNNER_TEMP, "meta-paid-public");
const privateRoot = join(process.env.RUNNER_TEMP, "meta-paid-private");
try {
  if (process.env.MODEL_API_KEY) throw Error();
  const trial = JSON.parse(readFileSync(join(output, `trial${suffix}.json`), "utf8"));
  const transfer = JSON.parse(readFileSync(join(privateRoot, `transfer${suffix}.json`), "utf8"));
  if (trial.modelGeneration !== "GENERATED" || trial.candidateSha !== transfer.candidateSha || trial.headSha !== process.env.GITHUB_SHA) throw Error();
  const permit = requireStoredCheckpoint(process.env, { candidateSha: transfer.candidateSha, sourceSha: trial.sourceSha, attemptId: trial.custody?.identity?.attemptId }, attempt);
  const parent = join(process.env.RUNNER_TEMP, attempt === 2 ? "meta-paid-verification-repair" : "meta-paid-verification");
  mkdirSync(parent, { mode: 0o700 });
  const context = bindMigrationContext(readFileSync(join(root, "research/mmp-061/public-source.json"), "utf8"));
  const shutdown = new AbortController();
  const stop = () => shutdown.abort();
  process.on("SIGTERM", stop); process.on("SIGINT", stop);
  let result;
  try { result = await validateCustodiedMigration({ context, root, parent, headSha: trial.headSha, ...transfer, signal: shutdown.signal }, permit); }
  finally { process.removeListener("SIGTERM", stop); process.removeListener("SIGINT", stop); }
  const validationOutcome = publicTrialOutcome(result);
  writeFileSync(join(output, `trial${suffix}.json`), JSON.stringify({ ...trial, ...result, validationOutcome }, null, 2) + "\n", { mode: 0o600 });
  // Exit 0 means a complete comparison, including a genuine public FAIL. The
  // explicit verdict remains FAIL; no migration PASS or repair permit is minted.
  if (!validationOutcome.complete) process.exitCode = 1;
  console.log(`META_PUBLIC_DOCKER ${validationOutcome.status}; G1=${result.publicG1} G2=${result.publicG2} G3=${result.publicG3}; product=NOT_ESTABLISHED`);
} catch {
  console.error("META_PUBLIC_DOCKER_ERROR; inspect sanitized trial, validation pending"); process.exitCode = 1;
}
