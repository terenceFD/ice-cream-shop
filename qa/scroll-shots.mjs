// Scrolls to the live Menu grid and the Flavors grid and reports what a visitor sees.
export default async function run(page) {
  await page.waitForTimeout(4500);

  const report = {};
  await page.evaluate(() => window.scrollBy(0, 900));
  await page.waitForTimeout(2500);
  report.menu = await page.evaluate(() => ({
    url: location.pathname,
    cardsBelowHero: [...document.querySelectorAll("main button")].length,
    headings: [...document.querySelectorAll("main h1,main h2,main h3")]
      .map((h) => h.innerText.trim())
      .slice(0, 10),
    scrollY: window.scrollY,
  }));
  await page.screenshot({ path: "qa/shots/menu-grid.png" });

  await page.goto("https://ice-cream-shop-20eg.onrender.com/flavors", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(5000);
  await page.evaluate(() => window.scrollBy(0, 700));
  await page.waitForTimeout(2000);
  report.flavors = await page.evaluate(() => ({
    url: location.pathname,
    cards: document.querySelectorAll("main article").length,
    headings: [...document.querySelectorAll("main h1,main h2,main h3")]
      .map((h) => h.innerText.trim())
      .slice(0, 10),
  }));
  await page.screenshot({ path: "qa/shots/flavors-grid.png" });
  return report;
}
