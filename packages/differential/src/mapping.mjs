import { compareHttp, mapPhpSnapshot } from "@metamorph/oracle";
import { validateHttp } from "../../oracle/dist/http.js";
import { validateSnapshot } from "../../oracle/dist/sqlite.js";
import { base64, fields, lexical, requireCheck, utf8 } from "./strict.mjs";

export function mapTargetHttp(raw, stepId, requestId) {
  fields(
    raw,
    ["stepId", "requestId", "status", "headers", "bodyBase64"],
    "HTTP_WIRE",
  );
  requireCheck(
    raw.stepId === stepId &&
      raw.requestId === requestId &&
      /^[a-f0-9-]{36}$/.test(requestId),
    "HTTP_IDENTITY",
  );
  requireCheck(
    raw.headers &&
      typeof raw.headers === "object" &&
      !Array.isArray(raw.headers) &&
      raw.headers["x-request-id"] === requestId,
    "HTTP_IDENTITY",
  );
  const seen = new Set();
  for (const [key, value] of Object.entries(raw.headers)) {
    requireCheck(
      typeof value === "string" &&
        !/[\r\n\0]/.test(value) &&
        !seen.has(key.toLowerCase()),
      "HTTP_HEADERS",
    );
    seen.add(key.toLowerCase());
    utf8(value);
  }
  const body = base64(raw.bodyBase64, 256 * 1024);
  // This bounded public API profile supports UTF-8 responses, never replacement decoding.
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    requireCheck(false, "HTTP_UTF8");
  }
  const observation = { status: raw.status, headers: { ...raw.headers }, body };
  validateHttp(observation);
  // Existing exact comparator also rejects duplicate JSON keys / precision loss.
  compareHttp(observation, observation);
  return observation;
}

/** Independently validate the target wire before the proven legacy-to-core mapping. */
export function mapTargetSnapshot(raw, identity, stepId) {
  fields(
    raw,
    [
      "format",
      "source",
      "schema",
      "tables",
      "sqlite",
      "stepId",
      "runtimeId",
      "volume",
    ],
    "DB_WIRE",
  );
  requireCheck(
    raw.format === "target-worker-sqlite-v1-proposed" &&
      raw.source === "/state/target.sqlite" &&
      raw.sqlite === "3.50.4",
    "DB_FORMAT",
  );
  requireCheck(
    raw.stepId === stepId &&
      raw.runtimeId === identity.runtimeId &&
      raw.volume === identity.volume,
    "DB_IDENTITY",
  );
  requireCheck(
    JSON.stringify(raw).length <= 4 * 1024 * 1024 &&
      Array.isArray(raw.schema) &&
      raw.schema.length > 0 &&
      raw.schema.length <= 128 &&
      Array.isArray(raw.tables),
    "DB_LIMIT",
  );
  let previous = "";
  const schema = raw.schema.map((entry) => {
    fields(entry, ["type", "name", "tbl", "sql"], "DB_SCHEMA_FIELDS");
    requireCheck(
      ["table", "view", "index", "trigger"].includes(entry.type) &&
        typeof entry.name === "string" &&
        typeof entry.tbl === "string" &&
        (entry.sql === null || typeof entry.sql === "string"),
      "DB_SCHEMA",
    );
    const key = `${entry.type}:${entry.name}`;
    requireCheck(
      previous === "" || lexical(previous, key) < 0,
      "DB_SCHEMA_ORDER",
    );
    previous = key;
    return {
      type: entry.type,
      name: utf8(entry.name),
      tbl_name: utf8(entry.tbl),
      sql: entry.sql === null ? null : utf8(entry.sql),
    };
  });
  const names = schema.filter((s) => s.type === "table").map((s) => s.name);
  requireCheck(
    names.length > 0 && names.length === raw.tables.length,
    "DB_MISSING_TABLE",
  );
  const tables = raw.tables.map((table, index) => {
    fields(table, ["name", "columns", "rows"], "DB_TABLE_FIELDS");
    requireCheck(
      table.name === names[index] &&
        Array.isArray(table.columns) &&
        table.columns.length > 0 &&
        table.columns.length <= 128 &&
        Array.isArray(table.rows) &&
        table.rows.length <= 10000,
      "DB_TABLE",
    );
    for (const [i, column] of table.columns.entries()) {
      fields(
        column,
        ["cid", "name", "type", "notnull", "dflt_value", "pk", "hidden"],
        "DB_COLUMN_FIELDS",
      );
      requireCheck(
        column.cid === i &&
          [0, 1].includes(column.notnull) &&
          Number.isSafeInteger(column.pk) &&
          column.pk >= 0 &&
          column.pk <= table.columns.length &&
          column.hidden === 0 &&
          typeof column.type === "string" &&
          (column.dflt_value === null || typeof column.dflt_value === "string"),
        "DB_COLUMN",
      );
      utf8(column.name);
      utf8(column.type);
      if (column.dflt_value !== null) utf8(column.dflt_value);
    }
    const rows = table.rows.map((row) => {
      requireCheck(
        Array.isArray(row) && row.length === table.columns.length,
        "DB_ROW_WIDTH",
      );
      return row.map((cell) => {
        requireCheck(cell && typeof cell === "object", "DB_CELL");
        fields(
          cell,
          cell.type === "null" ? ["type"] : ["type", "value"],
          "DB_CELL_FIELDS",
        );
        if (cell.type === "text") utf8(cell.value);
        if (cell.type === "blob")
          requireCheck(
            typeof cell.value === "string" &&
              /^(?:[a-f0-9]{2})*$/.test(cell.value),
            "DB_BLOB",
          );
        return cell.type === "null"
          ? { type: "null", value: null }
          : { ...cell };
      });
    });
    return { name: table.name, columns: structuredClone(table.columns), rows };
  });
  const result = mapPhpSnapshot({ format: "php74-logical-v1", schema, tables });
  validateSnapshot(result);
  return result;
}
