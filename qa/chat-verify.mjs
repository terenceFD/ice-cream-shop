// The reported bug in a real browser: the shopper's thread id survives in
// localStorage but the chat device cookie is gone. They must be able to send a
// message, never see "This conversation belongs to another ..." as error text.
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://localhost:5173";
const browser = await chromium.launch({ channel: "chromium" });
const context = await browser.newContext();
const page = await context.newPage();

const openChat = async () => {
  const launcher = page.locator('button[aria-label="Chat with us"]');
  if (await launcher.isVisible().catch(() => false)) {
    await dismissCookies();
    await launcher.click();
  }
  await page.waitForTimeout(1000);
  console.log(
    "  composer present:",
    await page
      .locator('input[placeholder="Type a message…"]')
      .isVisible()
      .catch(() => false),
  );
};

const dismissCookies = async () => {
  const banner = page.getByRole("region", { name: "Cookie consent" });
  if (await banner.isVisible().catch(() => false)) {
    await banner.getByRole("button").last().click();
    await page.waitForTimeout(500);
  }
};

const send = async (text) => {
  const input = page.locator('input[placeholder="Type a message…"]');
  await input.fill(text);
  await input.press("Enter");
  await page.waitForTimeout(3000);
};

await page.goto(`${BASE}/menu/all`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await openChat();
const threadId = await page.evaluate(() =>
  localStorage.getItem("cold-stone-chat-thread"),
);
console.log("thread created:", threadId);
await send("Hello, is anyone there?");
const firstThreadStillUsed = await page.evaluate(() =>
  localStorage.getItem("cold-stone-chat-thread"),
);
console.log("same thread after first send:", firstThreadStillUsed === threadId);

// Cookies cleared, localStorage survives — the exact reported state.
await context.clearCookies();
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await openChat();
await send("Hello again after clearing cookies");

const state = await page.evaluate(() => {
  const thread = localStorage.getItem("cold-stone-chat-thread");
  const text =
    document.querySelector("[role=dialog], .fixed")?.textContent || "";
  return {
    thread,
    showsAnotherUser: /belongs to another/i.test(document.body.innerText),
    showsError: /could not be sent/i.test(document.body.innerText),
    messageVisible: /Hello again after clearing cookies/.test(
      document.body.innerText,
    ),
    text: document.body.innerText.slice(-400),
  };
});
console.log("new thread started:", state.thread !== threadId);
console.log("shows 'belongs to another':", state.showsAnotherUser);
console.log("shows send error         :", state.showsError);
console.log("sent message visible     :", state.messageVisible);

const api = await page.evaluate(async () => {
  const threadId = localStorage.getItem("cold-stone-chat-thread");
  const response = await fetch(`/api/chat/messages/${threadId}`);
  return {
    status: response.status,
    body: (await response.text()).slice(0, 200),
  };
});
console.log("thread readable via API  :", JSON.stringify(api));

await browser.close();
