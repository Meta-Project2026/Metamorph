import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs, { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runAgent } from "@metamorph/agent";
import {
  bindMigrationContext,
  MIGRATION_UNIT,
} from "../src/migration-context.mjs";
import {
  createProductionMigrationProvider,
  createSyntheticMigrationHarness,
  decodeMigrationReply,
} from "../src/migration-provider.mjs";
import { runPublicMigration } from "../src/migration-trial.mjs";
import { createSourceSession } from "../src/source.mjs";

const source = readFileSync(
  new URL("../../../research/mmp-061/public-source.json", import.meta.url),
  "utf8",
);
const context = () => bindMigrationContext(source);
const request = (attempt = 1) => ({
  unitId: MIGRATION_UNIT,
  tier: "spark",
  action: attempt === 1 ? "generate" : "repair",
  attempt,
  repairFeedback: attempt === 1 ? null : "HTTP_STATUS",
});
const identity = {
  billing: "synthetic",
  provider: "synthetic-migration-transport",
  modelId: "synthetic-only-v1",
};
const changes = (n = 1) => [
  {
    path: "src/main.ts",
    content: `export const syntheticTransportOnly = ${n};`,
  },
];
const envelope = (n = 1) => ({
  requestId: `synthetic-request-${n}`,
  modelId: identity.modelId,
  modelVersion: null,
  changes: changes(n),
  usage: {
    inputTokens: null,
    outputTokens: null,
    cachedInputTokens: null,
    estimatedCostUsd: 0,
  },
  reportedCostUsd: null,
  chargedCostUsd: null,
});
const reply = (value = envelope()) => ({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify(value),
});
const signal = () => new AbortController().signal;
function session(t) {
  const parent = mkdtempSync(join(tmpdir(), "mmp061-unit-"));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  return createSourceSession(parent);
}
const config = () => ({
  benchmarkId: "mmp061-workshop-api-v1",
  strategy: "spark-only",
  maxRepairsPerUnit: 1,
  maxEscalations: 0,
  maxModelSpendUsd: 1,
  timeoutSeconds: 10,
});

test("frozen source binding includes exact public PHP/functions/license, no target or test answers", () => {
  const c = context();
  const p = JSON.parse(c.prompt(request()));
  assert.deepEqual(
    p.context.source.files.map((f) => f.path),
    ["api.php", "config.php"],
  );
  assert.equal(p.context.orderedUnits.length, 11);
  assert.equal(p.context.orderedUnits[0].function, "defineSetting");
  assert.equal(p.context.routes.length, 5);
  assert.match(p.context.source.license, /MIT License/);
  assert.deepEqual(p.previousGeneratedChanges, []);
  assert.deepEqual(p.repairCodes, []);
  assert.deepEqual(c.benchmark().migrationUnitIds, [MIGRATION_UNIT]);
  assert.equal(c.benchmark().scenarioIds.length, 3);
  assert.match(c.contextSha256, /^[a-f0-9]{64}$/);
  for (const forbidden of [
    "correctedReplay",
    "replayProvider",
    "workshop-compat-v1",
    "tests/api_test.php",
    "expectedOutputs",
  ])
    assert.equal(c.prompt(request()).includes(forbidden), false);
});
for (const mutation of [
  "php",
  "license",
  "source",
  "extra",
  "duplicate",
  "test-file",
]) {
  test(`context admission rejects ${mutation} before provider invocation`, () => {
    const value = JSON.parse(source);
    if (mutation === "php") value.files[0].content += "\n";
    if (mutation === "license") value.license += "\n";
    if (mutation === "source") value.sourceCommit = "0".repeat(40);
    if (mutation === "extra") value.privateContext = "sentinel";
    if (mutation === "duplicate") value.files[1] = value.files[0];
    if (mutation === "test-file") value.files[0].path = "tests/api_test.php";
    assert.throws(() => bindMigrationContext(JSON.stringify(value)));
  });
}
for (const selection of ["none", "meta", "local"]) {
  test(`production ${selection} has no admitted bound or filesystem/Docker effects`, async () => {
    const c = context();
    const p = createProductionMigrationProvider(c, selection);
    assert.equal(p.provider.maxRequestCostUsd, null);
    assert.equal(p.status.admitted, false);
    await assert.rejects(p.provider.generate(request(), signal()));
    const result = await runPublicMigration({
      context: c,
      selection,
      headSha: "a".repeat(40),
      root: "must-not-be-read",
      parent: "must-not-be-created",
      config: { maxModelSpendUsd: 999 },
    });
    assert.equal(result.modelGeneration, "NOT_RUN");
    assert.equal(result.generatedRequests, 0);
    assert.equal(result.candidateSha, null);
    assert.equal(result.totalCostUsd, null);
    assert.equal(result.cleanup.status, "NOT_RUN");
    assert.equal(result.product, "NOT_ESTABLISHED");
    assert.deepEqual(result.attempts, []);
  });
}
test("orchestrator refuses production unknown bound before any write or verification", async () => {
  const c = context();
  const result = await runAgent({
    runId: "synthetic-blocker-test",
    config: config(),
    benchmark: c.benchmark(),
    provider: createProductionMigrationProvider(c, "meta").provider,
    writer: {
      root: "none",
      write() {
        assert.fail("write");
      },
    },
    verifier: {
      evidenceKind: "synthetic",
      verify() {
        assert.fail("verify");
      },
    },
  });
  assert.equal(result.reason, "UNKNOWN_REQUEST_COST_BOUND");
  assert.equal(result.attempts.length, 0);
});
test("synthetic source-aware generate/repair drives real writer and SHA leases, not live inference", async (t) => {
  const c = context();
  const s = session(t);
  const prompts = [];
  const harness = createSyntheticMigrationHarness(c, async ({ body }) => {
    prompts.push(JSON.parse(body));
    return reply(envelope(prompts.length));
  });
  const shas = [];
  const result = await runAgent({
    runId: "synthetic-mmp061",
    config: config(),
    benchmark: c.benchmark(),
    provider: harness.provider,
    writer: s.writer,
    verifier: {
      evidenceKind: "synthetic",
      async verify(root, abort) {
        const lease = await s.acquire(root, abort);
        shas.push(lease.bundle.candidateSha);
        await lease.release();
        return {
          results: [
            {
              gate: "G2",
              verdict: shas.length === 1 ? "FAIL" : "INCONCLUSIVE",
              executedTestIds: ["synthetic-step"],
              evidencePaths: ["synthetic.json"],
              findings: [
                {
                  code: shas.length === 1 ? "HTTP_STATUS" : "MISSING_COVERAGE",
                  message: "synthetic",
                },
              ],
            },
          ],
          executedScenarioIds: [],
          repairFeedback: shas.length === 1 ? "HTTP_STATUS" : null,
        };
      },
    },
  });
  assert.equal(result.verdict, "INCONCLUSIVE");
  assert.equal(prompts.length, 2);
  assert.deepEqual(prompts[1].previousGeneratedChanges, changes(1));
  assert.deepEqual(prompts[1].repairCodes, ["HTTP_STATUS"]);
  assert.notEqual(shas[0], shas[1]);
  assert.deepEqual(
    harness.receipts().map((r) => r.candidateSha),
    shas,
  );
  assert.ok(
    harness
      .receipts()
      .every(
        (r) =>
          r.generationKind === "SYNTHETIC_TRANSPORT_ONLY" && r.durationMs >= 0,
      ),
  );
  assert.equal(result.totalModelSpendUsd, 0);
  // The test-only USD1 orchestrator ceiling is not production spend authorization.
});
for (const bad of ["DB_STATE;secret-output", "raw JSON", "", "x".repeat(513)]) {
  test(`repair rejects non-allowlisted feedback of length ${bad.length}`, () => {
    assert.throws(
      () => context().prompt({ ...request(2), repairFeedback: bad }),
      /REPAIR_FEEDBACK/,
    );
  });
}
for (const [name, mutate] of [
  [
    "429",
    (r) => {
      r.status = 429;
    },
  ],
  [
    "5xx",
    (r) => {
      r.status = 503;
    },
  ],
  [
    "redirect",
    (r) => {
      r.status = 302;
    },
  ],
  [
    "content-type",
    (r) => {
      r.contentType = "text/html";
    },
  ],
  [
    "malformed",
    (r) => {
      r.body = "{";
    },
  ],
  [
    "duplicates",
    (r) => {
      r.body = '{"changes":[],"changes":[]}';
    },
  ],
  [
    "oversize",
    (r) => {
      r.body = "x".repeat(2 * 1024 * 1024);
    },
  ],
  [
    "path",
    (r) => {
      const x = envelope();
      x.changes[0].path = "../reference.php";
      r.body = JSON.stringify(x);
    },
  ],
  [
    "missing-main",
    (r) => {
      const x = envelope();
      x.changes[0].path = "src/helper.ts";
      r.body = JSON.stringify(x);
    },
  ],
  [
    "model",
    (r) => {
      const x = envelope();
      x.modelId = "unexpected";
      r.body = JSON.stringify(x);
    },
  ],
  [
    "unknown-spend",
    (r) => {
      const x = envelope();
      x.usage.estimatedCostUsd = null;
      r.body = JSON.stringify(x);
    },
  ],
  [
    "cost-bound",
    (r) => {
      const x = envelope();
      x.chargedCostUsd = 1;
      r.body = JSON.stringify(x);
    },
  ],
]) {
  test(`synthetic transport rejects ${name} with one call and no retry`, async () => {
    let sent = 0;
    const harness = createSyntheticMigrationHarness(context(), async () => {
      sent++;
      const r = reply();
      mutate(r);
      return r;
    });
    await assert.rejects(harness.provider.generate(request(), signal()));
    await assert.rejects(
      harness.provider.generate(request(), signal()),
      /QUOTA_EXHAUSTED/,
    );
    assert.equal(sent, 1);
    assert.equal(harness.receipts()[0].status, "ERROR");
    assert.equal(harness.receipts()[0].candidateSha, null);
  });
}
test("timeout aborts transport, ignores late completion and never writes candidate", async () => {
  let resolve;
  let observed;
  const harness = createSyntheticMigrationHarness(
    context(),
    ({ signal: abort }) => {
      observed = abort;
      return new Promise((done) => {
        resolve = done;
      });
    },
    { timeoutMs: 10 },
  );
  await assert.rejects(
    harness.provider.generate(request(), signal()),
    /TIMEOUT/,
  );
  assert.equal(observed.aborted, true);
  const before = harness.receipts();
  resolve(reply());
  await new Promise((done) => setTimeout(done, 5));
  assert.deepEqual(harness.receipts(), before);
});
test("abort before dispatch and during request prevents a second call", async () => {
  const cancelled = new AbortController();
  cancelled.abort();
  let sent = 0;
  const harness = createSyntheticMigrationHarness(context(), async () => {
    sent++;
    return reply();
  });
  await assert.rejects(
    harness.provider.generate(request(), cancelled.signal),
    /CANCELLED/,
  );
  assert.equal(sent, 0);
  const controller = new AbortController();
  const pending = createSyntheticMigrationHarness(context(), async () => {
    controller.abort();
    return reply();
  });
  await assert.rejects(
    pending.provider.generate(request(), controller.signal),
    /CANCELLED/,
  );
  assert.equal(pending.receipts()[0].status, "ERROR");
});
test("quota and request sequence are bounded independently of orchestrator", async () => {
  const harness = createSyntheticMigrationHarness(
    context(),
    async () => reply(),
    { maxCalls: 1 },
  );
  await assert.rejects(
    harness.provider.generate(request(2), signal()),
    /REQUEST_SEQUENCE/,
  );
  await harness.provider.generate(request(), signal());
  await assert.rejects(
    harness.provider.generate(request(2), signal()),
    /QUOTA_EXHAUSTED/,
  );
  assert.equal(harness.receipts().length, 1);
});
test("partial writer failure prevents SHA admission and verifier execution", async (t) => {
  const s = session(t);
  const c = context();
  const value = envelope();
  value.changes.push({
    path: "src/z.ts",
    content: "export const unitOnly = true;",
  });
  const harness = createSyntheticMigrationHarness(c, async () => reply(value));
  const original = fs.writeFileSync;
  let writes = 0;
  t.mock.method(fs, "writeFileSync", (...args) => {
    if (++writes === 2) throw new Error("private disk failure");
    return original(...args);
  });
  syncBuiltinESMExports();
  let result;
  try {
    result = await runAgent({
      runId: "synthetic-write-failure",
      config: config(),
      benchmark: c.benchmark(),
      provider: harness.provider,
      writer: s.writer,
      verifier: {
        evidenceKind: "synthetic",
        verify() {
          assert.fail("verify");
        },
      },
    });
  } finally {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  }
  assert.equal(result.verdict, "ERROR");
  assert.equal(result.reason, "PORT_OR_RESPONSE_ERROR");
  await assert.rejects(s.acquire(s.writer.root, signal()), /SOURCE_IDENTITY/);
});
test("unknown paid usage in a simulated paid port blocks writer and further calls", async () => {
  let calls = 0;
  const c = context();
  const result = await runAgent({
    runId: "synthetic-paid-error-control",
    config: config(),
    benchmark: c.benchmark(),
    provider: {
      billing: "paid",
      maxRequestCostUsd: 0.25,
      async generate() {
        calls++;
        throw new Error("simulated disconnect");
      },
    },
    writer: {
      root: "none",
      write() {
        assert.fail("write");
      },
    },
    verifier: {
      evidenceKind: "synthetic",
      verify() {
        assert.fail("verify");
      },
    },
  });
  assert.equal(calls, 1);
  assert.equal(result.totalModelSpendUsd, null);
  assert.equal(result.reservedModelSpendUsd, 0.25);
});
test("codec preserves unknown tokens/version/charged cost instead of inventing measurements", () => {
  const decoded = decodeMigrationReply(
    JSON.stringify(envelope()),
    identity,
    3,
    0,
  );
  assert.equal(decoded.response.usage.inputTokens, null);
  assert.equal(decoded.modelVersion, null);
  assert.equal(decoded.chargedCostUsd, null);
});

test("transport diagnostic is redacted and concurrent calls cannot consume another attempt", async () => {
  let release;
  let calls = 0;
  const harness = createSyntheticMigrationHarness(context(), () => {
    calls++;
    return new Promise((_, reject) => {
      release = reject;
    });
  });
  const first = harness.provider.generate(request(), signal());
  await new Promise((done) => setImmediate(done));
  await assert.rejects(
    harness.provider.generate(request(2), signal()),
    /QUOTA_EXHAUSTED/,
  );
  release(new Error("private-token-and-body-sentinel"));
  await assert.rejects(first, /^Error: TRANSPORT_ERROR$/);
  assert.equal(calls, 1);
  assert.equal(JSON.stringify(harness.receipts()).includes("sentinel"), false);
});

test("normalized paid reply without settled cost remains UNKNOWN_PAID_USAGE", () => {
  assert.throws(
    () =>
      decodeMigrationReply(
        JSON.stringify(envelope()),
        { ...identity, billing: "paid" },
        1,
        0.25,
      ),
    /UNKNOWN_PAID_USAGE/,
  );
});

for (const selection of ["none", "meta", "local"]) {
  test(`workflow ${selection} publishes only an explicit NOT_RUN receipt`, (t) => {
    const root = fileURLToPath(new URL("../../../", import.meta.url));
    const output = mkdtempSync(join(tmpdir(), "mmp061-workflow-test-"));
    t.after(() => rmSync(output, { recursive: true, force: true }));
    const head = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim();
    const result = spawnSync(
      process.execPath,
      ["research/mmp-061/run-e2e.mjs", selection],
      {
        cwd: root,
        encoding: "utf8",
        timeout: 10000,
        env: {
          ...process.env,
          AGENT_HEAD_SHA: head,
          MMP061_PUBLIC_OUTPUT: output,
          GITHUB_RUN_ID: "123456",
          GITHUB_REPOSITORY: "Meta-Project2026/Metamorph",
        },
      },
    );
    assert.equal(result.status, 2, result.stderr);
    const receipt = JSON.parse(
      readFileSync(join(output, "trial.json"), "utf8"),
    );
    assert.equal(receipt.headSha, head);
    assert.equal(receipt.aiGeneration, "AI_GENERATION_NOT_RUN");
    assert.equal(receipt.execution, "ADMISSION_ONLY");
    assert.equal(receipt.modelTrialRunUrl, null);
    assert.equal(receipt.generatedRequests, 0);
    assert.equal(receipt.candidateSha, null);
    assert.equal(receipt.totalCostUsd, null);
    assert.equal(receipt.cleanup.status, "NOT_RUN");
    assert.equal(
      receipt.workflowRunUrl,
      "https://github.com/Meta-Project2026/Metamorph/actions/runs/123456",
    );
    assert.deepEqual(receipt.attempts, []);
    assert.doesNotMatch(
      result.stdout + result.stderr + JSON.stringify(receipt),
      /<\?php|syntheticTransportOnly|export const/,
    );
  });
}
test("workflow wrong SHA or synthetic selection is ERROR, never a harmless skip", (t) => {
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  const output = mkdtempSync(join(tmpdir(), "mmp061-workflow-error-"));
  t.after(() => rmSync(output, { recursive: true, force: true }));
  for (const selection of ["none", "synthetic"]) {
    const result = spawnSync(
      process.execPath,
      ["research/mmp-061/run-e2e.mjs", selection],
      {
        cwd: root,
        encoding: "utf8",
        timeout: 10000,
        env: {
          ...process.env,
          AGENT_HEAD_SHA: "0".repeat(40),
          MMP061_PUBLIC_OUTPUT: output,
        },
      },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /MMP061_WORKFLOW_ERROR/);
    assert.equal(fs.existsSync(join(output, "trial.json")), false);
  }
});
