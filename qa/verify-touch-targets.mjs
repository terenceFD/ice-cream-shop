// Verifies touch targets after the fix. The visible controls stay the same
// size; invisible pseudo-element hit areas bring them to >=44px. Probes a few
// px outside each visible box, which only reaches the button when the expanded
// hit area exists (and proves no overlay is swallowing the taps).
export default async function run(page) {
  return await page.evaluate(async () => {
    const centreOf = async (el) => {
      el.scrollIntoView({ block: "center", behavior: "instant" });
      // Scroll-reveal fades sections in; a hit test on a half-faded card is meaningless.
      const deadline = Date.now() + 3000;
      await new Promise((resolveWait) => {
        const poll = () => {
          let n = el;
          while (n && getComputedStyle(n).opacity === "1") n = n.parentElement;
          if (!n || Date.now() > deadline) resolveWait();
          else setTimeout(poll, 50);
        };
        poll();
      });
      await new Promise((r) => setTimeout(r, 250));
      const r = el.getBoundingClientRect();
      return {
        x: r.left + r.width / 2,
        y: r.top + r.height / 2,
        w: r.width,
        h: r.height,
      };
    };

    const results = [];
    const check = async (selector, label) => {
      const el = [...document.querySelectorAll(selector)].find(
        (node) => node.getBoundingClientRect().width > 0,
      );
      if (!el) return results.push({ label, missing: true });
      const c = await centreOf(el);
      // Probe 3px outside the visible edge: inside an expanded area, on the old
      // 32px circle it lands on the surrounding surface instead of the button.
      results.push({
        label,
        visible: `${Math.round(c.w)}x${Math.round(c.h)}`,
        ownsCentre: el.contains(document.elementFromPoint(c.x, c.y)),
        owns3pxOutsideLeft: el.contains(
          document.elementFromPoint(c.x - c.w / 2 - 3, c.y),
        ),
        owns3pxOutsideBottom: el.contains(
          document.elementFromPoint(c.x, c.y + c.h / 2 + 3),
        ),
      });
    };

    await check(
      'article button[aria-label="Pause slideshow"], li button[aria-label="Pause slideshow"]',
      "Card pause button",
    );
    await check('main button[aria-label^="Show photo 1"]', "Photo thumbnail");
    await check("main button[aria-pressed]", "Flavour filter chip");

    const cakeChips = [
      ...document.querySelectorAll("main button[aria-pressed]"),
    ];
    const cakeChip = cakeChips[cakeChips.length - 1];
    if (cakeChip) {
      const c = await centreOf(cakeChip);
      results.push({
        label: `Cake chip "${cakeChip.textContent.trim()}"`,
        visible: `${Math.round(c.w)}x${Math.round(c.h)}`,
      });
    }
    return results;
  });
}
