// Existing MMP-010A SourceSession / RealVerifier / runAgent, new explicit source replay.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { runAgent } from "../../packages/agent/dist/index.js";
import { publicAttempt } from "../../packages/agent-real/src/report.mjs";
import {
  createEnvironment,
  RealVerifier,
} from "../../packages/agent-real/src/runtime.mjs";
import { createSourceSession } from "../../packages/agent-real/src/source.mjs";
import {
  MANIFEST,
  NORMALIZATION_VERSION,
  SOURCE,
} from "../../packages/oracle/dist/index.js";
import { admitDirectory } from "../../packages/target-worker/src/admission.mjs";
import { git, root, verifyPins } from "../mmp-044/config.mjs";
import { atomic } from "../mmp-044/finalize.mjs";
import { correctedReplay } from "./replay.mjs";

process.umask(0o077);
const parent = process.env.MMP049_AGENT_PARENT;
const output = process.env.MMP049_OUTPUT;
mkdirSync(parent, { mode: 0o700 });
const headSha = git("rev-parse", "HEAD").toString().trim();
const abort = new AbortController();
const stop = () => abort.abort();
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
const timer = setTimeout(stop, 12 * 60 * 1000);
const signal = abort.signal;
let context;
let verifier;
const summary = {
  format: "mmp049-corrected-agent-v1",
  headSha,
  status: "ERROR",
  errorCode: null,
  attempts: [],
  usage: [],
  completion: null,
  agentVerdict: "NOT_RUN",
  aiGeneration: "AI_GENERATION_NOT_RUN",
  paidCalls: 0,
  product: "NOT_ESTABLISHED",
  G0: "INCONCLUSIVE",
  G4: "INCONCLUSIVE",
};
try {
  assert.equal(headSha, process.env.MMP049_HEAD_SHA);
  verifyPins();
  git("diff", "--exit-code", "HEAD");
  const metadata = JSON.parse(
    readFileSync(join(root, "specs/016-candidate-compat/candidate.json")),
  );
  const bundle = await admitDirectory(
    join(root, metadata.path),
    metadata.candidateSha256,
  );
  context = createEnvironment(root, parent, headSha);
  await context.prepare(signal);
  // The unchanged broker joins its own provenance cleanup before returning.
  // Subsequent stage cleanup uses only this job's explicit worker prefixes.
  context.ledger.names.prefixes = context.ledger.names.prefixes.filter(
    (p) => p !== "mmp007-provenance-",
  );
  context.ledger.persist();
  const session = createSourceSession(mkdtempSync(join(parent, "candidate-")));
  verifier = new RealVerifier(context, session);
  const result = await runAgent({
    runId: `mmp049-agent-${randomUUID()}`,
    writer: session.writer,
    provider: correctedReplay(bundle),
    verifier,
    signal,
    config: {
      benchmarkId: "public-workshop-compat-v1",
      strategy: "spark-only",
      maxRepairsPerUnit: 1,
      maxEscalations: 0,
      maxModelSpendUsd: 1,
      timeoutSeconds: 600,
    },
    benchmark: {
      id: "public-workshop-compat-v1",
      sourceRepo: `https://github.com/${SOURCE.repository}`,
      sourceCommit: SOURCE.commit,
      license: "MIT",
      phpRuntime: "7.4.33",
      scenarioIds: MANIFEST.map((s) => s.id),
      migrationUnitIds: ["workshop"],
      normalizationVersion: NORMALIZATION_VERSION,
    },
  });
  await verifier.waitForIdle();
  context.record("agent-result", result);
  summary.attempts = verifier.attempts.map(publicAttempt);
  summary.usage = result.events
    .filter((e) => e.type === "model-usage")
    .map((e) => e.usage);
  summary.agentVerdict = result.verdict;
  summary.agentReason = result.reason;
  summary.knownModelSpendUsd = result.knownModelSpendUsd;
  summary.totalModelSpendUsd = result.totalModelSpendUsd;
  summary.admissionSpendLimitUsd = 1;
  summary.phpImageId = context.php.imageId;
  summary.targetImageId = context.runtime.imageId;
  assert.equal(result.verdict, "INCONCLUSIVE");
  assert.equal(result.reason, "VERIFIER_INCONCLUSIVE");
  for (const spend of [
    result.knownModelSpendUsd,
    result.totalModelSpendUsd,
    result.reservedModelSpendUsd,
  ])
    assert.equal(spend, 0);
  assert.equal(summary.attempts.length, 2);
  assert.equal(summary.usage.length, 2);
  for (const [i, usage] of summary.usage.entries()) {
    assert.equal(usage.provider, "offline-deterministic-replay");
    assert.equal(usage.modelId, "public-workshop-compat-v1-replay");
    assert.equal(usage.requestId, `mmp049-offline-${i + 1}`);
    assert.equal(usage.estimatedCostUsd, 0);
    for (const key of ["inputTokens", "outputTokens", "cachedInputTokens"])
      assert.equal(usage[key], null);
  }
  const [broken, fixed] = summary.attempts;
  assert.notEqual(broken.candidateSha, fixed.candidateSha);
  assert.equal(fixed.candidateSha, bundle.candidateSha);
  for (const attempt of summary.attempts) {
    assert.equal(attempt.coverage.http, 17);
    assert.equal(attempt.coverage.sqlite, 20);
    assert.equal(attempt.pairs.length, 3);
    assert.ok(
      attempt.pairs.every((p) => p.cleanup === "VERIFIED_ZERO_RESOURCES"),
    );
    for (const g of attempt.gates)
      assert.equal(
        g.verdict,
        ["G0", "G4"].includes(g.gate)
          ? "INCONCLUSIVE"
          : attempt === broken && ["G2", "G3"].includes(g.gate)
            ? "FAIL"
            : "PASS",
      );
  }
  summary.status = "PASS_SCOPED";
} catch (error) {
  summary.errorCode = signal.aborted ? "CANCELLED" : "AGENT_PROOF_CHECK_FAILED";
  console.error(error);
} finally {
  await verifier?.waitForIdle();
  try {
    summary.completion = await context?.finish();
    assert.equal(summary.completion?.cleanup, "VERIFIED_ZERO_RESOURCES");
    assert.equal(summary.completion.emergencyRemoved, 0);
  } catch {
    summary.status = "ERROR";
    summary.errorCode = "CLEANUP_ERROR";
  }
  clearTimeout(timer);
  process.removeListener("SIGINT", stop);
  process.removeListener("SIGTERM", stop);
  atomic(join(output, "agent.json"), summary);
}
assert.equal(summary.status, "PASS_SCOPED");
console.log(
  "Corrected offline Agent: original public defect FAIL -> repair public G1/G2/G3 PASS; Agent INCONCLUSIVE.",
);
