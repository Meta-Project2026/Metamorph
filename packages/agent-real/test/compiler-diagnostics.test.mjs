import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { MANIFEST, SOURCE } from "@metamorph/oracle";
import { sha256, validateBundle } from "../../target-worker/src/admission.mjs";
import {
  DIAGNOSTIC_LIMITS,
  publicCompilerDiagnostics,
  summarizeCompilerDiagnostics,
} from "../src/compiler-diagnostics.mjs";
import { publicAttempt } from "../src/report.mjs";
import { buildReceipt, observeBuild } from "../src/runtime.mjs";

const content =
  "export const value: number = 'PRIVATE_SOURCE_MARKER';\n".repeat(100);
const candidate = (paths = ["src/main.ts", "src/nested/value.ts"]) =>
  validateBundle(
    paths.map((path) => ({ path, content, sha256: sha256(content) })),
  );
const bundle = candidate();
const phase = (stdout, extra = {}) => ({
  phase: "typecheck",
  exitCode: 2,
  signal: null,
  error: null,
  stdout,
  stderr: "",
  ...extra,
});
const diagnostic = (path = "src/main.ts", line = 1, code = "TS2322") =>
  `${path}(${line},1): error ${code}: PRIVATE_MESSAGE ghp_SECRET_MARKER eyJSECRET_OIDC <?php private();`;
const summarize = (stdout, extra = {}) =>
  summarizeCompilerDiagnostics([phase(stdout, extra)], bundle);
const identity = (value = bundle) => ({
  sourceSha: SOURCE.commit,
  candidateSha: value.candidateSha,
  attemptId: randomUUID(),
  pairId: randomUUID(),
  g1Verdict: "FAIL",
});
const publish = (summary) => publicCompilerDiagnostics(summary, identity());
const worker = (checks = [phase(diagnostic())], extra = {}) => ({
  image: "sha256:synthetic",
  bundle,
  evidence: {
    build: {
      args: ["sha256:synthetic", "/opt/worker/build.mjs"],
      exitCode: 2,
      stdout: JSON.stringify({ checks, artifacts: [] }),
      ...extra,
    },
  },
});
const assertPrivate = (value) =>
  assert.doesNotMatch(
    JSON.stringify(value),
    /PRIVATE_|ghp_|eyJSECRET|OIDC|<\?php|stdout|stderr|stack|\/work\/|responseBody/,
  );

test("plain compiler headers publish only allowed codes/locations, including nested files", () => {
  const summary = summarize(
    `${diagnostic()}\n${diagnostic("src/nested/value.ts", 2, "TS12345")}\n`,
  );
  const result = publish(summary);
  assert.equal(result.status, "AVAILABLE");
  assert.equal(result.errorCount, 2);
  assert.equal(result.truncated, false);
  assert.deepEqual(result.entries, [
    {
      phase: "typecheck",
      code: "TS2322",
      path: "src/main.ts",
      line: 1,
      column: 1,
    },
    {
      phase: "typecheck",
      code: "TS12345",
      path: "src/nested/value.ts",
      line: 2,
      column: 1,
    },
  ]);
  assertPrivate(result);
  assert.equal(result.candidateSha, bundle.candidateSha);
  assert.equal(result.sourceSha, SOURCE.commit);
  assert.equal(result.g1Verdict, "FAIL");
  assert.ok(Object.isFrozen(summary.entries[0]));
});

test("build phase and stderr diagnostics work after a successful empty typecheck", () => {
  const result = publish(
    summarizeCompilerDiagnostics(
      [
        phase("", { exitCode: 0 }),
        phase("", { phase: "build", stderr: diagnostic() }),
      ],
      bundle,
    ),
  );
  assert.equal(result.entries[0].phase, "build");
  assertPrivate(result);
});

test("Unicode message and indented excerpts/forged headers are discarded", () => {
  const result = publish(
    summarize(
      `${diagnostic()} — Ошибка 🐈\r\n  PRIVATE_SOURCE_MARKER\r\n  ${diagnostic("src/nested/value.ts", 2)}\r\n    ~~~~~\r\n`,
    ),
  );
  assert.equal(result.errorCount, 1);
  assert.equal(result.entries.length, 1);
  assertPrivate(result);
});

for (const [name, raw] of Object.entries({
  empty: "",
  whitespace: " \n",
  incomplete: "src/main.ts(1,1): error TS23",
  ansi: `\u001b[31m${diagnostic()}\u001b[0m`,
  osc: `${diagnostic()}\u001b]52;c;PRIVATE_SECRET\u0007`,
  unicodePath: diagnostic("src/секрет.ts"),
  absolute: diagnostic("/work/src/main.ts"),
  windows: diagnostic("C:\\private\\src\\main.ts"),
  traversal: diagnostic("src/../main.ts"),
  nestedTraversal: diagnostic("src/nested/../../main.ts"),
  encodedTraversal: diagnostic("src/%2e%2e/main.ts"),
  backslash: diagnostic("src\\main.ts"),
  doubleSlash: diagnostic("src//main.ts"),
  outside: diagnostic("lib/main.ts"),
  unknownFile: diagnostic("src/unadmitted.ts"),
  protectedFile: diagnostic("src/oracle.ts"),
  shell: diagnostic("src/$(PRIVATE_SECRET).ts"),
  dotFile: diagnostic("src/.private.ts"),
  zeroLine: diagnostic("src/main.ts", 0),
  negativeLine: diagnostic("src/main.ts", -1),
  hugeLine: diagnostic("src/main.ts", "9999999999999999999"),
  sourceLineOverflow: diagnostic("src/main.ts", 102),
  zeroColumn: diagnostic().replace("(1,1)", "(1,0)"),
  columnOverflow: diagnostic().replace("(1,1)", "(1,999)"),
  noNumericCode: "error: compiler crashed PRIVATE_SECRET",
  shortCode: diagnostic("src/main.ts", 1, "TS123"),
  longCode: diagnostic("src/main.ts", 1, "TS123456"),
  codeSuffix: diagnostic("src/main.ts", 1, "TS2322_SECRET"),
  stack: `${diagnostic()}\nError: PRIVATE_STACK\n    at /private/path`,
  malformedAfterValid: `${diagnostic()}\nerror: PRIVATE_SECRET`,
  unindentedExcerpt: `${diagnostic()}\nconst PRIVATE_SOURCE_MARKER = 1;`,
  carriageReturn: `${diagnostic()}\rPRIVATE_SECRET`,
  unicodeSeparator: `${diagnostic()}\u2028PRIVATE_SECRET`,
  bidiPath: diagnostic("src/ma\u202ein.ts"),
  nul: `${diagnostic()}\0PRIVATE_SECRET`,
})) {
  test(`unavailable for ${name}; no raw text is public and G1 stays FAIL`, () => {
    const observed = observeBuild(worker([phase(raw)]), MANIFEST[0].id);
    assert.equal(observed.build.verdict, "FAIL");
    assert.deepEqual(observed.build.findingCodes, ["BUILD_FAILED"]);
    const result = publish(observed.compilerDiagnostics);
    assert.equal(result.status, "DIAGNOSTIC_UNAVAILABLE");
    assert.equal(result.errorCount, null);
    assert.deepEqual(result.entries, []);
    assertPrivate(result);
  });
}

test("large output and oversized individual lines fail closed with truncation", () => {
  for (const raw of [
    "x".repeat(DIAGNOSTIC_LIMITS.inputBytes + 1),
    `${diagnostic()}${"x".repeat(DIAGNOSTIC_LIMITS.lineBytes)}`,
  ]) {
    const result = publish(summarize(raw));
    assert.equal(result.status, "DIAGNOSTIC_UNAVAILABLE");
    assert.equal(result.truncated, true);
    assertPrivate(result);
  }
});

test("max 20 distinct locations; duplicates count as headers but consume no slots", () => {
  const raw = Array.from({ length: 30 }, (_, i) =>
    diagnostic("src/main.ts", i + 1),
  );
  raw.unshift(raw[0]);
  const result = publish(summarize(raw.join("\n")));
  assert.equal(result.errorCount, 31);
  assert.equal(result.entries.length, 20);
  assert.equal(result.truncated, true);
  assert.ok(
    Buffer.byteLength(JSON.stringify(result)) <=
      DIAGNOSTIC_LIMITS.serializedBytes,
  );
  assertPrivate(result);
  const duplicate = publish(summarize([diagnostic(), diagnostic()].join("\n")));
  assert.equal(duplicate.entries.length, 1);
  assert.equal(duplicate.errorCount, 2);
  assert.equal(duplicate.truncated, false);
});

test("maximum length admitted paths still fit the fixed serialized byte limit", () => {
  const value = candidate(["src/main.ts", `src/${"a".repeat(233)}.ts`]);
  const path = value.files.find((f) => f.path !== "src/main.ts").path;
  const result = publicCompilerDiagnostics(
    summarizeCompilerDiagnostics(
      [
        phase(
          Array.from({ length: 20 }, (_, i) => diagnostic(path, i + 1)).join(
            "\n",
          ),
        ),
      ],
      value,
    ),
    identity(value),
  );
  assert.equal(result.entries.length, 20);
  assert.ok(
    Buffer.byteLength(JSON.stringify(result)) <=
      DIAGNOSTIC_LIMITS.serializedBytes,
  );
});

test("secret-like paths, foreign candidates, unissued/modified summaries are unavailable", () => {
  for (const path of [
    "src/ghp_PRIVATE_SECRET.ts",
    "src/github_pat_PRIVATE_SECRET.ts",
    "src/oidc/token.ts",
    "src/eyJabcdefghi.ts",
  ]) {
    const value = candidate(["src/main.ts", path]);
    const summary = summarizeCompilerDiagnostics(
      [phase(diagnostic(path))],
      value,
    );
    assert.equal(
      publicCompilerDiagnostics(summary, identity(value)).status,
      "DIAGNOSTIC_UNAVAILABLE",
    );
  }
  const summary = summarize(diagnostic());
  assert.equal(
    publicCompilerDiagnostics(summary, { ...identity(), g1Verdict: "PASS" })
      .status,
    "DIAGNOSTIC_UNAVAILABLE",
  );
  const foreign = publicCompilerDiagnostics(summary, {
    ...identity(),
    candidateSha: "b".repeat(64),
  });
  assert.equal(foreign.status, "DIAGNOSTIC_UNAVAILABLE");
  for (const value of [
    undefined,
    null,
    {},
    { ...summary, raw: "PRIVATE_SECRET" },
    JSON.parse(JSON.stringify(summary)),
  ]) {
    const result = publish(value);
    assert.equal(result.status, "DIAGNOSTIC_UNAVAILABLE");
    assertPrivate(result);
  }
  assert.throws(() => {
    summary.entries[0].path = "PRIVATE_SECRET";
  });
});

test("malformed phase streams/identity are rejected without fabricated diagnostics", () => {
  for (const checks of [
    [],
    [phase(null)],
    [phase(undefined)],
    [phase(diagnostic(), { stderr: null })],
    [phase(diagnostic(), { phase: "private" })],
    [phase(diagnostic(), { exitCode: 0 })],
    [phase(diagnostic(), { signal: "SIGKILL" })],
  ])
    assert.equal(
      publish(summarizeCompilerDiagnostics(checks, bundle)).status,
      "DIAGNOSTIC_UNAVAILABLE",
    );
  assert.equal(
    publish(summarizeCompilerDiagnostics([phase(diagnostic())], {})).status,
    "DIAGNOSTIC_UNAVAILABLE",
  );
  for (const bad of [
    { sourceSha: "PRIVATE_SECRET" },
    { attemptId: "PRIVATE_SECRET" },
    { pairId: "PRIVATE_SECRET" },
    { candidateSha: "PRIVATE_SECRET" },
    { g1Verdict: "PRIVATE_SECRET" },
  ])
    assert.throws(
      () =>
        publicCompilerDiagnostics(summarize(diagnostic()), {
          ...identity(),
          ...bad,
        }),
      { code: "EVIDENCE_ERROR" },
    );
});

test("trusted envelope, ERROR, PASS, and missing build classifications stay unchanged", () => {
  for (const extra of [
    { timedOut: true },
    { cancelled: true },
    { overflow: true },
    { spawnError: "ENOENT" },
    { exitCode: 137 },
  ]) {
    const observed = observeBuild(worker(undefined, extra), MANIFEST[0].id);
    assert.equal(observed.build.verdict, "ERROR");
    assert.equal(
      publish(observed.compilerDiagnostics).status,
      "DIAGNOSTIC_UNAVAILABLE",
    );
  }
  for (const extra of [{ args: [] }, { stdout: "" }, { stdout: '{"checks":[' }])
    assert.throws(() => observeBuild(worker(undefined, extra), MANIFEST[0].id));
  const success = worker(
    [phase("", { exitCode: 0 }), phase("", { phase: "build", exitCode: 0 })],
    { exitCode: 0 },
  );
  success.evidence.buildChecks = [{}, {}];
  assert.equal(buildReceipt(success, MANIFEST[0].id).verdict, "PASS");
  assert.equal(
    buildReceipt({ evidence: {} }, MANIFEST[0].id).verdict,
    "INCONCLUSIVE",
  );
});

test("public attempt/trial JSON binds sidecar and preserves fixed G1 codes and missing coverage", () => {
  const attemptId = randomUUID(),
    pairId = randomUUID();
  const observed = observeBuild(worker(), MANIFEST[0].id);
  const result = publicAttempt({
    attemptId,
    candidateSha: bundle.candidateSha,
    pairs: [
      {
        attemptId,
        pairId,
        candidateSha: bundle.candidateSha,
        scenarioId: MANIFEST[0].id,
        ...observed,
        gates: [],
        cleanup: "VERIFIED_ZERO_RESOURCES",
        raw: "PRIVATE_SOURCE_MARKER",
        packs: [
          {
            id: "oracle-synthetic",
            sha256: "b".repeat(64),
            reference: "synthetic/index.json",
          },
        ],
      },
    ],
  });
  assert.deepEqual(
    result.gates.map((g) => g.verdict),
    ["INCONCLUSIVE", "FAIL", "INCONCLUSIVE", "INCONCLUSIVE", "INCONCLUSIVE"],
  );
  assert.deepEqual(result.gates[1].findingCodes, ["BUILD_FAILED"]);
  assert.deepEqual(result.coverage, {
    http: 0,
    sqlite: 0,
    requiredHttp: 17,
    requiredSqlite: 20,
  });
  const block = result.pairs[0].compilerDiagnostics;
  assert.equal(block.attemptId, attemptId);
  assert.equal(block.pairId, pairId);
  assert.equal(block.candidateSha, bundle.candidateSha);
  assert.equal(block.status, "AVAILABLE");
  assertPrivate(JSON.parse(JSON.stringify({ attempts: [result] })));
  assert.deepEqual(Object.keys(observed.build).sort(), [
    "executedTestIds",
    "findingCodes",
    "gate",
    "verdict",
  ]);
});
