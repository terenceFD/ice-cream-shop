import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { apiRequest } from "../api/api";
import { useLanguage } from "../language/useLanguage";
import { useAuth } from "../context/useAuth";
import { useCart } from "../context/useCart";
import type { CartProduct } from "../context/CartContext";
import { useFlavors } from "../context/useFlavors";
import { findMenuItem } from "../../shared/data";
import { useMobileMenuOpen } from "../lib/mobileMenu";
import { useShowFloatingWidgets } from "../lib/floatingWidgets";
import { prepareImageForUpload } from "../lib/prepareUploadImage";

// Live chat bubble: a corner launcher opens a thread with the store. Messages
// live server-side and the widget polls while open; the thread id stays in
// localStorage so a guest keeps their conversation, and a signed-in customer's
// messages link to their account for the admin inbox.

const OPEN_STORAGE_KEY = "cold-stone-chat-open";
const POLL_INTERVAL_MS = 1500;

interface ChatMessage {
  id: number;
  imageUrl?: string | null;
  isHuman?: number;
  needsAttention?: number;
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
function ChatMark({ className = "size-6" }: { className?: string }) {
  const maskId = useId().replace(/:/g, "");
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24">
      <mask id={maskId}>
        <path
          d="M12 2.15c5.45 0 9.85 3.72 9.85 8.3 0 4.58-4.4 8.3-9.85 8.3-.82 0-1.61-.08-2.36-.24a.7.7 0 0 0-.48.07l-3.15 1.55a.72.72 0 0 1-1.02-.8l.68-2.55a.72.72 0 0 0-.21-.7A7.78 7.78 0 0 1 2.15 10.45C2.15 5.87 6.55 2.15 12 2.15Z"
          fill="white"
        />
        <circle cx="8.2" cy="10.45" fill="black" r="1.05" />
        <circle cx="12" cy="10.45" fill="black" r="1.05" />
        <circle cx="15.8" cy="10.45" fill="black" r="1.05" />
      </mask>
      <rect
        fill="currentColor"
        height="24"
        mask={`url(#${maskId})`}
        width="24"
      />
    </svg>
  );
}

function ChatTrashIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24">
      <path
        d="M9.1 2.5h5.8c.66 0 1.2.54 1.2 1.2V5h4.15a1.15 1.15 0 1 1 0 2.3H3.75a1.15 1.15 0 1 1 0-2.3H7.9V3.7c0-.66.54-1.2 1.2-1.2zM6.55 8.7h10.9l-.72 10.15a1.85 1.85 0 0 1-1.84 1.72H9.11a1.85 1.85 0 0 1-1.84-1.72L6.55 8.7zM10.15 11.35a.95.95 0 0 1 .95.95v4.7a.95.95 0 1 1-1.9 0v-4.7a.95.95 0 0 1 .95-.95zm3.7 0a.95.95 0 0 1 .95.95v4.7a.95.95 0 1 1-1.9 0v-4.7a.95.95 0 0 1 .95-.95z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  );
}

function ChatCloseIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <rect
        height="16.4"
        rx="2.05"
        transform="rotate(45 12 12)"
        width="4.1"
        x="9.95"
        y="3.8"
      />
      <rect
        height="16.4"
        rx="2.05"
        transform="rotate(-45 12 12)"
        width="4.1"
        x="9.95"
        y="3.8"
      />
    </svg>
  );
}

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
  "/menu":
    "the menu page: ice-cream categories with photos; each category opens its own product list",
  "/menu/all":
    "the all-menu page: every product on one page with photos and prices; use the search box and the filters (category, price, diet, availability) at the top, then tap a product to see details or tap the cart icon to add it to the cart",
  "/custom-cake":
    "the custom-cake page: a form to request a made-to-order cake — pick size, message and date, then submit; the shop confirms by email or chat",
  "/events":
    "the event-orders page: catering for birthdays, offices and weddings — describe the event and get a quote",
  "/locations":
    "the locations page: every branch with address, hours and a map link",
  "/contact":
    "the contact page: a form to write to the shop; replies come by email",
  "/faq":
    "the FAQ page: answers to common questions about ordering, delivery and payment",
  "/cart":
    "the cart page: items you added, quantities, the discount-code field and the total; continue to checkout from here",
  "/checkout":
    "the checkout page: delivery details, pickup or delivery choice, time slot, and payment — after payment the order appears in your account and can be tracked",
  "/track-order":
    "the track-order page: enter your order number (or open it from your account) to see its status, from preparing to delivered",
  "/account/orders":
    "your account page: order history, favorites, subscriptions and your details",
  "/flavors": "the flavors page: the full flavor catalog with descriptions",
} as const;

// A product answer ends with [LINK:/menu?category=…&item=…] or [LINK:/flavor/12].
// Only those two shapes become a button. Anything else is dropped so a reply
// cannot turn into an off-site link.
function safeProductPath(raw: string): string | null {
  if (
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    raw.includes("\\") ||
    raw.includes("..")
  )
    return null;
  let url: URL;
  try {
    url = new URL(raw, "https://shop.local");
  } catch {
    return null;
  }
  if (url.origin !== "https://shop.local") return null;
  if (url.pathname === "/menu") {
    const category = url.searchParams.get("category")?.trim() || "";
    const item = url.searchParams.get("item")?.trim() || "";
    if (!category || !item || category.length > 80 || item.length > 120)
      return null;
    return `/menu?${new URLSearchParams({ category, item }).toString()}`;
  }
  if (/^\/flavor\/\d{1,8}$/.test(url.pathname) && url.search === "")
    return url.pathname;
  if (
    /^\/treat\/[a-z0-9-]+\/[a-z0-9-]+$/.test(url.pathname) &&
    url.search === ""
  )
    return url.pathname;
  return null;
}

function safeAddId(raw: string): string | null {
  return /^(?:menu:[a-z0-9-]+:[a-z0-9-]+|flavor:\d{1,8})$/.test(raw)
    ? raw
    : null;
}

/** A bag edit from an agent reply: clear everything, or set one addId to a quantity. */
interface BagEdit {
  mode: "clear" | "set";
  addId?: string;
  quantity?: number;
}

/** A pickup or delivery the agent already chose, carried to checkout. */
interface ChatVisit {
  type: "pickup" | "delivery";
  location?: string;
  date?: string;
  slotId?: string;
}

function parseBagTag(raw: string): BagEdit | undefined {
  const value = raw.trim();
  if (value.toLowerCase() === "clear") return { mode: "clear" };
  const match = /^(?:set:)?(.+?)\*(\d{1,2})$/i.exec(value);
  if (!match) return undefined;
  const addId = safeAddId(match[1].trim());
  const quantity = Number(match[2]);
  if (!addId || quantity < 0 || quantity > 40) return undefined;
  return { mode: "set", addId, quantity };
}

/**
 * True when the customer's message just before a reply asked for an add — an
 * explicit "add it to my bag" — so the reply's [ADD:] tag is applied
 * automatically instead of waiting for a button tap. A price question ("how
 * much is the Chocolate Devotion?") does not qualify: there the button stays
 * a button, because the customer asked about the product, not to buy it.
 */
function asksForAutoAdd(message: string): boolean {
  return /\b(?:add(?: it| that| this| the)?(?: to (?:my |the )?(?:bag|cart))?|i(?:'ll| will| would like|'d like| want| take)|je (?:veux|prends)|ajoute|mettez?)(?:\b|(?=[\s,.!?]))/i.test(
    message,
  );
}

function parseVisitTag(raw: string): ChatVisit | undefined {
  const [type, location, date, slotId] = raw
    .split("|")
    .map((part) => part.trim());
  if (type !== "pickup" && type !== "delivery") return undefined;
  // The location comes from the branch list ("Douala — Bonanjo"), so any letter,
  // digit, space or punctuation except the pipe is accepted — the checkout
  // matches it against its own zone list, so an odd value simply stays unused.
  return {
    type,
    location:
      location && /^[^|\[\]]{1,80}$/.test(location) ? location : undefined,
    date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined,
    slotId: slotId && /^\d{1,8}$/.test(slotId) ? slotId : undefined,
  };
}

function splitChatAction(body: string): {
  text: string;
  action?: { path: string; label: string };
  addId?: string;
  fill?: { id: string; quantity: number }[];
  bag?: BagEdit;
  visit?: ChatVisit;
  code?: string;
  chips?: string[];
} {
  let text = body.trim();
  let action: { path: string; label: string } | undefined;
  let addId: string | undefined;
  let fill: { id: string; quantity: number }[] | undefined;
  let bag: BagEdit | undefined;
  let visit: ChatVisit | undefined;
  let code: string | undefined;
  let chips: string[] | undefined;
  for (let guard = 0; guard < 8; guard += 1) {
    const linkMatch = text.match(/\[LINK:(\/[^\]]+)\]\s*$/);
    const addMatch = text.match(/\[ADD:([^\]]+)\]\s*$/);
    const fillMatch = text.match(/\[FILL:([^\]]+)\]\s*$/);
    const pageMatch = text.match(/\[ACTION:(\w+)\]\s*$/);
    const bagMatch = text.match(/\[BAG:(clear|set:[^\]]+)\]\s*$/i);
    const visitMatch = text.match(/\[VISIT:([^\]]+)\]\s*$/i);
    const codeMatch = text.match(/\[CODE:([^\]]+)\]\s*$/i);
    const chipsMatch = text.match(/\[CHIPS:([^\]]+)\]\s*$/i);
    if (linkMatch) {
      const path = safeProductPath(linkMatch[1].trim());
      if (path) action = { path, label: "Open this product" };
      text = text.slice(0, linkMatch.index).trim();
      continue;
    }
    if (addMatch) {
      const id = safeAddId(addMatch[1].trim());
      if (id) addId = id;
      text = text.slice(0, addMatch.index).trim();
      continue;
    }
    if (fillMatch) {
      const items = fillMatch[1].split(",").flatMap((part) => {
        const match = part
          .trim()
          .match(/^(menu:[a-z0-9-]+:[a-z0-9-]+|flavor:\d{1,8})\*(\d{1,2})$/);
        if (!match) return [];
        const quantity = Number(match[2]);
        if (quantity < 1 || quantity > 40) return [];
        return [{ id: match[1], quantity }];
      });
      if (items.length) fill = items;
      text = text.slice(0, fillMatch.index).trim();
      continue;
    }
    if (bagMatch) {
      bag = parseBagTag(bagMatch[1]);
      text = text.slice(0, bagMatch.index).trim();
      continue;
    }
    if (visitMatch) {
      visit = parseVisitTag(visitMatch[1]);
      text = text.slice(0, visitMatch.index).trim();
      continue;
    }
    if (codeMatch) {
      const candidate = codeMatch[1].trim();
      // A code is a short token, never a sentence: anything longer or with
      // spaces is not something the checkout field would accept.
      if (/^[A-Z0-9_-]{2,24}$/i.test(candidate)) code = candidate.toUpperCase();
      text = text.slice(0, codeMatch.index).trim();
      continue;
    }
    if (chipsMatch) {
      chips = chipsMatch[1]
        .split("|")
        .map((chip) => chip.trim())
        .filter((chip) => chip && chip.length <= 48)
        .slice(0, 3);
      text = text.slice(0, chipsMatch.index).trim();
      continue;
    }
    if (pageMatch && !action) {
      const page = CHAT_ACTIONS[pageMatch[1] as keyof typeof CHAT_ACTIONS];
      if (page) action = page;
      text = text.slice(0, pageMatch.index).trim();
      continue;
    }
    if (pageMatch) {
      text = text.slice(0, pageMatch.index).trim();
      continue;
    }
    break;
  }
  return { text, action, addId, fill, bag, visit, code, chips };
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
      .filter(
        (text): text is string =>
          Boolean(text) && text.length > 0 && text.length < 60,
      )
      .slice(0, 25);
    const inputs = Array.from(
      document.querySelectorAll("input, textarea, select"),
    )
      .map((node) => {
        const field = node as
          HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
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

/** Words the customer should hear. Buttons and markup stay on screen, not in the voice. */
function spokenReplyText(body: string) {
  return body
    .replace(
      /\s*\[(?:LINK|ADD|ACTION|FILL|BAG|VISIT|CODE|CHIPS):[^\]]*\]/gi,
      " ",
    )
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
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
  const { cartItems } = useCart();
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
  // Panel mount/visibility split: `panelVisible` keeps the panel in the DOM for the
  // 200 ms zoom-out after close; `panelShown` flips one frame after mount so the
  // browser paints the small scale first and transitions to full size on open.
  const [panelVisible, setPanelVisible] = useState(false);
  const [panelShown, setPanelShown] = useState(false);
  // True for the first cascade after open; new poll messages never re-cascade.
  const [panelJustOpened, setPanelJustOpened] = useState(false);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isRequestingHuman, setIsRequestingHuman] = useState(false);
  const [error, setError] = useState("");
  // Starter chips (#2): page-aware question suggestions shown before the first message.
  const [showStarters, setShowStarters] = useState(false);
  // Photo attachment (#7): a chosen file and the site path it was uploaded to.
  const [attachment, setAttachment] = useState<{
    url: string;
    name: string;
  } | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  // Voice input (#4): recording state and whether the browser offers speech input.
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const recognitionRef = useRef<{ stop: () => void; start: () => void } | null>(
    null,
  );
  // True until the customer taps the mic off. Chrome ends a session after a short
  // pause even while someone is still talking; the session is started again until
  // this is cleared. holdVoiceRef pauses that restart while the agent is speaking.
  const wantVoiceRef = useRef(false);
  const holdVoiceRef = useRef(false);
  const voicePrefixRef = useRef("");
  const voiceDraftRef = useRef("");
  const voicePauseTimerRef = useRef<number | undefined>(undefined);
  const submitVoiceRef = useRef<(text: string) => void>(() => {});
  const voiceConversationRef = useRef(false);
  const spokenStoreIdsRef = useRef(new Set<number>());
  const speakTokenRef = useRef<object | null>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Proactive nudge (#6): a one-time gentle bubble on slow pages.
  const [showNudge, setShowNudge] = useState(false);
  const threadIdRef = useRef<string>("");
  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  // A typing bubble shows after the customer sends, until the store's reply lands.
  // It gives up after a while so a failed auto-reply never leaves a stuck bubble.
  const [isAwaitingReply, setIsAwaitingReply] = useState(false);
  const typingTimeout = useRef<number | undefined>(undefined);
  const TYPING_TIMEOUT_MS = 14000;
  // Count of store replies when the wait began. An older reply in the thread must
  // not end the wait: only a NEW one (arriving while we wait) does.
  const storeCountAtWaitStart = useRef(0);

  useEffect(() => () => window.clearTimeout(typingTimeout.current), []);

  // A new store message ends the wait; polling picks it up within a few seconds.
  useEffect(() => {
    if (!isAwaitingReply) return;
    const storeCount = messages.filter(
      (message) => message.sender === "store",
    ).length;
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

  // Open: mount (panelVisible) then show on the next frame (panelShown), so the
  // browser paints the small scale and transitions to full size. Close: drop
  // panelShown so the zoom-out plays, then remove after the 200 ms duration.
  useEffect(() => {
    if (isOpen) {
      setPanelVisible(true);
      setPanelJustOpened(true);
      const frame = requestAnimationFrame(() => setPanelShown(true));
      return () => cancelAnimationFrame(frame);
    }
    setPanelShown(false);
    setPanelJustOpened(false);
    const timer = setTimeout(() => setPanelVisible(false), 200);
    return () => clearTimeout(timer);
  }, [isOpen]);

  // On a phone the open chat covers the screen. Lock page scroll, and shrink the
  // panel to the visible viewport so the composer stays above the keyboard.
  useEffect(() => {
    if (!isOpen) return undefined;
    const mobileQuery = window.matchMedia("(max-width: 639px)");
    const root = document.documentElement;
    const { body } = document;
    const previousHtmlOverflow = root.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    const viewport = window.visualViewport;

    const lockScroll = () => {
      if (!mobileQuery.matches) {
        root.style.overflow = previousHtmlOverflow;
        body.style.overflow = previousBodyOverflow;
        return;
      }
      root.style.overflow = "hidden";
      body.style.overflow = "hidden";
    };

    const fitToVisibleScreen = () => {
      const panel = panelRef.current;
      if (!panel) return;
      if (!mobileQuery.matches || !viewport) {
        panel.style.top = "";
        panel.style.bottom = "";
        panel.style.height = "";
        return;
      }
      panel.style.top = `${viewport.offsetTop}px`;
      panel.style.bottom = "auto";
      panel.style.height = `${viewport.height}px`;
    };

    lockScroll();
    fitToVisibleScreen();
    mobileQuery.addEventListener("change", lockScroll);
    mobileQuery.addEventListener("change", fitToVisibleScreen);
    viewport?.addEventListener("resize", fitToVisibleScreen);
    viewport?.addEventListener("scroll", fitToVisibleScreen);

    return () => {
      mobileQuery.removeEventListener("change", lockScroll);
      mobileQuery.removeEventListener("change", fitToVisibleScreen);
      viewport?.removeEventListener("resize", fitToVisibleScreen);
      viewport?.removeEventListener("scroll", fitToVisibleScreen);
      root.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
      const panel = panelRef.current;
      if (panel) {
        panel.style.top = "";
        panel.style.bottom = "";
        panel.style.height = "";
      }
    };
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

  const loadMessages = useCallback(
    async (threadId = threadIdRef.current) => {
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
    },
    [startFreshThread],
  );

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
      if (isOpenRef.current && document.visibilityState !== "hidden")
        loadMessages();
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
    // Smooth so each new bubble slides up with its entrance animation instead of snapping.
    if (list && stickToBottomRef.current)
      list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
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

  const applyStarter = (question: string) => {
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
    if (isListening || wantVoiceRef.current) {
      wantVoiceRef.current = false;
      holdVoiceRef.current = false;
      voiceConversationRef.current = false;
      window.clearTimeout(voicePauseTimerRef.current);
      window.speechSynthesis?.cancel();
      recognitionRef.current?.stop();
      setIsSpeaking(false);
      setIsListening(false);
      return;
    }
    const RecognitionCtor = ((window as unknown as Record<string, unknown>)
      .SpeechRecognition ||
      (window as unknown as Record<string, unknown>)
        .webkitSpeechRecognition) as
      | (new () => {
          lang: string;
          continuous: boolean;
          interimResults: boolean;
          maxAlternatives: number;
          onresult:
            | ((event: {
                results: ArrayLike<
                  ArrayLike<{ transcript: string }> & { isFinal: boolean }
                >;
              }) => void)
            | null;
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
    // Chrome on Windows reports "network" the moment continuous mode is turned
    // on, before the microphone opens. Leave that off. A finished phrase still
    // ends the session, and onend starts another one so the customer can keep
    // talking. Interim results put the words in the box while they are speaking.
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    const prefix = draft.trim();
    voicePrefixRef.current = prefix;
    voiceDraftRef.current = prefix;
    let networkFailures = 0;
    recognition.onresult = (event) => {
      networkFailures = 0;
      let heard = "";
      let interim = "";
      for (let index = 0; index < event.results.length; index += 1) {
        const piece = event.results[index]?.[0]?.transcript || "";
        if (event.results[index]?.isFinal) heard += piece;
        else interim += piece;
      }
      const spoken = `${heard} ${interim}`.replace(/\s+/g, " ").trim();
      const next = [voicePrefixRef.current, spoken]
        .filter(Boolean)
        .join(" ")
        .slice(0, 1000);
      voiceDraftRef.current = next;
      setDraft(next);
      // A short silence means the sentence is finished. Send it, then the agent
      // answers out loud. More words before the pause keep the same message.
      window.clearTimeout(voicePauseTimerRef.current);
      voicePauseTimerRef.current = window.setTimeout(() => {
        if (!wantVoiceRef.current || holdVoiceRef.current) return;
        const text = voiceDraftRef.current.trim();
        if (!text) return;
        submitVoiceRef.current(text);
      }, 1400);
    };
    recognition.onerror = (event) => {
      const code = event.error || "";
      // A pause fires "no-speech", and stop() fires "aborted". "network" is the
      // error Chrome sends for a session it closed by itself. The onend handler
      // opens the next session; none of these mean the recording failed to start.
      if (code === "no-speech" || code === "aborted" || code === "network") {
        if (code === "network") networkFailures += 1;
        return;
      }
      wantVoiceRef.current = false;
      setVoiceError(
        code === "not-allowed" || code === "service-not-allowed"
          ? t("Allow microphone access to use voice input.")
          : t("Voice input failed. Please try again."),
      );
      setIsListening(false);
    };
    let startAttempts = 0;
    const beginListening = () => {
      if (!wantVoiceRef.current || holdVoiceRef.current) return;
      // Chrome refuses to open the microphone while it is speaking, and it
      // also throws if start() follows the previous session too closely.
      try {
        window.speechSynthesis?.cancel();
      } catch {
        // Playback can be missing. The microphone still opens.
      }
      try {
        recognition.start();
        startAttempts = 0;
      } catch {
        startAttempts += 1;
        if (startAttempts > 4) {
          wantVoiceRef.current = false;
          setIsListening(false);
          setVoiceError(t("Voice input failed. Please try again."));
          return;
        }
        window.setTimeout(beginListening, 300);
      }
    };
    recognition.onend = () => {
      if (holdVoiceRef.current) return;
      if (!wantVoiceRef.current) {
        setIsListening(false);
        return;
      }
      // Several network errors in a row, with no words, means the speech
      // service really cannot start. One error is just Chrome ending a phrase.
      if (networkFailures > 2) {
        wantVoiceRef.current = false;
        setIsListening(false);
        setVoiceError(t("Voice input failed. Please try again."));
        return;
      }
      voicePrefixRef.current = voiceDraftRef.current.trim();
      window.setTimeout(beginListening, 300);
    };
    recognitionRef.current = recognition;
    wantVoiceRef.current = true;
    // The tap is the gesture that unlocks speech later. Speaking now would
    // close the microphone before it opens.
    try {
      window.speechSynthesis?.cancel();
      window.speechSynthesis?.resume();
      window.speechSynthesis?.getVoices();
    } catch {
      // Playback can be missing. The microphone still opens.
    }
    setVoiceError("");
    setIsListening(true);
    beginListening();
  };

  useEffect(() => {
    if (isOpen) return;
    wantVoiceRef.current = false;
    holdVoiceRef.current = false;
    voiceConversationRef.current = false;
    window.clearTimeout(voicePauseTimerRef.current);
    window.speechSynthesis?.cancel();
    recognitionRef.current?.stop();
    setIsSpeaking(false);
    setIsListening(false);
  }, [isOpen]);

  // ------------------------------------------------------------ photo attach (#7)
  const pickPhoto = () => fileInputRef.current?.click();

  const onPhotoChosen = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (
      file.type &&
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      setError(t("Upload a JPEG, PNG, or WebP image."));
      return;
    }
    setIsUploadingPhoto(true);
    setError("");
    try {
      // Phone photos are often several megabytes. Scale them down first so they
      // fit the 3 MB chat limit and arrive as a JPEG or WebP the server accepts.
      const dataUrl = await prepareImageForUpload(file);
      const encoded = dataUrl.slice(dataUrl.indexOf(",") + 1);
      const padding = encoded.endsWith("==")
        ? 2
        : encoded.endsWith("=")
          ? 1
          : 0;
      const bytes = Math.floor((encoded.length * 3) / 4) - padding;
      if (bytes > 3 * 1024 * 1024) {
        setError(t("Photos must be smaller than 3 MB."));
        return;
      }
      // The server answers with the stored path itself (`{ image: "/uploads/…" }`),
      // the same shape the admin uploader reads. It is not wrapped in `{ url }`.
      const result = await apiRequest<{ image: string }>("/chat/uploads", {
        method: "POST",
        body: { dataUrl },
      });
      if (typeof result?.image === "string" && result.image) {
        setAttachment({ url: result.image, name: file.name });
      } else {
        setError(t("The photo could not be attached. Please try again."));
      }
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : t("The photo could not be attached. Please try again."),
      );
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
    const applies =
      location.pathname === "/checkout" || location.pathname === "/custom-cake";
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

  function resumeVoice() {
    holdVoiceRef.current = false;
    if (!wantVoiceRef.current) {
      setIsListening(false);
      return;
    }
    voicePrefixRef.current = "";
    voiceDraftRef.current = "";
    setDraft("");
    setIsListening(true);
    try {
      recognitionRef.current?.start();
    } catch {
      // The microphone is already open.
    }
  }

  async function send(event?: React.FormEvent, spokenBody?: string) {
    event?.preventDefault();
    const body = (spokenBody ?? draft).trim();
    // A photo can travel on its own: text is optional when an image is attached.
    if ((!body && !attachment) || isSending) return;
    if (!threadIdRef.current) threadIdRef.current = readThreadId(customerId);
    // Sending a message re-pins the follow: the reply that lands next should be
    // scrolled into view even if the reader was scrolled up in the thread.
    stickToBottomRef.current = true;
    const fromVoice = wantVoiceRef.current;
    if (fromVoice) {
      voiceConversationRef.current = true;
      for (const message of messagesRef.current) {
        if (message.sender === "store")
          spokenStoreIdsRef.current.add(message.id);
      }
      holdVoiceRef.current = true;
      window.clearTimeout(voicePauseTimerRef.current);
      recognitionRef.current?.stop();
    }
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
            bag: cartItems.slice(0, 20).map((item) => ({
              name: item.name,
              quantity: item.quantity,
              price: Math.round(item.price),
              itemType: item.itemType === "menu" ? "menu" : "flavor",
              // The id is the addId shape the agent edits by ("take off the
              // mango" must name the exact line, not a name guess).
              id: String(item.id),
            })),
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
      voicePrefixRef.current = "";
      voiceDraftRef.current = "";
      setAttachment(null);
      // The AI auto-reply takes a couple of seconds to write. Show a typing bubble
      // while the customer waits, and clear it once the reply actually arrives.
      storeCountAtWaitStart.current = messages.filter(
        (message) => message.sender === "store",
      ).length;
      setIsAwaitingReply(true);
      typingTimeout.current = window.setTimeout(
        () => setIsAwaitingReply(false),
        TYPING_TIMEOUT_MS,
      );
      // Only show the messages of the thread the post actually landed in; sending
      // again may have moved the conversation to a new thread.
      await loadMessages(threadIdRef.current);
    } catch (sendError) {
      if (fromVoice) resumeVoice();
      setError(
        sendError instanceof Error
          ? sendError.message
          : t("The message could not be sent. Please try again."),
      );
    } finally {
      setIsSending(false);
    }
  }

  submitVoiceRef.current = (text: string) => {
    void send(undefined, text);
  };

  useEffect(() => {
    if (!voiceConversationRef.current) return;
    const fresh = messages.filter(
      (message) =>
        message.sender === "store" &&
        !spokenStoreIdsRef.current.has(message.id),
    );
    if (!fresh.length) return;
    for (const message of fresh) spokenStoreIdsRef.current.add(message.id);
    const text = spokenReplyText(fresh[fresh.length - 1].body);
    if (!text || typeof window.speechSynthesis === "undefined") {
      resumeVoice();
      return;
    }
    holdVoiceRef.current = true;
    setIsSpeaking(true);
    const utterance = new SpeechSynthesisUtterance(text);
    const french =
      language === "fr" ||
      /[àâçéèêëîïôùûüœ]/i.test(text) ||
      /\b(c'est|bonjour|disponible|boutique)\b/i.test(text);
    utterance.lang = french ? "fr-FR" : "en-US";
    // Prefer the modern neural voices the OS ships for free (Windows "Natural",
    // Edge "Online (Natural)"), then any local voice, then any matching voice.
    const langCode = french ? "fr" : "en";
    const voices = window.speechSynthesis
      .getVoices()
      .filter((item) => item.lang.toLowerCase().startsWith(langCode));
    const scored = (item: SpeechSynthesisVoice) => {
      const name = item.name.toLowerCase();
      if (/(natural|neural|online)/.test(name)) return 3;
      if (item.localService && /premium|enhanced|siri/.test(name)) return 2;
      if (item.localService) return 1;
      return 0;
    };
    const voice = voices.sort((a, b) => scored(b) - scored(a))[0] ?? null;
    if (voice) utterance.voice = voice;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      setIsSpeaking(false);
      resumeVoice();
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    // Chrome drops a speak() that follows cancel() in the same turn. The short
    // wait lets the reply actually play.
    const token = {};
    speakTokenRef.current = token;
    window.speechSynthesis.cancel();
    window.setTimeout(() => {
      if (speakTokenRef.current !== token || !wantVoiceRef.current) {
        if (speakTokenRef.current === token) finish();
        return;
      }
      try {
        window.speechSynthesis.speak(utterance);
      } catch {
        finish();
      }
    }, 60);
  }, [messages, language]);

  // Clear the conversation: wipe the server history and start a fresh thread in
  // this browser. Available from the header so it is never more than two taps away.
  async function clearChat() {
    if (isClearing) return;
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
    setIsClearing(true);
    try {
      if (threadIdRef.current) {
        await apiRequest(`/chat/messages/${threadIdRef.current}`, {
          method: "DELETE",
        });
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

  async function requestHumanHelp() {
    if (
      isRequestingHuman ||
      isSending ||
      isClearing ||
      messages.some((message) => message.needsAttention)
    )
      return;
    if (!threadIdRef.current) threadIdRef.current = readThreadId(customerId);
    setIsRequestingHuman(true);
    setError("");
    try {
      const requestHandoff = (threadId: string) =>
        apiRequest<{ requested: boolean; pending: boolean }>(
          `/chat/messages/${threadId}/handoff`,
          { method: "POST", body: { language } },
        );
      try {
        await requestHandoff(threadIdRef.current);
      } catch (handoffError) {
        if (!isForbidden(handoffError)) throw handoffError;
        startFreshThread();
        await requestHandoff(threadIdRef.current);
      }
      await loadMessages(threadIdRef.current);
    } catch (handoffError) {
      setError(
        handoffError instanceof Error
          ? handoffError.message
          : t("Your request could not be sent. Please try again."),
      );
    } finally {
      setIsRequestingHuman(false);
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

  // Empty composer shows the mic on the right. Typing, or a photo ready to go,
  // swaps it for send. The mic stays while recording so it can still be stopped.
  const showSend = Boolean(draft.trim() || attachment) && !isListening;
  const showMic = speechSupported && !showSend;
  const humanHandoffPending = messages.some(
    (message) => message.needsAttention,
  );

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
        } ${isOpen ? "max-sm:hidden" : ""}`}
      >
        <button
          aria-expanded={isOpen}
          aria-label={isOpen ? t("Close chat") : t("Chat with us")}
          className="grid size-14 place-items-center rounded-full bg-brand-navy text-brand-yellow shadow-[0_14px_36px_rgba(9,42,83,0.4)] transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow focus-visible:ring-offset-2"
          onClick={() => setIsOpen((open) => !open)}
          type="button"
        >
          {isOpen ? (
            <ChatCloseIcon className="size-6" />
          ) : (
            <ChatMark className="size-7" />
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
              {t(
                "I am your Cold Stone assistant. I can help you with anything concerning this platform.",
              )}
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

      {(isOpen || panelVisible) && (
        <section
          aria-label={t("Chat with us")}
          // Phones: the panel covers the screen (the header close button replaces the
          // launcher). From sm up it floats above the launcher — 5.25rem is the 3.5rem
          // bubble plus its 1.5rem offset and a small gap — and grows to 38rem.
          // It scales from the launcher corner: zooms in on open, out on close.
          className={`site-live-chat-panel fixed inset-0 z-[95] flex h-dvh w-full flex-col overflow-hidden rounded-none bg-brand-cream transition-all duration-200 ease-out motion-reduce:transition-none sm:inset-auto sm:bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] sm:left-4 sm:z-[65] sm:h-[min(38rem,calc(100dvh-7rem))] sm:w-[24.5rem] sm:rounded-[24px] sm:shadow-[0_24px_60px_rgba(71,42,59,0.28)] sm:ring-1 sm:ring-brand-border-warm sm:origin-bottom-left ${panelShown ? "sm:scale-100 sm:opacity-100" : "sm:scale-75 sm:opacity-0"}`}
          ref={panelRef}
        >
          <div aria-hidden="true" className="h-1 shrink-0 bg-brand-yellow" />
          <header className="relative flex items-center gap-2.5 bg-brand-cream px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-brand-navy sm:gap-3 sm:px-4 sm:pb-3 sm:pt-3.5">
            <span
              aria-hidden="true"
              className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-navy text-brand-yellow"
            >
              <ChatMark className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-lg font-extrabold leading-none">
                Cold Stone
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-[13px] text-brand-muted">
                <span
                  aria-hidden="true"
                  className="inline-block size-1.5 shrink-0 rounded-full bg-[#3d8b40]"
                />
                <span className="min-w-0 truncate">
                  {t("Usually replies in minutes")}
                </span>
              </p>
            </div>
            <button
              aria-label={t("Clear chat")}
              className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-brand-navy ring-1 ring-brand-border-warm transition hover:bg-brand-yellow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow active:scale-95"
              disabled={isRequestingHuman}
              onClick={clearChat}
              title={t("Clear chat")}
              type="button"
            >
              {isClearing ? (
                <svg
                  aria-hidden="true"
                  className="size-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="9"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  />
                  <path
                    className="opacity-75"
                    d="M21 12a9 9 0 0 0-9-9"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="2.5"
                  />
                </svg>
              ) : (
                <ChatTrashIcon />
              )}
            </button>
            <button
              aria-label={t("Close chat")}
              className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-navy text-white transition hover:bg-brand-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow active:scale-95"
              onClick={() => setIsOpen(false)}
              type="button"
            >
              <ChatCloseIcon className="size-[18px]" />
            </button>
          </header>

          <div
            className="flex flex-1 flex-col overflow-y-auto bg-brand-cream px-4 py-4"
            ref={listRef}
          >
            {/* Opening on a history cascades the bubbles in top-down; the stagger
                lives in CSS (.site-chat-cascade). Applied only on mount, never on
                new-message polls, so a reply appears with the standard single pop. */}
            <div
              className={
                panelJustOpened && messages.length > 0
                  ? "site-chat-cascade contents"
                  : "contents"
              }
              data-cascade-root=""
            >
              {messages.length === 0 && (
                <div className="flex items-start">
                  <ShopMark />
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-lg font-extrabold leading-none text-brand-navy">
                      Cold Stone
                    </p>
                    <p className="mt-2 max-w-[16rem] text-[15px] leading-6 text-brand-navy">
                      {t(
                        "Ask about flavors, cakes, delivery — anything. We are happy to help.",
                      )}
                    </p>
                    {/* Starter questions: tappable suggestions matched to the page the
                      customer is on. Tapping fills the input; the row disappears once the
                      conversation starts. */}
                    {showStarters && (
                      <div className="mt-3 flex max-w-full flex-wrap gap-1.5">
                        {starterQuestions.map((question) => (
                          <button
                            className="rounded-full border border-brand-border-warm bg-white px-3 py-1.5 text-left text-[13px] font-semibold text-brand-navy transition hover:border-brand-yellow hover:bg-brand-yellow/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow-deep active:scale-[0.98]"
                            key={question}
                            onClick={() => applyStarter(question)}
                            type="button"
                          >
                            {question}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {messages.map((message, index) => {
                const isCustomer = message.sender === "customer";
                const previous = messages[index - 1];
                const sameSender =
                  previous?.sender === message.sender &&
                  (isCustomer || previous.isHuman === message.isHuman);
                const {
                  text: bodyText,
                  action,
                  addId,
                  fill,
                  bag,
                  visit,
                  code,
                  chips,
                } = isCustomer
                  ? {
                      text: message.body,
                      action: undefined,
                      addId: undefined,
                      fill: undefined,
                      bag: undefined,
                      visit: undefined,
                      code: undefined,
                      chips: undefined,
                    }
                  : splitChatAction(message.body);
                // The customer asked to add something and this reply carries its
                // [ADD:] tag: the add happens here, once, when the reply is seen
                // — no button tap needed. Only the immediately preceding customer
                // message counts, so a price question never auto-adds.
                const autoAdd =
                  !isCustomer &&
                  Boolean(addId) &&
                  previous?.sender === "customer" &&
                  asksForAutoAdd(previous.body);
                // A customer message only reaches this list after the server stored it, so
                // its presence IS the delivery confirmation. (The server sends no `delivery`
                // field, and an earlier version pruned its own sent-message record as soon
                // as the poll returned the message — which removed the tick it was drawing.)
                const delivered = isCustomer;
                return (
                  <div
                    className={`site-chat-bubble flex ${isCustomer ? "site-chat-bubble--customer justify-end" : "items-start justify-start"} ${index === 0 ? "" : sameSender ? "mt-1" : "mt-5"}`}
                    key={message.id}
                    style={{ "--cascade-index": index } as React.CSSProperties}
                  >
                    {!isCustomer && (
                      <span aria-hidden="true" className="mr-2 w-7 shrink-0">
                        {!sameSender && <ShopMark />}
                      </span>
                    )}
                    <div
                      className={`min-w-0 ${isCustomer ? "max-w-[78%]" : "max-w-[calc(100%-2.25rem)]"}`}
                    >
                      {!isCustomer && !sameSender && (
                        <p className="mb-1 font-display text-[13px] font-bold leading-none text-brand-navy">
                          {message.isHuman ? t("Shop team") : t("Cold Stone")}
                        </p>
                      )}
                      {isCustomer ? (
                        <div className="flex flex-col items-end gap-1.5">
                          {message.imageUrl ? (
                            <SentPhoto src={message.imageUrl} />
                          ) : null}
                          {bodyText ? (
                            <div className="rounded-[18px] rounded-br-[6px] bg-brand-navy px-3.5 py-2 text-[15px] leading-6 text-white">
                              <ChatText text={bodyText} />
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="text-[15px] leading-6 text-brand-navy">
                          {bodyText ? <ChatText text={bodyText} /> : null}
                          {bag && <ChatBagEditButton bag={bag} />}
                          {visit && <ChatVisitButton visit={visit} />}
                          {code && <ChatCodeButton code={code} />}
                          {chips?.length ? (
                            <ChatChips
                              chips={chips}
                              onSend={(text) => submitVoiceRef.current?.(text)}
                            />
                          ) : null}
                          {autoAdd && (
                            <ChatAutoAdd
                              key={`${message.id}:${addId}`}
                              addId={addId}
                            />
                          )}
                          {(action || addId || fill?.length) && (
                            <div className="mt-2.5 max-w-[16rem]">
                              {fill?.length ? (
                                <ChatFillButton items={fill} />
                              ) : (
                                !autoAdd &&
                                addId && <ChatAddButton addId={addId} />
                              )}
                              {action && (
                                <ChatActionButton
                                  action={action}
                                  quiet={Boolean(addId || fill?.length)}
                                />
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      <p
                        className={`mt-2 flex items-center gap-1 text-[11px] font-medium text-brand-gray ${isCustomer ? "justify-end" : "justify-start"}`}
                      >
                        <span>{time(message.createdAt)}</span>
                        {delivered && <DeliveryTick />}
                      </p>
                    </div>
                    {isCustomer && customer && (
                      <span
                        aria-hidden="true"
                        className="mb-5 ml-2 flex w-7 shrink-0 items-end"
                      >
                        <CustomerPortrait picture={customer.profilePicture} />
                      </span>
                    )}
                  </div>
                );
              })}
              {isAwaitingReply && (
                <div
                  className="site-chat-typing mt-4 flex items-center"
                  aria-hidden="true"
                >
                  <ShopMark />
                  <span className="ml-2 flex items-center gap-1.5 py-2">
                    <span className="size-1.5 rounded-full bg-brand-navy/35 [animation:chat-typing-dot_1.2s_ease-in-out_infinite]" />
                    <span className="size-1.5 rounded-full bg-brand-navy/35 [animation:chat-typing-dot_1.2s_ease-in-out_0.2s_infinite]" />
                    <span className="size-1.5 rounded-full bg-brand-navy/35 [animation:chat-typing-dot_1.2s_ease-in-out_0.4s_infinite]" />
                  </span>
                </div>
              )}
            </div>
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

          {humanHandoffPending ? (
            <p
              className="mx-3 mb-2 rounded-xl bg-[#fff6e5] px-3 py-2 text-xs font-semibold leading-5 text-[#78520a]"
              role="status"
            >
              {t(
                "Your request is with the shop team. They’ll reply here as soon as someone is available.",
              )}
            </p>
          ) : (
            <div className="flex items-center justify-between gap-3 bg-brand-cream px-4 pb-2">
              <p className="text-[11px] leading-4 text-brand-muted">
                {t("Need more help than the assistant can give?")}
              </p>
              <button
                className="shrink-0 rounded-full border border-brand-border-warm bg-white px-3 py-1.5 text-xs font-bold text-brand-navy transition hover:border-brand-yellow hover:bg-brand-yellow/15 disabled:cursor-wait disabled:opacity-60"
                disabled={isRequestingHuman || isSending || isClearing}
                onClick={requestHumanHelp}
                type="button"
              >
                {isRequestingHuman ? t("Sending…") : t("Talk to a person")}
              </button>
            </div>
          )}

          {/* Pending photo attachment (#7): a small preview chip above the input. */}
          {attachment && (
            <div className="flex justify-end bg-brand-cream px-3 pt-3">
              <div className="relative">
                <img
                  alt=""
                  className="block max-h-28 w-auto max-w-[9rem] rounded-[16px] rounded-br-[6px] bg-white object-contain ring-1 ring-brand-border-warm shadow-[0_8px_18px_rgba(71,42,59,0.12)]"
                  src={attachment.url}
                />
                <button
                  aria-label={t("Remove photo")}
                  className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-brand-navy text-white shadow-[0_4px_10px_rgba(71,42,59,0.28)] transition hover:bg-brand-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow"
                  onClick={() => setAttachment(null)}
                  type="button"
                >
                  <svg
                    aria-hidden="true"
                    className="size-3"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="m6 6 12 12M18 6 6 18"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeWidth="2.4"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}

          <form
            className="flex items-center gap-1.5 border-t border-brand-border-warm bg-brand-cream px-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] pt-2.5 sm:px-3 sm:pb-3"
            onSubmit={send}
          >
            {/* The paperclip stays on the left. The mic sits on the right until
                there is something to send, then the send button takes its place. */}
            <input
              accept="image/jpeg,image/png,image/webp"
              aria-hidden="true"
              className="sr-only"
              onChange={onPhotoChosen}
              ref={fileInputRef}
              tabIndex={-1}
              type="file"
            />
            <button
              aria-label={t("Attach a photo")}
              className="grid size-10 shrink-0 place-items-center rounded-full text-brand-muted transition hover:bg-white hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow-deep active:scale-95"
              disabled={isUploadingPhoto || isSending}
              onClick={pickPhoto}
              title={t("Attach a photo")}
              type="button"
            >
              {isUploadingPhoto ? (
                <svg
                  aria-hidden="true"
                  className="size-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="9"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  />
                  <path
                    className="opacity-75"
                    d="M21 12a9 9 0 0 0-9-9"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="2.5"
                  />
                </svg>
              ) : (
                <svg
                  aria-hidden="true"
                  className="size-5"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                </svg>
              )}
            </button>
            <div className="relative min-w-0 flex-1">
              <input
                aria-label={t("Your message")}
                autoComplete="off"
                className={`w-full rounded-full border border-brand-border-warm bg-white py-2.5 text-[15px] font-medium text-brand-navy outline-none! transition-colors placeholder:text-brand-gray focus:border-brand-yellow ${
                  isListening && draft.trim()
                    ? "pl-3.5 pr-16 sm:pl-4"
                    : "px-3.5 sm:px-4"
                }`}
                maxLength={1000}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={isListening ? "" : t("Type a message…")}
                value={draft}
              />
              {isListening && !isSpeaking && (
                <span
                  aria-hidden="true"
                  className={`chat-voice-wave pointer-events-none absolute inset-y-0 flex items-center text-red-600 ${
                    draft.trim()
                      ? "right-3 gap-[3px]"
                      : "inset-x-0 justify-center gap-1"
                  }`}
                >
                  {Array.from({ length: draft.trim() ? 5 : 14 }, (_, index) => (
                    <span
                      key={index}
                      style={{
                        height: `${9 + ((index * 5) % 11)}px`,
                        animationDelay: `${(index % 6) * 0.09}s`,
                        animationDuration: `${0.62 + (index % 5) * 0.11}s`,
                      }}
                    />
                  ))}
                </span>
              )}
            </div>
            {showMic && (
              <button
                aria-label={
                  isListening ? t("Stop voice input") : t("Speak your message")
                }
                className={`grid size-10 shrink-0 place-items-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow-deep active:scale-95 ${
                  isListening
                    ? "bg-red-50 text-red-600"
                    : "text-brand-muted hover:bg-white hover:text-brand-navy"
                }`}
                onClick={toggleVoice}
                title={
                  isListening ? t("Stop voice input") : t("Speak your message")
                }
                type="button"
              >
                {isListening ? (
                  <svg
                    aria-hidden="true"
                    className="size-5"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path
                      fill="currentColor"
                      d="M9 6a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0V6Z"
                    />
                    <path
                      d="M8 11a4 4 0 0 0 8 0"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeWidth="1.8"
                    />
                    <path
                      d="M12 15v3"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeWidth="1.8"
                    />
                    <path
                      d="M9.5 20h5"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeWidth="1.8"
                    />
                  </svg>
                ) : (
                  <svg
                    aria-hidden="true"
                    className="size-5"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"
                      stroke="currentColor"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />
                    <path
                      d="M19 11v1a7 7 0 0 1-14 0v-1"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />
                    <path
                      d="M12 19v2.5"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeWidth="1.8"
                    />
                  </svg>
                )}
              </button>
            )}
            {showSend && (
              <button
                aria-label={t("Send message")}
                className={`grid size-10 shrink-0 place-items-center rounded-full transition disabled:opacity-40 ${
                  !isSending
                    ? "bg-brand-yellow text-brand-navy hover:bg-brand-gold-light active:scale-95"
                    : "bg-white text-brand-gray"
                }`}
                disabled={isSending}
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
            )}
          </form>
        </section>
      )}
    </>
  );
}

function SentPhoto({ src }: { src: string }) {
  return (
    <img
      alt=""
      className="block max-h-64 w-auto max-w-[15.5rem] rounded-[18px] rounded-br-[6px] bg-white object-contain ring-1 ring-brand-border-warm shadow-[0_8px_18px_rgba(71,42,59,0.12)]"
      decoding="async"
      loading="lazy"
      src={src}
    />
  );
}

function ShopMark() {
  return (
    <span className="grid size-7 place-items-center rounded-full bg-brand-navy text-brand-yellow">
      <ChatMark className="size-4" />
    </span>
  );
}

function CustomerPortrait({ picture }: { picture?: string }) {
  if (picture) {
    return (
      <img
        alt=""
        className="size-7 rounded-full object-cover"
        decoding="async"
        loading="lazy"
        src={picture}
      />
    );
  }
  return (
    <span className="block size-7 rounded-full border border-brand-border-warm bg-white" />
  );
}

function ChatText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <p className="whitespace-pre-wrap break-words">
      {parts.map((part, index) =>
        part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
          <strong className="font-bold" key={index}>
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </p>
  );
}

// The button an AI reply can carry (from its [ACTION:...] line): a full-width,
// thumb-friendly jump to the page the customer needs, e.g. the All Menu page.
function ChatFillButton({
  items,
}: {
  items: { id: string; quantity: number }[];
}) {
  const { t } = useLanguage();
  const { addItemsToCart } = useCart();
  const { flavors } = useFlavors();
  const [note, setNote] = useState("");
  const [added, setAdded] = useState(false);

  const add = () => {
    const products: CartProduct[] = items.flatMap((entry): CartProduct[] => {
      if (entry.id.startsWith("flavor:")) {
        const flavor = flavors.find(
          (item) => String(item.id) === entry.id.slice("flavor:".length),
        );
        return flavor
          ? [{ ...flavor, itemType: "flavor", quantity: entry.quantity }]
          : [];
      }
      const menu = findMenuItem(entry.id);
      return menu ? [{ ...menu, quantity: entry.quantity }] : [];
    });
    const count = addItemsToCart(products);
    if (!count) {
      setAdded(false);
      setNote(t("This item could not be added to your bag. Please try again."));
      return;
    }
    setNote("");
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1500);
  };

  return (
    <>
      <button
        className={`flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-extrabold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy active:scale-[0.98] ${
          added
            ? "bg-[#3d8b40] text-white"
            : "bg-brand-yellow text-brand-navy hover:bg-brand-gold-light"
        }`}
        onClick={add}
        type="button"
      >
        {added ? t("Added") : t("Add these to my bag")}
      </button>
      {note ? (
        <p
          className="mt-1.5 text-center text-xs font-semibold text-red-700"
          role="alert"
        >
          {note}
        </p>
      ) : null}
    </>
  );
}

function ChatAddButton({ addId }: { addId: string }) {
  const { t } = useLanguage();
  const { addToCart } = useCart();
  const { flavors } = useFlavors();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const resetTimer = useRef<number | null>(null);
  const [burst, setBurst] = useState(0);
  const [note, setNote] = useState("");

  useEffect(
    () => () => {
      if (resetTimer.current) window.clearTimeout(resetTimer.current);
    },
    [],
  );

  const add = () => {
    const added = addId.startsWith("flavor:")
      ? addToCart(
          flavors.find(
            (flavor) => String(flavor.id) === addId.slice("flavor:".length),
          ) || { id: "", name: "", image: "" },
        )
      : addToCart(findMenuItem(addId) || { id: "", name: "", image: "" });
    if (!added) {
      setBurst(0);
      setNote(t("This item could not be added to your bag. Please try again."));
      return;
    }
    setNote("");
    setBurst((count) => count + 1);
    const button = buttonRef.current;
    if (button) {
      button.classList.remove("chat-add-pop");
      void button.offsetWidth;
      button.classList.add("chat-add-pop");
    }
    if (resetTimer.current) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setBurst(0), 1500);
  };

  const justAdded = burst > 0;

  return (
    <>
      <button
        aria-live="polite"
        className={`relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-full px-4 py-2.5 text-sm font-extrabold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy active:scale-[0.98] ${
          justAdded
            ? "bg-[#3d8b40] text-white"
            : "bg-brand-yellow text-brand-navy hover:bg-brand-gold-light"
        }`}
        onClick={add}
        ref={buttonRef}
        type="button"
      >
        {justAdded && (
          <span
            aria-hidden="true"
            className="chat-add-ring pointer-events-none absolute left-1/2 top-1/2 size-16 rounded-full bg-white"
            key={burst}
          />
        )}
        {justAdded ? (
          <>
            <svg
              aria-hidden="true"
              className="chat-add-check relative size-4"
              fill="none"
              key={burst}
              viewBox="0 0 16 16"
            >
              <path
                d="M3 8.4 6.2 11.6 13 4.4"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
            <span className="relative">{t("Added")}</span>
          </>
        ) : (
          t("Add to bag")
        )}
      </button>
      {note ? (
        <p
          className="mt-1.5 text-center text-xs font-semibold text-red-700"
          role="alert"
        >
          {note}
        </p>
      ) : null}
    </>
  );
}

function ChatActionButton({
  action,
  quiet = false,
}: {
  action: { path: string; label: string };
  quiet?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <Link
      className={
        quiet
          ? "text-sm font-bold text-brand-navy underline decoration-brand-yellow decoration-2 underline-offset-2 transition-[text-decoration-color] hover:decoration-brand-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
          : "flex w-full items-center justify-center rounded-full bg-brand-yellow px-4 py-2.5 text-sm font-extrabold text-brand-navy transition hover:bg-brand-gold-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy active:scale-[0.98]"
      }
      onClick={() => window.dispatchEvent(new CustomEvent("chat:navigate"))}
      to={action.path}
    >
      {t(action.label)}
    </Link>
  );
}

/** Applies a bag edit the agent confirmed ([BAG:...] in the reply). */
function ChatBagEditButton({ bag }: { bag: BagEdit }) {
  const { t } = useLanguage();
  const { clearCart, removeFromCart, updateQuantity, cartItems } = useCart();
  const { flavors } = useFlavors();
  const [done, setDone] = useState(false);
  const [note, setNote] = useState("");

  // Applying once is enough: the tag stays in the thread history, but a second
  // tap would clear an empty bag or re-remove an already removed line.
  const apply = () => {
    setDone(true);
    if (bag.mode === "clear") {
      clearCart();
      return;
    }
    const addId = bag.addId || "";
    const quantity = bag.quantity || 0;
    const target = addId.startsWith("flavor:")
      ? cartItems.find(
          (item) =>
            String(item.id) === addId.slice("flavor:".length) &&
            item.itemType !== "menu",
        )
      : cartItems.find(
          (item) =>
            item.itemType === "menu" && findMenuItem(addId)?.id === item.id,
        );
    if (!target) {
      setNote(t("That item is no longer in your bag."));
      return;
    }
    if (quantity < 1) {
      removeFromCart(target.id);
      return;
    }
    const available =
      target.itemType === "menu"
        ? target.availableQuantity
        : (flavors.find((flavor) => flavor.id === target.id)
            ?.availableQuantity ?? target.availableQuantity);
    if (
      Number.isSafeInteger(available) &&
      available > 0 &&
      quantity > available
    ) {
      updateQuantity(target.id, available);
      setNote(t("Only {count} left, so I set {count}.", { count: available }));
      return;
    }
    updateQuantity(target.id, quantity);
  };

  return (
    <>
      <button
        className={`mt-2.5 flex w-full items-center justify-center rounded-full px-4 py-2.5 text-sm font-extrabold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy active:scale-[0.98] ${
          done && !note
            ? "bg-[#3d8b40] text-white"
            : "bg-brand-yellow text-brand-navy hover:bg-brand-gold-light"
        }`}
        onClick={apply}
        type="button"
      >
        {done && !note
          ? t("Done")
          : bag.mode === "clear"
            ? t("Empty my bag")
            : t("Update my bag")}
      </button>
      {note ? (
        <p
          className="mt-1.5 text-center text-xs font-semibold text-red-700"
          role="alert"
        >
          {note}
        </p>
      ) : null}
    </>
  );
}

/** Saves the visit the agent chose, so checkout opens with it already set. */
function ChatVisitButton({ visit }: { visit: ChatVisit }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  return (
    <button
      className="mt-2.5 flex w-full items-center justify-center rounded-full bg-brand-yellow px-4 py-2.5 text-sm font-extrabold text-brand-navy transition hover:bg-brand-gold-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy active:scale-[0.98]"
      onClick={() => {
        try {
          sessionStorage.setItem(
            "cold-stone-chat-visit",
            JSON.stringify(visit),
          );
        } catch {
          // Storage unavailable: checkout still opens on its own choices.
        }
        window.dispatchEvent(new CustomEvent("chat:navigate"));
        navigate("/checkout");
      }}
      type="button"
    >
      {t("Continue to checkout")}
    </button>
  );
}

/** Carries the code the agent applied, so checkout opens with it already attached. */
function ChatCodeButton({ code }: { code: string }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  return (
    <button
      className="mt-2.5 flex w-full items-center justify-center rounded-full bg-brand-yellow px-4 py-2.5 text-sm font-extrabold text-brand-navy transition hover:bg-brand-gold-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy active:scale-[0.98]"
      onClick={() => {
        try {
          sessionStorage.setItem("cold-stone-chat-code", code);
        } catch {
          // Storage unavailable: checkout still opens on its own choices.
        }
        window.dispatchEvent(new CustomEvent("chat:navigate"));
        navigate("/checkout");
      }}
      type="button"
    >
      {t("Go to checkout with the code")}
    </button>
  );
}

/** The agent's follow-up suggestions: a tap sends them, no typing needed. */
function ChatChips({
  chips,
  onSend,
}: {
  chips: string[];
  onSend: (text: string) => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="mt-2.5 flex max-w-full flex-wrap gap-1.5">
      {chips.map((chip) => (
        <button
          className="rounded-full border border-brand-navy/25 bg-white px-3 py-1.5 text-[13px] font-bold text-brand-navy transition hover:border-brand-navy hover:bg-brand-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
          key={chip}
          onClick={() => onSend(chip)}
          type="button"
        >
          {t(chip)}
        </button>
      ))}
    </div>
  );
}

/**
 * Applies a reply's [ADD:...] tag the moment the reply renders, when the
 * customer's message asked for the add. The confirmation appears in place of
 * the button the customer would otherwise have to tap. Runs once per mount;
 * the thread history re-rending does not re-add.
 */
function ChatAutoAdd({ addId }: { addId: string }) {
  const { t } = useLanguage();
  const { addToCart, cartItems } = useCart();
  const { flavors } = useFlavors();
  const [state, setState] = useState<"adding" | "added" | "failed">("adding");
  // Latest-handler refs: the add fires exactly once per mount, on a fixed 400 ms
  // timer. depending on addToCart or flavors directly re-arms the timer on every
  // re-render — and the flavor context value is a fresh object each render, so
  // the timer was repeatedly cleared and the note stuck on "Adding to your bag…".
  const addToCartRef = useRef(addToCart);
  addToCartRef.current = addToCart;
  const flavorsRef = useRef(flavors);
  flavorsRef.current = flavors;

  useEffect(() => {
    // One attempt per rendered reply. If it fails (stock gone, unknown id),
    // the customer still sees the note instead of a silent no-op.
    const timer = window.setTimeout(() => {
      // Re-mounts of this reply (poll re-renders, tab switches) must not add a
      // second copy. The check is against the LIVE bag, not a memory: a global
      // "already applied" set made the note claim success after the customer
      // had emptied the bag — the confirmation showed, the bag stayed empty.
      const inBag = cartItems.some((item) =>
        addId.startsWith("flavor:")
          ? String(item.id) === addId.slice("flavor:".length) &&
            item.itemType !== "menu"
          : item.itemType === "menu" && findMenuItem(addId)?.id === item.id,
      );
      if (inBag) {
        setState("added");
        return;
      }
      const ok = addId.startsWith("flavor:")
        ? addToCartRef.current(
            flavorsRef.current.find(
              (flavor) => String(flavor.id) === addId.slice("flavor:".length),
            ) || { id: "", name: "", image: "" },
          )
        : addToCartRef.current(
            findMenuItem(addId) || { id: "", name: "", image: "" },
          );
      setState(ok ? "added" : "failed");
    }, 400);
    return () => window.clearTimeout(timer);
    // cartItems is read through the closure on purpose: the add happens once,
    // 400 ms after mount, against the bag as it is at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addId]);

  return (
    <div className="mt-2.5 max-w-[16rem]" aria-live="polite">
      <div
        className={`flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-extrabold ${
          state === "added"
            ? "bg-[#3d8b40] text-white"
            : state === "failed"
              ? "bg-red-50 text-red-700"
              : "bg-brand-yellow/60 text-brand-navy"
        }`}
      >
        {state === "added" ? (
          <>
            <svg
              aria-hidden="true"
              className="size-4"
              fill="none"
              viewBox="0 0 16 16"
            >
              <path
                d="M3 8.4 6.2 11.6 13 4.4"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2"
              />
            </svg>
            {t("Added to your bag")}
          </>
        ) : state === "failed" ? (
          t("This item could not be added. It may be sold out.")
        ) : (
          t("Adding to your bag…")
        )}
      </div>
    </div>
  );
}
