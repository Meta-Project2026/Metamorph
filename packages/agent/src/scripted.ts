import { performance } from "node:perf_hooks";
import { GateSchema, type Verdict } from "@metamorph/contracts";
import type {
  ModelProvider,
  ModelRequest,
  VerificationReport,
  Verifier,
} from "./ports.js";

// These adapters neither execute generated text nor inspect real Oracle evidence.
export function scriptedProvider() {
  const calls: ModelRequest[] = [];
  const provider: ModelProvider = {
    billing: "synthetic",
    maxRequestCostUsd: 0,
    async generate(request, signal) {
      const started = performance.now();
      signal.throwIfAborted();
      calls.push({ ...request });
      return {
        changes: [
          { path: "src/candidate.ts", content: "export const demo = true;\n" },
        ],
        usage: {
          requestId: `synthetic-${calls.length}`,
          provider: "synthetic-script",
          modelId: `policy-${request.tier}`,
          inputTokens: null,
          outputTokens: null,
          cachedInputTokens: null,
          estimatedCostUsd: null,
          durationMs: performance.now() - started,
        },
      };
    },
  };
  return { provider, calls };
}

export function syntheticReport(
  verdict: Verdict,
  scenarioIds: readonly string[] = ["scenario-1"],
): VerificationReport {
  return {
    results: GateSchema.options.map((gate) => ({
      gate,
      verdict,
      executedTestIds: [`synthetic-${gate}`],
      findings:
        verdict === "PASS"
          ? []
          : [
              {
                code: "SYNTHETIC_RESULT",
                message: "Scripted synthetic outcome",
              },
            ],
      // Labels for simulated references, not claims of existing Oracle artifacts.
      evidencePaths: [`synthetic/${gate}.json`],
    })),
    executedScenarioIds: [...scenarioIds],
    repairFeedback:
      verdict === "FAIL" ? "Synthetic public repair requested" : null,
  };
}

export function scriptedVerifier(
  verdicts: readonly Verdict[],
  scenarioIds: readonly string[] = ["scenario-1"],
) {
  let calls = 0;
  const verifier: Verifier = {
    evidenceKind: "synthetic",
    async verify(_root, signal) {
      signal.throwIfAborted();
      const verdict = verdicts[calls++];
      if (verdict === undefined) throw new Error("SYNTHETIC_SCRIPT_EXHAUSTED");
      return syntheticReport(verdict, scenarioIds);
    },
  };
  return {
    verifier,
    get calls() {
      return calls;
    },
  };
}
