import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { DAY, digest } from "../src/core.mjs";
import { signed } from "../src/crypto.mjs";
import { childReader, fixture, POSIX, readerConfig, save } from "./fixture.mjs";

function recovery(f, grantId = "security-grant") {
  const grant = signed(
    {
      format: "mmp-evidence-recovery-grant-v1",
      action: "RECOVER",
      witnessRef: f.input.identity.witnessRef,
      identitySha256: digest(f.input.identity),
      principal: "escrow",
      purpose: "IMMEDIATE",
      grantId,
      notBefore: f.input.identity.terminalReceiptAt,
      expiresAt: new Date(Date.now() + DAY).toISOString(),
    },
    f.k.witness.privateKey,
  );
  const grantPath = join(f.dirs["reader-admin"], `${grantId}.json`);
  save(grantPath, grant);
  const privateKeyPath = join(f.dirs["reader-admin"], `${grantId}.pem`);
  writeFileSync(privateKeyPath, f.k.escrow.privateKey, { mode: 0o600 });
  return {
    principal: "escrow",
    grantPath,
    privateKeyPath,
    grantSha256: digest(grant),
    revoked: [],
  };
}

function denyChild(f, c) {
  const names = readdirSync(f.dirs.restore);
  const result = childReader(c.configPath);
  assert.equal(result.status, 1, result.stdout);
  assert.match(
    JSON.parse(result.stdout).code,
    /RECOVERY_(NOT_AUTHORIZED|AUTHORITY_UNAVAILABLE)/,
  );
  assert.deepEqual(readdirSync(f.dirs.restore), names);
  assert.equal(existsSync(c.config.receiptPath), false);
  assert.doesNotMatch(
    result.stdout,
    /security-grant|escrow|PRIVATE|signature|\/tmp\/|stack|CANARY/,
  );
}
test(
  "B1 forged signed revocation and signed scope substitution cannot alter authority",
  POSIX,
  async (t) => {
    const f = await fixture(t);
    const c = readerConfig(f, 0, recovery(f));
    const writer = f.ledger();
    try {
      const body = { type: "GRANT_REVOKED", grantId: "security-grant" },
        at = new Date().toISOString();
      const proof = {
        format: "mmp-policy-event-v1",
        contextSha256: digest(f.context()),
        previous: writer.journal.checkpoint(),
        at,
        payloadSha256: digest(body),
      };
      for (const authorization of [
        signed(proof, f.k.owner1.privateKey),
        signed(
          { ...proof, contextSha256: "0".repeat(64) },
          f.k.witness.privateKey,
        ),
        signed(
          { ...proof, payloadSha256: "0".repeat(64) },
          f.k.witness.privateKey,
        ),
      ])
        assert.throws(
          () => writer.journal.append({ ...body, authorization }, at),
          /SIGNATURE|EVENT_AUTHORITY/,
        );
      assert.equal(writer.state().revoked.size, 0);
    } finally {
      writer.close();
    }
    assert.equal(childReader(c.configPath).status, 0);
  },
);
test(
  "B2 replayed signed event at a different journal prefix fails independently",
  POSIX,
  async (t) => {
    const f = await fixture(t);
    const ledger = f.ledger();
    ledger.recordRestore(signed(f.restore(), f.k.receipt.privateKey));
    const payload = ledger.journal.rows.at(-1).payload;
    ledger.hold("active-hold");
    const prior = ledger.journal.rows.at(-1);
    const seq = ledger.journal.rows.length;
    save(join(f.dirs.policy, `${String(seq).padStart(6, "0")}.json`), {
      seq,
      at: prior.at,
      previousSha256: digest(prior),
      payload,
    });
    ledger.close();
    assert.throws(() => f.ledger(), /EVENT_AUTHORITY/);
  },
);
test(
  "B2 authentic recovery of INCOMPLETE evidence cannot produce G4 or product PASS",
  POSIX,
  async (t) => {
    const f = await fixture(t, {
      aborted: true,
      terminal: new Date(Date.now() - 89.5 * DAY).toISOString(),
    });
    const ledger = f.ledger();
    try {
      for (const domain of [0, 1]) {
        const c = readerConfig(f, domain, { purpose: "DAY90" });
        const result = childReader(c.configPath);
        assert.equal(result.status, 0);
        assert.equal(JSON.parse(result.stdout).PRODUCT, "NOT_ESTABLISHED");
        ledger.recordRestore(JSON.parse(readFileSync(c.config.receiptPath)));
      }
      assert.equal(f.witness.payload.catalog.status, "INCOMPLETE");
      assert.equal(ledger.status().day90, "SIMULATED_VERIFIED");
      assert.equal(ledger.status().G4, "INCONCLUSIVE");
    } finally {
      ledger.close();
    }
  },
);
test(
  "B1 restarted readers deny revoked grant but unrelated unrevoked grant works",
  POSIX,
  async (t) => {
    const f = await fixture(t);
    const old = readerConfig(f, 0, recovery(f));
    const writer = f.ledger();
    writer.revoke("security-grant");
    writer.close();
    denyChild(f, old);
    denyChild(f, old);
    const other = readerConfig(f, 1, recovery(f, "unrelated-grant"));
    assert.equal(childReader(other.configPath).status, 0);
  },
);
for (const fault of [
  "stale-signed",
  "missing-anchor",
  "wrong-checkpoint",
  "forged-signature",
  "wrong-scope",
  "missing-pin",
  "missing-authority",
])
  test(`B1 ${fault} authority fails before plaintext`, POSIX, async (t) => {
    const f = await fixture(t);
    const c = readerConfig(f, 0, recovery(f));
    const root = f.dirs["authority-anchor"];
    const old = readFileSync(join(root, "000000.json"));
    const writer = f.ledger();
    writer.revoke("different-grant");
    writer.close();
    const name = readdirSync(root).at(-1),
      path = join(root, name);
    if (fault === "stale-signed") writeFileSync(path, old);
    if (fault === "missing-anchor") rmSync(path);
    if (["wrong-checkpoint", "forged-signature"].includes(fault)) {
      const r = JSON.parse(readFileSync(path));
      if (fault === "wrong-checkpoint") {
        r.payload.checkpoint.sha256 = "0".repeat(64);
        writeFileSync(
          path,
          JSON.stringify(signed(r.payload, f.k.witness.privateKey)),
        );
      } else {
        r.signature = "AAAA";
        writeFileSync(path, JSON.stringify(r));
      }
    }
    if (fault === "wrong-scope")
      c.config.recoveryAuthority.context.identity.epochId = "wrong-epoch";
    if (fault === "missing-pin")
      delete c.config.recoveryAuthority.anchorIdentity;
    if (fault === "missing-authority") delete c.config.recoveryAuthority;
    writeFileSync(c.configPath, JSON.stringify(c.config));
    denyChild(f, c);
  });
test(
  "B1 rolled-back journal and substituted anchor directory are rejected",
  POSIX,
  async (t) => {
    const f = await fixture(t);
    const c = readerConfig(f, 0, recovery(f));
    const writer = f.ledger();
    writer.revoke("different-grant");
    writer.close();
    rmSync(join(f.dirs.policy, readdirSync(f.dirs.policy).at(-1)));
    denyChild(f, c);
    c.config.recoveryAuthority.anchorIdentity.ino = "0";
    writeFileSync(c.configPath, JSON.stringify(c.config));
    denyChild(f, c);
  },
);
test(
  "B1 invalid grant scope, purpose, signature or bytes cannot authorize recovery",
  POSIX,
  async (t) => {
    const f = await fixture(t);
    const fields = recovery(f);
    const original = JSON.parse(readFileSync(fields.grantPath));
    for (const change of [
      { identitySha256: "0".repeat(64) },
      { purpose: "DAY90" },
      { principal: "reader" },
      { witnessRef: "wrong-witness" },
    ]) {
      const r = signed(
        { ...original.payload, ...change },
        f.k.witness.privateKey,
      );
      writeFileSync(fields.grantPath, JSON.stringify(r));
      denyChild(f, readerConfig(f, 0, { ...fields, grantSha256: digest(r) }));
    }
    const bad = { ...original, signature: "AAAA" };
    writeFileSync(fields.grantPath, JSON.stringify(bad));
    denyChild(f, readerConfig(f, 0, { ...fields, grantSha256: digest(bad) }));
  },
);
test(
  "B1 access lock linearizes revocation through plaintext and signed receipt publication",
  POSIX,
  async (t) => {
    const f = await fixture(t);
    const fields = recovery(f);
    const grant = JSON.parse(readFileSync(fields.grantPath));
    f.authority();
    const writerConfig = join(f.dirs["reader-admin"], "writer.json");
    save(writerConfig, f.policyOptions());
    const moduleUrl = new URL("../src/lifecycle.mjs", import.meta.url).href;
    const script = `import {RetentionLedger} from ${JSON.stringify(moduleUrl)};import {readFileSync} from 'node:fs';try{const l=new RetentionLedger(JSON.parse(readFileSync(process.argv[1])));l.revoke('security-grant');l.close();process.exitCode=2;}catch(e){if(e.code!=='EEXIST')process.exitCode=3;}`;
    const original = f.stores[0].get.bind(f.stores[0]);
    let observed = false;
    f.stores[0].get = (receipt) => {
      const child = spawnSync(
        process.execPath,
        ["--input-type=module", "-e", script, writerConfig],
        { env: {}, encoding: "utf8", timeout: 20_000 },
      );
      assert.equal(child.status, 0, child.stderr);
      observed = true;
      return original(receipt);
    };
    assert.equal(
      f.restore(0, {
        principal: "escrow",
        privateKey: f.k.escrow.privateKey,
        grant,
        trust: { ...f.trust, grantSha256: digest(grant) },
      }).status,
      "SIMULATED_RESTORED",
    );
    assert.ok(observed);
    const writer = f.ledger();
    writer.revoke("security-grant");
    writer.close();
    denyChild(f, readerConfig(f, 1, fields));
  },
);
test(
  "B2 generic admission rejects all privilege-bearing event types",
  POSIX,
  async (t) => {
    const f = await fixture(t);
    const ledger = f.ledger();
    try {
      for (const type of [
        "RESTORE_RECEIPT",
        "HOLD_RELEASE",
        "DELETION_AUTHORIZED",
        "DELETION_VERIFIED",
        "GRANT_REVOKED",
        "RESTORE_VERIFIED",
        "RETENTION_POLICY",
      ]) {
        assert.throws(() => ledger.append({ type }), /EVENT_AUTHORITY/);
        const journal = f.policyJournal();
        try {
          assert.throws(() => journal.append({ type }), /EVENT_AUTHORITY/);
        } finally {
          journal.close();
        }
      }
    } finally {
      ledger.close();
    }
  },
);
for (const type of [
  "RESTORE_RECEIPT",
  "HOLD_RELEASE",
  "DELETION_AUTHORIZED",
  "GRANT_REVOKED",
])
  test(
    `B2 persisted unsigned ${type} rejected on restart and replay`,
    POSIX,
    async (t) => {
      const f = await fixture(t);
      const l = f.ledger();
      l.hold("active-hold");
      const prior = l.journal.rows.at(-1),
        seq = l.journal.rows.length;
      const row = {
        seq,
        at: prior.at,
        previousSha256: digest(prior),
        payload: {
          type,
          holdId: "active-hold",
          purpose: "DAY90",
          domainId: "primary",
          restoredAt: prior.at,
          receiptSha256: "0".repeat(64),
        },
      };
      save(join(f.dirs.policy, `${String(seq).padStart(6, "0")}.json`), row);
      l.close();
      assert.throws(() => f.ledger(), /EVENT_AUTHORITY/);
    },
  );
test(
  "B2 full signed receipts revalidate on restart; duplicates and changed binding fail",
  POSIX,
  async (t) => {
    const f = await fixture(t, {
      oracle: true,
      terminal: new Date(Date.now() - 89.5 * DAY).toISOString(),
    });
    let ledger = f.ledger();
    const records = [];
    rmSync(f.dirs.source, { recursive: true });
    rmSync(f.dirs.raw, { recursive: true });
    for (const domain of [0, 1]) {
      const c = readerConfig(f, domain, { purpose: "DAY90" });
      const result = childReader(c.configPath);
      assert.equal(result.status, 0, result.stdout);
      const record = JSON.parse(readFileSync(c.config.receiptPath));
      records.push(record);
      ledger.recordRestore(record);
      if (domain === 0) {
        assert.notEqual(ledger.status().day90, "SIMULATED_VERIFIED");
        assert.equal(ledger.dueTasks().length, 1);
      }
    }
    assert.equal(ledger.status().day90, "SIMULATED_VERIFIED");
    assert.equal(ledger.dueTasks().length, 0);
    assert.throws(() => ledger.recordRestore(records[0]), /EVENT_RESTORE/);
    for (const change of [
      { identitySha256: "0".repeat(64) },
      { domainId: "other" },
      { manifestSha256: "0".repeat(64) },
      { versions: [] },
      { fileCount: 0 },
    ])
      assert.throws(
        () =>
          ledger.recordRestore(
            signed(
              { ...records[0].payload, ...change },
              f.k.receipt.privateKey,
            ),
          ),
        /RESTORE_RECEIPT/,
      );
    assert.throws(
      () =>
        ledger.recordRestore(signed(records[0].payload, f.k.owner1.privateKey)),
      /SIGNATURE/,
    );
    ledger.close();
    ledger = f.ledger();
    try {
      assert.equal(ledger.status().day90, "SIMULATED_VERIFIED");
      assert.equal(ledger.status().G4, "INCONCLUSIVE");
    } finally {
      ledger.close();
    }
  },
);
test(
  "B1 unchanged pre-revoke config cannot export plaintext after authority revocation",
  POSIX,
  async (t) => {
    const f = await fixture(t);
    const c = readerConfig(f, 1, recovery(f));
    const first = childReader(c.configPath);
    assert.equal(first.status, 0, first.stdout);
    rmSync(c.config.receiptPath);
    const names = readdirSync(f.dirs.restore);
    const writer = f.ledger();
    try {
      writer.revoke("security-grant");
    } finally {
      writer.close();
    }
    const next = childReader(c.configPath);
    assert.equal(
      next.status,
      1,
      "revoked grant unexpectedly admitted by unchanged config",
    );
    assert.equal(JSON.parse(next.stdout).code, "RECOVERY_NOT_AUTHORIZED");
    assert.deepEqual(readdirSync(f.dirs.restore), names);
    assert.equal(existsSync(c.config.receiptPath), false);
  },
);
test(
  "B2 generic unsigned DAY90 events cannot satisfy status or retire tasks",
  POSIX,
  async (t) => {
    const f = await fixture(t);
    const ledger = f.ledger();
    const at = new Date(
      Date.parse(f.input.identity.terminalReceiptAt) + 90 * DAY,
    ).toISOString();
    try {
      for (const domainId of ["primary", "secondary"]) {
        try {
          ledger.append(
            {
              type: "RESTORE_RECEIPT",
              purpose: "DAY90",
              domainId,
              restoredAt: at,
            },
            at,
          );
        } catch (e) {
          assert.match(e.code, /EVENT|AUTH/);
        }
      }
      assert.notEqual(ledger.status(at).day90, "SIMULATED_VERIFIED");
      assert.equal(ledger.dueTasks(at).length, 2);
    } finally {
      ledger.close();
    }
  },
);
