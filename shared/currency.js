// Currency conversion rates. XAF is the store's base currency: every price in the
// database and every order total is stored in FCFA, and the other currencies are
// display-only conversions at checkout time. Update these numbers together with
// the shop's published rates.
export const USD_TO_XAF = 540;
export const EUR_TO_XAF = 590;
// Display rates added 8 Nov 2026, rounded from the exchange-rate feed; refresh
// these alongside the shop's published rates. Orders are still charged in XAF.
export const GBP_TO_XAF = 786;
export const CAD_TO_XAF = 417;
export const INR_TO_XAF = 6.25;
export const AUD_TO_XAF = 404;
export const NGN_TO_XAF = 0.4412;

/** Currencies a visitor can switch to. XAF first because it is the shop's own. */
export const SUPPORTED_CURRENCIES = [
  { code: "xaf", symbol: "FCFA", rate: 1 },
  { code: "usd", symbol: "$", rate: 1 / USD_TO_XAF },
  { code: "eur", symbol: "€", rate: 1 / EUR_TO_XAF },
  { code: "gbp", symbol: "£", rate: 1 / GBP_TO_XAF },
  { code: "cad", symbol: "CA$", rate: 1 / CAD_TO_XAF },
  { code: "inr", symbol: "₹", rate: 1 / INR_TO_XAF },
  { code: "aud", symbol: "A$", rate: 1 / AUD_TO_XAF },
  { code: "ngn", symbol: "₦", rate: 1 / NGN_TO_XAF },
];

/** Converts an XAF amount into a display currency. Returns whole units. */
export function convertFromXaf(amountXaf, currency) {
  const entry = SUPPORTED_CURRENCIES.find((item) => item.code === currency);
  if (!entry || entry.rate === 1) return Math.round(amountXaf);
  return Math.round(amountXaf * entry.rate);
}
