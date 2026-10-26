import { performance } from "node:perf_hooks";
import {
  BenchmarkDefinitionSchema,
  GateSchema,
  RunConfigSchema,
  RunEventSchema,
  type Verdict,
} from "@metamorph/contracts";
import {
  type CandidateWriter,
  type ModelProvider,
  type ModelRequest,
  ModelResponseSchema,
  type RunResult,
  type State,
  type Tier,
  type VerificationReport,
  VerificationReportSchema,
  type Verifier,
} from "./ports.js";

const transitions: Partial<Record<State, readonly State[]>> = {
  CREATED: ["ANALYZING"],
  ANALYZING: ["PLANNING"],
  PLANNING: ["GENERATING"],
  GENERATING: ["GENERATING", "VERIFYING"],
  VERIFYING: ["REPAIRING", "PASS", "FAIL", "INCONCLUSIVE"],
  REPAIRING: ["VERIFYING"],
};

class Stop extends Error {
  constructor(
    readonly verdict: Verdict,
    readonly code: string,
  ) {
    super(code);
  }
}

function evaluate(report: VerificationReport, scenarios: readonly string[]) {
  const byGate = new Map(report.results.map((result) => [result.gate, result]));
  if (byGate.size !== report.results.length) {
    throw new Stop("ERROR", "DUPLICATE_GATE_RESULTS");
  }
  if (report.results.some((result) => result.verdict === "ERROR"))
    return "ERROR";
  if (report.results.some((result) => result.verdict === "FAIL")) return "FAIL";
  if (
    GateSchema.options.some((gate) => byGate.get(gate)?.verdict !== "PASS") ||
    new Set(report.executedScenarioIds).size !==
      report.executedScenarioIds.length ||
    scenarios.some((id) => !report.executedScenarioIds.includes(id))
  ) {
    return "INCONCLUSIVE";
  }
  return "PASS";
}

export interface RunInput {
  readonly runId: string;
  readonly config: unknown;
  readonly benchmark: unknown;
  readonly provider: ModelProvider;
  readonly writer: CandidateWriter;
  readonly verifier: Verifier;
  readonly signal?: AbortSignal;
}

export async function runAgent(input: RunInput): Promise<RunResult> {
  // Invalid caller input rejects before any effect, rather than inventing a run.
  const config = RunConfigSchema.parse(input.config);
  const benchmark = BenchmarkDefinitionSchema.parse(input.benchmark);
  if (config.benchmarkId !== benchmark.id)
    throw new Error("BENCHMARK_ID_MISMATCH");
  const events: RunResult["events"][number][] = [];
  const attempts: ModelRequest[] = [];
  const repairs = new Map(benchmark.migrationUnitIds.map((id) => [id, 0]));
  const tiers = new Map<string, Tier>(
    benchmark.migrationUnitIds.map((id) => [
      id,
      config.strategy === "wonder-only" ? "wonder" : "spark",
    ]),
  );
  let state: State = "CREATED";
  let escalations = 0;
  let knownSpend = 0;
  let reservedSpend = 0;
  let unknownSpend = false;
  let pendingPaidRequest = false;
  const controller = new AbortController();
  const deadline = performance.now() + config.timeoutSeconds * 1000;
  const cancel = () => controller.abort();
  // Node timers cap at 2^31-1 ms; re-arm long deadlines rather than firing early.
  function armTimeout(): ReturnType<typeof setTimeout> {
    return setTimeout(
      () => {
        if (performance.now() >= deadline) cancel();
        else timer = armTimeout();
      },
      Math.min(Math.max(deadline - performance.now(), 1), 2 ** 31 - 1),
    );
  }
  let timer = armTimeout();
  input.signal?.addEventListener("abort", cancel, { once: true });
  if (input.signal?.aborted) cancel();

  function emit(event: object) {
    events.push(
      RunEventSchema.parse({
        runId: input.runId,
        timestamp: new Date().toISOString(),
        ...event,
      }),
    );
  }
  function move(next: State) {
    if (
      next !== "ERROR" &&
      next !== "INCONCLUSIVE" &&
      !transitions[state]?.includes(next)
    ) {
      throw new Error("INVALID_STATE_TRANSITION");
    }
    state = next;
    emit({ type: "run-state-changed", state });
  }
  function checkDeadline() {
    if (performance.now() >= deadline) {
      controller.abort();
      throw new Stop("ERROR", "TIMEOUT");
    }
    if (controller.signal.aborted) {
      throw new Stop("ERROR", input.signal?.aborted ? "CANCELLED" : "TIMEOUT");
    }
  }
  async function bounded<T>(operation: () => Promise<T>): Promise<T> {
    checkDeadline();
    let onAbort: () => void = () => {};
    const aborted = new Promise<never>((_, reject) => {
      onAbort = () =>
        reject(
          new Stop("ERROR", input.signal?.aborted ? "CANCELLED" : "TIMEOUT"),
        );
      controller.signal.addEventListener("abort", onAbort, { once: true });
    });
    try {
      const value = await Promise.race([operation(), aborted]);
      checkDeadline();
      return value;
    } finally {
      controller.signal.removeEventListener("abort", onAbort);
    }
  }

  async function generate(
    unitId: string,
    action: ModelRequest["action"],
    feedback: string | null,
  ) {
    checkDeadline();
    const bound = input.provider.maxRequestCostUsd;
    if (config.maxModelSpendUsd === 0)
      throw new Stop("INCONCLUSIVE", "ZERO_BUDGET");
    if (bound === null || !Number.isFinite(bound) || bound < 0) {
      throw new Stop("INCONCLUSIVE", "UNKNOWN_REQUEST_COST_BOUND");
    }
    if (bound > config.maxModelSpendUsd - reservedSpend) {
      throw new Stop("INCONCLUSIVE", "SPEND_LIMIT");
    }
    const request: ModelRequest = {
      unitId,
      tier: tiers.get(unitId) ?? "spark",
      action,
      attempt:
        attempts.filter((attempt) => attempt.unitId === unitId).length + 1,
      repairFeedback: feedback,
    };
    attempts.push(request);
    if (action === "repair")
      repairs.set(unitId, (repairs.get(unitId) ?? 0) + 1);
    if (action === "escalate") escalations++;
    // Keep the full reservation: estimatedCostUsd is not an actual billing receipt.
    reservedSpend += bound;
    pendingPaidRequest = input.provider.billing === "paid";
    const response = ModelResponseSchema.parse(
      await bounded(() => input.provider.generate(request, controller.signal)),
    );
    emit({ type: "model-usage", usage: response.usage });
    const cost = response.usage.estimatedCostUsd;
    pendingPaidRequest = false;
    if (cost === null) {
      unknownSpend = true;
      if (input.provider.billing === "paid") {
        throw new Stop("INCONCLUSIVE", "UNKNOWN_PAID_USAGE");
      }
    } else {
      knownSpend += cost;
      if (cost > bound || knownSpend > config.maxModelSpendUsd) {
        throw new Stop("ERROR", "COST_BOUND_VIOLATION");
      }
    }
    await bounded(() =>
      input.writer.write(response.changes, controller.signal),
    );
  }

  function finish(verdict: Verdict, reason: string): RunResult {
    if (verdict === "PASS") checkDeadline();
    move(verdict);
    return {
      verdict,
      reason,
      evidenceKind: input.verifier.evidenceKind,
      events,
      attempts,
      repairsByUnit: Object.fromEntries(repairs),
      escalations,
      knownModelSpendUsd: knownSpend,
      totalModelSpendUsd:
        unknownSpend || pendingPaidRequest ? null : knownSpend,
      reservedModelSpendUsd: reservedSpend,
    };
  }

  try {
    emit({ type: "run-state-changed", state });
    checkDeadline();
    move("ANALYZING");
    move("PLANNING");
    for (const unitId of benchmark.migrationUnitIds) {
      move("GENERATING");
      await generate(unitId, "generate", null);
    }
    while (true) {
      move("VERIFYING");
      const report = VerificationReportSchema.parse(
        await bounded(() =>
          input.verifier.verify(input.writer.root, controller.signal),
        ),
      );
      for (const result of report.results)
        emit({ type: "gate-result", result });
      const verdict = evaluate(report, benchmark.scenarioIds);
      checkDeadline();
      if (verdict !== "FAIL") return finish(verdict, `VERIFIER_${verdict}`);
      const repairUnit = benchmark.migrationUnitIds.find(
        (unitId) => (repairs.get(unitId) ?? 0) < config.maxRepairsPerUnit,
      );
      if (repairUnit !== undefined) {
        move("REPAIRING");
        await generate(repairUnit, "repair", report.repairFeedback);
        continue;
      }
      const escalateUnit = benchmark.migrationUnitIds.find(
        (unitId) => tiers.get(unitId) === "spark",
      );
      if (
        config.strategy === "cascade" &&
        escalations < config.maxEscalations &&
        escalateUnit !== undefined
      ) {
        tiers.set(escalateUnit, "wonder");
        move("REPAIRING");
        await generate(escalateUnit, "escalate", report.repairFeedback);
        continue;
      }
      return finish("FAIL", "REPAIR_AND_ESCALATION_LIMIT");
    }
  } catch (error) {
    // Do not leak adapter exception text (credentials, held-out outputs, etc.).
    if (error instanceof Stop) return finish(error.verdict, error.code);
    return finish("ERROR", "PORT_OR_RESPONSE_ERROR");
  } finally {
    clearTimeout(timer);
    input.signal?.removeEventListener("abort", cancel);
    controller.abort();
  }
}
