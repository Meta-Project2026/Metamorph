import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Verdict } from "@metamorph/contracts";
import { compareHttp, type Difference, type HttpObservation } from "./http.js";
import {
  compareSqlite,
  type SqliteSnapshot,
  snapshotSqlite,
} from "./sqlite.js";

export interface Comparators {
  http: typeof compareHttp;
  sqlite: typeof compareSqlite;
}

export interface ControlResult {
  id: string;
  expected: "equal" | "different";
  outcome: Verdict;
  differences: Difference[];
}

export interface ControlReport {
  verdict: Verdict;
  cases: ControlResult[];
  observations: { http: HttpObservation[]; db: SqliteSnapshot[] };
}

export function checkedDifferences(value: Difference[]): Difference[] {
  if (
    !Array.isArray(value) ||
    value.some(
      (diff) =>
        !diff ||
        typeof diff.code !== "string" ||
        !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(diff.code) ||
        typeof diff.path !== "string",
    )
  ) {
    throw new Error("Invalid comparator result");
  }
  return value;
}

/** Injection is solely a trusted verifier-test seam, never a worker input. */
export function runControls(
  comparators: Comparators = { http: compareHttp, sqlite: compareSqlite },
): ControlReport {
  const root = mkdtempSync(join(tmpdir(), "metamorph-controls-"));
  try {
    const dbPath = join(root, "control.sqlite");
    const db = new DatabaseSync(dbPath);
    let original: SqliteSnapshot;
    let mutated: SqliteSnapshot;
    let sequence: SqliteSnapshot;
    try {
      db.exec(
        "CREATE TABLE items (id INTEGER PRIMARY KEY AUTOINCREMENT, value TEXT NOT NULL DEFAULT 'new'); INSERT INTO items(value) VALUES ('original');",
      );
      original = snapshotSqlite(dbPath);
      db.exec("UPDATE items SET value = 'mutated' WHERE id = 1;");
      mutated = snapshotSqlite(dbPath);
      db.exec(
        "UPDATE items SET value = 'original' WHERE id = 1; UPDATE sqlite_sequence SET seq = 50 WHERE name = 'items';",
      );
      sequence = snapshotSqlite(dbPath);
    } finally {
      db.close();
    }
    const observation = (body: string, status = 200): HttpObservation => ({
      status,
      headers: { "content-type": "application/json" },
      body: Buffer.from(body),
    });
    const http = [
      observation('{"id":1,"optional":null,"items":[1,2]}'),
      observation('{"items":[1,2],"optional":null,"id":1}'),
      observation('{"id":1,"optional":null,"items":[1,2]}', 409),
      observation('{"id":"1","optional":null,"items":[1,2]}'),
      observation('{"id":1,"items":[1,2]}'),
      observation('{"id":1,"optional":null,"items":[2,1]}'),
    ];
    const cases: ControlResult[] = [];
    const check = (
      id: string,
      expected: ControlResult["expected"],
      compare: () => Difference[],
    ) => {
      try {
        const differences = checkedDifferences(compare());
        const matches =
          expected === "equal"
            ? differences.length === 0
            : differences.length > 0;
        cases.push({
          id,
          expected,
          outcome: matches ? "PASS" : "FAIL",
          differences,
        });
      } catch {
        cases.push({ id, expected, outcome: "ERROR", differences: [] });
      }
    };
    const first = http[0];
    if (!first) throw new Error("Missing control");
    for (const [index, candidate] of http.entries()) {
      check(
        [
          "http-positive",
          "http-key-order",
          "http-status-mutant",
          "http-type-mutant",
          "http-missing-mutant",
          "http-order-mutant",
        ][index] ?? "invalid-control",
        index < 2 ? "equal" : "different",
        () => comparators.http(first, candidate),
      );
    }
    check("db-positive", "equal", () =>
      comparators.sqlite(original, structuredClone(original)),
    );
    check("db-row-mutant", "different", () =>
      comparators.sqlite(original, mutated),
    );
    check("db-sequence-mutant", "different", () =>
      comparators.sqlite(original, sequence),
    );
    return {
      verdict: cases.some((entry) => entry.outcome === "ERROR")
        ? "ERROR"
        : cases.some((entry) => entry.outcome !== "PASS")
          ? "FAIL"
          : "PASS",
      cases,
      observations: { http, db: [original, mutated, sequence] },
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
