// A daily special, so the agent has something to offer before the customer has
// asked anything. The pick rotates through the catalog by the day of the year:
// deterministic, free, and identical on every branch of the shop for that day,
// so a customer who opens the chat tomorrow sees a different treat.

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * One in-stock, addable menu item as the day's pick. The rotation seed is days
 * since epoch in Africa/Douala (UTC+1), so "today" matches what a Cameroonian
 * customer sees. Returns null when the catalog has nothing addable today.
 */
export function dailySpecial(menuByCategory = {}) {
  const candidates = [];
  for (const items of Object.values(menuByCategory)) {
    for (const item of items || []) {
      if (item && !item.soldOut && item.addId && item.path && item.image) {
        candidates.push(item);
      }
    }
  }
  if (!candidates.length) return null;
  const now = new Date(Date.now() + 60 * 60 * 1000); // UTC+1 day boundary
  const day = Math.floor(now.getTime() / DAY_MS);
  return candidates[day % candidates.length];
}
