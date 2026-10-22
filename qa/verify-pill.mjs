// Checks the section pill sits at the bottom and covers nothing while scrolling.
export default async function run(page) {
  await page.goto("http://localhost:3999/", {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForTimeout(20000);

  const stops = [2300, 3900, 5500];
  const results = [];
  for (const y of stops) {
    await page.evaluate(
      (top) => window.scrollTo({ top, behavior: "instant" }),
      y,
    );
    await page.waitForTimeout(1500);
    const info = await page.evaluate(() => {
      const nav = document.querySelector('nav[aria-label="Page sections"]');
      if (!nav) return { found: false };
      const r = nav.getBoundingClientRect();
      const covered = [
        ...document.querySelectorAll(
          "main h1, main h2, main h3, main article, main img",
        ),
      ]
        .filter((el) => {
          const b = el.getBoundingClientRect();
          return (
            b.top < r.bottom &&
            b.bottom > r.top &&
            b.left < r.right &&
            b.right > r.left
          );
        })
        .map((el) =>
          (el.innerText || el.tagName).trim().slice(0, 40).replace(/\s+/g, " "),
        );
      return {
        found: true,
        bottom: Math.round(innerHeight - r.bottom),
        viewportH: innerHeight,
        covers: covered,
      };
    });
    results.push({ y, ...info });
    if (y === 2300) await page.screenshot({ path: "qa/shots/pill-bottom.png" });
  }
  return results;
}
