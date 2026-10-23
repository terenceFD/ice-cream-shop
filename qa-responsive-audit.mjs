// Responsive audit: loads the live site (or localhost preview) at several viewport
// sizes, checks for horizontal overflow, broken layout, and console/network errors.
import { chromium } from "playwright";

const BASE =
  process.env.AUDIT_URL || "https://ice-cream-shop-20eg.onrender.com";
const VIEWPORTS = [
  { name: "phone-s", width: 360, height: 740 },
  { name: "phone-l", width: 414, height: 896 },
  { name: "tablet-p", width: 768, height: 1024 },
  { name: "tablet-l", width: 1024, height: 768 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "desktop", width: 1920, height: 1080 },
];

const browser = await chromium.launch();
const out = [];
for (const vp of VIEWPORTS) {
  const page = await browser.newPage({
    viewport: { width: vp.width, height: vp.height },
  });
  const consoleErrors = [];
  const failedRequests = [];
  page.on(
    "console",
    (m) => m.type() === "error" && consoleErrors.push(m.text()),
  );
  page.on("requestfailed", (r) =>
    failedRequests.push(`${r.url()} :: ${r.failure()?.errorText}`),
  );
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
  try {
    await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  } catch (e) {
    out.push(
      `### ${vp.name} (${vp.width}x${vp.height})\nNAVIGATION FAILED: ${e.message}\n`,
    );
    await page.close();
    continue;
  }
  await page.waitForTimeout(1200);
  // Scroll through the page so lazy sections/images render.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(800);
  const issues = await page.evaluate(() => {
    const doc = document.documentElement;
    const vw = window.innerWidth;
    const overflow = doc.scrollWidth - vw;
    const overflowing = [];
    if (overflow > 2) {
      for (const el of document.querySelectorAll("body *")) {
        const r = el.getBoundingClientRect();
        if (
          r.width > 0 &&
          r.right > vw + 8 &&
          r.left < vw &&
          el.children.length < 6
        ) {
          overflowing.push(
            `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0] || ""} right=${Math.round(r.right)}`,
          );
        }
        if (overflowing.length >= 8) break;
      }
    }
    const brokenImages = [...document.querySelectorAll("img")]
      .filter(
        (i) => i.complete && i.naturalWidth === 0 && !i.dataset.allowBroken,
      )
      .map((i) => i.src.slice(0, 120));
    const tinyText = [
      ...document.querySelectorAll("button, a, p, span, h1, h2, h3"),
    ]
      .filter((el) => {
        const s = getComputedStyle(el);
        const fs = parseFloat(s.fontSize);
        return fs && fs < 10 && el.textContent.trim().length > 0;
      })
      .slice(0, 5)
      .map(
        (el) =>
          `${el.tagName.toLowerCase()} "${el.textContent.trim().slice(0, 30)}" fs=${getComputedStyle(el).fontSize}`,
      );
    return { overflow, overflowing, brokenImages, tinyText };
  });
  const summary = [
    `### ${vp.name} (${vp.width}x${vp.height})`,
    `horizontal overflow: ${issues.overflow > 2 ? `YES (${issues.overflow}px)` : "none"}`,
    ...(issues.overflowing.length
      ? ["overflowing elements: " + issues.overflowing.join(" | ")]
      : []),
    ...(issues.brokenImages.length
      ? ["broken images: " + issues.brokenImages.join(", ")]
      : []),
    ...(issues.tinyText.length
      ? ["tiny text (<10px): " + issues.tinyText.join(" | ")]
      : []),
    ...(consoleErrors.length
      ? ["console errors: " + consoleErrors.slice(0, 5).join(" || ")]
      : []),
    ...(failedRequests.length
      ? ["failed requests: " + failedRequests.slice(0, 5).join(" || ")]
      : []),
    "",
  ];
  out.push(summary.join("\n"));
  await page.screenshot({
    path: `../qa/shots/responsive-${vp.name}.png`,
    fullPage: false,
  });
  await page.close();
}
await browser.close();
console.log(out.join("\n"));
