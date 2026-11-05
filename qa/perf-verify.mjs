// Measures the page once the app has actually rendered (not just loaded the shell).
export default async function run(page) {
  const started = Date.now();
  const resources = [];
  page.on("response", (response) => {
    const header = Number(response.headers()["content-length"] || 0);
    resources.push({
      url: response.url(),
      type: response.request().resourceType(),
      status: response.status(),
      size: header,
    });
  });

  await page.goto(page.url(), { waitUntil: "networkidle", timeout: 120000 });
  try {
    await page.waitForFunction(() => document.body.innerText.length > 800, {
      timeout: 45000,
    });
  } catch {
    /* report what we got */
  }
  await page.waitForTimeout(2500);

  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] || {};
    const fcpEntry = performance
      .getEntriesByType("paint")
      .find((e) => e.name === "first-contentful-paint");
    const resources = performance.getEntriesByType("resource");
    const transfer = resources.reduce(
      (total, r) => total + (r.transferSize || 0),
      0,
    );
    return {
      ttfb: Math.round(nav.responseStart || 0),
      domContentLoaded: Math.round(nav.domContentLoadedEventEnd || 0),
      loadEnd: Math.round(nav.loadEventEnd || 0),
      fcp: Math.round(fcpEntry?.startTime || 0),
      resourceCount: resources.length,
      resourceTransferKB: Math.round(transfer / 1024),
      bodyChars: document.body.innerText.length,
      domNodes: document.getElementsByTagName("*").length,
      imgCount: document.images.length,
      imgLazy: document.querySelectorAll('img[loading="lazy"]').length,
      imgNoDimensions: [...document.images].filter(
        (i) =>
          !i.getAttribute("width") &&
          !i.getAttribute("height") &&
          !i.getAttribute("sizes"),
      ).length,
      imgBroken: [...document.images].filter(
        (i) => i.complete && i.naturalWidth === 0,
      ).length,
      oversizeImages: [...document.images]
        .map((i) => ({
          src: (i.currentSrc || i.src).split("/").pop(),
          natural: i.naturalWidth,
          shown: Math.round(i.getBoundingClientRect().width),
        }))
        .filter((i) => i.shown > 0 && i.natural > i.shown * 2 + 100)
        .slice(0, 10),
      cls: (() => {
        // layout-shift entries are buffered; sum those not caused by recent input
        return (
          Math.round(
            (performance.getEntriesByType("layout-shift") || []).reduce(
              (t, e) => t + (e.hadRecentInput ? 0 : e.value),
              0,
            ) * 1000,
          ) / 1000
        );
      })(),
    };
  });

  // Long tasks block the main thread — the usual cause of a slow first interaction.
  const longTasks = await page.evaluate(() =>
    (performance.getEntriesByType("longtask") || []).map((t) =>
      Math.round(t.duration),
    ),
  );

  const byType = {};
  for (const r of resources) {
    const b = (byType[r.type] ||= { count: 0, bytes: 0 });
    b.count += 1;
    b.bytes += r.size;
  }
  for (const k of Object.keys(byType))
    byType[k].kb = Math.round(byType[k].bytes / 1024);

  return {
    wallMs: Date.now() - started,
    metrics,
    longTasks: longTasks.slice(0, 10),
    byType,
    failures: resources.filter((r) => r.status >= 400),
  };
}
