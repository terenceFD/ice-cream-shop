// Retrieval for the chat assistant (#1: RAG over the shop's own data).
//
// The system prompt cannot hold every product description, allergen list and policy
// paragraph at full length — it would crowd out the reply and slow every message.
// Instead, the caller asks for the chunks relevant to the customer's message and
// only those travel into the prompt.
//
// Scoring is deliberately simple and deterministic: keyword overlap with a small
// stop-word list, weighted by the chunk's source (an exact product-name hit outranks
// a policy paragraph). No embeddings, no external service — the catalog is a few
// hundred rows, so token matching is fast, free, and fully explainable. If the shop
// grows past what keyword recall handles well, swap scoreChunk() for a vector
// search; the chunk shape stays the same.

// Words that carry no meaning for retrieval. English and French, lowercase.
const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "for",
  "with",
  "is",
  "are",
  "do",
  "does",
  "did",
  "i",
  "you",
  "we",
  "it",
  "at",
  "as",
  "be",
  "have",
  "has",
  "can",
  "what",
  "which",
  "how",
  "much",
  "many",
  "your",
  "my",
  "our",
  "le",
  "la",
  "les",
  "un",
  "une",
  "des",
  "du",
  "de",
  "et",
  "ou",
  "à",
  "au",
  "aux",
  "je",
  "tu",
  "il",
  "elle",
  "nous",
  "vous",
  "est",
  "que",
  "qui",
  "pour",
  "avec",
  "sur",
  "dans",
  "combien",
  "quel",
  "quelle",
  "comment",
]);

/**
 * Lowercase, strip accents and punctuation, and split into meaningful words.
 * Accent-stripping makes "Crème Brûlée" match "creme brulee" both ways.
 */
export function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

/**
 * Build the retrievable chunk list from the shop's live data. Called once per
 * message by the caller, which already has the shop facts loaded.
 *
 * Chunk shape: { source, title, text, keywords }.
 *  - source: "product" | "flavor" | "policy" | "branch" — weights scoring
 *  - title: the name the customer would recognise
 *  - text: what the assistant may quote
 *  - keywords: pre-tokenized terms for matching
 */
export function buildChunks({
  menu = [],
  flavors = [],
  policies = [],
  branches = [],
}) {
  const chunks = [];

  for (const item of menu) {
    chunks.push({
      source: "product",
      title: item.name,
      text: `${item.name} — ${item.category}. ${item.detail || ""} Price: ${item.price} FCFA.${
        item.soldOut ? " Currently SOLD OUT." : ""
      }${item.tags && item.tags !== "-" ? ` Dietary: ${item.tags}.` : ""}`,
      keywords: tokenize(`${item.name} ${item.category} ${item.detail || ""}`),
    });
  }

  for (const flavor of flavors) {
    chunks.push({
      source: "flavor",
      title: flavor.name,
      text: `${flavor.name} — a scoop flavor.${flavor.detail ? ` ${flavor.detail}.` : ""} Price: ${flavor.price} FCFA.${
        flavor.soldOut ? " Currently SOLD OUT." : ""
      }`,
      keywords: tokenize(`${flavor.name} ${flavor.detail || ""}`),
    });
  }

  // Policies: one chunk per leading clause so a question about "loyalty" retrieves
  // the loyalty rule and not the whole ACCOUNTS paragraph.
  for (const policy of policies) {
    const [label, ...rest] = policy.split(":");
    const body = rest.join(":").trim();
    if (!body) continue;
    chunks.push({
      source: "policy",
      title: label.trim(),
      text: `${label.trim()}: ${body}`,
      keywords: tokenize(`${label} ${body}`),
    });
  }

  for (const branch of branches) {
    chunks.push({
      source: "branch",
      title: `${branch.town} / ${branch.area}`,
      text: `${branch.town} / ${branch.area}: ${branch.address}${branch.phone ? `, tel ${branch.phone}` : ""}.`,
      keywords: tokenize(
        `${branch.town} ${branch.area} ${branch.address || ""}`,
      ),
    });
  }

  return chunks;
}

/**
 * Score one chunk against the message. Product/flavor name hits dominate: the
 * customer's words appearing in the chunk's own title is the strongest signal.
 */
export function scoreChunk(chunk, messageWords) {
  if (!messageWords.length) return 0;
  const titleWords = new Set(tokenize(chunk.title));
  const keywordSet = new Set(chunk.keywords);
  let score = 0;
  for (const word of messageWords) {
    if (titleWords.has(word)) score += 5;
    else if (keywordSet.has(word)) score += 2;
    else if (
      [...keywordSet].some(
        (keyword) => keyword.startsWith(word) && word.length > 3,
      )
    ) {
      score += 1;
    }
  }
  // A product the customer named by (part of) its name is what they are asking about.
  if (chunk.source === "product" || chunk.source === "flavor") score *= 1.2;
  return score;
}

/**
 * The top-k chunks for a customer message, best first. Empty when nothing matches
 * well enough — the caller then falls back to the static prompt facts, exactly as
 * the assistant behaved before retrieval existed.
 */
export function retrieveChunks(
  chunks,
  message,
  { limit = 6, minScore = 3 } = {},
) {
  const words = tokenize(message);
  if (!words.length) return [];
  return chunks
    .map((chunk) => ({ chunk, score: scoreChunk(chunk, words) }))
    .filter((entry) => entry.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.chunk);
}
