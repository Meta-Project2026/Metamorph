import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  compareHttp,
  compareSqlite,
  MANIFEST,
  snapshotSqlite,
} from "@metamorph/oracle";
import { encode } from "../../target-worker/runtime/sqlite-value.mjs";
import { POLICY, TargetWorker } from "../../target-worker/src/controller.mjs";
import { validateTargetClock } from "../src/clock.mjs";
import { mapTargetHttp, mapTargetSnapshot } from "../src/mapping.mjs";
import { checkedScenarios, SCENARIOS, stepId } from "../src/policy.mjs";
import { publicSummary } from "../src/public.mjs";
import { strictJson } from "../src/strict.mjs";
import { TargetOracleAdapter } from "../src/target-adapter.mjs";

const scratch = mkdtempSync(join(tmpdir(), "mmp008a-control-"));
const path = join(scratch, "original.sqlite");
const db = new DatabaseSync(path);
db.exec(readFileSync(new URL("fixture.sql", import.meta.url), "utf8"));
const schema = db
  .prepare(
    "SELECT type,name,tbl_name AS tbl,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' OR name='sqlite_sequence' ORDER BY type,name",
  )
  .all();
// Independent original fixture inspection using the target's pure scalar encoder.
const tables = schema
  .filter((s) => s.type === "table")
  .map((s) => {
    const columns = db.prepare(`PRAGMA table_xinfo("${s.name}")`).all();
    const stmt = db.prepare(`SELECT * FROM "${s.name}"`);
    stmt.setReadBigInts(true);
    return {
      name: s.name,
      columns,
      rows: stmt.all().map((row) => columns.map((c) => encode(row[c.name]))),
    };
  });
db.close();
const identity = { runtimeId: "a".repeat(64), volume: "original-fixture-db" };
const wire = {
  format: "target-worker-sqlite-v1-proposed",
  source: "/state/target.sqlite",
  schema,
  tables,
  sqlite: "3.50.4",
  stepId: "original",
  ...identity,
};
const expected = snapshotSqlite(path);
const clone = (value) => structuredClone(value);
const signal = () => AbortSignal.timeout(10000);
test.after(() => {
  assert.ok(scratch.startsWith(join(tmpdir(), "mmp008a-control-")));
  rmSync(scratch, { recursive: true, force: true });
});

test("independent original typed fixture maps exactly to existing Oracle snapshot", () => {
  assert.deepEqual(mapTargetSnapshot(wire, identity, "original"), expected);
  assert.deepEqual(
    compareSqlite(expected, mapTargetSnapshot(wire, identity, "original")),
    [],
  );
});
for (const [name, mutate, code] of [
  [
    "DDL default",
    (x) => {
      x.schema.find((s) => s.name === "scalar").sql = x.schema
        .find((s) => s.name === "scalar")
        .sql.replace("original-default", "mutated-default");
    },
    "DB_SCHEMA",
  ],
  [
    "schema SQL whitespace",
    (x) => {
      x.schema[0].sql += " ";
    },
    "DB_SCHEMA",
  ],
  [
    "composite PK rank",
    (x) => {
      const cols = x.tables.find((t) => t.name === "composite").columns;
      [cols[0].pk, cols[1].pk] = [cols[1].pk, cols[0].pk];
    },
    "DB_STATE",
  ],
  [
    "sequence",
    (x) => {
      x.tables.find((t) => t.name === "sqlite_sequence").rows[0][1].value =
        "19";
    },
    "DB_STATE",
  ],
  [
    "negative int64",
    (x) => {
      x.tables.find((t) => t.name === "scalar").rows[0][1].value =
        "-9223372036854775807";
    },
    "DB_STATE",
  ],
  [
    "upper int64",
    (x) => {
      x.tables.find((t) => t.name === "scalar").rows[1][1].value =
        "9223372036854775806";
    },
    "DB_STATE",
  ],
  [
    "REAL fraction",
    (x) => {
      x.tables.find((t) => t.name === "scalar").rows[0][2].value = 1.25;
    },
    "DB_STATE",
  ],
  [
    "BLOB",
    (x) => {
      x.tables.find((t) => t.name === "scalar").rows[0][4].value = "00abfe";
    },
    "DB_STATE",
  ],
  [
    "NULL versus text",
    (x) => {
      x.tables.find((t) => t.name === "scalar").rows[0][5] = {
        type: "text",
        value: "",
      };
    },
    "DB_STATE",
  ],
  [
    "duplicate row",
    (x) => {
      const rows = x.tables.find((t) => t.name === "multiset").rows;
      rows.push(clone(rows[0]));
    },
    "DB_STATE",
  ],
])
  test(`existing comparator detects ${name} mutant`, () => {
    const x = clone(wire);
    mutate(x);
    assert.ok(
      compareSqlite(expected, mapTargetSnapshot(x, identity, "original")).some(
        (diff) => diff.code === code,
      ),
    );
  });
for (const [name, mutate] of [
  [
    "missing schema",
    (x) => {
      x.schema = [];
    },
  ],
  [
    "missing table",
    (x) => {
      x.tables.pop();
    },
  ],
  [
    "duplicate table",
    (x) => {
      x.tables[1] = clone(x.tables[0]);
    },
  ],
  [
    "unordered schema",
    (x) => {
      x.schema.reverse();
    },
  ],
  [
    "hidden column",
    (x) => {
      x.tables[0].columns[0].hidden = 1;
    },
  ],
  [
    "column length",
    (x) => {
      x.tables[0].columns.pop();
    },
  ],
  [
    "column order",
    (x) => {
      x.tables[0].columns.reverse();
    },
  ],
  [
    "partial row",
    (x) => {
      x.tables[0].rows[0].pop();
    },
  ],
  [
    "int64 overflow",
    (x) => {
      x.tables.find((t) => t.name === "scalar").rows[0][1].value =
        "9223372036854775808";
    },
  ],
  [
    "nonfinite REAL",
    (x) => {
      x.tables.find((t) => t.name === "scalar").rows[0][2].value = Infinity;
    },
  ],
  [
    "unknown scalar",
    (x) => {
      x.tables[0].rows[0][0] = { type: "decimal", value: "1" };
    },
  ],
  [
    "extra raw field",
    (x) => {
      x.privateAnswer = "never public";
    },
  ],
  [
    "absent sequence",
    (x) => {
      x.schema = x.schema.filter((s) => s.name !== "sqlite_sequence");
      x.tables = x.tables.filter((t) => t.name !== "sqlite_sequence");
    },
  ],
  [
    "stale runtime",
    (x) => {
      x.runtimeId = "b".repeat(64);
    },
  ],
  [
    "wrong volume",
    (x) => {
      x.volume = "other-db";
    },
  ],
])
  test(`strict mapper rejects ${name}`, () => {
    const x = clone(wire);
    mutate(x);
    assert.throws(() => mapTargetSnapshot(x, identity, "original"));
  });

const requestId = "12345678-1234-1234-1234-123456789abc";
const http = () => ({
  stepId: "step-01",
  requestId,
  status: 200,
  headers: { "content-type": "application/json", "x-request-id": requestId },
  bodyBase64: Buffer.from('{"value":1}').toString("base64"),
});
test("HTTP uses real bytes/headers with internal identity separate from stable business headers", () => {
  const value = http();
  const observation = mapTargetHttp(value, "step-01", requestId);
  assert.equal(
    compareHttp(observation, {
      ...observation,
      headers: { ...observation.headers, "x-request-id": randomUUID() },
    }).length,
    0,
  );
  assert.equal(Buffer.from(observation.body).toString(), '{"value":1}');
});
for (const [name, patch] of [
  ["missing content-type", { headers: { "x-request-id": requestId } }],
  [
    "duplicate spelling",
    {
      headers: {
        "x-request-id": requestId,
        "content-type": "application/json",
        "Content-Type": "application/json",
      },
    },
  ],
  ["wrong request identity", { requestId: randomUUID() }],
  ["wrong step", { stepId: "step-02" }],
  ["bad base64", { bodyBase64: "bad===" }],
  ["bad UTF8", { bodyBase64: Buffer.from([255]).toString("base64") }],
  [
    "duplicate body key",
    { bodyBase64: Buffer.from('{"a":1,"a":2}').toString("base64") },
  ],
  [
    "precision loss",
    { bodyBase64: Buffer.from('{"a":9007199254740993}').toString("base64") },
  ],
])
  test(`HTTP rejects ${name}`, () =>
    assert.throws(() =>
      mapTargetHttp({ ...http(), ...patch }, "step-01", requestId),
    ));
test("strict raw inspector envelope rejects duplicate/escaped keys before lossy parsing", () => {
  for (const text of [
    '{"a":1,"a":2}',
    '{"a":1,"\\u0061":2}',
    '{"nested":{"x":1,"x":2}}',
  ])
    assert.throws(() => strictJson(text), /WIRE_DUPLICATE_KEY/);
  assert.deepEqual(strictJson('{"a":[{"b":1},null]}'), { a: [{ b: 1 }, null] });
});

// Original synthetic controller boundary only; not an issued production runtime.
function fakeWorker() {
  const w = Object.create(TargetWorker.prototype);
  let generation = 0;
  Object.assign(w, {
    image: `sha256:${"a".repeat(64)}`,
    provenance: { imageId: `sha256:${"a".repeat(64)}` },
    bundle: { candidateSha: "b".repeat(64) },
    runId: `mmp007-${randomUUID()}`,
    evidence: { commands: [], readiness: [], cleanupVerified: false },
    resetCount: 0,
  });
  const reset = async (scenarioId) => {
    generation++;
    w.resetCount++;
    w.runtime = {
      id: String(generation).padStart(64, "0"),
      volume: `${w.runId}-${generation}-db`,
      name: `${w.runId}-${generation}-runtime`,
      scenarioId,
    };
    return {
      runId: w.runId,
      candidateSha: w.bundle.candidateSha,
      imageId: w.image,
      runtimeId: w.runtime.id,
      scenarioId,
      policy: POLICY,
    };
  };
  w.provision = () => reset("public-initial");
  w.reset = reset;
  w.snapshot = async (id) => {
    const raw = {
      format: wire.format,
      source: wire.source,
      schema: clone(wire.schema),
      tables: clone(wire.tables),
      sqlite: wire.sqlite,
    };
    if (w.polluted && generation > 1)
      raw.tables.find((t) => t.name === "sqlite_sequence").rows[0][1].value =
        "999";
    w.evidence.commands.push({
      args: [
        "run",
        `type=volume,source=${w.runtime.volume},target=/state,readonly`,
        "/opt/worker/inspect.mjs",
        '{"kind":"snapshot"}',
      ],
      exitCode: 0,
      stdout: JSON.stringify(raw),
    });
    return {
      stepId: id,
      runtimeId: w.runtime.id,
      volume: w.runtime.volume,
      ...raw,
    };
  };
  w.request = async (id, method, path, body) => {
    const raw = http();
    delete raw.stepId;
    w.evidence.commands.push({
      args: [
        "run",
        `container:${w.runtime.id}`,
        "/opt/worker/inspect.mjs",
        JSON.stringify({ kind: "http", method, path, body, requestId }),
      ],
      exitCode: 0,
      stdout: JSON.stringify(raw),
    });
    return { ...raw, stepId: id };
  };
  w.close = async () => {
    w.evidence.cleanupVerified = true;
  };
  return w;
}
const adapter = (
  w = fakeWorker(),
  scenarios = SCENARIOS,
  inventory = async () => ({ containers: [], volumes: [] }),
) => new TargetOracleAdapter(w, scenarios, { record() {}, inventory });
test("schedule rejects missing/duplicate/unknown/unordered scenario or changed public request", async () => {
  assert.throws(
    () => checkedScenarios([MANIFEST[1], MANIFEST[0]]),
    /SCENARIO_SCHEDULE/,
  );
  for (const value of [
    [],
    [{ id: "wrong", requests: [] }],
    [SCENARIOS[0], SCENARIOS[0]],
    [{ ...SCENARIOS[0], requests: [] }],
  ])
    assert.throws(() => checkedScenarios(value), /SCENARIO_SCHEDULE/);
});
test("accepted target transport rejects actual workshop dotted paths; no route rewrite is attempted", async () => {
  const boundary = { operation: async (fn) => fn() };
  await assert.rejects(
    TargetWorker.prototype.request.call(
      boundary,
      "step-01",
      "POST",
      "/api.php?action=book",
      SCENARIOS[0].requests[0].body,
      signal(),
    ),
    /ADMISSION_REJECTED/,
  );
});
test("close cancels and joins an in-flight target operation even with an expired caller signal", async () => {
  const w = fakeWorker();
  const a = adapter(w);
  await a.provision(signal());
  await a.reset(signal());
  let entered;
  const ready = new Promise((resolve) => {
    entered = resolve;
  });
  let rejectRequest;
  w.request = async () => {
    entered();
    return new Promise((_resolve, reject) => {
      rejectRequest = reject;
    });
  };
  w.close = async () => {
    w.evidence.cleanupVerified = true;
    const error = new Error("private");
    error.code = "CANCELLED";
    rejectRequest?.(error);
  };
  const pending = a.request(SCENARIOS[0].requests[0], signal());
  await ready;
  const close = a.close(AbortSignal.abort());
  await assert.rejects(pending, /CANCELLED/);
  await close;
  assert.equal(a.closed, true);
  assert.equal(a.failure.operationCode, "CANCELLED");
});
test("real adapter contract consumes provision public-initial then fresh scheduled reset and exact steps", async () => {
  const w = fakeWorker();
  const a = adapter(w);
  await a.provision(signal());
  assert.equal(w.runtime.scenarioId, "public-initial");
  await a.reset(signal());
  assert.equal(w.resetCount, 2);
  assert.deepEqual(await a.snapshot(signal()), expected);
  for (const request of SCENARIOS[0].requests)
    await a.request(request, signal());
  assert.equal(a.stats.requests, 6);
  await assert.rejects(a.reset(signal()), /RESET_SCHEDULE/);
  await a.close(signal());
});
for (const [name, invoke] of [
  [
    "missing step",
    (a) =>
      a.requestStep(
        "workshop-business",
        undefined,
        SCENARIOS[0].requests[0],
        signal(),
      ),
  ],
  [
    "wrong step order",
    (a) =>
      a.requestStep(
        "workshop-business",
        stepId(1),
        SCENARIOS[0].requests[0],
        signal(),
      ),
  ],
  [
    "wrong scenario",
    (a) =>
      a.requestStep(
        "workshop-rejected",
        stepId(0),
        SCENARIOS[0].requests[0],
        signal(),
      ),
  ],
  [
    "changed input",
    (a) => a.request({ method: "GET", path: "/other" }, signal()),
  ],
])
  test(`adapter rejects ${name} and closes`, async () => {
    const w = fakeWorker();
    const a = adapter(w);
    await a.provision(signal());
    await a.reset(signal());
    await assert.rejects(invoke(a), /STEP_IDENTITY/);
    assert.equal(w.evidence.cleanupVerified, true);
  });
test("dirty reset, stale runtime and replaced image never become accepted observations", async () => {
  const dirty = fakeWorker();
  dirty.polluted = true;
  const a = adapter(dirty);
  await a.provision(signal());
  await assert.rejects(a.reset(signal()), /DIRTY_TARGET_RESET/);
  for (const mutate of [
    (w) => {
      w.runtime.id = "c".repeat(64);
    },
    (w) => {
      w.image = `sha256:${"c".repeat(64)}`;
    },
  ]) {
    const w = fakeWorker();
    const b = adapter(w);
    await b.provision(signal());
    await b.reset(signal());
    mutate(w);
    await assert.rejects(b.snapshot(signal()));
  }
});
for (const code of [
  "RUNTIME_FAILED",
  "TIMEOUT",
  "CANCELLED",
  "OBSERVATION_ERROR",
])
  test(`preserve ${code} separately from cleanup error`, async () => {
    const w = fakeWorker();
    const a = adapter(w);
    await a.provision(signal());
    await a.reset(signal());
    w.request = async () => {
      const error = new Error("private diagnostic");
      error.code = code;
      w.evidence.operationError = code;
      throw error;
    };
    w.close = async () => {
      throw new Error("private cleanup diagnostic");
    };
    await assert.rejects(
      a.request(SCENARIOS[0].requests[0], signal()),
      /CLEANUP_ERROR/,
    );
    assert.deepEqual(a.failure, {
      operationCode: code,
      cleanupCode: "CLEANUP_ERROR",
    });
    await assert.rejects(a.close(AbortSignal.abort()), /CLEANUP_ERROR/);
  });
test("cleanup verifies actual inventory instead of accepting self-reported success", async () => {
  const a = adapter(fakeWorker(), SCENARIOS, async () => ({
    containers: ["residual"],
    volumes: [],
  }));
  await assert.rejects(a.close(signal()), /CLEANUP_ERROR/);
});
test("raw duplicate inspector keys and polluted snapshots fail before Oracle comparison", async () => {
  const w = fakeWorker();
  const a = adapter(w);
  await a.provision(signal());
  await a.reset(signal());
  const snapshot = w.snapshot;
  w.snapshot = async (...args) => {
    const result = await snapshot(...args);
    const receipt = w.evidence.commands.at(-1);
    receipt.stdout = receipt.stdout.replace(
      '"format":',
      '"format":"duplicate","format":',
    );
    return result;
  };
  await assert.rejects(a.snapshot(signal()), /WIRE_DUPLICATE_KEY/);
});
test("actual clock policy rejects wrong wall date and frozen monotonic APIs", () => {
  const point = {
    date: "2026-10-27T12:00:00.000Z",
    dateNow: 1793102400000,
    sqlite: {
      datetime: "2026-10-27 12:00:00",
      timestamp: "2026-10-27 12:00:00",
    },
    performanceNow: 10,
    hrtime: "10000000",
  };
  const value = {
    node: "v24.11.0",
    sqlite: "3.50.4",
    before: point,
    after: { ...point, performanceNow: 1210, hrtime: "1210000000" },
    monotonicDeltaMs: 1200,
  };
  validateTargetClock(value);
  for (const patch of [
    { after: { ...value.after, dateNow: 0 } },
    { after: value.before },
    { sqlite: "unknown" },
  ])
    assert.throws(
      () => validateTargetClock({ ...value, ...patch }),
      /CLOCK_PARITY_BLOCKED/,
    );
});
test("public projection preserves actual FAIL/INCONCLUSIVE and never leaks raw fields or paths", () => {
  const input = {
    headSha: "a".repeat(40),
    phpImage: `sha256:${"a".repeat(64)}`,
    targetImage: `sha256:${"b".repeat(64)}`,
    recipeSha: "c".repeat(64),
    phpPackSha: "d".repeat(64),
    bridgePackSha: "e".repeat(64),
    gates: [
      {
        gate: "G2",
        verdict: "INCONCLUSIVE",
        executedTestIds: [],
        findings: [{ code: "MISSING_COVERAGE", message: "private" }],
      },
      {
        gate: "G3",
        verdict: "FAIL",
        executedTestIds: ["workshop-business:initial"],
        findings: [{ code: "DB_SCHEMA", message: "raw SQL" }],
      },
      {
        gate: "G4",
        verdict: "INCONCLUSIVE",
        executedTestIds: [],
        findings: [{ code: "HELD_OUT_NOT_RUN" }],
      },
    ],
    initialDiffs: [{ code: "DB_SCHEMA", path: "/schema" }],
    cleanup: "VERIFIED_ZERO_RESOURCES",
    counts: {
      phpBootstrap: 1,
      targetReadinessAttempts: 2,
      targetReadinessSuccesses: 2,
      targetResetsIncludingProvision: 2,
      targetOperations: 5,
      targetOracleSnapshots: 1,
      targetHttpRequests: 0,
    },
  };
  const summary = publicSummary(input);
  assert.equal(summary.gates[1].verdict, "FAIL");
  assert.equal(summary.comparisons.http, 0);
  assert.equal(summary.httpDifferential, "NOT_EXECUTED_AFTER_INITIAL_MISMATCH");
  assert.ok(!JSON.stringify(summary).includes("raw SQL"));
  assert.ok(!JSON.stringify(summary).includes("private"));
  for (const patch of [
    { raw: "answer" },
    { headSha: "/private/path" },
    { cleanup: "ERROR" },
  ])
    assert.throws(() => publicSummary({ ...input, ...patch }));
});
