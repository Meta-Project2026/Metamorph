// Runs in a DIFFERENT container/PID namespace, never loads candidate JS.
import { lstatSync, realpathSync } from "node:fs";
import { request } from "node:http";
import { createConnection } from "node:net";
import { DatabaseSync } from "node:sqlite";
import { profileById, requestPolicy, WORKSHOP_PROFILE } from "./profile.mjs";
import { encode } from "./sqlite-value.mjs";

const action = JSON.parse(process.argv[2]);
const profile = profileById(action.profileId);
const quote = (s) => `"${s.replaceAll('"', '""')}"`;
if (action.kind === "readiness") {
  if (
    !/^[a-f0-9]{64}$/.test(action.runtimeId) ||
    !/^[A-Za-z0-9:_-]{1,100}$/.test(action.scenarioId) ||
    !/^[a-f0-9-]{36}$/.test(action.requestId)
  )
    throw new Error("READINESS_IDENTITY");
  // Fixed read-only public route. Identity is supplied by the trusted controller,
  // echoed by the independent inspector, never accepted from candidate JSON.
  const result =
    profile === WORKSHOP_PROFILE
      ? await new Promise((resolve) => {
          let settled = false;
          const socket = createConnection({ host: "127.0.0.1", port: 3000 });
          const finish = (value) => {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              socket.destroy();
              resolve(value);
            }
          };
          const timer = setTimeout(
            () => finish({ ready: false, reason: "HTTP_TIMEOUT" }),
            1500,
          );
          socket.once("connect", () =>
            finish({ ready: true, reason: "SOCKET_READY" }),
          );
          socket.once("error", (e) =>
            finish({
              ready: false,
              reason:
                e.code === "ECONNREFUSED"
                  ? "CONNECTION_REFUSED"
                  : "MALFORMED_HTTP",
            }),
          );
        })
      : await new Promise((resolve) => {
          let settled = false;
          const finish = (value) => {
            if (!settled) {
              settled = true;
              clearTimeout(deadline);
              resolve(value);
            }
          };
          const req = request(
            {
              host: "127.0.0.1",
              port: 3000,
              method: "GET",
              path: "/items",
              headers: { "x-request-id": action.requestId },
            },
            (res) => {
              const chunks = [];
              let size = 0;
              res.on("data", (chunk) => {
                size += chunk.length;
                if (size > 256 * 1024) {
                  finish({ ready: false, reason: "WRONG_RESPONSE" });
                  res.destroy();
                } else chunks.push(chunk);
              });
              res.on("error", () =>
                finish({ ready: false, reason: "MALFORMED_HTTP" }),
              );
              res.on("end", () => {
                let payload;
                try {
                  payload = JSON.parse(Buffer.concat(chunks).toString());
                } catch {}
                const ready =
                  res.statusCode === 200 &&
                  res.headers["x-request-id"] === action.requestId &&
                  payload !== null &&
                  typeof payload === "object" &&
                  Array.isArray(payload.items);
                finish({
                  ready,
                  reason: ready ? "HTTP_READY" : "WRONG_RESPONSE",
                  status: res.statusCode,
                });
              });
            },
          );
          // Absolute monotonic real timer also bounds a peer that trickles bytes forever.
          const deadline = setTimeout(() => {
            finish({ ready: false, reason: "HTTP_TIMEOUT" });
            req.destroy();
          }, 1500);
          req.on("error", (error) =>
            finish({
              ready: false,
              reason:
                error.code === "ECONNREFUSED"
                  ? "CONNECTION_REFUSED"
                  : "MALFORMED_HTTP",
            }),
          );
          req.end();
        });
  console.log(
    JSON.stringify({
      ...result,
      kind: "readiness",
      runtimeId: action.runtimeId,
      scenarioId: action.scenarioId,
      requestId: action.requestId,
    }),
  );
} else if (action.kind === "http") {
  const policy = requestPolicy(
    profile,
    action.method,
    action.path,
    action.body,
  );
  const result = await new Promise((resolve, reject) => {
    const req = request(
      {
        host: "127.0.0.1",
        port: 3000,
        method: action.method,
        path: action.path,
        headers: {
          "x-request-id": action.requestId,
          ...(policy.contentType ? { "content-type": policy.contentType } : {}),
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
