// "Find Your Flavor": three questions, then one flavor from the live catalog.
//
// The quiz runs entirely in the browser against the flavors the app already
// loaded, so it costs no request and cannot recommend something the shop does
// not sell. Allergens are a hard filter, not a score: a flavor that conflicts
// with a stated allergy is never offered, even if it would otherwise win.

// Two questions only: taste and allergies. Serving (cone or cup) is chosen at
// checkout, so asking it here would spend a tap on something that cannot change
// which flavor is recommended. Restoring it means adding a QuizServe field and a
// serving score — not just a third question.
export type QuizTaste = "fruity" | "chocolatey" | "either";

export interface QuizAnswers {
  taste: QuizTaste;
  /** Allergen labels the customer cannot eat, e.g. "dairy", "nuts". */
  avoid: string[];
}

/** The minimum a flavor needs for the quiz; the real Flavor type is wider. */
export interface QuizFlavor {
  id: number;
  name: string;
  detail?: string;
  description?: string;
  price: number;
  image: string;
  tag?: string;
  stock?: number;
  availableQuantity?: number;
  allergies?: string[];
}

// Words that mark a flavor as fruity or chocolatey. Matched against the name,
// detail, description and tag, lowercased. Kept short on purpose: a long list
// starts matching "chocolate chip cookie dough" as fruity because of "cherry".
const FRUITY =
  /\b(fruit|fruits|berry|berries|strawberry|mango|pineapple|banana|peach|apple|cherry|lemon|lime|orange|raspberry|blueberry|passion|coconut|sorbet|smoothie|tropical)\b/i;
const CHOCOLATEY =
  /\b(chocolate|chocolat|fudge|brownie|cocoa|caramel|toffee|nutella|mocha|coffee|oreo|cookie dough|peanut butter)\b/i;

// Allergen words, mirroring server/chat-offer.js so the quiz and the assistant
// agree about what "dairy" or "nuts" means. The labels are the catalog's own
// ("Tree nuts", "Peanuts", "Dairy"…); patterns are tested case-insensitively.
const ALLERGEN_PATTERNS: Record<string, RegExp> = {
  peanuts: /\b(peanuts?|arachides?)\b/i,
  nuts: /\b(tree ?nuts?|nuts|noix|almonds?|amandes?|cashews?|pecans?|pistachios?|pistaches?|hazelnuts?|noisettes?|walnuts?)\b/i,
  dairy: /\b(dairy|milk|lactose|lait)\b/i,
  gluten: /\b(gluten|wheat|ble|blé)\b/i,
  eggs: /\b(eggs?|oeufs?|œufs?)\b/i,
  soy: /\b(soy|soja)\b/i,
};

/** The allergen labels the quiz offers, in the order they are shown. */
export const QUIZ_ALLERGENS = [
  "dairy",
  "nuts",
  "peanuts",
  "gluten",
  "eggs",
  "soy",
] as const;

function haystack(flavor: QuizFlavor): string {
  return [flavor.name, flavor.detail, flavor.description, flavor.tag]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * True when the flavor lists, or reads as containing, one of the avoided allergens.
 *
 * The catalog's allergen list is the authority. The text is only a fallback for
 * flavors whose list is empty or unrecorded, so a recorded list is never
 * overridden by a word in the description.
 */
export function flavorConflicts(flavor: QuizFlavor, avoid: string[]): boolean {
  if (!avoid.length) return false;
  // "None common"/"None listed" is the catalog saying "nothing declared", not
  // a food: it must not be read as a list that rules the answer out.
  const listed = (flavor.allergies || [])
    .map((entry) => entry.trim())
    .filter((entry) => entry && !/^none\b/i.test(entry));
  const text = haystack(flavor);
  return avoid.some((label) => {
    const pattern = ALLERGEN_PATTERNS[label];
    if (!pattern) return false;
    if (listed.length) return listed.some((entry) => pattern.test(entry));
    return pattern.test(text);
  });
}

function inStock(flavor: QuizFlavor): boolean {
  const available = flavor.availableQuantity ?? flavor.stock;
  return available === undefined || available > 0;
}

function tasteScore(flavor: QuizFlavor, taste: QuizTaste): number {
  if (taste === "either") return 0;
  const text = haystack(flavor);
  const fruity = FRUITY.test(text);
  const chocolatey = CHOCOLATEY.test(text);
  if (taste === "fruity") return (fruity ? 2 : 0) - (chocolatey ? 1 : 0);
  return (chocolatey ? 2 : 0) - (fruity ? 1 : 0);
}

/**
 * The best flavor for these answers, or null when nothing is safe to offer.
 * Sold-out and allergen-conflicting flavors are removed before ranking, so the
 * result is always something the customer can actually order.
 */
export function pickFlavor(
  flavors: QuizFlavor[],
  answers: QuizAnswers,
): QuizFlavor | null {
  return matchFlavors(flavors, answers)[0] ?? null;
}

/**
 * Every flavor the answers allow, best first: in stock, no allergen conflict,
 * and the closest taste match at the front. The quiz shows the first; a customer
 * who does not fancy it can ask for another without starting over.
 */
export function matchFlavors(
  flavors: QuizFlavor[],
  answers: QuizAnswers,
): QuizFlavor[] {
  return (
    flavors
      .filter(
        (flavor) => inStock(flavor) && !flavorConflicts(flavor, answers.avoid),
      )
      .map((flavor) => ({ flavor, score: tasteScore(flavor, answers.taste) }))
      // Stable sort, so equal scores keep the catalog's own order.
      .sort((left, right) => right.score - left.score)
      .map((entry) => entry.flavor)
  );
}

/** Why the quiz could not recommend anything, for the empty state. */
export function noMatchReason(
  flavors: QuizFlavor[],
  avoid: string[] = [],
): "allergens" | "stock" | "empty" {
  if (!flavors.length) return "empty";
  const inStockFlavors = flavors.filter(inStock);
  if (!inStockFlavors.length) return "stock";
  // Something is on the shelf; it is only unusable if an allergy ruled it out.
  // With no allergy stated, say the catalog is empty rather than blame allergies.
  return avoid.length ? "allergens" : "empty";
}
