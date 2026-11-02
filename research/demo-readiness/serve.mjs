import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { PINS } from "./pins.mjs";
import { REAL_AI_PINS } from "./real-ai-pins.mjs";

const routes = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ...[
    "viewer.mjs",
    "adapter.mjs",
    "pins.mjs",
    "real-ai-adapter.mjs",
    "real-ai-pins.mjs",
    "incident-adapter.mjs",
    "incident-pins.mjs",
  ].map((name) => [`/${name}`, [name, "text/javascript; charset=utf-8"]]),
  ["/style.css", ["style.css", "text/css; charset=utf-8"]],
  // Track D: one fixed allowlisted derived summary. The literal route serves exactly
  // ../mmp-104/incident.json; no dynamic paths, directory listing or traversal.
  [
    "/evidence/mmp-104/incident.json",
    ["../mmp-104/incident.json", "application/json; charset=utf-8"],
  ],
  ...Object.keys(PINS.files).map((name) => [
    `/evidence/${name}`,
    [`evidence/${name}`, "application/json; charset=utf-8"],
  ]),
  ...Object.keys(REAL_AI_PINS.files).map((name) => [
    `/${REAL_AI_PINS.directory}/${name}`,
    [`${REAL_AI_PINS.directory}/${name}`, "application/json; charset=utf-8"],
  ]),
]);
export function makeServer() {
  return createServer(async (req, res) => {
    const headers = {
      "Content-Security-Policy":
        "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "no-store",
      "Cross-Origin-Resource-Policy": "same-origin",
    };
    // Compare raw request targets. No URL decoding, traversal, redirects or directory serving.
    const route = routes.get(req.url);
    if (!["GET", "HEAD"].includes(req.method) || !route) {
      res.writeHead(404, headers).end();
      return;
    }
    try {
      const bytes = await readFile(new URL(route[0], import.meta.url));
      res.writeHead(200, {
        ...headers,
        "Content-Type": route[1],
        "Content-Length": bytes.length,
      });
      res.end(req.method === "HEAD" ? undefined : bytes);
    } catch {
      res.writeHead(404, headers).end();
    }
  });
}
if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const server = makeServer();
  server.on("error", () => {
    console.error("DEMO_SERVER_ERROR: port 4171 unavailable");
    process.exitCode = 1;
  });
  server.listen(4171, "127.0.0.1", () =>
    console.log(
      "Metamorph read-only demo: http://127.0.0.1:4171 — Ctrl+C to stop",
    ),
  );
}
