// New trusted-only schedules. Does not relax or invoke the immutable-MANIFEST
// workers. Candidate receives only source and one current HTTP request at a time.
import { performance } from "node:perf_hooks";
import { compareSqlite, SOURCE } from "@metamorph/oracle";
import {
  mapTargetHttp,
  mapTargetSnapshot,
} from "../../differential/src/mapping.mjs";
import {
  fields,
  requireCheck,
  strictJson,
} from "../../differential/src/strict.mjs";
import { targetInventory } from "../../differential/src/target-adapter.mjs";
import { WORKSHOP_CANDIDATE_SHA } from "../../differential/src/workshop-policy.mjs";
import { validateHttp } from "../../oracle/dist/http.js";
import { validateSnapshot } from "../../oracle/dist/sqlite.js";
import {
  requestPolicy,
  WORKSHOP_PROFILE,
} from "../../target-worker/runtime/profile.mjs";
import {
  requireSuccess,
  TargetWorker,
} from "../../target-worker/src/controller.mjs";
import { digest } from "./corpus.mjs";

export const stepId = (n) => `step-${String(n + 1).padStart(2, "0")}`;
function schedule(scenario) {
  fields(scenario, ["id", "requests"], "SCHEDULE_FIELDS");
  requireCheck(
    /^audit-[a-z0-9-]+$/.test(scenario.id) &&
      Array.isArray(scenario.requests) &&
      scenario.requests.length > 0 &&
      scenario.requests.length <= 16,
    "SCHEDULE",
  );
  const result = structuredClone(scenario);
  for (const r of result.requests) {
    fields(
      r,
      r.body === undefined ? ["method", "path"] : ["method", "path", "body"],
      "REQUEST_FIELDS",
    );
    requestPolicy(WORKSHOP_PROFILE, r.method, r.path, r.body);
    Object.freeze(r);
  }
  Object.freeze(result.requests);
  return Object.freeze(result);
}
class Ordered {
  constructor(scenario, record) {
    this.scenario = schedule(scenario);
    this.record = record;
    this.cursor = 0;
    this.stats = { requests: 0, snapshots: 0, resets: 0 };
    this.failed = false;
    this.closed = false;
    this.pending = null;
    this.resetDone = false;
    this.abort = new AbortController();
  }
  async operation(fn, signal) {
    requireCheck(!this.failed && !this.closed && !this.pending, "WORKER_STATE");
    const active = Promise.resolve()
      .then(() => {
        signal.throwIfAborted();
        return fn(AbortSignal.any([signal, this.abort.signal]));
      })
      .catch(async (e) => {
        this.failed = true;
        try {
          this.record("adapter-error", {
            code: e.code,
            diagnostic: String(e.stack ?? e),
          });
        } catch {}
        try {
          await this.shutdown();
        } catch {
          throw Error("CLEANUP_ERROR");
        }
        throw Error("AUDIT_ADAPTER_ERROR");
      });
    this.pending = active;
    try {
      return await active;
    } finally {
      this.pending = null;
    }
  }
  expected(id, input) {
    requireCheck(
      this.resetDone &&
        id === stepId(this.cursor) &&
        this.scenario.requests[this.cursor] &&
        JSON.stringify(input) ===
          JSON.stringify(this.scenario.requests[this.cursor]),
      "STEP_BINDING",
    );
    return this.scenario.requests[this.cursor];
  }
  request(input, signal) {
    return this.requestStep(
      this.scenario.id,
      stepId(this.cursor),
      input,
      signal,
    );
  }
  async close() {
    this.closed = true;
    this.abort.abort();
    clearTimeout(this.timer);
    // Target close aborts & joins its active command. PHP command receives abort.
    let error;
    try {
      if (this.worker) await this.worker.close();
    } catch (e) {
      error = e;
    }
    await this.pending?.catch(() => {});
    try {
      await this.shutdown();
    } catch (e) {
      error ??= e;
    }
    if (error) throw Error("CLEANUP_ERROR");
  }
}
export class AuditReference extends Ordered {
  constructor(transport, scenario, record) {
    super(scenario, record);
    this.transport = transport;
  }
  reset(signal) {
    return this.operation(async (s) => {
      requireCheck(!this.resetDone, "RESET_REPLAY");
      this.deadline = performance.now() + 180000;
      this.timer = setTimeout(() => {
        this.failed = true;
        this.abort.abort();
        this.shutdown().catch(() => {});
      }, 180000);
      this.timer.unref?.();
      await this.transport.reset(s);
      const boot = await this.transport.http(
        { method: "GET", path: "/api.php?action=get_slots&date=2099-06-15" },
        s,
      );
      validateHttp(boot.observation);
      requireCheck(boot.observation.status === 200, "BOOTSTRAP");
      this.record("bootstrap", boot);
      const initial = await this.capture(s);
      requireCheck(
        initial.legacySha256 === SOURCE.initialSha256,
        "DIRTY_REFERENCE_RESET",
      );
      this.last = structuredClone(initial.snapshot);
      this.resetDone = true;
      this.stats.resets++;
    }, signal);
  }
  async capture(signal) {
    requireCheck(performance.now() < this.deadline, "AGGREGATE_TIMEOUT");
    const x = await this.transport.inspect(signal);
    validateSnapshot(x.snapshot);
    this.record("reference-inspection", x);
    return x;
  }
  requestStep(scenarioId, id, input, signal) {
    return this.operation(async (s) => {
      requireCheck(scenarioId === this.scenario.id, "SCENARIO_BINDING");
      const expected = this.expected(id, input);
      const before = await this.capture(s);
      requireCheck(
        compareSqlite(this.last, before.snapshot).length === 0,
        "UNCOMMANDED_REFERENCE_WRITE",
      );
      const response = await this.transport.http(expected, s);
      validateHttp(response.observation);
      const after = await this.capture(s);
      this.record("reference-request", {
        scenarioId,
        stepId: id,
        request: expected,
        response,
        before,
        after,
      });
      this.last = structuredClone(after.snapshot);
      this.cursor++;
      this.stats.requests++;
      return response.observation;
    }, signal);
  }
  snapshot(signal) {
    return this.operation(async (s) => {
      requireCheck(this.resetDone, "NOT_RESET");
      const x = await this.capture(s);
      requireCheck(
        compareSqlite(this.last, x.snapshot).length === 0,
        "UNCOMMANDED_REFERENCE_WRITE",
      );
      this.stats.snapshots++;
      return x.snapshot;
    }, signal);
  }
  shutdown() {
    return this.transport.close();
  }
}
export class AuditTarget extends Ordered {
  constructor(worker, scenario, record, { inventory = targetInventory } = {}) {
    super(scenario, record);
    requireCheck(
      worker instanceof TargetWorker &&
        worker.profile === WORKSHOP_PROFILE &&
        worker.bundle.candidateSha === WORKSHOP_CANDIDATE_SHA,
      "TARGET_ADMISSION",
    );
    this.worker = worker;
    this.inventory = inventory;
    this.source = worker.bundle.candidateSha;
    this.image = worker.image;
    requireCheck(worker.provenance?.imageId === this.image, "IMAGE_IDENTITY");
  }
  bind(receipt, id) {
    fields(
      receipt,
      ["runId", "candidateSha", "imageId", "runtimeId", "scenarioId", "policy"],
      "RESET_FIELDS",
    );
    const r = this.worker.runtime;
    requireCheck(
      receipt.runId === this.worker.runId &&
        receipt.candidateSha === this.source &&
        receipt.imageId === this.image &&
        receipt.scenarioId === id &&
        /^[a-f0-9]{64}$/.test(receipt.runtimeId) &&
        receipt.runtimeId === r?.id &&
        r.scenarioId === id &&
        r.name.startsWith(this.worker.runId) &&
        r.volume.startsWith(this.worker.runId) &&
        (!this.identity ||
          (this.identity.runtimeId !== r.id &&
            this.identity.volume !== r.volume)),
      "RESET_IDENTITY",
    );
    this.identity = { runtimeId: r.id, volume: r.volume, scenarioId: id };
    this.record("target-reset", { receipt, identity: this.identity });
  }
  current() {
    const r = this.worker.runtime;
    requireCheck(
      this.identity &&
        r?.id === this.identity.runtimeId &&
        r.volume === this.identity.volume &&
        r.scenarioId === this.identity.scenarioId &&
        !r.exit &&
        !r.executionError &&
        this.worker.bundle.candidateSha === this.source &&
        this.worker.image === this.image &&
        this.worker.profile === WORKSHOP_PROFILE,
      "STALE_RUNTIME",
    );
  }
  provision(signal) {
    return this.operation(async (s) => {
      this.bind(await this.worker.provision(s), "public-initial");
      this.initial = await this.readSnapshot("admission-initial", s);
    }, signal);
  }
  reset(signal) {
    return this.operation(async (s) => {
      requireCheck(!this.resetDone && this.identity, "RESET_REPLAY");
      this.bind(await this.worker.reset(this.scenario.id, s), this.scenario.id);
      requireCheck(
        compareSqlite(this.initial, await this.readSnapshot("clean-initial", s))
          .length === 0,
        "DIRTY_TARGET_RESET",
      );
      this.last = structuredClone(this.initial);
      this.resetDone = true;
      this.stats.resets++;
    }, signal);
  }
  wire(kind, since) {
    const commands = this.worker.evidence.commands
      .slice(since)
      .filter((c) => c.args?.includes("/opt/worker/inspect.mjs"));
    requireCheck(commands.length === 1, "INSPECTOR_RECEIPT");
    const receipt = requireSuccess(commands[0]);
    const action = strictJson(receipt.args.at(-1));
    requireCheck(
      action.kind === kind && action.profileId === WORKSHOP_PROFILE.id,
      "INSPECTOR_ACTION",
    );
    requireCheck(
      receipt.args.includes(
        kind === "http"
          ? `container:${this.identity.runtimeId}`
          : `type=volume,source=${this.identity.volume},target=/state,readonly`,
      ),
      "INSPECTOR_MOUNT",
    );
    return { action, raw: strictJson(receipt.stdout, 4 * 1024 * 1024) };
  }
  async readSnapshot(id, signal) {
    this.current();
    const since = this.worker.evidence.commands.length,
      observed = await this.worker.snapshot(id, signal);
    this.current();
    const wire = this.wire("snapshot", since);
    requireCheck(
      JSON.stringify(observed) ===
        JSON.stringify({
          stepId: id,
          runtimeId: this.identity.runtimeId,
          volume: this.identity.volume,
          ...wire.raw,
        }),
      "SNAPSHOT_RECEIPT",
    );
    const mapped = mapTargetSnapshot(observed, this.identity, id);
    this.record("target-snapshot", { observed, mapped });
    return mapped;
  }
  requestStep(scenarioId, id, input, signal) {
    return this.operation(async (s) => {
      requireCheck(scenarioId === this.scenario.id, "SCENARIO_BINDING");
      const expected = this.expected(id, input);
      this.current();
      // Independent pre/post DB captures detect background writes and bind the
      // response to real state. They never use an app-provided snapshot endpoint.
      const before = await this.readSnapshot(`before-${id}`, s);
      requireCheck(
        compareSqlite(this.last, before).length === 0,
        "UNCOMMANDED_TARGET_WRITE",
      );
      const since = this.worker.evidence.commands.length,
        observed = await this.worker.request(
          id,
          expected.method,
          expected.path,
          expected.body,
          s,
        );
      this.current();
      const wire = this.wire("http", since);
      requireCheck(
        wire.action.method === expected.method &&
          wire.action.path === expected.path &&
          wire.action.body === expected.body &&
          JSON.stringify(observed) ===
            JSON.stringify({ ...wire.raw, stepId: id }),
        "HTTP_RECEIPT",
      );
      const result = mapTargetHttp(observed, id, wire.action.requestId);
      this.last = await this.readSnapshot(`after-${id}`, s);
      this.record("target-request", {
        scenarioId,
        stepId: id,
        request: expected,
        observed,
        before,
        after: this.last,
      });
      this.cursor++;
      this.stats.requests++;
      return result;
    }, signal);
  }
  snapshot(signal) {
    return this.operation(async (s) => {
      requireCheck(this.resetDone, "NOT_RESET");
      const x = await this.readSnapshot(
        `checkpoint-${this.stats.snapshots}`,
        s,
      );
      requireCheck(
        compareSqlite(this.last, x).length === 0,
        "UNCOMMANDED_TARGET_WRITE",
      );
      this.stats.snapshots++;
      return x;
    }, signal);
  }
  async shutdown() {
    await this.worker.close();
    const x = await this.inventory(this.worker.runId);
    this.record("target-close", {
      inventory: x,
      evidence: this.worker.evidence,
    });
    requireCheck(
      this.worker.evidence.cleanupVerified &&
        !this.worker.evidence.cleanupError &&
        !x.containers.length &&
        !x.volumes.length,
      "CLEANUP_ERROR",
    );
  }
}
export function requestCommitment(request) {
  return digest(request);
}
