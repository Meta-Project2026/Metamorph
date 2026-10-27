export class BridgeError extends Error {
  constructor(code) {
    super(code);
    this.name = "BridgeError";
    this.code = code;
  }
}
export function requireCheck(value, code = "BRIDGE_INVALID") {
  if (!value) throw new BridgeError(code);
}
export function fields(value, keys, code = "WIRE_FIELDS") {
  requireCheck(
    value && typeof value === "object" && !Array.isArray(value),
    code,
  );
  requireCheck(
    Object.keys(value).sort().join(",") === [...keys].sort().join(","),
    code,
  );
  return value;
}
export function utf8(value) {
  requireCheck(
    typeof value === "string" &&
      new TextDecoder("utf-8", { fatal: true }).decode(Buffer.from(value)) ===
        value,
    "UTF8_ERROR",
  );
  return value;
}
/** JSON.parse establishes grammar; a second walk rejects duplicate (also escaped) keys. */
export function strictJson(input, maxBytes = 8 * 1024 * 1024) {
  requireCheck(
    typeof input === "string" && Buffer.byteLength(input) <= maxBytes,
    "WIRE_LIMIT",
  );
  utf8(input);
  let value;
  try {
    value = JSON.parse(input);
  } catch {
    throw new BridgeError("WIRE_JSON");
  }
  const tokens =
    input.match(
      /"(?:\\.|[^"\\])*"|[{}[\],:]|true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/g,
    ) ?? [];
  let cursor = 0;
  const scan = (depth) => {
    requireCheck(depth <= 100, "WIRE_DEPTH");
    const token = tokens[cursor++];
    if (token === "{") {
      const seen = new Set();
      if (tokens[cursor] !== "}") {
        do {
          const key = JSON.parse(tokens[cursor++]);
          requireCheck(!seen.has(key), "WIRE_DUPLICATE_KEY");
          seen.add(key);
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
    } else if (token && /^-?\d/.test(token))
      requireCheck(Number.isFinite(Number(token)), "WIRE_NUMBER");
  };
  scan(0);
  requireCheck(cursor === tokens.length, "WIRE_JSON");
  return value;
}
export function base64(value, limit) {
  requireCheck(
    typeof value === "string" &&
      value.length <= Math.ceil(limit / 3) * 4 &&
      /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
        value,
      ),
    "HTTP_BASE64",
  );
  const bytes = Buffer.from(value, "base64");
  requireCheck(
    bytes.length <= limit && bytes.toString("base64") === value,
    "HTTP_BASE64",
  );
  return bytes;
}
export const lexical = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
