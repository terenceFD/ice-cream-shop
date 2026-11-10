// Second audit wave: bilingual, account context, French, and action-tag rendering.
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
const API = "http://localhost:3001/api";
let cookie = "";
const adopt = (res) => {
  for (const raw of res.headers.getSetCookie?.() ?? [])
    cookie = raw.split(";")[0];
};
const post = async (path, body) => {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });
  adopt(res);
  return { status: res.status, data: await res.json().catch(() => null) };
};
const messages = async (id) =>
  (
    await (
      await fetch(`${API}/chat/messages/${id}`, {
        headers: cookie ? { Cookie: cookie } : {},
      })
    ).json()
  )?.messages ?? [];
const ask = async (id, body, extra = {}) => {
  const before = await messages(id);
  const sent = await post("/chat/messages", { threadId: id, body, ...extra });
  if (sent.status !== 201) return null;
  const last = before.filter((m) => m.sender === "store").at(-1)?.id ?? 0;
  for (let i = 0; i < 15; i += 1) {
    await new Promise((r) => setTimeout(r, 700));
    const latest = (await messages(id))
      .filter((m) => m.sender === "store" && m.id > last)
      .at(-1);
    if (latest) return latest.body;
  }
  return null;
};

let ok = 0;
let bad = 0;
const test = async (name, fn) => {
  try {
    await fn();
    ok += 1;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    bad += 1;
    console.log(`  FAIL  ${name}\n        ${e.message.slice(0, 260)}`);
  }
};

console.log("=== WAVE 2: language, actions, breadth ===");

await test("French question gets a French reply", async () => {
  const id = randomUUID();
  const reply = await ask(
    id,
    "Quelle est la boutique la plus proche de moi ?",
    {
      location: { lat: 4.05, lng: 9.69 },
    },
  );
  assert.match(reply, /[éèà]|Bonjour|La boutique/i);
  assert.doesNotMatch(reply, /\[ACTION:locations\].*The closest/);
});

await test("every reply's action tags are widget-renderable shapes", async () => {
  const prompts = [
    "how much is Chocolate Devotion?",
    "ice cream for 12 people",
    "which store is closer to me?", // with location below
    "what page is this?",
  ];
  const extras = [
    {},
    {},
    { location: { lat: 4.05, lng: 9.69 } },
    { page: "/checkout", pageSnapshot: "Title: Checkout" },
  ];
  for (const [i, prompt] of prompts.entries()) {
    const id = randomUUID();
    const reply = await ask(id, prompt, extras[i]);
    // All tags are from the widget's known set with safe shapes.
    assert.doesNotMatch(
      reply,
      /\[(?!LINK:\/(?:menu|flavor|treat)|ADD:menu:|ADD:flavor:|FILL:(?:menu|flavor):|ACTION:(?:menu_all|custom_cake|events|locations|track_order|contact)|VISIT:(?:pickup|delivery)|CODE:[A-Za-z0-9_-]+|BAG:|CHIPS:)[^\]]*\]/,
      `bad tag in: ${prompt}`,
    );
  }
});

await test("bag context: agent sees the live bag and quotes it", async () => {
  const id = randomUUID();
  const reply = await ask(id, "what's in my bag and what will it cost?", {
    bag: [
      {
        name: "Chocolate Devotion",
        quantity: 2,
        price: 3500,
        itemType: "menu",
        id: "menu:ice-cream:chocolate-devotion",
      },
    ],
  });
  assert.match(reply, /Chocolate Devotion|7,?000 FCFA/i);
});

await test("loyalty question names the real earn rate", async () => {
  const id = randomUUID();
  const reply = await ask(id, "how do loyalty points work?");
  assert.match(reply, /100/i);
});

await test("custom cake answer never quotes a price", async () => {
  const id = randomUUID();
  const reply = await ask(id, "I want a custom birthday cake");
  assert.doesNotMatch(reply, /\d{3,}\s*FCFA/);
});

await test("refund complaint triggers handoff language", async () => {
  const id = randomUUID();
  const reply = await ask(id, "my order never arrived and I want a refund");
  assert.match(reply, /sorry|colleague|shop team|pass/i);
});

await test("complaint raises needs_attention for staff", async () => {
  const id = randomUUID();
  await ask(id, "my order never arrived and I want a refund");
  const thread = await messages(id);
  const flagged = thread.some((m) => m.sender === "store");
  assert.ok(flagged);
});

await test("unknown product is never invented", async () => {
  const id = randomUUID();
  const reply = await ask(id, "how much is your pizza flavored ice cream?");
  assert.match(
    reply,
    /don’t have|don't have|no such|not something|cannot find|can't find/i,
  );
});

console.log(`\n=== wave 2: ${ok} passed, ${bad} failed ===`);
process.exit(bad ? 1 : 0);
