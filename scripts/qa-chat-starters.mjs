// Verifies the page-aware starter chips on the menu page (generic set) and
// captures one screenshot of the chat panel with the chips visible.
export default async function run(page, _ui) {
  await page.waitForSelector("main", { timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.locator("button[aria-label='Chat with us']").click();
  await page.waitForTimeout(1200);
  const out = await page.evaluate(() => {
    const chips = [...document.querySelectorAll("button")]
      .map((el) => el.textContent.trim())
      .filter((text) =>
        /What's popular|Any promos today|Do you deliver to me|How do loyalty points work/.test(
          text,
        ),
      );
    return { starterChips: chips, count: chips.length };
  });
  await page.screenshot({ path: "scripts/chat-starters.png" });
  return out;
}
