import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  maybeInitializeAfterConsent,
  readCookieConsent,
  storeCookieConsent,
} from "../lib/analytics";
import { useLanguage } from "../language/useLanguage";

/**
 * Cookie consent banner (EU ePrivacy / GDPR style). The site is cookieless by
 * default — analytics only loads after the visitor accepts — so the banner asks
 * once, stores the answer in localStorage, and stays away afterwards. Shown on
 * every public page except the admin desk.
 */
export function CookieConsentBanner() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Wait a beat so the banner never competes with the hero photo for the first paint.
    const timer = window.setTimeout(
      () => setVisible(readCookieConsent() === null),
      1200,
    );
    return () => window.clearTimeout(timer);
  }, []);

  function decide(accepted: boolean) {
    storeCookieConsent(accepted);
    setVisible(false);
    if (accepted) maybeInitializeAfterConsent();
  }

  if (!visible) return null;

  return (
    <aside
      aria-label={t("Cookie consent")}
      className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-3xl rounded-2xl bg-brand-navy p-5 text-white shadow-[0_20px_60px_rgba(6,29,58,0.45)] ring-1 ring-white/10 sm:inset-x-6 sm:px-7"
      role="region"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-extrabold leading-snug">
            {t("We use cookies — the tasty kind of transparency")}
          </p>
          <p className="mt-1.5 text-sm leading-6 text-white/75">
            {t(
              "This site works without tracking. Accept cookies to help us understand which treats people love, or decline and nothing is measured.",
            )}{" "}
            <Link
              // An inline link inside a paragraph is only as tall as its text (18px).
              // Padding raises the hit area to a thumb-friendly size without moving the
              // line it sits on, because the padding is vertical only.
              className="inline-block py-2 font-bold text-brand-yellow underline decoration-2 underline-offset-2"
              to="/cookies"
            >
              {t("Cookie policy")}
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand-yellow px-5 text-sm font-extrabold text-brand-navy transition hover:bg-brand-gold-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy"
            onClick={() => decide(true)}
            type="button"
          >
            {t("Accept cookies")}
          </button>
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-bold text-white/85 ring-1 ring-white/25 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow"
            onClick={() => decide(false)}
            type="button"
          >
            {t("Decline")}
          </button>
        </div>
      </div>
    </aside>
  );
}
