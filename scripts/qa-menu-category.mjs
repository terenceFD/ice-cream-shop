// Clicks the Ice Cream category and screenshots the product grid.
export default async function run(page, _ui) {
  await page.waitForSelector("main", { timeout: 60000 });
  await page.waitForTimeout(1500);
  const chip = page.locator("main button", { hasText: "Ice Cream" }).first();
  await chip.click();
  await page.waitForTimeout(1800);
  await page.evaluate(() =>
    document
      .getElementById("menu-category-items")
      ?.scrollIntoView({ block: "start" }),
  );
  await page.waitForTimeout(1200);
  const state = await page.evaluate(() => {
    const reveals = [...document.querySelectorAll("main .scroll-reveal")];
    return {
      url: location.search,
      cards: reveals.length,
      visible: reveals.filter((el) => getComputedStyle(el).opacity !== "0")
        .length,
      names: reveals
        .slice(0, 5)
        .map((el) => el.querySelector("h3")?.textContent.trim()),
    };
  });
  await page.screenshot({ path: "scripts/menu-category.png" });
  return state;
}
