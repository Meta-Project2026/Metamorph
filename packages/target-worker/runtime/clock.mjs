import { performance } from "node:perf_hooks";
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync(":memory:");
function sample() {
  return {
    date: new Date().toISOString(),
    dateNow: Date.now(),
    sqlite: db
      .prepare(
        "SELECT datetime('now') AS datetime, CURRENT_TIMESTAMP AS timestamp",
      )
      .get(),
    performanceNow: performance.now(),
    hrtime: String(process.hrtime.bigint()),
  };
}
const before = sample();
await new Promise((resolve) => setTimeout(resolve, 1200));
const after = sample();
console.log(
  JSON.stringify({
    node: process.version,
    sqlite: process.versions.sqlite,
    before,
    after,
    monotonicDeltaMs: after.performanceNow - before.performanceNow,
  }),
);
db.close();
