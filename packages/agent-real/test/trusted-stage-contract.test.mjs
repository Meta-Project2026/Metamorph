// Nonproduction MMP104-T2 proposal controls; no production telemetry wiring.
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  BINDING_KEYS,
  createPublicContext,
  MAX_BYTES,
  STAGES,
  unavailable,
  validateRecord,
} from "../../../research/mmp-104/t2/contract.mjs";
import { createRecorder } from "../../../research/mmp-104/t2/recorder.mjs";
import {
  MANIFEST,
  SOURCE,
  snapshotSqlite,
  verifyPair,
} from "../../oracle/dist/index.js";
import { aggregateAttempt, publicAttempt } from "../src/report.mjs";

const fixtureBinding = () => ({
  runId: "104002",
  headSha: "a".repeat(40),
  sourceSha: SOURCE.commit,
  candidateSha: "b".repeat(64),
  attemptId: "11111111-1111-4111-8111-111111111111",
  pairId: "22222222-2222-4222-8222-222222222222",
});
const context = (changes = {}) =>
  createPublicContext({ ...fixtureBinding(), ...changes }, 0);
const hostError = () =>
  Object.create(null, {
    message: {
      get() {
        throw new Error("MUST_NOT_READ_MESSAGE");
      },
    },
    stack: {
      get() {
        throw new Error("MUST_NOT_READ_STACK");
      },
    },
    code: {
      get() {
        throw new Error("MUST_NOT_READ_CODE");
      },
    },
    stage: {
      get() {
        throw new Error("MUST_NOT_READ_STAGE");
      },
    },
  });
const clone = (value) => JSON.parse(JSON.stringify(value));
const assertBounded = (record, ctx) => {
  assert.equal(validateRecord(record, ctx).ok, true);
  assert.ok(Buffer.byteLength(JSON.stringify(record)) <= MAX_BYTES);
  assert.doesNotMatch(
    JSON.stringify(record),
    /MUST_NOT_|PRIVATE_PAYLOAD|G4_SECRET|rawError|compiler|stdout|stderr|toJSON/,
  );
};

for (const stage of STAGES) {
  test(`T2 fixed checkpoint ${stage} preserves the thrown value, first stage and limits`, async () => {
    const ctx = context(),
      recorder = createRecorder(ctx),
      error = hostError();
    await assert.rejects(
      recorder.observe(stage, null, new AbortController().signal, async () => {
        throw error;
      }),
      (value) => value === error,
    );
    const record = recorder.project(recorder.seal());
    assert.equal(record.firstFailureStage, stage);
    assert.equal(record.failureCategory, "OPERATION_REJECTED");
    assertBounded(record, ctx);
  });
}
test("T2 inert success retains exact result/signal; abort after completion is harmless", async () => {
  const ctx = context(),
    recorder = createRecorder(ctx),
    abort = new AbortController();
  const value = { payload: "PRIVATE_PAYLOAD".repeat(10000) };
  assert.equal(
    await recorder.observe(
      "REFERENCE_REQUEST",
      0,
      abort.signal,
      async (signal) => {
        assert.equal(signal, abort.signal);
        return value;
      },
    ),
    value,
  );
  abort.abort(); // Model production bounded() finally after successful completion.
  assert.equal(
    recorder.capture("HTTP_COMPARE", 0, () => value),
    value,
  );
  const record = recorder.project(recorder.seal());
  assert.equal(record.firstFailureStage, null);
  assert.equal(record.lastCompletedStage, "HTTP_COMPARE");
  assert.equal(record.failureCategory, "UNKNOWN");
  assertBounded(record, ctx);
});
test("T2 cancellation and late resolution cannot rewrite a sealed first-failure record", async () => {
  const ctx = context(),
    recorder = createRecorder(ctx),
    abort = new AbortController();
  let resolve;
  const pending = recorder.observe(
    "CANDIDATE_REQUEST",
    1,
    abort.signal,
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  abort.abort();
  const record = recorder.seal(),
    bytes = JSON.stringify(record);
  resolve({ secret: "PRIVATE_PAYLOAD", stage: "FAKE_PASS" });
  await pending;
  assert.equal(JSON.stringify(recorder.seal()), bytes);
  assert.equal(record.failureCategory, "SIGNAL_ABORTED");
  assert.equal(record.stepIndex, 1);
  assertBounded(recorder.project(record), ctx);
});
test("T2 primary failure survives both cleanup errors with at most two sorted markers", async () => {
  const ctx = context(),
    recorder = createRecorder(ctx),
    error = hostError();
  await assert.rejects(
    recorder.observe("REFERENCE_REQUEST", 2, null, async () => {
      throw error;
    }),
    (e) => e === error,
  );
  await Promise.allSettled(
    ["REFERENCE_CLOSE", "CANDIDATE_CLOSE", "REFERENCE_CLOSE"].map((stage) =>
      recorder.observe(stage, null, null, async () => {
        throw error;
      }),
    ),
  );
  const record = recorder.seal();
  assert.equal(record.firstFailureStage, "REFERENCE_REQUEST");
  assert.equal(record.stepIndex, 2);
  assert.deepEqual(
    record.cleanupFailures.map((c) => c.stage),
    ["CANDIDATE_CLOSE", "REFERENCE_CLOSE"],
  );
  assertBounded(record, ctx);
});
test("T2 cleanup-only first failure has no stale step ordinal", async () => {
  const ctx = context(),
    recorder = createRecorder(ctx);
  recorder.capture("HTTP_COMPARE", 3, () => null);
  await assert.rejects(
    recorder.observe("REFERENCE_CLOSE", null, null, async () => {
      throw hostError();
    }),
  );
  const record = recorder.seal();
  assert.equal(record.firstFailureStage, "REFERENCE_CLOSE");
  assert.equal(record.stepIndex, null);
  assertBounded(record, ctx);
});
test("T2 synchronous comparator/write errors preserve identity and never inspect claims", () => {
  const ctx = context(),
    recorder = createRecorder(ctx),
    error = { code: "PASS", stage: "G4_SECRET", message: "PRIVATE_PAYLOAD" };
  assert.throws(
    () =>
      recorder.capture("DB_INITIAL_COMPARE", null, () => {
        throw error;
      }),
    (e) => e === error,
  );
  const record = recorder.seal();
  assert.equal(record.firstFailureStage, "DB_INITIAL_COMPARE");
  assertBounded(record, ctx);
});
test("T2 malformed checkpoint metadata makes telemetry unavailable without changing operation", async () => {
  const ctx = context(),
    recorder = createRecorder(ctx),
    value = {};
  assert.equal(
    await recorder.observe(
      "CANDIDATE_CLAIMED_STAGE",
      999,
      null,
      async () => value,
    ),
    value,
  );
  assert.equal(recorder.seal().unavailableReason, "INTERNAL_ERROR");
  assertBounded(recorder.project(recorder.seal()), ctx);
});
for (const reason of ["PUBLICATION_FAILED", "INTERNAL_ERROR", "TRUNCATED"]) {
  test(`T2 explicit ${reason} cannot publish partial diagnostics`, () => {
    const ctx = context(),
      recorder = createRecorder(ctx);
    recorder.capture("HTTP_COMPARE", 0, () => []);
    recorder.invalidate(reason);
    const record = recorder.project(recorder.seal());
    assert.equal(record.status, "UNAVAILABLE");
    assert.equal(record.unavailableReason, reason);
    assert.equal(record.firstFailureStage, null);
    assert.equal(record.lastCompletedStage, null);
    assertBounded(record, ctx);
  });
}
test("T2 projector rejects absent, copied, foreign-issued and wrong-run records", () => {
  const ctx = context(),
    recorder = createRecorder(ctx),
    record = recorder.seal();
  assert.equal(recorder.project(null).unavailableReason, "ABSENT");
  assert.equal(
    recorder.project(clone(record)).unavailableReason,
    "UNTRUSTED_RECORD",
  );
  assert.equal(
    recorder.project(createRecorder(ctx).seal()).unavailableReason,
    "UNTRUSTED_RECORD",
  );
  assert.equal(
    recorder.project(record, context({ runId: "104003" })).unavailableReason,
    "FOREIGN_BINDING",
  );
  assert.equal(
    recorder.project(record, {}).unavailableReason,
    "MISSING_BINDING",
  );
});
test("T2 unavailable precedence cannot claim truncation or missing identity inconsistently", () => {
  const unbound = unavailable({}, "TRUNCATED"),
    ctx = context();
  assert.equal(unbound.unavailableReason, "MISSING_BINDING");
  assert.equal(unbound.binding, null);
  assert.equal(unbound.truncated, false);
  const internal = unavailable(ctx, "WORKER_CLAIMED_REASON");
  assert.equal(internal.unavailableReason, "INTERNAL_ERROR");
  assertBounded(internal, ctx);
});
for (const key of BINDING_KEYS) {
  test(`T2 independently expected ${key} refuses a foreign binding`, () => {
    const ctx = context(),
      record = clone(createRecorder(ctx).seal());
    record.binding[key] =
      key === "runId"
        ? "104003"
        : key.endsWith("Id")
          ? "33333333-3333-4333-8333-333333333333"
          : key === "candidateSha"
            ? "c".repeat(64)
            : "c".repeat(40);
    assert.deepEqual(validateRecord(record, ctx), {
      ok: false,
      reason: "FOREIGN_BINDING",
    });
  });
}
test("T2 exact keys, getters, symbols, ranges and oversized metadata fail closed", () => {
  const ctx = context(),
    base = createRecorder(ctx).seal();
  const cases = [
    (r) => {
      r.rawError = "PRIVATE_PAYLOAD";
    },
    (r) => {
      delete r.firstFailureStage;
    },
    (r) => {
      Object.defineProperty(r, "failureCategory", {
        get() {
          throw hostError();
        },
      });
    },
    (r) => {
      r[Symbol("PRIVATE_PAYLOAD")] = true;
    },
    (r) => {
      r.scenarioIndex = 1;
    },
    (r) => {
      r.stepIndex = MANIFEST[0].requests.length;
    },
    (r) => {
      r.stepIndex = -1;
    },
    (r) => {
      r.stepIndex = 0.5;
    },
    (r) => {
      r.binding.runId = "9".repeat(10000);
    },
    (r) => {
      r.cleanupFailures = new Array(3);
    },
    (r) => {
      r.cleanupFailures = [
        {
          stage: "REFERENCE_CLOSE",
          category: "UNKNOWN",
          payload: "PRIVATE_PAYLOAD",
        },
      ];
    },
    (r) => {
      r.cleanupFailures = [
        { stage: "REFERENCE_CLOSE", category: "UNKNOWN" },
        { stage: "REFERENCE_CLOSE", category: "UNKNOWN" },
      ];
    },
    (r) => {
      r.firstFailureStage = "G4_SECRET";
    },
    (r) => {
      r.truncated = true;
    },
  ];
  for (const mutate of cases) {
    const raw = clone(base);
    mutate(raw);
    assert.equal(validateRecord(raw, ctx).ok, false);
  }
  let getterRead = false;
  const raw = clone(base);
  raw.cleanupFailures = [{ stage: "REFERENCE_CLOSE", category: "UNKNOWN" }];
  Object.defineProperty(raw.cleanupFailures, "0", {
    get() {
      getterRead = true;
      throw hostError();
    },
  });
  assert.equal(validateRecord(raw, ctx).ok, false);
  assert.equal(getterRead, false);
  assert.equal(
    validateRecord(
      new Proxy(
        {},
        {
          getPrototypeOf() {
            throw hostError();
          },
        },
      ),
      ctx,
    ).ok,
    false,
  );
});
test("T2 forged context and hidden G4 scope cannot issue or project telemetry", () => {
  assert.throws(() => createPublicContext(fixtureBinding(), 0, "HELD_OUT_G4"));
  assert.throws(() => createPublicContext(fixtureBinding(), 99));
  assert.throws(() =>
    createPublicContext({ ...fixtureBinding(), sourceSha: "c".repeat(40) }, 0),
  );
  assert.throws(() => createRecorder({ ...context() }));
});
test("T2 worst-case bounded metadata is detached and deeply immutable", () => {
  const b = { ...fixtureBinding(), runId: "9".repeat(20) };
  const ctx = createPublicContext(b, MANIFEST.length - 1),
    recorder = createRecorder(ctx);
  b.headSha = "c".repeat(40);
  assert.equal(ctx.binding.headSha, fixtureBinding().headSha);
  const error = hostError();
  assert.throws(
    () =>
      recorder.capture("EVIDENCE_INITIAL_REFERENCE_WRITE", null, () => {
        throw error;
      }),
    (e) => e === error,
  );
  for (const stage of ["CANDIDATE_CLOSE", "REFERENCE_CLOSE"])
    assert.throws(
      () =>
        recorder.capture(stage, null, () => {
          throw error;
        }),
      (e) => e === error,
    );
  const record = recorder.seal();
  for (const value of [
    record,
    record.binding,
    record.cleanupFailures,
    ...record.cleanupFailures,
  ])
    assert.equal(Object.isFrozen(value), true);
  assert.throws(() => {
    record.binding.runId = "1";
  });
  assertBounded(recorder.project(record), ctx);
});
test("T2 abort then rejection keeps the first signal category and original exception", async () => {
  const ctx = context(),
    recorder = createRecorder(ctx),
    abort = new AbortController(),
    error = hostError();
  await assert.rejects(
    recorder.observe("REFERENCE_CLOSE", null, abort.signal, async () => {
      abort.abort();
      throw error;
    }),
    (e) => e === error,
  );
  const record = recorder.seal();
  assert.equal(record.failureCategory, "SIGNAL_ABORTED");
  assert.equal(record.cleanupFailures[0].category, "SIGNAL_ABORTED");
  assertBounded(record, ctx);
});

async function oracleControl(t, instrumented, fault = "none") {
  const root = mkdtempSync(join(tmpdir(), "mmp104-t2-inert-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const state = join(root, "state.sqlite"),
    db = new DatabaseSync(state);
  db.exec("CREATE TABLE original_synthetic_control(id INTEGER PRIMARY KEY)");
  db.close();
  const snapshot = snapshotSqlite(state),
    ctx = context(),
    recorder = createRecorder(ctx),
    closed = new Set();
  const raw = (side) => ({
    reset: async () => undefined,
    snapshot: async () => structuredClone(snapshot),
    request: async () => {
      if (fault === `${side}-request`) throw hostError();
      return {
        status: 200,
        headers: { "content-type": "application/json" },
        body: Buffer.from("{}"),
      };
    },
    close: async () => {
      closed.add(side);
      if (fault === "publication" && side === "candidate") {
        const pack = readdirSync(root).find((name) =>
          name.startsWith("oracle-"),
        );
        writeFileSync(join(root, pack, "gate-results.json"), "{}", {
          mode: 0o600,
        });
      }
    },
  });
  const wrap = (side) => {
    const adapter = raw(side.toLowerCase());
    let snapshots = 0,
      steps = 0;
    const call = (stage, index, signal, operation) => {
      const controlled = (s) =>
        fault === stage || (fault === "both-close" && stage.endsWith("_CLOSE"))
          ? Promise.reject(hostError())
          : operation(s);
      return instrumented
        ? recorder.observe(stage, index, signal, controlled)
        : controlled(signal);
    };
    return {
      reset: (s) => call(`${side}_RESET`, null, s, adapter.reset),
      snapshot: (s) =>
        call(
          `${side}_${snapshots++ === 0 ? "INITIAL_SNAPSHOT" : "STEP_SNAPSHOT"}`,
          null,
          s,
          adapter.snapshot,
        ),
      request: (input, s) =>
        call(`${side}_REQUEST`, steps++, s, (signal) =>
          adapter.request(input, signal),
        ),
      close: (s) => call(`${side}_CLOSE`, null, s, adapter.close),
    };
  };
  const run = () =>
    verifyPair({
      reference: wrap("REFERENCE"),
      candidate: wrap("CANDIDATE"),
      scenarios: [MANIFEST[0]],
      artifactParent: root,
      operationTimeoutMs: 1000,
    });
  if (fault === "publication") {
    await assert.rejects(run());
    recorder.invalidate("PUBLICATION_FAILED");
    assert.deepEqual([...closed].sort(), ["candidate", "reference"]);
    return { telemetry: recorder.project(recorder.seal()) };
  }
  const result = await run();
  const gates = result.gateResults.map(
    ({ gate, verdict, executedTestIds, findings }) => ({
      gate,
      verdict,
      executedTestIds,
      findingCodes: findings.map((f) => f.code),
    }),
  );
  return {
    gates,
    closed: [...closed].sort(),
    telemetry: recorder.project(recorder.seal()),
  };
}
for (const fault of ["none", "reference-request", "candidate-request"]) {
  test(`T2 unchanged real Oracle ${fault} keeps exact gate IDs/coverage/cleanup with research wrappers`, async (t) => {
    const before = await oracleControl(t, false, fault),
      after = await oracleControl(t, true, fault);
    assert.deepEqual(after.gates, before.gates);
    assert.deepEqual(after.closed, before.closed);
    const g2 = after.gates[0],
      g3 = after.gates[1];
    assert.equal(g2.executedTestIds.length, fault === "none" ? 6 : 0);
    assert.equal(g3.executedTestIds.length, fault === "none" ? 7 : 1);
    assert.equal(g2.verdict, fault === "none" ? "PASS" : "ERROR");
    assert.equal(after.gates[2].verdict, "INCONCLUSIVE");
  });
}
test("T2 actual publication failure still rejects and closes both inert adapters", async (t) => {
  const r = await oracleControl(t, true, "publication");
  assert.equal(r.telemetry.status, "UNAVAILABLE");
  assert.equal(r.telemetry.unavailableReason, "PUBLICATION_FAILED");
});
for (const side of ["REFERENCE", "CANDIDATE"])
  for (const operation of [
    "RESET",
    "INITIAL_SNAPSHOT",
    "STEP_SNAPSHOT",
    "CLOSE",
  ]) {
    const stage = `${side}_${operation}`;
    test(`T2 actual Oracle ${stage} keeps error gates and completed coverage`, async (t) => {
      const before = await oracleControl(t, false, stage),
        after = await oracleControl(t, true, stage);
      assert.deepEqual(after.gates, before.gates);
      assert.deepEqual(after.closed, before.closed);
      assert.equal(after.gates[0].verdict, "ERROR");
      assert.equal(after.telemetry.firstFailureStage, stage);
      assert.equal(
        after.gates[0].executedTestIds.length,
        operation === "CLOSE" ? 6 : operation === "STEP_SNAPSHOT" ? 1 : 0,
      );
      assert.equal(
        after.gates[1].executedTestIds.length,
        operation === "CLOSE" ? 7 : operation === "STEP_SNAPSHOT" ? 1 : 0,
      );
    });
  }
test("T2 actual simultaneous close rejection keeps Oracle cleanup precedence", async (t) => {
  const before = await oracleControl(t, false, "both-close"),
    after = await oracleControl(t, true, "both-close");
  assert.deepEqual(after.gates, before.gates);
  assert.equal(after.gates[0].verdict, "ERROR");
  assert.equal(after.telemetry.cleanupFailures.length, 2);
});
test("T2 production report ignores telemetry claims, keeps partial G1 and G4 firewall", async (t) => {
  const result = await oracleControl(t, true);
  const b = fixtureBinding();
  const attempt = {
    attemptId: b.attemptId,
    candidateSha: b.candidateSha,
    errorCode: null,
    pairs: [
      {
        attemptId: b.attemptId,
        candidateSha: b.candidateSha,
        pairId: b.pairId,
        scenarioId: MANIFEST[0].id,
        build: {
          gate: "G1",
          verdict: "PASS",
          executedTestIds: [
            `${MANIFEST[0].id}:typecheck`,
            `${MANIFEST[0].id}:build`,
          ],
          findingCodes: [],
        },
        gates: result.gates,
        cleanup: "VERIFIED_ZERO_RESOURCES",
        packs: [
          {
            id: "oracle-synthetic104t2",
            sha256: "c".repeat(64),
            reference: "synthetic-only/index.json",
          },
        ],
      },
    ],
  };
  const before = publicAttempt(attempt),
    report = aggregateAttempt(attempt);
  assert.equal(before.pairs[0].compilerDiagnostics.g1Verdict, "PASS");
  assert.equal(
    before.gates.find((g) => g.gate === "G1").verdict,
    "INCONCLUSIVE",
  );
  assert.equal(
    before.gates.find((g) => g.gate === "G4").verdict,
    "INCONCLUSIVE",
  );
  assert.equal(report.repairFeedback, null);
  for (const value of [attempt, attempt.pairs[0]])
    Object.defineProperty(value, "failureTelemetry", {
      get() {
        throw hostError();
      },
    });
  assert.deepEqual(publicAttempt(attempt), before);
  assert.deepEqual(aggregateAttempt(attempt), report);
  assert.doesNotMatch(
    JSON.stringify(before),
    /failureTelemetry|firstFailureStage|PRIVATE_PAYLOAD|G4_SECRET/,
  );
});
