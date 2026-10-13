import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { Footer, Header } from "../../../components/Layout";
import { useCart } from "../../../useCart";
import { useFlavors } from "../../../flavor-context/useFlavors";
import {
  formatCartMoney,
  getCartPricing,
  USD_TO_XAF,
} from "../../../cartPricing";
import { apiRequest, CUSTOMER_TOKEN_KEY } from "../../../api/api";
import { useLanguage } from "../../../language/useLanguage";
import { useAuth } from "../../../authcontext/useAuth";

const CHECKOUT_DETAILS_KEY = "antixor-icy-checkout-details";
const PAYMENT_PENDING_MESSAGE = "Stripe has not confirmed this payment yet.";
const CAMPAY_PENDING_MESSAGE = "CamPay has not confirmed this payment yet.";
const PAYMENT_CONFIRMATION_RETRIES = 8;
const PAYMENT_CONFIRMATION_RETRY_DELAY_MS = 1500;
const paymentMethods = [
  {
    id: "card",
    label: "Card",
    detail: "Pay securely with a credit or debit card through Stripe.",
    available: true,
    icon: "💳",
  },
  {
    id: "campay",
    label: "MTN / Orange Mobile Money",
    detail: "Pay through CamPay Mobile Money checkout using MTN or Orange Money.",
    available: false,
    icon: "📱",
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

async function verifyStripePayment(sessionId, isCancelled) {
  for (let attempt = 0; ; attempt += 1) {
    if (isCancelled()) return null;
    try {
      return await apiRequest(`/payment/session/${encodeURIComponent(sessionId)}`);
    } catch (error) {
      if (
        error.message !== PAYMENT_PENDING_MESSAGE ||
        attempt >= PAYMENT_CONFIRMATION_RETRIES
      ) {
        throw error;
      }
      await new Promise((resolve) =>
        window.setTimeout(resolve, PAYMENT_CONFIRMATION_RETRY_DELAY_MS),
      );
    }
  }
}

async function verifyCamPayPayment(externalReference, isCancelled) {
  for (let attempt = 0; ; attempt += 1) {
    if (isCancelled()) return null;
    try {
      return await apiRequest(
        `/payment/campay/${encodeURIComponent(externalReference)}`,
        { token: sessionStorage.getItem(CUSTOMER_TOKEN_KEY) },
      );
    } catch (error) {
      if (
        error.message !== CAMPAY_PENDING_MESSAGE ||
        attempt >= PAYMENT_CONFIRMATION_RETRIES
      ) {
        throw error;
      }
      await new Promise((resolve) =>
        window.setTimeout(resolve, PAYMENT_CONFIRMATION_RETRY_DELAY_MS),
      );
    }
  }
}

export function PaymentPage() {
  const { cartItems, clearCart } = useCart();
  const { refreshFlavors } = useFlavors();
  const { t, language } = useLanguage();
  const { customer, isLoading } = useAuth();
  const { currency, subtotal, freeScoops, discount, total } = getCartPricing(cartItems);
  const hasMenuItems = cartItems.some((item) => item.itemType === "menu");
  const hasUnavailableItems = cartItems.some(
    (item) => item.availableQuantity < item.quantity,
  );
  const { state } = useLocation();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const camPayReference = searchParams.get("reference");
  const camPayReturn = searchParams.get("provider") === "campay";
  const loyaltyOrderId = searchParams.get("loyalty_order_id");
  const cancelled = searchParams.get("cancelled") === "1"
    || (camPayReturn && ["failed", "cancelled"].includes(searchParams.get("status")));
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
  const [availableMethods, setAvailableMethods] = useState({
    card: false,
    campayMobileMoney: false,
  });
  const [paymentStatus, setPaymentStatus] = useState(
    sessionId || camPayReference ? "checking" : "ready",
  );
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const displayedPaymentMethods = paymentMethods.map((method) => ({
    ...method,
    available: method.id === "card"
      ? availableMethods.card || finalTotal === 0
      : method.id === "campay"
        ? availableMethods.campayMobileMoney
        : false,
  }));
  const selectedMethodAvailable = selectedPaymentMethod === "card"
    ? availableMethods.card || finalTotal === 0
    : selectedPaymentMethod === "campay" && availableMethods.campayMobileMoney;

  useEffect(() => {
    let cancelledRequest = false;
    apiRequest("/payment/methods")
      .then(({ methods }) => {
        if (cancelledRequest) return;
        setAvailableMethods(methods);
        if (!methods.card && methods.campayMobileMoney) {
          setSelectedPaymentMethod("campay");
        }
      })
      .catch((methodsError) => {
        if (!cancelledRequest) setError(methodsError.message);
      });
    return () => {
      cancelledRequest = true;
    };
  }, []);

  useEffect(() => {
    if (!sessionId && !camPayReference && !loyaltyOrderId) return undefined;
    let cancelledRequest = false;
    setPaymentStatus("checking");
    const verification = sessionId
      ? verifyStripePayment(sessionId, () => cancelledRequest)
      : camPayReference
        ? verifyCamPayPayment(camPayReference, () => cancelledRequest)
        : apiRequest(`/customer/orders/${encodeURIComponent(loyaltyOrderId)}`, {
            token: sessionStorage.getItem(CUSTOMER_TOKEN_KEY),
          })
    verification
      .then(({ order: paidOrder }) => {
        if (cancelledRequest || !paidOrder) return;
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
  }, [clearCart, camPayReference, loyaltyOrderId, refreshFlavors, sessionId]);

  if (!sessionId && !loyaltyOrderId && cartItems.length === 0 && !cancelled) {
    return <Navigate to="/cart" replace />;
  }
  if (!sessionId && !loyaltyOrderId && !cancelled && !isLoading && !customer) {
    return (
      <Navigate
        to="/signup"
        state={{
          from: "/checkout",
          notice: t("Please sign in to continue placing your order."),
        }}
        replace
      />
    );
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
          paymentMethod: selectedPaymentMethod,
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

      <main className="mx-auto max-w-[1240px] px-4 py-7 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
        {paymentStatus === "paid" ? (
          <section aria-live="polite" className="mx-auto max-w-2xl overflow-hidden rounded-[28px] border border-[#dce9c8] bg-white text-center shadow-[0_18px_50px_rgba(18,44,80,0.1)]" data-scroll-reveal="skip" role="status">
            <div className="h-2 bg-gradient-to-r from-[#a8df62] via-[#d8f29a] to-[#ffdc32]" />
            <div className="p-6 sm:p-10">
            <span
              aria-hidden="true"
              className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#e8f6d4] text-3xl font-bold text-[#163e35] shadow-sm"
            >
              ✓
            </span>
            <p className="mt-5 inline-flex rounded-full bg-[#e8f6d4] px-3.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#163e35]">
              {t("Payment confirmed")}
            </p>
            <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-[#092a53] sm:text-5xl">
              {t("Thank you, {name}!", { name: order?.customerName })}
            </h1>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#65748a]">
              {t(
                "Your payment was confirmed. Order #{id} is being prepared for {email}.",
                { id: order?.id, email: order?.customerEmail },
              )}
            </p>
            {order?.storeName && (
              <div className="mx-auto mt-5 max-w-md rounded-2xl border border-[#dce7f1] bg-[#f4f8fc] px-4 py-3 text-left">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#8a7500]">{t("Assigned store")}</p>
                <p className="mt-1 text-sm font-extrabold text-[#092a53]">{t(order.storeName)}</p>
                {order.storeAddress && <p className="mt-1 text-xs leading-5 text-[#65748a]">{t(order.storeAddress)}</p>}
              </div>
            )}
            <p className="mt-5 font-display text-3xl font-extrabold text-[#092a53]">
              {formatMoney(order?.totalCents || 0, order?.currency, language)}
            </p>
            <Link
              className="mt-7 inline-flex rounded-xl bg-[#ffdc32] px-6 py-3.5 font-extrabold text-[#102c50] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#ffe76c]"
              to="/flavors"
            >
              {t("Continue shopping")}
            </Link>
            </div>
          </section>
        ) : paymentStatus === "checking" ? (
          <section className="mx-auto max-w-2xl rounded-[28px] border border-[#e4e8ee] bg-white p-8 text-center shadow-[0_18px_50px_rgba(18,44,80,0.08)] sm:p-12" aria-live="polite" data-scroll-reveal="skip" role="status">
            <span aria-hidden="true" className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#eaf2fb] text-2xl text-[#092a53]">↻</span>
            <p className="mt-5 font-display text-2xl font-extrabold text-[#092a53]">
              {t("Checking your payment…")}
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#65748a]">
              {t("Please wait while your provider confirms the transaction.")}
            </p>
          </section>
        ) : paymentStatus === "unverified" ? (
          <section className="mx-auto max-w-2xl overflow-hidden rounded-[28px] border border-[#f0d0c8] bg-white shadow-[0_18px_50px_rgba(18,44,80,0.08)]" data-scroll-reveal="skip">
            <div className="h-2 bg-[#d97362]" />
            <div className="p-6 sm:p-8">
            <p className="inline-flex rounded-full bg-red-50 px-3.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-red-800">
              {t("Payment not confirmed")}
            </p>
            <h1 className="mt-3 font-display text-3xl font-extrabold text-[#092a53]">
              {t("We could not verify this payment")}
            </h1>
            <p className="mt-3 rounded-xl bg-red-50/70 p-4 text-sm leading-6 text-red-800" role="alert">{error}</p>
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
            </div>
          </section>
        ) : (
          <>
            <Link
              to="/checkout"
              state={{ checkoutDetails }}
              className="inline-flex items-center gap-2 rounded-full border border-[#dce2ea] bg-white px-4 py-2.5 text-sm font-bold text-[#52647b] shadow-sm transition hover:border-[#092a53] hover:text-[#092a53] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00]"
            >
              <span aria-hidden="true">←</span> {t("Back to delivery details")}
            </Link>
            <div className="mb-7 mt-6 rounded-[28px] bg-[#092a53] px-6 py-7 text-white shadow-[0_18px_45px_rgba(9,42,83,0.14)] sm:px-9 sm:py-9">
              <div className="flex flex-wrap items-end justify-between gap-6">
                <div>
                  <p className="mb-2 inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#ffdc32]">
                    <span aria-hidden="true" className="text-base">✦</span>{t("Final step")}
                  </p>
                  <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
                    {t("Payment")}
                  </h1>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-white/70">
                    {t("Choose a payment method available for your location.")}
                  </p>
                </div>
                <div aria-label={t("Checkout progress")} className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.1em] text-white/65 sm:gap-3">
                  <span className="flex items-center gap-2"><span aria-hidden="true" className="grid size-7 place-items-center rounded-full bg-[#d8f29a] text-xs text-[#163e35]">✓</span><span className="hidden sm:inline">{t("Your details")}</span></span>
                  <span aria-hidden="true" className="h-px w-5 bg-white/25 sm:w-8" />
                  <span className="flex items-center gap-2 text-[#ffdc32]"><span className="grid size-7 place-items-center rounded-full bg-[#ffdc32] text-xs text-[#092a53]">2</span><span className="hidden sm:inline">{t("Payment")}</span></span>
                </div>
              </div>
            </div>
            <p className="mb-7 flex items-start gap-3 rounded-2xl border border-[#eadb8a] bg-[#fff9dc] px-4 py-4 text-sm leading-6 text-[#624f00] sm:px-5">
                <span aria-hidden="true" className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-[#ffdc32] text-xs font-extrabold">i</span>
                {t(hasMenuItems
                  ? "Menu items and FCFA prices are illustrative examples, not confirmed local menu items or prices. Orders are handled by this independent website."
                  : "Items and prices in the online catalog are set in FCFA by this website's operator and are not verified Cold Stone Cameroon products, menu prices or promotions.")}
            </p>

            {cancelled && (
              <p
                className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900"
                role="status"
              >
                <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-amber-200 font-bold">!</span>
                {t(
                  "Checkout was cancelled. No payment was taken; you can try again when you are ready.",
                )}
              </p>
            )}

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_370px] lg:gap-8">
              <section className="space-y-6 rounded-[28px] border border-[#e4e8ee] bg-white p-5 shadow-[0_12px_36px_rgba(18,44,80,0.07)] sm:p-8">
                <div className="rounded-2xl border border-[#e4e8ee] bg-[#f7f9fc] p-4 sm:p-5">
                  <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#8a7500]">{t("Delivery details")}</p>
                  <h2 className="font-display text-xl font-extrabold text-[#092a53] sm:text-2xl">
                    {t(checkoutDetails?.fulfillmentType === 'pickup' ? 'Pickup at' : 'Delivering to')}
                  </h2>
                  <p className="mt-3 text-sm font-extrabold">
                    {checkoutDetails?.name}
                  </p>
                  {checkoutDetails?.storeName && (
                    <div className="mt-3 rounded-xl border border-[#dce5ef] bg-white px-3.5 py-3">
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#8a7500]">{t('Selected store')}</p>
                      <p className="mt-1 text-sm font-bold text-[#092a53]">{t(checkoutDetails.storeName)}</p>
                      {checkoutDetails.storeAddress && <p className="mt-1 text-xs leading-5 text-[#65748a]">{t(checkoutDetails.storeAddress)}</p>}
                    </div>
                  )}
                  <p className="mt-1 text-sm leading-6 text-[#65748a]">
                    {checkoutDetails?.residence ? `${checkoutDetails.residence}, ` : ''}
                    {checkoutDetails?.city}
                  </p>
                  {checkoutDetails?.scheduledDate && <p className="mt-2 inline-flex rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#52647b]">{t('Scheduled date')}: {checkoutDetails.scheduledDate} · {t(checkoutDetails.timeSlotLabel)}</p>}
                  <p className="mt-2 text-sm text-[#65748a]">
                    {checkoutDetails?.email}
                  </p>
                </div>

                <fieldset>
                  <legend className="font-display text-xl font-extrabold text-[#092a53] sm:text-2xl">
                    {t("Choose payment method")}
                  </legend>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {displayedPaymentMethods.map((method) => (
                      <label
                        className={`flex min-h-[116px] items-start gap-3 rounded-2xl border p-4 transition ${
                          method.available
                            ? "cursor-pointer border-[#dce2ea] bg-white hover:border-[#bd9c00] has-[:checked]:border-[#bd9c00] has-[:checked]:bg-[#fff9dc] has-[:checked]:shadow-[0_8px_20px_rgba(189,156,0,0.1)]"
                            : "cursor-not-allowed border-[#e4e8ee] bg-[#f7f9fc] opacity-70"
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
                                method.available
                                  ? "Available"
                                  : method.id === "campay"
                                    ? "Setup required"
                                    : "Coming soon",
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
                    {t(selectedPaymentMethod === "campay"
                      ? "Mobile Money is completed on CamPay’s secure checkout. This website never asks for your payment PIN."
                      : "Card details are entered on Stripe’s secure checkout and are never stored by this website.")}
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
                  className="w-full rounded-xl bg-[#ffdc32] px-6 py-4 text-base font-extrabold text-[#102c50] shadow-[0_8px_18px_rgba(189,156,0,0.16)] transition hover:-translate-y-0.5 hover:bg-[#ffe76c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
                  disabled={
                    isStartingCheckout ||
                    cartItems.length === 0 ||
                    !selectedMethodAvailable ||
                    hasUnavailableItems
                  }
                  onClick={startCheckout}
                  type="button"
                >
                  {isStartingCheckout
                    ? t(selectedPaymentMethod === "campay"
                      ? "Connecting to CamPay…"
                      : "Connecting to Stripe…")
                    : t("Confirm payment for {amount}", {
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

              <aside className="h-fit overflow-hidden rounded-[28px] border border-[#e4e8ee] bg-white shadow-[0_12px_36px_rgba(18,44,80,0.07)] lg:sticky lg:top-6">
                <div className="bg-[#092a53] px-5 py-5 text-white sm:px-6">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#ffdc32]">{t("Final step")}</p>
                  <h2 className="mt-1 font-display text-2xl font-extrabold">
                    {t("Order summary")}
                  </h2>
                </div>
                <div className="p-5 sm:p-6">
                  <div className="space-y-4">
                  {cartItems.map((item) => (
                    <div className="flex items-center gap-3" key={item.id}>
                      <img
                        alt=""
                        className="checkout-item-image rounded-xl border border-[#edf0f4] bg-[#f4f1e7]"
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
                  <div className="mt-5 space-y-3 border-t border-dashed border-[#dce2ea] pt-4 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-[#65748a]">{t("Subtotal")}</span>
                    <span className="font-semibold">
                      {formatMoney(Math.round(subtotal), currency, language)}
                    </span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between gap-4 text-[#163e35]">
                      <span className="min-w-0 font-semibold">
                        {t("Buy 2 Get 1 Free ({count} free)", {
                          count: freeScoops,
                        })}
                      </span>
                      <span className="shrink-0 font-bold">−{formatMoney(Math.round(discount), currency, language)}</span>
                    </div>
                  )}
                  {checkoutDetails?.discountCode && codeDiscount > 0 && (
                    <div className="flex justify-between gap-4 text-[#163e35]">
                      <span className="min-w-0 font-semibold">{t("Discount code {code}", { code: checkoutDetails.discountCode })}</span>
                      <span className="shrink-0 font-bold">−{formatMoney(codeDiscount, currency, language)}</span>
                    </div>
                  )}
                  {loyaltyDiscount > 0 && (
                    <div className="flex justify-between gap-4 text-[#163e35]">
                      <span className="min-w-0 font-semibold">{t("Loyalty reward ({points} points)", { points: checkoutDetails?.loyaltyPointsToRedeem })}</span>
                      <span className="shrink-0 font-bold">−{formatMoney(loyaltyDiscount, currency, language)}</span>
                    </div>
                  )}
                  {deliveryFee > 0 && (
                    <div className="flex justify-between gap-4">
                      <span className="text-[#65748a]">{t("Delivery fee")}</span>
                      <span className="shrink-0 font-semibold">{formatMoney(deliveryFee, currency, language)}</span>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between gap-3 border-t border-[#dce2ea] pt-4">
                    <span className="font-display text-lg font-bold">
                      {t("Total")}
                    </span>
                    <span className="shrink-0 font-display text-xl font-extrabold text-[#092a53] sm:text-2xl">
                      {formatMoney(finalTotal, currency, language)}
                    </span>
                  </div>
                  </div>
                </div>
                <p className="border-t border-[#edf0f4] bg-[#fbfcfe] px-5 py-3 text-center text-[10px] font-semibold text-[#7b8796] sm:px-6">{t("Your total includes the delivery fee shown above.")}</p>
              </aside>
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
