// MMP-158 P0/P1 regression: production entrypoints and authorizers with
// cryptographically faked test OIDC, stubbed GitHub metadata/API and a
// stubbed Meta transport. No real API, credential, Docker or paid action.
// The full two-attempt simulation runs only on Linux (hosted CI); the
// authorizer regressions run everywhere.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { EventEmitter } from "node:events";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import https from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { MANIFEST_SHA256, SOURCE } from "@metamorph/oracle";
import { sha256, validateBundle } from "../../target-worker/src/admission.mjs";
import { publicRepairDecision } from "../src/autonomous-repair.mjs";
import {
  CUSTODY,
  CUSTODY_LICENSE,
  receiptFor,
  requireCustody,
} from "../src/custody-contract.mjs";
import {
  commitPrivate,
  commitRecord,
  privateDirectory,
} from "../src/custody-files.mjs";
import { custodyStep } from "../src/custody-steps.mjs";
import { repairScorecard } from "../src/live-experiment.mjs";
import {
  createMetaMigrationProvider,
  prepareMetaMigration,
} from "../src/meta-migration.mjs";
import {
  authorizePaidWorkflow,
  PAID_POLICY,
  paidPreflight,
  repairProjection,
  reservePaidAttempt,
} from "../src/meta-paid-authorization.mjs";
import { bindMigrationContext } from "../src/migration-context.mjs";
import { artifactFixture, syntheticCapsule } from "./custody-fixture.mjs";

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
const signal = () => new AbortController().signal;
const key = "LLM_158_FAKE_OFFLINE_ONLY";
// syntheticCapsule() pins runId 115001; every identity in this file reuses it.
const RUN = "115001";
const FIRST_CANDIDATE = "4".repeat(64);
const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const jwk = {
  ...publicKey.export({ format: "jwk" }),
  kid: "repair-entrypoint",
  alg: "RS256",
  use: "sig",
};
const twoInputs = () => ({
  reviewed_sha: head,
  execution_mode: "generate_then_repair",
  confirm_paid: "I_ACCEPT_TWO_PAID_ATTEMPTS_NO_HARD_CAP",
  max_estimated_usd: "1.00",
  model_provider: "meta",
});
function environment(
  t,
  {
    actor = "barbalatv",
    run = RUN,
    inputs = twoInputs(),
    withKey = false,
    sha = head,
  } = {},
) {
  const directory = mkdtempSync(join(tmpdir(), "mmp158-entrypoint-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const values = {
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_REPOSITORY: "Meta-Project2026/Metamorph",
    GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: sha,
    GITHUB_ACTOR: actor,
    GITHUB_ACTOR_ID:
      actor === "barbalatv"
        ? "85129726"
        : actor === "l1ncolny"
          ? "338248494"
          : "1",
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
  };
  if (withKey) values.MODEL_API_KEY = key;
  for (const [name, value] of Object.entries(values)) {
    const before = process.env[name];
    process.env[name] = value;
    t.after(() => {
      if (before === undefined) delete process.env[name];
      else process.env[name] = before;
    });
  }
  writeFileSync(values.GITHUB_EVENT_PATH, JSON.stringify({ inputs }));
  return { values, directory };
}

/** Fake OIDC + GitHub metadata/artifact API responder. Never api.meta.ai. */
function fakeIdentity(t, env, claimsMutate = () => {}) {
  const now = Date.parse("2026-11-03T16:00:00Z");
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
    sha: env.values.GITHUB_SHA,
    workflow_sha: env.values.GITHUB_SHA,
    workflow_ref: env.values.GITHUB_WORKFLOW_REF,
    event_name: "workflow_dispatch",
    actor: env.values.GITHUB_ACTOR,
    actor_id: env.values.GITHUB_ACTOR_ID,
    run_id: env.values.GITHUB_RUN_ID,
    run_attempt: "1",
    runner_environment: "github-hosted",
  };
  claimsMutate(claims);
  const encode = (v) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const content = `${encode({ alg: "RS256", typ: "JWT", kid: jwk.kid })}.${encode(claims)}`;
  const token = `${content}.${sign("RSA-SHA256", Buffer.from(content), privateKey).toString("base64url")}`;
  const metadata = {
    repository: {
      full_name: "Meta-Project2026/Metamorph",
      private: false,
      default_branch: "main",
    },
    branch: { protected: true, commit: { sha: env.values.GITHUB_SHA } },
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
  };
  const artifactsById = new Map();
  const respond = (url) => {
    const u = String(url);
    assert.doesNotMatch(u, /api\.meta\.ai/);
    if (u.startsWith(env.values.ACTIONS_ID_TOKEN_REQUEST_URL))
      return { value: token };
    if (u === "https://token.actions.githubusercontent.com/.well-known/jwks")
      return { keys: [jwk] };
    if (u.endsWith("/deployment-branch-policies")) return metadata.policies;
    if (u.endsWith("/environments/META_API_KEY")) return metadata.environment;
    if (u.endsWith("/branches/main")) return metadata.branch;
    if (u === "https://api.github.com/repos/Meta-Project2026/Metamorph")
      return metadata.repository;
    if (/\/actions\/artifacts\/(\d+)$/.test(u)) {
      const stagedRun = artifactsById.get(Number(/(\d+)$/.exec(u)[1]));
      if (stagedRun === undefined) throw new Error("UNSTAGED_ARTIFACT");
      return stagedRun.artifact;
    }
    if (/\/actions\/runs\/(\d+)$/.test(u)) {
      const stagedRun = artifactsById.get(Number(/(\d+)$/.exec(u)[1]));
      if (stagedRun === undefined) throw new Error("UNSTAGED_RUN");
      return stagedRun.run;
    }
    throw new Error("NETWORK_DENIED_IN_SYNTHETIC_CONTROL");
  };
  return {
    claims,
    respond,
    stageArtifactProvenance: (fixture) => {
      artifactsById.set(Number(fixture.artifact.id), fixture);
      artifactsById.set(Number(fixture.run.id), fixture);
    },
  };
}

function installFetch(t, identity) {
  t.mock.method(globalThis, "fetch", async (url) => {
    const value = identity.respond(url);
    return new Response(JSON.stringify(value), { status: 200 });
  });
}

function nativeStub(t, { replyChanges } = {}) {
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
        const res = new EventEmitter();
        res.socket = { authorized: true };
        res.statusCode = 200;
        res.headers = { "content-type": "application/json" };
        res.complete = true;
        res.destroy = () => {};
        const content = JSON.stringify({
          changes: replyChanges ?? [
            {
              path: "src/main.ts",
              content: "export const entrypointReply = 1;",
            },
          ],
        });
        const responseBody = {
          id: "chatcmpl-entrypoint",
          object: "chat.completion",
          created: 1,
          model: "muse-spark-1.3",
          choices: [
            {
              index: 0,
              finish_reason: "stop",
              message: { role: "assistant", refusal: null, content },
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
        res.emit("data", Buffer.from(JSON.stringify(responseBody)));
        res.emit("end");
      });
    };
    return req;
  });
  return calls;
}

const attemptTwoOptions = (previousChanges) => ({
  plan: "generate_then_repair",
  attempt: 2,
  feedback: "HTTP_JSON_TYPE",
  previousChanges,
  firstAttemptEstimatedUsd: 0.05,
  firstAttemptCandidateSha: FIRST_CANDIDATE,
});

test("P0-A: plan-mode attempt-1 admission survives paidPreflight, JSON round-trip and reserves before send", async (t) => {
  const env = environment(t, { withKey: true });
  const identity = fakeIdentity(t, env);
  installFetch(t, identity);
  const calls = nativeStub(t);
  const c = context();
  const authorization = await authorizePaidWorkflow(c, {
    plan: "generate_then_repair",
  });
  assert.equal(authorization.plan, "generate_then_repair");
  assert.equal(authorization.attempt, 1);
  // paidPreflight structuredClones the card: any non-serializable field fails here.
  const card = paidPreflight(authorization, c);
  assert.deepEqual(structuredClone(card), card);
  const round = JSON.parse(JSON.stringify(card));
  assert.equal(round.maximumPosts, 2);
  assert.equal(round.maximumRepairs, 1);
  assert.equal(typeof round.repairProjection, "object");
  assert.equal(round.repairWireBytes, PAID_POLICY.repairWireBytes);
  // Reviewer arithmetic: (96KiB*4+32768) input tokens plus 16384 output tokens
  // at the locked 2026-11-03 tariff.
  assert.equal(repairProjection().worstCaseEstimatedUsd, 0.602112);
  assert.ok(
    Math.abs(
      round.aggregateWorstCaseEstimatedUsd -
        (round.worstCaseEstimatedUsd + 0.602112),
    ) < 1e-9,
  );
  // First pre-send reservation through the production provider session.
  const provider = createMetaMigrationProvider(c, { authorization });
  const response = await provider.provider.generate(
    {
      unitId: "workshop-api",
      tier: "spark",
      action: "generate",
      attempt: 1,
      repairFeedback: null,
    },
    signal(),
  );
  assert.equal(calls.length, 1);
  assert.equal(response.changes.length, 1);
  assert.ok(
    existsSync(join(env.values.RUNNER_TEMP, `mmp078-${RUN}-attempt.json`)),
  );
  assert.ok(
    existsSync(join(env.values.RUNNER_TEMP, `mmp154-${RUN}-preflight.json`)),
  );
  // single_generation stays unchanged: no attempt/plan additions.
  const single = await authorizePaidWorkflow(c);
  assert.equal(single.plan, "single_generation");
  assert.equal(single.attempt, 1);
  assert.equal(Object.hasOwn(single, "firstAttemptCandidateSha"), false);
});

test("P0-B: signed attempt-2 admission binds the exact repair body, ledger and session sequence", async (t) => {
  const previousChanges = [
    { path: "src/main.ts", content: "export const genuineModelOutput = 1;" },
  ];
  // Wrong actor: refused by the guard before any identity fetch.
  {
    const wrongActor = environment(t, { actor: "ghost" });
    const ghostIdentity = fakeIdentity(t, wrongActor);
    installFetch(t, ghostIdentity);
    const calls = nativeStub(t);
    await assert.rejects(
      authorizePaidWorkflow(context(), attemptTwoOptions(previousChanges)),
      { code: "ACTOR_BLOCKED" },
    );
    assert.equal(calls.length, 0);
  }
  // Wrong confirmation pairing: refused before any transport.
  {
    const wrongInputs = environment(t, {
      inputs: {
        ...twoInputs(),
        confirm_paid: "I_ACCEPT_ONE_PAID_ATTEMPT_NO_HARD_CAP",
      },
    });
    const identity = fakeIdentity(t, wrongInputs);
    installFetch(t, identity);
    const calls = nativeStub(t);
    await assert.rejects(
      authorizePaidWorkflow(context(), attemptTwoOptions(previousChanges)),
      { code: "PAID_CONFIRMATION_BLOCKED" },
    );
    assert.equal(calls.length, 0);
  }
  // Missing plan: refused before any transport (P0-B regression).
  {
    const env = environment(t);
    const identity = fakeIdentity(t, env);
    installFetch(t, identity);
    const calls = nativeStub(t);
    const { plan: _plan, ...withoutPlan } = attemptTwoOptions(previousChanges);
    await assert.rejects(authorizePaidWorkflow(context(), withoutPlan), {
      code: "CONFIG_DENIED",
    });
    assert.equal(calls.length, 0);
  }
  // The real admission: exact body binding, distinct ledger, one send, no replay.
  const env = environment(t, { withKey: true });
  const identity = fakeIdentity(t, env);
  installFetch(t, identity);
  const calls = nativeStub(t);
  const c = context();
  const authorization = await authorizePaidWorkflow(
    c,
    attemptTwoOptions(previousChanges),
  );
  assert.equal(authorization.attempt, 2);
  assert.equal(authorization.plan, "generate_then_repair");
  assert.equal(authorization.firstAttemptCandidateSha, FIRST_CANDIDATE);
  const card = paidPreflight(authorization, c);
  assert.equal(card.format, "mmp154-repair-preflight-v1");
  const repairBody = prepareMetaMigration(
    c,
    {
      unitId: "workshop-api",
      tier: "spark",
      action: "repair",
      attempt: 2,
      repairFeedback: "HTTP_JSON_TYPE",
    },
    previousChanges,
  );
  assert.equal(card.requestBodySha256, sha256(repairBody));
  assert.equal(card.firstAttemptCandidateSha, FIRST_CANDIDATE);
  const provider = createMetaMigrationProvider(c, {
    authorization,
    firstAttempt: 2,
    previousChanges,
  });
  const response = await provider.provider.generate(
    {
      unitId: "workshop-api",
      tier: "spark",
      action: "repair",
      attempt: 2,
      repairFeedback: "HTTP_JSON_TYPE",
    },
    signal(),
  );
  assert.equal(calls.length, 1);
  const sent = calls[0];
  const inner = JSON.parse(sent.messages[1].content);
  assert.deepEqual(inner.previousGeneratedChanges, previousChanges);
  assert.deepEqual(inner.repairCodes, ["HTTP_JSON_TYPE"]);
  assert.equal(response.changes.length, 1);
  assert.equal(provider.receipts()[0].attempt, 2);
  assert.equal(provider.receipts()[0].action, "repair");
  assert.equal(provider.receipts()[0].inputSha256, authorization.bodySha256);
  // Distinct durable attempt-2 ledger, reserved before the send.
  const ledger = join(env.values.RUNNER_TEMP, `mmp078-${RUN}-attempt-2.json`);
  assert.ok(existsSync(ledger));
  const recorded = JSON.parse(readFileSync(ledger, "utf8"));
  assert.equal(recorded.attempt, 2);
  assert.equal(recorded.status, "UNKNOWN");
  // Admission replay is refused after consumption; the session stops for good.
  assert.throws(() => reservePaidAttempt(authorization, c, repairBody), {
    code: "REQUEST_LIMIT",
  });
  await assert.rejects(
    provider.provider.generate(
      {
        unitId: "workshop-api",
        tier: "spark",
        action: "repair",
        attempt: 2,
        repairFeedback: "HTTP_JSON_TYPE",
      },
      signal(),
    ),
    { code: "SESSION_STOPPED" },
  );
  assert.equal(calls.length, 1);
});

test("P1-D: repair scorecard refuses complete outcomes without first-candidate provenance", () => {
  const card = {
    format: "mmp154-repair-preflight-v1",
    repository: "Meta-Project2026/Metamorph",
    headSha: head,
    model: "muse-spark-1.3",
    mode: "STANDARD",
    maximumPosts: 2,
    maximumRepairs: 1,
    attempt: 2,
    action: "repair",
    repairFeedbackCodes: "HTTP_JSON_TYPE",
    firstAttemptCandidateSha: FIRST_CANDIDATE,
    sha256: "0".repeat(64),
  };
  const trial = {
    format: "mmp078-public-repair-trial-v1",
    headSha: head,
    candidateSha: "5".repeat(64),
    publicG1: "NOT_RUN",
    publicG2: "NOT_RUN",
    publicG3: "NOT_RUN",
    G0: "INCONCLUSIVE",
    G4: "INCONCLUSIVE",
    product: "NOT_ESTABLISHED",
    attempts: [],
    cleanup: {
      status: "NOT_RUN",
      containers: null,
      volumes: null,
      emergencyRemoved: null,
    },
  };
  for (const firstCandidate of [FIRST_CANDIDATE, "6".repeat(64), null]) {
    const scorecard = repairScorecard({
      preflight: card,
      generation: null,
      trial: {
        ...trial,
        // The signed attempt-2 admission records the bound first candidate.
        budgetAuth: { firstAttemptCandidateSha: FIRST_CANDIDATE },
      },
      stored: null,
      transport: null,
      finalizer: null,
      runId: RUN,
      headSha: head,
      firstAttempt: {
        candidateSha: firstCandidate,
        headSha: head,
        estimatedCostUsd: 0.05,
      },
    });
    assert.equal(
      scorecard.firstAttempt.bound,
      firstCandidate === FIRST_CANDIDATE,
    );
    assert.equal(scorecard.product, "NOT_ESTABLISHED");
  }
});

const linux = { skip: process.platform !== "linux" };

function stageFirstAttemptCustody(directory) {
  // Synthetic sealed custody for attempt 1: the real receipt/checkpoint/
  // transport machinery over a fake ciphertext (no age binary, no Docker).
  const capsule = syntheticCapsule();
  const bytes = Buffer.concat([
    Buffer.from("age-encryption.org/v1\n"),
    Buffer.alloc(180, 9),
  ]);
  const capture = receiptFor(
    "CAPTURED_UNVERIFIED",
    capsule.identity,
    { sha256: sha256(bytes), bytes: bytes.length },
    "VERIFIED_ZERO_RESOURCES",
  );
  const fixture = artifactFixture(capture);
  const spool = join(directory, "mmp115-custody");
  // The readback directory is created by the real prepare-upload custody step.
  privateDirectory(spool, true);
  commitPrivate(join(spool, "candidate.age"), bytes, CUSTODY.ciphertext);
  commitRecord(join(spool, "capture.json"), capture);
  commitRecord(join(spool, "finalizer.json"), fixture.finalizer);
  return { capsule, bytes, capture, fixture, spool };
}

test(
  "full two-attempt simulation: eligible FAIL sends twice; PASS or foreign custody never sends again",
  linux,
  async (t) => {
    const env = environment(t);
    const identity = fakeIdentity(t, env);
    const staged = stageFirstAttemptCustody(env.directory);
    requireCustody(staged.capsule.identity.runId === RUN);
    const custodyEnv = {
      RUNNER_TEMP: env.directory,
      GITHUB_RUN_ID: RUN,
      GITHUB_RUN_ATTEMPT: "1",
      GITHUB_SHA: head,
    };
    // The custody and scorecard steps commit records into these run outputs.
    const output = join(env.directory, "meta-paid-public");
    const privateRoot = join(env.directory, "meta-paid-private");
    mkdirSync(output, { recursive: true, mode: 0o700 });
    mkdirSync(privateRoot, { recursive: true, mode: 0o700 });
    installFetch(t, identity);
    await custodyStep("prepare-upload", custodyEnv, 1);
    // Downloaded bytes land in the readback directory created above.
    commitPrivate(
      join(env.directory, "mmp115-readback", "candidate.age"),
      staged.bytes,
      CUSTODY.ciphertext,
    );
    identity.stageArtifactProvenance(staged.fixture);
    const stored = await custodyStep(
      "verify-download",
      {
        ...custodyEnv,
        GH_TOKEN: "fake-github-token",
        MMP115_ARTIFACT_ID: String(staged.fixture.ack.artifactId),
        MMP115_ARCHIVE_SHA256: staged.fixture.ack.archiveSha256,
        MMP115_UPLOAD_OUTCOME: "success",
        MMP115_DOWNLOAD_OUTCOME: "success",
      },
      1,
    );
    assert.equal(stored.state, "STORED_UNVERIFIED");

    // Stage the recorded trial (real #41703793337 receipt, rebound to this run),
    // the custody-bound candidate directory and the public stored receipt.
    const realTrial = JSON.parse(
      readFileSync(
        join(
          root,
          "packages/agent-real/test/fixtures/mmp158-real-trial-41703793337.json",
        ),
        "utf8",
      ),
    );
    const candidateRoot = join(privateRoot, "candidate");
    mkdirSync(join(candidateRoot, "src"), { recursive: true, mode: 0o700 });
    for (const file of staged.capsule.files) {
      writeFileSync(join(candidateRoot, file.path), file.content, {
        mode: 0o600,
      });
    }
    const rebound = () => {
      // Rebind every recorded occurrence of the real run identity (trial,
      // authorization, receipts, diagnostics, custody links) to this
      // synthetic run so the receipt stays internally consistent.
      const candidateSha = staged.capsule.identity.candidateSha;
      const copy = JSON.parse(
        JSON.stringify(realTrial)
          .replaceAll(realTrial.candidateSha, candidateSha)
          .replaceAll(realTrial.headSha, head),
      );
      copy.trialRunId = RUN;
      copy.sourceSha = SOURCE.commit;
      copy.custody.identity = {
        runId: RUN,
        runAttempt: "1",
        headSha: head,
        sourceSha: SOURCE.commit,
        candidateSha,
        attemptId: staged.capture.identity.attemptId,
      };
      copy.custodyLink.identity = { ...copy.custody.identity };
      return copy;
    };
    const passTrial = () => {
      const copy = rebound();
      copy.publicG2 = "PASS";
      copy.publicG3 = "PASS";
      copy.blockers = [];
      for (const g of copy.attempts[0].gates)
        if (g.gate === "G2" || g.gate === "G3") {
          g.verdict = "PASS";
          g.findingCodes = [];
        }
      for (const p of copy.attempts[0].pairs)
        for (const g of p.gates)
          if (g.gate === "G2" || g.gate === "G3") {
            g.verdict = "PASS";
            g.findingCodes = [];
          }
      return copy;
    };
    assert.equal(
      publicRepairDecision(passTrial(), passTrial().candidateSha).verdict,
      "PASS",
    );
    const writeTrial = (value) =>
      writeFileSync(join(output, "trial.json"), JSON.stringify(value), {
        mode: 0o600,
      });

    const { repairGate } = await import(
      "../../../research/mmp-078/repair-gate.mjs"
    );
    const { runRepairSend } = await import(
      "../../../research/mmp-078/repair-run.mjs"
    );
    // First-attempt PASS: the gate refuses; no repair POST follows. The gate
    // record is no-clobber, so this evaluation runs in its own run directory.
    const passDirectory = mkdtempSync(join(tmpdir(), "mmp158-gate-pass-"));
    t.after(() => rmSync(passDirectory, { recursive: true, force: true }));
    mkdirSync(join(passDirectory, "meta-paid-public"), {
      recursive: true,
      mode: 0o700,
    });
    mkdirSync(join(passDirectory, "meta-paid-private"), {
      recursive: true,
      mode: 0o700,
    });
    writeFileSync(
      join(passDirectory, "meta-paid-public", "trial.json"),
      JSON.stringify(passTrial()),
      { mode: 0o600 },
    );
    assert.equal(
      repairGate({ ...custodyEnv, RUNNER_TEMP: passDirectory }).eligible,
      false,
    );
    // Eligible complete FAIL: the gate admits and the repair POST executes once.
    writeTrial(rebound());
    writeFileSync(join(output, "custody-stored.json"), JSON.stringify(stored), {
      mode: 0o600,
    });
    const gateRecord = repairGate(custodyEnv);
    assert.equal(gateRecord.eligible, true);
    assert.equal(gateRecord.feedback, "HTTP_JSON_TYPE");
    writeFileSync(
      join(privateRoot, "repair-gate.json"),
      JSON.stringify(gateRecord),
      {
        mode: 0o600,
      },
    );
    writeFileSync(
      join(privateRoot, "transfer.json"),
      JSON.stringify({
        candidateRoot,
        candidateSha: staged.capsule.identity.candidateSha,
      }),
      { mode: 0o600 },
    );

    // The repair reply must carry the pinned license notice: candidate
    // custody validates that every capsule embeds it.
    const license = JSON.parse(source).license;
    const repairChanges = [
      {
        path: "src/main.ts",
        content: `/*
${license.trim()}
*/
export const repairedModelOutput = 2;
`,
      },
    ];
    const repairCalls = nativeStub(t, { replyChanges: repairChanges });

    // Credential-bearing repair send: its own OIDC admission, one further POST.
    process.env.MODEL_API_KEY = key;
    t.after(() => {
      delete process.env.MODEL_API_KEY;
    });
    await runRepairSend(process.env);
    assert.equal(repairCalls.length, 1);
    const sentInner = JSON.parse(repairCalls[0].messages[1].content);
    assert.deepEqual(sentInner.repairCodes, ["HTTP_JSON_TYPE"]);
    assert.deepEqual(
      sentInner.previousGeneratedChanges,
      staged.capsule.files.map(({ path, content }) => ({ path, content })),
    );
    const trialRepair = JSON.parse(
      readFileSync(join(output, "trial-repair.json"), "utf8"),
    );
    assert.equal(trialRepair.modelGeneration, "GENERATED");
    assert.equal(trialRepair.budgetAuth.attempt, 2);
    assert.equal(
      trialRepair.budgetAuth.firstAttemptCandidateSha,
      staged.capsule.identity.candidateSha,
    );
    // The collector's age/Docker encryption cannot run in the test host, so
    // the real capture fails closed; production capture is exercised on the
    // authentic runner. The attempt-2 custody chain is verified below through
    // the real checkpoint machinery over synthetic sealed bytes - the same
    // seam already used for attempt 1.
    assert.deepEqual(trialRepair.blockers, ["CUSTODY_CAPTURE_FAILED"]);
    process.exitCode = 0;

    // Distinct attempt-2 custody: REPAIR_CUSTODY capsule, -repair artifact
    // name, separate spool and its own single-use Oracle permit.
    const repairBundle = validateBundle(
      repairChanges.map((file) => ({ ...file, sha256: sha256(file.content) })),
    );
    const repairCapsule = {
      format: CUSTODY.format,
      verification: "UNVERIFIED",
      attemptKind: "REPAIR_CUSTODY",
      identity: {
        runId: RUN,
        runAttempt: "1",
        headSha: head,
        sourceSha: SOURCE.commit,
        candidateSha: repairBundle.candidateSha,
        attemptId: randomUUID(),
      },
      admission: {
        generationAttempt: 2,
        requestBodySha256: trialRepair.budgetAuth.bodySha256,
        responseSha256: trialRepair.modelReceipts[0].responseSha256,
        contextSha256: context().contextSha256,
        manifestSha256: MANIFEST_SHA256,
      },
      license: CUSTODY_LICENSE,
      manifest: repairBundle.files.map((file) => ({
        path: file.path,
        bytes: Buffer.byteLength(file.content),
        sha256: file.sha256,
      })),
      files: repairBundle.files,
    };
    const repairBytes = Buffer.concat([
      Buffer.from("age-encryption.org/v1\n"),
      Buffer.alloc(190, 8),
    ]);
    const repairCapture = receiptFor(
      "CAPTURED_UNVERIFIED",
      repairCapsule.identity,
      { sha256: sha256(repairBytes), bytes: repairBytes.length },
      "VERIFIED_ZERO_RESOURCES",
    );
    const repairFixture = {
      ack: {
        artifactId: "115003",
        archiveSha256: "e".repeat(64),
        uploadOutcome: "success",
        downloadOutcome: "success",
      },
      artifact: {
        id: 115003,
        name: `mmp107-candidate-${RUN}-1-repair`,
        expired: false,
        digest: `sha256:${"e".repeat(64)}`,
        size_in_bytes: 500,
        workflow_run: {
          id: Number(RUN),
          head_sha: head,
          repository_id: 1434945189,
          head_repository_id: 1434945189,
        },
      },
      run: {
        id: Number(RUN),
        head_sha: head,
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
        identity: repairCapture.identity,
        containers: 0,
        volumes: 0,
        emergencyRemoved: 0,
      },
    };
    requireCustody(
      repairFixture.artifact.name === "mmp107-candidate-115001-1-repair" &&
        repairFixture.artifact.id !== staged.fixture.artifact.id,
    );
    identity.stageArtifactProvenance(repairFixture);
    // The failed real capture already created the repair spool (the collector
    // creates it before encryption); only its ownership is re-checked here.
    const repairSpool = join(env.directory, "mmp115-custody-repair");
    privateDirectory(repairSpool);
    commitPrivate(
      join(repairSpool, "candidate.age"),
      repairBytes,
      CUSTODY.ciphertext,
    );
    commitRecord(join(repairSpool, "capture.json"), repairCapture);
    commitRecord(join(repairSpool, "finalizer.json"), repairFixture.finalizer);
    await custodyStep("prepare-upload", custodyEnv, 2);
    commitPrivate(
      join(env.directory, "mmp115-readback-repair", "candidate.age"),
      repairBytes,
      CUSTODY.ciphertext,
    );
    const repairStored = await custodyStep(
      "verify-download",
      {
        ...custodyEnv,
        GH_TOKEN: "fake-github-token",
        MMP115_ARTIFACT_ID: String(repairFixture.ack.artifactId),
        MMP115_ARCHIVE_SHA256: repairFixture.ack.archiveSha256,
        MMP115_UPLOAD_OUTCOME: "success",
        MMP115_DOWNLOAD_OUTCOME: "success",
      },
      2,
    );
    assert.equal(repairStored.state, "STORED_UNVERIFIED");
    const repairPermit = requireStoredCheckpoint(
      process.env,
      {
        candidateSha: repairCapsule.identity.candidateSha,
        sourceSha: SOURCE.commit,
        attemptId: repairCapsule.identity.attemptId,
      },
      2,
      { allowCredentials: true },
    );
    const repairIdentity = consumeOraclePermit(repairPermit, {
      candidateSha: repairCapsule.identity.candidateSha,
      headSha: head,
      sourceSha: SOURCE.commit,
    });
    assert.notEqual(
      repairIdentity.attemptId,
      staged.capture.identity.attemptId,
    );
    assert.notEqual(
      repairIdentity.candidateSha,
      staged.capsule.identity.candidateSha,
    );
    assert.notEqual(
      repairFixture.ack.artifactId,
      staged.fixture.ack.artifactId,
    );

    // Foreign candidate in the recorded trial: refused before any send.
    writeTrial({ ...rebound(), candidateSha: "f".repeat(64) });
    const before = repairCalls.length;
    await runRepairSend(process.env);
    assert.equal(repairCalls.length, before);
    const blocked = JSON.parse(
      readFileSync(join(output, "trial-repair.json"), "utf8"),
    );
    assert.equal(blocked.modelGeneration, "BLOCKED");
    // The blocked entrypoint sets process.exitCode; reset it so the test
    // process itself still reports success.
    process.exitCode = 0;
  },
);
