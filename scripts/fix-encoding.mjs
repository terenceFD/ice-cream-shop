import fs from "node:fs";
const p =
  "C:/Users/forbi/Desktop/ice cream site/ice-cream-site/src/pages/home/HomePage.jsx";
const buf = fs.readFileSync(p);
const text = buf.toString("utf8");
// text contains mojibake: original UTF-8 bytes were decoded as latin1 and re-saved as UTF-8.
// Fix: encode current text to latin1 (recovers original UTF-8 bytes), decode as UTF-8.
const fixed = Buffer.from(text, "latin1").toString("utf8");
fs.writeFileSync(p, fixed, "utf8");
console.log(
  "done, mojibake remaining:",
  (fixed.match(/â€|ðŸ|Ã©/g) || []).length,
);
