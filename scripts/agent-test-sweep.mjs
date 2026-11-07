// Full live test sweep of the AI agent across all upgraded capabilities.
// Scenarios: product price (tool), unknown product (honest refusal), promos
// (live codes), delivery areas, order status, French reply, memory carry-over,
// handoff escalation, quiz recommendation, greeting tone, and the verify pass.
import "dotenv/config";
import Database from "better-sqlite3";
import { suggestReply, gatherShopFacts } from "../server/chat-assistant.js";

const sqlite = new Database("server/database.sqlite", { readonly: true });
const database = {
  prepare: (sql) => ({
    all: (...args) => sqlite.prepare(sql).all(...args),
    get: (...args) => sqlite.prepare(sql).get(...args),
    run: (...args) => sqlite.prepare(sql).run(...args),
  }),
};

const results = [];
async function ask(label, history, options = {}) {
  try {
    const result = await suggestReply(history, {
      database,
      language: options.language || "en",
      customerPage: options.customerPage || "",
      customerContext: options.customerContext || {},
      imageUrl: options.imageUrl || "",
    });
    results.push({
      label,
      source: result.source,
      topic: result.topic || null,
      confidence: result.confidence || null,
      needsAttention: result.needsAttention || false,
      aiFailure: result.aiFailure?.reason || null,
      reply: result.suggestion?.slice(0, 220) || "(nothing)",
    });
  } catch (error) {
    results.push({ label, error: error.message });
  }
}

// 1. Product price — tool call + verify pass
await ask("product price", [
  { sender: "customer", body: "How much is Chocolate Devotion?" },
]);

// 2. Unknown product — must refuse, never invent
await ask("unknown product", [
  { sender: "customer", body: "Do you sell pepperoni pizza?" },
]);

// 3. Promos — must reflect the actual discount table
await ask("promos", [
  { sender: "customer", body: "Any promo codes right now?" },
]);

// 4. Delivery area — must match a branch or admit it does not serve it
await ask("delivery Bonapriso", [
  { sender: "customer", body: "Do you deliver to Bonapriso?" },
]);

// 5. Order status — tool against a real order number (probe the DB for one)
const orderRow = sqlite
  .prepare("SELECT id FROM orders ORDER BY id DESC LIMIT 1")
  .get();
if (orderRow) {
  await ask("order status", [
    { sender: "customer", body: `Where is my order #${orderRow.id}?` },
  ]);
}

// 6. French — must reply in French
await ask("french price", [
  { sender: "customer", body: "C'est combien le Chocolate Devotion ?" },
]);

// 7. Memory — allergy stated first, question later in the same thread
await ask("memory allergy", [
  {
    sender: "customer",
    body: "Hi, I have a severe nut allergy, what should I avoid?",
  },
  {
    sender: "store",
    body: "I can help with that — anything without nuts is marked.",
  },
  { sender: "customer", body: "Is the Chocolate Devotion safe for me?" },
]);

// 8. Handoff — complaint must escalate
await ask("handoff complaint", [
  {
    sender: "customer",
    body: "My order arrived melted and I want a refund NOW. Terrible service.",
  },
]);

// 9. Quiz — undecided customer gets at most two questions then a recommendation
await ask("quiz undecided", [
  {
    sender: "customer",
    body: "I can't decide what to get, something refreshing maybe fruity",
  },
]);

// 10. Customer context — bag + order awareness
const customerRow = sqlite
  .prepare("SELECT id, name FROM customers LIMIT 1")
  .get();
if (customerRow) {
  await ask(
    "customer context",
    [{ sender: "customer", body: "What's in my bag right now?" }],
    {
      customerContext: {
        firstName: String(customerRow.name || "").split(/\s+/)[0],
        bag: [{ name: "Vanilla Bean", quantity: 2, price: 2800 }],
        lastOrder: {
          id: orderRow?.id || 1,
          status: "out_for_delivery",
          total: 5600,
          fulfillment: "delivery",
        },
      },
    },
  );
}

// Report
for (const entry of results) {
  console.log("=".repeat(70));
  console.log(
    `${entry.label}  [source: ${entry.source} | topic: ${entry.topic} | conf: ${entry.confidence} | attn: ${entry.needsAttention}${entry.aiFailure ? ` | FAIL: ${entry.aiFailure}` : ""}]`,
  );
  console.log(entry.reply.replaceAll("\n", " | "));
}
