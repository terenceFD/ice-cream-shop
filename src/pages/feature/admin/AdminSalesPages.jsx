import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../../../api/api";
import { useAdminAuth } from "./AdminAuthContext";
import { useLanguage } from "../../../language/LanguageContext";
import { formatCartMoney, USD_TO_XAF } from "../../../cartPricing";

function formatMoney(cents, currency = "xaf", language = "en") {
  const amountXaf = currency.toLowerCase() === "usd"
    ? Math.round((cents / 100) * USD_TO_XAF)
    : cents;
  return formatCartMoney(amountXaf, "xaf", language);
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(`${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
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
  const { sessionToken } = useAdminAuth();
  const { t, language } = useLanguage();
  const [orders, setOrders] = useState([]);
  const [deliveredCount, setDeliveredCount] = useState(0);
  const [payments, setPayments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [deletingOrderId, setDeletingOrderId] = useState(null);
  const [isClearingDelivered, setIsClearingDelivered] = useState(false);

  const refresh = useCallback(async () => {
    setError("");
    try {
      if (view === "payments") {
        const result = await apiRequest("/admin/payments", {
          token: sessionToken,
        });
        setPayments(result.payments);
      } else {
        const path =
          view === "delivered"
            ? "/admin/orders?status=delivered"
            : "/admin/orders";
        const result = await apiRequest(path, { token: sessionToken });
        setOrders(result.orders);
        if (view === "delivered") {
          setDeliveredCount(result.count ?? result.orders.length);
        }
      }
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  }, [sessionToken, view]);

  useEffect(() => {
    refresh();
  }, [refresh]);

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

  async function clearDeliveredOrders() {
    if (deliveredCount < 5 || isClearingDelivered) return;
    if (!window.confirm(t(
      "Clear all {count} delivered orders? This permanently deletes their order, payment, loyalty, and review history.",
      { count: deliveredCount },
    ))) return;

    setError("");
    setIsClearingDelivered(true);
    try {
      await apiRequest("/admin/orders/delivered", {
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
          {isDeliveredView && (
            <>
              <span className="rounded-full bg-green-100 px-4 py-2 text-sm font-bold text-green-900" role="status">
                {t("Delivered orders: {count}", { count: deliveredCount })}
              </span>
              <button
                className="rounded-full border border-red-300 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isLoading || deliveredCount < 5 || isClearingDelivered}
                onClick={clearDeliveredOrders}
                type="button"
              >
                {isClearingDelivered ? t("Clearing…") : t("Clear all delivered orders")}
              </button>
            </>
          )}
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

      {error && (
        <p
          className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {error}
        </p>
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
                {payment.paymentIntentId && (
                  <p className="mt-3 break-all border-t border-[#d9d6cc] pt-3 text-xs text-[#65748a]">
                    {t("Stripe payment: {id}", { id: payment.paymentIntentId })}
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
      ) : (
        <div className="mt-6 space-y-4">
          {orders.map((order) => (
            <article
              className="rounded-2xl border border-[#d9d6cc] bg-white p-4 sm:p-5"
              key={order.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
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
                <span className="font-display text-2xl font-bold text-[#bd9c00]">
                  {formatMoney(order.totalCents, order.currency, language)}
                </span>
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
                    {t("Delivery location")}
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
  return <AdminSalesView view="payments" />;
}
