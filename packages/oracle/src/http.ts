export interface HttpObservation {
  status: number;
  headers: Readonly<Record<string, string>>;
  body: Uint8Array;
}

export interface Difference {
  code: string;
  path: string;
}

// Trusted, versioned policy. No agent-supplied normalization or ignore rules.
export const NORMALIZATION_VERSION = "oracle-exact-v1";
export const STABLE_HEADERS = Object.freeze([
  "content-type",
  "location",
  "cache-control",
  "allow",
]);

const MAX_BODY_BYTES = 1024 * 1024;

function headerMap(headers: HttpObservation["headers"]): Map<string, string> {
  if (!headers || typeof headers !== "object" || Array.isArray(headers)) {
    throw new Error("Invalid HTTP headers");
  }
  const result = new Map<string, string>();
  for (const [name, value] of Object.entries(headers)) {
    const key = name.toLowerCase();
    if (!/^[!#$%&'*+.^_`|~0-9a-z-]+$/.test(key) || typeof value !== "string") {
      throw new Error("Invalid HTTP header");
    }
    if (result.has(key)) throw new Error("Duplicate HTTP header spelling");
    result.set(key, value);
  }
  return result;
}

export function validateHttp(value: HttpObservation): void {
  if (
    !Number.isInteger(value.status) ||
    value.status < 100 ||
    value.status > 599
  ) {
    throw new Error("Invalid HTTP status");
  }
  if (
    !(value.body instanceof Uint8Array) ||
    value.body.length > MAX_BODY_BYTES
  ) {
    throw new Error("Invalid or oversized HTTP body");
  }
  if (!headerMap(value.headers).has("content-type")) {
    throw new Error("Missing content-type observation");
  }
}

function isJson(contentType: string): boolean {
  const media = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return (
    media === "application/json" || /^application\/[^/;]+\+json$/.test(media)
  );
}

function parseJson(bytes: Uint8Array): unknown {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const value: unknown = JSON.parse(text);
  // JSON.parse alone silently drops duplicate keys and rounds decimal numbers.
  const tokens =
    text.match(
      /"(?:\\.|[^"\\])*"|[{}[\],:]|true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/g,
    ) ?? [];
  let cursor = 0;
  const scan = (depth: number) => {
    if (depth > 100) throw new Error("JSON nesting exceeds trusted limit");
    const token = tokens[cursor++];
    if (token === "{") {
      const keys = new Set<string>();
      if (tokens[cursor] !== "}") {
        do {
          const key: string = JSON.parse(tokens[cursor++] ?? "");
          if (keys.has(key)) throw new Error("Ambiguous duplicate JSON member");
          keys.add(key);
          cursor++;
          scan(depth + 1);
        } while (tokens[cursor++] === ",");
      } else cursor++;
    } else if (token === "[") {
      if (tokens[cursor] !== "]") {
        do {
          scan(depth + 1);
        } while (tokens[cursor++] === ",");
      } else cursor++;
    } else if (token && /^-?\d/.test(token)) {
      if (decimal(token) !== decimal(String(Number(token))))
        throw new Error("JSON number would lose precision");
    }
  };
  scan(0);
  return value;
}

function decimal(token: string): string {
  if (token.length > 128) throw new Error("JSON number exceeds trusted limit");
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(token);
  if (!match) throw new Error("Nonfinite JSON number");
  const fraction = match[3] ?? "";
  let coefficient = `${match[2]}${fraction}`.replace(/^0+/, "");
  if (coefficient === "") return "0";
  const trailing = coefficient.length - coefficient.replace(/0+$/, "").length;
  coefficient = coefficient.slice(0, coefficient.length - trailing);
  const exponent = Number(match[4] ?? 0) - fraction.length + trailing;
  if (!Number.isSafeInteger(exponent))
    throw new Error("JSON exponent exceeds trusted limit");
  return `${match[1]}${coefficient}e${exponent}`;
}

function kind(value: unknown): string {
  if (value === null) return "null";
  return Array.isArray(value) ? "array" : typeof value;
}

function validateJson(value: unknown, depth = 0): void {
  if (depth > 100) throw new Error("JSON nesting exceeds trusted limit");
  if (
    typeof value === "number" &&
    (!Number.isFinite(value) ||
      (Number.isInteger(value) && !Number.isSafeInteger(value)))
  ) {
    throw new Error("JSON number cannot be compared losslessly");
  }
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) validateJson(child, depth + 1);
  }
}

function jsonDiff(
  left: unknown,
  right: unknown,
  path: string,
  diffs: Difference[],
): void {
  if (kind(left) !== kind(right)) {
    diffs.push({ code: "HTTP_JSON_TYPE", path });
  } else if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length)
      diffs.push({ code: "HTTP_JSON_LENGTH", path });
    for (let index = 0; index < Math.min(left.length, right.length); index++) {
      jsonDiff(left[index], right[index], `${path}/${index}`, diffs);
    }
  } else if (
    left !== null &&
    typeof left === "object" &&
    right !== null &&
    typeof right === "object"
  ) {
    const a = left as Record<string, unknown>;
    const b = right as Record<string, unknown>;
    for (const key of [
      ...new Set([...Object.keys(a), ...Object.keys(b)]),
    ].sort()) {
      const child = `${path}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`;
      if (!Object.hasOwn(a, key) || !Object.hasOwn(b, key)) {
        diffs.push({ code: "HTTP_JSON_MISSING", path: child });
      } else {
        jsonDiff(a[key], b[key], child, diffs);
      }
    }
  } else if (left !== right) {
    diffs.push({ code: "HTTP_JSON_VALUE", path });
  }
}

export function compareHttp(
  left: HttpObservation,
  right: HttpObservation,
): Difference[] {
  validateHttp(left);
  validateHttp(right);
  const a = headerMap(left.headers);
  const b = headerMap(right.headers);
  const diffs: Difference[] = [];
  if (left.status !== right.status)
    diffs.push({ code: "HTTP_STATUS", path: "/status" });
  for (const name of STABLE_HEADERS) {
    if (a.get(name) !== b.get(name))
      diffs.push({ code: "HTTP_HEADER", path: `/headers/${name}` });
  }
  if (
    isJson(a.get("content-type") ?? "") &&
    isJson(b.get("content-type") ?? "")
  ) {
    const jsonA = parseJson(left.body);
    const jsonB = parseJson(right.body);
    validateJson(jsonA);
    validateJson(jsonB);
    jsonDiff(jsonA, jsonB, "/body", diffs);
  } else if (!Buffer.from(left.body).equals(Buffer.from(right.body))) {
    diffs.push({ code: "HTTP_BODY", path: "/body" });
  }
  return diffs;
}
