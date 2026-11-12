import test from "node:test";
import assert from "node:assert/strict";
import {
  CHAT_PROGRESS_TTL_MS,
  clearChatProgress,
  progressLabelForTool,
  readChatProgress,
  setChatProgress,
} from "./chat-progress.js";
import { orderCardLine, productCardLine } from "./chat-tools.js";

/** The JSON body of a card tag, however the after-state suffix looks. */
const cardJson = (line) =>
  JSON.parse(
    line
      .trim()
      .replace(/^\[PRODUCT:/, "")
      .replace(/^\[ORDER:/, "")
      .replace(/\|(?:in|out)\]$/, "")
      .replace(/\]$/, ""),
  );

test("a stage is readable, then cleared the moment the reply lands", () => {
  const thread = "progress-thread-1";
  setChatProgress(thread, "thinking");
  assert.deepEqual(readChatProgress(thread), { stage: "thinking", label: "" });
  setChatProgress(thread, "lookup", "get_product");
  assert.equal(readChatProgress(thread).stage, "lookup");
  clearChatProgress(thread);
  assert.equal(readChatProgress(thread), null);
});

test("a stage expires on its own so a crashed reply never leaves it stuck", () => {
  const thread = "progress-thread-2";
  setChatProgress(thread, "writing");
  const later = Date.now() + CHAT_PROGRESS_TTL_MS + 1;
  assert.equal(readChatProgress(thread, later), null);
  // And it is gone for good, not merely hidden.
  assert.equal(readChatProgress(thread), null);
});

test("an unknown stage or a junk tool name is not trusted", () => {
  const thread = "progress-thread-3";
  setChatProgress(thread, "exploding");
  assert.equal(readChatProgress(thread).stage, "thinking");
  setChatProgress(thread, "lookup", "<script>");
  assert.equal(readChatProgress(thread).label, "");
  setChatProgress(thread, "lookup", "get_product");
  assert.equal(readChatProgress(thread).label, "get_product");
  clearChatProgress(thread);
});

test("a tool lookup is named in the customer's language of things", () => {
  assert.equal(
    progressLabelForTool("get_product", { name: "Chocolate Devotion" }),
    "Chocolate Devotion",
  );
  assert.equal(
    progressLabelForTool("get_delivery_info", { area: "Bastos" }),
    "Bastos",
  );
  assert.equal(
    progressLabelForTool("get_order_status", { orderNumber: "#54" }),
    "#54",
  );
  // A long name cannot flood the typing row, and a newline cannot break it.
  assert.equal(
    progressLabelForTool("get_product", { name: "x".repeat(200) }).length,
    48,
  );
  assert.equal(progressLabelForTool("get_product", { name: "a\nb" }), "a b");
  assert.equal(progressLabelForTool("get_active_promos", {}), "");
});

test("a product card carries only what the menu said, and parses back", () => {
  const line = productCardLine({
    name: "Chocolate Devotion",
    price: 4500,
    soldOut: false,
    path: "/menu?category=Ice%20Cream&item=Chocolate%20Devotion",
    image: "/menu-images/chocolate-devotion.webp",
    addId: "menu:ice-cream:chocolate-devotion",
  });
  // The tag starts its own line in the reply, which is what the parser matches.
  assert.match(line, /^\n\[PRODUCT:\{.*\}\|in\]$/);
  const card = cardJson(line);
  assert.equal(card.name, "Chocolate Devotion");
  assert.equal(card.price, 4500);
  assert.equal(card.soldOut, false);
  assert.equal(card.addId, "menu:ice-cream:chocolate-devotion");
});

test("a sold-out or unaddable product gets no add button on its card", () => {
  const soldOut = productCardLine({
    name: "Gone",
    price: 1000,
    soldOut: true,
    path: "/flavor/12",
    addId: "flavor:12",
  });
  assert.equal(cardJson(soldOut).addId, undefined);
  // A hand-typed id (shop-added cake) is not an id the bag can take.
  const custom = productCardLine({
    name: "Shop cake",
    price: 20000,
    soldOut: false,
    path: "/treat/cakes/birthday",
    addId: "menu:custom:shop-cake",
  });
  assert.equal(cardJson(custom).addId, undefined);
  // No path is not a card at all.
  assert.equal(productCardLine({ name: "x", price: 1, path: "" }), "");
});

test("an order card carries the live status and nothing invented", () => {
  const line = orderCardLine({
    id: 54,
    status: "out_for_delivery",
    fulfillment: "delivery",
    total: 12500,
  });
  // A bare tag: the prompt places it, unlike the product card's own line.
  assert.match(line, /^\[ORDER:\{.*\}\]$/);
  const card = cardJson(line);
  assert.deepEqual(card, {
    id: 54,
    status: "out_for_delivery",
    fulfillment: "delivery",
    total: 12500,
  });
  // An unknown status falls back to the first step rather than an empty timeline.
  const fallback = cardJson(
    orderCardLine({ id: 5, status: "teleported", total: 0 }),
  );
  assert.equal(fallback.status, "processing");
  assert.equal(fallback.fulfillment, "");
});

test("a rules reply adds no card it did not look up", async () => {
  // A card only ever comes from a live tool lookup. The rules engine answers from
  // the shop facts directly, so it must not invent one — the sentence and its
  // link still work, exactly as before.
  const previous = process.env.AI_API_KEY;
  delete process.env.AI_API_KEY;
  try {
    const { suggestReply } = await import("./chat-assistant.js");
    const fakeDb = {
      prepare: () => ({ get: () => undefined, all: async () => [] }),
    };
    const result = await suggestReply(
      [{ sender: "customer", body: "How much is the Chocolate Devotion?" }],
      { database: fakeDb },
    );
    const suggestion = String(result.suggestion || "");
    assert.match(suggestion, /Chocolate Devotion/);
    assert.match(suggestion, /\[LINK:\/[^\]]+\]/);
    assert.doesNotMatch(suggestion, /\[(?:PRODUCT|ORDER):/);
  } finally {
    if (previous !== undefined) process.env.AI_API_KEY = previous;
  }
});

test("the lookup's card is attached when the model forgets to copy it", async () => {
  const { attachCards } = await import("./chat-assistant.js");
  const card = "[PRODUCT:{\"name\":\"Chocolate Devotion\",\"price\":4500}]|in";
  const reply = "Chocolate Devotion is 4,500 FCFA.\n[LINK:/flavor/4]\n[ADD:flavor:4]";
  const withCard = attachCards(reply, [card]);
  // The card lands before the action tags, which stay last so the button works.
  assert.equal(
    withCard,
    "Chocolate Devotion is 4,500 FCFA.\n" + card + "\n[LINK:/flavor/4]\n[ADD:flavor:4]",
  );
  // A reply that already carries its card is not given a second one.
  assert.equal(attachCards(`${card}\n${reply}`, [card]), `${card}\n${reply}`);
  // Nothing to attach, or no tags to sit before: the text is untouched.
  assert.equal(attachCards(reply, []), reply);
  assert.equal(attachCards("Just a sentence.", [card]), "Just a sentence.\n" + card);
  // A malformed entry is not pasted into a customer-visible reply.
  assert.equal(attachCards(reply, ["not a card"]), reply);
});

test("a product photo is only ever a site path or a validated upload", async () => {
  const { catalogPhotoUrl, productPhotoLine } = await import("./chat-tools.js");
  // The catalog's own files are site paths.
  assert.equal(catalogPhotoUrl("/menu-official/ice-cream/x.webp"), "/menu-official/ice-cream/x.webp");
  assert.equal(catalogPhotoUrl("/cake-images/cake-1.webp"), "/cake-images/cake-1.webp");
  // Anything that could point the browser elsewhere is refused.
  for (const bad of [
    "https://evil.example/x.png",
    "//evil.example/x.png",
    "/../server/.env",
    "/x.png?width=1",
    "data:image/png;base64,AAAA",
    "javascript:alert(1)",
    "",
  ]) {
    assert.equal(catalogPhotoUrl(bad), "", `refused: ${bad}`);
  }
  // A product with a photo gets it; one without gets the fallback, never a dead path.
  const withPhoto = JSON.parse(
    productPhotoLine({ name: "Chocolate Devotion", image: "/menu-official/x.webp", path: "/flavor/4" })
      .trim()
      .replace("[PHOTO:", "")
      .replace(/\]$/, ""),
  );
  assert.equal(withPhoto.image, "/menu-official/x.webp");
  assert.equal(withPhoto.path, "/flavor/4");
  const without = JSON.parse(
    productPhotoLine({ name: "Mystery", image: "", path: "/flavor/9" }).trim().replace("[PHOTO:", "").replace(/\]$/, ""),
  );
  assert.equal(without.fallback, true);
  assert.equal(without.image, undefined);
  // A link the site would refuse is not carried on the photo either.
  assert.equal(
    JSON.parse(
      productPhotoLine({ name: "X", image: "", path: "//evil.example/x" }).trim().replace("[PHOTO:", "").replace(/\]$/, ""),
    ).path,
    undefined,
  );
});

test("asking to SEE a product answers with its picture, not a paragraph", async () => {
  const previous = process.env.AI_API_KEY;
  delete process.env.AI_API_KEY;
  try {
    const { suggestReply } = await import("./chat-assistant.js");
    const fakeDb = { prepare: () => ({ get: () => undefined, all: async () => [] }) };
    const asked = await suggestReply(
      [{ sender: "customer", body: "Show me a photo of the Chocolate Devotion please" }],
      { database: fakeDb },
    );
    const suggestion = String(asked.suggestion || "");
    assert.match(suggestion, /\[PHOTO:\{/);
    const photo = JSON.parse(suggestion.match(/\[PHOTO:(.+?)\]/)[1]);
    assert.equal(photo.name, "Chocolate Devotion");
    assert.match(photo.image, /^\//);

    // A price question is not a photo request: no picture rides along unasked.
    const priced = await suggestReply(
      [{ sender: "customer", body: "How much is the Chocolate Devotion?" }],
      { database: fakeDb },
    );
    assert.doesNotMatch(String(priced.suggestion || ""), /\[PHOTO:/);
  } finally {
    if (previous !== undefined) process.env.AI_API_KEY = previous;
  }
});

test("the prompt tells the assistant when an emoji is welcome, and when never", async () => {
  const { buildSystemPrompt, gatherShopFacts } = await import("./chat-assistant.js");
  const { database } = await import("./database.js");
  const prompt = buildSystemPrompt(await gatherShopFacts(database), "en", "/", "");
  // Welcome: social moments and recommendations.
  assert.match(prompt, /EMOJIS: use an emoji only when the moment asks for one/);
  assert.match(prompt, /greeting, a thank-you, a goodbye, a recommendation/);
  // Forbidden: a complaint, and an emoji carrying a fact.
  assert.match(prompt, /Never use an emoji when the customer reports a problem/);
  assert.match(prompt, /a price, a stock answer, a delivery time, a branch address/);
  assert.match(prompt, /Never use two in one reply and never open a reply with one/);
});

test("the fixed replies greet, thank and apologise with one fitting emoji", async () => {
  const { problemReply } = await import("./chat-assistant.js");
  const previous = process.env.AI_API_KEY;
  delete process.env.AI_API_KEY;
  try {
    const { suggestReply } = await import("./chat-assistant.js");
    const fakeDb = { prepare: () => ({ get: () => undefined, all: async () => [] }) };
    const reply = async (body, language) => {
      const result = await suggestReply([{ sender: "customer", body }], { database: fakeDb, language });
      return String(result.suggestion || "");
    };
    assert.match(await reply("hello"), /👋/);
    assert.match(await reply("bonjour", "fr"), /👋/);
    assert.match(await reply("thanks so much"), /😊/);
    assert.match(await reply("bye"), /👋/);
    // A complaint never smiles; its one emoji is a calm apology.
    const sorry = problemReply("my order never arrived");
    assert.match(sorry, /🙏/);
    assert.doesNotMatch(sorry, /😊|🎉|🍦/);
    // And a plain price answer stays free of decoration.
    assert.doesNotMatch(await reply("how much is the Chocolate Devotion?"), /\p{Extended_Pictographic}/u);
  } finally {
    if (previous !== undefined) process.env.AI_API_KEY = previous;
  }
});
