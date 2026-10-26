import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { RunEventSchema } from "../../contracts/dist/index.js";
import {
  createUnconfiguredMetaProvider,
  runAgent,
  scriptedProvider,
  scriptedVerifier,
  syntheticReport,
} from "../dist/index.js";

function harness(overrides = {}, outcomes = ["PASS"], unitIds = ["unit-1"]) {
  const model = scriptedProvider();
  const verification = scriptedVerifier(outcomes);
  const writes = [];
  const input = {
    runId: "test-run",
    config: {
      benchmarkId: "synthetic",
      strategy: "spark-only",
      maxRepairsPerUnit: 1,
      maxEscalations: 1,
      maxModelSpendUsd: 1,
      timeoutSeconds: 2,
      ...overrides,
    },
    benchmark: {
      id: "synthetic",
      sourceRepo: "https://example.invalid/synthetic",
      sourceCommit: "0".repeat(40),
      license: "original-synthetic",
      phpRuntime: "NOT_RUN",
      scenarioIds: ["scenario-1"],
      migrationUnitIds: unitIds,
      normalizationVersion: "synthetic-only",
    },
    provider: model.provider,
    writer: {
      root: "in-memory-synthetic-candidate",
      async write(changes, signal) {
        signal.throwIfAborted();
        writes.push(structuredClone(changes));
      },
    },
    verifier: verification.verifier,
  };
  return { input, model, verification, writes };
}

function assertJournal(result, expected) {
  for (const event of result.events) RunEventSchema.parse(event);
  const states = result.events
    .filter((event) => event.type === "run-state-changed")
    .map((event) => event.state);
  assert.equal(states[0], "CREATED");
  assert.equal(states.at(-1), result.verdict);
  assert.equal(
    states.filter((state) =>
      ["PASS", "FAIL", "ERROR", "INCONCLUSIVE"].includes(state),
    ).length,
    1,
  );
  if (expected) assert.deepEqual(states, expected);
}

function setReport(h, report) {
  h.input.verifier.verify = async () => structuredClone(report);
}

function paid(h, costs, bound = 0.4) {
  const generate = h.input.provider.generate;
  let index = 0;
  h.input.provider = {
    billing: "paid",
    maxRequestCostUsd: bound,
    async generate(request, signal) {
      const response = await generate(request, signal);
      response.usage.estimatedCostUsd = costs[index++] ?? null;
      return response;
    },
  };
}

test("first attempt: only complete trusted synthetic verification permits PASS", async () => {
  const h = harness();
  const result = await runAgent(h.input);
  assert.equal(result.verdict, "PASS");
  assert.equal(result.evidenceKind, "synthetic");
  assert.equal(h.model.calls.length, 1);
  assert.equal(h.writes.length, 1);
  assert.equal(h.verification.calls, 1);
  assert.equal(result.totalModelSpendUsd, null);
  const usage = result.events.find(
    (event) => event.type === "model-usage",
  ).usage;
  assert.equal(usage.inputTokens, null);
  assert.equal(usage.estimatedCostUsd, null);
  assertJournal(result, [
    "CREATED",
    "ANALYZING",
    "PLANNING",
    "GENERATING",
    "VERIFYING",
    "PASS",
  ]);
});

test("proven failure -> bounded repair -> fresh trusted verification", async () => {
  const h = harness({}, ["FAIL", "PASS"]);
  const result = await runAgent(h.input);
  assert.equal(result.verdict, "PASS");
  assert.deepEqual(
    h.model.calls.map((call) => call.action),
    ["generate", "repair"],
  );
  assert.equal(result.repairsByUnit["unit-1"], 1);
  assert.equal(
    h.model.calls[1].repairFeedback,
    "Synthetic public repair requested",
  );
  assertJournal(result, [
    "CREATED",
    "ANALYZING",
    "PLANNING",
    "GENERATING",
    "VERIFYING",
    "REPAIRING",
    "VERIFYING",
    "PASS",
  ]);
});

test("cascade escalates after repair exhaustion and does not reset repair count", async () => {
  const h = harness({ strategy: "cascade" }, ["FAIL", "FAIL", "PASS"]);
  const result = await runAgent(h.input);
  assert.equal(result.verdict, "PASS");
  assert.deepEqual(
    h.model.calls.map((call) => [call.tier, call.action]),
    [
      ["spark", "generate"],
      ["spark", "repair"],
      ["wonder", "escalate"],
    ],
  );
  assert.equal(result.escalations, 1);
  assert.equal(result.repairsByUnit["unit-1"], 1);
  assertJournal(result);
});

test("cascade fallback terminates FAIL when wonder also fails", async () => {
  const h = harness({ strategy: "cascade" }, ["FAIL", "FAIL", "FAIL"]);
  const result = await runAgent(h.input);
  assert.equal(result.verdict, "FAIL");
  assert.equal(h.model.calls.length, 3);
  assert.equal(result.reason, "REPAIR_AND_ESCALATION_LIMIT");
  assertJournal(result);
});

test("single-tier and zero escalation policies cannot silently upgrade", async () => {
  for (const strategy of ["spark-only", "wonder-only", "cascade"]) {
    const h = harness({ strategy, maxRepairsPerUnit: 0, maxEscalations: 0 }, [
      "FAIL",
    ]);
    const result = await runAgent(h.input);
    assert.equal(result.verdict, "FAIL");
    assert.equal(result.escalations, 0);
    assert.equal(h.model.calls.length, 1);
    assert.equal(
      h.model.calls[0].tier,
      strategy === "wonder-only" ? "wonder" : "spark",
    );
  }
});

test("zero budget and unknown paid bound block provider and writer", async () => {
  for (const mode of ["zero", "unknown-bound", "meta"]) {
    const h = harness(mode === "zero" ? { maxModelSpendUsd: 0 } : {});
    if (mode === "unknown-bound") paid(h, [], null);
    if (mode === "meta") h.input.provider = createUnconfiguredMetaProvider();
    const result = await runAgent(h.input);
    assert.equal(result.verdict, "INCONCLUSIVE");
    assert.equal(h.model.calls.length, 0);
    assert.equal(h.writes.length, 0);
    assert.equal(h.verification.calls, 0);
    assert.equal(result.attempts.length, 0);
    assertJournal(result);
  }
});

test("paid reservation prevents calls exceeding remaining budget", async () => {
  const h = harness({ maxModelSpendUsd: 0.5 }, ["FAIL"]);
  paid(h, [0.3]);
  const result = await runAgent(h.input);
  assert.equal(result.reason, "SPEND_LIMIT");
  assert.equal(result.verdict, "INCONCLUSIVE");
  assert.equal(h.model.calls.length, 1);
  assert.equal(result.knownModelSpendUsd, 0.3);
  assert.equal(result.totalModelSpendUsd, 0.3);
});

test("unknown paid usage is preserved and stops before writing/verifying", async () => {
  const h = harness();
  paid(h, [null]);
  const result = await runAgent(h.input);
  assert.equal(result.reason, "UNKNOWN_PAID_USAGE");
  assert.equal(result.totalModelSpendUsd, null);
  assert.equal(h.writes.length, 0);
  assert.equal(h.verification.calls, 0);
});

test("low estimates never release the guaranteed request cost reservations", async () => {
  const h = harness({ maxRepairsPerUnit: 4 }, ["FAIL", "FAIL"]);
  paid(h, [0.05, 0.05]);
  const result = await runAgent(h.input);
  assert.equal(result.reason, "SPEND_LIMIT");
  assert.equal(h.model.calls.length, 2);
  assert.equal(result.reservedModelSpendUsd, 0.8);
  assert.equal(result.knownModelSpendUsd, 0.1);
  assert.equal(result.totalModelSpendUsd, 0.1);
});

test("paid bound breach stops before candidate write", async () => {
  const h = harness();
  paid(h, [0.6]);
  const result = await runAgent(h.input);
  assert.equal(result.verdict, "ERROR");
  assert.equal(result.reason, "COST_BOUND_VIOLATION");
  assert.equal(result.knownModelSpendUsd, 0.6);
  assert.equal(h.writes.length, 0);
});

test("provider exception is ERROR with unknown paid spend and redacted reason", async () => {
  const h = harness();
  paid(h, []);
  h.input.provider.generate = async () => {
    throw new Error("SECRET_CREDENTIAL");
  };
  const result = await runAgent(h.input);
  assert.equal(result.verdict, "ERROR");
  assert.equal(result.totalModelSpendUsd, null);
  assert.equal(h.writes.length, 0);
  assert.ok(!JSON.stringify(result).includes("SECRET_CREDENTIAL"));
});

test("provider cannot submit its own PASS or invalid receipt", async () => {
  for (const field of ["verdict", "usage"]) {
    const h = harness();
    const generate = h.input.provider.generate;
    h.input.provider.generate = async (...args) => {
      const response = await generate(...args);
      if (field === "verdict") response.verdict = "PASS";
      else response.usage.inputTokens = -1;
      return response;
    };
    const result = await runAgent(h.input);
    assert.equal(result.verdict, "ERROR");
    assert.equal(h.writes.length, 0);
    assert.equal(h.verification.calls, 0);
    assert.ok(!result.events.some((event) => event.type === "gate-result"));
  }
});

test("missing/partial/duplicate/invalid verifier evidence never becomes PASS", async () => {
  const reports = [
    undefined,
    { verdict: "PASS" },
    { ...syntheticReport("PASS"), results: [] },
    {
      ...syntheticReport("PASS"),
      results: syntheticReport("PASS").results.slice(0, 1),
    },
    { ...syntheticReport("PASS"), executedScenarioIds: [] },
    {
      ...syntheticReport("PASS"),
      executedScenarioIds: ["scenario-1", "scenario-1"],
    },
    {
      ...syntheticReport("PASS"),
      results: Array(5).fill(syntheticReport("PASS").results[0]),
    },
    {
      ...syntheticReport("PASS"),
      results: [
        {
          gate: "G1",
          verdict: "PASS",
          executedTestIds: [],
          findings: [],
          evidencePaths: [],
        },
      ],
    },
  ];
  for (const report of reports) {
    const h = harness();
    setReport(h, report);
    const result = await runAgent(h.input);
    assert.ok(["ERROR", "INCONCLUSIVE"].includes(result.verdict));
    assert.equal(h.model.calls.length, 1);
    assertJournal(result);
  }
});

test("ERROR and INCONCLUSIVE verification stop without repair", async () => {
  for (const verdict of ["ERROR", "INCONCLUSIVE"]) {
    const h = harness({}, [verdict]);
    const result = await runAgent(h.input);
    assert.equal(result.verdict, verdict);
    assert.equal(h.model.calls.length, 1);
  }
});

test("raw verifier findings and private coverage never enter model repair context", async () => {
  const h = harness({}, ["FAIL", "PASS"]);
  let calls = 0;
  h.input.verifier.verify = async () => {
    const report = syntheticReport(calls++ ? "PASS" : "FAIL", [
      "scenario-1",
      "private-id",
    ]);
    report.results[0].findings = [
      { code: "PUBLIC_CODE", message: "RAW_FINDING" },
    ];
    report.repairFeedback = "public summary";
    return report;
  };
  assert.equal((await runAgent(h.input)).verdict, "PASS");
  const requests = JSON.stringify(h.model.calls);
  assert.ok(!requests.includes("RAW_FINDING"));
  assert.ok(!requests.includes("private-id"));
  assert.equal(h.model.calls[1].repairFeedback, "public summary");
});

test("all units are generated before whole-candidate verification; no stale PASS", async () => {
  const h = harness({ maxRepairsPerUnit: 0 }, ["PASS"], ["unit-1", "unit-2"]);
  h.input.verifier.verify = async () => {
    assert.equal(h.writes.length, 2);
    assert.equal(h.model.calls.length, 2);
    return syntheticReport("FAIL");
  };
  const result = await runAgent(h.input);
  assert.equal(result.verdict, "FAIL");
  assert.deepEqual(
    result.attempts.map((call) => call.unitId),
    ["unit-1", "unit-2"],
  );
});

test("repair caps are per unit and escalation cap is global", async () => {
  const h = harness({ strategy: "cascade" }, Array(6).fill("FAIL"), [
    "unit-1",
    "unit-2",
  ]);
  const result = await runAgent(h.input);
  assert.equal(result.verdict, "FAIL");
  assert.equal(h.model.calls.length, 5);
  assert.deepEqual(result.repairsByUnit, { "unit-1": 1, "unit-2": 1 });
  assert.equal(result.escalations, 1);
  assert.deepEqual(
    result.attempts.map((call) => call.action),
    ["generate", "generate", "repair", "repair", "escalate"],
  );
});

test("deadline aborts provider and verifier, rejects late responses without writes", async () => {
  await Promise.all(
    ["provider", "verifier"].map(async (phase) => {
      const h = harness({ timeoutSeconds: 1 });
      let observedSignal;
      if (phase === "provider") {
        paid(h, [0.1]);
        const generate = h.input.provider.generate;
        h.input.provider.generate = async (request, signal) => {
          observedSignal = signal;
          await delay(1150);
          return generate(request, new AbortController().signal);
        };
      } else {
        h.input.verifier.verify = async (_root, signal) => {
          observedSignal = signal;
          await delay(1150);
          return syntheticReport("PASS");
        };
      }
      const result = await runAgent(h.input);
      const journal = JSON.stringify(result.events);
      assert.equal(result.verdict, "ERROR");
      assert.equal(result.reason, "TIMEOUT");
      assert.equal(observedSignal.aborted, true);
      if (phase === "provider") assert.equal(result.totalModelSpendUsd, null);
      await delay(200);
      assert.equal(JSON.stringify(result.events), journal);
      assert.equal(h.writes.length, phase === "provider" ? 0 : 1);
      assertJournal(result);
    }),
  );
});

test("caller cancellation covers a stalled writer and pre-aborted run", async () => {
  const h = harness();
  const controller = new AbortController();
  h.input.signal = controller.signal;
  h.input.writer.write = async (_changes, signal) => {
    controller.abort();
    assert.equal(signal.aborted, true);
    return new Promise(() => {});
  };
  const result = await runAgent(h.input);
  assert.equal(result.reason, "CANCELLED");
  assert.equal(h.verification.calls, 0);
  const before = harness();
  before.input.signal = controller.signal;
  assert.equal((await runAgent(before.input)).reason, "CANCELLED");
  assert.equal(before.model.calls.length, 0);
});

test("writer/verifier exceptions are terminal ERROR without retries", async () => {
  for (const phase of ["writer", "verifier"]) {
    const h = harness();
    h.input[phase][phase === "writer" ? "write" : "verify"] = async () => {
      throw new Error("PRIVATE_ADAPTER_ERROR");
    };
    const result = await runAgent(h.input);
    assert.equal(result.verdict, "ERROR");
    assert.equal(h.model.calls.length, 1);
    assert.ok(!JSON.stringify(result).includes("PRIVATE_ADAPTER_ERROR"));
  }
});

test("invalid configuration rejects before any provider/writer call", async () => {
  for (const overrides of [
    { timeoutSeconds: 0 },
    { maxRepairsPerUnit: -1 },
    { extra: true },
  ]) {
    const h = harness(overrides);
    await assert.rejects(runAgent(h.input));
    assert.equal(h.model.calls.length, 0);
    assert.equal(h.writes.length, 0);
  }
  const h = harness();
  h.input.benchmark.id = "different";
  await assert.rejects(runAgent(h.input), /BENCHMARK_ID_MISMATCH/);
});
