import { MAX_BYTES, parseStrict } from "./adapter.mjs";
import { TRACK_G_PINS as P } from "./track-g-pins.mjs";

const scenarios = [
  ["workshop-business", 6],
  ["workshop-rejected", 5],
  ["workshop-capacity", 6],
];
const controls =
  "http-positive http-key-order http-status-mutant http-type-mutant http-missing-mutant http-order-mutant db-positive db-row-mutant db-sequence-mutant".split(
    " ",
  );
const steps = (sid, n) =>
  Array.from({ length: n }, (_, i) => `${sid}:step-${i}`);
const gate = (id, verdict, ids, codes = []) => ({
  gate: id,
  verdict,
  executedTestIds: ids,
  findingCodes: codes,
});
const cleanup = {
  status: "VERIFIED_ZERO_RESOURCES",
  containers: 0,
  volumes: 0,
  emergencyRemoved: 0,
};

// Exact recursive shape/value comparison: no unreviewed fields or string payloads.
// Object key order is irrelevant; ordered coverage IDs and scenario order matter.
function equal(actual, expected) {
  if (expected === null || typeof expected !== "object")
    return actual === expected;
  if (
    actual === null ||
    typeof actual !== "object" ||
    Array.isArray(actual) !== Array.isArray(expected)
  )
    return false;
  const keys = Object.keys(expected);
  return (
    Object.keys(actual).length === keys.length &&
    keys.every(
      (key) => Object.hasOwn(actual, key) && equal(actual[key], expected[key]),
    )
  );
}

export function validateTrackG(r) {
  const expected = {
    format: "mmp194-public-success-v1",
    scope: "RECORDED_PUBLIC_MANIFEST",
    provenance: P.provenance,
    candidateSha256: P.candidateSha256,
    oracleAttemptId: P.oracleAttemptId,
    generation: P.generation,
    gates: [
      gate("G0", "INCONCLUSIVE", [], ["G0_NOT_ESTABLISHED"]),
      gate(
        "G1",
        "PASS",
        scenarios.flatMap(([sid]) => [`${sid}:typecheck`, `${sid}:build`]),
      ),
      gate(
        "G2",
        "PASS",
        scenarios.flatMap(([sid, n]) => steps(sid, n)),
      ),
      gate(
        "G3",
        "PASS",
        scenarios.flatMap(([sid, n]) => [`${sid}:initial`, ...steps(sid, n)]),
      ),
      gate(
        "G4",
        "INCONCLUSIVE",
        scenarios.flatMap(([sid]) => controls.map((c) => `${sid}:${c}`)),
        ["HELD_OUT_NOT_RUN"],
      ),
    ],
    coverage: { http: 17, sqlite: 20, requiredHttp: 17, requiredSqlite: 20 },
    scenarios: scenarios.map(([sid, n], i) => ({
      scenarioId: sid,
      pairId: P.pairIds[i],
      g1Verdict: "PASS",
      gates: [
        gate("G2", "PASS", steps(sid, n)),
        gate("G3", "PASS", [`${sid}:initial`, ...steps(sid, n)]),
        gate("G4", "INCONCLUSIVE", controls, ["HELD_OUT_NOT_RUN"]),
      ],
      cleanup: cleanup.status,
    })),
    cleanup,
    finalizer: {
      status: "PASS",
      containers: 0,
      volumes: 0,
      emergencyRemoved: 0,
    },
    limits: {
      maximumPosts: 2,
      maximumRepairs: 1,
      automaticRetries: 0,
      maxOutputTokens: 16384,
      targetLifetimePolicyMs: 180000,
      monetaryCap: "NO_PROVIDER_HARD_CAP",
    },
    stopReason: "FIRST_PUBLIC_PASS_STOP",
    repairs: 0,
    preliminarySendStatus: "ERROR_UNKNOWN_BEFORE_FINAL_RESPONSE",
    syntheticG0: P.syntheticG0,
    g0RealCandidate: "NOT_RUN",
    heldOut: "NOT_RUN",
    g4: "INCONCLUSIVE",
    product: "NOT_ESTABLISHED",
    privateCustody: "NOT_INDEPENDENTLY_VERIFIED",
  };
  if (!equal(r, expected)) throw new Error("PUBLIC_SUCCESS_FACT_MISMATCH");
  if (
    r.syntheticG0.candidateSha256 === r.candidateSha256 ||
    r.syntheticG0.basis !== "OWNER_RECORDED_PUBLIC_SYNTHETIC_SUMMARY" ||
    r.syntheticG0.independentEngineAttestation !== "NOT_ESTABLISHED"
  )
    throw new Error("SYNTHETIC_MIXING_FORBIDDEN");
  return r;
}

export async function readTrackG(name, bytes) {
  if (name !== P.filename) throw new Error("FILE_NOT_ALLOWLISTED");
  if (!(bytes instanceof Uint8Array) || bytes.byteLength > MAX_BYTES)
    throw new Error("SIZE_LIMIT");
  if (bytes.byteLength !== P.bytes) throw new Error("PIN_MISMATCH");
  const copy = Uint8Array.from(bytes);
  const digest = Array.from(
    new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", copy)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  if (digest !== P.sha256) throw new Error("PIN_MISMATCH");
  // Narrow public fact names; exact values are bound above, never raw payloads.
  return validateTrackG(
    parseStrict(copy, ["maxOutputTokens", "privateCustody"]),
  );
}
