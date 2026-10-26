import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiRequest } from "../../api/api";
import { useLanguage } from "../../language/useLanguage";
import { useAdminAuth } from "./useAdminAuth";
import { whatsappLink } from "../../lib/whatsapp";
import { WhatsAppIcon } from "../../components/WhatsAppIcon";

interface EventOrderItem {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface EventOrder {
  id: number;
  storeName: string | null;
  eventType: string;
  eventDate: string;
  eventTime: string;
  guestCount: number;
  fulfillmentType: "delivery" | "pickup";
  deliveryAddress: string;
  items: EventOrderItem[];
  notes: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  estimatedTotal: number;
  quotedTotal: number | null;
  depositAmount: number | null;
  suggestedDeposit: number;
  status: string;
  adminNote: string;
  depositProvider: string | null;
  depositPaidAt: string | null;
  createdAt: string;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  birthday: "Birthday party", office: "Office event", wedding: "Wedding", school: "School event",
  religious: "Religious celebration", other: "Other event",
};

const STATUS: Record<string, { label: string; className: string }> = {
  new: { label: "New request", className: "bg-[#e8f0fb] text-[#1d4f91]" },
  quoted: { label: "Quote sent", className: "bg-[#fff3c4] text-[#7a5d00]" },
  deposit_paid: { label: "Deposit paid", className: "bg-[#e3f4e8] text-[#1f6b3e]" },
  confirmed: { label: "Confirmed", className: "bg-[#d9f0e1] text-[#165a33]" },
  completed: { label: "Completed", className: "bg-[#f4f6f8] text-[#65748a]" },
  declined: { label: "Declined", className: "bg-red-50 text-red-700" },
  cancelled: { label: "Cancelled", className: "bg-red-50 text-red-700" },
};

const FILTERS = [
  { key: "open", label: "Needs action", match: (status: string) => ["new", "deposit_paid"].includes(status) },
  { key: "upcoming", label: "Upcoming", match: (status: string) => ["quoted", "deposit_paid", "confirmed"].includes(status) },
  { key: "all", label: "All", match: () => true },
];

const inputClass =
  "mt-1.5 w-full rounded-md border border-[#dce3eb] bg-[#f4f6f8] px-3.5 py-2.5 text-sm font-medium text-brand-navy outline-none! transition focus:border-brand-yellow-deep focus:bg-white focus:ring-4 focus:ring-brand-yellow/25";

function formatXaf(amount: number | null | undefined, language: string) {
  return `${new Intl.NumberFormat(language === "fr" ? "fr-CM" : "en-US").format(Math.round(amount || 0))} FCFA`;
}

export function AdminEventOrdersPage() {
  const { sessionToken } = useAdminAuth();
  const { t, language } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState<EventOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("open");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [quotedTotal, setQuotedTotal] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState("");

  const refresh = useCallback(async () => {
    const result = await apiRequest<{ eventOrders: EventOrder[] }>("/admin/event-orders", { token: sessionToken });
    setOrders(result?.eventOrders || []);
  }, [sessionToken]);

  useEffect(() => {
    let cancelled = false;
    refresh()
      .catch((loadError: unknown) => { if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load event orders."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refresh]);

  // Links in admin emails open the event directly.
  const linkedId = Number(searchParams.get("event")) || null;
  useEffect(() => {
    if (!linkedId || loading) return;
    if (orders.some((order) => order.id === linkedId)) {
      setFilter("all");
      setSelectedId(linkedId);
    }
    const next = new URLSearchParams(searchParams);
    next.delete("event");
    setSearchParams(next, { replace: true });
  }, [linkedId, loading, orders, searchParams, setSearchParams]);

  const selected = orders.find((order) => order.id === selectedId) || null;
  useEffect(() => {
    if (!selected) return;
    const total = selected.quotedTotal ?? selected.estimatedTotal;
    setQuotedTotal(String(total));
    setDepositAmount(String(selected.depositAmount ?? selected.suggestedDeposit));
    setAdminNote(selected.adminNote || "");
    setActionError("");
    // Only reset the form when a different event is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const activeFilter = FILTERS.find((entry) => entry.key === filter) || FILTERS[0];
  const visible = orders.filter((order) => activeFilter.match(order.status));
  const counts = Object.fromEntries(FILTERS.map((entry) => [entry.key, orders.filter((order) => entry.match(order.status)).length]));

  async function act(action: string) {
    if (!selected) return;
    setWorking(true);
    setActionError("");
    try {
      await apiRequest(`/admin/event-orders/${selected.id}`, {
        method: "PATCH",
        token: sessionToken,
        body: { action, adminNote, quotedTotal: Number(quotedTotal), depositAmount: Number(depositAmount) },
      });
      await refresh();
      setMessage({
        quote: t("Quote sent to {name}. They can now pay the deposit.", { name: selected.customerName }),
        decline: t("Request declined. The customer has been told."),
        confirm: t("Event confirmed. The customer has been told."),
        complete: t("Event marked as completed."),
        cancel: t("Event order cancelled."),
      }[action] || t("Saved."));
      if (action !== "quote") setSelectedId(null);
    } catch (actError) {
      setActionError(actError instanceof Error ? actError.message : t("The change could not be saved."));
    } finally {
      setWorking(false);
    }
  }

  async function deleteDeclinedOrder() {
    if (!selected || selected.status !== "declined") return;
    setIsDeleting(true);
    setActionError("");
    try {
      await apiRequest(`/admin/event-orders/${selected.id}`, {
        method: "DELETE",
        token: sessionToken,
      });
      setIsDeleteConfirmOpen(false);
      setSelectedId(null);
      setMessage(t("Declined event order #{id} deleted.", { id: selected.id }));
      try {
        await refresh();
      } catch (refreshError) {
        setError(refreshError instanceof Error ? refreshError.message : t("Unable to load event orders."));
      }
    } catch (deleteError) {
      setActionError(deleteError instanceof Error ? deleteError.message : t("The event order could not be deleted."));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-yellow-deep">{t("Parties & events")}</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-brand-navy">{t("Event orders")}</h1>
        <p className="mt-1 text-sm text-[#65748a]">{t("Review requests, send quotes with a deposit, and confirm events once the deposit is paid.")}</p>
      </header>

      {message && (
        <p className="flex items-center justify-between gap-3 rounded-md bg-[#eaf6ee] px-4 py-3 text-sm font-semibold text-[#1f5d3c] ring-1 ring-[#cfe8d8]" role="status">
          {message}
          <button className="text-xs font-bold underline" onClick={() => setMessage("")} type="button">{t("Dismiss")}</button>
        </p>
      )}
      {error && <p className="rounded-md bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert">{error}</p>}

      <div className="flex flex-wrap gap-2" role="tablist">
        {FILTERS.map((entry) => (
          <button
            aria-selected={filter === entry.key}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${filter === entry.key ? "bg-brand-navy text-white" : "bg-white text-[#65748a] ring-1 ring-[#e3e9f1] hover:text-brand-navy"}`}
            key={entry.key}
            onClick={() => setFilter(entry.key)}
            role="tab"
            type="button"
          >
            {t(entry.label)} <span className="ml-1 tabular-nums opacity-70">{counts[entry.key]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-[#65748a]">{t("Loading…")}</p>
      ) : !visible.length ? (
        <div className="rounded-md border border-dashed border-[#dce3eb] bg-white px-6 py-14 text-center">
          <p className="text-sm font-semibold text-brand-navy">{t("No event orders here")}</p>
          <p className="mt-1 text-sm text-[#65748a]">{t("New requests from the Parties & events page will appear here.")}</p>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((order) => {
            const status = STATUS[order.status] || STATUS.new;
            return (
              <li key={order.id}>
                <button
                  className="h-full w-full rounded-md border border-[#dce3eb] bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(18,44,80,0.08)]"
                  onClick={() => setSelectedId(order.id)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-extrabold text-brand-navy">#{order.id} · {t(EVENT_TYPE_LABELS[order.eventType] || "Event")}</p>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${status.className}`}>{t(status.label)}</span>
                  </div>
                  <p className="mt-1 text-sm text-[#65748a]">{order.eventDate} · {order.eventTime} · {t("{count} guests", { count: order.guestCount })}</p>
                  <p className="mt-1 truncate text-sm text-[#65748a]">{order.customerName} · {t(order.storeName || "")}</p>
                  <p className="mt-3 text-sm font-extrabold tabular-nums text-brand-navy">{formatXaf(order.quotedTotal ?? order.estimatedTotal, language)}</p>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
          <button aria-label={t("Close")} className="admin-drawer-backdrop absolute inset-0 bg-[#0b1e36]/45 backdrop-blur-[2px]" onClick={() => setSelectedId(null)} tabIndex={-1} type="button" />
          <section aria-labelledby="event-drawer-title" aria-modal="true" className="admin-drawer-panel relative flex h-full w-full max-w-[34rem] flex-col bg-white shadow-[-24px_0_60px_rgba(9,42,83,0.18)]" role="dialog">
            <header className="flex items-start justify-between gap-4 border-b border-[#f4f6f8] px-6 py-5">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-yellow-deep">{t(EVENT_TYPE_LABELS[selected.eventType] || "Event")}</p>
                <h2 className="mt-1 text-xl font-semibold text-brand-navy" id="event-drawer-title">{t("Event order #{id}", { id: selected.id })}</h2>
                <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${(STATUS[selected.status] || STATUS.new).className}`}>{t((STATUS[selected.status] || STATUS.new).label)}</span>
              </div>
              <button aria-label={t("Close")} className="grid size-9 place-items-center rounded-md text-[#65748a] hover:bg-[#f4f6f8]" onClick={() => setSelectedId(null)} type="button">✕</button>
            </header>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6 text-sm">
              <dl className="grid grid-cols-2 gap-3">
                <div className="rounded-md bg-[#f4f6f8] p-3"><dt className="text-xs text-[#8592a3]">{t("Date & time")}</dt><dd className="font-bold">{selected.eventDate} · {selected.eventTime}</dd></div>
                <div className="rounded-md bg-[#f4f6f8] p-3"><dt className="text-xs text-[#8592a3]">{t("Guests")}</dt><dd className="font-bold">{selected.guestCount}</dd></div>
                <div className="col-span-2 rounded-md bg-[#f4f6f8] p-3">
                  <dt className="text-xs text-[#8592a3]">{t(selected.fulfillmentType === "pickup" ? "Pickup" : "Delivery")}</dt>
                  <dd className="font-bold">{t(selected.storeName || "")}{selected.deliveryAddress ? ` → ${selected.deliveryAddress}` : ""}</dd>
                </div>
                <div className="col-span-2 rounded-md bg-[#f4f6f8] p-3">
                  <dt className="text-xs text-[#8592a3]">{t("Customer")}</dt>
                  <dd className="font-bold">{selected.customerName}</dd>
                  <dd><a className="text-brand-blue hover:underline" href={`mailto:${selected.customerEmail}`}>{selected.customerEmail}</a> · <a className="text-brand-blue hover:underline" href={`tel:${selected.customerPhone}`}>{selected.customerPhone}</a></dd>
                  {whatsappLink(selected.customerPhone, "") && (
                    <dd className="mt-2">
                      <a
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#25d366] px-2.5 py-1.5 text-xs font-bold text-white transition hover:bg-[#1ebe5a]"
                        href={whatsappLink(selected.customerPhone, `Hello ${selected.customerName.split(/\s+/)[0]}, this is Cold Stone Creamery about your event order #${selected.id} on ${selected.eventDate}.`) || undefined}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        <WhatsAppIcon className="size-4" />
                        {t("Chat on WhatsApp")}
                      </a>
                    </dd>
                  )}
                </div>
              </dl>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#65748a]">{t("Items")}</p>
                <ul className="mt-2 divide-y divide-[#eef1f5] rounded-md ring-1 ring-[#eef1f5]">
                  {selected.items.map((item) => (
                    <li className="flex justify-between gap-3 px-3 py-2" key={item.itemId}>
                      <span className="min-w-0 truncate">{item.quantity} × {t(item.name)}</span>
                      <span className="shrink-0 tabular-nums">{formatXaf(item.lineTotal, language)}</span>
                    </li>
                  ))}
                  <li className="flex justify-between px-3 py-2 font-extrabold"><span>{t("Estimate from menu prices")}</span><span className="tabular-nums">{formatXaf(selected.estimatedTotal, language)}</span></li>
                </ul>
              </div>
              {selected.notes && <p className="rounded-md bg-[#fffbea] px-3 py-2.5 text-[#5c4a00]"><strong>{t("Customer notes")}:</strong> {selected.notes}</p>}

              {["new", "quoted"].includes(selected.status) && (
                <fieldset className="space-y-3 rounded-md p-4 ring-1 ring-[#dce3eb]">
                  <legend className="px-1 text-xs font-extrabold uppercase tracking-[0.14em] text-[#65748a]">{t("Quote")}</legend>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-xs font-bold text-[#65748a]">
                      {t("Total (FCFA)")}
                      <input className={inputClass} min={100} onChange={(event) => setQuotedTotal(event.target.value)} type="number" value={quotedTotal} />
                    </label>
                    <label className="block text-xs font-bold text-[#65748a]">
                      {t("Deposit (FCFA)")}
                      <input className={inputClass} min={100} onChange={(event) => setDepositAmount(event.target.value)} type="number" value={depositAmount} />
                    </label>
                  </div>
                  <label className="block text-xs font-bold text-[#65748a]">
                    {t("Note to the customer (optional)")}
                    <textarea className={`${inputClass} min-h-20 resize-y`} maxLength={500} onChange={(event) => setAdminNote(event.target.value)} placeholder={t("Example: Includes delivery and serving cups.")} value={adminNote} />
                  </label>
                </fieldset>
              )}
              {selected.depositPaidAt && (
                <p className="rounded-md bg-[#e3f4e8] px-3 py-2.5 text-[#1f6b3e]">
                  {t("Deposit of {amount} paid by {method}.", { amount: formatXaf(selected.depositAmount, language), method: selected.depositProvider === "campay" ? t("Mobile Money") : t("card") })}
                </p>
              )}
              {actionError && <p className="rounded-md bg-red-50 px-3 py-2.5 font-semibold text-red-700" role="alert">{actionError}</p>}
            </div>
            <footer className="flex flex-wrap justify-end gap-2.5 border-t border-[#f4f6f8] bg-[#f4f6f8] px-6 py-4">
              {selected.status === "declined" && (
                <button className="min-h-10 rounded-md px-4 text-sm font-bold text-red-700 ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-60" disabled={working || isDeleting} onClick={() => setIsDeleteConfirmOpen(true)} type="button">
                  {t("Delete order")}
                </button>
              )}
              {["new", "quoted", "deposit_paid", "confirmed"].includes(selected.status) && (
                <button className="min-h-10 rounded-md px-4 text-sm font-bold text-red-700 hover:bg-red-50" disabled={working} onClick={() => act(["new", "quoted"].includes(selected.status) ? "decline" : "cancel")} type="button">
                  {t(["new", "quoted"].includes(selected.status) ? "Decline" : "Cancel event")}
                </button>
              )}
              {["new", "quoted"].includes(selected.status) && (
                <button className="min-h-10 rounded-md bg-brand-navy px-5 text-sm font-bold text-white hover:bg-brand-blue disabled:opacity-60" disabled={working} onClick={() => act("quote")} type="button">
                  {t(selected.status === "quoted" ? "Update quote" : "Send quote")}
                </button>
              )}
              {selected.status === "deposit_paid" && (
                <button className="min-h-10 rounded-md bg-[#1f6b3e] px-5 text-sm font-bold text-white hover:bg-[#185532] disabled:opacity-60" disabled={working} onClick={() => act("confirm")} type="button">{t("Confirm event")}</button>
              )}
              {["deposit_paid", "confirmed"].includes(selected.status) && (
                <button className="min-h-10 rounded-md px-4 text-sm font-bold text-brand-navy ring-1 ring-[#d5dde8] hover:ring-brand-navy disabled:opacity-60" disabled={working} onClick={() => act("complete")} type="button">{t("Mark completed")}</button>
              )}
            </footer>
          </section>
        </div>
      )}
      {isDeleteConfirmOpen && selected?.status === "declined" && (
        <div className="fixed inset-0 z-[60] grid place-items-center px-5" role="presentation">
          <button aria-label={t("Cancel")} className="admin-drawer-backdrop absolute inset-0 bg-[#0b1e36]/55 backdrop-blur-[2px]" disabled={isDeleting} onClick={() => setIsDeleteConfirmOpen(false)} tabIndex={-1} type="button" />
          <section aria-labelledby="delete-event-order-title" aria-modal="true" className="admin-modal-panel relative w-full max-w-md rounded-md bg-white p-6 shadow-[0_30px_80px_rgba(9,42,83,0.3)]" role="dialog">
            <span className="grid size-12 place-items-center rounded-md bg-red-50 text-red-600">
              <svg aria-hidden="true" className="size-6" fill="none" viewBox="0 0 24 24">
                <path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
              </svg>
            </span>
            <h2 className="mt-4 text-base font-semibold text-brand-navy" id="delete-event-order-title">
              {t("Delete declined event order #{id}?", { id: selected.id })}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#65748a]">{t("This permanently deletes the declined event order. This cannot be undone.")}</p>
            {actionError && <p className="mt-3 rounded-md bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700" role="alert">{actionError}</p>}
            <div className="mt-6 flex justify-end gap-2.5">
              <button className="min-h-10 rounded-md px-4 text-sm font-bold text-[#65748a] transition hover:bg-[#f4f6f8] disabled:opacity-60" disabled={isDeleting} onClick={() => setIsDeleteConfirmOpen(false)} type="button">{t("Cancel")}</button>
              <button className="min-h-10 rounded-md bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-wait disabled:opacity-60" disabled={isDeleting} onClick={deleteDeclinedOrder} type="button">{isDeleting ? t("Deleting…") : t("Delete")}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
