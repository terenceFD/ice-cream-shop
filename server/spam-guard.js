// Spam protection for public forms, built around a honeypot field.
// A hidden field real visitors never see, named to look tempting to bots. A bot
// filling every input fills it too; a value in it means the "visitor" is a script.
// Submit timing is reported as a signal but never blocks: a fast human would
// otherwise get a success reply while their submission was thrown away.
import { HONEYPOT_FIELD, MIN_FORM_SECONDS } from "../shared/formGuard.js";

export { HONEYPOT_FIELD, MIN_FORM_SECONDS };

export function isSpamSubmission(body) {
  const honeypot =
    typeof body?.[HONEYPOT_FIELD] === "string"
      ? body[HONEYPOT_FIELD].trim()
      : "";
  if (honeypot) return { spam: true, reason: "honeypot" };

  const opened = Number(body?.formOpenedAt);
  if (Number.isSafeInteger(opened) && opened > 0) {
    const elapsed = (Date.now() - opened) / 1000;
    if (elapsed < MIN_FORM_SECONDS) return { spam: false, reason: "too-fast" };
  }
  return { spam: false, reason: "" };
}
