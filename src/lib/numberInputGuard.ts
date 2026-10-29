/**
 * Global sanitizer for every <input type="number"> on the website.
 *
 * Enforced on all of them, no matter which form they belong to:
 *   - whole numbers only (decimal point, "e", "+"/"-" and every symbol are stripped)
 *   - value must be greater than zero unless the input declares min="0"
 *     (then zero is allowed, but nothing negative ever is)
 *   - an emptied field keeps the empty string (placeholders still show);
 *     anything that parses to NaN falls back to min
 *
 * Mounted once from main.tsx via capture-phase listeners, so it covers inputs
 * rendered now and inputs rendered later, without touching each component.
 */
export function installNumberInputGuard() {
  // Strips everything that is not a digit: symbols, signs, decimal marks, letters.
  const digitsOnly = (value) => value.replace(/[^0-9]/g, "");

  const sanitize = (input) => {
    const min = Number.parseInt(input.min || "", 10);
    const minValue = Number.isFinite(min) ? min : 1; // default: greater than zero
    const raw = input.value;
    const digits = digitsOnly(raw);

    if (digits === "") {
      // Nothing typed yet (or the user cleared it) — allow empty so placeholders
      // and required-field validation keep working.
      if (raw !== "") input.value = "";
      return;
    }

    let parsed = Number.parseInt(digits, 10);
    if (!Number.isFinite(parsed)) parsed = minValue;

    if (parsed < minValue) {
      parsed = minValue;
    }

    const next = String(parsed);
    if (next !== raw) input.value = next;
  };

  // Typing, pasting, drag-drop and autofill all fire `input`.
  document.addEventListener(
    "input",
    (event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement && target.type === "number") {
        sanitize(target);
      }
    },
    true,
  );

  // Losing focus: clamp to min if the field still holds something invalid.
  document.addEventListener(
    "change",
    (event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement && target.type === "number") {
        sanitize(target);
        if (inputValueIsEmpty(target) && target.required) {
          target.value = String(Number.parseInt(target.min || "1", 10) || 1);
        }
      }
    },
    true,
  );

  function inputValueIsEmpty(input) {
    return input.value === "";
  }

  // Block non-digit keystrokes outright so nothing invalid ever flashes.
  document.addEventListener(
    "keydown",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || target.type !== "number")
        return;
      // Allow navigation/editing keys untouched.
      if (
        event.key.length > 1 ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      ) {
        return;
      }
      if (!/[0-9]/.test(event.key)) {
        event.preventDefault();
      }
    },
    true,
  );
}
