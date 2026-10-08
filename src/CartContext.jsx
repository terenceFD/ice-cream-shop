import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useFlavors } from "./flavor-context/FlavorContext";

const CartContext = createContext();
const CART_STORAGE_KEY = "antixor-icy-cart";

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
      const flavor = flavors.find((entry) => entry.id === item.id);
      const savedFlavor =
        typeof item.name === "string" && Number.isFinite(item.price)
          ? item
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

  const addToCart = (flavor) => {
    setSavedItems((prev) => {
      const availableQuantity =
        flavor.availableQuantity ?? flavor.stock ?? Number.MAX_SAFE_INTEGER;
      if (availableQuantity < 1) return prev;
      const existing = prev.find((item) => item.id === flavor.id);
      if (existing) {
        if (existing.quantity >= availableQuantity) return prev;
        return prev.map((item) =>
          item.id === flavor.id
            ? { ...item, ...flavor, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [...prev, { ...flavor, quantity: 1 }];
    });
  };

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
      const flavor = flavors.find((item) => item.id === flavorId);
      const availableQuantity = flavor?.availableQuantity ?? flavor?.stock ?? 0;
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
