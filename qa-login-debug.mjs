export default async function run(page) {
  await page.goto("http://localhost:5173/admin/login", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(1500);
  await page.fill('input[type="email"]', "terencetimah3@gmail.com");
  await page.fill('input[type="password"]', "DevSpotlight2025!");
  // Capture the API response of the sign-in attempt
  const responseInfo = await Promise.all([
    page
      .waitForResponse(
        (response) =>
          response.url().includes("/api/admin") &&
          response.request().method() === "POST",
        { timeout: 8000 },
      )
      .catch(() => null),
    page.keyboard.press("Enter"),
  ]).then(([response]) => response);
  await page.waitForTimeout(1500);
  return {
    apiUrl: responseInfo?.url(),
    apiStatus: responseInfo?.status(),
    apiBody: responseInfo ? await responseInfo.text().catch(() => "") : null,
    urlNow: page.url(),
    errorText: await page.evaluate(
      () =>
        document.querySelector('[role="alert"], .text-red-700, .text-red-500')
          ?.textContent || null,
    ),
  };
}
