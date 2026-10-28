import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { DAY, digest } from "../src/core.mjs";
import { signed } from "../src/crypto.mjs";
import { LocalStore } from "../src/store.mjs";
import { approval, fixture, now, POSIX } from "./fixture.mjs";

function instant(f, days) {
  return new Date(
    Date.parse(f.input.identity.terminalReceiptAt) + days * DAY,
  ).toISOString();
}
function review(f, at) {
  return signed(
    {
      format: "mmp-evidence-no-hold-v1",
      witnessRef: f.input.identity.witnessRef,
      at,
      noHold: true,
      witnessSha256: f.trust.witnessSha256,
      storageWitnessSha256: f.trust.storageWitnessSha256,
    },
    f.k.reviewer.privateKey,
  );
}
function recordBoth(f, ledger, purpose, at = now()) {
  for (const domain of [0, 1]) {
    const receipt = f.restore(domain, { purpose, now: at });
    ledger.recordRestore(signed(receipt, f.k.receipt.privateKey), at);
  }
}
function deletionStores(f) {
  const deletionAuthority = {
    terminalReceiptAt: f.input.identity.terminalReceiptAt,
    witnessRef: f.input.identity.witnessRef,
    witnessSha256: f.trust.witnessSha256,
    storageWitnessSha256: f.trust.storageWitnessSha256,
    versions: f.versions,
    ownerPublicKeys: [f.k.owner1.publicKey, f.k.owner2.publicKey],
    reviewerPublicKey: f.k.reviewer.publicKey,
  };
  return f.storeConfigs.map((c) => new LocalStore({ ...c, deletionAuthority }));
}
test(
  "180 calendar days bind to terminal receipt; immediate restore is separate from day90",
  POSIX,
  async (t) => {
    const f = await fixture(t);
    const ledger = f.ledger();
    try {
      const first = ledger.status();
      assert.equal(first.immediateRestore, "NOT_VERIFIED");
      assert.equal(first.minimumRetainUntil, instant(f, 180));
      assert.equal(first.day90DueAt, instant(f, 90));
      recordBoth(f, ledger, "IMMEDIATE");
      const status = ledger.status();
      assert.equal(status.immediateRestore, "SIMULATED_VERIFIED");
      assert.equal(status.day90, "DUE_TASK_PENDING");
      assert.equal(status.G4, "INCONCLUSIVE");
      assert.equal(ledger.dueTasks().length, 2);
    } finally {
      ledger.close();
    }
  },
);
test(
  "simulated day90 executes both full restores and records signed exact-version receipts",
  POSIX,
  async (t) => {
    const f = await fixture(t);
    const ledger = f.ledger();
    try {
      recordBoth(f, ledger, "IMMEDIATE");
      recordBoth(f, ledger, "DAY90", instant(f, 90));
      assert.equal(ledger.status(instant(f, 90)).day90, "SIMULATED_VERIFIED");
      assert.equal(ledger.dueTasks(instant(f, 90)).length, 0);
      assert.equal(ledger.status(instant(f, 180)).hold, false);
    } finally {
      ledger.close();
    }
  },
);
test(
  "missing, one-copy or late day90 restore is NOT_VERIFIED and creates sticky incident/hold",
  POSIX,
  async (t) => {
    const f = await fixture(t);
    const ledger = f.ledger();
    try {
      const one = f.restore(0, { purpose: "DAY90", now: instant(f, 90) });
      ledger.recordRestore(signed(one, f.k.receipt.privateKey), instant(f, 90));
      const overdue = ledger.status(instant(f, 91));
      assert.equal(overdue.day90, "NOT_VERIFIED");
      assert.equal(overdue.hold, true);
      recordBoth(f, ledger, "DAY90", instant(f, 92));
      assert.equal(ledger.status(instant(f, 92)).day90, "NOT_VERIFIED");
      assert.ok(
        ledger.journal.rows.some((r) => r.payload.code === "DAY90_MISSED"),
      );
    } finally {
      ledger.close();
    }
  },
);
test(
  "forged or incomplete restore receipts cannot satisfy retention checks",
  POSIX,
  async (t) => {
    const f = await fixture(t);
    const ledger = f.ledger();
    try {
      const p = f.restore();
      assert.throws(
        () => ledger.recordRestore(signed(p, f.k.owner1.privateKey)),
        /SIGNATURE/,
      );
      for (const change of [
        { versions: [] },
        { fileCount: 0 },
        { packCount: 0 },
        { manifestSha256: "0".repeat(64) },
        { witnessSha256: "0".repeat(64) },
      ])
        assert.throws(
          () =>
            ledger.recordRestore(
              signed({ ...p, ...change }, f.k.receipt.privateKey),
            ),
          /RESTORE_RECEIPT/,
        );
    } finally {
      ledger.close();
    }
  },
);
test(
  "clock rollback persists across restart and freezes deletion",
  POSIX,
  async (t) => {
    const f = await fixture(t);
    let ledger = f.ledger();
    ledger.status(instant(f, 89));
    ledger.close();
    ledger = f.ledger();
    try {
      assert.throws(() => ledger.status(instant(f, 88)), /CLOCK_ROLLBACK/);
      assert.equal(ledger.state().incident, true);
    } finally {
      ledger.close();
    }
  },
);
test(
  "premature and unapproved deletion cannot remove either retained version",
  POSIX,
  async (t) => {
    const f = await fixture(t);
    const ledger = f.ledger();
    const stores = deletionStores(f);
    try {
      assert.throws(() => ledger.deletionPlan([], null), /PREMATURE_DELETION/);
      assert.throws(
        () =>
          stores[0].deleteAuthorized(f.versions[0], {
            approvals: [],
            reviewRecord: null,
          }),
        /PREMATURE_DELETION/,
      );
      assert.throws(
        () =>
          f.stores[0].deleteAuthorized(
            f.versions[0],
            "SYNTHETIC_VERIFIED_EXPIRY_ONLY",
          ),
        /UNAUTHORIZED/,
      );
      for (const v of f.versions)
        assert.ok(
          existsSync(join(f.dirs[v.domainId], v.versionId, "blob.bin")),
        );
    } finally {
      for (const store of stores) store.close();
      ledger.close();
    }
  },
);
test(
  "legal/incident holds extend beyond day180; release needs both exact owner signatures",
  POSIX,
  async (t) => {
    const f = await fixture(t);
    const ledger = f.ledger();
    try {
      recordBoth(f, ledger, "DAY90", instant(f, 90));
      ledger.hold("legal-one", instant(f, 179));
      const at = instant(f, 181);
      assert.throws(
        () => ledger.deletionPlan(approval(f, "DELETE", at), review(f, at), at),
        /HELD/,
      );
      assert.throws(
        () => ledger.releaseHold("legal-one", [], at),
        /TWO_OWNERS/,
      );
      ledger.releaseHold(
        "legal-one",
        approval(f, "RELEASE_HOLD", at, { holdId: "legal-one" }),
        at,
      );
      assert.equal(ledger.state().holds.size, 0);
      assert.equal(
        ledger.deletionPlan(approval(f, "DELETE", at), review(f, at), at)
          .targets.length,
        4,
      );
    } finally {
      ledger.close();
    }
  },
);
test(
  "day180 deletion needs two owners and independent no-hold review at the bound witness",
  POSIX,
  async (t) => {
    const f = await fixture(t);
    const ledger = f.ledger();
    try {
      recordBoth(f, ledger, "DAY90", instant(f, 90));
      const at = instant(f, 180);
      assert.throws(() => ledger.deletionPlan([], null, at), /TWO_OWNERS/);
      const approvals = approval(f, "DELETE", at);
      assert.throws(
        () =>
          ledger.deletionPlan([approvals[0], approvals[0]], review(f, at), at),
        /SIGNATURE/,
      );
      assert.throws(
        () =>
          ledger.deletionPlan(
            approvals,
            signed({ noHold: true }, f.k.owner1.privateKey),
            at,
          ),
        /SIGNATURE/,
      );
      assert.equal(
        ledger.deletionPlan(approvals, review(f, at), at).format,
        "mmp-evidence-deletion-plan-v1",
      );
    } finally {
      ledger.close();
    }
  },
);
test(
  "authorized synthetic deletion retains tombstones and needs all copy/escrow/snapshot witnesses",
  POSIX,
  async (t) => {
    const f = await fixture(t);
    const ledger = f.ledger();
    const stores = deletionStores(f);
    try {
      recordBoth(f, ledger, "DAY90", instant(f, 90));
      const at = instant(f, 180);
      const approvals = approval(f, "DELETE", at);
      const reviewRecord = review(f, at);
      const plan = ledger.deletionPlan(approvals, reviewRecord, at);
      assert.throws(() => ledger.recordDeletion(plan, [], at), /UNVERIFIED/);
      for (const store of stores) {
        const v = f.versions.find((r) => r.domainId === store.config.domainId);
        assert.equal(
          store.deleteAuthorized(v, { approvals, reviewRecord }, at).status,
          "SYNTHETIC_DELETED",
        );
        assert.equal(
          existsSync(join(store.config.root, v.versionId, "blob.bin")),
          false,
        );
        assert.ok(
          readFileSync(join(store.config.root, v.versionId, "receipt.json"))
            .length,
        );
        assert.ok(
          existsSync(join(store.config.root, v.versionId, "deleted.json")),
        );
        assert.throws(() => store.get(v), /INCOMPLETE/);
      }
      const keyMap = {
        primary: f.k.primaryCustodian,
        secondary: f.k.secondaryCustodian,
        escrow: f.k.escrowCustodian,
        snapshots: f.k.snapshotCustodian,
      };
      const receipts = plan.targets.map((target) =>
        signed(
          {
            format: "mmp-evidence-deletion-witness-v1",
            target,
            planSha256: digest(plan),
            status: "SYNTHETIC_DELETED_OR_ABSENT",
            at,
          },
          keyMap[target].privateKey,
        ),
      );
      assert.equal(
        ledger.recordDeletion(plan, receipts, at),
        "SYNTHETIC_DELETION_VERIFIED",
      );
    } finally {
      for (const store of stores) store.close();
      ledger.close();
    }
  },
);
test(
  "recovery revocation is append-only and survives ledger reopen",
  POSIX,
  async (t) => {
    const f = await fixture(t);
    let ledger = f.ledger();
    ledger.revoke("expired-grant");
    ledger.close();
    ledger = f.ledger();
    try {
      assert.ok(ledger.state().revoked.has("expired-grant"));
    } finally {
      ledger.close();
    }
  },
);
