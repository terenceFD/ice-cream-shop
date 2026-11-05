// Real-browser performance audit: Core Web Vitals + resource weight + slow/large items.
export default async function run(page) {
  const started = Date.now();
  const resources = [];
  page.on("response", async (response) => {
    try {
      const request = response.request();
      const size = Number(response.headers()["content-length"] || 0);
      resources.push({
        url: response.url(),
        type: request.resourceType(),
        status: response.status(),
        size,
        encoding: response.headers()["content-encoding"] || "",
      });
    } catch {
      /* ignore */
    }
  });

  await page.goto(page.url(), { waitUntil: "networkidle", timeout: 90000 });

  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] || {};
    const paint = performance.getEntriesByType("paint");
    const fcp = paint.find((entry) => entry.name === "first-contentful-paint");
    const lcpEntry = performance
      .getEntriesByType("largest-contentful-paint")
      .at(-1);
    return {
      ttfb: Math.round(nav.responseStart || 0),
      domContentLoaded: Math.round(nav.domContentLoadedEventEnd || 0),
      load: Math.round(nav.loadEventEnd || 0),
      fcp: Math.round(fcp ? fcp.startTime : 0),
      lcp: Math.round(lcpEntry ? lcpEntry.startTime : 0),
      transferSize: Math.round(nav.transferSize || 0),
      decodedBody: Math.round(nav.decodedBodySize || 0),
      images: document.images.length,
      lazy: document.querySelectorAll('img[loading="lazy"]').length,
      imgNoDim: [...document.images].filter(
        (img) => !img.getAttribute("width") && !img.getAttribute("height"),
      ).length,
      imgBroken: [...document.images].filter(
        (img) => img.complete && img.naturalWidth === 0,
      ).length,
      domNodes: document.getElementsByTagName("*").length,
      // Largest images, by rendered size and by natural size.
      heaviestImages: [...document.images]
        .map((img) => ({
          src: img.currentSrc || img.src,
          w: img.naturalWidth,
          h: img.naturalHeight,
          shown: Math.round(img.getBoundingClientRect().width),
        }))
        .sort((a, b) => b.w * b.h - a.w * a.h)
        .slice(0, 8),
    };
  });

  const byType = {};
  for (const resource of resources) {
    const bucket = (byType[resource.type] ||= { count: 0, bytes: 0 });
    bucket.count += 1;
    bucket.bytes += resource.size;
  }

  return {
    wallMs: Date.now() - started,
    metrics,
    byType,
    slowest: resources.sort((a, b) => b.size - a.size).slice(0, 10),
    failures: resources.filter(
      (r) =>
        r.status >= 400 &&
        !r.url.includes("google") &&
        !r.url.includes("analytics"),
    ),
  };
}
