import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../api/api";
import { useLanguage } from "../language/useLanguage";
import { HONEYPOT_FIELD } from "../../shared/formGuard.js";

// Footer newsletter signup. Submitting records the address on the server;
// success and error states are announced to screen readers, and the hidden
// honeypot field silently drops bot submissions server-side.
export function NewsletterSignup() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | submitting | done | error
  const [message, setMessage] = useState("");
  const openedAt = useRef(0);

  // When the visitor first saw the form. Set in an effect, not at render time.
  useEffect(() => {
    openedAt.current = Date.now();
  }, []);

  // Reset the timing hint if the form stays open for a long time, so a real
  // visitor who leaves the tab open is never mistaken for a bot.
  useEffect(() => {
    const timer = window.setInterval(() => {
      openedAt.current = Date.now();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setMessage("");
    try {
      await apiRequest("/newsletter/subscribe", {
        method: "POST",
        body: {
          email,
          source: "footer",
          [HONEYPOT_FIELD]: "",
          formOpenedAt: openedAt.current,
        },
      });
      setStatus("done");
      setMessage(t("You are on the list! Sweet offers are on their way."));
      setEmail("");
    } catch (subscribeError) {
      setStatus("error");
      setMessage(
        t(
          subscribeError instanceof Error
            ? subscribeError.message
            : "Could not subscribe right now.",
        ),
      );
    }
  }

  return (
    <div>
      <p className="text-base font-bold text-white">
        {t("Sweet news, no spam")}
      </p>
      <p className="mt-1 max-w-xs text-sm leading-6 text-white/70">
        {t("Get new flavors and members-only offers in your inbox.")}
      </p>
      {status === "done" ? (
        <p
          className="mt-4 flex min-h-11 items-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-bold text-brand-yellow"
          role="status"
        >
          <svg
            aria-hidden="true"
            className="size-4 shrink-0"
            fill="none"
            viewBox="0 0 16 16"
          >
            <path
              d="m3 8 3.2 3.2L13 4.5"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
          {message}
        </p>
      ) : (
        <form
          className="mt-4 flex max-w-md flex-col gap-2 sm:flex-row"
          onSubmit={handleSubmit}
        >
          {/* Bot trap: visually hidden and out of the tab order; humans never fill it. */}
          <div
            aria-hidden="true"
            className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
          >
            <label>
              Leave this field empty
              <input
                autoComplete="off"
                name={HONEYPOT_FIELD}
                onChange={(event) => {
                  if (event.target.value) setMessage("");
                }}
                tabIndex={-1}
                type="text"
              />
            </label>
          </div>
          <label className="sr-only" htmlFor="newsletter-email">
            {t("Email address")}
          </label>
          <input
            autoComplete="email"
            className="min-h-11 w-full flex-1 rounded-lg border border-white/20 bg-white/[0.08] px-4 text-sm font-semibold text-white outline-none transition placeholder:text-white/45 hover:border-white/35 focus:border-brand-yellow focus:bg-white/[0.12] focus:ring-2 focus:ring-brand-yellow/40"
            id="newsletter-email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t("you@example.com")}
            required
            type="email"
            value={email}
          />
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-yellow px-5 py-2.5 text-sm font-extrabold text-brand-navy transition-colors hover:bg-brand-gold-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy disabled:cursor-wait disabled:opacity-60"
            disabled={status === "submitting"}
            type="submit"
          >
            {status === "submitting" ? t("Subscribing…") : t("Subscribe")}
          </button>
        </form>
      )}
      {status === "error" && (
        <p className="mt-2 text-sm font-semibold text-red-300" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}
