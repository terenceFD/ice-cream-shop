// Reports where the reviews sentinel ends up and what the observer sees.
export default async function run(page) {
  await page.goto("http://localhost:3999/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(9000);

  const before = await page.evaluate(() => {
    const node = [
      ...document.querySelectorAll('div[aria-hidden="true"].h-px'),
    ].pop();
    const rects = node ? node.getBoundingClientRect() : null;
    return {
      sentinelTop: rects ? Math.round(rects.top) : null,
      sentinelHeight: rects ? Math.round(rects.height) : null,
      skeletonShown: /animate-pulse/.test(
        (document.querySelector('section[aria-label="Real Reviews"]') || {})
          .className || "",
      ),
      realSectionShown: !!document.getElementById("reviews"),
    };
  });

  await page.evaluate(() =>
    window.scrollTo({ top: 99999, behavior: "instant" }),
  );
  await page.waitForTimeout(9000);

  const after = await page.evaluate(() => ({
    sentinelTop: Math.round(
      (
        [
          ...document.querySelectorAll('div[aria-hidden="true"].h-px'),
        ].pop() || { getBoundingClientRect: () => ({ top: 0 }) }
      ).getBoundingClientRect().top,
    ),
    skeletonShown: /animate-pulse/.test(
      (document.querySelector('section[aria-label="Real Reviews"]') || {})
        .className || "",
    ),
    realSectionShown: !!document.getElementById("reviews"),
    reviewsText: (
      document.getElementById("reviews") ||
      document.querySelector('section[aria-label="Real Reviews"]') ||
      {}
    ).innerText
      ?.replace(/\s+/g, " ")
      .slice(0, 250),
  }));
  await page.screenshot({ path: "qa/shots/reviews-bottom.png" });
  return { before, after };
}
