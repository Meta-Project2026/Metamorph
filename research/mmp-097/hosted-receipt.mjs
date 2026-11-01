// Fresh public projection. No source, key, stdout/stderr or arbitrary child text.
import assert from "node:assert/strict";
import { preservationRecord } from "../../packages/agent-real/src/private-diagnostics.mjs";
import { MANIFEST } from "../../packages/oracle/dist/index.js";

const integer = (n, max) =>
  assert.ok(Number.isSafeInteger(n) && n >= 0 && n <= max);
const choice = (s, allowed) => {
  assert.ok(allowed.includes(s));
  return s;
};
export function publicCase(row, headSha) {
  assert.match(
    row.id,
    /^(http-only-fault|legacy-g1-build-failed|g1-pass-g2-(pass|fail)-g3-(pass|fail))$/,
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
  if (row.requestedCombination)
    result.requestedCombination = choice(row.requestedCombination, [
      "G2_FAIL_G3_PASS_UNREACHABLE_UNDER_UNCHANGED_ORACLE",
    ]);
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
  if (row.network)
    result.network = Object.fromEntries(
      ["sourceFetches", "blockedRequests"].map((key) => {
        integer(row.network[key], 10);
        return [key, row.network[key]];
      }),
    );
  if (row.preparation) {
    assert.ok(Array.isArray(row.preparation) && row.preparation.length <= 20);
    result.preparation = row.preparation.map((r) => {
      const entry = {
        command: choice(r.command, [
          "PHP_PREPARATION",
          "image-build.json",
          "image-inspect.json",
          "runtime-provenance.json",
          "provenance-cleanup.json",
          "TRUSTED_PREPARATION",
        ]),
        exitCode: r.exitCode,
        timedOut: Boolean(r.timedOut),
      };
      if (r.exitCode !== null) integer(r.exitCode, 255);
      if (r.category)
        entry.category = choice(r.category, [
          "PERMISSION_DENIED",
          "BUILD_PLUGIN_ERROR",
          "NETWORK_ERROR",
          "PROCESS_ERROR",
        ]);
      return entry;
    });
  }
  if (row.coverage)
    result.coverage = Object.fromEntries(
      ["http", "sqlite", "requiredHttp", "requiredSqlite"].map((key) => {
        integer(row.coverage[key], 20);
        return [key, row.coverage[key]];
      }),
    );
  if (row.findingCodes) result.findingCodes = publicFindings(row.findingCodes);
  if (row.bindings) {
    const b = row.bindings;
    assert.match(b.sourceSha, /^[a-f0-9]{40}$/);
    assert.match(b.candidateSha, /^[a-f0-9]{64}$/);
    assert.ok(Array.isArray(b.pairs) && b.pairs.length <= MANIFEST.length);
    result.bindings = {
      sourceSha: b.sourceSha,
      candidateSha: b.candidateSha,
      pairs: b.pairs.map((p) => {
        choice(
          p.scenarioId,
          MANIFEST.map((s) => s.id),
        );
        assert.match(p.pairId, /^[a-f0-9-]{36}$/);
        assert.ok(Array.isArray(p.packSeals) && p.packSeals.length <= 10);
        for (const seal of p.packSeals) assert.match(seal, /^[a-f0-9]{64}$/);
        return {
          scenarioId: p.scenarioId,
          pairId: p.pairId,
          packSeals: [...p.packSeals],
        };
      }),
    };
    if (b.attemptId) {
      assert.match(b.attemptId, /^[a-f0-9-]{36}$/);
      result.bindings.attemptId = b.attemptId;
    }
  }
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

const codes = [
  "HTTP_STATUS",
  "HTTP_HEADER",
  "HTTP_BODY",
  "HTTP_JSON_TYPE",
  "HTTP_JSON_VALUE",
  "HTTP_JSON_MISSING",
  "HTTP_JSON_LENGTH",
  "DB_SCHEMA",
  "DB_STATE",
  "BUILD_FAILED",
  "TIMEOUT",
  "CANCELLED",
  "ENVIRONMENT_ERROR",
  "BUILD_NOT_RUN",
  "MISSING_COVERAGE",
  "CLEANUP_ERROR",
];
function publicFindings(value) {
  return Object.fromEntries(
    ["G1", "G2", "G3"].map((gate) => {
      assert.ok(Array.isArray(value[gate]) && value[gate].length <= 30);
      return [gate, value[gate].map((code) => choice(code, codes))];
    }),
  );
}
export function publicFaults(rows, kind) {
  assert.ok(Array.isArray(rows) && rows.length <= 30);
  const ids =
    kind === "crypto"
      ? ["crash", "deadline", "ciphertext-cap", "cleanup-fault"]
      : [
          "kill-build",
          "pause-build",
          "cancel-validator",
          "incomplete-entry",
          "secret-source",
          "cleanup-fault",
        ];
  return rows.map((row) => {
    const result = {
      id: choice(row.id, ids),
      status: choice(row.status, [
        "PASS",
        "FAIL",
        "ERROR",
        "PENDING_FINALIZER",
      ]),
    };
    if (row.stage)
      result.stage = choice(row.stage, [
        "VALIDATION",
        "PRESERVATION",
        "FINALIZER",
        "UPLOAD_GATE",
      ]);
    if (row.cause)
      result.cause = choice(row.cause, [
        "TIMEOUT",
        "CANCELLED",
        "ENVIRONMENT_ERROR",
        "EVIDENCE_ERROR",
        "CLEANUP_ERROR",
        "HARNESS_ERROR",
        "ACCEPTANCE_MISMATCH",
      ]);
    if (row.execution)
      result.execution = choice(row.execution, [
        "ACTUAL_ENCRYPTION_WITH_REAL_CHILD_CLEANUP_FAULT_HARNESS",
        "ACTUAL_DOCKER_ENCRYPTOR_FAULT_WORKER",
        "REAL_NODE_PRE_ENTRY_TIMEOUT_HARNESS",
        "ACTUAL_VALIDATOR_SECRET_MARKER_CANDIDATE",
        "ACTUAL_VALIDATOR_WITH_REAL_CHILD_CLEANUP_FAULT",
        "ACTUAL_VALIDATOR_DOCKER_BUILD_FAULT",
      ]);
    for (const key of [
      "elapsedMs",
      "afterInjectionMs",
      "injectedCleanupExit",
      "intentionalFaultRecoveryRemoved",
      "postRecoveryInventory",
      "injectionExitCode",
      "preserverExit",
      "gateExit",
    ])
      if (row[key] !== undefined && row[key] !== null) {
        integer(row[key], 1200000);
        result[key] = row[key];
      }
    if (row.observedError)
      result.observedError = choice(row.observedError, [
        "DIAGNOSTIC_ENCRYPTION_ERROR",
        "DIAGNOSTIC_CLEANUP_ERROR",
      ]);
    for (const key of ["run", "process"])
      if (row[key]) {
        const p = row[key];
        if (p.exitCode !== null) integer(p.exitCode, 255);
        result[key] = {
          exitCode: p.exitCode,
          signal:
            p.signal === null || p.signal === undefined
              ? null
              : choice(p.signal, ["SIGKILL", "SIGTERM"]),
        };
        for (const k of ["killed", "timedOut"])
          if (p[k] !== undefined) {
            assert.equal(typeof p[k], "boolean");
            result[key][k] = p[k];
          }
        if (p.bytes !== undefined) {
          integer(p.bytes, 10 * 1024 * 1024);
          result[key].bytes = p.bytes;
        }
        if (p.classification)
          result[key].classification = {
            status: choice(p.classification.status, ["ERROR"]),
            stage: choice(p.classification.stage, ["VALIDATION"]),
            cause: choice(p.classification.cause, ["TIMEOUT"]),
          };
      }
    if (row.gates)
      result.gates = Object.fromEntries(
        ["G1", "G2", "G3"].map((k) => [
          k,
          choice(row.gates[k], [
            "PASS",
            "FAIL",
            "ERROR",
            "INCONCLUSIVE",
            "NOT_RUN",
          ]),
        ]),
      );
    if (row.findingCodes)
      result.findingCodes = row.findingCodes.map((code) => choice(code, codes));
    if (row.preservationStatus)
      result.preservationStatus = choice(row.preservationStatus, [
        "REJECTED",
        "NOT_APPLICABLE",
      ]);
    if (row.eligible !== undefined) {
      assert.equal(row.eligible, false);
      result.eligible = false;
    }
    if (row.normalCleanup)
      result.normalCleanup = choice(row.normalCleanup, [
        "VERIFIED_ZERO_RESOURCES",
      ]);
    if (row.finalizer) {
      assert.deepEqual(row.finalizer, {
        exitCode: 0,
        inventory: { containers: 0, volumes: 0 },
        emergencyRemoved: 0,
      });
      result.finalizer = {
        exitCode: 0,
        inventory: { containers: 0, volumes: 0 },
        emergencyRemoved: 0,
      };
    }
    if (row.cleanup) result.cleanup = choice(row.cleanup, ["ERROR"]);
    return result;
  });
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

export function publicNegatives(controls) {
  assert.ok(Array.isArray(controls.cases) && controls.cases.length <= 100);
  return {
    status: choice(controls.status, ["NOT_TESTED", "PASS", "FAIL", "ERROR"]),
    scope:
      "ACTUAL_VALIDATED_FILES_AND_PRODUCTION_CLI_NOT_NEW_G1_ENVIRONMENT_EXECUTIONS",
    cases: controls.cases.map((row) => {
      assert.match(row.id, /^[a-z0-9-]{1,64}$/);
      const result = {
        id: row.id,
        kind: choice(row.kind, ["ACTUAL_VALIDATED_FILES_AND_PRODUCTION_CLI"]),
        status: choice(row.status, ["PASS", "FAIL", "ERROR"]),
      };
      if (row.stage)
        result.stage = choice(row.stage, [
          "SELECTION",
          "PRESERVATION",
          "UPLOAD_GATE",
        ]);
      if (row.cause)
        result.cause = choice(row.cause, [
          "TIMEOUT",
          "ENVIRONMENT_ERROR",
          "EVIDENCE_ERROR",
          "CLEANUP_ERROR",
          "HARNESS_ERROR",
          "ACCEPTANCE_MISMATCH",
        ]);
      for (const key of ["preserverExit", "gateExit", "exitCode"])
        if (row[key] !== undefined) {
          integer(row[key], 255);
          result[key] = row[key];
        }
      for (const key of ["eligible", "expectedEligible"])
        if (row[key] !== undefined) {
          assert.equal(typeof row[key], "boolean");
          result[key] = row[key];
        }
      if (row.preservationStatus)
        result.preservationStatus = choice(row.preservationStatus, [
          "REJECTED",
          "NOT_APPLICABLE",
          "UPLOAD_FAILED",
          "ENCRYPTED_PENDING_UPLOAD",
        ]);
      return result;
    }),
  };
}

export function publicProcesses(controls) {
  assert.ok(Array.isArray(controls.cases) && controls.cases.length <= 8);
  return {
    status: choice(controls.status, ["PASS", "FAIL", "ERROR", "NOT_TESTED"]),
    cases: controls.cases.map((row) => {
      assert.match(
        row.id,
        /^(preservation|finalizer|upload_gate)-(timeout|crash)$|^finalizer-real-(nonzero-inventory|emergency-removal)$/,
      );
      const result = {
        id: row.id,
        execution: choice(row.execution, [
          "REAL_CHILD_PRE_ENTRY_FAULT_HARNESS",
          "ACTUAL_FINALIZER_WITH_OWN_STOPPED_DOCKER_SENTINEL",
        ]),
        status: choice(row.status, ["PASS", "FAIL", "ERROR"]),
      };
      for (const key of [
        "exitCode",
        "finalizerExit",
        "observedInventory",
        "intentionalFaultRecoveryRemoved",
      ])
        if (row[key] !== undefined) {
          if (row[key] !== null) integer(row[key], 255);
          result[key] = row[key];
        }
      if (row.signal !== undefined)
        result.signal =
          row.signal === null
            ? null
            : choice(row.signal, ["SIGTERM", "SIGKILL"]);
      if (row.timedOut !== undefined) {
        assert.equal(typeof row.timedOut, "boolean");
        result.timedOut = row.timedOut;
      }
      if (row.cause)
        result.cause = choice(row.cause, [
          "TIMEOUT",
          "ENVIRONMENT_ERROR",
          "CLEANUP_ERROR",
          "EVIDENCE_ERROR",
          "ACCEPTANCE_MISMATCH",
          "HARNESS_ERROR",
        ]);
      if (row.stage)
        result.stage = choice(row.stage, [
          "PRESERVATION",
          "FINALIZER",
          "UPLOAD_GATE",
        ]);
      if (row.eligible !== undefined) {
        assert.equal(row.eligible, false);
        result.eligible = false;
      }
      if (row.postRecoveryFinalizer)
        result.postRecoveryFinalizer = choice(row.postRecoveryFinalizer, [
          "PASS_ZERO_ZERO_ZERO",
        ]);
      return result;
    }),
  };
}

export function publicFailure(value) {
  const projected = publicCase(
    {
      id: "http-only-fault",
      status: value.status,
      stage: value.stage,
      cause: value.cause,
    },
    "a".repeat(40),
  );
  assert.ok(["ERROR", "FAIL"].includes(projected.status));
  return {
    status: projected.status,
    stage: projected.stage,
    cause: projected.cause,
  };
}
