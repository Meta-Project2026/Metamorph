import { PINS } from "./pins.mjs";

export const MAX_BYTES = 96 * 1024;
export const RECEIPT_NAMES = Object.freeze(Object.keys(PINS.files));
const STATUSES = ["PASS", "FAIL", "ERROR", "INCONCLUSIVE", "NOT_RUN"];
const GATES = ["G0", "G1", "G2", "G3", "G4"];
const STEP_COUNTS = {
  "workshop-business": 6,
  "workshop-rejected": 5,
  "workshop-capacity": 6,
};
const HTTP_IDS = Object.entries(STEP_COUNTS).flatMap(([id, n]) =>
  Array.from({ length: n }, (_, i) => `${id}:step-${i}`),
);
const SQLITE_IDS = [
  ...Object.keys(STEP_COUNTS).map((id) => `${id}:initial`),
  ...HTTP_IDS,
];

function requireThat(condition, code) {
  if (!condition) throw new Error(code);
}

const BASE_PUBLIC_FIELDS = [
  "inputTokens",
  "outputTokens",
  "cachedInputTokens",
  "budgetAuthorization",
];

// A bounded JSON parser: duplicate keys, unsafe numbers and prototype keys fail closed.
// Errors contain fixed codes only, never receipt content or local paths.
// extraPublicFields may allowlist additional producer fact-field names that match the
// secret-like key pattern without being credentials; defaults keep A/B behavior unchanged.
export function parseStrict(bytes, extraPublicFields = []) {
  requireThat(
    Array.isArray(extraPublicFields) &&
      extraPublicFields.every((field) => typeof field === "string"),
    "INVALID_PUBLIC_FIELDS",
  );
  const publicFields = [...BASE_PUBLIC_FIELDS, ...extraPublicFields];
  requireThat(
    bytes instanceof Uint8Array && bytes.byteLength <= MAX_BYTES,
    "SIZE_LIMIT",
  );
  let input;
  try {
    input = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("INVALID_UTF8");
  }
  let at = 0;
  let nodes = 0;
  const whitespace = () => {
    while (/[\x20\t\r\n]/.test(input[at] ?? "x")) at++;
  };
  function string() {
    const start = at++;
    while (at < input.length) {
      if (input[at] === "\\") {
        at += 2;
        continue;
      }
      if (input[at++] === '"') {
        let value;
        try {
          value = JSON.parse(input.slice(start, at));
        } catch {
          throw new Error("MALFORMED_JSON");
        }
        requireThat(value.length <= 1024, "STRING_LIMIT");
        return value;
      }
    }
    throw new Error("MALFORMED_JSON");
  }
  function value(depth) {
    requireThat(depth <= 16 && ++nodes <= 10000, "STRUCTURE_LIMIT");
    whitespace();
    const char = input[at];
    if (char === '"') return string();
    if (char === "{" || char === "[") {
      at++;
      const object = char === "{";
      const result = object ? Object.create(null) : [];
      const end = object ? "}" : "]";
      whitespace();
      if (input[at] === end) {
        at++;
        return result;
      }
      while (at < input.length) {
        whitespace();
        if (object) {
          requireThat(input[at] === '"', "MALFORMED_JSON");
          const key = string();
          requireThat(
            !["__proto__", "constructor", "prototype"].includes(key),
            "UNSAFE_KEY",
          );
          requireThat(
            publicFields.includes(key) ||
              !/(secret|token|password|api.?key|private|authorization|cookie|credential)/i.test(
                key,
              ),
            "PRIVATE_FIELD",
          );
          requireThat(!Object.hasOwn(result, key), "DUPLICATE_KEY");
          whitespace();
          requireThat(input[at++] === ":", "MALFORMED_JSON");
          result[key] = value(depth + 1);
        } else result.push(value(depth + 1));
        whitespace();
        if (input[at] === end) {
          at++;
          return result;
        }
        requireThat(input[at++] === ",", "MALFORMED_JSON");
      }
      throw new Error("MALFORMED_JSON");
    }
    for (const [word, result] of [
      ["true", true],
      ["false", false],
      ["null", null],
    ]) {
      if (input.startsWith(word, at)) {
        at += word.length;
        return result;
      }
    }
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(
      input.slice(at),
    );
    requireThat(match !== null, "MALFORMED_JSON");
    at += match[0].length;
    const number = Number(match[0]);
    requireThat(
      Number.isFinite(number) && Math.abs(number) <= Number.MAX_SAFE_INTEGER,
      "UNSAFE_NUMBER",
    );
    return number;
  }
  const result = value(0);
  whitespace();
  requireThat(
    at === input.length &&
      result !== null &&
      !Array.isArray(result) &&
      typeof result === "object",
    "MALFORMED_JSON",
  );
  return result;
}

function exactKeys(value, keys) {
  requireThat(
    value !== null && typeof value === "object" && !Array.isArray(value),
    "MISSING_FIELDS",
  );
  requireThat(
    Object.keys(value).length === keys.length &&
      keys.every((key) => Object.hasOwn(value, key)),
    "UNKNOWN_OR_MISSING_FIELDS",
  );
}

function checkIds(actual, expected) {
  requireThat(
    Array.isArray(actual) &&
      actual.length === expected.length &&
      new Set(actual).size === actual.length &&
      actual.every((id) => expected.includes(id)),
    "COVERAGE_MISMATCH",
  );
}

async function sha256(bytes) {
  return Array.from(
    new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}

export async function readPinned(name, bytes) {
  requireThat(Object.hasOwn(PINS.files, name), "FILE_NOT_ALLOWLISTED");
  const receipt = parseStrict(bytes);
  const pin = PINS.files[name];
  requireThat(
    bytes.byteLength === pin.bytes && (await sha256(bytes)) === pin.sha256,
    "PIN_MISMATCH",
  );
  // A matching hash establishes identity with this reviewed public snapshot, not a new execution.
  return receipt;
}

export async function readBundle(files) {
  requireThat(
    Array.isArray(files) && files.length === RECEIPT_NAMES.length,
    "INCOMPLETE_BUNDLE",
  );
  checkIds(
    files.map((file) => file.name),
    RECEIPT_NAMES,
  );
  const entries = await Promise.all(
    files.map(async (file) => [
      file.name,
      await readPinned(file.name, file.bytes),
    ]),
  );
  const receipts = Object.fromEntries(entries);
  const model = receipts["trial.json"];
  const controls = receipts["summary.json"];
  const finalizer = receipts["finalizer.json"];
  const inventory = receipts["inventory.json"];
  const index = receipts["evidence-index.json"];
  requireThat(
    [
      model.headSha,
      controls.headSha,
      finalizer.headSha,
      index.implementationHeadSha,
    ].every((sha) => sha === PINS.headSha),
    "HEAD_MISMATCH",
  );
  requireThat(
    [
      model.sourceSha,
      controls.source.commit,
      inventory.commit,
      index.sourceSha,
    ].every((sha) => sha === PINS.sourceSha),
    "SOURCE_MISMATCH",
  );
  requireThat(
    model.modelGeneration === "NOT_RUN" &&
      model.aiGeneration === "AI_GENERATION_NOT_RUN" &&
      model.generatedRequests === 0 &&
      model.candidateSha === null &&
      model.totalCostUsd === null,
    "MODEL_LABEL_MISMATCH",
  );
  requireThat(
    inventory.apiActionCount === 5 &&
      inventory.apiActions.length === 5 &&
      inventory.phpFunctionUnits.length === 11,
    "SCOPE_MISMATCH",
  );
  const attempts = controls.runs.flatMap((run) =>
    run.attempts.map((attempt, i) => {
      requireThat(
        run.billing === "synthetic" && run.paidCalls === 0,
        "REPLAY_LABEL_MISMATCH",
      );
      checkIds(
        attempt.gates.map((g) => g.gate),
        GATES,
      );
      for (const gate of attempt.gates)
        requireThat(STATUSES.includes(gate.verdict), "UNKNOWN_STATUS");
      checkIds(
        attempt.gates.find((g) => g.gate === "G2").executedTestIds,
        HTTP_IDS,
      );
      checkIds(
        attempt.gates.find((g) => g.gate === "G3").executedTestIds,
        SQLITE_IDS,
      );
      requireThat(
        attempt.coverage.http === 17 &&
          attempt.coverage.sqlite === 20 &&
          attempt.coverage.requiredHttp === 17 &&
          attempt.coverage.requiredSqlite === 20,
        "COVERAGE_MISMATCH",
      );
      return {
        label:
          run.mode === "known-good"
            ? "Known-good replay"
            : i === 0
              ? "Deliberate mutation"
              : "Scripted repair",
        candidateSha: attempt.candidateSha,
        gates: attempt.gates,
        coverage: attempt.coverage,
      };
    }),
  );
  return {
    verification: "PINNED_PUBLIC_SNAPSHOT",
    model: {
      label: "MODEL_GENERATION_NOT_RUN",
      receiptLabel: model.aiGeneration,
      requests: model.generatedRequests,
      candidateSha: model.candidateSha,
      costUsd: model.totalCostUsd,
      gates: {
        G0: model.G0,
        G1: model.publicG1,
        G2: model.publicG2,
        G3: model.publicG3,
        G4: model.G4,
      },
      cleanup: model.cleanup,
    },
    replay: {
      label: "DETERMINISTIC_REPLAY_NOT_AI",
      status: controls.status,
      attempts,
      runtimeControls: controls.runtimeControls,
      cleanup: controls.completion,
      finalizer,
    },
    source: {
      repository: inventory.repository,
      sha: inventory.commit,
      actions: inventory.apiActions,
      functions: inventory.phpFunctionUnits.length,
      phpPhysicalLines: inventory.phpMetrics.reduce(
        (n, item) => n + item.physicalFileLines,
        0,
      ),
      phpRegionLines: inventory.phpMetrics.reduce(
        (n, item) => n + item.nonblankPhpRegionLinesIncludingComments,
        0,
      ),
      scope: inventory.scope,
    },
    product: "NOT_ESTABLISHED",
    receipts,
  };
}

// Preview envelope, not an upstream producer contract or authentication protocol.
// New receipts cannot enter the pinned historical track through this path.
export function readFuture(name, bytes) {
  requireThat(name === "future-model.json", "FILE_NOT_ALLOWLISTED");
  const r = parseStrict(bytes);
  exactKeys(r, [
    "format",
    "kind",
    "headSha",
    "sourceSha",
    "candidateSha",
    "runId",
    "provider",
    "modelId",
    "generatedRequests",
    "totalCostUsd",
    "outcome",
    "gates",
    "coverage",
    "product",
  ]);
  requireThat(
    r.format === "mmp071-model-preview-v1" &&
      r.kind === "REAL_MODEL_GENERATION",
    "UNKNOWN_FORMAT",
  );
  requireThat(
    r.headSha === PINS.headSha && r.sourceSha === PINS.sourceSha,
    "EXPECTED_SHA_MISMATCH",
  );
  requireThat(
    typeof r.candidateSha === "string" && /^[a-f0-9]{64}$/.test(r.candidateSha),
    "CANDIDATE_ID_REQUIRED",
  );
  requireThat(
    typeof r.runId === "string" && /^[1-9]\d{0,19}$/.test(r.runId),
    "RUN_ID_REQUIRED",
  );
  for (const field of ["provider", "modelId"])
    requireThat(
      typeof r[field] === "string" &&
        /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/.test(r[field]),
      "MODEL_ID_REQUIRED",
    );
  requireThat(
    Number.isSafeInteger(r.generatedRequests) && r.generatedRequests > 0,
    "REQUESTS_REQUIRED",
  );
  requireThat(
    r.totalCostUsd === null ||
      (typeof r.totalCostUsd === "number" && r.totalCostUsd >= 0),
    "INVALID_COST",
  );
  requireThat(
    STATUSES.includes(r.outcome) && r.outcome !== "NOT_RUN",
    "UNKNOWN_STATUS",
  );
  exactKeys(r.gates, GATES);
  for (const status of Object.values(r.gates))
    requireThat(STATUSES.includes(status), "UNKNOWN_STATUS");
  if (r.outcome === "PASS")
    requireThat(
      ["G1", "G2", "G3"].every((gate) => r.gates[gate] === "PASS"),
      "INCONSISTENT_PASS",
    );
  requireThat(r.product === "NOT_ESTABLISHED", "PRODUCT_PASS_FORBIDDEN");
  if (r.coverage !== null) {
    exactKeys(r.coverage, ["httpIds", "sqliteIds"]);
    for (const [key, ids] of [
      ["httpIds", HTTP_IDS],
      ["sqliteIds", SQLITE_IDS],
    ]) {
      const values = r.coverage[key];
      requireThat(
        Array.isArray(values) &&
          values.length <= ids.length &&
          new Set(values).size === values.length &&
          values.every((id) => ids.includes(id)),
        "COVERAGE_MISMATCH",
      );
    }
    if (r.gates.G2 === "PASS") checkIds(r.coverage.httpIds, HTTP_IDS);
    if (r.gates.G3 === "PASS") checkIds(r.coverage.sqliteIds, SQLITE_IDS);
  } else
    requireThat(
      r.gates.G2 !== "PASS" && r.gates.G3 !== "PASS",
      "PASS_WITHOUT_COVERAGE",
    );
  return {
    verification: "NOT_VERIFIED",
    label: "REAL_MODEL_GENERATION — DECLARED ONLY",
    receipt: r,
    product: "NOT_ESTABLISHED",
  };
}
