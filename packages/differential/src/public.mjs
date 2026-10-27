import { NORMALIZATION_VERSION, runControls, SOURCE } from "@metamorph/oracle";
import { BASE_SHA, PUBLIC_CANDIDATE_SHA, SCENARIOS } from "./policy.mjs";
import { fields, requireCheck } from "./strict.mjs";

export function publicSummary(input) {
  fields(
    input,
    [
      "headSha",
      "phpImage",
      "targetImage",
      "recipeSha",
      "phpPackSha",
      "bridgePackSha",
      "gates",
      "initialDiffs",
      "counts",
      "cleanup",
    ],
    "PUBLIC_FIELDS",
  );
  requireCheck(
    /^[a-f0-9]{40}$/.test(input.headSha) &&
      [input.phpImage, input.targetImage].every((v) =>
        /^sha256:[a-f0-9]{64}$/.test(v),
      ) &&
      [input.recipeSha, input.phpPackSha, input.bridgePackSha].every((v) =>
        /^[a-f0-9]{64}$/.test(v),
      ),
    "PUBLIC_HASH",
  );
  requireCheck(
    input.gates.length === 3 && input.cleanup === "VERIFIED_ZERO_RESOURCES",
    "PUBLIC_RESULT",
  );
  const controlIds = runControls().cases.map((entry) => entry.id);
  const codes = new Set([
    "DB_SCHEMA",
    "DB_STATE",
    "MISSING_COVERAGE",
    "HELD_OUT_NOT_RUN",
    "VERIFIER_ERROR",
    "CONTROL_FAILURE",
  ]);
  const gates = input.gates.map((gate, index) => {
    requireCheck(
      gate.gate === ["G2", "G3", "G4"][index] &&
        ["PASS", "FAIL", "INCONCLUSIVE", "ERROR"].includes(gate.verdict),
      "PUBLIC_GATE",
    );
    const allowed =
      gate.gate === "G4"
        ? controlIds
        : [
            "workshop-business:initial",
            ...SCENARIOS[0].requests.map(
              (_, i) => `workshop-business:step-${i}`,
            ),
          ];
    requireCheck(
      gate.executedTestIds.every((id) => allowed.includes(id)) &&
        new Set(gate.executedTestIds).size === gate.executedTestIds.length &&
        gate.findings.every((f) => codes.has(f.code)),
      "PUBLIC_GATE",
    );
    return {
      gate: gate.gate,
      verdict: gate.verdict,
      executedTestIds: [...gate.executedTestIds],
      findingCodes: [...new Set(gate.findings.map((f) => f.code))],
    };
  });
  fields(
    input.counts,
    [
      "phpBootstrap",
      "targetReadinessAttempts",
      "targetReadinessSuccesses",
      "targetResetsIncludingProvision",
      "targetOperations",
      "targetOracleSnapshots",
      "targetHttpRequests",
    ],
    "PUBLIC_COUNTS",
  );
  requireCheck(
    Object.values(input.counts).every(
      (n) => Number.isSafeInteger(n) && n >= 0 && n <= 128,
    ),
    "PUBLIC_COUNTS",
  );
  requireCheck(
    input.initialDiffs.every((d) => ["DB_SCHEMA", "DB_STATE"].includes(d.code)),
    "PUBLIC_DIFF",
  );
  return {
    format: "real-differential-public-v1",
    checkedOutSha: input.headSha,
    baseSha: BASE_SHA,
    scope:
      "real-car-workshop-php-versus-original-items-ts-incompatibility-pilot",
    php: {
      source: SOURCE,
      imageId: input.phpImage,
      version: "7.4.33",
      sqlite: "3.34.1",
    },
    target: {
      candidateSha: PUBLIC_CANDIDATE_SHA,
      imageId: input.targetImage,
      recipeSha: input.recipeSha,
      node: "24.11.0",
      sqlite: "3.50.4",
      typescript: "5.9.3",
      faketime: "0.9.10-2.1",
      fixture: "original-public-items-not-workshop",
    },
    clock: "VERIFIED_FIXED_WALL_REAL_MONOTONIC",
    fixedUtc: "2026-10-27 12:00:00",
    normalization: NORMALIZATION_VERSION,
    scenarioIds: ["workshop-business"],
    declaredHttpSteps: 6,
    initialStateComparison: gates[1].executedTestIds.includes(
      "workshop-business:initial",
    )
      ? "EXECUTED"
      : "NOT_RUN",
    initialDifferenceCodes: [...new Set(input.initialDiffs.map((d) => d.code))],
    httpDifferential:
      gates[0].executedTestIds.length === 0 && input.initialDiffs.length > 0
        ? "NOT_EXECUTED_AFTER_INITIAL_MISMATCH"
        : "SEE_ACTUAL_GATE_COVERAGE",
    comparisons: {
      http: gates[0].executedTestIds.length,
      db: gates[1].executedTestIds.length,
    },
    serviceObservations: { ...input.counts },
    gates,
    G0: "NOT_RUN",
    G1: "NOT_RUN",
    product: "NOT_ESTABLISHED",
    cleanup: input.cleanup,
    phpPackSha256: input.phpPackSha,
    bridgePackSha256: input.bridgePackSha,
    retention: "EVIDENCE_RETENTION_NOT_CONFIGURED",
    externalRetention: "EXTERNAL_RETENTION_NOT_RUN",
    otherScenarios: {
      "workshop-rejected": "NOT_RUN",
      "workshop-capacity": "NOT_RUN",
    },
    heldOut: "NOT_RUN",
    concurrency: "NOT_RUN",
    clockAdvanceDst: "NOT_RUN",
    registration: "NOT_APPROVED",
    targetStateLimit: "16MIB_INSPECTOR_ADMISSION_NOT_WRITE_QUOTA",
    hardStateQuotaAcceptance: "BLOCKED_TARGET_OWNER_API",
    ownerSignoff: "NOT_CLAIMED",
    modelCalls: "NOT_RUN",
  };
}
