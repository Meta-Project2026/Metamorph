// Trusted evaluator only. No candidate/PHP execution or compilation on the host.
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DockerReferenceTransport,
  dockerCommand,
  MANIFEST,
  MANIFEST_SHA256,
  NORMALIZATION_VERSION,
  PrivateEvidence,
  provisionRuntime,
  SOURCE,
  verifyPair,
} from "@metamorph/oracle";
import { validateTargetClock } from "../../differential/src/clock.mjs";
import {
  atomicJson,
  retainOracle,
} from "../../differential/src/private-run.mjs";
import { Resources } from "../../differential/src/resources.mjs";
import { requireCheck, strictJson } from "../../differential/src/strict.mjs";
import { WORKSHOP_CANDIDATE_SHA } from "../../differential/src/workshop-policy.mjs";
import { WORKSHOP_PROFILE } from "../../target-worker/runtime/profile.mjs";
import { admitDirectory } from "../../target-worker/src/admission.mjs";
import {
  FIXED_ENV,
  requireSuccess,
  TargetWorker,
} from "../../target-worker/src/controller.mjs";
import { buildTrustedRuntime } from "../../target-worker/src/runtime-broker.mjs";
import { AuditReference, AuditTarget } from "./adapters.mjs";
import { DECLARED, digest, freezeCandidate, samplePrivate } from "./corpus.mjs";
import { publishFailure } from "./errors.mjs";
import { bounded, PairRegistry } from "./lifecycle.mjs";
import { gatesForPublic, publicSummary } from "./public.mjs";

if (process.argv.includes("--validate-imports")) process.exit(0);
process.umask(0o077);
const root = fileURLToPath(new URL("../../..", import.meta.url));
const output = resolve(
  process.env.AUDIT_PUBLIC_OUTPUT ?? join(tmpdir(), "workshop-audit-public"),
);
mkdirSync(output, { recursive: true });
const parent = mkdtempSync(join(tmpdir(), "mmp010b-private-"));
chmodSync(parent, 0o700);
const provenance = new PrivateEvidence(parent, root, {
  headSha: process.env.AUDIT_HEAD_SHA,
  scope: "MMP-010B",
});
let serial = 0;
const record = (kind, value) =>
  provenance.write(`audit-${++serial}-${kind}`, value);
const ledger = new Resources(join(parent, "resources.json"), record);
const abort = new AbortController(),
  stop = () => abort.abort();
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
const signal = AbortSignal.any([
  abort.signal,
  AbortSignal.timeout(20 * 60 * 1000),
]);
let phase = "freeze",
  failure,
  identity,
  sampleCommitment;
const runs = [],
  controls = {};
const finalFailures = [];
let summary, registry;
try {
  const headSha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  requireCheck(headSha === process.env.AUDIT_HEAD_SHA, "HEAD_IDENTITY");
  const bundle = await admitDirectory(
    join(root, "packages/target-worker/fixtures/workshop"),
    WORKSHOP_CANDIDATE_SHA,
  );
  phase = "runtime";
  const runtime = await buildTrustedRuntime(async (name, receipt) =>
    record("runtime", { name, receipt }),
  );
  const phpCmd = dockerCommand(provenance),
    directory = mkdtempSync(join(parent, "source-"));
  const php = await provisionRuntime({
    command: (args, ...rest) => {
      ledger.track(args);
      return phpCmd(args, ...rest);
    },
    directory,
    oracleRoot: join(root, "packages/oracle"),
    signal,
    evidence: provenance,
  });
  chmodSync(php.archivePath, 0o444);
  const sourceRoot = join(root, "packages/workshop-audit/src"),
    evaluatorSha = digest(
      readdirSync(sourceRoot)
        .filter((n) => n.endsWith(".mjs"))
        .sort()
        .map((name) => ({
          name,
          bytes: readFileSync(join(sourceRoot, name)).toString("base64"),
        })),
    );
  // All source/runtime/profile identity is fixed and atomically retained BEFORE
  // samplePrivate is allowed to draw any cryptographic random input values.
  identity = freezeCandidate(
    {
      headSha,
      candidateSha: bundle.candidateSha,
      sourceSha: SOURCE.archiveSha256,
      manifestSha: MANIFEST_SHA256,
      profile: WORKSHOP_PROFILE.id,
      recipeSha: runtime.provenance.recipeSha,
      phpImage: php.imageId,
      targetImage: runtime.imageId,
      normalization: NORMALIZATION_VERSION,
      evaluatorSha,
    },
    (receipt) => record("freeze", receipt),
  );
  const sampled = samplePrivate(identity);
  sampleCommitment = sampled.commitment;
  record("private-corpus", sampled);
  registry = new PairRegistry({
    parent,
    root,
    identity,
    inventory: () => ledger.inventory(),
    reap: () => ledger.reap(),
    record,
  });
  const execute = async (scenario, negative = false) => {
    const id = scenario.id,
      pair = registry.open(id);
    let worker,
      target,
      reference,
      actual,
      mutated = false;
    const receipt = (kind, value) => pair.receipt(kind, value);
    try {
      pair.create();
      const state = {
        bridge: pair.pack("bridge"),
        php: pair.pack("php"),
        oracleParent: pair.oracleParent,
      };
      worker = new TargetWorker(runtime, bundle, "fixed-experiment", {
        profile: WORKSHOP_PROFILE,
      });
      pair.captureExecution = () => ({
        targetStats: target?.stats ?? null,
        referenceStats: reference?.stats ?? null,
        workerEvidence: worker.evidence,
        negativeMutationApplied: mutated,
        executionComplete: pair.workComplete,
      });
      pair.closeWith("target", () => worker.close());
      ledger.target(worker.runId);
      target = new AuditTarget(worker, scenario, receipt);
      pair.closeWith("target", () => target.close());
      await pair.step("provision", (s) => target.provision(s), signal);
      await pair.step(
        "clock",
        async (s) => {
          const wall = requireSuccess(
            await worker.cmd(
              [
                "exec",
                ...FIXED_ENV,
                worker.runtime.name,
                "node",
                "/opt/worker/clock.mjs",
              ],
              { signal: s },
            ),
          );
          receipt("clock", wall);
          validateTargetClock(strictJson(wall.stdout));
        },
        signal,
      );
      await pair.step(
        "reference",
        async () => {
          const cmd = dockerCommand(state.php),
            transport = new DockerReferenceTransport(php, (args, ...rest) => {
              ledger.track(args);
              return cmd(args, ...rest);
            });
          pair.closeWith("reference", () => transport.close());
          reference = new AuditReference(transport, scenario, receipt);
          pair.closeWith("reference", () => reference.close());
        },
        signal,
      );
      const observedTarget = negative
        ? {
            reset: (s) => target.reset(s),
            snapshot: (s) => target.snapshot(s),
            close: (s) => target.close(s),
            request: async (input, s) => {
              const observed = await target.request(input, s);
              if (!mutated) {
                mutated = true;
                const corrupted = { ...observed, status: 503 };
                receipt("public-negative-wire-control", {
                  observed,
                  corrupted,
                });
                return corrupted;
              }
              return observed;
            },
          }
        : target;
      const result = await pair.step(
        "oracle",
        () =>
          verifyPair({
            reference,
            candidate: observedTarget,
            scenarios: [scenario],
            artifactParent: state.oracleParent,
            operationTimeoutMs: 30000,
          }),
        signal,
      );
      actual = await pair.step(
        "retention",
        () => retainOracle(result, state.oracleParent, state.bridge),
        signal,
      );
      receipt("completion", {
        result,
        targetStats: target.stats,
        referenceStats: reference.stats,
        workerEvidence: worker.evidence,
        negativeMutationApplied: mutated,
      });
      await pair.step(
        "coverage",
        () => {
          requireCheck(!negative || mutated, "NEGATIVE_CONTROL_NOT_EXECUTED");
          gatesForPublic(actual.gates, id, scenario.requests.length);
        },
        signal,
      );
      pair.workComplete = true;
    } catch (e) {
      if (!pair.primary) pair.fail("EVALUATOR_ERROR", e);
    } finally {
      await pair.finish();
    }
    if (pair.status !== "FINALIZED_PRIVATE_COMPLETE")
      throw Object.assign(new Error("PAIR_FAILED"), {
        code: pair.primary?.code ?? "EVALUATOR_ERROR",
      });
    return {
      id,
      steps: scenario.requests.length,
      gates: actual.gates,
      packSha: pair.pack("bridge").result.sha256,
      cleanup: "VERIFIED_ZERO_RESOURCES",
    };
  };
  phase = "public-controls";
  controls.positive = await execute({
    id: "audit-public-positive",
    requests: structuredClone(MANIFEST[0].requests),
  });
  controls.negative = await execute(
    {
      id: "audit-public-negative",
      requests: structuredClone(MANIFEST[0].requests),
    },
    true,
  );
  for (const [i, item] of sampled.scenarios.entries()) {
    phase = DECLARED[i].family;
    runs.push(await execute({ id: item.id, requests: item.requests }));
  }
  phase = "publication";
} catch (e) {
  failure = e;
  try {
    record("failure", { phase, diagnostic: String(e.stack ?? e) });
  } catch {}
} finally {
  try {
    await registry?.finishAll();
  } catch (e) {
    finalFailures.push("EVIDENCE_REGISTRY_ERROR");
    failure ??= e;
  }
  let cleanup,
    provenanceReceipt = { status: "ERROR", sha256: null };
  try {
    const inventory = await bounded(
      () => ledger.reap(),
      25000,
      "CLEANUP_TIMEOUT",
    );
    requireCheck(
      !inventory.before.containers.length &&
        !inventory.before.volumes.length &&
        !inventory.after.containers.length &&
        !inventory.after.volumes.length,
      "CLEANUP_ERROR",
    );
    requireCheck(
      !registry ||
        registry
          .publicState()
          .every((p) => p.cleanup === "VERIFIED_ZERO_RESOURCES"),
      "CLEANUP_ERROR",
    );
    cleanup = { containers: 0, volumes: 0, emergencyRemoved: 0 };
  } catch (e) {
    finalFailures.push("CLEANUP_ERROR");
    failure ??= e;
  }
  try {
    record("final-result", {
      phase,
      identity,
      sampleCommitment,
      runs,
      controls,
      cleanup,
      pairs: registry?.publicState(),
      failed: !!failure,
    });
    const provenancePackSha = provenance.seal();
    PrivateEvidence.verify(provenance.path, provenancePackSha);
    provenanceReceipt = { status: "VERIFIED", sha256: provenancePackSha };
    if (!failure) {
      requireCheck(registry?.complete, "EVIDENCE_REGISTRY_ERROR");
      summary = publicSummary({
        identity,
        sampleCommitment,
        runs,
        controls,
        cleanup,
        provenancePackSha,
      });
      atomicJson(join(output, "summary.json"), summary, 0o644);
    }
  } catch (e) {
    finalFailures.push("EVIDENCE_PROVENANCE_ERROR");
    failure ??= e;
  }
  if (failure) {
    process.exitCode = 1;
    // Error JSON construction is total and independent of raw gates. Filesystem
    // publication failure emits one fixed code only, never an uncaught stack.
    let pairs = [];
    try {
      pairs = registry?.publicState() ?? [];
    } catch {}
    publishFailure(join(output, "error.json"), {
      headSha: process.env.AUDIT_HEAD_SHA,
      phase,
      primaryCode: failure?.code,
      secondaryCodes: finalFailures,
      pairs,
      cleanup: cleanup ? "VERIFIED_ZERO_RESOURCES" : "ERROR",
      provenance: provenanceReceipt,
    });
  }
  process.removeListener("SIGTERM", stop);
  process.removeListener("SIGINT", stop);
}
