import { writeFileSync } from "node:fs";

export default async function run(page) {
  const origin = new URL(page.url()).origin;
  const errors = [];
  const failedRequests = [];
  page.on("pageerror", (error) =>
    errors.push({ url: page.url(), error: error.message }),
  );
  page.on("requestfailed", (request) => {
    if (!request.failure()?.errorText.includes("ERR_ABORTED"))
      failedRequests.push({
        url: request.url(),
        error: request.failure()?.errorText,
      });
  });
  const routes = [
    "/",
    "/flavors",
    "/menu",
    "/menu/all",
    "/events",
    "/custom-cake",
    "/locations",
    "/about",
    "/contact",
    "/cart",
    "/login",
    "/signup",
    "/admin/login",
  ];
  const widths = [320, 390, 768, 1024, 1366, 1920];
  const results = [];
  for (const path of routes) {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(`${origin}${path}`, {
      waitUntil: "networkidle",
      timeout: 45000,
    });
    await page.locator("main").first().waitFor({ timeout: 20000 });
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 800) {
        scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 60));
      }
      scrollTo(0, 0);
    });
    for (const width of widths) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
      await page.waitForTimeout(150);
      const result = await page.evaluate(() => {
        const visible = (el) => {
          const style = getComputedStyle(el);
          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            el.getBoundingClientRect().width > 0
          );
        };
        const overflow = Math.max(
          0,
          document.documentElement.scrollWidth - innerWidth,
        );
        const overflowing = [...document.querySelectorAll("main *, header *")]
          .filter((el) => {
            if (!visible(el)) return false;
            const rect = el.getBoundingClientRect();
            return (
              rect.right > innerWidth + 2 &&
              rect.width > 0 &&
              !el.closest(
                '[class*="overflow-x-auto"], [class*="overflow-hidden"]',
              )
            );
          })
          .slice(0, 12)
          .map((el) => ({
            tag: el.tagName,
            text: el.textContent.slice(0, 65),
            class: String(el.className).slice(0, 130),
            right: Math.round(el.getBoundingClientRect().right),
          }));
        return {
          overflow,
          overflowing,
          brokenImages: [...document.images]
            .filter(
              (img) => visible(img) && img.complete && img.naturalWidth === 0,
            )
            .map((img) => img.getAttribute("src")),
          heading: document.querySelector("h1")?.textContent,
          headerHeight: Math.round(
            document.querySelector("header")?.getBoundingClientRect().height ||
              0,
          ),
          bodyChars: document.querySelector("main")?.textContent.length,
        };
      });
      results.push({ path, width, ...result });
      if (
        [390, 768, 1366].includes(width) &&
        ["/", "/locations", "/contact", "/events", "/admin/login"].includes(
          path,
        )
      ) {
        const name = path === "/" ? "home" : path.replaceAll("/", "-").slice(1);
        await page.screenshot({
          path: `qa/responsive-${name}-${width}.png`,
          fullPage: path === "/contact",
        });
      }
    }
  }
  const report = { results, errors, failedRequests };
  writeFileSync("qa/responsive-results.json", JSON.stringify(report, null, 2));
  return {
    checks: results.length,
    widths,
    issues: results.filter(
      (r) => r.overflow || r.brokenImages.length || !r.bodyChars,
    ),
    errors,
    failedRequests: failedRequests.slice(0, 20),
  };
}
