// Samples the two floating widgets while scrolling the home page: they must be hidden
// over the hero and at the footer, and visible in the sections between.
export default async function run(page, ui) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(page.url().split("#")[0], { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  const read = () =>
    page.evaluate(() => {
      const chat = [...document.querySelectorAll("button")].find((el) => {
        const p = el.querySelector("svg path");
        return p && p.getAttribute("d")?.startsWith("M21 11.5c0 4.1");
      });
      const chatWrapper = chat?.parentElement;
      const currency = document.querySelector('summary[aria-label^="Currency"]')
        ?.parentElement?.parentElement;
      const boxes = [...document.querySelectorAll("[data-floating-hide]")];
      const hero = document.querySelector('[data-floating-hide="hero"]');
      const footer = document.querySelector('[data-floating-hide="footer"]');
      const style = (el) => {
        if (!el) return "absent";
        const computed = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const visible =
          computed.opacity !== "0" &&
          computed.visibility !== "hidden" &&
          rect.bottom > 0 &&
          rect.top < window.innerHeight;
        return visible ? "visible" : "hidden";
      };
      return {
        scrollY: Math.round(window.scrollY),
        heroBottom: hero ? Math.round(hero.getBoundingClientRect().bottom) : null,
        footerTop: footer ? Math.round(footer.getBoundingClientRect().top) : null,
        chat: style(chatWrapper),
        currency: style(currency),
      };
    });

  const sample = async (where) => {
    await page.evaluate((target) => {
      if (target === "footer")
        document.querySelector("footer")?.scrollIntoView({ block: "end" });
      else window.scrollTo(0, target);
    }, where);
    await page.waitForTimeout(900);
    return read();
  };

  return {
    hero: await sample(0),
    middle: await sample(2600),
    footer: await sample("footer"),
    backToMiddle: await sample(2600),
    backToHero: await sample(0),
  };
}
