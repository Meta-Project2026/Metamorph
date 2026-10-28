// PHP 7.4.33, 64-bit numeric-string casts measured by MMP-049's public probe.
// Only ID coercion and the two original non-UCP PCRE classes are adapted here.
const MIN = -9223372036854775808n;
const MAX = 9223372036854775807n;
export function phpInt(input: string | null): bigint {
  const token =
    /^[ \t\n\r\f\v]*([+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?)/.exec(
      input ?? "",
    )?.[1];
  if (token === undefined) return 0n;
  if (!/[.eE]/.test(token)) {
    const exact = BigInt(token);
    if (exact >= MIN && exact <= MAX) return exact;
  }
  // PHP uses double conversion for decimal/exponent and overflowing integers.
  const value = Number.parseFloat(token);
  if (!Number.isFinite(value)) return 0n;
  if (value >= 2 ** 63) return MAX;
  if (value <= -(2 ** 63)) return MIN;
  return BigInt(Math.trunc(value));
}
export const phonePattern = /^[0-9+ \t\n\r\f\v\-()]{6,20}$/;
export const enginePattern = /^[a-zA-Z0-9 \t\n\r\f\v-]+$/;
