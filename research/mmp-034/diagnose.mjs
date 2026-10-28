// Trusted public-fixture driver. Raw evidence never leaves the disposable runner.
import { spawnSync } from "node:child_process";
import {
  closeSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SHAS = [
  "d133e65be24d939d86b9e43a83e4ba8770ecffd9",
  "a14429ca9d5ac565dbb618e9f9c26297c9ead30b",
];
const CASES = [
  "public-write-read-reset",
  "syntax-error",
  "type-error",
  "invalid-import",
  "bad-startup",
  "crash",
  "oom",
  "blocked-npm-script",
  "blocked-php-process",
  "blocked-reference-file",
  "blocked-external-network",
  "infinite-loop-timeout",
  "bounded-cli-wait",
  "cancel-reap",
  "malformed-http",
  "corrupt-db",
  "missing-db",
  "wrong-snapshot-source",
  "corrupt-db-independent-parser",
  "ignore-candidate-snapshot-endpoint",
  "typed-sqlite",
  "nonfinite-sqlite-rejected",
  "slow-startup-no-client-sleep",
  "never-listen",
  "wrong-port",
  "wrong-response",
  "hung-http",
  "eight-resets-resource-inventory",
  "aggregate-deadline-real-monotonic",
  "abort-pending-readiness",
];
const CODES = new Set([
  "BUILD_FAILED",
  "CLEANUP_ERROR",
  "TIMEOUT",
  "CANCELLED",
  "RUNTIME_FAILED",
  "ENVIRONMENT_ERROR",
  "OBSERVATION_ERROR",
  "ADMISSION_REJECTED",
  "UNCLASSIFIED",
]);
const VERBS = new Set([
  "run",
  "exec",
  "inspect",
  "stop",
  "kill",
  "rm",
  "wait",
  "volume",
  "container",
  "image",
]);
const code = (v) => (CODES.has(v) ? v : v == null ? null : "UNCLASSIFIED");
const integer = (v, max = 1e9) => Number.isSafeInteger(v) && v >= 0 && v <= max;
const keys = (v, names) => {
  if (
    !v ||
    typeof v !== "object" ||
    Array.isArray(v) ||
    Object.keys(v).sort().join() !== [...names].sort().join()
  )
    throw Error("PUBLIC_SCHEMA_REJECTED");
};
const check = (v) => {
  if (!v) throw Error("PUBLIC_VALUE_REJECTED");
};
const identity = (v) => {
  check(/^\d{1,14}-\d{1,3}-[01]-[12]$/.test(v.attemptId));
  check(SHAS.includes(v.sourceSha));
};
export function validateAttempt(v) {
  keys(v, [
    "attemptId",
    "sourceSha",
    "status",
    "childExit",
    "childSignal",
    "childTimedOut",
    "elapsedMs",
    "completedCases",
    "firstUncompletedCase",
    "failedCaseReceiptPresent",
    "operationCode",
    "caseCode",
    "cleanupCode",
    "commands",
    "recipeSha256",
    "imageId",
  ]);
  identity(v);
  check(["PASS", "ERROR"].includes(v.status));
  check(v.childExit === null || integer(v.childExit, 255));
  check([null, "SIGTERM", "SIGKILL", "OTHER"].includes(v.childSignal));
  check(typeof v.childTimedOut === "boolean" && integer(v.elapsedMs));
  check(integer(v.completedCases, 30));
  check(
    v.firstUncompletedCase === null ||
      (/^case-\d{2}$/.test(v.firstUncompletedCase) &&
        Number(v.firstUncompletedCase.slice(-2)) < 30),
  );
  check(typeof v.failedCaseReceiptPresent === "boolean");
  for (const k of ["operationCode", "caseCode", "cleanupCode"])
    check(v[k] === null || CODES.has(v[k]));
  check(v.recipeSha256 === null || /^[a-f0-9]{64}$/.test(v.recipeSha256));
  check(v.imageId === null || /^sha256:[a-f0-9]{64}$/.test(v.imageId));
  check(Array.isArray(v.commands) && v.commands.length <= 12);
  for (const c of v.commands) {
    keys(c, [
      "verb",
      "exit",
      "signal",
      "timedOut",
      "cancelled",
      "overflow",
      "spawnFailed",
      "elapsedMs",
    ]);
    check(VERBS.has(c.verb) || c.verb === "OTHER");
    check(c.exit === null || integer(c.exit, 255));
    check([null, "SIGTERM", "SIGKILL", "OTHER"].includes(c.signal));
    for (const k of ["timedOut", "cancelled", "overflow", "spawnFailed"])
      check(typeof c[k] === "boolean");
    check(integer(c.elapsedMs));
  }
  check(
    v.status !== "PASS" ||
      (v.childExit === 0 &&
        v.completedCases === 30 &&
        !v.childTimedOut &&
        v.firstUncompletedCase === null),
  );
  return v;
}
export function validateFinalizer(v) {
  keys(v, [
    "attemptId",
    "sourceSha",
    "status",
    "before",
    "after",
    "emergencyRemoved",
    "commandError",
  ]);
  identity(v);
  for (const name of ["before", "after"]) {
    keys(v[name], ["containers", "volumes"]);
    for (const n of Object.values(v[name]))
      check(n === null || integer(n, 256));
  }
  check(
    integer(v.emergencyRemoved, 512) && typeof v.commandError === "boolean",
  );
  const clean =
    !v.commandError &&
    v.before.containers === 0 &&
    v.before.volumes === 0 &&
    v.after.containers === 0 &&
    v.after.volumes === 0 &&
    v.emergencyRemoved === 0;
  check(v.status === (clean ? "PASS" : "ERROR"));
  return v;
}
const signal = (v) =>
  v == null ? null : ["SIGTERM", "SIGKILL"].includes(v) ? v : "OTHER";
const read = (p) => {
  try {
    return JSON.parse(readFileSync(p));
  } catch {
    return null;
  }
};
const emit = (file, value, validate) => {
  validate(value); // Never serialize the raw object or an exception diagnostic.
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o644 });
};
function context() {
  check(process.platform === "linux");
  const sourceSha = process.env.MMP034_SOURCE_SHA;
  const attemptId = process.env.MMP034_ATTEMPT_ID;
  identity({ sourceSha, attemptId });
  const output = process.env.MMP034_OUTPUT;
  check(
    typeof output === "string" &&
      output.startsWith(`${process.env.RUNNER_TEMP}/`),
  );
  mkdirSync(output, { recursive: true, mode: 0o700 });
  return { sourceSha, attemptId, output };
}
function run() {
  const { sourceSha, attemptId, output } = context();
  const cwd = resolve(process.env.MMP034_SOURCE_DIR);
  const git = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd,
    encoding: "utf8",
    timeout: 5000,
  });
  check(git.status === 0 && git.stdout.trim() === sourceSha);
  process.umask(0o077);
  const raw = mkdtempSync(join(tmpdir(), "mmp034-private-"));
  const fd = openSync(join(raw, "child.log"), "wx", 0o600);
  const start = performance.now();
  let child;
  try {
    child = spawnSync(
      process.execPath,
      ["packages/target-worker/src/smoke.mjs"],
      {
        cwd,
        env: {
          PATH: process.env.PATH,
          TARGET_WORKER_EVIDENCE: raw,
          TARGET_WORKER_HEAD_SHA: sourceSha,
        },
        stdio: ["ignore", fd, fd],
        timeout: 14 * 60 * 1000,
        killSignal: "SIGKILL",
      },
    );
  } finally {
    closeSync(fd);
  }
  const summary = read(join(raw, "summary.json"));
  const completed = Array.isArray(summary?.cases) ? summary.cases.length : 0;
  check(integer(completed, 30));
  const failed =
    completed < 30
      ? read(
          join(
            raw,
            `${String(completed).padStart(2, "0")}-${CASES[completed]}.json`,
          ),
        )
      : null;
  const commandRows = (Array.isArray(failed?.commands) ? failed.commands : [])
    .slice(-12)
    .map((r) => ({
      verb: VERBS.has(r.args?.[0]) ? r.args[0] : "OTHER",
      exit: r.exitCode ?? null,
      signal: signal(r.signal),
      timedOut: r.timedOut === true,
      cancelled: r.cancelled === true,
      overflow: r.overflow === true,
      spawnFailed: r.spawnError != null,
      elapsedMs: Math.max(0, Math.round(r.elapsedMs)),
    }));
  const passed =
    child.status === 0 &&
    summary?.sourceHead === sourceSha &&
    summary?.procedure === "PASS" &&
    completed === 30 &&
    summary.cases.every(
      (c, i) => c.id === CASES[i] && c.cleanupVerified === true,
    );
  const recipe = summary?.image?.recipeSha;
  const image = summary?.image?.imageId;
  emit(
    join(output, "attempt.json"),
    {
      attemptId,
      sourceSha,
      status: passed ? "PASS" : "ERROR",
      childExit: child.status,
      childSignal: signal(child.signal),
      childTimedOut: child.error?.code === "ETIMEDOUT",
      elapsedMs: Math.round(performance.now() - start),
      completedCases: completed,
      firstUncompletedCase:
        completed < 30 ? `case-${String(completed).padStart(2, "0")}` : null,
      failedCaseReceiptPresent: failed !== null,
      operationCode: code(failed?.operationError),
      caseCode: code(failed?.error),
      cleanupCode: code(failed?.cleanupError),
      commands: commandRows,
      recipeSha256: typeof recipe === "string" ? recipe : null,
      imageId: typeof image === "string" ? image : null,
    },
    validateAttempt,
  );
  if (!passed) process.exitCode = 1;
}
const owned = (n) => /^mmp007-[a-z0-9-]+$/.test(n);
function finalize() {
  const { sourceSha, attemptId, output } = context();
  let commandError = false;
  const docker = (args) => {
    const r = spawnSync("docker", args, {
      encoding: "utf8",
      timeout: 5000,
      maxBuffer: 1024 * 1024,
    });
    if (r.status !== 0 || r.error) {
      commandError = true;
      return null;
    }
    return r.stdout;
  };
  const list = (volume) => {
    const r = docker(
      volume
        ? ["volume", "ls", "--format", "{{.Name}}"]
        : ["container", "ls", "--all", "--format", "{{.Names}}"],
    );
    if (r === null) return null;
    const names = r.trim().split(/\s+/).filter(owned);
    check(names.length <= 256);
    return names;
  };
  const containers = list(false),
    volumes = list(true);
  const cleanupDeadline = performance.now() + 45000;
  let emergencyRemoved = 0;
  for (const n of containers ?? []) {
    if (performance.now() >= cleanupDeadline) {
      commandError = true;
      break;
    }
    if (docker(["rm", "--force", n]) !== null) emergencyRemoved++;
  }
  for (const n of volumes ?? []) {
    if (performance.now() >= cleanupDeadline) {
      commandError = true;
      break;
    }
    if (docker(["volume", "rm", n]) !== null) emergencyRemoved++;
  }
  const after = {
    containers: list(false)?.length ?? null,
    volumes: list(true)?.length ?? null,
  };
  const before = {
    containers: containers?.length ?? null,
    volumes: volumes?.length ?? null,
  };
  const clean =
    !commandError &&
    before.containers === 0 &&
    before.volumes === 0 &&
    after.containers === 0 &&
    after.volumes === 0 &&
    emergencyRemoved === 0;
  emit(
    join(output, "finalizer.json"),
    {
      attemptId,
      sourceSha,
      status: clean ? "PASS" : "ERROR",
      before,
      after,
      emergencyRemoved,
      commandError,
    },
    validateFinalizer,
  );
  if (!clean) process.exitCode = 1;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    process.argv[2] === "finalize" ? finalize() : run();
  } catch {
    console.error("MMP034_DIAGNOSTIC_ERROR");
    process.exitCode = 1;
  }
}
