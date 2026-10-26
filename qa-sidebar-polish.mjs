export default async function run(page, ui) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() =>
    sessionStorage.setItem("cold-stone-admin-token", "sidebar-ui-test"),
  );
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith("/api/")) return route.continue();
    const admin = {
      id: 1,
      name: "Terence Timah",
      email: "admin@example.test",
      role: "owner",
      storeId: null,
      storeName: null,
    };
    let data = {
      orders: [],
      stores: [],
      reviews: [],
      requests: [],
      notices: [],
      items: [],
      flavors: [],
      categories: [],
      notifications: [],
      customers: [],
      unreadCount: 3,
      pendingCount: 5,
      count: 0,
    };
    if (url.pathname.endsWith("/dev-login"))
      data = { token: "sidebar-ui-test", admin };
    if (url.pathname.endsWith("/me")) data = { admin };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
  await page.goto("http://localhost:5174/admin/orders");
  try {
    await page.locator("[data-admin-sidebar]").waitFor({ timeout: 15000 });
  } catch {
    return { failure: await page.locator("body").innerText(), url: page.url() };
  }
  await page.getByRole("heading", { name: "Overview", exact: true }).waitFor();
  const before = await ui.snapshot();
  const sidebar = page.locator("[data-admin-sidebar]");
  const profileVisible = await sidebar
    .getByText("Terence Timah", { exact: true })
    .isVisible();
  await page.screenshot({
    path: ".taste-skill/sidebar-desktop.png",
    fullPage: true,
  });
  await sidebar.getByRole("searchbox").fill("reviews");
  if ((await sidebar.locator("nav a").count()) !== 1)
    throw new Error("Search did not filter navigation");
  await sidebar.getByRole("searchbox").fill("");
  await sidebar
    .getByRole("button", { name: "Collapse sidebar", exact: true })
    .click();
  await page.screenshot({
    path: ".taste-skill/sidebar-collapsed.png",
    fullPage: true,
  });
  if (
    !(await sidebar
      .getByRole("link", { name: "Customer reviews (5)", exact: true })
      .isVisible())
  )
    throw new Error("Collapsed navigation inaccessible");
  await sidebar
    .getByRole("button", { name: "Expand sidebar", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  const toggle = sidebar.locator('button[aria-controls="admin-sidebar-nav"]');
  await toggle.click();
  await sidebar.locator('a[href="/admin/reviews"]').click();
  await page.waitForURL("**/admin/reviews");
  await page.waitForFunction(
    () =>
      document
        .querySelector(
          '[data-admin-sidebar] button[aria-controls="admin-sidebar-nav"]',
        )
        ?.getAttribute("aria-expanded") === "false",
  );
  await page.screenshot({
    path: ".taste-skill/sidebar-mobile.png",
    fullPage: true,
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  if (overflow) throw new Error("Mobile horizontal overflow");
  return {
    profileVisible,
    searchPassed: true,
    collapsedPassed: true,
    mobileNavigationPassed: true,
    horizontalOverflow: overflow,
    before,
  };
}
