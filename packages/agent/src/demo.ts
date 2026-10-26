import { tmpdir } from "node:os";
import { runAgent } from "./orchestrator.js";
import { scriptedProvider, scriptedVerifier } from "./scripted.js";
import { createCandidateWriter } from "./writer.js";

const writer = createCandidateWriter(tmpdir());
const { provider } = scriptedProvider();
const { verifier } = scriptedVerifier(["FAIL", "FAIL", "PASS"]);
const result = await runAgent({
  runId: "synthetic-demo",
  config: {
    benchmarkId: "synthetic-demo",
    strategy: "cascade",
    maxRepairsPerUnit: 1,
    maxEscalations: 1,
    maxModelSpendUsd: 1,
    timeoutSeconds: 5,
  },
  benchmark: {
    id: "synthetic-demo",
    sourceRepo: "https://example.invalid/synthetic-demo",
    sourceCommit: "0".repeat(40),
    license: "synthetic-original",
    phpRuntime: "NOT_RUN",
    scenarioIds: ["scenario-1"],
    migrationUnitIds: ["unit-1"],
    normalizationVersion: "synthetic-only",
  },
  provider,
  writer,
  verifier,
});
console.log(
  JSON.stringify(
    {
      notice:
        "SYNTHETIC ONLY: no model, Oracle, benchmark or candidate code executed",
      candidateRoot: writer.root,
      ...result,
      liveMeta: "NOT_RUN",
      realOracle: "NOT_RUN",
    },
    null,
    2,
  ),
);
if (result.verdict !== "PASS") process.exitCode = 1;
