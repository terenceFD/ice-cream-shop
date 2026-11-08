// QA: ask the agent to add an item, then click the Add button it shows, and
// read the cart afterwards. Exposes whether the reply's add button actually
// puts the item in the bag.
export default async function run(page, ui) {
  await page.goto("http://localhost:5173/menu");
  // The site loader holds the screen briefly; wait it out before anything else.
  await page.waitForFunction(
    () =>
      !document.querySelector('[data-website-loader="visible"]') &&
      !document.body.innerText.includes("Preparing your Cold Stone experience"),
    { timeout: 20000 },
  );
  await page.waitForTimeout(1500);
  const decline = page.locator("button", { hasText: /^Decline$/ }).first();
  if (await decline.count()) {
    await decline.click({ timeout: 5000 });
    await page.waitForTimeout(600);
  }

  // The launcher shows only in the page's middle: past the header, before the
  // footer. Scroll to the footer's top minus a viewport, so the launcher is
  // inside the visible band.
  await page.evaluate(() => {
    const footer = document.querySelector('[data-floating-hide="footer"]');
    const top = footer
      ? Math.max(
          0,
          footer.getBoundingClientRect().top +
            window.scrollY -
            window.innerHeight -
            80,
        )
      : 600;
    window.scrollTo({ top });
    window.dispatchEvent(new Event("scroll"));
  });
  await page.waitForTimeout(1000);

  // The launcher is present on the menu page from the top: click it by its
  // aria-label (a real Playwright click, the animation settles fast).
  const launcher = page.locator("button[aria-label='Chat with us']").first();
  if (!(await launcher.count())) {
    return { error: "no chat launcher on the menu page" };
  }
  // A splash or an overlay can sit over the launcher for a beat; force the
  // click through rather than wait out the actionability check.
  await launcher.click({ force: true });
  await page.waitForTimeout(1500);

  const panel = page
    .locator("section")
    .filter({ has: page.locator("input[aria-label='Your message']") })
    .first();
  const box = page.locator("input[aria-label='Your message']").first();
  await box.fill("add the chocolate devotion to my bag");
  await box.press("Enter");
  // Wait for the store reply, then for the automatic add to land.
  await page.waitForTimeout(14000);

  const cart = await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem("cold-stone-cart") || "[]").map(
        (item) => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
        }),
      );
    } catch {
      return [];
    }
  });
  const panelText = await panel.innerText().catch(() => "");
  return {
    cart,
    hasAutoAddedNote: panelText.includes("Added to your bag"),
    hasAddButton: /Add to bag/.test(panelText),
    panelTail: panelText.slice(-500),
  };
}
