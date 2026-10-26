import { runIntegrationDemo } from "./run.js";

const { root, manifest, result } = await runIntegrationDemo();
console.log(
  JSON.stringify(
    {
      ...manifest,
      attempts: manifest.attempts.map((a) => ({
        verificationAttempt: a.verificationAttempt,
        candidateSha256: a.candidateSha256,
        gates: Object.fromEntries(
          a.gateResults.map((g) => [g.gate, g.verdict]),
        ),
        executedScenarioIds: a.executedScenarioIds,
        evidenceDirectory: a.evidenceDirectory,
      })),
      evidenceRoot: root,
      repairs: result.repairsByUnit,
    },
    null,
    2,
  ),
);
if (
  result.verdict !== "INCONCLUSIVE" ||
  manifest.attempts.length !== 2 ||
  manifest.attempts[0]?.gateResults.find((g) => g.gate === "G3")?.verdict !==
    "FAIL" ||
  manifest.attempts[1]?.gateResults.find((g) => g.gate === "G3")?.verdict !==
    "PASS"
)
  process.exitCode = 1;
