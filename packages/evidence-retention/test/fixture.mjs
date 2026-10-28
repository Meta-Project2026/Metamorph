import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import {
  MANIFEST,
  PrivateEvidence,
  snapshotSqlite,
  verifyPair,
} from "@metamorph/oracle";
import { retainOracle } from "../../differential/src/oracle-retention.mjs";
import { bytes, digest, sha } from "../src/core.mjs";
import { signed, witnessCatalog } from "../src/crypto.mjs";
import { publish, restore, witnessStorage } from "../src/engine.mjs";
import { Journal } from "../src/journal.mjs";
import { RetentionLedger } from "../src/lifecycle.mjs";
import { LocalStore } from "../src/store.mjs";

export const POSIX = {
  skip:
    process.platform !== "linux"
      ? "Linux owner/mode/procfs required; Windows fails closed"
      : false,
};
export const START = "2026-10-28T22:00:00.000Z";
export const now = () => new Date().toISOString();
export const save = (path, value) =>
  writeFileSync(path, bytes(value), { mode: 0o600, flag: "wx" });
export const parse = (path) => JSON.parse(readFileSync(path, "utf8"));
export const admitted = (changes = {}) => ({
  format: "mmp-evidence-admission-v1",
  maxPacks: 4,
  maxScenariosPerPack: 3,
  maxRequestsPerPack: 17,
  maxPackBytes: 8 * 1024 * 1024,
  maxTotalBytes: 32 * 1024 * 1024,
  maxRecordBytes: 4 * 1024 * 1024,
  maxJournalBytes: 1024 * 1024,
  ...changes,
});
let cached;
export function keys() {
  if (cached) return cached;
  const rsa = () =>
    generateKeyPairSync("rsa", {
      modulusLength: 3072,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
  const ed = () =>
    generateKeyPairSync("ed25519", {
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
  cached = {
    reader: rsa(),
    escrow: rsa(),
    witness: ed(),
    receipt: ed(),
    owner1: ed(),
    owner2: ed(),
    reviewer: ed(),
    primaryCustodian: ed(),
    secondaryCustodian: ed(),
    escrowCustodian: ed(),
    snapshotCustodian: ed(),
  };
  return cached;
}
function adapter(root, name, fail = "") {
  const path = join(root, `${name}.sqlite`);
  const db = new DatabaseSync(path);
  return {
    closed: false,
    async reset() {
      db.exec(
        "DROP TABLE IF EXISTS observations; CREATE TABLE observations (id INTEGER PRIMARY KEY AUTOINCREMENT, method TEXT, path TEXT)",
      );
    },
    async request(input) {
      if (fail === "request") throw new Error("synthetic-raw-private-error");
      db.prepare("INSERT INTO observations(method,path) VALUES (?,?)").run(
        input.method,
        input.path,
      );
      return {
        status: fail === "comparison" ? 201 : 200,
        headers: { "content-type": "application/json" },
        body: Buffer.from('{"synthetic":true}'),
      };
    },
    async snapshot() {
      return snapshotSqlite(path);
    },
    async close() {
      db.close();
      this.closed = true;
      if (fail === "close") throw new Error("synthetic-secondary-error");
    },
  };
}
export async function fixture(t, options = {}) {
  const scratch = mkdtempSync(join(tmpdir(), "mmp055-synthetic-"));
  chmodSync(scratch, 0o700);
  t.after(() => {
    assert.equal(resolve(scratch), scratch);
    assert.ok(scratch.startsWith(join(resolve(tmpdir()), "mmp055-synthetic-")));
    rmSync(scratch, { recursive: true, force: true });
  });
  const dirs = {};
  for (const name of [
    "source",
    "raw",
    "primary",
    "secondary",
    "nonces",
    "writer-journal",
    "reader-journal",
    "reader-admin",
    "restore",
    "witness",
    "policy",
  ]) {
    dirs[name] = join(scratch, name);
    mkdirSync(dirs[name], { mode: 0o700 });
  }
  const k = keys();
  const terminal =
    options.terminal ?? new Date(Date.now() - 1000).toISOString();
  const ident = {
    format: "mmp-evidence-identity-v1",
    runId: "synthetic-run",
    epochId: "synthetic-epoch",
    registrationCommitment: sha("synthetic-registration"),
    candidateCommitment: sha("synthetic-candidate"),
    attemptId: "synthetic-attempt",
    terminalReceiptAt: terminal,
    witnessRef: "synthetic-witness",
    custodyScopeId: "synthetic-custody",
  };
  const pack = new PrivateEvidence(dirs.source, process.cwd(), {
    synthetic: true,
    canary: "SYNTHETIC-PRIVATE-CANARY",
    sourceSha256: sha("synthetic-source"),
    buildSha256: sha("synthetic-build"),
  });
  let result;
  const expectedRaw = new Map();
  if (options.oracle) {
    const reference = adapter(scratch, "reference");
    const candidate = adapter(scratch, "candidate", options.fail);
    const mask = process.umask(0o022);
    try {
      result = await verifyPair({
        reference,
        candidate,
        scenarios: options.scenarios ?? MANIFEST,
        artifactParent: dirs.raw,
        operationTimeoutMs: 1000,
      });
      assert.ok(reference.closed && candidate.closed);
      retainOracle(result, dirs.raw, pack);
    } finally {
      process.umask(mask);
    }
    const catalog = parse(join(pack.path, "oracle-catalog.json"));
    for (const row of catalog.catalog)
      expectedRaw.set(
        row.path,
        readFileSync(join(result.evidenceDirectory, row.path)),
      );
  } else {
    pack.write("observations", {
      bytes: Buffer.from([0, 255, 1, 2, 13, 10]).toString("base64"),
      synthetic: true,
    });
  }
  pack.write("completion", {
    status: options.aborted ? "ABORTED" : "TERMINAL",
    primary: options.fail === "request" ? "REQUEST_ERROR" : null,
    secondary: options.fail === "close" ? "CLEANUP_ERROR" : null,
  });
  const indexSha256 = pack.seal();
  const status = options.oracle
    ? parse(join(pack.path, "oracle-catalog.json")).status
    : options.aborted
      ? "INCOMPLETE"
      : "COMPLETE";
  const outcome = options.aborted
    ? "ABORTED"
    : options.fail && options.fail !== "comparison"
      ? "ERROR"
      : options.fail === "comparison"
        ? "FAIL"
        : "PASS";
  const input = {
    sourceRoot: dirs.source,
    identity: ident,
    admission: admitted(options.admission),
    packs: [
      {
        id: "synthetic-pack",
        attemptId: ident.attemptId,
        terminalReceiptAt: ident.terminalReceiptAt,
        relativePath: pack.path.split("/").at(-1),
        pairId: "synthetic-pair",
        kind: options.oracle ? "ORACLE" : "AUXILIARY",
        indexSha256,
        status,
        outcome,
        custodyScopeId: ident.custodyScopeId,
      },
    ],
    teardown: {
      writersRevoked: true,
      normalTeardown: options.fail === "close" ? "ERROR" : "VERIFIED",
      finalizedAt: terminal,
      primaryErrors: options.fail === "request" ? ["REQUEST_ERROR"] : [],
      secondaryErrors: options.fail === "close" ? ["CLEANUP_ERROR"] : [],
    },
  };
  const recipients = [
    { principal: "reader", role: "READER", publicKey: k.reader.publicKey },
    { principal: "escrow", role: "RECOVERY", publicKey: k.escrow.publicKey },
  ];
  const f = { scratch, dirs, k, input, pack, result, expectedRaw, recipients };
  f.freeze = () => {
    f.witness = witnessCatalog(input, recipients, k.witness.privateKey, now());
    f.trust = {
      witnessPublicKey: k.witness.publicKey,
      witnessSha256: digest(f.witness),
    };
  };
  f.storeConfigs = ["primary", "secondary"].map((domainId) => ({
    deployment: "SYNTHETIC_ONLY",
    root: dirs[domainId],
    domainId,
    principal: `${domainId}-principal`,
    administrator: `${domainId}-admin`,
    failureDomain: `${domainId}-simulated`,
  }));
  f.stores = f.storeConfigs.map((c) => new LocalStore(c));
  t.after(() => {
    for (const s of f.stores) s.close();
  });
  f.writerJournal = new Journal(dirs["writer-journal"]);
  t.after(() => f.writerJournal.close());
  f.publish = () => {
    const result = publish({
      input,
      witness: f.witness,
      witnessPublicKey: k.witness.publicKey,
      expectedWitnessSha256: f.trust.witnessSha256,
      stores: f.stores,
      nonceRoot: dirs.nonces,
      journal: f.writerJournal,
    });
    f.versions = result.versions;
    f.storageWitness = witnessStorage({
      witness: f.witness,
      witnessPublicKey: k.witness.publicKey,
      expectedWitnessSha256: f.trust.witnessSha256,
      versions: f.versions,
      stores: f.stores,
      signingPrivateKey: k.witness.privateKey,
      observedAt: now(),
    });
    f.trust.storageWitnessSha256 = digest(f.storageWitness);
    return result;
  };
  f.restore = (domain = 0, changes = {}) => {
    const journalRoot = join(
      scratch,
      `read-${Math.random().toString(16).slice(2)}`,
    );
    mkdirSync(journalRoot, { mode: 0o700 });
    const journal = new Journal(journalRoot);
    try {
      return restore({
        witness: f.witness,
        storageWitness: f.storageWitness,
        trust: f.trust,
        store: f.stores[domain],
        principal: "reader",
        privateKey: k.reader.privateKey,
        destinationParent: dirs.restore,
        journal,
        ...changes,
      });
    } finally {
      journal.close();
    }
  };
  f.ledger = (at = now()) =>
    new RetentionLedger({
      journalRoot: dirs.policy,
      witness: f.witness,
      storageWitness: f.storageWitness,
      trust: f.trust,
      readerPublicKey: k.receipt.publicKey,
      ownerPublicKeys: [k.owner1.publicKey, k.owner2.publicKey],
      reviewerPublicKey: k.reviewer.publicKey,
      deletionWitnessKeys: {
        primary: k.primaryCustodian.publicKey,
        secondary: k.secondaryCustodian.publicKey,
        escrow: k.escrowCustodian.publicKey,
        snapshots: k.snapshotCustodian.publicKey,
      },
      now: at,
    });
  f.freeze();
  if (options.publish !== false) f.publish();
  return f;
}
export function readerConfig(f, domain = 0, changes = {}) {
  const root = f.dirs["reader-admin"];
  const suffix = `${domain}-${Math.random().toString(16).slice(2)}`;
  const paths = {};
  for (const [name, value] of Object.entries({
    witness: bytes(f.witness),
    storage: bytes(f.storageWitness),
    "witness-public": Buffer.from(f.k.witness.publicKey),
    "reader-private": Buffer.from(f.k.reader.privateKey),
    "receipt-private": Buffer.from(f.k.receipt.privateKey),
  })) {
    paths[name] = join(root, `${name}-${suffix}.json`);
    writeFileSync(paths[name], value, { mode: 0o600, flag: "wx" });
  }
  const config = {
    format: "mmp-evidence-reader-config-v1",
    deployment: "SYNTHETIC_ONLY",
    witnessPath: paths.witness,
    storageWitnessPath: paths.storage,
    witnessPublicKeyPath: paths["witness-public"],
    witnessSha256: f.trust.witnessSha256,
    storageWitnessSha256: f.trust.storageWitnessSha256,
    journalRoot: f.dirs["reader-journal"],
    store: f.storeConfigs[domain],
    principal: "reader",
    privateKeyPath: paths["reader-private"],
    signingKeyPath: paths["receipt-private"],
    destinationParent: f.dirs.restore,
    receiptPath: join(root, `receipt-${suffix}.json`),
    purpose: "IMMEDIATE",
    revoked: [],
    ...changes,
  };
  const configPath = join(root, `config-${suffix}.json`);
  save(configPath, config);
  return { config, configPath };
}
export function childReader(configPath) {
  return spawnSync(
    process.execPath,
    [fileURLToPath(new URL("../src/reader.mjs", import.meta.url)), configPath],
    { encoding: "utf8", env: {}, timeout: 20_000 },
  );
}
export function approval(f, action, at, extra = {}) {
  const payload = {
    format: "mmp-evidence-owner-action-v1",
    action,
    witnessRef: f.input.identity.witnessRef,
    at,
    witnessSha256: f.trust.witnessSha256,
    storageWitnessSha256: f.trust.storageWitnessSha256,
    ...extra,
  };
  return [
    signed(payload, f.k.owner1.privateKey),
    signed(payload, f.k.owner2.privateKey),
  ];
}
