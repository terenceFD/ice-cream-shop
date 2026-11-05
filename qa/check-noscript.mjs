// Confirms the <noscript> fallback only appears on indexable public pages.
const base = process.argv[2] || "http://localhost:3999";

for (const path of [
  "/",
  "/menu/all",
  "/faq",
  "/admin",
  "/checkout",
  "/cart",
  "/account/orders",
]) {
  const html = await (await fetch(base + path)).text();
  const noscript = html.includes("<noscript>");
  const robots =
    (html.match(/name="robots" content="([^"]+)"/) || [])[1] || "(none)";
  const status = (await fetch(base + path)).status;
  console.log(
    `${path.padEnd(16)} status=${status} noscript=${String(noscript).padEnd(5)} robots=${robots}`,
  );
}
