import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

function walk(dir, out = []) {
  for (const e of readdirSync(dir, {
    withFileTypes: true,
  })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.(jsx|tsx|ts|js|css)$/.test(e.name)) out.push(full);
  }
  return out;
}
let found = false;
for (const f of walk("src")) {
  const buf = readFileSync(f);
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 0) {
      console.log(`${f}: NULL byte at offset ${i}`);
      found = true;
      break;
    }
  }
}
console.log(found ? "DONE found" : "DONE clean");
