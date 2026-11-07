// Single re-check of the real-product price question.
export default async function run(page, _ui) {
  await page.waitForSelector("main", { timeout: 60000 });
  await page.waitForFunction(
    () => !/Preparing your Cold Stone experience/.test(document.body.innerText),
    { timeout: 90000 },
  );
  await page.waitForTimeout(2500);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => {
    const target = Math.min(
      document.body.scrollHeight - window.innerHeight + 100,
      Math.max(1200, document.body.scrollHeight / 2),
    );
    window.scrollTo(0, target);
  });
  await page.waitForTimeout(1200);
  await page
    .locator("button[aria-label='Chat with us']")
    .click({ timeout: 20000 });
  await page.waitForTimeout(600);
  await page
    .locator("input[aria-label='Your message']")
    .fill("How much is Chocolate Devotion?");
  await page.keyboard.press("Enter");
  for (let i = 0; i < 16; i++) {
    await page.waitForTimeout(3000);
    const bubbles = await page.evaluate(() =>
      [...document.querySelectorAll(".site-chat-bubble")].map((b) => ({
        mine: b.className.includes("justify-end"),
        text: b.textContent.trim().slice(0, 300),
      })),
    );
    // Report every bubble, template or not — a silent thread must be distinguishable
    // from a fallback template answer.
    if (bubbles.length) {
      return {
        bubbles,
        reply:
          bubbles.find(
            (b) =>
              !b.mine && !/colleague|Merci pour votre message/i.test(b.text),
          )?.text || `(fallback: ${bubbles.find((b) => !b.mine)?.text})`,
      };
    }
  }
  return { reply: "(no reply)" };
}
