import { useEffect, useState } from "react";
import { apiRequest } from "../api/api";
import { useLanguage } from "../language/useLanguage";

type Review = {
  rating: number;
  review: string;
  createdAt: string;
  customerName: string | null;
  profilePicture: string | null;
};

type ReviewsResult = {
  reviewCount: number;
  averageRating: number | null;
  reviews: Review[];
};

// Approved customer reviews for one product, shown on its page. The same
// /api/menu/:itemId/reviews endpoint backs menu items and flavors; both accept
// their own "menu:..." / "flavor:..." item id.
export function ProductReviews({ itemId }: { itemId: string }) {
  const { t } = useLanguage();
  const [result, setResult] = useState<ReviewsResult | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    apiRequest<ReviewsResult>(`/menu/${encodeURIComponent(itemId)}/reviews`)
      .then((next) => {
        if (!cancelled) setResult(next);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  if (failed || !result?.reviewCount) return null;

  const average = result.averageRating ?? 0;
  const fullStars = Math.round(average);

  return (
    <section
      aria-labelledby="product-reviews-title"
      className="mx-auto w-full max-w-[1320px] px-5 pt-12 sm:px-8 sm:pt-16 lg:px-12"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-blue">
            {t("Customer reviews")}
          </p>
          <h2
            className="mt-3 font-display text-3xl font-extrabold leading-[1.02] tracking-tight text-brand-navy sm:text-4xl"
            id="product-reviews-title"
          >
            {t("What people say")}
          </h2>
        </div>
        <p className="flex items-center gap-3">
          <span
            aria-label={t("{rating} out of 5 stars", { rating: average })}
            className="text-lg tracking-[0.1em] text-[#d4ad00]"
          >
            {"★".repeat(fullStars)}
            <span className="text-[#e2ddd0]">{"★".repeat(5 - fullStars)}</span>
          </span>
          <span className="text-sm font-bold text-brand-navy">
            {average.toFixed(1)} ·{" "}
            {t(result.reviewCount === 1 ? "1 review" : "{count} reviews", {
              count: result.reviewCount,
            })}
          </span>
        </p>
      </div>

      <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {result.reviews.slice(0, 6).map((review, index) => (
          <li
            className="flex flex-col rounded-[20px] bg-white p-6 shadow-[0_10px_30px_rgba(18,44,80,0.05)] ring-1 ring-[#f1eee4]"
            key={`${review.createdAt}-${index}`}
          >
            <p
              aria-label={t("{rating} out of 5 stars", {
                rating: review.rating,
              })}
              className="text-sm tracking-[0.1em] text-[#d4ad00]"
            >
              {"★".repeat(review.rating)}
              <span className="text-[#e2ddd0]">
                {"★".repeat(5 - review.rating)}
              </span>
            </p>
            {review.review && (
              <p className="mt-3 text-sm leading-6 text-[#65748a]">
                “{review.review}”
              </p>
            )}
            <div className="mt-auto flex items-center gap-3 pt-5">
              {review.profilePicture ? (
                <img
                  alt=""
                  className="size-9 rounded-full object-cover"
                  decoding="async"
                  loading="lazy"
                  src={review.profilePicture}
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="grid size-9 place-items-center rounded-full bg-[#ffeb9c] text-xs font-extrabold text-brand-navy"
                >
                  {review.customerName?.charAt(0)?.toUpperCase() || "A"}
                </span>
              )}
              <p className="text-sm font-extrabold text-brand-navy">
                {review.customerName || t("Customer")}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
