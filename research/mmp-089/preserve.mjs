// Run after the validator, including its genuine G1 FAIL exit 1. The selector
// receives a fresh minimal environment; candidate text is always inert data.
import { spawn } from "node:child_process";
import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DIAGNOSTIC_POLICY, preservationRecord, readPrivateJson, requireDiagnostic } from "../../packages/agent-real/src/private-diagnostics.mjs";
import { encryptDiagnostic } from "../../packages/agent-real/src/encrypt-diagnostics.mjs";
import { collectPreservationPackage } from "../../packages/agent-real/src/candidate-retention.mjs";
import { sha256 } from "../../packages/target-worker/src/admission.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
if (process.argv[2] !== "--isolated") {
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "--isolated"], {
    cwd: "/", shell: false, stdio: ["ignore", "ignore", "ignore"],
    env: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: "/nonexistent", TZ: "UTC", RUNNER_TEMP: process.env.RUNNER_TEMP, GITHUB_SHA: process.env.GITHUB_SHA, GITHUB_RUN_ID: process.env.GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT: process.env.GITHUB_RUN_ATTEMPT },
  });
  const stop = () => child.kill("SIGTERM");
  process.on("SIGTERM", stop); process.on("SIGINT", stop);
  const timer = setTimeout(() => child.kill("SIGTERM"), 60000);
  const force = setTimeout(() => child.kill("SIGKILL"), 85000);
  child.on("error", () => { process.exitCode = 1; });
  child.on("close", (code, signal) => {
    clearTimeout(timer); clearTimeout(force);
    process.removeListener("SIGTERM", stop); process.removeListener("SIGINT", stop);
    process.exitCode = code === 0 && !signal ? 0 : 1;
    console.log(process.exitCode === 0 ? "MMP089 preservation step completed; inspect categorical record" : "MMP089 preservation rejected; no plaintext fallback");
  });
} else {
  process.umask(0o077);
  const temp = process.env.RUNNER_TEMP;
  requireDiagnostic(process.platform === "linux" && isAbsolute(temp) && !process.env.MODEL_API_KEY && !process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN && !process.env.ACTIONS_RUNTIME_TOKEN);
  const output = join(temp, "meta-paid-public");
  const privateOutput = join(temp, "mmp089-private-diagnostics");
  const ciphertextPath = join(privateOutput, "candidate-diagnostics.age");
  let record = preservationRecord("REJECTED"); let plaintext;
  const shutdown = new AbortController();
  const stop = () => shutdown.abort();
  process.on("SIGTERM", stop); process.on("SIGINT", stop);
  try {
    requireDiagnostic(!existsSync(privateOutput));
    mkdirSync(privateOutput, { mode: 0o700 });
    const trial = readPrivateJson(join(output, "trial.json"), 4 * 1024 * 1024).value;
    if (trial.modelGeneration === "GENERATED" && (["ERROR", "INCONCLUSIVE", "NOT_RUN"].includes(trial.publicG1) || (trial.publicG1 === "PASS" && ![trial.publicG2, trial.publicG3].every((g) => ["PASS", "FAIL"].includes(g))))) {
      record = preservationRecord("NOT_APPLICABLE");
    } else {
      const expected = { runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT, headSha: process.env.GITHUB_SHA };
      const pack = collectPreservationPackage(trial, expected, join(temp, "meta-paid-verification"));
      // Plaintext package never touches disk. Only these exact allowlisted bytes
      // enter the isolated encryptor. No transfer/provider/Oracle data is passed.
      plaintext = Buffer.from(JSON.stringify(pack));
      const encrypted = await encryptDiagnostic(plaintext, { agePath: join(temp, "mmp089-tools/age"), workerPath: join(root, "research/mmp-089/encrypt-worker.mjs"), signal: shutdown.signal });
      shutdown.signal.throwIfAborted();
      writeFileSync(ciphertextPath, encrypted.ciphertext, { flag: "wx", mode: 0o600, flush: true });
      const st = lstatSync(ciphertextPath);
      requireDiagnostic(st.isFile() && st.nlink === 1 && (st.mode & 0o077) === 0 && st.size <= DIAGNOSTIC_POLICY.ciphertextBytes);
      record = preservationRecord("ENCRYPTED_PENDING_UPLOAD", pack.identity, { sha256: sha256(readFileSync(ciphertextPath)), bytes: st.size }, encrypted.cleanup);
    }
  } catch (error) {
    try { if (existsSync(ciphertextPath)) rmSync(ciphertextPath); }
    catch { record = preservationRecord("REJECTED", null, null, "ERROR"); }
    if (error.message === "DIAGNOSTIC_CLEANUP_ERROR") record = preservationRecord("REJECTED", null, null, "ERROR");
    process.exitCode = 1;
  } finally {
    plaintext?.fill(0);
    process.removeListener("SIGTERM", stop); process.removeListener("SIGINT", stop);
    // Only ciphertext and this fixed public allowlist can survive this process.
    const path = join(output, "preservation.json");
    writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600, flush: true });
    chmodSync(path, 0o600);
  }
}
