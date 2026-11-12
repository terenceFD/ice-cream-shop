// "What will it be?": three quick questions, then one item from the live menu.
//
// Same contract as the flavor quiz (src/lib/flavorQuiz.ts): it runs entirely in
// the browser against the menu the app already loaded, so it costs no request
// and cannot recommend something the shop does not sell. Allergens are a hard
// filter, never a score. The difference is what it ranks: the menu spans whole
// categories (ice cream, cakes, shakes, novelty treats), so the questions ask
// what kind of treat and how many people, not which flavor family.
//
// The catalog it ranks is built by menuQuizCatalog() below from the live
// `/api/menu` payload, which includes admin-added items: every menu item the
// shop sells is a candidate, not just the built-in ones.

import { allergensForItem, categoryAllergens } from "../../shared/allergens.js";

/** What kind of treat the customer is after. Every category maps to exactly one. */
export type MenuKind = "scoop" | "share" | "sip" | "grab" | "any";

/** How many people it is for. `any` keeps cakes in play without ranking them up. */
export type MenuCrowd = "just" | "share" | "any";

export interface MenuQuizAnswers {
  kind: MenuKind;
  crowd: MenuCrowd;
  /** Allergen labels the customer cannot eat, e.g. "dairy", "tree nuts". */
  avoid: string[];
}

/**
 * One menu item as the quiz sees it. The live payload carries most of this;
 * `menuQuizCatalog()` fills the rest in so the quiz never depends on a field
 * the server happened to omit.
 */
export interface QuizMenuItem {
  id: string;
  name: string;
  category: string;
  detail?: string;
  price: number;
  image: string;
  /** Allergens as recorded for this item, or the category's known ones. */
  allergens: string[];
  inStock: boolean;
  /** How many people the item is meant for, where the category says so. */
  serves: "one" | "few" | "many";
  path?: string;
}

// Words that mark what a menu item really is. The category alone is too coarse:
// "Ice Cream" holds both a single scoop and a pie you share, and the menu lists
// shakes and cones beside it.
//
// Read the item's FORM before its flavor: "Cake Batter Sprinkle Sandwich" is a
// sandwich, not a cake, and "Chocolate Cake Batter Ice Cream" is a scoop. So
// forms are tested on the name alone, and the flavor words that name a cake
// ("birthday cake", "layer cake") are only consulted when no form matched.
const SHARE_FORM = /\b(?:cake|cakes|pies?|torte|gateau|gâteau)\b/i;
const SHARE_FLAVOR = /\b(birthday|celebrations?|party|layers)\b/i;
const SIP = /\b(shake|shakes|smoothie|smoothies|drink|milkshake|sip)\b/i;
const GRAB =
  /\b(cupcake|cupcakes|sandwich|sandwiches|novelt|pre-?packed|pint|pints|take-?away|mix & go|mochi)\b/i;
const SCOOP =
  /\b(cone|cones|cup|cups|scoop|scoops|sundae|sundaes|creation|creations|mix-?in|bowl|frozen dessert|ice cream)\b/i;

// Allergen words and the labels they cover. The catalog records "Dairy",
// "Tree nuts", "Almonds", "Peanuts"… so each pattern covers the family; a
// menu item listing "Almonds" must be caught by "Tree nuts" and vice versa.
const ALLERGEN_PATTERNS: Record<string, RegExp> = {
  peanuts: /\b(peanuts?|arachides?)\b/i,
  nuts: /\b(tree ?nuts?|nuts|noix|almonds?|amandes?|cashews?|pecans?|pistachios?|pistaches?|hazelnuts?|noisettes?|walnuts?)\b/i,
  dairy: /\b(dairy|milk|lactose|lait)\b/i,
  gluten: /\b(gluten|wheat|ble|blé)\b/i,
  eggs: /\b(eggs?|oeufs?|œufs?)\b/i,
  soy: /\b(soy|soja)\b/i,
};

/** The allergen labels the quiz offers, in the order they are shown. */
export const MENU_QUIZ_ALLERGENS = [
  "dairy",
  "nuts",
  "peanuts",
  "gluten",
  "eggs",
  "soy",
] as const;

export type MenuQuizAllergen = (typeof MENU_QUIZ_ALLERGENS)[number];

/** The kind a menu item belongs to, from its words before its category. */
export function menuKindOf(
  item: Pick<QuizMenuItem, "name" | "detail" | "category">,
): Exclude<MenuKind, "any"> {
  const text = `${item.name} ${item.detail || ""}`;
  // Forms first, on the name: a flavor word must never decide the form.
  if (SIP.test(text)) return "sip";
  if (GRAB.test(item.name)) return "grab";
  if (SHARE_FORM.test(item.name)) return "share";
  if (SCOOP.test(item.name)) return "scoop";
  // A flavor-only name ("Happy Birthday Cake" has its form; "Neapolitan" does
  // not) falls back to a cake-sounding detail, then to the category.
  if (SHARE_FORM.test(text) || SHARE_FLAVOR.test(text)) return "share";
  if (GRAB.test(text)) return "grab";
  if (SCOOP.test(text)) return "scoop";
  // Fall back to the category, so an item with a wordless name still lands right.
  if (/cake|pie/i.test(item.category)) return "share";
  if (/shake|smoothie/i.test(item.category)) return "sip";
  if (/novelt/i.test(item.category)) return "grab";
  return "scoop";
}

/**
 * True when the item is not safe for one of the avoided allergens.
 *
 * The recorded list is the authority. Unrecorded items are not assumed safe —
 * the menu's own page says "check with the store" there — but neither are they
 * silently dropped: only a recorded conflict rules an item out.
 */
export function menuItemConflicts(
  item: QuizMenuItem,
  avoid: string[],
): boolean {
  if (!avoid.length) return false;
  // "None common"/"None listed" is the catalog saying "nothing declared".
  const listed = item.allergens
    .map((entry) => entry.trim())
    .filter((entry) => entry && !/^none\b/i.test(entry));
  if (!listed.length) return false;
  return avoid.some((label) => {
    const pattern = ALLERGEN_PATTERNS[label];
    if (!pattern) return false;
    return listed.some((entry) => pattern.test(entry));
  });
}

function kindScore(item: QuizMenuItem, kind: MenuKind): number {
  if (kind === "any") return 0;
  return menuKindOf(item) === kind ? 2 : 0;
}

function crowdScore(item: QuizMenuItem, crowd: MenuCrowd): number {
  if (crowd === "any") return 0;
  const wantsShare = crowd === "share";
  if (wantsShare)
    return item.serves === "many" ? 2 : item.serves === "few" ? 0 : -1;
  // "Just me": a party cake is not a single serving, but it is not wrong either.
  return item.serves === "one" ? 2 : item.serves === "few" ? 1 : 0;
}

/**
 * Every item the answers allow, best first: in stock, no allergen conflict, and
 * the closest match on kind then crowd at the front. Ties keep the menu's own
 * order, so the catalog decides among equals.
 */
export function matchMenuItems(
  items: QuizMenuItem[],
  answers: MenuQuizAnswers,
): QuizMenuItem[] {
  return items
    .filter((item) => item.inStock && !menuItemConflicts(item, answers.avoid))
    .map((item) => ({
      item,
      score:
        kindScore(item, answers.kind) * 2 + crowdScore(item, answers.crowd),
    }))
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.item);
}

/** The best menu item for these answers, or null when nothing is safe to offer. */
export function pickMenuItem(
  items: QuizMenuItem[],
  answers: MenuQuizAnswers,
): QuizMenuItem | null {
  return matchMenuItems(items, answers)[0] ?? null;
}

/** Why the quiz could not recommend anything, for the empty state. */
export function menuNoMatchReason(
  items: QuizMenuItem[],
  avoid: string[] = [],
): "allergens" | "stock" | "empty" {
  if (!items.length) return "empty";
  if (!items.some((item) => item.inStock)) return "stock";
  return avoid.length ? "allergens" : "empty";
}

// ---------------------------------------------------------------- the catalog

/** Only the parts of a live menu payload the quiz reads. */
interface LiveMenuCategory {
  title?: string;
  image?: string;
  items?: Array<Record<string, unknown>>;
}

function textField(item: Record<string, unknown>, key: string): string {
  const value = item[key];
  return typeof value === "string" ? value : "";
}

function numberField(item: Record<string, unknown>, key: string): number {
  const value = item[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Turn the live `/api/menu` payload into quiz items.
 *
 * The catalog endpoint already resolves all of this per item — id, live price,
 * `availableQuantity`, `isAvailable` and the recorded `allergens` — so the quiz
 * reads it straight off the item and only fills in what can be missing:
 * allergens nobody recorded fall back to the built-in per-item list and then the
 * category's known ones (the same order the product page uses).
 */
export function menuQuizCatalog(
  categories: LiveMenuCategory[] = [],
): QuizMenuItem[] {
  const items: QuizMenuItem[] = [];
  for (const category of categories) {
    const title = String(category.title || "");
    const fallbackImage =
      typeof category.image === "string" ? category.image : "";
    for (const raw of category.items || []) {
      const name = textField(raw, "name");
      if (!name) continue;
      // The server sends null when nobody has checked this item — distinct from
      // an empty list — so it must not be spread or read as a breadcrumb.
      const recorded =
        Array.isArray(raw.allergens) && raw.allergens.length
          ? (raw.allergens as string[])
          : allergensForItem(title, name) || categoryAllergens[title] || [];
      // availableQuantity is stock minus reservations; fall back to raw stock.
      const stock =
        numberField(raw, "availableQuantity") || numberField(raw, "stock");
      items.push({
        id: textField(raw, "id") || `menu:${title}:${name}`,
        name,
        category: title,
        detail: textField(raw, "detail"),
        price: numberField(raw, "priceXaf") || numberField(raw, "price"),
        image: textField(raw, "image") || fallbackImage,
        allergens: [...recorded],
        // An explicit "not available" or an empty shelf means sold out; a missing
        // reading keeps the item in play rather than hiding the whole menu.
        inStock: raw.isAvailable === false ? false : stock === 0 ? false : true,
        serves: /cake|pie/i.test(title) ? "many" : "one",
      });
    }
  }
  return items;
}
