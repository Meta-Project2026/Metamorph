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

// Mirror config.php: settings defined from the environment with upstream
// defaults, a SQLite connection singleton, the original schema SQL and the
// idempotent mechanic seed. The migration target supplies no application
// configuration environment variables, so the defaults apply.
import { DatabaseSync } from "node:sqlite";
import { phpCastInt } from "./phpcompat.js";

export function defineSetting(name: string, defaultValue: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    return defaultValue;
  }
  return value;
}

export const DB_DRIVER = defineSetting("DB_DRIVER", "sqlite");
export const DB_HOST = defineSetting("DB_HOST", "localhost");
export const DB_PORT = defineSetting("DB_PORT", "3306");
export const DB_NAME = defineSetting("DB_NAME", "car_workshop_db");
export const DB_USER = defineSetting("DB_USER", "root");
export const DB_PASS = defineSetting("DB_PASS", "");

// config.php defaults to a SQLite file next to the PHP script; the migration
// target pins the database to /state/target.sqlite instead.
export const SQLITE_FILE = defineSetting("SQLITE_FILE", "/state/target.sqlite");

// "Today" decides which dates can be booked, so it has to be the workshop's
// today, not the server's.
export const APP_TIMEZONE = defineSetting("APP_TIMEZONE", "Asia/Dhaka");

let connection: DatabaseSync | null = null;

export function getDBConnection(): DatabaseSync {
  if (connection !== null) {
    return connection;
  }
  // MySQL is outside the declared migration scope, so the target always takes
  // the SQLite path of getDBConnection(): open the database, create the
  // tables if missing, then seed empty mechanics.
  const db = new DatabaseSync(SQLITE_FILE);
  initSQLiteTables(db);
  ensureSeeded(db);
  connection = db;
  return db;
}

export function initSQLiteTables(db: DatabaseSync): void {
  db.exec(`
        CREATE TABLE IF NOT EXISTS mechanics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            specialty TEXT NOT NULL,
            phone TEXT NOT NULL,
            max_daily_slots INTEGER NOT NULL DEFAULT 4,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS appointments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_name TEXT NOT NULL,
            address TEXT NOT NULL,
            phone TEXT NOT NULL,
            car_license TEXT NOT NULL,
            car_engine TEXT NOT NULL,
            appointment_date TEXT NOT NULL,
            mechanic_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'approved',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (mechanic_id) REFERENCES mechanics(id) ON DELETE CASCADE
        );
    `);
}

export function ensureSeeded(db: DatabaseSync): void {
  try {
    const row = db.prepare("SELECT COUNT(*) as cnt FROM mechanics").get();
    if (row !== undefined && phpCastInt(row["cnt"] ?? null) === 0) {
      const seed: [number, string, string, string, number][] = [
        [1, "Karim Rahman", "Engine Overhaul & Diagnostics", "+880 1711-000001", 4],
        [2, "Tanvir Ahmed", "Transmission & Gearbox Expert", "+880 1711-000002", 4],
        [3, "Rahim Uddin", "Auto Electrical & ECU Tuning", "+880 1711-000003", 4],
        [4, "Shafiqul Islam", "Brake Systems & Suspension", "+880 1711-000004", 4],
        [5, "Mahfuz Khan", "Hybrid & AC Climate Control", "+880 1711-000005", 4],
      ];
      const insert = db.prepare(
        "INSERT INTO mechanics (id, name, specialty, phone, max_daily_slots) VALUES (?, ?, ?, ?, ?)",
      );
      for (const mechanic of seed) {
        insert.run(mechanic[0], mechanic[1], mechanic[2], mechanic[3], mechanic[4]);
      }
    }
  } catch {
    // PHP swallows seeding failures with an empty catch block.
  }
}
