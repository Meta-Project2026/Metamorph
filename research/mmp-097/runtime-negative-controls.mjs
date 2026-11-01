// Real trusted validator + disposable Docker fault injection. Budgets unchanged.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  DIAGNOSTIC_POLICY,
  requireNormalCleanup,
} from "../../packages/agent-real/src/private-diagnostics.mjs";
import {
  sha256,
  validateBundle,
} from "../../packages/target-worker/src/admission.mjs";
import { controlFailure, observedExit } from "./qualification-outcome.mjs";

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export async function runtimeNegativeControls({
  root,
  parent,
  headSha,
  baseline,
  env,
}) {
  const records = [];
  for (const [n, mode] of [
    "kill-build",
    "pause-build",
    "cancel-validator",
    "incomplete-entry",
    "secret-source",
    "cleanup-fault",
  ].entries()) {
    const runner = join(parent, `runtime-${mode}`);
    mkdirSync(join(runner, "candidate/src"), { recursive: true, mode: 0o700 });
    mkdirSync(join(runner, "meta-paid-public"), { mode: 0o700 });
    mkdirSync(join(runner, "meta-paid-private"), { mode: 0o700 });
    const source = validateBundle(
      baseline.files.map((file) => {
        if (mode !== "secret-source" || file.path !== "src/main.ts")
          return file;
        const content = `${file.content}\n// Bearer\tMMP099_SYNTHETIC_SOURCE_MARKER\n`;
        return { ...file, content, sha256: sha256(content) };
      }),
    );
    for (const f of source.files)
      writeFileSync(join(runner, "candidate", f.path), f.content, {
        mode: 0o600,
      });
    const runId = String(990001 + n);
    const trialPath = join(runner, "meta-paid-public/trial.json");
    const trial = {
      format: "mmp078-public-paid-trial-v1",
      modelGeneration: "GENERATED",
      aiGeneration: "AI_GENERATION_NOT_RUN",
      generatedRequests: 0,
      headSha,
      candidateSha: source.candidateSha,
      sourceSha: DIAGNOSTIC_POLICY.sourceSha,
      trialRunId: runId,
      budgetAuth: { runId, headSha, sourceSha: DIAGNOSTIC_POLICY.sourceSha },
      publicG1: "NOT_RUN",
      publicG2: "NOT_RUN",
      publicG3: "NOT_RUN",
    };
    writeFileSync(trialPath, JSON.stringify(trial), { mode: 0o600 });
    writeFileSync(
      join(runner, "meta-paid-private/transfer.json"),
      JSON.stringify({
        candidateRoot: join(runner, "candidate"),
        candidateSha: source.candidateSha,
      }),
      { mode: 0o600 },
    );
    const childEnv = {
      ...env,
      RUNNER_TEMP: runner,
      GITHUB_SHA: headSha,
      GITHUB_RUN_ID: runId,
      GITHUB_RUN_ATTEMPT: "1",
    };
    const cli = (path, extra = {}, timeout = 90000) =>
      spawnSync(process.execPath, [join(root, path)], {
        cwd: root,
        env: { ...childEnv, ...extra },
        timeout,
        maxBuffer: 1024 * 1024,
      });
    const docker = (args) =>
      spawnSync("/usr/bin/docker", args, {
        env,
        timeout: 10000,
        maxBuffer: 1024 * 1024,
      });
    const row = {
      id: mode,
      stage: "VALIDATION",
      execution:
        mode === "incomplete-entry"
          ? "REAL_NODE_PRE_ENTRY_TIMEOUT_HARNESS"
          : mode === "secret-source"
            ? "ACTUAL_VALIDATOR_SECRET_MARKER_CANDIDATE"
            : mode === "cleanup-fault"
              ? "ACTUAL_VALIDATOR_WITH_REAL_CHILD_CLEANUP_FAULT"
              : "ACTUAL_VALIDATOR_DOCKER_BUILD_FAULT",
      status: "ERROR",
    };
    records.push(row);
    let buildName;
    let rescue;
    let child;
    try {
      if (mode === "incomplete-entry") {
        const preload = join(runner, "pre-entry.mjs");
        writeFileSync(
          preload,
          "await new Promise(resolve => setTimeout(resolve, 60000));\n",
          { mode: 0o600 },
        );
        const timed = spawnSync(
          process.execPath,
          [
            "--import",
            preload,
            join(root, "research/mmp-078/validate-candidate.mjs"),
          ],
          { cwd: root, env: childEnv, timeout: 150, maxBuffer: 1024 * 1024 },
        );
        assert.equal(timed.error?.code, "ETIMEDOUT");
        let failure;
        try {
          observedExit(timed);
        } catch (error) {
          failure = controlFailure("VALIDATION", error);
        }
        assert.equal(failure.status, "ERROR");
        assert.equal(failure.cause, "TIMEOUT");
        row.process = {
          exitCode: timed.status,
          signal: timed.signal,
          timedOut: true,
          classification: failure,
        };
      } else if (["secret-source", "cleanup-fault"].includes(mode)) {
        let preload = join(root, "research/mmp-086/network-guard.mjs");
        if (mode === "cleanup-fault") {
          preload = join(runner, "cleanup-fault-preload.mjs");
          writeFileSync(
            preload,
            'import cp from "node:child_process"; import { syncBuiltinESMExports } from "node:module"; import { pathToFileURL } from "node:url"; import { writeFileSync } from "node:fs"; import { join } from "node:path"; await import(new URL("../mmp-086/network-guard.mjs", pathToFileURL(process.argv[1]))); const original = cp.spawn; let injected = false; cp.spawn = function(file, args, options) { if (!injected && file === "docker" && args[0] === "rm" && args.some(a => /^mmp007-[a-f0-9-]{36}-build$/.test(a))) { injected = true; const child = original(process.execPath, ["-e", "process.exit(42)"], options); child.on("close", code => writeFileSync(join(process.env.RUNNER_TEMP,"cleanup-injection.json"), JSON.stringify({injected:true,exitCode:code}),{mode:0o600})); return child; } return original(file,args,options); }; syncBuiltinESMExports();\n',
            { mode: 0o600 },
          );
        }
        const completed = spawnSync(
          process.execPath,
          [
            "--import",
            preload,
            join(root, "research/mmp-078/validate-candidate.mjs"),
          ],
          {
            cwd: root,
            env: childEnv,
            timeout: 10 * 60 * 1000,
            maxBuffer: 1024 * 1024,
          },
        );
        row.process = {
          exitCode: completed.status,
          signal: completed.signal,
          timedOut: completed.error?.code === "ETIMEDOUT",
        };
        assert.equal(observedExit(completed), mode === "secret-source" ? 0 : 1);
        const observed = JSON.parse(readFileSync(trialPath));
        row.gates = {
          G1: observed.publicG1,
          G2: observed.publicG2,
          G3: observed.publicG3,
        };
        if (mode === "secret-source") {
          assert.deepEqual(row.gates, { G1: "PASS", G2: "PASS", G3: "PASS" });
          requireNormalCleanup(observed.cleanup);
          row.coverage = observed.attempts[0].coverage;
        } else {
          const injection = JSON.parse(
            readFileSync(join(runner, "cleanup-injection.json")),
          );
          assert.equal(injection.injected, true);
          assert.equal(injection.exitCode, 42);
          row.injectedCleanupExit = 42;
          assert.equal(observed.publicG1, "ERROR");
          assert.equal(observed.attempts[0].pairs[0].cleanup, "CLEANUP_ERROR");
          assert.ok(
            observed.attempts[0].gates
              .find((g) => g.gate === "G1")
              .findingCodes.includes("CLEANUP_ERROR"),
          );
          assert.equal(observed.cleanup.containers, 0);
          assert.equal(observed.cleanup.volumes, 0);
          assert.equal(observed.cleanup.emergencyRemoved, 0);
        }
      } else {
        child = spawn(
          process.execPath,
          [
            "--import",
            join(root, "research/mmp-086/network-guard.mjs"),
            join(root, "research/mmp-078/validate-candidate.mjs"),
          ],
          { cwd: root, env: childEnv, stdio: ["ignore", "pipe", "pipe"] },
        );
        let closed = false;
        let bytes = 0;
        const done = new Promise((resolve) => {
          child.on("error", () =>
            resolve({ status: null, error: { code: "SPAWN_ERROR" } }),
          );
          child.on("close", (status, signal) => {
            closed = true;
            resolve({ status, signal });
          });
          for (const channel of [child.stdout, child.stderr])
            channel.on("data", (chunk) => {
              bytes += chunk.length;
              if (bytes > 1024 * 1024) child.kill("SIGKILL");
            });
        });
        const deadline = setTimeout(() => child.kill("SIGKILL"), 4 * 60 * 1000);
        try {
          const start = performance.now();
          while (!closed && !buildName && performance.now() - start < 120000) {
            const list = docker([
              "container",
              "ls",
              "--filter",
              "label=metamorph.target-worker=true",
              "--format",
              "{{.Names}}",
            ]);
            assert.equal(observedExit(list), 0);
            const names = list.stdout
              .toString()
              .trim()
              .split(/\s+/)
              .filter((name) => /^mmp007-[a-f0-9-]{36}-build$/.test(name));
            assert.ok(names.length <= 1);
            buildName = names[0];
            if (!buildName) await pause(100);
          }
          assert.ok(buildName && !closed);
          row.buildIdentitySha256 = sha256(buildName);
          const injectedAt = performance.now();
          if (mode === "cancel-validator")
            assert.equal(child.kill("SIGTERM"), true);
          else {
            const action = docker(
              mode === "kill-build"
                ? ["kill", "--signal", "KILL", buildName]
                : ["pause", buildName],
            );
            assert.equal(observedExit(action), 0);
            row.injectionExitCode = action.status;
            if (mode === "pause-build")
              rescue = setTimeout(() => {
                docker(["unpause", buildName]);
              }, 40000);
          }
          const completed = await done;
          row.process = {
            exitCode: completed.status,
            signal: completed.signal,
            timedOut: false,
          };
          row.afterInjectionMs = Math.round(performance.now() - injectedAt);
          assert.equal(observedExit(completed), 1);
          const observed = JSON.parse(readFileSync(trialPath));
          row.gates = {
            G1: observed.publicG1,
            G2: observed.publicG2,
            G3: observed.publicG3,
          };
          row.findingCodes = [
            ...new Set(
              observed.attempts?.flatMap(
                (a) => a.gates.find((g) => g.gate === "G1")?.findingCodes ?? [],
              ) ?? [],
            ),
          ].filter((code) =>
            [
              "TIMEOUT",
              "CANCELLED",
              "ENVIRONMENT_ERROR",
              "BUILD_NOT_RUN",
              "MISSING_COVERAGE",
            ].includes(code),
          );
          assert.equal(observed.publicG1, "ERROR");
          assert.notEqual(observed.publicG2, "PASS");
          assert.notEqual(observed.publicG3, "PASS");
          if (mode === "pause-build")
            assert.ok(row.findingCodes.includes("TIMEOUT"));
          if (mode === "cancel-validator")
            assert.ok(row.findingCodes.includes("CANCELLED"));
          requireNormalCleanup(observed.cleanup);
          row.normalCleanup = "VERIFIED_ZERO_RESOURCES";
        } finally {
          clearTimeout(deadline);
          clearTimeout(rescue);
          if (!closed) {
            child.kill("SIGKILL");
            await done;
          }
        }
      }
      const before = sha256(readFileSync(trialPath));
      row.stage = "PRESERVATION";
      // Keep a valid encryption path behind secret rejection: absence of age
      // must not accidentally satisfy this source-policy negative control.
      if (mode === "secret-source") {
        const tools = join(runner, "mmp089-tools");
        mkdirSync(tools, { mode: 0o700 });
        const tool = join(tools, "age");
        copyFileSync(process.env.MMP089_AGE_PATH, tool);
        chmodSync(tool, 0o755);
        assert.equal(sha256(readFileSync(tool)), DIAGNOSTIC_POLICY.ageSha256);
      }
      const preserver = cli("research/mmp-089/preserve.mjs");
      row.preserverExit = observedExit(preserver);
      assert.equal(preserver.status, mode === "secret-source" ? 1 : 0);
      const preservation = JSON.parse(
        readFileSync(join(runner, "meta-paid-public/preservation.json")),
      );
      assert.equal(
        preservation.status,
        mode === "secret-source" ? "REJECTED" : "NOT_APPLICABLE",
      );
      assert.equal(
        existsSync(
          join(runner, "mmp089-private-diagnostics/candidate-diagnostics.age"),
        ),
        false,
      );
      row.preservationStatus = preservation.status;
      assert.equal(sha256(readFileSync(trialPath)), before);
      row.status = "PENDING_FINALIZER";
    } catch (error) {
      Object.assign(row, controlFailure(row.stage, error));
    } finally {
      clearTimeout(rescue);
      if (buildName) docker(["unpause", buildName]); // only this owned test resource, if still present
      const finalized = cli(
        "packages/differential/src/workshop-finalizer.mjs",
        {
          WORKSHOP_PUBLIC_OUTPUT: join(runner, "meta-paid-public"),
          PILOT_HEAD_SHA: headSha,
        },
        60000,
      );
      let terminalStage = "FINALIZER";
      try {
        assert.equal(observedExit(finalized), 0);
        const finalizer = JSON.parse(
          readFileSync(join(runner, "meta-paid-public/finalizer.json")),
        );
        assert.equal(finalizer.status, "PASS");
        assert.equal(finalizer.emergencyRemoved, 0);
        assert.deepEqual(finalizer.inventory, { containers: 0, volumes: 0 });
        row.finalizer = {
          exitCode: finalized.status,
          inventory: finalizer.inventory,
          emergencyRemoved: 0,
        };
        if (row.status === "PENDING_FINALIZER") {
          terminalStage = "UPLOAD_GATE";
          const step = join(runner, "gate-output.txt");
          const gate = cli("research/mmp-089/prepare-upload.mjs", {
            GITHUB_OUTPUT: step,
            MMP089_PRESERVE_OUTCOME:
              mode === "secret-source" ? "failure" : "success",
            MMP089_FINALIZER_OUTCOME: "success",
          });
          assert.equal(observedExit(gate), 0);
          assert.equal(readFileSync(step, "utf8"), "eligible=false\n");
          row.gateExit = gate.status;
          row.eligible = false;
          row.status = "PASS";
        }
      } catch (error) {
        if (["ERROR", "FAIL"].includes(row.status))
          row.terminalFailure = controlFailure(terminalStage, error);
        else Object.assign(row, controlFailure(terminalStage, error));
        row.cleanup = "ERROR";
      }
    }
    if (row.status !== "PASS") break;
  }
  return {
    status:
      records.length === 6 && records.every((r) => r.status === "PASS")
        ? "PASS"
        : "ERROR",
    cases: records,
  };
}
