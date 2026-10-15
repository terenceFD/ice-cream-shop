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
    getPromotionAlertState()
      .then((next) => { if (!cancelled) setState(next); })
      .catch(() => { if (!cancelled) setState("unsupported"); });
    const onChange = (event: Event) => setState((event as CustomEvent<PromotionAlertState>).detail);
    window.addEventListener(PROMOTION_ALERTS_CHANGED_EVENT, onChange);
    return () => {
      cancelled = true;
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
      className="fixed inset-x-3 bottom-3 z-[54] sm:inset-x-auto sm:bottom-6 sm:left-6 sm:w-[23rem]"
      role="dialog"
    >
      <div className="relative overflow-hidden rounded-[24px] bg-[#0d3566] text-white shadow-[0_24px_60px_rgba(0,0,0,0.45)] ring-1 ring-white/25">
        <div aria-hidden="true" className="h-1 bg-gradient-to-r from-[#ffdc32] via-[#ffe98a] to-[#ffdc32]" />
        <button
          aria-label={t("Close")}
          className="absolute right-3 top-4 z-10 grid size-8 place-items-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-[#ffdc32]"
          onClick={snooze}
          type="button"
        >
          <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
          </svg>
        </button>
        <div className="relative p-5 sm:p-6">
          <div className="flex items-center gap-3.5 pr-8">
            <span className="relative shrink-0">
              <img decoding="async" loading="lazy" alt="" className="size-12 rounded-2xl ring-1 ring-white/15" height={48} src="/icons/icon-192.png" width={48} />
              <span aria-hidden="true" className="absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full bg-[#ffdc32] text-[#092a53] ring-2 ring-[#0d3566]">
                <BellIcon className="size-3.5" />
              </span>
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#ffdc32]">{t("Stay in the loop")}</p>
              <h2 className="mt-0.5 font-display text-lg font-extrabold leading-tight" id="promotion-alerts-title">
                {t("Order updates and sweet deals")}
              </h2>
            </div>
          </div>
          <p className="mt-3 text-[13px] leading-5 text-white/75">
            {t("Get a notification on this device when your order is being prepared, out for delivery or delivered, and when we launch a new promotion.")}
          </p>
          {error && <p className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-[#ffd4d4]" role="alert">{error}</p>}
          <div className="mt-5 grid grid-cols-[auto_1fr] gap-2.5">
            <button
              className="min-h-11 rounded-xl px-4 text-sm font-bold text-white/80 ring-1 ring-white/20 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffdc32]"
              onClick={snooze}
              type="button"
            >
              {t("Not now")}
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#ffdc32] px-4 text-sm font-extrabold text-[#092a53] shadow-[0_8px_20px_rgba(255,220,50,0.25)] transition hover:bg-[#ffe55c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-wait disabled:opacity-70"
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
  const canToggle = state === "on" || state === "off";
  const help = {
    on: t("You'll get a notification on this device at each step of your orders and when we launch a new promotion."),
    off: t("Turn on to follow your orders (preparing, out for delivery, delivered) and hear about new promotions on this device."),
    denied: t("Notifications are blocked for this site. Allow them in your browser settings, then come back here."),
    "needs-install": t("On iPhone and iPad, add this site to your Home Screen first, then open it from there to turn on alerts."),
    unsupported: t("This browser can't show notifications from websites."),
  }[state];

  async function toggle() {
    setIsWorking(true);
    setError("");
    try {
      const token = getCustomerToken();
      setState(isOn ? await disablePromotionAlerts(token) : await enablePromotionAlerts(token));
    } catch (alertError) {
      setError(alertError instanceof Error ? t(alertError.message) : t("Notifications could not be updated. Please try again."));
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div className="flex items-start gap-4 rounded-[22px] bg-white p-5 shadow-[0_12px_30px_-18px_rgba(9,42,83,0.35)] ring-1 ring-[#e5ebf3]">
      <span aria-hidden="true" className={`grid size-11 shrink-0 place-items-center rounded-2xl ${isOn ? "bg-[#ffdc32] text-[#092a53]" : "bg-[#eef2f7] text-[#4f6379]"}`}>
        <BellIcon />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-[#092a53]" id="promotion-alerts-setting">{t("Order updates and promotions")}</p>
        <p className="mt-1 text-sm leading-6 text-[#65748a]">{help}</p>
        {error && <p className="mt-2 text-sm font-semibold text-red-700" role="alert">{error}</p>}
      </div>
      {canToggle && (
        <button
          aria-checked={isOn}
          aria-labelledby="promotion-alerts-setting"
          className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] disabled:cursor-wait disabled:opacity-60 ${isOn ? "bg-[#35a36b]" : "bg-[#cfd7e1]"}`}
          disabled={isWorking}
          onClick={toggle}
          role="switch"
          type="button"
        >
          <span className={`absolute left-0.5 top-0.5 size-6 rounded-full bg-white shadow transition ${isOn ? "translate-x-5" : ""}`} />
        </button>
      )}
    </div>
  );
}
