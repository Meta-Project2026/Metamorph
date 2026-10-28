// Original PUBLIC_SYNTHETIC fixtures only. Never calls an external API.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import http from "node:http";
import https from "node:https";
import { syncBuiltinESMExports } from "node:module";
import net from "node:net";
import test, { after } from "node:test";
import tls from "node:tls";
import { ModelUsageSchema } from "../../contracts/dist/index.js";
import {
  createUnconfiguredMetaProvider,
  ModelResponseSchema,
  runAgent,
} from "../dist/index.js";
import {
  createMetaModelApiProvider,
  createOfflineMetaModelApiProvider,
  decodeMetaCompletion,
  liveProbeStatus,
  META_STANDARD_MODEL,
  metaFailureReceipt,
  preflightMetaModels,
  prepareMetaCodeRequest,
} from "../dist/meta-model-api.js";

// Fail the suite if any code even attempts an unmocked network operation.
let unmockedNetworkCalls = 0;
const forbidNetwork = () => {
  unmockedNetworkCalls++;
  throw Error("UNMOCKED_NETWORK_DENIED");
};
http.request = forbidNetwork;
https.request = forbidNetwork;
net.connect = forbidNetwork;
tls.connect = forbidNetwork;
globalThis.fetch = forbidNetwork;
syncBuiltinESMExports();
after(() => assert.equal(unmockedNetworkCalls, 0));

const CANARY = "PUBLIC_SYNTHETIC_SECRET_AND_RAW_CANARY";
const signal = () => new AbortController().signal;
const request = {
  unitId: "public-synthetic-unit",
  tier: "spark",
  action: "generate",
  attempt: 1,
  repairFeedback: null,
};
const content = () => ({
  changes: [
    { path: "src/main.ts", content: "export const publicControl = true;" },
  ],
});
const envelope = () => ({
  id: "mock-response-1",
  object: "chat.completion",
  created: 1,
  model: META_STANDARD_MODEL,
  choices: [
    {
      index: 0,
      finish_reason: "stop",
      logprobs: null,
      message: {
        role: "assistant",
        content: JSON.stringify(content()),
        refusal: null,
      },
    },
  ],
  usage: {
    prompt_tokens: 100,
    completion_tokens: 10,
    total_tokens: 110,
    prompt_tokens_details: { cached_tokens: 20 },
    completion_tokens_details: { reasoning_tokens: 2 },
  },
});
const reply = (body = envelope(), status = 200) => ({
  status,
  body: typeof body === "string" ? body : JSON.stringify(body),
  contentType: "application/json",
  rateLimitPresent: true,
});
function offline(response = () => reply(), timeoutMs = 1000, bound = 0.25) {
  const calls = [];
  const provider = createOfflineMetaModelApiProvider(
    async (wire) => {
      calls.push(wire);
      return response(wire);
    },
    "PUBLIC_SYNTHETIC: Return JSON with a simple src/main.ts change.",
    bound,
    timeoutMs,
  );
  return { provider, calls };
}
async function rejects(operation, code) {
  await assert.rejects(operation, (error) => {
    const safe = metaFailureReceipt(error);
    assert.equal(safe.code, code);
    assert.ok(!JSON.stringify(safe).includes(CANARY));
    return true;
  });
}

test("missing local key: read-only preflight sends nothing", async () => {
  let calls = 0;
  const report = await preflightMetaModels(
    {},
    {
      readCredential: () => undefined,
      transport: async () => {
        calls++;
        return reply();
      },
    },
  );
  assert.equal(report.code, "MISSING_LOCAL_CREDENTIAL");
  assert.equal(report.readOnlyRequests, 0);
  assert.equal(calls, 0);
});
for (const config of [
  { baseURL: "https://external.invalid" },
  { baseURL: "http://api.meta.ai/v1" },
  { endpoint: "https://api.meta.ai@external.invalid/v1" },
  { proxy: "https://external.invalid" },
  { model: "muse-spark-1.3-contributor" },
  { model: "muse-wonder-1.0" },
  { model: "unknown" },
  { accountAlias: "customer-identity" },
  { maxRequestCostUsd: 0.25 },
  { enabled: true },
])
  test(`config denied before credentials/network: ${Object.keys(config)[0]} ${Object.values(config)[0]}`, async () => {
    let secretReads = 0,
      calls = 0;
    assert.throws(() => createMetaModelApiProvider(config), /CONFIG_DENIED/);
    await rejects(
      () =>
        preflightMetaModels(config, {
          readCredential: () => {
            secretReads++;
            return CANARY;
          },
          transport: async () => {
            calls++;
            return reply();
          },
        }),
      "CONFIG_DENIED",
    );
    assert.equal(secretReads, 0);
    assert.equal(calls, 0);
  });

test("read-only catalog verifies only selected Standard model, strips identity and raw fields", async () => {
  let calls = 0;
  const catalog = {
    object: "list",
    data: [
      {
        object: "model",
        id: META_STANDARD_MODEL,
        created: 1,
        owned_by: CANARY,
      },
      { object: "model", id: CANARY, created: 1, owned_by: CANARY },
    ],
  };
  const report = await preflightMetaModels(
    {},
    {
      readCredential: () => CANARY,
      transport: async (wire) => {
        calls++;
        assert.equal(wire.url, "https://api.meta.ai/v1/models");
        assert.equal(wire.method, "GET");
        assert.equal(wire.body, null);
        assert.ok(!JSON.stringify(wire).includes(CANARY));
        return reply(catalog);
      },
    },
  );
  assert.equal(report.status, "READ_ONLY_VERIFIED");
  assert.equal(report.readOnlyRequests, 1);
  assert.equal(calls, 1);
  assert.ok(!JSON.stringify(report).includes(CANARY));
  assert.equal(report.rateLimitStatus, "PRESENT");
});
test("model absence is not invented entitlement or merged account balance", async () => {
  const report = await preflightMetaModels(
    { accountAlias: "owner-b" },
    {
      readCredential: () => CANARY,
      transport: async () => reply({ object: "list", data: [] }),
    },
  );
  assert.equal(report.code, "MODEL_NOT_LISTED");
  assert.equal(report.accountAlias, "owner-b");
  assert.equal(report.settledCostUsd, null);
});
for (const [status, code] of [
  [302, "REDIRECT_DENIED"],
  [307, "REDIRECT_DENIED"],
  [429, "RATE_LIMITED"],
  [500, "HTTP_ERROR"],
  [401, "HTTP_ERROR"],
])
  test(`HTTP ${status}: one attempt, no retry; sanitized unknown liability`, async () => {
    const h = offline(() => reply({ error: { message: CANARY } }, status));
    await rejects(() => h.provider.generate(request, signal()), code);
    assert.equal(h.calls.length, 1);
    const r = await preflightMetaModels(
      {},
      {
        readCredential: () => CANARY,
        transport: async () => reply(CANARY, status),
      },
    );
    assert.equal(r.code, code);
    assert.equal(r.readOnlyRequests, 1);
    assert.ok(!JSON.stringify(r).includes(CANARY));
  });

test("native production transport uses fixed TLS GET and never follows redirect with credentials", () => {
  const moduleUrl = new URL("../dist/meta-model-api.js", import.meta.url).href;
  const script = `import https from 'node:https'; import { EventEmitter } from 'node:events'; import { syncBuiltinESMExports } from 'node:module'; import assert from 'node:assert/strict';
    let calls=0;
    https.request=(url,options,cb)=>{calls++;assert.equal(url,'https://api.meta.ai/v1/models');assert.equal(options.method,'GET');assert.equal(options.agent,false);assert.equal(options.rejectUnauthorized,true);assert.equal(options.headers.Authorization,'Bearer '+process.env.MODEL_API_KEY);
      const req=new EventEmitter();req.destroy=()=>{};req.end=()=>queueMicrotask(()=>{const res=new EventEmitter();res.statusCode=302;res.headers={'content-type':'application/json',location:'https://external.invalid'};cb(res);res.emit('data',Buffer.from('{}'));res.emit('end');});return req;};
    syncBuiltinESMExports(); const {preflightMetaModels}=await import(${JSON.stringify(moduleUrl)});const report=await preflightMetaModels();console.log(JSON.stringify({calls,report}));`;
  const raw = execFileSync(
    process.execPath,
    ["--input-type=module", "-e", script],
    {
      encoding: "utf8",
      env: {
        MODEL_API_KEY: CANARY,
        ...(process.env.SystemRoot
          ? { SystemRoot: process.env.SystemRoot }
          : {}),
      },
    },
  );
  assert.ok(!raw.includes(CANARY));
  const result = JSON.parse(raw);
  assert.equal(result.calls, 1);
  assert.equal(result.report.code, "REDIRECT_DENIED");
});

test("production ModelProvider and unconfigured seam remain no-IO with unknown bound", async () => {
  const p = createMetaModelApiProvider();
  assert.equal(p.billing, "paid");
  assert.equal(p.maxRequestCostUsd, null);
  await rejects(
    () => p.generate(request, signal()),
    "BILLING_CAP_NOT_ESTABLISHED",
  );
  const old = createUnconfiguredMetaProvider();
  assert.equal(old.maxRequestCostUsd, null);
  await assert.rejects(
    old.generate(request, signal()),
    /META_INTEGRATION_NOT_CONFIGURED/,
  );
});
test("production provider preserves runAgent zero/unknown-bound budget admission with no writes or verification", async () => {
  for (const budget of [0, 1]) {
    let invoked = 0;
    const actual = createMetaModelApiProvider();
    const provider = {
      billing: actual.billing,
      maxRequestCostUsd: actual.maxRequestCostUsd,
      generate: async (...args) => {
        invoked++;
        return actual.generate(...args);
      },
    };
    const r = await runAgent({
      runId: "public-meta-bound",
      config: {
        benchmarkId: "public-synthetic",
        strategy: "spark-only",
        maxRepairsPerUnit: 0,
        maxEscalations: 0,
        maxModelSpendUsd: budget,
        timeoutSeconds: 1,
      },
      benchmark: {
        id: "public-synthetic",
        sourceRepo: "https://example.invalid/public",
        sourceCommit: "0".repeat(40),
        license: "original-synthetic",
        phpRuntime: "NOT_RUN",
        scenarioIds: ["public"],
        migrationUnitIds: ["public"],
        normalizationVersion: "synthetic",
      },
      provider,
      writer: {
        root: "unused",
        write: async () => {
          throw Error("UNEXPECTED_WRITE");
        },
      },
      verifier: {
        evidenceKind: "synthetic",
        verify: async () => {
          throw Error("UNEXPECTED_VERIFICATION");
        },
      },
    });
    assert.equal(invoked, 0);
    assert.equal(r.verdict, "INCONCLUSIVE");
    assert.equal(
      r.reason,
      budget === 0 ? "ZERO_BUDGET" : "UNKNOWN_REQUEST_COST_BOUND",
    );
  }
});

test("mock success yields strict ModelResponse/ModelUsage and accurate estimate, never a settled bill", async () => {
  const h = offline();
  const actual = await h.provider.generate(request, signal());
  ModelResponseSchema.parse(actual);
  ModelUsageSchema.parse(actual.usage);
  assert.equal(actual.usage.requestId, "mock-response-1");
  assert.equal(actual.usage.modelId, META_STANDARD_MODEL);
  assert.equal(actual.usage.inputTokens, 100);
  assert.equal(actual.usage.outputTokens, 10);
  assert.equal(actual.usage.cachedInputTokens, 20);
  assert.equal(actual.usage.estimatedCostUsd, 0.0001455);
  assert.equal(h.calls.length, 1);
  assert.equal(h.provider.billing, "synthetic");
  const r = decodeMetaCompletion(JSON.stringify(envelope()), 1, 0.25);
  assert.equal(r.settledCostUsd, null);
  assert.equal(r.usageStatus, "ESTIMATE_ONLY");
  assert.equal(
    r.requestCorrelationSha256,
    createHash("sha256").update("mock-response-1").digest("hex"),
  );
  const wire = JSON.parse(h.calls[0].body);
  assert.equal(wire.model, META_STANDARD_MODEL);
  assert.equal(wire.max_completion_tokens, 128);
  assert.equal(wire.stream, false);
  assert.equal(wire.store, false);
  assert.equal(wire.n, 1);
  assert.equal(wire.tools, undefined);
  assert.equal(wire.response_format.type, "json_schema");
});
for (const [name, mutate, code] of [
  ["missing usage", (x) => delete x.usage, "UNKNOWN_PAID_USAGE"],
  [
    "missing cache usage",
    (x) => delete x.usage.prompt_tokens_details,
    "UNKNOWN_PAID_USAGE",
  ],
  ["negative usage", (x) => (x.usage.prompt_tokens = -1), "RESPONSE_INVALID"],
  ["invalid total", (x) => (x.usage.total_tokens = 9), "RESPONSE_INVALID"],
  [
    "oversized cached",
    (x) => (x.usage.prompt_tokens_details.cached_tokens = 101),
    "RESPONSE_INVALID",
  ],
  [
    "reasoning exceeds output",
    (x) => (x.usage.completion_tokens_details.reasoning_tokens = 11),
    "RESPONSE_INVALID",
  ],
  [
    "output cap exceeded",
    (x) => (x.usage.completion_tokens = 129),
    "RESPONSE_INVALID",
  ],
  ["untrusted cost", (x) => (x.usage.estimatedCostUsd = 0), "RESPONSE_INVALID"],
  ["missing id", (x) => delete x.id, "RESPONSE_INVALID"],
  ["incompatible request id", (x) => (x.id = "invalid id"), "BLOCKED_CONTRACT"],
  [
    "off-list returned model",
    (x) => (x.model = "muse-spark-1.3-contributor"),
    "RESPONSE_INVALID",
  ],
  [
    "tool call",
    (x) => (x.choices[0].message.tool_calls = [{ id: CANARY }]),
    "RESPONSE_INVALID",
  ],
  [
    "external annotation",
    (x) => (x.choices[0].message.annotations = [{ url: CANARY }]),
    "RESPONSE_INVALID",
  ],
  ["unexpected response field", (x) => (x.raw = CANARY), "RESPONSE_INVALID"],
  [
    "stream chunk",
    (x) => (x.object = "chat.completion.chunk"),
    "RESPONSE_INVALID",
  ],
  [
    "truncation",
    (x) => (x.choices[0].finish_reason = "length"),
    "RESPONSE_INVALID",
  ],
  [
    "duplicate choices",
    (x) => x.choices.push(x.choices[0]),
    "RESPONSE_INVALID",
  ],
  [
    "refusal",
    (x) => (x.choices[0].message.refusal = CANARY),
    "RESPONSE_INVALID",
  ],
])
  test(`decode denies ${name} without retry or raw output`, async () => {
    const x = envelope();
    mutate(x);
    const h = offline(() => reply(x));
    await rejects(() => h.provider.generate(request, signal()), code);
    assert.equal(h.calls.length, 1);
  });
for (const path of [
  "../main.ts",
  "src/../main.ts",
  "C:/private/main.ts",
  "src/tests/main.ts",
  "src/oracle.ts",
  "src/held-out/main.ts",
  "src/main.js",
  "src/\u0000/main.ts",
])
  test(`unsafe path denied: ${JSON.stringify(path)}`, async () => {
    const x = envelope();
    x.choices[0].message.content = JSON.stringify({
      changes: [{ path, content: "PUBLIC_SYNTHETIC" }],
    });
    const h = offline(() => reply(x));
    await rejects(
      () => h.provider.generate(request, signal()),
      "RESPONSE_INVALID",
    );
    assert.equal(h.calls.length, 1);
  });
for (const [name, changes, code] of [
  [
    "duplicate case-insensitive paths",
    [
      { path: "src/main.ts", content: "a" },
      { path: "src/Main.ts", content: "b" },
    ],
    "RESPONSE_INVALID",
  ],
  [
    "file count",
    Array.from({ length: 9 }, (_, n) => ({
      path: `src/file${n}.ts`,
      content: "a",
    })),
    "RESPONSE_LIMIT",
  ],
  [
    "file bytes",
    [{ path: "src/main.ts", content: "a".repeat(4097) }],
    "RESPONSE_LIMIT",
  ],
  [
    "total bytes",
    Array.from({ length: 3 }, (_, n) => ({
      path: `src/file${n}.ts`,
      content: "a".repeat(3000),
    })),
    "RESPONSE_LIMIT",
  ],
  [
    "NUL content",
    [{ path: "src/main.ts", content: "\u0000" }],
    "RESPONSE_LIMIT",
  ],
])
  test(`bounded changes: ${name}`, async () => {
    const x = envelope();
    x.choices[0].message.content = JSON.stringify({ changes });
    const h = offline(() => reply(x));
    await rejects(() => h.provider.generate(request, signal()), code);
  });
test("invalid JSON, duplicate JSON keys and response byte limit deny safely", async () => {
  for (const [body, code] of [
    [CANARY, "RESPONSE_INVALID"],
    [
      JSON.stringify(envelope()).replace(
        '"model":"muse-spark-1.3"',
        '"model":"wrong","model":"muse-spark-1.3"',
      ),
      "RESPONSE_INVALID",
    ],
    ["a".repeat(65537), "RESPONSE_LIMIT"],
  ]) {
    const h = offline(() => reply(body));
    await rejects(() => h.provider.generate(request, signal()), code);
    assert.equal(h.calls.length, 1);
  }
});
test("missing usage remains null in pure decoder; provider refuses successful accounting", () => {
  const x = envelope();
  delete x.usage;
  const r = decodeMetaCompletion(JSON.stringify(x), 0, 0.25);
  for (const key of [
    "inputTokens",
    "outputTokens",
    "cachedInputTokens",
    "estimatedCostUsd",
  ])
    assert.equal(r.response.usage[key], null);
  assert.equal(r.usageStatus, "UNKNOWN_PAID_USAGE");
  assert.equal(r.settledCostUsd, null);
});
test("unknown/invalid upper bound denied before transport; estimate above test bound rejected", async () => {
  for (const bound of [null, NaN, Infinity, -1, 0, 0.26])
    assert.throws(
      () =>
        createOfflineMetaModelApiProvider(
          () => {
            throw Error("UNEXPECTED");
          },
          "PUBLIC",
          bound,
        ),
      /COST_BOUND_VIOLATION/,
    );
  const h = offline(() => reply(), 1000, 0.000001);
  await rejects(
    () => h.provider.generate(request, signal()),
    "COST_BOUND_VIOLATION",
  );
  assert.equal(h.calls.length, 1);
});
test("bounded input/output, no feedback/source-path forwarding or model escalation", async () => {
  for (const [input, model, cap] of [
    ["a".repeat(2049), META_STANDARD_MODEL, 128],
    ["PUBLIC", META_STANDARD_MODEL, 129],
    ["PUBLIC", META_STANDARD_MODEL, 15],
    ["PUBLIC", "muse-spark-1.3-contributor", 128],
  ])
    assert.throws(() => prepareMetaCodeRequest(input, model, cap));
  const h = offline();
  await rejects(
    () => h.provider.generate({ ...request, repairFeedback: CANARY }, signal()),
    "INPUT_DENIED",
  );
  assert.equal(h.calls.length, 0);
  await h.provider.generate({ ...request, unitId: CANARY }, signal());
  assert.ok(!h.calls[0].body.includes(CANARY));
});
test("timeout, cancellation, disconnect: one request, unknown remote usage, no retries", async () => {
  const timeout = offline(() => new Promise(() => {}), 10);
  await rejects(() => timeout.provider.generate(request, signal()), "TIMEOUT");
  assert.equal(timeout.calls.length, 1);
  const cancelled = new AbortController();
  const h = offline(() => new Promise(() => {}));
  const pending = h.provider.generate(request, cancelled.signal);
  setTimeout(() => cancelled.abort(), 10);
  await rejects(() => pending, "CANCELLED");
  assert.equal(h.calls.length, 1);
  const before = new AbortController();
  before.abort();
  const p = offline();
  await rejects(() => p.provider.generate(request, before.signal), "CANCELLED");
  assert.equal(p.calls.length, 0);
  const dropped = offline(() => {
    throw Error(CANARY);
  });
  await rejects(
    () => dropped.provider.generate(request, signal()),
    "TRANSPORT_ERROR",
  );
  assert.equal(dropped.calls.length, 1);
});
test("late mock reply after deadline cannot trigger retries or successful output", async () => {
  let resolve;
  const h = offline(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
    10,
  );
  await rejects(() => h.provider.generate(request, signal()), "TIMEOUT");
  resolve(reply());
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(h.calls.length, 1);
});
test("public receipt cannot copy unknown error diagnostics, keys, prompts, IDs or custom toJSON", () => {
  const x = Object.assign(new Error(CANARY), {
    rawPrompt: CANARY,
    headers: { Authorization: CANARY },
    toJSON: () => ({ secret: CANARY }),
  });
  const r = metaFailureReceipt(x, CANARY);
  assert.equal(r.code, "INTERNAL_ERROR");
  assert.ok(!JSON.stringify(r).includes(CANARY));
});
test("disabled live probe never reads a key or sends a request, even with the proposed approval string", () => {
  const off = liveProbeStatus();
  assert.equal(off.generatedRequests, 0);
  assert.equal(off.status, "LIVE_PROBE_NOT_RUN_PENDING_OWNER_APPROVAL");
  const approved = liveProbeStatus(
    "I AUTHORIZE MMP-037 STAGE B: owner-a; one text-only request; standard model muse-spark-1.3; hard max $0.25; no retry",
  );
  assert.equal(approved.approvalPresent, true);
  assert.equal(approved.generatedRequests, 0);
  assert.equal(approved.status, "BLOCKED_BILLING_CAP_NOT_ESTABLISHED");
});
