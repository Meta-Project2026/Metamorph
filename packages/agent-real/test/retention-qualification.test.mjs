import assert from "node:assert/strict";
import test from "node:test";
import {
  controlFailure,
  encryptionRefusal,
} from "../../../research/mmp-097/qualification-outcome.mjs";

test("deadline control refuses immediate Docker errors and never credits failed cleanup", () => {
  const error = new Error("DIAGNOSTIC_ENCRYPTION_ERROR");
  assert.throws(() => encryptionRefusal("deadline-input", error, 20));
  assert.throws(() =>
    encryptionRefusal(
      "deadline-input",
      new Error("DIAGNOSTIC_CLEANUP_ERROR"),
      31000,
    ),
  );
  assert.throws(() =>
    encryptionRefusal("crash-input", new Error("DIAGNOSTIC_CLEANUP_ERROR"), 20),
  );
  assert.throws(() => encryptionRefusal("deadline-input", null, 31000));
  const outcome = encryptionRefusal("deadline-input", error, 31000);
  assert.equal(outcome.errorCode, "DIAGNOSTIC_ENCRYPTION_ERROR");
  assert.equal(outcome.underlyingCause, "NOT_INDEPENDENTLY_ESTABLISHED");
  assert.equal(
    encryptionRefusal("crash-input", error, 20).underlyingCause,
    "NOT_INDEPENDENTLY_ESTABLISHED",
  );
});

test("qualification receipts distinguish compiler timeout and cancellation from proven mismatch", () => {
  const assertion = Object.assign(new Error("raw private assertion"), {
    code: "ERR_ASSERTION",
  });
  assert.deepEqual(
    controlFailure("VALIDATION", assertion, {
      gates: { G1: "ERROR" },
      blockers: ["ENVIRONMENT_ERROR"],
    }),
    { status: "ERROR", stage: "VALIDATION", cause: "ENVIRONMENT_ERROR" },
  );
  assert.equal(
    controlFailure("VALIDATION", assertion, { processError: "ETIMEDOUT" })
      .cause,
    "TIMEOUT",
  );
  assert.equal(
    controlFailure("VALIDATION", assertion, { blockers: ["CANCELLED"] }).cause,
    "CANCELLED",
  );
  assert.deepEqual(
    controlFailure("VALIDATION", assertion, {
      gates: { G1: "PASS", G2: "FAIL" },
    }),
    { status: "FAIL", stage: "VALIDATION", cause: "ACCEPTANCE_MISMATCH" },
  );
  assert.equal(controlFailure("FINALIZER", assertion).cause, "CLEANUP_ERROR");
  assert.equal(
    controlFailure("UPLOAD_GATE", assertion).cause,
    "EVIDENCE_ERROR",
  );
  const safe = controlFailure("raw private stage", new Error("Bearer SECRET"));
  assert.deepEqual(safe, {
    status: "ERROR",
    stage: "HARNESS",
    cause: "HARNESS_ERROR",
  });
  assert.doesNotMatch(JSON.stringify(safe), /SECRET|Bearer|private/);
});
