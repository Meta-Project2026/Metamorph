// Manual synthetic compiler control. Candidate is compiled ONLY by the pinned,
// network-off worker, through the same fresh-process validator as future trials.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { SOURCE } from "@metamorph/oracle";
import { bindMigrationContext } from "../../packages/agent-real/src/migration-context.mjs";
import { validateGeneratedMigration } from "../../packages/agent-real/src/migration-trial.mjs";
import { atomicJson } from "../../packages/differential/src/private-run.mjs";
import { admitDirectory } from "../../packages/target-worker/src/admission.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const output = process.env.AGENT_PUBLIC_OUTPUT;
assert.ok(output && !process.env.MODEL_API_KEY && process.platform === "linux");
const headSha = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
assert.equal(headSha, process.env.AGENT_HEAD_SHA);
process.umask(0o077);
const parent = mkdtempSync(join(tmpdir(), "mmp082-private-"));
const candidateRoot = join(parent, "candidate");
mkdirSync(join(candidateRoot, "src"), { recursive: true });
// Original synthetic type error, unrelated to the unpublished historical candidate.
writeFileSync(
  join(candidateRoot, "src/main.ts"),
  "export const value: number = 'MMP082_PRIVATE_SOURCE ghp_SYNTHETIC_SECRET';\n",
);
const candidate = await admitDirectory(candidateRoot);
const context = bindMigrationContext(
  readFileSync(join(root, "research/mmp-061/public-source.json"), "utf8"),
);
const shutdown = new AbortController();
const stop = () => shutdown.abort();
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
let result;
let status = "FAIL";
let metaRequests = 0;
const originalFetch = globalThis.fetch;
// Reject every direct host fetch except the exact pinned public source archive.
// This driver never constructs a model provider, authorization or credentials.
globalThis.fetch = (input, ...args) => {
  const url = String(input);
  if (
    url !==
    `https://codeload.github.com/${SOURCE.repository}/tar.gz/${SOURCE.commit}`
  ) {
    metaRequests++;
    throw Error("NETWORK_NOT_ADMITTED");
  }
  return originalFetch(input, ...args);
};
try {
  result = await validateGeneratedMigration({
    context,
    root,
    parent,
    headSha,
    candidateRoot,
    candidateSha: candidate.candidateSha,
    signal: AbortSignal.any([
      shutdown.signal,
      AbortSignal.timeout(10 * 60 * 1000),
    ]),
  });
  assert.equal(result.publicG1, "FAIL");
  assert.equal(result.publicG2, "INCONCLUSIVE");
  assert.equal(result.publicG3, "INCONCLUSIVE");
  assert.equal(result.product, "NOT_ESTABLISHED");
  assert.deepEqual(result.cleanup, {
    status: "VERIFIED_ZERO_RESOURCES",
    containers: 0,
    volumes: 0,
    emergencyRemoved: 0,
  });
  const attempt = result.attempts[0];
  assert.equal(result.attempts.length, 1);
  assert.equal(attempt.pairs.length, 1);
  const diagnostic = attempt.pairs[0].compilerDiagnostics;
  assert.equal(diagnostic.status, "AVAILABLE");
  assert.equal(diagnostic.candidateSha, candidate.candidateSha);
  assert.equal(diagnostic.attemptId, attempt.attemptId);
  assert.equal(diagnostic.g1Verdict, "FAIL");
  assert.deepEqual(diagnostic.entries, [
    {
      phase: "typecheck",
      code: "TS2322",
      path: "src/main.ts",
      line: 1,
      column: 14,
    },
  ]);
  assert.doesNotMatch(
    JSON.stringify(result),
    /MMP082_PRIVATE|ghp_|stdout|stderr|export const|\/work\//,
  );
  assert.equal(metaRequests, 0);
  status = "PASS";
} catch {
  // Never print assertion diffs, compiler messages, source or private pack paths.
  console.error("MMP082_COMPILER_CONTROL_FAILED");
  process.exitCode = 1;
} finally {
  globalThis.fetch = originalFetch;
  process.removeListener("SIGTERM", stop);
  process.removeListener("SIGINT", stop);
  atomicJson(
    join(output, "compiler-control.json"),
    {
      format: "mmp082-offline-compiler-control-v1",
      headSha,
      status,
      execution: "SYNTHETIC_CANDIDATE_REAL_DOCKER",
      metaRequests,
      aiGeneration: "AI_GENERATION_NOT_RUN",
      product: "NOT_ESTABLISHED",
      validation: result ?? null,
    },
    0o644,
  );
}
