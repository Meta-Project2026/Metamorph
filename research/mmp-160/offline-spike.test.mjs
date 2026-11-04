import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { publicRepairDecision } from "../../packages/agent-real/src/autonomous-repair.mjs";
import { publicTrialOutcome } from "../../packages/agent-real/src/live-experiment.mjs";
import { buildReceipt } from "../../packages/agent-real/src/runtime.mjs";
import { syntheticVerification } from "../../packages/agent-real/test/autonomous-repair-fixture.mjs";
import { fixture, messageMarker, sourceMarker } from "./offline-fixture.mjs";
import { createOfflineSpike } from "./offline-spike.mjs";

function publicSafe(value) {
  const text = JSON.stringify(value);
  for (const marker of [
    messageMarker,
    sourceMarker,
    "stdout",
    "stderr",
    "previousGeneratedChanges",
    "content",
    "stack",
  ])
    assert.ok(!text.includes(marker), marker);
  assert.equal(value.execution, "OFFLINE_ONLY");
  assert.equal(value.authority, "NO_PRODUCTION_AUTHORITY");
  assert.equal(value.product, "NOT_ESTABLISHED");
}
for (const code of ["TS2339", "TS2769"])
  test(`${code}: normal compiler FAIL is recoverable offline with public-safe feedback`, () => {
    const f = fixture(code);
    const spike = f.seal();
    const result = spike.evaluate(f.evidence);
    assert.equal(result.status, "G1_BUILD_RECOVERABLE");
    assert.equal(result.feedback.code, code);
    assert.equal(result.feedback.path, "src/main.ts");
    assert.equal(result.feedback.line, 3);
    assert.equal(result.feedback.column, 7);
    const schema = JSON.parse(
      readFileSync(new URL("./feedback.schema.json", import.meta.url)),
    );
    assert.deepEqual(
      Object.keys(result.feedback).sort(),
      schema.required.toSorted(),
    );
    assert.equal(schema.additionalProperties, false);
    assert.equal(result.feedback.format, schema.properties.format.const);
    assert.match(
      result.feedback.bindingDigest,
      new RegExp(schema.properties.bindingDigest.pattern),
    );
    publicSafe(result);
    const context = spike.consumeTestContext(result);
    assert.deepEqual(
      context.previousGeneratedChanges,
      f.evidence.bundle.files.map(({ path, content }) => ({ path, content })),
    );
    assert.ok(JSON.stringify(context).includes(sourceMarker));
    assert.ok(!JSON.stringify(context).includes(messageMarker));
    assert.deepEqual(context.diagnosticFeedback, result.feedback);
  });

const negatives = [
  [
    "array-like compiler checks",
    (e) => {
      e.g1.checks = { 0: e.g1.checks[0], length: 1 };
    },
  ],
  [
    "array-like diagnostics",
    (e) => {
      e.diagnostic.entries = { 0: e.diagnostic.entries[0], length: 1 };
    },
  ],
  [
    "numeric run identity",
    (e) => {
      e.identity.runId = 160001;
    },
  ],
  [
    "foreign bundle SHA",
    (e) => {
      e.bundle.candidateSha = "9".repeat(64);
    },
  ],
  [
    "unknown envelope field",
    (e) => {
      e.stderr = messageMarker;
    },
  ],
  [
    "missing envelope",
    (e) => {
      delete e.g1;
    },
  ],
  [
    "different model",
    (e) => {
      e.generation.binding.modelId = "FOREIGN_MODEL";
    },
  ],
  [
    "legacy two-POST contract",
    (e) => {
      e.plan.format = "mmp078-manual-paid-estimate-v1";
    },
  ],
  [
    "no signed G1 repair opt-in",
    (e) => {
      e.plan.allowedRepairKinds = [];
    },
  ],
  [
    "ERROR verdict",
    (e) => {
      e.g1.verdict = "ERROR";
    },
  ],
  [
    "PASS verdict",
    (e) => {
      e.g1.verdict = "PASS";
    },
  ],
  [
    "ENVIRONMENT_ERROR",
    (e) => {
      e.g1.findingCodes = ["ENVIRONMENT_ERROR"];
    },
  ],
  [
    "timeout",
    (e) => {
      e.g1.timedOut = true;
    },
  ],
  [
    "cancelled",
    (e) => {
      e.g1.cancelled = true;
    },
  ],
  [
    "signal",
    (e) => {
      e.g1.checks[0].signal = "SIGTERM";
    },
  ],
  [
    "spawn error",
    (e) => {
      e.g1.checks[0].error = "ENOENT";
    },
  ],
  [
    "outer spawn error",
    (e) => {
      e.g1.spawnError = "ENOENT";
    },
  ],
  [
    "output overflow",
    (e) => {
      e.g1.overflow = true;
    },
  ],
  [
    "missing exit code",
    (e) => {
      e.g1.checks[0].exitCode = null;
    },
  ],
  [
    "zero exit",
    (e) => {
      e.g1.checks[0].exitCode = 0;
    },
  ],
  [
    "negative exit",
    (e) => {
      e.g1.checks[0].exitCode = -1;
    },
  ],
  [
    "wrong stage",
    (e) => {
      e.g1.stage = "BUILD";
    },
  ],
  [
    "wrong test",
    (e) => {
      e.g1.executedTestIds = ["workshop-business:build"];
    },
  ],
  [
    "two typechecks",
    (e) => {
      e.g1.executedTestIds.push("workshop-business:typecheck");
    },
  ],
  [
    "two phases",
    (e) => {
      e.g1.checks.push({ ...e.g1.checks[0], phase: "build" });
    },
  ],
  [
    "two diagnostics",
    (e) => {
      e.diagnostic.entries.push({ ...e.diagnostic.entries[0] });
      e.diagnostic.errorCount = 2;
    },
  ],
  [
    "duplicate header count",
    (e) => {
      e.diagnostic.errorCount = 2;
    },
  ],
  [
    "no diagnostics",
    (e) => {
      e.diagnostic.entries = [];
    },
  ],
  [
    "truncated",
    (e) => {
      e.diagnostic.truncated = true;
    },
  ],
  [
    "unavailable",
    (e) => {
      e.diagnostic.status = "DIAGNOSTIC_UNAVAILABLE";
    },
  ],
  [
    "wrong diagnostic phase",
    (e) => {
      e.diagnostic.entries[0].phase = "build";
    },
  ],
  [
    "unapproved diagnostic code",
    (e) => {
      e.diagnostic.entries[0].code = "TS2322";
    },
  ],
  [
    "private message",
    (e) => {
      e.diagnostic.entries[0].message = messageMarker;
    },
  ],
  [
    "raw stderr",
    (e) => {
      e.diagnostic.stderr = messageMarker;
    },
  ],
  [
    "path absent",
    (e) => {
      e.diagnostic.entries[0].path = "src/absent.ts";
    },
  ],
  [
    "path escape",
    (e) => {
      e.diagnostic.entries[0].path = "src/../main.ts";
    },
  ],
  [
    "absolute path",
    (e) => {
      e.diagnostic.entries[0].path = "C:/src/main.ts";
    },
  ],
  [
    "foreign SHA",
    (e) => {
      e.diagnostic.candidateSha = "9".repeat(64);
    },
  ],
  [
    "tampered candidate",
    (e) => {
      e.bundle.files[0].content += "// mutation";
    },
  ],
  [
    "line out of bounds",
    (e) => {
      e.diagnostic.entries[0].line = 100;
    },
  ],
  [
    "column out of bounds",
    (e) => {
      e.diagnostic.entries[0].column = 100;
    },
  ],
  [
    "line zero",
    (e) => {
      e.diagnostic.entries[0].line = 0;
    },
  ],
  [
    "fractional column",
    (e) => {
      e.diagnostic.entries[0].column = 1.5;
    },
  ],
  [
    "run mismatch",
    (e) => {
      e.generation.binding.runId = "160002";
    },
  ],
  [
    "head mismatch",
    (e) => {
      e.g1.binding.headSha = "9".repeat(40);
    },
  ],
  [
    "workflow mismatch",
    (e) => {
      e.plan.binding.workflowSha256 = "9".repeat(64);
    },
  ],
  [
    "context mismatch",
    (e) => {
      e.custody.binding.contextSha256 = "9".repeat(64);
    },
  ],
  [
    "manifest mismatch",
    (e) => {
      e.g1.binding.manifestSha256 = "9".repeat(64);
    },
  ],
  [
    "request mismatch",
    (e) => {
      e.generation.binding.requestSha256 = "9".repeat(64);
    },
  ],
  [
    "response mismatch",
    (e) => {
      e.generation.binding.responseSha256 = "9".repeat(64);
    },
  ],
  [
    "source mismatch",
    (e) => {
      e.diagnostic.sourceSha = "9".repeat(40);
    },
  ],
  [
    "pair mismatch",
    (e) => {
      e.diagnostic.pairId = "44444444-4444-4444-8444-444444444444";
    },
  ],
  [
    "oracle attempt mismatch",
    (e) => {
      e.diagnostic.attemptId = e.identity.custodyAttemptId;
    },
  ],
  [
    "broken custody link",
    (e) => {
      e.custody.oracleLink.oracleAttemptId = e.identity.custodyAttemptId;
    },
  ],
  [
    "run attempt two",
    (e) => {
      e.identity.runAttempt = "2";
    },
  ],
  [
    "single_generation",
    (e) => {
      e.plan.mode = "single_generation";
    },
  ],
  [
    "plan signed after send",
    (e) => {
      e.plan.signedBeforeSend1 = false;
    },
  ],
  [
    "one reserved POST",
    (e) => {
      e.plan.reservedPosts = 1;
    },
  ],
  [
    "three allowed POSTs",
    (e) => {
      e.plan.maximumPosts = 3;
    },
  ],
  [
    "no confirmed response",
    (e) => {
      e.generation.confirmedResponseCount = 0;
    },
  ],
  [
    "two first sends",
    (e) => {
      e.generation.attemptedRequests = 2;
    },
  ],
  [
    "first SEND_UNKNOWN",
    (e) => {
      e.generation.sendState = "SEND_UNKNOWN";
    },
  ],
  [
    "already reserved attempt two",
    (e) => {
      e.attempt2.reserved = true;
    },
  ],
  [
    "already sent attempt two",
    (e) => {
      e.attempt2.sent = true;
    },
  ],
  [
    "second SEND_UNKNOWN",
    (e) => {
      e.attempt2.sendUnknown = true;
    },
  ],
  [
    "ambiguous claim",
    (e) => {
      e.attempt2.state = "UNKNOWN";
    },
  ],
  [
    "custody absent",
    (e) => {
      e.custody = null;
    },
  ],
  [
    "custody readback failed",
    (e) => {
      e.custody.authenticatedReadback = false;
    },
  ],
  [
    "no same-run lease",
    (e) => {
      e.custody.sameRunLease = false;
    },
  ],
  [
    "normal cleanup failed",
    (e) => {
      e.cleanup.containers = 1;
    },
  ],
  [
    "independent cleanup failed",
    (e) => {
      e.independentCleanup.volumes = 1;
    },
  ],
  [
    "emergency cleanup",
    (e) => {
      e.cleanup.emergencyRemoved = 1;
    },
  ],
  [
    "pending operation",
    (e) => {
      e.independentCleanup.pendingOperations = 1;
    },
  ],
  [
    "claimed G2 coverage",
    (e) => {
      e.downstream.http = 1;
    },
  ],
  [
    "claimed G3 coverage",
    (e) => {
      e.downstream.sqlite = 1;
    },
  ],
  [
    "claimed downstream PASS",
    (e) => {
      e.downstream.G2 = "PASS";
    },
  ],
  [
    "historical production data",
    (e) => {
      e.execution = "REAL_INFERENCE";
    },
  ],
];
for (const [name, mutate] of negatives)
  test(`NO_GO: ${name}`, () => {
    const f = fixture();
    mutate(f.evidence);
    // Reseal: the evidence is authenticated TEST data but semantically invalid.
    const result = f.seal().evaluate(f.evidence);
    assert.equal(result.status, "NO_GO");
    assert.equal(result.feedback, null);
    publicSafe(result);
  });

test("untrusted, replayed and changed snapshots fail closed without leaking exceptions", () => {
  const f = fixture();
  const spike = f.seal();
  f.evidence.diagnostic.entries[0].line++;
  assert.equal(spike.evaluate(f.evidence).reason, "UNAUTHENTICATED");
  assert.equal(
    createOfflineSpike({ authenticate: () => false }).evaluate(
      fixture().evidence,
    ).reason,
    "UNAUTHENTICATED",
  );
  const result = createOfflineSpike({
    authenticate() {
      throw new Error(messageMarker);
    },
  }).evaluate(fixture().evidence);
  assert.equal(result.status, "NO_GO");
  publicSafe(result);
});

test("private context is an immutable same-candidate snapshot; replay and third send are impossible in the test driver", () => {
  const f = fixture();
  const spike = f.seal();
  const a = spike.evaluate(f.evidence);
  const b = spike.evaluate(f.evidence);
  f.evidence.bundle.files[0].content = "tampered";
  let simulatedPosts = 1;
  const fakeSend = (decision) => {
    const context = spike.consumeTestContext(decision);
    simulatedPosts++; // fake sink only; no transport exists in the spike
    return context;
  };
  const privateContext = fakeSend(a);
  assert.ok(
    privateContext.previousGeneratedChanges[0].content.includes(sourceMarker),
  );
  assert.deepEqual(privateContext.diagnosticFeedback, a.feedback);
  assert.throws(() => fakeSend(a), /REPLAY_REJECTED/);
  assert.throws(() => fakeSend(b), /REPLAY_REJECTED/);
  assert.equal(simulatedPosts, 2);
  assert.equal(spike.evaluate(fixture().evidence).reason, "ATTEMPT2_REJECTED");
  assert.throws(
    () => spike.consumeTestContext(structuredClone(a)),
    /REPLAY_REJECTED/,
  );
});

test("production build receipt classifies normal nonzero as FAIL and abnormal phases as ERROR", () => {
  const f = fixture();
  const worker = (checks, extra = {}) => ({
    image: "TEST_IMAGE",
    bundle: f.evidence.bundle,
    evidence: {
      build: {
        args: ["TEST_IMAGE", "/opt/worker/build.mjs"],
        exitCode: 2,
        stdout: JSON.stringify({ checks }),
        ...extra,
      },
    },
  });
  assert.equal(
    buildReceipt(worker(f.checks), "workshop-business").verdict,
    "FAIL",
  );
  for (const change of [
    { error: "ETIMEDOUT", signal: "SIGTERM" },
    { signal: "SIGTERM" },
    { error: "ENOENT" },
    { error: "ENOBUFS" },
    { exitCode: null },
  ])
    assert.equal(
      buildReceipt(worker([{ ...f.checks[0], ...change }]), "workshop-business")
        .verdict,
      "ERROR",
    );
  for (const extra of [
    { timedOut: true },
    { cancelled: true },
    { overflow: true },
    { spawnError: "ENOENT" },
  ])
    assert.equal(
      buildReceipt(worker(f.checks, extra), "workshop-business").verdict,
      "ERROR",
    );
});

test("production complete public FAIL/PASS path survives; G1 FAIL is still rejected", () => {
  const candidate = fixture().evidence.identity.candidateSha;
  const complete = syntheticVerification(candidate, true);
  assert.equal(
    publicRepairDecision(complete, candidate).feedback,
    "HTTP_JSON_TYPE",
  );
  assert.equal(publicTrialOutcome(complete).status, "COMPLETE_PUBLIC_FAIL");
  assert.equal(
    publicRepairDecision(syntheticVerification(candidate), candidate).verdict,
    "PASS",
  );
  complete.attempts[0].gates[1].verdict = "FAIL";
  assert.throws(
    () => publicRepairDecision(complete, candidate),
    (error) => error.code === "G1_FAILED",
  );
  assert.equal(publicTrialOutcome(complete).complete, false);
});

test("evaluation and private test context need no file, network, subprocess or candidate execution", async (t) => {
  const fs = await import("node:fs");
  const fsp = await import("node:fs/promises");
  const http = await import("node:http");
  const https = await import("node:https");
  const net = await import("node:net");
  const child = await import("node:child_process");
  const { syncBuiltinESMExports } = await import("node:module");
  let externalAccesses = 0;
  const forbidden = () => {
    externalAccesses++;
    throw new Error("EXTERNAL_ACCESS_FORBIDDEN");
  };
  for (const [module, methods] of [
    [fs.default, ["readFileSync", "readSync", "openSync", "writeFileSync"]],
    [fsp.default, ["readFile", "open", "readdir", "writeFile"]],
    [http.default, ["request", "get"]],
    [https.default, ["request", "get"]],
    [net.default, ["connect", "createConnection"]],
    [
      child.default,
      ["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync"],
    ],
  ])
    for (const method of methods) t.mock.method(module, method, forbidden);
  t.mock.method(globalThis, "fetch", forbidden);
  syncBuiltinESMExports();
  t.after(() => {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  });
  const f = fixture();
  const spike = f.seal();
  const decision = spike.evaluate(f.evidence);
  assert.equal(decision.status, "G1_BUILD_RECOVERABLE");
  assert.equal(spike.consumeTestContext(decision).execution, "TEST_ONLY");
  assert.equal(externalAccesses, 0);
});
