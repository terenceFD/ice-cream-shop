import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { Footer, Header } from "../../../components/Layout";
import { useCart } from "../../../CartContext";
import { useFlavors } from "../../../flavor-context/FlavorContext";
import {
  formatCartMoney,
  getCartPricing,
  USD_TO_XAF,
} from "../../../cartPricing";
import { apiRequest, CUSTOMER_TOKEN_KEY } from "../../../api/api";
import { useLanguage } from "../../../language/LanguageContext";

const CHECKOUT_DETAILS_KEY = "antixor-icy-checkout-details";
const paymentMethods = [
  {
    id: "card",
    label: "Card",
    detail: "Pay securely with a credit or debit card through Stripe.",
    available: true,
    icon: "💳",
  },
  {
    id: "mtn",
    label: "MTN Mobile Money",
    detail: "Mobile Money payments for supported MTN locations.",
    available: false,
    icon: "📱",
  },
  {
    id: "orange",
    label: "Orange Money",
    detail: "Mobile Money payments for supported Orange locations.",
    available: false,
    icon: "📲",
  },
  {
    id: "crypto",
    label: "Crypto",
    detail: "Cryptocurrency payments are not connected yet.",
    available: false,
    icon: "₿",
  },
];

function formatMoney(cents, currency = "xaf", language = "en") {
  const amountXaf = currency.toLowerCase() === "usd"
    ? Math.round((cents / 100) * USD_TO_XAF)
    : cents;
  return formatCartMoney(amountXaf, "xaf", language);
}

export function PaymentPage() {
  const { cartItems, clearCart } = useCart();
  const { refreshFlavors } = useFlavors();
  const { t, language } = useLanguage();
  const { currency, subtotal, freeScoops, discount, total } = getCartPricing(cartItems);
  const hasMenuItems = cartItems.some((item) => item.itemType === "menu");
  const hasUnavailableItems = cartItems.some(
    (item) => item.availableQuantity < item.quantity,
  );
  const { state } = useLocation();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const loyaltyOrderId = searchParams.get("loyalty_order_id");
  const cancelled = searchParams.get("cancelled") === "1";
  const [checkoutDetails] = useState(() => {
    if (state?.checkoutDetails) return state.checkoutDetails;
    try {
      return JSON.parse(sessionStorage.getItem(CHECKOUT_DETAILS_KEY) || "null");
    } catch {
      return null;
    }
  });
  const codeDiscount = Number(checkoutDetails?.discountAmount || 0);
  const loyaltyDiscount = checkoutDetails?.redeemLoyaltyPoints
    ? Number(checkoutDetails?.loyaltyPointsToRedeem || 0) * 10
    : 0
  const deliveryFee = Number(checkoutDetails?.deliveryFee || 0)
  const finalTotal = Math.max(0, Math.round(total - codeDiscount - loyaltyDiscount + deliveryFee));
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("card");
  const [paymentStatus, setPaymentStatus] = useState(
    sessionId ? "checking" : "ready",
  );
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sessionId && !loyaltyOrderId) return undefined;
    let cancelledRequest = false;
    setPaymentStatus("checking");
    const verification = sessionId
      ? apiRequest(`/payment/session/${encodeURIComponent(sessionId)}`)
      : apiRequest(`/customer/orders/${encodeURIComponent(loyaltyOrderId)}`, {
          token: sessionStorage.getItem(CUSTOMER_TOKEN_KEY),
        })
    verification
      .then(({ order: paidOrder }) => {
        if (cancelledRequest) return;
        setOrder(paidOrder);
        setPaymentStatus("paid");
        window.scrollTo(0, 0);
        sessionStorage.removeItem(CHECKOUT_DETAILS_KEY);
        clearCart();
        refreshFlavors({ showLoading: false });
      })
      .catch((verifyError) => {
        if (cancelledRequest) return;
        setError(verifyError.message);
        setPaymentStatus("unverified");
      });
    return () => {
      cancelledRequest = true;
    };
  }, [clearCart, loyaltyOrderId, refreshFlavors, sessionId]);

  if (!sessionId && !loyaltyOrderId && cartItems.length === 0 && !cancelled) {
    return <Navigate to="/cart" replace />;
  }
  if (!sessionId && !loyaltyOrderId && !checkoutDetails && !cancelled) {
    return <Navigate to="/checkout" replace />;
  }

  async function startCheckout() {
    setError("");
    setIsStartingCheckout(true);
    try {
      const { url } = await apiRequest("/checkout/session", {
        method: "POST",
        body: {
          items: cartItems.map(({ id, quantity }) => ({ id, quantity })),
          checkoutDetails,
          discountCode: checkoutDetails?.discountCode || "",
          redeemLoyaltyPoints: checkoutDetails?.redeemLoyaltyPoints === true,
        },
        token: sessionStorage.getItem(CUSTOMER_TOKEN_KEY) || undefined,
      });
      sessionStorage.setItem(
        CHECKOUT_DETAILS_KEY,
        JSON.stringify(checkoutDetails),
      );
      window.location.assign(url);
    } catch (checkoutError) {
      setError(checkoutError.message);
      setIsStartingCheckout(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f7f2] text-[#102c50]">
      <Header />

      <main className="mx-auto max-w-[1160px] px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
        {paymentStatus === "paid" ? (
          <section aria-live="polite" className="mx-auto max-w-2xl rounded-[28px] border border-[#dce9c8] bg-white p-6 text-center shadow-[0_8px_30px_rgba(18,44,80,0.05)] sm:p-10" role="status">
            <span
              aria-hidden="true"
              className="mx-auto grid size-16 place-items-center rounded-full bg-[#d8f29a] text-3xl font-bold text-[#163e35]"
            >
              ✓
            </span>
            <p className="mt-5 inline-block rounded-full bg-[#d8f29a] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#163e35]">
              {t("Payment confirmed")}
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">
              {t("Thank you, {name}!", { name: order?.customerName })}
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#65748a]">
              {t(
                "Your payment was confirmed. Order #{id} is being prepared for {email}.",
                { id: order?.id, email: order?.customerEmail },
              )}
            </p>
            <p className="mt-2 font-display text-2xl font-bold">
              {formatMoney(order?.totalCents || 0, order?.currency, language)}
            </p>
            <Link
              className="mt-7 inline-flex rounded-full bg-[#ffdc32] px-6 py-3 font-bold transition hover:bg-[#ffe76c]"
              to="/flavors"
            >
              {t("Continue shopping")}
            </Link>
          </section>
        ) : paymentStatus === "checking" ? (
          <section className="mx-auto max-w-2xl rounded-[28px] border border-[#d9d6cc] bg-white p-8 text-center">
            <p className="font-display text-2xl font-bold">
              {t("Checking your payment…")}
            </p>
            <p className="mt-2 text-sm text-[#65748a]">
              {t("Please wait while Stripe confirms the transaction.")}
            </p>
          </section>
        ) : paymentStatus === "unverified" ? (
          <section className="mx-auto max-w-2xl rounded-[28px] border border-[#f0d0c8] bg-white p-6 sm:p-8">
            <p className="inline-block rounded-full bg-red-100 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-red-800">
              {t("Payment not confirmed")}
            </p>
            <h1 className="mt-3 font-display text-3xl font-bold">
              {t("We could not verify this payment")}
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#65748a]">{error}</p>
            <p className="mt-3 text-sm leading-6 text-[#65748a]">
              {t(
                "Your order has not been marked as paid. If your bank shows a charge, please contact us before trying again.",
              )}
            </p>
            <Link
              className="mt-6 inline-flex rounded-full border-2 border-[#65748a] px-5 py-2.5 text-sm font-bold transition hover:bg-[#f4f1e7]"
              to="/contact"
            >
              {t("Contact support")}
            </Link>
          </section>
        ) : (
          <>
            <Link
              to="/checkout"
              state={{ checkoutDetails }}
              className="text-sm font-semibold text-[#65748a] transition hover:text-[#102c50]"
            >
              ← {t("Back to delivery details")}
            </Link>
            <div className="mb-8 mt-6">
              <p className="mb-2 inline-block rounded-full bg-[#ffeb9c] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em]">
                {t("Final step")}
              </p>
              <h1 className="font-display text-5xl font-bold tracking-tight sm:text-6xl">
                {t("Payment")}
              </h1>
              <p className="mt-2 text-sm text-[#65748a]">
                {t("Choose a payment method available for your location.")}
              </p>
              <p className="mt-3 rounded-xl border border-[#eadb8a] bg-[#fff9dc] px-4 py-3 text-sm leading-6 text-[#624f00]">
                {t(hasMenuItems
                  ? "Menu items and FCFA prices are illustrative examples, not confirmed local menu items or prices. Orders are handled by this independent website."
                  : "Items and prices in the online catalog are set in FCFA by this website's operator and are not verified Cold Stone Cameroon products, menu prices or promotions.")}
              </p>
            </div>

            {cancelled && (
              <p
                className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
                role="status"
              >
                {t(
                  "Checkout was cancelled. No payment was taken; you can try again when you are ready.",
                )}
              </p>
            )}

            <div className="grid items-start gap-8 lg:grid-cols-[1fr_380px]">
              <section className="space-y-6 rounded-[24px] border border-[#d9d6cc] bg-white p-5 shadow-[0_8px_30px_rgba(18,44,80,0.05)] sm:p-7">
                <div className="border-b border-[#d9d6cc] pb-6">
                  <h2 className="font-display text-2xl font-bold">
                    {t(checkoutDetails?.fulfillmentType === 'pickup' ? 'Pickup at' : 'Delivering to')}
                  </h2>
                  <p className="mt-2 text-sm font-semibold">
                    {checkoutDetails?.name}
                  </p>
                  <p className="mt-1 text-sm text-[#65748a]">
                    {checkoutDetails?.residence ? `${checkoutDetails.residence}, ` : ''}
                    {checkoutDetails?.city}
                  </p>
                  {checkoutDetails?.scheduledDate && <p className="mt-1 text-sm text-[#65748a]">{t('Scheduled date')}: {checkoutDetails.scheduledDate} · {t(checkoutDetails.timeSlotLabel)}</p>}
                  <p className="mt-1 text-sm text-[#65748a]">
                    {checkoutDetails?.email}
                  </p>
                </div>

                <fieldset>
                  <legend className="font-display text-2xl font-bold">
                    {t("Choose payment method")}
                  </legend>
                  <div className="mt-4 space-y-3">
                    {paymentMethods.map((method) => (
                      <label
                        className={`flex items-start gap-3 rounded-2xl border p-4 transition ${
                          method.available
                            ? "cursor-pointer border-[#d9d6cc] hover:border-[#bd9c00] has-[:checked]:border-[#bd9c00] has-[:checked]:bg-[#fff9dc]"
                            : "cursor-not-allowed border-[#d9d6cc] bg-[#f8f7f2] opacity-75"
                        }`}
                        key={method.id}
                      >
                        <input
                          checked={selectedPaymentMethod === method.id}
                          className="mt-1 accent-[#bd9c00] disabled:cursor-not-allowed"
                          disabled={!method.available}
                          name="paymentMethod"
                          onChange={() => setSelectedPaymentMethod(method.id)}
                          type="radio"
                          value={method.id}
                        />
                        <span aria-hidden="true" className="mt-0.5 text-xl">
                          {method.icon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-bold">
                              {t(method.label)}
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${
                                method.available
                                  ? "bg-[#d8f29a] text-[#163e35]"
                                  : "bg-[#e9e7df] text-[#65748a]"
                              }`}
                            >
                              {t(
                                method.available ? "Available" : "Coming soon",
                              )}
                            </span>
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-[#65748a]">
                            {t(method.detail)}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="mt-3 text-xs leading-5 text-[#65748a]">
                    {t(
                      "Card details are entered on Stripe’s secure checkout and are never stored by this website.",
                    )}
                  </p>
                </fieldset>

                {error && (
                  <p
                    className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
                    role="alert"
                  >
                    {error}
                  </p>
                )}
                <button
                  className="w-full rounded-full bg-[#ffdc32] px-6 py-4 text-lg font-bold text-[#102c50] transition hover:-translate-y-0.5 hover:bg-[#ffe76c] disabled:cursor-wait disabled:opacity-60"
                  disabled={
                    isStartingCheckout ||
                    cartItems.length === 0 ||
                    hasUnavailableItems
                  }
                  onClick={startCheckout}
                  type="button"
                >
                  {isStartingCheckout
                    ? t("Connecting to Stripe…")
                    : t("Pay {amount} securely", {
                        amount: formatMoney(
                          finalTotal,
                          currency,
                          language,
                        ),
                      })}
                </button>
                {hasUnavailableItems && (
                  <p className="text-sm text-red-700" role="alert">
                    {t("Stock changed while you were checking out.")}{" "}
                    <Link className="font-bold underline" to="/cart">
                      {t("Review your bag")}
                    </Link>{" "}
                    {t("before paying.")}
                  </p>
                )}
              </section>

              <aside className="h-fit space-y-4 rounded-[28px] border border-[#d9d6cc] bg-white p-6 shadow-[0_8px_30px_rgba(18,44,80,0.06)]">
                <h2 className="font-display text-2xl font-bold">
                  {t("Order summary")}
                </h2>
                <div className="space-y-4 border-t border-[#d9d6cc] pt-4">
                  {cartItems.map((item) => (
                    <div className="flex items-center gap-3" key={item.id}>
                      <img
                        alt=""
                        className="checkout-item-image rounded-xl bg-[#f4f1e7]"
                        src={item.image}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">
                          {t(item.name)}
                        </p>
                        <p className="text-xs text-[#65748a]">
                          {t("Qty: {quantity}", { quantity: item.quantity })}
                        </p>
                      </div>
                      <span className="shrink-0 whitespace-nowrap text-sm font-semibold">
                        {formatMoney(
                          Math.round(item.price * item.quantity),
                          currency,
                          language,
                        )}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="space-y-3 border-t border-[#d9d6cc] pt-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#65748a]">{t("Subtotal")}</span>
                    <span className="font-semibold">
                      {formatMoney(Math.round(subtotal), currency, language)}
                    </span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-[#163e35]">
                      <span className="font-semibold">
                        {t("Buy 2 Get 1 Free ({count} free)", {
                          count: freeScoops,
                        })}
                      </span>
                      <span className="font-bold">−{formatMoney(Math.round(discount), currency, language)}</span>
                    </div>
                  )}
                  {checkoutDetails?.discountCode && codeDiscount > 0 && (
                    <div className="flex justify-between text-[#163e35]">
                      <span className="font-semibold">{t("Discount code {code}", { code: checkoutDetails.discountCode })}</span>
                      <span className="font-bold">−{formatMoney(codeDiscount, currency, language)}</span>
                    </div>
                  )}
                  {loyaltyDiscount > 0 && (
                    <div className="flex justify-between text-[#163e35]">
                      <span className="font-semibold">{t("Loyalty reward ({points} points)", { points: checkoutDetails?.loyaltyPointsToRedeem })}</span>
                      <span className="font-bold">−{formatMoney(loyaltyDiscount, currency, language)}</span>
                    </div>
                  )}
                  {deliveryFee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[#65748a]">{t("Delivery fee")}</span>
                      <span className="font-semibold">{formatMoney(deliveryFee, currency, language)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-[#d9d6cc] pt-3">
                    <span className="font-display text-lg font-bold">
                      {t("Total")}
                    </span>
                    <span className="font-display text-2xl font-bold text-[#bd9c00]">
                      {formatMoney(finalTotal, currency, language)}
                    </span>
                  </div>
                </div>
              </aside>
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
