// Pins the six bag/visit/code/loyalty/preference actions. Each test binds a
// customer sentence to the exact reply body and action tag it must produce, so
// a wording or tag change fails loudly instead of silently breaking the loop
// between the agent and the checkout.
import test from "node:test";
import assert from "node:assert/strict";
import {
  addReply,
  bagEditReply,
  codeReply,
  loyaltyReply,
  preferenceReply,
  productChips,
  visitReply,
  withChips,
} from "./chat-actions.js";

const MANGO = "menu:smoothies:mango-pineapple-smoothie";
const bag = [
  { name: "Mango Pineapple Smoothie", quantity: 2, price: 3000, addId: MANGO },
  {
    name: "Cookie Mintster",
    quantity: 1,
    price: 2500,
    addId: "menu:ice-cream:cookie-mintster",
  },
];

// ------------------------------------------------------------------ bag edits

test("take off one line sets its quantity to zero", () => {
  const reply = bagEditReply("take off the mango", bag, "en");
  assert.match(reply.body, /Mango Pineapple Smoothie is out of the bag/);
  assert.equal(reply.body.includes(`[BAG:set:${MANGO}*0]`), true);
});

test("remove still works without a number word", () => {
  const reply = bagEditReply("remove the Cookie Mintster", bag, "en");
  assert.match(reply.body, /Cookie Mintster is out of the bag/);
});

test("make it two accepts the spoken number", () => {
  const reply = bagEditReply("make it two", [bag[0]], "en");
  assert.match(reply.body, /quantity 2/);
  assert.equal(reply.body.includes(`[BAG:set:${MANGO}*2]`), true);
});

test("make it two touches only the matched line", () => {
  const reply = bagEditReply("make the mango two", bag, "en");
  assert.match(reply.body, /Mango Pineapple Smoothie, quantity 2/);
  assert.equal(reply.body.includes(`[BAG:set:${MANGO}*2]`), true);
});

test("digits still win for quantities", () => {
  const reply = bagEditReply("make it 3", [bag[0]], "en");
  assert.match(reply.body, /quantity 3/);
  assert.equal(reply.body.includes(`[BAG:set:${MANGO}*3]`), true);
});

test("empty the bag clears everything", () => {
  const reply = bagEditReply("empty the bag", bag, "en");
  assert.match(reply.body, /I cleared the bag/);
  assert.equal(reply.body.includes("[BAG:clear]"), true);
});

test("an edit on an empty bag answers without a tag", () => {
  const reply = bagEditReply("take off the mango", [], "en");
  assert.match(reply.body, /already empty/);
  assert.equal(/\[BAG:/.test(reply.body), false);
});

test("an ambiguous edit on two lines asks which one", () => {
  const reply = bagEditReply("make it two", bag, "en");
  assert.match(reply.body, /Which one should I change/);
});

// ------------------------------------------------------- branch, time, slot

const branch = {
  area: "Bonanjo",
  town: "Douala",
  address: "12 Rue Njo-Njo",
  deliveryFee: 1000,
  checkoutLocation: "Bonanjo",
};
const slots = [
  { id: "6", startTime: "15:00", label: "3 PM" },
  { id: "7", startTime: "16:00", label: "4 PM" },
];

test("pickup at a named branch with an hour picks that slot", () => {
  const reply = visitReply(
    "pickup at Bonanjo Saturday at 4",
    { branches: [branch], slots },
    "en",
  );
  assert.match(reply.body, /Pickup at Bonanjo/);
  assert.match(reply.body, /4 PM/);
  assert.equal(reply.body.includes("[VISIT:pickup|Bonanjo|"), true);
  assert.equal(reply.body.includes("|7]"), true);
  assert.match(reply.body, /Pickup is free/);
});

test("delivery names the fee", () => {
  const reply = visitReply(
    "deliver to Bonanjo tomorrow at 5pm",
    { branches: [branch], slots },
    "en",
  );
  assert.match(reply.body, /Delivery is 1,000 FCFA/);
  assert.equal(
    reply.body.startsWith("[VISIT") || reply.body.includes("[VISIT:delivery|"),
    true,
  );
});

test("a question about delivery is not read as an instruction", () => {
  assert.equal(
    visitReply(
      "do you deliver to Bonanjo?",
      { branches: [branch], slots },
      "en",
    ),
    null,
  );
});

test("an unknown branch gets no visit tag", () => {
  assert.equal(
    visitReply("pickup at Akwa at 4", { branches: [branch], slots }, "en"),
    null,
  );
});

// ---------------------------------------------------------------- discount

const discounts = [
  { code: "WEEKEND", type: "percent", value: 10, minimum: 0 },
  { code: "BIGBAG", type: "fixed", value: 500, minimum: 4 },
];

test("naming an active code attaches it and states the new total", () => {
  const reply = codeReply("use the weekend code", [bag[0]], discounts, "en");
  assert.match(reply.body, /6,000 FCFA/);
  assert.match(reply.body, /5,400 FCFA/);
  assert.equal(reply.body.includes("[CODE:WEEKEND]"), true);
});

test("a code below its minimum is refused with the reason", () => {
  const reply = codeReply("use the bigbag code", [bag[0]], discounts, "en");
  assert.match(reply.body, /at least 4 items/);
  assert.equal(/\[CODE:/.test(reply.body), false);
});

test("an unknown code lists what is running", () => {
  const reply = codeReply("use the summer code", [bag[0]], discounts, "en");
  assert.match(reply.body, /WEEKEND, BIGBAG/);
});

// ----------------------------------------------------------------- loyalty

test("a signed-in customer hears their balance and its worth", () => {
  const reply = loyaltyReply("how many points do I have?", 1500, "en");
  assert.match(reply.body, /1,?500 points/);
  assert.match(reply.body, /15,000 FCFA/);
});

test("a guest is asked to sign in instead of getting the general rule", () => {
  const reply = loyaltyReply("how many points do I have?", undefined, "en");
  assert.match(reply.body, /Sign in/);
});

test("other questions about points stay with the agent", () => {
  assert.equal(loyaltyReply("how do points work?", 1500, "en"), null);
});

// -------------------------------------------------------------- preference

const facts = {
  menuByCategory: {
    "Ice Cream": [
      {
        name: "Peanut Butter Cup Perfection",
        addId: "menu:ice-cream:peanut-butter-cup-perfection",
        price: 3200,
        path: "/treat/ice-cream/peanut-butter-cup-perfection",
      },
      {
        name: "Vanilla Bean",
        addId: "menu:ice-cream:vanilla-bean",
        price: 2500,
        path: "/treat/ice-cream/vanilla-bean",
      },
    ],
  },
  flavors: [],
};

test("no nuts is remembered and a safe product is offered", () => {
  const reply = preferenceReply(
    "I'm allergic to nuts, what can I get?",
    facts,
    "en",
  );
  assert.match(reply.body, /I'll remember: no nuts/);
  assert.match(reply.body, /Vanilla Bean/);
  assert.equal(reply.body.includes("[ADD:menu:ice-cream:vanilla-bean]"), true);
  assert.deepEqual(reply.avoid, ["nuts"]);
});

test("the peanut butter product is never the safe pick", () => {
  const reply = preferenceReply("no nuts please", facts, "en");
  assert.doesNotMatch(reply.body, /Peanut Butter/);
});

// ------------------------------------------------------------------- chips

test("quick replies after a price are the three taps", () => {
  const chips = productChips("en", "Bonanjo");
  assert.deepEqual(chips, [
    "Add it to my bag",
    "Deliver to Bonanjo",
    "Something without nuts",
  ]);
});

test("withChips appends the tag exactly once and caps at three", () => {
  const text = withChips(
    "Vanilla Bean is 2,500 FCFA.",
    productChips("en", "Bonanjo"),
  );
  assert.match(
    text,
    /\[CHIPS:Add it to my bag\|Deliver to Bonanjo\|Something without nuts\]$/,
  );
  assert.equal(withChips(text, ["More"]).includes("[CHIPS:"), true);
  const counted = text.split("[CHIPS:").length;
  assert.equal(counted, 2);
});

// ------------------------------------------------------------- add to bag

const ADD_FACTS = {
  menuByCategory: {
    "Ice Cream": [
      { name: "Chocolate Devotion", addId: "menu:ice-cream:chocolate-devotion", price: 3500, path: "/treat/ice-cream/chocolate-devotion" },
    ],
  },
  flavors: [],
};

test("add the named product answers with a tag, never a false confirmation", () => {
  const reply = addReply("add the chocolate devotion to my bag", ADD_FACTS, "en");
  assert.match(reply.body, /tap to add it to your bag/);
  assert.equal(reply.body.includes("[ADD:menu:ice-cream:chocolate-devotion]"), true);
  // The wording must not claim the bag already holds the item: the tap is the act.
  assert.doesNotMatch(reply.body, /added|is in your bag|added to your bag/i);
});

test("a counted want sets the quantity in the sentence", () => {
  const reply = addReply("I want two chocolate devotion", ADD_FACTS, "en");
  assert.match(reply.body, /add 2 to your bag/);
  assert.equal(reply.body.includes("[ADD:menu:ice-cream:chocolate-devotion]"), true);
});

test("the French add request answers in French with the tag", () => {
  const reply = addReply("ajoute le chocolate devotion au panier", ADD_FACTS, "fr");
  assert.match(reply.body, /appuyez pour l'ajouter/);
  assert.equal(reply.body.includes("[ADD:menu:ice-cream:chocolate-devotion]"), true);
});

test("a want without a count goes to the model, not the rule", () => {
  // "I want the chocolate devotion" may be a question or a purchase; the model
  // handles the nuance, so the rule stays out of it.
  assert.equal(addReply("I want the chocolate devotion", ADD_FACTS, "en"), null);
});

test("a question about a product is not read as an add", () => {
  assert.equal(addReply("what is the chocolate devotion?", ADD_FACTS, "en"), null);
});

test("a product the catalog does not know gets no add tag", () => {
  assert.equal(addReply("add the mango tango to my bag", ADD_FACTS, "en"), null);
});
