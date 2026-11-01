// Trusted child-process boundary controls on actual completed trial/ciphertext.
// Pre-entry timeout/crash harnesses do not claim an inner tool timeout.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DIAGNOSTIC_POLICY } from "../../packages/agent-real/src/private-diagnostics.mjs";
import { sha256 } from "../../packages/target-worker/src/admission.mjs";
import { controlFailure, observedExit } from "./qualification-outcome.mjs";

export function processFaultControls({ root, runner, expected, env }) {
  const output = join(runner, "meta-paid-public");
  const trialPath = join(output, "trial.json");
  const finalPath = join(output, "finalizer.json");
  const trialSha = sha256(readFileSync(trialPath));
  const trial = JSON.parse(readFileSync(trialPath));
  assert.ok(
    [trial.publicG1, trial.publicG2, trial.publicG3].every(
      (gate) => gate === "PASS",
    ),
  );
  const originalFinal = readFileSync(finalPath);
  const baseEnv = {
    ...env,
    RUNNER_TEMP: runner,
    GITHUB_SHA: expected.headSha,
    GITHUB_RUN_ID: expected.runId,
    GITHUB_RUN_ATTEMPT: "1",
    WORKSHOP_PUBLIC_OUTPUT: output,
    PILOT_HEAD_SHA: expected.headSha,
  };
  const run = (args, extra = {}, timeout = 60000) =>
    spawnSync(process.execPath, args, {
      cwd: root,
      env: { ...baseEnv, ...extra },
      timeout,
      maxBuffer: 1024 * 1024,
    });
  const docker = (args) =>
    spawnSync("/usr/bin/docker", args, {
      env,
      timeout: 10000,
      maxBuffer: 1024 * 1024,
    });
  const records = [];
  let activeRow;
  let activeStage = "PRESERVATION";
  const gate = (id, extra = {}) => {
    const path = join(runner, `${id}-output.txt`);
    const result = run([join(root, "research/mmp-089/prepare-upload.mjs")], {
      MMP089_PRESERVE_OUTCOME: "success",
      MMP089_FINALIZER_OUTCOME: "success",
      GITHUB_OUTPUT: path,
      ...extra,
    });
    assert.equal(observedExit(result), 0);
    assert.equal(readFileSync(path, "utf8"), "eligible=false\n");
  };
  try {
    for (const [stage, file] of [
      ["PRESERVATION", "research/mmp-089/preserve.mjs"],
      ["FINALIZER", "packages/differential/src/workshop-finalizer.mjs"],
      ["UPLOAD_GATE", "research/mmp-089/prepare-upload.mjs"],
    ]) {
      for (const mode of ["timeout", "crash"]) {
        const row = {
          id: `${stage.toLowerCase()}-${mode}`,
          execution: "REAL_CHILD_PRE_ENTRY_FAULT_HARNESS",
          status: "ERROR",
        };
        records.push(row);
        activeRow = row;
        activeStage = stage;
        const preload = join(runner, `${row.id}-preload.mjs`);
        const step = join(runner, `${row.id}-step.txt`);
        writeFileSync(
          preload,
          mode === "timeout"
            ? "await new Promise(resolve => setTimeout(resolve,60000));\n"
            : "process.exit(42);\n",
          { mode: 0o600 },
        );
        const child = run(
          ["--import", preload, join(root, file)],
          { GITHUB_OUTPUT: step },
          mode === "timeout" ? 150 : 10000,
        );
        row.exitCode = child.status;
        row.signal = child.signal;
        row.timedOut = child.error?.code === "ETIMEDOUT";
        if (mode === "timeout") assert.equal(row.timedOut, true);
        else assert.equal(observedExit(child), 42);
        const error = new Error("CONTROL_PROCESS_ERROR");
        error.code = "CONTROL_PROCESS_ERROR";
        error.processError = mode === "timeout" ? "ETIMEDOUT" : "SPAWN_ERROR";
        const classified = controlFailure(stage, error);
        assert.equal(classified.status, "ERROR");
        if (mode === "timeout") assert.equal(classified.cause, "TIMEOUT");
        row.cause = classified.cause;
        if (stage === "UPLOAD_GATE") assert.equal(existsSync(step), false);
        else {
          activeStage = "UPLOAD_GATE";
          gate(
            row.id,
            stage === "PRESERVATION"
              ? { MMP089_PRESERVE_OUTCOME: "failure" }
              : { MMP089_FINALIZER_OUTCOME: "failure" },
          );
        }
        assert.equal(sha256(readFileSync(trialPath)), trialSha);
        row.eligible = false;
        row.status = "PASS";
      }
    }
    for (const failure of [false, true]) {
      const row = {
        id: failure
          ? "finalizer-real-nonzero-inventory"
          : "finalizer-real-emergency-removal",
        execution: "ACTUAL_FINALIZER_WITH_OWN_STOPPED_DOCKER_SENTINEL",
        status: "ERROR",
      };
      records.push(row);
      activeRow = row;
      activeStage = "FINALIZER";
      const name = `mmp007-mmp099-${randomUUID()}`;
      assert.equal(
        observedExit(
          docker([
            "create",
            "--name",
            name,
            "--network",
            "none",
            "--pull",
            "never",
            "--entrypoint",
            "/usr/local/bin/node",
            DIAGNOSTIC_POLICY.image,
            "-e",
            "process.exit(0)",
          ]),
        ),
        0,
      );
      try {
        if (existsSync(finalPath)) unlinkSync(finalPath);
        const args = [];
        if (failure) {
          const preload = join(runner, "finalizer-fault-preload.mjs");
          writeFileSync(
            preload,
            `import cp from "node:child_process"; import {syncBuiltinESMExports} from "node:module"; const original=cp.spawn; cp.spawn=function(file,args,options){ if(file==="docker" && args[0]==="rm" && args.includes(${JSON.stringify(name)})) return original(process.execPath,["-e","process.exit(42)"],options); return original(file,args,options); }; syncBuiltinESMExports();\n`,
            { mode: 0o600 },
          );
          args.push("--import", preload);
        }
        args.push(
          join(root, "packages/differential/src/workshop-finalizer.mjs"),
        );
        const final = run(args);
        assert.equal(observedExit(final), 1);
        row.finalizerExit = final.status;
        if (failure) {
          assert.equal(existsSync(finalPath), false);
          const inventory = docker([
            "container",
            "ls",
            "--all",
            "--filter",
            `name=^/${name}$`,
            "--format",
            "{{.ID}}",
          ]);
          assert.equal(observedExit(inventory), 0);
          assert.ok(inventory.stdout.toString().trim());
          row.observedInventory = 1;
        } else {
          const receipt = JSON.parse(readFileSync(finalPath));
          assert.equal(receipt.status, "ERROR");
          assert.equal(receipt.emergencyRemoved, 1);
          assert.deepEqual(receipt.inventory, { containers: 0, volumes: 0 });
          row.observedInventory = 0;
          row.intentionalFaultRecoveryRemoved = 1;
        }
        // Even an incorrectly reported successful producer cannot admit the
        // real ERROR/missing finalizer receipt after genuine G1/G2/G3 completion.
        activeStage = "UPLOAD_GATE";
        gate(row.id);
        gate(`${row.id}-producer`, { MMP089_FINALIZER_OUTCOME: "failure" });
        row.eligible = false;
        row.status = "PASS";
      } catch (error) {
        Object.assign(row, controlFailure(activeStage, error));
        row.hasPrimaryFailure = true;
        throw error;
      } finally {
        activeStage = "FINALIZER";
        if (failure) {
          const recovery = run([
            join(root, "packages/differential/src/workshop-finalizer.mjs"),
          ]);
          assert.equal(observedExit(recovery), 1);
          const receipt = JSON.parse(readFileSync(finalPath));
          assert.equal(receipt.emergencyRemoved, 1);
          assert.deepEqual(receipt.inventory, { containers: 0, volumes: 0 });
          row.intentionalFaultRecoveryRemoved = 1;
        }
        const clean = run([
          join(root, "packages/differential/src/workshop-finalizer.mjs"),
        ]);
        assert.equal(observedExit(clean), 0);
        const receipt = JSON.parse(readFileSync(finalPath));
        assert.equal(receipt.emergencyRemoved, 0);
        assert.deepEqual(receipt.inventory, { containers: 0, volumes: 0 });
        row.postRecoveryFinalizer = "PASS_ZERO_ZERO_ZERO";
      }
    }
    return { status: "PASS", cases: records };
  } catch (error) {
    const failure = controlFailure(activeStage, error);
    if (activeRow?.hasPrimaryFailure) activeRow.terminalFailure = failure;
    else if (activeRow) Object.assign(activeRow, failure);
    return { status: activeRow?.status ?? failure.status, cases: records };
  } finally {
    writeFileSync(finalPath, originalFinal, { mode: 0o600 });
    originalFinal.fill(0);
  }
}
