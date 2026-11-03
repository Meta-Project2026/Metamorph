// Original synthetic controls. Never imported by the paid workflow.
import { createCipheriv, randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { MANIFEST } from "@metamorph/oracle";
import { sha256 } from "../../target-worker/src/admission.mjs";
import { bindMigrationContext } from "../src/migration-context.mjs";
import { CONTROL_IDS, expectedIds, publicAttempt } from "../src/report.mjs";

export const TEST_TIME = Date.parse("2026-11-03T02:00:00Z");
export const TEST_HEAD = "f68b75ec0005cb76059f41218452ff57f47d50d6";
export const context = () =>
  bindMigrationContext(
    readFileSync(
      new URL("../../../research/mmp-061/public-source.json", import.meta.url),
      "utf8",
    ),
  );
export const changes = (n = 1) => [
  { path: "src/main.ts", content: `export const syntheticOnly = ${n};\n` },
];
export const clean = () => ({
  status: "VERIFIED_ZERO_RESOURCES",
  containers: 0,
  volumes: 0,
  emergencyRemoved: 0,
});
export function wireReply(source = changes()) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      id: "chatcmpl-synthetic-repair",
      object: "chat.completion",
      created: 1,
      model: "muse-spark-1.3",
      choices: [
        {
          index: 0,
          finish_reason: "stop",
          message: {
            role: "assistant",
            refusal: null,
            content: JSON.stringify({ changes: source }),
          },
        },
      ],
      usage: {
        prompt_tokens: 1000,
        completion_tokens: 100,
        total_tokens: 1100,
        prompt_tokens_details: { cached_tokens: 0 },
        completion_tokens_details: { reasoning_tokens: 0 },
      },
    }),
  };
}
// Test-only AES capsule. It is explicitly NOT the approved production age chain.
export function syntheticCustody({ attempt, candidateSha, bundle }) {
  const cipher = createCipheriv(
    "aes-256-gcm",
    randomBytes(32),
    randomBytes(12),
  );
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(bundle)),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  return {
    execution: "SYNTHETIC",
    attempt,
    candidateSha,
    acknowledged: true,
    cleanup: "VERIFIED_ZERO_RESOURCES",
    ciphertext,
    readback: Buffer.from(ciphertext),
    ciphertextSha256: sha256(ciphertext),
  };
}
// Full-shaped receipts from publicAttempt; these are NOT executed Docker results.
export function syntheticVerification(candidateSha, fail = false) {
  const attemptId = randomUUID();
  const attempt = publicAttempt({
    attemptId,
    candidateSha,
    errorCode: null,
    pairs: MANIFEST.map((s) => ({
      attemptId,
      candidateSha,
      scenarioId: s.id,
      pairId: randomUUID(),
      cleanup: "VERIFIED_ZERO_RESOURCES",
      packs: [1, 2].map(() => ({
        id: `oracle-${randomUUID()}`,
        sha256: "a".repeat(64),
        reference: "synthetic/index.json",
      })),
      build: {
        gate: "G1",
        verdict: "PASS",
        executedTestIds: [`${s.id}:typecheck`, `${s.id}:build`],
        findingCodes: [],
      },
      gates: ["G2", "G3", "G4"].map((gate) => ({
        gate,
        verdict: gate === "G4" ? "INCONCLUSIVE" : fail ? "FAIL" : "PASS",
        executedTestIds: gate === "G4" ? CONTROL_IDS : expectedIds(s, gate),
        findingCodes:
          gate === "G4" ? ["HELD_OUT_NOT_RUN"] : fail ? ["HTTP_JSON_TYPE"] : [],
      })),
    })),
  });
  return {
    candidateSha,
    publicG1: "PASS",
    publicG2: fail ? "FAIL" : "PASS",
    publicG3: fail ? "FAIL" : "PASS",
    G0: "INCONCLUSIVE",
    G4: "INCONCLUSIVE",
    product: "NOT_ESTABLISHED",
    attempts: [attempt],
    cleanup: clean(),
  };
}
