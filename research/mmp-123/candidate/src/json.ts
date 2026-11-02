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

// Mirror PHP json_encode defaults: escape "/" as "\/", escape every
// non-ASCII code unit as a lowercase \uXXXX escape (surrogate pairs for
// astral code points), use the short forms \b \f \n \r \t and \u00XX for
// the remaining control characters. Values are built in insertion order so
// object keys serialize exactly like the upstream PHP associative arrays.
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

function encodeString(value: string): string {
  let out = '"';
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code === 0x22) {
      out += '\\"';
    } else if (code === 0x5c) {
      out += "\\\\";
    } else if (code === 0x2f) {
      out += "\\/";
    } else if (code === 0x08) {
      out += "\\b";
    } else if (code === 0x09) {
      out += "\\t";
    } else if (code === 0x0a) {
      out += "\\n";
    } else if (code === 0x0c) {
      out += "\\f";
    } else if (code === 0x0d) {
      out += "\\r";
    } else if (code < 0x20) {
      out += "\\u00" + code.toString(16).padStart(2, "0");
    } else if (code >= 0x80) {
      out += "\\u" + code.toString(16).padStart(4, "0");
    } else {
      out += value.charAt(i);
    }
  }
  return out + '"';
}

function encodeValue(value: JsonValue): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return encodeString(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    // Responses only ever carry integers; PHP emits them as plain digits.
    return String(value);
  }
  if (Array.isArray(value)) {
    let out = "[";
    for (let i = 0; i < value.length; i += 1) {
      if (i > 0) {
        out += ",";
      }
      out += encodeValue(value[i] ?? null);
    }
    return out + "]";
  }
  let out = "{";
  let first = true;
  for (const key of Object.keys(value)) {
    if (!first) {
      out += ",";
    }
    first = false;
    out += encodeString(key) + ":" + encodeValue(value[key] ?? null);
  }
  return out + "}";
}

export function phpJsonEncode(value: JsonValue): string {
  return encodeValue(value);
}
