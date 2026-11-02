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

// PHP scalar semantics the migrated handlers rely on: trim's exact character
// set, loose emptiness ("0" counts as empty), leading-numeric integer casts,
// the Gregorian checkdate rule, the Asia/Dhaka "today", the "F j, Y" date
// format and PHP's top-level parameter name mangling.

function isPhpTrimChar(code: number): boolean {
  return (
    code === 0x20 ||
    code === 0x09 ||
    code === 0x0a ||
    code === 0x0d ||
    code === 0x00 ||
    code === 0x0b
  );
}

export function phpTrim(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && isPhpTrimChar(value.charCodeAt(start))) {
    start += 1;
  }
  while (end > start && isPhpTrimChar(value.charCodeAt(end - 1))) {
    end -= 1;
  }
  return value.slice(start, end);
}

export function phpEmpty(value: string): boolean {
  return value === "" || value === "0";
}

// PHP (int) on strings parses the leading integer part only; anything else
// yields 0. PCRE-style leading whitespace and an optional sign are allowed.
export function phpInt(value: string): number {
  const match = /^[ \t\n\r\x00\x0B]*([+-]?[0-9]+)/u.exec(value);
  if (match === null) {
    return 0;
  }
  return parseInt(match[1] ?? "", 10);
}

export function phpCastInt(
  value: string | number | bigint | Uint8Array | null | undefined,
): number {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === "number") {
    return Math.trunc(value);
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (value instanceof Uint8Array) {
    // node:sqlite surfaces BLOB values (and some aggregates) as Uint8Array;
    // PHP implicitly casts such bytes to integer through their string form,
    // so decode the bytes and fall through to the leading-numeric rule.
    return phpInt(new TextDecoder().decode(value));
  }
  return phpInt(value);
}

// PHP checkdate(): Gregorian month 1-12, day within the month, year 1-32767.
export function phpCheckdate(
  month: number,
  day: number,
  year: number,
): boolean {
  if (year < 1 || year > 32767) {
    return false;
  }
  if (month < 1 || month > 12) {
    return false;
  }
  if (day < 1) {
    return false;
  }
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [
    31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
  ];
  return day <= (daysInMonth[month - 1] ?? 0);
}

// PHP date('Y-m-d') with APP_TIMEZONE Asia/Dhaka, which stays UTC+06:00 all
// year (no DST since 2009), so shifting the UTC clock by six hours and taking
// the date part reproduces the workshop's "today".
export function phpToday(): string {
  return new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// PHP date('F j, Y', strtotime($date)) for an already validated YYYY-MM-DD:
// full month name, day without a leading zero, four-digit year.
export function formatPhpDateLong(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})\n?$/.exec(date);
  if (match === null) {
    return date;
  }
  const month = Number(match[2] ?? "0");
  const day = Number(match[3] ?? "0");
  const monthName = MONTH_NAMES[month - 1];
  if (monthName === undefined) {
    return date;
  }
  return monthName + " " + day + ", " + (match[1] ?? date);
}

// PHP rewrites dots and spaces in top-level parameter names to underscores
// and strips leading whitespace from them.
export function phpKeyName(name: string): string {
  const stripped = name.replace(/^[ \t\n\r\x00\x0B]+/, "");
  return stripped.replace(/[. ]/g, "_");
}
