// Diagnose the floating widget state while scrolling.
export default async function run(page, _ui) {
  await page.waitForSelector("main", { timeout: 60000 });
  await page.waitForFunction(
    () => !/Preparing your Cold Stone experience/.test(document.body.innerText),
    { timeout: 90000 },
  );
  await page.waitForTimeout(2500);
  await page.setViewportSize({ width: 1440, height: 900 });
  const read = () =>
    page.evaluate(() => {
      const button = document.querySelector("button[aria-label='Chat with us']");
      const wrapper = button?.parentElement;
      return {
        scrollY: window.scrollY,
        docHeight: document.body.scrollHeight,
        innerH: window.innerHeight,
        wrapperOpacity: wrapper ? getComputedStyle(wrapper).opacity : "none",
        wrapperPointer: wrapper ? getComputedStyle(wrapper).pointerEvents : "none",
        heroMarked: Boolean(document.querySelector('[data-floating-hide="hero"]')),
        heroBottom: document.querySelector('[data-floating-hide="hero"]')
          ? document.querySelector('[data-floating-hide="hero"]').getBoundingClientRect().bottom
          : null,
        footerTop: document.querySelector('[data-floating-hide="footer"]')
          ? document.querySelector('[data-floating-hide="footer"]').getBoundingClientRect().top
          : null,
      };
    });
  const states = { atTop: await read() };
  await page.evaluate(() => window.scrollTo(0, 1500));
  await page.waitForTimeout(1200);
  states.at1500 = await read();
  await page.evaluate(() => window.scrollTo(0, 2000));
  await page.waitForTimeout(1200);
  states.at2000 = await read();
  return states;
}
