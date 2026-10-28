// Trusted host only. Production paid generation remains closed: see Issue #37.
import { createHash } from "node:crypto";
import { request as httpsRequest } from "node:https";
import { ModelUsageSchema } from "@metamorph/contracts";
import { z } from "zod";
import {
  type ModelProvider,
  type ModelRequest,
  ModelResponseSchema,
} from "./ports.js";

export const META_STANDARD_MODEL = "muse-spark-1.3" as const;
export const META_LIMITS = Object.freeze({
  inputBytes: 2048,
  responseBytes: 65536,
  outputTokens: 128,
  files: 8,
  fileBytes: 4096,
  totalFileBytes: 8192,
  timeoutMs: 5000,
});
const MODELS_URL = "https://api.meta.ai/v1/models";
const COMPLETIONS_URL = "https://api.meta.ai/v1/chat/completions";
const aliasSchema = z.enum(["owner-a", "owner-b"]);
const optionsSchema = z.strictObject({
  accountAlias: aliasSchema.default("owner-a"),
  model: z.literal(META_STANDARD_MODEL).default(META_STANDARD_MODEL),
});
const codes = [
  "MISSING_LOCAL_CREDENTIAL",
  "CONFIG_DENIED",
  "ENDPOINT_DENIED",
  "CANCELLED",
  "TIMEOUT",
  "REDIRECT_DENIED",
  "RATE_LIMITED",
  "HTTP_ERROR",
  "TRANSPORT_ERROR",
  "RESPONSE_INVALID",
  "RESPONSE_LIMIT",
  "UNKNOWN_PAID_USAGE",
  "BLOCKED_CONTRACT",
  "COST_BOUND_VIOLATION",
  "BILLING_CAP_NOT_ESTABLISHED",
  "INPUT_DENIED",
  "INTERNAL_ERROR",
] as const;
type Code = (typeof codes)[number];
export class MetaApiError extends Error {
  readonly code: Code;
  constructor(
    code: Code,
    readonly dispatched = false,
    readonly httpStatus: number | null = null,
  ) {
    const safe = codes.includes(code) ? code : "INTERNAL_ERROR";
    super(safe);
    this.name = "MetaApiError";
    this.code = safe;
  }
  toJSON() {
    return {
      code: this.code,
      paidUsage: this.dispatched ? "UNKNOWN_PAID_USAGE" : "NOT_SENT",
      httpStatus: this.httpStatus,
    };
  }
}
function deny(code: Code): never {
  throw new MetaApiError(code);
}
function parse<T>(schema: z.ZodType<T>, value: unknown, code: Code): T {
  const result = schema.safeParse(value);
  if (!result.success) deny(code);
  return result.data;
}
function json(text: string): unknown {
  if (Buffer.byteLength(text) > META_LIMITS.responseBytes)
    deny("RESPONSE_LIMIT");
  try {
    const value: unknown = JSON.parse(text);
    // JSON.parse checks grammar; this bounded token walk additionally rejects duplicate keys.
    const tokens =
      text.match(
        /"(?:\\.|[^"\\])*"|[{}[\],:]|true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/g,
      ) ?? [];
    let index = 0;
    const scan = (depth: number): void => {
      if (depth > 64) deny("RESPONSE_INVALID");
      const token = tokens[index++];
      if (token === "{") {
        const keys = new Set<string>();
        if (tokens[index] !== "}") {
          do {
            const key = JSON.parse(tokens[index++] ?? "");
            if (keys.has(key)) deny("RESPONSE_INVALID");
            keys.add(key);
            index++;
            scan(depth + 1);
          } while (tokens[index++] === ",");
        } else index++;
      } else if (token === "[") {
        if (tokens[index] !== "]") {
          do {
            scan(depth + 1);
          } while (tokens[index++] === ",");
        } else index++;
      } else if (
        token &&
        /^-?\d/.test(token) &&
        !Number.isFinite(Number(token))
      )
        deny("RESPONSE_INVALID");
    };
    scan(0);
    if (index !== tokens.length) deny("RESPONSE_INVALID");
    return value;
  } catch {
    return deny("RESPONSE_INVALID");
  }
}
function options(input: unknown) {
  return parse(optionsSchema, input, "CONFIG_DENIED");
}
export function metaFailureReceipt(
  error: unknown,
  accountAlias: unknown = "owner-a",
) {
  const alias = accountAlias === "owner-b" ? "owner-b" : "owner-a";
  let code: Code = "INTERNAL_ERROR",
    dispatched = false,
    httpStatus: number | null = null;
  try {
    if (error instanceof MetaApiError) {
      if (codes.includes(error.code)) code = error.code;
      dispatched = error.dispatched === true;
      if (
        Number.isInteger(error.httpStatus) &&
        error.httpStatus !== null &&
        error.httpStatus >= 100 &&
        error.httpStatus <= 599
      )
        httpStatus = error.httpStatus;
    }
  } catch {
    code = "INTERNAL_ERROR";
    dispatched = false;
    httpStatus = null;
  }
  return {
    mode: "BLOCKED",
    accountAlias: alias,
    modelId: META_STANDARD_MODEL,
    code,
    paidUsage: dispatched ? "UNKNOWN_PAID_USAGE" : "NOT_SENT",
    httpStatus,
    settledCostUsd: null,
  };
}
export interface MetaWireRequest {
  readonly url: string;
  readonly method: "GET" | "POST";
  readonly body: string | null;
  readonly signal: AbortSignal;
}
export interface MetaWireResponse {
  readonly status: number;
  readonly body: string;
  readonly contentType: string;
  readonly rateLimitPresent: boolean;
}
export type OfflineMetaTransport = (
  request: MetaWireRequest,
) => Promise<MetaWireResponse>;
function assertEndpoint(url: string, method: "GET" | "POST") {
  if (url !== (method === "GET" ? MODELS_URL : COMPLETIONS_URL))
    deny("ENDPOINT_DENIED");
}
function checkStatus(reply: MetaWireResponse, dispatched: boolean) {
  if (reply.status >= 300 && reply.status < 400)
    throw new MetaApiError("REDIRECT_DENIED", dispatched, reply.status);
  if (reply.status === 429)
    throw new MetaApiError("RATE_LIMITED", dispatched, 429);
  if (reply.status !== 200)
    throw new MetaApiError("HTTP_ERROR", dispatched, reply.status);
  if (!/^application\/json(?:\s*;|$)/i.test(reply.contentType))
    throw new MetaApiError("RESPONSE_INVALID", dispatched, 200);
}
// No fetch/global dispatcher/proxy environment. No redirects, retries or POST path.
async function readOnlyTransport(
  key: string,
  signal: AbortSignal,
): Promise<MetaWireResponse> {
  assertEndpoint(MODELS_URL, "GET");
  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      MODELS_URL,
      {
        method: "GET",
        agent: false,
        rejectUnauthorized: true,
        headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
        signal,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (b: Buffer) => {
          size += b.length;
          if (size > META_LIMITS.responseBytes)
            req.destroy(new MetaApiError("RESPONSE_LIMIT"));
          else chunks.push(b);
        });
        res.on("error", () => reject(new MetaApiError("TRANSPORT_ERROR")));
        res.on("end", () => {
          try {
            resolve({
              status: res.statusCode ?? 0,
              body: new TextDecoder("utf-8", { fatal: true }).decode(
                Buffer.concat(chunks),
              ),
              contentType: res.headers["content-type"] ?? "",
              rateLimitPresent: [
                "x-ratelimit-limit-tokens",
                "x-ratelimit-remaining-tokens",
                "x-ratelimit-limit-requests",
                "x-ratelimit-remaining-requests",
              ].some((h) => h in res.headers),
            });
          } catch {
            reject(new MetaApiError("RESPONSE_INVALID"));
          }
        });
      },
    );
    req.on("error", () => reject(new MetaApiError("TRANSPORT_ERROR")));
    req.end();
  });
}
async function bounded<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  signal: AbortSignal,
  timeoutMs: number,
  dispatched: boolean,
): Promise<T> {
  if (signal.aborted) deny("CANCELLED");
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stop: () => void = () => {};
  const stopped = new Promise<never>((_, reject) => {
    stop = () => {
      controller.abort();
      reject(new MetaApiError("CANCELLED", dispatched));
    };
    signal.addEventListener("abort", stop, { once: true });
    timer = setTimeout(() => {
      controller.abort();
      reject(new MetaApiError("TIMEOUT", dispatched));
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      Promise.resolve().then(() => {
        if (controller.signal.aborted || signal.aborted)
          throw new MetaApiError("CANCELLED", dispatched);
        return operation(controller.signal);
      }),
      stopped,
    ]);
  } catch (error) {
    if (error instanceof MetaApiError) throw error;
    throw new MetaApiError("TRANSPORT_ERROR", dispatched);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", stop);
    controller.abort();
  }
}
const modelsSchema = z.object({
  object: z.literal("list"),
  data: z
    .array(
      z.object({
        id: z.string().max(200),
        object: z.literal("model"),
        created: z.number().int().nonnegative(),
        owned_by: z.string().max(200),
      }),
    )
    .max(256),
});
// Injection is trusted/offline only; no key is supplied to it. Production GET uses the private closure.
export async function preflightMetaModels(
  input: unknown = {},
  dependencies: {
    readCredential?: () => string | undefined;
    transport?: OfflineMetaTransport;
    signal?: AbortSignal;
  } = {},
) {
  const config = options(input);
  const started = performance.now();
  const base = {
    mode: "READ_ONLY",
    accountAlias: config.accountAlias,
    modelId: config.model,
    generatedRequests: 0,
    settledCostUsd: null,
  } as const;
  let key: string | undefined;
  try {
    key = (dependencies.readCredential ?? (() => process.env.MODEL_API_KEY))();
  } catch {
    return {
      ...base,
      status: "NOT_RUN",
      code: "MISSING_LOCAL_CREDENTIAL",
      readOnlyRequests: 0,
    };
  }
  if (!key || !/^[\x21-\x7e]{1,4096}$/.test(key))
    return {
      ...base,
      status: "NOT_RUN",
      code: "MISSING_LOCAL_CREDENTIAL",
      readOnlyRequests: 0,
    };
  const signal = dependencies.signal ?? new AbortController().signal;
  if (signal.aborted)
    return {
      ...base,
      status: "NOT_RUN",
      code: "CANCELLED",
      readOnlyRequests: 0,
    };
  let sent = 0;
  try {
    const reply = await bounded(
      (s) => {
        sent++;
        return dependencies.transport
          ? dependencies.transport({
              url: MODELS_URL,
              method: "GET",
              body: null,
              signal: s,
            })
          : readOnlyTransport(key, s);
      },
      signal,
      META_LIMITS.timeoutMs,
      false,
    );
    checkStatus(reply, false);
    const catalog = parse(modelsSchema, json(reply.body), "RESPONSE_INVALID");
    const entitled = catalog.data.some((m) => m.id === config.model);
    return {
      ...base,
      status: entitled ? "READ_ONLY_VERIFIED" : "BLOCKED",
      code: entitled ? "MODEL_LISTED" : "MODEL_NOT_LISTED",
      readOnlyRequests: sent,
      httpStatus: reply.status,
      durationMs: performance.now() - started,
      rateLimitStatus: reply.rateLimitPresent ? "PRESENT" : "NOT_PRESENT",
    };
  } catch (error) {
    return {
      ...base,
      status: "ERROR",
      ...metaFailureReceipt(error, config.accountAlias),
      readOnlyRequests: sent,
      durationMs: performance.now() - started,
    };
  }
}
// Real billing has no verified hard cap. No caller-supplied bound or enable switch.
export function createMetaModelApiProvider(input: unknown = {}): ModelProvider {
  options(input);
  return Object.freeze({
    billing: "paid" as const,
    maxRequestCostUsd: null,
    async generate(_request: unknown, signal: AbortSignal) {
      if (signal.aborted) deny("CANCELLED");
      return deny("BILLING_CAP_NOT_ESTABLISHED");
    },
  });
}
const changesPayload = z.strictObject({
  changes: ModelResponseSchema.shape.changes,
});
export function prepareMetaCodeRequest(
  publicSyntheticInput: string,
  model: unknown = META_STANDARD_MODEL,
  outputTokens = META_LIMITS.outputTokens,
) {
  if (model !== META_STANDARD_MODEL) deny("CONFIG_DENIED");
  if (
    typeof publicSyntheticInput !== "string" ||
    publicSyntheticInput.length === 0 ||
    publicSyntheticInput.includes("\0") ||
    Buffer.byteLength(publicSyntheticInput) > META_LIMITS.inputBytes ||
    !Number.isInteger(outputTokens) ||
    outputTokens < 16 ||
    outputTokens > META_LIMITS.outputTokens
  )
    deny("INPUT_DENIED");
  return {
    model,
    messages: [{ role: "user", content: publicSyntheticInput }],
    max_completion_tokens: outputTokens,
    reasoning_effort: "none",
    store: false,
    stream: false,
    n: 1,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "candidate_changes",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["changes"],
          properties: {
            changes: {
              type: "array",
              minItems: 1,
              maxItems: META_LIMITS.files,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["path", "content"],
                properties: {
                  path: { type: "string" },
                  content: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  };
}
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const usageSchema = z
  .strictObject({
    prompt_tokens: count,
    completion_tokens: count.max(META_LIMITS.outputTokens),
    total_tokens: count,
    prompt_tokens_details: z.strictObject({ cached_tokens: count }).optional(),
    completion_tokens_details: z
      .strictObject({ reasoning_tokens: count })
      .optional(),
  })
  .refine(
    (u) =>
      u.total_tokens === u.prompt_tokens + u.completion_tokens &&
      (u.prompt_tokens_details?.cached_tokens ?? 0) <= u.prompt_tokens &&
      (u.completion_tokens_details?.reasoning_tokens ?? 0) <=
        u.completion_tokens,
  );
const completionSchema = z.strictObject({
  id: z.string().min(1).max(256),
  object: z.literal("chat.completion"),
  created: count,
  model: z.literal(META_STANDARD_MODEL),
  choices: z
    .array(
      z.strictObject({
        index: z.literal(0),
        finish_reason: z.literal("stop"),
        logprobs: z.null().optional(),
        message: z.strictObject({
          role: z.literal("assistant"),
          content: z.string().max(META_LIMITS.responseBytes),
          refusal: z.null(),
          tool_calls: z.array(z.never()).max(0).optional(),
          annotations: z.array(z.never()).max(0).optional(),
          reasoning_content: z
            .string()
            .max(META_LIMITS.responseBytes)
            .nullable()
            .optional(),
        }),
      }),
    )
    .length(1),
  usage: usageSchema.nullable().optional(),
  service_tier: z.string().max(40).optional(),
  system_fingerprint: z.string().max(200).optional(),
});
// Pure decoding, no IO and no execution of generated code. Estimates are not bills.
export function decodeMetaCompletion(
  body: string,
  durationMs: number,
  syntheticBoundUsd: number,
) {
  const envelope = parse(completionSchema, json(body), "RESPONSE_INVALID");
  const choice = envelope.choices[0];
  if (!choice) deny("RESPONSE_INVALID");
  const payload = parse(
    changesPayload,
    json(choice.message.content),
    "RESPONSE_INVALID",
  );
  let total = 0;
  if (
    payload.changes.length > META_LIMITS.files ||
    payload.changes.some((c) => {
      const size = Buffer.byteLength(c.content);
      total += size;
      return c.content.includes("\0") || size > META_LIMITS.fileBytes;
    }) ||
    total > META_LIMITS.totalFileBytes
  )
    deny("RESPONSE_LIMIT");
  const u = envelope.usage;
  const cached = u?.prompt_tokens_details?.cached_tokens ?? null;
  const estimate =
    u && cached !== null
      ? ((u.prompt_tokens - cached) * 1.25 +
          cached * 0.15 +
          u.completion_tokens * 4.25) /
        1e6
      : null;
  if (
    !Number.isFinite(syntheticBoundUsd) ||
    syntheticBoundUsd < 0 ||
    (estimate !== null && estimate > syntheticBoundUsd)
  )
    deny("COST_BOUND_VIOLATION");
  const usage = parse(
    ModelUsageSchema,
    {
      requestId: envelope.id,
      provider: "meta-model-api",
      modelId: envelope.model,
      inputTokens: u?.prompt_tokens ?? null,
      outputTokens: u?.completion_tokens ?? null,
      cachedInputTokens: cached,
      estimatedCostUsd: estimate,
      durationMs,
    },
    "BLOCKED_CONTRACT",
  );
  const response = parse(
    ModelResponseSchema,
    { changes: payload.changes, usage },
    "BLOCKED_CONTRACT",
  );
  return {
    response,
    usageStatus: estimate === null ? "UNKNOWN_PAID_USAGE" : "ESTIMATE_ONLY",
    settledCostUsd: null,
    requestCorrelationSha256: createHash("sha256")
      .update(envelope.id)
      .digest("hex"),
  };
}
// Only supplied offline transport can service this codec harness; never reads a key,
// invokes production HTTPS, or masquerades as an admitted paid provider.
export function createOfflineMetaModelApiProvider(
  transport: OfflineMetaTransport,
  publicSyntheticInput: string,
  syntheticBoundUsd = 0.25,
  timeoutMs = META_LIMITS.timeoutMs,
): ModelProvider {
  if (
    !Number.isFinite(syntheticBoundUsd) ||
    syntheticBoundUsd <= 0 ||
    syntheticBoundUsd > 0.25 ||
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > META_LIMITS.timeoutMs
  )
    deny("COST_BOUND_VIOLATION");
  const body = JSON.stringify(prepareMetaCodeRequest(publicSyntheticInput));
  return Object.freeze({
    billing: "synthetic" as const,
    maxRequestCostUsd: syntheticBoundUsd,
    async generate(request: ModelRequest, signal: AbortSignal) {
      if (
        request.tier !== "spark" ||
        request.action !== "generate" ||
        request.attempt !== 1 ||
        request.repairFeedback !== null
      )
        deny("INPUT_DENIED");
      const started = performance.now();
      const reply = await bounded(
        (s) =>
          transport({ url: COMPLETIONS_URL, method: "POST", body, signal: s }),
        signal,
        timeoutMs,
        true,
      );
      checkStatus(reply, true);
      try {
        const result = decodeMetaCompletion(
          reply.body,
          performance.now() - started,
          syntheticBoundUsd,
        );
        if (result.usageStatus === "UNKNOWN_PAID_USAGE")
          throw new MetaApiError("UNKNOWN_PAID_USAGE", true);
        return result.response;
      } catch (error) {
        throw new MetaApiError(
          error instanceof MetaApiError ? error.code : "RESPONSE_INVALID",
          true,
          reply.status,
        );
      }
    },
  });
}
export function liveProbeStatus(approval: unknown = undefined) {
  // A string/flag cannot manufacture a provider-side financial guarantee.
  const expected =
    "I AUTHORIZE MMP-037 STAGE B: owner-a; one text-only request; standard model muse-spark-1.3; hard max $0.25; no retry";
  return {
    mode: "LIVE_PROBE",
    accountAlias: "owner-a",
    modelId: META_STANDARD_MODEL,
    status:
      approval === expected
        ? "BLOCKED_BILLING_CAP_NOT_ESTABLISHED"
        : "LIVE_PROBE_NOT_RUN_PENDING_OWNER_APPROVAL",
    approvalPresent: approval === expected,
    blocker: "BILLING_CAP_NOT_ESTABLISHED",
    generatedRequests: 0,
    requestLimit: 1,
    proposedMaxUsd: 0.25,
    inputBytesLimit: META_LIMITS.inputBytes,
    outputTokenLimit: 32,
    settledCostUsd: null,
    estimatedCostUsd: null,
  };
}
