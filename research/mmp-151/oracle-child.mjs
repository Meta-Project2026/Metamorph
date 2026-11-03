// Trusted, credential-free process. Candidate code executes only in Docker.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { bindMigrationContext } from "../../packages/agent-real/src/migration-context.mjs";
import { validateGeneratedMigration } from "../../packages/agent-real/src/migration-trial.mjs";
import { requireDedicatedDaemon } from "./daemon-boundary.mjs";
const root = fileURLToPath(new URL("../../", import.meta.url));
const stop = new AbortController();
process.on("SIGTERM", () => stop.abort());
process.on("SIGINT", () => stop.abort());
try {
  if (process.platform !== "linux" || process.env.MODEL_API_KEY || process.env.GH_TOKEN) throw Error();
  await requireDedicatedDaemon();
  const options = JSON.parse(readFileSync(process.argv[2], "utf8"));
  const context = bindMigrationContext(readFileSync(new URL("../mmp-061/public-source.json", import.meta.url), "utf8"));
  const result = await validateGeneratedMigration({ ...options, context, root, signal: stop.signal });
  writeFileSync(process.argv[3], JSON.stringify(result), { flag: "wx", mode: 0o600, flush: true });
} catch { process.stderr.write("SYNTHETIC_ORACLE_CHILD_ERROR\n"); process.exitCode = 1; }
