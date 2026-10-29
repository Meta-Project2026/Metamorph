import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { generateKeyPairSync, sign } from "node:crypto";
import { EventEmitter } from "node:events";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import https from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  META_OWNERS,
  validateMetaEnvironment,
  validateWorkflowIdentity,
  verifyHostedMetaPolicy,
} from "../src/github-meta-guard.mjs";
import {
  createMetaMigrationProvider,
  prepareMetaMigration,
} from "../src/meta-migration.mjs";
import {
  authorizePaidWorkflow,
  PAID_POLICY,
  paidAdmission,
  paidProjection,
} from "../src/meta-paid-authorization.mjs";
import { bindMigrationContext } from "../src/migration-context.mjs";
import { migrationProviderStatus } from "../src/migration-provider.mjs";
import { runPublicMigration } from "../src/migration-trial.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
const source = readFileSync(
  join(root, "research/mmp-061/public-source.json"),
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
const key = "LLM_123_FAKE_OFFLINE_ONLY";
const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const jwk = {
  ...publicKey.export({ format: "jwk" }),
  kid: "offline-key",
  alg: "RS256",
  use: "sig",
};
const metadata = () => ({
  repository: {
    full_name: "Meta-Project2026/Metamorph",
    private: false,
    default_branch: "main",
  },
  branch: { protected: true, commit: { sha: head } },
  environment: {
    name: "META_API_KEY",
    protection_rules: [{ type: "branch_policy" }],
    deployment_branch_policy: {
      custom_branch_policies: true,
      protected_branches: false,
    },
  },
  policies: {
    total_count: 1,
    branch_policies: [{ type: "branch", name: "main" }],
  },
});
const inputs = () => ({
  reviewed_sha: head,
  confirm_paid: "I_ACCEPT_ONE_PAID_ATTEMPT_NO_HARD_CAP",
  max_estimated_usd: "1.00",
  model_provider: "meta",
});
function environment(t, actor = "barbalatv", run = "12345") {
  const directory = mkdtempSync(join(tmpdir(), "meta-paid-unit-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const values = {
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_REPOSITORY: "Meta-Project2026/Metamorph",
    GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: head,
    GITHUB_ACTOR: actor,
    GITHUB_ACTOR_ID: META_OWNERS[actor],
    GITHUB_RUN_ID: run,
    GITHUB_RUN_ATTEMPT: "1",
    GITHUB_WORKFLOW_REF:
      "Meta-Project2026/Metamorph/.github/workflows/meta-paid-migration.yml@refs/heads/main",
    RUNNER_ENVIRONMENT: "github-hosted",
    RUNNER_TEMP: directory,
    GITHUB_EVENT_PATH: join(directory, "event.json"),
    GH_TOKEN: "fake-github-token",
    ACTIONS_ID_TOKEN_REQUEST_URL:
      "https://offline.actions.githubusercontent.com/oidc",
    ACTIONS_ID_TOKEN_REQUEST_TOKEN: "fake-oidc-request-token",
    MODEL_API_KEY: key,
  };
  for (const [name, value] of Object.entries(values)) {
    const before = process.env[name];
    process.env[name] = value;
    t.after(() => {
      if (before === undefined) delete process.env[name];
      else process.env[name] = before;
    });
  }
  writeFileSync(values.GITHUB_EVENT_PATH, JSON.stringify({ inputs: inputs() }));
  return { values, directory };
}
function signedRun(t, actor = "barbalatv", run = "12345", mutate = () => {}) {
  const env = environment(t, actor, run);
  const now = Date.parse("2026-10-29T16:00:00Z");
  t.mock.method(Date, "now", () => now);
  const claims = {
    iss: "https://token.actions.githubusercontent.com",
    aud: PAID_POLICY.version,
    iat: now / 1000,
    exp: now / 1000 + 300,
    sub: "repo:Meta-Project2026@348421102/Metamorph@1434945189:environment:META_API_KEY",
    repository_id: "1434945189",
    repository_owner_id: "348421102",
    environment: "META_API_KEY",
    repository: "Meta-Project2026/Metamorph",
    repository_visibility: "public",
    ref: "refs/heads/main",
    ref_protected: "true",
    sha: head,
    workflow_sha: head,
    workflow_ref: env.values.GITHUB_WORKFLOW_REF,
    event_name: "workflow_dispatch",
    actor,
    actor_id: META_OWNERS[actor],
    run_id: run,
    run_attempt: "1",
    runner_environment: "github-hosted",
  };
  mutate(claims);
  const encode = (v) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const content = `${encode({ alg: "RS256", typ: "JWT", kid: jwk.kid })}.${encode(claims)}`;
  const token = `${content}.${sign("RSA-SHA256", Buffer.from(content), privateKey).toString("base64url")}`;
  const m = metadata();
  const urls = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    urls.push(String(url));
    assert.doesNotMatch(String(url), /api\.meta\.ai/);
    let value;
    if (String(url).startsWith(env.values.ACTIONS_ID_TOKEN_REQUEST_URL))
      value = { value: token };
    else if (
      String(url) ===
      "https://token.actions.githubusercontent.com/.well-known/jwks"
    )
      value = { keys: [jwk] };
    else if (String(url).endsWith("/deployment-branch-policies"))
      value = m.policies;
    else if (String(url).endsWith("/environments/META_API_KEY"))
      value = m.environment;
    else if (String(url).endsWith("/branches/main")) value = m.branch;
    else value = m.repository;
    return new Response(JSON.stringify(value), { status: 200 });
  });
  return { ...env, urls, claims, metadata: m };
}
const envelope = () => ({
  id: "chatcmpl-offline",
  object: "chat.completion",
  created: 1,
  model: "muse-spark-1.3",
  choices: [
    {
      index: 0,
      finish_reason: "stop",
      message: {
        role: "assistant",
        refusal: null,
        content: JSON.stringify({
          changes: [
            { path: "src/main.ts", content: "export const offlineOnly = 1;" },
          ],
        }),
      },
    },
  ],
  usage: {
    prompt_tokens: 1000,
    completion_tokens: 100,
    total_tokens: 1100,
    prompt_tokens_details: { cached_tokens: 100 },
    completion_tokens_details: { reasoning_tokens: 40 },
  },
});
function nativeStub(t, plan = {}) {
  const calls = [];
  t.mock.method(https, "request", (url, options, callback) => {
    assert.equal(url, "https://api.meta.ai/v1/chat/completions");
    assert.equal(options.method, "POST");
    assert.equal(options.headers.Authorization, `Bearer ${key}`);
    const req = new EventEmitter();
    req.destroy = () => {
      if (!req.destroyed) {
        req.destroyed = true;
        queueMicrotask(() => req.emit("close"));
      }
    };
    req.end = (body) => {
      calls.push(JSON.parse(body));
      queueMicrotask(() => {
        if (plan.hang) return;
        if (plan.disconnect) {
          req.emit("error", Error("private_provider_sentinel"));
          return;
        }
        const res = new EventEmitter();
        res.socket = { authorized: true };
        res.statusCode = plan.status ?? 200;
        res.headers = { "content-type": "application/json" };
        res.complete = true;
        res.destroy = () => {};
        callback(res);
        res.emit("data", Buffer.from(plan.body ?? JSON.stringify(envelope())));
        res.emit("end");
      });
    };
    return req;
  });
  return calls;
}

test("new no-reviewer/main-only policy passes; every stale or unknown protection fails", () => {
  assert.equal(validateMetaEnvironment(metadata(), head).status, "VERIFIED");
  for (const mutate of [
    (m) => {
      m.branch.protected = false;
    },
    (m) => {
      m.branch.commit.sha = "0".repeat(40);
    },
    (m) => {
      m.repository.full_name = "fork/repo";
    },
    (m) => {
      m.environment = null;
    },
    (m) => {
      m.environment.protection_rules.push({
        type: "required_reviewers",
        reviewers: ["owner"],
      });
    },
    (m) => {
      m.environment.protection_rules.push({
        type: "wait_timer",
        wait_timer: 0,
      });
    },
    (m) => {
      m.environment.protection_rules.push({ type: "custom_rule" });
    },
    (m) => {
      m.environment.deployment_branch_policy.custom_branch_policies = false;
    },
    (m) => {
      m.policies.total_count = 2;
      m.policies.branch_policies.push({ name: "*", type: "branch" });
    },
    (m) => {
      m.policies.branch_policies[0].type = "tag";
    },
    (m) => {
      m.policies.branch_policies[0].name = "main*";
    },
  ]) {
    const m = metadata();
    mutate(m);
    assert.throws(() => validateMetaEnvironment(m, head));
  }
});
test("wrong SHA/branch/event/repo/actor and absent confirmation/budget/provider/reruns block", (t) => {
  const { values } = environment(t);
  validateWorkflowIdentity(values, head, inputs(), true);
  for (const [name, value] of Object.entries({
    GITHUB_SHA: "0".repeat(40),
    GITHUB_REF: "refs/pull/1/merge",
    GITHUB_EVENT_NAME: "pull_request",
    GITHUB_REPOSITORY: "fork/repo",
    GITHUB_ACTOR: "other",
    GITHUB_ACTOR_ID: "123",
    GITHUB_RUN_ATTEMPT: "2",
    RUNNER_ENVIRONMENT: "self-hosted",
  }))
    assert.throws(() =>
      validateWorkflowIdentity(
        { ...values, [name]: value },
        head,
        inputs(),
        true,
      ),
    );
  for (const [name, value] of Object.entries({
    reviewed_sha: "0".repeat(40),
    confirm_paid: "true",
    max_estimated_usd: "NaN",
    model_provider: "local",
  }))
    assert.throws(() =>
      validateWorkflowIdentity(
        values,
        head,
        { ...inputs(), [name]: value },
        true,
      ),
    );
});
for (const status of [403, 404, 500])
  test(`metadata HTTP ${status} fails closed without a Meta request`, async (t) => {
    t.mock.method(
      globalThis,
      "fetch",
      async () => new Response("{}", { status }),
    );
    await assert.rejects(verifyHostedMetaPolicy(head, "fake"), {
      code: "GITHUB_METADATA_UNVERIFIED",
    });
  });
test("all library/synthetic defaults and copied/forged authorizations stay closed", () => {
  const c = context();
  assert.equal(migrationProviderStatus("meta").admitted, false);
  for (const a of [
    {},
    { kind: PAID_POLICY.version, maxEstimatedUsd: 1 },
    { approved: true },
  ]) {
    assert.throws(() => paidAdmission(a, c), {
      code: "PAID_DISPATCH_NOT_AUTHORIZED",
    });
    assert.throws(() => createMetaMigrationProvider(c, { authorization: a }));
  }
});
for (const [field, value] of Object.entries({
  actor: "stranger",
  sha: "0".repeat(40),
  workflow_sha: "0".repeat(40),
  ref: "refs/pull/1/head",
  run_id: "other",
  environment: "OTHER",
  aud: "other",
  exp: 0,
  sub: "repo:fork/repo:environment:META_API_KEY",
}))
  test(`signed identity wrong ${field} is blocked`, async (t) => {
    signedRun(t, "barbalatv", "12345", (c) => {
      c[field] = value;
    });
    await assert.rejects(authorizePaidWorkflow(context()), {
      code: "SIGNED_IDENTITY_BLOCKED",
    });
  });
test("native production chain reaches schema/writer/SHA only after signed identity; receipt is sanitized", async (t) => {
  const { directory } = signedRun(t);
  const calls = nativeStub(t);
  const c = context(),
    a = await authorizePaidWorkflow(c);
  assert.equal(migrationProviderStatus("meta", a, c).admitted, true);
  assert.throws(() => paidAdmission({ ...a }, c));
  assert.throws(() => paidAdmission(a, context()));
  const checkpoints = [];
  const result = await runPublicMigration({
    context: c,
    selection: "meta",
    headSha: head,
    parent: directory,
    signal: signal(),
    authorization: a,
    checkpoint: (r) => checkpoints.push(structuredClone(r)),
  });
  assert.equal(result.modelGeneration, "GENERATED");
  assert.match(result.candidateSha, /^[a-f0-9]{64}$/);
  assert.equal(result.modelReceipts[0].candidateSha, result.candidateSha);
  assert.equal(result.generatedRequests, 1);
  assert.equal(result.chargedCostUsd, null);
  assert.equal(result.publicG1, "NOT_RUN");
  assert.equal(result.product, "NOT_ESTABLISHED");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].reasoning_effort, "low");
  assert.equal(calls[0].max_completion_tokens, 16384);
  assert.equal(checkpoints[0].networkSend, "UNKNOWN");
  assert.equal(result.modelReceipts[0].usageStatus, "ESTIMATE_ONLY");
  assert.equal(
    result.modelReceipts[0].estimatedCostUsd,
    (900 * 1.25 + 100 * 0.15 + 100 * 4.25) / 1e6,
  );
  assert.doesNotMatch(
    JSON.stringify(result),
    /offlineOnly|FAKE_OFFLINE|Bearer|private_provider_sentinel|candidateRoot/,
  );
  assert.equal(
    JSON.parse(
      readFileSync(join(directory, "mmp078-12345-attempt.json"), "utf8"),
    ).chargedCostUsd,
    null,
  );
});
test("one capability across two sessions/racing POSTs admits only one native request", async (t) => {
  signedRun(t);
  const calls = nativeStub(t);
  const c = context(),
    a = await authorizePaidWorkflow(c);
  const p = createMetaMigrationProvider(c, { authorization: a }),
    q = createMetaMigrationProvider(c, { authorization: a });
  const results = await Promise.allSettled([
    p.provider.generate(request, signal()),
    q.provider.generate(request, signal()),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(calls.length, 1);
  await assert.rejects(p.provider.generate(request, signal()));
});
test("separately issued capability for same run cannot bypass durable run ledger", async (t) => {
  signedRun(t);
  const calls = nativeStub(t);
  const c = context();
  const a = await authorizePaidWorkflow(c),
    b = await authorizePaidWorkflow(c);
  await createMetaMigrationProvider(c, { authorization: a }).provider.generate(
    request,
    signal(),
  );
  await assert.rejects(
    createMetaMigrationProvider(c, { authorization: b }).provider.generate(
      request,
      signal(),
    ),
    { code: "REQUEST_LIMIT" },
  );
  assert.equal(calls.length, 1);
});
test("both owners have independent concurrently usable capabilities/receipts without global ledger", async (t) => {
  const one = signedRun(t, "barbalatv", "11111"),
    calls = nativeStub(t),
    c = context();
  const a = await authorizePaidWorkflow(c);
  process.env.GITHUB_ACTOR = "l1ncolny";
  process.env.GITHUB_ACTOR_ID = META_OWNERS.l1ncolny;
  process.env.GITHUB_RUN_ID = "22222";
  one.claims.actor = "l1ncolny";
  one.claims.actor_id = META_OWNERS.l1ncolny;
  one.claims.run_id = "22222";
  // Reissue from a second independently signed test run, not by cloning capability.
  signedRun(t, "l1ncolny", "22222");
  const b = await authorizePaidWorkflow(c);
  const result = await Promise.all([
    createMetaMigrationProvider(c, { authorization: a }).provider.generate(
      request,
      signal(),
    ),
    createMetaMigrationProvider(c, { authorization: b }).provider.generate(
      request,
      signal(),
    ),
  ]);
  assert.equal(result.length, 2);
  assert.equal(calls.length, 2);
  assert.notEqual(a.runId, b.runId);
  assert.notEqual(a.actor, b.actor);
});
for (const plan of [
  { status: 429 },
  { status: 500 },
  { disconnect: true },
  { body: "{}" },
  { body: "" },
])
  test(`production uncertain send ${JSON.stringify(plan)} never retries or claims settlement`, async (t) => {
    signedRun(t);
    const calls = nativeStub(t, plan);
    const c = context(),
      a = await authorizePaidWorkflow(c),
      p = createMetaMigrationProvider(c, { authorization: a });
    await assert.rejects(p.provider.generate(request, signal()));
    await assert.rejects(p.provider.generate(request, signal()));
    assert.equal(calls.length, 1);
    assert.equal(p.receipts()[0].chargedCostUsd, null);
    assert.equal(p.receipts()[0].usageStatus, "UNKNOWN");
    assert.equal(p.receipts()[0].status, "ERROR");
  });
test("missing credential makes zero native requests; cancel after possible send remains unknown", async (t) => {
  signedRun(t);
  const calls = nativeStub(t, { hang: true });
  const c = context(),
    a = await authorizePaidWorkflow(c);
  delete process.env.MODEL_API_KEY;
  const p = createMetaMigrationProvider(c, { authorization: a });
  await assert.rejects(p.provider.generate(request, signal()), {
    code: "AUTH_ABSENT",
  });
  assert.equal(calls.length, 0);
  process.env.MODEL_API_KEY = key;
  const q = createMetaMigrationProvider(c, { authorization: a }),
    controller = new AbortController();
  const pending = q.provider.generate(request, controller.signal);
  await new Promise((resolve) => setImmediate(resolve));
  controller.abort();
  await assert.rejects(pending, { code: "CANCELLED" });
  assert.equal(calls.length, 1);
  assert.equal(q.receipts()[0].networkSend, "UNKNOWN");
  assert.equal(q.receipts()[0].chargedCostUsd, null);
});
test("pre-send projection counts whole protocol bytes with overhead, not Responses token count", () => {
  const body = prepareMetaMigration(context(), request),
    p = paidProjection(body);
  assert.equal(p.inputTokensUpperEstimate, Buffer.byteLength(body) * 4 + 32768);
  assert.ok(p.worstCaseEstimatedUsd < 1);
  assert.ok(p.worstCaseEstimatedUsd > 0);
});
test("a selected USD 0.10 projection allowance blocks the pinned USD 0.220377 workload before send", async (t) => {
  const e = signedRun(t),
    calls = nativeStub(t);
  writeFileSync(
    e.values.GITHUB_EVENT_PATH,
    JSON.stringify({ inputs: { ...inputs(), max_estimated_usd: "0.10" } }),
  );
  await assert.rejects(authorizePaidWorkflow(context()), {
    code: "ESTIMATED_BUDGET_BLOCKED",
  });
  assert.equal(calls.length, 0);
});
test("production deadline joins a possibly sent native call and prohibits retry", async (t) => {
  signedRun(t);
  const calls = nativeStub(t, { hang: true }),
    c = context(),
    a = await authorizePaidWorkflow(c);
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const p = createMetaMigrationProvider(c, { authorization: a });
  const pending = p.provider.generate(request, signal());
  const rejection = assert.rejects(pending, { code: "TIMEOUT" });
  await new Promise((resolve) => setImmediate(resolve));
  t.mock.timers.tick(180001);
  await rejection;
  await assert.rejects(p.provider.generate(request, signal()));
  assert.equal(calls.length, 1);
  assert.equal(p.receipts()[0].networkSend, "UNKNOWN");
  assert.equal(p.receipts()[0].chargedCostUsd, null);
});
test("exhausted tariff and downward budget block before any Meta network", async (t) => {
  const e = signedRun(t);
  const calls = nativeStub(t);
  t.mock.method(Date, "now", () => Date.parse("2026-11-06T00:00:00Z"));
  await assert.rejects(authorizePaidWorkflow(context()), {
    code: "TARIFF_EXPIRED",
  });
  assert.equal(calls.length, 0);
  writeFileSync(
    e.values.GITHUB_EVENT_PATH,
    JSON.stringify({ inputs: { ...inputs(), max_estimated_usd: "0" } }),
  );
  await assert.rejects(authorizePaidWorkflow(context()));
});
test("workflow maps one secret to one step only; per-owner queue and explicit public files", () => {
  const yml = readFileSync(
    join(root, ".github/workflows/meta-paid-migration.yml"),
    "utf8",
  );
  assert.match(yml, /group: meta-paid-\$\{\{ github.actor \}\}/);
  assert.match(yml, /cancel-in-progress: false/);
  assert.doesNotMatch(yml, /pull_request|pull_request_target|push:|\*\.json/);
  assert.equal((yml.match(/secrets\.META/g) ?? []).length, 1);
  assert.match(yml, /id-token: write/);
  assert.ok(yml.indexOf("pnpm build") < yml.indexOf("MODEL_API_KEY:"));
  assert.match(yml, /retention-days: 7/);
  const networkStep = yml.split("id: generation")[1].split("- name:")[0];
  assert.match(networkStep, /if: \$\{\{ !inputs.validate_only \}\}/);
  const validation = readFileSync(
    join(root, "research/mmp-078/validate-authorization.mjs"),
    "utf8",
  );
  assert.doesNotMatch(
    validation,
    /createMetaMigrationProvider|runPublicMigration|metaHttpsExchange/,
  );
  assert.match(validation, /authorizePaidWorkflow\(context\)/);
});
