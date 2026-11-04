// Signed-shape TEST-only full vertical. Never sends real network requests or
// executes candidates; Node's test-only loader replaces qualified OS operations.
import assert from "node:assert/strict";
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
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { artifactFixture, offlinePaid } from "./custody-fixture.mjs";
import { finalizeCustody, state } from "./g1-recovery-ports.mjs";

const ports = new URL("g1-recovery-ports.mjs", import.meta.url).href;
registerHooks({
  resolve(specifier, context, next) {
    const parent = context.parentURL ?? "";
    if (
      (parent.endsWith("/src/migration-trial.mjs") &&
        ["./runtime.mjs", "./custody-capture.mjs"].includes(specifier)) ||
      ((parent.endsWith("/src/g1-repair-host.mjs") ||
        parent.endsWith("/src/custody-steps.mjs")) &&
        specifier === "./custody-checkpoint.mjs")
    )
      return { url: ports, shortCircuit: true };
    return next(specifier, context);
  },
});
const { G1_RECOVERY_MODE } = await import("../src/g1-repair-eligibility.mjs");
const { authorizePaidWorkflow, paidPreflight, reservePaidAttempt } =
  await import("../src/meta-paid-authorization.mjs");
const { runPublicMigration, validateCustodiedMigration } = await import(
  "../src/migration-trial.mjs"
);
const {
  verifyG1RecoveryCandidate,
  requireG1RepairCapability,
  g1CapabilityDetails,
} = await import("../src/g1-repair-host.mjs");
const { requireStoredCheckpoint } = await import(
  "../src/custody-checkpoint.mjs"
);
const { custodyStep } = await import("../src/custody-steps.mjs");
const { commitRecord, commitPrivate } = await import(
  "../src/custody-files.mjs"
);
const { compilerRepairGate } = await import(
  "../../../research/mmp-078/repair-gate.mjs"
);
const { runRepairSend } = await import(
  "../../../research/mmp-078/repair-run.mjs"
);
const { prepareMetaMigration, createMetaMigrationProvider } = await import(
  "../src/meta-migration.mjs"
);
const { consumeNativeResponseOrigin } = await import(
  "../src/meta-migration.mjs"
);
const { publicTrialOutcome, generationScorecard, repairExecutionStatus } =
  await import("../src/live-experiment.mjs");
const linux = { skip: process.platform !== "linux" };

test("credential-free guard records the distinct original v2 policy without a send", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "mmp180-guard-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const f = await offlinePaid(t, directory);
  const event = JSON.parse(readFileSync(f.values.GITHUB_EVENT_PATH, "utf8"));
  Object.assign(event.inputs, {
    execution_mode: G1_RECOVERY_MODE,
    confirm_paid: "I_ACCEPT_TWO_PAID_ATTEMPTS_NO_HARD_CAP",
  });
  writeFileSync(f.values.GITHUB_EVENT_PATH, JSON.stringify(event));
  delete process.env.MODEL_API_KEY;
  await import("../../../research/mmp-078/guard.mjs");
  const policy = JSON.parse(
    readFileSync(join(directory, "meta-paid-public/policy.json"), "utf8"),
  );
  assert.equal(policy.status, "VERIFIED");
  assert.equal(policy.executionMode, G1_RECOVERY_MODE);
  assert.equal(policy.maximumPosts, 2);
  assert.deepEqual(policy.allowedRepairKinds, ["G1_BUILD_RECOVERABLE"]);
  assert.equal(f.calls.length, 0);
});

test("native response origin cannot be cloned, changed, reused or issued from admission JSON", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "mmp180-native-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const f = await offlinePaid(t, directory);
  const provider = createMetaMigrationProvider(f.context, {
    authorization: f.authorization,
  });
  await provider.provider.generate(
    {
      unitId: "workshop-api",
      tier: "spark",
      action: "generate",
      attempt: 1,
      repairFeedback: null,
    },
    new AbortController().signal,
  );
  const receipt = provider.receipts()[0];
  assert.throws(
    () =>
      consumeNativeResponseOrigin(structuredClone(receipt), f.authorization),
    { code: "RESPONSE_INVALID" },
  );
  const changed = provider.receipts()[0];
  changed.candidateSha = "f".repeat(64);
  assert.throws(() => consumeNativeResponseOrigin(changed, f.authorization), {
    code: "RESPONSE_INVALID",
  });
  consumeNativeResponseOrigin(receipt, f.authorization);
  assert.throws(
    () => consumeNativeResponseOrigin(provider.receipts()[0], f.authorization),
    { code: "RESPONSE_INVALID" },
  );
  assert.equal(f.calls.length, 1);
});

for (const field of [
  "confirm_paid",
  "model_provider",
  "max_estimated_usd",
  "execution_mode",
])
  test(`signed v2 refuses wrong ${field}`, async (t) => {
    const directory = mkdtempSync(join(tmpdir(), "mmp180-optin-"));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const f = await offlinePaid(t, directory);
    const event = JSON.parse(readFileSync(f.values.GITHUB_EVENT_PATH, "utf8"));
    Object.assign(event.inputs, {
      execution_mode: G1_RECOVERY_MODE,
      confirm_paid: "I_ACCEPT_TWO_PAID_ATTEMPTS_NO_HARD_CAP",
    });
    event.inputs[field] = {
      confirm_paid: "I_ACCEPT_ONE_PAID_ATTEMPT_NO_HARD_CAP",
      model_provider: "local",
      max_estimated_usd: "0.75",
      execution_mode: "single_generation",
    }[field];
    writeFileSync(f.values.GITHUB_EVENT_PATH, JSON.stringify(event));
    await assert.rejects(
      authorizePaidWorkflow(f.context, { plan: G1_RECOVERY_MODE }),
    );
    assert.equal(f.calls.length, 0);
  });

async function first(
  t,
  {
    code = "TS2339",
    secondFail = false,
    mode = G1_RECOVERY_MODE,
    firstPass = false,
    parityFail = false,
  } = {},
) {
  Object.assign(state, {
    code,
    secondFail,
    firstPass,
    parityFail,
    verifications: 0,
    independentBad: false,
    phase: {},
    pending: false,
  });
  const directory = mkdtempSync(join(tmpdir(), "mmp180-host-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const f = await offlinePaid(t, directory);
  const event = JSON.parse(readFileSync(f.values.GITHUB_EVENT_PATH, "utf8"));
  event.inputs.execution_mode = mode;
  event.inputs.confirm_paid =
    mode === "single_generation"
      ? "I_ACCEPT_ONE_PAID_ATTEMPT_NO_HARD_CAP"
      : "I_ACCEPT_TWO_PAID_ATTEMPTS_NO_HARD_CAP";
  writeFileSync(f.values.GITHUB_EVENT_PATH, JSON.stringify(event));
  const output = join(directory, "meta-paid-public"),
    privateRoot = join(directory, "meta-paid-private");
  mkdirSync(output, { mode: 0o700 });
  mkdirSync(privateRoot, { mode: 0o700 });
  const auth = await authorizePaidWorkflow(f.context, { plan: mode });
  const preflight = paidPreflight(auth, f.context);
  writeFileSync(join(output, "preflight.json"), JSON.stringify(preflight), {
    mode: 0o600,
  });
  const result = await runPublicMigration({
    context: f.context,
    selection: "meta",
    parent: privateRoot,
    headSha: f.values.GITHUB_SHA,
    signal: new AbortController().signal,
    authorization: auth,
  });
  assert.equal(result.modelGeneration, "GENERATED");
  assert.equal(result.custody?.state, "CAPTURED_UNVERIFIED");
  const transfer = {
    candidateRoot: result.candidateRoot,
    candidateSha: result.candidateSha,
  };
  const saveTrial = (value) =>
    writeFileSync(join(output, "trial.json"), JSON.stringify(value), {
      mode: 0o600,
    });
  saveTrial(result);
  writeFileSync(join(privateRoot, "transfer.json"), JSON.stringify(transfer), {
    mode: 0o600,
  });
  delete process.env.MODEL_API_KEY;
  const originalFetch = globalThis.fetch;
  const fixtures = new Map();
  t.mock.method(globalThis, "fetch", async (url, options) => {
    const path = String(url);
    if (path.includes("/actions/artifacts/"))
      return new Response(
        JSON.stringify(fixtures.get(path.split("/").at(-1)).artifact),
      );
    if (path.includes("/actions/runs/"))
      return new Response(JSON.stringify([...fixtures.values()].at(-1).run));
    return originalFetch(url, options);
  });
  const store = async (attempt) => {
    const suffix = attempt === 2 ? "-repair" : "";
    const spool = join(directory, `mmp115-custody${suffix}`);
    const capture = JSON.parse(
      readFileSync(join(spool, "capture.json"), "utf8"),
    );
    commitRecord(
      join(spool, "finalizer.json"),
      await finalizeCustody(capture.identity),
    );
    await custodyStep("capture", process.env, attempt);
    await custodyStep("prepare-upload", process.env, attempt);
    commitPrivate(
      join(directory, `mmp115-readback${suffix}/candidate.age`),
      readFileSync(join(spool, "candidate.age")),
      10000,
    );
    const fixture = artifactFixture(capture);
    fixture.ack.artifactId = String(180000 + attempt);
    fixture.artifact.id = 180000 + attempt;
    fixture.artifact.name = `mmp107-candidate-${f.values.GITHUB_RUN_ID}-1${suffix}`;
    fixtures.set(fixture.ack.artifactId, fixture);
    return custodyStep(
      "verify-download",
      {
        ...process.env,
        MMP115_ARTIFACT_ID: fixture.ack.artifactId,
        MMP115_ARCHIVE_SHA256: fixture.ack.archiveSha256,
        MMP115_UPLOAD_OUTCOME: "success",
        MMP115_DOWNLOAD_OUTCOME: "success",
      },
      attempt,
    );
  };
  const stored = await store(1);
  const parent = join(directory, "verification-first");
  mkdirSync(parent, { mode: 0o700 });
  const options = {
    context: f.context,
    root: fileURLToPath(new URL("../../../", import.meta.url)),
    parent,
    headSha: f.values.GITHUB_SHA,
    ...transfer,
    signal: new AbortController().signal,
  };
  const permit = requireStoredCheckpoint(process.env, result.custody.identity);
  const validation = await (mode === G1_RECOVERY_MODE
    ? verifyG1RecoveryCandidate
    : validateCustodiedMigration)(options, permit);
  const trial = {
    ...result,
    ...validation,
    validationOutcome: publicTrialOutcome(validation),
  };
  saveTrial(trial);
  return {
    ...f,
    directory,
    output,
    privateRoot,
    preflight,
    result,
    trial,
    validation,
    stored,
    fixtures,
    store,
  };
}

for (const [code, secondFail] of [
  ["TS2339", false],
  ["TS2769", true],
])
  test(
    `production v2 ${code}: two envelopes, second ${secondFail ? "G1 FAIL stops" : "fresh full 17/20 PASS"}`,
    linux,
    async (t) => {
      const f = await first(t, { code, secondFail });
      assert.equal(f.validation.publicG1, "FAIL");
      assert.equal(f.trial.validationOutcome.complete, false);
      assert.equal(f.trial.validationOutcome.status, "EARLY_G1_FAIL");
      const gate = await compilerRepairGate(process.env);
      assert.equal(gate.eligible, true);
      assert.equal(gate.feedback.code, code);
      assert.notEqual(
        f.trial.custody.identity.attemptId,
        f.trial.attempts[0].attemptId,
      );
      // Fake Meta's second response is a new original candidate; only its own first
      // output returns privately in previousGeneratedChanges.
      f.capsule.files[0].content +=
        "\nexport const originalSecondSynthetic = 180;\n";
      process.env.MODEL_API_KEY = f.values.MODEL_API_KEY;
      await runRepairSend(process.env);
      assert.equal(f.calls.length, 2);
      const request = JSON.parse(JSON.parse(f.calls[1]).messages[1].content);
      assert.deepEqual(request.compilerFeedback, gate.feedback);
      assert.equal(
        request.previousGeneratedChanges[0].content.includes(
          "originalSecondSynthetic",
        ),
        false,
      );
      assert.equal(
        existsSync(
          join(f.directory, `mmp078-${f.values.GITHUB_RUN_ID}-attempt-2.json`),
        ),
        true,
      );
      delete process.env.MODEL_API_KEY;
      const repair = JSON.parse(
        readFileSync(join(f.output, "trial-repair.json"), "utf8"),
      );
      assert.equal(repair.modelGeneration, "GENERATED");
      assert.equal(repair.custody.state, "CAPTURED_UNVERIFIED");
      await f.store(2);
      const transfer = JSON.parse(
        readFileSync(join(f.privateRoot, "transfer-repair.json"), "utf8"),
      );
      const parent = join(f.directory, "verification-second");
      mkdirSync(parent, { mode: 0o700 });
      const second = await validateCustodiedMigration(
        {
          context: f.context,
          root: fileURLToPath(new URL("../../../", import.meta.url)),
          parent,
          headSha: f.values.GITHUB_SHA,
          ...transfer,
          signal: new AbortController().signal,
        },
        requireStoredCheckpoint(process.env, repair.custody.identity, 2),
      );
      assert.equal(second.publicG1, secondFail ? "FAIL" : "PASS");
      assert.deepEqual(second.attempts[0].coverage, {
        http: secondFail ? 0 : 17,
        sqlite: secondFail ? 0 : 20,
        requiredHttp: 17,
        requiredSqlite: 20,
      });
      assert.notEqual(
        second.attempts[0].attemptId,
        f.validation.attempts[0].attemptId,
      );
      assert.equal(second.product, "NOT_ESTABLISHED");
      const repairPreflight = JSON.parse(
        readFileSync(join(f.output, "preflight-repair.json"), "utf8"),
      );
      const repairGeneration = JSON.parse(
        readFileSync(join(f.output, "generation-repair.json"), "utf8"),
      );
      const status = repairExecutionStatus({
        preflight: f.preflight,
        generation: f.result.modelReceipts[0],
        trial: f.trial,
        repairGeneration,
        repairPreflight,
        repairEvidencePresent: true,
        runId: f.values.GITHUB_RUN_ID,
        headSha: f.values.GITHUB_SHA,
      });
      assert.equal(status, "EXECUTED");
      const score = generationScorecard({
        preflight: f.preflight,
        generation: f.result.modelReceipts[0],
        trial: f.trial,
        stored: f.stored,
        transport: JSON.parse(
          readFileSync(
            join(f.directory, "mmp115-custody/transport.json"),
            "utf8",
          ),
        ),
        finalizer: {
          headSha: f.values.GITHUB_SHA,
          status: "PASS",
          inventory: { containers: 0, volumes: 0 },
          emergencyRemoved: 0,
        },
        runId: f.values.GITHUB_RUN_ID,
        headSha: f.values.GITHUB_SHA,
        repairExecution: status,
      });
      assert.equal(score.stopReason, "FIRST_G1_FAIL_SIGNED_REPAIR_EXECUTED");
      assert.doesNotMatch(
        JSON.stringify(score),
        /PRIVATE_COMPILER|originalSyntheticCustody|originalSecondSynthetic|stack|stderr/,
      );
      await assert.rejects(requireG1RepairCapability(process.env, f.context), {
        code: "G1_REPAIR_NO_GO",
      });
      process.env.MODEL_API_KEY = f.values.MODEL_API_KEY;
      await runRepairSend(process.env); // repeated callback/restart cannot create a third POST
      assert.equal(f.calls.length, 2);
      assert.equal(
        JSON.parse(readFileSync(join(f.output, "trial-repair.json"), "utf8"))
          .modelGeneration,
        "GENERATED",
      );
      process.exitCode = 0;
    },
  );

for (const mode of ["single_generation", "generate_then_repair"])
  test(`${mode}: G1 FAIL cannot acquire v2 authority`, linux, async (t) => {
    const f = await first(t, { mode });
    assert.equal((await compilerRepairGate(process.env)).eligible, false);
    await assert.rejects(requireG1RepairCapability(process.env, f.context));
    assert.equal(f.calls.length, 1);
  });

for (const parityFail of [false, true])
  test(
    `v2 first G1 PASS / public ${parityFail ? "FAIL" : "PASS"}: no compiler repair`,
    linux,
    async (t) => {
      const f = await first(t, { firstPass: true, parityFail });
      assert.equal(f.trial.publicG1, "PASS");
      assert.equal(f.trial.validationOutcome.complete, true);
      assert.equal((await compilerRepairGate(process.env)).eligible, false);
      await assert.rejects(requireG1RepairCapability(process.env, f.context));
      assert.equal(f.calls.length, 1);
    },
  );

for (const tamper of [
  "trial",
  "journal",
  "source",
  "lease",
  "stored",
  "expiredArtifact",
  "cleanup",
  "ledger",
  "partialLedger",
])
  test(`renewed production admission refuses ${tamper}`, linux, async (t) => {
    const f = await first(t);
    if (tamper === "trial") {
      const v = structuredClone(f.trial);
      v.attempts[0].pairs[0].compilerDiagnostics.entries[0].code = "TS2769";
      writeFileSync(join(f.output, "trial.json"), JSON.stringify(v), {
        mode: 0o600,
      });
    }
    if (tamper === "journal") {
      const path = join(f.directory, "mmp180-g1/verification.json");
      const v = JSON.parse(readFileSync(path, "utf8"));
      v.payload.firstTypecheckNormal = false;
      writeFileSync(path, JSON.stringify(v), { mode: 0o600 });
    }
    if (tamper === "source")
      writeFileSync(join(f.result.candidateRoot, "src/main.ts"), "changed", {
        mode: 0o600,
      });
    if (tamper === "lease") {
      const path = join(f.privateRoot, "transfer.json");
      const v = JSON.parse(readFileSync(path, "utf8"));
      v.candidateRoot = f.privateRoot;
      writeFileSync(path, JSON.stringify(v), { mode: 0o600 });
    }
    if (tamper === "stored") {
      const path = join(f.directory, "mmp115-custody/stored.json");
      const v = JSON.parse(readFileSync(path, "utf8"));
      v.identity.attemptId = "00000000-0000-4000-8000-000000000001";
      writeFileSync(path, JSON.stringify(v), { mode: 0o600 });
    }
    if (tamper === "expiredArtifact")
      [...f.fixtures.values()][0].artifact.expired = true;
    if (tamper === "cleanup") state.independentBad = true;
    if (["ledger", "partialLedger"].includes(tamper))
      writeFileSync(
        join(f.directory, `mmp078-${f.values.GITHUB_RUN_ID}-attempt-2.json`),
        tamper === "ledger" ? '{"status":"UNKNOWN"}' : "",
        { mode: 0o600 },
      );
    await assert.rejects(requireG1RepairCapability(process.env, f.context));
    assert.equal(f.calls.length, 1);
  });

test(
  "concurrent v2 capabilities share durable reservation; crash consumes attempt before network",
  linux,
  async (t) => {
    const f = await first(t);
    process.env.MODEL_API_KEY = f.values.MODEL_API_KEY;
    const caps = await Promise.all([
      requireG1RepairCapability(process.env, f.context),
      requireG1RepairCapability(process.env, f.context),
    ]);
    const auths = [];
    for (const cap of caps) {
      const {
        feedback,
        previousChanges,
        firstAttemptCandidateSha,
        firstAttemptEstimatedUsd,
      } = g1CapabilityDetails(cap, f.context);
      auths.push(
        await authorizePaidWorkflow(f.context, {
          plan: G1_RECOVERY_MODE,
          attempt: 2,
          feedback,
          previousChanges,
          firstAttemptCandidateSha,
          firstAttemptEstimatedUsd,
          g1Capability: cap,
        }),
      );
    }
    const facts = g1CapabilityDetails(caps[0], f.context);
    const body = prepareMetaMigration(
      f.context,
      {
        unitId: "workshop-api",
        tier: "spark",
        action: "repair",
        attempt: 2,
        repairFeedback: facts.feedback,
      },
      facts.previousChanges,
    );
    reservePaidAttempt(auths[0], f.context, body); // simulated crash after durable UNKNOWN, before POST
    assert.throws(() => reservePaidAttempt(auths[1], f.context, body), {
      code: "REQUEST_LIMIT",
    });
    const provider = createMetaMigrationProvider(f.context, {
      authorization: auths[0],
      firstAttempt: 2,
      previousChanges: facts.previousChanges,
    });
    await assert.rejects(
      provider.provider.generate(
        {
          unitId: "workshop-api",
          tier: "spark",
          action: "repair",
          attempt: 2,
          repairFeedback: facts.feedback,
        },
        new AbortController().signal,
      ),
    );
    await assert.rejects(requireG1RepairCapability(process.env, f.context));
    assert.equal(f.calls.length, 1);
  },
);

test(
  "concurrent native repair sessions reserve one second send only",
  linux,
  async (t) => {
    const f = await first(t);
    process.env.MODEL_API_KEY = f.values.MODEL_API_KEY;
    const caps = await Promise.all([
      requireG1RepairCapability(process.env, f.context),
      requireG1RepairCapability(process.env, f.context),
    ]);
    const facts = g1CapabilityDetails(caps[0], f.context);
    const providers = [];
    for (const cap of caps) {
      const auth = await authorizePaidWorkflow(f.context, {
        plan: G1_RECOVERY_MODE,
        attempt: 2,
        feedback: facts.feedback,
        previousChanges: facts.previousChanges,
        firstAttemptCandidateSha: facts.firstAttemptCandidateSha,
        firstAttemptEstimatedUsd: facts.firstAttemptEstimatedUsd,
        g1Capability: cap,
      });
      providers.push(
        createMetaMigrationProvider(f.context, {
          authorization: auth,
          firstAttempt: 2,
          previousChanges: facts.previousChanges,
        }),
      );
    }
    const request = {
      unitId: "workshop-api",
      tier: "spark",
      action: "repair",
      attempt: 2,
      repairFeedback: facts.feedback,
    };
    const outcomes = await Promise.allSettled(
      providers.map((p) =>
        p.provider.generate(request, new AbortController().signal),
      ),
    );
    assert.equal(outcomes.filter((o) => o.status === "fulfilled").length, 1);
    assert.equal(f.calls.length, 2);
    await assert.rejects(requireG1RepairCapability(process.env, f.context));
  },
);

test(
  "network throw after durable reservation is SEND_UNKNOWN and never retried",
  linux,
  async (t) => {
    const f = await first(t);
    assert.equal((await compilerRepairGate(process.env)).eligible, true);
    t.mock.method(https, "request", () => {
      const req = new EventEmitter();
      req.destroy = () => {
        if (!req.destroyed) {
          req.destroyed = true;
          queueMicrotask(() => req.emit("close"));
        }
      };
      req.end = (body) => {
        f.calls.push(body);
        queueMicrotask(() =>
          req.emit("error", new Error("PRIVATE_PROVIDER_ERROR")),
        );
      };
      return req;
    });
    process.env.MODEL_API_KEY = f.values.MODEL_API_KEY;
    await runRepairSend(process.env);
    assert.equal(f.calls.length, 2);
    const trial = JSON.parse(
      readFileSync(join(f.output, "trial-repair.json"), "utf8"),
    );
    assert.equal(trial.modelGeneration, "ERROR");
    assert.doesNotMatch(
      JSON.stringify(trial),
      /PRIVATE_PROVIDER_ERROR|stack|stderr/,
    );
    const ledger = JSON.parse(
      readFileSync(
        join(f.directory, `mmp078-${f.values.GITHUB_RUN_ID}-attempt-2.json`),
        "utf8",
      ),
    );
    assert.equal(ledger.status, "UNKNOWN");
    await runRepairSend(process.env);
    assert.equal(f.calls.length, 2);
    await assert.rejects(requireG1RepairCapability(process.env, f.context));
    process.exitCode = 0;
  },
);
