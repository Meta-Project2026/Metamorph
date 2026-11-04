import assert from "node:assert/strict";
import { test } from "node:test";
import { apply, initialState } from "../src/state.mjs";
import { commitment, RegistryError } from "../src/validation.mjs";
import {
  authorized,
  finish,
  fixture,
  frozen,
  registered,
  selected,
  started,
  validUntil,
} from "./support.mjs";

const authorityCases = [
  {
    type: "REGISTER",
    principals: [
      "synthetic-alice",
      "synthetic-bob",
      "synthetic-custodian",
      "synthetic-reviewer",
    ],
    setup: () => {},
    act: (f) => f.registry.register(f.registration),
  },
  {
    type: "FREEZE",
    principals: [
      "synthetic-alice",
      "synthetic-bob",
      "synthetic-custodian",
      "synthetic-reviewer",
    ],
    setup: registered,
    act: (f) => f.registry.freeze(f.freeze),
  },
  {
    type: "DRAW_STARTED",
    principals: ["synthetic-custodian", "synthetic-reviewer"],
    setup: frozen,
    act: (f) => f.registry.draw({ drawId: "synthetic-draw" }),
  },
  {
    type: "SELECTION",
    principals: ["synthetic-custodian", "synthetic-reviewer"],
    setup: frozen,
    act: (f) => f.registry.draw({ drawId: "synthetic-draw" }),
  },
  {
    type: "AUTHORIZE_ATTEMPT",
    principals: [
      "synthetic-alice",
      "synthetic-bob",
      "synthetic-custodian",
      "synthetic-reviewer",
    ],
    setup: selected,
    act: (f) =>
      f.registry.authorizeAttempt({
        attemptId: "synthetic-attempt-1",
        retryOf: null,
        selectionReusable: false,
        validUntil: validUntil(),
      }),
  },
  {
    type: "START_ATTEMPT",
    principals: ["synthetic-custodian", "synthetic-reviewer"],
    setup: authorized,
    act: (f) =>
      f.registry.startAttempt({
        attemptId: "synthetic-attempt-1",
        freeze: f.freeze,
        authorizationHash: f.registry.receipt().witnessRef,
      }),
  },
  {
    type: "FINISH_ATTEMPT",
    principals: ["synthetic-custodian", "synthetic-reviewer"],
    setup: started,
    act: (f) => finish(f, "FAIL"),
  },
  {
    type: "RECORD_BEHAVIORAL_FAIL",
    principals: ["synthetic-custodian", "synthetic-reviewer"],
    setup: started,
    act: (f) =>
      f.registry.recordBehavioralFail({ attemptId: "synthetic-attempt-1" }),
  },
  {
    type: "ABORT",
    principals: ["synthetic-custodian", "synthetic-reviewer"],
    setup: selected,
    act: (f) => f.registry.abort({ reason: "OPERATOR_STOP" }),
  },
];

for (const { type, principals, setup, act } of authorityCases) {
  test(`every required signer is enforced for ${type}`, () => {
    for (const principal of principals) {
      const f = fixture();
      setup(f);
      f.mutate.deny(principal, type);
      assert.throws(
        () => act(f),
        /AUTHORITY_SET_INVALID/,
        `${type}: ${principal}`,
      );
      if (type === "SELECTION") {
        assert.equal(f.registry.receipt().stage, "SYNTHETIC_DRAW_STARTED");
        assert.throws(
          () => f.create().draw({ drawId: "synthetic-draw" }),
          /DRAW_ORDER_OR_REPEAT/,
        );
      }
    }
  });
}

test("live witness ahead of an interrupted local write blocks restart", () => {
  const f = fixture();
  f.mutate.failAfterWitness(true);
  assert.throws(
    () => f.registry.register(f.registration),
    /REGISTRY_IO_OR_ADAPTER_ERROR/,
  );
  f.mutate.failAfterWitness(false);
  assert.throws(() => f.create(), /WITNESS_HIGH_WATER_MISMATCH/);
});

test("reused blinding nonce stops the freeze", () => {
  const f = fixture();
  f.mutate.entropyConstant(true);
  registered(f);
  assert.throws(() => f.registry.freeze(f.freeze), /NONCE_REUSE/);
  assert.equal(f.registry.receipt().stage, "SYNTHETIC_REGISTERED");
});

test("commitment serialization matches an independent fixed test vector", () => {
  const opening = Buffer.from(
    Array.from({ length: 32 }, (_, index) => index),
  ).toString("hex");
  assert.equal(
    commitment("MMP-056-REGISTRATION-V1", opening, {
      n: 1,
      a: "synthetic-case",
    }),
    "da651386191b5318ba31db00e85780008c704ca45fd1b4397293100bd09fd3a0",
  );
});

test("private callback errors do not escape to public callers", () => {
  const f = fixture();
  f.config.authorize = () => {
    throw new RegistryError("synthetic-private-canary");
  };
  const registry = f.create();
  assert.throws(
    () => registry.register(f.registration),
    (error) => {
      assert.equal(error.message, "REGISTRY_IO_OR_ADAPTER_ERROR");
      return true;
    },
  );
});

test("selection validation rejects duplicate, omitted, reordered and substituted cases even with recomputed commitments", () => {
  const f = fixture();
  selected(f);
  const records = f.records();
  const beforeSelection = records
    .slice(0, 3)
    .reduce(
      (state, record) => apply(state, record.event, f.trust),
      initialState(),
    );
  const original = records[3].event;
  for (const [kind, change, expected] of [
    [
      "duplicate",
      (p) => {
        p.selected[1] = p.selected[0];
      },
      /DUPLICATE_SELECTED_CASE/,
    ],
    [
      "omitted",
      (p) => {
        p.selected.pop();
      },
      /MANDATORY_CASE_MISSING/,
    ],
    [
      "reordered strata",
      (p) => {
        p.selected.reverse();
      },
      /STRATA_ORDER_DRIFT/,
    ],
    [
      "substituted",
      (p) => {
        p.selected[1] = "synthetic-case-other";
      },
      /UNKNOWN_SELECTED_CASE/,
    ],
  ]) {
    const altered = structuredClone(original);
    change(altered.payload);
    altered.payload.selectionCommitment = commitment(
      "MMP-056-SELECTION-V1",
      altered.payload.opening,
      {
        drawId: altered.payload.drawId,
        selected: altered.payload.selected,
        candidateCommitment: beforeSelection.candidateCommitment,
        registrationCommitment: beforeSelection.registrationCommitment,
      },
    );
    assert.throws(
      () => apply(beforeSelection, altered, f.trust),
      expected,
      kind,
    );
  }
});

test("an expired or overly long attempt authorization is rejected", () => {
  const f = fixture();
  selected(f);
  for (const validUntilValue of [
    "2000-01-01T00:00:00.000Z",
    "9999-01-01T00:00:00.000Z",
  ]) {
    assert.throws(
      () =>
        f.registry.authorizeAttempt({
          attemptId: "synthetic-attempt-1",
          retryOf: null,
          selectionReusable: false,
          validUntil: validUntilValue,
        }),
      /AUTHORIZATION_EXPIRED/,
    );
  }
});

test("an authorized start cannot be used after its signed deadline", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.now() });
  const f = fixture();
  const auth = authorized(f);
  t.mock.timers.tick(61000);
  assert.throws(
    () =>
      f.registry.startAttempt({
        attemptId: "synthetic-attempt-1",
        freeze: f.freeze,
        authorizationHash: auth.witnessRef,
      }),
    /AUTHORIZATION_EXPIRED/,
  );
});

test("a witnessed behavioral failure remains sticky if an ERROR follows it", () => {
  const f = fixture();
  started(f);
  f.registry.recordBehavioralFail({ attemptId: "synthetic-attempt-1" });
  assert.throws(() => finish(f), /BEHAVIORAL_FAIL_STICKY/);
  const receipt = finish(f, "ERROR", "HARNESS_ERROR");
  assert.equal(receipt.attempts[0].behavioralFailSeen, true);
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
