// Trusted policy tests only. Candidate source is never imported/compiled on host.
import assert from "node:assert/strict";
import test from "node:test";
import {
  ITEMS_PROFILE,
  isProfile,
  profileById,
  requestPolicy,
  WORKSHOP_PROFILE,
} from "../runtime/profile.mjs";
import { sha256, validateBundle } from "../src/admission.mjs";
import { TargetWorker } from "../src/controller.mjs";

const form = new URLSearchParams({
  client_name: "Original control",
  address: "Original address",
  phone: "+1555000111",
  car_license: "CONTROL-1",
  car_engine: "CONTROL-ENGINE",
  appointment_date: "2099-06-15",
  mechanic_id: "1",
}).toString();
test("workshop profile is an immutable host-issued selection, not candidate configuration", () => {
  assert.equal(isProfile(WORKSHOP_PROFILE), true);
  assert.equal(isProfile({ ...WORKSHOP_PROFILE }), false);
  assert.equal(profileById(), ITEMS_PROFILE);
  assert.throws(() => profileById("unknown"));
  const content = "export const x = 1;";
  const bundle = validateBundle([
    { path: "src/main.ts", content, sha256: sha256(content) },
  ]);
  const options = { trustedTest: { command: async () => {} } };
  assert.throws(
    () =>
      new TargetWorker(
        { imageId: `sha256:${"a".repeat(64)}` },
        bundle,
        "real",
        { ...options, profile: { ...WORKSHOP_PROFILE } },
      ),
    /ADMISSION_REJECTED/,
  );
  const w = new TargetWorker(
    { imageId: `sha256:${"a".repeat(64)}` },
    bundle,
    "real",
    { ...options, profile: WORKSHOP_PROFILE },
  );
  assert.throws(() => {
    w.profile = ITEMS_PROFILE;
  }, TypeError);
  assert.equal(w.validRequest("POST", "/api.php?action=book", form), true);
  assert.equal(w.validRequest("GET", "/items"), false);
});
test("profile preserves exact canonical form bytes and zero-byte POST; GET has no MIME/body", () => {
  const original = form;
  assert.deepEqual(
    requestPolicy(WORKSHOP_PROFILE, "POST", "/api.php?action=book", form),
    { contentType: "application/x-www-form-urlencoded" },
  );
  assert.equal(form, original);
  assert.deepEqual(
    requestPolicy(WORKSHOP_PROFILE, "POST", "/api.php?action=book", ""),
    { contentType: "application/x-www-form-urlencoded" },
  );
  assert.deepEqual(
    requestPolicy(WORKSHOP_PROFILE, "GET", "/api.php?action=get_appointments"),
    { contentType: null },
  );
  assert.deepEqual(
    requestPolicy(
      WORKSHOP_PROFILE,
      "GET",
      "/api.php?action=get_slots&date=2099-06-15",
    ),
    { contentType: null },
  );
  assert.throws(() =>
    requestPolicy(ITEMS_PROFILE, "GET", "/api.php?action=get_appointments"),
  );
  assert.deepEqual(
    requestPolicy(ITEMS_PROFILE, "POST", "/items", '{"value":"control"}'),
    { contentType: "application/json" },
  );
});
for (const path of [
  "//api.php?action=book",
  "http://example.invalid/api.php?action=book",
  "/./api.php?action=book",
  "/a/../api.php?action=book",
  "/%2e/api.php?action=book",
  "/%2e%2e/api.php?action=book",
  "/%61pi.php?action=book",
  "/api%2ephp?action=book",
  "/api.php?action=book#x",
  "/api.php?action=book&action=book",
  "/api.php?action=book&extra=1",
  "/api.php?%61ction=book",
  "/api.php?action=%62ook",
  "/api.php?action=book%0D%0Ax",
  "/api.php?action=book%5c",
  "/api.php\\?action=book",
  "/api.php?action=book%",
  "/api.php?action=book%FF",
  "/api.php?action=get_slots&date=2099-02-30",
  "/api.php?date=2099-06-15&action=get_slots",
  "/api.php?action=unknown",
  "/api.php?action=book\ud800",
])
  test(`workshop path rejects ambiguity ${JSON.stringify(path)}`, () =>
    assert.throws(() =>
      requestPolicy(
        WORKSHOP_PROFILE,
        path.includes("get_slots") ? "GET" : "POST",
        path,
        path.includes("get_slots") ? undefined : form,
      ),
    ));
for (const body of [
  undefined,
  "{}",
  "client_name=x&client_name=y",
  "unexpected=x",
  "client_name=%FF",
  "client_name=%ED%A0%80",
  "client_name=%0A",
  "client_name=%00",
  "client_name=%",
  "client_name=a%20b",
  "x".repeat(4097),
])
  test(`workshop form rejects invalid bytes/keys ${sha256(String(body)).slice(0, 8)}`, () =>
    assert.throws(() =>
      requestPolicy(WORKSHOP_PROFILE, "POST", "/api.php?action=book", body),
    ));
test("wrong methods, GET body/MIME ambiguity and POST-to-read routes fail closed", () => {
  for (const [method, path, body] of [
    ["PUT", "/api.php?action=book", form],
    ["GET", "/api.php?action=book", undefined],
    ["GET", "/api.php?action=get_appointments", ""],
    ["POST", "/api.php?action=get_appointments", ""],
  ])
    assert.throws(() => requestPolicy(WORKSHOP_PROFILE, method, path, body));
});
