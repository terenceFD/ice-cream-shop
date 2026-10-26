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
  "h-9 w-full border border-[#d1d5db] bg-white px-3 text-sm font-medium text-[#092a53] outline-none placeholder:text-[#6b6b6b] focus:border-[#092a53] focus:ring-2 focus:ring-[#092a53]";

const icons = {
  refresh: "M4 12a8 8 0 0 1 13.7-5.7L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.7L4 15.5M4 20v-4.5h4.5",
  search: "m20 20-4.2-4.2M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z",
  check: "m5 12.5 4.5 4.5L19 7.5",
  alert: "M12 8v5m0 3.5v.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  close: "M6 6l12 12M18 6 6 18",
  mail: "M4 6h16v12H4V6Zm0 0 8 7 8-7",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z",
  trash: "M4 7h16M10 11v6m4-6v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3",
  chevron: "m9 6 6 6-6 6",
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
  pending_payment: { label: "Awaiting payment", badge: "bg-[#fff6e5] text-[#7a4e00]" },
  processing: { label: "Paid · preparing", badge: "bg-[#e9f1fa] text-[#163e6b]" },
  payment_failed: { label: "Payment failed", badge: "bg-[#ffedea] text-[#831c1e]" },
  delivered: { label: "Delivered", badge: "bg-[#dcfae5] text-[#04250e]" },
};

const stageLabels = {
  accepted: "Accepted",
  preparing: "Being prepared",
  ready: "Ready",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
};

function StatusBadge({ status, t }) {
  const meta = statusMeta[status] || { label: status, badge: "bg-[#f4f6f8] text-[#5f6368]" };
  return (
    <span className={`inline-flex h-5 shrink-0 items-center whitespace-nowrap px-2 text-[12px] font-medium ${meta.badge}`}>
      {t(meta.label)}
    </span>
  );
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
    const interval = window.setInterval(() => {
      if (!document.hidden) refresh();
    }, AUTO_REFRESH_MS);
    function handleVisibilityChange() {
      if (!document.hidden) refresh();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
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
    { key: "all", label: "All orders", value: counts.all },
    { key: "pending_payment", label: "Awaiting payment", value: counts.pending_payment },
    { key: "processing", label: "Paid · preparing", value: counts.processing },
    { key: "payment_failed", label: "Payment failed", value: counts.payment_failed },
  ];
  const pipeline = ["accepted", "preparing", "ready", "out_for_delivery"];
  const bottleneck = pipeline.reduce((lead, stage) => (
    (counts.stages[stage] || 0) > (counts.stages[lead] || 0) ? stage : lead
  ), pipeline[0]);
  const bottleneckCount = counts.stages[bottleneck] || 0;

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-col gap-4 border-b border-[#e8e8e8] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <nav aria-label={t("Breadcrumb")} className="text-xs font-medium text-[#5f6368]">
            {t("Sales")} <span aria-hidden="true" className="mx-1">/</span>
            <span className="text-[#092a53]">{t("Orders")}</span>
          </nav>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#111]">{t("Orders")}</h1>
          <p className="mt-1 text-sm text-[#5f6368]">
            <span className="tabular-nums text-[#111]">{counts.processing}</span>
            {" "}{t("Paid · preparing")}
            {" · "}
            <span className="tabular-nums text-[#111]">{counts.pending_payment}</span>
            {" "}{t("Awaiting payment")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 text-xs font-medium text-[#5f6368]">
            <span aria-hidden="true" className="size-1.5 bg-[#247b50]" />
            {lastUpdated
              ? t("Live · updated {time}", { time: relativeTime(new Date(lastUpdated).toISOString(), now, language) })
              : t("Live")}
          </span>
          <button
            className="inline-flex h-8 items-center gap-2 border border-[#d1d5db] bg-white px-3 text-sm font-medium text-[#111] transition hover:border-[#092a53] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] disabled:cursor-wait disabled:opacity-60"
            disabled={isRefreshing}
            onClick={refresh}
            type="button"
          >
            <Icon className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`} path={icons.refresh} />
            {t("Refresh")}
          </button>
        </div>
      </header>

      {error && !isOverlayOpen && (
        <p className="flex items-start gap-2 bg-[#ffedea] px-4 py-3 text-sm font-medium text-[#831c1e]" role="alert">
          <Icon className="mt-0.5 size-4 shrink-0" path={icons.alert} />
          {error}
        </p>
      )}

      <section aria-label={t("Order overview")} className="grid grid-cols-2 border border-[#e8e8e8] bg-white lg:grid-cols-4">
        {metrics.map((metric, index) => {
          const isActive = statusFilter === metric.key;
          return (
            <button
              aria-label={`${t(metric.label)} ${metric.value}`}
              aria-pressed={isActive}
              className={`border-[#e8e8e8] px-4 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#092a53] ${
                index % 2 === 1 ? "border-l" : ""
              } ${index > 1 ? "border-t lg:border-t-0" : ""} ${index > 0 ? "lg:border-l" : ""} ${
                isActive ? "bg-[#f4f6f8]" : "bg-white hover:bg-[#fafafa]"
              }`}
              key={metric.key}
              onClick={() => setStatusFilter((current) => (current === metric.key ? "all" : metric.key))}
              type="button"
            >
              <p className="text-xs font-medium text-[#5f6368]">{t(metric.label)}</p>
              <p className="mt-1 text-2xl font-medium tabular-nums tracking-tight text-[#111]">{metric.value}</p>
              {isActive && metric.key !== "all" && (
                <p className="mt-1 text-xs font-medium text-[#092a53]">{t("Clear filter")}</p>
              )}
            </button>
          );
        })}
      </section>

      <section aria-label={t("Kitchen pipeline")} className="border border-[#e8e8e8] bg-white">
        <div className="flex flex-wrap items-end justify-between gap-2 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-[#111]">{t("Kitchen pipeline")}</h2>
            {bottleneckCount > 0 && (
              <p className="mt-0.5 text-xs text-[#5f6368]">
                {t(stageLabels[bottleneck])}: <span className="tabular-nums text-[#111]">{bottleneckCount}</span>
              </p>
            )}
          </div>
          <p className="text-xs font-medium text-[#5f6368]">
            {t("Paid orders in progress")}
            <span className="ml-2 tabular-nums text-[#111]">{formatMoney(openRevenue, "xaf", language)}</span>
          </p>
        </div>
        <ol className="grid grid-cols-2 border-t border-[#e8e8e8] lg:grid-cols-4">
          {pipeline.map((stage, index) => {
            const key = `stage:${stage}`;
            const isActive = statusFilter === key;
            const count = counts.stages[stage] || 0;
            const isHot = stage === bottleneck && count > 0;
            return (
              <li className={`${index % 2 === 1 ? "border-l border-[#e8e8e8]" : ""} ${index > 1 ? "border-t border-[#e8e8e8] lg:border-t-0" : ""} ${index > 0 ? "lg:border-l lg:border-[#e8e8e8]" : ""}`} key={stage}>
                <button
                  aria-pressed={isActive}
                  className={`flex w-full items-end justify-between gap-3 px-4 py-3.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#092a53] ${
                    isActive ? "bg-[#092a53] text-white" : "bg-white text-[#111] hover:bg-[#fafafa]"
                  }`}
                  onClick={() => setStatusFilter((current) => (current === key ? "all" : key))}
                  type="button"
                >
                  <span>
                    <span className={`block text-xs font-medium ${isActive ? "text-white/70" : "text-[#5f6368]"}`}>{t(stageLabels[stage])}</span>
                    {isHot && !isActive && <span className="mt-1 block h-0.5 w-8 bg-[#ffdc32]" />}
                  </span>
                  <span className="text-2xl font-medium tabular-nums tracking-tight">{count}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="orders-queue-title" className="min-w-0 border border-[#e8e8e8] bg-white">
        <div className="flex flex-col gap-4 border-b border-[#e8e8e8] p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[#111]" id="orders-queue-title">{t("Order queue")}</h2>
              <p aria-live="polite" className="mt-0.5 text-xs text-[#5f6368]">
                {t("Showing {shown} of {total} orders", { shown: visibleOrders.length, total: counts.all })}
              </p>
            </div>
            {hasActiveFilters && (
              <button
                className="text-xs font-semibold text-[#092a53] underline decoration-[#ffdc32] decoration-2 underline-offset-4"
                onClick={() => { setSearch(""); setStatusFilter("all"); setTypeFilter("all"); }}
                type="button"
              >
                {t("Clear filters")}
              </button>
            )}
          </div>
          <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
            <label className="relative block">
              <span className="sr-only">{t("Search orders")}</span>
              <Icon className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#5f6368]" path={icons.search} />
              <input className={`${inputClassName} pl-9`} onChange={(event) => setSearch(event.target.value)} placeholder={t("Search orders")} type="search" value={search} />
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
            <div aria-label={t("Fulfillment type")} className="flex h-9 border border-[#d1d5db]" role="group">
              {[
                { key: "all", label: t("All") },
                { key: "delivery", label: t("Delivery") },
                { key: "pickup", label: t("Pickup") },
              ].map((option) => (
                <button
                  aria-pressed={typeFilter === option.key}
                  className={`flex-1 whitespace-nowrap px-3 text-xs font-medium transition ${typeFilter === option.key ? "bg-[#111] text-white" : "bg-white text-[#5f6368] hover:text-[#111]"}`}
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
          <div aria-label={t("Loading {title}…", { title: t("Orders").toLowerCase() })} className="space-y-0" role="status">
            {[0, 1, 2, 3, 4].map((row) => (
              <div className="flex h-12 items-center gap-4 border-b border-[#f2f2f2] px-4 last:border-b-0" key={row}>
                <span className="h-3 w-16 bg-[#eeeeee]" />
                <span className="h-3 flex-1 bg-[#eeeeee]" />
                <span className="h-3 w-20 bg-[#eeeeee]" />
              </div>
            ))}
          </div>
        ) : visibleOrders.length === 0 ? (
          <div className="border-t border-dashed border-[#e8e8e8] px-4 py-10">
            <p className="text-sm font-semibold text-[#111]">
              {orders.length ? t("No orders match your search") : t("No orders yet.")}
            </p>
            {orders.length > 0 && <p className="mt-1 text-sm text-[#5f6368]">{t("Try a different search or status filter.")}</p>}
          </div>
        ) : (
          <>
            <ul className="divide-y divide-[#f2f2f2] lg:hidden">
              {visibleOrders.map((order) => {
                const next = order.status === "processing" ? nextStage(order) : null;
                const itemCount = order.items.reduce((total, item) => total + Number(item.quantity || 0), 0);
                const isBusy = updatingOrderId === order.id || deletingOrderId === order.id;
                return (
                  <li className={isBusy ? "opacity-60" : ""} key={order.id}>
                    <button
                      className={`flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left ${selectedOrderId === order.id ? "bg-[#f4f6f8]" : ""}`}
                      onClick={() => { setError(""); setSelectedOrderId(order.id); }}
                      type="button"
                    >
                      <span className="min-w-0">
                        <span className="block font-semibold text-[#111]">#{order.id} · {order.customerName}</span>
                        <span className="mt-0.5 block truncate text-[13px] text-[#5f6368]">
                          {t(order.fulfillmentType === "pickup" ? "Pickup" : "Delivery")}
                          {" · "}
                          {t("{count} items", { count: itemCount })}
                          {" · "}
                          {relativeTime(order.createdAt, now, language)}
                        </span>
                        <span className="mt-2 inline-flex"><StatusBadge status={order.status} t={t} /></span>
                      </span>
                      <span className="shrink-0 text-right text-sm font-semibold tabular-nums text-[#111]">
                        {formatMoney(order.totalCents, order.currency, language)}
                      </span>
                    </button>
                    {next && (
                      <div className="flex justify-end px-4 pb-3">
                        <button
                          className="h-8 px-2 text-xs font-semibold text-[#092a53] underline decoration-[#ffdc32] decoration-2 underline-offset-4 disabled:cursor-wait disabled:opacity-60"
                          disabled={isBusy}
                          onClick={() => (next.key === "delivered" ? markDelivered(order.id) : updateFulfillment(order.id, next.key))}
                          type="button"
                        >
                          {updatingOrderId === order.id ? t("Updating…") : t("Mark: {stage}", { stage: t(next.label) })}
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="relative hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-xs font-medium text-[#5f6368]">
                    <th className="px-4 py-2.5 font-medium" scope="col">{t("Order")}</th>
                    <th className="px-3 py-2.5 font-medium" scope="col">{t("Customer")}</th>
                    <th className="px-3 py-2.5 font-medium" scope="col">{t("Items")}</th>
                    <th className="px-3 py-2.5 font-medium" scope="col">{t("Fulfillment")}</th>
                    <th className="px-3 py-2.5 text-right font-medium" scope="col">{t("Total")}</th>
                    <th className="px-3 py-2.5 font-medium" scope="col">{t("Status")}</th>
                    <th className="px-4 py-2.5 text-right font-medium" scope="col"><span className="sr-only">{t("Action")}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleOrders.map((order) => {
                    const next = order.status === "processing" ? nextStage(order) : null;
                    const itemCount = order.items.reduce((total, item) => total + Number(item.quantity || 0), 0);
                    const isBusy = updatingOrderId === order.id || deletingOrderId === order.id;
                    return (
                      <tr
                        className={`cursor-pointer border-t border-[#f2f2f2] ${isBusy ? "opacity-60" : ""} ${selectedOrderId === order.id ? "bg-[#f4f6f8]" : "bg-white hover:bg-[#fafafa]"}`}
                        key={order.id}
                        onClick={() => { setError(""); setSelectedOrderId(order.id); }}
                      >
                        <td className="px-4 py-3">
                          <button
                            className="text-left font-semibold text-[#111] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53]"
                            onClick={(event) => { event.stopPropagation(); setError(""); setSelectedOrderId(order.id); }}
                            type="button"
                          >
                            #{order.id}
                          </button>
                          <p className="text-xs text-[#5f6368]" title={formatDateTime(order.createdAt, language)}>
                            {relativeTime(order.createdAt, now, language)}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <p className="max-w-[11rem] truncate font-medium text-[#111]">{order.customerName}</p>
                          <p className="max-w-[11rem] truncate text-xs text-[#5f6368]">{order.customerPhone || order.customerEmail}</p>
                        </td>
                        <td className="px-3 py-3">
                          <p className="max-w-[13rem] truncate text-[13px] text-[#111]">
                            {order.items.map((item) => `${item.quantity}× ${item.flavorName}`).join(", ")}
                          </p>
                          <p className="text-xs text-[#5f6368]">{t("{count} items", { count: itemCount })}</p>
                        </td>
                        <td className="px-3 py-3">
                          <p className="text-[13px] font-medium text-[#111]">
                            {t(order.fulfillmentType === "pickup" ? "Pickup" : "Delivery")}
                          </p>
                          <p className="max-w-[11rem] truncate text-xs text-[#5f6368]">
                            {order.scheduledFor ? formatDateTime(order.scheduledFor, language) : t(order.storeName || "Store not recorded")}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums text-[#111]">
                          {formatMoney(order.totalCents, order.currency, language)}
                        </td>
                        <td className="px-3 py-3">
                          <StatusBadge status={order.status} t={t} />
                          {order.status === "processing" && (
                            <p className="mt-1 text-xs text-[#5f6368]">{t(stageLabels[currentStage(order)] || currentStage(order))}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right" onClick={(event) => event.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {next && (
                              <button
                                className="inline-flex h-8 items-center whitespace-nowrap px-2 text-xs font-semibold text-[#092a53] underline decoration-[#ffdc32] decoration-2 underline-offset-4 disabled:cursor-wait disabled:opacity-60"
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
                                className="grid size-8 place-items-center text-[#5f6368] transition hover:bg-[#ffedea] hover:text-[#831c1e]"
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
                              className="grid size-8 place-items-center text-[#5f6368] transition hover:bg-[#f4f6f8] hover:text-[#111]"
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
          </>
        )}
      </section>

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
          <button aria-label={t("Close")} className="admin-drawer-backdrop absolute inset-0 bg-[#111]/40" onClick={() => setSelectedOrderId(null)} tabIndex={-1} type="button" />
          <section
            aria-labelledby="order-drawer-title"
            aria-modal="true"
            className="admin-drawer-panel relative flex h-full w-full max-w-[32rem] flex-col border-l border-[#e8e8e8] bg-white"
            role="dialog"
          >
            <header className="border-b border-[#e8e8e8] px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold text-[#111]" id="order-drawer-title">
                      {t("Order #{id}", { id: selectedOrder.id })}
                    </h2>
                    <StatusBadge status={selectedOrder.status} t={t} />
                  </div>
                  <p className="mt-1 text-xs text-[#5f6368]">
                    {t("Placed {date}", { date: formatDateTime(selectedOrder.createdAt, language) })} · {relativeTime(selectedOrder.createdAt, now, language)}
                  </p>
                </div>
                <button aria-label={t("Close")} className="grid size-9 shrink-0 place-items-center text-[#5f6368] transition hover:bg-[#f4f6f8] hover:text-[#111]" onClick={() => setSelectedOrderId(null)} type="button">
                  <Icon className="size-5" path={icons.close} />
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
              {error && (
                <p className="flex items-start gap-2 bg-[#ffedea] px-4 py-3 text-sm font-medium text-[#831c1e]" role="alert">
                  <Icon className="mt-0.5 size-4 shrink-0" path={icons.alert} />
                  {error}
                </p>
              )}

              {selectedOrder.status === "processing" && (
                <section>
                  <h3 className="text-xs font-medium text-[#5f6368]">{t("Fulfillment status")}</h3>
                  <ol className="mt-2 border border-[#e8e8e8]">
                    {stagesFor(selectedOrder).map((stage, index, stages) => {
                      const currentIndex = stages.findIndex((entry) => entry.key === currentStage(selectedOrder));
                      const isDone = index < currentIndex;
                      const isCurrent = index === currentIndex;
                      return (
                        <li className={index ? "border-t border-[#e8e8e8]" : ""} key={stage.key}>
                          <button
                            aria-current={isCurrent ? "step" : undefined}
                            className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition disabled:cursor-wait ${
                              isCurrent
                                ? "bg-[#fff8d6] font-semibold text-[#111]"
                                : isDone
                                  ? "font-medium text-[#247b50] hover:bg-[#f6fbf7]"
                                  : "text-[#5f6368] hover:bg-[#fafafa] hover:text-[#111]"
                            }`}
                            disabled={updatingOrderId === selectedOrder.id || isCurrent}
                            onClick={() => (stage.key === "delivered" ? markDelivered(selectedOrder.id) : updateFulfillment(selectedOrder.id, stage.key))}
                            type="button"
                          >
                            <span className={`grid size-6 shrink-0 place-items-center text-xs font-semibold ${
                              isDone ? "bg-[#247b50] text-white" : isCurrent ? "bg-[#ffdc32] text-[#111]" : "bg-[#f4f6f8] text-[#5f6368]"
                            }`}>
                              {isDone ? <Icon className="size-3.5" path={icons.check} /> : index + 1}
                            </span>
                            <span className="flex-1">{t(stage.label)}</span>
                            {isCurrent && <span className="text-xs font-medium text-[#7a4e00]">{t("Current")}</span>}
                            {!isCurrent && !isDone && <span className="text-xs text-[#5f6368]">{t("Set")}</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              )}

              <section className="grid gap-px bg-[#e8e8e8] sm:grid-cols-2">
                <div className="bg-white p-4">
                  <h3 className="text-xs font-medium text-[#5f6368]">{t("Customer")}</h3>
                  <p className="mt-2 font-semibold text-[#111]">{selectedOrder.customerName}</p>
                  <a className="mt-1 flex items-center gap-1.5 truncate text-xs font-medium text-[#092a53] hover:underline" href={`mailto:${selectedOrder.customerEmail}`}>
                    <Icon className="size-3.5 shrink-0" path={icons.mail} />
                    <span className="truncate">{selectedOrder.customerEmail}</span>
                  </a>
                  {selectedOrder.customerPhone && (
                    <a className="mt-1 flex items-center gap-1.5 text-xs font-medium text-[#092a53] hover:underline" href={`tel:${selectedOrder.customerPhone}`}>
                      <Icon className="size-3.5 shrink-0" path={icons.phone} />
                      {selectedOrder.customerPhone}
                    </a>
                  )}
                  {whatsappLink(selectedOrder.customerPhone, "") && (
                    <a
                      className="mt-3 inline-flex h-8 items-center gap-1.5 bg-[#111] px-2.5 text-xs font-semibold text-white transition hover:bg-[#092a53]"
                      href={whatsappLink(selectedOrder.customerPhone, orderUpdateMessage(selectedOrder, currentStage(selectedOrder)))}
                      rel="noopener noreferrer"
                      target="_blank"
                      title={t("Opens WhatsApp with this order's update ready to send")}
                    >
                      <WhatsAppIcon className="size-3.5" />
                      {t("Send update on WhatsApp")}
                    </a>
                  )}
                </div>
                <div className="bg-white p-4">
                  <h3 className="text-xs font-medium text-[#5f6368]">{t("Fulfillment destination")}</h3>
                  <p className="mt-2 font-semibold text-[#111]">
                    {t(selectedOrder.fulfillmentType === "pickup" ? "Pickup" : "Delivery")}
                  </p>
                  {(selectedOrder.deliveryResidence || selectedOrder.deliveryCity) && (
                    <p className="mt-1 text-xs leading-5 text-[#5f6368]">
                      {selectedOrder.deliveryResidence}{selectedOrder.deliveryResidence ? ", " : ""}{selectedOrder.deliveryCity}
                    </p>
                  )}
                  {selectedOrder.scheduledFor && (
                    <p className="mt-1 text-xs font-medium text-[#5f6368]">
                      {formatDateTime(selectedOrder.scheduledFor, language)}
                    </p>
                  )}
                </div>
                <div className="bg-white p-4 sm:col-span-2">
                  <h3 className="text-xs font-medium text-[#5f6368]">{t("Assigned store")}</h3>
                  <p className="mt-1 text-sm font-semibold text-[#111]">{t(selectedOrder.storeName || "Store not recorded")}</p>
                  {selectedOrder.storeAddress && <p className="text-xs leading-5 text-[#5f6368]">{t(selectedOrder.storeAddress)}</p>}
                  {selectedOrder.storePhone && <p className="text-xs font-medium text-[#5f6368]">{selectedOrder.storePhone}</p>}
                </div>
              </section>

              <section>
                <h3 className="text-xs font-medium text-[#5f6368]">{t("Items")}</h3>
                <ul className="mt-2 divide-y divide-[#f2f2f2] border border-[#e8e8e8]">
                  {selectedOrder.items.map((item) => (
                    <li className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm" key={`${selectedOrder.id}-${item.flavorId}-${item.flavorName}`}>
                      <span className="min-w-0 truncate text-[#111]">
                        <span className="tabular-nums text-[#5f6368]">{item.quantity}×</span> {item.flavorName}
                      </span>
                      <span className="shrink-0 font-medium tabular-nums text-[#111]">{formatMoney(item.lineTotalCents, selectedOrder.currency, language)}</span>
                    </li>
                  ))}
                </ul>
                <dl className="mt-3 space-y-2 text-sm">
                  {selectedOrder.discountCents > 0 && (
                    <div className="flex justify-between gap-3 text-[#247b50]">
                      <dt>{t("Discount")}</dt>
                      <dd className="font-medium tabular-nums">−{formatMoney(selectedOrder.discountCents, selectedOrder.currency, language)}</dd>
                    </div>
                  )}
                  {selectedOrder.deliveryFee > 0 && (
                    <div className="flex justify-between gap-3 text-[#5f6368]">
                      <dt>{t("Delivery fee")}</dt>
                      <dd className="font-medium tabular-nums">{formatMoney(selectedOrder.deliveryFee, selectedOrder.currency, language)}</dd>
                    </div>
                  )}
                  <div className="flex items-end justify-between gap-3 border-t border-[#e8e8e8] pt-3">
                    <dt className="font-semibold text-[#111]">{t("Total")}</dt>
                    <dd className="text-2xl font-semibold tabular-nums tracking-tight text-[#111]">{formatMoney(selectedOrder.totalCents, selectedOrder.currency, language)}</dd>
                  </div>
                </dl>
              </section>
            </div>

            <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-[#e8e8e8] bg-white px-5 py-3">
              {canDelete(selectedOrder) && (
                <button
                  className="mr-auto inline-flex h-9 items-center gap-2 px-2 text-sm font-medium text-[#831c1e] transition hover:bg-[#ffedea]"
                  onClick={() => setOrderToDelete(selectedOrder)}
                  type="button"
                >
                  <Icon path={icons.trash} />
                  {t(selectedOrder.status === "payment_failed" ? "Delete failed order" : "Delete unpaid order")}
                </button>
              )}
              <button className="h-9 px-3 text-sm font-medium text-[#5f6368] transition hover:bg-[#f4f6f8] hover:text-[#111]" onClick={() => setSelectedOrderId(null)} type="button">
                {t("Close")}
              </button>
              {selectedOrder.status === "processing" && (
                <button
                  className="inline-flex h-9 items-center gap-2 bg-[#111] px-4 text-sm font-semibold text-white transition hover:bg-[#092a53] disabled:cursor-wait disabled:opacity-60"
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
          <button aria-label={t("Cancel")} className="admin-drawer-backdrop absolute inset-0 bg-[#111]/40" onClick={() => setOrderToDelete(null)} tabIndex={-1} type="button" />
          <section aria-labelledby="delete-order-title" aria-modal="true" className="admin-modal-panel relative w-full max-w-md border border-[#e8e8e8] bg-white p-5" role="dialog">
            <h2 className="text-lg font-semibold text-[#111]" id="delete-order-title">
              {t(orderToDelete.status === "payment_failed" ? "Delete failed order" : "Delete unpaid order")} #{orderToDelete.id}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#5f6368]">
              {orderToDelete.status === "payment_failed"
                ? t("Delete failed order #{id}? This will permanently remove the order and its payment record.", { id: orderToDelete.id })
                : t("Delete order #{id}? Stripe will first confirm the checkout is unpaid and expire it. This permanently removes the order.", { id: orderToDelete.id })}
            </p>
            {error && <p className="mt-3 bg-[#ffedea] px-3 py-2.5 text-sm font-medium text-[#831c1e]" role="alert">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button className="h-9 px-3 text-sm font-medium text-[#5f6368] transition hover:bg-[#f4f6f8]" onClick={() => setOrderToDelete(null)} type="button">{t("Cancel")}</button>
              <button
                className="inline-flex h-9 items-center gap-2 bg-[#831c1e] px-3 text-sm font-semibold text-white transition hover:bg-[#6d1618] disabled:cursor-wait disabled:opacity-60"
                disabled={deletingOrderId === orderToDelete.id}
                onClick={confirmDelete}
                type="button"
              >
                {deletingOrderId === orderToDelete.id ? t("Deleting…") : t("Delete")}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
