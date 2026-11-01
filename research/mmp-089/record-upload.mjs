import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { preservationRecord, readPrivateJson, requireDiagnostic } from "../../packages/agent-real/src/private-diagnostics.mjs";
try {
  const path = join(process.env.RUNNER_TEMP, "meta-paid-public/preservation.json");
  const record = readPrivateJson(path, 8192).value;
  requireDiagnostic(record.status === "ENCRYPTED_PENDING_UPLOAD" && ["success", "failure"].includes(process.env.MMP089_UPLOAD_OUTCOME));
  requireDiagnostic(record.identity?.runId === process.env.GITHUB_RUN_ID && record.identity.runAttempt === process.env.GITHUB_RUN_ATTEMPT && record.identity.headSha === process.env.GITHUB_SHA);
  requireDiagnostic(JSON.stringify(record) === JSON.stringify(preservationRecord(record.status, record.identity, { sha256: record.ciphertextSha256, bytes: record.ciphertextBytes }, record.collectorCleanup)));
  const next = preservationRecord(process.env.MMP089_UPLOAD_OUTCOME === "success" ? "PRESERVED" : "UPLOAD_FAILED", record.identity, { sha256: record.ciphertextSha256, bytes: record.ciphertextBytes }, record.collectorCleanup);
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600, flush: true });
} catch { console.log("MMP089 upload preservation not established"); process.exitCode = 1; }
