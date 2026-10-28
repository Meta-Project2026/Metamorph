import {
  MANIFEST_SHA256,
  NORMALIZATION_VERSION,
  SOURCE,
} from "@metamorph/oracle";
import { fields, requireCheck } from "../../differential/src/strict.mjs";
import { WORKSHOP_CANDIDATE_SHA } from "../../differential/src/workshop-policy.mjs";
import { DECLARED, FAMILIES, VERSION } from "./corpus.mjs";

const hash = (h) => typeof h === "string" && /^[a-f0-9]{64}$/.test(h);
const CODES = new Set([
  "HTTP_STATUS",
  "HTTP_HEADER",
  "HTTP_JSON_TYPE",
  "HTTP_JSON_LENGTH",
  "HTTP_JSON_MISSING",
  "HTTP_JSON_VALUE",
  "HTTP_BODY",
  "DB_SCHEMA",
  "DB_STATE",
  "MISSING_COVERAGE",
  "VERIFIER_ERROR",
  "HELD_OUT_NOT_RUN",
  "CONTROL_FAILURE",
]);
const CONTROLS = [
  "http-positive",
  "http-key-order",
  "http-status-mutant",
  "http-type-mutant",
  "http-missing-mutant",
  "http-order-mutant",
  "db-positive",
  "db-row-mutant",
  "db-sequence-mutant",
];
export function gatesForPublic(gates, id, steps) {
  requireCheck(Array.isArray(gates) && gates.length === 3, "PUBLIC_GATES");
  return gates.map((g, i) => {
    requireCheck(
      g.gate === ["G2", "G3", "G4"][i] &&
        ["PASS", "FAIL", "ERROR", "INCONCLUSIVE"].includes(g.verdict),
      "PUBLIC_GATE",
    );
    const expected =
      i === 0
        ? Array.from({ length: steps }, (_, n) => `${id}:step-${n}`)
        : i === 1
          ? [
              `${id}:initial`,
              ...Array.from({ length: steps }, (_, n) => `${id}:step-${n}`),
            ]
          : CONTROLS;
    requireCheck(
      Array.isArray(g.executedTestIds) &&
        new Set(g.executedTestIds).size === g.executedTestIds.length &&
        g.executedTestIds.every((v, n) => v === expected[n]) &&
        (g.verdict !== "PASS" ||
          g.executedTestIds.length === expected.length) &&
        Array.isArray(g.findings) &&
        g.findings.every((f) => CODES.has(f.code)) &&
        (g.verdict !== "PASS" || g.findings.length === 0),
      "PUBLIC_COVERAGE",
    );
    if (i === 2)
      requireCheck(
        g.verdict === "INCONCLUSIVE" &&
          g.findings.length === 1 &&
          g.findings[0].code === "HELD_OUT_NOT_RUN" &&
          g.executedTestIds.length === 9,
        "PUBLIC_G4",
      );
    return {
      gate: g.gate,
      verdict: g.verdict,
      executedCount: g.executedTestIds.length,
      differenceCodes: [...new Set(g.findings.map((f) => f.code))],
    };
  });
}
const verdict = (g) =>
  g.some((x) => x.verdict === "ERROR")
    ? "AUDIT_ERROR"
    : g.some((x) => x.verdict === "FAIL")
      ? "AUDIT_FAIL"
      : g.every((x) => x.verdict === "PASS")
        ? "AUDIT_PASS"
        : "AUDIT_PARTIAL";
export function publicSummary(input) {
  fields(
    input,
    [
      "identity",
      "sampleCommitment",
      "runs",
      "controls",
      "cleanup",
      "provenancePackSha",
    ],
    "PUBLIC_FIELDS",
  );
  const x = input.identity;
  fields(
    x,
    [
      "headSha",
      "candidateSha",
      "sourceSha",
      "manifestSha",
      "profile",
      "recipeSha",
      "phpImage",
      "targetImage",
      "normalization",
      "evaluatorSha",
    ],
    "PUBLIC_IDENTITY",
  );
  requireCheck(
    /^[a-f0-9]{40}$/.test(x.headSha) &&
      x.candidateSha === WORKSHOP_CANDIDATE_SHA &&
      x.sourceSha === SOURCE.archiveSha256 &&
      x.manifestSha === MANIFEST_SHA256 &&
      x.profile === "car-workshop-v1" &&
      x.normalization === NORMALIZATION_VERSION &&
      [
        x.recipeSha,
        x.evaluatorSha,
        input.sampleCommitment,
        input.provenancePackSha,
      ].every(hash) &&
      [x.phpImage, x.targetImage].every((h) => /^sha256:[a-f0-9]{64}$/.test(h)),
    "PUBLIC_IDENTITY",
  );
  requireCheck(
    Array.isArray(input.runs) && input.runs.length === DECLARED.length,
    "PUBLIC_COVERAGE",
  );
  const checkRun = (r, d) => {
    fields(r, ["id", "steps", "gates", "packSha", "cleanup"], "PUBLIC_FIELDS");
    requireCheck(
      r.id === d.id &&
        r.steps === d.steps &&
        hash(r.packSha) &&
        r.cleanup === "VERIFIED_ZERO_RESOURCES",
      "PUBLIC_RUN",
    );
    const gates = gatesForPublic(r.gates, d.id, d.steps);
    return {
      id: d.id,
      declaredSteps: d.steps,
      gates,
      verdict: verdict(gates.slice(0, 2)),
      packSha: r.packSha,
      cleanup: r.cleanup,
    };
  };
  const runs = input.runs.map((r, i) => checkRun(r, DECLARED[i]));
  fields(input.controls, ["positive", "negative"], "PUBLIC_FIELDS");
  const positive = checkRun(input.controls.positive, {
      id: "audit-public-positive",
      steps: 6,
    }),
    negative = checkRun(input.controls.negative, {
      id: "audit-public-negative",
      steps: 6,
    });
  requireCheck(
    positive.verdict === "AUDIT_PASS" &&
      negative.verdict === "AUDIT_FAIL" &&
      negative.gates[0].executedCount === 6 &&
      negative.gates[1].executedCount === 7 &&
      negative.gates[0].differenceCodes.includes("HTTP_STATUS"),
    "INDEPENDENT_CONTROL",
  );
  fields(
    input.cleanup,
    ["containers", "volumes", "emergencyRemoved"],
    "PUBLIC_FIELDS",
  );
  requireCheck(
    Object.values(input.cleanup).every((v) => v === 0),
    "CLEANUP_ERROR",
  );
  const families = FAMILIES.map((f) => {
    const selected = runs.filter((_, i) => DECLARED[i].family === f);
    return {
      family: f,
      scenarioCount: selected.length,
      declaredSteps: selected.reduce((n, r) => n + r.declaredSteps, 0),
      verdict: verdict(
        selected.map((r) => ({
          verdict:
            r.verdict === "AUDIT_PASS"
              ? "PASS"
              : r.verdict === "AUDIT_FAIL"
                ? "FAIL"
                : r.verdict === "AUDIT_ERROR"
                  ? "ERROR"
                  : "INCONCLUSIVE",
        })),
      ),
      runs: selected,
    };
  });
  const result = verdict(
    runs.map((r) => ({
      verdict:
        r.verdict === "AUDIT_PASS"
          ? "PASS"
          : r.verdict === "AUDIT_FAIL"
            ? "FAIL"
            : r.verdict === "AUDIT_ERROR"
              ? "ERROR"
              : "INCONCLUSIVE",
    })),
  );
  return {
    format: VERSION,
    identity: { ...x },
    sampleCommitment: input.sampleCommitment,
    families,
    controls: {
      positive: { ...positive, controlStatus: "CONTROL_PASS" },
      negative: { ...negative, controlStatus: "CONTROL_PASS" },
    },
    cleanup: { ...input.cleanup },
    provenancePackSha: input.provenancePackSha,
    verdict: result,
    coverage: "DECLARED_SAMPLED_FAMILIES_ONLY",
    blocked: [
      { family: "filtered-search-queries", status: "BLOCKED_TRANSPORT_POLICY" },
    ],
    isolation: "POST_FREEZE_SAMPLED_VALUES_NOT_EXPORTED",
    formalHeldOut: "HELDOUT_ISOLATION_NOT_PROVEN",
    auditorIndependence: "AUTHOR_CONTEXT_SHARED_REQUIRES_INDEPENDENT_REVIEW",
    canonicalG4: "INCONCLUSIVE",
    G0: "NOT_RUN",
    product: "NOT_ESTABLISHED",
    externalRetention: "EXTERNAL_RETENTION_NOT_RUN",
  };
}
