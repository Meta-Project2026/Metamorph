import { performance } from "node:perf_hooks";
import type { HttpObservation } from "../http.js";
import { validateHttp } from "../http.js";
import type { ScenarioRequest, WorkerAdapter } from "../runner.js";
import type { SqliteSnapshot } from "../sqlite.js";
import { compareSqlite, validateSnapshot } from "../sqlite.js";
import type { Inspection } from "./docker.js";
import type { PrivateEvidence } from "./evidence.js";
import {
  BOOTSTRAP,
  ensure,
  MANIFEST,
  ReferenceWorkerError,
  SOURCE,
  stepId,
} from "./manifest.js";

export interface ReferenceTransport {
  reset(signal: AbortSignal): Promise<void>;
  http(
    request: ScenarioRequest,
    signal: AbortSignal,
  ): Promise<{ observation: HttpObservation; raw: unknown }>;
  inspect(signal: AbortSignal): Promise<Inspection>;
  close(): Promise<void>;
}
/** Bind reset order to verifyPair.scenarios; each reset consumes one declared scenario. */
export class PhpReferenceWorker implements WorkerAdapter {
  private attempt = -1;
  private cursor = 0;
  private captures = 0;
  private busy = false;
  private failed = false;
  private closed = false;
  private closing = false;
  private completion: Promise<void> | undefined;
  private last: SqliteSnapshot | undefined;
  constructor(
    private readonly transport: ReferenceTransport,
    private readonly evidence: PrivateEvidence,
    private readonly schedule: readonly string[],
  ) {
    ensure(
      schedule.length > 0 &&
        schedule.length <= 100 &&
        schedule.every((id) => MANIFEST.some((s) => s.id === id)),
      "SCENARIO_ID",
    );
    this.schedule = Object.freeze([...schedule]);
  }
  private async exclusive<T>(operation: () => Promise<T>): Promise<T> {
    ensure(
      !this.busy && !this.failed && !this.closed && !this.closing,
      "WORKER_STATE",
    );
    this.busy = true;
    let complete: (() => void) | undefined;
    this.completion = new Promise<void>((resolve) => {
      complete = resolve;
    });
    try {
      return await operation();
    } catch {
      this.failed = true;
      try {
        await this.transport.close();
      } catch {
        throw new ReferenceWorkerError("CLEANUP_ERROR");
      }
      throw new ReferenceWorkerError("REFERENCE_OPERATION_ERROR");
    } finally {
      this.busy = false;
      complete?.();
      this.completion = undefined;
    }
  }
  private async capture(signal: AbortSignal): Promise<Inspection> {
    signal.throwIfAborted();
    const result = await this.transport.inspect(signal);
    validateSnapshot(result.snapshot);
    this.evidence.write(
      `attempt-${this.attempt + 1}-capture-${++this.captures}`,
      result,
    );
    return result;
  }
  async reset(signal: AbortSignal): Promise<void> {
    return this.exclusive(async () => {
      signal.throwIfAborted();
      if (this.attempt >= 0)
        ensure(
          this.cursor === this.scenario().requests.length,
          "INCOMPLETE_SCENARIO",
        );
      ensure(
        this.attempt + 1 < this.schedule.length,
        "RESET_SCHEDULE_EXHAUSTED",
      );
      this.attempt++;
      this.cursor = 0;
      this.captures = 0;
      await this.transport.reset(signal);
      const bootstrap = await this.transport.http(BOOTSTRAP, signal);
      validateHttp(bootstrap.observation);
      ensure(bootstrap.observation.status === 200, "BOOTSTRAP_ERROR");
      this.evidence.write(`attempt-${this.attempt + 1}-bootstrap`, {
        scenarioId: this.scenario().id,
        request: BOOTSTRAP,
        response: bootstrap.raw,
      });
      const initial = await this.capture(signal);
      ensure(initial.legacySha256 === SOURCE.initialSha256, "DIRTY_RESET");
      this.last = structuredClone(initial.snapshot);
    });
  }
  private scenario() {
    const scenario = MANIFEST.find((s) => s.id === this.schedule[this.attempt]);
    ensure(scenario, "WORKER_NOT_RESET");
    return scenario;
  }
  async request(
    input: ScenarioRequest,
    signal: AbortSignal,
  ): Promise<HttpObservation> {
    return this.requestStep(
      this.scenario().id,
      stepId(this.cursor),
      input,
      signal,
    );
  }
  async requestStep(
    scenarioId: string,
    id: string,
    input: ScenarioRequest,
    signal: AbortSignal,
  ): Promise<HttpObservation> {
    return this.exclusive(async () => {
      signal.throwIfAborted();
      const scenario = this.scenario();
      const expected = scenario.requests[this.cursor];
      ensure(
        scenarioId === scenario.id && id === stepId(this.cursor) && expected,
        "STEP_ID",
      );
      ensure(
        input &&
          input.method === expected.method &&
          input.path === expected.path &&
          input.body === expected.body &&
          Object.keys(input).every((key) =>
            ["method", "path", "body"].includes(key),
          ),
        "REQUEST_MANIFEST",
      );
      const startedMs = performance.now();
      const before = await this.capture(signal);
      ensure(
        this.last && compareSqlite(this.last, before.snapshot).length === 0,
        "UNEXPECTED_STATE_CHANGE",
      );
      const response = await this.transport.http(expected, signal);
      validateHttp(response.observation);
      const after = await this.capture(signal);
      this.evidence.write(`attempt-${this.attempt + 1}-${id}`, {
        scenarioId,
        stepId: id,
        request: expected,
        response: response.raw,
        before: before.snapshot,
        after: after.snapshot,
        startedMonotonicMs: startedMs,
        elapsedMs: performance.now() - startedMs,
      });
      this.last = structuredClone(after.snapshot);
      this.cursor++;
      return response.observation;
    });
  }
  async snapshot(signal: AbortSignal): Promise<SqliteSnapshot> {
    return this.exclusive(async () => {
      this.scenario();
      const state = await this.capture(signal);
      ensure(
        this.last && compareSqlite(this.last, state.snapshot).length === 0,
        "UNEXPECTED_STATE_CHANGE",
      );
      return state.snapshot;
    });
  }
  async close(_signal: AbortSignal): Promise<void> {
    // Cleanup uses its own bounds even if verifyPair's operation signal has expired.
    this.closing = true;
    await this.completion;
    await this.transport.close();
    this.closed = true;
  }
}
