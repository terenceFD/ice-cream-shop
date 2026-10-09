export { USD_TO_XAF } from "../shared/currency.js";

export function getCartPricing(items) {
  const currency = "xaf";
  const pricedItems = items.map((item) => ({
    itemType: item.itemType,
    quantity: item.quantity,
    unitPrice: Math.round(Number(item.price)),
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

export function formatCartMoney(amount, _currency = "xaf", language = "en") {
  const formattedAmount = new Intl.NumberFormat(
    language === "fr" ? "fr-CM" : "en-CM",
  ).format(Math.round(amount));
  return `${formattedAmount} FCFA`;
}
