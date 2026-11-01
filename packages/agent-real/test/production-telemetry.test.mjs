// Original inert adapters only. Exercise production Oracle and public projector.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import fsPromises from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import test from "node:test";
import { completedFixture } from "../../../research/mmp-097/synthetic-fixture.mjs";
import { retainOracle } from "../../differential/src/private-run.mjs";
import { failureTelemetryRecorder } from "../../oracle/dist/failure-telemetry.js";
import {
  createFailureTelemetry,
  FAILURE_STAGES,
  FAILURE_TELEMETRY_MAX_BYTES,
  finishFailureTelemetry,
  MANIFEST,
  PrivateEvidence,
  projectFailureTelemetry,
  SOURCE,
  unavailableFailureTelemetry,
  validateFailureTelemetry,
  verifyPair,
} from "../../oracle/dist/index.js";
import {
  collectPreservationPackage,
  preservationIdentity,
} from "../src/candidate-retention.mjs";
import {
  aggregateAttempt,
  bindPairFailureTelemetry,
  publicAttempt,
} from "../src/report.mjs";
import { bindCancellation } from "../src/runtime.mjs";

const SECRET = "SYNTHETIC_PRIVATE_SOURCE_HTTP_SQL_PROVIDER_MUST_NOT_EXPORT";
const binding = () => ({
  runId: "104003",
  headSha: "a".repeat(40),
  sourceSha: SOURCE.commit,
  candidateSha: "b".repeat(64),
  attemptId: "11111111-1111-4111-8111-111111111111",
  pairId: "22222222-2222-4222-8222-222222222222",
});
const context = (overrides = {}, index = 0) =>
  createFailureTelemetry({ ...binding(), ...overrides }, index);
const clone = (value) => JSON.parse(JSON.stringify(value));
const hostile = () =>
  Object.create(
    null,
    Object.fromEntries(
      ["message", "stack", "code", "stage", "name"].map((k) => [
        k,
        {
          get() {
            throw new Error("MUST_NOT_READ_EXCEPTION");
          },
        },
      ]),
    ),
  );
const temporary = (t) => {
  const root = mkdtempSync(join(tmpdir(), "mmp104-prod-inert-"));
  t.after(() => {
    assert.equal(root, resolve(root));
    assert.ok(root.startsWith(join(resolve(tmpdir()), "mmp104-prod-inert-")));
    rmSync(root, { recursive: true, force: true });
  });
  return root;
};
const snapshot = () => ({
  format: "sqlite-logical-v1",
  schema: [],
  tables: [],
});
const malformedSnapshot = () => ({
  ...snapshot(),
  tables: [{ name: "inert", columns: [], primaryKey: [], rows: [] }],
});
const stepFor = (stage) =>
  /_OBSERVATION_CLONE$/.test(stage)
    ? null
    : /_RESET$|_CLOSE$|_INITIAL_SNAPSHOT$/.test(stage) ||
        stage === "DB_INITIAL_COMPARE" ||
        stage.startsWith("EVIDENCE_INITIAL_") ||
        ["EVIDENCE_CONTROLS_WRITE", "EVIDENCE_PUBLICATION_WRITE"].includes(
          stage,
        )
      ? null
      : 0;
function boundedRecord(record, ctx) {
  assert.equal(validateFailureTelemetry(record, ctx).ok, true);
  assert.ok(
    Buffer.byteLength(JSON.stringify(record)) <= FAILURE_TELEMETRY_MAX_BYTES,
  );
  assert.doesNotMatch(
    JSON.stringify(record),
    /SYNTHETIC_PRIVATE|MUST_NOT_READ|stdout|stderr|rawError|stack|toJSON|HELD_OUT_G4/,
  );
  assert.equal(Object.isFrozen(record), true);
  assert.equal(Object.isFrozen(record.binding), true);
  assert.equal(Object.isFrozen(record.cleanupFailures), true);
}

// Fail existing boundaries through trusted test-only built-in mocks; no Oracle
// fault injection API or production behavior/configuration seam is introduced.
async function actual(t, fault = {}, instrumented = true, scenarioIndex = 0) {
  const root = temporary(t),
    ctx = context({}, scenarioIndex),
    error = hostile(),
    closed = [];
  const writes = [],
    cloned = globalThis.structuredClone,
    write = fsPromises.writeFile;
  let cloneIndex = 0,
    resolveLate;
  const parentAbort = fault.parentAbort ? new AbortController() : null;
  const writeMock = t.mock.method(
    fsPromises,
    "writeFile",
    async (path, ...args) => {
      const name = String(path).replaceAll("\\", "/");
      if (fault.write && name.endsWith(`/${fault.write}`)) throw error;
      writes.push(
        name
          .slice(name.lastIndexOf("/oracle-") + 1)
          .replace(/^oracle-[^/]+\//, ""),
      );
      return write(path, ...args);
    },
  );
  syncBuiltinESMExports();
  const cloneMock = t.mock.method(
    globalThis,
    "structuredClone",
    (value, ...args) => {
      const i = cloneIndex++;
      // The unchanged independent controls clone once between scenario admission
      // and the first worker snapshot; operation ordinals below exclude that call.
      if (fault.clone !== undefined && fault.clone + 1 === i) throw error;
      return cloned(value, ...args);
    },
  );
  const adapter = (side) => {
    let snapshots = 0;
    return {
      async reset() {
        if (fault.stage === `${side}_RESET`) throw error;
      },
      async snapshot() {
        const initial = snapshots++ === 0,
          stage = `${side}_${initial ? "INITIAL_SNAPSHOT" : "STEP_SNAPSHOT"}`;
        if (fault.stage === stage) throw error;
        if (
          side === "CANDIDATE" &&
          fault.stage === (initial ? "DB_INITIAL_COMPARE" : "DB_STEP_COMPARE")
        )
          return malformedSnapshot();
        return snapshot();
      },
      async request(_request, signal) {
        if (fault.stage === `${side}_REQUEST`) throw error;
        if (fault.timeout === side)
          return new Promise((resolve) => {
            resolveLate = resolve;
          });
        if (fault.parentAbort === side) {
          parentAbort.abort();
          signal.throwIfAborted();
        }
        return {
          status: 200,
          headers: { "content-type": "application/json" },
          body:
            fault.stage === `${side}_HTTP_SERIALIZE`
              ? null
              : Buffer.from(
                  side === "CANDIDATE" && fault.stage === "HTTP_COMPARE"
                    ? "{"
                    : "{}",
                ),
        };
      },
      async close() {
        closed.push(side);
        if (fault.bothClose || fault.stage === `${side}_CLOSE`) throw error;
      },
    };
  };
  try {
    let result, thrown;
    try {
      const wrap = (worker) =>
        parentAbort ? bindCancellation(worker, parentAbort.signal) : worker;
      result = await verifyPair({
        reference: wrap(adapter("REFERENCE")),
        candidate: wrap(adapter("CANDIDATE")),
        scenarios: [MANIFEST[scenarioIndex]],
        artifactParent: root,
        operationTimeoutMs: fault.timeout ? 50 : 1000,
        ...(instrumented ? { failureTelemetry: ctx } : {}),
      });
    } catch (value) {
      thrown = value;
    }
    const record = finishFailureTelemetry(ctx),
      bytes = JSON.stringify(record);
    if (resolveLate) {
      resolveLate({
        status: 200,
        headers: { "content-type": "application/json" },
        body: Buffer.from(SECRET),
      });
      await Promise.resolve();
      await Promise.resolve();
      assert.equal(JSON.stringify(finishFailureTelemetry(ctx)), bytes);
    }
    return { root, ctx, error, result, thrown, record, closed, writes };
  } finally {
    cloneMock.mock.restore();
    writeMock.mock.restore();
    syncBuiltinESMExports();
  }
}
const gates = (r) => r.result.gateResults;
const faultCases = [
  ...["REFERENCE", "CANDIDATE"].flatMap((side) =>
    ["RESET", "INITIAL_SNAPSHOT", "REQUEST", "STEP_SNAPSHOT", "CLOSE"].map(
      (op) => ({ stage: `${side}_${op}` }),
    ),
  ),
  { stage: "REQUEST_CLONE", clone: 3 },
  { stage: "REFERENCE_OBSERVATION_CLONE", clone: 1 },
  { stage: "CANDIDATE_OBSERVATION_CLONE", clone: 2 },
  { stage: "REFERENCE_HTTP_SERIALIZE" },
  { stage: "CANDIDATE_HTTP_SERIALIZE" },
  { stage: "HTTP_COMPARE" },
  { stage: "DB_INITIAL_COMPARE" },
  { stage: "DB_STEP_COMPARE" },
  ...[
    ["EVIDENCE_CONTROLS_WRITE", "controls.json"],
    ["EVIDENCE_INITIAL_REFERENCE_WRITE", "db/0-initial-reference.json"],
    ["EVIDENCE_INITIAL_PAIR_WRITE", "db/0-initial.json"],
    ["EVIDENCE_INITIAL_DIFF_WRITE", "diffs/0-initial.json"],
    ["EVIDENCE_HTTP_REFERENCE_WRITE", "http/0-0-reference.json"],
    ["EVIDENCE_HTTP_PAIR_WRITE", "http/0-0.json"],
    ["EVIDENCE_HTTP_DIFF_WRITE", "diffs/0-0-http.json"],
    ["EVIDENCE_DB_REFERENCE_WRITE", "db/0-0-reference.json"],
    ["EVIDENCE_DB_PAIR_WRITE", "db/0-0.json"],
    ["EVIDENCE_DB_DIFF_WRITE", "diffs/0-0-db.json"],
  ].map(([stage, write]) => ({ stage, write })),
];
for (const fault of faultCases)
  test(`production telemetry actual ${fault.stage}: unchanged gates/coverage, fixed stage`, async (t) => {
    const before = await actual(t, fault, false),
      after = await actual(t, fault);
    assert.equal(before.thrown, undefined);
    assert.equal(after.thrown, undefined);
    assert.deepEqual(gates(after), gates(before));
    assert.deepEqual(after.closed, before.closed);
    assert.deepEqual(after.closed.sort(), ["CANDIDATE", "REFERENCE"]);
    assert.deepEqual(after.writes, before.writes);
    assert.equal(after.result.failureTelemetry, after.record);
    assert.equal(after.record.firstFailureStage, fault.stage);
    assert.equal(after.record.stepIndex, stepFor(fault.stage));
    assert.equal(after.record.failureCategory, "OPERATION_REJECTED");
    assert.equal(gates(after)[0].verdict, "ERROR");
    boundedRecord(projectFailureTelemetry(after.record, after.ctx), after.ctx);
  });
for (const file of [
  "manifest.json",
  "events.jsonl",
  "model-usage.json",
  "report.html",
  "gate-results.json",
])
  test(`production telemetry publication ${file} preserves rejection and cleanup`, async (t) => {
    const r = await actual(t, { write: file });
    assert.equal(r.thrown, r.error);
    assert.equal(r.result, undefined);
    assert.deepEqual(r.closed.sort(), ["CANDIDATE", "REFERENCE"]);
    assert.equal(r.record.status, "UNAVAILABLE");
    assert.equal(r.record.unavailableReason, "PUBLICATION_FAILED");
    boundedRecord(projectFailureTelemetry(r.record, r.ctx), r.ctx);
  });
for (const [stage, cloneIndex] of [
  ["REQUEST_CLONE", 5],
  ["REFERENCE_OBSERVATION_CLONE", 4],
  ["CANDIDATE_OBSERVATION_CLONE", 6],
  ["REFERENCE_OBSERVATION_CLONE", 7],
  ["CANDIDATE_OBSERVATION_CLONE", 8],
])
  test(`production telemetry step clone ${stage}/${cloneIndex} keeps exact ordinal`, async (t) => {
    const r = await actual(t, { clone: cloneIndex });
    assert.equal(r.record.firstFailureStage, stage);
    assert.equal(r.record.stepIndex, 0);
  });
test("production telemetry known-good exact public scenario is inert at every manifest ordinal", async (t) => {
  for (let i = 0; i < MANIFEST.length; i++) {
    const before = await actual(t, {}, false, i),
      after = await actual(t, {}, true, i);
    assert.deepEqual(gates(after), gates(before));
    assert.deepEqual(after.writes, before.writes);
    assert.equal(gates(after)[0].verdict, "PASS");
    assert.equal(gates(after)[1].verdict, "PASS");
    assert.equal(gates(after)[2].verdict, "INCONCLUSIVE");
    assert.equal(after.record.scenarioIndex, i);
    assert.equal(after.record.firstFailureStage, null);
    assert.equal(after.record.lastCompletedStage, "EVIDENCE_PUBLICATION_WRITE");
    assert.equal(after.record.failureCategory, "UNKNOWN");
    boundedRecord(projectFailureTelemetry(after.record, after.ctx), after.ctx);
  }
});
test("production telemetry real bounded timeout and late result cannot rewrite sealed failure", async (t) => {
  for (const side of ["REFERENCE", "CANDIDATE"]) {
    const r = await actual(t, { timeout: side });
    assert.equal(gates(r)[0].verdict, "ERROR");
    assert.equal(r.record.firstFailureStage, `${side}_REQUEST`);
    assert.equal(r.record.failureCategory, "SIGNAL_ABORTED");
    assert.equal(r.record.stepIndex, 0);
    boundedRecord(projectFailureTelemetry(r.record, r.ctx), r.ctx);
  }
});
test("production telemetry request failure and both cleanup errors retain first and last work", async (t) => {
  const before = await actual(
      t,
      { stage: "REFERENCE_REQUEST", bothClose: true },
      false,
    ),
    after = await actual(t, { stage: "REFERENCE_REQUEST", bothClose: true });
  assert.deepEqual(gates(after), gates(before));
  assert.equal(after.record.firstFailureStage, "REFERENCE_REQUEST");
  // Request cloning completed inside the request boundary before its rejection.
  assert.equal(after.record.lastCompletedStage, "REQUEST_CLONE");
  assert.deepEqual(
    after.record.cleanupFailures.map((c) => c.stage),
    ["CANDIDATE_CLOSE", "REFERENCE_CLOSE"],
  );
  assert.equal(after.record.stepIndex, 0);
  boundedRecord(projectFailureTelemetry(after.record, after.ctx), after.ctx);
});
for (const stage of FAILURE_STAGES)
  test(`production recorder ${stage} preserves exception identity without properties`, async () => {
    const ctx = context(),
      r = failureTelemetryRecorder(ctx, [MANIFEST[0]]),
      error = hostile(),
      index = stepFor(stage);
    await assert.rejects(
      r.observe(stage, index, new AbortController().signal, async () => {
        throw error;
      }),
      (e) => e === error,
    );
    assert.equal(finishFailureTelemetry(ctx).firstFailureStage, stage);
  });
test("production recorder preserves values, successful-finally abort and synchronous exceptions", async () => {
  const ctx = context(),
    r = failureTelemetryRecorder(ctx, [MANIFEST[0]]),
    abort = new AbortController(),
    value = { body: SECRET.repeat(10000) },
    error = hostile();
  assert.equal(
    await r.observe("REFERENCE_REQUEST", 0, abort.signal, async () => value),
    value,
  );
  abort.abort();
  assert.throws(
    () =>
      r.capture("HTTP_COMPARE", 0, () => {
        throw error;
      }),
    (e) => e === error,
  );
  const record = finishFailureTelemetry(ctx);
  assert.equal(record.firstFailureStage, "HTTP_COMPARE");
  assert.equal(record.failureCategory, "OPERATION_REJECTED");
  boundedRecord(record, ctx);
});
test("production ordinal miswiring disables telemetry but still runs and preserves operation", async () => {
  for (const [stage, index] of [
    ["REFERENCE_RESET", 0],
    ["CANDIDATE_CLOSE", 0],
    ["REFERENCE_REQUEST", null],
    ["DB_STEP_COMPARE", null],
    ["EVIDENCE_HTTP_DIFF_WRITE", -1],
  ]) {
    const ctx = context(),
      r = failureTelemetryRecorder(ctx, [MANIFEST[0]]),
      value = {};
    assert.equal(await r.observe(stage, index, null, async () => value), value);
    assert.equal(
      finishFailureTelemetry(ctx).unavailableReason,
      "INTERNAL_ERROR",
    );
  }
});
test("production hidden/ad-hoc scenario cannot issue public telemetry", async (t) => {
  const root = temporary(t),
    ctx = context();
  const adapter = () => ({
    reset: async () => {},
    snapshot: async () => snapshot(),
    request: async () => ({
      status: 200,
      headers: { "content-type": "text/plain" },
      body: Buffer.from(SECRET),
    }),
    close: async () => {},
  });
  const result = await verifyPair({
    reference: adapter(),
    candidate: adapter(),
    scenarios: [
      { id: "HELD_OUT_G4", requests: [{ method: "GET", path: "/private" }] },
    ],
    artifactParent: root,
    operationTimeoutMs: 1000,
    failureTelemetry: ctx,
  });
  assert.equal(result.failureTelemetry.status, "UNAVAILABLE");
  assert.equal(result.failureTelemetry.unavailableReason, "FOREIGN_BINDING");
  assert.equal(result.failureTelemetry.firstFailureStage, null);
  boundedRecord(projectFailureTelemetry(result.failureTelemetry, ctx), ctx);
  assert.equal(createFailureTelemetry(binding(), 99), null);
  assert.equal(
    createFailureTelemetry({ ...binding(), sourceSha: "c".repeat(40) }, 0),
    null,
  );
});
function reportAttempt(r) {
  const b = binding();
  const pair = {
    ...b,
    scenarioId: MANIFEST[0].id,
    cleanup: "VERIFIED_ZERO_RESOURCES",
    packs: [
      {
        id: "oracle-synthetic104production",
        sha256: "c".repeat(64),
        reference: "synthetic/index.json",
      },
    ],
    build: {
      gate: "G1",
      verdict: "PASS",
      executedTestIds: [
        `${MANIFEST[0].id}:typecheck`,
        `${MANIFEST[0].id}:build`,
      ],
      findingCodes: [],
    },
    gates: gates(r).map(({ gate, verdict, executedTestIds, findings }) => ({
      gate,
      verdict,
      executedTestIds,
      findingCodes: findings.map((f) => f.code),
    })),
    failureTelemetry: r.record,
  };
  return {
    attemptId: b.attemptId,
    candidateSha: b.candidateSha,
    errorCode: null,
    pairs: [pair],
  };
}
test("production Oracle→registered pair→public projection preserves provenance, G1/G4 and repair firewall", async (t) => {
  const r = await actual(t),
    attempt = reportAttempt(r),
    pair = attempt.pairs[0];
  const before = publicAttempt(attempt),
    report = aggregateAttempt(attempt);
  bindPairFailureTelemetry(pair, r.ctx);
  const after = publicAttempt(attempt),
    record = after.pairs[0].failureTelemetry;
  boundedRecord(record, r.ctx);
  assert.equal(record.status, "AVAILABLE");
  assert.deepEqual(after.gates, before.gates);
  assert.deepEqual(after.coverage, before.coverage);
  assert.deepEqual(aggregateAttempt(attempt), report);
  assert.equal(report.repairFeedback, null);
  assert.equal(after.pairs[0].compilerDiagnostics.g1Verdict, "PASS");
  assert.equal(
    after.gates.find((g) => g.gate === "G1").verdict,
    "INCONCLUSIVE",
  );
  assert.equal(
    after.gates.find((g) => g.gate === "G4").verdict,
    "INCONCLUSIVE",
  );
  assert.deepEqual(publicAttempt(attempt), after);
  // A public JSON copy cannot become a new trusted pair or issued sidecar.
  pair.failureTelemetry = clone(r.record);
  assert.equal(
    publicAttempt(attempt).pairs[0].failureTelemetry.unavailableReason,
    "UNTRUSTED_RECORD",
  );
  pair.failureTelemetry = r.record;
  const copy = { ...pair };
  assert.equal(
    Object.hasOwn(
      publicAttempt({ ...attempt, pairs: [copy] }).pairs[0],
      "failureTelemetry",
    ),
    false,
  );
  Object.defineProperty(pair, "failureTelemetry", {
    get() {
      throw hostile();
    },
    configurable: true,
  });
  assert.equal(
    publicAttempt(attempt).pairs[0].failureTelemetry.unavailableReason,
    "MALFORMED",
  );
  assert.deepEqual(aggregateAttempt(attempt), report);
});
test("production malformed/absent/foreign telemetry cannot conceal verifier ERROR", async (t) => {
  const r = await actual(t, { stage: "REFERENCE_REQUEST" }),
    attempt = reportAttempt(r),
    pair = attempt.pairs[0];
  bindPairFailureTelemetry(pair, r.ctx);
  const expected = aggregateAttempt(attempt);
  for (const value of [
    null,
    {},
    SECRET,
    clone(r.record),
    finishFailureTelemetry(context({ runId: "104004" })),
  ]) {
    pair.failureTelemetry = value;
    const output = publicAttempt(attempt);
    assert.equal(output.pairs[0].failureTelemetry.status, "UNAVAILABLE");
    assert.equal(output.gates.find((g) => g.gate === "G2").verdict, "ERROR");
    assert.deepEqual(aggregateAttempt(attempt), expected);
  }
  pair.failureTelemetry = r.record;
  pair.headSha = "c".repeat(40);
  assert.equal(
    publicAttempt(attempt).pairs[0].failureTelemetry.unavailableReason,
    "FOREIGN_BINDING",
  );
  bindPairFailureTelemetry(pair, null);
  assert.equal(
    publicAttempt(attempt).pairs[0].failureTelemetry.unavailableReason,
    "MISSING_BINDING",
  );
});
test("production validator rejects hostile shape, bindings, bytes and stage-specific ordinals", async (t) => {
  const r = await actual(t),
    ctx = r.ctx,
    base = r.record;
  const cases = [
    (x) => {
      x.rawError = SECRET;
    },
    (x) => {
      delete x.firstFailureStage;
    },
    (x) => {
      x.binding.runId = "1".repeat(10000);
    },
    (x) => {
      x.binding.sourceSha = "c".repeat(40);
    },
    (x) => {
      x.binding.pairId = "33333333-3333-4333-8333-333333333333";
    },
    (x) => {
      x.stepIndex = 999;
    },
    (x) => {
      x.firstFailureStage = "REFERENCE_RESET";
      x.stepIndex = 0;
    },
    (x) => {
      x.firstFailureStage = "REFERENCE_REQUEST";
      x.stepIndex = null;
    },
    (x) => {
      x.truncated = true;
    },
    (x) => {
      x.cleanupFailures = Array(3);
    },
    (x) => {
      x.cleanupFailures = [
        { stage: "REFERENCE_CLOSE", category: "UNKNOWN", payload: SECRET },
      ];
    },
    (x) => {
      x[Symbol(SECRET)] = true;
    },
    (x) => {
      Object.defineProperty(x, "status", {
        get() {
          throw hostile();
        },
      });
    },
  ];
  for (const mutate of cases) {
    const raw = clone(base);
    mutate(raw);
    assert.equal(validateFailureTelemetry(raw, ctx).ok, false);
    assert.equal(projectFailureTelemetry(raw, ctx).status, "UNAVAILABLE");
  }
  assert.equal(
    validateFailureTelemetry(
      new Proxy(
        {},
        {
          getPrototypeOf() {
            throw hostile();
          },
        },
      ),
      ctx,
    ).ok,
    false,
  );
  assert.equal(projectFailureTelemetry(null, ctx).unavailableReason, "ABSENT");
  assert.equal(
    projectFailureTelemetry(base, context()).unavailableReason,
    "FOREIGN_BINDING",
  );
  for (const reason of ["TRUNCATED", "PUBLICATION_FAILED", "INTERNAL_ERROR"]) {
    const value = unavailableFailureTelemetry(ctx, reason);
    assert.equal(value.unavailableReason, reason);
    boundedRecord(projectFailureTelemetry(value, ctx), ctx);
  }
  assert.equal(finishFailureTelemetry(context()).unavailableReason, "ABSENT");
});
test("production optional telemetry leaves retention identity and source-export refusal unchanged", () => {
  const f = completedFixture();
  f.trial.attempts[0].pairs.forEach((pair, i) => {
    pair.packs = [0, 1].map((j) => ({
      id: `oracle-synthetic104p-${i}-${j}`,
      sha256: "c".repeat(64),
    }));
  });
  const expected = preservationIdentity(f.trial, f.expected);
  for (const pair of f.trial.attempts[0].pairs)
    Object.defineProperty(pair, "failureTelemetry", {
      get() {
        throw hostile();
      },
    });
  assert.deepEqual(preservationIdentity(f.trial, f.expected), expected);
  f.trial.publicG1 = "INCONCLUSIVE";
  assert.throws(() => preservationIdentity(f.trial, f.expected));
  assert.throws(() =>
    collectPreservationPackage(f.trial, f.expected, "MUST_NOT_READ_SOURCE"),
  );
});
test("production real parent cancellation keeps existing composed signals and ERROR", async (t) => {
  for (const side of ["REFERENCE", "CANDIDATE"]) {
    const before = await actual(t, { parentAbort: side }, false),
      after = await actual(t, { parentAbort: side });
    assert.deepEqual(gates(after), gates(before));
    assert.equal(gates(after)[0].verdict, "ERROR");
    assert.equal(after.record.firstFailureStage, `${side}_REQUEST`);
    // The Oracle operation signal did not fire; the existing broker's combined
    // parent signal rejected. Never infer a cause from its AbortError properties.
    assert.equal(after.record.failureCategory, "OPERATION_REJECTED");
    boundedRecord(projectFailureTelemetry(after.record, after.ctx), after.ctx);
  }
});
test("production preaborted observation still forwards the operation and seals signal category", async () => {
  const ctx = context(),
    r = failureTelemetryRecorder(ctx, [MANIFEST[0]]),
    abort = new AbortController(),
    value = {};
  abort.abort();
  let called = 0;
  assert.equal(
    await r.observe("CANDIDATE_REQUEST", 0, abort.signal, async () => {
      called++;
      return value;
    }),
    value,
  );
  assert.equal(called, 1);
  const record = finishFailureTelemetry(ctx);
  assert.equal(record.failureCategory, "SIGNAL_ABORTED");
  assert.equal(record.lastCompletedStage, null);
});
test("production setup failure preserves original rejection and still closes both sides", async (t) => {
  const ctx = context(),
    error = hostile(),
    closed = [],
    original = fsPromises.mkdtemp;
  const stub = t.mock.method(fsPromises, "mkdtemp", async () => {
    throw error;
  });
  syncBuiltinESMExports();
  try {
    const adapter = (side) => ({
      close: async () => {
        closed.push(side);
      },
    });
    await assert.rejects(
      verifyPair({
        reference: adapter("REFERENCE"),
        candidate: adapter("CANDIDATE"),
        scenarios: [MANIFEST[0]],
        artifactParent: "unused",
        operationTimeoutMs: 1000,
        failureTelemetry: ctx,
      }),
      (e) => e === error,
    );
  } finally {
    stub.mock.restore();
    syncBuiltinESMExports();
  }
  assert.equal(fsPromises.mkdtemp, original);
  assert.deepEqual(closed.sort(), ["CANDIDATE", "REFERENCE"]);
  assert.equal(
    finishFailureTelemetry(ctx).unavailableReason,
    "PUBLICATION_FAILED",
  );
});
test("production spoofed exception codes/stages never become telemetry or root-cause claims", () => {
  const ctx = context(),
    r = failureTelemetryRecorder(ctx, [MANIFEST[0]]),
    error = { code: "PASS", stage: "HELD_OUT_G4", message: SECRET };
  assert.throws(
    () =>
      r.capture("HTTP_COMPARE", 0, () => {
        throw error;
      }),
    (e) => e === error,
  );
  const record = finishFailureTelemetry(ctx);
  assert.equal(record.firstFailureStage, "HTTP_COMPARE");
  assert.equal(record.failureCategory, "OPERATION_REJECTED");
  boundedRecord(record, ctx);
});
test("production cleanup-only first failure keeps null ordinal and last completed work", async (t) => {
  const r = await actual(t, { stage: "CANDIDATE_CLOSE" });
  assert.equal(r.record.stepIndex, null);
  assert.equal(r.record.firstFailureStage, "CANDIDATE_CLOSE");
  assert.equal(r.record.lastCompletedStage, "EVIDENCE_DB_DIFF_WRITE");
});
test("production runtime publication-unavailable sidecar preserves public ERROR and exact aggregate", async (t) => {
  const r = await actual(t, { stage: "REFERENCE_REQUEST" }),
    attempt = reportAttempt(r),
    pair = attempt.pairs[0];
  const expected = aggregateAttempt(attempt);
  pair.failureTelemetry = unavailableFailureTelemetry(
    r.ctx,
    "PUBLICATION_FAILED",
  );
  bindPairFailureTelemetry(pair, r.ctx);
  const output = publicAttempt(attempt);
  assert.equal(
    output.pairs[0].failureTelemetry.unavailableReason,
    "PUBLICATION_FAILED",
  );
  assert.equal(output.gates.find((g) => g.gate === "G2").verdict, "ERROR");
  assert.deepEqual(aggregateAttempt(attempt), expected);
});
test("production failure outside approved checkpoints is explicitly unavailable, never invented", async (t) => {
  const before = await actual(t, { clone: 0 }, false),
    after = await actual(t, { clone: 0 });
  assert.deepEqual(gates(after), gates(before));
  assert.equal(gates(after)[0].verdict, "ERROR");
  assert.equal(after.record.status, "UNAVAILABLE");
  assert.equal(after.record.unavailableReason, "INTERNAL_ERROR");
  assert.equal(after.record.firstFailureStage, null);
  boundedRecord(projectFailureTelemetry(after.record, after.ctx), after.ctx);
});
test("production real private retention and sealing keep original telemetry issuance", async (t) => {
  const r = await actual(t),
    parent = temporary(t);
  if (process.platform !== "linux") {
    assert.throws(() => new PrivateEvidence(parent, process.cwd(), binding()), {
      code: "EVIDENCE_PLATFORM",
    });
    return; // Real POSIX retention is explicitly NOT_RUN locally on Windows.
  }
  const pack = new PrivateEvidence(parent, process.cwd(), binding());
  const retained = retainOracle(r.result, r.root, pack);
  assert.deepEqual(retained.gates, r.result.gateResults);
  const sealed = pack.seal();
  assert.ok(PrivateEvidence.verify(pack.path, sealed) > 0);
  const catalog = JSON.parse(
    readFileSync(join(pack.path, "oracle-catalog.json"), "utf8"),
  );
  assert.equal(catalog.status, "COMPLETE");
  assert.doesNotMatch(
    JSON.stringify(catalog),
    /failureTelemetry|firstFailureStage/,
  );
  const attempt = reportAttempt(r),
    pair = attempt.pairs[0];
  pair.packs = [
    {
      id: basename(pack.path),
      sha256: sealed,
      reference: "inert-sealed/index.json",
    },
  ];
  bindPairFailureTelemetry(pair, r.ctx);
  const output = publicAttempt(attempt);
  assert.equal(output.pairs[0].failureTelemetry.status, "AVAILABLE");
  boundedRecord(output.pairs[0].failureTelemetry, r.ctx);
  pair.failureTelemetry = clone(r.record);
  assert.equal(
    publicAttempt(attempt).pairs[0].failureTelemetry.unavailableReason,
    "UNTRUSTED_RECORD",
  );
});
