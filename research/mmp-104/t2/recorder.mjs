// Research prototype only; the joint-owner gate prohibits production wiring yet.
import {
  CATEGORIES,
  FORMAT,
  isPosition,
  isPublicContext,
  isStage,
  REASONS,
  unavailable,
  validateRecord,
} from "./contract.mjs";

export function createRecorder(context) {
  if (!isPublicContext(context)) throw new Error("TELEMETRY_CONTEXT_REQUIRED");
  let primary = null,
    last = null,
    sealed = false,
    record = null,
    unavailableReason = null;
  const cleanup = new Map();
  const issued = new WeakSet();
  const invalidate = (reason) => {
    if (!sealed)
      unavailableReason ??=
        REASONS.includes(reason) && reason !== "NONE"
          ? reason
          : "INTERNAL_ERROR";
  };
  const checkpoint = (stage, position) => {
    if (!isStage(stage) || !isPosition(position, context)) {
      invalidate("INTERNAL_ERROR");
      return false;
    }
    return !sealed;
  };
  const fail = (stage, position, category) => {
    if (!checkpoint(stage, position)) return;
    if (!CATEGORIES.includes(category)) {
      invalidate("INTERNAL_ERROR");
      return;
    }
    primary ??= Object.freeze({ stage, position, category });
    if (stage.endsWith("_CLOSE") && !cleanup.has(stage))
      cleanup.set(stage, Object.freeze({ stage, category }));
  };
  const complete = (stage, position) => {
    if (checkpoint(stage, position) && !stage.endsWith("_CLOSE"))
      last = Object.freeze({ stage, position });
  };
  return Object.freeze({
    // A telemetry defect marks UNAVAILABLE but does not replace an operation value/error.
    capture(stage, position, operation) {
      checkpoint(stage, position);
      try {
        const value = operation();
        complete(stage, position);
        return value;
      } catch (error) {
        fail(stage, position, "OPERATION_REJECTED");
        throw error;
      }
    },
    async observe(stage, position, signal, operation) {
      checkpoint(stage, position);
      let aborted = false;
      const abort = () => {
        aborted = true;
        fail(stage, position, "SIGNAL_ABORTED");
      };
      if (signal?.aborted) abort();
      signal?.addEventListener("abort", abort, { once: true });
      try {
        const value = await operation(signal);
        if (!aborted) complete(stage, position);
        return value;
      } catch (error) {
        fail(
          stage,
          position,
          aborted ? "SIGNAL_ABORTED" : "OPERATION_REJECTED",
        );
        throw error;
      } finally {
        signal?.removeEventListener("abort", abort);
      }
    },
    invalidate,
    seal() {
      if (!sealed) {
        const raw = {
          format: FORMAT,
          scope: "PUBLIC_MANIFEST",
          status: "AVAILABLE",
          unavailableReason: "NONE",
          binding: context.binding,
          scenarioIndex: context.scenarioIndex,
          stepIndex: primary ? primary.position : (last?.position ?? null),
          firstFailureStage: primary?.stage ?? null,
          failureCategory: primary?.category ?? "UNKNOWN",
          lastCompletedStage: last?.stage ?? null,
          cleanupFailures: [...cleanup.values()].sort((a, b) =>
            a.stage.localeCompare(b.stage),
          ),
          truncated: false,
        };
        const checked = unavailableReason ? null : validateRecord(raw, context);
        record = checked?.ok
          ? checked.record
          : unavailable(
              context,
              unavailableReason ?? checked?.reason ?? "INTERNAL_ERROR",
            );
        issued.add(record);
        sealed = true;
      }
      return record;
    },
    project(value, expectedContext = context) {
      if (value === null || value === undefined)
        return unavailable(expectedContext, "ABSENT");
      if (!issued.has(value))
        return unavailable(expectedContext, "UNTRUSTED_RECORD");
      const checked = validateRecord(value, expectedContext);
      return checked.ok
        ? checked.record
        : unavailable(expectedContext, checked.reason);
    },
  });
}
