// Synthetic host-driver fault tests. These are never PHP/TS Docker proof.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { validateTargetClock } from "../../packages/differential/src/clock.mjs";
import { mapTargetSnapshot } from "../../packages/differential/src/mapping.mjs";
import { SOURCE } from "../../packages/oracle/dist/reference/manifest.js";
import { CASES_PATH, PINS_PATH, root, verifyPins } from "./config.mjs";
import {
  errorCode,
  runCase,
  runSchedule,
  summarize,
  validateCorpus,
  verifyCoverage,
} from "./driver.mjs";
import { cleanupInventory } from "./finalize.mjs";

const bytes = readFileSync(join(root, CASES_PATH));
const corpus = validateCorpus(bytes);
const clone = (v) => structuredClone(v);
const scenario = corpus.cases[0];
const requestId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const identity = { runtimeId: "b".repeat(64), volume: "test-volume" };
const rawDb = (stepId) => ({
  format: "target-worker-sqlite-v1-proposed",
  source: "/state/target.sqlite",
  sqlite: "3.50.4",
  stepId,
  ...identity,
  schema: [
    {
      type: "table",
      name: "items",
      tbl: "items",
      sql: "CREATE TABLE items (id INTEGER PRIMARY KEY)",
    },
  ],
  tables: [
    {
      name: "items",
      columns: [
        {
          cid: 0,
          name: "id",
          type: "INTEGER",
          notnull: 0,
          dflt_value: null,
          pk: 1,
          hidden: 0,
        },
      ],
      rows: [[{ type: "integer", value: "1" }]],
    },
  ],
});
const snapshot = mapTargetSnapshot(rawDb("initial"), identity, "initial");
const http = () => ({
  status: 200,
  headers: { "content-type": "application/json; charset=utf-8" },
  body: Buffer.from('{"success":true,"id":"1"}'),
});
function fake(overrides = {}) {
  const seen = {
    close: 0,
    requests: 0,
    snapshots: 0,
    boot: 0,
    inventories: 0,
    reaped: 0,
  };
  const pair = {
    seen,
    php: {
      async reset() {},
      async http(request) {
        if (request.path.includes("get_slots")) seen.boot++;
        return { observation: http() };
      },
      async inspect() {
        return {
          snapshot: clone(snapshot),
          legacySha256: SOURCE.initialSha256,
        };
      },
      async close() {
        seen.close++;
      },
    },
    target: {
      async provision() {
        return identity;
      },
      async request(stepId) {
        seen.requests++;
        const o = http();
        return {
          stepId,
          requestId,
          status: o.status,
          headers: { ...o.headers, "x-request-id": requestId },
          bodyBase64: o.body.toString("base64"),
        };
      },
      async snapshot(stepId) {
        seen.snapshots++;
        return rawDb(stepId);
      },
      async close() {
        seen.close++;
      },
    },
    async clock() {},
    identity: () => identity,
    cleanupVerified: () => true,
    resources: {
      async inventory() {
        seen.inventories++;
        return { containers: [], volumes: [] };
      },
      async reap() {
        seen.reaped++;
        return {
          before: { containers: ["owned"], volumes: [] },
          after: { containers: [], volumes: [] },
        };
      },
    },
  };
  for (const [key, value] of Object.entries(overrides))
    Object.assign(pair[key], value);
  return pair;
}
test("frozen corpus: 14 cases/38 requests, corrupt hash rejected", () => {
  assert.equal(corpus.cases.length, 14);
  assert.equal(
    corpus.cases.reduce((n, s) => n + s.requests.length, 0),
    38,
  );
  assert.throws(
    () => validateCorpus(Buffer.concat([bytes, Buffer.from(" ")])),
    /CORPUS_HASH/,
  );
});
test("pins: canonical blobs checked; altered pin/trusted bytes rejected", () => {
  verifyPins({ strictCheckout: false });
  assert.throws(
    () =>
      verifyPins({
        read: (p) =>
          p === PINS_PATH ? Buffer.from("{}") : readFileSync(join(root, p)),
      }),
    /PIN_MISMATCH/,
  );
  assert.throws(
    () => verifyPins({ blob: () => Buffer.from("changed") }),
    /PIN_MISMATCH/,
  );
  assert.throws(
    () =>
      verifyPins({
        read: (p) =>
          p.endsWith("src/http.ts")
            ? Buffer.from("changed")
            : readFileSync(join(root, p)),
      }),
    /PIN_MISMATCH/,
  );
});
test("fresh lifecycle, complete initial and all HTTP/DB steps, real-shaped negative control", async () => {
  const pair = fake();
  const receipt = await runCase(scenario, pair);
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.executedHttp, 8);
  assert.equal(receipt.executedSqlite, 9);
  assert.equal(pair.seen.boot, 1);
  assert.equal(pair.seen.close, 2);
  assert.deepEqual(receipt.negativeControl, {
    status: "PASS",
    codes: ["HTTP_STATUS"],
  });
});
for (const request of [
  { method: "GET", path: "http://evil/" },
  { method: "POST", path: "/api.php?action=book", body: "unexpected=1" },
  { method: "GET", path: "/api.php?action=get_appointments", body: "x=1" },
])
  test(`policy before worker: ${JSON.stringify(request)}`, async () => {
    const pair = fake();
    let reset = false;
    pair.php.reset = async () => {
      reset = true;
    };
    const receipt = await runCase({ ...scenario, requests: [request] }, pair);
    assert.equal(receipt.errorCode, "POLICY_ERROR");
    assert.equal(reset, false);
  });
test("bad bootstrap status rejected before target provision", async () => {
  const pair = fake({
    php: {
      async http() {
        return { observation: { ...http(), status: 500 } };
      },
    },
  });
  const r = await runCase(scenario, pair);
  assert.equal(r.errorCode, "BOOTSTRAP_ERROR");
  assert.equal(r.executedSqlite, 0);
});
test("dirty bootstrap digest rejected", async () => {
  const r = await runCase(
    scenario,
    fake({
      php: {
        async inspect() {
          return { snapshot, legacySha256: "0".repeat(64) };
        },
      },
    }),
  );
  assert.equal(r.errorCode, "BOOTSTRAP_ERROR");
});
test("initial DB mismatch is ERROR and stops business requests", async () => {
  const pair = fake();
  pair.target.snapshot = async (id) => {
    const db = rawDb(id);
    db.tables[0].rows[0][0].value = "2";
    return db;
  };
  const r = await runCase(scenario, pair);
  assert.equal(r.errorCode, "INITIAL_DB_ERROR");
  assert.equal(r.executedHttp, 0);
  assert.equal(r.executedSqlite, 1);
});
for (const code of ["CLOCK_PARITY_BLOCKED", "RUNTIME_MISMATCH"])
  test(`bad clock/runtime: ${code}`, async () => {
    const pair = fake();
    pair.clock = async () => {
      throw Error(code);
    };
    const r = await runCase(scenario, pair);
    assert.equal(r.status, "ERROR");
    assert.equal(r.errorCode, code);
    assert.equal(r.executedHttp, 0);
  });
test("original clock validator rejects wrong real date", () => {
  assert.throws(
    () =>
      validateTargetClock({
        node: "v24.11.0",
        sqlite: "3.50.4",
        before: { date: "wrong" },
      }),
    /CLOCK_PARITY_BLOCKED/,
  );
});
for (const kind of [
  "step-id",
  "base64",
  "db-identity",
  "db-missing",
  "http-missing",
])
  test(`broken receipt: ${kind}`, async () => {
    const pair = fake();
    const request = pair.target.request;
    if (kind === "step-id" || kind === "base64" || kind === "http-missing")
      pair.target.request = async (...args) => {
        const r = await request(...args);
        if (kind === "step-id") r.stepId = "wrong";
        if (kind === "base64") r.bodyBase64 = "???";
        if (kind === "http-missing") return undefined;
        return r;
      };
    if (kind === "db-identity" || kind === "db-missing")
      pair.target.snapshot = async (id) => {
        const r = rawDb(id);
        if (kind === "db-identity") r.runtimeId = "wrong";
        else r.tables = [];
        return r;
      };
    const r = await runCase(scenario, pair);
    assert.equal(r.status, "ERROR");
    assert.equal(pair.seen.close, 2);
  });
test("ordinary observed mismatch stays FAIL and next fixed case executes", async () => {
  const smaller = { cases: corpus.cases.slice(0, 3) };
  const results = await runSchedule(smaller, async (s) => {
    const p = fake();
    if (s !== scenario) {
      const request = p.target.request;
      p.target.request = async (...args) => ({
        ...(await request(...args)),
        bodyBase64: Buffer.from('{"success":false}').toString("base64"),
      });
    }
    return p;
  });
  assert.deepEqual(
    results.map((r) => r.status),
    ["PASS", "FAIL", "FAIL"],
  );
  assert.equal(results[1].firstDifference.kind, "HTTP");
});
test("DB full cell mismatch detected even with same row count", async () => {
  const p = fake();
  p.target.snapshot = async (id) => {
    const r = rawDb(id);
    if (id !== "initial") r.tables[0].rows[0][0].value = "10";
    return r;
  };
  const r = await runCase(corpus.cases[1], p);
  assert.equal(r.status, "FAIL");
  assert.deepEqual(r.firstDifference.codes, ["DB_STATE"]);
});
test("infrastructure ERROR stops schedule, remaining scenarios NOT_RUN", async () => {
  const results = await runSchedule(corpus, async () =>
    fake({
      target: {
        async provision() {
          throw Error("BUILD_FAILED");
        },
      },
    }),
  );
  assert.equal(results[0].status, "ERROR");
  assert(results.slice(1).every((r) => r.status === "NOT_RUN"));
  assert.equal(summarize(corpus, results).parity, "INCONCLUSIVE");
});
test("abort before task and late HTTP receipt never count as executed comparison", async () => {
  const c = new AbortController();
  c.abort();
  const early = await runCase(scenario, fake(), c.signal);
  assert.equal(early.errorCode, "ABORTED");
  assert.equal(early.executedHttp, 0);
  const later = new AbortController(),
    p = fake();
  let joined = false;
  const original = p.target.request;
  p.target.request = async (...args) => {
    later.abort();
    await new Promise((r) => setTimeout(r, 5));
    joined = true;
    return original(...args);
  };
  const r = await runCase(scenario, p, later.signal);
  assert.equal(joined, true);
  assert.equal(r.errorCode, "ABORTED");
  assert.equal(r.executedHttp, 0);
  assert.equal(p.seen.close, 2);
});
test("normal cleanup failure remains ERROR with final zero inventory", async () => {
  const r = await runCase(
    scenario,
    fake({
      php: {
        async close() {
          throw Error("cleanup sensitive path");
        },
      },
    }),
  );
  assert.equal(r.status, "ERROR");
  assert.equal(r.normalCleanup, "ERROR");
  assert.equal(r.errorCode, "CLEANUP_ERROR");
});
test("emergency removal remains ERROR even with zero residual inventory", async () => {
  const p = fake();
  let n = 0;
  p.resources.inventory = async () => ({
    containers: n++ === 0 ? ["owned"] : [],
    volumes: [],
  });
  const r = await runCase(scenario, p);
  assert.equal(r.status, "ERROR");
  assert.equal(r.emergencyRemoved, 1);
  assert.equal(r.inventory.containers, 0);
});
test("complete schedule and missing controls/coverage cannot become PASS", async () => {
  const results = await runSchedule(corpus, async () => fake());
  const summary = summarize(corpus, results);
  assert.equal(summary.harness, "SUCCESS");
  assert.equal(summary.coverage.http, 38);
  assert.equal(summary.coverage.sqlite, 52);
  assert.equal(summary.classification, "NOT_ESTABLISHED");
  for (const change of [
    (r) => {
      r[0].initial.status = "NOT_RUN";
    },
    (r) => {
      r[0].steps[1].http.status = "NOT_RUN";
    },
    (r) => {
      r[0].steps[1].db.status = "NOT_RUN";
    },
    (r) => {
      r[0].steps[1].stepId = "wrong";
    },
    (r) => {
      delete r[0].negativeControl;
    },
    (r) => {
      r[0].status = "FAIL";
    },
    (r) => {
      r[4].status = "ERROR";
    },
  ]) {
    const altered = clone(results);
    change(altered);
    assert.equal(summarize(corpus, altered).harness, "ERROR");
  }
  const missing = clone(results[0]);
  missing.executedSqlite--;
  assert.throws(() => verifyCoverage(scenario, missing), /COVERAGE_ERROR/);
});
test("public errors never contain paths, stack traces, secrets, or arbitrary messages", () => {
  for (const message of [
    "/home/runner/token=secret",
    "TOP_SECRET_TOKEN",
    "C:\\private\\file",
    "Error\nstack",
  ])
    assert.equal(errorCode(Error(message)), "DRIVER_ERROR");
});
test("independent finalizer removes exact owned resources and preserves emergency history", async () => {
  const own = "mmp-reference-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const foreign = "mmp-reference-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const names = { containers: [own], volumes: [], prefixes: [] };
  const current = new Set([own, foreign]);
  const removed = [];
  const execute = async (args) => {
    let stdout = "";
    if (args[0] === "container") stdout = [...current].join("\n");
    else if (args[0] === "rm") {
      removed.push(args.at(-1));
      current.delete(args.at(-1));
    }
    return { exitCode: 0, stdout, stderr: "" };
  };
  const history = { normalCleanupError: false, emergencyRemoved: 0 };
  const first = await cleanupInventory(names, execute, history);
  assert.equal(first.status, "ERROR");
  assert.equal(first.emergencyRemoved, 1);
  assert.deepEqual(removed, [own]);
  assert(current.has(foreign));
  const second = await cleanupInventory(names, execute, history);
  assert.equal(second.status, "ERROR");
  assert.equal(second.emergencyRemoved, 1);
  assert.equal(second.inventory.containers, 0);
});
test("independent finalizer rejects global prefixes and reports removal failure", async () => {
  const ok = async () => ({ exitCode: 0, stdout: "", stderr: "" });
  await assert.rejects(
    cleanupInventory(
      { containers: [], volumes: [], prefixes: ["mmp007-provenance-"] },
      ok,
    ),
    /CLEANUP_ERROR/,
  );
  const name = "mmp-reference-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const failed = await cleanupInventory(
    { containers: [name], volumes: [], prefixes: [] },
    async (args) => ({
      exitCode: args[0] === "rm" ? 1 : 0,
      stdout: args[0] === "container" ? name : "",
      stderr: "",
    }),
  );
  assert.equal(failed.status, "ERROR");
  assert.equal(failed.inventory.containers, 1);
});
