// Verifies the empty-review rating row is gone and the section pill no longer covers headings.
export default async function run(page) {
  await page.goto("http://localhost:3999/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);

  // Reviews section
  const reviews = await page.evaluate(() => {
    document.getElementById("reviews")?.scrollIntoView({ block: "center" });
    const section = document.getElementById("reviews");
    const text = section?.innerText || "";
    return {
      has00: /(^|\s)0\.0(\s|$)/.test(text),
      hasBasedOnZero: /Based on 0 reviews/.test(text),
      hasInvitation: /No reviews yet/.test(text),
    };
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: "qa/shots/reviews-fixed.png" });

  // Section pill position and overlap, after scrolling through content
  await page.evaluate(() =>
    window.scrollTo({ top: 2300, behavior: "instant" }),
  );
  await page.waitForTimeout(2500);
  const pill = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Page sections"]');
    if (!nav) return { found: false };
    const r = nav.getBoundingClientRect();
    // elements whose box the pill overlaps
    const covered = [
      ...document.querySelectorAll(
        "main h1, main h2, main h3, main article, main img",
      ),
    ]
      .filter((el) => {
        const b = el.getBoundingClientRect();
        return (
          b.top < r.bottom &&
          b.bottom > r.top &&
          b.left < r.right &&
          b.right > r.left
        );
      })
      .map((el) =>
        (el.innerText || el.tagName).trim().slice(0, 40).replace(/\s+/g, " "),
      );
    return {
      found: true,
      top: Math.round(r.top),
      viewportH: innerHeight,
      covers: covered,
    };
  });
  await page.screenshot({ path: "qa/shots/pill-position.png" });

  return { reviews, pill };
}
