// Trusted orchestration. Candidate is only compiled/executed inside target isolation.
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DockerReferenceTransport,
  dockerCommand,
  MANIFEST,
  PhpReferenceWorker,
  PrivateEvidence,
  provisionRuntime,
  SOURCE,
  verifyPair,
} from "@metamorph/oracle";
import { WORKSHOP_PROFILE } from "../../target-worker/runtime/profile.mjs";
import { admitDirectory } from "../../target-worker/src/admission.mjs";
import {
  FIXED_ENV,
  requireSuccess,
  TargetWorker,
} from "../../target-worker/src/controller.mjs";
import { buildTrustedRuntime } from "../../target-worker/src/runtime-broker.mjs";
import { validateTargetClock } from "./clock.mjs";
import { atomicJson, privateRun, retainOracle } from "./private-run.mjs";
import { Resources } from "./resources.mjs";
import { requireCheck, strictJson } from "./strict.mjs";
import { TargetOracleAdapter } from "./target-adapter.mjs";
import { workshopControls } from "./workshop-controls.mjs";
import { WORKSHOP_CANDIDATE_SHA } from "./workshop-policy.mjs";
import { workshopSummary } from "./workshop-public.mjs";

if (process.argv.includes("--validate-imports")) process.exit(0);
const root = fileURLToPath(new URL("../../..", import.meta.url));
const output = resolve(
  process.env.WORKSHOP_PUBLIC_OUTPUT ?? join(tmpdir(), "mmp008b-public"),
);
mkdirSync(output, { recursive: true });
process.umask(0o077);
const parent = mkdtempSync(join(tmpdir(), "mmp008b-private-"));
chmodSync(parent, 0o700);
let serial = 0,
  phase = "admission",
  failure;
const provenance = new PrivateEvidence(parent, root, {
  headSha: process.env.PILOT_HEAD_SHA,
  source: SOURCE,
});
const record = (kind, value) =>
  provenance.write(`proof-${++serial}-${kind}`, value);
const ledger = new Resources(join(parent, "resources.json"), record);
const signal = AbortSignal.timeout(18 * 60 * 1000);
const aborted = new AbortController();
const stop = () => aborted.abort();
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
const workSignal = AbortSignal.any([signal, aborted.signal]);
let activeTarget, activePhp, activeTransport, activeState;
const runs = [],
  quota = [];
let controls;
try {
  const headSha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  requireCheck(
    headSha === process.env.PILOT_HEAD_SHA && /^[a-f0-9]{40}$/.test(headSha),
    "HEAD_IDENTITY",
  );
  phase = "prepare-images";
  const phpCommand = dockerCommand(provenance);
  const trackedPhp = (args, ...rest) => {
    ledger.track(args);
    return phpCommand(args, ...rest);
  };
  const directory = mkdtempSync(join(parent, "source-"));
  const php = await provisionRuntime({
    command: trackedPhp,
    directory,
    oracleRoot: join(root, "packages/oracle"),
    signal: workSignal,
    evidence: provenance,
  });
  chmodSync(php.archivePath, 0o444);
  const runtime = await buildTrustedRuntime(async (name, receipt) =>
    record("runtime", { name, receipt }),
  );
  const bundle = await admitDirectory(
    join(root, "packages/target-worker/fixtures/workshop"),
    WORKSHOP_CANDIDATE_SHA,
  );
  record("candidate", { candidateSha: bundle.candidateSha });
  phase = "quota-controls";
  for (const mode of ["aux", "wal"]) {
    const worker = new TargetWorker(runtime, bundle, "fixed-experiment", {
      profile: WORKSHOP_PROFILE,
    });
    activeTarget = worker;
    ledger.target(worker.runId);
    await worker.provision(workSignal);
    const deadline = worker.endsAt;
    const mount = requireSuccess(
      await worker.cmd(["volume", "inspect", worker.runtime.volume], {
        signal: workSignal,
      }),
    );
    record("quota-mount", mount);
    const receipt = requireSuccess(
      await worker.cmd(
        ["exec", worker.runtime.name, "node", "/opt/worker/quota.mjs", mode],
        { signal: workSignal },
      ),
    );
    record("quota", receipt);
    const observed = strictJson(receipt.stdout);
    requireCheck(
      observed.mode === mode &&
        observed.totalBytes === 16777216 &&
        observed.type === "tmpfs" &&
        observed.code === (mode === "aux" ? "ENOSPC" : "SQLITE_FULL"),
      "QUOTA_CONTROL",
    );
    await worker.snapshot("after-quota", workSignal);
    await worker.reset("quota-clean-reset", workSignal);
    requireCheck(worker.endsAt === deadline, "LIFETIME_RENEWED");
    await worker.snapshot("after-clean-reset", workSignal);
    await worker.close();
    record("quota-worker", worker.evidence);
    requireCheck(worker.evidence.cleanupVerified, "CLEANUP_ERROR");
    activeTarget = undefined;
    quota.push({ ...observed, cleanup: "VERIFIED_ZERO_RESOURCES" });
  }
  controls = await workshopControls(runtime, ledger, record, workSignal);
  for (let pass = 1; pass <= 2; pass++)
    for (const scenario of MANIFEST) {
      phase = `${scenario.id}-pass-${pass}`;
      process.env.PILOT_PRIVATE_PARENT = join(
        parent,
        `pair-${pass}-${scenario.id}`,
      );
      const state = privateRun(root, {
        headSha,
        candidateSha: bundle.candidateSha,
        scenarioId: scenario.id,
        pass,
      });
      activeState = state;
      let n = 0;
      const pairRecord = (kind, value) =>
        state.bridge.write(`pair-${++n}-${kind}`, value);
      const worker = new TargetWorker(runtime, bundle, "fixed-experiment", {
        profile: WORKSHOP_PROFILE,
      });
      ledger.target(worker.runId);
      const target = new TargetOracleAdapter(worker, [scenario], {
        record: pairRecord,
      });
      activeTarget = target;
      await target.provision(workSignal);
      const clock = requireSuccess(
        await worker.cmd(
          [
            "exec",
            ...FIXED_ENV,
            worker.runtime.name,
            "node",
            "/opt/worker/clock.mjs",
          ],
          { signal: workSignal },
        ),
      );
      pairRecord("clock", clock);
      validateTargetClock(strictJson(clock.stdout));
      const commandPhp = dockerCommand(state.php);
      const transport = new DockerReferenceTransport(php, (args, ...rest) => {
        ledger.track(args);
        return commandPhp(args, ...rest);
      });
      activeTransport = transport;
      const reference = new PhpReferenceWorker(transport, state.php, [
        scenario.id,
      ]);
      activePhp = reference;
      const result = await verifyPair({
        reference,
        candidate: target,
        scenarios: [scenario],
        artifactParent: state.oracleParent,
        operationTimeoutMs: 30000,
      });
      const actual = retainOracle(result, state.oracleParent, state.bridge);
      pairRecord("completion", {
        result,
        workerEvidence: worker.evidence,
        failure: target.failure,
      });
      // verifyPair closes both sides; independently verify again and inspect actual inventory.
      await reference.close(AbortSignal.timeout(15000));
      await target.close(AbortSignal.timeout(15000));
      const inventory = await ledger.inventory();
      requireCheck(
        !inventory.containers.length &&
          !inventory.volumes.length &&
          worker.evidence.cleanupVerified,
        "CLEANUP_ERROR",
      );
      pairRecord("inventory", inventory);
      const phpPackSha = state.php.seal(),
        bridgePackSha = state.bridge.seal();
      PrivateEvidence.verify(state.php.path, phpPackSha);
      PrivateEvidence.verify(state.bridge.path, bridgePackSha);
      runs.push({
        pass,
        scenarioId: scenario.id,
        gates: actual.gates.map((g) => ({
          gate: g.gate,
          verdict: g.verdict,
          executedTestIds: g.executedTestIds,
          findingCodes: [...new Set(g.findings.map((f) => f.code))],
        })),
        phpPackSha,
        bridgePackSha,
        cleanup: "VERIFIED_ZERO_RESOURCES",
        counts: {
          targetResets: worker.resetCount,
          targetRequests: target.stats.requests,
          targetSnapshots: target.stats.snapshots,
          readiness: worker.evidence.readiness.length,
        },
      });
      activeTarget = activePhp = activeTransport = activeState = undefined;
    }
  phase = "publication";
  const summary = workshopSummary({
    headSha,
    candidateSha: bundle.candidateSha,
    phpImage: php.imageId,
    targetImage: runtime.imageId,
    recipeSha: runtime.provenance.recipeSha,
    runs,
    quota,
    controls,
  });
  atomicJson(join(output, "summary.json"), summary, 0o644);
  requireCheck(
    summary.coverage === "ALL_17_PUBLIC_STEPS_PER_PASS",
    "WORKSHOP_PARITY_NOT_ESTABLISHED",
  );
} catch (e) {
  failure = e;
  record("failure", { phase, code: e.code, message: String(e.stack ?? e) });
} finally {
  const close = await Promise.allSettled([
    activeTarget?.close(AbortSignal.timeout(20000)),
    activePhp?.close(AbortSignal.timeout(20000)),
    activeTransport?.close(),
  ]);
  let cleanup = "ERROR";
  try {
    const inventory = await ledger.reap();
    requireCheck(
      close.every((r) => r.status === "fulfilled") &&
        !inventory.before.containers.length &&
        !inventory.before.volumes.length,
      "CLEANUP_ERROR",
    );
    cleanup = "VERIFIED_ZERO_RESOURCES";
  } catch (e) {
    failure ??= e;
  }
  if (activeState) {
    try {
      record("failed-pair", { targetFailure: activeTarget?.failure });
    } catch {}
  }
  try {
    const hash = provenance.seal();
    PrivateEvidence.verify(provenance.path, hash);
    atomicJson(
      join(output, "completion.json"),
      {
        headSha: process.env.PILOT_HEAD_SHA,
        provenancePackSha: hash,
        cleanup,
        status: failure ? "ERROR" : "PASS_SCOPED",
        externalRetention: "EXTERNAL_RETENTION_NOT_RUN",
      },
      0o644,
    );
  } catch (e) {
    failure ??= e;
  }
  if (failure) {
    const allowed = new Set([
      "HEAD_IDENTITY",
      "QUOTA_CONTROL",
      "LIFETIME_RENEWED",
      "CLEANUP_ERROR",
      "BUILD_FAILED",
      "ENVIRONMENT_ERROR",
      "TIMEOUT",
      "RUNTIME_FAILED",
      "OBSERVATION_ERROR",
      "CLOCK_PARITY_BLOCKED",
      "WORKSHOP_PARITY_NOT_ESTABLISHED",
      "TARGET_OPERATION_ERROR",
      "ORACLE_MANIFEST",
      "PRIVATE_LIMIT",
      "CANCELLED",
    ]);
    atomicJson(
      join(output, "error.json"),
      {
        status: "ERROR",
        phase,
        code: allowed.has(failure.code) ? failure.code : "WORKSHOP_ERROR",
        cleanup,
        gates: runs.map((r) => ({
          scenarioId: r.scenarioId,
          pass: r.pass,
          gates: r.gates,
        })),
        externalRetention: "EXTERNAL_RETENTION_NOT_RUN",
      },
      0o644,
    );
    console.error(`WORKSHOP_PROOF_ERROR phase=${phase}; cleanup=${cleanup}`);
    process.exitCode = 1;
  } else
    console.log(
      "Real PHP/TS workshop scoped proof completed: two clean passes; all public scenario G2/G3 PASS; G4 held-out INCONCLUSIVE; zero resources.",
    );
  process.removeListener("SIGTERM", stop);
  process.removeListener("SIGINT", stop);
}
