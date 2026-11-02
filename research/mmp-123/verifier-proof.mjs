// MMP-123 offline verifier validation of the frozen GLM 5.3 first draft.
// Linux-only, secret-free, no model provider, no repair loop. The candidate is
// admitted read-only from the frozen first-draft directory; candidate TS and
// reference PHP execute exclusively inside the trusted network-off Docker
// workers that the unchanged production verifier provisions. The driver never
// asserts the candidate's outcome in advance: it records whatever the
// unchanged verifier produces, with PASS floating on exactly the expected
// nonzero case count. Raw driver error content never crosses into receipts.
//
// Restriction: this driver reads only research/mmp-123/candidate (the GLM
// draft), public pinned source/context JSON and production harness wiring. It
// never reads target-worker fixtures, Oracle expected data or held-out packs.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { bindMigrationContext } from "../../packages/agent-real/src/migration-context.mjs";
import { validateGeneratedMigration } from "../../packages/agent-real/src/migration-trial.mjs";
import {
  MANIFEST_PIN,
  RECIPE_PIN,
  validateRuntimeRecipe,
} from "../../packages/agent-real/src/runtime.mjs";
import {
  MANIFEST,
  SOURCE,
} from "../../packages/oracle/dist/index.js";
import { admitDirectory } from "../../packages/target-worker/src/admission.mjs";

/** The sealed GLM 5.3 first-draft candidate SHA (research/mmp-123/PROVENANCE.md;
 * re-verified before this task started by an independent admission rerun). */
const CANDIDATE_SHA =
  "4ff450d2ec5fdcdfd855b7a3ed02b9f369488cf55f354372e4dc11dfb9511e72";
const CANDIDATE_ROOT = "research/mmp-123/candidate";
const CANDIDATE_FILE_COUNT = 5;
const MIT_NOTICE = "Copyright (c) 2026 Tanjila Afsari Rubina";

/** Valid CLI modes. Anything else must be rejected before any side effect. */
export const MODES = Object.freeze(["candidate"]);

/** Expected nonzero number of case results per mode; 0 for unknown modes. */
export function expectedCaseCount(mode) {
  return (mode === "candidate" ? 1 : 0);
}

/** Fixed allowlisted public failure projection. The error argument is
 * deliberately unread: raw exception text/code can carry private workspace
 * paths, transport text or candidate-originated data. */
export function projectFailure() {
  return { code: "CASE_FAILED" };
}

/** PASS requires exactly the expected nonzero case count for the mode and all
 * cases PASS. Truncated, zero-case or unknown-mode runs are ERROR. */
export function finalizeRun(run, mode) {
  if (!MODES.includes(mode))
    return { ...run, status: "ERROR", failure: { code: "INVALID_MODE" } };
  if (run.cases.length !== expectedCaseCount(mode))
    return {
      ...run,
      status: "ERROR",
      failure: run.failure ?? { code: "CASE_COUNT_MISMATCH" },
    };
  if (run.cases.some((record) => record.status !== "PASS"))
    return {
      ...run,
      status: "ERROR",
      failure: run.failure ?? { code: "CASE_FAILED" },
    };
  return run;
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) await main();

async function main() {
  const mode = process.argv[2] ?? "candidate";
  if (!MODES.includes(mode)) {
    // Reject before any filesystem side effect, env assertion or receipt.
    console.error("MMP123 INVALID_MODE");
    process.exit(2);
  }
  const root = fileURLToPath(new URL("../../", import.meta.url));
  assert.equal(process.platform, "linux", "Linux-only disposable harness");
  assert.ok(
    !process.env.MODEL_API_KEY &&
      !process.env.GH_TOKEN &&
      !process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN,
    "No credentials may be mapped",
  );
  const parent = resolve(process.env.MMP123_PRIVATE_PARENT ?? "");
  const output = resolve(process.env.MMP123_PUBLIC_OUTPUT ?? "");
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
    const record = JSON.parse(
      readFileSync(join(dir, "finalizer.json"), "utf8"),
    );
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
  const REAL_TIMEOUT_MS = 20 * 60 * 1000;
  const bindContext = () =>
    bindMigrationContext(
      readFileSync(join(root, "research/mmp-061/public-source.json"), "utf8"),
    );
  const CLEAN = {
    status: "VERIFIED_ZERO_RESOURCES",
    containers: 0,
    volumes: 0,
    emergencyRemoved: 0,
  };

  async function candidateCase() {
    // Admission runs against the frozen first-draft directory as deposited by
    // the sealed commit: any byte change or layout drift fails closed here.
    const bundle = await admitDirectory(
      join(root, CANDIDATE_ROOT),
      CANDIDATE_SHA,
    );
    assert.equal(bundle.candidateSha, CANDIDATE_SHA);
    assert.equal(bundle.files.length, CANDIDATE_FILE_COUNT);
    for (const file of bundle.files)
      assert.ok(
        file.content.includes(MIT_NOTICE),
        `MIT notice missing in ${file.path}`,
      );
    const runParent = join(parent, "candidate");
    mkdirSync(runParent, { recursive: true, mode: 0o700 });
    const result = await validateGeneratedMigration({
      context: bindContext(),
      root,
      parent: runParent,
      headSha,
      candidateRoot: join(root, CANDIDATE_ROOT),
      candidateSha: bundle.candidateSha,
      signal: AbortSignal.timeout(REAL_TIMEOUT_MS),
    });
    // No outcome is asserted in advance. Only the public projection is
    // recorded below; the driver never labels a candidate without the
    // unchanged verifier's own verdicts.
    assert.doesNotMatch(
      JSON.stringify(result),
      /MMP123_PRIVATE|MMP108_PRIVATE|ghp_|stdout|stderr/,
    );
    assert.equal(result.attempts.length, 1);
    const attempt = result.attempts[0];
    assert.equal(attempt.candidateSha, CANDIDATE_SHA);
    assert.deepEqual(
      attempt.pairs.map((pair) => pair.scenarioId),
      MANIFEST.map((scenario) => scenario.id),
    );
    for (const pair of attempt.pairs) {
      assert.equal(pair.cleanup, "VERIFIED_ZERO_RESOURCES");
      assert.ok(pair.packs.length >= 1);
      for (const pack of pair.packs)
        assert.match(pack.sha256, /^[a-f0-9]{64}$/);
    }
    const byGate = Object.fromEntries(attempt.gates.map((g) => [g.gate, g]));
    assert.equal(byGate.G4.verdict, "INCONCLUSIVE");
    assert.ok(byGate.G4.findingCodes.includes("HELD_OUT_NOT_RUN"));
    assert.equal(result.product, "NOT_ESTABLISHED");
    const finalizer = cleanupReceipt(
      join(parent, "finalizer-candidate"),
      "candidate",
    );
    return {
      id: "glm-first-draft-real-docker-validation",
      status: "PASS",
      execution: "REAL_DOCKER_UNCHANGED_VERIFIER_GLM_FIRST_DRAFT",
      candidateSha: bundle.candidateSha,
      candidateFiles: bundle.files.map((file) => ({
        path: file.path,
        bytes: Buffer.byteLength(file.content),
        sha256: file.sha256,
      })),
      gates: {
        G1: gateView(byGate.G1),
        G2: gateView(byGate.G2),
        G3: gateView(byGate.G3),
        G4: gateView(byGate.G4),
      },
      coverage: attempt.coverage,
      pairs: attempt.pairs.length,
      cleanup: result.cleanup,
      blockers: result.blockers,
      aiGeneration: "AI_GENERATION_NOT_RUN",
      product: "NOT_ESTABLISHED",
      finalizer,
      licenceNotice: "MIT notice verified in every generated file",
    };
  }

  const run = {
    format: "mmp123-verifier-proof-v1",
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
      candidatePin: CANDIDATE_SHA,
    },
    network: { sourceFetches: 0, blockedRequests: 0 },
    cases: [],
    aiGeneration: "AI_GENERATION_NOT_RUN",
    modelRequests: 0,
    product: "NOT_ESTABLISHED",
    status: "PASS",
  };
  const cases = {
    candidate: [candidateCase],
  };
  try {
    for (const runCase of cases[mode]) {
      const receipt = await runCase();
      run.cases.push(receipt);
      save(join(output, `${receipt.id}.json`), receipt);
    }
  } catch {
    // Fixed categorical projection only; the thrown error is never read.
    run.status = "ERROR";
    run.failure = projectFailure();
    process.exitCode = 1;
  } finally {
    globalThis.fetch = originalFetch;
    run.network = { sourceFetches, blockedRequests };
    const finalized = finalizeRun(run, mode);
    save(join(output, "summary.json"), finalized);
    const passed = finalized.cases.filter((c) => c.status === "PASS").length;
    console.log(
      `MMP123 ${finalized.status} cases=${passed}/${expectedCaseCount(mode)} blockedRequests=${blockedRequests} modelRequests=0 product=NOT_ESTABLISHED`,
    );
    if (finalized.status !== "PASS") process.exitCode = 1;
  }
}
