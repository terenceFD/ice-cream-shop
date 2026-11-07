import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "../../api/api";
import { useAdminAuth } from "./useAdminAuth";
import { AdminIcon, AdminPageHeader } from "./AdminPageHeader";
import { adminIcons } from "./adminIcons";
import { useLanguage } from "../../language/useLanguage";

/**
 * Live chat inbox for the admin desk. Threads appear with the newest message
 * first; opening one loads its full history and marks the customer's messages
 * read. Replies poll every few seconds while a thread is open, mirroring the
 * storefront widget.
 */

interface ChatThread {
  threadId: string;
  customerName: string | null;
  messageCount: number;
  unreadCount: number;
  needsAttention?: number;
  startedAt: string;
  lastAt: string;
}

interface ChatMessage {
  id: number;
  sender: "customer" | "store";
  body: string;
  imageUrl?: string | null;
  needsAttention?: number;
  createdAt: string;
}

const POLL_INTERVAL_MS = 5000;

export function AdminChatPage() {
  const { sessionToken } = useAdminAuth();
  const request = useCallback(
    (path: string, options: Record<string, unknown> = {}) =>
      apiRequest(path, { ...options, token: sessionToken }),
    [sessionToken],
  );
  const { t, language } = useLanguage();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  // Handoff flag (#10): clearing the "needs attention" banner.
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [error, setError] = useState("");
  const [suggestionNote, setSuggestionNote] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const refreshThreads = useCallback(async () => {
    try {
      const result = await request("/admin/chat/threads");
      setThreads(result.threads || []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : t("Chat threads could not be loaded."),
      );
    }
  }, [request, t]);

  const loadMessages = useCallback(
    async (threadId: string) => {
      if (!threadId) return;
      try {
        const result = await request(`/admin/chat/threads/${threadId}`);
        setMessages(result.messages || []);
        setError("");
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : t("The conversation could not be loaded."),
        );
      }
    },
    [request, t],
  );

  useEffect(() => {
    refreshThreads();
    // New shopper messages arrive while the inbox is open; refresh the list quietly.
    // A hidden tab polls nothing — staff often leave this dashboard open all day.
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      refreshThreads();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [refreshThreads]);

  useEffect(() => {
    if (!activeThreadId) return undefined;
    loadMessages(activeThreadId);
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      loadMessages(activeThreadId);
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [activeThreadId, loadMessages]);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages]);

  // Clear the AI's handoff flag (#10): staff have seen the thread and handled it.
  async function acknowledgeFlag() {
    if (!activeThreadId || isAcknowledging) return;
    setIsAcknowledging(true);
    try {
      await request(`/admin/chat/threads/${activeThreadId}/acknowledge`, {
        method: "POST",
      });
      setMessages((current) =>
        current.map((message) => ({ ...message, needsAttention: 0 })),
      );
      await refreshThreads();
    } catch (ackError) {
      setError(
        ackError instanceof Error
          ? ackError.message
          : t("The flag could not be cleared."),
      );
    } finally {
      setIsAcknowledging(false);
    }
  }

  // The AI answers directly: draft a reply to the latest customer message and send it
  // with the normal reply path, with no review step. If the model fails, fall back to
  // the rule-based draft — it is grounded in the shop's data, so it is still safe to send.
  async function suggestAndSend() {
    if (!activeThreadId || isSuggesting) return;
    setIsSuggesting(true);
    setError("");
    setSuggestionNote("");
    try {
      const result = await request(`/admin/chat/threads/${activeThreadId}/suggest`, {
        method: "POST",
        body: { language },
      });
      if (result.suggestion) {
        await request(`/admin/chat/threads/${activeThreadId}/reply`, {
          method: "POST",
          body: { body: result.suggestion },
        });
      }
      // The server reports why the model was not used. A template answer must never look
      // like the AI's own words, so say plainly that a fallback draft was sent instead.
      const failure = result.aiFailure as { reason?: string; detail?: string } | null;
      if (failure?.reason && failure.reason !== "not-configured") {
        setSuggestionNote(
          t("The AI could not be reached ({{reason}}), so a standard reply was sent. Check it before the customer reads it.", {
            reason: failure.reason,
          }),
        );
      }
      await loadMessages(activeThreadId);
      await refreshThreads();
    } catch (suggestError) {
      setError(
        suggestError instanceof Error
          ? suggestError.message
          : t("The suggestion could not be drafted."),
      );
    } finally {
      setIsSuggesting(false);
    }
  }

  async function reply(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || isSending || !activeThreadId) return;
    setIsSending(true);
    setError("");
    try {
      await request(`/admin/chat/threads/${activeThreadId}/reply`, {
        method: "POST",
        body: { body },
      });
      setDraft("");
      setSuggestionNote("");
      await loadMessages(activeThreadId);
      await refreshThreads();
    } catch (replyError) {
      setError(
        replyError instanceof Error
          ? replyError.message
          : t("The reply could not be sent."),
      );
    } finally {
      setIsSending(false);
    }
  }

  // Clear the open conversation entirely: the thread's messages are wiped on the
  // server, which removes it from the inbox list. The customer sees an empty chat.
  async function clearThread() {
    if (!activeThreadId || isClearing) return;
    setIsClearing(true);
    setError("");
    try {
      await request(`/admin/chat/threads/${activeThreadId}`, { method: "DELETE" });
      setMessages([]);
      setActiveThreadId(null);
      await refreshThreads();
    } catch (clearError) {
      setError(
        clearError instanceof Error
          ? clearError.message
          : t("The conversation could not be cleared."),
      );
    } finally {
      setIsClearing(false);
    }
  }

  const time = (value: string) => {
    const date = new Date(value.includes("T") ? value : `${value}Z`);
    return Number.isNaN(date.getTime())
      ? ""
      : date.toLocaleString(language === "fr" ? "fr-CM" : "en-CM", {
          dateStyle: "short",
          timeStyle: "short",
        });
  };

  return (
    <div className="min-w-0 space-y-4">
      <AdminPageHeader
        description={t(
          "Answer shoppers in real time. Unread conversations float to the top.",
        )}
        section={t("Sales")}
        title={t("Live chat")}
        actions={null}
        t={t}
      />
      {error && (
        <p
          className="rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700"
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-md border border-[#dce3eb] bg-white">
          <div className="border-b border-[#f4f6f8] px-4 py-3">
            <p className="text-sm font-semibold text-brand-navy">
              {t("Conversations")}
            </p>
          </div>
          <ul className="max-h-[32rem] divide-y divide-[#f4f6f8] overflow-y-auto">
            {threads.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-[#65748a]">
                {t("No conversations yet.")}
              </li>
            )}
            {threads.map((thread) => {
              const selected = thread.threadId === activeThreadId;
              return (
                <li key={thread.threadId}>
                  <button
                    className={`flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors ${selected ? "bg-[#f4f6f8]" : "hover:bg-[#f4f6f8]"}`}
                    onClick={() => setActiveThreadId(thread.threadId)}
                    type="button"
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        {/* Handoff flag (#10): the AI paged the team about this thread. */}
                        {thread.needsAttention ? (
                          <span
                            className="size-2 shrink-0 rounded-full bg-red-500"
                            title={t("The assistant flagged this conversation for the team")}
                          />
                        ) : null}
                        <span className="block truncate text-sm font-bold text-brand-navy">
                          {thread.customerName || t("Unknown")}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs text-[#65748a]">
                        {time(thread.lastAt)} ·{" "}
                        {t("{count} messages", { count: thread.messageCount })}
                      </span>
                    </span>
                    {thread.unreadCount > 0 && (
                      <span className="shrink-0 rounded-full bg-brand-yellow px-2 py-0.5 text-xs font-extrabold text-brand-navy">
                        {thread.unreadCount}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex min-h-[32rem] flex-col overflow-hidden rounded-md border border-[#dce3eb] bg-white">
          {!activeThreadId ? (
            <p className="m-auto max-w-sm px-6 text-center text-sm leading-6 text-[#65748a]">
              {t("Select a conversation to read it and reply.")}
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-[#e5e9ee] bg-white px-4 py-2.5">
                <p className="min-w-0 flex items-center gap-2 truncate text-sm font-bold text-brand-navy">
                  {threads.find((thread) => thread.threadId === activeThreadId)?.customerName || t("Conversation")}
                  {/* Handoff banner marker (#10): flagged by the assistant. */}
                  {messages.some((message) => message.needsAttention) && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-extrabold text-red-700 ring-1 ring-red-200">
                      {t("Needs attention")}
                    </span>
                  )}
                </p>
                <div className="flex shrink-0 items-center gap-2">
                  {messages.some((message) => message.needsAttention) && (
                    <button
                      className="inline-flex min-h-9 items-center rounded-full border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                      disabled={isAcknowledging}
                      onClick={acknowledgeFlag}
                      title={t("Mark this conversation as handled")}
                      type="button"
                    >
                      {t("Mark handled")}
                    </button>
                  )}
                <button
                  aria-label={t("Clear this conversation")}
                  className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-[#dce3eb] px-3 text-xs font-bold text-[#65748a] transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                  disabled={isClearing}
                  onClick={clearThread}
                  title={t("Clear this conversation")}
                  type="button"
                >
                  {isClearing ? (
                    <svg aria-hidden="true" className="size-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" />
                      <path className="opacity-75" d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeLinecap="round" strokeWidth="2.5" />
                    </svg>
                  ) : (
                    <svg aria-hidden="true" className="size-3.5" fill="none" viewBox="0 0 24 24">
                      <path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                    </svg>
                  )}
                  {t("Clear")}
                </button>
                </div>
              </div>
              <div
                className="flex-1 space-y-3 overflow-y-auto bg-[#f4f6f8] p-4"
                ref={listRef}
              >
                {messages.map((message) => (
                  <div
                    className={`flex ${message.sender === "store" ? "justify-end" : "justify-start"}`}
                    key={message.id}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-6 ${
                        message.sender === "store"
                          ? "rounded-br-sm bg-brand-navy text-white"
                          : "rounded-bl-sm bg-white text-brand-navy ring-1 ring-[#e5e9ee]"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">
                        {message.body}
                      </p>
                      {/* Customer photo attachment (#7), visible to staff. */}
                      {message.imageUrl && (
                        <a
                          className="mt-1.5 block"
                          href={message.imageUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <img
                            alt=""
                            className="max-h-48 w-full rounded-xl object-cover"
                            decoding="async"
                            loading="lazy"
                            src={message.imageUrl}
                          />
                        </a>
                      )}
                      <p
                        className={`mt-1 text-[10px] font-semibold ${message.sender === "store" ? "text-white/60" : "text-[#8b95a2]"}`}
                      >
                        {message.sender === "store" ? t("You") : t("Customer")}{" "}
                        · {time(message.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {suggestionNote && (
                <p className="border-t border-[#e5e9ee] bg-[#f0faf3] px-4 py-2 text-xs font-semibold text-[#1f8f4e]" role="status">
                  {suggestionNote}
                </p>
              )}
              <form
                className="flex items-center gap-2 border-t border-[#e5e9ee] p-3"
                onSubmit={reply}
              >
                <input
                  aria-label={t("Reply")}
                  autoComplete="off"
                  className="min-w-0 flex-1 rounded-full bg-[#f4f6f8] px-4 py-2.5 text-sm font-medium text-brand-navy outline-none! focus:bg-white focus:ring-2 focus:ring-brand-yellow-deep"
                  maxLength={1000}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={t("Type a reply…")}
                  value={draft}
                />
                <button
                  aria-label={t("Reply instantly with AI")}
                  className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-[#dce3eb] bg-white px-3 text-sm font-bold text-brand-navy transition hover:bg-[#f4f6f8] disabled:opacity-50"
                  disabled={isSuggesting}
                  onClick={suggestAndSend}
                  title={t("Reply instantly with AI")}
                  type="button"
                >
                  {isSuggesting ? (
                    <svg aria-hidden="true" className="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" />
                      <path className="opacity-75" d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeLinecap="round" strokeWidth="2.5" />
                    </svg>
                  ) : (
                    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
                      <path d="M12 3v4m0 10v4m-9-9h4m10 0h4M5.6 5.6l2.8 2.8m7.2 7.2 2.8 2.8m0-12.8-2.8 2.8m-7.2 7.2-2.8 2.8" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                    </svg>
                  )}
                  <span className="hidden sm:inline">{t("Send with AI")}</span>
                </button>
                <button
                  className="inline-flex min-h-10 items-center gap-2 rounded-full bg-brand-navy px-4 text-sm font-bold text-white transition hover:bg-brand-blue disabled:opacity-50"
                  disabled={!draft.trim() || isSending}
                  type="submit"
                >
                  <AdminIcon path={adminIcons.plus} className="size-4" />
                  {t("Send")}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
