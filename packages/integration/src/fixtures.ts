// Original trusted PUBLIC/SYNTHETIC fixture implementation. Never loads candidate code.
import { once } from "node:events";
import { createServer } from "node:http";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  type PublicScenario,
  snapshotSqlite,
  type WorkerAdapter,
} from "@metamorph/oracle";

export const CANDIDATE_TEXT = Object.freeze({
  broken: "// metamorph-public-demo:broken\n",
  repaired: "// metamorph-public-demo:repaired\n",
});
export type DemoMode = keyof typeof CANDIDATE_TEXT;
const scenarios: PublicScenario[] = [
  {
    id: "public:write-read",
    requests: [
      { method: "POST", path: "/items" },
      { method: "GET", path: "/items" },
    ],
  },
  { id: "public:fresh", requests: [{ method: "GET", path: "/items" }] },
];
export const PUBLIC_SCENARIOS: readonly PublicScenario[] = Object.freeze(
  scenarios.map((s) =>
    Object.freeze({
      ...s,
      requests: Object.freeze(s.requests.map((r) => Object.freeze(r))),
    }),
  ),
);

export function parseDemoMarker(text: string): DemoMode {
  if (text === CANDIDATE_TEXT.broken) return "broken";
  if (text === CANDIDATE_TEXT.repaired) return "repaired";
  throw new Error("INVALID_DEMO_MARKER");
}

async function worker(
  root: string,
  name: string,
  broken: boolean,
): Promise<WorkerAdapter> {
  const path = join(root, `${name}.sqlite`);
  const db = new DatabaseSync(path);
  let closed = false;
  const server = createServer((request, response) => {
    try {
      if (
        request.url !== "/items" ||
        !["GET", "POST"].includes(request.method ?? "")
      ) {
        response.writeHead(404, { "content-type": "application/json" });
        response.end('{"error":"missing"}');
        return;
      }
      if (request.method === "POST") {
        db.prepare("INSERT INTO items(value) VALUES (?)").run(
          broken ? "mutated" : "public-value",
        );
      }
      response.writeHead(broken && request.method === "POST" ? 409 : 200, {
        "content-type": "application/json",
      });
      response.end(
        JSON.stringify({
          items: db.prepare("SELECT * FROM items ORDER BY id").all(),
        }),
      );
    } catch {
      response.writeHead(500, { "content-type": "application/json" });
      response.end('{"error":"fixture"}');
    }
  });
  try {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
  } catch (error) {
    server.close();
    db.close();
    throw error;
  }
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("FIXTURE_ADDRESS");
  return {
    async reset(signal) {
      signal.throwIfAborted();
      db.exec(
        "DROP TABLE IF EXISTS items; CREATE TABLE items(id INTEGER PRIMARY KEY AUTOINCREMENT, value TEXT NOT NULL);",
      );
    },
    async request(input, signal) {
      const response = await fetch(
        `http://127.0.0.1:${address.port}${input.path}`,
        {
          method: input.method,
          signal,
          ...(input.body === undefined ? {} : { body: input.body }),
        },
      );
      return {
        status: response.status,
        headers: Object.fromEntries(response.headers),
        body: new Uint8Array(await response.arrayBuffer()),
      };
    },
    async snapshot(signal) {
      signal.throwIfAborted();
      return snapshotSqlite(path);
    },
    async close() {
      if (closed) return;
      closed = true;
      server.closeAllConnections();
      try {
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      } finally {
        db.close();
      }
    },
  };
}

export interface FixturePair {
  reference: WorkerAdapter;
  candidate: WorkerAdapter;
}
// Trusted test seam; callers own cleanup of partially provisioned pairs.
export type PairFactory = (
  root: string,
  mode: DemoMode,
  signal: AbortSignal,
) => Promise<FixturePair>;
export const createPublicPair: PairFactory = async (root, mode, signal) => {
  signal.throwIfAborted();
  const reference = await worker(root, "reference", false);
  try {
    signal.throwIfAborted();
    return {
      reference,
      candidate: await worker(root, "candidate", mode === "broken"),
    };
  } catch (error) {
    await reference.close(new AbortController().signal);
    throw error;
  }
};
