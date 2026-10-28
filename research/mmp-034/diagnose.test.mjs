import assert from "node:assert/strict";
import { test } from "node:test";
import { SHAS, validateAttempt, validateFinalizer } from "./diagnose.mjs";

const identity = { attemptId: "123-1-0-1", sourceSha: SHAS[0] };
const attempt = () => ({
  ...identity,
  status: "ERROR",
  childExit: 1,
  childSignal: null,
  childTimedOut: false,
  elapsedMs: 123,
  completedCases: 2,
  firstUncompletedCase: "case-02",
  failedCaseReceiptPresent: true,
  operationCode: "CLEANUP_ERROR",
  caseCode: "CLEANUP_ERROR",
  cleanupCode: "CLEANUP_ERROR",
  commands: [],
  recipeSha256: null,
  imageId: null,
});
test("public schema rejects raw diagnostics and nested spill", () => {
  assert.equal(validateAttempt(attempt()).completedCases, 2);
  for (const key of [
    "stdout",
    "stderr",
    "child.log",
    "input",
    "body",
    "privatePath",
    "secret",
    "stack",
  ])
    assert.throws(() =>
      validateAttempt({ ...attempt(), [key]: "DO_NOT_PUBLISH" }),
    );
  assert.throws(() =>
    validateAttempt({ ...attempt(), caseCode: "DO_NOT_PUBLISH" }),
  );
  assert.throws(() =>
    validateAttempt({ ...attempt(), commands: [{ stdout: "DO_NOT_PUBLISH" }] }),
  );
  assert.throws(() =>
    validateAttempt({ ...attempt(), sourceSha: "private/path" }),
  );
});
test("partial/failed child cannot become PASS", () => {
  assert.throws(() => validateAttempt({ ...attempt(), status: "PASS" }));
  assert.throws(() => validateAttempt({ ...attempt(), completedCases: 31 }));
  assert.throws(() =>
    validateAttempt({ ...attempt(), firstUncompletedCase: "case-30" }),
  );
});
test("emergency removal stays ERROR even with empty final inventory", () => {
  const value = {
    ...identity,
    status: "ERROR",
    before: { containers: 1, volumes: 0 },
    after: { containers: 0, volumes: 0 },
    emergencyRemoved: 1,
    commandError: false,
  };
  assert.equal(validateFinalizer(value).status, "ERROR");
  assert.throws(() => validateFinalizer({ ...value, status: "PASS" }));
  assert.throws(() =>
    validateFinalizer({ ...value, stderr: "DO_NOT_PUBLISH" }),
  );
  assert.throws(() =>
    validateFinalizer({
      ...value,
      before: { ...value.before, names: ["private"] },
    }),
  );
});
test("missing inventory cannot establish normal cleanup", () => {
  const value = {
    ...identity,
    status: "ERROR",
    before: { containers: null, volumes: 0 },
    after: { containers: 0, volumes: 0 },
    emergencyRemoved: 0,
    commandError: true,
  };
  assert.equal(validateFinalizer(value).status, "ERROR");
  assert.throws(() => validateFinalizer({ ...value, status: "PASS" }));
});
