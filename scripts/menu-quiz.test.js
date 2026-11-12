// The menu quiz: allergens are a hard filter, kind and crowd only rank, and the
// catalog it ranks includes everything the live menu returns.
import assert from "node:assert/strict";
import test from "node:test";
import {
  menuItemConflicts,
  menuKindOf,
  menuNoMatchReason,
  menuQuizCatalog,
  matchMenuItems,
  pickMenuItem,
} from "../src/lib/menuQuiz.ts";
import { coldStoneMenuCategories } from "../shared/data.js";

const item = (overrides) => ({
  id: overrides.name,
  category: "Ice Cream",
  allergens: ["Dairy"],
  inStock: true,
  serves: "one",
  price: 3500,
  image: "",
  ...overrides,
});

const items = [
  item({
    name: "Chocolate Devotion",
    detail: "Chocolate Ice Cream with brownie and fudge.",
  }),
  item({ name: "Milkshake 1", detail: "Vanilla ice cream blended with milk." }),
  item({
    name: "Caramel Nut Nirvana Cake",
    category: "Cakes & Pies",
    serves: "many",
  }),
  item({
    name: "Reese’s Ice Cream Cups",
    detail: "Chocolate cups with peanut butter ice cream.",
    allergens: ["Dairy", "Peanuts"],
  }),
  item({ name: "Sold Out Sundae", inStock: false }),
];

test("every built-in menu item is a candidate", () => {
  const catalog = menuQuizCatalog(coldStoneMenuCategories);
  const expected = coldStoneMenuCategories.reduce(
    (sum, category) => sum + category.items.length,
    0,
  );
  assert.equal(catalog.length, expected);
  assert.ok(catalog.length > 60);
});

test("kinds come from the words, not just the category", () => {
  assert.equal(
    menuKindOf({ name: "Oh Fudge! Shake", category: "Ice Cream" }),
    "sip",
  );
  assert.equal(
    menuKindOf({ name: "Happy Birthday Cake", category: "Cakes & Pies" }),
    "share",
  );
  assert.equal(
    menuKindOf({
      name: "Cake Batter Sprinkle Sandwich",
      category: "Novelties",
    }),
    "grab",
  );
  assert.equal(
    menuKindOf({ name: "Chocolate Devotion", category: "Ice Cream" }),
    "scoop",
  );
});

test("a stated allergy is never recommended", () => {
  const picked = pickMenuItem(items, {
    kind: "scoop",
    crowd: "any",
    avoid: ["peanuts"],
  });
  assert.notEqual(picked?.name, "Reese’s Ice Cream Cups");
});

test("sold-out items are never offered", () => {
  const names = matchMenuItems(items, {
    kind: "scoop",
    crowd: "any",
    avoid: [],
  }).map((entry) => entry.name);
  assert.ok(!names.includes("Sold Out Sundae"));
});

test("the kind and the crowd decide the order", () => {
  const sip = pickMenuItem(items, { kind: "sip", crowd: "any", avoid: [] });
  assert.equal(sip?.name, "Milkshake 1");
  const party = pickMenuItem(items, {
    kind: "share",
    crowd: "share",
    avoid: [],
  });
  assert.equal(party?.name, "Caramel Nut Nirvana Cake");
});

test("an almond listing is caught by the nuts filter and vice versa", () => {
  assert.equal(
    menuItemConflicts(item({ allergens: ["Almonds"] }), ["nuts"]),
    true,
  );
  assert.equal(
    menuItemConflicts(item({ allergens: ["Tree nuts"] }), ["nuts"]),
    true,
  );
  assert.equal(
    menuItemConflicts(item({ allergens: ["Dairy"] }), ["nuts"]),
    false,
  );
});

test("unrecorded allergens are not assumed to conflict", () => {
  assert.equal(menuItemConflicts(item({ allergens: [] }), ["dairy"]), false);
  assert.equal(
    menuItemConflicts(item({ allergens: ["None common"] }), ["dairy"]),
    false,
  );
});

test("the empty state blames allergies only when one was stated", () => {
  const dairy = [item({ name: "Milk", allergens: ["Dairy"] })];
  assert.equal(menuNoMatchReason(dairy, ["dairy"]), "allergens");
  assert.equal(menuNoMatchReason(dairy, []), "empty");
  assert.equal(menuNoMatchReason([], []), "empty");
  assert.equal(
    menuNoMatchReason(
      items.filter((entry) => !entry.inStock),
      [],
    ),
    "stock",
  );
});

test("sold-out flags and recorded allergens come from the live item", () => {
  const catalog = menuQuizCatalog([
    {
      title: "Ice Cream",
      items: [
        {
          id: "menu:x:a",
          name: "Chocolate Devotion",
          priceXaf: 3500,
          isAvailable: false,
          availableQuantity: 0,
          allergens: ["Dairy", "Peanuts"],
        },
        {
          id: "menu:x:b",
          name: "Very Vanilla",
          priceXaf: 3000,
          isAvailable: true,
          availableQuantity: 4,
          allergens: [],
        },
      ],
    },
  ]);
  assert.equal(catalog[0].inStock, false);
  assert.equal(catalog[0].price, 3500);
  assert.deepEqual(catalog[0].allergens, ["Dairy", "Peanuts"]);
  assert.equal(catalog[1].inStock, true);
  // No recorded allergens: the built-in Ice Cream category floor stands in.
  assert.deepEqual(catalog[1].allergens, ["Dairy", "Soy"]);
});
