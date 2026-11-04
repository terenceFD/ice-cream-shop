export default async function run(page) {
  const results = {};
  // Fill the footer newsletter form and submit with a fresh address.
  const email = `qa-${Date.now()}@example.com`;
  await page.locator("#newsletter-email").scrollIntoViewIfNeeded();
  await page.fill("#newsletter-email", email);
  await page.click('form button[type=submit]:has-text("Subscribe")');
  try {
    await page.waitForSelector("footer [role=status]", { timeout: 8000 });
    results.successMessage = await page
      .locator("footer [role=status]")
      .innerText();
    results.email = email;
  } catch {
    results.successMessage = "NOT FOUND";
    results.footerText = (await page.locator("footer").innerText()).slice(-300);
  }
  // Also verify the honeypot field exists and stays out of the way.
  results.honeypotHidden = await page.evaluate(() => {
    const input = document.querySelector('input[name="website_url"]');
    if (!input) return "MISSING";
    const rect = input.getBoundingClientRect();
    return rect.width === 0 || rect.height === 0 || rect.left < 0
      ? "hidden-ok"
      : "VISIBLE";
  });
  return results;
}
