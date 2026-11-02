// Original synthetic data and local signed-OIDC/HTTPS adapters. No network/model.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { EventEmitter } from "node:events";
import { readFileSync, writeFileSync } from "node:fs";
import https from "node:https";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { MANIFEST_SHA256, SOURCE } from "@metamorph/oracle";
import { sha256, validateBundle } from "../../target-worker/src/admission.mjs";
import { CUSTODY, CUSTODY_LICENSE } from "../src/custody-contract.mjs";
import { prepareMetaMigration } from "../src/meta-migration.mjs";
import {
  authorizePaidWorkflow,
  PAID_POLICY,
} from "../src/meta-paid-authorization.mjs";
import { bindMigrationContext } from "../src/migration-context.mjs";

export const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
export const SOURCE_INPUT = readFileSync(
  join(ROOT, "research/mmp-061/public-source.json"),
  "utf8",
);
export function syntheticCapsule() {
  const source = JSON.parse(SOURCE_INPUT),
    context = bindMigrationContext(SOURCE_INPUT);
  const content = `/*\n${source.license.trim()}\n*/\nexport const originalSyntheticCustody = 115;\n`;
  const bundle = validateBundle([
    { path: "src/main.ts", content, sha256: sha256(content) },
  ]);
  return {
    format: CUSTODY.format,
    verification: "UNVERIFIED",
    attemptKind: "GENERATION_CUSTODY",
    identity: {
      runId: "115001",
      runAttempt: "1",
      headSha: execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: ROOT,
        encoding: "utf8",
      }).trim(),
      sourceSha: SOURCE.commit,
      candidateSha: bundle.candidateSha,
      attemptId: randomUUID(),
    },
    admission: {
      generationAttempt: 1,
      requestBodySha256: sha256(
        prepareMetaMigration(context, {
          unitId: "workshop-api",
          tier: "spark",
          action: "generate",
          attempt: 1,
          repairFeedback: null,
        }),
      ),
      responseSha256: "a".repeat(64),
      contextSha256: context.contextSha256,
      manifestSha256: MANIFEST_SHA256,
    },
    license: CUSTODY_LICENSE,
    manifest: bundle.files.map((f) => ({
      path: f.path,
      bytes: Buffer.byteLength(f.content),
      sha256: f.sha256,
    })),
    files: bundle.files,
  };
}
export function artifactFixture(capture) {
  const id = capture.identity;
  return {
    ack: {
      artifactId: "115002",
      archiveSha256: "d".repeat(64),
      uploadOutcome: "success",
      downloadOutcome: "success",
    },
    artifact: {
      id: 115002,
      name: `mmp107-candidate-${id.runId}-1`,
      expired: false,
      digest: `sha256:${"d".repeat(64)}`,
      size_in_bytes: 500,
      workflow_run: {
        id: Number(id.runId),
        head_sha: id.headSha,
        repository_id: 1434945189,
        head_repository_id: 1434945189,
      },
    },
    run: {
      id: Number(id.runId),
      head_sha: id.headSha,
      run_attempt: 1,
      event: "workflow_dispatch",
      path: ".github/workflows/meta-paid-migration.yml",
      repository: { id: 1434945189, full_name: "Meta-Project2026/Metamorph" },
      head_repository: {
        id: 1434945189,
        full_name: "Meta-Project2026/Metamorph",
      },
    },
    finalizer: {
      format: "mmp115-pre-oracle-finalizer-v1",
      phase: "PRE_ORACLE",
      identity: id,
      containers: 0,
      volumes: 0,
      emergencyRemoved: 0,
    },
  };
}
export async function offlinePaid(t, directory, capsule = syntheticCapsule()) {
  const head = capsule.identity.headSha,
    context = bindMigrationContext(SOURCE_INPUT),
    actor = "l1ncolny";
  const values = {
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_REPOSITORY: "Meta-Project2026/Metamorph",
    GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: head,
    GITHUB_ACTOR: actor,
    GITHUB_ACTOR_ID: "338248494",
    GITHUB_RUN_ID: capsule.identity.runId,
    GITHUB_RUN_ATTEMPT: "1",
    GITHUB_WORKFLOW_REF:
      "Meta-Project2026/Metamorph/.github/workflows/meta-paid-migration.yml@refs/heads/main",
    RUNNER_ENVIRONMENT: "github-hosted",
    RUNNER_TEMP: directory,
    GITHUB_EVENT_PATH: join(directory, "event.json"),
    GH_TOKEN: "fake-github-only",
    ACTIONS_ID_TOKEN_REQUEST_URL:
      "https://offline.actions.githubusercontent.com/oidc",
    ACTIONS_ID_TOKEN_REQUEST_TOKEN: "fake-oidc-only",
    MODEL_API_KEY: "LLM_115_FAKE_OFFLINE_ONLY",
  };
  for (const [key, value] of Object.entries(values)) {
    const before = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (before === undefined) delete process.env[key];
      else process.env[key] = before;
    });
  }
  writeFileSync(
    values.GITHUB_EVENT_PATH,
    JSON.stringify({
      inputs: {
        reviewed_sha: head,
        confirm_paid: "I_ACCEPT_ONE_PAID_ATTEMPT_NO_HARD_CAP",
        max_estimated_usd: "1.00",
        model_provider: "meta",
      },
    }),
  );
  const now = Date.parse("2026-11-02T00:00:00Z");
  t.mock.method(Date, "now", () => now);
  const keys = generateKeyPairSync("rsa", { modulusLength: 2048 }),
    jwk = {
      ...keys.publicKey.export({ format: "jwk" }),
      kid: "custody-offline",
      alg: "RS256",
      use: "sig",
    };
  const claims = {
    iss: "https://token.actions.githubusercontent.com",
    aud: PAID_POLICY.version,
    iat: now / 1000,
    exp: now / 1000 + 300,
    sub: "repo:Meta-Project2026@348421102/Metamorph@1434945189:environment:META_API_KEY",
    repository_id: "1434945189",
    repository_owner_id: "348421102",
    environment: "META_API_KEY",
    repository: values.GITHUB_REPOSITORY,
    repository_visibility: "public",
    ref: values.GITHUB_REF,
    ref_protected: "true",
    sha: head,
    workflow_sha: head,
    workflow_ref: values.GITHUB_WORKFLOW_REF,
    event_name: values.GITHUB_EVENT_NAME,
    actor,
    actor_id: values.GITHUB_ACTOR_ID,
    run_id: values.GITHUB_RUN_ID,
    run_attempt: "1",
    runner_environment: "github-hosted",
  };
  const encode = (v) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const content = `${encode({ alg: "RS256", typ: "JWT", kid: jwk.kid })}.${encode(claims)}`;
  const token = `${content}.${sign("RSA-SHA256", Buffer.from(content), keys.privateKey).toString("base64url")}`;
  t.mock.method(globalThis, "fetch", async (url) => {
    let value;
    const u = String(url);
    if (u.startsWith(values.ACTIONS_ID_TOKEN_REQUEST_URL))
      value = { value: token };
    else if (
      u === "https://token.actions.githubusercontent.com/.well-known/jwks"
    )
      value = { keys: [jwk] };
    else if (u.endsWith("/deployment-branch-policies"))
      value = {
        total_count: 1,
        branch_policies: [{ type: "branch", name: "main" }],
      };
    else if (u.endsWith("/environments/META_API_KEY"))
      value = {
        name: "META_API_KEY",
        protection_rules: [{ type: "branch_policy" }],
        deployment_branch_policy: {
          custom_branch_policies: true,
          protected_branches: false,
        },
      };
    else if (u.endsWith("/branches/main"))
      value = { protected: true, commit: { sha: head } };
    else if (u === "https://api.github.com/repos/Meta-Project2026/Metamorph")
      value = {
        full_name: values.GITHUB_REPOSITORY,
        private: false,
        default_branch: "main",
      };
    else throw new Error("NETWORK_DENIED_IN_SYNTHETIC_CONTROL");
    return new Response(JSON.stringify(value), { status: 200 });
  });
  const calls = [];
  t.mock.method(https, "request", (url, options, callback) => {
    assert.equal(url, "https://api.meta.ai/v1/chat/completions");
    assert.equal(options.method, "POST");
    const req = new EventEmitter();
    req.destroy = () => {
      if (!req.destroyed) {
        req.destroyed = true;
        queueMicrotask(() => req.emit("close"));
      }
    };
    req.end = (body) => {
      calls.push(body);
      queueMicrotask(() => {
        const res = new EventEmitter();
        res.socket = { authorized: true };
        res.statusCode = 200;
        res.headers = { "content-type": "application/json" };
        res.complete = true;
        res.destroy = () => {};
        const body = {
          id: "chatcmpl-synthetic-custody",
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
                  changes: capsule.files.map(({ path, content }) => ({
                    path,
                    content,
                  })),
                }),
              },
            },
          ],
          usage: {
            prompt_tokens: 1000,
            completion_tokens: 100,
            total_tokens: 1100,
            prompt_tokens_details: { cached_tokens: 0 },
            completion_tokens_details: { reasoning_tokens: 0 },
          },
        };
        callback(res);
        res.emit("data", Buffer.from(JSON.stringify(body)));
        res.emit("end");
      });
    };
    return req;
  });
  return {
    context,
    authorization: await authorizePaidWorkflow(context),
    calls,
    capsule,
    values,
  };
}
