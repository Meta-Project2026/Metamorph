import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import {
  createCandidateWriter,
  runAgent,
  VerificationReportSchema,
} from "@metamorph/agent";
import {
  CANDIDATE_TEXT,
  createPublicPair,
  mapCoverage,
  OracleBackedVerifier,
  PUBLIC_SCENARIOS,
  parseDemoMarker,
  publicFeedback,
  runIntegrationDemo,
  safeReport,
  validateEvidence,
} from "../dist/index.js";

const signal = () => new AbortController().signal;
async function setup(t, options = {}) {
  const root = await mkdtemp(join(tmpdir(), "metamorph-integration-test-"));
  const source = join(root, "source");
  const artifacts = join(root, "private");
  await mkdir(source);
  await mkdir(artifacts);
  const writer = createCandidateWriter(source);
  const verifier = new OracleBackedVerifier({
    runId: "public-test",
    candidateRoot: writer.root,
    artifactParent: artifacts,
    operationTimeoutMs: 300,
    ...options,
  });
  t.after(async () => {
    await verifier.waitForIdle();
    await rm(root, { recursive: true, force: true });
  });
  return { root, artifacts, writer, verifier };
}
async function write(writer, mode) {
  await writer.write(
    [{ path: "src/candidate.ts", content: CANDIDATE_TEXT[mode] }],
    signal(),
  );
}
function input(writer, verifier, overrides = {}) {
  const calls = [];
  const provider = {
    billing: "synthetic",
    maxRequestCostUsd: 0,
    async generate(request) {
      calls.push(request);
      return {
        changes: [
          {
            path: "src/candidate.ts",
            content:
              request.action === "generate"
                ? CANDIDATE_TEXT.broken
                : CANDIDATE_TEXT.repaired,
          },
        ],
        usage: {
          requestId: `public-${calls.length}`,
          provider: "synthetic",
          modelId: "script",
          inputTokens: null,
          outputTokens: null,
          cachedInputTokens: null,
          estimatedCostUsd: null,
          durationMs: 0,
        },
      };
    },
  };
  return {
    calls,
    args: {
      runId: "public-test",
      writer,
      verifier,
      provider,
      config: {
        benchmarkId: "public-test",
        strategy: "cascade",
        maxRepairsPerUnit: 1,
        maxEscalations: 1,
        maxModelSpendUsd: 1,
        timeoutSeconds: 5,
      },
      benchmark: {
        id: "public-test",
        sourceRepo: "https://example.invalid/public",
        sourceCommit: "0".repeat(40),
        license: "original-synthetic",
        phpRuntime: "NOT_RUN",
        scenarioIds: PUBLIC_SCENARIOS.map((s) => s.id),
        migrationUnitIds: ["candidate"],
        normalizationVersion: "oracle-exact-v1",
      },
      ...overrides,
    },
  };
}

test("offline runAgent invokes real Oracle twice: HTTP/DB FAIL -> repair -> G2/G3 PASS, overall INCONCLUSIVE", async (t) => {
  const { root, manifest, result, calls } = await runIntegrationDemo();
  t.after(() => rm(root, { recursive: true, force: true }));
  assert.equal(result.verdict, "INCONCLUSIVE");
  assert.equal(result.evidenceKind, "synthetic");
  assert.equal(result.repairsByUnit.candidate, 1);
  assert.equal(result.escalations, 0);
  assert.deepEqual(
    calls.map((c) => c.action),
    ["generate", "repair"],
  );
  const [first, second] = manifest.attempts;
  assert.deepEqual(
    first.gateResults.map((g) => g.verdict),
    ["FAIL", "FAIL", "INCONCLUSIVE"],
  );
  assert.deepEqual(
    second.gateResults.map((g) => g.verdict),
    ["PASS", "PASS", "INCONCLUSIVE"],
  );
  assert.notEqual(first.candidateSha256, second.candidateSha256);
  assert.notEqual(first.evidenceDirectory, second.evidenceDirectory);
  assert.deepEqual(
    manifest.attempts.map((a) => a.verificationAttempt),
    [1, 2],
  );
  for (const attempt of manifest.attempts) {
    assert.equal(attempt.runId, manifest.runId);
    assert.deepEqual(
      attempt.executedScenarioIds,
      PUBLIC_SCENARIOS.map((s) => s.id),
    );
    const dir = attempt.evidenceDirectory;
    assert.equal(
      (await readdir(dirname(dir))).filter((n) => n.endsWith(".sqlite")).length,
      2,
    );
    assert.deepEqual(
      JSON.parse(
        await readFile(join(dirname(dir), "integration-attempt.json")),
      ),
      attempt,
    );
    await validateEvidence(
      {
        evidenceDirectory: dir,
        gateResults: attempt.gateResults,
        scope: "synthetic-or-public-scenarios-only",
      },
      dirname(dir),
      PUBLIC_SCENARIOS,
    );
  }
  const httpDiffs = JSON.parse(
    await readFile(join(first.evidenceDirectory, "diffs/0-0-http.json")),
  );
  const dbDiffs = JSON.parse(
    await readFile(join(first.evidenceDirectory, "diffs/0-0-db.json")),
  );
  assert.ok(httpDiffs.some((d) => d.code === "HTTP_STATUS"));
  assert.ok(dbDiffs.some((d) => d.code === "DB_STATE"));
  assert.deepEqual(
    JSON.parse(
      await readFile(join(second.evidenceDirectory, "diffs/0-0-db.json")),
    ),
    [],
  );
  const fresh = JSON.parse(
    await readFile(join(second.evidenceDirectory, "http/1-0.json")),
  );
  assert.deepEqual(
    JSON.parse(Buffer.from(fresh.candidate.bodyBase64, "base64").toString())
      .items,
    [],
  );
  assert.ok(
    !result.events.some(
      (e) => e.type === "gate-result" && ["G0", "G1"].includes(e.result.gate),
    ),
  );
  const sent = JSON.stringify(calls);
  for (const privateText of [
    root,
    "bodyBase64",
    "public-value",
    "mutated",
    "reference.sqlite",
  ])
    assert.ok(!sent.includes(privateText));
  assert.ok(calls[1].repairFeedback.includes("HTTP_STATUS"));
  assert.ok(calls[1].repairFeedback.length <= 512);
  assert.equal(
    JSON.parse(await readFile(join(root, "manifest.json"))).PRODUCT_PASS,
    "NOT_ESTABLISHED",
  );
  assert.equal(
    (await readFile(join(root, "events.jsonl"), "utf8")).trim().split("\n")
      .length,
    result.events.length,
  );
});

test("coverage uses exact colon-containing IDs, rejects duplicates/malformed gates and omits incomplete scenarios", async (t) => {
  const { writer, verifier } = await setup(t);
  await write(writer, "repaired");
  const report = await verifier.verify(writer.root, signal());
  VerificationReportSchema.parse(report);
  assert.deepEqual(
    mapCoverage(report.results, PUBLIC_SCENARIOS),
    PUBLIC_SCENARIOS.map((s) => s.id),
  );
  for (const id of [
    "public:write-read:step-0",
    "public:write-read:step-1",
    "public:write-read:initial",
  ]) {
    const gates = structuredClone(report.results);
    const gate = gates.find(
      (g) => g.gate === (id.endsWith("initial") ? "G3" : "G2"),
    );
    gate.executedTestIds = gate.executedTestIds.filter((x) => x !== id);
    assert.deepEqual(mapCoverage(gates, PUBLIC_SCENARIOS), ["public:fresh"]);
  }
  const duplicate = structuredClone(report.results);
  duplicate[0].executedTestIds.push(duplicate[0].executedTestIds[0]);
  assert.throws(() => mapCoverage(duplicate, PUBLIC_SCENARIOS));
  const unknown = structuredClone(report.results);
  unknown[0].executedTestIds.push("other:step-0");
  assert.throws(() => mapCoverage(unknown, PUBLIC_SCENARIOS));
  assert.throws(() =>
    mapCoverage(report.results, [PUBLIC_SCENARIOS[0], PUBLIC_SCENARIOS[0]]),
  );
  assert.throws(() => mapCoverage(report.results.slice(1), PUBLIC_SCENARIOS));
  assert.throws(() =>
    mapCoverage(
      [report.results[0], report.results[0], report.results[2]],
      PUBLIC_SCENARIOS,
    ),
  );
  assert.throws(() =>
    mapCoverage([{ gate: "G2", verdict: "PASS" }], PUBLIC_SCENARIOS),
  );
  const fakeG4 = structuredClone(report.results);
  fakeG4[2].verdict = "PASS";
  assert.throws(() => safeReport(fakeG4, PUBLIC_SCENARIOS));
});

test("feedback is an explicit bounded allowlist; raw values and unknown/held-out IDs never enter prompts or events", () => {
  const raw = "SECRET /absolute/reference.sqlite bodyBase64 expected";
  const gates = [
    {
      gate: "G3",
      verdict: "FAIL",
      executedTestIds: ["public:fresh:initial"],
      evidencePaths: ["db/0.json"],
      findings: [
        { code: "DB_STATE", message: raw, scenarioId: "public:fresh" },
        { code: "HTTP_STATUS", message: raw, scenarioId: "held-out:secret" },
        { code: "PRIVATE_CODE", message: raw, scenarioId: "public:fresh" },
      ],
    },
  ];
  const feedback = publicFeedback(gates, PUBLIC_SCENARIOS);
  assert.ok(feedback.includes("DB_STATE"));
  for (const forbidden of [
    raw,
    "held-out",
    "PRIVATE_CODE",
    "reference",
    "expected",
  ])
    assert.ok(!feedback.includes(forbidden));
  assert.equal(
    publicFeedback([{ ...gates[0], verdict: "ERROR" }], PUBLIC_SCENARIOS),
    null,
  );
  gates[0].findings = Array.from({ length: 500 }, () => gates[0].findings[0]);
  assert.ok(publicFeedback(gates, PUBLIC_SCENARIOS).length <= 512);
});

test("zero budget and pre-abort prevent provider, writer and Oracle work", async (t) => {
  const { writer, verifier, artifacts } = await setup(t);
  const zero = input(writer, verifier);
  zero.args.config.maxModelSpendUsd = 0;
  const blocked = await runAgent(zero.args);
  assert.equal(blocked.verdict, "INCONCLUSIVE");
  assert.equal(blocked.reason, "ZERO_BUDGET");
  assert.equal(zero.calls.length, 0);
  const controller = new AbortController();
  controller.abort();
  const aborted = input(writer, verifier, { signal: controller.signal });
  assert.equal((await runAgent(aborted.args)).verdict, "ERROR");
  assert.equal(aborted.calls.length, 0);
  await assert.rejects(
    verifier.verify(writer.root, controller.signal),
    /INTEGRATION_VERIFICATION_ERROR/,
  );
  assert.deepEqual(await readdir(artifacts), []);
  assert.equal(verifier.attempts.length, 0);
});

test("repeated real mutation respects total repair/escalation caps", async (t) => {
  const { writer, verifier } = await setup(t);
  const run = input(writer, verifier);
  const generate = run.args.provider.generate;
  run.args.provider.generate = async (...args) => {
    const response = await generate(...args);
    response.changes[0].content = CANDIDATE_TEXT.broken;
    return response;
  };
  const result = await runAgent(run.args);
  assert.equal(result.verdict, "FAIL");
  assert.equal(result.reason, "REPAIR_AND_ESCALATION_LIMIT");
  assert.deepEqual(
    run.calls.map((c) => c.action),
    ["generate", "repair", "escalate"],
  );
  assert.equal(result.repairsByUnit.candidate, 1);
  assert.equal(result.escalations, 1);
  assert.equal(verifier.attempts.length, 3);
});

for (const fault of ["exception", "timeout", "close", "evidence-write"]) {
  test(`real Oracle fails safely on worker ${fault} without leaking exception`, async (t) => {
    const { writer, verifier } = await setup(t, {
      operationTimeoutMs: 30,
      createPair: async (root, mode, s) => {
        const pair = await createPublicPair(root, mode, s);
        if (fault === "exception")
          pair.candidate.snapshot = async () => {
            throw new Error("PRIVATE_DB_SECRET");
          };
        if (fault === "timeout")
          pair.candidate.reset = () => new Promise(() => {});
        if (fault === "close") {
          const close = pair.candidate.close;
          pair.candidate.close = async (s) => {
            await close(s);
            throw new Error("PRIVATE_CLOSE_SECRET");
          };
        }
        if (fault === "evidence-write") {
          const close = pair.candidate.close;
          pair.candidate.close = async (s) => {
            await close(s);
            const dir = (await readdir(root)).find((n) =>
              n.startsWith("oracle-"),
            );
            await mkdir(join(root, dir, "gate-results.json"));
          };
        }
        return pair;
      },
    });
    const { args } = input(writer, verifier);
    const result = await runAgent(args);
    await verifier.waitForIdle();
    assert.equal(result.verdict, "ERROR");
    assert.ok(!JSON.stringify(result).includes("PRIVATE_"));
    assert.ok(
      !result.events.some(
        (e) => e.type === "run-state-changed" && e.state === "PASS",
      ),
    );
  });
}

test("missing/tampered evidence and control failure cannot be accepted as complete verification", async (t) => {
  const { writer, verifier } = await setup(t);
  await write(writer, "repaired");
  await verifier.verify(writer.root, signal());
  const attempt = verifier.attempts[0];
  const raw = {
    evidenceDirectory: attempt.evidenceDirectory,
    gateResults: attempt.gateResults,
    scope: "synthetic-or-public-scenarios-only",
  };
  const missingIndex = structuredClone(raw);
  missingIndex.gateResults[0].evidencePaths =
    missingIndex.gateResults[0].evidencePaths.filter(
      (p) => p !== "diffs/0-0-http.json",
    );
  await assert.rejects(
    validateEvidence(
      missingIndex,
      dirname(raw.evidenceDirectory),
      PUBLIC_SCENARIOS,
    ),
    /INCOMPLETE_EVIDENCE_INDEX/,
  );
  const controlFailure = structuredClone(attempt.gateResults);
  controlFailure[2].verdict = "FAIL";
  controlFailure[2].findings = [
    { code: "CONTROL_FAILURE", message: "Synthetic control failed" },
  ];
  assert.equal(
    safeReport(controlFailure, PUBLIC_SCENARIOS).results[2].verdict,
    "FAIL",
  );
  const external = input(writer, {
    evidenceKind: "synthetic",
    verify: async () => safeReport(controlFailure, PUBLIC_SCENARIOS),
  });
  external.args.config.maxRepairsPerUnit = 0;
  external.args.config.maxEscalations = 0;
  assert.equal((await runAgent(external.args)).verdict, "FAIL");
  await rm(join(raw.evidenceDirectory, "diffs/0-0-db.json"));
  await assert.rejects(
    validateEvidence(raw, dirname(raw.evidenceDirectory), PUBLIC_SCENARIOS),
  );
  await writeFile(join(raw.evidenceDirectory, "diffs/0-0-db.json"), "[]");
  await writeFile(join(raw.evidenceDirectory, "gate-results.json"), "[]");
  await assert.rejects(
    validateEvidence(raw, dirname(raw.evidenceDirectory), PUBLIC_SCENARIOS),
    /MISMATCH/,
  );
});

test("a write during verification invalidates the snapshot; marker parser accepts no executable text", async (t) => {
  let writer;
  const state = await setup(t, {
    createPair: async (root, mode, s) => {
      await write(writer, "repaired");
      return createPublicPair(root, mode, s);
    },
  });
  writer = state.writer;
  await write(writer, "broken");
  await assert.rejects(
    state.verifier.verify(writer.root, signal()),
    /INTEGRATION_VERIFICATION_ERROR/,
  );
  assert.equal(state.verifier.attempts.length, 0);
  const executable = "throw new Error('candidate must never execute');";
  assert.throws(() => parseDemoMarker(executable));
  await writer.write(
    [{ path: "src/candidate.ts", content: executable }],
    signal(),
  );
  await assert.rejects(state.verifier.verify(writer.root, signal()));
  for (const content of [
    "broken",
    `${CANDIDATE_TEXT.broken}\n`,
    CANDIDATE_TEXT.repaired + executable,
  ])
    assert.throws(() => parseDemoMarker(content));
});

test("candidate writer cannot target Oracle artifacts; overlapping verifier roots reject", async (t) => {
  const { writer, verifier, artifacts } = await setup(t);
  for (const path of [
    "../private/evidence.ts",
    "src/oracle/runner.ts",
    join(artifacts, "secret.ts"),
  ])
    await assert.rejects(writer.write([{ path, content: "bad" }], signal()));
  assert.deepEqual(await readdir(artifacts), []);
  await write(writer, "repaired");
  await assert.rejects(verifier.verify(artifacts, signal()));
  const overlap = new OracleBackedVerifier({
    runId: "public-test",
    candidateRoot: writer.root,
    artifactParent: writer.root,
    operationTimeoutMs: 20,
  });
  await assert.rejects(overlap.verify(writer.root, signal()));
});

test("mid-flight cancellation rejects late results, closes fixture resources and admits no later operations", async (t) => {
  const controller = new AbortController();
  let closeCount = 0;
  let entered;
  const ready = new Promise((resolve) => {
    entered = resolve;
  });
  const { writer, verifier } = await setup(t, {
    operationTimeoutMs: 100,
    createPair: async (root, mode, s) => {
      const pair = await createPublicPair(root, mode, s);
      const reset = pair.candidate.reset;
      pair.candidate.reset = async (s) => {
        entered();
        await new Promise((resolve) => setTimeout(resolve, 30));
        return reset(s);
      };
      for (const w of [pair.reference, pair.candidate]) {
        const close = w.close;
        w.close = async (s) => {
          await close(s);
          closeCount++;
        };
      }
      return pair;
    },
  });
  await write(writer, "repaired");
  const pending = verifier.verify(writer.root, controller.signal);
  await ready;
  await assert.rejects(
    verifier.verify(writer.root, signal()),
    /VERIFICATION_BUSY/,
  );
  controller.abort();
  await assert.rejects(pending, /INTEGRATION_VERIFICATION_ERROR/);
  await verifier.waitForIdle();
  assert.equal(closeCount, 2);
  assert.equal(verifier.attempts.length, 0);
});

test("agent deadline stops accepting Oracle results and drains cooperative cleanup", async (t) => {
  let closes = 0;
  const { writer, verifier } = await setup(t, {
    operationTimeoutMs: 2000,
    createPair: async (root, mode, s) => {
      const pair = await createPublicPair(root, mode, s);
      pair.candidate.reset = async (signal) => {
        await new Promise((resolve) => {
          if (signal.aborted) resolve();
          else signal.addEventListener("abort", resolve, { once: true });
        });
        signal.throwIfAborted();
      };
      for (const w of [pair.reference, pair.candidate]) {
        const close = w.close;
        w.close = async (s) => {
          await close(s);
          closes++;
        };
      }
      return pair;
    },
  });
  const { args } = input(writer, verifier);
  args.config.timeoutSeconds = 1;
  const result = await runAgent(args);
  await verifier.waitForIdle();
  assert.equal(result.verdict, "ERROR");
  assert.equal(result.reason, "TIMEOUT");
  assert.equal(verifier.attempts.length, 0);
  assert.equal(closes, 2);
});
