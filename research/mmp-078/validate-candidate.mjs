// Fresh process/step with no MODEL_API_KEY. Candidate only executes inside Docker.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { bindMigrationContext } from "../../packages/agent-real/src/migration-context.mjs";
import { validateGeneratedMigration } from "../../packages/agent-real/src/migration-trial.mjs";
const root = fileURLToPath(new URL("../../", import.meta.url));
const output = join(process.env.RUNNER_TEMP, "meta-paid-public");
try {
  if (process.env.MODEL_API_KEY) throw Error();
  const trial = JSON.parse(readFileSync(join(output, "trial.json"), "utf8"));
  const transfer = JSON.parse(readFileSync(join(process.env.RUNNER_TEMP, "meta-paid-private/transfer.json"), "utf8"));
  if (trial.modelGeneration !== "GENERATED" || trial.candidateSha !== transfer.candidateSha || trial.headSha !== process.env.GITHUB_SHA) throw Error();
  const parent = join(process.env.RUNNER_TEMP, "meta-paid-verification");
  mkdirSync(parent, { mode: 0o700 });
  const context = bindMigrationContext(readFileSync(join(root, "research/mmp-061/public-source.json"), "utf8"));
  const shutdown = new AbortController();
  const stop = () => shutdown.abort();
  process.on("SIGTERM", stop); process.on("SIGINT", stop);
  let result;
  try { result = await validateGeneratedMigration({ context, root, parent, headSha: trial.headSha, ...transfer, signal: shutdown.signal }); }
  finally { process.removeListener("SIGTERM", stop); process.removeListener("SIGINT", stop); }
  writeFileSync(join(output, "trial.json"), JSON.stringify({ ...trial, ...result }, null, 2) + "\n", { mode: 0o600 });
  if (!["publicG1", "publicG2", "publicG3"].every((g) => result[g] === "PASS") || result.cleanup.status !== "VERIFIED_ZERO_RESOURCES") process.exitCode = 1;
  console.log(`META_PUBLIC_DOCKER G1=${result.publicG1} G2=${result.publicG2} G3=${result.publicG3}; product=NOT_ESTABLISHED`);
} catch {
  console.error("META_PUBLIC_DOCKER_ERROR; inspect sanitized trial, validation pending"); process.exitCode = 1;
}
