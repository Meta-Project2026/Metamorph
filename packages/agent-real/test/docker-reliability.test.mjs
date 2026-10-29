// SYNTHETIC_UNIT_ONLY: injected Docker receipts; no candidate is executed.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { MANIFEST } from "@metamorph/oracle";
import { sha256, validateBundle } from "../../target-worker/src/admission.mjs";
import { TargetWorker } from "../../target-worker/src/controller.mjs";
import { publicAttempt } from "../src/report.mjs";
import { buildReceipt } from "../src/runtime.mjs";

const imageId = `sha256:${"a".repeat(64)}`;
const content = "export const value = 1;";
const bundle = validateBundle([
  { path: "src/main.ts", content, sha256: sha256(content) },
]);
const phase = {
  phase: "typecheck",
  exitCode: 2,
  signal: null,
  error: null,
  stdout: "",
  stderr: "PRIVATE_DIAGNOSTIC_MARKER",
};

// Model container creation *before* a lost/failed Docker response. Exercise the
// actual controller cleanup and report adapters, never inject gate verdicts.
function harness({ envelope = {}, inner = {}, failRemoval = false } = {}) {
  const containers = new Set();
  const calls = [];
  let removalFails = failRemoval;
  const command = async (args) => {
    calls.push(args);
    const result = {
      args,
      exitCode: 0,
      signal: null,
      spawnError: null,
      timedOut: false,
      cancelled: false,
      overflow: false,
      stdout: "",
      stderr: "",
    };
    if (args[0] === "image")
      return { ...result, stdout: JSON.stringify([{ Id: imageId }]) };
    if (args[0] === "run" && args.includes("/opt/worker/build.mjs")) {
      containers.add(args[args.indexOf("--name") + 1]);
      return {
        ...result,
        exitCode: 2,
        stdout: JSON.stringify({
          checks: [{ ...phase, ...inner }],
          artifacts: [],
        }),
        ...envelope,
      };
    }
    if (args[0] === "rm") {
      if (removalFails) return { ...result, exitCode: 1 };
      containers.delete(args.at(-1));
      return result;
    }
    if (args[0] === "container")
      return { ...result, stdout: [...containers].join("\n") };
    if (args[0] === "volume" && args[1] === "ls") return result;
    throw new Error("Unexpected synthetic Docker operation");
  };
  return {
    worker: new TargetWorker({ imageId }, bundle, "real", {
      trustedTest: { command },
    }),
    containers,
    calls,
    allowRemoval: () => {
      removalFails = false;
    },
  };
}

for (const [name, options, operationCode, gateCode, verdict] of [
  [
    "inner compiler timeout",
    { inner: { exitCode: null, signal: "SIGTERM", error: "ETIMEDOUT" } },
    "BUILD_FAILED",
    "ENVIRONMENT_ERROR",
    "ERROR",
  ],
  [
    "inner compiler killed",
    { inner: { exitCode: null, signal: "SIGKILL" } },
    "BUILD_FAILED",
    "ENVIRONMENT_ERROR",
    "ERROR",
  ],
  [
    "inner compiler spawn failure",
    { inner: { exitCode: null, error: "EAGAIN" } },
    "BUILD_FAILED",
    "ENVIRONMENT_ERROR",
    "ERROR",
  ],
  [
    "Docker CLI timeout",
    { envelope: { exitCode: null, timedOut: true } },
    "TIMEOUT",
    "TIMEOUT",
    "ERROR",
  ],
  [
    "Docker CLI cancellation",
    { envelope: { exitCode: null, cancelled: true } },
    "CANCELLED",
    "CANCELLED",
    "ERROR",
  ],
  [
    "Docker CLI spawn failure",
    { envelope: { exitCode: null, spawnError: "ENOENT" } },
    "ENVIRONMENT_ERROR",
    "ENVIRONMENT_ERROR",
    "ERROR",
  ],
  [
    "Docker stdout overflow",
    { envelope: { exitCode: null, overflow: true } },
    "ENVIRONMENT_ERROR",
    "ENVIRONMENT_ERROR",
    "ERROR",
  ],
  [
    "Docker stdout overflow with outer exit 2",
    { envelope: { exitCode: 2, overflow: true } },
    "BUILD_FAILED",
    "ENVIRONMENT_ERROR",
    "ERROR",
  ],
  [
    "container created then transport fails",
    { envelope: { exitCode: 125, stdout: "" } },
    "ENVIRONMENT_ERROR",
    "ENVIRONMENT_ERROR",
    "ERROR",
  ],
  [
    "ordinary compiler diagnostic control",
    {},
    "BUILD_FAILED",
    "BUILD_FAILED",
    "FAIL",
  ],
]) {
  test(`SYNTHETIC_UNIT_ONLY: ${name} preserves classification and reaps`, async () => {
    const h = harness(options);
    let failure;
    await assert.rejects(h.worker.provision(), (error) => {
      failure = error.code;
      return failure === operationCode;
    });
    assert.equal(h.containers.size, 0);
    assert.equal(h.worker.evidence.cleanupVerified, true);
    assert.ok(h.calls.some((args) => args[0] === "rm"));
    const build = buildReceipt(h.worker, MANIFEST[0].id);
    assert.equal(build.verdict, verdict);
    assert.deepEqual(build.findingCodes, [gateCode]);
    const attemptId = randomUUID();
    const published = publicAttempt({
      attemptId,
      candidateSha: bundle.candidateSha,
      errorCode:
        failure === "BUILD_FAILED" && build.verdict === "FAIL" ? null : failure,
      pairs: [
        {
          attemptId,
          candidateSha: bundle.candidateSha,
          pairId: randomUUID(),
          scenarioId: MANIFEST[0].id,
          build,
          gates: [],
          packs: [
            {
              id: "oracle-synthetic",
              sha256: "b".repeat(64),
              reference: "synthetic/index.json",
            },
          ],
          cleanup: h.worker.evidence.cleanupVerified
            ? "VERIFIED_ZERO_RESOURCES"
            : "CLEANUP_ERROR",
        },
      ],
    });
    const g1 = published.gates.find((gate) => gate.gate === "G1");
    assert.equal(g1.verdict, verdict);
    if (name.startsWith("inner compiler")) {
      assert.deepEqual(g1.findingCodes, ["ENVIRONMENT_ERROR", "BUILD_FAILED"]);
      assert.deepEqual(g1.executedTestIds, []);
    }
    assert.equal(published.coverage.http, 0);
    assert.equal(published.coverage.sqlite, 0);
    assert.doesNotMatch(
      JSON.stringify(published),
      /PRIVATE_DIAGNOSTIC_MARKER|stderr|stdout/,
    );
    await h.worker.close();
  });
}

test("SYNTHETIC_UNIT_ONLY: failed removal remains CLEANUP_ERROR after later zero inventory", async () => {
  const h = harness({ envelope: { exitCode: 125 }, failRemoval: true });
  await assert.rejects(h.worker.provision(), { code: "CLEANUP_ERROR" });
  assert.equal(h.containers.size, 1);
  assert.equal(h.worker.evidence.cleanupVerified, false);
  h.allowRemoval();
  await assert.rejects(h.worker.close(), { code: "CLEANUP_ERROR" });
  assert.equal(h.containers.size, 0);
  assert.equal(h.worker.evidence.cleanupVerified, false);
});
