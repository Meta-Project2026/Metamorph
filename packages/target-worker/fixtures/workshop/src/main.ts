// Adapted MIT car-workshop API, pinned source and complete notice in schema.ts.
// Real SQLite mutations and request processing; no Oracle/report/fixture imports.
import { createServer } from "node:http";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { SCHEMA, SEEDS } from "./schema.js";

const db = new DatabaseSync("/state/target.sqlite");
db.exec(SCHEMA);
if (Number(db.prepare("SELECT COUNT(*) AS n FROM mechanics").get()?.n) === 0) {
  const insert = db.prepare(
    "INSERT INTO mechanics (id, name, specialty, phone, max_daily_slots) VALUES (?, ?, ?, ?, ?)",
  );
  for (const row of SEEDS) insert.run(...row);
}
type Row = Record<string, string | number | bigint | Uint8Array | null>;
const get = (sql: string, ...args: SQLInputValue[]): Row | undefined =>
  db.prepare(sql).get(...args);
const all = (sql: string, ...args: SQLInputValue[]): Row[] =>
  db.prepare(sql).all(...args);
const trim = (input: string | null) => {
  const s = input ?? "",
    chars = " \t\n\r\0\v";
  let start = 0,
    end = s.length;
  while (start < end && chars.includes(s[start])) start++;
  while (end > start && chars.includes(s[end - 1])) end--;
  return s.slice(start, end);
};
const int = (s: string | null) => Number.parseInt(trim(s), 10) || 0;
const empty = (s: string) => s === "" || s === "0";
function validDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || s.startsWith("0000")) return false;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
function today(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (name: string) => parts.find((p) => p.type === name)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function dateText(s: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${s}T00:00:00+06:00`));
}
const reject = (message: string, error_type?: string) => ({
  success: false,
  ...(error_type ? { error_type } : {}),
  message,
});
function locked<T>(fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
function book(form: URLSearchParams) {
  const client = trim(form.get("client_name")),
    address = trim(form.get("address")),
    phone = trim(form.get("phone"));
  const license = trim(form.get("car_license")),
    engine = trim(form.get("car_engine")),
    date = trim(form.get("appointment_date"));
  const mechanicId = int(form.get("mechanic_id")),
    errors: string[] = [];
  if (empty(client)) errors.push("Client Name is required.");
  if (empty(address)) errors.push("Address is required.");
  if (empty(phone) || !/^[0-9+\s\-()]{6,20}$/.test(phone))
    errors.push(
      "Valid Phone number is required (must contain only numbers/phone symbols).",
    );
  if (empty(license)) errors.push("Car License Number is required.");
  if (empty(engine) || !/^[a-zA-Z0-9\s-]+$/.test(engine))
    errors.push("Car Engine Number is required (alphanumeric).");
  if (!validDate(date))
    errors.push("A valid Appointment Date (YYYY-MM-DD) is required.");
  else if (date < today())
    errors.push("Appointment date cannot be in the past.");
  if (mechanicId <= 0)
    errors.push("Please select a desired mechanic from the available list.");
  if (errors.length) return reject(errors.join(" "));
  return locked(() => {
    const mechanic = get("SELECT * FROM mechanics WHERE id = ?", mechanicId);
    if (!mechanic) return reject("Selected mechanic does not exist.");
    const duplicate = get(
      "SELECT id FROM appointments WHERE appointment_date = ? AND (phone = ? OR car_license = ?) AND status != 'cancelled'",
      date,
      phone,
      license,
    );
    if (duplicate)
      return reject(
        `You have already taken an appointment on ${dateText(date)}. Duplicate appointments on the same date are not allowed.`,
        "DUPLICATE_CLIENT",
      );
    const count = Number(
      get(
        "SELECT COUNT(*) AS booked FROM appointments WHERE mechanic_id = ? AND appointment_date = ? AND status != 'cancelled'",
        mechanicId,
        date,
      )?.booked,
    );
    if (count >= Number(mechanic.max_daily_slots))
      return reject(
        `Mechanic ${mechanic.name} is fully occupied (${count}/${mechanic.max_daily_slots} appointments) on ${dateText(date)}. Please select another free mechanic.`,
        "MECHANIC_FULL",
      );
    const inserted = db
      .prepare(
        "INSERT INTO appointments (client_name, address, phone, car_license, car_engine, appointment_date, mechanic_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'approved')",
      )
      .run(client, address, phone, license, engine, date, mechanicId);
    return {
      success: true,
      appointment_id: String(inserted.lastInsertRowid),
      message: `Appointment approved! You are booked with ${mechanic.name} on ${dateText(date)}.`,
    };
  });
}
function update(form: URLSearchParams) {
  const id = int(form.get("id")),
    date = trim(form.get("appointment_date")),
    mechanicId = int(form.get("mechanic_id"));
  if (id <= 0 || !validDate(date) || mechanicId <= 0)
    return reject("Invalid parameters provided.");
  if (date < today()) return reject("Appointment date cannot be in the past.");
  return locked(() => {
    const appointment = get("SELECT * FROM appointments WHERE id = ?", id);
    if (!appointment) return reject("Appointment not found.");
    const mechanic = get("SELECT * FROM mechanics WHERE id = ?", mechanicId);
    if (!mechanic) return reject("Target mechanic does not exist.");
    if (
      get(
        "SELECT id FROM appointments WHERE appointment_date = ? AND (phone = ? OR car_license = ?) AND id != ? AND status != 'cancelled'",
        date,
        appointment.phone,
        appointment.car_license,
        id,
      )
    )
      return reject(
        `Cannot change date: Client already has another appointment on ${date}.`,
      );
    const count = Number(
      get(
        "SELECT COUNT(*) AS booked FROM appointments WHERE mechanic_id = ? AND appointment_date = ? AND id != ? AND status != 'cancelled'",
        mechanicId,
        date,
        id,
      )?.booked,
    );
    if (count >= Number(mechanic.max_daily_slots))
      return reject(
        `Mechanic ${mechanic.name} is fully occupied (${count}/${mechanic.max_daily_slots}) on ${date}. Choose another mechanic.`,
      );
    db.prepare(
      "UPDATE appointments SET appointment_date = ?, mechanic_id = ? WHERE id = ?",
    ).run(date, mechanicId, id);
    return {
      success: true,
      message: `Appointment updated successfully to ${date} with ${mechanic.name}.`,
    };
  });
}
function cancel(form: URLSearchParams) {
  const id = int(form.get("id"));
  if (id <= 0) return reject("Invalid appointment ID.");
  db.prepare("DELETE FROM appointments WHERE id = ?").run(id);
  return {
    success: true,
    message: "Appointment cancelled/deleted successfully.",
  };
}
function appointments(query: URLSearchParams) {
  let sql =
    "SELECT a.*, m.name AS mechanic_name, m.specialty AS mechanic_specialty FROM appointments a JOIN mechanics m ON a.mechanic_id = m.id WHERE 1=1";
  const args: SQLInputValue[] = [],
    date = trim(query.get("date")),
    mechanicId = int(query.get("mechanic_id")),
    search = trim(query.get("search"));
  if (!empty(date)) {
    sql += " AND a.appointment_date = ?";
    args.push(date);
  }
  if (mechanicId > 0) {
    sql += " AND a.mechanic_id = ?";
    args.push(mechanicId);
  }
  if (!empty(search)) {
    sql +=
      " AND (a.client_name LIKE ? OR a.phone LIKE ? OR a.car_license LIKE ? OR a.car_engine LIKE ?)";
    args.push(...Array(4).fill(`%${search}%`));
  }
  sql += " ORDER BY a.appointment_date DESC, a.id DESC";
  return {
    success: true,
    appointments: all(sql, ...args).map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([k, v]) => [k, v === null ? null : String(v)]),
      ),
    ),
  };
}
function slots(query: URLSearchParams) {
  let date = trim(query.get("date")) || today();
  if (!validDate(date)) date = today();
  return {
    success: true,
    date,
    mechanics: all("SELECT * FROM mechanics ORDER BY id ASC").map((m) => {
      const booked = Number(
        get(
          "SELECT COUNT(*) AS booked FROM appointments WHERE mechanic_id = ? AND appointment_date = ? AND status != 'cancelled'",
          m.id,
          date,
        )?.booked,
      );
      const available = Math.max(0, Number(m.max_daily_slots) - booked);
      return {
        id: Number(m.id),
        name: m.name,
        specialty: m.specialty,
        phone: m.phone,
        max_daily_slots: Number(m.max_daily_slots),
        booked_count: booked,
        available_slots: available,
        is_full: available <= 0,
      };
    }),
  };
}
createServer(async (req, res) => {
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("x-request-id", req.headers["x-request-id"] ?? "");
  let response: unknown;
  try {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    let body = "";
    for await (const chunk of req) {
      body += String(chunk);
      if (Buffer.byteLength(body) > 4096) throw Error("BODY_LIMIT");
    }
    const form = new URLSearchParams(body),
      action = trim(url.searchParams.get("action") ?? form.get("action"));
    if (url.pathname !== "/api.php") response = reject("Invalid action");
    else if (action === "get_slots") response = slots(url.searchParams);
    else if (action === "get_appointments")
      response = appointments(url.searchParams);
    else if (
      ["book", "update_appointment", "cancel_appointment"].includes(action)
    ) {
      response =
        req.method !== "POST"
          ? reject("Invalid request method.")
          : action === "book"
            ? book(form)
            : action === "update_appointment"
              ? update(form)
              : cancel(form);
    } else response = reject("Invalid action");
  } catch {
    res.statusCode = 500;
    response = reject("Storage operation failed.");
  }
  // PHP's default JSON encoding escapes slash/non-ASCII; no canned observations.
  res.end(
    JSON.stringify(response)
      .replace(/\//g, "\\/")
      .replace(
        /[\u0080-\uffff]/g,
        (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`,
      ),
  );
}).listen(3000, "127.0.0.1");
