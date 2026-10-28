// Offline verification of allowlisted public files only; no Docker or app execution.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const hash = (b) => createHash("sha256").update(b).digest("hex");
const digest = (v) => hash(JSON.stringify(v));
const casesSha =
  "5e3b588003de33d36f37cc2dadc848d0dfebc44fdd2c0a9aaed65e84f240f496";
const sha = (s) => assert.match(s, /^[a-f0-9]{64}$/);
const keys = (v, names) =>
  assert.deepEqual(Object.keys(v).sort(), names.sort());
function projected(value, kind) {
  if (kind === "http") {
    assert(
      Object.keys(value).every((k) =>
        [
          "status",
          "success",
          "bodySha256",
          "appointmentId",
          "appointmentCount",
        ].includes(k),
      ),
    );
    assert(
      Number.isInteger(value.status) &&
        value.status >= 100 &&
        value.status <= 599,
    );
    assert.equal(typeof value.success, "boolean");
    sha(value.bodySha256);
    if (value.appointmentId !== undefined)
      assert.match(value.appointmentId, /^\d{1,4}$/);
    if (value.appointmentCount !== undefined)
      assert(
        Number.isInteger(value.appointmentCount) &&
          value.appointmentCount >= 0 &&
          value.appointmentCount <= 8,
      );
  } else {
    keys(value, ["appointments", "appointmentSequence", "fullSnapshotSha256"]);
    assert(Array.isArray(value.appointments) && value.appointments.length <= 8);
    for (const row of value.appointments) {
      keys(row, ["id", "mechanicId", "date"]);
      assert.match(row.id, /^\d{1,4}$/);
      assert.match(row.mechanicId, /^\d{1,4}$/);
      assert(
        ["2099-08-18", "2099-08-19", "2099-02-29", "2020-05-17"].includes(
          row.date,
        ),
      );
    }
    if (value.appointmentSequence !== null)
      assert.match(value.appointmentSequence, /^\d{1,4}$/);
    sha(value.fullSnapshotSha256);
  }
}
export function verifyPublic(directory, expectedSha) {
  assert.match(expectedSha, /^[a-f0-9]{40}$/);
  const corpusBytes = readFileSync(
    new URL(
      "../../specs/014-public-validation-triage/cases.public.json",
      import.meta.url,
    ),
  );
  assert.equal(hash(corpusBytes), casesSha);
  const corpus = JSON.parse(corpusBytes);
  const files = {};
  const read = (name) => {
    const bytes = readFileSync(join(directory, name));
    files[name] = hash(bytes);
    return JSON.parse(bytes);
  };
  const summary = read("summary.json"),
    finalizer = read("finalizer.json"),
    evidence = read("public-repro.json");
  for (const file of [summary, finalizer, evidence])
    assert.equal(file.headSha, expectedSha);
  assert.equal(summary.casesSha256, casesSha);
  assert.equal(evidence.casesSha256, casesSha);
  const pinBytes = readFileSync(
    new URL(
      "../../specs/014-public-validation-triage/pins.json",
      import.meta.url,
    ),
  );
  assert.equal(
    hash(pinBytes),
    "7b69ec9b65e57f920b5960c781a360f5168c8bd093f9f8324adb853f9cc7a9d1",
  );
  const pins = JSON.parse(pinBytes);
  assert.equal(summary.candidateSha256, pins.candidateSha256);
  assert.equal(summary.manifestSha256, pins.manifestSha256);
  assert.equal(summary.runtime.recipeSha256, pins.targetRecipeSha256);
  assert.equal(summary.sourceCommit, pins.php.commit);
  assert.equal(summary.runtime.sourceSha256, pins.php.archiveSha256);
  assert.equal(summary.normalizationVersion, "oracle-exact-v1");
  assert.match(summary.runtime.phpImageId, /^sha256:[a-f0-9]{64}$/);
  assert.match(summary.runtime.targetImageId, /^sha256:[a-f0-9]{64}$/);
  assert.equal(summary.product, "NOT_ESTABLISHED");
  assert.equal(summary.gates.G0, "INCONCLUSIVE");
  assert.equal(summary.gates.G4, "INCONCLUSIVE");
  assert.equal(summary.harness, "SUCCESS");
  assert.equal(summary.publicEvidence.status, "ALLOWLIST_VERIFIED");
  assert.deepEqual(summary.controls, { positive: "PASS", negative: "PASS" });
  assert.deepEqual(summary.coverage, {
    plannedPairs: 14,
    plannedHttp: 38,
    plannedSqlite: 52,
    completedPairs: 14,
    http: 38,
    sqlite: 52,
  });
  for (const cleanup of [summary.cleanup, finalizer]) {
    assert.equal(cleanup.status, "PASS");
    assert.equal(cleanup.emergencyRemoved, 0);
    assert.deepEqual(cleanup.inventory, { containers: 0, volumes: 0 });
  }
  assert.equal(summary.cases.length, 14);
  assert.equal(evidence.records.length, 76);
  const seen = new Set();
  for (const record of evidence.records) {
    keys(record, [
      "scenarioId",
      "stepId",
      "kind",
      "requestSha256",
      "reference",
      "candidate",
      "rawReferenceSha256",
      "rawCandidateSha256",
    ]);
    const scenario = corpus.cases.find((s) => s.id === record.scenarioId);
    assert(scenario);
    assert(["http", "db"].includes(record.kind));
    const index = Number(/^step-([1-8])$/.exec(record.stepId)?.[1]) - 1;
    assert(scenario.requests[index]);
    assert.equal(record.requestSha256, digest(scenario.requests[index]));
    const id = `${record.scenarioId}:${record.stepId}:${record.kind}`;
    assert(!seen.has(id));
    seen.add(id);
    sha(record.rawReferenceSha256);
    sha(record.rawCandidateSha256);
    projected(record.reference, record.kind);
    projected(record.candidate, record.kind);
  }
  for (const [index, scenario] of corpus.cases.entries()) {
    const r = summary.cases[index];
    assert.equal(r.scenarioId, scenario.id);
    assert(["PASS", "FAIL"].includes(r.status));
    assert.equal(r.bootstrap, "PASS");
    assert.equal(r.g1, "PASS");
    assert.equal(r.initial.status, "PASS");
    assert.equal(r.executedHttp, scenario.requests.length);
    assert.equal(r.executedSqlite, scenario.requests.length + 1);
    assert.equal(r.normalCleanup, "PASS");
    assert.equal(r.emergencyRemoved, 0);
    assert.deepEqual(r.inventory, { containers: 0, volumes: 0 });
    assert.equal(r.referenceRuntime.php, "7.4.33");
    assert.equal(r.referenceRuntime.sqlite, "3.34.1");
    assert.equal(r.referenceRuntime.fixedUtc, "2026-10-27 12:00:00");
    assert(
      r.referenceRuntime.monotonicMs >= 40 &&
        r.referenceRuntime.monotonicMs < 2000,
    );
    assert.equal(r.targetClock.fixedUtc, "2026-10-27T12:00:00.000Z");
    assert(
      r.targetClock.monotonicDeltaMs >= 1000 &&
        r.targetClock.monotonicDeltaMs < 8000,
    );
    const semantics = r.targetClock.semantics;
    assert.equal(semantics.reference.php, "7.4.33");
    assert.match(
      semantics.reference.pcre,
      /^\d{1,2}\.\d{1,2}(?:\.\d{1,2})? \d{4}-\d{2}-\d{2}$/,
    );
    assert.equal(semantics.candidateLanguage.node, "v24.11.0");
    for (const s of [semantics.reference, semantics.candidateLanguage]) {
      assert.equal(s.phoneHex, "2b31353535c2a0343430303031");
      assert.equal(s.engineHex, "454e47c2a030343441");
      assert(
        Number.isSafeInteger(s.integer) && s.integer >= 0 && s.integer <= 100,
      );
      assert.equal(typeof s.phoneMatch, "boolean");
      assert.equal(typeof s.engineMatch, "boolean");
    }
    for (const [i, step] of r.steps.entries()) {
      assert.equal(step.stepId, `step-${i + 1}`);
      for (const kind of ["http", "db"]) {
        assert(seen.has(`${r.scenarioId}:${step.stepId}:${kind}`));
        assert(["PASS", "FAIL"].includes(step[kind].status));
      }
    }
  }
  return {
    headSha: expectedSha,
    files,
    publicRecords: seen.size,
    pairs: 14,
    http: 38,
    sqlite: 52,
    scenarioPass: summary.cases.filter((r) => r.status === "PASS").length,
    scenarioFail: summary.cases.filter((r) => r.status === "FAIL").length,
    controls: "PASS",
    cleanup: "PASS",
    classification: "NOT_AUTOMATICALLY_INFERRED",
  };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    console.log(
      JSON.stringify(verifyPublic(process.argv[2], process.argv[3]), null, 2),
    );
  } catch {
    console.error("PUBLIC_EVIDENCE_INVALID");
    process.exitCode = 1;
  }
}
