// Synthetic envelopes for unit controls only. No model, Docker or crypto evidence.
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { completedRetentionReceipt } from "../../packages/agent-real/src/candidate-retention.mjs";
import { expectedIds } from "../../packages/agent-real/src/report.mjs";
import { MANIFEST } from "../../packages/oracle/dist/index.js";
import {
  sha256,
  validateBundle,
} from "../../packages/target-worker/src/admission.mjs";
import { syntheticFixture } from "../mmp-089/synthetic-fixture.mjs";

export function completedFixture(g2 = "PASS", g3 = "PASS") {
  const previous = syntheticFixture();
  const content = "export const value: number = 1; // MMP097_PRIVATE_SOURCE\n";
  const source = validateBundle([
    { path: "src/main.ts", content, sha256: sha256(content) },
  ]);
  const { expected } = previous;
  const attemptId = randomUUID();
  const base = {
    ...expected,
    sourceSha: previous.identity.sourceSha,
    candidateSha: source.candidateSha,
    attemptId,
  };
  const receipts = [];
  const pairs = MANIFEST.map((scenario, i) => {
    const pair = {
      scenarioId: scenario.id,
      pairId: randomUUID(),
      packs: [],
      cleanup: "VERIFIED_ZERO_RESOURCES",
      targetLifetimePolicyMs: 180000,
      compilerDiagnostics: {
        sourceSha: base.sourceSha,
        candidateSha: base.candidateSha,
        attemptId,
        g1Verdict: "PASS",
      },
      gates: ["G2", "G3", "G4"].map((gate) => {
        const verdict =
          i === 0 && gate !== "G4" ? (gate === "G2" ? g2 : g3) : "PASS";
        return {
          gate,
          verdict,
          executedTestIds: expectedIds(scenario, gate),
          findingCodes:
            verdict === "FAIL"
              ? [gate === "G2" ? "HTTP_STATUS" : "DB_STATE"]
              : [],
        };
      }),
    };
    pair.compilerDiagnostics.pairId = pair.pairId;
    const evidence = structuredClone(previous.completion.workerEvidence);
    evidence.runId = `mmp007-${randomUUID()}`;
    evidence.candidateSha = base.candidateSha;
    delete evidence.operationError;
    evidence.build.args = evidence.build.args.map((arg) =>
      arg === `${previous.completion.workerEvidence.runId}-build`
        ? `${evidence.runId}-build`
        : arg,
    );
    evidence.build.exitCode = 0;
    evidence.buildChecks = ["typecheck", "build"].map((phase) => ({
      phase,
      exitCode: 0,
      signal: null,
      error: null,
      stdout: "MMP097_COMPILER_MUST_NOT_EXPORT",
      stderr: "",
    }));
    evidence.build.stdout = JSON.stringify({
      checks: evidence.buildChecks,
      artifacts: [],
    });
    evidence.commands = [{ stdout: "MMP097_RUNTIME_HTTP_DB_MUST_NOT_EXPORT" }];
    const identity = {
      headSha: expected.headSha,
      attemptId,
      pairId: pair.pairId,
      candidateSha: base.candidateSha,
      scenarioId: scenario.id,
    };
    receipts.push(
      structuredClone(
        completedRetentionReceipt(
          identity,
          { runId: evidence.runId, evidence },
          {
            gate: "G1",
            verdict: "PASS",
            executedTestIds: [
              `${scenario.id}:typecheck`,
              `${scenario.id}:build`,
            ],
            findingCodes: [],
          },
          pair.gates,
          null,
          "VERIFIED_ZERO_RESOURCES",
          null,
        ),
      ),
    );
    return pair;
  });
  const gates = ["G0", "G1", "G2", "G3", "G4"].map((gate) => ({
    gate,
    verdict:
      gate === "G1"
        ? "PASS"
        : gate === "G2"
          ? g2
          : gate === "G3"
            ? g3
            : "INCONCLUSIVE",
    executedTestIds:
      gate === "G1"
        ? MANIFEST.flatMap((s) => [`${s.id}:typecheck`, `${s.id}:build`])
        : ["G2", "G3"].includes(gate)
          ? MANIFEST.flatMap((s) => expectedIds(s, gate))
          : [],
    findingCodes:
      ["G2", "G3"].includes(gate) && (gate === "G2" ? g2 : g3) === "FAIL"
        ? [gate === "G2" ? "HTTP_STATUS" : "DB_STATE"]
        : [],
  }));
  const trial = {
    ...previous.trial,
    candidateSha: base.candidateSha,
    publicG1: "PASS",
    publicG2: g2,
    publicG3: g3,
    attempts: [
      {
        attemptId,
        candidateSha: base.candidateSha,
        gates,
        coverage: {
          http: 17,
          sqlite: 20,
          requiredHttp: 17,
          requiredSqlite: 20,
        },
        pairs,
      },
    ],
  };
  return { expected, source, trial, receipts };
}

export function writeCompletedPacks(root, fixture) {
  fixture.trial.attempts[0].pairs.forEach((pair, i) => {
    const directory = join(
      root,
      fixture.trial.attempts[0].attemptId,
      pair.pairId,
    );
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    pair.packs = [false, true].map((target) => {
      const id = `oracle-${randomUUID()}`;
      const path = join(directory, id);
      mkdirSync(path, { mode: 0o700 });
      const provenance = Object.fromEntries(
        ["headSha", "attemptId", "pairId", "candidateSha", "scenarioId"].map(
          (key) => [key, fixture.receipts[i][key]],
        ),
      );
      const records = [
        ["provenance", provenance],
        ...(target
          ? [
              ["pair-1-source", fixture.source],
              ["pair-2-retention", fixture.receipts[i]],
            ]
          : [
              [
                "raw-reference-excluded",
                { marker: "MMP097_REFERENCE_MUST_NOT_EXPORT" },
              ],
            ]),
      ];
      const entries = records.map(([name, value]) => {
        const bytes = JSON.stringify(value);
        writeFileSync(join(path, `${name}.json`), bytes, { mode: 0o600 });
        return {
          id: name,
          bytes: Buffer.byteLength(bytes),
          sha256: sha256(bytes),
        };
      });
      const index = JSON.stringify({
        format: "oracle-private-pack-v1",
        retention: {},
        entries,
      });
      writeFileSync(join(path, "index.json"), index, { mode: 0o600 });
      return { id, sha256: sha256(index) };
    });
  });
  return fixture;
}
