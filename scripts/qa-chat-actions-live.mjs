// End-to-end QA of the chat agent's new action loop: send real messages to the
// running dev server, then poll the thread for the auto-reply and check the
// action tags it carries.
const BASE = "http://localhost:3001";
const deviceCookie = `chat_device=${crypto.randomUUID().replace(/-/g, "")}`;

async function chat(body, extra = {}) {
  const threadId = crypto.randomUUID().replace(/-/g, "");
  const res = await fetch(`${BASE}/api/chat/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: deviceCookie },
    body: JSON.stringify({
      threadId,
      body,
      page: "/menu",
      bag: extra.bag ?? [
        {
          name: "Mango Pineapple Smoothie",
          quantity: 2,
          price: 3000,
          itemType: "menu",
          id: "menu:smoothies:mango-pineapple-smoothie",
        },
      ],
      ...extra,
    }),
  });
  if (!res.ok) return { status: res.status, error: await res.text() };
  // The AI reply is written a beat later; poll the thread for it.
  const cookie = res.headers.get("set-cookie") || deviceCookie;
  let store = null;
  for (let attempt = 0; attempt < 12 && !store; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const thread = await fetch(`${BASE}/api/chat/messages/${threadId}`, {
      headers: { Cookie: cookie.split(";")[0] || cookie },
    });
    if (!thread.ok) continue;
    const data = await thread.json();
    store = (data.messages || []).find((m) => m.sender === "store");
  }
  return {
    status: res.status,
    reply: store?.body || "(no store reply after 18s)",
  };
}

const questions = [
  "take off the mango",
  "make it two",
  "empty the bag",
  "pickup at Bonanjo Saturday at 4",
  "use the weekend code",
  "how many points do I have?",
  "no nuts for me",
  "how much is the Chocolate Devotion?",
];

for (const q of questions) {
  const r = await chat(q);
  console.log(`\n=== ${q} (HTTP ${r.status})`);
  console.log(r.reply || r.error);
}
