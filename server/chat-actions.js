// Chat actions that finish an order: edit the bag, choose a branch and a time,
// apply one real discount code, read this account's points, and remember one
// food the customer cannot eat. The sentences stay short. The tags at the end
// are buttons, not text the customer should read.

import { askedProduct, canAdd } from "./chat-tools.js";
import { describeBagQuote, productConflicts, quoteBag, statedAllergies } from "./chat-offer.js";

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const WEEKDAYS_FR = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

function money(amount) {
  return `${new Intl.NumberFormat("en-CM").format(Math.round(amount))} FCFA`;
}

export function cameroonToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Douala" }).format(now);
}

function addDays(iso, days) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function weekdayIndex(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function withChips(text, chips) {
  const clean = (chips || [])
    .map((chip) => String(chip || "").replace(/[\]|[]/g, "").trim())
    .filter((chip) => chip && chip.length <= 48)
    .slice(0, 3);
  if (!clean.length || /\[CHIPS:/i.test(text)) return text;
  return `${String(text || "").trim()}\n[CHIPS:${clean.join("|")}]`;
}

function bagLines(bag) {
  // The widget sends each line's id in the addId shape ("menu:…:…" / "flavor:…");
  // older payloads may still carry addId. Either key must count, or every bag
  // edit is refused because no line passes the filter.
  return (bag || []).filter(
    (item) => item?.name && item.quantity > 0 && (item.addId || item.id),
  );
}

/** The addId-shaped key of one bag line: the widget's id, or a legacy addId. */
function lineAddId(item) {
  return String(item?.addId || item?.id || "");
}

function matchBagLine(message, bag) {
  const haystack = ` ${String(message || "").toLowerCase().replace(/['’]/g, " ").replace(/[^a-z0-9]+/g, " ")} `;
  const ranked = bagLines(bag)
    .map((item) => {
      const words = String(item.name)
        .toLowerCase()
        .replace(/['’]/g, " ")
        .split(/[^a-z0-9]+/)
        .filter((word) => word.length > 3);
      const hits = words.filter((word) => haystack.includes(` ${word} `)).length;
      return { item, hits };
    })
    .filter((entry) => entry.hits > 0)
    .sort((a, b) => b.hits - a.hits || b.item.name.length - a.item.name.length);
  return ranked[0]?.item || null;
}

function asksToClearBag(message) {
  return /\b(empty|clear|vide|vider)\b/i.test(message) && /\b(bag|cart|panier)\b/i.test(message);
}

/** "Add the mango", "I want two of the vanilla", "mettez le chocolate dans le panier". */
function asksToAdd(message) {
  const wantsBag = /\b(bag|cart|panier)\b/i.test(message);
  const wantsIt = /\b(add|put|drop)\b/i.test(message) && /\b(it|this|that|one|them|some|bag|cart)\b/i.test(message);
  const saysTake = /\b(i(?:'ll| will| would like|'d like| want| take)|je (?:veux|prends)|mettez?|ajoutez?|ajouter)\b/i.test(message);
  const withCount = /\b(two|three|four|five|deux|trois|quatre|cinq|\d{1,2})\b/i.test(message);
  return wantsIt || (saysTake && wantsBag) || (saysTake && withCount);
}

function asksToChangeBag(message) {
  return /\b(remove|take off|take out|drop|enl[eè]ve|retire|make (?:it|the|them)|change it to|seulement)\b/i.test(message)
    || (new RegExp(`\\b(?:make|mettre)\\b.*\\b(?:${Object.keys(QUANTITY_WORDS).join("|")}|\\d{1,2})\\b`, "i")).test(message);
}

// Number words the bag edits accept, so "make it two" sets 2. Digits still win
// when both appear ("make it 2 more"). Two covers the correction people send
// right after an add; the words up to twelve cover the rest.
const QUANTITY_WORDS = {
  one: 1, a: 1, an: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, sept: 7,
  huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12,
};

/** The quantity the customer named, as digits first, then as words. */
function askedQuantity(message) {
  const digit = String(message).match(/\b(\d{1,2})\b/);
  if (digit) return Number(digit[1]);
  const word = String(message).toLowerCase().match(new RegExp(`\\b(${Object.keys(QUANTITY_WORDS).join("|")})\\b`));
  return word ? QUANTITY_WORDS[word[1]] : 0;
}

/**
 * An explicit "add X to my bag" is answered here, not by the model, so the
 * confirmation always matches the tag: the reply ends with [ADD:…] and the
 * widget's button does the adding when the customer taps it. The wording says
 * "here is the button" rather than "it is in your bag" — the tap is the act.
 */
export function addReply(message, shopFacts, language = "en", pendingAdd = null) {
  if (!asksToAdd(message)) return null;
  // Allergy conflicts fall to the model, which carries the guard rails.
  const allergies = statedAllergies(message);
  if (allergies.length) return null;
  const fr = language === "fr";
  // "Add it to my bag" names no product: the one the last reply offered is the
  // one being confirmed. Without this the message falls to the model, which
  // answers "has been added" without an [ADD:] tag and nothing reaches the bag.
  const product = askedProduct(message, shopFacts) || pendingAdd;
  if (!product || product.soldOut || !canAdd(product)) return null;
  const quantity = askedQuantity(message) || 1;
  const name = product.name;
  const body = fr
    ? `${name}${quantity > 1 ? ` ×${quantity}` : ""} — je l'ajoute à votre panier.\n[ADD:${product.addId}]`
    : quantity > 1
      ? `${name} ×${quantity} — added to your bag.\n[ADD:${product.addId}]`
      : `${name} — added to your bag.\n[ADD:${product.addId}]`;
  return {
    topic: "order",
    chips: productChips(language),
    body,
  };
}

export function bagEditReply(message, bag, language = "en") {
  const fr = language === "fr";
  const lines = bagLines(bag);
  if (!asksToClearBag(message) && !asksToChangeBag(message)) return null;
  if (!lines.length) {
    return {
      topic: "order",
      body: fr ? "Votre panier est déjà vide." : "Your bag is already empty.",
    };
  }
  if (asksToClearBag(message)) {
    return {
      topic: "order",
      chips: fr ? ["Voir le menu"] : ["Show me the menu"],
      body: fr
        ? "J'ai retiré tout le panier.\n[BAG:clear]"
        : "I cleared the bag.\n[BAG:clear]",
    };
  }
  const target = matchBagLine(message, lines) || (lines.length === 1 ? lines[0] : null);
  if (!target) {
    const names = lines.map((item) => item.name).join(", ");
    return {
      topic: "order",
      body: fr
        ? `Lequel voulez-vous changer ? Le panier a ${names}.`
        : `Which one should I change? The bag has ${names}.`,
    };
  }
  const askedForNumber = /\b(\d{1,2})\b/.test(message) || /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|un|une|deux|trois|quatre|cinq|sept|huit|neuf|dix|onze|douze)\b/i.test(message);
  if (/\b(remove|take off|take out|drop|enl[eè]ve|retire)\b/i.test(message) && !askedForNumber) {
    return {
      topic: "order",
      chips: fr ? ["Vider le panier"] : ["Empty the bag"],
      body: fr
        ? `${target.name} sort du panier.\n[BAG:set:${lineAddId(target)}*0]`
        : `${target.name} is out of the bag.\n[BAG:set:${lineAddId(target)}*0]`,
    };
  }
  const quantity = askedQuantity(message);
  if (quantity < 1 || quantity > 40) {
    return {
      topic: "order",
      body: fr
        ? "Dites-moi une quantité entre 1 et 40."
        : "Tell me a quantity from 1 to 40.",
    };
  }
  const next = lines.map((item) => lineAddId(item) === lineAddId(target) ? { ...item, quantity } : item);
  const quote = describeBagQuote(next, [], fr ? "fr" : "en");
  return {
    topic: "order",
    chips: fr ? ["Appliquer un code"] : ["Apply a discount code"],
    body: fr
      ? `${target.name}, quantité ${quantity}. ${quote}\n[BAG:set:${lineAddId(target)}*${quantity}]`
      : `${target.name}, quantity ${quantity}. ${quote}\n[BAG:set:${lineAddId(target)}*${quantity}]`,
  };
}

function askedHour(message) {
  const clock = String(message).match(/\b(?:at|à|a)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i)
    || String(message).match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (!clock) return null;
  let hour = Number(clock[1]);
  const suffix = (clock[3] || "").toLowerCase();
  if (suffix === "pm" && hour < 12) hour += 12;
  if (suffix === "am" && hour === 12) hour = 0;
  if (!suffix && hour >= 1 && hour <= 7) hour += 12;
  if (hour < 0 || hour > 23) return null;
  return hour;
}

function askedDate(message, today) {
  const text = String(message || "").toLowerCase();
  if (/\b(today|aujourd'hui|aujourdhui)\b/.test(text)) return today;
  if (/\b(tomorrow|demain)\b/.test(text)) return addDays(today, 1);
  const english = WEEKDAYS.findIndex((day) => text.includes(day));
  const french = WEEKDAYS_FR.findIndex((day) => text.includes(day));
  const index = english >= 0 ? english : french;
  if (index < 0) return "";
  const todayIndex = weekdayIndex(today);
  const delta = (index - todayIndex + 7) % 7 || 7;
  return addDays(today, delta);
}

function fulfillmentType(message) {
  if (/\b(pick\s?up|collect|retrait|à emporter|a emporter)\b/i.test(message)) return "pickup";
  if (/\b(deliver|delivery|livraison|livrez)\b/i.test(message)) return "delivery";
  return "";
}

export function visitReply(message, { branches = [], slots = [], today = cameroonToday() } = {}, language = "en") {
  const fr = language === "fr";
  const type = fulfillmentType(message);
  if (!type) return null;
  if (/\?/.test(message) || /\b(do you|can you|est-ce|livrez-vous|pouvez-vous)\b/i.test(message)) return null;
  const branch = (branches || []).find((entry) => entry.area && String(message).toLowerCase().includes(String(entry.area).toLowerCase()));
  if (!branch) return null;
  const date = askedDate(message, today) || addDays(today, 1);
  const hour = askedHour(message);
  const slot = hour == null
    ? slots[0]
    : slots.find((entry) => String(entry.startTime || "").startsWith(String(hour).padStart(2, "0"))) || slots[0];
  const slotLabel = slot?.label || (fr ? "le prochain créneau" : "the next open time");
  const slotId = slot?.id ? String(slot.id) : "";
  const checkoutLocation = branch.checkoutLocation || branch.area;
  const fee = type === "delivery" && Number.isInteger(branch.deliveryFee)
    ? (fr ? `La livraison est ${money(branch.deliveryFee)}.` : `Delivery is ${money(branch.deliveryFee)}.`)
    : (fr ? "Le retrait est gratuit." : "Pickup is free.");
  const when = `${date}, ${slotLabel}`;
  const sentence = fr
    ? `${type === "delivery" ? "Livraison" : "Retrait"} à ${branch.area}, ${when}. ${fee}`
    : `${type === "delivery" ? "Delivery" : "Pickup"} at ${branch.area}, ${when}. ${fee}`;
  const tag = slotId ? `\n[VISIT:${type}|${checkoutLocation}|${date}|${slotId}]` : "";
  return { topic: "delivery", body: `${sentence}${tag}` };
}

export function codeReply(message, bag, discounts = [], language = "en") {
  const fr = language === "fr";
  const wants = /\b(use|apply|applique|utiliser|mets)\b/i.test(message);
  const named = (discounts || []).find((discount) => discount?.code && String(message).toUpperCase().includes(String(discount.code).toUpperCase()));
  if (!wants && !named) return null;
  if (!wants && !/\b(code|promo|coupon)\b/i.test(message)) return null;
  if (!named) {
    const list = (discounts || []).map((discount) => discount.code).filter(Boolean);
    return {
      topic: "discount",
      body: list.length
        ? (fr ? `Les codes en cours sont ${list.join(", ")}.` : `The codes running now are ${list.join(", ")}.`)
        : (fr ? "Il n'y a pas de code en ce moment." : "There is no code running right now."),
    };
  }
  const lines = bagLines(bag);
  if (!lines.length) {
    return {
      topic: "discount",
      body: fr
        ? `Ajoutez une glace, et j'appliquerai ${named.code}.`
        : `Add a treat, and I will apply ${named.code}.`,
    };
  }
  const quote = quoteBag(lines, [named]);
  if (quote.code !== named.code) {
    const minimum = Number(named.minimum || 0);
    return {
      topic: "discount",
      body: minimum > 0
        ? (fr
          ? `${named.code} demande au moins ${minimum} articles. Le panier n'y est pas encore.`
          : `${named.code} needs at least ${minimum} items. The bag is not there yet.`)
        : (fr ? `${named.code} ne s'applique pas à ce panier.` : `${named.code} does not apply to this bag.`),
    };
  }
  const described = describeBagQuote(lines, [named], fr ? "fr" : "en");
  return {
    topic: "discount",
    body: fr
      ? `${described}\n[CODE:${named.code}]`
      : `${described}\n[CODE:${named.code}]`,
  };
}

export function loyaltyReply(message, points, language = "en") {
  if (!/\b(my points|how many points|points do i have|mes points|combien de points|solde de points)\b/i.test(message)) {
    return null;
  }
  const fr = language === "fr";
  if (!Number.isFinite(points)) {
    return {
      topic: "loyalty",
      body: fr
        ? "Connectez-vous pour voir vos points."
        : "Sign in to see your points.",
    };
  }
  const worth = Math.round(points) * 10;
  return {
    topic: "loyalty",
    body: fr
      ? `Vous avez ${Math.round(points)} points, soit ${money(worth)}. Ils s'utilisent au paiement, pas en même temps qu'un code.`
      : `You have ${Math.round(points)} points, worth ${money(worth)}. They apply at checkout, and not together with a code.`,
  };
}

function safeCatalog(facts) {
  const items = [];
  for (const group of Object.values(facts?.menuByCategory || {})) {
    for (const item of group || []) if (item?.name && item.addId) items.push(item);
  }
  for (const flavor of facts?.flavors || []) {
    if (flavor?.name && flavor.addId) items.push(flavor);
  }
  return items;
}

export function preferenceReply(message, facts, language = "en") {
  const allergies = statedAllergies(message);
  if (!allergies.length) return null;
  if (/\b(how much|price|combien|available|in stock)\b/i.test(message)) return null;
  const fr = language === "fr";
  const names = allergies.map((allergen) => allergen.label).join(fr ? " et " : " and ");
  const safe = safeCatalog(facts).find((item) => !item.soldOut && Number(item.price) > 0 && !productConflicts(item, allergies));
  const remembered = fr ? `Je retiens : sans ${names}.` : `I'll remember: no ${names}.`;
  if (!safe) return { topic: "stock", avoid: allergies.map((allergen) => allergen.label), body: remembered };
  const line = fr
    ? `${safe.name} est à ${money(safe.price)}, et c'est en stock.`
    : `${safe.name} is ${money(safe.price)}, and it's in stock.`;
  const link = safe.path ? `\n[LINK:${safe.path}]` : "";
  const add = safe.addId ? `\n[ADD:${safe.addId}]` : "";
  return {
    topic: "stock",
    avoid: allergies.map((allergen) => allergen.label),
    chips: fr ? ["Ajoute-le au panier"] : ["Add it to my bag"],
    body: `${remembered} ${line}${link}${add}`,
  };
}

export function productChips(language = "en", area = "Bonanjo") {
  const place = String(area || "Bonanjo").replace(/[\]|[]/g, "").trim() || "Bonanjo";
  return language === "fr"
    ? ["Ajoute-le au panier", `Livraison à ${place}`, "Sans noix"]
    : ["Add it to my bag", `Deliver to ${place}`, "Something without nuts"];
}
