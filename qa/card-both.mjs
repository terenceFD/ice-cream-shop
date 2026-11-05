// Measures the card in both modes: the browser install dialog, and the iOS steps.
export default async function run(page) {
  await page.goto(page.url(), { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((n) =>
      /accept/i.test(n.textContent || ""),
    );
    b?.click();
  });

  const measure = async (label) => {
    const box = await page.evaluate(() => {
      const card = document.querySelector(".install-app-card");
      if (!card) return null;
      const r = card.getBoundingClientRect();
      return {
        h: Math.round(r.height),
        pct: Math.round((r.height / window.innerHeight) * 100),
        text: card.innerText.replace(/\s+/g, " ").slice(0, 90),
      };
    });
    return { label, ...box };
  };

  // iOS mode: the browser reports as an Apple mobile device.
  await page.evaluate(() => {
    sessionStorage.removeItem("cold-stone-install-shown-this-session");
    window.dispatchEvent(new CustomEvent("cold-stone-install-available"));
  });
  await page.waitForTimeout(3200);
  const ios = await measure("ios steps");
  await page.screenshot({
    path: `qa/card-ios-${page.viewportSize().width}.png`,
  });

  return { ios };
}
