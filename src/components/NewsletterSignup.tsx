import { useEffect, useId, useRef, useState } from "react";
import { apiRequest } from "../api/api";
import { useLanguage } from "../language/useLanguage";
import { photoSrcSet } from "../lib/thumbnails";
import { HONEYPOT_FIELD } from "../../shared/formGuard.js";

// Footer newsletter signup. Submitting records the address on the server;
// success and error states are announced to screen readers, and the hidden
// honeypot field silently drops bot submissions server-side.
export function NewsletterSignup({ variant = "footer" }: { variant?: "footer" | "home" }) {
  const { t } = useLanguage();
  const emailId = useId();
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

  if (variant === "home") {
    return (
      <section
        aria-labelledby="home-news-heading"
        className="bg-[#fbfaf5] px-5 py-8 text-brand-navy sm:px-8 lg:px-10"
      >
        <div className="mx-auto flex max-w-[1320px] flex-col gap-5 border border-[#dcd8cc] bg-white p-4 sm:p-5 lg:flex-row lg:items-center lg:gap-8">
          <div className="h-36 w-full shrink-0 overflow-hidden bg-[#d7e7a8] sm:h-40 lg:size-44">
            <img
              alt=""
              className="size-full object-cover transition-transform duration-700 ease-out hover:scale-[1.03] motion-reduce:transform-none"
              decoding="async"
              height={176}
              loading="lazy"
              sizes="(min-width: 1024px) 176px, 100vw"
              src="/ice-images/ice-10.jpg"
              srcSet={photoSrcSet("/ice-images/ice-10.jpg")}
              width={176}
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-md">
              <h2
                className="font-display text-3xl font-extrabold leading-none tracking-tight text-brand-navy sm:text-4xl"
                id="home-news-heading"
              >
                {t("Sweet news, no spam")}
              </h2>
              <p className="mt-2 text-base leading-6 text-[#65748a]">
                {t("Get new flavors and members-only offers in your inbox.")}
              </p>
            </div>
            {status === "done" ? (
              <p
                className="flex min-h-12 w-full items-center gap-3 border border-[#dce3eb] bg-[#fbfaf5] px-5 text-base font-bold text-brand-navy lg:max-w-md"
                role="status"
              >
                <span
                  aria-hidden="true"
                  className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-yellow text-brand-navy"
                >
                  <svg className="size-4" fill="none" viewBox="0 0 16 16">
                    <path
                      d="m3 8 3.2 3.2L13 4.5"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                </span>
                {message}
              </p>
            ) : (
              <form className="relative w-full lg:max-w-md lg:shrink-0" onSubmit={handleSubmit}>
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
                <label className="sr-only" htmlFor={emailId}>
                  {t("Email address")}
                </label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    autoComplete="email"
                    className="min-h-12 w-full flex-1 border border-[#dcd8cc] bg-white px-4 text-base font-semibold text-brand-navy outline-none transition placeholder:font-medium placeholder:text-[#65748a] hover:border-brand-navy focus:border-brand-navy"
                    id={emailId}
                    name="email"
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder={t("you@example.com")}
                    required
                    type="email"
                    value={email}
                  />
                  <button
                    className="group inline-flex min-h-12 shrink-0 items-center justify-center gap-3 bg-brand-navy px-6 py-3 text-base font-bold text-white transition duration-150 hover:-translate-y-px hover:bg-brand-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2 active:translate-y-px active:scale-[0.985] disabled:cursor-wait disabled:opacity-60 motion-reduce:transform-none"
                    disabled={status === "submitting"}
                    type="submit"
                  >
                    {status === "submitting" ? t("Subscribing…") : t("Subscribe")}
                    <span
                      aria-hidden="true"
                      className="grid size-7 place-items-center rounded-full bg-brand-yellow text-brand-navy transition-transform duration-150 group-hover:translate-x-[3px] motion-reduce:transform-none"
                    >
                      <svg className="size-4" fill="none" viewBox="0 0 20 20">
                        <path
                          d="M3.5 10h12m-5-5 5 5-5 5"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.8"
                        />
                      </svg>
                    </span>
                  </button>
                </div>
                {status === "error" && (
                  <p className="mt-3 text-sm font-semibold text-red-700" role="alert">
                    {message}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      </section>
    );
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
          <label className="sr-only" htmlFor={emailId}>
            {t("Email address")}
          </label>
          <input
            autoComplete="email"
            className="min-h-11 w-full flex-1 rounded-lg border border-white/20 bg-white/[0.08] px-4 text-sm font-semibold text-white outline-none transition placeholder:text-white/45 hover:border-white/35 focus:border-brand-yellow focus:bg-white/[0.12] focus:ring-2 focus:ring-brand-yellow/40"
            id={emailId}
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
