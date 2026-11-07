import { useEffect, useState } from "react";
import { apiRequest, getCustomerToken } from "../../api/api";
import { useLanguage } from "../../language/useLanguage";
import { useCurrency } from "../../context/useCurrency";
import { formatOrderMoney } from "../../lib/cartPricing";

// Printable order invoice. Rendered as a self-contained document inside an
// overlay; "Download / print" opens the browser print dialog where the customer
// saves it as a PDF. Print styles hide everything except the invoice.

function money(cents, language, displayCurrency = "xaf") {
  return formatOrderMoney(cents, language, displayCurrency);
}

function formatDate(value, language) {
  if (!value) return "";
  const date = new Date(
    typeof value === "string" && !value.includes("T") ? `${value}Z` : value,
  );
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(language === "fr" ? "fr-CM" : "en-CM", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function InvoiceDocument({ order, t, language, displayCurrency = "xaf" }) {
  const itemCount =
    order.items?.reduce((count, item) => count + item.quantity, 0) || 0;
  const subtotal = order.subtotalCents ?? order.totalCents;
  const discount = order.discountCents ?? 0;
  const deliveryFee = order.deliveryFee ?? 0;
  const total = order.totalCents;
  const isPickup = order.fulfillmentType === "pickup";

  return (
    <div className="invoice-document bg-white p-6 text-brand-navy sm:p-10">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-brand-navy pb-5">
        <div className="flex items-center gap-3">
          <img
            alt=""
            aria-hidden="true"
            className="size-12 rounded-full"
            src="/logo.png"
          />
          <div>
            <p className="font-display text-xl font-extrabold leading-tight">
              Cold Stone Creamery
            </p>
            <p className="text-xs font-semibold text-[#65748a]">
              {t("Douala & Yaoundé, Cameroon")}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-yellow-deep">
            {t("Invoice")}
          </p>
          <p className="mt-1 font-display text-2xl font-extrabold tabular-nums">
            #{order.id}
          </p>
          <p className="mt-1 text-xs font-semibold text-[#65748a]">
            {t("Placed on {date}", {
              date: formatDate(order.createdAt, language),
            })}
          </p>
        </div>
      </header>

      <section className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
        <div className="rounded-xl bg-[#f4f6f8] p-4">
          <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#65748a]">
            {t("Billed to")}
          </p>
          <p className="mt-1.5 font-extrabold">{order.customerName}</p>
          <p className="text-[#65748a]">{order.customerEmail}</p>
          {order.customerPhone && (
            <p className="text-[#65748a]">{order.customerPhone}</p>
          )}
        </div>
        <div className="rounded-xl bg-[#f4f6f8] p-4">
          <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#65748a]">
            {t(isPickup ? "Pickup" : "Delivery")}
          </p>
          {order.storeName && (
            <p className="mt-1.5 font-extrabold">{t(order.storeName)}</p>
          )}
          {order.storeAddress && (
            <p className="text-[#65748a]">{t(order.storeAddress)}</p>
          )}
          {!isPickup && (order.deliveryResidence || order.deliveryCity) && (
            <p className="text-[#65748a]">
              {[order.deliveryResidence, order.deliveryCity]
                .filter(Boolean)
                .join(", ")}
            </p>
          )}
          {order.scheduledFor && (
            <p className="mt-1 text-[#65748a]">
              {t("Scheduled for {date}", {
                date: formatDate(order.scheduledFor, language),
              })}
            </p>
          )}
        </div>
      </section>

      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b border-[#dce3eb] text-left text-xs font-extrabold uppercase tracking-[0.1em] text-[#65748a]">
            <th className="py-2">{t("Item")}</th>
            <th className="py-2 text-center">{t("Qty")}</th>
            <th className="py-2 text-right">{t("Amount")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f4f6f8]">
          {(order.items || []).map((item, index) => (
            <tr key={`${item.name}-${index}`}>
              <td className="py-2.5 font-semibold">{t(item.name)}</td>
              <td className="py-2.5 text-center tabular-nums">
                {item.quantity}
              </td>
              <td className="py-2.5 text-right font-bold tabular-nums">
                {money(item.lineTotalCents, language, displayCurrency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="mt-5 ml-auto max-w-xs space-y-1.5 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="font-semibold text-[#65748a]">
            {t("{count} items", { count: itemCount })}
          </dt>
          <dd className="font-bold tabular-nums">
            {money(subtotal, language, displayCurrency)}
          </dd>
        </div>
        {discount > 0 && (
          <div className="flex justify-between gap-4 text-[#3f6b22]">
            <dt className="font-semibold">
              {order.discountCode
                ? t("Discount code {code}", { code: order.discountCode })
                : t("Discount")}
            </dt>
            <dd className="font-extrabold tabular-nums">
              −{money(discount, language, displayCurrency)}
            </dd>
          </div>
        )}
        {deliveryFee > 0 && (
          <div className="flex justify-between gap-4">
            <dt className="font-semibold text-[#65748a]">
              {t("Delivery fee")}
            </dt>
            <dd className="font-bold tabular-nums">
              {money(deliveryFee, language, displayCurrency)}
            </dd>
          </div>
        )}
        <div className="flex justify-between gap-4 border-t-2 border-brand-navy pt-2 text-base">
          <dt className="font-display font-extrabold">{t("Total")}</dt>
          <dd className="font-display font-extrabold tabular-nums">
            {money(total, language, displayCurrency)}
          </dd>
        </div>
      </dl>

      <p className="mt-8 border-t border-[#eef1f4] pt-4 text-center text-xs leading-5 text-[#8b95a2]">
        {t(
          "Thank you for your order! This invoice was generated by your Cold Stone Creamery account.",
        )}{" "}
        {t("Questions? Contact us and mention order #{id}.", { id: order.id })}
      </p>
    </div>
  );
}

/**
 * Button + overlay that fetches an order's invoice and offers it for print/PDF.
 * `orderId` is fetched from /api/customer/orders/:id (owner of the session).
 */
export function InvoiceButton({ orderId, className = "" }) {
  const { t, language } = useLanguage();
  const { currency: displayCurrency } = useCurrency();
  const [isOpen, setIsOpen] = useState(false);
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    document.body.classList.add("invoice-printing");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      document.body.classList.remove("invoice-printing");
    };
  }, [isOpen]);

  async function open() {
    setIsOpen(true);
    setError("");
    setOrder(null);
    setIsLoading(true);
    try {
      const result = await apiRequest(
        `/customer/orders/${encodeURIComponent(orderId)}`,
        // The token must travel with the fetch — without it the server sees an
        // anonymous caller and answers "Customer sign-in is required" even for
        // a signed-in customer trying to print their invoice.
        { token: getCustomerToken() },
      );
      setOrder(result.order);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load the invoice.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <button
        aria-haspopup="dialog"
        className={className}
        onClick={open}
        type="button"
      >
        <svg
          aria-hidden="true"
          className="size-4"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            d="M6 9V3h12v6M6 18H4v-6h16v6h-2M8 14h8v7H8v-7Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
        {t("Invoice")}
      </button>
      {isOpen && (
        <div
          className="fixed inset-0 z-[70] grid place-items-center px-4 py-6"
          role="presentation"
        >
          <button
            aria-label={t("Close")}
            className="absolute inset-0 bg-brand-navy/60 backdrop-blur-[2px]"
            onClick={() => setIsOpen(false)}
            tabIndex={-1}
            type="button"
          />
          <section
            aria-label={t("Invoice")}
            aria-modal="true"
            className="relative flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_30px_80px_rgba(9,42,83,0.35)]"
            role="dialog"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[#e5e9ee] px-5 py-3">
              <p className="font-display text-base font-extrabold text-brand-navy">
                {t("Order invoice")}
              </p>
              <div className="flex items-center gap-2">
                <button
                  className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-brand-navy px-3.5 text-xs font-bold text-white transition hover:bg-brand-blue"
                  onClick={() => window.print()}
                  type="button"
                >
                  <svg
                    aria-hidden="true"
                    className="size-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M12 16V4m0 12-4-4m4 4 4-4M5 20h14"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />
                  </svg>
                  {t("Download / print")}
                </button>
                <button
                  aria-label={t("Close")}
                  className="grid size-9 place-items-center rounded-lg text-[#65748a] transition hover:bg-[#f4f6f8] hover:text-brand-navy"
                  onClick={() => setIsOpen(false)}
                  type="button"
                >
                  <svg
                    aria-hidden="true"
                    className="size-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="m6 6 12 12M18 6 6 18"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeWidth="2"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <div className="overflow-y-auto p-1">
              {isLoading && (
                <div className="m-5 h-72 animate-pulse rounded-xl bg-[#f4f6f8]" />
              )}
              {error && (
                <p
                  className="m-5 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700"
                  role="alert"
                >
                  {error}
                </p>
              )}
              {order && (
                <InvoiceDocument displayCurrency={displayCurrency} language={language} order={order} t={t} />
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
