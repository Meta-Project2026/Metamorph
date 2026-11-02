// Owner-local, manual-only MMP-139 step: export ONLY the restored candidate
// `src/**/*.ts` files plus a minimal SHA-only manifest, so the owner can later
// hand an independent reviewer sanitized candidate source for the MMP-137
// post-mortem. The tool runs exclusively when the owner starts it on their own
// trusted Linux/WSL machine after an independent review of the exact PR head
// SHA; it never runs on import, in tests, in CI or on install.
//
// Cryptography and restore are delegated unchanged to the already-reviewed
// trusted core: `verifyAgeRestore` (qualified pinned age + age-keygen, fixed
// production recipient, receipt binding, ciphertext SHA/length) and
// `readRecord`. This wrapper implements no crypto and never overrides the
// recipient. Before anything is written, the restored capsule identity is
// pinned against the canonical published paid run (run id, attempt, workflow
// head SHA, source SHA, canonical candidate SHA) and the receipt is pinned to
// the published ciphertext SHA/length; every file is re-validated
// independently (strict `src/**/*.ts` paths, per-file SHA/size, count,
// entrypoint) and the canonical candidate SHA is recomputed and compared.
//
// Hard boundaries: no network, no Git subprocess, no external process of its
// own, no candidate execution — candidate text is never imported, only ever
// written to disk as opaque bytes — no plaintext temporary file outside the
// final private directory, no
// modification of the owner's existing identity file (only read by the pinned
// age-keygen inside the trusted core), no discovery of owner paths (all five
// paths are typed interactively with input echo suppressed, so none reach
// argv, shell history or output), no decrypted serialization outside the
// fresh owner-only output directory, and no upload or sharing of anything.
// Exactly one allowlisted final status line is printed:
// `CANDIDATE_ONLY_EXPORT_READY <manifest-digest>` or `EXPORT_REJECTED` —
// never a key path, private output path, candidate text or error detail.
// A static secret-pattern scan is re-run per file, but that stays a partial
// check: owner review before sharing remains mandatory and blockers stand.
import { lstatSync, readdirSync, rmdirSync, unlinkSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { pathToFileURL } from "node:url";
import { CUSTODY } from "../../packages/agent-real/src/custody-contract.mjs";
import {
  commitPrivate,
  privateDirectory,
  readRecord,
} from "../../packages/agent-real/src/custody-files.mjs";
import { verifyAgeRestore } from "../../packages/agent-real/src/custody-restore.mjs";
import { rejectSecrets } from "../../packages/agent-real/src/private-diagnostics.mjs";
import { sha256 } from "../../packages/target-worker/src/admission.mjs";

// This file's checkout root, used only to keep the export destination outside
// the Git checkout. Absolute after module load; never depends on cwd.
const REPO_ROOT = resolve(import.meta.dirname, "..", "..");

// Canonical published facts of the single authorized paid generation run
// (MMP-005 lineage, GitHub run 41505679809). The CLI always pins these: like
// the trusted `testRecipient` control, the module-only `pins` parameter for
// offline synthetic tests exists but is never passed by the manual CLI, no
// environment variable or prompt can change the production constants.
export const EXPORT_PINS = Object.freeze({
  runId: "41505679809",
  runAttempt: "1",
  headSha: "a01bb65f8bb58c02c7a59e06ffedc9662576478e",
  sourceSha: "d272170d0aecbd28eb5b13e272d9dd11d545b66c",
  candidateSha:
    "6140dbed4afb0d2068db17facb0e14ff9c2ffb61aaaf2b64207b9a8aa2125d38",
  ciphertextSha256:
    "1afcc2a061a72f322f4a888bd03a93686babaf5a3e268a5d45dcc7c17bc997cb",
  ciphertextBytes: 31094,
});
export const MANIFEST_FORMAT = "mmp139-candidate-only-export-v1";
export const MANIFEST_LABEL = "UNVERIFIED_PRODUCT";
export const STATUS_READY = "CANDIDATE_ONLY_EXPORT_READY";
export const STATUS_REJECTED = "EXPORT_REJECTED";
export const EXIT_CODES = Object.freeze({
  [STATUS_READY]: 0,
  [STATUS_REJECTED]: 1,
});
// Only a trusted interactive owner host is valid: agent/CI sessions and any
// credential-bearing variable refuse closed before the first prompt.
export const REFUSAL_ENV = Object.freeze([
  "CI",
  "MODEL_API_KEY",
  "GH_TOKEN",
  "GITHUB_TOKEN",
  "ACTIONS_RUNTIME_TOKEN",
  "ACTIONS_ID_TOKEN_REQUEST_TOKEN",
  "ACTIONS_CACHE_SERVICE_TOKEN",
]);
export const REJECT_REASONS = Object.freeze([
  "COUNT",
  "SHAPE",
  "PATH",
  "CONTENT",
  "SIZE",
  "HASH",
  "ENTRYPOINT",
]);
export const DESTINATION_CODES = Object.freeze([
  "OK",
  "NOT_ABSOLUTE",
  "NOT_NORMALIZED",
  "WSL_MOUNT",
  "TRANSIENT",
  "CHECKOUT",
  "SYNC_OR_BACKUP",
]);
const UUID_V4 =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const MAX_DESTINATION_LENGTH = 4096;
const MANIFEST_NAME = "manifest.json";
const ENTRYPOINT = "src/main.ts";
const REJECTED = new Error(STATUS_REJECTED);

// Mirrors the frozen candidate admission path grammar so export accepts
// exactly what admission accepts: strict relative `src/**/*.ts`, bounded
// length, no reserved/sensitive segments, no duplicates (case-insensitive).
const TS_PATH = /^src\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.ts$/;
const FORBIDDEN_SEGMENT =
  /(?:^|\/)(?:con|prn|aux|nul|com[1-9]|lpt[1-9]|reference|oracle|tests?|fixtures?|held[-_]?out|policy|ci)(?:\/|\.ts$)/i;
const MAX_FILES = 64;
const MAX_FILE_BYTES = 256 * 1024;
const MAX_TOTAL_BYTES = 1024 * 1024;
const MAX_PATH_LENGTH = 240;

const reject = (reason) => ({ ok: false, reason });

// Pure structural filter over capsule files: the independent second check
// that runs in this process after the trusted restore has already fully
// validated the capsule. Testable with mocked/synthetic capsules only.
export function selectExportableFiles(files) {
  if (!Array.isArray(files) || files.length < 1 || files.length > MAX_FILES)
    return reject("COUNT");
  let total = 0;
  const seen = new Set();
  const canonical = [];
  for (const file of files) {
    if (
      !file ||
      typeof file !== "object" ||
      Object.keys(file).sort().join() !== "content,path,sha256"
    )
      return reject("SHAPE");
    const { path, content, sha256: fileSha256 } = file;
    if (
      typeof path !== "string" ||
      !TS_PATH.test(path) ||
      path.length > MAX_PATH_LENGTH ||
      FORBIDDEN_SEGMENT.test(path)
    )
      return reject("PATH");
    if (typeof content !== "string" || content.includes("\0"))
      return reject("CONTENT");
    if (Buffer.byteLength(content) > MAX_FILE_BYTES) return reject("SIZE");
    if (sha256(content) !== fileSha256 || seen.has(path.toLowerCase()))
      return reject("HASH");
    seen.add(path.toLowerCase());
    total += Buffer.byteLength(content);
    // Match validateBundle()'s byte-level JSON canonical form exactly.
    // JSON.stringify preserves object insertion order; content before sha256
    // yields a DIFFERENT candidate SHA for the same genuine source bytes.
    canonical.push({ path, sha256: fileSha256, content });
  }
  if (total > MAX_TOTAL_BYTES || !seen.has(ENTRYPOINT))
    return reject("ENTRYPOINT");
  canonical.sort((a, b) => a.path.localeCompare(b.path, "en"));
  return { ok: true, files: canonical };
}

const dirComponents = (path) => {
  const parts = path.split("/");
  return parts
    .slice(0, -1)
    .map((_, index) => parts.slice(0, index + 1).join("/"));
};

// Pure plan step: pin the restored capsule to the canonical published run,
// re-derive the canonical candidate SHA, and build the minimal manifest
// (candidate SHA + per-file path/size/SHA + UNVERIFIED_PRODUCT label only).
// Throws the categorical rejection without any payload detail. `pins` is a
// module-only test control exactly like verifyAgeRestore's `testRecipient`
// and mmp-135's `expected`: the manual CLI below never passes it, so the
// production constants can never be bypassed from the command line.
export function planExport(capsule, pins = EXPORT_PINS) {
  if (!capsule || typeof capsule !== "object" || Array.isArray(capsule))
    throw REJECTED;
  const identity = capsule.identity;
  if (!identity || typeof identity !== "object" || Array.isArray(identity))
    throw REJECTED;
  for (const key of [
    "runId",
    "runAttempt",
    "headSha",
    "sourceSha",
    "candidateSha",
  ])
    if (identity[key] !== pins[key]) throw REJECTED;
  if (
    typeof identity.attemptId !== "string" ||
    !UUID_V4.test(identity.attemptId)
  )
    throw REJECTED;
  const selected = selectExportableFiles(capsule.files);
  if (!selected.ok) throw REJECTED;
  if (sha256(JSON.stringify(selected.files)) !== pins.candidateSha)
    throw REJECTED;
  for (const file of selected.files) {
    try {
      rejectSecrets(file.content);
    } catch {
      throw REJECTED;
    }
  }
  const manifest = {
    format: MANIFEST_FORMAT,
    label: MANIFEST_LABEL,
    candidateSha: pins.candidateSha,
    files: selected.files.map((file) => ({
      path: file.path,
      bytes: Buffer.byteLength(file.content),
      sha256: file.sha256,
    })),
  };
  const bytes = Buffer.from(JSON.stringify(manifest), "utf8");
  return { files: selected.files, manifest, bytes, digest: sha256(bytes) };
}

// Early receipt pins: the receipt must be bound to the published ciphertext
// SHA/length and its identity to the published candidate SHA. The full
// receipt validation (format, state, recipient fingerprint, collector
// cleanup) stays inside the trusted restore.
export function receiptMatchesPins(record, pins = EXPORT_PINS) {
  return (
    !!record &&
    typeof record === "object" &&
    !Array.isArray(record) &&
    record.ciphertextSha256 === pins.ciphertextSha256 &&
    record.ciphertextBytes === pins.ciphertextBytes &&
    !!record.identity &&
    typeof record.identity === "object" &&
    record.identity.candidateSha === pins.candidateSha
  );
}

const TRANSIENT_PREFIXES = [
  "/tmp",
  "/var/tmp",
  "/dev/shm",
  "/run",
  "/srv",
  "/var/www",
  "/boot",
  "/proc",
  "/sys",
  "/dev",
];
const SYNC_OR_BACKUP =
  /(?:dropbox|onedrive|googledrive|google-drive|gdrive|icloud|backup|sync)/i;
const DOT_SEGMENT = /(?:^|\/)\.{1,2}(?:\/|$)/;
// Checkout root as plain POSIX text: classification must stay deterministic
// on every host (the CLI only ever classifies on Linux, but the control must
// mean the same thing everywhere).
const toPosixRoot = (value) =>
  String(value).replaceAll("\\", "/").replace(/\/+$/, "");

// Pure classification of the owner-provided fresh output directory. The
// destination must be a normalized absolute POSIX path outside the Git
// checkout, WSL mounts, transient/public system trees and sync/backup-named
// directories (a name-based partial heuristic — conscious owner choice of a
// plain private location remains the real control).
export function classifyDestination(destination, repoRoot) {
  if (
    typeof destination !== "string" ||
    !destination.startsWith("/") ||
    destination.length > MAX_DESTINATION_LENGTH
  )
    return "NOT_ABSOLUTE";
  if (
    destination === "/" ||
    destination.includes("\\") ||
    destination.endsWith("/") ||
    destination.includes("//") ||
    DOT_SEGMENT.test(destination)
  )
    return "NOT_NORMALIZED";
  const root = toPosixRoot(repoRoot);
  if (destination === root || destination.startsWith(`${root}/`))
    return "CHECKOUT";
  if (destination === "/mnt" || destination.startsWith("/mnt/"))
    return "WSL_MOUNT";
  if (
    TRANSIENT_PREFIXES.some(
      (prefix) =>
        destination === prefix || destination.startsWith(`${prefix}/`),
    )
  )
    return "TRANSIENT";
  if (
    destination
      .split("/")
      .slice(1)
      .some((s) => SYNC_OR_BACKUP.test(s))
  )
    return "SYNC_OR_BACKUP";
  return "OK";
}

function verifyOutputTree(outDir, plan) {
  const expectedFiles = new Set([
    MANIFEST_NAME,
    ...plan.files.map((f) => f.path),
  ]);
  const expectedDirs = new Set(
    plan.files.flatMap((f) => dirComponents(f.path)),
  );
  const seenFiles = new Set();
  const seenDirs = new Set();
  const walk = (rel) => {
    const st = lstatSync(rel === "" ? outDir : join(outDir, rel));
    if ((st.mode & 0o077) !== 0) throw REJECTED;
    if (st.isDirectory()) {
      if (rel !== "") {
        if (!expectedDirs.has(rel) || seenDirs.has(rel)) throw REJECTED;
        seenDirs.add(rel);
      }
      for (const entry of readdirSync(join(outDir, rel)).sort())
        walk(rel === "" ? entry : `${rel}/${entry}`);
      return;
    }
    if (!st.isFile() || !expectedFiles.has(rel) || seenFiles.has(rel))
      throw REJECTED;
    seenFiles.add(rel);
  };
  walk("");
  if (
    seenFiles.size !== expectedFiles.size ||
    seenDirs.size !== expectedDirs.size
  )
    throw REJECTED;
}

// Best-effort silent removal of the run's own fresh output directory. The
// directory only ever exists after this run created it empty (creation is
// no-clobber), so everything inside is this run's; removal is recursive,
// never follows symlinks, and never prints content. On an unexpected stall
// the 0700 directory is left for manual owner removal; no manifest was
// published.
function removeTree(path) {
  const st = lstatSync(path);
  if (st.isDirectory()) {
    for (const entry of readdirSync(path)) removeTree(join(path, entry));
    rmdirSync(path);
    return;
  }
  if (!st.isFile()) throw REJECTED;
  unlinkSync(path);
}

function cleanupOutput(outDir) {
  if (!outDir) return;
  try {
    removeTree(outDir);
  } catch {
    /* best effort; owner removes the stuck 0700 directory manually */
  }
}

// Interactive orchestrator. `restore`, `readRecordFn`, `commitImpl`, `env`,
// `platform`, `repoRoot` and `pins` are module-level trusted defaults; the
// manual CLI below never overrides any of them, so production pins and the
// fixed recipient can never be bypassed from the command line. Tests may
// inject synthetic capsules/pins but the owner-facing path cannot.
export async function runOwnerExport({
  ask,
  emit = (line) => process.stdout.write(`${line}\n`),
  env = process.env,
  platform = process.platform,
  repoRoot = REPO_ROOT,
  pins = EXPORT_PINS,
  restore = verifyAgeRestore,
  readRecordFn = readRecord,
  commitImpl = commitPrivate,
} = {}) {
  const done = (status, digest = null) => {
    emit(digest ? `${status} ${digest}` : status);
    return { status, digest };
  };
  let outDir = null;
  try {
    if (platform !== "linux") return done(STATUS_REJECTED);
    for (const name of REFUSAL_ENV) {
      const value = env?.[name];
      if (typeof value === "string" && value.length > 0)
        return done(STATUS_REJECTED);
    }
    const answer = async (label) => {
      const raw = await ask(label);
      return typeof raw === "string"
        ? raw.trim().replace(/^"(.*)"$/, "$1")
        : "";
    };
    const answers = [];
    for (const label of [
      "age binary path:",
      "identity file path:",
      "ciphertext file path:",
      "receipt file path:",
      "fresh output directory path:",
    ]) {
      const value = await answer(label);
      if (!value) return done(STATUS_REJECTED); // an abort stops at that prompt
      answers.push(value);
    }
    const [agePath, identityPath, ciphertextPath, recordPath, destination] =
      answers;
    if (answers.some((path) => !isAbsolute(path))) return done(STATUS_REJECTED);
    if (classifyDestination(destination, repoRoot) !== "OK")
      return done(STATUS_REJECTED);

    const record = readRecordFn(recordPath);
    if (!receiptMatchesPins(record, pins)) return done(STATUS_REJECTED);
    const capsule = restore({ agePath, identityPath, ciphertextPath, record });
    const plan = planExport(capsule, pins);

    privateDirectory(destination, true);
    outDir = destination;
    const directories = [
      ...new Set(plan.files.flatMap((file) => dirComponents(file.path))),
    ].sort();
    for (const rel of directories) privateDirectory(join(outDir, rel), true);
    for (const file of plan.files)
      commitImpl(
        join(outDir, file.path),
        Buffer.from(file.content, "utf8"),
        CUSTODY.plaintext,
      );
    commitImpl(join(outDir, MANIFEST_NAME), plan.bytes, CUSTODY.plaintext);
    verifyOutputTree(outDir, plan);
    return done(STATUS_READY, plan.digest);
  } catch {
    cleanupOutput(outDir);
    return done(STATUS_REJECTED);
  }
}

// Interactive prompter with input echo suppressed: typed characters and the
// entered paths never reach the visible stream; only the prompt labels, a
// line break after each answer, and the caller's own output are written.
// Lines are taken from an always-attached queue so a pasted next path is
// never lost between answers, and a closed/aborted stream resolves to an
// empty answer (rejected) instead of hanging.
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
      let answerLine = queued.shift();
      if (answerLine === undefined && !closed) {
        await new Promise((wake) => {
          notify = wake;
        });
        answerLine = queued.shift();
      }
      write("\n");
      return answerLine ?? "";
    },
    close: () => rl.close(),
  };
}

async function main() {
  const prompter = createPrompter();
  try {
    const { status } = await runOwnerExport({ ask: prompter.ask });
    process.exitCode = EXIT_CODES[status];
  } catch {
    process.stdout.write(`${STATUS_REJECTED}\n`);
    process.exitCode = EXIT_CODES[STATUS_REJECTED];
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
