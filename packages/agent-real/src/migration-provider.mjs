import { ModelResponseSchema } from "@metamorph/agent";
import { fields, strictJson } from "../../differential/src/strict.mjs";
import { sha256, validateBundle } from "../../target-worker/src/admission.mjs";
import { createMetaMigrationProvider } from "./meta-migration.mjs";
import { paidAdmission } from "./meta-paid-authorization.mjs";
import { insist, isMigrationContext } from "./migration-context.mjs";

const RESPONSE_LIMIT = 1024 * 1024 + 64 * 1024;
const failures = new Set([
  "CANCELLED",
  "TIMEOUT",
  "RATE_LIMITED",
  "HTTP_ERROR",
  "RESPONSE_INVALID",
  "RESPONSE_LIMIT",
  "UNKNOWN_PAID_USAGE",
  "COST_BOUND_VIOLATION",
  "REQUEST_SEQUENCE",
  "REPAIR_FEEDBACK",
  "INPUT_LIMIT",
  "QUOTA_EXHAUSTED",
  "TRANSPORT_ERROR",
]);
export function migrationFailure(error) {
  return failures.has(error?.code) ? error.code : "RESPONSE_INVALID";
}

/** Production admission has no caller-supplied cap and performs no network IO.
 * A future paid transport needs independently enforceable billing admission.
 * A real local model cannot be disguised as billing:synthetic. */
export function migrationProviderStatus(
  selection = "none",
  authorization,
  context,
) {
  insist(["none", "meta", "local"].includes(selection), "PROVIDER_DENIED");
  const admission =
    selection === "meta" && authorization
      ? paidAdmission(authorization, context)
      : null;
  return Object.freeze({
    provider:
      selection === "meta"
        ? "meta-model-api"
        : selection === "local"
          ? "local-unconfigured"
          : null,
    modelId: selection === "meta" ? "muse-spark-1.3" : null,
    admitted: Boolean(admission),
    maxRequestCostUsd: null,
    maxEstimatedRequestCostUsd: admission?.worstCaseEstimatedUsd ?? null,
    authorization: admission,
    code: admission
      ? "MANUAL_PAID_ESTIMATE_ADMITTED"
      : selection === "meta"
        ? "BILLING_CAP_NOT_ESTABLISHED"
        : selection === "local"
          ? "LOCAL_RUNTIME_AND_BILLING_CONTRACT_REQUIRED"
          : "MISSING_PROVIDER",
  });
}
export function createProductionMigrationProvider(
  context,
  selection,
  authorization,
  checkpoint,
) {
  insist(isMigrationContext(context), "SOURCE_IDENTITY");
  const status = migrationProviderStatus(selection, authorization, context);
  if (status.admitted) {
    const live = createMetaMigrationProvider(context, {
      authorization,
      checkpoint,
    });
    return Object.freeze({ ...live, status });
  }
  const blocked =
    selection === "meta" ? createMetaMigrationProvider(context) : null;
  return Object.freeze({
    status,
    provider: Object.freeze({
      billing: "paid",
      maxRequestCostUsd: null,
      async generate(request, signal) {
        context.prompt(request);
        if (blocked) return blocked.provider.generate(request, signal);
        throw Object.assign(new Error(status.code), { code: status.code });
      },
    }),
  });
}

/** Pure normalized transport codec; NOT a claim of any provider's HTTP protocol.
 * Usage is transport metadata, never extracted from model-generated source text. */
export function decodeMigrationReply(body, identity, durationMs, bound) {
  insist(["synthetic", "paid"].includes(identity.billing), "RESPONSE_INVALID");
  const reply = strictJson(body, RESPONSE_LIMIT);
  fields(reply, [
    "requestId",
    "modelId",
    "modelVersion",
    "changes",
    "usage",
    "reportedCostUsd",
    "chargedCostUsd",
  ]);
  insist(
    reply.modelId === identity.modelId &&
      (reply.modelVersion === null ||
        (typeof reply.modelVersion === "string" &&
          /^[A-Za-z0-9._:-]{1,120}$/.test(reply.modelVersion))),
    "RESPONSE_INVALID",
  );
  insist(
    typeof reply.requestId === "string" &&
      /^[A-Za-z0-9._:-]{1,200}$/.test(reply.requestId),
    "RESPONSE_INVALID",
  );
  fields(reply.usage, [
    "inputTokens",
    "outputTokens",
    "cachedInputTokens",
    "estimatedCostUsd",
  ]);
  for (const cost of [reply.reportedCostUsd, reply.chargedCostUsd])
    insist(
      cost === null || (Number.isFinite(cost) && cost >= 0),
      "RESPONSE_INVALID",
    );
  insist(
    identity.billing !== "paid" || reply.chargedCostUsd !== null,
    "UNKNOWN_PAID_USAGE",
  );
  const response = ModelResponseSchema.parse({
    changes: reply.changes,
    usage: {
      ...reply.usage,
      requestId: reply.requestId,
      provider: identity.provider,
      modelId: reply.modelId,
      durationMs,
    },
  });
  // Validate full candidate shape before any partial write can reach the session.
  const bundle = validateBundle(
    response.changes.map((f) => ({ ...f, sha256: sha256(f.content) })),
  );
  insist(Number.isFinite(bound) && bound >= 0, "COST_BOUND_VIOLATION");
  insist(response.usage.estimatedCostUsd !== null, "UNKNOWN_PAID_USAGE");
  insist(
    [
      response.usage.estimatedCostUsd,
      reply.reportedCostUsd,
      reply.chargedCostUsd,
    ].every((cost) => cost === null || cost <= bound),
    "COST_BOUND_VIOLATION",
  );
  return {
    response,
    candidateSha: bundle.candidateSha,
    modelVersion: reply.modelVersion,
    reportedCostUsd: reply.reportedCostUsd,
    chargedCostUsd: reply.chargedCostUsd,
  };
}

/** Explicit offline unit harness. There is deliberately no production POST,
 * endpoint/key lookup, failover or network fallback. Never a live model provider. */
export function createSyntheticMigrationHarness(
  context,
  transport,
  { timeoutMs = 1000, maxCalls = 2 } = {},
) {
  insist(
    isMigrationContext(context) && typeof transport === "function",
    "SOURCE_IDENTITY",
  );
  insist(
    Number.isInteger(timeoutMs) &&
      timeoutMs > 0 &&
      timeoutMs <= 5000 &&
      Number.isInteger(maxCalls) &&
      maxCalls >= 1 &&
      maxCalls <= 2,
    "QUOTA_EXHAUSTED",
  );
  const identity = Object.freeze({
    billing: "synthetic",
    provider: "synthetic-migration-transport",
    modelId: "synthetic-only-v1",
  });
  const receipts = [];
  let calls = 0;
  let stopped = false;
  let busy = false;
  let previous = [];
  const provider = Object.freeze({
    billing: "synthetic",
    maxRequestCostUsd: 0,
    async generate(request, signal) {
      insist(!stopped && !busy && calls < maxCalls, "QUOTA_EXHAUSTED");
      insist(!signal.aborted, "CANCELLED");
      insist(request.attempt === calls + 1, "REQUEST_SEQUENCE");
      const body = context.prompt(request, previous);
      const receipt = {
        attempt: ++calls,
        action: request.action,
        generationKind: "SYNTHETIC_TRANSPORT_ONLY",
        ...identity,
        modelVersion: null,
        requestId: null,
        inputSha256: sha256(body),
        responseSha256: null,
        candidateSha: null,
        status: "ERROR",
        code: null,
        inputTokens: null,
        outputTokens: null,
        cachedInputTokens: null,
        reservedCostUsd: 0,
        reportedCostUsd: null,
        chargedCostUsd: null,
        durationMs: null,
      };
      receipts.push(receipt);
      busy = true;
      const start = performance.now();
      const controller = new AbortController();
      let timer;
      let cancel;
      try {
        const interrupted = new Promise((_, reject) => {
          const stop = (code) => {
            controller.abort();
            reject(Object.assign(new Error(code), { code }));
          };
          cancel = () => stop("CANCELLED");
          signal.addEventListener("abort", cancel, { once: true });
          timer = setTimeout(() => stop("TIMEOUT"), timeoutMs);
        });
        const reply = await Promise.race([
          Promise.resolve().then(async () => {
            insist(!controller.signal.aborted, "CANCELLED");
            try {
              return await transport({ body, signal: controller.signal });
            } catch {
              throw Object.assign(new Error("TRANSPORT_ERROR"), {
                code: "TRANSPORT_ERROR",
              });
            }
          }),
          interrupted,
        ]);
        insist(!signal.aborted && !controller.signal.aborted, "CANCELLED");
        insist(reply?.status !== 429, "RATE_LIMITED");
        insist(reply?.status === 200, "HTTP_ERROR");
        insist(
          reply.contentType === "application/json" &&
            typeof reply.body === "string",
          "RESPONSE_INVALID",
        );
        insist(
          Buffer.byteLength(reply.body) <= RESPONSE_LIMIT,
          "RESPONSE_LIMIT",
        );
        receipt.responseSha256 = sha256(reply.body);
        const decoded = decodeMigrationReply(
          reply.body,
          identity,
          performance.now() - start,
          0,
        );
        Object.assign(receipt, {
          status: "PASS",
          requestId: decoded.response.usage.requestId,
          modelVersion: decoded.modelVersion,
          candidateSha: decoded.candidateSha,
          inputTokens: decoded.response.usage.inputTokens,
          outputTokens: decoded.response.usage.outputTokens,
          cachedInputTokens: decoded.response.usage.cachedInputTokens,
          reportedCostUsd: decoded.reportedCostUsd,
          chargedCostUsd: decoded.chargedCostUsd,
        });
        previous = structuredClone(decoded.response.changes);
        return decoded.response;
      } catch (error) {
        stopped = true;
        receipt.code = migrationFailure(error);
        throw Object.assign(new Error(receipt.code), { code: receipt.code });
      } finally {
        busy = false;
        clearTimeout(timer);
        signal.removeEventListener("abort", cancel);
        controller.abort();
        receipt.durationMs = performance.now() - start;
      }
    },
  });
  return Object.freeze({
    provider,
    receipts: () => structuredClone(receipts),
    kind: "SYNTHETIC_TRANSPORT_ONLY",
  });
}
