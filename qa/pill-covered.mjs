// Names the single element the pill overlaps when scrolling up.
export default async function run(page) {
  await page.goto("http://localhost:3999/", {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForTimeout(25000);
  await page.evaluate(() => {
    document.querySelectorAll("body > div").forEach((n) => {
      const style = getComputedStyle(n);
      if (
        style.position === "fixed" &&
        !n.querySelector("nav[aria-label='Page sections']")
      )
        n.remove();
    });
  });
  await page.waitForTimeout(1500);

  await page.evaluate(() =>
    window.scrollTo({ top: 4800, behavior: "instant" }),
  );
  await page.waitForTimeout(1200);
  await page.evaluate(() =>
    window.scrollBy({ top: -700, behavior: "instant" }),
  );
  await page.waitForTimeout(1200);

  const info = await page.evaluate(() => {
    const nav = document.querySelector("nav[aria-label='Page sections']");
    const r = nav.getBoundingClientRect();
    const covered = [
      ...document.querySelectorAll(
        "main h1, main h2, main h3, main article, main img, main a, main p",
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
      .map((el) => ({
        tag: el.tagName,
        text: (el.innerText || "").trim().slice(0, 60).replace(/\s+/g, " "),
      }));
    return { pillBottomGap: Math.round(innerHeight - r.bottom), covered };
  });
  await page.screenshot({ path: "qa/shots/pill-up-final.png" });
  return info;
}
