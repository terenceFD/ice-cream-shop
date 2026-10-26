import { useLanguage } from "../language/useLanguage";

interface RatingBadgeProps {
  averageRating?: number | null;
  reviewCount?: number;
}

export function RatingBadge({ averageRating, reviewCount = 0 }: RatingBadgeProps) {
  const { t } = useLanguage();
  if (!reviewCount || averageRating == null) return null;

  const rating = Number(averageRating).toFixed(1);

  return (
    <span
      aria-label={`${t("{rating} out of 5 stars", { rating })}, ${t("{count} reviews", { count: reviewCount })}`}
      className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1.5 text-xs font-extrabold text-brand-navy shadow-sm backdrop-blur-sm"
    >
      <svg aria-hidden="true" className="size-3.5 text-[#e2a900]" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7L12 3Z" />
      </svg>
      <span>{rating}</span>
      <span className="font-semibold text-[#65748a]">({reviewCount})</span>
    </span>
  );
}
