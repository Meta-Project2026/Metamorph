// PUBLIC_DEV_CONTROL: original synthetic values; no hidden samples are drawn here.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  MANIFEST_SHA256,
  NORMALIZATION_VERSION,
  SOURCE,
  snapshotSqlite,
  verifyPair,
} from "@metamorph/oracle";
import { WORKSHOP_CANDIDATE_SHA } from "../../differential/src/workshop-policy.mjs";
import { WORKSHOP_PROFILE } from "../../target-worker/runtime/profile.mjs";
import { TargetWorker } from "../../target-worker/src/controller.mjs";
import { AuditReference, AuditTarget } from "../src/adapters.mjs";
import {
  DECLARED,
  digest,
  freezeCandidate,
  samplePrivate,
} from "../src/corpus.mjs";
import { publicSummary } from "../src/public.mjs";

const h = "a".repeat(64),
  signal = () => AbortSignal.timeout(10000);
const identity = () => ({
  headSha: "b".repeat(40),
  candidateSha: WORKSHOP_CANDIDATE_SHA,
  sourceSha: SOURCE.archiveSha256,
  manifestSha: MANIFEST_SHA256,
  profile: "car-workshop-v1",
  recipeSha: h,
  phpImage: `sha256:${h}`,
  targetImage: `sha256:${h}`,
  normalization: NORMALIZATION_VERSION,
  evaluatorSha: h,
});
const controlIds = [
  "http-positive",
  "http-key-order",
  "http-status-mutant",
  "http-type-mutant",
  "http-missing-mutant",
  "http-order-mutant",
  "db-positive",
  "db-row-mutant",
  "db-sequence-mutant",
];
function gates(id, steps, negative = false) {
  return [
    {
      gate: "G2",
      verdict: negative ? "FAIL" : "PASS",
      executedTestIds: Array.from(
        { length: steps },
        (_, i) => `${id}:step-${i}`,
      ),
      findings: negative
        ? [{ code: "HTTP_STATUS", message: "PUBLIC_DEV_CONTROL" }]
        : [],
    },
    {
      gate: "G3",
      verdict: negative ? "FAIL" : "PASS",
      executedTestIds: [
        `${id}:initial`,
        ...Array.from({ length: steps }, (_, i) => `${id}:step-${i}`),
      ],
      findings: negative
        ? [{ code: "HTTP_STATUS", message: "PUBLIC_DEV_CONTROL" }]
        : [],
    },
    {
      gate: "G4",
      verdict: "INCONCLUSIVE",
      executedTestIds: [...controlIds],
      findings: [{ code: "HELD_OUT_NOT_RUN", message: "PUBLIC_DEV_CONTROL" }],
    },
  ];
}
const run = (id, steps, negative = false) => ({
  id,
  steps,
  gates: gates(id, steps, negative),
  packSha: h,
  cleanup: "VERIFIED_ZERO_RESOURCES",
});
const receipt = () => ({
  identity: identity(),
  sampleCommitment: h,
  runs: DECLARED.map((d) => run(d.id, d.steps)),
  controls: {
    positive: run("audit-public-positive", 6),
    negative: run("audit-public-negative", 6, true),
  },
  cleanup: { containers: 0, volumes: 0, emergencyRemoved: 0 },
  provenancePackSha: h,
});
test("post-freeze capability requires successful durable receipt and exact identity", () => {
  assert.throws(() => samplePrivate(identity()), /FREEZE_REQUIRED/);
  assert.throws(
    () => samplePrivate(Object.freeze(identity())),
    /FREEZE_REQUIRED/,
  );
  let frozen;
  assert.throws(() => {
    frozen = freezeCandidate(identity(), () => {
      throw Error("DISK_FAILURE");
    });
  }, /DISK_FAILURE/);
  assert.equal(frozen, undefined);
  const copy = identity();
  copy.candidateSha = "c".repeat(64);
  assert.throws(() => freezeCandidate(copy, () => {}), /FREEZE_IDENTITY/);
  let stored;
  const good = freezeCandidate(identity(), (r) => {
    stored = r;
  });
  assert.ok(Object.isFrozen(good));
  assert.equal(stored.commitment, digest(good));
  assert.throws(
    () => freezeCandidate(identity(), () => Promise.resolve()),
    /FREEZE_PERSIST_SYNC/,
  );
  // Do not sample. Crypto sample values are produced only by isolated evaluator.
});
test("strict public summary labels scoped results and never promotes canonical G4", () => {
  const s = publicSummary(receipt());
  assert.equal(s.verdict, "AUDIT_PASS");
  assert.equal(s.families.length, 4);
  assert.equal(s.canonicalG4, "INCONCLUSIVE");
  assert.equal(s.formalHeldOut, "HELDOUT_ISOLATION_NOT_PROVEN");
  assert.equal(s.product, "NOT_ESTABLISHED");
  assert.ok(!JSON.stringify(s).includes("PUBLIC_DEV_CONTROL"));
});
const mutations = {
  rawOuter: (x) => {
    x.seed = "PRIVATE_CANARY";
  },
  rawRun: (x) => {
    x.runs[0].body = "PRIVATE_CANARY";
  },
  rawIdentity: (x) => {
    x.identity.path = "PRIVATE_CANARY";
  },
  leakedCode: (x) => {
    x.runs[0].gates[0].findings = [{ code: "PRIVATE_CANARY" }];
  },
  missingFamily: (x) => x.runs.pop(),
  duplicateScenario: (x) => {
    x.runs[1] = x.runs[0];
  },
  reorderedIds: (x) => x.runs[0].gates[0].executedTestIds.reverse(),
  missingInitial: (x) => x.runs[0].gates[1].executedTestIds.shift(),
  missingStep: (x) => x.runs[0].gates[0].executedTestIds.pop(),
  duplicateStep: (x) =>
    x.runs[0].gates[0].executedTestIds.push(
      x.runs[0].gates[0].executedTestIds[0],
    ),
  unknownStep: (x) => {
    x.runs[0].gates[0].executedTestIds[0] = "PRIVATE_CANARY";
  },
  fakeNegative: (x) => {
    x.controls.negative = run("audit-public-negative", 6);
  },
  alwaysFail: (x) => {
    x.controls.positive = run("audit-public-positive", 6, true);
  },
  cleanup: (x) => {
    x.cleanup.volumes = 1;
  },
  emergency: (x) => {
    x.cleanup.emergencyRemoved = 1;
  },
  pack: (x) => {
    x.runs[0].packSha = "bad";
  },
  missingControl: (x) => x.controls.negative.gates[2].executedTestIds.pop(),
  fakeG4: (x) => {
    x.runs[0].gates[2].verdict = "PASS";
  },
  sourceDrift: (x) => {
    x.identity.sourceSha = h;
  },
  profileDrift: (x) => {
    x.identity.profile = "public-items-v1";
  },
};
for (const [name, mutate] of Object.entries(mutations))
  test(`public evidence rejects ${name}`, () => {
    const x = receipt();
    mutate(x);
    assert.throws(() => publicSummary(x));
  });
test("real mismatch is AUDIT_FAIL; infrastructure and incomplete coverage stay distinct", () => {
  const x = receipt();
  x.runs[0] = run(DECLARED[0].id, DECLARED[0].steps, true);
  assert.equal(publicSummary(x).verdict, "AUDIT_FAIL");
  x.runs[0].gates[0].verdict = "ERROR";
  x.runs[0].gates[0].findings = [{ code: "VERIFIER_ERROR" }];
  assert.equal(publicSummary(x).verdict, "AUDIT_ERROR");
  x.runs[0] = run(DECLARED[0].id, DECLARED[0].steps);
  for (const g of x.runs[0].gates.slice(0, 2)) {
    g.verdict = "INCONCLUSIVE";
    g.findings = [{ code: "MISSING_COVERAGE" }];
    g.executedTestIds = [];
  }
  assert.equal(publicSummary(x).verdict, "AUDIT_PARTIAL");
});
const scenario = {
  id: "audit-original-dev-control",
  requests: [{ method: "POST", path: "/api.php?action=book", body: "" }],
};
function fakeTransport(state) {
  let closes = 0,
    requests = 0;
  return {
    get closes() {
      return closes;
    },
    get requests() {
      return requests;
    },
    reset: async () => {},
    inspect: async () => ({
      snapshot: structuredClone(state),
      legacySha256: SOURCE.initialSha256,
      raw: {},
    }),
    http: async () => {
      requests++;
      return {
        observation: {
          status: 200,
          headers: { "content-type": "application/json" },
          body: Buffer.from('{"original":true}'),
        },
        raw: {},
      };
    },
    close: async () => {
      closes++;
    },
  };
}
test("new ad hoc reference wrapper binds replay, order, reset, dirty snapshots and sticky failure (synthetic transport)", async () => {
  const scratch = mkdtempSync(join(tmpdir(), "audit-public-unit-"));
  try {
    const path = join(scratch, "original.sqlite"),
      db = new DatabaseSync(path);
    db.exec("CREATE TABLE original(value TEXT)");
    db.close();
    const state = snapshotSqlite(path);
    const transport = fakeTransport(state),
      r = new AuditReference(transport, scenario, () => {});
    await r.reset(signal());
    await r.requestStep(scenario.id, "step-01", scenario.requests[0], signal());
    assert.equal(r.stats.requests, 1);
    await assert.rejects(
      r.requestStep(scenario.id, "step-01", scenario.requests[0], signal()),
      /AUDIT_ADAPTER_ERROR/,
    );
    assert.ok(transport.closes > 0);
    await assert.rejects(r.snapshot(signal()), /WORKER_STATE/);
    await r.close();
    const dirty = fakeTransport(state);
    dirty.inspect = async () => ({ snapshot: state, legacySha256: h });
    const bad = new AuditReference(dirty, scenario, () => {});
    await assert.rejects(bad.reset(signal()), /AUDIT_ADAPTER_ERROR/);
    assert.ok(dirty.closes > 0);
    await bad.close();
    const changed = fakeTransport(state),
      c = new AuditReference(changed, scenario, () => {});
    await c.reset(signal());
    changed.inspect = async () => ({
      snapshot: {
        ...state,
        tables: state.tables.map((t) => ({
          ...t,
          rows: [[{ type: "text", value: "PUBLIC_DEV_CONTROL" }]],
        })),
      },
      legacySha256: h,
    });
    await assert.rejects(c.snapshot(signal()), /AUDIT_ADAPTER_ERROR/);
    await c.close();
  } finally {
    assert.ok(scratch.startsWith(join(tmpdir(), "audit-public-unit-")));
    rmSync(scratch, { recursive: true, force: true });
  }
});
test("new wrappers reject expanded transport policy and forged target before any execution", () => {
  assert.throws(
    () =>
      new AuditReference(
        {},
        {
          ...scenario,
          requests: [
            {
              method: "GET",
              path: "/api.php?action=get_appointments&search=PUBLIC_DEV_CONTROL",
            },
          ],
        },
        () => {},
      ),
  );
  assert.throws(
    () => new AuditTarget({}, scenario, () => {}),
    /TARGET_ADMISSION/,
  );
  assert.throws(
    () =>
      new AuditReference(
        {},
        {
          ...scenario,
          requests: [
            {
              method: "POST",
              path: "/api.php?action=book",
              body: "client_name=%FF",
            },
          ],
        },
        () => {},
      ),
  );
});
test("target wrapper rejects forged/stale generations, policy changes and raw receipt corruption (synthetic trusted seam)", async () => {
  const worker = Object.create(TargetWorker.prototype);
  Object.assign(worker, {
    profile: WORKSHOP_PROFILE,
    bundle: { candidateSha: WORKSHOP_CANDIDATE_SHA },
    image: `sha256:${h}`,
    provenance: { imageId: `sha256:${h}` },
    runId: "mmp007-00000000-0000-0000-0000-000000000001",
    evidence: { commands: [], cleanupVerified: true },
    close: async () => {},
  });
  worker.runtime = {
    id: h,
    volume: `${worker.runId}-fresh-db`,
    name: `${worker.runId}-runtime`,
    scenarioId: scenario.id,
  };
  const a = new AuditTarget(worker, scenario, () => {}, {
    inventory: async () => ({ containers: [], volumes: [] }),
  });
  const receipt = {
    runId: worker.runId,
    candidateSha: WORKSHOP_CANDIDATE_SHA,
    imageId: worker.image,
    runtimeId: h,
    scenarioId: scenario.id,
    policy: {},
  };
  assert.throws(
    () => a.bind({ ...receipt, candidateSha: "c".repeat(64) }, scenario.id),
    /RESET_IDENTITY/,
  );
  a.bind(receipt, scenario.id);
  assert.throws(() => a.bind(receipt, scenario.id), /RESET_IDENTITY/);
  a.current();
  worker.runtime.id = "c".repeat(64);
  assert.throws(() => a.current(), /STALE_RUNTIME/);
  worker.runtime.id = h;
  worker.profile = { ...WORKSHOP_PROFILE };
  assert.throws(() => a.current(), /STALE_RUNTIME/);
  worker.profile = WORKSHOP_PROFILE;
  a.resetDone = true;
  assert.throws(
    () => a.expected("step-02", scenario.requests[0]),
    /STEP_BINDING/,
  );
  assert.throws(
    () =>
      a.expected("step-01", {
        ...scenario.requests[0],
        body: "PRIVATE_CANARY",
      }),
    /STEP_BINDING/,
  );
  worker.evidence.commands = [
    {
      args: [
        "/opt/worker/inspect.mjs",
        `container:${h}`,
        JSON.stringify({ kind: "http", profileId: WORKSHOP_PROFILE.id }),
      ],
      exitCode: 0,
      stdout: '{"status":200,"status":503}',
    },
  ];
  assert.throws(() => a.wire("http", 0), /WIRE_DUPLICATE_KEY/);
  worker.evidence.commands[0].args[1] = `container:${"d".repeat(64)}`;
  worker.evidence.commands[0].stdout = "{}";
  assert.throws(() => a.wire("http", 0), /INSPECTOR_MOUNT/);
  worker.evidence.commands[0].args[1] = `container:${h}`;
  worker.evidence.commands[0].args[2] = JSON.stringify({
    kind: "http",
    profileId: "public-items-v1",
  });
  assert.throws(() => a.wire("http", 0), /INSPECTOR_ACTION/);
  await a.close();
});
test("unchanged verifyPair discriminates equal/mutated ad hoc synthetic transport (not Docker proof)", async () => {
  const scratch = mkdtempSync(join(tmpdir(), "audit-public-verifier-"));
  try {
    const path = join(scratch, "original.sqlite"),
      db = new DatabaseSync(path);
    db.exec("CREATE TABLE original(value TEXT)");
    db.close();
    const state = snapshotSqlite(path);
    for (const corrupt of [false, true]) {
      const reference = new AuditReference(
          fakeTransport(state),
          scenario,
          () => {},
        ),
        base = new AuditReference(fakeTransport(state), scenario, () => {});
      const candidate = {
        reset: (s) => base.reset(s),
        snapshot: (s) => base.snapshot(s),
        close: (s) => base.close(s),
        request: async (r, s) => {
          const o = await base.request(r, s);
          return corrupt ? { ...o, status: 503 } : o;
        },
      };
      const result = await verifyPair({
        reference,
        candidate,
        scenarios: [scenario],
        artifactParent: scratch,
        operationTimeoutMs: 10000,
      });
      assert.equal(result.gateResults[0].verdict, corrupt ? "FAIL" : "PASS");
      assert.equal(result.gateResults[1].verdict, corrupt ? "FAIL" : "PASS");
      assert.equal(result.gateResults[2].verdict, "INCONCLUSIVE");
    }
  } finally {
    assert.ok(scratch.startsWith(join(tmpdir(), "audit-public-verifier-")));
    rmSync(scratch, { recursive: true, force: true });
  }
});
