import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";
import type { PrivateEvidence } from "./evidence.js";
import { ReferenceWorkerError } from "./manifest.js";

export interface CommandResult {
  stdout: Buffer;
  stderr: Buffer;
  elapsedMs: number;
}
export type Command = (
  args: string[],
  signal: AbortSignal,
  input?: Uint8Array,
  timeoutMs?: number,
) => Promise<CommandResult>;
/** Never shell interpolation and never forward worker output to public logs. */
export function dockerCommand(evidence: PrivateEvidence): Command {
  return boundedCommand("docker", evidence);
}
/** Trusted executable only; exposed for deterministic process-supervision controls. */
export function boundedCommand(
  executable: string,
  evidence: PrivateEvidence,
): Command {
  let sequence = 0;
  return async (args, signal, input, timeoutMs = 15000) => {
    const id = `diagnostic-${++sequence}`;
    const start = performance.now();
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new ReferenceWorkerError("WORKER_ABORTED"));
        return;
      }
      const child = spawn(executable, args, {
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      });
      const out: Buffer[] = [];
      const err: Buffer[] = [];
      let bytes = 0;
      let fault: string | undefined;
      const kill = (code: string) => {
        fault ??= code;
        child.kill("SIGKILL");
      };
      const abort = () => kill("WORKER_ABORTED");
      signal.addEventListener("abort", abort, { once: true });
      const timer = setTimeout(() => kill("WORKER_TIMEOUT"), timeoutMs);
      const capture = (target: Buffer[]) => (data: Buffer) => {
        bytes += data.length;
        if (bytes > 16 * 1024 * 1024) kill("WORKER_OUTPUT_LIMIT");
        else target.push(data);
      };
      child.stdout.on("data", capture(out));
      child.stderr.on("data", capture(err));
      child.stdin.on("error", () => {
        /* EPIPE is resolved by child exit. */
      });
      child.on("error", () => {
        fault ??= "DOCKER_UNAVAILABLE";
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
        const stdout = Buffer.concat(out);
        const stderr = Buffer.concat(err);
        const elapsedMs = performance.now() - start;
        try {
          evidence.write(id, {
            exitCode: code,
            fault: fault ?? null,
            elapsedMs,
            stdoutBase64: stdout.toString("base64"),
            stderrBase64: stderr.toString("base64"),
          });
          if (fault || code !== 0)
            reject(new ReferenceWorkerError(fault ?? "WORKER_CRASH"));
          else resolve({ stdout, stderr, elapsedMs });
        } catch {
          reject(new ReferenceWorkerError("EVIDENCE_WRITE_ERROR"));
        }
      });
      child.stdin.end(input);
    });
  };
}
