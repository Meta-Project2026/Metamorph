// Fresh public projection. No source, key, stdout/stderr or arbitrary child text.
import assert from "node:assert/strict";
import { preservationRecord } from "../../packages/agent-real/src/private-diagnostics.mjs";

const integer = (n, max) =>
  assert.ok(Number.isSafeInteger(n) && n >= 0 && n <= max);
const choice = (s, allowed) => {
  assert.ok(allowed.includes(s));
  return s;
};
export function publicCase(row, headSha) {
  assert.match(
    row.id,
    /^(legacy-g1-build-failed|g1-pass-g2-(pass|fail)-g3-(pass|fail))$/,
  );
  const result = {
    id: row.id,
    status: choice(row.status, [
      "NOT_TESTED",
      "PENDING_FINALIZER",
      "PASS",
      "FAIL",
      "ERROR",
    ]),
  };
  if (row.stage)
    result.stage = choice(row.stage, [
      "VALIDATION",
      "SELECTION",
      "CRYPTO",
      "PRESERVATION",
      "FINALIZER",
      "UPLOAD_GATE",
      "HARNESS",
    ]);
  if (row.cause)
    result.cause = choice(row.cause, [
      "TIMEOUT",
      "CANCELLED",
      "CLEANUP_ERROR",
      "EVIDENCE_ERROR",
      "ENVIRONMENT_ERROR",
      "ACCEPTANCE_MISMATCH",
      "HARNESS_ERROR",
    ]);
  for (const key of [
    "validatorExit",
    "preserverExit",
    "finalizerExit",
    "uploadGateExit",
  ]) {
    if (row[key] === null) result[key] = null;
    else if (row[key] !== undefined) {
      integer(row[key], 255);
      result[key] = row[key];
    }
  }
  if (row.gates)
    result.gates = Object.fromEntries(
      ["G1", "G2", "G3"].map((key) => [
        key,
        choice(row.gates[key], [
          "PASS",
          "FAIL",
          "ERROR",
          "INCONCLUSIVE",
          "NOT_RUN",
        ]),
      ]),
    );
  if (row.coverage)
    result.coverage = Object.fromEntries(
      ["http", "sqlite", "requiredHttp", "requiredSqlite"].map((key) => {
        integer(row.coverage[key], 20);
        return [key, row.coverage[key]];
      }),
    );
  for (const key of ["throwawayRoundtrip", "wrongKey", "tamperedCiphertext"])
    if (row[key] !== undefined)
      result[key] = choice(
        row[key],
        key === "throwawayRoundtrip" ? ["PASS"] : ["REJECTED"],
      );
  if (row.preservation) {
    const record = row.preservation;
    const projected = preservationRecord(
      record.status,
      record.identity,
      { sha256: record.ciphertextSha256, bytes: record.ciphertextBytes },
      record.collectorCleanup,
    );
    assert.deepEqual(record, projected);
    assert.equal(projected.identity.headSha, headSha);
    assert.equal(projected.status, "ENCRYPTED_PENDING_UPLOAD");
    result.preservation = projected;
  }
  if (row.finalizer) {
    assert.equal(row.finalizer.headSha, headSha);
    integer(row.finalizer.emergencyRemoved, 1000);
    integer(row.finalizer.inventory.containers, 1000);
    integer(row.finalizer.inventory.volumes, 1000);
    result.finalizer = {
      headSha,
      status: choice(row.finalizer.status, ["PASS", "ERROR"]),
      emergencyRemoved: row.finalizer.emergencyRemoved,
      inventory: {
        containers: row.finalizer.inventory.containers,
        volumes: row.finalizer.inventory.volumes,
      },
    };
  }
  return result;
}
export function publicCrypto(rows) {
  assert.ok(Array.isArray(rows) && rows.length <= 10);
  return rows.map((row) => {
    if (typeof row === "string")
      return choice(row, ["wrong-recipient-pin-rejected", "oversize-rejected"]);
    integer(row.elapsedMs, 60000);
    return {
      control: choice(row.control, ["crash-input", "deadline-input"]),
      status: choice(row.status, ["REJECTED"]),
      errorCode: choice(row.errorCode, ["DIAGNOSTIC_ENCRYPTION_ERROR"]),
      cleanup: choice(row.cleanup, ["VERIFIED_ZERO_RESOURCES"]),
      elapsedMs: row.elapsedMs,
      underlyingCause: choice(row.underlyingCause, [
        "NOT_INDEPENDENTLY_ESTABLISHED",
      ]),
    };
  });
}
