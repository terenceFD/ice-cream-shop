import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { getCustomerToken } from "../api/api";
import { useAuth } from "../context/useAuth";
import { useLanguage } from "../language/useLanguage";
import {
  disablePromotionAlerts,
  enablePromotionAlerts,
  getPromotionAlertState,
  PROMOTION_ALERTS_CHANGED_EVENT,
  syncPromotionAlerts,
  type PromotionAlertState,
} from "../lib/pushNotifications";

const SNOOZE_KEY = "cold-stone-promotion-alerts-snoozed";
const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;
const SHOW_AFTER_MS = 4000;
// Never interrupt checkout, payment or admin work.
const QUIET_PATHS = ["/admin", "/checkout", "/payment"];

function snoozeKey(customerId: number) {
  return `${SNOOZE_KEY}:${customerId}`;
}

function recentlySnoozed(customerId: number) {
  try {
    return Date.now() - Number(localStorage.getItem(snoozeKey(customerId)) || 0) < SNOOZE_MS;
  } catch {
    return false;
  }
}

function usePromotionAlertState(enabled: boolean) {
  const [state, setState] = useState<PromotionAlertState | null>(null);
  useEffect(() => {
    if (!enabled) {
      setState(null);
      return undefined;
    }
    let cancelled = false;
    const refresh = () => {
      getPromotionAlertState()
        .then((next) => { if (!cancelled) setState(next); })
        .catch(() => { if (!cancelled) setState("error"); });
    };
    refresh();
    const onVisible = () => { if (!document.hidden) refresh(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    const onChange = (event: Event) => setState((event as CustomEvent<PromotionAlertState>).detail);
    window.addEventListener(PROMOTION_ALERTS_CHANGED_EVENT, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(PROMOTION_ALERTS_CHANGED_EVENT, onChange);
    };
  }, [enabled]);
  return [state, setState] as const;
}

function BellIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M6 9a6 6 0 1 1 12 0c0 4.5 1.5 6.5 2.5 7.5h-17C4.5 15.5 6 13.5 6 9Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M10 19.5a2.2 2.2 0 0 0 4 0" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
    </svg>
  );
}

/** The three moments an alert arrives, as short plain labels with their icons. */
const ALERT_MOMENTS = [
  { label: "When your order is being prepared", path: "M4 6h16M4 12h10M4 18h7" },
  { label: "When it is out for delivery", path: "M3 7h11v8H3zM14 10h4l3 3v2h-7zM6.5 18a1.5 1.5 0 1 0 0-.01M17.5 18a1.5 1.5 0 1 0 0-.01" },
  { label: "When a new promotion launches", path: "M4 9h3l8-4v14l-8-4H4zM17 9.5a3.5 3.5 0 0 1 0 5" },
] as const;

function MomentIcon({ path }: { path: string }) {
  return (
    <svg aria-hidden="true" className="size-3.5 shrink-0" fill="none" viewBox="0 0 24 24">
      <path d={path} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  );
}

/** Invites signed-in customers to get order updates and promotions on this device. Shown once per month at most. */
export function PromotionAlertsPrompt() {
  const { customer } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const [state] = usePromotionAlertState(Boolean(customer));
  const [isVisible, setIsVisible] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState("");

  // A device that already has alerts follows whoever is signed in now.
  useEffect(() => {
    if (!customer || state !== "on") return;
    const token = getCustomerToken();
    if (token) syncPromotionAlerts(token).catch(() => {});
  }, [customer, state]);

  useEffect(() => {
    setIsVisible(false);
    if (!customer || state !== "off" || recentlySnoozed(customer.id)) return undefined;
    // Wait for the install-app card to be dealt with, so two cards never stack up.
    const timer = window.setInterval(() => {
      if (!document.querySelector(".install-app-card")) {
        setIsVisible(true);
        window.clearInterval(timer);
      }
    }, SHOW_AFTER_MS);
    return () => window.clearInterval(timer);
  }, [customer, state]);

  if (!customer || !isVisible || state !== "off" || QUIET_PATHS.some((path) => location.pathname.startsWith(path))) {
    return null;
  }

  function snooze() {
    setIsVisible(false);
    try {
      if (customer) localStorage.setItem(snoozeKey(customer.id), String(Date.now()));
    } catch {
      // Without storage the invitation simply returns on the next visit.
    }
  }

  async function turnOn() {
    setIsWorking(true);
    setError("");
    try {
      const next = await enablePromotionAlerts(getCustomerToken());
      if (next === "on") setIsVisible(false);
      else if (next === "denied") setError(t("Notifications are blocked for this site. Allow them in your browser settings to get order updates and promotions."));
      else snooze();
    } catch (alertError) {
      setError(alertError instanceof Error ? t(alertError.message) : t("Notifications could not be turned on. Please try again."));
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <section
      aria-labelledby="promotion-alerts-title"
      className="fixed inset-x-3 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-[54] sm:inset-x-auto sm:left-6 sm:w-[24rem]"
      role="dialog"
    >
      <div className="relative overflow-hidden rounded-[20px] bg-brand-cream text-brand-navy shadow-[0_16px_40px_-12px_rgba(71,42,59,0.35)] ring-1 ring-brand-border-warm">
        {/* Header: the shop's app icon with a small alert badge, the one claim,
            and the close control in the corner where a card expects it. */}
        <div className="flex items-start gap-3.5 border-b border-brand-border-warm bg-white px-4 pb-4 pt-4 sm:px-5">
          <span className="relative shrink-0">
            <img decoding="async" loading="lazy" alt="" className="size-11 rounded-[14px] ring-1 ring-black/5" height={44} src="/icons/icon-192.png" width={44} />
            <span aria-hidden="true" className="absolute -bottom-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-brand-yellow text-brand-navy ring-2 ring-white">
              <BellIcon className="size-3" />
            </span>
          </span>
          <div className="min-w-0 pr-6">
            <h2 className="font-display text-[15px] font-extrabold leading-snug" id="promotion-alerts-title">
              {t("Order updates on this device")}
            </h2>
            <p className="mt-0.5 text-[13px] leading-5 text-brand-gray">
              {t("Get a notification when your order is being prepared, out for delivery or delivered, and when a new promotion launches.")}
            </p>
          </div>
          <button
            aria-label={t("Close")}
            className="absolute right-2.5 top-2.5 grid size-8 place-items-center rounded-lg text-brand-gray transition hover:bg-brand-surface hover:text-brand-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow-deep"
            onClick={snooze}
            type="button"
          >
            <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
            </svg>
          </button>
        </div>
        <div className="px-4 py-4 sm:px-5">
          <ul className="grid gap-1.5">
            {ALERT_MOMENTS.map((moment) => (
              <li
                className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 text-[13px] font-medium text-brand-navy"
                key={moment.label}
              >
                <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-md bg-brand-yellow/25 text-brand-navy">
                  <MomentIcon path={moment.path} />
                </span>
                {t(moment.label)}
              </li>
            ))}
          </ul>
          {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700" role="alert">{error}</p>}
          <div className="mt-4 grid grid-cols-[auto_1fr] gap-2.5">
            <button
              className="min-h-11 whitespace-nowrap rounded-xl border border-brand-border-warm bg-white px-3.5 text-sm font-bold text-brand-navy transition hover:bg-brand-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow-deep active:scale-[0.98]"
              onClick={snooze}
              type="button"
            >
              {t("Not now")}
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-brand-navy px-3 text-[13px] font-extrabold text-white transition hover:bg-brand-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow-deep active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
              disabled={isWorking}
              onClick={turnOn}
              type="button"
            >
              <BellIcon className="size-4" />
              {isWorking ? t("Turning on…") : t("Turn on notifications")}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/** On/off switch for the account page and the order confirmation page. */
export function PromotionAlertsSetting() {
  const { customer } = useAuth();
  const { t } = useLanguage();
  const [state, setState] = usePromotionAlertState(Boolean(customer));
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState("");

  if (!customer || state === null || state === "unavailable") return null;

  const isOn = state === "on";
  const canToggle = state === "on" || state === "off" || state === "error";
  const help = {
    on: t("You'll get a notification on this device at each step of your orders and when we launch a new promotion."),
    off: t("Turn on to follow your orders (preparing, out for delivery, delivered) and hear about new promotions on this device."),
    denied: t("Notifications are blocked for this site. Allow them in your browser settings, then come back here."),
    "needs-install": t("On iPhone and iPad, add this site to your Home Screen first, then open it from there to turn on alerts."),
    unsupported: t("This browser can't show notifications from websites."),
    error: t("Notifications could not be loaded. Check your connection and tap to retry."),
  }[state];

  async function toggle() {
    setIsWorking(true);
    setError("");
    try {
      const token = getCustomerToken();
      if (state === "error") {
        setState(await getPromotionAlertState());
        return;
      }
      const next = isOn ? await disablePromotionAlerts(token) : await enablePromotionAlerts(token);
      setState(next);
      if (!isOn && next === "off") setError(t("Notification permission was not granted. Tap again and choose Allow to turn on alerts."));
    } catch (alertError) {
      setError(alertError instanceof Error ? t(alertError.message) : t("Notifications could not be updated. Please try again."));
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-[22px] bg-white p-4 shadow-[0_12px_30px_-18px_rgba(9,42,83,0.35)] ring-1 ring-[#dce3eb] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-4 sm:p-5">
      <span aria-hidden="true" className={`grid size-11 shrink-0 place-items-center rounded-2xl ${isOn ? "bg-brand-yellow text-brand-navy" : "bg-[#f4f6f8] text-[#65748a]"}`}>
        <BellIcon />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-brand-navy" id="promotion-alerts-setting">{t("Order updates and promotions")}</p>
        <p className="mt-1 text-sm leading-6 text-[#65748a]" role="status">{help}</p>
        {state === "needs-install" && <p className="mt-2 text-sm leading-6 text-[#65748a]">{t("In Safari, tap Share, then Add to Home Screen. Open the installed app and sign in, then enable notifications here. Requires iOS or iPadOS 16.4 or later.")}</p>}
        {error && <p className="mt-2 text-sm font-semibold text-red-700" role="alert">{error}</p>}
      </div>
      {canToggle && (
        <button
          aria-checked={isOn}
          aria-labelledby="promotion-alerts-setting"
          aria-busy={isWorking}
          className="col-start-2 inline-flex min-h-11 items-center justify-between gap-3 justify-self-start rounded-xl bg-[#f4f6f8] px-3 py-2 text-sm font-semibold text-brand-navy transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow-deep disabled:cursor-wait disabled:opacity-60 sm:col-start-3 sm:row-start-1"
          disabled={isWorking}
          onClick={toggle}
          role="switch"
          type="button"
        >
          <span>{isWorking ? t("Updating…") : state === "error" ? t("Try again") : isOn ? t("Enabled") : t("Enable notifications")}</span>
          <span aria-hidden="true" className={`relative h-7 w-12 shrink-0 rounded-full ${isOn ? "bg-[#35a36b]" : "bg-[#c4cedb]"}`}>
            <span className={`absolute left-0.5 top-0.5 size-6 rounded-full bg-white shadow transition ${isOn ? "translate-x-5" : ""}`} />
          </span>
        </button>
      )}
    </div>
  );
}
