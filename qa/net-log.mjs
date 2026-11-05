// Full network log of image requests, including whether they 404'd and their exact URLs.
export default async function run(page) {
  const requests = [];
  page.on("response", (response) => {
    if (response.request().resourceType() !== "image") return;
    requests.push({
      url: response
        .url()
        .replace("https://ice-cream-shop-20eg.onrender.com", ""),
      status: response.status(),
      kb: Math.round(Number(response.headers()["content-length"] || 0) / 1024),
    });
  });

  await page.goto(page.url(), { waitUntil: "networkidle", timeout: 120000 });
  await page.evaluate(async () => {
    const step = window.innerHeight;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 150));
    }
  });
  await page.waitForTimeout(2000);

  const failures = requests.filter((r) => r.status >= 400);
  const thumbs = requests.filter((r) => r.url.includes("/thumbs/")).length;
  return {
    totalImages: requests.length,
    thumbnailsUsed: thumbs,
    fullSizeUsed: requests
      .filter((r) => !r.url.includes("/thumbs/"))
      .map((r) => r.url),
    failures: failures.slice(0, 20),
    failureCount: failures.length,
  };
}
