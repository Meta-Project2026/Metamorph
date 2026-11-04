import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { MAX_BYTES, parseStrict } from "./adapter.mjs";
import { makeServer } from "./serve.mjs";
import { readTrackG, validateTrackG } from "./track-g-adapter.mjs";
import { TRACK_G_PINS as P } from "./track-g-pins.mjs";

const bytes = await readFile(
  new URL(`${P.directory}/${P.filename}`, import.meta.url),
);
const fresh = () => JSON.parse(bytes.toString());
test("G original public ZIP, API metadata and reproducible source projection", () => {
  const result = spawnSync(
    process.platform === "win32" ? "python" : "python3",
    ["-B", "prepare-track-g.test.py"],
    { cwd: new URL(".", import.meta.url), encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /OK/);
});
test("G source-bound public PASS with exact IDs; synthetic positive is separate", async () => {
  const r = await readTrackG(P.filename, bytes);
  assert.deepEqual(
    r.gates.map((g) => [g.gate, g.verdict, g.executedTestIds.length]),
    [
      ["G0", "INCONCLUSIVE", 0],
      ["G1", "PASS", 6],
      ["G2", "PASS", 17],
      ["G3", "PASS", 20],
      ["G4", "INCONCLUSIVE", 27],
    ],
  );
  assert.equal(r.product, "NOT_ESTABLISHED");
  assert.equal(r.g0RealCandidate, "NOT_RUN");
  assert.notEqual(r.candidateSha256, r.syntheticG0.candidateSha256);
  assert.equal(r.generation.chargedCostUsd, null);
  assert.equal(r.repairs, 0);
  assert.throws(() => {
    P.provenance.headSha = "forged";
  }, TypeError);
});
for (const key of [
  "runId",
  "runAttempt",
  "runStartedAt",
  "headSha",
  "sourceSha",
  "contextSha256",
  "manifestSha256",
  "artifactId",
  "zipSha256",
  "sourceUri",
  "workflowSha256",
])
  test(`G rejects wrong provenance ${key}`, () => {
    const r = fresh();
    r.provenance[key] = "forged";
    assert.throws(() => validateTrackG(r), /PUBLIC_SUCCESS_FACT_MISMATCH/);
  });
const mutations = [
  [
    "candidate SHA",
    (r) => {
      r.candidateSha256 = "0".repeat(64);
    },
  ],
  [
    "Oracle epoch",
    (r) => {
      r.oracleAttemptId = "other-attempt";
    },
  ],
  [
    "missing gate",
    (r) => {
      r.gates.splice(1, 1);
    },
  ],
  [
    "missing G1 coverage",
    (r) => {
      r.gates[1].executedTestIds.pop();
    },
  ],
  [
    "same-count wrong G2 IDs",
    (r) => {
      r.gates[2].executedTestIds[0] = "unexecuted:step-0";
    },
  ],
  [
    "duplicate G3 IDs",
    (r) => {
      r.gates[3].executedTestIds[1] = r.gates[3].executedTestIds[0];
    },
  ],
  [
    "G2 executed but FAIL",
    (r) => {
      r.gates[2].verdict = "FAIL";
    },
  ],
  [
    "G3 executed but INCONCLUSIVE",
    (r) => {
      r.gates[3].verdict = "INCONCLUSIVE";
    },
  ],
  [
    "full counts but finding",
    (r) => {
      r.gates[2].findingCodes = ["HTTP_JSON_TYPE"];
    },
  ],
  [
    "missing scenario",
    (r) => {
      r.scenarios.pop();
    },
  ],
  [
    "pair FAIL beneath aggregate PASS",
    (r) => {
      r.scenarios[0].gates[0].verdict = "FAIL";
    },
  ],
  [
    "pair build unexecuted",
    (r) => {
      r.scenarios[1].g1Verdict = "NOT_RUN";
    },
  ],
  [
    "pair ID from another candidate",
    (r) => {
      r.scenarios[0].pairId = "different-pair";
    },
  ],
  [
    "forged G0 PASS",
    (r) => {
      r.gates[0].verdict = "PASS";
    },
  ],
  [
    "synthetic G0 filling real G0",
    (r) => {
      r.g0RealCandidate = "PASS";
    },
  ],
  [
    "synthetic candidate mixed into real",
    (r) => {
      r.syntheticG0.candidateSha256 = r.candidateSha256;
    },
  ],
  [
    "forged G4 PASS",
    (r) => {
      r.gates[4].verdict = "PASS";
    },
  ],
  [
    "forged top-level G4 PASS",
    (r) => {
      r.g4 = "PASS";
    },
  ],
  [
    "forged product PASS",
    (r) => {
      r.product = "PASS";
    },
  ],
  [
    "forged held-out PASS",
    (r) => {
      r.heldOut = "PASS";
    },
  ],
  [
    "forged custody verification",
    (r) => {
      r.privateCustody = "VERIFIED";
    },
  ],
  [
    "owner summary upgraded to independent",
    (r) => {
      r.syntheticG0.independentEngineAttestation = "PASS";
    },
  ],
  [
    "faked settled charge",
    (r) => {
      r.generation.chargedCostUsd = 0.05568625;
    },
  ],
  [
    "invented repair",
    (r) => {
      r.repairs = 1;
    },
  ],
  [
    "missing cleanup",
    (r) => {
      delete r.cleanup;
    },
  ],
  [
    "failed finalizer",
    (r) => {
      r.finalizer.containers = 1;
    },
  ],
  [
    "unknown raw field",
    (r) => {
      r.rawResponse = "CANARY_DO_NOT_ECHO";
    },
  ],
  [
    "nested raw field",
    (r) => {
      r.scenarios[0].rawDb = "CANARY_DO_NOT_ECHO";
    },
  ],
];
for (const [label, mutate] of mutations)
  test(`G rejects ${label} without echo`, async () => {
    const r = fresh();
    mutate(r);
    assert.throws(
      () => validateTrackG(r),
      /^Error: PUBLIC_SUCCESS_FACT_MISMATCH$/,
    );
    await assert.rejects(
      readTrackG(P.filename, Buffer.from(JSON.stringify(r))),
      /PIN_MISMATCH/,
    );
  });
for (const key of [
  "apiKey",
  "privateKey",
  "rawPrompt",
  "authorization",
  "candidateSource",
  "rawHttp",
  "rawDb",
])
  test(`G rejects sensitive/unreviewed ${key}`, () => {
    const r = fresh();
    r[key] = "CANARY_DO_NOT_ECHO";
    assert.throws(() => validateTrackG(r), /PUBLIC_SUCCESS_FACT_MISMATCH/);
    assert.throws(
      () =>
        validateTrackG(
          parseStrict(Buffer.from(JSON.stringify(r)), [
            "maxOutputTokens",
            "privateCustody",
          ]),
        ),
      /PRIVATE_FIELD|PUBLIC_SUCCESS_FACT_MISMATCH/,
    );
  });
test("G bounded pin-first input handling", async () => {
  await assert.rejects(readTrackG("trial.json", bytes), /FILE_NOT_ALLOWLISTED/);
  await assert.rejects(
    readTrackG(P.filename, new Uint8Array(MAX_BYTES + 1)),
    /SIZE_LIMIT/,
  );
  const changed = Buffer.from(bytes);
  changed[100] ^= 1;
  await assert.rejects(readTrackG(P.filename, changed), /PIN_MISMATCH/);
});
test("G only exact new routes are served; original archives, private and scripts denied", async (t) => {
  const server = makeServer();
  await new Promise((accept) => server.listen(0, "127.0.0.1", accept));
  t.after(() => new Promise((accept) => server.close(accept)));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const path of [
    "/latest.html",
    "/latest.mjs",
    "/track-g-adapter.mjs",
    "/track-g-pins.mjs",
    `/${P.directory}/${P.filename}`,
  ]) {
    const res = await fetch(base + path);
    assert.equal(res.status, 200);
    assert.match(
      res.headers.get("Content-Security-Policy"),
      /default-src 'none'/,
    );
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), null);
  }
  const res = await fetch(`${base}/${P.directory}/${P.filename}`);
  assert.equal(
    createHash("sha256")
      .update(Buffer.from(await res.arrayBuffer()))
      .digest("hex"),
    P.sha256,
  );
  for (const path of [
    "/provenance/track-g/public-receipts.zip",
    "/provenance/track-g/source-api.json",
    "/prepare-track-g.py",
    "/research/mmp-183/linux-docker-result.json",
    "/latest.html?x=1",
    "/evidence/real-ai-41856569137/",
    "/mmp089-private-diagnostics-41856569137-1",
  ])
    assert.equal((await fetch(base + path)).status, 404);
  assert.equal(
    (await fetch(`${base}/latest.html`, { method: "POST" })).status,
    404,
  );
  const html = await readFile(new URL("latest.html", import.meta.url), "utf8");
  const js = await readFile(new URL("latest.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(html, /(?:src|href)="https?:|<style|onclick=/);
  assert.doesNotMatch(
    js,
    /innerHTML|outerHTML|insertAdjacentHTML|\beval\(|new Function|localStorage|document\.cookie/,
  );
});
