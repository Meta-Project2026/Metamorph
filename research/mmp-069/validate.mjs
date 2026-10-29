// Fail-closed validator for research/mmp-069/coverage-matrix.json
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const matrixPath = join(import.meta.dirname, "coverage-matrix.json");
const raw = readFileSync(matrixPath, "utf8");
const matrix = JSON.parse(raw);

// 1. Contract & top-level structure
assert.equal(matrix.contract, "MMP-069", "Invalid contract in coverage matrix");
assert.ok(matrix.version, "Missing version");
assert.ok(matrix.baseSha, "Missing baseSha");
assert.ok(Array.isArray(matrix.packages), "packages must be an array");
assert.ok(
  Array.isArray(matrix.researchHarnesses),
  "researchHarnesses must be an array",
);
assert.ok(
  matrix.specialCoverageCategories,
  "specialCoverageCategories required",
);

// 2. All 11 workspace packages must be present
const expectedPackages = [
  "metamorph",
  "@metamorph/server",
  "@metamorph/contracts",
  "@metamorph/agent",
  "@metamorph/agent-real",
  "@metamorph/differential",
  "@metamorph/evidence-retention",
  "@metamorph/integration",
  "@metamorph/oracle",
  "@metamorph/target-worker",
  "@metamorph/workshop-audit",
];

const packageNames = matrix.packages.map((p) => p.name);
for (const expected of expectedPackages) {
  assert.ok(
    packageNames.includes(expected),
    `Missing required package in matrix: ${expected}`,
  );
}
assert.equal(
  matrix.packages.length,
  11,
  `Expected exactly 11 packages, got ${matrix.packages.length}`,
);

// 3. Validate package fields
for (const pkg of matrix.packages) {
  assert.ok(pkg.name, "Package must have name");
  assert.ok(pkg.path !== undefined, `Package ${pkg.name} must have path`);
  assert.ok(pkg.commands, `Package ${pkg.name} must have commands object`);
  assert.equal(
    typeof pkg.fastCi,
    "boolean",
    `Package ${pkg.name} fastCi must be boolean`,
  );
  assert.ok(pkg.status, `Package ${pkg.name} must have status`);
}

// 4. Special categories validation
const spec = matrix.specialCoverageCategories;
assert.ok(spec, "specialCoverageCategories missing");

// 4A. Workshop audit: 54 tests
assert.ok(spec.workshopAudit, "workshopAudit category missing");
assert.equal(
  spec.workshopAudit.testCounts.total,
  54,
  "workshopAudit total tests must be 54",
);
assert.equal(
  spec.workshopAudit.fastCiIncluded,
  true,
  "workshopAudit must be fastCiIncluded",
);
assert.equal(
  spec.workshopAudit.negativeControl.verified,
  true,
  "negativeControl must be verified",
);

// 4B. MMP-063 connected: 21 tests
assert.ok(spec.mmp063Connected, "mmp063Connected category missing");
assert.equal(
  spec.mmp063Connected.testCount,
  21,
  "mmp063Connected testCount must be 21",
);
assert.equal(
  spec.mmp063Connected.fastCiIncluded,
  false,
  "mmp063Connected must be fastCiIncluded=false",
);

// 4C. Privileged skips: 3 skips
assert.ok(
  Array.isArray(spec.privilegedSkips),
  "privilegedSkips must be an array",
);
assert.equal(
  spec.privilegedSkips.length,
  3,
  "privilegedSkips must have exactly 3 entries",
);

// 4D. Demo readiness: 50 tests
assert.ok(spec.demoReadiness, "demoReadiness category missing");
assert.equal(
  spec.demoReadiness.testCount,
  50,
  "demoReadiness testCount must be 50",
);
assert.equal(
  spec.demoReadiness.fastCiLintIncluded,
  true,
  "demoReadiness fastCiLintIncluded must be true",
);

console.log(
  `[mmp-069-validate] Coverage matrix validated successfully: ${matrix.packages.length} packages, 54 workshop-audit tests, 21 #63 tests, 3 privileged skips, 50 demo tests.`,
);
