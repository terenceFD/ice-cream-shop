// Trace one image: initial DOM attributes vs. after load, and every network hit for it.
const needle = "mango-sunshine";

export default async function run(page) {
  const hits = [];
  page.on("request", (request) => {
    if (request.resourceType() === "image" && request.url().includes(needle)) {
      hits.push({
        url: request.url().split("/").slice(-2).join("/"),
        at: Date.now(),
      });
    }
  });
  page.on("response", (response) => {
    if (response.url().includes(needle) && response.status() >= 400) {
      hits.push({ url: response.url(), FAILED: response.status() });
    }
  });

  await page.goto(page.url(), { waitUntil: "networkidle", timeout: 120000 });
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 150));
    }
  });
  await page.waitForTimeout(2000);

  const dom = await page.evaluate((n) => {
    return [...document.images]
      .filter(
        (img) =>
          (img.currentSrc || "").includes(n) ||
          (img.getAttribute("srcset") || "").includes(n) ||
          (img.getAttribute("src") || "").includes(n),
      )
      .map((img) => ({
        currentSrc: (img.currentSrc || "").split("/").slice(-2).join("/"),
        src: (img.getAttribute("src") || "").split("/").slice(-2).join("/"),
        srcset: img.getAttribute("srcset"),
        sizes: img.getAttribute("sizes"),
        fullPhotoFlag: img.dataset.fullPhoto || null,
        finalFallbackFlag: img.dataset.finalFallback || null,
        clientWidth: Math.round(img.getBoundingClientRect().width),
        naturalWidth: img.naturalWidth,
      }));
  }, needle);

  return { hits, dom };
}
