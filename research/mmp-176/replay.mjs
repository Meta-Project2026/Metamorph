// Owner-only command. Agent acceptance uses generated TEST identities exclusively.
// No candidate import, host compilation, provider, PHP or Oracle execution.
import { lstatSync, readdirSync, readFileSync, readlinkSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateReceipt } from "../../packages/agent-real/src/custody-contract.mjs";
import { privateDirectory } from "../../packages/agent-real/src/custody-files.mjs";
import { verifyAgeRestore } from "../../packages/agent-real/src/custody-restore.mjs";
import {
  DIAGNOSTIC_POLICY,
  readPrivateBytes,
} from "../../packages/agent-real/src/private-diagnostics.mjs";
import {
  observeBuild,
  RECIPE_PIN,
  validateRuntimeRecipe,
} from "../../packages/agent-real/src/runtime.mjs";
import { strictJson } from "../../packages/differential/src/strict.mjs";
import { WORKSHOP_PROFILE } from "../../packages/target-worker/runtime/profile.mjs";
import {
  sha256,
  validateBundle,
} from "../../packages/target-worker/src/admission.mjs";
import {
  command,
  TargetWorker,
} from "../../packages/target-worker/src/controller.mjs";
import { buildTrustedRuntime } from "../../packages/target-worker/src/runtime-broker.mjs";

export const HISTORICAL = Object.freeze({
  identity: Object.freeze({
    runId: "41749479450",
    runAttempt: "1",
    headSha: "32d173fc0ddb6cfe8d0addd3061fe5493f6e48f6",
    sourceSha: "d272170d0aecbd28eb5b13e272d9dd11d545b66c",
    candidateSha:
      "4e863cb94b444970e237e7cb8eb028ec99f5d960b200b5d1e714c91ee785f448",
    attemptId: "d708096a-f524-4ee2-acb3-1ad5cfbcc30d",
  }),
  ciphertextSha256:
    "2c28f738b93669c9aee6ad771eb4bb3b31734128ad18bb03b1614510667e74b1",
  ciphertextBytes: 27960,
  // Exact bytes in authenticated public ZIP #13285336430 (including final LF).
  receiptSha256:
    "559d55af0f197e0ee07479009eaa8e56085342091be2ee93e6a2e3b0273d694e",
});
const statuses = new Set([
  "OWNER_CONTEXT_REQUIRED",
  "PREPARATION_FAILED",
  "DOCKER_UNAVAILABLE",
  "TRUST_PIN_MISMATCH",
  "PREPARED_AWAITING_OFFLINE",
  "OWNER_CONFIRMATION_REQUIRED",
  "NETWORK_NOT_BLOCKED",
  "PRIVATE_DIRECTORY_UNSAFE",
  "PUBLIC_RECEIPT_UNAVAILABLE",
  "RECEIPT_REJECTED",
  "OWNER_IDENTITY_UNAVAILABLE",
  "CIPHERTEXT_UNAVAILABLE",
  "HASH_MISMATCH",
  "RESTORE_REJECTED",
  "REPLAY_ERROR",
  "CLEANUP_FAILED",
  "REPLAY_COMPLETE",
  "G1_COMPILER_FAIL_CONFIRMED",
]);
const codes = new Set([
  "NONE",
  "BUILD_PHASE_TIMEOUT",
  "BUILD_PHASE_SIGNAL",
  "BUILD_PHASE_SPAWN_ERROR",
  "BUILD_PHASE_OUTPUT_OVERFLOW",
  "BUILD_PHASE_UNKNOWN",
]);
class Refusal extends Error {}
function requireSafe(ok, status) {
  if (!ok) throw new Refusal(status);
}
export function initialResult(expected = HISTORICAL) {
  return {
    status: "OWNER_CONTEXT_REQUIRED",
    runId: expected.identity.runId,
    headSha: expected.identity.headSha,
    candidateSha: expected.identity.candidateSha,
    recipeSha: RECIPE_PIN,
    g1Verdict: "UNKNOWN",
    executedTestIds: [],
    phase: "NONE",
    phaseCode: "NONE",
    cleanup: "NOT_RUN",
    zeroOwnedResources: null,
  };
}
// Reconstruct every public field. Never spread an error, record or worker output.
export function publicResult(value) {
  requireSafe(statuses.has(value.status), "REPLAY_ERROR");
  requireSafe(
    [value.runId, value.headSha, value.candidateSha].every(
      (v) => typeof v === "string",
    ) &&
      /^[1-9][0-9]{0,19}$/.test(value.runId) &&
      /^[a-f0-9]{40}$/.test(value.headSha) &&
      /^[a-f0-9]{64}$/.test(value.candidateSha) &&
      value.recipeSha === RECIPE_PIN,
    "REPLAY_ERROR",
  );
  requireSafe(
    ["UNKNOWN", "PASS", "FAIL", "ERROR", "INCONCLUSIVE"].includes(
      value.g1Verdict,
    ) &&
      ["NONE", "typecheck", "build"].includes(value.phase) &&
      codes.has(value.phaseCode) &&
      ["NOT_RUN", "VERIFIED_ZERO_RESOURCES", "CLEANUP_ERROR"].includes(
        value.cleanup,
      ) &&
      [null, true, false].includes(value.zeroOwnedResources),
    "REPLAY_ERROR",
  );
  const allowed = ["workshop-business:typecheck", "workshop-business:build"];
  requireSafe(
    Array.isArray(value.executedTestIds) &&
      value.executedTestIds.length <= 2 &&
      value.executedTestIds.every((id, i) => id === allowed[i]),
    "REPLAY_ERROR",
  );
  const out = Object.fromEntries(
    Object.keys(initialResult()).map((key) => [key, value[key]]),
  );
  if (value.provisionElapsedMs !== undefined) {
    requireSafe(
      Number.isSafeInteger(value.provisionElapsedMs) &&
        value.provisionElapsedMs >= 0 &&
        value.provisionElapsedMs <= 300000,
      "REPLAY_ERROR",
    );
    out.provisionElapsedMs = value.provisionElapsedMs;
  }
  return out;
}
export function assertOwnerContext(
  env = process.env,
  platform = process.platform,
) {
  requireSafe(
    platform === "linux" &&
      !Object.keys(env).some((key) =>
        /^(CI$|GITHUB_|ACTIONS_|RUNNER_|CODEX_|ANTIGRAVITY_|MODEL_API_KEY$|META_API_KEY$|GH_TOKEN$|GITHUB_TOKEN$|OPENAI_API_KEY$|NODE_OPTIONS$|NODE_PATH$|DOCKER_HOST$|DOCKER_CONTEXT$|DOCKER_TLS)/.test(
          key,
        ),
      ),
    "OWNER_CONTEXT_REQUIRED",
  );
}
// These checks supplement an externally disconnected dedicated VM. They do not
// defend against root/same-UID agents or an owner reconnecting the VM mid-run.
export function assertOfflineSnapshot({
  interfaces,
  ownNet,
  initNet,
  daemonNet,
  daemonName,
  socketOwned,
}) {
  requireSafe(
    socketOwned &&
      daemonName === "dockerd" &&
      ownNet === initNet &&
      ownNet === daemonNet &&
      interfaces.length > 0 &&
      interfaces.some((i) => i.name === "lo") &&
      interfaces.every(
        (i) =>
          Number.isSafeInteger(i.flags) &&
          i.flags >= 0 &&
          (i.name === "lo" || (i.flags & 1) === 0),
      ),
    "NETWORK_NOT_BLOCKED",
  );
}
export function assertOffline() {
  try {
    const pidFile = lstatSync("/run/docker.pid");
    requireSafe(
      pidFile.isFile() &&
        pidFile.uid === 0 &&
        pidFile.nlink === 1 &&
        (pidFile.mode & 0o022) === 0 &&
        pidFile.size < 32,
      "NETWORK_NOT_BLOCKED",
    );
    const pid = readFileSync("/run/docker.pid", "utf8").trim();
    requireSafe(/^[1-9][0-9]{0,9}$/.test(pid), "NETWORK_NOT_BLOCKED");
    const socket = lstatSync("/var/run/docker.sock");
    assertOfflineSnapshot({
      interfaces: readdirSync("/sys/class/net").map((name) => ({
        name,
        flags: Number(
          readFileSync(`/sys/class/net/${name}/flags`, "utf8").trim(),
        ),
      })),
      ownNet: readlinkSync("/proc/self/ns/net"),
      initNet: readlinkSync("/proc/1/ns/net"),
      daemonNet: readlinkSync(`/proc/${pid}/ns/net`),
      daemonName: readFileSync(`/proc/${pid}/comm`, "utf8").trim(),
      socketOwned: socket.isSocket() && socket.uid === 0,
    });
  } catch {
    throw new Refusal("NETWORK_NOT_BLOCKED");
  }
}
export function admitStoredReceipt(bytes, expected = HISTORICAL) {
  requireSafe(sha256(bytes) === expected.receiptSha256, "RECEIPT_REJECTED");
  const record = validateReceipt(
    strictJson(new TextDecoder("utf-8", { fatal: true }).decode(bytes), 16384),
    expected.identity,
    "STORED_UNVERIFIED",
  );
  requireSafe(
    record.ciphertextSha256 === expected.ciphertextSha256 &&
      record.ciphertextBytes === expected.ciphertextBytes,
    "RECEIPT_REJECTED",
  );
  return record;
}
export function restorePrivate(
  privateRoot,
  expected = HISTORICAL,
  testRecipient,
) {
  try {
    privateDirectory(privateRoot);
  } catch {
    throw new Refusal("PRIVATE_DIRECTORY_UNSAFE");
  }
  let bytes;
  try {
    bytes = readPrivateBytes(join(privateRoot, "custody-stored.json"), 16384);
  } catch {
    throw new Refusal("PUBLIC_RECEIPT_UNAVAILABLE");
  }
  let record;
  try {
    record = admitStoredReceipt(bytes, expected);
  } catch {
    throw new Refusal("RECEIPT_REJECTED");
  }
  let identity;
  try {
    identity = readPrivateBytes(join(privateRoot, "identity"), 4096);
  } catch {
    throw new Refusal("OWNER_IDENTITY_UNAVAILABLE");
  } finally {
    identity?.fill(0);
  }
  let cipher;
  try {
    cipher = readPrivateBytes(
      join(privateRoot, "candidate.age"),
      3 * 1024 * 1024,
    );
  } catch {
    throw new Refusal("CIPHERTEXT_UNAVAILABLE");
  }
  requireSafe(
    cipher.length === expected.ciphertextBytes &&
      sha256(cipher) === expected.ciphertextSha256,
    "HASH_MISMATCH",
  );
  cipher.fill(0);
  try {
    const capsule = verifyAgeRestore({
      agePath: join(privateRoot, "age"),
      identityPath: join(privateRoot, "identity"),
      ciphertextPath: join(privateRoot, "candidate.age"),
      record,
      testRecipient,
    });
    return validateBundle(capsule.files, expected.identity.candidateSha);
  } catch {
    throw new Refusal("RESTORE_REJECTED");
  }
}
// Hooks are trusted unit-test seams, never CLI options or candidate-controlled.
export async function replayPrivate({
  runtime,
  privateRoot,
  signal,
  expected = HISTORICAL,
  offline = assertOffline,
  restore = restorePrivate,
  makeWorker = (r, b) =>
    new TargetWorker(r, b, "real", { profile: WORKSHOP_PROFILE }),
}) {
  const result = initialResult(expected);
  let worker;
  try {
    requireSafe(
      runtime?.provenance?.recipeSha === RECIPE_PIN &&
        RECIPE_PIN === DIAGNOSTIC_POLICY.recipeSha,
      "TRUST_PIN_MISMATCH",
    );
    offline();
    signal?.throwIfAborted();
    const bundle = restore(privateRoot, expected);
    offline();
    worker = makeWorker(runtime, bundle);
    let provisioned = false;
    try {
      await worker.provision(signal);
      provisioned = true;
    } catch {
      /* The trusted receipt, not an exception string, decides G1. */
    }
    const { build, buildPhaseDiagnostics } = observeBuild(
      worker,
      "workshop-business",
    );
    result.g1Verdict = build.verdict;
    result.executedTestIds = build.executedTestIds;
    if (build.verdict === "ERROR") {
      result.phaseCode = buildPhaseDiagnostics?.code ?? "BUILD_PHASE_UNKNOWN";
      result.phase = buildPhaseDiagnostics?.phase ?? "NONE";
    }
    const elapsed = worker.evidence.build?.elapsedMs;
    if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed <= 300000)
      result.provisionElapsedMs = Math.ceil(elapsed);
    result.status =
      build.verdict === "FAIL"
        ? "G1_COMPILER_FAIL_CONFIRMED"
        : build.verdict === "PASS" && provisioned
          ? "REPLAY_COMPLETE"
          : "REPLAY_ERROR";
    offline();
  } catch (error) {
    result.status = error instanceof Refusal ? error.message : "REPLAY_ERROR";
  } finally {
    if (worker) {
      try {
        await worker.close();
        const inventory = await worker.inventory();
        requireSafe(
          worker.evidence.cleanupVerified === true &&
            !worker.evidence.cleanupError &&
            !inventory.containers.length &&
            !inventory.volumes.length,
          "CLEANUP_FAILED",
        );
        result.cleanup = "VERIFIED_ZERO_RESOURCES";
        result.zeroOwnedResources = true;
      } catch {
        result.cleanup = "CLEANUP_ERROR";
        result.zeroOwnedResources = false;
        result.status = "CLEANUP_FAILED";
      }
    }
  }
  return publicResult(result);
}
// Bounded interactive handoff keeps the original broker-issued WeakSet runtime
// alive across disconnection. No serialized image receipt can mint a runtime.
export function waitForOwner(input, signal, timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    let line = "";
    const finish = (ok) => {
      clearTimeout(timer);
      input.off("data", onData);
      input.off("end", onEnd);
      signal?.removeEventListener("abort", onEnd);
      input.pause();
      if (ok) resolve();
      else reject(new Refusal("OWNER_CONFIRMATION_REQUIRED"));
    };
    const onEnd = () => finish(false);
    const onData = (chunk) => {
      line += chunk.toString("utf8");
      if (line.length > 64) finish(false);
      else if (line.includes("\n")) finish(line === "OWNER_OFFLINE_READY\n");
    };
    const timer = setTimeout(onEnd, timeoutMs);
    input.on("data", onData);
    input.once("end", onEnd);
    signal?.addEventListener("abort", onEnd, { once: true });
    if (signal?.aborted) onEnd();
    else input.resume();
  });
}
export async function prepareRuntime(
  state,
  build = buildTrustedRuntime,
  run = command,
) {
  const names = new Set();
  let removalFailed = false;
  let runtime, failure;
  try {
    runtime = await build(async (kind, receipt) => {
      if (kind === "runtime-provenance.json") {
        const name = receipt.args[receipt.args.indexOf("--name") + 1];
        requireSafe(
          /^mmp007-provenance-[a-f0-9-]{36}$/.test(name),
          "PREPARATION_FAILED",
        );
        names.add(name);
      }
      if (kind === "provenance-cleanup.json")
        removalFailed =
          receipt.exitCode !== 0 ||
          receipt.timedOut ||
          receipt.spawnError ||
          receipt.overflow;
    });
  } catch (error) {
    failure = error;
  }
  let clean = !removalFailed;
  for (const name of names) {
    const inventory = await run([
      "container",
      "ls",
      "--all",
      "--filter",
      `name=^/${name}$`,
      "--format",
      "{{.Names}}",
    ]);
    const observed =
      inventory.exitCode === 0 &&
      !inventory.timedOut &&
      !inventory.spawnError &&
      !inventory.overflow;
    if (!observed || inventory.stdout.trim()) {
      clean = false;
      // Exact owned name only; emergency recovery never becomes normal cleanup.
      await run(["rm", "--force", name]);
    }
  }
  state.cleanup = clean && names.size ? "VERIFIED_ZERO_RESOURCES" : "NOT_RUN";
  state.zeroOwnedResources = clean && names.size ? true : null;
  if (!clean) {
    state.cleanup = "CLEANUP_ERROR";
    state.zeroOwnedResources = false;
    throw new Refusal("CLEANUP_FAILED");
  }
  if (failure) throw failure;
  return runtime;
}
async function main() {
  let result = initialResult();
  const abort = new AbortController();
  const stop = () => abort.abort();
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  try {
    requireSafe(
      process.argv.length === 4 &&
        process.argv[2] === "--owner-only" &&
        process.stdin.isTTY,
      "OWNER_CONTEXT_REQUIRED",
    );
    assertOwnerContext();
    // Explicit local socket: reject remote/context-selected daemon endpoints.
    process.env.DOCKER_HOST = "unix:///var/run/docker.sock";
    const root = fileURLToPath(
      new URL("../../packages/target-worker/runtime", import.meta.url),
    );
    try {
      validateRuntimeRecipe(root);
    } catch {
      throw new Refusal("TRUST_PIN_MISMATCH");
    }
    const check = await command(["version", "--format", "{{.Server.Version}}"]);
    requireSafe(
      check.exitCode === 0 && !check.spawnError && !check.timedOut,
      "DOCKER_UNAVAILABLE",
    );
    let runtime;
    try {
      runtime = await prepareRuntime(result);
    } catch (error) {
      throw error instanceof Refusal
        ? error
        : new Refusal("PREPARATION_FAILED");
    }
    requireSafe(
      runtime.provenance.recipeSha === RECIPE_PIN,
      "TRUST_PIN_MISMATCH",
    );
    result.status = "PREPARED_AWAITING_OFFLINE";
    process.stdout.write(`${JSON.stringify(publicResult(result))}\n`);
    await waitForOwner(process.stdin, abort.signal);
    const replay = await replayPrivate({
      runtime,
      privateRoot: process.argv[3],
      signal: abort.signal,
    });
    if (replay.cleanup === "NOT_RUN") {
      replay.cleanup = result.cleanup;
      replay.zeroOwnedResources = result.zeroOwnedResources;
    }
    result = replay;
  } catch (error) {
    result.status = error instanceof Refusal ? error.message : "REPLAY_ERROR";
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
  }
  process.stdout.write(`${JSON.stringify(publicResult(result))}\n`);
  if (result.status !== "REPLAY_COMPLETE") process.exitCode = 1;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  // The CLI has a JSON-only publication protocol, including Node warnings.
  process.removeAllListeners("warning");
  main().catch(() => {
    process.stdout.write(`${JSON.stringify(initialResult())}\n`);
    process.exitCode = 1;
  });
}
