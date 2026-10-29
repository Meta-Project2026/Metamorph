// Original synthetic candidate. Authentic paid-path validator, no provider call.
// Run only on the authorized disposable Linux Docker host; never on host TS.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { collectDiagnosticPackage, DIAGNOSTIC_POLICY, preservationRecord, requireNormalCleanup } from "../../packages/agent-real/src/private-diagnostics.mjs";
import { encryptDiagnostic } from "../../packages/agent-real/src/encrypt-diagnostics.mjs";
import { admitDirectory, sha256, validateBundle } from "../../packages/target-worker/src/admission.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
assert.ok(process.platform === "linux" && !process.env.MODEL_API_KEY);
process.umask(0o077);
const output = process.env.MMP089_PUBLIC_OUTPUT;
assert.ok(output);
mkdirSync(output, { recursive: true, mode: 0o700 });
const parent = process.env.MMP089_PRIVATE_PARENT ?? mkdtempSync(join(tmpdir(), "mmp089-controls-"));
mkdirSync(parent, { recursive: true, mode: 0o700 });
const headSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
assert.equal(headSha, process.env.AGENT_HEAD_SHA);
const expected = { runId: "890001", runAttempt: "1", headSha };
const runnerTemp = join(parent, "runner");
mkdirSync(join(runnerTemp, "meta-paid-public"), { recursive: true, mode: 0o700 });
mkdirSync(join(runnerTemp, "meta-paid-private"), { mode: 0o700 });
const candidateRoot = join(parent, "candidate");
mkdirSync(join(candidateRoot, "src"), { recursive: true, mode: 0o700 });
const canary = "MMP089_PRIVATE_SOURCE_CANARY";
writeFileSync(join(candidateRoot, "src/main.ts"), `export const value: number = '${canary}';\n`, { mode: 0o600 });
const candidate = await admitDirectory(candidateRoot);
const syntheticTrial = { format: "mmp078-public-paid-trial-v1", headSha, sourceSha: DIAGNOSTIC_POLICY.sourceSha, candidateSha: candidate.candidateSha, trialRunId: expected.runId, budgetAuth: { runId: expected.runId, headSha, sourceSha: DIAGNOSTIC_POLICY.sourceSha }, modelGeneration: "GENERATED", aiGeneration: "AI_GENERATION_NOT_RUN", generatedRequests: 0 };
writeFileSync(join(runnerTemp, "meta-paid-public/trial.json"), JSON.stringify(syntheticTrial), { mode: 0o600 });
writeFileSync(join(runnerTemp, "meta-paid-private/transfer.json"), JSON.stringify({ candidateRoot, candidateSha: candidate.candidateSha }), { mode: 0o600 });
const validator = spawnSync(process.execPath, ["--import", join(root, "research/mmp-086/network-guard.mjs"), join(root, "research/mmp-078/validate-candidate.mjs")], { cwd: root, env: { PATH: process.env.PATH, RUNNER_TEMP: runnerTemp, GITHUB_SHA: headSha }, timeout: 10 * 60 * 1000, maxBuffer: 1024 * 1024 });
const rows = [];
let status = "FAIL";
let ciphertext;
let publicRecord;
const cleanEnv = { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: parent, TZ: "UTC" };
const agePath = process.env.MMP089_AGE_PATH;
const keygenPath = join(dirname(agePath), "age-keygen");
const keyPath = join(parent, "throwaway-identity.txt");
const wrongKeyPath = join(parent, "wrong-throwaway-identity.txt");
const encrypt = async (bytes, overrides = {}) => encryptDiagnostic(bytes, { agePath, workerPath: join(root, "research/mmp-089/encrypt-worker.mjs"), ...overrides });
const check = async (id, body) => { await body(); rows.push({ id, status: "PASS" }); };
try {
  const trial = JSON.parse(readFileSync(join(runnerTemp, "meta-paid-public/trial.json"), "utf8"));
  const network = JSON.parse(readFileSync(join(runnerTemp, "meta-paid-public/network.json"), "utf8"));
  await check("authentic-network-off-g1-fail", () => {
    assert.equal(validator.status, 1); assert.equal(validator.error, undefined);
    assert.equal(trial.publicG1, "FAIL");
    assert.equal(trial.publicG2, "INCONCLUSIVE"); assert.equal(trial.publicG3, "INCONCLUSIVE");
    assert.equal(trial.G0, "INCONCLUSIVE"); assert.equal(trial.G4, "INCONCLUSIVE"); assert.equal(trial.product, "NOT_ESTABLISHED");
    assert.equal(trial.attempts[0].pairs[0].compilerDiagnostics.entries[0].code, "TS2322");
    requireNormalCleanup(trial.cleanup);
    assert.equal(network.sourceFetches, 1); assert.equal(network.blockedRequests, 0);
  });
  const pack = collectDiagnosticPackage(trial, expected, join(runnerTemp, "meta-paid-verification"));
  const plaintext = Buffer.from(JSON.stringify(pack));
  await check("exact-source-and-authentic-phase-receipts-selected", () => {
    assert.deepEqual(pack.files, candidate.files);
    assert.equal(pack.compiler.checks[0].phase, "typecheck"); assert.notEqual(pack.compiler.checks[0].exitCode, 0);
    assert.equal(sha256(JSON.stringify(pack.compiler)), pack.compilerSha256);
    assert.equal(validateBundle(pack.files).candidateSha, candidate.candidateSha);
    assert.doesNotMatch(JSON.stringify(pack), /workerEvidence|targetFailure|budgetAuth|oracle-raw|authorization|responseBody/);
  });
  for (const [id, change] of [
    ["wrong-head", (t) => { t.headSha = "f".repeat(40); }],
    ["wrong-source", (t) => { t.sourceSha = "f".repeat(40); }],
    ["wrong-candidate", (t) => { t.candidateSha = "f".repeat(64); }],
    ["missing-source-pack-id", (t) => { t.attempts[0].pairs[0].packs.pop(); }],
    ["wrong-index-sha", (t) => { t.attempts[0].pairs[0].packs[0].sha256 = "f".repeat(64); }],
    ["wrong-pair", (t) => { t.attempts[0].pairs[0].pairId = "f".repeat(36); }],
    ["normal-cleanup-error", (t) => { t.cleanup.emergencyRemoved = 1; }],
  ]) await check(id, () => { const copy = structuredClone(trial); change(copy); assert.throws(() => collectDiagnosticPackage(copy, expected, join(runnerTemp, "meta-paid-verification"))); });
  assert.equal(sha256(readFileSync(agePath)), DIAGNOSTIC_POLICY.ageSha256);
  assert.equal(sha256(readFileSync(keygenPath)), DIAGNOSTIC_POLICY.keygenSha256);
  for (const path of [keyPath, wrongKeyPath]) execFileSync(keygenPath, ["--output", path], { env: cleanEnv, stdio: "pipe", timeout: 10000 });
  const recipient = execFileSync(keygenPath, ["-y", keyPath], { env: cleanEnv, encoding: "utf8", stdio: "pipe", timeout: 10000 }).trim();
  const syntheticPolicy = { ...DIAGNOSTIC_POLICY, recipient, recipientSha256: sha256(recipient) };
  await check("throwaway-key-encryption-and-exact-decryption-hash-equality", async () => {
    const encrypted = await encrypt(Buffer.from(plaintext), { policy: syntheticPolicy });
    ciphertext = encrypted.ciphertext;
    assert.equal(encrypted.cleanup, "VERIFIED_ZERO_RESOURCES");
    const decrypted = execFileSync(agePath, ["--decrypt", "--identity", keyPath], { env: cleanEnv, input: ciphertext, maxBuffer: 5 * 1024 * 1024, timeout: 10000, stdio: "pipe" });
    assert.equal(sha256(decrypted), sha256(plaintext));
    const restored = JSON.parse(decrypted);
    assert.deepEqual(restored, pack);
    assert.equal(validateBundle(restored.files).candidateSha, candidate.candidateSha);
    for (const file of restored.files) { const entry = restored.manifest.find((f) => f.path === file.path); assert.equal(entry.sha256, sha256(file.content)); assert.equal(entry.bytes, Buffer.byteLength(file.content)); }
    decrypted.fill(0);
  });
  await check("wrong-identity-refused", () => { const result = spawnSync(agePath, ["--decrypt", "--identity", wrongKeyPath], { env: cleanEnv, input: ciphertext, timeout: 10000, maxBuffer: 5 * 1024 * 1024 }); assert.notEqual(result.status, 0); });
  await check("tampered-ciphertext-refused", () => { const tampered = Buffer.from(ciphertext); tampered[tampered.length - 1] ^= 1; const result = spawnSync(agePath, ["--decrypt", "--identity", keyPath], { env: cleanEnv, input: tampered, timeout: 10000, maxBuffer: 5 * 1024 * 1024 }); assert.notEqual(result.status, 0); });
  await check("wrong-recipient-pin-refused", async () => { await assert.rejects(encrypt(Buffer.from(plaintext), { policy: { ...syntheticPolicy, recipientSha256: "f".repeat(64) } })); });
  await check("oversized-plaintext-refused", async () => { await assert.rejects(encrypt(Buffer.alloc(DIAGNOSTIC_POLICY.plaintextBytes + 1), { policy: syntheticPolicy })); });
  const crashWorker = join(parent, "crash-worker.mjs");
  writeFileSync(crashWorker, "process.exit(23);\n", { mode: 0o644 });
  await check("encryptor-process-crash-cleanup", async () => { await assert.rejects(encrypt(Buffer.from(plaintext), { policy: syntheticPolicy, workerPath: crashWorker })); });
  const hangWorker = join(parent, "hang-worker.mjs");
  writeFileSync(hangWorker, "setInterval(() => {}, 1000);\n", { mode: 0o644 });
  await check("encryptor-abort-cleanup", async () => { const abort = new AbortController(); const timer = setTimeout(() => abort.abort(), 1500); try { await assert.rejects(encrypt(Buffer.from(plaintext), { policy: syntheticPolicy, workerPath: hangWorker, signal: abort.signal })); } finally { clearTimeout(timer); } });
  publicRecord = preservationRecord("ENCRYPTED_PENDING_UPLOAD", pack.identity, { sha256: sha256(ciphertext), bytes: ciphertext.length }, "VERIFIED_ZERO_RESOURCES");
  await check("no-plaintext-in-public-record", () => { assert.doesNotMatch(JSON.stringify(publicRecord), /MMP089_PRIVATE|stdout|stderr|src\/|error TS|\.ts|AGE-SECRET/); assert.equal(publicRecord.upload, "NOT_RUN"); });
  // Kept private for the independent reviewer; never part of a public artifact.
  writeFileSync(join(parent, "roundtrip.age"), ciphertext, { mode: 0o600 });
  writeFileSync(join(parent, "expected-package.json"), plaintext, { mode: 0o600 });
  writeFileSync(join(parent, "expected-digests.json"), JSON.stringify({ plaintextSha256: sha256(plaintext), ciphertextSha256: sha256(ciphertext), candidateSha: candidate.candidateSha, compilerSha256: pack.compilerSha256 }), { mode: 0o600 });
  plaintext.fill(0);
  status = "PASS";
} catch {
  process.exitCode = 1;
} finally {
  const finalizer = spawnSync(process.execPath, [join(root, "packages/differential/src/workshop-finalizer.mjs")], { cwd: root, env: { PATH: process.env.PATH, WORKSHOP_PUBLIC_OUTPUT: join(runnerTemp, "meta-paid-public"), PILOT_HEAD_SHA: headSha }, timeout: 60000, maxBuffer: 1024 * 1024 });
  let finalizerRecord = null;
  try { finalizerRecord = JSON.parse(readFileSync(join(runnerTemp, "meta-paid-public/finalizer.json"), "utf8")); assert.equal(finalizer.status, 0); assert.equal(finalizerRecord.status, "PASS"); assert.equal(finalizerRecord.emergencyRemoved, 0); assert.deepEqual(finalizerRecord.inventory, { containers: 0, volumes: 0 }); rows.push({ id: "independent-finalizer-zero-resources", status: "PASS" }); }
  catch { status = "FAIL"; process.exitCode = 1; }
  const result = { format: "mmp089-offline-controls-v1", headSha, status, execution: "ACTUAL_VALIDATOR_REAL_NETWORK_OFF_DOCKER_SYNTHETIC_INPUT", aiGeneration: "AI_GENERATION_NOT_RUN", metaRequests: 0, validatorExitCode: validator.status, cases: rows, finalizer: finalizerRecord, preservation: publicRecord, privateKey: "THROWAWAY_ONLY_NEVER_OWNER_IDENTITY", ownerRecipientDecryptability: "NOT_ESTABLISHED", product: "NOT_ESTABLISHED" };
  writeFileSync(join(output, "controls.json"), `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
  console.log(`MMP089 ${status}; controls=${rows.length}; source/stderr/private keys withheld`);
}
