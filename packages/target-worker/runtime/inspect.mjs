// Runs in a DIFFERENT container/PID namespace, never loads candidate JS.
import { lstatSync, realpathSync } from "node:fs";
import { request } from "node:http";
import { DatabaseSync } from "node:sqlite";

const action = JSON.parse(process.argv[2]);
const quote = (s) => `"${s.replaceAll('"', '""')}"`;
const encode = (v) =>
  v === null
    ? { type: "null" }
    : typeof v === "bigint"
      ? { type: "integer", value: String(v) }
      : typeof v === "number"
        ? { type: "real", value: v }
        : typeof v === "string"
          ? { type: "text", value: v }
          : { type: "blob", value: Buffer.from(v).toString("hex") };
if (action.kind === "http") {
  if (
    !/^(GET|POST)$/.test(action.method) ||
    !/^\/[a-zA-Z0-9/?=&_-]*$/.test(action.path)
  )
    throw new Error("REQUEST");
  const result = await new Promise((resolve, reject) => {
    const req = request(
      {
        host: "127.0.0.1",
        port: 3000,
        method: action.method,
        path: action.path,
        headers: {
          "x-request-id": action.requestId,
          "content-type": "application/json",
        },
        timeout: 1500,
      },
      (res) => {
        const chunks = [];
        let size = 0;
        res.on("data", (chunk) => {
          size += chunk.length;
          if (size > 256 * 1024) res.destroy(new Error("HTTP_SIZE"));
          else chunks.push(chunk);
        });
        res.on("error", reject);
        res.on("end", () =>
          resolve({
            requestId: action.requestId,
            status: res.statusCode,
            headers: res.headers,
            bodyBase64: Buffer.concat(chunks).toString("base64"),
          }),
        );
      },
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("HTTP_TIMEOUT")));
    req.end(action.body ?? "");
  });
  console.log(JSON.stringify(result));
} else if (action.kind === "snapshot") {
  // The candidate never chooses this path or observation format.
  const path = "/state/target.sqlite";
  const stat = lstatSync(path);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.nlink !== 1 ||
    stat.size > 16 * 1024 * 1024 ||
    realpathSync(path) !== path
  )
    throw new Error("DB_SOURCE");
  const db = new DatabaseSync(path, { readOnly: true, allowExtension: false });
  try {
    db.exec(
      "PRAGMA trusted_schema=OFF; PRAGMA query_only=ON; PRAGMA busy_timeout=250; BEGIN",
    );
    const schema = db
      .prepare(
        "SELECT type,name,tbl_name AS tbl,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' OR name='sqlite_sequence' ORDER BY type,name",
      )
      .all();
    if (schema.length > 128) throw new Error("SCHEMA_LIMIT");
    const tables = schema
      .filter((s) => s.type === "table")
      .map((s) => {
        if (/^CREATE VIRTUAL TABLE/i.test(s.sql))
          throw new Error("VIRTUAL_TABLE");
        const columns = db
          .prepare(`PRAGMA table_xinfo(${quote(s.name)})`)
          .all();
        if (columns.length > 128) throw new Error("COLUMN_LIMIT");
        const stmt = db.prepare(
          `SELECT ${columns.map((c) => quote(c.name)).join(",")} FROM ${quote(s.name)} LIMIT 10001`,
        );
        stmt.setReadBigInts(true);
        const values = stmt.all();
        if (values.length > 10000) throw new Error("ROW_LIMIT");
        return {
          name: s.name,
          columns,
          rows: values.map((row) => columns.map((c) => encode(row[c.name]))),
        };
      });
    db.exec("COMMIT");
    console.log(
      JSON.stringify({
        format: "target-worker-sqlite-v1-proposed",
        source: path,
        schema,
        tables,
        sqlite: process.versions.sqlite,
      }),
    );
  } finally {
    db.close();
  }
} else throw new Error("ACTION");
