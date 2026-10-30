import { MAX_BYTES } from "./adapter.mjs";
import { REAL_AI_PINS as P } from "./real-ai-pins.mjs";

export const REAL_AI_NAMES = Object.freeze(Object.keys(P.files));
const AUTH =
  "kind actor runId headSha sourceSha contextSha256 manifestSha256 bodySha256 model tariff maxEstimatedUsd method inputTokensUpperEstimate maxOutputTokens worstCaseEstimatedUsd monetaryCap";
const GENERATION =
  "format sourceSha contextSha256 manifestSha256 policy generationKind operation status code attempt action modelId modelVersion requestId inputSha256 responseSha256 candidateSha inputTokens outputTokens cachedInputTokens estimatedCostUsd chargedCostUsd reportedCostUsd priceVersion usageStatus durationMs monetaryCap attemptedRequests networkSend confirmedResponseCount tlsPeerVerified httpStatus authorization provider";
const TRIAL =
  "format headSha sourceSha sourceArchiveSha256 contextSha256 manifestSha256 provider modelId budgetAuth admittedMaxRequestCostUsd modelGeneration aiGeneration publicG1 publicG2 publicG3 G0 G4 product trialRunId candidateSha totalCostUsd generatedRequests attempts cleanup blockers admittedMaxEstimatedRequestCostUsd modelReceipts estimatedCostUsd chargedCostUsd";
const GATES = ["G0", "G1", "G2", "G3", "G4"];
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
function same(actual, expected, code) {
  requireThat(JSON.stringify(actual) === JSON.stringify(expected), code);
}
function array(value, length) {
  requireThat(
    Array.isArray(value) && value.length === length,
    "STRUCTURE_MISMATCH",
  );
}
function generationShape(r) {
  keys(r, GENERATION);
  keys(r.authorization, AUTH);
}
function schema(receipts) {
  generationShape(receipts["generation.json"]);
  keys(receipts["finalizer.json"], "headSha inventory emergencyRemoved status");
  keys(receipts["finalizer.json"].inventory, "containers volumes");
  keys(
    receipts["mmp078-40900698372-attempt.json"],
    `${AUTH} status attemptedRequests chargedCostUsd`,
  );
  const t = receipts["trial.json"];
  keys(t, TRIAL);
  keys(t.budgetAuth, AUTH);
  keys(t.cleanup, "status containers volumes emergencyRemoved");
  array(t.modelReceipts, 1);
  generationShape(t.modelReceipts[0]);
  array(t.attempts, 1);
  const a = t.attempts[0];
  keys(a, "attemptId candidateSha gates coverage pairs");
  keys(a.coverage, "http sqlite requiredHttp requiredSqlite");
  array(a.gates, 5);
  for (const gate of a.gates)
    keys(gate, "gate verdict executedTestIds findingCodes");
  array(a.pairs, 1);
  const pair = a.pairs[0];
  keys(pair, "scenarioId pairId packs cleanup targetLifetimePolicyMs gates");
  array(pair.packs, 2);
  for (const pack of pair.packs) keys(pack, "id sha256");
  array(pair.gates, 0);
}

export async function readRealPinned(name, bytes) {
  requireThat(Object.hasOwn(P.files, name), "FILE_NOT_ALLOWLISTED");
  requireThat(
    bytes instanceof Uint8Array && bytes.byteLength <= MAX_BYTES,
    "SIZE_LIMIT",
  );
  const pin = P.files[name];
  requireThat(bytes.byteLength === pin.bytes, "PIN_MISMATCH");
  bytes = Uint8Array.from(bytes);
  const digest = Array.from(
    new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  requireThat(digest === pin.sha256, "PIN_MISMATCH");
  // Parse ONLY after exact byte verification against this fixed public snapshot.
  // Changed bytes (including duplicate keys, secrets, HTML and invalid UTF-8) cannot
  // reach JSON.parse. Original producer keys include public authorization metadata;
  // the historical parser and its credential-field policy stay unchanged.
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new Error("MALFORMED_JSON");
  }
}

export async function readRealBundle(files) {
  requireThat(
    Array.isArray(files) && files.length === REAL_AI_NAMES.length,
    "INCOMPLETE_BUNDLE",
  );
  requireThat(
    new Set(files.map((f) => f.name)).size === REAL_AI_NAMES.length &&
      files.every((f) => REAL_AI_NAMES.includes(f.name)),
    "FILE_SET_MISMATCH",
  );
  const receipts = Object.fromEntries(
    await Promise.all(
      files.map(async (f) => [f.name, await readRealPinned(f.name, f.bytes)]),
    ),
  );
  schema(receipts);
  const g = receipts["generation.json"];
  const t = receipts["trial.json"];
  const f = receipts["finalizer.json"];
  const auth = g.authorization;
  const attemptReceipt = receipts["mmp078-40900698372-attempt.json"];
  for (const field of [
    "headSha",
    "sourceSha",
    "contextSha256",
    "manifestSha256",
  ])
    requireThat(
      auth[field] === P[field] &&
        t[field] === P[field] &&
        attemptReceipt[field] === P[field],
      "PROVENANCE_MISMATCH",
    );
  for (const field of ["sourceSha", "contextSha256", "manifestSha256"])
    requireThat(g[field] === P[field], "PROVENANCE_MISMATCH");
  requireThat(
    f.headSha === P.headSha &&
      auth.runId === P.runId &&
      t.trialRunId === P.runId &&
      attemptReceipt.runId === P.runId &&
      t.sourceArchiveSha256 === P.sourceArchiveSha256,
    "RUN_MISMATCH",
  );
  same(auth, t.budgetAuth, "AUTH_MISMATCH");
  for (const field of AUTH.split(" "))
    same(attemptReceipt[field], auth[field], "AUTH_MISMATCH");
  same(g, t.modelReceipts[0], "GENERATION_MISMATCH");
  requireThat(
    g.candidateSha === P.candidateSha &&
      t.candidateSha === P.candidateSha &&
      t.attempts[0].candidateSha === P.candidateSha,
    "CANDIDATE_MISMATCH",
  );
  requireThat(
    g.format === "meta-generation-v1" &&
      t.format === "mmp078-public-paid-trial-v1" &&
      g.provider === "meta-model-api" &&
      t.provider === g.provider &&
      g.modelId === "muse-spark-1.3" &&
      t.modelId === g.modelId &&
      auth.model === g.modelId &&
      auth.bodySha256 === g.inputSha256 &&
      auth.tariff === g.priceVersion &&
      auth.kind === g.policy,
    "PRODUCER_MISMATCH",
  );
  requireThat(
    g.generationKind === "REAL_INFERENCE" &&
      g.status === "PASS" &&
      g.operation === "GENERATION" &&
      g.action === "generate" &&
      g.attempt === 1 &&
      g.attemptedRequests === 1 &&
      g.confirmedResponseCount === 1 &&
      g.networkSend === "RESPONSE_RECEIVED" &&
      g.httpStatus === 200 &&
      g.tlsPeerVerified === true &&
      g.code === null &&
      t.generatedRequests === 1 &&
      t.modelGeneration === "GENERATED" &&
      t.aiGeneration === "REAL_INFERENCE_GENERATED",
    "GENERATION_MISMATCH",
  );
  requireThat(
    g.inputTokens === 5818 &&
      g.outputTokens === 9239 &&
      g.cachedInputTokens === 0 &&
      g.estimatedCostUsd === 0.04653825 &&
      t.estimatedCostUsd === g.estimatedCostUsd &&
      g.chargedCostUsd === null &&
      g.reportedCostUsd === null &&
      t.chargedCostUsd === null &&
      t.totalCostUsd === null &&
      g.usageStatus === "ESTIMATE_ONLY" &&
      t.admittedMaxRequestCostUsd === null &&
      t.admittedMaxEstimatedRequestCostUsd === auth.worstCaseEstimatedUsd &&
      attemptReceipt.chargedCostUsd === null &&
      attemptReceipt.attemptedRequests === 1 &&
      attemptReceipt.status === "UNKNOWN",
    "USAGE_MISMATCH",
  );
  const statuses = [
    "INCONCLUSIVE",
    "FAIL",
    "INCONCLUSIVE",
    "INCONCLUSIVE",
    "INCONCLUSIVE",
  ];
  same(
    [t.G0, t.publicG1, t.publicG2, t.publicG3, t.G4],
    statuses,
    "GATE_MISMATCH",
  );
  const a = t.attempts[0];
  same(
    a.gates.map((gate) => gate.gate),
    GATES,
    "GATE_MISMATCH",
  );
  same(
    a.gates.map((gate) => gate.verdict),
    statuses,
    "GATE_MISMATCH",
  );
  same(
    a.gates.map((gate) => gate.executedTestIds),
    [[], ["workshop-business:typecheck"], [], [], []],
    "COVERAGE_MISMATCH",
  );
  same(
    a.gates.map((gate) => gate.findingCodes),
    [
      ["G0_NOT_ESTABLISHED"],
      ["BUILD_FAILED"],
      ["MISSING_COVERAGE"],
      ["MISSING_COVERAGE"],
      ["HELD_OUT_NOT_RUN"],
    ],
    "GATE_MISMATCH",
  );
  same(
    a.coverage,
    { http: 0, sqlite: 0, requiredHttp: 17, requiredSqlite: 20 },
    "COVERAGE_MISMATCH",
  );
  same(t.blockers, ["BUILD_FAILED", "MISSING_COVERAGE"], "GATE_MISMATCH");
  requireThat(t.product === "NOT_ESTABLISHED", "PRODUCT_PASS_FORBIDDEN");
  same(
    t.cleanup,
    {
      status: "VERIFIED_ZERO_RESOURCES",
      containers: 0,
      volumes: 0,
      emergencyRemoved: 0,
    },
    "CLEANUP_MISMATCH",
  );
  same(f.inventory, { containers: 0, volumes: 0 }, "CLEANUP_MISMATCH");
  requireThat(
    f.status === "PASS" &&
      f.emergencyRemoved === 0 &&
      a.pairs[0].cleanup === "VERIFIED_ZERO_RESOURCES",
    "CLEANUP_MISMATCH",
  );
  return {
    verification: "PINNED_REAL_AI_SNAPSHOT",
    label: "REAL_INFERENCE_GENERATED",
    generation: g,
    trial: t,
    finalizer: f,
    gates: Object.fromEntries(GATES.map((gate, i) => [gate, statuses[i]])),
    coverage: a.coverage,
    diagnostics: "UNKNOWN",
    product: "NOT_ESTABLISHED",
    receipts,
  };
}
