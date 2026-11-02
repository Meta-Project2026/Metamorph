// Read-only research audit. Candidate/receipt bytes are data; nothing is imported
// from candidate code, production workers, Docker, providers or private evidence.
import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readdirSync,
  readSync,
  realpathSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const REPAIR_DIR =
  "research/mmp-123/evidence/local-79440b8d-mmp123-20261102T014652Z-cac1410a17b1";
const DRAFT_DIR =
  "research/mmp-123/evidence/local-a8cf79dd-mmp123-20261102T013108Z-bc21b08702a2";
const CONTROL_DIR = "research/mmp-108/evidence/local-f9a7b44";
export const RECORDS = Object.freeze({
  meta: "research/mmp-104/incident.json",
  draft: `${DRAFT_DIR}/glm-first-draft-real-docker-validation.json`,
  draftRun: `${DRAFT_DIR}/summary.json`,
  repair: `${REPAIR_DIR}/glm-first-draft-with-sol-repair-real-docker-validation.json`,
  repairRun: `${REPAIR_DIR}/summary.json`,
  knownGood: `${CONTROL_DIR}/known-good-real-docker-first-step.json`,
  statusMutant: `${CONTROL_DIR}/first-step-http-fault-real-docker.json`,
  synthetic: `${CONTROL_DIR}/offline-synthetic-first-step-controls.json`,
  controlRun: `${CONTROL_DIR}/summary.json`,
});
export const CANDIDATE_FILES = Object.freeze([
  "api.ts",
  "config.ts",
  "json.ts",
  "main.ts",
  "phpcompat.ts",
]);
export const RECIPE_FILES = Object.freeze(
  [
    "Dockerfile",
    "build.mjs",
    "clock.mjs",
    "inspect.mjs",
    "launch.mjs",
    "package-lock.json",
    "package.json",
    "profile.mjs",
    "provenance.mjs",
    "quota.mjs",
    "sqlite-value.mjs",
    "unit-smoke.mjs",
  ].sort(),
);
export const INPUTS = Object.freeze(
  [
    ...Object.values(RECORDS),
    ...["candidate", "repair-candidate"].flatMap((dir) =>
      CANDIDATE_FILES.map((file) => `research/mmp-123/${dir}/src/${file}`),
    ),
    ...RECIPE_FILES.map((file) => `packages/target-worker/runtime/${file}`),
    "research/mmp-061/public-source.json",
    "research/mmp-061/inventory.json",
    "research/mmp-123/verifier-proof.mjs",
    "research/mmp-123/harness/run-host.sh",
    "research/mmp-123/harness/run-inner.sh",
    "research/mmp-123/harness/Dockerfile",
    "packages/oracle/src/runner.ts",
    "packages/oracle/src/failure-telemetry.ts",
    "packages/oracle/src/reference/worker.ts",
    "packages/oracle/src/reference/docker.ts",
    "packages/agent-real/src/runtime.mjs",
    "packages/agent-real/src/report.mjs",
    "packages/agent-real/src/migration-context.mjs",
    "packages/differential/src/target-adapter.mjs",
    "packages/target-worker/src/admission.mjs",
    "packages/target-worker/src/controller.mjs",
  ].sort(),
);
const EXPECTED = Object.freeze({
  source: "d272170d0aecbd28eb5b13e272d9dd11d545b66c",
  archive: "32ef29fd0a13c4184785d74228bd8e300ae507cb8a4a60adfa48215c2e43eae4",
  manifest: "d800a9a5e874545040438d4dce822da6e0d6b71fb094bcac7f06a6ad05610fd4",
  recipe: "f09b12fecd221cb720188266fbb004958e6112eb77e308bf113d15436649dab3",
  draft: "4ff450d2ec5fdcdfd855b7a3ed02b9f369488cf55f354372e4dc11dfb9511e72",
  repair: "0cf5ba0bb22fd1d335b3d061b0a9b258d7ac660f3038e1e651ddaad1262d03c1",
  draftHead: "a8cf79ddef1329b882c3277ff11c890047c64560",
  repairHead: "79440b8dd85b28936e1818c8ce79b35ddbd38fcf",
});
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const requireAudit = (ok) => {
  if (!ok) throw new Error("MMP125_AUDIT_REJECTED");
};
function bytesAt(root, path) {
  const filename = join(root, path),
    before = lstatSync(filename);
  requireAudit(
    before.isFile() &&
      !before.isSymbolicLink() &&
      before.nlink === 1 &&
      before.size <= 256 * 1024,
  );
  const fd = openSync(
    filename,
    constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
  );
  try {
    const opened = fstatSync(fd),
      buffer = Buffer.alloc(256 * 1024 + 1);
    let size = 0,
      count;
    do {
      count = readSync(fd, buffer, size, buffer.length - size, size);
      size += count;
    } while (count && size < buffer.length);
    const end = fstatSync(fd),
      after = lstatSync(filename);
    requireAudit(
      size === before.size &&
        size <= 256 * 1024 &&
        [opened, end, after].every(
          (s) =>
            s.isFile() &&
            s.nlink === 1 &&
            s.ino === before.ino &&
            s.dev === before.dev &&
            s.size === before.size &&
            s.mtimeMs === before.mtimeMs &&
            s.ctimeMs === before.ctimeMs,
        ),
    );
    return buffer.subarray(0, size);
  } finally {
    closeSync(fd);
  }
}
const decode = (bytes) =>
  new TextDecoder("utf-8", { fatal: true }).decode(bytes);
export function sameBoundaryShape(record) {
  const { G2: g2, G3: g3 } = record.gates;
  return (
    g2.verdict === "ERROR" &&
    g3.verdict === "ERROR" &&
    JSON.stringify(g2.findingCodes) === '["VERIFIER_ERROR"]' &&
    JSON.stringify(g3.findingCodes) === '["VERIFIER_ERROR"]' &&
    g2.executedCount === 0 &&
    g2.executedFirst === null &&
    g2.executedLast === null &&
    g3.executedCount === 1 &&
    g3.executedFirst === "workshop-business:initial" &&
    g3.executedLast === "workshop-business:initial" &&
    record.coverage.http === 0 &&
    record.coverage.sqlite === 1 &&
    record.coverage.requiredHttp === 17 &&
    record.coverage.requiredSqlite === 20
  );
}
function summary(record) {
  return Object.fromEntries(
    ["G1", "G2", "G3"].map((gate) => [
      gate,
      {
        verdict: record.gates[gate].verdict,
        executed: record.gates[gate].executedCount,
      },
    ]),
  );
}
export function audit(root = ROOT) {
  const pins = JSON.parse(decode(bytesAt(root, "research/mmp-125/pins.json")));
  requireAudit(
    pins.format === "mmp125-read-only-pins-v1" &&
      pins.baseSha === "074af751e9012abad1be2749c360c5d8b86218e0" &&
      JSON.stringify(Object.keys(pins.files).sort()) === JSON.stringify(INPUTS),
  );
  const data = new Map(
    INPUTS.map((path) => {
      const bytes = bytesAt(root, path),
        pin = pins.files[path];
      requireAudit(bytes.length === pin.bytes && sha(bytes) === pin.sha256);
      return [path, bytes];
    }),
  );
  const records = Object.fromEntries(
    Object.entries(RECORDS).map(([key, path]) => [
      key,
      JSON.parse(decode(data.get(path))),
    ]),
  );
  const source = JSON.parse(
    decode(data.get("research/mmp-061/public-source.json")),
  );
  requireAudit(
    source.sourceCommit === EXPECTED.source &&
      source.archiveSha256 === EXPECTED.archive,
  );
  for (const [kind, dir] of [
    ["draft", "candidate"],
    ["repair", "repair-candidate"],
  ]) {
    const run = records[`${kind}Run`],
      record = records[kind];
    requireAudit(
      run.headSha === EXPECTED[`${kind}Head`] &&
        run.status === "PASS" &&
        run.cases.length === 1 &&
        JSON.stringify(run.cases[0]) === JSON.stringify(record) &&
        run.driver.candidatePin === EXPECTED[kind] &&
        record.candidateSha === EXPECTED[kind] &&
        run.driver.sourcePin.commit === EXPECTED.source &&
        run.driver.sourcePin.archiveSha256 === EXPECTED.archive &&
        run.driver.manifestPin === EXPECTED.manifest &&
        run.driver.recipePin === EXPECTED.recipe &&
        record.product === "NOT_ESTABLISHED" &&
        record.gates.G4.findingCodes.includes("HELD_OUT_NOT_RUN"),
    );
    requireAudit(
      JSON.stringify(
        readdirSync(join(root, `research/mmp-123/${dir}/src`)).sort(),
      ) === JSON.stringify(CANDIDATE_FILES),
    );
    const candidateRoot = join(root, `research/mmp-123/${dir}`);
    for (const directory of [candidateRoot, join(candidateRoot, "src")]) {
      const info = lstatSync(directory);
      requireAudit(
        info.isDirectory() &&
          !info.isSymbolicLink() &&
          realpathSync(directory) === resolve(directory),
      );
    }
    requireAudit(
      JSON.stringify(readdirSync(candidateRoot).sort()) === '["src"]',
    );
    const files = CANDIDATE_FILES.map((name) => {
      const bytes = data.get(`research/mmp-123/${dir}/src/${name}`),
        content = decode(bytes),
        path = `src/${name}`;
      requireAudit(content.includes(source.license.trim()));
      return { path, sha256: sha(bytes), content };
    });
    requireAudit(sha(JSON.stringify(files)) === EXPECTED[kind]);
    requireAudit(
      JSON.stringify(
        files.map((f) => ({
          path: f.path,
          bytes: Buffer.byteLength(f.content),
          sha256: f.sha256,
        })),
      ) === JSON.stringify(record.candidateFiles),
    );
  }
  requireAudit(
    JSON.stringify(
      readdirSync(join(root, "packages/target-worker/runtime"))
        .filter(
          (name) =>
            /\.mjs$/.test(name) ||
            ["Dockerfile", "package.json", "package-lock.json"].includes(name),
        )
        .sort(),
    ) === JSON.stringify(RECIPE_FILES),
  );
  const recipe = Object.fromEntries(
    RECIPE_FILES.map((name) => [
      name,
      sha(data.get(`packages/target-worker/runtime/${name}`)),
    ]),
  );
  requireAudit(sha(JSON.stringify(recipe)) === EXPECTED.recipe);
  for (const run of [records.controlRun, records.draftRun, records.repairRun]) {
    requireAudit(
      run.driver.recipePin === EXPECTED.recipe &&
        run.driver.manifestPin === EXPECTED.manifest &&
        JSON.stringify(run.driver.sourcePin) ===
          JSON.stringify(records.repairRun.driver.sourcePin),
    );
  }
  const meta = records.meta;
  requireAudit(
    meta.runId === "41327197036" &&
      meta.headSha === "d199510fd802693d4af852bd5ed8498b5461d185" &&
      meta.sourceSha === EXPECTED.source &&
      meta.sourceArchiveSha256 === EXPECTED.archive &&
      meta.manifestSha256 === EXPECTED.manifest,
  );
  const metaView = {
    gates: Object.fromEntries(
      meta.gates.map((g) => [
        g.gate,
        {
          ...g,
          executedCount: g.executedTestIds.length,
          executedFirst: g.executedTestIds[0] ?? null,
          executedLast: g.executedTestIds.at(-1) ?? null,
        },
      ]),
    ),
    coverage: meta.coverage,
  };
  requireAudit(
    sameBoundaryShape(metaView) && sameBoundaryShape(records.repair),
  );
  const ambiguous = records.synthetic.cases.filter((c) =>
    sameBoundaryShape({
      gates: { G2: c.G2, G3: c.G3 },
      coverage: meta.coverage,
    }),
  );
  requireAudit(
    JSON.stringify(ambiguous.map((c) => c.id)) ===
      JSON.stringify([
        "candidate-first-request-failure",
        "reference-first-request-failure",
        "malformed-observation",
      ]),
  );
  return {
    format: "mmp125-correlation-v1",
    status: "AUDIT_COMPLETE_CAUSE_UNRESOLVED",
    baseSha: pins.baseSha,
    pinnedInputs: INPUTS.length,
    evidenceKind: "EXISTING_PUBLIC_RECORDS_AND_STATIC_CODE_ONLY",
    sourcePin: EXPECTED.source,
    manifestPin: EXPECTED.manifest,
    recomputedRecipePin: EXPECTED.recipe,
    candidates: {
      draft: EXPECTED.draft,
      repair: EXPECTED.repair,
      meta: meta.candidateSha256,
    },
    profiles: {
      meta: summary(metaView),
      draft: summary(records.draft),
      repair: summary(records.repair),
      knownGood: summary(records.knownGood),
      statusMutant: summary(records.statusMutant),
    },
    correlation: "SAME_PUBLIC_ERROR_SHAPE_NOT_SAME_CAUSE",
    nonUniqueSyntheticControls: ambiguous.map((c) => c.id),
    interval: "AFTER_INITIAL_DB_BEFORE_FIRST_HTTP_COMPARISON_COMPLETES",
    failedSide: "UNKNOWN",
    errorClass: "UNKNOWN",
    rootCause: "UNKNOWN",
    privateEvidence: "OWNER_REPORTED_NOT_RETAINED",
    privateEvidenceRead: "NOT_RUN",
    modelProvenance:
      "GLM_DRAFT_AND_OPENCODE_REPORTED_GLM_FLASH_FREE_REPAIR_NOT_SOL_ATTESTED",
    newDockerRuns: 0,
    newModelRequests: 0,
    newArtifactUploads: 0,
    diagnostic: "PROPOSED_REQUIRES_OWNER_CONSENT",
    formalG4: "NOT_RUN",
    product: "NOT_ESTABLISHED",
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    requireAudit(process.argv.length === 2);
    console.log(JSON.stringify(audit(), null, 2));
  } catch {
    console.log(
      JSON.stringify({
        format: "mmp125-correlation-v1",
        status: "AUDIT_REJECTED",
        rootCause: "UNKNOWN",
      }),
    );
    process.exitCode = 2;
  }
}
