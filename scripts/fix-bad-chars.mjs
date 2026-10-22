import { readFileSync, writeFileSync } from "node:fs";

const p = "src/pages/home/HomePage.jsx";
let text = readFileSync(p, "utf8");

// Repair known corrupted sequences (U+FFFD + partial chars) to their originals.
const fixes = [
  // apostrophes
  [/Founder\uFFFD"s Favorite/g, "Founder\u2019s Favorite"],
  [/Cookie Doughn\uFFFD"t/g, "Cookie Doughn\u2019t"],
  // em dash sequences (FFFD + 0x1D were part of the em dash's bytes)
  [/\uFFFD\u001d/g, "\u2014"],
  // emoji in "How it works"
  [/"\uFFFDx\uFFFD"/g, '"\uD83C\uDFC6"'],
  [/"\uFFFDx\u001c\uFFFD"/g, '"\uD83D\uDCF1"'],
  [/"\uFFFDx:\uFFFD"/g, '"\uD83D\uDEF5"'],
  // quote emoji (star)
  [/\uFFFD S\uFFFD/g, "\u2728"],
  [/\uFFFDs\uFFFD/g, "\u2728"],
  // hero placeholder with fancy quotes
  [
    /Search \uFFFDSDubai chocolate\u2B21, \uFFFDsmango\u2B1D\u2B26/g,
    "Search \u201CDubai chocolate\u201D, \u201Cmango\u201D\u2026",
  ],
  // payment emoji at 2290
  [/\uFFFDx\u0019\uFFFD/g, "\uD83D\uDCB3"],
];

for (const [re, replacement] of fixes) {
  text = text.replace(re, replacement);
}

writeFileSync(p, text, "utf8");
console.log("written; remaining FFFD:", (text.match(/\uFFFD/g) || []).length);
