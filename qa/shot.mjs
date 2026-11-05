// Screenshot + heading inventory, to confirm the app renders normally (no duplicate <h1>).
export default async function run(page) {
  await page.goto(page.url(), { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "qa/final-home.png" });
  return page.evaluate(() => ({
    h1Count: document.querySelectorAll("h1").length,
    h1Text: [...document.querySelectorAll("h1")].map((h) =>
      h.textContent.trim(),
    ),
    noscriptVisible: [...document.querySelectorAll("noscript")].some(
      (n) => n.getBoundingClientRect().height > 0,
    ),
    bodyChars: document.body.innerText.length,
    firstText: document.body.innerText.slice(0, 160),
  }));
}
