// Network step only: installed/built trusted code, no tests/build/Docker here.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { authorizePaidWorkflow, safePaidAdmissionCode } from "../../packages/agent-real/src/meta-paid-authorization.mjs";
import { paidPreflight } from "../../packages/agent-real/src/meta-paid-authorization.mjs";
import { commitPreflight } from "../../packages/agent-real/src/migration-preflight.mjs";
import { bindMigrationContext } from "../../packages/agent-real/src/migration-context.mjs";
import { runPublicMigration } from "../../packages/agent-real/src/migration-trial.mjs";
import {
  custodyReadiness,
  CUSTODY_READINESS,
} from "../../packages/agent-real/src/custody-readiness.mjs";
import { DIAGNOSTIC_POLICY } from "../../packages/agent-real/src/private-diagnostics.mjs";
const root = fileURLToPath(new URL("../../", import.meta.url));
const output = join(process.env.RUNNER_TEMP, "meta-paid-public");
const privateRoot = join(process.env.RUNNER_TEMP, "meta-paid-private");
const receiptRoot = join(output, "send-receipts");
mkdirSync(output, { recursive: true, mode: 0o700 });
mkdirSync(privateRoot, { recursive: true, mode: 0o700 });
mkdirSync(receiptRoot, { mode: 0o700 });
let receiptSequence = 0;
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
  // Credential-free custody readiness BEFORE any paid send: an environment
  // that cannot encrypt/store the candidate must not cost a generation.
  // Read-only checks (pinned age tool hash, worker file, Docker daemon and
  // pinned encryptor image); the verdict grants nothing by itself.
  const readiness = await custodyReadiness({
    agePath: join(process.env.RUNNER_TEMP, "mmp089-tools/age"),
    workerPath: join(root, "research/mmp-089/encrypt-worker.mjs"),
    image: DIAGNOSTIC_POLICY.image,
    expectedAgeSha256: DIAGNOSTIC_POLICY.ageSha256,
  });
  if (readiness !== "READY") {
    throw Object.assign(new Error(readiness), { code: readiness });
  }
  // The signed two-attempt plan reserves BOTH sends (generation + bounded
  // repair projection) before the first POST; the POST itself is unchanged.
  const mode = process.env.MMP158_EXECUTION_MODE === "generate_then_repair" ? "generate_then_repair" : "single_generation";
  const authorization = await authorizePaidWorkflow(context, mode === "generate_then_repair" ? { plan: mode } : undefined);
  commitPreflight(join(output, "preflight.json"), paidPreflight(authorization, context));
  result = await runPublicMigration({ context, selection: "meta", headSha: authorization.headSha,
    parent: privateRoot, signal: shutdown.signal, authorization,
    checkpoint: (receipt) => {
      commitPreflight(join(receiptRoot, `${++receiptSequence}.json`), receipt);
      save("generation.json", receipt);
    },
  });
  save("trial.json", result);
  if (result.modelGeneration !== "GENERATED" || result.custody?.state !== "CAPTURED_UNVERIFIED") { process.exitCode = 1; }
  else {
    writeFileSync(join(privateRoot, "transfer.json"), JSON.stringify({ candidateRoot: result.candidateRoot, candidateSha: result.candidateSha }), { mode: 0o600 });
  }
  console.log(`META_PAID ${result.modelGeneration}; attempts=${result.generatedRequests}; charged=UNKNOWN`);
} catch (error) {
  // Readiness refusals surface their fixed verdict (CUSTODY_READINESS enum)
  // instead of the generic admission code; both stay public-safe enums.
  const readinessBlocked = CUSTODY_READINESS.includes(error?.code);
  save("trial.json", result ? { ...result, blockers: ["POST_GENERATION_TRANSFER_OR_RECEIPT_ERROR"] } : { modelGeneration: "BLOCKED", code: readinessBlocked ? error.code : safePaidAdmissionCode(error), blockers: readinessBlocked ? ["CUSTODY_NOT_READY"] : undefined, publicG1: "NOT_RUN", publicG2: "NOT_RUN", publicG3: "NOT_RUN", G0: "INCONCLUSIVE", G4: "INCONCLUSIVE", product: "NOT_ESTABLISHED", chargedCostUsd: null });
  console.error("META_PAID_BLOCKED"); process.exitCode = 1;
} finally {
  process.removeListener("SIGTERM", stop); process.removeListener("SIGINT", stop);
}
