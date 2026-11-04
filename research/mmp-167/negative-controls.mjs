// MMP-167 offline negative controls. Trusted synthetic receipts only; no
// candidate bytes, no model call, no paid workflow and no Docker execution.
// Exercises the production buildReceipt/observeBuild/publicAttempt path and the
// isolated spawnSync classifier. Exit status 0 means every assertion passed.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { sha256, validateBundle } from "../../packages/target-worker/src/admission.mjs";
import {
  BUILD_PHASE_CODES,
  classifyAbnormalPhase,
} from "../../packages/agent-real/src/build-phase-diagnostics.mjs";
import { publicAttempt } from "../../packages/agent-real/src/report.mjs";
import { observeBuild } from "../../packages/agent-real/src/runtime.mjs";
import { MANIFEST } from "../../packages/oracle/dist/index.js";

const image = `sha256:${"c".repeat(64)}`;
const content = "export const value = 1;";
const bundle = validateBundle([
  { path: "src/main.ts", content, sha256: sha256(content) },
]);
const phase = (name, exitCode, extra = {}) => ({
  phase: name,
  exitCode,
  signal: null,
  error: null,
  stdout: "",
  stderr: "",
  ...extra,
});
const worker = (checks, extra = {}) => ({
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
      ...extra,
    },
  },
});
const privateMarker = "PRIVATE_MMP167_MARKER";
const rows = [];

for (const [name, extra, code] of [
  ["timeout", { exitCode: null, signal: "SIGTERM", error: "ETIMEDOUT" }, "BUILD_PHASE_TIMEOUT"],
  ["signal", { exitCode: null, signal: "SIGKILL" }, "BUILD_PHASE_SIGNAL"],
  ["spawn-error", { exitCode: null, error: "EAGAIN" }, "BUILD_PHASE_SPAWN_ERROR"],
  ["output-overflow", { exitCode: null, signal: "SIGTERM", error: "ENOBUFS" }, "BUILD_PHASE_OUTPUT_OVERFLOW"],
  ["unknown", { exitCode: null }, "BUILD_PHASE_UNKNOWN"],
]) {
  const observed = observeBuild(
    worker([
      phase("typecheck", 0),
      phase("build", null, {
        ...extra,
        stdout: privateMarker,
        stderr: privateMarker,
      }),
    ]),
    MANIFEST[0].id,
  );
  assert.equal(observed.build.verdict, "ERROR");
  assert.deepEqual(observed.build.findingCodes, ["ENVIRONMENT_ERROR"]);
  assert.deepEqual(observed.build.executedTestIds, [`${MANIFEST[0].id}:typecheck`]);
  assert.equal(observed.buildPhaseDiagnostics.code, code);
  const attemptId = randomUUID();
  const pairId = randomUUID();
  const published = publicAttempt({
    attemptId,
    candidateSha: bundle.candidateSha,
    errorCode: "BUILD_FAILED",
    pairs: [
      {
        attemptId,
        candidateSha: bundle.candidateSha,
        pairId,
        scenarioId: MANIFEST[0].id,
        ...observed,
        gates: [],
        cleanup: "VERIFIED_ZERO_RESOURCES",
        packs: [
          {
            id: "oracle-synthetic",
            sha256: "d".repeat(64),
            reference: "synthetic/index.json",
          },
        ],
      },
    ],
  });
  const g1 = published.gates.find((gate) => gate.gate === "G1");
  assert.equal(g1.verdict, "ERROR");
  assert.deepEqual(g1.findingCodes, ["ENVIRONMENT_ERROR", "BUILD_FAILED"]);
  const block = published.pairs[0].buildPhaseDiagnostics;
  assert.equal(block.code, code);
  assert.doesNotMatch(
    JSON.stringify(published),
    /PRIVATE_|ETIMEDOUT|ENOBUFS|EAGAIN|SIGTERM|SIGKILL|\/work\/|stdout|stderr/,
  );
  rows.push({ name, build: "ERROR", code, g1: g1.findingCodes.join("+") });
}

const ordinary = observeBuild(
  worker([
    phase("typecheck", 0),
    phase("build", 2, { stdout: "src/main.ts(1,1): error TS2322: PRIVATE" }),
  ]),
  MANIFEST[0].id,
);
assert.equal(ordinary.build.verdict, "FAIL");
assert.deepEqual(ordinary.build.findingCodes, ["BUILD_FAILED"]);
assert.equal(ordinary.buildPhaseDiagnostics, null);
rows.push({ name: "normal-compiler-error", build: "FAIL", code: "none", g1: "BUILD_FAILED" });

const success = worker([phase("typecheck", 0), phase("build", 0)]);
success.evidence.build.exitCode = 0;
success.evidence.buildChecks = [{}, {}];
const passed = observeBuild(success, MANIFEST[0].id);
assert.equal(passed.build.verdict, "PASS");
assert.equal(passed.buildPhaseDiagnostics, null);
rows.push({ name: "successful-build", build: "PASS", code: "none", g1: "none" });

const outerTimeout = observeBuild(
  worker([], { exitCode: null, timedOut: true, stdout: "" }),
  MANIFEST[0].id,
);
assert.deepEqual(outerTimeout.build.findingCodes, ["TIMEOUT"]);
assert.equal(outerTimeout.buildPhaseDiagnostics, null);
rows.push({ name: "outer-docker-timeout", build: "ERROR", code: "TIMEOUT", g1: "TIMEOUT" });

// Real local spawnSync shapes, not a hand-shaped fake.
const record = (result) => ({
  phase: "build",
  exitCode: result.status,
  signal: result.signal,
  error: result.error?.code ?? null,
});
assert.equal(classifyAbnormalPhase(record(spawnSync(process.execPath, ["-e", "process.exit(0)"]))), null);
assert.equal(classifyAbnormalPhase(record(spawnSync(process.execPath, ["-e", "process.exit(2)"]))), null);
assert.equal(
  classifyAbnormalPhase(
    record(spawnSync(process.execPath, ["-e", "setTimeout(() => {}, 5000)"], { timeout: 50 })),
  ),
  "BUILD_PHASE_TIMEOUT",
);
assert.equal(
  classifyAbnormalPhase(
    record(
      spawnSync(process.execPath, ["-e", "process.stdout.write('x'.repeat(200000))"], {
        maxBuffer: 1024,
      }),
    ),
  ),
  "BUILD_PHASE_OUTPUT_OVERFLOW",
);
assert.equal(
  classifyAbnormalPhase(record(spawnSync("metamorph-mmp167-no-such-command", []))),
  "BUILD_PHASE_SPAWN_ERROR",
);
rows.push({ name: "real-spawnSync-probes", build: "n/a", code: "classified", g1: "n/a" });

assert.deepEqual(BUILD_PHASE_CODES, [
  "BUILD_PHASE_TIMEOUT",
  "BUILD_PHASE_SIGNAL",
  "BUILD_PHASE_SPAWN_ERROR",
  "BUILD_PHASE_OUTPUT_OVERFLOW",
  "BUILD_PHASE_UNKNOWN",
]);
for (const row of rows)
  console.log(
    `MMP167_CONTROL ${row.name} build=${row.build} sidecar=${row.code} g1=${row.g1}`,
  );
console.log(`MMP167_CONTROLS PASS (${rows.length} groups)`);
