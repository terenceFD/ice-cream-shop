import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CartContext } from "./useCart";
import { type Flavor } from "./FlavorContext";
import { useFlavors } from "./useFlavors";
import { findMenuItem } from "../../shared/data";
import { USD_TO_XAF } from "../lib/cartPricing";

export interface CartItem {
  id: string | number;
  name: string;
  detail?: string;
  description?: string;
  image: string;
  price: number;
  priceXaf?: number;
  currency?: string;
  quantity: number;
  itemType?: string;
  categoryTitle?: string;
  stock?: number;
  reservedStock?: number;
  availableQuantity?: number;
  tag?: string;
  origin?: string;
  color?: string;
  servings?: number;
  allergies?: string[];
}

type CartProduct = Omit<CartItem, "quantity" | "price"> & {
  price?: number;
  quantity?: number;
};

export interface CartContextValue {
  cartItems: CartItem[];
  addToCart: (product: CartProduct) => boolean;
  addItemsToCart: (products: CartProduct[]) => number;
  removeFromCart: (itemId: string | number) => void;
  updateCartFlavor: (flavor: Flavor) => void;
  updateQuantity: (itemId: string | number, quantity: number) => void;
  clearCart: () => void;
  cartCount: number;
  cartTotal: number;
}

const CART_STORAGE_KEY = "cold-stone-cart";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCartProduct(item: Record<string, unknown>): item is Record<string, unknown> & CartProduct {
  return (typeof item.id === "string" || typeof item.id === "number") &&
    typeof item.name === "string" &&
    typeof item.image === "string" &&
    (item.price === undefined || typeof item.price === "number") &&
    (item.priceXaf === undefined || typeof item.priceXaf === "number") &&
    (item.quantity === undefined || typeof item.quantity === "number") &&
    (item.itemType === undefined || typeof item.itemType === "string");
}

function normalizeMenuCartItem(item: CartProduct): Omit<CartItem, "quantity"> | null {
  if (typeof item.id !== "string") return null
  const knownItem = findMenuItem(item.id)
  if (knownItem) {
    return {
      ...knownItem,
      ...item,
      itemType: "menu",
      currency: "xaf",
      price: Number(item.priceXaf ?? item.price ?? knownItem.priceXaf),
      availableQuantity: Number.isSafeInteger(item.availableQuantity)
        ? item.availableQuantity
        : Number.isSafeInteger(item.stock)
          ? Math.max(0, item.stock - (item.reservedStock || 0))
          : knownItem.availableQuantity,
    }
  }
  if (!item.id.startsWith("menu:custom:") || typeof item.name !== "string"
    || typeof item.detail !== "string" || typeof item.image !== "string"
    || !Number.isSafeInteger(item.priceXaf) || item.priceXaf < 1) {
    return null
  }
  return {
    ...item,
    itemType: "menu",
    currency: "xaf",
    price: item.priceXaf,
    availableQuantity: Number.isSafeInteger(item.availableQuantity)
      ? item.availableQuantity
      : Number.isSafeInteger(item.stock)
        ? Math.max(0, item.stock - (item.reservedStock || 0))
        : Number.MAX_SAFE_INTEGER,
  }
}

function loadCart(flavors: Flavor[]): CartItem[] {
  try {
    const savedCart = localStorage.getItem(CART_STORAGE_KEY);
    if (!savedCart) return [];

    const parsedCart: unknown = JSON.parse(savedCart);
    if (!Array.isArray(parsedCart)) {
      throw new Error("Saved cart must be an array");
    }

    return parsedCart.flatMap((value): CartItem[] => {
      if (!isRecord(value)) return [];
      const item = value;
      if (item.itemType === "menu") {
        if (!isCartProduct(item)) return [];
        const menuItem = normalizeMenuCartItem(item);
        return menuItem &&
          Number.isSafeInteger(item.quantity) &&
          (item.quantity as number) > 0
          ? [{ ...menuItem, quantity: item.quantity as number }]
          : [];
      }
      if (!isCartProduct(item) || typeof item.price !== "number" || !Number.isFinite(item.price) ||
          !Number.isSafeInteger(item.quantity) || (item.quantity as number) <= 0) return [];
      const flavor = flavors.find((entry) => entry.id === item.id);
      const quantity = item.quantity as number;
      const price = item.currency === "usd"
        ? Math.round(item.price * USD_TO_XAF)
        : item.price;
      const savedFlavor: CartItem = {
        ...item,
        id: item.id,
        name: item.name,
        image: typeof item.image === "string" ? item.image : "",
        price,
        currency: "xaf",
        quantity,
      };
      return [{ ...(flavor || savedFlavor), quantity }];
    });
  } catch (error) {
    console.error("Unable to load the saved shopping bag.", error);
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { flavors, loading, error } = useFlavors();
  const [savedItems, setSavedItems] = useState<CartItem[]>(() => loadCart([]));
  const cartItems = useMemo(() => {
    if (loading || error) return savedItems;
    return savedItems.flatMap((item) => {
      if (item.itemType === "menu") return [item];
      const flavor = flavors.find((entry) => entry.id === item.id);
      const availableQuantity = flavor?.availableQuantity ?? flavor?.stock ?? 0;
      return flavor
        ? [
            {
              ...flavor,
              quantity:
                availableQuantity > 0
                  ? Math.min(item.quantity, availableQuantity)
                  : item.quantity,
            },
          ]
        : [];
    });
  }, [error, flavors, loading, savedItems]);

  useEffect(() => {
    try {
      localStorage.setItem(
        CART_STORAGE_KEY,
        JSON.stringify(loading || error ? savedItems : cartItems),
      );
    } catch (error) {
      console.error("Unable to save the shopping bag.", error);
    }
  }, [cartItems, error, loading, savedItems]);

  const addToCart = (product: CartProduct) => {
    const item = product.itemType === "menu" ? normalizeMenuCartItem(product) : product;
    if (!item || typeof item.price !== "number") return false;
    const cartItem: CartItem = { ...item, price: item.price, quantity: 1 };
    const availableQuantity =
      item.availableQuantity ?? item.stock ?? Number.MAX_SAFE_INTEGER;
    if (availableQuantity < 1) return false;
    const existing = savedItems.find((entry) => entry.id === item.id);
    if (existing) {
      if (existing.quantity >= availableQuantity) return false;
      setSavedItems((prev) =>
        prev.map((entry) =>
          entry.id === item.id
            ? { ...cartItem, quantity: entry.quantity + 1 }
            : entry,
        ),
      );
    } else {
      setSavedItems((prev) => [...prev, cartItem]);
    }
    return true;
  };

  const addItemsToCart = (products: CartProduct[]) => {
    let addedCount = 0
    const updated = [...savedItems]
    for (const product of products) {
      const item = product.itemType === 'menu' ? normalizeMenuCartItem(product) : product
      if (!item || typeof item.price !== "number") continue
      const cartItem: CartItem = { ...item, price: item.price, quantity: 1 };
      const availableQuantity = item.availableQuantity ?? item.stock ?? Number.MAX_SAFE_INTEGER
      const currentIndex = updated.findIndex((entry) => entry.id === item.id)
      const current = currentIndex < 0 ? null : updated[currentIndex]
      const currentQuantity = current?.quantity || 0
      const quantity = Math.min(
        Number.isSafeInteger(product.quantity) ? product.quantity : 1,
        Math.max(0, availableQuantity - currentQuantity),
      )
      if (quantity < 1) continue
      addedCount += quantity
      if (current) {
        updated[currentIndex] = { ...current, ...cartItem, quantity: currentQuantity + quantity }
      } else {
        updated.push({ ...cartItem, quantity })
      }
    }
    setSavedItems(updated)
    return addedCount
  }

  const removeFromCart = (flavorId: string | number) => {
    setSavedItems((prev) => prev.filter((item) => item.id !== flavorId));
  };

  const updateCartFlavor = (flavor: Flavor) => {
    setSavedItems((prev) =>
      prev.map((item) =>
        item.id === flavor.id ? { ...item, ...flavor } : item,
      ),
    );
  };

  const updateQuantity = (flavorId: string | number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(flavorId);
    } else {
      const savedItem = savedItems.find((item) => item.id === flavorId);
      const flavor = flavors.find((item) => item.id === flavorId);
      const availableQuantity = savedItem?.itemType === "menu"
        ? savedItem.availableQuantity
        : flavor?.availableQuantity ?? flavor?.stock ?? 0;
      if (availableQuantity < 1) {
        removeFromCart(flavorId);
        return;
      }
      setSavedItems((prev) =>
        prev.map((item) =>
          item.id === flavorId
            ? { ...item, quantity: Math.min(quantity, availableQuantity) }
            : item,
        ),
      );
    }
  };

  const clearCart = useCallback(() => setSavedItems([]), []);
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        addItemsToCart,
        removeFromCart,
        updateCartFlavor,
        updateQuantity,
        clearCart,
        cartCount,
        cartTotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
