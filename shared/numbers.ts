/**
 * Safe numeric coercion helpers.
 *
 * Every value that is supposed to be a number (coming from an <input>, a form,
 * a query string, JSON, a spreadsheet cell, ...) goes through one of these.
 * They NEVER return NaN — the "fallback" is returned instead whenever the
 * value cannot be interpreted as a finite number.
 */

/** Coerce any value to a finite number; never returns NaN. */
export function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === "bigint") return Number(value);

  if (typeof value === "string") {
    // Full-trim: regular spaces, non-breaking spaces, zero-width chars…
    const text = value.replace(/\s|\u00A0|\u200B-\u200D|\uFEFF/g, "");
    if (text === "") return fallback;
    // Reject anything that is not a plain number or decimal.
    // This also rejects hex (0x1A), octal (0o17), binary (0b101), 'Infinity'.
    if (!/^[+-]?(\d+(\.\d+)?|\.\d+)$/.test(text)) return fallback;
    const result = Number(text);
    return Number.isFinite(result) ? result : fallback;
  }

  if (Array.isArray(value)) return fallback;

  return fallback;
}

/**
 * Coerce a value to an integer (whole number).
 * - Truncates 3.7 -> 3, -3.7 -> -3
 * - Never returns NaN; falls back when not numeric.
 */
export function toInt(value: unknown, fallback = 0): number {
  const result = Math.trunc(toNumber(value, NaN));
  return Number.isFinite(result) ? result : fallback;
}

/**
 * Coerce a value to a non-negative integer.
 * - Clamps negatives to 0
 * - Truncates decimals (3.9 -> 3)
 * - Never returns NaN; falls back when not numeric.
 */
export function toNonNegativeInt(value: unknown, fallback = 0): number {
  const result = toInt(value, NaN);
  return Number.isFinite(result) ? Math.max(0, result) : fallback;
}

/**
 * Coerce a value to a positive integer (>= 1).
 * - Clamps values below 1 to 1
 * - Truncates decimals (1.9 -> 1)
 * - Never returns NaN; falls back when not numeric.
 */
export function toPositiveInt(value: unknown, fallback = 1): number {
  const result = toInt(value, NaN);
  return Number.isFinite(result) ? Math.max(1, result) : fallback;
}

/** Coerce any value to a finite number, rounded to the nearest integer. */
export function toRoundedNumber(value: unknown, fallback = 0): number {
  const result = Math.round(toNumber(value, NaN));
  return Number.isFinite(result) ? result : fallback;
}

/** Round a finite number to a given number of decimal places (never NaN). */
export function toFixedNumber(
  value: unknown,
  places = 0,
  fallback = 0,
): number {
  const result = Number(
    toNumber(value, NaN).toFixed(Math.max(0, Math.min(20, places))),
  );
  return Number.isFinite(result) ? result : fallback;
}

/**
 * Coerce a value to an integer stored as a string (for <input type="number">,
 * localStorage, or any text field that is supposed to hold a number).
 * Never returns "NaN".
 */
export function toIntString(value: unknown, fallback = "0"): string {
  const result = toInt(value, NaN);
  return Number.isFinite(result) ? String(result) : fallback;
}
