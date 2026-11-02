// Original inert adapters only: never execute candidate/reference source.
import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { verifyPair } from "../../packages/oracle/dist/index.js";
import { CANDIDATE, projectDiagnostic, validateTrace } from "./diagnostic.mjs";
import { commandCategory, createObserver, wrapMethod } from "./observer.mjs";

const secret = "PRIVATE_CANARY_candidate_message_sql_stderr";
const expected = {
  diagnosticId: "12345678-1234-1234-1234-123456789abc",
  headSha: "a".repeat(40),
};
const raw = (o) => ({ ...expected, candidateSha: CANDIDATE, trace: o.seal() });
const shape = (result) =>
  result.gateResults.map((g) => ({
    gate: g.gate,
    verdict: g.verdict,
    executed: g.executedTestIds.length,
    codes: g.findings.map((f) => f.code),
  }));
async function control(fault, observed = true) {
  const parent = mkdtempSync(join(tmpdir(), "mmp125-original-"));
  const o = createObserver(),
    closed = [];
  const fail = Object.create(null, {
    message: {
      get() {
        throw Error("GETTER_READ");
      },
    },
    code: {
      get() {
        throw Error("GETTER_READ");
      },
    },
  });
  const adapter = (side) => {
    const base = {
      async reset() {},
      async snapshot() {
        return { format: "sqlite-logical-v1", schema: [], tables: [] };
      },
      async request(_request, signal) {
        if (fault === `${side}-request`) throw fail;
        if (fault === `${side}-timeout`)
          return new Promise((_resolve, reject) =>
            signal.addEventListener("abort", () => reject(fail), {
              once: true,
            }),
          );
        if (fault === "host-write" && side === "REFERENCE") {
          const pack = readdirSync(parent).find((p) => p.startsWith("oracle-"));
          mkdirSync(join(parent, pack, "http/0-0-reference.json"));
        }
        return {
          status: 200,
          headers: { "content-type": "application/json" },
          body: fault === `${side}-malformed` ? null : Buffer.from("{}"),
        };
      },
      async close() {
        closed.push(side);
      },
    };
    if (!observed) return base;
    for (const method of ["request", "snapshot", "close"])
      wrapMethod(
        o,
        base,
        method,
        `${side}_${method.toUpperCase()}`,
        method === "request" ? 1 : 0,
      );
    return base;
  };
  try {
    const result = await verifyPair({
      reference: adapter("REFERENCE"),
      candidate: adapter("TARGET"),
      scenarios: [
        { id: "original-synthetic", requests: [{ method: "GET", path: "/" }] },
      ],
      artifactParent: parent,
      operationTimeoutMs: 40,
    });
    assert.deepEqual(closed.sort(), ["REFERENCE", "TARGET"]);
    return { gates: shape(result), trace: raw(o) };
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
}
for (const fault of [
  "REFERENCE-request",
  "TARGET-request",
  "host-write",
  "REFERENCE-malformed",
  "TARGET-malformed",
  "REFERENCE-timeout",
  "TARGET-timeout",
  "none",
]) {
  test(`real verifyPair preserves scoring and cleanup: ${fault}`, async () => {
    const original = await control(fault, false),
      observed = await control(fault);
    assert.deepEqual(observed.gates, original.gates);
    const t = validateTrace(observed.trace, expected);
    assert.equal(t.status, "COMPLETE");
    assert.equal(
      t.firstRejectedBoundary,
      fault.endsWith("request") || fault.endsWith("timeout")
        ? `${fault.split("-")[0]}_REQUEST`
        : null,
    );
    assert.equal(
      t.failureClass,
      fault.endsWith("timeout") ? "SIGNAL_ABORTED" : "UNKNOWN",
    );
    assert.equal(JSON.stringify(t).includes(secret), false);
    if (fault !== "none") {
      assert.deepEqual(
        observed.gates.slice(0, 2).map((g) => [g.verdict, g.executed]),
        [
          ["ERROR", 0],
          ["ERROR", 1],
        ],
      );
    }
  });
}
test("wrapper calls once, preserves this/argument/result and exact rejection without inspecting getters", async () => {
  const o = createObserver(),
    response = { secret },
    argument = { secret },
    signal = new AbortController().signal;
  let calls = 0;
  const error = Object.create(null, {
    message: {
      get() {
        throw Error("HOSTILE_MESSAGE");
      },
    },
    code: {
      get() {
        throw Error("HOSTILE_CODE");
      },
    },
  });
  const base = {
    async request(a, s) {
      calls++;
      assert.equal(this, base);
      assert.equal(a, argument);
      assert.equal(s, signal);
      if (calls === 2) throw error;
      return response;
    },
  };
  const restore = wrapMethod(o, base, "request", "TARGET_REQUEST", 1);
  assert.equal(await base.request(argument, signal), response);
  try {
    await base.request(argument, signal);
    assert.fail();
  } catch (e) {
    assert.equal(e, error);
  }
  assert.equal(calls, 2);
  restore();
  assert.equal(JSON.stringify(o.seal()).includes(secret), false);
});
for (const [metadata, category] of [
  [{ timedOut: true }, "COMMAND_TIMEOUT"],
  [{ fault: "WORKER_ABORTED" }, "COMMAND_CANCELLED"],
  [{ spawnError: true }, "COMMAND_UNAVAILABLE"],
  [{ overflow: true }, "COMMAND_OUTPUT_LIMIT"],
  [{ exitCode: 2 }, "COMMAND_EXIT_NONZERO"],
]) {
  test(`trusted process checkpoint: ${category}`, async () => {
    const o = createObserver();
    await assert.rejects(
      o.invoke("REFERENCE_HTTP_TRANSPORT", () => {
        o.process({ ...metadata, stdout: secret, stderr: secret });
        throw Error(secret);
      }),
    );
    assert.equal(validateTrace(raw(o), expected).failureClass, category);
    assert.equal(JSON.stringify(o.seal()).includes(secret), false);
  });
}
test("worker claims, inherited flags and getters never establish a process class", async () => {
  const spoof = Object.create(
    { timedOut: true },
    {
      fault: {
        get() {
          throw Error("GETTER_READ");
        },
      },
    },
  );
  assert.equal(commandCategory(spoof), null);
  const o = createObserver();
  await assert.rejects(
    o.invoke("TARGET_REQUEST", () => {
      throw { message: secret, code: "WORKER_TIMEOUT", side: "REFERENCE" };
    }),
  );
  assert.equal(o.seal().firstRejectedBoundary, "TARGET_REQUEST");
  assert.equal(o.seal().failureClass, "UNKNOWN");
});
test("recovered process failure is not attributed to a later unrelated rejection", async () => {
  const o = createObserver();
  await o.invoke("REFERENCE_SNAPSHOT", () => {
    o.process({ exitCode: 2 });
  });
  await assert.rejects(
    o.invoke("TARGET_REQUEST", () => {
      throw Error(secret);
    }),
  );
  assert.equal(validateTrace(raw(o), expected).failureClass, "UNKNOWN");
});
test("overflow and a pending/late settlement seal unavailable and never grow the sealed output", async () => {
  const overflow = createObserver();
  for (let i = 0; i < 65; i++) await overflow.invoke("TARGET_REQUEST", () => 1);
  assert.equal(validateTrace(raw(overflow), expected).status, "UNAVAILABLE");
  assert.equal(overflow.seal().events.length, 128);
  const late = createObserver();
  let finish;
  const pending = late.invoke(
    "TARGET_REQUEST",
    () =>
      new Promise((r) => {
        finish = r;
      }),
  );
  const sealed = raw(late);
  assert.equal(validateTrace(sealed, expected).status, "UNAVAILABLE");
  const bytes = JSON.stringify(sealed);
  finish(1);
  await pending;
  assert.equal(JSON.stringify(raw(late)), bytes);
});
test("trace rejects substituted identity, truncated complete trace, forged class, extra private field and unknown stage", async () => {
  const o = createObserver();
  await assert.rejects(
    o.invoke("TARGET_REQUEST", () => {
      throw Error(secret);
    }),
  );
  for (const mutate of [
    (r) => {
      r.headSha = "b".repeat(40);
    },
    (r) => {
      r.candidateSha = "b".repeat(64);
    },
    (r) => {
      r.diagnosticId = "foreign";
    },
    (r) => {
      r.trace.events.pop();
    },
    (r) => {
      r.trace.failureClass = "COMMAND_TIMEOUT";
    },
    (r) => {
      r.trace.events[0].stdout = secret;
    },
    (r) => {
      r.trace.events[0].stage = "WORKER_CLAIM";
    },
  ]) {
    const r = structuredClone(raw(o));
    mutate(r);
    assert.throws(() => validateTrace(r, expected));
  }
});
function summary() {
  const s = JSON.parse(
    readFileSync(
      new URL(
        "../mmp-123/evidence/local-79440b8d-mmp123-20261102T014652Z-cac1410a17b1/summary.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  s.headSha = expected.headSha;
  return s;
}
const finalizer = () => ({
  headSha: expected.headSha,
  status: "PASS",
  inventory: { containers: 0, volumes: 0 },
  emergencyRemoved: 0,
});
test("projection copies only bounded categorical fields, never arbitrary error/claims/raw data", async () => {
  const o = createObserver();
  await assert.rejects(
    o.invoke("REFERENCE_HTTP_TRANSPORT", () => {
      o.process({ exitCode: 255 });
      throw Error(secret);
    }),
  );
  const s = summary();
  s.stderr = secret;
  s.cases[0].error = { side: "TARGET", message: secret };
  const p = projectDiagnostic(s, raw(o), finalizer(), expected, 0);
  assert.equal(p.status, "DIAGNOSTIC_OBSERVED");
  assert.equal(p.failedSide, "REFERENCE");
  assert.equal(p.errorClass, "COMMAND_EXIT_NONZERO");
  assert.equal(p.rootCause, "UNKNOWN");
  assert.equal(p.historicalMetaCause, "UNKNOWN");
  assert.equal(p.formalG4, "NOT_RUN");
  assert.equal(JSON.stringify(p).includes(secret), false);
  assert.ok(Buffer.byteLength(JSON.stringify(p)) < 16384);
  for (const f of [
    (f) => {
      f.inventory.containers = 1;
    },
    (f) => {
      f.emergencyRemoved = 1;
    },
    (f) => {
      f.headSha = "foreign";
    },
  ]) {
    const dirty = finalizer();
    f(dirty);
    assert.equal(
      projectDiagnostic(s, raw(o), dirty, expected, 0).normalCleanup,
      "ERROR",
    );
  }
  assert.equal(
    projectDiagnostic(s, raw(o), finalizer(), expected, null).normalCleanup,
    "ERROR",
  );
});
test("projection rejects raw/unbounded coverage, missing cases and a false formal G4", () => {
  const o = createObserver();
  for (const mutate of [
    (s) => {
      s.cases = [];
    },
    (s) => {
      s.modelRequests = 1;
    },
    (s) => {
      s.cases[0].coverage.http = secret;
    },
    (s) => {
      s.cases[0].coverage.sqlite = 21;
    },
    (s) => {
      s.cases[0].gates.G4.verdict = "PASS";
    },
    (s) => {
      s.cases[0].gates.G4.findingCodes = [];
    },
  ]) {
    const s = summary();
    mutate(s);
    assert.throws(() => projectDiagnostic(s, raw(o), finalizer(), expected, 0));
  }
});
