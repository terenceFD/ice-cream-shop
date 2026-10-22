// Clicks quick add on a product card and confirms it adds one to the bag without opening the sheet.
export default async function run(page) {
  await page.goto("http://localhost:3999/menu?category=Ice+Cream", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(5000);
  await page.evaluate(() =>
    document
      .getElementById("menu-category-items")
      ?.scrollIntoView({ block: "start" }),
  );
  await page.waitForTimeout(1500);

  const add = page.locator(
    'button[aria-label^="Add "][aria-label$="to your bag"]',
  );
  const label = await add.first().getAttribute("aria-label");
  await add.first().click();
  await page.waitForTimeout(900);

  const result = await page.evaluate(() => {
    const bag = [
      ...document.querySelectorAll(
        '[aria-label*="bag" i], [aria-label*="Shopping" i]',
      ),
    ]
      .map((n) => n.getAttribute("aria-label"))
      .filter(Boolean);
    return {
      url: location.pathname + location.search,
      detailSheetOpen: Boolean(document.querySelector("#menu-product-title")),
      bagLabels: [...new Set(bag)].slice(0, 3),
    };
  });
  await page.screenshot({ path: "qa/shots/menu-quickadd-ok.png" });
  return { clicked: label, ...result };
}
