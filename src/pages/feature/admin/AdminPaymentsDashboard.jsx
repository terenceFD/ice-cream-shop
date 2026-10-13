import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../../../api/api";
import { formatCartMoney, USD_TO_XAF } from "../../../cartPricing";
import { useLanguage } from "../../../language/LanguageContext";
import { useAdminAuth } from "./AdminAuthContext";

function formatMoney(amount, currency, language) {
  const amountXaf = currency.toLowerCase() === "usd"
    ? Math.round((amount / 100) * USD_TO_XAF)
    : amount;
  return formatCartMoney(amountXaf, "xaf", language);
}

function formatDate(value, language) {
  if (!value) return "—";
  const date = new Date(`${value.replace(" ", "T")}Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(language === "fr" ? "fr-FR" : "en-US");
}

function PaymentStatus({ status, t }) {
  const styles = {
    pending: "bg-amber-100 text-amber-900",
    paid: "bg-green-100 text-green-900",
    failed: "bg-red-100 text-red-900",
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${styles[status] || "bg-slate-100 text-slate-800"}`}>
      {t(status === "paid" ? "Paid" : status === "pending" ? "Pending" : status)}
    </span>
  );
}

export function AdminPaymentsDashboard() {
  const { sessionToken } = useAdminAuth();
  const { t, language } = useLanguage();
  const [payments, setPayments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  const refresh = useCallback(async () => {
    setError("");
    setIsLoading(true);
    try {
      const result = await apiRequest("/admin/payments", { token: sessionToken });
      setPayments(result.payments);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const paidPayments = payments.filter((payment) => payment.status === "paid");
  const pendingPayments = payments.filter((payment) => payment.status === "pending");
  const failedPayments = payments.filter((payment) => payment.status === "failed");
  const paidVolume = paidPayments.reduce((total, payment) => {
    const amount = payment.currency.toLowerCase() === "usd"
      ? Math.round((payment.amountCents / 100) * USD_TO_XAF)
      : payment.amountCents;
    return total + amount;
  }, 0);
  const filters = [
    { id: "all", label: "All payments", count: payments.length },
    { id: "paid", label: "Paid", count: paidPayments.length },
    { id: "pending", label: "Pending", count: pendingPayments.length },
    { id: "failed", label: "Failed", count: failedPayments.length },
  ];
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visiblePayments = payments.filter((payment) => {
    const matchesFilter = activeFilter === "all" || payment.status === activeFilter;
    const searchableDetails = [
      payment.orderId,
      payment.customerName,
      payment.customerEmail,
      payment.provider,
      payment.transactionId,
    ].join(" ").toLowerCase();
    return matchesFilter && searchableDetails.includes(normalizedQuery);
  });

  return (
    <div className="space-y-6">
      <section className="relative isolate overflow-hidden rounded-[26px] bg-gradient-to-br from-[#092a53] via-[#123b63] to-[#285777] p-5 text-white shadow-[0_16px_40px_rgba(9,42,83,0.18)] sm:p-7 lg:p-8">
        <div aria-hidden="true" className="absolute -right-14 -top-20 -z-10 size-60 rounded-full border border-white/10" />
        <div aria-hidden="true" className="absolute -bottom-24 right-28 -z-10 size-48 rounded-full bg-[#ffdc32]/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/80">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-[#9ee6b1]" />
              {t("Multiple payment providers")}
            </span>
            <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">{t("Payments")}</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/70">
              {t("Payment records confirmed by Stripe, CamPay, and Flutterwave for customer orders.")}
            </p>
          </div>
          <button
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/[0.08] px-4 text-sm font-bold text-white transition hover:bg-white/[0.15] disabled:cursor-wait disabled:opacity-60"
            disabled={isLoading}
            onClick={refresh}
            type="button"
          >
            <svg aria-hidden="true" className={`size-4 ${isLoading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 20 20">
              <path d="M16.5 8A6.5 6.5 0 0 0 5.4 4.1L3.5 6M3.5 6V2.5M3.5 6H7m-3.5 6A6.5 6.5 0 0 0 14.6 16l1.9-1.9m0 0v3.4m0-3.4H13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
            </svg>
            {t("Refresh")}
          </button>
        </div>
        <div className="relative mt-7 flex flex-wrap items-end justify-between gap-5 border-t border-white/15 pt-5">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-white/60">{t("Successful payment volume")}</p>
            <p className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              {formatCartMoney(paidVolume, "xaf", language)}
            </p>
          </div>
          <p className="inline-flex items-center gap-2 rounded-full bg-white/[0.08] px-3 py-2 text-xs font-semibold text-white/75">
            <svg aria-hidden="true" className="size-4 text-[#9ee6b1]" fill="none" viewBox="0 0 20 20">
              <path d="m4 10 4 4 8-8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
            </svg>
            {t("Payments securely processed by payment providers")}
          </p>
        </div>
      </section>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total transactions", value: payments.length, accent: "bg-[#e9f1fa] text-[#315982]", icon: "▤" },
          { label: "Paid", value: paidPayments.length, accent: "bg-[#e5f3d8] text-[#37632c]", icon: "✓" },
          { label: "Pending", value: pendingPayments.length, accent: "bg-[#fff4d6] text-[#916700]", icon: "◷" },
          { label: "Failed", value: failedPayments.length, accent: "bg-[#fff0ed] text-[#b34334]", icon: "!" },
        ].map((metric) => (
          <article className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-[0_5px_18px_rgba(16,44,80,0.035)] sm:p-5" key={metric.label}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold text-[#65748a]">{t(metric.label)}</p>
              <span aria-hidden="true" className={`grid size-9 place-items-center rounded-xl text-base font-extrabold ${metric.accent}`}>{metric.icon}</span>
            </div>
            <p className="mt-3 font-display text-3xl font-bold text-[#102c50]">{metric.value}</p>
          </article>
        ))}
      </div>

      <section className="overflow-hidden rounded-[22px] border border-[#e2e8f0] bg-white shadow-[0_8px_26px_rgba(16,44,80,0.045)]">
        <div className="border-b border-[#edf0f4] px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-bold text-[#102c50]">{t("Transaction activity")}</h2>
              <p className="mt-1 text-xs text-[#7c8a9b]">{t("Review payment status and customer details.")}</p>
            </div>
            <label className="relative block w-full sm:w-72">
              <span className="sr-only">{t("Search payments")}</span>
              <svg aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8291a3]" fill="none" viewBox="0 0 20 20">
                <circle cx="8.8" cy="8.8" r="5.8" stroke="currentColor" strokeWidth="1.5" />
                <path d="m13.2 13.2 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
              </svg>
              <input
                className="min-h-10 w-full rounded-xl border border-[#dce5ef] bg-[#f8fafc] pl-9 pr-3 text-sm text-[#102c50] placeholder:text-[#91a0b1] focus:border-[#8ca8c3] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#dbe8f4]"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t("Order, name, email, provider, or transaction ID")}
                type="search"
                value={searchQuery}
              />
            </label>
          </div>
          <div aria-label={t("Filter payments by status")} className="mt-5 flex gap-2 overflow-x-auto pb-1" role="group">
            {filters.map((filter) => (
              <button
                aria-pressed={activeFilter === filter.id}
                className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-bold transition ${
                  activeFilter === filter.id
                    ? "bg-[#092a53] text-white shadow-sm"
                    : "bg-[#f3f6fa] text-[#63758b] hover:bg-[#e9eff6] hover:text-[#173654]"
                }`}
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                type="button"
              >
                {t(filter.label)}
                <span className={`rounded-md px-1.5 py-0.5 text-[10px] ${activeFilter === filter.id ? "bg-white/15 text-white" : "bg-white text-[#63758b]"}`}>
                  {filter.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div aria-live="polite" className="divide-y divide-[#edf0f4]">
          {isLoading ? (
            <div className="space-y-3 p-4 sm:p-6" role="status">
              <span className="sr-only">{t("Loading payments…")}</span>
              {[1, 2, 3].map((row) => (
                <div aria-hidden="true" className="h-[104px] animate-pulse rounded-xl bg-[#f3f6fa]" key={row} />
              ))}
            </div>
          ) : payments.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <span aria-hidden="true" className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#f3f6fa] text-2xl text-[#52708e]">▤</span>
              <h3 className="mt-4 font-display text-lg font-bold text-[#173654]">{t("No payment records yet.")}</h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-[#7c8a9b]">{t("Stripe payment records will appear here as customers check out.")}</p>
            </div>
          ) : visiblePayments.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <span aria-hidden="true" className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#f3f6fa] text-2xl text-[#52708e]">⌕</span>
              <h3 className="mt-4 font-display text-lg font-bold text-[#173654]">{t("No matching payments")}</h3>
              <p className="mt-1 text-sm text-[#7c8a9b]">{t("Try another search or payment status.")}</p>
              <button
                className="mt-4 rounded-lg px-3 py-2 text-xs font-bold text-[#315982] transition hover:bg-[#f3f6fa]"
                onClick={() => {
                  setSearchQuery("");
                  setActiveFilter("all");
                }}
                type="button"
              >
                {t("Clear filters")}
              </button>
            </div>
          ) : (
            visiblePayments.map((payment) => (
              <article className="p-4 transition-colors hover:bg-[#fbfcfe] sm:px-6 sm:py-5" key={payment.id}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#edf3f9] text-[#315982]">
                      <svg className="size-5" fill="none" viewBox="0 0 24 24">
                        <path d="M3.5 7.5h17v11h-17zM3.5 10.5h17M7 15h3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                      </svg>
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-base font-bold text-[#173654]">{t("Order #{id}", { id: payment.orderId })}</h3>
                        <PaymentStatus status={payment.status} t={t} />
                      </div>
                      <p className="mt-1 truncate text-sm font-semibold text-[#405a75]">{payment.customerName}</p>
                      <p className="truncate text-xs text-[#7c8a9b]">{payment.customerEmail}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <div className="sm:text-right">
                      <p className="font-display text-xl font-bold text-[#102c50]">{formatMoney(payment.amountCents, payment.currency, language)}</p>
                      <p className="mt-1 text-[11px] text-[#7c8a9b]">{formatDate(payment.createdAt, language)}</p>
                    </div>
                    <span className="rounded-lg bg-[#f3f6fa] px-2.5 py-1.5 text-[10px] font-bold uppercase text-[#65748a]">
                      {payment.provider}
                    </span>
                    {payment.transactionId && (
                      <span className="hidden max-w-36 truncate rounded-lg bg-[#f3f6fa] px-2.5 py-1.5 font-mono text-[10px] text-[#65748a] lg:block" title={payment.transactionId}>
                        {payment.transactionId}
                      </span>
                    )}
                  </div>
                </div>
                {payment.transactionId && (
                  <p className="mt-3 break-all border-t border-[#edf0f4] pt-3 font-mono text-[10px] text-[#7c8a9b] lg:hidden">
                    {t("{provider} transaction: {id}", { provider: payment.provider, id: payment.transactionId })}
                  </p>
                )}
              </article>
            ))
          )}
        </div>
        {!isLoading && payments.length > 0 && (
          <p className="border-t border-[#edf0f4] bg-[#fbfcfe] px-4 py-3 text-xs text-[#7c8a9b] sm:px-6" role="status">
            {t("Showing {visible} of {total} payments", { visible: visiblePayments.length, total: payments.length })}
          </p>
        )}
      </section>
    </div>
  );
}
