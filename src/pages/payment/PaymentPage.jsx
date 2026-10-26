import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { Footer, Header } from "../../components/Layout";
import { useCart } from "../../context/useCart";
import { useFlavors } from "../../context/useFlavors";
import {
  formatCartMoney,
  getCartPricing,
  USD_TO_XAF,
} from "../../lib/cartPricing";
import { apiRequest, getCustomerToken } from "../../api/api";
import { useLanguage } from "../../language/useLanguage";
import { useAuth } from "../../context/useAuth";
import { PromotionAlertsSetting } from "../../components/PromotionAlerts";

const CHECKOUT_DETAILS_KEY = "cold-stone-checkout-details";
const PAYMENT_PENDING_MESSAGE = "Stripe has not confirmed this payment yet.";
const CAMPAY_PENDING_MESSAGE = "CamPay has not confirmed this payment yet.";
const PAYMENT_CONFIRMATION_RETRIES = 8;
const PAYMENT_CONFIRMATION_RETRY_DELAY_MS = 1500;
const icons = {
  arrow: "M5 12h14m-5-5 5 5-5 5",
  check: "m5 12.5 4.5 4.5L19 7.5",
  card: "M3 6h18v12H3V6Zm0 4h18M7 15h4",
  phone: "M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm3 15h2",
  lock: "M6 11h12v9H6v-9Zm2 0V8a4 4 0 0 1 8 0v3",
  shield: "M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Zm-3 9 2 2 4-4",
  alert: "M12 8v5m0 3.5v.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  info: "M12 11v5m0-8.5v.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0",
  store: "M4 10h16l-1.5-5h-13L4 10Zm0 0v10h16V10M9 20v-5h6v5",
  truck: "M3 7h11v9H3V7Zm11 3h4l3 3v3h-7v-6ZM7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  calendar: "M5 6h14v14H5V6Zm0 4h14M9 4v4m6-4v4",
  pin: "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  edit: "M4 20h4L19 9l-4-4L4 16v4Zm9-13 4 4",
};

function Icon({ path, className = "size-[18px]" }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d={path} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

const paymentMethods = [
  {
    id: "card",
    label: "Card",
    detail: "Pay securely with a credit or debit card through Stripe.",
    available: true,
    icon: icons.card,
  },
  {
    id: "campay",
    label: "MTN / Orange Mobile Money",
    detail: "Pay through CamPay Mobile Money checkout using MTN or Orange Money.",
    available: false,
    icon: icons.phone,
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
        { token: getCustomerToken() },
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
            token: getCustomerToken(),
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
        token: getCustomerToken() || undefined,
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


  const money = (amount) => formatMoney(Math.round(amount), currency, language);
  const isPickup = checkoutDetails?.fulfillmentType === "pickup";
  const scheduledDateLabel = (() => {
    const value = checkoutDetails?.scheduledDate;
    if (!value) return "";
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString(language === "fr" ? "fr-CM" : "en-CM", {
          weekday: "short",
          day: "numeric",
          month: "long",
        });
  })();
  const totalSavings = discount + codeDiscount + loyaltyDiscount;
  const canPay =
    !isStartingCheckout &&
    cartItems.length > 0 &&
    selectedMethodAvailable &&
    !hasUnavailableItems;
  const steps = [t("Shopping bag"), t("Checkout"), t("Payment")];

  const statusShell = (children, tone = "default") => (
    <section
      aria-live="polite"
      className={`relative mx-auto max-w-2xl overflow-hidden rounded-[32px] bg-white text-center shadow-[0_24px_60px_rgba(18,44,80,0.1)] ring-1 ${
        tone === "error" ? "ring-[#f2d6cf]" : tone === "success" ? "ring-[#d6e8c7]" : "ring-[#fbfaf5]"
      }`}
      role="status"
    >
      {children}
    </section>
  );

  return (
    <div className="min-h-screen bg-[#fbfaf5] text-brand-navy">
      <Header />

      <main id="main" tabIndex={-1}>
        {paymentStatus === "paid" ? (
          <div className="px-5 py-10 sm:px-8 sm:py-16">
            {statusShell(
              <>
                <div className="relative isolate overflow-hidden bg-brand-navy px-6 pb-10 pt-12 text-white sm:px-10">
                  <div aria-hidden="true" className="absolute -right-20 -top-28 -z-10 size-72 rounded-full border-[48px] border-white/[0.05]" />
                  <div aria-hidden="true" className="absolute -bottom-28 -left-10 -z-10 size-64 rounded-full bg-[radial-gradient(closest-side,rgb(255_184_77/0.1),rgb(255_184_77/0.1)_35%,transparent)]" />
                  <span className="relative mx-auto grid size-20 place-items-center">
                    <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full bg-[#8cbc5f]/30 [animation-iteration-count:2] motion-reduce:hidden" />
                    <span className="relative grid size-20 place-items-center rounded-full bg-[#6c9c45] text-white shadow-[0_0_0_8px_rgba(108,156,69,0.2)]">
                      <Icon className="size-10" path={icons.check} />
                    </span>
                  </span>
                  <p className="mt-6 text-xs font-extrabold uppercase tracking-[0.2em] text-brand-yellow">
                    {t("Payment confirmed")}
                  </p>
                  <h1 className="mt-2 font-display text-3xl font-extrabold leading-tight sm:text-[2.6rem]">
                    {t("Thank you, {name}!", { name: order?.customerName })}
                  </h1>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/70">
                    {t(
                      "Your payment was confirmed. Order #{id} is being prepared for {email}.",
                      { id: order?.id, email: order?.customerEmail },
                    )}
                  </p>
                </div>

                <div className="p-6 text-left sm:p-10">
                  <dl className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-[#fbfaf5] p-4 ring-1 ring-[#fbfaf5]">
                      <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#8b95a2]">{t("Order number")}</dt>
                      <dd className="mt-1 font-display text-2xl font-extrabold text-brand-navy">#{order?.id}</dd>
                    </div>
                    <div className="rounded-2xl bg-[#fbfaf5] p-4 ring-1 ring-[#fbfaf5]">
                      <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#8b95a2]">{t("Amount paid")}</dt>
                      <dd className="mt-1 font-display text-2xl font-extrabold text-brand-navy">
                        {formatMoney(order?.totalCents || 0, order?.currency, language)}
                      </dd>
                    </div>
                    {order?.storeName && (
                      <div className="flex items-start gap-3 rounded-2xl bg-[#f4f6f8] p-4 sm:col-span-2">
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-brand-navy shadow-sm">
                          <Icon path={icons.pin} />
                        </span>
                        <div className="min-w-0">
                          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#8b95a2]">{t("Assigned store")}</dt>
                          <dd className="mt-0.5 text-sm font-extrabold text-brand-navy">{t(order.storeName)}</dd>
                          {order.storeAddress && <dd className="text-xs leading-5 text-[#65748a]">{t(order.storeAddress)}</dd>}
                        </div>
                      </div>
                    )}
                  </dl>

                  <div className="mt-7">
                    <p className="text-xs font-extrabold text-[#65748a]">{t("What happens next")}</p>
                    <ol className="mt-3 space-y-3">
                      {[
                        { title: t("Payment confirmed"), body: t("A receipt is on its way to your inbox."), done: true },
                        { title: t("Preparing"), body: t("The store starts on your treats.") },
                        { title: t(isPickup ? "Ready" : "Out for delivery"), body: t("Follow every step live from your account, or get a notification at each step.") },
                      ].map((step, index) => (
                        <li className="flex items-start gap-3" key={step.title}>
                          <span
                            className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-extrabold ${
                              step.done ? "bg-[#6c9c45] text-white" : "bg-[#f1eee4] text-[#8b95a2]"
                            }`}
                          >
                            {step.done ? <Icon className="size-3.5" path={icons.check} /> : index + 1}
                          </span>
                          <span>
                            <span className="block text-sm font-extrabold text-brand-navy">{step.title}</span>
                            <span className="block text-xs leading-5 text-[#65748a]">{step.body}</span>
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div className="mt-6">
                    <PromotionAlertsSetting />
                  </div>

                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <Link
                      className="flex flex-1 items-center justify-center gap-2 rounded-full bg-brand-yellow px-6 py-3.5 text-sm font-extrabold text-brand-navy shadow-[0_12px_26px_rgba(255,220,50,0.35)] transition hover:-translate-y-0.5 hover:bg-brand-gold-light"
                      to="/account/orders?tab=orders"
                    >
                      {t("Track my order")} <Icon className="size-4" path={icons.arrow} />
                    </Link>
                    <Link
                      className="flex flex-1 items-center justify-center rounded-full px-6 py-3.5 text-sm font-extrabold text-brand-navy ring-1 ring-[#dcd8cc] transition hover:bg-[#fbfaf5] hover:ring-brand-navy"
                      to="/flavors"
                    >
                      {t("Continue shopping")}
                    </Link>
                  </div>
                </div>
              </>,
              "success",
            )}
          </div>
        ) : paymentStatus === "checking" ? (
          <div className="px-5 py-16 sm:px-8 sm:py-24">
            {statusShell(
              <div className="px-6 py-14 sm:px-12">
                <span className="relative mx-auto grid size-20 place-items-center">
                  <svg aria-hidden="true" className="absolute inset-0 size-20 animate-spin motion-reduce:animate-none" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" fill="none" r="36" stroke="#f1eee4" strokeWidth="5" />
                    <circle cx="40" cy="40" fill="none" r="36" stroke="#ffb84d" strokeDasharray="60 200" strokeLinecap="round" strokeWidth="5" />
                  </svg>
                  <span className="grid size-12 place-items-center rounded-full bg-brand-navy text-brand-yellow">
                    <Icon path={icons.lock} />
                  </span>
                </span>
                <p className="mt-7 font-display text-2xl font-extrabold text-brand-navy sm:text-3xl">
                  {t("Checking your payment…")}
                </p>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#65748a]">
                  {t("Please wait while your provider confirms the transaction.")}
                </p>
                <p className="mt-6 text-xs font-semibold text-[#8b95a2]">{t("Please don’t close or refresh this page.")}</p>
              </div>,
            )}
          </div>
        ) : paymentStatus === "unverified" ? (
          <div className="px-5 py-12 sm:px-8 sm:py-20">
            {statusShell(
              <div className="px-6 py-12 sm:px-12">
                <span className="mx-auto grid size-20 place-items-center rounded-full bg-red-50 text-red-600 shadow-[0_0_0_8px_rgba(254,226,226,0.6)]">
                  <Icon className="size-9" path={icons.alert} />
                </span>
                <p className="mt-6 text-xs font-extrabold uppercase tracking-[0.2em] text-red-700">
                  {t("Payment not confirmed")}
                </p>
                <h1 className="mt-2 font-display text-3xl font-extrabold text-brand-navy">
                  {t("We could not verify this payment")}
                </h1>
                {error && (
                  <p className="mx-auto mt-5 max-w-md rounded-2xl bg-red-50 p-4 text-sm font-semibold leading-6 text-red-800 ring-1 ring-red-100" role="alert">
                    {error}
                  </p>
                )}
                <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-[#65748a]">
                  {t(
                    "Your order has not been marked as paid. If your bank shows a charge, please contact us before trying again.",
                  )}
                </p>
                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                  <Link
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-navy px-6 py-3.5 text-sm font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-brand-blue"
                    to="/contact"
                  >
                    {t("Contact support")}
                  </Link>
                  <Link
                    className="inline-flex items-center justify-center rounded-full px-6 py-3.5 text-sm font-extrabold text-brand-navy ring-1 ring-[#dcd8cc] transition hover:bg-[#fbfaf5] hover:ring-brand-navy"
                    to="/account/orders?tab=orders"
                  >
                    {t("View my orders")}
                  </Link>
                </div>
              </div>,
              "error",
            )}
          </div>
        ) : (
          <>
            <section className="relative isolate overflow-hidden bg-brand-navy px-5 pb-12 pt-9 text-white sm:px-8 sm:pb-16 sm:pt-12 lg:px-12">
              <div aria-hidden="true" className="absolute -right-32 -top-44 -z-10 size-[30rem] rounded-full border-[64px] border-white/[0.04]" />
              <div aria-hidden="true" className="absolute -bottom-40 left-[15%] -z-10 size-80 rounded-full bg-[radial-gradient(closest-side,rgb(255_184_77/0.08),rgb(255_184_77/0.08)_35%,transparent)]" />
              <div className="mx-auto max-w-[1240px]">
                <nav aria-label={t("Breadcrumb")} className="text-xs font-semibold text-white/55">
                  <Link className="transition hover:text-brand-yellow" to="/cart">{t("Shopping bag")}</Link>
                  <span aria-hidden="true" className="mx-2">/</span>
                  <Link className="transition hover:text-brand-yellow" state={{ checkoutDetails }} to="/checkout">{t("Checkout")}</Link>
                  <span aria-hidden="true" className="mx-2">/</span>
                  <span aria-current="page" className="text-white">{t("Payment")}</span>
                </nav>

                <div className="mt-6 flex flex-wrap items-end justify-between gap-8">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.2em] text-brand-yellow before:h-px before:w-6 before:bg-brand-yellow/70">
                      {t("Final step")}
                    </p>
                    <h1 className="mt-3 font-display text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-[3.4rem]">
                      {t("Payment")}
                    </h1>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-white/65 sm:text-base">
                      {t("Choose a payment method available for your location.")}
                    </p>
                  </div>

                  <ol aria-label={t("Checkout progress")} className="flex items-center gap-2 sm:gap-3">
                    {steps.map((step, index) => {
                      const isCurrent = index === 2;
                      return (
                        <li className="flex items-center gap-2 sm:gap-3" key={step}>
                          <span
                            aria-current={isCurrent ? "step" : undefined}
                            className={`flex items-center gap-2 whitespace-nowrap rounded-full py-1.5 pl-1.5 pr-3.5 text-xs font-extrabold ${
                              isCurrent ? "bg-brand-yellow text-brand-navy" : "bg-white/10 text-white ring-1 ring-white/15"
                            }`}
                          >
                            <span className={`grid size-6 place-items-center rounded-full text-xs ${isCurrent ? "bg-brand-navy text-brand-yellow" : "bg-[#6c9c45] text-white"}`}>
                              {isCurrent ? index + 1 : <Icon className="size-3.5" path={icons.check} />}
                            </span>
                            {step}
                          </span>
                          {index < steps.length - 1 && <span aria-hidden="true" className="hidden h-px w-6 bg-brand-yellow/60 sm:block" />}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </div>
            </section>

            <div className="mx-auto max-w-[1240px] px-5 py-8 sm:px-8 sm:py-12 lg:px-12">
              {cancelled && (
                <div className="mb-6 flex items-start gap-3 rounded-[22px] bg-[#fff7ed] p-4 text-sm leading-6 text-[#8a4b00] ring-1 ring-[#fbd9a8] sm:p-5" role="status">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#ffe8c7] text-[#b45f00]">
                    <Icon className="size-4" path={icons.alert} />
                  </span>
                  <span className="pt-1.5 font-semibold">
                    {t("Checkout was cancelled. No payment was taken; you can try again when you are ready.")}
                  </span>
                </div>
              )}

              <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_390px] xl:gap-10">
                <div className="min-w-0 space-y-5">
                  {checkoutDetails && (
                    <section className="rounded-[28px] bg-white p-5 shadow-[0_10px_30px_rgba(18,44,80,0.05)] ring-1 ring-[#fbfaf5] sm:p-8">
                      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-brand-yellow-deep before:h-px before:w-5 before:bg-[#d6bd4a]">
                            {t("Delivery details")}
                          </p>
                          <h2 className="mt-2 font-display text-xl font-extrabold text-brand-navy sm:text-2xl">
                            {t(isPickup ? "Pickup at" : "Delivering to")}
                          </h2>
                        </div>
                        <Link
                          className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-extrabold text-[#65748a] ring-1 ring-[#dcd8cc] transition hover:text-brand-navy hover:ring-brand-navy"
                          state={{ checkoutDetails }}
                          to="/checkout"
                        >
                          <Icon className="size-3.5" path={icons.edit} />
                          {t("Edit")}
                        </Link>
                      </header>

                      <dl className="grid gap-3 sm:grid-cols-3">
                        {[
                          {
                            icon: icons.user,
                            label: t("Contact"),
                            lines: [checkoutDetails.name, checkoutDetails.email, checkoutDetails.phone],
                          },
                          {
                            icon: isPickup ? icons.store : icons.truck,
                            label: t(isPickup ? "Pickup" : "Delivery"),
                            lines: [
                              checkoutDetails.storeName ? t(checkoutDetails.storeName) : t(checkoutDetails.city || ""),
                              checkoutDetails.residence,
                              checkoutDetails.storeAddress ? t(checkoutDetails.storeAddress) : "",
                            ],
                          },
                          {
                            icon: icons.calendar,
                            label: t("Scheduled date"),
                            lines: [scheduledDateLabel, checkoutDetails.timeSlotLabel ? t(checkoutDetails.timeSlotLabel) : ""],
                          },
                        ].map((block) => (
                          <div className="rounded-[20px] bg-[#fbfaf5] p-4 ring-1 ring-[#fbfaf5]" key={block.label}>
                            <dt className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-[#8b95a2]">
                              <span className="grid size-7 place-items-center rounded-lg bg-white text-brand-navy shadow-sm">
                                <Icon className="size-3.5" path={block.icon} />
                              </span>
                              {block.label}
                            </dt>
                            {block.lines.filter(Boolean).map((line, index) => (
                              <dd
                                className={`break-words ${index === 0 ? "mt-3 text-sm font-extrabold text-brand-navy" : "mt-0.5 text-xs leading-5 text-[#65748a]"}`}
                                key={`${block.label}-${index}`}
                              >
                                {line}
                              </dd>
                            ))}
                          </div>
                        ))}
                      </dl>
                    </section>
                  )}

                  <section className="rounded-[28px] bg-white p-5 shadow-[0_10px_30px_rgba(18,44,80,0.05)] ring-1 ring-[#fbfaf5] sm:p-8">
                    <fieldset>
                      <legend className="w-full">
                        <span className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-brand-yellow-deep before:h-px before:w-5 before:bg-[#d6bd4a]">
                          {t("Payment method")}
                        </span>
                        <span className="mt-2 block font-display text-xl font-extrabold text-brand-navy sm:text-2xl">
                          {t("Choose payment method")}
                        </span>
                      </legend>
                      <div className="mt-6 grid gap-3">
                        {displayedPaymentMethods.map((method) => {
                          const isSelected = selectedPaymentMethod === method.id && method.available;
                          return (
                            <label
                              className={`flex items-center gap-4 rounded-[22px] p-4 ring-1 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-yellow-deep sm:p-5 ${
                                !method.available
                                  ? "cursor-not-allowed bg-[#fbfaf5] ring-[#fbfaf5]"
                                  : isSelected
                                    ? "cursor-pointer bg-[#fffbea] ring-2 ring-brand-yellow-deep shadow-[0_8px_20px_rgba(189,156,0,0.12)]"
                                    : "cursor-pointer bg-white ring-[#e3dfd3] hover:ring-[#cfcabb]"
                              }`}
                              key={method.id}
                            >
                              <input
                                checked={selectedPaymentMethod === method.id}
                                className="sr-only"
                                disabled={!method.available}
                                name="paymentMethod"
                                onChange={() => setSelectedPaymentMethod(method.id)}
                                type="radio"
                                value={method.id}
                              />
                              <span
                                className={`grid size-12 shrink-0 place-items-center rounded-2xl transition ${
                                  !method.available
                                    ? "bg-[#f1eee4] text-[#9aa3af]"
                                    : isSelected
                                      ? "bg-brand-navy text-brand-yellow"
                                      : "bg-[#fbfaf5] text-[#65748a]"
                                }`}
                              >
                                <Icon className="size-6" path={method.icon} />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-2">
                                  <span className={`text-sm font-extrabold ${method.available ? "text-brand-navy" : "text-[#8b95a2]"}`}>
                                    {t(method.label)}
                                  </span>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-xs font-extrabold uppercase tracking-wide ${
                                      method.available ? "bg-[#eef6e8] text-[#3f6b22]" : "bg-[#ecebe5] text-[#8b95a2]"
                                    }`}
                                  >
                                    {t(method.available ? "Available" : method.id === "campay" ? "Setup required" : "Coming soon")}
                                  </span>
                                </span>
                                <span className="mt-1 block text-xs leading-5 text-[#65748a]">{t(method.detail)}</span>
                              </span>
                              <span
                                className={`grid size-5 shrink-0 place-items-center rounded-full ring-2 transition ${
                                  isSelected ? "bg-brand-navy ring-brand-navy" : "ring-[#d4cfc0]"
                                }`}
                              >
                                {isSelected && <Icon className="size-3 text-white" path={icons.check} />}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>

                    <p className="mt-5 flex items-start gap-3 rounded-2xl bg-[#f4f6f8] p-4 text-xs leading-5 text-[#65748a]">
                      <Icon className="mt-0.5 size-4 shrink-0 text-brand-navy" path={icons.shield} />
                      {t(selectedPaymentMethod === "campay"
                        ? "Mobile Money is completed on CamPay’s secure checkout. This website never asks for your payment PIN."
                        : "Card details are entered on Stripe’s secure checkout and are never stored by this website.")}
                    </p>
                  </section>

                  <p className="flex gap-3 rounded-2xl bg-[#fffbea] px-4 py-3.5 text-xs leading-5 text-[#6b5800] ring-1 ring-[#f0e2a0] sm:px-5">
                    <Icon className="mt-0.5 size-4 shrink-0" path={icons.info} />
                    {t("Your treats are prepared fresh once your payment is confirmed.")}
                  </p>
                </div>

                <aside aria-labelledby="payment-summary-heading" className="relative z-10 lg:sticky lg:top-[calc(var(--site-header-offset,0px)+2rem)] lg:transition-[top] lg:duration-300">
                  <div className="overflow-hidden rounded-[28px] bg-white shadow-[0_18px_50px_rgba(18,44,80,0.09)] ring-1 ring-[#fbfaf5]">
                    <div className="bg-brand-navy px-6 py-5 text-white sm:px-7">
                      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-yellow">{t("Your order")}</p>
                      <h2 className="mt-1 font-display text-2xl font-extrabold" id="payment-summary-heading">{t("Order summary")}</h2>
                    </div>

                    <div className="p-6 sm:p-7">
                      <ul className="max-h-72 space-y-3.5 overflow-y-auto pr-1">
                        {cartItems.map((item) => (
                          <li className="flex items-center gap-3.5" key={item.id}>
                            <span className="relative shrink-0">
                              <img decoding="async" loading="lazy" alt="" className={`size-14 rounded-2xl object-cover ring-1 ring-black/5 ${item.color || "bg-[#fbfaf5]"}`} src={item.image} />
                              <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand-navy px-1 text-xs font-extrabold text-white ring-2 ring-white">
                                {item.quantity}
                              </span>
                            </span>
                            <p className="min-w-0 flex-1 truncate text-sm font-extrabold text-brand-navy">{t(item.name)}</p>
                            <span className="shrink-0 whitespace-nowrap text-sm font-bold tabular-nums text-brand-navy">
                              {money(item.price * item.quantity)}
                            </span>
                          </li>
                        ))}
                      </ul>

                      <dl className="mt-6 space-y-3 border-t border-[#fbfaf5] pt-5 text-sm">
                        <div className="flex justify-between gap-4">
                          <dt className="text-[#65748a]">{t("Subtotal")}</dt>
                          <dd className="font-bold tabular-nums">{money(subtotal)}</dd>
                        </div>
                        {discount > 0 && (
                          <div className="flex justify-between gap-4 text-[#3f6b22]">
                            <dt className="min-w-0 font-semibold">{t("Buy 2 Get 1 Free ({count} free)", { count: freeScoops })}</dt>
                            <dd className="shrink-0 font-extrabold tabular-nums">−{money(discount)}</dd>
                          </div>
                        )}
                        {checkoutDetails?.discountCode && codeDiscount > 0 && (
                          <div className="flex justify-between gap-4 text-[#3f6b22]">
                            <dt className="min-w-0 font-semibold">{t("Discount code {code}", { code: checkoutDetails.discountCode })}</dt>
                            <dd className="shrink-0 font-extrabold tabular-nums">−{money(codeDiscount)}</dd>
                          </div>
                        )}
                        {loyaltyDiscount > 0 && (
                          <div className="flex justify-between gap-4 text-[#3f6b22]">
                            <dt className="min-w-0 font-semibold">{t("Loyalty reward ({points} points)", { points: checkoutDetails?.loyaltyPointsToRedeem })}</dt>
                            <dd className="shrink-0 font-extrabold tabular-nums">−{money(loyaltyDiscount)}</dd>
                          </div>
                        )}
                        <div className="flex justify-between gap-4">
                          <dt className="text-[#65748a]">{t(isPickup ? "Pickup" : "Delivery fee")}</dt>
                          <dd className="shrink-0 font-bold tabular-nums">{deliveryFee > 0 ? money(deliveryFee) : t("Free")}</dd>
                        </div>
                      </dl>

                      <div className="mt-5 flex items-end justify-between gap-3 border-t border-dashed border-[#dcd8cc] pt-5">
                        <span className="font-display text-lg font-extrabold text-brand-navy">{t("Total")}</span>
                        <span className="font-display text-3xl font-extrabold tabular-nums leading-none text-brand-navy">{money(finalTotal)}</span>
                      </div>
                      {totalSavings > 0 && (
                        <p className="mt-2 text-right text-xs font-bold text-[#3f6b22]">{t("You save {amount}", { amount: money(totalSavings) })}</p>
                      )}

                      {error && (
                        <p className="mt-5 flex items-start gap-2 rounded-2xl bg-red-50 p-3.5 text-sm font-semibold text-red-700 ring-1 ring-red-100" role="alert">
                          <Icon className="mt-0.5 size-4 shrink-0" path={icons.alert} />
                          {error}
                        </p>
                      )}
                      {hasUnavailableItems && (
                        <p className="mt-5 rounded-2xl bg-red-50 p-3.5 text-sm text-red-700 ring-1 ring-red-100" role="alert">
                          {t("Stock changed while you were checking out.")}{" "}
                          <Link className="font-extrabold underline underline-offset-2" to="/cart">{t("Review your bag")}</Link>{" "}
                          {t("before paying.")}
                        </p>
                      )}

                      <button
                        className="group mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-brand-yellow px-6 py-4 text-sm font-extrabold text-brand-navy shadow-[0_12px_26px_rgba(255,220,50,0.35)] transition hover:-translate-y-0.5 hover:bg-brand-gold-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2 disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-[#ecebe5] disabled:text-[#8b95a2] disabled:shadow-none"
                        disabled={!canPay}
                        onClick={startCheckout}
                        type="button"
                      >
                        {isStartingCheckout ? (
                          <>
                            <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
                            {t(selectedPaymentMethod === "campay" ? "Connecting to CamPay…" : "Connecting to Stripe…")}
                          </>
                        ) : (
                          <>
                            <Icon className="size-4" path={icons.lock} />
                            {t("Confirm payment for {amount}", { amount: money(finalTotal) })}
                          </>
                        )}
                      </button>
                      <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-[#8b95a2]">
                        <Icon className="size-3.5" path={icons.shield} />
                        {t(selectedPaymentMethod === "campay" ? "Secured by CamPay" : "Secured by Stripe")}
                      </p>
                    </div>
                  </div>

                  <Link
                    className="mt-4 flex items-center justify-center gap-2 text-sm font-extrabold text-brand-yellow-deep transition hover:text-brand-navy"
                    state={{ checkoutDetails }}
                    to="/checkout"
                  >
                    <Icon className="size-4 rotate-180" path={icons.arrow} />
                    {t("Back to delivery details")}
                  </Link>
                </aside>
              </div>
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
