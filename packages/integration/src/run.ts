import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createCandidateWriter,
  type ModelProvider,
  type ModelRequest,
  runAgent,
} from "@metamorph/agent";
import { NORMALIZATION_VERSION } from "@metamorph/oracle";
import { CANDIDATE_TEXT, PUBLIC_SCENARIOS } from "./fixtures.js";
import { OracleBackedVerifier } from "./verifier.js";

export async function runIntegrationDemo() {
  const root = await mkdtemp(join(tmpdir(), "metamorph-integration-"));
  const sourceParent = join(root, "source");
  const artifactParent = join(root, "private-oracle");
  await mkdir(sourceParent);
  await mkdir(artifactParent);
  const writer = createCandidateWriter(sourceParent);
  const runId = `synthetic-${randomUUID()}`;
  const verifier = new OracleBackedVerifier({
    runId,
    candidateRoot: writer.root,
    artifactParent,
    operationTimeoutMs: 1000,
  });
  const calls: ModelRequest[] = [];
  const provider: ModelProvider = {
    billing: "synthetic",
    maxRequestCostUsd: 0,
    async generate(request, signal) {
      signal.throwIfAborted();
      calls.push({ ...request });
      return {
        changes: [
          {
            path: "src/candidate.ts",
            content:
              request.action === "generate"
                ? CANDIDATE_TEXT.broken
                : CANDIDATE_TEXT.repaired,
          },
        ],
        usage: {
          requestId: `public-script-${calls.length}`,
          provider: "synthetic-offline",
          modelId: "deterministic-marker",
          inputTokens: null,
          outputTokens: null,
          cachedInputTokens: null,
          estimatedCostUsd: null,
          durationMs: 0,
        },
      };
    },
  };
  const result = await runAgent({
    runId,
    writer,
    verifier,
    provider,
    config: {
      benchmarkId: "public-integration-demo",
      strategy: "spark-only",
      maxRepairsPerUnit: 1,
      maxEscalations: 0,
      maxModelSpendUsd: 1,
      timeoutSeconds: 15,
    },
    benchmark: {
      id: "public-integration-demo",
      sourceRepo: "https://example.invalid/original-public-fixture",
      sourceCommit: "0".repeat(40),
      license: "original-synthetic-not-a-benchmark",
      phpRuntime: "NOT_RUN",
      scenarioIds: PUBLIC_SCENARIOS.map((s) => s.id),
      migrationUnitIds: ["candidate"],
      normalizationVersion: NORMALIZATION_VERSION,
    },
  });
  await verifier.waitForIdle();
  const manifest = {
    runId,
    scope: "PUBLIC/SYNTHETIC ONLY",
    candidateRoot: writer.root,
    attempts: verifier.attempts,
    verdict: result.verdict,
    PHP: "NOT_RUN",
    LIVE_META: "NOT_RUN",
    G0: "NOT_RUN",
    G1: "NOT_RUN",
    HELD_OUT: "NOT_RUN",
    PRODUCT_PASS: "NOT_ESTABLISHED",
  };
  await writeFile(
    join(root, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    { flag: "wx", mode: 0o600 },
  );
  await writeFile(
    join(root, "events.jsonl"),
    `${result.events.map((e) => JSON.stringify(e)).join("\n")}\n`,
    { flag: "wx", mode: 0o600 },
  );
  return { root, manifest, result, calls };
}
