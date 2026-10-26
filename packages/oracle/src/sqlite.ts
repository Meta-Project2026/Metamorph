import { DatabaseSync, type SQLOutputValue } from "node:sqlite";
import type { Difference } from "./http.js";

export type SqliteValue =
  | { type: "null" }
  | { type: "integer"; value: string }
  | { type: "real"; value: number }
  | { type: "text"; value: string }
  | { type: "blob"; value: string };

export interface SqliteTable {
  name: string;
  columns: string[];
  primaryKey: number[];
  rows: SqliteValue[][];
}

export interface SqliteSnapshot {
  format: "sqlite-logical-v1";
  schema: { type: string; name: string; table: string; sql: string | null }[];
  tables: SqliteTable[];
}

function quote(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

function encode(value: SQLOutputValue): SqliteValue {
  if (value === null) return { type: "null" };
  if (typeof value === "bigint")
    return { type: "integer", value: value.toString() };
  if (typeof value === "number" && Number.isFinite(value))
    return { type: "real", value };
  if (typeof value === "string") return { type: "text", value };
  if (value instanceof Uint8Array)
    return { type: "blob", value: Buffer.from(value).toString("hex") };
  throw new Error("Unsupported SQLite value");
}

function scalarOrder(a: SqliteValue, b: SqliteValue): number {
  if (a.type === "integer" && b.type === "integer") {
    return BigInt(a.value) < BigInt(b.value)
      ? -1
      : BigInt(a.value) > BigInt(b.value)
        ? 1
        : 0;
  }
  if (a.type === "real" && b.type === "real") return a.value - b.value;
  const left = JSON.stringify(a);
  const right = JSON.stringify(b);
  return left < right ? -1 : left > right ? 1 : 0;
}

function rowOrder(a: SqliteValue[], b: SqliteValue[], keys: number[]): number {
  for (const index of keys) {
    const left = a[index];
    const right = b[index];
    if (!left || !right) throw new Error("Invalid SQLite row width");
    const order = scalarOrder(left, right);
    if (order !== 0) return order;
  }
  // Tiebreak nullable/composite keys and no-PK tables as a full row multiset.
  const left = JSON.stringify(a);
  const right = JSON.stringify(b);
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Trusted SQLite files only; future candidate DB inspection belongs in isolation. */
export function snapshotSqlite(path: string): SqliteSnapshot {
  const db = new DatabaseSync(path, { readOnly: true, allowExtension: false });
  try {
    db.exec(
      "PRAGMA trusted_schema = OFF; PRAGMA query_only = ON; PRAGMA busy_timeout = 250; BEGIN;",
    );
    const schema = db
      .prepare(
        "SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' OR name = 'sqlite_sequence' ORDER BY type, name",
      )
      .all()
      .map((row) => ({
        type: String(row.type),
        name: String(row.name),
        table: String(row.tbl_name),
        sql: row.sql === null ? null : String(row.sql),
      }));
    const tables = schema
      .filter((entry) => entry.type === "table")
      .map((entry) => {
        if (/^CREATE VIRTUAL TABLE/i.test(entry.sql ?? ""))
          throw new Error("Virtual tables unsupported");
        const columnsInfo = db
          .prepare(`PRAGMA table_xinfo(${quote(entry.name)})`)
          .all();
        const columns = columnsInfo.map((column) => String(column.name));
        const primaryKey = columnsInfo
          .map((column, index) => ({ index, pk: Number(column.pk) }))
          .filter((column) => column.pk > 0)
          .sort((a, b) => a.pk - b.pk)
          .map((column) => column.index);
        const statement = db.prepare(
          `SELECT ${columns.map(quote).join(", ")} FROM ${quote(entry.name)} LIMIT 10001`,
        );
        statement.setReadBigInts(true);
        const raw = statement.all();
        if (raw.length > 10000) throw new Error("SQLite row limit exceeded");
        const rows = raw.map((row) =>
          columns.map((column) => {
            const value = row[column];
            if (value === undefined) throw new Error("Missing SQLite column");
            return encode(value);
          }),
        );
        rows.sort((a, b) => rowOrder(a, b, primaryKey));
        return { name: entry.name, columns, primaryKey, rows };
      });
    db.exec("COMMIT;");
    return { format: "sqlite-logical-v1", schema, tables };
  } finally {
    db.close();
  }
}

// Reject malformed or truncated adapter snapshots instead of equating two errors.
export function validateSnapshot(value: SqliteSnapshot): void {
  if (
    value?.format !== "sqlite-logical-v1" ||
    !Array.isArray(value.schema) ||
    !Array.isArray(value.tables)
  ) {
    throw new Error("Invalid SQLite snapshot");
  }
  if (JSON.stringify(value).length > 8 * 1024 * 1024)
    throw new Error("SQLite snapshot too large");
  const names = new Set<string>();
  for (const table of value.tables) {
    if (
      typeof table.name !== "string" ||
      names.has(table.name) ||
      !Array.isArray(table.columns) ||
      table.columns.length === 0 ||
      new Set(table.columns).size !== table.columns.length ||
      table.columns.some((column) => typeof column !== "string") ||
      !Array.isArray(table.primaryKey) ||
      new Set(table.primaryKey).size !== table.primaryKey.length ||
      table.primaryKey.some(
        (key) =>
          !Number.isInteger(key) || key < 0 || key >= table.columns.length,
      ) ||
      !Array.isArray(table.rows) ||
      table.rows.length > 10000
    ) {
      throw new Error("Invalid SQLite table");
    }
    names.add(table.name);
    for (const row of table.rows) {
      if (!Array.isArray(row) || row.length !== table.columns.length)
        throw new Error("Invalid SQLite row");
      for (const cell of row) {
        if (!cell || typeof cell !== "object")
          throw new Error("Invalid SQLite cell");
        switch (cell.type) {
          case "null":
            break;
          case "integer":
            if (
              typeof cell.value !== "string" ||
              !/^-?(0|[1-9][0-9]*)$/.test(cell.value)
            )
              throw new Error("Invalid SQLite integer");
            break;
          case "real":
            if (typeof cell.value !== "number" || !Number.isFinite(cell.value))
              throw new Error("Invalid SQLite real");
            break;
          case "text":
            if (typeof cell.value !== "string")
              throw new Error("Invalid SQLite text");
            break;
          case "blob":
            if (
              typeof cell.value !== "string" ||
              !/^(?:[0-9a-f]{2})*$/.test(cell.value)
            )
              throw new Error("Invalid SQLite blob");
            break;
          default:
            throw new Error("Unknown SQLite cell type");
        }
      }
    }
  }
  const schemaNames = new Set<string>();
  for (const entry of value.schema) {
    if (
      !entry ||
      !["table", "view", "index", "trigger"].includes(entry.type) ||
      typeof entry.name !== "string" ||
      typeof entry.table !== "string" ||
      !(entry.sql === null || typeof entry.sql === "string") ||
      schemaNames.has(`${entry.type}:${entry.name}`)
    )
      throw new Error("Invalid SQLite schema");
    schemaNames.add(`${entry.type}:${entry.name}`);
  }
  const schemaTables = value.schema.filter((entry) => entry.type === "table");
  if (
    schemaTables.length !== names.size ||
    schemaTables.some((entry) => !names.has(entry.name))
  )
    throw new Error("SQLite tables missing from snapshot");
}

export function compareSqlite(
  left: SqliteSnapshot,
  right: SqliteSnapshot,
): Difference[] {
  validateSnapshot(left);
  validateSnapshot(right);
  const diffs: Difference[] = [];
  if (JSON.stringify(left.schema) !== JSON.stringify(right.schema))
    diffs.push({ code: "DB_SCHEMA", path: "/schema" });
  if (JSON.stringify(left.tables) !== JSON.stringify(right.tables))
    diffs.push({ code: "DB_STATE", path: "/tables" });
  return diffs;
}
