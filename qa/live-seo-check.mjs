// Live SEO + header reconnaissance for a deployed URL.
const url = process.argv[2] || "https://ice-cream-shop-20eg.onrender.com/";

const times = [];
for (let i = 0; i < 3; i += 1) {
  const started = Date.now();
  const response = await fetch(url);
  await response.text();
  times.push(Date.now() - started);
}
console.log("warm_sequential_ms:", times.join(","));

const response = await fetch(url);
const html = await response.text();
console.log("status:", response.status, "html_bytes:", Buffer.byteLength(html));

const one = (label, re) => {
  const match = html.match(re);
  console.log(label, match ? match[0].slice(0, 200) : "(missing)");
};
one("TITLE:", /<title[^>]*>([^<]*)<\/title>/);
one("DESC:", /<meta[^>]+name="description"[^>]*>/);
one("CANONICAL:", /<link[^>]+rel="canonical"[^>]*>/);
one("ROBOTS:", /<meta[^>]+name="robots"[^>]*>/);
one("HTMLTAG:", /<html[^>]*>/);
one("VIEWPORT:", /<meta[^>]+name="viewport"[^>]*>/);
one("OG_IMAGE:", /<meta[^>]+property="og:image"[^>]*>/);
one("THEME:", /<meta[^>]+name="theme-color"[^>]*>/);

console.log("h1_count:", (html.match(/<h1[\s>]/g) || []).length);
console.log("h2_count:", (html.match(/<h2[\s>]/g) || []).length);
console.log("img_without_alt:", (html.match(/<img(?![^>]*\balt=)[^>]*>/g) || []).length);
console.log("lazy_imgs:", (html.match(/loading="lazy"/g) || []).length);
console.log("preload_links:", (html.match(/rel="preload"/g) || []).length);
console.log("modulepreload:", (html.match(/rel="modulepreload"/g) || []).length);
console.log("inline_scripts:", (html.match(/<script(?![^>]*\bsrc=)[^>]*>/g) || []).length);

for (const match of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
  console.log("JSONLD:", match[1].replace(/\s+/g, " ").slice(0, 240));
}
