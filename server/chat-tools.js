import { describeBranch } from "./chat-offer.js";

// Tool calling for the chat assistant (#2: answers from the live database).
//
// The prompt's shop facts are cached for a minute and capped at ~45 items, so a
// price read from the prompt can be stale or missing. Tools close that gap: the
// model may call a function before answering, and the answer comes straight from
// the database at the moment of asking. A wrong price becomes impossible as long
// as the model uses the tool — and the grounding rule ("use ONLY the facts") is
// checked by the shop facts the model is given.
//
// Each tool returns plain text for the conversation, never throws, and is
// read-only. Nothing here can place an order or change data.

/**
 * The tool catalogue, in OpenAI's function-calling shape. Exported so tests can
 * pin the set and prompt builders can list the names.
 */
export function toolDefinitions() {
  return [
    {
      type: "function",
      function: {
        name: "get_product",
        description:
          "Look up one menu product or flavor by name: its live price in FCFA, whether it is in stock, its description, dietary tags and allergens. Use this for ANY question about a specific product's price, availability or ingredients.",
        parameters: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description:
                "The product or flavor name, as the customer wrote it (e.g. 'chocolate devotion', 'mango')",
            },
            branch: {
              type: "string",
              description:
                "The branch or neighborhood the customer named, when they ask about a place (e.g. 'Bonanjo'). Omit when they did not name one.",
            },
          },
          required: ["name"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_active_promos",
        description:
          "List the discount codes active right now, with their amounts and minimum orders. Use this when the customer asks about promos, discounts or deals — never recite a code from memory.",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "get_delivery_info",
        description:
          "Check whether an area is served for delivery and what the fee is. Use this for 'do you deliver to X' questions.",
        parameters: {
          type: "object",
          properties: {
            area: {
              type: "string",
              description:
                "The neighborhood, area or city the customer named (e.g. 'Bonapriso', 'Bastos')",
            },
          },
          required: ["area"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_order_status",
        description:
          "Look up a customer's order status by order number. Use this when they give a number starting with # or ask where their order is.",
        parameters: {
          type: "object",
          properties: {
            orderNumber: {
              type: "string",
              description: "The order number with or without the # (e.g. '54')",
            },
          },
          required: ["orderNumber"],
        },
      },
    },
  ];
}

/** Names only, for prompt sections and tests. */
export function toolNames() {
  return toolDefinitions().map((tool) => tool.function.name);
}

// ---------------------------------------------------------------- implementations

/**
 * Every tool gets the open database handle and the shop facts (which carry the
 * menu snapshot and branch list). Results are strings ready to drop into the
 * conversation as a "tool" role message.
 */
export function createToolExecutor(database, shopFacts) {
  return async function executeTool(name, args) {
    try {
      switch (name) {
        case "get_product":
          return getProduct(shopFacts, args?.name, args?.branch);
        case "get_active_promos":
          return await getActivePromos(database);
        case "get_delivery_info":
          return getDeliveryInfo(shopFacts, args?.area);
        case "get_order_status":
          return await getOrderStatus(database, args?.orderNumber);
        default:
          return `Unknown tool ${name}.`;
      }
    } catch (error) {
      // A tool failure must read as an honest "I could not check" to the model,
      // not as a crash — it will answer from the static facts instead.
      console.error(`chat tool ${name} failed:`, error.message);
      return `The ${name} lookup failed. Answer from the facts you already have, or say you cannot check right now.`;
    }
  };
}

function formatMoney(amount) {
  return `${new Intl.NumberFormat("en-CM").format(Math.round(amount))} FCFA`;
}

/** The menu page opens one product when both category and item are in the query. */
export function menuItemPath(category, name) {
  return `/menu?${new URLSearchParams({
    category: String(category || ""),
    item: String(name || ""),
  }).toString()}`;
}

/** Scoop flavors each have their own page at /flavor/:id. */
export function flavorItemPath(id) {
  const numeric = String(id ?? "").replace(/\D/g, "");
  return numeric ? `/flavor/${numeric}` : "";
}

// Names printed on the home page, and the catalog product they sell.
const PRODUCT_ALIASES = [
  ["mango sunshine", "Mango Pineapple Smoothie"],
  ["soleil de mangue", "Mango Pineapple Smoothie"],
  ["strawberry daydream", "Our Strawberry Blonde"],
  ["chocolate crush", "Chocolate Devotion"],
  ["vanilla cloud", "Cookie Doughn't You Want Some"],
  ["peanut butter bliss", "Peanut Butter Cup Perfection"],
  ["dubai chocolate luxury", "Our Dubai Chocolate Creation"],
  ["berry berry joy", "Berry Berry Berry Good"],
  ["mint chip moment", "Cookie Mintster"],
];

function plainName(text) {
  return foldText(text).replace(/[^a-z0-9]+/g, " ").trim();
}

function aliasTarget(query) {
  const text = plainName(query);
  const hit = PRODUCT_ALIASES.find(([alias]) => text.includes(plainName(alias)));
  return hit ? hit[1] : "";
}

function scoreName(name, wanted, wantedWords) {
  if (name === wanted) return 100;
  if (name.includes(wanted) || wanted.includes(name)) return 60 + name.length;
  const nameWords = name.split(/\s+/);
  return (
    wantedWords.filter((word) =>
      nameWords.some((candidate) => candidate.startsWith(word) && word.length > 2),
    ).length * 12
  );
}

/**
 * Best match of a customer's words against the live menu and the scoop flavors.
 * The returned item always carries `path`, the page that opens that product.
 */
export function findProduct(shopFacts, query) {
  if (!query) return null;
  const named = aliasTarget(query) || query;
  const wanted = String(named)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();
  if (!wanted) return null;
  const wantedWords = wanted.split(/\s+/).filter(Boolean);
  let best = null;
  let bestScore = 0;
  const consider = (item, category, path) => {
    const score = scoreName(String(item.name || "").toLowerCase(), wanted, wantedWords);
    if (score > bestScore) {
      bestScore = score;
      best = { ...item, category, path: item.path || path };
    }
  };
  for (const category of Object.keys(shopFacts.menuByCategory || {})) {
    for (const item of shopFacts.menuByCategory[category] || []) {
      consider(item, category, menuItemPath(category, item.name));
    }
  }
  for (const flavor of shopFacts.flavors || []) {
    consider(flavor, flavor.tag || "Flavor", flavor.path || flavorItemPath(flavor.id));
  }
  return bestScore >= 12 ? best : null;
}

// Flavor and mix-in words the catalog actually uses. Longer phrases are listed first
// so "chocolate chips" is not also counted as plain chocolate.
const CREATION_INGREDIENTS = [
  { canonical: "cookie dough", roles: ["flavor", "mixin"], aliases: ["cookie dough", "pate a cookie", "pate cookie"] },
  { canonical: "chocolate chips", roles: ["mixin"], aliases: ["chocolate chips", "chocolate chip", "pepites de chocolat"] },
  { canonical: "peanut butter", roles: ["flavor", "mixin"], aliases: ["peanut butter", "beurre de cacahuete"] },
  { canonical: "whipped topping", roles: ["mixin"], aliases: ["whipped topping", "whipped cream", "chantilly"] },
  { canonical: "cake batter", roles: ["flavor"], aliases: ["cake batter"] },
  { canonical: "sweet cream", roles: ["flavor"], aliases: ["sweet cream"] },
  { canonical: "strawberry", roles: ["flavor"], aliases: ["strawberries", "strawberry", "fraises", "fraise"] },
  { canonical: "chocolate", roles: ["flavor"], aliases: ["chocolate", "chocolat"] },
  { canonical: "vanilla", roles: ["flavor"], aliases: ["vanilla", "vanille"] },
  { canonical: "cheesecake", roles: ["flavor"], aliases: ["cheesecake"] },
  { canonical: "pistachio", roles: ["flavor"], aliases: ["pistachio", "pistache"] },
  { canonical: "blueberry", roles: ["flavor"], aliases: ["blueberries", "blueberry", "myrtilles", "myrtille"] },
  { canonical: "raspberry", roles: ["flavor"], aliases: ["raspberries", "raspberry", "framboises", "framboise"] },
  { canonical: "banana", roles: ["flavor"], aliases: ["banana", "banane"] },
  { canonical: "mango", roles: ["flavor"], aliases: ["mango", "mangue"] },
  { canonical: "coffee", roles: ["flavor"], aliases: ["coffee", "cafe"] },
  { canonical: "mint", roles: ["flavor"], aliases: ["mint", "menthe"] },
  { canonical: "oreo", roles: ["mixin"], aliases: ["oreo"] },
  { canonical: "brownie", roles: ["mixin"], aliases: ["brownie"] },
  { canonical: "fudge", roles: ["mixin"], aliases: ["fudge"] },
  { canonical: "caramel", roles: ["mixin"], aliases: ["caramel"] },
  { canonical: "sprinkles", roles: ["mixin"], aliases: ["sprinkles", "sprinkle"] },
  { canonical: "graham", roles: ["mixin"], aliases: ["graham"] },
  { canonical: "pecan", roles: ["mixin"], aliases: ["pecans", "pecan"] },
  { canonical: "gummy", roles: ["mixin"], aliases: ["gummies", "gummy"] },
  { canonical: "marshmallow", roles: ["mixin"], aliases: ["marshmallows", "marshmallow"] },
  { canonical: "almond", roles: ["mixin"], aliases: ["almonds", "almond", "amandes", "amande"] },
];

const CREATION_LABEL_FR = {
  "cookie dough": "pâte à cookie",
  "chocolate chips": "pépites de chocolat",
  "peanut butter": "beurre de cacahuète",
  "whipped topping": "chantilly",
  "cake batter": "pâte à gâteau",
  "sweet cream": "crème douce",
  strawberry: "fraise",
  chocolate: "chocolat",
  vanilla: "vanille",
  cheesecake: "cheesecake",
  pistachio: "pistache",
  blueberry: "myrtille",
  raspberry: "framboise",
  banana: "banane",
  mango: "mangue",
  coffee: "café",
  mint: "menthe",
  oreo: "OREO",
  brownie: "brownie",
  fudge: "fudge",
  caramel: "caramel",
  sprinkles: "vermiculures",
  graham: "graham",
  pecan: "pécan",
  gummy: "bonbons gélifiés",
  marshmallow: "guimauve",
  almond: "amande",
};

function foldText(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function hasPhrase(text, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?:^|[^a-z0-9])(${escaped})(?=[^a-z0-9]|$)`, "g");
  for (const match of text.matchAll(pattern)) {
    const start = match.index + match[0].indexOf(match[1]);
    const longer = CREATION_INGREDIENTS.some((ingredient) =>
      ingredient.aliases.some((alias) => {
        if (alias.length <= phrase.length || !alias.startsWith(phrase)) return false;
        return text.startsWith(alias, start) && (start + alias.length === text.length || /[^a-z0-9]/.test(text[start + alias.length]));
      }),
    );
    if (!longer) return true;
  }
  return false;
}

function creationHits(message) {
  const text = foldText(message);
  const found = [];
  for (const ingredient of CREATION_INGREDIENTS) {
    for (const alias of ingredient.aliases) {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match = new RegExp(`(?:^|[^a-z0-9])(${escaped})(?:[^a-z0-9]|$)`).exec(text);
      if (!match) continue;
      const start = match.index + match[0].indexOf(match[1]);
      const end = start + match[1].length;
      if (found.some((hit) => start < hit.end && end > hit.start)) continue;
      found.push({ canonical: ingredient.canonical, roles: ingredient.roles, start, end });
      break;
    }
  }
  return found;
}

function creationLabel(hits, language) {
  const ordered = [];
  for (const hit of [...hits].sort((a, b) => a.start - b.start)) {
    if (!ordered.includes(hit.canonical)) ordered.push(hit.canonical);
  }
  const words = ordered.map((canonical) =>
    language === "fr" ? CREATION_LABEL_FR[canonical] || canonical : canonical,
  );
  const [first, ...rest] = words;
  const head = first.charAt(0).toUpperCase() + first.slice(1);
  if (!rest.length) return head;
  const join = language === "fr" ? " avec " : " with ";
  return head + join + rest.join(language === "fr" ? " et " : " and ");
}

function itemCovers(item, phrases) {
  const text = foldText(`${item.name || ""} ${item.detail || ""}`);
  return phrases.every((phrase) => hasPhrase(text, phrase));
}

/**
 * "Strawberry with cookie dough" is a creation. A signature whose description already
 * contains those ingredients is that product. Anything else is Create Your Own, at
 * the catalog price, with stock and an add button. A single product name is not a creation.
 */
export function describeCreation(message, shopFacts, language = "en") {
  const text = foldText(message);
  if (!/\b(with|and|plus|avec|et)\b/.test(text)) return "";
  if (/\b(refund|remboursement|birthday|anniversaire|gateau|custom cake|gateau personnalise)\b/.test(text)) return "";
  const hits = creationHits(message);
  const flavors = hits.filter((hit) => hit.roles.includes("flavor"));
  const extras = hits.filter((hit) => !flavors.some((flavor) => flavor.canonical === hit.canonical));
  const distinctFlavors = new Set(flavors.map((hit) => hit.canonical));
  if (distinctFlavors.size + extras.length < 2) return "";
  if (!flavors.length) return "";
  const phrases = [...distinctFlavors, ...extras.map((hit) => hit.canonical)];
  const ownName = "create your own creation";
  const candidates = catalogItems(shopFacts).filter(
    (item) => foldText(item.name) !== ownName && itemCovers(item, phrases),
  );
  const requestedFlavors = new Set(flavors.map((hit) => hit.canonical));
  const leadingFlavor = (item) => {
    const base = foldText(`${item.name} ${String(item.detail || "").split(/\bwith\b/)[0]}`);
    const found = creationHits(base)
      .filter((hit) => hit.roles.includes("flavor"))
      .sort((a, b) => a.start - b.start);
    return found[0]?.canonical || "";
  };
  const nameHits = (item) => phrases.filter((phrase) => hasPhrase(foldText(item.name), phrase)).length;
  candidates.sort((a, b) => {
    const lead = (requestedFlavors.has(leadingFlavor(b)) ? 1 : 0) - (requestedFlavors.has(leadingFlavor(a)) ? 1 : 0);
    if (lead) return lead;
    const named = nameHits(b) - nameHits(a);
    if (named) return named;
    const iceA = a.category === "Ice Cream" ? 1 : 0;
    const iceB = b.category === "Ice Cream" ? 1 : 0;
    if (iceA !== iceB) return iceB - iceA;
    return String(a.detail || "").length - String(b.detail || "").length;
  });
  const pick = candidates[0];
  if (pick) return customerProductLine(pick, language) + productActionLines(pick);
  const own = catalogItems(shopFacts).find((item) => foldText(item.name) === ownName);
  if (!own || !Number.isFinite(Number(own.price))) return "";
  const label = creationLabel(hits, language);
  const price = formatMoney(own.price);
  if (own.soldOut) {
    return language === "fr"
      ? `Je ne peux pas composer ${label} pour le moment. Create Your Own Creation est en rupture. D'habitude c'est ${price}.`
      : `I can't mix ${label} right now. Create Your Own Creation is sold out. It's usually ${price}.`;
  }
  const line = language === "fr"
    ? `Create Your Own Creation, ${label}, c'est ${price}, et c'est disponible.`
    : `Create Your Own Creation, ${label}, is ${price}, and it's in stock.`;
  return line + productActionLines(own);
}

/** One sentence a customer can read. No zero discounts, no menu count. */
export function customerProductLine(product, language = "en") {
  const fr = language === "fr";
  const name = product?.name || (fr ? "Ce produit" : "This one");
  const price = Number.isFinite(Number(product?.price)) && Number(product.price) > 0
    ? formatMoney(product.price)
    : "";
  if (product?.soldOut) {
    return fr
      ? `${name} est en rupture pour le moment${price ? `. D'habitude c'est ${price}` : ""}.`
      : `${name} is sold out right now${price ? `. It's usually ${price}` : ""}.`;
  }
  if (price) {
    return fr
      ? `${name}, c'est ${price}, et c'est disponible.`
      : `${name} is ${price}, and it's in stock.`;
  }
  return fr ? `${name} est disponible.` : `${name} is in stock.`;
}

const ADDABLE_ID = /^(?:menu:(?!custom:)[a-z0-9-]+:[a-z0-9-]+|flavor:\d{1,8})$/;

export function productActionLines(item) {
  if (!item?.path || item.soldOut) return "";
  const addId = typeof item.addId === "string" ? item.addId : "";
  // Shop-added cakes need name, photo and price together; the id alone cannot be added.
  const add = ADDABLE_ID.test(addId) ? `\n[ADD:${addId}]` : "";
  return `\n[LINK:${item.path}]${add}`;
}

/**
 * The nearest in-stock treat when the one they asked for is gone. Same category
 * counts, then shared words in the name. Create Your Own is not a stand-in.
 */
export function closestInStock(product, shopFacts) {
  if (!product) return null;
  const words = `${product.name || ""} ${product.detail || ""}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 3);
  let best = null;
  let bestScore = 0;
  for (const item of catalogItems(shopFacts)) {
    if (!canAdd(item) || sameItem(item, product)) continue;
    const hay = `${item.name} ${item.detail || ""}`.toLowerCase();
    const shared = words.filter((word) => hay.includes(word)).length;
    const score = shared * 10 + (item.category && item.category === product.category ? 8 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  if (best && bestScore >= 8) return best;
  return catalogItems(shopFacts).find((item) =>
    canAdd(item) && !sameItem(item, product) && item.category && item.category === product.category,
  ) || null;
}

/** Sold out, then one in-stock stand-in with its price and an add button. */
export function soldOutAnswer(product, shopFacts, language = "en") {
  const line = customerProductLine(product, language);
  if (!product?.soldOut) return line + productActionLines(product);
  const stand = closestInStock(product, shopFacts);
  if (!stand || !Number.isFinite(Number(stand.price))) return line;
  const price = formatMoney(stand.price);
  const offer = language === "fr"
    ? `${stand.name} est le plus proche encore disponible, à ${price}.`
    : `${stand.name} is the closest one still available, at ${price}.`;
  return `${line} ${offer}${productActionLines(stand)}`;
}

/**
 * A product the customer actually named, including a home-page name such as
 * "Mango sunshine" for Mango Pineapple Smoothie. A passing word is not enough.
 */
export function askedProduct(message, shopFacts) {
  if (aliasTarget(message)) return findProduct(shopFacts, message);
  const product = findProduct(shopFacts, message);
  if (!product?.name) return null;
  const words = plainName(product.name).split(" ").filter((word) => word.length > 3);
  if (!words.length) return null;
  const text = plainName(message);
  const hits = words.filter((word) => text.includes(word));
  // Every word of a short name, and most of a longer one. "Birthday cake" is not
  // "Birthday Cake Remix".
  const enough = words.length <= 2 ? hits.length === words.length : hits.length / words.length >= 0.75 && hits.length >= 2;
  if (!enough) return null;
  return product;
}

export function namedSoldOut(message, shopFacts) {
  const product = findProduct(shopFacts, message);
  if (!product?.soldOut || !product.name) return null;
  const words = product.name.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3);
  const text = String(message || "").toLowerCase();
  const hits = words.filter((word) => text.includes(word));
  const needed = Math.min(2, Math.max(words.length, 1));
  if (hits.length < needed && !text.includes(product.name.toLowerCase())) return null;
  return product;
}

export function asksForReorder(message) {
  return /\b(same as (?:last time|before|my last)|the usual|my usual|like last time|order again|reorder|re-order|same order|comme la derni[eè]re fois|comme d'habitude|la m[eê]me commande)\b/i.test(String(message || ""));
}

/** Today's prices for the last order. Sold-out lines are named and left out. */
export function reorderReply(message, shopFacts, language = "en") {
  if (!asksForReorder(message)) return "";
  const fr = language === "fr";
  const order = shopFacts.customerContext?.lastOrder;
  const lines = order?.items;
  if (!lines?.length) {
    return fr
      ? "Je n'ai pas de commande précédente sur ce compte. Connectez-vous, ou dites-moi ce que vous voulez."
      : "I don't have a past order on this account. Sign in, or tell me what you'd like.";
  }
  const kept = [];
  const skipped = [];
  for (const line of lines) {
    const product = resolveOrderLine(line, shopFacts);
    const quantity = Math.min(40, Math.max(1, Number(line.quantity) || 1));
    if (!product || product.soldOut || !canAdd(product)) {
      skipped.push(line.name || product?.name || "");
      continue;
    }
    kept.push({ product, quantity });
  }
  const leftOut = skipped.filter(Boolean);
  if (!kept.length) {
    return fr
      ? `Les articles de la commande #${order.id} sont en rupture.`
      : `The items from order #${order.id} are sold out right now.`;
  }
  const total = kept.reduce((sum, entry) => sum + Number(entry.product.price) * entry.quantity, 0);
  const list = kept.map((entry) => `${entry.quantity} ${entry.product.name}`).join(", ");
  const omit = leftOut.length
    ? (fr
      ? ` J'ai laissé de côté ${leftOut.join(", ")}, en rupture.`
      : ` I left out ${leftOut.join(" and ")}. ${leftOut.length > 1 ? "They're" : "It's"} sold out.`)
    : "";
  const fill = kept.map((entry) => `${entry.product.addId}*${entry.quantity}`).join(",");
  const sentence = fr
    ? `La dernière fois : ${list}.${omit} Le nouveau total est ${formatMoney(total)}, avant la livraison.`
    : `Last time was ${list}.${omit} The new total is ${formatMoney(total)}, before delivery.`;
  return `${sentence}\n[FILL:${fill}]`;
}

const PEOPLE_WORDS = {
  four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, hundred: 100,
  quatre: 4, cinq: 5, sept: 7, huit: 8, neuf: 9, dix: 10,
  quinze: 15, vingt: 20, trente: 30, quarante: 40, cinquante: 50, cent: 100,
};

/**
 * A counted group becomes a bag of real scoops, with that branch's delivery fee.
 * A wedding, catering, or 40 or more people still goes to the events form.
 */
export function partyReply(message, shopFacts, language = "en") {
  const people = partySize(message);
  if (!people) return null;
  const fr = language === "fr";
  const large = people >= 40 || /\b(wedding|mariage|catering)\b/i.test(String(message || ""));
  if (large) {
    return {
      topic: "event",
      body: fr
        ? `Pour ${people} personnes, le formulaire Événements est le bon endroit : date, boutique, livraison ou retrait, et au moins 10 articles. Vous voyez une estimation et l'acompte de 30 %. Rien n'est débité avant le devis.\n[ACTION:events]`
        : `For ${people} people, the events form is the right place: the date, the store, delivery or pickup, and at least 10 items. You see an estimate and the 30% deposit. Nothing is charged until the shop sends its quote.\n[ACTION:events]`,
    };
  }
  const scoops = catalogItems(shopFacts).filter((item) =>
    item.category === "Ice Cream"
    && canAdd(item)
    && Number(item.price) > 0
    && Number(item.price) < 8000
    && !/create your own|pre-packed|prepacked/i.test(item.name)
  ).slice(0, 3);
  if (!scoops.length) return null;
  const counts = splitCount(people, scoops.length);
  const lines = scoops
    .map((product, index) => ({ product, quantity: counts[index] }))
    .filter((entry) => entry.quantity > 0);
  const goods = lines.reduce((sum, entry) => sum + Number(entry.product.price) * entry.quantity, 0);
  const branch = (shopFacts.branchDetails || []).find((entry) =>
    entry.area && String(message).toLowerCase().includes(String(entry.area).toLowerCase()),
  );
  const dayMatch = String(message).match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/i);
  const day = dayMatch ? dayMatch[1].charAt(0).toUpperCase() + dayMatch[1].slice(1).toLowerCase() : "";
  const list = lines.map((entry) => `${entry.quantity} ${entry.product.name}`).join(", ");
  const when = day ? (fr ? ` ${day}` : ` on ${day}`) : "";
  const where = branch ? (fr ? ` à ${branch.area}` : ` in ${branch.area}`) : "";
  let fee = "";
  if (branch?.deliveryEnabled === false) {
    fee = fr ? ` ${branch.area} ne livre pas. Le retrait est gratuit.` : ` ${branch.area} does not deliver. Pickup is free.`;
  } else if (branch && Number.isInteger(branch.deliveryFee)) {
    fee = fr
      ? ` La livraison à ${branch.area} est ${formatMoney(branch.deliveryFee)}. Le retrait est gratuit.`
      : ` Delivery to ${branch.area} is ${formatMoney(branch.deliveryFee)}. Pickup is free.`;
  } else if (branch) {
    fee = fr
      ? ` Les frais de livraison de ${branch.area} s'affichent au checkout. Le retrait est gratuit.`
      : ` The ${branch.area} delivery fee is shown at checkout. Pickup is free.`;
  }
  const fill = lines.map((entry) => `${entry.product.addId}*${entry.quantity}`).join(",");
  return {
    topic: "event",
    body: fr
      ? `Pour ${people} personnes${when}${where} : ${list}. Les glaces font ${formatMoney(goods)}.${fee}\n[FILL:${fill}]`
      : `For ${people} people${when}${where}: ${list}. The ice cream is ${formatMoney(goods)}.${fee}\n[FILL:${fill}]`,
  };
}

export function canAdd(item) {
  return Boolean(item && !item.soldOut && item.path && ADDABLE_ID.test(item.addId || "") && Number.isFinite(Number(item.price)));
}

function sameItem(item, product) {
  return item.addId && item.addId === product.addId;
}

function resolveOrderLine(line, shopFacts) {
  const items = catalogItems(shopFacts);
  if (line?.menuItemId) {
    const byId = items.find((item) => item.addId === line.menuItemId);
    if (byId) return byId;
  }
  if (line?.flavorId) {
    const flavor = items.find((item) => item.addId === `flavor:${line.flavorId}`);
    if (flavor) return flavor;
  }
  return findProduct(shopFacts, line?.name);
}

function partySize(message) {
  const text = String(message || "");
  const digit = text.match(/\b(\d{1,4})\s*(people|persons|guests|personnes|invit[eé]s?)\b/i);
  if (digit) return clampPeople(Number(digit[1]));
  const word = text.toLowerCase().match(new RegExp(`\\b(${Object.keys(PEOPLE_WORDS).join("|")})\\s+(people|persons|guests|personnes|invit)`));
  if (!word) return 0;
  return clampPeople(PEOPLE_WORDS[word[1]]);
}

function clampPeople(count) {
  if (!Number.isSafeInteger(count) || count < 4 || count > 500) return 0;
  return count;
}

function splitCount(total, parts) {
  const base = Math.floor(total / parts);
  let extra = total % parts;
  return Array.from({ length: parts }, () => {
    const count = base + (extra > 0 ? 1 : 0);
    extra -= 1;
    return count;
  });
}

function stockLine(match) {
  if (match.soldOut) return "Stock: SOLD OUT. The count is shared by every branch. Do not add a buy link.";
  if (Number.isInteger(match.stock)) {
    return `Stock: ${match.stock} left. That count is shared by every branch, not a separate number per store.`;
  }
  return "Stock: in stock. The count is shared by every branch, not a separate number per store.";
}

function branchNamed(shopFacts, branch) {
  if (!branch) return null;
  const wanted = String(branch).toLowerCase().replace(/[^a-zà-ÿ0-9\s]/g, " ").trim();
  if (!wanted) return null;
  return (shopFacts.branchDetails || []).find((entry) =>
    entry.area.toLowerCase().includes(wanted)
    || wanted.includes(entry.area.toLowerCase())
    || entry.town.toLowerCase() === wanted,
  ) || null;
}

function getProduct(shopFacts, name, branch) {
  const match = findProduct(shopFacts, name);
  if (!match) {
    return `No product or flavor matching "${name}" was found in the catalog. Do not invent one — tell the customer you could not find it and ask them to describe it again.`;
  }
  const place = branchNamed(shopFacts, branch);
  return [
    `Product: ${match.name}`,
    `Category: ${match.category}`,
    `Price: ${formatMoney(match.price)}`,
    match.soldOut
      ? "Availability: SOLD OUT right now. Do not add a buy link."
      : "Availability: in stock.",
    stockLine(match),
    place ? describeBranch(place) : "",
    match.path ? `Direct link: ${match.path}` : "",
    match.addId && !match.soldOut ? `Add to bag id: ${match.addId}` : "",
    match.soldOut || !match.path
      ? ""
      : `When it is in stock and it does not conflict with an allergy they stated, end with [LINK:${match.path}]${match.addId ? ` and [ADD:${match.addId}]` : ""}. That opens and adds THIS product. Do not send them to /menu or /menu/all.`,
    match.detail ? `Description: ${match.detail}` : "",
    match.tags && match.tags !== "-" ? `Dietary tags: ${match.tags}` : "",
    match.allergens ? `Allergens: ${match.allergens}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
}

function catalogItems(shopFacts) {
  const items = [];
  for (const [category, entries] of Object.entries(shopFacts.menuByCategory || {})) {
    for (const item of entries || []) {
      items.push({
        ...item,
        category,
        path: item.path || menuItemPath(category, item.name),
      });
    }
  }
  for (const flavor of shopFacts.flavors || []) {
    const path = flavor.path || flavorItemPath(flavor.id);
    if (!path) continue;
    if (items.some((item) => item.name.toLowerCase() === String(flavor.name).toLowerCase() && item.path === path)) continue;
    items.push({ ...flavor, category: flavor.tag || "Flavor", path });
  }
  return items;
}

function mentions(text, catalog) {
  const haystack = String(text || "").toLowerCase();
  return catalog
    .map((item) => {
      const name = String(item.name || "").toLowerCase();
      const score = name.length > 2 && haystack.includes(name) ? 100 + name.length : 0;
      return { item, score };
    })
    .filter((entry) => entry.score >= 100)
    .sort((a, b) => b.score - a.score);
}

const LOOSE_NAME_STOP = new Set(["the", "and", "for", "with", "its", "you", "our"]);

/**
 * A photo reply often shortens the menu name ("Cat in the Hat" for the full
 * cotton-candy creation). Two distinctive words, in order, and a clear winner
 * are enough. A tie stays unmatched so two chocolate products do not both win.
 */
function looseMentions(text, catalog) {
  const haystack = ` ${String(text || "").toLowerCase().replace(/['’]/g, " ").replace(/[^a-z0-9]+/g, " ")} `;
  const scored = catalog
    .map((item) => {
      const words = String(item.name || "")
        .toLowerCase()
        .replace(/['’]/g, " ")
        .split(/[^a-z0-9]+/)
        .filter((word) => word.length >= 3 && !LOOSE_NAME_STOP.has(word));
      if (words.length < 2) return { item, score: 0 };
      let from = 0;
      let hit = 0;
      for (const word of words) {
        const at = haystack.indexOf(` ${word} `, from);
        if (at < 0) continue;
        hit += 1;
        from = at + 1;
      }
      return { item, score: hit >= 2 ? hit * 20 : 0 };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
  if (scored.length > 1 && scored[0].score - scored[1].score < 8) return [];
  return scored;
}

/**
 * When a reply is about one in-stock product, attach that product's page.
 * A photo question ("is this available?") rarely names the item, so the product
 * the reply itself names is the one the button opens. A sold-out item gets no link,
 * A reply that already opens the product keeps that link and still gains Add to bag.
 */
export function ensureProductLink(reply, { message = "", imageAttached = false, facts = {}, matched = null, language = "en" } = {}) {
  const text = String(reply || "").trim();
  if (!text) return text;
  // A bag of several items already carries its own add button.
  if (/\[(?:FILL|BAG|VISIT|CODE|CHIPS):/i.test(text)) return text;
  const catalog = catalogItems(facts);
  const fromMessage = mentions(message, catalog);
  const fromReply = mentions(text, catalog);
  const fromPhotoWords = imageAttached && !fromReply.length ? looseMentions(text, catalog) : [];
  const ranked = imageAttached
    ? (fromReply.length ? fromReply : fromPhotoWords)
    : fromMessage.length ? fromMessage : fromReply;
  const forced = matched?.confident && matched.path ? matched : null;
  if (!forced) {
    if (/\[LINK:\//i.test(text) && /\[ADD:/i.test(text)) return text;
    if (!ranked.length) return text;
    if (ranked.length > 1 && ranked[0].score - ranked[1].score < 8) return text;
  }
  const product = forced || ranked[0]?.item;
  if (!product?.path) return text;
  const namedAlready = product.name && text.toLowerCase().includes(String(product.name).toLowerCase());
  if (product.soldOut) {
    const stripped = text.replace(/\s*\[ACTION:menu_all\]\s*$/i, "").replace(/\s*\[LINK:\/[^\]]+\]\s*$/i, "").replace(/\s*\[ADD:[^\]]+\]\s*$/i, "").trim();
    return forced && !namedAlready ? customerProductLine(product, language) : stripped;
  }
  if (!forced) {
    const asking =
      imageAttached
      || Boolean(fromMessage.length)
      || /\b(available|availability|in stock|sold out|order|buy|link|this one|disponible|rupture|commander)\b/i.test(message);
    if (!asking) return text;
  }
  let cleaned = text.replace(/\s*\[ACTION:menu_all\]\s*$/i, "").replace(/\s*\[LINK:\/[^\]]+\]\s*$/i, "").replace(/\s*\[ADD:[^\]]+\]\s*$/i, "").trim();
  if (forced && product.name && !cleaned.toLowerCase().includes(String(product.name).toLowerCase())) {
    cleaned = customerProductLine(product, language);
  }
  if (cleaned.includes(product.path)) {
    if (product.soldOut || !product.addId || cleaned.includes(`[ADD:${product.addId}]`)) return cleaned;
    return `${cleaned}\n[ADD:${product.addId}]`;
  }
  return `${cleaned}${productActionLines(product)}`;
}

async function getActivePromos(database) {
  const rows = await database
    .prepare(
      `
    SELECT code, discount_type AS type, discount_value AS value, minimum_total AS minimum
    FROM discount_codes
    WHERE is_active = 1
      AND (expires_at IS NULL OR expires_at > ?)
      AND (max_uses IS NULL OR uses < max_uses)
    ORDER BY created_at DESC LIMIT 5
  `,
    )
    .all(new Date().toISOString());
  if (!rows.length) {
    return "No active discount codes right now. Do not promise any promotion.";
  }
  return rows
    .map((row) => {
      const amount =
        row.type === "percent"
          ? `${row.value}% off`
          : `${formatMoney(row.value)} off`;
      return `${row.code}: ${amount}${row.minimum ? `, minimum ${row.minimum} items` : ""}`;
    })
    .join(" | ");
}

function getDeliveryInfo(shopFacts, area) {
  if (!area)
    return "No area given. Ask the customer which neighborhood they are in.";
  const wanted = String(area)
    .toLowerCase()
    .replace(/[^a-zà-ÿ0-9\s]/g, " ")
    .trim();
  const branches = shopFacts.branchDetails || [];
  const match = branches.find(
    (branch) =>
      branch.area.toLowerCase().includes(wanted) ||
      wanted.includes(branch.area.toLowerCase()) ||
      branch.town.toLowerCase().includes(wanted),
  );
  if (match) {
    return `Yes — ${describeBranch(match)} Address: ${match.address}.`;
  }
  const towns = [...new Set(branches.map((branch) => branch.town))].join(", ");
  return `We do not have a branch in "${area}". We serve from our branches in: ${towns}. The delivery checker at checkout confirms whether a specific address is covered and shows the fee.`;
}

const ORDER_STATUS_MEANINGS = {
  processing: "confirmed and being prepared",
  ready: "ready for pickup at the store",
  out_for_delivery: "out for delivery right now",
  delivered: "delivered",
  payment_failed:
    "payment did not go through — the customer can retry checkout",
  cancelled: "cancelled",
};

async function getOrderStatus(database, orderNumber) {
  const id = Number(String(orderNumber || "").replace(/[^\d]/g, ""));
  if (!Number.isSafeInteger(id) || id < 1) {
    return "No valid order number given. Ask the customer for the number (it starts with #).";
  }
  const order = await database
    .prepare(
      `
    SELECT o.id, o.status, o.total_cents AS total, o.fulfillment_type AS fulfillment
    FROM orders o WHERE o.id = ? LIMIT 1
  `,
    )
    .get(id);
  if (!order) {
    return `Order #${id} was not found. Ask the customer to double-check the number or the email used at checkout.`;
  }
  return [
    `Order #${order.id}`,
    `Status: ${order.status} (${ORDER_STATUS_MEANINGS[order.status] || "in progress"})`,
    `Total: ${formatMoney(order.total)}`,
    `Type: ${order.fulfillment || "not recorded"}`,
  ].join(" | ");
}

/**
 * Run one round of tool calls from a model response and return the results as
 * messages. Returns [] when the response asked for no tools.
 */
export async function runToolCalls(toolCallResponse, executeTool) {
  const calls = toolCallResponse?.choices?.[0]?.message?.tool_calls;
  if (!Array.isArray(calls) || calls.length === 0) return [];
  const results = [];
  for (const call of calls.slice(0, 4)) {
    let args = {};
    try {
      args = JSON.parse(call.function?.arguments || "{}");
    } catch {
      args = {};
    }
    const output = await executeTool(call.function?.name, args);
    results.push({
      role: "tool",
      tool_call_id: call.id,
      content: String(output).slice(0, 900),
    });
  }
  return results;
}
