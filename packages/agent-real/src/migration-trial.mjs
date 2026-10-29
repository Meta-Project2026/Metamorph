import { randomUUID } from "node:crypto";
import { runAgent } from "@metamorph/agent";
import { insist, isMigrationContext } from "./migration-context.mjs";
import { createProductionMigrationProvider } from "./migration-provider.mjs";
import { publicAttempt } from "./report.mjs";
import { createEnvironment, RealVerifier } from "./runtime.mjs";
import { createSourceSession } from "./source.mjs";

/** Missing admission is a first-class result before filesystem/worker effects.
 * Keep production construction here: callers cannot inject a synthetic provider
 * or override a paid bound to turn a unit harness into an inference claim. */
export async function runPublicMigration({
  context,
  selection = "none",
  root,
  parent,
  headSha,
  config,
  signal,
}) {
  insist(isMigrationContext(context), "SOURCE_IDENTITY");
  insist(/^[a-f0-9]{40}$/.test(headSha), "HEAD_IDENTITY");
  const selected = createProductionMigrationProvider(context, selection);
  const result = {
    format: "mmp061-public-trial-v1",
    headSha,
    sourceSha: context.sourceSha,
    sourceArchiveSha256: context.sourceArchiveSha256,
    contextSha256: context.contextSha256,
    manifestSha256: context.manifestSha256,
    provider: selected.status.provider,
    modelId: selected.status.modelId,
    budgetAuth: "NOT_ADMITTED",
    admittedMaxRequestCostUsd: null,
    modelGeneration: "NOT_RUN",
    publicG1: "NOT_RUN",
    publicG2: "NOT_RUN",
    publicG3: "NOT_RUN",
    G0: "INCONCLUSIVE",
    G4: "INCONCLUSIVE",
    product: "NOT_ESTABLISHED",
    trialRunId: null,
    candidateSha: null,
    totalCostUsd: null,
    generatedRequests: 0,
    attempts: [],
    cleanup: {
      status: "NOT_RUN",
      containers: null,
      volumes: null,
      emergencyRemoved: null,
    },
    blockers: [selected.status.code],
  };
  if (!selected.status.admitted) return result;
  // Deliberately dormant until a reviewed production provider can issue genuine
  // admission. There is no runtime flag or config number that can reach this path.
  insist(
    process.platform === "linux" && config && signal,
    "LINUX_ADMISSION_REQUIRED",
  );
  let environment;
  let verifier;
  try {
    environment = createEnvironment(root, parent, headSha);
    await environment.prepare(signal);
    const session = createSourceSession(parent);
    verifier = new RealVerifier(environment, session);
    const run = await runAgent({
      runId: `mmp061-${randomUUID()}`,
      config,
      benchmark: context.benchmark(),
      provider: selected.provider,
      writer: session.writer,
      verifier,
      signal,
    });
    await verifier.waitForIdle();
    environment.record("model-run", run);
    result.attempts = verifier.attempts.map(publicAttempt);
    // A future live admission must supply correlated model receipts and budget
    // settlement here before this scaffold can claim MODEL_GENERATION PASS.
    result.blockers = ["LIVE_RECEIPT_ADMISSION_NOT_IMPLEMENTED"];
  } finally {
    await verifier?.waitForIdle();
    const completion = await environment?.finish();
    if (completion)
      result.cleanup = {
        status: completion.cleanup,
        ...completion.inventory,
        emergencyRemoved: completion.emergencyRemoved,
      };
  }
  return result;
}
