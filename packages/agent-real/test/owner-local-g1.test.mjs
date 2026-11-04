import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { PassThrough } from "node:stream";
import test from "node:test";
import {
  admitStoredReceipt,
  assertOfflineSnapshot,
  assertOwnerContext,
  HISTORICAL,
  initialResult,
  prepareRuntime,
  publicResult,
  replayPrivate,
  waitForOwner,
} from "../../../research/mmp-176/replay.mjs";
import { sha256 } from "../../target-worker/src/admission.mjs";
import { receiptFor } from "../src/custody-contract.mjs";
import { RECIPE_PIN } from "../src/runtime.mjs";

const marker = "ARBITRARY_RAW_DIAGNOSTIC_PRIVATE_MARKER";
const runtime = {
  imageId: `sha256:${"a".repeat(64)}`,
  provenance: { recipeSha: RECIPE_PIN },
};
const snapshot = {
  interfaces: [
    { name: "lo", flags: 73 },
    { name: "eth0", flags: 4098 },
  ],
  ownNet: "net:[123]",
  initNet: "net:[123]",
  daemonNet: "net:[123]",
  daemonName: "dockerd",
  socketOwned: true,
};
function workerFor(
  checks,
  { outer = {}, cleanupFail = false, malformed = false } = {},
) {
  const worker = {
    image: runtime.imageId,
    bundle: { candidateSha: HISTORICAL.identity.candidateSha },
    evidence: {
      cleanupVerified: false,
      build: {
        args: [runtime.imageId, "/opt/worker/build.mjs"],
        exitCode: checks.some((c) => c.exitCode !== 0) ? 2 : 0,
        timedOut: false,
        cancelled: false,
        overflow: false,
        spawnError: null,
        elapsedMs: 123.4,
        stderr: marker,
        stdout: malformed ? marker : JSON.stringify({ checks, artifacts: [] }),
        ...outer,
      },
      buildChecks: checks,
    },
    async provision() {
      if (worker.evidence.build.exitCode !== 0) throw new Error(marker);
    },
    async close() {
      worker.closed = true;
      if (cleanupFail) throw new Error(marker);
      worker.evidence.cleanupVerified = true;
    },
    async inventory() {
      return { containers: [], volumes: [] };
    },
  };
  return worker;
}
const phase = (name, patch = {}) => ({
  phase: name,
  exitCode: 0,
  error: null,
  signal: null,
  stdout: marker,
  stderr: marker,
  ...patch,
});
async function simulate(worker, patch = {}) {
  return replayPrivate({
    runtime,
    privateRoot: "/test-only",
    offline: () => {},
    restore: () => ({}),
    makeWorker: () => worker,
    ...patch,
  });
}
test("owner context and daemon/host isolation fail closed before private reads", () => {
  assert.doesNotThrow(() =>
    assertOwnerContext({ PATH: "/usr/bin:/bin" }, "linux"),
  );
  for (const key of [
    "GH_TOKEN",
    "CODEX_HOME",
    "NODE_OPTIONS",
    "GITHUB_RUN_ID",
    "DOCKER_HOST",
    "MODEL_API_KEY",
    "CI",
  ])
    assert.throws(() => assertOwnerContext({ [key]: marker }, "linux"));
  assert.throws(() => assertOwnerContext({}, "win32"));
  assert.doesNotThrow(() => assertOfflineSnapshot(snapshot));
  for (const patch of [
    {
      interfaces: [
        { name: "lo", flags: 73 },
        { name: "eth0", flags: 4099 },
      ],
    },
    {
      interfaces: [
        { name: "lo", flags: 73 },
        { name: "tun0", flags: 1 },
      ],
    },
    { interfaces: [{ name: "lo", flags: Number.NaN }] },
    { interfaces: [] },
    { daemonNet: "net:[999]" },
    { initNet: "net:[999]" },
    { daemonName: "proxy" },
    { socketOwned: false },
  ])
    assert.throws(() => assertOfflineSnapshot({ ...snapshot, ...patch }));
});
test("authenticated exact stored receipt rejects foreign identities, states, bytes and missing proof", () => {
  const record = receiptFor(
    "STORED_UNVERIFIED",
    HISTORICAL.identity,
    { sha256: HISTORICAL.ciphertextSha256, bytes: HISTORICAL.ciphertextBytes },
    "VERIFIED_ZERO_RESOURCES",
  );
  const bytes = Buffer.from(`${JSON.stringify(record)}\n`);
  assert.equal(sha256(bytes), HISTORICAL.receiptSha256);
  assert.deepEqual(admitStoredReceipt(bytes), record);
  for (const patch of [
    { runId: "111" },
    { headSha: "0".repeat(40) },
    { candidateSha: "0".repeat(64) },
    { sourceSha: "0".repeat(40) },
    { attemptId: "00000000-0000-4000-8000-000000000000" },
  ])
    assert.throws(() =>
      admitStoredReceipt(bytes, {
        ...HISTORICAL,
        identity: { ...HISTORICAL.identity, ...patch },
      }),
    );
  for (const patched of [
    { ...record, state: "CAPTURED_UNVERIFIED" },
    { ...record, storage: "NOT_ESTABLISHED" },
    { ...record, ciphertextBytes: 30000000 },
    { ...record, extra: marker },
    {},
  ]) {
    const changed = Buffer.from(JSON.stringify(patched));
    assert.throws(() =>
      admitStoredReceipt(changed, {
        ...HISTORICAL,
        receiptSha256: sha256(changed),
      }),
    );
  }
  assert.throws(() => admitStoredReceipt(Buffer.from("null")));
  assert.throws(() =>
    admitStoredReceipt(Buffer.concat([bytes, Buffer.from(" ")])),
  );
});
test("G1 verdict comes from trusted envelope; compiler FAIL stays distinct from abnormal ERROR", async () => {
  const cases = [
    [[phase("typecheck"), phase("build")], "PASS", "NONE", 2],
    [[phase("typecheck", { exitCode: 2 })], "FAIL", "NONE", 1],
    ...[
      [{ error: "ETIMEDOUT", signal: "SIGTERM" }, "BUILD_PHASE_TIMEOUT"],
      [{ error: "ENOBUFS" }, "BUILD_PHASE_OUTPUT_OVERFLOW"],
      [{ error: "ENOENT" }, "BUILD_PHASE_SPAWN_ERROR"],
      [{ signal: "SIGKILL" }, "BUILD_PHASE_SIGNAL"],
      [{}, "BUILD_PHASE_UNKNOWN"],
    ].map(([patch, code]) => [
      [phase("typecheck"), phase("build", { exitCode: null, ...patch })],
      "ERROR",
      code,
      1,
    ]),
  ];
  for (const [checks, verdict, code, executed] of cases) {
    const worker = workerFor(checks);
    const result = await simulate(worker);
    assert.equal(result.g1Verdict, verdict);
    assert.equal(result.phaseCode, code);
    assert.equal(result.executedTestIds.length, executed);
    assert.equal(result.cleanup, "VERIFIED_ZERO_RESOURCES");
    assert.equal(result.zeroOwnedResources, true);
    assert.equal(worker.closed, true);
    assert.equal(JSON.stringify(result).includes(marker), false);
  }
});
test("outer failures do not fabricate a compiler phase; malformed evidence/cleanup cannot succeed", async () => {
  for (const outer of [
    { timedOut: true },
    { spawnError: "ENOENT" },
    { overflow: true },
    { exitCode: 137 },
  ]) {
    const result = await simulate(workerFor([], { outer }));
    assert.equal(result.g1Verdict, "ERROR");
    assert.equal(result.phase, "NONE");
    assert.equal(result.phaseCode, "BUILD_PHASE_UNKNOWN");
    assert.deepEqual(result.executedTestIds, []);
  }
  const malformed = await simulate(workerFor([], { malformed: true }));
  assert.equal(malformed.status, "REPLAY_ERROR");
  assert.equal(malformed.g1Verdict, "UNKNOWN");
  assert.equal(malformed.cleanup, "VERIFIED_ZERO_RESOURCES");
  const result = await simulate(
    workerFor([phase("typecheck"), phase("build")], { cleanupFail: true }),
  );
  assert.equal(result.status, "CLEANUP_FAILED");
  assert.equal(result.zeroOwnedResources, false);
  assert.equal(JSON.stringify(result).includes(marker), false);
});
test("bad pins/network/restore stop before worker construction", async () => {
  let reads = 0;
  const forbidden = () => {
    throw new Error("must not construct worker");
  };
  const restore = () => {
    reads++;
    throw new Error(marker);
  };
  const pin = await simulate(null, {
    runtime: { provenance: { recipeSha: "0".repeat(64) } },
    restore,
    makeWorker: forbidden,
  });
  assert.equal(pin.status, "TRUST_PIN_MISMATCH");
  const network = await simulate(null, {
    offline: () => assertOfflineSnapshot({ ...snapshot, socketOwned: false }),
    restore,
    makeWorker: forbidden,
  });
  assert.equal(network.status, "NETWORK_NOT_BLOCKED");
  assert.equal(reads, 0);
  const corrupt = await simulate(null, { restore, makeWorker: forbidden });
  assert.equal(corrupt.status, "REPLAY_ERROR");
  assert.equal(corrupt.g1Verdict, "UNKNOWN");
});
test("public projection permits only exact enums/regex fields and strips arbitrary extras", () => {
  assert.equal(
    JSON.stringify(
      publicResult({ ...initialResult(), stdout: marker }),
    ).includes(marker),
    false,
  );
  for (const patch of [
    { status: marker },
    { runId: marker },
    { headSha: marker },
    { candidateSha: marker },
    { recipeSha: marker },
    { g1Verdict: marker },
    { phase: marker },
    { phaseCode: marker },
    { cleanup: marker },
    { zeroOwnedResources: marker },
    { executedTestIds: [marker] },
    { provisionElapsedMs: marker },
    { headSha: [HISTORICAL.identity.headSha] },
  ])
    assert.throws(() => publicResult({ ...initialResult(), ...patch }));
});
test("bounded handoff rejects EOF, timeout, cancellation and arbitrary input", async () => {
  const input = new PassThrough();
  const ready = waitForOwner(input, undefined, 1000);
  input.write("OWNER_OFFLINE_READY\n");
  await ready;
  for (const text of [marker, "OWNER_OFFLINE_READY\nextra", "x".repeat(65)]) {
    const stream = new PassThrough();
    const pending = waitForOwner(stream, undefined, 100);
    stream.end(text);
    await assert.rejects(pending);
  }
  await assert.rejects(waitForOwner(new PassThrough(), undefined, 1));
  await assert.rejects(
    waitForOwner(new PassThrough(), AbortSignal.abort(), 100),
  );
});
test("failed preparation inventories and reaps only its exact provenance name", async () => {
  const calls = [],
    state = initialResult();
  const name = "mmp007-provenance-00000000-0000-4000-8000-000000000000";
  await assert.rejects(
    prepareRuntime(
      state,
      async (record) => {
        await record("runtime-provenance.json", {
          args: ["run", "--name", name],
        });
        throw new Error(marker);
      },
      async (args) => {
        calls.push(args);
        return { exitCode: 0, stdout: name };
      },
    ),
  );
  assert.equal(state.cleanup, "CLEANUP_ERROR");
  assert.deepEqual(calls[1], ["rm", "--force", name]);
});
test("CLI refuses agent/noninteractive context without reading private files or printing paths", () => {
  const run = spawnSync(
    process.execPath,
    ["research/mmp-176/replay.mjs", "--owner-only", marker],
    { encoding: "utf8" },
  );
  assert.equal(run.status, 1);
  assert.equal(run.stderr, "");
  assert.equal(run.stdout.includes(marker), false);
  assert.equal(JSON.parse(run.stdout).status, "OWNER_CONTEXT_REQUIRED");
});
test("missing Docker executable is a real spawn refusal, not a successful G1", () => {
  const run = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      'import {command} from "./packages/target-worker/src/controller.mjs"; const r=await command(["version"]); process.exit(r.spawnError==="ENOENT" && r.exitCode!==0 ? 0 : 1);',
    ],
    {
      env: {
        PATH: "/mmp176-nonexistent-test-bin",
        SystemRoot: process.env.SystemRoot,
      },
      encoding: "utf8",
    },
  );
  assert.equal(run.status, 0);
  assert.equal(run.stdout.includes(marker), false);
});
test("network reactivation after provisioning still closes the owned worker", async () => {
  const worker = workerFor([phase("typecheck"), phase("build")]);
  let count = 0;
  const result = await simulate(worker, {
    offline: () => {
      if (++count === 3)
        assertOfflineSnapshot({ ...snapshot, socketOwned: false });
    },
  });
  assert.equal(result.status, "NETWORK_NOT_BLOCKED");
  assert.equal(worker.closed, true);
  assert.equal(result.zeroOwnedResources, true);
});
