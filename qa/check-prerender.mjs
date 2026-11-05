// What a crawler that does not run JavaScript now sees in the raw HTML.
const base = process.argv[2] || "http://localhost:3993";

for (const path of [
  "/",
  "/flavors",
  "/menu/all",
  "/faq",
  "/admin",
  "/checkout",
]) {
  const html = await (await fetch(base + path)).text();
  const noscript = (html.match(/<noscript>[\s\S]*?<\/noscript>/) || [""])[0];
  const h1 = (noscript.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "(none)";
  const h2s = [...noscript.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map(
    (m) => m[1],
  );
  const links = (noscript.match(/<a href=/g) || []).length;
  const prices = (noscript.match(/FCFA/g) || []).length;
  const text = noscript
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  console.log(
    `${path.padEnd(11)} chars=${String(text.length).padStart(5)} h1="${h1}" h2=${JSON.stringify(h2s)} links=${links} prices=${prices}`,
  );
}

// Show a slice of the home page static copy so the wording can be read.
const home = await (await fetch(base + "/")).text();
const ns = (home.match(/<noscript>[\s\S]*?<\/noscript>/) || [""])[0];
console.log("\n--- home page static copy (first 700 chars of text) ---");
console.log(
  ns
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 700),
);
