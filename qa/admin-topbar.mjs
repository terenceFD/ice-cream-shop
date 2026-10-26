// Browser-only fixtures: no real login, credentials, or database mutations.
export default async function run(page, ui) {
  const origin = new URL(page.url()).origin;
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => {
    sessionStorage.setItem("cold-stone-admin-token", "topbar-ui-fixture");
    localStorage.setItem("cold-stone-language", "en");
  });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith("/api/")) return route.continue();
    const admin = {
      id: 1,
      name: "Terence Timah",
      email: "owner@example.test",
      role: "owner",
      storeId: null,
      storeName: null,
    };
    const data =
      path.endsWith("/me") || path.endsWith("/dev-login")
        ? { admin, token: "topbar-ui-fixture" }
        : {
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
            messages: [],
            unreadCount: 3,
            pendingCount: 5,
            count: 0,
          };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
  await page.goto(`${origin}/admin/orders`);
  await page.locator(".admin-topbar").waitFor();
  await page.locator("select").first().waitFor();
  const snapshot = await ui.snapshot();
  const header = page.locator(".admin-topbar");
  const city = header.locator('[aria-controls="admin-branch-menu"]');
  const language = header.locator('[aria-controls="admin-language-menu"]');
  const account = header.locator('[aria-controls="admin-account-menu"]');
  await page.screenshot({ path: "qa/admin-topbar-desktop.png" });
  for (const [trigger, id] of [
    [city, "admin-branch-menu"],
    [language, "admin-language-menu"],
    [account, "admin-account-menu"],
  ]) {
    await trigger.click();
    await page.locator(`#${id}`).waitFor();
    await page.screenshot({ path: `qa/${id}-desktop.png` });
    await page.keyboard.press("ArrowDown");
    const focused = await page.evaluate(() =>
      document.activeElement?.getAttribute("role")?.startsWith("menuitem"),
    );
    if (!focused) throw new Error(`${id}: arrow navigation failed`);
    await page.keyboard.press("Escape");
    if ((await trigger.getAttribute("aria-expanded")) !== "false")
      throw new Error(`${id}: Escape failed`);
    await page
      .waitForFunction(
        (menuId) =>
          document.activeElement?.getAttribute("aria-controls") === menuId,
        id,
        { timeout: 3000 },
      )
      .catch(async () => {
        throw new Error(
          JSON.stringify(
            await page.evaluate(() => ({
              active: document.activeElement?.outerHTML.slice(0, 400),
              triggers: [
                ...document.querySelectorAll(
                  '[aria-controls="admin-branch-menu"]',
                ),
              ].map((el) => el.outerHTML.slice(0, 400)),
              url: location.href,
            })),
          ),
        );
      });
  }
  await account.click();
  await language.click();
  if ((await header.locator('[role="menu"]').count()) !== 1)
    throw new Error("Multiple menus open");
  await page.keyboard.press("Escape");
  await city.click();
  await page.getByRole("menuitemradio", { name: /Yaoundé Bastos/ }).click();
  if (
    !(await city.getAttribute("aria-label").then((s) => s.includes("Yaoundé")))
  )
    throw new Error("City selection failed");
  const select = page.locator("select").last();
  await select.selectOption({ index: 1 });
  await select.click();
  await page.screenshot({ path: "qa/admin-filter-dropdown.png" });
  await page.keyboard.press("Escape");
  const sizes = [];
  for (const width of [320, 390, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const trigger of [city, language, account]) {
      await trigger.click();
      const menu = header.locator('[role="menu"]');
      const bounds = await menu.boundingBox();
      if (!bounds || bounds.x < 0 || bounds.x + bounds.width > width + 1)
        throw new Error(`Menu clipped at ${width}px`);
      await page.keyboard.press("Escape");
    }
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    if (overflow) throw new Error(`Horizontal overflow at ${width}px`);
    sizes.push(width);
    if (width === 390) {
      await account.click();
      await page.screenshot({ path: "qa/admin-topbar-mobile.png" });
      await page.keyboard.press("Escape");
    }
  }
  return {
    snapshot,
    sizes,
    keyboardNavigation: true,
    exclusiveMenus: true,
    citySelection: true,
    selectInteraction: true,
  };
}
