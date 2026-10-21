// One-off: reorder the home page and fold "Pick it. Lick it." into the flavor section.
// Target order:
//   hero -> how it works -> flavor inspiration (+ lick sub-row) -> fan favorites
//        -> reviews -> sunshine mango -> brand story -> menu highlights
//
// Source order before this script:
//   ... -> favorites -> sunshine -> lick -> moments -> reviews -> menu
// So each block is detached individually and re-inserted at its new anchor.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(here, "../../src/pages/home/HomePage.jsx");

// Normalise line endings so every marker below matches regardless of the editor.
let src = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");

const sectionStart = (srcText, headingMarker) => {
  const heading = srcText.indexOf(headingMarker);
  if (heading === -1) throw new Error(`heading not found: ${headingMarker}`);
  return srcText.lastIndexOf("\n        <section", heading) + 1;
};

// 1. Detach tail blocks, bottom-up so earlier offsets stay valid.
const navStart = src.indexOf("\n        <nav\n");
if (navStart === -1) throw new Error("sticky nav not found");

// menu highlights: from its <section> to just before the sticky nav.
const menuFrom = sectionStart(src, 'aria-labelledby="home-menu-heading"');
const menuBlock = src.slice(menuFrom, navStart);
src = src.slice(0, menuFrom) + src.slice(navStart);

// reviews: the comment + sentinel div + <ReviewsSection ... />, ending at "/>".
const sentinelStart = src.indexOf('<div aria-hidden="true" className="h-px"');
const reviewsCommentStart = src.lastIndexOf(
  "{/* Always shown: the reviews, or an invitation to write the first one. */}",
  sentinelStart,
);
const reviewsEnd = src.indexOf(
  "\n        />",
  src.indexOf("reviewsSentinel", sentinelStart),
);
if (reviewsCommentStart === -1 || sentinelStart === -1 || reviewsEnd === -1)
  throw new Error("reviews block not found");
const reviewsBlock = src.slice(
  reviewsCommentStart,
  reviewsEnd + "\n        />".length,
);

// brand story + sunshine mango: sunshine sits between favorites and lick; moments
// sits between lick and the reviews comment. Cut them separately so lick stays put.
const sunshineHeading = src.indexOf('aria-labelledby="sunshine-heading"');
const sunshineFrom = src.lastIndexOf("\n        <section", sunshineHeading) + 1;
const momentsHeading0 = src.indexOf('aria-labelledby="moments-heading"');
const momentsFrom0 = src.lastIndexOf("\n        <section", momentsHeading0) + 1;
if (!(sunshineFrom < momentsFrom0 && momentsFrom0 < reviewsCommentStart))
  throw new Error("unexpected section order while cutting sunshine/moments");
const promoBlock =
  src.slice(sunshineFrom, momentsFrom0) +
  src.slice(momentsFrom0, reviewsCommentStart);
// Remove [sunshine .. moments) and [moments .. reviewsComment) in two cuts.
src = src.slice(0, momentsFrom0) + src.slice(reviewsCommentStart); // removes moments
const sunshineEnd = src.indexOf('aria-labelledby="lick-heading"');
const lickFrom0 = src.lastIndexOf("\n        <section", sunshineEnd) + 1;
if (
  !src
    .slice(sunshineFrom, lickFrom0)
    .includes('aria-labelledby="sunshine-heading"')
)
  throw new Error("sunshine cut boundary misplaced");
src = src.slice(0, sunshineFrom) + src.slice(lickFrom0); // removes sunshine

// lick: after the sunshine/moments cuts, lick runs from its <section> straight to
// the reviews comment (there is no section in between any more).
const lickHeadingPos = src.indexOf('aria-labelledby="lick-heading"');
if (lickHeadingPos === -1) throw new Error("lick heading not found");
const lickFrom = src.lastIndexOf("\n        <section", lickHeadingPos) + 1;
const reviewsCommentNow = src.indexOf(
  "{/* Always shown: the reviews, or an invitation to write the first one. */}",
  lickHeadingPos,
);
if (reviewsCommentNow === -1)
  throw new Error("reviews comment missing after sunshine cut");
if (reviewsCommentNow < lickFrom)
  throw new Error("reviews comment before lick");
const lickBlock = src.slice(lickFrom, reviewsCommentNow);
src = src.slice(0, lickFrom) + src.slice(reviewsCommentNow);

// 2. "Pick it. Lick it." becomes a compact sub-row inside the flavor section.
const listStart = lickBlock.indexOf('<ul className="mt-14 grid gap-6');
const listEnd = lickBlock.indexOf("</ul>", listStart);
if (listStart === -1 || listEnd === -1) throw new Error("lick list not found");
let lickList = lickBlock.slice(listStart, listEnd + "</ul>".length);

const adaptations = [
  [
    'className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-7"',
    'className="mt-8 grid grid-cols-2 gap-3.5 sm:grid-cols-4 sm:gap-4"',
  ],
  [
    'className="absolute inset-x-4 bottom-0 top-6 rounded-[26px] bg-[#092a53]/25 blur-2xl opacity-0 transition duration-500 group-hover:opacity-100"',
    'className="absolute inset-x-3 bottom-0 top-4 rounded-[20px] bg-[#092a53]/20 opacity-0 blur-xl transition duration-500 group-hover:opacity-100"',
  ],
  [
    "rounded-[26px] bg-white p-3 pb-0 shadow-[0_6px_20px_rgba(9,42,83,0.10)]",
    "rounded-[22px] bg-white p-2.5 shadow-[0_6px_20px_rgba(9,42,83,0.08)]",
  ],
  ["group-hover:-translate-y-2", "group-hover:-translate-y-1"],
  ["group-hover:scale-[1.07]", "group-hover:scale-[1.06]"],
  [
    "aspect-[4/5] overflow-hidden rounded-[18px]",
    "aspect-[4/3] overflow-hidden rounded-[15px]",
  ],
  // No sheen sweep: one motion language across the page.
  [
    `                      {/* SHEEN-REMOVE */}
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 -translate-x-full bg-[linear-gradient(115deg,transparent_30%,rgb(255_255_255/0.35)_50%,transparent_70%)] transition-transform duration-1000 ease-out group-hover:translate-x-full"
                      />
`,
    "",
  ],
  [
    "absolute left-3 top-3 grid size-9",
    "absolute left-2.5 top-2.5 grid size-7",
  ],
  [
    "rounded-full bg-white/90 font-display text-sm",
    "rounded-full bg-white/90 font-display text-xs",
  ],
  ["px-3 py-4", "px-1.5 pb-1 pt-3"],
  [
    "text-lg font-extrabold leading-tight",
    "text-sm font-extrabold leading-tight sm:text-base",
  ],
  ["size-8 shrink-0", "size-7 shrink-0"],
  ["justify-between gap-3", "justify-between gap-2"],
];
for (const [from, to] of adaptations) {
  if (!lickList.includes(from))
    throw new Error(`adaptation target missing: ${from.slice(0, 70)}`);
  lickList = lickList.replace(from, to);
}

const lickSubRow = `
            {/* Pick it. Lick it. — serving styles, folded in here as a compact row instead
                of taking a whole section of its own further down the page. */}
            <div className="mt-14 border-t border-[#e4e0d4] pt-12">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div className="max-w-xl">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#123b68]">
                    {t("Your happy, your way")}
                  </p>
                  <h2
                    className="mt-3 font-display text-3xl font-extrabold leading-[1.05] tracking-tight text-[#092a53] sm:text-4xl"
                    id="lick-heading"
                  >
                    {t("Pick it. Lick it. Love it.")}
                  </h2>
                  <p className="mt-3 text-base leading-7 text-[#123b68]">
                    {t("A cone for the stroll. A cup for the pause. A scoop to share.")}
                  </p>
                </div>
                <Link
                  className="group inline-flex shrink-0 items-center gap-2 self-start rounded-full bg-[#092a53] px-7 py-3.5 text-sm font-extrabold text-white shadow-[0_12px_28px_rgba(9,42,83,0.3)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#163e6b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2 sm:self-auto"
                  to="/menu?category=Ice%20Cream"
                >
                  {t("See cones, cups & pints")}
                  <ArrowIcon />
                </Link>
              </div>
${lickList}
            </div>
`;

// 3. Append the sub-row at the end of the flavor inspiration section.
const flavorEnd = src.indexOf(
  '"A little flavor inspiration. Discover the current selection in store.",',
);
const flavorClose = src.indexOf(
  "          </div>\n        </section>",
  flavorEnd,
);
if (flavorEnd === -1 || flavorClose === -1)
  throw new Error("flavor section not found");
src = src.slice(0, flavorClose) + lickSubRow + src.slice(flavorClose);

// 4. Re-insert in the target order:
//    reviews right after fan favorites; sunshine+moments after that; menu last.
const sunshineHeading2 = src.indexOf('aria-labelledby="sunshine-heading"');
const sunshineFrom2 =
  src.lastIndexOf("\n        <section", sunshineHeading2) + 1;
src =
  src.slice(0, sunshineFrom2) +
  `${reviewsBlock}\n\n` +
  src.slice(sunshineFrom2);

const navStart2 = src.indexOf("\n        <nav\n");
if (navStart2 === -1) throw new Error("sticky nav missing after edits");
src =
  src.slice(0, navStart2) +
  `${promoBlock}\n${menuBlock}` +
  src.slice(navStart2);

fs.writeFileSync(file, src, "utf8");

// 5. Verify the final section order.
const mainAt = src.indexOf("      <main>");
const order = [
  'aria-labelledby="how-it-works-heading"',
  'id="flavors"',
  'id="favorites"',
  "ref={reviewsSentinel}",
  'aria-labelledby="sunshine-heading"',
  'aria-labelledby="moments-heading"',
  'id="menu"',
].map((marker) => src.indexOf(marker, mainAt));
console.log("markers:", order);
if (order.some((index) => index === -1))
  throw new Error("a section went missing");
if (!order.every((index, i) => i === 0 || order[i - 1] < index))
  throw new Error("sections are out of order");
console.log("OK — new line count:", src.split("\n").length);
