// Captures the install prompt card as it renders today.
export default async function run(page) {
  await page.addInitScript(() => {
    // Make the browser think an install prompt is available so the card shows.
    window.__installPromptReady = true;
  });
  await page.goto(page.url(), { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(1500);

  // Accept cookies first so the banner does not overlap.
  await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((node) =>
      /accept/i.test(node.textContent || ""),
    );
    button?.click();
  });

  // Force the card open for the screenshot.
  await page.evaluate(() => {
    sessionStorage.removeItem("cold-stone-install-shown-this-session");
    const event = new Event("beforeinstallprompt");
    event.prompt = async () => {};
    event.userChoice = Promise.resolve({ outcome: "dismissed" });
    window.__deferredPrompt = event;
    window.dispatchEvent(new CustomEvent("cold-stone-install-available"));
  });
  await page.waitForTimeout(3200);

  const card = await page.$(".install-app-card");
  const box = card ? await card.boundingBox() : null;
  await page.screenshot({
    path: `qa/install-before-${page.viewportSize().width}.png`,
  });
  return { present: Boolean(card), box };
}
