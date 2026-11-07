// Reproduce the full suggestReply pipeline for the failing price question,
// printing each stage: tool calls made, tool results, verify verdict, final text.
import "dotenv/config";
import { suggestReply } from "../server/chat-assistant.js";
import { gatherShopFacts } from "../server/chat-assistant.js";
import { getMenuItemId } from "../shared/data.js";

// Minimal DB stub over the real SQLite file so tools read live data.
import Database from "better-sqlite3";
const sqlite = new Database("server/database.sqlite", { readonly: true });
const database = {
  prepare: (sql) => ({
    all: (...args) => sqlite.prepare(sql).all(...args),
    get: (...args) => sqlite.prepare(sql).get(...args),
    run: (...args) => sqlite.prepare(sql).run(...args),
  }),
};

const history = [
  { sender: "customer", body: "How much is Chocolate Devotion?" },
];
const facts = await gatherShopFacts(database);
console.log(
  "menu snapshot has Chocolate Devotion:",
  Object.values(facts.menuByCategory)
    .flat()
    .some((i) => /devotion/i.test(i.name)),
);

const result = await suggestReply(history, {
  database,
  language: "en",
  customerPage: "/menu",
});
console.log("source:", result.source);
console.log("aiFailure:", JSON.stringify(result.aiFailure || null));
console.log("reply:", result.suggestion?.slice(0, 400));
