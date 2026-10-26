import assert from "node:assert/strict";
import test from "node:test";
import {
  BenchmarkDefinitionSchema,
  GateResultSchema,
  GateSchema,
  ModelUsageSchema,
  RunConfigSchema,
  RunEventSchema,
  VerdictSchema,
} from "@metamorph/contracts";

// Synthetic schema fixtures only; these do not designate a real benchmark/run.
const config = {
  benchmarkId: "synthetic-fixture",
  strategy: "cascade",
  maxRepairsPerUnit: 2,
  maxEscalations: 1,
  maxModelSpendUsd: 0,
  timeoutSeconds: 60,
};
const result = {
  gate: "G2",
  verdict: "FAIL",
  executedTestIds: ["http-synthetic"],
  findings: [{ code: "HTTP_STATUS", message: "Synthetic status mismatch" }],
  evidencePaths: ["http/synthetic.json"],
};
const usage = {
  requestId: "synthetic-request",
  provider: "synthetic-provider",
  modelId: "unverified-model",
  inputTokens: null,
  outputTokens: null,
  cachedInputTokens: null,
  estimatedCostUsd: null,
  durationMs: 0,
};

test("RunConfig accepts explicit limits without adding defaults", () => {
  assert.deepEqual(RunConfigSchema.parse(config), config);
  for (const strategy of ["spark-only", "wonder-only", "cascade"]) {
    assert.equal(
      RunConfigSchema.parse({ ...config, strategy }).strategy,
      strategy,
    );
  }
});

test("RunConfig rejects unsafe limits, missing limits and unknown fields", () => {
  const { timeoutSeconds: _, ...missing } = config;
  for (const invalid of [
    missing,
    { ...config, maxRepairsPerUnit: -1 },
    { ...config, maxEscalations: 0.5 },
    { ...config, maxModelSpendUsd: -0.01 },
    { ...config, maxModelSpendUsd: Number.NaN },
    { ...config, maxModelSpendUsd: Number.POSITIVE_INFINITY },
    { ...config, timeoutSeconds: 0 },
    { ...config, timeoutSeconds: "60" },
    { ...config, strategy: "guessed-model" },
    { ...config, apiKey: "unexpected-field" },
  ]) {
    assert.equal(RunConfigSchema.safeParse(invalid).success, false);
  }
});

test("BenchmarkDefinition requires pinned revision and unique nonempty coverage", () => {
  const benchmark = {
    id: "synthetic-fixture",
    sourceRepo: "https://example.com/synthetic/repository",
    sourceCommit: "a".repeat(40),
    license: "MIT",
    phpRuntime: "7.4",
    scenarioIds: ["synthetic-stateful"],
    migrationUnitIds: ["synthetic-unit"],
    normalizationVersion: "synthetic-v1",
  };
  assert.deepEqual(BenchmarkDefinitionSchema.parse(benchmark), benchmark);
  for (const change of [
    { sourceCommit: "main" },
    { sourceRepo: "file:///host/source" },
    { scenarioIds: [] },
    { scenarioIds: ["duplicate", "duplicate"] },
    { migrationUnitIds: [] },
    { license: " " },
  ]) {
    assert.equal(
      BenchmarkDefinitionSchema.safeParse({ ...benchmark, ...change }).success,
      false,
    );
  }
});

test("G0 through G4 stay distinct and verdicts exclude NOT_RUN/PENDING", () => {
  for (const gate of ["G0", "G1", "G2", "G3", "G4"]) {
    assert.equal(GateResultSchema.parse({ ...result, gate }).gate, gate);
  }
  assert.equal(GateSchema.safeParse("G5").success, false);
  for (const verdict of ["PASS", "FAIL", "INCONCLUSIVE", "ERROR"]) {
    assert.equal(VerdictSchema.parse(verdict), verdict);
  }
  for (const verdict of ["NOT_RUN", "PENDING", "BUILD_PASS"]) {
    assert.equal(VerdictSchema.safeParse(verdict).success, false);
  }
});

test("GateResult requires evidence for PASS/FAIL and a reason for other outcomes", () => {
  assert.deepEqual(GateResultSchema.parse(result), result);
  assert.equal(
    GateResultSchema.safeParse({ ...result, verdict: "PASS", findings: [] })
      .success,
    true,
  );
  for (const verdict of ["PASS", "FAIL"]) {
    for (const change of [{ executedTestIds: [] }, { evidencePaths: [] }]) {
      assert.equal(
        GateResultSchema.safeParse({ ...result, verdict, ...change }).success,
        false,
      );
    }
  }
  for (const verdict of ["FAIL", "INCONCLUSIVE", "ERROR"]) {
    assert.equal(
      GateResultSchema.safeParse({ ...result, verdict, findings: [] }).success,
      false,
    );
  }
  for (const verdict of ["INCONCLUSIVE", "ERROR"]) {
    assert.equal(
      GateResultSchema.safeParse({
        ...result,
        verdict,
        executedTestIds: [],
        evidencePaths: [],
      }).success,
      true,
    );
  }
});

test("GateResult rejects duplicate execution IDs and unsafe evidence paths", () => {
  assert.equal(
    GateResultSchema.safeParse({ ...result, executedTestIds: ["same", "same"] })
      .success,
    false,
  );
  for (const path of [
    "../private.json",
    "/absolute.json",
    "C:/host/file",
    "http/../private",
    "http\\file",
    "http//file",
  ]) {
    assert.equal(
      GateResultSchema.safeParse({ ...result, evidencePaths: [path] }).success,
      false,
    );
  }
});

test("ModelUsage preserves unknowns as null and validates numerical receipts", () => {
  assert.deepEqual(ModelUsageSchema.parse(usage), usage);
  const measured = {
    ...usage,
    inputTokens: 10,
    outputTokens: 3,
    cachedInputTokens: 5,
    estimatedCostUsd: 0.001,
    durationMs: 12,
  };
  assert.deepEqual(ModelUsageSchema.parse(measured), measured);
  for (const change of [
    { inputTokens: -1 },
    { outputTokens: 0.1 },
    { cachedInputTokens: 11 },
    { estimatedCostUsd: -1 },
    { durationMs: Number.POSITIVE_INFINITY },
  ]) {
    assert.equal(
      ModelUsageSchema.safeParse({ ...measured, ...change }).success,
      false,
    );
  }
  const { inputTokens: _, ...missing } = usage;
  assert.equal(ModelUsageSchema.safeParse(missing).success, false);
});

test("RunEvent validates its discriminator, timestamp and nested payload", () => {
  const base = {
    runId: "synthetic-run",
    timestamp: "2026-10-26T12:00:00.000Z",
  };
  for (const payload of [
    { type: "run-state-changed", state: "CREATED" },
    { type: "gate-result", result },
    { type: "model-usage", usage },
  ]) {
    const event = { ...base, ...payload };
    assert.deepEqual(RunEventSchema.parse(event), event);
  }
  for (const invalid of [
    { ...base, type: "unknown" },
    {
      ...base,
      type: "gate-result",
      result: { ...result, verdict: "PASS", executedTestIds: [] },
    },
    {
      ...base,
      type: "run-state-changed",
      state: "CREATED",
      timestamp: "yesterday",
    },
    { ...base, type: "run-state-changed", state: "CREATED", usage },
  ]) {
    assert.equal(RunEventSchema.safeParse(invalid).success, false);
  }
});
