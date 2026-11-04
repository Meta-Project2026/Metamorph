import { spawn } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  capsuleFromLease,
  requireCustody,
  validateReceipt,
} from "./custody-contract.mjs";
import { cipherAt, readRecord } from "./custody-files.mjs";

/** Coarse, allowlisted custody-capture failure stages. Fixed enum strings
 * from trusted code only: no error text, paths, stderr, candidate bytes or
 * environment details ever cross this boundary. A failed capture always
 * stays fail-closed; the stage grants no custody permit, Oracle access,
 * retry or product standing. */
export const CUSTODY_CAPTURE_STAGES = Object.freeze([
  "CAPSULE_REJECTED",
  "COLLECTOR_ABORTED",
  "COLLECTOR_TIMEOUT",
  "COLLECTOR_KILLED",
  "COLLECTOR_ERROR",
  "COLLECTOR_EXITED",
  "SOURCE_LEASE_CHANGED",
  "HOST_RECEIPT_INVALID",
  "UNKNOWN",
]);

const custodyStage = (stage) =>
  Object.assign(new Error("CUSTODY_CAPTURE_FAILED"), {
    custodyStage: CUSTODY_CAPTURE_STAGES.includes(stage) ? stage : "UNKNOWN",
  });

/** Registers `onAbort` once on the attempt signal and returns the exact
 * removal function, so every collector settle path can drop the listener —
 * no stale anonymous handlers accumulate on the long-lived attempt signal.
 * The handler fires at most once (event listener `once` plus the explicit
 * immediate call when the signal has already aborted). */
export function bridgeAbort(signal, onAbort) {
  const handler = () => onAbort();
  signal.addEventListener("abort", handler, { once: true });
  if (signal.aborted) handler();
  return () => signal.removeEventListener("abort", handler);
}

/** Pure classifier for the credential-free collector process outcome.
 * Precedence: parent abort, tracked timeout, tracked kill, process error,
 * tracked stderr/output overflow, then a plain nonzero exit. */
export function classifyCollectorOutcome({
  ok,
  aborted = false,
  timedOut = false,
  killed = false,
  errored = false,
  overflow = false,
  // `code` is intentionally unused: a plain nonzero exit carries no safe
  // information beyond COLLECTOR_EXITED, and exit text must never surface.
  termSignal = null,
}) {
  if (ok) return null;
  if (aborted) return "COLLECTOR_ABORTED";
  if (timedOut) return "COLLECTOR_TIMEOUT";
  if (killed) return "COLLECTOR_KILLED";
  if (errored) return "COLLECTOR_ERROR";
  if (overflow) return "COLLECTOR_KILLED";
  if (termSignal !== null && termSignal !== undefined)
    return "COLLECTOR_KILLED";
  return "COLLECTOR_EXITED";
}

export async function captureLease(token, lease, receipt, signal, attempt = 1) {
  // Phase 0: source-lease integrity, trustworthily established before any
  // capsule work. A change here is classified SOURCE_LEASE_CHANGED, never a
  // capsule or receipt failure.
  try {
    await lease.assertUnchanged();
  } catch {
    throw custodyStage("SOURCE_LEASE_CHANGED");
  }
  let capsule;
  try {
    capsule = await capsuleFromLease(token, lease, receipt, attempt);
  } catch {
    // capsuleFromLease re-asserts the lease internally: re-check to separate
    // a source-integrity violation (SOURCE_LEASE_CHANGED) from a capsule
    // rejection (data/policy dependent). The original error never crosses
    // this boundary; only the fixed stage does.
    try {
      await lease.assertUnchanged();
    } catch {
      throw custodyStage("SOURCE_LEASE_CHANGED");
    }
    throw custodyStage("CAPSULE_REJECTED");
  }
  const env = process.env;
  try {
    requireCustody(
      process.platform === "linux" &&
        capsule.identity.runId === env.GITHUB_RUN_ID &&
        capsule.identity.headSha === env.GITHUB_SHA &&
        env.GITHUB_RUN_ATTEMPT === "1" &&
        (attempt === 1 || attempt === 2),
    );
  } catch {
    // Host/run-policy rejection is part of the capsule admission boundary.
    throw custodyStage("CAPSULE_REJECTED");
  }
  const plaintext = Buffer.from(JSON.stringify(capsule));
  try {
    signal.throwIfAborted();
    const spool = `mmp115-custody${attempt === 2 ? "-repair" : ""}`;
    const outcome = {
      ok: false,
      aborted: false,
      timedOut: false,
      killed: false,
      errored: false,
      overflow: false,
      code: null,
      termSignal: null,
    };
    const ok = await new Promise((resolveResult) => {
      const child = spawn(
        process.execPath,
        [fileURLToPath(new URL("./custody-collector.mjs", import.meta.url))],
        {
          cwd: "/",
          shell: false,
          stdio: ["pipe", "ignore", "pipe"],
          env: {
            PATH: "/usr/local/bin:/usr/bin:/bin",
            HOME: "/nonexistent",
            TZ: "UTC",
            RUNNER_TEMP: env.RUNNER_TEMP,
            GITHUB_RUN_ID: env.GITHUB_RUN_ID,
            GITHUB_RUN_ATTEMPT: "1",
            GITHUB_SHA: env.GITHUB_SHA,
            MMP115_SPOOL: spool,
          },
        },
      );
      let failed = false,
        bytes = 0;
      const stop = () => {
        failed = true;
        child.kill("SIGTERM");
      };
      const timer = setTimeout(() => {
        outcome.timedOut = true;
        failed = true;
        stop();
      }, 45000);
      const kill = setTimeout(() => {
        outcome.killed = true;
        failed = true;
        child.kill("SIGKILL");
      }, 85000);
      const removeAbort = bridgeAbort(signal, () => {
        outcome.aborted = true;
        stop();
      });
      child.stderr.on("data", (b) => {
        bytes += b.length;
        if (bytes > 4096) {
          outcome.overflow = true;
          stop();
        }
      });
      child.on("error", () => {
        outcome.errored = true;
        failed = true;
      });
      child.stdin.on("error", () => {
        failed = true;
      });
      child.on("close", (code, term) => {
        clearTimeout(timer);
        clearTimeout(kill);
        // Remove exactly the registered handler on every settle path.
        removeAbort();
        outcome.code = code;
        outcome.termSignal = term;
        outcome.ok = !failed && code === 0 && !term;
        resolveResult(outcome.ok);
      });
      child.stdin.end(plaintext);
    });
    // Classifier invariant: ok === true exactly when the stage is null, so
    // a staged throw here is the same fail-closed gate as before, with a
    // coarse stage attached instead of a silent swallow.
    const stage = classifyCollectorOutcome({
      ...outcome,
      aborted: outcome.aborted || signal.aborted,
    });
    if (stage !== null) throw custodyStage(stage);
    // Phase 3: source lease must still match after the collector ran; only
    // then do the host receipt/readback checks distinguish
    // HOST_RECEIPT_INVALID (receipt/ciphertext mismatch) from a source
    // integrity violation (SOURCE_LEASE_CHANGED).
    try {
      await lease.assertUnchanged();
    } catch {
      throw custodyStage("SOURCE_LEASE_CHANGED");
    }
    try {
      const spoolPath = join(env.RUNNER_TEMP, spool);
      const record = validateReceipt(
        readRecord(join(spoolPath, "capture.json")),
        capsule.identity,
        "CAPTURED_UNVERIFIED",
      );
      cipherAt(join(spoolPath, "candidate.age"), record);
      return record;
    } catch {
      // Post-collector host receipt/readback mismatch: the sealed bytes or
      // receipt on the spool do not match the capsule identity.
      throw custodyStage("HOST_RECEIPT_INVALID");
    }
  } catch (error) {
    if (error?.custodyStage !== undefined) throw error;
    if (signal.aborted) throw custodyStage("COLLECTOR_ABORTED");
    // Unknown boundary (plaintext handling, unexpected internal failure):
    // still fail-closed, still no text disclosure.
    throw custodyStage("UNKNOWN");
  } finally {
    plaintext.fill(0);
  }
}
