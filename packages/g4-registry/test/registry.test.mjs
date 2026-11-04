import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { test } from "node:test";
import { identity as evidenceIdentity } from "../../evidence-retention/src/core.mjs";
import { canonical, commitment } from "../src/validation.mjs";
import {
  authorized,
  finish,
  fixture,
  frozen,
  registered,
  started,
  validUntil,
} from "./support.mjs";

test("witnessed registration, freeze, one draw and complete synthetic attempt survive reopening", () => {
  const f = fixture();
  started(f);
  const receipt = finish(f);
  assert.equal(receipt.g4Verdict, "INCONCLUSIVE");
  assert.equal(receipt.realAdmission, "NOT_AUTHORIZED");
  assert.equal(receipt.stage, "SYNTHETIC_ATTEMPT_TERMINAL");
  assert.deepEqual(
    receipt.attempts.map((attempt) => attempt.outcome),
    ["PASS"],
  );
  assert.equal(f.create().receipt().witnessRef, receipt.witnessRef);
  assert.deepEqual(
    f.records().map((record) => record.event.type),
    [
      "REGISTER",
      "FREEZE",
      "DRAW_STARTED",
      "SELECTION",
      "AUTHORIZE_ATTEMPT",
      "START_ATTEMPT",
      "FINISH_ATTEMPT",
    ],
  );
  const publicText = JSON.stringify(receipt);
  for (const secret of [
    ...f.registry.syntheticSelection(),
    f.freeze.candidateGitSha,
    f.records()[0].event.payload.opening,
  ])
    assert.equal(publicText.includes(secret), false);
});

test("the public API uses OS randomness and rejects caller seeds", () => {
  const f = fixture({ deterministic: false });
  frozen(f);
  assert.throws(
    () => f.registry.draw({ drawId: "synthetic-draw", seed: 42 }),
    /INVALID_OBJECT/,
  );
  f.registry.draw({ drawId: "synthetic-draw" });
  assert.equal(f.registry.syntheticSelection().length, 3);
  assert.throws(
    () => f.registry.draw({ drawId: "synthetic-another" }),
    /DRAW_ORDER_OR_REPEAT/,
  );
});

test("registration cannot be omitted, repeated, or replaced after freeze", () => {
  const f = fixture();
  assert.throws(() => f.registry.freeze(f.freeze), /FREEZE_ORDER/);
  frozen(f);
  assert.throws(
    () => f.registry.register(f.registration),
    /REGISTRATION_ALREADY_EXISTS/,
  );
  assert.throws(() => f.registry.freeze(f.freeze), /FREEZE_ORDER/);
});

for (const [name, change, code] of [
  [
    "missing owner profile",
    (r) => {
      r.custody.profile = null;
    },
    "PROFILE_REQUIRED",
  ],
  [
    "author exposure",
    (r) => {
      r.custody.exposures[0].cases = true;
    },
    "AUTHOR_EXPOSED",
  ],
  [
    "answer exposure",
    (r) => {
      r.custody.exposures[0].answers = true;
    },
    "AUTHOR_EXPOSED",
  ],
  [
    "entropy exposure",
    (r) => {
      r.custody.exposures[0].entropy = true;
    },
    "AUTHOR_EXPOSED",
  ],
  [
    "raw-difference exposure",
    (r) => {
      r.custody.exposures[0].rawDifferences = true;
    },
    "AUTHOR_EXPOSED",
  ],
  [
    "unknown exposure",
    (r) => {
      r.custody.exposures[0].entropy = null;
    },
    "EXPOSURE_UNKNOWN",
  ],
  [
    "shared root",
    (r) => {
      r.custody.sharedRoot = true;
    },
    "SHARED_ROOT",
  ],
  [
    "shared admin",
    (r) => {
      r.custody.adminDomains[0].principals.push("synthetic-custodian");
    },
    "SHARED_ADMIN",
  ],
  [
    "unlicensed source",
    (r) => {
      r.source.license = "unknown";
    },
    "LICENSE_NOT_ADMITTED",
  ],
  [
    "real source",
    (r) => {
      r.source.repository = "https://real.example/project";
    },
    "SYNTHETIC_SOURCE_REQUIRED",
  ],
  [
    "unknown unit",
    (r) => {
      r.pool[0].unit = "synthetic-unit-other";
    },
    "POOL_SCOPE_DRIFT",
  ],
  [
    "modified fixture",
    (r) => {
      r.pool[0].fixtureSha256 = "a".repeat(64);
    },
    "SYNTHETIC_FIXTURE_MISMATCH",
  ],
  [
    "missing mandatory case",
    (r) => {
      r.policy.mandatoryCaseIds.pop();
    },
    "MANDATORY_COVERAGE_MISSING",
  ],
  [
    "duplicate case",
    (r) => {
      r.pool[1].id = r.pool[0].id;
    },
    "DUPLICATE",
  ],
  [
    "inadequate stratum",
    (r) => {
      r.policy.strata[1].count = 9;
    },
    "STRATUM_UNDERCOVERED",
  ],
  [
    "missing gate",
    (r) => {
      r.scope.gates.G0 = false;
    },
    "MANDATORY_GATE_REQUIRED",
  ],
  [
    "unapproved sampler",
    (r) => {
      r.policy.algorithm = "synthetic-custom";
    },
    "SAMPLER_NOT_ADMITTED",
  ],
  [
    "unbounded retries",
    (r) => {
      r.policy.maxAttempts = 3;
    },
    "INVALID_INTEGER",
  ],
]) {
  test(`registration rejects ${name}`, () => {
    const f = fixture();
    change(f.registration);
    assert.throws(() => f.registry.register(f.registration), new RegExp(code));
  });
}

test("same candidate and custodian or shared signing keys are rejected at configuration", () => {
  const f = fixture();
  f.config.trust.custodian = f.config.trust.author;
  assert.throws(() => f.create(), /AUTHOR_CUSTODIAN_CONFLICT/);
  f.config.trust.custodian = "synthetic-custodian";
  f.config.trust.principals["synthetic-custodian"] =
    f.config.trust.principals["synthetic-alice"];
  assert.throws(() => f.create(), /SHARED_KEY/);
});

test("signed owner profile is explicit, and stronger profile requires separate custodian and reviewer", () => {
  const f = fixture();
  f.registration.custody.profile = "LIMITED_TWO_PERSON";
  registered(f);
  assert.equal(f.registry.receipt().stage, "SYNTHETIC_REGISTERED");
  const g = fixture();
  g.config.trust.reviewer = g.config.trust.author;
  const registry = g.create();
  assert.throws(
    () => registry.register(g.registration),
    /INDEPENDENCE_CONFLICT/,
  );
});

test("salted commitments cannot be replaced by plain SHA of guessable pool bytes", () => {
  const f = fixture();
  registered(f);
  const record = f.records()[0].event.payload;
  const unblinded = createHash("sha256")
    .update(canonical(f.registration))
    .digest("hex");
  assert.notEqual(record.registrationCommitment, unblinded);
  assert.equal(
    record.registrationCommitment,
    commitment("MMP-056-REGISTRATION-V1", record.opening, f.registration),
  );
  assert.notEqual(
    record.registrationCommitment,
    commitment("MMP-056-REGISTRATION-V1", "f".repeat(64), f.registration),
  );
});

test("candidate SHA and runtime are bound at freeze, start, and finish", () => {
  const f = fixture();
  registered(f);
  assert.throws(
    () => f.registry.freeze({ ...f.freeze, runtimeSha256: "a".repeat(64) }),
    /RUNTIME_DRIFT/,
  );
  f.registry.freeze(f.freeze);
  f.registry.draw({ drawId: "synthetic-draw" });
  const auth = f.registry.authorizeAttempt({
    attemptId: "synthetic-attempt-1",
    retryOf: null,
    selectionReusable: false,
    validUntil: validUntil(),
  });
  const modified = { ...f.freeze, candidateGitSha: "a".repeat(40) };
  assert.throws(
    () =>
      f.registry.startAttempt({
        attemptId: "synthetic-attempt-1",
        freeze: modified,
        authorizationHash: auth.witnessRef,
      }),
    /CANDIDATE_DRIFT/,
  );
  f.registry.startAttempt({
    attemptId: "synthetic-attempt-1",
    freeze: f.freeze,
    authorizationHash: auth.witnessRef,
  });
  assert.throws(
    () =>
      f.registry.finishAttempt({
        attemptId: "synthetic-attempt-1",
        freeze: modified,
        outcome: "FAIL",
        errorClass: null,
        executedCaseIds: [],
      }),
    /CANDIDATE_DRIFT/,
  );
});

test("freeze must be witnessed before draw, and abort prevents restart and resampling", () => {
  const f = fixture();
  registered(f);
  assert.throws(() => f.registry.draw({ drawId: "synthetic-draw" }));
  f.registry.freeze(f.freeze);
  f.registry.draw({ drawId: "synthetic-draw" });
  f.registry.abort({ reason: "INTERRUPTED" });
  assert.throws(
    () => f.create().draw({ drawId: "synthetic-new-draw" }),
    /DRAW_ORDER_OR_REPEAT/,
  );
  assert.throws(
    () =>
      f.registry.authorizeAttempt({
        attemptId: "synthetic-attempt-1",
        retryOf: null,
        selectionReusable: false,
        validUntil: validUntil(),
      }),
    /AUTHORIZATION_ORDER/,
  );
});

test("crash after witnessed draw reservation cannot generate new randomness on restart", () => {
  const f = fixture();
  frozen(f);
  f.mutate.entropyFail(true);
  assert.throws(
    () => f.registry.draw({ drawId: "synthetic-draw" }),
    /REGISTRY_IO_OR_ADAPTER_ERROR/,
  );
  assert.equal(f.registry.receipt().stage, "SYNTHETIC_DRAW_STARTED");
  f.mutate.entropyFail(false);
  assert.throws(
    () => f.create().draw({ drawId: "synthetic-draw" }),
    /DRAW_ORDER_OR_REPEAT/,
  );
  f.registry.abort({ reason: "INTERRUPTED" });
});

test("valid technical retry keeps the same frozen selection and both attempts", () => {
  const f = fixture();
  started(f);
  const before = f.registry.syntheticSelection();
  finish(f, "ERROR", "ENVIRONMENT_ERROR");
  const firstIdentity = f.registry.syntheticEvidenceIdentity(
    "synthetic-attempt-1",
  );
  assert.deepEqual(evidenceIdentity(firstIdentity), firstIdentity);
  const auth = f.registry.authorizeAttempt({
    attemptId: "synthetic-attempt-2",
    retryOf: "synthetic-attempt-1",
    selectionReusable: true,
    validUntil: validUntil(),
  });
  f.registry.startAttempt({
    attemptId: "synthetic-attempt-2",
    freeze: f.freeze,
    authorizationHash: auth.witnessRef,
  });
  const result = finish(f, "PASS", null, "synthetic-attempt-2");
  assert.deepEqual(f.registry.syntheticSelection(), before);
  assert.deepEqual(
    result.attempts.map((attempt) => attempt.outcome),
    ["ERROR", "PASS"],
  );
  assert.deepEqual(
    f.registry.syntheticEvidenceIdentity("synthetic-attempt-1"),
    firstIdentity,
  );
  const secondIdentity = f.registry.syntheticEvidenceIdentity(
    "synthetic-attempt-2",
  );
  assert.deepEqual(evidenceIdentity(secondIdentity), secondIdentity);
  assert.notEqual(firstIdentity.witnessRef, secondIdentity.witnessRef);
  assert.throws(
    () => f.registry.draw({ drawId: "synthetic-another" }),
    /DRAW_ORDER_OR_REPEAT/,
  );
});

for (const [outcome, errorClass] of [
  ["FAIL", null],
  ["PASS", null],
  ["INCONCLUSIVE", null],
  ["ERROR", "UNCLASSIFIED_ERROR"],
]) {
  test(`retry forbidden after ${outcome}/${errorClass}`, () => {
    const f = fixture();
    started(f);
    finish(f, outcome, errorClass);
    assert.throws(
      () =>
        f.registry.authorizeAttempt({
          attemptId: "synthetic-attempt-2",
          retryOf: "synthetic-attempt-1",
          selectionReusable: true,
          validUntil: validUntil(),
        }),
      /RETRY_FORBIDDEN/,
    );
  });
}

test("duplicate attempt, stale authorization and missing retry attestation are rejected", () => {
  const f = fixture();
  const auth = authorized(f);
  assert.throws(
    () =>
      f.registry.startAttempt({
        attemptId: "synthetic-attempt-1",
        freeze: f.freeze,
        authorizationHash: "0".repeat(64),
      }),
    /AUTHORIZATION_STALE/,
  );
  f.registry.startAttempt({
    attemptId: "synthetic-attempt-1",
    freeze: f.freeze,
    authorizationHash: auth.witnessRef,
  });
  finish(f, "ERROR", "HARNESS_ERROR");
  assert.throws(
    () =>
      f.registry.authorizeAttempt({
        attemptId: "synthetic-attempt-1",
        retryOf: "synthetic-attempt-1",
        selectionReusable: true,
        validUntil: validUntil(),
      }),
    /ATTEMPT_DUPLICATE/,
  );
  assert.throws(
    () =>
      f.registry.authorizeAttempt({
        attemptId: "synthetic-attempt-2",
        retryOf: "synthetic-attempt-1",
        selectionReusable: false,
        validUntil: validUntil(),
      }),
    /RETRY_NOT_ATTESTED/,
  );
});

test("synthetic PASS requires each selected case exactly once in its committed order", () => {
  const f = fixture();
  started(f);
  const cases = f.registry.syntheticSelection();
  const result = {
    attemptId: "synthetic-attempt-1",
    freeze: f.freeze,
    outcome: "PASS",
    errorClass: null,
  };
  assert.throws(
    () =>
      f.registry.finishAttempt({ ...result, executedCaseIds: cases.slice(1) }),
    /INCOMPLETE_COVERAGE/,
  );
  assert.throws(
    () =>
      f.registry.finishAttempt({
        ...result,
        executedCaseIds: [cases[0], cases[0], cases[2]],
      }),
    /DUPLICATE_EXECUTION/,
  );
  assert.throws(
    () =>
      f.registry.finishAttempt({
        ...result,
        executedCaseIds: [...cases].reverse(),
      }),
    /INCOMPLETE_COVERAGE/,
  );
  finish(f);
});

test("journal rejects mutation, reordered records, truncated lines and oversized logs", () => {
  for (const mode of [
    "mutate",
    "opening",
    "signature",
    "pool-order",
    "reorder",
    "truncate",
    "oversize",
  ]) {
    const f = fixture();
    frozen(f);
    const original = readFileSync(f.journalPath, "utf8");
    const lines = original.trimEnd().split("\n");
    if (mode === "mutate")
      writeFileSync(
        f.journalPath,
        original.replace("synthetic-epoch", "synthetic-other"),
      );
    if (mode === "opening")
      writeFileSync(
        f.journalPath,
        original.replace(f.records()[0].event.payload.opening, "f".repeat(64)),
      );
    if (mode === "signature") {
      const signature = f.records()[0].signatures["synthetic-bob"];
      writeFileSync(
        f.journalPath,
        original.replace(
          signature,
          `${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`,
        ),
      );
    }
    if (mode === "pool-order") {
      const first = f.records()[0];
      [
        first.event.payload.registration.pool[0],
        first.event.payload.registration.pool[1],
      ] = [
        first.event.payload.registration.pool[1],
        first.event.payload.registration.pool[0],
      ];
      lines[0] = canonical(first);
      writeFileSync(f.journalPath, `${lines.join("\n")}\n`);
    }
    if (mode === "reorder")
      writeFileSync(f.journalPath, `${lines.reverse().join("\n")}\n`);
    if (mode === "truncate")
      writeFileSync(f.journalPath, original.slice(0, -1));
    if (mode === "oversize")
      writeFileSync(f.journalPath, "x".repeat(2 * 1024 * 1024 + 1));
    assert.throws(() => f.create());
  }
});

test("rollback to a formerly valid journal is rejected by witness high-water", () => {
  const f = fixture();
  registered(f);
  const previous = readFileSync(f.journalPath);
  f.registry.freeze(f.freeze);
  writeFileSync(f.journalPath, previous);
  assert.throws(() => f.create(), /WITNESS_HIGH_WATER_MISMATCH/);
});

test("forged witness and missing or forged transition authority fail closed", () => {
  const f = fixture();
  f.mutate.invalidWitness(true);
  assert.throws(
    () => f.registry.register(f.registration),
    /WITNESS_SIGNATURE_INVALID/,
  );
  f.mutate.invalidWitness(false);
  f.mutate.deny("synthetic-bob");
  assert.throws(
    () => f.registry.register(f.registration),
    /AUTHORITY_SET_INVALID/,
  );
  f.mutate.deny(null);
  f.mutate.forge("synthetic-bob");
  assert.throws(
    () => f.registry.register(f.registration),
    /AUTHORITY_SIGNATURE_INVALID/,
  );
});
