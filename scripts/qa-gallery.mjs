// QA: ask the chat agent for more photos of a product, and check whether a
// photo gallery renders in the thread. Screenshot for the visual check.
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
  if (!(await composer.count())) {
    const after = await ui.snapshot();
    return { stage: "no-composer", tail: after.slice(-1600) };
  }

  await composer.fill("please can i see more photos of Chocolate Devotion?");
  await composer.press("Enter");

  let reply = "";
  for (let i = 0; i < 25; i += 1) {
    await page.waitForTimeout(2000);
    const bubbles = await page.locator(".site-chat-bubble").allInnerTexts();
    const store = bubbles
      .filter((b) => !/Type a message|Share my location/i.test(b))
      .at(-1);
    if (
      store &&
      /(photo|image|gallery|FCFA|Chocolate)/i.test(store) &&
      store.length > 60
    ) {
      reply = store;
      // give images a beat to load before counting
      await page.waitForTimeout(2500);
      break;
    }
  }
  await page.screenshot({ path: "qa-gallery.png" });
  const imgs = await page.locator(".site-chat-bubble img").count();
  const thumbs = await page.locator(".site-chat-bubble img.size-full").count();
  return {
    stage: "ok",
    imgs,
    thumbs,
    reply: reply.replace(/\s+/g, " ").slice(0, 500),
  };
}
