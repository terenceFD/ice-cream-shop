import { useContext } from "react";
import { CurrencyContext, type CurrencyContextValue } from "./CurrencyContext";

export type { CurrencyContextValue };

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context)
    throw new Error("useCurrency must be used within CurrencyProvider");
  return context;
}
