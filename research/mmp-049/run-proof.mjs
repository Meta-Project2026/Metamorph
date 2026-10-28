// Trusted manual proof. Candidate/reference applications execute ONLY in Docker.
import assert from "node:assert/strict";
import { chmodSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  WORKSHOP_CONTROL_IDS,
  workshopControls,
} from "../../packages/differential/src/workshop-controls.mjs";
import { PrivateEvidence } from "../../packages/oracle/dist/reference/evidence.js";
import {
  MANIFEST,
  MANIFEST_SHA256,
  SOURCE,
} from "../../packages/oracle/dist/reference/manifest.js";
import {
  admitDirectory,
  sha256,
} from "../../packages/target-worker/src/admission.mjs";
import { requireSuccess } from "../../packages/target-worker/src/controller.mjs";
import { git, verifyPins } from "../mmp-044/config.mjs";
import { blankCase, runCase } from "../mmp-044/driver.mjs";
import { atomic, finalize } from "../mmp-044/finalize.mjs";
import { createRuntime } from "./environment.mjs";
import { inputMatrix } from "./inputs.mjs";
import { regressions } from "./scenarios.mjs";
import { validateGroup } from "./validation.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const parent = process.env.MMP049_PROOF_PARENT;
const output = process.env.MMP049_OUTPUT;
const headSha = git("rev-parse", "HEAD").toString().trim();
const abort = new AbortController();
const stop = () => abort.abort();
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
const timer = setTimeout(stop, 27 * 60 * 1000);
const signal = abort.signal;
process.umask(0o077);
mkdirSync(parent, { mode: 0o700 });
chmodSync(parent, 0o700);
mkdirSync(output, { recursive: true });
const summary = {
  format: "mmp049-candidate-proof-v1",
  headSha,
  harness: "ERROR",
  parity: "INCONCLUSIVE",
  candidate: null,
  source: SOURCE,
  manifestSha256: MANIFEST_SHA256,
  groups: [],
  controls: [],
  candidateOperators: { status: "NOT_RUN" },
  runtime: null,
  gates: {
    G0: "INCONCLUSIVE",
    G1: "NOT_RUN",
    G2: "INCONCLUSIVE",
    G3: "INCONCLUSIVE",
    G4: "INCONCLUSIVE",
  },
  product: "NOT_ESTABLISHED",
  ai: "AI_GENERATION_NOT_RUN",
  privateAudit: "UNCHANGED; CAUSE_NOT_ESTABLISHED",
  independentReview: "PENDING",
  errorCode: null,
};
let runtime;
let evidence;
const history = { normalCleanupError: false, emergencyRemoved: 0 };
try {
  assert.equal(process.platform, "linux");
  assert.equal(process.arch, "x64");
  assert.equal(headSha, process.env.MMP049_HEAD_SHA);
  assert.match(headSha, /^[a-f0-9]{40}$/);
  git("diff", "--exit-code", "HEAD");
  const { pins, corpus } = verifyPins();
  const candidate = JSON.parse(
    readFileSync(join(root, "specs/016-candidate-compat/candidate.json")),
  );
  const bundle = await admitDirectory(
    join(root, candidate.path),
    candidate.candidateSha256,
  );
  const original = await admitDirectory(
    join(root, candidate.baselinePath),
    pins.candidateSha256,
  );
  assert.equal(candidate.baselineSha256, original.candidateSha);
  assert.notEqual(bundle.candidateSha, original.candidateSha);
  assert.equal(
    bundle.files.find((f) => f.path === "src/schema.ts").content,
    original.files.find((f) => f.path === "src/schema.ts").content,
  );
  summary.candidate = candidate;
  summary.corpusSha256 = sha256(
    readFileSync(
      join(root, "specs/014-public-validation-triage/cases.public.json"),
    ),
  );
  evidence = new PrivateEvidence(parent, root, {
    headSha,
    candidateSha: bundle.candidateSha,
    scope: "PUBLIC_COMPATIBILITY_ONLY",
  });
  runtime = createRuntime(root, parent, evidence);
  await runtime.prepare(signal, pins.targetRecipeSha256);
  summary.runtime = {
    phpImageId: runtime.php.imageId,
    sourceSha256: runtime.php.sourceSha256,
    targetImageId: runtime.target.imageId,
    provenance: runtime.target.provenance,
  };
  const reference = JSON.parse(readFileSync(join(output, "semantics.json")));
  assert.equal(reference.headSha, headSha);
  assert.equal(reference.status, "PASS");
  assert.deepEqual(reference.inputMatrix, inputMatrix);
  const pair = runtime.pair(bundle);
  let operatorCleanup = false;
  try {
    await pair.target.provision(signal);
    const program = String.raw`import {phpInt,phonePattern,enginePattern} from '/work/out/compat.js';let b='';for await(const c of process.stdin)b+=c;const m=JSON.parse(b);const trim=s=>{const c=' \t\n\r\0\v';let a=0,z=s.length;while(a<z&&c.includes(s[a]))a++;while(z>a&&c.includes(s[z-1]))z--;return s.slice(a,z)};console.log(JSON.stringify({integers:m.integers.map(s=>({input:s,cast:String(phpInt(s))})),whitespace:m.whitespace.map(([id,s])=>({id,phone:phonePattern.test(trim('+1555'+s+'440001')),engine:enginePattern.test(trim('ENG'+s+'049A')),edgePhone:phonePattern.test(trim(s+'+1555440001'+s))}))}));`;
    const measured = requireSuccess(
      await pair.target.cmd(
        [
          "exec",
          "--interactive",
          pair.target.runtime.name,
          "node",
          "--input-type=module",
          "-e",
          program,
        ],
        { input: JSON.stringify(inputMatrix), signal },
      ),
    );
    const actual = JSON.parse(measured.stdout);
    assert.deepEqual(actual.integers, reference.measurements.php.integers);
    assert.deepEqual(actual.whitespace, reference.measurements.php.whitespace);
    summary.candidateOperators = {
      status: "PASS",
      integerCases: actual.integers.length,
      whitespaceCases: actual.whitespace.length,
      integerResults: actual.integers,
      whitespaceResults: actual.whitespace,
      candidateSha256: bundle.candidateSha,
      artifactSha256: pair.target.evidence.artifactSha,
    };
  } finally {
    await pair.target.close();
    operatorCleanup = pair.cleanupVerified();
    history.normalCleanupError ||= !operatorCleanup;
    atomic(join(parent, "cleanup-history.json"), history);
    runtime.record("operator-worker", pair.target.evidence);
  }
  assert.ok(operatorCleanup);
  summary.controls = await workshopControls(
    runtime.target,
    runtime.resources,
    runtime.record,
    signal,
  );
  assert.deepEqual(
    summary.controls.map((c) => c.id),
    [...WORKSHOP_CONTROL_IDS],
  );
  for (const [name, scenarios] of [
    ["original-manifest", MANIFEST],
    ["unchanged-mmp044", corpus.cases],
    ["additional-public-regressions", regressions],
  ]) {
    const receipts = [];
    summary.groups.push({
      name,
      result: { status: "NOT_RUN" },
      cases: receipts,
    });
    let stopped = false;
    for (const scenario of scenarios) {
      if (stopped || signal.aborted) {
        receipts.push(blankCase(scenario));
        continue;
      }
      await admitDirectory(join(root, candidate.path), bundle.candidateSha);
      const receipt = await runCase(
        scenario,
        runtime.pair(bundle),
        signal,
        (kind, value) => runtime.record(`${scenario.id}-${kind}`, value),
      );
      receipts.push(receipt);
      history.normalCleanupError ||=
        receipt.normalCleanup !== "PASS" ||
        receipt.errorCode === "CLEANUP_ERROR" ||
        receipt.emergencyRemoved > 0;
      history.emergencyRemoved += receipt.emergencyRemoved;
      atomic(join(parent, "cleanup-history.json"), history);
      await admitDirectory(join(root, candidate.path), bundle.candidateSha);
      stopped = receipt.status === "ERROR";
      console.log(
        `${name}/${scenario.id}: ${receipt.status}; HTTP=${receipt.executedHttp}, SQLite=${receipt.executedSqlite}`,
      );
    }
    summary.groups.at(-1).result = validateGroup(scenarios, receipts);
  }
  const publicPositive = summary.groups[1].cases.find(
    (r) => r.scenarioId === "public-good-lifecycle",
  );
  assert.equal(publicPositive.negativeControl.status, "PASS");
  summary.httpControls = {
    positive: publicPositive.status,
    negative: publicPositive.negativeControl,
  };
  summary.harness = "SUCCESS";
  summary.parity = summary.groups.some((g) => g.result.status === "FAIL")
    ? "FAIL"
    : "PASS";
  Object.assign(summary.gates, {
    G1: "PASS",
    G2: summary.groups.some((g) =>
      g.cases.some((r) => r.steps.some((s) => s.http.status === "FAIL")),
    )
      ? "FAIL"
      : "PASS",
    G3: summary.groups.some((g) =>
      g.cases.some((r) => r.steps.some((s) => s.db.status === "FAIL")),
    )
      ? "FAIL"
      : "PASS",
  });
} catch (error) {
  summary.errorCode = signal.aborted ? "CANCELLED" : "PROOF_CHECK_FAILED";
  // Only our explicitly public scenario IDs/assertions go to this workflow log.
  console.error(error);
} finally {
  clearTimeout(timer);
  process.removeListener("SIGTERM", stop);
  process.removeListener("SIGINT", stop);
  try {
    summary.cleanup = await finalize(parent, runtime?.record);
    if (evidence) summary.privatePackSha256 = evidence.seal();
  } catch {
    summary.cleanup = { status: "ERROR", inventory: null };
  }
  if (summary.cleanup.status !== "PASS") {
    summary.harness = "ERROR";
    summary.parity = "INCONCLUSIVE";
    summary.errorCode = "CLEANUP_ERROR";
  }
  atomic(join(output, "summary.json"), summary);
}
assert.equal(summary.harness, "SUCCESS");
assert.equal(summary.parity, "PASS");
