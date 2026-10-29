// V2 receipt: operation and outcome are separate; attempts are not network sends.
import {
  checkMetaHttp,
  credentialCode,
  META_MODEL,
  metaCheck,
  metaHttpsExchange,
  metaJson,
  newWireObservation,
  safeMetaCode,
} from "./meta-wire.mjs";

const object = (v) => v && typeof v === "object" && !Array.isArray(v);
export function admitMetaCatalog(body) {
  const value = metaJson(body, 65536);
  metaCheck(
    object(value) &&
      Object.keys(value).sort().join() === "data,object" &&
      value.object === "list" &&
      Array.isArray(value.data) &&
      value.data.length <= 256,
  );
  const ids = new Set();
  for (const model of value.data) {
    metaCheck(
      object(model) &&
        Object.keys(model).sort().join() === "created,id,object,owned_by" &&
        typeof model.id === "string" &&
        model.id.length > 0 &&
        model.id.length <= 200 &&
        model.object === "model" &&
        Number.isSafeInteger(model.created) &&
        model.created >= 0 &&
        typeof model.owned_by === "string" &&
        model.owned_by.length <= 200 &&
        !ids.has(model.id),
    );
    ids.add(model.id);
  }
  return ids.has(META_MODEL);
}
export async function preflightMetaV2({
  readCredential = () => process.env.MODEL_API_KEY,
  signal = new AbortController().signal,
} = {}) {
  const started = performance.now();
  const observation = newWireObservation();
  const receipt = {
    format: "meta-preflight-v2",
    operation: "READ_ONLY",
    status: "NOT_RUN",
    code: null,
    modelId: META_MODEL,
    credentialPresent: false,
    generatedRequests: 0,
    modelListed: false,
    generationEntitlement: "NOT_VERIFIED",
    estimatedCostUsd: null,
    chargedCostUsd: null,
  };
  try {
    const key = readCredential();
    receipt.credentialPresent = typeof key === "string" && key.length > 0;
    const code = credentialCode(key);
    if (code) {
      receipt.code = code;
      return {
        ...receipt,
        ...observation,
        durationMs: performance.now() - started,
      };
    }
    metaCheck(!signal.aborted, "CANCELLED");
    const reply = await metaHttpsExchange({
      operation: "READ_ONLY",
      key,
      signal,
      timeoutMs: 10000,
      responseBytes: 65536,
      observation,
    });
    checkMetaHttp(reply);
    receipt.modelListed = admitMetaCatalog(reply.body);
    receipt.status = receipt.modelListed ? "PASS" : "BLOCKED";
    receipt.code = receipt.modelListed ? "MODEL_LISTED" : "MODEL_NOT_LISTED";
  } catch (error) {
    receipt.code = safeMetaCode(error);
    receipt.status = ["UNAUTHORIZED", "FORBIDDEN", "RATE_LIMITED"].includes(
      receipt.code,
    )
      ? "BLOCKED"
      : "ERROR";
  }
  return {
    ...receipt,
    ...observation,
    durationMs: performance.now() - started,
  };
}
