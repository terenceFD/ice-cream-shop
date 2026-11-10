// Reproduce the fantasy-product match on "pizza flavored ice cream".
import {
  findProduct,
  describeCreation,
  askedProduct,
} from "../server/chat-tools.js";

// The static catalog is enough: findProduct matches from menuByCategory.
const facts = {
  menuByCategory: {
    "Ice Cream": [{ name: "Pre-Packed Ice Cream", price: 3000, detail: "" }],
  },
  flavors: [],
};
for (const q of [
  "how much is your pizza flavored ice cream?",
  "pizza flavored ice cream",
  "how much is your burger flavored ice cream?",
]) {
  console.log(JSON.stringify(q));
  console.log("  findProduct:", findProduct(facts, q)?.name ?? "null");
  console.log("  askedProduct:", askedProduct(q, facts)?.name ?? "null");
  console.log(
    "  describeCreation:",
    describeCreation(q, facts) ? "HIT" : "null",
  );
}
