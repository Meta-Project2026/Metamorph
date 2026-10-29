// Manual trusted-host entrypoint. No provider/key/budget overrides, no replay input.
// Exit 2 means verified missing admission; any other failure exits 1.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bindMigrationContext } from "../../packages/agent-real/src/migration-context.mjs";
import { runPublicMigration } from "../../packages/agent-real/src/migration-trial.mjs";
import { atomicJson } from "../../packages/differential/src/private-run.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
let output;
try {
  const [selection = "none", ...extra] = process.argv.slice(2);
  if (extra.length || !["none", "meta", "local"].includes(selection)) throw Error();
  output = process.env.MMP061_PUBLIC_OUTPUT;
  if (!output || !isAbsolute(output)) throw Error();
  const headSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  if (!/^[a-f0-9]{40}$/.test(headSha) || headSha !== process.env.AGENT_HEAD_SHA) throw Error();
  const context = bindMigrationContext(readFileSync(new URL("./public-source.json", import.meta.url), "utf8"));
  const result = await runPublicMigration({ context, selection, root, headSha });
  // Do not reinterpret arbitrary failures, partial generation or missing evidence
  // as a harmless skip. This runner is admission-only until the reviewed adapter,
  // exact trial configuration and correlated live receipts are implemented.
  const notRun = result.modelGeneration === "NOT_RUN" &&
    result.aiGeneration === "AI_GENERATION_NOT_RUN" &&
    result.budgetAuth === "NOT_ADMITTED" && result.generatedRequests === 0 &&
    result.candidateSha === null && result.attempts.length === 0 &&
    result.cleanup.status === "NOT_RUN" && result.blockers.length === 1 &&
    ["MISSING_PROVIDER", "BILLING_CAP_NOT_ESTABLISHED", "LOCAL_RUNTIME_AND_BILLING_CONTRACT_REQUIRED"].includes(result.blockers[0]);
  if (!notRun) throw Error();
  const workflowRunUrl = /^\d+$/.test(process.env.GITHUB_RUN_ID ?? "") &&
    process.env.GITHUB_REPOSITORY === "Meta-Project2026/Metamorph"
    ? `https://github.com/Meta-Project2026/Metamorph/actions/runs/${process.env.GITHUB_RUN_ID}` : null;
  mkdirSync(output, { recursive: true });
  atomicJson(join(output, "trial.json"), {
    ...result,
    workflowRunUrl,
    modelTrialRunUrl: null,
    execution: "ADMISSION_ONLY",
    oracleControls: "SEPARATE_REPLAY_CONTROL_ARTIFACT",
  }, 0o644);
  console.log(`AI_GENERATION_NOT_RUN code=${result.blockers[0]}; requests=0; model candidate absent.`);
  process.exitCode = 2;
} catch {
  // Do not print provider errors, environment values or arbitrary source bytes.
  console.error("MMP061_WORKFLOW_ERROR");
  process.exitCode = 1;
}
