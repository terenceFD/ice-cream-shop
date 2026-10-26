export default async function run(page, ui) {
  await page.setViewportSize({ width: 390, height: 844 });
  let saved = 0;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith("/api/")) return route.continue();
    let data = {
      orders: [],
      favorites: [],
      savedCarts: [],
      balance: 0,
      ledger: [],
      flavors: [],
      categories: [],
      items: [],
    };
    if (path === "/api/auth/me")
      data = {
        customer: {
          id: 1,
          name: "Mobile Customer",
          email: "mobile@example.test",
        },
      };
    if (path === "/api/push/public-key")
      data = { enabled: true, publicKey: "AQID" };
    if (path === "/api/customer/push-subscription") {
      saved++;
      data = { subscribed: true };
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
  await page.addInitScript(() => {
    localStorage.setItem("cold-stone-customer-token", "mobile-ui-test");
    localStorage.setItem(
      "cold-stone-promotion-alerts-snoozed:1",
      String(Date.now()),
    );
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1",
    });
    Object.defineProperty(navigator, "standalone", {
      configurable: true,
      get: () => window.__installed,
    });
    window.__installed = true;
    window.__permission = "default";
    window.__gesture = false;
    document.addEventListener(
      "click",
      () => {
        window.__gesture = true;
        setTimeout(() => {
          window.__gesture = false;
        }, 0);
      },
      true,
    );
    const subscription = {
      options: {},
      endpoint: "https://push.example.test/device",
      toJSON: () => ({
        endpoint: "https://push.example.test/device",
        keys: { auth: "test", p256dh: "test" },
      }),
      unsubscribe: async () => {
        window.__subscribed = false;
        return true;
      },
    };
    const registration = {
      pushManager: {
        getSubscription: async () =>
          window.__subscribed ? subscription : null,
        subscribe() {
          if (!window.__gesture)
            throw new Error("Mobile user activation was lost");
          window.__subscribed = true;
          window.__permission = "granted";
          return Promise.resolve(subscription);
        },
      },
    };
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        register: async () => registration,
        ready: Promise.resolve(registration),
      },
    });
    Object.defineProperty(window, "PushManager", {
      configurable: true,
      value: class {},
    });
    const notification = new Object();
    Object.defineProperty(notification, "permission", {
      get: () => window.__permission,
    });
    notification.requestPermission = () => {
      throw new Error("Separate permission prompt should not run");
    };
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: notification,
    });
  });
  await page.goto("http://localhost:5174/account/orders");
  const control = page.getByRole("switch", {
    name: "Order updates and promotions",
  });
  await control.waitFor();
  const initial = await ui.snapshot();
  const box = await control.boundingBox();
  if (box.height < 44) throw new Error("Touch target is too small");
  await control.click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('[role="switch"]')
        ?.getAttribute("aria-checked") === "true",
  );
  if (!saved) throw new Error("Subscription not sent to server");
  await page.screenshot({
    path: ".taste-skill/mobile-notifications-on.png",
    fullPage: true,
  });
  await control.click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('[role="switch"]')
        ?.getAttribute("aria-checked") === "false",
  );
  await page.evaluate(() => {
    window.__installed = false;
    window.dispatchEvent(new Event("focus"));
  });
  await page
    .getByText("In Safari, tap Share, then Add to Home Screen.", {
      exact: false,
    })
    .waitFor();
  if (await control.count())
    throw new Error(
      "Non-installed iPhone should show instructions, not broken toggle",
    );
  await page.screenshot({
    path: ".taste-skill/mobile-notifications-install.png",
    fullPage: true,
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  if (overflow) throw new Error("Horizontal overflow");
  return {
    enabledAndSaved: true,
    disabled: true,
    installGuidance: true,
    touchTargetHeight: box.height,
    overflow,
    initial,
  };
}
