// How much stock is left to say out loud.
//
// "Only 3 left" is worth showing; "only 47 left" is noise that makes a shop look fake. The
// threshold falls back to the per-item low-stock level the admin sets, then to 5 units.
const FALLBACK_LOW_STOCK = 5;

export type StockSignal =
  | { kind: "sold-out" }
  | { kind: "last-few"; count: number }
  | { kind: "low"; count: number }
  | { kind: "none" };

export function stockSignal(
  availableQuantity: number | undefined,
  options: { lowStockThreshold?: number; soldOut?: boolean } = {},
): StockSignal {
  if (options.soldOut) return { kind: "sold-out" };
  if (!Number.isFinite(availableQuantity)) return { kind: "none" };
  const count = Math.max(0, Math.floor(availableQuantity as number));
  if (count < 1) return { kind: "sold-out" };
  const low =
    Number.isFinite(options.lowStockThreshold) &&
    (options.lowStockThreshold as number) > 0
      ? Math.floor(options.lowStockThreshold as number)
      : Math.min(FALLBACK_LOW_STOCK, 5);
  if (count <= 2) return { kind: "last-few", count };
  if (count <= low) return { kind: "low", count };
  return { kind: "none" };
}

/** The phrase to show for a signal, already translated. */
export function stockSignalLabel(
  signal: StockSignal,
  t: (key: string, vars?: Record<string, unknown>) => string,
) {
  if (signal.kind === "sold-out") return t("Sold out");
  if (signal.kind === "last-few")
    return t("Only {count} left — going fast", { count: signal.count });
  if (signal.kind === "low")
    return t("Only {count} left", { count: signal.count });
  return "";
}
