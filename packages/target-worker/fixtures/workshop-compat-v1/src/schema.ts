/* Adapted from tanjilaafsarirubina/car-workshop@d272170d0aecbd28eb5b13e272d9dd11d545b66c.
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
export const SCHEMA =
  "\n        CREATE TABLE IF NOT EXISTS mechanics (\n            id INTEGER PRIMARY KEY AUTOINCREMENT,\n            name TEXT NOT NULL,\n            specialty TEXT NOT NULL,\n            phone TEXT NOT NULL,\n            max_daily_slots INTEGER NOT NULL DEFAULT 4,\n            created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n        );\n        CREATE TABLE IF NOT EXISTS appointments (\n            id INTEGER PRIMARY KEY AUTOINCREMENT,\n            client_name TEXT NOT NULL,\n            address TEXT NOT NULL,\n            phone TEXT NOT NULL,\n            car_license TEXT NOT NULL,\n            car_engine TEXT NOT NULL,\n            appointment_date TEXT NOT NULL,\n            mechanic_id INTEGER NOT NULL,\n            status TEXT NOT NULL DEFAULT 'approved',\n            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,\n            FOREIGN KEY (mechanic_id) REFERENCES mechanics(id) ON DELETE CASCADE\n        );\n    ";
export const SEEDS = [
  [1, "Karim Rahman", "Engine Overhaul & Diagnostics", "+880 1711-000001", 4],
  [2, "Tanvir Ahmed", "Transmission & Gearbox Expert", "+880 1711-000002", 4],
  [3, "Rahim Uddin", "Auto Electrical & ECU Tuning", "+880 1711-000003", 4],
  [4, "Shafiqul Islam", "Brake Systems & Suspension", "+880 1711-000004", 4],
  [5, "Mahfuz Khan", "Hybrid & AC Climate Control", "+880 1711-000005", 4],
];
