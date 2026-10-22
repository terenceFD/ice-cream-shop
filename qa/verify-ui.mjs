// Checks the new quick-add button and dietary badges on the Menu and Flavors grids.
export default async function run(page) {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("http://localhost:3999/menu", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(4500);
  await page.evaluate(() => window.scrollBy(0, 1000));
  await page.waitForTimeout(1200);

  const quickAdds = page.locator(
    'button[aria-label^="Add "][aria-label$="to your bag"]',
  );
  const menuQuickAddCount = await quickAdds.count();
  const bagBefore = await page.evaluate(() => {
    const el = [...document.querySelectorAll("a,button")].find((n) =>
      /bag/i.test(n.getAttribute("aria-label") || n.innerText || ""),
    );
    return el?.innerText?.trim() || el?.getAttribute("aria-label") || "";
  });
  if (menuQuickAddCount > 0) {
    await quickAdds.first().click();
    await page.waitForTimeout(900);
  }
  await page.screenshot({ path: "qa/shots/menu-quickadd.png" });

  await page.goto("http://localhost:3999/flavors", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(4500);
  await page.evaluate(() => window.scrollBy(0, 900));
  await page.waitForTimeout(1200);
  const countPill = await page
    .locator('main p[aria-live="polite"]')
    .first()
    .innerText();
  const allergyBadges = await page
    .locator('main ul li:has-text("Contains")')
    .count();

  const search = page.locator('input[placeholder="Search flavors"]');
  await search.fill("mango");
  await page.waitForTimeout(1200);
  const filteredPill = await page
    .locator('main p[aria-live="polite"]')
    .first()
    .innerText();
  const visibleCards = await page.locator("main article").count();
  await page.screenshot({ path: "qa/shots/flavors-filtered.png" });

  return {
    menuQuickAddCount,
    bagBefore,
    countPill,
    filteredPill,
    visibleCards,
    allergyBadges,
    errors,
  };
}
