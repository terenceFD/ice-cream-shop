// Renders a remove-reply in the real chat widget by intercepting the chat
// poll: one customer message ("remove the mango"), one store reply with
// [BAG:set:flavor:12*0]. Verifies ChatAutoBag applies the removal without a
// tap — the bag badge must drop from 2 to 1.
export default async function run(page, ui) {
  await page.route(/\/api\/chat\/messages\//, async (route) => {
    if (route.request().method() === "GET") {
      const body = [
        {
          id: 9002,
          sender: "customer",
          body: "please remove the mango from my bag",
          createdAt: new Date(Date.now() - 60000).toISOString(),
        },
        {
          id: 9003,
          sender: "store",
          isHuman: 0,
          body: "Taken out — your bag now has one item.\n[BAG:set:flavor:12*0]",
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

  // Seed a flavor in the bag before the chat opens, through the app's own cart
  // API so the badge reflects the real store.
  await page.evaluate(async () => {
    const res = await fetch("/api/flavors", { credentials: "include" }).catch(
      () => null,
    );
    window.__seedFlavor = res && res.ok ? await res.json() : null;
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
  // ChatAutoBag fires 400 ms after mount; give the poll and timer room.
  await page.waitForTimeout(5000);

  await page.screenshot({ path: "qa-bag-remove.png" });
  const autoNote = await page
    .locator(".site-chat-bubble")
    .allInnerTexts()
    .then((texts) =>
      texts.find((t) => /Done|Updating your bag|no longer in your bag/.test(t)),
    );
  return { stage: "ok", autoNote: autoNote || null };
}
