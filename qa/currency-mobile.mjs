// Where does the currency switcher actually sit on a phone, and how big is it?
export default async function run(page) {
  await page.goto(page.url(), { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(2000);

  await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((node) =>
      /accept/i.test(node.textContent || ""),
    );
    button?.click();
  });
  await page.waitForTimeout(500);

  const info = await page.evaluate(() => {
    const all = [...document.querySelectorAll(".currency-switcher")];
    return all.map((el) => {
      const r = el.getBoundingClientRect();
      const summary = el.querySelector("summary");
      const sr = summary ? summary.getBoundingClientRect() : null;
      return {
        inHeader: Boolean(el.closest("header")),
        position: getComputedStyle(el).position,
        box: {
          top: Math.round(r.top),
          left: Math.round(r.left),
          w: Math.round(r.width),
          h: Math.round(r.height),
        },
        summary: sr && { w: Math.round(sr.width), h: Math.round(sr.height) },
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        rightGap: Math.round(window.innerWidth - r.right),
        bottomGap: Math.round(window.innerHeight - r.bottom),
      };
    });
  });

  await page.screenshot({
    path: `qa/cur-mobile-${page.viewportSize().width}.png`,
  });
  return { count: info.length, switchers: info };
}
