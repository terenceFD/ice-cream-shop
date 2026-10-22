import fs from "node:fs";
import path from "node:path";

const root = "C:/Users/forbi/Desktop/ice cream site/ice-cream-site/src";
const exts = new Set([".jsx", ".tsx", ".js", ".ts", ".css"]);

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (exts.has(path.extname(entry.name))) {
      const buf = fs.readFileSync(full);
      if (buf.includes(0)) {
        console.log("NULL BYTES:", full);
      }
    }
  }
}
walk(root);
console.log("done");
