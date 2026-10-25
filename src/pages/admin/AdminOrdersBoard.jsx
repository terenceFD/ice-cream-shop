import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiRequest } from "../../api/api";
import { useAdminAuth } from "./useAdminAuth";
import { useLanguage } from "../../language/useLanguage";
import { formatCartMoney, USD_TO_XAF } from "../../lib/cartPricing";
import { orderUpdateMessage, whatsappLink } from "../../lib/whatsapp";
import { WhatsAppIcon } from "../../components/WhatsAppIcon";

const AUTO_REFRESH_MS = 30_000;
const STALE_PAYMENT_MS = 3 * 60 * 1000;
const inputClassName =
  "w-full rounded-xl border border-[#dde4ec] bg-[#f8fafc] px-3.5 py-2.5 text-sm font-medium text-[#102c50] transition placeholder:text-[#9aa5b3] hover:border-[#c9d4e0] focus:border-[#bd9c00] focus:bg-white focus:ring-4 focus:ring-[#ffdc32]/25 outline-none!";

const icons = {
  refresh: "M4 12a8 8 0 0 1 13.7-5.7L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.7L4 15.5M4 20v-4.5h4.5",
  search: "m20 20-4.2-4.2M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6m-6 4h3",
  clock: "M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  check: "m5 12.5 4.5 4.5L19 7.5",
  alert: "M12 8v5m0 3.5v.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  close: "M6 6l12 12M18 6 6 18",
  truck: "M3 7h11v9H3V7Zm11 3h4l3 3v3h-7v-6ZM7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  store: "M4 10h16l-1.5-5h-13L4 10Zm0 0v10h16V10M9 20v-5h6v5",
  pin: "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  mail: "M4 6h16v12H4V6Zm0 0 8 7 8-7",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z",
  trash: "M4 7h16M10 11v6m4-6v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3",
  arrow: "M5 12h14m-5-5 5 5-5 5",
  chevron: "m9 6 6 6-6 6",
  card: "M3 6h18v12H3V6Zm0 4h18M7 15h4",
  x: "M15 9l-6 6m0-6 6 6m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
};

function Icon({ path, className = "size-4" }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d={path} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function formatMoney(cents, currency = "xaf", language = "en") {
  const amountXaf = String(currency).toLowerCase() === "usd" ? Math.round((cents / 100) * USD_TO_XAF) : cents;
  return formatCartMoney(amountXaf, "xaf", language);
}

function parseDate(value) {
  if (!value) return null;
  const normalizedValue = String(value).replace(" ", "T");
  const date = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(normalizedValue) ? normalizedValue : `${normalizedValue}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(value, language) {
  const date = value instanceof Date ? value : parseDate(value);
  if (!date) return "—";
  return date.toLocaleString(language === "fr" ? "fr-CM" : "en-CM", { dateStyle: "medium", timeStyle: "short" });
}

function relativeTime(value, now, language) {
  const date = parseDate(value);
  if (!date || !now) return "";
  const seconds = Math.round((date.getTime() - now) / 1000);
  const formatter = new Intl.RelativeTimeFormat(language === "fr" ? "fr" : "en", { numeric: "auto" });
  const abs = Math.abs(seconds);
  if (abs < 60) return formatter.format(seconds, "second");
  if (abs < 3600) return formatter.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return formatter.format(Math.round(seconds / 3600), "hour");
  return formatter.format(Math.round(seconds / 86400), "day");
}

function currentStage(order) {
  return order.deliveryStage || order.fulfillmentStatus || "preparing";
}

function stagesFor(order) {
  return [
    { key: "accepted", label: "Accepted" },
    { key: "preparing", label: "Being prepared" },
    { key: "ready", label: "Ready" },
    ...(order.fulfillmentType === "delivery" ? [{ key: "out_for_delivery", label: "Out for delivery" }] : []),
    { key: "delivered", label: "Delivered" },
  ];
}

function nextStage(order) {
  const stages = stagesFor(order);
  const index = stages.findIndex((stage) => stage.key === currentStage(order));
  return index >= 0 && index < stages.length - 1 ? stages[index + 1] : null;
}

const statusMeta = {
  pending_payment: { label: "Awaiting payment", badge: "bg-[#fff6e5] text-[#9a6200] ring-[#f6dfb0]", dot: "bg-[#e0a100]" },
  processing: { label: "Paid · preparing", badge: "bg-[#e9f1fa] text-[#245281] ring-[#cfe0f2]", dot: "bg-[#3b7dd8]" },
  payment_failed: { label: "Payment failed", badge: "bg-[#fdeeee] text-[#a53f37] ring-[#f3d1ce]", dot: "bg-[#d2544b]" },
  delivered: { label: "Delivered", badge: "bg-[#eaf6ee] text-[#246a46] ring-[#cfe8d8]", dot: "bg-[#35a36b]" },
};

const stageLabels = {
  accepted: "Accepted",
  preparing: "Being prepared",
  ready: "Ready",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
};

function StatusBadge({ status, t }) {
  const meta = statusMeta[status] || { label: status, badge: "bg-[#f1f4f8] text-[#5b6b7d] ring-[#e1e7ee]", dot: "bg-[#94a3b4]" };
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${meta.badge}`}>
      <span aria-hidden="true" className={`size-1.5 rounded-full ${meta.dot}`} />
      {t(meta.label)}
    </span>
  );
}

function initials(name) {
  return String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function AdminOrdersBoard() {
  const { sessionToken, currentAdmin } = useAdminAuth();
  const isOwner = currentAdmin?.role === "owner";
  const { t, language } = useLanguage();
  const [orders, setOrders] = useState([]);
  const [stores, setStores] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [deletingOrderId, setDeletingOrderId] = useState(null);
  const [now, setNow] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [storeFilter, setStoreFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [orderToDelete, setOrderToDelete] = useState(null);
  // Order notification emails link here as /admin/orders?order=<id>.
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedOrderId = searchParams.get("order");

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const query = new URLSearchParams();
      if (storeFilter !== "all") query.set("storeId", storeFilter);
      const [result, storeResult] = await Promise.all([
        apiRequest(`/admin/orders${query.size ? `?${query}` : ""}`, { token: sessionToken }),
        apiRequest("/admin/stores", { token: sessionToken }),
      ]);
      setOrders(result.orders);
      setStores(storeResult.stores);
      setError("");
      const time = Date.now();
      setNow(time);
      setLastUpdated(time);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [sessionToken, storeFilter]);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, AUTO_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!linkedOrderId || isLoading) return;
    const linkedOrder = orders.find((order) => String(order.id) === linkedOrderId);
    if (linkedOrder) {
      setError("");
      setSelectedOrderId(linkedOrder.id);
    } else {
      setError(t("Order #{id} is not in the active orders list. It may already be delivered or belong to another store.", { id: linkedOrderId }));
    }
    setSearchParams((params) => {
      const next = new URLSearchParams(params);
      next.delete("order");
      return next;
    }, { replace: true });
  }, [isLoading, linkedOrderId, orders, setSearchParams, t]);

  const selectedOrder = orders.find((order) => order.id === selectedOrderId) || null;
  const isOverlayOpen = Boolean(selectedOrder) || Boolean(orderToDelete);

  useEffect(() => {
    if (!isOverlayOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(event) {
      if (event.key !== "Escape") return;
      if (orderToDelete) setOrderToDelete(null);
      else setSelectedOrderId(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOverlayOpen, orderToDelete]);

  async function runOrderUpdate(orderId, request) {
    setError("");
    setUpdatingOrderId(orderId);
    try {
      await request();
      await refresh();
    } catch (updateError) {
      setError(updateError.message);
    } finally {
      setUpdatingOrderId(null);
    }
  }

  function updateFulfillment(orderId, status) {
    return runOrderUpdate(orderId, () =>
      apiRequest(`/admin/orders/${orderId}/status`, { method: "PATCH", token: sessionToken, body: { status } }),
    );
  }

  function markDelivered(orderId) {
    return runOrderUpdate(orderId, () =>
      apiRequest(`/admin/orders/${orderId}/delivered`, { method: "PATCH", token: sessionToken }),
    );
  }

  async function confirmDelete() {
    const order = orderToDelete;
    if (!order) return;
    setError("");
    setDeletingOrderId(order.id);
    try {
      await apiRequest(
        order.status === "payment_failed" ? `/admin/orders/${order.id}` : `/admin/orders/${order.id}/stale-payment`,
        { method: "DELETE", token: sessionToken },
      );
      setOrderToDelete(null);
      if (selectedOrderId === order.id) setSelectedOrderId(null);
      await refresh();
    } catch (deleteError) {
      setError(t(deleteError.message));
    } finally {
      setDeletingOrderId(null);
    }
  }

  function canDelete(order) {
    if (order.status === "payment_failed") return true;
    const created = parseDate(order.createdAt);
    return order.status === "pending_payment" && created && now - created.getTime() >= STALE_PAYMENT_MS;
  }

  const counts = useMemo(() => orders.reduce((result, order) => {
    result.all += 1;
    result[order.status] = (result[order.status] || 0) + 1;
    if (order.status === "processing") {
      const stage = currentStage(order);
      result.stages[stage] = (result.stages[stage] || 0) + 1;
    }
    return result;
  }, { all: 0, pending_payment: 0, processing: 0, payment_failed: 0, stages: {} }), [orders]);

  const openRevenue = useMemo(
    () => orders
      .filter((order) => order.status === "processing")
      .reduce((total, order) => total + (String(order.currency).toLowerCase() === "usd"
        ? Math.round((Number(order.totalCents || 0) / 100) * USD_TO_XAF)
        : Number(order.totalCents || 0)), 0),
    [orders],
  );

  const visibleOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return orders
      .filter((order) => {
        const matchesStatus = statusFilter === "all"
          || order.status === statusFilter
          || (statusFilter.startsWith("stage:") && order.status === "processing" && currentStage(order) === statusFilter.slice(6));
        const matchesType = typeFilter === "all" || order.fulfillmentType === typeFilter;
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
        return matchesStatus && matchesType && matchesSearch;
      })
      .sort((a, b) => {
        if (sortBy === "oldest") return (parseDate(a.createdAt)?.getTime() || 0) - (parseDate(b.createdAt)?.getTime() || 0);
        if (sortBy === "total") return Number(b.totalCents || 0) - Number(a.totalCents || 0);
        if (sortBy === "scheduled") {
          const aTime = a.scheduledFor ? new Date(a.scheduledFor).getTime() : Infinity;
          const bTime = b.scheduledFor ? new Date(b.scheduledFor).getTime() : Infinity;
          return aTime - bTime;
        }
        return (parseDate(b.createdAt)?.getTime() || 0) - (parseDate(a.createdAt)?.getTime() || 0);
      });
  }, [orders, search, sortBy, statusFilter, typeFilter]);

  const hasActiveFilters = Boolean(search.trim() || statusFilter !== "all" || typeFilter !== "all");
  const metrics = [
    { key: "all", label: "All orders", value: counts.all, icon: icons.receipt, accent: "bg-[#e9f1fa] text-[#315982]" },
    { key: "pending_payment", label: "Awaiting payment", value: counts.pending_payment, icon: icons.clock, accent: "bg-[#fff1dc] text-[#a86a00]" },
    { key: "processing", label: "Paid · preparing", value: counts.processing, icon: icons.card, accent: "bg-[#e5f4ea] text-[#2c7a4f]" },
    { key: "payment_failed", label: "Payment failed", value: counts.payment_failed, icon: icons.x, accent: "bg-[#fdecea] text-[#b2433a]" },
  ];
  const pipeline = ["accepted", "preparing", "ready", "out_for_delivery"];

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-col gap-5 border-b border-[#edf1f5] pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#092a53] text-[#ffdc32]">
            <Icon className="size-7" path={icons.receipt} />
          </span>
          <div className="min-w-0">
            <nav aria-label={t("Breadcrumb")} className="text-[11px] font-bold text-[#8190a1]">
              {t("Sales")} <span aria-hidden="true" className="mx-1">/</span>
              <span className="text-[#8a7000]">{t("Orders")}</span>
            </nav>
            <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-[#092a53] sm:text-[1.9rem]">{t("Orders")}</h1>
            <p className="mt-0.5 text-sm text-[#65748a]">{t("New orders awaiting payment and paid orders being prepared.")}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#f1f5f9] px-3 py-1.5 text-[11px] font-bold text-[#4f6379]">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#35a36b] opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex size-2 rounded-full bg-[#35a36b]" />
            </span>
            {lastUpdated
              ? t("Live · updated {time}", { time: relativeTime(new Date(lastUpdated).toISOString(), now, language) })
              : t("Live")}
          </span>
          <button
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#dce5ef] bg-white px-4 text-sm font-bold text-[#355777] transition hover:border-[#bacbdc] hover:bg-[#f6f9fc] hover:text-[#092a53] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] disabled:cursor-wait disabled:opacity-60"
            disabled={isRefreshing}
            onClick={refresh}
            type="button"
          >
            <Icon className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} path={icons.refresh} />
            {t("Refresh")}
          </button>
        </div>
      </header>

      {error && !isOverlayOpen && (
        <p className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100" role="alert">
          <Icon className="mt-0.5 size-4 shrink-0" path={icons.alert} />
          {error}
        </p>
      )}

      <section aria-label={t("Order overview")} className="admin-stats grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map((metric) => {
          const isActive = statusFilter === metric.key && metric.key !== "all";
          return (
            <button
              aria-pressed={isActive}
              className={`group rounded-2xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(18,44,80,0.07)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] sm:p-5 ${
                isActive ? "border-[#092a53] shadow-[0_0_0_1px_#092a53]" : "border-[#e5ebf3]"
              }`}
              key={metric.key}
              onClick={() => setStatusFilter(isActive || metric.key === "all" ? "all" : metric.key)}
              type="button"
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`grid size-9 place-items-center rounded-xl ${metric.accent}`}><Icon path={metric.icon} /></span>
                {metric.key !== "all" && (
                  <span className="text-[10px] font-bold text-[#a3b0bf] opacity-0 transition group-hover:opacity-100">{t(isActive ? "Clear filter" : "Filter")}</span>
                )}
              </div>
              <p className="mt-4 font-display text-[1.75rem] font-extrabold leading-none tracking-tight text-[#102c50]">{metric.value}</p>
              <p className="mt-1.5 text-xs font-semibold text-[#65748a]">{t(metric.label)}</p>
            </button>
          );
        })}
      </section>

      <section aria-label={t("Kitchen pipeline")} className="rounded-2xl bg-[#f7f9fc] p-3 ring-1 ring-[#e8edf3] sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#8190a1]">{t("Kitchen pipeline")}</p>
          <p className="text-xs font-bold text-[#4f6379]">
            {t("Paid orders in progress")}: <span className="text-[#092a53]">{formatMoney(openRevenue, "xaf", language)}</span>
          </p>
        </div>
        <ol className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {pipeline.map((stage, index) => {
            const key = `stage:${stage}`;
            const isActive = statusFilter === key;
            return (
              <li className="relative" key={stage}>
                <button
                  aria-pressed={isActive}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${isActive ? "bg-[#092a53] text-white" : "bg-white text-[#102c50] ring-1 ring-[#e3e9f0] hover:ring-[#c3cfdc]"}`}
                  onClick={() => setStatusFilter(isActive ? "all" : key)}
                  type="button"
                >
                  <span className={`grid size-7 shrink-0 place-items-center rounded-lg text-[11px] font-extrabold ${isActive ? "bg-[#ffdc32] text-[#092a53]" : "bg-[#f1f4f8] text-[#65748a]"}`}>{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-xs font-bold">{t(stageLabels[stage])}</span>
                  <span className="font-display text-lg font-extrabold tabular-nums">{counts.stages[stage] || 0}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="orders-queue-title" className="min-w-0 rounded-[20px] border border-[#e5ebf3] bg-white">
        <div className="flex flex-col gap-4 border-b border-[#edf1f5] p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-extrabold text-[#092a53]" id="orders-queue-title">{t("Order queue")}</h2>
              <p aria-live="polite" className="mt-0.5 text-xs text-[#65748a]">
                {t("Showing {shown} of {total} orders", { shown: visibleOrders.length, total: counts.all })}
              </p>
            </div>
            {hasActiveFilters && (
              <button
                className="text-xs font-bold text-[#355777] underline decoration-[#ffdc32] decoration-2 underline-offset-4 hover:text-[#092a53]"
                onClick={() => { setSearch(""); setStatusFilter("all"); setTypeFilter("all"); }}
                type="button"
              >
                {t("Clear filters")}
              </button>
            )}
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
            <label className="relative block">
              <span className="sr-only">{t("Search orders")}</span>
              <Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#8190a1]" path={icons.search} />
              <input className={`${inputClassName} pl-10`} onChange={(event) => setSearch(event.target.value)} placeholder={t("Search orders")} type="search" value={search} />
            </label>
            {isOwner && (
              <label className="block">
                <span className="sr-only">{t("Filter orders by store")}</span>
                <select className={`${inputClassName} lg:w-52`} onChange={(event) => setStoreFilter(event.target.value)} value={storeFilter}>
                  <option value="all">{t("All stores")}</option>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>{t(store.name)} · {t(store.town)}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="block">
              <span className="sr-only">{t("Sort by")}</span>
              <select className={`${inputClassName} lg:w-48`} onChange={(event) => setSortBy(event.target.value)} value={sortBy}>
                <option value="newest">{t("Sort: Newest first")}</option>
                <option value="oldest">{t("Sort: Oldest first")}</option>
                <option value="scheduled">{t("Sort: Scheduled soonest")}</option>
                <option value="total">{t("Sort: Highest total")}</option>
              </select>
            </label>
            <div aria-label={t("Fulfillment type")} className="flex rounded-xl bg-[#f1f4f8] p-1" role="group">
              {[
                { key: "all", label: t("All") },
                { key: "delivery", label: t("Delivery") },
                { key: "pickup", label: t("Pickup") },
              ].map((option) => (
                <button
                  aria-pressed={typeFilter === option.key}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition ${typeFilter === option.key ? "bg-white text-[#092a53] shadow-sm" : "text-[#65748a] hover:text-[#092a53]"}`}
                  key={option.key}
                  onClick={() => setTypeFilter(option.key)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div aria-label={t("Loading {title}…", { title: t("Orders").toLowerCase() })} className="space-y-3 p-4 sm:p-5" role="status">
            {[0, 1, 2, 3].map((row) => (
              <div className="flex animate-pulse items-center gap-4" key={row}>
                <span className="size-10 rounded-full bg-[#eef2f6]" />
                <span className="h-3 flex-1 rounded bg-[#eef2f6]" />
                <span className="h-3 w-24 rounded bg-[#eef2f6]" />
              </div>
            ))}
          </div>
        ) : visibleOrders.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#f1f4f8] text-[#8190a1]"><Icon className="size-5" path={icons.receipt} /></span>
            <p className="mt-4 font-display text-lg font-extrabold text-[#092a53]">
              {orders.length ? t("No orders match your search") : t("No orders yet.")}
            </p>
            {orders.length > 0 && <p className="mt-1 text-sm text-[#8190a1]">{t("Try a different search or status filter.")}</p>}
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#edf1f5] text-[11px] uppercase tracking-[0.08em] text-[#8190a1]">
                  <th className="px-5 py-3 font-extrabold" scope="col">{t("Order")}</th>
                  <th className="px-3 py-3 font-extrabold" scope="col">{t("Customer")}</th>
                  <th className="px-3 py-3 font-extrabold" scope="col">{t("Items")}</th>
                  <th className="px-3 py-3 font-extrabold" scope="col">{t("Fulfillment")}</th>
                  <th className="px-3 py-3 text-right font-extrabold" scope="col">{t("Total")}</th>
                  <th className="px-3 py-3 font-extrabold" scope="col">{t("Status")}</th>
                  <th className="px-5 py-3 text-right font-extrabold" scope="col"><span className="sr-only">{t("Action")}</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f3f7]">
                {visibleOrders.map((order) => {
                  const next = order.status === "processing" ? nextStage(order) : null;
                  const itemCount = order.items.reduce((total, item) => total + Number(item.quantity || 0), 0);
                  const isBusy = updatingOrderId === order.id || deletingOrderId === order.id;
                  return (
                    <tr
                      className={`cursor-pointer transition hover:bg-[#fafbfd] ${isBusy ? "opacity-60" : ""} ${selectedOrderId === order.id ? "bg-[#fffbea]" : ""}`}
                      key={order.id}
                      onClick={() => { setError(""); setSelectedOrderId(order.id); }}
                    >
                      <td className="px-5 py-3.5">
                        <button
                          className="text-left font-display text-base font-extrabold text-[#092a53] hover:underline focus-visible:outline-2 focus-visible:outline-[#bd9c00]"
                          onClick={(event) => { event.stopPropagation(); setError(""); setSelectedOrderId(order.id); }}
                          type="button"
                        >
                          #{order.id}
                        </button>
                        <p className="text-[11px] font-semibold text-[#8190a1]" title={formatDateTime(order.createdAt, language)}>
                          {relativeTime(order.createdAt, now, language)}
                        </p>
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-[#eef3f9] text-[11px] font-extrabold text-[#355777]">{initials(order.customerName)}</span>
                          <div className="min-w-0">
                            <p className="max-w-[11rem] truncate font-bold text-[#102c50]">{order.customerName}</p>
                            <p className="max-w-[11rem] truncate text-[11px] text-[#8190a1]">{order.customerPhone || order.customerEmail}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <p className="max-w-[13rem] truncate text-xs font-semibold text-[#4f6379]">
                          {order.items.map((item) => `${item.quantity}× ${item.flavorName}`).join(", ")}
                        </p>
                        <p className="text-[11px] text-[#a3b0bf]">{t("{count} items", { count: itemCount })}</p>
                      </td>
                      <td className="px-3 py-3.5">
                        <p className="flex items-center gap-1.5 text-xs font-bold text-[#102c50]">
                          <Icon className="size-3.5 text-[#8190a1]" path={order.fulfillmentType === "pickup" ? icons.store : icons.truck} />
                          {t(order.fulfillmentType === "pickup" ? "Pickup" : "Delivery")}
                        </p>
                        <p className="max-w-[11rem] truncate text-[11px] text-[#8190a1]">
                          {order.scheduledFor ? formatDateTime(order.scheduledFor, language) : t(order.storeName || "Store not recorded")}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-right font-extrabold tabular-nums text-[#102c50]">
                        {formatMoney(order.totalCents, order.currency, language)}
                      </td>
                      <td className="px-3 py-3.5">
                        <StatusBadge status={order.status} t={t} />
                        {order.status === "processing" && (
                          <p className="mt-1 text-[11px] font-semibold text-[#65748a]">{t(stageLabels[currentStage(order)] || currentStage(order))}</p>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {next && (
                            <button
                              className="inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#092a53] px-3 text-[11px] font-bold text-white transition hover:bg-[#163e6b] disabled:cursor-wait disabled:opacity-60"
                              disabled={isBusy}
                              onClick={() => (next.key === "delivered" ? markDelivered(order.id) : updateFulfillment(order.id, next.key))}
                              type="button"
                            >
                              {updatingOrderId === order.id ? t("Updating…") : t("Mark: {stage}", { stage: t(next.label) })}
                            </button>
                          )}
                          {canDelete(order) && (
                            <button
                              aria-label={t(order.status === "payment_failed" ? "Delete failed order" : "Delete unpaid order")}
                              className="grid size-8 place-items-center rounded-lg text-[#6b7d91] transition hover:bg-red-50 hover:text-red-600"
                              disabled={isBusy}
                              onClick={() => { setError(""); setOrderToDelete(order); }}
                              title={t(order.status === "payment_failed" ? "Delete failed order" : "Delete unpaid order")}
                              type="button"
                            >
                              <Icon path={icons.trash} />
                            </button>
                          )}
                          <button
                            aria-label={t("View details")}
                            className="grid size-8 place-items-center rounded-lg text-[#6b7d91] transition hover:bg-[#eef2f7] hover:text-[#092a53]"
                            onClick={() => { setError(""); setSelectedOrderId(order.id); }}
                            title={t("View details")}
                            type="button"
                          >
                            <Icon path={icons.chevron} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
          <button aria-label={t("Close")} className="admin-drawer-backdrop absolute inset-0 bg-[#0b1e36]/45 backdrop-blur-[2px]" onClick={() => setSelectedOrderId(null)} tabIndex={-1} type="button" />
          <section
            aria-labelledby="order-drawer-title"
            aria-modal="true"
            className="admin-drawer-panel relative flex h-full w-full max-w-[36rem] flex-col bg-white shadow-[-24px_0_60px_rgba(9,42,83,0.18)]"
            role="dialog"
          >
            <header className="border-b border-[#edf1f5] px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-2xl font-extrabold text-[#092a53]" id="order-drawer-title">
                      {t("Order #{id}", { id: selectedOrder.id })}
                    </h2>
                    <StatusBadge status={selectedOrder.status} t={t} />
                  </div>
                  <p className="mt-1 text-xs font-semibold text-[#8190a1]">
                    {t("Placed {date}", { date: formatDateTime(selectedOrder.createdAt, language) })} · {relativeTime(selectedOrder.createdAt, now, language)}
                  </p>
                </div>
                <button aria-label={t("Close")} className="grid size-9 shrink-0 place-items-center rounded-xl text-[#65748a] transition hover:bg-[#f1f4f8] hover:text-[#092a53]" onClick={() => setSelectedOrderId(null)} type="button">
                  <Icon className="size-5" path={icons.close} />
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6">
              {error && (
                <p className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100" role="alert">
                  <Icon className="mt-0.5 size-4 shrink-0" path={icons.alert} />
                  {error}
                </p>
              )}

              {selectedOrder.status === "processing" && (
                <section>
                  <h3 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#8190a1]">{t("Fulfillment status")}</h3>
                  <ol className="mt-3 space-y-1.5">
                    {stagesFor(selectedOrder).map((stage, index, stages) => {
                      const currentIndex = stages.findIndex((entry) => entry.key === currentStage(selectedOrder));
                      const isDone = index < currentIndex;
                      const isCurrent = index === currentIndex;
                      return (
                        <li key={stage.key}>
                          <button
                            aria-current={isCurrent ? "step" : undefined}
                            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition disabled:cursor-wait ${
                              isCurrent
                                ? "bg-[#fffbea] text-[#092a53] ring-2 ring-[#bd9c00]"
                                : isDone
                                  ? "text-[#2c7a4f] hover:bg-[#f4faf6]"
                                  : "text-[#65748a] ring-1 ring-[#e8edf3] hover:bg-[#f7f9fc] hover:text-[#092a53]"
                            }`}
                            disabled={updatingOrderId === selectedOrder.id || isCurrent}
                            onClick={() => (stage.key === "delivered" ? markDelivered(selectedOrder.id) : updateFulfillment(selectedOrder.id, stage.key))}
                            type="button"
                          >
                            <span className={`grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-extrabold ${
                              isDone ? "bg-[#35a36b] text-white" : isCurrent ? "bg-[#ffdc32] text-[#092a53]" : "bg-[#f1f4f8] text-[#8190a1]"
                            }`}>
                              {isDone ? <Icon className="size-3.5" path={icons.check} /> : index + 1}
                            </span>
                            <span className="flex-1">{t(stage.label)}</span>
                            {isCurrent && <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#8a7000]">{t("Current")}</span>}
                            {!isCurrent && !isDone && <span className="text-[11px] font-semibold text-[#a3b0bf]">{t("Set")}</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              )}

              <section className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-[#f7f9fc] p-4 ring-1 ring-[#e8edf3]">
                  <h3 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#8190a1]">{t("Customer")}</h3>
                  <p className="mt-2 font-bold text-[#102c50]">{selectedOrder.customerName}</p>
                  <a className="mt-1 flex items-center gap-1.5 truncate text-xs font-semibold text-[#355777] hover:underline" href={`mailto:${selectedOrder.customerEmail}`}>
                    <Icon className="size-3.5 shrink-0" path={icons.mail} />
                    <span className="truncate">{selectedOrder.customerEmail}</span>
                  </a>
                  {selectedOrder.customerPhone && (
                    <a className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-[#355777] hover:underline" href={`tel:${selectedOrder.customerPhone}`}>
                      <Icon className="size-3.5 shrink-0" path={icons.phone} />
                      {selectedOrder.customerPhone}
                    </a>
                  )}
                  {whatsappLink(selectedOrder.customerPhone, "") && (
                    <a
                      className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#25d366] px-2.5 py-1.5 text-xs font-bold text-white transition hover:bg-[#1ebe5a]"
                      href={whatsappLink(selectedOrder.customerPhone, orderUpdateMessage(selectedOrder, currentStage(selectedOrder)))}
                      rel="noopener noreferrer"
                      target="_blank"
                      title={t("Opens WhatsApp with this order's update ready to send")}
                    >
                      <WhatsAppIcon className="size-4" />
                      {t("Send update on WhatsApp")}
                    </a>
                  )}
                </div>
                <div className="rounded-2xl bg-[#f7f9fc] p-4 ring-1 ring-[#e8edf3]">
                  <h3 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#8190a1]">{t("Fulfillment destination")}</h3>
                  <p className="mt-2 flex items-center gap-1.5 font-bold text-[#102c50]">
                    <Icon className="size-4 text-[#8190a1]" path={selectedOrder.fulfillmentType === "pickup" ? icons.store : icons.truck} />
                    {t(selectedOrder.fulfillmentType === "pickup" ? "Pickup" : "Delivery")}
                  </p>
                  {(selectedOrder.deliveryResidence || selectedOrder.deliveryCity) && (
                    <p className="mt-1 text-xs leading-5 text-[#65748a]">
                      {selectedOrder.deliveryResidence}{selectedOrder.deliveryResidence ? ", " : ""}{selectedOrder.deliveryCity}
                    </p>
                  )}
                  {selectedOrder.scheduledFor && (
                    <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-[#4f6379]">
                      <Icon className="size-3.5" path={icons.clock} />
                      {formatDateTime(selectedOrder.scheduledFor, language)}
                    </p>
                  )}
                </div>
                <div className="flex items-start gap-3 rounded-2xl bg-[#f7f9fc] p-4 ring-1 ring-[#e8edf3] sm:col-span-2">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-[#092a53] shadow-sm"><Icon path={icons.pin} /></span>
                  <div className="min-w-0">
                    <h3 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#8190a1]">{t("Assigned store")}</h3>
                    <p className="mt-1 text-sm font-bold text-[#092a53]">{t(selectedOrder.storeName || "Store not recorded")}</p>
                    {selectedOrder.storeAddress && <p className="text-xs leading-5 text-[#65748a]">{t(selectedOrder.storeAddress)}</p>}
                    {selectedOrder.storePhone && <p className="text-xs font-semibold text-[#4f6379]">{selectedOrder.storePhone}</p>}
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#8190a1]">{t("Items")}</h3>
                <ul className="mt-3 divide-y divide-[#f0f3f7] rounded-2xl ring-1 ring-[#e8edf3]">
                  {selectedOrder.items.map((item) => (
                    <li className="flex items-center justify-between gap-3 px-4 py-3 text-sm" key={`${selectedOrder.id}-${item.flavorId}-${item.flavorName}`}>
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="grid h-7 min-w-7 shrink-0 place-items-center rounded-lg bg-[#f1f4f8] px-1.5 text-xs font-extrabold text-[#4f6379]">{item.quantity}×</span>
                        <span className="truncate font-semibold text-[#102c50]">{item.flavorName}</span>
                      </span>
                      <span className="shrink-0 font-bold tabular-nums text-[#4f6379]">{formatMoney(item.lineTotalCents, selectedOrder.currency, language)}</span>
                    </li>
                  ))}
                </ul>
                <dl className="mt-3 space-y-2 px-1 text-sm">
                  {selectedOrder.discountCents > 0 && (
                    <div className="flex justify-between gap-3 text-[#2c7a4f]">
                      <dt className="font-semibold">{t("Discount")}</dt>
                      <dd className="font-bold tabular-nums">−{formatMoney(selectedOrder.discountCents, selectedOrder.currency, language)}</dd>
                    </div>
                  )}
                  {selectedOrder.deliveryFee > 0 && (
                    <div className="flex justify-between gap-3 text-[#65748a]">
                      <dt>{t("Delivery fee")}</dt>
                      <dd className="font-bold tabular-nums">{formatMoney(selectedOrder.deliveryFee, selectedOrder.currency, language)}</dd>
                    </div>
                  )}
                  <div className="flex items-end justify-between gap-3 border-t border-dashed border-[#dde4ec] pt-3">
                    <dt className="font-display text-base font-extrabold text-[#092a53]">{t("Total")}</dt>
                    <dd className="font-display text-2xl font-extrabold tabular-nums text-[#092a53]">{formatMoney(selectedOrder.totalCents, selectedOrder.currency, language)}</dd>
                  </div>
                </dl>
              </section>
            </div>

            <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-[#edf1f5] bg-[#fafbfd] px-6 py-4">
              {canDelete(selectedOrder) && (
                <button
                  className="mr-auto inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-bold text-[#b2433a] transition hover:bg-red-50"
                  onClick={() => setOrderToDelete(selectedOrder)}
                  type="button"
                >
                  <Icon path={icons.trash} />
                  {t(selectedOrder.status === "payment_failed" ? "Delete failed order" : "Delete unpaid order")}
                </button>
              )}
              <button className="min-h-10 rounded-xl px-4 text-sm font-bold text-[#4f6379] transition hover:bg-[#eef2f6] hover:text-[#092a53]" onClick={() => setSelectedOrderId(null)} type="button">
                {t("Close")}
              </button>
              {selectedOrder.status === "processing" && (
                <button
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#092a53] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#163e6b] disabled:cursor-wait disabled:opacity-60"
                  disabled={updatingOrderId === selectedOrder.id}
                  onClick={() => markDelivered(selectedOrder.id)}
                  type="button"
                >
                  <Icon path={icons.check} />
                  {updatingOrderId === selectedOrder.id ? t("Updating…") : t("Mark as delivered")}
                </button>
              )}
            </footer>
          </section>
        </div>
      )}

      {orderToDelete && (
        <div className="fixed inset-0 z-[60] grid place-items-center px-5" role="presentation">
          <button aria-label={t("Cancel")} className="admin-drawer-backdrop absolute inset-0 bg-[#0b1e36]/45 backdrop-blur-[2px]" onClick={() => setOrderToDelete(null)} tabIndex={-1} type="button" />
          <section aria-labelledby="delete-order-title" aria-modal="true" className="admin-modal-panel relative w-full max-w-md rounded-[22px] bg-white p-6 shadow-[0_30px_80px_rgba(9,42,83,0.3)]" role="dialog">
            <span className="grid size-12 place-items-center rounded-2xl bg-red-50 text-red-600"><Icon className="size-6" path={icons.trash} /></span>
            <h2 className="mt-4 font-display text-xl font-extrabold text-[#092a53]" id="delete-order-title">
              {t(orderToDelete.status === "payment_failed" ? "Delete failed order" : "Delete unpaid order")} #{orderToDelete.id}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#65748a]">
              {orderToDelete.status === "payment_failed"
                ? t("Delete failed order #{id}? This will permanently remove the order and its payment record.", { id: orderToDelete.id })
                : t("Delete order #{id}? Stripe will first confirm the checkout is unpaid and expire it. This permanently removes the order.", { id: orderToDelete.id })}
            </p>
            {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700" role="alert">{error}</p>}
            <div className="mt-6 flex justify-end gap-2.5">
              <button className="min-h-10 rounded-xl px-4 text-sm font-bold text-[#4f6379] transition hover:bg-[#eef2f6]" onClick={() => setOrderToDelete(null)} type="button">{t("Cancel")}</button>
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-wait disabled:opacity-60"
                disabled={deletingOrderId === orderToDelete.id}
                onClick={confirmDelete}
                type="button"
              >
                <Icon path={icons.trash} />
                {deletingOrderId === orderToDelete.id ? t("Deleting…") : t("Delete")}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
