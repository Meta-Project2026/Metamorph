// Public structural recipes, never concrete sampled cases. Called only AFTER
// a trusted freeze receipt is durably written. No seeds/env/LLM/provider inputs.
import { createHash, randomBytes, randomInt } from "node:crypto";
import {
  MANIFEST_SHA256,
  NORMALIZATION_VERSION,
  SOURCE,
} from "@metamorph/oracle";
import { fields, requireCheck } from "../../differential/src/strict.mjs";
import { WORKSHOP_CANDIDATE_SHA } from "../../differential/src/workshop-policy.mjs";
import {
  requestPolicy,
  WORKSHOP_PROFILE,
} from "../../target-worker/runtime/profile.mjs";

export const VERSION = "independent-workshop-audit-v1";
const issued = new WeakSet();
export const digest = (x) =>
  createHash("sha256").update(JSON.stringify(x)).digest("hex");
export function freezeCandidate(identity, persist) {
  fields(
    identity,
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
    "FREEZE_FIELDS",
  );
  requireCheck(
    /^[a-f0-9]{40}$/.test(identity.headSha) &&
      identity.candidateSha === WORKSHOP_CANDIDATE_SHA &&
      identity.sourceSha === SOURCE.archiveSha256 &&
      identity.manifestSha === MANIFEST_SHA256 &&
      identity.profile === WORKSHOP_PROFILE.id &&
      identity.normalization === NORMALIZATION_VERSION &&
      [identity.recipeSha, identity.evaluatorSha].every((h) =>
        /^[a-f0-9]{64}$/.test(h),
      ) &&
      [identity.phpImage, identity.targetImage].every((h) =>
        /^sha256:[a-f0-9]{64}$/.test(h),
      ),
    "FREEZE_IDENTITY",
  );
  const frozen = Object.freeze({ ...identity });
  const persisted = persist({
    version: VERSION,
    identity: frozen,
    commitment: digest(frozen),
  });
  requireCheck(
    !persisted || typeof persisted.then !== "function",
    "FREEZE_PERSIST_SYNC",
  );
  issued.add(frozen);
  return frozen;
}
export const FAMILIES = Object.freeze([
  "duplicate-date-identity",
  "capacity-update-cancel",
  "admitted-validation",
  "ordering-types",
]);
export const DECLARED = Object.freeze(
  [
    { id: "audit-duplicate-1", family: FAMILIES[0], steps: 8 },
    { id: "audit-duplicate-2", family: FAMILIES[0], steps: 8 },
    { id: "audit-capacity-1", family: FAMILIES[1], steps: 11 },
    { id: "audit-capacity-2", family: FAMILIES[1], steps: 10 },
    { id: "audit-validation-1", family: FAMILIES[2], steps: 7 },
    { id: "audit-validation-2", family: FAMILIES[2], steps: 7 },
    { id: "audit-ordering-1", family: FAMILIES[3], steps: 8 },
  ].map(Object.freeze),
);
const post = (action, form) => ({
  method: "POST",
  path: `/api.php?action=${action}`,
  body: new URLSearchParams(form).toString(),
});
const read = () => ({
  method: "GET",
  path: "/api.php?action=get_appointments",
});
const slots = (date) => ({
  method: "GET",
  path: `/api.php?action=get_slots&date=${date}`,
});
const update = (id, date, mechanic) =>
  post("update_appointment", {
    id: String(id),
    appointment_date: date,
    mechanic_id: String(mechanic),
  });
const cancel = (id) => post("cancel_appointment", { id: String(id) });
function sampleClient(date, mechanic) {
  // Values only materialize on the trusted runner. The source has no sample seed.
  return {
    client_name: randomBytes(12).toString("hex"),
    address: randomBytes(16).toString("hex"),
    phone: `+${randomInt(100000000, 999999999)}${randomInt(1000, 9999)}`,
    car_license: randomBytes(10).toString("hex"),
    car_engine: randomBytes(10).toString("hex"),
    appointment_date: date,
    mechanic_id: String(mechanic),
  };
}
export function samplePrivate(frozen) {
  requireCheck(issued.has(frozen), "FREEZE_REQUIRED");
  const day = randomInt(1, 20),
    year = randomInt(2035, 2085),
    month = randomInt(1, 13);
  const date = (offset = 0) =>
    `${year}-${String(month).padStart(2, "0")}-${String(day + offset).padStart(2, "0")}`;
  const a = date(),
    b = date(1),
    c = date(2),
    m = randomInt(1, 6),
    other = (m % 5) + 1;
  const client = () => sampleClient(a, m),
    book = (x) => post("book", x);
  const one = client(),
    samePhone = { ...client(), phone: one.phone },
    sameLicense = { ...client(), car_license: one.car_license };
  const scenarios = [
    {
      ...DECLARED[0],
      requests: [
        book(one),
        book(samePhone),
        book(sameLicense),
        book({ ...samePhone, appointment_date: b }),
        read(),
        update(2, a, other),
        read(),
        slots(a),
      ],
    },
    {
      ...DECLARED[1],
      requests: [
        book(client()),
        book(client()),
        cancel(1),
        book(client()),
        read(),
        update(2, b, other),
        read(),
        slots(b),
      ],
    },
  ];
  const fill = Array.from({ length: 5 }, client);
  scenarios.push({
    ...DECLARED[2],
    requests: [
      ...fill.map(book),
      cancel(2),
      book(client()),
      read(),
      slots(a),
      update(5, b, other),
      read(),
    ],
  });
  const full = Array.from({ length: 4 }, client),
    spare = { ...client(), mechanic_id: String(other) };
  scenarios.push({
    ...DECLARED[3],
    requests: [
      ...full.map(book),
      book(spare),
      update(5, a, m),
      cancel(3),
      update(5, a, m),
      read(),
      slots(a),
    ],
  });
  const invalid = client();
  // Source-derived structural boundaries; the actual PHP decides behavior.
  // No expected response/body/state is authored here or supplied by the target.
  scenarios.push({
    ...DECLARED[4],
    requests: [
      post("book", {}),
      post("book", { phone: invalid.phone }),
      book({ ...invalid, phone: randomBytes(4).toString("hex") }),
      book({ ...invalid, appointment_date: `${year}-02-30` }),
      book({ ...invalid, mechanic_id: String(randomInt(20, 200)) }),
      read(),
      slots(a),
    ],
  });
  const boundary = client();
  scenarios.push({
    ...DECLARED[5],
    requests: [
      book({
        ...boundary,
        phone: `${randomInt(100, 999)}\u00a0${randomInt(100, 999)}`,
      }),
      book({
        ...client(),
        car_engine: `${randomBytes(4).toString("hex")}\u00a0${randomBytes(4).toString("hex")}`,
      }),
      update(randomInt(20, 200), b, m),
      cancel(randomInt(20, 200)),
      post("update_appointment", { id: String(randomInt(1, 20)) }),
      read(),
      slots(a),
    ],
  });
  scenarios.push({
    ...DECLARED[6],
    requests: [
      book({ ...client(), appointment_date: b }),
      book(client()),
      book({ ...client(), appointment_date: c, mechanic_id: String(other) }),
      read(),
      update(2, c, m),
      read(),
      slots(c),
      slots(a),
    ],
  });
  for (const [i, s] of scenarios.entries()) {
    requireCheck(
      s.id === DECLARED[i].id && s.requests.length === DECLARED[i].steps,
      "CORPUS_SHAPE",
    );
    for (const r of s.requests)
      requestPolicy(WORKSHOP_PROFILE, r.method, r.path, r.body);
  }
  return {
    scenarios,
    commitment: digest({ freeze: digest(frozen), scenarios }),
  };
}
