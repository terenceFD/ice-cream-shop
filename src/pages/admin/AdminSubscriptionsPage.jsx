import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../../api/api";
import { useLanguage } from "../../language/useLanguage";
import { useAdminAuth } from "./useAdminAuth";
import { AdminIcon, AdminNotice, AdminPageHeader } from "./AdminPageHeader";
import { adminIcons } from "./adminIcons";
import { formatOrderMoney } from "../../lib/cartPricing";

/**
 * Subscriptions desk: every recurring ice cream plan customers have started,
 * with the next delivery date and the actions to pause, resume, complete or
 * cancel a plan. Store-scoped admins see only their town's subscribers.
 */

const SUBSCRIPTION_STATUSES = ["active", "paused", "cancelled", "completed"];

function useAdminRequest() {
  const { sessionToken } = useAdminAuth();
  return useCallback(
    (path, options = {}) =>
      apiRequest(path, { ...options, token: sessionToken }),
    [sessionToken],
  );
}

const statusBadgeClass = {
  active: "bg-[#eef6e8] text-[#3f6b22]",
  paused: "bg-[#fff3b0] text-brand-yellow-deep",
  cancelled: "bg-[#f4f6f8] text-[#65748a]",
  completed: "bg-[#eef2f7] text-[#65748a]",
};

export function AdminSubscriptionsPage() {
  const request = useAdminRequest();
  const { t, language } = useLanguage();
  const [subscriptions, setSubscriptions] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState(0);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const result = await request(
        statusFilter
          ? `/admin/subscriptions?status=${statusFilter}`
          : "/admin/subscriptions",
      );
      setSubscriptions(result.subscriptions || []);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : t("Subscriptions could not be loaded."),
      );
    } finally {
      setIsLoading(false);
    }
  }, [request, statusFilter, t]);

  useEffect(() => {
    setIsLoading(true);
    refresh();
  }, [refresh]);

  async function setStatus(subscription, status) {
    setBusyId(subscription.id);
    try {
      await request(`/admin/subscriptions/${subscription.id}/status`, {
        method: "PATCH",
        body: { status },
      });
      await refresh();
    } catch (changeError) {
      setError(
        changeError instanceof Error
          ? changeError.message
          : t("The subscription could not be updated."),
      );
    } finally {
      setBusyId(0);
    }
  }

  return (
    <div className="min-w-0 space-y-4">
      <AdminPageHeader
        description={t(
          "Recurring ice cream plans. Subscribers are charged per delivery; pause or complete a plan from here.",
        )}
        section={t("Sales")}
        title={t("Subscriptions")}
        t={t}
      />

      {error && <AdminNotice tone="error">{error}</AdminNotice>}

      <div className="flex flex-wrap items-center gap-2">
        {[
          { value: "", label: t("All") },
          ...SUBSCRIPTION_STATUSES.map((status) => ({
            value: status,
            label: t(status),
          })),
        ].map((option) => (
          <button
            className={`rounded-full px-3.5 py-2 text-xs font-bold transition ${
              statusFilter === option.value
                ? "bg-brand-navy text-white"
                : "bg-white text-[#65748a] ring-1 ring-[#dce3eb] hover:text-brand-navy"
            }`}
            key={option.value || "all"}
            onClick={() => setStatusFilter(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-md border border-[#dce3eb] bg-white">
        {isLoading ? (
          <p className="px-4 py-8 text-center text-sm text-[#65748a]">
            {t("Loading…")}
          </p>
        ) : subscriptions.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[#65748a]">
            {t("No subscriptions in this view yet.")}
          </p>
        ) : (
          <ul className="divide-y divide-[#f4f6f8]">
            {subscriptions.map((subscription) => (
              <li
                className="flex flex-wrap items-center gap-3 px-4 py-3.5"
                key={subscription.id}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#fff6cc] text-brand-yellow-deep">
                  <AdminIcon className="size-5" path={adminIcons.box} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-brand-navy">
                    {subscription.flavorName} · {subscription.quantity}× ·{" "}
                    {formatOrderMoney(
                      subscription.perDeliveryCents,
                      language,
                      "xaf",
                    )}
                    {t("per delivery")}
                  </p>
                  <p className="truncate text-xs text-[#65748a]">
                    {subscription.customerName} ({subscription.customerEmail}) ·{" "}
                    {t("Next: {date}", { date: subscription.nextDeliveryDate })}{" "}
                    · {subscription.plan}
                    {subscription.storeName
                      ? ` · ${subscription.storeName}`
                      : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${statusBadgeClass[subscription.status] || statusBadgeClass.cancelled}`}
                >
                  {t(subscription.status)}
                </span>
                <div className="flex shrink-0 gap-1.5">
                  {subscription.status === "paused" && (
                    <button
                      className="rounded-md bg-brand-navy px-3 py-2 text-xs font-bold text-white transition hover:bg-brand-blue disabled:opacity-50"
                      disabled={busyId === subscription.id}
                      onClick={() => setStatus(subscription, "active")}
                      type="button"
                    >
                      {t("Resume")}
                    </button>
                  )}
                  {subscription.status === "active" && (
                    <>
                      <button
                        className="rounded-md border border-[#d5dce5] bg-white px-3 py-2 text-xs font-bold text-[#65748a] transition hover:border-brand-navy hover:text-brand-navy disabled:opacity-50"
                        disabled={busyId === subscription.id}
                        onClick={() => setStatus(subscription, "paused")}
                        type="button"
                      >
                        {t("Pause")}
                      </button>
                      <button
                        className="rounded-md border border-[#d5dce5] bg-white px-3 py-2 text-xs font-bold text-[#65748a] transition hover:border-brand-navy hover:text-brand-navy disabled:opacity-50"
                        disabled={busyId === subscription.id}
                        onClick={() => setStatus(subscription, "completed")}
                        type="button"
                      >
                        {t("Mark completed")}
                      </button>
                    </>
                  )}
                  {["active", "paused"].includes(subscription.status) && (
                    <button
                      className="rounded-md border border-[#e3c8c6] bg-white px-3 py-2 text-xs font-bold text-[#a34d4d] transition hover:bg-[#fdf0ef] disabled:opacity-50"
                      disabled={busyId === subscription.id}
                      onClick={() => setStatus(subscription, "cancelled")}
                      type="button"
                    >
                      {t("Cancel")}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
