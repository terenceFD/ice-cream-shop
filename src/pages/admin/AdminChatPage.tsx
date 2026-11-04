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
  startedAt: string;
  lastAt: string;
}

interface ChatMessage {
  id: number;
  sender: "customer" | "store";
  body: string;
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
  const [error, setError] = useState("");
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
    const interval = window.setInterval(refreshThreads, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [refreshThreads]);

  useEffect(() => {
    if (!activeThreadId) return undefined;
    loadMessages(activeThreadId);
    const interval = window.setInterval(
      () => loadMessages(activeThreadId),
      POLL_INTERVAL_MS,
    );
    return () => window.clearInterval(interval);
  }, [activeThreadId, loadMessages]);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages]);

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
                      <span className="block truncate text-sm font-bold text-brand-navy">
                        {thread.customerName || t("Unknown")}
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
