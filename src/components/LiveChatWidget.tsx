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
import {
  QUIZ_ALLERGENS,
  noMatchReason,
  pickFlavor,
  type QuizAnswers,
  type QuizTaste,
} from "../lib/flavorQuiz";
import { MenuQuizCard } from "./MenuQuizCard";

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

/** What the assistant is doing right now, polled with the thread (#1). */
interface ChatProgress {
  stage: "thinking" | "lookup" | "writing";
  /** For `lookup`: the product name, area or order number being looked up. */
  label: string;
}

/** A product card a reply carries, built by the server from live menu data (#3). */
interface ChatProductCard {
  name: string;
  price: number;
  soldOut: boolean;
  path: string;
  image?: string;
  addId?: string;
}

/** An order timeline card, carried with the live status the database returned (#6). */
interface ChatOrderCard {
  id: number;
  status:
    | "processing"
    | "ready"
    | "out_for_delivery"
    | "delivered"
    | "payment_failed"
    | "cancelled";
  fulfillment: "pickup" | "delivery" | "";
  total: number;
}

/** A photo of a product: the catalog image, or the shop mark when none exists. */
interface ChatPhotoCard {
  name: string;
  image?: string;
  fallback?: boolean;
  path?: string;
}

type OrderStatus = ChatOrderCard["status"];

// The steps a shopper cares about, in order. A cancelled or failed payment is not a
// step: it replaces the timeline with one plain line.
const ORDER_STEPS: OrderStatus[] = [
  "processing",
  "ready",
  "out_for_delivery",
  "delivered",
];

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

/** The "go" mark on a choice row: a chevron that steps right on hover. */
function ChatChevron() {
  return (
    <svg
      aria-hidden="true"
      className="size-4 shrink-0 text-brand-muted transition group-hover:translate-x-0.5 group-hover:text-brand-navy"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
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

/**
 * True when the customer explicitly asked for the bag to change — remove an
 * item, set its quantity, or empty the bag. Such a reply carries a [BAG:]
 * tag that is applied automatically instead of waiting for a button tap: the
 * agent's words say "removed", so the bag must actually change.
 */
function asksForBagEdit(message: string): boolean {
  return /\b(?:remove|removed|take (?:off|out)|drop(?: (?:it|the|that))?|delete|empty|clear|vide|vider|enl[eè]ve|retire|supprime|make (?:it|the|them)|change it to|seulement)(?:\b|(?=[\s,.!?]))/i.test(
    message,
  );
}

function parseProductCard(raw: string): ChatProductCard | undefined {
  try {
    const card = JSON.parse(raw) as Record<string, unknown>;
    const name =
      typeof card.name === "string" ? card.name.trim().slice(0, 80) : "";
    const path =
      typeof card.path === "string" ? safeProductPath(card.path) : null;
    if (!name || !path) return undefined;
    const price = Number(card.price);
    const image = typeof card.image === "string" ? card.image : "";
    const addId = typeof card.addId === "string" ? safeAddId(card.addId) : null;
    return {
      name,
      path,
      price: Number.isFinite(price) && price > 0 ? price : 0,
      soldOut: card.soldOut === true,
      ...(image.startsWith("/") &&
      !image.startsWith("//") &&
      !image.includes("..")
        ? { image }
        : {}),
      ...(addId ? { addId } : {}),
    };
  } catch {
    return undefined;
  }
}

const ORDER_STATUSES_SET = new Set<OrderStatus>([
  "processing",
  "ready",
  "out_for_delivery",
  "delivered",
  "payment_failed",
  "cancelled",
]);

function parseOrderCard(raw: string): ChatOrderCard | undefined {
  try {
    const card = JSON.parse(raw) as Record<string, unknown>;
    const id = Number(card.id);
    const status = String(card.status) as OrderStatus;
    if (!Number.isSafeInteger(id) || id < 1 || !ORDER_STATUSES_SET.has(status))
      return undefined;
    const fulfillment =
      card.fulfillment === "pickup" || card.fulfillment === "delivery"
        ? card.fulfillment
        : "";
    const total = Number(card.total);
    return {
      id,
      status,
      fulfillment,
      total: Number.isFinite(total) && total > 0 ? total : 0,
    };
  } catch {
    return undefined;
  }
}

function parsePhotoCard(raw: string): ChatPhotoCard | undefined {
  try {
    const card = JSON.parse(raw) as Record<string, unknown>;
    const name =
      typeof card.name === "string" ? card.name.trim().slice(0, 80) : "";
    if (!name) return undefined;
    const image = typeof card.image === "string" ? card.image.trim() : "";
    // A same-site path or an absolute https URL only: never data: or javascript:.
    const safeImage =
      /^\/(?!\/)/.test(image) && !image.includes("..")
        ? image
        : /^https:\/\//.test(image)
          ? image
          : "";
    const path =
      typeof card.path === "string" ? safeProductPath(card.path) : null;
    return {
      name,
      ...(safeImage ? { image: safeImage } : { fallback: true }),
      ...(path ? { path } : {}),
    };
  } catch {
    return undefined;
  }
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
  /** A product photo the agent sent with its sentence (the reference's tag). */
  image?: string;
  /** Extra angles when the agent answered a "more photos" ask. */
  gallery?: string[];
  product?: ChatProductCard;
  order?: ChatOrderCard;
  photo?: ChatPhotoCard;
} {
  let text = body.trim();
  let action: { path: string; label: string } | undefined;
  let addId: string | undefined;
  let fill: { id: string; quantity: number }[] | undefined;
  let bag: BagEdit | undefined;
  let visit: ChatVisit | undefined;
  let code: string | undefined;
  let chips: string[] | undefined;
  let image: string | undefined;
  let gallery: string[] | undefined;
  let product: ChatProductCard | undefined;
  let order: ChatOrderCard | undefined;
  let photo: ChatPhotoCard | undefined;
  for (let guard = 0; guard < 10; guard += 1) {
    const photoMatch = text.match(/\[PHOTO:([^\]]+)\]\s*$/i);
    const productMatch = text.match(/\[PRODUCT:([^\]]+)\]\s*$/i);
    const orderMatch = text.match(/\[ORDER:([^\]]+)\]\s*$/i);
    const linkMatch = text.match(/\[LINK:(\/[^\]]+)\]\s*$/);
    const addMatch = text.match(/\[ADD:([^\]]+)\]\s*$/);
    const fillMatch = text.match(/\[FILL:([^\]]+)\]\s*$/);
    const pageMatch = text.match(/\[ACTION:(\w+)\]\s*$/);
    const bagMatch = text.match(/\[BAG:(clear|set:[^\]]+)\]\s*$/i);
    const visitMatch = text.match(/\[VISIT:([^\]]+)\]\s*$/i);
    const codeMatch = text.match(/\[CODE:([^\]]+)\]\s*$/i);
    const chipsMatch = text.match(/\[CHIPS:([^\]]+)\]\s*$/i);
    // A card is drawn once per reply; a second tag is dropped rather than stacked.
    if (photoMatch && !product) {
      const card = parsePhotoCard(photoMatch[1].trim());
      if (card && !photo) photo = card;
      text = text.slice(0, photoMatch.index).trim();
      continue;
    }
    if (productMatch) {
      const card = parseProductCard(productMatch[1].trim());
      if (card && !product) product = card;
      text = text.slice(0, productMatch.index).trim();
      continue;
    }
    if (orderMatch) {
      const card = parseOrderCard(orderMatch[1].trim());
      if (card && !order && !product) order = card;
      text = text.slice(0, orderMatch.index).trim();
      continue;
    }
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
  // The agent sometimes buries tags mid-sentence instead of on their own last
  // line ("…on each product page: [LINK:/menu?…] [LINK:/menu?…]"). The loop
  // above only parses end-of-text tags, so whatever survived must still be
  // scrubbed from the visible text — and the first buried product link is
  // honoured as the button rather than leaking as raw markup.
  const buriedLink = text.match(/\[LINK:(\/[^\]]+)\]/);
  if (buriedLink && !action) {
    const path = safeProductPath(buriedLink[1].trim());
    if (path) action = { path, label: "Open this product" };
  }
  // A photo tag the model put mid-sentence would otherwise be scrubbed with
  // everything else — recover it as the photo card when the end-of-text loop
  // did not already capture one.
  if (!addId) {
    // A buried [ADD:] must fire, not vanish: when the model put the add tag in
    // the middle of its sentence, the customer still tapped "add it to my bag"
    // and expects the item to land in the bag.
    const buriedAdd = text.match(/\[ADD:([^\]]+)\]/);
    const id = buriedAdd ? safeAddId(buriedAdd[1].trim()) : null;
    if (id) addId = id;
  }
  if (!image && !gallery) {
    const buriedImg = text.match(/\[IMGS?:((?:\/[^\]|]+)(?:\|\/[^\]|]+)*)\]/i);
    const paths = buriedImg
      ? buriedImg[1]
          .split("|")
          .map((shot) => shot.trim())
          .filter((shot) =>
            /^\/(?:menu-official|flavors|ice-images|cake-images)\/[\w\-/]+\.(?:webp|jpe?g|png)$/i.test(
              shot,
            ),
          )
      : [];
    if (paths.length === 1) image = paths[0];
    else if (paths.length > 1) gallery = paths.slice(0, 4);
  }
  // A card or photo tag the model put mid-sentence must not leak as raw markup
  // either, and a card it wrote is still honoured.
  if (!product && !photo) {
    const buriedProduct = text.match(/\[PRODUCT:([^\]]+)\]/i);
    const card = buriedProduct
      ? parseProductCard(buriedProduct[1].trim())
      : undefined;
    if (card) product = card;
  }
  if (!photo && !product) {
    const buriedPhoto = text.match(/\[PHOTO:([^\]]+)\]/i);
    const card = buriedPhoto
      ? parsePhotoCard(buriedPhoto[1].trim())
      : undefined;
    if (card) photo = card;
  }
  if (!order && !product) {
    const buriedOrder = text.match(/\[ORDER:([^\]]+)\]/i);
    const card = buriedOrder
      ? parseOrderCard(buriedOrder[1].trim())
      : undefined;
    if (card) order = card;
  }
  text = text
    .replace(
      /\[(?:LINK|IMGS?|ADD|FILL|BAG|VISIT|CODE|CHIPS|ACTION|PRODUCT|ORDER|PHOTO):[^\]]*\]/gi,
      "",
    )
    .replace(/\s{2,}/g, " ")
    .trim();
  return {
    text,
    action,
    addId,
    fill,
    bag,
    visit,
    code,
    chips,
    image,
    gallery,
    product,
    order,
    photo,
  };
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
      /\s*\[(?:LINK|ADD|ACTION|FILL|BAG|VISIT|CODE|CHIPS|PRODUCT|ORDER|PHOTO|QUIZ):[^\]]*\]/gi,
      " ",
    )
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

// Last time this browser talked in the chat, so the launcher can offer to
// continue a conversation a reloaded tab forgot to open (#5).
const RESUME_KEY = "cold-stone-chat-resume";
const RESUME_MIN_IDLE_MS = 10 * 60 * 1000;
const RESUME_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

// Voice review (#4): phones mishear, so a spoken sentence waits for a send tap
// by default. A saved choice overrides on every chat after that.
function voiceReviewDefault(): boolean {
  try {
    const saved = localStorage.getItem("cold-stone-chat-voice-review");
    if (saved === "0") return false;
    if (saved === "1") return true;
  } catch {
    // No storage: fall through to the touch-screen default.
  }
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches
  );
}

/**
 * A stable set of ids for the messages this browser has already shown. Declared
 * outside the component so a reply that arrives while the chat is closed does not
 * type itself out the moment it is opened — only a live arrival does (#6).
 */
const SEEN_MESSAGE_IDS = new Set<number>();
const SEEN_MAX = 400;

function rememberSeen(id: number) {
  if (SEEN_MESSAGE_IDS.has(id)) return false;
  SEEN_MESSAGE_IDS.add(id);
  // Bounded: a long-lived tab must not keep every id for ever.
  if (SEEN_MESSAGE_IDS.size > SEEN_MAX) {
    const oldest = SEEN_MESSAGE_IDS.values().next().value;
    if (oldest !== undefined) SEEN_MESSAGE_IDS.delete(oldest);
  }
  return true;
}

/** The chat's own words for what it is doing, from the server stage (#1). */
function progressText(
  progress: ChatProgress,
  t: (text: string, vars?: Record<string, string | number>) => string,
): string {
  if (progress.stage === "writing") return t("Writing your answer…");
  if (progress.stage === "lookup" && progress.label) {
    const lookup = String(progress.label).slice(0, 40);
    return /^#\d+$/.test(lookup)
      ? t("Checking order {number}…", { number: lookup })
      : t("Looking up {name}…", { name: lookup });
  }
  return t("Looking this up…");
}

/**
 * The first `length` characters of a store reply for the typewriter (#6). Tags the
 * tag parser removes are cut from wherever they start, so a half-typed tag ("[LIN")
 * never flashes on screen, and the text appears as a whole word up to a tag.
 */
function steerAt(
  text: string,
  steering: { id: number; length: number },
): string {
  const full = text.trim();
  if (steering.length >= full.length) return full;
  let visible = full.slice(0, Math.max(0, steering.length));
  const tagStart = visible.search(
    /\[(?:LINK|ADD|ACTION|FILL|BAG|VISIT|CODE|CHIPS|PRODUCT|ORDER|PHOTO):/i,
  );
  if (tagStart >= 0) visible = visible.slice(0, tagStart);
  return visible.trimEnd();
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    // Private windows and blocked storage: nothing to remember.
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore: the chat still works, it just forgets.
  }
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
  // Language pin (#6): the language the assistant answers in. It follows the
  // site until the customer pins one, and is sent with every message.
  const [pinnedLanguage, setPinnedLanguage] = useState<"en" | "fr" | null>(
    null,
  );
  const replyLanguage: "en" | "fr" =
    pinnedLanguage || (language === "fr" ? "fr" : "en");
  const setReplyLanguage = (next: "en" | "fr") => setPinnedLanguage(next);
  // What the assistant is doing (#1): polled with the thread, null when idle.
  const [progress, setProgress] = useState<ChatProgress | null>(null);
  // Typewriter (#6): the reply that arrived while this was open, and how much of
  // it is shown. Opening an old thread cascades history; it never types.
  const [steering, setSteering] = useState<{
    id: number;
    body: string;
    length: number;
  } | null>(null);
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

  // "Find Your Flavor": opened from the welcome card, which is where a customer
  // who has never used the chat will look. It renders as the latest message.
  const [quizOpen, setQuizOpen] = useState(false);
  // The menu quiz: its own card, opened from the same welcome screen. Only one
  // of the two quizzes is ever open at a time.
  const [menuQuizOpen, setMenuQuizOpen] = useState(false);
  // Photo attachment (#7): a chosen file and the site path it was uploaded to.
  const [attachment, setAttachment] = useState<{
    url: string;
    name: string;
  } | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  // The position the customer allowed the browser to share, so "which store is closer
  // to me?" names the real nearest branch. Kept for the session; never shown back.
  const [sharedLocation, setSharedLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  // Voice input (#4): recording state and whether the browser offers speech input.
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  // The spoken sentence waiting for a send tap when voice review is on (#4).
  const [voiceReview, setVoiceReview] = useState("");
  const [voiceReviewUntil, setVoiceReviewUntil] = useState(0);
  // Evaluated by a timer, not on render: otherwise the bar would vanish only
  // when some unrelated update happened to re-render the widget.
  const [voiceReviewLive, setVoiceReviewLive] = useState(false);
  // "Voice" step on the mic button: speaks replies and sends on a pause, or not.
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [voiceReviewMode] = useState(() => voiceReviewDefault());
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
  // Mirrors the "Voice" setting for handlers created once per recording.
  const voiceLanguageRef = useRef(language);
  const autoSpeakRef = useRef(false);
  const voiceReviewModeRef = useRef(true);
  const voiceReviewTimerRef = useRef<number | undefined>(undefined);
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
  // Resume (#5): the last thread this browser talked in, for the "Continue" chip.
  const [resume, setResume] = useState<{ text: string } | null>(null);
  // Bumps when a leave-a-message form was sent, so its open/closed memo re-reads.
  const [, setHandoffTick] = useState(0);
  // The clock, read once at mount (#2): opening hours and "left a number recently"
  // are computed from this instead of calling Date.now() during every render.
  const [mountTime] = useState(() => Date.now());
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

  // A reply that lands while the panel is open types itself out (about a second),
  // which reads faster than a bubble that appears whole. Anything already on
  // screen, or arriving while the panel is closed, is shown at full length.
  // The server always stores the complete text; this only plays it.
  useEffect(() => {
    if (!isOpen || !messages.length) return undefined;
    const last = messages[messages.length - 1];
    if (last.sender !== "store" || !last.body.trim()) return undefined;
    if (!rememberSeen(last.id)) return undefined;
    setSteering({ id: last.id, body: last.body, length: 0 });
    return undefined;
  }, [messages, isOpen]);

  useEffect(() => {
    if (!steering) return undefined;
    if (steering.length >= steering.body.length) {
      const done = window.setTimeout(() => setSteering(null), 0);
      return () => window.clearTimeout(done);
    }
    const step = Math.max(2, Math.ceil(steering.body.length / 70));
    const timer = window.setTimeout(() => {
      setSteering((current) =>
        current && current.id === steering.id
          ? {
              ...current,
              length: Math.min(current.body.length, current.length + step),
            }
          : current,
      );
    }, 14);
    return () => window.clearTimeout(timer);
  }, [steering]);

  // A spoken sentence stays in the review bar for eight minutes, then goes away
  // on its own: a forgotten bar must not sit over a conversation all evening.
  useEffect(() => {
    if (!voiceReview) {
      setVoiceReviewLive(false);
      return undefined;
    }
    const check = () => setVoiceReviewLive(Date.now() < voiceReviewUntil);
    check();
    const timer = window.setTimeout(
      check,
      Math.max(0, voiceReviewUntil - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [voiceReview, voiceReviewUntil]);

  // The server's own stage outranks the local wait: when the reply lands the
  // server clears it, so a stage never outlives its reply.
  useEffect(() => {
    if (!progress) return;
    setIsAwaitingReply(true);
    window.clearTimeout(typingTimeout.current);
    typingTimeout.current = window.setTimeout(
      () => setIsAwaitingReply(false),
      TYPING_TIMEOUT_MS,
    );
  }, [progress]);

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
        const result = await apiRequest<{
          messages: ChatMessage[];
          progress?: ChatProgress | null;
        }>(`/chat/messages/${threadId}`);
        // A fresh thread may have been started while this answer was in flight.
        if (threadId !== threadIdRef.current) return;
        setMessages(result.messages || []);
        setProgress(result.progress || null);
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

  // A closed chat that has a conversation, with a reply the customer has not
  // opened since, is worth resuming — and the launcher says so (#5). The chip is
  // only a pointer: the thread id is read from storage when it is tapped.
  useEffect(() => {
    if (isOpen) return undefined;
    if (!threadIdRef.current) threadIdRef.current = readThreadId(customerId);
    const threadId = threadIdRef.current;
    let cancelled = false;
    const check = async () => {
      const lastSeen = Number(readStorage(RESUME_KEY) || 0);
      if (Date.now() - lastSeen < RESUME_MIN_IDLE_MS) return;
      if (Date.now() - lastSeen > RESUME_MAX_AGE_MS) return;
      try {
        const result = await apiRequest<{ messages: ChatMessage[] }>(
          `/chat/messages/${threadId}`,
        );
        if (cancelled || threadId !== threadIdRef.current) return;
        const list = result.messages || [];
        const lastCustomer = [...list]
          .reverse()
          .find((m) => m.sender === "customer");
        const openedSince = list.some(
          (m) => m.sender === "store" && Date.parse(m.createdAt) > lastSeen,
        );
        const text = lastCustomer?.body.trim() || "";
        if (text && lastCustomer && openedSince) {
          setResume({ text: text.slice(0, 80) });
        }
      } catch {
        // A thread this browser can no longer read simply has no chip.
      }
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, [isOpen, customerId]);

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
  // "Listen" and "Speak" are one setting: speaking a reply out loud and sending on
  // a pause only make sense together, so both are a deliberate choice.
  voiceLanguageRef.current = language;
  autoSpeakRef.current = autoSpeak;
  voiceReviewModeRef.current = voiceReviewMode;

  const setVoiceMode = (speak: boolean) => {
    setAutoSpeak(speak);
    autoSpeakRef.current = speak;
    try {
      localStorage.setItem("cold-stone-chat-voice-review", speak ? "0" : "1");
    } catch {
      // Ignore: the choice lasts this visit.
    }
    if (!speak) {
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
    }
  };

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
      // Stopping the mic keeps whatever was dictated, ready to edit or send.
      if (voiceDraftRef.current.trim())
        setVoiceReview(voiceDraftRef.current.trim());
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
    // A new recording starts a new message; an open review is replaced by it.
    setVoiceReview("");
    setVoiceReviewUntil(0);
    recognition.lang = voiceLanguageRef.current === "fr" ? "fr-FR" : "en-US";
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
      // A short silence means the sentence is finished. What happens next depends
      // on the "Voice" setting (#4): with review on, the words stay in the box for
      // a send tap (a phone mishearing "one scoop" for "two" is never sent as-is);
      // with speak on, the sentence is sent and the reply is read aloud. Either way
      // more words before the pause keep the same message.
      window.clearTimeout(voicePauseTimerRef.current);
      voicePauseTimerRef.current = window.setTimeout(() => {
        if (!wantVoiceRef.current || holdVoiceRef.current) return;
        const text = voiceDraftRef.current.trim();
        if (!text) return;
        if (voiceReviewModeRef.current && !autoSpeakRef.current) {
          holdVoiceRef.current = true;
          recognitionRef.current?.stop();
          setVoiceReview(text);
          setVoiceReviewUntil(Date.now() + 8 * 60 * 1000);
          setDraft(text);
          return;
        }
        voiceConversationRef.current = true;
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

  // ------------------------------------------------------------ location
  // The browser asks the customer once; the answer is kept for the session and sent
  // with every message. A refusal is not an error — the assistant then asks for the
  // neighborhood instead.
  const shareLocation = () => {
    if (!navigator.geolocation) {
      setError(
        t(
          "This browser cannot share your location. Tell us your neighborhood instead.",
        ),
      );
      return;
    }
    setIsLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSharedLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setIsLocating(false);
      },
      () => {
        setIsLocating(false);
        setError(
          t("Location was not shared. Tell us your neighborhood instead."),
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
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
            location: sharedLocation,
            language: replyLanguage,
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
      window.clearTimeout(voiceReviewTimerRef.current);
      setVoiceReview("");
      setVoiceReviewUntil(0);
      setAttachment(null);
      // Resume (#5): a stored conversation is worth offering again after a pause.
      writeStorage(RESUME_KEY, String(Date.now()));
      setResume(null);
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
    // Only when the customer asked to hear replies (#4). Without this the agent
    // starts talking on the first voice use, which is startling on a bus.
    if (!autoSpeak || !voiceConversationRef.current) return;
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
  }, [messages, language, autoSpeak]);

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
      setQuizOpen(false);
      setMenuQuizOpen(false);
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

  // ------------------------------------------------------------ handoff (#2)
  //
  // Once the thread is with the team, the customer should not stare at one line
  // for hours: the strip says when to expect an answer (opening hours, Cameroon
  // time), takes a phone number so the shop can follow up outside the chat, and
  // sends a queued quick question straight into the same thread.
  const shopHours = useMemo(() => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Douala",
      hour: "2-digit",
      hour12: false,
    }).formatToParts(mountTime);
    const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
    // The branches answer from 09:00 to 21:00; outside that the team reads the
    // inbox the next morning. Sales are online 24/7, replies are not.
    return { open: hour >= 9 && hour < 21 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mountTime]);

  const leaveMessageOpen = useMemo(() => {
    const value = Number(readStorage("cold-stone-chat-leave-message") || 0);
    return mountTime - value > 12 * 60 * 60 * 1000;
  }, [mountTime]);

  const queueReplies = useMemo(
    () => [
      {
        label: t("Just checking in"),
        body: t("Hello, just checking in on my request."),
      },
      {
        label: t("This is urgent"),
        body: t("This is urgent — could someone look at it soon?"),
      },
      {
        label: t("Leave my phone number"),
        body: t("Here is my phone number so you can reach me:"),
      },
    ],
    [t],
  );

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
  // A spoken reply being read aloud keeps it too, as a stop control (#4).
  const showSend = Boolean(draft.trim() || attachment) && !isListening;
  const showMic = speechSupported && !showSend;
  // The "Voice" pill sits inside the field on phones, so the input keeps room
  // for it; from `sm` up it straddles the top edge and the text can run under it.
  const voicePillVisible = speechSupported && showMic && !isListening;
  const humanHandoffPending = messages.some(
    (message) => message.needsAttention,
  );
  // The assistant's stage (#1), else the plain wait: the typing row says what is
  // happening rather than showing three dots with no explanation.
  const progressMessage = progress ? progressText(progress, t) : "";
  const streamedText = steering
    ? { id: steering.id, length: steering.length }
    : null;
  const waitingLabel = isAwaitingReply ? progressMessage || t("Thinking…") : "";

  const openResume = () => {
    setResume(null);
    setIsOpen(true);
  };
  const dismissResume = () => {
    setResume(null);
    writeStorage(RESUME_KEY, String(Date.now()));
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
        } ${isOpen ? "max-sm:hidden" : ""}`}
      >
        <button
          aria-expanded={isOpen}
          aria-label={isOpen ? t("Close chat") : t("Chat with us")}
          className="grid size-14 place-items-center rounded-full bg-gradient-to-br from-brand-navy to-brand-blue text-brand-yellow shadow-[0_10px_24px_rgba(15,35,60,0.28),0_20px_48px_rgba(15,35,60,0.22),0_0_0_1px_rgba(255,255,255,0.12)_inset] transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow focus-visible:ring-offset-2"
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
        {!isOpen && !showNudge && resume && (
          <div
            className="absolute bottom-[calc(100%+0.6rem)] left-0 w-64 rounded-2xl rounded-bl-md bg-white p-3 shadow-[0_16px_40px_rgba(9,42,83,0.25)] ring-1 ring-[#e2e8f0]"
            role="status"
          >
            <p className="text-[13px] font-bold text-brand-navy">
              {t("Pick up where you left off?")}
            </p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#5d7186]">
              “{resume.text}”
            </p>
            <div className="mt-2 flex gap-2">
              <button
                className="min-h-8 flex-1 rounded-full bg-brand-navy px-3 text-xs font-bold text-white transition hover:bg-brand-blue"
                onClick={openResume}
                type="button"
              >
                {t("Continue chat")}
              </button>
              <button
                aria-label={t("Dismiss")}
                className="min-h-8 rounded-full px-3 text-xs font-bold text-[#65748a] transition hover:bg-[#f4f6f8]"
                onClick={dismissResume}
                type="button"
              >
                {t("No thanks")}
              </button>
            </div>
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
          className={`site-live-chat-panel fixed inset-0 z-[95] flex h-dvh w-full flex-col overflow-hidden rounded-none bg-white transition-all duration-200 ease-out motion-reduce:transition-none sm:inset-auto sm:bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] sm:left-4 sm:z-[65] sm:h-[min(38rem,calc(100dvh-7rem))] sm:w-[24.5rem] sm:rounded-2xl sm:shadow-[0_4px_12px_rgba(15,35,60,0.08),0_24px_64px_rgba(15,35,60,0.24)] sm:ring-1 sm:ring-brand-navy/10 sm:origin-bottom-left ${panelShown ? "sm:scale-100 sm:opacity-100" : "sm:scale-75 sm:opacity-0"}`}
          ref={panelRef}
        >
          <header className="relative flex items-center gap-2.5 bg-gradient-to-br from-brand-navy via-brand-navy to-brand-blue px-3 pb-3.5 pt-[max(0.75rem,env(safe-area-inset-top))] text-white shadow-[0_1px_0_rgba(255,255,255,0.08)_inset] sm:gap-3 sm:px-4 sm:pb-3.5 sm:pt-4">
            <span className="relative shrink-0">
              <span
                aria-hidden="true"
                className="grid size-10 place-items-center rounded-full bg-white/10 text-brand-yellow ring-1 ring-white/20"
              >
                <ChatMark className="size-5" />
              </span>
              <span
                aria-hidden="true"
                className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-brand-navy bg-[#3d8b40]"
              />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-lg font-extrabold leading-none tracking-tight">
                Cold Stone
              </p>
              <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-white/70">
                <span
                  aria-hidden="true"
                  className={`inline-block size-1.5 shrink-0 rounded-full ${isAwaitingReply ? "animate-pulse bg-brand-yellow-deep shadow-[0_0_6px_rgba(250,204,21,0.9)]" : "bg-[#4caf50] shadow-[0_0_6px_rgba(76,175,80,0.9)]"}`}
                />
                <span className="min-w-0 truncate" aria-live="off">
                  {waitingLabel || t("Usually replies in minutes")}
                </span>
              </p>
            </div>
            {/* Language pin (#6): the assistant answers in the language of the last
                message by default; the pin lets a bilingual customer decide, without
                switching the whole site. */}
            <button
              aria-label={t("Reply language: {language}", {
                language: replyLanguage === "fr" ? t("French") : t("English"),
              })}
              className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-extrabold ring-1 transition ${
                replyLanguage === language
                  ? "bg-white text-brand-navy ring-brand-border-warm hover:bg-brand-yellow/20"
                  : "bg-brand-navy text-brand-yellow ring-brand-navy"
              }`}
              onClick={() =>
                setReplyLanguage(replyLanguage === "fr" ? "en" : "fr")
              }
              title={t("Reply language")}
              type="button"
            >
              {replyLanguage === "fr" ? "FR" : "EN"}
            </button>
            <button
              aria-label={t("Clear chat")}
              className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/15 transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow active:scale-95"
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
              className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/15 transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow active:scale-95"
              onClick={() => setIsOpen(false)}
              type="button"
            >
              <ChatCloseIcon className="size-[18px]" />
            </button>
          </header>

          <div
            aria-label={t("Messages")}
            aria-live="polite"
            className="flex flex-1 flex-col overflow-y-auto bg-brand-cream/60 px-4 py-4"
            ref={listRef}
            role="log"
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
              {/* While the quiz is open it owns the screen: the welcome card's own
                  "Find my flavor" button would otherwise sit above it as a second,
                  identical invitation. */}
              {messages.length === 0 && !quizOpen && !menuQuizOpen && (
                <div className="flex items-start">
                  <ShopMark />
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-lg font-extrabold leading-none text-brand-navy">
                      Cold Stone
                    </p>
                    <p className="mt-2 max-w-[17rem] text-[15px] leading-6 text-brand-navy">
                      {t(
                        "Ask about flavors, cakes, delivery — anything. We are happy to help.",
                      )}
                    </p>
                    {/* The two quizzes' front doors, visible the moment the chat
                        opens, so neither depends on a reply that may never come.

                        One block, not two stacked buttons: a single white card with
                        a menu-style intro line and the two quizzes as numbered
                        choices, split by a hairline. Equal rows, same weight, so the
                        card reads as "pick one of two" rather than a loud button
                        that lost its shadow. */}
                    <div className="mt-3 max-w-[16.5rem] overflow-hidden rounded-2xl border border-brand-border-warm bg-white shadow-[0_6px_18px_rgba(71,42,59,0.08)]">
                      <p className="border-b border-brand-border-warm/70 px-3 py-2 text-[11px] font-bold text-brand-muted">
                        {t("Two quick ways to pick your treat")}
                      </p>
                      <button
                        className="group flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition hover:bg-brand-cream focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-navy active:bg-brand-cream"
                        onClick={() => setQuizOpen(true)}
                        type="button"
                      >
                        <span
                          aria-hidden="true"
                          className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-yellow text-[12px] font-extrabold text-brand-navy"
                        >
                          1
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13.5px] font-extrabold leading-5 text-brand-navy">
                            {t("Find my flavor")}
                          </span>
                          <span className="block text-[11px] leading-4 text-brand-muted">
                            {t("For a scoop, cone or sundae")}
                          </span>
                        </span>
                        <ChatChevron />
                      </button>
                      <button
                        className="group flex w-full items-center gap-2.5 border-t border-brand-border-warm/70 px-3 py-2.5 text-left transition hover:bg-brand-cream focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-navy active:bg-brand-cream"
                        onClick={() => setMenuQuizOpen(true)}
                        type="button"
                      >
                        <span
                          aria-hidden="true"
                          className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-cream text-[12px] font-extrabold text-brand-navy ring-1 ring-brand-border-warm"
                        >
                          2
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13.5px] font-extrabold leading-5 text-brand-navy">
                            {t("What will it be?")}
                          </span>
                          <span className="block text-[11px] leading-4 text-brand-muted">
                            {t("For cakes, shakes and more")}
                          </span>
                        </span>
                        <ChatChevron />
                      </button>
                    </div>
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
                  image,
                  gallery,
                  product: productCard,
                  order: orderCard,
                  photo: photoCard,
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
                      image: undefined,
                      gallery: undefined,
                      product: undefined,
                      order: undefined,
                      photo: undefined,
                    }
                  : splitChatAction(
                      steering && steering.id === message.id
                        ? steerAt(message.body, steering)
                        : message.body,
                    );
                // The customer asked to add something and this reply carries its
                // [ADD:] tag: the add happens here, once, when the reply is seen
                // — no button tap needed. Only the immediately preceding customer
                // message counts, so a price question never auto-adds.
                const autoAdd =
                  !isCustomer &&
                  Boolean(addId) &&
                  previous?.sender === "customer" &&
                  asksForAutoAdd(previous.body);
                const autoBag =
                  !isCustomer &&
                  Boolean(bag) &&
                  previous?.sender === "customer" &&
                  asksForBagEdit(previous.body);
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
                        <div className="max-w-[16.5rem] rounded-[18px] rounded-bl-[6px] bg-white px-3.5 py-2 text-[15px] leading-6 text-brand-navy shadow-[0_1px_2px_rgba(15,35,60,0.06),0_2px_8px_rgba(15,35,60,0.04)] ring-1 ring-brand-border-warm/70">
                          {gallery?.length ? (
                            <ChatGallery shots={gallery} path={action?.path} />
                          ) : image ? (
                            <ChatProductImage src={image} path={action?.path} />
                          ) : null}
                          {bodyText ? (
                            <ChatText
                              text={bodyText}
                              typing={steering ? null : streamedText}
                            />
                          ) : null}
                          {productCard && (
                            <ChatProductCardView
                              card={productCard}
                              messageId={message.id}
                            />
                          )}
                          {orderCard && <ChatOrderCardView card={orderCard} />}
                          {photoCard && <ChatPhotoView card={photoCard} />}
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
                        className={`mt-1.5 flex items-center gap-1 text-[11px] font-medium text-brand-gray ${isCustomer ? "justify-end" : "justify-start"}`}
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
              {/* Opened from the "Find my flavor" button, not from a reply: it sits at the
                  end of the conversation like the newest message and stays there. */}
              {/* On a phone the panel is the whole screen, so the quiz drops the
                  avatar gutter and takes the full width: the card's own 16.5rem
                  cap was leaving a third of the screen empty and squeezing the
                  tap targets. From `sm` up it sits in the bubble column again. */}
              {quizOpen && !menuQuizOpen && (
                <div className="mt-4 flex items-start">
                  <span className="max-sm:hidden">
                    <ShopMark />
                  </span>
                  <div className="min-w-0 flex-1 sm:max-w-[calc(100%-2.25rem)]">
                    <ChatQuizView
                      forceOpen
                      onClose={() => setQuizOpen(false)}
                    />
                  </div>
                </div>
              )}
              {menuQuizOpen && (
                <div className="mt-4 flex items-start">
                  <span className="max-sm:hidden">
                    <ShopMark />
                  </span>
                  <div className="min-w-0 flex-1 sm:max-w-[calc(100%-2.25rem)]">
                    <MenuQuizCard
                      forceOpen
                      onClose={() => setMenuQuizOpen(false)}
                    />
                  </div>
                </div>
              )}
              {isAwaitingReply && (
                <div className="site-chat-typing mt-4 flex items-center">
                  <ShopMark />
                  <span
                    aria-hidden="true"
                    className="ml-2 flex items-center gap-1.5 rounded-[18px] rounded-bl-[6px] bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(15,35,60,0.06)] ring-1 ring-brand-border-warm/70"
                  >
                    <span className="size-1.5 rounded-full bg-brand-navy/35 [animation:chat-typing-dot_1.2s_ease-in-out_infinite]" />
                    <span className="size-1.5 rounded-full bg-brand-navy/35 [animation:chat-typing-dot_1.2s_ease-in-out_0.2s_infinite]" />
                    <span className="size-1.5 rounded-full bg-brand-navy/35 [animation:chat-typing-dot_1.2s_ease-in-out_0.4s_infinite]" />
                  </span>
                  {/* What the assistant is doing (#1): its own polite line, changed
                      at most a few times per reply, never read out by a screen reader
                      on every poll — the live region above already announces replies. */}
                  {waitingLabel ? (
                    <span
                      aria-live="off"
                      className="ml-2 truncate text-xs font-semibold text-brand-muted"
                    >
                      {waitingLabel}
                    </span>
                  ) : null}
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
            <div
              className="mx-3 mb-2 rounded-xl bg-[#fff6e5] px-3 py-2"
              role="status"
            >
              <p className="text-xs font-semibold leading-5 text-[#78520a]">
                {shopHours.open
                  ? t(
                      "A team member is on now — expect a reply within about 15 minutes.",
                    )
                  : t(
                      "Our team is offline. They read this thread from 09:00 and will reply then — you can also leave a number below.",
                    )}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {queueReplies.map((reply) => (
                  <button
                    className="rounded-full border border-[#e0c078] bg-white/80 px-2.5 py-1 text-[12px] font-bold text-[#78520a] transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy disabled:opacity-50"
                    disabled={isSending}
                    key={reply.label}
                    onClick={() => void send(undefined, reply.body)}
                    type="button"
                  >
                    {reply.label}
                  </button>
                ))}
              </div>
              {leaveMessageOpen && (
                <LeaveMessageForm
                  onSend={(text) => {
                    // The widget's own send path: the thread id, the tick, the
                    // progress stage and the reload all behave as for any message.
                    setHandoffTick((tick) => tick + 1);
                    void send(undefined, text);
                  }}
                />
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 border-t border-brand-border-warm/60 bg-brand-cream/60 px-4 pb-2 pt-2.5">
              <p className="text-[11px] leading-4 text-brand-muted">
                {t("Need more help than the assistant can give?")}
              </p>
              <button
                className="shrink-0 rounded-lg border border-brand-border-warm bg-white px-3 py-1.5 text-xs font-bold text-brand-navy shadow-[0_1px_2px_rgba(15,35,60,0.05)] transition hover:border-brand-yellow hover:bg-brand-yellow/15 disabled:cursor-wait disabled:opacity-60"
                disabled={isRequestingHuman || isSending || isClearing}
                onClick={requestHumanHelp}
                type="button"
              >
                {isRequestingHuman ? t("Sending…") : t("Talk to a person")}
              </button>
            </div>
          )}

          {/* Voice review (#4): the spoken sentence waits here for a checked send,
              with a live edit box, instead of firing on a 1.4 s silence. */}
          {voiceReview && voiceReviewLive && !isListening && (
            <div className="mx-3 mb-1.5 rounded-xl bg-white px-3 py-2 ring-1 ring-brand-border-warm">
              <p className="text-[11px] font-bold uppercase tracking-wide text-brand-muted">
                {t("Did I hear this right?")}
              </p>
              <input
                aria-label={t("Edit what you said")}
                className="mt-1 w-full bg-transparent text-[14px] font-medium text-brand-navy outline-none"
                maxLength={1000}
                onChange={(event) => {
                  setVoiceReview(event.target.value);
                  setDraft(event.target.value);
                  voiceDraftRef.current = event.target.value;
                }}
                value={voiceReview}
              />
              <div className="mt-1.5 flex items-center gap-1.5">
                <button
                  className="rounded-full bg-brand-navy px-3 py-1 text-xs font-bold text-white transition hover:bg-brand-blue disabled:opacity-50"
                  disabled={!voiceReview.trim() || isSending}
                  onClick={() => {
                    setVoiceReview("");
                    setVoiceReviewUntil(0);
                    void send(undefined, voiceReview.trim());
                  }}
                  type="button"
                >
                  {t("Send")}
                </button>
                <button
                  className="rounded-full px-2.5 py-1 text-xs font-bold text-brand-muted transition hover:bg-brand-cream"
                  onClick={() => {
                    setVoiceReview("");
                    setVoiceReviewUntil(0);
                    setDraft("");
                    voiceDraftRef.current = "";
                    resumeVoice();
                  }}
                  type="button"
                >
                  {t("Say it again")}
                </button>
                <button
                  aria-label={t("Dismiss")}
                  className="ml-auto rounded-full px-2 py-1 text-xs font-bold text-brand-muted transition hover:bg-brand-cream"
                  onClick={() => {
                    setVoiceReview("");
                    setVoiceReviewUntil(0);
                  }}
                  type="button"
                >
                  {t("Dismiss")}
                </button>
              </div>
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
            className="flex items-end gap-1.5 border-t border-brand-border-warm bg-brand-cream px-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] pt-2.5 sm:px-3 sm:pb-3"
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
              className="grid size-10 shrink-0 place-items-center rounded-lg text-brand-muted transition hover:bg-white hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow-deep active:scale-95"
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
            <button
              aria-label={t("Share my location")}
              aria-pressed={Boolean(sharedLocation)}
              className={`grid size-10 shrink-0 place-items-center rounded-lg transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow-deep active:scale-95 ${
                sharedLocation
                  ? "text-brand-navy"
                  : "text-brand-muted hover:text-brand-navy"
              }`}
              disabled={isLocating || isSending}
              onClick={shareLocation}
              title={t("Share my location")}
              type="button"
            >
              {isLocating ? (
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
                    d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"
                    stroke="currentColor"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                  <circle
                    cx="12"
                    cy="10"
                    r="2.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                </svg>
              )}
            </button>
            <div className="relative min-w-0 flex-1">
              <input
                aria-label={t("Your message")}
                autoComplete="off"
                className={`w-full rounded-lg border border-brand-border-warm bg-white py-2.5 text-[15px] font-medium text-brand-navy shadow-[0_1px_2px_rgba(9,42,83,0.06)] outline-none! transition-all placeholder:text-brand-gray/80 focus:border-brand-yellow focus:bg-white focus:shadow-[0_0_0_3px_rgba(250,204,21,0.25)] ${
                  isListening && draft.trim()
                    ? "pl-3.5 pr-16 sm:pl-4"
                    : "pl-3.5 sm:px-4"
                } ${voicePillVisible ? "pr-14 sm:pr-4" : "pr-3.5 sm:pr-4"}`}
                maxLength={1000}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={isListening ? "" : t("Type a message…")}
                value={draft}
              />
              {/* Voice (#4): a switch-step beside the mic. "Listen" dictates and
                  waits for a send tap; "Voice" also reads replies and sends on a
                  pause. Nothing speaks unless this is chosen.

                  On a phone the field is only ~10rem wide, so the pill sits inside
                  the field's right edge (not straddling it) and the input reserves
                  room for it — otherwise it covered the placeholder and the text. */}
              {voicePillVisible && (
                <button
                  aria-pressed={autoSpeak}
                  className={`absolute right-1 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-[10px] font-extrabold leading-none ring-1 transition sm:-top-2 sm:right-1.5 sm:translate-y-0 sm:px-2 sm:py-0.5 ${
                    autoSpeak
                      ? "bg-brand-navy text-brand-yellow ring-brand-navy"
                      : "bg-white text-brand-muted ring-brand-border-warm hover:text-brand-navy"
                  }`}
                  onClick={() => setVoiceMode(!autoSpeak)}
                  title={
                    autoSpeak
                      ? t("Voice replies are on")
                      : t("Turn on voice replies")
                  }
                  type="button"
                >
                  {autoSpeak ? t("Voice on") : t("Voice")}
                </button>
              )}
              {isListening && !isSpeaking && (
                <span
                  aria-hidden="true"
                  className={`chat-voice-wave pointer-events-none absolute inset-y-0 flex items-center text-red-600 ${
                    draft.trim()
                      ? "right-3 gap-[3px]"
                      : "inset-x-0 justify-center gap-1"
                  }`}
                >
                  {Array.from({ length: draft.trim() ? 5 : 10 }, (_, index) => (
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
            {(showMic || isSpeaking) && !showSend && (
              <button
                aria-label={
                  isSpeaking
                    ? t("Stop speaking")
                    : isListening
                      ? t("Stop voice input")
                      : t("Speak your message")
                }
                className={`grid size-10 shrink-0 place-items-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow-deep active:scale-95 ${
                  isSpeaking
                    ? "bg-brand-navy text-brand-yellow"
                    : isListening
                      ? "bg-red-50 text-red-600"
                      : "text-brand-muted hover:bg-white hover:text-brand-navy"
                }`}
                onClick={() => {
                  if (isSpeaking) {
                    // Stop the reply being read, but keep listening (#4).
                    window.speechSynthesis?.cancel();
                    setIsSpeaking(false);
                    resumeVoice();
                    return;
                  }
                  toggleVoice();
                }}
                title={
                  isSpeaking
                    ? t("Stop speaking")
                    : isListening
                      ? t("Stop voice input")
                      : t("Speak your message")
                }
                type="button"
              >
                {isSpeaking ? (
                  <svg
                    aria-hidden="true"
                    className="size-5"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 8v8h8V8H8Z" fill="currentColor" />
                  </svg>
                ) : isListening ? (
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
                className={`grid size-10 shrink-0 place-items-center rounded-lg transition disabled:opacity-40 ${
                  !isSending
                    ? "bg-brand-yellow text-brand-navy shadow-[0_2px_8px_rgba(250,204,21,0.45)] hover:bg-brand-gold-light active:scale-95"
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

function ChatText({
  text,
  typing = null,
}: {
  text: string;
  /** Only on the reply that is being typed out (#6): its id and shown length. */
  typing?: { id: number; length: number } | null;
}) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  const typingNow = Boolean(typing && typing.length < text.length);
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
      {typingNow ? (
        <span
          aria-hidden="true"
          className="ml-0.5 inline-block h-4 w-0.5 animate-pulse rounded-full bg-brand-navy align-middle"
        />
      ) : null}
    </p>
  );
}

const LOCAL_VERSION = { en: "en-CM", fr: "fr-CM" } as const;

/** A price in the shop's own currency, always FCFA — the agent quotes the charge. */
function chatPrice(value: number, language: string): string {
  return new Intl.NumberFormat(LOCAL_VERSION[language === "fr" ? "fr" : "en"], {
    style: "currency",
    currency: "XAF",
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * The product card (#3): the photo, price and stock the assistant just quoted,
 * drawn as a card instead of a paragraph. It carries add-to-bag when the product
 * can be added, and its page button opens the real product.
 */
function ChatProductCardView({
  card,
  messageId,
}: {
  card: ChatProductCard;
  messageId: number;
}) {
  const { t, language } = useLanguage();
  const [added, setAdded] = useState(false);
  return (
    <div className="mt-2.5 overflow-hidden rounded-2xl border border-brand-border-warm bg-white shadow-[0_8px_20px_rgba(71,42,59,0.08)]">
      <Link
        className="flex items-center gap-3 p-2.5 transition hover:bg-brand-cream focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-navy"
        onClick={() => window.dispatchEvent(new CustomEvent("chat:navigate"))}
        to={card.path}
      >
        {card.image ? (
          <img
            alt=""
            className="size-16 shrink-0 rounded-xl object-cover"
            decoding="async"
            loading="lazy"
            src={card.image}
          />
        ) : (
          <span className="grid size-16 shrink-0 place-items-center rounded-xl bg-brand-cream text-brand-muted">
            <ChatMark className="size-6" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-sm font-extrabold leading-5 text-brand-navy">
            {card.name}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {card.price > 0 && (
              <span className="font-bold text-brand-navy">
                {chatPrice(card.price, language)}
              </span>
            )}
            {card.soldOut ? (
              <span className="rounded-full bg-[#fdecec] px-2 py-0.5 font-bold text-[#9c2a2a]">
                {t("Sold out")}
              </span>
            ) : (
              <span className="rounded-full bg-[#e8f5e9] px-2 py-0.5 font-bold text-[#2c6a2f]">
                {t("In stock")}
              </span>
            )}
          </span>
        </span>
      </Link>
      {!card.soldOut &&
      card.addId &&
      !/^(menu:custom:|menu:[a-z0-9-]+:custom-)/.test(card.addId) ? (
        <div className="px-2.5 pb-2.5" key={`${messageId}:${card.addId}`}>
          {added ? (
            <p
              className="rounded-full bg-[#e8f5e9] px-3 py-2 text-center text-xs font-bold text-[#2c6a2f]"
              role="status"
            >
              {t("Added to your bag")}
            </p>
          ) : (
            <ChatAutoAdd addId={card.addId} onAdded={() => setAdded(true)} />
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * A product photo in the conversation. The picture is the catalog's own (or a
 * public storage URL); a product with no photo gets the shop mark and a caption,
 * never an empty frame. When a page exists, the whole picture opens it.
 */
function ChatPhotoView({ card }: { card: ChatPhotoCard }) {
  const { t } = useLanguage();
  const frame = (
    <span className="relative block aspect-[4/3] w-full overflow-hidden bg-brand-cream">
      {card.image ? (
        <img
          alt={card.name}
          className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          decoding="async"
          loading="lazy"
          src={card.image}
          // A broken image must not leave a torn frame: the shop mark takes over.
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <span className="grid size-full place-items-center text-brand-muted">
          <ChatMark className="size-9" />
        </span>
      )}
    </span>
  );
  return (
    <figure className="mt-2.5 w-full max-w-[16.5rem] overflow-hidden rounded-2xl border border-brand-border-warm bg-white shadow-[0_8px_20px_rgba(71,42,59,0.1)]">
      {card.path ? (
        <Link
          aria-label={t("Open {name}", { name: card.name })}
          className="group block focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-navy"
          onClick={() => window.dispatchEvent(new CustomEvent("chat:navigate"))}
          to={card.path}
        >
          {frame}
        </Link>
      ) : (
        frame
      )}
      <figcaption className="flex items-center justify-between gap-2 px-2.5 py-1.5">
        <span className="truncate text-[12px] font-bold text-brand-navy">
          {card.name}
        </span>
        <span className="shrink-0 text-[11px] font-semibold text-brand-muted">
          {card.image ? t("Photo") : t("No photo yet")}
        </span>
      </figcaption>
    </figure>
  );
}

/**
 * The quiz's allergen buttons, keyed by the label the quiz logic uses. The text is
 * what `t()` is handed, so the French dictionary translates these exact strings.
 */
const QUIZ_ALLERGEN_LABELS: Record<(typeof QUIZ_ALLERGENS)[number], string> = {
  dairy: "Dairy",
  nuts: "Tree nuts",
  peanuts: "Peanuts",
  gluten: "Gluten",
  eggs: "Eggs",
  soy: "Soy",
};

// The two taste choices as full-width rows: a label, a line of plain-language
// hint, and a small swatch of the flavor range. Rows, not a 3-up grid — the card
// lives in a ~16rem bubble column, where "Chocolatey" and "Either" side by side
// do not fit and clip. "Either" is a quiet third choice text, not a third box.
const QUIZ_TASTES: {
  value: Exclude<QuizTaste, "either">;
  label: string;
  hint: string;
}[] = [
  {
    value: "fruity",
    label: "Fruity",
    hint: "Berry, mango, lemon, sorbet",
  },
  {
    value: "chocolatey",
    label: "Chocolatey",
    hint: "Chocolate, fudge, caramel, coffee",
  },
];

/** One taste row: an emoji on a tinted chip, the word, and where it leads. */
function QuizTasteOption({
  taste,
  onPick,
}: {
  taste: (typeof QUIZ_TASTES)[number];
  onPick: () => void;
}) {
  const { t } = useLanguage();
  const fruity = taste.value === "fruity";
  return (
    <button
      className={`group flex min-h-14 w-full items-center gap-3 rounded-2xl border bg-white p-2.5 text-left transition hover:-translate-y-px hover:shadow-[0_6px_16px_rgba(71,42,59,0.12)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy active:translate-y-0 active:scale-[0.99] sm:min-h-0 sm:gap-2.5 sm:p-2 ${
        fruity
          ? "border-[#f3d3d8] hover:border-[#e9a7b3]"
          : "border-[#e3c8ab] hover:border-[#cfa773]"
      }`}
      onClick={onPick}
      type="button"
    >
      <span
        aria-hidden="true"
        className={`grid size-11 shrink-0 place-items-center rounded-xl text-[21px] sm:size-10 sm:text-[19px] ${
          fruity ? "bg-[#fdeef1]" : "bg-[#f6ead9]"
        }`}
      >
        {fruity ? "🍓" : "🍫"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-extrabold leading-5 text-brand-navy sm:text-[15px]">
          {t(taste.label)}
        </span>
        <span className="mt-0.5 block text-[12.5px] font-medium leading-4 text-brand-muted sm:text-[11.5px]">
          {t(taste.hint)}
        </span>
      </span>
      <svg
        aria-hidden="true"
        className="size-4 shrink-0 text-brand-muted transition group-hover:translate-x-0.5 group-hover:text-brand-navy"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          d="M9 6l6 6-6 6"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.2"
        />
      </svg>
    </button>
  );
}

/**
 * "Find Your Flavor": answer the questions, then one flavor from the live catalog.
 *
 * Optional by design. It starts collapsed behind a single button, every step
 * is one tap, and the close button is always in the same corner, so a customer
 * who did not ask for a quiz is never trapped in one. The recommendation is
 * computed in the browser from flavors the app already loaded: no request, no
 * wait, and nothing sold out or conflicting with a stated allergy is offered.
 */
function ChatQuizView({
  forceOpen = false,
  onClose,
}: {
  /** Shown expanded from the first render (the widget's own button opened it). */
  forceOpen?: boolean;
  /** Called when the customer closes it, so the parent can drop the card. */
  onClose?: () => void;
} = {}) {
  const { t, language } = useLanguage();
  const { flavors } = useFlavors();
  const { addToCart } = useCart();
  const [open, setOpen] = useState(forceOpen);
  const [step, setStep] = useState(0);
  const [taste, setTaste] = useState<QuizTaste>("either");
  const [avoid, setAvoid] = useState<string[]>([]);
  const [added, setAdded] = useState(false);

  // Opening the card starts the quiz at its first question, so no reply has to
  // carry a hidden tag and no customer has to tap twice to begin.
  const start = () => {
    setOpen(true);
    setStep(0);
    setAvoid([]);
    setAdded(false);
  };

  const answers: QuizAnswers = { taste, avoid };
  const result = useMemo(
    () => (step >= 2 ? pickFlavor(flavors, answers) : null),
    // answers is rebuilt each render; its two fields are the real inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [step, taste, avoid, flavors],
  );

  const close = () => {
    setOpen(false);
    setStep(0);
    setAdded(false);
    onClose?.();
  };

  const toggleAllergen = (label: string) => {
    setAvoid((current) =>
      current.includes(label)
        ? current.filter((entry) => entry !== label)
        : [...current, label],
    );
  };

  if (!open) {
    return (
      <div className="mt-2.5 w-full max-w-[16rem] sm:w-auto">
        <button
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-yellow px-4 py-2.5 text-sm font-extrabold text-brand-navy shadow-[0_2px_10px_rgba(250,204,21,0.4)] transition-all hover:bg-brand-gold-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy active:scale-[0.98]"
          onClick={start}
          type="button"
        >
          {t("Find my flavor")}
        </button>
      </div>
    );
  }

  // Allergen chips: a soft outlined pill when off, a checked plum pill when on,
  // so "selected" is legible at a glance without shouting.
  const chipClass = (active: boolean) =>
    `inline-flex min-h-9 items-center gap-1 rounded-full border px-3 py-2 text-[13px] font-bold leading-none transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy active:scale-[0.97] sm:min-h-0 sm:px-2.5 sm:py-1.5 sm:text-[12.5px] ${
      active
        ? "border-brand-navy bg-brand-navy text-white shadow-[0_2px_6px_rgba(71,42,59,0.25)]"
        : "border-brand-border-warm bg-white text-brand-navy hover:border-brand-navy/40 hover:bg-brand-cream"
    }`;

  const progress = step >= 2 ? 2 : step + 1;

  return (
    <div className="mt-2.5 w-full overflow-hidden rounded-[20px] border border-brand-border-warm bg-white shadow-[0_14px_34px_rgba(71,42,59,0.16)] sm:max-w-[16.5rem]">
      {/* A warm banner and a hairline progress bar: the customer can see at a
          glance that this is short and how far in they are. */}
      <div className="relative bg-gradient-to-r from-brand-navy to-[#6b3f58] px-3.5 pb-2.5 pt-3 text-white sm:px-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-brand-yellow">
              {t("Find your flavor")}
            </p>
            <p className="mt-1 ml-[-0.5px] truncate text-[16px] font-extrabold leading-5 sm:text-[15px]">
              {step < 2
                ? t("Question {n} of 2", { n: step + 1 })
                : t("Your flavor")}
            </p>
          </div>
          <button
            aria-label={t("Close the quiz")}
            className="grid size-9 shrink-0 place-items-center rounded-full text-white/70 transition hover:bg-white/15 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow sm:size-7"
            onClick={close}
            type="button"
          >
            <svg
              aria-hidden="true"
              className="size-3.5"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2.5"
              />
            </svg>
          </button>
        </div>
        <div className="mt-2 flex items-center gap-1.5" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <span
              className={`h-1 flex-1 rounded-full transition-colors ${index < progress ? "bg-brand-yellow" : "bg-white/25"}`}
              key={index}
            />
          ))}
          <span className="ml-1 text-[10px] font-bold text-white/70">
            {step >= 2
              ? t("Done")
              : t("{done} of {total}", { done: progress, total: 2 })}
          </span>
        </div>
      </div>

      <div className="p-3 sm:p-3">
        {step === 0 && (
          <div>
            <p className="text-[15px] font-bold text-brand-navy sm:text-[13.5px]">
              {t("Fruity or chocolatey?")}
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:gap-1.5">
              {QUIZ_TASTES.map((option) => (
                <QuizTasteOption
                  key={option.value}
                  onPick={() => {
                    setTaste(option.value);
                    setStep(1);
                  }}
                  taste={option}
                />
              ))}
            </div>
            <button
              className="mt-2 min-h-10 w-full rounded-full py-2 text-center text-[13px] font-bold text-brand-muted underline decoration-brand-yellow decoration-2 underline-offset-[3px] transition hover:text-brand-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy sm:min-h-0 sm:py-1.5 sm:text-[12px]"
              onClick={() => {
                setTaste("either");
                setStep(1);
              }}
              type="button"
            >
              {t("I like anything")}
            </button>
          </div>
        )}

        {step === 1 && (
          <div>
            <p className="text-[15px] font-bold text-brand-navy sm:text-[13.5px]">
              {t("Any allergies?")}
            </p>
            {/* Safety framing: the filter is hard, and saying so is what earns the
              customer's trust in the recommendation. */}
            <p className="mt-0.5 text-[12.5px] leading-4 text-brand-muted sm:text-[11.5px]">
              {t("Anything you pick here is never recommended.")}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 sm:gap-1.5">
              {QUIZ_ALLERGENS.map((label) => (
                <button
                  aria-pressed={avoid.includes(label)}
                  className={chipClass(avoid.includes(label))}
                  key={label}
                  onClick={() => toggleAllergen(label)}
                  type="button"
                >
                  {avoid.includes(label) && (
                    <svg
                      aria-hidden="true"
                      className="size-3"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M5 12.5l4.5 4.5L19 7.5"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="3"
                      />
                    </svg>
                  )}
                  {t(QUIZ_ALLERGEN_LABELS[label])}
                </button>
              ))}
            </div>
            <button
              className="mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-brand-yellow px-3 py-2.5 text-[15px] font-extrabold text-brand-navy shadow-[0_2px_10px_rgba(250,204,21,0.35)] transition hover:bg-brand-gold-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy active:scale-[0.98] sm:min-h-0 sm:text-[14px]"
              onClick={() => setStep(2)}
              type="button"
            >
              {avoid.length
                ? t("Show my flavor")
                : t("No allergies, show my flavor")}
              <svg
                aria-hidden="true"
                className="size-4"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  d="M9 6l6 6-6 6"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.4"
                />
              </svg>
            </button>
          </div>
        )}

        {step >= 2 && result && (
          <div>
            {/* The photo carries the answer: a full-width 4:3 image with the name
              and price laid over its foot, so the result reads as a card, not a list row. */}
            <Link
              className="group block overflow-hidden rounded-2xl bg-brand-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
              onClick={() =>
                window.dispatchEvent(new CustomEvent("chat:navigate"))
              }
              to={`/flavor/${result.id}`}
            >
              <span className="relative block aspect-[4/3] w-full overflow-hidden">
                {result.image ? (
                  <img
                    alt={result.name}
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                    decoding="async"
                    loading="lazy"
                    src={result.image}
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <span className="grid size-full place-items-center text-brand-muted">
                    <ChatMark className="size-8" />
                  </span>
                )}
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-navy/85 via-brand-navy/45 to-transparent px-3 pb-2.5 pt-8">
                  <span className="line-clamp-2 block text-[14.5px] font-extrabold leading-5 text-white">
                    {result.name}
                  </span>
                  <span className="mt-0.5 block text-[12px] font-bold text-brand-yellow">
                    {chatPrice(result.price, language)}
                  </span>
                </span>
              </span>
            </Link>
            <div className="mt-2 flex items-center gap-1.5">
              <Link
                className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-brand-yellow px-3 text-center text-[14px] font-extrabold text-brand-navy shadow-[0_2px_8px_rgba(250,204,21,0.3)] transition hover:bg-brand-gold-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy active:scale-[0.98] sm:min-h-9 sm:text-[13px]"
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("chat:navigate"))
                }
                to={`/flavor/${result.id}`}
              >
                {t("View this flavor")}
              </Link>
              <button
                className="min-h-11 rounded-xl border border-brand-border-warm px-3 text-[14px] font-bold text-brand-navy transition hover:bg-brand-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy disabled:border-[#cfe6d2] disabled:bg-[#eef7ef] disabled:text-[#2f6b37] sm:min-h-9 sm:text-[13px]"
                disabled={added}
                onClick={() => {
                  const ok = addToCart({
                    id: result.id,
                    name: result.name,
                    detail: result.detail,
                    description: result.description,
                    image: result.image,
                    price: result.price,
                    itemType: "flavor",
                    stock: result.stock,
                    availableQuantity: result.availableQuantity,
                    allergies: result.allergies,
                  });
                  if (ok) setAdded(true);
                }}
                type="button"
              >
                {added ? t("Added to your bag") : t("Add to bag")}
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-brand-border-warm/70 pt-2">
              <button
                className="min-h-9 rounded-full px-1 py-1 text-[12.5px] font-bold text-brand-navy underline decoration-brand-yellow decoration-2 underline-offset-[3px] transition hover:text-brand-navy/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy sm:min-h-0 sm:text-[11.5px]"
                onClick={() => {
                  setStep(0);
                  setAdded(false);
                }}
                type="button"
              >
                {t("Start over")}
              </button>
              <div className="flex items-center gap-2.5">
                <button
                  className="min-h-9 py-1 text-[12.5px] font-bold text-brand-muted underline decoration-brand-yellow decoration-2 underline-offset-[3px] transition hover:text-brand-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy sm:min-h-0 sm:text-[11.5px]"
                  onClick={() => {
                    setStep(1);
                    setAdded(false);
                  }}
                  type="button"
                >
                  {t("Change allergies")}
                </button>
                <button
                  className="min-h-9 py-1 text-[12.5px] font-bold text-brand-muted transition hover:text-brand-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy sm:min-h-0 sm:text-[11.5px]"
                  onClick={close}
                  type="button"
                >
                  {t("Close")}
                </button>
              </div>
            </div>
          </div>
        )}

        {step >= 2 && !result && (
          <div className="py-1 text-center">
            <span
              aria-hidden="true"
              className="mx-auto grid size-10 place-items-center rounded-full bg-brand-cream text-[18px]"
            >
              🍦
            </span>
            <p className="mt-2 text-[13px] font-bold leading-5 text-brand-navy">
              {noMatchReason(flavors, avoid) === "allergens"
                ? t(
                    "Nothing in the catalog fits those allergies. Ask the shop team and they will find something safe.",
                  )
                : t(
                    "Nothing is in stock right now. Try again later or ask the shop team.",
                  )}
            </p>
            <button
              className="mt-2.5 min-h-11 w-full rounded-xl border border-brand-border-warm px-3 py-2 text-[13.5px] font-extrabold text-brand-navy transition hover:bg-brand-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy active:scale-[0.98] sm:min-h-0 sm:text-[12.5px]"
              onClick={() => setStep(0)}
              type="button"
            >
              {t("Start over")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The order timeline (#6): the live status from the database as steps, so
 * "where is my order?" is one glance. A cancelled or failed payment replaces
 * the steps with a single line — those are not steps on the way.
 */
function ChatOrderCardView({ card }: { card: ChatOrderCard }) {
  const { t, language } = useLanguage();
  const interrupted =
    card.status === "cancelled" || card.status === "payment_failed";
  const current = Math.max(0, ORDER_STEPS.indexOf(card.status));
  const stepLabels: Record<string, string> = {
    processing: t("Confirmed"),
    ready:
      card.fulfillment === "delivery" ? t("Packed") : t("Ready for pickup"),
    out_for_delivery: t("On the way"),
    delivered: t("Delivered"),
  };
  return (
    <div className="mt-2.5 rounded-2xl border border-brand-border-warm bg-white p-3 shadow-[0_8px_20px_rgba(71,42,59,0.08)]">
      <p className="flex items-center justify-between gap-2 text-[13px] font-extrabold text-brand-navy">
        <span>{t("Order #{id}", { id: card.id })}</span>
        {card.total > 0 && (
          <span className="text-xs font-bold text-brand-muted">
            {chatPrice(card.total, language)}
          </span>
        )}
      </p>
      {interrupted ? (
        <p
          className={`mt-2 rounded-xl px-2.5 py-2 text-xs font-bold ${
            card.status === "cancelled"
              ? "bg-[#f4f6f8] text-[#5d7186]"
              : "bg-[#fdecec] text-[#9c2a2a]"
          }`}
        >
          {card.status === "cancelled"
            ? t("This order was cancelled.")
            : t("The payment did not go through — you can retry checkout.")}
        </p>
      ) : (
        <ol className="mt-2 flex items-start gap-1">
          {ORDER_STEPS.map((step, index) => {
            const done = index <= current;
            return (
              <li
                className="flex min-w-0 flex-1 flex-col items-center gap-1"
                key={step}
              >
                <span className="flex w-full items-center">
                  <span
                    aria-hidden="true"
                    className={`h-0.5 flex-1 ${index === 0 ? "bg-transparent" : done ? "bg-[#3d8b40]" : "bg-brand-border-warm"}`}
                  />
                  <span
                    aria-hidden="true"
                    className={`grid size-4 shrink-0 place-items-center rounded-full text-[9px] font-bold ${
                      done
                        ? "bg-[#3d8b40] text-white"
                        : "bg-brand-border-warm text-transparent"
                    } ${index === current ? "ring-2 ring-[#3d8b40]/30" : ""}`}
                  >
                    ✓
                  </span>
                  <span
                    aria-hidden="true"
                    className={`h-0.5 flex-1 ${index === ORDER_STEPS.length - 1 ? "bg-transparent" : index < current ? "bg-[#3d8b40]" : "bg-brand-border-warm"}`}
                  />
                </span>
                <span
                  className={`text-center text-[10px] leading-3 ${done ? "font-bold text-brand-navy" : "text-brand-muted"} ${index === current ? "text-[#2c6a2f]" : ""}`}
                >
                  {stepLabels[step] || step}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/**
 * Leave a number for the team while the thread waits for a person (#2). The
 * number travels as an ordinary customer message in the same thread, so it is
 * already where staff look — no second inbox, no new endpoint.
 */
function LeaveMessageForm({ onSend }: { onSend: (text: string) => void }) {
  const { t } = useLanguage();
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    // Keep a leading + and the digits; anything else a phone keyboard offers
    // (spaces, dashes, brackets) is formatting, not part of the number.
    const digits = phone.replace(/[^\d+]/g, "");
    if (digits.replace(/\D/g, "").length < 8) {
      setError(t("Enter a phone number with at least 8 digits."));
      return;
    }
    setError("");
    onSend(
      [
        t("Please call or message me about my request."),
        `${t("Phone")}: ${digits}`,
        note.trim() ? `${t("Details")}: ${note.trim().slice(0, 300)}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
    writeStorage("cold-stone-chat-leave-message", String(Date.now()));
    setNote("");
    setSent(true);
  };

  if (sent) {
    return (
      <p className="mt-2 text-[12px] font-bold text-[#2c6a2f]" role="status">
        {t("Thank you — the team has it.")}
      </p>
    );
  }

  return (
    <form className="mt-2 space-y-1.5" onSubmit={submit}>
      <label
        className="block text-[12px] font-bold text-[#78520a]"
        htmlFor="chat-leave-phone"
      >
        {t("Leave a phone number")}
      </label>
      <div className="flex gap-1.5">
        <input
          autoComplete="tel"
          className="min-w-0 flex-1 rounded-full border border-[#e0c078] bg-white px-3 py-1.5 text-[13px] font-medium text-brand-navy outline-none focus:border-brand-navy"
          id="chat-leave-phone"
          inputMode="tel"
          maxLength={20}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="+237 6 99 00 00 00"
          type="tel"
          value={phone}
        />
        <button
          className="shrink-0 rounded-full bg-brand-navy px-3 text-xs font-bold text-white transition hover:bg-brand-blue disabled:opacity-60"
          disabled={!phone.trim()}
          type="submit"
        >
          {t("Send")}
        </button>
      </div>
      <input
        aria-label={t("Anything else the team should know?")}
        className="w-full rounded-full border border-[#e0c078] bg-white px-3 py-1.5 text-[13px] font-medium text-brand-navy outline-none focus:border-brand-navy"
        maxLength={300}
        onChange={(event) => setNote(event.target.value)}
        placeholder={t("Anything else the team should know?")}
        value={note}
      />
      {error ? (
        <p className="text-[12px] font-semibold text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </form>
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
        className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold shadow-[0_2px_10px_rgba(250,204,21,0.4)] transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy hover:shadow-[0_4px_14px_rgba(250,204,21,0.5)] active:scale-[0.98] ${
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

/**
 * A product photo the agent's reply carries ([IMG:/menu-official/…]). The whole
 * card is the product's own link when one travelled with the reply, so a tap on
 * the treat opens it. Broken or blocked images disappear instead of a broken icon.
 */
/**
 * Several angles of one product, asked for with "show me more photos": the
 * agent packs them into one [IMGS:a|b|c] tag. A large photo with thumbnails
 * under it; arrows when there is room, and dots too small to tap stay as
 * decoration only. A broken shot is skipped, so a deleted file never blanks
 * the gallery.
 */
function ChatGallery({ shots, path }: { shots: string[]; path?: string }) {
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [active, setActive] = useState(0);
  const alive = shots.filter((shot) => !failed[shot]);
  if (!alive.length) return null;
  const current = Math.min(active, alive.length - 1);
  const photo = (
    <img
      alt=""
      className="block aspect-square w-full cursor-pointer rounded-[14px] object-cover"
      decoding="async"
      loading="lazy"
      onClick={() => {
        if (alive[current + 1]) setActive(current + 1);
        else if (current > 0) setActive(0);
      }}
      onError={() => setFailed((prev) => ({ ...prev, [shots[current]]: true }))}
      src={alive[current]}
    />
  );
  return (
    <div className="mb-2 max-w-[13rem] overflow-hidden rounded-[14px] ring-1 ring-brand-border-warm">
      <div
        className="relative"
        role="group"
        aria-label={`Photo ${current + 1} of ${alive.length}`}
      >
        {path ? (
          <Link aria-label="Open this product" to={path}>
            {photo}
          </Link>
        ) : (
          photo
        )}
        {alive.length > 1 ? (
          <>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-bold text-white"
            >
              {current + 1}/{alive.length}
            </span>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-1.5 flex justify-center gap-1"
            >
              {alive.map((shot, index) => (
                <span
                  className={`size-1.5 rounded-full ${index === current ? "bg-white" : "bg-white/50"}`}
                  key={shot}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
      {alive.length > 1 ? (
        <div className="flex gap-1.5 p-1.5">
          {alive.map((shot, index) => (
            <button
              aria-label={`Show photo ${index + 1}`}
              aria-pressed={index === current}
              className={`h-11 w-11 shrink-0 overflow-hidden rounded-lg ring-1 transition ${
                index === current
                  ? "ring-2 ring-brand-yellow"
                  : "ring-brand-border-warm opacity-70 hover:opacity-100"
              }`}
              key={shot}
              onClick={() => setActive(index)}
              type="button"
            >
              <img
                alt=""
                className="size-full object-cover"
                decoding="async"
                loading="lazy"
                onError={() => setFailed((prev) => ({ ...prev, [shot]: true }))}
                src={shot}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ChatProductImage({ src, path }: { src: string; path?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  const photo = (
    <img
      alt=""
      className="block aspect-square w-full rounded-[14px] object-cover"
      loading="lazy"
      onError={() => setFailed(true)}
      src={src}
    />
  );
  return (
    <div className="mb-2 max-w-[11rem] overflow-hidden rounded-[14px] ring-1 ring-brand-border-warm">
      {path ? (
        <Link aria-label="Open this product" to={path}>
          {photo}
        </Link>
      ) : (
        photo
      )}
    </div>
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
        className={`relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-4 py-2.5 text-sm font-extrabold shadow-[0_2px_10px_rgba(250,204,21,0.4)] transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy hover:shadow-[0_4px_14px_rgba(250,204,21,0.5)] active:scale-[0.98] ${
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
          : "group flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-yellow px-4 py-2.5 text-sm font-extrabold text-brand-navy shadow-[0_2px_10px_rgba(250,204,21,0.4)] transition-all hover:bg-brand-gold-light hover:shadow-[0_4px_14px_rgba(250,204,21,0.5)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy active:scale-[0.98]"
      }
      onClick={() => window.dispatchEvent(new CustomEvent("chat:navigate"))}
      to={action.path}
    >
      {t(action.label)}
      <svg
        aria-hidden="true"
        className="size-3.5 transition-transform group-hover:translate-x-0.5"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          d="M4 12h15m0 0-6-6m6 6-6 6"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
        />
      </svg>
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
        className={`mt-2.5 flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-extrabold shadow-[0_2px_10px_rgba(250,204,21,0.4)] transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy hover:shadow-[0_4px_14px_rgba(250,204,21,0.5)] active:scale-[0.98] ${
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

/**
 * Applies a reply's [BAG:…] tag the moment the reply renders, when the customer's
 * message asked for the change — "remove the mango", "make it two", "empty my
 * bag". The agent's wording claims the edit already happened, so waiting for a
 * button tap makes that a lie; this runs the edit and shows the outcome in
 * place. Runs once per mount; thread re-renders do not re-apply.
 */
function ChatAutoBag({ bag }: { bag: BagEdit }) {
  const { t } = useLanguage();
  const { clearCart, removeFromCart, updateQuantity, cartItems } = useCart();
  const { flavors } = useFlavors();
  const [state, setState] = useState<"applying" | "applied" | "gone">(
    "applying",
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (bag.mode === "clear") {
        clearCart();
        setState("applied");
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
        // The item was already removed (or never added): the requested end
        // state holds, so report success rather than a scare.
        setState(quantity < 1 ? "applied" : "gone");
        return;
      }
      if (quantity < 1) {
        removeFromCart(target.id);
      } else {
        const available =
          target.itemType === "menu"
            ? target.availableQuantity
            : (flavors.find((flavor) => flavor.id === target.id)
                ?.availableQuantity ?? target.availableQuantity);
        updateQuantity(
          target.id,
          Number.isSafeInteger(available) &&
            available > 0 &&
            quantity > available
            ? available
            : quantity,
        );
      }
      setState("applied");
    }, 400);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bag]);

  return (
    <div className="mt-2.5 max-w-[16rem]" aria-live="polite">
      <div
        className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold ${
          state === "applied"
            ? "bg-[#3d8b40] text-white shadow-[0_2px_10px_rgba(61,139,64,0.35)]"
            : "bg-brand-navy/5 text-brand-navy ring-1 ring-brand-navy/10"
        }`}
      >
        {state === "applied"
          ? t("Done")
          : state === "gone"
            ? t("That item is no longer in your bag.")
            : t("Updating your bag…")}
      </div>
    </div>
  );
}

/** Saves the visit the agent chose, so checkout opens with it already set. */
function ChatVisitButton({ visit }: { visit: ChatVisit }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  return (
    <button
      className="mt-2.5 flex w-full items-center justify-center rounded-xl bg-brand-yellow px-4 py-2.5 text-sm font-extrabold text-brand-navy shadow-[0_2px_10px_rgba(250,204,21,0.4)] transition-all hover:bg-brand-gold-light hover:shadow-[0_4px_14px_rgba(250,204,21,0.5)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy active:scale-[0.98]"
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
      className="mt-2.5 flex w-full items-center justify-center rounded-xl bg-brand-yellow px-4 py-2.5 text-sm font-extrabold text-brand-navy shadow-[0_2px_10px_rgba(250,204,21,0.4)] transition-all hover:bg-brand-gold-light hover:shadow-[0_4px_14px_rgba(250,204,21,0.5)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy active:scale-[0.98]"
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
    <div className="mt-3 flex max-w-full flex-wrap items-center gap-1.5">
      <span
        aria-hidden="true"
        className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-brand-muted"
      >
        {t("Suggestions")}
      </span>
      {chips.map((chip) => (
        <button
          className="group flex items-center gap-1 rounded-full border border-brand-border-warm bg-white py-1.5 pl-3 pr-2.5 text-[13px] font-bold text-brand-navy shadow-[0_1px_2px_rgba(15,35,60,0.05)] transition-all hover:-translate-y-px hover:border-brand-yellow hover:bg-brand-yellow/15 hover:shadow-[0_3px_8px_rgba(15,35,60,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow-deep active:scale-[0.98]"
          key={chip}
          onClick={() => onSend(chip)}
          type="button"
        >
          {t(chip)}
          <svg
            aria-hidden="true"
            className="size-3 text-brand-muted transition-all group-hover:translate-x-0.5 group-hover:text-brand-navy"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              d="M4 12h15m0 0-6-6m6 6-6 6"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
            />
          </svg>
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
function ChatAutoAdd({
  addId,
  onAdded,
}: {
  addId: string;
  /** Called once the add succeeded, so a parent card can swap in its own note. */
  onAdded?: () => void;
}) {
  const { t } = useLanguage();
  const { addToCart, cartItems } = useCart();
  const { flavors } = useFlavors();
  const [state, setState] = useState<"adding" | "added" | "failed">("adding");
  // `added` is state; a parent is told after the add actually happened, not before.
  const onAddedRef = useRef(onAdded);
  onAddedRef.current = onAdded;
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
        onAddedRef.current?.();
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
      if (ok) onAddedRef.current?.();
    }, 400);
    return () => window.clearTimeout(timer);
    // cartItems is read through the closure on purpose: the add happens once,
    // 400 ms after mount, against the bag as it is at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addId]);

  return (
    <div className="mt-2.5 max-w-[16rem]" aria-live="polite">
      <div
        className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold ${
          state === "added"
            ? "bg-[#3d8b40] text-white shadow-[0_2px_10px_rgba(61,139,64,0.35)]"
            : state === "failed"
              ? "bg-red-50 text-red-700 ring-1 ring-red-200"
              : "bg-brand-navy/5 text-brand-navy ring-1 ring-brand-navy/10"
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
