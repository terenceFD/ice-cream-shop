import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../../api/api";
import { useAdminAuth } from "./useAdminAuth";
import { useLanguage } from "../../../language/useLanguage";
import { formatCartMoney, USD_TO_XAF } from "../../../cartPricing";

const CHART_DAYS = 14;
const inputClassName =
  "w-full rounded-xl border border-[#dde4ec] bg-[#f8fafc] px-3.5 py-2.5 text-sm font-medium text-[#102c50] transition placeholder:text-[#9aa5b3] hover:border-[#c9d4e0] focus:border-[#bd9c00] focus:bg-white focus:ring-4 focus:ring-[#ffdc32]/25 outline-none!";

const icons = {
  delivered: "M4 12.5 9 17.5 20 6.5",
  box: "M4 8l8-4 8 4v8l-8 4-8-4V8Zm0 0 8 4m0 0 8-4m-8 4v8",
  refresh: "M4 12a8 8 0 0 1 13.7-5.7L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.7L4 15.5M4 20v-4.5h4.5",
  search: "m20 20-4.2-4.2M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z",
  download: "M12 4v12m0 0-5-5m5 5 5-5M5 20h14",
  trash: "M4 7h16M10 11v6m4-6v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3",
  alert: "M12 8v5m0 3.5v.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  close: "M6 6l12 12M18 6 6 18",
  truck: "M3 7h11v9H3V7Zm11 3h4l3 3v3h-7v-6ZM7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  store: "M4 10h16l-1.5-5h-13L4 10Zm0 0v10h16V10M9 20v-5h6v5",
  money: "M3 7h18v10H3V7Zm9 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM6 10v4m12-4v4",
  chart: "M4 19V5m0 14h16M8 15v-3m4 3V8m4 7v-5",
  chevron: "m9 6 6 6-6 6",
  mail: "M4 6h16v12H4V6Zm0 0 8 7 8-7",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z",
  pin: "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  clock: "M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
};

function Icon({ path, className = "size-4" }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d={path} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function toXaf(cents, currency) {
  return String(currency || "xaf").toLowerCase() === "usd" ? Math.round((Number(cents || 0) / 100) * USD_TO_XAF) : Number(cents || 0);
}

function parseDate(value) {
  if (!value) return null;
  const normalizedValue = String(value).replace(" ", "T");
  const date = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(normalizedValue) ? normalizedValue : `${normalizedValue}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function deliveredDate(order) {
  return parseDate(order.deliveredAt) || parseDate(order.createdAt);
}

function dayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function initials(name) {
  return String(name || "?").trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("");
}

export function AdminDeliveredBoard() {
  const { sessionToken, currentAdmin } = useAdminAuth();
  const isOwner = currentAdmin?.role === "owner";
  const { t, language } = useLanguage();
  const locale = language === "fr" ? "fr-CM" : "en-CM";
  const money = (amount) => formatCartMoney(amount, "xaf", language);
  const [orders, setOrders] = useState([]);
  const [deliveredCount, setDeliveredCount] = useState(0);
  const [stores, setStores] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [storeFilter, setStoreFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [rangeFilter, setRangeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const query = new URLSearchParams({ status: "delivered" });
      if (storeFilter !== "all") query.set("storeId", storeFilter);
      const [result, storeResult] = await Promise.all([
        apiRequest(`/admin/orders?${query}`, { token: sessionToken }),
        apiRequest("/admin/stores", { token: sessionToken }),
      ]);
      setOrders(result.orders);
      setDeliveredCount(result.count ?? result.orders.length);
      setStores(storeResult.stores);
      setError("");
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [sessionToken, storeFilter]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selectedOrder = orders.find((order) => order.id === selectedOrderId) || null;
  const isOverlayOpen = Boolean(selectedOrder) || isConfirmingClear;

  useEffect(() => {
    if (!isOverlayOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(event) {
      if (event.key !== "Escape") return;
      setIsConfirmingClear(false);
      setSelectedOrderId(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOverlayOpen]);

  async function clearDeliveredOrders() {
    setError("");
    setIsClearing(true);
    try {
      const query = new URLSearchParams();
      if (isOwner && storeFilter !== "all") query.set("storeId", storeFilter);
      await apiRequest(`/admin/orders/delivered${query.size ? `?${query}` : ""}`, { method: "DELETE", token: sessionToken });
      setIsConfirmingClear(false);
      await refresh();
    } catch (clearError) {
      setError(t(clearError.message));
    } finally {
      setIsClearing(false);
    }
  }

  const summary = useMemo(() => orders.reduce((result, order) => {
    const amount = toXaf(order.totalCents, order.currency);
    result.revenue += amount;
    if (order.fulfillmentType === "pickup") result.pickup += 1;
    else result.delivery += 1;
    return result;
  }, { revenue: 0, pickup: 0, delivery: 0 }), [orders]);
  const averageOrder = orders.length ? Math.round(summary.revenue / orders.length) : 0;
  const deliveryShare = orders.length ? Math.round((summary.delivery / orders.length) * 100) : 0;

  const chart = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Array.from({ length: CHART_DAYS }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (CHART_DAYS - 1 - index));
      return { key: dayKey(date), date, revenue: 0, count: 0 };
    });
    const byKey = new Map(days.map((day) => [day.key, day]));
    orders.forEach((order) => {
      const date = deliveredDate(order);
      if (!date) return;
      const day = byKey.get(dayKey(date));
      if (!day) return;
      day.revenue += toXaf(order.totalCents, order.currency);
      day.count += 1;
    });
    const max = Math.max(1, ...days.map((day) => day.revenue));
    const total = days.reduce((sum, day) => sum + day.revenue, 0);
    return { days, max, total };
  }, [orders]);

  const visibleOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    const now = Date.now();
    const rangeMs = { today: null, "7d": 7 * 86400000, "30d": 30 * 86400000 }[rangeFilter];
    const todayKey = dayKey(new Date());
    return orders
      .filter((order) => {
        const date = deliveredDate(order);
        const matchesRange = rangeFilter === "all"
          || (rangeFilter === "today" && date && dayKey(date) === todayKey)
          || (rangeMs && date && now - date.getTime() <= rangeMs);
        const matchesType = typeFilter === "all" || order.fulfillmentType === typeFilter;
        const matchesSearch = !query || [
          order.id, order.customerName, order.customerEmail, order.customerPhone,
          order.storeName, order.deliveryCity, order.deliveryResidence,
          ...order.items.map((item) => item.flavorName),
        ].some((value) => String(value || "").toLowerCase().includes(query));
        return matchesRange && matchesType && matchesSearch;
      })
      .sort((a, b) => {
        if (sortBy === "oldest") return (deliveredDate(a)?.getTime() || 0) - (deliveredDate(b)?.getTime() || 0);
        if (sortBy === "total") return toXaf(b.totalCents, b.currency) - toXaf(a.totalCents, a.currency);
        return (deliveredDate(b)?.getTime() || 0) - (deliveredDate(a)?.getTime() || 0);
      });
  }, [orders, rangeFilter, search, sortBy, typeFilter]);

  const visibleRevenue = visibleOrders.reduce((sum, order) => sum + toXaf(order.totalCents, order.currency), 0);
  const hasActiveFilters = Boolean(search.trim() || typeFilter !== "all" || rangeFilter !== "all");

  function exportCsv() {
    const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [
      ["Order", "Delivered", "Placed", "Customer", "Email", "Phone", "Fulfillment", "Store", "Items", "Total (FCFA)"],
      ...visibleOrders.map((order) => [
        order.id,
        deliveredDate(order)?.toISOString() || "",
        parseDate(order.createdAt)?.toISOString() || "",
        order.customerName,
        order.customerEmail,
        order.customerPhone,
        order.fulfillmentType,
        order.storeName,
        order.items.map((item) => `${item.quantity}x ${item.flavorName}`).join("; "),
        toXaf(order.totalCents, order.currency),
      ]),
    ];
    const blob = new Blob([`﻿${rows.map((row) => row.map(escape).join(",")).join("\r\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `delivered-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const metrics = [
    { label: "Total delivered", value: deliveredCount.toLocaleString(locale), hint: t("Completed orders"), icon: icons.delivered, accent: "bg-[#e5f4ea] text-[#2c7a4f]" },
    { label: "Delivered revenue", value: money(summary.revenue), hint: t("Revenue from completed orders"), icon: icons.money, accent: "bg-[#fff4c2] text-[#8a6f00]" },
    { label: "Average order", value: money(averageOrder), hint: t("Per delivered order"), icon: icons.chart, accent: "bg-[#e9f1fa] text-[#315982]" },
    { label: "Home delivery", value: `${deliveryShare}%`, hint: t("{delivery} delivered · {pickup} picked up", { delivery: summary.delivery, pickup: summary.pickup }), icon: icons.truck, accent: "bg-[#efe9fb] text-[#5b3fa0]" },
  ];

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-col gap-5 border-b border-[#edf1f5] pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#092a53] text-[#ffdc32]">
            <Icon className="size-7" path={icons.delivered} />
          </span>
          <div className="min-w-0">
            <nav aria-label={t("Breadcrumb")} className="text-[11px] font-bold text-[#8190a1]">
              {t("Sales")} <span aria-hidden="true" className="mx-1">/</span>
              <span className="text-[#a48700]">{t("Delivered")}</span>
            </nav>
            <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-[#092a53] sm:text-[1.9rem]">{t("Delivered orders")}</h1>
            <p className="mt-0.5 text-sm text-[#65748a]">{t("Orders confirmed as delivered.")}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {deliveredCount > 3 && (
            <button
              className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-bold text-[#b2433a] transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-60"
              disabled={isLoading || isClearing}
              onClick={() => { setError(""); setIsConfirmingClear(true); }}
              type="button"
            >
              <Icon path={icons.trash} />
              {t("Clear all delivered orders")}
            </button>
          )}
          <button
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#dce5ef] bg-white px-4 text-sm font-bold text-[#355777] transition hover:border-[#bacbdc] hover:bg-[#f6f9fc] hover:text-[#092a53] disabled:opacity-50"
            disabled={!visibleOrders.length}
            onClick={exportCsv}
            type="button"
          >
            <Icon path={icons.download} />
            {t("Export CSV")}
          </button>
          <button
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#dce5ef] bg-white px-4 text-sm font-bold text-[#355777] transition hover:border-[#bacbdc] hover:bg-[#f6f9fc] hover:text-[#092a53] disabled:cursor-wait disabled:opacity-60"
            disabled={isRefreshing || isClearing}
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

      <section aria-label={t("Delivery overview")} className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article className="rounded-2xl border border-[#e5ebf3] bg-white p-4 sm:p-5" key={metric.label}>
            <span className={`grid size-9 place-items-center rounded-xl ${metric.accent}`}><Icon path={metric.icon} /></span>
            <p className="mt-4 truncate font-display text-[1.6rem] font-extrabold leading-none tracking-tight text-[#102c50]">{metric.value}</p>
            <p className="mt-1.5 text-xs font-semibold text-[#65748a]">{t(metric.label)}</p>
            <p className="mt-0.5 truncate text-[11px] text-[#a3b0bf]">{metric.hint}</p>
          </article>
        ))}
      </section>

      <section aria-labelledby="delivered-chart-title" className="rounded-[20px] border border-[#e5ebf3] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-extrabold text-[#092a53]" id="delivered-chart-title">{t("Revenue, last {days} days", { days: CHART_DAYS })}</h2>
            <p className="mt-0.5 text-xs text-[#65748a]">{t("Based on the delivery date of each order.")}</p>
          </div>
          <p className="font-display text-xl font-extrabold text-[#092a53]">{money(chart.total)}</p>
        </div>
        <ol className="mt-5 flex h-40 items-end gap-1.5 sm:gap-2">
          {chart.days.map((day, index) => {
            const height = day.revenue ? Math.max(6, Math.round((day.revenue / chart.max) * 100)) : 0;
            const isToday = index === chart.days.length - 1;
            return (
              <li className="group relative flex h-full flex-1 flex-col items-center justify-end gap-1.5" key={day.key}>
                <span className="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-lg bg-[#092a53] px-2.5 py-1.5 text-[11px] font-bold text-white shadow-lg group-hover:block">
                  {day.date.toLocaleDateString(locale, { day: "numeric", month: "short" })} · {money(day.revenue)} · {t("{count} orders", { count: day.count })}
                </span>
                <span className="relative flex w-full flex-1 items-end rounded-md bg-[#f4f6f9]">
                  <span
                    aria-label={`${day.date.toLocaleDateString(locale)}: ${money(day.revenue)}`}
                    className={`w-full rounded-md transition-[height] duration-500 ${isToday ? "bg-[#ffdc32]" : "bg-[#092a53] group-hover:bg-[#1d4f80]"}`}
                    role="img"
                    style={{ height: `${height}%` }}
                  />
                </span>
                <span className={`text-[10px] font-bold ${isToday ? "text-[#a48700]" : "text-[#a3b0bf]"} ${index % 2 && !isToday ? "max-sm:invisible" : ""}`}>
                  {day.date.toLocaleDateString(locale, { day: "numeric" })}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="delivered-history-title" className="min-w-0 rounded-[20px] border border-[#e5ebf3] bg-white">
        <div className="flex flex-col gap-4 border-b border-[#edf1f5] p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-extrabold text-[#092a53]" id="delivered-history-title">{t("Delivery history")}</h2>
              <p aria-live="polite" className="mt-0.5 text-xs text-[#65748a]">
                {t("Showing {shown} of {total} orders", { shown: visibleOrders.length, total: deliveredCount })} · {money(visibleRevenue)}
              </p>
            </div>
            {hasActiveFilters && (
              <button
                className="text-xs font-bold text-[#355777] underline decoration-[#ffdc32] decoration-2 underline-offset-4 hover:text-[#092a53]"
                onClick={() => { setSearch(""); setTypeFilter("all"); setRangeFilter("all"); }}
                type="button"
              >
                {t("Clear filters")}
              </button>
            )}
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
            <label className="relative block">
              <span className="sr-only">{t("Search delivered orders")}</span>
              <Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#8190a1]" path={icons.search} />
              <input className={`${inputClassName} pl-10`} onChange={(event) => setSearch(event.target.value)} placeholder={t("Search by customer, item, or order number")} type="search" value={search} />
            </label>
            {isOwner && (
              <label className="block">
                <span className="sr-only">{t("Filter orders by store")}</span>
                <select className={`${inputClassName} lg:w-52`} onChange={(event) => setStoreFilter(event.target.value)} value={storeFilter}>
                  <option value="all">{t("All stores")}</option>
                  {stores.map((store) => <option key={store.id} value={store.id}>{t(store.name)} · {t(store.town)}</option>)}
                </select>
              </label>
            )}
            <label className="block">
              <span className="sr-only">{t("Sort by")}</span>
              <select className={`${inputClassName} lg:w-48`} onChange={(event) => setSortBy(event.target.value)} value={sortBy}>
                <option value="recent">{t("Sort: Newest first")}</option>
                <option value="oldest">{t("Sort: Oldest first")}</option>
                <option value="total">{t("Sort: Highest total")}</option>
              </select>
            </label>
            <div aria-label={t("Date range")} className="flex overflow-x-auto rounded-xl bg-[#f1f4f8] p-1" role="group">
              {[
                { key: "all", label: t("All time") },
                { key: "today", label: t("Today") },
                { key: "7d", label: t("7 days") },
                { key: "30d", label: t("30 days") },
              ].map((option) => (
                <button
                  aria-pressed={rangeFilter === option.key}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition ${rangeFilter === option.key ? "bg-white text-[#092a53] shadow-sm" : "text-[#65748a] hover:text-[#092a53]"}`}
                  key={option.key}
                  onClick={() => setRangeFilter(option.key)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div aria-label={t("Fulfillment type")} className="flex w-fit max-w-full overflow-x-auto rounded-xl bg-[#f1f4f8] p-1" role="group">
            {[
              { key: "all", label: t("All"), count: orders.length },
              { key: "delivery", label: t("Home delivery"), count: summary.delivery },
              { key: "pickup", label: t("Pickup"), count: summary.pickup },
            ].map((option) => (
              <button
                aria-pressed={typeFilter === option.key}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition ${typeFilter === option.key ? "bg-white text-[#092a53] shadow-sm" : "text-[#65748a] hover:text-[#092a53]"}`}
                key={option.key}
                onClick={() => setTypeFilter(option.key)}
                type="button"
              >
                {option.label}
                <span className="rounded-full bg-[#e6ebf1] px-1.5 text-[10px] text-[#65748a]">{option.count}</span>
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div aria-label={t("Loading…")} className="space-y-3 p-4 sm:p-5" role="status">
            {[0, 1, 2, 3].map((row) => (
              <div className="flex animate-pulse items-center gap-4" key={row}>
                <span className="size-9 rounded-full bg-[#eef2f6]" />
                <span className="h-3 flex-1 rounded bg-[#eef2f6]" />
                <span className="h-3 w-24 rounded bg-[#eef2f6]" />
              </div>
            ))}
          </div>
        ) : visibleOrders.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#f1f4f8] text-[#8190a1]"><Icon className="size-5" path={icons.box} /></span>
            <p className="mt-4 font-display text-lg font-extrabold text-[#092a53]">
              {orders.length ? t("No delivered orders match your search") : t("No delivered orders yet.")}
            </p>
            {orders.length > 0 && <p className="mt-1 text-sm text-[#8190a1]">{t("Try another customer, order number, or item.")}</p>}
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#edf1f5] text-[11px] uppercase tracking-[0.08em] text-[#8190a1]">
                  <th className="px-5 py-3 font-extrabold" scope="col">{t("Order")}</th>
                  <th className="px-3 py-3 font-extrabold" scope="col">{t("Customer")}</th>
                  <th className="px-3 py-3 font-extrabold" scope="col">{t("Items")}</th>
                  <th className="px-3 py-3 font-extrabold" scope="col">{t("Fulfillment")}</th>
                  <th className="px-3 py-3 font-extrabold" scope="col">{t("Delivered")}</th>
                  <th className="px-3 py-3 text-right font-extrabold" scope="col">{t("Total")}</th>
                  <th className="px-5 py-3" scope="col"><span className="sr-only">{t("Action")}</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f3f7]">
                {visibleOrders.map((order) => {
                  const date = deliveredDate(order);
                  return (
                    <tr className="cursor-pointer transition hover:bg-[#fafbfd]" key={order.id} onClick={() => setSelectedOrderId(order.id)}>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-2 font-display text-base font-extrabold text-[#092a53]">
                          <span aria-hidden="true" className="grid size-5 place-items-center rounded-full bg-[#35a36b] text-white"><Icon className="size-3" path={icons.delivered} /></span>
                          #{order.id}
                        </span>
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-[#eef3f9] text-[11px] font-extrabold text-[#355777]">{initials(order.customerName)}</span>
                          <div className="min-w-0">
                            <p className="max-w-[11rem] truncate font-bold text-[#102c50]">{order.customerName}</p>
                            <p className="max-w-[11rem] truncate text-[11px] text-[#8190a1]">{order.customerEmail}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <p className="max-w-[13rem] truncate text-xs font-semibold text-[#4f6379]">{order.items.map((item) => `${item.quantity}× ${item.flavorName}`).join(", ")}</p>
                      </td>
                      <td className="px-3 py-3.5">
                        <p className="flex items-center gap-1.5 text-xs font-bold text-[#102c50]">
                          <Icon className="size-3.5 text-[#8190a1]" path={order.fulfillmentType === "pickup" ? icons.store : icons.truck} />
                          {t(order.fulfillmentType === "pickup" ? "Pickup" : "Delivery")}
                        </p>
                        <p className="max-w-[11rem] truncate text-[11px] text-[#8190a1]">{t(order.storeName || "Store not recorded")}</p>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-xs font-semibold text-[#4f6379]">
                        {date ? date.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-right font-extrabold tabular-nums text-[#102c50]">{money(toXaf(order.totalCents, order.currency))}</td>
                      <td className="px-5 py-3.5 text-right">
                        <button aria-label={t("View details")} className="grid size-8 place-items-center rounded-lg text-[#6b7d91] transition hover:bg-[#eef2f7] hover:text-[#092a53]" onClick={(event) => { event.stopPropagation(); setSelectedOrderId(order.id); }} type="button">
                          <Icon path={icons.chevron} />
                        </button>
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
          <section aria-labelledby="delivered-drawer-title" aria-modal="true" className="admin-drawer-panel relative flex h-full w-full max-w-[32rem] flex-col bg-white shadow-[-24px_0_60px_rgba(9,42,83,0.18)]" role="dialog">
            <header className="flex items-start justify-between gap-4 border-b border-[#edf1f5] px-6 py-5">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eaf6ee] px-2.5 py-1 text-[11px] font-bold text-[#246a46] ring-1 ring-[#cfe8d8]">
                  <Icon className="size-3.5" path={icons.delivered} />
                  {t("Delivered")}
                </span>
                <h2 className="mt-2 font-display text-2xl font-extrabold text-[#092a53]" id="delivered-drawer-title">{t("Order #{id}", { id: selectedOrder.id })}</h2>
              </div>
              <button aria-label={t("Close")} className="grid size-9 shrink-0 place-items-center rounded-xl text-[#65748a] transition hover:bg-[#f1f4f8] hover:text-[#092a53]" onClick={() => setSelectedOrderId(null)} type="button">
                <Icon className="size-5" path={icons.close} />
              </button>
            </header>
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6">
              <ol className="relative space-y-4 border-l-2 border-[#e3e9f0] pl-5">
                {[
                  { label: t("Order placed"), date: parseDate(selectedOrder.createdAt) },
                  ...(selectedOrder.scheduledFor ? [{ label: t("Scheduled"), date: new Date(selectedOrder.scheduledFor) }] : []),
                  { label: t("Delivered"), date: deliveredDate(selectedOrder), done: true },
                ].map((step) => (
                  <li className="relative" key={step.label}>
                    <span aria-hidden="true" className={`absolute -left-[27px] top-0.5 grid size-4 place-items-center rounded-full ring-4 ring-white ${step.done ? "bg-[#35a36b]" : "bg-[#c3cfdc]"}`} />
                    <p className="text-sm font-bold text-[#102c50]">{step.label}</p>
                    <p className="text-xs text-[#8190a1]">{step.date && !Number.isNaN(step.date.getTime()) ? step.date.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) : "—"}</p>
                  </li>
                ))}
              </ol>

              <div className="grid gap-3 sm:grid-cols-2">
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
                </div>
                <div className="rounded-2xl bg-[#f7f9fc] p-4 ring-1 ring-[#e8edf3]">
                  <h3 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#8190a1]">{t("Fulfillment destination")}</h3>
                  <p className="mt-2 flex items-center gap-1.5 font-bold text-[#102c50]">
                    <Icon className="size-4 text-[#8190a1]" path={selectedOrder.fulfillmentType === "pickup" ? icons.store : icons.truck} />
                    {t(selectedOrder.fulfillmentType === "pickup" ? "Pickup" : "Delivery")}
                  </p>
                  {(selectedOrder.deliveryResidence || selectedOrder.deliveryCity) && (
                    <p className="mt-1 text-xs leading-5 text-[#65748a]">{selectedOrder.deliveryResidence}{selectedOrder.deliveryResidence ? ", " : ""}{selectedOrder.deliveryCity}</p>
                  )}
                </div>
                <div className="flex items-start gap-3 rounded-2xl bg-[#f7f9fc] p-4 ring-1 ring-[#e8edf3] sm:col-span-2">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-[#092a53] shadow-sm"><Icon path={icons.pin} /></span>
                  <div className="min-w-0">
                    <h3 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#8190a1]">{t("Assigned store")}</h3>
                    <p className="mt-1 text-sm font-bold text-[#092a53]">{t(selectedOrder.storeName || "Store not recorded")}</p>
                    {selectedOrder.storeAddress && <p className="text-xs leading-5 text-[#65748a]">{t(selectedOrder.storeAddress)}</p>}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#8190a1]">{t("Items")}</h3>
                <ul className="mt-3 divide-y divide-[#f0f3f7] rounded-2xl ring-1 ring-[#e8edf3]">
                  {selectedOrder.items.map((item) => (
                    <li className="flex items-center justify-between gap-3 px-4 py-3 text-sm" key={`${selectedOrder.id}-${item.flavorId}-${item.flavorName}`}>
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="grid h-7 min-w-7 shrink-0 place-items-center rounded-lg bg-[#f1f4f8] px-1.5 text-xs font-extrabold text-[#4f6379]">{item.quantity}×</span>
                        <span className="truncate font-semibold text-[#102c50]">{item.flavorName}</span>
                      </span>
                      <span className="shrink-0 font-bold tabular-nums text-[#4f6379]">{money(toXaf(item.lineTotalCents, selectedOrder.currency))}</span>
                    </li>
                  ))}
                </ul>
                <dl className="mt-3 space-y-2 px-1 text-sm">
                  {selectedOrder.discountCents > 0 && (
                    <div className="flex justify-between gap-3 text-[#2c7a4f]">
                      <dt className="font-semibold">{t("Discount")}</dt>
                      <dd className="font-bold tabular-nums">−{money(toXaf(selectedOrder.discountCents, selectedOrder.currency))}</dd>
                    </div>
                  )}
                  {selectedOrder.deliveryFee > 0 && (
                    <div className="flex justify-between gap-3 text-[#65748a]">
                      <dt>{t("Delivery fee")}</dt>
                      <dd className="font-bold tabular-nums">{money(toXaf(selectedOrder.deliveryFee, selectedOrder.currency))}</dd>
                    </div>
                  )}
                  <div className="flex items-end justify-between gap-3 border-t border-dashed border-[#dde4ec] pt-3">
                    <dt className="font-display text-base font-extrabold text-[#092a53]">{t("Total")}</dt>
                    <dd className="font-display text-2xl font-extrabold tabular-nums text-[#092a53]">{money(toXaf(selectedOrder.totalCents, selectedOrder.currency))}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>
        </div>
      )}

      {isConfirmingClear && (
        <div className="fixed inset-0 z-50 grid place-items-center px-5" role="presentation">
          <button aria-label={t("Cancel")} className="admin-drawer-backdrop absolute inset-0 bg-[#0b1e36]/45 backdrop-blur-[2px]" onClick={() => setIsConfirmingClear(false)} tabIndex={-1} type="button" />
          <section aria-labelledby="clear-delivered-title" aria-modal="true" className="admin-modal-panel relative w-full max-w-md rounded-[22px] bg-white p-6 shadow-[0_30px_80px_rgba(9,42,83,0.3)]" role="dialog">
            <span className="grid size-12 place-items-center rounded-2xl bg-red-50 text-red-600"><Icon className="size-6" path={icons.trash} /></span>
            <h2 className="mt-4 font-display text-xl font-extrabold text-[#092a53]" id="clear-delivered-title">{t("Clear all delivered orders")}</h2>
            <p className="mt-2 text-sm leading-6 text-[#65748a]">
              {t("Clear all {count} delivered orders? This permanently deletes their order, payment, loyalty, and review history.", { count: deliveredCount })}
            </p>
            <p className="mt-3 rounded-xl bg-[#fff6e5] px-3 py-2.5 text-xs font-semibold text-[#8a5a00]">{t("Tip: export a CSV first if you need a record.")}</p>
            {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700" role="alert">{error}</p>}
            <div className="mt-6 flex justify-end gap-2.5">
              <button className="min-h-10 rounded-xl px-4 text-sm font-bold text-[#4f6379] transition hover:bg-[#eef2f6]" onClick={() => setIsConfirmingClear(false)} type="button">{t("Cancel")}</button>
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-wait disabled:opacity-60"
                disabled={isClearing}
                onClick={clearDeliveredOrders}
                type="button"
              >
                <Icon path={icons.trash} />
                {isClearing ? t("Clearing…") : t("Clear all delivered orders")}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
