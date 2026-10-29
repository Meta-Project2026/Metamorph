import assert from "node:assert/strict";
import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  syntheticFixture,
  writeSyntheticPacks,
} from "../../../research/mmp-089/synthetic-fixture.mjs";
import { sha256, validateBundle } from "../../target-worker/src/admission.mjs";
import {
  buildDiagnosticPackage,
  collectDiagnosticPackage,
  DIAGNOSTIC_POLICY,
  diagnosticIdentity,
  preservationRecord,
  rejectSecrets,
} from "../src/private-diagnostics.mjs";

test("select only indexed source and compiler receipts from the public-bound bridge", () => {
  const root = mkdtempSync(join(tmpdir(), "mmp089-unit-"));
  try {
    const f = writeSyntheticPacks(root, syntheticFixture());
    const pack = collectDiagnosticPackage(f.trial, f.expected, root);
    assert.deepEqual(pack.files, f.source.files);
    assert.equal(
      validateBundle(pack.files).candidateSha,
      f.identity.candidateSha,
    );
    assert.equal(sha256(JSON.stringify(pack.compiler)), pack.compilerSha256);
    assert.deepEqual(pack.manifest, [
      {
        path: "src/main.ts",
        bytes: Buffer.byteLength(f.source.files[0].content),
        sha256: f.source.files[0].sha256,
      },
    ]);
    assert.doesNotMatch(
      JSON.stringify(pack),
      /REFERENCE_MUST_NEVER_EXPORT|workerEvidence|budgetAuth|provider|targetFailure/,
    );
    const record = preservationRecord(
      "ENCRYPTED_PENDING_UPLOAD",
      pack.identity,
      { sha256: "f".repeat(64), bytes: 200 },
      "VERIFIED_ZERO_RESOURCES",
    );
    assert.doesNotMatch(
      JSON.stringify(record),
      /MMP089_PRIVATE|src\/|stdout|stderr|scenarioId|\.ts|stack/,
    );
    assert.equal(record.status, "ENCRYPTED_PENDING_UPLOAD");
    assert.equal(record.upload, "NOT_RUN");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("wrong exact-run/head/source/candidate/attempt/pair and cleanup bindings fail closed", () => {
  for (const mutate of [
    (f) => {
      f.expected.runId = "890002";
    },
    (f) => {
      f.expected.runAttempt = "bad";
    },
    (f) => {
      f.expected.headSha = "b".repeat(40);
    },
    (f) => {
      f.trial.sourceSha = "b".repeat(40);
    },
    (f) => {
      f.trial.candidateSha = "f".repeat(64);
    },
    (f) => {
      f.trial.attempts[0].attemptId = "f".repeat(36);
    },
    (f) => {
      f.trial.attempts[0].pairs[0].pairId = "f".repeat(36);
    },
    (f) => {
      f.trial.cleanup.emergencyRemoved = 1;
    },
    (f) => {
      f.trial.publicG1 = "ERROR";
    },
  ]) {
    const f = syntheticFixture();
    mutate(f);
    assert.throws(() => diagnosticIdentity(f.trial, f.expected));
  }
});

test("missing source and wrong index/source hashes refuse preservation", () => {
  for (const mutation of ["missing", "index-hash", "source-hash"]) {
    const root = mkdtempSync(join(tmpdir(), "mmp089-unit-"));
    try {
      const f = writeSyntheticPacks(root, syntheticFixture());
      const pack = f.trial.attempts[0].pairs[0].packs[1];
      const source = join(
        root,
        f.identity.attemptId,
        f.identity.pairId,
        pack.id,
        "pair-1-source.json",
      );
      if (mutation === "missing") unlinkSync(source);
      else if (mutation === "index-hash") pack.sha256 = "e".repeat(64);
      else
        writeFileSync(
          source,
          JSON.stringify({ ...f.source, candidateSha: "e".repeat(64) }),
          { mode: 0o600 },
        );
      assert.throws(() => collectDiagnosticPackage(f.trial, f.expected, root));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test("reject malformed, oversized, secret-bearing and untrusted recipe receipts", () => {
  for (const mutate of [
    (f) => {
      f.source.files[0].sha256 = "e".repeat(64);
    },
    (f) => {
      f.source.response = "excluded";
    },
    (f) => {
      f.completion.workerEvidence.provenance.recipeSha = "e".repeat(64);
    },
    (f) => {
      f.completion.workerEvidence.build.args[7] = "host";
    },
    (f) => {
      f.completion.workerEvidence.build.timedOut = true;
    },
    (f) => {
      f.completion.workerEvidence.build.stdout =
        '{"checks":[],"checks":[],"artifacts":[]}';
    },
    (f) => {
      f.completion.workerEvidence.build.stdout = JSON.stringify({
        checks: [
          {
            phase: "typecheck",
            exitCode: 2,
            signal: null,
            error: null,
            stdout: "x".repeat(DIAGNOSTIC_POLICY.phaseBytes + 1),
            stderr: "",
          },
        ],
        artifacts: [],
      });
    },
    (f) => {
      f.completion.workerEvidence.build.stdout =
        f.completion.workerEvidence.build.stdout.replace(
          "MMP089_PRIVATE_DIAGNOSTIC",
          "ghp_CANARY_SHOULD_REJECT",
        );
    },
    (f) => {
      f.completion.workerEvidence.build.stdout =
        f.completion.workerEvidence.build.stdout.replace(
          '"error":null',
          '"error":"EIO"',
        );
    },
    (f) => {
      f.completion.cleanup = "CLEANUP_ERROR";
    },
  ]) {
    const f = syntheticFixture();
    mutate(f);
    assert.throws(() =>
      buildDiagnosticPackage(f.identity, f.source, f.completion),
    );
  }
});

test("public preservation schema rejects arbitrary text and cannot claim preservation early", () => {
  const f = syntheticFixture();
  assert.throws(() => preservationRecord("PRESERVED", f.identity));
  assert.throws(() =>
    preservationRecord(
      "PRESERVED",
      { ...f.identity, attemptId: "MMP089_PRIVATE" },
      { sha256: "f".repeat(64), bytes: 200 },
      "VERIFIED_ZERO_RESOURCES",
    ),
  );
  assert.throws(() => preservationRecord("MMP089_PRIVATE"));
  for (const marker of [
    "AGE-SECRET-KEY-TEST",
    "-----BEGIN OPENSSH PRIVATE KEY-----",
    "Bearer abc",
    "ACTIONS_RUNTIME_TOKEN",
    "eyJabcdefghijk.abcdef.abc",
  ])
    assert.throws(() => rejectSecrets(marker));
  assert.equal(preservationRecord("REJECTED").status, "REJECTED");
});
