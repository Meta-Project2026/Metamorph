import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  completedFixture,
  writeCompletedPacks,
} from "../../../research/mmp-097/synthetic-fixture.mjs";
import { sha256, validateBundle } from "../../target-worker/src/admission.mjs";
import {
  collectPreservationPackage,
  preservationIdentity,
} from "../src/candidate-retention.mjs";
import { preservationRecord } from "../src/private-diagnostics.mjs";

function fixture(body, g2 = "PASS", g3 = "PASS") {
  const root = mkdtempSync(join(tmpdir(), "mmp097-unit-"));
  try {
    return body(root, completedFixture(g2, g3));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

for (const [g2, g3] of [
  ["FAIL", "PASS"],
  ["PASS", "FAIL"],
  ["FAIL", "FAIL"],
  ["PASS", "PASS"],
]) {
  test(`candidate-only selection: completed G2 ${g2} / G3 ${g3}, all pairs`, () =>
    fixture(
      (root, f) => {
        writeCompletedPacks(root, f);
        const payload = collectPreservationPackage(f.trial, f.expected, root);
        assert.equal(payload.format, "mmp097-candidate-only-v1");
        assert.equal(payload.identity.case, "G1_PASS_COMPLETED");
        assert.deepEqual(payload.files, f.source.files);
        assert.equal(
          validateBundle(payload.files).candidateSha,
          payload.identity.candidateSha,
        );
        assert.deepEqual(Object.keys(payload).sort(), [
          "files",
          "format",
          "identity",
          "manifest",
        ]);
        for (const file of payload.files)
          assert.deepEqual(
            payload.manifest.find((e) => e.path === file.path),
            {
              path: file.path,
              bytes: Buffer.byteLength(file.content),
              sha256: sha256(file.content),
            },
          );
        assert.doesNotMatch(
          JSON.stringify(payload),
          /COMPILER_MUST_NOT_EXPORT|RUNTIME_HTTP_DB_MUST_NOT_EXPORT|REFERENCE_MUST_NOT_EXPORT|stdout|stderr|worker|compiler|parity|gates|budgetAuth/,
        );
        const record = preservationRecord(
          "ENCRYPTED_PENDING_UPLOAD",
          payload.identity,
          { sha256: "f".repeat(64), bytes: 200 },
          "VERIFIED_ZERO_RESOURCES",
        );
        assert.equal(record.format, "mmp097-preservation-v1");
        assert.equal(
          record.identity.bindingsSha256,
          preservationIdentity(f.trial, f.expected).bindingsSha256,
        );
        assert.doesNotMatch(
          JSON.stringify(record),
          /PRIVATE_SOURCE|src\/|\.ts|compiler|stdout|stderr/,
        );
      },
      g2,
      g3,
    ));
}

for (const [name, mutate] of [
  [
    "wrong run",
    (f) => {
      f.expected.runId = "970002";
    },
  ],
  [
    "rerun",
    (f) => {
      f.expected.runAttempt = "2";
    },
  ],
  [
    "wrong head",
    (f) => {
      f.trial.headSha = "f".repeat(40);
    },
  ],
  [
    "wrong source",
    (f) => {
      f.trial.sourceSha = "f".repeat(40);
    },
  ],
  [
    "wrong candidate",
    (f) => {
      f.trial.candidateSha = "f".repeat(64);
    },
  ],
  [
    "not generated",
    (f) => {
      f.trial.modelGeneration = "NOT_RUN";
    },
  ],
  [
    "G1 ERROR",
    (f) => {
      f.trial.publicG1 = "ERROR";
    },
  ],
  [
    "parity INCONCLUSIVE",
    (f) => {
      f.trial.publicG2 = "INCONCLUSIVE";
    },
  ],
  [
    "parity ERROR",
    (f) => {
      f.trial.publicG3 = "ERROR";
    },
  ],
  [
    "missing pair",
    (f) => {
      f.trial.attempts[0].pairs.pop();
    },
  ],
  [
    "duplicate pair",
    (f) => {
      f.trial.attempts[0].pairs[1].pairId = f.trial.attempts[0].pairs[0].pairId;
    },
  ],
  [
    "wrong attempt",
    (f) => {
      f.trial.attempts[0].attemptId = "f".repeat(36);
    },
  ],
  [
    "duplicate pack",
    (f) => {
      f.trial.attempts[0].pairs[1].packs = f.trial.attempts[0].pairs[0].packs;
    },
  ],
  [
    "wrong pair G1",
    (f) => {
      f.trial.attempts[0].pairs[1].compilerDiagnostics.g1Verdict = "ERROR";
    },
  ],
  [
    "partial FAIL coverage",
    (f) => {
      f.trial.attempts[0].pairs[0].gates[0].executedTestIds.pop();
    },
  ],
  [
    "false aggregate PASS",
    (f) => {
      f.trial.publicG2 = "PASS";
    },
  ],
  [
    "false coverage count",
    (f) => {
      f.trial.attempts[0].coverage.http = 16;
    },
  ],
  [
    "emergency removal",
    (f) => {
      f.trial.cleanup.emergencyRemoved = 1;
    },
  ],
  [
    "pair cleanup error",
    (f) => {
      f.trial.attempts[0].pairs[1].cleanup = "CLEANUP_ERROR";
    },
  ],
  [
    "gate unexpected field",
    (f) => {
      f.trial.attempts[0].pairs[0].gates[0].rawValue = "excluded";
    },
  ],
])
  test(`completed admission rejects ${name}`, () =>
    fixture(
      (root, f) => {
        writeCompletedPacks(root, f);
        mutate(f);
        assert.throws(() =>
          collectPreservationPackage(f.trial, f.expected, root),
        );
      },
      "FAIL",
      "PASS",
    ));

for (const [name, mutate] of [
  [
    "sealed wrong head",
    (r) => {
      r.headSha = "f".repeat(40);
    },
  ],
  [
    "sealed wrong attempt",
    (r) => {
      r.attemptId = "f".repeat(36);
    },
  ],
  [
    "sealed wrong pair",
    (r) => {
      r.pairId = "f".repeat(36);
    },
  ],
  [
    "sealed wrong candidate",
    (r) => {
      r.candidateSha = "f".repeat(64);
    },
  ],
  [
    "sealed wrong source",
    (r) => {
      r.sourceSha = "f".repeat(40);
    },
  ],
  [
    "failure despite aggregate",
    (r) => {
      r.failure = "CANCELLED";
    },
  ],
  [
    "worker operation error",
    (r) => {
      r.worker.operationError = "ENVIRONMENT_ERROR";
    },
  ],
  [
    "failed target",
    (r) => {
      r.targetFailure = { operationCode: "TIMEOUT", cleanupCode: null };
    },
  ],
  [
    "worker cleanup",
    (r) => {
      r.worker.cleanupVerified = false;
    },
  ],
  [
    "wrong recipe",
    (r) => {
      r.worker.recipeSha = "f".repeat(64);
    },
  ],
  [
    "wrong image invocation",
    (r) => {
      r.worker.invocation.args.push("excluded");
    },
  ],
  [
    "timed out compiler",
    (r) => {
      r.worker.invocation.timedOut = true;
    },
  ],
  [
    "cancelled compiler",
    (r) => {
      r.worker.invocation.cancelled = true;
    },
  ],
  [
    "spawn error",
    (r) => {
      r.worker.invocation.spawnError = "EIO";
    },
  ],
  [
    "compiler overflow",
    (r) => {
      r.worker.invocation.overflow = true;
    },
  ],
  [
    "compiler signal",
    (r) => {
      r.worker.invocation.signal = "SIGTERM";
    },
  ],
  [
    "compiler exit",
    (r) => {
      r.worker.invocation.exitCode = 2;
    },
  ],
  [
    "inner compiler timeout",
    (r) => {
      r.worker.phases[1].error = "ETIMEDOUT";
      r.worker.phases[1].exitCode = null;
    },
  ],
  [
    "missing phase",
    (r) => {
      r.worker.phases.pop();
    },
  ],
  [
    "unexpected stdout",
    (r) => {
      r.worker.phases[0].stdout = "excluded";
    },
  ],
  [
    "partial sealed FAIL",
    (r) => {
      r.parity[0].executedTestIds.pop();
    },
  ],
  [
    "public/private parity mismatch",
    (r) => {
      r.parity[0].verdict = "FAIL";
      r.parity[0].findingCodes = ["HTTP_STATUS"];
    },
  ],
  [
    "unexpected receipt key",
    (r) => {
      r.rawHttp = "excluded";
    },
  ],
])
  test(`source selector rejects ${name} after valid resealing`, () =>
    fixture(
      (root, f) => {
        mutate(f.receipts[1]);
        writeCompletedPacks(root, f);
        assert.throws(() =>
          collectPreservationPackage(f.trial, f.expected, root),
        );
      },
      "FAIL",
      "PASS",
    ));

for (const [name, content, path] of [
  [
    "secret",
    "// Bearer\tSYNTHETIC_SECRET\nexport const value = 1;",
    "src/main.ts",
  ],
  ["unadmitted path", "export const value = 1;", "src/oracle/main.ts"],
  ["oversized file", "x".repeat(256 * 1024 + 1), "src/main.ts"],
])
  test(`source-only export rejects ${name}`, () =>
    fixture((root, f) => {
      const file = { path, content, sha256: sha256(content) };
      f.source.files = [file];
      // Deliberately not changing the admitted trial digest: either admission/hash or
      // the decoded marker boundary must reject, never export a substituted source.
      writeCompletedPacks(root, f);
      assert.throws(() =>
        collectPreservationPackage(f.trial, f.expected, root),
      );
    }));

test("a correctly rebound admitted secret source is refused after canonicalization", () =>
  fixture((root, f) => {
    const content = "// Bearer\nMMP097_SECRET\nexport const value = 1;\n";
    f.source = validateBundle([
      { path: "src/main.ts", content, sha256: sha256(content) },
    ]);
    f.trial.candidateSha = f.source.candidateSha;
    f.trial.attempts[0].candidateSha = f.source.candidateSha;
    for (const [i, pair] of f.trial.attempts[0].pairs.entries()) {
      pair.compilerDiagnostics.candidateSha = f.source.candidateSha;
      f.receipts[i].candidateSha = f.source.candidateSha;
      f.receipts[i].worker.candidateSha = f.source.candidateSha;
    }
    writeCompletedPacks(root, f);
    assert.throws(() => collectPreservationPackage(f.trial, f.expected, root));
  }));

test("missing, malformed or hash-mismatched indexes and source records refuse export", () => {
  for (const kind of [
    "missing-index",
    "malformed-index",
    "index-sha",
    "source-sha",
    "missing-sidecar",
  ])
    fixture((root, f) => {
      writeCompletedPacks(root, f);
      const pair = f.trial.attempts[0].pairs[0];
      const pack = pair.packs[1];
      const directory = join(
        root,
        f.trial.attempts[0].attemptId,
        pair.pairId,
        pack.id,
      );
      if (kind === "missing-index") unlinkSync(join(directory, "index.json"));
      if (kind === "malformed-index")
        writeFileSync(
          join(directory, "index.json"),
          '{"entries":[],"entries":[]}',
        );
      if (kind === "index-sha") pack.sha256 = "f".repeat(64);
      if (kind === "source-sha")
        writeFileSync(join(directory, "pair-1-source.json"), "{}");
      if (kind === "missing-sidecar")
        unlinkSync(join(directory, "pair-2-retention.json"));
      assert.throws(() =>
        collectPreservationPackage(f.trial, f.expected, root),
      );
    });
});

test("source symlink is refused", { skip: process.platform === "win32" }, () =>
  fixture((root, f) => {
    writeCompletedPacks(root, f);
    const pair = f.trial.attempts[0].pairs[0];
    const path = join(
      root,
      f.trial.attempts[0].attemptId,
      pair.pairId,
      pair.packs[1].id,
      "pair-1-source.json",
    );
    const other = join(root, "other.json");
    writeFileSync(other, readFileSync(path), { mode: 0o600 });
    unlinkSync(path);
    symlinkSync(other, path);
    assert.throws(() => collectPreservationPackage(f.trial, f.expected, root));
  }),
);

function pipeline(root, f) {
  writeCompletedPacks(join(root, "meta-paid-verification"), f);
  const payload = collectPreservationPackage(
    f.trial,
    f.expected,
    join(root, "meta-paid-verification"),
  );
  const bytes = Buffer.alloc(200, 7); // Synthetic ciphertext: no crypto claim.
  const record = preservationRecord(
    "ENCRYPTED_PENDING_UPLOAD",
    payload.identity,
    { sha256: sha256(bytes), bytes: bytes.length },
    "VERIFIED_ZERO_RESOURCES",
  );
  mkdirSync(join(root, "meta-paid-public"), { mode: 0o700 });
  mkdirSync(join(root, "mmp089-private-diagnostics"), { mode: 0o700 });
  const save = (name, value) =>
    writeFileSync(
      join(root, "meta-paid-public", `${name}.json`),
      JSON.stringify(value),
      { mode: 0o600 },
    );
  save("trial", f.trial);
  save("preservation", record);
  save("finalizer", {
    headSha: f.expected.headSha,
    status: "PASS",
    emergencyRemoved: 0,
    inventory: { containers: 0, volumes: 0 },
  });
  writeFileSync(
    join(root, "mmp089-private-diagnostics/candidate-diagnostics.age"),
    bytes,
    { mode: 0o600 },
  );
  return {
    save,
    record,
    env: {
      RUNNER_TEMP: root,
      GITHUB_SHA: f.expected.headSha,
      GITHUB_RUN_ID: f.expected.runId,
      GITHUB_RUN_ATTEMPT: f.expected.runAttempt,
      GITHUB_OUTPUT: join(root, "step-output.txt"),
      MMP089_PRESERVE_OUTCOME: "success",
      MMP089_FINALIZER_OUTCOME: "success",
    },
  };
}
const cli = (name) =>
  fileURLToPath(
    new URL(`../../../research/mmp-089/${name}.mjs`, import.meta.url),
  );

for (const [name, mutate] of [
  ["valid", () => {}],
  [
    "wrong variant",
    (p) => {
      delete p.record.identity.case;
      delete p.record.identity.bindingsSha256;
      p.record.format = "mmp089-preservation-v1";
      p.save("preservation", p.record);
    },
  ],
  [
    "changed pack digest",
    (_p, f) => {
      f.trial.attempts[0].pairs[1].packs[1].sha256 = "f".repeat(64);
    },
  ],
  [
    "changed pair ID",
    (_p, f) => {
      f.trial.attempts[0].pairs[1].pairId = f.trial.attempts[0].pairs[2].pairId;
    },
  ],
  [
    "changed finished verdict",
    (_p, f) => {
      const attempt = f.trial.attempts[0];
      f.trial.publicG2 = "FAIL";
      attempt.gates[2].verdict = "FAIL";
      attempt.gates[2].findingCodes = ["HTTP_STATUS"];
      attempt.pairs[0].gates[0].verdict = "FAIL";
      attempt.pairs[0].gates[0].findingCodes = ["HTTP_STATUS"];
    },
  ],
  [
    "failed preservation",
    (p) => {
      p.env.MMP089_PRESERVE_OUTCOME = "failure";
    },
  ],
  [
    "failed finalizer producer",
    (p) => {
      p.env.MMP089_FINALIZER_OUTCOME = "failure";
    },
  ],
  [
    "nonzero finalizer",
    (p, f) => {
      p.save("finalizer", {
        headSha: f.expected.headSha,
        status: "PASS",
        emergencyRemoved: 1,
        inventory: { containers: 0, volumes: 0 },
      });
    },
  ],
  [
    "ciphertext tampering",
    (p) => {
      writeFileSync(
        join(
          p.env.RUNNER_TEMP,
          "mmp089-private-diagnostics/candidate-diagnostics.age",
        ),
        Buffer.alloc(200, 8),
      );
    },
  ],
])
  test(`independent candidate-only upload gate: ${name}`, () =>
    fixture((root, f) => {
      const p = pipeline(root, f);
      mutate(p, f);
      p.save("trial", f.trial);
      const result = spawnSync(process.execPath, [cli("prepare-upload")], {
        env: p.env,
        encoding: "utf8",
        timeout: 10000,
      });
      assert.equal(result.status, 0);
      assert.equal(
        readFileSync(p.env.GITHUB_OUTPUT, "utf8"),
        `eligible=${name === "valid"}\n`,
      );
      assert.doesNotMatch(
        result.stdout + result.stderr,
        /PRIVATE_SOURCE|src\/|stderr|stack/,
      );
    }));

for (const outcome of ["success", "failure", "skipped"])
  test(`simulated candidate-only uploader outcome ${outcome}`, () =>
    fixture((root, f) => {
      const p = pipeline(root, f);
      const result = spawnSync(process.execPath, [cli("record-upload")], {
        env: { ...p.env, MMP089_UPLOAD_OUTCOME: outcome },
        timeout: 10000,
      });
      assert.equal(result.status, outcome === "skipped" ? 1 : 0);
      const record = JSON.parse(
        readFileSync(join(root, "meta-paid-public/preservation.json")),
      );
      assert.equal(
        record.status,
        outcome === "success"
          ? "PRESERVED"
          : outcome === "failure"
            ? "UPLOAD_FAILED"
            : "ENCRYPTED_PENDING_UPLOAD",
      );
      assert.equal(record.identity.case, "G1_PASS_COMPLETED");
      assert.equal(
        record.identity.bindingsSha256,
        p.record.identity.bindingsSha256,
      );
    }));
