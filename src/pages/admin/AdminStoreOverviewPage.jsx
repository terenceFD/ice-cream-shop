import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../../api/api";
import { useAdminAuth } from "./useAdminAuth";
import { useLanguage } from "../../language/useLanguage";
import { formatCartMoney, USD_TO_XAF } from "../../lib/cartPricing";

const REFRESH_MS = 60_000;
const STAR_PATH = "M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7L12 3Z";

const icons = {
  store: "M4 10h16l-1.5-5h-13L4 10Zm0 0v10h16V10M9 20v-5h6v5",
  refresh: "M4 12a8 8 0 0 1 13.7-5.7L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.7L4 15.5M4 20v-4.5h4.5",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6m-6 4h3",
  money: "M3 7h18v10H3V7Zm9 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM6 10v4m12-4v4",
  flame: "M12 3c1 3 4 4.5 4 8.5a4 4 0 0 1-8 0c0-1.5.6-2.6 1.5-3.5.2 1.5 1 2.5 2 2.5 0-3-1.5-5 .5-7.5Z",
  clock: "M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  inbox: "M4 13h4l1.5 3h5L16 13h4M4 13l2.5-8h11L20 13M4 13v6h16v-6",
  chat: "M4 5h16v11H9l-5 4V5Zm4 5h8m-8 3h5",
  cake: "M4 20h16M5 20v-7h14v7M8 13V9h8v4M12 9V5",
  check: "m5 12.5 4.5 4.5L19 7.5",
  arrow: "M5 12h14m-5-5 5 5-5 5",
  chart: "M4 19V5m0 14h16M8 15v-3m4 3V8m4 7v-5",
  truck: "M3 7h11v9H3V7Zm11 3h4l3 3v3h-7v-6ZM7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  users: "M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20m17 0v-1.5a4 4 0 0 0-3-3.87M14 3.2a4 4 0 0 1 0 7.6M9.5 10.8a3.8 3.8 0 1 0 0-7.6 3.8 3.8 0 0 0 0 7.6Z",
  card: "M3 6h18v12H3V6Zm0 4h18M7 15h4",
  alert: "M12 8v5m0 3.5v.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  sun: "M12 4V2m0 20v-2m8-8h2M2 12h2m13.7-5.7 1.4-1.4M4.9 19.1l1.4-1.4m0-11.4L4.9 4.9m14.2 14.2-1.4-1.4M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z",
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
    const [orders, delivered, notifications, reviews, cakes, report] = await Promise.all([
      safe(request("/admin/orders")),
      safe(request("/admin/orders?status=delivered")),
      safe(request("/admin/notifications")),
      safe(request("/admin/reviews?status=pending")),
      safe(request("/admin/cake-requests")),
      safe(request("/admin/reports")),
    ]);
    if (!orders && !notifications && !report) {
      setError(t("Unable to load the store overview. Check your connection and try again."));
    } else {
      setError("");
      setData({
        orders: orders?.orders || [],
        delivered: delivered?.orders || [],
        messages: notifications?.messages || [],
        unreadCount: notifications?.unreadCount || 0,
        reviews: reviews?.reviews || [],
        cakes: cakes?.requests || [],
        report,
      });
      setLastUpdated(new Date());
    }
    setIsLoading(false);
    setIsRefreshing(false);
  }, [sessionToken, t]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, REFRESH_MS);
    return () => window.clearInterval(timer);
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
      .sort((a, b) => (parseDate(a.createdAt)?.getTime() || 0) - (parseDate(b.createdAt)?.getTime() || 0))
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

  const hour = new Date().getHours();
  const greeting = t(hour < 12 ? "Good morning, {name}" : hour < 18 ? "Good afternoon, {name}" : "Good evening, {name}", {
    name: (currentAdmin?.name || "").split(/\s+/)[0] || "Admin",
  });
  const storeName = isOwner ? t("All stores") : t(currentAdmin?.storeName || "Store admin");

  if (isLoading) {
    return (
      <div aria-label={t("Loading…")} className="space-y-6" role="status">
        <div className="h-40 animate-pulse rounded-[24px] bg-[#eef2f6]" />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <div className="h-28 animate-pulse rounded-2xl bg-[#eef2f6]" key={item} />)}
        </div>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="h-80 animate-pulse rounded-[20px] bg-[#eef2f6]" />
          <div className="h-80 animate-pulse rounded-[20px] bg-[#eef2f6]" />
        </div>
      </div>
    );
  }

  const tasks = view ? [
    { key: "orders", count: view.processing.length, label: t("orders in the kitchen"), to: "/admin/orders", icon: icons.flame, tone: "bg-[#fff1dc] text-[#a86a00]" },
    { key: "payment", count: view.awaitingPayment.length, label: t("awaiting payment"), to: "/admin/orders", icon: icons.clock, tone: "bg-[#e9f1fa] text-[#315982]" },
    { key: "messages", count: data.unreadCount, label: t("unread messages"), to: "/admin/notifications", icon: icons.inbox, tone: "bg-[#efe9fb] text-[#5b3fa0]" },
    { key: "reviews", count: data.reviews.length, label: t("reviews to approve"), to: "/admin/reviews", icon: icons.chat, tone: "bg-[#e5f4ea] text-[#2c7a4f]" },
    { key: "cakes", count: view.newCakes, label: t("new cake requests"), to: "/admin/cake-requests", icon: icons.cake, tone: "bg-[#fff4c2] text-[#8a6f00]" },
  ] : [];
  const openTasks = tasks.filter((task) => task.count > 0);

  return (
    <div className="min-w-0 space-y-6">
      {/* Welcome banner */}
      <section className="relative isolate overflow-hidden rounded-[24px] bg-[#092a53] px-6 py-7 text-white shadow-[0_18px_40px_rgba(9,42,83,0.2)] sm:px-8">
        <div aria-hidden="true" className="absolute -right-20 -top-24 -z-10 size-72 rounded-full border-[48px] border-white/[0.05]" />
        <div aria-hidden="true" className="absolute -bottom-24 left-1/3 -z-10 size-64 rounded-full bg-[#ffdc32]/10 blur-3xl" />
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-white/65">
              <Icon className="size-4 text-[#ffdc32]" path={icons.sun} />
              {new Date().toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#35d07f] opacity-60 motion-reduce:hidden" />
                  <span className="relative inline-flex size-2 rounded-full bg-[#35d07f]" />
                </span>
                {lastUpdated ? t("Live · updated {time}", { time: relativeTime(lastUpdated, language) }) : t("Live")}
              </span>
            </p>
            <h1 className="mt-3 font-display text-3xl font-extrabold leading-tight sm:text-[2.4rem]">{greeting}</h1>
            <p className="mt-2 flex items-center gap-2 text-sm text-white/70">
              <Icon className="size-4" path={icons.store} />
              <span className="font-bold text-white">{storeName}</span>
              <span aria-hidden="true">·</span>
              {openTasks.length
                ? t("{count} things need your attention today.", { count: openTasks.reduce((sum, task) => sum + task.count, 0) })
                : t("Everything is under control.")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/15 disabled:cursor-wait disabled:opacity-60"
              disabled={isRefreshing}
              onClick={refresh}
              type="button"
            >
              <Icon className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} path={icons.refresh} />
              {t("Refresh")}
            </button>
            <Link className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#ffdc32] px-4 text-sm font-extrabold text-[#092a53] shadow-[0_8px_20px_rgba(255,220,50,0.25)] transition hover:-translate-y-0.5 hover:bg-[#ffe76c]" to="/admin/orders">
              {t("Open order queue")}
              <Icon path={icons.arrow} />
            </Link>
          </div>
        </div>
      </section>

      {error && (
        <p className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100" role="alert">
          <Icon className="mt-0.5 size-4 shrink-0" path={icons.alert} />
          {error}
        </p>
      )}

      {view && (
        <>
          {/* Needs attention */}
          <section aria-labelledby="attention-title">
            <h2 className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#8190a1]" id="attention-title">{t("Needs your attention")}</h2>
            {openTasks.length ? (
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {tasks.map((task) => (
                  <li key={task.key}>
                    <Link
                      className={`group flex h-full items-center gap-3 rounded-2xl border bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(18,44,80,0.07)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] ${task.count ? "border-[#e5ebf3]" : "border-dashed border-[#e5ebf3] opacity-60"}`}
                      to={task.to}
                    >
                      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${task.tone}`}><Icon path={task.icon} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-display text-2xl font-extrabold leading-none text-[#102c50]">{task.count}</span>
                        <span className="mt-1 block truncate text-xs font-semibold text-[#65748a]">{task.label}</span>
                      </span>
                      <Icon className="size-4 text-[#c3cfdc] transition group-hover:translate-x-0.5 group-hover:text-[#092a53]" path={icons.arrow} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center gap-3 rounded-2xl bg-[#eaf6ee] p-4 text-sm font-semibold text-[#1f5d3c] ring-1 ring-[#cfe8d8]">
                <span className="grid size-10 place-items-center rounded-xl bg-white text-[#2c7a4f]"><Icon path={icons.check} /></span>
                {t("You’re all caught up. New orders and messages will show up here.")}
              </div>
            )}
          </section>

          {/* KPIs */}
          <section aria-label={t("Today")} className="admin-stats grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              { label: t("Orders today"), value: view.todaysOrders.length.toLocaleString(locale), hint: t("{count} delivered", { count: view.deliveredToday.length }), icon: icons.receipt, accent: "bg-[#e9f1fa] text-[#315982]" },
              { label: t("Sales today"), value: money(view.todaySales), hint: t("Paid orders"), icon: icons.money, accent: "bg-[#e5f4ea] text-[#2c7a4f]" },
              { label: t("Paid orders in progress"), value: money(view.openRevenue), hint: t("{count} orders", { count: view.processing.length }), icon: icons.flame, accent: "bg-[#fff1dc] text-[#a86a00]" },
              { label: t("Last 7 days"), value: money(view.weekTotal), hint: t("Average {amount} per day", { amount: money(Math.round(view.weekTotal / 7)) }), icon: icons.chart, accent: "bg-[#efe9fb] text-[#5b3fa0]" },
            ].map((kpi) => (
              <article className="rounded-2xl border border-[#e5ebf3] bg-white p-4 sm:p-5" key={kpi.label}>
                <span className={`grid size-9 place-items-center rounded-xl ${kpi.accent}`}><Icon path={kpi.icon} /></span>
                <p className="mt-4 truncate font-display text-[1.6rem] font-extrabold leading-none tracking-tight text-[#102c50]">{kpi.value}</p>
                <p className="mt-1.5 text-xs font-semibold text-[#65748a]">{kpi.label}</p>
                <p className="mt-0.5 truncate text-[11px] text-[#a3b0bf]">{kpi.hint}</p>
              </article>
            ))}
          </section>

          <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-6">
              {/* Kitchen */}
              <section aria-labelledby="kitchen-title" className="rounded-[20px] border border-[#e5ebf3] bg-white">
                <header className="flex items-center justify-between gap-3 border-b border-[#edf1f5] p-4 sm:px-5">
                  <div>
                    <h2 className="font-display text-lg font-extrabold text-[#092a53]" id="kitchen-title">{t("Kitchen pipeline")}</h2>
                    <p className="text-xs text-[#65748a]">{t("Oldest orders first — keep them moving.")}</p>
                  </div>
                  <Link className="text-xs font-bold text-[#355777] underline decoration-[#ffdc32] decoration-2 underline-offset-4 hover:text-[#092a53]" to="/admin/orders">{t("View all")}</Link>
                </header>
                <ol className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4 sm:px-5">
                  {Object.keys(stageLabels).map((stage, index) => (
                    <li className="rounded-xl bg-[#f7f9fc] px-3 py-2.5 ring-1 ring-[#eef2f6]" key={stage}>
                      <p className="flex items-start gap-1.5 text-[11px] font-bold leading-tight text-[#65748a]">
                        <span className="grid size-5 shrink-0 place-items-center rounded-md bg-white text-[10px] font-extrabold text-[#355777] ring-1 ring-[#e3e9f0]">{index + 1}</span>
                        <span className="pt-0.5">{t(stageLabels[stage])}</span>
                      </p>
                      <p className="mt-1.5 font-display text-2xl font-extrabold text-[#092a53]">{view.stageCounts[stage] || 0}</p>
                    </li>
                  ))}
                </ol>
                {view.liveOrders.length ? (
                  <ul className="divide-y divide-[#f0f3f7] border-t border-[#edf1f5]">
                    {view.liveOrders.map((order) => {
                      const created = parseDate(order.createdAt);
                      const ageMinutes = created ? Math.round((Date.now() - created.getTime()) / 60000) : 0;
                      const stage = order.deliveryStage || order.fulfillmentStatus || "preparing";
                      return (
                        <li key={order.id}>
                          <Link className="flex items-center gap-3 px-4 py-3 transition hover:bg-[#fafbfd] sm:px-5" to="/admin/orders">
                            <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${ageMinutes > 45 ? "bg-[#fdecea] text-[#b2433a]" : "bg-[#f1f4f8] text-[#355777]"}`}>
                              <Icon path={order.fulfillmentType === "pickup" ? icons.store : icons.truck} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2 text-sm font-bold text-[#102c50]">
                                #{order.id}
                                <span className="truncate font-semibold text-[#4f6379]">{order.customerName}</span>
                              </span>
                              <span className="block truncate text-xs text-[#8190a1]">{order.items.map((item) => `${item.quantity}× ${item.flavorName}`).join(", ")}</span>
                            </span>
                            <span className="shrink-0 text-right">
                              <span className="block rounded-full bg-[#e9f1fa] px-2 py-0.5 text-[10px] font-bold text-[#245281]">{t(stageLabels[stage] || stage)}</span>
                              <span className={`mt-1 block text-[11px] font-semibold ${ageMinutes > 45 ? "text-[#b2433a]" : "text-[#a3b0bf]"}`}>{relativeTime(created, language)}</span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="border-t border-[#edf1f5] px-5 py-8 text-center text-sm text-[#8190a1]">{t("No paid orders in progress right now.")}</p>
                )}
              </section>

              {/* Weekly sales */}
              <section aria-labelledby="week-title" className="rounded-[20px] border border-[#e5ebf3] bg-white p-4 sm:p-5">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-extrabold text-[#092a53]" id="week-title">{t("Sales this week")}</h2>
                    <p className="text-xs text-[#65748a]">{t("{sales} from {orders} orders", { sales: money(view.weekTotal), orders: view.week.reduce((sum, day) => sum + day.orders, 0) })}</p>
                  </div>
                  <Link className="text-xs font-bold text-[#355777] underline decoration-[#ffdc32] decoration-2 underline-offset-4 hover:text-[#092a53]" to="/admin/reports">{t("Reports")}</Link>
                </div>
                <ol className="mt-5 flex h-36 items-end gap-2">
                  {view.week.map((day, index) => {
                    const isToday = index === view.week.length - 1;
                    return (
                      <li className="group relative flex h-full flex-1 flex-col items-center justify-end gap-1.5" key={day.key}>
                        <span className="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-lg bg-[#092a53] px-2.5 py-1.5 text-[11px] font-bold text-white shadow-lg group-hover:block">
                          {money(day.sales)} · {t("{count} orders", { count: day.orders })}
                        </span>
                        <span className="relative flex w-full flex-1 items-end rounded-lg bg-[#f4f6f9]">
                          <span
                            aria-label={`${day.date.toLocaleDateString(locale, { weekday: "long", timeZone: "UTC" })}: ${money(day.sales)}`}
                            className={`w-full rounded-lg transition-[height] duration-500 ${isToday ? "bg-[#ffdc32]" : "bg-[#092a53] group-hover:bg-[#1d4f80]"}`}
                            role="img"
                            style={{ height: `${day.sales ? Math.max(6, (day.sales / view.weekMax) * 100) : 0}%` }}
                          />
                        </span>
                        <span className={`text-[11px] font-bold ${isToday ? "text-[#8a7000]" : "text-[#a3b0bf]"}`}>
                          {day.date.toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" })}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </section>
            </div>

            <div className="min-w-0 space-y-6">
              {/* Cake pickups */}
              <section aria-labelledby="pickups-title" className="rounded-[20px] border border-[#e5ebf3] bg-white">
                <header className="flex items-center justify-between gap-3 border-b border-[#edf1f5] p-4 sm:px-5">
                  <h2 className="flex items-center gap-2 font-display text-lg font-extrabold text-[#092a53]" id="pickups-title">
                    <Icon className="size-5 text-[#8a7000]" path={icons.cake} />
                    {t("Cake pickups this week")}
                  </h2>
                  <Link className="text-xs font-bold text-[#355777] underline decoration-[#ffdc32] decoration-2 underline-offset-4 hover:text-[#092a53]" to="/admin/cake-requests">{t("View all")}</Link>
                </header>
                {view.upcomingCakes.length ? (
                  <ul className="divide-y divide-[#f0f3f7]">
                    {view.upcomingCakes.slice(0, 5).map((cake) => (
                      <li className="flex items-center gap-3 px-4 py-3 sm:px-5" key={cake.id}>
                        <span className={`grid w-12 shrink-0 place-items-center rounded-xl py-1.5 text-center ${cake.days <= 1 ? "bg-[#fff1dc] text-[#a86a00]" : "bg-[#f1f4f8] text-[#355777]"}`}>
                          <span className="text-[10px] font-extrabold uppercase">{cake.date.toLocaleDateString(locale, { month: "short" })}</span>
                          <span className="font-display text-lg font-extrabold leading-none">{cake.date.getDate()}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-[#102c50]">{cake.size} · {cake.flavor}</span>
                          <span className="block truncate text-xs text-[#8190a1]">{cake.customerName}</span>
                        </span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${cake.status === "confirmed" ? "bg-[#eaf6ee] text-[#246a46]" : cake.status === "contacted" ? "bg-[#e9f1fa] text-[#245281]" : "bg-[#fff6e5] text-[#9a6200]"}`}>
                          {t(cake.status)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-5 py-8 text-center text-sm text-[#8190a1]">{t("No cake pickups in the next 7 days.")}</p>
                )}
              </section>

              {/* Messages */}
              <section aria-labelledby="messages-title" className="rounded-[20px] border border-[#e5ebf3] bg-white">
                <header className="flex items-center justify-between gap-3 border-b border-[#edf1f5] p-4 sm:px-5">
                  <h2 className="flex items-center gap-2 font-display text-lg font-extrabold text-[#092a53]" id="messages-title">
                    <Icon className="size-5 text-[#5b3fa0]" path={icons.inbox} />
                    {t("Unread messages")}
                    {data.unreadCount > 0 && <span className="rounded-full bg-[#e5484d] px-1.5 text-[11px] font-extrabold text-white">{data.unreadCount}</span>}
                  </h2>
                  <Link className="text-xs font-bold text-[#355777] underline decoration-[#ffdc32] decoration-2 underline-offset-4 hover:text-[#092a53]" to="/admin/notifications">{t("Open inbox")}</Link>
                </header>
                {view.unreadMessages.length ? (
                  <ul className="divide-y divide-[#f0f3f7]">
                    {view.unreadMessages.map((message) => (
                      <li key={message.id}>
                        <Link className="block px-4 py-3 transition hover:bg-[#fafbfd] sm:px-5" to="/admin/notifications">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-sm font-extrabold text-[#102c50]">{message.name}</span>
                            <span className="shrink-0 text-[11px] text-[#a3b0bf]">{relativeTime(parseDate(message.createdAt), language)}</span>
                          </span>
                          <span className="block truncate text-xs font-semibold text-[#355777]">{message.subject}</span>
                          <span className="block truncate text-xs text-[#8190a1]">{message.message}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-5 py-8 text-center text-sm text-[#8190a1]">{t("You’re all caught up.")}</p>
                )}
              </section>

              {/* Reviews waiting */}
              {data.reviews.length > 0 && (
                <Link className="group flex items-center gap-4 rounded-[20px] border border-[#e5ebf3] bg-white p-4 transition hover:shadow-[0_12px_26px_rgba(18,44,80,0.07)] sm:px-5" to="/admin/reviews">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#fff4c2] text-[#8a7000]">
                    <svg aria-hidden="true" className="size-5" fill="currentColor" viewBox="0 0 24 24"><path d={STAR_PATH} /></svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-[#102c50]">{t("{count} reviews waiting for approval", { count: data.reviews.length })}</span>
                    <span className="block truncate text-xs text-[#8190a1]">“{data.reviews[0].review || data.reviews[0].itemName}” — {data.reviews[0].customerName}</span>
                  </span>
                  <Icon className="size-4 text-[#c3cfdc] transition group-hover:translate-x-0.5 group-hover:text-[#092a53]" path={icons.arrow} />
                </Link>
              )}

              {/* Quick links */}
              <section aria-labelledby="shortcuts-title">
                <h2 className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#8190a1]" id="shortcuts-title">{t("Shortcuts")}</h2>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { label: t("Delivered"), to: "/admin/delivered", icon: icons.check },
                    { label: t("Payments"), to: "/admin/payments", icon: icons.card },
                    { label: t("Customer accounts"), to: "/admin/customers", icon: icons.users },
                    { label: t("Reports"), to: "/admin/reports", icon: icons.chart },
                  ].map((shortcut) => (
                    <Link className="group flex items-center gap-2.5 rounded-xl bg-white p-3 text-sm font-bold text-[#102c50] ring-1 ring-[#e5ebf3] transition hover:-translate-y-0.5 hover:shadow-[0_10px_22px_rgba(18,44,80,0.07)]" key={shortcut.to} to={shortcut.to}>
                      <span className="grid size-8 place-items-center rounded-lg bg-[#f1f4f8] text-[#355777] transition group-hover:bg-[#ffdc32] group-hover:text-[#092a53]"><Icon path={shortcut.icon} /></span>
                      <span className="truncate">{shortcut.label}</span>
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
