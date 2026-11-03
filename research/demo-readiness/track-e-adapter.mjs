import { MAX_BYTES, parseStrict } from "./adapter.mjs";
import { TRACK_E_PINS as P } from "./track-e-pins.mjs";

const SCENARIOS = [
  "workshop-business",
  "workshop-rejected",
  "workshop-capacity",
];
const COUNTS = [6, 5, 6];
const GATES = ["G0", "G1", "G2", "G3", "G4"];
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
const ids = (scenario, count) =>
  Array.from({ length: count }, (_, index) => `${scenario}:step-${index}`);
function requireThat(condition, code) {
  if (!condition) throw new Error(code);
}
function keys(value, fields) {
  const expected = fields.split(" ");
  requireThat(
    value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).length === expected.length &&
      expected.every((key) => Object.hasOwn(value, key)),
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

// This independent semantic check follows the byte pin. It prevents a future
// reviewed pin move from silently relabelling this historical run or its scope.
export function validateTrackE(r) {
  keys(
    r,
    "format scope provenance generation gates coverage scenarios cleanup finalizer sqliteConclusion rootCause heldOut product",
  );
  requireThat(
    r.format === "mmp148-public-parity-v1" &&
      r.scope === "RECORDED_PUBLIC_MANIFEST",
    "FORMAT_OR_SCOPE_MISMATCH",
  );
  same(r.provenance, P.provenance, "PROVENANCE_MISMATCH");
  same(
    r.generation,
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
      inputTokens: 6060,
      outputTokens: 9554,
      cachedInputTokens: 0,
      estimatedCostUsd: 0.0481795,
      chargedCostUsd: null,
      usageStatus: "ESTIMATE_ONLY",
    },
    "GENERATION_OR_USAGE_MISMATCH",
  );
  requireThat(
    Array.isArray(r.gates) && r.gates.length === GATES.length,
    "GATE_MISMATCH",
  );
  const builds = SCENARIOS.flatMap((id) => [`${id}:typecheck`, `${id}:build`]);
  const http = SCENARIOS.flatMap((id, index) => ids(id, COUNTS[index]));
  const sqlite = SCENARIOS.flatMap((id, index) => [
    `${id}:initial`,
    ...ids(id, COUNTS[index]),
  ]);
  const controls = SCENARIOS.flatMap((id) =>
    CONTROLS.map((name) => `${id}:${name}`),
  );
  gate(r.gates[0], "G0", "INCONCLUSIVE", [], ["G0_NOT_ESTABLISHED"]);
  gate(r.gates[1], "G1", "PASS", builds, []);
  gate(r.gates[2], "G2", "FAIL", http, ["HTTP_JSON_TYPE"]);
  gate(r.gates[3], "G3", "FAIL", sqlite, ["HTTP_JSON_TYPE"]);
  gate(r.gates[4], "G4", "INCONCLUSIVE", controls, ["HELD_OUT_NOT_RUN"]);
  same(
    r.coverage,
    { http: 17, sqlite: 20, requiredHttp: 17, requiredSqlite: 20 },
    "COVERAGE_MISMATCH",
  );
  requireThat(
    Array.isArray(r.scenarios) && r.scenarios.length === SCENARIOS.length,
    "SCENARIO_MISMATCH",
  );
  for (const [index, id] of SCENARIOS.entries()) {
    const pair = r.scenarios[index];
    keys(pair, "scenarioId g1Verdict gates cleanup");
    requireThat(
      pair.scenarioId === id &&
        pair.g1Verdict === "PASS" &&
        pair.cleanup === "VERIFIED_ZERO_RESOURCES",
      "SCENARIO_MISMATCH",
    );
    requireThat(
      Array.isArray(pair.gates) && pair.gates.length === 3,
      "GATE_MISMATCH",
    );
    gate(pair.gates[0], "G2", "FAIL", ids(id, COUNTS[index]), [
      "HTTP_JSON_TYPE",
    ]);
    gate(
      pair.gates[1],
      "G3",
      "FAIL",
      [`${id}:initial`, ...ids(id, COUNTS[index])],
      ["HTTP_JSON_TYPE"],
    );
    gate(pair.gates[2], "G4", "INCONCLUSIVE", CONTROLS, ["HELD_OUT_NOT_RUN"]);
  }
  same(
    r.cleanup,
    {
      status: "VERIFIED_ZERO_RESOURCES",
      containers: 0,
      volumes: 0,
      emergencyRemoved: 0,
    },
    "CLEANUP_MISMATCH",
  );
  same(
    r.finalizer,
    { status: "PASS", containers: 0, volumes: 0, emergencyRemoved: 0 },
    "FINALIZER_MISMATCH",
  );
  requireThat(
    r.sqliteConclusion === "MATCH_WITHIN_COMPARED_MANIFEST" &&
      r.rootCause === "UNCONFIRMED" &&
      r.heldOut === "NOT_RUN",
    "CONCLUSION_SCOPE_MISMATCH",
  );
  requireThat(r.product === "NOT_ESTABLISHED", "PRODUCT_PASS_FORBIDDEN");
  return {
    verification: "PINNED_PUBLIC_PARITY_SUMMARY",
    provenance: r.provenance,
    generation: r.generation,
    gates: Object.fromEntries(r.gates.map((item) => [item.gate, item.verdict])),
    executed: Object.fromEntries(
      r.gates.map((item) => [item.gate, item.executedTestIds]),
    ),
    coverage: { ...r.coverage },
    scenarios: r.scenarios,
    cleanup: r.cleanup,
    finalizer: r.finalizer,
    sqliteConclusion: r.sqliteConclusion,
    product: r.product,
    receipts: { [P.filename]: r },
  };
}

export async function readTrackE(name, bytes) {
  requireThat(name === P.filename, "FILE_NOT_ALLOWLISTED");
  requireThat(
    bytes instanceof Uint8Array && bytes.byteLength <= MAX_BYTES,
    "SIZE_LIMIT",
  );
  requireThat(bytes.byteLength === P.bytes, "PIN_MISMATCH");
  // Snapshot caller-owned memory before the asynchronous digest, then parse the
  // same copy only after the trusted size/digest pin passes.
  const copy = Uint8Array.from(bytes);
  const digest = Array.from(
    new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", copy)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  requireThat(digest === P.sha256, "PIN_MISMATCH");
  return validateTrackE(parseStrict(copy));
}
