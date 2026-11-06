import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { apiRequest } from "../api/api";
import { useLanguage } from "../language/useLanguage";
import { useAuth } from "../context/useAuth";
import { useMobileMenuOpen } from "../lib/mobileMenu";

/**
 * Live chat bubble: a small launcher in the corner opens a thread with the store.
 * Messages are stored server-side and polled every few seconds while open — no
 * websocket infrastructure needed for a shop-scale conversation flow.
 *
 * The thread id lives in localStorage, so an anonymous visitor keeps their
 * conversation across page loads, and a signed-in customer's messages are
 * linked to their account for the admin inbox.
 */

const OPEN_STORAGE_KEY = "cold-stone-chat-open";
const POLL_INTERVAL_MS = 5000;

interface ChatMessage {
  id: number;
  sender: "customer" | "store";
  body: string;
  createdAt: string;
}

// The AI ends a reply with an action line like [ACTION:menu_all] when it wants the
// customer to jump somewhere. This renders it as a real navigation button instead
// of printing the tag.
const CHAT_ACTIONS = {
  menu_all: { path: "/menu/all", label: "Browse the full menu" },
  custom_cake: { path: "/custom-cake", label: "Request a custom cake" },
  events: { path: "/events", label: "Order for an event" },
  locations: { path: "/locations", label: "See our branches" },
  track_order: { path: "/track-order", label: "Track your order" },
  contact: { path: "/contact", label: "Contact the shop" },
} as const;

// What each page is for, in the customer's words. The AI gets this when the
// customer asks about the page they are on ("what is this page?", "where do I..."),
// so it can explain the screen and guide them around it.
const PAGE_GUIDES = {
  "/": "the home page: featured flavors, quick links to the menu, cakes and events, and the shop's trust badges",
  "/menu": "the menu page: ice-cream categories with photos; each category opens its own product list",
  "/menu/all": "the all-menu page: every product on one page with photos and prices; use the search box and the filters (category, price, diet, availability) at the top, then tap a product to see details or tap the cart icon to add it to the cart",
  "/custom-cake": "the custom-cake page: a form to request a made-to-order cake — pick size, message and date, then submit; the shop confirms by email or chat",
  "/events": "the event-orders page: catering for birthdays, offices and weddings — describe the event and get a quote",
  "/locations": "the locations page: every branch with address, hours and a map link",
  "/contact": "the contact page: a form to write to the shop; replies come by email",
  "/faq": "the FAQ page: answers to common questions about ordering, delivery and payment",
  "/cart": "the cart page: items you added, quantities, the discount-code field and the total; continue to checkout from here",
  "/checkout": "the checkout page: delivery details, pickup or delivery choice, time slot, and payment — after payment the order appears in your account and can be tracked",
  "/track-order": "the track-order page: enter your order number (or open it from your account) to see its status, from preparing to delivered",
  "/account/orders": "your account page: order history, favorites, subscriptions and your details",
  "/flavors": "the flavors page: the full flavor catalog with descriptions",
} as const;

function splitChatAction(body: string): { text: string; action?: { path: string; label: string } } {
  const match = body.match(/\[ACTION:(\w+)\]\s*$/);
  if (!match) return { text: body };
  const action = CHAT_ACTIONS[match[1] as keyof typeof CHAT_ACTIONS];
  return action
    ? { text: body.slice(0, match.index).trim(), action }
    : { text: body.replace(match[0], "").trim() };
}

// A small text snapshot of the page the customer is looking at, sent with each
// message so the assistant can describe and guide the customer around the real
// content on screen — not just the URL. Only readable text: headings, buttons,
// links, form labels and product names, capped so it stays a few hundred tokens.
function capturePageSnapshot(): string {
  try {
    const document = window.document;
    const title = document.title || "";
    const h1 = Array.from(document.querySelectorAll("h1"))
      .map((node) => node.textContent?.trim())
      .filter(Boolean)
      .slice(0, 2);
    const headings = Array.from(document.querySelectorAll("h2, h3"))
      .map((node) => node.textContent?.trim())
      .filter((text): text is string => Boolean(text) && text.length < 80)
      .slice(0, 12);
    const buttons = Array.from(document.querySelectorAll("button, a"))
      .map((node) => node.textContent?.trim())
      .filter((text): text is string => Boolean(text) && text.length > 0 && text.length < 60)
      .slice(0, 25);
    const inputs = Array.from(document.querySelectorAll("input, textarea, select"))
      .map((node) => {
        const field = node as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
        const label =
          field.getAttribute("placeholder") ||
          field.getAttribute("aria-label") ||
          field.getAttribute("name") ||
          "";
        return label.trim();
      })
      .filter(Boolean)
      .slice(0, 10);
    // Main content region when there is one, so navigation and the chat widget
    // themselves stay out of the snapshot.
    const main = document.querySelector("main") || document.body;
    const text = (main.textContent || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 800);
    const parts = [
      title && `Title: ${title}`,
      h1.length && `Heading: ${h1.join(" | ")}`,
      headings.length && `Sections: ${headings.join(", ")}`,
      buttons.length && `Buttons/links: ${buttons.join(", ")}`,
      inputs.length && `Form fields: ${inputs.join(", ")}`,
      text && `Visible text: ${text}`,
    ].filter(Boolean);
    return parts.join("\n").slice(0, 2000);
  } catch {
    // DOM quirks must never break sending a chat message.
    return "";
  }
}

// The server answers 403 when a thread belongs to another browser. apiRequest throws an
// Error carrying the status, so the widget can tell that apart from a network failure.
function isForbidden(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { status?: number }).status === 403
  );
}

function threadStorageKey(customerId: number | null): string {
  // Each signed-in customer keeps their own conversation; guests share a
  // per-browser thread. Logging in as someone else starts a fresh chat.
  return customerId
    ? `cold-stone-chat-thread-${customerId}`
    : "cold-stone-chat-thread";
}

function readThreadId(customerId: number | null): string {
  const storageKey = threadStorageKey(customerId);
  try {
    const existing = localStorage.getItem(storageKey);
    if (existing) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem(storageKey, created);
    return created;
  } catch {
    // Storage unavailable: a new thread per visit still works.
    return crypto.randomUUID();
  }
}

export function LiveChatWidget() {
  const { t, language } = useLanguage();
  const { customer } = useAuth();
  const customerId = customer?.id ?? null;
  // The hamburger drawer covers the phone screen; the launcher and panel would float on top.
  const mobileMenuOpen = useMobileMenuOpen();
  const [isOpen, setIsOpen] = useState(() => {
    try {
      return sessionStorage.getItem(OPEN_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState("");
  const threadIdRef = useRef<string>("");
  const listRef = useRef<HTMLDivElement>(null);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  // A typing bubble shows after the customer sends, until the store's reply lands.
  // It gives up after a while so a failed auto-reply never leaves a stuck bubble.
  const [isAwaitingReply, setIsAwaitingReply] = useState(false);
  const typingTimeout = useRef<number | undefined>(undefined);
  const TYPING_TIMEOUT_MS = 20000;
  // Count of store replies when the wait began. An older reply in the thread must
  // not end the wait: only a NEW one (arriving while we wait) does.
  const storeCountAtWaitStart = useRef(0);

  useEffect(() => () => window.clearTimeout(typingTimeout.current), []);

  // A new store message ends the wait; polling picks it up within a few seconds.
  useEffect(() => {
    if (!isAwaitingReply) return;
    const storeCount = messages.filter((message) => message.sender === "store").length;
    if (storeCount <= storeCountAtWaitStart.current) return;
    setIsAwaitingReply(false);
    window.clearTimeout(typingTimeout.current);
  }, [messages, isAwaitingReply]);

  // Opening the widget for the first time on a page re-opens it after navigation,
  // so a conversation in progress is not hidden by a route change.
  useEffect(() => {
    try {
      sessionStorage.setItem(OPEN_STORAGE_KEY, isOpen ? "1" : "0");
    } catch {
      // Ignore; the widget just starts closed next visit.
    }
  }, [isOpen]);

  // Abandons a thread this browser can no longer read and starts a new one. The old id
  // is dropped from storage so the next open does not retry it.
  const startFreshThread = useCallback(() => {
    try {
      localStorage.removeItem(threadStorageKey(customerId));
    } catch {
      // Storage unavailable: a new id in memory is still enough for this visit.
    }
    threadIdRef.current = crypto.randomUUID();
    try {
      localStorage.setItem(threadStorageKey(customerId), threadIdRef.current);
    } catch {
      // Ignore; the thread simply does not survive a reload.
    }
    setMessages([]);
    setError("");
  }, [customerId]);

  const loadMessages = useCallback(async (threadId = threadIdRef.current) => {
    if (!threadId) return;
    try {
      const result = await apiRequest<{ messages: ChatMessage[] }>(
        `/chat/messages/${threadId}`,
      );
      // A fresh thread may have been started while this answer was in flight.
      if (threadId !== threadIdRef.current) return;
      setMessages(result.messages || []);
      setError("");
    } catch (loadError) {
      // The thread id in this browser no longer belongs to it — the device cookie was
      // cleared, or the browser blocked it. Retrying can never succeed, so start a
      // fresh conversation instead of leaving the visitor with a dead, empty chat.
      // Only the current thread may trigger that: a late answer about an abandoned
      // thread must not throw away the new one.
      if (isForbidden(loadError) && threadId === threadIdRef.current) {
        startFreshThread();
        return;
      }
      // A network hiccup should not empty the visible thread; keep what is shown.
    }
  }, [startFreshThread]);

  // A different signed-in person gets a different storage key, so switching
  // accounts (or signing out) starts an empty chat instead of inheriting the
  // previous user's conversation.
  useEffect(() => {
    threadIdRef.current = "";
    setMessages([]);
  }, [customerId]);

  useEffect(() => {
    if (!isOpen) return undefined;
    if (!threadIdRef.current) threadIdRef.current = readThreadId(customerId);
    loadMessages();
    const interval = window.setInterval(() => {
      // A shopper who switched tabs is not reading the chat: skip the request and
      // catch up on the next tick once the tab is visible again.
      if (isOpenRef.current && document.visibilityState !== "hidden") loadMessages();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [isOpen, loadMessages, customerId]);

  // Keep the newest message in view while the thread grows.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages]);

  // Clicking an AI action button navigates; close the panel so the page is visible.
  const location = useLocation();
  const lastPath = useRef(location.pathname);
  useEffect(() => {
    if (location.pathname !== lastPath.current) {
      lastPath.current = location.pathname;
      setIsOpen(false);
    }
  }, [location.pathname]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || isSending) return;
    if (!threadIdRef.current) threadIdRef.current = readThreadId(customerId);
    setIsSending(true);
    setError("");
    try {
      const post = (threadId: string) =>
        apiRequest("/chat/messages", {
          method: "POST",
          body: {
            threadId,
            body,
            page: location.pathname,
            // A snapshot of what is actually on the screen, so the assistant can
            // answer "what is this page?" from the real content, not guesses.
            pageSnapshot: capturePageSnapshot(),
          },
        });
      try {
        await post(threadIdRef.current);
      } catch (postError) {
        // The thread belongs to a browser whose device cookie this one no longer
        // has (cookies cleared, private window, blocked cookie). The server says
        // so with a 403, which must never reach the shopper as error text: the
        // message itself is still theirs, so open a fresh thread and send it there.
        if (!isForbidden(postError)) throw postError;
        startFreshThread();
        await post(threadIdRef.current);
      }
      setDraft("");
      // The AI auto-reply takes a couple of seconds to write. Show a typing bubble
      // while the customer waits, and clear it once the reply actually arrives.
      storeCountAtWaitStart.current = messages.filter(
        (message) => message.sender === "store",
      ).length;
      setIsAwaitingReply(true);
      typingTimeout.current = window.setTimeout(() => setIsAwaitingReply(false), TYPING_TIMEOUT_MS);
      // Only show the messages of the thread the post actually landed in; sending
      // again may have moved the conversation to a new thread.
      await loadMessages(threadIdRef.current);
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : t("The message could not be sent. Please try again."),
      );
    } finally {
      setIsSending(false);
    }
  }

  // Clear the conversation: wipe the server history and start a fresh thread in
  // this browser. Available from the header so it is never more than two taps away.
  async function clearChat() {
    if (isClearing) return;
    setIsClearing(true);
    try {
      if (threadIdRef.current) {
        await apiRequest(`/chat/messages/${threadIdRef.current}`, { method: "DELETE" });
      }
      try {
        localStorage.removeItem(threadStorageKey(customerId));
      } catch {
        // Storage unavailable: a new id on next open still gives a fresh thread.
      }
      threadIdRef.current = "";
      setMessages([]);
      setIsAwaitingReply(false);
      window.clearTimeout(typingTimeout.current);
      setError("");
      threadIdRef.current = readThreadId(customerId);
    } catch {
      setError(t("The conversation could not be cleared. Please try again."));
    } finally {
      setIsClearing(false);
    }
  }

  const time = (value: string) => {
    const date = new Date(value.includes("T") ? value : `${value}Z`);
    return Number.isNaN(date.getTime())
      ? ""
      : date.toLocaleTimeString(language === "fr" ? "fr-CM" : "en-CM", {
          hour: "2-digit",
          minute: "2-digit",
        });
  };

  if (mobileMenuOpen) return null;

  return (
    <>
      <button
        aria-expanded={isOpen}
        aria-label={isOpen ? t("Close chat") : t("Chat with us")}
        className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] left-4 z-[65] grid size-14 place-items-center rounded-full bg-brand-navy text-brand-yellow shadow-[0_14px_36px_rgba(9,42,83,0.4)] transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow focus-visible:ring-offset-2"
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        {isOpen ? (
          <svg
            aria-hidden="true"
            className="size-6"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              d="m6 6 12 12M18 6 6 18"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="2"
            />
          </svg>
        ) : (
          <svg
            aria-hidden="true"
            className="size-6"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              d="M21 11.5c0 4.1-4 7.5-9 7.5-1 0-2-.1-2.9-.4L4 20l1.3-3.6C4 15.1 3 13.4 3 11.5 3 7.4 7 4 12 4s9 3.4 9 7.5Z"
              stroke="currentColor"
              strokeLinejoin="round"
              strokeWidth="1.8"
            />
          </svg>
        )}
      </button>

      {isOpen && (
        <section
          aria-label={t("Chat with us")}
          className="site-live-chat-panel fixed bottom-24 left-4 z-[65] flex h-[27rem] w-[min(23rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_28px_70px_rgba(9,42,83,0.32)] ring-1 ring-[#e2e8f0]"
        >
          <header className="relative flex items-center gap-3 bg-brand-navy px-4 py-3.5 text-white">
            <span
              aria-hidden="true"
              className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 ring-1 ring-white/15"
            >
              <svg className="size-5" fill="none" viewBox="0 0 24 24">
                <path
                  d="M21 11.5c0 4.1-4 7.5-9 7.5-1 0-2-.1-2.9-.4L4 20l1.3-3.6C4 15.1 3 13.4 3 11.5 3 7.4 7 4 12 4s9 3.4 9 7.5Z"
                  stroke="currentColor"
                  strokeLinejoin="round"
                  strokeWidth="1.6"
                />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-[15px] font-extrabold leading-tight">
                {t("Chat with us")}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/70">
                <span aria-hidden="true" className="inline-block size-1.5 rounded-full bg-[#4ade80]" />
                {t("We usually reply within a few minutes during opening hours.")}
              </p>
            </div>
            <button
              aria-label={t("Clear chat")}
              className="grid size-8 shrink-0 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow"
              onClick={clearChat}
              title={t("Clear chat")}
              type="button"
            >
              {isClearing ? (
                <svg aria-hidden="true" className="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" />
                  <path className="opacity-75" d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeLinecap="round" strokeWidth="2.5" />
                </svg>
              ) : (
                <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
                  <path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                </svg>
              )}
            </button>
            <button
              aria-label={t("Close chat")}
              className="grid size-8 shrink-0 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow"
              onClick={() => setIsOpen(false)}
              type="button"
            >
              <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
                <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
              </svg>
            </button>
          </header>

          <div
            className="flex-1 space-y-2.5 overflow-y-auto bg-[#f7f9fb] px-3.5 py-4"
            ref={listRef}
          >
            {messages.length === 0 && (
              <div className="mt-4 flex flex-col items-center gap-2 text-center">
                <span
                  aria-hidden="true"
                  className="grid size-12 place-items-center rounded-full bg-white text-brand-navy shadow-[0_4px_14px_rgba(9,42,83,0.08)]"
                >
                  <svg className="size-6" fill="none" viewBox="0 0 24 24">
                    <path
                      d="M21 11.5c0 4.1-4 7.5-9 7.5-1 0-2-.1-2.9-.4L4 20l1.3-3.6C4 15.1 3 13.4 3 11.5 3 7.4 7 4 12 4s9 3.4 9 7.5Z"
                      stroke="currentColor"
                      strokeLinejoin="round"
                      strokeWidth="1.6"
                    />
                  </svg>
                </span>
                <p className="max-w-[15rem] text-sm leading-6 text-[#5d7186]">
                  {t(
                    "Ask about flavors, cakes, delivery — anything. We are happy to help.",
                  )}
                </p>
              </div>
            )}
            {messages.map((message) => {
              const isCustomer = message.sender === "customer";
              const { text: bodyText, action } = isCustomer ? { text: message.body, action: undefined } : splitChatAction(message.body);
              return (
                <div
                  className={`site-chat-bubble flex ${isCustomer ? "justify-end" : "justify-start"}`}
                  key={message.id}
                >
                  <div
                    className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${
                      isCustomer
                        ? "rounded-br-md bg-brand-navy text-white"
                        : "rounded-bl-md bg-white text-brand-navy shadow-[0_1px_3px_rgba(9,42,83,0.08)]"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">
                      {bodyText}
                    </p>
                    {action && <ChatActionButton action={action} />}
                    <p
                      className={`mt-1 text-right text-[10px] font-medium ${isCustomer ? "text-white/50" : "text-[#94a3b8]"}`}
                    >
                      {time(message.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
            {isAwaitingReply && (
              <div className="site-chat-typing flex justify-start" aria-hidden="true">
                <span className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-[0_1px_3px_rgba(9,42,83,0.08)]">
                  <span className="size-2 rounded-full bg-[#9fb0c3] [animation:chat-typing-dot_1.2s_ease-in-out_infinite]" />
                  <span className="size-2 rounded-full bg-[#9fb0c3] [animation:chat-typing-dot_1.2s_ease-in-out_0.2s_infinite]" />
                  <span className="size-2 rounded-full bg-[#9fb0c3] [animation:chat-typing-dot_1.2s_ease-in-out_0.4s_infinite]" />
                </span>
              </div>
            )}
          </div>

          {error && (
            <p
              className="bg-red-50 px-4 py-2 text-xs font-semibold text-red-700"
              role="alert"
            >
              {error}
            </p>
          )}

          <form
            className="flex items-center gap-2 border-t border-[#eef2f6] bg-white p-3"
            onSubmit={send}
          >
            <input
              aria-label={t("Your message")}
              autoComplete="off"
              className="min-w-0 flex-1 rounded-full border border-transparent bg-[#f4f6f8] px-4 py-2.5 text-sm font-medium text-brand-navy outline-none! transition-colors placeholder:text-[#94a3b8] focus:border-brand-yellow-deep focus:bg-white"
              maxLength={1000}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={t("Type a message…")}
              value={draft}
            />
            <button
              aria-label={t("Send message")}
              className={`grid size-10 shrink-0 place-items-center rounded-full transition disabled:opacity-40 ${
                draft.trim() && !isSending
                  ? "bg-brand-yellow text-brand-navy shadow-[0_4px_12px_rgba(255,184,77,0.4)] hover:scale-105"
                  : "bg-[#eef2f6] text-[#94a3b8]"
              }`}
              disabled={!draft.trim() || isSending}
              type="submit"
            >
              <svg
                aria-hidden="true"
                className="size-4"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  d="M4 12h15m0 0-6-6m6 6-6 6"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            </button>
          </form>
        </section>
      )}
    </>
  );
}

// The button an AI reply can carry (from its [ACTION:...] line): a full-width,
// thumb-friendly jump to the page the customer needs, e.g. the All Menu page.
function ChatActionButton({ action }: { action: { path: string; label: string } }) {
  const { t } = useLanguage();
  return (
    <Link
      className="mt-2.5 flex items-center justify-center gap-2 rounded-full bg-brand-yellow px-4 py-2.5 text-sm font-extrabold text-brand-navy transition hover:bg-brand-gold-light hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
      onClick={() => window.dispatchEvent(new CustomEvent("chat:navigate"))}
      to={action.path}
    >
      {t(action.label)}
      <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
        <path d="M4 12h15m0 0-6-6m6 6-6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      </svg>
    </Link>
  );
}
