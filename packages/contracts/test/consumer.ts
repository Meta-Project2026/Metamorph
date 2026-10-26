import {
  type BenchmarkDefinition,
  BenchmarkDefinitionSchema,
  type Gate,
  type GateResult,
  GateResultSchema,
  GateSchema,
  type ModelUsage,
  ModelUsageSchema,
  type RunConfig,
  RunConfigSchema,
  type RunEvent,
  RunEventSchema,
  type Verdict,
  VerdictSchema,
} from "@metamorph/contracts";

// Compile against the package's public declarations rather than a source alias.
export function parseBoundary(input: unknown) {
  const benchmark: BenchmarkDefinition = BenchmarkDefinitionSchema.parse(input);
  const config: RunConfig = RunConfigSchema.parse(input);
  const result: GateResult = GateResultSchema.parse(input);
  const usage: ModelUsage = ModelUsageSchema.parse(input);
  const event: RunEvent = RunEventSchema.parse(input);
  const gate: Gate = GateSchema.parse(input);
  const verdict: Verdict = VerdictSchema.parse(input);
  return { benchmark, config, result, usage, event, gate, verdict };
}

// @ts-expect-error G5 is not an Oracle gate.
const invalidGate: Gate = "G5";
// @ts-expect-error Build success is not a verdict.
const invalidVerdict: Verdict = "BUILT";
void invalidGate;
void invalidVerdict;
