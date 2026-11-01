// Imported only by the existing fast test glob; never by production code.
import assert from "node:assert/strict";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import test from "node:test";
import {
  candidateDigest,
  createResearchHost,
  data,
  decryptTest,
  digest,
  encryptTest,
  filesValidated,
  LIMIT,
  NOTICE,
  readCandidate,
  recipientFingerprint,
} from "./custody.mjs";
import { offlinePreflight, recordedChecks } from "./preflight.mjs";

test("offline preflight computes current request without any fetch and never authorizes a POST", () => {
  const original = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error("NETWORK_MUST_NOT_RUN");
  };
  try {
    const p = offlinePreflight();
    assert.equal(p.readiness, "NO_GO");
    assert.equal(p.modelRequests, 0);
    assert.equal(p.required.G2.length, 17);
    assert.equal(p.required.G3.length, 20);
    assert.equal(p.serializedBytes, 22762);
    assert.equal(p.projection.worstCaseEstimatedUsd, 0.224402);
    assert.equal(p.defaultBudgetAdmits, false);
    assert.equal(p.chargedUsd, null);
    assert.equal(p.recordedChecks.length, 2);
  } finally {
    globalThis.fetch = original;
  }
});
test("recorded receipt tampering, missing coverage, cleanup resources and duplicates fail offline", () => {
  const summary = JSON.parse(
    fs.readFileSync(
      new URL(
        "../mmp-108/evidence/local-f9a7b44/summary.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.equal(recordedChecks(summary).length, 2);
  for (const mutate of [
    (s) => {
      s.headSha = "0".repeat(40);
    },
    (s) => {
      s.driver.sourcePin.commit = "0".repeat(40);
    },
    (s) => {
      s.cases[0].candidateSha = "0".repeat(64);
    },
    (s) => {
      s.cases[0].gates.G1.executedCount = 5;
    },
    (s) => {
      s.cases[0].coverage.http = 16;
    },
    (s) => {
      s.cases[0].cleanup.containers = 1;
    },
    (s) => {
      s.cases[0].finalizer.emergencyRemoved = 1;
    },
    (s) => {
      s.cases[1].gates.G2.verdict = "PASS";
    },
    (s) => {
      s.cases.push(s.cases[0]);
    },
  ]) {
    const copy = structuredClone(summary);
    mutate(copy);
    assert.throws(() => recordedChecks(copy));
  }
});
test("serialized envelope expansion fails before encryption with no plaintext fallback", async (t) => {
  let encrypted = false;
  const f = fixture(t, {
    encrypt: () => {
      encrypted = true;
      throw new Error("MUST_NOT_RUN");
    },
  });
  const content = NOTICE + "\u0001".repeat(200000),
    files = [
      { path: "src/main.ts", content },
      { path: "src/more.ts", content },
    ];
  for (const file of files)
    fs.writeFileSync(join(f.root, file.path), file.content);
  const expected = { ...f.expected, candidateSha: candidateDigest(files) };
  const host = createResearchHost({
    expected,
    publicKey: f.keys.publicKey,
    pinnedFingerprint: recipientFingerprint(f.keys.publicKey),
    encrypt: () => {
      encrypted = true;
    },
  });
  const token = host.admit(f.root, expected, "MIT_ORIGINAL_SYNTHETIC_ONLY");
  assert.equal(
    (await host.capture(token, new AbortController().signal)).state,
    "CAPTURE_FAILED",
  );
  assert.equal(encrypted, false);
});

function removeTemp(path) {
  assert.equal(resolve(path), path);
  assert.equal(dirname(path), resolve(tmpdir()));
  assert.match(basename(path), /^mmp107-(inert|outside)-[a-zA-Z0-9]+$/);
  fs.rmSync(path, { recursive: true, force: true });
}
function fixture(t, options = {}) {
  const root = fs.mkdtempSync(join(tmpdir(), "mmp107-inert-"));
  t.after(() => removeTemp(root));
  fs.mkdirSync(join(root, "src"));
  const files = [
    {
      path: "src/main.ts",
      content: `${NOTICE}export const originalSynthetic = 107;\n`,
    },
  ];
  fs.writeFileSync(join(root, "src/main.ts"), files[0].content, {
    flag: "wx",
    mode: 0o600,
  });
  const expected = {
    runId: "107",
    runAttempt: "1",
    headSha: "1".repeat(40),
    sourceSha: "2".repeat(40),
    candidateSha: candidateDigest(files),
    attemptId: randomUUID(),
  };
  const keys = generateKeyPairSync("x25519");
  const host = createResearchHost({
    expected,
    publicKey: keys.publicKey,
    pinnedFingerprint: recipientFingerprint(keys.publicKey),
    ...options,
  });
  const admit = (claimed = expected, license = "MIT_ORIGINAL_SYNTHETIC_ONLY") =>
    host.admit(root, claimed, license);
  const finalizer = () =>
    host.finalizer({
      identity: expected,
      normalCleanup: true,
      collectorClean: true,
      containers: 0,
      volumes: 0,
      emergencyRemoved: 0,
    });
  return { root, expected, keys, host, files, admit, finalizer };
}
test("synthetic licensed source: exact candidate-only round trip, manifest and immutable identity", async (t) => {
  const f = fixture(t),
    token = f.admit();
  const receipt = await f.host.capture(token, new AbortController().signal);
  assert.equal(receipt.state, "CAPTURED_UNVERIFIED");
  assert.equal(receipt.productionAuthority, "NONE");
  assert.ok(Object.isFrozen(receipt.identity));
  assert.throws(() => {
    receipt.identity.runId = "999";
  });
  assert.throws(() => f.host.exportForMock({ status: "PASS" }));
  const bytes = f.host.exportForMock(f.finalizer());
  assert.equal(digest(bytes), receipt.ciphertextSha256);
  const envelope = decryptTest(bytes, f.keys.privateKey, f.keys.publicKey);
  assert.deepEqual(envelope.identity, f.expected);
  assert.equal(candidateDigest(envelope.files), f.expected.candidateSha);
  assert.deepEqual(
    envelope.files.map(({ path, content, bytes, sha256 }) => ({
      path,
      content,
      bytes,
      sha256,
    })),
    f.files.map((file) => ({
      ...file,
      bytes: Buffer.byteLength(file.content),
      sha256: digest(file.content),
    })),
  );
  assert.deepEqual(Object.keys(envelope).sort(), [
    "files",
    "format",
    "identity",
    "license",
  ]);
  const ack = f.host.mockAcknowledgment({
    identity: f.expected,
    sha256: digest(bytes),
    bytes: bytes.length,
  });
  assert.equal(f.host.finishUpload(ack).state, "STORED_UNVERIFIED");
  assert.equal(f.host.receipt().verification, "UNVERIFIED");
  assert.throws(() => f.host.exportForMock(f.finalizer()));
});
for (const key of [
  "runId",
  "runAttempt",
  "headSha",
  "sourceSha",
  "candidateSha",
  "attemptId",
]) {
  for (const mode of ["missing", "mismatched"])
    test(`${mode} ${key} rejected against independent host identity`, (t) => {
      const f = fixture(t),
        claimed = { ...f.expected };
      if (mode === "missing") delete claimed[key];
      else
        claimed[key] = {
          runId: "108",
          runAttempt: "2",
          headSha: "3".repeat(40),
          sourceSha: "4".repeat(40),
          candidateSha: "5".repeat(64),
          attemptId: randomUUID(),
        }[key];
      assert.throws(() => f.admit(claimed));
      assert.equal(f.host.receipt().state, "CREATED");
    });
}
test("altered bytes, license/scope claims and forged pair build cannot admit", (t) => {
  const f = fixture(t);
  assert.throws(() => f.admit(f.expected, "UNKNOWN"));
  assert.throws(() => f.admit({ ...f.expected, pairBuild: "PASS" }));
  fs.appendFileSync(join(f.root, "src/main.ts"), "// altered");
  assert.throws(() => f.admit());
});
test("path escapes, reference scope, duplicate case-folded entries, missing license and oversize files fail closed", () => {
  for (const path of [
    "../main.ts",
    "/tmp/main.ts",
    "src/../main.ts",
    "src/reference/main.ts",
    "src/con.ts",
    "src/main.js",
  ])
    assert.throws(() => filesValidated([{ path, content: NOTICE }]));
  assert.throws(() =>
    filesValidated([
      { path: "src/main.ts", content: NOTICE },
      { path: "src/Main.ts", content: NOTICE },
    ]),
  );
  assert.throws(() =>
    filesValidated([{ path: "src/main.ts", content: "export {}" }]),
  );
  assert.throws(() =>
    filesValidated([
      { path: "src/main.ts", content: NOTICE + "x".repeat(LIMIT.file) },
    ]),
  );
  assert.throws(() =>
    filesValidated(
      Array.from({ length: 5 }, (_, i) => ({
        path: i ? `src/f${i}.ts` : "src/main.ts",
        content: NOTICE + "x".repeat(LIMIT.file - NOTICE.length),
      })),
    ),
  );
  assert.throws(() =>
    filesValidated(
      Array.from({ length: 65 }, (_, i) => ({
        path: `src/f${i}.ts`,
        content: NOTICE,
      })),
    ),
  );
});
test("hostile getters and proxies rejected without running traps", () => {
  let calls = 0;
  const getter = Object.defineProperty({}, "runId", {
    get() {
      calls++;
      throw new Error("PRIVATE_PATH_CANARY");
    },
    enumerable: true,
  });
  const proxy = new Proxy(
    {},
    {
      ownKeys() {
        calls++;
        throw new Error("PRIVATE_PATH_CANARY");
      },
    },
  );
  for (const v of [getter, proxy, { nested: proxy }, Object.create({ x: 1 })])
    assert.throws(() => data(v));
  assert.equal(calls, 0);
});
test("actual hard links are rejected", (t) => {
  const f = fixture(t);
  fs.linkSync(join(f.root, "src/main.ts"), join(f.root, "src/alias.ts"));
  assert.throws(() => readCandidate(f.root));
});
test("actual directory symlink/junction and linked root are rejected", (t) => {
  const f = fixture(t),
    outside = fs.mkdtempSync(join(tmpdir(), "mmp107-outside-"));
  t.after(() => removeTemp(outside));
  fs.symlinkSync(
    outside,
    join(f.root, "src/escape"),
    process.platform === "win32" ? "junction" : "dir",
  );
  assert.throws(() => readCandidate(f.root));
  fs.symlinkSync(
    f.root,
    join(outside, "root"),
    process.platform === "win32" ? "junction" : "dir",
  );
  assert.throws(() => readCandidate(join(outside, "root")));
});
test("read-time mutation is rejected by fd/path stability checks", (t) => {
  const f = fixture(t),
    original = fs.readSync;
  let mutated = false;
  try {
    fs.readSync = (...args) => {
      const n = original(...args);
      if (!mutated) {
        mutated = true;
        fs.appendFileSync(join(f.root, "src/main.ts"), "// race");
      }
      return n;
    };
    syncBuiltinESMExports();
    assert.throws(() => readCandidate(f.root));
    assert.equal(mutated, true);
  } finally {
    fs.readSync = original;
    syncBuiltinESMExports();
  }
});
test("admitted snapshot cannot be replaced by later disk changes", async (t) => {
  const f = fixture(t),
    token = f.admit();
  fs.appendFileSync(join(f.root, "src/main.ts"), "// later");
  await f.host.capture(token, new AbortController().signal);
  const envelope = decryptTest(
    f.host.exportForMock(f.finalizer()),
    f.keys.privateKey,
    f.keys.publicKey,
  );
  assert.equal(candidateDigest(envelope.files), f.expected.candidateSha);
});
test("missing or substituted recipient fails before capture", (t) => {
  const f = fixture(t);
  assert.throws(() =>
    createResearchHost({
      expected: f.expected,
      pinnedFingerprint: "0".repeat(64),
    }),
  );
  assert.throws(() =>
    createResearchHost({
      expected: f.expected,
      publicKey: f.keys.publicKey,
      pinnedFingerprint: "0".repeat(64),
    }),
  );
});
test("encryption failure wipes buffer, categorical public receipt has no error text or fallback", async (t) => {
  let plaintext;
  const f = fixture(t, {
    encrypt: (bytes) => {
      plaintext = bytes;
      throw new Error("PRIVATE_PATH_CANARY_STACK_SQL_HTTP_MODEL_RESPONSE");
    },
  });
  const r = await f.host.capture(f.admit(), new AbortController().signal);
  assert.equal(r.state, "CAPTURE_FAILED");
  assert.equal(r.ciphertextSha256, null);
  assert.ok(plaintext.every((b) => b === 0));
  assert.doesNotMatch(
    JSON.stringify(r),
    /CANARY|STACK|SQL|HTTP|MODEL_RESPONSE/,
  );
  assert.throws(() => f.host.exportForMock(f.finalizer()));
});
test("encryption output oversize and truncated output fail closed", async (t) => {
  for (const length of [10, LIMIT.cipher + 1]) {
    const f = fixture(t, { encrypt: () => Buffer.alloc(length) });
    assert.equal(
      (await f.host.capture(f.admit(), new AbortController().signal)).state,
      "CAPTURE_FAILED",
    );
  }
});
test("ciphertext truncation, tampering and wrong test private key fail authentication", async (t) => {
  const f = fixture(t);
  await f.host.capture(f.admit(), new AbortController().signal);
  const bytes = f.host.exportForMock(f.finalizer()),
    wrong = generateKeyPairSync("x25519");
  assert.throws(() =>
    decryptTest(
      bytes.subarray(0, bytes.length - 1),
      f.keys.privateKey,
      f.keys.publicKey,
    ),
  );
  const altered = Buffer.from(bytes);
  altered[110] ^= 1;
  assert.throws(() =>
    decryptTest(altered, f.keys.privateKey, f.keys.publicKey),
  );
  assert.throws(() => decryptTest(bytes, wrong.privateKey, f.keys.publicKey));
});
test("bogus/mismatched finalizer and cleanup/emergency failures cannot export", async (t) => {
  const f = fixture(t);
  assert.throws(() => f.finalizer());
  assert.throws(() =>
    f.host.mockAcknowledgment({ identity: f.expected, sha256: null, bytes: 0 }),
  );
  await f.host.capture(f.admit(), new AbortController().signal);
  assert.throws(() =>
    f.host.mockAcknowledgment({
      identity: f.expected,
      sha256: f.host.receipt().ciphertextSha256,
      bytes: f.host.receipt().ciphertextBytes,
    }),
  );
  for (const patch of [
    { containers: 1 },
    { volumes: 1 },
    { emergencyRemoved: 1 },
    { collectorClean: false },
    { normalCleanup: false },
    { identity: { ...f.expected, runId: "108" } },
  ])
    assert.throws(() =>
      f.host.finalizer({
        identity: f.expected,
        normalCleanup: true,
        collectorClean: true,
        containers: 0,
        volumes: 0,
        emergencyRemoved: 0,
        ...patch,
      }),
    );
  assert.throws(() => f.host.exportForMock({ normalCleanup: true }));
  assert.equal(f.host.receipt().state, "CAPTURED_UNVERIFIED");
});
test("upload failure/mismatched acknowledgment never claims stored", async (t) => {
  const f = fixture(t);
  await f.host.capture(f.admit(), new AbortController().signal);
  const bytes = f.host.exportForMock(f.finalizer());
  assert.throws(() =>
    f.host.mockAcknowledgment({
      identity: f.expected,
      sha256: digest(bytes),
      bytes: bytes.length - 1,
    }),
  );
  assert.equal(
    f.host.finishUpload({ status: "success" }).state,
    "UPLOAD_FAILED",
  );
});
test("pre-cancellation, active cancellation, timeout, crash-seal and late completion are terminal", async (t) => {
  const f = fixture(t),
    controller = new AbortController();
  controller.abort();
  assert.equal(
    (await f.host.capture(f.admit(), controller.signal)).state,
    "CAPTURE_FAILED",
  );
  for (const event of ["abort", "timeout", "cancel", "seal"]) {
    let release, retained;
    const g = fixture(t, {
      deadlineMs: 15,
      encrypt: (bytes) => {
        retained = bytes;
        return new Promise((resolve) => {
          release = resolve;
        });
      },
    });
    const c = new AbortController(),
      pending = g.host.capture(g.admit(), c.signal);
    await new Promise((resolve) => setImmediate(resolve));
    if (event === "abort") c.abort();
    if (event === "cancel") g.host.cancel();
    if (event === "seal") g.host.seal();
    const r = await pending,
      before = g.host.receipt();
    release(Buffer.alloc(256));
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(g.host.receipt(), before);
    assert.notEqual(r.state, "CAPTURED_UNVERIFIED");
    assert.ok(retained.every((b) => b === 0));
  }
});
test("public receipts are exact allowlist; source/secret echo tripwire is not arbitrary-secret proof", async (t) => {
  const f = fixture(t);
  await f.host.capture(f.admit(), new AbortController().signal);
  assert.deepEqual(Object.keys(f.host.receipt()).sort(), [
    "ciphertextBytes",
    "ciphertextSha256",
    "format",
    "identity",
    "productionAuthority",
    "recipientFingerprint",
    "state",
    "verification",
  ]);
  const text = JSON.stringify(f.host.receipt());
  for (const value of [
    f.root,
    f.files[0].content,
    "src/main.ts",
    "PRIVATE KEY",
    "G4",
    "response",
    "stack",
    "http",
    "sqlite",
  ])
    assert.ok(!text.includes(value));
  for (const secret of [
    "MODEL_API_KEY",
    "AGE-SECRET-KEY-",
    "github_pat_abc",
    "Bearer abc",
  ])
    assert.throws(() =>
      filesValidated([{ path: "src/main.ts", content: NOTICE + secret }]),
    );
  // Direct local crypto control uses no production age identity or external service.
  assert.ok(encryptTest(Buffer.from("inert"), f.keys.publicKey).length > 104);
});
