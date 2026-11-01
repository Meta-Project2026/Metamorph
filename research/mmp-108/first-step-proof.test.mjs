// MMP-108 negative controls for receipt integrity (review B1) and CLI mode /
// case-count integrity (review B3). Pure helpers are exercised in-process; the
// CLI rejection path is exercised through a fresh child process. No Docker and
// no real case execution is involved in any of these controls.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  expectedCaseCount,
  finalizeRun,
  MODES,
  projectFailure,
} from "./first-step-proof.mjs";

const driver = fileURLToPath(
  new URL("./first-step-proof.mjs", import.meta.url),
);

const canaries = [
  "MMP108_PRIVATE /var/lib/docker/volumes/mmp108-private/_data/known-good",
  "ghp_CANARYTOKEN1234567890abcdef",
  "docker: Error response from daemon: bind source path does not exist",
  "candidate source export const secret = 'internal'",
];

test("modes are exactly the four documented ones with nonzero expected counts", () => {
  assert.deepEqual(
    [...MODES],
    ["known-good", "first-step-fault", "synthetic", "all"],
  );
  for (const mode of MODES)
    assert.ok(
      Number.isInteger(expectedCaseCount(mode)) && expectedCaseCount(mode) > 0,
      `expected count must be nonzero for ${mode}`,
    );
  assert.equal(expectedCaseCount("bogus"), 0);
});

test("B1: public failure projection is a fixed allowlisted code under hostile raw errors", () => {
  for (const message of canaries) {
    const hostile = Object.assign(new Error(message), {
      code: "ghp_CANARY_CODE",
      stack: `stack leak ${message}`,
    });
    const projected = projectFailure(hostile);
    assert.deepEqual(projected, { code: "CASE_FAILED" });
    const publicJson = JSON.stringify(projected);
    for (const canary of canaries)
      assert.ok(!publicJson.includes(canary), `leaked: ${canary}`);
    assert.ok(!publicJson.includes("ghp_CANARY_CODE"));
  }
  // Projection must not read the error at all, even when reading throws.
  const hostile = {
    get message() {
      throw new Error("getter must never be read");
    },
    get code() {
      throw new Error("getter must never be read");
    },
  };
  assert.deepEqual(projectFailure(hostile), { code: "CASE_FAILED" });
  assert.deepEqual(projectFailure(undefined), { code: "CASE_FAILED" });
});

test("B1: a serialized failing run with a canary-laden context leaks nothing", () => {
  const run = {
    format: "mmp108-first-step-proof-v1",
    cases: [],
    failure: projectFailure(
      Object.assign(new Error(canaries.join(" | ")), { code: canaries[1] }),
    ),
  };
  const publicJson = JSON.stringify(finalizeRun(run, "known-good"));
  assert.equal(publicJson.includes("CASE_FAILED"), true);
  for (const canary of canaries)
    assert.ok(!publicJson.includes(canary), `leaked: ${canary}`);
});

test("B3: truncated and zero-case runs are ERROR, never PASS", () => {
  const pass = { status: "PASS", cases: [] };
  assert.equal(finalizeRun(pass, "known-good").status, "ERROR");
  assert.equal(
    finalizeRun(pass, "known-good").failure.code,
    "CASE_COUNT_MISMATCH",
  );
  const partial = {
    status: "PASS",
    cases: [{ status: "PASS", id: "known-good-real-docker-first-step" }],
  };
  const truncatedAll = finalizeRun(partial, "all");
  assert.equal(truncatedAll.status, "ERROR");
  assert.equal(truncatedAll.failure.code, "CASE_COUNT_MISMATCH");
  const overfull = {
    status: "PASS",
    cases: [
      { status: "PASS", id: "a" },
      { status: "PASS", id: "b" },
    ],
  };
  assert.equal(finalizeRun(overfull, "known-good").status, "ERROR");
});

test("B3: exact expected count with every case PASS is required for PASS", () => {
  const complete = (n) => ({
    status: "PASS",
    cases: Array.from({ length: n }, (_, i) => ({
      status: "PASS",
      id: `c${i}`,
    })),
  });
  assert.equal(finalizeRun(complete(1), "known-good").status, "PASS");
  assert.equal(finalizeRun(complete(3), "all").status, "PASS");
  const failing = {
    status: "PASS",
    cases: [{ status: "ERROR", id: "c0" }],
  };
  const rejected = finalizeRun(failing, "known-good");
  assert.equal(rejected.status, "ERROR");
  assert.equal(rejected.failure.code, "CASE_FAILED");
  // An unknown mode can never finalize to PASS.
  assert.equal(finalizeRun(complete(1), "bogus").failure.code, "INVALID_MODE");
});

test("B3: unknown CLI mode exits nonzero before creating any public receipt", () => {
  const output = mkdtempSync(join(tmpdir(), "mmp108-invalid-mode-"));
  const child = spawnSync(process.execPath, [driver, "definitely-not-a-mode"], {
    encoding: "utf8",
    timeout: 30000,
    env: {
      ...process.env,
      // Deliberately absent/pointless harness env: mode rejection must
      // happen before environment assertions and any filesystem side effect.
      MMP108_PUBLIC_OUTPUT: join(output, "must-not-be-created"),
      MMP108_PRIVATE_PARENT: join(output, "private-must-not-be-created"),
    },
  });
  assert.equal(child.status, 2);
  assert.match(child.stderr, /MMP108 INVALID_MODE/);
  assert.ok(!existsSync(join(output, "must-not-be-created")));
  assert.ok(!existsSync(join(output, "private-must-not-be-created")));
});
