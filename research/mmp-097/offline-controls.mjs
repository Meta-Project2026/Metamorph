// Manual Linux-only acceptance driver. Synthetic source; actual workers/crypto.
// NOT_RUN until a real disposable Docker host executes it. No provider or upload.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { collectPreservationPackage } from "../../packages/agent-real/src/candidate-retention.mjs";
import { encryptDiagnostic } from "../../packages/agent-real/src/encrypt-diagnostics.mjs";
import {
  DIAGNOSTIC_POLICY,
  requireNormalCleanup,
} from "../../packages/agent-real/src/private-diagnostics.mjs";
import { WORKSHOP_CANDIDATE_SHA } from "../../packages/differential/src/workshop-policy.mjs";
import {
  admitDirectory,
  sha256,
  validateBundle,
} from "../../packages/target-worker/src/admission.mjs";
import { controlFailure, encryptionRefusal } from "./qualification-outcome.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
assert.equal(process.platform, "linux");
assert.ok(
  !process.env.MODEL_API_KEY &&
    !process.env.GH_TOKEN &&
    !process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN,
);
const parent = process.env.MMP097_PRIVATE_PARENT;
const output = process.env.MMP097_PUBLIC_OUTPUT;
const agePath = process.env.MMP089_AGE_PATH;
assert.ok(
  [parent, output, agePath].every(
    (p) => typeof p === "string" && isAbsolute(p),
  ),
);
process.umask(0o077);
mkdirSync(parent, { mode: 0o700 }); // Fresh directory only. Never reuse receipts.
mkdirSync(output, { recursive: true, mode: 0o700 });
const headSha = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
assert.equal(headSha, process.env.AGENT_HEAD_SHA);
assert.equal(
  execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], {
    cwd: root,
    encoding: "utf8",
  }),
  "",
);
assert.equal(
  execFileSync("/usr/bin/docker", ["info", "--format", "{{.OSType}}"], {
    encoding: "utf8",
  }).trim(),
  "linux",
);
const keygen = join(dirname(agePath), "age-keygen");
assert.equal(sha256(readFileSync(agePath)), DIAGNOSTIC_POLICY.ageSha256);
assert.equal(sha256(readFileSync(keygen)), DIAGNOSTIC_POLICY.keygenSha256);
const env = {
  PATH: "/usr/local/bin:/usr/bin:/bin",
  HOME: "/nonexistent",
  TZ: "UTC",
};
const key = join(parent, "throwaway-key.txt");
const wrongKey = join(parent, "wrong-key.txt");
for (const path of [key, wrongKey])
  execFileSync(keygen, ["--output", path], {
    env,
    stdio: "pipe",
    timeout: 10000,
  });
const recipient = execFileSync(keygen, ["-y", key], {
  env,
  encoding: "utf8",
  stdio: "pipe",
  timeout: 10000,
}).trim();
const throwawayPolicy = {
  ...DIAGNOSTIC_POLICY,
  recipient,
  recipientSha256: sha256(recipient),
};
const baseline = await admitDirectory(
  join(root, "packages/target-worker/fixtures/workshop"),
  WORKSHOP_CANDIDATE_SHA,
);
const results = [];
const cryptoControls = [];
let status = "PASS";
const cli = (file, extra, timeout = 10000) =>
  spawnSync(process.execPath, [join(root, file)], {
    cwd: root,
    env: { ...env, ...extra },
    timeout,
    maxBuffer: 1024 * 1024,
  });
const save = (path, value) =>
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
const encrypt = (plaintext, extra = {}) =>
  encryptDiagnostic(Buffer.from(plaintext), {
    agePath,
    workerPath: join(root, "research/mmp-089/encrypt-worker.mjs"),
    policy: throwawayPolicy,
    ...extra,
  });

try {
  for (const [number, [g2, g3]] of [
    ["FAIL", "PASS"],
    ["PASS", "FAIL"],
    ["FAIL", "FAIL"],
    ["PASS", "PASS"],
    ["BUILD_FAILED", "INCONCLUSIVE"],
  ].entries()) {
    const id =
      g2 === "BUILD_FAILED"
        ? "legacy-g1-build-failed"
        : `g1-pass-g2-${g2.toLowerCase()}-g3-${g3.toLowerCase()}`;
    const runner = join(parent, id);
    mkdirSync(join(runner, "meta-paid-public"), {
      recursive: true,
      mode: 0o700,
    });
    mkdirSync(join(runner, "meta-paid-private"), { mode: 0o700 });
    const candidateRoot = join(runner, "candidate");
    mkdirSync(join(candidateRoot, "src"), { recursive: true, mode: 0o700 });
    const files =
      g2 === "BUILD_FAILED"
        ? [
            {
              path: "src/main.ts",
              content:
                "export const value: number = 'MMP097_PRIVATE_SOURCE';\n",
            },
          ]
        : baseline.files.map(({ path, content }) => {
            if (path !== "src/main.ts") return { path, content };
            const marker = "  res.end(\n";
            assert.equal(content.split(marker).length, 2);
            const mutation = `${g2 === "FAIL" ? "  res.statusCode = 503;\n" : ""}${g3 === "FAIL" ? '  db.exec("CREATE TABLE IF NOT EXISTS mmp097_control (id INTEGER)");\n' : ""}`;
            return {
              path,
              content: content.replace(marker, mutation + marker),
            };
          });
    const source = validateBundle(
      files.map((f) => ({ ...f, sha256: sha256(f.content) })),
    );
    for (const file of source.files)
      writeFileSync(join(candidateRoot, file.path), file.content, {
        mode: 0o600,
      });
    const expected = {
      runId: String(970001 + number),
      runAttempt: "1",
      headSha,
    };
    const trialPath = join(runner, "meta-paid-public/trial.json");
    save(trialPath, {
      format: "mmp078-public-paid-trial-v1",
      modelGeneration: "GENERATED",
      aiGeneration: "AI_GENERATION_NOT_RUN",
      generatedRequests: 0,
      headSha,
      trialRunId: expected.runId,
      sourceSha: DIAGNOSTIC_POLICY.sourceSha,
      candidateSha: source.candidateSha,
      budgetAuth: {
        runId: expected.runId,
        headSha,
        sourceSha: DIAGNOSTIC_POLICY.sourceSha,
      },
    });
    save(join(runner, "meta-paid-private/transfer.json"), {
      candidateRoot,
      candidateSha: source.candidateSha,
    });
    const boundEnv = {
      RUNNER_TEMP: runner,
      GITHUB_SHA: headSha,
      GITHUB_RUN_ID: expected.runId,
      GITHUB_RUN_ATTEMPT: "1",
    };
    const row = {
      id,
      status: "NOT_TESTED",
      stage: "VALIDATION",
      execution: "REAL_DOCKER_SYNTHETIC_SOURCE",
      validatorExit: null,
      preserverExit: null,
      finalizerExit: null,
      uploadGateExit: null,
    };
    results.push(row);
    try {
      const validation = spawnSync(
        process.execPath,
        [
          "--import",
          join(root, "research/mmp-086/network-guard.mjs"),
          join(root, "research/mmp-078/validate-candidate.mjs"),
        ],
        {
          cwd: root,
          env: { ...env, ...boundEnv },
          timeout: 10 * 60 * 1000,
          maxBuffer: 1024 * 1024,
        },
      );
      row.validatorExit = validation.status;
      if (validation.error)
        row.processError =
          validation.error.code === "ETIMEDOUT" ? "ETIMEDOUT" : "SPAWN_ERROR";
      const trial = JSON.parse(readFileSync(trialPath));
      row.blockers = (trial.blockers ?? []).filter((code) =>
        [
          "TIMEOUT",
          "CANCELLED",
          "ENVIRONMENT_ERROR",
          "PUBLIC_DOCKER_ERROR",
          "EVIDENCE_ERROR",
          "CLEANUP_ERROR",
          "BUILD_FAILED",
        ].includes(code),
      );
      row.gates = {
        G1: trial.publicG1,
        G2: trial.publicG2,
        G3: trial.publicG3,
      };
      row.coverage = trial.attempts?.[0]?.coverage ?? null;
      assert.equal(validation.error, undefined);
      assert.equal(validation.status, g2 === "PASS" && g3 === "PASS" ? 0 : 1);
      assert.equal(trial.publicG1, g2 === "BUILD_FAILED" ? "FAIL" : "PASS");
      assert.equal(trial.publicG2, g2 === "BUILD_FAILED" ? "INCONCLUSIVE" : g2);
      assert.equal(trial.publicG3, g2 === "BUILD_FAILED" ? "INCONCLUSIVE" : g3);
      requireNormalCleanup(trial.cleanup);
      if (g2 !== "BUILD_FAILED")
        assert.deepEqual(trial.attempts[0].coverage, {
          http: 17,
          sqlite: 20,
          requiredHttp: 17,
          requiredSqlite: 20,
        });
      const network = JSON.parse(
        readFileSync(join(runner, "meta-paid-public/network.json")),
      );
      assert.equal(network.sourceFetches, 1);
      assert.equal(network.blockedRequests, 0);
      row.stage = "SELECTION";
      const payload = collectPreservationPackage(
        trial,
        expected,
        join(runner, "meta-paid-verification"),
      );
      assert.equal(
        payload.format,
        g2 === "BUILD_FAILED"
          ? "mmp089-private-diagnostics-v1"
          : "mmp097-candidate-only-v1",
      );
      assert.deepEqual(payload.files, source.files);
      const plaintext = Buffer.from(JSON.stringify(payload));
      try {
        row.stage = "CRYPTO";
        const encrypted = await encrypt(plaintext);
        assert.equal(encrypted.cleanup, "VERIFIED_ZERO_RESOURCES");
        const restored = execFileSync(
          agePath,
          ["--decrypt", "--identity", key],
          {
            env,
            input: encrypted.ciphertext,
            timeout: 10000,
            maxBuffer: DIAGNOSTIC_POLICY.plaintextBytes,
            stdio: "pipe",
          },
        );
        try {
          assert.equal(sha256(restored), sha256(plaintext));
          const recovered = JSON.parse(restored);
          assert.deepEqual(recovered, payload);
          assert.equal(
            validateBundle(recovered.files).candidateSha,
            source.candidateSha,
          );
          for (const file of recovered.files)
            assert.deepEqual(
              recovered.manifest.find((e) => e.path === file.path),
              {
                path: file.path,
                bytes: Buffer.byteLength(file.content),
                sha256: sha256(file.content),
              },
            );
        } finally {
          restored.fill(0);
        }
        const bad = Buffer.from(encrypted.ciphertext);
        bad[bad.length - 1] ^= 1;
        for (const [input, identity] of [
          [encrypted.ciphertext, wrongKey],
          [bad, key],
        ]) {
          const denied = spawnSync(
            agePath,
            ["--decrypt", "--identity", identity],
            {
              env,
              input,
              timeout: 10000,
              maxBuffer: DIAGNOSTIC_POLICY.plaintextBytes,
            },
          );
          assert.equal(denied.error, undefined);
          assert.equal(denied.status, 1);
          assert.equal(denied.signal, null);
          denied.stdout?.fill(0);
        }
        row.throwawayRoundtrip = "PASS";
        row.wrongKey = "REJECTED";
        row.tamperedCiphertext = "REJECTED";
        if (number === 0) {
          await assert.rejects(
            encrypt(plaintext, {
              policy: { ...throwawayPolicy, recipientSha256: "f".repeat(64) },
            }),
            { message: "DIAGNOSTIC_REJECTED" },
          );
          cryptoControls.push("wrong-recipient-pin-rejected");
          await assert.rejects(
            encrypt(Buffer.alloc(DIAGNOSTIC_POLICY.plaintextBytes + 1)),
            { message: "DIAGNOSTIC_REJECTED" },
          );
          cryptoControls.push("oversize-rejected");
          const crash = join(parent, "crash-worker.mjs");
          writeFileSync(crash, "process.exit(23);\n", { mode: 0o644 });
          const observeRefusal = async (control, workerPath) => {
            const started = performance.now();
            let refusal;
            try {
              await encrypt(plaintext, { workerPath });
            } catch (error) {
              refusal = error;
            }
            cryptoControls.push(
              encryptionRefusal(control, refusal, performance.now() - started),
            );
          };
          await observeRefusal("crash-input", crash);
          const hang = join(parent, "hang-worker.mjs");
          writeFileSync(hang, "setInterval(() => {}, 1000);\n", {
            mode: 0o644,
          });
          await observeRefusal("deadline-input", hang);
        }
      } finally {
        plaintext.fill(0);
      }
      const tools = join(runner, "mmp089-tools");
      row.stage = "PRESERVATION";
      mkdirSync(tools, { mode: 0o700 });
      copyFileSync(agePath, join(tools, "age"));
      chmodSync(join(tools, "age"), 0o755);
      const preservation = cli(
        "research/mmp-089/preserve.mjs",
        boundEnv,
        90000,
      );
      row.preserverExit = preservation.status;
      assert.equal(preservation.status, 0);
      const record = JSON.parse(
        readFileSync(join(runner, "meta-paid-public/preservation.json")),
      );
      assert.equal(record.status, "ENCRYPTED_PENDING_UPLOAD");
      assert.equal(
        record.recipientFingerprint,
        DIAGNOSTIC_POLICY.recipientKeySha256,
      );
      row.preservation = record;
      row.status = "PENDING_FINALIZER";
    } catch (error) {
      Object.assign(row, controlFailure(row.stage, error, row));
      status = "NO_GO";
    } finally {
      const finalizer = cli(
        "packages/differential/src/workshop-finalizer.mjs",
        {
          WORKSHOP_PUBLIC_OUTPUT: join(runner, "meta-paid-public"),
          PILOT_HEAD_SHA: headSha,
        },
        60000,
      );
      row.finalizerExit = finalizer.status;
      let finalStage = "FINALIZER";
      try {
        const record = JSON.parse(
          readFileSync(join(runner, "meta-paid-public/finalizer.json")),
        );
        row.finalizer = record;
        assert.equal(finalizer.status, 0);
        assert.equal(record.status, "PASS");
        assert.equal(record.emergencyRemoved, 0);
        assert.deepEqual(record.inventory, { containers: 0, volumes: 0 });
        if (row.status === "PENDING_FINALIZER") {
          finalStage = "UPLOAD_GATE";
          const stepOutput = join(runner, "gate-output.txt");
          const gate = cli("research/mmp-089/prepare-upload.mjs", {
            ...boundEnv,
            GITHUB_OUTPUT: stepOutput,
            MMP089_PRESERVE_OUTCOME: "success",
            MMP089_FINALIZER_OUTCOME: "success",
          });
          row.uploadGateExit = gate.status;
          assert.equal(gate.status, 0);
          assert.equal(readFileSync(stepOutput, "utf8"), "eligible=true\n");
          row.status = "PASS";
          row.stage = "UPLOAD_GATE";
        }
      } catch (error) {
        const terminal = controlFailure(finalStage, error, {
          processError: finalizer.error?.code,
        });
        // Preserve an earlier mismatch/environment observation if cleanup also fails.
        if (["FAIL", "ERROR"].includes(row.status))
          row.terminalFailure = terminal;
        else Object.assign(row, terminal);
        status = "NO_GO";
      }
    }
    if (status !== "PASS") break; // Keep original failure; no silent retries.
  }
} catch {
  status = "NO_GO";
} finally {
  if (results.length !== 5 || results.some((r) => r.status !== "PASS"))
    status = "NO_GO";
  save(join(output, "controls.json"), {
    format: "mmp097-offline-controls-v1",
    headSha,
    scopedStatus: status === "PASS" ? "PASS_SCOPED" : status,
    acceptance: "NO_GO_PENDING_FULL_MATRIX",
    cases: results,
    cryptoControls,
    aiGeneration: "AI_GENERATION_NOT_RUN",
    metaRequests: 0,
    liveUpload: "NOT_RUN",
    ownerKey: "NEVER_ACCESSED",
    ownerDecrypt: "NOT_VERIFIED",
    G1ErrorTimeoutCancelActualCases: "NOT_TESTED",
    product: "NOT_ESTABLISHED",
  });
  console.log(
    `MMP097 ${status === "PASS" ? "PASS_SCOPED" : status}; completed cases=${results.filter((r) => r.status === "PASS").length}/5; private source/output/keys withheld`,
  );
  if (status !== "PASS") process.exitCode = 1;
}
