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
  privateRun,
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
  activeTarget,
  activeReference,
  activeTransport,
  identity,
  sampleCommitment;
const runs = [],
  controls = {};
let summary;
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
  const execute = async (scenario, negative = false) => {
    const id = scenario.id;
    process.env.PILOT_PRIVATE_PARENT = join(parent, id);
    const state = privateRun(root, {
      identity,
      sampleCommitment,
      scenarioId: id,
    });
    let n = 0;
    const receipt = (kind, value) =>
      state.bridge.write(`pair-${++n}-${kind}`, value);
    const worker = new TargetWorker(runtime, bundle, "fixed-experiment", {
      profile: WORKSHOP_PROFILE,
    });
    ledger.target(worker.runId);
    const target = new AuditTarget(worker, scenario, receipt);
    activeTarget = target;
    await target.provision(signal);
    const wall = requireSuccess(
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
    receipt("clock", wall);
    validateTargetClock(strictJson(wall.stdout));
    const cmd = dockerCommand(state.php),
      transport = new DockerReferenceTransport(php, (args, ...rest) => {
        ledger.track(args);
        return cmd(args, ...rest);
      });
    activeTransport = transport;
    const reference = new AuditReference(transport, scenario, receipt);
    activeReference = reference;
    let mutated = false;
    // Real Docker traffic, independently checked first, then one deliberate
    // trusted status corruption. No comparator stub, replay, or candidate edit.
    const observedTarget = negative
      ? {
          reset: (s) => target.reset(s),
          snapshot: (s) => target.snapshot(s),
          close: (s) => target.close(s),
          request: async (input, s) => {
            const actual = await target.request(input, s);
            if (!mutated) {
              mutated = true;
              const corrupted = { ...actual, status: 503 };
              receipt("public-negative-wire-control", { actual, corrupted });
              return corrupted;
            }
            return actual;
          },
        }
      : target;
    const result = await verifyPair({
      reference,
      candidate: observedTarget,
      scenarios: [scenario],
      artifactParent: state.oracleParent,
      operationTimeoutMs: 30000,
    });
    const actual = retainOracle(result, state.oracleParent, state.bridge);
    receipt("completion", {
      result,
      targetStats: target.stats,
      referenceStats: reference.stats,
      workerEvidence: worker.evidence,
      negativeMutationApplied: mutated,
    });
    // All workers closed before sealing; complete Oracle catalog included.
    await reference.close();
    await target.close();
    const inventory = await ledger.inventory();
    requireCheck(
      !inventory.containers.length &&
        !inventory.volumes.length &&
        worker.evidence.cleanupVerified,
      "CLEANUP_ERROR",
    );
    receipt("inventory", inventory);
    const phpSha = state.php.seal();
    PrivateEvidence.verify(state.php.path, phpSha);
    receipt("verified-php-pack", { sha: phpSha });
    const packSha = state.bridge.seal();
    PrivateEvidence.verify(state.bridge.path, packSha);
    requireCheck(!negative || mutated, "NEGATIVE_CONTROL_NOT_EXECUTED");
    // Validate IDs now even if a later case fails; only counts/codes go public.
    gatesForPublic(actual.gates, id, scenario.requests.length);
    activeTarget = activeReference = activeTransport = undefined;
    return {
      id,
      steps: scenario.requests.length,
      gates: actual.gates,
      packSha,
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
  const closed = await Promise.allSettled([
    activeTarget?.close(),
    activeReference?.close(),
  ]);
  try {
    await activeTransport?.close();
  } catch (e) {
    failure ??= e;
  }
  let cleanup;
  try {
    const inventory = await ledger.reap();
    requireCheck(
      closed.every((r) => r.status === "fulfilled") &&
        !inventory.before.containers.length &&
        !inventory.before.volumes.length,
      "CLEANUP_ERROR",
    );
    cleanup = { containers: 0, volumes: 0, emergencyRemoved: 0 };
  } catch (e) {
    failure ??= e;
  }
  try {
    // Retain actual raw unpublished gates before seal; serializer reconstructs
    // public fields and cannot pass through raw or unrecognized diagnostics.
    record("final-result", {
      phase,
      identity,
      sampleCommitment,
      runs,
      controls,
      cleanup,
      failed: !!failure,
    });
    const provenancePackSha = provenance.seal();
    PrivateEvidence.verify(provenance.path, provenancePackSha);
    if (!failure) {
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
    failure ??= e;
  }
  if (failure) {
    // Fixed codes/family only. Never print exceptions, request values or paths.
    const safePhases = new Set([
      "freeze",
      "runtime",
      "public-controls",
      "publication",
      ...DECLARED.map((d) => d.family),
    ]);
    atomicJson(
      join(output, "error.json"),
      {
        format: "independent-workshop-audit-error-v1",
        headSha: /^[a-f0-9]{40}$/.test(process.env.AUDIT_HEAD_SHA ?? "")
          ? process.env.AUDIT_HEAD_SHA
          : null,
        verdict: "AUDIT_ERROR",
        phase: safePhases.has(phase) ? phase : "UNKNOWN",
        code: new Set([
          "HEAD_IDENTITY",
          "FREEZE_IDENTITY",
          "FREEZE_REQUIRED",
          "CORPUS_SHAPE",
          "CLEANUP_ERROR",
          "PUBLIC_COVERAGE",
          "INDEPENDENT_CONTROL",
          "BUILD_FAILED",
          "TIMEOUT",
          "ENVIRONMENT_ERROR",
        ]).has(failure.code)
          ? failure.code
          : "EVALUATOR_ERROR",
        identity: identity ? { ...identity } : null,
        completed: runs.map((r, i) => ({
          family: DECLARED[i].family,
          id: DECLARED[i].id,
          gates: gatesForPublic(r.gates, DECLARED[i].id, DECLARED[i].steps),
        })),
        cleanup: cleanup ? "VERIFIED_ZERO_RESOURCES" : "ERROR",
        canonicalG4: "INCONCLUSIVE",
        product: "NOT_ESTABLISHED",
        externalRetention: "EXTERNAL_RETENTION_NOT_RUN",
      },
      0o644,
    );
    process.exitCode = 1;
  }
  process.removeListener("SIGTERM", stop);
  process.removeListener("SIGINT", stop);
}
