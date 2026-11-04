// Credential-free eligibility gate between the first independent Oracle and
// the repair POST. This record is workflow evidence, never an authority: the
// repair step re-verifies eligibility and custody independently before its
// own signed admission. No Meta credential, no candidate text, no network.
import { appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { publicRepairDecision } from "../../packages/agent-real/src/autonomous-repair.mjs";
import { commitRecord, readRecord } from "../../packages/agent-real/src/custody-files.mjs";
import { readPrivateJson } from "../../packages/agent-real/src/private-diagnostics.mjs";
import { g1RecoveryProposal } from "../../packages/agent-real/src/g1-repair-host.mjs";

export function repairGate(env) {
  if (env.MODEL_API_KEY || process.platform !== "linux")
    throw Error("CREDENTIAL_ISOLATION");
  const output = join(env.RUNNER_TEMP, "meta-paid-public");
  const trial = readPrivateJson(join(output, "trial.json"), 16 * 1024 * 1024).value;
  if (
    trial?.format !== "mmp078-public-paid-trial-v1" ||
    trial.headSha !== env.GITHUB_SHA ||
    trial.trialRunId !== env.GITHUB_RUN_ID ||
    typeof trial.candidateSha !== "string"
  )
    throw Error("TRIAL_IDENTITY");
  const storedPath = join(output, "custody-stored.json");
  const stored = existsSync(storedPath)
    ? readRecord(storedPath)
    : null;
  let decision = null,
    gateCode = null;
  try {
    decision = publicRepairDecision(trial, trial.candidateSha);
  } catch (error) {
    gateCode = typeof error?.code === "string" ? error.code : "VERIFICATION_INCOMPLETE";
  }
  const custodyVerified =
    stored?.state === "STORED_UNVERIFIED" &&
    stored.identity?.candidateSha === trial.candidateSha &&
    stored.identity?.headSha === env.GITHUB_SHA;
  // Exactly a complete eligible FAIL with allowlisted public codes and proven
  // stored custody admits the repair send; a first-attempt PASS stops here.
  const eligible =
    decision?.verdict === "FAIL" &&
    typeof decision.feedback === "string" &&
    decision.feedback.length > 0 &&
    custodyVerified;
  const record = Object.freeze({
    format: "mmp158-repair-gate-v1",
    runId: env.GITHUB_RUN_ID,
    runAttempt: env.GITHUB_RUN_ATTEMPT,
    headSha: env.GITHUB_SHA,
    candidateSha: trial.candidateSha,
    firstAttemptVerdict: decision?.verdict ?? null,
    firstAttemptIncompleteCode: decision ? null : gateCode,
    feedback: decision?.feedback ?? null,
    custodyVerified,
    eligible,
    repair: "NOT_AUTHORIZED_BY_THIS_RECORD",
  });
  commitRecord(join(env.RUNNER_TEMP, "meta-paid-private/repair-gate.json"), record);
  // Step output is routing only; the record above stays the durable evidence.
  if (typeof env.GITHUB_OUTPUT === "string" && env.GITHUB_OUTPUT.length > 0)
    appendFileSync(env.GITHUB_OUTPUT, `eligible=${record.eligible}\n`);
  return record;
}

export async function compilerRepairGate(env) {
  if (env.MODEL_API_KEY || process.platform !== "linux") throw Error("CREDENTIAL_ISOLATION");
  let decision = null;
  try { decision = await g1RecoveryProposal(env); } catch { /* fixed NO_GO; no exception data */ }
  const record = { format: "mmp180-repair-gate-v2", runId: env.GITHUB_RUN_ID,
    runAttempt: env.GITHUB_RUN_ATTEMPT, headSha: env.GITHUB_SHA,
    kind: decision?.kind ?? "NO_GO", feedback: decision?.feedback ?? null,
    eligible: decision !== null, repair: "NOT_AUTHORIZED_BY_THIS_RECORD" };
  commitRecord(join(env.RUNNER_TEMP, "meta-paid-private/repair-gate.json"), record);
  if (typeof env.GITHUB_OUTPUT === "string" && env.GITHUB_OUTPUT.length > 0)
    appendFileSync(env.GITHUB_OUTPUT, `eligible=${record.eligible}\n`);
  return record;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const record = process.argv[2] === "g1-v2" ? await compilerRepairGate(process.env) : repairGate(process.env);
    process.stdout.write(
      `MMP158_REPAIR_GATE eligible=${record.eligible}; firstAttempt=${record.firstAttemptVerdict ?? record.firstAttemptIncompleteCode}\n`,
    );
  } catch {
    process.stderr.write("MMP158_REPAIR_GATE_ERROR\n");
    process.exitCode = 1;
  }
}
