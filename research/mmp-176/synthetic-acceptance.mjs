// MANUAL ONLY. Generated TEST keys/public synthetic source. Never owner inputs.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  linkSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  CUSTODY,
  receiptFor,
} from "../../packages/agent-real/src/custody-contract.mjs";
import { DIAGNOSTIC_POLICY } from "../../packages/agent-real/src/private-diagnostics.mjs";
import { syntheticCapsule } from "../../packages/agent-real/test/custody-fixture.mjs";
import { WORKSHOP_PROFILE } from "../../packages/target-worker/runtime/profile.mjs";
import {
  admitDirectory,
  sha256,
} from "../../packages/target-worker/src/admission.mjs";
import {
  command,
  sandboxArgs,
  TargetWorker,
} from "../../packages/target-worker/src/controller.mjs";
import {
  assertOffline,
  initialResult,
  prepareRuntime,
  replayPrivate,
  restorePrivate,
} from "./replay.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
assert.equal(process.platform, "linux");
const toolRoot = process.env.MMP176_TEST_TOOLS;
assert.ok(toolRoot && toolRoot === resolve(toolRoot));
const clean = {
  PATH: "/usr/local/bin:/usr/bin:/bin",
  HOME: "/nonexistent",
  TZ: "UTC",
};
for (const [file, pin] of [
  ["age", DIAGNOSTIC_POLICY.ageSha256],
  ["age-keygen", DIAGNOSTIC_POLICY.keygenSha256],
])
  assert.equal(sha256(readFileSync(join(toolRoot, file))), pin);

function fixture(t, capsule = syntheticCapsule()) {
  const dir = mkdtempSync(join(tmpdir(), "mmp176-test-only-"));
  chmodSync(dir, 0o700);
  t.after(() => {
    assert.ok(
      dir.startsWith(`${tmpdir()}/mmp176-test-only-`) && dir === resolve(dir),
    );
    rmSync(dir, { recursive: true, force: true });
  });
  for (const name of ["age", "age-keygen"]) {
    writeFileSync(join(dir, name), readFileSync(join(toolRoot, name)), {
      mode: 0o700,
      flag: "wx",
    });
  }
  const identity = join(dir, "identity"),
    keygen = join(dir, "age-keygen");
  execFileSync(keygen, ["--output", identity], { env: clean, stdio: "pipe" });
  chmodSync(identity, 0o600);
  const recipient = execFileSync(keygen, ["-y", identity], {
    env: clean,
    encoding: "utf8",
    stdio: "pipe",
  }).trim();
  const plaintext = Buffer.from(JSON.stringify(capsule));
  const cipher = execFileSync(
    join(dir, "age"),
    ["--encrypt", "--recipient", recipient],
    { env: clean, input: plaintext, maxBuffer: CUSTODY.ciphertext },
  );
  plaintext.fill(0);
  writeFileSync(join(dir, "candidate.age"), cipher, {
    mode: 0o600,
    flag: "wx",
  });
  const record = receiptFor(
    "STORED_UNVERIFIED",
    capsule.identity,
    { sha256: sha256(cipher), bytes: cipher.length },
    "VERIFIED_ZERO_RESOURCES",
  );
  const receipt = Buffer.from(`${JSON.stringify(record)}\n`);
  writeFileSync(join(dir, "custody-stored.json"), receipt, {
    mode: 0o600,
    flag: "wx",
  });
  const expected = {
    identity: capsule.identity,
    ciphertextSha256: sha256(cipher),
    ciphertextBytes: cipher.length,
    receiptSha256: sha256(receipt),
  };
  return {
    dir,
    recipient,
    expected,
    cipher,
    receipt,
    restore: () => restorePrivate(dir, expected, recipient),
  };
}
test("pinned real age TEST-key restore: exact bytes, identity and production recipient refusal", (t) => {
  const capsule = syntheticCapsule(),
    f = fixture(t, capsule);
  assert.deepEqual(f.restore().files, capsule.files);
  assert.throws(() => restorePrivate(f.dir, f.expected));
  for (const patch of [{ runId: "999" }, { headSha: "0".repeat(40) }])
    assert.throws(() =>
      restorePrivate(
        f.dir,
        { ...f.expected, identity: { ...f.expected.identity, ...patch } },
        f.recipient,
      ),
    );
});
test("real TEST crypto rejects wrong key, tool substitution, truncated/corrupt ciphertext and receipt", (t) => {
  const f = fixture(t);
  const agePath = join(f.dir, "age"),
    identity = join(f.dir, "identity"),
    ciphertext = join(f.dir, "candidate.age");
  const key = readFileSync(identity);
  unlinkSync(identity);
  execFileSync(join(f.dir, "age-keygen"), ["--output", identity], {
    env: clean,
    stdio: "pipe",
  });
  chmodSync(identity, 0o600);
  assert.throws(f.restore);
  writeFileSync(identity, key);
  key.fill(0);
  const age = readFileSync(agePath);
  writeFileSync(agePath, Buffer.from("unqualified tool"));
  assert.throws(f.restore);
  writeFileSync(agePath, age);
  for (const changed of [
    Buffer.from(f.cipher.subarray(0, f.cipher.length - 1)),
    Buffer.from(f.cipher),
  ]) {
    changed[changed.length - 1] ^= 1;
    writeFileSync(ciphertext, changed);
    assert.throws(f.restore);
  }
  writeFileSync(ciphertext, f.cipher);
  const receiptPath = join(f.dir, "custody-stored.json");
  writeFileSync(receiptPath, "{}");
  assert.throws(f.restore);
  unlinkSync(receiptPath);
  assert.throws(f.restore);
  writeFileSync(receiptPath, f.receipt, { mode: 0o600 });
  assert.ok(f.restore());
});
test("actual Linux ownership/mode/size/link/directory controls refuse unsafe input", (t) => {
  const f = fixture(t),
    identity = join(f.dir, "identity"),
    bytes = readFileSync(identity);
  chmodSync(identity, 0o644);
  assert.throws(f.restore);
  chmodSync(identity, 0o600);
  const alias = join(f.dir, "hardlink");
  linkSync(identity, alias);
  assert.throws(f.restore);
  unlinkSync(alias);
  const saved = join(f.dir, "saved");
  copyFileSync(identity, saved);
  chmodSync(saved, 0o600);
  unlinkSync(identity);
  symlinkSync(saved, identity);
  assert.throws(f.restore);
  unlinkSync(identity);
  writeFileSync(identity, Buffer.alloc(4097), { mode: 0o600 });
  assert.throws(f.restore);
  writeFileSync(identity, bytes);
  bytes.fill(0);
  chmodSync(f.dir, 0o755);
  assert.throws(f.restore);
  chmodSync(f.dir, 0o700);
  const linkedDir = join(f.dir, "linked");
  symlinkSync(f.dir, linkedDir);
  assert.throws(() => restorePrivate(linkedDir, f.expected, f.recipient));
  assert.ok(f.restore());
});
test("real age authentication rejects tampering even with test-only updated outer hashes", (t) => {
  const f = fixture(t),
    corrupt = Buffer.from(f.cipher);
  corrupt[corrupt.length - 1] ^= 1;
  writeFileSync(join(f.dir, "candidate.age"), corrupt);
  const record = receiptFor(
    "STORED_UNVERIFIED",
    f.expected.identity,
    { sha256: sha256(corrupt), bytes: corrupt.length },
    "VERIFIED_ZERO_RESOURCES",
  );
  const bytes = Buffer.from(`${JSON.stringify(record)}\n`);
  writeFileSync(join(f.dir, "custody-stored.json"), bytes);
  assert.throws(() =>
    restorePrivate(
      f.dir,
      {
        ...f.expected,
        ciphertextSha256: sha256(corrupt),
        receiptSha256: sha256(bytes),
      },
      f.recipient,
    ),
  );
});
test("real age restore refuses invalid capsule manifest/source before sandbox construction", (t) => {
  for (const mutate of [
    (c) => {
      c.manifest[0].sha256 = "0".repeat(64);
    },
    (c) => {
      c.license.sourceSha = "0".repeat(40);
    },
    (c) => {
      c.files[0].content += "\n// changed without matching digest\n";
    },
  ]) {
    const capsule = structuredClone(syntheticCapsule());
    mutate(capsule);
    const f = fixture(t, capsule);
    assert.throws(f.restore);
  }
});
test("real Docker TEST-key restore to unchanged TargetWorker G1, sandbox and zero-resource cleanup", async (t) => {
  const capsule = syntheticCapsule();
  const bundle = await admitDirectory(
    join(root, "packages/target-worker/fixtures/workshop"),
  );
  capsule.files = bundle.files;
  capsule.identity.candidateSha = bundle.candidateSha;
  capsule.manifest = bundle.files.map((f) => ({
    path: f.path,
    bytes: Buffer.byteLength(f.content),
    sha256: f.sha256,
  }));
  const f = fixture(t, capsule),
    preparation = initialResult(f.expected);
  const runtime = await prepareRuntime(preparation);
  let worker;
  const result = await replayPrivate({
    runtime,
    expected: f.expected,
    privateRoot: f.dir,
    // SYNTHETIC ONLY: this machine remains connected. Real CLI has no override.
    offline: () => {},
    restore: () => f.restore(),
    makeWorker: (r, b) => {
      worker = new TargetWorker(r, b, "real", { profile: WORKSHOP_PROFILE });
      return worker;
    },
  });
  assert.equal(result.status, "REPLAY_COMPLETE");
  assert.equal(result.g1Verdict, "PASS");
  assert.deepEqual(result.executedTestIds, [
    "workshop-business:typecheck",
    "workshop-business:build",
  ]);
  assert.equal(result.zeroOwnedResources, true);
  assert.equal(result.cleanup, "VERIFIED_ZERO_RESOURCES");
  t.diagnostic(JSON.stringify(result));
  assert.equal(worker.evidence.runtimeInspect.HostConfig.NetworkMode, "none");
  assert.equal(worker.evidence.runtimeInspect.HostConfig.ReadonlyRootfs, true);
  assert.equal(
    worker.evidence.runtimeInspect.HostConfig.Memory,
    256 * 1024 * 1024,
  );
  assert.equal(worker.evidence.runtimeInspect.HostConfig.PidsLimit, 64);
  const name = `mmp176-test-net-${Date.now()}`;
  try {
    const receipt = await command([
      "run",
      ...sandboxArgs(name),
      runtime.imageId,
      "node",
      "--input-type=module",
      "-e",
      'import net from "node:net"; const s=net.connect({host:"198.51.100.1",port:443}); s.on("error",e=>process.exit(e.code==="ENETUNREACH"?0:1)); s.on("connect",()=>process.exit(2)); setTimeout(()=>process.exit(3),2000);',
    ]);
    assert.equal(receipt.exitCode, 0);
  } finally {
    assert.equal((await command(["rm", "--force", name])).exitCode, 0);
  }
  // The connected agent environment must refuse the actual owner-private guard.
  assert.throws(assertOffline);
});
