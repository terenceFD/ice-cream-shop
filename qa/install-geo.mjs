// Confirms the install card and the currency switcher do not overlap.
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

  const geo = await page.evaluate(() => {
    const card = document.querySelector(".install-app-card");
    const sw = document.querySelector(".currency-switcher");
    const rect = (el) => (el ? el.getBoundingClientRect() : null);
    const c = rect(card);
    const s = rect(sw);
    const overlap =
      c &&
      s &&
      c.left < s.right &&
      c.right > s.left &&
      c.top < s.bottom &&
      c.bottom > s.top;
    return {
      card: c && {
        top: Math.round(c.top),
        bottom: Math.round(c.bottom),
        left: Math.round(c.left),
        right: Math.round(c.right),
      },
      switcher: s && {
        top: Math.round(s.top),
        bottom: Math.round(s.bottom),
        left: Math.round(s.left),
        right: Math.round(s.right),
      },
      overlap: Boolean(overlap),
      cardVisible: c ? c.height > 0 : false,
      offscreenBottom: c ? Math.round(window.innerHeight - c.bottom) : null,
    };
  });
  await page.screenshot({
    path: `qa/install-final-${page.viewportSize().width}.png`,
  });
  return geo;
}
