// Reproduces the real-world failure: a visitor keeps their thread id in localStorage,
// but the device cookie is gone (cleared cookies, private window, cookie blocked,
// or a different browser profile on the same machine).
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://localhost:3976";
const browser = await chromium.launch({ channel: "chromium" });

const openChat = async (page) => {
  await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((node) =>
      /chat|message|help/i.test(node.getAttribute("aria-label") || ""),
    );
    button?.click();
  });
  await page.waitForTimeout(1000);
};

// Visitor A starts a conversation.
const a = await browser.newContext();
const pageA = await a.newPage();
await pageA.goto(`${BASE}/menu/all`, { waitUntil: "networkidle" });
await pageA.waitForTimeout(1200);
await openChat(pageA);
const threadId = await pageA.evaluate(() =>
  localStorage.getItem("cold-stone-chat-thread"),
);
await pageA.evaluate(async (id) => {
  await fetch("/api/chat/messages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ threadId: id, body: "Hello from visitor A" }),
  });
}, threadId);
console.log("thread created:", threadId);

// Same browser, but the device cookie is gone while localStorage survives.
// This is what happens after "clear cookies", in a private window, or when a
// browser blocks the cookie.
await a.clearCookies();
const afterCookieLoss = await pageA.evaluate(async (id) => {
  const response = await fetch(`/api/chat/messages/${id}`);
  return {
    status: response.status,
    body: (await response.text()).slice(0, 160),
  };
}, threadId);
console.log("after cookie loss, read:", JSON.stringify(afterCookieLoss));

// And sending a new message.
const sendAfter = await pageA.evaluate(async (id) => {
  const response = await fetch("/api/chat/messages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ threadId: id, body: "Are you there?" }),
  });
  return {
    status: response.status,
    body: (await response.text()).slice(0, 160),
  };
}, threadId);
console.log("after cookie loss, send:", JSON.stringify(sendAfter));

console.log("");
console.log(
  "BUG REPRODUCED:",
  afterCookieLoss.status === 403 || sendAfter.status === 403,
);

await browser.close();
