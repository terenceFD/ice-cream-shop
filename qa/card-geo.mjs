// Measures the install card and the currency switcher so they can be stacked without overlap.
export default async function run(page) {
  await page.goto(page.url(), { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((n) =>
      /accept/i.test(n.textContent || ""),
    );
    b?.click();
  });
  await page.evaluate(() => {
    sessionStorage.removeItem("cold-stone-install-shown-this-session");
    window.dispatchEvent(new CustomEvent("cold-stone-install-available"));
  });
  await page.waitForTimeout(3500);

  return page.evaluate(() => {
    const card = document.querySelector(".install-app-card");
    const sw = document.querySelector(".currency-switcher");
    const r = (el) => (el ? el.getBoundingClientRect() : null);
    const c = r(card);
    const s = r(sw);
    const overlap =
      c &&
      s &&
      c.left < s.right &&
      c.right > s.left &&
      c.top < s.bottom &&
      c.bottom > s.top;
    return {
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      card: c && {
        top: Math.round(c.top),
        bottom: Math.round(c.bottom),
        h: Math.round(c.height),
        w: Math.round(c.width),
      },
      switcher: s && {
        top: Math.round(s.top),
        bottom: Math.round(s.bottom),
        h: Math.round(s.height),
      },
      overlap: Boolean(overlap),
      cardHeightPct: c
        ? Math.round((c.height / window.innerHeight) * 100)
        : null,
    };
  });
}
