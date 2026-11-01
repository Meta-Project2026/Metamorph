import { MAX_BYTES, parseStrict } from "./adapter.mjs";
import { INCIDENT_PINS as P } from "./incident-pins.mjs";

const GATES = ["G0", "G1", "G2", "G3", "G4"];
const G4_IDS = [
  "workshop-business:http-positive",
  "workshop-business:http-key-order",
  "workshop-business:http-status-mutant",
  "workshop-business:http-type-mutant",
  "workshop-business:http-missing-mutant",
  "workshop-business:http-order-mutant",
  "workshop-business:db-positive",
  "workshop-business:db-row-mutant",
  "workshop-business:db-sequence-mutant",
];
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

// Semantic bind of every displayed fact to the reviewed historical summary. Runs after the
// byte pin; if the pin ever moves through a reviewed change, a summary that contradicts the
// historical run 41327197036 facts still fails closed. Fixed codes only, never receipt text.
export function validateIncident(receipt) {
  keys(
    receipt,
    "format runId jobId headSha artifactIds files candidateSha256 sourceSha sourceArchiveSha256 contextSha256 manifestSha256 requestSha256 generation gates coverage firstPair cleanup finalizer preservation policy attemptLedger product G0 G4 historicalRootCause historicalCandidateSource privateOperationPacks stageClassification",
  );
  requireThat(receipt.format === "mmp104-public-incident-v1", "UNKNOWN_FORMAT");
  requireThat(
    receipt.runId === P.runId && receipt.jobId === P.jobId,
    "RUN_MISMATCH",
  );
  requireThat(
    receipt.headSha === P.headSha &&
      receipt.sourceSha === P.sourceSha &&
      receipt.sourceArchiveSha256 === P.sourceArchiveSha256 &&
      receipt.contextSha256 === P.contextSha256 &&
      receipt.manifestSha256 === P.manifestSha256 &&
      receipt.requestSha256 === P.requestSha256,
    "PROVENANCE_MISMATCH",
  );
  requireThat(
    receipt.candidateSha256 === P.candidateSha256,
    "CANDIDATE_MISMATCH",
  );
  keys(receipt.artifactIds, "public policy");
  requireThat(
    receipt.artifactIds.public === P.artifactIds.public &&
      receipt.artifactIds.policy === P.artifactIds.policy,
    "RUN_MISMATCH",
  );
  requireThat(
    Array.isArray(receipt.files) && receipt.files.length === P.members.length,
    "MEMBER_MISMATCH",
  );
  receipt.files.forEach((file, i) => {
    keys(file, "name bytes sha256");
    same(file, P.members[i], "MEMBER_MISMATCH");
  });
  const g = receipt.generation;
  keys(
    g,
    "status generationKind modelId attemptedRequests confirmedResponseCount httpStatus networkSend inputTokens outputTokens cachedInputTokens estimatedCostUsd chargedCostUsd",
  );
  requireThat(
    g.status === "PASS" &&
      g.generationKind === "REAL_INFERENCE" &&
      g.modelId === P.modelId &&
      g.attemptedRequests === 1 &&
      g.confirmedResponseCount === 1 &&
      g.httpStatus === 200 &&
      g.networkSend === "RESPONSE_RECEIVED" &&
      g.inputTokens === 5985 &&
      g.outputTokens === 9870 &&
      g.cachedInputTokens === 0 &&
      g.estimatedCostUsd === P.estimatedCostUsd &&
      g.chargedCostUsd === null,
    "GENERATION_MISMATCH",
  );
  requireThat(
    Array.isArray(receipt.gates) && receipt.gates.length === GATES.length,
    "GATE_MISMATCH",
  );
  for (const gate of receipt.gates)
    keys(gate, "gate verdict executedTestIds findingCodes");
  same(
    receipt.gates.map((gate) => gate.gate),
    GATES,
    "GATE_MISMATCH",
  );
  same(
    receipt.gates.map((gate) => gate.verdict),
    ["INCONCLUSIVE", "INCONCLUSIVE", "ERROR", "ERROR", "INCONCLUSIVE"],
    "GATE_MISMATCH",
  );
  same(
    receipt.gates.map((gate) => gate.findingCodes),
    [
      ["G0_NOT_ESTABLISHED"],
      ["BUILD_NOT_RUN"],
      ["VERIFIER_ERROR"],
      ["VERIFIER_ERROR"],
      ["HELD_OUT_NOT_RUN"],
    ],
    "GATE_MISMATCH",
  );
  same(receipt.gates[0].executedTestIds, [], "COVERAGE_MISMATCH");
  same(
    receipt.gates[1].executedTestIds,
    ["workshop-business:typecheck", "workshop-business:build"],
    "COVERAGE_MISMATCH",
  );
  same(receipt.gates[2].executedTestIds, [], "COVERAGE_MISMATCH");
  same(
    receipt.gates[3].executedTestIds,
    ["workshop-business:initial"],
    "COVERAGE_MISMATCH",
  );
  same(receipt.gates[4].executedTestIds, G4_IDS, "COVERAGE_MISMATCH");
  same(
    receipt.coverage,
    { http: 0, sqlite: 1, requiredHttp: 17, requiredSqlite: 20 },
    "COVERAGE_MISMATCH",
  );
  const pair = receipt.firstPair;
  keys(pair, "scenarioId g1Verdict diagnosticStatus cleanup");
  requireThat(
    pair.scenarioId === "workshop-business" &&
      pair.g1Verdict === "PASS" &&
      pair.diagnosticStatus === "DIAGNOSTIC_UNAVAILABLE" &&
      pair.cleanup === "VERIFIED_ZERO_RESOURCES",
    "PAIR_MISMATCH",
  );
  keys(receipt.cleanup, "status containers volumes emergencyRemoved");
  same(
    receipt.cleanup,
    {
      status: "VERIFIED_ZERO_RESOURCES",
      containers: 0,
      volumes: 0,
      emergencyRemoved: 0,
    },
    "CLEANUP_MISMATCH",
  );
  keys(receipt.finalizer, "status containers volumes emergencyRemoved");
  same(
    receipt.finalizer,
    { status: "PASS", containers: 0, volumes: 0, emergencyRemoved: 0 },
    "CLEANUP_MISMATCH",
  );
  keys(
    receipt.preservation,
    "status identity ciphertextSha256 ciphertextBytes upload",
  );
  same(
    receipt.preservation,
    {
      status: "NOT_APPLICABLE",
      identity: null,
      ciphertextSha256: null,
      ciphertextBytes: null,
      upload: "NOT_RUN",
    },
    "PRESERVATION_MISMATCH",
  );
  keys(receipt.policy, "status main reviewers waitTimer branch");
  same(
    receipt.policy,
    {
      status: "VERIFIED",
      main: P.headSha,
      reviewers: 0,
      waitTimer: 0,
      branch: "main",
    },
    "POLICY_MISMATCH",
  );
  keys(
    receipt.attemptLedger,
    "actor runId status attemptedRequests chargedCostUsd",
  );
  requireThat(
    receipt.attemptLedger.actor === P.actor &&
      receipt.attemptLedger.runId === P.runId &&
      receipt.attemptLedger.status === "UNKNOWN" &&
      receipt.attemptLedger.attemptedRequests === 1 &&
      receipt.attemptLedger.chargedCostUsd === null,
    "LEDGER_MISMATCH",
  );
  requireThat(receipt.product === "NOT_ESTABLISHED", "PRODUCT_PASS_FORBIDDEN");
  requireThat(
    receipt.G0 === "INCONCLUSIVE" && receipt.G4 === "INCONCLUSIVE",
    "GATE_MISMATCH",
  );
  requireThat(receipt.historicalRootCause === "UNKNOWN", "ROOT_CAUSE_CLAIMED");
  requireThat(
    receipt.historicalCandidateSource === "UNAVAILABLE" &&
      receipt.privateOperationPacks === "UNAVAILABLE" &&
      receipt.stageClassification === "NOT_RECORDED",
    "HISTORY_MISMATCH",
  );
  return {
    verification: "PINNED_INCIDENT_SUMMARY",
    label: "REAL_INFERENCE_GENERATED — VERIFIER_ERROR",
    runId: P.runId,
    jobId: P.jobId,
    headSha: P.headSha,
    sourceSha: P.sourceSha,
    candidateSha256: P.candidateSha256,
    summarySourcePath: P.sourcePath,
    summaryBytes: P.bytes,
    summarySha256: P.sha256,
    generation: { ...g },
    gates: Object.fromEntries(
      receipt.gates.map((gate) => [gate.gate, gate.verdict]),
    ),
    executed: Object.fromEntries(
      receipt.gates.map((gate) => [gate.gate, gate.executedTestIds]),
    ),
    coverage: { ...receipt.coverage },
    firstPair: { ...pair },
    cleanup: { ...receipt.cleanup },
    finalizer: { ...receipt.finalizer },
    preservation: { ...receipt.preservation },
    attemptLedger: {
      status: receipt.attemptLedger.status,
      attemptedRequests: receipt.attemptLedger.attemptedRequests,
      chargedCostUsd: receipt.attemptLedger.chargedCostUsd,
    },
    product: receipt.product,
    historicalRootCause: receipt.historicalRootCause,
    historicalCandidateSource: receipt.historicalCandidateSource,
    privateOperationPacks: receipt.privateOperationPacks,
    stageClassification: receipt.stageClassification,
    receipts: { "incident.json": receipt },
  };
}

export async function readIncident(bytes) {
  requireThat(
    bytes instanceof Uint8Array && bytes.byteLength <= MAX_BYTES,
    "SIZE_LIMIT",
  );
  requireThat(bytes.byteLength === P.bytes, "PIN_MISMATCH");
  const digest = Array.from(
    new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  requireThat(digest === P.sha256, "PIN_MISMATCH");
  // Parse only after exact byte verification. The bounded strict parser still applies
  // (duplicate/prototype/secret-like keys, unsafe numbers, invalid UTF-8) so a future pin
  // change cannot smuggle hostile JSON past this adapter. "privateOperationPacks" is a
  // producer fact-field name, not a credential, and is allowlisted for this path only.
  return validateIncident(parseStrict(bytes, ["privateOperationPacks"]));
}
