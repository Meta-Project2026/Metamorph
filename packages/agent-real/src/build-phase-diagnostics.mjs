// Fixed, public-safe classification of an abnormal trusted compiler phase.
// The summary is derived from the trusted build recipe envelope only. It never
// carries stdout/stderr, a raw exit code, a signal, an error message, a path or
// candidate source. A foreign/reloaded summary cannot be published.
import { strictJson } from "../../differential/src/strict.mjs";

export const BUILD_PHASE_CODES = Object.freeze([
  "BUILD_PHASE_TIMEOUT",
  "BUILD_PHASE_SIGNAL",
  "BUILD_PHASE_SPAWN_ERROR",
  "BUILD_PHASE_OUTPUT_OVERFLOW",
  "BUILD_PHASE_UNKNOWN",
]);
const PHASES = Object.freeze(["typecheck", "build"]);
const issued = new WeakMap();
const unavailable = () =>
  Object.freeze({
    status: "DIAGNOSTIC_UNAVAILABLE",
    phase: null,
    code: null,
  });

/**
 * Classify one spawnSync phase record from the trusted build recipe. A normal
 * compiler verdict (non-zero integer exitCode) is deliberately not abnormal:
 * it stays a G1 FAIL and is handled by compiler diagnostics, not this sidecar.
 * Timeout is checked before signal because spawnSync reports both ETIMEDOUT and
 * SIGTERM for a deadline kill. ENOBUFS identifies maxBuffer overflow.
 */
export function classifyAbnormalPhase(phase) {
  if (!phase || typeof phase !== "object") return null;
  const error = phase.error;
  const signal = phase.signal;
  const abnormal =
    Boolean(error) || Boolean(signal) || !Number.isInteger(phase.exitCode);
  if (!abnormal) return null;
  if (error === "ETIMEDOUT") return "BUILD_PHASE_TIMEOUT";
  if (error === "ENOBUFS") return "BUILD_PHASE_OUTPUT_OVERFLOW";
  if (typeof error === "string" && error) return "BUILD_PHASE_SPAWN_ERROR";
  if (typeof signal === "string" && signal) return "BUILD_PHASE_SIGNAL";
  return "BUILD_PHASE_UNKNOWN";
}

/** Pure bounded summary. Only the recipe's already-validated stdout envelope is
 * read, and only the first abnormal phase is named. Malformed envelopes are
 * unavailable rather than guessed. */
export function summarizeBuildPhaseDiagnostics(receipt, candidateSha) {
  let summary = unavailable();
  try {
    if (
      receipt &&
      receipt.exitCode === 2 &&
      receipt.timedOut === false &&
      receipt.cancelled === false &&
      receipt.overflow === false &&
      receipt.spawnError === null
    ) {
      const output = strictJson(receipt.stdout, 4 * 1024 * 1024);
      if (
        output &&
        typeof output === "object" &&
        !Array.isArray(output) &&
        Array.isArray(output.checks) &&
        output.checks.length >= 1 &&
        output.checks.length <= 2
      ) {
        for (const [index, phase] of output.checks.entries()) {
          if (
            !phase ||
            typeof phase !== "object" ||
            phase.phase !== PHASES[index]
          ) {
            summary = unavailable();
            break;
          }
          const code = classifyAbnormalPhase(phase);
          if (code) {
            summary = Object.freeze({
              status: "AVAILABLE",
              phase: phase.phase,
              code,
            });
            break;
          }
        }
      }
    }
  } catch {
    summary = unavailable();
  }
  issued.set(summary, candidateSha);
  return summary;
}

/** Explicit publication allowlist. Only an in-process summary for this exact
 * candidate and an ERROR G1 is publishable; anything else is unavailable. */
export function publicBuildPhaseDiagnostics(summary, identity) {
  const admitted =
    identity.g1Verdict === "ERROR" &&
    issued.has(summary) &&
    issued.get(summary) === identity.candidateSha;
  const safe = admitted ? summary : unavailable();
  const result = {
    format: "mmp167-build-phase-diagnostics-v1",
    sourceSha: identity.sourceSha,
    candidateSha: identity.candidateSha,
    attemptId: identity.attemptId,
    pairId: identity.pairId,
    g1Verdict: identity.g1Verdict,
    status: safe.status,
    phase: safe.phase,
    code: safe.code,
  };
  if (
    !/^[a-f0-9]{40}$/.test(result.sourceSha) ||
    !/^[a-f0-9]{64}$/.test(result.candidateSha) ||
    ![result.attemptId, result.pairId].every((id) =>
      /^[a-f0-9-]{36}$/.test(id),
    ) ||
    !["PASS", "FAIL", "ERROR", "INCONCLUSIVE"].includes(result.g1Verdict) ||
    !["AVAILABLE", "DIAGNOSTIC_UNAVAILABLE"].includes(result.status) ||
    !(result.phase === null || PHASES.includes(result.phase)) ||
    !(result.code === null || BUILD_PHASE_CODES.includes(result.code)) ||
    (result.status === "AVAILABLE") !==
      (result.phase !== null && result.code !== null)
  )
    throw Object.assign(new Error("EVIDENCE_ERROR"), {
      code: "EVIDENCE_ERROR",
    });
  return result;
}
