// Currency conversion rates. XAF is the store's base currency: every price in the
// database and every order total is stored in FCFA, and the other currencies are
// display-only conversions at checkout time. Update these numbers together with
// the shop's published rates.
export const USD_TO_XAF = 540;
export const EUR_TO_XAF = 590;

/** Currencies a visitor can switch to. XAF first because it is the shop's own. */
export const SUPPORTED_CURRENCIES = [
  { code: "xaf", symbol: "FCFA", rate: 1 },
  { code: "usd", symbol: "$", rate: 1 / USD_TO_XAF },
  { code: "eur", symbol: "€", rate: 1 / EUR_TO_XAF },
];

/** Converts an XAF amount into a display currency. Returns whole units. */
export function convertFromXaf(amountXaf, currency) {
  const entry = SUPPORTED_CURRENCIES.find((item) => item.code === currency);
  if (!entry || entry.rate === 1) return Math.round(amountXaf);
  return Math.round(amountXaf * entry.rate);
}
