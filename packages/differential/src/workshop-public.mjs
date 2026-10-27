import { MANIFEST, MANIFEST_SHA256, SOURCE } from "@metamorph/oracle";
import { fields, requireCheck } from "./strict.mjs";
import { WORKSHOP_CONTROL_IDS } from "./workshop-controls.mjs";
import { WORKSHOP_CANDIDATE_SHA } from "./workshop-policy.mjs";

const hash = (v) => /^[a-f0-9]{64}$/.test(v);
const codes = new Set([
  "DB_SCHEMA",
  "DB_STATE",
  "MISSING_COVERAGE",
  "HELD_OUT_NOT_RUN",
  "VERIFIER_ERROR",
  "CONTROL_FAILURE",
  "HTTP_STATUS",
  "HTTP_HEADER",
  "HTTP_JSON_TYPE",
  "HTTP_JSON_VALUE",
  "HTTP_JSON_MISSING",
  "HTTP_JSON_LENGTH",
  "HTTP_BODY",
]);
export function workshopSummary(input) {
  fields(
    input,
    [
      "headSha",
      "candidateSha",
      "phpImage",
      "targetImage",
      "recipeSha",
      "runs",
      "quota",
      "controls",
    ],
    "PUBLIC_FIELDS",
  );
  requireCheck(
    /^[a-f0-9]{40}$/.test(input.headSha) &&
      input.candidateSha === WORKSHOP_CANDIDATE_SHA &&
      hash(input.recipeSha) &&
      [input.phpImage, input.targetImage].every((s) =>
        /^sha256:[a-f0-9]{64}$/.test(s),
      ),
    "PUBLIC_HASH",
  );
  requireCheck(input.runs.length === 6, "WORKSHOP_COVERAGE");
  const runs = input.runs.map((r, i) => {
    fields(
      r,
      [
        "pass",
        "scenarioId",
        "gates",
        "phpPackSha",
        "bridgePackSha",
        "cleanup",
        "counts",
      ],
      "PUBLIC_FIELDS",
    );
    const s = MANIFEST[i % 3];
    requireCheck(
      r.pass === Math.floor(i / 3) + 1 &&
        r.scenarioId === s.id &&
        hash(r.phpPackSha) &&
        hash(r.bridgePackSha) &&
        r.cleanup === "VERIFIED_ZERO_RESOURCES",
      "WORKSHOP_COVERAGE",
    );
    const gates = r.gates.map((g, index) => {
      fields(
        g,
        ["gate", "verdict", "executedTestIds", "findingCodes"],
        "PUBLIC_FIELDS",
      );
      requireCheck(
        g.gate === ["G2", "G3", "G4"][index] &&
          ["PASS", "FAIL", "INCONCLUSIVE", "ERROR"].includes(g.verdict) &&
          Array.isArray(g.findingCodes) &&
          g.findingCodes.every((c) => codes.has(c)),
        "PUBLIC_GATE",
      );
      const expected =
        index === 0
          ? s.requests.map((_, n) => `${s.id}:step-${n}`)
          : index === 1
            ? [
                `${s.id}:initial`,
                ...s.requests.map((_, n) => `${s.id}:step-${n}`),
              ]
            : [
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
      requireCheck(
        g.executedTestIds.every((id) => expected.includes(id)) &&
          new Set(g.executedTestIds).size === g.executedTestIds.length &&
          (g.verdict !== "PASS" ||
            (JSON.stringify(g.executedTestIds) === JSON.stringify(expected) &&
              g.findingCodes.length === 0)) &&
          (index !== 2 ||
            JSON.stringify(g.executedTestIds) === JSON.stringify(expected)),
        "PUBLIC_GATE",
      );
      return {
        gate: g.gate,
        verdict: g.verdict,
        executedTestIds: [...g.executedTestIds],
        findingCodes: [...g.findingCodes],
      };
    });
    requireCheck(
      gates.length === 3 &&
        gates[2].verdict === "INCONCLUSIVE" &&
        gates[2].findingCodes.includes("HELD_OUT_NOT_RUN"),
      "PUBLIC_GATE",
    );
    fields(
      r.counts,
      ["targetResets", "targetRequests", "targetSnapshots", "readiness"],
      "PUBLIC_FIELDS",
    );
    requireCheck(
      Object.values(r.counts).every(
        (v) => Number.isSafeInteger(v) && v >= 0 && v <= 128,
      ) &&
        r.counts.targetRequests === gates[0].executedTestIds.length &&
        (gates[1].verdict !== "PASS" ||
          r.counts.targetSnapshots >= s.requests.length + 1),
      "PUBLIC_COUNTS",
    );
    return {
      pass: r.pass,
      scenarioId: s.id,
      gates,
      phpPackSha: r.phpPackSha,
      bridgePackSha: r.bridgePackSha,
      cleanup: r.cleanup,
      counts: { ...r.counts },
    };
  });
  requireCheck(input.quota.length === 2, "QUOTA_COVERAGE");
  const quota = input.quota.map((v, i) => {
    fields(
      v,
      ["mode", "code", "totalBytes", "writtenBytes", "type", "cleanup"],
      "PUBLIC_FIELDS",
    );
    requireCheck(
      v.mode === ["aux", "wal"][i] &&
        v.code === ["ENOSPC", "SQLITE_FULL"][i] &&
        v.totalBytes === 16777216 &&
        Number.isSafeInteger(v.writtenBytes) &&
        v.writtenBytes > 0 &&
        v.writtenBytes <= v.totalBytes &&
        v.type === "tmpfs" &&
        v.cleanup === "VERIFIED_ZERO_RESOURCES",
      "QUOTA_CONTROL",
    );
    return {
      mode: v.mode,
      code: v.code,
      totalBytes: v.totalBytes,
      writtenBytes: v.writtenBytes,
      type: "tmpfs",
      cleanup: v.cleanup,
    };
  });
  requireCheck(
    Array.isArray(input.controls) &&
      input.controls.length === WORKSHOP_CONTROL_IDS.length,
    "WORKSHOP_CONTROL",
  );
  const controls = input.controls.map((c, i) => {
    fields(c, ["id", "outcome", "cleanup"], "PUBLIC_FIELDS");
    requireCheck(
      c.id === WORKSHOP_CONTROL_IDS[i] &&
        c.outcome === "PASS" &&
        c.cleanup === "VERIFIED_ZERO_RESOURCES",
      "WORKSHOP_CONTROL",
    );
    return { id: c.id, outcome: c.outcome, cleanup: c.cleanup };
  });
  return {
    format: "workshop-differential-public-v1",
    headSha: input.headSha,
    candidateSha: input.candidateSha,
    source: SOURCE,
    manifestSha: MANIFEST_SHA256,
    phpImage: input.phpImage,
    targetImage: input.targetImage,
    recipeSha: input.recipeSha,
    runs,
    quota,
    controls,
    coverage: runs.every(
      (r) => r.gates[0].verdict === "PASS" && r.gates[1].verdict === "PASS",
    )
      ? "ALL_17_PUBLIC_STEPS_PER_PASS"
      : "SEE_PER_SCENARIO_RESULTS",
    G0: "NOT_RUN",
    heldOut: "NOT_RUN",
    product: "NOT_ESTABLISHED",
    externalRetention: "EXTERNAL_RETENTION_NOT_RUN",
    retention: "EVIDENCE_RETENTION_NOT_CONFIGURED",
  };
}
