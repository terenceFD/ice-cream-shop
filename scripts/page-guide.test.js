import { isLostPageQuestion, suggestReply } from "../server/chat-assistant.js";

// Lost-page detection
const yes = [
  "what page is this",
  "What Page am I on?",
  "where am I",
  "how do I use this page",
  "je suis perdu",
  "c'est quelle page",
];
const no = [
  "how much is vanilla",
  "are you open",
  "where is your branch in Douala",
];
for (const text of yes) {
  if (!isLostPageQuestion(text)) {
    console.error("FAIL should match:", text);
    process.exit(1);
  }
}
for (const text of no) {
  if (isLostPageQuestion(text)) {
    console.error("FAIL should NOT match:", text);
    process.exit(1);
  }
}

// Rules-engine fallback reply for a lost customer on the cart page
const fakeDb = {
  prepare: () => ({
    all: async () => [],
    get: async () => undefined,
    run: async () => {},
  }),
};
const history = [{ sender: "customer", body: "what page is this?" }];
const result = await suggestReply(history, {
  database: fakeDb,
  language: "en",
  customerPage: "/cart",
});
console.log("rules reply:", result.suggestion, "| topic:", result.topic);
if (!result.suggestion.includes("cart page")) {
  console.error("FAIL: expected the cart guide in the reply");
  process.exit(1);
}

// Unknown page falls back to the neutral wording
const r2 = await suggestReply([{ sender: "customer", body: "where am i" }], {
  database: fakeDb,
  language: "en",
  customerPage: "/admin/reports",
});
console.log("unknown-page reply:", r2.suggestion);
if (!r2.suggestion.includes("Cold Stone Creamery website")) {
  console.error("FAIL: expected neutral wording");
  process.exit(1);
}

// Page snapshot is accepted and threaded through (the AI path is skipped without a
// key, so we only assert that suggestReply does not crash and the rules engine
// still answers with the page guide when a snapshot is present)
const r3 = await suggestReply(
  [{ sender: "customer", body: "what page is this?" }],
  {
    database: fakeDb,
    language: "en",
    customerPage: "/menu/all",
    pageSnapshot:
      "Title: All Menu\nHeading: Every flavour on one page\nButtons/links: Add to cart, Filters, Search\nVisible text: Vanilla Bean 2500 FCFA",
  },
);
console.log("snapshot reply:", r3.suggestion, "| topic:", r3.topic);
if (!r3.suggestion.includes("all-menu page")) {
  console.error("FAIL: expected the all-menu guide in the reply");
  process.exit(1);
}

// Server accepts the new field end-to-end shape (validates index.js wiring by import)
// Server side: verify the wiring exists by source check (importing index.js would
// boot the whole server).
import { readFileSync } from "node:fs";
const serverSource = readFileSync(
  new URL("../server/index.js", import.meta.url),
  "utf8",
);
if (!serverSource.includes("pageSnapshot")) {
  console.error("FAIL: index.js does not read pageSnapshot");
  process.exit(1);
}
const widgetSource = readFileSync(
  new URL("../src/components/LiveChatWidget.tsx", import.meta.url),
  "utf8",
);
if (!widgetSource.includes("capturePageSnapshot")) {
  console.error("FAIL: widget does not capture a snapshot");
  process.exit(1);
}

console.log("ALL OK");
