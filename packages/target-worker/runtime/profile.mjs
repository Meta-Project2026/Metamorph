// Trusted versioned policy, never selected from admitted candidate source.
export const ITEMS_PROFILE = Object.freeze({
  id: "public-items-v1",
  readiness: "items-http-v1",
  stateMiB: null,
});
export const WORKSHOP_PROFILE = Object.freeze({
  id: "car-workshop-v1",
  readiness: "loopback-connect-v1",
  stateMiB: 16,
});
export const isProfile = (p) => p === ITEMS_PROFILE || p === WORKSHOP_PROFILE;
export function profileById(id) {
  if (id === undefined || id === ITEMS_PROFILE.id) return ITEMS_PROFILE;
  if (id === WORKSHOP_PROFILE.id) return WORKSHOP_PROFILE;
  throw new Error("PROFILE");
}
const fields = Object.freeze({
  book: Object.freeze([
    "client_name",
    "address",
    "phone",
    "car_license",
    "car_engine",
    "appointment_date",
    "mechanic_id",
  ]),
  update_appointment: Object.freeze(["id", "appointment_date", "mechanic_id"]),
  cancel_appointment: Object.freeze(["id"]),
});
export function requestPolicy(profile, method, path, body) {
  if (
    !isProfile(profile) ||
    !["GET", "POST"].includes(method) ||
    typeof path !== "string" ||
    (body !== undefined &&
      (typeof body !== "string" || Buffer.byteLength(body) > 4096))
  )
    throw new Error("REQUEST");
  if (profile === ITEMS_PROFILE) {
    if (!/^\/[a-zA-Z0-9/?=&_-]*$/.test(path)) throw new Error("REQUEST");
    return { contentType: "application/json" };
  }
  // Exact ASCII route/query grammar: no percent aliases, authority, normalization,
  // duplicate keys, unexpected order/keys/actions, fragments or decoded traversal.
  const read = path === "/api.php?action=get_appointments";
  const slots = /^\/api\.php\?action=get_slots&date=(\d{4}-\d{2}-\d{2})$/.exec(
    path,
  );
  const write =
    /^\/api\.php\?action=(book|update_appointment|cancel_appointment)$/.exec(
      path,
    );
  if (method === "GET") {
    if ((!read && !slots) || body !== undefined) throw new Error("REQUEST");
    if (slots) {
      const date = new Date(`${slots[1]}T00:00:00.000Z`);
      if (
        !Number.isFinite(date.getTime()) ||
        date.toISOString().slice(0, 10) !== slots[1]
      )
        throw new Error("REQUEST");
    }
    return { contentType: null };
  }
  if (!write || typeof body !== "string") throw new Error("REQUEST");
  const form = new URLSearchParams(body);
  if (
    form.toString() !== body ||
    new Set(form.keys()).size !== [...form.keys()].length
  )
    throw new Error("REQUEST");
  for (const [key, value] of form) {
    if (
      !fields[write[1]].includes(key) ||
      [...value].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127) ||
      new TextDecoder("utf-8", { fatal: true }).decode(Buffer.from(value)) !==
        value
    )
      throw new Error("REQUEST");
  }
  return { contentType: "application/x-www-form-urlencoded" };
}
