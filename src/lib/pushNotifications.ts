// Promotion alerts: lets a signed-in customer receive the shop's promotion notifications on this
// device, even when the site is closed. The browser shows them with the site's name and logo.
import { apiRequest } from "../api/api";
import { isAppleMobileDevice, isRunningAsInstalledApp } from "./installPrompt";

export type PromotionAlertState =
  | "on"
  | "off"
  | "denied" // the visitor blocked notifications for this site in the browser
  | "needs-install" // iPhone/iPad: alerts only work once the site is on the home screen
  | "unsupported"
  | "error" // temporary setup/network failure; allow retry
  | "unavailable"; // the server has no push keys configured

export const PROMOTION_ALERTS_CHANGED_EVENT = "cold-stone-promotion-alerts-changed";

let serverKeyRequest: Promise<{ enabled: boolean; publicKey: string | null }> | null = null;
let preparedPush: { registration: ServiceWorkerRegistration; publicKey: string } | null = null;

function getServerKey() {
  serverKeyRequest ??= apiRequest<{ enabled: boolean; publicKey: string | null }>("/push/public-key")
    .then((result) => result || { enabled: false, publicKey: null })
    .catch((error) => {
      serverKeyRequest = null;
      throw error;
    });
  return serverKeyRequest;
}

export function isPushSupported() {
  return typeof window !== "undefined"
    && window.isSecureContext
    && !(isAppleMobileDevice() && !isRunningAsInstalledApp())
    && "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window;
}

// The service worker registers on page load; give it a moment but never hang the page on it.
async function getWorkerRegistration(timeoutMs = 10_000) {
  let timer: number | undefined;
  try {
    // Retry registration if page-load registration was missed or previously failed.
    return await Promise.race([
      navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready),
      new Promise<never>((_, reject) => {
        timer = window.setTimeout(() => reject(new Error("The app worker is not ready yet. Reload the page and try again.")), timeoutMs);
      }),
    ]);
  } finally {
    window.clearTimeout(timer);
  }
}

function base64UrlToBytes(value: string) {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  const binary = window.atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function sameKey(subscription: PushSubscription, publicKey: string) {
  const current = subscription.options?.applicationServerKey;
  if (!current) return true;
  const expected = base64UrlToBytes(publicKey);
  const actual = new Uint8Array(current);
  return actual.length === expected.length && actual.every((byte, index) => byte === expected[index]);
}

function announce(state: PromotionAlertState) {
  window.dispatchEvent(new CustomEvent(PROMOTION_ALERTS_CHANGED_EVENT, { detail: state }));
}

export async function getPromotionAlertState(): Promise<PromotionAlertState> {
  if (!isPushSupported()) {
    return isAppleMobileDevice() && !isRunningAsInstalledApp() ? "needs-install" : "unsupported";
  }
  const { enabled, publicKey } = await getServerKey();
  if (!enabled || !publicKey) return "unavailable";
  if (Notification.permission === "denied") return "denied";
  // Prepare before the tap: mobile Safari requires subscribe() itself to run
  // inside the user gesture, not after network/worker/permission awaits.
  const registration = await getWorkerRegistration();
  preparedPush = { registration, publicKey };
  if (Notification.permission !== "granted") return "off";
  const subscription = await registration.pushManager.getSubscription();
  if (subscription && !sameKey(subscription, publicKey)) {
    await subscription.unsubscribe();
    return "off";
  }
  return subscription ? "on" : "off";
}

/**
 * Makes sure this device's alerts are linked to the customer who is signed in now, and that the
 * device is subscribed with the server's current key. If the site's keys were replaced, the old
 * subscription no longer works, so it is renewed here without asking again (permission is kept).
 */
export async function syncPromotionAlerts(token: string) {
  if (!isPushSupported() || Notification.permission !== "granted") return;
  const { enabled, publicKey } = await getServerKey();
  if (!enabled || !publicKey) return;
  const registration = await getWorkerRegistration();
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  if (!sameKey(subscription, publicKey)) {
    await subscription.unsubscribe();
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(publicKey),
    });
  }
  await apiRequest("/customer/push-subscription", { method: "POST", token, body: subscription.toJSON() });
}

/** Must be called straight from a tap or click, because browsers only show the permission prompt then. */
export async function enablePromotionAlerts(token: string): Promise<PromotionAlertState> {
  if (!isPushSupported()) return getPromotionAlertState();
  if (!preparedPush) {
    await getPromotionAlertState();
    // Do not try to prompt after preparation consumed the tap. A second tap
    // can now subscribe synchronously using the prepared registration.
    throw new Error("Notifications are ready. Tap again to turn them on.");
  }
  const { registration, publicKey } = preparedPush;
  let subscription: PushSubscription;
  try {
    // subscribe() requests notification permission itself. Calling it directly
    // preserves mobile user activation instead of losing it across awaits.
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(publicKey),
    });
  } catch (error) {
    if (Notification.permission === "denied") {
      announce("denied");
      return "denied";
    }
    if (error instanceof DOMException && error.name === "NotAllowedError" && Notification.permission === "default") {
      announce("off");
      return "off";
    }
    // Private or incognito windows, and some privacy settings, refuse push even when notifications are allowed.
    if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "AbortError")) {
      throw new Error("This browser refused promotion alerts. They don't work in private or incognito windows. Try a normal window or the installed app.");
    }
    throw error;
  }
  await apiRequest("/customer/push-subscription", { method: "POST", token, body: subscription.toJSON() });
  announce("on");
  return "on";
}

export async function disablePromotionAlerts(token: string): Promise<PromotionAlertState> {
  if (!isPushSupported()) return "unsupported";
  const registration = await getWorkerRegistration(4_000);
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    try {
      if (token) {
        await apiRequest("/customer/push-subscription", {
          method: "DELETE",
          token,
          body: { endpoint: subscription.endpoint },
        });
      }
    } finally {
      await subscription.unsubscribe();
    }
  }
  announce("off");
  return "off";
}
