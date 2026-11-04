import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { SUPPORTED_CURRENCIES } from "../../shared/currency.js";

export type CurrencyCode = "xaf" | "usd" | "eur";

const CURRENCY_STORAGE_KEY = "cold-stone-currency";

export interface CurrencyContextValue {
  /** The display currency chosen by the visitor. Orders are always charged in XAF. */
  currency: CurrencyCode;
  setCurrency: (currency: CurrencyCode) => void;
  /** Rates and symbols for the picker UI. */
  supported: typeof SUPPORTED_CURRENCIES;
}

export const CurrencyContext = createContext<CurrencyContextValue | null>(null);

function readInitialCurrency(): CurrencyCode {
  try {
    const saved = localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (saved === "xaf" || saved === "usd" || saved === "eur") return saved;
  } catch {
    // Storage unavailable; fall back to the shop currency.
  }
  return "xaf";
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<CurrencyCode>(readInitialCurrency);

  useEffect(() => {
    try {
      localStorage.setItem(CURRENCY_STORAGE_KEY, currency);
    } catch {
      // Without storage the choice simply resets next visit.
    }
  }, [currency]);

  return (
    <CurrencyContext.Provider
      value={{ currency, setCurrency, supported: SUPPORTED_CURRENCIES }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context)
    throw new Error("useCurrency must be used within CurrencyProvider");
  return context;
}
