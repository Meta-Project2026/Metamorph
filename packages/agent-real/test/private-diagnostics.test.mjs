import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
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

test("decoded source and compiler strings reject credential markers before JSON escaping", () => {
  for (const whitespace of ["\t", "\n", "\r\n"]) {
    for (const location of ["source", "stdout", "stderr"]) {
      const f = syntheticFixture();
      const marker = `Bearer${whitespace}MMP089_SYNTHETIC_SECRET`;
      if (location === "source") {
        const content = `// ${marker}\nexport const value: number = 'synthetic';\n`;
        f.source = validateBundle([
          { path: "src/main.ts", content, sha256: sha256(content) },
        ]);
        f.identity.candidateSha = f.source.candidateSha;
        f.completion.workerEvidence.candidateSha = f.source.candidateSha;
      } else {
        const output = JSON.parse(f.completion.workerEvidence.build.stdout);
        output.checks[0][location] = marker;
        f.completion.workerEvidence.build.stdout = JSON.stringify(output);
      }
      assert.throws(() =>
        buildDiagnosticPackage(f.identity, f.source, f.completion),
      );
    }
  }
});

function pipelineFixture() {
  const directory = mkdtempSync(join(tmpdir(), "mmp089-pipeline-unit-"));
  const f = writeSyntheticPacks(
    join(directory, "meta-paid-verification"),
    syntheticFixture(),
  );
  mkdirSync(join(directory, "meta-paid-public"), { mode: 0o700 });
  mkdirSync(join(directory, "mmp089-private-diagnostics"), { mode: 0o700 });
  // Inert synthetic test bytes simulate the completed encryption boundary. No
  // cryptographic/deployment claim comes from these private CLI state tests.
  const ciphertext = Buffer.alloc(200, 1);
  const receipt = preservationRecord(
    "ENCRYPTED_PENDING_UPLOAD",
    f.identity,
    { sha256: sha256(ciphertext), bytes: ciphertext.length },
    "VERIFIED_ZERO_RESOURCES",
  );
  const paths = {
    record: join(directory, "meta-paid-public/preservation.json"),
    trial: join(directory, "meta-paid-public/trial.json"),
    finalizer: join(directory, "meta-paid-public/finalizer.json"),
    ciphertext: join(
      directory,
      "mmp089-private-diagnostics/candidate-diagnostics.age",
    ),
    output: join(directory, "step-output.txt"),
  };
  for (const [path, value] of [
    [paths.record, receipt],
    [paths.trial, f.trial],
    [
      paths.finalizer,
      {
        headSha: f.expected.headSha,
        status: "PASS",
        inventory: { containers: 0, volumes: 0 },
        emergencyRemoved: 0,
      },
    ],
  ])
    writeFileSync(path, JSON.stringify(value), { mode: 0o600 });
  writeFileSync(paths.ciphertext, ciphertext, { mode: 0o600 });
  const env = {
    RUNNER_TEMP: directory,
    GITHUB_RUN_ID: f.expected.runId,
    GITHUB_RUN_ATTEMPT: f.expected.runAttempt,
    GITHUB_SHA: f.expected.headSha,
    GITHUB_OUTPUT: paths.output,
    MMP089_PRESERVE_OUTCOME: "success",
    MMP089_FINALIZER_OUTCOME: "success",
  };
  return { ...f, directory, paths, env };
}
const entrypoint = (name) =>
  fileURLToPath(
    new URL(`../../../research/mmp-089/${name}.mjs`, import.meta.url),
  );

test("upload gate requires bound identities, ciphertext integrity and both cleanup proofs", () => {
  for (const mutate of [
    null,
    (f) => {
      unlinkSync(f.paths.finalizer);
    },
    (f) => {
      writeFileSync(
        f.paths.finalizer,
        JSON.stringify({
          headSha: f.expected.headSha,
          status: "ERROR",
          emergencyRemoved: 1,
          inventory: { containers: 0, volumes: 0 },
        }),
      );
    },
    (f) => {
      writeFileSync(f.paths.finalizer, "x".repeat(8193));
    },
    (f) => {
      writeFileSync(f.paths.ciphertext, Buffer.alloc(200, 2));
    },
    (f) => {
      unlinkSync(f.paths.ciphertext);
    },
    (f) => {
      const r = JSON.parse(readFileSync(f.paths.record));
      delete r.ageSha256;
      writeFileSync(f.paths.record, JSON.stringify(r));
    },
    (f) => {
      const r = JSON.parse(readFileSync(f.paths.record));
      r.collectorCleanup = "ERROR";
      writeFileSync(f.paths.record, JSON.stringify(r));
    },
    (f) => {
      f.trial.cleanup.emergencyRemoved = 1;
      writeFileSync(f.paths.trial, JSON.stringify(f.trial));
    },
    (f) => {
      f.trial.attempts[0].pairs[0].pairId = "f".repeat(36);
      writeFileSync(f.paths.trial, JSON.stringify(f.trial));
    },
    (f) => {
      f.env.GITHUB_RUN_ID = "890002";
    },
    (f) => {
      f.env.MMP089_PRESERVE_OUTCOME = "failure";
    },
    (f) => {
      f.env.MMP089_FINALIZER_OUTCOME = "failure";
    },
    (f) => {
      delete f.env.MMP089_PRESERVE_OUTCOME;
    },
  ]) {
    const f = pipelineFixture();
    try {
      mutate?.(f);
      const result = spawnSync(
        process.execPath,
        [entrypoint("prepare-upload")],
        { env: f.env, encoding: "utf8", timeout: 10000 },
      );
      assert.equal(result.status, 0);
      assert.equal(
        readFileSync(f.paths.output, "utf8"),
        `eligible=${!mutate}\n`,
      );
      assert.doesNotMatch(
        result.stdout + result.stderr,
        /MMP089_PRIVATE|stderr|source\.ts|Bearer|stack/,
      );
      assert.equal(
        JSON.parse(readFileSync(f.paths.record)).status,
        "ENCRYPTED_PENDING_UPLOAD",
      );
    } finally {
      rmSync(f.directory, { recursive: true, force: true });
    }
  }
});

test("paid workflow preserves failure-aware G1 ordering and rejects failed producers", () => {
  const workflow = readFileSync(
    new URL(
      "../../../.github/workflows/meta-paid-migration.yml",
      import.meta.url,
    ),
    "utf8",
  );
  const preservation = workflow.slice(
    workflow.indexOf("      - name: Preserve one attributable"),
    workflow.indexOf("      - name: Final owned-resource"),
  );
  assert.match(preservation, /id: preservation/);
  assert.match(
    preservation,
    /if:.*!cancelled\(\).*steps\.generation\.outcome == 'success'/,
  );
  assert.doesNotMatch(preservation, /steps\.validation\.outcome == 'success'/);
  const finalizer = workflow.slice(
    workflow.indexOf("      - name: Final owned-resource"),
    workflow.indexOf("      - name: Require encryption"),
  );
  assert.match(finalizer, /id: finalizer/);
  assert.match(finalizer, /if: always\(\)/);
  const gate = workflow.slice(
    workflow.indexOf("      - name: Require encryption"),
    workflow.indexOf("      - name: Upload only approved"),
  );
  assert.match(gate, /steps\.preservation\.outcome == 'success'/);
  assert.match(gate, /steps\.finalizer\.outcome == 'success'/);
  const upload = workflow.slice(
    workflow.indexOf("      - name: Upload only approved"),
    workflow.indexOf("      - name: Record preservation"),
  );
  assert.match(upload, /steps\.diagnostic-gate\.outcome == 'success'/);
  assert.match(upload, /steps\.diagnostic-gate\.outputs\.eligible == 'true'/);
  assert.match(
    upload,
    /path: \$\{\{ runner\.temp \}\}\/mmp089-private-diagnostics\/candidate-diagnostics\.age\r?\n/,
  );
  assert.match(upload, /retention-days: 7/);
});

test("private simulated upload outcomes publish PRESERVED only after explicit success", () => {
  for (const outcome of [
    "success",
    "failure",
    "skipped",
    "",
    "MMP089_PRIVATE_TEXT",
  ]) {
    const f = pipelineFixture();
    try {
      const result = spawnSync(
        process.execPath,
        [entrypoint("record-upload")],
        {
          env: { ...f.env, MMP089_UPLOAD_OUTCOME: outcome },
          encoding: "utf8",
          timeout: 10000,
        },
      );
      const valid = ["success", "failure"].includes(outcome);
      assert.equal(result.status, valid ? 0 : 1);
      const record = JSON.parse(readFileSync(f.paths.record));
      assert.equal(
        record.status,
        outcome === "success"
          ? "PRESERVED"
          : outcome === "failure"
            ? "UPLOAD_FAILED"
            : "ENCRYPTED_PENDING_UPLOAD",
      );
      assert.doesNotMatch(
        JSON.stringify(record) + result.stdout + result.stderr,
        /MMP089_PRIVATE|stdout|stderr|Bearer|stack/,
      );
    } finally {
      rmSync(f.directory, { recursive: true, force: true });
    }
  }
});
