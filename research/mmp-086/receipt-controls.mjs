// Synthetic envelope controls only. Never presented as real Docker observations.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { publicAttempt } from "../../packages/agent-real/src/report.mjs";
import { observeBuild } from "../../packages/agent-real/src/runtime.mjs";
import {
  sha256,
  validateBundle,
} from "../../packages/target-worker/src/admission.mjs";

export function receiptControls() {
  const content = "export const value = 1;\n";
  const bundle = validateBundle([
    { path: "src/main.ts", content, sha256: sha256(content) },
  ]);
  return [
    ["outer-timeout", { timedOut: true, exitCode: null }, "TIMEOUT"],
    [
      "outer-spawn-error",
      { spawnError: "ENOENT", exitCode: null },
      "ENVIRONMENT_ERROR",
    ],
    [
      "compiler-process-timeout",
      {
        exitCode: 2,
        stdout: JSON.stringify({
          checks: [
            {
              phase: "typecheck",
              exitCode: null,
              error: "ETIMEDOUT",
              signal: "SIGTERM",
              stdout: "",
              stderr: "",
            },
          ],
        }),
      },
      "ENVIRONMENT_ERROR",
    ],
  ].map(([id, overrides, code]) => {
    const worker = {
      image: "synthetic-receipt-only",
      bundle,
      evidence: {
        build: {
          args: ["synthetic-receipt-only", "/opt/worker/build.mjs"],
          stdout: "",
          ...overrides,
        },
      },
    };
    const { build, compilerDiagnostics } = observeBuild(
      worker,
      "workshop-business",
    );
    assert.equal(build.verdict, "ERROR");
    assert.deepEqual(build.findingCodes, [code]);
    const attemptId = randomUUID();
    const pairId = randomUUID();
    const attempt = publicAttempt({
      attemptId,
      candidateSha: bundle.candidateSha,
      pairs: [
        {
          attemptId,
          pairId,
          candidateSha: bundle.candidateSha,
          scenarioId: "workshop-business",
          cleanup: "VERIFIED_ZERO_RESOURCES",
          packs: [],
          gates: [],
          build,
          compilerDiagnostics,
        },
      ],
    });
    assert.equal(
      attempt.pairs[0].compilerDiagnostics.status,
      "DIAGNOSTIC_UNAVAILABLE",
    );
    assert.equal(attempt.coverage.http, 0);
    assert.equal(attempt.coverage.sqlite, 0);
    assert.ok(attempt.gates.every((gate) => gate.verdict !== "PASS"));
    return {
      id,
      execution: "SYNTHETIC_ENVELOPE_ONLY",
      observedPairG1: build,
      diagnosticStatus: attempt.pairs[0].compilerDiagnostics.status,
      coverage: attempt.coverage,
    };
  });
}
