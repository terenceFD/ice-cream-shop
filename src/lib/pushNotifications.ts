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
  | "unavailable"; // the server has no push keys configured

export const PROMOTION_ALERTS_CHANGED_EVENT = "cold-stone-promotion-alerts-changed";

let serverKeyRequest: Promise<{ enabled: boolean; publicKey: string | null }> | null = null;

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
    && "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window;
}

// The service worker registers on page load; give it a moment but never hang the page on it.
async function getWorkerRegistration(timeoutMs = 10_000) {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => window.setTimeout(
      () => reject(new Error("The app worker is not ready yet. Reload the page and try again.")),
      timeoutMs,
    )),
  ]);
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
  const { enabled } = await getServerKey();
  if (!enabled) return "unavailable";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "off";
  const registration = await getWorkerRegistration();
  const subscription = await registration.pushManager.getSubscription();
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
  // Ask first, while the tap still counts as the visitor's own action.
  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") {
    const state = permission === "denied" ? "denied" : "off";
    announce(state);
    return state;
  }
  const { enabled, publicKey } = await getServerKey();
  if (!enabled || !publicKey) return "unavailable";
  const registration = await getWorkerRegistration();
  let subscription = await registration.pushManager.getSubscription();
  if (subscription && !sameKey(subscription, publicKey)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  try {
    subscription ??= await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(publicKey),
    });
  } catch (error) {
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
