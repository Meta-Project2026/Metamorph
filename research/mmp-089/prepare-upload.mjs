// This gate receives no plaintext. It cannot change G1 or either finalizer.
import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { DIAGNOSTIC_POLICY, preservationRecord, readPrivateBytes, readPrivateJson, requireDiagnostic, requireNormalCleanup } from "../../packages/agent-real/src/private-diagnostics.mjs";
import { sha256 } from "../../packages/target-worker/src/admission.mjs";
import { preservationIdentity } from "../../packages/agent-real/src/candidate-retention.mjs";
try {
  requireDiagnostic(process.env.MMP089_PRESERVE_OUTCOME === "success" && process.env.MMP089_FINALIZER_OUTCOME === "success");
  const output = join(process.env.RUNNER_TEMP, "meta-paid-public");
  const record = readPrivateJson(join(output, "preservation.json"), 8192).value;
  requireDiagnostic(record.status === "ENCRYPTED_PENDING_UPLOAD" && record.collectorCleanup === "VERIFIED_ZERO_RESOURCES");
  requireDiagnostic(record.identity?.runId === process.env.GITHUB_RUN_ID && record.identity.runAttempt === process.env.GITHUB_RUN_ATTEMPT && record.identity.headSha === process.env.GITHUB_SHA);
  requireDiagnostic(JSON.stringify(record) === JSON.stringify(preservationRecord(record.status, record.identity, { sha256: record.ciphertextSha256, bytes: record.ciphertextBytes }, record.collectorCleanup)));
  const trial = readPrivateJson(join(output, "trial.json"), 4 * 1024 * 1024).value;
  requireNormalCleanup(trial.cleanup);
  const bound = preservationIdentity(trial, { runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT, headSha: process.env.GITHUB_SHA });
  requireDiagnostic(JSON.stringify(record) === JSON.stringify(preservationRecord(record.status, bound, { sha256: record.ciphertextSha256, bytes: record.ciphertextBytes }, record.collectorCleanup)));
  // Finalizer files are intentionally 0644; no source is read here.
  const finalizer = readPrivateJson(join(output, "finalizer.json"), 8192, false).value;
  requireDiagnostic(finalizer.headSha === record.identity.headSha && finalizer.status === "PASS" && finalizer.emergencyRemoved === 0 && finalizer.inventory?.containers === 0 && finalizer.inventory?.volumes === 0);
  const path = join(process.env.RUNNER_TEMP, "mmp089-private-diagnostics/candidate-diagnostics.age");
  const ciphertext = readPrivateBytes(path, DIAGNOSTIC_POLICY.ciphertextBytes);
  requireDiagnostic(ciphertext.length > 100 && ciphertext.length === record.ciphertextBytes && sha256(ciphertext) === record.ciphertextSha256);
  appendFileSync(process.env.GITHUB_OUTPUT, "eligible=true\n");
} catch {
  appendFileSync(process.env.GITHUB_OUTPUT, "eligible=false\n");
  // A preservation refusal never rewrites or masks validator exit 1.
  console.log("MMP089 upload not eligible");
}
