// Public receipt checks. Counts alone never establish parity or cleanup.
import assert from "node:assert/strict";
import { verifyCoverage } from "../mmp-044/driver.mjs";

export function validateGroup(scenarios, receipts) {
  assert.equal(receipts.length, scenarios.length);
  for (const [i, scenario] of scenarios.entries()) {
    const receipt = receipts[i];
    verifyCoverage(scenario, receipt);
    const mismatched = receipt.steps.some(
      (s) => s.http.status === "FAIL" || s.db.status === "FAIL",
    );
    assert.equal(receipt.status, mismatched ? "FAIL" : "PASS", scenario.id);
    assert.equal(receipt.firstDifference === null, !mismatched, scenario.id);
    assert.equal(receipt.normalCleanup, "PASS");
    assert.equal(receipt.emergencyRemoved, 0);
    assert.deepEqual(receipt.inventory, { containers: 0, volumes: 0 });
  }
  return {
    status: receipts.some((r) => r.status === "FAIL") ? "FAIL" : "PASS",
    pairs: receipts.length,
    http: receipts.reduce((n, r) => n + r.executedHttp, 0),
    sqlite: receipts.reduce((n, r) => n + r.executedSqlite, 0),
  };
}
