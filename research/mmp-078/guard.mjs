import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateWorkflowIdentity, verifyHostedMetaPolicy } from "../../packages/agent-real/src/github-meta-guard.mjs";
import { G1_RECOVERY_MODE } from "../../packages/agent-real/src/g1-repair-eligibility.mjs";
const root = fileURLToPath(new URL("../../", import.meta.url));
const output = join(process.env.RUNNER_TEMP, "meta-paid-public");
mkdirSync(output, { recursive: true, mode: 0o700 });
let result;
try {
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  validateWorkflowIdentity(process.env, head, event.inputs, process.env.GITHUB_WORKFLOW_REF?.includes("meta-paid-migration.yml@"));
  result = await verifyHostedMetaPolicy(head);
  if (event.inputs.execution_mode === G1_RECOVERY_MODE) result = {
    ...result, format: "mmp180-workflow-policy-v2", executionMode: G1_RECOVERY_MODE,
    maximumPosts: 2, maximumRepairs: 1, automaticRetries: 0, allowedRepairKinds: ["G1_BUILD_RECOVERABLE"],
  };
} catch (error) {
  result = { status: "BLOCKED", code: ["BLOCKED_BUDGET_GUARANTEE", "MIGRATION_MODE_BLOCKED"].includes(error?.code) ? error.code : "GITHUB_POLICY_UNVERIFIED_OR_BLOCKED" };
  process.exitCode = 1;
}
writeFileSync(join(output, "policy.json"), JSON.stringify(result, null, 2) + "\n", { mode: 0o600 });
console.log(`META_POLICY ${result.status}`);
