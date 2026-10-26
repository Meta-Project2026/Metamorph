// Original public controls. These are trusted fixtures, never real candidate code.
import { once } from "node:events";
import { createServer } from "node:http";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { snapshotSqlite } from "../dist/index.js";

export const scenarios = [
  {
    id: "write-then-read",
    requests: [
      { method: "POST", path: "/items", body: '{"value":"saved"}' },
      { method: "GET", path: "/items" },
    ],
  },
  { id: "fresh-state", requests: [{ method: "GET", path: "/items" }] },
];

export async function createFixture(root, name, mutant = "none") {
  const path = join(root, `${name}.sqlite`);
  const db = new DatabaseSync(path);
  let closed = false;
  const server = createServer(async (request, response) => {
    try {
      if (request.url !== "/items") {
        response.writeHead(404, { "content-type": "application/json" });
        response.end('{"error":"missing"}');
        return;
      }
      if (request.method === "POST") {
        let body = "";
        for await (const chunk of request) body += chunk;
        const value = JSON.parse(body).value;
        db.prepare("INSERT INTO items(value) VALUES (?)").run(value);
        if (mutant === "db-row")
          db.exec("UPDATE items SET marker = 'wrong' WHERE id = 1");
        if (mutant === "db-sequence")
          db.exec("UPDATE sqlite_sequence SET seq = 99 WHERE name = 'items'");
      }
      const rows = db.prepare("SELECT id, value FROM items ORDER BY id").all();
      if (mutant === "http-type" && rows.length > 0)
        rows[0].id = String(rows[0].id);
      response.writeHead(mutant === "http-status" ? 409 : 200, {
        "content-type": "application/json",
      });
      response.end(JSON.stringify({ items: rows, optional: null }));
    } catch {
      response.writeHead(500, { "content-type": "application/json" });
      response.end('{"error":"fixture-failure"}');
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  return {
    async reset() {
      db.exec(
        "DROP TABLE IF EXISTS items; CREATE TABLE items (id INTEGER PRIMARY KEY AUTOINCREMENT, value TEXT NOT NULL DEFAULT 'new', marker TEXT NOT NULL DEFAULT 'ok');",
      );
    },
    async request(request, signal) {
      const response = await fetch(
        `http://127.0.0.1:${address.port}${request.path}`,
        {
          method: request.method,
          ...(request.body === undefined ? {} : { body: request.body }),
          signal,
        },
      );
      return {
        status: response.status,
        headers: Object.fromEntries(response.headers),
        body: new Uint8Array(await response.arrayBuffer()),
      };
    },
    async snapshot() {
      if (mutant === "snapshot-error")
        throw new Error("private worker error should not enter report");
      return snapshotSqlite(path);
    },
    async close() {
      if (closed) return;
      closed = true;
      server.closeAllConnections();
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      db.close();
    },
  };
}
