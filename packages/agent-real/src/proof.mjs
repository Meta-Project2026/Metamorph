// Trusted manual-only driver. Never import, typecheck or execute candidate on host.
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runAgent } from "@metamorph/agent";
import { ModelUsageSchema } from "@metamorph/contracts";
import { MANIFEST, NORMALIZATION_VERSION, SOURCE } from "@metamorph/oracle";
import { atomicJson } from "../../differential/src/private-run.mjs";
import {
  WORKSHOP_CONTROL_IDS,
  workshopControls,
} from "../../differential/src/workshop-controls.mjs";
import { WORKSHOP_CANDIDATE_SHA } from "../../differential/src/workshop-policy.mjs";
import { publicAttempt, safeCode } from "./report.mjs";
import {
  createEnvironment,
  MANIFEST_PIN,
  RECIPE_PIN,
  RealVerifier,
} from "./runtime.mjs";
import { check, createSourceSession, replayProvider } from "./source.mjs";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const output = resolve(
  process.env.AGENT_PUBLIC_OUTPUT ?? join(tmpdir(), "mmp010a-public"),
);
process.umask(0o077);
mkdirSync(output, { recursive: true });
const parent = mkdtempSync(join(tmpdir(), "mmp010a-private-"));
const shutdown = new AbortController();
const stop = () => shutdown.abort();
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
const signal = AbortSignal.any([
  shutdown.signal,
  AbortSignal.timeout(30 * 60 * 1000),
]);
let context,
  failure = null,
  completion = null;
const runs = [];
let runtimeControls = [];
try {
  const headSha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  check(headSha === process.env.AGENT_HEAD_SHA, "ENVIRONMENT_ERROR");
  context = createEnvironment(root, parent, headSha);
  await context.prepare(signal);
  console.log(
    "Trusted runtime preparation complete; starting new Agent evidence.",
  );
  for (const mode of ["known-good", "repair"]) {
    const sourceParent = mkdtempSync(join(parent, "candidates-"));
    const session = createSourceSession(sourceParent);
    const provider = await replayProvider(
      join(root, "packages/target-worker/fixtures/workshop"),
      mode,
    );
    const verifier = new RealVerifier(context, session);
    let result;
    try {
      result = await runAgent({
        runId: `agent-real-${randomUUID()}`,
        writer: session.writer,
        provider,
        verifier,
        signal,
        config: {
          benchmarkId: "public-workshop-composition",
          strategy: "spark-only",
          maxRepairsPerUnit: mode === "repair" ? 1 : 0,
          maxEscalations: 0,
          maxModelSpendUsd: 1,
          timeoutSeconds: 900,
        },
        benchmark: {
          id: "public-workshop-composition",
          sourceRepo: `https://github.com/${SOURCE.repository}`,
          sourceCommit: SOURCE.commit,
          license: "MIT",
          phpRuntime: "7.4.33",
          scenarioIds: MANIFEST.map((s) => s.id),
          migrationUnitIds: ["workshop"],
          normalizationVersion: NORMALIZATION_VERSION,
        },
      });
    } finally {
      // runAgent's timeout races ports; it does not join them. Mandatory here.
      await verifier.waitForIdle();
    }
    context.record("agent-result", { mode, result });
    const attempts = verifier.attempts.map(publicAttempt);
    const usage = result.events
      .filter((e) => e.type === "model-usage")
      .map((e) => ModelUsageSchema.parse(e.usage));
    check(
      usage.every(
        (u) =>
          u.provider === "offline-deterministic-replay" &&
          u.modelId === "public-workshop-source-replay-v1" &&
          /^offline-replay-[12]$/.test(u.requestId) &&
          u.estimatedCostUsd === 0 &&
          u.inputTokens === null &&
          u.outputTokens === null &&
          u.cachedInputTokens === null,
      ),
      "EVIDENCE_ERROR",
    );
    const reasons = new Set([
      "VERIFIER_INCONCLUSIVE",
      "VERIFIER_ERROR",
      "REPAIR_AND_ESCALATION_LIMIT",
      "PORT_OR_RESPONSE_ERROR",
      "TIMEOUT",
      "CANCELLED",
    ]);
    check(reasons.has(result.reason), "EVIDENCE_ERROR");
    runs.push({
      mode,
      agentVerdict: result.verdict,
      agentReason: result.reason,
      evidenceKind: result.evidenceKind,
      billing: "synthetic",
      admissionSpendLimitUsd: 1,
      paidCalls: 0,
      knownModelSpendUsd: result.knownModelSpendUsd,
      totalModelSpendUsd: result.totalModelSpendUsd,
      reservedModelSpendUsd: result.reservedModelSpendUsd,
      providerCalls: result.attempts.length,
      usage,
      attempts,
    });
    console.log(
      `Agent ${mode}: ${result.verdict}; attempts=${attempts.length}; public structural receipts retained.`,
    );
  }
  const controls = await workshopControls(
    context.runtime,
    context.ledger,
    context.record,
    signal,
  );
  check(controls.length === WORKSHOP_CONTROL_IDS.length, "EVIDENCE_ERROR");
  runtimeControls = controls.map((control, i) => {
    check(
      control.id === WORKSHOP_CONTROL_IDS[i] &&
        control.outcome === "PASS" &&
        control.cleanup === "VERIFIED_ZERO_RESOURCES",
      "EVIDENCE_ERROR",
    );
    return {
      id: WORKSHOP_CONTROL_IDS[i],
      outcome: "PASS",
      cleanup: "VERIFIED_ZERO_RESOURCES",
      execution: "REAL_DOCKER",
    };
  });
  const good = (a) =>
    a?.candidateSha === WORKSHOP_CANDIDATE_SHA &&
    a.coverage.http === 17 &&
    a.coverage.sqlite === 20 &&
    a.gates.every(
      (g) =>
        g.verdict === (["G0", "G4"].includes(g.gate) ? "INCONCLUSIVE" : "PASS"),
    );
  check(
    runs.every(
      (r) =>
        r.agentVerdict === "INCONCLUSIVE" &&
        r.totalModelSpendUsd === 0 &&
        r.knownModelSpendUsd === 0 &&
        r.reservedModelSpendUsd === 0,
    ),
    "EVIDENCE_ERROR",
  );
  check(
    runs[0].attempts.length === 1 && good(runs[0].attempts[0]),
    "EVIDENCE_ERROR",
  );
  const repair = runs[1].attempts;
  check(
    repair.length === 2 &&
      good(repair[1]) &&
      repair[0].candidateSha !== repair[1].candidateSha &&
      repair[0].coverage.http === 17 &&
      repair[0].coverage.sqlite === 20 &&
      ["G2", "G3"].every(
        (gate) =>
          repair[0].gates.find((g) => g.gate === gate)?.verdict === "FAIL",
      ),
    "EVIDENCE_ERROR",
  );
  const packs = runs.flatMap((r) =>
    r.attempts.flatMap((a) =>
      a.pairs.flatMap((p) => p.packs.map((pack) => pack.id)),
    ),
  );
  check(new Set(packs).size === packs.length, "EVIDENCE_ERROR");
} catch (error) {
  failure = safeCode(error);
  context?.record("proof-failure", {
    code: failure,
    diagnostic: String(error.stack ?? error),
  });
} finally {
  try {
    completion = await context?.finish();
    if (completion?.cleanup !== "VERIFIED_ZERO_RESOURCES")
      failure ??= "CLEANUP_ERROR";
  } catch {
    failure = "CLEANUP_ERROR";
  }
  atomicJson(
    join(output, "summary.json"),
    {
      format: "agent-workshop-composition-v1",
      headSha: process.env.AGENT_HEAD_SHA,
      status: failure ? "PARTIAL" : "PASS_SCOPED",
      errorCode: failure,
      source: SOURCE,
      manifestSha: MANIFEST_PIN,
      recipeSha: RECIPE_PIN,
      phpImage: context?.php?.imageId ?? null,
      targetImage: context?.runtime?.imageId ?? null,
      runs,
      runtimeControls,
      completion,
      aiGeneration: "AI_GENERATION_NOT_RUN",
      liveProvider: "NOT_RUN",
      product: "NOT_ESTABLISHED",
      externalRetention: "EXTERNAL_RETENTION_NOT_RUN",
    },
    0o644,
  );
  process.removeListener("SIGTERM", stop);
  process.removeListener("SIGINT", stop);
  if (failure) {
    console.error(`AGENT_COMPOSITION_PARTIAL code=${failure}`);
    process.exitCode = 1;
  } else
    console.log(
      "Agent composition scoped proof complete; G0/G4 remain INCONCLUSIVE; paid calls=0.",
    );
}
