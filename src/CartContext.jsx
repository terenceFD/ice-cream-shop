import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useFlavors } from "./flavor-context/FlavorContext";
import { findMenuItem } from "./data";
import { USD_TO_XAF } from "./cartPricing";

const CartContext = createContext();
const CART_STORAGE_KEY = "antixor-icy-cart";

function normalizeMenuCartItem(item) {
  if (!item || typeof item.id !== "string") return null
  const knownItem = findMenuItem(item.id)
  if (knownItem) {
    return {
      ...knownItem,
      ...item,
      itemType: "menu",
      currency: "xaf",
      price: item.priceXaf ?? item.price ?? knownItem.priceXaf,
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

function loadCart(flavors) {
  try {
    const savedCart = localStorage.getItem(CART_STORAGE_KEY);
    if (!savedCart) return [];

    const parsedCart = JSON.parse(savedCart);
    if (!Array.isArray(parsedCart)) {
      throw new Error("Saved cart must be an array");
    }

    return parsedCart.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      if (item.itemType === "menu") {
        const menuItem = normalizeMenuCartItem(item);
        return menuItem &&
          Number.isSafeInteger(item.quantity) &&
          item.quantity > 0
          ? [{ ...menuItem, quantity: item.quantity }]
          : [];
      }
      const flavor = flavors.find((entry) => entry.id === item.id);
      const savedFlavor =
        typeof item.name === "string" && Number.isFinite(item.price)
          ? {
              ...item,
              price: (item.currency || "usd") === "usd"
                ? Math.round(item.price * USD_TO_XAF)
                : item.price,
              currency: "xaf",
            }
          : null;
      return (flavor || savedFlavor) &&
        Number.isSafeInteger(item.quantity) &&
        item.quantity > 0
        ? [{ ...(flavor || savedFlavor), quantity: item.quantity }]
        : [];
    });
  } catch (error) {
    console.error("Unable to load the saved shopping bag.", error);
    return [];
  }
}

export function CartProvider({ children }) {
  const { flavors, loading, error } = useFlavors();
  const [savedItems, setSavedItems] = useState(() => loadCart([]));
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

  const addToCart = (product) => {
    const item = product.itemType === "menu" ? normalizeMenuCartItem(product) : product;
    if (!item) return false;
    const availableQuantity =
      item.availableQuantity ?? item.stock ?? Number.MAX_SAFE_INTEGER;
    if (availableQuantity < 1) return false;
    const existing = savedItems.find((entry) => entry.id === item.id);
    if (existing) {
      if (existing.quantity >= availableQuantity) return false;
      setSavedItems((prev) =>
        prev.map((entry) =>
          entry.id === item.id
            ? { ...item, quantity: entry.quantity + 1 }
            : entry,
        ),
      );
    } else {
      setSavedItems((prev) => [...prev, { ...item, quantity: 1 }]);
    }
    return true;
  };

  const addItemsToCart = (products) => {
    let addedCount = 0
    const updated = [...savedItems]
    for (const product of products) {
      const item = product.itemType === 'menu' ? normalizeMenuCartItem(product) : product
      if (!item) continue
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
        updated[currentIndex] = { ...current, ...item, quantity: currentQuantity + quantity }
      } else {
        updated.push({ ...item, quantity })
      }
    }
    setSavedItems(updated)
    return addedCount
  }

  const removeFromCart = (flavorId) => {
    setSavedItems((prev) => prev.filter((item) => item.id !== flavorId));
  };

  const updateCartFlavor = (flavor) => {
    setSavedItems((prev) =>
      prev.map((item) =>
        item.id === flavor.id ? { ...item, ...flavor } : item,
      ),
    );
  };

  const updateQuantity = (flavorId, quantity) => {
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

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }
  return context;
}
