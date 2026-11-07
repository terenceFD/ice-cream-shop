// Verifies the intelligence upgrades live: asks about a product that does NOT
// exist in the catalog (pizza) — the agent must refuse honestly, not invent one —
// then asks a real product price (must come from the tool/live data, exact FCFA),
// and asks about a promo (must match an actual active code or say none).
export default async function run(page, _ui) {
  await page.waitForSelector("main", { timeout: 60000 });
  // The dev server compiles chunks on first hit; wait for real page content, not a
  // fixed delay — "Preparing your Cold Stone experience" is the pre-hydration shell.
  await page.waitForFunction(
    () => !/Preparing your Cold Stone experience/.test(document.body.innerText),
    { timeout: 90000 },
  );
  await page.waitForTimeout(3000);
  // Desktop viewport: the /menu page omits its hero photo collage below 1024px, and
  // the launcher must be scrolled past the hero AND the footer edge to show.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(500);
  const out = {};
  const ask = async (question, label) => {
    // Scroll deep into the content, past the hero, so the launcher is visible.
    await page.evaluate(() => {
      const target = Math.min(
        document.body.scrollHeight - window.innerHeight + 100,
        Math.max(1200, document.body.scrollHeight / 2),
      );
      window.scrollTo(0, target);
    });
    // The launcher slides into view only after the floating-widget tracker's scroll
    // listener fires and the CSS transition (300ms) completes. First question: open
    // the panel; later questions: the panel is already open (the launcher then reads
    // "Close chat"), so just clear and type.
    await page.waitForFunction(
      () => {
        const button = document.querySelector(
          "button[aria-label='Chat with us'], button[aria-label='Close chat']",
        );
        if (!button) return false;
        return getComputedStyle(button.parentElement).opacity !== "0";
      },
      { timeout: 20000 },
    );
    const openLauncher = page.locator("button[aria-label='Chat with us']");
    if (await openLauncher.count()) {
      await openLauncher.click({ timeout: 20000 });
    }
    await page.waitForTimeout(600);
    const clear = page.locator("button[aria-label='Clear chat']");
    if (await clear.count()) {
      await clear.click();
      await page.waitForTimeout(1200);
    }
    await page.locator("input[aria-label='Your message']").fill(question);
    await page.keyboard.press("Enter");
    let reply = null;
    for (let i = 0; i < 16; i++) {
      await page.waitForTimeout(3000);
      const bubbles = await page.evaluate(() =>
        [...document.querySelectorAll(".site-chat-bubble")].map((b) => ({
          mine: b.className.includes("justify-end"),
          text: b.textContent.trim().slice(0, 260),
        })),
      );
      reply = bubbles.find(
        (b) => !b.mine && !/colleague|Merci pour votre message/i.test(b.text),
      );
      if (reply) break;
    }
    out[label] = reply?.text || "(no reply)";
    return reply;
  };
  await ask("Do you sell pizza?", "unknownProduct");
  await ask("How much is Chocolate Devotion?", "realProduct");
  await ask("Any promos today?", "promos");
  return out;
}
