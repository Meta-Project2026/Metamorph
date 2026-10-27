// Original public demonstration, authored for this task. No migrated PHP or provider call.
import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("/state/target.sqlite");
db.exec(
  "CREATE TABLE IF NOT EXISTS items(id INTEGER PRIMARY KEY AUTOINCREMENT, value TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
);
const server = createServer(async (req, res) => {
  res.setHeader("content-type", "application/json");
  res.setHeader("x-request-id", req.headers["x-request-id"] ?? "");
  if (req.url !== "/items" || (req.method !== "GET" && req.method !== "POST")) {
    res.writeHead(404);
    res.end('{"error":"missing"}');
    return;
  }
  if (req.method === "POST") {
    let body = "";
    for await (const chunk of req) {
      body += String(chunk);
      if (body.length > 4096) {
        res.writeHead(413);
        res.end("{}");
        return;
      }
    }
    try {
      const input: unknown = JSON.parse(body);
      if (
        typeof input !== "object" ||
        input === null ||
        !("value" in input) ||
        typeof input.value !== "string" ||
        input.value.length > 128
      )
        throw new Error("input");
      db.prepare("INSERT INTO items(value) VALUES (?)").run(input.value);
    } catch {
      res.writeHead(400);
      res.end('{"error":"input"}');
      return;
    }
  }
  res.end(
    JSON.stringify({
      items: db.prepare("SELECT * FROM items ORDER BY id").all(),
    }),
  );
});
server.listen(3000, "127.0.0.1");
process.on("SIGTERM", () => {
  server.close(() => {
    db.close();
    process.exit(0);
  });
});
