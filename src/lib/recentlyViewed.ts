// Recently viewed products, remembered in the browser.
//
// A shopper comparing twenty scoops loses their trail without this. The list is local to the
// device on purpose: it is a view aid, not an account feature, and works for guests too.
export const RECENTLY_VIEWED_KEY = "cold-stone-recently-viewed";
const MAX_ENTRIES = 12;
const EVENT = "cold-stone-recently-viewed";

export type RecentView = {
  /** "flavor:12" or "menu:<item id>". */
  key: string;
  name: string;
  image: string;
  priceXaf: number;
  to: string;
  detail?: string;
  /** When the product was last opened, so the row can say "2 h ago". */
  viewedAt?: number;
  /** Set for flavors, so a card can still be rebuilt when the catalog has not loaded. */
  flavorId?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRecentView(value: unknown): value is RecentView {
  return (
    isRecord(value) &&
    typeof value.key === "string" &&
    typeof value.name === "string" &&
    typeof value.image === "string" &&
    typeof value.priceXaf === "number" &&
    typeof value.to === "string"
  );
}

// An earlier build wrote "menu:menu:…" keys; fold them back to a single prefix.
export function normalizeKey(key: string) {
  return key.replace(/^(menu:)+/, "menu:");
}

export function readRecentlyViewed(): RecentView[] {
  try {
    const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // De-duplicate after folding, keeping the most recent of any pair.
    const seen = new Set<string>();
    return parsed
      .filter(isRecentView)
      .map((entry) => ({ ...entry, key: normalizeKey(entry.key) }))
      .filter((entry) =>
        seen.has(entry.key) ? false : (seen.add(entry.key), true),
      );
  } catch {
    return [];
  }
}

/** Records a view, moving a repeat visit to the front. Returns the new list. */
export function recordRecentlyViewed(next: RecentView): RecentView[] {
  const current = readRecentlyViewed().filter(
    (entry) => entry.key !== next.key,
  );
  const stamped = { ...next, viewedAt: Date.now() };
  const updated = [stamped, ...current].slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(updated));
  } catch {
    // A full or blocked localStorage must not break the product page.
    return updated;
  }
  window.dispatchEvent(new Event(EVENT));
  return updated;
}

/** Everything except the product being looked at. */
export function recentlyViewedExcept(key: string): RecentView[] {
  return readRecentlyViewed().filter((entry) => entry.key !== key);
}

export function subscribeToRecentlyViewed(listener: () => void) {
  window.addEventListener(EVENT, listener);
  // Other tabs write to the same key.
  const onStorage = (event: StorageEvent) => {
    if (event.key === RECENTLY_VIEWED_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}
