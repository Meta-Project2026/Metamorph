import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import https from "node:https";
import test from "node:test";
import { admitMetaCatalog, preflightMetaV2 } from "../src/meta-preflight.mjs";
import {
  META_MODEL,
  metaHttpsExchange,
  metaJson,
  newWireObservation,
} from "../src/meta-wire.mjs";

const key = "LLM_123_TEST_ONLY_NOT_A_CREDENTIAL";
const catalog = JSON.stringify({
  object: "list",
  data: [{ id: META_MODEL, object: "model", created: 1, owned_by: "test" }],
});
function stub(t, plan = {}) {
  const calls = [];
  t.mock.method(https, "request", (url, options, callback) => {
    const req = new EventEmitter();
    req.destroy = () => {
      if (!req.destroyed) {
        req.destroyed = true;
        queueMicrotask(() => req.emit("close"));
      }
    };
    req.end = (body) => {
      calls.push({ url, options, body, req });
      queueMicrotask(() => {
        if (plan.error) {
          req.emit("error", Error(key));
          return;
        }
        if (plan.hang) return;
        const res = new EventEmitter();
        res.socket = { authorized: plan.tls !== false };
        res.statusCode = plan.status ?? 200;
        res.headers = { "content-type": "application/json", ...plan.headers };
        res.destroy = () => {
          res.destroyed = true;
        };
        res.complete = true;
        callback(res);
        for (const part of plan.parts ?? [Buffer.from(plan.body ?? catalog)])
          res.emit("data", part);
        res.emit("end");
      });
    };
    return req;
  });
  return calls;
}
const direct = (extra = {}) =>
  metaHttpsExchange({
    operation: "READ_ONLY",
    key,
    signal: new AbortController().signal,
    timeoutMs: 100,
    responseBytes: 65536,
    observation: newWireObservation(),
    ...extra,
  });
test("native GET uses fixed TLS/no agent and closes before result; receipt exposes no key/catalog", async (t) => {
  const calls = stub(t);
  const r = await preflightMetaV2({ readCredential: () => key });
  assert.equal(r.operation, "READ_ONLY");
  assert.equal(r.status, "PASS");
  assert.equal(r.attemptedRequests, 1);
  assert.equal(r.confirmedResponseCount, 1);
  assert.equal(r.networkSend, "RESPONSE_RECEIVED");
  assert.equal(r.generationEntitlement, "NOT_VERIFIED");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.meta.ai/v1/models");
  assert.equal(calls[0].options.agent, false);
  assert.equal(calls[0].options.rejectUnauthorized, true);
  assert.equal(calls[0].options.headers.Authorization, `Bearer ${key}`);
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[0].body, undefined);
  assert.equal(calls[0].req.destroyed, true);
  assert.ok(!JSON.stringify(r).includes(key));
  assert.ok(!JSON.stringify(r).includes('"owned_by"'));
});
for (const invalid of [
  undefined,
  "",
  "bad",
  "LLM_123_ab\r\nX: value",
  `LLM_123_${"a".repeat(4096)}`,
]) {
  test(`credential admission refuses case ${String(invalid).length} before HTTPS`, async (t) => {
    const calls = stub(t);
    const r = await preflightMetaV2({ readCredential: () => invalid });
    assert.equal(r.status, "NOT_RUN");
    assert.equal(r.attemptedRequests, 0);
    assert.equal(r.networkSend, "NOT_ATTEMPTED");
    assert.equal(calls.length, 0);
  });
}
for (const [status, code] of [
  [301, "REDIRECT_DENIED"],
  [307, "REDIRECT_DENIED"],
  [400, "BAD_REQUEST"],
  [401, "UNAUTHORIZED"],
  [403, "FORBIDDEN"],
  [429, "RATE_LIMITED"],
  [500, "HTTP_ERROR"],
  [503, "HTTP_ERROR"],
]) {
  test(`preflight HTTP ${status} preserves operation and code, never retry`, async (t) => {
    const calls = stub(t, {
      status,
      body: key,
      headers: { location: "https://evil.invalid/" },
    });
    const r = await preflightMetaV2({ readCredential: () => key });
    assert.equal(r.operation, "READ_ONLY");
    assert.equal(r.code, code);
    assert.equal(calls.length, 1);
    assert.equal(
      r.status,
      [401, 403, 429].includes(status) ? "BLOCKED" : "ERROR",
    );
    assert.equal(r.httpStatus, status);
    assert.ok(!JSON.stringify(r).includes(key));
  });
}
for (const plan of [
  { parts: [Buffer.alloc(65000), Buffer.alloc(1000)] },
  { headers: { "content-length": "65537" } },
])
  test("stream/header overflow retains RESPONSE_LIMIT through close/error", async (t) => {
    stub(t, plan);
    const r = await preflightMetaV2({ readCredential: () => key });
    assert.equal(r.code, "RESPONSE_LIMIT");
    assert.equal(r.operation, "READ_ONLY");
    assert.equal(r.status, "ERROR");
  });
for (const plan of [
  { body: '{"object":"list","object":"list","data":[]}' },
  { body: "{" },
  { parts: [Buffer.from([255])] },
  { headers: { "content-type": "text/html" } },
  { headers: { "content-encoding": "gzip" } },
]) {
  test("invalid JSON/UTF8/type/encoding is a safe response error", async (t) => {
    stub(t, plan);
    const r = await preflightMetaV2({ readCredential: () => key });
    assert.equal(r.code, "RESPONSE_INVALID");
  });
}
test("socket failure attempt is UNKNOWN, not confirmed dispatch", async (t) => {
  stub(t, { error: true });
  const r = await preflightMetaV2({ readCredential: () => key });
  assert.equal(r.code, "TRANSPORT_ERROR");
  assert.equal(r.attemptedRequests, 1);
  assert.equal(r.networkSend, "UNKNOWN");
  assert.equal(r.confirmedResponseCount, 0);
});
test("unverified TLS peer rejects without catalog acceptance", async (t) => {
  stub(t, { tls: false });
  const r = await preflightMetaV2({ readCredential: () => key });
  assert.equal(r.code, "TRANSPORT_ERROR");
  assert.equal(r.tlsPeerVerified, false);
});
test("timeout/cancel destroy and join native request; no second request", async (t) => {
  const calls = stub(t, { hang: true });
  await assert.rejects(direct({ timeoutMs: 5 }), { code: "TIMEOUT" });
  assert.equal(calls[0].req.destroyed, true);
  const controller = new AbortController();
  const pending = direct({ signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { code: "CANCELLED" });
  assert.equal(calls[1].req.destroyed, true);
  const count = calls.length;
  await assert.rejects(direct({ signal: controller.signal }), {
    code: "CANCELLED",
  });
  assert.equal(calls.length, count);
});
test("POST native primitive emits exactly one bounded JSON body, no redirects/retry", async (t) => {
  const calls = stub(t, { body: "{}" });
  const observation = newWireObservation();
  const r = await direct({
    operation: "GENERATION",
    body: '{"model":"muse-spark-1.3"}',
    observation,
  });
  assert.equal(r.body, "{}");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].url, "https://api.meta.ai/v1/chat/completions");
  assert.equal(
    calls[0].options.headers["Content-Length"],
    Buffer.byteLength(calls[0].body),
  );
  await assert.rejects(direct({ observation }), { code: "REQUEST_LIMIT" });
});
test("pure parsing keeps response limit and exact catalog model identity", () => {
  assert.throws(() => metaJson(" ".repeat(20), 10), { code: "RESPONSE_LIMIT" });
  assert.equal(admitMetaCatalog(catalog), true);
  assert.equal(
    admitMetaCatalog(catalog.replace(META_MODEL, `${META_MODEL}-contributor`)),
    false,
  );
  assert.throws(() =>
    admitMetaCatalog(
      catalog.replace('"created":1', '"created":1,"extra":true'),
    ),
  );
});
test("secret workflow is manual/main/exact-SHA, dependency-free GET step only", () => {
  const text = readFileSync(
    new URL(
      "../../../.github/workflows/meta-readonly-preflight.yml",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(text, /workflow_dispatch:/);
  assert.match(text, /github.ref == 'refs\/heads\/main'/);
  assert.match(text, /inputs.reviewed_sha == github.sha/);
  assert.match(text, /environment: META_API_KEY/);
  assert.match(text, /needs: guard/);
  assert.match(text, /research\/mmp-078\/guard.mjs/);
  assert.equal((text.match(/secrets\.META/g) ?? []).length, 1);
  assert.doesNotMatch(
    text,
    /pull_request|pull_request_target|pnpm |npm |docker |GENERATE|paid_dispatch/,
  );
});
