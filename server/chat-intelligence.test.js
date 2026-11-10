// Binds the intelligence upgrades to mechanisms: retrieval (#1), tools (#2),
// verification (#4), routing (#5/#9) and memory (#6).
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildChunks,
  retrieveChunks,
  tokenize,
  scoreChunk,
} from "./retrieval.js";
import {
  createToolExecutor,
  ensureProductLink,
  findProduct,
  toolDefinitions,
  toolNames,
  runToolCalls,
} from "./chat-tools.js";
import {
  buildMemorySummary,
  buildSystemPrompt,
  suggestReply,
} from "./chat-assistant.js";

// ------------------------------------------------------------------- retrieval (#1)

test("tokenize strips accents, punctuation and stop words", () => {
  assert.deepEqual(tokenize("Crème Brûlée, how MUCH is it?"), [
    "creme",
    "brulee",
  ]);
});

test("an exact product-name question retrieves that product first", () => {
  const chunks = buildChunks({
    menu: [
      {
        name: "Chocolate Devotion",
        category: "Ice Cream",
        detail: "rich chocolate",
        price: 3200,
      },
      {
        name: "Vanilla Bean",
        category: "Ice Cream",
        detail: "classic",
        price: 2800,
      },
    ],
    policies: ["LOYALTY: 1 point per 100 FCFA spent."],
  });
  const results = retrieveChunks(chunks, "How much is Chocolate Devotion?");
  assert.ok(results.length >= 1);
  assert.equal(results[0].title, "Chocolate Devotion");
});

test("a policy question retrieves the policy paragraph", () => {
  const chunks = buildChunks({
    menu: [
      { name: "Vanilla Bean", category: "Ice Cream", detail: "", price: 2800 },
    ],
    policies: [
      "LOYALTY: 1 point per 100 FCFA spent, and 100 points = 1,000 FCFA off.",
    ],
  });
  const results = retrieveChunks(chunks, "how do loyalty points work");
  assert.ok(results.some((chunk) => chunk.title === "LOYALTY"));
});

test("an unrelated message retrieves nothing (falls back to static facts)", () => {
  const chunks = buildChunks({
    menu: [
      { name: "Vanilla Bean", category: "Ice Cream", detail: "", price: 2800 },
    ],
  });
  assert.deepEqual(retrieveChunks(chunks, "ok"), []);
});

test("scoreChunk weighs a title hit far above a body mention", () => {
  const chunk = {
    source: "product",
    title: "Mango Tango",
    text: "Mango Tango with real mango.",
    keywords: tokenize("Mango Tango with real mango"),
  };
  const titleHit = scoreChunk(chunk, tokenize("mango tango"));
  const bodyOnly = scoreChunk(chunk, tokenize("real with"));
  assert.ok(titleHit > bodyOnly * 2);
});

// ---------------------------------------------------------------------- tools (#2)

test("the tool catalogue exposes the live-data tools", () => {
  assert.deepEqual(toolNames(), [
    "get_product",
    "get_active_promos",
    "get_delivery_info",
    "get_nearest_store",
    "get_order_status",
  ]);
  for (const tool of toolDefinitions()) {
    assert.equal(tool.type, "function");
    assert.ok(tool.function.name);
  }
});

const shopFacts = {
  menuByCategory: {
    "Ice Cream": [
      {
        name: "Chocolate Devotion",
        price: 3200,
        detail: "rich",
        tags: "-",
        soldOut: false,
      },
      {
        name: "Vanilla Bean",
        price: 2800,
        detail: "classic",
        tags: "veg",
        soldOut: true,
      },
    ],
  },
  branchDetails: [
    { town: "Douala", area: "Bonapriso", address: "Rue Njo-Njo", phone: "677" },
    { town: "Yaoundé", area: "Bastos", address: "Rue", phone: "" },
  ],
};

test("generic words like 'ice cream' never fabricate a product match", () => {
  // "pizza flavored ice cream" names a product that does not exist. Matching on
  // the generic words quoted a real product's price for the fantasy item.
  assert.equal(findProduct(shopFacts, "pizza flavored ice cream"), null);
  assert.equal(findProduct(shopFacts, "burger ice cream"), null);
  // The real product is still found by its own words.
  assert.equal(findProduct(shopFacts, "chocolate devotion")?.name, "Chocolate Devotion");
});

test("get_product answers price and stock from the facts, with a fuzzy name", async () => {
  const execute = createToolExecutor(fakeDb(), shopFacts);
  const result = await execute("get_product", { name: "chocolate devotion" });
  assert.match(result, /Chocolate Devotion/);
  assert.match(result, /3,200 FCFA/);
  assert.match(result, /in stock/);
});

test("get_product reports sold-out state", async () => {
  const execute = createToolExecutor(fakeDb(), shopFacts);
  const result = await execute("get_product", { name: "vanilla" });
  assert.match(result, /Vanilla Bean/);
  assert.match(result, /SOLD OUT/);
});

test("get_product refuses to invent an unknown product", async () => {
  const execute = createToolExecutor(fakeDb(), shopFacts);
  const result = await execute("get_product", { name: "pizza" });
  assert.match(result, /No product/i);
  assert.match(result, /Do not invent/i);
});

test("get_product returns the product page, not the menu", async () => {
  const execute = createToolExecutor(fakeDb(), shopFacts);
  const result = await execute("get_product", { name: "chocolate devotion" });
  assert.match(result, /Direct link: \/menu\?category=Ice\+Cream&item=Chocolate\+Devotion/);
  assert.match(result, /\[LINK:\/menu\?category=Ice\+Cream&item=Chocolate\+Devotion\]/);
  assert.match(result, /Do not send them to \/menu or \/menu\/all/);
});

test("an in-stock photo answer gets that product's link and drops the menu button", () => {
  const reply = ensureProductLink(
    "Yes, Chocolate Devotion is available, 3,200 FCFA.\n[ACTION:menu_all]",
    { message: "is this available", imageAttached: true, facts: shopFacts },
  );
  assert.match(reply, /\[LINK:\/menu\?category=Ice\+Cream&item=Chocolate\+Devotion\]/);
  assert.doesNotMatch(reply, /menu_all/);
});

test("a sold-out product does not get a buy link", () => {
  const reply = ensureProductLink("Vanilla Bean is sold out right now.", {
    message: "is this available",
    imageAttached: true,
    facts: shopFacts,
  });
  assert.equal(reply, "Vanilla Bean is sold out right now.");
});

test("get_nearest_store names the branch closest to the shared position", async () => {
  const execute = createToolExecutor(fakeDb(), {
    ...shopFacts,
    branchDetails: [
      { town: "Douala", area: "Bonanjo", address: "Centre Commercial L’Atrium" },
      { town: "Yaoundé", area: "Bastos", address: "STAR MALL" },
    ],
    customerLocation: { lat: 3.89, lng: 11.51 },
  });
  const result = await execute("get_nearest_store", {});
  assert.match(result, /Yaoundé \/ Bastos/);
  assert.match(result, /STAR MALL/);
  assert.doesNotMatch(result, /Bonanjo/);
});

test("get_nearest_store asks for a location instead of guessing a branch", async () => {
  const execute = createToolExecutor(fakeDb(), shopFacts);
  assert.match(await execute("get_nearest_store", {}), /location is not available/i);
});

test("get_delivery_info confirms a branch area and admits an unserved one", async () => {
  const execute = createToolExecutor(fakeDb(), shopFacts);
  const bonapriso = await execute("get_delivery_info", { area: "Bonapriso" });
  assert.match(bonapriso, /Bonapriso/);
  const nowhere = await execute("get_delivery_info", { area: "Lagos" });
  assert.match(nowhere, /do not have a branch/i);
});

test("get_active_promos reads live codes and refuses when none are active", async () => {
  const withCodes = fakeDb({
    all: async () => [
      { code: "SCOOP10", type: "percent", value: 10, minimum: 5000 },
    ],
  });
  const executeWith = createToolExecutor(withCodes, shopFacts);
  assert.match(await executeWith("get_active_promos", {}), /SCOOP10.*10% off/i);

  const withoutCodes = fakeDb({ all: async () => [] });
  const executeWithout = createToolExecutor(withoutCodes, shopFacts);
  assert.match(
    await executeWithout("get_active_promos", {}),
    /No active discount codes/i,
  );
});

test("get_order_status formats the live status and admits a missing order", async () => {
  const db = fakeDb({
    get: async () => ({
      id: 54,
      status: "out_for_delivery",
      total: 9500,
      fulfillment: "delivery",
    }),
  });
  const execute = createToolExecutor(db, shopFacts);
  const result = await execute("get_order_status", { orderNumber: "#54" });
  assert.match(result, /#54/);
  assert.match(result, /out for delivery right now/i);

  const empty = createToolExecutor(
    fakeDb({ get: async () => undefined }),
    shopFacts,
  );
  assert.match(
    await empty("get_order_status", { orderNumber: "999" }),
    /not found/i,
  );
});

test("a tool failure answers honestly instead of crashing", async () => {
  const execute = createToolExecutor(
    {
      prepare: () => ({
        all: async () => {
          throw new Error("boom");
        },
      }),
    },
    shopFacts,
  );
  const result = await execute("get_active_promos", {});
  assert.match(result, /lookup failed/i);
});

test("runToolCalls parses model tool calls and returns tool-role results", async () => {
  const execute = createToolExecutor(fakeDb(), shopFacts);
  const response = {
    choices: [
      {
        message: {
          tool_calls: [
            {
              id: "call_1",
              function: {
                name: "get_product",
                arguments: '{"name":"vanilla"}',
              },
            },
            {
              id: "call_2",
              function: { name: "get_product", arguments: "not-json" },
            },
          ],
        },
      },
    ],
  };
  const results = await runToolCalls(response, execute);
  assert.equal(results.length, 2);
  assert.equal(results[0].role, "tool");
  assert.equal(results[0].tool_call_id, "call_1");
  assert.match(results[0].content, /Vanilla Bean/);
  // The malformed-arguments call still answered (empty args → no match message).
  assert.match(results[1].content, /No product|not found/i);
});

test("runToolCalls returns nothing when the model asked for no tools", async () => {
  assert.deepEqual(
    await runToolCalls({ choices: [{ message: {} }] }, () => {}),
    [],
  );
  assert.deepEqual(await runToolCalls(null, () => {}), []);
});

// --------------------------------------------------------------------- memory (#6)

test("buildMemorySummary keeps the older customer lines and skips the recent tail", () => {
  const history = [
    {
      sender: "customer",
      body: "Hi, I am allergic to nuts. What do you have?",
    },
    { sender: "store", body: "Let me check for you!" },
    { sender: "customer", body: "Also I prefer chocolate flavors." },
    { sender: "customer", body: "and something refreshing" },
    { sender: "customer", body: "for a birthday" },
    { sender: "customer", body: "hello?" },
    { sender: "customer", body: "any suggestion for me" },
    { sender: "customer", body: "I want to order today" },
    { sender: "customer", body: "so what can I eat" },
    { sender: "customer", body: "please answer" },
  ];
  const summary = buildMemorySummary(history);
  assert.match(summary, /allergic to nuts/i);
  assert.match(summary, /chocolate/i);
  // The recent tail (last 6) must not be summarized — it travels verbatim.
  assert.doesNotMatch(summary, /please answer/);
});

test("buildMemorySummary is empty for threads with nothing outside the tail", () => {
  assert.equal(buildMemorySummary([{ sender: "customer", body: "hi" }]), "");
  assert.equal(buildMemorySummary([]), "");
});

// -------------------------------------------------------------- routing & prompt

test("the prompt carries the tools when the model cannot call them natively", () => {
  const text = buildSystemPrompt(baseContext(), "en", "", "", {
    retrieved: [
      {
        source: "product",
        title: "Mango Tango",
        text: "Mango Tango — 3200 FCFA.",
      },
    ],
    memorySummary: '- Customer said: "I am allergic to nuts"',
  });
  assert.match(text, /Mango Tango — 3200 FCFA/);
  assert.match(text, /CONVERSATION SO FAR/);
  assert.match(text, /allergic to nuts/);
});

test("the prompt stays unchanged in shape when nothing extra is given", () => {
  const text = buildSystemPrompt(baseContext(), "en", "", "");
  assert.doesNotMatch(text, /RETRIEVED DETAILS/);
  assert.doesNotMatch(text, /CONVERSATION SO FAR/);
});

// -------------------------------------------------------------------------- fakes

test("suggestReply reports not-configured cleanly when no key exists", async () => {
  const previousKey = process.env.AI_API_KEY;
  const previousModel = process.env.AI_MODEL;
  delete process.env.AI_API_KEY;
  delete process.env.AI_MODEL;
  try {
    const result = await suggestReply([{ sender: "customer", body: "hi" }], {
      database: fakeDb(),
      language: "en",
    });
    assert.equal(result.source, "rules");
    assert.equal(result.aiFailure.reason, "not-configured");
  } finally {
    if (previousKey !== undefined) process.env.AI_API_KEY = previousKey;
    if (previousModel !== undefined) process.env.AI_MODEL = previousModel;
  }
});

function baseContext() {
  return {
    hours: { open: "09:00", close: "21:00", lastOrder: "20:30" },
    now: { weekday: "Mon", clock: "14:00", isOpen: true },
    stores: [],
    branchDetails: [],
    discounts: [],
    sitePages: [],
    siteBehaviour: [],
    sitePolicies: [],
    flavorFamilies: ["Classics"],
    quizGuidance: "",
    menuByCategory: {},
  };
}

function fakeDb(overrides = {}) {
  return {
    prepare: () => ({
      all: overrides.all || (async () => []),
      get: overrides.get || (async () => undefined),
      run: async () => {},
    }),
  };
}
