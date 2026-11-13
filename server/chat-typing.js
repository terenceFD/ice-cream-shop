// "Sarah is typing…" — whether a human staff member is writing a reply right now.
//
// The admin inbox posts a beat when a staff member starts composing; the customer's
// widget picks the flag up with the message poll it already runs (1.5 s), so no new
// connection is needed. Like chat-progress, the record lives in memory only:
//
// - it is cosmetic, so it never touches the database;
// - it expires on its own, so a closed tab can never leave "typing…" forever.

/** How long the typing bubble shows before the widget treats it as stale. */
export const CHAT_TYPING_TTL_MS = 12000;

/** threadId -> { startedAt } */
const records = new Map();

function prune(now) {
  // Bounded work: the map only holds threads with a staff member typing now.
  for (const [threadId, record] of records) {
    if (now - record.startedAt > CHAT_TYPING_TTL_MS) records.delete(threadId);
  }
}

/** A staff member started (or refreshed) a typing session on a thread. */
export function setStaffTyping(threadId, now = Date.now()) {
  if (!threadId) return;
  prune(now);
  records.set(threadId, { startedAt: now });
}

/** Whether a staff member was typing on the thread recently enough to show. */
export function isStaffTyping(threadId, now = Date.now()) {
  if (!threadId) return false;
  const record = records.get(threadId);
  if (!record) return false;
  if (now - record.startedAt > CHAT_TYPING_TTL_MS) {
    records.delete(threadId);
    return false;
  }
  return true;
}

/** A staff reply landed (or the flag was revoked): the next poll must not show typing. */
export function clearStaffTyping(threadId) {
  if (!threadId) return;
  records.delete(threadId);
}
