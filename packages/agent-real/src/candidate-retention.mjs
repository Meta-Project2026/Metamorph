// Trusted source-only retention for completed public validation. Never execute TS.
import { lstatSync, readdirSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { MANIFEST } from "@metamorph/oracle";
import { fields, strictJson } from "../../differential/src/strict.mjs";
import { sha256, validateBundle } from "../../target-worker/src/admission.mjs";
import { sandboxArgs } from "../../target-worker/src/controller.mjs";
import {
  collectDiagnosticPackage,
  DIAGNOSTIC_POLICY,
  diagnosticIdentity,
  readPrivateJson,
  rejectSecrets,
  requireDiagnostic,
  requireNormalCleanup,
} from "./private-diagnostics.mjs";
import { expectedIds } from "./report.mjs";

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const hash = /^[a-f0-9]{64}$/;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const pairIdentity = (identity, pair) => ({
  headSha: identity.headSha,
  attemptId: identity.attemptId,
  pairId: pair.pairId,
  candidateSha: identity.candidateSha,
  scenarioId: pair.scenarioId,
});
const buildIds = (scenario) => [
  `${scenario.id}:typecheck`,
  `${scenario.id}:build`,
];

function finishedGate(gate, name, ids) {
  fields(gate, ["gate", "verdict", "executedTestIds", "findingCodes"]);
  requireDiagnostic(
    gate.gate === name &&
      ["PASS", "FAIL"].includes(gate.verdict) &&
      same(gate.executedTestIds, ids) &&
      Array.isArray(gate.findingCodes) &&
      new Set(gate.findingCodes).size === gate.findingCodes.length &&
      (gate.verdict === "PASS"
        ? gate.findingCodes.length === 0
        : gate.findingCodes.length > 0) &&
      gate.findingCodes.every((code) =>
        name === "G2"
          ? /^HTTP_(STATUS|HEADER|JSON_TYPE|JSON_VALUE|JSON_MISSING|JSON_LENGTH|BODY)$/.test(
              code,
            )
          : name === "G3" && ["DB_SCHEMA", "DB_STATE"].includes(code),
      ),
  );
}

// Called only by the trusted runtime after observing build, lease and cleanup.
// No candidate output or reference/Oracle values are placed in this sidecar.
export function completedRetentionReceipt(
  identity,
  worker,
  build,
  gates,
  failure,
  cleanup,
  targetFailure,
) {
  const receipt = worker.evidence.build;
  const output = strictJson(receipt.stdout, DIAGNOSTIC_POLICY.plaintextBytes);
  fields(output, ["checks", "artifacts"]);
  requireDiagnostic(Array.isArray(output.checks) && output.checks.length === 2);
  const phases = output.checks.map((phase) => {
    fields(phase, ["phase", "exitCode", "signal", "error", "stdout", "stderr"]);
    return Object.fromEntries(
      ["phase", "exitCode", "signal", "error"].map((key) => [key, phase[key]]),
    );
  });
  requireDiagnostic(same(output.checks, worker.evidence.buildChecks));
  const provenance = worker.evidence.provenance;
  return {
    format: "mmp097-completed-pair-v1",
    ...identity,
    sourceSha: DIAGNOSTIC_POLICY.sourceSha,
    cleanup,
    failure,
    targetFailure,
    build,
    parity: gates.filter((g) => ["G2", "G3"].includes(g.gate)),
    worker: {
      runId: worker.runId,
      candidateSha: worker.evidence.candidateSha,
      imageId: worker.evidence.imageId,
      cleanupVerified: worker.evidence.cleanupVerified,
      operationError: worker.evidence.operationError ?? null,
      recipeSha: provenance.recipeSha,
      hashes: provenance.hashes,
      measured: Object.fromEntries(
        [
          "node",
          "typescript",
          "sqlite",
          "faketime",
          "clockPolicy",
          "hashes",
        ].map((key) => [key, provenance.measured[key]]),
      ),
      invocation: Object.fromEntries(
        [
          "args",
          "exitCode",
          "signal",
          "spawnError",
          "timedOut",
          "cancelled",
          "overflow",
        ].map((key) => [key, receipt[key]]),
      ),
      phases,
    },
  };
}

export function preservationIdentity(trial, expected) {
  if (trial.publicG1 === "FAIL") return diagnosticIdentity(trial, expected);
  fields(expected, ["runId", "runAttempt", "headSha"]);
  requireDiagnostic(
    /^[1-9][0-9]{0,19}$/.test(expected.runId) &&
      expected.runAttempt === "1" &&
      /^[a-f0-9]{40}$/.test(expected.headSha) &&
      trial.format === "mmp078-public-paid-trial-v1" &&
      trial.modelGeneration === "GENERATED" &&
      trial.publicG1 === "PASS" &&
      ["PASS", "FAIL"].includes(trial.publicG2) &&
      ["PASS", "FAIL"].includes(trial.publicG3) &&
      trial.trialRunId === expected.runId &&
      trial.budgetAuth?.runId === expected.runId &&
      trial.budgetAuth?.headSha === expected.headSha &&
      trial.headSha === expected.headSha &&
      trial.sourceSha === DIAGNOSTIC_POLICY.sourceSha &&
      trial.budgetAuth?.sourceSha === trial.sourceSha &&
      hash.test(trial.candidateSha) &&
      Array.isArray(trial.attempts) &&
      trial.attempts.length === 1,
  );
  requireNormalCleanup(trial.cleanup);
  const attempt = trial.attempts[0];
  requireDiagnostic(
    uuid.test(attempt.attemptId) &&
      attempt.candidateSha === trial.candidateSha &&
      Array.isArray(attempt.pairs) &&
      attempt.pairs.length === MANIFEST.length,
  );
  const identity = {
    ...expected,
    sourceSha: trial.sourceSha,
    candidateSha: trial.candidateSha,
    attemptId: attempt.attemptId,
  };
  const pairIds = new Set();
  const packIds = new Set();
  for (const [i, pair] of attempt.pairs.entries()) {
    requireDiagnostic(
      uuid.test(pair.pairId) &&
        !pairIds.has(pair.pairId) &&
        pair.scenarioId === MANIFEST[i].id &&
        pair.cleanup === "VERIFIED_ZERO_RESOURCES" &&
        pair.targetLifetimePolicyMs === 180000 &&
        Array.isArray(pair.packs) &&
        pair.packs.length === 2,
    );
    pairIds.add(pair.pairId);
    const diagnostics = pair.compilerDiagnostics;
    requireDiagnostic(
      diagnostics?.g1Verdict === "PASS" &&
        diagnostics.sourceSha === trial.sourceSha &&
        diagnostics.candidateSha === trial.candidateSha &&
        diagnostics.attemptId === attempt.attemptId &&
        diagnostics.pairId === pair.pairId,
    );
    for (const pack of pair.packs) {
      fields(pack, ["id", "sha256"]);
      requireDiagnostic(
        /^oracle-[a-zA-Z0-9_-]{1,80}$/.test(pack.id) &&
          hash.test(pack.sha256) &&
          !packIds.has(pack.id),
      );
      packIds.add(pack.id);
    }
    requireDiagnostic(Array.isArray(pair.gates) && pair.gates.length === 3);
    for (const [j, name] of ["G2", "G3"].entries())
      finishedGate(pair.gates[j], name, expectedIds(MANIFEST[i], name));
  }
  requireDiagnostic(Array.isArray(attempt.gates) && attempt.gates.length === 5);
  for (const name of ["G1", "G2", "G3"]) {
    const gate = attempt.gates.filter((g) => g.gate === name);
    requireDiagnostic(gate.length === 1);
    const ids = MANIFEST.flatMap((s) =>
      name === "G1" ? buildIds(s) : expectedIds(s, name),
    );
    finishedGate(gate[0], name, ids);
    const entries =
      name === "G1"
        ? []
        : attempt.pairs.map((p) => p.gates.find((g) => g.gate === name));
    const verdict = entries.some((g) => g.verdict === "FAIL") ? "FAIL" : "PASS";
    requireDiagnostic(
      gate[0].verdict === verdict &&
        trial[`public${name}`] === verdict &&
        same(gate[0].findingCodes, [
          ...new Set(entries.flatMap((g) => g.findingCodes)),
        ]),
    );
  }
  fields(attempt.coverage, [
    "http",
    "sqlite",
    "requiredHttp",
    "requiredSqlite",
  ]);
  const http = MANIFEST.flatMap((s) => expectedIds(s, "G2")).length;
  const sqlite = MANIFEST.flatMap((s) => expectedIds(s, "G3")).length;
  requireDiagnostic(
    same(attempt.coverage, {
      http,
      sqlite,
      requiredHttp: http,
      requiredSqlite: sqlite,
    }),
  );
  return {
    ...identity,
    pairId: attempt.pairs[0].pairId,
    case: "G1_PASS_COMPLETED",
    bindingsSha256: sha256(
      JSON.stringify(
        attempt.pairs.map((p) => ({
          scenarioId: p.scenarioId,
          pairId: p.pairId,
          packs: p.packs,
          cleanup: p.cleanup,
          targetLifetimePolicyMs: p.targetLifetimePolicyMs,
          build: Object.fromEntries(
            [
              "g1Verdict",
              "sourceSha",
              "candidateSha",
              "attemptId",
              "pairId",
            ].map((key) => [key, p.compilerDiagnostics[key]]),
          ),
          parity: p.gates.slice(0, 2),
        })),
      ),
    ),
  };
}

function readSourcePack(root, pair, pack, identity) {
  const path = join(root, identity.attemptId, pair.pairId, pack.id);
  const st = lstatSync(path);
  requireDiagnostic(
    st.isDirectory() &&
      !st.isSymbolicLink() &&
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
  for (const entry of index.entries) {
    fields(entry, ["id", "bytes", "sha256"]);
    requireDiagnostic(
      /^[a-z0-9][a-z0-9-]{0,119}$/.test(entry.id) &&
        entry.id !== "index" &&
        !ids.has(entry.id) &&
        Number.isSafeInteger(entry.bytes) &&
        entry.bytes > 0 &&
        entry.bytes <= 16 * 1024 * 1024 &&
        hash.test(entry.sha256),
    );
    ids.add(entry.id);
  }
  requireDiagnostic(
    same(
      readdirSync(path).sort(),
      [...ids]
        .map((id) => `${id}.json`)
        .concat("index.json")
        .sort(),
    ),
  );
  const read = (entry, bound) => {
    requireDiagnostic(entry && entry.bytes <= bound);
    const selected = readPrivateJson(join(path, `${entry.id}.json`), bound);
    requireDiagnostic(
      selected.bytes.length === entry.bytes &&
        sha256(selected.bytes) === entry.sha256,
    );
    return selected.value;
  };
  const provenance = read(
    index.entries.find((e) => e.id === "provenance"),
    8192,
  );
  fields(provenance, [
    "headSha",
    "attemptId",
    "pairId",
    "candidateSha",
    "scenarioId",
  ]);
  requireDiagnostic(same(provenance, pairIdentity(identity, pair)));
  const sources = index.entries.filter((e) =>
    /^pair-[1-9][0-9]*-source$/.test(e.id),
  );
  const receipts = index.entries.filter((e) =>
    /^pair-[1-9][0-9]*-retention$/.test(e.id),
  );
  if (!sources.length && !receipts.length) return null; // PHP index/provenance only; no reference observations.
  requireDiagnostic(sources.length === 1 && receipts.length === 1);
  return {
    source: read(sources[0], DIAGNOSTIC_POLICY.plaintextBytes),
    receipt: read(receipts[0], 128 * 1024),
  };
}

export function validateCompletedReceipt(identity, pair, source, receipt) {
  fields(source, ["files", "candidateSha"]);
  const bundle = validateBundle(source.files, identity.candidateSha);
  requireDiagnostic(source.candidateSha === identity.candidateSha);
  fields(receipt, [
    "format",
    "headSha",
    "attemptId",
    "pairId",
    "candidateSha",
    "scenarioId",
    "sourceSha",
    "cleanup",
    "failure",
    "targetFailure",
    "build",
    "parity",
    "worker",
  ]);
  requireDiagnostic(
    receipt.format === "mmp097-completed-pair-v1" &&
      Object.entries(pairIdentity(identity, pair)).every(
        ([k, v]) => receipt[k] === v,
      ) &&
      receipt.sourceSha === identity.sourceSha &&
      receipt.cleanup === "VERIFIED_ZERO_RESOURCES" &&
      receipt.failure === null &&
      receipt.targetFailure === null,
  );
  const scenario = MANIFEST.find((s) => s.id === pair.scenarioId);
  finishedGate(receipt.build, "G1", buildIds(scenario));
  requireDiagnostic(
    receipt.build.verdict === "PASS" &&
      Array.isArray(receipt.parity) &&
      receipt.parity.length === 2,
  );
  for (const [i, name] of ["G2", "G3"].entries()) {
    finishedGate(receipt.parity[i], name, expectedIds(scenario, name));
    requireDiagnostic(same(receipt.parity[i], pair.gates[i]));
  }
  const worker = receipt.worker;
  fields(worker, [
    "runId",
    "candidateSha",
    "imageId",
    "cleanupVerified",
    "operationError",
    "recipeSha",
    "hashes",
    "measured",
    "invocation",
    "phases",
  ]);
  requireDiagnostic(
    /^mmp007-[a-f0-9-]{36}$/.test(worker.runId) &&
      worker.candidateSha === identity.candidateSha &&
      /^sha256:[a-f0-9]{64}$/.test(worker.imageId) &&
      worker.cleanupVerified === true &&
      worker.operationError === null &&
      worker.recipeSha === DIAGNOSTIC_POLICY.recipeSha &&
      sha256(JSON.stringify(worker.hashes)) === DIAGNOSTIC_POLICY.recipeSha,
  );
  fields(worker.measured, [
    "node",
    "typescript",
    "sqlite",
    "faketime",
    "clockPolicy",
    "hashes",
  ]);
  requireDiagnostic(
    worker.measured.node === "v24.11.0" &&
      worker.measured.typescript === "5.9.3" &&
      worker.measured.sqlite === "3.50.4" &&
      worker.measured.faketime === "0.9.10-2.1" &&
      worker.measured.clockPolicy === "libfaketime-real-monotonic-v1" &&
      Object.entries(worker.hashes).every(
        ([k, v]) => k === "Dockerfile" || worker.measured.hashes?.[k] === v,
      ),
  );
  const invocation = worker.invocation;
  fields(invocation, [
    "args",
    "exitCode",
    "signal",
    "spawnError",
    "timedOut",
    "cancelled",
    "overflow",
  ]);
  requireDiagnostic(
    same(invocation.args, [
      "run",
      "--interactive",
      ...sandboxArgs(`${worker.runId}-build`),
      worker.imageId,
      "node",
      "/opt/worker/build.mjs",
    ]) &&
      invocation.exitCode === 0 &&
      invocation.signal === null &&
      invocation.spawnError === null &&
      invocation.timedOut === false &&
      invocation.cancelled === false &&
      invocation.overflow === false &&
      Array.isArray(worker.phases) &&
      worker.phases.length === 2,
  );
  for (const [i, phase] of worker.phases.entries()) {
    fields(phase, ["phase", "exitCode", "signal", "error"]);
    requireDiagnostic(
      phase.phase === ["typecheck", "build"][i] &&
        phase.exitCode === 0 &&
        phase.signal === null &&
        phase.error === null,
    );
  }
  return bundle;
}

export function collectPreservationPackage(trial, expected, verificationRoot) {
  if (trial.publicG1 === "FAIL")
    return collectDiagnosticPackage(trial, expected, verificationRoot);
  const identity = preservationIdentity(trial, expected);
  let bundle;
  for (const pair of trial.attempts[0].pairs) {
    let selected;
    for (const pack of pair.packs) {
      const records = readSourcePack(verificationRoot, pair, pack, identity);
      if (!records) continue;
      requireDiagnostic(!selected);
      selected = validateCompletedReceipt(
        identity,
        pair,
        records.source,
        records.receipt,
      );
    }
    requireDiagnostic(selected && (!bundle || same(bundle, selected)));
    bundle = selected;
  }
  for (const file of bundle.files) {
    rejectSecrets(file.path);
    rejectSecrets(file.content);
  }
  // Fresh allowlist. No worker, compiler, parity, reference, or Oracle data.
  const payload = {
    format: "mmp097-candidate-only-v1",
    identity,
    manifest: bundle.files.map((f) => ({
      path: f.path,
      bytes: Buffer.byteLength(f.content),
      sha256: f.sha256,
    })),
    files: bundle.files,
  };
  const plaintext = JSON.stringify(payload);
  requireDiagnostic(
    Buffer.byteLength(plaintext) <= DIAGNOSTIC_POLICY.plaintextBytes,
  );
  rejectSecrets(plaintext);
  return payload;
}
