import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiRequest, getCustomerToken } from "../../../api/api";
import { useAuth } from "../../../authcontext/useAuth";
import { Footer, Header } from "../../../components/Layout";
import { useLanguage } from "../../../language/useLanguage";

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

const EVENT_TYPE_LABELS: Record<string, string> = {
  birthday: "Birthday party",
  office: "Office event",
  wedding: "Wedding",
  school: "School event",
  religious: "Religious celebration",
  other: "Other event",
};

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

function formatXaf(amount: number, language: string) {
  return `${new Intl.NumberFormat(language === "fr" ? "fr-CM" : "en-US").format(Math.round(amount || 0))} FCFA`;
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

  const [eventType, setEventType] = useState("birthday");
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

  const [payingId, setPayingId] = useState<number | null>(null);
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
    const fromPayment = searchParams.get("session_id") || searchParams.get("provider") === "campay";
    (async () => {
      try {
        if (returningId && searchParams.get("cancelled")) {
          setNotice(t("The deposit payment was cancelled. You can try again below."));
        } else if (returningId && searchParams.get("status") === "failed") {
          setNotice(t("The Mobile Money payment did not go through. You can try again below."));
        } else if (returningId && fromPayment) {
          const result = await apiRequest<{ paid?: boolean }>(`/customer/event-orders/${returningId}/deposit/confirm`, { method: "POST", token });
          if (!cancelled) {
            setNotice(result?.paid
              ? t("Deposit received. Your date is booked, and the store will confirm your event shortly.")
              : t("We're still waiting for the payment to be confirmed. Refresh this page in a minute."));
          }
        }
        if (!cancelled) await refreshOrders();
        if (returningId && !cancelled) {
          window.setTimeout(() => document.getElementById(`event-order-${returningId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
        }
      } catch (error) {
        if (!cancelled) setNotice(error instanceof Error ? error.message : t("Unable to load your event orders."));
      } finally {
        if (!cancelled && fromPayment) {
          const next = new URLSearchParams(searchParams);
          ["session_id", "provider", "status", "cancelled"].forEach((key) => next.delete(key));
          setSearchParams(next, { replace: true });
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer]);

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

  return (
    <div className="min-h-screen bg-[#fbfaf5] text-[#102c50]">
      <Header />
      <main>
        <section className="relative isolate overflow-hidden bg-[#092a53] px-5 pb-16 pt-14 text-white sm:px-8 lg:px-12 lg:pb-20 lg:pt-20">
          <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-40 -z-10 size-[38rem] rounded-full bg-[#ffdc32]/[0.12] blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-56 -left-40 -z-10 size-[34rem] rounded-full bg-[#1c4f8a]/50 blur-3xl" />
          <div className="mx-auto max-w-[1200px]">
            <p className="inline-flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#ffdc32]">
              <span aria-hidden="true" className="h-px w-10 bg-[#ffdc32]" />
              {t("Parties & events")}
            </p>
            <h1 className="mt-4 max-w-2xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
              {t("Ice cream for birthdays, offices and celebrations")}
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-white/75">
              {t("Order in bulk for your event. We prepare everything and deliver it, or you pick it up from your nearest store.")}
            </p>
            <ol className="mt-10 grid gap-4 sm:grid-cols-3">
              {steps.map((step, index) => (
                <li className="rounded-2xl bg-white/[0.07] p-5 ring-1 ring-white/10" key={step.title}>
                  <span className="grid size-8 place-items-center rounded-full bg-[#ffdc32] text-sm font-extrabold text-[#092a53]">{index + 1}</span>
                  <p className="mt-3 font-extrabold">{step.title}</p>
                  <p className="mt-1 text-sm leading-6 text-white/70">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-8 lg:px-12">
          {notice && (
            <p className="mb-6 rounded-2xl bg-[#eef6e8] px-5 py-4 text-sm font-semibold text-[#2f5a1a] ring-1 ring-[#d6e8c8]" role="status">{notice}</p>
          )}
          {loadError && <p className="mb-6 rounded-2xl bg-red-50 px-5 py-4 text-sm font-semibold text-red-700" role="alert">{loadError}</p>}

          {!authLoading && !customer ? (
            <div className="mx-auto max-w-xl rounded-[28px] bg-white p-8 text-center shadow-[0_14px_40px_rgba(9,42,83,0.07)] ring-1 ring-[#ebe7dc]">
              <h2 className="font-display text-2xl font-extrabold text-[#092a53]">{t("Sign in to plan your event")}</h2>
              <p className="mt-2 text-sm leading-6 text-[#65748a]">{t("An account lets you follow your quote, pay the deposit and get updates about your event.")}</p>
              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                <Link className="rounded-full bg-[#092a53] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#163e6b]" to="/login">{t("Sign in")}</Link>
                <Link className="rounded-full px-6 py-3 text-sm font-bold text-[#092a53] ring-1 ring-[#d5dde8] transition hover:ring-[#092a53]" to="/signup">{t("Create an account")}</Link>
              </div>
            </div>
          ) : customer ? (
            <>
              <form className="grid gap-8 lg:grid-cols-12" onSubmit={submit}>
                <div className="space-y-8 lg:col-span-8">
                  <section className="rounded-[24px] bg-white p-6 shadow-[0_14px_40px_rgba(9,42,83,0.06)] ring-1 ring-[#ebe7dc] sm:p-7">
                    <h2 className="font-display text-xl font-extrabold text-[#092a53]">{t("Your event")}</h2>
                    <div className="mt-5 flex flex-wrap gap-2" role="radiogroup" aria-label={t("Type of event")}>
                      {(config?.eventTypes || Object.keys(EVENT_TYPE_LABELS)).map((type) => (
                        <button
                          aria-checked={eventType === type}
                          className={`rounded-full px-4 py-2 text-sm font-bold transition ${eventType === type ? "bg-[#092a53] text-white" : "bg-[#f4f6f9] text-[#4f6379] hover:text-[#092a53]"}`}
                          key={type}
                          onClick={() => setEventType(type)}
                          role="radio"
                          type="button"
                        >
                          {t(EVENT_TYPE_LABELS[type] || type)}
                        </button>
                      ))}
                    </div>
                    <div className="mt-5 grid gap-4 sm:grid-cols-3">
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

                  <section className="rounded-[24px] bg-white p-6 shadow-[0_14px_40px_rgba(9,42,83,0.06)] ring-1 ring-[#ebe7dc] sm:p-7">
                    <h2 className="font-display text-xl font-extrabold text-[#092a53]">{t("Delivery or pickup")}</h2>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      {(["delivery", "pickup"] as const).map((type) => (
                        <button
                          aria-pressed={fulfillmentType === type}
                          className={`rounded-2xl p-4 text-left text-sm font-bold ring-1 transition ${fulfillmentType === type ? "bg-[#fff8dd] text-[#092a53] ring-[#e6cf6a]" : "bg-[#f8fafc] text-[#4f6379] ring-[#e3e9f1] hover:ring-[#c9d4e0]"}`}
                          key={type}
                          onClick={() => setFulfillmentType(type)}
                          type="button"
                        >
                          {t(type === "delivery" ? "Deliver to my event" : "I'll pick it up")}
                        </button>
                      ))}
                    </div>
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
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

                  <section className="rounded-[24px] bg-white p-6 shadow-[0_14px_40px_rgba(9,42,83,0.06)] ring-1 ring-[#ebe7dc] sm:p-7">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <h2 className="font-display text-xl font-extrabold text-[#092a53]">{t("Choose your treats")}</h2>
                        <p className="mt-1 text-sm text-[#65748a]">{t("At least {count} items in total. Prices are per item.", { count: minQuantity })}</p>
                      </div>
                      <input className={`${fieldClass} mt-0 sm:w-64`} onChange={(event) => setItemSearch(event.target.value)} placeholder={t("Search treats")} type="search" value={itemSearch} />
                    </div>
                    <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
                      {visibleCatalog.map((item) => {
                        const quantity = quantities[item.itemId] || 0;
                        return (
                          <li className={`flex items-center gap-3 rounded-2xl p-3 ring-1 transition ${quantity ? "bg-[#fffbea] ring-[#ecdfa6]" : "bg-[#fbfaf5] ring-[#efece3]"}`} key={item.itemId}>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-[#092a53]">{t(item.name)}</p>
                              <p className="text-xs text-[#8592a3]">{t(item.group)} · {formatXaf(item.price, language)}</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button aria-label={t("Remove one")} className="grid size-8 place-items-center rounded-lg bg-white text-lg font-bold text-[#4f6379] ring-1 ring-[#e3e9f1] disabled:opacity-40" disabled={!quantity} onClick={() => setQuantity(item.itemId, quantity - 5)} type="button">−</button>
                              <input aria-label={t("Quantity of {name}", { name: t(item.name) })} className="w-14 rounded-lg border border-[#dde4ec] bg-white px-1 py-1.5 text-center text-sm font-bold tabular-nums text-[#092a53] outline-none! focus:border-[#bd9c00]" inputMode="numeric" min={0} onChange={(event) => setQuantity(item.itemId, Number(event.target.value))} type="number" value={quantity || ""} placeholder="0" />
                              <button aria-label={t("Add five")} className="grid size-8 place-items-center rounded-lg bg-[#092a53] text-lg font-bold text-white" onClick={() => setQuantity(item.itemId, quantity + 5)} type="button">+</button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    <label className={`${labelClass} mt-6`}>
                      {t("Notes for the store (optional)")}
                      <textarea className={`${fieldClass} min-h-24 resize-y`} maxLength={500} onChange={(event) => setNotes(event.target.value)} placeholder={t("Theme, allergies, serving needs, anything we should know")} value={notes} />
                    </label>
                  </section>
                </div>

                <aside className="lg:col-span-4">
                  <div className="space-y-4 rounded-[24px] bg-white p-6 shadow-[0_14px_40px_rgba(9,42,83,0.08)] ring-1 ring-[#ebe7dc] lg:sticky lg:top-28">
                    <h2 className="font-display text-xl font-extrabold text-[#092a53]">{t("Your estimate")}</h2>
                    {selected.length ? (
                      <ul className="space-y-1.5 text-sm">
                        {selected.map((item) => (
                          <li className="flex justify-between gap-3" key={item.itemId}>
                            <span className="min-w-0 truncate text-[#4f6379]">{quantities[item.itemId]} × {t(item.name)}</span>
                            <span className="shrink-0 font-semibold tabular-nums">{formatXaf(item.price * quantities[item.itemId], language)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-[#8592a3]">{t("Add treats to see your estimate.")}</p>
                    )}
                    <dl className="space-y-2 border-t border-[#eef1f5] pt-4 text-sm">
                      <div className="flex justify-between"><dt className="text-[#65748a]">{t("Items")}</dt><dd className={`font-bold tabular-nums ${totalQuantity && totalQuantity < minQuantity ? "text-[#a46200]" : ""}`}>{totalQuantity} / {minQuantity}+</dd></div>
                      <div className="flex justify-between"><dt className="text-[#65748a]">{t("Estimated total")}</dt><dd className="font-extrabold tabular-nums text-[#092a53]">{formatXaf(estimate, language)}</dd></div>
                      <div className="flex justify-between"><dt className="text-[#65748a]">{t("Deposit ({percent}%)", { percent: depositPercent })}</dt><dd className="font-bold tabular-nums">{formatXaf(deposit, language)}</dd></div>
                    </dl>
                    <p className="text-xs leading-5 text-[#8592a3]">{t("Nothing is charged now. The store confirms the final price first, then you pay the deposit to book your date.")}</p>
                    {formError && <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700" role="alert">{formError}</p>}
                    <button className="w-full rounded-full bg-[#ffdc32] px-6 py-3.5 text-sm font-extrabold text-[#092a53] transition hover:bg-[#ffe76c] disabled:cursor-wait disabled:opacity-60" disabled={submitting} type="submit">
                      {submitting ? t("Sending…") : t("Request a quote")}
                    </button>
                  </div>
                </aside>
              </form>

              <section aria-labelledby="my-event-orders-title" className="mt-14 scroll-mt-28" id="my-event-orders">
                <h2 className="font-display text-2xl font-extrabold text-[#092a53]" id="my-event-orders-title">{t("Your event orders")}</h2>
                {!eventOrders.length ? (
                  <p className="mt-3 text-sm text-[#65748a]">{t("Your requests will appear here.")}</p>
                ) : (
                  <ul className="mt-5 grid gap-4 md:grid-cols-2">
                    {eventOrders.map((order) => {
                      const status = STATUS_STYLES[order.status] || STATUS_STYLES.new;
                      const total = order.quotedTotal ?? order.estimatedTotal;
                      return (
                        <li className="scroll-mt-28 rounded-[22px] bg-white p-5 shadow-[0_10px_30px_-18px_rgba(9,42,83,0.35)] ring-1 ring-[#ebe7dc]" id={`event-order-${order.id}`} key={order.id}>
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="font-extrabold text-[#092a53]">{t(EVENT_TYPE_LABELS[order.eventType] || "Event")} · #{order.id}</p>
                              <p className="mt-0.5 text-sm text-[#65748a]">{order.eventDate} · {order.eventTime} · {t("{count} guests", { count: order.guestCount })}</p>
                            </div>
                            <span className={`rounded-full px-3 py-1 text-xs font-bold ${status.className}`}>{t(status.label)}</span>
                          </div>
                          <p className="mt-3 text-sm text-[#4f6379]">
                            {order.items.map((item) => `${item.quantity} × ${t(item.name)}`).join(", ")}
                          </p>
                          <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                            <div className="rounded-xl bg-[#f8fafc] p-3"><dt className="text-xs text-[#8592a3]">{t(order.quotedTotal ? "Quoted total" : "Estimated total")}</dt><dd className="font-extrabold tabular-nums">{formatXaf(total, language)}</dd></div>
                            <div className="rounded-xl bg-[#f8fafc] p-3"><dt className="text-xs text-[#8592a3]">{t("Deposit")}</dt><dd className="font-extrabold tabular-nums">{order.depositAmount ? formatXaf(order.depositAmount, language) : "—"}</dd></div>
                          </dl>
                          {order.adminNote && <p className="mt-3 rounded-xl bg-[#fffbea] px-3 py-2 text-sm text-[#5c4a00]">{t("Note from the store")}: {order.adminNote}</p>}
                          {order.status === "quoted" && order.depositAmount && (
                            <div className="mt-4 space-y-3 rounded-2xl bg-[#fbfaf5] p-4 ring-1 ring-[#efece3]">
                              <p className="text-sm font-bold text-[#092a53]">{t("Pay the deposit to book your date")}</p>
                              <div className="flex flex-wrap gap-2">
                                {methods.card && (
                                  <button aria-pressed={payMethod === "card"} className={`rounded-full px-4 py-2 text-sm font-bold ring-1 ${payMethod === "card" ? "bg-[#092a53] text-white ring-[#092a53]" : "bg-white text-[#4f6379] ring-[#e3e9f1]"}`} onClick={() => setPayMethod("card")} type="button">{t("Card")}</button>
                                )}
                                {methods.campayMobileMoney && (
                                  <button aria-pressed={payMethod === "campay"} className={`rounded-full px-4 py-2 text-sm font-bold ring-1 ${payMethod === "campay" ? "bg-[#092a53] text-white ring-[#092a53]" : "bg-white text-[#4f6379] ring-[#e3e9f1]"}`} onClick={() => setPayMethod("campay")} type="button">{t("Mobile Money")}</button>
                                )}
                              </div>
                              {payMethod === "campay" && (
                                <label className={labelClass}>
                                  {t("Mobile Money number")}
                                  <input className={fieldClass} onChange={(event) => setPayPhone(event.target.value)} placeholder="6XX XX XX XX" type="tel" value={payPhone} />
                                </label>
                              )}
                              {payError && payingId === null && <p className="text-sm font-semibold text-red-700" role="alert">{payError}</p>}
                              <button className="w-full rounded-full bg-[#ffdc32] px-5 py-3 text-sm font-extrabold text-[#092a53] transition hover:bg-[#ffe76c] disabled:cursor-wait disabled:opacity-60" disabled={payingId === order.id || (!methods.card && !methods.campayMobileMoney)} onClick={() => payDeposit(order)} type="button">
                                {payingId === order.id ? t("Opening payment…") : t("Pay {amount} deposit", { amount: formatXaf(order.depositAmount, language) })}
                              </button>
                            </div>
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
