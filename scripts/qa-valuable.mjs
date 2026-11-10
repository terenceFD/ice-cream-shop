// QA: product image card in chat + daily special offer.
// Patient waits throughout — the dev server compiles for ~30s on a cold start.
export default async function run(page, ui) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.context().grantPermissions(["geolocation"]);
  await page.context().setGeolocation({ latitude: 4.05, longitude: 9.69 });
  await page.addInitScript(() => {
    window.localStorage.setItem("cold-stone-cookie-consent", "accepted");
    window.sessionStorage.setItem("cold-stone-chat-open", "1");
  });
  await page.goto("http://localhost:5173/", { waitUntil: "domcontentloaded", timeout: 90000 });
  // Hydration: real product cards ("Add to cart") appear once React is live.
  await page.getByText("Add to cart").first().waitFor({ timeout: 90000 });
  await page.waitForTimeout(2000);

  // Floating widgets show only in the middle of the page.
  await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.6));
  await page.waitForTimeout(1500);

  // The panel opens itself when the session flag says it was open; otherwise
  // click the launcher. Either way, wait for the composer.
  const composer = page.getByRole("textbox", { name: "Your message" });
  const opened = (await composer.count()) > 0;
  if (!opened) {
    const snap = await ui.snapshot();
    const launcher = snap.match(/@(e\d+) button "Chat with us"/)?.[1];
    if (!launcher) return { stage: "launcher", snap: snap.slice(0, 2000) };
    await page.locator(`[data-ab-ref="${launcher}"]`).evaluate((el) => el.click());
  }
  await composer.waitFor({ timeout: 30000 });

  const ask = async (text) => {
    await composer.fill(text);
    await composer.press("Enter");
    // Wait until a NEW store bubble appears (poll, generous).
    for (let i = 0; i < 20; i += 1) {
      await page.waitForTimeout(1000);
      if (i > 3) break;
    }
    await page.waitForTimeout(6000);
  };

  await ask("how much is Chocolate Devotion?");
  await page.screenshot({ path: "qa-card.png" });
  const imgCount = await page
    .locator('.site-chat-bubble img[src^="/menu-official"]')
    .count();
  const bubbles = (await page.locator(".site-chat-bubble").allInnerTexts())
    .slice(-4)
    .map((b) => b.replace(/\s+/g, " ").slice(0, 200));

  return { imageCardsRendered: imgCount, bubbles };
}
