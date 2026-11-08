// Bag totals, stated allergies, and one branch's delivery fee.
//
// These stay deterministic so a model cannot invent a discount, offer a product
// the customer already said they cannot eat, or answer "yes we deliver" without
// the fee for the branch they named.

const ALLERGENS = [
  { label: "peanuts", pattern: /\b(peanuts?|arachides?)\b/i },
  { label: "nuts", pattern: /\b(tree nuts?|nuts|noix|almonds?|amandes?|cashews?|pecans?|pistachios?|pistaches?)\b/i },
  { label: "dairy", pattern: /\b(dairy|milk|lactose|lait)\b/i },
  { label: "gluten", pattern: /\b(gluten|wheat|ble|blé)\b/i },
  { label: "eggs", pattern: /\b(eggs?|oeufs?|œufs?)\b/i },
  { label: "soy", pattern: /\b(soy|soja)\b/i },
];

function money(amount) {
  return `${new Intl.NumberFormat("en-CM").format(Math.round(amount))} FCFA`;
}

/**
 * Same arithmetic as checkout: Buy 2 Get 1 Free on scoops (the cheapest scoop),
 * then one discount code on top. Codes do not stack with each other. The code
 * that saves the most and meets its item minimum is the one quoted.
 */
export function quoteBag(items = [], discounts = []) {
  const lines = items.filter((item) => item && item.quantity > 0 && item.price >= 0);
  const subtotal = lines.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const scoops = lines.filter((item) => item.itemType !== "menu");
  const scoopCount = scoops.reduce((sum, item) => sum + item.quantity, 0);
  let freeScoops = Math.floor(scoopCount / 3);
  let bogo = 0;
  for (const item of [...scoops].sort((a, b) => a.price - b.price)) {
    const free = Math.min(freeScoops, item.quantity);
    freeScoops -= free;
    bogo += free * item.price;
  }
  freeScoops = Math.floor(scoopCount / 3);
  const itemCount = lines.reduce((sum, item) => sum + item.quantity, 0);
  let code = "";
  let codeOff = 0;
  for (const discount of discounts) {
    if (!discount?.code || itemCount < Number(discount.minimum || 0)) continue;
    const off = discount.type === "percent"
      ? Math.floor(subtotal * Number(discount.value) / 100)
      : Math.min(subtotal, Number(discount.value) || 0);
    if (off > codeOff) {
      codeOff = off;
      code = discount.code;
    }
  }
  const discount = Math.min(subtotal, bogo + codeOff);
  return {
    subtotal,
    freeScoops,
    bogo,
    code,
    codeOff,
    total: subtotal - discount,
  };
}

export function describeBagQuote(items, discounts, language = "en") {
  if (!items?.length) return "";
  const quote = quoteBag(items, discounts);
  const fr = language === "fr";
  const total = money(quote.total);
  if (!quote.bogo && !quote.codeOff) {
    return fr
      ? `Votre panier est à ${total}, avant la livraison.`
      : `Your bag is ${total}, before delivery.`;
  }
  const savings = [];
  if (quote.bogo) {
    savings.push(fr
      ? `l'offre 2 achetées, 1 offerte retire ${money(quote.bogo)}`
      : `Buy 2 Get 1 Free takes off ${money(quote.bogo)}`);
  }
  if (quote.codeOff) {
    savings.push(fr
      ? `le code ${quote.code} retire ${money(quote.codeOff)}`
      : `${quote.code} takes off ${money(quote.codeOff)}`);
  }
  const saving = savings.join(fr ? " et " : ", and ");
  const lead = fr ? saving.charAt(0).toUpperCase() + saving.slice(1) : saving.charAt(0).toUpperCase() + saving.slice(1);
  return fr
    ? `Votre panier est à ${money(quote.subtotal)}. ${lead}, donc ${total} avant la livraison.`
    : `Your bag is ${money(quote.subtotal)}. ${lead}, so it comes to ${total} before delivery.`;
}

/** Allergy words the customer actually stated, not every food word in the chat. */
export function statedAllergies(text) {
  const source = String(text || "");
  return ALLERGENS.filter((allergen) => {
    const framed = new RegExp(
      `(?:allerg(?:y|ic|ique)(?:\\s+to|\\s+aux?)?|intoleran(?:t|ce)(?:\\s+to)?|can(?:not|'t)\\s+(?:eat|have)|sans|without|no)\\s+(?:\\w+\\s+){0,1}${allergen.pattern.source}`,
      "i",
    );
    return framed.test(source);
  });
}

function allergyCatalog(facts) {
  const catalog = [];
  for (const [category, items] of Object.entries(facts.menuByCategory || {})) {
    for (const item of items || []) catalog.push({ ...item, category });
  }
  for (const flavor of facts.flavors || []) catalog.push(flavor);
  return catalog;
}

function sameProductPath(left, right) {
  try {
    const a = new URL(left, "https://shop.local");
    const b = new URL(right, "https://shop.local");
    if (a.pathname !== b.pathname) return false;
    if (a.pathname.startsWith("/flavor/")) return true;
    return a.searchParams.get("category") === b.searchParams.get("category")
      && a.searchParams.get("item") === b.searchParams.get("item");
  } catch {
    return false;
  }
}

export function productConflicts(product, allergies) {
  if (!product || !allergies?.length) return "";
  const haystack = `${product.name || ""} ${product.detail || ""} ${product.allergens || ""}`;
  const hit = allergies.find((allergen) => allergen.pattern.test(haystack));
  if (hit) return hit.label;
  // "Peanut butter" is a peanut product even though the word "peanut" is not in
  // the nuts pattern itself: the nuts list carries the tree nuts, and a
  // peanut-allergic or nut-allergic customer must never be offered either.
  if (allergies.some((allergen) => allergen.label === "peanuts" || allergen.label === "nuts")
    && /\b(peanut|arachide)\b/i.test(haystack)) {
    return "peanuts";
  }
  return "";
}

/**
 * Drop the buy link and the add button when the product conflicts with an
 * allergy already stated in the thread, and say why.
 */
export function applyAllergyGuard(reply, { historyText = "", facts = {}, language = "en" } = {}) {
  const text = String(reply || "").trim();
  if (!text) return text;
  const allergies = statedAllergies(historyText);
  if (!allergies.length) return text;
  if (/\[FILL:/i.test(text)) {
    const catalog = allergyCatalog(facts);
    const conflicts = catalog.filter((item) =>
      item.name && text.toLowerCase().includes(String(item.name).toLowerCase()) && productConflicts(item, allergies),
    );
    if (!conflicts.length) return text;
    const stripped = text.replace(/\s*\[FILL:[^\]]+\]/gi, "").trim();
    const sentence = language === "fr"
      ? `${conflicts.map((item) => item.name).join(", ")} ne passe pas avec ce que vous ne pouvez pas manger, donc je ne l'ajoute pas.`
      : `${conflicts.map((item) => item.name).join(", ")} conflicts with something you said you can't eat, so I won't add it.`;
    return stripped.includes(sentence) ? stripped : `${stripped} ${sentence}`.trim();
  }
  const catalog = allergyCatalog(facts);
  const named = catalog
    .filter((item) => item.name && text.toLowerCase().includes(String(item.name).toLowerCase()))
    .sort((a, b) => b.name.length - a.name.length)[0];
  const link = text.match(/\[LINK:(\/[^\]]+)\]/);
  const linked = link
    ? catalog.find((item) => item.path && sameProductPath(item.path, link[1]))
    : null;
  const product = named || linked;
  const conflict = productConflicts(product, allergies);
  if (!conflict) return text;
  const stripped = text
    .replace(/\s*\[LINK:\/[^\]]+\]/gi, "")
    .replace(/\s*\[ADD:[^\]]+\]/gi, "")
    .trim();
  const sentence = language === "fr"
    ? `${product.name} contient ${conflict}, et vous avez dit ne pas pouvoir en manger, donc je ne l'ajoute pas et je ne vous envoie pas l'acheter.`
    : `${product.name} contains ${conflict}, and you said you can't have that, so I won't add it or send you to buy it.`;
  return stripped.includes(sentence) ? stripped : `${stripped} ${sentence}`.trim();
}

export function describeBranch(branch, language = "en") {
  if (!branch) return "";
  const place = `${branch.town} / ${branch.area}`;
  if (branch.deliveryEnabled === false) {
    return language === "fr"
      ? `${place} ne livre pas. Le retrait y est gratuit. Le stock est le même pour toutes les boutiques.`
      : `${place} does not deliver. Pickup there is free. Stock is one shared count for every branch.`;
  }
  if (Number.isInteger(branch.deliveryFee)) {
    return language === "fr"
      ? `${place} : livraison ${money(branch.deliveryFee)}, retrait gratuit. Le stock est le même pour toutes les boutiques.`
      : `${place}: delivery ${money(branch.deliveryFee)}, pickup free. Stock is one shared count for every branch.`;
  }
  return language === "fr"
    ? `${place} est une de nos boutiques. Les frais de livraison s'affichent au checkout. Le retrait est gratuit.`
    : `${place} is one of our branches. The delivery fee is shown at checkout. Pickup is free.`;
}
