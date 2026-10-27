// PUBLIC_DEV_CONTROL: only original synthetic canaries. No Docker or samples.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { PrivateEvidence } from "@metamorph/oracle";
import { publishFailure, safeFailureReceipt } from "../src/errors.mjs";
import { bounded, PairRegistry } from "../src/lifecycle.mjs";

const CANARY = "PUBLIC_DEV_CONTROL_PRIVATE_CANARY",
  head = "a".repeat(40),
  h = "b".repeat(64);
const sha = (x) => createHash("sha256").update(JSON.stringify(x)).digest("hex");
const empty = () => ({
  before: { containers: [], volumes: [] },
  after: { containers: [], volumes: [] },
});

// Filesystem seam exercises actual independent index hashing on every platform;
// production PrivateEvidence permission semantics are tested separately on POSIX.
function fixture(
  t,
  {
    failSeal,
    failVerify,
    failCreate,
    failWrite,
    catalogError,
    cleanupMs = 50,
  } = {},
) {
  const parent = mkdtempSync(join(tmpdir(), "audit-lifecycle-public-"));
  t.after(() => {
    assert.ok(parent.startsWith(join(tmpdir(), "audit-lifecycle-public-")));
    rmSync(parent, { recursive: true, force: true });
  });
  const packs = new Map(),
    records = [];
  let serial = 0;
  const registry = new PairRegistry({
    parent,
    root: process.cwd(),
    identity: { headSha: head, candidateSha: h },
    reap: async () => empty(),
    record: (k, v) => records.push({ k, v }),
    cleanupMs,
    packFactory: (directory, _root, provenance) => {
      if (provenance.type === failCreate) throw Error(CANARY);
      const path = join(directory, `test-pack-${++serial}`);
      mkdirSync(path, { mode: 0o700 });
      const entries = [];
      const pack = {
        path,
        entries,
        write: (id, value) => {
          if (provenance.type === failWrite && id === "pair-finalization")
            throw Error(CANARY);
          assert.ok(!entries.some((e) => e.id === id));
          const bytes = JSON.stringify(value);
          writeFileSync(join(path, `${id}.json`), bytes, {
            mode: 0o600,
            flag: "wx",
          });
          entries.push({ id, sha: sha(value) });
        },
        seal: () => {
          if (provenance.type === failSeal) throw Error(CANARY);
          const index = { entries: [...entries] };
          pack.write("index", index);
          return sha(index);
        },
      };
      packs.set(path, { pack, type: provenance.type });
      pack.write("provenance", provenance);
      return pack;
    },
    verify: (path, expected) => {
      if (packs.get(path).type === failVerify) throw Error(CANARY);
      const index = JSON.parse(readFileSync(join(path, "index.json"), "utf8"));
      assert.equal(sha(index), expected);
      for (const e of index.entries)
        assert.equal(
          sha(JSON.parse(readFileSync(join(path, `${e.id}.json`), "utf8"))),
          e.sha,
        );
      return index.entries.length;
    },
    catalog: (_root, pack, complete) => {
      pack.write("raw-partial", { raw: CANARY });
      if (catalogError) throw Error(CANARY);
      pack.write("catalog", { status: complete ? "COMPLETE" : "INCOMPLETE" });
      return { status: complete ? "COMPLETE" : "INCOMPLETE", files: 1 };
    },
  });
  return { registry, packs, records, parent };
}
function assertPublicError(registry, { primary, verified = 3 } = {}) {
  const states = registry.publicState(),
    state = states[0];
  assert.equal(state.status, "FINALIZED_PRIVATE_ERROR");
  assert.equal(registry.complete, false);
  if (primary) assert.equal(state.primaryCode, primary);
  assert.equal(
    state.packs.filter((p) => p.status === "VERIFIED").length,
    verified,
  );
  const receipt = safeFailureReceipt({
    headSha: head,
    phase: "public-controls",
    pairs: states,
    cleanup: state.cleanup,
    provenance: { status: "VERIFIED", sha256: h },
  });
  assert.equal(receipt.verdict, "AUDIT_ERROR");
  assert.ok(!JSON.stringify(receipt).includes(CANARY));
  assert.ok(!JSON.stringify(receipt).includes("diagnostic"));
  assert.ok(!JSON.stringify(receipt).includes("test-pack"));
  assert.equal(receipt.pairs[0].status, "FINALIZED_PRIVATE_ERROR");
  return state;
}
for (const phase of ["provision", "oracle", "retention"])
  test(`fault at ${phase}: partial php/bridge/oracle indexes verified AFTER cleanup`, async (t) => {
    const { registry, packs, records } = fixture(t);
    const pair = registry.open("audit-public-positive");
    pair.create();
    let closed = false;
    pair.closeWith("target", async () => {
      closed = true;
    });
    pair.captureExecution = () => ({ executedCount: 2, diagnostic: CANARY });
    pair.receipt("before-error", { raw: CANARY });
    pair.pack("php").write("command", { raw: CANARY });
    await assert.rejects(
      pair.step(
        phase,
        async () => {
          throw Error(CANARY);
        },
        AbortSignal.timeout(1000),
      ),
      new RegExp(CANARY),
    );
    await pair.finish();
    assert.equal(closed, true);
    assertPublicError(registry, { primary: `${phase.toUpperCase()}_ERROR` });
    assert.equal(pair.catalogStatus, "INCOMPLETE");
    assert.equal(packs.size, 3);
    for (const { pack } of packs.values()) {
      const m = JSON.parse(
        readFileSync(join(pack.path, "pair-finalization.json"), "utf8"),
      );
      assert.equal(m.executionStatus, "ERROR");
      assert.equal(m.primary.phase, phase);
      assert.match(m.primary.detail.diagnostic, new RegExp(CANARY));
    }
    assert.ok(records.some((r) => r.k === "pair-finalized"));
  });
test("fault before Oracle work still retains all created packs", async (t) => {
  const { registry } = fixture(t);
  const p = registry.open("audit-public-positive");
  p.create();
  p.fail("ORACLE_ERROR", Error(CANARY));
  await p.finish();
  assertPublicError(registry, { primary: "ORACLE_ERROR" });
});
test("half-created pair is retained by registry and available pack still sealed", async (t) => {
  const { registry } = fixture(t, { failCreate: "bridge" });
  const p = registry.open("audit-public-positive");
  assert.throws(() => p.create(), new RegExp(CANARY));
  await p.finish();
  const s = assertPublicError(registry, {
    primary: "EVIDENCE_CREATE_ERROR",
    verified: 1,
  });
  assert.ok(s.secondaryCodes.includes("EVIDENCE_SEAL_ERROR"));
});
for (const mode of ["close", "inventory", "emergency"])
  test(`${mode} fault never becomes successful cleanup or complete evidence`, async (t) => {
    const { registry } = fixture(t);
    const p = registry.open("audit-public-positive");
    p.create();
    p.workComplete = true;
    if (mode === "close")
      p.closeWith("target", async () => {
        throw Error(CANARY);
      });
    if (mode === "inventory")
      registry.reap = async () => {
        throw Error(CANARY);
      };
    if (mode === "emergency")
      registry.reap = async () => ({
        ...empty(),
        before: { containers: [CANARY], volumes: [] },
      });
    await p.finish();
    const state = assertPublicError(registry, { primary: "CLEANUP_ERROR" });
    assert.equal(state.cleanup, "ERROR");
    assert.equal(state.catalog, "INCOMPLETE");
  });
test("primary operation failure remains primary under independent cleanup+seal faults", async (t) => {
  const { registry } = fixture(t, { failSeal: "php" });
  const p = registry.open("audit-public-positive");
  p.create();
  await assert.rejects(
    p.step(
      "oracle",
      async () => {
        throw Error(CANARY);
      },
      AbortSignal.timeout(1000),
    ),
  );
  p.closeWith("target", async () => {
    throw Error(`SECONDARY_${CANARY}`);
  });
  await p.finish();
  const s = assertPublicError(registry, {
    primary: "ORACLE_ERROR",
    verified: 2,
  });
  assert.ok(s.secondaryCodes.includes("CLEANUP_ERROR"));
  assert.ok(s.secondaryCodes.includes("EVIDENCE_SEAL_ERROR"));
  assert.match(p.privateState().primary.detail.diagnostic, new RegExp(CANARY));
});
for (const fault of ["failSeal", "failVerify", "failWrite"])
  test(`${fault} is explicit EVIDENCE_SEAL_ERROR, other packs still verify`, async (t) => {
    const { registry } = fixture(t, { [fault]: "bridge" });
    const p = registry.open("audit-public-positive");
    p.create();
    p.workComplete = true;
    await p.finish();
    assertPublicError(registry, {
      primary: "EVIDENCE_SEAL_ERROR",
      verified: 2,
    });
  });
test("partial catalog failure is independent from valid remaining pack indexes", async (t) => {
  const { registry } = fixture(t, { catalogError: true });
  const p = registry.open("audit-public-positive");
  p.create();
  p.workComplete = true;
  await p.finish();
  const s = assertPublicError(registry, { primary: "EVIDENCE_CATALOG_ERROR" });
  assert.equal(s.catalog, "ERROR");
});
test("successful lifecycle seals all indexes after close and cannot be finalized twice", async (t) => {
  const { registry, packs } = fixture(t);
  const p = registry.open("audit-public-positive");
  p.create();
  let closed = 0;
  p.closeWith("target", async () => {
    closed++;
  });
  p.workComplete = true;
  await p.finish();
  await registry.finishAll();
  assert.equal(closed, 1);
  assert.equal(registry.complete, true);
  assert.equal(p.status, "FINALIZED_PRIVATE_COMPLETE");
  assert.equal(p.catalogStatus, "COMPLETE");
  assert.equal(packs.size, 3);
  assert.ok(p.publicState().packs.every((x) => x.status === "VERIFIED"));
  assert.throws(() => p.receipt("late", CANARY), /LATE_RECEIPT/);
  assert.throws(() => p.pack("php").write("late", CANARY), /LATE_RECEIPT/);
});
test("operation timeout rejects late receipt and does not alter verified indexes", async (t) => {
  const { registry } = fixture(t);
  const p = registry.open("audit-public-positive");
  p.create();
  let late;
  await assert.rejects(
    p.step(
      "oracle",
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            try {
              p.receipt("late", CANARY);
            } catch (e) {
              late = e.code;
            }
            resolve();
          }, 50);
        }),
      AbortSignal.timeout(1000),
      5,
    ),
    /TIMEOUT/,
  );
  await p.finish();
  const before = JSON.stringify(p.publicState());
  await new Promise((r) => setTimeout(r, 70));
  assert.equal(late, "LATE_RECEIPT");
  assert.equal(JSON.stringify(p.publicState()), before);
  assertPublicError(registry, { primary: "TIMEOUT" });
});
for (const mode of ["pre-abort", "synthetic-SIGTERM", "synthetic-SIGINT"])
  test(`${mode}: cancellation keeps partial packs and no complete verdict`, async (t) => {
    const { registry } = fixture(t);
    const p = registry.open("audit-public-positive");
    p.create();
    const controller = new AbortController();
    if (mode === "pre-abort") controller.abort();
    else setTimeout(() => controller.abort(), 5);
    await assert.rejects(
      p.step("oracle", () => new Promise(() => {}), controller.signal, 1000),
    );
    await p.finish();
    assertPublicError(registry, { primary: "CANCELLED" });
  });
test("hung cleanup has independent bounded grace then explicit error and verified partial indexes", async (t) => {
  const { registry } = fixture(t, { cleanupMs: 10 });
  const p = registry.open("audit-public-positive");
  p.create();
  p.closeWith("target", () => new Promise(() => {}));
  await p.finish();
  const s = assertPublicError(registry, { primary: "CLEANUP_ERROR" });
  assert.equal(s.cleanup, "ERROR");
});
test("safe error serialization survives malformed getters/gates, seal+worker faults and raw canaries", () => {
  const malformed = {
    get id() {
      throw Error(CANARY);
    },
  };
  const s = safeFailureReceipt({
    headSha: head,
    phase: CANARY,
    pairs: [malformed],
    cleanup: CANARY,
    provenance: { status: "VERIFIED", sha256: CANARY },
    gates: [CANARY],
    diagnostic: CANARY,
  });
  assert.equal(s.verdict, "AUDIT_ERROR");
  assert.equal(s.code, "PUBLICATION_ERROR");
  assert.deepEqual(s.pairs, []);
  assert.equal(s.cleanup, "ERROR");
  assert.ok(!JSON.stringify(s).includes(CANARY));
});
test("private registry publication error does not skip pack sealing or hide primary failure", async (t) => {
  const { registry } = fixture(t);
  const p = registry.open("audit-public-positive");
  p.create();
  p.fail("PROVISION_ERROR", Error(CANARY));
  registry.persist = () => {
    throw Error(`SECONDARY_${CANARY}`);
  };
  await p.finish();
  const s = assertPublicError(registry, { primary: "PROVISION_ERROR" });
  assert.ok(s.secondaryCodes.includes("EVIDENCE_REGISTRY_ERROR"));
});
test("production POSIX PrivateEvidence indexes verify on synthetic failure after teardown", {
  skip: process.platform !== "linux",
}, async (t) => {
  const parent = mkdtempSync(join(tmpdir(), "audit-real-pack-unit-"));
  t.after(() => {
    assert.ok(parent.startsWith(join(tmpdir(), "audit-real-pack-unit-")));
    rmSync(parent, { recursive: true, force: true });
  });
  // mkdtemp uses0700; no raw is printed or uploaded.
  const registry = new PairRegistry({
      parent,
      root: process.cwd(),
      identity: { headSha: head, candidateSha: h },
      reap: async () => empty(),
      record: () => {},
    }),
    p = registry.open("audit-public-positive");
  p.create();
  writeFileSync(
    join(p.oracleParent, "partial.json"),
    JSON.stringify({ raw: CANARY }),
    { mode: 0o600 },
  );
  await assert.rejects(
    p.step(
      "oracle",
      async () => {
        throw Error(CANARY);
      },
      AbortSignal.timeout(1000),
    ),
  );
  await p.finish();
  assertPublicError(registry, { primary: "ORACLE_ERROR" });
  for (const pack of p.packs.values())
    assert.ok(PrivateEvidence.verify(pack.path, pack.result.sha256) > 0);
});
test("bounded supervisor does not execute pre-cancelled work", async () => {
  const c = new AbortController();
  c.abort();
  let called = false;
  await assert.rejects(
    bounded(
      () => {
        called = true;
      },
      10,
      "TIMEOUT",
      c.signal,
    ),
  );
  assert.equal(called, false);
});

test("even malformed error input cannot throw while producing fallback receipt", () => {
  for (const input of [
    undefined,
    null,
    {
      get headSha() {
        throw Error(CANARY);
      },
    },
    {
      secondaryCodes: new Proxy([], {
        get() {
          throw Error(CANARY);
        },
      }),
    },
  ]) {
    const x = safeFailureReceipt(input);
    assert.equal(x.verdict, "AUDIT_ERROR");
    assert.equal(x.code, "PUBLICATION_ERROR");
    assert.ok(!JSON.stringify(x).includes(CANARY));
  }
});
test("safe error publication failure reports one fixed code with no repeated throw", () => {
  const reported = [];
  let count = 0;
  const r = publishFailure(
    "unused-public-path",
    {
      headSha: head,
      phase: "runtime",
      primaryCode: "BUILD_FAILED",
      secondaryCodes: ["EVIDENCE_PROVENANCE_ERROR"],
      cleanup: "ERROR",
    },
    {
      write: () => {
        count++;
        throw Error(CANARY);
      },
      report: (c) => reported.push(c),
    },
  );
  assert.equal(r.published, false);
  assert.equal(count, 1);
  assert.deepEqual(reported, ["AUDIT_ERROR_PUBLICATION_FAILED"]);
  assert.equal(r.receipt.code, "BUILD_FAILED");
  assert.deepEqual(r.receipt.secondaryCodes, ["EVIDENCE_PROVENANCE_ERROR"]);
  assert.ok(!JSON.stringify(r).includes(CANARY));
});
