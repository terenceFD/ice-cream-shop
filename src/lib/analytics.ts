// Lightweight analytics event tracking. Events go to the browser's dataLayer
// (Google Tag Manager / GA4 convention) when a measurement ID is configured,
// and are always mirrored to the console in development for debugging.
// No third-party script is loaded until VITE_GA_MEASUREMENT_ID is set, so the
// site stays fast and cookieless by default.

const MEASUREMENT_ID = (import.meta.env.VITE_GA_MEASUREMENT_ID || "").trim();
const DATA_LAYER_NAME = "dataLayer";

// Analytics only runs after the visitor accepts cookies in the consent banner
// (see CookieConsent.tsx). Before consent, events still reach the dataLayer so
// nothing is lost for an anonymous-by-default site, but the gtag.js script —
// the only piece that sets cookies or leaves the browser — is not injected.
export const ANALYTICS_CONSENT_KEY = "cold-stone-cookie-consent";

/** Reads the stored consent decision; null means the visitor has not chosen yet. */
export function readCookieConsent(): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
    if (stored === "accepted") return true;
    if (stored === "declined") return false;
  } catch {
    // Storage may be unavailable (private mode); treat as no decision.
  }
  return null;
}

/** Records the visitor's consent decision and notifies listeners in this tab. */
export function storeCookieConsent(accepted: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, accepted ? "accepted" : "declined");
  } catch {
    // Without storage the banner simply reappears next visit.
  }
  window.dispatchEvent(new Event("cold-stone-cookie-consent"));
}

// Minimal typing for the GA4 globals this module creates.
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let initialized = false;

function ensureInitialized() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  if (!MEASUREMENT_ID) return;
  if (readCookieConsent() !== true) return;
  // Standard GA4 bootstrap: a dataLayer queue plus a stub gtag function. The
  // gtag.js script itself is injected here so index.html stays clean when
  // analytics is not configured.
  window[DATA_LAYER_NAME] = window[DATA_LAYER_NAME] || [];
  window[DATA_LAYER_NAME].push({ "gtm.start": Date.now(), event: "gtm.js" });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`;
  document.head.appendChild(script);
  const gtag = function (...args: unknown[]) {
    window[DATA_LAYER_NAME]!.push(args);
  };
  window.dataLayer = window[DATA_LAYER_NAME];
  window.gtag = window.gtag || gtag;
  window.gtag!("js", new Date());
  window.gtag!("config", MEASUREMENT_ID, { anonymize_ip: true });
}

/**
 * Track a commerce or engagement event. Safe to call anywhere: it does nothing
 * harmful when analytics is not configured.
 */
export function trackEvent(name, parameters = {}) {
  if (typeof window === "undefined" || !name) return;
  ensureInitialized();
  const payload = { ...parameters, sentAt: new Date().toISOString() };
  try {
    if (typeof window.gtag === "function") {
      window.gtag("event", name, payload);
    } else {
      window[DATA_LAYER_NAME] = window[DATA_LAYER_NAME] || [];
      window[DATA_LAYER_NAME].push({ event: name, ...payload });
    }
  } catch {
    // Analytics must never break the shopping flow.
  }
  if (import.meta.env.DEV) {
    console.info(`[analytics] ${name}`, payload);
  }
}

/** Re-initialises analytics once consent is granted (the banner calls this). */
export function maybeInitializeAfterConsent() {
  if (readCookieConsent() === true) ensureInitialized();
}

/** E-commerce: an item was added to the shopping bag. */
export function trackAddToCart(item) {
  trackEvent("add_to_cart", {
    itemId: String(item?.id ?? ""),
    itemName: item?.name,
    value: item?.priceXaf ?? item?.price ?? 0,
    currency: "XAF",
  });
}

/** E-commerce: checkout started with items in the bag. */
export function trackBeginCheckout(value, itemCount) {
  trackEvent("begin_checkout", { value, currency: "XAF", itemCount });
}

/** E-commerce: a purchase was completed. */
export function trackPurchase(orderId, value) {
  trackEvent("purchase", {
    transactionId: String(orderId),
    value,
    currency: "XAF",
  });
}
