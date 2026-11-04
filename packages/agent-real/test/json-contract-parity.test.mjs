// MMP-161: source-grounded PHP/PDO JSON types, enforced by the real trusted
// comparator and actually executed by hosted CI.
//
// Why this file exists. `repair-vertical.test.mjs` asserts only that the prompt
// *prose* carries the PR #163 `target.jsonContract`. The offline probe that
// exercises the comparator against PHP-shaped JSON,
// `research/mmp-137/comparator-mechanics.test.mjs`, is referenced by neither
// the root `test` script nor any workflow, so its own coverage-matrix entry
// records `tests: NOT_VERIFIED`. Nothing executed therefore tied the JSON types
// the prompt promises to what the unchanged comparator actually reports, and
// that probe stopped short of `success` boolean-vs-string, SQL NULL, the uncast
// `get_slots` TEXT fields, the top-level `date`, and fabricated `error_type` on
// `update_appointment`/`cancel_appointment`/the default branch. This file is
// picked up by the existing `packages/agent-real/test/*.test.mjs` glob, so it
// runs in `pnpm test` and in hosted CI without any workflow or root-script
// change and without touching the shared CI policy.
//
// Scope and safety. Offline only: pinned public PHP source semantics (api.php /
// config.php @ d272170d0aecbd28eb5b13e272d9dd11d545b66c), synthetic JSON and
// the built trusted `@metamorph/oracle` comparator. No candidate source is
// imported or executed, no Docker, no network, no Meta/model call, no paid
// action, no encrypted custody access, no private Oracle evidence and no
// held-out data. The comparator and its normalization are NOT modified here;
// their strictness is only asserted, never lowered. A passing run is
// OFFLINE_VERIFIED prompt/comparator consistency — it is NOT evidence of real
// model-generated parity, which stays NOT_EVALUATED until a new authorized run
// produces genuine G2/G3 results.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { bindMigrationContext } from "../src/migration-context.mjs";
import { CODES } from "../src/report.mjs";

const oracleEntry = new URL("../../oracle/dist/index.js", import.meta.url);

/** The real comparator, or an honest skip when the workspace is not built. */
async function comparator(t) {
  if (!existsSync(oracleEntry)) {
    t.skip("BUILD_DIST_MISSING — run `pnpm build` first");
    return null;
  }
  const { compareHttp } = await import("@metamorph/oracle");
  return compareHttp;
}

// api.php:2 sets this on every response, so it is the compared content-type.
const CONTENT_TYPE = "application/json; charset=utf-8";
const obs = (body) => ({
  status: 200,
  headers: { "content-type": CONTENT_TYPE },
  body: Buffer.from(body, "utf8"),
});

/**
 * Source-derived PHP 7.4 reference bodies and the naive TypeScript emissions a
 * model plausibly produces instead, with the exact findings the unchanged
 * comparator must report. `json_encode` escaping and member order are
 * irrelevant to the comparator (pinned by the invariance control below), so the
 * references are written readably.
 *
 * `fields` records which source response-field names each row exercises; the
 * contract-coverage guard fails if `target.jsonContract` ever names a field no
 * row here backs with a real comparator assertion.
 */
const CASES = [
  {
    name: "book success: PDO::lastInsertId() is a string (api.php:188,194)",
    fields: ["appointment_id"],
    reference:
      '{"success":true,"appointment_id":"1","message":"Appointment approved! You are booked with Karim Rahman on November 4, 2026."}',
    candidate:
      '{"success":true,"appointment_id":1,"message":"Appointment approved! You are booked with Karim Rahman on November 4, 2026."}',
    expect: [{ code: "HTTP_JSON_TYPE", path: "/body/appointment_id" }],
  },
  {
    name: "get_appointments: PDO fetchAll() numeric columns are strings (api.php:239)",
    fields: ["id", "mechanic_id"],
    reference:
      '{"success":true,"appointments":[{"id":"1","status":"approved","mechanic_id":"1"}]}',
    candidate:
      '{"success":true,"appointments":[{"id":1,"status":"approved","mechanic_id":1}]}',
    expect: [
      { code: "HTTP_JSON_TYPE", path: "/body/appointments/0/id" },
      { code: "HTTP_JSON_TYPE", path: "/body/appointments/0/mechanic_id" },
    ],
  },
  {
    name: "get_appointments: SQL NULL stays JSON null, never a string (config.php:99)",
    fields: ["created_at"],
    reference: '{"success":true,"appointments":[{"id":"1","created_at":null}]}',
    candidate:
      '{"success":true,"appointments":[{"id":"1","created_at":"null"}]}',
    expect: [
      { code: "HTTP_JSON_TYPE", path: "/body/appointments/0/created_at" },
    ],
  },
  {
    name: "get_appointments: SQL NULL is a present key, not an omitted one",
    fields: ["created_at"],
    reference: '{"success":true,"appointments":[{"id":"1","created_at":null}]}',
    candidate: '{"success":true,"appointments":[{"id":"1"}]}',
    expect: [
      { code: "HTTP_JSON_MISSING", path: "/body/appointments/0/created_at" },
    ],
  },
  {
    name: "get_slots: the four (int) casts are JSON numbers (api.php:72,76-78)",
    fields: ["id", "max_daily_slots", "booked_count", "available_slots"],
    reference:
      '{"success":true,"date":"2026-11-04","mechanics":[{"id":1,"name":"Karim Rahman","specialty":"Engine Overhaul & Diagnostics","phone":"+880 1711-000001","max_daily_slots":4,"booked_count":0,"available_slots":4,"is_full":false}]}',
    candidate:
      '{"success":true,"date":"2026-11-04","mechanics":[{"id":"1","name":"Karim Rahman","specialty":"Engine Overhaul & Diagnostics","phone":"+880 1711-000001","max_daily_slots":"4","booked_count":"0","available_slots":"4","is_full":false}]}',
    expect: [
      { code: "HTTP_JSON_TYPE", path: "/body/mechanics/0/available_slots" },
      { code: "HTTP_JSON_TYPE", path: "/body/mechanics/0/booked_count" },
      { code: "HTTP_JSON_TYPE", path: "/body/mechanics/0/id" },
      { code: "HTTP_JSON_TYPE", path: "/body/mechanics/0/max_daily_slots" },
    ],
  },
  {
    name: "get_slots: is_full is a JSON boolean, not 0/1 (api.php:79)",
    fields: ["is_full"],
    reference:
      '{"success":true,"date":"2026-11-04","mechanics":[{"id":1,"is_full":false}]}',
    candidate:
      '{"success":true,"date":"2026-11-04","mechanics":[{"id":1,"is_full":0}]}',
    expect: [{ code: "HTTP_JSON_TYPE", path: "/body/mechanics/0/is_full" }],
  },
  {
    name: "get_slots: uncast TEXT columns stay JSON strings (api.php:73-75)",
    fields: ["phone"],
    reference:
      '{"success":true,"date":"2026-11-04","mechanics":[{"id":1,"name":"Karim Rahman","phone":"+880 1711-000001"}]}',
    candidate:
      '{"success":true,"date":"2026-11-04","mechanics":[{"id":1,"name":"Karim Rahman","phone":8801711000001}]}',
    expect: [{ code: "HTTP_JSON_TYPE", path: "/body/mechanics/0/phone" }],
  },
  {
    name: "get_slots: date is a JSON string (api.php:53,85)",
    fields: ["date"],
    reference: '{"success":true,"date":"2026-11-04","mechanics":[]}',
    candidate: '{"success":true,"date":20261104,"mechanics":[]}',
    expect: [{ code: "HTTP_JSON_TYPE", path: "/body/date" }],
  },
  {
    name: "get_slots: SELECT * must not leak created_at into the response (api.php:58,71-80)",
    fields: ["created_at"],
    reference:
      '{"success":true,"date":"2026-11-04","mechanics":[{"id":1,"name":"Karim Rahman"}]}',
    candidate:
      '{"success":true,"date":"2026-11-04","mechanics":[{"id":1,"name":"Karim Rahman","created_at":"2026-10-27 12:00:00"}]}',
    expect: [
      { code: "HTTP_JSON_MISSING", path: "/body/mechanics/0/created_at" },
    ],
  },
  {
    name: "every branch: success is a JSON boolean, never a string (api.php:26,84,93,135,193,242,330,355)",
    fields: ["success"],
    reference: '{"success":false,"message":"Invalid request method."}',
    candidate: '{"success":"false","message":"Invalid request method."}',
    expect: [{ code: "HTTP_JSON_TYPE", path: "/body/success" }],
  },
  {
    name: "every branch that carries message: message is a JSON string",
    fields: ["message"],
    reference: '{"success":false,"message":"Appointment not found."}',
    candidate: '{"success":false,"message":404}',
    expect: [{ code: "HTTP_JSON_TYPE", path: "/body/message" }],
  },
  {
    name: "book DUPLICATE_CLIENT: error_type is a JSON string (api.php:157-161)",
    fields: ["error_type"],
    reference:
      '{"success":false,"error_type":"DUPLICATE_CLIENT","message":"You have already taken an appointment on November 4, 2026. Duplicate appointments on the same date are not allowed."}',
    candidate:
      '{"success":false,"error_type":1001,"message":"You have already taken an appointment on November 4, 2026. Duplicate appointments on the same date are not allowed."}',
    expect: [{ code: "HTTP_JSON_TYPE", path: "/body/error_type" }],
  },
  {
    name: "book MECHANIC_FULL: dropping error_type is a missing key (api.php:175-179)",
    fields: ["error_type"],
    reference:
      '{"success":false,"error_type":"MECHANIC_FULL","message":"Mechanic Karim Rahman is fully occupied (4/4 appointments) on November 4, 2026. Please select another free mechanic."}',
    candidate:
      '{"success":false,"message":"Mechanic Karim Rahman is fully occupied (4/4 appointments) on November 4, 2026. Please select another free mechanic."}',
    expect: [{ code: "HTTP_JSON_MISSING", path: "/body/error_type" }],
  },
  {
    name: "update_appointment capacity: error_type must NOT be fabricated (api.php:312-318)",
    fields: ["error_type"],
    reference:
      '{"success":false,"message":"Mechanic Karim Rahman is fully occupied (4/4) on 2026-11-05. Choose another mechanic."}',
    candidate:
      '{"success":false,"error_type":"MECHANIC_FULL","message":"Mechanic Karim Rahman is fully occupied (4/4) on 2026-11-05. Choose another mechanic."}',
    expect: [{ code: "HTTP_JSON_MISSING", path: "/body/error_type" }],
  },
  {
    name: "cancel_appointment success: error_type must NOT be fabricated (api.php:354-355)",
    fields: ["error_type"],
    reference:
      '{"success":true,"message":"Appointment cancelled/deleted successfully."}',
    candidate:
      '{"success":true,"error_type":"CANCELLED","message":"Appointment cancelled/deleted successfully."}',
    expect: [{ code: "HTTP_JSON_MISSING", path: "/body/error_type" }],
  },
  {
    name: "default branch: exact Invalid action body, no error_type (api.php:26)",
    fields: ["success", "message"],
    reference: '{"success":false,"message":"Invalid action"}',
    candidate:
      '{"success":false,"error_type":"INVALID_ACTION","message":"Invalid action"}',
    expect: [{ code: "HTTP_JSON_MISSING", path: "/body/error_type" }],
  },
];

// Every PHP-faithful response shape the matrix references, used for the
// self-parity control: a source-faithful target must produce zero findings.
const PHP_FAITHFUL = [
  '{"success":false,"message":"Invalid action"}',
  '{"success":false,"message":"Invalid request method."}',
  '{"success":true,"date":"2026-11-04","mechanics":[{"id":1,"name":"Karim Rahman","specialty":"Engine Overhaul & Diagnostics","phone":"+880 1711-000001","max_daily_slots":4,"booked_count":0,"available_slots":4,"is_full":false}]}',
  '{"success":true,"date":"2026-11-04","mechanics":[{"id":1,"name":"Karim Rahman","specialty":"Engine Overhaul & Diagnostics","phone":"+880 1711-000001","max_daily_slots":4,"booked_count":4,"available_slots":0,"is_full":true}]}',
  '{"success":true,"appointment_id":"1","message":"Appointment approved! You are booked with Karim Rahman on November 4, 2026."}',
  '{"success":false,"message":"Client Name is required. Address is required."}',
  '{"success":false,"message":"Selected mechanic does not exist."}',
  '{"success":false,"error_type":"DUPLICATE_CLIENT","message":"You have already taken an appointment on November 4, 2026. Duplicate appointments on the same date are not allowed."}',
  '{"success":false,"error_type":"MECHANIC_FULL","message":"Mechanic Karim Rahman is fully occupied (4/4 appointments) on November 4, 2026. Please select another free mechanic."}',
  '{"success":false,"message":"Failed to save appointment. Please try again."}',
  '{"success":true,"appointments":[]}',
  '{"success":true,"appointments":[{"id":"1","client_name":"Public Qualification 1","address":"1 Public Road","phone":"+880 1711-000001","car_license":"PUB-0001","car_engine":"PUB-ENGINE-0001","appointment_date":"2026-11-04","mechanic_id":"1","status":"approved","created_at":"2026-10-27 12:00:00","mechanic_name":"Karim Rahman","mechanic_specialty":"Engine Overhaul & Diagnostics"}]}',
  '{"success":true,"appointments":[{"id":"1","created_at":null,"mechanic_id":"1"}]}',
  '{"success":false,"message":"Invalid parameters provided."}',
  '{"success":false,"message":"Appointment date cannot be in the past."}',
  '{"success":false,"message":"Appointment not found."}',
  '{"success":false,"message":"Target mechanic does not exist."}',
  '{"success":false,"message":"Cannot change date: Client already has another appointment on 2026-11-05."}',
  '{"success":false,"message":"Mechanic Karim Rahman is fully occupied (4/4) on 2026-11-05. Choose another mechanic."}',
  '{"success":true,"message":"Appointment updated successfully to 2026-11-05 with Karim Rahman."}',
  '{"success":false,"message":"Failed to update appointment."}',
  '{"success":false,"message":"Invalid appointment ID."}',
  '{"success":true,"message":"Appointment cancelled/deleted successfully."}',
  '{"success":false,"message":"Failed to delete appointment."}',
];

// Response field names the pinned public source can emit. Used only to detect
// which of them `target.jsonContract` names in prose.
const SOURCE_RESPONSE_FIELDS = [
  "id",
  "name",
  "specialty",
  "phone",
  "max_daily_slots",
  "booked_count",
  "available_slots",
  "is_full",
  "date",
  "success",
  "message",
  "error_type",
  "appointment_id",
  "client_name",
  "address",
  "car_license",
  "car_engine",
  "appointment_date",
  "mechanic_id",
  "status",
  "created_at",
  "mechanic_name",
  "mechanic_specialty",
  "appointments",
  "mechanics",
];

const source = readFileSync(
  new URL("../../../research/mmp-061/public-source.json", import.meta.url),
  "utf8",
);
const context = () => bindMigrationContext(source);
const repairRequest = Object.freeze({
  unitId: "workshop-api",
  tier: "spark",
  action: "repair",
  attempt: 2,
  repairFeedback: "HTTP_JSON_TYPE",
});
const previous = [
  { path: "src/main.ts", content: "export const syntheticPriorOutput = 1;" },
];

test("the unchanged comparator stays strict: exact normalization, no agent-supplied rules", async (t) => {
  const compareHttp = await comparator(t);
  if (!compareHttp) return;
  const { NORMALIZATION_VERSION, STABLE_HEADERS } = await import(
    "@metamorph/oracle"
  );
  assert.equal(NORMALIZATION_VERSION, "oracle-exact-v1");
  assert.deepEqual(
    [...STABLE_HEADERS],
    ["content-type", "location", "cache-control", "allow"],
  );
  // number vs string must still be a type finding, never normalized away.
  assert.deepEqual(
    compareHttp(obs('{"appointment_id":"1"}'), obs('{"appointment_id":1}')),
    [{ code: "HTTP_JSON_TYPE", path: "/body/appointment_id" }],
  );
});

test("self-parity control: every PHP-faithful body yields zero findings", async (t) => {
  const compareHttp = await comparator(t);
  if (!compareHttp) return;
  for (const body of PHP_FAITHFUL) {
    assert.deepEqual(compareHttp(obs(body), obs(body)), [], body);
  }
});

test("invariance control: member order and whitespace are never findings", async (t) => {
  const compareHttp = await comparator(t);
  if (!compareHttp) return;
  const reference = obs(
    '{"success":false,"error_type":"DUPLICATE_CLIENT","message":"m"}',
  );
  const reordered = obs(
    '{\n  "message": "m",\n  "success": false,\n  "error_type": "DUPLICATE_CLIENT"\n}',
  );
  assert.deepEqual(compareHttp(reference, reordered), []);
});

for (const row of CASES) {
  test(`source-grounded parity: ${row.name}`, async (t) => {
    const compareHttp = await comparator(t);
    if (!compareHttp) return;
    assert.deepEqual(
      compareHttp(obs(row.reference), obs(row.candidate)),
      row.expect,
    );
  });
}

test("contract coverage: every field the prompt names is backed by a comparator case", async (t) => {
  const compareHttp = await comparator(t);
  if (!compareHttp) return;
  const { jsonContract } = JSON.parse(
    context().prompt({
      unitId: "workshop-api",
      tier: "spark",
      action: "generate",
      attempt: 1,
      repairFeedback: null,
    }),
  ).context.target;
  assert.ok(jsonContract.length > 0, "jsonContract disappeared from the body");
  const exercised = new Set(CASES.flatMap((row) => row.fields));
  const named = SOURCE_RESPONSE_FIELDS.filter((field) =>
    new RegExp(`\\b${field}\\b`).test(jsonContract),
  );
  // Guards against prose drift: naming a new field in the contract without a
  // comparator-backed parity case must fail here, not silently in production.
  for (const field of named) {
    assert.ok(
      exercised.has(field),
      `target.jsonContract names "${field}" but no comparator-backed parity case exercises it`,
    );
  }
  assert.ok(named.includes("appointment_id"), "book id rule lost");
  assert.ok(named.includes("is_full"), "get_slots boolean rule lost");
  assert.ok(named.includes("error_type"), "error_type rule lost");
});

test("repair feedback stays an allowlisted code: no field pointer can be smuggled in", async (t) => {
  const compareHttp = await comparator(t);
  if (!compareHttp) return;
  const body = context().prompt(repairRequest, previous);
  const inner = JSON.parse(body);
  assert.deepEqual(inner.repairCodes, ["HTTP_JSON_TYPE"]);
  assert.deepEqual(inner.previousGeneratedChanges, previous);
  assert.ok(CODES.has("HTTP_JSON_TYPE"));
  // A comparator `Difference.path` is a JSON pointer. Handing one to the model
  // would be a declassification decision that belongs to the owners, so the
  // allowlist must reject it rather than pass it through into the wire body.
  for (const attempt of [
    "/body/appointment_id",
    "HTTP_JSON_TYPE:/body/appointment_id",
    "/body/mechanics/0/is_full",
  ]) {
    assert.throws(
      () =>
        context().prompt(
          { ...repairRequest, repairFeedback: attempt },
          previous,
        ),
      (error) => error.code === "REPAIR_FEEDBACK",
      attempt,
    );
  }
  // The serialized repair body carries no observation-shaped evidence: no JSON
  // pointer path, no finding/path pair, and no reference or candidate body.
  assert.ok(!body.includes("/body/"), "JSON pointer leaked into the wire body");
  // A comparator Difference.path always begins with "/"; the legitimate `path`
  // keys in this payload (source.files, previousGeneratedChanges) never do.
  assert.ok(
    !body.includes('"path":"/'),
    "comparator difference path leaked into the body",
  );
  assert.ok(!body.includes("HTTP_JSON_TYPE:"), "annotated code leaked");
  for (const observed of PHP_FAITHFUL) {
    assert.ok(!body.includes(observed), "observed response body leaked");
  }
});
