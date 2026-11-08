import test from "node:test";
import assert from "node:assert/strict";
import { closestHash, differenceHashBits, hammingDistance } from "./image-match.js";
import { applyAllergyGuard, describeBagQuote, quoteBag, statedAllergies } from "./chat-offer.js";
import { createToolExecutor, ensureProductLink } from "./chat-tools.js";

test("difference hash and closest match trust a near copy and reject a distant one", () => {
  const pixels = [];
  for (let index = 0; index < 72; index += 1) pixels.push(index % 2 === 0 ? 200 : 40);
  const hash = differenceHashBits(pixels);
  assert.equal(hash.length, 64);
  assert.equal(hammingDistance(hash, hash), 0);
  const near = `${hash.slice(0, 60)}0000`;
  const far = hash.split("").map((bit) => (bit === "1" ? "0" : "1")).join("");
  const hit = closestHash(hash, [
    { name: "near", hash: near },
    { name: "far", hash: far },
  ]);
  assert.equal(hit.name, "near");
  assert.equal(hit.confident, true);
  assert.equal(closestHash(hash, [{ name: "far", hash: far }]).confident, false);
});

test("a bag quote applies Buy 2 Get 1 on scoops and then the best code", () => {
  const quote = quoteBag(
    [
      { name: "A", quantity: 1, price: 1000, itemType: "flavor" },
      { name: "B", quantity: 1, price: 2000, itemType: "flavor" },
      { name: "C", quantity: 1, price: 3000, itemType: "flavor" },
    ],
    [{ code: "TEN", type: "percent", value: 10, minimum: 0 }],
  );
  assert.equal(quote.subtotal, 6000);
  assert.equal(quote.bogo, 1000);
  assert.equal(quote.codeOff, 600);
  assert.equal(quote.total, 4400);
});

test("a bag with nothing discounted is just the total", () => {
  const text = describeBagQuote(
    [{ name: "Cake", quantity: 1, price: 3500, itemType: "menu" }],
    [],
  );
  assert.equal(text, "Your bag is 3,500 FCFA, before delivery.");
  assert.doesNotMatch(text, /no code|takes off 0|free scoop/i);
});

test("a bag quote names only the discounts that save money", () => {
  const text = describeBagQuote(
    [
      { name: "A", quantity: 1, price: 1000, itemType: "flavor" },
      { name: "B", quantity: 1, price: 2000, itemType: "flavor" },
      { name: "C", quantity: 1, price: 3000, itemType: "flavor" },
    ],
    [{ code: "TEN", type: "percent", value: 10, minimum: 0 }],
  );
  assert.match(text, /6,000 FCFA/);
  assert.match(text, /Buy 2 Get 1 Free takes off 1,000 FCFA/);
  assert.match(text, /TEN takes off 600 FCFA/);
  assert.match(text, /4,400 FCFA before delivery/);
});

test("Buy 2 Get 1 does not discount menu lines", () => {
  const quote = quoteBag(
    [{ name: "Cake", quantity: 3, price: 1000, itemType: "menu" }],
    [],
  );
  assert.equal(quote.bogo, 0);
  assert.equal(quote.total, 3000);
});

test("a stated allergy strips the buy link and the add button", () => {
  const facts = {
    menuByCategory: {
      "Ice Cream": [
        {
          name: "Peanut Butter",
          allergens: "peanuts",
          path: "/menu?category=Ice+Cream&item=Peanut+Butter",
        },
      ],
    },
  };
  const reply = applyAllergyGuard(
    "Peanut Butter is in stock.\n[LINK:/menu?category=Ice+Cream&item=Peanut+Butter]\n[ADD:menu:ice-cream:peanut-butter]",
    { historyText: "I am allergic to peanuts", facts },
  );
  assert.deepEqual(statedAllergies("I am allergic to peanuts").map((item) => item.label), ["peanuts"]);
  assert.deepEqual(statedAllergies("a milkshake please"), []);
  assert.doesNotMatch(reply, /\[LINK:/);
  assert.doesNotMatch(reply, /\[ADD:/);
  assert.match(reply, /peanuts/);
});

test("an in-stock answer ends with the product page and an add id", () => {
  const facts = {
    menuByCategory: {
      "Ice Cream": [
        {
          name: "Chocolate Devotion",
          soldOut: false,
          addId: "menu:ice-cream:chocolate-devotion",
          path: "/menu?category=Ice+Cream&item=Chocolate+Devotion",
        },
      ],
    },
  };
  const reply = ensureProductLink("Chocolate Devotion is available.", {
    message: "is chocolate devotion available",
    facts,
  });
  assert.match(reply, /\[LINK:\/menu\?category=Ice\+Cream&item=Chocolate\+Devotion\]/);
  assert.match(reply, /\[ADD:menu:ice-cream:chocolate-devotion\]/);
});

test("a confident photo match supplies the product even when the reply never names it", () => {
  const reply = ensureProductLink("I can see the photo.", {
    message: "is this available",
    imageAttached: true,
    facts: {},
    matched: {
      confident: true,
      name: "Chocolate Devotion",
      soldOut: false,
      path: "/menu?category=Ice+Cream&item=Chocolate+Devotion",
      addId: "menu:ice-cream:chocolate-devotion",
    },
  });
  assert.match(reply, /Chocolate Devotion is in stock/);
  assert.doesNotMatch(reply, /This photo matches|I can see the photo/);
  assert.match(reply, /\[LINK:/);
  assert.match(reply, /\[ADD:menu:ice-cream:chocolate-devotion\]/);
});

test("a photo price question does not keep the menu dump", () => {
  const reply = ensureProductLink(
    "Your bag: 3,500 FCFA before savings, no code applies. 88 flavours and treats on the menu. Tell me which one you are eyeing.",
    {
      message: "how much is this product",
      imageAttached: true,
      facts: {},
      matched: {
        confident: true,
        name: "Strawberry Passion",
        price: 3500,
        soldOut: false,
        path: "/menu?category=Cakes+%26+Pies&item=Strawberry+Passion",
        addId: "menu:cakes-pies:strawberry-passion",
      },
    },
  );
  assert.equal(
    reply.split("[LINK:")[0].trim(),
    "Strawberry Passion is 3,500 FCFA, and it's in stock.",
  );
  assert.doesNotMatch(reply, /88 flavours|no code applies|before savings/);
});

test("a photo reply that shortens the product name still opens that product", () => {
  const reply = ensureProductLink("That cup is The Cat in the Hat.", {
    message: "",
    imageAttached: true,
    facts: {
      menuByCategory: {
        "Limited-Time Favorites": [
          {
            name: "The Cat in the Hat’s Cotton Candy Catastrophe",
            price: 3800,
            soldOut: false,
            path: "/menu?category=Limited-Time+Favorites&item=cat",
            addId: "menu:limited-time-favorites:the-cat-in-the-hats-cotton-candy-catastrophe",
          },
          {
            name: "Chocolate Devotion",
            price: 3500,
            soldOut: false,
            path: "/menu?category=Ice+Cream&item=Chocolate+Devotion",
            addId: "menu:ice-cream:chocolate-devotion",
          },
        ],
      },
    },
  });
  assert.match(reply, /\[ADD:menu:limited-time-favorites:the-cat-in-the-hats-cotton-candy-catastrophe\]/);
  assert.doesNotMatch(reply, /chocolate-devotion/);
});

test("a photo reply that already links the product still gets add to bag", () => {
  const reply = ensureProductLink(
    "That cup is The Cat in the Hat.\n[LINK:/menu?category=Limited-Time+Favorites&item=cat]",
    {
      message: "",
      imageAttached: true,
      facts: {
        menuByCategory: {
          "Limited-Time Favorites": [
            {
              name: "The Cat in the Hat’s Cotton Candy Catastrophe",
              price: 3800,
              soldOut: false,
              path: "/menu?category=Limited-Time+Favorites&item=cat",
              addId: "menu:limited-time-favorites:the-cat-in-the-hats-cotton-candy-catastrophe",
            },
          ],
        },
      },
    },
  );
  assert.equal((reply.match(/\[LINK:/g) || []).length, 1);
  assert.match(reply, /\[ADD:menu:limited-time-favorites:the-cat-in-the-hats-cotton-candy-catastrophe\]/);
});

test("delivery info quotes the named branch fee", async () => {
  const execute = createToolExecutor(
    { prepare: () => ({ all: async () => [], get: async () => null }) },
    {
      branchDetails: [
        {
          town: "Douala",
          area: "Bonapriso",
          address: "Rue Njo-Njo",
          deliveryFee: 1500,
          deliveryEnabled: true,
        },
      ],
    },
  );
  const result = await execute("get_delivery_info", { area: "Bonapriso" });
  assert.match(result, /Bonapriso/);
  assert.match(result, /1,500 FCFA/);
});
