import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { request } from "node:http";
import test from "node:test";
import { MAX_BYTES, parseStrict } from "./adapter.mjs";
import { makeServer } from "./serve.mjs";
import { readTrackF, validateTrackF } from "./track-f-adapter.mjs";
import { TRACK_F_PINS as P } from "./track-f-pins.mjs";

const bytes = await readFile(
  new URL(`${P.directory}/${P.filename}`, import.meta.url),
);
const encode = (value) =>
  Buffer.from(typeof value === "string" ? value : JSON.stringify(value));
test("F original PUBLIC ZIP pin and two genuine independently linked failed attempts", async () => {
  const original = await readFile(
    new URL("provenance/track-f/public-receipts.zip", import.meta.url),
  );
  assert.equal(original.length, P.provenance.zipBytes);
  assert.equal(
    createHash("sha256").update(original).digest("hex"),
    P.provenance.zipSha256,
  );
  const r = await readTrackF(P.filename, bytes);
  assert.equal(r.verification, "PINNED_PUBLIC_REPAIR_SUMMARY");
  assert.equal(r.provenance.members.length, 24);
  assert.equal(new Set(r.provenance.members.map((m) => m.name)).size, 24);
  assert.notEqual(r.attempts[0].candidateSha256, r.attempts[1].candidateSha256);
  for (const a of r.attempts) {
    assert.deepEqual(a.gates, {
      G0: "INCONCLUSIVE",
      G1: "PASS",
      G2: "FAIL",
      G3: "FAIL",
      G4: "INCONCLUSIVE",
    });
    assert.deepEqual(
      [
        a.executed.G1.length,
        a.executed.G2.length,
        a.executed.G3.length,
        a.executed.G4.length,
      ],
      [6, 17, 20, 27],
    );
    assert.deepEqual(
      a.scenarios.map((s) => s.gates.map((g) => g.verdict)),
      [
        ["FAIL", "FAIL", "INCONCLUSIVE"],
        ["FAIL", "FAIL", "INCONCLUSIVE"],
        ["PASS", "PASS", "INCONCLUSIVE"],
      ],
    );
    assert.equal(a.generation.confirmedResponseCount, 1);
    assert.equal(a.generation.chargedCostUsd, null);
  }
  assert.equal(
    r.repairLink.previousCandidateSha256,
    r.attempts[0].candidateSha256,
  );
  assert.equal(r.usage.estimatedCostUsd, 0.10929375);
  assert.equal(r.usage.chargedCostUsd, null);
  assert.equal(r.perStepImprovements, "UNKNOWN");
  assert.equal(r.product, "NOT_ESTABLISHED");
  assert.equal(Object.hasOwn(r.receipts[P.filename], "maximumPosts"), false);
  assert.throws(() => {
    P.attempts[1].candidateSha256 = "untrusted";
  }, TypeError);
});

for (const [label, mutate, code] of [
  ...[
    "runId",
    "runAttempt",
    "runStartedAt",
    "workflowConclusion",
    "headSha",
    "sourceSha",
    "sourceArchiveSha256",
    "contextSha256",
    "manifestSha256",
    "artifactId",
    "zipBytes",
    "zipSha256",
  ].map((key) => [
    `changed ${key}`,
    (r) => {
      r.provenance[key] = "untrusted";
    },
    "PROVENANCE_MISMATCH",
  ]),
  [
    "changed member",
    (r) => {
      r.provenance.members[13].sha256 = "0".repeat(64);
    },
    "PROVENANCE_MISMATCH",
  ],
  [
    "third attempt",
    (r) => {
      r.attempts.push(r.attempts[1]);
    },
    "ATTEMPT_ORDER_MISMATCH",
  ],
  [
    "missing repair",
    (r) => {
      r.attempts.pop();
    },
    "ATTEMPT_ORDER_MISMATCH",
  ],
  [
    "reordered attempts",
    (r) => {
      r.attempts.reverse();
    },
    "ATTEMPT_IDENTITY_MISMATCH",
  ],
  ...[0, 1].flatMap((i) => [
    ...[
      "attempt",
      "action",
      "candidateSha256",
      "requestSha256",
      "responseSha256",
      "oracleAttemptId",
    ].map((key) => [
      `attempt ${i + 1} changed ${key}`,
      (r) => {
        r.attempts[i][key] = "untrusted";
      },
      "ATTEMPT_IDENTITY_MISMATCH",
    ]),
    ...[
      "inputTokens",
      "outputTokens",
      "cachedInputTokens",
      "estimatedCostUsd",
      "chargedCostUsd",
      "confirmedResponseCount",
      "httpStatus",
    ].map((key) => [
      `attempt ${i + 1} falsified ${key}`,
      (r) => {
        r.attempts[i].generation[key] = key === "cachedInputTokens" ? 1 : 0;
      },
      "GENERATION_OR_USAGE_MISMATCH",
    ]),
    [
      "scripted response",
      (r) => {
        r.attempts[i].generation.generationKind = "SCRIPTED";
      },
      "GENERATION_OR_USAGE_MISMATCH",
    ],
    ...[0, 2, 3, 4].map((g) => [
      `attempt ${i + 1} forged G${g} PASS`,
      (r) => {
        r.attempts[i].gates[g].verdict = "PASS";
      },
      "GATE_MISMATCH",
    ]),
    [
      "erased build ID",
      (r) => {
        r.attempts[i].gates[1].executedTestIds.pop();
      },
      "COVERAGE_MISMATCH",
    ],
    [
      "erased HTTP ID",
      (r) => {
        r.attempts[i].gates[2].executedTestIds.pop();
      },
      "COVERAGE_MISMATCH",
    ],
    [
      "duplicate SQLite ID",
      (r) => {
        r.attempts[i].gates[3].executedTestIds[1] =
          r.attempts[i].gates[3].executedTestIds[0];
      },
      "COVERAGE_MISMATCH",
    ],
    [
      "invented DB defect",
      (r) => {
        r.attempts[i].gates[3].findingCodes.push("DB_STATE");
      },
      "FINDING_MISMATCH",
    ],
    [
      "inflated coverage",
      (r) => {
        r.attempts[i].coverage.http = 99;
      },
      "COVERAGE_MISMATCH",
    ],
    [
      "erased scenario",
      (r) => {
        r.attempts[i].scenarios.pop();
      },
      "SCENARIO_MISMATCH",
    ],
    [
      "business forged PASS",
      (r) => {
        r.attempts[i].scenarios[0].gates[0].verdict = "PASS";
      },
      "GATE_MISMATCH",
    ],
    [
      "capacity forged FAIL",
      (r) => {
        r.attempts[i].scenarios[2].gates[1].verdict = "FAIL";
      },
      "GATE_MISMATCH",
    ],
    [
      "cleanup failure erased",
      (r) => {
        r.attempts[i].cleanup.containers = 1;
      },
      "CLEANUP_MISMATCH",
    ],
    [
      "private pair data",
      (r) => {
        r.attempts[i].scenarios[0].observations = [];
      },
      "UNKNOWN_OR_MISSING_FIELDS",
    ],
  ]),
  [
    "same repaired candidate",
    (r) => {
      r.attempts[1].candidateSha256 = r.attempts[0].candidateSha256;
    },
    "ATTEMPT_IDENTITY_MISMATCH",
  ],
  [
    "wrong prior candidate",
    (r) => {
      r.repairLink.previousCandidateSha256 = r.attempts[1].candidateSha256;
    },
    "REPAIR_LINK_MISMATCH",
  ],
  [
    "invented detailed feedback",
    (r) => {
      r.repairLink.feedbackCodes.push("appointment_id");
    },
    "REPAIR_LINK_MISMATCH",
  ],
  [
    "intermediate scorecard promoted",
    (r) => {
      r.reporting.basis = "SCORECARD";
    },
    "REPORTING_BASIS_MISMATCH",
  ],
  [
    "old stop reason promoted",
    (r) => {
      r.reporting.finalStopReason = "PUBLIC_FAIL_SIGNED_REPAIR_NOT_IMPLEMENTED";
    },
    "REPORTING_BASIS_MISMATCH",
  ],
  ...["estimatedCostUsd", "chargedCostUsd", "confirmedResponses"].map((key) => [
    `session false ${key}`,
    (r) => {
      r.usage[key] = 0;
    },
    "SESSION_USAGE_MISMATCH",
  ]),
  [
    "invented per-step no improvement",
    (r) => {
      r.perStepImprovements = "NONE";
    },
    "CONCLUSION_SCOPE_MISMATCH",
  ],
  [
    "invented exact root cause",
    (r) => {
      r.rootCause = "number_vs_string";
    },
    "CONCLUSION_SCOPE_MISMATCH",
  ],
  [
    "held-out PASS",
    (r) => {
      r.heldOut = "PASS";
    },
    "CONCLUSION_SCOPE_MISMATCH",
  ],
  [
    "improved aggregate",
    (r) => {
      r.aggregateOutcome = "REPAIRED";
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
    "finalizer failure",
    (r) => {
      r.finalizer.status = "FAIL";
    },
    "FINALIZER_MISMATCH",
  ],
  ...[
    "candidateSource",
    "rawBody",
    "rawResponse",
    "privateDiagnostics",
    "maximumPosts",
    "ownerKey",
  ].map((key) => [
    `extra ${key}`,
    (r) => {
      r[key] = "CANARY";
    },
    "UNKNOWN_OR_MISSING_FIELDS",
  ]),
]) {
  test(`F byte pin and independent semantic control reject ${label}`, async () => {
    const r = JSON.parse(bytes);
    mutate(r);
    await assert.rejects(
      readTrackF(P.filename, encode(r)),
      /^Error: PIN_MISMATCH$/,
    );
    assert.throws(() => validateTrackF(r), new RegExp(`^Error: ${code}$`));
  });
}

test("F pin precedes parse; strict parser rejects duplicate/unsafe/private input", async () => {
  const flipped = Buffer.from(bytes);
  flipped[50] ^= 1;
  for (const input of [
    bytes.subarray(1),
    flipped,
    Buffer.concat([bytes, Buffer.from(" ")]),
    encode('{"a":1,"a":2}'),
    encode('{"format":'),
    Buffer.from([0xff]),
  ])
    await assert.rejects(
      readTrackF(P.filename, input),
      /^Error: PIN_MISMATCH$/,
    );
  await assert.rejects(
    readTrackF(P.filename, new Uint8Array(MAX_BYTES + 1)),
    /^Error: SIZE_LIMIT$/,
  );
  for (const name of [
    "trial.json",
    "../mmp162-track-f-v1.json",
    "https://evil.invalid/summary.json",
    "mmp148-track-e-v1.json",
  ])
    await assert.rejects(
      readTrackF(name, bytes),
      /^Error: FILE_NOT_ALLOWLISTED$/,
    );
  assert.throws(() => parseStrict(encode('{"a":1,"a":2}')), /DUPLICATE_KEY/);
  assert.throws(() => parseStrict(encode('{"__proto__":{}}')), /UNSAFE_KEY/);
  assert.throws(
    () => parseStrict(encode('{"privateDiagnostics":"CANARY"}')),
    /PRIVATE_FIELD/,
  );
});
test("F digest and parse use the same copy despite async caller mutation", async () => {
  const input = Uint8Array.from(bytes);
  const result = readTrackF(P.filename, input);
  input.fill(0);
  assert.equal((await result).attempts[1].gates.G2, "FAIL");
});
test("F only fixed public route is served; archive, helpers, traversal and private names fail closed", async (t) => {
  const server = makeServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const get = (path) =>
    new Promise((resolve, reject) => {
      const req = request(
        { hostname: "127.0.0.1", port: server.address().port, path },
        (res) => {
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () =>
            resolve({
              code: res.statusCode,
              headers: res.headers,
              bytes: Buffer.concat(chunks),
            }),
          );
        },
      );
      req.on("error", reject);
      req.end();
    });
  const r = await get(`/${P.directory}/${P.filename}`);
  assert.equal(r.code, 200);
  await readTrackF(P.filename, r.bytes);
  assert.match(r.headers["content-security-policy"], /default-src 'none'/);
  assert.equal(r.headers["access-control-allow-origin"], undefined);
  for (const path of [
    `/${P.directory}/`,
    `/${P.directory}/${P.filename}?x=1`,
    `/${P.directory}/../${P.filename}`,
    `/${P.directory}/%2e%2e/${P.filename}`,
    `/${P.directory}/candidate.age`,
    "/prepare-track-f.py",
    "/prepare-track-f.test.py",
    "/provenance/track-f/public-receipts.zip",
    "/track-f.test.mjs",
  ])
    assert.equal((await get(path)).code, 404);
});
