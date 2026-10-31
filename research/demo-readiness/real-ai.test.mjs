import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { MAX_BYTES, readBundle, readFuture } from "./adapter.mjs";
import { PINS } from "./pins.mjs";
import {
  REAL_AI_NAMES,
  readRealBundle,
  readRealPinned,
} from "./real-ai-adapter.mjs";
import { REAL_AI_PINS as P } from "./real-ai-pins.mjs";
import { makeServer } from "./serve.mjs";

const files = await Promise.all(
  REAL_AI_NAMES.map(async (name) => ({
    name,
    bytes: await readFile(new URL(`${P.directory}/${name}`, import.meta.url)),
  })),
);
const encode = (value) => new TextEncoder().encode(JSON.stringify(value));
function changed(name, mutate) {
  return files.map((file) => {
    if (file.name !== name) return file;
    const receipt = JSON.parse(file.bytes);
    mutate(receipt);
    return { name, bytes: encode(receipt) };
  });
}

test("C: original byte-pinned generation PASS stays distinct from G1 FAIL and unknown charge", async () => {
  const result = await readRealBundle([...files].reverse());
  assert.equal(result.verification, "PINNED_REAL_AI_SNAPSHOT");
  assert.equal(result.label, "REAL_INFERENCE_GENERATED");
  assert.equal(result.generation.status, "PASS");
  assert.equal(result.generation.modelId, "muse-spark-1.3");
  assert.equal(result.generation.attemptedRequests, 1);
  assert.equal(result.generation.confirmedResponseCount, 1);
  assert.equal(result.generation.inputTokens, 5818);
  assert.equal(result.generation.outputTokens, 9239);
  assert.equal(result.generation.estimatedCostUsd, 0.04653825);
  assert.equal(result.generation.chargedCostUsd, null);
  assert.equal(result.generation.reportedCostUsd, null);
  assert.deepEqual(result.gates, {
    G0: "INCONCLUSIVE",
    G1: "FAIL",
    G2: "INCONCLUSIVE",
    G3: "INCONCLUSIVE",
    G4: "INCONCLUSIVE",
  });
  assert.deepEqual(result.coverage, {
    http: 0,
    sqlite: 0,
    requiredHttp: 17,
    requiredSqlite: 20,
  });
  assert.equal(result.diagnostics, "UNKNOWN");
  assert.equal(result.product, "NOT_ESTABLISHED");
  assert.equal(result.trial.cleanup.status, "VERIFIED_ZERO_RESOURCES");
  assert.equal(result.finalizer.status, "PASS");
  assert.deepEqual(result.finalizer.inventory, { containers: 0, volumes: 0 });
  assert.equal(result.finalizer.emergencyRemoved, 0);
});

test("C: each original ZIP member matches its independent size/digest pin", () => {
  for (const { name, bytes } of files) {
    assert.equal(bytes.length, P.files[name].bytes);
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      P.files[name].sha256,
    );
  }
  assert.throws(() => {
    P.files["trial.json"].sha256 = "0".repeat(64);
  }, TypeError);
});

test("historical replay, real candidate and synthetic MMP-082 diagnostic are separate identities", async () => {
  const historical = await readBundle(
    await Promise.all(
      Object.keys(PINS.files).map(async (name) => ({
        name,
        bytes: await readFile(new URL(`evidence/${name}`, import.meta.url)),
      })),
    ),
  );
  assert.equal(historical.model.requests, 0);
  assert.equal(historical.model.candidateSha, null);
  assert.deepEqual(
    historical.replay.attempts.map(
      (a) => a.gates.find((g) => g.gate === "G2").verdict,
    ),
    ["PASS", "FAIL", "PASS"],
  );
  assert.notEqual(P.runId, PINS.runId);
  assert.notEqual(P.headSha, PINS.headSha);
  assert.ok(
    historical.replay.attempts.every((a) => a.candidateSha !== P.candidateSha),
  );
  assert.notEqual(
    P.candidateSha,
    "47bc850883ded819c2092fac18743e404c85c581b639cf789e4a572db370d4e2",
  );
  assert.doesNotMatch(
    JSON.stringify((await readRealBundle(files)).receipts),
    /TS2322|compilerDiagnostics/,
  );
});

for (const [label, name, mutate] of [
  [
    "wrong head",
    "trial.json",
    (r) => {
      r.headSha = "f".repeat(40);
    },
  ],
  [
    "wrong source",
    "generation.json",
    (r) => {
      r.sourceSha = "f".repeat(40);
    },
  ],
  [
    "wrong run",
    "trial.json",
    (r) => {
      r.trialRunId = PINS.runId;
    },
  ],
  [
    "wrong authorization run",
    "generation.json",
    (r) => {
      r.authorization.runId = "1";
    },
  ],
  [
    "wrong candidate",
    "trial.json",
    (r) => {
      r.candidateSha = "f".repeat(64);
    },
  ],
  [
    "wrong nested candidate",
    "trial.json",
    (r) => {
      r.attempts[0].candidateSha = "f".repeat(64);
    },
  ],
  [
    "synthetic diagnostic borrowed from MMP-082",
    "trial.json",
    (r) => {
      r.attempts[0].pairs[0].compilerDiagnostics = { code: "TS2322" };
    },
  ],
  [
    "forged G1 PASS",
    "trial.json",
    (r) => {
      r.publicG1 = "PASS";
      r.attempts[0].gates[1].verdict = "PASS";
    },
  ],
  [
    "forged G2 PASS",
    "trial.json",
    (r) => {
      r.publicG2 = "PASS";
    },
  ],
  [
    "forged G3 PASS",
    "trial.json",
    (r) => {
      r.publicG3 = "PASS";
    },
  ],
  [
    "forged G4 PASS",
    "trial.json",
    (r) => {
      r.G4 = "PASS";
    },
  ],
  [
    "forged product PASS",
    "trial.json",
    (r) => {
      r.product = "PASS";
    },
  ],
  [
    "invented estimate",
    "generation.json",
    (r) => {
      r.estimatedCostUsd = 0;
    },
  ],
  [
    "invented settled charge",
    "trial.json",
    (r) => {
      r.chargedCostUsd = 0.04653825;
    },
  ],
  [
    "invented tokens",
    "generation.json",
    (r) => {
      r.outputTokens = 0;
    },
  ],
  [
    "missing provenance",
    "trial.json",
    (r) => {
      delete r.contextSha256;
    },
  ],
  [
    "missing embedded receipt",
    "trial.json",
    (r) => {
      r.modelReceipts = [];
    },
  ],
  [
    "forged coverage",
    "trial.json",
    (r) => {
      r.attempts[0].coverage.http = 17;
      r.attempts[0].coverage.sqlite = 20;
    },
  ],
  [
    "erased failed attempt",
    "trial.json",
    (r) => {
      r.attempts = [];
    },
  ],
  [
    "unknown status",
    "generation.json",
    (r) => {
      r.status = "GREEN";
    },
  ],
  [
    "unknown field",
    "trial.json",
    (r) => {
      r.preview = true;
    },
  ],
  [
    "secret-like field",
    "generation.json",
    (r) => {
      r.apiKey = "test-only";
    },
  ],
  [
    "nested credential",
    "generation.json",
    (r) => {
      r.authorization.password = "test-only";
    },
  ],
  [
    "HTML injection",
    "generation.json",
    (r) => {
      r.modelId = '<img src=x onerror="alert(1)">';
    },
  ],
  [
    "wrong finalizer head",
    "finalizer.json",
    (r) => {
      r.headSha = PINS.headSha;
    },
  ],
  [
    "forged cleanup",
    "trial.json",
    (r) => {
      r.cleanup.volumes = 1;
    },
  ],
  [
    "forged authorization amount",
    "mmp078-40900698372-attempt.json",
    (r) => {
      r.maxEstimatedUsd = 0;
    },
  ],
])
  test(`C rejects ${label}`, async () => {
    await assert.rejects(
      readRealBundle(changed(name, mutate)),
      /^Error: PIN_MISMATCH$/,
    );
  });

test("C rejects one modified byte, whitespace, malformed/duplicate JSON and invalid UTF-8", async () => {
  const original = files[0];
  const byte = Uint8Array.from(original.bytes);
  byte[20] ^= 1;
  for (const bytes of [
    byte,
    encode({}),
    new TextEncoder().encode('{"status":"PASS","status":"FAIL"}'),
    new Uint8Array([0xff]),
    Buffer.concat([original.bytes, Buffer.from(" ")]),
  ])
    await assert.rejects(
      readRealPinned(original.name, bytes),
      /^Error: PIN_MISMATCH$/,
    );
  await assert.rejects(
    readRealPinned(original.name, new Uint8Array(MAX_BYTES + 1)),
    /SIZE_LIMIT/,
  );
});

test("C rejects missing, duplicate, extra, mixed historical and path-like files", async () => {
  for (const selection of [files.slice(1), [...files, files[0]]])
    await assert.rejects(readRealBundle(selection), /INCOMPLETE_BUNDLE/);
  await assert.rejects(
    readRealBundle([files[0], files[0], ...files.slice(2)]),
    /FILE_SET_MISMATCH/,
  );
  for (const name of [
    "../trial.json",
    "future-model.json",
    "https://example.invalid/trial.json",
  ])
    await assert.rejects(
      readRealPinned(name, files[0].bytes),
      /FILE_NOT_ALLOWLISTED/,
    );
  const oldTrial = await readFile(
    new URL("evidence/trial.json", import.meta.url),
  );
  await assert.rejects(
    readRealBundle(
      files.map((f) =>
        f.name === "trial.json" ? { name: f.name, bytes: oldTrial } : f,
      ),
    ),
    /PIN_MISMATCH/,
  );
  assert.throws(() => readFuture("future-model.json", files[0].bytes));
});

test("C public assets served exactly, with no ZIP/source/private/unlisted routes", async (t) => {
  const server = makeServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const file of files) {
    const response = await fetch(`${origin}/${P.directory}/${file.name}`);
    assert.equal(response.status, 200);
    await readRealPinned(
      file.name,
      new Uint8Array(await response.arrayBuffer()),
    );
  }
  for (const path of ["real-ai-pins.mjs", "real-ai-adapter.mjs"])
    assert.equal((await fetch(`${origin}/${path}`)).status, 200);
  for (const path of [
    P.directory,
    `${P.directory}/candidate.ts`,
    `${P.directory}/private.json`,
    `${P.directory}/meta-paid-public-40900698372.zip`,
    "real-ai.test.mjs",
  ])
    assert.equal((await fetch(`${origin}/${path}`)).status, 404);
});
