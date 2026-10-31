// Pure categorical reporting helpers. No candidate data or raw errors escape.
import { DIAGNOSTIC_POLICY } from "../../packages/agent-real/src/private-diagnostics.mjs";

export function encryptionRefusal(control, error, elapsedMs) {
  if (
    !["crash-input", "deadline-input"].includes(control) ||
    error?.message !== "DIAGNOSTIC_ENCRYPTION_ERROR" ||
    !Number.isFinite(elapsedMs) ||
    elapsedMs < 0 ||
    elapsedMs > DIAGNOSTIC_POLICY.deadlineMs + 30000 ||
    (control === "deadline-input" &&
      elapsedMs < DIAGNOSTIC_POLICY.deadlineMs - 250)
  ) {
    throw new Error("CONTROL_CAUSE_NOT_ESTABLISHED");
  }
  // Encryption-error is emitted only after the encryptor's cleanup succeeds.
  // Timing is a necessary check, not an independent observation of crash/timer.
  return {
    control,
    status: "REJECTED",
    errorCode: "DIAGNOSTIC_ENCRYPTION_ERROR",
    cleanup: "VERIFIED_ZERO_RESOURCES",
    elapsedMs: Math.round(elapsedMs),
    underlyingCause: "NOT_INDEPENDENTLY_ESTABLISHED",
  };
}

export function controlFailure(stage, error, observation = {}) {
  const safeStage = [
    "VALIDATION",
    "SELECTION",
    "CRYPTO",
    "PRESERVATION",
    "FINALIZER",
    "UPLOAD_GATE",
  ].includes(stage)
    ? stage
    : "HARNESS";
  const blockers = Array.isArray(observation.blockers)
    ? observation.blockers
    : [];
  let cause;
  if (observation.processError === "ETIMEDOUT" || blockers.includes("TIMEOUT"))
    cause = "TIMEOUT";
  else if (blockers.includes("CANCELLED")) cause = "CANCELLED";
  else if (safeStage === "FINALIZER" || blockers.includes("CLEANUP_ERROR"))
    cause = "CLEANUP_ERROR";
  else if (safeStage === "UPLOAD_GATE" || blockers.includes("EVIDENCE_ERROR"))
    cause = "EVIDENCE_ERROR";
  else if (
    observation.processError ||
    Object.values(observation.gates ?? {}).includes("ERROR") ||
    blockers.includes("ENVIRONMENT_ERROR") ||
    blockers.includes("PUBLIC_DOCKER_ERROR")
  )
    cause = "ENVIRONMENT_ERROR";
  else if (error?.code === "ERR_ASSERTION")
    return { status: "FAIL", stage: safeStage, cause: "ACCEPTANCE_MISMATCH" };
  else cause = "HARNESS_ERROR";
  return { status: "ERROR", stage: safeStage, cause };
}
