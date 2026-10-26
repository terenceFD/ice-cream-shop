export default async function run(page, ui) {
  const origin = new URL(page.url()).origin;
  const customer = {
    id: 8,
    name: "Nadine Mbarga",
    email: "nadine@example.test",
    phone: "+237 690 123 456",
    deliveryCity: "douala-bonanjo",
    deliveryResidence: "Bonanjo, Douala",
    loyaltyPoints: 145,
  };
  const items = [
    {
      productId: 1,
      name: "French Vanilla",
      quantity: 2,
      lineTotalCents: 5000,
      priceCents: 2500,
    },
  ];
  const orders = [
    {
      id: 1042,
      createdAt: new Date().toISOString(),
      status: "paid",
      fulfillmentType: "delivery",
      deliveryStage: "preparing",
      totalCents: 6000,
      storeName: "Cold Stone Bonanjo",
      storeAddress: "Bonanjo, Douala",
      deliveryAddress: "Bonanjo, Douala",
      items,
    },
    {
      id: 1038,
      createdAt: "2026-10-24T12:00:00Z",
      status: "delivered",
      fulfillmentType: "pickup",
      totalCents: 5000,
      storeName: "Cold Stone Bonanjo",
      items,
    },
  ];
  let empty = false;
  const writes = [];
  await page.addInitScript(() =>
    localStorage.setItem(
      "cold-stone-customer-token",
      "account-browser-fixture",
    ),
  );
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (!path.startsWith("/api/")) return route.continue();
    let data = {};
    if (path.endsWith("/auth/me")) data = { customer };
    else if (path.endsWith("/auth/profile")) {
      Object.assign(customer, request.postDataJSON());
      data = { customer };
      writes.push({ path, body: request.postDataJSON() });
    } else if (path.endsWith("/customer/orders"))
      data = { orders: empty ? [] : orders };
    else if (path.endsWith("/customer/favorites")) data = { favorites: [] };
    else if (path.endsWith("/customer/saved-carts")) data = { savedCarts: [] };
    else if (path.endsWith("/customer/loyalty"))
      data = { points: empty ? 0 : 145, entries: [] };
    else if (path.endsWith("/flavors")) data = { flavors: [] };
    else if (path.endsWith("/menu-items")) data = { items: [] };
    else if (path.endsWith("/push/config")) data = { enabled: false };
    else data = { items: [], categories: [], stores: [], notifications: [] };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
  await page.goto(`${origin}/account/orders`);
  await page.locator(".account-order-card").first().waitFor();
  const snapshot = await ui.snapshot();
  const sizes = [];
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForTimeout(120);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    );
    if (overflow > 1)
      throw new Error(`Account overflow ${overflow}px at ${width}`);
    await page.screenshot({
      path: `qa/account-overview-${width}.png`,
      fullPage: width === 390,
    });
    sizes.push(width);
  }
  const nav = page.getByRole("navigation", { name: "Account sections" });
  for (const tab of ["Orders", "Saved", "Rewards", "Profile"]) {
    await nav.getByRole("button", { name: new RegExp(`^${tab}`) }).click();
    await page.waitForURL(`**tab=${tab.toLowerCase()}`);
    await page.screenshot({
      path: `qa/account-${tab.toLowerCase()}-desktop.png`,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )
    )
      throw new Error(`${tab} overflow`);
    await page.screenshot({
      path: `qa/account-${tab.toLowerCase()}-mobile.png`,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await page.getByLabel("Full name", { exact: true }).fill("Nadine Mbarga");
  await page
    .getByRole("button", { name: "Save delivery details", exact: true })
    .click();
  await page
    .getByText("Saved delivery details updated.", { exact: true })
    .waitFor();
  if (writes.length !== 1) throw new Error("Profile save request missing");
  empty = true;
  await page.goto(`${origin}/account/orders`);
  await page.getByText("No active orders", { exact: true }).waitFor();
  await page.screenshot({ path: "qa/account-empty-desktop.png" });
  return {
    snapshot,
    widths: sizes,
    views: ["overview", "orders", "saved", "rewards", "profile"],
    profileSave: true,
    emptyState: true,
    fixturesOnly: true,
  };
}
