import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { apiRequest, getCustomerToken } from "../../api/api";
import { Footer, Header } from "../../components/Layout";
import { HeroBackground } from "../../components/HeroBackground";
import { useCart } from "../../context/useCart";
import { useAuth } from "../../context/useAuth";
import { cameroonDeliveryLocations } from "../../../shared/data";
import { useLanguage } from "../../language/useLanguage";
import { PromotionAlertsSetting } from "../../components/PromotionAlerts";
import { numberFormatter } from "../../lib/cartPricing";
import "./CustomerAccount.css";

const fieldClass =
  "mt-2 w-full rounded-xl border border-[#dce3eb] bg-white px-4 py-3.5 text-sm font-semibold text-brand-navy transition placeholder:font-medium placeholder:text-[#9aa3af] hover:border-[#b9c5d2] focus:border-brand-yellow-deep focus:ring-4 focus:ring-brand-yellow/20 outline-none!";
const labelClass = "block text-xs font-extrabold text-[#65748a]";
const cardClass = "rounded-2xl bg-white p-5 ring-1 ring-[#e5e9ee] sm:p-7";
const eyebrowClass = "text-xs font-bold text-brand-yellow-deep";
const primaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-navy px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow-deep focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-55";
const ghostButton =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#d5dce5] bg-white px-4 py-2.5 text-xs font-bold text-[#65748a] transition-colors hover:border-brand-navy hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow-deep disabled:cursor-not-allowed disabled:opacity-50";

const PROFILE_IMAGE_DIMENSION = 256;
const MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024;
const POINTS_PER_REWARD = 100;
const REWARD_VALUE_FCFA = 1000;
const REVIEW_ICON = "M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7L12 3Z";

const TABS = [
  {
    key: "overview",
    label: "Overview",
    icon: "M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z",
  },
  {
    key: "orders",
    label: "Orders",
    icon: "M6 7h12l-1 13H7L6 7Zm3 0V6a3 3 0 0 1 6 0v1",
  },
  {
    key: "reviews",
    label: "Reviews",
    icon: REVIEW_ICON,
  },
  {
    key: "saved",
    label: "Saved",
    icon: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z",
  },
  {
    key: "rewards",
    label: "Rewards",
    icon: "M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7L12 3Z",
  },
  {
    key: "profile",
    label: "Profile",
    icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0",
  },
];

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

async function resizeProfilePicture(file) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file for the profile picture.");
  }
  if (file.size > MAX_PROFILE_IMAGE_SIZE) {
    throw new Error("Choose an image smaller than 5 MB.");
  }

  const imageBitmap = await createImageBitmap(file);
  const scale = Math.min(
    1,
    PROFILE_IMAGE_DIMENSION / Math.max(imageBitmap.width, imageBitmap.height),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(imageBitmap.width * scale));
  canvas.height = Math.max(1, Math.round(imageBitmap.height * scale));

  const context = canvas.getContext("2d");
  if (!context) {
    imageBitmap.close();
    throw new Error("Your browser could not prepare the profile picture.");
  }

  context.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);
  imageBitmap.close();
  return canvas.toDataURL("image/jpeg", 0.8);
}

// Stage codes such as "out_for_delivery" have French translations; in English
// they fall through unchanged, so turn them into readable words.
function stageLabel(stage, t) {
  const label = t(stage);
  if (label !== stage) return label;
  const words = stage.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function orderStatus(order, t) {
  if (order.status === "pending_payment") return t("Awaiting payment");
  if (order.status === "payment_failed") return t("Payment failed");
  return stageLabel(
    order.deliveryStage ||
      order.fulfillmentStatus ||
      (order.status === "delivered" ? "delivered" : "preparing"),
    t,
  );
}

function isPaymentIssue(order) {
  return (
    order.status === "pending_payment" || order.status === "payment_failed"
  );
}

function isCompleted(order) {
  return (
    order.status === "delivered" ||
    order.deliveryStage === "delivered" ||
    order.fulfillmentStatus === "delivered"
  );
}

function isActive(order) {
  return order.status !== "payment_failed" && !isCompleted(order);
}

function statusTone(order) {
  if (order.status === "payment_failed")
    return "bg-red-50 text-red-700 ring-red-200";
  if (order.status === "pending_payment")
    return "bg-orange-50 text-orange-700 ring-orange-200";
  if (isCompleted(order)) return "bg-[#eef6e8] text-[#3f6b22] ring-[#cfe3bf]";
  return "bg-[#fff6cc] text-[#715e00] ring-[#efdc85]";
}

function formatOrderDate(value, language, t) {
  if (typeof value !== "string" || !value.trim()) return t("Date unavailable");
  const normalizedValue = value.includes("T") ? value : value.replace(" ", "T");
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalizedValue);
  const date = new Date(hasTimezone ? normalizedValue : `${normalizedValue}Z`);
  return Number.isNaN(date.getTime())
    ? t("Date unavailable")
    : date.toLocaleString(language === "fr" ? "fr-CM" : "en-CM", {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

function formatPoints(points) {
  return new Intl.NumberFormat("en-US").format(points);
}

function Avatar({ customer, size = "size-20", text = "text-3xl" }) {
  return customer.profilePicture ? (
    <img
      decoding="async"
      loading="lazy"
      alt={customer.name || ""}
      className={`${size} shrink-0 rounded-full object-cover`}
      src={customer.profilePicture}
    />
  ) : (
    <span
      aria-hidden="true"
      className={`${size} ${text} grid shrink-0 place-items-center rounded-full bg-brand-yellow font-display font-extrabold text-brand-navy`}
    >
      {(customer.name || "A").charAt(0).toUpperCase()}
    </span>
  );
}

function SectionHeading({ eyebrow, title, description, action }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <p className={eyebrowClass}>{eyebrow}</p>
        <h2 className="mt-2 font-display text-2xl font-extrabold leading-tight text-brand-navy sm:text-[1.75rem]">
          {title}
        </h2>
        {description && (
          <p className="mt-1.5 max-w-xl text-sm leading-6 text-[#65748a]">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

function EmptyState({ icon, title, body, children }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#cfd8e2] bg-white px-6 py-12 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-xl bg-[#fff8d8] text-brand-yellow-deep">
        <Icon className="size-6" path={icon} />
      </span>
      <h3 className="mt-4 font-display text-xl font-extrabold text-brand-navy">
        {title}
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#65748a]">
        {body}
      </p>
      {children}
    </div>
  );
}

function OrderProgress({ order, t }) {
  const steps = [
    { key: "preparing", label: "Preparing" },
    { key: "ready", label: "Ready" },
    ...(order.fulfillmentType === "delivery"
      ? [{ key: "out_for_delivery", label: "Out for delivery" }]
      : []),
    { key: "delivered", label: "Delivered" },
  ];
  const currentStage =
    order.status === "delivered"
      ? "delivered"
      : order.deliveryStage || order.fulfillmentStatus || "preparing";
  const matchedIndex = steps.findIndex(
    (step) =>
      step.key === currentStage ||
      (currentStage === "accepted" && step.key === "preparing"),
  );
  // A pickup order has no delivery step; if it is marked out for delivery it has
  // already passed "Ready", so show it there rather than back at the start.
  const currentIndex =
    matchedIndex >= 0
      ? matchedIndex
      : currentStage === "out_for_delivery"
        ? steps.findIndex((step) => step.key === "ready")
        : 0;
  const isDone = currentStage === "delivered";
  const fill =
    steps.length > 1 ? (currentIndex / (steps.length - 1)) * 100 : 100;

  return (
    <section
      aria-label={t("Live order tracking")}
      aria-live="polite"
      aria-atomic="true"
      className="account-order-tracking rounded-xl bg-[#f3f6f8] p-4 sm:p-5"
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-extrabold text-brand-navy">
          {!isDone && (
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#6c9c45] opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex size-2 rounded-full bg-[#6c9c45]" />
            </span>
          )}
          {t("Live order tracking")}
        </p>
        <p className="text-xs font-semibold text-[#65748a]">
          {orderStatus(order, t)}
        </p>
      </div>
      <div className="relative">
        <div
          aria-hidden="true"
          className="absolute inset-x-[calc(50%/var(--steps))] top-[13px] h-1 rounded-full bg-[#e2ded2]"
          style={{ "--steps": steps.length }}
        >
          <div
            className="h-full rounded-full bg-[#6c9c45] transition-[width] duration-500 motion-reduce:transition-none"
            style={{ width: `${fill}%` }}
          />
        </div>
        <ol
          className="relative grid items-start"
          style={{
            gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
          }}
        >
          {steps.map((step, index) => {
            const isComplete = index < currentIndex || isDone;
            const isCurrent = index === currentIndex && !isDone;
            return (
              <li
                aria-current={isCurrent ? "step" : undefined}
                className="min-w-0 text-center"
                key={step.key}
              >
                <span
                  className={`mx-auto grid size-[30px] place-items-center rounded-full text-xs font-extrabold ring-4 ring-[#f7f6f0] ${
                    isComplete
                      ? "bg-[#6c9c45] text-white"
                      : isCurrent
                        ? "bg-brand-yellow text-brand-navy shadow-[0_0_0_6px_rgba(255,220,50,0.25)]"
                        : "bg-white text-[#9aa3af] ring-[#f7f6f0] outline outline-1 outline-[#ddd8ca]"
                  }`}
                >
                  {isComplete ? (
                    <Icon className="size-3.5" path="m5 12.5 4.5 4.5L19 7.5" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span
                  className={`mt-2 block px-1 text-xs leading-4 sm:text-xs ${
                    isCurrent || isComplete
                      ? "font-bold text-brand-navy"
                      : "font-medium text-[#8b95a2]"
                  }`}
                >
                  {t(step.label)}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      {!isDone && (
        <p className="mt-4 text-xs leading-5 text-[#65748a]">
          {t(
            "This timeline refreshes automatically. Email updates are sent when your order status changes.",
          )}
        </p>
      )}
    </section>
  );
}

function StarRating({ value, onChange, t }) {
  return (
    <fieldset>
      <legend className={labelClass}>{t("Rating")}</legend>
      <div className="mt-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <label className="cursor-pointer" key={star}>
            <input
              checked={value === star}
              className="peer sr-only"
              name="rating"
              onChange={() => onChange(star)}
              type="radio"
              value={star}
            />
            <span className="sr-only">{star} / 5</span>
            <svg
              aria-hidden="true"
              className={`size-8 rounded-md transition peer-focus-visible:ring-2 peer-focus-visible:ring-brand-yellow-deep ${
                star <= value
                  ? "text-[#f5b800]"
                  : "text-[#e2ded2] hover:text-[#f5d76e]"
              }`}
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7L12 3Z" />
            </svg>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function OrderReviewForm({ order, token, t, autoOpen = false, onReviewed }) {
  const detailsRef = useRef(null);
  const reviewInputRef = useRef(null);
  const [isOpen, setIsOpen] = useState(autoOpen);
  const reviewedItemIds = new Set(order.reviewedItemIds || []);
  const items = [
    ...new Map(
      order.items
        .filter((item) => item.productId && !reviewedItemIds.has(item.productId))
        .map((item) => [item.productId, item]),
    ).values(),
  ];
  const [itemId, setItemId] = useState(items[0]?.productId || "");
  const [applyToAll, setApplyToAll] = useState(items.length > 1);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Arriving from a review reminder opens this order's form and brings it into view.
  useLayoutEffect(() => {
    if (!autoOpen || !detailsRef.current) return;
    detailsRef.current.open = true;
    setIsOpen(true);
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      reviewInputRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      secondFrame = window.requestAnimationFrame(() => {
        reviewInputRef.current?.focus({ preventScroll: true });
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [autoOpen]);

  if (!items.length && !message) {
    return order.items.some((item) => item.productId) ? (
      <p className="mt-4 rounded-xl bg-[#eef6e8] px-4 py-3 text-sm font-semibold text-[#3f6b22]">
        {t("You’ve reviewed all items in this order.")}
      </p>
    ) : null;
  }

  async function submitReview(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    const itemIds = applyToAll ? items.map((item) => item.productId) : [itemId];
    try {
      await apiRequest("/customer/reviews", {
        method: "POST",
        token,
        body: {
          orderId: order.id,
          itemIds,
          rating,
          review,
        },
      });
      onReviewed?.(itemIds);
      setMessage(t("Thanks! Your review is awaiting approval."));
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <details
      className="group/review mt-5 scroll-mt-28 rounded-2xl ring-1 ring-[#fbfaf5] open:bg-[#fbfaf5]"
      id={`review-order-${order.id}`}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      open={isOpen}
      ref={detailsRef}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3.5 text-sm font-extrabold text-brand-navy transition hover:bg-[#f3f6f8] [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-xl bg-[#fff6cc] text-brand-yellow-deep">
            <Icon
              className="size-4"
              path="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7L12 3Z"
            />
          </span>
          {t("Review a purchased item")}
        </span>
        <Icon
          className="size-4 text-[#8b95a2] transition group-open/review:rotate-180"
          path="m6 9 6 6 6-6"
        />
      </summary>
      {message ? (
        <p
          className="mx-4 mb-4 rounded-xl bg-[#eef6e8] p-3 text-sm font-semibold text-[#3f6b22]"
          role="status"
        >
          {message}
        </p>
      ) : (
        <form className="space-y-4 px-4 pb-4" onSubmit={submitReview}>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            {items.length > 1 && (
              <label className="flex min-h-11 items-center gap-2.5 text-sm font-semibold text-[#65748a] sm:col-span-2">
                <input
                  checked={applyToAll}
                  className="size-4 accent-[#472a3b]"
                  onChange={(event) => setApplyToAll(event.target.checked)}
                  type="checkbox"
                />
                {t("Apply this rating to all purchased items")}
              </label>
            )}
            {!applyToAll && (
              <label className={labelClass}>
                {t("Product")}
                <select
                  className={fieldClass}
                  onChange={(event) => setItemId(event.target.value)}
                  value={itemId}
                >
                  {items.map((item) => (
                    <option key={item.productId} value={item.productId}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <StarRating onChange={setRating} t={t} value={rating} />
          </div>
          <label className={labelClass}>
            {t("Your review")}
            <textarea
              className={`${fieldClass} resize-y`}
              maxLength={200}
              onChange={(event) => setReview(event.target.value)}
              ref={reviewInputRef}
              rows={3}
              value={review}
            />
            <span
              aria-live="polite"
              className="mt-1 block text-right text-xs text-[#65748a]"
            >
              {review.length}/200
            </span>
          </label>
          {error && (
            <p
              className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
              role="alert"
            >
              {error}
            </p>
          )}
          <button className={primaryButton} disabled={saving} type="submit">
            {saving ? t("Submitting…") : t("Submit review")}
          </button>
        </form>
      )}
    </details>
  );
}

function OrderCard({
  order,
  formatPrice,
  language,
  t,
  isSaved,
  isSaving,
  isReordering,
  onSave,
  onReorder,
  onDelete,
  isDeleting,
}) {
  const itemCount = order.items.reduce(
    (count, item) => count + item.quantity,
    0,
  );
  const paymentIssue = isPaymentIssue(order);

  return (
    <article className="account-order-card overflow-hidden rounded-2xl bg-white ring-1 ring-[#e5e9ee]">
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-7 sm:pt-6">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#f4f6f8] text-brand-navy">
            <Icon path="M6 7h12l-1 13H7L6 7Zm3 0V6a3 3 0 0 1 6 0v1" />
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-lg font-extrabold text-brand-navy">
              {t("Order #{id}", { id: order.id })}
            </h3>
            <p className="mt-0.5 text-xs font-medium text-[#65748a]">
              {formatOrderDate(order.createdAt, language, t)} ·{" "}
              {t(itemCount === 1 ? "{count} item" : "{count} items", {
                count: itemCount,
              })}
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold ring-1 ${statusTone(order)}`}
        >
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full bg-current"
          />
          {orderStatus(order, t)}
        </span>
      </header>

      <div className="space-y-5 px-5 py-5 sm:px-7 sm:py-6">
        {!paymentIssue && <OrderProgress order={order} t={t} />}

        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,15rem)]">
          <div>
            <ul className="divide-y divide-[#f4f6f8]">
              {order.items.map((item, index) => (
                <li
                  className="flex items-center justify-between gap-4 py-2.5 text-sm first:pt-0"
                  key={`${order.id}-${index}`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="grid h-7 min-w-7 shrink-0 place-items-center rounded-md bg-[#f4f6f8] px-1.5 text-xs font-extrabold text-[#65748a]">
                      {item.quantity}×
                    </span>
                    <span className="truncate font-semibold text-brand-navy">
                      {item.name}
                    </span>
                  </span>
                  <span className="shrink-0 font-bold text-[#65748a]">
                    {formatPrice(item.lineTotalCents)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-between rounded-xl bg-[#f3f6f8] px-4 py-3">
              <span className="text-sm font-bold text-[#65748a]">
                {t("Total")}
              </span>
              <span className="font-display text-xl font-extrabold text-brand-navy">
                {formatPrice(order.totalCents)}
              </span>
            </div>
          </div>

          <dl className="space-y-3 text-sm">
            {order.scheduledFor && (
              <div className="rounded-2xl bg-[#f4f6f8] px-4 py-3">
                <dt className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#65748a]">
                  {t(
                    order.fulfillmentType === "pickup"
                      ? "Pickup scheduled"
                      : "Delivery scheduled",
                  )}
                </dt>
                <dd className="mt-1 font-bold text-brand-navy">
                  {new Date(order.scheduledFor).toLocaleString(
                    language === "fr" ? "fr-CM" : "en-CM",
                    { dateStyle: "medium", timeStyle: "short" },
                  )}
                </dd>
              </div>
            )}
            <div className="rounded-2xl bg-[#f4f6f8] px-4 py-3">
              <dt className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#65748a]">
                {t("Assigned store")}
              </dt>
              <dd className="mt-1 font-bold text-brand-navy">
                {t(order.storeName || "Store not recorded")}
              </dd>
              {order.storeAddress && (
                <dd className="mt-0.5 text-xs leading-5 text-[#65748a]">
                  {t(order.storeAddress)}
                </dd>
              )}
            </div>
            {(order.deliveryResidence || order.deliveryCity) && (
              <div className="rounded-2xl bg-[#f4f6f8] px-4 py-3">
                <dt className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#65748a]">
                  {t(
                    order.fulfillmentType === "pickup" ? "Pickup" : "Delivery",
                  )}
                </dt>
                <dd className="mt-1 text-xs font-semibold leading-5 text-[#65748a]">
                  {order.deliveryResidence
                    ? `${order.deliveryResidence}, `
                    : ""}
                  {order.deliveryCity}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {!paymentIssue && (
          <div className="flex flex-wrap justify-end gap-2.5 border-t border-[#fbfaf5] pt-5">
            <button
              className={ghostButton}
              disabled={isSaving || isSaved}
              onClick={onSave}
              type="button"
            >
              <Icon
                className="size-4"
                path={
                  isSaved ? "m5 12.5 4.5 4.5L19 7.5" : "M6 4h12v16l-6-4-6 4V4Z"
                }
              />
              {isSaving
                ? t("Saving…")
                : isSaved
                  ? t("Saved for later")
                  : t("Save cart")}
            </button>
            <button
              className={`${primaryButton} px-4 py-2.5 text-xs`}
              disabled={isReordering}
              onClick={onReorder}
              type="button"
            >
              <Icon
                className="size-4"
                path="M4 12a8 8 0 0 1 13.7-5.7L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.7L4 15.5M4 20v-4.5h4.5"
              />
              {isReordering ? t("Adding…") : t("Reorder")}
            </button>
            {onDelete && (
              <button
                aria-haspopup="dialog"
                className="group inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#f0c9c8] bg-[#fdf3f2] px-4 py-2.5 text-xs font-bold tracking-wide text-[#b44947] uppercase transition-all hover:border-[#b44947] hover:bg-[#b44947] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b44947] disabled:cursor-wait disabled:opacity-60"
                disabled={isDeleting}
                onClick={onDelete}
                type="button"
              >
                <Icon
                  className="size-4 transition-transform group-hover:scale-110"
                  path="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m3 0-1 13H8L7 7M10 11v6M14 11v6"
                />
                {isDeleting ? t("Removing…") : t("Remove")}
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function CustomerProfileDetails({ customer, onSave, t }) {
  const [profile, setProfile] = useState(() => ({
    name: customer.name || "",
    phone: customer.phone || "",
    deliveryCity: customer.deliveryCity || "",
    deliveryResidence: customer.deliveryResidence || "",
    profilePicture: customer.profilePicture || "",
  }));
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleProfilePictureChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    try {
      const nextProfilePicture = await resizeProfilePicture(file);
      setProfile((current) => ({
        ...current,
        profilePicture: nextProfilePicture,
      }));
    } catch (imageError) {
      console.error("Unable to prepare customer profile picture.", imageError);
      setError(t(imageError.message || "Could not load this profile picture."));
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSaving(true);
    try {
      await onSave(profile);
      setMessage(t("Saved delivery details updated."));
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="account-profile-form space-y-6" onSubmit={saveProfile}>
      <div className="flex flex-col gap-5 rounded-2xl bg-[#f3f6f8] p-5 sm:flex-row sm:items-center">
        <div className="relative w-fit">
          <Avatar
            customer={{
              name: profile.name,
              profilePicture: profile.profilePicture,
            }}
            size="size-24"
            text="text-4xl"
          />
          <span className="absolute -bottom-1 -right-1 grid size-9 place-items-center rounded-full bg-brand-navy text-white ring-4 ring-[#f3f6f8]">
            <Icon
              className="size-4"
              path="M4 8h3l2-3h6l2 3h3v11H4V8Zm8 9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
            />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-brand-navy">
            {t("Profile picture")}
          </p>
          <p className="mt-1 text-xs leading-5 text-[#65748a]">
            {t("Optional. Image will be resized before saving (5 MB max).")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <label
              className={`${ghostButton} cursor-pointer focus-within:ring-2 focus-within:ring-brand-yellow-deep`}
            >
              <Icon
                className="size-4"
                path="M12 16V4m0 0L7 9m5-5 5 5M5 20h14"
              />
              {t("Upload photo")}
              <input
                accept="image/*"
                className="sr-only"
                onChange={handleProfilePictureChange}
                type="file"
              />
            </label>
            {profile.profilePicture && (
              <button
                className="rounded-full px-3 py-2.5 text-xs font-bold text-[#a34d4d] transition hover:bg-red-50"
                onClick={() => setProfile({ ...profile, profilePicture: "" })}
                type="button"
              >
                {t("Remove")}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className={labelClass}>
          {t("Full name")}
          <input
            autoComplete="name"
            className={fieldClass}
            maxLength={100}
            onChange={(event) =>
              setProfile({ ...profile, name: event.target.value })
            }
            required
            value={profile.name}
          />
        </label>
        <label className={labelClass}>
          {t("Phone number")}
          <input
            autoComplete="tel"
            className={fieldClass}
            inputMode="tel"
            maxLength={40}
            onChange={(event) =>
              setProfile({ ...profile, phone: event.target.value })
            }
            value={profile.phone}
          />
        </label>
        <label className={labelClass}>
          {t("City / Cold Stone location")}
          <span className="relative block">
            <select
              className={`${fieldClass} appearance-none pr-11`}
              onChange={(event) =>
                setProfile({ ...profile, deliveryCity: event.target.value })
              }
              value={profile.deliveryCity}
            >
              <option value="">{t("Select a listed location")}</option>
              {cameroonDeliveryLocations.map((location) => (
                <option key={location.value} value={location.value}>
                  {t(location.town)} — {t(location.area)}
                </option>
              ))}
            </select>
            <Icon
              className="pointer-events-none absolute right-4 top-1/2 mt-1 size-4 -translate-y-1/2 text-[#8b95a2]"
              path="m6 9 6 6 6-6"
            />
          </span>
        </label>
        <label className={labelClass}>
          {t("Your residence")}
          <input
            autoComplete="street-address"
            className={fieldClass}
            maxLength={150}
            onChange={(event) =>
              setProfile({ ...profile, deliveryResidence: event.target.value })
            }
            value={profile.deliveryResidence}
          />
        </label>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-[#fbfaf5] pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div aria-live="polite" className="min-h-5 text-sm">
          {error && (
            <p className="font-semibold text-red-700" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p
              className="flex items-center gap-2 font-semibold text-[#3f6b22]"
              role="status"
            >
              <Icon className="size-4" path="m5 12.5 4.5 4.5L19 7.5" />
              {message}
            </p>
          )}
        </div>
        <button className={primaryButton} disabled={isSaving} type="submit">
          {isSaving ? t("Saving…") : t("Save delivery details")}
        </button>
      </div>
    </form>
  );
}

function RewardsCard({ points, t, compact = false }) {
  const rewardsAvailable = Math.floor(points / POINTS_PER_REWARD);
  const progress = points % POINTS_PER_REWARD;
  const remaining = POINTS_PER_REWARD - progress;

  return (
    <div className="account-rewards-card overflow-hidden rounded-2xl bg-brand-navy p-5 text-white sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-white/70">
            {t("Loyalty rewards")}
          </p>
          <p className="mt-2 font-display text-4xl font-extrabold leading-none sm:text-5xl">
            {formatPoints(points)}
            <span className="ml-2 text-base font-semibold text-white/70">
              {t("points")}
            </span>
          </p>
        </div>
        <span className="rounded-md bg-[#fff3b0] px-2.5 py-1 text-xs font-bold text-brand-yellow-deep">
          {formatPoints(rewardsAvailable)} {t("Rewards available")}
        </span>
      </div>

      <div className="mt-6">
        <div className="flex flex-wrap justify-between gap-2 text-xs font-semibold text-white/75">
          <span>
            {t("{points} points to your next reward", { points: remaining })}
          </span>
          <span>
            {progress}/{POINTS_PER_REWARD}
          </span>
        </div>
        <div
          aria-label={t("Progress to next reward")}
          aria-valuemax={POINTS_PER_REWARD}
          aria-valuemin={0}
          aria-valuenow={progress}
          className="mt-2 h-2 overflow-hidden rounded-full bg-white/20"
          role="progressbar"
        >
          <div
            className="h-full rounded-full bg-brand-yellow transition-[width] duration-500 motion-reduce:transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {!compact && (
        <div className="mt-5 flex flex-wrap items-baseline gap-x-2 border-t border-white/15 pt-4">
          <p className="text-xs font-semibold text-white/70">{t("Worth")}</p>
          <p className="font-display text-xl font-bold text-brand-yellow">
            {new Intl.NumberFormat("fr-CM").format(
              rewardsAvailable * REWARD_VALUE_FCFA,
            )}{" "}
            <span className="text-sm text-white/80">FCFA</span>
          </p>
        </div>
      )}

      <p className="mt-4 text-xs leading-5 text-white/70">
        {t("Earn 1 point per 100 FCFA. Redeem 100 points for 1,000 FCFA off.")}
      </p>
    </div>
  );
}

export function CustomerOrdersPage() {
  const { customer, isLoading, updateProfile, logout } = useAuth();
  const { t, language } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { addItemsToCart } = useCart();
  const [orders, setOrders] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [savedCarts, setSavedCarts] = useState([]);
  const [loyalty, setLoyalty] = useState(null);
  const [accountError, setAccountError] = useState("");
  const [accountNotice, setAccountNotice] = useState("");
  const [showCartLink, setShowCartLink] = useState(false);
  const [reorderingId, setReorderingId] = useState(null);
  const [savingOrderId, setSavingOrderId] = useState(null);
  const [deletingOrderId, setDeletingOrderId] = useState(null);
  const [orderToDelete, setOrderToDelete] = useState(null);
  const [deletingSavedCartId, setDeletingSavedCartId] = useState(null);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [orderFilter, setOrderFilter] = useState("all");
  const [error, setError] = useState("");

  const requestedTab = searchParams.get("tab");
  const activeTab = TABS.some((tab) => tab.key === requestedTab)
    ? requestedTab
    : "overview";

  const refreshOrders = useCallback(async () => {
    const token = getCustomerToken();
    const result = await apiRequest("/customer/orders", { token });
    setOrders(result.orders);
  }, []);

  useEffect(() => {
    if (!customer) return undefined;
    let cancelled = false;
    const token = getCustomerToken();
    Promise.all([
      apiRequest("/customer/favorites", { token }),
      apiRequest("/customer/saved-carts", { token }),
      apiRequest("/customer/loyalty", { token }),
    ])
      .then(([favoriteResult, savedCartResult, loyaltyResult]) => {
        if (cancelled) return;
        setFavorites(favoriteResult.favorites);
        setSavedCarts(savedCartResult.savedCarts);
        setLoyalty(loyaltyResult);
      })
      .catch((loadError) => {
        if (!cancelled) setAccountError(loadError.message);
      });
    return () => {
      cancelled = true;
    };
  }, [customer]);

  useEffect(() => {
    if (!customer) return undefined;
    let cancelled = false;
    const loadOrders = () =>
      refreshOrders()
        .catch((loadError) => {
          if (!cancelled) setError(loadError.message);
        })
        .finally(() => {
          if (!cancelled) setLoadingOrders(false);
        });
    loadOrders();
    const intervalId = window.setInterval(loadOrders, 15000);
    window.addEventListener("focus", loadOrders);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", loadOrders);
    };
  }, [customer, refreshOrders]);

  if (isLoading)
    return (
      <div className="grid min-h-screen place-items-center bg-[#f4f6f8] text-sm font-semibold text-[#65748a]">
        {t("Loading account…")}
      </div>
    );
  if (!customer)
    return (
      <Navigate
        replace
        state={{
          from: `${location.pathname}${location.search}${location.hash}`,
        }}
        to="/login"
      />
    );

  const formatPrice = (amount) =>
    `${numberFormatter(language === "fr" ? "fr-CM" : "en-CM").format(amount)} FCFA`;
  const points = loyalty?.points ?? customer.loyaltyPoints ?? 0;
  const referralCode = customer.referralCode || '';
  const referralLink = referralCode
    ? `${window.location.origin}/signup?ref=${encodeURIComponent(referralCode)}`
    : '';
  const firstName =
    (customer.name || "").trim().split(/\s+/)[0] || customer.name;
  const activeOrders = orders.filter(isActive);
  const currentOrder = activeOrders[0];
  const lastCompletedOrder = orders.find(isCompleted);
  const completedOrders = orders.filter(isCompleted);
  const reviewOrders = completedOrders.filter((order) =>
    order.items?.some((item) => item.productId && !(order.reviewedItemIds || []).includes(item.productId)),
  );
  const filteredOrders = orders.filter((order) =>
    orderFilter === "active"
      ? isActive(order)
      : orderFilter === "completed"
        ? isCompleted(order)
        : true,
  );
  const tabCounts = {
    orders: orders.length,
    saved: favorites.length + savedCarts.length,
    reviews: reviewOrders.length,
  };

  function selectTab(key) {
    setSearchParams(key === "overview" ? {} : { tab: key }, { replace: true });
    document
      .getElementById("account-panel")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleLogout() {
    try {
      await logout();
    } catch (logoutError) {
      setAccountError(logoutError.message);
    }
  }

  async function removeFavorite(itemId) {
    try {
      await apiRequest(`/customer/favorites/${encodeURIComponent(itemId)}`, {
        method: "DELETE",
        token: getCustomerToken(),
      });
      setFavorites((current) =>
        current.filter((favorite) => favorite.itemId !== itemId),
      );
    } catch (removeError) {
      setAccountError(removeError.message);
    }
  }

  async function reorderItems(items, actionId) {
    setReorderingId(actionId);
    setAccountError("");
    setAccountNotice("");
    setShowCartLink(false);
    try {
      const [menuResult, flavorResult] = await Promise.all([
        apiRequest("/menu"),
        apiRequest("/flavors"),
      ]);
      const catalog = new Map([
        ...menuResult.categories.flatMap((category) =>
          category.items.map((item) => [item.id, item]),
        ),
        ...flavorResult.flavors.map((flavor) => [
          `flavor:${flavor.id}`,
          flavor,
        ]),
      ]);
      const products = items.flatMap((item) => {
        const product = catalog.get(item.productId);
        return product ? [{ ...product, quantity: item.quantity }] : [];
      });
      const added = addItemsToCart(products);
      const requested = items.reduce((count, item) => count + item.quantity, 0);
      if (added > 0 && added === requested) navigate("/cart");
      else if (added > 0) {
        setAccountNotice(
          t(
            "Added {added} of {requested} items. Some products are unavailable or limited by stock.",
            { added, requested },
          ),
        );
        setShowCartLink(true);
      } else
        setAccountError(
          t("The products in this order are currently unavailable."),
        );
    } catch (reorderError) {
      setAccountError(reorderError.message);
    } finally {
      setReorderingId(null);
    }
  }

  async function saveOrder(order) {
    setSavingOrderId(order.id);
    setAccountError("");
    setAccountNotice("");
    setShowCartLink(false);
    try {
      const result = await apiRequest("/customer/saved-carts", {
        method: "POST",
        token: getCustomerToken(),
        body: { orderId: order.id },
      });
      setSavedCarts((current) => [
        result.savedCart,
        ...current.filter((savedCart) => savedCart.id !== result.savedCart.id),
      ]);
      setAccountNotice(
        t("Saved {label} for later.", { label: result.savedCart.label }),
      );
    } catch (saveError) {
      setAccountError(saveError.message);
    } finally {
      setSavingOrderId(null);
    }
  }

  async function removeSavedCart(savedCart) {
    setDeletingSavedCartId(savedCart.id);
    setAccountError("");
    setAccountNotice("");
    setShowCartLink(false);
    try {
      await apiRequest(`/customer/saved-carts/${savedCart.id}`, {
        method: "DELETE",
        token: getCustomerToken(),
      });
      setSavedCarts((current) =>
        current.filter((item) => item.id !== savedCart.id),
      );
    } catch (deleteError) {
      setAccountError(deleteError.message);
    } finally {
      setDeletingSavedCartId(null);
    }
  }

  async function confirmDeleteDeliveredOrder() {
    const order = orderToDelete;
    if (!order) return;
    setDeletingOrderId(order.id);
    setAccountError("");
    setAccountNotice("");
    try {
      await apiRequest(`/customer/orders/${encodeURIComponent(order.id)}`, {
        method: "DELETE",
        token: getCustomerToken(),
      });
      setOrders((current) => current.filter((entry) => entry.id !== order.id));
      setAccountNotice(t("Order removed from your history."));
    } catch (deleteError) {
      setAccountError(deleteError.message);
    } finally {
      setDeletingOrderId(null);
      setOrderToDelete(null);
    }
  }

  const renderOrderCard = (order) => {
    const isSaved = savedCarts.some(
      (savedCart) => savedCart.sourceOrderId === order.id,
    );
    return (
      <div key={order.id}>
        <OrderCard
          formatPrice={formatPrice}
          isReordering={reorderingId === order.id}
          isSaved={isSaved}
          isSaving={savingOrderId === order.id}
          language={language}
          onReorder={() => reorderItems(order.items, order.id)}
          onSave={() => saveOrder(order)}
          onDelete={isCompleted(order) ? () => setOrderToDelete(order) : null}
          isDeleting={deletingOrderId === order.id}
          order={order}
          t={t}
        />
        {!isPaymentIssue(order) && (
          <OrderReviewForm
            autoOpen={searchParams.get("review") === String(order.id)}
            onReviewed={(itemIds) => setOrders((current) => current.map((entry) =>
              entry.id === order.id
                ? { ...entry, reviewedItemIds: [...new Set([...(entry.reviewedItemIds || []), ...itemIds])] }
                : entry,
            ))}
            order={order}
            t={t}
            token={getCustomerToken()}
          />
        )}
      </div>
    );
  };

  const favoritesGrid = (list) => (
    <ul className="grid gap-3 sm:grid-cols-2">
      {list.map((favorite) => (
        <li
          className="group flex items-center gap-3.5 rounded-xl bg-white p-3 ring-1 ring-[#e5e9ee] transition-colors hover:bg-[#f4f6f8]"
          key={favorite.itemId}
        >
          <img
            decoding="async"
            loading="lazy"
            alt=""
            className="size-16 shrink-0 rounded-xl bg-[#f4f6f8] object-cover"
            src={favorite.item.image}
          />
          <div className="min-w-0 flex-1">
            <Link
              className="block truncate text-sm font-extrabold text-brand-navy transition hover:text-brand-yellow-deep"
              to={favorite.item.itemType === "menu" ? "/menu" : "/flavors"}
            >
              {favorite.item.name}
            </Link>
            <p className="mt-0.5 text-xs font-semibold text-[#8b95a2]">
              {t(favorite.item.itemType === "menu" ? "Menu" : "Flavors")}
            </p>
          </div>
          <button
            aria-label={`${t("Remove")} ${favorite.item.name}`}
            className="grid size-9 shrink-0 place-items-center rounded-full text-[#b44947] transition hover:bg-red-50"
            onClick={() => removeFavorite(favorite.itemId)}
            title={t("Remove")}
            type="button"
          >
            <svg
              aria-hidden="true"
              className="size-[18px]"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
            </svg>
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="customer-account min-h-screen bg-[#f4f6f8] text-brand-navy">
      <Header />
      <main id="main" tabIndex={-1}>
        {/* Hero */}
        <section className="account-masthead relative isolate overflow-hidden bg-brand-navy text-white">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <HeroBackground animated quietOnMobile variant="navy" theme="ice-cream" />
          </div>
          <div className="account-masthead-inner relative z-10 mx-auto max-w-[1200px] px-5 pb-7 pt-7 sm:px-8 sm:pb-8 sm:pt-9 lg:px-10">
            <div className="account-identity-row flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-4 sm:gap-5">
                <Avatar
                  customer={customer}
                  size="size-[60px] sm:size-[72px]"
                  text="text-2xl sm:text-3xl"
                />
                <div className="min-w-0">
                  <p className="account-context text-xs font-semibold text-white/65">
                    {t("Cold Stone Creamery")}
                  </p>
                  <h1 className="mt-1 break-words font-display text-2xl font-bold leading-tight sm:text-3xl">
                    {firstName ? t("Welcome back, {name}", { name: firstName }) : t("My account")}
                  </h1>
                  <p className="account-identity-detail mt-1 truncate text-sm text-white/70">
                    <span>{customer.name || firstName}</span>
                    <span aria-hidden="true"> · </span>
                    {customer.email}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2.5 sm:shrink-0">
                <Link
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-yellow px-4 py-2.5 text-sm font-bold text-brand-navy transition-colors hover:bg-brand-gold-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy"
                  to="/menu"
                >
                  {t("Browse the menu")}
                  <Icon className="size-4" path="M5 12h14m-5-5 5 5-5 5" />
                </Link>
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/30 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:border-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy"
                  to="/custom-cake"
                >
                  {t("Design a custom cake")}
                </Link>
              </div>
            </div>

            <dl className="account-summary mt-7 grid grid-cols-2 border-t border-white/20 pt-4 sm:grid-cols-4">
              {[
                { label: t("Orders"), value: orders.length },
                { label: t("Active orders"), value: activeOrders.length },
                { label: t("Saved favorites"), value: favorites.length },
                {
                  label: t("Loyalty rewards"),
                  value: `${formatPoints(points)} ${t("pts")}`,
                  accent: true,
                },
              ].map((stat, index) => (
                <div
                  className={`min-w-0 py-2 sm:py-1 ${index % 2 === 1 ? "border-l border-white/15 pl-3" : "pr-3"} ${index > 0 ? "sm:border-l sm:border-white/20 sm:pl-5" : ""} ${index >= 2 ? "border-t border-white/15 sm:border-t-0 sm:pt-1" : ""} ${index === 2 ? "sm:pl-5" : ""}`}
                  key={stat.label}
                >
                  <dt className="truncate text-xs font-medium text-white/65">
                    {stat.label}
                  </dt>
                  <dd
                    className={`mt-1 truncate font-display text-xl font-bold tabular-nums sm:text-2xl ${stat.accent ? "text-brand-yellow" : "text-white"}`}
                  >
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <div className="account-body mx-auto max-w-[1200px] px-5 pb-16 pt-5 sm:px-8 sm:pt-7 lg:px-10">
          {(accountError || accountNotice) && (
            <div className="mt-5 space-y-3">
              {accountError && (
                <p
                  className="flex items-start gap-3 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700 ring-1 ring-red-100"
                  role="alert"
                >
                  <Icon
                    className="mt-px size-[18px] shrink-0"
                    path="M12 8v5m0 3.5v.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
                  />
                  {accountError}
                </p>
              )}
              {accountNotice && (
                <div
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#eef6e8] p-4 text-sm font-semibold text-[#3f6b22] ring-1 ring-[#cfe3bf]"
                  role="status"
                >
                  <span>{accountNotice}</span>
                  {showCartLink && (
                    <Link
                      className="font-extrabold underline underline-offset-4"
                      to="/cart"
                    >
                      {t("View shopping bag")}
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="account-workspace mt-4 grid items-start gap-5 lg:mt-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
            {/* Navigation */}
            <nav
              aria-label={t("Account sections")}
              className="account-navigation relative z-10 -mx-5 overflow-x-auto px-5 [scrollbar-width:none] sm:-mx-8 sm:px-8 lg:sticky lg:top-[calc(var(--site-header-offset,0px)+1.5rem)] lg:transition-[top] lg:duration-300 lg:mx-0 lg:overflow-visible lg:px-0"
            >
              <ul className="flex w-max gap-1.5 lg:w-auto lg:flex-col lg:gap-1">
                {TABS.map((tab) => {
                  const isCurrent = tab.key === activeTab;
                  const count = tabCounts[tab.key];
                  return (
                    <li key={tab.key}>
                      <button
                        aria-current={isCurrent ? "page" : undefined}
                        className={`flex min-h-11 items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow-deep lg:w-full ${
                          isCurrent
                            ? "bg-[#fff5c2] text-brand-navy"
                            : "bg-white text-[#65748a] ring-1 ring-[#e5e9ee] hover:bg-[#f4f6f8] hover:text-brand-navy lg:bg-transparent lg:ring-0 lg:hover:bg-[#eef1f4]"
                        }`}
                        onClick={() => selectTab(tab.key)}
                        type="button"
                      >
                        <span
                          className={`hidden size-5 shrink-0 place-items-center lg:grid ${isCurrent ? "text-brand-yellow-deep" : "text-[#718095]"}`}
                        >
                          <Icon path={tab.icon} />
                        </span>
                        <span className="flex-1 text-left">{t(tab.label)}</span>
                        {count > 0 && (
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-xs ${
                              isCurrent
                                ? "bg-white/70 text-brand-yellow-deep"
                                : "bg-[#f4f6f8] text-[#65748a]"
                            }`}
                          >
                            {count}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
                <li className="lg:mt-2 lg:border-t lg:border-[#e5e9ee] lg:pt-2">
                  <button
                    className="group/logout flex min-h-11 w-full items-center gap-3 whitespace-nowrap rounded-lg bg-white px-3 py-2.5 text-sm font-semibold text-[#65748a] ring-1 ring-[#e5e9ee] transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 lg:bg-transparent lg:ring-0"
                    onClick={handleLogout}
                    type="button"
                  >
                    <span className="hidden size-5 shrink-0 place-items-center lg:grid">
                      <Icon path="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l4-4-4-4M14 12H4" />
                    </span>
                    {t("Log out")}
                  </button>
                </li>
              </ul>
            </nav>

            {/* Panels */}
            <div
              className="account-sheet min-w-0 scroll-mt-24"
              id="account-panel"
              aria-label={t(
                TABS.find((tab) => tab.key === activeTab)?.label || "Overview",
              )}
            >
              {activeTab === "overview" && (
                <div className="space-y-8">
                  <section>
                    <SectionHeading
                      action={
                        orders.length > 0 && (
                          <button
                            className={ghostButton}
                            onClick={() => selectTab("orders")}
                            type="button"
                          >
                            {t("View all orders")}
                            <Icon
                              className="size-4"
                              path="M5 12h14m-5-5 5 5-5 5"
                            />
                          </button>
                        )
                      }
                      eyebrow={t("Right now")}
                      title={t("Current order")}
                    />
                    {loadingOrders ? (
                      <div className="h-64 animate-pulse rounded-2xl bg-white ring-1 ring-[#e5e9ee]" />
                    ) : currentOrder ? (
                      renderOrderCard(currentOrder)
                    ) : (
                      <EmptyState
                        body={t(
                          "When you place an order, you can follow it here in real time.",
                        )}
                        icon="M6 7h12l-1 13H7L6 7Zm3 0V6a3 3 0 0 1 6 0v1"
                        title={t("No active orders")}
                      >
                        <div className="mt-6 flex flex-wrap justify-center gap-3">
                          <Link className={primaryButton} to="/menu">
                            {t("Browse the menu")}
                          </Link>
                          {lastCompletedOrder && (
                            <button
                              className={ghostButton}
                              disabled={reorderingId === lastCompletedOrder.id}
                              onClick={() =>
                                reorderItems(
                                  lastCompletedOrder.items,
                                  lastCompletedOrder.id,
                                )
                              }
                              type="button"
                            >
                              {reorderingId === lastCompletedOrder.id
                                ? t("Adding…")
                                : t("Order your last treat again")}
                            </button>
                          )}
                        </div>
                      </EmptyState>
                    )}
                  </section>

                  <section
                    aria-labelledby="account-review-shortcut-title"
                    className="relative overflow-hidden rounded-2xl bg-[#fff7d6] p-5 ring-1 ring-[#f0df9e] sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-6"
                  >
                    <div className="flex items-start gap-4">
                      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-yellow text-brand-navy">
                        <Icon className="size-6" path={TABS.find((tab) => tab.key === "reviews").icon} />
                      </span>
                      <div>
                        <h2 className="font-display text-lg font-extrabold text-brand-navy" id="account-review-shortcut-title">
                          {t("Your reviews")}
                        </h2>
                        <p className="mt-1 max-w-xl text-sm leading-6 text-[#65748a]">
                          {loadingOrders
                            ? t("Your delivered orders and review options are here.")
                            : reviewOrders.length
                            ? t("You have {count} delivered orders waiting for a review.", { count: reviewOrders.length })
                            : t("Rate items from your delivered orders and share what you loved.")}
                        </p>
                      </div>
                    </div>
                    <button
                      className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-navy px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow-deep focus-visible:ring-offset-2 sm:mt-0 sm:w-auto sm:shrink-0"
                      onClick={() => selectTab("reviews")}
                      type="button"
                    >
                      {t(reviewOrders.length ? "Write a review" : "View my reviews")}
                      {reviewOrders.length > 0 && (
                        <span className="grid min-w-5 place-items-center rounded-full bg-white/15 px-1.5 py-0.5 text-xs">
                          {reviewOrders.length}
                        </span>
                      )}
                      <Icon className="size-4" path="M5 12h14m-5-5 5 5-5 5" />
                    </button>
                  </section>

                  {referralCode && (
                    <section className="rounded-2xl bg-white p-5 ring-1 ring-[#e3dfd3] sm:p-6">
                      <p className={eyebrowClass}>{t("Refer a friend")}</p>
                      <h2 className="mt-2 font-display text-xl font-extrabold text-brand-navy">
                        {t("Give a friend a treat, earn {points} points", { points: 50 })}
                      </h2>
                      <p className="mt-2 max-w-xl text-sm leading-6 text-[#65748a]">
                        {t(
                          "Share your code. When your friend signs up with it and places their first order, {points} points land in your balance.",
                          { points: 50 },
                        )}
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <span className="inline-flex min-h-11 items-center rounded-xl bg-[#f4f6f8] px-4 font-display text-lg font-extrabold tracking-[0.08em] text-brand-navy ring-1 ring-dashed ring-[#c9c3b4]">
                          {referralCode}
                        </span>
                        <button
                          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-navy px-5 text-sm font-extrabold text-white transition hover:bg-brand-blue"
                          onClick={() => {
                            // A colon right before the link stops WhatsApp treating it as one,
                            // so the invitation and the link sit on separate lines.
                            const text = `${t("Join me at Cold Stone Creamery — use my code {code}", { code: referralCode })}\n\n${referralLink} `;
                            if (navigator.share) {
                              navigator.share({ title: t("Cold Stone Creamery"), text, url: referralLink }).catch(() => {});
                            } else {
                              navigator.clipboard?.writeText(text);
                            }
                          }}
                          type="button"
                        >
                          {t("Invite a friend")}
                        </button>
                        <a
                          className="inline-flex min-h-11 items-center rounded-full bg-[#25D366] px-5 text-sm font-extrabold text-white transition hover:brightness-95"
                          href={`https://wa.me/?text=${encodeURIComponent(`${t("Join me at Cold Stone Creamery — use my code {code}", { code: referralCode })}\n\n${referralLink} `)}`}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {t("Share on WhatsApp")}
                        </a>
                      </div>
                    </section>
                  )}

                  <section className="account-benefits grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <RewardsCard points={points} t={t} />
                    <div className={cardClass}>
                      <p className={eyebrowClass}>{t("Shortcuts")}</p>
                      <h2 className="mt-2 font-display text-xl font-extrabold text-brand-navy">
                        {t("Quick actions")}
                      </h2>
                      <div className="account-shortcuts mt-5 grid grid-cols-2 gap-3">
                        {[
                          {
                            label: t("Browse the menu"),
                            to: "/menu",
                            icon: "M4 6h16M4 12h16M4 18h10",
                          },
                          {
                            label: t("Design a custom cake"),
                            to: "/custom-cake",
                            icon: "M4 20h16M5 20v-7h14v7M8 13V9h8v4M12 9V5",
                          },
                          {
                            label: t("Flavors"),
                            to: "/flavors",
                            icon: "M6 7h12l-1 13H7L6 7Zm3 0V6a3 3 0 0 1 6 0v1",
                          },
                          {
                            label: t("Contact us"),
                            to: "/contact",
                            icon: "M4 6h16v12H4V6Zm0 0 8 7 8-7",
                          },
                        ].map((action) => (
                          <Link
                            className="group flex flex-col gap-3 rounded-xl bg-[#f3f6f8] p-4 text-sm font-extrabold text-brand-navy transition-colors hover:bg-[#e9eef3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow-deep"
                            key={action.to}
                            to={action.to}
                          >
                            <span className="grid size-10 place-items-center rounded-lg bg-white text-brand-yellow-deep transition-colors group-hover:bg-brand-yellow group-hover:text-brand-navy">
                              <Icon path={action.icon} />
                            </span>
                            {action.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </section>

                  <PromotionAlertsSetting />
                  {favorites.length > 0 && (
                    <section>
                      <SectionHeading
                        action={
                          <button
                            className={ghostButton}
                            onClick={() => selectTab("saved")}
                            type="button"
                          >
                            {t("View all")}
                            <Icon
                              className="size-4"
                              path="M5 12h14m-5-5 5 5-5 5"
                            />
                          </button>
                        }
                        eyebrow={t("Your collection")}
                        title={t("Saved favorites")}
                      />
                      {favoritesGrid(favorites.slice(0, 4))}
                    </section>
                  )}
                </div>
              )}

              {activeTab === "orders" && (
                <section aria-labelledby="account-orders-title">
                  <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <p className={eyebrowClass}>{t("My account")}</p>
                      <h2
                        className="mt-2 font-display text-2xl font-extrabold text-brand-navy sm:text-[1.75rem]"
                        id="account-orders-title"
                      >
                        {t("Order history and status")}
                      </h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div
                        className="flex rounded-lg bg-white p-1 ring-1 ring-[#e5e9ee]"
                        role="group"
                        aria-label={t("Filter orders")}
                      >
                        {[
                          { key: "all", label: t("All") },
                          { key: "active", label: t("In progress") },
                          { key: "completed", label: t("Completed") },
                        ].map((filter) => (
                          <button
                            aria-pressed={orderFilter === filter.key}
                            className={`rounded-md px-3.5 py-1.5 text-xs font-extrabold transition ${
                              orderFilter === filter.key
                                ? "bg-brand-navy text-white"
                                : "text-[#65748a] hover:text-brand-navy"
                            }`}
                            key={filter.key}
                            onClick={() => setOrderFilter(filter.key)}
                            type="button"
                          >
                            {filter.label}
                          </button>
                        ))}
                      </div>
                      <button
                        aria-label={t("Refresh order status")}
                        className="grid size-9 place-items-center rounded-lg bg-white text-[#65748a] ring-1 ring-[#e5e9ee] transition hover:text-brand-navy disabled:opacity-50"
                        disabled={loadingOrders}
                        onClick={() =>
                          refreshOrders().catch((loadError) =>
                            setError(loadError.message),
                          )
                        }
                        title={t("Refresh order status")}
                        type="button"
                      >
                        <Icon
                          className="size-4"
                          path="M4 12a8 8 0 0 1 13.7-5.7L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.7L4 15.5M4 20v-4.5h4.5"
                        />
                      </button>
                    </div>
                  </div>
                  {error && (
                    <p
                      className="mb-4 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700 ring-1 ring-red-100"
                      role="alert"
                    >
                      {error}
                    </p>
                  )}
                  {loadingOrders ? (
                    <div className="space-y-4">
                      {[0, 1].map((key) => (
                        <div
                          className="h-56 animate-pulse rounded-2xl bg-white ring-1 ring-[#e5e9ee]"
                          key={key}
                        />
                      ))}
                    </div>
                  ) : filteredOrders.length ? (
                    <div className="space-y-5">
                      {filteredOrders.map(renderOrderCard)}
                    </div>
                  ) : (
                    <EmptyState
                      body={
                        orders.length
                          ? t("No orders match this filter.")
                          : t("You have not placed any orders yet.")
                      }
                      icon="M6 7h12l-1 13H7L6 7Zm3 0V6a3 3 0 0 1 6 0v1"
                      title={t("No orders yet")}
                    >
                      <Link className={`${primaryButton} mt-6`} to="/menu">
                        {t("Browse the menu")}
                      </Link>
                    </EmptyState>
                  )}
                </section>
              )}

              {activeTab === "reviews" && (
                <section aria-labelledby="account-reviews-title">
                  <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <p className={eyebrowClass}>{t("Your feedback")}</p>
                      <h2
                        className="mt-2 font-display text-2xl font-extrabold text-brand-navy sm:text-[1.75rem]"
                        id="account-reviews-title"
                      >
                        {t("Your reviews")}
                      </h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#65748a]">
                        {t("Choose a delivered order to rate the items you’ve enjoyed. Your review will appear after approval.")}
                      </p>
                    </div>
                    <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-[#fff5c2] px-3 text-sm font-bold text-brand-navy">
                      <Icon className="size-4 text-brand-yellow-deep" path={REVIEW_ICON} />
                      {t("{count} orders to review", { count: reviewOrders.length })}
                    </span>
                  </div>
                  {loadingOrders ? (
                    <div className="h-48 animate-pulse rounded-2xl bg-white ring-1 ring-[#e5e9ee]" />
                  ) : reviewOrders.length ? (
                    <div className="space-y-5">
                      {reviewOrders.map(renderOrderCard)}
                    </div>
                  ) : completedOrders.length ? (
                    <EmptyState
                      body={t("You’ve reviewed every item in your delivered orders. Thank you for sharing your feedback.")}
                      icon={REVIEW_ICON}
                      title={t("You’re all caught up")}
                    >
                      <button className={`${ghostButton} mt-5`} onClick={() => selectTab("orders")} type="button">
                        {t("View order history")}
                      </button>
                    </EmptyState>
                  ) : (
                    <EmptyState
                      body={t("Once an order is delivered, you can rate its items here.")}
                      icon={REVIEW_ICON}
                      title={t("No delivered orders yet")}
                    >
                      <button className={`${primaryButton} mt-5`} onClick={() => selectTab("orders")} type="button">
                        {t("View order history")}
                      </button>
                    </EmptyState>
                  )}
                </section>
              )}

              {activeTab === "saved" && (
                <div className="space-y-10">
                  <section>
                    <SectionHeading
                      description={t(
                        "Current prices and stock are checked when you add a saved cart.",
                      )}
                      eyebrow={t("Your collection")}
                      title={t("Saved carts")}
                    />
                    {savedCarts.length ? (
                      <ul className="grid gap-4 md:grid-cols-2">
                        {savedCarts.map((savedCart) => {
                          const count = savedCart.items.reduce(
                            (total, item) => total + item.quantity,
                            0,
                          );
                          return (
                            <li
                              className={`${cardClass} flex flex-col sm:p-6`}
                              key={savedCart.id}
                            >
                              <div className="flex items-start gap-3.5">
                                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#fff6cc] text-brand-yellow-deep">
                                  <Icon path="M6 4h12v16l-6-4-6 4V4Z" />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-display text-lg font-extrabold text-brand-navy">
                                    {t(savedCart.label)}
                                  </p>
                                  <p className="text-xs font-semibold text-[#65748a]">
                                    {t("{count} items", { count })}
                                  </p>
                                </div>
                              </div>
                              <ul className="mt-4 flex-1 space-y-1.5 text-sm text-[#65748a]">
                                {savedCart.items
                                  .slice(0, 3)
                                  .map((item, index) => (
                                    <li
                                      className="flex gap-2"
                                      key={`${savedCart.id}-${index}`}
                                    >
                                      <span className="font-extrabold text-brand-navy">
                                        {item.quantity}×
                                      </span>
                                      <span className="truncate">
                                        {item.name}
                                      </span>
                                    </li>
                                  ))}
                                {savedCart.items.length > 3 && (
                                  <li className="text-xs font-semibold text-[#8b95a2]">
                                    {t("+{count} more", {
                                      count: savedCart.items.length - 3,
                                    })}
                                  </li>
                                )}
                              </ul>
                              <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#fbfaf5] pt-4">
                                <button
                                  className="text-xs font-bold text-[#a34d4d] transition hover:text-red-800 disabled:opacity-50"
                                  disabled={
                                    deletingSavedCartId === savedCart.id
                                  }
                                  onClick={() => removeSavedCart(savedCart)}
                                  type="button"
                                >
                                  {deletingSavedCartId === savedCart.id
                                    ? t("Removing…")
                                    : t("Remove")}
                                </button>
                                <button
                                  className={`${primaryButton} px-4 py-2.5 text-xs`}
                                  disabled={
                                    reorderingId === `saved-${savedCart.id}`
                                  }
                                  onClick={() =>
                                    reorderItems(
                                      savedCart.items,
                                      `saved-${savedCart.id}`,
                                    )
                                  }
                                  type="button"
                                >
                                  {reorderingId === `saved-${savedCart.id}`
                                    ? t("Adding…")
                                    : t("Add saved cart to bag")}
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <EmptyState
                        body={t(
                          "No saved carts yet. Save a paid order to quickly rebuild its cart later.",
                        )}
                        icon="M6 4h12v16l-6-4-6 4V4Z"
                        title={t("Nothing saved yet")}
                      />
                    )}
                  </section>

                  <section>
                    <SectionHeading
                      eyebrow={t("Your collection")}
                      title={t("Saved favorites")}
                    />
                    {favorites.length ? (
                      favoritesGrid(favorites)
                    ) : (
                      <EmptyState
                        body={t("Tap the heart on any treat to keep it here.")}
                        icon="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"
                        title={t("No saved favorites yet.")}
                      >
                        <Link className={`${primaryButton} mt-6`} to="/flavors">
                          {t("Explore flavors")}
                        </Link>
                      </EmptyState>
                    )}
                  </section>
                </div>
              )}

              {activeTab === "rewards" && (
                <section>
                  <SectionHeading
                    description={t(
                      "Earn 1 point per 100 FCFA. Redeem 100 points for 1,000 FCFA off.",
                    )}
                    eyebrow={t("Loyalty rewards")}
                    title={t("Your rewards")}
                  />
                  <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                    <RewardsCard points={points} t={t} />
                    <div className={cardClass}>
                      <h3 className="font-display text-lg font-extrabold text-brand-navy">
                        {t("Points history")}
                      </h3>
                      {loyalty?.entries?.length ? (
                        <ul className="mt-4 divide-y divide-[#fbfaf5]">
                          {loyalty.entries.map((entry) => (
                            <li
                              className="flex items-center justify-between gap-3 py-3"
                              key={entry.id}
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <span
                                  className={`grid size-9 shrink-0 place-items-center rounded-xl ${
                                    entry.pointsDelta > 0
                                      ? "bg-[#eef6e8] text-[#3f6b22]"
                                      : "bg-[#fff0ed] text-[#b44947]"
                                  }`}
                                >
                                  <Icon
                                    className="size-4"
                                    path={
                                      entry.pointsDelta > 0
                                        ? "M12 19V5m-6 6 6-6 6 6"
                                        : "M12 5v14m6-6-6 6-6-6"
                                    }
                                  />
                                </span>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold capitalize text-brand-navy">
                                    {t(entry.entryType)}
                                  </p>
                                  <p className="text-xs text-[#65748a]">
                                    {t("Order #{id}", { id: entry.orderId })}
                                  </p>
                                </div>
                              </div>
                              <span
                                className={`shrink-0 font-display text-lg font-extrabold ${
                                  entry.pointsDelta > 0
                                    ? "text-[#3f6b22]"
                                    : "text-[#b44947]"
                                }`}
                              >
                                {entry.pointsDelta > 0 ? "+" : ""}
                                {entry.pointsDelta}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-4 rounded-xl bg-[#f3f6f8] p-5 text-sm leading-6 text-[#65748a]">
                          {t(
                            "Your points will appear here after your first paid order.",
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {activeTab === "profile" && (
                <section>
                  <SectionHeading
                    description={t(
                      "Keep your contact and delivery information up to date.",
                    )}
                    eyebrow={t("Account profile")}
                    title={t("Saved delivery details")}
                  />
                  <div className={cardClass}>
                    <CustomerProfileDetails
                      customer={customer}
                      onSave={updateProfile}
                      t={t}
                    />
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      </main>
      {orderToDelete && (
        <div className="fixed inset-0 z-[60] grid place-items-center px-5" role="presentation">
          <button
            aria-label={t("Cancel")}
            className="absolute inset-0 bg-brand-navy/50 backdrop-blur-[2px]"
            onClick={() => setOrderToDelete(null)}
            tabIndex={-1}
            type="button"
          />
          <section
            aria-labelledby="delete-order-title"
            aria-modal="true"
            className="relative w-full max-w-md rounded-[22px] bg-white p-6 shadow-[0_30px_80px_rgba(9,42,83,0.3)]"
            role="dialog"
          >
            <div className="flex items-start gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#fdf0ef] text-[#b44947]">
                <Icon
                  className="size-6"
                  path="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m3 0-1 13H8L7 7M10 11v6M14 11v6"
                />
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-lg font-extrabold text-brand-navy" id="delete-order-title">
                  {t("Remove order #{id}?", { id: orderToDelete.id })}
                </h2>
                <p className="mt-1.5 text-sm leading-6 text-[#65748a]">
                  {t("This order will be removed from your order history. The store keeps its own record of it.")}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2.5">
              <button
                className="inline-flex min-h-10 items-center rounded-lg border border-[#dce3eb] bg-white px-4 text-sm font-semibold text-brand-navy transition hover:border-[#bac7d5] focus-visible:outline-2 focus-visible:outline-brand-navy"
                disabled={deletingOrderId === orderToDelete.id}
                onClick={() => setOrderToDelete(null)}
                type="button"
              >
                {t("Cancel")}
              </button>
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#b44947] px-4 text-sm font-bold text-white transition hover:bg-[#9c3937] focus-visible:outline-2 focus-visible:outline-[#b44947] disabled:cursor-wait disabled:opacity-60"
                disabled={deletingOrderId === orderToDelete.id}
                onClick={confirmDeleteDeliveredOrder}
                type="button"
              >
                <Icon
                  className="size-4"
                  path="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m3 0-1 13H8L7 7M10 11v6M14 11v6"
                />
                {deletingOrderId === orderToDelete.id ? t("Removing…") : t("Remove")}
              </button>
            </div>
          </section>
        </div>
      )}
      <Footer />
    </div>
  );
}
