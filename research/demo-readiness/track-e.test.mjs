import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { request } from "node:http";
import test from "node:test";
import { MAX_BYTES, parseStrict } from "./adapter.mjs";
import { makeServer } from "./serve.mjs";
import { readTrackE, validateTrackE } from "./track-e-adapter.mjs";
import { TRACK_E_PINS as P } from "./track-e-pins.mjs";

const bytes = await readFile(
  new URL(`${P.directory}/${P.filename}`, import.meta.url),
);
const encode = (value) =>
  Buffer.from(typeof value === "string" ? value : JSON.stringify(value));
const changed = (mutate) => {
  const r = JSON.parse(bytes);
  mutate(r);
  return r;
};

test("E retained original PUBLIC archive matches retrieved artifact identity", async () => {
  const original = await readFile(
    new URL("provenance/track-e/public-receipts.zip", import.meta.url),
  );
  assert.equal(original.length, P.provenance.zipBytes);
  assert.equal(
    createHash("sha256").update(original).digest("hex"),
    P.provenance.zipSha256,
  );
});

test("E: pinned original-public projection preserves build PASS, complete executed parity FAIL and unknown billing", async () => {
  const r = await readTrackE(P.filename, bytes);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), P.sha256);
  assert.equal(bytes.length, P.bytes);
  assert.equal(r.verification, "PINNED_PUBLIC_PARITY_SUMMARY");
  assert.deepEqual(r.gates, {
    G0: "INCONCLUSIVE",
    G1: "PASS",
    G2: "FAIL",
    G3: "FAIL",
    G4: "INCONCLUSIVE",
  });
  assert.deepEqual(
    [
      r.executed.G1.length,
      r.executed.G2.length,
      r.executed.G3.length,
      r.executed.G4.length,
    ],
    [6, 17, 20, 27],
  );
  assert.deepEqual(r.coverage, {
    http: 17,
    sqlite: 20,
    requiredHttp: 17,
    requiredSqlite: 20,
  });
  assert.equal(r.generation.chargedCostUsd, null);
  assert.equal(r.generation.estimatedCostUsd, 0.0481795);
  assert.equal(r.sqliteConclusion, "MATCH_WITHIN_COMPARED_MANIFEST");
  assert.equal(r.product, "NOT_ESTABLISHED");
  assert.equal(r.provenance.members.length, 9);
  assert.equal(r.scenarios.length, 3);
  assert.equal(r.receipts[P.filename].heldOut, "NOT_RUN");
  assert.equal(Object.hasOwn(r.receipts[P.filename], "custody"), false);
  assert.throws(() => {
    P.provenance.members[0].sha256 = "0".repeat(64);
  }, TypeError);
});

for (const [label, mutate, code] of [
  ...[
    "runId",
    "headSha",
    "sourceSha",
    "candidateSha256",
    "contextSha256",
    "manifestSha256",
    "requestSha256",
    "artifactId",
    "zipSha256",
  ].map((key) => [
    `changed ${key}`,
    (r) => {
      r.provenance[key] = "untrusted";
    },
    "PROVENANCE_MISMATCH",
  ]),
  [
    "changed attempt",
    (r) => {
      r.provenance.runAttempt = 2;
    },
    "PROVENANCE_MISMATCH",
  ],
  [
    "changed member provenance",
    (r) => {
      r.provenance.members[0].sha256 = "0".repeat(64);
    },
    "PROVENANCE_MISMATCH",
  ],
  [
    "model substitution",
    (r) => {
      r.generation.modelId = "other";
    },
    "GENERATION_OR_USAGE_MISMATCH",
  ],
  [
    "extra response",
    (r) => {
      r.generation.confirmedResponseCount = 2;
    },
    "GENERATION_OR_USAGE_MISMATCH",
  ],
  [
    "fake successful billing",
    (r) => {
      r.generation.chargedCostUsd = 0.0481795;
    },
    "GENERATION_OR_USAGE_MISMATCH",
  ],
  [
    "unknown charge turned to zero",
    (r) => {
      r.generation.chargedCostUsd = 0;
    },
    "GENERATION_OR_USAGE_MISMATCH",
  ],
  [
    "unknown charge erased",
    (r) => {
      delete r.generation.chargedCostUsd;
    },
    "GENERATION_OR_USAGE_MISMATCH",
  ],
  [
    "changed estimate",
    (r) => {
      r.generation.estimatedCostUsd = 0;
    },
    "GENERATION_OR_USAGE_MISMATCH",
  ],
  [
    "scripted generation",
    (r) => {
      r.generation.generationKind = "SCRIPTED";
    },
    "GENERATION_OR_USAGE_MISMATCH",
  ],
  [
    "forged G1 PASS with missing build",
    (r) => {
      r.gates[1].executedTestIds.pop();
    },
    "COVERAGE_MISMATCH",
  ],
  [
    "inflated build count",
    (r) => {
      r.gates[1].executedTestIds.push("made-up:build");
    },
    "COVERAGE_MISMATCH",
  ],
  [
    "changed G1 verdict",
    (r) => {
      r.gates[1].verdict = "FAIL";
    },
    "GATE_MISMATCH",
  ],
  ...[0, 2, 3, 4].map((index) => [
    `forged G${index} PASS`,
    (r) => {
      r.gates[index].verdict = "PASS";
    },
    "GATE_MISMATCH",
  ]),
  [
    "erased HTTP finding",
    (r) => {
      r.gates[2].findingCodes = [];
    },
    "FINDING_MISMATCH",
  ],
  [
    "invented DB mismatch",
    (r) => {
      r.gates[3].findingCodes.push("DB_STATE");
    },
    "FINDING_MISMATCH",
  ],
  [
    "deflated HTTP IDs",
    (r) => {
      r.gates[2].executedTestIds.pop();
    },
    "COVERAGE_MISMATCH",
  ],
  [
    "duplicate SQLite ID",
    (r) => {
      r.gates[3].executedTestIds[1] = r.gates[3].executedTestIds[0];
    },
    "COVERAGE_MISMATCH",
  ],
  ...[0, 99].map((n) => [
    `false HTTP coverage ${n}`,
    (r) => {
      r.coverage.http = n;
    },
    "COVERAGE_MISMATCH",
  ]),
  [
    "false SQLite coverage",
    (r) => {
      r.coverage.sqlite = 19;
    },
    "COVERAGE_MISMATCH",
  ],
  [
    "scenario count",
    (r) => {
      r.scenarios.pop();
    },
    "SCENARIO_MISMATCH",
  ],
  [
    "per-scenario PASS forgery",
    (r) => {
      r.scenarios[0].gates[0].verdict = "PASS";
    },
    "GATE_MISMATCH",
  ],
  [
    "per-scenario erased ID",
    (r) => {
      r.scenarios[1].gates[1].executedTestIds.pop();
    },
    "COVERAGE_MISMATCH",
  ],
  [
    "scope expanded to universal parity",
    (r) => {
      r.sqliteConclusion = "ALL_DATABASE_BEHAVIOR_PASS";
    },
    "CONCLUSION_SCOPE_MISMATCH",
  ],
  [
    "inferred root cause",
    (r) => {
      r.rootCause = "appointment_id";
    },
    "CONCLUSION_SCOPE_MISMATCH",
  ],
  [
    "held-out claim",
    (r) => {
      r.heldOut = "PASS";
    },
    "CONCLUSION_SCOPE_MISMATCH",
  ],
  [
    "product PASS",
    (r) => {
      r.product = "PASS";
    },
    "PRODUCT_PASS_FORBIDDEN",
  ],
  [
    "cleanup resources",
    (r) => {
      r.cleanup.containers = 1;
    },
    "CLEANUP_MISMATCH",
  ],
  [
    "finalizer FAIL",
    (r) => {
      r.finalizer.status = "FAIL";
    },
    "FINALIZER_MISMATCH",
  ],
  [
    "missing gates",
    (r) => {
      delete r.gates;
    },
    "UNKNOWN_OR_MISSING_FIELDS",
  ],
  [
    "candidate plaintext field",
    (r) => {
      r.candidateSource = "CANARY_NOT_EXECUTABLE";
    },
    "UNKNOWN_OR_MISSING_FIELDS",
  ],
  [
    "raw model body",
    (r) => {
      r.rawBody = "CANARY_NOT_EXECUTABLE";
    },
    "UNKNOWN_OR_MISSING_FIELDS",
  ],
  [
    "old owner restore claim",
    (r) => {
      r.ownerRestore = "NOT_RUN";
    },
    "UNKNOWN_OR_MISSING_FIELDS",
  ],
  [
    "untrusted URL",
    (r) => {
      r.provenance.sourceRepository = "https://evil.invalid/CANARY";
    },
    "PROVENANCE_MISMATCH",
  ],
  [
    "untrusted path",
    (r) => {
      r.provenance.members[0].name = "../CANARY";
    },
    "PROVENANCE_MISMATCH",
  ],
  [
    "HTML payload",
    (r) => {
      r.generation.modelId = '<img src=x onerror="CANARY">';
    },
    "GENERATION_OR_USAGE_MISMATCH",
  ],
]) {
  test(`E byte and independent semantic controls reject ${label}`, async () => {
    const r = changed(mutate);
    await assert.rejects(
      readTrackE(P.filename, encode(r)),
      /^Error: PIN_MISMATCH$/,
    );
    assert.throws(() => validateTrackE(r), new RegExp(`^Error: ${code}$`));
  });
}

test("E rejects short, edited, reformatted, malformed, duplicate, invalid UTF-8 and oversized bytes before parsing", async () => {
  const flipped = Buffer.from(bytes);
  flipped[50] ^= 1;
  for (const raw of [
    bytes.subarray(1),
    flipped,
    Buffer.concat([bytes, Buffer.from(" ")]),
    encode('{"format":'),
    encode('{"a":1,"a":2}'),
    Buffer.from([0xff]),
  ])
    await assert.rejects(readTrackE(P.filename, raw), /^Error: PIN_MISMATCH$/);
  await assert.rejects(
    readTrackE(P.filename, new Uint8Array(MAX_BYTES + 1)),
    /^Error: SIZE_LIMIT$/,
  );
  for (const name of [
    "incident.json",
    "../mmp148-track-e-v1.json",
    "https://evil.invalid/summary.json",
    "generation.json",
  ])
    await assert.rejects(
      readTrackE(name, bytes),
      /^Error: FILE_NOT_ALLOWLISTED$/,
    );
  assert.throws(() => parseStrict(encode('{"a":1,"a":2}')), /DUPLICATE_KEY/);
  assert.throws(() => parseStrict(encode('{"__proto__":{}}')), /UNSAFE_KEY/);
  assert.throws(
    () => parseStrict(encode('{"secret":"CANARY"}')),
    /PRIVATE_FIELD/,
  );
});

test("E digests and parses the same memory snapshot across async caller mutation", async () => {
  const input = Uint8Array.from(bytes);
  const result = readTrackE(P.filename, input);
  input.fill(0);
  assert.equal((await result).gates.G2, "FAIL");
});

test("E has exactly one public route; preparation tools, ZIPs, directories and paths stay unserved", async (t) => {
  const server = makeServer();
  await new Promise((accept) => server.listen(0, "127.0.0.1", accept));
  t.after(() => new Promise((accept) => server.close(accept)));
  async function get(path) {
    return new Promise((accept, reject) => {
      const req = request(
        { hostname: "127.0.0.1", port: server.address().port, path },
        (response) => {
          const chunks = [];
          response.on("data", (chunk) => chunks.push(chunk));
          response.on("end", () =>
            accept({
              code: response.statusCode,
              headers: response.headers,
              bytes: Buffer.concat(chunks),
            }),
          );
        },
      );
      req.on("error", reject);
      req.end();
    });
  }
  const result = await get(`/${P.directory}/${P.filename}`);
  assert.equal(result.code, 200);
  await readTrackE(P.filename, result.bytes);
  assert.match(result.headers["content-security-policy"], /default-src 'none'/);
  assert.equal(result.headers["access-control-allow-origin"], undefined);
  for (const path of [
    `/${P.directory}/`,
    `/${P.directory}/${P.filename}?x=1`,
    `/${P.directory}/../${P.filename}`,
    `/${P.directory}/%2e%2e/${P.filename}`,
    `/${P.directory}/candidate.age`,
    `/${P.directory}/public.zip`,
    "/prepare-track-e.py",
    "/provenance/track-e/public-receipts.zip",
    "/track-e.test.mjs",
  ])
    assert.equal((await get(path)).code, 404);
});
