import { MAX_BYTES, parseStrict } from "./adapter.mjs";
import { TRACK_F_PINS as P } from "./track-f-pins.mjs";

const SCENARIOS = [
  "workshop-business",
  "workshop-rejected",
  "workshop-capacity",
];
const COUNTS = [6, 5, 6];
const CONTROLS = [
  "http-positive",
  "http-key-order",
  "http-status-mutant",
  "http-type-mutant",
  "http-missing-mutant",
  "http-order-mutant",
  "db-positive",
  "db-row-mutant",
  "db-sequence-mutant",
];
const ids = (id, n) => Array.from({ length: n }, (_, i) => `${id}:step-${i}`);
function requireThat(condition, code) {
  if (!condition) throw new Error(code);
}
function keys(value, names) {
  const fields = names.split(" ");
  requireThat(
    value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).length === fields.length &&
      fields.every((k) => Object.hasOwn(value, k)),
    "UNKNOWN_OR_MISSING_FIELDS",
  );
}
function same(value, expected, code) {
  requireThat(JSON.stringify(value) === JSON.stringify(expected), code);
}
function gate(value, id, verdict, executed, findings) {
  keys(value, "gate verdict executedTestIds findingCodes");
  requireThat(value.gate === id && value.verdict === verdict, "GATE_MISMATCH");
  same(value.executedTestIds, executed, "COVERAGE_MISMATCH");
  same(value.findingCodes, findings, "FINDING_MISMATCH");
}
const cleanup = {
  status: "VERIFIED_ZERO_RESOURCES",
  containers: 0,
  volumes: 0,
  emergencyRemoved: 0,
};

// Semantic truth is checked separately from byte identity: a reviewed future pin
// move must not silently turn this recorded failed repair into acceptance.
export function validateTrackF(r) {
  keys(
    r,
    "format scope provenance attempts repairLink reporting usage finalizer aggregateOutcome perStepImprovements rootCause heldOut product",
  );
  requireThat(
    r.format === "mmp162-public-repair-v1" &&
      r.scope === "RECORDED_PUBLIC_MANIFEST",
    "FORMAT_OR_SCOPE_MISMATCH",
  );
  same(r.provenance, P.provenance, "PROVENANCE_MISMATCH");
  requireThat(
    Array.isArray(r.attempts) && r.attempts.length === 2,
    "ATTEMPT_ORDER_MISMATCH",
  );
  for (const [index, a] of r.attempts.entries()) {
    keys(
      a,
      "attempt action candidateSha256 requestSha256 responseSha256 oracleAttemptId generation gates coverage scenarios cleanup",
    );
    for (const [key, value] of Object.entries(P.attempts[index]))
      requireThat(a[key] === value, "ATTEMPT_IDENTITY_MISMATCH");
    same(
      a.generation,
      {
        status: "PASS",
        generationKind: "REAL_INFERENCE",
        provider: "meta-model-api",
        modelId: "muse-spark-1.3",
        attemptedRequests: 1,
        confirmedResponseCount: 1,
        httpStatus: 200,
        networkSend: "RESPONSE_RECEIVED",
        tlsPeerVerified: true,
        inputTokens: index === 0 ? 6188 : 14148,
        outputTokens: index === 0 ? 10556 : 9179,
        cachedInputTokens: 0,
        estimatedCostUsd: index === 0 ? 0.052598 : 0.05669575,
        chargedCostUsd: null,
        usageStatus: "ESTIMATE_ONLY",
      },
      "GENERATION_OR_USAGE_MISMATCH",
    );
    requireThat(
      Array.isArray(a.gates) && a.gates.length === 5,
      "GATE_MISMATCH",
    );
    gate(a.gates[0], "G0", "INCONCLUSIVE", [], ["G0_NOT_ESTABLISHED"]);
    gate(
      a.gates[1],
      "G1",
      "PASS",
      SCENARIOS.flatMap((id) => [`${id}:typecheck`, `${id}:build`]),
      [],
    );
    gate(
      a.gates[2],
      "G2",
      "FAIL",
      SCENARIOS.flatMap((id, i) => ids(id, COUNTS[i])),
      ["HTTP_JSON_TYPE"],
    );
    gate(
      a.gates[3],
      "G3",
      "FAIL",
      SCENARIOS.flatMap((id, i) => [`${id}:initial`, ...ids(id, COUNTS[i])]),
      ["HTTP_JSON_TYPE"],
    );
    gate(
      a.gates[4],
      "G4",
      "INCONCLUSIVE",
      SCENARIOS.flatMap((id) => CONTROLS.map((c) => `${id}:${c}`)),
      ["HELD_OUT_NOT_RUN"],
    );
    same(
      a.coverage,
      { http: 17, sqlite: 20, requiredHttp: 17, requiredSqlite: 20 },
      "COVERAGE_MISMATCH",
    );
    requireThat(
      Array.isArray(a.scenarios) && a.scenarios.length === 3,
      "SCENARIO_MISMATCH",
    );
    for (const [i, id] of SCENARIOS.entries()) {
      const s = a.scenarios[i];
      keys(s, "scenarioId g1Verdict gates cleanup");
      requireThat(
        s.scenarioId === id &&
          s.g1Verdict === "PASS" &&
          s.cleanup === cleanup.status,
        "SCENARIO_MISMATCH",
      );
      requireThat(
        Array.isArray(s.gates) && s.gates.length === 3,
        "GATE_MISMATCH",
      );
      const verdict = i === 2 ? "PASS" : "FAIL";
      const codes = i === 2 ? [] : ["HTTP_JSON_TYPE"];
      gate(s.gates[0], "G2", verdict, ids(id, COUNTS[i]), codes);
      gate(
        s.gates[1],
        "G3",
        verdict,
        [`${id}:initial`, ...ids(id, COUNTS[i])],
        codes,
      );
      gate(s.gates[2], "G4", "INCONCLUSIVE", CONTROLS, ["HELD_OUT_NOT_RUN"]);
    }
    same(a.cleanup, cleanup, "CLEANUP_MISMATCH");
  }
  same(
    r.repairLink,
    {
      previousCandidateSha256: P.attempts[0].candidateSha256,
      feedbackCodes: ["HTTP_JSON_TYPE"],
    },
    "REPAIR_LINK_MISMATCH",
  );
  same(
    r.reporting,
    {
      basis: "PER_ATTEMPT_GENERATION_TRIAL",
      intermediateScorecard: "NONFINAL_INCONSISTENT_EXCLUDED",
      finalStopReason: "COMPLETE_PUBLIC_FAIL_AFTER_SIGNED_REPAIR",
    },
    "REPORTING_BASIS_MISMATCH",
  );
  same(
    r.usage,
    {
      confirmedResponses: 2,
      estimatedCostUsd: 0.10929375,
      chargedCostUsd: null,
      usageStatus: "ESTIMATE_ONLY",
    },
    "SESSION_USAGE_MISMATCH",
  );
  same(
    r.finalizer,
    { status: "PASS", containers: 0, volumes: 0, emergencyRemoved: 0 },
    "FINALIZER_MISMATCH",
  );
  requireThat(
    r.aggregateOutcome === "UNCHANGED_PUBLIC_VERDICT_PATTERN" &&
      r.perStepImprovements === "UNKNOWN" &&
      r.rootCause === "UNCONFIRMED" &&
      r.heldOut === "NOT_RUN",
    "CONCLUSION_SCOPE_MISMATCH",
  );
  requireThat(r.product === "NOT_ESTABLISHED", "PRODUCT_PASS_FORBIDDEN");
  return {
    ...r,
    verification: "PINNED_PUBLIC_REPAIR_SUMMARY",
    attempts: r.attempts.map((a) => ({
      ...a,
      gates: Object.fromEntries(a.gates.map((g) => [g.gate, g.verdict])),
      executed: Object.fromEntries(
        a.gates.map((g) => [g.gate, g.executedTestIds]),
      ),
    })),
    receipts: { [P.filename]: r },
  };
}

export async function readTrackF(name, bytes) {
  requireThat(name === P.filename, "FILE_NOT_ALLOWLISTED");
  requireThat(
    bytes instanceof Uint8Array && bytes.byteLength <= MAX_BYTES,
    "SIZE_LIMIT",
  );
  requireThat(bytes.byteLength === P.bytes, "PIN_MISMATCH");
  const copy = Uint8Array.from(bytes);
  const digest = Array.from(
    new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", copy)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  requireThat(digest === P.sha256, "PIN_MISMATCH");
  return validateTrackF(parseStrict(copy));
}
