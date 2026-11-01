// Trusted, bounded selection of an existing G1 FAIL. Never execute candidate text.
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readdirSync,
  readSync,
  realpathSync,
} from "node:fs";
import { join, parse, resolve } from "node:path";
import { fields, strictJson } from "../../differential/src/strict.mjs";
import { sha256, validateBundle } from "../../target-worker/src/admission.mjs";

export const DIAGNOSTIC_POLICY = Object.freeze({
  recipient: "age1yvf40njrznnr7emg5j76azu62579z38gzh2jqss72l2u9308n5essrvy6f",
  recipientSha256:
    "f829a274ca293c96d0fb80b2e6873eaa6e8ea7070e1d22f6342c8802bbd30917",
  recipientKeySha256:
    "48218aef33dd17354761805a678f95481ad21131336cc348c23cefe99f714600",
  ageVersion: "v1.3.2",
  // Replaced only with independently qualified upstream release executables.
  ageSha256: "eb7dd1b518f0a307c99cd97782623c5321da049154b04acd2d98d21aa7bc9b2c",
  keygenSha256:
    "0a0009db842259d6717f7eeb30acb6b90d2a2eb924c6acd0a0db0ca1f1537899",
  archiveSha256:
    "cbe24006683f8eb669266162894b9a522a1af52f2665fbc63a4bb032ed26ac10",
  image:
    "node@sha256:6c74791e557ce11fc957704f6d4fe134a7bc8d6f5ca4403205b2966bd488f6b3",
  sourceSha: "d272170d0aecbd28eb5b13e272d9dd11d545b66c",
  recipeSha: "f09b12fecd221cb720188266fbb004958e6112eb77e308bf113d15436649dab3",
  phaseBytes: 2 * 1024 * 1024,
  plaintextBytes: 4 * 1024 * 1024,
  ciphertextBytes: 5 * 1024 * 1024,
  deadlineMs: 30000,
});
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const hash = /^[a-f0-9]{64}$/;
export function requireDiagnostic(value) {
  if (!value) throw new Error("DIAGNOSTIC_REJECTED");
}
export function rejectSecrets(value) {
  requireDiagnostic(
    typeof value === "string" &&
      !/gh[pousr]_[A-Za-z0-9]|github_pat_|AKIA[A-Z0-9]{16}|-----BEGIN[^\r\n]*PRIVATE KEY-----|AGE-SECRET-KEY-|\bBearer\s+\S|\b(?:MODEL_API_KEY|ACTIONS_ID_TOKEN_REQUEST_TOKEN|ACTIONS_RUNTIME_TOKEN|AWS_SECRET_ACCESS_KEY)\b|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\./i.test(
        value,
      ),
  );
}
export function diagnosticIdentity(trial, expected) {
  fields(expected, ["runId", "runAttempt", "headSha"]);
  requireDiagnostic(
    /^[1-9][0-9]{0,19}$/.test(expected.runId) &&
      expected.runAttempt === "1" &&
      /^[a-f0-9]{40}$/.test(expected.headSha),
  );
  requireDiagnostic(
    trial.format === "mmp078-public-paid-trial-v1" &&
      trial.modelGeneration === "GENERATED" &&
      trial.trialRunId === expected.runId &&
      trial.budgetAuth?.runId === expected.runId &&
      trial.budgetAuth?.headSha === expected.headSha &&
      trial.budgetAuth?.sourceSha === DIAGNOSTIC_POLICY.sourceSha &&
      trial.headSha === expected.headSha &&
      trial.sourceSha === DIAGNOSTIC_POLICY.sourceSha &&
      hash.test(trial.candidateSha),
  );
  requireDiagnostic(
    trial.publicG1 === "FAIL" &&
      ["INCONCLUSIVE", "NOT_RUN"].includes(trial.publicG2) &&
      ["INCONCLUSIVE", "NOT_RUN"].includes(trial.publicG3),
  );
  requireNormalCleanup(trial.cleanup);
  requireDiagnostic(
    Array.isArray(trial.attempts) && trial.attempts.length === 1,
  );
  const attempt = trial.attempts[0];
  requireDiagnostic(
    uuid.test(attempt.attemptId) &&
      attempt.candidateSha === trial.candidateSha &&
      Array.isArray(attempt.pairs) &&
      attempt.pairs.length === 1,
  );
  const pair = attempt.pairs[0];
  requireDiagnostic(
    uuid.test(pair.pairId) &&
      pair.scenarioId === "workshop-business" &&
      pair.cleanup === "VERIFIED_ZERO_RESOURCES" &&
      Array.isArray(pair.packs) &&
      pair.packs.length === 2,
  );
  const g1 = attempt.gates?.find((g) => g.gate === "G1");
  requireDiagnostic(
    g1?.verdict === "FAIL" && g1.findingCodes?.includes("BUILD_FAILED"),
  );
  const diagnostics = pair.compilerDiagnostics;
  requireDiagnostic(
    diagnostics?.g1Verdict === "FAIL" &&
      diagnostics.sourceSha === trial.sourceSha &&
      diagnostics.candidateSha === trial.candidateSha &&
      diagnostics.attemptId === attempt.attemptId &&
      diagnostics.pairId === pair.pairId,
  );
  requireDiagnostic(new Set(pair.packs.map((p) => p.id)).size === 2);
  for (const p of pair.packs) {
    fields(p, ["id", "sha256"]);
    requireDiagnostic(
      /^oracle-[a-zA-Z0-9_-]{1,80}$/.test(p.id) && hash.test(p.sha256),
    );
  }
  return {
    ...expected,
    sourceSha: trial.sourceSha,
    candidateSha: trial.candidateSha,
    attemptId: attempt.attemptId,
    pairId: pair.pairId,
    scenarioId: pair.scenarioId,
  };
}
export function requireNormalCleanup(cleanup) {
  fields(cleanup, ["status", "containers", "volumes", "emergencyRemoved"]);
  requireDiagnostic(
    cleanup.status === "VERIFIED_ZERO_RESOURCES" &&
      cleanup.containers === 0 &&
      cleanup.volumes === 0 &&
      cleanup.emergencyRemoved === 0,
  );
}
function noLinks(path) {
  let current = parse(resolve(path)).root;
  for (const part of resolve(path)
    .slice(current.length)
    .split(/[\\/]/)
    .filter(Boolean)) {
    current = join(current, part);
    requireDiagnostic(!lstatSync(current).isSymbolicLink());
  }
}
export function readPrivateBytes(path, maxBytes, ownerOnly = true) {
  noLinks(path);
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const st = fstatSync(fd);
    requireDiagnostic(
      st.isFile() &&
        st.nlink === 1 &&
        st.size > 0 &&
        st.size <= maxBytes &&
        (process.platform !== "linux" ||
          (st.uid === process.getuid() &&
            (!ownerOnly || (st.mode & 0o077) === 0))),
    );
    const data = Buffer.alloc(st.size + 1);
    let count = 0;
    while (count < data.length) {
      const n = readSync(fd, data, count, data.length - count, count);
      if (!n) break;
      count += n;
    }
    const after = fstatSync(fd);
    const named = lstatSync(path);
    requireDiagnostic(
      count === st.size &&
        [after, named].every(
          (s) =>
            s.ino === st.ino &&
            s.dev === st.dev &&
            s.size === st.size &&
            s.mtimeMs === st.mtimeMs &&
            s.ctimeMs === st.ctimeMs &&
            s.nlink === 1 &&
            s.mode === st.mode,
        ),
    );
    return data.subarray(0, count);
  } finally {
    closeSync(fd);
  }
}
export function readPrivateJson(
  path,
  maxBytes = 16 * 1024 * 1024,
  ownerOnly = true,
) {
  const bytes = readPrivateBytes(path, maxBytes, ownerOnly);
  return {
    bytes,
    value: strictJson(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      maxBytes,
    ),
  };
}
// Read only public-selected pack indexes, provenance and the two indexed bridge
// records. No recursive traversal, archive, reference pack or whole-pack export.
export function collectDiagnosticPackage(trial, expected, verificationRoot) {
  const identity = diagnosticIdentity(trial, expected);
  const pair = trial.attempts[0].pairs[0];
  let selected;
  for (const pack of pair.packs) {
    const path = join(
      verificationRoot,
      identity.attemptId,
      identity.pairId,
      pack.id,
    );
    noLinks(path);
    const st = lstatSync(path);
    requireDiagnostic(
      st.isDirectory() &&
        realpathSync(path) === resolve(path) &&
        (process.platform !== "linux" ||
          (st.uid === process.getuid() && (st.mode & 0o077) === 0)),
    );
    const { bytes, value: index } = readPrivateJson(
      join(path, "index.json"),
      128 * 1024,
    );
    fields(index, ["format", "retention", "entries"]);
    requireDiagnostic(
      sha256(bytes) === pack.sha256 &&
        index.format === "oracle-private-pack-v1" &&
        Buffer.from(JSON.stringify(index)).equals(bytes) &&
        Array.isArray(index.entries) &&
        index.entries.length > 0 &&
        index.entries.length <= 512,
    );
    const ids = new Set();
    for (const e of index.entries) {
      fields(e, ["id", "bytes", "sha256"]);
      requireDiagnostic(
        /^[a-z0-9][a-z0-9-]{0,119}$/.test(e.id) &&
          e.id !== "index" &&
          !ids.has(e.id) &&
          Number.isSafeInteger(e.bytes) &&
          e.bytes > 0 &&
          e.bytes <= 16 * 1024 * 1024 &&
          hash.test(e.sha256),
      );
      ids.add(e.id);
    }
    requireDiagnostic(
      JSON.stringify(readdirSync(path).sort()) ===
        JSON.stringify(
          [...ids]
            .map((id) => `${id}.json`)
            .concat("index.json")
            .sort(),
        ),
    );
    const readEntry = (entry) => {
      requireDiagnostic(entry);
      const r = readPrivateJson(join(path, `${entry.id}.json`));
      requireDiagnostic(
        r.bytes.length === entry.bytes && sha256(r.bytes) === entry.sha256,
      );
      return r.value;
    };
    const provenance = readEntry(
      index.entries.find((e) => e.id === "provenance"),
    );
    fields(provenance, [
      "headSha",
      "attemptId",
      "pairId",
      "candidateSha",
      "scenarioId",
    ]);
    requireDiagnostic(
      Object.entries(provenance).every(
        ([key, value]) => identity[key] === value,
      ),
    );
    const sources = index.entries.filter((e) =>
      /^pair-[1-9][0-9]*-source$/.test(e.id),
    );
    const completions = index.entries.filter((e) =>
      /^pair-[1-9][0-9]*-completion$/.test(e.id),
    );
    if (!sources.length && !completions.length) continue; // independent PHP pack
    requireDiagnostic(
      !selected && sources.length === 1 && completions.length === 1,
    );
    selected = buildDiagnosticPackage(
      identity,
      readEntry(sources[0]),
      readEntry(completions[0]),
    );
  }
  requireDiagnostic(selected);
  return selected;
}
export function buildDiagnosticPackage(identity, source, completion) {
  fields(source, ["files", "candidateSha"]);
  const bundle = validateBundle(source.files, identity.candidateSha);
  for (const file of bundle.files) {
    rejectSecrets(file.path);
    rejectSecrets(file.content);
  }
  requireDiagnostic(source.candidateSha === identity.candidateSha);
  fields(completion, [
    "workerEvidence",
    "targetFailure",
    "failure",
    "cleanup",
    "gates",
    "build",
  ]);
  const worker = completion.workerEvidence;
  fields(completion.targetFailure, ["operationCode", "cleanupCode"]);
  requireDiagnostic(
    completion.cleanup === "VERIFIED_ZERO_RESOURCES" &&
      completion.failure === "BUILD_FAILED" &&
      completion.targetFailure.operationCode === "BUILD_FAILED" &&
      completion.targetFailure.cleanupCode === null &&
      Array.isArray(completion.gates) &&
      completion.gates.length === 0 &&
      completion.build?.gate === "G1" &&
      completion.build.verdict === "FAIL" &&
      JSON.stringify(completion.build.findingCodes) === '["BUILD_FAILED"]' &&
      worker.candidateSha === identity.candidateSha &&
      worker.cleanupVerified === true &&
      worker.operationError === "BUILD_FAILED",
  );
  requireDiagnostic(
    /^mmp007-[a-f0-9-]{36}$/.test(worker.runId) &&
      /^sha256:[a-f0-9]{64}$/.test(worker.imageId) &&
      worker.provenance?.imageId === worker.imageId &&
      worker.provenance.recipeSha === DIAGNOSTIC_POLICY.recipeSha &&
      sha256(JSON.stringify(worker.provenance.hashes)) ===
        DIAGNOSTIC_POLICY.recipeSha &&
      worker.provenance.measured?.node === "v24.11.0" &&
      worker.provenance.measured?.typescript === "5.9.3" &&
      worker.provenance.measured?.sqlite === "3.50.4" &&
      worker.provenance.measured?.faketime === "0.9.10-2.1" &&
      worker.provenance.measured?.clockPolicy ===
        "libfaketime-real-monotonic-v1",
  );
  requireDiagnostic(
    Object.entries(worker.provenance.hashes).every(
      ([name, value]) =>
        name === "Dockerfile" ||
        worker.provenance.measured.hashes?.[name] === value,
    ),
  );
  const receipt = worker.build;
  fields(receipt, [
    "args",
    "exitCode",
    "signal",
    "spawnError",
    "timedOut",
    "cancelled",
    "overflow",
    "elapsedMs",
    "stdout",
    "stderr",
  ]);
  const expectedArgs = [
    "run",
    "--interactive",
    "--name",
    `${worker.runId}-build`,
    "--label",
    "metamorph.target-worker=true",
    "--init",
    "--network",
    "none",
    "--read-only",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--cpus",
    "1",
    "--memory",
    "256m",
    "--memory-swap",
    "256m",
    "--pids-limit",
    "64",
    "--ulimit",
    "nofile=128:128",
    "--stop-timeout",
    "1",
    "--tmpfs",
    "/work:rw,nosuid,nodev,size=64m,uid=10001,gid=10001,mode=0700",
    "--tmpfs",
    "/tmp:rw,nosuid,nodev,noexec,size=16m,mode=1777",
    worker.imageId,
    "node",
    "/opt/worker/build.mjs",
  ];
  requireDiagnostic(
    JSON.stringify(receipt.args) === JSON.stringify(expectedArgs) &&
      receipt.exitCode === 2 &&
      receipt.signal === null &&
      receipt.spawnError === null &&
      receipt.timedOut === false &&
      receipt.cancelled === false &&
      receipt.overflow === false &&
      Number.isFinite(receipt.elapsedMs) &&
      receipt.elapsedMs >= 0 &&
      receipt.elapsedMs <= 35000 &&
      receipt.stderr === "",
  );
  const output = strictJson(receipt.stdout, 4 * 1024 * 1024);
  fields(output, ["checks", "artifacts"]);
  requireDiagnostic(
    Array.isArray(output.artifacts) &&
      output.artifacts.length === 0 &&
      Array.isArray(output.checks) &&
      output.checks.length >= 1 &&
      output.checks.length <= 2,
  );
  let total = 0;
  for (const [i, phase] of output.checks.entries()) {
    fields(phase, ["phase", "exitCode", "signal", "error", "stdout", "stderr"]);
    requireDiagnostic(
      phase.phase === ["typecheck", "build"][i] &&
        Number.isInteger(phase.exitCode) &&
        phase.exitCode >= 0 &&
        phase.exitCode <= 255 &&
        phase.error === null &&
        phase.signal === null &&
        typeof phase.stdout === "string" &&
        typeof phase.stderr === "string" &&
        (i === output.checks.length - 1
          ? phase.exitCode !== 0
          : phase.exitCode === 0),
    );
    total += Buffer.byteLength(phase.stdout) + Buffer.byteLength(phase.stderr);
    rejectSecrets(phase.stdout);
    rejectSecrets(phase.stderr);
  }
  requireDiagnostic(total <= DIAGNOSTIC_POLICY.phaseBytes);
  requireDiagnostic(
    JSON.stringify(completion.build.executedTestIds) ===
      JSON.stringify(
        output.checks.map((p) => `${identity.scenarioId}:${p.phase}`),
      ),
  );
  const compiler = {
    recipeSha: DIAGNOSTIC_POLICY.recipeSha,
    imageId: worker.imageId,
    invocationSha256: sha256(JSON.stringify(receipt.args)),
    exitCode: receipt.exitCode,
    checks: output.checks,
  };
  const result = {
    format: "mmp089-private-diagnostics-v1",
    identity: { ...identity },
    manifest: bundle.files.map((f) => ({
      path: f.path,
      bytes: Buffer.byteLength(f.content),
      sha256: f.sha256,
    })),
    compilerSha256: sha256(JSON.stringify(compiler)),
    compiler,
    files: bundle.files,
  };
  const plaintext = JSON.stringify(result);
  requireDiagnostic(
    Buffer.byteLength(plaintext) <= DIAGNOSTIC_POLICY.plaintextBytes,
  );
  rejectSecrets(plaintext);
  return result;
}
export function preservationRecord(
  status,
  identity = null,
  ciphertext = null,
  cleanup = "NOT_RUN",
) {
  const completed = identity?.case === "G1_PASS_COMPLETED";
  requireDiagnostic(identity?.case === undefined || completed);
  if (completed) requireDiagnostic(hash.test(identity.bindingsSha256));
  requireDiagnostic(
    [
      "NOT_APPLICABLE",
      "REJECTED",
      "ENCRYPTED_PENDING_UPLOAD",
      "PRESERVED",
      "UPLOAD_FAILED",
    ].includes(status),
  );
  requireDiagnostic(
    ["NOT_RUN", "VERIFIED_ZERO_RESOURCES", "ERROR"].includes(cleanup),
  );
  if (identity)
    requireDiagnostic(
      /^[1-9][0-9]{0,19}$/.test(identity.runId) &&
        /^[1-9][0-9]{0,5}$/.test(identity.runAttempt) &&
        /^[a-f0-9]{40}$/.test(identity.headSha) &&
        identity.sourceSha === DIAGNOSTIC_POLICY.sourceSha &&
        hash.test(identity.candidateSha) &&
        uuid.test(identity.attemptId) &&
        uuid.test(identity.pairId),
    );
  if (ciphertext)
    requireDiagnostic(
      identity &&
        hash.test(ciphertext.sha256) &&
        Number.isSafeInteger(ciphertext.bytes) &&
        ciphertext.bytes > 100 &&
        ciphertext.bytes <= DIAGNOSTIC_POLICY.ciphertextBytes,
    );
  if (
    ["ENCRYPTED_PENDING_UPLOAD", "PRESERVED", "UPLOAD_FAILED"].includes(status)
  )
    requireDiagnostic(
      identity && ciphertext && cleanup === "VERIFIED_ZERO_RESOURCES",
    );
  // Fresh object allowlist: never publish arbitrary exception text or payload fields.
  return {
    format: completed ? "mmp097-preservation-v1" : "mmp089-preservation-v1",
    status,
    identity:
      identity &&
      Object.fromEntries(
        [
          "runId",
          "runAttempt",
          "headSha",
          "sourceSha",
          "candidateSha",
          "attemptId",
          "pairId",
          ...(completed ? ["case", "bindingsSha256"] : []),
        ].map((k) => [k, identity[k]]),
      ),
    recipientFingerprint: DIAGNOSTIC_POLICY.recipientKeySha256,
    ageVersion: DIAGNOSTIC_POLICY.ageVersion,
    ageSha256: DIAGNOSTIC_POLICY.ageSha256,
    ciphertextSha256: ciphertext?.sha256 ?? null,
    ciphertextBytes: ciphertext?.bytes ?? null,
    plaintextStaging: "MEMORY_AND_PIPE_ONLY",
    collectorCleanup: cleanup,
    upload:
      status === "PRESERVED"
        ? "SUCCEEDED"
        : status === "UPLOAD_FAILED"
          ? "FAILED"
          : "NOT_RUN",
  };
}
