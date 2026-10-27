import { compareSqlite } from "@metamorph/oracle";
import {
  command,
  requireSuccess,
  TargetWorker,
} from "../../target-worker/src/controller.mjs";
import { mapTargetHttp, mapTargetSnapshot } from "./mapping.mjs";
import { checkedScenarios, stepId } from "./policy.mjs";
import { BridgeError, fields, requireCheck, strictJson } from "./strict.mjs";

const TARGET_CODES = new Set([
  "ADMISSION_REJECTED",
  "BUILD_FAILED",
  "RUNTIME_FAILED",
  "TIMEOUT",
  "CANCELLED",
  "OBSERVATION_ERROR",
  "CLEANUP_ERROR",
  "ENVIRONMENT_ERROR",
]);
export async function targetInventory(runId) {
  requireCheck(/^mmp007-[a-f0-9-]{36}$/.test(runId), "TARGET_IDENTITY");
  const inspect = async (kind) => {
    const args =
      kind === "container"
        ? [
            "container",
            "ls",
            "--all",
            "--filter",
            "label=metamorph.target-worker=true",
            "--format",
            "{{.Names}}",
          ]
        : [
            "volume",
            "ls",
            "--filter",
            "label=metamorph.target-worker=true",
            "--format",
            "{{.Name}}",
          ];
    const result = requireSuccess(await command(args, { timeoutMs: 5000 }));
    return result.stdout
      .trim()
      .split(/\s+/)
      .filter((name) => name.startsWith(runId));
  };
  return {
    containers: await inspect("container"),
    volumes: await inspect("volume"),
  };
}
/** Trusted-only adapter. Inventory seam is exclusively for original unit fault controls. */
/** @implements {import('@metamorph/oracle').WorkerAdapter} */
export class TargetOracleAdapter {
  constructor(worker, scenarios, { record, inventory = targetInventory } = {}) {
    requireCheck(
      worker instanceof TargetWorker && typeof record === "function",
      "TARGET_ADMISSION",
    );
    this.worker = worker;
    this.scenarios = checkedScenarios(scenarios);
    this.record = record;
    this.inventory = inventory;
    this.index = -1;
    this.cursor = 0;
    this.snapshotCount = 0;
    this.stats = { resets: 0, requests: 0, snapshots: 0 };
    this.failure = null;
    this.identity = null;
    this.pending = null;
    this.closed = false;
    this.closing = false;
    this.imageId = worker.image;
    this.candidateSha = worker.bundle.candidateSha;
    requireCheck(
      /^sha256:[a-f0-9]{64}$/.test(this.imageId) &&
        worker.provenance?.imageId === this.imageId,
      "TARGET_IDENTITY",
    );
  }
  async operation(fn, signal) {
    requireCheck(
      !this.pending && !this.closed && !this.closing && !this.failure,
      "TARGET_STATE",
    );
    const pending = Promise.resolve()
      .then(async () => {
        signal.throwIfAborted();
        return fn();
      })
      .catch(async (error) => {
        const code =
          error instanceof BridgeError
            ? error.code
            : TARGET_CODES.has(this.worker.evidence.operationError)
              ? this.worker.evidence.operationError
              : TARGET_CODES.has(error.code)
                ? error.code
                : signal.aborted
                  ? "CANCELLED"
                  : "TARGET_OPERATION_ERROR";
        this.failure = { operationCode: code, cleanupCode: null };
        let evidenceError = false;
        try {
          this.record("failure", {
            failure: this.failure,
            diagnostic: String(error.message),
          });
        } catch {
          evidenceError = true;
        }
        try {
          await this.worker.close();
          await this.checkCleanup();
        } catch {
          this.failure.cleanupCode = "CLEANUP_ERROR";
        }
        throw new BridgeError(
          this.failure.cleanupCode ?? (evidenceError ? "EVIDENCE_ERROR" : code),
        );
      });
    this.pending = pending;
    try {
      return await pending;
    } finally {
      if (this.pending === pending) this.pending = null;
    }
  }
  bind(receipt, scenarioId) {
    fields(
      receipt,
      ["runId", "candidateSha", "imageId", "runtimeId", "scenarioId", "policy"],
      "TARGET_RESET_RECEIPT",
    );
    const runtime = this.worker.runtime;
    requireCheck(
      receipt.runId === this.worker.runId &&
        receipt.candidateSha === this.candidateSha &&
        receipt.imageId === this.imageId &&
        receipt.scenarioId === scenarioId &&
        /^[a-f0-9]{64}$/.test(receipt.runtimeId) &&
        runtime?.id === receipt.runtimeId &&
        runtime.scenarioId === scenarioId &&
        runtime.name.startsWith(`${this.worker.runId}-`) &&
        runtime.volume.startsWith(`${this.worker.runId}-`) &&
        runtime.volume.endsWith("-db"),
      "TARGET_IDENTITY",
    );
    requireCheck(
      !this.identity ||
        (this.identity.runtimeId !== receipt.runtimeId &&
          this.identity.volume !== runtime.volume),
      "STALE_RUNTIME",
    );
    this.identity = {
      runtimeId: runtime.id,
      volume: runtime.volume,
      scenarioId,
    };
    this.record("reset", { receipt, identity: this.identity });
  }
  currentIdentity() {
    const runtime = this.worker.runtime;
    requireCheck(
      this.identity &&
        runtime?.id === this.identity.runtimeId &&
        runtime.volume === this.identity.volume &&
        runtime.scenarioId === this.identity.scenarioId &&
        !runtime.exit &&
        !runtime.executionError,
      "STALE_RUNTIME",
    );
    requireCheck(
      this.worker.image === this.imageId &&
        this.worker.bundle.candidateSha === this.candidateSha,
      "TARGET_IDENTITY",
    );
  }
  /** provision already consumes one reset: public-initial. Called BEFORE verifyPair. */
  async provision(signal) {
    return this.operation(async () => {
      requireCheck(this.index === -1 && !this.identity, "TARGET_STATE");
      this.bind(await this.worker.provision(signal), "public-initial");
      this.cleanInitial = structuredClone(
        await this.readSnapshot("provision-initial", signal),
      );
    }, signal);
  }
  async reset(signal) {
    return this.operation(async () => {
      requireCheck(
        this.identity && this.index + 1 < this.scenarios.length,
        "RESET_SCHEDULE",
      );
      if (this.index >= 0)
        requireCheck(
          this.cursor === this.scenarios[this.index].requests.length,
          "INCOMPLETE_SCENARIO",
        );
      const scenario = this.scenarios[++this.index];
      this.cursor = 0;
      this.snapshotCount = 0;
      this.bind(await this.worker.reset(scenario.id, signal), scenario.id);
      requireCheck(
        compareSqlite(
          this.cleanInitial,
          await this.readSnapshot("reset-initial", signal),
        ).length === 0,
        "DIRTY_TARGET_RESET",
      );
      this.stats.resets++;
    }, signal);
  }
  /** Inspect the actual raw trusted inspector receipt too: TargetWorker JSON.parse alone loses duplicate keys. */
  wire(kind, since) {
    const receipts = this.worker.evidence.commands
      .slice(since)
      .filter((receipt) => receipt.args?.includes("/opt/worker/inspect.mjs"));
    requireCheck(receipts.length === 1, "OBSERVATION_RECEIPT");
    const receipt = receipts[0];
    requireSuccess(receipt, "OBSERVATION_ERROR");
    const action = strictJson(receipt.args.at(-1));
    requireCheck(action.kind === kind, "OBSERVATION_IDENTITY");
    if (kind === "http")
      requireCheck(
        receipt.args.includes(`container:${this.identity.runtimeId}`),
        "OBSERVATION_IDENTITY",
      );
    else
      requireCheck(
        receipt.args.includes(
          `type=volume,source=${this.identity.volume},target=/state,readonly`,
        ),
        "OBSERVATION_IDENTITY",
      );
    return { action, raw: strictJson(receipt.stdout, 4 * 1024 * 1024) };
  }
  async request(input, signal) {
    return this.requestStep(
      this.scenarios[this.index]?.id,
      stepId(this.cursor),
      input,
      signal,
    );
  }
  async requestStep(scenarioId, id, input, signal) {
    return this.operation(async () => {
      this.currentIdentity();
      const scenario = this.scenarios[this.index];
      const expected = scenario?.requests[this.cursor];
      requireCheck(
        expected &&
          scenarioId === scenario.id &&
          id === stepId(this.cursor) &&
          input?.method === expected.method &&
          input.path === expected.path &&
          input.body === expected.body &&
          Object.keys(input).every((key) =>
            ["method", "path", "body"].includes(key),
          ),
        "STEP_IDENTITY",
      );
      const since = this.worker.evidence.commands.length;
      const observed = await this.worker.request(
        id,
        expected.method,
        expected.path,
        expected.body,
        signal,
      );
      this.currentIdentity();
      const wire = this.wire("http", since);
      requireCheck(
        wire.action.method === expected.method &&
          wire.action.path === expected.path &&
          wire.action.body === expected.body &&
          JSON.stringify(observed) ===
            JSON.stringify({ ...wire.raw, stepId: id }),
        "OBSERVATION_IDENTITY",
      );
      const result = mapTargetHttp(observed, id, wire.action.requestId);
      this.record("http", {
        scenarioId,
        stepId: id,
        request: expected,
        observed,
      });
      this.cursor++;
      this.stats.requests++;
      return result;
    }, signal);
  }
  async snapshot(signal) {
    return this.operation(async () => {
      requireCheck(this.index >= 0, "TARGET_NOT_RESET");
      const result = await this.readSnapshot(
        `snapshot-${++this.snapshotCount}`,
        signal,
      );
      this.stats.snapshots++;
      return result;
    }, signal);
  }
  async readSnapshot(id, signal) {
    this.currentIdentity();
    const since = this.worker.evidence.commands.length;
    const observed = await this.worker.snapshot(id, signal);
    this.currentIdentity();
    const wire = this.wire("snapshot", since);
    requireCheck(
      JSON.stringify(observed) ===
        JSON.stringify({
          stepId: id,
          runtimeId: this.identity.runtimeId,
          volume: this.identity.volume,
          ...wire.raw,
        }),
      "OBSERVATION_IDENTITY",
    );
    const result = mapTargetSnapshot(observed, this.identity, id);
    this.record("snapshot", {
      identity: this.identity,
      observed,
      mapped: result,
    });
    return result;
  }
  async checkCleanup() {
    const inventory = await this.inventory(this.worker.runId);
    this.lastInventory = inventory;
    this.record("cleanup", { inventory, evidence: this.worker.evidence });
    requireCheck(
      this.worker.evidence.cleanupVerified === true &&
        !this.worker.evidence.cleanupError &&
        inventory.containers.length === 0 &&
        inventory.volumes.length === 0,
      "CLEANUP_ERROR",
    );
  }
  async close(_signal) {
    this.closing = true;
    // Calling worker.close first cancels & joins its active command, then we join
    // our observation conversion; cleanup has its own bounds after caller abort.
    let failed = false;
    try {
      await this.worker.close();
    } catch {
      failed = true;
    }
    await this.pending?.catch(() => {});
    try {
      await this.checkCleanup();
    } catch {
      failed = true;
    }
    this.closed = true;
    if (failed || this.failure?.cleanupCode) {
      this.failure ??= { operationCode: "NONE", cleanupCode: null };
      this.failure.cleanupCode = "CLEANUP_ERROR";
      throw new BridgeError("CLEANUP_ERROR");
    }
  }
}
