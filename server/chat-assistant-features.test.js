// Binds the new agent capabilities to mechanisms: handoff detection (#10), the
// customer context (#3, #5), the quiz guidance (#8) and the report facts (#9).
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSystemPrompt,
  gatherCustomerContext,
  needsHumanHandoff,
} from "./chat-assistant.js";

const baseContext = {
  hours: { open: "09:00", close: "21:00", lastOrder: "20:30" },
  now: { weekday: "Mon", clock: "14:00", isOpen: true },
  stores: [],
  branchDetails: [],
  discounts: [],
  sitePages: [],
  siteBehaviour: [],
  sitePolicies: [],
  flavorFamilies: ["Classics", "Fruity", "Chocolate"],
  quizGuidance:
    "FIND YOUR FLAVOR QUIZ: when a customer asks for a recommendation, run a SHORT quiz — at most two questions.",
  menuByCategory: {},
};

// ------------------------------------------------------------------ handoff (#10)

test("money and dispute words raise the handoff signal", () => {
  assert.equal(
    needsHumanHandoff([{ sender: "customer", body: "I want a refund" }]),
    true,
  );
  assert.equal(
    needsHumanHandoff([
      { sender: "customer", body: "you charged me twice, this is a scam" },
    ]),
    true,
  );
  assert.equal(
    needsHumanHandoff([{ sender: "customer", body: "my order never arrived" }]),
    true,
  );
  assert.equal(
    needsHumanHandoff([
      { sender: "customer", body: "the ice cream arrived melted" },
    ]),
    true,
  );
  assert.equal(
    needsHumanHandoff([{ sender: "customer", body: "remboursement svp" }]),
    true,
  );
  assert.equal(
    needsHumanHandoff([
      { sender: "customer", body: "je parle à un vrai humain maintenant" },
    ]),
    true,
  );
});

test("ordinary questions do not raise the handoff signal", () => {
  for (const body of [
    "how much is vanilla",
    "do you deliver to Bonapriso",
    "what flavors do you have",
    "merci",
  ]) {
    assert.equal(
      needsHumanHandoff([{ sender: "customer", body }]),
      false,
      `"${body}" must NOT escalate`,
    );
  }
});

test("the same question asked three times escalates even without keywords", () => {
  const history = [
    { sender: "customer", body: "how much is the mango flavor exactly" },
    { sender: "store", body: "The menu is on the site!" },
    { sender: "customer", body: "how much is the mango flavor exactly" },
    { sender: "store", body: "Prices are in the facts." },
    {
      sender: "customer",
      body: "please, how much is the mango flavor exactly",
    },
  ];
  assert.equal(needsHumanHandoff(history), true);
});

test("two messages are not enough to count as repeated confusion", () => {
  const history = [
    { sender: "customer", body: "how much is the mango flavor" },
    { sender: "store", body: "The menu is on the site!" },
    { sender: "customer", body: "how much is the mango flavor" },
  ];
  assert.equal(needsHumanHandoff(history), false);
});

// ---------------------------------------------------- customer context (#3, #5)

test("the customer context is empty for guests", async () => {
  assert.deepEqual(await gatherCustomerContext(fakeDb(), null), {});
});

test("the customer context carries the bag and the latest order", async () => {
  const db = fakeDb({
    all: async () => [{ name: "Vanilla Bean", quantity: 2, unitPrice: 2800 }],
    get: async () => ({
      id: 12,
      status: "out_for_delivery",
      total: 5600,
      fulfillment: "delivery",
    }),
  });
  const context = await gatherCustomerContext(db, 7);
  assert.deepEqual(context.bag, [
    { name: "Vanilla Bean", quantity: 2, price: 2800 },
  ]);
  assert.deepEqual(context.lastOrder, {
    id: 12,
    status: "out_for_delivery",
    total: 5600,
    fulfillment: "delivery",
  });
});

test("a failing cart query must not lose the order", async () => {
  const db = fakeDb({
    all: async () => {
      throw new Error("no cart table");
    },
    get: async () => ({
      id: 12,
      status: "delivered",
      total: 9000,
      fulfillment: "pickup",
    }),
  });
  const context = await gatherCustomerContext(db, 7);
  assert.equal(context.bag, undefined);
  assert.equal(context.lastOrder.id, 12);
});

// ---------------------------------------------------------------- prompt wiring

test("the prompt carries the customer's name, bag and order when present", () => {
  const text = buildSystemPrompt(
    {
      ...baseContext,
      customerContext: {
        firstName: "Agnes",
        bag: [{ name: "Vanilla Bean", quantity: 2, price: 2800 }],
        lastOrder: {
          id: 12,
          status: "out_for_delivery",
          total: 5600,
          fulfillment: "delivery",
        },
      },
    },
    "en",
    "",
    "",
  );
  assert.match(text, /first name is Agnes/);
  assert.match(text, /2× Vanilla Bean/);
  assert.match(text, /THE CUSTOMER'S MOST RECENT ORDER: #12/);
  assert.match(text, /out_for_delivery/);
});

test("the prompt stays guest-clean when no context is given", () => {
  const text = buildSystemPrompt(baseContext, "en", "", "");
  assert.doesNotMatch(text, /THE CUSTOMER IN FRONT OF YOU/);
});

test("the prompt carries the flavor quiz guidance and families", () => {
  const text = buildSystemPrompt(baseContext, "en", "", "");
  assert.match(text, /FIND YOUR FLAVOR QUIZ/i);
  assert.match(text, /at most two questions/i);
  assert.match(text, /Classics, Fruity, Chocolate/);
});

test("the prompt keeps the handoff rule", () => {
  const text = buildSystemPrompt(baseContext, "en", "", "");
  assert.match(text, /HANDOFF — when a person is needed/i);
  assert.match(text, /bringing in a colleague/i);
});

// ------------------------------------------------------------------------ fake db

function fakeDb(overrides = {}) {
  return {
    prepare: () => ({
      all: overrides.all || (async () => []),
      get: overrides.get || (async () => undefined),
      run: async () => {},
    }),
  };
}
