import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "../api/api";
import { useLanguage } from "../language/useLanguage";
import { useAuth } from "../context/useAuth";

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
  const [error, setError] = useState("");
  const threadIdRef = useRef<string>("");
  const listRef = useRef<HTMLDivElement>(null);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  // Opening the widget for the first time on a page re-opens it after navigation,
  // so a conversation in progress is not hidden by a route change.
  useEffect(() => {
    try {
      sessionStorage.setItem(OPEN_STORAGE_KEY, isOpen ? "1" : "0");
    } catch {
      // Ignore; the widget just starts closed next visit.
    }
  }, [isOpen]);

  const loadMessages = useCallback(async () => {
    if (!threadIdRef.current) return;
    try {
      const result = await apiRequest<{ messages: ChatMessage[] }>(
        `/chat/messages/${threadIdRef.current}`,
      );
      setMessages(result.messages || []);
      setError("");
    } catch {
      // A network hiccup should not empty the visible thread; keep what is shown.
    }
  }, []);

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
      if (isOpenRef.current) loadMessages();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [isOpen, loadMessages, customerId]);

  // Keep the newest message in view while the thread grows.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || isSending) return;
    setIsSending(true);
    setError("");
    try {
      await apiRequest("/chat/messages", {
        method: "POST",
        body: { threadId: threadIdRef.current, body },
      });
      setDraft("");
      await loadMessages();
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

  const time = (value: string) => {
    const date = new Date(value.includes("T") ? value : `${value}Z`);
    return Number.isNaN(date.getTime())
      ? ""
      : date.toLocaleTimeString(language === "fr" ? "fr-CM" : "en-CM", {
          hour: "2-digit",
          minute: "2-digit",
        });
  };

  return (
    <>
      <button
        aria-expanded={isOpen}
        aria-label={isOpen ? t("Close chat") : t("Chat with us")}
        className="fixed bottom-24 left-4 z-[65] grid size-14 place-items-center rounded-full bg-brand-navy text-brand-yellow shadow-[0_14px_36px_rgba(9,42,83,0.4)] transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow focus-visible:ring-offset-2"
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
          className="fixed bottom-44 left-4 z-[65] flex h-[26rem] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(9,42,83,0.35)] ring-1 ring-[#dce3eb]"
        >
          <header className="bg-brand-navy px-4 py-3 text-white">
            <p className="font-display text-base font-extrabold">
              {t("Chat with us")}
            </p>
            <p className="mt-0.5 text-xs text-white/70">
              {t("We usually reply within a few minutes during opening hours.")}
            </p>
          </header>

          <div
            className="flex-1 space-y-2.5 overflow-y-auto bg-[#f4f6f8] p-3"
            ref={listRef}
          >
            {messages.length === 0 && (
              <p className="rounded-xl bg-white p-3 text-center text-xs leading-5 text-[#65748a]">
                {t(
                  "Ask about flavors, cakes, delivery — anything. We are happy to help.",
                )}
              </p>
            )}
            {messages.map((message) => (
              <div
                className={`flex ${message.sender === "customer" ? "justify-end" : "justify-start"}`}
                key={message.id}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-5 ${
                    message.sender === "customer"
                      ? "rounded-br-sm bg-brand-navy text-white"
                      : "rounded-bl-sm bg-white text-brand-navy ring-1 ring-[#e5e9ee]"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">
                    {message.body}
                  </p>
                  <p
                    className={`mt-1 text-[10px] font-semibold ${message.sender === "customer" ? "text-white/60" : "text-[#8b95a2]"}`}
                  >
                    {time(message.createdAt)}
                  </p>
                </div>
              </div>
            ))}
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
            className="flex items-center gap-2 border-t border-[#e5e9ee] bg-white p-2.5"
            onSubmit={send}
          >
            <input
              aria-label={t("Your message")}
              autoComplete="off"
              className="min-w-0 flex-1 rounded-full bg-[#f4f6f8] px-4 py-2.5 text-sm font-medium text-brand-navy outline-none! focus:bg-white focus:ring-2 focus:ring-brand-yellow-deep"
              maxLength={1000}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={t("Type a message…")}
              value={draft}
            />
            <button
              aria-label={t("Send message")}
              className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-yellow text-brand-navy transition hover:bg-brand-gold-light disabled:opacity-50"
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
