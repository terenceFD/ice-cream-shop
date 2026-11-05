// Which images actually cost the most bytes on this page, and what is above the fold.
export default async function run(page) {
  const images = [];
  page.on("response", (response) => {
    if (response.request().resourceType() !== "image") return;
    const length = Number(response.headers()["content-length"] || 0);
    if (length > 50000) {
      images.push({
        file: response.url().split("/").pop().slice(0, 90),
        kb: Math.round(length / 1024),
        status: response.status(),
      });
    }
  });

  await page.goto(page.url(), { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(2500);

  const fold = await page.evaluate(() => {
    const vh = window.innerHeight;
    return [...document.images]
      .filter((img) => {
        const rect = img.getBoundingClientRect();
        return rect.top < vh && rect.bottom > 0 && rect.width > 0;
      })
      .map((img) => ({
        src: (img.currentSrc || img.src).split("/").pop().slice(0, 90),
        shown: Math.round(img.getBoundingClientRect().width),
        natural: img.naturalWidth,
        lazy: img.getAttribute("loading") || "eager",
        fetchpriority: img.getAttribute("fetchpriority") || "-",
      }));
  });

  const dimensionless = await page.evaluate(() =>
    [...document.images]
      .filter((i) => !i.getAttribute("width") && !i.getAttribute("height"))
      .map((i) => ({
        src: (i.currentSrc || i.src).split("/").pop().slice(0, 70),
        alt: (i.alt || "").slice(0, 40),
      }))
      .slice(0, 15),
  );

  const fonts = await page.evaluate(() =>
    [...document.fonts].map((f) => `${f.family} ${f.weight} ${f.status}`),
  );

  return {
    heavyImages: images.sort((a, b) => b.kb - a.kb),
    aboveFold: fold,
    dimensionless,
    fonts,
  };
}
