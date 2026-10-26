import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import vm from "node:vm";

function harness({
  apple = false,
  installed = false,
  permission = "default",
  workerNeverReady = false,
} = {}) {
  const calls = [];
  const notification = {
    permission,
    requestPermission() {
      throw new Error("Separate permission prompt loses mobile activation");
    },
  };
  const subscription = {
    options: {},
    endpoint: "https://push.example.test/device",
    toJSON: () => ({ endpoint: "https://push.example.test/device" }),
    unsubscribe: async () => true,
  };
  let active = false;
  const registration = {
    pushManager: {
      getSubscription: async () => (active ? subscription : null),
      subscribe() {
        calls.push("subscribe");
        notification.permission = "granted";
        active = true;
        return Promise.resolve(subscription);
      },
    },
  };
  const window = {
    isSecureContext: true,
    setTimeout,
    clearTimeout,
    atob,
    dispatchEvent() {},
  };
  const context = vm.createContext({
    window,
    navigator: {
      serviceWorker: {
        register: async () => registration,
        ready: workerNeverReady
          ? new Promise(() => {})
          : Promise.resolve(registration),
      },
    },
    Notification: notification,
    DOMException,
    CustomEvent: class {},
    Uint8Array,
    isAppleMobileDevice: () => apple,
    isRunningAsInstalledApp: () => installed,
    apiRequest: async (path) => {
      calls.push(path);
      return path === "/push/public-key"
        ? { enabled: true, publicKey: "AQID" }
        : { subscribed: true };
    },
  });
  window.PushManager = class {};
  window.Notification = notification;
  let source = readFileSync(
    new URL("../src/lib/pushNotifications.ts", import.meta.url),
    "utf8",
  );
  source = source.replace(/^import .*;\r?\n/gm, "").replace(/export /g, "");
  vm.runInContext(
    stripTypeScriptTypes(source) +
      "\nthis.api = { getPromotionAlertState, enablePromotionAlerts, getWorkerRegistration };",
    context,
  );
  return { ...context.api, calls, notification };
}

test("installed iPhone starts subscription synchronously from tap after preparation", async () => {
  const h = harness({ apple: true, installed: true });
  assert.equal(await h.getPromotionAlertState(), "off");
  const enabling = h.enablePromotionAlerts("test-token");
  assert.equal(
    h.calls.at(-1),
    "subscribe",
    "subscribe must happen before the first await",
  );
  assert.equal(await enabling, "on");
  assert.ok(h.calls.includes("/customer/push-subscription"));
});

test("Android uses the same direct subscription flow", async () => {
  const h = harness();
  await h.getPromotionAlertState();
  assert.equal(await h.enablePromotionAlerts("test-token"), "on");
});

test("iPhone browser tab requires installation even when push APIs exist", async () => {
  const h = harness({ apple: true });
  assert.equal(await h.getPromotionAlertState(), "needs-install");
  assert.equal(await h.enablePromotionAlerts("test-token"), "needs-install");
  assert.deepEqual(h.calls, []);
});

test("blocked permission is reported without trying to register", async () => {
  const h = harness({ permission: "denied" });
  assert.equal(await h.getPromotionAlertState(), "denied");
  assert.ok(!h.calls.includes("subscribe"));
});

test("worker readiness times out instead of leaving the mobile button spinning", async () => {
  const h = harness({ workerNeverReady: true });
  await assert.rejects(h.getWorkerRegistration(10), /worker is not ready/);
});
