import fs from "node:fs";
const raw = fs.readFileSync("src/pages/home/HomePage.jsx", "utf8");
const text = raw.replace(/\r\n/g, "\n");
const lickHeadingPos = text.indexOf('aria-labelledby="lick-heading"');
const reviewsCommentNow = text.indexOf(
  "{/* Always shown: the reviews, or an invitation to write the first one. */}",
  lickHeadingPos,
);
const lickFrom = text.lastIndexOf("\n        <section", lickHeadingPos) + 1;
const lickBlockEnd = text.lastIndexOf("\n        <section", reviewsCommentNow) + 1;
const lickBlock = text.slice(lickFrom, lickBlockEnd);
const li = lickBlock.indexOf('<ul className="mt-14 grid gap-6');
console.log("lickFrom", lickFrom, "end", lickBlockEnd, "ul idx", li);
console.log("has ice-images:", lickBlock.includes("ice-images"));
console.log(lickBlock.slice(0, 200));
