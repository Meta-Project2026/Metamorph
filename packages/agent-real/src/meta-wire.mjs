// Trusted host only. Internal HTTP primitive; paid entrypoints must gate admission.
// Native HTTPS, fixed destinations, no fetch dispatcher, proxy, redirect or retry.
import https from "node:https";
import { strictJson } from "../../differential/src/strict.mjs";
export const META_MODEL = "muse-spark-1.3";
export const META_URLS = Object.freeze({
  READ_ONLY: "https://api.meta.ai/v1/models",
  GENERATION: "https://api.meta.ai/v1/chat/completions",
});
const codes = new Set([
  "AUTH_ABSENT",
  "AUTH_INVALID",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "RATE_LIMITED",
  "BAD_REQUEST",
  "HTTP_ERROR",
  "TRANSPORT_ERROR",
  "REDIRECT_DENIED",
  "RESPONSE_LIMIT",
  "RESPONSE_INVALID",
  "CANCELLED",
  "TIMEOUT",
  "CONFIG_DENIED",
  "MODEL_NOT_LISTED",
  "MODEL_MISMATCH",
  "MODEL_REFUSAL",
  "OUTPUT_TRUNCATED",
  "TOOLS_DENIED",
  "EMPTY_CONTENT",
  "USAGE_UNKNOWN",
  "USAGE_INVALID",
  "INPUT_LIMIT",
  "OUTPUT_INVALID",
  "REQUEST_LIMIT",
  "REQUEST_SEQUENCE",
  "REPAIR_FEEDBACK",
  "SOURCE_IDENTITY",
  "SESSION_STOPPED",
  "REVIEW_REQUIRED",
  "PAID_DISPATCH_NOT_AUTHORIZED",
  "BILLING_CAP_NOT_ESTABLISHED",
  "ESTIMATED_BUDGET_BLOCKED",
  "USAGE_BOUND_EXCEEDED",
]);
export class MetaWireError extends Error {
  constructor(code) {
    super(codes.has(code) ? code : "RESPONSE_INVALID");
    this.code = this.message;
  }
}
export const metaCheck = (value, code = "RESPONSE_INVALID") => {
  if (!value) throw new MetaWireError(code);
};
export const safeMetaCode = (error) =>
  error instanceof MetaWireError && codes.has(error.code)
    ? error.code
    : "TRANSPORT_ERROR";
export function metaJson(text, limit) {
  metaCheck(typeof text === "string", "RESPONSE_INVALID");
  metaCheck(Buffer.byteLength(text) <= limit, "RESPONSE_LIMIT");
  try {
    return strictJson(text, limit);
  } catch {
    throw new MetaWireError("RESPONSE_INVALID");
  }
}
export function credentialCode(key) {
  if (key === undefined || key === "") return "AUTH_ABSENT";
  return typeof key === "string" &&
    /^LLM_[0-9]+_[A-Za-z0-9_-]+$/.test(key) &&
    key.length <= 4096
    ? null
    : "AUTH_INVALID";
}
export function checkMetaHttp(reply) {
  const status = reply?.status;
  if (status >= 300 && status < 400) throw new MetaWireError("REDIRECT_DENIED");
  const code = new Map([
    [401, "UNAUTHORIZED"],
    [403, "FORBIDDEN"],
    [429, "RATE_LIMITED"],
    [400, "BAD_REQUEST"],
  ]).get(status);
  if (code) throw new MetaWireError(code);
  metaCheck(status === 200, "HTTP_ERROR");
  metaCheck(
    /^application\/json(?:\s*;|$)/i.test(reply.contentType),
    "RESPONSE_INVALID",
  );
}
export function newWireObservation() {
  return {
    attemptedRequests: 0,
    networkSend: "NOT_ATTEMPTED",
    confirmedResponseCount: 0,
    tlsPeerVerified: false,
    httpStatus: null,
  };
}
// Resolves only after socket/request close, including timeout/cancellation.
// An attempt/finish is NOT proof the peer received bytes; only a TLS HTTP reply
// changes networkSend to RESPONSE_RECEIVED. Other outcomes remain UNKNOWN.
export async function metaHttpsExchange({
  operation,
  key,
  body = null,
  signal,
  timeoutMs,
  responseBytes,
  observation,
}) {
  metaCheck(Object.hasOwn(META_URLS, operation), "CONFIG_DENIED");
  metaCheck(
    Number.isInteger(timeoutMs) &&
      timeoutMs > 0 &&
      timeoutMs <= 180000 &&
      Number.isInteger(responseBytes) &&
      responseBytes > 0 &&
      responseBytes <= 2 * 1024 * 1024,
    "CONFIG_DENIED",
  );
  metaCheck(
    operation === "READ_ONLY"
      ? body === null
      : typeof body === "string" && Buffer.byteLength(body) <= 160 * 1024,
    "INPUT_LIMIT",
  );
  const credential = credentialCode(key);
  if (credential) throw new MetaWireError(credential);
  metaCheck(!signal.aborted, "CANCELLED");
  metaCheck(observation.attemptedRequests === 0, "REQUEST_LIMIT");
  return new Promise((resolve, reject) => {
    let req,
      timer,
      settled = false,
      outcome,
      completed = false;
    let response;
    const done = () => {
      if (completed) return;
      completed = true;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      if (outcome?.error) reject(new MetaWireError(outcome.error));
      else if (outcome?.reply) resolve(outcome.reply);
      else reject(new MetaWireError("TRANSPORT_ERROR"));
    };
    const settle = (error, reply) => {
      if (settled) return;
      settled = true;
      outcome = { error, reply };
      if (req) {
        response?.destroy();
        req.destroy();
      } else done();
    };
    const cancel = () => settle("CANCELLED");
    signal.addEventListener("abort", cancel, { once: true });
    timer = setTimeout(() => settle("TIMEOUT"), timeoutMs);
    try {
      observation.attemptedRequests = 1;
      observation.networkSend = "UNKNOWN";
      req = https.request(
        META_URLS[operation],
        {
          method: operation === "READ_ONLY" ? "GET" : "POST",
          agent: false,
          rejectUnauthorized: true,
          minVersion: "TLSv1.2",
          maxHeaderSize: 16 * 1024,
          headers: {
            Authorization: `Bearer ${key}`,
            Accept: "application/json",
            "Accept-Encoding": "identity",
            ...(body === null
              ? {}
              : {
                  "Content-Type": "application/json",
                  "Content-Length": Buffer.byteLength(body),
                }),
          },
        },
        (res) => {
          response = res;
          if (settled) {
            res.destroy();
            return;
          }
          if (res.socket?.authorized !== true) {
            settle("TRANSPORT_ERROR");
            return;
          }
          observation.tlsPeerVerified = true;
          observation.networkSend = "RESPONSE_RECEIVED";
          observation.confirmedResponseCount = 1;
          observation.httpStatus = res.statusCode ?? null;
          const reply = {
            status: res.statusCode ?? 0,
            contentType: res.headers["content-type"] ?? "",
            body: "",
          };
          // Never buffer provider error bodies or follow Location.
          try {
            checkMetaHttp(reply);
          } catch (e) {
            settle(safeMetaCode(e));
            return;
          }
          if (
            res.headers["content-encoding"] &&
            res.headers["content-encoding"] !== "identity"
          ) {
            settle("RESPONSE_INVALID");
            return;
          }
          const length = res.headers["content-length"];
          if (
            length !== undefined &&
            (!/^\d+$/.test(length) || Number(length) > responseBytes)
          ) {
            settle("RESPONSE_LIMIT");
            return;
          }
          const chunks = [];
          let size = 0;
          res.on("data", (chunk) => {
            if (settled) return;
            size += chunk.length;
            if (size > responseBytes) {
              settle("RESPONSE_LIMIT");
              return;
            }
            chunks.push(Buffer.from(chunk));
          });
          res.on("error", () => settle("TRANSPORT_ERROR"));
          res.on("aborted", () => settle("TRANSPORT_ERROR"));
          res.on("end", () => {
            if (settled) return;
            try {
              if (res.complete === false) throw Error();
              reply.body = new TextDecoder("utf-8", { fatal: true }).decode(
                Buffer.concat(chunks),
              );
              settle(null, reply);
            } catch {
              settle("RESPONSE_INVALID");
            }
          });
        },
      );
      req.on("error", () => settle("TRANSPORT_ERROR"));
      req.on("close", done);
      if (signal.aborted || settled) {
        settle("CANCELLED");
        req.destroy();
      } else req.end(body ?? undefined);
    } catch {
      settle("TRANSPORT_ERROR");
    }
  });
}
