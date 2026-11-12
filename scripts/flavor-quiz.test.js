// The "Find Your Flavor" quiz: allergens are a hard filter, taste only ranks.
import assert from "node:assert/strict";
import test from "node:test";
import {
  flavorConflicts,
  matchFlavors,
  noMatchReason,
  pickFlavor,
} from "../src/lib/flavorQuiz.ts";

const flavors = [
  {
    id: 1,
    name: "Very Vanilla",
    detail: "Classic vanilla",
    price: 2500,
    image: "",
    stock: 5,
    allergies: ["Dairy"],
  },
  {
    id: 2,
    name: "Strawberry Blush",
    detail: "Strawberry ice cream with berries",
    price: 2500,
    image: "",
    stock: 5,
    allergies: ["Dairy"],
  },
  {
    id: 3,
    name: "Chocolate Devotion",
    detail: "Chocolate ice cream with fudge brownie",
    price: 3000,
    image: "",
    stock: 5,
    allergies: ["Dairy", "Tree nuts"],
  },
  {
    id: 4,
    name: "Peanut Butter Cup",
    detail: "Chocolate ice cream with peanut butter",
    price: 3000,
    image: "",
    stock: 0,
    allergies: ["Dairy", "Peanuts"],
  },
];

test("a stated allergy removes the flavor even when it would win on taste", () => {
  const picked = pickFlavor(flavors, { taste: "chocolatey", avoid: ["nuts"] });
  // Chocolate Devotion is the chocolatey match, but it lists tree nuts.
  assert.notEqual(picked?.id, 3);
  // The peanut-butter flavor is sold out too, so the plain ones remain.
  assert.equal(picked?.id, 1);
});

test("sold-out flavors are never offered", () => {
  const picked = pickFlavor(flavors, { taste: "chocolatey", avoid: [] });
  assert.equal(picked?.id, 3);
});

test("taste ranks the matches, and ties keep the catalog order", () => {
  const fruity = matchFlavors(flavors, { taste: "fruity", avoid: [] });
  assert.equal(fruity[0].id, 2);
  const either = matchFlavors(flavors, { taste: "either", avoid: [] });
  assert.deepEqual(
    either.map((flavor) => flavor.id),
    [1, 2, 3],
  );
});

test("the catalog list wins over the description text", () => {
  const recorded = {
    id: 9,
    name: "Plain",
    price: 1,
    image: "",
    allergies: ["Dairy"],
  };
  assert.equal(flavorConflicts(recorded, ["nuts"]), false);
  const unrecorded = {
    id: 10,
    name: "Almond Dream",
    price: 1,
    image: "",
    allergies: [],
  };
  assert.equal(flavorConflicts(unrecorded, ["nuts"]), true);
});

test('"None common" is not read as an allergen', () => {
  const flavor = {
    id: 11,
    name: "Sorbet",
    price: 1,
    image: "",
    allergies: ["None common"],
  };
  assert.equal(flavorConflicts(flavor, ["dairy", "nuts", "gluten"]), false);
});

test("the empty state blames allergies only when an allergy was stated", () => {
  const dairyOnly = flavors.filter((flavor) =>
    flavor.allergies.includes("Dairy"),
  );
  assert.equal(noMatchReason(dairyOnly, ["dairy"]), "allergens");
  assert.equal(noMatchReason(dairyOnly, []), "empty");
  assert.equal(noMatchReason([], []), "empty");
  assert.equal(
    noMatchReason(
      flavors.filter((flavor) => flavor.stock === 0),
      [],
    ),
    "stock",
  );
});
