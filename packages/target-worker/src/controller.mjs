import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { sha256, validateBundle } from "./admission.mjs";
import { isTrustedRuntime } from "./runtime-broker.mjs";

export const POLICY = Object.freeze({
  memoryMiB: 256,
  cpus: 1,
  pids: 64,
  operationTimeoutMs: 15000,
  lifetimeMs: 180000,
  startupTimeoutMs: 10000,
  cleanupGraceMs: 10000,
  maxResets: 16,
  maxOperations: 128,
});
export const FIXED_ENV = [
  "--env",
  "LD_PRELOAD=/usr/lib/x86_64-linux-gnu/faketime/libfaketime.so.1",
  "--env",
  "FAKETIME=2026-10-27 12:00:00",
  "--env",
  "FAKETIME_DONT_FAKE_MONOTONIC=1",
];
export function sandboxArgs(name, network = "none") {
  return [
    "--name",
    name,
    "--label",
    "metamorph.target-worker=true",
    "--init",
    "--network",
    network,
    "--read-only",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--cpus",
    "1",
    "--memory",
    "256m",
    "--memory-swap",
    "256m",
    "--pids-limit",
    "64",
    "--ulimit",
    "nofile=128:128",
    "--stop-timeout",
    "1",
    "--tmpfs",
    "/work:rw,nosuid,nodev,size=64m,uid=10001,gid=10001,mode=0700",
    "--tmpfs",
    "/tmp:rw,nosuid,nodev,noexec,size=16m,mode=1777",
  ];
}

// No shell, no candidate executable on host; only trusted Docker CLI is invoked.
export async function command(args, { input, timeoutMs = 15000, signal } = {}) {
  const started = performance.now();
  return new Promise((resolve) => {
    const proc = spawn("docker", args, {
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const chunks = { stdout: [], stderr: [] };
    let size = 0;
    let timedOut = false;
    let overflow = false;
    let spawnError = null;
    const terminate = () => proc.kill("SIGKILL");
    const timer = setTimeout(() => {
      timedOut = true;
      terminate();
    }, timeoutMs);
    const cancel = () => terminate();
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) cancel();
    for (const channel of ["stdout", "stderr"])
      proc[channel].on("data", (chunk) => {
        size += chunk.length;
        if (size > 4 * 1024 * 1024) {
          overflow = true;
          terminate();
        } else chunks[channel].push(chunk);
      });
    proc.on("error", (error) => {
      spawnError = error.code;
    });
    proc.stdin.on("error", () => {});
    proc.on("close", (exitCode, exitSignal) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
      resolve({
        args,
        exitCode,
        signal: exitSignal,
        spawnError,
        timedOut,
        cancelled: signal?.aborted ?? false,
        overflow,
        elapsedMs: performance.now() - started,
        stdout: Buffer.concat(chunks.stdout).toString(),
        stderr: Buffer.concat(chunks.stderr).toString(),
      });
    });
    proc.stdin.end(input);
  });
}
export class WorkerError extends Error {
  constructor(message) {
    super(message);
    this.name = "WorkerError";
    this.code = message.split(":")[0];
  }
}
export function requireSuccess(result, failure = "ENVIRONMENT_ERROR") {
  if (result.cancelled) throw new WorkerError("CANCELLED");
  if (result.timedOut) throw new WorkerError("TIMEOUT");
  if (result.exitCode !== 0 || result.overflow || result.spawnError)
    throw new WorkerError(failure);
  return result;
}
export function parseObservation(result, kind) {
  requireSuccess(result, "OBSERVATION_ERROR");
  let value;
  try {
    value = JSON.parse(result.stdout);
  } catch {
    throw new WorkerError("OBSERVATION_ERROR: JSON");
  }
  if (!value || typeof value !== "object")
    throw new WorkerError("OBSERVATION_ERROR");
  if (kind === "http") {
    if (
      !Number.isInteger(value.status) ||
      value.status < 100 ||
      value.status > 599 ||
      typeof value.bodyBase64 !== "string" ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
        value.bodyBase64,
      ) ||
      !value.headers ||
      typeof value.requestId !== "string"
    )
      throw new WorkerError("OBSERVATION_ERROR: HTTP");
  } else if (
    value.format !== "target-worker-sqlite-v1-proposed" ||
    value.source !== "/state/target.sqlite" ||
    !Array.isArray(value.schema) ||
    !Array.isArray(value.tables)
  )
    throw new WorkerError("OBSERVATION_ERROR: DB");
  return value;
}

// The host API is trusted. The only injection seam replaces Docker entirely and
// is explicitly for unit fault simulations; it cannot attest a production image.
export class TargetWorker {
  constructor(
    runtime,
    bundle,
    clock = "real",
    { trustedTest, limits = {} } = {},
  ) {
    if (
      (!isTrustedRuntime(runtime) &&
        typeof trustedTest?.command !== "function") ||
      !/^sha256:[a-f0-9]{64}$/.test(runtime?.imageId) ||
      !["real", "fixed-experiment"].includes(clock)
    )
      throw new WorkerError("ADMISSION_REJECTED: trusted runtime required");
    for (const [key, value] of Object.entries(limits)) {
      if (
        ![
          "lifetimeMs",
          "operationTimeoutMs",
          "startupTimeoutMs",
          "cleanupGraceMs",
          "maxResets",
          "maxOperations",
        ].includes(key) ||
        !Number.isSafeInteger(value) ||
        value < 1 ||
        value > POLICY[key]
      )
        throw new WorkerError("ADMISSION_REJECTED: limits");
    }
    this.image = runtime.imageId;
    this.provenance = runtime.provenance;
    this.bundle = validateBundle(bundle.files, bundle.candidateSha);
    this.clock = clock;
    this.execute = trustedTest?.command ?? command;
    this.now = trustedTest?.now ?? (() => performance.now());
    this.policy = Object.freeze({
      ...POLICY,
      ...limits,
      ...trustedTest?.policy,
    });
    this.runId = `mmp007-${randomUUID()}`;
    this.containers = new Set();
    this.volumes = new Set();
    this.state = "new";
    this.resetCount = 0;
    this.operationCount = 0;
    this.workAbort = new AbortController();
    this.evidence = {
      runId: this.runId,
      candidateSha: this.bundle.candidateSha,
      policy: this.policy,
      clock,
      imageId: this.image,
      provenance: this.provenance ?? "TRUSTED_TEST_SIMULATION",
      commands: [],
      cleanup: [],
      readiness: [],
      cleanupVerified: false,
    };
  }
  startBudget() {
    if (this.endsAt !== undefined) return;
    this.startedAt = this.now();
    this.endsAt = this.startedAt + this.policy.lifetimeMs;
    this.evidence.budgetStart = "first-operation";
    this.deadline = setTimeout(() => this.expire(), this.policy.lifetimeMs);
    this.deadline.unref?.();
  }
  expire() {
    this.expired = true;
    this.workAbort.abort();
    this.expiration ??= this.close().catch(() => {
      this.evidence.expirationError = "CLEANUP_ERROR";
    });
  }
  check(signal) {
    if (this.endsAt !== undefined && this.now() >= this.endsAt)
      this.expired = true;
    if (this.expired) throw new WorkerError("TIMEOUT");
    if (signal?.aborted || this.workAbort.signal.aborted)
      throw new WorkerError("CANCELLED");
  }
  async cmd(args, options = {}) {
    const cleanup = options.cleanup === true;
    if (!cleanup) this.check(options.signal);
    const remaining = cleanup
      ? this.cleanupEndsAt - this.now()
      : this.endsAt - this.now();
    if (remaining <= 0)
      throw new WorkerError(cleanup ? "CLEANUP_ERROR" : "TIMEOUT");
    const signal = cleanup
      ? undefined
      : AbortSignal.any([
          this.workAbort.signal,
          ...(options.signal ? [options.signal] : []),
        ]);
    const result = await this.execute(args, {
      input: options.input,
      timeoutMs: Math.max(
        1,
        Math.min(
          options.timeoutMs ?? this.policy.operationTimeoutMs,
          remaining,
        ),
      ),
      signal,
    });
    this.evidence.commands.push(result);
    if (!cleanup && !options.background) this.check(options.signal);
    return result;
  }
  track(kind, name) {
    (kind === "container" ? this.containers : this.volumes).add(name);
    this.evidence.cleanupVerified = false;
  }
  // One mutation at a time. close()/kill() cancel and join it, then reap.
  async operation(fn, signal) {
    if (this.expired) throw new WorkerError("TIMEOUT");
    if (this.active) throw new WorkerError("RUNTIME_FAILED: BUSY");
    if (["failed", "closing", "closed"].includes(this.state))
      throw new WorkerError("RUNTIME_FAILED: CLOSED");
    this.startBudget();
    const pending = (async () => {
      try {
        this.check(signal);
        if (++this.operationCount > this.policy.maxOperations)
          throw new WorkerError("RUNTIME_FAILED: OPERATION_LIMIT");
        const value = await fn();
        this.check(signal);
        return value;
      } catch (error) {
        this.state = "failed";
        this.evidence.operationError = error.message.split(":")[0];
        // Cleanup is mandatory even when volume/container creation only partly ran.
        try {
          await this.cleanupAll();
        } catch {
          throw new WorkerError("CLEANUP_ERROR");
        }
        throw error;
      }
    })();
    this.active = pending;
    try {
      return await pending;
    } finally {
      if (this.active === pending) this.active = null;
    }
  }
  provision(signal) {
    return this.operation(async () => {
      if (this.state !== "new")
        throw new WorkerError("RUNTIME_FAILED: ALREADY_PROVISIONED");
      const identity = JSON.parse(
        requireSuccess(
          await this.cmd(["image", "inspect", this.image], { signal }),
        ).stdout,
      )[0];
      if (identity?.Id !== this.image)
        throw new WorkerError("ENVIRONMENT_ERROR");
      const name = `${this.runId}-build`;
      this.track("container", name);
      const built = await this.cmd(
        [
          "run",
          "--interactive",
          ...sandboxArgs(name),
          this.image,
          "node",
          "/opt/worker/build.mjs",
        ],
        { input: JSON.stringify(this.bundle.files), timeoutMs: 35000, signal },
      );
      this.evidence.build = built;
      requireSuccess(
        built,
        built.exitCode === 2 ? "BUILD_FAILED" : "ENVIRONMENT_ERROR",
      );
      let output;
      try {
        output = JSON.parse(built.stdout);
      } catch {
        throw new WorkerError("BUILD_FAILED");
      }
      if (
        !Array.isArray(output.checks) ||
        output.checks.length !== 2 ||
        output.checks.some((c) => c.exitCode !== 0) ||
        !Array.isArray(output.artifacts) ||
        output.artifacts.length > 64
      )
        throw new WorkerError("BUILD_FAILED");
      let total = 0;
      for (const artifact of output.artifacts) {
        const bytes = Buffer.from(artifact.base64, "base64");
        total += bytes.length;
        if (
          !/^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.js$/.test(artifact.path) ||
          sha256(bytes) !== artifact.sha256 ||
          total > 2 * 1024 * 1024
        )
          throw new WorkerError("BUILD_FAILED");
      }
      if (!output.artifacts.some((f) => f.path === "main.js"))
        throw new WorkerError("BUILD_FAILED");
      this.artifacts = output.artifacts;
      this.evidence.artifactSha = sha256(JSON.stringify(output.artifacts));
      this.evidence.buildChecks = output.checks;
      await this.cleanupAll(); // build container must not survive provision
      return this.resetInternal("public-initial", signal);
    }, signal);
  }
  reset(scenarioId, signal) {
    return this.operation(() => this.resetInternal(scenarioId, signal), signal);
  }
  async resetInternal(scenarioId, signal) {
    if (!/^[A-Za-z0-9:_-]{1,100}$/.test(scenarioId) || !this.artifacts)
      throw new WorkerError("ADMISSION_REJECTED: scenario/build");
    if (++this.resetCount > this.policy.maxResets)
      throw new WorkerError("RUNTIME_FAILED: RESET_LIMIT");
    await this.cleanupAll();
    this.check(signal);
    const suffix = randomUUID();
    const volume = `${this.runId}-${suffix}-db`;
    const name = `${this.runId}-${suffix}-runtime`;
    this.track("volume", volume);
    requireSuccess(
      await this.cmd(
        ["volume", "create", "--label", "metamorph.target-worker=true", volume],
        { signal },
      ),
    );
    this.track("container", name);
    // Track before running: CLI cancellation does not establish that Docker did not create it.
    const runtime = {
      name,
      volume,
      scenarioId,
      ended: new AbortController(),
      launchAbort: new AbortController(),
    };
    this.runtime = runtime;
    requireSuccess(
      await this.cmd(
        [
          "run",
          "--detach",
          ...sandboxArgs(name),
          "--mount",
          `type=volume,source=${volume},target=/state`,
          this.image,
        ],
        { signal },
      ),
    );
    const inspected = JSON.parse(
      requireSuccess(await this.cmd(["inspect", name], { signal })).stdout,
    )[0];
    if (
      !/^([a-f0-9]{64})$/.test(inspected?.Id) ||
      inspected.State?.Running !== true
    )
      throw new WorkerError("ENVIRONMENT_ERROR");
    runtime.id = inspected.Id;
    this.evidence.runtimeInspect = inspected;
    // Launch has its own bounded CLI lifetime and is not cancelled by the signal
    // of the reset after that operation succeeds. Whole-container cleanup is authoritative.
    runtime.execution = this.cmd(
      [
        "exec",
        "--interactive",
        ...(this.clock === "fixed-experiment" ? FIXED_ENV : []),
        name,
        "node",
        "/opt/worker/launch.mjs",
      ],
      {
        input: JSON.stringify(this.artifacts),
        timeoutMs: this.endsAt - this.now(),
        background: true,
        signal: runtime.launchAbort.signal,
      },
    ).then(
      (receipt) => {
        runtime.exit = receipt;
        runtime.ended.abort();
        return receipt;
      },
      (error) => {
        runtime.executionError = error.message.split(":")[0];
        runtime.ended.abort();
        return null;
      },
    );
    await this.readiness(runtime, signal);
    this.state = "ready";
    return {
      runId: this.runId,
      candidateSha: this.bundle.candidateSha,
      imageId: this.image,
      runtimeId: runtime.id,
      scenarioId,
      policy: this.policy,
    };
  }
  assertRuntime(runtime) {
    if (
      !runtime ||
      runtime !== this.runtime ||
      runtime.exit ||
      runtime.executionError
    )
      throw new WorkerError("RUNTIME_FAILED");
  }
  async readiness(runtime, signal) {
    const until = Math.min(
      this.endsAt,
      this.now() + this.policy.startupTimeoutMs,
    );
    while (true) {
      this.check(signal);
      this.assertRuntime(runtime);
      if (this.now() >= until) throw new WorkerError("TIMEOUT");
      const requestId = randomUUID();
      let result;
      try {
        result = await this.observe(
          {
            kind: "readiness",
            requestId,
            runtimeId: runtime.id,
            scenarioId: runtime.scenarioId,
          },
          signal,
          until - this.now(),
        );
      } catch (error) {
        this.check(signal);
        this.assertRuntime(runtime);
        throw error;
      }
      this.evidence.readiness.push(result);
      this.assertRuntime(runtime);
      if (
        result.requestId !== requestId ||
        result.runtimeId !== runtime.id ||
        result.scenarioId !== runtime.scenarioId
      )
        throw new WorkerError("OBSERVATION_ERROR");
      if (result.ready === true) {
        const state = JSON.parse(
          requireSuccess(
            await this.cmd(
              ["inspect", "--format", "{{json .State}}", runtime.id],
              { signal },
            ),
          ).stdout,
        );
        this.assertRuntime(runtime);
        if (state.Running !== true) throw new WorkerError("RUNTIME_FAILED");
        return;
      }
      if (result.reason === "HTTP_TIMEOUT") throw new WorkerError("TIMEOUT");
      if (result.reason !== "CONNECTION_REFUSED")
        throw new WorkerError("RUNTIME_FAILED");
      // Only the controller polls; no arbitrary client sleep before a request.
      await new Promise((resolve, reject) => {
        const combined = AbortSignal.any([
          this.workAbort.signal,
          runtime.ended.signal,
          ...(signal ? [signal] : []),
        ]);
        const done = () => {
          clearTimeout(timer);
          combined.removeEventListener("abort", cancel);
        };
        const cancel = () => {
          done();
          reject(
            new Error(
              this.expired
                ? "TIMEOUT"
                : runtime.ended.signal.aborted
                  ? "RUNTIME_FAILED"
                  : "CANCELLED",
            ),
          );
        };
        const timer = setTimeout(
          () => {
            done();
            resolve();
          },
          Math.min(75, until - this.now()),
        );
        combined.addEventListener("abort", cancel, { once: true });
        if (combined.aborted) cancel();
      });
    }
  }
  async observe(action, signal, timeoutMs) {
    const runtime = this.runtime;
    this.assertRuntime(runtime);
    const name = `${this.runId}-inspect-${randomUUID()}`;
    this.track("container", name);
    let value;
    let failure;
    try {
      const network =
        action.kind === "snapshot" ? "none" : `container:${runtime.id}`;
      const mounts =
        action.kind === "snapshot"
          ? [
              "--mount",
              `type=volume,source=${runtime.volume},target=/state,readonly`,
            ]
          : [];
      const result = await this.cmd(
        [
          "run",
          ...sandboxArgs(name, network),
          "--user",
          "10002:10002",
          "--workdir",
          "/tmp",
          ...mounts,
          this.image,
          "node",
          "/opt/worker/inspect.mjs",
          JSON.stringify(action),
        ],
        {
          signal: AbortSignal.any([
            runtime.ended.signal,
            ...(signal ? [signal] : []),
          ]),
          timeoutMs,
        },
      );
      this.assertRuntime(runtime);
      requireSuccess(
        result,
        result.exitCode === 1 ? "OBSERVATION_ERROR" : "ENVIRONMENT_ERROR",
      );
      if (action.kind === "readiness") {
        try {
          value = JSON.parse(result.stdout);
        } catch {
          throw new WorkerError("OBSERVATION_ERROR");
        }
        if (!value || typeof value.ready !== "boolean")
          throw new WorkerError("OBSERVATION_ERROR");
      } else value = parseObservation(result, action.kind);
    } catch (error) {
      failure = error;
    }
    await this.cleanupInspector(name);
    if (failure) {
      this.check(signal);
      this.assertRuntime(runtime);
      throw failure;
    }
    this.check(signal);
    this.assertRuntime(runtime);
    return value;
  }
  request(stepId, method, path, body, signal) {
    return this.operation(async () => {
      if (
        !/^[A-Za-z0-9:_-]{1,100}$/.test(stepId) ||
        !["GET", "POST"].includes(method) ||
        typeof path !== "string" ||
        !/^\/[a-zA-Z0-9/?=&_-]*$/.test(path) ||
        (body !== undefined &&
          (typeof body !== "string" || Buffer.byteLength(body) > 4096))
      )
        throw new WorkerError("ADMISSION_REJECTED: request");
      const requestId = randomUUID();
      const capture = await this.observe(
        { kind: "http", method, path, body, requestId },
        signal,
      );
      if (
        capture.requestId !== requestId ||
        capture.headers["x-request-id"] !== requestId
      )
        throw new WorkerError("OBSERVATION_ERROR");
      return { ...capture, stepId };
    }, signal);
  }
  snapshot(stepId, signal) {
    return this.operation(async () => {
      this.assertRuntime(this.runtime);
      return {
        stepId,
        runtimeId: this.runtime.id,
        volume: this.runtime.volume,
        ...(await this.observe({ kind: "snapshot" }, signal)),
      };
    }, signal);
  }
  async inventory() {
    const containers = requireSuccess(
      await this.cmd(
        [
          "container",
          "ls",
          "--all",
          "--filter",
          "label=metamorph.target-worker=true",
          "--format",
          "{{.Names}}",
        ],
        { cleanup: true, timeoutMs: 2000 },
      ),
    )
      .stdout.trim()
      .split(/\s+/);
    const volumes = requireSuccess(
      await this.cmd(
        [
          "volume",
          "ls",
          "--filter",
          "label=metamorph.target-worker=true",
          "--format",
          "{{.Name}}",
        ],
        { cleanup: true, timeoutMs: 2000 },
      ),
    )
      .stdout.trim()
      .split(/\s+/);
    return {
      containers: containers.filter((n) => n.startsWith(this.runId)),
      volumes: volumes.filter((n) => n.startsWith(this.runId)),
    };
  }
  async remove(kind, name) {
    const args =
      kind === "container" ? ["rm", "--force", name] : ["volume", "rm", name];
    let failed = false;
    // Retry even if the CLI failed: Docker may have completed the deletion.
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await this.cmd(args, { cleanup: true, timeoutMs: 2000 });
      if (result.exitCode === 0 && !result.timedOut && !result.spawnError)
        break;
      failed = true;
    }
    const inventory = await this.inventory();
    const present = (
      kind === "container" ? inventory.containers : inventory.volumes
    ).includes(name);
    this.evidence.cleanup.push({ kind, name, present, commandFailed: failed });
    if (!present)
      (kind === "container" ? this.containers : this.volumes).delete(name);
    if (present || failed) {
      this.evidence.cleanupError = "CLEANUP_ERROR";
      throw new WorkerError("CLEANUP_ERROR");
    }
  }
  async cleanupInspector(name) {
    // Cleanup may finish within its separate grace. The operation checks the
    // unchanged work deadline afterwards; cleanup can never renew useful work.
    this.cleanupEndsAt = this.now() + this.policy.cleanupGraceMs;
    await this.remove("container", name);
  }
  async cleanupAll() {
    if (this.cleaning) return this.cleaning;
    const pending = this.reap();
    this.cleaning = pending;
    try {
      return await pending;
    } finally {
      this.cleaning = null;
    }
  }
  async reap() {
    this.cleanupEndsAt = this.now() + this.policy.cleanupGraceMs;
    let failed = false;
    const attempt = async (fn) => {
      try {
        return await fn();
      } catch {
        failed = true;
        this.evidence.cleanupError = "CLEANUP_ERROR";
        return null;
      }
    };
    const runtime = this.runtime;
    if (runtime) {
      const stopped = await attempt(() =>
        this.cmd(["stop", "--time", "1", runtime.name], {
          cleanup: true,
          timeoutMs: 2000,
        }),
      );
      if (stopped?.exitCode !== 0 || stopped.timedOut || stopped.spawnError) {
        failed = true;
        this.evidence.cleanupError = "CLEANUP_ERROR";
        await attempt(() =>
          this.cmd(["kill", runtime.name], { cleanup: true, timeoutMs: 1000 }),
        );
      }
      const stateReceipt = await attempt(() =>
        this.cmd(["inspect", "--format", "{{json .State}}", runtime.name], {
          cleanup: true,
          timeoutMs: 1000,
        }),
      );
      runtime.stateReceipt = stateReceipt;
    }
    for (const name of [...this.containers])
      await attempt(() => this.remove("container", name));
    if (runtime?.execution) {
      // Killing the CLI alone is insufficient. Remove first, then cancel/join exec.
      // The launch-specific abort also bounds exec when removal fails.
      runtime.launchAbort?.abort();
      await attempt(() => runtime.execution);
      this.evidence.cleanup.push({
        runtime: runtime.name,
        runtimeId: runtime.id,
        execution: runtime.exit ?? null,
        executionError: runtime.executionError ?? null,
        state: runtime.stateReceipt ?? null,
      });
    }
    if (runtime && !this.containers.has(runtime.name)) this.runtime = null;
    for (const volume of [...this.volumes])
      await attempt(() => this.remove("volume", volume));
    const inventory = await attempt(() => this.inventory());
    this.evidence.cleanup.push({
      inventory,
      verifiedAtMonotonicMs: this.now(),
    });
    this.evidence.cleanupVerified =
      !!inventory &&
      inventory.containers.length === 0 &&
      inventory.volumes.length === 0 &&
      !failed &&
      !this.evidence.cleanupError;
    if (!this.evidence.cleanupVerified) {
      this.evidence.cleanupError = "CLEANUP_ERROR";
      throw new WorkerError("CLEANUP_ERROR");
    }
    return { cleanupVerified: true };
  }
  close() {
    if (this.closing) return this.closing;
    this.state = "closing";
    this.workAbort.abort();
    clearTimeout(this.deadline);
    const pending = (async () => {
      if (this.active) await this.active.catch(() => {});
      const result = await this.cleanupAll();
      this.state = "closed";
      return result;
    })();
    this.closing = pending;
    // A failed close may be retried against Docker's actual inventory.
    pending.catch(() => {
      if (this.closing === pending) this.closing = null;
    });
    return pending;
  }
  kill() {
    return this.close();
  }
}
