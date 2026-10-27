// Original synthetic boundary controls. No candidate TS/PHP runs on the host.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { link, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runAgent } from "@metamorph/agent";
import { MANIFEST, NORMALIZATION_VERSION } from "@metamorph/oracle";
import { WORKSHOP_CANDIDATE_SHA } from "../../differential/src/workshop-policy.mjs";
import { admitDirectory } from "../../target-worker/src/admission.mjs";
import {
  aggregateAttempt,
  expectedIds,
  gateResult,
  publicAttempt,
  validatePublication,
} from "../src/report.mjs";
import {
  bindCancellation,
  buildReceipt,
  RealVerifier,
} from "../src/runtime.mjs";
import { createSourceSession, DEFECT, replayProvider } from "../src/source.mjs";

const fixture = fileURLToPath(
  new URL("../../target-worker/fixtures/workshop", import.meta.url),
);
const signal = () => new AbortController().signal;
const request = (attempt = 1) => ({
  unitId: "workshop",
  tier: "spark",
  action: attempt === 1 ? "generate" : "repair",
  attempt,
  repairFeedback: null,
});
async function source(t) {
  const parent = mkdtempSync(join(tmpdir(), "agent-real-test-"));
  t.after(() => rm(parent, { recursive: true, force: true }));
  return createSourceSession(parent);
}
const proposal = [{ path: "src/main.ts", content: "export const value = 1;" }];
function attemptFixture() {
  const attemptId = randomUUID(),
    candidateSha = "a".repeat(64);
  return {
    attemptId,
    candidateSha,
    errorCode: null,
    pairs: MANIFEST.map((s, i) => ({
      attemptId,
      candidateSha,
      pairId: randomUUID(),
      scenarioId: s.id,
      cleanup: "VERIFIED_ZERO_RESOURCES",
      packs: [
        {
          id: `oracle-synthetic${i}`,
          sha256: "b".repeat(64),
          reference: `synthetic-${i}/index.json`,
        },
      ],
      build: {
        gate: "G1",
        verdict: "PASS",
        executedTestIds: [`${s.id}:typecheck`, `${s.id}:build`],
        findingCodes: [],
      },
      gates: ["G2", "G3", "G4"].map((gate) => ({
        gate,
        verdict: gate === "G4" ? "INCONCLUSIVE" : "PASS",
        executedTestIds: expectedIds(s, gate),
        findingCodes: gate === "G4" ? ["HELD_OUT_NOT_RUN"] : [],
      })),
    })),
  };
}
test("synthetic source ownership: foreign root, mutation, hardlink and bad SHA fail closed", async (t) => {
  const s = await source(t);
  await s.writer.write(proposal, signal());
  await assert.rejects(s.acquire(join(s.writer.root, "src"), signal()));
  await assert.rejects(admitDirectory(s.writer.root, "0".repeat(64)));
  const lease = await s.acquire(s.writer.root, signal());
  await assert.rejects(s.writer.write(proposal, signal()), /SOURCE_BUSY/);
  assert.throws(() => {
    lease.bundle.files[0].content = "changed";
  });
  writeFileSync(join(s.writer.root, "src/main.ts"), "mutation after admission");
  await assert.rejects(lease.assertUnchanged());
  await assert.rejects(lease.release());
  assert.equal(lease.bundle.files[0].content, proposal[0].content);
  await s.writer.write(proposal, signal());
  await link(
    join(s.writer.root, "src/main.ts"),
    join(s.writer.root, "src/linked.ts"),
  );
  await assert.rejects(s.acquire(s.writer.root, signal()));
});
test("synthetic protected path is rejected before candidate writes", async (t) => {
  const s = await source(t);
  for (const path of [
    "src/oracle.ts",
    "src/held-out/value.ts",
    "../escape.ts",
    "src/test.ts",
    "package.json",
  ])
    await assert.rejects(
      s.writer.write([{ path, content: "unsafe" }], signal()),
    );
});
test("offline source replay uses pinned actual TS bytes, unknown tokens and zero spend", async (t) => {
  const s = await source(t);
  const provider = await replayProvider(fixture, "repair");
  const broken = await provider.generate(request(), signal());
  assert.equal(provider.billing, "synthetic");
  assert.equal(provider.maxRequestCostUsd, 0);
  assert.equal(broken.usage.estimatedCostUsd, 0);
  assert.equal(broken.usage.inputTokens, null);
  assert.equal(broken.usage.outputTokens, null);
  assert.equal(broken.usage.cachedInputTokens, null);
  assert.equal(
    broken.changes
      .find((f) => f.path === "src/main.ts")
      .content.includes(DEFECT),
    false,
  );
  await s.writer.write(broken.changes, signal());
  const first = await s.acquire(s.writer.root, signal());
  const firstSha = first.bundle.candidateSha;
  await first.release();
  const repaired = await provider.generate(request(2), signal());
  await s.writer.write(repaired.changes, signal());
  const second = await s.acquire(s.writer.root, signal());
  assert.equal(second.bundle.candidateSha, WORKSHOP_CANDIDATE_SHA);
  assert.notEqual(second.bundle.candidateSha, firstSha);
  assert.match(
    second.bundle.files.find((f) => f.path === "src/schema.ts").content,
    /MIT License/,
  );
  await second.release();
  await assert.rejects(
    provider.generate(request(3), signal()),
    /REPLAY_BUDGET/,
  );
});
test("synthetic full public coverage still cannot establish G0/G4 or Agent PASS", () => {
  const report = aggregateAttempt(attemptFixture());
  assert.deepEqual(
    report.results.map((g) => g.verdict),
    ["INCONCLUSIVE", "PASS", "PASS", "PASS", "INCONCLUSIVE"],
  );
  assert.equal(report.results[2].executedTestIds.length, 17);
  assert.equal(report.results[3].executedTestIds.length, 20);
});
test("synthetic G4 controls remain bound to their later scenario when the first pair has no gates", () => {
  const a = attemptFixture();
  a.pairs[0].gates = [];
  const report = aggregateAttempt(a);
  const g4 = report.results.find((gate) => gate.gate === "G4");
  assert.equal(g4.verdict, "INCONCLUSIVE");
  assert.deepEqual(
    g4.executedTestIds,
    MANIFEST.slice(1).flatMap((scenario) =>
      expectedIds(scenario, "G4").map((id) => `${scenario.id}:${id}`),
    ),
  );
  assert.equal(
    report.results.find((gate) => gate.gate === "G2").verdict,
    "INCONCLUSIVE",
  );
  assert.equal(
    report.results.find((gate) => gate.gate === "G3").verdict,
    "INCONCLUSIVE",
  );
});
test("synthetic G4 controls do not shift when the middle pair has no gates", () => {
  const a = attemptFixture();
  a.pairs[1].gates = [];
  const report = aggregateAttempt(a);
  const g4 = report.results.find((gate) => gate.gate === "G4");
  assert.equal(g4.verdict, "INCONCLUSIVE");
  assert.deepEqual(
    g4.executedTestIds,
    [MANIFEST[0], MANIFEST[2]].flatMap((scenario) =>
      expectedIds(scenario, "G4").map((id) => `${scenario.id}:${id}`),
    ),
  );
});
test("synthetic partial receipts preserve ERROR over FAIL without inventing coverage", () => {
  const a = attemptFixture();
  a.pairs[0].gates = [];
  const fail = a.pairs[1].gates[0];
  fail.verdict = "FAIL";
  fail.findingCodes = ["HTTP_STATUS"];
  const error = a.pairs[2].gates[0];
  error.verdict = "ERROR";
  error.findingCodes = ["VERIFIER_ERROR"];
  const report = aggregateAttempt(a);
  assert.equal(
    report.results.find((gate) => gate.gate === "G2").verdict,
    "ERROR",
  );
  assert.equal(
    report.results.find((gate) => gate.gate === "G3").verdict,
    "INCONCLUSIVE",
  );
  assert.equal(
    report.results.find((gate) => gate.gate === "G4").verdict,
    "INCONCLUSIVE",
  );
  assert.deepEqual(report.executedScenarioIds, [
    MANIFEST[1].id,
    MANIFEST[2].id,
  ]);
});
test("synthetic public lifetime reports policy rather than measured duration", () => {
  const result = publicAttempt(attemptFixture());
  for (const pair of result.pairs) {
    assert.equal(pair.targetLifetimePolicyMs, 180000);
    assert.equal(Object.hasOwn(pair, "targetLifetimeMs"), false);
  }
});
test("synthetic incomplete scenarios stay INCONCLUSIVE; no missing step becomes PASS", () => {
  const a = attemptFixture();
  a.pairs.pop();
  const report = aggregateAttempt(a);
  assert.equal(report.results[2].verdict, "INCONCLUSIVE");
  assert.equal(report.results[3].verdict, "INCONCLUSIVE");
  assert.equal(report.executedScenarioIds.length, 2);
});
test("synthetic stale evidence identity and reused pack IDs are rejected", () => {
  for (const mutate of [
    (a) => {
      a.pairs[1].candidateSha = "c".repeat(64);
    },
    (a) => {
      a.pairs[1].attemptId = randomUUID();
    },
    (a) => {
      a.pairs[1].scenarioId = a.pairs[0].scenarioId;
    },
    (a) => {
      a.pairs[1].packs[0].id = a.pairs[0].packs[0].id;
    },
    (a) => {
      a.pairs[1].pairId = a.pairs[0].pairId;
    },
    (a) => {
      a.pairs[1].gates[1].executedTestIds = expectedIds(MANIFEST[0], "G3");
    },
    (a) => {
      a.pairs[1].gates[0].executedTestIds.pop();
    },
    (a) => {
      a.pairs[1].gates[0].executedTestIds.push("hidden:seed");
    },
  ]) {
    const a = attemptFixture();
    mutate(a);
    assert.throws(() => aggregateAttempt(a), { code: "EVIDENCE_ERROR" });
  }
});
test("synthetic cleanup/volume fault remains ERROR despite passing comparisons", () => {
  const a = attemptFixture();
  a.pairs[1].cleanup = "CLEANUP_ERROR";
  assert.equal(aggregateAttempt(a).results[2].verdict, "ERROR");
  assert.equal(aggregateAttempt(a).results[3].verdict, "ERROR");
});
test("synthetic mismatches survive partial coverage and feedback contains only codes", () => {
  const a = attemptFixture();
  a.pairs.pop();
  a.pairs[0].gates[1].verdict = "FAIL";
  a.pairs[0].gates[1].findingCodes = ["DB_STATE"];
  a.pairs[0].gates[1].rawFinding = "private SQL or seed";
  const report = aggregateAttempt(a);
  assert.equal(report.results[3].verdict, "FAIL");
  assert.equal(report.repairFeedback, "DB_STATE");
  assert.ok(report.repairFeedback.length <= 512);
  assert.doesNotMatch(
    JSON.stringify(publicAttempt(a)),
    /private SQL|rawFinding|reference|index\.json/,
  );
  a.pairs[0].gates[1].findingCodes = ["private SQL or seed"];
  assert.throws(() => publicAttempt(a));
});
test("synthetic Oracle publication must contain initial and every raw step index", () => {
  const s = MANIFEST[0],
    oracleId = "oracle-synthetic";
  const paths = [
    "db/0-initial-reference.json",
    "db/0-initial.json",
    "diffs/0-initial.json",
    "controls.json",
  ];
  for (const n of s.requests.keys())
    paths.push(
      `http/0-${n}-reference.json`,
      `http/0-${n}.json`,
      `diffs/0-${n}-http.json`,
      `db/0-${n}-reference.json`,
      `db/0-${n}.json`,
      `diffs/0-${n}-db.json`,
    );
  const a = {
    manifest: {
      runId: oracleId,
      scenarioIds: [s.id],
      expectedSteps: s.requests.length,
    },
    initialDiffs: [],
    gates: ["G2", "G3", "G4"].map((g) =>
      gateResult(
        g,
        g === "G4" ? "INCONCLUSIVE" : "PASS",
        expectedIds(s, g),
        g === "G4" ? ["HELD_OUT_NOT_RUN"] : [],
        [...paths],
      ),
    ),
  };
  assert.equal(validatePublication(a, s, oracleId).length, 3);
  a.initialDiffs.push({ code: "DB_STATE" });
  assert.throws(() => validatePublication(a, s, oracleId));
  a.initialDiffs = [];
  a.gates[1].evidencePaths = paths.filter((p) => p !== "db/0-2.json");
  assert.throws(() => validatePublication(a, s, oracleId));
});
test("synthetic build receipt requires real recipe phases and distinguishes compile FAIL", () => {
  const worker = {
    image: "sha256:synthetic",
    evidence: {
      build: {
        args: ["sha256:synthetic", "/opt/worker/build.mjs"],
        exitCode: 2,
        stdout: JSON.stringify({
          checks: [
            { phase: "typecheck", exitCode: 2, signal: null, error: null },
          ],
        }),
      },
    },
  };
  assert.equal(buildReceipt(worker, MANIFEST[0].id).verdict, "FAIL");
  worker.evidence.build.timedOut = true;
  assert.equal(buildReceipt(worker, MANIFEST[0].id).verdict, "ERROR");
  worker.evidence.build.timedOut = false;
  worker.evidence.build.stdout = JSON.stringify({
    checks: [{ phase: "typecheck", exitCode: 0 }],
  });
  assert.throws(() => buildReceipt(worker, MANIFEST[0].id));
});
test("external verifier cannot be constructed with a fake environment/session", () => {
  assert.throws(() => new RealVerifier({}, {}));
});
test("synthetic cancellation rejects late receipts while allowing independent cleanup", async () => {
  const cancel = new AbortController();
  let resolve,
    closed = false;
  const worker = bindCancellation(
    {
      snapshot: () =>
        new Promise((done) => {
          resolve = done;
        }),
      close: async () => {
        closed = true;
      },
    },
    cancel.signal,
  );
  const pending = worker.snapshot(signal());
  cancel.abort();
  resolve({ fakeLateReceipt: true });
  await assert.rejects(pending);
  await worker.close(signal());
  assert.equal(closed, true);
});
function agentInput(provider, verifier, overrides = {}) {
  return {
    runId: "synthetic-agent-boundary",
    provider,
    verifier,
    writer: { root: "/synthetic-only", write: async () => {} },
    config: {
      benchmarkId: "synthetic",
      strategy: "spark-only",
      maxRepairsPerUnit: 0,
      maxEscalations: 0,
      maxModelSpendUsd: 1,
      timeoutSeconds: 5,
      ...overrides,
    },
    benchmark: {
      id: "synthetic",
      sourceRepo: "https://example.invalid/synthetic",
      sourceCommit: "0".repeat(40),
      license: "original synthetic",
      phpRuntime: "NOT_RUN",
      scenarioIds: MANIFEST.map((s) => s.id),
      migrationUnitIds: ["workshop"],
      normalizationVersion: NORMALIZATION_VERSION,
    },
  };
}
test("synthetic runAgent retains five-gate verdict and rejects malformed provider", async () => {
  const verifier = {
    evidenceKind: "synthetic",
    verify: async () => aggregateAttempt(attemptFixture()),
  };
  const good = await runAgent(
    agentInput(await replayProvider(fixture, "known-good"), verifier),
  );
  assert.equal(good.verdict, "INCONCLUSIVE");
  let verified = false;
  const malformed = {
    billing: "synthetic",
    maxRequestCostUsd: 0,
    generate: async () => ({ changes: [], usage: {} }),
  };
  const bad = await runAgent(
    agentInput(malformed, {
      evidenceKind: "synthetic",
      verify: async () => {
        verified = true;
      },
    }),
  );
  assert.equal(bad.verdict, "ERROR");
  assert.equal(verified, false);
});
test("synthetic budget overrun and unknown paid cost never enter verifier", async () => {
  for (const cost of [2, null]) {
    let verified = false;
    const replay = await replayProvider(fixture, "known-good");
    const provider = {
      billing: "paid",
      maxRequestCostUsd: 0.5,
      generate: async (...args) => {
        const r = await replay.generate(...args);
        r.usage.estimatedCostUsd = cost;
        return r;
      },
    };
    const r = await runAgent(
      agentInput(provider, {
        evidenceKind: "synthetic",
        verify: async () => {
          verified = true;
        },
      }),
    );
    assert.equal(r.verdict, cost === null ? "INCONCLUSIVE" : "ERROR");
    assert.equal(verified, false);
  }
});
test("synthetic timeout and cancellation reject late verifier PASS", async () => {
  for (const cancelRun of [false, true]) {
    const cancel = new AbortController();
    let release;
    const verifier = {
      evidenceKind: "synthetic",
      verify: () =>
        new Promise((done) => {
          release = done;
          if (cancelRun) cancel.abort();
        }),
    };
    const input = agentInput(
      await replayProvider(fixture, "known-good"),
      verifier,
      { timeoutSeconds: 1 },
    );
    input.signal = cancel.signal;
    const result = await runAgent(input);
    assert.equal(result.verdict, "ERROR");
    assert.equal(result.reason, cancelRun ? "CANCELLED" : "TIMEOUT");
    release(aggregateAttempt(attemptFixture()));
  }
});
test("manual workflow is dispatch-only; host build excludes candidate sources", () => {
  const workflow = readFileSync(
    new URL(
      "../../../.github/workflows/agent-workshop-compose.yml",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /pull_request|secrets\.|schedule:/);
  assert.match(workflow, /persist-credentials: false/);
  const config = JSON.parse(
    readFileSync(new URL("../tsconfig.json", import.meta.url)),
  );
  assert.deepEqual(config.include, ["src/boundary.ts"]);
});
