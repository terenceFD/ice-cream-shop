// Why did the browser pick a big photo? Dump srcset/sizes/currentSrc for matching images.
const needle = process.argv[4] || "mango-sunshine";

export default async function run(page) {
  await page.goto(page.url(), { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(2500);
  // Scroll to force lazy images to resolve.
  await page.evaluate(async () => {
    const step = window.innerHeight;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1500);

  return page.evaluate((n) => {
    const vw = window.innerWidth;
    return [...document.images]
      .filter(
        (img) =>
          (img.currentSrc || img.src).includes(n) ||
          (img.getAttribute("srcset") || "").includes(n),
      )
      .map((img) => ({
        currentSrc: (img.currentSrc || "").split("/").pop(),
        src: (img.getAttribute("src") || "").split("/").pop(),
        hasSrcset: Boolean(img.getAttribute("srcset")),
        srcsetHead: (img.getAttribute("srcset") || "").slice(0, 160),
        sizes: img.getAttribute("sizes"),
        clientWidth: Math.round(img.getBoundingClientRect().width),
        naturalW: img.naturalWidth,
        loading: img.getAttribute("loading"),
        vw,
        dpr: window.devicePixelRatio,
      }));
  }, needle);
}
