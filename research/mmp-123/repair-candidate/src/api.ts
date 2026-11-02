/*
MIT License

Copyright (c) 2026 Tanjila Afsari Rubina

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

// The five api.php actions with PHP value semantics preserved: get_slots,
// book, get_appointments, update_appointment and cancel_appointment. Every
// handler returns the exact JSON body PHP would echo; the single shared
// connection plays the role of PHP's per-request connection, and the booking
// lock is rolled back on every path that does not commit, matching the PHP
// behaviour where an early exit closes the connection and releases the lock.
import { DatabaseSync } from "node:sqlite";
import {
  formatPhpDateLong,
  phpCastInt,
  phpCheckdate,
  phpEmpty,
  phpInt,
  phpToday,
  phpTrim,
} from "./phpcompat.js";
import type { JsonValue } from "./json.js";
import { phpJsonEncode } from "./json.js";

// PHP's $_GET / $_POST hold only string values; absent keys stay absent.
export interface PhpRequest {
  method: string;
  get: Record<string, string>;
  post: Record<string, string>;
}

// node:sqlite row cells: string | number | bigint | Uint8Array | null.
export type SqlValue = string | number | bigint | Uint8Array | null | undefined;

function hasParam(
  params: Record<string, string>,
  name: string,
): boolean {
  return Object.prototype.hasOwnProperty.call(params, name);
}

export function getParam(request: PhpRequest, name: string): string | null {
  if (!hasParam(request.get, name)) {
    return null;
  }
  return request.get[name] ?? null;
}

function getParamOr(
  request: PhpRequest,
  name: string,
  fallback: string,
): string {
  const value = getParam(request, name);
  return value === null ? fallback : value;
}

function postParam(request: PhpRequest, name: string): string | null {
  if (!hasParam(request.post, name)) {
    return null;
  }
  return request.post[name] ?? null;
}

function postParamOr(
  request: PhpRequest,
  name: string,
  fallback: string,
): string {
  const value = postParam(request, name);
  return value === null ? fallback : value;
}

function asInt(value: SqlValue): number {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === "number") {
    return Math.trunc(value);
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (typeof value === "string") {
    return phpInt(value);
  }
  return 0;
}

function asText(value: SqlValue): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  return "";
}

function asJson(value: SqlValue): JsonValue {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    return value;
  }
  return Buffer.from(value).toString("utf8");
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})\n?$/;

export function isValidDate(date: string): boolean {
  const match = DATE_PATTERN.exec(date);
  if (match === null) {
    return false;
  }
  return phpCheckdate(
    Number(match[2] ?? "0"),
    Number(match[3] ?? "0"),
    Number(match[1] ?? "0"),
  );
}

// PCRE \s without the u modifier: space, tab, LF, CR, vertical tab, FF.
const PHONE_PATTERN = /^[0-9+()\- \t\n\r\x0B\x0C]{6,20}$/u;
const ENGINE_PATTERN = /^[a-zA-Z0-9\- \t\n\r\x0B\x0C]+$/u;

let bookingTransactionOpen = false;

// Booking is check-then-write: count the mechanic's slots, then insert. The
// write lock makes racing requests run one after the other.
export function beginBookingLock(db: DatabaseSync): void {
  db.exec("BEGIN IMMEDIATE");
  bookingTransactionOpen = true;
}

function commitBooking(db: DatabaseSync): void {
  db.exec("COMMIT");
  bookingTransactionOpen = false;
}

// PHP rolls the lock back by closing the request connection; the shared
// connection instead rolls back on every path that does not commit.
export function rollbackBooking(db: DatabaseSync): void {
  if (!bookingTransactionOpen) {
    return;
  }
  try {
    db.exec("ROLLBACK");
    bookingTransactionOpen = false;
  } catch {
    // A stale flag only costs one swallowed no-op ROLLBACK; never mask the
    // original failure.
  }
}

export function getSlots(db: DatabaseSync, request: PhpRequest): string {
  const date = getParamOr(request, "date", phpToday());
  let effectiveDate = date;
  if (!isValidDate(effectiveDate)) {
    effectiveDate = phpToday();
  }

  const mechanics = db.prepare("SELECT * FROM mechanics ORDER BY id ASC").all();
  const result: JsonValue[] = [];
  for (const m of mechanics) {
    const countStmt = db.prepare(
      "SELECT COUNT(*) as booked FROM appointments WHERE mechanic_id = ? AND appointment_date = ? AND status != 'cancelled'",
    );
    const row = countStmt.get(m["id"] ?? null, effectiveDate);
    const booked = asInt(row === undefined ? null : row["booked"]);
    const maxSlots = asInt(m["max_daily_slots"]);
    const available = Math.max(0, maxSlots - booked);

    result.push({
      id: asInt(m["id"]),
      name: asText(m["name"]),
      specialty: asText(m["specialty"]),
      phone: asText(m["phone"]),
      max_daily_slots: maxSlots,
      booked_count: booked,
      available_slots: available,
      is_full: available <= 0,
    });
  }

  return phpJsonEncode({
    success: true,
    date: effectiveDate,
    mechanics: result,
  });
}

export function bookAppointment(
  db: DatabaseSync,
  request: PhpRequest,
): string {
  if (request.method !== "POST") {
    return phpJsonEncode({
      success: false,
      message: "Invalid request method.",
    });
  }

  const client_name = phpTrim(postParamOr(request, "client_name", ""));
  const address = phpTrim(postParamOr(request, "address", ""));
  const phone = phpTrim(postParamOr(request, "phone", ""));
  const car_license = phpTrim(postParamOr(request, "car_license", ""));
  const car_engine = phpTrim(postParamOr(request, "car_engine", ""));
  const date = phpTrim(postParamOr(request, "appointment_date", ""));
  const mechanic_id = phpCastInt(postParamOr(request, "mechanic_id", "0"));

  const errors: string[] = [];

  if (phpEmpty(client_name)) {
    errors.push("Client Name is required.");
  }
  if (phpEmpty(address)) {
    errors.push("Address is required.");
  }
  if (phpEmpty(phone) || !PHONE_PATTERN.test(phone)) {
    errors.push(
      "Valid Phone number is required (must contain only numbers/phone symbols).",
    );
  }
  if (phpEmpty(car_license)) {
    errors.push("Car License Number is required.");
  }
  if (phpEmpty(car_engine) || !ENGINE_PATTERN.test(car_engine)) {
    errors.push("Car Engine Number is required (alphanumeric).");
  }
  if (!isValidDate(date)) {
    errors.push("A valid Appointment Date (YYYY-MM-DD) is required.");
  } else {
    const today = phpToday();
    if (date < today) {
      errors.push("Appointment date cannot be in the past.");
    }
  }
  if (mechanic_id <= 0) {
    errors.push("Please select a desired mechanic from the available list.");
  }

  if (errors.length > 0) {
    return phpJsonEncode({ success: false, message: errors.join(" ") });
  }

  beginBookingLock(db);
  let committed = false;
  try {
    const mechanic = db
      .prepare("SELECT * FROM mechanics WHERE id = ?")
      .get(mechanic_id);
    if (mechanic === undefined) {
      return phpJsonEncode({
        success: false,
        message: "Selected mechanic does not exist.",
      });
    }

    const duplicate = db
      .prepare(
        "SELECT id FROM appointments WHERE appointment_date = ? AND (phone = ? OR car_license = ?) AND status != 'cancelled'",
      )
      .get(date, phone, car_license);
    if (duplicate !== undefined) {
      return phpJsonEncode({
        success: false,
        error_type: "DUPLICATE_CLIENT",
        message:
          "You have already taken an appointment on " +
          formatPhpDateLong(date) +
          ". Duplicate appointments on the same date are not allowed.",
      });
    }

    const capRow = db
      .prepare(
        "SELECT COUNT(*) as booked FROM appointments WHERE mechanic_id = ? AND appointment_date = ? AND status != 'cancelled'",
      )
      .get(mechanic_id, date);
    const bookedCount = asInt(capRow === undefined ? null : capRow["booked"]);
    const maxSlots = asInt(mechanic["max_daily_slots"]);

    if (bookedCount >= maxSlots) {
      return phpJsonEncode({
        success: false,
        error_type: "MECHANIC_FULL",
        message:
          "Mechanic " +
          asText(mechanic["name"]) +
          " is fully occupied (" +
          bookedCount +
          "/" +
          maxSlots +
          " appointments) on " +
          formatPhpDateLong(date) +
          ". Please select another free mechanic.",
      });
    }

    // PDO::lastInsertId() returns a string, so PHP emits appointment_id as a
    // JSON string; keep that shape.
    const inserted = db
      .prepare(
        "INSERT INTO appointments (client_name, address, phone, car_license, car_engine, appointment_date, mechanic_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'approved')",
      )
      .run(
        client_name,
        address,
        phone,
        car_license,
        car_engine,
        date,
        mechanic_id,
      );
    const insertId = asInt(inserted.lastInsertRowid);
    commitBooking(db);
    committed = true;

    return phpJsonEncode({
      success: true,
      appointment_id: String(insertId),
      message:
        "Appointment approved! You are booked with " +
        asText(mechanic["name"]) +
        " on " +
        formatPhpDateLong(date) +
        ".",
    });
  } finally {
    if (!committed) {
      rollbackBooking(db);
    }
  }
}

export function getAppointments(
  db: DatabaseSync,
  request: PhpRequest,
): string {
  const search = phpTrim(getParamOr(request, "search", ""));
  const date = phpTrim(getParamOr(request, "date", ""));
  const mechanic_id = phpCastInt(getParamOr(request, "mechanic_id", "0"));

  let sql =
    "SELECT a.*, m.name as mechanic_name, m.specialty as mechanic_specialty FROM appointments a JOIN mechanics m ON a.mechanic_id = m.id WHERE 1=1";
  const params: (string | number)[] = [];

  if (!phpEmpty(date)) {
    sql += " AND a.appointment_date = ?";
    params.push(date);
  }

  if (mechanic_id > 0) {
    sql += " AND a.mechanic_id = ?";
    params.push(mechanic_id);
  }

  if (!phpEmpty(search)) {
    sql +=
      " AND (a.client_name LIKE ? OR a.phone LIKE ? OR a.car_license LIKE ? OR a.car_engine LIKE ?)";
    const term = "%" + search + "%";
    params.push(term, term, term, term);
  }

  sql += " ORDER BY a.appointment_date DESC, a.id DESC";

  const rows = db.prepare(sql).all(...params);
  const appointments: JsonValue[] = [];
  for (const row of rows) {
    // Rebuild in SELECT column order (a.*, then the joined mechanic fields).
    const appointment: Record<string, JsonValue> = {};
    appointment["id"] = asJson(row["id"]);
    appointment["client_name"] = asJson(row["client_name"]);
    appointment["address"] = asJson(row["address"]);
    appointment["phone"] = asJson(row["phone"]);
    appointment["car_license"] = asJson(row["car_license"]);
    appointment["car_engine"] = asJson(row["car_engine"]);
    appointment["appointment_date"] = asJson(row["appointment_date"]);
    appointment["mechanic_id"] = asJson(row["mechanic_id"]);
    appointment["status"] = asJson(row["status"]);
    appointment["created_at"] = asJson(row["created_at"]);
    appointment["mechanic_name"] = asJson(row["mechanic_name"]);
    appointment["mechanic_specialty"] = asJson(row["mechanic_specialty"]);
    appointments.push(appointment);
  }

  return phpJsonEncode({ success: true, appointments: appointments });
}

export function updateAppointment(
  db: DatabaseSync,
  request: PhpRequest,
): string {
  if (request.method !== "POST") {
    return phpJsonEncode({
      success: false,
      message: "Invalid request method.",
    });
  }

  const id = phpCastInt(postParamOr(request, "id", "0"));
  const new_date = phpTrim(postParamOr(request, "appointment_date", ""));
  const mechanic_id = phpCastInt(postParamOr(request, "mechanic_id", "0"));

  if (id <= 0 || !isValidDate(new_date) || mechanic_id <= 0) {
    return phpJsonEncode({
      success: false,
      message: "Invalid parameters provided.",
    });
  }
  if (new_date < phpToday()) {
    return phpJsonEncode({
      success: false,
      message: "Appointment date cannot be in the past.",
    });
  }

  beginBookingLock(db);
  let committed = false;
  try {
    const appointment = db
      .prepare("SELECT * FROM appointments WHERE id = ?")
      .get(id);
    if (appointment === undefined) {
      return phpJsonEncode({
        success: false,
        message: "Appointment not found.",
      });
    }

    const mechanic = db
      .prepare("SELECT * FROM mechanics WHERE id = ?")
      .get(mechanic_id);
    if (mechanic === undefined) {
      return phpJsonEncode({
        success: false,
        message: "Target mechanic does not exist.",
      });
    }

    const duplicate = db
      .prepare(
        "SELECT id FROM appointments WHERE appointment_date = ? AND (phone = ? OR car_license = ?) AND id != ? AND status != 'cancelled'",
      )
      .get(
        new_date,
        asText(appointment["phone"]),
        asText(appointment["car_license"]),
        id,
      );
    if (duplicate !== undefined) {
      return phpJsonEncode({
        success: false,
        message:
          "Cannot change date: Client already has another appointment on " +
          new_date +
          ".",
      });
    }

    const capRow = db
      .prepare(
        "SELECT COUNT(*) as booked FROM appointments WHERE mechanic_id = ? AND appointment_date = ? AND id != ? AND status != 'cancelled'",
      )
      .get(mechanic_id, new_date, id);
    const bookedCount = asInt(capRow === undefined ? null : capRow["booked"]);
    const maxSlots = asInt(mechanic["max_daily_slots"]);

    if (bookedCount >= maxSlots) {
      return phpJsonEncode({
        success: false,
        message:
          "Mechanic " +
          asText(mechanic["name"]) +
          " is fully occupied (" +
          bookedCount +
          "/" +
          maxSlots +
          ") on " +
          new_date +
          ". Choose another mechanic.",
      });
    }

    db.prepare(
      "UPDATE appointments SET appointment_date = ?, mechanic_id = ? WHERE id = ?",
    ).run(new_date, mechanic_id, id);
    commitBooking(db);
    committed = true;

    return phpJsonEncode({
      success: true,
      message:
        "Appointment updated successfully to " +
        new_date +
        " with " +
        asText(mechanic["name"]) +
        ".",
    });
  } finally {
    if (!committed) {
      rollbackBooking(db);
    }
  }
}

export function cancelAppointment(
  db: DatabaseSync,
  request: PhpRequest,
): string {
  if (request.method !== "POST") {
    return phpJsonEncode({
      success: false,
      message: "Invalid request method.",
    });
  }

  const id = phpCastInt(postParamOr(request, "id", "0"));
  if (id <= 0) {
    return phpJsonEncode({
      success: false,
      message: "Invalid appointment ID.",
    });
  }

  // execute() only returns false on an error that PDO reports as an
  // exception, so PHP always reaches the success branch here.
  db.prepare("DELETE FROM appointments WHERE id = ?").run(id);

  return phpJsonEncode({
    success: true,
    message: "Appointment cancelled/deleted successfully.",
  });
}

export function handleAction(db: DatabaseSync, request: PhpRequest): string {
  const fromGet = getParam(request, "action");
  const raw =
    fromGet !== null ? fromGet : postParamOr(request, "action", "");
  const action = phpTrim(raw);
  switch (action) {
    case "get_slots":
      return getSlots(db, request);
    case "book":
      return bookAppointment(db, request);
    case "get_appointments":
      return getAppointments(db, request);
    case "update_appointment":
      return updateAppointment(db, request);
    case "cancel_appointment":
      return cancelAppointment(db, request);
    default:
      return phpJsonEncode({ success: false, message: "Invalid action" });
  }
}
