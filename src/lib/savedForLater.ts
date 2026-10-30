import { apiRequest } from "../api/api";
import { getMenuItemId } from "../../shared/data";
import type { CartItem } from "../context/CartContext";

/** A product ready for addToCart/addItemsToCart, with the quantity attached. */
export type CartProductInput = Omit<CartItem, "price"> & { price?: number };

/** One product in a saved bag, in the same shape the server's saved carts store. */
export type SavedItem = { productId: string; quantity: number };

export type SavedBag = {
  id: number;
  label: string;
  createdAt?: string;
  items: SavedItem[];
};

/**
 * The live menu and flavors, each product keyed by the id the server uses.
 * Menu: "menu:<category>:<name>", flavors: "flavor:<id>".
 */
export async function loadCatalog() {
  const [menuResult, flavorResult] = await Promise.all([
    apiRequest("/menu"),
    apiRequest("/flavors"),
  ]);
  const products = new Map<string, Record<string, unknown>>();
  for (const category of menuResult?.categories || []) {
    for (const item of category.items || []) {
      const id = item.id || getMenuItemId(category.title, item.name);
      products.set(id, {
        ...item,
        id,
        itemType: item.itemType || "menu",
        categoryTitle: category.title,
      });
    }
  }
  for (const flavor of flavorResult?.flavors || []) {
    products.set(`flavor:${flavor.id}`, flavor);
  }
  return products;
}

/** Rebuild saved items as cart products; anything no longer sold is dropped. */
export function savedItemsToProducts(
  items: SavedItem[],
  products: Map<string, Record<string, unknown>>,
): CartProductInput[] {
  return items.flatMap((item) => {
    const product = products.get(item.productId);
    const quantity = Number(item.quantity);
    return product && Number.isSafeInteger(quantity) && quantity > 0
      ? [{ ...(product as unknown as CartProductInput), quantity }]
      : [];
  });
}
