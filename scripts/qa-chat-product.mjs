// End-to-end: open a product detail page, ask the agent about the product through
// the real chat, and wait for the AI reply bubble. Polls up to 60s.
export default async function run(page, _ui) {
  await page.waitForSelector("main", { timeout: 60000 });
  await page.waitForTimeout(1500);
  const out = {};
  // Open the first product of the Ice Cream category.
  await page.locator("main button", { hasText: "Ice Cream" }).first().click();
  await page.waitForTimeout(1200);
  await page.locator("main .scroll-reveal button").first().click();
  await page.waitForTimeout(1200);
  out.product = await page.evaluate(() => ({
    url: location.pathname + location.search,
    title: document.querySelector("#menu-product-title")?.textContent.trim(),
  }));
  // Open the chat, clear any old thread, then ask.
  await page
    .locator("button[aria-label='Chat with us']")
    .click({ timeout: 30000 });
  await page.waitForTimeout(600);
  const clearBtn = page.locator("button[aria-label='Clear chat']");
  if (await clearBtn.count()) {
    await clearBtn.click();
    await page.waitForTimeout(1500);
  }
  await page
    .locator("input[aria-label='Your message']")
    .fill("Tell me briefly about this product");
  await page.keyboard.press("Enter");
  // Wait for the reply: poll the bubble list until a store bubble lands.
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(3000);
    const bubbles = await page.evaluate(() =>
      [...document.querySelectorAll(".site-chat-bubble")].map((b) => ({
        mine: b.className.includes("justify-end"),
        text: b.textContent.trim().slice(0, 240),
      })),
    );
    out.bubbles = bubbles;
    const reply = bubbles.find(
      (b) =>
        !b.mine && !/colleague|Merci pour votre message ! Un/i.test(b.text),
    );
    if (reply) {
      out.reply = reply;
      break;
    }
  }
  out.typingStillShowing = await page.evaluate(() =>
    Boolean(document.querySelector(".site-chat-typing")),
  );
  return out;
}
