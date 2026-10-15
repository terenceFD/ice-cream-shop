import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { apiRequest, getCustomerToken } from "../../../api/api";
import { Footer, Header } from "../../../components/Layout";
import { useCart } from "../../../useCart";
import { useAuth } from "../../../authcontext/useAuth";
import { cameroonDeliveryLocations } from "../../../data";
import { useLanguage } from "../../../language/useLanguage";
import { PromotionAlertsSetting } from "../../../components/PromotionAlerts";

const fieldClass =
  "mt-2 w-full rounded-2xl border border-[#e3dfd3] bg-[#fbfaf5] px-4 py-3.5 text-sm font-semibold text-[#102c50] transition placeholder:font-medium placeholder:text-[#9aa3af] hover:border-[#cfcabb] focus:border-[#bd9c00] focus:bg-white focus:ring-4 focus:ring-[#ffdc32]/25 outline-none!";
const labelClass = "block text-xs font-extrabold text-[#52647b]";
const cardClass =
  "rounded-[26px] bg-white p-5 shadow-[0_10px_30px_rgba(18,44,80,0.05)] ring-1 ring-[#ebe7dc] sm:p-7";
const eyebrowClass =
  "flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#8a7000] before:h-px before:w-5 before:bg-[#d6bd4a]";
const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-full bg-[#092a53] px-5 py-3 text-sm font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-[#163e6b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] focus-visible:ring-offset-2 disabled:translate-y-0 disabled:cursor-wait disabled:opacity-55";
const ghostButton =
  "inline-flex items-center justify-center gap-2 rounded-full border border-[#dcd8cc] bg-white px-4 py-2.5 text-xs font-extrabold text-[#52647b] transition hover:border-[#092a53] hover:text-[#092a53] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] disabled:cursor-not-allowed disabled:opacity-50";

const PROFILE_IMAGE_DIMENSION = 256;
const MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024;
const POINTS_PER_REWARD = 100;
const REWARD_VALUE_FCFA = 1000;

const TABS = [
  { key: "overview", label: "Overview", icon: "M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z" },
  { key: "orders", label: "Orders", icon: "M6 7h12l-1 13H7L6 7Zm3 0V6a3 3 0 0 1 6 0v1" },
  { key: "saved", label: "Saved", icon: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" },
  { key: "rewards", label: "Rewards", icon: "M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7L12 3Z" },
  { key: "profile", label: "Profile", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" },
];

function Icon({ path, className = "size-[18px]" }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d={path} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
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
  return order.status === "pending_payment" || order.status === "payment_failed";
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
  if (isCompleted(order))
    return "bg-[#eef6e8] text-[#3f6b22] ring-[#cfe3bf]";
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
    <img decoding="async" loading="lazy"
      alt={customer.name || ""}
      className={`${size} shrink-0 rounded-full object-cover`}
      src={customer.profilePicture}
    />
  ) : (
    <span
      aria-hidden="true"
      className={`${size} ${text} grid shrink-0 place-items-center rounded-full bg-[#ffdc32] font-display font-extrabold text-[#092a53]`}
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
        <h2 className="mt-2 font-display text-2xl font-extrabold leading-tight text-[#092a53] sm:text-[1.75rem]">
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
    <div className="rounded-[26px] border border-dashed border-[#dcd6c4] bg-[#fdfcf7] px-6 py-12 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-white text-[#8a7000] shadow-sm ring-1 ring-[#ece6d2]">
        <Icon className="size-6" path={icon} />
      </span>
      <h3 className="mt-4 font-display text-xl font-extrabold text-[#092a53]">
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
  const fill = steps.length > 1 ? (currentIndex / (steps.length - 1)) * 100 : 100;

  return (
    <section
      aria-label={t("Live order tracking")}
      aria-live="polite"
      aria-atomic="true"
      className="rounded-2xl bg-[#f7f6f0] p-4 ring-1 ring-[#ece8dc] sm:p-5"
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-extrabold text-[#102c50]">
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
            className="h-full rounded-full bg-gradient-to-r from-[#6c9c45] to-[#8cbc5f] transition-[width] duration-700"
            style={{ width: `${fill}%` }}
          />
        </div>
        <ol
          className="relative grid items-start"
          style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
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
                  className={`mx-auto grid size-[30px] place-items-center rounded-full text-[11px] font-extrabold ring-4 ring-[#f7f6f0] ${
                    isComplete
                      ? "bg-[#6c9c45] text-white"
                      : isCurrent
                        ? "bg-[#ffdc32] text-[#092a53] shadow-[0_0_0_6px_rgba(255,220,50,0.25)]"
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
                  className={`mt-2 block px-1 text-[10px] leading-4 sm:text-xs ${
                    isCurrent || isComplete
                      ? "font-bold text-[#102c50]"
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
        <p className="mt-4 text-[11px] leading-5 text-[#65748a]">
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
              className={`size-8 rounded-md transition peer-focus-visible:ring-2 peer-focus-visible:ring-[#bd9c00] ${
                star <= value ? "text-[#f5b800]" : "text-[#e2ded2] hover:text-[#f5d76e]"
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

function OrderReviewForm({ order, token, t, autoOpen = false }) {
  const detailsRef = useRef(null);
  const [itemId, setItemId] = useState(
    order.items.find((item) => item.productId)?.productId || "",
  );
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const items = order.items.filter((item) => item.productId);

  // Arriving from a review reminder opens this order's form and brings it into view.
  useEffect(() => {
    if (!autoOpen || !detailsRef.current) return;
    detailsRef.current.open = true;
    detailsRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [autoOpen]);

  if (!items.length) return null;

  async function submitReview(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await apiRequest("/customer/reviews", {
        method: "POST",
        token,
        body: { orderId: order.id, itemId, rating, review },
      });
      setMessage(t("Thanks! Your review is awaiting approval."));
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="group/review mt-5 scroll-mt-28 rounded-2xl ring-1 ring-[#ece8dc] open:bg-[#fdfcf7]" ref={detailsRef}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-sm font-extrabold text-[#102c50] transition hover:bg-[#fbfaf5] [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-xl bg-[#fff6cc] text-[#8a7000]">
            <Icon className="size-4" path="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7L12 3Z" />
          </span>
          {t("Review a purchased item")}
        </span>
        <Icon className="size-4 text-[#8b95a2] transition group-open/review:rotate-180" path="m6 9 6 6 6-6" />
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
            <StarRating onChange={setRating} t={t} value={rating} />
          </div>
          <label className={labelClass}>
            {t("Your review")}
            <textarea
              className={`${fieldClass} resize-y`}
              maxLength={1000}
              onChange={(event) => setReview(event.target.value)}
              rows={3}
              value={review}
            />
          </label>
          {error && (
            <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">
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
}) {
  const itemCount = order.items.reduce((count, item) => count + item.quantity, 0);
  const paymentIssue = isPaymentIssue(order);

  return (
    <article className="overflow-hidden rounded-[26px] bg-white shadow-[0_10px_30px_rgba(18,44,80,0.05)] ring-1 ring-[#ebe7dc]">
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-7 sm:pt-6">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#092a53] text-[#ffdc32]">
            <Icon path="M6 7h12l-1 13H7L6 7Zm3 0V6a3 3 0 0 1 6 0v1" />
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-lg font-extrabold text-[#092a53]">
              {t("Order #{id}", { id: order.id })}
            </h3>
            <p className="mt-0.5 text-xs font-medium text-[#65748a]">
              {formatOrderDate(order.createdAt, language, t)} ·{" "}
              {t(itemCount === 1 ? "{count} item" : "{count} items", { count: itemCount })}
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold ring-1 ${statusTone(order)}`}
        >
          <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
          {orderStatus(order, t)}
        </span>
      </header>

      <div className="space-y-5 px-5 py-5 sm:px-7 sm:py-6">
        {!paymentIssue && <OrderProgress order={order} t={t} />}

        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,15rem)]">
          <div>
            <ul className="divide-y divide-[#f0ece2]">
              {order.items.map((item, index) => (
                <li
                  className="flex items-center justify-between gap-4 py-2.5 text-sm first:pt-0"
                  key={`${order.id}-${index}`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="grid h-7 min-w-7 shrink-0 place-items-center rounded-lg bg-[#f4f1e7] px-1.5 text-xs font-extrabold text-[#52647b]">
                      {item.quantity}×
                    </span>
                    <span className="truncate font-semibold text-[#102c50]">
                      {item.name}
                    </span>
                  </span>
                  <span className="shrink-0 font-bold text-[#52647b]">
                    {formatPrice(item.lineTotalCents)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-between rounded-2xl bg-[#fbfaf5] px-4 py-3">
              <span className="text-sm font-bold text-[#65748a]">{t("Total")}</span>
              <span className="font-display text-xl font-extrabold text-[#092a53]">
                {formatPrice(order.totalCents)}
              </span>
            </div>
          </div>

          <dl className="space-y-3 text-sm">
            {order.scheduledFor && (
              <div className="rounded-2xl bg-[#f3f6fa] px-4 py-3">
                <dt className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#65748a]">
                  {t(
                    order.fulfillmentType === "pickup"
                      ? "Pickup scheduled"
                      : "Delivery scheduled",
                  )}
                </dt>
                <dd className="mt-1 font-bold text-[#092a53]">
                  {new Date(order.scheduledFor).toLocaleString(
                    language === "fr" ? "fr-CM" : "en-CM",
                    { dateStyle: "medium", timeStyle: "short" },
                  )}
                </dd>
              </div>
            )}
            <div className="rounded-2xl bg-[#f3f6fa] px-4 py-3">
              <dt className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#65748a]">
                {t("Assigned store")}
              </dt>
              <dd className="mt-1 font-bold text-[#092a53]">
                {t(order.storeName || "Store not recorded")}
              </dd>
              {order.storeAddress && (
                <dd className="mt-0.5 text-xs leading-5 text-[#65748a]">
                  {t(order.storeAddress)}
                </dd>
              )}
            </div>
            {(order.deliveryResidence || order.deliveryCity) && (
              <div className="rounded-2xl bg-[#f3f6fa] px-4 py-3">
                <dt className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#65748a]">
                  {t(order.fulfillmentType === "pickup" ? "Pickup" : "Delivery")}
                </dt>
                <dd className="mt-1 text-xs font-semibold leading-5 text-[#52647b]">
                  {order.deliveryResidence ? `${order.deliveryResidence}, ` : ""}
                  {order.deliveryCity}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {!paymentIssue && (
          <div className="flex flex-wrap justify-end gap-2.5 border-t border-[#f0ece2] pt-5">
            <button
              className={ghostButton}
              disabled={isSaving || isSaved}
              onClick={onSave}
              type="button"
            >
              <Icon
                className="size-4"
                path={isSaved ? "m5 12.5 4.5 4.5L19 7.5" : "M6 4h12v16l-6-4-6 4V4Z"}
              />
              {isSaving ? t("Saving…") : isSaved ? t("Saved for later") : t("Save cart")}
            </button>
            <button
              className={`${primaryButton} px-4 py-2.5 text-xs`}
              disabled={isReordering}
              onClick={onReorder}
              type="button"
            >
              <Icon className="size-4" path="M4 12a8 8 0 0 1 13.7-5.7L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.7L4 15.5M4 20v-4.5h4.5" />
              {isReordering ? t("Adding…") : t("Reorder")}
            </button>
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
    <form className="space-y-6" onSubmit={saveProfile}>
      <div className="flex flex-col gap-5 rounded-[22px] bg-[#fbfaf5] p-5 ring-1 ring-[#ece8dc] sm:flex-row sm:items-center">
        <div className="relative w-fit">
          <Avatar
            customer={{ name: profile.name, profilePicture: profile.profilePicture }}
            size="size-24"
            text="text-4xl"
          />
          <span className="absolute -bottom-1 -right-1 grid size-9 place-items-center rounded-full bg-[#092a53] text-white ring-4 ring-[#fbfaf5]">
            <Icon className="size-4" path="M4 8h3l2-3h6l2 3h3v11H4V8Zm8 9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-[#102c50]">{t("Profile picture")}</p>
          <p className="mt-1 text-xs leading-5 text-[#65748a]">
            {t("Optional. Image will be resized before saving (5 MB max).")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <label className={`${ghostButton} cursor-pointer focus-within:ring-2 focus-within:ring-[#bd9c00]`}>
              <Icon className="size-4" path="M12 16V4m0 0L7 9m5-5 5 5M5 20h14" />
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
            onChange={(event) => setProfile({ ...profile, name: event.target.value })}
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
            onChange={(event) => setProfile({ ...profile, phone: event.target.value })}
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

      <div className="flex flex-col-reverse gap-3 border-t border-[#f0ece2] pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div aria-live="polite" className="min-h-5 text-sm">
          {error && (
            <p className="font-semibold text-red-700" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="flex items-center gap-2 font-semibold text-[#3f6b22]" role="status">
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
    <div className="relative isolate overflow-hidden rounded-[26px] bg-gradient-to-br from-[#0d3566] via-[#092a53] to-[#061d3a] p-6 text-white shadow-[0_18px_40px_rgba(9,42,83,0.22)] sm:p-7">
      <div aria-hidden="true" className="absolute -right-16 -top-20 -z-10 size-56 rounded-full border-[40px] border-white/[0.05]" />
      <div aria-hidden="true" className="absolute -bottom-24 -left-10 -z-10 size-56 rounded-full bg-[#ffdc32]/10 blur-3xl" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#ffdc32]">
            {t("Loyalty rewards")}
          </p>
          <p className="mt-2 font-display text-5xl font-extrabold leading-none">
            {formatPoints(points)}
            <span className="ml-2 text-base font-bold text-white/70">{t("points")}</span>
          </p>
        </div>
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#ffdc32] text-[#092a53]">
          <Icon className="size-6" path="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7L12 3Z" />
        </span>
      </div>

      <div className="mt-6">
        <div className="flex justify-between text-xs font-semibold text-white/70">
          <span>{t("{points} points to your next reward", { points: remaining })}</span>
          <span>
            {progress}/{POINTS_PER_REWARD}
          </span>
        </div>
        <div
          aria-label={t("Progress to next reward")}
          aria-valuemax={POINTS_PER_REWARD}
          aria-valuemin={0}
          aria-valuenow={progress}
          className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/12"
          role="progressbar"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#ffdc32] to-[#ffe97a] shadow-[0_0_12px_rgba(255,220,50,0.6)] transition-[width] duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {!compact && (
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10">
            <p className="text-[11px] font-bold text-white/60">{t("Rewards available")}</p>
            <p className="mt-1 font-display text-2xl font-extrabold">{rewardsAvailable}</p>
          </div>
          <div className="rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10">
            <p className="text-[11px] font-bold text-white/60">{t("Worth")}</p>
            <p className="mt-1 font-display text-2xl font-extrabold text-[#ffdc32]">
              {new Intl.NumberFormat("fr-CM").format(rewardsAvailable * REWARD_VALUE_FCFA)}{" "}
              <span className="text-sm text-white/80">FCFA</span>
            </p>
          </div>
        </div>
      )}

      <p className="mt-5 text-xs leading-5 text-white/65">
        {t("Earn 1 point per 100 FCFA. Redeem 100 points for 1,000 FCFA off.")}
      </p>
    </div>
  );
}

export function CustomerOrdersPage() {
  const { customer, isLoading, updateProfile, logout } = useAuth();
  const { t, language } = useLanguage();
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
      <div className="grid min-h-screen place-items-center bg-[#f8f7f2] text-sm font-semibold text-[#65748a]">
        {t("Loading account…")}
      </div>
    );
  if (!customer) return <Navigate replace state={{ from: "/account/orders" }} to="/login" />;

  const formatPrice = (amount) =>
    `${new Intl.NumberFormat(language === "fr" ? "fr-CM" : "en-CM").format(amount)} FCFA`;
  const points = loyalty?.points ?? customer.loyaltyPoints ?? 0;
  const firstName = (customer.name || "").trim().split(/\s+/)[0] || customer.name;
  const activeOrders = orders.filter(isActive);
  const currentOrder = activeOrders[0];
  const lastCompletedOrder = orders.find(isCompleted);
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

  const renderOrderCard = (order) => {
    const isSaved = savedCarts.some((savedCart) => savedCart.sourceOrderId === order.id);
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
          order={order}
          t={t}
        />
        {!isPaymentIssue(order) && (
          <OrderReviewForm
            autoOpen={Number(searchParams.get("review")) === order.id}
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
          className="group flex items-center gap-3.5 rounded-[20px] bg-white p-3 ring-1 ring-[#ebe7dc] transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(18,44,80,0.08)]"
          key={favorite.itemId}
        >
          <img decoding="async" loading="lazy"
            alt=""
            className="size-16 shrink-0 rounded-2xl bg-[#f4f1e7] object-cover"
            src={favorite.item.image}
          />
          <div className="min-w-0 flex-1">
            <Link
              className="block truncate text-sm font-extrabold text-[#102c50] transition hover:text-[#806a00]"
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
            <svg aria-hidden="true" className="size-[18px]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
            </svg>
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="min-h-screen bg-[#f8f7f2] text-[#102c50]">
      <Header />
      <main>
        {/* Hero */}
        <section className="relative isolate overflow-hidden bg-[#092a53] text-white">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -right-40 -top-40 size-[34rem] rounded-full bg-[#3f86d6]/30 blur-[120px]" />
            <div className="absolute -bottom-48 -left-32 size-[30rem] rounded-full bg-[#ffdc32]/10 blur-[120px]" />
            <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
          </div>

          <div className="mx-auto max-w-[1320px] px-5 pb-24 pt-8 sm:px-8 sm:pb-28 sm:pt-12 lg:px-12 lg:pb-32">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-5 sm:gap-6">
                <div className="relative shrink-0">
                  <div className="rounded-full bg-gradient-to-br from-[#ffdc32] to-[#a48700] p-[3px] shadow-[0_20px_44px_rgba(2,12,28,0.4)]">
                    <div className="rounded-full bg-[#092a53] p-[3px]">
                      <Avatar customer={customer} size="size-[76px] sm:size-28" text="text-4xl sm:text-5xl" />
                    </div>
                  </div>
                  <span aria-hidden="true" className="absolute bottom-1 right-1 size-4 rounded-full bg-[#4caf50] ring-4 ring-[#092a53]" />
                </div>
                <div className="min-w-0">
                  <p className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.06] py-1.5 pl-2 pr-4 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#ffdc32] backdrop-blur-sm">
                    <span aria-hidden="true" className="grid size-5 place-items-center rounded-full bg-[#ffdc32] text-[10px] text-[#092a53]">✦</span>
                    {t("My account")}
                  </p>
                  <h1 className="mt-3 break-words font-display text-3xl font-extrabold leading-[1.05] sm:text-5xl">
                    {t("Welcome back, {name}", { name: firstName })}
                  </h1>
                  <p className="mt-2 truncate text-sm text-white/65">{customer.email}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  className="inline-flex items-center gap-2 rounded-full bg-[#ffdc32] px-6 py-3.5 text-sm font-extrabold text-[#092a53] shadow-[0_12px_30px_rgba(255,220,50,0.25)] transition hover:-translate-y-0.5 hover:bg-[#ffe76c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32] focus-visible:ring-offset-2 focus-visible:ring-offset-[#092a53]"
                  to="/menu"
                >
                  {t("Browse the menu")}
                  <Icon className="size-4" path="M5 12h14m-5-5 5 5-5 5" />
                </Link>
                <Link
                  className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/[0.04] px-6 py-3.5 text-sm font-extrabold text-white transition hover:-translate-y-0.5 hover:border-white/60 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#092a53]"
                  to="/custom-cake"
                >
                  {t("Design a custom cake")}
                </Link>
              </div>
            </div>

            <dl className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {[
                { label: t("Orders"), value: orders.length, icon: "M6 7h12l-1 13H7L6 7Zm3 0V6a3 3 0 0 1 6 0v1" },
                { label: t("Active orders"), value: activeOrders.length, icon: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" },
                { label: t("Saved favorites"), value: favorites.length, icon: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" },
                { label: t("Loyalty rewards"), value: `${formatPoints(points)} ${t("pts")}`, accent: true, icon: "M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7L12 3Z" },
              ].map((stat) => (
                <div
                  className={`flex items-center gap-3 rounded-2xl border p-4 backdrop-blur-sm sm:gap-4 sm:p-5 ${
                    stat.accent ? "border-[#ffdc32]/30 bg-[#ffdc32]/10" : "border-white/10 bg-white/[0.05]"
                  }`}
                  key={stat.label}
                >
                  <span
                    aria-hidden="true"
                    className={`grid size-10 shrink-0 place-items-center rounded-xl sm:size-11 ${stat.accent ? "bg-[#ffdc32] text-[#092a53]" : "bg-white/10 text-[#ffdc32]"}`}
                  >
                    <Icon path={stat.icon} />
                  </span>
                  <div className="min-w-0">
                    <dt className="text-[11px] font-bold leading-tight text-white/55">{stat.label}</dt>
                    <dd className={`mt-0.5 truncate font-display text-xl font-extrabold tabular-nums sm:text-2xl ${stat.accent ? "text-[#ffdc32]" : ""}`}>
                      {stat.value}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>

          <svg aria-hidden="true" className="absolute inset-x-0 -bottom-px h-10 w-full text-[#f8f7f2] sm:h-14 lg:h-20" fill="currentColor" preserveAspectRatio="none" viewBox="0 0 1440 80">
            <path d="M0 80V42C240 4 480 0 720 22s480 44 720 4v54H0Z" />
          </svg>
        </section>

        <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-2 sm:px-8 lg:px-12">

        {(accountError || accountNotice) && (
          <div className="mt-5 space-y-3">
            {accountError && (
              <p
                className="flex items-start gap-3 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700 ring-1 ring-red-100"
                role="alert"
              >
                <Icon className="mt-px size-[18px] shrink-0" path="M12 8v5m0 3.5v.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
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
                  <Link className="font-extrabold underline underline-offset-4" to="/cart">
                    {t("View shopping bag")}
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 grid items-start gap-6 lg:mt-8 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-8">
          {/* Navigation */}
          <nav
            aria-label={t("Account sections")}
            className="relative z-10 -mx-5 overflow-x-auto px-5 [scrollbar-width:none] sm:-mx-8 sm:px-8 lg:sticky lg:top-[calc(var(--site-header-offset,0px)+1.5rem)] lg:transition-[top] lg:duration-300 lg:mx-0 lg:overflow-visible lg:px-0"
          >
            <ul className="flex w-max gap-2 lg:w-auto lg:flex-col lg:gap-1 lg:rounded-[26px] lg:bg-white lg:p-2.5 lg:shadow-[0_10px_30px_rgba(18,44,80,0.05)] lg:ring-1 lg:ring-[#ebe7dc]">
              {TABS.map((tab) => {
                const isCurrent = tab.key === activeTab;
                const count = tabCounts[tab.key];
                return (
                  <li key={tab.key}>
                    <button
                      aria-current={isCurrent ? "page" : undefined}
                      className={`flex w-full items-center gap-3 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] lg:rounded-2xl lg:px-3 lg:py-3 ${
                        isCurrent
                          ? "bg-[#092a53] text-white shadow-[0_8px_20px_rgba(9,42,83,0.2)]"
                          : "bg-white text-[#52647b] ring-1 ring-[#e7e3d8] hover:text-[#092a53] lg:bg-transparent lg:ring-0 lg:hover:bg-[#f6f4ec]"
                      }`}
                      onClick={() => selectTab(tab.key)}
                      type="button"
                    >
                      <span
                        className={`hidden size-9 shrink-0 place-items-center rounded-xl lg:grid ${
                          isCurrent ? "bg-[#ffdc32] text-[#092a53]" : "bg-[#f4f1e8] text-[#52647b]"
                        }`}
                      >
                        <Icon path={tab.icon} />
                      </span>
                      <span className="flex-1 text-left">{t(tab.label)}</span>
                      {count > 0 && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] ${
                            isCurrent ? "bg-white/15 text-white" : "bg-[#f1eee4] text-[#65748a]"
                          }`}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
              <li className="lg:mt-1 lg:border-t lg:border-[#f0ece2] lg:pt-1">
                <button
                  className="group/logout flex w-full items-center gap-3 whitespace-nowrap rounded-full bg-white px-4 py-2.5 text-sm font-extrabold text-[#52647b] ring-1 ring-[#e7e3d8] transition hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 lg:rounded-2xl lg:bg-transparent lg:px-3 lg:py-3 lg:ring-0 lg:hover:bg-red-50"
                  onClick={handleLogout}
                  type="button"
                >
                  <span className="hidden size-9 shrink-0 place-items-center rounded-xl bg-[#f4f1e8] transition group-hover/logout:bg-red-100 lg:grid">
                    <Icon path="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l4-4-4-4M14 12H4" />
                  </span>
                  {t("Log out")}
                </button>
              </li>
            </ul>
          </nav>

          {/* Panels */}
          <div className="min-w-0 scroll-mt-24" id="account-panel">
            {activeTab === "overview" && (
              <div className="space-y-8">
                <PromotionAlertsSetting />
                <section>
                  <SectionHeading
                    action={
                      orders.length > 0 && (
                        <button className={ghostButton} onClick={() => selectTab("orders")} type="button">
                          {t("View all orders")}
                          <Icon className="size-4" path="M5 12h14m-5-5 5 5-5 5" />
                        </button>
                      )
                    }
                    eyebrow={t("Right now")}
                    title={t("Current order")}
                  />
                  {loadingOrders ? (
                    <div className="h-64 animate-pulse rounded-[26px] bg-white ring-1 ring-[#ebe7dc]" />
                  ) : currentOrder ? (
                    renderOrderCard(currentOrder)
                  ) : (
                    <EmptyState
                      body={t("When you place an order, you can follow it here in real time.")}
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
                              reorderItems(lastCompletedOrder.items, lastCompletedOrder.id)
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

                <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <RewardsCard points={points} t={t} />
                  <div className={cardClass}>
                    <p className={eyebrowClass}>{t("Shortcuts")}</p>
                    <h2 className="mt-2 font-display text-xl font-extrabold text-[#092a53]">
                      {t("Quick actions")}
                    </h2>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      {[
                        { label: t("Browse the menu"), to: "/menu", icon: "M4 6h16M4 12h16M4 18h10" },
                        { label: t("Design a custom cake"), to: "/custom-cake", icon: "M4 20h16M5 20v-7h14v7M8 13V9h8v4M12 9V5" },
                        { label: t("Flavors"), to: "/flavors", icon: "M6 7h12l-1 13H7L6 7Zm3 0V6a3 3 0 0 1 6 0v1" },
                        { label: t("Contact us"), to: "/contact", icon: "M4 6h16v12H4V6Zm0 0 8 7 8-7" },
                      ].map((action) => (
                        <Link
                          className="group flex flex-col gap-3 rounded-2xl bg-[#fbfaf5] p-4 text-sm font-extrabold text-[#102c50] ring-1 ring-[#ece8dc] transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_10px_24px_rgba(18,44,80,0.08)]"
                          key={action.to}
                          to={action.to}
                        >
                          <span className="grid size-10 place-items-center rounded-xl bg-white text-[#8a7000] ring-1 ring-[#ece8dc] transition group-hover:bg-[#ffdc32] group-hover:text-[#092a53] group-hover:ring-transparent">
                            <Icon path={action.icon} />
                          </span>
                          {action.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                </section>

                {favorites.length > 0 && (
                  <section>
                    <SectionHeading
                      action={
                        <button className={ghostButton} onClick={() => selectTab("saved")} type="button">
                          {t("View all")}
                          <Icon className="size-4" path="M5 12h14m-5-5 5 5-5 5" />
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
                      className="mt-2 font-display text-2xl font-extrabold text-[#092a53] sm:text-[1.75rem]"
                      id="account-orders-title"
                    >
                      {t("Order history and status")}
                    </h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex rounded-full bg-white p-1 ring-1 ring-[#e7e3d8]" role="group" aria-label={t("Filter orders")}>
                      {[
                        { key: "all", label: t("All") },
                        { key: "active", label: t("In progress") },
                        { key: "completed", label: t("Completed") },
                      ].map((filter) => (
                        <button
                          aria-pressed={orderFilter === filter.key}
                          className={`rounded-full px-3.5 py-1.5 text-xs font-extrabold transition ${
                            orderFilter === filter.key
                              ? "bg-[#092a53] text-white"
                              : "text-[#65748a] hover:text-[#092a53]"
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
                      className="grid size-9 place-items-center rounded-full bg-white text-[#52647b] ring-1 ring-[#e7e3d8] transition hover:text-[#092a53] disabled:opacity-50"
                      disabled={loadingOrders}
                      onClick={() =>
                        refreshOrders().catch((loadError) => setError(loadError.message))
                      }
                      title={t("Refresh order status")}
                      type="button"
                    >
                      <Icon className="size-4" path="M4 12a8 8 0 0 1 13.7-5.7L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.7L4 15.5M4 20v-4.5h4.5" />
                    </button>
                  </div>
                </div>
                {error && (
                  <p className="mb-4 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700 ring-1 ring-red-100" role="alert">
                    {error}
                  </p>
                )}
                {loadingOrders ? (
                  <div className="space-y-4">
                    {[0, 1].map((key) => (
                      <div className="h-56 animate-pulse rounded-[26px] bg-white ring-1 ring-[#ebe7dc]" key={key} />
                    ))}
                  </div>
                ) : filteredOrders.length ? (
                  <div className="space-y-5">{filteredOrders.map(renderOrderCard)}</div>
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

            {activeTab === "saved" && (
              <div className="space-y-10">
                <section>
                  <SectionHeading
                    description={t("Current prices and stock are checked when you add a saved cart.")}
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
                          <li className={`${cardClass} flex flex-col sm:p-6`} key={savedCart.id}>
                            <div className="flex items-start gap-3.5">
                              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#fff6cc] text-[#8a7000]">
                                <Icon path="M6 4h12v16l-6-4-6 4V4Z" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-display text-lg font-extrabold text-[#092a53]">
                                  {t(savedCart.label)}
                                </p>
                                <p className="text-xs font-semibold text-[#65748a]">
                                  {t("{count} items", { count })}
                                </p>
                              </div>
                            </div>
                            <ul className="mt-4 flex-1 space-y-1.5 text-sm text-[#52647b]">
                              {savedCart.items.slice(0, 3).map((item, index) => (
                                <li className="flex gap-2" key={`${savedCart.id}-${index}`}>
                                  <span className="font-extrabold text-[#102c50]">{item.quantity}×</span>
                                  <span className="truncate">{item.name}</span>
                                </li>
                              ))}
                              {savedCart.items.length > 3 && (
                                <li className="text-xs font-semibold text-[#8b95a2]">
                                  {t("+{count} more", { count: savedCart.items.length - 3 })}
                                </li>
                              )}
                            </ul>
                            <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#f0ece2] pt-4">
                              <button
                                className="text-xs font-bold text-[#a34d4d] transition hover:text-red-800 disabled:opacity-50"
                                disabled={deletingSavedCartId === savedCart.id}
                                onClick={() => removeSavedCart(savedCart)}
                                type="button"
                              >
                                {deletingSavedCartId === savedCart.id ? t("Removing…") : t("Remove")}
                              </button>
                              <button
                                className={`${primaryButton} px-4 py-2.5 text-xs`}
                                disabled={reorderingId === `saved-${savedCart.id}`}
                                onClick={() => reorderItems(savedCart.items, `saved-${savedCart.id}`)}
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
                      body={t("No saved carts yet. Save a paid order to quickly rebuild its cart later.")}
                      icon="M6 4h12v16l-6-4-6 4V4Z"
                      title={t("Nothing saved yet")}
                    />
                  )}
                </section>

                <section>
                  <SectionHeading eyebrow={t("Your collection")} title={t("Saved favorites")} />
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
                  description={t("Earn 1 point per 100 FCFA. Redeem 100 points for 1,000 FCFA off.")}
                  eyebrow={t("Loyalty rewards")}
                  title={t("Your rewards")}
                />
                <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                  <RewardsCard points={points} t={t} />
                  <div className={cardClass}>
                    <h3 className="font-display text-lg font-extrabold text-[#092a53]">
                      {t("Points history")}
                    </h3>
                    {loyalty?.entries?.length ? (
                      <ul className="mt-4 divide-y divide-[#f0ece2]">
                        {loyalty.entries.map((entry) => (
                          <li className="flex items-center justify-between gap-3 py-3" key={entry.id}>
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
                                  path={entry.pointsDelta > 0 ? "M12 19V5m-6 6 6-6 6 6" : "M12 5v14m6-6-6 6-6-6"}
                                />
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold capitalize text-[#102c50]">
                                  {t(entry.entryType)}
                                </p>
                                <p className="text-xs text-[#65748a]">
                                  {t("Order #{id}", { id: entry.orderId })}
                                </p>
                              </div>
                            </div>
                            <span
                              className={`shrink-0 font-display text-lg font-extrabold ${
                                entry.pointsDelta > 0 ? "text-[#3f6b22]" : "text-[#b44947]"
                              }`}
                            >
                              {entry.pointsDelta > 0 ? "+" : ""}
                              {entry.pointsDelta}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-4 rounded-2xl bg-[#fbfaf5] p-5 text-sm leading-6 text-[#65748a]">
                        {t("Your points will appear here after your first paid order.")}
                      </p>
                    )}
                  </div>
                </div>
              </section>
            )}

            {activeTab === "profile" && (
              <section>
                <SectionHeading
                  description={t("Keep your contact and delivery information up to date.")}
                  eyebrow={t("Account profile")}
                  title={t("Saved delivery details")}
                />
                <div className={cardClass}>
                  <CustomerProfileDetails customer={customer} onSave={updateProfile} t={t} />
                </div>
              </section>
            )}
          </div>
        </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
