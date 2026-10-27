import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { sha256, validateBundle } from "./admission.mjs";

export const POLICY = Object.freeze({
  memoryMiB: 256,
  cpus: 1,
  pids: 64,
  operationTimeoutMs: 15000,
  lifetimeMs: 180000,
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
export function requireSuccess(result) {
  if (result.cancelled) throw new Error("CANCELLED");
  if (result.timedOut) throw new Error("TIMEOUT");
  if (result.exitCode !== 0 || result.overflow || result.spawnError)
    throw new Error("ENVIRONMENT_ERROR");
  return result;
}
export function parseObservation(result, kind) {
  requireSuccess(result);
  let value;
  try {
    value = JSON.parse(result.stdout);
  } catch {
    throw new Error("OBSERVATION_ERROR: JSON");
  }
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
      throw new Error("OBSERVATION_ERROR: HTTP");
  } else if (
    value.format !== "target-worker-sqlite-v1-proposed" ||
    value.source !== "/state/target.sqlite" ||
    !Array.isArray(value.schema) ||
    !Array.isArray(value.tables)
  )
    throw new Error("OBSERVATION_ERROR: DB");
  return value;
}

export class TargetWorker {
  constructor(imageId, bundle, clock = "real") {
    if (
      !/^sha256:[a-f0-9]{64}$/.test(imageId) ||
      !["real", "fixed-experiment"].includes(clock)
    )
      throw new Error("ADMISSION_REJECTED: runtime config");
    this.image = imageId;
    this.bundle = validateBundle(bundle.files, bundle.candidateSha);
    this.clock = clock;
    this.runId = `mmp007-${randomUUID()}`;
    this.containers = new Set();
    this.volumes = new Set();
    this.evidence = {
      runId: this.runId,
      candidateSha: this.bundle.candidateSha,
      policy: POLICY,
      clock,
      imageId,
      commands: [],
      cleanup: [],
    };
  }
  async cmd(args, options) {
    const result = await command(args, options);
    this.evidence.commands.push(result);
    return result;
  }
  async provision() {
    const name = `${this.runId}-build`;
    this.containers.add(name);
    const built = await this.cmd(
      [
        "run",
        "--interactive",
        ...sandboxArgs(name),
        this.image,
        "node",
        "/opt/worker/build.mjs",
      ],
      { input: JSON.stringify(this.bundle.files), timeoutMs: 35000 },
    );
    this.evidence.build = built;
    if (built.exitCode !== 0 || built.timedOut || built.overflow)
      throw new Error(built.timedOut ? "TIMEOUT" : "BUILD_FAILED");
    const output = JSON.parse(built.stdout);
    if (
      !Array.isArray(output.checks) ||
      output.checks.length !== 2 ||
      output.checks.some((c) => c.exitCode !== 0) ||
      !Array.isArray(output.artifacts) ||
      output.artifacts.length > 64
    )
      throw new Error("BUILD_FAILED");
    let total = 0;
    for (const artifact of output.artifacts) {
      const bytes = Buffer.from(artifact.base64, "base64");
      total += bytes.length;
      if (
        !/^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.js$/.test(artifact.path) ||
        sha256(bytes) !== artifact.sha256 ||
        total > 2 * 1024 * 1024
      )
        throw new Error("BUILD_FAILED");
    }
    if (!output.artifacts.some((f) => f.path === "main.js"))
      throw new Error("BUILD_FAILED");
    this.artifacts = output.artifacts;
    this.evidence.artifactSha = sha256(JSON.stringify(output.artifacts));
    this.evidence.buildChecks = output.checks;
    return this.reset("public-initial");
  }
  async reset(scenarioId) {
    if (!/^[A-Za-z0-9:_-]{1,100}$/.test(scenarioId) || !this.artifacts)
      throw new Error("ADMISSION_REJECTED: scenario/build");
    if (this.runtime) await this.stopRuntime();
    const suffix = randomUUID();
    const volume = `${this.runId}-${suffix}-db`;
    const name = `${this.runId}-${suffix}-runtime`;
    this.volumes.add(volume);
    this.containers.add(name);
    requireSuccess(
      await this.cmd([
        "volume",
        "create",
        "--label",
        "metamorph.target-worker=true",
        volume,
      ]),
    );
    requireSuccess(
      await this.cmd([
        "run",
        "--detach",
        ...sandboxArgs(name),
        "--mount",
        `type=volume,source=${volume},target=/state`,
        this.image,
      ]),
    );
    this.runtime = { name, volume, scenarioId };
    this.evidence.runtimeInspect = JSON.parse(
      requireSuccess(await this.cmd(["inspect", name])).stdout,
    )[0];
    const args = [
      "exec",
      "--interactive",
      ...(this.clock === "fixed-experiment" ? FIXED_ENV : []),
      name,
      "node",
      "/opt/worker/launch.mjs",
    ];
    this.runtime.execution = this.cmd(args, {
      input: JSON.stringify(this.artifacts),
      timeoutMs: POLICY.lifetimeMs + 5000,
    });
    this.deadline = setTimeout(() => {
      this.expired = true;
      this.expiration = this.kill().catch((error) => {
        this.evidence.expirationError = error.message;
      });
    }, POLICY.lifetimeMs);
    return {
      runId: this.runId,
      candidateSha: this.bundle.candidateSha,
      imageId: this.image,
      runtimeId: this.evidence.runtimeInspect.Id,
      scenarioId,
      policy: POLICY,
    };
  }
  async inspect(action, signal) {
    if (!this.runtime || this.expired) throw new Error("RUNTIME_FAILED");
    const name = `${this.runId}-inspect-${randomUUID()}`;
    this.containers.add(name);
    let capture;
    let operationError;
    try {
      const network =
        action.kind === "http" ? `container:${this.runtime.name}` : "none";
      const mounts =
        action.kind === "snapshot"
          ? [
              "--mount",
              `type=volume,source=${this.runtime.volume},target=/state,readonly`,
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
        { signal },
      );
      capture = parseObservation(result, action.kind);
    } catch (error) {
      operationError = error;
    }
    const removed = await this.cmd(["rm", "--force", name]);
    if (removed.exitCode === 0) this.containers.delete(name);
    else throw new Error("CLEANUP_ERROR");
    if (operationError) throw operationError;
    return capture;
  }
  async request(stepId, method, path, body, signal) {
    if (
      !/^[A-Za-z0-9:_-]{1,100}$/.test(stepId) ||
      !["GET", "POST"].includes(method) ||
      typeof path !== "string" ||
      !/^\/[a-zA-Z0-9/?=&_-]*$/.test(path) ||
      (body !== undefined &&
        (typeof body !== "string" || Buffer.byteLength(body) > 4096))
    )
      throw new Error("ADMISSION_REJECTED: request");
    const requestId = randomUUID();
    const capture = await this.inspect(
      { kind: "http", method, path, body, requestId },
      signal,
    );
    if (
      capture.requestId !== requestId ||
      capture.headers["x-request-id"] !== requestId
    )
      throw new Error("OBSERVATION_ERROR: request identity");
    return { ...capture, stepId };
  }
  async snapshot(stepId, signal) {
    return {
      stepId,
      runtimeId: this.evidence.runtimeInspect.Id,
      volume: this.runtime.volume,
      ...(await this.inspect({ kind: "snapshot" }, signal)),
    };
  }
  async stopRuntime() {
    clearTimeout(this.deadline);
    const runtime = this.runtime;
    if (!runtime) return;
    requireSuccess(
      await this.cmd(["stop", "--time", "1", runtime.name], {
        timeoutMs: 10000,
      }),
    );
    this.evidence.cleanup.push({
      runtime: runtime.name,
      execution: await runtime.execution,
      state: JSON.parse(
        requireSuccess(
          await this.cmd([
            "inspect",
            "--format",
            "{{json .State}}",
            runtime.name,
          ]),
        ).stdout,
      ),
    });
    this.runtime = null;
  }
  async close() {
    clearTimeout(this.deadline);
    let failed = false;
    if (this.runtime) {
      try {
        await this.stopRuntime();
      } catch {
        failed = true;
      }
    }
    for (const name of this.containers) {
      const result = await this.cmd(["rm", "--force", name], {
        timeoutMs: 10000,
      });
      if (result.exitCode !== 0) failed = true;
      else this.containers.delete(name);
    }
    // Resolve the docker-exec receipt even after a forced fallback removal.
    if (this.runtime?.execution) await this.runtime.execution;
    for (const volume of this.volumes) {
      const result = await this.cmd(["volume", "rm", volume]);
      if (result.exitCode !== 0) failed = true;
      else this.volumes.delete(volume);
    }
    this.evidence.cleanupVerified =
      this.containers.size === 0 && this.volumes.size === 0 && !failed;
    if (!this.evidence.cleanupVerified) throw new Error("CLEANUP_ERROR");
    return { cleanupVerified: true };
  }
  async kill() {
    clearTimeout(this.deadline);
    if (this.runtime) await this.cmd(["kill", this.runtime.name]);
    return this.close();
  }
}
