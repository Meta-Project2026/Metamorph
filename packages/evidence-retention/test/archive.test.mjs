import assert from "node:assert/strict";
import { chmodSync, linkSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { inspect, openArchive } from "../src/catalog.mjs";
import { admission, bytes } from "../src/core.mjs";
import { decrypt } from "../src/crypto.mjs";
import { publish } from "../src/engine.mjs";
import { fixture, POSIX } from "./fixture.mjs";

test(
  "each encrypted copy retains the complete root, independently of the external witness store",
  POSIX,
  async (t) => {
    const f = await fixture(t);
    for (const store of f.stores) {
      const receipt = f.versions.find(
        (r) => r.domainId === store.config.domainId,
      );
      const p = f.witness.payload.catalog.packs[0];
      const plain = decrypt(
        store.get(receipt),
        f.witness.payload,
        p,
        "reader",
        f.k.reader.privateKey,
      );
      try {
        const n = plain.readUInt32BE(0);
        const meta = JSON.parse(plain.subarray(4, 4 + n));
        assert.deepEqual(meta.rootCatalog, f.witness.payload.catalog);
        assert.equal(
          openArchive(
            plain,
            p,
            admission(f.input.admission),
            f.witness.payload.catalog,
          ).size,
          p.files.length,
        );
        delete meta.rootCatalog;
        const changed = Buffer.concat([
          Buffer.alloc(4),
          bytes(meta),
          plain.subarray(4 + n),
        ]);
        changed.writeUInt32BE(bytes(meta).length, 0);
        assert.throws(
          () =>
            openArchive(
              changed,
              p,
              admission(f.input.admission),
              f.witness.payload.catalog,
            ),
          /WITNESS_MISMATCH/,
        );
      } finally {
        plain.fill(0);
      }
    }
  },
);
test(
  "unindexed extra pack and inconsistent attempt receipts cannot be omitted from the root",
  POSIX,
  async (t) => {
    const f = await fixture(t, { publish: false });
    f.input.packs[0].terminalReceiptAt = new Date(
      Date.parse(f.input.identity.terminalReceiptAt) + 1,
    ).toISOString();
    assert.throws(() => inspect(f.input), /ATTEMPT_TIME/);
    f.input.packs[0].terminalReceiptAt = f.input.identity.terminalReceiptAt;
    f.input.packs = [];
    assert.throws(() => inspect(f.input), /BUDGET/);
  },
);
test(
  "storage metadata cannot override generated version/size/hash receipt fields",
  POSIX,
  async (t) => {
    const f = await fixture(t, { publish: false });
    assert.throws(
      () =>
        f.stores[0].put("pack", Buffer.from("synthetic"), {
          manifestSha256: "0".repeat(64),
          witnessRef: "witness",
          sha256: "0".repeat(64),
        }),
      /FIELDS/,
    );
    assert.equal(readdirSync(f.dirs.primary).length, 0);
  },
);
test(
  "overlapping writer/storage roots fail before storage mutation",
  POSIX,
  async (t) => {
    const f = await fixture(t, { publish: false });
    const old = f.stores[0].config.root;
    f.stores[0].config.root = f.dirs.source;
    try {
      assert.throws(
        () =>
          publish({
            input: f.input,
            witness: f.witness,
            witnessPublicKey: f.k.witness.publicKey,
            expectedWitnessSha256: f.trust.witnessSha256,
            stores: f.stores,
            nonceRoot: f.dirs.nonces,
            journal: f.writerJournal,
          }),
        /OVERLAPPING_ROOTS/,
      );
    } finally {
      f.stores[0].config.root = old;
    }
    assert.equal(readdirSync(f.dirs.primary).length, 0);
  },
);
test(
  "storage owner-only modes and single-link ciphertext identity are rechecked at read",
  POSIX,
  async (t) => {
    const f = await fixture(t);
    const v = f.versions[0];
    const path = join(f.dirs.primary, v.versionId, "blob.bin");
    chmodSync(path, 0o640);
    assert.throws(() => f.stores[0].get(v), /PERMISSIONS/);
    chmodSync(path, 0o600);
    linkSync(path, join(f.scratch, "ciphertext-hardlink"));
    assert.throws(() => f.stores[0].get(v), /HARDLINK/);
  },
);
