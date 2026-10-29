/**
 * Numeric input helpers shared by every form that takes a whole, positive number.
 *
 * Rules enforced:
 *  - whole numbers only (no decimals)
 *  - positive only: greater than zero (except allowZero=true, which allows 0)
 *  - symbols / letters / negative signs are stripped, never stored
 *  - never returns NaN
 */
export function toWholeNumber(
  rawValue,
  { min = 1, max = Infinity, fallback = min } = {},
) {
  const digits = String(rawValue ?? "").replace(/[^0-9]/g, "");
  if (!digits) return fallback;
  const parsed = Number.parseInt(digits, 10);
  if (Number.isNaN(parsed)) return fallback;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return parsed;
}

/** onChange handler factory: keeps the raw text clean and stores a safe number. */
export function handleWholeNumberInput(
  setter,
  { min = 1, max = Infinity, fallback = min, allowEmpty = false } = {},
) {
  return (event) => {
    const raw = event.target.value;
    const digits = String(raw).replace(/[^0-9]/g, "");
    if (!digits) {
      setter(allowEmpty ? "" : fallback);
      return;
    }
    const parsed = Number.parseInt(digits, 10);
    if (Number.isNaN(parsed)) {
      setter(allowEmpty ? "" : fallback);
      return;
    }
    setter(Math.min(Math.max(parsed, min), max));
  };
}

/** Keeps only the digit characters — for inputs storing the raw string. */
/**
 * Filters out any non-digit characters from the input value
 * @param {any} rawValue - The input value to be processed
 * @returns {string} A string containing only the digits from the input value
 */
export function onlyDigits(rawValue) {
  return String(rawValue ?? "").replace(/[^0-9]/g, "");
  
}
