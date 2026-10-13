import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../../api/api";
import { useAdminAuth } from "./useAdminAuth";
import { useLanguage } from "../../../language/useLanguage";
import { formatCartMoney, USD_TO_XAF } from "../../../cartPricing";
import { AdminPaymentsDashboard } from "./AdminPaymentsDashboard";

function formatMoney(cents, currency = "xaf", language = "en") {
  const amountXaf = currency.toLowerCase() === "usd"
    ? Math.round((cents / 100) * USD_TO_XAF)
    : cents;
  return formatCartMoney(amountXaf, "xaf", language);
}

function formatDate(value) {
  if (!value) return "—";
  const normalizedValue = String(value).replace(" ", "T");
  const date = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(normalizedValue) ? normalizedValue : `${normalizedValue}Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function isAtLeastThreeMinutesOld(value, now) {
  if (!value) return false;
  const normalizedValue = String(value).replace(" ", "T");
  const createdAt = new Date(
    /[zZ]|[+-]\d{2}:?\d{2}$/.test(normalizedValue) ? normalizedValue : `${normalizedValue}Z`,
  ).getTime();
  return Number.isFinite(createdAt) && now - createdAt >= 3 * 60 * 1000;
}

function StatusBadge({ status, t }) {
  const styles = {
    pending_payment: "bg-amber-100 text-amber-900",
    processing: "bg-blue-100 text-blue-900",
    delivered: "bg-green-100 text-green-900",
    payment_failed: "bg-red-100 text-red-900",
    pending: "bg-amber-100 text-amber-900",
    paid: "bg-green-100 text-green-900",
    failed: "bg-red-100 text-red-900",
  };
  const labels = {
    pending_payment: "Awaiting payment",
    processing: "Paid · preparing",
    delivered: "Delivered",
    payment_failed: "Payment failed",
    pending: "Pending",
    paid: "Paid",
    failed: "Failed",
    accepted: "Accepted",
    preparing: "Being prepared",
    ready: "Ready",
    out_for_delivery: "Out for delivery",
  };
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${styles[status] || "bg-slate-100 text-slate-800"}`}
    >
      {t(labels[status] || status)}
    </span>
  );
}

function AdminSalesView({ view }) {
  const { sessionToken, currentAdmin } = useAdminAuth();
  const isOwner = currentAdmin?.role === 'owner';
  const { t, language } = useLanguage();
  const [orders, setOrders] = useState([]);
  const [deliveredCount, setDeliveredCount] = useState(0);
  const [payments, setPayments] = useState([]);
  const [stores, setStores] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [deletingOrderId, setDeletingOrderId] = useState(null);
  const [isClearingDelivered, setIsClearingDelivered] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderFilter, setOrderFilter] = useState("all");
  const [storeFilter, setStoreFilter] = useState("all");

  const refresh = useCallback(async () => {
    setError("");
    try {
      if (view === "payments") {
        const result = await apiRequest("/admin/payments", {
          token: sessionToken,
        });
        setPayments(result.payments);
      } else {
        const query = new URLSearchParams();
        if (view === "delivered") query.set("status", "delivered");
        if (storeFilter !== "all") query.set("storeId", storeFilter);
        const [result, storeResult] = await Promise.all([
          apiRequest(`/admin/orders${query.size ? `?${query}` : ""}`, { token: sessionToken }),
          apiRequest("/admin/stores", { token: sessionToken }),
        ]);
        setOrders(result.orders);
        setStores(storeResult.stores);
        if (view === "delivered") {
          setDeliveredCount(result.count ?? result.orders.length);
        }
      }
      setCurrentTime(Date.now());
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  }, [sessionToken, storeFilter, view]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  async function markDelivered(orderId) {
    setError("");
    setUpdatingOrderId(orderId);
    try {
      await apiRequest(`/admin/orders/${orderId}/delivered`, {
        method: "PATCH",
        token: sessionToken,
      });
      await refresh();
    } catch (updateError) {
      setError(updateError.message);
    } finally {
      setUpdatingOrderId(null);
    }
  }

  async function updateFulfillment(orderId, status) {
    setError("");
    setUpdatingOrderId(orderId);
    try {
      await apiRequest(`/admin/orders/${orderId}/status`, {
        method: "PATCH",
        token: sessionToken,
        body: { status },
      });
      await refresh();
    } catch (updateError) {
      setError(updateError.message);
    } finally {
      setUpdatingOrderId(null);
    }
  }

  async function deleteFailedOrder(order) {
    if (
      !window.confirm(
        t(
          "Delete failed order #{id}? This will permanently remove the order and its payment record.",
          { id: order.id },
        ),
      )
    ) {
      return;
    }

    setError("");
    setDeletingOrderId(order.id);
    try {
      await apiRequest(`/admin/orders/${order.id}`, {
        method: "DELETE",
        token: sessionToken,
      });
      await refresh();
    } catch (deleteError) {
      setError(t(deleteError.message));
    } finally {
      setDeletingOrderId(null);
    }
  }

  async function deleteStalePaymentOrder(order) {
    if (!window.confirm(t(
      "Delete order #{id}? Stripe will first confirm the checkout is unpaid and expire it. This permanently removes the order.",
      { id: order.id },
    ))) return;

    setError("");
    setDeletingOrderId(order.id);
    try {
      await apiRequest(`/admin/orders/${order.id}/stale-payment`, {
        method: "DELETE",
        token: sessionToken,
      });
      await refresh();
    } catch (deleteError) {
      setError(t(deleteError.message));
    } finally {
      setDeletingOrderId(null);
    }
  }

  async function clearDeliveredOrders() {
    if (deliveredCount <= 3 || isClearingDelivered) return;
    if (!window.confirm(t(
      "Clear all {count} delivered orders? This permanently deletes their order, payment, loyalty, and review history.",
      { count: deliveredCount },
    ))) return;

    setError("");
    setIsClearingDelivered(true);
    try {
      const query = new URLSearchParams();
      if (isOwner && storeFilter !== "all") query.set("storeId", storeFilter);
      await apiRequest(`/admin/orders/delivered${query.size ? `?${query}` : ""}`, {
        method: "DELETE",
        token: sessionToken,
      });
      await refresh();
    } catch (clearError) {
      setError(t(clearError.message));
    } finally {
      setIsClearingDelivered(false);
    }
  }

  const isDeliveredView = view === "delivered";
  const isPaymentsView = view === "payments";
  const isOrderView = view === "orders";
  const orderCounts = useMemo(() => orders.reduce((counts, order) => {
    counts.all += 1;
    counts[order.status] = (counts[order.status] || 0) + 1;
    return counts;
  }, { all: 0, pending_payment: 0, processing: 0, payment_failed: 0 }), [orders]);
  const deliveredSummary = useMemo(() => orders.reduce((summary, order) => {
    summary.totalRevenueXaf += order.currency?.toLowerCase() === "usd"
      ? Math.round((Number(order.totalCents || 0) / 100) * USD_TO_XAF)
      : Number(order.totalCents || 0);
    if (order.fulfillmentType === "pickup") summary.pickupCount += 1;
    if (order.fulfillmentType === "delivery") summary.deliveryCount += 1;
    return summary;
  }, {
    totalRevenueXaf: 0,
    pickupCount: 0,
    deliveryCount: 0,
  }), [orders]);
  const visibleOrders = useMemo(() => {
    const query = orderSearch.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesStatus = orderFilter === "all" || order.status === orderFilter;
      const matchesSearch = !query || [
        order.id,
        order.customerName,
        order.customerEmail,
        order.customerPhone,
        order.storeName,
        order.storeAddress,
        order.deliveryCity,
        order.deliveryResidence,
        ...order.items.map((item) => item.flavorName),
      ].some((value) => String(value || "").toLowerCase().includes(query));
      return matchesStatus && matchesSearch;
    });
  }, [orders, orderFilter, orderSearch]);
  const renderedOrders = isDeliveredView || isOrderView ? visibleOrders : orders;
  const title = t(
    isPaymentsView
      ? "Payments"
      : isDeliveredView
        ? "Delivered orders"
        : "Orders",
  );
  const description = t(
    isPaymentsView
      ? "Payment records confirmed by Stripe for customer orders."
      : isDeliveredView
        ? "Orders confirmed as delivered."
        : "New orders awaiting payment and paid orders being prepared.",
  );

  return (
    <section>
      {isOrderView ? (
        <div className="relative isolate overflow-hidden rounded-[24px] bg-gradient-to-br from-[#092a53] via-[#123b63] to-[#285777] px-5 py-6 text-white shadow-[0_14px_34px_rgba(9,42,83,0.16)] sm:px-7 sm:py-8">
          <div aria-hidden="true" className="absolute -right-12 -top-20 -z-10 size-64 rounded-full border-[38px] border-white/[0.06]" />
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#ffdc32]">
                <span aria-hidden="true">✦</span>{t("Store management")}
              </span>
              <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
              <p className="mt-2 max-w-lg text-sm leading-6 text-white/70">{t("New orders awaiting payment and paid orders being prepared.")}</p>
            </div>
            <button
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-xs font-bold text-white transition hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffdc32] disabled:cursor-wait disabled:opacity-60"
              disabled={isLoading}
              onClick={refresh}
              type="button"
            >
              <svg aria-hidden="true" className={`size-4 ${isLoading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 20 20">
                <path d="M16.5 8A6.7 6.7 0 0 0 4.7 5.2L3 7m0 0V3.5M3 7h3.5m-3 5A6.7 6.7 0 0 0 15.3 14.8L17 13m0 0v3.5M17 13h-3.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
              </svg>
              {t("Refresh")}
            </button>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { status: "all", color: "bg-white" },
              { status: "pending_payment", color: "bg-[#ffdc32]" },
              { status: "processing", color: "bg-sky-300" },
              { status: "payment_failed", color: "bg-rose-300" },
            ].map(({ status, color }) => (
              <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-[#061f3d]/25 px-3 py-2.5" key={status}>
                <span aria-hidden="true" className={`size-2 rounded-full ${color}`} />
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-white/75">{t(status === "all" ? "All orders" : status === "pending_payment" ? "Awaiting payment" : status === "processing" ? "Paid · preparing" : "Payment failed")}</span>
                <span className="text-sm font-extrabold">{orderCounts[status]}</span>
              </div>
            ))}
          </div>
        </div>
      ) : isDeliveredView ? (
        <div className="relative isolate overflow-hidden rounded-[28px] bg-gradient-to-br from-[#092a53] via-[#123b63] to-[#285777] p-5 text-white shadow-[0_18px_40px_rgba(9,42,83,0.14)] sm:p-7">
          <div aria-hidden="true" className="absolute -right-14 -top-20 -z-10 size-72 rounded-full border-[42px] border-white/[0.05]" />
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#ffdc32]">
                <span aria-hidden="true">✦</span>
                {t("Store management")}
              </p>
              <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
                {title}
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-white/70">{description}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-full border border-emerald-200/20 bg-emerald-300/15 px-4 py-2 text-sm font-bold text-emerald-100">
                {t("Delivered orders: {count}", { count: deliveredCount })}
              </div>
              {deliveredCount > 3 && <button
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffdc32] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isLoading || deliveredCount <= 3 || isClearingDelivered}
                onClick={clearDeliveredOrders}
                type="button"
              >
                {isClearingDelivered ? t("Clearing…") : t("Clear all delivered orders")}
              </button>}
              <button
                className="inline-flex items-center gap-2 rounded-xl bg-[#ffdc32] px-4 py-2.5 text-sm font-extrabold text-[#092a53] transition hover:bg-[#ffe76c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60"
                disabled={isLoading || isClearingDelivered}
                onClick={refresh}
                type="button"
              >
                <svg aria-hidden="true" className={`size-4 ${isLoading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 20 20">
                  <path d="M16.5 8A6.7 6.7 0 0 0 4.7 5.2L3 7m0 0V3.5M3 7h3.5m-3 5A6.7 6.7 0 0 0 15.3 14.8L17 13m0 0v3.5M17 13h-3.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                </svg>
                {t("Refresh")}
              </button>
            </div>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-4 backdrop-blur-sm">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/60">{t("Total delivered")}</p>
              <p className="mt-3 font-display text-2xl font-extrabold">{deliveredCount}</p>
              <p className="mt-1 text-xs text-white/55">{t("Completed orders")}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-4 backdrop-blur-sm">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/60">{t("Pickup")}</p>
              <p className="mt-3 font-display text-2xl font-extrabold">{deliveredSummary.pickupCount}</p>
              <p className="mt-1 text-xs text-white/55">{t("Orders collected in store")}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-4 backdrop-blur-sm">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/60">{t("Home delivery")}</p>
              <p className="mt-3 font-display text-2xl font-extrabold">{deliveredSummary.deliveryCount}</p>
              <p className="mt-1 text-xs text-white/55">{t("Orders delivered to customers")}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-4 backdrop-blur-sm">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/60">{t("Delivered revenue")}</p>
              <p className="mt-3 font-display text-2xl font-extrabold">{formatMoney(deliveredSummary.totalRevenueXaf, "xaf", language)}</p>
              <p className="mt-1 text-xs text-white/55">{t("Revenue from completed orders")}</p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <p className="mb-2 inline-block rounded-full bg-[#ffeb9c] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em]">
            {t("Store management")}
          </p>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                {title}
              </h1>
              <p className="mt-2 text-sm text-[#65748a]">{description}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                className="rounded-full border-2 border-[#65748a] px-4 py-2 text-sm font-bold transition hover:bg-[#f4f1e7] disabled:opacity-60"
                disabled={isLoading || isClearingDelivered}
                onClick={refresh}
                type="button"
              >
                {t("Refresh")}
              </button>
            </div>
          </div>
        </>
      )}

      {error && (
        <p
          className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {error}
        </p>
      )}
      {!isLoading && isOrderView && (
        <div className="mt-5 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div aria-label={t("Filter by order status")} className="flex gap-1.5 overflow-x-auto pb-1" role="group">
              {["all", "pending_payment", "processing", "payment_failed"].map((status) => (
                <button
                  aria-pressed={orderFilter === status}
                  className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] ${
                    orderFilter === status
                      ? "border-[#092a53] bg-[#092a53] text-white shadow-sm"
                      : "border-[#e2e8f0] bg-white text-[#52647b] hover:border-[#bacbdc] hover:text-[#092a53]"
                  }`}
                  key={status}
                  onClick={() => setOrderFilter(status)}
                  type="button"
                >
                  {t(status === "all" ? "All orders" : status === "pending_payment" ? "Awaiting payment" : status === "processing" ? "Paid · preparing" : "Payment failed")}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${orderFilter === status ? "bg-white/15 text-white" : "bg-[#f0f4f8] text-[#65748a]"}`}>
                    {orderCounts[status]}
                  </span>
                </button>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:items-center">
              {isOwner && <label className="min-w-0">
                <span className="sr-only">{t("Filter orders by store")}</span>
                <select
                  className="min-h-10 w-full rounded-xl border border-[#e2e8f0] bg-white px-3 text-sm font-semibold text-[#52647b] outline-none transition focus:border-[#6c8bab] focus:ring-2 focus:ring-[#dce8f4] lg:min-w-52"
                  onChange={(event) => setStoreFilter(event.target.value)}
                  value={storeFilter}
                >
                  <option value="all">{t("All stores")}</option>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {t(store.name)} · {t(store.town)}
                    </option>
                  ))}
                </select>
              </label>}
              <label className="relative min-w-0 lg:w-72">
                <span className="sr-only">{t("Search orders")}</span>
                <svg aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8291a3]" fill="none" viewBox="0 0 20 20">
                  <circle cx="8.8" cy="8.8" r="5.8" stroke="currentColor" strokeWidth="1.5" />
                  <path d="m13.2 13.2 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
                </svg>
                <input
                  className="min-h-10 w-full rounded-xl border border-[#e2e8f0] bg-white pl-9 pr-3 text-sm outline-none transition placeholder:text-[#9aa6b4] focus:border-[#6c8bab] focus:ring-2 focus:ring-[#dce8f4]"
                  onChange={(event) => setOrderSearch(event.target.value)}
                  placeholder={t("Search by customer, item, or order number")}
                  type="search"
                  value={orderSearch}
                />
              </label>
            </div>
          </div>
          <p aria-live="polite" className="text-xs font-semibold text-[#8190a1]">
            {t("Showing {shown} of {total} orders", { shown: visibleOrders.length, total: orderCounts.all })}
          </p>
        </div>
      )}
      {!isLoading && isDeliveredView && orders.length > 0 && (
        <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-extrabold text-[#123253]">{t("Delivery history")}</h2>
            <p aria-live="polite" className="mt-1 text-sm text-[#718198]">
              {t("Showing {shown} of {total} orders", { shown: visibleOrders.length, total: deliveredCount })}
            </p>
          </div>
          <label className="relative w-full sm:max-w-sm">
            <span className="sr-only">{t("Search delivered orders")}</span>
            <svg aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8291a3]" fill="none" viewBox="0 0 20 20">
              <circle cx="8.8" cy="8.8" r="5.8" stroke="currentColor" strokeWidth="1.5" />
              <path d="m13.2 13.2 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
            </svg>
            <input
              className="min-h-11 w-full rounded-xl border border-[#dce5ef] bg-white pl-9 pr-3 text-sm text-[#173654] outline-none transition placeholder:text-[#9aa6b4] focus:border-[#6c8bab] focus:ring-2 focus:ring-[#dce8f4]"
              onChange={(event) => setOrderSearch(event.target.value)}
              placeholder={t("Search by customer, item, or order number")}
              type="search"
              value={orderSearch}
            />
          </label>
        </div>
      )}
      {isLoading ? (
        <p className="mt-6 text-sm text-[#65748a]" role="status">
          {t("Loading {title}…", { title: title.toLowerCase() })}
        </p>
      ) : isPaymentsView ? (
        payments.length === 0 ? (
          <p className="mt-6 rounded-xl bg-[#f8f6f0] px-4 py-5 text-sm text-[#65748a]">
            {t("No payment records yet.")}
          </p>
        ) : (
          <div className="mt-6 space-y-3">
            {payments.map((payment) => (
              <article
                className="rounded-2xl border border-[#d9d6cc] bg-white p-4 sm:p-5"
                key={payment.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg font-bold">
                      {t("Order #{id}", { id: payment.orderId })}
                    </p>
                    <p className="mt-1 text-sm text-[#65748a]">
                      {payment.customerName} · {payment.customerEmail}
                    </p>
                    <p className="mt-1 text-xs text-[#65748a]">
                      {t("Payment record #{id} · {date}", {
                        id: payment.id,
                        date: formatDate(payment.createdAt),
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={payment.status} t={t} />
                    <span className="font-display text-xl font-bold">
                      {formatMoney(
                        payment.amountCents,
                        payment.currency,
                        language,
                      )}
                    </span>
                  </div>
                </div>
                {payment.transactionId && (
                  <p className="mt-3 break-all border-t border-[#d9d6cc] pt-3 text-xs text-[#65748a]">
                    {t("{provider} transaction: {id}", { provider: payment.provider, id: payment.transactionId })}
                  </p>
                )}
              </article>
            ))}
          </div>
        )
      ) : orders.length === 0 ? (
        <p className="mt-6 rounded-xl bg-[#f8f6f0] px-4 py-5 text-sm text-[#65748a]">
          {isDeliveredView
            ? t("No delivered orders yet.")
            : t("No orders yet.")}
        </p>
      ) : isDeliveredView && visibleOrders.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-[#d9e1ea] bg-white px-5 py-14 text-center">
          <span aria-hidden="true" className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#f1f6fb] text-[#49647e]">
            <svg className="size-7" fill="none" viewBox="0 0 24 24">
              <circle cx="10.8" cy="10.8" r="6.3" stroke="currentColor" strokeWidth="1.6" />
              <path d="m15.5 15.5 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
            </svg>
          </span>
          <h2 className="mt-4 font-display text-lg font-extrabold text-[#173654]">{t("No delivered orders match your search")}</h2>
          <p className="mt-1.5 text-sm text-[#8190a1]">{t("Try another customer, order number, or item.")}</p>
          <button className="mt-4 text-xs font-extrabold text-[#092a53] underline decoration-[#ffdc32] decoration-2 underline-offset-4" onClick={() => setOrderSearch("")} type="button">
            {t("Clear search")}
          </button>
        </div>
      ) : isOrderView && visibleOrders.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-[#d9e1ea] bg-[#f8fafc] px-5 py-12 text-center">
          <span aria-hidden="true" className="mx-auto grid size-14 place-items-center rounded-2xl bg-white text-2xl shadow-sm">🧾</span>
          <h2 className="mt-4 font-display text-lg font-extrabold text-[#173654]">{t("No orders match your search")}</h2>
          <p className="mt-1.5 text-sm text-[#8190a1]">{t("Try a different search or status filter.")}</p>
          <button className="mt-4 text-xs font-extrabold text-[#092a53] underline decoration-[#ffdc32] decoration-2 underline-offset-4" onClick={() => { setOrderSearch(""); setOrderFilter("all"); }} type="button">
            {t("Clear filters")}
          </button>
        </div>
      ) : (
        <div className={`mt-6 ${isOrderView ? "grid gap-4 xl:grid-cols-2" : "space-y-4"}`}>
          {renderedOrders.map((order) => (
            <article
              className={`overflow-hidden rounded-2xl border bg-white shadow-[0_4px_18px_rgba(16,44,80,0.035)] transition hover:border-[#c8d6e4] hover:shadow-[0_12px_26px_rgba(16,44,80,0.07)] ${isDeliveredView ? "border-[#dce9e4] border-l-4 border-l-[#2a8c5b]" : isOrderView ? "border-[#e2e8f0]" : "border-[#d9d6cc]"} p-4 sm:p-5`}
              key={order.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eef1f5] pb-4">
                <div className="flex min-w-0 items-start gap-3">
                  {isOrderView && <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#fff6d4] text-lg text-[#987b00]">🧾</span>}
                  <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-xl font-bold">
                      {t("Order #{id}", { id: order.id })}
                    </h2>
                    <StatusBadge status={order.status} t={t} />
                    {order.status === "processing" && (
                      <span className="rounded-full bg-[#edf2f8] px-3 py-1 text-xs font-bold text-[#65748a]">
                        {t(order.deliveryStage || order.fulfillmentStatus || "preparing")}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-[#65748a]">
                    {t("Placed {date}", { date: formatDate(order.createdAt) })}
                  </p>
                  </div>
                </div>
                <span className="font-display text-xl font-extrabold text-[#092a53] sm:text-2xl">
                  {formatMoney(order.totalCents, order.currency, language)}
                </span>
              </div>

              <div className="mt-4 flex items-start gap-3 rounded-xl border border-[#dce7f1] bg-[#f4f8fc] px-4 py-3.5">
                <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-[#092a53] shadow-sm">⌖</span>
                <div className="min-w-0">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#65748a]">{t("Assigned store")}</p>
                  <p className="mt-1 text-sm font-extrabold text-[#092a53]">{t(order.storeName || "Store not recorded")}</p>
                  {order.storeAddress && <p className="mt-0.5 text-xs leading-5 text-[#65748a]">{t(order.storeAddress)}</p>}
                  {order.storePhone && <p className="mt-0.5 text-xs font-semibold text-[#52647b]">{order.storePhone}</p>}
                </div>
              </div>

              <div className="mt-4 grid gap-4 border-t border-[#d9d6cc] pt-4 sm:grid-cols-2">
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wide text-[#65748a]">
                    {t("Customer")}
                  </h3>
                  <p className="mt-1 text-sm font-semibold">
                    {order.customerName}
                  </p>
                  <a
                    className="text-sm text-[#65748a] underline underline-offset-2"
                    href={`mailto:${order.customerEmail}`}
                  >
                    {order.customerEmail}
                  </a>
                  <p className="text-sm text-[#65748a]">
                    {order.customerPhone}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wide text-[#65748a]">
                    {t("Fulfillment destination")}
                  </h3>
                  <p className="mt-1 text-sm text-[#65748a]">
                    {order.fulfillmentType === "pickup" ? t("Pickup") : t("Delivery")} · {order.deliveryResidence}{order.deliveryResidence ? ", " : ""}{order.deliveryCity}
                  </p>
                  {order.scheduledFor && <p className="mt-1 text-xs text-[#65748a]">{t("Scheduled")}: {new Date(order.scheduledFor).toLocaleString()}</p>}
                  {order.deliveryFee > 0 && <p className="mt-1 text-xs text-[#65748a]">{t("Delivery fee")}: {formatMoney(order.deliveryFee, order.currency, language)}</p>}
                </div>
              </div>

              <div className="mt-4 border-t border-[#d9d6cc] pt-4">
                <h3 className="text-xs font-extrabold uppercase tracking-wide text-[#65748a]">
                  {t("Items")}
                </h3>
                <ul className="mt-2 space-y-2">
                  {order.items.map((item) => (
                    <li
                      className="flex justify-between gap-3 text-sm"
                      key={`${order.id}-${item.flavorId}-${item.flavorName}`}
                    >
                      <span>
                        {item.flavorName} × {item.quantity}
                      </span>
                      <span className="shrink-0 font-semibold">
                        {formatMoney(
                          item.lineTotalCents,
                          order.currency,
                          language,
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                {order.discountCents > 0 && (
                  <p className="mt-3 text-right text-sm font-semibold text-[#163e35]">
                    {t("Buy 2 Get 1 Free: −{amount}", {
                      amount: formatMoney(
                        order.discountCents,
                        order.currency,
                        language,
                      ),
                    })}
                  </p>
                )}
              </div>

              {order.status === "processing" && (
                <div className="mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-[#d9d6cc] pt-4">
                  <label className="text-xs font-bold text-[#65748a]">
                    {t("Fulfillment status")}
                    <select className="ml-2 rounded-lg border border-[#d9d6cc] bg-white px-3 py-2 text-sm text-[#102c50]" disabled={updatingOrderId === order.id} onChange={(event) => updateFulfillment(order.id, event.target.value)} value={order.deliveryStage || order.fulfillmentStatus || "preparing"}>
                      <option value="accepted">{t("accepted")}</option>
                      <option value="preparing">{t("preparing")}</option>
                      <option value="ready">{t("ready")}</option>
                      {order.fulfillmentType === "delivery" && <option value="out_for_delivery">{t("out_for_delivery")}</option>}
                      <option value="delivered">{t("delivered")}</option>
                    </select>
                  </label>
                  <button
                    className="rounded-full bg-[#ffdc32] px-5 py-2.5 text-sm font-bold transition hover:bg-[#ffe76c] disabled:cursor-wait disabled:opacity-60"
                    disabled={updatingOrderId === order.id}
                    onClick={() => markDelivered(order.id)}
                    type="button"
                  >
                    {updatingOrderId === order.id ? t("Updating…") : t("Mark as delivered")}
                  </button>
                </div>
              )}
              {order.status === "payment_failed" && (
                <div className="mt-4 flex justify-end border-t border-[#d9d6cc] pt-4">
                  <button
                    className="rounded-full border border-red-300 px-5 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-60"
                    disabled={deletingOrderId === order.id}
                    onClick={() => deleteFailedOrder(order)}
                    type="button"
                  >
                    {deletingOrderId === order.id
                      ? t("Deleting…")
                      : t("Delete failed order")}
                  </button>
                </div>
              )}
              {order.status === "pending_payment" && isAtLeastThreeMinutesOld(order.createdAt, currentTime) && (
                <div className="mt-4 flex justify-end border-t border-[#d9d6cc] pt-4">
                  <button
                    className="rounded-full border border-red-300 px-5 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-60"
                    disabled={deletingOrderId === order.id}
                    onClick={() => deleteStalePaymentOrder(order)}
                    type="button"
                  >
                    {deletingOrderId === order.id
                      ? t("Deleting…")
                      : t("Delete unpaid order")}
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function AdminOrdersPage() {
  return <AdminSalesView view="orders" />;
}

export function AdminDeliveredPage() {
  return <AdminSalesView view="delivered" />;
}

export function AdminPaymentsPage() {
  return <AdminPaymentsDashboard />;
}
