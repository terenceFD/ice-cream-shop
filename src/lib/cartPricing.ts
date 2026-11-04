import { toNumber } from "../../shared/numbers.ts";
import { convertFromXaf } from "../../shared/currency.js";

export { USD_TO_XAF } from "../../shared/currency.js";
export {
  toNumber,
  toInt,
  toNonNegativeInt,
  toPositiveInt,
  toRoundedNumber,
  toFixedNumber,
  toIntString,
} from "../../shared/numbers.ts";

export interface CartPricingItem {
  itemType?: string
  quantity: number
  price: number
}

export interface CartPricing {
  cartCount: number
  currency: 'xaf'
  subtotal: number
  freeScoops: number
  discount: number
  total: number
}

export function getCartPricing(items: CartPricingItem[]): CartPricing {
  const currency = "xaf";
  const pricedItems = items.map((item) => ({
    itemType: item.itemType,
    quantity: item.quantity,
    unitPrice: Math.round(toNumber(item.price, 0)),
  }));
  const flavorItems = pricedItems.filter((item) => item.itemType !== "menu");
  const cartCount = pricedItems.reduce((sum, item) => sum + item.quantity, 0);
  const flavorCount = flavorItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotalUnits = pricedItems.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );

  const freeScoops = Math.floor(flavorCount / 3);
  let remainingFreeScoops = freeScoops;
  let discountUnits = 0;
  for (const item of [...flavorItems].sort((a, b) => a.unitPrice - b.unitPrice)) {
    const freeFromFlavor = Math.min(remainingFreeScoops, item.quantity);
    remainingFreeScoops -= freeFromFlavor;
    discountUnits += freeFromFlavor * item.unitPrice;
  }

  return {
    cartCount,
    currency,
    subtotal: subtotalUnits,
    freeScoops,
    discount: discountUnits,
    total: subtotalUnits - discountUnits,
  };
}

// Creating a number formatter is slow, and pages format dozens of prices on every render, so
// each locale's formatter is made once and reused.
const numberFormatters = new Map<string, Intl.NumberFormat>();
export function numberFormatter(locale: string): Intl.NumberFormat {
  let formatter = numberFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale);
    numberFormatters.set(locale, formatter);
  }
  return formatter;
}

export function formatCartMoney(amount: number, _currency = "xaf", language = "en", displayCurrency = "xaf"): string {
  const amountXaf = Math.round(amount);
  if (displayCurrency === "usd" || displayCurrency === "eur") {
    const converted = convertFromXaf(amountXaf, displayCurrency);
    const symbol = displayCurrency === "usd" ? "$" : "€";
    return `${symbol}${numberFormatter(language === "fr" ? "fr-CM" : "en-CM").format(converted)}`;
  }
  return `${numberFormatter(language === "fr" ? "fr-CM" : "en-CM").format(amountXaf)} FCFA`;
}

/** Formats an amount stored in cents of XAF in the visitor's chosen display currency. */
export function formatOrderMoney(amountCents: number, language = "en", displayCurrency = "xaf"): string {
  return formatCartMoney((Number(amountCents) || 0) / 100, "xaf", language, displayCurrency);
}
