// PR98-only trusted supervisor. Never prints raw child output or uploads files.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DIAGNOSTIC_POLICY } from "../../packages/agent-real/src/private-diagnostics.mjs";
import { sha256 } from "../../packages/target-worker/src/admission.mjs";
import {
  publicCase,
  publicCrypto,
  publicFaults,
  publicNegatives,
  publicProcesses,
} from "./hosted-receipt.mjs";
import { preparationProbe } from "./preparation-probe.mjs";
import { controlFailure, observedExit } from "./qualification-outcome.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const allowed = [
  "PATH",
  "HOME",
  "TZ",
  "RUNNER_TEMP",
  "AGENT_HEAD_SHA",
  "MMP097_PRIVATE_PARENT",
  "MMP097_PUBLIC_OUTPUT",
  "MMP089_AGE_PATH",
];
assert.equal(process.platform, "linux");
assert.ok(Object.keys(process.env).every((key) => allowed.includes(key)));
const temp = resolve(process.env.RUNNER_TEMP);
assert.ok(
  isAbsolute(process.env.RUNNER_TEMP) &&
    relative(resolve(root), temp).startsWith("../"),
);
const parent = join(temp, "mmp099-private");
const output = join(temp, "mmp099-output");
const probe = join(temp, "mmp099-probe");
assert.equal(parent, process.env.MMP097_PRIVATE_PARENT);
assert.equal(output, process.env.MMP097_PUBLIC_OUTPUT);
assert.equal(process.env.MMP089_AGE_PATH, join(temp, "mmp089-tools/age"));
assert.match(process.env.AGENT_HEAD_SHA, /^[a-f0-9]{40}$/);
const env = Object.fromEntries(allowed.map((key) => [key, process.env[key]]));
const run = (args, timeout = 60000) =>
  spawnSync(process.execPath, args, {
    cwd: root,
    env,
    timeout,
    maxBuffer: 1024 * 1024,
  });
const tool = (file, args) =>
  spawnSync(file, args, {
    cwd: root,
    env,
    timeout: 30000,
    maxBuffer: 1024 * 1024,
  });
const read = (path) => {
  const st = lstatSync(path);
  assert.ok(
    st.isFile() &&
      !st.isSymbolicLink() &&
      st.nlink === 1 &&
      st.size <= 256 * 1024,
  );
  return JSON.parse(readFileSync(path, "utf8"));
};
const cleanup = () => {
  // Only exact fresh task children of the actual runner temp; never checkout.
  for (const [name, path] of [
    ["mmp099-private", parent],
    ["mmp099-output", output],
    ["mmp099-probe", probe],
  ]) {
    assert.equal(resolve(path), join(temp, name));
    assert.ok(
      relative(root, path).startsWith("..") &&
        !relative(temp, path).startsWith(".."),
    );
    if (existsSync(path)) {
      assert.ok(!lstatSync(path).isSymbolicLink());
      rmSync(path, { recursive: true, force: true });
    }
    assert.ok(!existsSync(path));
  }
  return "PRIVATE_TEMP_REMOVED_NOT_SECURE_ERASE";
};
const finalize = () => {
  mkdirSync(output, { recursive: true, mode: 0o700 });
  const child = spawnSync(
    process.execPath,
    [join(root, "packages/differential/src/workshop-finalizer.mjs")],
    {
      cwd: root,
      env: {
        PATH: env.PATH,
        HOME: env.HOME,
        TZ: "UTC",
        WORKSHOP_PUBLIC_OUTPUT: output,
        PILOT_HEAD_SHA: env.AGENT_HEAD_SHA,
      },
      timeout: 60000,
      maxBuffer: 1024 * 1024,
    },
  );
  assert.equal(observedExit(child), 0);
  const receipt = read(join(output, "finalizer.json"));
  assert.equal(receipt.headSha, env.AGENT_HEAD_SHA);
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.emergencyRemoved, 0);
  assert.deepEqual(receipt.inventory, { containers: 0, volumes: 0 });
  return {
    exitCode: child.status,
    status: "PASS",
    inventory: { containers: 0, volumes: 0 },
    emergencyRemoved: 0,
  };
};
const cleanOnly = process.argv[2] === "--cleanup";
let stage = "PREPARATION";
const result = {
  format: "mmp099-hosted-receipt-v1",
  headSha: env.AGENT_HEAD_SHA,
  decision: "NO_GO",
  node: process.version,
  commands: [],
  cases: [],
  actualDocker: "NOT_TESTED",
  actualCrypto: "NOT_TESTED",
  modelRequests: 0,
  liveCiphertextUploads: 0,
  ownerDecrypt: "NOT_VERIFIED",
  product: "NOT_ESTABLISHED",
};
try {
  const head = tool("git", ["rev-parse", "HEAD"]);
  assert.equal(observedExit(head), 0);
  assert.equal(head.stdout.toString().trim(), env.AGENT_HEAD_SHA);
  if (!cleanOnly) {
    const version = tool("/usr/bin/docker", [
      "version",
      "--format",
      "{{json .Server}}",
    ]);
    assert.equal(observedExit(version), 0);
    const server = JSON.parse(version.stdout);
    assert.equal(server.Os, "linux");
    assert.equal(server.Arch, "amd64");
    assert.match(server.Version, /^[a-zA-Z0-9.+_-]{1,80}$/);
    result.docker = {
      version: server.Version,
      os: server.Os,
      arch: server.Arch,
    };
    const install = run(
      [join(root, "research/mmp-089/install-age.mjs")],
      240000,
    );
    result.commands.push({
      command: "node research/mmp-089/install-age.mjs",
      exitCode: install.status,
      signal: install.signal,
      timedOut: install.error?.code === "ETIMEDOUT",
    });
    assert.equal(observedExit(install), 0);
    assert.equal(
      sha256(readFileSync(env.MMP089_AGE_PATH)),
      DIAGNOSTIC_POLICY.ageSha256,
    );
    result.pins = {
      ageVersion: DIAGNOSTIC_POLICY.ageVersion,
      ageSha256: DIAGNOSTIC_POLICY.ageSha256,
      archiveSha256: DIAGNOSTIC_POLICY.archiveSha256,
      encryptionImage: DIAGNOSTIC_POLICY.image,
      recipeSha256: DIAGNOSTIC_POLICY.recipeSha,
    };
    result.preparation = await preparationProbe(
      root,
      probe,
      env.AGENT_HEAD_SHA,
    );
    assert.equal(result.preparation.status, "PASS");
    stage = "VALIDATION";
    const driver = run(
      [join(root, "research/mmp-097/offline-controls.mjs")],
      42 * 60 * 1000,
    );
    result.commands.push({
      command: "node research/mmp-097/offline-controls.mjs",
      exitCode: driver.status,
      signal: driver.signal,
      timedOut: driver.error?.code === "ETIMEDOUT",
    });
    const controls = read(join(output, "controls.json"));
    assert.equal(controls.headSha, env.AGENT_HEAD_SHA);
    assert.equal(controls.format, "mmp097-offline-controls-v1");
    // Select only controlled public metadata; never serialize the raw envelope.
    for (const row of controls.cases) {
      result.cases.push(publicCase(row, env.AGENT_HEAD_SHA));
    }
    result.cryptoControls = publicCrypto(controls.cryptoControls);
    result.negativeControls = publicNegatives(controls.negativeControls);
    result.cryptoFaultControls = publicFaults(
      controls.cryptoFaultControls,
      "crypto",
    );
    result.runtimeControls = {
      status:
        controls.runtimeControls.status === "PASS" ? "PASS" : "NOT_ESTABLISHED",
      cases: publicFaults(controls.runtimeControls.cases, "runtime"),
    };
    result.processControls = publicProcesses(controls.processControls);
    result.actualDocker = result.cases.length ? "EXECUTED" : "NOT_ESTABLISHED";
    result.actualCrypto = result.cases.some(
      (row) => row.throwawayRoundtrip === "PASS",
    )
      ? "EXECUTED"
      : "NOT_ESTABLISHED";
    assert.equal(observedExit(driver), 0);
    assert.equal(controls.scopedStatus, "PASS_SCOPED");
    assert.equal(result.cases.length, 5);
    result.decision = "PASS_SCOPED / MERGE_NO_GO";
    result.fullNegativeMatrix =
      "EXECUTED_WITH_EXPLICIT_PRE_ENTRY_PROCESS_HARNESS_LIMITATION";
    result.requestedMatrixGap =
      "G2_FAIL_G3_PASS_UNREACHABLE_UNDER_UNCHANGED_ORACLE";
  }
} catch (error) {
  const prior = result.cases.find((row) => row.status === "ERROR");
  result.failure = prior
    ? { status: "ERROR", stage: prior.stage, cause: prior.cause }
    : result.preparation?.status === "ERROR"
      ? {
          status: "ERROR",
          stage: "PREPARATION",
          cause: result.preparation.cause ?? "ENVIRONMENT_ERROR",
        }
      : controlFailure(stage, error);
  process.exitCode = 1;
} finally {
  try {
    result.finalizer = finalize();
  } catch (error) {
    result.finalizerFailure = controlFailure("FINALIZER", error);
    result.decision = "NO_GO";
    process.exitCode = 1;
  }
  try {
    result.privateCleanup = cleanup();
  } catch {
    result.privateCleanup = "ERROR";
    result.decision = "NO_GO";
    process.exitCode = 1;
  }
  // Whole result is a bounded trusted supervisor projection, never child output.
  console.log(
    `${cleanOnly ? "MMP099_CLEANUP" : "MMP099_RECEIPT"} ${JSON.stringify(result)}`,
  );
}
