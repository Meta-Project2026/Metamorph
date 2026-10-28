import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PrivateEvidence } from "@metamorph/oracle";
import { inspect } from "../src/catalog.mjs";
import { DAY } from "../src/core.mjs";
import { signed } from "../src/crypto.mjs";
import { Journal } from "../src/journal.mjs";
import { LocalStore } from "../src/store.mjs";
import { approval, fixture, POSIX, save } from "./fixture.mjs";

const atDay = (f, n) =>
  new Date(
    Date.parse(f.input.identity.terminalReceiptAt) + n * DAY,
  ).toISOString();

function addEarlierPack(f, age) {
  const pack = new PrivateEvidence(f.dirs.source, process.cwd(), {
    synthetic: true,
  });
  pack.write("error", { code: "SYNTHETIC_PARTIAL" });
  f.input.packs.push({
    ...f.input.packs[0],
    id: "earlier-pack",
    attemptId: "earlier-attempt",
    pairId: "earlier-pair",
    terminalReceiptAt: new Date(
      Date.parse(f.input.identity.terminalReceiptAt) - age,
    ).toISOString(),
    relativePath: pack.path.split("/").at(-1),
    indexSha256: pack.seal(),
    status: "INCOMPLETE",
    outcome: "ERROR",
  });
}
test(
  "calendar: bundle day90 uses earliest attempt deadline while 180d uses latest terminal",
  POSIX,
  async (t) => {
    const f = await fixture(t, { publish: false });
    addEarlierPack(f, DAY / 24);
    f.freeze();
    f.publish();
    const ledger = f.ledger();
    try {
      assert.equal(
        ledger.dueTasks()[0].dueAt,
        new Date(Date.parse(atDay(f, 90)) - DAY / 24).toISOString(),
      );
      assert.equal(ledger.status().minimumRetainUntil, atDay(f, 180));
      for (const domain of [0, 1])
        ledger.recordRestore(
          signed(
            f.restore(domain, { purpose: "DAY90", now: atDay(f, 89) }),
            f.k.receipt.privateKey,
          ),
          atDay(f, 89),
        );
      assert.equal(ledger.status(atDay(f, 89)).day90, "SIMULATED_VERIFIED");
    } finally {
      ledger.close();
    }
  },
);
test(
  "calendar: bundles without a shared day89-to-day90 window require separate retention",
  POSIX,
  async (t) => {
    const f = await fixture(t, { publish: false });
    addEarlierPack(f, 2 * DAY);
    assert.throws(() => inspect(f.input), /ATTEMPT_CALENDAR_SCOPE/);
  },
);
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
function authority(f) {
  return {
    ledgerRoot: f.dirs.policy,
    terminalReceiptAt: f.input.identity.terminalReceiptAt,
    witnessRef: f.input.identity.witnessRef,
    witnessSha256: f.trust.witnessSha256,
    storageWitnessSha256: f.trust.storageWitnessSha256,
    versions: f.versions,
    ownerPublicKeys: [f.k.owner1.publicKey, f.k.owner2.publicKey],
    reviewerPublicKey: f.k.reviewer.publicKey,
  };
}
function qualifyDay90(f, ledger) {
  for (const domain of [0, 1])
    ledger.recordRestore(
      signed(
        f.restore(domain, { purpose: "DAY90", now: atDay(f, 90) }),
        f.k.receipt.privateKey,
      ),
      atDay(f, 90),
    );
}

test(
  "review: immediate restore relabeled DAY90 cannot retire future recovery tasks",
  POSIX,
  async (t) => {
    const f = await fixture(t);
    const ledger = f.ledger();
    try {
      assert.throws(() => f.restore(0, { purpose: "DAY90" }), /DAY90_WINDOW/);
      const immediate = f.restore();
      assert.throws(
        () =>
          ledger.recordRestore(
            signed({ ...immediate, purpose: "DAY90" }, f.k.receipt.privateKey),
          ),
        /DAY90_WINDOW/,
      );
      assert.equal(ledger.dueTasks().length, 2);
      assert.equal(ledger.status().day90, "DUE_TASK_PENDING");
      assert.equal(ledger.dueTasks()[0].notBefore, atDay(f, 89));
      assert.throws(
        () =>
          f.restore(0, {
            purpose: "DAY90",
            now: new Date(Date.parse(atDay(f, 89)) - 1).toISOString(),
          }),
        /DAY90_WINDOW/,
      );
      for (const domain of [0, 1])
        ledger.recordRestore(
          signed(
            f.restore(domain, { purpose: "DAY90", now: atDay(f, 89) }),
            f.k.receipt.privateKey,
          ),
          atDay(f, 89),
        );
      assert.equal(ledger.status(atDay(f, 89)).day90, "SIMULATED_VERIFIED");
    } finally {
      ledger.close();
    }
  },
);
test(
  "review: later hold invalidates existing owner/reviewer deletion signatures and permit",
  POSIX,
  async (t) => {
    const f = await fixture(t);
    const ledger = f.ledger();
    const store = new LocalStore({
      ...f.storeConfigs[0],
      deletionAuthority: authority(f),
    });
    try {
      qualifyDay90(f, ledger);
      const at = atDay(f, 180);
      const approvals = approval(f, "DELETE", at);
      const reviewRecord = review(f, at);
      const plan = ledger.deletionPlan(approvals, reviewRecord, at);
      ledger.hold("new-legal-hold", at);
      assert.throws(
        () => ledger.deletionPlan(approvals, reviewRecord, at),
        /DELETION_HELD/,
      );
      assert.throws(
        () =>
          store.deleteAuthorized(
            f.versions[0],
            { approvals, reviewRecord, plan },
            at,
          ),
        /JOURNAL_ROLLBACK|DELETION_HELD/,
      );
      assert.ok(
        existsSync(join(f.dirs.primary, f.versions[0].versionId, "blob.bin")),
      );
    } finally {
      store.close();
      ledger.close();
    }
  },
);
test(
  "review: a separately opened writer's hold invalidates stale deletion state",
  POSIX,
  async (t) => {
    const f = await fixture(t);
    const ledger = f.ledger();
    const store = new LocalStore({
      ...f.storeConfigs[0],
      deletionAuthority: authority(f),
    });
    try {
      qualifyDay90(f, ledger);
      const at = atDay(f, 180);
      const approvals = approval(f, "DELETE", at);
      const reviewRecord = review(f, at);
      const plan = ledger.deletionPlan(approvals, reviewRecord, at);
      const other = new Journal(f.dirs.policy);
      try {
        other.append({ type: "HOLD_ADD", holdId: "concurrent-hold" }, at);
      } finally {
        other.close();
      }
      assert.throws(
        () =>
          store.deleteAuthorized(
            f.versions[0],
            { approvals, reviewRecord, plan },
            at,
          ),
        /JOURNAL_ROLLBACK/,
      );
      assert.throws(
        () =>
          ledger.journal.append(
            { type: "DELETION_AUTHORIZED", planSha256: "0".repeat(64) },
            at,
          ),
        /JOURNAL_CHANGED/,
      );
      assert.ok(
        existsSync(join(f.dirs.primary, f.versions[0].versionId, "blob.bin")),
      );
    } finally {
      store.close();
      ledger.close();
    }
  },
);
test(
  "review: old signatures without a current ledger permit cannot delete",
  POSIX,
  async (t) => {
    const f = await fixture(t);
    const ledger = f.ledger();
    const store = new LocalStore({
      ...f.storeConfigs[0],
      deletionAuthority: authority(f),
    });
    try {
      qualifyDay90(f, ledger);
      const at = atDay(f, 180);
      assert.throws(
        () =>
          store.deleteAuthorized(
            f.versions[0],
            {
              approvals: approval(f, "DELETE", at),
              reviewRecord: review(f, at),
            },
            at,
          ),
        /DELETION_PLAN_REQUIRED/,
      );
    } finally {
      store.close();
      ledger.close();
    }
  },
);
test(
  "review: deletion and hold publication share one exclusive mutation lock",
  POSIX,
  async (t) => {
    const f = await fixture(t);
    const a = new Journal(f.dirs.policy);
    const b = new Journal(f.dirs.policy);
    try {
      a.withLock(() => {
        assert.throws(
          () => b.append({ type: "HOLD_ADD", holdId: "held" }),
          /EEXIST/,
        );
        assert.throws(() => new Journal(f.dirs.policy), /EEXIST/);
      });
      b.append({ type: "HOLD_ADD", holdId: "held" });
      assert.throws(
        () => a.append({ type: "UNAUTHORIZED_STALE_WRITE" }),
        /JOURNAL_CHANGED/,
      );
    } finally {
      a.close();
      b.close();
    }
  },
);
test(
  "review: source FIFO fails bounded preflight without invoking blocking legacy opens",
  POSIX,
  async (t) => {
    const f = await fixture(t, { publish: false });
    const path = join(f.pack.path, "observations.json");
    rmSync(path);
    execFileSync("mkfifo", ["--mode=600", path]);
    const config = join(f.dirs.witness, "fifo-input.json");
    save(config, f.input);
    const modulePath = fileURLToPath(
      new URL("../src/catalog.mjs", import.meta.url),
    );
    const script = `import {inspect} from ${JSON.stringify(new URL("../src/catalog.mjs", import.meta.url).href)}; import {readFileSync} from 'node:fs'; try {inspect(JSON.parse(readFileSync(process.argv[1])));process.exitCode=2;} catch(e) {if(e.code!=='PERMISSIONS')process.exitCode=3;}`;
    assert.ok(modulePath);
    const result = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", script, config],
      { encoding: "utf8", env: {}, timeout: 10_000 },
    );
    assert.equal(result.status, 0, result.error?.code ?? result.stderr);
    assert.equal(result.stdout, "");
  },
);

test(
  "review: a new incident invalidates a previously checkpointed deletion plan",
  POSIX,
  async (t) => {
    const f = await fixture(t);
    const ledger = f.ledger();
    const store = new LocalStore({
      ...f.storeConfigs[0],
      deletionAuthority: authority(f),
    });
    try {
      qualifyDay90(f, ledger);
      const at = atDay(f, 180);
      const approvals = approval(f, "DELETE", at);
      const reviewRecord = review(f, at);
      const plan = ledger.deletionPlan(approvals, reviewRecord, at);
      ledger.journal.append({ type: "INCIDENT", code: "NEW_INCIDENT" }, at);
      assert.throws(
        () =>
          store.deleteAuthorized(
            f.versions[0],
            { approvals, reviewRecord, plan },
            at,
          ),
        /JOURNAL_ROLLBACK/,
      );
      assert.ok(
        existsSync(join(f.dirs.primary, f.versions[0].versionId, "blob.bin")),
      );
    } finally {
      store.close();
      ledger.close();
    }
  },
);
test(
  "review: physical unlink holds the journal lock and later hold protects the remaining copy",
  POSIX,
  async (t) => {
    const f = await fixture(t);
    const ledger = f.ledger();
    const stores = f.storeConfigs.map(
      (config) =>
        new LocalStore({ ...config, deletionAuthority: authority(f) }),
    );
    try {
      qualifyDay90(f, ledger);
      const at = atDay(f, 180);
      const approvals = approval(f, "DELETE", at);
      const reviewRecord = review(f, at);
      const plan = ledger.deletionPlan(approvals, reviewRecord, at);
      let lockObserved = false;
      const get = stores[0].get.bind(stores[0]);
      stores[0].get = (receipt) => {
        assert.throws(() => ledger.hold("during-unlink", at), /EEXIST/);
        lockObserved = true;
        return get(receipt);
      };
      stores[0].deleteAuthorized(
        f.versions[0],
        { approvals, reviewRecord, plan },
        at,
      );
      assert.equal(lockObserved, true);
      ledger.hold("after-primary-deletion", at);
      const secondary = f.versions.find((v) => v.domainId === "secondary");
      assert.throws(
        () =>
          stores[1].deleteAuthorized(
            secondary,
            { approvals, reviewRecord, plan },
            at,
          ),
        /JOURNAL_ROLLBACK/,
      );
      assert.ok(
        existsSync(join(f.dirs.secondary, secondary.versionId, "blob.bin")),
      );
    } finally {
      for (const store of stores) store.close();
      ledger.close();
    }
  },
);
