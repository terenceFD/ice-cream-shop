// What the assistant is doing while the customer waits.
//
// The auto-reply runs after the POST has already answered, and a reply that
// calls a tool ("what is the price of…", "where is my order?") can take several
// seconds. A bare typing bubble for that long reads as a stuck chat. This module
// keeps one tiny record per thread — the stage and sentence the widget shows
// under its typing dots — in memory only:
//
// - it is cosmetic, so it never touches the database;
// - it is written by the server at three moments (thinking, a tool lookup,
//   writing the answer) and read by the widget with the message poll;
// - it expires on its own, so a crashed reply can never leave a message
//   "Looking up…" forever.
//
// Stages are internal names; the widget owns the wording and the translation.

const STAGES = new Set(["thinking", "lookup", "writing"]);

/** How long a progress record is shown before the widget treats it as stale. */
export const CHAT_PROGRESS_TTL_MS = 25000;

/** threadId -> { stage, label, startedAt } */
const records = new Map();

function prune(now) {
  // Bounded work: the map only holds threads with a reply in flight.
  for (const [threadId, record] of records) {
    if (now - record.startedAt > CHAT_PROGRESS_TTL_MS) records.delete(threadId);
  }
}

/** The customer's words for a tool, trimmed so a long product name cannot flood the UI. */
export function progressLabelForTool(name, args = {}) {
  const clean = (value, max = 48) =>
    String(value ?? "")
      .replace(/[\r\n]+/g, " ")
      .trim()
      .slice(0, max);
  switch (name) {
    case "get_product":
      return clean(args?.name);
    case "get_delivery_info":
      return clean(args?.area);
    case "get_order_status": {
      const id = clean(args?.orderNumber, 12).replace(/[^\d]/g, "");
      return id ? `#${id}` : "";
    }
    case "get_active_promos":
      return "";
    default:
      return "";
  }
}

/**
 * Records what the assistant is doing on a thread. `lookup` is the tool's name
 * when a live lookup is running; the widget turns it into "Looking up X…".
 */
export function setChatProgress(threadId, stage, lookup = "") {
  if (!threadId) return;
  const now = Date.now();
  prune(now);
  const safeStage = STAGES.has(stage) ? stage : "thinking";
  records.set(threadId, {
    stage: safeStage,
    label:
      safeStage === "lookup"
        ? /^[a-z_]{3,32}$/.test(lookup)
          ? lookup
          : ""
        : "",
    startedAt: now,
  });
}

/** The thread's current stage, or null when nothing is happening (or it is stale). */
export function readChatProgress(threadId, now = Date.now()) {
  const record = records.get(threadId);
  if (!record) return null;
  if (now - record.startedAt > CHAT_PROGRESS_TTL_MS) {
    records.delete(threadId);
    return null;
  }
  return { stage: record.stage, label: record.label };
}

/** The reply landed (or gave up): the next poll must not show a stale stage. */
export function clearChatProgress(threadId) {
  if (!threadId) return;
  records.delete(threadId);
}
