import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { GateResultSchema, RunEventSchema } from "@metamorph/contracts";
import {
  compareHttp,
  compareSqlite,
  runControls,
  snapshotSqlite,
  verifyPair,
} from "../dist/index.js";
import { createFixture, scenarios } from "./fixtures.mjs";

async function temporary(t, close = async () => {}) {
  const root = await mkdtemp(join(tmpdir(), "metamorph-oracle-test-"));
  t.after(async () => {
    await close();
    await rm(root, { recursive: true, force: true });
  });
  return root;
}

const http = (
  body,
  status = 200,
  headers = { "content-type": "application/json" },
) => ({ status, headers, body: Buffer.from(body) });

test("HTTP controls preserve scalar/null/missing/order/status/header and meaningful bytes", () => {
  const original = http('{"id":1,"value":null,"items":[1,2]}');
  assert.deepEqual(
    compareHttp(
      http('{"nested":[{},[],{"a":1.0}],"escaped":"\\""}'),
      http('{"escaped":"\\"","nested":[{},[],{"a":1e0}]}'),
    ),
    [],
  );
  assert.deepEqual(
    compareHttp(original, http('{"items":[1,2],"value":null,"id":1}')),
    [],
  );
  for (const [candidate, code] of [
    [http('{"id":"1","value":null,"items":[1,2]}'), "HTTP_JSON_TYPE"],
    [http('{"id":true,"value":null,"items":[1,2]}'), "HTTP_JSON_TYPE"],
    [http('{"id":1,"items":[1,2]}'), "HTTP_JSON_MISSING"],
    [http('{"id":1,"value":"null","items":[1,2]}'), "HTTP_JSON_TYPE"],
    [http('{"id":1,"value":null,"items":[2,1]}'), "HTTP_JSON_VALUE"],
    [http('{"id":1,"value":null,"items":[1,2]}', 409), "HTTP_STATUS"],
    [
      http('{"id":1,"value":null,"items":[1,2]}', 200, {
        "content-type": "text/html",
      }),
      "HTTP_HEADER",
    ],
    [
      http('{"id":1,"value":null,"items":[1,2]}', 200, {
        "content-type": "application/json",
        location: "/different",
      }),
      "HTTP_HEADER",
    ],
  ])
    assert.ok(
      compareHttp(original, candidate).some((diff) => diff.code === code),
      code,
    );
  assert.ok(
    compareHttp(
      http("<p>a</p>", 200, { "content-type": "text/html" }),
      http("<p>a </p>", 200, { "content-type": "text/html" }),
    ).length > 0,
  );
  assert.deepEqual(
    compareHttp(
      http("{}", 200, { "Content-Type": "application/json", date: "one" }),
      http("{}", 200, { "content-type": "application/json", date: "two" }),
    ),
    [],
  );
  for (const invalid of [
    http("{"),
    http("1e400"),
    http("9007199254740993"),
    http("0.10000000000000001"),
    http("1e-999"),
    http('{"duplicate":1,"duplicate":2}'),
    http('{"escaped":1,"\\u0065scaped":2}'),
    http("{}", 0),
    http("{}", 200, {}),
    http("{}", 200, {
      "content-type": "application/json",
      "Content-Type": "application/json",
    }),
  ]) {
    assert.throws(() => compareHttp(invalid, invalid));
  }
});

test("SQLite reads real typed rows, schema/defaults, full integers, blobs and sequences", async (t) => {
  let databases = [];
  const root = await temporary(t, () => {
    for (const db of databases) db.close();
  });
  const paths = [join(root, "a.sqlite"), join(root, "b.sqlite")];
  databases = paths.map((path) => new DatabaseSync(path));
  const schema =
    "CREATE TABLE items (id INTEGER PRIMARY KEY AUTOINCREMENT, value TEXT NOT NULL DEFAULT 'new', payload BLOB, large INTEGER, optional TEXT);";
  for (const db of databases) db.exec(schema);
  databases[0].exec(
    "INSERT INTO items VALUES (2,'b',x'00ff',9223372036854775807,NULL),(1,'a',x'',-9223372036854775808,NULL)",
  );
  databases[1].exec(
    "INSERT INTO items VALUES (1,'a',x'',-9223372036854775808,NULL),(2,'b',x'00ff',9223372036854775807,NULL)",
  );
  const original = snapshotSqlite(paths[0]);
  assert.deepEqual(compareSqlite(original, snapshotSqlite(paths[1])), []);
  assert.ok(JSON.stringify(original).includes("9223372036854775807"));
  assert.ok(JSON.stringify(original).includes("00ff"));
  databases[1].exec("UPDATE items SET value='changed' WHERE id=1");
  assert.ok(
    compareSqlite(original, snapshotSqlite(paths[1])).some(
      (diff) => diff.code === "DB_STATE",
    ),
  );
  databases[1].exec(
    "UPDATE items SET value='a' WHERE id=1; UPDATE sqlite_sequence SET seq=10 WHERE name='items'",
  );
  assert.ok(compareSqlite(original, snapshotSqlite(paths[1])).length > 0);
  databases[1].exec(
    "UPDATE sqlite_sequence SET seq=2 WHERE name='items'; CREATE INDEX value_idx ON items(value)",
  );
  assert.ok(
    compareSqlite(original, snapshotSqlite(paths[1])).some(
      (diff) => diff.code === "DB_SCHEMA",
    ),
  );
  assert.throws(() => snapshotSqlite(join(root, "missing.sqlite")));
  assert.throws(() =>
    compareSqlite(
      { format: "sqlite-logical-v1" },
      { format: "sqlite-logical-v1" },
    ),
  );
});

test("SQLite no-PK duplicates, composite keys, generated columns and rollback are observable", async (t) => {
  let db;
  const root = await temporary(t, () => db?.close());
  const path = join(root, "state.sqlite");
  db = new DatabaseSync(path);
  db.exec(
    "CREATE TABLE bag(value TEXT); INSERT INTO bag VALUES ('b'),('a'),('a'); CREATE TABLE composite(a INTEGER, b INTEGER, value TEXT, PRIMARY KEY(a,b)) WITHOUT ROWID; INSERT INTO composite VALUES(2,1,'x'),(1,2,'y'); CREATE TABLE generated(a INTEGER, b INTEGER GENERATED ALWAYS AS (a * 2) STORED); INSERT INTO generated(a) VALUES(3)",
  );
  const original = snapshotSqlite(path);
  db.exec("BEGIN; INSERT INTO bag VALUES('uncommitted'); ROLLBACK;");
  assert.deepEqual(compareSqlite(original, snapshotSqlite(path)), []);
  db.exec(
    "DELETE FROM bag WHERE rowid = (SELECT min(rowid) FROM bag WHERE value='a')",
  );
  assert.ok(compareSqlite(original, snapshotSqlite(path)).length > 0);
});

test("independent controls reject always-equal/invalid/throwing verifiers", () => {
  const controls = runControls();
  assert.equal(controls.verdict, "PASS");
  assert.equal(controls.cases.length, 9);
  assert.equal(
    runControls({ http: () => [], sqlite: compareSqlite }).verdict,
    "FAIL",
  );
  assert.equal(
    runControls({ http: compareHttp, sqlite: () => [] }).verdict,
    "FAIL",
  );
  assert.equal(
    runControls({
      http: () => {
        throw new Error("broken");
      },
      sqlite: compareSqlite,
    }).verdict,
    "ERROR",
  );
  assert.equal(
    runControls({ http: () => undefined, sqlite: compareSqlite }).verdict,
    "ERROR",
  );
});

for (const [mutant, expectedG2, expectedG3] of [
  ["none", "PASS", "PASS"],
  ["http-status", "FAIL", "FAIL"],
  ["http-type", "FAIL", "FAIL"],
  ["db-row", "PASS", "FAIL"],
  ["db-sequence", "PASS", "FAIL"],
  ["snapshot-error", "ERROR", "ERROR"],
]) {
  test(`real HTTP / separate SQLite pair: ${mutant}`, async (t) => {
    let reference;
    let candidate;
    const root = await temporary(t, async () => {
      await reference?.close();
      await candidate?.close();
    });
    reference = await createFixture(root, "reference");
    candidate = await createFixture(root, "candidate", mutant);
    const result = await verifyPair({
      reference,
      candidate,
      scenarios,
      artifactParent: root,
      operationTimeoutMs: 2000,
    });
    assert.deepEqual(
      result.gateResults.map((gate) => gate.verdict),
      [expectedG2, expectedG3, "INCONCLUSIVE"],
    );
    for (const gate of result.gateResults) GateResultSchema.parse(gate);
    const read = async (path) =>
      JSON.parse(await readFile(join(result.evidenceDirectory, path), "utf8"));
    assert.deepEqual(await read("gate-results.json"), result.gateResults);
    for (const gate of result.gateResults) {
      for (const path of gate.evidencePaths) await read(path);
    }
    const events = (
      await readFile(join(result.evidenceDirectory, "events.jsonl"), "utf8")
    )
      .trim()
      .split("\n");
    for (const event of events) RunEventSchema.parse(JSON.parse(event));
    assert.equal((await read("manifest.json")).productVerdict, "NOT_RUN");
    assert.deepEqual(await read("model-usage.json"), []);
    if (mutant === "none") {
      assert.deepEqual(result.gateResults[0].executedTestIds, [
        "write-then-read:step-0",
        "write-then-read:step-1",
        "fresh-state:step-0",
      ]);
      const raw = await read("http/0-1.json");
      assert.deepEqual(
        JSON.parse(Buffer.from(raw.reference.bodyBase64, "base64").toString()),
        { items: [{ id: 1, value: "saved" }], optional: null },
      );
      const fresh = await read("http/1-0.json");
      assert.deepEqual(
        JSON.parse(Buffer.from(fresh.candidate.bodyBase64, "base64").toString())
          .items,
        [],
      );
    }
    if (mutant === "snapshot-error") {
      await read("db/0-initial-reference.json");
      assert.ok(!JSON.stringify(result).includes("private worker error"));
    }
  });
}

test("missing scenarios are INCONCLUSIVE and adapters close", async (t) => {
  const root = await temporary(t);
  for (const definitions of [[], [{ id: "empty", requests: [] }]]) {
    let closed = 0;
    const adapter = () => ({
      reset: async () => {
        throw new Error("unexpected");
      },
      request: async () => {
        throw new Error("unexpected");
      },
      snapshot: async () => {
        throw new Error("unexpected");
      },
      close: async () => {
        closed++;
      },
    });
    const result = await verifyPair({
      reference: adapter(),
      candidate: adapter(),
      scenarios: definitions,
      artifactParent: root,
      operationTimeoutMs: 100,
    });
    assert.deepEqual(
      result.gateResults.slice(0, 2).map((gate) => gate.verdict),
      ["INCONCLUSIVE", "INCONCLUSIVE"],
    );
    assert.equal(closed, 2);
  }
});

test("unequal initial state fails G3 and cannot claim executed HTTP coverage", async (t) => {
  let reference;
  let candidate;
  const root = await temporary(t, async () => {
    await reference?.close();
    await candidate?.close();
  });
  reference = await createFixture(root, "reference");
  candidate = await createFixture(root, "candidate");
  const reset = candidate.reset;
  candidate.reset = async (signal) => {
    await reset(signal);
    const db = new DatabaseSync(join(root, "candidate.sqlite"));
    try {
      db.exec("INSERT INTO items(value) VALUES ('unexpected-initial-row')");
    } finally {
      db.close();
    }
  };
  const result = await verifyPair({
    reference,
    candidate,
    scenarios,
    artifactParent: root,
    operationTimeoutMs: 2000,
  });
  assert.equal(result.gateResults[0].verdict, "INCONCLUSIVE");
  assert.deepEqual(result.gateResults[0].executedTestIds, []);
  assert.equal(result.gateResults[1].verdict, "FAIL");
  assert.deepEqual(result.gateResults[1].executedTestIds, [
    "write-then-read:initial",
    "fresh-state:initial",
  ]);
});

test("evidence publication failure rejects even after successful comparisons", async (t) => {
  let reference;
  let candidate;
  const root = await temporary(t, async () => {
    await reference?.close();
    await candidate?.close();
  });
  reference = await createFixture(root, "reference");
  candidate = await createFixture(root, "candidate");
  const close = candidate.close;
  candidate.close = async (signal) => {
    await close(signal);
    const directory = (await readdir(root)).find((name) =>
      name.startsWith("oracle-"),
    );
    await mkdir(join(root, directory, "gate-results.json"));
  };
  await assert.rejects(
    verifyPair({
      reference,
      candidate,
      scenarios,
      artifactParent: root,
      operationTimeoutMs: 2000,
    }),
    /EEXIST|EISDIR|EPERM/,
  );
  // Cleanup hook closes the idempotent fixture directly, not the fault injector.
  candidate.close = close;
});

test("timeout and cleanup failures never become PASS", async (t) => {
  const root = await temporary(t);
  const adapter = () => ({
    reset: () => new Promise(() => {}),
    request: async () => http("{}"),
    snapshot: async () => ({}),
    close: async () => {},
  });
  const result = await verifyPair({
    reference: adapter(),
    candidate: adapter(),
    scenarios,
    artifactParent: root,
    operationTimeoutMs: 20,
  });
  assert.equal(result.gateResults[0].verdict, "ERROR");
  const broken = adapter();
  broken.close = async () => {
    throw new Error("cleanup");
  };
  const cleanupResult = await verifyPair({
    reference: broken,
    candidate: adapter(),
    scenarios: [],
    artifactParent: root,
    operationTimeoutMs: 20,
  });
  assert.equal(cleanupResult.gateResults[0].verdict, "ERROR");
});

test("invalid coverage/aliasing and impossible evidence destination reject", async (t) => {
  const root = await temporary(t);
  const adapter = () => ({
    reset: async () => {},
    request: async () => http("{}"),
    snapshot: async () => ({}),
    close: async () => {},
  });
  const reference = adapter();
  const base = {
    reference,
    candidate: adapter(),
    scenarios,
    artifactParent: root,
    operationTimeoutMs: 100,
  };
  await assert.rejects(
    verifyPair({ ...base, candidate: reference }),
    /Separate/,
  );
  await assert.rejects(
    verifyPair({ ...base, scenarios: [scenarios[0], scenarios[0]] }),
    /Invalid/,
  );
  await assert.rejects(
    verifyPair({ ...base, scenarios: [{ id: "../unsafe", requests: [] }] }),
    /Invalid/,
  );
  await assert.rejects(
    verifyPair({ ...base, artifactParent: join(root, "nonexistent") }),
  );
  assert.deepEqual(await readdir(root), []);
});
