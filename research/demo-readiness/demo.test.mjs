import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { request } from "node:http";
import test from "node:test";
import {
  MAX_BYTES,
  parseStrict,
  RECEIPT_NAMES,
  readBundle,
  readFuture,
  readPinned,
} from "./adapter.mjs";
import { PINS } from "./pins.mjs";
import { makeServer } from "./serve.mjs";

const encode = (value) =>
  new TextEncoder().encode(
    typeof value === "string" ? value : JSON.stringify(value),
  );
const readEvidence = (name) =>
  readFile(new URL(`evidence/${name}`, import.meta.url));
const files = await Promise.all(
  RECEIPT_NAMES.map(async (name) => ({
    name,
    bytes: await readEvidence(name),
  })),
);
function future(overrides = {}) {
  // Synthetic hostile-input fixture only. Never emitted as execution evidence.
  return {
    format: "mmp071-model-preview-v1",
    kind: "REAL_MODEL_GENERATION",
    headSha: PINS.headSha,
    sourceSha: PINS.sourceSha,
    candidateSha: "a".repeat(64),
    runId: "123",
    provider: "test-only",
    modelId: "synthetic-validation-input",
    generatedRequests: 1,
    totalCostUsd: null,
    outcome: "FAIL",
    gates: {
      G0: "INCONCLUSIVE",
      G1: "FAIL",
      G2: "NOT_RUN",
      G3: "NOT_RUN",
      G4: "INCONCLUSIVE",
    },
    coverage: null,
    product: "NOT_ESTABLISHED",
    ...overrides,
  };
}

test("exact public snapshot: generation unknowns and deterministic negative control stay separate", async () => {
  const result = await readBundle(files);
  assert.equal(result.verification, "PINNED_PUBLIC_SNAPSHOT");
  assert.equal(result.model.label, "MODEL_GENERATION_NOT_RUN");
  assert.equal(result.model.requests, 0);
  assert.equal(result.model.candidateSha, null);
  assert.equal(result.model.costUsd, null);
  assert.equal(result.model.cleanup.containers, null);
  assert.equal(result.replay.label, "DETERMINISTIC_REPLAY_NOT_AI");
  assert.deepEqual(
    result.replay.attempts.map(
      (a) => a.gates.find((g) => g.gate === "G2").verdict,
    ),
    ["PASS", "FAIL", "PASS"],
  );
  assert.deepEqual(
    result.replay.attempts.map(
      (a) => a.gates.find((g) => g.gate === "G3").verdict,
    ),
    ["PASS", "FAIL", "PASS"],
  );
  assert.equal(result.product, "NOT_ESTABLISHED");
  assert.equal(result.source.actions.length, 5);
  assert.equal(result.source.functions, 11);
  assert.equal(result.source.phpPhysicalLines, 831);
  assert.equal(result.source.phpRegionLines, 439);
  assert.equal(result.replay.cleanup.emergencyRemoved, 0);
});

for (const [label, text, code] of [
  ["malformed", '{"a":', "MALFORMED_JSON"],
  ["trailing input", "{} true", "MALFORMED_JSON"],
  ["array root", "[]", "MALFORMED_JSON"],
  ["null root", "null", "MALFORMED_JSON"],
  ["duplicate key", '{"a":1,"a":2}', "DUPLICATE_KEY"],
  ["escaped duplicate key", '{"a":1,"\\u0061":2}', "DUPLICATE_KEY"],
  ["prototype field", '{"__proto__":{}}', "UNSAFE_KEY"],
  [
    "secret-like nested field",
    '{"nested":{"apiKey":"example-test-only"}}',
    "PRIVATE_FIELD",
  ],
  ["hidden path field", '{"privatePath":"example"}', "PRIVATE_FIELD"],
  ["nonfinite", '{"a":1e999}', "UNSAFE_NUMBER"],
  ["unsafe integer", '{"a":9007199254740992}', "UNSAFE_NUMBER"],
  ["trailing comma", '{"a":1,}', "MALFORMED_JSON"],
  ["leading zero", '{"a":01}', "MALFORMED_JSON"],
  [
    "deep structure",
    `${'{"a":'.repeat(18)}0${"}".repeat(18)}`,
    "STRUCTURE_LIMIT",
  ],
  ["long string", JSON.stringify({ a: "x".repeat(1025) }), "STRING_LIMIT"],
])
  test(`strict parse rejects ${label}`, () =>
    assert.throws(() => parseStrict(encode(text)), new RegExp(code)));

test("oversize and invalid UTF-8 rejected before projection", () => {
  assert.throws(() => parseStrict(new Uint8Array(MAX_BYTES + 1)), /SIZE_LIMIT/);
  assert.throws(() => parseStrict(new Uint8Array([0xff])), /INVALID_UTF8/);
});
test("missing, duplicate, unknown and path-like receipt selections rejected", async () => {
  await assert.rejects(readBundle(files.slice(1)), /INCOMPLETE_BUNDLE/);
  await assert.rejects(
    readBundle([files[0], files[0], ...files.slice(2)]),
    /COVERAGE_MISMATCH/,
  );
  await assert.rejects(
    readPinned("../trial.json", files[0].bytes),
    /FILE_NOT_ALLOWLISTED/,
  );
  await assert.rejects(
    readPinned("https://example.invalid/receipt.json", files[0].bytes),
    /FILE_NOT_ALLOWLISTED/,
  );
});

for (const [label, name, mutate] of [
  [
    "forged model PASS",
    "trial.json",
    (r) => {
      r.publicG1 = "PASS";
      r.modelGeneration = "PASS";
    },
  ],
  [
    "forged negative control PASS",
    "summary.json",
    (r) => {
      r.runs[1].attempts[0].gates[2].verdict = "PASS";
    },
  ],
  [
    "mismatched execution SHA",
    "trial.json",
    (r) => {
      r.headSha = "b".repeat(40);
    },
  ],
  [
    "mismatched source SHA",
    "inventory.json",
    (r) => {
      r.commit = "b".repeat(40);
    },
  ],
  [
    "invented 15 actions",
    "inventory.json",
    (r) => {
      r.apiActionCount = 15;
    },
  ],
  [
    "fabricated complete coverage",
    "summary.json",
    (r) => {
      r.runs[0].attempts[0].coverage.http = 99;
    },
  ],
  [
    "unknown status",
    "trial.json",
    (r) => {
      r.publicG2 = "GREEN";
    },
  ],
  [
    "missing required field",
    "trial.json",
    (r) => {
      delete r.generatedRequests;
    },
  ],
])
  test(`pinned track rejects ${label}`, async () => {
    const receipt = JSON.parse(await readEvidence(name));
    mutate(receipt);
    await assert.rejects(readPinned(name, encode(receipt)), /PIN_MISMATCH/);
  });

test("same JSON with changed bytes is not an authenticated pinned artifact", async () => {
  await assert.rejects(
    readPinned(
      "trial.json",
      encode(JSON.parse(await readEvidence("trial.json"))),
    ),
    /PIN_MISMATCH/,
  );
});
test("user-authored valid future declaration stays NOT_VERIFIED; null cost preserved", () => {
  const result = readFuture("future-model.json", encode(future()));
  assert.equal(result.verification, "NOT_VERIFIED");
  assert.equal(result.receipt.totalCostUsd, null);
  assert.equal(result.product, "NOT_ESTABLISHED");
});
for (const outcome of ["PASS", "FAIL", "ERROR", "INCONCLUSIVE"])
  test(`future ${outcome} never becomes execution proof`, () => {
    const declaration = future({ outcome });
    if (outcome === "PASS") {
      const attempt = JSON.parse(
        files.find((file) => file.name === "summary.json").bytes,
      ).runs[0].attempts[0];
      declaration.gates = Object.fromEntries(
        attempt.gates.map((gate) => [gate.gate, gate.verdict]),
      );
      declaration.coverage = {
        httpIds: attempt.gates.find((gate) => gate.gate === "G2")
          .executedTestIds,
        sqliteIds: attempt.gates.find((gate) => gate.gate === "G3")
          .executedTestIds,
      };
    }
    const result = readFuture("future-model.json", encode(declaration));
    assert.equal(result.verification, "NOT_VERIFIED");
    assert.equal(result.product, "NOT_ESTABLISHED");
  });
for (const [label, change, code] of [
  ["outcome PASS with failed gate", { outcome: "PASS" }, "INCONSISTENT_PASS"],
  ["wrong head", { headSha: "f".repeat(40) }, "EXPECTED_SHA_MISMATCH"],
  ["wrong source", { sourceSha: "f".repeat(40) }, "EXPECTED_SHA_MISMATCH"],
  [
    "missing candidate identity",
    { candidateSha: null },
    "CANDIDATE_ID_REQUIRED",
  ],
  [
    "URL instead of run ID",
    { runId: "https://private.invalid/path" },
    "RUN_ID_REQUIRED",
  ],
  ["zero requests", { generatedRequests: 0 }, "REQUESTS_REQUIRED"],
  ["secret-like field", { secret: "test-only" }, "PRIVATE_FIELD"],
  ["unknown status", { outcome: "GREEN" }, "UNKNOWN_STATUS"],
  ["invented property", { routeCount: 15 }, "UNKNOWN_OR_MISSING_FIELDS"],
  ["forged product PASS", { product: "PASS" }, "PRODUCT_PASS_FORBIDDEN"],
  ["negative cost", { totalCostUsd: -1 }, "INVALID_COST"],
  [
    "PASS without coverage",
    {
      gates: {
        G0: "INCONCLUSIVE",
        G1: "PASS",
        G2: "PASS",
        G3: "PASS",
        G4: "INCONCLUSIVE",
      },
    },
    "PASS_WITHOUT_COVERAGE",
  ],
  [
    "fabricated coverage count",
    { coverage: { http: 17, sqlite: 20 } },
    "UNKNOWN_OR_MISSING_FIELDS",
  ],
  [
    "unknown scenario IDs",
    { coverage: { httpIds: ["made-up:step-0"], sqliteIds: [] } },
    "COVERAGE_MISMATCH",
  ],
  [
    "duplicate coverage IDs",
    {
      coverage: {
        httpIds: ["workshop-business:step-0", "workshop-business:step-0"],
        sqliteIds: [],
      },
    },
    "COVERAGE_MISMATCH",
  ],
])
  test(`future declaration rejects ${label}`, () =>
    assert.throws(
      () => readFuture("future-model.json", encode(future(change))),
      new RegExp(code),
    ));
test("future missing fields rejected, never defaulted to zero or PASS", () => {
  const r = future();
  delete r.totalCostUsd;
  assert.throws(
    () => readFuture("future-model.json", encode(r)),
    /UNKNOWN_OR_MISSING_FIELDS/,
  );
});

test("loopback HTTP serves only fixed viewer assets and selected public JSON", async (t) => {
  const server = makeServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const port = server.address().port;
  async function get(path, method = "GET") {
    return new Promise((resolve, reject) => {
      const req = request(
        { hostname: "127.0.0.1", port, path, method },
        (res) => {
          const chunks = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () =>
            resolve({
              status: res.statusCode,
              headers: res.headers,
              bytes: Buffer.concat(chunks),
            }),
          );
        },
      );
      req.on("error", reject);
      req.end();
    });
  }
  const page = await get("/");
  assert.equal(page.status, 200);
  assert.match(page.headers["content-security-policy"], /default-src 'none'/);
  assert.equal(page.headers["access-control-allow-origin"], undefined);
  assert.equal(page.headers["set-cookie"], undefined);
  for (const name of RECEIPT_NAMES) {
    const response = await get(`/evidence/${name}`);
    assert.equal(response.status, 200);
    await readPinned(name, response.bytes);
  }
  assert.equal((await get("/", "HEAD")).bytes.length, 0);
  for (const path of [
    "/../README.md",
    "/%2e%2e/README.md",
    "/.git/config",
    "/evidence/",
    "/evidence/missing.json",
    "/evidence/trial.json?secret=x",
    "/demo.test.mjs",
    "/README.md",
    "https://example.invalid/",
  ])
    assert.equal((await get(path)).status, 404);
  assert.equal((await get("/", "POST")).status, 404);
});

test("static viewer has no HTML injection, eval, external assets or auto-load", async () => {
  const script = await readFile(new URL("viewer.mjs", import.meta.url), "utf8");
  const html = await readFile(new URL("index.html", import.meta.url), "utf8");
  assert.doesNotMatch(
    script,
    /innerHTML|outerHTML|insertAdjacentHTML|\beval\(|new Function|localStorage|sessionStorage|document\.cookie/,
  );
  assert.doesNotMatch(
    html,
    /<(?:script|style)[^>]*>[^<\s]|(?:src|href)="https?:/,
  );
  assert.match(script, /textContent/);
  assert.match(script, /current !== generation/);
});
