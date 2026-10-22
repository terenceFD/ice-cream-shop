// Loads the live Menu page and reports whether products, quick-add and the categories work.
export default async function run(page) {
  const errors = [];
  const failed = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("requestfailed", (r) => failed.push(r.url().split("/").pop()));

  await page.goto(
    "https://ice-cream-shop-20eg.onrender.com/menu?category=Ice+Cream",
    { waitUntil: "domcontentloaded", timeout: 90000 },
  );
  await page.waitForTimeout(7000);
  await page.evaluate(() =>
    document
      .getElementById("menu-category-items")
      ?.scrollIntoView({ block: "start" }),
  );
  await page.waitForTimeout(2000);

  const before = await page.evaluate(() => ({
    categoryTabs: document.querySelectorAll(
      'nav[aria-label="Menu categories"] button',
    ).length,
    quickAddButtons: document.querySelectorAll(
      'button[aria-label^="Add "][aria-label$="to your bag"]',
    ).length,
    gridChildren:
      document.querySelector("#menu-category-items")?.nextElementSibling
        ?.children.length ?? 0,
  }));

  const add = page.locator(
    'button[aria-label^="Add "][aria-label$="to your bag"]',
  );
  let bagAfter = null;
  if (await add.count()) {
    await add.first().click();
    await page.waitForTimeout(1000);
    bagAfter = await page.evaluate(() => {
      const el = [...document.querySelectorAll('[aria-label*="bag" i]')].find(
        (n) => /Shopping bag/.test(n.getAttribute("aria-label") || ""),
      );
      return el?.getAttribute("aria-label") || null;
    });
  }
  await page.screenshot({ path: "qa/shots/live-menu-verified.png" });

  return {
    ...before,
    bagAfter,
    sheetOpen: await page.locator("#menu-product-title").count(),
    errors,
    failed: [...new Set(failed)],
  };
}
