// Dedicated trusted step only: never invoke in a job that executes candidates.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { preflightMetaV2 } from "../../packages/agent-real/src/meta-preflight.mjs";
import { validateWorkflowIdentity } from "../../packages/agent-real/src/github-meta-guard.mjs";
const root = fileURLToPath(new URL("../../", import.meta.url));
try {
  const headSha = execFileSync("git", ["rev-parse", "HEAD"], {cwd: root, encoding: "utf8"}).trim();
  validateWorkflowIdentity(process.env, headSha, {reviewed_sha: process.env.REVIEWED_SHA});
  if (process.env.GITHUB_EVENT_NAME !== "workflow_dispatch" ||
      process.env.GITHUB_REPOSITORY !== "Meta-Project2026/Metamorph" ||
      process.env.GITHUB_REF !== "refs/heads/main" ||
      !/^[a-f0-9]{40}$/.test(headSha) || headSha !== process.env.GITHUB_SHA ||
      headSha !== process.env.REVIEWED_SHA || !process.env.RUNNER_TEMP) throw Error();
  const shutdown = new AbortController();
  const stop = () => shutdown.abort();
  process.on("SIGTERM", stop); process.on("SIGINT", stop);
  let receipt;
  try { receipt = await preflightMetaV2({signal: shutdown.signal}); }
  finally { process.removeListener("SIGTERM", stop); process.removeListener("SIGINT", stop); }
  const output = join(process.env.RUNNER_TEMP, "meta-preflight-public");
  mkdirSync(output, {recursive: true, mode: 0o700});
  writeFileSync(join(output, "meta-preflight.json"), JSON.stringify({...receipt, headSha}, null, 2) + "\n", {mode: 0o600});
  console.log(`META_PREFLIGHT ${receipt.status} ${receipt.code}; credentialPresent=${receipt.credentialPresent}; attempts=${receipt.attemptedRequests}; generation=0`);
  process.exitCode = receipt.status === "PASS" ? 0 : 2;
} catch {
  console.error("META_PREFLIGHT_ENTRYPOINT_ERROR"); process.exitCode = 1;
}
