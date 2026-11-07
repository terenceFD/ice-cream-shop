// Full verification of the new agent features, in one live run:
// 1+2 starters and ask-about-this, 4 voice button presence, 7 photo attach,
// plus a real AI reply about the product on screen.
export default async function run(page, _ui) {
  await page.waitForSelector("main", { timeout: 60000 });
  await page.waitForTimeout(2000);
  const out = {};

  // --- Product detail page: ask-about-this chips (#1/#2)
  await page.locator("main button", { hasText: "Ice Cream" }).first().click();
  await page.waitForTimeout(1200);
  await page.locator("main .scroll-reveal button").first().click();
  await page.waitForTimeout(1500);
  out.productTitle = await page.evaluate(() =>
    document.querySelector("#menu-product-title")?.textContent.trim(),
  );

  // --- Open chat: starters must show, page-aware (product questions)
  await page.locator("button[aria-label='Chat with us']").click();
  await page.waitForTimeout(900);
  out.starters = await page.evaluate(() =>
    [...document.querySelectorAll(".site-chat-bubble, button")]
      .map((el) => el.textContent.trim())
      .filter((text) =>
        /Tell me about this product|What is in it|How do I order it/.test(text),
      ),
  );

  // --- Voice button present when supported (#4)
  out.voiceButton = await page.evaluate(() =>
    Boolean(document.querySelector("button[aria-label='Speak your message']")),
  );

  // --- Photo attach button present (#7)
  out.photoButton = await page.evaluate(() =>
    Boolean(document.querySelector("button[aria-label='Attach a photo']")),
  );

  // --- Ask via a starter chip, wait for the real AI reply
  const chip = page
    .locator("button", { hasText: "Tell me about this product" })
    .first();
  if (await chip.count()) {
    await chip.click();
    await page.waitForTimeout(500);
    await page.locator("button[aria-label='Send message']").click();
  } else {
    await page
      .locator("input[aria-label='Your message']")
      .fill("Tell me about this product");
    await page.keyboard.press("Enter");
  }
  for (let i = 0; i < 18; i++) {
    await page.waitForTimeout(3000);
    const bubbles = await page.evaluate(() =>
      [...document.querySelectorAll(".site-chat-bubble")].map((b) => ({
        mine: b.className.includes("justify-end"),
        text: b.textContent.trim().slice(0, 200),
      })),
    );
    const reply = bubbles.find(
      (b) => !b.mine && !/colleague|Merci pour votre message/i.test(b.text),
    );
    if (reply) {
      out.aiReply = reply.text;
      break;
    }
  }
  out.typingStillShowing = await page.evaluate(() =>
    Boolean(document.querySelector(".site-chat-typing")),
  );
  return out;
}
