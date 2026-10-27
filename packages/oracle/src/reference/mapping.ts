import type { SqliteSnapshot, SqliteValue } from "../sqlite.js";
import { validateSnapshot } from "../sqlite.js";
import { ensure } from "./manifest.js";

function object(value: unknown, keys: string[]): Record<string, unknown> {
  ensure(
    value && typeof value === "object" && !Array.isArray(value),
    "SNAPSHOT_SHAPE",
  );
  const result = value as Record<string, unknown>;
  ensure(
    Object.keys(result).sort().join(",") === keys.sort().join(","),
    "SNAPSHOT_FIELDS",
  );
  return result;
}
function name(value: unknown): string {
  ensure(
    typeof value === "string" && /^[A-Za-z_][A-Za-z_0-9]*$/.test(value),
    "UNSUPPORTED_IDENTIFIER",
  );
  return value;
}
function metadataInteger(value: unknown): number {
  ensure(
    typeof value === "number" ||
      (typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value)),
    "COLUMN_METADATA",
  );
  const result = Number(value);
  ensure(
    Number.isSafeInteger(result) && result >= 0 && result <= 256,
    "COLUMN_METADATA",
  );
  return result;
}
function cell(value: unknown): SqliteValue {
  const item = object(value, ["type", "value"]);
  switch (item.type) {
    case "null":
      ensure(item.value === null, "NULL_WIRE");
      return { type: "null" };
    case "integer": {
      ensure(
        typeof item.value === "string" &&
          /^-?(0|[1-9][0-9]*)$/.test(item.value),
        "INTEGER_WIRE",
      );
      const n = BigInt(item.value);
      ensure(n >= -(1n << 63n) && n < 1n << 63n, "INTEGER_RANGE");
      return { type: "integer", value: item.value };
    }
    case "real":
      ensure(
        typeof item.value === "number" && Number.isFinite(item.value),
        "REAL_WIRE",
      );
      return { type: "real", value: item.value };
    case "text":
      ensure(typeof item.value === "string", "TEXT_WIRE");
      return { type: "text", value: item.value };
    case "blob":
      ensure(
        typeof item.value === "string" &&
          /^(?:[0-9A-Fa-f]{2})*$/.test(item.value),
        "BLOB_WIRE",
      );
      return { type: "blob", value: item.value.toLowerCase() };
    default:
      throw new Error("UNSUPPORTED_SQLITE_TYPE");
  }
}
const lexical = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
function order(a: SqliteValue[], b: SqliteValue[], keys: number[]): number {
  for (const k of keys) {
    const x = a[k];
    const y = b[k];
    ensure(x && y);
    const n =
      x.type === "integer" && y.type === "integer"
        ? BigInt(x.value) < BigInt(y.value)
          ? -1
          : BigInt(x.value) > BigInt(y.value)
            ? 1
            : 0
        : x.type === "real" && y.type === "real"
          ? x.value - y.value
          : lexical(JSON.stringify(x), JSON.stringify(y));
    if (n) return n;
  }
  return lexical(JSON.stringify(a), JSON.stringify(b));
}
/** Strict legacy wire admission. DDL (including defaults/indexes) is preserved verbatim. */
export function mapPhpSnapshot(raw: unknown): SqliteSnapshot {
  ensure(JSON.stringify(raw)?.length <= 8 * 1024 * 1024, "SNAPSHOT_LIMIT");
  const root = object(raw, ["format", "schema", "tables"]);
  ensure(
    root.format === "php74-logical-v1" &&
      Array.isArray(root.schema) &&
      Array.isArray(root.tables),
  );
  const schema = root.schema
    .map((entry) => {
      const s = object(entry, ["type", "name", "tbl_name", "sql"]);
      ensure(
        typeof s.type === "string" &&
          ["table", "index", "view", "trigger"].includes(s.type),
      );
      ensure(s.sql === null || typeof s.sql === "string");
      ensure(
        !/^CREATE\s+VIRTUAL\s+TABLE/i.test(s.sql ?? ""),
        "UNSUPPORTED_VIRTUAL_TABLE",
      );
      return {
        type: s.type,
        name: name(s.name),
        table: name(s.tbl_name),
        sql: s.sql,
      };
    })
    .sort((a, b) => lexical(a.type, b.type) || lexical(a.name, b.name));
  const tables = root.tables
    .map((entry) => {
      const t = object(entry, ["name", "columns", "rows"]);
      ensure(
        Array.isArray(t.columns) &&
          t.columns.length > 0 &&
          t.columns.length <= 256,
      );
      const keys: { index: number; rank: number }[] = [];
      const columns = t.columns.map((entry, index) => {
        const c = object(entry, [
          "cid",
          "name",
          "type",
          "notnull",
          "dflt_value",
          "pk",
          "hidden",
        ]);
        ensure(
          metadataInteger(c.cid) === index &&
            typeof c.type === "string" &&
            [0, 1].includes(metadataInteger(c.notnull)),
          "COLUMN_METADATA",
        );
        ensure(
          c.dflt_value === null || typeof c.dflt_value === "string",
          "DEFAULT_METADATA",
        );
        ensure(
          metadataInteger(c.pk) >= 0 && metadataInteger(c.hidden) === 0,
          "UNSUPPORTED_COLUMN",
        );
        if (Number(c.pk) > 0) keys.push({ index, rank: Number(c.pk) });
        return name(c.name);
      });
      keys.sort((a, b) => a.rank - b.rank);
      ensure(
        keys.every((k, i) => k.rank === i + 1),
        "INVALID_PRIMARY_KEY",
      );
      const primaryKey = keys.map((k) => k.index);
      ensure(Array.isArray(t.rows) && t.rows.length <= 10000);
      const rows = t.rows.map((row) => {
        ensure(
          Array.isArray(row) && row.length === columns.length,
          "ROW_WIDTH",
        );
        return row.map(cell);
      });
      rows.sort((a, b) => order(a, b, primaryKey));
      return { name: name(t.name), columns, primaryKey, rows };
    })
    .sort((a, b) => lexical(a.name, b.name));
  const result: SqliteSnapshot = {
    format: "sqlite-logical-v1",
    schema,
    tables,
  };
  validateSnapshot(result);
  ensure(
    schema.every((s) => s.type !== "table" || s.sql !== null),
    "MISSING_DDL",
  );
  // An AUTOINCREMENT database must retain sequence, even when its rows are empty.
  ensure(
    !schema.some((s) => /\bAUTOINCREMENT\b/i.test(s.sql ?? "")) ||
      tables.some((t) => t.name === "sqlite_sequence"),
    "MISSING_SEQUENCE",
  );
  return result;
}
