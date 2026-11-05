// Runs the QA audit modules against a URL and prints JSON per module.
// Usage: node qa/run-audit.mjs <url> [module1,m2,...] [--mobile]
import { chromium } from "playwright";

const url = process.argv[2] || "https://ice-cream-shop-20eg.onrender.com/";
const only =
  process.argv[3] && !process.argv[3].startsWith("--")
    ? process.argv[3].split(",")
    : null;
const mobile = process.argv.includes("--mobile");

const moduleNames = only || [
  "perf-verify",
  "perf-audit",
  "check-preloads",
  "qa",
];

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  channel: process.env.CHROME_PATH ? undefined : "chromium",
});
const context = await browser.newContext(
  mobile
    ? {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      }
    : { viewport: { width: 1440, height: 900 } },
);

for (const name of moduleNames) {
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await page
    .goto(url, { waitUntil: "commit", timeout: 120000 })
    .catch(() => {});
  try {
    const mod = (await import(`./${name}.mjs`)).default;
    const result = await mod(page);
    console.log(
      JSON.stringify(
        {
          module: name,
          url,
          result,
          consoleErrors: consoleErrors.slice(0, 10),
          pageErrors,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.log(JSON.stringify({ module: name, url, error: error.message }));
  }
  await page.close();
}

await browser.close();
