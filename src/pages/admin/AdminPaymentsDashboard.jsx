import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../api/api";
import { formatCartMoney, USD_TO_XAF } from "../../lib/cartPricing";
import { useLanguage } from "../../language/useLanguage";
import { useAdminAuth } from "./useAdminAuth";

const controlClassName =
  "h-9 w-full rounded-lg border border-[#d1d5db] bg-white px-3 text-sm text-[#111827] transition placeholder:text-[#6b7280] hover:border-[#c2c8d0] focus:border-[#092a53] focus:outline-2 focus:outline-offset-1 focus:outline-[#092a53]/40";

const icons = {
  card: "M3 6h18v12H3V6Zm0 4h18M7 15h4",
  refresh:
    "M4 12a8 8 0 0 1 13.7-5.7L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.7L4 15.5M4 20v-4.5h4.5",
  search: "m20 20-4.2-4.2M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z",
  download: "M12 4v12m0 0-5-5m5 5 5-5M5 20h14",
  check: "m5 12.5 4.5 4.5L19 7.5",
  clock: "M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  x: "M15 9l-6 6m0-6 6 6m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  money:
    "M3 7h18v10H3V7Zm9 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM6 10v4m12-4v4",
  percent:
    "M19 5 5 19M7.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm9 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
  alert:
    "M12 8v5m0 3.5v.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  copy: "M9 9h10v10H9V9Zm-4 6V5h10",
  close: "M6 6l12 12M18 6 6 18",
  chevron: "m9 6 6 6-6 6",
  shield: "M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Zm-3 9 2 2 4-4",
  mail: "M4 6h16v12H4V6Zm0 0 8 7 8-7",
  phone:
    "M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm3 15h2",
};

function Icon({ path, className = "size-4" }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d={path}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function toXaf(amount, currency) {
  return String(currency || "xaf").toLowerCase() === "usd"
    ? Math.round((Number(amount || 0) / 100) * USD_TO_XAF)
    : Number(amount || 0);
}

function parseDate(value) {
  if (!value) return null;
  const normalizedValue = String(value).replace(" ", "T");
  const date = new Date(
    /[zZ]|[+-]\d{2}:?\d{2}$/.test(normalizedValue)
      ? normalizedValue
      : `${normalizedValue}Z`,
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

const statusMeta = {
  paid: { label: "Paid", pill: "bg-[#dcfae5] text-[#04250e]" },
  pending: { label: "Pending", pill: "bg-[#fffbeb] text-[#92400e]" },
  failed: { label: "Failed", pill: "bg-[#ffedea] text-[#831c1e]" },
};

const providerMeta = {
  stripe: { label: "Stripe", bar: "bg-[#635bff]", icon: icons.card },
  campay: { label: "CamPay", bar: "bg-[#092a53]", icon: icons.phone },
};

function providerInfo(provider) {
  const key = String(provider || "").toLowerCase();
  return (
    providerMeta[key] || {
      label: provider || "—",
      bar: "bg-[#9aa2ad]",
      icon: icons.card,
    }
  );
}

function PaymentStatus({ status, t }) {
  const meta = statusMeta[status] || {
    label: status,
    pill: "bg-[#f3f4f6] text-[#5f6368]",
  };
  return (
    <span
      className={`inline-flex flex-none items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.pill}`}
    >
      {t(meta.label)}
    </span>
  );
}

function ProviderMark({ provider, size = "size-8" }) {
  const info = providerInfo(provider);
  return (
    <span
      aria-hidden="true"
      className={`${size} grid shrink-0 place-items-center rounded-md border border-[#e8e8e8] bg-[#f9fafb] text-[#5f6368]`}
    >
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
      const result = await apiRequest("/admin/payments", {
        token: sessionToken,
      });
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

  const selectedPayment =
    payments.find((payment) => payment.id === selectedId) || null;

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
    const result = {
      paid: 0,
      pending: 0,
      failed: 0,
      paidVolume: 0,
      pendingVolume: 0,
      providers: {},
    };
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
  const providerOptions = [
    ...new Set(
      payments
        .map((payment) => String(payment.provider || "").toLowerCase())
        .filter(Boolean),
    ),
  ];

  const visiblePayments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const now = Date.now();
    const rangeMs = { "7d": 7 * 86400000, "30d": 30 * 86400000 }[rangeFilter];
    const todayString = new Date().toDateString();
    return payments.filter((payment) => {
      const date = parseDate(payment.createdAt);
      const matchesFilter =
        activeFilter === "all" || payment.status === activeFilter;
      const matchesProvider =
        providerFilter === "all" ||
        String(payment.provider || "").toLowerCase() === providerFilter;
      const matchesRange =
        rangeFilter === "all" ||
        (rangeFilter === "today" &&
          date &&
          date.toDateString() === todayString) ||
        (rangeMs && date && now - date.getTime() <= rangeMs);
      const searchableDetails = [
        payment.orderId,
        payment.customerName,
        payment.customerEmail,
        payment.provider,
        payment.transactionId,
        payment.id,
      ]
        .join(" ")
        .toLowerCase();
      return (
        matchesFilter &&
        matchesProvider &&
        matchesRange &&
        (!query || searchableDetails.includes(query))
      );
    });
  }, [activeFilter, payments, providerFilter, rangeFilter, searchQuery]);
  const visibleVolume = visiblePayments
    .filter((payment) => payment.status === "paid")
    .reduce(
      (sum, payment) => sum + toXaf(payment.amountCents, payment.currency),
      0,
    );
  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
    activeFilter !== "all" ||
    providerFilter !== "all" ||
    rangeFilter !== "all",
  );

  async function copyValue(id, value) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      window.setTimeout(
        () => setCopiedId((current) => (current === id ? null : current)),
        1800,
      );
    } catch {
      setCopiedId(null);
    }
  }

  function exportCsv() {
    const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [
      [
        "Payment",
        "Order",
        "Date",
        "Customer",
        "Email",
        "Provider",
        "Transaction",
        "Status",
        "Amount (FCFA)",
      ],
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
    const blob = new Blob(
      [`${rows.map((row) => row.map(escape).join(",")).join("\r\n")}`],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const metrics = [
    {
      label: "Successful payment volume",
      value: money(stats.paidVolume),
      hint: t("{count} paid transactions", { count: stats.paid }),
      filter: "paid",
    },
    {
      label: "Success rate",
      value: settled ? `${successRate}%` : "—",
      hint: t("{paid} of {total} settled payments", {
        paid: stats.paid,
        total: settled,
      }),
      filter: null,
    },
    {
      label: "Pending",
      value: money(stats.pendingVolume),
      hint: t("{count} awaiting confirmation", { count: stats.pending }),
      filter: "pending",
    },
    {
      label: "Failed",
      value: String(stats.failed),
      hint: t("Declined or cancelled payments"),
      filter: "failed",
    },
  ];

  return (
    <div className="min-w-0 space-y-4">
      {error && (
        <p
          className="flex items-start gap-2 rounded-lg bg-[#ffedea] px-4 py-3 text-sm font-medium text-[#831c1e]"
          role="alert"
        >
          <Icon className="mt-0.5 size-4 shrink-0" path={icons.alert} />
          {error}
        </p>
      )}

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <nav aria-label={t("Breadcrumb")} className="text-xs text-[#6b6b6b]">
            {t("Sales")}{" "}
            <span aria-hidden="true" className="mx-1">
              /
            </span>
            {t("Payments")}
          </nav>
          <h1 className="mt-1 text-2xl font-bold tracking-[-0.01em] text-[#111827]">
            {t("Payments")}
          </h1>
          <p className="mt-1 text-sm text-[#6b6b6b]">
            {t(
              "Payment records confirmed by Stripe and CamPay for customer orders.",
            )}
          </p>
        </div>
        <div className="flex flex-none items-center gap-2">
          <button
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#d1d5db] bg-white px-3 text-sm font-medium text-[#111827] transition hover:border-[#9aa2ad] disabled:opacity-50"
            disabled={!visiblePayments.length}
            onClick={exportCsv}
            type="button"
          >
            <Icon path={icons.download} />
            {t("Export CSV")}
          </button>
          <button
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#d1d5db] bg-white px-3 text-sm font-medium text-[#111827] transition hover:border-[#9aa2ad] disabled:cursor-wait disabled:opacity-60"
            disabled={isRefreshing}
            onClick={refresh}
            type="button"
          >
            <Icon
              className={`size-4 ${isRefreshing ? "animate-spin" : ""}`}
              path={icons.refresh}
            />
            {t("Refresh")}
          </button>
        </div>
      </header>

      <section
        aria-label={t("Payment overview")}
        className="admin-stats grid grid-cols-2 overflow-hidden rounded-lg border border-[#e8e8e8] bg-white xl:grid-cols-4 xl:divide-x xl:divide-[#e8e8e8]"
      >
        {metrics.map((metric, index) => {
          const isActive = metric.filter && activeFilter === metric.filter;
          const body = (
            <>
              <p className="text-xs text-[#6b6b6b]">{t(metric.label)}</p>
              <p className="num mt-1.5 truncate text-2xl font-semibold leading-none tracking-[-0.01em] text-[#111827]">
                {metric.value}
              </p>
              <p className="mt-1.5 truncate text-xs text-[#6b6b6b]">
                {metric.hint}
              </p>
              {index === 1 && settled > 0 && (
                <div
                  aria-hidden="true"
                  className="mt-2 h-1 overflow-hidden rounded-full bg-[#f3f4f6]"
                >
                  <span
                    className="block h-full rounded-full bg-[#247b50]"
                    style={{ width: `${successRate}%` }}
                  />
                </div>
              )}
            </>
          );
          const shared = `px-4 py-4 text-left transition sm:px-5 ${isActive ? "bg-[#eef1f5]" : "bg-white"}`;
          return metric.filter ? (
            <button
              aria-pressed={isActive}
              className={`group ${shared} ${index % 2 === 0 ? "border-r border-[#e8e8e8] xl:border-r-0" : ""} ${index < 2 ? "border-b border-[#e8e8e8] xl:border-b-0" : ""} hover:bg-[#f6f7f9] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#092a53]`}
              key={metric.label}
              onClick={() => setActiveFilter(isActive ? "all" : metric.filter)}
              type="button"
            >
              {body}
            </button>
          ) : (
            <div className={shared} key={metric.label}>
              {body}
            </div>
          );
        })}
      </section>

      {providers.length > 0 && (
        <section
          aria-label={t("Volume by provider")}
          className="rounded-lg border border-[#e8e8e8] bg-white p-4 sm:p-5"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold text-[#111827]">
              {t("Volume by provider")}
            </h2>
            <p className="num text-sm text-[#6b6b6b]">
              {money(stats.paidVolume)} {t("paid")}
            </p>
          </div>
          <ul className="mt-3 space-y-2.5">
            {providers.map(([key, amount]) => {
              const share = (amount / Math.max(1, stats.paidVolume)) * 100;
              return (
                <li
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1"
                  key={key}
                >
                  <div className="flex min-w-0 items-baseline gap-2">
                    <span className="shrink-0 text-sm font-medium text-[#111827]">
                      {providerInfo(key).label}
                    </span>
                    <span
                      aria-hidden="true"
                      className="h-1.5 min-w-2 flex-none rounded-full bg-[#eef1f5]"
                    >
                      <span
                        className={`block h-full rounded-full ${providerInfo(key).bar}`}
                        style={{ width: `${Math.max(share, 1)}%` }}
                      />
                    </span>
                  </div>
                  <p className="num whitespace-nowrap text-sm text-[#6b6b6b]">
                    <span className="font-semibold text-[#111827]">
                      {money(amount)}
                    </span>{" "}
                    · {Math.round(share)}%
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section
        aria-labelledby="payments-table-title"
        className="min-w-0 overflow-hidden rounded-lg border border-[#e8e8e8] bg-white"
      >
        <div className="flex flex-col gap-3 px-4 pb-3 pt-4 sm:px-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2
                className="text-base font-semibold text-[#111827]"
                id="payments-table-title"
              >
                {t("Transaction activity")}
              </h2>
              <p
                aria-live="polite"
                className="num mt-0.5 text-xs text-[#6b6b6b]"
              >
                {t("Showing {visible} of {total} payments", {
                  visible: visiblePayments.length,
                  total: payments.length,
                })}{" "}
                · {t("{amount} paid", { amount: money(visibleVolume) })}
              </p>
            </div>
            {hasActiveFilters && (
              <button
                className="text-sm font-medium text-[#092a53] hover:underline"
                onClick={() => {
                  setSearchQuery("");
                  setActiveFilter("all");
                  setProviderFilter("all");
                  setRangeFilter("all");
                }}
                type="button"
              >
                {t("Clear filters")}
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <label className="relative block flex-1 lg:max-w-sm">
              <span className="sr-only">{t("Search payments")}</span>
              <Icon
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6b6b6b]"
                path={icons.search}
              />
              <input
                className={`${controlClassName} pl-9`}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t(
                  "Order, name, email, provider, or transaction ID",
                )}
                type="search"
                value={searchQuery}
              />
            </label>
            <label className="block">
              <span className="sr-only">{t("Provider")}</span>
              <select
                className={`${controlClassName} lg:w-44`}
                onChange={(event) => setProviderFilter(event.target.value)}
                value={providerFilter}
              >
                <option value="all">{t("All providers")}</option>
                {providerOptions.map((provider) => (
                  <option key={provider} value={provider}>
                    {providerInfo(provider).label}
                  </option>
                ))}
              </select>
            </label>
            <div
              aria-label={t("Date range")}
              className="flex flex-none overflow-x-auto rounded-lg border border-[#d1d5db] p-0.5"
              role="group"
            >
              {[
                { key: "all", label: t("All time") },
                { key: "today", label: t("Today") },
                { key: "7d", label: t("7 days") },
                { key: "30d", label: t("30 days") },
              ].map((option) => (
                <button
                  aria-pressed={rangeFilter === option.key}
                  className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition ${rangeFilter === option.key ? "bg-[#eef1f5] text-[#111827]" : "text-[#6b6b6b] hover:text-[#111827]"}`}
                  key={option.key}
                  onClick={() => setRangeFilter(option.key)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div
            aria-label={t("Filter payments by status")}
            className="flex w-fit max-w-full overflow-x-auto rounded-lg border border-[#d1d5db] p-0.5"
            role="group"
          >
            {[
              { id: "all", label: "All payments", count: payments.length },
              { id: "paid", label: "Paid", count: stats.paid },
              { id: "pending", label: "Pending", count: stats.pending },
              { id: "failed", label: "Failed", count: stats.failed },
            ].map((filter) => (
              <button
                aria-pressed={activeFilter === filter.id}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition ${activeFilter === filter.id ? "bg-[#eef1f5] text-[#111827]" : "text-[#6b6b6b] hover:text-[#111827]"}`}
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                type="button"
              >
                {t(filter.label)}
                <span className="num text-[#6b6b6b]">{filter.count}</span>
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4 px-4 py-5 sm:px-5" role="status">
            <span className="sr-only">{t("Loading payments…")}</span>
            {[0, 1, 2, 3].map((row) => (
              <div
                aria-hidden="true"
                className="flex animate-pulse items-center gap-4"
                key={row}
              >
                <span className="size-8 rounded-md bg-[#f3f4f6]" />
                <span className="h-3.5 flex-1 rounded bg-[#f3f4f6]" />
                <span className="h-3.5 w-24 rounded bg-[#f3f4f6]" />
              </div>
            ))}
          </div>
        ) : visiblePayments.length === 0 ? (
          <div className="border-t border-[#e8e8e8] px-6 py-12 text-center">
            <p className="text-sm font-medium text-[#111827]">
              {payments.length
                ? t("No matching payments")
                : t("No payment records yet.")}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-[#6b6b6b]">
              {payments.length
                ? t("Try another search or payment status.")
                : t(
                    "Stripe payment records will appear here as customers check out.",
                  )}
            </p>
          </div>
        ) : (
          <div className="relative overflow-x-auto border-t border-[#e8e8e8]">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="text-xs font-medium text-[#6b6b6b]">
                  <th className="px-5 py-2.5 font-medium" scope="col">
                    {t("Transaction")}
                  </th>
                  <th className="px-3 py-2.5 font-medium" scope="col">
                    {t("Order")}
                  </th>
                  <th className="px-3 py-2.5 font-medium" scope="col">
                    {t("Customer")}
                  </th>
                  <th className="px-3 py-2.5 font-medium" scope="col">
                    {t("Date")}
                  </th>
                  <th
                    className="num px-3 py-2.5 text-right font-medium"
                    scope="col"
                  >
                    {t("Amount")}
                  </th>
                  <th className="px-3 py-2.5 font-medium" scope="col">
                    {t("Status")}
                  </th>
                  <th className="px-5 py-2.5" scope="col">
                    <span className="sr-only">{t("Action")}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f2f3f5]">
                {visiblePayments.map((payment) => {
                  const date = parseDate(payment.createdAt);
                  return (
                    <tr
                      className="cursor-pointer transition hover:bg-[#f6f7f9]"
                      key={payment.id}
                      onClick={() => setSelectedId(payment.id)}
                    >
                      <td className="max-w-[16rem] px-5 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <ProviderMark provider={payment.provider} />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-[#111827]">
                              {providerInfo(payment.provider).label}
                            </p>
                            {payment.transactionId ? (
                              <button
                                className="flex max-w-[11rem] items-center gap-1 text-xs text-[#6b6b6b] hover:text-[#111827]"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  copyValue(payment.id, payment.transactionId);
                                }}
                                title={payment.transactionId}
                                type="button"
                              >
                                <span className="truncate">
                                  {payment.transactionId}
                                </span>
                                <Icon
                                  className="size-3 shrink-0"
                                  path={
                                    copiedId === payment.id
                                      ? icons.check
                                      : icons.copy
                                  }
                                />
                              </button>
                            ) : (
                              <p className="text-xs text-[#6b6b6b]">
                                {t("Payment")} #{payment.id}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="num px-3 py-3 font-medium text-[#111827]">
                        #{payment.orderId}
                      </td>
                      <td className="px-3 py-3">
                        <p className="max-w-[14rem] truncate font-medium text-[#111827]">
                          {payment.customerName}
                        </p>
                        <p className="max-w-[14rem] truncate text-xs text-[#6b6b6b]">
                          {payment.customerEmail}
                        </p>
                      </td>
                      <td className="num whitespace-nowrap px-3 py-3 text-xs text-[#6b6b6b]">
                        {date
                          ? date.toLocaleString(locale, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : "—"}
                      </td>
                      <td className="num whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums text-[#111827]">
                        {money(toXaf(payment.amountCents, payment.currency))}
                      </td>
                      <td className="px-3 py-3">
                        <PaymentStatus status={payment.status} t={t} />
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          aria-label={t("View details")}
                          className="grid size-8 place-items-center rounded-md text-[#6b6b6b] transition hover:bg-[#eef1f5] hover:text-[#111827]"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedId(payment.id);
                          }}
                          type="button"
                        >
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
        <div
          className="fixed inset-0 z-50 flex justify-end"
          role="presentation"
        >
          <button
            aria-label={t("Close")}
            className="admin-drawer-backdrop absolute inset-0 bg-[#0b1e36]/45"
            onClick={() => setSelectedId(null)}
            tabIndex={-1}
            type="button"
          />
          <section
            aria-labelledby="payment-drawer-title"
            aria-modal="true"
            className="admin-drawer-panel relative flex h-full w-full max-w-[28rem] flex-col border-l border-[#e8e8e8] bg-white"
            role="dialog"
          >
            <header className="flex items-start justify-between gap-4 border-b border-[#e8e8e8] px-6 py-5">
              <div className="flex items-center gap-3">
                <ProviderMark
                  provider={selectedPayment.provider}
                  size="size-10"
                />
                <div>
                  <p className="text-xs text-[#6b6b6b]">
                    {providerInfo(selectedPayment.provider).label}
                  </p>
                  <h2
                    className="text-lg font-semibold text-[#111827]"
                    id="payment-drawer-title"
                  >
                    {t("Order #{id}", { id: selectedPayment.orderId })}
                  </h2>
                </div>
              </div>
              <button
                aria-label={t("Close")}
                className="grid size-9 shrink-0 place-items-center rounded-lg text-[#6b6b6b] transition hover:bg-[#f6f7f9] hover:text-[#111827]"
                onClick={() => setSelectedId(null)}
                type="button"
              >
                <Icon className="size-5" path={icons.close} />
              </button>
            </header>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6">
              <div className="rounded-lg border border-[#e8e8e8] bg-[#f9fafb] p-4">
                <p className="text-xs text-[#6b6b6b]">{t("Amount")}</p>
                <p className="num mt-1 text-3xl font-semibold tabular-nums tracking-[-0.01em] text-[#111827]">
                  {money(
                    toXaf(
                      selectedPayment.amountCents,
                      selectedPayment.currency,
                    ),
                  )}
                </p>
                <div className="mt-3">
                  <PaymentStatus status={selectedPayment.status} t={t} />
                </div>
              </div>
              <dl className="divide-y divide-[#f2f3f5] rounded-lg border border-[#e8e8e8]">
                {[
                  { label: t("Customer"), value: selectedPayment.customerName },
                  {
                    label: t("Email"),
                    value: selectedPayment.customerEmail,
                    href: `mailto:${selectedPayment.customerEmail}`,
                  },
                  {
                    label: t("Date"),
                    value:
                      parseDate(selectedPayment.createdAt)?.toLocaleString(
                        locale,
                        { dateStyle: "medium", timeStyle: "short" },
                      ) || "—",
                  },
                  {
                    label: t("Provider"),
                    value: providerInfo(selectedPayment.provider).label,
                  },
                  {
                    label: t("Currency"),
                    value: String(
                      selectedPayment.currency || "xaf",
                    ).toUpperCase(),
                  },
                ].map((row) => (
                  <div
                    className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                    key={row.label}
                  >
                    <dt className="text-[#6b6b6b]">{row.label}</dt>
                    <dd className="min-w-0 truncate text-right font-medium text-[#111827]">
                      {row.href ? (
                        <a
                          className="text-[#092a53] hover:underline"
                          href={row.href}
                        >
                          {row.value}
                        </a>
                      ) : (
                        row.value
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
              {selectedPayment.transactionId && (
                <div>
                  <p className="text-xs text-[#6b6b6b]">{t("Transaction")}</p>
                  <div className="mt-2 flex items-center gap-2 rounded-lg border border-[#e8e8e8] bg-[#f9fafb] p-3">
                    <code className="min-w-0 flex-1 break-all text-xs text-[#111827]">
                      {selectedPayment.transactionId}
                    </code>
                    <button
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#d1d5db] bg-white px-2.5 py-1.5 text-xs font-medium text-[#111827] transition hover:border-[#9aa2ad]"
                      onClick={() =>
                        copyValue(
                          `drawer-${selectedPayment.id}`,
                          selectedPayment.transactionId,
                        )
                      }
                      type="button"
                    >
                      <Icon
                        className="size-3.5"
                        path={
                          copiedId === `drawer-${selectedPayment.id}`
                            ? icons.check
                            : icons.copy
                        }
                      />
                      {t(
                        copiedId === `drawer-${selectedPayment.id}`
                          ? "Copied"
                          : "Copy",
                      )}
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
