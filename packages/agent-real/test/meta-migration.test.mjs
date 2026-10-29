import assert from "node:assert/strict";
import fs, { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runAgent } from "@metamorph/agent";
import {
  createMetaMigrationProvider,
  createOfflineMetaWireHarness,
  decodeMetaMigration,
  META_MIGRATION_POLICY,
  prepareMetaMigration,
} from "../src/meta-migration.mjs";
import { bindMigrationContext } from "../src/migration-context.mjs";
import { createSourceSession } from "../src/source.mjs";

const source = readFileSync(
  new URL("../../../research/mmp-061/public-source.json", import.meta.url),
  "utf8",
);
const context = () => bindMigrationContext(source);
const request = {
  unitId: "workshop-api",
  tier: "spark",
  action: "generate",
  attempt: 1,
  repairFeedback: null,
};
const signal = () => new AbortController().signal;
const envelope = () => ({
  id: "chatcmpl-test",
  object: "chat.completion",
  created: 1,
  model: "muse-spark-1.3",
  choices: [
    {
      index: 0,
      finish_reason: "stop",
      logprobs: null,
      message: {
        role: "assistant",
        content: JSON.stringify({
          changes: [
            { path: "src/main.ts", content: "export const inertWireTest = 1;" },
          ],
        }),
        refusal: null,
      },
    },
  ],
  usage: {
    prompt_tokens: 1000,
    completion_tokens: 100,
    total_tokens: 1100,
    prompt_tokens_details: { cached_tokens: 100 },
    completion_tokens_details: { reasoning_tokens: 0 },
  },
});
const reply = (e = envelope()) => ({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify(e),
});
test("whole public source fits official strict structured request, no tool/replay answers", () => {
  const body = JSON.parse(prepareMetaMigration(context(), request));
  assert.ok(Buffer.byteLength(body.messages[1].content) > 18000);
  assert.equal(body.model, "muse-spark-1.3");
  assert.equal(body.max_completion_tokens, 16384);
  // Muse Spark rejects reasoning_effort=none with HTTP 400 (Meta docs).
  assert.equal(META_MIGRATION_POLICY.version, "mmp061-meta-manual-v2");
  assert.equal(META_MIGRATION_POLICY.reasoningEffort, "low");
  assert.equal(body.reasoning_effort, META_MIGRATION_POLICY.reasoningEffort);
  assert.ok(
    ["minimal", "low", "medium", "high", "xhigh", "max"].includes(
      body.reasoning_effort,
    ),
  );
  assert.equal(body.response_format.json_schema.strict, true);
  assert.equal(
    body.response_format.json_schema.schema.additionalProperties,
    false,
  );
  assert.deepEqual(body.response_format.json_schema.schema.required, [
    "changes",
  ]);
  assert.equal(body.tools, undefined);
  assert.equal(body.stream, false);
  assert.equal(body.store, false);
  assert.doesNotMatch(
    JSON.stringify(body),
    /workshop-compat-v1|replayProvider|MODEL_API_KEY|correctedReplay/,
  );
});
test("compiler context names the pinned toolchain without exposing verifier answers", () => {
  const wire = JSON.parse(prepareMetaMigration(context(), request));
  const target = JSON.parse(wire.messages[1].content).context.target;
  const toolchain = JSON.parse(
    readFileSync(
      new URL("../../target-worker/runtime/package.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(target.typescript, toolchain.dependencies.typescript);
  assert.equal(target.nodeTypes, toolchain.dependencies["@types/node"]);
  assert.equal(target.compilerContract, "mmp086-ts-compiler-v1");
  assert.match(target.modules, /CommonJS/);
  assert.match(target.modules, /No top-level await or import.meta/);
  assert.match(target.strictTypes, /get\(\) may be undefined/);
  assert.doesNotMatch(
    JSON.stringify(target),
    /TS[0-9]{4}|workshop-business|expectedOutputs|fixture/,
  );
});
test("repair encoder retains own previous changes and fixed feedback codes", () => {
  const previous = [
    { path: "src/main.ts", content: "export const priorOwnOutput=1;" },
  ];
  const r = {
    ...request,
    action: "repair",
    attempt: 2,
    repairFeedback: "HTTP_STATUS;DB_STATE",
  };
  const p = JSON.parse(
    JSON.parse(prepareMetaMigration(context(), r, previous)).messages[1]
      .content,
  );
  assert.deepEqual(p.previousGeneratedChanges, previous);
  assert.deepEqual(p.repairCodes, ["HTTP_STATUS", "DB_STATE"]);
  assert.throws(
    () =>
      prepareMetaMigration(
        context(),
        { ...r, repairFeedback: "raw_secret_sentinel" },
        previous,
      ),
    { code: "REPAIR_FEEDBACK" },
  );
});
test("API metadata alone determines usage/identity; estimate never means settled charge", () => {
  const a = decodeMetaMigration(JSON.stringify(envelope()), 12);
  assert.equal(a.response.usage.requestId, "chatcmpl-test");
  assert.equal(a.response.usage.durationMs, 12);
  assert.equal(
    a.response.usage.estimatedCostUsd,
    (900 * 1.25 + 100 * 0.15 + 100 * 4.25) / 1e6,
  );
  assert.equal(a.chargedCostUsd, null);
  assert.equal(a.modelVersion, null);
  assert.equal(a.usageStatus, "ESTIMATE_ONLY");
  const changed = envelope();
  changed.usage.prompt_tokens_details.cached_tokens = 0;
  const b = decodeMetaMigration(JSON.stringify(changed), 12);
  assert.ok(
    b.response.usage.estimatedCostUsd > a.response.usage.estimatedCostUsd,
  );
  assert.equal(a.candidateSha, b.candidateSha);
  // A nonzero reasoning-token count is allowed and already part of total
  // completion tokens; it must not be added a second time to billing.
  const reasoned = envelope();
  reasoned.usage.completion_tokens_details.reasoning_tokens = 40;
  const c = decodeMetaMigration(JSON.stringify(reasoned), 12);
  assert.equal(c.response.usage.outputTokens, 100);
  assert.equal(
    c.response.usage.estimatedCostUsd,
    a.response.usage.estimatedCostUsd,
  );
});
for (const [name, mutate, code] of [
  [
    "refusal",
    (e) => {
      e.choices[0].message.refusal = "sentinel";
    },
    "MODEL_REFUSAL",
  ],
  [
    "content filter",
    (e) => {
      e.choices[0].finish_reason = "content_filter";
    },
    "MODEL_REFUSAL",
  ],
  [
    "truncated",
    (e) => {
      e.choices[0].finish_reason = "length";
    },
    "OUTPUT_TRUNCATED",
  ],
  [
    "tool call",
    (e) => {
      e.choices[0].finish_reason = "tool_calls";
    },
    "TOOLS_DENIED",
  ],
  [
    "hidden tool",
    (e) => {
      e.choices[0].message.tool_calls = [{}];
    },
    "TOOLS_DENIED",
  ],
  [
    "empty",
    (e) => {
      e.choices[0].message.content = " ";
    },
    "EMPTY_CONTENT",
  ],
  [
    "null",
    (e) => {
      e.choices[0].message.content = null;
    },
    "EMPTY_CONTENT",
  ],
  [
    "no choices",
    (e) => {
      e.choices = [];
    },
    "RESPONSE_INVALID",
  ],
  [
    "two choices",
    (e) => {
      e.choices.push(e.choices[0]);
    },
    "RESPONSE_INVALID",
  ],
  [
    "wrong model",
    (e) => {
      e.model += "-contributor";
    },
    "MODEL_MISMATCH",
  ],
  [
    "unsafe id",
    (e) => {
      e.id = "raw\nsecret";
    },
    "RESPONSE_INVALID",
  ],
  [
    "invented transport metadata",
    (e) => {
      e.chargedCostUsd = 0;
    },
    "RESPONSE_INVALID",
  ],
  [
    "model-supplied usage",
    (e) => {
      e.choices[0].message.content = JSON.stringify({
        changes: [{ path: "src/main.ts", content: "1" }],
        usage: { cost: 0 },
      });
    },
    "OUTPUT_INVALID",
  ],
  [
    "markdown",
    (e) => {
      e.choices[0].message.content = "```json\n{}\n```";
    },
    "RESPONSE_INVALID",
  ],
  [
    "duplicate keys",
    (e) => {
      e.choices[0].message.content = '{"changes":[],"changes":[]}';
    },
    "RESPONSE_INVALID",
  ],
  [
    "wrong path",
    (e) => {
      e.choices[0].message.content = JSON.stringify({
        changes: [{ path: "../oracle.ts", content: "1" }],
      });
    },
    "OUTPUT_INVALID",
  ],
  [
    "missing main",
    (e) => {
      e.choices[0].message.content = JSON.stringify({
        changes: [{ path: "src/other.ts", content: "1" }],
      });
    },
    "OUTPUT_INVALID",
  ],
  [
    "file too large",
    (e) => {
      e.choices[0].message.content = JSON.stringify({
        changes: [{ path: "src/main.ts", content: "a".repeat(256 * 1024 + 1) }],
      });
    },
    "OUTPUT_INVALID",
  ],
  [
    "token overflow",
    (e) => {
      e.usage.completion_tokens = 16385;
      e.usage.total_tokens = 17385;
    },
    "USAGE_INVALID",
  ],
  [
    "input overflow",
    (e) => {
      e.usage.prompt_tokens = 65537;
      e.usage.total_tokens = 65637;
    },
    "USAGE_INVALID",
  ],
  [
    "cache inflation",
    (e) => {
      e.usage.prompt_tokens_details.cached_tokens = 1001;
    },
    "USAGE_INVALID",
  ],
  [
    "usage arithmetic",
    (e) => {
      e.usage.total_tokens = 1;
    },
    "USAGE_INVALID",
  ],
  [
    "fake price",
    (e) => {
      e.usage.price = 0;
    },
    "USAGE_INVALID",
  ],
])
  test(`wire failure ${name} makes one attempt then stops, redacts error`, async () => {
    const e = envelope();
    mutate(e);
    let calls = 0;
    const h = createOfflineMetaWireHarness(context(), async () => {
      calls++;
      return reply(e);
    });
    await assert.rejects(h.provider.generate(request, signal()), { code });
    await assert.rejects(h.provider.generate(request, signal()), {
      code: "SESSION_STOPPED",
    });
    assert.equal(calls, 1);
    const receipts = h.receipts();
    assert.equal(receipts[0].code, code);
    assert.equal(receipts[0].chargedCostUsd, null);
    assert.equal(receipts[0].generationKind, "SYNTHETIC_WIRE_TEST");
    assert.ok(!JSON.stringify(receipts).includes("sentinel"));
  });
for (const missing of ["usage", "cache"])
  test(`missing ${missing} keeps unknown and prevents writing/retry`, async () => {
    const e = envelope();
    if (missing === "usage") delete e.usage;
    else delete e.usage.prompt_tokens_details;
    const decoded = decodeMetaMigration(JSON.stringify(e), 1);
    assert.equal(decoded.usageStatus, "UNKNOWN");
    assert.equal(decoded.response.usage.estimatedCostUsd, null);
    const h = createOfflineMetaWireHarness(context(), async () => reply(e));
    await assert.rejects(h.provider.generate(request, signal()), {
      code: "USAGE_UNKNOWN",
    });
    assert.equal(h.receipts()[0].estimatedCostUsd, null);
    assert.equal(h.receipts()[0].chargedCostUsd, null);
  });
for (const status of [400, 401, 403, 429, 500, 503, 302])
  test(`session HTTP ${status} never retries or repairs`, async () => {
    let calls = 0;
    const h = createOfflineMetaWireHarness(context(), async () => {
      calls++;
      return { ...reply(), status };
    });
    await assert.rejects(h.provider.generate(request, signal()));
    await assert.rejects(
      h.provider.generate(
        {
          ...request,
          action: "repair",
          attempt: 2,
          repairFeedback: "HTTP_STATUS",
        },
        signal(),
      ),
    );
    assert.equal(calls, 1);
  });
test("one successful wire candidate enters real writer/SHA lease; fake verifier cannot establish product", async (t) => {
  const parent = mkdtempSync(join(tmpdir(), "meta-wire-writer-"));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const s = createSourceSession(parent);
  const h = createOfflineMetaWireHarness(context(), async () => reply());
  let verified = false;
  const result = await runAgent({
    runId: "synthetic-wire-integration",
    config: {
      benchmarkId: "mmp061-workshop-api-v1",
      strategy: "spark-only",
      maxRepairsPerUnit: 0,
      maxEscalations: 0,
      maxModelSpendUsd: 1,
      timeoutSeconds: 5,
    },
    benchmark: context().benchmark(),
    provider: h.provider,
    writer: s.writer,
    signal: signal(),
    verifier: {
      evidenceKind: "synthetic",
      async verify(root, abort) {
        const lease = await s.acquire(root, abort);
        assert.equal(lease.bundle.candidateSha, h.receipts()[0].candidateSha);
        await lease.release();
        verified = true;
        return { results: [], executedScenarioIds: [], repairFeedback: null };
      },
    },
  });
  assert.equal(verified, true);
  assert.equal(result.verdict, "INCONCLUSIVE");
  assert.equal(h.receipts()[0].status, "PASS");
  await assert.rejects(
    h.provider.generate(
      {
        ...request,
        attempt: 2,
        action: "repair",
        repairFeedback: "HTTP_STATUS",
      },
      signal(),
    ),
  );
});
test("production stays paid/unknown-bound and refuses direct or orchestrated dispatch", async () => {
  const c = context();
  const h = createMetaMigrationProvider(c);
  assert.equal(h.provider.billing, "paid");
  assert.equal(h.provider.maxRequestCostUsd, null);
  await assert.rejects(h.provider.generate(request, signal()), {
    code: "BILLING_CAP_NOT_ESTABLISHED",
  });
  assert.deepEqual(h.receipts(), []);
  assert.throws(() => createMetaMigrationProvider(c, { approved: true }), {
    code: "CONFIG_DENIED",
  });
  const r = await runAgent({
    runId: "closed-production",
    config: {
      benchmarkId: c.benchmark().id,
      strategy: "spark-only",
      maxRepairsPerUnit: 0,
      maxEscalations: 0,
      maxModelSpendUsd: 999,
      timeoutSeconds: 5,
    },
    benchmark: c.benchmark(),
    provider: h.provider,
    writer: {
      root: "none",
      write() {
        assert.fail();
      },
    },
    verifier: {
      evidenceKind: "external",
      verify() {
        assert.fail();
      },
    },
  });
  assert.equal(r.reason, "UNKNOWN_REQUEST_COST_BOUND");
  assert.equal(r.attempts.length, 0);
});
test("timeout aborts and late response cannot mutate receipt or start retry", async () => {
  let complete;
  let aborted = false;
  const h = createOfflineMetaWireHarness(
    context(),
    ({ signal: s }) =>
      new Promise((resolve) => {
        complete = resolve;
        s.addEventListener("abort", () => {
          aborted = true;
        });
      }),
    { timeoutMs: 5 },
  );
  await assert.rejects(h.provider.generate(request, signal()), {
    code: "TIMEOUT",
  });
  assert.equal(aborted, true);
  const before = h.receipts();
  complete(reply());
  await h.waitForIdle();
  assert.deepEqual(h.receipts(), before);
  await assert.rejects(h.provider.generate(request, signal()), {
    code: "SESSION_STOPPED",
  });
});
test("pre-abort, concurrent call, active abort and TTL are enforced", async () => {
  let complete,
    calls = 0;
  const h = createOfflineMetaWireHarness(context(), () => {
    calls++;
    return new Promise((resolve) => {
      complete = resolve;
    });
  });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(h.provider.generate(request, controller.signal), {
    code: "CANCELLED",
  });
  assert.equal(calls, 0);
  const active = new AbortController();
  const first = h.provider.generate(request, active.signal);
  await assert.rejects(h.provider.generate(request, signal()), {
    code: "SESSION_STOPPED",
  });
  active.abort();
  await assert.rejects(first, { code: "CANCELLED" });
  complete?.(reply());
  await h.waitForIdle();
  assert.equal(calls, 1);
  let time = 0;
  const expired = createOfflineMetaWireHarness(
    context(),
    async () => {
      assert.fail();
    },
    { now: () => time },
  );
  time = META_MIGRATION_POLICY.sessionTtlMs;
  await assert.rejects(expired.provider.generate(request, signal()), {
    code: "TIMEOUT",
  });
});
test("oversize top-level response and raw transport exception remain safe", async () => {
  assert.throws(() => decodeMetaMigration("x".repeat(2 * 1024 * 1024 + 1), 1), {
    code: "RESPONSE_LIMIT",
  });
  const h = createOfflineMetaWireHarness(context(), async () => {
    throw Error("raw_secret_sentinel");
  });
  await assert.rejects(h.provider.generate(request, signal()), {
    code: "TRANSPORT_ERROR",
  });
  assert.ok(!JSON.stringify(h.receipts()).includes("raw_secret_sentinel"));
});

test("wire candidate partial disk write invalidates source lease and never reaches verifier", async (t) => {
  const parent = mkdtempSync(join(tmpdir(), "meta-partial-"));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const c = context(),
    s = createSourceSession(parent),
    e = envelope();
  e.choices[0].message.content = JSON.stringify({
    changes: [
      { path: "src/main.ts", content: "export const inert=1;" },
      { path: "src/second.ts", content: "export const inert2=2;" },
    ],
  });
  const h = createOfflineMetaWireHarness(c, async () => reply(e));
  const original = fs.writeFileSync;
  let writes = 0,
    result;
  t.mock.method(fs, "writeFileSync", (...args) => {
    if (++writes === 2) throw Error("private_disk_diagnostic");
    return original(...args);
  });
  syncBuiltinESMExports();
  try {
    result = await runAgent({
      runId: "wire-partial-write",
      config: {
        benchmarkId: c.benchmark().id,
        strategy: "spark-only",
        maxRepairsPerUnit: 0,
        maxEscalations: 0,
        maxModelSpendUsd: 1,
        timeoutSeconds: 5,
      },
      benchmark: c.benchmark(),
      provider: h.provider,
      writer: s.writer,
      verifier: {
        evidenceKind: "synthetic",
        verify() {
          assert.fail();
        },
      },
    });
  } finally {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  }
  assert.equal(result.verdict, "ERROR");
  await assert.rejects(s.acquire(s.writer.root, signal()), /SOURCE_IDENTITY/);
  assert.equal(h.receipts().length, 1);
  assert.equal(h.receipts()[0].sourceSha, c.sourceSha);
  assert.equal(h.receipts()[0].contextSha256, c.contextSha256);
  assert.equal(h.receipts()[0].manifestSha256, c.manifestSha256);
  assert.ok(!JSON.stringify(h.receipts()).includes("private_disk_diagnostic"));
});
