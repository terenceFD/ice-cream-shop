import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { apiRequest } from "../api/api";
import { useLanguage } from "../language/useLanguage";
import { useAuth } from "../context/useAuth";
import { useMobileMenuOpen } from "../lib/mobileMenu";
import { useShowFloatingWidgets } from "../lib/floatingWidgets";

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
  imageUrl?: string | null;
  sender: "customer" | "store";
  body: string;
  createdAt: string;
  /** "sent" once the server confirmed this browser's own message. */
  delivery?: "sent";
}

// The tick on a message the customer sent. It appears only after the server has stored
// the message, so it can never claim a delivery that did not happen. Two overlapping
// checks in a 16px box: the back check sits behind and to the left, the front one is
// nudged right, so the pair reads as a double tick rather than two separate marks.
function DeliveryTick() {
  return (
    <svg
      aria-hidden="true"
      className="size-4 shrink-0 text-brand-yellow"
      fill="none"
      viewBox="0 0 16 16"
    >
      <title>{"Delivered"}</title>
      <path
        d="M1 8.6 4.1 11.7 10.4 4.6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M6.2 8.6 9.3 11.7 15.6 4.6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
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
  // The launcher belongs to the page's middle: it steps aside over the hero and the
  // footer, and is available in every section between them.
  const showFloating = useShowFloatingWidgets();
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
  // Starter chips (#2): page-aware question suggestions shown before the first message.
  const [showStarters, setShowStarters] = useState(false);
  // Photo attachment (#7): a chosen file and the site path it was uploaded to.
  const [attachment, setAttachment] = useState<{ url: string; name: string } | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  // Voice input (#4): recording state and whether the browser offers speech input.
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Proactive nudge (#6): a one-time gentle bubble on slow pages.
  const [showNudge, setShowNudge] = useState(false);
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

  // The chat panel follows the launcher: when the launcher steps aside over the
  // hero or the footer, an open panel would be stranded on the screen alone, so
  // it closes too. Closing (not merely hiding) keeps the panel and its
  // sessionStorage state in step, so reopening mid-page starts where it left off.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (showFloating) {
      wasOpenRef.current = isOpen;
      return;
    }
    if (isOpen) setIsOpen(false);
  }, [showFloating, isOpen]);

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

  // Keep the newest message in view while the thread grows — but only while the
  // reader is already at the bottom. The thread is polled every few seconds, so an
  // unconditional scroll-to-bottom would yank the reader down on every poll while
  // they are reading an earlier reply; when they scroll up, scrolling is theirs.
  // Returning to the bottom (or sending a message of their own) resumes following.
  const isAtBottomRef = useRef(true);
  const stickToBottomRef = useRef(true);
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const onScroll = () => {
      const nearBottom =
        list.scrollHeight - list.scrollTop - list.clientHeight < 48;
      isAtBottomRef.current = nearBottom;
      // Scrolling up unpins the follow; reaching the bottom re-pins it. Sending
      // a message pins it too (see send()), so the reply is always in view.
      stickToBottomRef.current = nearBottom;
    };
    list.addEventListener("scroll", onScroll, { passive: true });
    return () => list.removeEventListener("scroll", onScroll);
  }, [isOpen]);
  useEffect(() => {
    const list = listRef.current;
    if (list && stickToBottomRef.current) list.scrollTop = list.scrollHeight;
  }, [messages, isAwaitingReply]);

  // Clicking an AI action button navigates; close the panel so the page is visible.
  const location = useLocation();
  const lastPath = useRef(location.pathname);
  useEffect(() => {
    if (location.pathname !== lastPath.current) {
      lastPath.current = location.pathname;
      setIsOpen(false);
    }
  }, [location.pathname]);

  // ---------------------------------------------------------------- starters (#2)
  //
  // Page-aware question suggestions: what makes sense to ask depends on where the
  // customer is. Product detail pages ask about the product; the cake and event pages
  // ask about those flows; elsewhere the everyday questions apply.
  const starterQuestions = useMemo(() => {
    if (/item=/.test(location.search)) {
      return [
        t("Tell me about this product"),
        t("What is in it?"),
        t("Do you have something similar?"),
        t("How do I order it?"),
      ];
    }
    if (location.pathname === "/custom-cake") {
      return [
        t("How does the custom cake work?"),
        t("What sizes do you offer?"),
        t("How much is the deposit?"),
        t("How far ahead should I order?"),
      ];
    }
    if (location.pathname === "/events") {
      return [
        t("How do event orders work?"),
        t("What is the minimum order?"),
        t("How much is the deposit?"),
        t("Can you deliver to a venue?"),
      ];
    }
    if (location.pathname === "/checkout") {
      return [
        t("How do I pay?"),
        t("When will my order arrive?"),
        t("Can I change my order?"),
        t("How does pickup work?"),
      ];
    }
    return [
      t("What's popular?"),
      t("Any promos today?"),
      t("Do you deliver to me?"),
      t("How do loyalty points work?"),
    ];
  }, [location.pathname, location.search, t]);

  // Starters show until the customer sends their first message of the visit.
  useEffect(() => {
    if (!isOpen) return;
    try {
      setShowStarters(
        !sessionStorage.getItem("chat-used") && messages.length === 0,
      );
    } catch {
      setShowStarters(messages.length === 0);
    }
  }, [isOpen, messages.length]);

  const useStarter = (question: string) => {
    setDraft(question);
    try {
      sessionStorage.setItem("chat-used", "1");
    } catch {
      // Storage unavailable: the starters simply show until a message is sent.
    }
    setShowStarters(false);
  };

  // ------------------------------------------------------------- voice input (#4)
  //
  // The browser's own speech recognition — no server round-trip, no extra cost.
  // Supported on Chromium browsers and Android; gracefully absent elsewhere.
  const speechSupported = useMemo(
    () =>
      typeof window !== "undefined" &&
      Boolean(
        (window as unknown as Record<string, unknown>).SpeechRecognition ||
          (window as unknown as Record<string, unknown>).webkitSpeechRecognition,
      ),
    [],
  );
  const toggleVoice = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const RecognitionCtor = (
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition
    ) as
      | (new () => {
            lang: string;
            interimResults: boolean;
            maxAlternatives: number;
            onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
            onerror: ((event: { error?: string }) => void) | null;
            onend: (() => void) | null;
            stop: () => void;
            start: () => void;
          })
      | null;
    if (!RecognitionCtor) {
      setVoiceError(t("Voice input is not supported in this browser."));
      return;
    }
    const recognition = new RecognitionCtor();
    recognition.lang = language === "fr" ? "fr-FR" : "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      if (transcript) setDraft((current) => (current ? `${current} ${transcript}` : transcript));
    };
    recognition.onerror = (event) => {
      setVoiceError(
        event.error === "not-allowed"
          ? t("Allow microphone access to use voice input.")
          : t("Voice input failed. Please try again."),
      );
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    setVoiceError("");
    setIsListening(true);
    try {
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  // ------------------------------------------------------------ photo attach (#7)
  const pickPhoto = () => fileInputRef.current?.click();

  const onPhotoChosen = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      setError(t("Photos must be smaller than 3 MB."));
      return;
    }
    setIsUploadingPhoto(true);
    setError("");
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("read failed"));
        reader.readAsDataURL(file);
      });
      const result = await apiRequest<{ image: { url: string } }>("/chat/uploads", {
        method: "POST",
        body: { dataUrl },
      });
      if (result.image?.url) {
        setAttachment({ url: result.image.url, name: file.name });
      }
    } catch {
      setError(t("The photo could not be attached. Please try again."));
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // ------------------------------------------------------------ proactive nudge (#6)
  //
  // Checkout and the custom-cake form are the two spots where a silent struggle is
  // costly. One gentle offer per session, at most once, after a short dwell — never
  // while the customer is actively typing or the chat is already open.
  useEffect(() => {
    const nudged = (() => {
      try {
        return sessionStorage.getItem("chat-nudged") === "1";
      } catch {
        return false;
      }
    })();
    const applies = location.pathname === "/checkout" || location.pathname === "/custom-cake";
    if (!applies || nudged || isOpen) return undefined;
    const timer = window.setTimeout(() => {
      try {
        if (sessionStorage.getItem("chat-nudged") === "1") return;
        sessionStorage.setItem("chat-nudged", "1");
      } catch {
        // No storage: still show once for this page view.
      }
      setShowNudge(true);
    }, 25000);
    return () => window.clearTimeout(timer);
  }, [location.pathname, isOpen]);

  const acceptNudge = () => {
    setShowNudge(false);
    setIsOpen(true);
  };

  const dismissNudge = () => setShowNudge(false);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    // A photo can travel on its own: text is optional when an image is attached.
    if ((!body && !attachment) || isSending) return;
    if (!threadIdRef.current) threadIdRef.current = readThreadId(customerId);
    // Sending a message re-pins the follow: the reply that lands next should be
    // scrolled into view even if the reader was scrolled up in the thread.
    stickToBottomRef.current = true;
    setIsSending(true);
    setError("");
    // No optimistic bubble: the message appears only once the server has it, so a
    // failed send shows an error instead of a message that never leaves — and every
    // customer bubble on screen is therefore a confirmed one, which is what earns its tick.
    try {
      const post = (threadId: string) =>
        apiRequest("/chat/messages", {
          method: "POST",
          body: {
            threadId,
            body,
            page: location.pathname,
            imageUrl: attachment?.url || "",
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
      setAttachment(null);
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
      {/* The launcher and its greeting tooltip share one hover target. The tooltip is
          desktop-only: on a touch screen there is no hover, and the message would sit
          over the page. It also stays hidden while the chat panel is open.

          It sits in the bottom corner while the hero is on screen, and slides down out
          of the viewport once the visitor scrolls into the sections below. */}
      <div
        className={`group fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] left-4 z-[65] transition-[translate,opacity] duration-300 ease-out motion-reduce:transition-none ${
          showFloating
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-[220%] opacity-0"
        }`}
      >
      <button
        aria-expanded={isOpen}
        aria-label={isOpen ? t("Close chat") : t("Chat with us")}
        className="grid size-14 place-items-center rounded-full bg-brand-navy text-brand-yellow shadow-[0_14px_36px_rgba(9,42,83,0.4)] transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow focus-visible:ring-offset-2"
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
        {!isOpen && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 left-[calc(100%+0.75rem)] w-max max-w-[19rem] origin-left scale-95 rounded-2xl rounded-bl-md bg-brand-navy px-4 py-3 text-white opacity-0 shadow-[0_16px_40px_rgba(9,42,83,0.35)] ring-1 ring-white/15 transition-all duration-200 ease-out group-hover:scale-100 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:opacity-100 max-sm:hidden"
          >
            <span
              aria-hidden="true"
              className="absolute -left-1.5 bottom-4 size-3 rotate-45 rounded-[2px] bg-brand-navy ring-1 ring-white/15 [clip-path:polygon(0_0,0_100%,100%_100%)]"
            />
            <p className="font-display text-sm font-extrabold leading-tight text-brand-yellow">
              {t("Hi")} 👋
            </p>
            <p className="mt-1 text-[13px] leading-5 text-white/85">
              {t("I am your Cold Stone assistant. I can help you with anything concerning this platform.")}
            </p>
          </div>
        )}
        {!isOpen && showNudge && (
          <div
            className="absolute bottom-[calc(100%+0.6rem)] left-0 w-64 rounded-2xl rounded-bl-md bg-white p-3 shadow-[0_16px_40px_rgba(9,42,83,0.25)] ring-1 ring-[#e2e8f0]"
            role="status"
          >
            <p className="text-[13px] font-bold text-brand-navy">
              {t("Need a hand?")}
            </p>
            <p className="mt-1 text-xs leading-5 text-[#5d7186]">
              {t("I can walk you through this. Ask me anything.")}
            </p>
            <div className="mt-2 flex gap-2">
              <button
                className="min-h-8 flex-1 rounded-full bg-brand-navy px-3 text-xs font-bold text-white transition hover:bg-brand-blue"
                onClick={acceptNudge}
                type="button"
              >
                {t("Chat with us")}
              </button>
              <button
                aria-label={t("Dismiss")}
                className="min-h-8 rounded-full px-3 text-xs font-bold text-[#65748a] transition hover:bg-[#f4f6f8]"
                onClick={dismissNudge}
                type="button"
              >
                {t("Not now")}
              </button>
            </div>
          </div>
        )}
      </div>

      {isOpen && (
        <section
          aria-label={t("Chat with us")}
          // The panel floats above the launcher: 5.25rem below (the 3.5rem launcher plus
          // its 1.5rem bottom offset and a small gap), so the launcher stays reachable with
          // the chat open. On phones it grows to 30rem tall as long as 10rem of the page
          // stays visible, so it never swallows the whole screen; from sm up it takes 38rem.
          className="site-live-chat-panel fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] left-4 z-[65] flex h-[min(30rem,calc(100dvh-10rem))] w-[min(28rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_28px_70px_rgba(9,42,83,0.32)] ring-1 ring-[#e2e8f0] sm:h-[min(38rem,calc(100dvh-7rem))] sm:w-[30rem]"
        >
          <header className="relative flex items-center gap-2.5 bg-brand-navy px-3 py-3 text-white sm:gap-3 sm:px-4 sm:py-3.5">
            <span
              aria-hidden="true"
              className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 ring-1 ring-white/15 sm:size-9"
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
              {/* The full sentence wraps to five lines on a 280px phone and pushed the
                  header to 212px, so narrow screens get a short equivalent instead. */}
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/70">
                <span aria-hidden="true" className="inline-block size-1.5 shrink-0 rounded-full bg-[#4ade80]" />
                <span className="min-[480px]:hidden">{t("Usually replies in minutes")}</span>
                <span className="hidden min-[480px]:inline">{t("We usually reply within a few minutes during opening hours.")}</span>
              </p>
            </div>
            <button
              aria-label={t("Clear chat")}
              // Hidden on the narrowest phones: two 32px buttons plus the avatar left the
              // title only ~90px wide there, so both labels cut off mid-word. Clearing a
              // thread is a rare action, and it is still reachable from 400px up.
              className="hidden size-8 shrink-0 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow min-[400px]:grid"
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
                {/* Starter questions (#2): tappable suggestions matched to the page the
                    customer is on. Tapping fills the input; the row disappears once the
                    conversation starts. */}
                {showStarters && (
                  <div className="mt-2 flex max-w-full flex-wrap justify-center gap-1.5">
                    {starterQuestions.map((question) => (
                      <button
                        className="rounded-full border border-[#dce3eb] bg-white px-3 py-1.5 text-xs font-bold text-brand-navy transition hover:border-brand-yellow hover:bg-brand-yellow/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow-deep"
                        key={question}
                        onClick={() => useStarter(question)}
                        type="button"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {messages.map((message) => {
              const isCustomer = message.sender === "customer";
              const { text: bodyText, action } = isCustomer ? { text: message.body, action: undefined } : splitChatAction(message.body);
              // A customer message only reaches this list after the server stored it, so
              // its presence IS the delivery confirmation. (The server sends no `delivery`
              // field, and an earlier version pruned its own sent-message record as soon
              // as the poll returned the message — which removed the tick it was drawing.)
              const delivered = isCustomer;
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
                    {/* A photo attached to a customer message (#7), shown under its text. */}
                    {message.imageUrl && (
                      <img
                        alt=""
                        className="mt-1.5 max-h-48 w-full rounded-xl object-cover"
                        decoding="async"
                        loading="lazy"
                        src={message.imageUrl}
                      />
                    )}
                    {action && <ChatActionButton action={action} />}
                    <p
                      className={`mt-1 flex items-center justify-end gap-1 text-[10px] font-medium ${isCustomer ? "text-white/50" : "text-[#94a3b8]"}`}
                    >
                      <span>{time(message.createdAt)}</span>
                      {delivered && <DeliveryTick />}
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
          {voiceError && (
            <p
              className="bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800"
              role="status"
            >
              {voiceError}
            </p>
          )}

          {/* Pending photo attachment (#7): a small preview chip above the input. */}
          {attachment && (
            <div className="flex items-center gap-2 border-t border-[#eef2f6] bg-white px-3 py-2">
              <img
                alt=""
                aria-hidden="true"
                className="size-9 rounded-lg object-cover"
                src={attachment.url}
              />
              <span className="min-w-0 flex-1 truncate text-xs text-[#65748a]">
                {attachment.name}
              </span>
              <button
                aria-label={t("Remove photo")}
                className="grid size-7 place-items-center rounded-full text-[#94a3b8] transition hover:bg-[#f4f6f8] hover:text-brand-navy"
                onClick={() => setAttachment(null)}
                type="button"
              >
                <svg aria-hidden="true" className="size-3.5" fill="none" viewBox="0 0 24 24">
                  <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                </svg>
              </button>
            </div>
          )}

          <form
            className="flex items-center gap-2 border-t border-[#eef2f6] bg-white p-2.5 sm:p-3"
            onSubmit={send}
          >
            {/* Photo attach (#7) and voice input (#4) sit beside the text field. */}
            <input
              accept="image/jpeg,image/png,image/webp"
              aria-hidden="true"
              className="hidden"
              onChange={onPhotoChosen}
              ref={fileInputRef}
              tabIndex={-1}
              type="file"
            />
            <button
              aria-label={t("Attach a photo")}
              className="grid size-10 shrink-0 place-items-center rounded-full text-[#65748a] transition hover:bg-[#f4f6f8] hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow-deep"
              disabled={isUploadingPhoto || isSending}
              onClick={pickPhoto}
              title={t("Attach a photo")}
              type="button"
            >
              {isUploadingPhoto ? (
                <svg aria-hidden="true" className="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" />
                  <path className="opacity-75" d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeLinecap="round" strokeWidth="2.5" />
                </svg>
              ) : (
                <svg aria-hidden="true" className="size-4.5" fill="none" viewBox="0 0 24 24">
                  <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h1L9 3.5h6L16.5 5h1A2.5 2.5 0 0 1 20 7.5v10a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-10Z" stroke="currentColor" strokeWidth="1.8" />
                  <circle cx="12" cy="12.5" r="3.25" stroke="currentColor" strokeWidth="1.8" />
                </svg>
              )}
            </button>
            {speechSupported && (
              <button
                aria-label={isListening ? t("Stop voice input") : t("Speak your message")}
                className={`grid size-10 shrink-0 place-items-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow-deep ${
                  isListening
                    ? "bg-red-50 text-red-600"
                    : "text-[#65748a] hover:bg-[#f4f6f8] hover:text-brand-navy"
                }`}
                onClick={toggleVoice}
                title={isListening ? t("Stop voice input") : t("Speak your message")}
                type="button"
              >
                <svg aria-hidden="true" className="size-4.5" fill="none" viewBox="0 0 24 24">
                  <rect height="11" rx="5.5" stroke="currentColor" strokeWidth="1.8" width="11" x="6.5" y="2.5" />
                  <path d="M12 18.5V21m-3 0h6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
                </svg>
              </button>
            )}
            <input
              aria-label={t("Your message")}
              autoComplete="off"
              className="min-w-0 flex-1 rounded-full border border-transparent bg-[#f4f6f8] px-3.5 py-2.5 text-sm font-medium text-brand-navy outline-none! transition-colors placeholder:text-[#94a3b8] focus:border-brand-yellow-deep focus:bg-white sm:px-4"
              maxLength={1000}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={t("Type a message…")}
              value={draft}
            />
            <button
              aria-label={t("Send message")}
              className={`grid size-10 shrink-0 place-items-center rounded-full transition disabled:opacity-40 ${
                (draft.trim() || attachment) && !isSending
                  ? "bg-brand-yellow text-brand-navy shadow-[0_4px_12px_rgba(255,184,77,0.4)] hover:scale-105"
                  : "bg-[#eef2f6] text-[#94a3b8]"
              }`}
              disabled={(!draft.trim() && !attachment) || isSending}
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
