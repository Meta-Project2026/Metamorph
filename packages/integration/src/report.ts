import {
  type VerificationReport,
  VerificationReportSchema,
} from "@metamorph/agent";
import { type GateResult, GateResultSchema } from "@metamorph/contracts";
import type { PublicScenario } from "@metamorph/oracle";

export function checkedGates(value: unknown): GateResult[] {
  if (!Array.isArray(value)) throw new Error("INVALID_GATES");
  const gates = value.map((entry) => GateResultSchema.parse(entry));
  if (
    gates.length !== 3 ||
    ["G2", "G3", "G4"].some(
      (id) => gates.filter((g) => g.gate === id).length !== 1,
    )
  ) {
    throw new Error("INVALID_GATE_SET");
  }
  // This integration cannot establish held-out isolation.
  if (gates.find((g) => g.gate === "G4")?.verdict === "PASS")
    throw new Error("UNSUPPORTED_G4_PASS");
  return gates;
}

export function mapCoverage(
  value: unknown,
  scenarios: readonly PublicScenario[],
): string[] {
  const gates = checkedGates(value);
  if (
    !scenarios.length ||
    new Set(scenarios.map((s) => s.id)).size !== scenarios.length ||
    scenarios.some((s) => !s.requests.length)
  )
    throw new Error("INVALID_CORPUS");
  const g2 = new Set(gates.find((g) => g.gate === "G2")?.executedTestIds);
  const g3 = new Set(gates.find((g) => g.gate === "G3")?.executedTestIds);
  const httpIds = new Set(
    scenarios.flatMap((s) => s.requests.map((_, i) => `${s.id}:step-${i}`)),
  );
  const dbIds = new Set([
    ...httpIds,
    ...scenarios.map((s) => `${s.id}:initial`),
  ]);
  if (
    [...g2].some((id) => !httpIds.has(id)) ||
    [...g3].some((id) => !dbIds.has(id))
  )
    throw new Error("UNKNOWN_EXECUTION_ID");
  return scenarios
    .filter(
      (s) =>
        g3.has(`${s.id}:initial`) &&
        s.requests.every(
          (_, i) => g2.has(`${s.id}:step-${i}`) && g3.has(`${s.id}:step-${i}`),
        ),
    )
    .map((s) => s.id);
}

const allowed = new Set([
  "HTTP_STATUS",
  "HTTP_JSON_TYPE",
  "HTTP_JSON_VALUE",
  "DB_STATE",
]);
export function publicFeedback(
  gates: readonly GateResult[],
  scenarios: readonly PublicScenario[],
): string | null {
  const ids = new Set(scenarios.map((s) => s.id));
  const entries = gates
    .filter((g) => g.verdict === "FAIL")
    .flatMap((g) => g.findings)
    .filter(
      (f) =>
        allowed.has(f.code) &&
        f.scenarioId !== undefined &&
        ids.has(f.scenarioId),
    )
    .map((f) => ({ code: f.code, scenarioId: f.scenarioId }));
  if (!entries.length) return null;
  const unique = [...new Set(entries.map((e) => JSON.stringify(e)))].slice(
    0,
    4,
  );
  // Never truncate a raw finding or copy a value/path/message.
  const summary = `PUBLIC/SYNTHETIC ONLY ${JSON.stringify(unique.map((e) => JSON.parse(e)))}`;
  return summary.length <= 512 ? summary : "PUBLIC/SYNTHETIC ONLY: mismatch";
}

export function safeReport(
  gates: GateResult[],
  scenarios: readonly PublicScenario[],
): VerificationReport {
  return VerificationReportSchema.parse({
    results: gates.map((g) => ({
      ...g,
      findings: g.findings.map(() => ({
        code: "PUBLIC_GATE_FINDING",
        message:
          "Inspect trusted private evidence; public/synthetic scope only",
      })),
    })),
    executedScenarioIds: mapCoverage(gates, scenarios),
    repairFeedback: publicFeedback(gates, scenarios),
  });
}
