// SYNTHETIC_UNIT_ONLY: trusted build receipts and local spawnSync probes only.
// No candidate source is executed; the production classifier and publication
// path are exercised directly.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { MANIFEST, SOURCE } from "@metamorph/oracle";
import { sha256, validateBundle } from "../../target-worker/src/admission.mjs";
import {
  BUILD_PHASE_CODES,
  classifyAbnormalPhase,
  publicBuildPhaseDiagnostics,
} from "../src/build-phase-diagnostics.mjs";
import { publicAttempt } from "../src/report.mjs";
import { observeBuild } from "../src/runtime.mjs";

const image = `sha256:${"a".repeat(64)}`;
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
const receipt = (checks, extra = {}) => ({
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
});
const worker = (checks, extra = {}) => ({
  image,
  bundle,
  evidence: { build: receipt(checks, extra) },
});
const privateMarker = "PRIVATE_BUILD_PHASE_MARKER";
const assertPrivate = (value) =>
  assert.doesNotMatch(
    JSON.stringify(value),
    /PRIVATE_|ETIMEDOUT|ENOBUFS|EAGAIN|SIGTERM|SIGKILL|\/work\/|stdout|stderr|stack/,
  );
const publish = (observed, errorCode = "BUILD_FAILED") => {
  const attemptId = randomUUID();
  const pairId = randomUUID();
  const value = publicAttempt({
    attemptId,
    candidateSha: bundle.candidateSha,
    errorCode,
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
            sha256: "b".repeat(64),
            reference: "synthetic/index.json",
          },
        ],
      },
    ],
  });
  return { value, attemptId, pairId };
};

test("fixed enum is exactly the reviewed public-safe set", () => {
  assert.deepEqual(BUILD_PHASE_CODES, [
    "BUILD_PHASE_TIMEOUT",
    "BUILD_PHASE_SIGNAL",
    "BUILD_PHASE_SPAWN_ERROR",
    "BUILD_PHASE_OUTPUT_OVERFLOW",
    "BUILD_PHASE_UNKNOWN",
  ]);
});

for (const [name, extra, code] of [
  [
    "deadline timeout with ETIMEDOUT/SIGTERM",
    { exitCode: null, signal: "SIGTERM", error: "ETIMEDOUT" },
    "BUILD_PHASE_TIMEOUT",
  ],
  [
    "external signal with no spawn error",
    { exitCode: null, signal: "SIGKILL" },
    "BUILD_PHASE_SIGNAL",
  ],
  [
    "spawn failure with EAGAIN",
    { exitCode: null, error: "EAGAIN" },
    "BUILD_PHASE_SPAWN_ERROR",
  ],
  [
    "maximum-buffer overflow with ENOBUFS",
    { exitCode: null, signal: "SIGTERM", error: "ENOBUFS" },
    "BUILD_PHASE_OUTPUT_OVERFLOW",
  ],
  [
    "non-integer exit without error or signal",
    { exitCode: null },
    "BUILD_PHASE_UNKNOWN",
  ],
]) {
  test(`SYNTHETIC_UNIT_ONLY: build ${name} keeps G1 ERROR and publishes only ${code}`, () => {
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
    assert.deepEqual(observed.build.executedTestIds, [
      `${MANIFEST[0].id}:typecheck`,
    ]);
    assert.equal(observed.buildPhaseDiagnostics.status, "AVAILABLE");
    assert.equal(observed.buildPhaseDiagnostics.phase, "build");
    assert.equal(observed.buildPhaseDiagnostics.code, code);
    const { value, attemptId, pairId } = publish(observed);
    const g1 = value.gates.find((gate) => gate.gate === "G1");
    assert.equal(g1.verdict, "ERROR");
    assert.deepEqual(g1.findingCodes, ["ENVIRONMENT_ERROR", "BUILD_FAILED"]);
    assert.deepEqual(g1.executedTestIds, [`${MANIFEST[0].id}:typecheck`]);
    assert.deepEqual(value.coverage, {
      http: 0,
      sqlite: 0,
      requiredHttp: 17,
      requiredSqlite: 20,
    });
    const block = value.pairs[0].buildPhaseDiagnostics;
    assert.equal(block.format, "mmp167-build-phase-diagnostics-v1");
    assert.equal(block.sourceSha, SOURCE.commit);
    assert.equal(block.candidateSha, bundle.candidateSha);
    assert.equal(block.attemptId, attemptId);
    assert.equal(block.pairId, pairId);
    assert.equal(block.g1Verdict, "ERROR");
    assert.equal(block.status, "AVAILABLE");
    assert.equal(block.phase, "build");
    assert.equal(block.code, code);
    assertPrivate(value);
  });
}

test("SYNTHETIC_UNIT_ONLY: abnormal typecheck is classified too and executes no id", () => {
  const observed = observeBuild(
    worker([
      phase("typecheck", null, {
        signal: "SIGKILL",
        stdout: privateMarker,
        stderr: privateMarker,
      }),
    ]),
    MANIFEST[0].id,
  );
  assert.equal(observed.build.verdict, "ERROR");
  assert.deepEqual(observed.build.executedTestIds, []);
  assert.equal(observed.buildPhaseDiagnostics.code, "BUILD_PHASE_SIGNAL");
  assert.equal(observed.buildPhaseDiagnostics.phase, "typecheck");
});

test("SYNTHETIC_UNIT_ONLY: normal compiler type error stays G1 FAIL with no phase sidecar", () => {
  const observed = observeBuild(
    worker([
      phase("typecheck", 0),
      phase("build", 2, {
        stdout: "src/main.ts(1,1): error TS2322: PRIVATE_MESSAGE",
      }),
    ]),
    MANIFEST[0].id,
  );
  assert.equal(observed.build.verdict, "FAIL");
  assert.deepEqual(observed.build.findingCodes, ["BUILD_FAILED"]);
  assert.deepEqual(observed.build.executedTestIds, [
    `${MANIFEST[0].id}:typecheck`,
    `${MANIFEST[0].id}:build`,
  ]);
  assert.equal(observed.buildPhaseDiagnostics, null);
  const { value } = publish(observed, null);
  assert.equal(value.gates.find((gate) => gate.gate === "G1").verdict, "FAIL");
  assert.equal(Object.hasOwn(value.pairs[0], "buildPhaseDiagnostics"), false);
  assertPrivate(value);
});

test("SYNTHETIC_UNIT_ONLY: successful build is G1 PASS with no phase sidecar", () => {
  const successful = worker([phase("typecheck", 0), phase("build", 0)]);
  successful.evidence.build.exitCode = 0;
  successful.evidence.build.stdout = JSON.stringify({
    checks: [phase("typecheck", 0), phase("build", 0)],
    artifacts: [],
  });
  successful.evidence.buildChecks = [{}, {}];
  const observed = observeBuild(successful, MANIFEST[0].id);
  assert.equal(observed.build.verdict, "PASS");
  assert.deepEqual(observed.build.findingCodes, []);
  assert.equal(observed.buildPhaseDiagnostics, null);
});

test("SYNTHETIC_UNIT_ONLY: outer Docker timeout stays TIMEOUT and adds no phase sidecar", () => {
  const observed = observeBuild(
    worker([], { exitCode: null, timedOut: true, stdout: "" }),
    MANIFEST[0].id,
  );
  assert.equal(observed.build.verdict, "ERROR");
  assert.deepEqual(observed.build.findingCodes, ["TIMEOUT"]);
  assert.equal(observed.buildPhaseDiagnostics, null);
});

test("SYNTHETIC_UNIT_ONLY: foreign, reloaded and non-ERROR summaries are unavailable", () => {
  const observed = observeBuild(
    worker([
      phase("typecheck", 0),
      phase("build", null, { error: "ETIMEDOUT", signal: "SIGTERM" }),
    ]),
    MANIFEST[0].id,
  );
  const identity = {
    sourceSha: SOURCE.commit,
    candidateSha: bundle.candidateSha,
    attemptId: randomUUID(),
    pairId: randomUUID(),
    g1Verdict: "ERROR",
  };
  assert.equal(
    publicBuildPhaseDiagnostics(observed.buildPhaseDiagnostics, identity)
      .status,
    "AVAILABLE",
  );
  for (const value of [
    undefined,
    null,
    {},
    JSON.parse(JSON.stringify(observed.buildPhaseDiagnostics)),
  ]) {
    const result = publicBuildPhaseDiagnostics(value, identity);
    assert.equal(result.status, "DIAGNOSTIC_UNAVAILABLE");
    assert.equal(result.code, null);
    assertPrivate(result);
  }
  const foreign = publicBuildPhaseDiagnostics(observed.buildPhaseDiagnostics, {
    ...identity,
    candidateSha: "b".repeat(64),
  });
  assert.equal(foreign.status, "DIAGNOSTIC_UNAVAILABLE");
  const pass = publicBuildPhaseDiagnostics(observed.buildPhaseDiagnostics, {
    ...identity,
    g1Verdict: "PASS",
  });
  assert.equal(pass.status, "DIAGNOSTIC_UNAVAILABLE");
  assertPrivate(pass);
});

test("SYNTHETIC_UNIT_ONLY: real spawnSync timeout/overflow/spawn-error shapes are classified", () => {
  const record = (result) => ({
    phase: "build",
    exitCode: result.status,
    signal: result.signal,
    error: result.error?.code ?? null,
  });
  assert.equal(
    classifyAbnormalPhase(
      record(spawnSync(process.execPath, ["-e", "process.exit(0)"])),
    ),
    null,
  );
  assert.equal(
    classifyAbnormalPhase(
      record(spawnSync(process.execPath, ["-e", "process.exit(2)"])),
    ),
    null,
  );
  assert.equal(
    classifyAbnormalPhase(
      record(
        spawnSync(process.execPath, ["-e", "setTimeout(() => {}, 5000)"], {
          timeout: 50,
          maxBuffer: 512 * 1024,
        }),
      ),
    ),
    "BUILD_PHASE_TIMEOUT",
  );
  assert.equal(
    classifyAbnormalPhase(
      record(
        spawnSync(
          process.execPath,
          ["-e", "process.stdout.write('x'.repeat(200000))"],
          { maxBuffer: 1024 },
        ),
      ),
    ),
    "BUILD_PHASE_OUTPUT_OVERFLOW",
  );
  assert.equal(
    classifyAbnormalPhase(
      record(spawnSync("metamorph-mmp167-no-such-command", [])),
    ),
    "BUILD_PHASE_SPAWN_ERROR",
  );
});
