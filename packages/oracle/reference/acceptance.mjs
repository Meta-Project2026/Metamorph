// Trusted structural contract. Raw business observations remain inside private packs.
import { compareHttp, compareSqlite } from "../dist/index.js";
import {
  ensure,
  MANIFEST,
  MANIFEST_SHA256,
  SOURCE,
  sha256,
  stepId,
} from "../dist/reference/manifest.js";
import { validateSnapshot } from "../dist/sqlite.js";

export const VERSION = "workshop-reference-corpus-v1";
export const TABLES = Object.freeze({
  appointments: [
    "id",
    "client_name",
    "address",
    "phone",
    "car_license",
    "car_engine",
    "appointment_date",
    "mechanic_id",
    "status",
    "created_at",
  ],
  mechanics: [
    "id",
    "name",
    "specialty",
    "phone",
    "max_daily_slots",
    "created_at",
  ],
  sqlite_sequence: ["name", "seq"],
});
const FIELDS = new Set([
  ...Object.values(TABLES).flat(),
  "success",
  "message",
  "appointment_id",
  "appointments",
  "mechanics",
  "mechanic_name",
  "mechanic_specialty",
  "date",
  "error_type",
  "booked_count",
  "available_slots",
  "is_full",
]);
export const digest = (value) => sha256(JSON.stringify(value));
export function keys(value, names) {
  ensure(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).sort().join(",") === [...names].sort().join(","),
    "CORPUS_FIELDS",
  );
}
export function shape(value, depth = 0) {
  ensure(depth < 8, "CORPUS_SHAPE");
  if (value === null) return "null";
  if (Array.isArray(value)) {
    ensure(value.length <= 20, "CORPUS_SHAPE");
    return {
      array: [
        ...new Map(
          value.map((v) => {
            const s = shape(v, depth + 1);
            return [JSON.stringify(s), s];
          }),
        ).values(),
      ],
    };
  }
  if (typeof value === "object") {
    ensure(
      Object.keys(value).every((k) => FIELDS.has(k)),
      "CORPUS_FIELD_NAME",
    );
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, shape(value[k], depth + 1)]),
    );
  }
  ensure(
    ["string", "number", "boolean"].includes(typeof value),
    "CORPUS_SHAPE",
  );
  if (typeof value === "number") ensure(Number.isFinite(value), "CORPUS_SHAPE");
  return typeof value;
}
export function jsonBody(http) {
  // Existing comparator rejects invalid UTF8, JSON, duplicate keys and precision loss.
  ensure(compareHttp(http, http).length === 0, "HTTP_SELF_INVALID");
  return JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(http.body),
  );
}
export function rows(snapshot, name) {
  const t = snapshot.tables.find((v) => v.name === name);
  ensure(t, "CONTRACT_TABLE");
  return t.rows.map((r) =>
    Object.fromEntries(t.columns.map((c, i) => [c, r[i].value ?? null])),
  );
}
export function describeDb(snapshot) {
  validateSnapshot(snapshot);
  ensure(snapshot.tables.length === 3, "CONTRACT_TABLE");
  return snapshot.tables.map((t) => {
    ensure(
      TABLES[t.name] &&
        JSON.stringify(t.columns) === JSON.stringify(TABLES[t.name]),
      "CONTRACT_COLUMNS",
    );
    return {
      name: t.name,
      columns: [...t.columns],
      primaryKey: [...t.primaryKey],
      rows: t.rows.length,
      cellTypes: [...new Set(t.rows.flat().map((c) => c.type))].sort(),
    };
  });
}
export function httpDigest(http) {
  return digest({
    status: http.status,
    headers: http.headers,
    bodyBase64: Buffer.from(http.body).toString("base64"),
  });
}
export function assertRepeat(a, b) {
  ensure(
    compareSqlite(a.before, b.before).length === 0 &&
      compareSqlite(a.after, b.after).length === 0,
    "REPLAY_DATABASE",
  );
  ensure(
    compareHttp(a.http, b.http).length === 0 &&
      httpDigest(a.http) === httpDigest(b.http),
    "REPLAY_HTTP",
  );
}
export function observe(scenario, index, http, before, after) {
  const json = jsonBody(http);
  const request = scenario.requests[index];
  const a = rows(before, "appointments");
  const b = rows(after, "appointments");
  const rejected =
    (scenario.id === "workshop-rejected" && [1, 3].includes(index)) ||
    (scenario.id === "workshop-capacity" && index === 4);
  ensure(
    http.status === 200 &&
      http.headers["content-type"] === "application/json; charset=utf-8",
    "CONTRACT_HTTP",
  );
  ensure(Object.keys(http.headers).length === 1, "CONTRACT_HEADERS");
  ensure(json.success === !rejected, "CONTRACT_SUCCESS");
  if (request.method === "GET" || rejected)
    ensure(
      compareSqlite(before, after).length === 0,
      "READ_OR_REJECTION_CHANGED_STATE",
    );
  if (scenario.id === "workshop-business") {
    ensure(b.length === (index >= 4 ? 0 : 1), "CONTRACT_ROW_COUNT");
    if (index === 0) {
      const form = Object.fromEntries(new URLSearchParams(request.body));
      ensure(
        Object.entries(form).every(([k, v]) => String(b[0][k]) === v),
        "CONTRACT_BOOK_FIELDS",
      );
      ensure(
        b[0].status === "approved" && String(json.appointment_id) === b[0].id,
        "CONTRACT_BOOK_ID",
      );
    }
    if (index === 2) {
      const expected = {
        ...a[0],
        ...Object.fromEntries(new URLSearchParams(request.body)),
      };
      ensure(
        JSON.stringify(b[0]) === JSON.stringify(expected),
        "CONTRACT_UPDATE",
      );
    }
    if (request.method === "GET") {
      ensure(
        Array.isArray(json.appointments) &&
          json.appointments.length === b.length,
        "CONTRACT_LIST",
      );
      for (const item of json.appointments) {
        const row = b.find((r) => Number(r.id) === Number(item.id));
        ensure(
          row &&
            Object.entries(row).every(
              ([k, v]) => String(item[k]) === String(v),
            ),
          "CONTRACT_LIST_VALUES",
        );
        const mechanic = rows(after, "mechanics").find(
          (m) => Number(m.id) === Number(item.mechanic_id),
        );
        ensure(
          item.mechanic_name === mechanic.name &&
            item.mechanic_specialty === mechanic.specialty,
          "CONTRACT_JOIN",
        );
      }
    }
  }
  if (scenario.id === "workshop-rejected") {
    ensure(b.length === 1, "CONTRACT_ROW_COUNT");
    if (index === 1)
      ensure(json.error_type === "DUPLICATE_CLIENT", "CONTRACT_DUPLICATE");
    if (index === 3)
      ensure(
        typeof json.message === "string" && !Object.hasOwn(json, "error_type"),
        "CONTRACT_EMPTY_FORM",
      );
    if (request.method === "GET")
      ensure(json.appointments.length === 1, "CONTRACT_LIST");
  }
  if (scenario.id === "workshop-capacity") {
    ensure(b.length === Math.min(index + 1, 4), "CONTRACT_ROW_COUNT");
    if (index === 4)
      ensure(json.error_type === "MECHANIC_FULL", "CONTRACT_CAPACITY");
    if (index === 5) {
      ensure(
        json.mechanics.length === 5 &&
          json.mechanics.every(
            (m, i) =>
              m.id === i + 1 &&
              m.max_daily_slots === 4 &&
              m.booked_count === (i === 0 ? 4 : 0) &&
              m.available_slots === (i === 0 ? 0 : 4) &&
              m.is_full === (i === 0),
          ),
        "CONTRACT_SLOTS",
      );
    }
  }
  const seq = rows(after, "sqlite_sequence");
  ensure(
    seq.find((v) => v.name === "mechanics")?.seq === "5",
    "CONTRACT_SEQUENCE",
  );
  ensure(
    seq.find((v) => v.name === "appointments")?.seq ===
      String(scenario.id === "workshop-capacity" ? Math.min(index + 1, 4) : 1),
    "CONTRACT_SEQUENCE",
  );
  for (const t of ["appointments", "mechanics"])
    ensure(
      rows(after, t).every((v) => v.created_at === SOURCE.clock),
      "CLOCK_PARITY_BLOCKED",
    );
  ensure(
    digest(before.schema) === digest(after.schema),
    "CONTRACT_SCHEMA_CHANGED",
  );
  return {
    scenarioId: scenario.id,
    stepId: stepId(index),
    requestSha256: digest(request),
    status: http.status,
    contentType: http.headers["content-type"],
    responseShape: shape(json),
    outcome: rejected ? "REJECTED" : "SUCCESS",
    httpSha256: httpDigest(http),
    beforeSha256: digest(before),
    afterSha256: digest(after),
    database: describeDb(after),
  };
}

// Rebuild every field; never copy arbitrary worker/public input into an artifact.
export function publicCorpus(input) {
  keys(input, [
    "headSha",
    "imageId",
    "packSha256",
    "passes",
    "controls",
    "inventory",
    "sourceFiles",
  ]);
  ensure(
    /^[a-f0-9]{40}$/.test(input.headSha) &&
      /^sha256:[a-f0-9]{64}$/.test(input.imageId),
    "CORPUS_HASH",
  );
  ensure(
    input.packSha256.length === 3 &&
      input.packSha256.every((s) => /^[a-f0-9]{64}$/.test(s)),
    "CORPUS_HASH",
  );
  keys(input.inventory, ["containers", "volumes"]);
  ensure(
    input.inventory.containers === 0 && input.inventory.volumes === 0,
    "CLEANUP_ERROR",
  );
  keys(input.sourceFiles, ["apiPhpSha256", "configPhpSha256"]);
  ensure(
    input.sourceFiles.apiPhpSha256 ===
      "7d66dc6ad489972a00c6b93619c13024ea3f6d577206579bc2e97f58cf74fd77" &&
      input.sourceFiles.configPhpSha256 ===
        "11216d306900f8a2e304908cebab52b9375cba83c1ead99a90278ec14b2c21bd",
    "SOURCE_DIGEST",
  );
  ensure(input.passes.length === 2, "CORPUS_COVERAGE");
  const passes = input.passes.map((pass, p) => {
    keys(pass, ["pass", "scenarios"]);
    ensure(
      pass.pass === p + 1 && pass.scenarios.length === 3,
      "CORPUS_COVERAGE",
    );
    return {
      pass: p + 1,
      scenarios: pass.scenarios.map((s, si) => {
        keys(s, [
          "scenarioId",
          "initialSha256",
          "initialDatabase",
          "bootstrapSha256",
          "steps",
        ]);
        ensure(
          s.scenarioId === MANIFEST[si].id &&
            s.steps.length === MANIFEST[si].requests.length,
          "CORPUS_COVERAGE",
        );
        for (const h of [s.initialSha256, s.bootstrapSha256])
          ensure(/^[a-f0-9]{64}$/.test(h), "CORPUS_HASH");
        const database = (db) => {
          ensure(Array.isArray(db) && db.length === 3, "CORPUS_DATABASE");
          return db.map((t, i) => {
            keys(t, ["name", "columns", "primaryKey", "rows", "cellTypes"]);
            const name = Object.keys(TABLES)[i];
            ensure(
              t.name === name &&
                JSON.stringify(t.columns) === JSON.stringify(TABLES[name]) &&
                JSON.stringify(t.primaryKey) ===
                  JSON.stringify(name === "sqlite_sequence" ? [] : [0]) &&
                Number.isInteger(t.rows) &&
                t.rows >= 0 &&
                t.rows <= 5 &&
                Array.isArray(t.cellTypes) &&
                t.cellTypes.every((v) => ["integer", "text"].includes(v)),
              "CORPUS_DATABASE",
            );
            return {
              name,
              columns: [...TABLES[name]],
              primaryKey: [...t.primaryKey],
              rows: t.rows,
              cellTypes: [...t.cellTypes],
            };
          });
        };
        const checkShape = (value, depth = 0) => {
          ensure(depth < 8, "CORPUS_SHAPE");
          if (typeof value === "string") {
            ensure(
              ["number", "string", "boolean", "null"].includes(value),
              "CORPUS_SHAPE",
            );
            return value;
          }
          ensure(
            value && typeof value === "object" && !Array.isArray(value),
            "CORPUS_SHAPE",
          );
          if (Object.hasOwn(value, "array")) {
            keys(value, ["array"]);
            ensure(
              Array.isArray(value.array) && value.array.length <= 5,
              "CORPUS_SHAPE",
            );
            return { array: value.array.map((v) => checkShape(v, depth + 1)) };
          }
          ensure(
            Object.keys(value).every((k) => FIELDS.has(k)),
            "CORPUS_FIELD_NAME",
          );
          return Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((k) => [k, checkShape(value[k], depth + 1)]),
          );
        };
        return {
          scenarioId: MANIFEST[si].id,
          initialSha256: s.initialSha256,
          initialDatabase: database(s.initialDatabase),
          bootstrapSha256: s.bootstrapSha256,
          steps: s.steps.map((v, index) => {
            keys(v, [
              "scenarioId",
              "stepId",
              "requestSha256",
              "status",
              "contentType",
              "responseShape",
              "outcome",
              "httpSha256",
              "beforeSha256",
              "afterSha256",
              "database",
            ]);
            ensure(
              v.scenarioId === s.scenarioId &&
                v.stepId === stepId(index) &&
                v.requestSha256 === digest(MANIFEST[si].requests[index]) &&
                v.status === 200 &&
                v.contentType === "application/json; charset=utf-8" &&
                ["SUCCESS", "REJECTED"].includes(v.outcome),
              "CORPUS_STEP",
            );
            for (const h of [v.httpSha256, v.beforeSha256, v.afterSha256])
              ensure(/^[a-f0-9]{64}$/.test(h), "CORPUS_HASH");
            return {
              scenarioId: s.scenarioId,
              stepId: stepId(index),
              requestSha256: v.requestSha256,
              status: v.status,
              contentType: v.contentType,
              responseShape: checkShape(v.responseShape),
              outcome: v.outcome,
              httpSha256: v.httpSha256,
              beforeSha256: v.beforeSha256,
              afterSha256: v.afterSha256,
              database: database(v.database),
            };
          }),
        };
      }),
    };
  });
  return {
    format: VERSION,
    headSha: input.headSha,
    source: SOURCE,
    sourceFiles: { ...input.sourceFiles },
    manifestSha256: MANIFEST_SHA256,
    imageId: input.imageId,
    clock: "VERIFIED_FIXED_UTC_REAL_MONOTONIC",
    attempts: 6,
    businessHttp: 34,
    bootstrapHttp: 6,
    inspectorSnapshots: 114,
    repeatability: "PASS",
    passes,
    controls: validateControls(input.controls),
    packSha256: [...input.packSha256],
    privateVerifiedAfterCleanup: true,
    inventory: { containers: 0, volumes: 0 },
    externalRetention: "EXTERNAL_RETENTION_NOT_RUN",
    retention: "EVIDENCE_RETENTION_NOT_CONFIGURED",
    phpTsGates: {
      G0: "NOT_RUN",
      G1: "NOT_RUN",
      G2: "NOT_RUN",
      G3: "NOT_RUN",
      G4: "NOT_RUN",
    },
    targetInterface: "BLOCKED_TARGET_OWNER_API",
    product: "NOT_ESTABLISHED",
  };
}
export const CONTROL_IDS = Object.freeze([
  "http-status",
  "http-field",
  "http-type",
  "http-encoding",
  "http-body",
  "db-ddl",
  "db-default",
  "db-pk",
  "db-index",
  "db-sequence",
  "db-type",
  "db-value",
  "db-multiplicity",
  "step-reorder",
  "step-replay",
  "dirty-reset",
  "corrupt-snapshot",
  "cleanup-failure",
  "process-exit",
  "process-timeout",
  "process-cancel",
]);
const CODES = new Set([
  "HTTP_STATUS",
  "HTTP_JSON_VALUE",
  "HTTP_JSON_TYPE",
  "DB_SCHEMA",
  "DB_STATE",
  "ERROR",
  "STEP_ID",
  "DIRTY_RESET",
  "CLEANUP_ERROR",
  "COMMAND_START_ERROR",
  "WORKER_TIMEOUT",
  "WORKER_ABORTED",
]);
function validateControls(controls) {
  ensure(
    Array.isArray(controls) && controls.length === CONTROL_IDS.length,
    "CONTROL_COVERAGE",
  );
  return controls.map((c, i) => {
    keys(c, ["id", "kind", "effective", "codes"]);
    ensure(
      c.id === CONTROL_IDS[i] &&
        c.kind === (i >= 18 ? "ISOLATED_PROCESS" : "SYNTHETIC_MUTATION") &&
        c.effective === true &&
        Array.isArray(c.codes) &&
        c.codes.length > 0 &&
        c.codes.every((code) => CODES.has(code)),
      "CONTROL_RESULT",
    );
    return {
      id: CONTROL_IDS[i],
      kind: c.kind,
      effective: true,
      codes: [...c.codes],
    };
  });
}
