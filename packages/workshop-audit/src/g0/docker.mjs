// Separate G0 adapter: unchanged worker image/recipe, no volumes or host mounts.
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { command } from "../../../target-worker/src/controller.mjs";
import { check, digest, LIMITS } from "./policy.mjs";
import { DENIAL_PROBE, PERMISSIONS, PROCESS_PROBE } from "./probes.mjs";

export const RUNTIME_ROOT = resolve(
  import.meta.dirname,
  "../../../target-worker/runtime",
);
const RUN_LABEL = "metamorph.g0.run";
const OWNER_LABEL = "metamorph.g0.owner";
const ROLE_LABEL = "metamorph.g0.role";
const admittedImages = new Map();
export function requireAdmittedImage(imageId, recipeSha) {
  check(admittedImages.get(imageId) === recipeSha, "G0_IDENTITY");
}
const containerId = (id) => /^[a-f0-9]{64}$/.test(id);
async function bounded(task, milliseconds, code, abort, signal) {
  check(milliseconds > 0, code);
  check(!signal?.aborted, "G0_CANCELLED");
  let timer, cancel;
  try {
    return await Promise.race([
      task,
      new Promise((_, reject) => {
        cancel = () =>
          reject(
            Object.assign(new Error("G0_CANCELLED"), { code: "G0_CANCELLED" }),
          );
        signal?.addEventListener("abort", cancel, { once: true });
        timer = setTimeout(() => {
          abort?.abort();
          reject(Object.assign(new Error(code), { code }));
        }, milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    if (cancel) signal?.removeEventListener("abort", cancel);
  }
}
export async function recipe() {
  const names = (await readdir(RUNTIME_ROOT))
    .filter(
      (n) =>
        n.endsWith(".mjs") ||
        ["Dockerfile", "package.json", "package-lock.json"].includes(n),
    )
    .sort();
  const hashes = Object.fromEntries(
    await Promise.all(
      names.map(async (n) => {
        const { sha256 } = await import(
          "../../../target-worker/src/admission.mjs"
        );
        return [n, sha256(await readFile(resolve(RUNTIME_ROOT, n)))];
      }),
    ),
  );
  return { hashes, recipeSha: digest(hashes) };
}
function json(result) {
  try {
    return JSON.parse(result.stdout);
  } catch {
    check(false, "G0_EVIDENCE");
  }
}
function success(result) {
  check(!result.cancelled, "G0_CANCELLED");
  check(!result.timedOut, "G0_TIMEOUT");
  check(
    result.exitCode === 0 && !result.spawnError && !result.overflow,
    "G0_ENVIRONMENT",
  );
  return result;
}
export function sandbox(name, runId, owner, role) {
  return [
    "--name",
    name,
    "--label",
    `${RUN_LABEL}=${runId}`,
    "--label",
    `${OWNER_LABEL}=${owner}`,
    "--label",
    `${ROLE_LABEL}=${role}`,
    "--user",
    "10001:10001",
    "--init",
    "--network",
    "none",
    "--ipc",
    "private",
    "--cgroupns",
    "private",
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
    "--log-driver",
    "none",
    "--tmpfs",
    "/work:rw,nosuid,nodev,size=64m,uid=10001,gid=10001,mode=0700",
    "--tmpfs",
    "/state:rw,nosuid,nodev,noexec,size=16m,uid=10001,gid=10001,mode=0700",
    "--tmpfs",
    "/tmp:rw,nosuid,nodev,noexec,size=16m,mode=1777",
    "--entrypoint",
    "node",
  ];
}
export function validateIsolation(value, expected, imageEnv) {
  const h = value?.HostConfig,
    c = value?.Config;
  check(
    value?.Id === expected.id &&
      value.Image === expected.imageId &&
      c?.User === "10001:10001" &&
      c.WorkingDir === "/work" &&
      c.Labels?.[RUN_LABEL] === expected.runId &&
      c.Labels?.[OWNER_LABEL] === expected.owner &&
      c.Labels?.[ROLE_LABEL] === expected.role &&
      JSON.stringify(c.Entrypoint) === '["node"]' &&
      JSON.stringify(c.Cmd) === JSON.stringify([expected.script]) &&
      JSON.stringify([...(c.Env ?? [])].sort()) ===
        JSON.stringify([...imageEnv].sort()) &&
      h?.NetworkMode === "none" &&
      h.IpcMode === "private" &&
      h.PidMode === "" &&
      h.UTSMode === "" &&
      h.CgroupnsMode === "private" &&
      !h.Privileged &&
      h.ReadonlyRootfs === true &&
      h.NanoCpus === LIMITS.nanoCpus &&
      h.Memory === LIMITS.memory &&
      h.MemorySwap === LIMITS.memory &&
      h.PidsLimit === LIMITS.pids &&
      h.CapDrop?.length === 1 &&
      h.CapDrop[0] === "ALL" &&
      h.SecurityOpt?.length === 1 &&
      ["no-new-privileges", "no-new-privileges:true"].includes(
        h.SecurityOpt[0],
      ) &&
      !h.PublishAllPorts &&
      !h.VolumesFrom?.length &&
      !h.Binds?.length &&
      !h.Devices?.length &&
      !h.DeviceRequests?.length &&
      !h.ExtraHosts?.length &&
      !h.Links?.length &&
      Object.keys(h.PortBindings ?? {}).length === 0 &&
      Object.keys(c.Volumes ?? {}).length === 0 &&
      (value.Mounts ?? []).every(
        (m) =>
          m.Type === "tmpfs" &&
          ["/work", "/state", "/tmp"].includes(m.Destination),
      ) &&
      Object.keys(h.Tmpfs ?? {})
        .sort()
        .join() === "/state,/tmp,/work",
    "G0_ISOLATION",
  );
  // Inspect must show the exact tmpfs recipe, not merely its three destinations.
  for (const [path, options] of [
    ["/work", "rw,nosuid,nodev,size=64m,uid=10001,gid=10001,mode=0700"],
    ["/state", "rw,nosuid,nodev,noexec,size=16m,uid=10001,gid=10001,mode=0700"],
    ["/tmp", "rw,nosuid,nodev,noexec,size=16m,mode=1777"],
  ])
    check(h.Tmpfs[path] === options, "G0_ISOLATION");
}

export class G0Docker {
  constructor(
    runId,
    sink,
    {
      execute = command,
      owner = randomUUID(),
      cleanupMs = LIMITS.cleanupMs,
    } = {},
  ) {
    check(
      /^g0-[a-f0-9-]{36}$/.test(runId) && /^[a-f0-9-]{36}$/.test(owner),
      "G0_OWNERSHIP",
    );
    this.runId = runId;
    this.owner = owner;
    this.sink = sink;
    this.execute = execute; // Trusted test seam; runG0 never accepts an adapter.
    check(
      Number.isFinite(cleanupMs) &&
        cleanupMs > 0 &&
        cleanupMs <= LIMITS.cleanupMs,
      "G0_CLEANUP",
    );
    this.cleanupMs = cleanupMs;
    this.ledger = [];
    this.pending = new Set();
    this.deadline = performance.now() + LIMITS.lifetimeMs;
    this.workAbort = new AbortController();
  }
  async call(
    args,
    { input, signal, cleanup = false, timeoutMs = LIMITS.operationMs } = {},
  ) {
    const remaining =
      (cleanup ? this.cleanupDeadline : this.deadline) - performance.now();
    check(remaining > 0, cleanup ? "G0_CLEANUP" : "G0_TIMEOUT");
    if (!cleanup)
      check(
        !this.closing && !this.workAbort.signal.aborted && !signal?.aborted,
        "G0_CANCELLED",
      );
    const abort = new AbortController();
    const cancellation = cleanup
      ? undefined
      : AbortSignal.any([this.workAbort.signal, ...(signal ? [signal] : [])]);
    const duration = Math.min(timeoutMs, remaining);
    const task = Promise.resolve(
      this.execute(args, {
        input,
        timeoutMs: duration,
        signal: AbortSignal.any([
          abort.signal,
          ...(cancellation ? [cancellation] : []),
        ]),
      }),
    );
    this.pending.add(task);
    // Keep the underlying operation in the join even if our own timeout wins.
    // Both handlers consume settlement; no detached rejecting finally promise.
    task.then(
      () => this.pending.delete(task),
      () => this.pending.delete(task),
    );
    const result = await bounded(
      task,
      duration,
      cleanup ? "G0_CLEANUP" : "G0_TIMEOUT",
      abort,
      cancellation,
    );
    if (!cleanup) check(!this.closing, "G0_CANCELLED");
    check(
      performance.now() < (cleanup ? this.cleanupDeadline : this.deadline),
      cleanup ? "G0_CLEANUP" : "G0_TIMEOUT",
    );
    try {
      this.sink.record("command", { args, ...result, input: undefined });
    } catch {
      this.evidenceFailed = true;
      check(false, "G0_EVIDENCE");
    }
    return result;
  }
  save() {
    try {
      this.sink.ledger({
        version: 1,
        runId: this.runId,
        owner: this.owner,
        resources: this.ledger,
      });
    } catch {
      this.evidenceFailed = true;
      check(false, "G0_EVIDENCE");
    }
  }
  async health() {
    const r = await this.call(["info", "--format", "{{json .}}"]);
    check(
      r.exitCode === 0 && !r.spawnError && !r.timedOut && !r.overflow,
      "G0_DOCKER_UNAVAILABLE",
    );
    const info = json(r);
    check(info.CgroupVersion === "2", "G0_ISOLATION");
    check(
      info.OSType === "linux" &&
        ["x86_64", "amd64"].includes(info.Architecture),
      "G0_LINUX_REQUIRED",
    );
  }
  async inspectImage(imageId, expectedRecipe) {
    const local = await recipe();
    check(local.recipeSha === expectedRecipe, "G0_IDENTITY");
    const image = json(
      success(await this.call(["image", "inspect", imageId])),
    )[0];
    check(
      image?.Id === imageId &&
        image.Os === "linux" &&
        image.Architecture === "amd64" &&
        image.Config?.User === "10001:10001" &&
        (image.Config.Env ?? []).every((v) =>
          /^(PATH|NODE_VERSION|YARN_VERSION|NODE_ENV|TZ)=/.test(v),
        ),
      "G0_IDENTITY",
    );
    this.imageId = imageId;
    this.imageEnv = image.Config.Env;
    const id = await this.create("provenance", "/opt/worker/provenance.mjs");
    const measured = json(success(await this.call(["start", "--attach", id])));
    check(
      measured.node === "v24.11.0" &&
        measured.sqlite === "3.50.4" &&
        measured.typescript === "5.9.3" &&
        measured.faketime === "0.9.10-2.1" &&
        measured.clockPolicy === "libfaketime-real-monotonic-v1",
      "G0_IDENTITY",
    );
    for (const [n, hash] of Object.entries(local.hashes))
      check(n === "Dockerfile" || measured.hashes?.[n] === hash, "G0_IDENTITY");
    await this.remove(id);
  }
  async create(role, script) {
    const name = `${this.runId}-${randomUUID()}`;
    const entry = { name, role, script, id: null, removed: false };
    this.ledger.push(entry); // Persist before create: cancellation can hide an ID.
    this.save();
    const r = success(
      await this.call([
        "create",
        "--interactive",
        ...sandbox(name, this.runId, this.owner, role),
        this.imageId,
        script,
      ]),
    );
    const id = r.stdout.trim();
    check(containerId(id), "G0_EVIDENCE");
    entry.id = id;
    this.save();
    const inspected = json(success(await this.call(["inspect", id])))[0];
    validateIsolation(
      inspected,
      { ...entry, imageId: this.imageId, runId: this.runId, owner: this.owner },
      this.imageEnv,
    );
    return id;
  }
  async build(bundle) {
    const id = await this.create("build", "/opt/worker/build.mjs");
    const r = await this.call(["start", "--attach", "--interactive", id], {
      input: JSON.stringify(bundle.files),
      timeoutMs: 35000,
    });
    success(r);
    const built = json(r);
    check(
      built.checks?.length === 2 &&
        built.checks.every((c) => c.exitCode === 0) &&
        Array.isArray(built.artifacts) &&
        built.artifacts.length > 0 &&
        built.artifacts.length <= 64,
      "G0_BUILD",
    );
    const { sha256 } = await import("../../../target-worker/src/admission.mjs");
    let total = 0;
    const seen = new Set();
    for (const a of built.artifacts) {
      const bytes = Buffer.from(a.base64, "base64");
      total += bytes.length;
      check(
        /^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.js$/.test(a.path) &&
          !seen.has(a.path) &&
          sha256(bytes) === a.sha256 &&
          total <= 2 * 1024 * 1024,
        "G0_BUILD",
      );
      seen.add(a.path);
    }
    check(seen.has("main.js"), "G0_BUILD");
    await this.remove(id);
    return built.artifacts;
  }
  async launch(artifacts) {
    this.runtimeId = await this.create("runtime", "/opt/worker/launch.mjs");
    this.execution = this.call(
      ["start", "--attach", "--interactive", this.runtimeId],
      { input: JSON.stringify(artifacts), timeoutMs: LIMITS.lifetimeMs },
    ).then((r) => {
      this.exited = r;
      return r;
    });
    // Attach completes only when the candidate stops; finalization joins it.
    this.execution.catch(() => {});
  }
  async exec(program, permission = false) {
    check(!this.exited, "G0_RUNTIME_EXIT");
    const r = await this.call([
      "exec",
      this.runtimeId,
      "node",
      ...(permission ? PERMISSIONS : []),
      "-e",
      program,
    ]);
    return json(success(r));
  }
  async probes() {
    const observed = await this.exec(PROCESS_PROBE);
    check(
      observed.absent === true &&
        observed.namespace === true &&
        observed.process === true &&
        observed.environment === true &&
        observed.bounds === true &&
        observed.privileges === true,
      "G0_ISOLATION",
    );
    const denied = await this.exec(DENIAL_PROBE, true);
    const expected = [
      "filesystem",
      "php",
      "reference",
      "corpus",
      "docker",
      "spawn",
      "native",
      "network",
      "ipc",
    ];
    check(
      Object.keys(denied).sort().join() === expected.sort().join() &&
        Object.values(denied).every((v) => v === true),
      "G0_CONTROL_FAILED",
    );
    return [...expected, "process", "environment"];
  }
  async request(driver, method, path, body) {
    check(!this.exited, "G0_RUNTIME_EXIT");
    const requestId = randomUUID();
    const action = {
      kind: "http",
      profileId: driver === "items-v1" ? "public-items-v1" : "car-workshop-v1",
      requestId,
      method,
      path,
      ...(body === undefined ? {} : { body }),
    };
    const value = json(
      success(
        await this.call([
          "exec",
          "--user",
          "10002:10002",
          "--workdir",
          "/tmp",
          this.runtimeId,
          "node",
          "/opt/worker/inspect.mjs",
          JSON.stringify(action),
        ]),
      ),
    );
    check(
      value.requestId === requestId &&
        value.headers?.["x-request-id"] === requestId &&
        value.status === 200 &&
        typeof value.bodyBase64 === "string",
      "G0_CHALLENGE",
    );
    let bodyValue;
    try {
      bodyValue = JSON.parse(
        Buffer.from(value.bodyBase64, "base64").toString(),
      );
    } catch {
      check(false, "G0_CHALLENGE");
    }
    const defects = {
      REFERENCE_DENIED: "G0_DEFECT_REFERENCE",
      NETWORK_DENIED: "G0_DEFECT_NETWORK",
      CORPUS_DENIED: "G0_DEFECT_CORPUS",
      DOCKER_DENIED: "G0_DEFECT_DOCKER",
    };
    if (bodyValue?.g0Defect)
      check(false, defects[bodyValue.g0Defect] ?? "G0_ISOLATION");
    return bodyValue;
  }
  async inventory() {
    const r = success(
      await this.call(
        [
          "container",
          "ls",
          "--all",
          "--no-trunc",
          "--filter",
          `label=${RUN_LABEL}=${this.runId}`,
          "--format",
          "{{.ID}}",
        ],
        { cleanup: true },
      ),
    );
    const ids = r.stdout.trim() ? r.stdout.trim().split(/\s+/) : [];
    check(
      ids.every(containerId) && new Set(ids).size === ids.length,
      "G0_EVIDENCE",
    );
    for (const id of ids) {
      const value = json(
        success(await this.call(["inspect", id], { cleanup: true })),
      )[0];
      const e = this.ledger.find(
        (x) => x.name === value?.Name?.replace(/^\//, ""),
      );
      check(
        e &&
          !e.removed &&
          (!e.id || e.id === id) &&
          value.Config?.Labels?.[RUN_LABEL] === this.runId &&
          value.Config.Labels[OWNER_LABEL] === this.owner &&
          value.Config.Labels[ROLE_LABEL] === e.role,
        "G0_OWNERSHIP",
      );
      if (!e.id) {
        e.id = id;
        this.save();
      }
    }
    const volumes = success(
      await this.call(
        [
          "volume",
          "ls",
          "--filter",
          `label=${RUN_LABEL}=${this.runId}`,
          "--format",
          "{{.Name}}",
        ],
        { cleanup: true },
      ),
    );
    check(volumes.stdout.trim() === "", "G0_OWNERSHIP"); // This adapter creates none.
    return ids;
  }
  async remove(id, cleanup = false) {
    this.cleanupDeadline ??= performance.now() + LIMITS.cleanupMs;
    const e = this.ledger.find((x) => x.id === id && !x.removed);
    check(e, "G0_OWNERSHIP");
    const observed = json(
      success(await this.call(["inspect", id], { cleanup })),
    )[0];
    check(
      observed?.Id === id &&
        observed.Name === `/${e.name}` &&
        observed.Config?.Labels?.[RUN_LABEL] === this.runId &&
        observed.Config.Labels[OWNER_LABEL] === this.owner &&
        observed.Config.Labels[ROLE_LABEL] === e.role,
      "G0_OWNERSHIP",
    );
    success(await this.call(["rm", "--force", id], { cleanup }));
    e.removed = true;
    this.save();
  }
  async close() {
    this.closing = true;
    this.workAbort.abort();
    this.cleanupDeadline = performance.now() + this.cleanupMs;
    // Join before any Docker mutation. An abort-ignoring create/start may still
    // be active; uncertain work cannot yield a zero-resource cleanup receipt.
    await bounded(
      Promise.allSettled([...this.pending]),
      this.cleanupDeadline - performance.now(),
      "G0_CLEANUP",
    );
    let failed = false;
    try {
      await this.inventory();
    } catch {
      failed = true;
    }
    // Continue exact-ID teardown even if an unrelated inventory observation
    // fails. Every deletion still revalidates this ledger's owner and labels.
    for (const entry of this.ledger.filter((e) => e.id && !e.removed)) {
      try {
        await this.remove(entry.id, true);
      } catch {
        failed = true;
      }
    }
    check(this.pending.size === 0, "G0_CLEANUP");
    let remaining = null;
    try {
      remaining = await this.inventory();
    } catch {
      failed = true;
    }
    check(!failed && remaining?.length === 0, "G0_CLEANUP");
    return { containers: 0, volumes: 0, emergencyRemoved: 0 };
  }
  // A distinct finalizer invocation uses only this validated run ledger. It
  // refuses unknown IDs/labels and never searches/removes by a name prefix.
  async finalize() {
    this.cleanupDeadline = performance.now() + this.cleanupMs;
    let failed = false,
      removed = 0;
    try {
      await this.inventory();
    } catch {
      failed = true;
    }
    for (const entry of this.ledger.filter((e) => e.id && !e.removed)) {
      try {
        await this.remove(entry.id, true);
        removed++;
      } catch {
        failed = true;
      }
    }
    let remaining;
    try {
      remaining = await this.inventory();
    } catch {
      failed = true;
    }
    check(!failed && remaining?.length === 0, "G0_CLEANUP");
    return { containers: 0, volumes: 0, emergencyRemoved: removed };
  }
}

// Explicit public setup, never called on PRs. Build context is trusted recipe only.
export async function buildImage(sink) {
  const local = await recipe();
  const tag = `metamorph-g0:${randomUUID()}`;
  const r = await command(["build", "--pull", "--tag", tag, RUNTIME_ROOT], {
    timeoutMs: 240000,
  });
  sink.record("setup-build", r);
  success(r);
  const inspected = await command(["image", "inspect", tag]);
  sink.record("setup-image", inspected);
  const image = json(success(inspected))[0];
  check(/^sha256:[a-f0-9]{64}$/.test(image?.Id), "G0_IDENTITY");
  check((await recipe()).recipeSha === local.recipeSha, "G0_IDENTITY");
  admittedImages.set(image.Id, local.recipeSha);
  return { imageId: image.Id, ...local };
}
