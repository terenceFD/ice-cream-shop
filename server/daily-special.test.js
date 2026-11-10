// Daily special: deterministic per day, only addable photographed items, and it
// appears in the prompt with its full action tags.
import test from "node:test";
import assert from "node:assert/strict";
import { dailySpecial } from "../shared/dailySpecial.js";
import { buildSystemPrompt } from "./chat-assistant.js";

test("dailySpecial rotates deterministically and skips unfit items", () => {
  const menuByCategory = {
    "Ice Cream": [
      {
        name: "Good One",
        price: 1000,
        soldOut: false,
        addId: "menu:a:b",
        path: "/menu?a=b",
        image: "/menu-official/a.webp",
      },
      {
        name: "Sold Out",
        price: 1000,
        soldOut: true,
        addId: "menu:s:x",
        path: "/menu?s=x",
        image: "/menu-official/s.webp",
      },
      {
        name: "No Photo",
        price: 1000,
        soldOut: false,
        addId: "menu:n:p",
        path: "/menu?n=p",
      },
    ],
  };
  const first = dailySpecial(menuByCategory);
  assert.equal(first.name, "Good One"); // the only fit candidate
  // Rotation actually varies by day seed.
  const seen = new Set();
  for (let offset = 0; offset < 40; offset += 1) {
    const withShift = {
      ...menuByCategory,
      "Ice Cream": [
        ...menuByCategory["Ice Cream"],
        {
          name: `V${offset}`,
          price: 100,
          soldOut: false,
          addId: `menu:v:${offset}`,
          path: "/menu?v=" + offset,
          image: "/menu-official/v.webp",
        },
      ],
    };
    seen.add(dailySpecial(withShift).name);
  }
  assert.ok(seen.size > 1);
});

test("empty catalog yields no special", () => {
  assert.equal(dailySpecial({}), null);
});

test("the prompt carries today's special with its action tags", () => {
  const context = {
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
    menuByCategory: {
      "Ice Cream": [
        {
          name: "Birthday Cake Remix",
          price: 3500,
          detail: "",
          tags: "-",
          soldOut: false,
          image: "/menu-official/x.webp",
          path: "/menu?a=b",
          addId: "menu:a:b",
        },
      ],
    },
    dailySpecial: {
      name: "Birthday Cake Remix",
      price: 3500,
      image: "/menu-official/x.webp",
      path: "/menu?a=b",
      addId: "menu:a:b",
    },
  };
  const prompt = buildSystemPrompt(context, "en", "", "");
  assert.match(prompt, /TODAY'S SPECIAL.*Birthday Cake Remix/s);
  assert.match(prompt, /\[IMG:\/menu-official\/x\.webp\]/);
  assert.match(prompt, /\[ADD:menu:a:b\]/);
});
