// Offline verification of this task's allowlisted PUBLIC receipts only.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { WORKSHOP_CONTROL_IDS } from "../../packages/differential/src/workshop-controls.mjs";
import { MANIFEST } from "../../packages/oracle/dist/reference/manifest.js";
import { root, verifyPins } from "../mmp-044/config.mjs";
import { inputMatrix } from "./inputs.mjs";
import { regressions } from "./scenarios.mjs";
import { validateGroup } from "./validation.mjs";

export function verifyPublic(read, headSha) {
  assert.match(headSha, /^[a-f0-9]{40}$/);
  const files = [
    "summary.json",
    "semantics.json",
    "agent.json",
    "finalizer.json",
  ].map((name) => JSON.parse(read(name)));
  const [proof, semantics, agent, finalizer] = files;
  for (const f of files) assert.equal(f.headSha, headSha);
  const metadata = JSON.parse(
    readFileSync(join(root, "specs/016-candidate-compat/candidate.json")),
  );
  const { pins, corpus } = verifyPins({ strictCheckout: false });
  assert.equal(proof.format, "mmp049-candidate-proof-v1");
  assert.equal(proof.harness, "SUCCESS");
  assert.equal(proof.parity, "PASS");
  assert.equal(proof.errorCode, null);
  assert.deepEqual(proof.candidate, metadata);
  assert.equal(proof.manifestSha256, pins.manifestSha256);
  assert.equal(proof.runtime.sourceSha256, pins.php.archiveSha256);
  assert.equal(proof.runtime.provenance.recipeSha, pins.targetRecipeSha256);
  for (const key of ["phpImageId", "targetImageId"])
    assert.match(proof.runtime[key], /^sha256:[a-f0-9]{64}$/);
  assert.equal(proof.runtime.provenance.measured.node, "v24.11.0");
  assert.equal(proof.runtime.provenance.measured.sqlite, "3.50.4");
  assert.deepEqual(proof.gates, {
    G0: "INCONCLUSIVE",
    G1: "PASS",
    G2: "PASS",
    G3: "PASS",
    G4: "INCONCLUSIVE",
  });
  assert.equal(proof.product, "NOT_ESTABLISHED");
  assert.equal(proof.ai, "AI_GENERATION_NOT_RUN");
  assert.equal(semantics.status, "PASS");
  assert.equal(semantics.measurements.php.php, "7.4.33");
  assert.equal(semantics.measurements.php.intSize, 8);
  assert.deepEqual(semantics.inputMatrix, inputMatrix);
  assert.equal(proof.candidateOperators.status, "PASS");
  assert.equal(
    proof.candidateOperators.candidateSha256,
    metadata.candidateSha256,
  );
  assert.match(proof.candidateOperators.artifactSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(
    proof.candidateOperators.integerResults,
    semantics.measurements.php.integers,
  );
  assert.deepEqual(
    proof.candidateOperators.whitespaceResults,
    semantics.measurements.php.whitespace,
  );
  assert.deepEqual(
    proof.controls.map((c) => c.id),
    [...WORKSHOP_CONTROL_IDS],
  );
  assert.ok(
    proof.controls.every(
      (c) => c.outcome === "PASS" && c.cleanup === "VERIFIED_ZERO_RESOURCES",
    ),
  );
  const groups = [
    ["original-manifest", MANIFEST],
    ["unchanged-mmp044", corpus.cases],
    ["additional-public-regressions", regressions],
  ];
  assert.equal(proof.groups.length, groups.length);
  for (const [i, [name, scenarios]] of groups.entries()) {
    assert.equal(proof.groups[i].name, name);
    assert.deepEqual(
      proof.groups[i].result,
      validateGroup(scenarios, proof.groups[i].cases),
    );
    assert.equal(proof.groups[i].result.status, "PASS");
  }
  assert.equal(proof.httpControls.positive, "PASS");
  assert.equal(proof.httpControls.negative.status, "PASS");
  assert.ok(proof.httpControls.negative.codes.includes("HTTP_STATUS"));
  assert.equal(agent.format, "mmp049-corrected-agent-v1");
  assert.equal(agent.status, "PASS_SCOPED");
  assert.equal(agent.errorCode, null);
  assert.equal(agent.agentVerdict, "INCONCLUSIVE");
  assert.equal(agent.agentReason, "VERIFIER_INCONCLUSIVE");
  assert.equal(agent.paidCalls, 0);
  assert.equal(agent.knownModelSpendUsd, 0);
  assert.equal(agent.totalModelSpendUsd, 0);
  assert.equal(agent.product, "NOT_ESTABLISHED");
  assert.equal(agent.aiGeneration, "AI_GENERATION_NOT_RUN");
  assert.equal(agent.attempts.length, 2);
  assert.equal(agent.attempts[1].candidateSha, metadata.candidateSha256);
  assert.notEqual(
    agent.attempts[0].candidateSha,
    agent.attempts[1].candidateSha,
  );
  const pairs = agent.attempts.flatMap((a) => a.pairs);
  assert.equal(new Set(pairs.map((p) => p.pairId)).size, 6);
  for (const [i, attempt] of agent.attempts.entries()) {
    assert.equal(attempt.coverage.http, 17);
    assert.equal(attempt.coverage.sqlite, 20);
    assert.deepEqual(
      attempt.pairs.map((p) => p.scenarioId),
      MANIFEST.map((s) => s.id),
    );
    assert.equal(attempt.gates.length, 5);
    for (const g of attempt.gates)
      assert.equal(
        g.verdict,
        ["G0", "G4"].includes(g.gate)
          ? "INCONCLUSIVE"
          : i === 0 && ["G2", "G3"].includes(g.gate)
            ? "FAIL"
            : "PASS",
      );
    assert.ok(
      attempt.pairs.every(
        (p) =>
          p.cleanup === "VERIFIED_ZERO_RESOURCES" &&
          p.targetLifetimePolicyMs === 180000,
      ),
    );
  }
  assert.equal(agent.usage.length, 2);
  for (const [i, u] of agent.usage.entries()) {
    assert.equal(u.provider, "offline-deterministic-replay");
    assert.equal(u.modelId, "public-workshop-compat-v1-replay");
    assert.equal(u.requestId, `mmp049-offline-${i + 1}`);
    assert.equal(u.estimatedCostUsd, 0);
    assert.equal(u.inputTokens, null);
    assert.equal(u.outputTokens, null);
    assert.equal(u.cachedInputTokens, null);
  }
  for (const clean of [proof.cleanup, semantics.cleanup, ...finalizer.stages]) {
    assert.equal(clean.status, "PASS");
    assert.equal(clean.emergencyRemoved, 0);
    assert.deepEqual(clean.inventory, { containers: 0, volumes: 0 });
  }
  assert.equal(agent.completion.cleanup, "VERIFIED_ZERO_RESOURCES");
  assert.equal(agent.completion.emergencyRemoved, 0);
  assert.deepEqual(agent.completion.inventory, { containers: 0, volumes: 0 });
  assert.equal(finalizer.status, "PASS");
  assert.deepEqual(
    finalizer.stages.map((s) => s.name),
    ["probe", "proof", "agent"],
  );
  return {
    status: "PASS_SCOPED",
    groups: proof.groups.map((g) => ({ name: g.name, ...g.result })),
    agent: { attempts: 2, http: 34, sqlite: 40 },
    G0: "INCONCLUSIVE",
    G4: "INCONCLUSIVE",
    product: "NOT_ESTABLISHED",
  };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [directory, sha] = process.argv.slice(2);
  console.log(
    JSON.stringify(
      verifyPublic((name) => readFileSync(join(directory, name)), sha),
      null,
      2,
    ),
  );
}
