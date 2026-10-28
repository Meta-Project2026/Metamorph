import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs, {
  appendFileSync,
  chmodSync,
  chownSync,
  existsSync,
  linkSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  truncateSync,
  writeFileSync,
} from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PrivateEvidence } from "@metamorph/oracle";
import { inspect } from "../src/catalog.mjs";
import {
  admission,
  bytes,
  canonical,
  DAY,
  digest,
  publicSummary,
  sha,
} from "../src/core.mjs";
import { decrypt, signed, verifyCatalogWitness } from "../src/crypto.mjs";
import { publish, witnessStorage } from "../src/engine.mjs";
import { Journal } from "../src/journal.mjs";
import { Directory } from "../src/secure-fs.mjs";
import { assessCustody, LocalStore } from "../src/store.mjs";
import {
  admitted,
  childReader,
  fixture,
  now,
  POSIX,
  parse,
  readerConfig,
  START,
  save,
} from "./fixture.mjs";

test("admission accounts for raw files, indexes, two ciphertexts, journals and working set", () => {
  const b = admission(admitted());
  assert.equal(b.rawFiles, 117);
  assert.ok(b.maxFilesPerPack >= 117 + 4);
  assert.equal(b.maxDepth, 2);
  assert.ok(b.maxCipherBytesPerPack > b.maxPackBytes);
  assert.ok(b.maxStorageBytes > 2 * b.maxTotalBytes);
  assert.ok(b.workingSetBound > b.maxPackBytes);
});
test("oversized/negative/unknown resource admission fails before writes", () => {
  for (const changes of [
    { maxPacks: 17 },
    { maxPackBytes: 129 * 1024 * 1024 },
    { maxRecordBytes: -1 },
    { maxRequestsPerPack: 301 },
    { maxJournalBytes: 1 },
    { surprise: 1 },
  ])
    assert.throws(() => admission(admitted(changes)));
});
test("canonical JSON rejects duplicate keys, appendages and malformed UTF-8", () => {
  for (const data of [
    Buffer.from('{"a":1,"a":2}'),
    Buffer.from("{}\n"),
    Buffer.from([123, 34, 97, 34, 58, 34, 255, 34, 125]),
  ])
    assert.throws(() => canonical(data));
});
test("public exporter is an allowlist; raw paths/hashes/errors/keys/canaries are absent", () => {
  const summary = publicSummary({
    runId: "opaque-run",
    status: "NOT_VERIFIED",
    packCount: 1,
    commitment: sha("blinded-synthetic"),
    raw: "SYNTHETIC-PRIVATE-CANARY",
    path: "/secret",
    key: "secret",
    fileSha256: sha("secret"),
  });
  assert.deepEqual(Object.keys(summary), [
    "format",
    "runId",
    "status",
    "packCount",
    "commitment",
    "G4",
    "PRODUCT",
    "EXTERNAL_RETENTION",
  ]);
  assert.doesNotMatch(JSON.stringify(summary), /CANARY|\/secret|fileSha256/);
  assert.throws(() => publicSummary({ ...summary, status: "G4_PASS" }));
});
test(
  "Windows support fails closed instead of treating POSIX mode bits as ACL proof",
  { skip: process.platform !== "win32" },
  () =>
    assert.throws(() => new Directory(process.cwd()), /UNSUPPORTED_PLATFORM/),
);

test(
  "full MANIFEST 117/117 under umask 022 survives both fresh child-process restores after source teardown",
  POSIX,
  async (t) => {
    const f = await fixture(t, { oracle: true, publish: false });
    const cat = parse(join(f.pack.path, "oracle-catalog.json"));
    assert.equal(cat.catalog.length, 117);
    // Obtain the prior commitment in a distinct witness process, never in the
    // restore writer. The witness key and pinned config are external to source.
    const signerPath = join(f.dirs.witness, "signer.pem");
    writeFileSync(signerPath, f.k.witness.privateKey, { mode: 0o600 });
    const witnessPath = join(f.dirs.witness, "prior-witness.json");
    const configPath = join(f.dirs.witness, "witness-config.json");
    save(configPath, {
      input: f.input,
      recipients: f.recipients,
      signingKeyPath: signerPath,
      outputPath: witnessPath,
    });
    const observed = spawnSync(
      process.execPath,
      [
        fileURLToPath(new URL("./witness-child.mjs", import.meta.url)),
        configPath,
      ],
      { encoding: "utf8", env: {}, timeout: 20_000 },
    );
    assert.equal(observed.status, 0, observed.stderr);
    f.witness = parse(witnessPath);
    f.trust.witnessSha256 = digest(f.witness);
    f.publish();
    const prior = new Map(
      readdirSync(f.pack.path).map((n) => [
        n,
        readFileSync(join(f.pack.path, n)),
      ]),
    );
    for (const entry of readdirSync(f.pack.path))
      assert.equal(fs.statSync(join(f.pack.path, entry)).mode & 0o777, 0o600);
    rmSync(f.dirs.source, { recursive: true });
    rmSync(f.dirs.raw, { recursive: true });
    for (const domain of [0, 1]) {
      const config = readerConfig(f, domain);
      const child = childReader(config.configPath);
      assert.equal(child.status, 0, child.stdout + child.stderr);
      const summary = JSON.parse(child.stdout);
      assert.equal(summary.status, "SIMULATED_RESTORED");
      assert.doesNotMatch(
        child.stdout,
        /CANARY|relativePath|privateKey|sha256|stderr|base64/,
      );
      const receipt = parse(config.config.receiptPath).payload;
      const restored = join(
        f.dirs.restore,
        receipt.restoredName,
        f.input.packs[0].relativePath,
      );
      assert.equal(fs.statSync(restored).mode & 0o777, 0o700);
      assert.equal(
        PrivateEvidence.verify(restored, f.input.packs[0].indexSha256),
        prior.size - 1,
      );
      assert.deepEqual(readdirSync(restored).sort(), [...prior.keys()].sort());
      for (const [name, expected] of prior)
        assert.deepEqual(readFileSync(join(restored, name)), expected);
      const restoredCatalog = parse(join(restored, "oracle-catalog.json"));
      assert.equal(restoredCatalog.catalog.length, 117);
      for (const row of restoredCatalog.catalog) {
        const record = parse(join(restored, `${row.id}.json`));
        assert.deepEqual(
          Buffer.from(record.base64, "base64"),
          f.expectedRaw.get(row.path),
        );
      }
      assert.deepEqual(
        parse(join(f.dirs.restore, receipt.restoredName, "root-catalog.json")),
        f.witness.payload.catalog,
      );
    }
  },
);
for (const fail of ["comparison", "request", "close"])
  test(
    `Oracle ${fail} retains observed FAIL/error and both exact restores`,
    POSIX,
    async (t) => {
      const f = await fixture(t, { oracle: true, fail });
      if (fail === "comparison") {
        assert.equal(f.input.packs[0].status, "COMPLETE");
        assert.equal(f.input.packs[0].outcome, "FAIL");
        assert.equal(f.result.gateResults[0].verdict, "FAIL");
      } else assert.equal(f.witness.payload.catalog.status, "INCOMPLETE");
      assert.equal(f.restore(0).status, "SIMULATED_RESTORED");
      assert.equal(f.restore(1).status, "SIMULATED_RESTORED");
    },
  );
test(
  "aborted sealed attempt remains INCOMPLETE and recoverable",
  POSIX,
  async (t) => {
    const f = await fixture(t, { aborted: true });
    assert.equal(f.witness.payload.catalog.status, "INCOMPLETE");
    assert.equal(f.restore().status, "SIMULATED_RESTORED");
  },
);
test(
  "high file count exceeds legacy 100-file cap without truncation",
  POSIX,
  async (t) => {
    const scenarios = Array.from({ length: 4 }, (_, i) => ({
      id: `synthetic-${i}`,
      description: "Original synthetic request-count fixture",
      requests: Array.from({ length: 20 }, () => ({
        method: "GET",
        path: "/synthetic",
      })),
    }));
    const f = await fixture(t, {
      oracle: true,
      scenarios,
      admission: { maxScenariosPerPack: 4, maxRequestsPerPack: 80 },
    });
    assert.equal(f.expectedRaw.size, 6 + 3 * 4 + 6 * 80);
    assert.equal(f.restore(1).status, "SIMULATED_RESTORED");
  },
);

for (const [name, mutate] of [
  ["missing record", (f) => rmSync(join(f.pack.path, "observations.json"))],
  ["extra unindexed record", (f) => save(join(f.pack.path, "extra.json"), {})],
  ["missing index", (f) => rmSync(join(f.pack.path, "index.json"))],
  [
    "duplicate index entry",
    (f) => {
      const p = join(f.pack.path, "index.json");
      const v = parse(p);
      v.entries.push(v.entries[0]);
      writeFileSync(p, bytes(v));
      f.input.packs[0].indexSha256 = sha(bytes(v));
    },
  ],
  [
    "symlink file",
    (f) => {
      const p = join(f.pack.path, "observations.json");
      rmSync(p);
      symlinkSync(join(f.pack.path, "provenance.json"), p);
    },
  ],
  [
    "hardlink file",
    (f) => {
      const p = join(f.pack.path, "observations.json");
      const x = join(f.scratch, "linked");
      linkSync(p, x);
    },
  ],
  [
    "weak file mode",
    (f) => chmodSync(join(f.pack.path, "observations.json"), 0o640),
  ],
  ["weak dir mode", (f) => chmodSync(f.pack.path, 0o750)],
  [
    "outside-root pack",
    (f) => {
      f.input.packs[0].relativePath = "../outside";
    },
  ],
  [
    "excess depth",
    (f) => mkdirSync(join(f.pack.path, "nested"), { mode: 0o700 }),
  ],
  [
    "mixed custody scopes",
    (f) => {
      f.input.packs[0].custodyScopeId = "another-scope";
    },
  ],
  [
    "oversized record",
    (f) =>
      truncateSync(
        join(f.pack.path, "observations.json"),
        f.input.admission.maxRecordBytes + 1,
      ),
  ],
  [
    "changed exact bytes",
    (f) => appendFileSync(join(f.pack.path, "observations.json"), " "),
  ],
])
  test(
    `preflight rejects ${name} before encrypted storage writes`,
    POSIX,
    async (t) => {
      const f = await fixture(t, { publish: false });
      mutate(f);
      assert.throws(() => inspect(f.input));
      assert.equal(readdirSync(f.dirs.primary).length, 0);
    },
  );
test("real foreign-owner file is rejected", {
  skip:
    POSIX.skip ||
    (process.getuid?.() !== 0 ? "chown requires root fixture" : false),
}, async (t) => {
  const f = await fixture(t, { publish: false });
  chownSync(join(f.pack.path, "observations.json"), 65534, 65534);
  assert.throws(() => inspect(f.input), /PERMISSIONS|EVIDENCE|EACCES/);
});
test("symlinked root cannot be admitted", POSIX, async (t) => {
  const f = await fixture(t, { publish: false });
  const alias = join(f.scratch, "alias");
  symlinkSync(f.dirs.source, alias);
  assert.throws(() => inspect({ ...f.input, sourceRoot: alias }), /ROOT/);
});
test(
  "TOCTOU file substitution during read is detected with pinned directory descriptors",
  POSIX,
  async (t) => {
    const f = await fixture(t, { publish: false });
    const dir = new Directory(f.pack.path);
    const original = fs.readSync;
    let swapped = false;
    fs.readSync = (...args) => {
      const n = original(...args);
      if (!swapped) {
        swapped = true;
        const p = join(f.pack.path, "observations.json");
        renameSync(p, join(f.scratch, "original"));
        writeFileSync(p, "{}", { mode: 0o600 });
      }
      return n;
    };
    syncBuiltinESMExports();
    try {
      assert.throws(() => dir.read("observations.json", 4096), /CHANGED/);
    } finally {
      fs.readSync = original;
      syncBuiltinESMExports();
      dir.close();
    }
  },
);
test(
  "late writers and a missing writer revocation fail closed",
  POSIX,
  async (t) => {
    const f = await fixture(t, { publish: false });
    f.input.teardown.writersRevoked = false;
    assert.throws(() => inspect(f.input), /WRITERS_NOT_REVOKED/);
    f.input.teardown.writersRevoked = true;
    appendFileSync(join(f.pack.path, "observations.json"), "x");
    assert.throws(() => f.publish());
  },
);
test(
  "a re-sealed writer substitution cannot replace the prior independent witness",
  POSIX,
  async (t) => {
    const f = await fixture(t, { publish: false });
    const path = join(f.pack.path, "observations.json");
    writeFileSync(path, bytes({ changed: true }));
    const indexPath = join(f.pack.path, "index.json");
    const index = parse(indexPath);
    const row = index.entries.find((r) => r.id === "observations");
    row.bytes = readFileSync(path).length;
    row.sha256 = sha(readFileSync(path));
    writeFileSync(indexPath, bytes(index));
    f.input.packs[0].indexSha256 = sha(bytes(index));
    assert.throws(() => f.publish(), /WITNESS_MISMATCH/);
  },
);

for (const change of [
  "bitflip",
  "truncate",
  "append",
  "delete",
  "missing-index",
  "extra",
  "metadata",
])
  test(
    `stored ${change} cannot restore and leaves an incident`,
    POSIX,
    async (t) => {
      const f = await fixture(t);
      const version = f.versions.find((v) => v.domainId === "primary");
      const root = join(f.dirs.primary, version.versionId);
      const path = join(root, "blob.bin");
      if (change === "bitflip") {
        const v = readFileSync(path);
        v[v.length - 20] ^= 1;
        writeFileSync(path, v);
      }
      if (change === "truncate") truncateSync(path, version.bytes - 1);
      if (change === "append") appendFileSync(path, "x");
      if (change === "delete") rmSync(path);
      if (change === "missing-index") rmSync(join(root, "ready.json"));
      if (change === "extra") save(join(root, "unindexed.json"), {});
      if (change === "metadata") {
        const receipt = parse(join(root, "receipt.json"));
        receipt.manifestSha256 = sha("wrong");
        writeFileSync(join(root, "receipt.json"), bytes(receipt));
      }
      const config = readerConfig(f);
      const child = childReader(config.configPath);
      assert.equal(child.status, 1);
      assert.equal(JSON.parse(child.stdout).status, "NOT_VERIFIED");
      const journal = new Journal(f.dirs["reader-journal"]);
      try {
        assert.ok(journal.rows.some((r) => r.payload.type === "INCIDENT"));
      } finally {
        journal.close();
      }
      assert.equal(existsSync(root), true);
    },
  );
test(
  "AEAD catches modified payload even if writer-side hashes are recomputed",
  POSIX,
  async (t) => {
    const f = await fixture(t);
    const blob = f.stores[0].get(f.versions[0]);
    blob[blob.length - 20] ^= 1;
    assert.throws(() =>
      decrypt(
        blob,
        f.witness.payload,
        f.witness.payload.catalog.packs[0],
        "reader",
        f.k.reader.privateKey,
      ),
    );
  },
);
test(
  "wrong key, wrong identity, wrong witness, missing prior commitment are not verified",
  POSIX,
  async (t) => {
    const f = await fixture(t);
    assert.throws(
      () => f.restore(0, { privateKey: f.k.escrow.privateKey }),
      /KEY_POLICY/,
    );
    assert.throws(
      () =>
        f.restore(0, { trust: { ...f.trust, witnessSha256: sha("wrong") } }),
      /WITNESS/,
    );
    assert.throws(
      () => f.restore(0, { trust: { ...f.trust, witnessSha256: undefined } }),
      /HASH/,
    );
    const modified = structuredClone(f.witness);
    modified.payload.catalog.identity.epochId = "wrong-epoch";
    assert.throws(
      () =>
        verifyCatalogWitness(modified, f.k.witness.publicKey, digest(modified)),
      /SIGNATURE/,
    );
    const blob = f.stores[0].get(f.versions[0]);
    for (const field of [
      "runId",
      "epochId",
      "candidateCommitment",
      "attemptId",
    ]) {
      const frozen = structuredClone(f.witness.payload);
      frozen.catalog.identity[field] = "wrong";
      assert.throws(
        () =>
          decrypt(
            blob,
            frozen,
            frozen.catalog.packs[0],
            "reader",
            f.k.reader.privateKey,
          ),
        /BINDING/,
      );
    }
  },
);
for (const lost of [0, 1])
  test(
    `lost ${lost === 0 ? "primary" : "secondary"}: other copy restores independently`,
    POSIX,
    async (t) => {
      const f = await fixture(t);
      rmSync(f.storeConfigs[lost].root, { recursive: true });
      assert.throws(() => f.restore(lost));
      assert.equal(f.restore(1 - lost).status, "SIMULATED_RESTORED");
    },
  );
for (const failAt of ["WRITE", "FSYNC", "PUBLISH", "RECEIPT"])
  test(
    `interrupted ${failAt} publication remains immutable incomplete; no retry overwrite`,
    POSIX,
    async (t) => {
      const f = await fixture(t, { publish: false });
      const store = f.stores[0];
      assert.throws(
        () =>
          store.put(
            "synthetic-pack",
            Buffer.from("synthetic-cipher"),
            {
              manifestSha256: f.witness.payload.manifestSha256,
              witnessRef: f.input.identity.witnessRef,
            },
            { versionId: "interrupted", failAt },
          ),
        /INTERRUPTED/,
      );
      assert.throws(
        () =>
          store.put(
            "synthetic-pack",
            Buffer.from("retry"),
            {
              manifestSha256: f.witness.payload.manifestSha256,
              witnessRef: f.input.identity.witnessRef,
            },
            { versionId: "interrupted" },
          ),
        /EEXIST/,
      );
      assert.ok(existsSync(join(f.dirs.primary, "interrupted")));
    },
  );
test(
  "duplicate immutable version and duplicate nonce reservation are rejected",
  POSIX,
  async (t) => {
    const f = await fixture(t);
    assert.throws(
      () =>
        f.stores[0].put(
          "synthetic-pack",
          Buffer.from("x"),
          {
            manifestSha256: f.witness.payload.manifestSha256,
            witnessRef: f.input.identity.witnessRef,
          },
          { versionId: f.versions[0].versionId },
        ),
      /EEXIST/,
    );
    const dir = new Directory(f.dirs.nonces);
    try {
      const name = dir.names()[0];
      assert.throws(
        () => dir.publish(name, bytes({ allocated: true })),
        /EEXIST/,
      );
    } finally {
      dir.close();
    }
  },
);
test(
  "two copies cannot alias the same root/domain/principal",
  POSIX,
  async (t) => {
    const f = await fixture(t, { publish: false });
    assert.throws(
      () =>
        publish({
          input: f.input,
          witness: f.witness,
          witnessPublicKey: f.k.witness.publicKey,
          expectedWitnessSha256: f.trust.witnessSha256,
          stores: [f.stores[0], f.stores[0]],
          nonceRoot: f.dirs.nonces,
          journal: f.writerJournal,
        }),
      /STORAGE_DOMAIN/,
    );
  },
);
test(
  "malicious single-admin/root capability never establishes independent physical custody",
  POSIX,
  async (t) => {
    const f = await fixture(t);
    const configs = f.storeConfigs.map((c) => ({
      ...c,
      administrator: "candidate-admin",
    }));
    const assessed = assessCustody(configs, "candidate-admin");
    assert.equal(assessed.physical, "NOT_DEPLOYED");
    assert.equal(assessed.independence, "NOT_ESTABLISHED");
    assert.equal(assessed.sharedAdministrator, true);
    assert.equal(assessed.candidateAdministratorControlsCopy, true);
    assert.throws(
      () => new LocalStore({ ...configs[0], deployment: "REAL" }),
      /NOT_DEPLOYED/,
    );
  },
);
test("actual unprivileged child cannot read source or private key; receives no keys/env", {
  skip:
    POSIX.skip ||
    (process.getuid?.() !== 0 ? "requires root to select uid 65534" : false),
}, async (t) => {
  const f = await fixture(t);
  const keyPath = join(f.dirs.witness, "escrow-private.pem");
  writeFileSync(keyPath, f.k.escrow.privateKey, { mode: 0o600 });
  const script =
    "const fs=require('node:fs'); for(const p of process.argv.slice(1)){try{fs.readFileSync(p);process.exit(2)}catch(e){if(e.code!=='EACCES')process.exit(3)}} if(Object.keys(process.env).length)process.exit(4)";
  const child = spawnSync(
    process.execPath,
    ["-e", script, join(f.pack.path, "observations.json"), keyPath],
    { encoding: "utf8", env: {}, uid: 65534, gid: 65534, cwd: "/tmp" },
  );
  assert.equal(child.status, 0, child.stderr);
});
test(
  "restricted escrow recovery needs an unexpired unrevoked signed delegate grant",
  POSIX,
  async (t) => {
    const f = await fixture(t);
    const at = now();
    const grant = signed(
      {
        format: "mmp-evidence-recovery-grant-v1",
        action: "RECOVER",
        witnessRef: f.input.identity.witnessRef,
        principal: "escrow",
        grantId: "grant-one",
        notBefore: f.input.identity.terminalReceiptAt,
        expiresAt: new Date(Date.now() + DAY).toISOString(),
      },
      f.k.witness.privateKey,
    );
    const changes = {
      principal: "escrow",
      privateKey: f.k.escrow.privateKey,
      now: at,
      grant,
      trust: { ...f.trust, grantSha256: digest(grant) },
    };
    assert.throws(
      () => f.restore(0, { ...changes, grant: null }),
      /RECOVERY_NOT_AUTHORIZED/,
    );
    assert.throws(
      () => f.restore(0, { ...changes, revoked: ["grant-one"] }),
      /RECOVERY_NOT_AUTHORIZED/,
    );
    assert.throws(
      () =>
        f.restore(0, {
          ...changes,
          now: new Date(Date.now() + 2 * DAY).toISOString(),
        }),
      /RECOVERY_NOT_AUTHORIZED/,
    );
    assert.equal(f.restore(1, changes).status, "SIMULATED_RESTORED");
  },
);
test(
  "journal external checkpoint detects history truncation, byte tamper and clock rollback",
  POSIX,
  async (t) => {
    const f = await fixture(t);
    const journal = new Journal(f.dirs.policy);
    journal.append({ type: "GRANT" }, START);
    const checkpoint = journal.checkpoint();
    assert.throws(
      () => journal.append({ type: "ACCESS" }, "2026-10-27T22:00:00.000Z"),
      /CLOCK_ROLLBACK/,
    );
    assert.equal(journal.rows.at(-1).payload.code, "CLOCK_ROLLBACK");
    assert.throws(() => journal.verify(checkpoint), /ROLLBACK/);
    journal.close();
    const path = join(f.dirs.policy, "000001.json");
    rmSync(path);
    const reopened = new Journal(f.dirs.policy);
    try {
      assert.throws(
        () => reopened.verify({ ...checkpoint, count: 2 }),
        /ROLLBACK/,
      );
    } finally {
      reopened.close();
    }
    appendFileSync(join(f.dirs.policy, "000000.json"), "x");
    assert.throws(() => new Journal(f.dirs.policy));
  },
);
test(
  "journal budgets reserve failure overhead and cannot overflow silently",
  POSIX,
  async (t) => {
    const f = await fixture(t);
    const journal = new Journal(f.dirs.policy, 4096);
    try {
      assert.throws(() => journal.reserve(), /JOURNAL_BUDGET/);
    } finally {
      journal.close();
    }
  },
);
test(
  "storage witness requires all packs on both independently opened stores",
  POSIX,
  async (t) => {
    const f = await fixture(t);
    assert.throws(
      () =>
        witnessStorage({
          witness: f.witness,
          witnessPublicKey: f.k.witness.publicKey,
          expectedWitnessSha256: f.trust.witnessSha256,
          versions: f.versions.slice(0, 1),
          stores: f.stores,
          signingPrivateKey: f.k.witness.privateKey,
          observedAt: now(),
        }),
      /COVERAGE/,
    );
  },
);

test(
  "multiple bounded packs include earlier failed/partial attempts in the exact root catalog",
  POSIX,
  async (t) => {
    const f = await fixture(t, { publish: false });
    const partial = new PrivateEvidence(f.dirs.source, process.cwd(), {
      synthetic: true,
    });
    partial.write("primary-error", { synthetic: true, code: "REQUEST_ERROR" });
    partial.write("secondary-error", {
      synthetic: true,
      code: "TEARDOWN_ERROR",
    });
    const earlier = new Date(
      Date.parse(f.input.identity.terminalReceiptAt) - 60_000,
    ).toISOString();
    f.input.packs.push({
      ...f.input.packs[0],
      id: "earlier-partial",
      relativePath: partial.path.split("/").at(-1),
      attemptId: "earlier-attempt",
      terminalReceiptAt: earlier,
      pairId: "earlier-pair",
      indexSha256: partial.seal(),
      status: "INCOMPLETE",
      outcome: "ERROR",
    });
    f.freeze();
    f.publish();
    assert.equal(f.witness.payload.catalog.attempts.length, 2);
    assert.equal(f.witness.payload.catalog.status, "INCOMPLETE");
    assert.equal(f.versions.length, 4);
    rmSync(f.dirs.source, { recursive: true });
    assert.equal(f.restore(0).packCount, 2);
    assert.equal(f.restore(1).packCount, 2);
  },
);
test(
  "exact byte budget is admitted; one-byte overflow fails before any copy write",
  POSIX,
  async (t) => {
    const f = await fixture(t, { publish: false });
    const inspected = inspect(f.input);
    const count = inspected.catalog.totalBytes;
    f.input.admission.maxPackBytes = count;
    f.input.admission.maxTotalBytes = count;
    f.freeze();
    f.publish();
    assert.equal(f.restore().status, "SIMULATED_RESTORED");
    f.input.admission.maxPackBytes = count - 1;
    assert.throws(() => inspect(f.input), /BUDGET/);
  },
);
test(
  "encryption refuses a reused nonce and records the primary incident",
  POSIX,
  async (t) => {
    const f = await fixture(t);
    const nonce = Buffer.from(
      readdirSync(f.dirs.nonces)[0].split(".")[0],
      "hex",
    );
    const original = crypto.randomBytes;
    crypto.randomBytes = (size) => (size === 12 ? nonce : original(size));
    syncBuiltinESMExports();
    try {
      assert.throws(() => f.publish(), /EEXIST/);
    } finally {
      crypto.randomBytes = original;
      syncBuiltinESMExports();
    }
    assert.ok(f.writerJournal.rows.some((r) => r.payload.type === "INCIDENT"));
    assert.equal(readdirSync(f.dirs.primary).length, 1);
  },
);
test(
  "partial secondary write preserves the complete primary, partial secondary and incident",
  POSIX,
  async (t) => {
    const f = await fixture(t, { publish: false });
    const original = f.stores[1].put.bind(f.stores[1]);
    f.stores[1].put = (p, blob, binding) =>
      original(p, blob, binding, { failAt: "WRITE" });
    assert.throws(() => f.publish(), /INTERRUPTED/);
    assert.equal(readdirSync(f.dirs.primary).length, 1);
    assert.equal(readdirSync(f.dirs.secondary).length, 1);
    assert.equal(f.writerJournal.rows.at(-1).payload.retainedVersions, 1);
  },
);
test(
  "secondary audit failure never hides the primary storage error",
  POSIX,
  async (t) => {
    const f = await fixture(t, { publish: false });
    const primary = new Error("synthetic-primary");
    const secondary = new Error("synthetic-secondary-audit");
    f.stores[0].put = () => {
      throw primary;
    };
    const append = f.writerJournal.append.bind(f.writerJournal);
    f.writerJournal.append = (p, at) => {
      if (p.type === "INCIDENT") throw secondary;
      return append(p, at);
    };
    assert.throws(
      () => f.publish(),
      (e) => e === primary && e.secondaryErrors[0] === secondary,
    );
  },
);
test(
  "AEAD tag and suite downgrades fail; recipient rekey is not authorized",
  POSIX,
  async (t) => {
    const f = await fixture(t);
    const original = f.stores[0].get(f.versions[0]);
    const corrupted = Buffer.from(original);
    corrupted[corrupted.length - 1] ^= 1;
    assert.throws(() =>
      decrypt(
        corrupted,
        f.witness.payload,
        f.witness.payload.catalog.packs[0],
        "reader",
        f.k.reader.privateKey,
      ),
    );
    const metaSize = original.readUInt32BE(8);
    const meta = JSON.parse(original.subarray(12, 12 + metaSize));
    meta.suite = meta.suite.replace("256", "128");
    const downgraded = Buffer.from(original);
    bytes(meta).copy(downgraded, 12);
    assert.throws(
      () =>
        decrypt(
          downgraded,
          f.witness.payload,
          f.witness.payload.catalog.packs[0],
          "reader",
          f.k.reader.privateKey,
        ),
      /BINDING/,
    );
    const replacement = structuredClone(f.witness);
    replacement.payload.recipients[0].publicKey = f.k.escrow.publicKey;
    assert.throws(
      () =>
        verifyCatalogWitness(
          replacement,
          f.k.witness.publicKey,
          digest(replacement),
        ),
      /SIGNATURE/,
    );
  },
);
test(
  "public-key admission refuses private-key material and weak RSA recipients",
  POSIX,
  async (t) => {
    const f = await fixture(t, { publish: false });
    f.recipients[0].publicKey = f.k.reader.privateKey;
    assert.throws(() => f.freeze(), /KEY_POLICY/);
    const weak = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    f.recipients[0].publicKey = weak.publicKey;
    assert.throws(() => f.freeze(), /KEY_POLICY/);
  },
);
test(
  "delegated escrow restores in a separate child after original source teardown",
  POSIX,
  async (t) => {
    const f = await fixture(t);
    const grant = signed(
      {
        format: "mmp-evidence-recovery-grant-v1",
        action: "RECOVER",
        witnessRef: f.input.identity.witnessRef,
        principal: "escrow",
        grantId: "child-grant",
        notBefore: f.input.identity.terminalReceiptAt,
        expiresAt: new Date(Date.now() + DAY).toISOString(),
      },
      f.k.witness.privateKey,
    );
    const grantPath = join(f.dirs["reader-admin"], "grant.json");
    save(grantPath, grant);
    const privateKeyPath = join(f.dirs["reader-admin"], "delegate.pem");
    writeFileSync(privateKeyPath, f.k.escrow.privateKey, { mode: 0o600 });
    const c = readerConfig(f, 1, {
      principal: "escrow",
      privateKeyPath,
      grantPath,
      grantSha256: digest(grant),
    });
    rmSync(f.dirs.source, { recursive: true });
    const result = childReader(c.configPath);
    assert.equal(result.status, 0, result.stdout);
    assert.equal(JSON.parse(result.stdout).status, "SIMULATED_RESTORED");
  },
);
