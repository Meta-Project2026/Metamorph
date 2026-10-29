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
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  gate,
  META_OWNERS,
  META_REPOSITORY,
  validateWorkflowIdentity,
  verifyHostedMetaPolicy,
} from "./github-meta-guard.mjs";

export const PAID_POLICY = Object.freeze({
  version: "mmp078-manual-paid-estimate-v1",
  tariff: "meta-standard-2026-10-29",
  tariffExpires: "2026-11-05T00:00:00Z",
  inputPerMillion: 1.25,
  cachedPerMillion: 0.15,
  outputPerMillion: 4.25,
  maxOutputTokens: 16384,
  maxPromptBytes: 131072,
  // Text only, no tools/media/history. Count ALL serialized bytes (including
  // schema/escaping) at FOUR tokens per byte, plus 32768 framing tokens.
  // Deliberately conservative engineering projection, NOT an exact tokenizer
  // result or a guaranteed provider dollar cap. Meta-injected steering is unbilled.
  tokensPerSerializedByte: 4,
  protocolTokens: 32768,
});
const admissions = new WeakMap();
const admissionCodes = new Set([
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
export async function authorizePaidWorkflow(context) {
  const { isMigrationContext } = await import("./migration-context.mjs");
  const { prepareMetaMigration } = await import("./meta-migration.mjs");
  gate(isMigrationContext(context), "SOURCE_IDENTITY");
  const env = process.env;
  const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8"));
  const head = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  validateWorkflowIdentity(env, head, event.inputs, true);
  gate(Date.now() < Date.parse(PAID_POLICY.tariffExpires), "TARIFF_EXPIRED");
  await verifyHostedMetaPolicy(head);
  const identity = await signedIdentity(env);
  const body = prepareMetaMigration(context, {
    unitId: "workshop-api",
    tier: "spark",
    action: "generate",
    attempt: 1,
    repairFeedback: null,
  });
  const projection = paidProjection(body);
  gate(
    projection.worstCaseEstimatedUsd <= Number(event.inputs.max_estimated_usd),
    "ESTIMATED_BUDGET_BLOCKED",
  );
  gate(
    typeof env.RUNNER_TEMP === "string" && env.RUNNER_TEMP.length > 0,
    "SIGNED_IDENTITY_BLOCKED",
  );
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
    maxEstimatedUsd: Number(event.inputs.max_estimated_usd),
    ...projection,
    monetaryCap: "NO_PROVIDER_HARD_CAP",
  });
  const auth = Object.freeze({ ...summary });
  admissions.set(auth, {
    context,
    summary,
    expires: Date.now() + 240000,
    consumed: false,
    ledger: join(env.RUNNER_TEMP, `mmp078-${identity.run_id}-attempt.json`),
  });
  return auth;
}
export function paidAdmission(authorization, context, body) {
  const a = admissions.get(authorization);
  gate(
    a &&
      a.context === context &&
      Date.now() < a.expires &&
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
  let descriptor;
  try {
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
  } catch {
    gate(false, "REQUEST_LIMIT");
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  return summary;
}
