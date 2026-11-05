// Reports the header's flex children and their computed widths, to see what is
// consuming the space between the nav and the right-hand controls.
export default async function run(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(page.url(), { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(1500);

  return page.evaluate(() => {
    const header = document.querySelector("header");
    const children = [...header.children].map((node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return {
        tag: node.tagName.toLowerCase(),
        label: (node.getAttribute("aria-label") || node.textContent || "")
          .trim()
          .slice(0, 30),
        x: Math.round(rect.x),
        width: Math.round(rect.width),
        right: Math.round(rect.right),
        flex: style.flex,
        marginLeft: style.marginLeft,
      };
    });
    const headerRect = header.getBoundingClientRect();
    return {
      header: {
        x: Math.round(headerRect.x),
        width: Math.round(headerRect.width),
        right: Math.round(headerRect.right),
      },
      children,
    };
  });
}
