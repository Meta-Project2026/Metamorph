// Trusted host only. The per-run MAC key is original host state, never a provider
// credential, worker mount, artifact or public receipt. No generic signing port.
// Candidate code cannot execute here. Journal creation needs opaque paid admission;
// verification sealing runs the real verifier and consumes its in-process origin.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { admitDirectory, sha256 } from "../../target-worker/src/admission.mjs";
import {
  authenticatedArtifactMetadata,
  checkpointReady,
  consumeOraclePermit,
  finalizeCustody,
  requireStoredCheckpoint,
  verifiedReadback,
} from "./custody-checkpoint.mjs";
import {
  commitPrivate,
  privateDirectory,
  readRecord,
} from "./custody-files.mjs";
import {
  compilerRepairDecision,
  G1_RECOVERY_MODE,
  zeroResources,
} from "./g1-repair-eligibility.mjs";
import { consumeNativeResponseOrigin } from "./meta-migration.mjs";
import { paidAdmission, paidPreflight } from "./meta-paid-authorization.mjs";
import { insist, isMigrationContext } from "./migration-context.mjs";
import { readPrivateBytes, readPrivateJson } from "./private-diagnostics.mjs";

const capabilities = new WeakMap();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const requireFact = (v) => insist(v, "G1_REPAIR_NO_GO");
const journal = (env) => join(env.RUNNER_TEMP, "mmp180-g1");
const mac = (key, payload) =>
  createHmac("sha256", key).update(JSON.stringify(payload)).digest("hex");
function seal(directory, name, key, payload) {
  commitPrivate(
    join(directory, name),
    Buffer.from(JSON.stringify({ payload, mac: mac(key, payload) })),
    1024 * 1024,
  );
}
function unseal(directory, name, key) {
  const v = readPrivateJson(join(directory, name), 1024 * 1024).value;
  requireFact(
    Object.keys(v).sort().join() === "mac,payload" &&
      /^[a-f0-9]{64}$/.test(v.mac),
  );
  requireFact(
    timingSafeEqual(
      Buffer.from(v.mac, "hex"),
      Buffer.from(mac(key, v.payload), "hex"),
    ),
  );
  return v.payload;
}
function sourceIdentity(root) {
  requireFact(realpathSync(root) === root);
  const st = lstatSync(root);
  requireFact(
    st.isDirectory() &&
      !st.isSymbolicLink() &&
      st.uid === process.getuid() &&
      (st.mode & 0o077) === 0,
  );
  return { root, dev: st.dev, ino: st.ino };
}
function load(env) {
  requireFact(process.platform === "linux" && env.GITHUB_RUN_ATTEMPT === "1");
  const directory = journal(env);
  privateDirectory(directory);
  const key = readPrivateBytes(join(directory, "key"), 32);
  requireFact(key.length === 32);
  const plan = unseal(directory, "plan.json", key);
  requireFact(
    plan.authorization.runId === env.GITHUB_RUN_ID &&
      plan.authorization.headSha === env.GITHUB_SHA &&
      plan.authorization.actor === env.GITHUB_ACTOR &&
      plan.authorization.plan === G1_RECOVERY_MODE &&
      plan.runAttempt === "1" &&
      Date.now() >= plan.created &&
      Date.now() - plan.created < 35 * 60 * 1000,
  );
  return { directory, key, plan };
}
function noSecondAttempt(env) {
  // A partial/empty ledger/card counts as consumed, including a previous crash.
  for (const path of [
    `mmp078-${env.GITHUB_RUN_ID}-attempt-2.json`,
    `mmp154-${env.GITHUB_RUN_ID}-repair-preflight.json`,
    "meta-paid-public/preflight-repair.json",
    "meta-paid-public/generation-repair.json",
    "meta-paid-public/trial-repair.json",
  ])
    requireFact(!existsSync(join(env.RUNNER_TEMP, path)));
}

export function startG1Recovery(context, authorization, candidateRoot) {
  const auth = paidAdmission(authorization, context);
  requireFact(
    process.platform === "linux" &&
      auth.plan === G1_RECOVERY_MODE &&
      auth.attempt === 1,
  );
  const env = process.env,
    directory = journal(env);
  privateDirectory(directory, true);
  const key = randomBytes(32);
  commitPrivate(join(directory, "key"), key, 32);
  const plan = {
    authorization: auth,
    preflight: paidPreflight(authorization, context),
    runAttempt: "1",
    created: Date.now(),
    sourceLease: sourceIdentity(candidateRoot),
  };
  seal(directory, "plan.json", key, plan);
  let confirmed = false;
  return Object.freeze({
    confirm(receipt, custody) {
      requireFact(
        !confirmed &&
          receipt.authorization.bodySha256 === auth.bodySha256 &&
          receipt.authorization.runId === auth.runId &&
          receipt.status === "PASS" &&
          receipt.confirmedResponseCount === 1 &&
          receipt.candidateSha === custody.identity.candidateSha,
      );
      consumeNativeResponseOrigin(receipt, authorization);
      confirmed = true;
      requireFact(same(sourceIdentity(candidateRoot), plan.sourceLease));
      seal(directory, "generation.json", key, { receipt, custody });
    },
  });
}

// No caller-provided result/authenticator/runtime: this production wrapper runs
// the real credential-free verifier, then consumes its opaque completed origin.
export async function verifyG1RecoveryCandidate(options, permit) {
  const { validateCustodiedMigration, takeG1VerificationOrigin } = await import(
    "./migration-trial.mjs"
  );
  const result = await validateCustodiedMigration(options, permit);
  try {
    const origin = takeG1VerificationOrigin(result);
    const { directory, key, plan } = load(process.env);
    const generation = unseal(directory, "generation.json", key);
    requireFact(
      same(sourceIdentity(options.candidateRoot), plan.sourceLease) &&
        origin.candidateRoot === options.candidateRoot &&
        origin.candidateSha === generation.receipt.candidateSha &&
        same(result.custodyLink.identity, generation.custody.identity),
    );
    const stored = readRecord(
      join(process.env.RUNNER_TEMP, "mmp115-custody/stored.json"),
    );
    const independent = await finalizeCustody(origin.custodyIdentity);
    const independentCleanup = {
      status:
        independent.containers === 0 &&
        independent.volumes === 0 &&
        independent.emergencyRemoved === 0
          ? "VERIFIED_ZERO_RESOURCES"
          : "CLEANUP_ERROR",
      containers: independent.containers,
      volumes: independent.volumes,
      emergencyRemoved: independent.emergencyRemoved,
    };
    try {
      const bundle = await admitDirectory(
        options.candidateRoot,
        generation.receipt.candidateSha,
      );
      const decision = compilerRepairDecision(
        {
          plan: plan.preflight,
          generation: generation.receipt,
          verification: result,
          custody: stored,
          independentCleanup,
          firstTypecheckNormal: origin.firstTypecheckNormal,
        },
        bundle,
      );
      result.g1Recovery = {
        ...decision,
        authority: "NOT_AUTHORIZED_BY_THIS_REPORT",
      };
    } catch {
      result.g1Recovery = {
        kind: "NO_GO",
        feedback: null,
        authority: "NOT_AUTHORIZED_BY_THIS_REPORT",
      };
    }
    seal(directory, "verification.json", key, {
      result,
      stored,
      independentCleanup,
      firstTypecheckNormal: origin.firstTypecheckNormal,
    });
  } catch {
    // Keep the executed original G1/coverage/cleanup even if custody, settlement
    // or journal persistence fails. Missing authenticated proof can never repair.
    result.g1Recovery = {
      kind: "NO_GO",
      feedback: null,
      authority: "NOT_AUTHORIZED_BY_THIS_REPORT",
    };
  }
  return result;
}

async function revalidate(env, context, { afterCard = false } = {}) {
  requireFact(isMigrationContext(context));
  if (!afterCard) noSecondAttempt(env);
  else
    requireFact(
      !existsSync(
        join(env.RUNNER_TEMP, `mmp078-${env.GITHUB_RUN_ID}-attempt-2.json`),
      ),
    );
  const { directory, key, plan } = load(env);
  const g = unseal(directory, "generation.json", key);
  const v = unseal(directory, "verification.json", key);
  const card = plan.preflight,
    auth = plan.authorization;
  requireFact(
    auth.contextSha256 === context.contextSha256 &&
      auth.sourceSha === context.sourceSha &&
      auth.manifestSha256 === context.manifestSha256 &&
      sha256(
        readFileSync(
          new URL(
            "../../../.github/workflows/meta-paid-migration.yml",
            import.meta.url,
          ),
        ),
      ) === card.workflowSha256 &&
      same(sourceIdentity(plan.sourceLease.root), plan.sourceLease),
  );
  const bundle = await admitDirectory(
    plan.sourceLease.root,
    g.receipt.candidateSha,
  );
  // Current trial/transfer are checked against MAC-authenticated producer records,
  // not used to self-authenticate a receipt or grant a late plan upgrade.
  const output = join(env.RUNNER_TEMP, "meta-paid-public");
  const trial = readPrivateJson(join(output, "trial.json"), 1024 * 1024).value;
  const transfer = readPrivateJson(
    join(env.RUNNER_TEMP, "meta-paid-private/transfer.json"),
    65536,
  ).value;
  requireFact(
    trial.headSha === env.GITHUB_SHA &&
      trial.trialRunId === env.GITHUB_RUN_ID &&
      same(trial.budgetAuth, auth) &&
      same(trial.modelReceipts, [g.receipt]) &&
      trial.generatedRequests === 1 &&
      same(trial.custody, g.custody) &&
      transfer.candidateRoot === plan.sourceLease.root &&
      transfer.candidateSha === bundle.candidateSha &&
      Object.keys(v.result).every((k) => same(trial[k], v.result[k])),
  );
  const permit = requireStoredCheckpoint(env, g.custody.identity, 1, {
    allowCredentials: true,
  });
  const identity = consumeOraclePermit(permit, g.custody.identity);
  requireFact(same(identity, g.custody.identity));
  const spool = join(env.RUNNER_TEMP, "mmp115-custody");
  const stored = readRecord(join(spool, "stored.json"));
  requireFact(same(stored, v.stored));
  const proof = readRecord(join(spool, "transport.json"));
  // Fresh fixed-origin authenticated artifact metadata, expiry, run/head and
  // ciphertext readback are required again in the credentialed send process.
  const fresh = await authenticatedArtifactMetadata({
    ...env,
    MMP115_ARTIFACT_ID: proof.ack.artifactId,
  });
  const ready = checkpointReady(
    readRecord(join(spool, "capture.json")),
    readRecord(join(spool, "finalizer.json")),
    identity,
  );
  requireFact(
    same(
      verifiedReadback(
        ready,
        fresh.artifact,
        fresh.run,
        proof.ack,
        join(env.RUNNER_TEMP, "mmp115-readback"),
      ),
      stored,
    ),
  );
  const independent = await finalizeCustody(identity);
  requireFact(
    independent.containers === 0 &&
      independent.volumes === 0 &&
      independent.emergencyRemoved === 0 &&
      zeroResources(v.independentCleanup),
  );
  const decision = compilerRepairDecision(
    {
      plan: card,
      generation: g.receipt,
      verification: v.result,
      custody: stored,
      independentCleanup: v.independentCleanup,
      firstTypecheckNormal: v.firstTypecheckNormal,
    },
    bundle,
  );
  return { decision, bundle, auth, card, generation: g.receipt };
}

// Only this function can issue an opaque token, after authentic producer/lease,
// custody and independent cleanup revalidation. A JSON clone never works.
export async function requireG1RepairCapability(env, context) {
  const facts = await revalidate(env, context);
  const token = Object.freeze({});
  capabilities.set(token, {
    context,
    env: { ...env },
    facts,
    created: Date.now(),
    consumed: false,
  });
  return token;
}
export function g1CapabilityDetails(token, context) {
  const a = capabilities.get(token);
  requireFact(
    a &&
      a.context === context &&
      !a.consumed &&
      Date.now() >= a.created &&
      Date.now() - a.created < 60000,
  );
  return {
    feedback: a.facts.decision.feedback,
    previousChanges: a.facts.bundle.files.map(({ path, content }) => ({
      path,
      content,
    })),
    firstAttemptCandidateSha: a.facts.bundle.candidateSha,
    firstAttemptEstimatedUsd: a.facts.generation.estimatedCostUsd,
    firstAuthorization: structuredClone(a.facts.auth),
    firstPreflight: structuredClone(a.facts.card),
  };
}
export async function revalidateG1Capability(token, context) {
  const before = g1CapabilityDetails(token, context);
  const a = capabilities.get(token);
  const current = await revalidate(a.env, context, { afterCard: true });
  requireFact(
    same(current.decision, a.facts.decision) &&
      current.bundle.candidateSha === before.firstAttemptCandidateSha,
  );
  g1CapabilityDetails(token, context);
}
export function consumeG1Capability(token, context) {
  g1CapabilityDetails(token, context);
  capabilities.get(token).consumed = true; // synchronous, before reserve/send
}

// Credential-free proposal: reads authenticated sealed data only, never issues
// a token or uses network/credentials. The paid host revalidates independently.
export async function g1RecoveryProposal(env) {
  requireFact(!env.MODEL_API_KEY);
  noSecondAttempt(env);
  const { directory, key, plan } = load(env);
  const g = unseal(directory, "generation.json", key),
    v = unseal(directory, "verification.json", key);
  requireFact(same(sourceIdentity(plan.sourceLease.root), plan.sourceLease));
  const bundle = await admitDirectory(
    plan.sourceLease.root,
    g.receipt.candidateSha,
  );
  return compilerRepairDecision(
    {
      plan: plan.preflight,
      generation: g.receipt,
      verification: v.result,
      custody: v.stored,
      independentCleanup: v.independentCleanup,
      firstTypecheckNormal: v.firstTypecheckNormal,
    },
    bundle,
  );
}
