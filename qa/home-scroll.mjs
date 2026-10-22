// Scrolls the live home page slowly (so reveal animations fire), then reports final
// opacity of each section and captures viewport screenshots at key stops.
const stops = [0, 700, 1500, 2300, 3100, 3900, 4700, 5500, 6300];

export default async function run(page) {
  await page.goto("https://ice-cream-shop-20eg.onrender.com/", {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForTimeout(6000);
  const ghosted = await page.evaluate(() => {
    const sections = [
      ...document.querySelectorAll(
        'main section, main [data-reveal], main [class*="reveal"]',
      ),
    ];
    return sections
      .slice(0, 20)
      .map((s) => ({
        text: (s.querySelector("h1,h2,h3")?.innerText || s.innerText || "")
          .trim()
          .slice(0, 40)
          .replace(/\s+/g, " "),
        opacity: getComputedStyle(s).opacity,
        cls: s.className.slice(0, 60),
      }))
      .filter((s) => Number(s.opacity) < 1);
  });

  for (let i = 0; i < stops.length; i++) {
    await page.evaluate(
      (y) => window.scrollTo({ top: y, behavior: "instant" }),
      stops[i],
    );
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `qa/shots/home-stop-${i}.png` });
  }

  const after = await page.evaluate(() => {
    const sections = [...document.querySelectorAll("main section")];
    return sections
      .map((s) => ({
        text: (s.querySelector("h1,h2,h3")?.innerText || "")
          .trim()
          .slice(0, 40)
          .replace(/\s+/g, " "),
        opacity: getComputedStyle(s).opacity,
      }))
      .filter((s) => Number(s.opacity) < 1);
  });
  return { ghostedBeforeScroll: ghosted, stillGhostedAfter: after };
}
