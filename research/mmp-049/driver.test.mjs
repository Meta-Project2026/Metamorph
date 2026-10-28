// Host tests validate admission/policy/receipts; never execute candidate source.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { MANIFEST } from "../../packages/oracle/dist/reference/manifest.js";
import {
  requestPolicy,
  WORKSHOP_PROFILE,
} from "../../packages/target-worker/runtime/profile.mjs";
import { admitDirectory } from "../../packages/target-worker/src/admission.mjs";
import { root, verifyPins } from "../mmp-044/config.mjs";
import { blankCase } from "../mmp-044/driver.mjs";
import { correctedReplay } from "./replay.mjs";
import { regressions } from "./scenarios.mjs";
import { validateGroup } from "./validation.mjs";

const metadata = JSON.parse(
  readFileSync(join(root, "specs/016-candidate-compat/candidate.json")),
);
test("explicit corrected replay emits the original public defect then exactly restores the pinned new source", async () => {
  const bundle = await admitDirectory(
    join(root, metadata.path),
    metadata.candidateSha256,
  );
  const provider = correctedReplay(bundle);
  const signal = new AbortController().signal;
  const broken = await provider.generate(
    { unitId: "workshop", attempt: 1, action: "generate" },
    signal,
  );
  const repaired = await provider.generate(
    { unitId: "workshop", attempt: 2, action: "repair" },
    signal,
  );
  assert.equal(provider.billing, "synthetic");
  assert.equal(provider.maxRequestCostUsd, 0);
  assert.deepEqual(
    repaired.changes,
    bundle.files.map(({ path, content }) => ({ path, content })),
  );
  assert.equal(
    broken.changes.filter((f, i) => f.content !== repaired.changes[i].content)
      .length,
    1,
  );
  assert.ok(
    broken.changes
      .find((f) => f.path === "src/main.ts")
      .content.includes(
        "// Original public negative control: cancellation is a no-op.",
      ),
  );
  await assert.rejects(
    provider.generate(
      { unitId: "workshop", attempt: 3, action: "repair" },
      signal,
    ),
  );
});
test("corrected replay rejects cancellation and wrong unit before returning source", async () => {
  const bundle = await admitDirectory(
    join(root, metadata.path),
    metadata.candidateSha256,
  );
  const provider = correctedReplay(bundle);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    provider.generate(
      { unitId: "workshop", attempt: 1, action: "generate" },
      controller.signal,
    ),
  );
  await assert.rejects(
    provider.generate(
      { unitId: "unrelated", attempt: 1, action: "generate" },
      new AbortController().signal,
    ),
  );
});
test("new candidate is separately admitted; immutable baseline, notices and trusted pins remain intact", async () => {
  const { pins } = verifyPins({ strictCheckout: process.platform === "linux" });
  const original = await admitDirectory(
    join(root, metadata.baselinePath),
    pins.candidateSha256,
  );
  const corrected = await admitDirectory(
    join(root, metadata.path),
    metadata.candidateSha256,
  );
  assert.equal(original.candidateSha, metadata.baselineSha256);
  assert.notEqual(corrected.candidateSha, original.candidateSha);
  assert.equal(
    corrected.files.find((f) => f.path === "src/schema.ts").content,
    original.files.find((f) => f.path === "src/schema.ts").content,
  );
  await assert.rejects(
    admitDirectory(join(root, metadata.path), metadata.baselineSha256),
  );
});
test("all mandatory, fixed MMP-044 and additional public requests use the unchanged admissible policy", () => {
  const { corpus } = verifyPins({ strictCheckout: false });
  const scenarios = [...MANIFEST, ...corpus.cases, ...regressions];
  assert.equal(new Set(scenarios.map((s) => s.id)).size, scenarios.length);
  assert.equal(regressions.length, 25);
  for (const s of scenarios)
    for (const r of s.requests)
      requestPolicy(WORKSHOP_PROFILE, r.method, r.path, r.body);
  assert.deepEqual(
    regressions.find((s) => s.id === "compat-missing-cancel-id").requests[1],
    { method: "POST", path: "/api.php?action=cancel_appointment", body: "" },
  );
});
const scenario = regressions[0];
function complete() {
  const receipt = blankCase(scenario);
  Object.assign(receipt, {
    status: "PASS",
    bootstrap: "PASS",
    g1: "PASS",
    initial: { status: "PASS" },
    normalCleanup: "PASS",
    inventory: { containers: 0, volumes: 0 },
    executedHttp: scenario.requests.length,
    executedSqlite: scenario.requests.length + 1,
  });
  for (const step of receipt.steps)
    Object.assign(step, { http: { status: "PASS" }, db: { status: "PASS" } });
  return receipt;
}
test("complete receipts establish only scoped coverage; a real mismatch stays FAIL", () => {
  assert.equal(validateGroup([scenario], [complete()]).status, "PASS");
  const failed = complete();
  failed.steps[1].db = { status: "FAIL", codes: ["DB_STATE"] };
  failed.status = "FAIL";
  failed.firstDifference = {
    kind: "SQLITE",
    stepId: "step-2",
    codes: ["DB_STATE"],
  };
  assert.equal(validateGroup([scenario], [failed]).status, "FAIL");
});
for (const [name, mutate] of [
  ["missing HTTP", (r) => r.executedHttp--],
  ["missing initial SQLite", (r) => r.executedSqlite--],
  [
    "unexecuted step",
    (r) => {
      r.steps[0].http.status = "NOT_RUN";
    },
  ],
  [
    "wrong scenario",
    (r) => {
      r.scenarioId = "unrelated";
    },
  ],
  [
    "hidden mismatch",
    (r) => {
      r.steps[0].db.status = "FAIL";
    },
  ],
  [
    "surviving volume",
    (r) => {
      r.inventory.volumes = 1;
    },
  ],
  [
    "emergency cleanup",
    (r) => {
      r.emergencyRemoved = 1;
    },
  ],
  [
    "normal cleanup error",
    (r) => {
      r.normalCleanup = "ERROR";
    },
  ],
])
  test(`receipt validation rejects ${name}`, () => {
    const receipt = complete();
    mutate(receipt);
    assert.throws(() => validateGroup([scenario], [receipt]));
  });
