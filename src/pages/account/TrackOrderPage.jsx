import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiRequest } from "../../api/api";
import { Footer, Header } from "../../components/Layout";
import { useLanguage } from "../../language/useLanguage";

const inputClassName =
  "mt-2 w-full rounded-2xl border border-[#e3dfd3] bg-[#fbfaf5] px-4 py-3.5 text-sm font-semibold text-brand-navy transition placeholder:font-medium placeholder:text-[#9aa3af] hover:border-[#cfcabb] focus:border-brand-yellow-deep focus:bg-white focus:ring-4 focus:ring-brand-yellow/25 outline-none!";
const labelClassName = "block text-xs font-extrabold text-[#65748a]";

const icons = {
  arrow: "M5 12h14m-5-5 5 5-5 5",
  check: "m5 12.5 4.5 4.5L19 7.5",
  info: "M12 11v5m0-8.5v.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  search: "M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Zm5.3-.2L21 21",
  bag: "M6 7h12l-1 13H7L6 7Zm3 0V6a3 3 0 0 1 6 0v1",
  calendar: "M5 6h14v14H5V6Zm0 4h14M9 4v4m6-4v4",
  pin: "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
};

function Icon({ path, className = "size-[18px]" }) {
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
        strokeWidth="1.8"
      />
    </svg>
  );
}

// Order statuses, in the order an order moves through them.
const STATUS_STEPS = [
  { label: "Being prepared" },
  { label: "Ready" },
  { label: "Out for delivery" },
  { label: "Delivered" },
];

const DONE_STATUSES = ["delivered", "completed", "picked_up"];

function formatDate(value, language) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(language === "fr" ? "fr-CM" : "en-CM", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatMoney(cents, language) {
  return new Intl.NumberFormat(language === "fr" ? "fr-CM" : "en-CM", {
    style: "currency",
    currency: "XAF",
    maximumFractionDigits: 0,
  }).format(Number(cents) || 0);
}

// Maps the order status stored by the store to a step in STATUS_STEPS.
function statusIndexFromStatus(status) {
  if (DONE_STATUSES.includes(status)) return STATUS_STEPS.length - 1;
  if (status === "out_for_delivery") return 2;
  if (status === "ready") return 1;
  return 0;
}

function OrderResult({ order, t, language }) {
  const isPickup = order.fulfillmentType === "pickup";
  const statusIndex = statusIndexFromStatus(order.status);
  const isDone =
    DONE_STATUSES.includes(order.status) || order.status === "paid";
  return (
    <section
      aria-live="polite"
      className="overflow-hidden rounded-[28px] bg-white shadow-[0_18px_50px_rgba(18,44,80,0.09)] ring-1 ring-[#fbfaf5]"
    >
      <div className="bg-brand-navy px-6 py-6 text-white sm:px-8">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-yellow">
          {t("Order #{id}", { id: order.id })}
        </p>
        <h2 className="mt-1 font-display text-2xl font-extrabold">
          {t(isDone ? "Delivered" : "On its way")}
        </h2>
        <p className="mt-2 text-sm text-white/70">
          {t("Placed on {date}", {
            date: formatDate(order.createdAt, language),
          })}
        </p>
      </div>

      <div className="space-y-6 p-6 sm:p-8">
        <dl className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[20px] bg-[#fbfaf5] p-4">
            <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#8b95a2]">
              {t("Status")}
            </dt>
            <dd className="mt-1 text-sm font-extrabold text-brand-navy">
              {isDone ? t("Delivered") : t(STATUS_STEPS[statusIndex].label)}
            </dd>
          </div>
          <div className="rounded-[20px] bg-[#fbfaf5] p-4">
            <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#8b95a2]">
              {t("Total")}
            </dt>
            <dd className="mt-1 text-sm font-extrabold tabular-nums text-brand-navy">
              {formatMoney(order.totalCents, language)}
            </dd>
          </div>
          <div className="rounded-[20px] bg-[#fbfaf5] p-4">
            <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#8b95a2]">
              {t(isPickup ? "Pickup" : "Delivery")}
            </dt>
            <dd className="mt-1 text-sm font-extrabold text-brand-navy">
              {t(order.storeName || "")}
            </dd>
          </div>
        </dl>

        <div className="flex flex-col gap-3 rounded-[20px] bg-[#f4f6f8] p-4 sm:flex-row sm:items-center">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-brand-navy shadow-sm">
            <Icon path={icons.calendar} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-brand-navy">
              {t("Scheduled for {date}", {
                date: formatDate(order.scheduledFor, language),
              })}
            </p>
            <p className="mt-0.5 text-xs leading-5 text-[#65748a]">
              {isPickup
                ? t("Collect your order at {store}", {
                    store: t(order.storeName || ""),
                  })
                : t("We will bring it to your address in {city}.", {
                    city: t(order.deliveryCity || ""),
                  })}
            </p>
          </div>
        </div>

        {order.items?.length > 0 && (
          <ul className="space-y-2.5">
            {order.items.map((item, index) => (
              <li
                className="flex items-center gap-3 text-sm"
                key={`${item.name}-${index}`}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#fbfaf5] text-[#65748a]">
                  <Icon className="size-4" path={icons.bag} />
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold text-brand-navy">
                  {item.quantity} × {t(item.name)}
                </span>
                <span className="shrink-0 font-extrabold tabular-nums text-brand-navy">
                  {formatMoney(item.lineTotalCents, language)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className="flex gap-3 rounded-2xl bg-[#fffbea] px-4 py-3.5 text-xs leading-5 text-[#6b5800] ring-1 ring-[#f0e2a0]">
          <Icon className="mt-0.5 size-4 shrink-0" path={icons.info} />
          <span>
            {t(
              "Questions about this order? Contact us and mention your order number.",
            )}
          </span>
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-brand-yellow px-6 py-3.5 text-sm font-extrabold text-brand-navy shadow-[0_12px_26px_rgba(255,220,50,0.35)] transition hover:-translate-y-0.5 hover:bg-brand-gold-light"
            to="/contact"
          >
            {t("Contact support")}{" "}
            <Icon className="size-4" path={icons.arrow} />
          </Link>
          <Link
            className="flex flex-1 items-center justify-center rounded-full px-6 py-3.5 text-sm font-extrabold text-brand-navy ring-1 ring-[#dcd8cc] transition hover:bg-[#fbfaf5] hover:ring-brand-navy"
            to="/flavors"
          >
            {t("Continue shopping")}
          </Link>
        </div>
      </div>
    </section>
  );
}

// Lets a guest look up an order placed without an account, using the order number and the
// email address typed at checkout.
export function TrackOrderPage() {
  const { t, language } = useLanguage();
  const [searchParams] = useSearchParams();
  const [orderId, setOrderId] = useState(() => searchParams.get("order") || "");
  const [email, setEmail] = useState("");
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setOrder(null);
    setIsSearching(true);
    try {
      const result = await apiRequest("/orders/track", {
        method: "POST",
        body: { orderId: orderId.replace(/^#/, "").trim(), email },
      });
      setOrder(result.order);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#fbfaf5] text-brand-navy">
      <Header />

      <main id="main" tabIndex={-1}>
        <section className="relative isolate overflow-hidden bg-brand-navy px-5 pb-16 pt-9 text-white sm:px-8 sm:pb-20 sm:pt-12 lg:px-12">
          <div
            aria-hidden="true"
            className="absolute -right-32 -top-44 -z-10 size-[30rem] rounded-full border-[64px] border-white/[0.04]"
          />
          <div className="mx-auto max-w-[1240px]">
            <nav
              aria-label={t("Breadcrumb")}
              className="text-xs font-semibold text-white/55"
            >
              <Link className="transition hover:text-brand-yellow" to="/">
                {t("Home")}
              </Link>
              <span aria-hidden="true" className="mx-2">
                /
              </span>
              <span aria-current="page" className="text-white">
                {t("Track your order")}
              </span>
            </nav>
            <p className="mt-6 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.2em] text-brand-yellow before:h-px before:w-6 before:bg-brand-yellow/70">
              {t("Order tracking")}
            </p>
            <h1 className="mt-3 font-display text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-[3.4rem]">
              {t("Track your order")}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/65 sm:text-base">
              {t(
                "No account needed. Enter your order number and the email you used at checkout.",
              )}
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-[760px] px-5 py-8 sm:px-8 sm:py-12">
          <form
            className="rounded-[28px] bg-white p-5 shadow-[0_10px_30px_rgba(18,44,80,0.05)] ring-1 ring-[#fbfaf5] sm:p-8"
            onSubmit={handleSubmit}
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <label className={labelClassName}>
                {t("Order number")}
                <input
                  autoComplete="off"
                  className={inputClassName}
                  inputMode="numeric"
                  name="orderId"
                  onChange={(event) => setOrderId(event.target.value)}
                  placeholder="#1234"
                  required
                  value={orderId}
                />
              </label>
              <label className={labelClassName}>
                {t("Email address")}
                <input
                  autoComplete="email"
                  className={inputClassName}
                  name="email"
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  type="email"
                  value={email}
                />
              </label>
            </div>
            {error && (
              <p
                className="mt-4 flex items-start gap-2 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700 ring-1 ring-red-100"
                role="alert"
              >
                <Icon className="mt-0.5 size-4 shrink-0" path={icons.info} />
                {error}
              </p>
            )}
            <button
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-yellow px-6 py-3.5 text-sm font-extrabold text-brand-navy shadow-[0_12px_26px_rgba(255,220,50,0.35)] transition hover:-translate-y-0.5 hover:bg-brand-gold-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2 disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-[#ecebe5] disabled:text-[#8b95a2] disabled:shadow-none sm:w-auto"
              disabled={isSearching || !orderId.trim() || !email.trim()}
              type="submit"
            >
              <Icon className="size-4" path={icons.search} />
              {isSearching ? t("Looking up your order…") : t("Find my order")}
            </button>
            <p className="mt-4 text-xs leading-5 text-[#8b95a2]">
              {t("Have an account?")}{" "}
              <Link
                className="font-extrabold text-brand-yellow-deep underline-offset-4 hover:underline"
                to="/login"
              >
                {t("Log in")}
              </Link>{" "}
              {t("to see every order in one place.")}
            </p>
          </form>

          {order && (
            <div className="mt-6">
              <OrderResult language={language} order={order} t={t} />
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
