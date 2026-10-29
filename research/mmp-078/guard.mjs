import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateWorkflowIdentity, verifyHostedMetaPolicy } from "../../packages/agent-real/src/github-meta-guard.mjs";
const root = fileURLToPath(new URL("../../", import.meta.url));
const output = join(process.env.RUNNER_TEMP, "meta-paid-public");
mkdirSync(output, { recursive: true, mode: 0o700 });
let result;
try {
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  validateWorkflowIdentity(process.env, head, event.inputs, process.env.GITHUB_WORKFLOW_REF?.includes("meta-paid-migration.yml@"));
  result = await verifyHostedMetaPolicy(head);
} catch {
  result = { status: "BLOCKED", code: "GITHUB_POLICY_UNVERIFIED_OR_BLOCKED" };
  process.exitCode = 1;
}
writeFileSync(join(output, "policy.json"), JSON.stringify(result, null, 2) + "\n", { mode: 0o600 });
console.log(`META_POLICY ${result.status}`);
