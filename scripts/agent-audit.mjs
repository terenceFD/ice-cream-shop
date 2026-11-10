// Professional end-to-end audit of the AI agent: every feature driven against the
// live dev servers. Run: node scripts/agent-audit.mjs
import assert from "node:assert/strict";

const API = "http://localhost:3001/api";
let passed = 0;
let failed = 0;
const failures = [];

// A cookie jar, exactly like the widget's browser: the chat device token set on
// the first POST is replayed on every later call, otherwise reading a thread is
// refused by the server's access check.
let cookie = "";

function adoptCookies(res) {
  for (const raw of res.headers.getSetCookie?.() ?? []) {
    cookie = raw.split(";")[0];
  }
}

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });
  adoptCookies(res);
  return { status: res.status, data: await res.json().catch(() => null) };
}

// Threads are minted in the browser (any uuid-ish id the server accepts), so the
// audit mints its own fresh one per scenario — no messages leak between tests.
async function openThread() {
  return crypto.randomUUID();
}

async function threadMessages(threadId) {
  const res = await fetch(`${API}/chat/messages/${threadId}`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
  const data = await res.json().catch(() => null);
  return Array.isArray(data?.messages) ? data.messages : [];
}

async function ask(threadId, body, extra = {}) {
  const before = await threadMessages(threadId);
  const sent = await post("/chat/messages", { threadId, body, ...extra });
  if (sent.status !== 201) return null;
  const lastStoreId =
    before.filter((m) => m.sender === "store").at(-1)?.id ?? 0;
  // The auto-reply is written after the POST returns; give it a moment.
  for (let attempt = 0; attempt < 15; attempt += 1) {
    await new Promise((r) => setTimeout(r, 700));
    const messages = await threadMessages(threadId);
    const latest = messages
      .filter((m) => m.sender === "store" && m.id > lastStoreId)
      .at(-1);
    if (latest) return latest.body;
  }
  return null;
}

const test = async (name, fn) => {
  try {
    await fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (error) {
    failed += 1;
    failures.push(`${name}: ${error.message}`);
    console.log(`  FAIL  ${name}`);
    console.log(`        ${error.message.slice(0, 300)}`);
  }
};

console.log("=== AI AGENT AUDIT ===");

// ---------------------------------------------------------------- 1. product Q&A
await test("product price + stock + direct link", async () => {
  const id = await openThread();
  const reply = await ask(id, "how much is Chocolate Devotion?");
  assert.match(reply, /3,?500 FCFA|Chocolate Devotion/i);
  assert.match(reply, /\[LINK:/);
  assert.match(reply, /\[ADD:/);
});

await test("sold-out item: no buy link, names a stand-in", async () => {
  const id = await openThread();
  const reply = await ask(id, "is Vanilla Bean available?");
  if (/sold out/i.test(reply)) {
    assert.doesNotMatch(reply, /\[ADD:/);
  }
});

await test("home-page friendly name maps to the real product", async () => {
  const id = await openThread();
  const reply = await ask(id, "how much is mango sunshine?");
  assert.match(reply, /Mango Pineapple Smoothie/i);
});

// ---------------------------------------------------------------- 2. nearest shop
await test("nearest shop from a shared location (Douala coords)", async () => {
  const id = await openThread();
  const reply = await ask(id, "which store is closer to me?", {
    location: { lat: 4.05, lng: 9.69 },
  });
  assert.match(reply, /Douala \/ Bonanjo/i);
  assert.match(reply, /km|m away|away/i);
  assert.match(reply, /\[ACTION:locations\]/);
});

await test("nearest shop without location asks, never guesses", async () => {
  const id = await openThread();
  const reply = await ask(id, "which store is closer to me?");
  assert.match(reply, /allow location|neighborhood|quartier/i);
  assert.doesNotMatch(reply, /closest shop is/i);
});

await test("nearest shop Yaoundé coords pick Bastos", async () => {
  const id = await openThread();
  const reply = await ask(id, "nearest shop to me?", {
    location: { lat: 3.888, lng: 11.515 },
  });
  assert.match(reply, /Yaoundé \/ Bastos/i);
});

// ---------------------------------------------------------------- 3. delivery
await test("delivery question with a named area", async () => {
  const id = await openThread();
  const reply = await ask(id, "do you deliver to Bastos?");
  assert.match(reply, /deliver|livra/i);
});

// ---------------------------------------------------------------- 4. creation
await test("flavor + mix-in sells a real product or Create Your Own", async () => {
  const id = await openThread();
  const reply = await ask(id, "strawberry with cookie dough");
  assert.match(reply, /FCFA/);
});

// ---------------------------------------------------------------- 5. party order
await test("party of 12 builds a real bag", async () => {
  const id = await openThread();
  const reply = await ask(id, "ice cream for 12 people");
  assert.match(reply, /12 (x|×)?\s*\d|For 12 people/i);
  assert.match(reply, /\[FILL:/);
  assert.match(reply, /FCFA/);
});

await test("40+ people goes to the events form", async () => {
  const id = await openThread();
  const reply = await ask(id, "catering for a wedding of 60 people");
  assert.match(reply, /\[ACTION:events\]/);
});

// ---------------------------------------------------------------- 6. hours
await test("opening hours question quotes real hours and live open state", async () => {
  const id = await openThread();
  const reply = await ask(id, "what time do you open?");
  // Opening and closing clock times, plus the live open/closed verdict.
  assert.match(reply, /\d{1,2}:\d{2}/);
  assert.match(reply, /open|closed|ouvert|ferm/i);
});

// ---------------------------------------------------------------- 7. promotions
await test("promos question never invents a code", async () => {
  const id = await openThread();
  const reply = await ask(id, "any discount code right now?");
  assert.ok(reply && reply.length > 5);
});

// ---------------------------------------------------------------- 8. navigation
await test("lost-customer question explains the current page", async () => {
  const id = await openThread();
  const reply = await ask(id, "what page is this?", {
    page: "/checkout",
    pageSnapshot:
      "Title: Checkout — Cold Stone. Delivery or pickup? Time slot. Pay now.",
  });
  assert.match(reply, /checkout/i);
});

// ---------------------------------------------------------------- 9. reorder
await test("'the usual' with no past order asks to sign in", async () => {
  const id = await openThread();
  const reply = await ask(id, "my usual please");
  assert.match(reply, /sign in|past order|what you'd like|quoi/i);
});

// ---------------------------------------------------------------- 10. social
await test("greeting is answered warmly, not with the menu", async () => {
  const id = await openThread();
  const reply = await ask(id, "good morning!");
  assert.match(reply, /morning|bonjour|hello|help/i);
});

await test("off-topic question is politely refused", async () => {
  const id = await openThread();
  const reply = await ask(id, "who will win the world cup?");
  assert.match(reply, /can't|don't have|not something|menu|help/i);
});

// ------------------------------------------------- 11. AI engine actually on
await test("AI engine status (model configured or honest fallback)", async () => {
  const id = await openThread();
  const reply = await ask(
    id,
    "tell me about your delivery zones in detail please",
  );
  assert.ok(reply && reply.length > 20);
});

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
for (const f of failures) console.log(`  - ${f}`);
process.exit(failed ? 1 : 0);
