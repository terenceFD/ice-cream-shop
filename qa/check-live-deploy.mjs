// Confirms the live site is serving the latest build and reports where its first byte goes.
const url = "https://ice-cream-shop-20eg.onrender.com/";
const response = await fetch(url, { cache: "no-store" });
const html = await response.text();

const entry = html.match(/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0] || "none";
const heroPreloads = [...html.matchAll(/<link rel="preload" as="image"/g)]
  .length;

console.log("status           ", response.status);
console.log(
  "server-timing    ",
  response.headers.get("server-timing") || "(absent - old build)",
);
console.log("cache-control    ", response.headers.get("cache-control"));
console.log("entry bundle     ", entry);
console.log("home chunk listed", /HomePage-/.test(html));
console.log("image preloads   ", heroPreloads);
