// Original synthetic fixture only; not model or historical candidate evidence.
import { randomUUID } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sha256, validateBundle } from "../../packages/target-worker/src/admission.mjs";
import { sandboxArgs } from "../../packages/target-worker/src/controller.mjs";
import { DIAGNOSTIC_POLICY } from "../../packages/agent-real/src/private-diagnostics.mjs";

export function syntheticFixture() {
  const expected = { runId: "890001", runAttempt: "1", headSha: "a".repeat(40) };
  const content = "export const value: number = 'MMP089_PRIVATE_SOURCE';\n";
  const source = validateBundle([{ path: "src/main.ts", content, sha256: sha256(content) }]);
  const identity = { ...expected, sourceSha: DIAGNOSTIC_POLICY.sourceSha, candidateSha: source.candidateSha, attemptId: randomUUID(), pairId: randomUUID(), scenarioId: "workshop-business" };
  const runId = `mmp007-${randomUUID()}`;
  const imageId = `sha256:${"b".repeat(64)}`;
  const checks = [{ phase: "typecheck", exitCode: 2, signal: null, error: null, stdout: "src/main.ts(1,14): error TS2322: MMP089_PRIVATE_DIAGNOSTIC\n", stderr: "" }];
  const runtime = new URL("../../packages/target-worker/runtime/", import.meta.url);
  // Git's Linux recipe bytes use LF; Windows may check these trusted fixtures
  // out with core.autocrlf. This normalization is for this unit fixture only.
  const hashes = Object.fromEntries(readdirSync(runtime).filter((name) => /\.mjs$/.test(name) || ["Dockerfile", "package.json", "package-lock.json"].includes(name)).sort().map((name) => [name, sha256(readFileSync(new URL(name, runtime), "utf8").replaceAll("\r\n", "\n"))]));
  const completion = { workerEvidence: { runId, candidateSha: source.candidateSha, imageId, operationError: "BUILD_FAILED", provenance: { imageId, recipeSha: DIAGNOSTIC_POLICY.recipeSha, hashes, measured: { node: "v24.11.0", typescript: "5.9.3", sqlite: "3.50.4", faketime: "0.9.10-2.1", clockPolicy: "libfaketime-real-monotonic-v1", hashes } }, cleanupVerified: true, build: { args: ["run", "--interactive", ...sandboxArgs(`${runId}-build`), imageId, "node", "/opt/worker/build.mjs"], exitCode: 2, signal: null, spawnError: null, timedOut: false, cancelled: false, overflow: false, elapsedMs: 15, stdout: JSON.stringify({ checks, artifacts: [] }), stderr: "" } }, targetFailure: { operationCode: "BUILD_FAILED", cleanupCode: null }, failure: "BUILD_FAILED", cleanup: "VERIFIED_ZERO_RESOURCES", gates: [], build: { gate: "G1", verdict: "FAIL", findingCodes: ["BUILD_FAILED"], executedTestIds: ["workshop-business:typecheck"] } };
  const trial = { format: "mmp078-public-paid-trial-v1", modelGeneration: "GENERATED", aiGeneration: "AI_GENERATION_NOT_RUN", generatedRequests: 0, trialRunId: expected.runId, headSha: expected.headSha, sourceSha: identity.sourceSha, candidateSha: source.candidateSha, budgetAuth: { runId: expected.runId, headSha: expected.headSha, sourceSha: identity.sourceSha }, publicG1: "FAIL", publicG2: "INCONCLUSIVE", publicG3: "INCONCLUSIVE", cleanup: { status: "VERIFIED_ZERO_RESOURCES", containers: 0, volumes: 0, emergencyRemoved: 0 }, attempts: [{ attemptId: identity.attemptId, candidateSha: source.candidateSha, gates: [{ gate: "G1", verdict: "FAIL", findingCodes: ["BUILD_FAILED"] }], pairs: [{ pairId: identity.pairId, scenarioId: identity.scenarioId, cleanup: "VERIFIED_ZERO_RESOURCES", packs: [], compilerDiagnostics: { g1Verdict: "FAIL", sourceSha: identity.sourceSha, candidateSha: identity.candidateSha, attemptId: identity.attemptId, pairId: identity.pairId } }] }] };
  return { expected, identity, source, completion, trial };
}
export function writeSyntheticPacks(directory, fixture) {
  const pairRoot = join(directory, fixture.identity.attemptId, fixture.identity.pairId);
  mkdirSync(pairRoot, { recursive: true, mode: 0o700 });
  const provenance = Object.fromEntries(["headSha", "attemptId", "pairId", "candidateSha", "scenarioId"].map((k) => [k, fixture.identity[k]]));
  fixture.trial.attempts[0].pairs[0].packs = [false, true].map((bridge) => {
    const id = `oracle-${randomUUID()}`; const path = join(pairRoot, id);
    mkdirSync(path, { mode: 0o700 });
    const records = [["provenance", provenance], ...(bridge ? [["pair-1-source", fixture.source], ["pair-2-completion", fixture.completion]] : [["raw-reference-excluded", { marker: "MMP089_REFERENCE_MUST_NEVER_EXPORT" }]])];
    const entries = records.map(([recordId, value]) => { const bytes = JSON.stringify(value); writeFileSync(join(path, `${recordId}.json`), bytes, { mode: 0o600 }); return { id: recordId, bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) }; });
    const index = JSON.stringify({ format: "oracle-private-pack-v1", retention: {}, entries });
    writeFileSync(join(path, "index.json"), index, { mode: 0o600 });
    return { id, sha256: sha256(index) };
  });
  return fixture;
}
