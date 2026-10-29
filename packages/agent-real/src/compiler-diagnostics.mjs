import { Buffer } from "node:buffer";
import { validateBundle } from "../../target-worker/src/admission.mjs";

export const DIAGNOSTIC_LIMITS = Object.freeze({
  entries: 20,
  inputBytes: 1024 * 1024,
  lineBytes: 16 * 1024,
  serializedBytes: 8192,
});
const issued = new WeakMap();
const unavailable = (truncated = false) => ({
  status: "DIAGNOSTIC_UNAVAILABLE",
  entries: [],
  errorCount: null,
  truncated,
});
const pathPattern = /^src\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.ts$/;
// Reject controls rather than stripping them into apparently valid headers.
// Unicode in discarded message text is harmless; Unicode paths are not admitted.
function hasControls(value) {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (
      code < 9 ||
      code === 11 ||
      code === 12 ||
      (code >= 14 && code <= 31) ||
      (code >= 127 && code <= 159) ||
      code === 8232 ||
      code === 8233
    )
      return true;
  }
  return false;
}
const secretPath =
  /gh[pousr]_|github_pat_|eyJ[A-Za-z0-9_-]{8}|(?:^|[/_-])(?:secret|token|password|credential|jwt|oidc)(?:[/_.-]|$)/i;

/** Pure, bounded projection of compiler data, never compiler message text.
 * Call only after buildReceipt verifies the trusted recipe/phase envelope.
 * Positions must refer to the exact admitted candidate, including line bounds.
 * Pretty/ANSI or ambiguous emissions fail closed without changing any gate.
 */
export function summarizeCompilerDiagnostics(checks, bundle) {
  let candidate;
  let result;
  try {
    candidate = validateBundle(bundle.files, bundle.candidateSha);
    result = parse(checks, candidate);
  } catch {
    result = unavailable();
  }
  for (const entry of result.entries) Object.freeze(entry);
  Object.freeze(result.entries);
  Object.freeze(result);
  issued.set(result, candidate?.candidateSha);
  return result;
}

function parse(checks, candidate) {
  if (!Array.isArray(checks) || checks.length < 1 || checks.length > 2)
    return unavailable();
  const lines = new Map(
    candidate.files.map((file) => [file.path, file.content.split(/\r?\n/)]),
  );
  let inputBytes = 0;
  for (const [i, check] of checks.entries()) {
    if (
      check.phase !== ["typecheck", "build"][i] ||
      !Number.isInteger(check.exitCode) ||
      check.error ||
      check.signal ||
      typeof check.stdout !== "string" ||
      typeof check.stderr !== "string"
    )
      return unavailable();
    inputBytes +=
      Buffer.byteLength(check.stdout) + Buffer.byteLength(check.stderr);
  }
  if (inputBytes > DIAGNOSTIC_LIMITS.inputBytes) return unavailable(true);
  const entries = [];
  const seen = new Set();
  let errorCount = 0;
  let truncated = false;
  for (const check of checks) {
    for (const raw of [check.stdout, check.stderr]) {
      if (hasControls(raw)) return unavailable();
      for (const line of raw.replaceAll("\r\n", "\n").split("\n")) {
        if (Buffer.byteLength(line) > DIAGNOSTIC_LIMITS.lineBytes)
          return unavailable(true);
        if (line.includes("\r")) return unavailable();
        if (!line.trim()) continue;
        // Continuations/excerpts are discarded, never searched for diagnostic codes.
        if (/^[ \t]/.test(line) && errorCount > 0) continue;
        const header =
          /^(src\/[^\s()]+)\(([1-9][0-9]{0,8}),([1-9][0-9]{0,8})\): error (TS[0-9]{4,5}): [^\r\n]*$/.exec(
            line,
          );
        if (!header || check.exitCode === 0) return unavailable();
        const [, path, row, col, code] = header;
        const lineNumber = Number(row);
        const column = Number(col);
        const source = lines.get(path);
        if (
          path.length > 240 ||
          !pathPattern.test(path) ||
          secretPath.test(path) ||
          !source ||
          lineNumber > source.length ||
          column > source[lineNumber - 1].length + 1
        )
          return unavailable();
        errorCount++;
        const entry = {
          phase: check.phase,
          code,
          path,
          line: lineNumber,
          column,
        };
        const key = JSON.stringify(entry);
        if (seen.has(key)) continue;
        seen.add(key);
        if (entries.length < DIAGNOSTIC_LIMITS.entries) entries.push(entry);
        else truncated = true;
      }
    }
  }
  if (errorCount === 0) return unavailable();
  return { status: "AVAILABLE", entries, errorCount, truncated };
}

/** Explicit publication allowlist. Only an in-process summary for this exact
 * candidate can be published; arbitrary/reloaded worker evidence is unavailable.
 * Bind the sidecar to the caller's already-validated pair, outside gate schemas.
 */
export function publicCompilerDiagnostics(summary, identity) {
  const admitted =
    identity.g1Verdict === "FAIL" &&
    issued.has(summary) &&
    issued.get(summary) === identity.candidateSha;
  const safe = admitted ? summary : unavailable();
  const result = {
    format: "mmp082-g1-diagnostics-v1",
    sourceSha: identity.sourceSha,
    candidateSha: identity.candidateSha,
    attemptId: identity.attemptId,
    pairId: identity.pairId,
    g1Verdict: identity.g1Verdict,
    status: safe.status,
    entries: safe.entries.map((entry) => ({
      phase: entry.phase,
      code: entry.code,
      path: entry.path,
      line: entry.line,
      column: entry.column,
    })),
    errorCount: safe.errorCount,
    truncated: safe.truncated,
  };
  if (
    !/^[a-f0-9]{40}$/.test(result.sourceSha) ||
    !/^[a-f0-9]{64}$/.test(result.candidateSha) ||
    ![result.attemptId, result.pairId].every((id) =>
      /^[a-f0-9-]{36}$/.test(id),
    ) ||
    !["PASS", "FAIL", "ERROR", "INCONCLUSIVE"].includes(result.g1Verdict) ||
    Buffer.byteLength(JSON.stringify(result)) >
      DIAGNOSTIC_LIMITS.serializedBytes
  )
    throw Object.assign(new Error("EVIDENCE_ERROR"), {
      code: "EVIDENCE_ERROR",
    });
  return result;
}
