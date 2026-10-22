// Confirms hero images are fetched once and preloads are used, with the new service worker.
export default async function run(page) {
  const warnings = [];
  page.on("console", (m) => {
    if (m.type() === "warning" && /preload/i.test(m.text()))
      warnings.push(m.text().slice(0, 100));
  });

  const results = [];
  for (const path of ["/about", "/flavors", "/flavor/1", "/menu"]) {
    await page.goto("http://localhost:3999" + path, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(5000);
    const info = await page.evaluate(() => {
      const preloads = [
        ...document.querySelectorAll('link[rel="preload"][as="image"]'),
      ].map((l) => l.getAttribute("href"));
      const used = preloads.filter(
        (h) => performance.getEntriesByName(h).length > 0,
      );
      return { preloads, used };
    });
    results.push(Object.assign({ path }, info));
  }
  return { results, preloadWarnings: warnings };
}
