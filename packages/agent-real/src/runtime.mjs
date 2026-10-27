import { randomUUID } from "node:crypto";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
} from "node:fs";
import { basename, join, relative } from "node:path";
import {
  DockerReferenceTransport,
  dockerCommand,
  MANIFEST,
  MANIFEST_SHA256,
  PhpReferenceWorker,
  PrivateEvidence,
  provisionRuntime,
  SOURCE,
  verifyPair,
} from "@metamorph/oracle";
import { validateTargetClock } from "../../differential/src/clock.mjs";
import { retainOracle } from "../../differential/src/private-run.mjs";
import { Resources } from "../../differential/src/resources.mjs";
import { strictJson } from "../../differential/src/strict.mjs";
import { TargetOracleAdapter } from "../../differential/src/target-adapter.mjs";
import { WORKSHOP_PROFILE } from "../../target-worker/runtime/profile.mjs";
import { sha256 } from "../../target-worker/src/admission.mjs";
import {
  FIXED_ENV,
  requireSuccess,
  TargetWorker,
} from "../../target-worker/src/controller.mjs";
import { buildTrustedRuntime } from "../../target-worker/src/runtime-broker.mjs";
import { aggregateAttempt, safeCode, validatePublication } from "./report.mjs";
import { check, isSourceSession } from "./source.mjs";

export const MANIFEST_PIN =
  "d800a9a5e874545040438d4dce822da6e0d6b71fb094bcac7f06a6ad05610fd4";
export const RECIPE_PIN =
  "77f812f131f04073d0292b83e2d9ac2f8465e1c3eb82bff5cd5cf2aaf498a36c";
const readyEnvironments = new WeakSet();
const frozenSource = JSON.stringify(SOURCE);
const digest = (path) => sha256(readFileSync(path));

function policy(root) {
  check(
    MANIFEST_SHA256 === MANIFEST_PIN &&
      sha256(JSON.stringify(MANIFEST)) === MANIFEST_PIN &&
      JSON.stringify(SOURCE) === frozenSource,
    "ENVIRONMENT_ERROR",
  );
  check(
    Object.isFrozen(WORKSHOP_PROFILE) &&
      WORKSHOP_PROFILE.id === "car-workshop-v1" &&
      WORKSHOP_PROFILE.stateMiB === 16,
    "ENVIRONMENT_ERROR",
  );
  const directory = join(root, "packages/target-worker/runtime");
  const hashes = Object.fromEntries(
    readdirSync(directory)
      .filter(
        (name) =>
          /\.mjs$/.test(name) ||
          ["Dockerfile", "package.json", "package-lock.json"].includes(name),
      )
      .sort()
      .map((name) => [name, digest(join(directory, name))]),
  );
  check(sha256(JSON.stringify(hashes)) === RECIPE_PIN, "ENVIRONMENT_ERROR");
}

/** Construct before prepare so the caller can reap even failed image preparation.
 * This context and all paths are trusted host state; no provider input is accepted. */
export function createEnvironment(root, parent, headSha) {
  check(
    process.platform === "linux" && /^[a-f0-9]{40}$/.test(headSha),
    "ENVIRONMENT_ERROR",
  );
  policy(root);
  const provenance = new PrivateEvidence(parent, root, {
    headSha,
    source: SOURCE,
    manifestSha: MANIFEST_PIN,
  });
  let serial = 0;
  const record = (kind, value) =>
    provenance.write(`record-${++serial}-${kind}`, value);
  const ledger = new Resources(join(parent, "resources.json"), record);
  const sealed = [];
  const openPacks = new Set([provenance]);
  const context = {
    root,
    parent,
    headSha,
    ledger,
    record,
    sealed,
    async prepare(signal) {
      check(!readyEnvironments.has(context), "ENVIRONMENT_ERROR");
      signal.throwIfAborted();
      const command = dockerCommand(provenance);
      const directory = mkdtempSync(join(parent, "source-"));
      context.php = await provisionRuntime({
        command: (args, ...rest) => {
          ledger.track(args);
          return command(args, ...rest);
        },
        directory,
        oracleRoot: join(root, "packages/oracle"),
        signal,
        evidence: provenance,
      });
      chmodSync(context.php.archivePath, 0o444);
      context.inspectorSha = digest(context.php.inspectorPath);
      context.runtime = await buildTrustedRuntime(async (name, receipt) =>
        record("runtime", { name, receipt }),
      );
      signal.throwIfAborted();
      check(
        context.runtime.provenance.recipeSha === RECIPE_PIN,
        "ENVIRONMENT_ERROR",
      );
      readyEnvironments.add(context);
      context.check();
    },
    check() {
      check(readyEnvironments.has(context), "ENVIRONMENT_ERROR");
      policy(root);
      check(
        digest(context.php.archivePath) === SOURCE.archiveSha256 &&
          digest(context.php.inspectorPath) === context.inspectorSha &&
          context.php.baseImage === SOURCE.image,
        "ENVIRONMENT_ERROR",
      );
    },
    pack(directory, identity) {
      const pack = new PrivateEvidence(directory, root, identity);
      openPacks.add(pack);
      return pack;
    },
    seal(pack) {
      const hash = pack.seal();
      openPacks.delete(pack);
      PrivateEvidence.verify(pack.path, hash);
      sealed.push({ path: pack.path, sha256: hash });
      return {
        id: basename(pack.path),
        sha256: hash,
        reference: relative(parent, join(pack.path, "index.json"))
          .split("\\")
          .join("/"),
      };
    },
    async finish() {
      let inventory;
      let cleanupFailure;
      try {
        inventory = await ledger.reap();
      } catch (error) {
        cleanupFailure = error;
      }
      // Seal partially constructed/failed pairs even if resource inventory failed.
      for (const pack of openPacks) if (pack !== provenance) context.seal(pack);
      for (const pack of sealed) PrivateEvidence.verify(pack.path, pack.sha256);
      const pack = context.seal(provenance);
      if (cleanupFailure) throw cleanupFailure;
      // Emergency reaping recovers resources, but does not erase a cleanup defect.
      const clean =
        !inventory.before.containers.length && !inventory.before.volumes.length;
      return {
        cleanup: clean ? "VERIFIED_ZERO_RESOURCES" : "CLEANUP_ERROR",
        inventory: {
          containers: inventory.after.containers.length,
          volumes: inventory.after.volumes.length,
        },
        emergencyRemoved:
          inventory.before.containers.length + inventory.before.volumes.length,
        provenancePack: { id: pack.id, sha256: pack.sha256 },
      };
    },
  };
  return context;
}

/** verifyPair has its own operation signal. Compose it with the Agent deadline,
 * and reject a completed receipt if either signal expired while awaiting it.
 * Cleanup deliberately gets an independent bound. */
export function bindCancellation(worker, runSignal) {
  const call = async (method, args, signal) => {
    const combined = AbortSignal.any([runSignal, signal]);
    combined.throwIfAborted();
    const value = await worker[method](...args, combined);
    combined.throwIfAborted();
    return value;
  };
  return {
    reset: (signal) => call("reset", [], signal),
    request: (input, signal) => call("request", [input], signal),
    snapshot: (signal) => call("snapshot", [], signal),
    close: (signal) => worker.close(signal),
  };
}

export function buildReceipt(worker, scenarioId) {
  const receipt = worker.evidence.build;
  const result = {
    gate: "G1",
    verdict: "INCONCLUSIVE",
    executedTestIds: [],
    findingCodes: ["BUILD_NOT_RUN"],
  };
  if (!receipt) return result;
  // Only the trusted Docker build recipe can issue these phase receipts.
  check(
    receipt.args.includes("/opt/worker/build.mjs") &&
      receipt.args.includes(worker.image),
    "EVIDENCE_ERROR",
  );
  if (
    receipt.timedOut ||
    receipt.cancelled ||
    receipt.overflow ||
    receipt.spawnError
  )
    return {
      ...result,
      verdict: "ERROR",
      findingCodes: [
        receipt.timedOut
          ? "TIMEOUT"
          : receipt.cancelled
            ? "CANCELLED"
            : "ENVIRONMENT_ERROR",
      ],
    };
  if (![0, 2].includes(receipt.exitCode))
    return { ...result, verdict: "ERROR", findingCodes: ["ENVIRONMENT_ERROR"] };
  const output = strictJson(receipt.stdout, 4 * 1024 * 1024);
  check(
    Array.isArray(output.checks) &&
      output.checks.length >= 1 &&
      output.checks.length <= 2,
    "EVIDENCE_ERROR",
  );
  let failed = false;
  for (const [i, phase] of output.checks.entries()) {
    check(phase.phase === ["typecheck", "build"][i], "EVIDENCE_ERROR");
    if (phase.error || phase.signal || !Number.isInteger(phase.exitCode))
      return {
        ...result,
        verdict: "ERROR",
        findingCodes: ["ENVIRONMENT_ERROR"],
      };
    result.executedTestIds.push(`${scenarioId}:${phase.phase}`);
    if (phase.exitCode !== 0) failed = true;
  }
  if (failed)
    return { ...result, verdict: "FAIL", findingCodes: ["BUILD_FAILED"] };
  check(
    receipt.exitCode === 0 &&
      output.checks.length === 2 &&
      worker.evidence.buildChecks?.length === 2,
    "EVIDENCE_ERROR",
  );
  return { ...result, verdict: "PASS", findingCodes: [] };
}

async function runPair(context, lease, attemptId, scenario, signal) {
  const { bundle } = lease;
  const pairId = randomUUID();
  const pairRoot = join(context.parent, attemptId, pairId);
  mkdirSync(pairRoot, { mode: 0o700 });
  const identity = {
    headSha: context.headSha,
    attemptId,
    pairId,
    candidateSha: bundle.candidateSha,
    scenarioId: scenario.id,
  };
  const bridge = context.pack(pairRoot, identity);
  const phpPack = context.pack(pairRoot, identity);
  const oracleParent = join(pairRoot, "oracle-raw");
  mkdirSync(oracleParent, { mode: 0o700 });
  let serial = 0;
  const record = (kind, value) =>
    bridge.write(`pair-${++serial}-${kind}`, value);
  const worker = new TargetWorker(context.runtime, bundle, "fixed-experiment", {
    profile: WORKSHOP_PROFILE,
  });
  context.ledger.target(worker.runId);
  const target = new TargetOracleAdapter(worker, [scenario], { record });
  const command = dockerCommand(phpPack);
  const transport = new DockerReferenceTransport(
    context.php,
    (args, ...rest) => {
      context.ledger.track(args);
      return command(args, ...rest);
    },
  );
  const reference = new PhpReferenceWorker(transport, phpPack, [scenario.id]);
  let gates = [],
    failure = null,
    cleanup = "CLEANUP_ERROR",
    build;
  try {
    context.check();
    await lease.assertUnchanged();
    record("source", bundle);
    await target.provision(signal);
    const clock = requireSuccess(
      await worker.cmd(
        [
          "exec",
          ...FIXED_ENV,
          worker.runtime.name,
          "node",
          "/opt/worker/clock.mjs",
        ],
        { signal },
      ),
    );
    record("clock", clock);
    validateTargetClock(strictJson(clock.stdout));
    const result = await verifyPair({
      reference: bindCancellation(reference, signal),
      candidate: bindCancellation(target, signal),
      scenarios: [scenario],
      artifactParent: oracleParent,
      operationTimeoutMs: 30000,
    });
    const retained = retainOracle(result, oracleParent, bridge);
    gates = validatePublication(
      retained,
      scenario,
      basename(result.evidenceDirectory),
    );
    signal.throwIfAborted();
    check(worker.endsAt - worker.startedAt === 180000, "ENVIRONMENT_ERROR");
  } catch (error) {
    failure = signal.aborted ? "CANCELLED" : safeCode(error);
    record("failure", {
      code: failure,
      diagnostic: String(error.stack ?? error),
    });
  } finally {
    const closed = await Promise.allSettled([
      target.close(AbortSignal.timeout(20000)),
      reference.close(AbortSignal.timeout(20000)),
    ]);
    try {
      const inventory = await context.ledger.inventory();
      record("inventory", inventory);
      check(
        closed.every((r) => r.status === "fulfilled") &&
          worker.evidence.cleanupVerified &&
          !inventory.containers.length &&
          !inventory.volumes.length,
        "CLEANUP_ERROR",
      );
      cleanup = "VERIFIED_ZERO_RESOURCES";
    } catch {
      failure = "CLEANUP_ERROR";
    }
    try {
      build = buildReceipt(worker, scenario.id);
      await lease.assertUnchanged();
      context.check();
    } catch (error) {
      failure = safeCode(error);
    }
    record("completion", {
      workerEvidence: worker.evidence,
      targetFailure: target.failure,
      failure,
      cleanup,
      gates,
      build,
    });
  }
  // Build failures are observed candidate FAIL, while orchestration faults are ERROR.
  if (failure === "BUILD_FAILED" && build?.verdict === "FAIL") failure = null;
  return {
    ...identity,
    gates,
    build,
    cleanup,
    errorCode: failure,
    packs: [context.seal(phpPack), context.seal(bridge)],
  };
}

/** No synthetic runtime seam. External verdicts can only use a prepared context. */
export class RealVerifier {
  evidenceKind = "external";
  attempts = [];
  pending = null;
  constructor(context, session) {
    check(
      readyEnvironments.has(context) && isSourceSession(session),
      "ENVIRONMENT_ERROR",
    );
    this.context = context;
    this.session = session;
  }
  verify(root, signal) {
    check(!this.pending, "ENVIRONMENT_ERROR");
    const pending = this.execute(root, signal);
    this.pending = pending;
    pending
      .finally(() => {
        if (this.pending === pending) this.pending = null;
      })
      .catch(() => {});
    return pending;
  }
  async waitForIdle() {
    await this.pending?.catch(() => {});
  }
  async execute(root, signal) {
    const lease = await this.session.acquire(root, signal);
    const attempt = {
      attemptId: randomUUID(),
      candidateSha: lease.bundle.candidateSha,
      pairs: [],
      errorCode: null,
    };
    mkdirSync(join(this.context.parent, attempt.attemptId), { mode: 0o700 });
    try {
      for (const scenario of MANIFEST) {
        signal.throwIfAborted();
        const pair = await runPair(
          this.context,
          lease,
          attempt.attemptId,
          scenario,
          signal,
        );
        attempt.pairs.push(pair);
        if (pair.errorCode) {
          attempt.errorCode = pair.errorCode;
          break;
        }
        if (pair.gates.some((g) => g.verdict === "ERROR")) break;
        if (pair.build?.verdict === "FAIL") break;
      }
    } catch (error) {
      attempt.errorCode = signal.aborted ? "CANCELLED" : safeCode(error);
      this.context.record("attempt-error", {
        attemptId: attempt.attemptId,
        diagnostic: String(error.stack ?? error),
      });
    } finally {
      try {
        await lease.release();
      } catch {
        attempt.errorCode = "ADMISSION_REJECTED";
      }
    }
    if (signal.aborted) attempt.errorCode ??= "CANCELLED";
    const report = aggregateAttempt(attempt);
    this.context.record("attempt", { ...attempt, report });
    this.attempts.push(attempt);
    return report;
  }
}
