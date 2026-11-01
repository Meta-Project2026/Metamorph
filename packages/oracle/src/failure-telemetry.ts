import { MANIFEST, SOURCE } from "./reference/manifest.js";

export const FAILURE_TELEMETRY_FORMAT = "mmp104-trusted-stage-v1";
export const FAILURE_TELEMETRY_MAX_BYTES = 2048;
export const FAILURE_STAGES = Object.freeze([
  "REFERENCE_RESET",
  "CANDIDATE_RESET",
  "REFERENCE_INITIAL_SNAPSHOT",
  "CANDIDATE_INITIAL_SNAPSHOT",
  "REFERENCE_REQUEST",
  "CANDIDATE_REQUEST",
  "REFERENCE_STEP_SNAPSHOT",
  "CANDIDATE_STEP_SNAPSHOT",
  "REFERENCE_CLOSE",
  "CANDIDATE_CLOSE",
  "REQUEST_CLONE",
  "REFERENCE_OBSERVATION_CLONE",
  "CANDIDATE_OBSERVATION_CLONE",
  "REFERENCE_HTTP_SERIALIZE",
  "CANDIDATE_HTTP_SERIALIZE",
  "HTTP_COMPARE",
  "DB_INITIAL_COMPARE",
  "DB_STEP_COMPARE",
  "EVIDENCE_CONTROLS_WRITE",
  "EVIDENCE_INITIAL_REFERENCE_WRITE",
  "EVIDENCE_INITIAL_PAIR_WRITE",
  "EVIDENCE_INITIAL_DIFF_WRITE",
  "EVIDENCE_HTTP_REFERENCE_WRITE",
  "EVIDENCE_HTTP_PAIR_WRITE",
  "EVIDENCE_HTTP_DIFF_WRITE",
  "EVIDENCE_DB_REFERENCE_WRITE",
  "EVIDENCE_DB_PAIR_WRITE",
  "EVIDENCE_DB_DIFF_WRITE",
  "EVIDENCE_PUBLICATION_WRITE",
] as const);
export type FailureStage = (typeof FAILURE_STAGES)[number];
const CATEGORIES = ["OPERATION_REJECTED", "SIGNAL_ABORTED", "UNKNOWN"] as const;
type Category = (typeof CATEGORIES)[number];
const REASONS = [
  "NONE",
  "ABSENT",
  "MISSING_BINDING",
  "UNTRUSTED_RECORD",
  "MALFORMED",
  "FOREIGN_BINDING",
  "OVERSIZE",
  "TRUNCATED",
  "INTERNAL_ERROR",
  "PUBLICATION_FAILED",
] as const;
type Reason = (typeof REASONS)[number];
const BINDING_KEYS = [
  "runId",
  "headSha",
  "sourceSha",
  "candidateSha",
  "attemptId",
  "pairId",
] as const;
export type FailureTelemetryBinding = Readonly<
  Record<(typeof BINDING_KEYS)[number], string>
>;
export interface FailureTelemetryContext {
  readonly binding: FailureTelemetryBinding;
  readonly scenarioIndex: number;
}
export interface FailureTelemetryRecord {
  readonly format: typeof FAILURE_TELEMETRY_FORMAT;
  readonly scope: "PUBLIC_MANIFEST";
  readonly status: "AVAILABLE" | "UNAVAILABLE";
  readonly unavailableReason: Reason;
  readonly binding: FailureTelemetryBinding | null;
  readonly scenarioIndex: number | null;
  readonly stepIndex: number | null;
  readonly firstFailureStage: FailureStage | null;
  readonly failureCategory: Category;
  readonly lastCompletedStage: FailureStage | null;
  readonly cleanupFailures: readonly Readonly<{
    stage: FailureStage;
    category: Category;
  }>[];
  readonly truncated: boolean;
}
const RECORD_KEYS = [
  "format",
  "scope",
  "status",
  "unavailableReason",
  "binding",
  "scenarioIndex",
  "stepIndex",
  "firstFailureStage",
  "failureCategory",
  "lastCompletedStage",
  "cleanupFailures",
  "truncated",
];
type Point = Readonly<{
  stage: FailureStage;
  position: number | null;
  category: Category;
}>;
interface State {
  active: boolean;
  sealed: FailureTelemetryRecord | null;
  unavailable: Reason | null;
  primary: Point | null;
  last: { stage: FailureStage; position: number | null } | null;
  cleanup: Map<
    FailureStage,
    Readonly<{ stage: FailureStage; category: Category }>
  >;
}
const states = new WeakMap<FailureTelemetryContext, State>();
const issued = new WeakMap<object, FailureTelemetryContext>();
const ownErrors = new WeakMap<object, Reason>();
const stageSet = new Set<string>(FAILURE_STAGES);
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
function bad(reason: Reason): never {
  const error = new Error("TELEMETRY_CONTRACT_REJECTED");
  ownErrors.set(error, reason);
  throw error;
}
function data(raw: unknown, names: readonly string[]): Record<string, unknown> {
  if (
    raw === null ||
    typeof raw !== "object" ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(raw))
  )
    bad("MALFORMED");
  const keys = Reflect.ownKeys(raw);
  if (
    keys.length !== names.length ||
    keys.some((k) => typeof k !== "string" || !names.includes(k))
  )
    bad("MALFORMED");
  const descriptors = Object.getOwnPropertyDescriptors(raw);
  return Object.fromEntries(
    names.map((name) => {
      const descriptor = descriptors[name];
      if (!descriptor || !Object.hasOwn(descriptor, "value")) bad("MALFORMED");
      return [name, descriptor.value];
    }),
  );
}
function checkedBinding(raw: unknown): FailureTelemetryBinding {
  const b = data(raw, BINDING_KEYS);
  for (const key of BINDING_KEYS) {
    if (typeof b[key] !== "string") bad("MALFORMED");
    if (b[key].length > 64) bad("OVERSIZE");
  }
  const value = b as Record<(typeof BINDING_KEYS)[number], string>;
  if (
    !/^[1-9][0-9]{0,19}$/.test(value.runId) ||
    !/^[a-f0-9]{40}$/.test(value.headSha) ||
    !/^[a-f0-9]{40}$/.test(value.sourceSha) ||
    !/^[a-f0-9]{64}$/.test(value.candidateSha) ||
    !uuid.test(value.attemptId) ||
    !uuid.test(value.pairId)
  )
    bad("MALFORMED");
  return Object.freeze(value);
}
/** Host-only minting. No worker/candidate payload belongs at this API. */
export function createFailureTelemetry(
  rawBinding: unknown,
  scenarioIndex: number,
): FailureTelemetryContext | null {
  try {
    if (
      !Number.isSafeInteger(scenarioIndex) ||
      scenarioIndex < 0 ||
      scenarioIndex >= MANIFEST.length
    )
      bad("MALFORMED");
    const binding = checkedBinding(rawBinding);
    if (binding.sourceSha !== SOURCE.commit) bad("FOREIGN_BINDING");
    const context = Object.freeze({ binding, scenarioIndex });
    states.set(context, {
      active: false,
      sealed: null,
      unavailable: null,
      primary: null,
      last: null,
      cleanup: new Map(),
    });
    return context;
  } catch {
    return null;
  }
}
export const isFailureTelemetryContext = (
  value: unknown,
): value is FailureTelemetryContext =>
  value !== null &&
  typeof value === "object" &&
  states.has(value as FailureTelemetryContext);
function position(
  value: unknown,
  context: FailureTelemetryContext,
): value is number | null {
  return (
    value === null ||
    (Number.isSafeInteger(value) &&
      typeof value === "number" &&
      value >= 0 &&
      value < (MANIFEST[context.scenarioIndex]?.requests.length ?? 0))
  );
}
function stagePosition(
  stage: FailureStage,
  value: unknown,
  context: FailureTelemetryContext,
): boolean {
  if (!position(value, context)) return false;
  if (stage.endsWith("_OBSERVATION_CLONE")) return true; // Initial DB or per-step HTTP/DB.
  const noStep =
    stage.endsWith("_RESET") ||
    stage.endsWith("_CLOSE") ||
    stage.endsWith("_INITIAL_SNAPSHOT") ||
    stage === "DB_INITIAL_COMPARE" ||
    stage.startsWith("EVIDENCE_INITIAL_") ||
    ["EVIDENCE_CONTROLS_WRITE", "EVIDENCE_PUBLICATION_WRITE"].includes(stage);
  return noStep ? value === null : value !== null;
}
export function unavailableFailureTelemetry(
  context: FailureTelemetryContext | null | undefined,
  reason: Reason,
): FailureTelemetryRecord {
  const trusted = isFailureTelemetryContext(context);
  const fixed = !trusted
    ? "MISSING_BINDING"
    : REASONS.includes(reason) && reason !== "NONE"
      ? reason
      : "INTERNAL_ERROR";
  const record: FailureTelemetryRecord = Object.freeze({
    format: FAILURE_TELEMETRY_FORMAT,
    scope: "PUBLIC_MANIFEST",
    status: "UNAVAILABLE",
    unavailableReason: fixed,
    binding: trusted ? context.binding : null,
    scenarioIndex: trusted ? context.scenarioIndex : null,
    stepIndex: null,
    firstFailureStage: null,
    failureCategory: "UNKNOWN",
    lastCompletedStage: null,
    cleanupFailures: Object.freeze([]),
    truncated: fixed === "TRUNCATED",
  });
  if (trusted) issued.set(record, context);
  return record;
}
/** Shape/binding validation is NOT provenance; project additionally checks issuance. */
export function validateFailureTelemetry(
  raw: unknown,
  context: FailureTelemetryContext | null | undefined,
):
  | { ok: true; record: FailureTelemetryRecord }
  | { ok: false; reason: Reason } {
  try {
    if (!isFailureTelemetryContext(context)) bad("MISSING_BINDING");
    const r = data(raw, RECORD_KEYS);
    if (
      r.format !== FAILURE_TELEMETRY_FORMAT ||
      r.scope !== "PUBLIC_MANIFEST" ||
      !["AVAILABLE", "UNAVAILABLE"].includes(r.status as string) ||
      !REASONS.includes(r.unavailableReason as Reason) ||
      typeof r.truncated !== "boolean"
    )
      bad("MALFORMED");
    if (
      r.truncated &&
      !(r.status === "UNAVAILABLE" && r.unavailableReason === "TRUNCATED")
    )
      bad("TRUNCATED");
    if (
      r.status === "UNAVAILABLE" &&
      r.truncated !== (r.unavailableReason === "TRUNCATED")
    )
      bad("MALFORMED");
    const binding = checkedBinding(r.binding);
    if (
      BINDING_KEYS.some((k) => binding[k] !== context.binding[k]) ||
      r.scenarioIndex !== context.scenarioIndex
    )
      bad("FOREIGN_BINDING");
    if (
      !position(r.stepIndex, context) ||
      !CATEGORIES.includes(r.failureCategory as Category)
    )
      bad("MALFORMED");
    for (const stage of [r.firstFailureStage, r.lastCompletedStage])
      if (stage !== null && (typeof stage !== "string" || !stageSet.has(stage)))
        bad("MALFORMED");
    if (r.firstFailureStage === null && r.failureCategory !== "UNKNOWN")
      bad("MALFORMED");
    const relevantStage = r.firstFailureStage ?? r.lastCompletedStage;
    if (
      relevantStage !== null &&
      !stagePosition(relevantStage as FailureStage, r.stepIndex, context)
    )
      bad("MALFORMED");
    if (relevantStage === null && r.stepIndex !== null) bad("MALFORMED");
    if (
      !Array.isArray(r.cleanupFailures) ||
      Object.getPrototypeOf(r.cleanupFailures) !== Array.prototype
    )
      bad("MALFORMED");
    const descriptors = Object.getOwnPropertyDescriptors(
      r.cleanupFailures,
    ) as unknown as Record<string, PropertyDescriptor>;
    const length = descriptors.length?.value;
    if (!Number.isSafeInteger(length) || length < 0) bad("MALFORMED");
    if (length > 2) bad("OVERSIZE");
    if (Reflect.ownKeys(r.cleanupFailures).length !== length + 1)
      bad("MALFORMED");
    const cleanup: { stage: FailureStage; category: Category }[] = [];
    for (let i = 0; i < length; i++) {
      const d = descriptors[i];
      if (!d || !Object.hasOwn(d, "value")) bad("MALFORMED");
      const entry = data(d.value, ["stage", "category"]);
      if (
        !["REFERENCE_CLOSE", "CANDIDATE_CLOSE"].includes(
          entry.stage as string,
        ) ||
        !CATEGORIES.includes(entry.category as Category) ||
        cleanup.some((c) => c.stage === entry.stage)
      )
        bad("MALFORMED");
      cleanup.push(
        Object.freeze(entry) as { stage: FailureStage; category: Category },
      );
    }
    if (
      cleanup.some(
        (entry, i) => i > 0 && (cleanup[i - 1]?.stage ?? "") >= entry.stage,
      ) ||
      (r.firstFailureStage === null && cleanup.length)
    )
      bad("MALFORMED");
    if (r.status === "AVAILABLE" && r.unavailableReason !== "NONE")
      bad("MALFORMED");
    if (
      r.status === "UNAVAILABLE" &&
      (r.unavailableReason === "NONE" ||
        r.firstFailureStage !== null ||
        r.lastCompletedStage !== null ||
        r.stepIndex !== null ||
        cleanup.length)
    )
      bad("MALFORMED");
    const record: FailureTelemetryRecord = Object.freeze({
      format: FAILURE_TELEMETRY_FORMAT,
      scope: "PUBLIC_MANIFEST",
      status: r.status as "AVAILABLE" | "UNAVAILABLE",
      unavailableReason: r.unavailableReason as Reason,
      binding,
      scenarioIndex: context.scenarioIndex,
      stepIndex: r.stepIndex,
      firstFailureStage: r.firstFailureStage as FailureStage | null,
      failureCategory: r.failureCategory as Category,
      lastCompletedStage: r.lastCompletedStage as FailureStage | null,
      cleanupFailures: Object.freeze(cleanup),
      truncated: r.truncated,
    });
    if (Buffer.byteLength(JSON.stringify(record)) > FAILURE_TELEMETRY_MAX_BYTES)
      bad("OVERSIZE");
    return { ok: true, record };
  } catch (error) {
    // Never read message/code/stack (including hostile thrown proxies/getters).
    const reason =
      error !== null && typeof error === "object"
        ? ownErrors.get(error)
        : undefined;
    return { ok: false, reason: reason ?? "MALFORMED" };
  }
}
export function projectFailureTelemetry(
  raw: unknown,
  context: FailureTelemetryContext | null | undefined,
): FailureTelemetryRecord {
  if (!isFailureTelemetryContext(context))
    return unavailableFailureTelemetry(null, "MISSING_BINDING");
  if (raw === null || raw === undefined)
    return unavailableFailureTelemetry(context, "ABSENT");
  if (typeof raw !== "object" || !issued.has(raw))
    return unavailableFailureTelemetry(context, "UNTRUSTED_RECORD");
  if (issued.get(raw) !== context)
    return unavailableFailureTelemetry(context, "FOREIGN_BINDING");
  const checked = validateFailureTelemetry(raw, context);
  return checked.ok
    ? checked.record
    : unavailableFailureTelemetry(context, checked.reason);
}
export function finishFailureTelemetry(
  context: FailureTelemetryContext | null | undefined,
): FailureTelemetryRecord {
  if (!isFailureTelemetryContext(context))
    return unavailableFailureTelemetry(null, "MISSING_BINDING");
  const state = states.get(context);
  if (!state) return unavailableFailureTelemetry(null, "MISSING_BINDING");
  if (state.sealed) return state.sealed;
  if (state.unavailable || !state.active)
    state.sealed = unavailableFailureTelemetry(
      context,
      state.unavailable ?? "ABSENT",
    );
  else {
    const checked = validateFailureTelemetry(
      {
        format: FAILURE_TELEMETRY_FORMAT,
        scope: "PUBLIC_MANIFEST",
        status: "AVAILABLE",
        unavailableReason: "NONE",
        binding: context.binding,
        scenarioIndex: context.scenarioIndex,
        stepIndex: state.primary
          ? state.primary.position
          : (state.last?.position ?? null),
        firstFailureStage: state.primary?.stage ?? null,
        failureCategory: state.primary?.category ?? "UNKNOWN",
        lastCompletedStage: state.last?.stage ?? null,
        cleanupFailures: [...state.cleanup.values()].sort((a, b) =>
          a.stage < b.stage ? -1 : 1,
        ),
        truncated: false,
      },
      context,
    );
    state.sealed = checked.ok
      ? checked.record
      : unavailableFailureTelemetry(context, checked.reason);
  }
  issued.set(state.sealed, context);
  return state.sealed;
}

/** Internal runner API: no events, callbacks or labels come from a worker. */
export function failureTelemetryRecorder(
  context: FailureTelemetryContext | null | undefined,
  scenarios: unknown,
) {
  const state = isFailureTelemetryContext(context)
    ? states.get(context)
    : undefined;
  if (state && !state.sealed) {
    // Only the exact pinned public scenario may emit a stage; never hidden G4.
    try {
      if (
        JSON.stringify(scenarios) ===
        JSON.stringify([MANIFEST[context?.scenarioIndex ?? -1]])
      )
        state.active = true;
      else state.unavailable ??= "FOREIGN_BINDING";
    } catch {
      state.unavailable ??= "INTERNAL_ERROR";
    }
  }
  const invalidate = (reason: Reason) => {
    if (state && !state.sealed) state.unavailable ??= reason;
  };
  const checkpoint = (stage: FailureStage, index: number | null) => {
    if (!state?.active || state.sealed || !isFailureTelemetryContext(context))
      return false;
    if (!stageSet.has(stage) || !stagePosition(stage, index, context)) {
      invalidate("INTERNAL_ERROR");
      return false;
    }
    return true;
  };
  const fail = (
    stage: FailureStage,
    index: number | null,
    category: Category,
  ) => {
    if (!checkpoint(stage, index) || !state) return;
    state.primary ??= Object.freeze({ stage, position: index, category });
    if (stage.endsWith("_CLOSE") && !state.cleanup.has(stage))
      state.cleanup.set(stage, Object.freeze({ stage, category }));
  };
  const complete = (stage: FailureStage, index: number | null) => {
    if (
      checkpoint(stage, index) &&
      state &&
      !state.primary &&
      !stage.endsWith("_CLOSE")
    )
      state.last = { stage, position: index };
  };
  return {
    invalidate,
    unclassifiedFailure() {
      // A failure outside the approved checkpoints is explicitly unavailable;
      // absence of an observed stage must not imply that the verifier succeeded.
      if (state && !state.primary) invalidate("INTERNAL_ERROR");
    },
    capture<T>(
      stage: FailureStage,
      index: number | null,
      operation: () => T,
    ): T {
      checkpoint(stage, index);
      try {
        const value = operation();
        complete(stage, index);
        return value;
      } catch (error) {
        fail(stage, index, "OPERATION_REJECTED");
        throw error;
      }
    },
    async observe<T>(
      stage: FailureStage,
      index: number | null,
      signal: AbortSignal | null,
      operation: () => Promise<T>,
    ): Promise<T> {
      if (!checkpoint(stage, index)) return operation();
      let aborted = false;
      const abort = () => {
        aborted = true;
        fail(stage, index, "SIGNAL_ABORTED");
      };
      if (signal?.aborted) abort();
      signal?.addEventListener("abort", abort, { once: true });
      try {
        const value = await operation();
        if (!aborted) complete(stage, index);
        return value;
      } catch (error) {
        fail(stage, index, aborted ? "SIGNAL_ABORTED" : "OPERATION_REJECTED");
        throw error;
      } finally {
        signal?.removeEventListener("abort", abort);
      }
    },
  };
}
