// This gate receives no plaintext. It cannot change G1 or either finalizer.
import { appendFileSync, lstatSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DIAGNOSTIC_POLICY, preservationRecord, readPrivateJson, requireDiagnostic, requireNormalCleanup } from "../../packages/agent-real/src/private-diagnostics.mjs";
import { sha256 } from "../../packages/target-worker/src/admission.mjs";
try {
  const output = join(process.env.RUNNER_TEMP, "meta-paid-public");
  const record = readPrivateJson(join(output, "preservation.json"), 8192).value;
  requireDiagnostic(record.status === "ENCRYPTED_PENDING_UPLOAD" && record.collectorCleanup === "VERIFIED_ZERO_RESOURCES");
  requireDiagnostic(record.identity?.runId === process.env.GITHUB_RUN_ID && record.identity.runAttempt === process.env.GITHUB_RUN_ATTEMPT && record.identity.headSha === process.env.GITHUB_SHA);
  requireDiagnostic(JSON.stringify(record) === JSON.stringify(preservationRecord(record.status, record.identity, { sha256: record.ciphertextSha256, bytes: record.ciphertextBytes }, record.collectorCleanup)));
  const trial = readPrivateJson(join(output, "trial.json"), 4 * 1024 * 1024).value;
  requireNormalCleanup(trial.cleanup);
  requireDiagnostic(trial.publicG1 === "FAIL" && trial.candidateSha === record.identity.candidateSha && trial.sourceSha === record.identity.sourceSha && trial.headSha === record.identity.headSha);
  // Finalizer files are intentionally 0644; no source is read here.
  const finalizer = JSON.parse(readFileSync(join(output, "finalizer.json"), "utf8"));
  requireDiagnostic(finalizer.headSha === record.identity.headSha && finalizer.status === "PASS" && finalizer.emergencyRemoved === 0 && finalizer.inventory?.containers === 0 && finalizer.inventory?.volumes === 0);
  const path = join(process.env.RUNNER_TEMP, "mmp089-private-diagnostics/candidate-diagnostics.age");
  const st = lstatSync(path);
  requireDiagnostic(st.isFile() && !st.isSymbolicLink() && st.nlink === 1 && (st.mode & 0o077) === 0 && st.size > 100 && st.size <= DIAGNOSTIC_POLICY.ciphertextBytes && st.size === record.ciphertextBytes && sha256(readFileSync(path)) === record.ciphertextSha256);
  appendFileSync(process.env.GITHUB_OUTPUT, "eligible=true\n");
} catch {
  appendFileSync(process.env.GITHUB_OUTPUT, "eligible=false\n");
  // A preservation refusal never rewrites or masks validator exit 1.
  console.log("MMP089 upload not eligible");
}
