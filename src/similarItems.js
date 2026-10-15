// Picks "similar" items: same group first (menu category or flavor label), then shared
// ingredients in the name and description (mint, strawberry, peanut butter, cake…).
// Used by the menu's "Similar products" and the flavor page's related flavors.

const COMMON_WORDS = new Set([
  "with", "and", "the", "ice", "cream", "topped", "layers", "layer", "between", "served",
  "into", "your", "from", "pieces", "piece", "finished", "wrapped", "frosted", "whipped",
  "topping", "drizzle", "swirl", "swirls", "real", "every", "scoop", "sweet", "fresh",
]);

export function keywordsOf(...texts) {
  const words = texts.join(" ").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").match(/[a-z]+/g) || [];
  return new Set(words
    .map((word) => (word.length > 4 && word.endsWith("s") ? word.slice(0, -1) : word))
    .filter((word) => word.length > 2 && !COMMON_WORDS.has(word)));
}

/**
 * Orders candidates by similarity to the target. Candidates are { key, group, text } plus any
 * data the caller needs back; ties keep the order of the list, starting after the target, so
 * neighbouring items differ from one product to the next.
 */
export function rankSimilar(target, candidates, limit) {
  const targetWords = keywordsOf(target.text);
  const start = Math.max(0, candidates.findIndex((candidate) => candidate.key === target.key));
  const rotated = [...candidates.slice(start + 1), ...candidates.slice(0, start)];
  return rotated
    .filter((candidate) => candidate.key !== target.key)
    .map((candidate, order) => {
      let shared = 0;
      for (const word of keywordsOf(candidate.text)) if (targetWords.has(word)) shared += 1;
      return { candidate, order, score: (candidate.group === target.group ? 3 : 0) + Math.min(shared, 4) };
    })
    .sort((first, second) => second.score - first.score || first.order - second.order)
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}
