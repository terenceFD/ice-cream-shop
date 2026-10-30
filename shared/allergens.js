// Allergens for the built-in menu, by category.
//
// Cold Stone's mix-ins make an exact per-item list impossible from the catalog text alone, so
// this records what each category is known to contain. Anything a category cannot vouch for
// is left out, and the product page then asks the customer to check with the store rather than
// reassuring them. Staff can override any single item from the admin inventory screen.
export const categoryAllergens = {
  // Everything here starts from a dairy ice cream base; most contain wheat (cake, cookie,
  // brownie) and many contain soy (fudge, chocolate chips).
  "Ice Cream": ["Dairy", "Soy"],
  // Cakes and pies: ice cream layers, cake, cookie crumbs and pastry bases.
  "Cakes & Pies": ["Dairy", "Gluten", "Wheat", "Eggs", "Soy"],
  // The sorbet is dairy-free, but the Silk dessert is made with almondmilk.
  "Silk & Sorbet": ["Dairy", "Tree nuts", "Almonds"],
  // Shakes are blended with milk; smoothies are fruit only, so only the category floor is set.
  "Milkshakes & Smoothies": ["Dairy"],
  // Cupcakes and cookie sandwiches: dairy ice cream, cookies and cake.
  Novelties: ["Dairy", "Gluten", "Wheat", "Eggs", "Soy"],
  "Limited-Time Favorites": ["Dairy", "Soy"],
};

/** The allergen list for a built-in item, or null when the category says nothing useful. */
// Items inside a category that genuinely differ, so the category default would be wrong for
// them. A sorbet is dairy-free; a fruit smoothie has no milk. Keyed by the product name.
export const itemAllergens = {
  Sorbet: [],
  "Silk Chocolate Almondmilk Frozen Dessert": ["Tree nuts", "Almonds"],
  "Don’t Cry Over Spilled Silk": ["Tree nuts", "Almonds"],
  "Don't Cry Over Spilled Silk": ["Tree nuts", "Almonds"],
  "Strawberry Banana Smoothie": [],
  "Blueberry Banana Smoothie": [],
  "Pineapple Blueberry Smoothie": [],
  "Mango Pineapple Smoothie": [],
  "Strawberry Mango Smoothie": [],
};

/**
 * The allergens for a built-in item. A per-item entry wins, then the category default.
 * Returns null when nothing is known, so the page can say so instead of reassuring.
 */
export function allergensForItem(categoryTitle, itemName) {
  if (Object.prototype.hasOwnProperty.call(itemAllergens, itemName)) {
    return itemAllergens[itemName];
  }
  const list = categoryAllergens[categoryTitle];
  return Array.isArray(list) && list.length ? list : null;
}

export function allergensForCategory(categoryTitle) {
  const list = categoryAllergens[categoryTitle];
  return Array.isArray(list) && list.length ? list : null;
}
