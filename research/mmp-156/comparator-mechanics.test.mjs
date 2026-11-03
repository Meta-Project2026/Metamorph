// Offline MMP-156 initial-DB_SCHEMA mechanics for paid run 41696312924
// (G3 FAIL at the initial snapshot with DB_SCHEMA and no DB_STATE on all
// three public scenarios). Exercises ONLY the trusted built comparator
// (packages/oracle/dist) and the real node:sqlite snapshot path with
// 1. the pinned public PHP source DDL from research/mmp-061/public-source.json,
// 2. the trusted known-good fixture from
//    packages/target-worker/fixtures/workshop/src/schema.ts, and
// 3. synthetic reformatting variants derived from that public source.
// No candidate plaintext is imported or executed; no private evidence,
// network, Docker, Meta/model call or paid action. The exact paid-candidate
// DDL delta stays UNKNOWN (custody is ciphertext-only without the owner key);
// these tests pin which mismatch classes the public receipt proves or
// refutes, not the candidate's private text. Skips honestly when no local
// oracle build exists (run `pnpm --filter @metamorph/oracle build` first);
// this file is NOT wired into hosted CI (coverage-matrix records
// tests: NOT_VERIFIED).
import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

const dist = new URL("../../packages/oracle/dist/sqlite.js", import.meta.url);
const publicSource = JSON.parse(
  readFileSync(
    new URL("../mmp-061/public-source.json", import.meta.url),
    "utf8",
  ),
);

/** The exact multi-statement string the pinned PHP source passes to exec()
 * inside initSQLiteTables(config.php), including its leading newline,
 * 8-space statement indentation, 12-space column indentation and the
 * trailing ";\n    ". */
function sourceExecString() {
  const config = publicSource.files.find(
    (file) => file.path === "config.php",
  ).content;
  const match = /exec\("([\s\S]*?)"\);/.exec(config);
  assert.ok(match, "initSQLiteTables exec string missing from pinned source");
  assert.ok(
    match[1].includes("CREATE TABLE IF NOT EXISTS mechanics") &&
      match[1].includes("CREATE TABLE IF NOT EXISTS appointments"),
  );
  return match[1];
}

/** The trusted known-good fixture SCHEMA string, parsed from its TS literal. */
function fixtureSchemaString() {
  const text = readFileSync(
    new URL(
      "../../packages/target-worker/fixtures/workshop/src/schema.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const match = /export const SCHEMA =\s*("(?:[^"\\]|\\.)*");/.exec(text);
  assert.ok(match, "SCHEMA literal missing from trusted workshop fixture");
  return JSON.parse(match[1]);
}

const statements = (sql) => [
  ...sql.matchAll(/CREATE TABLE IF NOT EXISTS[\s\S]*?;/g),
].map((match) => match[0]);

function buildDatabase(directory, name, sql) {
  const path = join(directory, `${name}.sqlite`);
  const db = new DatabaseSync(path);
  try {
    db.exec(sql);
  } finally {
    db.close();
  }
  return path;
}

async function withDist(run) {
  if (!existsSync(dist)) return "BUILD_DIST_MISSING";
  const directory = mkdtempSync(join(tmpdir(), "mmp156-mechanics-"));
  try {
    const oracle = await import(dist.href);
    return (await run(oracle, directory)) ?? null;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const snapshotPair = async (oracle, directory, referenceSql, candidateSql) => {
  const reference = await oracle.snapshotSqlite(
    buildDatabase(directory, "reference", referenceSql),
  );
  const candidate = await oracle.snapshotSqlite(
    buildDatabase(directory, "candidate", candidateSql),
  );
  return { reference, candidate, diffs: oracle.compareSqlite(reference, candidate) };
};

test("oracle build is available or the suite is skipped honestly", async (t) => {
  if (!existsSync(dist)) {
    t.skip("BUILD_DIST_MISSING — run `pnpm --filter @metamorph/oracle build`");
    return;
  }
  const { compareSqlite } = await import(dist.href);
  assert.equal(typeof compareSqlite, "function");
});

test("trusted known-good fixture embeds the exact pinned source exec string", () => {
  assert.equal(fixtureSchemaString(), sourceExecString());
});

test("byte-verbatim source DDL reaches initial snapshot parity on node:sqlite", async () => {
  const result = await withDist(async (oracle, directory) => {
    const sql = sourceExecString();
    const { diffs } = await snapshotPair(oracle, directory, sql, sql);
    assert.deepEqual(diffs, []);
  });
  assert.notEqual(result, "BUILD_DIST_MISSING");
});

test("splitting the verbatim statements across exec calls still compares equal", async () => {
  const result = await withDist(async (oracle, directory) => {
    const parts = statements(sourceExecString());
    assert.equal(parts.length, 2);
    const { diffs } = await snapshotPair(
      oracle,
      directory,
      parts.join(""),
      parts.join("\n"),
    );
    assert.deepEqual(diffs, []);
  });
  assert.notEqual(result, "BUILD_DIST_MISSING");
});

test("statement reordering cannot cause DB_SCHEMA (snapshot sorts by type,name)", async () => {
  const result = await withDist(async (oracle, directory) => {
    const parts = statements(sourceExecString());
    const { diffs } = await snapshotPair(
      oracle,
      directory,
      parts.join(""),
      [...parts].reverse().join(""),
    );
    assert.deepEqual(diffs, []);
  });
  assert.notEqual(result, "BUILD_DIST_MISSING");
});

test("omitting IF NOT EXISTS stores identical DDL text and cannot cause DB_SCHEMA", async () => {
  const result = await withDist(async (oracle, directory) => {
    const { diffs } = await snapshotPair(
      oracle,
      directory,
      sourceExecString(),
      sourceExecString().replaceAll("CREATE TABLE IF NOT EXISTS", "CREATE TABLE"),
    );
    assert.deepEqual(diffs, []);
  });
  assert.notEqual(result, "BUILD_DIST_MISSING");
});

test("single-line reformatted DDL: byte-equal initial tables, DB_SCHEMA only", async () => {
  // This is the deduction class proven by the public receipt: the run
  // reported DB_SCHEMA with no DB_STATE, and compareSqlite compares tables
  // independently of schema text, so the candidate's initial tables JSON
  // (tables, columns, primary keys, sqlite_sequence row) matched the
  // reference exactly while at least one stored sql text differed.
  const result = await withDist(async (oracle, directory) => {
    const flat = statements(sourceExecString())
      .map((statement) => statement.replace(/\s+/g, " "))
      .join("\n");
    const { reference, candidate, diffs } = await snapshotPair(
      oracle,
      directory,
      sourceExecString(),
      flat,
    );
    assert.deepEqual(diffs, [{ code: "DB_SCHEMA", path: "/schema" }]);
    assert.equal(
      JSON.stringify(reference.tables),
      JSON.stringify(candidate.tables),
    );
    assert.notEqual(
      JSON.stringify(reference.schema),
      JSON.stringify(candidate.schema),
    );
  });
  assert.notEqual(result, "BUILD_DIST_MISSING");
});

test("non-PK column type spelling INT instead of INTEGER: DB_SCHEMA only", async () => {
  const result = await withDist(async (oracle, directory) => {
    const { diffs } = await snapshotPair(
      oracle,
      directory,
      sourceExecString(),
      sourceExecString().replace(
        "max_daily_slots INTEGER NOT NULL DEFAULT 4",
        "max_daily_slots INT NOT NULL DEFAULT 4",
      ),
    );
    assert.deepEqual(diffs, [{ code: "DB_SCHEMA", path: "/schema" }]);
  });
  assert.notEqual(result, "BUILD_DIST_MISSING");
});

test("INT spelling on an AUTOINCREMENT primary key cannot even initialize", async () => {
  // AUTOINCREMENT is accepted only on exactly INTEGER PRIMARY KEY, so this
  // variant is a candidate startup failure class, not a DB_SCHEMA class.
  const result = await withDist(async (oracle, directory) => {
    const db = new DatabaseSync(join(directory, "int-pk.sqlite"));
    try {
      assert.throws(
        () =>
          db.exec(
            sourceExecString().replaceAll(
              "INTEGER PRIMARY KEY AUTOINCREMENT",
              "INT PRIMARY KEY AUTOINCREMENT",
            ),
          ),
        /AUTOINCREMENT/,
      );
    } finally {
      db.close();
    }
  });
  assert.notEqual(result, "BUILD_DIST_MISSING");
});

test("extra index on the candidate side: DB_SCHEMA only", async () => {
  const result = await withDist(async (oracle, directory) => {
    const { diffs } = await snapshotPair(
      oracle,
      directory,
      sourceExecString(),
      `${sourceExecString()} CREATE INDEX IF NOT EXISTS appointments_mechanic_idx ON appointments (mechanic_id);`,
    );
    assert.deepEqual(diffs, [{ code: "DB_SCHEMA", path: "/schema" }]);
  });
  assert.notEqual(result, "BUILD_DIST_MISSING");
});

test("dropping AUTOINCREMENT also removes sqlite_sequence from tables: DB_SCHEMA and DB_STATE", async () => {
  // Refuted driver for run 41696312924: the receipt's findingCodes contain
  // no DB_STATE, so the candidate kept AUTOINCREMENT (or an equivalent that
  // still materializes sqlite_sequence with the same row).
  const result = await withDist(async (oracle, directory) => {
    const { diffs } = await snapshotPair(
      oracle,
      directory,
      sourceExecString(),
      sourceExecString().replaceAll(
        " INTEGER PRIMARY KEY AUTOINCREMENT",
        " INTEGER PRIMARY KEY",
      ),
    );
    assert.deepEqual(diffs, [
      { code: "DB_SCHEMA", path: "/schema" },
      { code: "DB_STATE", path: "/tables" },
    ]);
  });
  assert.notEqual(result, "BUILD_DIST_MISSING");
});

test("deduction control on raw snapshots: equal tables with one altered row would surface DB_STATE", async () => {
  const result = await withDist(async (oracle) => {
    const base = {
      format: "sqlite-logical-v1",
      schema: [
        { type: "table", name: "t", table: "t", sql: "CREATE TABLE t (id INTEGER PRIMARY KEY)" },
      ],
      tables: [
        {
          name: "t",
          columns: ["id"],
          primaryKey: [0],
          rows: [[{ type: "integer", value: "1" }]],
        },
      ],
    };
    const mutated = structuredClone(base);
    mutated.tables[0].rows = [[{ type: "integer", value: "2" }]];
    assert.deepEqual(oracle.compareSqlite(base, structuredClone(base)), []);
    assert.deepEqual(oracle.compareSqlite(base, mutated), [
      { code: "DB_STATE", path: "/tables" },
    ]);
  });
  assert.notEqual(result, "BUILD_DIST_MISSING");
});
