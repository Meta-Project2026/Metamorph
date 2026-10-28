// Host orchestration only. Never import candidate source into this process.
import { performance } from "node:perf_hooks";
import {
  mapTargetHttp,
  mapTargetSnapshot,
} from "../../packages/differential/src/mapping.mjs";
import { requireCheck } from "../../packages/differential/src/strict.mjs";
import { compareHttp } from "../../packages/oracle/dist/http.js";
import {
  BOOTSTRAP,
  SOURCE,
} from "../../packages/oracle/dist/reference/manifest.js";
import { compareSqlite } from "../../packages/oracle/dist/sqlite.js";
import {
  requestPolicy,
  WORKSHOP_PROFILE,
} from "../../packages/target-worker/runtime/profile.mjs";
import { sha256 } from "../../packages/target-worker/src/admission.mjs";

export const CASES_SHA =
  "5e3b588003de33d36f37cc2dadc848d0dfebc44fdd2c0a9aaed65e84f240f496";
const errors = new Set([
  "ABORTED",
  "BOOTSTRAP_ERROR",
  "INITIAL_DB_ERROR",
  "COVERAGE_ERROR",
  "CONTROL_ERROR",
  "CLEANUP_ERROR",
  "CLOCK_PARITY_BLOCKED",
  "RUNTIME_MISMATCH",
  "PROVENANCE_MISMATCH",
  "ENVIRONMENT_ERROR",
  "TIMEOUT",
  "CANCELLED",
  "BUILD_FAILED",
  "RUNTIME_FAILED",
  "OBSERVATION_ERROR",
  "ADMISSION_REJECTED",
  "HTTP_WIRE",
  "HTTP_IDENTITY",
  "HTTP_HEADERS",
  "HTTP_BASE64",
  "HTTP_UTF8",
  "DB_WIRE",
  "DB_IDENTITY",
  "DB_FORMAT",
  "DB_LIMIT",
  "DB_SCHEMA_FIELDS",
  "DB_SCHEMA",
  "DB_SCHEMA_ORDER",
  "DB_MISSING_TABLE",
  "DB_TABLE_FIELDS",
  "DB_TABLE",
  "DB_COLUMN_FIELDS",
  "DB_COLUMN",
  "DB_ROW_WIDTH",
  "DB_CELL",
  "DB_CELL_FIELDS",
  "DB_BLOB",
  "WORKER_ABORTED",
  "WORKER_TIMEOUT",
  "DOCKER_UNAVAILABLE",
  "SOURCE_DIGEST",
  "IMAGE_DIGEST",
  "HEAD_IDENTITY",
  "PIN_MISMATCH",
  "CORPUS_HASH",
  "CORPUS_INVALID",
  "POLICY_ERROR",
  "LINUX_REQUIRED",
  "WIRE_JSON",
  "WIRE_DUPLICATE_KEY",
  "WIRE_LIMIT",
  "INSPECTOR_CLOCK",
  "INSPECTOR_VERSION",
  "INSPECTOR_ADMIT",
  "INSPECTOR_SCHEMA",
]);
// Never publish arbitrary exception messages, even uppercase-looking values.
export const errorCode = (error) => {
  const code = error?.code ?? error?.message;
  return errors.has(code) ? code : "DRIVER_ERROR";
};
export function validateCorpus(bytes) {
  requireCheck(sha256(bytes) === CASES_SHA, "CORPUS_HASH");
  const corpus = JSON.parse(bytes);
  requireCheck(
    corpus.designation === "PUBLIC_INDEPENDENT_REPRO" &&
      corpus.cases.length === 14 &&
      corpus.cases[0].id === "public-good-lifecycle",
    "CORPUS_INVALID",
  );
  const ids = new Set();
  let count = 0;
  for (const scenario of corpus.cases) {
    requireCheck(
      /^public-[a-z-]+$/.test(scenario.id) &&
        !ids.has(scenario.id) &&
        scenario.requests.length > 0 &&
        scenario.requests.length <= 8,
      "CORPUS_INVALID",
    );
    ids.add(scenario.id);
    for (const request of scenario.requests) {
      try {
        requireCheck(
          Object.keys(request).every((k) =>
            ["method", "path", "body"].includes(k),
          ),
          "POLICY_ERROR",
        );
        requestPolicy(
          WORKSHOP_PROFILE,
          request.method,
          request.path,
          request.body,
        );
      } catch {
        requireCheck(false, "POLICY_ERROR");
      }
      count++;
    }
  }
  requireCheck(count === 38, "CORPUS_INVALID");
  return corpus;
}
const checkSignal = (signal) => requireCheck(!signal?.aborted, "ABORTED");
// Join each active operation before finally. A late receipt cannot earn coverage.
async function active(signal, fn) {
  checkSignal(signal);
  const result = await fn();
  checkSignal(signal);
  return result;
}
export const digest = (value) => sha256(JSON.stringify(value));
const codes = (diffs) => [...new Set(diffs.map((d) => d.code))];
const comparison = (diffs, left, right) => ({
  status: diffs.length ? "FAIL" : "PASS",
  codes: codes(diffs),
  referenceSha256: digest(left),
  candidateSha256: digest(right),
});
export const blankCase = (scenario) => ({
  scenarioId: scenario.id,
  status: "NOT_RUN",
  bootstrap: "NOT_RUN",
  g1: "NOT_RUN",
  initial: { status: "NOT_RUN" },
  steps: scenario.requests.map((_, i) => ({
    stepId: `step-${i + 1}`,
    http: { status: "NOT_RUN" },
    db: { status: "NOT_RUN" },
  })),
  executedHttp: 0,
  executedSqlite: 0,
  firstDifference: null,
  normalCleanup: "NOT_RUN",
  emergencyRemoved: 0,
  inventory: null,
  durationMs: 0,
});
export function verifyCoverage(scenario, receipt) {
  requireCheck(
    receipt.scenarioId === scenario.id &&
      receipt.bootstrap === "PASS" &&
      receipt.g1 === "PASS" &&
      receipt.initial.status === "PASS" &&
      receipt.steps.length === scenario.requests.length &&
      receipt.executedHttp === scenario.requests.length &&
      receipt.executedSqlite === scenario.requests.length + 1 &&
      receipt.steps.every(
        (s, i) =>
          s.stepId === `step-${i + 1}` &&
          ["PASS", "FAIL"].includes(s.http.status) &&
          ["PASS", "FAIL"].includes(s.db.status),
      ),
    "COVERAGE_ERROR",
  );
}
export async function runCase(scenario, pair, signal, record = () => {}) {
  const receipt = blankCase(scenario);
  const start = performance.now();
  const mismatch = (kind, stepId, result) => {
    if (result.status === "FAIL" && !receipt.firstDifference)
      receipt.firstDifference = { kind, stepId, codes: result.codes };
  };
  try {
    // Validate the complete schedule before either side receives a request.
    for (const r of scenario.requests) {
      try {
        requestPolicy(WORKSHOP_PROFILE, r.method, r.path, r.body);
      } catch {
        requireCheck(false, "POLICY_ERROR");
      }
    }
    await active(signal, () => pair.php.reset(signal));
    const boot = await active(signal, () => pair.php.http(BOOTSTRAP, signal));
    requireCheck(boot.observation.status === 200, "BOOTSTRAP_ERROR");
    record("bootstrap-http", boot);
    const initialPhp = await active(signal, () => pair.php.inspect(signal));
    requireCheck(
      initialPhp.legacySha256 === SOURCE.initialSha256,
      "BOOTSTRAP_ERROR",
    );
    receipt.bootstrap = "PASS";
    if (initialPhp.raw?.runtime) {
      const r = initialPhp.raw.runtime;
      receipt.referenceRuntime = {
        php: r.php,
        sqlite: r.sqlite,
        fixedUtc: r.phpUtc,
        monotonicMs: r.monotonicMs,
        clockLibrarySha256: r.clockLibrarySha256,
      };
    }
    const identity = await active(signal, () => pair.target.provision(signal));
    receipt.targetClock = await active(signal, () => pair.clock(signal));
    receipt.g1 = "PASS";
    const rawInitial = await active(signal, () =>
      pair.target.snapshot("initial", signal),
    );
    const targetIdentity = pair.identity(identity);
    const initialTarget = mapTargetSnapshot(
      rawInitial,
      targetIdentity,
      "initial",
    );
    receipt.initial = comparison(
      compareSqlite(initialPhp.snapshot, initialTarget),
      initialPhp.snapshot,
      initialTarget,
    );
    receipt.executedSqlite++;
    record("initial", {
      php: initialPhp,
      target: rawInitial,
      mappedTarget: initialTarget,
    });
    requireCheck(receipt.initial.status === "PASS", "INITIAL_DB_ERROR");
    for (const [i, request] of scenario.requests.entries()) {
      const step = receipt.steps[i],
        id = step.stepId;
      const php = await active(signal, () => pair.php.http(request, signal));
      const raw = await active(signal, () =>
        pair.target.request(
          id,
          request.method,
          request.path,
          request.body,
          signal,
        ),
      );
      const target = mapTargetHttp(raw, id, raw.requestId);
      step.http = comparison(
        compareHttp(php.observation, target),
        php.observation,
        target,
      );
      receipt.executedHttp++;
      mismatch("HTTP", id, step.http);
      record(`http-${id}`, {
        request,
        php,
        rawTarget: raw,
        mappedTarget: target,
      });
      if (scenario.id === "public-good-lifecycle" && i === 0) {
        requireCheck(step.http.status === "PASS", "CONTROL_ERROR");
        const mutated = { ...php.observation, status: 503 };
        const negative = compareHttp(php.observation, mutated);
        requireCheck(
          negative.some((d) => d.code === "HTTP_STATUS"),
          "CONTROL_ERROR",
        );
        receipt.negativeControl = { status: "PASS", codes: codes(negative) };
      }
      const dbPhp = await active(signal, () => pair.php.inspect(signal));
      const dbRaw = await active(signal, () =>
        pair.target.snapshot(id, signal),
      );
      const dbTarget = mapTargetSnapshot(dbRaw, targetIdentity, id);
      step.db = comparison(
        compareSqlite(dbPhp.snapshot, dbTarget),
        dbPhp.snapshot,
        dbTarget,
      );
      receipt.executedSqlite++;
      mismatch("SQLITE", id, step.db);
      record(`db-${id}`, {
        php: dbPhp,
        rawTarget: dbRaw,
        mappedTarget: dbTarget,
      });
    }
    verifyCoverage(scenario, receipt);
    receipt.status = receipt.firstDifference ? "FAIL" : "PASS";
  } catch (error) {
    receipt.status = "ERROR";
    receipt.errorCode = errorCode(error);
    record("error", { code: receipt.errorCode });
  } finally {
    // No work signal here: normal cleanup has its own existing bounded grace.
    const closed = await Promise.allSettled([
      pair.php.close(),
      pair.target.close(),
    ]);
    receipt.normalCleanup =
      closed.every((r) => r.status === "fulfilled") && pair.cleanupVerified()
        ? "PASS"
        : "ERROR";
    try {
      const before = await pair.resources.inventory();
      if (before.containers.length || before.volumes.length) {
        receipt.emergencyRemoved =
          before.containers.length + before.volumes.length;
        await pair.resources.reap();
      }
      const inventory = await pair.resources.inventory();
      receipt.inventory = {
        containers: inventory.containers.length,
        volumes: inventory.volumes.length,
      };
      requireCheck(
        !receipt.emergencyRemoved &&
          !inventory.containers.length &&
          !inventory.volumes.length &&
          receipt.normalCleanup === "PASS",
        "CLEANUP_ERROR",
      );
    } catch {
      receipt.status = "ERROR";
      receipt.errorCode = "CLEANUP_ERROR";
    }
    receipt.durationMs = Math.round(performance.now() - start);
    record("case-receipt", receipt);
  }
  return receipt;
}
export async function runSchedule(
  corpus,
  createPair,
  signal,
  record = () => {},
) {
  const results = [];
  let stopped = false;
  for (const scenario of corpus.cases) {
    if (stopped || signal?.aborted) {
      results.push(blankCase(scenario));
      continue;
    }
    let receipt;
    try {
      const pair = await createPair(scenario);
      receipt = await runCase(scenario, pair, signal, (kind, value) =>
        record(scenario.id, kind, value),
      );
    } catch (error) {
      receipt = {
        ...blankCase(scenario),
        status: "ERROR",
        errorCode: errorCode(error),
      };
    }
    results.push(receipt);
    if (
      receipt.status === "ERROR" ||
      (scenario.id === "public-good-lifecycle" && receipt.status !== "PASS")
    )
      stopped = true;
  }
  return results;
}
export function summarize(corpus, results) {
  const positive = results.find(
    (r) => r.scenarioId === "public-good-lifecycle",
  );
  let valid = results.length === corpus.cases.length;
  try {
    for (const [i, s] of corpus.cases.entries()) verifyCoverage(s, results[i]);
  } catch {
    valid = false;
  }
  const controls = {
    positive:
      positive?.status === "PASS"
        ? "PASS"
        : positive?.status === "NOT_RUN"
          ? "NOT_RUN"
          : "ERROR",
    negative: positive?.negativeControl?.status ?? "NOT_RUN",
  };
  valid &&=
    controls.positive === "PASS" &&
    controls.negative === "PASS" &&
    results.every(
      (r) =>
        ["PASS", "FAIL"].includes(r.status) &&
        r.normalCleanup === "PASS" &&
        !r.emergencyRemoved &&
        r.inventory?.containers === 0 &&
        r.inventory?.volumes === 0,
    );
  return {
    classification: "NOT_ESTABLISHED",
    classificationReview: "INDEPENDENT_PUBLIC_EVIDENCE_REVIEW_REQUIRED",
    harness: valid ? "SUCCESS" : "ERROR",
    parity: valid
      ? results.some((r) => r.status === "FAIL")
        ? "FAIL"
        : "PASS"
      : "INCONCLUSIVE",
    controls,
    coverage: {
      plannedPairs: 14,
      plannedHttp: 38,
      plannedSqlite: 52,
      completedPairs: results.filter((r) => ["PASS", "FAIL"].includes(r.status))
        .length,
      http: results.reduce((n, r) => n + r.executedHttp, 0),
      sqlite: results.reduce((n, r) => n + r.executedSqlite, 0),
    },
    gates: {
      G0: "INCONCLUSIVE",
      G1: valid ? "PASS" : "NOT_RUN_OR_PARTIAL",
      G2: valid
        ? results.some((r) => r.steps.some((s) => s.http.status === "FAIL"))
          ? "FAIL"
          : "PASS"
        : "INCONCLUSIVE",
      G3: valid
        ? results.some((r) => r.steps.some((s) => s.db.status === "FAIL"))
          ? "FAIL"
          : "PASS"
        : "INCONCLUSIVE",
      G4: "INCONCLUSIVE",
    },
    product: "NOT_ESTABLISHED",
    privateAudit: "UNCHANGED",
    cases: results,
  };
}
