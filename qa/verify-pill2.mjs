// Confirms the pill hides while scrolling down and appears while scrolling up, covering nothing.
export default async function run(page) {
  await page.goto("http://localhost:3999/", {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForTimeout(25000);
  // The loader overlay lingers in headless runs; dismiss it if it is still up.
  await page.evaluate(() => {
    document
      .querySelectorAll("body > div")
      .forEach((n) => {
        const style = getComputedStyle(n);
        if (style.position === "fixed" && !n.querySelector("nav[aria-label='Page sections']")) n.remove();
      });
  });
  await page.waitForTimeout(1500);

  // Scroll down through the page — the pill should stay hidden the whole way.
  const downStops = [1200, 2400, 3600, 4800];
  let visibleWhileScrollingDown = false;
  for (const y of downStops) {
    await page.evaluate(
      (top) => window.scrollTo({ top, behavior: "instant" }),
      y,
    );
    await page.waitForTimeout(900);
    const shown = await page.evaluate(() => {
      const nav = document.querySelector('nav[aria-label="Page sections"]');
      if (!nav) return false;
      return getComputedStyle(nav).opacity === "1";
    });
    if (shown) visibleWhileScrollingDown = true;
  }

  // Now scroll up — the pill should appear.
  await page.evaluate(() =>
    window.scrollTo({ top: 4800 - 700, behavior: "instant" }),
  );
  await page.waitForTimeout(900);
  const visibleWhileScrollingUp = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Page sections"]');
    if (!nav) return false;
    const style = getComputedStyle(nav);
    if (style.opacity !== "1") return false;
    const r = nav.getBoundingClientRect();
    const covered = [
      ...document.querySelectorAll(
        "main h1, main h2, main h3, main article, main img",
      ),
    ].filter((el) => {
      const b = el.getBoundingClientRect();
      return (
        b.top < r.bottom &&
        b.bottom > r.top &&
        b.left < r.right &&
        b.right > r.left
      );
    }).length;
    return { clear: covered === 0, covered };
  });

  await page.screenshot({ path: "qa/shots/pill-scroll-up.png" });
  return { visibleWhileScrollingDown, visibleWhileScrollingUp };
}
