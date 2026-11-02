// Trusted local runner. Exactly one existing verifier CLI invocation; no model/repair.
import { execFileSync, spawnSync } from "node:child_process";
import { lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { audit } from "./audit.mjs";
import { STAGES } from "./observer.mjs";

export const CANDIDATE =
  "0cf5ba0bb22fd1d335b3d061b0a9b258d7ac660f3038e1e651ddaad1262d03c1";
const SOURCE = "d272170d0aecbd28eb5b13e272d9dd11d545b66c";
const categories = [
  "UNKNOWN",
  "SIGNAL_ABORTED",
  "COMMAND_TIMEOUT",
  "COMMAND_CANCELLED",
  "COMMAND_UNAVAILABLE",
  "COMMAND_OUTPUT_LIMIT",
  "COMMAND_EXIT_NONZERO",
];
const check = (ok) => {
  if (!ok) throw Error("MMP125_DIAGNOSTIC_REJECTED");
};
const exact = (o, keys) =>
  check(
    o &&
      typeof o === "object" &&
      !Array.isArray(o) &&
      JSON.stringify(Object.keys(o).sort()) ===
        JSON.stringify([...keys].sort()),
  );
export function validateTrace(raw, expected) {
  exact(raw, ["diagnosticId", "headSha", "candidateSha", "trace"]);
  check(
    raw.diagnosticId === expected.diagnosticId &&
      raw.headSha === expected.headSha &&
      raw.candidateSha === CANDIDATE,
  );
  const t = raw.trace;
  exact(t, [
    "format",
    "status",
    "firstRejectedBoundary",
    "failureClass",
    "rootCause",
    "events",
  ]);
  check(
    t.format === "mmp125-boundary-trace-v1" &&
      ["COMPLETE", "UNAVAILABLE"].includes(t.status) &&
      t.rootCause === "UNKNOWN" &&
      Array.isArray(t.events) &&
      t.events.length <= 128,
  );
  const calls = new Map();
  let max = 0;
  for (const e of t.events) {
    exact(e, ["id", "parent", "stage", "outcome", "category"]);
    check(
      Number.isSafeInteger(e.id) &&
        e.id > 0 &&
        e.id <= 4096 &&
        (e.parent === null ||
          (Number.isSafeInteger(e.parent) &&
            e.parent > 0 &&
            e.parent < e.id)) &&
        (e.category === null || categories.includes(e.category)),
    );
    if (e.outcome === "ENTER" || e.outcome === "UNSUCCESSFUL") {
      check(e.id > max && (e.parent === null || calls.get(e.parent)?.pending));
      max = e.id;
      if (e.outcome === "ENTER") {
        check(STAGES.includes(e.stage) && e.category === null);
        calls.set(e.id, { ...e, pending: true });
      } else
        check(
          e.stage === "TRUSTED_COMMAND" &&
            e.parent !== null &&
            e.category?.startsWith("COMMAND_"),
        );
    } else {
      const start = calls.get(e.id);
      check(
        start?.pending &&
          start.stage === e.stage &&
          start.parent === e.parent &&
          ["FULFILLED", "REJECTED"].includes(e.outcome) &&
          (e.outcome === "FULFILLED"
            ? e.category === null
            : ["UNKNOWN", "SIGNAL_ABORTED"].includes(e.category)),
      );
      start.pending = false;
    }
  }
  if (t.status === "COMPLETE")
    check([...calls.values()].every((c) => !c.pending));
  const first = t.events.find(
    (e) => e.outcome === "REJECTED" && !e.stage.endsWith("_CLOSE"),
  );
  const command =
    first &&
    t.events.find((e) => e.outcome === "UNSUCCESSFUL" && e.parent === first.id);
  check(
    t.firstRejectedBoundary ===
      (t.status === "COMPLETE" ? (first?.stage ?? null) : null),
  );
  check(
    t.failureClass ===
      (t.status === "COMPLETE"
        ? (command?.category ?? first?.category ?? "UNKNOWN")
        : "UNKNOWN"),
  );
  return t;
}
export function projectDiagnostic(
  summary,
  rawTrace,
  finalizer,
  expected,
  childExit,
) {
  check(
    /^[a-f0-9]{40}$/.test(expected.headSha) &&
      /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(
        expected.diagnosticId,
      ),
  );
  check(
    summary.headSha === expected.headSha &&
      summary.driver.candidatePin === CANDIDATE &&
      summary.cases.length === 1 &&
      summary.modelRequests === 0,
  );
  const c = summary.cases[0];
  check(
    summary.status === "PASS" &&
      c.status === "PASS" &&
      c.candidateSha === CANDIDATE &&
      c.product === "NOT_ESTABLISHED" &&
      summary.driver.sourcePin.commit === SOURCE,
  );
  check(
    c.coverage.requiredHttp === 17 &&
      c.coverage.requiredSqlite === 20 &&
      Number.isSafeInteger(c.coverage.http) &&
      c.coverage.http >= 0 &&
      c.coverage.http <= 17 &&
      Number.isSafeInteger(c.coverage.sqlite) &&
      c.coverage.sqlite >= 0 &&
      c.coverage.sqlite <= 20,
  );
  const t = validateTrace(rawTrace, expected);
  const cleanup =
    childExit === 0 &&
    c.cleanup.status === "VERIFIED_ZERO_RESOURCES" &&
    c.cleanup.containers === 0 &&
    c.cleanup.volumes === 0 &&
    c.cleanup.emergencyRemoved === 0 &&
    finalizer.headSha === expected.headSha &&
    finalizer.status === "PASS" &&
    finalizer.inventory.containers === 0 &&
    finalizer.inventory.volumes === 0 &&
    finalizer.emergencyRemoved === 0;
  const gates = Object.fromEntries(
    ["G1", "G2", "G3", "G4"].map((k) => {
      const g = c.gates[k];
      check(
        ["PASS", "FAIL", "ERROR", "INCONCLUSIVE"].includes(g.verdict) &&
          Number.isSafeInteger(g.executedCount) &&
          g.executedCount >= 0 &&
          g.executedCount <= 27,
      );
      return [k, { verdict: g.verdict, executed: g.executedCount }];
    }),
  );
  check(
    gates.G1.executed <= 6 &&
      gates.G2.executed <= 17 &&
      gates.G3.executed <= 20 &&
      gates.G4.verdict === "INCONCLUSIVE" &&
      c.gates.G4.findingCodes.includes("HELD_OUT_NOT_RUN"),
  );
  const errored = [gates.G2.verdict, gates.G3.verdict].includes("ERROR");
  const observed =
    t.status === "COMPLETE" && errored && t.firstRejectedBoundary !== null;
  const boundary = observed ? t.firstRejectedBoundary : null;
  return {
    format: "mmp125-live-diagnostic-v1",
    diagnosticId: expected.diagnosticId,
    headSha: expected.headSha,
    sourceSha: SOURCE,
    candidateSha: CANDIDATE,
    status: !cleanup
      ? "ERROR_CLEANUP_OR_DRIVER"
      : t.status !== "COMPLETE"
        ? "INCONCLUSIVE_OBSERVER"
        : observed
          ? "DIAGNOSTIC_OBSERVED"
          : errored
            ? "INCONCLUSIVE_NO_BOUNDARY"
            : "ERROR_NOT_REPRODUCED",
    evidenceKind:
      "ACTUAL_LOCAL_LINUX_DOCKER_UNCHANGED_VERIFIER_WITH_TRUSTED_OBSERVER",
    gates,
    coverage: {
      http: c.coverage.http,
      sqlite: c.coverage.sqlite,
      requiredHttp: 17,
      requiredSqlite: 20,
    },
    failedBoundary: boundary,
    failedSide: boundary?.startsWith("REFERENCE_")
      ? "REFERENCE"
      : boundary?.startsWith("TARGET_")
        ? "TARGET"
        : "UNKNOWN",
    errorClass: observed ? t.failureClass : "UNKNOWN",
    attributionScope: "TRUSTED_BOUNDARY_ONLY_NOT_APPLICATION_ROOT_CAUSE",
    rootCause: "UNKNOWN",
    historicalMetaCause: "UNKNOWN",
    observerStatus: t.status,
    eventCount: t.events.length,
    boundaryTrace: t,
    normalCleanup: cleanup ? "VERIFIED_ZERO_RESOURCES" : "ERROR",
    independentFinalizer: cleanup ? "0/0/0" : "ERROR",
    childExit,
    newModelRequests: 0,
    repairs: 0,
    newArtifactUploads: 0,
    formalG4: "NOT_RUN",
    product: "NOT_ESTABLISHED",
  };
}
function read(path, limit) {
  const info = lstatSync(path);
  check(
    info.isFile() &&
      !info.isSymbolicLink() &&
      info.nlink === 1 &&
      info.size <= limit,
  );
  const bytes = readFileSync(path);
  check(bytes.length === info.size);
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}
async function main() {
  const root = fileURLToPath(new URL("../../", import.meta.url)),
    env = process.env;
  check(
    process.platform === "linux" &&
      process.argv.length === 2 &&
      env.MMP125_PRIVATE &&
      env.MMP125_OUTPUT &&
      /^[a-f0-9]{40}$/.test(env.MMP125_HEAD ?? "") &&
      /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(env.MMP125_ID ?? ""),
  );
  check(
    resolve(env.MMP125_PRIVATE) === env.MMP125_PRIVATE &&
      resolve(env.MMP125_OUTPUT) === env.MMP125_OUTPUT,
  );
  const head = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  check(head === env.MMP125_HEAD);
  audit(root);
  process.umask(0o077);
  const privateRoot = env.MMP125_PRIVATE,
    legacy = join(privateRoot, "legacy-public"),
    final = join(privateRoot, "finalizer");
  mkdirSync(legacy, { mode: 0o700 });
  mkdirSync(final, { mode: 0o700 });
  const childEnv = {
    PATH: "/usr/local/bin:/usr/bin:/bin",
    HOME: join(privateRoot, "home"),
    TZ: "UTC",
    AGENT_HEAD_SHA: head,
    MMP125_HEAD: head,
    MMP125_ID: env.MMP125_ID,
    MMP125_PRIVATE: privateRoot,
    MMP123_PRIVATE_PARENT: join(privateRoot, "state"),
    MMP123_PUBLIC_OUTPUT: legacy,
  };
  const child = spawnSync(
    process.execPath,
    [
      "--import",
      join(root, "research/mmp-125/trace-hooks.mjs"),
      join(root, "research/mmp-123/verifier-proof.mjs"),
      "repair",
    ],
    {
      cwd: root,
      env: childEnv,
      timeout: 900000,
      killSignal: "SIGKILL",
      maxBuffer: 65536,
      encoding: "utf8",
    },
  );
  writeFileSync(
    join(privateRoot, "driver.log"),
    `${child.stdout ?? ""}${child.stderr ?? ""}`,
    { mode: 0o600 },
  );
  // Even timeout/crash gets a fresh independent finalizer. Dedicated daemon was
  // checked empty by the launcher; never reinterpret emergency removal as normal.
  const f = spawnSync(
    process.execPath,
    [join(root, "packages/differential/src/workshop-finalizer.mjs")],
    {
      cwd: root,
      env: {
        PATH: childEnv.PATH,
        HOME: childEnv.HOME,
        PILOT_HEAD_SHA: head,
        WORKSHOP_PUBLIC_OUTPUT: final,
      },
      timeout: 45000,
      maxBuffer: 8192,
    },
  );
  writeFileSync(
    join(privateRoot, "finalizer.log"),
    Buffer.concat([f.stdout ?? Buffer.alloc(0), f.stderr ?? Buffer.alloc(0)]),
    { mode: 0o600 },
  );
  audit(root);
  const record = projectDiagnostic(
    read(join(legacy, "summary.json"), 131072),
    read(join(privateRoot, "trace.json"), 65536),
    read(join(final, "finalizer.json"), 4096),
    { diagnosticId: env.MMP125_ID, headSha: head },
    child.status,
  );
  const json = JSON.stringify(record, null, 2);
  check(Buffer.byteLength(json) < 65536);
  writeFileSync(join(env.MMP125_OUTPUT, "diagnostic.json"), `${json}\n`, {
    flag: "wx",
    mode: 0o600,
  });
  if (
    record.normalCleanup !== "VERIFIED_ZERO_RESOURCES" ||
    record.observerStatus !== "COMPLETE"
  )
    process.exitCode = 1;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    await main();
  } catch {
    console.error("MMP125_DIAGNOSTIC_ERROR");
    process.exitCode = 1;
  }
}
