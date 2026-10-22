// Scrolls down to trigger the reviews sentinel, then reports the section's final state.
export default async function run(page) {
  await page.goto("http://localhost:3999/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(20000);
  // The reviews only load once the sentinel scrolls near the viewport.
  await page.evaluate(() =>
    window.scrollTo({ top: document.body.scrollHeight / 2, behavior: "instant" }),
  );
  await page.waitForTimeout(8000);

  const state = await page.evaluate(() => {
    const section = document.getElementById("reviews");
    if (!section) return { found: false };
    const text = section.innerText.replace(/\s+/g, " ");
    return {
      found: true,
      text: text.slice(0, 320),
      shows00: /(^|\s)0\.0(\s|$)/.test(text),
      showsBasedOnZero: /Based on 0 reviews/.test(text),
      showsInvitation: /No reviews yet/.test(text),
      starRowVisible: /Based on \d+ review/.test(text),
    };
  });
  await page.screenshot({ path: "qa/shots/reviews-final.png" });
  return state;
}
