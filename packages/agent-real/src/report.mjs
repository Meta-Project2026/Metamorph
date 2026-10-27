import { VerificationReportSchema } from "@metamorph/agent";
import { GateResultSchema } from "@metamorph/contracts";
import { MANIFEST } from "@metamorph/oracle";
import { check } from "./source.mjs";

export const CODES = new Set([
  "DB_SCHEMA",
  "DB_STATE",
  "HTTP_STATUS",
  "HTTP_HEADER",
  "HTTP_JSON_TYPE",
  "HTTP_JSON_VALUE",
  "HTTP_JSON_MISSING",
  "HTTP_JSON_LENGTH",
  "HTTP_BODY",
  "MISSING_COVERAGE",
  "HELD_OUT_NOT_RUN",
  "CONTROL_FAILURE",
  "VERIFIER_ERROR",
  "G0_NOT_ESTABLISHED",
  "BUILD_FAILED",
  "BUILD_NOT_RUN",
  "CLEANUP_ERROR",
  "CANCELLED",
  "TIMEOUT",
  "RUNTIME_FAILED",
  "ENVIRONMENT_ERROR",
  "ADMISSION_REJECTED",
  "EVIDENCE_ERROR",
  "CLOCK_PARITY_BLOCKED",
]);
export const CONTROL_IDS = [
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
export const expectedIds = (scenario, gate) =>
  gate === "G4"
    ? CONTROL_IDS
    : [
        ...(gate === "G3" ? [`${scenario.id}:initial`] : []),
        ...scenario.requests.map((_, i) => `${scenario.id}:step-${i}`),
      ];
export const safeCode = (error) =>
  CODES.has(error?.code) ? error.code : "EVIDENCE_ERROR";
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function checkedGate(raw, gate, expected) {
  const g = GateResultSchema.parse(raw);
  check(
    g.gate === gate && g.executedTestIds.every((id) => expected.includes(id)),
    "EVIDENCE_ERROR",
  );
  check(
    g.findings.every((f) => CODES.has(f.code)),
    "EVIDENCE_ERROR",
  );
  check(
    g.verdict !== "PASS" ||
      (equal(g.executedTestIds, expected) && g.findings.length === 0),
    "EVIDENCE_ERROR",
  );
  // Deliberate declassification: no finding message, path or raw value crosses this boundary.
  return {
    gate,
    verdict: g.verdict,
    executedTestIds: [...g.executedTestIds],
    findingCodes: [...new Set(g.findings.map((f) => f.code))],
  };
}
export function gateResult(gate, verdict, ids, codes, paths) {
  check(
    codes.every((c) => CODES.has(c)),
    "EVIDENCE_ERROR",
  );
  return GateResultSchema.parse({
    gate,
    verdict,
    executedTestIds: ids,
    findings: [...new Set(codes)].map((code) => ({ code, message: code })),
    evidencePaths: [...new Set(paths)],
  });
}

/** Validate the exact raw file index before any aggregate verdict is admitted. */
export function validatePublication(actual, scenario, oracleId) {
  check(
    actual.manifest.runId === oracleId &&
      equal(actual.manifest.scenarioIds, [scenario.id]) &&
      actual.manifest.expectedSteps === scenario.requests.length &&
      actual.gates.length === 3,
    "EVIDENCE_ERROR",
  );
  const gates = actual.gates.map((g, i) =>
    checkedGate(
      g,
      ["G2", "G3", "G4"][i],
      expectedIds(scenario, ["G2", "G3", "G4"][i]),
    ),
  );
  for (const [i, gate] of actual.gates.entries()) {
    for (const id of gate.executedTestIds) {
      let paths;
      if (i === 2) paths = ["controls.json"];
      else if (id.endsWith(":initial"))
        paths = [
          "db/0-initial-reference.json",
          "db/0-initial.json",
          "diffs/0-initial.json",
        ];
      else {
        const n = Number(id.split(":step-")[1]);
        paths = [
          `http/0-${n}-reference.json`,
          `http/0-${n}.json`,
          `diffs/0-${n}-http.json`,
        ];
        if (i === 1)
          paths.push(
            `db/0-${n}-reference.json`,
            `db/0-${n}.json`,
            `diffs/0-${n}-db.json`,
          );
      }
      check(
        paths.every((p) => gate.evidencePaths.includes(p)),
        "EVIDENCE_ERROR",
      );
    }
  }
  check(
    gates[0].executedTestIds.length === 0 ||
      gates[1].executedTestIds.includes(`${scenario.id}:initial`),
    "EVIDENCE_ERROR",
  );
  check(
    !gates[1].executedTestIds.includes(`${scenario.id}:initial`) ||
      Array.isArray(actual.initialDiffs),
    "EVIDENCE_ERROR",
  );
  check(
    actual.initialDiffs.length === 0 || gates[0].executedTestIds.length === 0,
    "EVIDENCE_ERROR",
  );
  return gates;
}

/** Conjunction of actual per-scenario receipts, not a newly executed Oracle gate.
 * Caller supplies only freshly sealed records from this attempt. */
export function aggregateAttempt({
  attemptId,
  candidateSha,
  pairs,
  errorCode = null,
}) {
  check(
    /^[a-f0-9-]{36}$/.test(attemptId) && /^[a-f0-9]{64}$/.test(candidateSha),
    "EVIDENCE_ERROR",
  );
  check(pairs.length <= MANIFEST.length, "EVIDENCE_ERROR");
  const packIds = new Set();
  for (const [i, p] of pairs.entries()) {
    check(
      p.attemptId === attemptId &&
        p.candidateSha === candidateSha &&
        p.scenarioId === MANIFEST[i].id &&
        /^[a-f0-9-]{36}$/.test(p.pairId),
      "EVIDENCE_ERROR",
    );
    check(
      ["VERIFIED_ZERO_RESOURCES", "CLEANUP_ERROR"].includes(p.cleanup),
      "EVIDENCE_ERROR",
    );
    check(p.gates.length === 0 || p.gates.length === 3, "EVIDENCE_ERROR");
    for (const [index, g] of p.gates.entries()) {
      const name = ["G2", "G3", "G4"][index];
      checkedGate(
        gateResult(
          g.gate,
          g.verdict,
          g.executedTestIds,
          g.findingCodes,
          p.packs.map((pack) => pack.reference),
        ),
        name,
        expectedIds(MANIFEST[i], name),
      );
    }
    if (p.build)
      checkedGate(
        gateResult(
          "G1",
          p.build.verdict,
          p.build.executedTestIds,
          p.build.findingCodes,
          p.packs.map((pack) => pack.reference),
        ),
        "G1",
        [`${p.scenarioId}:typecheck`, `${p.scenarioId}:build`],
      );
    for (const pack of p.packs) {
      check(
        /^oracle-[a-zA-Z0-9_-]+$/.test(pack.id) &&
          /^[a-f0-9]{64}$/.test(pack.sha256) &&
          !packIds.has(pack.id),
        "EVIDENCE_ERROR",
      );
      packIds.add(pack.id);
    }
  }
  const paths = pairs.flatMap((p) => p.packs.map((pack) => pack.reference));
  const fatal = pairs.some((p) => p.cleanup !== "VERIFIED_ZERO_RESOURCES")
    ? "CLEANUP_ERROR"
    : errorCode;
  check(fatal === null || CODES.has(fatal), "EVIDENCE_ERROR");
  const results = [
    gateResult("G0", "INCONCLUSIVE", [], ["G0_NOT_ESTABLISHED"], []),
  ];
  for (const gate of ["G1", "G2", "G3", "G4"]) {
    const entries = pairs
      .map((p) =>
        gate === "G1" ? p.build : p.gates?.find((g) => g.gate === gate),
      )
      .filter(Boolean);
    const ids = entries.flatMap((g, i) =>
      gate === "G4"
        ? g.executedTestIds.map((id) => `${pairs[i].scenarioId}:${id}`)
        : g.executedTestIds,
    );
    const expected = MANIFEST.flatMap((s) =>
      gate === "G1"
        ? [`${s.id}:typecheck`, `${s.id}:build`]
        : gate === "G4"
          ? CONTROL_IDS.map((id) => `${s.id}:${id}`)
          : expectedIds(s, gate),
    );
    check(
      new Set(ids).size === ids.length &&
        ids.every((id) => expected.includes(id)),
      "EVIDENCE_ERROR",
    );
    const codes = entries.flatMap((g) => g.findingCodes);
    const complete = equal(ids, expected) && entries.length === 3;
    let verdict;
    if (fatal || entries.some((g) => g.verdict === "ERROR")) {
      verdict = "ERROR";
      codes.push(fatal ?? "VERIFIER_ERROR");
    } else if (entries.some((g) => g.verdict === "FAIL")) verdict = "FAIL";
    else if (!complete || entries.some((g) => g.verdict !== "PASS")) {
      verdict = "INCONCLUSIVE";
      codes.push(
        gate === "G4"
          ? "HELD_OUT_NOT_RUN"
          : gate === "G1"
            ? "BUILD_NOT_RUN"
            : "MISSING_COVERAGE",
      );
    } else verdict = "PASS";
    if (gate === "G4" && verdict === "PASS") {
      verdict = "INCONCLUSIVE";
      codes.push("HELD_OUT_NOT_RUN");
    }
    results.push(gateResult(gate, verdict, ids, codes, paths));
  }
  const feedbackCodes = [
    ...new Set(
      results
        .filter((g) => g.verdict === "FAIL")
        .flatMap((g) => g.findings.map((f) => f.code)),
    ),
  ];
  // Fixed codes only; never forward raw Oracle findings, samples, SQL or paths.
  const repairFeedback = feedbackCodes.length
    ? feedbackCodes.join(";").slice(0, 512)
    : null;
  return VerificationReportSchema.parse({
    results,
    executedScenarioIds: pairs
      .filter((p) => {
        const s = MANIFEST.find((x) => x.id === p.scenarioId);
        return ["G2", "G3"].every((gate) =>
          equal(
            p.gates?.find((g) => g.gate === gate)?.executedTestIds,
            expectedIds(s, gate),
          ),
        );
      })
      .map((p) => p.scenarioId),
    repairFeedback,
  });
}

export function publicGate(g) {
  const parsed = GateResultSchema.parse(g);
  check(
    parsed.findings.every((f) => CODES.has(f.code)),
    "EVIDENCE_ERROR",
  );
  return {
    gate: parsed.gate,
    verdict: parsed.verdict,
    executedTestIds: [...parsed.executedTestIds],
    findingCodes: [...new Set(parsed.findings.map((f) => f.code))],
  };
}
export function publicAttempt(attempt) {
  const report = aggregateAttempt(attempt);
  return {
    attemptId: attempt.attemptId,
    candidateSha: attempt.candidateSha,
    gates: report.results.map(publicGate),
    coverage: {
      http: report.results.find((g) => g.gate === "G2").executedTestIds.length,
      sqlite: report.results.find((g) => g.gate === "G3").executedTestIds
        .length,
      requiredHttp: 17,
      requiredSqlite: 20,
    },
    pairs: attempt.pairs.map((p) => ({
      scenarioId: p.scenarioId,
      pairId: p.pairId,
      packs: p.packs.map((pack) => ({ id: pack.id, sha256: pack.sha256 })),
      cleanup: p.cleanup,
      targetLifetimeMs: 180000,
      gates:
        p.gates?.map((g) => ({
          gate: g.gate,
          verdict: g.verdict,
          executedTestIds: [...g.executedTestIds],
          findingCodes: [...g.findingCodes],
        })) ?? [],
    })),
  };
}
