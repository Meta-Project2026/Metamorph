// Manual disposable-Linux acceptance only. All source is original synthetic data.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  appendFileSync,
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  checkpointReady,
  finalizeCustody,
  requireStoredCheckpoint,
  saveTransport,
} from "../../packages/agent-real/src/custody-checkpoint.mjs";
import {
  CUSTODY,
  parseCapsule,
  receiptFor,
} from "../../packages/agent-real/src/custody-contract.mjs";
import {
  cipherAt,
  commitPrivate,
  readRecord,
} from "../../packages/agent-real/src/custody-files.mjs";
import { verifyAgeRestore } from "../../packages/agent-real/src/custody-restore.mjs";
import { custodyStep } from "../../packages/agent-real/src/custody-steps.mjs";
import { encryptDiagnostic } from "../../packages/agent-real/src/encrypt-diagnostics.mjs";
import {
  runPublicMigration,
  validateCustodiedMigration,
} from "../../packages/agent-real/src/migration-trial.mjs";
import { DIAGNOSTIC_POLICY } from "../../packages/agent-real/src/private-diagnostics.mjs";
import {
  artifactFixture,
  offlinePaid,
  syntheticCapsule,
} from "../../packages/agent-real/test/custody-fixture.mjs";
import { WORKSHOP_CANDIDATE_SHA } from "../../packages/differential/src/workshop-policy.mjs";
import {
  admitDirectory,
  sha256,
} from "../../packages/target-worker/src/admission.mjs";

assert.equal(process.platform, "linux");
assert.ok(
  !process.env.MODEL_API_KEY &&
    !process.env.GH_TOKEN &&
    !process.env.ACTIONS_RUNTIME_TOKEN,
);
const root = fileURLToPath(new URL("../..", import.meta.url));
const parent = process.env.MMP115_TEST_PARENT,
  tools = process.env.MMP115_TOOL_ROOT;
assert.equal(resolve(parent), parent);
assert.equal(resolve(tools), tools);
const clean = {
  PATH: "/usr/local/bin:/usr/bin:/bin",
  HOME: "/nonexistent",
  TZ: "UTC",
};
const workerPath = join(root, "research/mmp-089/encrypt-worker.mjs"),
  agePath = join(tools, "age");
const fact = (value) =>
  appendFileSync(process.env.MMP115_FACTS, `${JSON.stringify(value)}\n`, {
    mode: 0o600,
  });
function directory(t) {
  const path = mkdtempSync(join(parent, "case-"));
  t.after(() => {
    assert.ok(path.startsWith(`${parent}/case-`) && resolve(path) === path);
    rmSync(path, { recursive: true, force: true });
  });
  return path;
}
function guardOwned(expected = []) {
  const names = [
    execFileSync(
      "/usr/bin/docker",
      ["container", "ls", "--all", "--format", "{{.Names}}"],
      { env: clean, encoding: "utf8" },
    ),
    execFileSync("/usr/bin/docker", ["volume", "ls", "--format", "{{.Name}}"], {
      env: clean,
      encoding: "utf8",
    }),
  ]
    .join("\n")
    .split(/\s+/)
    .filter((n) =>
      /^(mmp007-|mmp-reference-|mmp-inspector-|mmp008a-clock-)/.test(n),
    );
  assert.deepEqual(
    names.sort(),
    [...expected].sort(),
    "foreign worker resources: refuse global finalizer",
  );
}
test("real pinned age with ephemeral TEST identity: original-byte restore and wrong/truncated ciphertext refusal", async (t) => {
  guardOwned();
  const dir = directory(t),
    identityPath = join(dir, "test-identity"),
    keygen = join(tools, "age-keygen");
  // Root tar extraction can retain the release archive UID. Restore requires a
  // separately owned, hash-qualified binary, just like an owner-local install.
  const restoreAge = join(dir, "age");
  const qualifiedBinary = readFileSync(agePath);
  assert.equal(sha256(qualifiedBinary), DIAGNOSTIC_POLICY.ageSha256);
  // copyFileSync can preserve ownership under uid 0; create a new inode explicitly.
  writeFileSync(restoreAge, qualifiedBinary, { flag: "wx", mode: 0o755 });
  execFileSync(keygen, ["--output", identityPath], {
    env: clean,
    stdio: "pipe",
  });
  chmodSync(identityPath, 0o600);
  const recipient = execFileSync(keygen, ["-y", identityPath], {
    env: clean,
    encoding: "utf8",
    stdio: "pipe",
  }).trim();
  const capsule = syntheticCapsule(),
    result = await encryptDiagnostic(Buffer.from(JSON.stringify(capsule)), {
      agePath,
      workerPath,
      policy: {
        ...DIAGNOSTIC_POLICY,
        recipient,
        recipientSha256: sha256(recipient),
      },
    });
  assert.equal(result.cleanup, "VERIFIED_ZERO_RESOURCES");
  const ciphertextPath = join(dir, "candidate.age");
  commitPrivate(ciphertextPath, result.ciphertext, CUSTODY.ciphertext);
  // Synthetic checksum receipt only: this does NOT attest owner-recipient key possession.
  const record = receiptFor(
    "CAPTURED_UNVERIFIED",
    capsule.identity,
    { sha256: sha256(result.ciphertext), bytes: result.ciphertext.length },
    result.cleanup,
  );
  const restored = verifyAgeRestore({
    agePath: restoreAge,
    identityPath,
    ciphertextPath,
    record,
  });
  assert.deepEqual(restored.files, capsule.files);
  assert.deepEqual(restored.manifest, capsule.manifest);
  assert.deepEqual(restored.identity, capsule.identity);
  const plaintext = execFileSync(
    restoreAge,
    ["--decrypt", "--identity", identityPath],
    { env: clean, input: result.ciphertext, maxBuffer: CUSTODY.plaintext },
  );
  assert.equal(
    parseCapsule(plaintext, capsule.identity).identity.candidateSha,
    capsule.identity.candidateSha,
  );
  plaintext.fill(0);
  const wrong = join(dir, "wrong-test-identity");
  execFileSync(keygen, ["--output", wrong], { env: clean, stdio: "pipe" });
  chmodSync(wrong, 0o600);
  assert.throws(() =>
    verifyAgeRestore({
      agePath: restoreAge,
      identityPath: wrong,
      ciphertextPath,
      record,
    }),
  );
  writeFileSync(
    ciphertextPath,
    result.ciphertext.subarray(0, result.ciphertext.length - 1),
  );
  assert.throws(() =>
    verifyAgeRestore({
      agePath: restoreAge,
      identityPath,
      ciphertextPath,
      record,
    }),
  );
  guardOwned();
  fact({
    id: "real-age-test-key-restore",
    status: "PASS",
    sourceByteIdentity: "MATCH",
    keyScope: "EPHEMERAL_TEST_ONLY",
    realOwnerRestore: "NOT_RUN",
    normalCleanup: "ZERO",
    verification: "UNVERIFIED",
  });
});
test("production generation/lease/credential-free collector and both actual independent finalizers", async (t) => {
  guardOwned();
  const dir = directory(t);
  mkdirSync(join(dir, "mmp089-tools"), { mode: 0o700 });
  copyFileSync(agePath, join(dir, "mmp089-tools/age"));
  chmodSync(join(dir, "mmp089-tools/age"), 0o755);
  const known = await admitDirectory(
    join(root, "packages/target-worker/fixtures/workshop"),
    WORKSHOP_CANDIDATE_SHA,
  );
  const capsule = syntheticCapsule();
  capsule.files = known.files;
  capsule.identity.candidateSha = known.candidateSha;
  capsule.manifest = known.files.map((f) => ({
    path: f.path,
    bytes: Buffer.byteLength(f.content),
    sha256: f.sha256,
  }));
  const f = await offlinePaid(t, dir, capsule);
  const result = await runPublicMigration({
    context: f.context,
    selection: "meta",
    headSha: f.capsule.identity.headSha,
    parent: dir,
    authorization: f.authorization,
    signal: new AbortController().signal,
  });
  assert.equal(result.modelGeneration, "GENERATED");
  assert.equal(result.custody?.state, "CAPTURED_UNVERIFIED");
  assert.equal(f.calls.length, 1);
  const spool = join(dir, "mmp115-custody"),
    ciphertextPath = join(spool, "candidate.age"),
    bytes = cipherAt(ciphertextPath, result.custody);
  const output = join(dir, "meta-paid-public");
  mkdirSync(output, { mode: 0o700 });
  writeFileSync(join(output, "trial.json"), JSON.stringify(result), {
    mode: 0o600,
  });
  delete process.env.MODEL_API_KEY;
  await custodyStep("capture", process.env);
  guardOwned();
  await custodyStep("finalize", process.env);
  await custodyStep("prepare-upload", process.env);
  assert.throws(() =>
    requireStoredCheckpoint(process.env, result.custody.identity),
  );
  const ready = readRecord(join(spool, "ready.json")),
    fixture = artifactFixture(result.custody),
    readback = join(dir, "mmp115-readback");
  // Local simulated transport ONLY. No GitHub upload/download occurs.
  commitPrivate(join(readback, "candidate.age"), bytes, CUSTODY.ciphertext);
  saveTransport(
    spool,
    ready,
    fixture.artifact,
    fixture.run,
    fixture.ack,
    readback,
  );
  const storedBefore = readFileSync(join(spool, "stored.json"));
  const invalidRoot = join(dir, "invalid-root"),
    verifierParent = join(dir, "verification");
  mkdirSync(invalidRoot);
  mkdirSync(verifierParent);
  const report = await validateCustodiedMigration(
    {
      context: f.context,
      root: invalidRoot,
      parent: verifierParent,
      headSha: f.capsule.identity.headSha,
      candidateRoot: result.candidateRoot,
      candidateSha: result.candidateSha,
      signal: new AbortController().signal,
    },
    requireStoredCheckpoint(process.env, result.custody.identity),
  );
  assert.deepEqual(report.blockers, ["PUBLIC_DOCKER_ERROR"]);
  assert.deepEqual(readFileSync(join(spool, "stored.json")), storedBefore);
  assert.deepEqual(readFileSync(ciphertextPath), bytes);
  guardOwned();
  const post = spawnSync(
    process.execPath,
    [join(root, "packages/differential/src/workshop-finalizer.mjs")],
    {
      env: {
        ...clean,
        WORKSHOP_PUBLIC_OUTPUT: output,
        PILOT_HEAD_SHA: f.capsule.identity.headSha,
      },
      encoding: "utf8",
      timeout: 30000,
    },
  );
  assert.equal(post.status, 0);
  const finalizer = JSON.parse(readFileSync(join(output, "finalizer.json")));
  assert.equal(finalizer.status, "PASS");
  assert.equal(finalizer.emergencyRemoved, 0);
  fact({
    id: "production-capture-actual-finalizers",
    status: "PASS",
    identity: result.custody.identity,
    ciphertextSha256: sha256(bytes),
    ciphertextBytes: bytes.length,
    recipientScope: "FIXED_PRODUCTION_PUBLIC_RECIPIENT",
    candidateScope: "PINNED_KNOWN_GOOD_FIXTURE_NOT_AI",
    modelAdapter: "SYNTHETIC_NATIVE_HTTPS_NO_NETWORK",
    externalModelRequests: 0,
    interceptedRequests: f.calls.length,
    preOracleInventory: "0/0/0",
    postOracleInventory: "0/0/0",
    oracleCandidateExecution: "NOT_RUN",
    transport: "LOCAL_MOCK_NOT_GITHUB",
    storedSurvivesValidationError: true,
  });
});
test("real encryptor crash and cancellation reject; actual emergency cleanup blocks checkpoint", async (t) => {
  guardOwned();
  const dir = directory(t),
    capsule = syntheticCapsule();
  for (const patch of [
    { recipient: "" },
    { recipientSha256: "0".repeat(64) },
    { image: "node:latest" },
    { ageSha256: "0".repeat(64) },
  ]) {
    await assert.rejects(
      encryptDiagnostic(Buffer.from("synthetic pin refusal"), {
        agePath,
        workerPath,
        policy: { ...DIAGNOSTIC_POLICY, ...patch },
      }),
    );
    guardOwned();
  }
  for (const mode of ["crash", "cancel", "deadline"]) {
    const fault = join(dir, `${mode}.mjs`);
    writeFileSync(
      fault,
      mode === "crash"
        ? "process.exit(23);\n"
        : "setInterval(() => {}, 1000);\n",
      { mode: 0o644 },
    );
    chmodSync(fault, 0o644);
    const controller = new AbortController(),
      timer =
        mode === "cancel"
          ? setTimeout(() => controller.abort(), 1000)
          : undefined;
    const started = performance.now();
    try {
      await assert.rejects(
        encryptDiagnostic(Buffer.from("original synthetic fault control"), {
          agePath,
          workerPath: fault,
          signal: controller.signal,
        }),
      );
      if (mode === "deadline") assert.ok(performance.now() - started >= 29000);
    } finally {
      clearTimeout(timer);
    }
    guardOwned();
  }
  const name = `mmp007-mmp115-emergency-${randomUUID()}`;
  execFileSync(
    "/usr/bin/docker",
    [
      "create",
      "--name",
      name,
      "--network",
      "none",
      "--entrypoint",
      "/usr/local/bin/node",
      DIAGNOSTIC_POLICY.image,
      "--version",
    ],
    { env: clean, stdio: "pipe" },
  );
  guardOwned([name]);
  const finalizer = await finalizeCustody(capsule.identity);
  assert.equal(finalizer.emergencyRemoved, 1);
  guardOwned();
  const record = receiptFor(
    "CAPTURED_UNVERIFIED",
    capsule.identity,
    { sha256: "a".repeat(64), bytes: 200 },
    "VERIFIED_ZERO_RESOURCES",
  );
  assert.throws(() => checkpointReady(record, finalizer, capsule.identity));
  fact({
    id: "real-encryptor-faults-and-emergency",
    status: "PASS",
    crash: "REJECTED",
    cancellation: "REJECTED",
    actualThirtySecondDeadline: "REJECTED",
    emergencyRemoved: 1,
    checkpoint: "BLOCKED",
    remainingOwnedResources: "0/0",
  });
});
