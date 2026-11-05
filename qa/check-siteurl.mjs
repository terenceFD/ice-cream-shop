// Confirms canonical URLs, sitemap and OG follow SITE_URL rather than the request host.
const base = process.argv[2] || "http://localhost:3995";

for (const path of ["/", "/menu/all", "/faq"]) {
  const html = await (await fetch(base + path)).text();
  const canonical =
    (html.match(/rel="canonical" href="([^"]+)"/) || [])[1] || "(none)";
  const ogUrl =
    (html.match(/property="og:url" content="([^"]+)"/) || [])[1] || "(none)";
  console.log(`${path.padEnd(10)} canonical=${canonical}  og:url=${ogUrl}`);
}

const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
const first = (sitemap.match(/<loc>([^<]+)<\/loc>/) || [])[1] || "(none)";
const robots = await (await fetch(`${base}/robots.txt`)).text();
const sitemapLine = (robots.match(/Sitemap: (.+)/) || [])[1] || "(none)";
console.log(`sitemap first loc = ${first}`);
console.log(`robots sitemap    = ${sitemapLine}`);
