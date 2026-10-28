// Trusted static checks only. Never import, compile or execute the PHP/TS apps.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { compareHttp } from "../../packages/oracle/dist/http.js";
import {
  MANIFEST_SHA256,
  SOURCE,
} from "../../packages/oracle/dist/reference/manifest.js";
import { compareSqlite } from "../../packages/oracle/dist/sqlite.js";
import {
  requestPolicy,
  WORKSHOP_PROFILE,
} from "../../packages/target-worker/runtime/profile.mjs";
import {
  sha256,
  validateBundle,
} from "../../packages/target-worker/src/admission.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const directory = join(root, "specs/014-public-validation-triage");
const readJson = (name) =>
  JSON.parse(readFileSync(join(directory, name), "utf8"));
const pins = readJson("pins.json");
const corpus = readJson("cases.public.json");
assert.equal(corpus.designation, "PUBLIC_INDEPENDENT_REPRO");
assert.equal(corpus.cases.length, 14);
const ids = new Set();
let requests = 0;
for (const scenario of corpus.cases) {
  assert.match(scenario.id, /^public-[a-z-]+$/);
  assert(!ids.has(scenario.id));
  ids.add(scenario.id);
  assert(scenario.requests.length > 0 && scenario.requests.length <= 8);
  assert.equal(scenario.expected.length, scenario.requests.length);
  assert(["MATCH", "DIVERGE"].includes(scenario.predictedParity));
  for (const [i, request] of scenario.requests.entries()) {
    assert(
      Object.keys(request).every((k) => ["method", "path", "body"].includes(k)),
    );
    requestPolicy(WORKSHOP_PROFILE, request.method, request.path, request.body);
    for (const side of ["php", "ts"]) {
      const prediction = scenario.expected[i][side];
      assert.equal(typeof prediction.success, "boolean");
      assert(Number.isInteger(prediction.rows) && prediction.rows >= 0);
      assert(
        prediction.sequence === null ||
          /^[1-9][0-9]*$/.test(prediction.sequence),
      );
    }
    requests++;
  }
}

const git = (...args) => execFileSync("git", args, { cwd: root });
assert.equal(SOURCE.archiveSha256, pins.php.archiveSha256);
assert.equal(SOURCE.commit, pins.php.commit);
assert.equal(SOURCE.licenseSha256, pins.php.licenseSha256);
assert.equal(MANIFEST_SHA256, pins.manifestSha256);
const checkoutDifferences = [];
for (const [path, digest] of Object.entries(pins.files)) {
  assert.equal(sha256(git("show", `HEAD:${path}`)), digest, path);
  const actual = sha256(readFileSync(join(root, path)));
  if (actual !== digest)
    checkoutDifferences.push({ path, canonical: digest, actual });
}
const candidate = validateBundle(
  ["src/main.ts", "src/schema.ts"].map((path) => {
    const content = readFileSync(
      join(root, "packages/target-worker/fixtures/workshop", path),
      "utf8",
    );
    return { path, content, sha256: sha256(content) };
  }),
  pins.candidateSha256,
);
const recipe = {};
const checkoutRecipe = {};
for (const name of pins.targetRecipeFiles) {
  const path = `packages/target-worker/runtime/${name}`;
  recipe[name] = sha256(git("show", `HEAD:${path}`));
  checkoutRecipe[name] = sha256(readFileSync(join(root, path)));
}
assert.equal(sha256(JSON.stringify(recipe)), pins.targetRecipeSha256);

// Original public synthetic observations, not sampled or executed app responses.
const http = {
  status: 200,
  headers: { "content-type": "application/json; charset=utf-8" },
  body: Buffer.from('{"success":true,"appointment_id":"1"}'),
};
assert.deepEqual(compareHttp(http, structuredClone(http)), []);
assert.deepEqual(compareHttp(http, { ...http, status: 503 }), [
  { code: "HTTP_STATUS", path: "/status" },
]);
const db = {
  format: "sqlite-logical-v1",
  schema: [
    {
      type: "table",
      name: "sqlite_sequence",
      table: "sqlite_sequence",
      sql: null,
    },
  ],
  tables: [
    {
      name: "sqlite_sequence",
      columns: ["name", "seq"],
      primaryKey: [],
      rows: [
        [
          { type: "text", value: "appointments" },
          { type: "integer", value: "1" },
        ],
      ],
    },
  ],
};
assert.deepEqual(compareSqlite(db, structuredClone(db)), []);
const changed = structuredClone(db);
changed.tables[0].rows[0][1].value = "2";
assert.deepEqual(compareSqlite(db, changed), [
  { code: "DB_STATE", path: "/tables" },
]);

const docker = spawnSync(
  "docker",
  ["version", "--format", "{{.Server.Version}}"],
  {
    timeout: 5000,
    encoding: "utf8",
    windowsHide: true,
  },
);
console.log(
  JSON.stringify(
    {
      designation: corpus.designation,
      headSha: git("rev-parse", "HEAD").toString().trim(),
      baseSha: pins.baseSha,
      scope: "STATIC_POLICY_PINS_AND_SYNTHETIC_CONTROLS_ONLY",
      classification: "NOT_ESTABLISHED",
      casesSha256: sha256(readFileSync(join(directory, "cases.public.json"))),
      cases: corpus.cases.length,
      policyAdmittedRequests: requests,
      plannedHttpComparisons: requests,
      plannedSqliteComparisons: requests + corpus.cases.length,
      executedPhpTsHttpComparisons: 0,
      executedPhpTsSqliteComparisons: 0,
      candidateSha256: candidate.candidateSha,
      canonicalRecipeSha256: pins.targetRecipeSha256,
      checkoutRecipeSha256: sha256(JSON.stringify(checkoutRecipe)),
      checkoutDifferences,
      syntheticControls: [
        { id: "http-equal", status: "PASS" },
        { id: "http-corrupt-status", status: "PASS", detected: "HTTP_STATUS" },
        { id: "db-equal", status: "PASS" },
        { id: "db-corrupt-sequence", status: "PASS", detected: "DB_STATE" },
      ],
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      docker: {
        availability:
          docker.error?.code === "ENOENT"
            ? "EXECUTABLE_ABSENT"
            : docker.status === 0
              ? "AVAILABLE"
              : "UNAVAILABLE",
        publicProbe: "DOCKER_NOT_RUN",
        containers: null,
        volumes: null,
        emergencyRemoved: null,
        cleanup: "NOT_RUN",
      },
    },
    null,
    2,
  ),
);
