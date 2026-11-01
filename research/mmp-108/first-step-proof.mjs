// MMP-108 offline first-step proof. Linux-only, secret-free, no model provider.
// Known-good pinned fixture and synthetic adapters only; the historical paid
// candidate is UNAVAILABLE and is never emulated. Candidate TS and reference PHP
// execute exclusively inside the trusted network-off Docker workers.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bindMigrationContext } from "../../packages/agent-real/src/migration-context.mjs";
import { validateGeneratedMigration } from "../../packages/agent-real/src/migration-trial.mjs";
import {
  MANIFEST_PIN,
  RECIPE_PIN,
  validateRuntimeRecipe,
} from "../../packages/agent-real/src/runtime.mjs";
import { WORKSHOP_CANDIDATE_SHA } from "../../packages/differential/src/workshop-policy.mjs";
import {
  MANIFEST,
  SOURCE,
  verifyPair,
} from "../../packages/oracle/dist/index.js";
import {
  admitDirectory,
  sha256,
  validateBundle,
} from "../../packages/target-worker/src/admission.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
assert.equal(process.platform, "linux", "Linux-only disposable harness");
assert.ok(
  !process.env.MODEL_API_KEY &&
    !process.env.GH_TOKEN &&
    !process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN,
  "No credentials may be mapped",
);
const parent = resolve(process.env.MMP108_PRIVATE_PARENT ?? "");
const output = resolve(process.env.MMP108_PUBLIC_OUTPUT ?? "");
const outsideRepo = (path) =>
  isAbsolute(path) && relative(root, path).startsWith("..");
assert.ok(
  outsideRepo(parent) && outsideRepo(output),
  "Private parent and output must be fresh, absolute and outside the repository",
);
process.umask(0o077);
mkdirSync(parent, { recursive: true, mode: 0o700 });
mkdirSync(output, { recursive: true, mode: 0o700 });
const headSha = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
assert.match(headSha, /^[a-f0-9]{40}$/);
assert.equal(headSha, process.env.AGENT_HEAD_SHA, "Exact reviewed head only");
validateRuntimeRecipe(join(root, "packages/target-worker/runtime"));
const engine = spawnSync(
  "docker",
  ["version", "--format", "{{json .Server}}"],
  {
    encoding: "utf8",
    timeout: 30000,
  },
);
assert.equal(engine.status, 0, "Docker engine required");
const server = JSON.parse(engine.stdout);
assert.equal(server.Os, "linux");
assert.equal(server.Arch, "amd64");

const originalFetch = globalThis.fetch;
let sourceFetches = 0;
let blockedRequests = 0;
// The only admitted host fetch is the exact pinned public source archive.
globalThis.fetch = (input, ...args) => {
  if (
    String(input) !==
    `https://codeload.github.com/${SOURCE.repository}/tar.gz/${SOURCE.commit}`
  ) {
    blockedRequests++;
    throw Error("NETWORK_NOT_ADMITTED");
  }
  sourceFetches++;
  return originalFetch(input, ...args);
};

const save = (path, value) => {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
  chmodSync(path, 0o644);
};
const gateView = (gate) => ({
  gate: gate.gate,
  verdict: gate.verdict,
  executedCount: gate.executedTestIds.length,
  executedFirst: gate.executedTestIds[0] ?? null,
  executedLast: gate.executedTestIds.at(-1) ?? null,
  findingCodes: [
    ...new Set(
      (gate.findings ?? gate.findingCodes ?? []).map((finding) =>
        typeof finding === "string" ? finding : finding.code,
      ),
    ),
  ],
});
const cleanupReceipt = (dir, name) => {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const child = spawnSync(
    process.execPath,
    [join(root, "packages/differential/src/workshop-finalizer.mjs")],
    {
      cwd: root,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        TZ: "UTC",
        WORKSHOP_PUBLIC_OUTPUT: dir,
        PILOT_HEAD_SHA: headSha,
      },
      timeout: 120000,
      maxBuffer: 1024 * 1024,
    },
  );
  assert.equal(child.status, 0, `Finalizer failed for ${name}`);
  const record = JSON.parse(readFileSync(join(dir, "finalizer.json"), "utf8"));
  assert.equal(record.headSha, headSha);
  assert.equal(record.status, "PASS");
  assert.equal(record.emergencyRemoved, 0);
  assert.deepEqual(record.inventory, { containers: 0, volumes: 0 });
  return {
    status: record.status,
    inventory: record.inventory,
    emergencyRemoved: record.emergencyRemoved,
  };
};
const assertSealed = (directory) => {
  // verifyPair writes gate-results.json last: an existing marker means sealed.
  assert.ok(existsSync(join(directory, "gate-results.json")), "EVIDENCE_SEAL");
  assert.ok(existsSync(join(directory, "manifest.json")), "EVIDENCE_MANIFEST");
};
const REAL_TIMEOUT_MS = 20 * 60 * 1000;
const bindContext = () =>
  bindMigrationContext(
    readFileSync(join(root, "research/mmp-061/public-source.json"), "utf8"),
  );
const fixtureDir = join(root, "packages/target-worker/fixtures/workshop");
const CLEAN = {
  status: "VERIFIED_ZERO_RESOURCES",
  containers: 0,
  volumes: 0,
  emergencyRemoved: 0,
};

async function knownGoodCase() {
  const bundle = await admitDirectory(fixtureDir, WORKSHOP_CANDIDATE_SHA);
  assert.equal(bundle.candidateSha, WORKSHOP_CANDIDATE_SHA);
  const notice = bundle.files.find((file) => file.path === "src/schema.ts");
  assert.ok(notice && /MIT License/i.test(notice.content), "LICENCE_NOTICE");
  const runParent = join(parent, "known-good");
  mkdirSync(runParent, { recursive: true, mode: 0o700 });
  const result = await validateGeneratedMigration({
    context: bindContext(),
    root,
    parent: runParent,
    headSha,
    candidateRoot: fixtureDir,
    candidateSha: bundle.candidateSha,
    signal: AbortSignal.timeout(REAL_TIMEOUT_MS),
  });
  assert.equal(result.publicG1, "PASS");
  assert.equal(result.publicG2, "PASS");
  assert.equal(result.publicG3, "PASS");
  assert.equal(result.product, "NOT_ESTABLISHED");
  assert.deepEqual(result.cleanup, CLEAN);
  assert.doesNotMatch(
    JSON.stringify(result),
    /MMP108_PRIVATE|ghp_|stdout|stderr/,
  );
  assert.equal(result.attempts.length, 1);
  const attempt = result.attempts[0];
  assert.equal(attempt.candidateSha, WORKSHOP_CANDIDATE_SHA);
  assert.deepEqual(attempt.coverage, {
    http: 17,
    sqlite: 20,
    requiredHttp: 17,
    requiredSqlite: 20,
  });
  const byGate = Object.fromEntries(attempt.gates.map((g) => [g.gate, g]));
  assert.equal(byGate.G1.verdict, "PASS");
  assert.equal(byGate.G1.executedTestIds.length, 6);
  assert.equal(byGate.G2.verdict, "PASS");
  assert.equal(byGate.G2.executedTestIds.length, 17);
  assert.equal(byGate.G2.executedTestIds[0], "workshop-business:step-0");
  assert.equal(byGate.G3.verdict, "PASS");
  assert.equal(byGate.G3.executedTestIds.length, 20);
  // Stage ordinals: the initial DB observation strictly precedes the first
  // HTTP step, and the post-request DB observation follows it.
  assert.equal(byGate.G3.executedTestIds[0], "workshop-business:initial");
  assert.equal(
    byGate.G3.executedTestIds.indexOf("workshop-business:step-0"),
    1,
    "Post-request DB observation must follow the first HTTP step",
  );
  assert.equal(byGate.G4.verdict, "INCONCLUSIVE");
  assert.ok(byGate.G4.findingCodes.includes("HELD_OUT_NOT_RUN"));
  assert.deepEqual(
    attempt.pairs.map((pair) => pair.scenarioId),
    MANIFEST.map((scenario) => scenario.id),
  );
  for (const pair of attempt.pairs) {
    assert.equal(pair.cleanup, "VERIFIED_ZERO_RESOURCES");
    assert.ok(pair.packs.length >= 1);
    for (const pack of pair.packs) assert.match(pack.sha256, /^[a-f0-9]{64}$/);
    const pairGates = Object.fromEntries(
      (pair.gates ?? []).map((g) => [g.gate, g]),
    );
    assert.equal(pairGates.G2?.verdict, "PASS");
    assert.equal(pairGates.G3?.verdict, "PASS");
  }
  const finalizer = cleanupReceipt(
    join(parent, "finalizer-known-good"),
    "known-good",
  );
  return {
    id: "known-good-real-docker-first-step",
    status: "PASS",
    execution: "REAL_DOCKER_PINNED_PUBLIC_KNOWN_GOOD",
    candidateSha: bundle.candidateSha,
    gates: {
      G1: gateView(byGate.G1),
      G2: gateView(byGate.G2),
      G3: gateView(byGate.G3),
      G4: gateView(byGate.G4),
    },
    coverage: attempt.coverage,
    stageOrdinals: {
      firstInitialDb: "workshop-business:initial",
      firstHttpStep: "workshop-business:step-0",
      firstPostRequestDb: "workshop-business:step-0",
    },
    pairs: attempt.pairs.length,
    cleanup: result.cleanup,
    finalizer,
    licenceNotice: "MIT notice verified in src/schema.ts",
  };
}

async function firstStepFaultCase() {
  const bundle = await admitDirectory(fixtureDir, WORKSHOP_CANDIDATE_SHA);
  const marker = "  res.end(\n";
  const files = bundle.files.map((file) => {
    if (file.path !== "src/main.ts") return file;
    assert.equal(file.content.split(marker).length, 2);
    return {
      ...file,
      content: file.content.replace(
        marker,
        `  res.statusCode = 503;\n${marker}`,
      ),
    };
  });
  const source = validateBundle(
    files.map((file) => ({ ...file, sha256: sha256(file.content) })),
  );
  assert.notEqual(source.candidateSha, WORKSHOP_CANDIDATE_SHA);
  const candidateRoot = join(parent, "first-step-fault-candidate");
  mkdirSync(join(candidateRoot, "src"), { recursive: true, mode: 0o700 });
  for (const file of source.files)
    writeFileSync(join(candidateRoot, file.path), file.content, {
      mode: 0o600,
    });
  const runParent = join(parent, "first-step-fault");
  mkdirSync(runParent, { recursive: true, mode: 0o700 });
  const result = await validateGeneratedMigration({
    context: bindContext(),
    root,
    parent: runParent,
    headSha,
    candidateRoot,
    candidateSha: source.candidateSha,
    signal: AbortSignal.timeout(REAL_TIMEOUT_MS),
  });
  // The mutation still compiles; the verifier must detect the first HTTP
  // response mismatch as a scored FAIL with complete coverage, not an ERROR.
  assert.equal(result.publicG1, "PASS");
  assert.equal(result.publicG2, "FAIL");
  assert.equal(result.publicG3, "FAIL");
  assert.deepEqual(result.cleanup, CLEAN);
  assert.equal(result.attempts.length, 1);
  const attempt = result.attempts[0];
  assert.equal(attempt.candidateSha, source.candidateSha);
  assert.deepEqual(attempt.coverage, {
    http: 17,
    sqlite: 20,
    requiredHttp: 17,
    requiredSqlite: 20,
  });
  const byGate = Object.fromEntries(attempt.gates.map((g) => [g.gate, g]));
  assert.equal(byGate.G2.verdict, "FAIL");
  assert.ok(byGate.G2.findingCodes.includes("HTTP_STATUS"));
  assert.equal(byGate.G3.verdict, "FAIL");
  assert.ok(byGate.G3.findingCodes.includes("HTTP_STATUS"));
  assert.ok(
    !byGate.G3.findingCodes.some((code) => code.startsWith("DB_")),
    "Status-only mutation must not produce DB findings",
  );
  assert.equal(byGate.G2.executedTestIds.length, 17);
  assert.equal(byGate.G3.executedTestIds.length, 20);
  const finalizer = cleanupReceipt(
    join(parent, "finalizer-first-step-fault"),
    "first-step-fault",
  );
  return {
    id: "first-step-http-fault-real-docker",
    status: "PASS",
    execution: "REAL_DOCKER_SYNTHETIC_FIRST_STEP_FAULT",
    candidateSha: source.candidateSha,
    mutation: "res.statusCode = 503 before first response (mmp-097 pattern)",
    gates: {
      G1: gateView(byGate.G1),
      G2: gateView(byGate.G2),
      G3: gateView(byGate.G3),
    },
    coverage: attempt.coverage,
    pairs: attempt.pairs.length,
    cleanup: result.cleanup,
    finalizer,
  };
}

const baseSnapshot = {
  format: "sqlite-logical-v1",
  schema: [
    {
      type: "table",
      name: "items",
      table: "items",
      sql: "CREATE TABLE items (id INTEGER PRIMARY KEY, value TEXT)",
    },
  ],
  tables: [
    {
      name: "items",
      columns: ["id", "value"],
      primaryKey: [0],
      rows: [
        [
          { type: "integer", value: "1" },
          { type: "text", value: "v" },
        ],
      ],
    },
  ],
};
const okObservation = (status = 200) => ({
  status,
  headers: { "content-type": "application/json" },
  body: Buffer.from('{"ok":true}'),
});
function syntheticAdapter({ onRequest, onClose }) {
  let scenarioIndex = -1;
  return {
    async reset(signal) {
      signal.throwIfAborted();
      scenarioIndex++;
    },
    async request(input, signal) {
      signal.throwIfAborted();
      const observation = onRequest?.(scenarioIndex, input);
      if (observation) return observation;
      return structuredClone(okObservation());
    },
    async snapshot(signal) {
      signal.throwIfAborted();
      return structuredClone(baseSnapshot);
    },
    async close(_signal) {
      onClose?.();
    },
  };
}
async function syntheticControl(id, referenceScript, candidateScript) {
  const artifactParent = join(parent, "synthetic", id);
  mkdirSync(artifactParent, { recursive: true, mode: 0o700 });
  const result = await verifyPair({
    reference: syntheticAdapter(referenceScript ?? {}),
    candidate: syntheticAdapter(candidateScript ?? {}),
    scenarios: MANIFEST,
    artifactParent,
    operationTimeoutMs: 30000,
  });
  assertSealed(result.evidenceDirectory);
  const byGate = Object.fromEntries(
    result.gateResults.map((gate) => [gate.gate, gate]),
  );
  return {
    id,
    G2: gateView(byGate.G2),
    G3: gateView(byGate.G3),
    sealedEvidence: true,
  };
}
async function syntheticCase() {
  // Deterministic offline controls over the unchanged real verifyPair. They
  // demonstrate fail-closed verifier behaviour at the first-step boundary and
  // do NOT attribute the historical paid-run failure, whose cause is UNKNOWN.
  const candidateFault = await syntheticControl(
    "candidate-first-request-failure",
    {},
    {
      onRequest: (scenarioIndex) => {
        if (scenarioIndex === 0) throw Error("SYNTHETIC_CANDIDATE_FAULT");
        return undefined;
      },
    },
  );
  assert.equal(candidateFault.G2.verdict, "ERROR");
  assert.ok(candidateFault.G2.findingCodes.includes("VERIFIER_ERROR"));
  assert.equal(candidateFault.G2.executedCount, 0);
  assert.equal(candidateFault.G3.verdict, "ERROR");
  assert.ok(candidateFault.G3.findingCodes.includes("VERIFIER_ERROR"));
  assert.equal(candidateFault.G3.executedCount, 1);
  assert.equal(candidateFault.G3.executedFirst, "workshop-business:initial");

  const referenceFault = await syntheticControl(
    "reference-first-request-failure",
    {
      onRequest: (scenarioIndex) => {
        if (scenarioIndex === 0) throw Error("SYNTHETIC_REFERENCE_FAULT");
        return undefined;
      },
    },
    {},
  );
  assert.equal(referenceFault.G2.verdict, "ERROR");
  assert.ok(referenceFault.G2.findingCodes.includes("VERIFIER_ERROR"));
  assert.equal(referenceFault.G2.executedCount, 0);
  assert.equal(referenceFault.G3.executedCount, 1);

  const malformed = await syntheticControl(
    "malformed-observation",
    {},
    {
      onRequest: () => ({ status: 99, headers: {}, body: undefined }),
    },
  );
  assert.equal(malformed.G2.verdict, "ERROR");
  assert.ok(malformed.G2.findingCodes.includes("VERIFIER_ERROR"));
  assert.equal(malformed.G2.executedCount, 0);

  const comparatorFault = await syntheticControl(
    "comparator-status-fault",
    {},
    { onRequest: () => structuredClone(okObservation(503)) },
  );
  assert.equal(comparatorFault.G2.verdict, "FAIL");
  assert.ok(comparatorFault.G2.findingCodes.includes("HTTP_STATUS"));
  assert.equal(comparatorFault.G2.executedCount, 17);
  assert.equal(comparatorFault.G3.verdict, "FAIL");
  assert.ok(comparatorFault.G3.findingCodes.includes("HTTP_STATUS"));
  assert.ok(
    !comparatorFault.G3.findingCodes.some((code) => code.startsWith("DB_")),
  );
  assert.equal(comparatorFault.G3.executedCount, 20);

  const teardown = await syntheticControl(
    "worker-teardown-fault",
    {},
    {
      onClose: () => {
        throw Error("SYNTHETIC_TEARDOWN_FAULT");
      },
    },
  );
  assert.equal(teardown.G2.verdict, "ERROR");
  assert.ok(teardown.G2.findingCodes.includes("VERIFIER_ERROR"));
  assert.equal(teardown.G2.executedCount, 17);
  assert.equal(teardown.G3.executedCount, 20);

  return {
    id: "offline-synthetic-first-step-controls",
    status: "PASS",
    execution: "OFFLINE_SYNTHETIC_ADAPTERS_REAL_VERIFYPAIR",
    cases: [
      candidateFault,
      referenceFault,
      malformed,
      comparatorFault,
      teardown,
    ],
    shapeNote:
      "candidate/reference/malformed first-request faults reproduce the historical aggregate shape (0 HTTP executed, initial DB only) as fail-closed ERROR; a scored comparator mismatch yields FAIL with complete coverage; teardown faults surface as ERROR after full execution",
  };
}

const mode = process.argv[2] ?? "all";
const run = {
  format: "mmp108-first-step-proof-v1",
  headSha,
  engine: { version: server.Version, os: server.Os, arch: server.Arch },
  driver: {
    node: process.version,
    platform: process.platform,
    manifestPin: MANIFEST_PIN,
    recipePin: RECIPE_PIN,
    sourcePin: {
      repository: SOURCE.repository,
      commit: SOURCE.commit,
      image: SOURCE.image,
      archiveSha256: SOURCE.archiveSha256,
    },
    candidatePin: WORKSHOP_CANDIDATE_SHA,
  },
  network: { sourceFetches: 0, blockedRequests: 0 },
  cases: [],
  aiGeneration: "AI_GENERATION_NOT_RUN",
  modelRequests: 0,
  product: "NOT_ESTABLISHED",
  status: "PASS",
};
const cases = {
  "known-good": [knownGoodCase],
  "first-step-fault": [firstStepFaultCase],
  synthetic: [syntheticCase],
  all: [knownGoodCase, firstStepFaultCase, syntheticCase],
};
try {
  for (const runCase of cases[mode] ?? []) {
    const receipt = await runCase();
    run.cases.push(receipt);
    save(join(output, `${receipt.id}.json`), receipt);
  }
} catch (error) {
  run.status = "ERROR";
  run.failure = {
    code: error?.code ?? "CASE_FAILED",
    message: String(error?.message ?? error).slice(0, 200),
  };
  process.exitCode = 1;
} finally {
  globalThis.fetch = originalFetch;
  run.network = { sourceFetches, blockedRequests };
  save(join(output, "summary.json"), run);
  const passed = run.cases.filter((c) => c.status === "PASS").length;
  console.log(
    `MMP108 ${run.status} cases=${passed}/${run.cases.length} blockedRequests=${blockedRequests} modelRequests=0 product=NOT_ESTABLISHED`,
  );
}
