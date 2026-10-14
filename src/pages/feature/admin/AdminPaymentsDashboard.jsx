import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../../api/api";
import { formatCartMoney, USD_TO_XAF } from "../../../cartPricing";
import { useLanguage } from "../../../language/useLanguage";
import { useAdminAuth } from "./useAdminAuth";

const inputClassName =
  "w-full rounded-xl border border-[#dde4ec] bg-[#f8fafc] px-3.5 py-2.5 text-sm font-medium text-[#102c50] transition placeholder:text-[#9aa5b3] hover:border-[#c9d4e0] focus:border-[#bd9c00] focus:bg-white focus:ring-4 focus:ring-[#ffdc32]/25 outline-none!";

const icons = {
  card: "M3 6h18v12H3V6Zm0 4h18M7 15h4",
  refresh: "M4 12a8 8 0 0 1 13.7-5.7L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.7L4 15.5M4 20v-4.5h4.5",
  search: "m20 20-4.2-4.2M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z",
  download: "M12 4v12m0 0-5-5m5 5 5-5M5 20h14",
  check: "m5 12.5 4.5 4.5L19 7.5",
  clock: "M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  x: "M15 9l-6 6m0-6 6 6m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  money: "M3 7h18v10H3V7Zm9 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM6 10v4m12-4v4",
  percent: "M19 5 5 19M7.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm9 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
  alert: "M12 8v5m0 3.5v.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  copy: "M9 9h10v10H9V9Zm-4 6V5h10",
  close: "M6 6l12 12M18 6 6 18",
  chevron: "m9 6 6 6-6 6",
  shield: "M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Zm-3 9 2 2 4-4",
  mail: "M4 6h16v12H4V6Zm0 0 8 7 8-7",
  phone: "M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm3 15h2",
};

function Icon({ path, className = "size-4" }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d={path} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function toXaf(amount, currency) {
  return String(currency || "xaf").toLowerCase() === "usd" ? Math.round((Number(amount || 0) / 100) * USD_TO_XAF) : Number(amount || 0);
}

function parseDate(value) {
  if (!value) return null;
  const normalizedValue = String(value).replace(" ", "T");
  const date = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(normalizedValue) ? normalizedValue : `${normalizedValue}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

const statusMeta = {
  paid: { label: "Paid", badge: "bg-[#eaf6ee] text-[#246a46] ring-[#cfe8d8]", dot: "bg-[#35a36b]" },
  pending: { label: "Pending", badge: "bg-[#fff6e5] text-[#9a6200] ring-[#f6dfb0]", dot: "bg-[#e0a100]" },
  failed: { label: "Failed", badge: "bg-[#fdeeee] text-[#a53f37] ring-[#f3d1ce]", dot: "bg-[#d2544b]" },
};

const providerMeta = {
  stripe: { label: "Stripe", tone: "bg-[#635bff] text-white", bar: "bg-[#635bff]", icon: icons.card },
  campay: { label: "CamPay", tone: "bg-[#ffcc00] text-[#1a1a1a]", bar: "bg-[#ffcc00]", icon: icons.phone },
};

function providerInfo(provider) {
  const key = String(provider || "").toLowerCase();
  return providerMeta[key] || { label: provider || "—", tone: "bg-[#e6ebf1] text-[#4f6379]", bar: "bg-[#94a3b4]", icon: icons.card };
}

function PaymentStatus({ status, t }) {
  const meta = statusMeta[status] || { label: status, badge: "bg-[#f1f4f8] text-[#5b6b7d] ring-[#e1e7ee]", dot: "bg-[#94a3b4]" };
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${meta.badge}`}>
      <span aria-hidden="true" className={`size-1.5 rounded-full ${meta.dot}`} />
      {t(meta.label)}
    </span>
  );
}

function ProviderMark({ provider, size = "size-8" }) {
  const info = providerInfo(provider);
  return (
    <span aria-hidden="true" className={`${size} grid shrink-0 place-items-center rounded-lg ${info.tone}`}>
      <Icon className="size-4" path={info.icon} />
    </span>
  );
}

export function AdminPaymentsDashboard() {
  const { sessionToken } = useAdminAuth();
  const { t, language } = useLanguage();
  const locale = language === "fr" ? "fr-CM" : "en-CM";
  const money = (amount) => formatCartMoney(amount, "xaf", language);
  const [payments, setPayments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [rangeFilter, setRangeFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const refresh = useCallback(async () => {
    setError("");
    setIsRefreshing(true);
    try {
      const result = await apiRequest("/admin/payments", { token: sessionToken });
      setPayments(result.payments);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selectedPayment = payments.find((payment) => payment.id === selectedId) || null;

  useEffect(() => {
    if (!selectedPayment) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(event) {
      if (event.key === "Escape") setSelectedId(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedPayment]);

  const stats = useMemo(() => {
    const result = { paid: 0, pending: 0, failed: 0, paidVolume: 0, pendingVolume: 0, providers: {} };
    payments.forEach((payment) => {
      const amount = toXaf(payment.amountCents, payment.currency);
      result[payment.status] = (result[payment.status] || 0) + 1;
      if (payment.status === "paid") {
        result.paidVolume += amount;
        const key = String(payment.provider || "other").toLowerCase();
        result.providers[key] = (result.providers[key] || 0) + amount;
      }
      if (payment.status === "pending") result.pendingVolume += amount;
    });
    return result;
  }, [payments]);
  const settled = stats.paid + stats.failed;
  const successRate = settled ? Math.round((stats.paid / settled) * 100) : 0;
  const providers = Object.entries(stats.providers).sort((a, b) => b[1] - a[1]);
  const providerOptions = [...new Set(payments.map((payment) => String(payment.provider || "").toLowerCase()).filter(Boolean))];

  const visiblePayments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const now = Date.now();
    const rangeMs = { "7d": 7 * 86400000, "30d": 30 * 86400000 }[rangeFilter];
    const todayString = new Date().toDateString();
    return payments.filter((payment) => {
      const date = parseDate(payment.createdAt);
      const matchesFilter = activeFilter === "all" || payment.status === activeFilter;
      const matchesProvider = providerFilter === "all" || String(payment.provider || "").toLowerCase() === providerFilter;
      const matchesRange = rangeFilter === "all"
        || (rangeFilter === "today" && date && date.toDateString() === todayString)
        || (rangeMs && date && now - date.getTime() <= rangeMs);
      const searchableDetails = [payment.orderId, payment.customerName, payment.customerEmail, payment.provider, payment.transactionId, payment.id]
        .join(" ")
        .toLowerCase();
      return matchesFilter && matchesProvider && matchesRange && (!query || searchableDetails.includes(query));
    });
  }, [activeFilter, payments, providerFilter, rangeFilter, searchQuery]);
  const visibleVolume = visiblePayments
    .filter((payment) => payment.status === "paid")
    .reduce((sum, payment) => sum + toXaf(payment.amountCents, payment.currency), 0);
  const hasActiveFilters = Boolean(searchQuery.trim() || activeFilter !== "all" || providerFilter !== "all" || rangeFilter !== "all");

  async function copyValue(id, value) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1800);
    } catch {
      setCopiedId(null);
    }
  }

  function exportCsv() {
    const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [
      ["Payment", "Order", "Date", "Customer", "Email", "Provider", "Transaction", "Status", "Amount (FCFA)"],
      ...visiblePayments.map((payment) => [
        payment.id,
        payment.orderId,
        parseDate(payment.createdAt)?.toISOString() || "",
        payment.customerName,
        payment.customerEmail,
        payment.provider,
        payment.transactionId,
        payment.status,
        toXaf(payment.amountCents, payment.currency),
      ]),
    ];
    const blob = new Blob([`﻿${rows.map((row) => row.map(escape).join(",")).join("\r\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const metrics = [
    { label: "Successful payment volume", value: money(stats.paidVolume), hint: t("{count} paid transactions", { count: stats.paid }), icon: icons.money, accent: "bg-[#e5f4ea] text-[#2c7a4f]", filter: "paid" },
    { label: "Success rate", value: settled ? `${successRate}%` : "—", hint: t("Paid vs. failed payments"), icon: icons.percent, accent: "bg-[#e9f1fa] text-[#315982]", filter: null },
    { label: "Pending", value: money(stats.pendingVolume), hint: t("{count} awaiting confirmation", { count: stats.pending }), icon: icons.clock, accent: "bg-[#fff1dc] text-[#a86a00]", filter: "pending" },
    { label: "Failed", value: String(stats.failed), hint: t("Declined or cancelled payments"), icon: icons.x, accent: "bg-[#fdecea] text-[#b2433a]", filter: "failed" },
  ];

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-col gap-5 border-b border-[#edf1f5] pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#092a53] text-[#ffdc32]">
            <Icon className="size-7" path={icons.card} />
          </span>
          <div className="min-w-0">
            <nav aria-label={t("Breadcrumb")} className="text-[11px] font-bold text-[#8190a1]">
              {t("Sales")} <span aria-hidden="true" className="mx-1">/</span>
              <span className="text-[#a48700]">{t("Payments")}</span>
            </nav>
            <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-[#092a53] sm:text-[1.9rem]">{t("Payments")}</h1>
            <p className="mt-0.5 text-sm text-[#65748a]">{t("Payment records confirmed by Stripe and CamPay for customer orders.")}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eaf6ee] px-3 py-1.5 text-[11px] font-bold text-[#246a46]">
            <Icon className="size-3.5" path={icons.shield} />
            {t("Payments securely processed by payment providers")}
          </span>
          <button
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#dce5ef] bg-white px-4 text-sm font-bold text-[#355777] transition hover:border-[#bacbdc] hover:bg-[#f6f9fc] hover:text-[#092a53] disabled:opacity-50"
            disabled={!visiblePayments.length}
            onClick={exportCsv}
            type="button"
          >
            <Icon path={icons.download} />
            {t("Export CSV")}
          </button>
          <button
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#dce5ef] bg-white px-4 text-sm font-bold text-[#355777] transition hover:border-[#bacbdc] hover:bg-[#f6f9fc] hover:text-[#092a53] disabled:cursor-wait disabled:opacity-60"
            disabled={isRefreshing}
            onClick={refresh}
            type="button"
          >
            <Icon className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} path={icons.refresh} />
            {t("Refresh")}
          </button>
        </div>
      </header>

      {error && (
        <p className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100" role="alert">
          <Icon className="mt-0.5 size-4 shrink-0" path={icons.alert} />
          {error}
        </p>
      )}

      <section aria-label={t("Payment overview")} className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map((metric) => {
          const isActive = metric.filter && activeFilter === metric.filter;
          const content = (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className={`grid size-9 place-items-center rounded-xl ${metric.accent}`}><Icon path={metric.icon} /></span>
                {metric.filter && (
                  <span className="text-[10px] font-bold text-[#a3b0bf] opacity-0 transition group-hover:opacity-100">{t(isActive ? "Clear filter" : "Filter")}</span>
                )}
              </div>
              <p className="mt-4 truncate font-display text-[1.6rem] font-extrabold leading-none tracking-tight text-[#102c50]">{metric.value}</p>
              <p className="mt-1.5 text-xs font-semibold text-[#65748a]">{t(metric.label)}</p>
              <p className="mt-0.5 truncate text-[11px] text-[#a3b0bf]">{metric.hint}</p>
            </>
          );
          return metric.filter ? (
            <button
              aria-pressed={isActive}
              className={`group rounded-2xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(18,44,80,0.07)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] sm:p-5 ${isActive ? "border-[#092a53] shadow-[0_0_0_1px_#092a53]" : "border-[#e5ebf3]"}`}
              key={metric.label}
              onClick={() => setActiveFilter(isActive ? "all" : metric.filter)}
              type="button"
            >
              {content}
            </button>
          ) : (
            <article className="rounded-2xl border border-[#e5ebf3] bg-white p-4 sm:p-5" key={metric.label}>
              {content}
              {settled > 0 && (
                <div aria-hidden="true" className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-[#fdecea]">
                  <span className="bg-[#35a36b]" style={{ width: `${successRate}%` }} />
                </div>
              )}
            </article>
          );
        })}
      </section>

      {providers.length > 0 && (
        <section aria-label={t("Volume by provider")} className="rounded-2xl bg-[#f7f9fc] p-4 ring-1 ring-[#e8edf3]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#8190a1]">{t("Volume by provider")}</p>
            <p className="text-xs font-bold text-[#4f6379]">{money(stats.paidVolume)}</p>
          </div>
          <div aria-hidden="true" className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-[#e6ebf1]">
            {providers.map(([key, amount]) => (
              <span className={providerInfo(key).bar} key={key} style={{ width: `${(amount / Math.max(1, stats.paidVolume)) * 100}%` }} />
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
            {providers.map(([key, amount]) => (
              <li className="flex items-center gap-2 text-xs" key={key}>
                <span aria-hidden="true" className={`size-2.5 rounded-full ${providerInfo(key).bar}`} />
                <span className="font-bold text-[#102c50]">{providerInfo(key).label}</span>
                <span className="text-[#8190a1]">{money(amount)} · {Math.round((amount / Math.max(1, stats.paidVolume)) * 100)}%</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="payments-table-title" className="min-w-0 rounded-[20px] border border-[#e5ebf3] bg-white">
        <div className="flex flex-col gap-4 border-b border-[#edf1f5] p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-extrabold text-[#092a53]" id="payments-table-title">{t("Transaction activity")}</h2>
              <p aria-live="polite" className="mt-0.5 text-xs text-[#65748a]">
                {t("Showing {visible} of {total} payments", { visible: visiblePayments.length, total: payments.length })} · {t("{amount} paid", { amount: money(visibleVolume) })}
              </p>
            </div>
            {hasActiveFilters && (
              <button
                className="text-xs font-bold text-[#355777] underline decoration-[#ffdc32] decoration-2 underline-offset-4 hover:text-[#092a53]"
                onClick={() => { setSearchQuery(""); setActiveFilter("all"); setProviderFilter("all"); setRangeFilter("all"); }}
                type="button"
              >
                {t("Clear filters")}
              </button>
            )}
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
            <label className="relative block">
              <span className="sr-only">{t("Search payments")}</span>
              <Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#8190a1]" path={icons.search} />
              <input className={`${inputClassName} pl-10`} onChange={(event) => setSearchQuery(event.target.value)} placeholder={t("Order, name, email, provider, or transaction ID")} type="search" value={searchQuery} />
            </label>
            <label className="block">
              <span className="sr-only">{t("Provider")}</span>
              <select className={`${inputClassName} lg:w-44`} onChange={(event) => setProviderFilter(event.target.value)} value={providerFilter}>
                <option value="all">{t("All providers")}</option>
                {providerOptions.map((provider) => <option key={provider} value={provider}>{providerInfo(provider).label}</option>)}
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
          <div aria-label={t("Filter payments by status")} className="flex w-fit max-w-full overflow-x-auto rounded-xl bg-[#f1f4f8] p-1" role="group">
            {[
              { id: "all", label: "All payments", count: payments.length },
              { id: "paid", label: "Paid", count: stats.paid },
              { id: "pending", label: "Pending", count: stats.pending },
              { id: "failed", label: "Failed", count: stats.failed },
            ].map((filter) => (
              <button
                aria-pressed={activeFilter === filter.id}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition ${activeFilter === filter.id ? "bg-white text-[#092a53] shadow-sm" : "text-[#65748a] hover:text-[#092a53]"}`}
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                type="button"
              >
                {t(filter.label)}
                <span className="rounded-full bg-[#e6ebf1] px-1.5 text-[10px] text-[#65748a]">{filter.count}</span>
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3 p-4 sm:p-5" role="status">
            <span className="sr-only">{t("Loading payments…")}</span>
            {[0, 1, 2, 3].map((row) => (
              <div aria-hidden="true" className="flex animate-pulse items-center gap-4" key={row}>
                <span className="size-8 rounded-lg bg-[#eef2f6]" />
                <span className="h-3 flex-1 rounded bg-[#eef2f6]" />
                <span className="h-3 w-24 rounded bg-[#eef2f6]" />
              </div>
            ))}
          </div>
        ) : visiblePayments.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#f1f4f8] text-[#8190a1]"><Icon className="size-5" path={payments.length ? icons.search : icons.card} /></span>
            <p className="mt-4 font-display text-lg font-extrabold text-[#092a53]">{payments.length ? t("No matching payments") : t("No payment records yet.")}</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-[#8190a1]">
              {payments.length ? t("Try another search or payment status.") : t("Stripe payment records will appear here as customers check out.")}
            </p>
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#edf1f5] text-[11px] uppercase tracking-[0.08em] text-[#8190a1]">
                  <th className="px-5 py-3 font-extrabold" scope="col">{t("Transaction")}</th>
                  <th className="px-3 py-3 font-extrabold" scope="col">{t("Order")}</th>
                  <th className="px-3 py-3 font-extrabold" scope="col">{t("Customer")}</th>
                  <th className="px-3 py-3 font-extrabold" scope="col">{t("Date")}</th>
                  <th className="px-3 py-3 text-right font-extrabold" scope="col">{t("Amount")}</th>
                  <th className="px-3 py-3 font-extrabold" scope="col">{t("Status")}</th>
                  <th className="px-5 py-3" scope="col"><span className="sr-only">{t("Action")}</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f3f7]">
                {visiblePayments.map((payment) => {
                  const date = parseDate(payment.createdAt);
                  return (
                    <tr className="cursor-pointer transition hover:bg-[#fafbfd]" key={payment.id} onClick={() => setSelectedId(payment.id)}>
                      <td className="px-5 py-3.5">
                        <div className="flex min-w-0 items-center gap-3">
                          <ProviderMark provider={payment.provider} />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#102c50]">{providerInfo(payment.provider).label}</p>
                            {payment.transactionId ? (
                              <button
                                className="flex max-w-[11rem] items-center gap-1 font-mono text-[11px] text-[#8190a1] hover:text-[#092a53]"
                                onClick={(event) => { event.stopPropagation(); copyValue(payment.id, payment.transactionId); }}
                                title={payment.transactionId}
                                type="button"
                              >
                                <span className="truncate">{payment.transactionId}</span>
                                <Icon className="size-3 shrink-0" path={copiedId === payment.id ? icons.check : icons.copy} />
                              </button>
                            ) : (
                              <p className="text-[11px] text-[#a3b0bf]">{t("Payment")} #{payment.id}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 font-display font-extrabold text-[#092a53]">#{payment.orderId}</td>
                      <td className="px-3 py-3.5">
                        <p className="max-w-[12rem] truncate font-bold text-[#102c50]">{payment.customerName}</p>
                        <p className="max-w-[12rem] truncate text-[11px] text-[#8190a1]">{payment.customerEmail}</p>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-xs font-semibold text-[#4f6379]">
                        {date ? date.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-right font-extrabold tabular-nums text-[#102c50]">{money(toXaf(payment.amountCents, payment.currency))}</td>
                      <td className="px-3 py-3.5"><PaymentStatus status={payment.status} t={t} /></td>
                      <td className="px-5 py-3.5 text-right">
                        <button aria-label={t("View details")} className="grid size-8 place-items-center rounded-lg text-[#6b7d91] transition hover:bg-[#eef2f7] hover:text-[#092a53]" onClick={(event) => { event.stopPropagation(); setSelectedId(payment.id); }} type="button">
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

      {selectedPayment && (
        <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
          <button aria-label={t("Close")} className="admin-drawer-backdrop absolute inset-0 bg-[#0b1e36]/45 backdrop-blur-[2px]" onClick={() => setSelectedId(null)} tabIndex={-1} type="button" />
          <section aria-labelledby="payment-drawer-title" aria-modal="true" className="admin-drawer-panel relative flex h-full w-full max-w-[28rem] flex-col bg-white shadow-[-24px_0_60px_rgba(9,42,83,0.18)]" role="dialog">
            <header className="flex items-start justify-between gap-4 border-b border-[#edf1f5] px-6 py-5">
              <div className="flex items-center gap-3">
                <ProviderMark provider={selectedPayment.provider} size="size-11" />
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#a48700]">{providerInfo(selectedPayment.provider).label}</p>
                  <h2 className="font-display text-xl font-extrabold text-[#092a53]" id="payment-drawer-title">{t("Order #{id}", { id: selectedPayment.orderId })}</h2>
                </div>
              </div>
              <button aria-label={t("Close")} className="grid size-9 shrink-0 place-items-center rounded-xl text-[#65748a] transition hover:bg-[#f1f4f8] hover:text-[#092a53]" onClick={() => setSelectedId(null)} type="button">
                <Icon className="size-5" path={icons.close} />
              </button>
            </header>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6">
              <div className="rounded-2xl bg-[#092a53] p-5 text-white">
                <p className="text-[11px] font-bold text-white/60">{t("Amount")}</p>
                <p className="mt-1 font-display text-3xl font-extrabold tabular-nums">{money(toXaf(selectedPayment.amountCents, selectedPayment.currency))}</p>
                <div className="mt-3"><PaymentStatus status={selectedPayment.status} t={t} /></div>
              </div>
              <dl className="divide-y divide-[#f0f3f7] rounded-2xl ring-1 ring-[#e8edf3]">
                {[
                  { label: t("Customer"), value: selectedPayment.customerName },
                  { label: t("Email"), value: selectedPayment.customerEmail, href: `mailto:${selectedPayment.customerEmail}` },
                  { label: t("Date"), value: parseDate(selectedPayment.createdAt)?.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) || "—" },
                  { label: t("Provider"), value: providerInfo(selectedPayment.provider).label },
                  { label: t("Currency"), value: String(selectedPayment.currency || "xaf").toUpperCase() },
                ].map((row) => (
                  <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm" key={row.label}>
                    <dt className="text-[#8190a1]">{row.label}</dt>
                    <dd className="min-w-0 truncate text-right font-bold text-[#102c50]">
                      {row.href ? <a className="hover:underline" href={row.href}>{row.value}</a> : row.value}
                    </dd>
                  </div>
                ))}
              </dl>
              {selectedPayment.transactionId && (
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#8190a1]">{t("Transaction")}</p>
                  <div className="mt-2 flex items-center gap-2 rounded-xl bg-[#f7f9fc] p-3 ring-1 ring-[#e8edf3]">
                    <code className="min-w-0 flex-1 break-all font-mono text-xs text-[#355777]">{selectedPayment.transactionId}</code>
                    <button
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-[#355777] ring-1 ring-[#e3e9f0] transition hover:text-[#092a53]"
                      onClick={() => copyValue(`drawer-${selectedPayment.id}`, selectedPayment.transactionId)}
                      type="button"
                    >
                      <Icon className="size-3.5" path={copiedId === `drawer-${selectedPayment.id}` ? icons.check : icons.copy} />
                      {t(copiedId === `drawer-${selectedPayment.id}` ? "Copied" : "Copy")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
