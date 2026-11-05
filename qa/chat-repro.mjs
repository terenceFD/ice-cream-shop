// Reproduces the "belongs to another visitor" error with two separate browsers.
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://localhost:3976";

const browser = await chromium.launch({ channel: "chromium" });

// Visitor A: opens the chat and sends a message.
const a = await browser.newContext();
const pageA = await a.newPage();
await pageA.goto(`${BASE}/menu/all`, { waitUntil: "networkidle" });
await pageA.waitForTimeout(1500);
// Open the chat so the widget creates its thread id.
await pageA.evaluate(() => {
  const button = [...document.querySelectorAll("button")].find((node) =>
    /chat|message|help/i.test(node.getAttribute("aria-label") || ""),
  );
  button?.click();
});
await pageA.waitForTimeout(1200);
const threadA = await pageA.evaluate(() =>
  localStorage.getItem("cold-stone-chat-thread"),
);
const sendA = await pageA.evaluate(async () => {
  const threadId = localStorage.getItem("cold-stone-chat-thread");
  const response = await fetch("/api/chat/messages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ threadId, body: "Hello from visitor A" }),
  });
  return {
    status: response.status,
    body: (await response.text()).slice(0, 120),
  };
});

// Visitor B: a completely separate browser profile.
const b = await browser.newContext();
const pageB = await b.newPage();
await pageB.goto(`${BASE}/menu/all`, { waitUntil: "networkidle" });
await pageB.waitForTimeout(1500);
await pageB.evaluate(() => {
  const button = [...document.querySelectorAll("button")].find((node) =>
    /chat|message|help/i.test(node.getAttribute("aria-label") || ""),
  );
  button?.click();
});
await pageB.waitForTimeout(1200);
const threadB = await pageB.evaluate(() =>
  localStorage.getItem("cold-stone-chat-thread"),
);
const readB = await pageB.evaluate(async () => {
  const threadId = localStorage.getItem("cold-stone-chat-thread");
  const response = await fetch(`/api/chat/messages/${threadId}`);
  return {
    status: response.status,
    body: (await response.text()).slice(0, 160),
  };
});

console.log("visitor A thread:", threadA);
console.log("visitor A send  :", JSON.stringify(sendA));
console.log("visitor B thread:", threadB);
console.log("visitor B read  :", JSON.stringify(readB));
console.log("");
console.log("same thread id shared by both visitors:", threadA === threadB);
console.log("visitor B blocked:", readB.status === 403);

await browser.close();
