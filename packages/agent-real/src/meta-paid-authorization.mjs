// A signed GitHub Actions identity issues an opaque, single-use capability.
// No exported constructor/test switch; host/admin control remains trusted.
import { execFileSync } from "node:child_process";
import { createHash, createPublicKey, verify } from "node:crypto";
import {
  closeSync,
  fsyncSync,
  openSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { G1_RECOVERY_MODE } from "./g1-repair-eligibility.mjs";
import {
  gate,
  META_OWNERS,
  META_REPOSITORY,
  validateWorkflowIdentity,
  verifyHostedMetaPolicy,
} from "./github-meta-guard.mjs";
import { META_STANDARD_TARIFF } from "./meta-tariff.mjs";
import {
  commitPreflight,
  generationPreflight,
  repairPreflight,
} from "./migration-preflight.mjs";

export const PAID_POLICY = Object.freeze({
  version: "mmp078-manual-paid-estimate-v1",
  tariff: META_STANDARD_TARIFF.version,
  tariffExpires: META_STANDARD_TARIFF.expires,
  inputPerMillion: META_STANDARD_TARIFF.inputPerMillion,
  cachedPerMillion: META_STANDARD_TARIFF.cachedPerMillion,
  outputPerMillion: META_STANDARD_TARIFF.outputPerMillion,
  maxOutputTokens: 16384,
  maxPromptBytes: 131072,
  // Text only, no tools/media/history. Count ALL serialized bytes (including
  // schema/escaping) at FOUR tokens per byte, plus 32768 framing tokens.
  // Deliberately conservative engineering projection, NOT an exact tokenizer
  // result or a guaranteed provider dollar cap. Meta-injected steering is unbilled.
  tokensPerSerializedByte: 4,
  protocolTokens: 32768,
  // Single source for the signed two-attempt plan's repair wire bound; the
  // synthetic REPAIR_POLICY derives the same value.
  repairWireBytes: 96 * 1024,
});
const admissions = new WeakMap();
let recoveryHost;
const admissionCodes = new Set([
  "BLOCKED_BUDGET_GUARANTEE",
  "MIGRATION_MODE_BLOCKED",
  "SOURCE_IDENTITY",
  "WORKFLOW_IDENTITY_BLOCKED",
  "ACTOR_BLOCKED",
  "PAID_CONFIRMATION_BLOCKED",
  "TARIFF_EXPIRED",
  "GITHUB_METADATA_UNVERIFIED",
  "PROTECTED_MAIN_BLOCKED",
  "ENVIRONMENT_POLICY_BLOCKED",
  "SIGNED_IDENTITY_BLOCKED",
  "ESTIMATED_BUDGET_BLOCKED",
  "INPUT_LIMIT",
  "PAID_DISPATCH_NOT_AUTHORIZED",
  "REQUEST_LIMIT",
]);
export const safePaidAdmissionCode = (error) =>
  admissionCodes.has(error?.code)
    ? error.code
    : "PAID_ADMISSION_OR_RUNTIME_BLOCKED";
const hash = (s) => createHash("sha256").update(s).digest("hex");
const root = fileURLToPath(new URL("../../../", import.meta.url));
export function paidProjection(body) {
  gate(
    typeof body === "string" && Buffer.byteLength(body) <= 160 * 1024,
    "INPUT_LIMIT",
  );
  const request = JSON.parse(body);
  gate(
    request.model === "muse-spark-1.3" &&
      request.reasoning_effort === "low" &&
      request.max_completion_tokens === PAID_POLICY.maxOutputTokens &&
      request.messages?.length === 2 &&
      request.messages.every((m) => typeof m.content === "string") &&
      request.messages.reduce((n, m) => n + Buffer.byteLength(m.content), 0) <=
        PAID_POLICY.maxPromptBytes &&
      !request.tools &&
      !request.previous_response_id &&
      request.n === 1 &&
      request.stream === false,
    "INPUT_LIMIT",
  );
  const inputTokensUpperEstimate =
    Buffer.byteLength(body) * PAID_POLICY.tokensPerSerializedByte +
    PAID_POLICY.protocolTokens;
  gate(
    inputTokensUpperEstimate + PAID_POLICY.maxOutputTokens <= 1048576,
    "INPUT_LIMIT",
  );
  return Object.freeze({
    method: "serialized-utf8-bytes-times-4-plus-32768-v1",
    inputTokensUpperEstimate,
    maxOutputTokens: PAID_POLICY.maxOutputTokens,
    worstCaseEstimatedUsd:
      (inputTokensUpperEstimate * PAID_POLICY.inputPerMillion +
        PAID_POLICY.maxOutputTokens * PAID_POLICY.outputPerMillion) /
      1e6,
  });
}

/** Pessimistic pre-send projection of the single repair send: the repair wire
 * bound is reserved before the first POST; the exact repair body is admitted
 * separately and cannot exceed this bound. Never a settled charge. */
export function repairProjection() {
  const inputTokensUpperEstimate =
    PAID_POLICY.repairWireBytes * PAID_POLICY.tokensPerSerializedByte +
    PAID_POLICY.protocolTokens;
  return Object.freeze({
    method: "serialized-utf8-bytes-times-4-plus-32768-v1",
    inputTokensUpperEstimate,
    maxOutputTokens: PAID_POLICY.maxOutputTokens,
    worstCaseEstimatedUsd:
      (inputTokensUpperEstimate * PAID_POLICY.inputPerMillion +
        PAID_POLICY.maxOutputTokens * PAID_POLICY.outputPerMillion) /
      1e6,
  });
}
async function publicJson(url, options = {}) {
  const reply = await fetch(url, {
    ...options,
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  gate(reply.status === 200, "SIGNED_IDENTITY_BLOCKED");
  const bytes = await reply.arrayBuffer();
  gate(bytes.byteLength <= 65536, "SIGNED_IDENTITY_BLOCKED");
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}
async function signedIdentity(env) {
  const url = new URL(env.ACTIONS_ID_TOKEN_REQUEST_URL);
  gate(
    url.protocol === "https:" &&
      url.hostname.endsWith(".actions.githubusercontent.com") &&
      !url.username &&
      !url.password &&
      !url.port &&
      typeof env.ACTIONS_ID_TOKEN_REQUEST_TOKEN === "string",
    "SIGNED_IDENTITY_BLOCKED",
  );
  url.searchParams.set("audience", PAID_POLICY.version);
  const { value: token } = await publicJson(url.href, {
    headers: { Authorization: `Bearer ${env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}` },
  });
  gate(
    typeof token === "string" && token.length <= 32768,
    "SIGNED_IDENTITY_BLOCKED",
  );
  const parts = token.split(".");
  gate(
    parts.length === 3 && parts.every((p) => /^[A-Za-z0-9_-]+$/.test(p)),
    "SIGNED_IDENTITY_BLOCKED",
  );
  const header = JSON.parse(
    Buffer.from(parts[0], "base64url").toString("utf8"),
  );
  gate(
    header.alg === "RS256" &&
      header.typ === "JWT" &&
      typeof header.kid === "string",
    "SIGNED_IDENTITY_BLOCKED",
  );
  const jwks = await publicJson(
    "https://token.actions.githubusercontent.com/.well-known/jwks",
  );
  const keys = jwks.keys?.filter(
    (k) =>
      k.kid === header.kid &&
      k.kty === "RSA" &&
      k.alg === "RS256" &&
      k.use === "sig",
  );
  gate(
    keys?.length === 1 &&
      verify(
        "RSA-SHA256",
        Buffer.from(`${parts[0]}.${parts[1]}`),
        createPublicKey({ key: keys[0], format: "jwk" }),
        Buffer.from(parts[2], "base64url"),
      ),
    "SIGNED_IDENTITY_BLOCKED",
  );
  const c = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  const now = Math.floor(Date.now() / 1000);
  gate(
    c.iss === "https://token.actions.githubusercontent.com" &&
      c.aud === PAID_POLICY.version &&
      Number.isSafeInteger(c.exp) &&
      c.exp > now &&
      Number.isSafeInteger(c.iat) &&
      c.iat <= now + 30 &&
      c.iat >= now - 300 &&
      c.sub ===
        "repo:Meta-Project2026@348421102/Metamorph@1434945189:environment:META_API_KEY" &&
      c.repository_id === "1434945189" &&
      c.repository_owner_id === "348421102" &&
      c.repository === META_REPOSITORY &&
      c.repository_visibility === "public" &&
      c.ref === "refs/heads/main" &&
      c.ref_protected === "true" &&
      c.environment === "META_API_KEY" &&
      c.event_name === "workflow_dispatch" &&
      c.sha === env.GITHUB_SHA &&
      c.workflow_sha === env.GITHUB_SHA &&
      c.workflow_ref === env.GITHUB_WORKFLOW_REF &&
      c.actor === env.GITHUB_ACTOR &&
      c.actor_id === META_OWNERS[c.actor] &&
      c.run_id === env.GITHUB_RUN_ID &&
      c.run_attempt === "1" &&
      c.runner_environment === "github-hosted",
    "SIGNED_IDENTITY_BLOCKED",
  );
  return c;
}
/** Opaque signed admission for one paid workflow. Default remains the exact
 * single-generation admission. `plan: "generate_then_repair"` reserves BOTH
 * sends pessimistically before the first POST (attempt 1 admission), and the
 * `attempt: 2` admission binds the exact repair body — genuine previous model
 * changes plus allowlisted public feedback codes only — after the first
 * candidate's complete eligible public FAIL and verified custody. Each
 * admission performs its own genuine OIDC identity fetch; neither grants the
 * other. */
export async function authorizePaidWorkflow(context, options = {}) {
  const { isMigrationContext } = await import("./migration-context.mjs");
  const { prepareMetaMigration } = await import("./meta-migration.mjs");
  gate(
    options !== null &&
      typeof options === "object" &&
      !Array.isArray(options) &&
      Object.keys(options).every((k) =>
        [
          "plan",
          "attempt",
          "feedback",
          "previousChanges",
          "firstAttemptEstimatedUsd",
          "firstAttemptCandidateSha",
          "g1Capability",
        ].includes(k),
      ),
    "CONFIG_DENIED",
  );
  const plan =
    options.plan === undefined || options.plan === "single_generation"
      ? "single_generation"
      : ["generate_then_repair", G1_RECOVERY_MODE].includes(options.plan)
        ? options.plan
        : null;
  const attempt = options.attempt ?? 1;
  gate(
    plan !== null &&
      (attempt === 1 || attempt === 2) &&
      (attempt === 2
        ? (plan === "generate_then_repair" || plan === G1_RECOVERY_MODE) &&
          (plan === G1_RECOVERY_MODE
            ? options.g1Capability !== undefined
            : typeof options.feedback === "string" &&
              options.g1Capability === undefined) &&
          Array.isArray(options.previousChanges) &&
          options.previousChanges.length > 0 &&
          options.previousChanges.every(
            (change) =>
              change !== null &&
              typeof change === "object" &&
              typeof change.path === "string" &&
              typeof change.content === "string",
          ) &&
          Number.isFinite(options.firstAttemptEstimatedUsd) &&
          options.firstAttemptEstimatedUsd >= 0 &&
          // First-candidate provenance, re-verified by the caller against
          // stored custody; the signed admission carries it forward.
          typeof options.firstAttemptCandidateSha === "string" &&
          /^[a-f0-9]{64}$/.test(options.firstAttemptCandidateSha)
        : options.feedback === undefined &&
          options.previousChanges === undefined &&
          options.firstAttemptEstimatedUsd === undefined &&
          options.firstAttemptCandidateSha === undefined &&
          options.g1Capability === undefined),
    "CONFIG_DENIED",
  );
  gate(isMigrationContext(context), "SOURCE_IDENTITY");
  const env = process.env;
  const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8"));
  const head = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  validateWorkflowIdentity(env, head, event.inputs, true);
  // v2 is a distinct original opt-in, never inferred from an output/env flag.
  if (
    plan === G1_RECOVERY_MODE ||
    event.inputs.execution_mode === G1_RECOVERY_MODE
  )
    gate(
      plan === G1_RECOVERY_MODE && event.inputs.execution_mode === plan,
      "PAID_CONFIRMATION_BLOCKED",
    );
  gate(Date.now() < Date.parse(PAID_POLICY.tariffExpires), "TARIFF_EXPIRED");
  await verifyHostedMetaPolicy(head);
  const identity = await signedIdentity(env);
  if (plan === G1_RECOVERY_MODE && attempt === 2) {
    recoveryHost ??= await import("./g1-repair-host.mjs");
    const facts = recoveryHost.g1CapabilityDetails(
      options.g1Capability,
      context,
    );
    gate(
      facts.firstAuthorization.runId === identity.run_id &&
        facts.firstAuthorization.headSha === head &&
        facts.firstAuthorization.actor === identity.actor &&
        facts.firstPreflight.maxEstimatedUsd ===
          Number(event.inputs.max_estimated_usd) &&
        JSON.stringify(facts.feedback) === JSON.stringify(options.feedback) &&
        JSON.stringify(facts.previousChanges) ===
          JSON.stringify(options.previousChanges) &&
        facts.firstAttemptCandidateSha === options.firstAttemptCandidateSha &&
        facts.firstAttemptEstimatedUsd === options.firstAttemptEstimatedUsd,
      "PAID_DISPATCH_NOT_AUTHORIZED",
    );
    // Keep the originally reserved aggregate bound, even if observed usage is lower.
    gate(
      facts.firstPreflight.aggregateWorstCaseEstimatedUsd <=
        Number(event.inputs.max_estimated_usd),
      "ESTIMATED_BUDGET_BLOCKED",
    );
  }
  let request,
    previous = [];
  if (attempt === 2) {
    gate(
      event.inputs.execution_mode === plan &&
        event.inputs.confirm_paid === "I_ACCEPT_TWO_PAID_ATTEMPTS_NO_HARD_CAP",
      "PAID_CONFIRMATION_BLOCKED",
    );
    request = {
      unitId: "workshop-api",
      tier: "spark",
      action: "repair",
      attempt: 2,
      repairFeedback: options.feedback,
    };
    previous = options.previousChanges;
  } else {
    request = {
      unitId: "workshop-api",
      tier: "spark",
      action: "generate",
      attempt: 1,
      repairFeedback: null,
    };
  }
  const body = prepareMetaMigration(context, request, previous);
  const projection = paidProjection(body);
  if (attempt === 2) {
    gate(Buffer.byteLength(body) <= PAID_POLICY.repairWireBytes, "INPUT_LIMIT");
    gate(
      options.firstAttemptEstimatedUsd + projection.worstCaseEstimatedUsd <=
        Number(event.inputs.max_estimated_usd),
      "ESTIMATED_BUDGET_BLOCKED",
    );
  } else {
    gate(
      projection.worstCaseEstimatedUsd +
        (plan !== "single_generation"
          ? repairProjection().worstCaseEstimatedUsd
          : 0) <=
        Number(event.inputs.max_estimated_usd),
      "ESTIMATED_BUDGET_BLOCKED",
    );
  }
  gate(
    typeof env.RUNNER_TEMP === "string" && env.RUNNER_TEMP.length > 0,
    "SIGNED_IDENTITY_BLOCKED",
  );
  const workflowBytes = readFileSync(
    join(root, ".github/workflows/meta-paid-migration.yml"),
  );
  const preflight =
    attempt === 2
      ? repairPreflight({
          context,
          headSha: head,
          workflowBytes,
          actor: identity.actor,
          maxEstimatedUsd: Number(event.inputs.max_estimated_usd),
          feedback: options.feedback,
          previousChanges: options.previousChanges,
          firstAttemptEstimatedUsd: options.firstAttemptEstimatedUsd,
          firstAttemptCandidateSha: options.firstAttemptCandidateSha,
          confirmation: event.inputs.confirm_paid,
          ...(plan === G1_RECOVERY_MODE ? { plan } : {}),
        })
      : generationPreflight({
          context,
          headSha: head,
          workflowBytes,
          actor: identity.actor,
          maxEstimatedUsd: Number(event.inputs.max_estimated_usd),
          ...(plan !== "single_generation"
            ? {
                plan,
                confirmation: event.inputs.confirm_paid,
              }
            : {}),
        });
  const summary = Object.freeze({
    kind: PAID_POLICY.version,
    actor: identity.actor,
    runId: identity.run_id,
    headSha: head,
    sourceSha: context.sourceSha,
    contextSha256: context.contextSha256,
    manifestSha256: context.manifestSha256,
    bodySha256: hash(body),
    model: "muse-spark-1.3",
    tariff: PAID_POLICY.tariff,
    workflowSha256: preflight.workflowSha256,
    preflightSha256: preflight.sha256,
    maxEstimatedUsd: Number(event.inputs.max_estimated_usd),
    attempt,
    plan: plan,
    ...(plan === G1_RECOVERY_MODE
      ? {
          maximumPosts: 2,
          maximumRepairs: 1,
          automaticRetries: 0,
          allowedRepairKinds: ["G1_BUILD_RECOVERABLE"],
        }
      : {}),
    ...(attempt === 2
      ? { firstAttemptCandidateSha: options.firstAttemptCandidateSha }
      : {}),
    ...projection,
    monetaryCap: "NO_PROVIDER_HARD_CAP",
  });
  const auth = Object.freeze({ ...summary });
  admissions.set(auth, {
    context,
    summary,
    expires: Date.now() + 240000,
    consumed: false,
    attempt,
    ledger: join(
      env.RUNNER_TEMP,
      attempt === 2
        ? `mmp078-${identity.run_id}-attempt-2.json`
        : `mmp078-${identity.run_id}-attempt.json`,
    ),
    preflight,
    g1Capability: options.g1Capability,
    preflightPath: join(
      env.RUNNER_TEMP,
      attempt === 2
        ? `mmp154-${identity.run_id}-repair-preflight.json`
        : `mmp154-${identity.run_id}-preflight.json`,
    ),
  });
  return auth;
}
export function paidPreflight(authorization, context) {
  paidAdmission(authorization, context);
  return structuredClone(admissions.get(authorization).preflight);
}
export function paidAdmission(authorization, context, body) {
  const a = admissions.get(authorization);
  gate(
    a &&
      a.context === context &&
      Date.now() < a.expires &&
      Date.now() < Date.parse(PAID_POLICY.tariffExpires) &&
      (!body || hash(body) === a.summary.bodySha256),
    "PAID_DISPATCH_NOT_AUTHORIZED",
  );
  return a.summary;
}
export function reservePaidAttempt(authorization, context, body) {
  const summary = paidAdmission(authorization, context, body);
  const a = admissions.get(authorization);
  gate(!a.consumed, "REQUEST_LIMIT");
  a.consumed = true; // synchronized before any await/send, including another session
  if (a.g1Capability) recoveryHost.consumeG1Capability(a.g1Capability, context);
  let descriptor;
  try {
    // The exact human-readable card is durable before UNKNOWN and any POST.
    commitPreflight(a.preflightPath, a.preflight);
    descriptor = openSync(a.ledger, "wx", 0o600);
    writeFileSync(
      descriptor,
      JSON.stringify({
        ...summary,
        status: "UNKNOWN",
        attemptedRequests: 1,
        chargedCostUsd: null,
      }),
    );
    fsyncSync(descriptor);
    if (process.platform === "linux") {
      const directory = openSync(dirname(a.ledger), "r");
      try {
        fsyncSync(directory);
      } finally {
        closeSync(directory);
      }
    }
  } catch {
    gate(false, "REQUEST_LIMIT");
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  return summary;
}
// Production session calls this immediately before the synchronous exclusive
// reservation. Re-reading the signed journal, source, readback and cleanup closes
// the gap between proposal/admission and a possible second network send.
export async function revalidatePaidRecovery(authorization, context) {
  paidAdmission(authorization, context);
  const a = admissions.get(authorization);
  if (a.g1Capability)
    await recoveryHost.revalidateG1Capability(a.g1Capability, context);
}
