import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}
let found = false;
for (const f of walk("src")) {
  if (!/\.(jsx|tsx|ts|js|css)$/.test(f)) continue;
  const text = readFileSync(f, "utf8");
  const m = text.match(/[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F]/g);
  if (m) {
    const lines = text.split("\n");
    lines.forEach((line, idx) => {
      if (/[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(line)) {
        console.log(
          `${f}:${idx + 1}: ${JSON.stringify(line.trim().slice(0, 90))}`,
        );
        found = true;
      }
    });
  }
}
console.log(found ? "DONE found" : "DONE clean");
