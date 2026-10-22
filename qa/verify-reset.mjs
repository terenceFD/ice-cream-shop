// Walks the full password reset flow on the local server: request code, then confirm with the code.
// The code itself lands in the server console log, which this script cannot read — so the
// second half is run separately once the code is known.
export default async function run(page) {
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto("http://localhost:3999/login", {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForTimeout(12000);

  const steps = {};
  steps.loginFormVisible = await page
    .locator('form input[type="email"]')
    .isVisible()
    .catch(() => false);
  steps.forgotLink = await page
    .getByRole("button", { name: /forgot password/i })
    .count();

  if (steps.forgotLink) {
    await page.getByRole("button", { name: /forgot password/i }).click();
    await page.waitForTimeout(800);
    steps.resetHeading = await page.evaluate(() =>
      [...document.querySelectorAll("h1")].some((h) =>
        /reset your password/i.test(h.innerText),
      ),
    );
    steps.emailStillFilled = await page
      .inputValue('form input[type="email"]')
      .catch(() => "");
    steps.sendButton = await page
      .getByRole("button", { name: /send reset code/i })
      .count();
    await page.screenshot({ path: "qa/shots/reset-request.png" });
  }

  return { steps, errors };
}
