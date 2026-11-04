// SYNTHETIC_UNIT_ONLY: deterministic controls for G1 qualification and timeout boundaries.
// No candidate source evaluated on host; exercises production buildReceipt, observeBuild,
// and publicAttempt paths with exact phase receipt structures.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { MANIFEST } from "@metamorph/oracle";
import { sha256, validateBundle } from "../../target-worker/src/admission.mjs";
import { publicAttempt } from "../src/report.mjs";
import { observeBuild } from "../src/runtime.mjs";

const image = `sha256:${"e".repeat(64)}`;
const content = "export const x: number = 1;";
const bundle = validateBundle([
  { path: "src/main.ts", content, sha256: sha256(content) },
]);
const scenarioId = MANIFEST[0].id;

const makeWorker = (checks, extraReceipt = {}) => ({
  image,
  bundle,
  evidence: {
    build: {
      args: ["run", image, "/opt/worker/build.mjs"],
      exitCode: 2,
      signal: null,
      spawnError: null,
      timedOut: false,
      cancelled: false,
      overflow: false,
      stdout: JSON.stringify({ checks, artifacts: [] }),
      stderr: "",
      elapsedMs: 12000,
      ...extraReceipt,
    },
    buildChecks: checks,
  },
});

const publish = (observed, errorCode = "BUILD_FAILED") => {
  const attemptId = randomUUID();
  const pairId = randomUUID();
  return publicAttempt({
    attemptId,
    candidateSha: bundle.candidateSha,
    errorCode,
    pairs: [
      {
        attemptId,
        candidateSha: bundle.candidateSha,
        pairId,
        scenarioId,
        ...observed,
        gates: [],
        cleanup: "VERIFIED_ZERO_RESOURCES",
        packs: [
          {
            id: "oracle-synthetic",
            sha256: "f".repeat(64),
            reference: "synthetic/index.json",
          },
        ],
      },
    ],
  });
};

test("normal two-phase build with elapsedMs passes G1 and emits no sidecar", () => {
  const checks = [
    {
      phase: "typecheck",
      exitCode: 0,
      signal: null,
      error: null,
      elapsedMs: 5432,
      stdout: "",
      stderr: "",
    },
    {
      phase: "build",
      exitCode: 0,
      signal: null,
      error: null,
      elapsedMs: 5123,
      stdout: "",
      stderr: "",
    },
  ];
  const w = makeWorker(checks, {
    exitCode: 0,
    stdout: JSON.stringify({ checks, artifacts: [] }),
  });
  const observed = observeBuild(w, scenarioId);

  assert.equal(observed.build.verdict, "PASS");
  assert.deepEqual(observed.build.findingCodes, []);
  assert.deepEqual(observed.build.executedTestIds, [
    `${scenarioId}:typecheck`,
    `${scenarioId}:build`,
  ]);
  assert.equal(observed.buildPhaseDiagnostics, null);
  assert.equal(observed.compilerDiagnostics, undefined);
});

test("internal phase timeout in typecheck vs build distinguishes executed ids and phase attribution", () => {
  // Case A: typecheck times out
  const typecheckTimeoutChecks = [
    {
      phase: "typecheck",
      exitCode: null,
      signal: "SIGTERM",
      error: "ETIMEDOUT",
      elapsedMs: 12005,
      stdout: "",
      stderr: "",
    },
  ];
  const wA = makeWorker(typecheckTimeoutChecks);
  const observedA = observeBuild(wA, scenarioId);

  assert.equal(observedA.build.verdict, "ERROR");
  assert.deepEqual(observedA.build.findingCodes, ["ENVIRONMENT_ERROR"]);
  assert.deepEqual(observedA.build.executedTestIds, []);
  assert.equal(observedA.buildPhaseDiagnostics.status, "AVAILABLE");
  assert.equal(observedA.buildPhaseDiagnostics.phase, "typecheck");
  assert.equal(observedA.buildPhaseDiagnostics.code, "BUILD_PHASE_TIMEOUT");

  const publishedA = publish(observedA);
  const g1A = publishedA.gates.find((g) => g.gate === "G1");
  assert.equal(g1A.verdict, "ERROR");
  assert.deepEqual(g1A.findingCodes, ["ENVIRONMENT_ERROR", "BUILD_FAILED"]);
  assert.deepEqual(g1A.executedTestIds, []);
  assert.equal(
    publishedA.pairs[0].buildPhaseDiagnostics.code,
    "BUILD_PHASE_TIMEOUT",
  );
  assert.equal(publishedA.pairs[0].buildPhaseDiagnostics.phase, "typecheck");

  // Case B: typecheck completes normally, build phase times out
  const buildTimeoutChecks = [
    {
      phase: "typecheck",
      exitCode: 0,
      signal: null,
      error: null,
      elapsedMs: 5200,
      stdout: "",
      stderr: "",
    },
    {
      phase: "build",
      exitCode: null,
      signal: "SIGTERM",
      error: "ETIMEDOUT",
      elapsedMs: 12008,
      stdout: "",
      stderr: "",
    },
  ];
  const wB = makeWorker(buildTimeoutChecks);
  const observedB = observeBuild(wB, scenarioId);

  assert.equal(observedB.build.verdict, "ERROR");
  assert.deepEqual(observedB.build.findingCodes, ["ENVIRONMENT_ERROR"]);
  assert.deepEqual(observedB.build.executedTestIds, [
    `${scenarioId}:typecheck`,
  ]);
  assert.equal(observedB.buildPhaseDiagnostics.status, "AVAILABLE");
  assert.equal(observedB.buildPhaseDiagnostics.phase, "build");
  assert.equal(observedB.buildPhaseDiagnostics.code, "BUILD_PHASE_TIMEOUT");

  const publishedB = publish(observedB);
  const g1B = publishedB.gates.find((g) => g.gate === "G1");
  assert.equal(g1B.verdict, "ERROR");
  assert.deepEqual(g1B.findingCodes, ["ENVIRONMENT_ERROR", "BUILD_FAILED"]);
  assert.deepEqual(g1B.executedTestIds, [`${scenarioId}:typecheck`]);
  assert.equal(
    publishedB.pairs[0].buildPhaseDiagnostics.code,
    "BUILD_PHASE_TIMEOUT",
  );
  assert.equal(publishedB.pairs[0].buildPhaseDiagnostics.phase, "build");
});

test("outer Docker provision timeout (35s) yields TIMEOUT without inner phase sidecar", () => {
  const w = makeWorker([], {
    exitCode: null,
    signal: "SIGKILL",
    timedOut: true,
    elapsedMs: 35050,
    stdout: "",
  });
  const observed = observeBuild(w, scenarioId);

  assert.equal(observed.build.verdict, "ERROR");
  assert.deepEqual(observed.build.findingCodes, ["TIMEOUT"]);
  assert.deepEqual(observed.build.executedTestIds, []);
  assert.equal(observed.buildPhaseDiagnostics, null);

  const published = publish(observed, "TIMEOUT");
  const g1 = published.gates.find((g) => g.gate === "G1");
  assert.equal(g1.verdict, "ERROR");
  assert.deepEqual(g1.findingCodes, ["TIMEOUT"]);
  assert.equal(published.pairs[0].buildPhaseDiagnostics, undefined);
});

test("compiler type error (FAIL) vs abnormal termination (ERROR)", () => {
  // Normal compiler error (exitCode 2, no error/signal)
  const compilerFailChecks = [
    {
      phase: "typecheck",
      exitCode: 2,
      signal: null,
      error: null,
      elapsedMs: 4500,
      stdout: "src/main.ts(1,1): error TS2322: Type error",
      stderr: "",
    },
  ];
  const wFail = makeWorker(compilerFailChecks);
  const observedFail = observeBuild(wFail, scenarioId);

  assert.equal(observedFail.build.verdict, "FAIL");
  assert.deepEqual(observedFail.build.findingCodes, ["BUILD_FAILED"]);
  assert.equal(observedFail.buildPhaseDiagnostics, null);

  // Abnormal termination (spawn error EAGAIN, exitCode null)
  const abnormalChecks = [
    {
      phase: "typecheck",
      exitCode: null,
      signal: null,
      error: "EAGAIN",
      elapsedMs: 12,
      stdout: "",
      stderr: "",
    },
  ];
  const wError = makeWorker(abnormalChecks);
  const observedError = observeBuild(wError, scenarioId);

  assert.equal(observedError.build.verdict, "ERROR");
  assert.deepEqual(observedError.build.findingCodes, ["ENVIRONMENT_ERROR"]);
  assert.equal(
    observedError.buildPhaseDiagnostics.code,
    "BUILD_PHASE_SPAWN_ERROR",
  );
});

test("privacy guarantee: sensitive markers, raw stderr/stdout and paths do not leak", () => {
  const marker = "PRIVATE_SENSITIVE_DEBUG_MARKER";
  const checks = [
    {
      phase: "typecheck",
      exitCode: 0,
      signal: null,
      error: null,
      elapsedMs: 5000,
      stdout: marker,
      stderr: marker,
    },
    {
      phase: "build",
      exitCode: null,
      signal: "SIGTERM",
      error: "ETIMEDOUT",
      elapsedMs: 12010,
      stdout: marker,
      stderr: marker,
    },
  ];
  const w = makeWorker(checks, {
    stdout: JSON.stringify({ checks, artifacts: [] }),
    stderr: marker,
  });
  const observed = observeBuild(w, scenarioId);
  const published = publish(observed);

  const serialized = JSON.stringify(published);
  assert.doesNotMatch(serialized, new RegExp(marker));
  assert.doesNotMatch(serialized, /ETIMEDOUT/);
  assert.doesNotMatch(serialized, /SIGTERM/);
  assert.doesNotMatch(serialized, /\/work\//);
});
