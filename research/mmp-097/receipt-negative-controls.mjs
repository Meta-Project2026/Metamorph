// Actual validated private files + production CLI controls. No raw data exported.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  lstatSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";
import {
  DIAGNOSTIC_POLICY,
  readPrivateBytes,
  readPrivateJson,
} from "../../packages/agent-real/src/private-diagnostics.mjs";
import { sha256 } from "../../packages/target-worker/src/admission.mjs";
import { observedExit } from "./qualification-outcome.mjs";

export function receiptNegativeControls({ root, runner, expected, env }) {
  const output = join(runner, "meta-paid-public");
  const paths = {
    trial: join(output, "trial.json"),
    record: join(output, "preservation.json"),
    finalizer: join(output, "finalizer.json"),
    cipher: join(
      runner,
      "mmp089-private-diagnostics/candidate-diagnostics.age",
    ),
  };
  const original = Object.fromEntries(
    Object.entries(paths).map(([key, path]) => [
      key,
      readPrivateBytes(
        path,
        key === "cipher" ? DIAGNOSTIC_POLICY.ciphertextBytes : 4 * 1024 * 1024,
        key !== "finalizer",
      ),
    ]),
  );
  const realTrial = JSON.parse(original.trial);
  const firstPair = realTrial.attempts[0].pairs[0];
  const attemptId = realTrial.attempts[0].attemptId;
  let selected;
  for (const pack of firstPair.packs) {
    const directory = join(
      runner,
      "meta-paid-verification",
      attemptId,
      firstPair.pairId,
      pack.id,
    );
    const index = readPrivateJson(join(directory, "index.json")).value;
    const source = index.entries.find((e) => /^pair-[0-9]+-source$/.test(e.id));
    if (source)
      selected = {
        directory,
        source,
        index,
        packId: pack.id,
        retention: index.entries.find((e) =>
          /^pair-[0-9]+-retention$/.test(e.id),
        ),
      };
  }
  assert.ok(selected?.retention);
  const baseEnv = {
    ...env,
    RUNNER_TEMP: runner,
    GITHUB_SHA: expected.headSha,
    GITHUB_RUN_ID: expected.runId,
    GITHUB_RUN_ATTEMPT: expected.runAttempt,
  };
  const cli = (name, extra = {}) =>
    spawnSync(process.execPath, [join(root, `research/mmp-089/${name}.mjs`)], {
      cwd: root,
      env: { ...baseEnv, ...extra },
      timeout: 90000,
      maxBuffer: 1024 * 1024,
    });
  const records = [];
  const cases = [
    [
      "wrong-head",
      (c) => {
        c.trial.headSha = "f".repeat(40);
      },
    ],
    [
      "wrong-source",
      (c) => {
        c.trial.sourceSha = "f".repeat(40);
      },
    ],
    [
      "wrong-candidate",
      (c) => {
        c.trial.candidateSha = "f".repeat(64);
      },
    ],
    [
      "wrong-attempt",
      (c) => {
        c.trial.attempts[0].attemptId = "f".repeat(36);
      },
    ],
    [
      "wrong-pair",
      (c) => {
        c.trial.attempts[0].pairs[0].pairId = "f".repeat(36);
      },
    ],
    [
      "partial-http-fail-coverage",
      (c) => {
        c.trial.attempts[0].pairs[0].gates[0].executedTestIds.pop();
      },
    ],
    [
      "false-aggregate-pass",
      (c) => {
        c.trial.publicG2 = "PASS";
      },
    ],
    [
      "normal-cleanup-error",
      (c) => {
        c.trial.cleanup.emergencyRemoved = 1;
      },
    ],
    [
      "g1-error-policy",
      (c) => {
        c.trial.publicG1 = "ERROR";
      },
      { status: "NOT_APPLICABLE" },
    ],
    [
      "incomplete-policy",
      (c) => {
        c.trial.publicG1 = "NOT_RUN";
      },
      { status: "NOT_APPLICABLE" },
    ],
    [
      "unfinished-parity-policy",
      (c) => {
        c.trial.publicG2 = "INCONCLUSIVE";
      },
      { status: "NOT_APPLICABLE" },
    ],
    [
      "missing-trusted-index",
      (c) => {
        c.remove(join(selected.directory, "index.json"));
      },
    ],
    [
      "malformed-index",
      (c) => {
        c.write(
          join(selected.directory, "index.json"),
          '{"entries":[],"entries":[]}',
        );
      },
    ],
    [
      "altered-index-sha",
      (c) => {
        c.trial.attempts[0].pairs[0].packs[0].sha256 = "f".repeat(64);
      },
    ],
    [
      "changed-source-file",
      (c) => {
        c.write(join(selected.directory, `${selected.source.id}.json`), "{}");
      },
    ],
    [
      "missing-trusted-sidecar",
      (c) => {
        c.remove(join(selected.directory, `${selected.retention.id}.json`));
      },
    ],
    [
      "source-symlink",
      (c) => {
        const source = join(selected.directory, `${selected.source.id}.json`);
        const target = join(runner, "mmp099-link-target.json");
        c.write(target, readFileSync(source));
        c.remove(source);
        symlinkSync(target, source);
      },
    ],
    [
      "source-unsafe-path",
      (c) => {
        c.source((s) => {
          s.files[0].path = "src/oracle/main.ts";
        });
      },
    ],
    [
      "source-over-cap",
      (c) => {
        c.source((s) => {
          s.files[0].content = "x".repeat(256 * 1024 + 1);
          s.files[0].sha256 = sha256(s.files[0].content);
        });
      },
    ],
    [
      "source-unexpected-field",
      (c) => {
        c.source((s) => {
          s.responseBody = "MMP099_SYNTHETIC_EXCLUDED";
        });
      },
    ],
    [
      "finalizer-failed-outcome",
      () => {},
      { producer: false, finalizerOutcome: "failure" },
    ],
    [
      "finalizer-error-receipt",
      (c) => {
        c.finalizer.status = "ERROR";
      },
      { producer: false },
    ],
    [
      "finalizer-nonzero-inventory",
      (c) => {
        c.finalizer.inventory.containers = 1;
      },
      { producer: false },
    ],
    [
      "ciphertext-tamper",
      (c) => {
        const bytes = Buffer.from(original.cipher);
        bytes[bytes.length - 1] ^= 1;
        c.write(paths.cipher, bytes);
      },
      { producer: false },
    ],
    [
      "ciphertext-over-cap",
      (c) => {
        c.write(
          paths.cipher,
          Buffer.alloc(DIAGNOSTIC_POLICY.ciphertextBytes + 1),
        );
      },
      { producer: false },
    ],
  ];
  let failed = false;
  for (const [id, mutate, options = {}] of cases) {
    const changes = new Map();
    const backup = (path) => {
      assert.ok(!relative(runner, path).startsWith(".."));
      if (!changes.has(path))
        changes.set(
          path,
          existsSync(path)
            ? { bytes: readFileSync(path), mode: lstatSync(path).mode & 0o777 }
            : null,
        );
    };
    const write = (path, bytes) => {
      backup(path);
      if (existsSync(path)) chmodSync(path, 0o600);
      writeFileSync(path, bytes, { mode: 0o600 });
    };
    const remove = (path) => {
      backup(path);
      unlinkSync(path);
    };
    const context = {
      trial: structuredClone(realTrial),
      finalizer: JSON.parse(original.finalizer),
      write,
      remove,
      source(change) {
        const sourcePath = join(
          selected.directory,
          `${selected.source.id}.json`,
        );
        const source = readPrivateJson(sourcePath).value;
        change(source);
        const bytes = JSON.stringify(source);
        write(sourcePath, bytes);
        const index = structuredClone(selected.index);
        const entry = index.entries.find((e) => e.id === selected.source.id);
        entry.bytes = Buffer.byteLength(bytes);
        entry.sha256 = sha256(bytes);
        const indexBytes = JSON.stringify(index);
        write(join(selected.directory, "index.json"), indexBytes);
        context.trial.attempts[0].pairs[0].packs.find(
          (p) => p.id === selected.packId,
        ).sha256 = sha256(indexBytes);
      },
    };
    const row = {
      id,
      kind: "ACTUAL_VALIDATED_FILES_AND_PRODUCTION_CLI",
      status: "ERROR",
      expectedEligible: false,
    };
    records.push(row);
    const cipherDirectory = join(runner, "mmp089-private-diagnostics");
    const savedCipherDirectory = join(runner, "mmp099-saved-ciphertext");
    let moved = false;
    try {
      mutate(context);
      writeFileSync(paths.trial, JSON.stringify(context.trial), {
        mode: 0o600,
      });
      writeFileSync(paths.finalizer, JSON.stringify(context.finalizer), {
        mode: 0o600,
      });
      let producer = "success";
      if (options.producer !== false) {
        renameSync(cipherDirectory, savedCipherDirectory);
        moved = true;
        const preservation = cli("preserve");
        row.preserverExit = observedExit(preservation);
        const record = readPrivateJson(paths.record).value;
        row.preservationStatus = record.status;
        assert.equal(record.status, options.status ?? "REJECTED");
        assert.equal(
          preservation.status,
          options.status === "NOT_APPLICABLE" ? 0 : 1,
        );
        assert.ok(!existsSync(paths.cipher));
        rmSync(cipherDirectory, { recursive: true, force: true });
        renameSync(savedCipherDirectory, cipherDirectory);
        moved = false;
        producer = preservation.status === 0 ? "success" : "failure";
      }
      // Test the gate against the original real ciphertext, not inert fixtures.
      writeFileSync(paths.record, original.record, { mode: 0o600 });
      const stepOutput = join(runner, `mmp099-gate-${id}.txt`);
      const gate = cli("prepare-upload", {
        GITHUB_OUTPUT: stepOutput,
        MMP089_PRESERVE_OUTCOME: producer,
        MMP089_FINALIZER_OUTCOME: options.finalizerOutcome ?? "success",
      });
      row.gateExit = observedExit(gate);
      row.eligible = readFileSync(stepOutput, "utf8") === "eligible=true\n";
      assert.equal(gate.status, 0);
      assert.equal(row.eligible, false);
      assert.notEqual(readPrivateJson(paths.record).value.status, "PRESERVED");
      row.status = "PASS";
    } catch {
      row.status = "FAIL";
      failed = true;
    } finally {
      if (moved) {
        if (existsSync(cipherDirectory))
          rmSync(cipherDirectory, { recursive: true, force: true });
        renameSync(savedCipherDirectory, cipherDirectory);
      }
      for (const [path, before] of [...changes].reverse()) {
        if (
          existsSync(path) ||
          (() => {
            try {
              return lstatSync(path).isSymbolicLink();
            } catch {
              return false;
            }
          })()
        ) {
          if (!lstatSync(path).isSymbolicLink()) chmodSync(path, 0o600);
          unlinkSync(path);
        }
        if (before) {
          writeFileSync(path, before.bytes, { mode: 0o600 });
          chmodSync(path, before.mode);
          before.bytes.fill(0);
        }
      }
      for (const [key, bytes] of Object.entries(original)) {
        if (existsSync(paths[key])) chmodSync(paths[key], 0o600);
        writeFileSync(paths[key], bytes, { mode: 0o600 });
      }
    }
    if (failed) break;
  }
  if (!failed) {
    for (const outcome of ["failure", "skipped"]) {
      const row = {
        id: `record-upload-${outcome}`,
        kind: "ACTUAL_VALIDATED_FILES_AND_PRODUCTION_CLI",
        status: "ERROR",
      };
      records.push(row);
      try {
        const recorded = cli("record-upload", {
          MMP089_UPLOAD_OUTCOME: outcome,
        });
        row.exitCode = observedExit(recorded);
        row.preservationStatus = readPrivateJson(paths.record).value.status;
        assert.equal(row.exitCode, outcome === "failure" ? 0 : 1);
        assert.equal(
          row.preservationStatus,
          outcome === "failure" ? "UPLOAD_FAILED" : "ENCRYPTED_PENDING_UPLOAD",
        );
        assert.equal(sha256(readFileSync(paths.trial)), sha256(original.trial));
        row.status = "PASS";
      } catch {
        row.status = "FAIL";
        failed = true;
      } finally {
        writeFileSync(paths.record, original.record, { mode: 0o600 });
      }
    }
  }
  for (const bytes of Object.values(original)) bytes.fill(0);
  return {
    status: failed ? "FAIL" : "PASS",
    cases: records,
    limitation:
      "RECEIPT_POLICY_AND_FILESYSTEM_CONTROLS_NOT_NEW_G1_ENVIRONMENT_EXECUTIONS",
  };
}
