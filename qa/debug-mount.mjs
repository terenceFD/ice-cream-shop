// Reports whether React mounted and what the loader is waiting for.
export default async function run(page) {
  await page.goto("http://localhost:3999/", {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForTimeout(25000);
  return page.evaluate(() => {
    const root = document.getElementById("root");
    return {
      rootChildren: root?.children.length ?? 0,
      rootHtml: (root?.innerHTML || "").slice(0, 200),
      hasMain: !!document.querySelector("main"),
      loaderVisible: !!document.querySelector(
        "[class*='WebsiteLoader'], [aria-busy='true']",
      ),
      serviceWorker: navigator.serviceWorker?.controller ? "active" : "none",
      sections: document.querySelectorAll("section").length,
    };
  });
}
