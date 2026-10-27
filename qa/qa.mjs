export default async function run(page, ui) {
  const result = {};
  try {
    await page
      .waitForSelector(".loader, .spinner, .loading", {
        state: "detached",
        timeout: 20000,
      })
      .catch(() => {});
    await page
      .waitForLoadState("networkidle", { timeout: 20000 })
      .catch(() => {});

    result.title = await page.title();
    result.bodyText = (
      await page.evaluate(() => document.body.innerText)
    ).slice(0, 3000);
    await page.screenshot({
      path: "ice-cream-site/qa/qa-initial.png",
      fullPage: false,
    });
  } catch (e) {
    result.error = e.message;
  }
  return result;
}
