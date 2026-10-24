import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiRequest, getCustomerToken } from "../../api/api";
import { useAuth } from "../../context/useAuth";
import { Footer, Header } from "../../components/Layout";
import { PaymentStatusDialog, type PaymentStatus } from "../../components/PaymentStatusDialog";
import { useLanguage } from "../../language/useLanguage";
import { numberFormatter } from "../../lib/cartPricing";
import { photoErrorHandler, thumbnail } from "../../lib/thumbnails";
import { EVENT_OCCASIONS, eventOccasion, isEventType } from "../../../shared/eventTypes.js";
import "./EventOrdersPage.css";

interface EventConfig {
  eventTypes: string[];
  depositPercent: number;
  minTotalQuantity: number;
  minDate: string;
  maxDate: string;
}

interface StoreOption {
  storeId: number;
  storeName: string;
  storeTown: string;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
}

interface CatalogItem {
  itemId: string;
  name: string;
  price: number;
  group: string;
}

interface EventOrderItem {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface EventOrder {
  id: number;
  eventType: string;
  eventDate: string;
  eventTime: string;
  guestCount: number;
  fulfillmentType: "delivery" | "pickup";
  deliveryAddress: string;
  storeName: string | null;
  items: EventOrderItem[];
  estimatedTotal: number;
  quotedTotal: number | null;
  depositAmount: number | null;
  status: string;
  adminNote: string;
  createdAt: string;
}

const EVENT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  EVENT_OCCASIONS.map((event) => [event.id, event.label]),
);

const EVENT_HERO_COPY = {
  birthday: {
    title: "A birthday worth celebrating",
    description: "Bring the party together with scoops and cakes, planned around your guests.",
  },
  office: {
    title: "A sweeter kind of work gathering",
    description: "Share ice cream with your team or meeting, with an order planned for your group.",
  },
  wedding: {
    title: "A sweet finish to your celebration",
    description: "Make room for ice cream at the reception with an order arranged for your day.",
  },
  school: {
    title: "Make the school day a little sweeter",
    description: "Plan scoops for a class or school gathering, with portions for your group.",
  },
  religious: {
    title: "Share a little sweetness together",
    description: "Add ice cream to your gathering with an order coordinated for your guests.",
  },
  other: {
    title: "Tell us what you are celebrating",
    description: "From family gatherings to special occasions, build an ice cream order around your plans.",
  },
} satisfies Record<(typeof EVENT_OCCASIONS)[number]["id"], { title: string; description: string }>;

function eventTypeFromSearch(params: URLSearchParams) {
  const requested = params.get("type");
  return isEventType(requested) ? requested : "birthday";
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  new: { label: "Waiting for the store's quote", className: "bg-[#eef2f7] text-[#33475e]" },
  quoted: { label: "Quote ready: pay the deposit", className: "bg-[#fff3c4] text-[#7a5d00]" },
  deposit_paid: { label: "Deposit paid", className: "bg-[#e3f4e8] text-[#1f6b3e]" },
  confirmed: { label: "Confirmed", className: "bg-[#e3f4e8] text-[#1f6b3e]" },
  completed: { label: "Completed", className: "bg-[#eef2f7] text-[#33475e]" },
  declined: { label: "Declined", className: "bg-red-50 text-red-700" },
  cancelled: { label: "Cancelled", className: "bg-red-50 text-red-700" },
};

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-[#dde4ec] bg-[#f8fafc] px-3.5 py-3 text-sm font-medium text-[#102c50] outline-none! transition placeholder:text-[#9aa5b3] focus:border-[#bd9c00] focus:bg-white focus:ring-4 focus:ring-[#ffdc32]/25";
const labelClass = "block text-xs font-bold text-[#4f6379]";

const EVENT_ICONS: Record<string, string> = {
  birthday: "M4 20h16M6 20v-3.5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2V20M8 14.5c1.2.8 2.2-.7 3.4 0s2.2.9 3.2 0 2.2.8 3.4 0M12 12V8.5M12 6.2v.01",
  office: "M8 7V5.8A1.8 1.8 0 0 1 9.8 4h4.4A1.8 1.8 0 0 1 16 5.8V7M4 7h16v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Zm0 5h16",
  wedding: "M9 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.5 3a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z",
  school: "M3 10 12 5l9 5-9 5-9-5Zm4 2.2V16c0 1.2 2.2 2.8 5 2.8s5-1.6 5-2.8v-3.8",
  religious: "M12 3.5c1.8 2.6 4 4.6 4 7.4a4 4 0 0 1-8 0c0-2.8 2.2-4.8 4-7.4Z",
  other: "M12 4.5 13.4 9H18l-3.7 2.8 1.4 4.4L12 13.6 8.3 16.2l1.4-4.4L6 9h4.6L12 4.5Z",
};

function EventIcon({ id }: { id: string }) {
  const path = EVENT_ICONS[id];
  if (!path) return null;
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
      <path d={path} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  );
}

function OccasionFilm({
  choices,
  onChange,
  value,
  label,
  t,
}: {
  choices: typeof EVENT_OCCASIONS;
  onChange: (id: string) => void;
  value: string;
  label: string;
  t: (key: string, variables?: Record<string, string | number>) => string;
}) {
  return (
    <div aria-label={label} className="event-occasion-options grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" id="event-type" role="radiogroup">
      {choices.map((event) => {
        const selected = value === event.id;
        return (
          <button
            aria-checked={selected}
            className="event-occasion-choice rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2"
            key={event.id}
            onClick={() => onChange(event.id)}
            role="radio"
            type="button"
          >
            <span className="event-occasion-tile relative block overflow-hidden rounded-[18px] bg-[#092a53]">
              <img
                alt=""
                className={`aspect-[5/4] w-full object-cover transition-[filter] ${selected ? "" : "brightness-[0.82]"}`}
                decoding="async"
                loading="lazy"
                onError={photoErrorHandler(event.image, "/images/hero-ice-cream.jpg")}
                sizes="(min-width: 1024px) 180px, 45vw"
                src={thumbnail(event.image, "small")}
              />
              <span className="event-occasion-caption absolute inset-x-0 bottom-0 flex min-h-12 items-center gap-2 bg-[#092a53] px-2.5 py-2 text-white">
                <span className={`grid size-6 shrink-0 place-items-center rounded-full ${selected ? "bg-[#ffdc32] text-[#092a53]" : "bg-white/10 text-[#ffdc32]"}`}>
                  <EventIcon id={event.id} />
                </span>
                <span className="line-clamp-2 text-[13px] font-extrabold leading-4">{t(event.label)}</span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function formatXaf(amount: number, language: string) {
  return `${numberFormatter(language === "fr" ? "fr-CM" : "en-US").format(Math.round(amount || 0))} FCFA`;
}

function groupCatalog(items: CatalogItem[]) {
  const groups: { title: string; items: CatalogItem[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.title === item.group) last.items.push(item);
    else groups.push({ title: item.group, items: [item] });
  }
  return groups;
}

function suggestedDeposit(total: number, percent: number) {
  if (!total) return 0;
  return Math.min(total, Math.ceil((total * percent) / 100 / 100) * 100);
}

export function EventOrdersPage() {
  const { customer, isLoading: authLoading } = useAuth();
  const { t, language } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [config, setConfig] = useState<EventConfig | null>(null);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [methods, setMethods] = useState({ card: false, campayMobileMoney: false });
  const [eventOrders, setEventOrders] = useState<EventOrder[]>([]);
  const [loadError, setLoadError] = useState("");

  const [eventType, setEventType] = useState(() => eventTypeFromSearch(searchParams));
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("15:00");
  const [guestCount, setGuestCount] = useState("30");
  const [fulfillmentType, setFulfillmentType] = useState<"delivery" | "pickup">("delivery");
  const [storeId, setStoreId] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [itemSearch, setItemSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [paymentDialog, setPaymentDialog] = useState<{ status: PaymentStatus; message: string } | null>(null);
  const [paymentCheckAttempt, setPaymentCheckAttempt] = useState(0);

  const [payingId, setPayingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [payMethod, setPayMethod] = useState<"card" | "campay">("card");
  const [payPhone, setPayPhone] = useState("");
  const [payError, setPayError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiRequest<EventConfig>("/event-orders/config"),
      apiRequest<{ zones: StoreOption[] }>("/fulfillment/options"),
      apiRequest<{ categories: { title: string; items: { id: string; name: string; priceXaf: number; isAvailable?: boolean; availableQuantity?: number }[] }[] }>("/menu"),
      apiRequest<{ flavors: { id: number; name: string; price: number; availableQuantity: number }[] }>("/flavors"),
      apiRequest<{ methods: { card: boolean; campayMobileMoney: boolean } }>("/payment/methods"),
    ])
      .then(([configResult, storeResult, menuResult, flavorResult, methodResult]) => {
        if (cancelled) return;
        setConfig(configResult);
        setEventDate((current) => current || configResult?.minDate || "");
        setStores(storeResult?.zones || []);
        const items: CatalogItem[] = [
          ...(flavorResult?.flavors || [])
            .filter((flavor) => flavor.availableQuantity > 0)
            .map((flavor) => ({ itemId: `flavor:${flavor.id}`, name: flavor.name, price: flavor.price, group: "Flavors" })),
          ...(menuResult?.categories || []).flatMap((category) =>
            category.items
              .filter((item) => item.isAvailable !== false && (item.availableQuantity ?? 1) > 0)
              .map((item) => ({ itemId: item.id, name: item.name, price: item.priceXaf, group: category.title }))),
        ];
        setCatalog(items);
        setMethods(methodResult?.methods || { card: false, campayMobileMoney: false });
        setPayMethod(methodResult?.methods?.card ? "card" : "campay");
      })
      .catch((error: unknown) => { if (!cancelled) setLoadError(error instanceof Error ? error.message : "Unable to load event options."); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const requested = searchParams.get("type");
    if (!isEventType(requested)) return;
    setEventType(requested);
    if (!customer) return;
    const frame = window.requestAnimationFrame(() => {
      const node = document.getElementById("event-type");
      if (!node) return;
      const rect = node.getBoundingClientRect();
      if (rect.top < 80 || rect.bottom > window.innerHeight) node.scrollIntoView({ block: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [searchParams, customer]);

  useEffect(() => {
    if (customer?.phone) {
      setPhone((current) => current || customer.phone || "");
      setPayPhone((current) => current || customer.phone || "");
    }
  }, [customer]);

  async function refreshOrders() {
    const token = getCustomerToken();
    if (!token) return;
    const result = await apiRequest<{ eventOrders: EventOrder[] }>("/customer/event-orders", { token });
    setEventOrders(result?.eventOrders || []);
  }

  // Load the customer's event orders, and confirm a deposit when they return from the payment page.
  useEffect(() => {
    if (!customer) return;
    let cancelled = false;
    const token = getCustomerToken();
    const returningId = Number(searchParams.get("event"));
    const fromPayment = Boolean(searchParams.get("session_id") || searchParams.get("provider") === "campay");
    let clearPaymentReturn = false;
    (async () => {
      try {
        if (returningId && searchParams.get("cancelled")) {
          setPaymentDialog({
            status: "cancelled",
            message: t("The deposit payment was cancelled. You can try again below."),
          });
          clearPaymentReturn = true;
        } else if (returningId && searchParams.get("status") === "failed") {
          setPaymentDialog({
            status: "failed",
            message: t("The Mobile Money payment did not go through. You can try again below."),
          });
          clearPaymentReturn = true;
        } else if (returningId && fromPayment) {
          setPaymentDialog({ status: "checking", message: t("Checking your event deposit payment...") });
          const result = await apiRequest<{ paid?: boolean }>(`/customer/event-orders/${returningId}/deposit/confirm`, { method: "POST", token });
          if (!cancelled) {
            setPaymentDialog({
              status: result?.paid ? "success" : "pending",
              message: t(result?.paid
                ? "Deposit received. Your date is booked, and the store will confirm your event shortly."
                : "We're still waiting for the payment to be confirmed. Check again in a moment."),
            });
            clearPaymentReturn = Boolean(result?.paid);
          }
        }
        if (!cancelled) await refreshOrders();
        if (returningId && !cancelled) {
          window.setTimeout(() => document.getElementById(`event-order-${returningId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
        }
      } catch (error) {
        if (!cancelled) {
          if (fromPayment) {
            setPaymentDialog({
              status: "error",
              message: error instanceof Error ? error.message : t("Unable to confirm the event deposit. Please try again."),
            });
          } else {
            setNotice(error instanceof Error ? error.message : t("Unable to load your event orders."));
          }
        }
      } finally {
        if (!cancelled && clearPaymentReturn) {
          const next = new URLSearchParams(searchParams);
          ["session_id", "provider", "status", "cancelled"].forEach((key) => next.delete(key));
          setSearchParams(next, { replace: true });
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer, paymentCheckAttempt]);

  const availableStores = stores.filter((store) => (fulfillmentType === "pickup" ? store.pickupEnabled : store.deliveryEnabled));
  useEffect(() => {
    if (storeId && !availableStores.some((store) => String(store.storeId) === storeId)) setStoreId("");
  }, [availableStores, storeId]);

  const selected = catalog.filter((item) => (quantities[item.itemId] || 0) > 0);
  const totalQuantity = selected.reduce((sum, item) => sum + (quantities[item.itemId] || 0), 0);
  const estimate = selected.reduce((sum, item) => sum + item.price * (quantities[item.itemId] || 0), 0);
  const depositPercent = config?.depositPercent ?? 30;
  const minQuantity = config?.minTotalQuantity ?? 10;
  const deposit = suggestedDeposit(estimate, depositPercent);

  const visibleCatalog = useMemo(() => {
    const query = itemSearch.trim().toLowerCase();
    return catalog
      .filter((item) => !query || `${item.name} ${item.group}`.toLowerCase().includes(query) || t(item.name).toLowerCase().includes(query))
      .slice(0, 40);
  }, [catalog, itemSearch, t]);
  const treatGroups = groupCatalog(visibleCatalog);

  function setQuantity(itemId: string, value: number) {
    setQuantities((current) => ({ ...current, [itemId]: Math.max(0, Math.min(1000, Math.round(value) || 0)) }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    if (totalQuantity < minQuantity) {
      setFormError(t("Event orders start at {count} items in total.", { count: minQuantity }));
      return;
    }
    setSubmitting(true);
    try {
      const result = await apiRequest<{ eventOrder: EventOrder }>("/customer/event-orders", {
        method: "POST",
        token: getCustomerToken(),
        body: {
          eventType, eventDate, eventTime, guestCount: Number(guestCount), fulfillmentType,
          storeId: Number(storeId), deliveryAddress, phone, notes,
          items: selected.map((item) => ({ itemId: item.itemId, quantity: quantities[item.itemId] })),
        },
      });
      setQuantities({});
      setNotes("");
      setNotice(t("Request #{id} sent. The store will reply with a quote, usually within a day.", { id: result?.eventOrder.id ?? "" }));
      await refreshOrders();
      window.setTimeout(() => document.getElementById("my-event-orders")?.scrollIntoView({ behavior: "smooth" }), 200);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t("The request could not be sent."));
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteOrder(order: EventOrder) {
    setDeleteError("");
    setDeletingId(order.id);
    try {
      await apiRequest(`/customer/event-orders/${order.id}`, { method: "DELETE", token: getCustomerToken() });
      setConfirmDeleteId(null);
      setEventOrders((current) => current.filter((item) => item.id !== order.id));
      setNotice(t("Event #{id} deleted.", { id: order.id }));
    } catch (error) {
      setDeleteError(error instanceof Error ? t(error.message) : t("This event could not be deleted."));
    } finally {
      setDeletingId(null);
    }
  }

  async function payDeposit(order: EventOrder) {
    setPayError("");
    setPayingId(order.id);
    try {
      const result = await apiRequest<{ url: string }>(`/customer/event-orders/${order.id}/deposit`, {
        method: "POST",
        token: getCustomerToken(),
        body: { method: payMethod, phone: payPhone },
      });
      if (result?.url) window.location.assign(result.url);
    } catch (error) {
      setPayError(error instanceof Error ? error.message : t("The deposit payment could not be started."));
      setPayingId(null);
    }
  }

  const steps = [
    { title: t("Tell us about your event"), body: t("Date, guests, and the treats you'd like.") },
    { title: t("Get your quote"), body: t("The store confirms the price, usually within a day.") },
    { title: t("Pay a {percent}% deposit", { percent: depositPercent }), body: t("Book your date by card or Mobile Money. The rest is paid on the day.") },
  ];
  const occasionChoices = (config?.eventTypes?.length ? config.eventTypes : EVENT_OCCASIONS.map((event) => event.id))
    .map((id) => eventOccasion(id))
    .filter((event): event is (typeof EVENT_OCCASIONS)[number] => Boolean(event));
  const chosen = eventOccasion(eventType) || occasionChoices[0] || EVENT_OCCASIONS[0];

  function chooseEvent(type: string) {
    setEventType(type);
    const next = new URLSearchParams(searchParams);
    next.set("type", type);
    setSearchParams(next, { replace: true });
  }

  return (
    <div className="event-orders-page min-h-screen bg-[#f5f7fa] text-[#102c50]">
      <Header />
      {paymentDialog && (
        <PaymentStatusDialog
          checkingMessage={t("Please wait while we verify your payment securely.")}
          closeLabel={t("Close")}
          eyebrow={t("Event deposit")}
          message={paymentDialog.message}
          onClose={() => setPaymentDialog(null)}
          onRetry={paymentDialog.status === "pending" ? () => setPaymentCheckAttempt((attempt) => attempt + 1) : undefined}
          retryLabel={t("Check payment again")}
          status={paymentDialog.status}
          successLabel={t("Continue")}
          title={paymentDialog.status === "checking"
            ? t("Confirming your event deposit")
            : paymentDialog.status === "success"
              ? t("Payment confirmed")
              : paymentDialog.status === "pending"
                ? t("Payment is still processing")
                : paymentDialog.status === "cancelled"
                  ? t("Payment cancelled")
                  : paymentDialog.status === "failed"
                    ? t("Payment was not completed")
                    : t("We could not confirm your payment")}
        />
      )}
      <main className="event-orders-main" id="main" tabIndex={-1}>
        <section className="event-page-intro bg-white px-5 pb-10 pt-10 sm:px-8 lg:px-12 lg:pb-12 lg:pt-14">
          <div className="mx-auto max-w-[1200px]">
            <div className="event-hero grid md:grid-cols-[1.1fr_0.9fr]">
              <div className="event-hero-copy flex flex-col justify-center px-6 py-9 sm:px-10 sm:py-12 lg:px-14 lg:py-16">
                <h1 className="mt-0 max-w-xl font-display text-4xl font-extrabold leading-[1.06] tracking-tight text-[#092a53] sm:text-5xl">
                  {t(EVENT_HERO_COPY[chosen.id].title)}
                </h1>
                <p className="mt-4 max-w-lg text-base leading-7 text-[#4f6379]">
                  {t(EVENT_HERO_COPY[chosen.id].description)}
                </p>
                <a className="event-hero-action" href="#event-type">{t("Start an event order")}</a>
              </div>
              <div className="event-hero-image scroll-story-frame relative min-h-56 bg-[#d8e2ee] md:min-h-[360px]">
                <img
                  alt=""
                  className="absolute inset-0 size-full object-cover"
                  decoding="async"
                  fetchPriority="high"
                  onError={photoErrorHandler(chosen.image, "/images/hero-ice-cream.jpg")}
                  src={thumbnail(chosen.image)}
                />
                <div className="absolute inset-x-0 bottom-0 bg-[#092a53]/90 px-5 py-4 text-white sm:px-7">
                  <p className="text-xs font-bold text-[#ffdc32]">{t("Type of event")}</p>
                  <p className="mt-1 font-display text-xl font-extrabold">{t(chosen.label)}</p>
                  <p className="mt-1 text-sm leading-5 text-white/80">{t(chosen.detail)}</p>
                </div>
              </div>
            </div>
            <ol className="event-process grid grid-cols-1 gap-0 sm:grid-cols-3">
              {steps.map((step, index) => (
                <li className="flex gap-3 py-4 sm:px-5 sm:first:pl-0 sm:last:pr-0" key={step.title}>
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#ffdc32] text-sm font-extrabold text-[#092a53]">{index + 1}</span>
                  <div>
                    <p className="font-extrabold text-[#092a53]">{step.title}</p>
                    <p className="mt-1 text-sm leading-6 text-[#65748a]">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <div className="event-page-content mx-auto max-w-[1200px] px-5 py-10 sm:px-8 lg:px-12 lg:py-12">
          {notice && <p className="mb-6 rounded-2xl bg-[#eef6e8] px-5 py-4 text-sm font-semibold text-[#2f5a1a] ring-1 ring-[#d6e8c8]" role="status">{notice}</p>}
          {loadError && <p className="mb-6 rounded-2xl bg-red-50 px-5 py-4 text-sm font-semibold text-red-700" role="alert">{loadError}</p>}

          {!authLoading && !customer ? (
            <section aria-labelledby="event-occasion-title" className="event-signin-layout">
              <div className="event-signin-occasion">
                <h2 className="event-occasion-title" id="event-occasion-title">{t("Type of event")}</h2>
                <OccasionFilm choices={occasionChoices} label={t("Type of event")} onChange={chooseEvent} t={t} value={eventType} />
              </div>
              <div className="event-signin-panel flex flex-col gap-5 rounded-[24px] bg-white p-6 ring-1 ring-[#e2e8f0] sm:flex-row sm:items-end sm:justify-between sm:p-8">
                <div className="max-w-md">
                  <h2 className="font-display text-2xl font-extrabold leading-tight text-[#092a53]" id="plan-event-title">{t("Sign in to plan your event")}</h2>
                  <p className="mt-2 text-sm leading-6 text-[#65748a]">{t("An account lets you follow your quote, pay the deposit and get updates about your event.")}</p>
                </div>
                <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
                  <Link className="inline-flex h-11 items-center justify-center rounded-full bg-[#ffdc32] px-5 text-sm font-extrabold text-[#092a53] transition hover:bg-[#ffe76c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32] focus-visible:ring-offset-2" state={{ from: "/events", type: eventType }} to="/login">{t("Sign in")}</Link>
                  <Link className="inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-bold text-[#092a53] ring-1 ring-[#d7deea] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2" state={{ from: "/events", type: eventType }} to="/signup">{t("Create an account")}</Link>
                </div>
              </div>
            </section>
          ) : customer ? (
            <>
              <form className="event-order-form grid grid-cols-1 gap-8 lg:grid-cols-12" onSubmit={submit}>
                <div className="event-form-fields space-y-8 lg:col-span-8">
                  <section className="event-form-section rounded-[22px] bg-white p-5 ring-1 ring-[#e2e8f0] sm:p-7">
                    <h2 className="font-display text-xl font-extrabold text-[#092a53]">{t("Your event")}</h2>
                    <div className="mt-4">
                      <OccasionFilm choices={occasionChoices} label={t("Type of event")} onChange={chooseEvent} t={t} value={eventType} />
                    </div>
                    <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <label className={labelClass}>
                        {t("Date")}
                        <input className={fieldClass} max={config?.maxDate} min={config?.minDate} onChange={(event) => setEventDate(event.target.value)} required type="date" value={eventDate} />
                      </label>
                      <label className={labelClass}>
                        {t("Time")}
                        <input className={fieldClass} onChange={(event) => setEventTime(event.target.value)} required type="time" value={eventTime} />
                      </label>
                      <label className={labelClass}>
                        {t("Number of guests")}
                        <input className={fieldClass} max={2000} min={5} onChange={(event) => setGuestCount(event.target.value)} required type="number" value={guestCount} />
                      </label>
                    </div>
                  </section>

                  <section className="event-form-section rounded-[22px] bg-white p-5 ring-1 ring-[#e2e8f0] sm:p-7">
                    <h2 className="font-display text-xl font-extrabold text-[#092a53]">{t("Delivery or pickup")}</h2>
                    <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {([
                        ["delivery", "Deliver to my event", "M3 7h11v8H3V7Zm11 3h4l3 3v2h-7M6.5 18.5a1.5 1.5 0 1 0 .01-3 1.5 1.5 0 0 0-.01 3Zm11 0a1.5 1.5 0 1 0 .01-3 1.5 1.5 0 0 0-.01 3Z"],
                        ["pickup", "I'll pick it up", "M4 10.5 12 4l8 6.5M6.5 10v9h11v-9M10 19v-5h4v5"],
                      ] as const).map(([type, label, icon]) => {
                        const selected = fulfillmentType === type;
                        return (
                          <button
                            aria-pressed={selected}
                            className={`event-fulfillment-choice flex items-center gap-3 rounded-2xl px-4 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32] focus-visible:ring-offset-2 ${
                              selected ? "bg-[#092a53] text-white" : "bg-[#f6f3ea] text-[#092a53] hover:bg-[#efe8d6]"
                            }`}
                            key={type}
                            onClick={() => setFulfillmentType(type)}
                            type="button"
                          >
                            <span className={`grid size-11 shrink-0 place-items-center rounded-full ${selected ? "bg-[#ffdc32] text-[#092a53]" : "bg-white text-[#65748a]"}`}>
                              <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
                                <path d={icon} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
                              </svg>
                            </span>
                            <span className="text-sm font-extrabold leading-5">{t(label)}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <label className={labelClass}>
                        {t("Store")}
                        <select className={fieldClass} onChange={(event) => setStoreId(event.target.value)} required value={storeId}>
                          <option value="">{t("Choose a store")}</option>
                          {availableStores.map((store) => (
                            <option key={store.storeId} value={store.storeId}>{t(store.storeName)} · {t(store.storeTown)}</option>
                          ))}
                        </select>
                      </label>
                      <label className={labelClass}>
                        {t("Phone number")}
                        <input autoComplete="tel" className={fieldClass} onChange={(event) => setPhone(event.target.value)} placeholder="+237 6XX XX XX XX" required type="tel" value={phone} />
                      </label>
                      {fulfillmentType === "delivery" && (
                        <label className={`${labelClass} sm:col-span-2`}>
                          {t("Event address")}
                          <input className={fieldClass} maxLength={200} onChange={(event) => setDeliveryAddress(event.target.value)} placeholder={t("Venue, street, neighbourhood, landmark")} required value={deliveryAddress} />
                        </label>
                      )}
                    </div>
                  </section>

                  <section className="event-form-section event-treat-section rounded-[22px] bg-white p-5 ring-1 ring-[#e2e8f0] sm:p-7">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <h2 className="font-display text-xl font-extrabold text-[#092a53]">{t("Choose your treats")}</h2>
                        <p className="mt-1 max-w-sm text-sm leading-6 text-[#65748a]">{t("At least {count} items in total. Prices are per item.", { count: minQuantity })}</p>
                      </div>
                      <input
                        aria-label={t("Search treats")}
                        className="h-11 w-full rounded-full bg-[#f6f3ea] px-4 text-sm font-semibold text-[#092a53] outline-none transition placeholder:font-medium placeholder:text-[#8592a3] focus:bg-white focus:ring-2 focus:ring-[#ffdc32] sm:w-56"
                        onChange={(event) => setItemSearch(event.target.value)}
                        placeholder={t("Search treats")}
                        type="search"
                        value={itemSearch}
                      />
                    </div>
                    {treatGroups.length ? (
                      <div className="mt-6 space-y-6">
                        {treatGroups.map((group) => (
                          <div key={group.title}>
                            <h3 className="text-sm font-extrabold text-[#092a53]">{t(group.title)}</h3>
                            <ul className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                              {group.items.map((item) => {
                                const quantity = quantities[item.itemId] || 0;
                                const picked = quantity > 0;
                                return (
                                  <li className={`event-treat-row flex items-center gap-3 rounded-2xl px-3 py-2.5 ${picked ? "bg-[#092a53] text-white" : "bg-[#f6f3ea] text-[#092a53]"}`} data-selected={picked} key={item.itemId}>
                                    <div className="min-w-0 flex-1">
                                      <p className="line-clamp-2 text-sm font-extrabold leading-5">{t(item.name)}</p>
                                      <p className={`text-xs font-semibold tabular-nums ${picked ? "text-[#ffdc32]" : "text-[#65748a]"}`}>{formatXaf(item.price, language)}</p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1">
                                      <button
                                        aria-label={t("Remove one")}
                                        className={`grid size-8 place-items-center rounded-full text-lg font-bold leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32] disabled:opacity-40 ${picked ? "bg-white/10 text-white" : "bg-white text-[#092a53]"}`}
                                        disabled={!quantity}
                                        onClick={() => setQuantity(item.itemId, quantity - 5)}
                                        type="button"
                                      >−</button>
                                      <input
                                        aria-label={t("Quantity of {name}", { name: t(item.name) })}
                                        className={`w-12 rounded-lg px-1 py-1.5 text-center text-sm font-extrabold tabular-nums outline-none [appearance:textfield] focus:ring-2 focus:ring-[#ffdc32] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${picked ? "bg-white/10 text-white" : "bg-white text-[#092a53] ring-1 ring-[#e7e1d4]"}`}
                                        inputMode="numeric"
                                        min={0}
                                        onChange={(event) => setQuantity(item.itemId, Number(event.target.value))}
                                        placeholder="0"
                                        type="number"
                                        value={quantity || ""}
                                      />
                                      <button
                                        aria-label={t("Add five")}
                                        className={`grid size-8 place-items-center rounded-full text-lg font-bold leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32] ${picked ? "bg-[#ffdc32] text-[#092a53]" : "bg-[#092a53] text-white"}`}
                                        onClick={() => setQuantity(item.itemId, quantity + 5)}
                                        type="button"
                                      >+</button>
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-6 text-sm text-[#65748a]">{t("No items match your search")}</p>
                    )}
                    <label className={`${labelClass} mt-6 border-t border-[#efe8d6] pt-5`}>
                      {t("Notes for the store (optional)")}
                      <textarea className={`${fieldClass} min-h-24 resize-y`} maxLength={500} onChange={(event) => setNotes(event.target.value)} placeholder={t("Theme, allergies, serving needs, anything we should know")} value={notes} />
                    </label>
                  </section>
                </div>

                <aside className="event-estimate-column lg:col-span-4">
                  <div className="event-estimate rounded-[22px] bg-[#092a53] p-6 text-white lg:sticky lg:top-28">
                    <h2 className="font-display text-xl font-extrabold text-white">{t("Your estimate")}</h2>
                    {selected.length ? (
                      <ul className="mt-4 space-y-2 text-sm text-white">
                        {selected.map((item) => (
                          <li className="flex justify-between gap-3" key={item.itemId}>
                            <span className="min-w-0 truncate">{quantities[item.itemId]} × {t(item.name)}</span>
                            <span className="shrink-0 font-semibold tabular-nums">{formatXaf(item.price * quantities[item.itemId], language)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-4 text-sm leading-6 text-white">{t("Add treats to see your estimate.")}</p>
                    )}
                    <dl className="mt-4 space-y-2.5 border-t border-white/20 pt-4 text-sm text-white">
                      <div className="flex justify-between gap-3">
                        <dt>{t("Items")}</dt>
                        <dd className="font-bold tabular-nums">{totalQuantity} / {minQuantity}+</dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <dt>{t("Estimated total")}</dt>
                        <dd className="font-display text-lg font-extrabold tabular-nums">{formatXaf(estimate, language)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt>{t("Deposit ({percent}%)", { percent: depositPercent })}</dt>
                        <dd className="font-bold tabular-nums">{formatXaf(deposit, language)}</dd>
                      </div>
                    </dl>
                    <p className="mt-4 text-sm leading-6 text-white">{t("Nothing is charged now. The store confirms the final price first, then you pay the deposit to book your date.")}</p>
                    {formError && <p className="mt-4 rounded-xl bg-white/15 px-3 py-2.5 text-sm font-semibold text-white" role="alert">{formError}</p>}
                    <button className="mt-5 w-full rounded-full bg-[#ffdc32] px-6 py-3.5 text-sm font-extrabold text-[#092a53] transition hover:bg-[#ffe76c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-wait disabled:opacity-60" disabled={submitting} type="submit">
                      {submitting ? t("Sending…") : t("Request a quote")}
                    </button>
                  </div>
                </aside>
              </form>

              <section aria-labelledby="my-event-orders-title" className="event-orders-list mt-14 scroll-mt-28" id="my-event-orders">
                <h2 className="font-display text-2xl font-extrabold text-[#092a53]" id="my-event-orders-title">{t("Your event orders")}</h2>
                {!eventOrders.length ? (
                  <p className="mt-3 text-sm text-[#65748a]">{t("Your requests will appear here.")}</p>
                ) : (
                  <ul className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                    {eventOrders.map((order) => {
                      const status = STATUS_STYLES[order.status] || STATUS_STYLES.new;
                      const total = order.quotedTotal ?? order.estimatedTotal;
                      return (
                        <li className="event-order-card scroll-mt-28 rounded-[22px] bg-white p-5 ring-1 ring-[#e2e8f0]" id={`event-order-${order.id}`} key={order.id}>
                          <div className="flex items-start gap-3">
                            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#092a53] text-[#ffdc32]">
                              <EventIcon id={order.eventType} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <p className="font-extrabold text-[#092a53]">{t(EVENT_TYPE_LABELS[order.eventType] || "Event")} · #{order.id}</p>
                                <span className={`rounded-full px-3 py-1 text-xs font-bold ${status.className}`}>{t(status.label)}</span>
                              </div>
                              <p className="mt-1 text-sm text-[#65748a]">{order.eventDate} · {order.eventTime} · {t("{count} guests", { count: order.guestCount })}</p>
                            </div>
                          </div>
                          <p className="mt-4 text-sm leading-6 text-[#4f6379]">
                            {order.items.map((item) => `${item.quantity} × ${t(item.name)}`).join(", ")}
                          </p>
                          <dl className="mt-4 flex gap-8 border-t border-[#efe8d6] pt-4 text-sm">
                            <div>
                              <dt className="text-xs font-semibold text-[#65748a]">{t(order.quotedTotal ? "Quoted total" : "Estimated total")}</dt>
                              <dd className="mt-0.5 font-extrabold tabular-nums text-[#092a53]">{formatXaf(total, language)}</dd>
                            </div>
                            <div>
                              <dt className="text-xs font-semibold text-[#65748a]">{t("Deposit")}</dt>
                              <dd className="mt-0.5 font-extrabold tabular-nums text-[#092a53]">{order.depositAmount ? formatXaf(order.depositAmount, language) : "—"}</dd>
                            </div>
                          </dl>
                          {order.adminNote && <p className="mt-4 rounded-2xl bg-[#fff8d6] px-4 py-3 text-sm leading-6 text-[#5c4a00]">{t("Note from the store")}: {order.adminNote}</p>}
                          {order.status === "quoted" && order.depositAmount && (
                            <div className="mt-4 rounded-2xl bg-[#f6f3ea] p-4">
                              <p className="text-sm font-extrabold text-[#092a53]">{t("Pay the deposit to book your date")}</p>
                              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {methods.card && (
                                  <button aria-pressed={payMethod === "card"} className={`rounded-2xl px-4 py-3 text-left text-sm font-extrabold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32] ${payMethod === "card" ? "bg-[#092a53] text-white" : "bg-white text-[#092a53]"}`} onClick={() => setPayMethod("card")} type="button">{t("Card")}</button>
                                )}
                                {methods.campayMobileMoney && (
                                  <button aria-pressed={payMethod === "campay"} className={`rounded-2xl px-4 py-3 text-left text-sm font-extrabold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32] ${payMethod === "campay" ? "bg-[#092a53] text-white" : "bg-white text-[#092a53]"}`} onClick={() => setPayMethod("campay")} type="button">{t("Mobile Money")}</button>
                                )}
                              </div>
                              {payMethod === "campay" && (
                                <label className={`${labelClass} mt-3`}>
                                  {t("Mobile Money number")}
                                  <input className={fieldClass} onChange={(event) => setPayPhone(event.target.value)} placeholder="6XX XX XX XX" type="tel" value={payPhone} />
                                </label>
                              )}
                              {payError && payingId === null && <p className="mt-3 text-sm font-semibold text-red-700" role="alert">{payError}</p>}
                              <button className="mt-3 w-full rounded-full bg-[#ffdc32] px-5 py-3 text-sm font-extrabold text-[#092a53] transition hover:bg-[#ffe76c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60" disabled={payingId === order.id || (!methods.card && !methods.campayMobileMoney)} onClick={() => payDeposit(order)} type="button">
                                {payingId === order.id ? t("Opening payment…") : t("Pay {amount} deposit", { amount: formatXaf(order.depositAmount, language) })}
                              </button>
                            </div>
                          )}
                          {["new", "quoted", "declined", "cancelled"].includes(order.status) && (
                            confirmDeleteId === order.id ? (
                              <div className="mt-4 rounded-2xl bg-[#f6f3ea] p-4">
                                <p className="text-sm font-extrabold text-[#092a53]">{t("Delete this event?")}</p>
                                <p className="mt-1 text-sm leading-6 text-[#65748a]">{t("This removes the request. It cannot be undone.")}</p>
                                {deleteError && <p className="mt-2 text-sm font-semibold text-red-700" role="alert">{deleteError}</p>}
                                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                  <button className="inline-flex h-11 items-center justify-center rounded-full bg-[#092a53] px-5 text-sm font-extrabold text-white transition hover:bg-[#0d3a72] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60" disabled={deletingId === order.id} onClick={() => deleteOrder(order)} type="button">
                                    {deletingId === order.id ? t("Deleting…") : t("Delete event")}
                                  </button>
                                  <button className="inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-bold text-[#092a53] ring-1 ring-[#d7deea] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2" onClick={() => { setConfirmDeleteId(null); setDeleteError(""); }} type="button">
                                    {t("Keep event")}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button className="mt-4 inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-bold text-[#092a53] ring-1 ring-[#d7deea] transition hover:bg-[#f6f3ea] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2" onClick={() => { setConfirmDeleteId(order.id); setDeleteError(""); }} type="button">
                                {t("Delete event")}
                              </button>
                            )
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </>
          ) : null}

          <p className="mt-12 text-center text-sm text-[#65748a]">
            {t("Need a cake for the party?")} <Link className="font-bold text-[#092a53] underline decoration-[#ffdc32] decoration-2 underline-offset-4" to="/custom-cake">{t("Request a custom cake")}</Link>
          </p>
        </div>
        </main>
      <Footer />
    </div>
  );
}
