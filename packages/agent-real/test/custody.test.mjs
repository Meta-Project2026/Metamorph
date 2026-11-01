import assert from "node:assert/strict";
import childProcess from "node:child_process";
import crypto, { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import test from "node:test";
import { parse } from "yaml";
import { sha256 } from "../../target-worker/src/admission.mjs";
import { captureLease } from "../src/custody-capture.mjs";
import {
  artifactMetadata,
  authenticatedArtifactMetadata,
  checkpointReady,
  consumeOraclePermit,
  custodyVerificationLink,
  requireStoredCheckpoint,
  saveTransport,
  verifiedReadback,
} from "../src/custody-checkpoint.mjs";
import {
  beginCustody,
  CUSTODY,
  capsuleFromLease,
  plainData,
  receiptFor,
  validateCapsule,
  validateReceipt,
} from "../src/custody-contract.mjs";
import {
  cipherAt,
  commitPrivate,
  commitRecord,
  exactReadback,
  privateDirectory,
  readRecord,
} from "../src/custody-files.mjs";
import {
  runPublicMigration,
  validateCustodiedMigration,
} from "../src/migration-trial.mjs";
import { createSourceSession, isSourceLease } from "../src/source.mjs";
import {
  artifactFixture,
  offlinePaid,
  ROOT,
  syntheticCapsule,
} from "./custody-fixture.mjs";

function temp(t) {
  const dir = fs.mkdtempSync(join(tmpdir(), "mmp115-unit-"));
  t.after(() => {
    assert.equal(resolve(dir), dir);
    assert.equal(dirname(dir), resolve(tmpdir()));
    assert.match(basename(dir), /^mmp115-unit-[a-zA-Z0-9]+$/);
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return dir;
}
function captured(capsule = syntheticCapsule()) {
  const bytes = Buffer.concat([
    Buffer.from("age-encryption.org/v1\n"),
    Buffer.alloc(200, 7),
  ]);
  const capture = receiptFor(
    "CAPTURED_UNVERIFIED",
    capsule.identity,
    { sha256: sha256(bytes), bytes: bytes.length },
    "VERIFIED_ZERO_RESOURCES",
  );
  const f = artifactFixture(capture);
  return {
    ...f,
    capsule,
    bytes,
    capture,
    ready: checkpointReady(capture, f.finalizer, capsule.identity),
  };
}
const linux = { skip: process.platform !== "linux" };
test("production capsule admits exact licensed bytes and immutable allowlist, always UNVERIFIED", () => {
  const c = syntheticCapsule(),
    admitted = validateCapsule(c, c.identity);
  assert.equal(admitted.identity.candidateSha, c.identity.candidateSha);
  assert.ok(Object.isFrozen(admitted.files[0]));
  assert.deepEqual(Object.keys(admitted), [
    "format",
    "verification",
    "attemptKind",
    "identity",
    "admission",
    "license",
    "manifest",
    "files",
  ]);
  const r = captured(c).capture;
  assert.equal(
    validateReceipt(r, c.identity, r.state).verification,
    "UNVERIFIED",
  );
  assert.doesNotMatch(
    JSON.stringify(r),
    /src\/|originalSynthetic|PRIVATE|Bearer|stack|responseSha|license/,
  );
});
for (const key of [
  "runId",
  "runAttempt",
  "headSha",
  "sourceSha",
  "candidateSha",
  "attemptId",
])
  test(`production custody rejects missing/foreign ${key}`, () => {
    const c = syntheticCapsule();
    const missing = structuredClone(c);
    delete missing.identity[key];
    assert.throws(() => validateCapsule(missing, c.identity));
    const changed = structuredClone(c);
    changed.identity[key] = key === "attemptId" ? randomUUID() : "foreign";
    assert.throws(() => validateCapsule(changed, c.identity));
  });
test("production capsule rejects altered/missing/duplicate/extra/oversize source, license and private canaries", () => {
  for (const mutate of [
    (c) => {
      c.files[0].content += "altered";
    },
    (c) => {
      c.files = [];
    },
    (c) => {
      c.files.push(c.files[0]);
    },
    (c) => {
      c.files[0].path = "../secret.ts";
    },
    (c) => {
      c.files[0].path = "src/reference.ts";
    },
    (c) => {
      c.files[0].content = "x".repeat(256 * 1024 + 1);
    },
    (c) => {
      c.files[0].content = "\0";
    },
    (c) => {
      c.license.spdx = "Proprietary";
    },
    (c) => {
      c.manifest[0].bytes--;
    },
    (c) => {
      c.admission.responseSha256 = null;
    },
    (c) => {
      c.admission.manifestSha256 = "0".repeat(64);
    },
    (c) => {
      c.rawProvider = "PRIVATE_RAW_HTTP_SQL_CANARY";
    },
  ]) {
    const c = structuredClone(syntheticCapsule());
    mutate(c);
    assert.throws(() => validateCapsule(c));
  }
  for (const canary of [
    "MODEL_API_KEY",
    "AGE-SECRET-KEY-",
    "REFERENCE_MUST_NEVER_EXPORT",
    "<?php",
    "\ud800",
  ]) {
    const c = structuredClone(syntheticCapsule());
    c.files[0].content += canary;
    c.files[0].sha256 = sha256(c.files[0].content);
    // Hash mutation already rejects. A recomputed self-claimed digest must not bypass tripwires.
    c.identity.candidateSha = sha256(
      JSON.stringify(
        c.files.map(({ path, sha256, content }) => ({ path, sha256, content })),
      ),
    );
    c.manifest[0].bytes = Buffer.byteLength(c.files[0].content);
    c.manifest[0].sha256 = c.files[0].sha256;
    assert.throws(() => validateCapsule(c));
  }
});
test("hostile getters/proxies cannot execute in capsule/receipt admission", () => {
  let calls = 0;
  const getter = Object.defineProperty({}, "identity", {
    get() {
      calls++;
      throw Error("SECRET_STACK_CANARY");
    },
    enumerable: true,
  });
  const proxy = new Proxy(
    {},
    {
      ownKeys() {
        calls++;
        throw Error("SECRET_STACK_CANARY");
      },
    },
  );
  for (const v of [getter, proxy, { nested: proxy }, { value: NaN }]) {
    assert.throws(() => plainData(v));
    assert.throws(() => validateCapsule(v));
    assert.throws(() => artifactMetadata(v, {}, {}, {}));
  }
  assert.equal(calls, 0);
});
test("custody token requires genuine opaque paid admission and live source lease, independent UUID", async (t) => {
  const dir = temp(t),
    f = await offlinePaid(t, dir);
  assert.throws(() => beginCustody(f.context, { ...f.authorization }));
  const token = beginCustody(f.context, f.authorization),
    session = createSourceSession(dir),
    signal = new AbortController().signal;
  await session.writer.write(
    [
      ...f.capsule.files.map(({ path, content }) => ({ path, content })),
      { path: "src/empty.ts", content: "" },
    ],
    signal,
  );
  const lease = await session.acquire(session.writer.root, signal);
  assert.ok(isSourceLease(lease));
  const receipt = {
    format: "meta-generation-v1",
    status: "PASS",
    generationKind: "REAL_INFERENCE",
    attemptedRequests: 1,
    attempt: 1,
    action: "generate",
    sourceSha: f.authorization.sourceSha,
    contextSha256: f.authorization.contextSha256,
    manifestSha256: f.authorization.manifestSha256,
    inputSha256: f.authorization.bodySha256,
    responseSha256: "a".repeat(64),
    candidateSha: lease.bundle.candidateSha,
    authorization: f.authorization,
  };
  const capsule = await capsuleFromLease(token, lease, receipt);
  assert.equal(
    capsule.manifest.find((f) => f.path === "src/empty.ts").bytes,
    0,
  );
  assert.notEqual(capsule.identity.attemptId, f.capsule.identity.attemptId);
  await assert.rejects(capsuleFromLease(token, lease, receipt));
  await assert.rejects(
    capsuleFromLease(
      beginCustody(f.context, f.authorization),
      { ...lease },
      receipt,
    ),
  );
  await assert.rejects(
    capsuleFromLease(beginCustody(f.context, f.authorization), lease, {
      ...receipt,
      candidateSha: "0".repeat(64),
    }),
  );
  await lease.release();
  assert.equal(isSourceLease(lease), false);
  assert.equal(f.calls.length, 0);
});
test("source lease rejects real symlink/hardlink and mutation before capture", async (t) => {
  const dir = temp(t),
    f = await offlinePaid(t, dir),
    session = createSourceSession(dir),
    signal = new AbortController().signal;
  await session.writer.write(
    f.capsule.files.map(({ path, content }) => ({ path, content })),
    signal,
  );
  const path = join(session.writer.root, "src/main.ts");
  fs.linkSync(path, join(session.writer.root, "src/linked.ts"));
  await assert.rejects(session.acquire(session.writer.root, signal));
  fs.unlinkSync(join(session.writer.root, "src/linked.ts"));
  const linkedDirectory = join(session.writer.root, "src/escape");
  fs.symlinkSync(
    dir,
    linkedDirectory,
    process.platform === "win32" ? "junction" : "dir",
  );
  await assert.rejects(session.acquire(session.writer.root, signal));
  fs.unlinkSync(linkedDirectory);
  const lease = await session.acquire(session.writer.root, signal);
  fs.appendFileSync(path, "// race");
  await assert.rejects(lease.assertUnchanged());
  await assert.rejects(lease.release());
});
test("generation stays GENERATED when custody rejects, with no second model request or Oracle", async (t) => {
  const dir = temp(t),
    c = syntheticCapsule();
  c.files[0].content = "export const missingNotice = 1;";
  const f = await offlinePaid(t, dir, c);
  const r = await runPublicMigration({
    context: f.context,
    selection: "meta",
    headSha: c.identity.headSha,
    parent: dir,
    signal: new AbortController().signal,
    authorization: f.authorization,
  });
  assert.equal(r.modelGeneration, "GENERATED");
  assert.deepEqual(r.blockers, ["CUSTODY_CAPTURE_FAILED"]);
  assert.equal(r.custody, undefined);
  assert.equal(r.publicG1, "NOT_RUN");
  assert.equal(r.generatedRequests, 1);
  assert.equal(f.calls.length, 1);
  await assert.rejects(
    runPublicMigration({
      context: f.context,
      selection: "meta",
      headSha: c.identity.headSha,
      parent: dir,
      signal: new AbortController().signal,
      authorization: { ...f.authorization },
    }),
  );
  assert.equal(f.calls.length, 1);
});
test("checkpoint cannot accept fake phase, foreign identity, nonzero or emergency cleanup", () => {
  const f = captured();
  for (const patch of [
    { phase: "POST_ORACLE" },
    { identity: { ...f.capture.identity, attemptId: randomUUID() } },
    { containers: 1 },
    { volumes: 1 },
    { emergencyRemoved: 1 },
    { extra: "PASS" },
  ])
    assert.throws(() =>
      checkpointReady(
        f.capture,
        { ...f.finalizer, ...patch },
        f.capture.identity,
      ),
    );
});
test("transport rejects forged ack, foreign artifact/run/head/attempt, expired or swapped archive metadata", () => {
  const f = captured();
  assert.equal(
    artifactMetadata(f.ready, f.artifact, f.run, f.ack).state,
    "CHECKPOINT_READY_UNVERIFIED",
  );
  for (const patch of [
    { artifactId: "0" },
    { uploadOutcome: "failure" },
    { downloadOutcome: "failure" },
    { archiveSha256: "0".repeat(64) },
  ])
    assert.throws(() =>
      artifactMetadata(f.ready, f.artifact, f.run, { ...f.ack, ...patch }),
    );
  for (const patch of [
    { id: 2 },
    { name: "foreign" },
    { expired: true },
    { digest: "sha256:wrong" },
    { size_in_bytes: CUSTODY.ciphertext * 2 },
    { workflow_run: { ...f.artifact.workflow_run, head_sha: "0".repeat(40) } },
  ])
    assert.throws(() =>
      artifactMetadata(f.ready, { ...f.artifact, ...patch }, f.run, f.ack),
    );
  for (const patch of [
    { run_attempt: 2 },
    { id: 2 },
    { event: "pull_request" },
    { head_sha: "0".repeat(40) },
  ])
    assert.throws(() =>
      artifactMetadata(f.ready, f.artifact, { ...f.run, ...patch }, f.ack),
    );
});
test(
  "Linux atomic ciphertext commit is no-clobber, owner-only and stable",
  linux,
  (t) => {
    const dir = temp(t),
      f = captured(),
      path = join(dir, "candidate.age");
    privateDirectory(dir);
    commitPrivate(path, f.bytes, CUSTODY.ciphertext);
    assert.equal(fs.statSync(path).mode & 0o777, 0o600);
    assert.deepEqual(cipherAt(path, f.capture), f.bytes);
    assert.throws(() =>
      commitPrivate(path, Buffer.alloc(200, 3), CUSTODY.ciphertext),
    );
    assert.deepEqual(fs.readFileSync(path), f.bytes);
    assert.deepEqual(fs.readdirSync(dir), ["candidate.age"]);
  },
);
test(
  "Linux interrupted writes/flush and destination collisions never yield a committed receipt",
  linux,
  (t) => {
    const dir = temp(t),
      original = fs.fsyncSync;
    try {
      fs.fsyncSync = () => {
        throw new Error("PRIVATE_FSYNC_STACK");
      };
      syncBuiltinESMExports();
      assert.throws(() =>
        commitPrivate(join(dir, "candidate.age"), Buffer.alloc(200), 1000),
      );
    } finally {
      fs.fsyncSync = original;
      syncBuiltinESMExports();
    }
    assert.deepEqual(fs.readdirSync(dir), []);
    const outside = join(dir, "outside");
    fs.mkdirSync(outside, { mode: 0o700 });
    fs.symlinkSync(outside, join(dir, "linked"));
    assert.throws(() =>
      commitPrivate(join(dir, "linked/candidate.age"), Buffer.alloc(200), 1000),
    );
  },
);
test(
  "Linux exact retrieved bytes required; truncation, extra files and links fail closed",
  linux,
  (t) => {
    const dir = temp(t),
      f = captured(),
      path = join(dir, "candidate.age");
    commitPrivate(path, f.bytes, CUSTODY.ciphertext);
    assert.equal(
      verifiedReadback(f.ready, f.artifact, f.run, f.ack, dir).state,
      "STORED_UNVERIFIED",
    );
    fs.appendFileSync(path, "x");
    assert.throws(() => exactReadback(dir, f.capture));
    fs.writeFileSync(path, f.bytes.subarray(0, 100));
    assert.throws(() => exactReadback(dir, f.capture));
    fs.writeFileSync(path, f.bytes);
    fs.writeFileSync(join(dir, "extra.txt"), "PRIVATE_CANARY");
    assert.throws(() => exactReadback(dir, f.capture));
    fs.unlinkSync(join(dir, "extra.txt"));
    fs.linkSync(path, join(dir, "alias.age"));
    assert.throws(() => cipherAt(path, f.capture));
  },
);
test(
  "Linux stored checkpoint is rechecked, consumed once; Oracle ERROR cannot relabel storage",
  linux,
  async (t) => {
    const dir = temp(t),
      f = captured(),
      spool = join(dir, "mmp115-custody"),
      download = join(dir, "mmp115-readback");
    privateDirectory(spool, true);
    privateDirectory(download, true);
    const env = {
      RUNNER_TEMP: dir,
      GITHUB_RUN_ID: f.capture.identity.runId,
      GITHUB_RUN_ATTEMPT: "1",
      GITHUB_SHA: f.capture.identity.headSha,
    };
    assert.throws(() => requireStoredCheckpoint(env, f.capture.identity));
    commitPrivate(join(spool, "candidate.age"), f.bytes, CUSTODY.ciphertext);
    commitRecord(join(spool, "capture.json"), f.capture);
    commitRecord(join(spool, "finalizer.json"), f.finalizer);
    assert.throws(() => requireStoredCheckpoint(env, f.capture.identity));
    commitPrivate(join(download, "candidate.age"), f.bytes, CUSTODY.ciphertext);
    const stored = saveTransport(
      spool,
      f.ready,
      f.artifact,
      f.run,
      f.ack,
      download,
    );
    const before = fs.readFileSync(join(spool, "stored.json"));
    const permit = requireStoredCheckpoint(env, f.capture.identity);
    assert.equal(
      consumeOraclePermit(permit, f.capture.identity).attemptId,
      f.capture.identity.attemptId,
    );
    assert.throws(() => consumeOraclePermit(permit, f.capture.identity));
    assert.equal(stored.verification, "UNVERIFIED");
    const invalidRoot = join(dir, "invalid-trusted-root"),
      parent = join(dir, "verification");
    fs.mkdirSync(invalidRoot);
    fs.mkdirSync(parent);
    const context = (
      await import("../src/migration-context.mjs")
    ).bindMigrationContext(
      (await import("./custody-fixture.mjs")).SOURCE_INPUT,
    );
    const candidate = createSourceSession(dir);
    await candidate.writer.write(
      f.capsule.files.map(({ path, content }) => ({ path, content })),
      new AbortController().signal,
    );
    const result = await validateCustodiedMigration(
      {
        context,
        root: invalidRoot,
        parent,
        headSha: f.capture.identity.headSha,
        candidateRoot: candidate.writer.root,
        candidateSha: f.capture.identity.candidateSha,
        signal: new AbortController().signal,
      },
      requireStoredCheckpoint(env, f.capture.identity),
    );
    assert.deepEqual(result.blockers, ["PUBLIC_DOCKER_ERROR"]);
    assert.deepEqual(fs.readFileSync(join(spool, "stored.json")), before);
    assert.equal(
      readRecord(join(spool, "stored.json")).state,
      "STORED_UNVERIFIED",
    );
  },
);
test("no Oracle source access before a genuine stored-checkpoint capability", async () => {
  const identity = syntheticCapsule().identity,
    verifierId = randomUUID();
  assert.deepEqual(
    custodyVerificationLink(identity, []).verifierAttemptIds,
    [],
  );
  assert.equal(
    custodyVerificationLink(identity, [verifierId]).verification,
    "UNVERIFIED",
  );
  assert.throws(() => custodyVerificationLink(identity, [identity.attemptId]));
  assert.throws(() =>
    custodyVerificationLink(identity, [verifierId, verifierId]),
  );
  let touched = 0;
  await assert.rejects(
    validateCustodiedMigration(
      {
        context: { sourceSha: "x" },
        headSha: "x",
        candidateSha: "x",
        get candidateRoot() {
          touched++;
          throw Error("UNREACHABLE");
        },
      },
      {},
    ),
  );
  assert.equal(touched, 0);
});
test("real read-time source mutation is rejected before collector handoff", async (t) => {
  const dir = temp(t),
    f = await offlinePaid(t, dir),
    session = createSourceSession(dir),
    signal = new AbortController().signal;
  await session.writer.write(
    f.capsule.files.map(({ path, content }) => ({ path, content })),
    signal,
  );
  const lease = await session.acquire(session.writer.root, signal),
    original = fs.readSync;
  let changed = false;
  try {
    fs.readSync = (...args) => {
      const n = original(...args);
      if (!changed) {
        changed = true;
        fs.appendFileSync(join(session.writer.root, "src/main.ts"), "// swap");
      }
      return n;
    };
    syncBuiltinESMExports();
    await assert.rejects(
      capsuleFromLease(
        beginCustody(f.context, f.authorization),
        lease,
        boundReceipt(f, lease),
      ),
    );
    assert.equal(changed, true);
  } finally {
    fs.readSync = original;
    syncBuiltinESMExports();
    await assert.rejects(lease.release());
  }
  assert.equal(f.calls.length, 0);
});
test(
  "fresh collector deadline/cancellation and late close cannot commit or retry; no credentials forwarded",
  linux,
  async (t) => {
    const dir = temp(t),
      f = await offlinePaid(t, dir),
      session = createSourceSession(dir),
      signal = new AbortController().signal;
    await session.writer.write(
      f.capsule.files.map(({ path, content }) => ({ path, content })),
      signal,
    );
    const lease = await session.acquire(session.writer.root, signal),
      token = beginCustody(f.context, f.authorization);
    const spawn = childProcess.spawn,
      timeout = globalThis.setTimeout;
    let starts = 0,
      borrowed,
      late = false;
    try {
      globalThis.setTimeout = (callback, ms, ...args) =>
        timeout(callback, ms === 45000 ? 2 : ms === 85000 ? 100 : ms, ...args);
      childProcess.spawn = (_file, _args, options) => {
        starts++;
        for (const name of [
          "MODEL_API_KEY",
          "GH_TOKEN",
          "ACTIONS_RUNTIME_TOKEN",
          "ACTIONS_ID_TOKEN_REQUEST_TOKEN",
          "NODE_OPTIONS",
        ])
          assert.equal(Object.hasOwn(options.env, name), false);
        const child = new EventEmitter();
        child.stderr = new EventEmitter();
        child.stdin = new EventEmitter();
        child.kill = () => true;
        child.stdin.end = (input) => {
          borrowed = input;
          timeout(() => {
            child.emit("close", 0, null);
            timeout(() => {
              late = true;
              child.emit("close", 0, null);
            }, 5);
          }, 10);
        };
        return child;
      };
      syncBuiltinESMExports();
      await assert.rejects(
        captureLease(token, lease, boundReceipt(f, lease), signal),
      );
      await new Promise((resolve) => timeout(resolve, 20));
      assert.equal(late, true);
      assert.ok(borrowed.every((b) => b === 0));
      await assert.rejects(
        captureLease(token, lease, boundReceipt(f, lease), signal),
      );
      assert.equal(starts, 1);
      assert.equal(fs.existsSync(join(dir, "mmp115-custody")), false);
    } finally {
      childProcess.spawn = spawn;
      globalThis.setTimeout = timeout;
      syncBuiltinESMExports();
      await lease.release();
    }
  },
);
test(
  "atomic partial write, pending collision and directory-flush crash remain fail closed",
  linux,
  (t) => {
    const dir = temp(t),
      path = join(dir, "candidate.age"),
      uuid = "00000000-0000-4000-8000-000000000000",
      pending = join(dir, `.pending-${uuid}`),
      random = crypto.randomUUID,
      write = fs.writeSync,
      sync = fs.fsyncSync;
    try {
      fs.writeSync = () => 0;
      syncBuiltinESMExports();
      assert.throws(() => commitPrivate(path, Buffer.alloc(200), 1000));
      assert.equal(fs.existsSync(path), false);
      fs.writeSync = write;
      crypto.randomUUID = () => uuid;
      syncBuiltinESMExports();
      fs.writeFileSync(pending, "ORIGINAL_COLLISION_WITNESS", { mode: 0o600 });
      assert.throws(() => commitPrivate(path, Buffer.alloc(200), 1000));
      assert.equal(
        fs.readFileSync(pending, "utf8"),
        "ORIGINAL_COLLISION_WITNESS",
      );
      fs.unlinkSync(pending);
      let flushes = 0;
      fs.fsyncSync = (fd) => {
        if (++flushes === 2) throw new Error("PRIVATE_DIRECTORY_FLUSH");
        return sync(fd);
      };
      syncBuiltinESMExports();
      assert.throws(() => commitPrivate(path, Buffer.alloc(200), 1000));
      assert.equal(fs.existsSync(path), true);
      assert.equal(fs.existsSync(join(dir, "capture.json")), false);
    } finally {
      crypto.randomUUID = random;
      fs.writeSync = write;
      fs.fsyncSync = sync;
      syncBuiltinESMExports();
    }
  },
);
test("authenticated metadata retrieval errors, redirects and oversized bodies never assert storage", async (t) => {
  const env = {
    GH_TOKEN: "fake-only",
    MMP115_ARTIFACT_ID: "115002",
    GITHUB_RUN_ID: "115001",
  };
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls++;
    assert.ok(
      String(url).startsWith(
        "https://api.github.com/repos/Meta-Project2026/Metamorph/actions/",
      ),
    );
    assert.equal(options.redirect, "error");
    return new Response("PRIVATE_RAW_HTTP_ERROR", { status: 403 });
  });
  await assert.rejects(authenticatedArtifactMetadata(env), {
    message: "CUSTODY_REJECTED",
  });
  assert.equal(calls, 1);
  await assert.rejects(
    authenticatedArtifactMetadata({ ...env, MMP115_ARTIFACT_ID: "../foreign" }),
  );
  assert.equal(calls, 1);
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("x".repeat(65537), { status: 200 }),
  );
  await assert.rejects(authenticatedArtifactMetadata(env));
});
function boundReceipt(f, lease) {
  return {
    format: "meta-generation-v1",
    status: "PASS",
    generationKind: "REAL_INFERENCE",
    attemptedRequests: 1,
    attempt: 1,
    action: "generate",
    sourceSha: f.authorization.sourceSha,
    contextSha256: f.authorization.contextSha256,
    manifestSha256: f.authorization.manifestSha256,
    inputSha256: f.authorization.bodySha256,
    responseSha256: "a".repeat(64),
    candidateSha: lease.bundle.candidateSha,
    authorization: f.authorization,
  };
}

test("workflow order, credential boundary, exact ciphertext transport and original finalizers remain", () => {
  const raw = fs.readFileSync(
      join(ROOT, ".github/workflows/meta-paid-migration.yml"),
      "utf8",
    ),
    workflow = parse(raw),
    steps = workflow.jobs["generate-and-verify"].steps;
  const ids = steps.map((s) => s.id),
    order = [
      "generation",
      "custody-capture",
      "custody-finalizer",
      "custody-gate",
      "custody-upload",
      "custody-download",
      "custody-stored",
      "validation",
      "preservation",
      "finalizer",
      "diagnostic-gate",
      "diagnostic-upload",
    ];
  for (let i = 1; i < order.length; i++)
    assert.ok(ids.indexOf(order[i - 1]) < ids.indexOf(order[i]));
  assert.match(
    steps.find((s) => s.id === "validation").if,
    /steps.custody-stored.outcome == 'success'/,
  );
  assert.equal(steps.find((s) => s.id === "finalizer").if, "always()");
  const upload = steps.find((s) => s.id === "custody-upload");
  assert.equal(
    upload.with.path,
    // biome-ignore lint/suspicious/noTemplateCurlyInString: literal GitHub expression
    "${{ runner.temp }}/mmp115-custody/candidate.age",
  );
  assert.equal(upload.with["retention-days"], 7);
  assert.equal(
    workflow.on.workflow_dispatch.inputs.max_estimated_usd.default,
    "0.10",
  );
  assert.equal((raw.match(/secrets.META/g) ?? []).length, 1);
  assert.match(
    fs.readFileSync(
      join(ROOT, "research/mmp-078/validate-candidate.mjs"),
      "utf8",
    ),
    /requireStoredCheckpoint/,
  );
});
