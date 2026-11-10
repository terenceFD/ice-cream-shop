// Renders a [IMGS:a|b|c] reply in the real chat widget by intercepting the
// chat poll and answering with a canned store message. Verifies the gallery
// card UI deterministically, independent of the AI model.
export default async function run(page, ui) {
  // Intercept the chat thread poll. Every poll of an empty thread answers with
  // one store reply carrying the gallery, so the widget renders it deterministically.
  await page.route(/\/api\/chat\/messages\//, async (route) => {
    if (route.request().method() === "GET") {
      const body = [
        {
          id: 9001,
          sender: "store",
          isHuman: 0,
          body: "Here are two angles of the Chocolate Devotion — want more details, or shall I add it to your bag?\n[IMGS:/menu-official/ice-cream/signature-creations/chocolate-devotion.webp|/menu-official/ice-cream/signature-creations/chocolate-devotion-2.webp]\n[LINK:/menu?category=Signature+Creations&item=Chocolate+Devotion]",
          createdAt: new Date().toISOString(),
        },
      ];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ messages: body }),
      });
      return;
    }
    return route.continue();
  });

  await page.evaluate(() =>
    window.scrollTo(0, Math.max(600, window.innerHeight)),
  );
  await page.waitForTimeout(1200);
  const snap = await ui.snapshot();
  const launcher = snap.match(/@(e\d+) button "Chat with us"/)?.[1];
  if (!launcher) return { stage: "no-launcher" };
  await page
    .locator(`[data-ab-ref="${launcher}"]`)
    .evaluate((el) => el.click());
  await page.waitForTimeout(6000);

  await page.screenshot({ path: "qa-gallery-seeded.png" });
  const bubbleTexts = await page.locator(".site-chat-bubble").allInnerTexts();
  const imgs = await page.locator(".site-chat-bubble img").count();
  const dots = await page.locator(".site-chat-bubble span.size-1\\.5").count();
  const counter = await page
    .locator(".site-chat-bubble [role=group]")
    .getAttribute("aria-label")
    .catch(() => null);
  const thumbs = await page
    .locator('.site-chat-bubble button[aria-label^="Show photo"]')
    .count();
  return { stage: "ok", imgs, thumbs, dots, counter, bubbleTexts };
}
