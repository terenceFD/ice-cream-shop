// AI reply suggestions for the admin live-chat inbox.
//
// When a staff member opens a conversation, they can ask the assistant to draft a reply
// to the customer's latest message. The draft is grounded in the shop's real data —
// the menu with live stock, the branches, the opening hours and the active discount
// codes — so the suggestion never invents a price or a flavour that does not exist.
//
// Two engines:
// - With AI_API_KEY (any OpenAI-compatible provider: OpenAI, Groq, OpenRouter, local
//   vLLM...), the shop facts are put in the system prompt and a small model writes the
//   reply. The shop data stays authoritative: the prompt orders the model to use only
//   the facts given.
// - Without a key, a rule-based drafter answers the common questions directly from the
//   database: prices, stock, branches, hours, discounts, ordering steps, delivery,
//   refunds. It is honest about what it does not know and always offers the human.

import {
  cameroonLocations,
  coldStoneMenuCategories,
  getMenuItemId,
} from "../shared/data.js";
import {
  DEFAULT_STORE_HOURS,
  formatClock,
  localClock,
} from "../shared/storeHours.js";

const TIME_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// How the AI may help a lost customer on the page they are viewing. Detail pages
// (flavor details, product lists, legal pages) get a generic description from their
// URL shape; unknown paths get a neutral instruction instead of a guess.
function PAGE_GUIDE_HINT(path) {
  const base = "/" + path.replace(/^\//, "").split("/")[0];
  const known = PAGE_GUIDES[base] || PAGE_GUIDES[path];
  if (known) {
    return ` — it is ${known}. If the customer asks what page this is or how to use it: name the page first, then walk them through what is on it and what to tap next, in order from top of the page to bottom; finish with the matching [ACTION:...] line when another page serves them better.`;
  }
  const generic = GENERIC_PAGE_GUIDES.find((guide) => guide.match.test(path));
  if (generic) {
    return ` — it is ${generic.description} (address: ${path}). If the customer asks what page this is or how to use it, explain it from this description and tell them what to tap next; add the matching [ACTION:...] line when another page serves them better.`;
  }
  return ` — a customer page of this website. If asked what page this is, say it is part of the Cold Stone Creamery site and offer to help them reach the menu, the branches or their orders instead of guessing details you cannot see.`;
}

// Detail pages whose address contains an id or a slug: described by URL shape.
const GENERIC_PAGE_GUIDES = [
  {
    match: /^\/flavors\//,
    description:
      "a flavor detail page: photos, description, price and an add-to-cart button for one specific flavor",
  },
  {
    match: /^\/menu\//,
    description:
      "a menu category page: the product list of one menu category, with prices and add-to-cart buttons",
  },
  {
    match: /^\/account/,
    description:
      "a signed-in account page: order history, favorites and personal details",
  },
  {
    match: /^\/(privacy|terms|refunds|cookies)/,
    description: "a policy page with legal text",
  },
];

const PAGE_GUIDES = {
  "/": "the home page: featured flavors, quick links to the menu, cakes and events, and the shop's trust badges",
  "/menu":
    "the menu page: ice-cream categories with photos; each category opens its own product list",
  "/menu/all":
    "the all-menu page: every product on one page with photos and prices; search box and filters (category, price, diet, availability) at the top; tap a product for details or the cart icon to add it",
  "/custom-cake":
    "the custom-cake page: a form to request a made-to-order cake — size, message and date; the shop confirms by email or chat",
  "/events":
    "the event-orders page: catering for birthdays, offices and weddings — describe the event and get a quote",
  "/locations":
    "the locations page: every branch with address, hours and a map link",
  "/contact":
    "the contact page: a form to write to the shop; replies come by email",
  "/faq": "the FAQ page: answers about ordering, delivery and payment",
  "/cart":
    "the cart page: your items, quantities, the discount-code field and the total; checkout continues from here",
  "/checkout":
    "the checkout page: delivery details, pickup or delivery, time slot, payment — the order then appears in the account and can be tracked",
  "/track-order":
    "the track-order page: enter an order number to see its status from preparing to delivered",
  "/account/orders":
    "the account page: order history, favorites, subscriptions and details",
  "/flavors": "the flavors page: the full flavor catalog with descriptions",
  "/order-confirmation":
    "the order-confirmation page: the receipt of a just-placed order — order number, items and total, with a link to track it",
};

// Phrases that mean the customer is lost on the current page. Matched against the
// lowercase message by the rules engine and used to bias the AI topic detection.
const LOST_PAGE_PHRASES = [
  "what page",
  "which page",
  "where am i",
  "what is this page",
  "what's this page",
  "how do i use",
  "how to use this",
  "how do i navigate",
  "i'm lost",
  "i am lost",
  "don't know where",
  "dont know where",
  "quelle page",
  "où suis-je",
  "ou suis-je",
  "je suis perdu",
  "comment naviguer",
  "c'est quelle page",
];

export function isLostPageQuestion(text) {
  const message = text.toLowerCase();
  return LOST_PAGE_PHRASES.some((phrase) => message.includes(phrase));
}

const TIMEOUT_MS = 15000;

// The generative model only writes when these are set. AI_BASE_URL defaults to OpenAI.
export function aiConfigured() {
  return Boolean(process.env.AI_API_KEY && process.env.AI_MODEL);
}

// Shop facts are stable for minutes at a time, but the database queries behind them
// run on every message. A short cache keeps a busy chat from re-reading the catalog
// (and paying for the same tokens) on every single reply.
let factCache = null;
let factCacheAt = 0;
const FACT_CACHE_MS = 60000;

/**
 * Draft a reply to the customer's latest message in a thread.
 * history: oldest-first [{ sender: 'customer'|'store', body }]
 * Returns { suggestion, source: 'ai'|'rules', topic } or { suggestion: null } when
 * there is nothing to answer yet.
 */
export async function suggestReply(
  history,
  { database, language = "en", customerPage = "", pageSnapshot = "" },
) {
  const lastCustomer = [...history]
    .reverse()
    .find((message) => message.sender === "customer");
  if (!lastCustomer) return { suggestion: null, reason: "no-customer-message" };

  const context = await gatherShopFacts(database);
  const recent = history.slice(-12);

  if (aiConfigured()) {
    const ai = await generateWithModel(recent, context, language, customerPage, pageSnapshot);
    if (ai)
      return {
        suggestion: ai,
        source: "ai",
        topic: detectTopic(lastCustomer.body),
      };
  }
  const rules = draftFromRules(
    lastCustomer.body,
    context,
    language,
    customerPage,
  );
  return {
    suggestion: rules.body,
    source: "rules",
    topic: rules.topic,
    confidence: rules.confidence,
  };
}

// ---------------------------------------------------------------- shop facts

async function gatherShopFacts(database) {
  if (factCache && Date.now() - factCacheAt < FACT_CACHE_MS) return factCache;
  const facts = { menu: [], stores: [], discounts: [], hours: null };

  try {
    const rows = await database
      .prepare(
        `
      SELECT m.name, m.category_title AS category, m.price_xaf AS priceXaf,
             COALESCE(i.stock, 100) AS stock, COALESCE(i.is_available, 1) AS isAvailable
      FROM custom_menu_items m
      LEFT JOIN menu_inventory i ON i.item_id = 'custom-' || m.id
      WHERE m.is_available = 1
      ORDER BY m.category_title, m.name
    `,
      )
      .all();
    facts.menu = rows.slice(0, 60).map((row) => ({
      name: row.name,
      category: row.category,
      price: row.priceXaf,
      soldOut: row.isAvailable === 0 || Number(row.stock) <= 0,
    }));
  } catch {
    // A database hiccup must not break the endpoint; the static catalog below is still used.
  }

  // The built-in menu lives in the static catalog, not the database. Stock overrides,
  // when the store set any, are read from menu_inventory by the item's public id.
  const stockRows = new Map();
  try {
    for (const row of await database
      .prepare("SELECT item_id, stock, is_available FROM menu_inventory")
      .all()) {
      stockRows.set(row.item_id, row);
    }
  } catch {
    // No inventory overrides: every built-in item counts as available.
  }
  for (const category of coldStoneMenuCategories) {
    for (const item of category.items) {
      const itemId = getMenuItemId(category.title, item.name);
      const inventory = stockRows.get(itemId);
      if (!facts.menu.some((entry) => entry.name === item.name)) {
        facts.menu.push({
          name: item.name,
          category: category.title,
          price: item.priceXaf,
          soldOut: inventory
            ? inventory.isAvailable === 0 || Number(inventory.stock) <= 0
            : false,
        });
      }
    }
  }
  facts.menu = facts.menu.slice(0, 45);

  try {
    facts.stores = (
      await database
        .prepare(
          `
      SELECT name, town, area, address, phone FROM stores ORDER BY name
    `,
        )
        .all()
    ).map((row) => ({
      name: row.name,
      town: row.town,
      area: row.area,
      address: row.address,
      phone: row.phone,
    }));
  } catch {
    facts.stores = cameroonLocations.map((location) => ({
      name: location.name,
      town: location.town,
      area: location.area,
      address: location.address,
      phone: location.phone || "",
    }));
  }

  try {
    const now = new Date().toISOString();
    facts.discounts = (
      await database
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
        .all(now)
    ).map((row) => ({
      code: row.code,
      type: row.type,
      value: row.value,
      minimum: row.minimum,
    }));
  } catch {
    facts.discounts = [];
  }

  facts.hours = {
    open: formatClock(DEFAULT_STORE_HOURS.openMinutes),
    close: formatClock(DEFAULT_STORE_HOURS.closeMinutes),
    lastOrder: formatClock(DEFAULT_STORE_HOURS.lastOrderMinutes),
  };
  // The AI needs the live open/closed state in the shop's own time zone, so it can
  // tell a late-night customer the branches are shut but the website still takes
  // next-day orders.
  const nowParts = localClock(new Date());
  facts.now = {
    weekday: TIME_WEEKDAYS[nowParts.weekday] || "",
    clock: formatClock(nowParts.minutes),
    isOpen:
      nowParts.minutes >= DEFAULT_STORE_HOURS.openMinutes &&
      nowParts.minutes < DEFAULT_STORE_HOURS.closeMinutes,
  };
  // Full store data for the AI: every branch with its full address and map link,
  // dietary options on the menu, and the site's own pages so the model can point
  // the customer to the right page instead of describing it.
  facts.branchDetails = cameroonLocations.map((location) => ({
    town: location.town,
    area: location.area,
    address: location.address,
    phone: location.phone || "",
    map: location.source || "",
  }));
  facts.menuByCategory = {};
  for (const category of coldStoneMenuCategories) {
    facts.menuByCategory[category.title] = category.items.map((item) => ({
      name: item.name,
      price: item.priceXaf,
      detail: item.detail,
      tags: (item.dietary || []).join(","),
      soldOut:
        facts.menu.find((entry) => entry.name === item.name)?.soldOut || false,
    }));
  }
  facts.sitePages = [
    "All Menu (/menu/all) — every product on one page; this is where customers add items to the cart and place orders",
    "Menu (/menu) — the menu by category with photos",
    "Flavors (/flavors) — the flavor catalog",
    "Custom cakes (/custom-cake) — request a made-to-order cake",
    "Event orders (/events) — catering and event orders",
    "Locations (/locations) — branches, addresses and hours",
    "Contact (/contact) — write to the shop",
    "FAQ (/faq) — frequently asked questions",
    "Cart (/cart) and checkout (/checkout) — ordering and payment",
    "Track order (/track-order) — follow an order",
    "Account (/account/orders) — order history, favorites, subscriptions",
    "Privacy (/privacy), terms (/terms), refunds (/refunds), cookies (/cookies) — policies",
  ];
  factCache = facts;
  factCacheAt = Date.now();
  return facts;
}

// ---------------------------------------------------------------- LLM engine

async function generateWithModel(
  history,
  context,
  language,
  customerPage = "",
  pageSnapshot = "",
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const systemPrompt = [
      "You are the live-chat assistant of Cold Stone Creamery, an ice-cream shop in Cameroon.",
      "You write the shop's replies to customers directly.",
      "",
      "SCOPE — you know ONLY what is in SHOP FACTS below.",
      "- If a question is about the shop, the menu, prices, ordering, delivery, branches, hours, payments, policies or anything on this website: answer it using the facts.",
      "- If a question is about ANYTHING ELSE (general knowledge, news, weather, maths, other businesses, other cities, coding, health advice, jokes, the customer's personal life...): politely say you only know about Cold Stone Creamery Cameroon and its website, and invite them to ask about that. Never answer off-topic questions, not even briefly.",
      "- Use ONLY the facts given. Never invent prices, flavours, branches, discount codes, policies, opening dates or promises. If the facts do not cover something about the shop (for example a specific nutrition question or a price for a custom cake), say honestly that you do not have that information and suggest the Contact page.",
      "",
      "ORDERING — the single most important rule:",
      "- ALL orders are placed on the website. When a customer wants to order anything (a flavour, a cake, an event, delivery or pickup), ALWAYS point them to the All Menu page (/menu/all) to add items to the cart and check out. NEVER tell a customer to call a branch or visit in person to place an order — the website does that, and phone-based ordering is NOT how this shop works.",
      "- The current local time and open/closed state are given in the facts. If the customer wants to order while the shop is CLOSED, say clearly that the branches are closed right now — and immediately reassure them that they can still place the order on the website right away for next-day delivery or pickup, then point them to the All Menu page (/menu/all). Online ordering never closes.",
      "- The last order cut-off and the opening hours are for the physical branches, not for the website: the site accepts orders any time.",
      "- Point customers to the right website page when one matches their question (the pages are listed in the facts).",
      "- WHEN THE CUSTOMER ASKS WHAT PAGE THEY ARE ON ('what page is this', 'where am I', 'how do I use this page'): name the page, then explain what is on it and how to move around it — what to tap, what each section is for — in two to four sentences, from the page description given above. If a different page serves them better, say so and end with the matching [ACTION:...] line.",
      "- When pointing to a page, end the reply with an action line on its own: [ACTION:menu_all] for the All Menu page, [ACTION:custom_cake] for custom cakes, [ACTION:events] for event orders, [ACTION:locations] for branches, [ACTION:track_order] for order tracking, [ACTION:contact] for the contact page. The website turns this line into a button for the customer; the text before it must still mention the page naturally.",
      customerPage
        ? `\nTHE CUSTOMER IS CURRENTLY ON: ${customerPage}${PAGE_GUIDE_HINT(customerPage)}`
        : "",
      pageSnapshot
        ? [
            "",
            "WHAT IS ON THE CUSTOMER'S SCREEN RIGHT NOW (a text snapshot captured by the website — trust it over your guesses):",
            pageSnapshot,
            "- When the customer asks what page this is, what something on the screen is, or how to do something, use THIS snapshot: name the real headings, buttons, prices and fields it contains and tell them what to tap, in the order the page shows them.",
            "- If the snapshot is empty or unreadable, fall back to the page description above and say what you expect is there without inventing specifics.",
          ].join("\n")
        : "",
      "",
      "STYLE:",
      "- Warm, brief, two to four sentences.",
      language === "fr" ? "- Reply in French." : "- Reply in English.",
      "- Match the language the customer writes in, even if it differs from the instruction above.",
      "- Do not sign the message and do not mention being an AI.",
      "",
      "SHOP FACTS:",
      `Opening hours: daily ${context.hours.open}–${context.hours.close}; last order at branches ${context.hours.lastOrder}.`,
      `Right now it is ${context.now.weekday} ${context.now.clock} in Cameroon, so the branches are ${context.now.isOpen ? "OPEN" : "CLOSED"}. Online ordering on the website is available 24/7 regardless.`,
      `Branches: ${context.stores.map((store) => `${store.name} (${store.area})${store.phone ? ` tel ${store.phone}` : ""}`).join("; ") || "none listed"}.`,
      ...context.branchDetails.map(
        (store) =>
          `  - ${store.town} / ${store.area}: ${store.address}${store.phone ? `, tel ${store.phone}` : ""}${store.map ? `, map: ${store.map}` : ""}`,
      ),
      `Discount codes: ${context.discounts.map((code) => `${code.code} (${code.type === "percent" ? `${code.value}% off` : `${code.value} FCFA off`}${code.minimum ? `, min ${code.minimum} FCFA` : ""})`).join("; ") || "none"}.`,
      "Website pages the customer can be pointed to:",
      ...context.sitePages.map((page) => `  - ${page}`),
      "Menu grouped by category (name|price|detail|tags; SOLD OUT marked):",
      ...Object.entries(context.menuByCategory).flatMap(([category, items]) => [
        `  ${category}:`,
        ...items.map(
          (item) =>
            `    ${item.name}|${item.price}|${item.detail || "-"}|${item.tags || "-"}${item.soldOut ? "|SOLD OUT" : ""}`,
        ),
      ]),
    ].join("\n");

    const response = await fetch(
      `${(process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.AI_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.AI_MODEL,
          temperature: 0.8,
          // Reasoning models (like Groq's gpt-oss) spend part of this budget thinking
          // before they write, so a tight cap truncates the reply to a fragment or
          // nothing. The reasoning is excluded from the returned text.
          max_completion_tokens: 900,
          messages: [
            { role: "system", content: systemPrompt },
            ...history.slice(-8).map((message) => ({
              role: message.sender === "customer" ? "user" : "assistant",
              content: message.body,
            })),
          ],
        }),
      },
    );
    if (!response.ok) {
      // Surface the provider's own message so a wrong AI_BASE_URL or key shows up in the
      // server log instead of the assistant silently pretending the AI does not exist.
      const detail = await response.text().catch(() => "");
      console.error(
        `AI suggestion provider returned HTTP ${response.status}: ${detail.slice(0, 300)}`,
      );
      return null;
    }
    const data = await response.json();
    const text = (data.choices?.[0]?.message?.content || "").trim();
    if (!text) {
      console.error("AI suggestion provider returned an empty completion.");
      return null;
    }
    return text.slice(0, 1000);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ------------------------------------------------------------- rules engine

function detectTopic(text, context = {}) {
  const message = text.toLowerCase();
  const has = (...words) => words.some((word) => message.includes(word));
  // A lost-customer question outranks everything else: no matter how the message is
  // phrased, if it is about the page they are on, the answer is the page guide.
  if (isLostPageQuestion(text) && !has("how much", "combien", "open", "closed"))
    return "navigation";
  if (has("price", "cost", "how much", "prix", "coûte", "combien"))
    return "price";
  if (
    has(
      "flavor",
      "flavour",
      "menu",
      "what do you have",
      "saveur",
      "goût",
      "parfum",
    )
  )
    return "menu";
  if (
    has(
      "open",
      "close",
      "hour",
      "time",
      "ouvert",
      "ferme",
      "heure",
      "horaire",
      "ouvrira",
    )
  )
    return "hours";
  if (
    has("where", "address", "location", "branch", "où", "adresse", "boutique")
  )
    return "stores";
  if (has("deliver", "livraison", "livrer", "shipping")) return "delivery";
  if (has("discount", "promo", "code", "coupon", "réduction", "promo"))
    return "discount";
  if (has("stock", "available", "sold out", "disponible", "rupture"))
    return "stock";
  if (has("order", "track", "commande", "suivre", "statut")) return "order";
  if (has("refund", "cancel", "remboursement", "annuler")) return "refund";
  return "general";
}

function formatMoney(amount) {
  return `${new Intl.NumberFormat("en-CM").format(Math.round(amount))} FCFA`;
}

function draftFromRules(message, context, language, customerPage = "") {
  const fr = language === "fr";
  const topic = detectTopic(message, context);
  const lines = [];
  const greeting = fr ? "Bonjour !" : "Hello!";

  const menuSummary = context.menu.length
    ? `${context.menu.length} flavours and treats on the menu, from ${formatMoney(Math.min(...context.menu.map((item) => item.price)))}.`
    : fr
      ? "Notre menu complet est sur la page Menu du site."
      : "The full menu is on the Menu page of the site.";

  switch (topic) {
    case "price": {
      const named = context.menu.find((item) =>
        message
          .toLowerCase()
          .split(/\s+/)
          .some(
            (word) => word.length > 3 && item.name.toLowerCase().includes(word),
          ),
      );
      if (named) {
        lines.push(
          fr
            ? `${greeting} ${named.name} coûte ${formatMoney(named.price)}${named.soldOut ? ", mais il est en rupture de stock pour le moment" : ""}.`
            : `${greeting} ${named.name} is ${formatMoney(named.price)}${named.soldOut ? ", though it is sold out right now" : ""}.`,
        );
      } else {
        lines.push(
          fr
            ? `${greeting} ${menuSummary} Dites-moi lequel vous intéresse et je vous donne le prix exact.`
            : `${greeting} ${menuSummary} Tell me which one you are eyeing and I will give you the exact price.`,
        );
      }
      break;
    }
    case "menu":
      lines.push(
        fr
          ? `${greeting} ${menuSummary} Le menu complet avec photos est sur la page Menu — je peux aussi vous recommander selon vos goûts.`
          : `${greeting} ${menuSummary} The full menu with photos is on the Menu page — I can also recommend something for your taste.`,
      );
      break;
    case "hours":
      lines.push(
        fr
          ? `${greeting} Nous sommes ouverts tous les jours de ${context.hours.open} à ${context.hours.close}, dernière commande à ${context.hours.lastOrder}.`
          : `${greeting} We are open every day from ${context.hours.open} to ${context.hours.close}, with the last order at ${context.hours.lastOrder}.`,
      );
      break;
    case "stores":
      lines.push(
        fr
          ? `${greeting} Nous sommes à : ${context.stores.map((store) => `${store.name} (${store.area})`).join(", ")}. Lequel vous arrange ?`
          : `${greeting} You can find us at: ${context.stores.map((store) => `${store.name} (${store.area})`).join(", ")}. Which one suits you?`,
      );
      break;
    case "delivery":
      lines.push(
        fr
          ? `${greeting} Oui, nous livrons ! Commandez sur le site, choisissez la livraison et une heure ; un livreur part de la boutique la plus proche.`
          : `${greeting} Yes, we deliver! Order on the site, choose delivery and a time slot; a rider leaves from the branch closest to you.`,
      );
      break;
    case "discount":
      if (context.discounts.length) {
        lines.push(
          fr
            ? `${greeting} En ce moment : ${context.discounts.map((code) => `${code.code} — ${code.type === "percent" ? `-${code.value}%` : `-${formatMoney(code.value)}`}`).join(", ")}.`
            : `${greeting} Running right now: ${context.discounts.map((code) => `${code.code} — ${code.type === "percent" ? `${code.value}% off` : `${formatMoney(code.value)} off`}`).join(", ")}.`,
        );
      } else {
        lines.push(
          fr
            ? `${greeting} Pas de promotion active en ce moment, mais de nouvelles offres arrivent bientôt — inscrivez-vous à la newsletter !`
            : `${greeting} No active promotion right now, but new offers land soon — join the newsletter to hear first!`,
        );
      }
      break;
    case "stock": {
      const named = context.menu.find((item) =>
        message
          .toLowerCase()
          .split(/\s+/)
          .some(
            (word) => word.length > 3 && item.name.toLowerCase().includes(word),
          ),
      );
      if (named) {
        lines.push(
          named.soldOut
            ? fr
              ? `${greeting} ${named.name} est en rupture pour le moment — revenez bientôt, le réapprovisionnement est régulier !`
              : `${greeting} ${named.name} is sold out at the moment — check back soon, restocks are regular!`
            : fr
              ? `${greeting} Bonne nouvelle : ${named.name} est disponible !`
              : `${greeting} Good news: ${named.name} is available!`,
        );
      } else {
        lines.push(
          fr
            ? `${greeting} Dites-moi quel parfum vous cherchez et je vérifie le stock.`
            : `${greeting} Tell me which flavour you are after and I will check the stock.`,
        );
      }
      break;
    }
    case "order":
      lines.push(
        fr
          ? `${greeting} Je regarde votre commande — pouvez-vous me donner le numéro de commande (il commence par #) ou l'email utilisé au paiement ?`
          : `${greeting} Let me look into your order — could you share the order number (it starts with #) or the email used at checkout?`,
      );
      break;
    case "navigation": {
      // Without the AI key this is the only way a lost customer gets an answer, so
      // describe the page they are on from the same guides the AI prompt uses.
      const base = "/" + (customerPage || "/").replace(/^\//, "").split("/")[0];
      const guide = PAGE_GUIDES[customerPage] || PAGE_GUIDES[base];
      if (guide) {
        lines.push(
          fr
            ? `${greeting} Vous êtes sur ${guide}. Dites-moi ce que vous cherchez et je vous guide vers la bonne page.`
            : `${greeting} You are on ${guide}. Tell me what you are looking for and I will point you to the right page.`,
        );
      } else {
        lines.push(
          fr
            ? `${greeting} Vous êtes sur une page du site Cold Stone Creamery. Je peux vous guider vers le menu, les boutiques ou vos commandes — dites-moi ce que vous cherchez.`
            : `${greeting} You are on a page of the Cold Stone Creamery website. I can guide you to the menu, the branches or your orders — tell me what you are looking for.`,
        );
      }
      break;
    }
    case "refund":
      lines.push(
        fr
          ? `${greeting} Désolé pour ça ! Écrivez-nous via la page Contact avec votre numéro de commande sous 24h et nous arrangerons un remboursement ou un remplacement.`
          : `${greeting} Sorry about that! Message us through the Contact page with your order number within 24 hours and we will arrange a refund or a replacement.`,
      );
      break;
    default:
      lines.push(
        fr
          ? `${greeting} Merci pour votre message ! Un collègue va vous répondre très vite. En attendant, le menu complet et les boutiques sont sur le site.`
          : `${greeting} Thanks for your message! A colleague will reply very shortly. In the meantime, the full menu and branch list are on the site.`,
      );
  }
  return {
    body: lines.join(" ").slice(0, 1000),
    topic,
    confidence: topic === "general" ? "low" : "medium",
  };
}
