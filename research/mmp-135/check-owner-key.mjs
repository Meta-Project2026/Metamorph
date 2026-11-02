// Owner-local, manual-only MMP-135 step 1: confirm that the owner's private
// age identity derives the existing immutable production
// DIAGNOSTIC_POLICY.recipient. The check runs only when the owner explicitly
// starts it on their own trusted machine; it never runs on import, in tests,
// in CI or on install. The identity and tool paths are entered interactively
// with input echo suppressed, so they never appear in argv, shell history or
// the helper's output; the identity file content is never read here (only its
// size metadata), and only age-keygen -y touches it, spawned without a shell
// at an absolute owner-provided path with bounded time and output. The Node
// wrapper makes no network calls and writes no files, and the child binary is
// accepted only after a content SHA-256 pin check: on Linux/WSL the pinned
// DIAGNOSTIC_POLICY.keygenSha256 build; on Windows no qualified pinned build
// exists, so the helper refuses closed (NOT_AVAILABLE) before any spawn —
// per the PR review, real-key checks are Linux/WSL-only for now. Exactly one
// allowlisted final status line is printed: MATCH / MISMATCH / NOT_AVAILABLE
// / ERROR. A MATCH is key-possession evidence only and is not a production
// decrypt/restore result; verifyAgeRestore on a qualified Linux host remains
// the only path to OWNER_RESTORE_PASS.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { pathToFileURL } from "node:url";
import { DIAGNOSTIC_POLICY } from "../../packages/agent-real/src/private-diagnostics.mjs";

export const RESULT_CODES = ["MATCH", "MISMATCH", "NOT_AVAILABLE", "ERROR"];
export const EXIT_CODES = { MATCH: 0, MISMATCH: 1, NOT_AVAILABLE: 2, ERROR: 3 };
export const RECIPIENT_FORMAT = /^age1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{58}$/;
const IDENTITY_MAX_BYTES = 4096;
const TOOL_MAX_BYTES = 32 * 1024 * 1024;
const SPAWN_TIMEOUT_MS = 10000;
const SPAWN_MAX_BUFFER = 4096;

export function policyConsistent(policy = DIAGNOSTIC_POLICY) {
  return (
    createHash("sha256").update(policy.recipient).digest("hex") ===
    policy.recipientSha256
  );
}

function regularFile(path, maxBytes) {
  try {
    const st = statSync(path);
    return st.isFile() && st.size > 0 && st.size <= maxBytes ? st : null;
  } catch {
    return null;
  }
}

function childEnv() {
  return process.platform === "win32"
    ? {
        SystemRoot: process.env.SystemRoot ?? "",
        SystemDrive: process.env.SystemDrive ?? "",
      }
    : { PATH: "/usr/bin:/bin", HOME: "/nonexistent", TZ: "UTC" };
}

// Pure classification of one bounded age-keygen -y execution. Tool-side
// failures (missing, unrunnable, killed, unusable or oversized output) are
// NOT_AVAILABLE; a tool that ran but refused the input is ERROR; a clean
// single-line recipient is compared for exact equality with `expected`.
export function classifyOutcome(
  spawned,
  expected = DIAGNOSTIC_POLICY.recipient,
) {
  if (spawned.error || spawned.signal || spawned.status !== 0)
    return spawned.status ? "ERROR" : "NOT_AVAILABLE";
  const derived = spawned.stdout?.toString("utf8").trim() ?? "";
  return RECIPIENT_FORMAT.test(derived)
    ? derived === expected
      ? "MATCH"
      : "MISMATCH"
    : "NOT_AVAILABLE";
}

function deriveRecipient(keygenPath, identityPath, expected) {
  const spawned = spawnSync(keygenPath, ["-y", identityPath], {
    env: childEnv(),
    maxBuffer: SPAWN_MAX_BUFFER,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: SPAWN_TIMEOUT_MS,
    windowsHide: true,
  });
  try {
    return classifyOutcome(spawned, expected);
  } finally {
    spawned.stdout?.fill(0);
    spawned.stderr?.fill(0);
  }
}

// `expected` is a module-only trusted generated-key control for offline
// synthetic tests, mirroring verifyAgeRestore's testRecipient: the manual CLI
// below never passes it and always compares against the production recipient.
export async function runOwnerCheck({
  ask,
  emit = (code) => process.stdout.write(`${code}\n`),
  env = process.env,
  platform = process.platform,
  expected = DIAGNOSTIC_POLICY.recipient,
}) {
  const done = (code) => {
    emit(code);
    return code;
  };
  if (env.CI || env.GH_TOKEN || env.MODEL_API_KEY || env.ACTIONS_RUNTIME_TOKEN)
    return done("ERROR"); // only a trusted interactive owner host is valid
  if (!policyConsistent()) return done("ERROR"); // checked-out policy is not the pinned one
  const clean = async (value) =>
    String((await ask(value)) ?? "")
      .trim()
      .replace(/^"(.*)"$/, "$1");
  const identityPath = await clean("Identity file path:");
  const keygenPath = await clean("age-keygen path:");
  if (!identityPath || !keygenPath) return done("NOT_AVAILABLE");
  if (!isAbsolute(identityPath) || !isAbsolute(keygenPath))
    return done("ERROR"); // absolute paths only; never resolve via PATH
  if (!regularFile(identityPath, IDENTITY_MAX_BYTES)) return done("ERROR"); // missing, empty or oversized identity input
  if (!regularFile(keygenPath, TOOL_MAX_BYTES)) return done("NOT_AVAILABLE");
  if (
    platform !== "linux" ||
    createHash("sha256").update(readFileSync(keygenPath)).digest("hex") !==
      DIAGNOSTIC_POLICY.keygenSha256
  )
    return done("NOT_AVAILABLE"); // only the pinned Linux/WSL build may touch the identity; Windows refuses closed before any spawn (review P1)
  return done(deriveRecipient(keygenPath, identityPath, expected));
}

// Interactive prompter with input echo suppressed: typed characters and the
// entered paths never reach the visible stream; only the prompt labels, a
// line break after each answer, and the caller's own output are written.
// Lines are taken from an always-attached queue so a pasted second path is
// never lost between answers, and a closed/aborted stream resolves to an
// empty answer instead of hanging.
export function createPrompter({
  input = process.stdin,
  write = (text) => process.stdout.write(text),
} = {}) {
  const silent = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
  const rl = createInterface({ input, output: silent, terminal: true });
  const queued = [];
  let notify = null;
  let closed = false;
  rl.on("line", (line) => {
    queued.push(line);
    const wake = notify;
    notify = null;
    wake?.();
  });
  rl.on("SIGINT", () => rl.close());
  rl.on("close", () => {
    closed = true;
    const wake = notify;
    notify = null;
    wake?.();
  });
  return {
    ask: async (label) => {
      write(`${label} `);
      let answer = queued.shift();
      if (answer === undefined && !closed) {
        await new Promise((resolve) => {
          notify = resolve;
        });
        answer = queued.shift();
      }
      write("\n");
      return answer ?? "";
    },
    close: () => rl.close(),
  };
}

async function main() {
  const prompter = createPrompter();
  try {
    const code = await runOwnerCheck({ ask: prompter.ask });
    process.exitCode = EXIT_CODES[code];
  } catch {
    process.stdout.write("ERROR\n");
    process.exitCode = EXIT_CODES.ERROR;
  } finally {
    prompter.close();
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await main();
}
