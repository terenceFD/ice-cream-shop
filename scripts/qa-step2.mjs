// Step 2 in the live session: open the chat and ask about a product.
export default async function run(page, ui) {
  // Widgets show mid-page only.
  await page.evaluate(() => {
    window.scrollTo(0, Math.max(600, window.innerHeight));
  });
  await page.waitForTimeout(1200);

  const snap = await ui.snapshot();
  const launcher = snap.match(/@(e\d+) button "Chat with us"/)?.[1];
  if (!launcher) return { stage: "no-launcher", tail: snap.slice(-1200) };

  await page
    .locator(`[data-ab-ref="${launcher}"]`)
    .evaluate((el) => el.click());
  await page.waitForTimeout(2500);

  const composer = page.getByRole("textbox", { name: "Your message" });
  const composerCount = await composer.count();
  if (!composerCount) {
    const after = await ui.snapshot();
    return { stage: "no-composer", tail: after.slice(-1600) };
  }

  await composer.fill("how much is Chocolate Devotion?");
  await composer.press("Enter");
  // Wait for a store reply: up to 40s, polling the last bubble's text.
  let reply = "";
  for (let i = 0; i < 20; i += 1) {
    await page.waitForTimeout(2000);
    const bubbles = await page.locator(".site-chat-bubble").allInnerTexts();
    const stores = bubbles.filter(
      (b) => /Cold Stone|Shop team/i.test(b) === false || b.length > 40,
    );
    reply = stores.at(-1) || "";
    if (/\[|FCFA|Choco/i.test(reply)) break;
  }
  await page.screenshot({ path: "qa-card.png" });
  const imgCount = await page.locator(".site-chat-bubble img").count();
  return {
    stage: "ok",
    imgCount,
    reply: reply.replace(/\s+/g, " ").slice(0, 400),
  };
}
