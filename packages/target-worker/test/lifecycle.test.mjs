// Trusted Docker CLI model only. No admitted TS/JS is imported or executed.
import assert from "node:assert/strict";
import test from "node:test";
import { sha256, validateBundle } from "../src/admission.mjs";
import { TargetWorker } from "../src/controller.mjs";

const imageId = `sha256:${"a".repeat(64)}`;
const content = "export const value = 1;";
const bundle = validateBundle([
  { path: "src/main.ts", content, sha256: sha256(content) },
]);
const artifact = { path: "main.js", base64: "eA==", sha256: sha256("x") };
function harness(options = {}) {
  const containers = new Map();
  const volumes = new Set();
  const executions = new Map();
  const calls = [];
  let sequence = 0;
  let now = 0;
  let probes = 0;
  let observationsBlocked = false;
  const receipt = (args, value = "", exitCode = 0) => ({
    args,
    exitCode,
    stdout: typeof value === "string" ? value : JSON.stringify(value),
    stderr: "",
    timedOut: false,
    cancelled: false,
    signal: null,
    spawnError: null,
  });
  const execute = async (args, config) => {
    calls.push(args);
    const failed = options.fail?.(args, { containers, volumes });
    if (failed) return receipt(args, "", failed);
    if (args[0] === "image") return receipt(args, [{ Id: imageId }]);
    if (args[0] === "volume" && args[1] === "create") {
      volumes.add(args.at(-1));
      if (options.blockVolume)
        return new Promise((resolve) => {
          const abort = () => resolve({ ...receipt(args), cancelled: true });
          config.signal.addEventListener("abort", abort, { once: true });
          options.onBlocked?.();
        });
      return receipt(args);
    }
    if (args[0] === "run") {
      const name = args[args.indexOf("--name") + 1];
      const id = (++sequence).toString(16).padStart(64, "0");
      containers.set(name, id);
      if (args.includes("/opt/worker/build.mjs"))
        return receipt(
          args,
          {
            checks: [{ exitCode: 0 }, { exitCode: 0 }],
            artifacts: [artifact],
          },
          options.buildExit ?? 0,
        );
      if (args.includes("/opt/worker/inspect.mjs")) {
        const action = JSON.parse(args.at(-1));
        if (action.kind === "readiness") {
          probes++;
          if (options.advance) now += options.advance;
          if (options.earlyExit)
            executions
              .values()
              .next()
              .value?.(receipt(["exec"], "", 7));
          if (options.blockProbe)
            return new Promise((resolve) => {
              const abort = () =>
                resolve({ ...receipt(args), cancelled: true });
              config.signal.addEventListener("abort", abort, { once: true });
              options.onBlocked?.();
            });
          return receipt(args, {
            ...action,
            ready: probes > (options.refusals ?? 0),
            reason: "CONNECTION_REFUSED",
            ...options.probe,
          });
        }
        if (observationsBlocked)
          return new Promise((resolve) => {
            config.signal.addEventListener(
              "abort",
              () => resolve({ ...receipt(args), cancelled: true }),
              { once: true },
            );
            options.onObservationBlocked?.();
          });
        return receipt(args, {
          status: 200,
          requestId: action.requestId,
          headers: { "x-request-id": action.requestId },
          bodyBase64: "e30=",
        });
      }
      return receipt(args, id);
    }
    if (args[0] === "inspect") {
      const id = containers.get(args.at(-1));
      if (args.includes("--format")) return receipt(args, { Running: true });
      return receipt(args, [{ Id: id, State: { Running: true } }]);
    }
    if (args[0] === "exec")
      return new Promise((resolve) => {
        const name = args[2];
        const finish = (value) => {
          executions.delete(name);
          resolve(value);
        };
        executions.set(name, finish);
        config.signal.addEventListener(
          "abort",
          () => finish({ ...receipt(args), cancelled: true }),
          { once: true },
        );
      });
    if (["stop", "kill", "rm"].includes(args[0])) {
      executions.get(args.at(-1))?.(receipt(["exec"], "", 137));
      if (args[0] === "rm") containers.delete(args.at(-1));
      return receipt(args);
    }
    if (args[0] === "volume" && args[1] === "rm") {
      volumes.delete(args.at(-1));
      return receipt(args);
    }
    if (args[0] === "container")
      return receipt(args, [...containers.keys()].join("\n"));
    if (args[0] === "volume" && args[1] === "ls")
      return receipt(args, [...volumes].join("\n"));
    throw new Error(`Unmodelled trusted command: ${args.join(" ")}`);
  };
  const worker = new TargetWorker({ imageId }, bundle, "real", {
    trustedTest: { command: execute, now: () => now, policy: options.policy },
  });
  return {
    worker,
    calls,
    containers,
    volumes,
    advance: (ms) => {
      now += ms;
    },
    blockObservations: () => {
      observationsBlocked = true;
    },
  };
}

test("arbitrary digest/object cannot masquerade as broker-issued runtime", () => {
  for (const value of [
    imageId,
    { imageId },
    { imageId, provenance: { verified: true } },
  ])
    assert.throws(() => new TargetWorker(value, bundle), /ADMISSION_REJECTED/);
});

test("reset readiness allows immediate request; eight resets retain exactly one pair", async () => {
  const h = harness({ refusals: 1 });
  await h.worker.provision();
  const deadline = h.worker.endsAt;
  for (let index = 0; index < 8; index++) {
    const prior = h.worker.runtime.id;
    const result = await h.worker.reset(`scenario-${index}`);
    assert.notEqual(result.runtimeId, prior);
    assert.equal(
      (await h.worker.request("immediate", "GET", "/items")).status,
      200,
    );
    assert.equal(h.containers.size, 1);
    assert.equal(h.volumes.size, 1);
    assert.equal(h.worker.endsAt, deadline);
    assert.equal(h.worker.containers.size, 1);
  }
  await h.worker.close();
  await h.worker.close();
  await h.worker.kill();
  assert.equal(h.containers.size + h.volumes.size, 0);
  assert.equal(h.worker.evidence.cleanupVerified, true);
  assert.ok(
    h.worker.evidence.cleanup.some((item) => item.execution?.exitCode === 137),
  );
  await assert.rejects(h.worker.reset("closed"), /RUNTIME_FAILED/);
});

for (const [name, options, code] of [
  ["never listener", { refusals: Infinity, advance: 6000 }, "TIMEOUT"],
  ["late ready after startup deadline", { advance: 10001 }, "TIMEOUT"],
  [
    "wrong response",
    { probe: { ready: false, reason: "WRONG_RESPONSE" } },
    "RUNTIME_FAILED",
  ],
  [
    "malformed HTTP",
    { probe: { ready: false, reason: "MALFORMED_HTTP" } },
    "RUNTIME_FAILED",
  ],
  [
    "hung probe",
    { probe: { ready: false, reason: "HTTP_TIMEOUT" } },
    "TIMEOUT",
  ],
  ["early exit", { earlyExit: true }, "RUNTIME_FAILED"],
  [
    "stale generation",
    { probe: { runtimeId: "0".repeat(64) } },
    "OBSERVATION_ERROR",
  ],
  ["stale scenario", { probe: { scenarioId: "old" } }, "OBSERVATION_ERROR"],
  ["compiler failure", { buildExit: 2 }, "BUILD_FAILED"],
  ["Docker build infrastructure", { buildExit: 125 }, "ENVIRONMENT_ERROR"],
])
  test(`${name} rejects and reaps partial resources`, async () => {
    const h = harness(options);
    await assert.rejects(h.worker.provision(), new RegExp(code));
    assert.equal(h.containers.size + h.volumes.size, 0);
    assert.equal(h.worker.evidence.cleanupVerified, true);
    await assert.rejects(h.worker.reset("failed"), /RUNTIME_FAILED/);
    await h.worker.close();
  });

test("aggregate monotonic budget includes build/reset/probes; stale success cannot escape", async () => {
  const h = harness({ advance: 20, policy: { lifetimeMs: 50 } });
  await h.worker.provision();
  await h.worker.reset("second");
  await assert.rejects(h.worker.reset("expired"), /TIMEOUT/);
  assert.equal(h.worker.endsAt, 50);
  assert.equal(h.containers.size + h.volumes.size, 0);
  await h.worker.close();
});

test("trusted reset and step caps fail closed at their exact boundary", async () => {
  for (const policy of [{ maxResets: 2 }, { maxOperations: 2 }]) {
    const h = harness({ policy });
    await h.worker.provision();
    await h.worker.reset("allowed");
    await assert.rejects(h.worker.reset("excess"), /LIMIT/);
    assert.equal(h.containers.size + h.volumes.size, 0);
    await h.worker.close();
  }
});

for (const mode of ["blockVolume", "blockProbe"])
  test(`abort during ${mode} joins and cleans`, async () => {
    const abort = new AbortController();
    const h = harness({ [mode]: true, onBlocked: () => abort.abort() });
    await assert.rejects(h.worker.provision(abort.signal), /CANCELLED/);
    assert.equal(h.containers.size + h.volumes.size, 0);
    await h.worker.close();
  });

test("close cancels and joins active reset; concurrent reset is BUSY", async () => {
  let blocked;
  const barrier = new Promise((resolve) => {
    blocked = resolve;
  });
  const h = harness({ blockProbe: true, onBlocked: blocked });
  const provision = h.worker.provision();
  await barrier;
  await assert.rejects(h.worker.reset("racy"), /BUSY/);
  const rejection = assert.rejects(provision, /CANCELLED/);
  await h.worker.close();
  await rejection;
  assert.equal(h.containers.size + h.volumes.size, 0);
});

for (const kind of ["request", "snapshot"])
  test(`close joins active ${kind} before deleting volume`, async () => {
    let blocked;
    const barrier = new Promise((resolve) => {
      blocked = resolve;
    });
    const h = harness({ onObservationBlocked: blocked });
    await h.worker.provision();
    h.blockObservations();
    const observation =
      kind === "request"
        ? h.worker.request("pending", "GET", "/items")
        : h.worker.snapshot("pending");
    await barrier;
    const rejected = assert.rejects(observation, /CANCELLED/);
    await h.worker.close();
    await rejected;
    assert.equal(h.containers.size + h.volumes.size, 0);
  });

test("real host timer expires pending work and auto-reaps without caller close", async () => {
  const watchdog = setTimeout(() => {}, 2000);
  try {
    const h = harness({ blockProbe: true, policy: { lifetimeMs: 40 } });
    await assert.rejects(h.worker.provision(), /TIMEOUT/);
    await h.worker.expiration;
    assert.equal(h.containers.size + h.volumes.size, 0);
    assert.equal(h.worker.evidence.cleanupVerified, true);
  } finally {
    clearTimeout(watchdog);
  }
});

for (const fault of ["stop", "rm", "volume-rm", "inspect"])
  test(`${fault} failure cannot claim cleanup success`, async () => {
    let enabled = false;
    const h = harness({
      fail: (args) =>
        enabled &&
        (args[0] === fault ||
          (fault === "volume-rm" && args[0] === "volume" && args[1] === "rm"))
          ? 1
          : 0,
    });
    if (fault === "inspect") {
      enabled = true;
      await assert.rejects(
        h.worker.provision(),
        /ENVIRONMENT_ERROR|CLEANUP_ERROR/,
      );
    } else {
      await h.worker.provision();
      enabled = true;
      await assert.rejects(h.worker.close(), /CLEANUP_ERROR/);
      assert.equal(h.worker.evidence.cleanupVerified, false);
      if (fault === "stop")
        assert.ok(h.calls.some((args) => args[0] === "kill"));
    }
    enabled = false;
    if (h.worker.evidence.cleanupError)
      await assert.rejects(h.worker.close(), /CLEANUP_ERROR/);
    else await h.worker.close();
    assert.equal(h.containers.size + h.volumes.size, 0);
  });

test("empty tracking sets never establish absence when Docker inventory has residue", async () => {
  const h = harness();
  h.containers.set(`${h.worker.runId}-untracked`, "f".repeat(64));
  await assert.rejects(h.worker.close(), /CLEANUP_ERROR/);
  assert.equal(h.worker.evidence.cleanupVerified, false);
  h.containers.clear();
  await assert.rejects(h.worker.close(), /CLEANUP_ERROR/);
});

test("inspector removal failure overrides observation and retains names for bounded retry", async () => {
  let failRemoval = false;
  const h = harness({
    fail: (args) =>
      failRemoval && args[0] === "rm" && args.at(-1).includes("-inspect-")
        ? 1
        : 0,
  });
  await h.worker.provision();
  failRemoval = true;
  await assert.rejects(
    h.worker.request("cleanup-fault", "GET", "/items"),
    /CLEANUP_ERROR/,
  );
  assert.equal(h.worker.evidence.cleanupVerified, false);
  assert.equal(h.volumes.size, 0);
  assert.ok(
    [...h.worker.containers].some((name) => name.includes("-inspect-")),
  );
  failRemoval = false;
  await assert.rejects(h.worker.close(), /CLEANUP_ERROR/);
  assert.equal(h.containers.size + h.volumes.size, 0);
  assert.equal(h.worker.evidence.cleanupVerified, false);
});
