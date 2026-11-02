// Trusted research observer: records method boundaries, never arguments/results/errors.
import { AsyncLocalStorage } from "node:async_hooks";
export const STAGES = Object.freeze([
  "REFERENCE_REQUEST",
  "REFERENCE_SNAPSHOT",
  "REFERENCE_CLOSE",
  "REFERENCE_HTTP_TRANSPORT",
  "REFERENCE_DB_INSPECT",
  "TARGET_REQUEST",
  "TARGET_SNAPSHOT",
  "TARGET_CLOSE",
  "TARGET_WORKER_REQUEST",
  "TARGET_WORKER_SNAPSHOT",
  "TARGET_HTTP_OBSERVE",
  "TARGET_DB_OBSERVE",
]);
const CATEGORIES = new Set([
  "COMMAND_TIMEOUT",
  "COMMAND_CANCELLED",
  "COMMAND_UNAVAILABLE",
  "COMMAND_OUTPUT_LIMIT",
  "COMMAND_EXIT_NONZERO",
]);
const value = (object, key) =>
  Object.getOwnPropertyDescriptor(object, key)?.value;
export function commandCategory(result) {
  // Called only at trusted command-result/evidence-write sites, not worker JSON.
  try {
    const fault = value(result, "fault");
    if (value(result, "timedOut") === true || fault === "WORKER_TIMEOUT")
      return "COMMAND_TIMEOUT";
    if (value(result, "cancelled") === true || fault === "WORKER_ABORTED")
      return "COMMAND_CANCELLED";
    if (value(result, "spawnError") === true || fault === "DOCKER_UNAVAILABLE")
      return "COMMAND_UNAVAILABLE";
    if (value(result, "overflow") === true || fault === "WORKER_OUTPUT_LIMIT")
      return "COMMAND_OUTPUT_LIMIT";
    const exit = value(result, "exitCode");
    if (Number.isSafeInteger(exit) && exit !== 0) return "COMMAND_EXIT_NONZERO";
  } catch {
    /* Missing/hostile metadata cannot create a specific class. */
  }
  return null;
}
export function createObserver() {
  const local = new AsyncLocalStorage(),
    events = [],
    active = new Set();
  let serial = 0,
    unavailable = false,
    sealed;
  const emit = (entry) => {
    if (sealed) return;
    if (events.length >= 128) {
      unavailable = true;
      return;
    }
    events.push(Object.freeze(entry));
  };
  const api = {
    invalidate() {
      unavailable = true;
    },
    async invoke(stage, operation, signal) {
      if (!STAGES.includes(stage)) throw Error("OBSERVER_STAGE_REJECTED");
      const id = ++serial,
        parent = local.getStore() ?? null;
      active.add(id);
      emit({ id, parent, stage, outcome: "ENTER", category: null });
      return local.run(id, async () => {
        try {
          const result = await operation();
          emit({ id, parent, stage, outcome: "FULFILLED", category: null });
          return result;
        } catch (error) {
          emit({
            id,
            parent,
            stage,
            outcome: "REJECTED",
            category:
              signal instanceof AbortSignal && signal.aborted
                ? "SIGNAL_ABORTED"
                : "UNKNOWN",
          });
          throw error;
        } finally {
          active.delete(id);
        }
      });
    },
    process(result) {
      const parent = local.getStore(),
        category = commandCategory(result);
      if (parent && category && CATEGORIES.has(category))
        emit({
          id: ++serial,
          parent,
          stage: "TRUSTED_COMMAND",
          outcome: "UNSUCCESSFUL",
          category,
        });
    },
    seal() {
      if (sealed) return sealed;
      const primary = events.find(
        (e) => e.outcome === "REJECTED" && !e.stage.endsWith("_CLOSE"),
      );
      const command =
        primary &&
        events.find(
          (e) => e.outcome === "UNSUCCESSFUL" && e.parent === primary.id,
        );
      const complete = !unavailable && active.size === 0;
      sealed = Object.freeze({
        format: "mmp125-boundary-trace-v1",
        status: complete ? "COMPLETE" : "UNAVAILABLE",
        firstRejectedBoundary: complete ? (primary?.stage ?? null) : null,
        failureClass: complete
          ? (command?.category ?? primary?.category ?? "UNKNOWN")
          : "UNKNOWN",
        rootCause: "UNKNOWN",
        events: Object.freeze([...events]),
      });
      return sealed;
    },
  };
  return Object.freeze(api);
}
export function wrapMethod(observer, prototype, method, stage, signalIndex) {
  const original = prototype[method];
  if (typeof original !== "function") throw Error("OBSERVER_METHOD_REJECTED");
  prototype[method] = function (...args) {
    return observer.invoke(
      stage,
      () => Reflect.apply(original, this, args),
      args[signalIndex],
    );
  };
  return () => {
    prototype[method] = original;
  };
}
