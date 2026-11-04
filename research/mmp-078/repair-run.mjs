// Network step only: the single signed repair POST after a complete eligible
// public FAIL of the first candidate. Everything is re-verified here from
// trusted same-run custody and the recorded trial; the gate record is evidence,
// never an authority. No test port, CLI flag or env flag can mint this POST.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { admitDirectory } from "../../packages/target-worker/src/admission.mjs";
import { publicRepairDecision } from "../../packages/agent-real/src/autonomous-repair.mjs";
import {
  consumeOraclePermit,
  requireStoredCheckpoint,
} from "../../packages/agent-real/src/custody-checkpoint.mjs";
import {
  authorizePaidWorkflow,
  paidPreflight,
  safePaidAdmissionCode,
} from "../../packages/agent-real/src/meta-paid-authorization.mjs";
import { commitPreflight } from "../../packages/agent-real/src/migration-preflight.mjs";
import { bindMigrationContext } from "../../packages/agent-real/src/migration-context.mjs";
import { runPublicRepair } from "../../packages/agent-real/src/migration-trial.mjs";
import { readPrivateJson } from "../../packages/agent-real/src/private-diagnostics.mjs";
import { g1CapabilityDetails, requireG1RepairCapability } from "../../packages/agent-real/src/g1-repair-host.mjs";
import { G1_RECOVERY_MODE } from "../../packages/agent-real/src/g1-repair-eligibility.mjs";

export async function runRepairSend(env) {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const output = join(env.RUNNER_TEMP, "meta-paid-public");
  const privateRoot = join(env.RUNNER_TEMP, "meta-paid-private");
  const receiptRoot = join(output, "repair-send-receipts");
  mkdirSync(output, { recursive: true, mode: 0o700 });
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
  let claimed = false;
  try {
    mkdirSync(receiptRoot, { mode: 0o700 });
    claimed = true;
    if (!env.MODEL_API_KEY) throw Error("CREDENTIAL_REQUIRED");
    const gate = readPrivateJson(join(privateRoot, "repair-gate.json"), 65536).value;
    const trial = readPrivateJson(join(output, "trial.json"), 16 * 1024 * 1024).value;
    const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8"));
    const v2 = event.inputs.execution_mode === G1_RECOVERY_MODE;
    const context = bindMigrationContext(readFileSync(join(root, "research/mmp-061/public-source.json"), "utf8"));
    // A gate output is routing only. The v2 host issues fresh opaque authority
    // from its sealed original plan, actual verifier origin and renewed custody.
    const capability = v2 ? await requireG1RepairCapability(env, context) : null;
    const g1 = capability ? g1CapabilityDetails(capability, context) : null;
    // Independent renewed binding of the sealed first candidate before any
    // second admission: spool records, authenticated artifact provenance,
    // exact readback bytes and the pre-Oracle zero-resource proof are all
    // re-verified from scratch here; the permit is single-use, so replay
    // inside this process is impossible. This POST step legitimately holds
    // MODEL_API_KEY for its own send; allowCredentials relaxes only that one
    // refusal and never touches the credential-free Oracle steps.
    const custodyPermit = requireStoredCheckpoint(
      env,
      {
        candidateSha: trial.candidateSha,
        sourceSha: trial.sourceSha,
        attemptId: trial.custody?.identity?.attemptId,
      },
      1,
      { allowCredentials: true },
    );
    const custodyIdentity = consumeOraclePermit(custodyPermit, {
      candidateSha: trial.candidateSha,
      headSha: env.GITHUB_SHA,
      sourceSha: trial.sourceSha,
    });
    // The recorded trial is evidence; eligibility is recomputed, not trusted.
    const decision = v2 ? { verdict: "FAIL", feedback: g1.feedback } : publicRepairDecision(trial, trial.candidateSha);
    if (
      gate?.format !== (v2 ? "mmp180-repair-gate-v2" : "mmp158-repair-gate-v1") ||
      gate.eligible !== true ||
      (!v2 && gate.candidateSha !== trial.candidateSha) ||
      gate.headSha !== env.GITHUB_SHA ||
      gate.runId !== env.GITHUB_RUN_ID ||
      (v2 && gate.runAttempt !== "1") ||
      JSON.stringify(gate.feedback) !== JSON.stringify(decision.feedback) ||
      decision.verdict !== "FAIL" ||
      (!v2 && typeof decision.feedback !== "string") ||
      custodyIdentity.candidateSha !== trial.candidateSha ||
      custodyIdentity.headSha !== env.GITHUB_SHA
    )
      throw Error("REPAIR_NOT_ELIGIBLE");
    // The genuine previous model output comes only from the custody-bound
    // candidate directory: its bytes hash to the verified attempt-1 candidateSha.
    const transfer = readPrivateJson(join(privateRoot, "transfer.json"), 65536).value;
    if (transfer.candidateSha !== custodyIdentity.candidateSha) throw Error("SOURCE_IDENTITY");
    const bundle = await admitDirectory(transfer.candidateRoot, custodyIdentity.candidateSha);
    const previousChanges = bundle.files.map(({ path, content }) => ({ path, content }));
    const authorization = await authorizePaidWorkflow(context, {
      plan: v2 ? G1_RECOVERY_MODE : "generate_then_repair",
      attempt: 2,
      feedback: decision.feedback,
      previousChanges,
      firstAttemptEstimatedUsd: trial.estimatedCostUsd,
      firstAttemptCandidateSha: custodyIdentity.candidateSha,
      ...(v2 ? { g1Capability: capability } : {}),
    });
    commitPreflight(join(output, "preflight-repair.json"), paidPreflight(authorization, context));
    result = await runPublicRepair({
      context,
      parent: privateRoot,
      headSha: authorization.headSha,
      signal: shutdown.signal,
      authorization,
      checkpoint: (receipt) => {
        commitPreflight(join(receiptRoot, `${++receiptSequence}.json`), receipt);
        save("generation-repair.json", receipt);
      },
      previousChanges,
      feedback: decision.feedback,
    });
    save("trial-repair.json", result);
    if (result.modelGeneration !== "GENERATED" || result.custody?.state !== "CAPTURED_UNVERIFIED") { process.exitCode = 1; }
    else {
      writeFileSync(join(privateRoot, "transfer-repair.json"), JSON.stringify({ candidateRoot: result.candidateRoot, candidateSha: result.candidateSha }), { mode: 0o600 });
    }
    console.log(`META_PAID_REPAIR ${result.modelGeneration}; attempts=2; charged=UNKNOWN`);
  } catch (error) {
    // A duplicate/restarted caller must preserve the original attempt's evidence.
    if (claimed) save("trial-repair.json", result ? { ...result, blockers: ["POST_REPAIR_TRANSFER_OR_RECEIPT_ERROR"] } : { format: "mmp078-public-repair-trial-v1", modelGeneration: "BLOCKED", code: safePaidAdmissionCode(error), publicG1: "NOT_RUN", publicG2: "NOT_RUN", publicG3: "NOT_RUN", G0: "INCONCLUSIVE", G4: "INCONCLUSIVE", product: "NOT_ESTABLISHED", chargedCostUsd: null });
    console.error("META_PAID_REPAIR_BLOCKED"); process.exitCode = 1;
  } finally {
    process.removeListener("SIGTERM", stop); process.removeListener("SIGINT", stop);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await runRepairSend(process.env); }
  catch { console.error("META_PAID_REPAIR_BLOCKED"); process.exitCode = 1; }
}
