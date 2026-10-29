// Network step only: installed/built trusted code, no tests/build/Docker here.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { authorizePaidWorkflow, safePaidAdmissionCode } from "../../packages/agent-real/src/meta-paid-authorization.mjs";
import { bindMigrationContext } from "../../packages/agent-real/src/migration-context.mjs";
import { runPublicMigration } from "../../packages/agent-real/src/migration-trial.mjs";
const root = fileURLToPath(new URL("../../", import.meta.url));
const output = join(process.env.RUNNER_TEMP, "meta-paid-public");
const privateRoot = join(process.env.RUNNER_TEMP, "meta-paid-private");
mkdirSync(output, { recursive: true, mode: 0o700 });
mkdirSync(privateRoot, { recursive: true, mode: 0o700 });
const save = (name, value) => {
  const pending = join(output, `${name}.pending`);
  writeFileSync(pending, JSON.stringify(value, null, 2) + "\n", { mode: 0o600, flush: true });
  renameSync(pending, join(output, name));
};
const shutdown = new AbortController();
const stop = () => shutdown.abort();
process.on("SIGTERM", stop); process.on("SIGINT", stop);
let result;
try {
  const context = bindMigrationContext(readFileSync(join(root, "research/mmp-061/public-source.json"), "utf8"));
  const authorization = await authorizePaidWorkflow(context);
  result = await runPublicMigration({ context, selection: "meta", headSha: authorization.headSha,
    parent: privateRoot, signal: shutdown.signal, authorization,
    checkpoint: (receipt) => save("generation.json", receipt),
  });
  save("trial.json", result);
  if (result.modelGeneration !== "GENERATED") { process.exitCode = 1; }
  else {
    writeFileSync(join(privateRoot, "transfer.json"), JSON.stringify({ candidateRoot: result.candidateRoot, candidateSha: result.candidateSha }), { mode: 0o600 });
  }
  console.log(`META_PAID ${result.modelGeneration}; attempts=${result.generatedRequests}; charged=UNKNOWN`);
} catch (error) {
  save("trial.json", result ? { ...result, blockers: ["POST_GENERATION_TRANSFER_OR_RECEIPT_ERROR"] } : { modelGeneration: "BLOCKED", code: safePaidAdmissionCode(error), publicG1: "NOT_RUN", publicG2: "NOT_RUN", publicG3: "NOT_RUN", G0: "INCONCLUSIVE", G4: "INCONCLUSIVE", product: "NOT_ESTABLISHED", chargedCostUsd: null });
  console.error("META_PAID_BLOCKED"); process.exitCode = 1;
} finally {
  process.removeListener("SIGTERM", stop); process.removeListener("SIGINT", stop);
}
