// Records every scroll event direction and the pill's opacity at each stop, to find why it shows while scrolling down.
export default async function run(page) {
  await page.goto("http://localhost:3999/", {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForTimeout(25000);
  await page.evaluate(() => {
    document.querySelectorAll("body > div").forEach((n) => {
      const style = getComputedStyle(n);
      if (
        style.position === "fixed" &&
        !n.querySelector("nav[aria-label='Page sections']")
      )
        n.remove();
    });
  });
  await page.waitForTimeout(1500);

  await page.evaluate(() => {
    window.__scrollLog = [];
    let last = window.scrollY;
    window.addEventListener(
      "scroll",
      () => {
        const y = window.scrollY;
        window.__scrollLog.push({
          y,
          dir: y > last ? "down" : y < last ? "up" : "same",
        });
        last = y;
      },
      { passive: true },
    );
  });

  const stops = [];
  for (const y of [1200, 2400, 3600, 4800]) {
    await page.evaluate(
      (top) => window.scrollTo({ top, behavior: "instant" }),
      y,
    );
    await page.waitForTimeout(900);
    stops.push(
      await page.evaluate(() => {
        const nav = document.querySelector("nav[aria-label='Page sections']");
        return {
          y: window.scrollY,
          opacity: nav ? getComputedStyle(nav).opacity : null,
          cls: nav ? nav.className.slice(60, 160) : null,
        };
      }),
    );
  }
  const events = await page.evaluate(() => window.__scrollLog.slice(0, 30));
  return { stops, events };
}
