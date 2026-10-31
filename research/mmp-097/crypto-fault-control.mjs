// Disposable trusted process harness. Real unchanged encryptDiagnostic + Docker.
// No owner identity, candidate execution on host, artifact or raw output.
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { encryptDiagnostic } from "../../packages/agent-real/src/encrypt-diagnostics.mjs";
import { DIAGNOSTIC_POLICY } from "../../packages/agent-real/src/private-diagnostics.mjs";
import { observedExit } from "./qualification-outcome.mjs";

assert.equal(process.platform, "linux");
assert.ok(
  !process.env.MODEL_API_KEY &&
    !process.env.GH_TOKEN &&
    !process.env.ACTIONS_RUNTIME_TOKEN,
);
const mode = process.argv[2];
assert.ok(
  ["crash", "deadline", "ciphertext-cap", "cleanup-fault"].includes(mode),
);
const root = fileURLToPath(new URL("../../", import.meta.url));
const directory = process.env.MMP099_FAULT_PARENT;
mkdirSync(directory, { mode: 0o700 });
const env = {
  PATH: "/usr/local/bin:/usr/bin:/bin",
  HOME: "/nonexistent",
  TZ: "UTC",
};
let workerPath = join(root, "research/mmp-089/encrypt-worker.mjs");
if (mode !== "cleanup-fault") {
  workerPath = join(directory, "worker.mjs");
  writeFileSync(
    workerPath,
    mode === "crash"
      ? "process.exit(23);\n"
      : mode === "deadline"
        ? "setInterval(() => {}, 1000);\n"
        : 'process.stdout.write("age-encryption.org/v1\\n"); process.stdout.write(Buffer.alloc(5 * 1024 * 1024 + 1)); setInterval(() => {}, 1000);\n',
    { mode: 0o644 },
  );
}
const originalSpawn = childProcess.spawn;
const run = { exitCode: null, signal: null, bytes: 0, killed: false };
let ownedName;
let injectedCleanupExit;
let header = Buffer.alloc(0);
childProcess.spawn = (file, args, options) => {
  if (file === "/usr/bin/docker" && args[0] === "run") {
    ownedName = args[args.indexOf("--name") + 1];
    assert.match(ownedName, /^mmp007-diagnostics-[a-f0-9-]{36}$/);
    const child = originalSpawn(file, args, options);
    for (const stream of [child.stdout, child.stderr])
      stream.on("data", (bytes) => {
        run.bytes += bytes.length;
      });
    child.stdout.on("data", (bytes) => {
      if (header.length < 22)
        header = Buffer.concat([header, bytes]).subarray(0, 22);
    });
    child.on("close", (code, signal) => {
      run.exitCode = code;
      run.signal = signal;
      run.killed = child.killed;
    });
    return child;
  }
  if (
    file === "/usr/bin/docker" &&
    args[0] === "rm" &&
    mode === "cleanup-fault"
  ) {
    assert.equal(args[2], ownedName);
    // Real failing child, only at the cleanup boundary. The prior encryptor
    // really ran; no mocked Docker/crypto output or production source changes.
    const child = originalSpawn(
      process.execPath,
      ["-e", "process.exit(42)"],
      options,
    );
    child.on("close", (code) => {
      injectedCleanupExit = code;
    });
    return child;
  }
  return originalSpawn(file, args, options);
};
syncBuiltinESMExports();
const report = {
  format: "mmp099-crypto-fault-v1",
  id: mode,
  execution:
    mode === "cleanup-fault"
      ? "ACTUAL_ENCRYPTION_WITH_REAL_CHILD_CLEANUP_FAULT_HARNESS"
      : "ACTUAL_DOCKER_ENCRYPTOR_FAULT_WORKER",
  status: "ERROR",
};
const started = performance.now();
let observed;
try {
  try {
    const output = await encryptDiagnostic(
      Buffer.from("MMP099 harmless public crypto fault control\n"),
      { agePath: process.env.MMP089_AGE_PATH, workerPath },
    );
    output.ciphertext.fill(0);
  } catch (error) {
    observed = error.message;
  }
  report.elapsedMs = Math.round(performance.now() - started);
  assert.equal(
    observed,
    mode === "cleanup-fault"
      ? "DIAGNOSTIC_CLEANUP_ERROR"
      : "DIAGNOSTIC_ENCRYPTION_ERROR",
  );
  if (mode === "crash") {
    assert.equal(run.exitCode, 23);
    assert.equal(run.signal, null);
  }
  if (mode === "deadline") {
    assert.equal(run.signal, "SIGKILL");
    assert.equal(run.killed, true);
    assert.ok(
      report.elapsedMs >= DIAGNOSTIC_POLICY.deadlineMs - 250 &&
        report.elapsedMs <= 60000,
    );
  }
  if (mode === "ciphertext-cap") {
    assert.ok(run.bytes > DIAGNOSTIC_POLICY.ciphertextBytes);
    assert.equal(run.killed, true);
  }
  if (mode === "cleanup-fault") {
    assert.equal(run.exitCode, 0);
    assert.equal(run.signal, null);
    assert.equal(injectedCleanupExit, 42);
    assert.equal(header.toString(), "age-encryption.org/v1\n");
  }
  report.observedError = observed;
  report.run = run;
  report.injectedCleanupExit = injectedCleanupExit ?? null;
  report.status = "PASS";
} catch {
  process.exitCode = 1;
} finally {
  childProcess.spawn = originalSpawn;
  syncBuiltinESMExports();
  try {
    assert.ok(ownedName);
    const before = childProcess.spawnSync(
      "/usr/bin/docker",
      [
        "container",
        "ls",
        "--all",
        "--filter",
        `name=^/${ownedName}$`,
        "--format",
        "{{.ID}}",
      ],
      { env, timeout: 10000 },
    );
    assert.equal(observedExit(before), 0);
    const count = before.stdout.toString().trim() ? 1 : 0;
    assert.equal(count, mode === "cleanup-fault" ? 1 : 0);
    report.intentionalFaultRecoveryRemoved = count;
    if (count) {
      const removed = childProcess.spawnSync(
        "/usr/bin/docker",
        ["rm", "--force", ownedName],
        { env, timeout: 10000 },
      );
      assert.equal(observedExit(removed), 0);
    }
    const after = childProcess.spawnSync(
      "/usr/bin/docker",
      [
        "container",
        "ls",
        "--all",
        "--filter",
        `name=^/${ownedName}$`,
        "--format",
        "{{.ID}}",
      ],
      { env, timeout: 10000 },
    );
    assert.equal(observedExit(after), 0);
    assert.equal(after.stdout.toString().trim(), "");
    report.postRecoveryInventory = 0;
  } catch {
    report.status = "ERROR";
    report.cleanup = "ERROR";
    process.exitCode = 1;
  }
  console.log(`MMP099_CRYPTO ${JSON.stringify(report)}`);
}
