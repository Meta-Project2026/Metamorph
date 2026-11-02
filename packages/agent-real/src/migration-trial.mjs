import { ModelResponseSchema } from "@metamorph/agent";
import { admitDirectory } from "../../target-worker/src/admission.mjs";
import { captureLease } from "./custody-capture.mjs";
import {
  consumeOraclePermit,
  custodyVerificationLink,
} from "./custody-checkpoint.mjs";
import { beginCustody } from "./custody-contract.mjs";
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
  parent,
  headSha,
  signal,
  authorization,
  checkpoint,
}) {
  insist(isMigrationContext(context), "SOURCE_IDENTITY");
  insist(/^[a-f0-9]{40}$/.test(headSha), "HEAD_IDENTITY");
  const selected = createProductionMigrationProvider(
    context,
    selection,
    authorization,
    checkpoint,
  );
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
    aiGeneration: "AI_GENERATION_NOT_RUN",
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
  insist(headSha === selected.status.authorization.headSha, "HEAD_IDENTITY");
  // Separate explicit estimate policy. Never pass an estimate as the guaranteed
  // dollar-bound required by legacy runAgent/ModelProvider. Shared API unchanged.
  result.format = "mmp078-public-paid-trial-v1";
  result.budgetAuth = selected.status.authorization;
  result.admittedMaxEstimatedRequestCostUsd =
    selected.status.maxEstimatedRequestCostUsd;
  result.trialRunId = selected.status.authorization.runId;
  result.blockers = [];
  const session = createSourceSession(parent);
  const custodyAttempt = beginCustody(context, authorization);
  try {
    const response = ModelResponseSchema.parse(
      await selected.provider.generate(
        {
          unitId: "workshop-api",
          tier: "spark",
          action: "generate",
          attempt: 1,
          repairFeedback: null,
        },
        signal,
      ),
    );
    await session.writer.write(response.changes, signal);
    const lease = await session.acquire(session.writer.root, signal);
    result.candidateSha = lease.bundle.candidateSha;
    insist(
      result.candidateSha === selected.receipts()[0]?.candidateSha,
      "SOURCE_IDENTITY",
    );
    let custody,
      captureFailed = false;
    try {
      custody = await captureLease(
        custodyAttempt,
        lease,
        selected.receipts()[0],
        signal,
      );
    } catch {
      captureFailed = true;
    } finally {
      await lease.release();
    }
    result.modelGeneration = "GENERATED";
    result.aiGeneration = "REAL_INFERENCE_GENERATED";
    if (captureFailed) {
      result.blockers = ["CUSTODY_CAPTURE_FAILED"];
      return result;
    }
    result.custody = custody;
    result.blockers = ["PUBLIC_DOCKER_VALIDATION_PENDING"];
    Object.defineProperty(result, "candidateRoot", {
      value: session.writer.root,
    });
  } catch (error) {
    result.modelGeneration = "ERROR";
    result.aiGeneration = "REAL_INFERENCE_ERROR";
    result.blockers = [
      selected.receipts()[0]?.code ??
        (error.code === "SOURCE_IDENTITY"
          ? "SOURCE_IDENTITY"
          : "GENERATION_OR_WRITE_ERROR"),
    ];
  } finally {
    await selected.waitForIdle();
    result.modelReceipts = selected.receipts();
    result.generatedRequests = result.modelReceipts.reduce(
      (n, r) => n + r.attemptedRequests,
      0,
    );
    result.estimatedCostUsd = result.modelReceipts[0]?.estimatedCostUsd ?? null;
    result.chargedCostUsd = null;
    result.totalCostUsd = null;
  }
  return result;
}

// Only the paid production path uses this wrapper. Original deterministic offline
// validation remains available without disguising its fixture as model generation.
export async function validateCustodiedMigration(options, permit) {
  const custodyIdentity = consumeOraclePermit(permit, {
    candidateSha: options.candidateSha,
    headSha: options.headSha,
    sourceSha: options.context.sourceSha,
  });
  const result = await validateGeneratedMigration(options);
  return {
    ...result,
    custodyLink: custodyVerificationLink(
      custodyIdentity,
      result.attempts.map((a) => a.attemptId),
    ),
  };
}

/** Fresh process after the secret-bearing step. No provider or credentials here.
 * Only the original restricted writer and independent network-off Docker verifier
 * may execute this candidate. All gates/coverage/finalizers retain their meaning. */
export async function validateGeneratedMigration({
  context,
  root,
  parent,
  headSha,
  candidateRoot,
  candidateSha,
  signal,
}) {
  insist(
    !process.env.MODEL_API_KEY && process.platform === "linux",
    "CREDENTIAL_ISOLATION",
  );
  insist(
    isMigrationContext(context) && /^[a-f0-9]{40}$/.test(headSha),
    "SOURCE_IDENTITY",
  );
  const candidate = await admitDirectory(candidateRoot, candidateSha);
  const session = createSourceSession(parent);
  await session.writer.write(
    candidate.files.map(({ path, content }) => ({ path, content })),
    signal,
  );
  const result = {
    candidateSha,
    attempts: [],
    publicG1: "NOT_RUN",
    publicG2: "NOT_RUN",
    publicG3: "NOT_RUN",
    G0: "INCONCLUSIVE",
    G4: "INCONCLUSIVE",
    product: "NOT_ESTABLISHED",
    blockers: [],
    cleanup: {
      status: "NOT_RUN",
      containers: null,
      volumes: null,
      emergencyRemoved: null,
    },
  };
  let environment;
  let verifier;
  try {
    environment = createEnvironment(root, parent, headSha);
    await environment.prepare(signal);
    verifier = new RealVerifier(environment, session);
    const report = await verifier.verify(session.writer.root, signal);
    await verifier.waitForIdle();
    result.attempts = verifier.attempts.map(publicAttempt);
    for (const gate of ["G1", "G2", "G3"])
      result[`public${gate}`] =
        report.results.find((g) => g.gate === gate)?.verdict ?? "INCONCLUSIVE";
    result.blockers = [
      ...new Set(
        report.results
          .filter((g) => ["G1", "G2", "G3"].includes(g.gate))
          .flatMap((g) => g.findings.map((f) => f.code)),
      ),
    ];
  } catch {
    result.blockers = ["PUBLIC_DOCKER_ERROR"];
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
