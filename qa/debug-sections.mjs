// Lists every section on the home page with its id/label, to find where the reviews went.
export default async function run(page) {
  await page.goto("http://localhost:3999/", {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForTimeout(22000);
  return page.evaluate(() => ({
    sectionCount: document.querySelectorAll("section").length,
    sections: [...document.querySelectorAll("section")].map((s) => ({
      id: s.id || "(none)",
      label:
        s.getAttribute("aria-label") ||
        s.getAttribute("aria-labelledby") ||
        "(none)",
      firstText: (s.querySelector("h1,h2,h3,p")?.innerText || "")
        .trim()
        .slice(0, 40)
        .replace(/\s+/g, " "),
    })),
    reviewsWord: document.body.innerText.includes("Real Reviews"),
    sentinels: [...document.querySelectorAll("div.h-px")].length,
  }));
}
