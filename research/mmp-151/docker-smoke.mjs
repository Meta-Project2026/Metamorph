// Manual local SYNTHETIC smoke. No paid provider, GH API or workflow dispatch.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runSyntheticAutonomousRepair } from "../../packages/agent-real/src/autonomous-repair.mjs";
import { finalizeCustody } from "../../packages/agent-real/src/custody-checkpoint.mjs";
import { encryptDiagnostic } from "../../packages/agent-real/src/encrypt-diagnostics.mjs";
import { DIAGNOSTIC_POLICY } from "../../packages/agent-real/src/private-diagnostics.mjs";
import { context, wireReply } from "../../packages/agent-real/test/autonomous-repair-fixture.mjs";
import { WORKSHOP_CANDIDATE_SHA } from "../../packages/differential/src/workshop-policy.mjs";
import { admitDirectory, sha256 } from "../../packages/target-worker/src/admission.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const parent = process.env.MMP151_PRIVATE, output = process.env.MMP151_OUTPUT;
const env = { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: "/nonexistent", TZ: "UTC" };
assert.equal(process.platform, "linux");
assert.ok(parent?.startsWith("/var/lib/docker/volumes/mmp151-private-"));
assert.ok(output?.startsWith("/var/lib/docker/volumes/mmp151-output-"));
assert.ok(!process.env.MODEL_API_KEY && !process.env.GH_TOKEN && !process.env.ACTIONS_RUNTIME_TOKEN);
process.umask(0o077);
const headSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
assert.equal(headSha, process.env.MMP151_HEAD);
const source = await admitDirectory(join(root, "packages/target-worker/fixtures/workshop"), WORKSHOP_CANDIDATE_SHA);
const good = source.files.map(({ path, content }) => ({ path, content }));
// Original generic boolean-serialization defect, independent of the paid manual
// derivative. This reused public fixture is SYNTHETIC and never a model template.
const needle = "JSON.stringify(response)";
assert.equal(good.find((f) => f.path === "src/main.ts").content.split(needle).length, 2);
const broken = good.map((f) => ({ ...f, content: f.path === "src/main.ts"
  ? f.content.replace(needle, 'JSON.stringify(response, (_key, value) => typeof value === "boolean" ? String(value) : value)') : f.content }));
const agePath = join(parent, "tools/mmp089-tools/age"), keygen = join(parent, "tools/mmp089-tools/age-keygen");
assert.equal(sha256(readFileSync(keygen)), DIAGNOSTIC_POLICY.keygenSha256);
const identity = join(parent, "test-identity");
execFileSync(keygen, ["--output", identity], { env, stdio: "pipe" });
const recipient = execFileSync(keygen, ["-y", identity], { env, encoding: "utf8", stdio: "pipe" }).trim();
const verifications = [], children = new Set();
let sends = 0;
const shutdown = new AbortController();
process.on("SIGTERM", () => shutdown.abort());
process.on("SIGINT", () => shutdown.abort());
const result = await runSyntheticAutonomousRepair({
  context: context(), parent, runId: randomUUID(), headSha,
  signal: AbortSignal.any([shutdown.signal, AbortSignal.timeout(25 * 60 * 1000)]),
  oracleTimeoutMs: 12 * 60 * 1000, custodyTimeoutMs: 60000,
  transport: async ({ body }) => {
    const prompt = JSON.parse(JSON.parse(body).messages[1].content);
    sends++;
    if (sends === 2) {
      assert.equal(prompt.action, "repair"); assert.deepEqual(prompt.previousGeneratedChanges, broken);
      assert.ok(prompt.repairCodes.includes("HTTP_JSON_TYPE"));
    }
    return wireReply(sends === 1 ? broken : good);
  },
  custody: async ({ attempt, candidateSha, bundle, signal }) => {
    const encrypted = await encryptDiagnostic(Buffer.from(JSON.stringify({ execution: "SYNTHETIC", attempt, candidateSha, files: bundle.files })), {
      agePath, workerPath: join(root, "research/mmp-089/encrypt-worker.mjs"), signal,
      policy: { ...DIAGNOSTIC_POLICY, recipient, recipientSha256: sha256(recipient) },
    });
    const path = join(parent, `candidate-${attempt}.age`);
    writeFileSync(path, encrypted.ciphertext, { flag: "wx", mode: 0o600, flush: true });
    const readback = readFileSync(path);
    // Separate process decrypts ephemeral TEST-key ciphertext and independently
    // compares the entire source capsule. This is local readback, NOT GH custody.
    const restored = JSON.parse(execFileSync(agePath, ["--decrypt", "--identity", identity, path], { env, maxBuffer: 3 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] }));
    assert.equal(restored.candidateSha, candidateSha); assert.deepEqual(restored.files, bundle.files);
    return { execution: "SYNTHETIC", attempt, candidateSha, acknowledged: true,
      cleanup: encrypted.cleanup, ciphertext: encrypted.ciphertext, readback, ciphertextSha256: sha256(readback) };
  },
  verify: async ({ attempt, candidateRoot, candidateSha, signal }) => {
    const dir = join(parent, `oracle-${attempt}`); mkdirSync(dir, { mode: 0o700 });
    const transfer = join(parent, `transfer-${attempt}.json`), report = join(parent, `verification-${attempt}.json`);
    writeFileSync(transfer, JSON.stringify({ candidateRoot, candidateSha, parent: dir, headSha }), { flag: "wx", mode: 0o600 });
    const child = spawn(process.execPath, [join(root, "research/mmp-151/oracle-child.mjs"), transfer, report], { env, cwd: root, stdio: ["ignore", "ignore", "ignore"] });
    const settled = new Promise((resolve, reject) => {
      const stop = () => child.kill("SIGTERM");
      signal.addEventListener("abort", stop, { once: true });
      if (signal.aborted) stop();
      const kill = setTimeout(() => child.kill("SIGKILL"), 13 * 60 * 1000);
      child.on("error", reject);
      child.on("close", (code) => { clearTimeout(kill); signal.removeEventListener("abort", stop); code === 0 ? resolve() : reject(Error("ORACLE_CHILD_ERROR")); });
    });
    children.add(settled); await settled;
    const verified = JSON.parse(readFileSync(report, "utf8"));
    verifications.push({ candidateSha, publicG1: verified.publicG1, publicG2: verified.publicG2,
      publicG3: verified.publicG3, coverage: verified.attempts[0]?.coverage ?? null,
      cleanup: verified.cleanup, blockers: verified.blockers });
    return verified;
  },
  cleanup: async () => {
    await Promise.allSettled([...children]);
    const f = await finalizeCustody(null);
    return { status: "VERIFIED_ZERO_RESOURCES", containers: f.containers, volumes: f.volumes, emergencyRemoved: f.emergencyRemoved };
  },
});
const record = { headSha, ...result, verifications, crypto: "PINNED_AGE_EPHEMERAL_TEST_KEY",
  artifactTransport: "LOCAL_READBACK_ONLY", signedRepairAdmission: "NOT_IMPLEMENTED",
  fixture: "REUSED_PUBLIC_WORKSHOP_WITH_ORIGINAL_BOOLEAN_MUTANT", historicalCandidates: "NOT_USED" };
writeFileSync(join(output, "summary.json"), `${JSON.stringify(record, null, 2)}\n`, { flag: "wx", mode: 0o600 });
const ok = result.status === "SYNTHETIC_PUBLIC_PASS" && sends === 2 &&
  result.completedOracleVerifications === 2 && result.cleanup === "VERIFIED_ZERO_RESOURCES" &&
  verifications[0]?.publicG2 === "FAIL" && verifications[1]?.publicG2 === "PASS" && verifications[1]?.publicG3 === "PASS";
console.log(`MMP151_SYNTHETIC_${ok ? "PASS" : "ERROR"}; requests=${sends}; verifications=${result.completedOracleVerifications}; paid=0`);
process.exitCode = ok ? 0 : 1;
