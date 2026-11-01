// NONPRODUCTION v1 proposal. No production module imports this research code.
import { MANIFEST, SOURCE } from "../../../packages/oracle/dist/index.js";

export const FORMAT = "mmp104-trusted-stage-v1";
export const MAX_BYTES = 2048;
export const CATEGORIES = Object.freeze([
  "OPERATION_REJECTED",
  "SIGNAL_ABORTED",
  "UNKNOWN",
]);
export const REASONS = Object.freeze([
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
]);
export const STAGES = Object.freeze([
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
]);
export const BINDING_KEYS = Object.freeze([
  "runId",
  "headSha",
  "sourceSha",
  "candidateSha",
  "attemptId",
  "pairId",
]);
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
const contexts = new WeakSet();
const stageSet = new Set(STAGES);
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const ownErrors = new WeakMap();
const bad = (reason) => {
  const error = new Error("TELEMETRY_CONTRACT_REJECTED");
  ownErrors.set(error, reason);
  throw error;
};

// Exact own data descriptors only: no getters, inherited fields, symbols or toJSON.
function data(value, names) {
  if (
    value === null ||
    typeof value !== "object" ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    bad("MALFORMED");
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== names.length ||
    keys.some((key) => typeof key !== "string" || !names.includes(key))
  )
    bad("MALFORMED");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  return Object.fromEntries(
    names.map((name) => {
      const d = descriptors[name];
      if (!d || !Object.hasOwn(d, "value")) bad("MALFORMED");
      return [name, d.value];
    }),
  );
}
function binding(value) {
  const b = data(value, BINDING_KEYS);
  for (const key of BINDING_KEYS) {
    if (typeof b[key] !== "string") bad("MALFORMED");
    if (b[key].length > 64) bad("OVERSIZE");
  }
  if (
    !/^[1-9][0-9]{0,19}$/.test(b.runId) ||
    !/^[a-f0-9]{40}$/.test(b.headSha) ||
    !/^[a-f0-9]{40}$/.test(b.sourceSha) ||
    !/^[a-f0-9]{64}$/.test(b.candidateSha) ||
    !uuid.test(b.attemptId) ||
    !uuid.test(b.pairId)
  )
    bad("MALFORMED");
  return Object.freeze(b);
}
export function createPublicContext(
  rawBinding,
  scenarioIndex,
  scope = "PUBLIC_MANIFEST",
) {
  if (
    scope !== "PUBLIC_MANIFEST" ||
    !Number.isSafeInteger(scenarioIndex) ||
    scenarioIndex < 0 ||
    scenarioIndex >= MANIFEST.length ||
    scenarioIndex > 99
  )
    bad("MALFORMED");
  const b = binding(rawBinding);
  if (b.sourceSha !== SOURCE.commit) bad("FOREIGN_BINDING");
  const context = Object.freeze({
    binding: b,
    scenarioIndex,
    requestCount: MANIFEST[scenarioIndex].requests.length,
  });
  contexts.add(context);
  return context;
}
export const isPublicContext = (value) => contexts.has(value);
export const isStage = (stage) => stageSet.has(stage);
export const isPosition = (value, context) =>
  value === null ||
  (Number.isSafeInteger(value) &&
    value >= 0 &&
    value < context.requestCount &&
    value <= 99);
const frozen = (value) => Object.freeze(value);

export function unavailable(context, reason) {
  const trusted = contexts.has(context);
  const fixedReason = !trusted
    ? "MISSING_BINDING"
    : REASONS.includes(reason) && reason !== "NONE"
      ? reason
      : "INTERNAL_ERROR";
  return frozen({
    format: FORMAT,
    scope: "PUBLIC_MANIFEST",
    status: "UNAVAILABLE",
    unavailableReason: fixedReason,
    binding: trusted ? context.binding : null,
    scenarioIndex: trusted ? context.scenarioIndex : null,
    stepIndex: null,
    firstFailureStage: null,
    failureCategory: "UNKNOWN",
    lastCompletedStage: null,
    cleanupFailures: frozen([]),
    truncated: fixedReason === "TRUNCATED",
  });
}

// Schema/identity validation only, NOT proof of provenance or owner authorization.
export function validateRecord(raw, context) {
  try {
    if (!contexts.has(context)) bad("MISSING_BINDING");
    const r = data(raw, RECORD_KEYS);
    if (
      r.format !== FORMAT ||
      r.scope !== "PUBLIC_MANIFEST" ||
      !["AVAILABLE", "UNAVAILABLE"].includes(r.status) ||
      !REASONS.includes(r.unavailableReason) ||
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
      r.unavailableReason === "TRUNCATED" &&
      !r.truncated
    )
      bad("MALFORMED");
    const b = binding(r.binding);
    if (
      BINDING_KEYS.some((key) => b[key] !== context.binding[key]) ||
      r.scenarioIndex !== context.scenarioIndex
    )
      bad("FOREIGN_BINDING");
    if (
      !isPosition(r.stepIndex, context) ||
      !CATEGORIES.includes(r.failureCategory)
    )
      bad("MALFORMED");
    for (const stage of [r.firstFailureStage, r.lastCompletedStage])
      if (stage !== null && !isStage(stage)) bad("MALFORMED");
    if (r.firstFailureStage === null && r.failureCategory !== "UNKNOWN")
      bad("MALFORMED");
    if (
      !Array.isArray(r.cleanupFailures) ||
      Object.getPrototypeOf(r.cleanupFailures) !== Array.prototype
    )
      bad("MALFORMED");
    const descriptors = Object.getOwnPropertyDescriptors(r.cleanupFailures);
    const length = descriptors.length?.value;
    if (!Number.isSafeInteger(length) || length < 0) bad("MALFORMED");
    if (length > 2) bad("OVERSIZE");
    if (Reflect.ownKeys(r.cleanupFailures).length !== length + 1)
      bad("MALFORMED");
    const cleanup = [];
    for (let i = 0; i < length; i++) {
      if (!descriptors[i] || !Object.hasOwn(descriptors[i], "value"))
        bad("MALFORMED");
      const entry = data(descriptors[i].value, ["stage", "category"]);
      if (
        !["REFERENCE_CLOSE", "CANDIDATE_CLOSE"].includes(entry.stage) ||
        !CATEGORIES.includes(entry.category) ||
        cleanup.some((c) => c.stage === entry.stage)
      )
        bad("MALFORMED");
      cleanup.push(frozen(entry));
    }
    if (
      cleanup.some((entry, i) => i > 0 && cleanup[i - 1].stage >= entry.stage)
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
        cleanup.length !== 0)
    )
      bad("MALFORMED");
    const record = frozen({
      format: FORMAT,
      scope: "PUBLIC_MANIFEST",
      status: r.status,
      unavailableReason: r.unavailableReason,
      binding: b,
      scenarioIndex: r.scenarioIndex,
      stepIndex: r.stepIndex,
      firstFailureStage: r.firstFailureStage,
      failureCategory: r.failureCategory,
      lastCompletedStage: r.lastCompletedStage,
      cleanupFailures: frozen(cleanup),
      truncated: r.truncated,
    });
    if (Buffer.byteLength(JSON.stringify(record)) > MAX_BYTES) bad("OVERSIZE");
    return frozen({ ok: true, record });
  } catch (error) {
    // Only own fixed errors are generated above; hostile object properties are never read.
    const reason = ownErrors.get(error) ?? "MALFORMED";
    return frozen({ ok: false, reason });
  }
}
