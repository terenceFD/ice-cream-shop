// Asks the real AI model a product-detail question exactly as the chat endpoint would,
// to check the model answers about the product on screen instead of staying silent.
import "dotenv/config";
import {
  buildSystemPrompt,
  gatherShopFacts,
} from "../server/chat-assistant.js";

const history = [
  { sender: "customer", body: "Tell me briefly about this product" },
];
const pageSnapshot = `Title: Berry Berry Berry Good — Cold Stone Creamery
Heading: Berry Berry Berry Good
Sections: Ice Cream, Allergen information, Reviews
Buttons/links: Add to cart, Add to favorites, Share, 4.8 (24 reviews)
Form fields: Quantity
Visible text: Berry Berry Berry Good 4500 FCFA — Vanilla ice cream loaded with blueberries, raspberries and strawberry pieces swirled with chocolate chips and fudge. Contains milk. Signature Creation.`;

const facts = await gatherShopFacts({
  prepare: () => ({ all: async () => [], get: async () => undefined }),
});
const prompt = buildSystemPrompt(
  facts,
  "en",
  "/menu?category=Ice%20Cream&item=Berry%20Berry%20Berry%20Good",
  pageSnapshot,
);

const response = await fetch(
  `${(process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL,
      temperature: 0.8,
      max_completion_tokens: 2400,
      messages: [
        { role: "system", content: prompt },
        ...history.map((m) => ({ role: "user", content: m.body })),
      ],
    }),
  },
);
const data = await response.json();
console.log("HTTP", response.status);
console.log(
  data.choices?.[0]?.message?.content || JSON.stringify(data).slice(0, 400),
);
