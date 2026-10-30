// Fixed upstream BSD-3-Clause release plus retained Go notices and qualified
// archive/executable pins. Run before any
// Meta credential mapping. Extract no plugins. Never install identities.
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DIAGNOSTIC_POLICY, requireDiagnostic } from "../../packages/agent-real/src/private-diagnostics.mjs";
import { sha256 } from "../../packages/target-worker/src/admission.mjs";

try {
  requireDiagnostic(process.platform === "linux" && !process.env.MODEL_API_KEY);
  const directory = join(process.env.RUNNER_TEMP, "mmp089-tools");
  requireDiagnostic(!existsSync(directory));
  mkdirSync(directory, { mode: 0o700 });
  const response = await fetch("https://github.com/FiloSottile/age/releases/download/v1.3.2/age-v1.3.2-linux-amd64.tar.gz", { signal: AbortSignal.timeout(30000) });
  requireDiagnostic(response.ok);
  const chunks = []; let total = 0;
  for await (const chunk of response.body) { total += chunk.length; requireDiagnostic(total <= 32 * 1024 * 1024); chunks.push(chunk); }
  const bytes = Buffer.concat(chunks);
  requireDiagnostic(sha256(bytes) === DIAGNOSTIC_POLICY.archiveSha256);
  const archive = join(directory, "age.tar.gz");
  writeFileSync(archive, bytes, { flag: "wx", mode: 0o600 });
  execFileSync("/usr/bin/tar", ["--extract", "--gzip", "--file", archive, "--directory", directory, "--strip-components=1", "age/age", "age/age-keygen", "age/LICENSE"], { timeout: 10000, stdio: "pipe", env: { PATH: "/usr/bin:/bin", HOME: directory } });
  for (const [name, pin] of [["age", DIAGNOSTIC_POLICY.ageSha256], ["age-keygen", DIAGNOSTIC_POLICY.keygenSha256], ["LICENSE", "afbdb4e07a359499db587ae632815809b1fc1670a92d5449af112ce9a67833a2"]]) {
    requireDiagnostic(sha256(readFileSync(join(directory, name))) === pin);
    chmodSync(join(directory, name), name === "LICENSE" ? 0o644 : 0o755);
  }
  // Fixed trusted binaries only; no credential environment or private files.
  for (const name of ["age", "age-keygen"]) requireDiagnostic(execFileSync(join(directory, name), ["--version"], { encoding: "utf8", timeout: 10000, stdio: ["ignore", "pipe", "pipe"], env: { PATH: "/usr/bin:/bin", HOME: directory } }).trim() === DIAGNOSTIC_POLICY.ageVersion);
  execFileSync("/usr/bin/docker", ["pull", DIAGNOSTIC_POLICY.image], { timeout: 120000, stdio: "pipe", env: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: "/nonexistent" } });
  console.log("MMP089 pinned upstream age and isolated encryptor image prepared");
} catch { console.error("MMP089_TOOL_QUALIFICATION_ERROR"); process.exitCode = 1; }
