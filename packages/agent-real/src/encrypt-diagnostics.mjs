import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { sha256 } from "../../target-worker/src/admission.mjs";
import {
  DIAGNOSTIC_POLICY,
  requireDiagnostic,
} from "./private-diagnostics.mjs";

const cleanEnv = Object.freeze({
  PATH: "/usr/local/bin:/usr/bin:/bin",
  HOME: "/nonexistent",
  TZ: "UTC",
});
export function diagnosticCommand(
  args,
  { input, timeoutMs = 30000, limit = 5 * 1024 * 1024, signal } = {},
) {
  return new Promise((resolveResult) => {
    const child = spawn("/usr/bin/docker", args, {
      env: cleanEnv,
      cwd: "/",
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let bytes = 0;
    let failed = false;
    const output = [];
    const kill = () => {
      failed = true;
      child.kill("SIGKILL");
    };
    const timer = setTimeout(kill, timeoutMs);
    signal?.addEventListener("abort", kill, { once: true });
    if (signal?.aborted) kill();
    for (const channel of ["stdout", "stderr"])
      child[channel].on("data", (chunk) => {
        bytes += chunk.length;
        if (bytes > limit) kill();
        else if (channel === "stdout") output.push(chunk);
      });
    child.on("error", () => {
      failed = true;
    });
    child.stdin.on("error", () => {});
    child.on("close", (code, termSignal) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", kill);
      resolveResult({
        ok: !failed && code === 0 && !termSignal,
        code,
        bytes: Buffer.concat(output),
      });
    });
    child.stdin.end(input);
  });
}
// Policy is an explicit trusted function argument only for synthetic throwaway
// controls. The production CLI always supplies the immutable approved policy.
export async function encryptDiagnostic(
  plaintext,
  { agePath, workerPath, policy = DIAGNOSTIC_POLICY, signal } = {},
) {
  requireDiagnostic(
    process.platform === "linux" &&
      Buffer.isBuffer(plaintext) &&
      plaintext.length > 0 &&
      plaintext.length <= DIAGNOSTIC_POLICY.plaintextBytes,
  );
  requireDiagnostic(
    /^age1[a-z0-9]{58}$/.test(policy.recipient) &&
      sha256(policy.recipient) === policy.recipientSha256 &&
      /^[a-f0-9]{64}$/.test(policy.ageSha256) &&
      policy.ageVersion === "v1.3.2" &&
      policy.image === DIAGNOSTIC_POLICY.image,
  );
  for (const path of [agePath, workerPath]) {
    const st = lstatSync(path);
    requireDiagnostic(
      st.isFile() &&
        st.nlink === 1 &&
        !st.isSymbolicLink() &&
        realpathSync(path) === resolve(path),
    );
  }
  requireDiagnostic(sha256(readFileSync(agePath)) === policy.ageSha256);
  const name = `mmp007-diagnostics-${randomUUID()}`;
  let ciphertext;
  let clean = false;
  let failed = false;
  try {
    const result = await diagnosticCommand(
      [
        "run",
        "--interactive",
        "--name",
        name,
        "--label",
        "metamorph.private-diagnostics=true",
        "--pull",
        "never",
        "--network",
        "none",
        "--read-only",
        "--user",
        "65534:65534",
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges",
        "--cpus",
        "1",
        "--memory",
        "128m",
        "--memory-swap",
        "128m",
        "--pids-limit",
        "32",
        "--ulimit",
        "nofile=64:64",
        "--stop-timeout",
        "1",
        "--env",
        "HOME=/nonexistent",
        "--env",
        "PATH=/usr/local/bin:/usr/bin:/bin",
        "--env",
        "TZ=UTC",
        "--mount",
        `type=bind,src=${agePath},dst=/tool/age,readonly`,
        "--mount",
        `type=bind,src=${workerPath},dst=/tool/encrypt.mjs,readonly`,
        "--entrypoint",
        "/usr/local/bin/node",
        policy.image,
        "/tool/encrypt.mjs",
        policy.recipient,
        policy.recipientSha256,
        policy.ageSha256,
        policy.ageVersion,
      ],
      {
        input: plaintext,
        timeoutMs: DIAGNOSTIC_POLICY.deadlineMs,
        limit: DIAGNOSTIC_POLICY.ciphertextBytes,
        signal,
      },
    );
    requireDiagnostic(
      result.ok &&
        result.bytes.length > 100 &&
        result.bytes.length <= DIAGNOSTIC_POLICY.ciphertextBytes &&
        result.bytes
          .subarray(0, 22)
          .equals(Buffer.from("age-encryption.org/v1\n")),
    );
    ciphertext = result.bytes;
  } catch {
    failed = true;
  } finally {
    const removed = await diagnosticCommand(["rm", "--force", name], {
      timeoutMs: 10000,
      limit: 1024,
    });
    const inventory = await diagnosticCommand(
      [
        "container",
        "ls",
        "--all",
        "--filter",
        `name=^/${name}$`,
        "--format",
        "{{.Names}}",
      ],
      { timeoutMs: 10000, limit: 1024 },
    );
    clean =
      removed.ok && inventory.ok && inventory.bytes.toString().trim() === "";
    plaintext.fill(0);
  }
  if (!clean) throw new Error("DIAGNOSTIC_CLEANUP_ERROR");
  if (failed) throw new Error("DIAGNOSTIC_ENCRYPTION_ERROR");
  requireDiagnostic(clean && ciphertext);
  return { ciphertext, cleanup: "VERIFIED_ZERO_RESOURCES" };
}
