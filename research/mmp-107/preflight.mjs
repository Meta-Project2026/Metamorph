// Offline only: serialize the current public prompt; inspect recorded receipts.
// Pure production serializers are imported here; production never imports research.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse } from "yaml";
import {
  META_MIGRATION_POLICY,
  META_PRICE_SNAPSHOT,
  prepareMetaMigration,
} from "../../packages/agent-real/src/meta-migration.mjs";
import {
  PAID_POLICY,
  paidProjection,
} from "../../packages/agent-real/src/meta-paid-authorization.mjs";
import { bindMigrationContext } from "../../packages/agent-real/src/migration-context.mjs";
import {
  MANIFEST,
  MANIFEST_SHA256,
  SOURCE,
} from "../../packages/oracle/dist/index.js";
import { digest } from "./custody.mjs";
export const BASE = "c3f697b4fcbd5ca9162ff47e0659659e07a1defc";
const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const read = (p) => readFileSync(resolve(root, p), "utf8");
const check = (ok) => {
  if (!ok) throw new Error("OFFLINE_PREFLIGHT_REJECTED");
};
export function recordedChecks(summary) {
  check(
    summary.format === "mmp108-first-step-proof-v1" &&
      summary.headSha === "f9a7b4458a083e3df721bb94d8b4370e3e0fdb4c" &&
      summary.status === "PASS",
  );
  check(
    summary.driver.sourcePin.commit === SOURCE.commit &&
      summary.driver.manifestPin === MANIFEST_SHA256 &&
      summary.aiGeneration === "AI_GENERATION_NOT_RUN" &&
      summary.modelRequests === 0,
  );
  const results = [];
  for (const [id, parity, sha] of [
    [
      "known-good-real-docker-first-step",
      "PASS",
      "34c8325a89db434bf5e869bbcb0999b9d2ef2496e4cff2db577a1e19c95f1334",
    ],
    [
      "first-step-http-fault-real-docker",
      "FAIL",
      "43eb3aeb392a65da325a5433246609c1a0d01c9b03633feeaf08a6d44a3e59f9",
    ],
  ]) {
    const matches = summary.cases.filter((c) => c.id === id);
    check(matches.length === 1);
    const c = matches[0];
    check(c.status === "PASS" && c.candidateSha === sha && c.pairs === 3);
    for (const [gate, verdict, count] of [
      ["G1", "PASS", 6],
      ["G2", parity, 17],
      ["G3", parity, 20],
    ])
      check(
        c.gates[gate].verdict === verdict &&
          c.gates[gate].executedCount === count &&
          c.gates[gate].executedFirst ===
            {
              G1: "workshop-business:typecheck",
              G2: "workshop-business:step-0",
              G3: "workshop-business:initial",
            }[gate] &&
          c.gates[gate].executedLast ===
            {
              G1: "workshop-capacity:build",
              G2: "workshop-capacity:step-5",
              G3: "workshop-capacity:step-5",
            }[gate],
      );
    check(
      c.coverage.http === 17 &&
        c.coverage.sqlite === 20 &&
        c.coverage.requiredHttp === 17 &&
        c.coverage.requiredSqlite === 20,
    );
    check(
      c.cleanup.status === "VERIFIED_ZERO_RESOURCES" &&
        c.cleanup.containers === 0 &&
        c.cleanup.volumes === 0 &&
        c.cleanup.emergencyRemoved === 0,
    );
    check(
      c.finalizer.status === "PASS" &&
        c.finalizer.inventory.containers === 0 &&
        c.finalizer.inventory.volumes === 0 &&
        c.finalizer.emergencyRemoved === 0,
    );
    check(
      parity === "PASS"
        ? c.gates.G2.findingCodes.length === 0 &&
            c.gates.G3.findingCodes.length === 0
        : JSON.stringify(c.gates.G2.findingCodes) === '["HTTP_STATUS"]' &&
            JSON.stringify(c.gates.G3.findingCodes) === '["HTTP_STATUS"]',
    );
    results.push({
      id,
      G1: "PASS",
      G2: parity,
      G3: parity,
      http: 17,
      sqlite: 20,
      cleanup: "ZERO_NORMAL_AND_FINALIZER",
      evidence: "RECORDED_NOT_NEW_EXECUTION",
    });
  }
  return results;
}
export function offlinePreflight() {
  const raw = read("research/mmp-061/public-source.json"),
    source = JSON.parse(raw),
    inventory = JSON.parse(read("research/mmp-061/inventory.json"));
  const context = bindMigrationContext(raw);
  const serialized = prepareMetaMigration(context, {
    unitId: "workshop-api",
    tier: "spark",
    action: "generate",
    attempt: 1,
    repairFeedback: null,
  });
  const projection = paidProjection(serialized);
  const workflow = parse(read(".github/workflows/meta-paid-migration.yml"));
  const budget = workflow.on.workflow_dispatch.inputs.max_estimated_usd;
  check(
    inventory.apiActions.length === 5 &&
      inventory.phpFunctionUnits.length === 11 &&
      context.benchmark().migrationUnitIds.length === 1,
  );
  check(
    digest(source.license) === SOURCE.licenseSha256 &&
      context.sourceSha === SOURCE.commit &&
      context.manifestSha256 === MANIFEST_SHA256,
  );
  check(
    META_PRICE_SNAPSHOT.inputPerMillion === PAID_POLICY.inputPerMillion &&
      META_PRICE_SNAPSHOT.outputPerMillion === PAID_POLICY.outputPerMillion &&
      META_PRICE_SNAPSHOT.cachedPerMillion === PAID_POLICY.cachedPerMillion &&
      META_PRICE_SNAPSHOT.version === PAID_POLICY.tariff,
  );
  const required = {
    G1: MANIFEST.flatMap((s) => [`${s.id}:typecheck`, `${s.id}:build`]),
    G2: MANIFEST.flatMap((s) => s.requests.map((_, i) => `${s.id}:step-${i}`)),
    G3: MANIFEST.flatMap((s) => [
      `${s.id}:initial`,
      ...s.requests.map((_, i) => `${s.id}:step-${i}`),
    ]),
  };
  check(
    required.G1.length === 6 &&
      required.G2.length === 17 &&
      required.G3.length === 20,
  );
  const summary = JSON.parse(
    read("research/mmp-108/evidence/local-f9a7b44/summary.json"),
  );
  return {
    format: "mmp107-offline-preflight-v1",
    baseSha: BASE,
    inspectedHead: execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim(),
    source: {
      repository: SOURCE.repository,
      commit: SOURCE.commit,
      archiveSha256: SOURCE.archiveSha256,
      license: "MIT",
      licenseSha256: SOURCE.licenseSha256,
      apiActions: 5,
      phpFunctions: 11,
      agentUnits: 1,
    },
    benchmark: context.benchmark().id,
    manifestSha256: MANIFEST_SHA256,
    required,
    model: META_MIGRATION_POLICY.model,
    reasoningEffort: META_MIGRATION_POLICY.reasoningEffort,
    tariff: PAID_POLICY.tariff,
    tariffExpires: PAID_POLICY.tariffExpires,
    rates: {
      input: PAID_POLICY.inputPerMillion,
      cached: PAID_POLICY.cachedPerMillion,
      output: PAID_POLICY.outputPerMillion,
    },
    serializedBytes: Buffer.byteLength(serialized),
    serializedSha256: digest(serialized),
    projection,
    defaultBudgetUsd: Number(budget.default),
    allowedBudgetUsd: budget.options.map(Number),
    defaultBudgetAdmits:
      projection.worstCaseEstimatedUsd <= Number(budget.default),
    liveTariffVerification: "NOT_RUN",
    chargedUsd: null,
    spent: "UNKNOWN",
    recordedChecks: recordedChecks(summary),
    newDockerExecution: "NOT_RUN",
    modelRequests: 0,
    G4: "INCONCLUSIVE_FORMAL_HELDOUT_NOT_RUN",
    product: "PRODUCT_NOT_ESTABLISHED",
    readiness: "NO_GO",
    blockers: [
      "TWO_OWNER_CUSTODY_DECISION_PENDING",
      "PRODUCTION_IMPLEMENTATION_AND_INDEPENDENT_REVIEW_NOT_RUN",
      "OWNER_SIDE_AGE_RESTORE_NOT_RUN",
      "DURABLE_CUSTODY_NOT_ESTABLISHED",
      "NEW_EXACT_MAIN_PAID_AUTHORIZATION_MISSING",
      "FRESH_TARIFF_AND_BUDGET_CONFIRMATION_REQUIRED",
    ],
    humanTimedRehearsal: "NOT_RUN",
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    process.stdout.write(`${JSON.stringify(offlinePreflight(), null, 2)}\n`);
  } catch {
    process.stderr.write("OFFLINE_PREFLIGHT_REJECTED\n");
    process.exitCode = 1;
  }
}
