import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../../api/api";
import { useAdminAuth } from "./useAdminAuth";
import { useLanguage } from "../../language/useLanguage";
import { formatCartMoney, USD_TO_XAF } from "../../lib/cartPricing";

const REFRESH_MS = 60_000;

const linkClassName = "text-sm font-semibold text-[#123b68] outline-none! transition-colors hover:text-[#092a53] focus-visible:outline-2! focus-visible:outline-offset-4 focus-visible:outline-[#092a53]";

function toXaf(cents, currency) {
  return String(currency || "xaf").toLowerCase() === "usd" ? Math.round((Number(cents || 0) / 100) * USD_TO_XAF) : Number(cents || 0);
}

function parseDate(value) {
  if (!value) return null;
  const normalizedValue = String(value).replace(" ", "T");
  const date = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(normalizedValue) ? normalizedValue : `${normalizedValue}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isoDay(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function relativeTime(date, language) {
  if (!date) return "";
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(language === "fr" ? "fr" : "en", { numeric: "auto" });
  const abs = Math.abs(seconds);
  if (abs < 3600) return formatter.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return formatter.format(Math.round(seconds / 3600), "hour");
  return formatter.format(Math.round(seconds / 86400), "day");
}

const stageLabels = { accepted: "Accepted", preparing: "Being prepared", ready: "Ready", out_for_delivery: "Out for delivery" };

async function safe(request) {
  try {
    return await request;
  } catch {
    return null;
  }
}

export function AdminStoreOverviewPage() {
  const { sessionToken, currentAdmin } = useAdminAuth();
  const isOwner = currentAdmin?.role === "owner";
  const { t, language } = useLanguage();
  const locale = language === "fr" ? "fr-CM" : "en-CM";
  const money = (amount) => formatCartMoney(amount, "xaf", language);
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    const request = (path) => apiRequest(path, { token: sessionToken });
    try {
      const [orders, delivered, notifications, reviews, cakes, report] = await Promise.all([
        request("/admin/orders"),
        safe(request("/admin/orders?status=delivered")),
        safe(request("/admin/notifications")),
        request("/admin/reviews?status=pending"),
        safe(request("/admin/cake-requests")),
        safe(request("/admin/reports")),
      ]);
      setError("");
      setData({
        orders: orders.orders,
        delivered: delivered?.orders || [],
        messages: notifications?.messages || [],
        unreadCount: notifications?.unreadCount || 0,
        reviews: reviews.reviews,
        cakes: cakes?.requests || [],
        report,
      });
      setLastUpdated(new Date());
    } catch (loadError) {
      setError(loadError instanceof Error
        ? loadError.message
        : t("Unable to load the store overview. Check your connection and try again."));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [sessionToken, t]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(() => {
      if (!document.hidden) refresh();
    }, REFRESH_MS);
    function handleVisibilityChange() {
      if (!document.hidden) refresh();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refresh]);

  const view = useMemo(() => {
    if (!data) return null;
    const todayLocal = new Date().toDateString();
    const isToday = (value) => parseDate(value)?.toDateString() === todayLocal;
    const processing = data.orders.filter((order) => order.status === "processing");
    const awaitingPayment = data.orders.filter((order) => order.status === "pending_payment");
    const stageCounts = processing.reduce((counts, order) => {
      const stage = order.deliveryStage || order.fulfillmentStatus || "preparing";
      counts[stage] = (counts[stage] || 0) + 1;
      return counts;
    }, {});
    const todaysOrders = [...data.orders, ...data.delivered].filter((order) => isToday(order.createdAt) && order.status !== "payment_failed");
    const deliveredToday = data.delivered.filter((order) => isToday(order.deliveredAt || order.createdAt));
    const recentSales = data.report?.recentSales || [];
    const todayKey = isoDay(new Date());
    const todaySales = Number(recentSales.find((row) => String(row.date).slice(0, 10) === todayKey)?.sales || 0);
    const week = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setUTCDate(date.getUTCDate() - (6 - index));
      const key = isoDay(date);
      const row = recentSales.find((entry) => String(entry.date).slice(0, 10) === key);
      return { key, date, sales: Number(row?.sales || 0), orders: Number(row?.orders || 0) };
    });
    const weekTotal = week.reduce((sum, day) => sum + day.sales, 0);
    const weekMax = Math.max(1, ...week.map((day) => day.sales));
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const upcomingCakes = data.cakes
      .filter((cake) => cake.status !== "declined")
      .map((cake) => {
        const date = new Date(`${cake.pickupDate}T12:00:00`);
        return { ...cake, date, days: Number.isNaN(date.getTime()) ? null : Math.round((date - today) / 86400000) };
      })
      .filter((cake) => cake.days !== null && cake.days >= 0 && cake.days <= 7)
      .sort((a, b) => a.days - b.days);
    const newCakes = data.cakes.filter((cake) => cake.status === "new").length;
    const openRevenue = processing.reduce((sum, order) => sum + toXaf(order.totalCents, order.currency), 0);
    const liveOrders = [...processing]
      .sort((a, b) => (parseDate(b.createdAt)?.getTime() || 0) - (parseDate(a.createdAt)?.getTime() || 0))
      .slice(0, 5);
    return {
      processing,
      awaitingPayment,
      stageCounts,
      todaysOrders,
      deliveredToday,
      todaySales,
      week,
      weekTotal,
      weekMax,
      upcomingCakes,
      newCakes,
      openRevenue,
      liveOrders,
      unreadMessages: data.messages.filter((message) => !message.isRead).slice(0, 3),
    };
  }, [data]);

  const storeDisplayName = currentAdmin?.role === "store_admin"
    ? currentAdmin.storeName?.replace(/\s+branch$/i, "").trim()
    : currentAdmin?.storeName;
  const storeName = isOwner ? t("All stores") : t(currentAdmin?.branchTown || storeDisplayName || "Store admin");
  const storeTown = currentAdmin?.role === "store_admin" ? currentAdmin.storeTown : null;

  if (isLoading) {
    return (
      <div aria-label={t("Loading…")} className="space-y-8" role="status">
        <div className="h-24 animate-pulse bg-[#f4f6f8] motion-reduce:animate-none" />
        <div className="grid grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <div className="h-24 animate-pulse bg-[#f4f6f8] motion-reduce:animate-none" key={item} />)}
        </div>
        <div className="grid gap-10 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="h-80 animate-pulse bg-[#f4f6f8] motion-reduce:animate-none" />
          <div className="h-80 animate-pulse bg-[#f4f6f8] motion-reduce:animate-none" />
        </div>
      </div>
    );
  }

  const tasks = view ? [
    { key: "orders", count: view.processing.length, label: t("orders in the kitchen"), to: "/admin/orders" },
    { key: "payment", count: view.awaitingPayment.length, label: t("awaiting payment"), to: "/admin/orders" },
    { key: "messages", count: data.unreadCount, label: t("unread messages"), to: "/admin/notifications" },
    { key: "reviews", count: data.reviews.length, label: t("reviews to approve"), to: "/admin/reviews" },
    { key: "cakes", count: view.newCakes, label: t("new cake requests"), to: "/admin/cake-requests" },
  ] : [];
  const openTasks = tasks.filter((task) => task.count > 0);
  const todayLabel = new Date().toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-col gap-5 border-b border-[#dce3eb] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-sans text-2xl font-bold tracking-tight text-[#092a53]">{t("Store overview")}</h1>
          <p className="mt-1 text-sm font-semibold text-[#092a53]">{storeName}{storeTown ? ` · ${t("Branch: {branch}", { branch: storeTown })}` : ""}</p>
          <p className="mt-1 text-sm text-[#65748a]">{todayLabel}</p>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#52647b]">
            {openTasks.length
              ? t("{count} things need your attention today.", { count: openTasks.reduce((sum, task) => sum + task.count, 0) })
              : t("Everything is under control.")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {lastUpdated && (
            <span className="mr-1 text-xs text-[#65748a]">
              {t("Live · updated {time}", { time: relativeTime(lastUpdated, language) })}
            </span>
          )}
          <button
            aria-busy={isRefreshing}
            className="inline-flex min-h-10 items-center rounded-md border border-[#cbd5df] bg-white px-3.5 text-sm font-semibold text-[#123b68] outline-none! transition-colors hover:border-[#092a53] hover:bg-[#f8fafc] focus-visible:outline-2! focus-visible:outline-offset-2 focus-visible:outline-[#092a53] disabled:cursor-wait disabled:opacity-60"
            disabled={isRefreshing}
            onClick={refresh}
            type="button"
          >
            {t("Refresh")}
          </button>
          <Link className="inline-flex min-h-10 items-center rounded-md bg-[#092a53] px-4 text-sm font-semibold text-white outline-none! transition-colors hover:bg-[#163e6b] focus-visible:outline-2! focus-visible:outline-offset-2 focus-visible:outline-[#092a53]" to="/admin/orders">
            {t("Open order queue")}
          </Link>
        </div>
      </header>

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#e8c7c4] bg-[#fff8f7] px-4 py-3" role="alert">
          <p className="text-sm font-medium leading-6 text-[#8f302b]">{error}</p>
          <button className="min-h-9 rounded-md px-3 text-sm font-semibold text-[#092a53] underline underline-offset-4 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#092a53]" onClick={refresh} type="button">
            {t("Refresh")}
          </button>
        </div>
      )}

      {view && (
        <>
          {openTasks.length > 0 && (
            <section aria-labelledby="attention-title" className="rounded-lg border border-[#dce3eb] bg-white p-4 sm:p-5">
              <h2 className="font-sans text-base font-bold text-[#092a53]" id="attention-title">{t("Needs your attention")}</h2>
              <ul className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md bg-[#e7ebf0] sm:grid-cols-3 lg:grid-cols-5">
                {openTasks.map((task) => (
                  <li className="bg-white" key={task.key}>
                    <Link className="block min-h-20 px-3 py-3 outline-none! transition-colors hover:bg-[#f8fafc] focus-visible:outline-2! focus-visible:outline-offset-[-2px] focus-visible:outline-[#092a53] sm:px-4" to={task.to}>
                      <span className="block font-sans text-2xl font-semibold leading-none tabular-nums text-[#092a53]">{task.count.toLocaleString(locale)}</span>
                      <span className="mt-2 block text-xs font-semibold leading-5 text-[#52647b]">{task.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-label={t("Today")} className="grid grid-cols-2 overflow-hidden rounded-lg border border-[#dce3eb] bg-white lg:grid-cols-4">
            {[
              { label: t("Orders today"), value: view.todaysOrders.length.toLocaleString(locale), hint: t("{count} delivered", { count: view.deliveredToday.length }) },
              { label: t("Sales today"), value: money(view.todaySales), hint: t("Paid orders") },
              { label: t("Paid orders in progress"), value: money(view.openRevenue), hint: t("{count} orders", { count: view.processing.length }) },
              { label: t("Last 7 days"), value: money(view.weekTotal), hint: t("Average {amount} per day", { amount: money(Math.round(view.weekTotal / 7)) }) },
            ].map((kpi, index) => (
              <article className={`px-4 py-4 sm:px-5 sm:py-5 ${index % 2 === 1 ? "border-l border-[#dce3eb]" : ""} ${index > 1 ? "border-t border-[#dce3eb] lg:border-t-0" : ""} ${index > 0 ? "lg:border-l lg:border-[#dce3eb]" : ""}`} key={kpi.label}>
                <p className="text-xs font-semibold leading-5 text-[#65748a] sm:text-sm">{kpi.label}</p>
                <p className="mt-2 break-words font-sans text-2xl font-semibold leading-tight tabular-nums tracking-tight text-[#092a53]">{kpi.value}</p>
                <p className="mt-1.5 text-xs leading-5 text-[#65748a]">{kpi.hint}</p>
              </article>
            ))}
          </section>

          <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-6">
              <section aria-labelledby="kitchen-title" className="rounded-lg border border-[#dce3eb] bg-white p-4 sm:p-5">
                <header className="flex items-end justify-between gap-3">
                  <div>
                    <h2 className="font-sans text-base font-bold text-[#092a53]" id="kitchen-title">{t("Kitchen pipeline")}</h2>
                    <p className="mt-1 text-sm text-[#65748a]">{t("Oldest orders first — keep them moving.")}</p>
                  </div>
                  <Link className={linkClassName} to="/admin/orders">{t("View all")}</Link>
                </header>
                <ol className="mt-4 grid grid-cols-2 rounded-md bg-[#f4f6f8] sm:grid-cols-4">
                  {Object.keys(stageLabels).map((stage, index) => (
                    <li className={`${index % 2 === 1 ? "border-l border-white" : ""} ${index > 1 ? "border-t border-white sm:border-t-0" : ""} ${index > 0 ? "sm:border-l sm:border-white" : ""} px-3 py-3 sm:px-3.5`} key={stage}>
                      <p className="text-xs font-semibold leading-5 text-[#52647b]">{t(stageLabels[stage])}</p>
                      <p className="mt-1 font-sans text-2xl font-semibold leading-none tabular-nums text-[#092a53]">{view.stageCounts[stage] || 0}</p>
                    </li>
                  ))}
                </ol>
                {view.liveOrders.length ? (
                  <ul className="mt-2 divide-y divide-[#edf0f4]">
                    {view.liveOrders.map((order) => {
                      const created = parseDate(order.createdAt);
                      const ageMinutes = created ? Math.round((Date.now() - created.getTime()) / 60000) : 0;
                      const stage = order.deliveryStage || order.fulfillmentStatus || "preparing";
                      return (
                        <li key={order.id}>
                          <Link className="flex items-start justify-between gap-4 px-2 py-3.5 outline-none! transition-colors hover:bg-[#f8fafc] focus-visible:outline-2! focus-visible:outline-offset-2 focus-visible:outline-[#092a53]" to="/admin/orders">
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-[#092a53]">#{order.id} {order.customerName}</span>
                              <span className="mt-1 block truncate text-xs leading-5 text-[#65748a] sm:text-sm">{order.items.map((item) => `${item.quantity}× ${item.flavorName}`).join(", ")}</span>
                            </span>
                            <span className="shrink-0 text-right">
                              <span className="block text-sm font-semibold text-[#092a53]">{t(stageLabels[stage] || stage)}</span>
                              <span className={`mt-1 block text-xs tabular-nums ${ageMinutes > 45 ? "font-bold text-[#a5342b]" : "text-[#65748a]"}`}>{relativeTime(created, language)}</span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-2 border-t border-[#edf0f4] px-2 py-6 text-sm text-[#65748a]">{t("No paid orders in progress right now.")}</p>
                )}
              </section>

              <section aria-labelledby="week-title" className="rounded-lg border border-[#dce3eb] bg-white p-4 sm:p-5">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h2 className="font-sans text-base font-bold text-[#092a53]" id="week-title">{t("Sales this week")}</h2>
                    <p className="mt-1 text-sm text-[#65748a]">{t("{sales} from {orders} orders", { sales: money(view.weekTotal), orders: view.week.reduce((sum, day) => sum + day.orders, 0) })}</p>
                  </div>
                  <Link className={linkClassName} to="/admin/reports">{t("Reports")}</Link>
                </div>
                <ol className="mt-5 flex h-36 items-end gap-2.5 sm:gap-3">
                  {view.week.map((day, index) => {
                    const isToday = index === view.week.length - 1;
                    const dayName = day.date.toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" });
                    return (
                      <li className="group relative flex h-full flex-1 flex-col items-center justify-end gap-2" key={day.key}>
                        <span className="pointer-events-none absolute bottom-full z-10 mb-2 hidden whitespace-nowrap bg-[#092a53] px-2 py-1 text-xs font-bold text-white group-hover:block">
                          {money(day.sales)} {t("{count} orders", { count: day.orders })}
                        </span>
                        <span className="flex w-full flex-1 items-end bg-[#f4f6f8]">
                          <span
                            aria-label={`${day.date.toLocaleDateString(locale, { weekday: "long", timeZone: "UTC" })}: ${money(day.sales)}`}
                            className={`w-full ${isToday ? "bg-[#ffdc32]" : "bg-[#092a53]"}`}
                            role="img"
                            style={{ height: `${day.sales ? Math.max(8, (day.sales / view.weekMax) * 100) : 0}%` }}
                          />
                        </span>
                        <span className={`text-sm font-bold ${isToday ? "text-[#092a53]" : "text-[#65748a]"}`}>{dayName}</span>
                      </li>
                    );
                  })}
                </ol>
              </section>
            </div>

            <div className="min-w-0 space-y-4">
              {/* Cake pickups */}
              <section aria-labelledby="pickups-title" className="rounded-lg border border-[#dce3eb] bg-white">
                <header className="flex items-center justify-between gap-3 p-4 pb-2 sm:px-5">
                  <h2 className="font-sans text-base font-bold text-[#092a53]" id="pickups-title">
                    {t("Cake pickups this week")}
                  </h2>
                  <Link className="text-xs font-bold text-[#123b68] underline decoration-[#ffdc32] decoration-2 underline-offset-4 hover:text-[#092a53]" to="/admin/cake-requests">{t("View all")}</Link>
                </header>
                {view.upcomingCakes.length ? (
                  <ul className="divide-y divide-[#edf0f4]">
                    {view.upcomingCakes.slice(0, 5).map((cake) => (
                      <li className="flex items-center gap-3 px-4 py-3 sm:px-5" key={cake.id}>
                        <span className={`grid w-12 shrink-0 place-items-center py-1 text-center ${cake.days <= 1 ? "text-[#9a6200]" : "text-[#52647b]"}`}>
                          <span className="text-xs font-semibold">{cake.date.toLocaleDateString(locale, { month: "short" })}</span>
                          <span className="font-sans text-lg font-semibold leading-none tabular-nums text-[#092a53]">{cake.date.getDate()}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-[#092a53]">{cake.size} · {cake.flavor}</span>
                          <span className="block truncate text-xs text-[#65748a]">{cake.customerName}</span>
                        </span>
                        <span className={`shrink-0 rounded-sm px-2 py-1 text-xs font-semibold capitalize ${cake.status === "confirmed" ? "bg-[#eaf6ee] text-[#185d3a]" : cake.status === "contacted" ? "bg-[#e9f1fa] text-[#245281]" : "bg-[#fff6e5] text-[#805100]"}`}>
                          {t(cake.status)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-5 py-6 text-sm text-[#65748a]">{t("No cake pickups in the next 7 days.")}</p>
                )}
              </section>

              {/* Messages */}
              <section aria-labelledby="messages-title" className="rounded-lg border border-[#dce3eb] bg-white">
                <header className="flex items-center justify-between gap-3 p-4 pb-2 sm:px-5">
                  <h2 className="flex items-center gap-2 font-sans text-base font-bold text-[#092a53]" id="messages-title">
                    {t("Unread messages")}
                    {data.unreadCount > 0 && <span className="rounded-sm bg-[#ffedea] px-1.5 py-0.5 text-xs font-semibold tabular-nums text-[#831c1e]">{data.unreadCount}</span>}
                  </h2>
                  <Link className="text-xs font-bold text-[#123b68] underline decoration-[#ffdc32] decoration-2 underline-offset-4 hover:text-[#092a53]" to="/admin/notifications">{t("Open inbox")}</Link>
                </header>
                {view.unreadMessages.length ? (
                  <ul className="divide-y divide-[#edf0f4]">
                    {view.unreadMessages.map((message) => (
                      <li key={message.id}>
                        <Link className="block px-4 py-3 transition-colors hover:bg-[#f8fafc] sm:px-5" to="/admin/notifications">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-sm font-semibold text-[#092a53]">{message.name}</span>
                            <span className="shrink-0 text-xs tabular-nums text-[#65748a]">{relativeTime(parseDate(message.createdAt), language)}</span>
                          </span>
                          <span className="block truncate text-xs font-semibold text-[#123b68]">{message.subject}</span>
                          <span className="block truncate text-xs text-[#65748a]">{message.message}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-5 py-6 text-sm text-[#65748a]">{t("You’re all caught up.")}</p>
                )}
              </section>

              {/* Reviews waiting */}
              {data.reviews.length > 0 && (
                <Link className="group flex items-center gap-3 rounded-lg border border-[#dce3eb] bg-white p-4 transition-colors hover:bg-[#f8fafc] sm:px-5" to="/admin/reviews">
                  <svg aria-hidden="true" className="size-4 shrink-0 text-[#092a53]" fill="currentColor" viewBox="0 0 24 24"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" /></svg>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-[#092a53]">{t("{count} reviews waiting for approval", { count: data.reviews.length })}</span>
                    <span className="block truncate text-xs text-[#65748a]">“{data.reviews[0].review || data.reviews[0].itemName}” — {data.reviews[0].customerName}</span>
                  </span>
                  <svg aria-hidden="true" className="size-4 text-[#65748a] transition group-hover:translate-x-0.5 group-hover:text-[#092a53]" fill="none" viewBox="0 0 24 24"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>
                </Link>
              )}

              {/* Quick links */}
              <section aria-labelledby="shortcuts-title">
                <h2 className="mb-2 text-sm font-semibold text-[#52647b]" id="shortcuts-title">{t("Shortcuts")}</h2>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: t("Delivered"), to: "/admin/delivered" },
                    { label: t("Payments"), to: "/admin/payments" },
                    { label: t("Customer accounts"), to: "/admin/customers" },
                    { label: t("Reports"), to: "/admin/reports" },
                  ].map((shortcut) => (
                    <Link className="group flex min-h-11 items-center justify-between gap-2 rounded-md border border-[#dce3eb] bg-white px-3 py-2.5 text-sm font-semibold text-[#123b68] transition-colors hover:border-[#aebdcc] hover:bg-[#f8fafc] hover:text-[#092a53] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#092a53]" key={shortcut.to} to={shortcut.to}>
                      <span className="truncate">{shortcut.label}</span>
                      <svg aria-hidden="true" className="size-4 shrink-0 text-[#65748a] transition group-hover:translate-x-0.5 group-hover:text-[#092a53]" fill="none" viewBox="0 0 24 24"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>
                    </Link>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
