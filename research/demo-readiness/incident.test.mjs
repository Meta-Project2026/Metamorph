import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { request } from "node:http";
import test from "node:test";
import { MAX_BYTES, parseStrict } from "./adapter.mjs";
import { readIncident, validateIncident } from "./incident-adapter.mjs";
import { INCIDENT_PINS as P } from "./incident-pins.mjs";
import { REAL_AI_PINS } from "./real-ai-pins.mjs";
import { makeServer } from "./serve.mjs";

// Only the committed derived summary is the track D input; it is never modified here.
const committed = await readFile(
  new URL("../mmp-104/incident.json", import.meta.url),
);
const encode = (value) =>
  new TextEncoder().encode(
    typeof value === "string" ? value : JSON.stringify(value),
  );
const parsed = () => JSON.parse(committed);
const changed = (mutate) => {
  const receipt = parsed();
  mutate(receipt);
  return receipt;
};

test("D: committed derived summary byte-pins and displays the exact historical facts", async () => {
  assert.equal(committed.length, P.bytes);
  assert.equal(createHash("sha256").update(committed).digest("hex"), P.sha256);
  const result = await readIncident(committed);
  assert.equal(result.verification, "PINNED_INCIDENT_SUMMARY");
  assert.equal(result.runId, "41327197036");
  assert.equal(result.jobId, "124909546925");
  assert.equal(result.headSha, P.headSha);
  assert.equal(result.sourceSha, P.sourceSha);
  assert.equal(result.candidateSha256, P.candidateSha256);
  assert.equal(result.generation.status, "PASS");
  assert.equal(result.generation.generationKind, "REAL_INFERENCE");
  assert.equal(result.generation.modelId, "muse-spark-1.3");
  assert.equal(result.generation.attemptedRequests, 1);
  assert.equal(result.generation.confirmedResponseCount, 1);
  assert.equal(result.generation.httpStatus, 200);
  assert.equal(result.generation.inputTokens, 5985);
  assert.equal(result.generation.outputTokens, 9870);
  assert.equal(result.generation.estimatedCostUsd, 0.04942875);
  assert.equal(result.generation.chargedCostUsd, null);
  assert.equal(result.attemptLedger.status, "UNKNOWN");
  assert.equal(result.attemptLedger.chargedCostUsd, null);
  assert.deepEqual(result.gates, {
    G0: "INCONCLUSIVE",
    G1: "INCONCLUSIVE",
    G2: "ERROR",
    G3: "ERROR",
    G4: "INCONCLUSIVE",
  });
  assert.deepEqual(result.executed.G1, [
    "workshop-business:typecheck",
    "workshop-business:build",
  ]);
  assert.deepEqual(result.executed.G3, ["workshop-business:initial"]);
  assert.deepEqual(result.coverage, {
    http: 0,
    sqlite: 1,
    requiredHttp: 17,
    requiredSqlite: 20,
  });
  assert.deepEqual(result.firstPair, {
    scenarioId: "workshop-business",
    g1Verdict: "PASS",
    diagnosticStatus: "DIAGNOSTIC_UNAVAILABLE",
    cleanup: "VERIFIED_ZERO_RESOURCES",
  });
  assert.equal(result.cleanup.status, "VERIFIED_ZERO_RESOURCES");
  assert.equal(result.finalizer.status, "PASS");
  assert.equal(result.finalizer.emergencyRemoved, 0);
  assert.deepEqual(result.preservation, {
    status: "NOT_APPLICABLE",
    identity: null,
    ciphertextSha256: null,
    ciphertextBytes: null,
    upload: "NOT_RUN",
  });
  assert.equal(result.product, "NOT_ESTABLISHED");
  assert.equal(result.historicalRootCause, "UNKNOWN");
  assert.equal(result.historicalCandidateSource, "UNAVAILABLE");
  assert.equal(result.privateOperationPacks, "UNAVAILABLE");
  assert.equal(result.stageClassification, "NOT_RECORDED");
  assert.equal(
    result.receipts["incident.json"].format,
    "mmp104-public-incident-v1",
  );
  assert.doesNotMatch(
    JSON.stringify(result),
    /<img|onerror|<script|apiKey|password|secret/i,
  );
});

test("D stays a distinct identity from replay B, real run C and its estimate", () => {
  assert.notEqual(P.runId, "40793819074");
  assert.notEqual(P.runId, REAL_AI_PINS.runId);
  assert.notEqual(P.headSha, REAL_AI_PINS.headSha);
  assert.notEqual(P.candidateSha256, REAL_AI_PINS.candidateSha256);
  assert.notEqual(P.estimatedCostUsd, 0.04653825);
  const gates = validateIncident(parsed()).gates;
  assert.notEqual(gates.G1, "FAIL");
  assert.notEqual(gates.G2, "INCONCLUSIVE");
  assert.notEqual(gates.G3, "INCONCLUSIVE");
});

test("D rejects changed, whitespace, malformed, duplicate-key, invalid-UTF-8 and oversize bytes", async () => {
  const flipped = Uint8Array.from(committed);
  flipped[10] ^= 1;
  for (const bytes of [
    flipped,
    Buffer.concat([committed, Buffer.from(" ")]),
    Buffer.concat([Buffer.from(" "), committed]),
    encode(parsed()),
    encode({ format: "mmp104-public-incident-v1" }),
    encode('{"runId":"1","runId":"2"}'),
    new Uint8Array([0xff]),
  ])
    await assert.rejects(readIncident(bytes), /^Error: PIN_MISMATCH$/);
  await assert.rejects(
    readIncident(new Uint8Array(MAX_BYTES + 1)),
    /^Error: SIZE_LIMIT$/,
  );
});

test("bounded strict parser still guards D: privateOperationPacks allowlisted, secrets rejected", () => {
  assert.throws(() => parseStrict(committed), /PRIVATE_FIELD/);
  const opened = parseStrict(committed, ["privateOperationPacks"]);
  assert.equal(opened.privateOperationPacks, "UNAVAILABLE");
  assert.throws(
    () => parseStrict(encode({ format: "x", apiKey: "test-only" })),
    /PRIVATE_FIELD/,
  );
  assert.throws(() => parseStrict(encode('{"a":1,"a":2}')), /DUPLICATE_KEY/);
  assert.throws(
    () => parseStrict(encode({ a: { privatePack: "x" } })),
    /PRIVATE_FIELD/,
  );
});

for (const [label, mutate, code] of [
  [
    "forged aggregate G1 PASS",
    (r) => {
      r.gates[1].verdict = "PASS";
    },
    "GATE_MISMATCH",
  ],
  [
    "forged G2 PASS",
    (r) => {
      r.gates[2].verdict = "PASS";
    },
    "GATE_MISMATCH",
  ],
  [
    "forged G3 PASS",
    (r) => {
      r.gates[3].verdict = "PASS";
    },
    "GATE_MISMATCH",
  ],
  [
    "forged G2/G3 full HTTP coverage 17/17",
    (r) => {
      r.coverage.http = 17;
    },
    "COVERAGE_MISMATCH",
  ],
  [
    "forged G3 full SQLite coverage 20/20",
    (r) => {
      r.coverage.sqlite = 20;
    },
    "COVERAGE_MISMATCH",
  ],
  [
    "inflated G1 executed build IDs",
    (r) => {
      r.gates[1].executedTestIds.push("workshop-capacity:build");
    },
    "COVERAGE_MISMATCH",
  ],
  [
    "inflated G2 executed HTTP IDs",
    (r) => {
      r.gates[2].executedTestIds.push("workshop-business:step-0");
    },
    "COVERAGE_MISMATCH",
  ],
  [
    "erased G4 held-out IDs",
    (r) => {
      r.gates[4].executedTestIds = [];
    },
    "COVERAGE_MISMATCH",
  ],
  [
    "wrong run ID",
    (r) => {
      r.runId = REAL_AI_PINS.runId;
    },
    "RUN_MISMATCH",
  ],
  [
    "wrong job ID",
    (r) => {
      r.jobId = "1";
    },
    "RUN_MISMATCH",
  ],
  [
    "wrong head SHA",
    (r) => {
      r.headSha = "f".repeat(40);
    },
    "PROVENANCE_MISMATCH",
  ],
  [
    "wrong source SHA",
    (r) => {
      r.sourceSha = "e".repeat(40);
    },
    "PROVENANCE_MISMATCH",
  ],
  [
    "wrong candidate SHA",
    (r) => {
      r.candidateSha256 = REAL_AI_PINS.candidateSha256;
    },
    "CANDIDATE_MISMATCH",
  ],
  [
    "wrong context SHA",
    (r) => {
      r.contextSha256 = REAL_AI_PINS.contextSha256;
    },
    "PROVENANCE_MISMATCH",
  ],
  [
    "wrong artifact ID",
    (r) => {
      r.artifactIds.public = "1";
    },
    "RUN_MISMATCH",
  ],
  [
    "tampered member identity",
    (r) => {
      r.files[0].sha256 = "f".repeat(64);
    },
    "MEMBER_MISMATCH",
  ],
  [
    "dropped member",
    (r) => {
      r.files.pop();
    },
    "MEMBER_MISMATCH",
  ],
  [
    "zeroed generation cost",
    (r) => {
      r.generation.estimatedCostUsd = 0;
    },
    "GENERATION_MISMATCH",
  ],
  [
    "forged settled charge",
    (r) => {
      r.generation.chargedCostUsd = 0.04942875;
    },
    "GENERATION_MISMATCH",
  ],
  [
    "zeroed ledger charge",
    (r) => {
      r.attemptLedger.chargedCostUsd = 0;
    },
    "LEDGER_MISMATCH",
  ],
  [
    "settled attempt ledger",
    (r) => {
      r.attemptLedger.status = "SETTLED";
    },
    "LEDGER_MISMATCH",
  ],
  [
    "invented tokens",
    (r) => {
      r.generation.outputTokens = 0;
    },
    "GENERATION_MISMATCH",
  ],
  [
    "swapped model",
    (r) => {
      r.generation.modelId = "another-model";
    },
    "GENERATION_MISMATCH",
  ],
  [
    "failed generation",
    (r) => {
      r.generation.status = "FAIL";
    },
    "GENERATION_MISMATCH",
  ],
  [
    "forged cleanup",
    (r) => {
      r.cleanup.volumes = 1;
    },
    "CLEANUP_MISMATCH",
  ],
  [
    "failed finalizer",
    (r) => {
      r.finalizer.status = "FAIL";
    },
    "CLEANUP_MISMATCH",
  ],
  [
    "invented emergency removal",
    (r) => {
      r.finalizer.emergencyRemoved = 2;
    },
    "CLEANUP_MISMATCH",
  ],
  [
    "fabricated preservation",
    (r) => {
      r.preservation.status = "PRESERVED";
    },
    "PRESERVATION_MISMATCH",
  ],
  [
    "fabricated ciphertext upload",
    (r) => {
      r.preservation.upload = "UPLOADED";
      r.preservation.ciphertextSha256 = "a".repeat(64);
    },
    "PRESERVATION_MISMATCH",
  ],
  [
    "tampered policy digest",
    (r) => {
      r.policy.main = "f".repeat(40);
    },
    "POLICY_MISMATCH",
  ],
  [
    "failed pair build",
    (r) => {
      r.firstPair.g1Verdict = "FAIL";
    },
    "PAIR_MISMATCH",
  ],
  [
    "invented pair diagnostics",
    (r) => {
      r.firstPair.diagnosticStatus = "DIAGNOSTIC_COMPLETE";
    },
    "PAIR_MISMATCH",
  ],
  [
    "forged product PASS",
    (r) => {
      r.product = "PASS";
    },
    "PRODUCT_PASS_FORBIDDEN",
  ],
  [
    "forged G0 PASS",
    (r) => {
      r.G0 = "PASS";
    },
    "GATE_MISMATCH",
  ],
  [
    "forged G4 PASS",
    (r) => {
      r.G4 = "PASS";
    },
    "GATE_MISMATCH",
  ],
  [
    "invented historical root cause",
    (r) => {
      r.historicalRootCause = "TS_COMPILER_ERROR";
    },
    "ROOT_CAUSE_CLAIMED",
  ],
  [
    "invented restored candidate source",
    (r) => {
      r.historicalCandidateSource = "RESTORED";
    },
    "HISTORY_MISMATCH",
  ],
  [
    "invented private pack retrieval",
    (r) => {
      r.privateOperationPacks = "RETRIEVED";
    },
    "HISTORY_MISMATCH",
  ],
  [
    "falsely established stage telemetry",
    (r) => {
      r.stageClassification = "RECORDED";
    },
    "HISTORY_MISMATCH",
  ],
  [
    "unknown extra field",
    (r) => {
      r.preview = true;
    },
    "UNKNOWN_OR_MISSING_FIELDS",
  ],
  [
    "secret-like extra field",
    (r) => {
      r.providerApiKey = "test-only";
    },
    "UNKNOWN_OR_MISSING_FIELDS",
  ],
  [
    "HTML in model field",
    (r) => {
      r.generation.modelId = '<img src=x onerror="alert(1)">';
    },
    "GENERATION_MISMATCH",
  ],
  [
    "missing generation object",
    (r) => {
      delete r.generation;
    },
    "UNKNOWN_OR_MISSING_FIELDS",
  ],
  [
    "missing coverage",
    (r) => {
      delete r.coverage;
    },
    "UNKNOWN_OR_MISSING_FIELDS",
  ],
  [
    "dropped gate",
    (r) => {
      r.gates.pop();
    },
    "GATE_MISMATCH",
  ],
])
  test(`D semantic validation rejects ${label}`, () => {
    assert.throws(
      () => validateIncident(changed(mutate)),
      new RegExp(`^Error: ${code}$`),
    );
  });

test("fixed error codes never echo receipt content or paths", () => {
  const canary = changed((r) => {
    r.runId = "canary-run-98765";
  });
  try {
    validateIncident(canary);
    assert.fail("expected rejection");
  } catch (error) {
    assert.match(error.message, /^RUN_MISMATCH$/);
    assert.doesNotMatch(error.message, /canary/);
  }
});

test("D is served at exactly one fixed route with pinned bytes and no traversal", async (t) => {
  const server = makeServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(`${origin}/evidence/mmp-104/incident.json`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /application\/json/);
  const bytes = new Uint8Array(await response.arrayBuffer());
  await readIncident(bytes);
  for (const path of ["incident-adapter.mjs", "incident-pins.mjs"])
    assert.equal((await fetch(`${origin}/${path}`)).status, 200, path);
  for (const path of [
    "/evidence/mmp-104/",
    "/evidence/mmp-104/private.json",
    "/evidence/mmp-104/incident.json?x=1",
    "/evidence/mmp-104/public.zip",
    "/mmp-104/incident.json",
    "/evidence/incident.json",
    "/evidence/mmp-104/incident.json/",
    "/incident-adapter.test.mjs",
  ])
    assert.equal((await fetch(`${origin}${path}`)).status, 404, path);
  async function raw(path) {
    return new Promise((resolve, reject) => {
      const req = request(
        { hostname: "127.0.0.1", port: server.address().port, path },
        (res) => res.resume().on("end", () => resolve(res.statusCode)),
      );
      req.on("error", reject);
      req.end();
    });
  }
  for (const path of [
    "/evidence/mmp-104/../incident.json",
    "/evidence/mmp-104/%2e%2e/incident.json",
    "/../mmp-104/incident.json",
  ])
    assert.equal(await raw(path), 404, path);
  assert.equal(await raw("/evidence/mmp-104/incident.json"), 200);
});
