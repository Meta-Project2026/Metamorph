// Offline synthetic controls for the MMP-137 post-mortem. Exercises ONLY the
// trusted built comparator (packages/oracle/dist) with public/synthetic JSON
// shapes derived from the pinned public PHP source semantics. No candidate
// source is imported or executed, no network, Docker, Meta/model call, real
// identity or paid action. Skips honestly when no local oracle build exists
// (run `pnpm --filter @metamorph/oracle build` first); this file is NOT wired
// into hosted CI (coverage-matrix entry records tests: NOT_VERIFIED).
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

const dist = new URL("../../packages/oracle/dist/http.js", import.meta.url);

/** Reference/candidate HTTP observations with JSON content-types. */
const obs = (status, body, contentType = "application/json; charset=utf-8") => ({
  status,
  headers: { "content-type": contentType },
  body: Buffer.from(body, "utf8"),
});

test("oracle build is available or the suite is skipped honestly", async (t) => {
  if (!existsSync(dist)) {
    t.skip("BUILD_DIST_MISSING — run `pnpm --filter @metamorph/oracle build`");
    return;
  }
  const { compareHttp } = await import(dist.href);
  assert.equal(typeof compareHttp, "function");
});

test("H1 mechanics: appointment_id number vs PHP string -> HTTP_JSON_TYPE at /body/appointment_id", async (t) => {
  if (!existsSync(dist)) return t.skip("BUILD_DIST_MISSING");
  const { compareHttp } = await import(dist.href);
  // Reference (PHP 7.4 PDO::lastInsertId() returns a string):
  const reference = obs(
    200,
    '{"success":true,"appointment_id":"1","message":"Appointment approved!"}',
  );
  // Hypothesized candidate emission (node:sqlite lastInsertRowid as number):
  const candidate = obs(
    200,
    '{"success":true,"appointment_id":1,"message":"Appointment approved!"}',
  );
  assert.deepEqual(compareHttp(reference, candidate), [
    { code: "HTTP_JSON_TYPE", path: "/body/appointment_id" },
  ]);
});

test("H2 mechanics: get_appointments row integers as numbers vs PHP strings -> HTTP_JSON_TYPE per field", async (t) => {
  if (!existsSync(dist)) return t.skip("BUILD_DIST_MISSING");
  const { compareHttp } = await import(dist.href);
  const reference = obs(
    200,
    '{"success":true,"appointments":[{"id":"1","client_name":"Public Qualification 1","mechanic_id":"1"}]}',
  );
  const candidate = obs(
    200,
    '{"success":true,"appointments":[{"id":1,"client_name":"Public Qualification 1","mechanic_id":1}]}',
  );
  // Key traversal is sorted: client_name matches, then id, then mechanic_id.
  assert.deepEqual(compareHttp(reference, candidate), [
    { code: "HTTP_JSON_TYPE", path: "/body/appointments/0/id" },
    { code: "HTTP_JSON_TYPE", path: "/body/appointments/0/mechanic_id" },
  ]);
});

test("H3 mechanics: get_slots is_full boolean vs 0/1 number, and uncast string fields", async (t) => {
  if (!existsSync(dist)) return t.skip("BUILD_DIST_MISSING");
  const { compareHttp } = await import(dist.href);
  const slots = (isFull, maxSlots) =>
    obs(
      200,
      `{"success":true,"date":"2099-06-15","mechanics":[{"id":1,"name":"Karim Rahman","specialty":"Engine Overhaul & Diagnostics","phone":"+880 1711-000001","max_daily_slots":${maxSlots},"booked_count":4,"available_slots":0,"is_full":${isFull}}]}`,
    );
  // is_full: PHP emits a boolean; 0/1 would type-diff.
  assert.deepEqual(compareHttp(slots(true, 4), slots(1, 4)), [
    { code: "HTTP_JSON_TYPE", path: "/body/mechanics/0/is_full" },
  ]);
  // A missed PHP (int) cast stringifies the field instead.
  assert.deepEqual(compareHttp(slots(true, 4), slots(true, '"4"')), [
    { code: "HTTP_JSON_TYPE", path: "/body/mechanics/0/max_daily_slots" },
  ]);
});

test("invariance control: key order and whitespace never produce findings", async (t) => {
  if (!existsSync(dist)) return t.skip("BUILD_DIST_MISSING");
  const { compareHttp } = await import(dist.href);
  const reference = obs(200, '{"success":true,"appointments":[]}');
  const candidate = obs(
    200,
    '{\n  "appointments": [],\n  "success": true\n}',
  );
  assert.deepEqual(compareHttp(reference, candidate), []);
});

test("value control: equal types with different values -> HTTP_JSON_VALUE (absent in the paid run)", async (t) => {
  if (!existsSync(dist)) return t.skip("BUILD_DIST_MISSING");
  const { compareHttp } = await import(dist.href);
  const reference = obs(200, '{"success":false,"message":"A"}');
  const candidate = obs(200, '{"success":false,"message":"B"}');
  assert.deepEqual(compareHttp(reference, candidate), [
    { code: "HTTP_JSON_VALUE", path: "/body/message" },
  ]);
});

test("missing-key control: extra/missing member -> HTTP_JSON_MISSING (absent in the paid run)", async (t) => {
  if (!existsSync(dist)) return t.skip("BUILD_DIST_MISSING");
  const { compareHttp } = await import(dist.href);
  const reference = obs(
    200,
    '{"success":false,"error_type":"DUPLICATE_CLIENT","message":"m"}',
  );
  const candidate = obs(200, '{"success":false,"message":"m"}');
  assert.deepEqual(compareHttp(reference, candidate), [
    { code: "HTTP_JSON_MISSING", path: "/body/error_type" },
  ]);
});

test("length control: differing array lengths -> HTTP_JSON_LENGTH (absent in the paid run)", async (t) => {
  if (!existsSync(dist)) return t.skip("BUILD_DIST_MISSING");
  const { compareHttp } = await import(dist.href);
  const reference = obs(
    200,
    '{"success":true,"appointments":[{"id":"1","mechanic_id":"1"}]}',
  );
  const candidate = obs(200, '{"success":true,"appointments":[]}');
  assert.deepEqual(compareHttp(reference, candidate), [
    { code: "HTTP_JSON_LENGTH", path: "/body/appointments" },
  ]);
});

test("status and non-JSON body controls pin the remaining finding codes (absent in the paid run)", async (t) => {
  if (!existsSync(dist)) return t.skip("BUILD_DIST_MISSING");
  const { compareHttp } = await import(dist.href);
  const text = (body) => obs(200, body, "text/plain; charset=utf-8");
  assert.deepEqual(compareHttp(obs(200, "{}"), obs(404, "{}")), [
    { code: "HTTP_STATUS", path: "/status" },
  ]);
  assert.deepEqual(compareHttp(text("ok"), text("ok")), []);
  assert.deepEqual(compareHttp(text("ok"), text("no")), [
    { code: "HTTP_BODY", path: "/body" },
  ]);
});
