// QA script: build a real bag on the menu page, open the chat widget, send
// "make it two", and check the reply renders the "Update my bag" button.
export default async function run(page, ui) {
  // The menu lists categories first; open one so its product cards (and their
  // add buttons) render, then click the first two adds to build a real bag.
  const openCategory = page
    .locator("button")
    .filter({ hasText: /\d+ items/ })
    .first();
  if (await openCategory.count()) {
    await openCategory.click({ timeout: 8000 });
    await page.waitForTimeout(2000);
  }
  await page.evaluate(() => window.scrollBy(0, 1200));
  await page.waitForTimeout(1500);
  const addButtons = page.locator('button[aria-label*="to cart"]');
  const addCount = await addButtons.count();
  if (!addCount) {
    return {
      error: "no add-to-cart buttons found on the menu page",
      buttonSample: await page.evaluate(() =>
        [...document.querySelectorAll("button")]
          .slice(0, 12)
          .map(
            (button) =>
              button.getAttribute("aria-label") ||
              button.textContent.trim().slice(0, 30),
          ),
      ),
    };
  }
  // Two clicks on the SAME product build a bag of 2 — that is the quantity
  // "make it two" changes, and it keeps the matching unambiguous.
  await addButtons.first().click({ timeout: 8000 });
  await page.waitForTimeout(800);
  await addButtons.first().click({ timeout: 8000 });
  await page.waitForTimeout(1500);

  // No reload here: the cart context holds the live state in memory, and the
  // reload happened before the reply was seen emptying it. The widget reads the
  // cart from context, not localStorage, at send time.

  // The launcher only shows in the page's middle: scroll past the hero first.
  // A plain scrollBy fires the scroll listener the widget tracks.
  await page.evaluate(() => {
    const hero = document.querySelector('[data-floating-hide="hero"]');
    window.scrollTo({
      top: (hero?.getBoundingClientRect().bottom ?? 0) + window.scrollY + 60,
    });
    window.dispatchEvent(new Event("scroll"));
  });
  await page.waitForTimeout(1200);

  // Open the chat launcher.
  const snapshot = await ui.snapshot();
  const launcher = snapshot.match(
    /@(e\d+) button[^\n]*(chat|Chat|message|Message|support|Support)[^\n]*/,
  )?.[1];
  if (!launcher) return { error: "no chat launcher found", snapshot };
  // The launcher animates on hover, which keeps ui.click's actionability check
  // from settling — a direct DOM click fires the handler deterministically.
  await page.evaluate((ref) => {
    document.querySelector(`[data-ab-ref="${ref}"]`)?.click();
  }, launcher);
  await page.waitForTimeout(1500);

  const opened = await page.locator("section[aria-label*='Chat']").count();
  if (!opened)
    return {
      error: "panel did not open",
      clicked: launcher,
      ariaNow: await page.evaluate(() =>
        document
          .querySelector('[aria-label="Chat with us"]')
          ?.getAttribute("aria-expanded"),
      ),
    };

  const panel = page
    .locator("section")
    .filter({ has: page.locator("input[aria-label='Your message']") })
    .first();
  const box = page.locator("input[aria-label='Your message']").first();
  await box.fill("make it two");
  await box.press("Enter");

  // Wait for the store reply.
  await page.waitForTimeout(12000);
  const panelText = await panel.innerText().catch(() => "");
  // Tap "Update my bag" and read the cart again — the quantity must have moved.
  const updateButton = panel
    .locator("button", { hasText: "Update my bag" })
    .first();
  let cartAfterTap = null;
  if (await updateButton.count()) {
    await updateButton.click({ timeout: 5000 });
    await page.waitForTimeout(1200);
    cartAfterTap = await page.evaluate(() => {
      try {
        return JSON.parse(localStorage.getItem("cold-stone-cart") || "[]").map(
          (item) => ({ name: item.name, quantity: item.quantity }),
        );
      } catch {
        return [];
      }
    });
  }
  return {
    panelTextLength: panelText.length,
    hasUpdateButton: panelText.includes("Update my bag"),
    cartAfterTap,
    panelTail: panelText.slice(-600),
  };
}
