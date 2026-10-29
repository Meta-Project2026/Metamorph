// Safe default CLI: diagnose admission; no credentials, POST or model execution.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { bindMigrationContext } from "../../packages/agent-real/src/migration-context.mjs";
import { runPublicMigration } from "../../packages/agent-real/src/migration-trial.mjs";
const root = fileURLToPath(new URL("../../", import.meta.url));
try {
  const [selection = "none", ...extra] = process.argv.slice(2);
  if (extra.length || !["none", "meta", "local"].includes(selection)) throw new Error("CONFIG_DENIED");
  const headSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const context = bindMigrationContext(readFileSync(new URL("./public-source.json", import.meta.url), "utf8"));
  const result = await runPublicMigration({ context, selection, root, headSha });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = 2; // NOT_RUN admission, never a successful migration.
} catch {
  console.log(JSON.stringify({ modelGeneration: "NOT_RUN", code: "INPUT_OR_ADMISSION_ERROR" }));
  process.exitCode = 2;
}
