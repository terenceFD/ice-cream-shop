// Screenshot the admin payments page at three widths after logging in.
// Usage: node tmp-payments-shots.mjs <outPrefix>
import { chromium } from "playwright";
const base = "http://localhost:5174";
const prefix = process.argv[2] || "before";
const browser = await chromium.launch({
  executablePath: "C:\\Users\\forbi\\AppData\\Local\\ms-playwright\\chromium-1247\\chrome-win64\\chrome.exe",
})
const out = [];
for (const vp of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 900 },
  { name: "phone", width: 390, height: 844 },
]) {
  const page = await browser.newPage({
    viewport: { width: vp.width, height: vp.height },
  });
  await page.goto(`${base}/admin/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.fill('input[type="email"]', "terencetimah3@gmail.com");
  await page.fill('input[type="password"]', "DevSpotlight2025!");
  await page.waitForTimeout(300);
  await Promise.all([
    page.waitForNavigation({ timeout: 15000 }).catch(() => "no-nav"),
    page.click('button:has-text("Login")'),
  ]);
  await page.waitForTimeout(2500);
  const errText = await page.locator("[role=alert], .text-red, [class*=error]").first().textContent().catch(() => "");
  if (errText) console.log("login error:", errText.trim());
  console.log("after-login url:", page.url());
  await page
    .goto(`${base}/admin/payments`, { waitUntil: "domcontentloaded" })
    .catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({
    path: `.taste-skill/payments-app/${prefix}-${vp.name}.png`,
    fullPage: true,
  });
  out.push(vp.name);
  await page.close();
}
await browser.close();
console.log("shots:", out.join(", "));
