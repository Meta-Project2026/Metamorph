// Original deterministic fault fixtures; never load source/candidate code.
import { randomUUID } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  publicAttempt,
  validatePublication,
} from "../../packages/agent-real/src/report.mjs";
import { buildReceipt } from "../../packages/agent-real/src/runtime.mjs";
import {
  MANIFEST,
  snapshotSqlite,
  verifyPair,
} from "../../packages/oracle/dist/index.js";
import { createStagePrototype } from "./stage-prototype.mjs";

const scenario = MANIFEST[0];
const secret = "SYNTHETIC_PRIVATE_TEXT_MUST_NOT_BE_PUBLISHED";
export const FIRST_STEP_FAULTS = Object.freeze([
  "reference-request",
  "candidate-request",
  "reference-transport",
  "candidate-transport",
  "reference-timeout",
  "candidate-timeout",
  "reference-malformed-observation",
  "candidate-malformed-json",
  "evidence-write",
]);
export const EARLY_FAULTS = Object.freeze([
  "reference-reset",
  "candidate-reset",
  "reference-snapshot",
  "candidate-snapshot",
]);

export async function runSyntheticControl(parent, fault, closeFault = false) {
  if (
    ![
      ...FIRST_STEP_FAULTS,
      ...EARLY_FAULTS,
      "initial-diff-write",
      "none",
    ].includes(fault)
  )
    throw new Error("SYNTHETIC_CONTROL_UNKNOWN");
  const state = join(parent, "state.sqlite");
  const database = new DatabaseSync(state);
  database.exec(
    "CREATE TABLE original_synthetic_control(id INTEGER PRIMARY KEY);",
  );
  database.close();
  const snapshot = snapshotSqlite(state);
  const trace = createStagePrototype();
  const closed = new Set();
  const pending = new Set();
  const artifacts = () =>
    join(
      parent,
      readdirSync(parent).find((name) => name.startsWith("oracle-")),
    );
  const reject = () => {
    throw new Error(secret);
  };
  const adapter = (side) => ({
    async reset() {
      if (fault === `${side}-reset`) reject();
    },
    async snapshot() {
      if (fault === `${side}-snapshot`) reject();
      if (side === "candidate" && fault === "initial-diff-write")
        mkdirSync(join(artifacts(), "diffs/0-initial.json"));
      return structuredClone(snapshot);
    },
    async request(_input, signal) {
      if (fault === `${side}-request`)
        throw Object.freeze({ code: "RUNTIME_FAILED", message: secret });
      if (fault === `${side}-transport`)
        throw Object.assign(new TypeError(secret), { code: "ECONNRESET" });
      if (fault === `${side}-timeout`)
        return new Promise((resolve, rejectPending) => {
          pending.add(resolve);
          signal.addEventListener(
            "abort",
            () => {
              pending.delete(resolve);
              rejectPending(new Error(secret));
            },
            { once: true },
          );
        });
      if (side === "reference" && fault === "evidence-write")
        mkdirSync(join(artifacts(), "http/0-0-reference.json"));
      return {
        status: 200,
        headers: { "content-type": "application/json" },
        body:
          side === "reference" && fault === "reference-malformed-observation"
            ? null
            : Buffer.from(
                side === "candidate" && fault === "candidate-malformed-json"
                  ? "{"
                  : "{}",
              ),
      };
    },
    async close() {
      closed.add(side);
      if (closeFault && side === "candidate") reject();
    },
  });
  const result = await verifyPair({
    reference: trace.wrap("REFERENCE", adapter("reference")),
    candidate: trace.wrap("CANDIDATE", adapter("candidate")),
    scenarios: [scenario],
    artifactParent: parent,
    operationTimeoutMs: 100,
  });
  const manifest = JSON.parse(
    readFileSync(join(result.evidenceDirectory, "manifest.json"), "utf8"),
  );
  const initialDiffsPath = join(
    result.evidenceDirectory,
    "diffs/0-initial.json",
  );
  const initialDiffs =
    fault === "initial-diff-write" || EARLY_FAULTS.includes(fault)
      ? []
      : JSON.parse(readFileSync(initialDiffsPath, "utf8"));
  const gates = validatePublication(
    { manifest, gates: result.gateResults, initialDiffs },
    scenario,
    manifest.runId,
  );
  // This is a synthetic trusted build RECEIPT, not an executed compiler/build.
  const build = buildReceipt(
    {
      image: "SYNTHETIC_IMAGE",
      evidence: {
        build: {
          args: ["SYNTHETIC_IMAGE", "/opt/worker/build.mjs"],
          exitCode: 0,
          stdout: JSON.stringify({
            checks: ["typecheck", "build"].map((phase) => ({
              phase,
              exitCode: 0,
            })),
          }),
        },
        buildChecks: ["typecheck", "build"],
      },
    },
    scenario.id,
  );
  const attemptId = randomUUID();
  const attempt = {
    attemptId,
    candidateSha: "a".repeat(64),
    errorCode: null,
    pairs: [
      {
        attemptId,
        candidateSha: "a".repeat(64),
        pairId: randomUUID(),
        scenarioId: scenario.id,
        build,
        gates,
        cleanup: closeFault ? "CLEANUP_ERROR" : "VERIFIED_ZERO_RESOURCES",
        packs: [
          {
            id: "oracle-synthetic104",
            sha256: "b".repeat(64),
            reference: "synthetic-only/index.json",
          },
        ],
      },
    ],
  };
  const receipt = publicAttempt(attempt);
  const stage = trace.finish(
    result.gateResults.some((g) => g.verdict === "ERROR"),
  );
  return {
    receipt,
    stage,
    closed: [...closed].sort(),
    pendingOperations: pending.size,
    buildObservation: "SYNTHETIC_RECEIPT_NOT_EXECUTED_BUILD",
    historicalCandidateExecuted: false,
    dockerExecuted: false,
    providerRequests: 0,
  };
}
