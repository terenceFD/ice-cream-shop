// Extracts every t("...") / t('...') key in src and reports which lack a French translation.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, files);
    else if (/\.(jsx?|tsx?)$/.test(entry)) files.push(p);
  }
  return files;
}

const src = walk(join(process.cwd(), "src"));
const used = new Map(); // key -> [files]
const keyRegex = /\bt\(\s*(["'{`])([^"'`]+)\1/g;
for (const file of src) {
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(keyRegex)) {
    const key = m[2];
    if (!used.has(key)) used.set(key, []);
    used.get(key).push(file.replace(process.cwd() + "\\", ""));
  }
}

// Transpile french.ts with the project's TypeScript compiler so multi-line
// "key": "value" entries parse correctly, then evaluate the module.
const ts = (await import("typescript")).default;
const source = readFileSync(
  join(process.cwd(), "src/language/french.ts"),
  "utf8",
);
const js = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
// Run the transpiled CommonJS with a fake require (no external imports in this file).
const moduleStub = { exports: {} };
new Function("module", "exports", "require", js)(
  moduleStub,
  moduleStub.exports,
  () => ({}),
);
const french = moduleStub.exports.default;

const missing = [];
const suspicious = [];
for (const [key, files] of [...used.entries()].sort()) {
  if (key.length < 2) continue;
  // Keys that are interpolated or dynamic are skipped when they contain {
  if (!(key in french))
    missing.push({ key, files: [...new Set(files)].slice(0, 4) });
  else if (french[key] === key)
    suspicious.push({ key, files: [...new Set(files)].slice(0, 3) });
}
console.log("keys used:", used.size);
console.log("french entries:", Object.keys(french).length);
console.log("\n== MISSING translations ==");
for (const m of missing)
  console.log(JSON.stringify(m.key), "<-", m.files.join(", "));
console.log("\n== SUSPICIOUS (value equals key) ==");
for (const m of suspicious)
  console.log(JSON.stringify(m.key), "<-", m.files.join(", "));
