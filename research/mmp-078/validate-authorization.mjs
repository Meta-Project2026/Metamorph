// Safe manual mode: real GitHub OIDC, no Meta credential read or provider/session.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { authorizePaidWorkflow, safePaidAdmissionCode } from "../../packages/agent-real/src/meta-paid-authorization.mjs";
import { bindMigrationContext } from "../../packages/agent-real/src/migration-context.mjs";
const root = fileURLToPath(new URL("../../", import.meta.url));
const output = join(process.env.RUNNER_TEMP, "meta-paid-public");
mkdirSync(output, { recursive: true, mode: 0o700 });
let result;
try {
  if (process.env.MODEL_API_KEY) throw Error();
  const context = bindMigrationContext(readFileSync(join(root, "research/mmp-061/public-source.json"), "utf8"));
  const authorization = await authorizePaidWorkflow(context);
  result = { status: "SIGNED_ADMISSION_VERIFIED_NO_CREDENTIAL", authorization,
    metaGetRequests: 0, metaPostRequests: 0, modelGeneration: "NOT_RUN", candidateSha: null, chargedCostUsd: null };
} catch (error) {
  result = { status: "BLOCKED", code: safePaidAdmissionCode(error), metaGetRequests: 0, metaPostRequests: 0, modelGeneration: "NOT_RUN", chargedCostUsd: null };
  process.exitCode = 1;
}
const pending = join(output, "authorization.json.pending");
writeFileSync(pending, JSON.stringify(result, null, 2) + "\n", { mode: 0o600, flush: true });
renameSync(pending, join(output, "authorization.json"));
console.log(`META_SIGNED_VALIDATION ${result.status}; Meta_GET=0; Meta_POST=0; credential=NOT_MAPPED`);
