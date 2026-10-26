import { z } from "zod";

const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const text = z
  .string()
  .refine((value) => value.trim().length > 0, "Must not be blank");
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const amount = z.number().finite().nonnegative();
const uniqueIds = z
  .array(identifier)
  .refine((ids) => new Set(ids).size === ids.length, "Duplicate IDs");
const evidencePath = z
  .string()
  .refine(
    (value) =>
      /^[A-Za-z0-9._/-]+$/.test(value) &&
      value
        .split("/")
        .every((part) => part !== "" && part !== "." && part !== ".."),
    "Use a relative POSIX path without traversal",
  );

export const VerdictSchema = z.enum(["PASS", "FAIL", "INCONCLUSIVE", "ERROR"]);
export type Verdict = z.infer<typeof VerdictSchema>;

export const GateSchema = z.enum(["G0", "G1", "G2", "G3", "G4"]);
export type Gate = z.infer<typeof GateSchema>;

export const BenchmarkDefinitionSchema = z.strictObject({
  id: identifier,
  sourceRepo: z.url({ protocol: /^https$/ }),
  sourceCommit: z.string().regex(/^(?:[a-fA-F0-9]{40}|[a-fA-F0-9]{64})$/),
  license: text,
  phpRuntime: text,
  scenarioIds: uniqueIds.refine((ids) => ids.length > 0, "Scenarios required"),
  migrationUnitIds: uniqueIds.refine(
    (ids) => ids.length > 0,
    "Migration units required",
  ),
  normalizationVersion: text,
});
export type BenchmarkDefinition = z.infer<typeof BenchmarkDefinitionSchema>;

export const RunConfigSchema = z.strictObject({
  benchmarkId: identifier,
  strategy: z.enum(["spark-only", "wonder-only", "cascade"]),
  maxRepairsPerUnit: count,
  maxEscalations: count,
  maxModelSpendUsd: amount,
  timeoutSeconds: count.positive(),
});
export type RunConfig = z.infer<typeof RunConfigSchema>;

export const GateResultSchema = z
  .strictObject({
    gate: GateSchema,
    verdict: VerdictSchema,
    executedTestIds: uniqueIds,
    findings: z.array(
      z.strictObject({
        code: identifier,
        message: text,
        scenarioId: identifier.optional(),
      }),
    ),
    evidencePaths: z.array(evidencePath),
  })
  .superRefine((result, context) => {
    if (result.verdict === "PASS" || result.verdict === "FAIL") {
      if (result.executedTestIds.length === 0) {
        context.addIssue({
          code: "custom",
          path: ["executedTestIds"],
          message: "PASS/FAIL requires executed tests",
        });
      }
      if (result.evidencePaths.length === 0) {
        context.addIssue({
          code: "custom",
          path: ["evidencePaths"],
          message: "PASS/FAIL requires evidence references",
        });
      }
    }
    if (result.verdict !== "PASS" && result.findings.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["findings"],
        message: "A non-PASS result requires a reason",
      });
    }
  });
export type GateResult = z.infer<typeof GateResultSchema>;

export const ModelUsageSchema = z
  .strictObject({
    requestId: identifier,
    provider: text,
    modelId: text,
    inputTokens: count.nullable(),
    outputTokens: count.nullable(),
    cachedInputTokens: count.nullable(),
    estimatedCostUsd: amount.nullable(),
    durationMs: amount,
  })
  .refine(
    (usage) =>
      usage.cachedInputTokens === null ||
      usage.inputTokens === null ||
      usage.cachedInputTokens <= usage.inputTokens,
    {
      path: ["cachedInputTokens"],
      message: "Cached input cannot exceed total input tokens",
    },
  );
export type ModelUsage = z.infer<typeof ModelUsageSchema>;

const eventBase = { runId: identifier, timestamp: z.iso.datetime() };
export const RunEventSchema = z.discriminatedUnion("type", [
  z.strictObject({
    ...eventBase,
    type: z.literal("run-state-changed"),
    state: z.enum([
      "CREATED",
      "BASELINE_READY",
      "ANALYZING",
      "PLANNING",
      "GENERATING",
      "VERIFYING",
      "REPAIRING",
      "PASS",
      "FAIL",
      "INCONCLUSIVE",
      "ERROR",
    ]),
  }),
  z.strictObject({
    ...eventBase,
    type: z.literal("gate-result"),
    result: GateResultSchema,
  }),
  z.strictObject({
    ...eventBase,
    type: z.literal("model-usage"),
    usage: ModelUsageSchema,
  }),
]);
export type RunEvent = z.infer<typeof RunEventSchema>;

export const HealthResponseSchema = z.strictObject({
  status: z.literal("ok"),
  service: z.literal("metamorph-server"),
  scope: z.literal("foundation"),
  capabilities: z.strictObject({
    migration: z.literal("not_implemented"),
    oracle: z.literal("not_implemented"),
    metaApi: z.literal("not_integrated"),
    benchmark: z.literal("undecided"),
  }),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
