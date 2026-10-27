import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { MANIFEST } from "@metamorph/oracle";
import {
  admitDirectory,
  validateBundle,
} from "../../target-worker/src/admission.mjs";
import { WORKSHOP_CONTROL_IDS } from "../src/workshop-controls.mjs";
import { WORKSHOP_CANDIDATE_SHA } from "../src/workshop-policy.mjs";
import { workshopSummary } from "../src/workshop-public.mjs";

const hash = "a".repeat(64),
  cleanup = "VERIFIED_ZERO_RESOURCES";
function receipt() {
  return {
    headSha: "b".repeat(40),
    candidateSha: WORKSHOP_CANDIDATE_SHA,
    phpImage: `sha256:${hash}`,
    targetImage: `sha256:${hash}`,
    recipeSha: hash,
    runs: Array.from({ length: 6 }, (_, i) => {
      const s = MANIFEST[i % 3],
        ids = s.requests.map((_, n) => `${s.id}:step-${n}`);
      return {
        pass: Math.floor(i / 3) + 1,
        scenarioId: s.id,
        phpPackSha: hash,
        bridgePackSha: hash,
        cleanup,
        counts: {
          targetResets: 2,
          targetRequests: ids.length,
          targetSnapshots: ids.length + 1,
          readiness: 2,
        },
        gates: [
          {
            gate: "G2",
            verdict: "PASS",
            executedTestIds: ids,
            findingCodes: [],
          },
          {
            gate: "G3",
            verdict: "PASS",
            executedTestIds: [`${s.id}:initial`, ...ids],
            findingCodes: [],
          },
          {
            gate: "G4",
            verdict: "INCONCLUSIVE",
            executedTestIds: [
              "http-positive",
              "http-key-order",
              "http-status-mutant",
              "http-type-mutant",
              "http-missing-mutant",
              "http-order-mutant",
              "db-positive",
              "db-row-mutant",
              "db-sequence-mutant",
            ],
            findingCodes: ["HELD_OUT_NOT_RUN"],
          },
        ],
      };
    }),
    quota: ["aux", "wal"].map((mode, i) => ({
      mode,
      code: ["ENOSPC", "SQLITE_FULL"][i],
      totalBytes: 16777216,
      writtenBytes: 65536,
      type: "tmpfs",
      cleanup,
    })),
    controls: WORKSHOP_CONTROL_IDS.map((id) => ({
      id,
      outcome: "PASS",
      cleanup,
    })),
  };
}
test("new candidate is admitted at literal immutable source pin without host execution", async () => {
  const bundle = await admitDirectory(
    fileURLToPath(
      new URL("../../target-worker/fixtures/workshop", import.meta.url),
    ),
    WORKSHOP_CANDIDATE_SHA,
  );
  assert.equal(bundle.candidateSha, WORKSHOP_CANDIDATE_SHA);
  assert.throws(
    () => validateBundle(bundle.files, "0".repeat(64)),
    /candidate hash/,
  );
});
test("coverage union validates every initial/step in both passes; no product verdict", () => {
  const s = workshopSummary(receipt());
  assert.equal(s.coverage, "ALL_17_PUBLIC_STEPS_PER_PASS");
  assert.equal(
    s.runs.reduce((n, r) => n + r.gates[0].executedTestIds.length, 0),
    34,
  );
  assert.equal(
    s.runs.reduce((n, r) => n + r.gates[1].executedTestIds.length, 0),
    40,
  );
  assert.equal(s.product, "NOT_ESTABLISHED");
});
const mutations = {
  missingScenario: (x) => x.runs.pop(),
  repeatedScenario: (x) => {
    x.runs[1] = x.runs[0];
  },
  missingInitial: (x) => x.runs[0].gates[1].executedTestIds.shift(),
  missingStep: (x) => x.runs[0].gates[0].executedTestIds.pop(),
  repeatedStep: (x) =>
    x.runs[0].gates[0].executedTestIds.push(
      x.runs[0].gates[0].executedTestIds[0],
    ),
  reorder: (x) => x.runs[0].gates[1].executedTestIds.reverse(),
  missingControl: (x) => x.runs[0].gates[2].executedTestIds.pop(),
  heldOutPass: (x) => {
    x.runs[0].gates[2].verdict = "PASS";
  },
  concealedMismatch: (x) =>
    x.runs[0].gates[0].findingCodes.push("HTTP_JSON_VALUE"),
  countForgery: (x) => {
    x.runs[0].counts.targetRequests = 1;
  },
  missingSnapshot: (x) => {
    x.runs[0].counts.targetSnapshots = 0;
  },
  rawBody: (x) => {
    x.runs[0].gates[0].body = "PRIVATE_CANARY";
  },
  rawSQL: (x) => {
    x.ddl = "PRIVATE_CANARY";
  },
  rawFinding: (x) => x.runs[0].gates[0].findingCodes.push("PRIVATE_CANARY"),
  cleanupError: (x) => {
    x.runs[0].cleanup = "ERROR";
  },
  badPin: (x) => {
    x.candidateSha = "0".repeat(64);
  },
  fakeQuota: (x) => {
    x.quota[0].type = "ext4";
  },
  quotaNotFull: (x) => {
    x.quota[1].code = "SUCCESS";
  },
  omittedSandboxControl: (x) => x.controls.pop(),
};
for (const [name, mutate] of Object.entries(mutations))
  test(`public summary rejects ${name}`, () => {
    const x = receipt();
    mutate(x);
    assert.throws(() => workshopSummary(x));
  });
test("actual HTTP mismatch remains scoped FAIL without complete-coverage claim", () => {
  const x = receipt();
  x.runs[0].gates[0].verdict = "FAIL";
  x.runs[0].gates[0].findingCodes = ["HTTP_JSON_TYPE"];
  x.runs[0].gates[1].verdict = "FAIL";
  x.runs[0].gates[1].findingCodes = ["HTTP_JSON_TYPE"];
  const s = workshopSummary(x);
  assert.equal(s.coverage, "SEE_PER_SCENARIO_RESULTS");
  assert.equal(s.runs[0].gates[1].verdict, "FAIL");
  assert.ok(!JSON.stringify(s).includes("PRIVATE_CANARY"));
});
