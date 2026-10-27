// Trusted serialization only; never imports SQLite or candidate code on the host.
export function encode(v) {
  if (v === null) return { type: "null" };
  if (typeof v === "bigint") return { type: "integer", value: String(v) };
  if (typeof v === "number" && Number.isFinite(v))
    return { type: "real", value: v };
  if (typeof v === "string") return { type: "text", value: v };
  if (v instanceof Uint8Array)
    return { type: "blob", value: Buffer.from(v).toString("hex") };
  // JSON would silently turn Infinity into null, losing SQLite scalar meaning.
  throw new Error("UNREPRESENTABLE_SQLITE_VALUE");
}
