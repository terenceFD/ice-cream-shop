import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Footer, Header, ArrowIcon } from "../../components/Layout";
import { HeroBackground } from "../../components/HeroBackground";
import { useCart } from "../../context/useCart";
import { useFlavors } from "../../context/useFlavors";
import { apiRequest } from "../../api/api";
import { coldStoneMenuCategories, getMenuItemId } from "../../../shared/data";
import { ProductImageSlider } from "../../components/ProductImageSlider";
import { useLanguage } from "../../language/useLanguage";
import {
  photoErrorHandler,
  photoSrcSet,
  thumbnail,
} from "../../lib/thumbnails";
import { HOME_SLIDE_SIZES } from "../../../shared/photoSizes.js";
import { numberFormatter } from "../../lib/cartPricing";

const popularFlavorNames = [
  "Cookie Mintster",
  "Our Dubai Chocolate Creation",
  "Founder’s Favorite",
  "Birthday Cake Remix",
  "Peanut Butter Cup Perfection",
];
const popularFlavorColors = [
  "#e9f6dd",
  "#fff0df",
  "#fff5d2",
  "#fff5c8",
  "#ffeadc",
];
const cakeSliderFallbacks = {
  birthday: ["/cake-images/cake-1.webp", "/cake-images/cake-2.webp", "/cake-images/cake-6.webp"],
  kids: ["/cake-images/cake-3.webp", "/cake-images/cake-1.webp", "/cake-images/cake-7.webp"],
  pies: [
    "/menu-official/cakes/ice-cream-pies/local-pies/cookie-dough-pie.webp",
    "/menu-official/cakes/ice-cream-pies/local-pies/smore-some-more-pie.webp",
    "/menu-official/cakes/ice-cream-pies/local-pies/caramel-apple-pie.webp",
    "/menu-official/cakes/ice-cream-pies/local-pies/caramel-turtle-treat-pie.webp",
    "/menu-official/cakes/ice-cream-pies/local-pies/pumpkin-pie.webp",
  ],
  signature: [
    "/cake-images/cake-4.webp",
    "/cake-images/cake-5.webp",
    "/cake-images/cake-8.webp",
    "/cake-images/cake-10.webp",
    "/cake-images/cake-12.webp",
  ],
};
const flavorInspiration = [
  {
    id: "strawberry",
    title: "Strawberry daydream",
    detail: "Berry-bright · soft & sweet",
    mood: "fruit",
    category: "Ice Cream",
    item: "Our Strawberry Blonde",
    image: "/menu-official/ice-cream/signature-creations/berry-berry-berry-good.webp",
    color: "#f7c8d9",
  },
  {
    id: "mango",
    title: "Mango sunshine",
    detail: "Tropical · golden & juicy",
    mood: "fruit",
    category: "Milkshakes & Smoothies",
    item: "Mango Pineapple Smoothie",
    image: "/flavor-inspiration/mango-sunshine.jpg",
    images: [
      "/flavor-inspiration/mango-sunshine.jpg",
      "/menu-official/milkshakes-fruit-smoothies/smoothies/mango-pineapple.webp",
    ],
    color: "#ffd45d",
  },
  {
    id: "chocolate",
    title: "Chocolate crush",
    detail: "Cocoa-rich · deep & dreamy",
    mood: "chocolate",
    category: "Ice Cream",
    item: "Chocolate Devotion",
    image: "/menu-official/ice-cream/signature-creations/chocolate-devotion.webp",
    color: "#d9b2a0",
  },
  {
    id: "vanilla",
    title: "Vanilla cloud",
    detail: "Mellow · creamy & classic",
    mood: "classics",
    category: "Ice Cream",
    item: "Cookie Doughn’t You Want Some",
    image: "/menu-official/milkshakes-fruit-smoothies/milkshakes/very-vanilla.webp",
    color: "#ded0ef",
  },
  {
    id: "peanut-butter",
    title: "Peanut butter bliss",
    detail: "Nutty · rich & crunchy",
    mood: "chocolate",
    category: "Ice Cream",
    item: "Peanut Butter Cup Perfection",
    image: "/menu-official/ice-cream/signature-creations/peanut-butter-cup-perfection.webp",
    color: "#f3d3b3",
  },
  {
    id: "dubai-chocolate",
    title: "Dubai chocolate luxury",
    detail: "Pistachio · indulgent & golden",
    mood: "chocolate",
    category: "Ice Cream",
    item: "Our Dubai Chocolate Creation",
    image: "/menu-official/ice-cream/signature-creations/our-dubai-chocolate-creation.webp",
    color: "#e8c98e",
  },
  {
    id: "berry",
    title: "Berry berry joy",
    detail: "Double-berry · fresh & tangy",
    mood: "fruit",
    category: "Ice Cream",
    item: "Berry Berry Berry Good",
    image: "/menu-official/ice-cream/signature-creations/berry-berry-berry-good.webp",
    color: "#f9c2d0",
  },
  {
    id: "founder",
    title: "Founder’s favorite",
    detail: "Caramel & pecan · a house legend",
    mood: "classics",
    category: "Ice Cream",
    item: "Founder’s Favorite",
    image: "/menu-official/ice-cream/signature-creations/founders-favorite.webp",
    color: "#f6e3b8",
  },
  {
    id: "mint",
    title: "Mint chip moment",
    detail: "Cool mint · loaded with cookies",
    mood: "classics",
    category: "Ice Cream",
    item: "Cookie Mintster",
    image: "/menu-official/ice-cream/signature-creations/cookie-mintster.webp",
    color: "#c8ecd8",
  },
  {
    id: "banana-caramel",
    title: "Banana caramel crunch",
    detail: "Banana & caramel · sweet & crunchy",
    mood: "fruit",
    category: "Ice Cream",
    item: "Banana Caramel Crunch",
    image: "/menu-official/ice-cream/signature-creations/banana-caramel-crunch.webp",
    color: "#ffe9a8",
  },
];
const flavorImageAlternates = {
  fruit: [
    "/flavor-inspiration/strawberry-daydream.jpg",
    "/flavor-inspiration/mango-sunshine.jpg",
    "/menu-official/ice-cream/signature-creations/berry-berry-berry-good-2.webp",
  ],
  chocolate: [
    "/flavor-inspiration/chocolate-crush.jpg",
    "/menu-official/ice-cream/signature-creations/chocolate-devotion-2.webp",
    "/menu-official/ice-cream/signature-creations/our-dubai-chocolate-creation-2.webp",
  ],
  classics: [
    "/flavor-inspiration/vanilla-cloud.jpg",
    "/menu-official/ice-cream/signature-creations/founders-favorite-2.webp",
    "/menu-official/ice-cream/signature-creations/cookie-mintster-2.webp",
  ],
};
const homeSlides = [
  {
    eyebrow: "A little happiness in every scoop",
    title: "Your next favorite",
    accent: "starts here.",
    description: "Signature creations, the full menu, and stores across Cameroon.",
    image: "/ice-images/ice-9.jpg",
    alt: "Colorful ice cream creations ready to enjoy",
    caption: "The signature experience",
    primaryCta: "Order ice cream",
    primaryTo: "/menu?category=Ice%20Cream",
    secondaryCta: "Explore flavors",
    secondaryTo: "/flavors",
  },
  {
    eyebrow: "Ice cream cakes for every celebration",
    title: "Celebrate with",
    accent: "a cake to remember.",
    description: "Creamy ice cream cakes for birthdays, parties, and every celebration.",
    image: "/cake-images/cake-11.webp",
    alt: "A chocolate ice cream cake held up for a celebration",
    caption: "Made for celebrations",
    primaryCta: "Order a cake",
    primaryTo: "/custom-cake",
    secondaryCta: "Explore the menu",
    secondaryTo: "/menu?category=Ice%20Cream%20Cakes%20and%20Pies",
  },
  {
    eyebrow: "Cool, creamy and full of crunch",
    title: "Fresh mint,",
    accent: "loaded with cookies.",
    description: "Mint ice cream with cookies and fudge, mixed fresh on a frozen stone.",
    image: "/menu-official/ice-cream/signature-creations/cookie-mintster.webp",
    alt: "Mint ice cream with chocolate cookies and fudge in a waffle cone",
    caption: "Mixed on a frozen stone",
    primaryCta: "Explore signature creations",
    primaryTo: "/menu?category=Ice%20Cream",
    secondaryCta: "View all menu",
    secondaryTo: "/menu/all",
  },
];

function getPopularFlavors(categories) {
  const iceCream = categories.find(
    (category) => category.title === "Ice Cream",
  );
  return popularFlavorNames
    .map((name) => iceCream?.items.find((item) => item.name === name))
    .filter(Boolean);
}

// Menu price (in XAF) for a flavor card's featured item, or null when unavailable.
function findMenuItem(categories, categoryTitle, itemName) {
  const category = categories.find(
    (entry) => entry.title === categoryTitle,
  );
  return category?.items.find(
    (entry) => entry.name === itemName,
  );
}

function getFlavorMood(flavor) {
  const flavorText = [flavor.name, flavor.detail, flavor.description, flavor.tag]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (/fruit|berry|strawberry|mango|banana|raspberry|blueberry|peach|pineapple|lemon/.test(flavorText)) {
    return "fruit";
  }
  if (/chocolate|cocoa|cacao|fudge|brownie|nut|peanut|coffee/.test(flavorText)) {
    return "chocolate";
  }
  return "classics";
}

function getFlavorCardImages(flavor, item) {
  const images = [...new Set(
    (flavor.images || (item?.image ? [item.image, ...(item.gallery || [])] : [flavor.image]))
      .filter(Boolean),
  )];
  if (images.length > 1) return images;

  const alternates = flavorImageAlternates[flavor.mood] || flavorImageAlternates.classics;
  return [
    ...images,
    ...alternates.filter((image) => !images.includes(image)).slice(0, 2),
  ];
}

const STAR_PATH =
  "M12 2.75l2.83 5.74 6.33.92-4.58 4.47 1.08 6.3L12 17.2l-5.66 2.98 1.08-6.3-4.58-4.47 6.33-.92L12 2.75Z";

// Crisp SVG stars that can show part of a star, so an average such as 4.6 reads accurately.
function StarRating({
  value,
  className = "size-4",
  filledClassName = "text-[#f5b301]",
  emptyClassName = "text-[#e4e8ee]",
  label,
}) {
  return (
    <span
      aria-label={label}
      className="inline-flex items-center gap-0.5"
      role="img"
    >
      {[0, 1, 2, 3, 4].map((index) => {
        const fill = Math.max(0, Math.min(1, value - index));
        return (
          <span
            aria-hidden="true"
            className={`relative inline-block ${className}`}
            key={index}
          >
            <svg
              className={`absolute inset-0 size-full ${emptyClassName}`}
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d={STAR_PATH} />
            </svg>
            {fill > 0 && (
              <span
                className="absolute inset-y-0 left-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <svg
                  className={`h-full ${className
                    .split(" ")
                    .filter((name) => name.startsWith("size-"))
                    .join(" ")} ${filledClassName}`}
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d={STAR_PATH} />
                </svg>
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

function VerifiedIcon({ className = "size-3.5" }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 2.5 14.4 4l2.8-.2 1.2 2.6 2.5 1.3-.2 2.8L22 13l-1.5 2.4.2 2.8-2.6 1.2-1.3 2.5-2.8-.2L12 23l-2.4-1.5-2.8.2-1.2-2.6-2.5-1.3.2-2.8L2 13l1.5-2.4-.2-2.8 2.6-1.2L7.2 4.1l2.8.2L12 2.5Z"
        fill="currentColor"
      />
      <path
        d="m8.5 12.5 2.4 2.4 4.6-5"
        stroke="#fff"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

// Review dates arrive as "2026-10-11 17:36:57" (SQLite, UTC) or an ISO string (PostgreSQL).
function parseReviewDate(value) {
  if (!value) return null;
  const text = String(value);
  const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(text)
    ? text
    : `${text.replace(" ", "T")}Z`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatReviewDate(value, language) {
  const date = parseReviewDate(value);
  if (!date) return "";
  const locale = language === "fr" ? "fr-FR" : "en-GB";
  const days = Math.round((Date.now() - date.getTime()) / 86_400_000);
  if (days < 30) {
    const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    return days < 7
      ? relative.format(-days, "day")
      : relative.format(-Math.round(days / 7), "week");
  }
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function ReviewerAvatar({ name, picture, className, eager = false }) {
  return picture ? (
    <img
      decoding={eager ? "sync" : "async"}
      alt=""
      className={`shrink-0 rounded-full object-cover ${className}`}
      fetchPriority={eager ? "high" : "auto"}
      loading={eager ? "eager" : "lazy"}
      src={picture}
    />
  ) : (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full bg-[#092a53] font-display font-extrabold text-[#ffdc32] ${className}`}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

const LONG_REVIEW_LENGTH = 150;

function ReviewCard({ review, language, t, eager = false }) {
  const [expanded, setExpanded] = useState(false);
  const customerName = review.customerName || t("Customer");
  const rawText = (review.review || "").trim();
  const text = rawText
    ? rawText.charAt(0).toUpperCase() + rawText.slice(1)
    : "";
  const isLong = text.length > LONG_REVIEW_LENGTH;
  return (
    <li>
      <article className="flex h-full flex-col rounded-2xl border border-[#eceff3] bg-[#f7f8fa] p-6 transition duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-[0_18px_40px_rgba(9,42,83,0.10)] sm:p-7">
        <div className="flex-1">
          {text ? (
            <blockquote
              className={`whitespace-pre-line text-[15px] font-medium leading-[1.75] text-[#22344c] ${isLong && !expanded ? "line-clamp-4" : ""}`}
            >
              {text}
            </blockquote>
          ) : (
            <p className="text-sm italic leading-7 text-[#7b8794]">
              {t("No written comment.")}
            </p>
          )}
          {isLong && (
            <button
              aria-expanded={expanded}
              className="mt-3 text-[13px] font-bold tracking-wide text-[#123b68] underline decoration-[#c8d2dd] underline-offset-4 transition hover:decoration-[#123b68] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2"
              onClick={() => setExpanded((current) => !current)}
              type="button"
            >
              {t(expanded ? "Show less" : "Read more")}
            </button>
          )}
        </div>
        <footer className="mt-6 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <ReviewerAvatar
              className="size-11 shrink-0 text-sm"
              eager={eager}
              name={customerName}
              picture={review.profilePicture}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[#0d2c4e]">
                {customerName}
              </p>
              <p className="mt-0.5 truncate text-xs font-medium text-[#6e7a89]">
                {review.itemName ? t(review.itemName) : t("Verified purchase")}
              </p>
              {review.createdAt && (
                <time
                  className="mt-1 block text-xs font-medium text-[#6e7a89]"
                  dateTime={review.createdAt}
                >
                  {formatReviewDate(review.createdAt, language)}
                </time>
              )}
            </div>
          </div>
          <StarRating
            className="size-3.5 shrink-0"
            emptyClassName="text-[#e5e9ef]"
            filledClassName="text-[#f5a623]"
            label={t("{rating} out of 5 stars", { rating: review.rating })}
            value={Number(review.rating) || 0}
          />
        </footer>
      </article>
    </li>
  );
}

// Shimmering placeholder for cards that are still loading, so slow responses never read as blank space.
function SkeletonCard({ className = "" }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-2xl border border-[#eceff3] bg-[#f7f8fa] p-6 ${className}`}
    >
      <div className="h-4 w-3/4 rounded-full bg-[#e4e8ee]" />
      <div className="mt-3 h-3 w-full rounded-full bg-[#e4e8ee]" />
      <div className="mt-2 h-3 w-5/6 rounded-full bg-[#e4e8ee]" />
      <div className="mt-6 flex items-center gap-3">
        <div className="size-10 rounded-full bg-[#e4e8ee]" />
        <div className="flex-1">
          <div className="h-3 w-24 rounded-full bg-[#e4e8ee]" />
          <div className="mt-2 h-3 w-16 rounded-full bg-[#e4e8ee]" />
        </div>
      </div>
    </div>
  );
}

function ReviewsSection({ reviews, stats, error, isLoaded, language, t }) {
  // While the answer is on its way, show a shimmering skeleton instead of blank space.
  if (!isLoaded) {
    return (
      <section
        aria-label={t("Real Reviews")}
        className="bg-white px-5 py-16 sm:px-8 sm:py-20 lg:px-10 lg:py-24"
      >
        <div className="mx-auto max-w-[1320px]">
          <div className="h-10 w-56 animate-pulse rounded-full bg-[#e4e8ee] sm:h-12" />
          <div className="mt-4 h-4 w-80 max-w-full animate-pulse rounded-full bg-[#e4e8ee]" />
          <div className="mt-10 grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3">
            <SkeletonCard />
            <SkeletonCard className="hidden md:block" />
            <SkeletonCard className="hidden xl:block" />
          </div>
        </div>
      </section>
    );
  }
  const hasReviews = reviews.length > 0;
  // Social proof must always represent verified customer data, never placeholders.
  const displayReviews = reviews;
  const average = stats.average;
  const roundedAverage = Math.round(average * 10) / 10;
  const count = stats.count;
  const distribution = stats.distribution || {};
  const busiest = Math.max(
    1,
    ...[1, 2, 3, 4, 5].map((stars) => distribution[stars] || 0),
  );
  return (
    <section
      aria-labelledby="real-reviews-heading"
      className="relative isolate overflow-hidden bg-white px-5 py-16 sm:px-8 sm:py-20 lg:px-10 lg:py-24"
      id="reviews"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-6 rounded-t-[100%] bg-[#fbfaf5]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#dde4ec] to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(9,42,83,0.045),transparent_42%)]"
      />
      <div className="relative mx-auto max-w-[1320px]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h2
              className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-[#092a53] sm:text-5xl lg:text-6xl"
              id="real-reviews-heading"
            >
              {t("Real Reviews")}
            </h2>
            <p className="mt-4 max-w-xl text-lg leading-8 font-medium text-[#5b6d84]">
              {t(
                "Honest feedback from customers who ordered and tasted it themselves.",
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3 lg:mb-1">
            {/* With no reviews yet there is no number to show, and a 0.0 row reads as "nobody ever
                ordered" — so only the friendly invitation below is shown instead. */}
            {hasReviews && (
              <>
                <StarRating
                  className="size-5"
                  emptyClassName="text-[#e5e9ef]"
                  filledClassName="text-[#f5a623]"
                  label={t("{rating} out of 5 stars", {
                    rating: roundedAverage.toFixed(1),
                  })}
                  value={average}
                />
                <span className="text-sm font-bold text-[#0d2c4e]">
                  {roundedAverage.toFixed(1)}
                </span>
                <span className="text-sm font-medium text-[#6e7a89]">
                  {t(
                    count === 1 ? "Based on 1 review" : "Based on {count} reviews",
                    { count },
                  )}
                </span>
              </>
            )}
          </div>
        </div>

        {error ? (
          <p
            className="mt-8 rounded-2xl border border-[#e6ebf1] bg-[#f9fbfd] px-5 py-4 text-base leading-7 text-[#52647b]"
            role="status"
          >
            {t("Customer reviews could not be loaded")}: {error}
          </p>
        ) : !hasReviews ? (
          <div className="mt-8 flex flex-col items-start gap-4 rounded-2xl border border-[#e6ebf1] bg-[#f9fbfd] px-6 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div>
              <p className="font-display text-xl font-extrabold leading-tight text-[#092a53]">
                {t("No reviews yet — be the first!")}
              </p>
              <p className="mt-1.5 max-w-md text-base leading-7 text-[#52647b]">
                {t("Ordered from us before? Share how it tasted and help the next customer choose.")}
              </p>
            </div>
            <Link
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#092a53] px-6 py-3.5 text-sm font-extrabold text-white shadow-[0_8px_18px_rgba(9,42,83,0.16)] transition hover:-translate-y-0.5 hover:bg-[#163e6b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2"
              to="/account/orders"
            >
              {t("Write a review")} <ArrowIcon />
            </Link>
          </div>
        ) : (
          <ul
            className={`mt-10 grid items-stretch gap-5 ${displayReviews.length >= 3 ? "md:grid-cols-2 xl:grid-cols-3" : displayReviews.length === 2 ? "md:grid-cols-2" : "max-w-2xl"}`}
          >
            {displayReviews.map((review, index) => (
              <ReviewCard
                eager={index === 0}
                key={`${review.createdAt}-${review.itemId || review.itemName}-${index}`}
                language={language}
                review={review}
                t={t}
              />
            ))}
          </ul>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-[#dfe6ed] pt-6">
          <Link
            className="inline-flex items-center gap-2 rounded-full bg-[#092a53] px-6 py-3.5 text-sm font-extrabold text-white shadow-[0_8px_18px_rgba(9,42,83,0.16)] transition hover:-translate-y-0.5 hover:bg-[#163e6b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2"
            to="/account/orders"
          >
            {t("Write a review")} <ArrowIcon />
          </Link>
          <Link
            className="inline-flex items-center gap-2 rounded-full border border-[#cfd8e1] bg-white px-6 py-3.5 text-sm font-extrabold text-[#123b68] transition hover:-translate-y-0.5 hover:border-[#092a53] hover:bg-[#fafdff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2"
            to="/menu"
          >
            {t("Explore the menu")}
          </Link>
        </div>
      </div>
    </section>
  );
}

export function HomePage() {
  const { language, t } = useLanguage();
  const { addToCart } = useCart();
  const { flavors: catalogFlavors } = useFlavors();
  const navigate = useNavigate();
  const [popularFlavors, setPopularFlavors] = useState([]);
  const [popularLoaded, setPopularLoaded] = useState(false);
  const [menuCategories, setMenuCategories] = useState(null);
  const [menuError, setMenuError] = useState("");
  const [cartNotice, setCartNotice] = useState("");
  const [reviews, setReviews] = useState([]);
  const [reviewStats, setReviewStats] = useState({
    count: 0,
    average: 0,
    distribution: {},
  });
  const [reviewsError, setReviewsError] = useState("");
  const [reviewsLoaded, setReviewsLoaded] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [selectedFlavorMood, setSelectedFlavorMood] = useState("all");
  const [flavorSearch, setFlavorSearch] = useState("");
  const [showAllFlavorResults, setShowAllFlavorResults] = useState(false);
  const [selectedCakeType, setSelectedCakeType] = useState("all");
  const [cakeSearch, setCakeSearch] = useState("");
  const [loadedSlides, setLoadedSlides] = useState([0]);
  const [addedItemKey, setAddedItemKey] = useState(null);
  const [cartNoticeIsError, setCartNoticeIsError] = useState(false);
  // A gentle "back to top" helper for the long home page, shown after the first screen.
  const [showScrollTop, setShowScrollTop] = useState(false);
  // The section pill hides while reading down and returns when scrolling up to navigate.
  const [pillVisible, setPillVisible] = useState(false);
  const lastScrollY = useRef(0);
  // Slim sub-nav for jumping between the home page's sections; highlights as you scroll.
  const homeSections = [
    { id: "flavors", label: "Flavors" },
    { id: "cakes", label: "Cakes" },
    { id: "favorites", label: "Favorites" },
    { id: "reviews", label: "Reviews" },
    { id: "menu", label: "Menu" },
  ];
  const [activeSection, setActiveSection] = useState("");
  // The hero pauses when the visitor hovers/focuses it or after they take control with the
  // arrows, so no one is dragged to the next slide mid-read. Auto-rotation resumes on
  // mouse leave/blur and resumes on its own after a while.
  const [heroPaused, setHeroPaused] = useState(false);
  const heroHoldTimer = useRef(undefined);
  const addedTimer = useRef(undefined);
  const cartNoticeTimer = useRef(undefined);
  const reviewsSentinel = useRef(null);
  const popularSection = useRef(null);

  // Only download a slide photo when it becomes active. In particular, don't let the next
  // slide compete with the initial hero image and other above-the-fold content.
  useEffect(() => {
    setLoadedSlides((current) => {
      return current.includes(activeSlide) ? current : [...current, activeSlide];
    });
  }, [activeSlide]);

  // Auto-rotate the hero every 12 seconds, unless the visitor paused it or asked the
  // system to reduce motion. The photo preload above keeps running either way.
  useEffect(() => {
    if (heroPaused) return undefined;
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return undefined;
    }
    const timer = window.setTimeout(
      () => setActiveSlide((current) => (current + 1) % homeSlides.length),
      12000,
    );
    return () => window.clearTimeout(timer);
  }, [activeSlide, heroPaused]);

  const holdHero = () => {
    setHeroPaused(true);
    window.clearTimeout(heroHoldTimer.current);
  };

  const releaseHeroSoon = () => {
    window.clearTimeout(heroHoldTimer.current);
    heroHoldTimer.current = window.setTimeout(
      () => setHeroPaused(false),
      8000,
    );
  };

  useEffect(() => {
    const node = popularSection.current;
    if (!node) return undefined;
    let cancelled = false;
    // The cards are already drawn from the built-in menu. Stock is loaded when this section
    // is near the screen, so it does not compete with the hero photo.
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        apiRequest("/menu")
          .then(({ categories }) => {
            if (!cancelled) {
              setMenuCategories(categories);
              setPopularFlavors(getPopularFlavors(categories));
              setPopularLoaded(true);
              setMenuError("");
            }
          })
          .catch((error) => {
            if (!cancelled) {
              setMenuCategories(coldStoneMenuCategories);
              setPopularFlavors(getPopularFlavors(coldStoneMenuCategories));
              setPopularLoaded(true);
              setMenuError(error.message);
            }
          });
      },
      { rootMargin: "400px" },
    );
    observer.observe(node);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const node = reviewsSentinel.current;
    if (!node) return undefined;
    let cancelled = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        apiRequest("/reviews")
          .then(({ reviews: approvedReviews }) => {
            if (!cancelled) {
              setReviews(approvedReviews.slice(0, 6));
              const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
              let total = 0;
              for (const review of approvedReviews) {
                const rating = Math.min(
                  5,
                  Math.max(1, Math.round(Number(review.rating) || 0)),
                );
                distribution[rating] += 1;
                total += rating;
              }
              setReviewStats({
                count: approvedReviews.length,
                average: approvedReviews.length
                  ? total / approvedReviews.length
                  : 0,
                distribution,
              });
              setReviewsError("");
            }
          })
          .catch((error) => {
            if (!cancelled) setReviewsError(error.message);
          })
          .finally(() => {
            if (!cancelled) setReviewsLoaded(true);
          });
      },
      { rootMargin: "700px" },
    );
    observer.observe(node);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);

  function handleAddToCart(item, categoryTitle = "Ice Cream") {
    const itemKey = item.id || item.name;
    const added = addToCart({
      ...item,
      id: item.id || getMenuItemId(categoryTitle, item.name),
      itemType: "menu",
      categoryTitle,
    });
    setCartNoticeIsError(!added);
    setCartNotice(
      added
        ? t("Added {name} to your bag.", { name: t(item.name) })
        : t("This item could not be added to your bag. Please try again."),
    );
    window.clearTimeout(cartNoticeTimer.current);
    cartNoticeTimer.current = window.setTimeout(() => setCartNotice(""), 4500);
    if (added) {
        setAddedItemKey(itemKey);
        window.clearTimeout(addedTimer.current);
        addedTimer.current = window.setTimeout(() => setAddedItemKey(null), 1800);
    }
  }

  function handleCatalogFlavorAdd(flavor) {
    const added = addToCart(flavor);
    setCartNoticeIsError(!added);
    setCartNotice(
      added
        ? t("Added {name} to your bag.", { name: t(flavor.name) })
        : t("This item could not be added to your bag. Please try again."),
    );
    window.clearTimeout(cartNoticeTimer.current);
    cartNoticeTimer.current = window.setTimeout(() => setCartNotice(""), 4500);
    if (added) {
      setAddedItemKey(flavor.id);
      window.clearTimeout(addedTimer.current);
      addedTimer.current = window.setTimeout(() => setAddedItemKey(null), 1800);
    }
  }

  useEffect(() => () => window.clearTimeout(addedTimer.current), []);
  useEffect(() => () => window.clearTimeout(cartNoticeTimer.current), []);
  useEffect(
    () => () => window.clearTimeout(heroHoldTimer.current),
    [],
  );

  // Measure section positions at most once per frame while scrolling.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const scrollY = window.scrollY;
      const viewportHeight = window.innerHeight;
      const pastHero = scrollY > viewportHeight * 0.9;
      // The pill covers whatever is at the bottom of the screen, so it only appears while the
      // visitor is moving up the page, where they are looking to jump rather than to read.
      const goingUp = scrollY < lastScrollY.current - 4;
      const goingDown = scrollY > lastScrollY.current + 4;
      let current = "";
      if (pastHero) {
        // Read all layout values before updating React state.
        const sectionThreshold = viewportHeight * 0.4;
        for (const { id } of homeSections) {
          const node = document.getElementById(id);
          if (node && node.getBoundingClientRect().top <= sectionThreshold) {
            current = id;
          }
        }
      }
      if (goingUp || goingDown) setPillVisible(pastHero && goingUp);
      lastScrollY.current = scrollY;
      setShowScrollTop(pastHero);
      setActiveSection(current);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatPrice = (price) =>
    `${numberFormatter(language === "fr" ? "fr-CM" : "en-CM").format(price)} FCFA`;

  const catalogFlavorCards = catalogFlavors
    .filter((flavor) => flavor.availableQuantity > 0)
    .map((flavor, index) => ({
      id: `catalog-${flavor.id}`,
      title: flavor.name,
      detail: flavor.detail || flavor.description,
      mood: getFlavorMood(flavor),
      category: "catalog",
      item: flavor.name,
      image: flavor.image,
      color: flavor.color || ["#f7c8d9", "#ffd45d", "#d9b2a0", "#ded0ef"][index % 4],
      catalogFlavor: flavor,
    }));
  const catalogFlavorNames = new Set(catalogFlavorCards.map((flavor) => flavor.item.toLowerCase()));
  const allFlavorCards = [
    ...flavorInspiration.filter((flavor) => !catalogFlavorNames.has(flavor.item.toLowerCase())),
    ...catalogFlavorCards,
  ];
  const flavorFiltersActive = showAllFlavorResults || selectedFlavorMood !== "all" || Boolean(flavorSearch.trim());
  const matchingFlavors = allFlavorCards.filter((flavor) => {
    const matchesMood = selectedFlavorMood === "all" || flavor.mood === selectedFlavorMood;
    const query = flavorSearch.trim().toLocaleLowerCase();
    const searchableText = [flavor.title, flavor.item, flavor.detail, flavor.catalogFlavor?.description, flavor.catalogFlavor?.tag]
      .filter(Boolean)
      .join(" ");
    const matchesSearch = !query || searchableText.toLocaleLowerCase().includes(query)
      || t(flavor.title).toLocaleLowerCase().includes(query)
      || t(flavor.detail || "").toLocaleLowerCase().includes(query)
      || t(flavor.catalogFlavor?.tag || "").toLocaleLowerCase().includes(query);
    return matchesMood && matchesSearch;
  });
  const visibleFlavors = flavorFiltersActive ? matchingFlavors : flavorInspiration.slice(0, 8);

  // Real menu prices for the flavor cards, so the teasers set expectations before clicking.
  const flavorMenuItems = new Map(
    flavorInspiration.map((flavor) => [
      flavor.id,
      findMenuItem(menuCategories || coldStoneMenuCategories, flavor.category, flavor.item),
    ]),
  );
  const flavorPrices = new Map(
    [...flavorMenuItems].map(([id, item]) => [
      id,
      typeof item?.priceXaf === "number" ? item.priceXaf : null,
    ]),
  );

  // Cake cards use the same data source as the menu page, so prices match what a
  // visitor sees when they open the cake page.
  const cakeMenuCategory = useMemo(
    () =>
      (menuCategories || coldStoneMenuCategories).find(
        (category) => category.title === "Cakes & Pies",
      ) || { items: [] },
    [menuCategories],
  );
  const featuredCakeTypes = [
    { id: "all", label: "All cakes" },
    { id: "signature", label: "Signature" },
    { id: "birthday", label: "Birthday" },
    { id: "kids", label: "Kids’ cakes" },
    { id: "pies", label: "Pies" },
  ];
  const cakeTypeOf = (idName, name = "") => {
    // idName is the stable catalog ID, e.g. "Birthday Cake Design 1" or
    // "Ice Cream Pie Design 2". It is matched on those design IDs so a cake whose
    // name merely mentions a word like "pie" (or "birthday") is not misfiled —
    // that ordering made every cake badge read as "Pie" and collapsed the filter
    // to a single group.
    const text = String(idName || "").toLowerCase();
    if (text.includes("pie design") || text.includes("ice cream pie")) return "pies";
    if (text.includes("birthday cake design")) return "birthday";
    if (text.includes("kids\u2019 themed") || text.includes("kids' themed") || text.includes("kid")) return "kids";
    if (text.includes("design")) return "signature";
    // A few cakes carry no design ID, so their display name decides instead.
    const displayName = String(name || idName || "").toLowerCase();
    if (displayName.includes("pie")) return "pies";
    if (displayName.includes("birthday")) return "birthday";
    if (displayName.includes("kids\u2019") || displayName.includes("kids'") || displayName.includes("kid")) return "kids";
    return "signature";
  };
  const cakeQuery = cakeSearch.trim().toLowerCase();
  const cakeCards = useMemo(() => {
    const items = ((cakeMenuCategory.items || []).map((item) => ({
      ...item,
      idName: item.id || item.name,
    }))).filter((cake) => {
      const typeOk =
        selectedCakeType === "all" ||
        cakeTypeOf(cake.idName, cake.name) === selectedCakeType;
      const queryOk =
        !cakeQuery ||
        cake.name.toLowerCase().includes(cakeQuery) ||
        String(cake.detail || "").toLowerCase().includes(cakeQuery);
      return typeOk && queryOk;
    });
    const hasActiveFilter = selectedCakeType !== "all" || cakeQuery.length > 0;
    return hasActiveFilter ? items : items.slice(0, 8);
  }, [cakeMenuCategory, selectedCakeType, cakeQuery]);
  // Every cake card needs a slider (more than one photo), but many catalog items
  // only carry a single image and no gallery. For those, pair the item's own photo
  // with attractive cake photos from the same family (petite/sibling views of the
  // same design), so no card on the home page ever shows a lone static image.
  const relatedCakePhotos = useMemo(() => {
    const byDesign = new Map();
    for (const item of cakeMenuCategory.items || []) {
      const type = cakeTypeOf(item.id || item.name, item.name);
      const photos = [item.image, ...(item.gallery || [])].filter(Boolean);
      for (const photo of photos) {
        if (!byDesign.has(type)) byDesign.set(type, []);
        const bucket = byDesign.get(type);
        if (!bucket.includes(photo)) bucket.push(photo);
      }
    }
    return byDesign;
  }, [cakeMenuCategory]);
  const cakeImagesOf = (cake) => {
    const own = [...new Set([cake.image, ...(cake.gallery || [])].filter(Boolean))];
    if (own.length > 1) return own;
    const type = cakeTypeOf(cake.idName, cake.name);
    const related = (relatedCakePhotos.get(type) || []).filter(
      (photo) => !own.includes(photo),
    );
    const fallbacks = (cakeSliderFallbacks[type] || []).filter((photo) => !own.includes(photo));
    return [...new Set([...own, ...related, ...fallbacks])].slice(0, 4);
  };
  return (
    <div className="min-h-screen overflow-clip bg-[#fbfaf5] text-[#102c50]">
      <Header />
      <main id="main" tabIndex={-1}>
        <section
          id="home"
          className="relative isolate w-full overflow-clip bg-[#092a53] text-white"
        >
          <HeroBackground variant="navy" />

          <div className="mx-auto w-full max-w-[1320px] px-5 pt-10 sm:px-8 sm:pt-14 lg:px-12 lg:pt-16">
            <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-10">
              {/* Copy */}
              <div className="relative z-10 lg:col-span-6">
                <div className="home-hero-copy" key={activeSlide}>
                  <p className="inline-flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#ffdc32]">
                    <span
                      aria-hidden="true"
                      className="h-px w-10 bg-[#ffdc32]"
                    />
                    {t(homeSlides[activeSlide].eyebrow)}
                  </p>
                  <h1 className="mt-6 font-display text-[clamp(2.9rem,6.6vw,5.75rem)] font-extrabold leading-[0.95] tracking-[-0.04em] text-white">
                    {t(homeSlides[activeSlide].title)}
                    <span className="mt-1 block text-[#ffdc32]">
                      {t(homeSlides[activeSlide].accent)}
                    </span>
                  </h1>
                  <p className="mt-5 line-clamp-2 max-w-lg text-sm leading-6 text-white/70 sm:mt-7 sm:text-lg sm:leading-8">
                    {t(homeSlides[activeSlide].description)}
                  </p>
                </div>

                {/* Both buttons follow the slide on screen, so the main action always
                    matches what the copy is selling (e.g. "Order a cake" on the cake slide). */}
                <div className="mt-6 flex flex-wrap items-center gap-3 sm:mt-9">
                  <Link
                    className="inline-flex items-center gap-2 rounded-full bg-[#ffdc32] px-7 py-4 text-sm font-extrabold text-[#092a53] shadow-[0_14px_34px_rgba(255,220,50,0.25)] transition hover:-translate-y-0.5 hover:bg-[#ffe76c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32] focus-visible:ring-offset-2 focus-visible:ring-offset-[#092a53]"
                    to={homeSlides[activeSlide].primaryTo}
                  >
                    {t(homeSlides[activeSlide].primaryCta)} <ArrowIcon />
                  </Link>
                  {/* Kept on every screen size: on small screens it shares the row with
                      the primary button (flex-wrap) so mobile visitors get both actions. */}
                  <Link
                    className="inline-flex items-center gap-2 rounded-full border border-white/25 px-7 py-4 text-sm font-extrabold text-white transition hover:-translate-y-0.5 hover:border-white hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#092a53]"
                    to={homeSlides[activeSlide].secondaryTo}
                  >
                    {t(homeSlides[activeSlide].secondaryCta)}{" "}
                    <ArrowIcon diagonal />
                  </Link>
                </div>

                <ul className="mt-6 hidden flex-wrap gap-x-8 gap-y-3 border-t border-white/10 pt-6 text-sm font-semibold text-white/80 sm:flex">
                  {[
                    "Signature creations",
                    "A flavor for every mood",
                    "Cameroon locations",
                  ].map((label) => (
                    <li
                      className="inline-flex items-center gap-2.5"
                      key={label}
                    >
                      <span
                        aria-hidden="true"
                        className="grid size-5 place-items-center rounded-full bg-[#ffdc32]/15 text-[#ffdc32]"
                      >
                        <svg className="size-3" fill="none" viewBox="0 0 24 24">
                          <path
                            d="m5 12.5 4.5 4.5L19 7.5"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="3"
                          />
                        </svg>
                      </span>
                      {t(label)}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Carousel */}
              <div
                aria-label={t("Featured treats")}
                aria-roledescription={t("carousel")}
                className="relative lg:col-span-6"
                onBlur={releaseHeroSoon}
                onFocusCapture={holdHero}
                onKeyDown={(event) => {
                  if (event.key === "ArrowLeft") {
                    event.preventDefault();
                    setActiveSlide(
                      (current) =>
                        (current + homeSlides.length - 1) % homeSlides.length,
                    );
                    holdHero();
                  } else if (event.key === "ArrowRight") {
                    event.preventDefault();
                    setActiveSlide(
                      (current) => (current + 1) % homeSlides.length,
                    );
                    holdHero();
                  }
                }}
                onMouseEnter={holdHero}
                onMouseLeave={releaseHeroSoon}
                role="region"
              >
                <div
                  aria-label={`${activeSlide + 1} / ${homeSlides.length}`}
                  aria-roledescription={t("slide")}
                  className="relative aspect-[4/5] overflow-hidden rounded-[36px] bg-[#0f3566] shadow-[0_40px_90px_rgba(0,0,0,0.35)] ring-1 ring-white/10 sm:aspect-[5/5] lg:aspect-[4/5] xl:aspect-[5/5]"
                  role="group"
                >
                  {homeSlides.map((slide, index) => {
                    if (!loadedSlides.includes(index)) return null;
                    const isActive = activeSlide === index;
                    return (
                      <img
                        decoding="async"
                        alt={isActive ? t(slide.alt) : ""}
                        aria-hidden={!isActive}
                        className={`home-slide-image absolute inset-0 size-full object-cover object-center ${
                          isActive
                            ? "scale-100 opacity-100"
                            : "scale-[1.04] opacity-0"
                        }`}
                        fetchPriority={index === 0 ? "high" : "auto"}
                        key={slide.image}
                        loading={index === 0 ? "eager" : "lazy"}
                        sizes={HOME_SLIDE_SIZES}
                        src={slide.image}
                        srcSet={photoSrcSet(slide.image)}
                      />
                    );
                  })}
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-[#061d3a]/85 via-[#061d3a]/10 to-transparent"
                  />

                  <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 p-5 sm:p-6">
                    <span className="rounded-full border border-white/25 bg-white/15 px-3.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-white backdrop-blur-md">
                      {t("Featured")}
                    </span>
                    <span
                      aria-live="polite"
                      className="font-display text-sm font-extrabold tabular-nums text-white"
                    >
                      {String(activeSlide + 1).padStart(2, "0")}
                      <span className="text-white/50">
                        {" "}
                        / {String(homeSlides.length).padStart(2, "0")}
                      </span>
                    </span>
                  </div>

                  <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                    <p className="max-w-xs font-display text-2xl font-extrabold leading-tight sm:text-3xl">
                      {t(homeSlides[activeSlide].caption)}
                    </p>
                    <div className="mt-5 flex items-center gap-3">
                      <button
                        aria-hidden="true"
                        className="relative h-3 flex-1 cursor-pointer overflow-hidden rounded-full bg-white/20"
                        onClick={() => {
                          setActiveSlide((current) => (current + 1) % homeSlides.length);
                          holdHero();
                        }}
                        tabIndex={-1}
                        title={t("Next slide in {seconds} seconds", { seconds: 12 })}
                        type="button"
                      >
                        <span
                          className="home-hero-progress absolute inset-0 rounded-full bg-[#ffdc32]"
                          key={activeSlide}
                        />
                      </button>
                      <button
                        aria-label={t("Previous slide")}
                        className="grid size-12 place-items-center rounded-full border border-white/30 bg-white/10 text-white backdrop-blur-md transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32]"
                        onClick={() => {
                          setActiveSlide(
                            (current) =>
                              (current + homeSlides.length - 1) %
                              homeSlides.length,
                          );
                          holdHero();
                        }}
                        type="button"
                      >
                        <svg
                          aria-hidden="true"
                          className="size-4 rotate-180"
                          fill="none"
                          viewBox="0 0 20 20"
                        >
                          <path
                            d="M3.5 10h12m-5-5 5 5-5 5"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.8"
                          />
                        </svg>
                      </button>
                      <button
                        aria-label={t("Next slide")}
                        className="grid size-11 place-items-center rounded-full bg-[#ffdc32] text-[#092a53] shadow-md transition hover:scale-105 hover:bg-[#ffe76c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        onClick={() => {
                          setActiveSlide(
                            (current) => (current + 1) % homeSlides.length,
                          );
                          holdHero();
                        }}
                        type="button"
                      >
                        <ArrowIcon />
                      </button>
                    </div>
                  </div>
                </div>

                <div
                  aria-label={t("Choose a featured slide")}
                  className="absolute top-1/2 -left-4 hidden -translate-y-1/2 flex-col gap-3 rounded-[22px] bg-white/10 p-2 shadow-[0_20px_50px_rgba(0,0,0,0.25)] ring-1 ring-white/15 backdrop-blur-md sm:flex lg:-left-10"
                  role="group"
                >
                  {homeSlides.map((slide, index) => {
                    const isActive = activeSlide === index;
                    return (
                      <button
                        aria-current={isActive ? "true" : undefined}
                        aria-label={t("Show slide {number}", {
                          number: index + 1,
                        })}
                        className={`relative size-16 overflow-hidden rounded-2xl ring-offset-2 ring-offset-[#092a53] transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32] ${
                          isActive
                            ? "ring-2 ring-[#ffdc32]"
                            : "opacity-60 hover:opacity-100"
                        }`}
                        key={slide.image}
                        onClick={() => {
                          setActiveSlide(index);
                          holdHero();
                        }}
                        type="button"
                      >
                        <img
                          decoding="async"
                          loading="lazy"
                          alt=""
                          className="size-full object-cover"
                          onError={photoErrorHandler(slide.image)}
                          src={thumbnail(slide.image, "tiny")}
                        />
                      </button>
                    );
                  })}
                </div>
                <div
                  aria-label={t("Choose a featured slide")}
                  className="mt-2 flex justify-center sm:hidden"
                  role="group"
                >
                  {/* The dots stay small, but each one has a finger-sized (32px) tap area. */}
                  {homeSlides.map((slide, index) => (
                    <button
                      aria-current={activeSlide === index ? "true" : undefined}
                      aria-label={t("Show slide {number}", {
                        number: index + 1,
                      })}
                      className="grid h-11 min-w-11 place-items-center px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32] rounded-full"
                      key={slide.image}
                      onClick={() => {
                        setActiveSlide(index);
                        holdHero();
                      }}
                      type="button"
                    >
                      <span
                        aria-hidden="true"
                        className={`h-2 rounded-full transition-all ${activeSlide === index ? "w-8 bg-[#ffdc32]" : "w-2 bg-white/35"}`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Trust strip */}
          <div aria-label={t("Why people love us")} className="relative">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent"
            />
            <div
              aria-hidden="true"
              className="hero-blob-a pointer-events-none absolute -left-32 -top-24 -z-10 size-[22rem] rounded-full bg-[radial-gradient(closest-side,rgb(255_220_50/0.08),rgb(255_220_50/0.08)_35%,transparent)]"
            />
            <div
              aria-hidden="true"
              className="hero-blob-b pointer-events-none absolute -bottom-32 -right-24 -z-10 size-[20rem] rounded-full bg-[radial-gradient(closest-side,rgb(28_79_138/0.45),rgb(28_79_138/0.45)_35%,transparent)]"
            />
            <div className="mx-auto max-w-[1320px] px-5 pb-12 pt-10 sm:px-8 sm:pb-14 lg:px-12">
              <div className="flex flex-wrap items-center justify-between gap-6">
                <p className="inline-flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#ffdc32]">
                  <span aria-hidden="true" className="h-px w-10 bg-[#ffdc32]" />
                  {t("Why people love us")}
                </p>
                <Link
                  className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-white/70 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32]"
                  to="/locations"
                >
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full bg-[#ffdc32]"
                  />
                  {t("Pickup or delivery in Douala and Yaoundé.")}
                </Link>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    value: t("5 shops"),
                    label: t("Across Cameroon"),
                    icon: "M12 21s-7-4.6-7-10a7 7 0 0 1 14 0c0 5.4-7 10-7 10Zm0-7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
                  },
                  {
                    value: t("30 min"),
                    label: t("Pickup at your chosen store"),
                    // Clock icon — the old basket icon didn't read as "time".
                    outlineIcon: true,
                    icon: "M12 6v6l4 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z",
                  },
                  {
                    value: "FCFA + MoMo",
                    label: t("Cards and Mobile Money accepted"),
                    // Card icon — the old star icon suggested a rating, not payment.
                    outlineIcon: true,
                    icon: "M3 7.5A2.5 2.5 0 0 1 5.5 5h13A2.5 2.5 0 0 1 21 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5v-9Zm0 3h18M6.5 15.5H10",
                  },
                  {
                    value: "1 pt / 100 FCFA",
                    label: t("Earn loyalty points on every order"),
                    title: t("Earn 1 point per 100 FCFA. Redeem 100 points for 1,000 FCFA off."),
                    icon: "M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8-6.1-3.4-6.1 3.4 1.4-6.8L2.2 9.1l6.9-.8L12 2Z",
                  },
                ].map((stat) => (
                  <div
                    className="group relative flex h-full items-center gap-4 overflow-hidden rounded-3xl bg-white/[0.05] px-6 py-6 ring-1 ring-white/10 backdrop-blur-md transition duration-300 hover:-translate-y-0.5 hover:bg-white/[0.09] hover:ring-[#ffdc32]/45 focus-within:ring-[#ffdc32]/45"
                    key={stat.label}
                    title={stat.title}
                  >
                    {/* Not a native tooltip: also on the label, so the redemption rule is
                        readable on touch screens and by keyboard users. */}
                    {stat.title && <span className="sr-only">{stat.title}</span>}
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute -right-10 -top-10 size-24 rounded-full bg-[radial-gradient(closest-side,rgb(255_220_50/0.14),transparent)] opacity-0 transition duration-500 group-hover:opacity-100"
                    />
                    <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#ffdc32]/15 text-[#ffdc32] ring-1 ring-[#ffdc32]/25 transition duration-300 group-hover:scale-105 group-hover:bg-[#ffdc32]/25">
                      <svg
                        className="size-5"
                        fill={stat.outlineIcon ? "none" : "currentColor"}
                        viewBox="0 0 24 24"
                      >
                        <path
                          d={stat.icon}
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={stat.outlineIcon ? 1.8 : 0}
                        />
                      </svg>
                    </span>
                    <span className="flex flex-col">
                      <span className="font-display text-2xl font-extrabold tabular-nums text-white">
                        {stat.value}
                      </span>
                      <span className="text-xs font-semibold leading-4 text-white/70">
                        {stat.label}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* How ordering works — answers the first-time visitor's questions in one glance. */}
        <section
          aria-labelledby="how-it-works-heading"
          className="border-b border-[#e9e5da] bg-[#f8f6f1] px-5 py-10 sm:px-8 sm:py-12 lg:px-10"
        >
          <div className="mx-auto max-w-[1320px]">
            <h2
              className="text-center font-display text-xl font-extrabold tracking-tight text-[#092a53] sm:text-2xl"
              id="how-it-works-heading"
            >
              {t("How it works")}
            </h2>
            <ol className="mt-6 grid gap-3 sm:grid-cols-3 sm:gap-4">
              {[
                {
                  step: "1",
                  title: "Choose your treats",
                  description: "Browse the menu and add favorites to your bag.",
                  icon: "🍦",
                },
                {
                  step: "2",
                  title: "Order online",
                  description: "Checkout with cards or Mobile Money in a few taps.",
                  icon: "📱",
                },
                {
                  step: "3",
                  title: "Pick up or get it delivered",
                  description: "Ready in about 30 minutes at your chosen store.",
                  icon: "🛵",
                },
              ].map(({ step, title, description, icon }) => (
                <li
                  className="relative flex flex-col items-center gap-2 rounded-2xl bg-white px-4 py-5 text-center shadow-[0_1px_0_rgba(9,42,83,0.04),0_10px_28px_rgba(9,42,83,0.06)] ring-1 ring-[#ebe7dc] sm:flex-row sm:gap-4 sm:px-5 sm:text-left"
                  key={step}
                >
                  <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#fff3b8] text-2xl">
                    {icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display text-base font-extrabold leading-tight text-[#092a53]">
                      <span aria-hidden="true" className="text-[#f5a623]">{step}. </span>
                      {t(title)}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-[#52647b] sm:text-[13px]">
                      {t(description)}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          aria-labelledby="flavor-inspiration-heading"
          className="relative overflow-hidden bg-[#fbfaf5] px-5 py-16 text-[#092a53] sm:px-8 sm:py-20 lg:px-10 lg:py-24"
          id="flavors"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-40 -top-48 size-[32rem] rounded-full bg-[radial-gradient(closest-side,rgb(255_220_50/0.12),transparent)]"
          />
          <div className="relative mx-auto max-w-[1320px]">
            <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#123b68]">
                  {t("Follow your flavor")}
                </p>
                <h2
                  className="mt-4 max-w-[650px] font-display text-4xl font-extrabold leading-[1.02] tracking-tight text-[#092a53] sm:text-5xl lg:text-6xl"
                  id="flavor-inspiration-heading"
                >
                  {t("What\u2019s your kind of happy?")}
                </h2>
              </div>
              <div className="max-w-[360px] lg:mb-2">
                <p className="text-lg leading-8 font-medium text-[#123b68]">
                  {t(
                    "Fruity, chocolatey or beautifully classic. Let your cravings lead the way.",
                  )}
                </p>
                <Link
                  className="group mt-6 inline-flex min-h-14 items-center gap-3 rounded-full border-2 border-[#092a53] bg-white/60 px-8 py-3.5 text-base font-extrabold text-[#092a53] shadow-[0_6px_18px_rgba(9,42,83,0.08)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#092a53] hover:text-white hover:shadow-[0_12px_28px_rgba(9,42,83,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2"
                  to="/flavors"
                >
                  {t("Explore all flavors")}
                  <svg
                    aria-hidden="true"
                    className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M7 17 17 7M8 7h9v9"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.2"
                    />
                  </svg>
                </Link>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div aria-label={t("Filter flavor inspiration")} className="flex flex-wrap gap-2.5" role="group">
                {[
                  ["all", "All cravings"],
                  ["fruit", "Fruit lovers"],
                  ["chocolate", "Chocolate moods"],
                  ["classics", "The classics"],
                ].map(([mood, label]) => {
                  const selected = selectedFlavorMood === mood;
                  return (
                    <button
                      aria-pressed={selected}
                      className={`min-h-12 rounded-full border px-5 py-2.5 text-[13px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2 ${
                        selected
                          ? "border-[#092a53] bg-[#092a53] text-white shadow-[0_6px_16px_rgba(9,42,83,0.18)]"
                          : "border-[#cfd8e1] bg-transparent text-[#123b68] hover:border-[#092a53] hover:bg-white/70"
                      }`}
                      key={mood}
                      onClick={() => {
                        setSelectedFlavorMood(mood);
                        setShowAllFlavorResults(mood !== "all");
                      }}
                      type="button"
                    >
                      {t(label)}
                    </button>
                  );
                })}
              </div>
              <label className="relative block w-full sm:max-w-xs">
                <span className="sr-only">{t("Search flavors")}</span>
                <svg aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#65748a]" fill="none" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                  <path d="m20 20-3.5-3.5" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                </svg>
                <input
                  className="min-h-11 w-full rounded-full border border-[#cfd8e1] bg-white py-2.5 pl-12 pr-10 text-sm font-semibold text-[#092a53] outline-none transition placeholder:text-[#8190a1] focus:border-[#092a53] focus:ring-2 focus:ring-[#092a53]/15"
                  onChange={(event) => {
                    const query = event.target.value;
                    setFlavorSearch(query);
                    if (query.trim()) setShowAllFlavorResults(true);
                    else if (selectedFlavorMood === "all") setShowAllFlavorResults(false);
                  }}
                  placeholder={t("Search flavors")}
                  type="search"
                  value={flavorSearch}
                />
                {flavorSearch && (
                  <button
                    aria-label={t("Clear search")}
                    className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-[#65748a] transition before:absolute before:-inset-2 before:content-[''] hover:bg-[#efece3] hover:text-[#092a53]"
                    onClick={() => {
                      setFlavorSearch("");
                      if (selectedFlavorMood === "all") setShowAllFlavorResults(false);
                    }}
                    type="button"
                  >
                    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
                      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                    </svg>
                  </button>
                )}
              </label>
            </div>

            {flavorFiltersActive && (
              <p aria-live="polite" className="mt-5 text-xs font-semibold text-[#65748a]">
                {t("Showing {shown} of {total} flavors", {
                  shown: matchingFlavors.length,
                  total: allFlavorCards.length,
                })}
              </p>
            )}
            {visibleFlavors.length === 0 ? (
              <p
                className="mt-8 rounded-2xl border border-[#e6ebf1] bg-white px-5 py-8 text-center text-base leading-7 text-[#52647b]"
                role="status"
              >
                {t("No flavors match your filters.")}
              </p>
            ) : null}
            <ul
              className={visibleFlavors.length === 0 ? "hidden" : "mt-8 grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5"}
            >
              {visibleFlavors.map((flavor) => {
                const catalogFlavor = flavor.catalogFlavor;
                const item = catalogFlavor || flavorMenuItems.get(flavor.id);
                const itemKey = item?.id || item?.name || flavor.item;
                const added = addedItemKey === itemKey;
                const soldOut = catalogFlavor
                  ? catalogFlavor.availableQuantity < 1
                  : item?.isAvailable === false || item?.availableQuantity < 1;
                const images = getFlavorCardImages(flavor, item);

                return (
                  <li
                    className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_10px_30px_rgba(9,42,83,0.10)] ring-1 ring-transparent transition duration-500 ease-out hover:-translate-y-2 hover:rotate-[0.4deg] hover:shadow-[0_24px_48px_rgba(9,42,83,0.18)] hover:ring-[color:var(--card-accent)]/40 motion-reduce:transform-none motion-reduce:transition-none"
                    key={flavor.id}
                    style={{ "--card-accent": flavor.color }}
                  >
                    {/* Shine sweep on hover */}
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 z-20 -translate-x-[130%] skew-x-[-18deg] bg-[linear-gradient(100deg,transparent_30%,rgba(255,255,255,0.55)_50%,transparent_70%)] transition-transform duration-700 ease-out group-hover:translate-x-[130%] motion-reduce:hidden"
                    />
                    <div className="relative">
                      <ProductImageSlider
                        frameClassName="rounded-none shadow-none"
                        imageClassName="aspect-[4/3] transition-transform duration-700 ease-out group-hover:scale-[1.06] motion-reduce:transform-none"
                        images={images}
                        name={t(flavor.title)}
                        resetKey={flavor.id}
                        sizes="(min-width: 1024px) 24vw, (min-width: 640px) 46vw, 100vw"
                      />
                      <span
                        className="absolute left-4 top-4 rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#092a53] shadow-sm backdrop-blur-sm transition duration-500 ease-out group-hover:-rotate-3 group-hover:scale-110 group-hover:shadow-md motion-reduce:transform-none"
                        style={{ backgroundColor: flavor.color }}
                      >
                        {t(
                          flavor.mood === "fruit"
                            ? "Fruity"
                            : flavor.mood === "chocolate"
                              ? "Chocolatey"
                              : "Classic",
                        )}
                      </span>
                      {soldOut && (
                        <span className="absolute right-4 top-4 rounded-full bg-[#092a53]/85 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-white shadow-sm backdrop-blur-sm">
                          {t("Sold out today")}
                        </span>
                      )}
                    </div>
                    <div
                      className="flex min-h-[190px] flex-1 flex-col justify-between gap-3 border-t-4 px-5 py-4 sm:px-6 sm:py-5"
                      style={{ borderColor: flavor.color }}
                    >
                      <div>
                        <Link
                          className="line-clamp-2 min-h-[2.5em] font-display text-xl font-extrabold leading-tight text-[#092a53] transition-colors duration-300 hover:text-[#163e6b] focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] sm:text-2xl"
                          to={catalogFlavor
                            ? `/flavor/${catalogFlavor.id}`
                            : `/menu?${new URLSearchParams({ category: flavor.category, item: flavor.item })}`}
                        >
                          {t(flavor.title)}
                        </Link>
                        <p className="mt-2 line-clamp-2 min-h-10 text-xs font-medium leading-5 text-[#123b68] sm:text-[13px]">
                          {t(flavor.detail || "")}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`whitespace-nowrap font-display text-sm font-extrabold tabular-nums transition-colors duration-300 ${
                            added ? "animate-pulse text-green-700" : "text-[#092a53]"
                          }`}
                        >
                          {catalogFlavor
                            ? formatPrice(catalogFlavor.price)
                            : flavorPrices.get(flavor.id) != null
                              ? formatPrice(flavorPrices.get(flavor.id))
                              : ""}
                        </span>
                        <button
                          aria-label={soldOut
                            ? t("Sold out")
                            : t("Add {name} to your bag", { name: t(flavor.item) })}
                          className={`min-h-11 shrink-0 rounded-full px-4 text-xs font-extrabold transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2 group-hover:scale-105 motion-reduce:transform-none disabled:cursor-not-allowed disabled:bg-[#efece3] disabled:text-[#65748a] disabled:group-hover:scale-100 ${
                            added
                              ? "bg-[#4caf50] text-white"
                              : "bg-[#ffdc32] text-[#092a53] hover:bg-[#ffe76c]"
                          }`}
                          disabled={soldOut || !item}
                          onClick={() => catalogFlavor
                            ? handleCatalogFlavorAdd(catalogFlavor)
                            : item && handleAddToCart(item, flavor.category)}
                          type="button"
                        >
                          {soldOut ? t("Sold out") : added ? t("Added") : t("Add to bag")}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            {!flavorFiltersActive && visibleFlavors.length > 0 && (
              <p className="mt-5 text-xs leading-5 text-[#65748a]">
                {t("Search or choose a craving to see more flavors.")}
              </p>
            )}

          </div>
        </section>

        {/* Cake cards — same card design/animations/search as "Follow your flavor", with a
            "Request a custom cake" button that leads to the cake builder page. */}
        <section
          aria-labelledby="cakes-heading"
          className="relative overflow-hidden bg-[#fbfaf5] px-5 py-16 text-[#092a53] sm:px-8 sm:py-20 lg:px-10 lg:py-24"
          id="cakes"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-40 -top-48 size-[32rem] rounded-full bg-[radial-gradient(closest-side,rgb(255_220_50/0.12),transparent)]"
          />
          <div className="relative mx-auto max-w-[1320px]">
            <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#123b68]">
                  {t("Celebrate with a cake")}
                </p>
                <h2
                  className="mt-4 max-w-[650px] font-display text-4xl font-extrabold leading-[1.02] tracking-tight text-[#092a53] sm:text-5xl lg:text-6xl"
                  id="cakes-heading"
                >
                  {t("Cakes for every occasion")}
                </h2>
                <p className="mt-5 max-w-lg text-base leading-7 text-[#52647b] sm:text-lg sm:leading-8">
                  {t("Creamy ice cream cakes for birthdays, parties, and every celebration.")}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-start gap-3 sm:justify-end lg:mb-2 lg:w-auto">
                <Link
                  className="group inline-flex min-h-12 shrink-0 items-center gap-3 rounded-full bg-[#092a53] px-6 py-3 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(9,42,83,0.2)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#163e6b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2"
                  to="/custom-cake"
                >
                  {t("Request a custom cake")}
                  <span
                    aria-hidden="true"
                    className="grid size-7 place-items-center rounded-full bg-[#ffdc32] text-[#092a53] transition-transform duration-300 group-hover:translate-x-0.5"
                  >
                    <ArrowIcon />
                  </span>
                </Link>
                <Link
                  className="group inline-flex min-h-12 shrink-0 items-center gap-3 rounded-full border border-[#cfd8e1] bg-white px-6 py-3 text-sm font-extrabold text-[#092a53] transition duration-300 hover:-translate-y-0.5 hover:border-[#092a53] hover:bg-[#fafdff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2"
                  to={`/menu?${new URLSearchParams({ category: "Cakes & Pies" })}`}
                >
                  {t("Explore all cakes")}
                  <span
                    aria-hidden="true"
                    className="grid size-7 place-items-center rounded-full bg-[#ffdc32] text-[#092a53] transition-transform duration-300 group-hover:translate-x-0.5"
                  >
                    <ArrowIcon />
                  </span>
                </Link>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div
                aria-label={t("Filter cakes")}
                className="flex flex-wrap gap-2.5"
                role="group"
              >
                {featuredCakeTypes.map(({ id, label }) => {
                  const selected = selectedCakeType === id;
                  return (
                    <button
                      aria-pressed={selected}
                      className={`min-h-12 rounded-full border px-5 py-2.5 text-[13px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2 ${
                        selected
                          ? "border-[#092a53] bg-[#092a53] text-white shadow-[0_6px_16px_rgba(9,42,83,0.18)]"
                          : "border-[#cfd8e1] bg-transparent text-[#123b68] hover:border-[#092a53] hover:bg-white/70"
                      }`}
                      key={id}
                      onClick={() => setSelectedCakeType(id)}
                      type="button"
                    >
                      {t(label)}
                    </button>
                  );
                })}
              </div>
              <label className="block w-full lg:ml-auto lg:max-w-[380px]">
                <span className="sr-only">{t("Search cakes")}</span>
                <div className="group relative">
                  <svg
                    aria-hidden="true"
                    className="pointer-events-none absolute left-5 top-1/2 size-5 -translate-y-1/2 text-[#65748a] transition-colors group-focus-within:text-[#092a53]"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="m21 21-4.35-4.35M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeWidth="2"
                    />
                  </svg>
                  <input
                    className="h-14 w-full rounded-2xl border-2 border-[#dce3eb] bg-white py-3 pl-14 pr-5 text-base font-semibold text-[#092a53] shadow-[0_8px_24px_rgba(9,42,83,0.08)] transition placeholder:font-medium placeholder:text-[#929eac] hover:border-[#9eafc2] hover:shadow-[0_10px_28px_rgba(9,42,83,0.12)] focus:border-[#092a53] focus:outline-none focus:ring-4 focus:ring-[#092a53]/10"
                    onChange={(event) => setCakeSearch(event.target.value)}
                    placeholder={t("Search cakes\u2026")}
                    type="search"
                    value={cakeSearch}
                  />
                </div>
              </label>
            </div>

              {cakeCards.length === 0 ? (
                <p
                  className="mt-8 rounded-2xl border border-[#e6ebf1] bg-white px-5 py-8 text-center text-base leading-7 text-[#52647b]"
                  role="status"
                >
                  {t("No cakes match your search \u2014 try another name or filter.")}
                </p>
              ) : (
                <ul className="mt-8 grid auto-rows-fr items-start gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
                  {cakeCards.map((cake) => {
                    const cakeKey = cake.id || getMenuItemId("Cakes & Pies", cake.name);
                    const added = addedItemKey === cakeKey;
                    const soldOut = cake.isAvailable === false || cake.availableQuantity < 1;
                    const images = cakeImagesOf(cake);
                    const accent = { pies: "#7a4bd8", kids: "#f56586", birthday: "#f5a623" }[
                      cakeTypeOf(cake.idName, cake.name)
                    ] || "#38b2ac";

                    return (
                      <li
                        className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_10px_30px_rgba(9,42,83,0.10)] ring-1 ring-transparent transition duration-500 ease-out hover:-translate-y-2 hover:rotate-[0.4deg] hover:shadow-[0_24px_48px_rgba(9,42,83,0.18)] hover:ring-[color:var(--card-accent)]/40 motion-reduce:transform-none motion-reduce:transition-none"
                        key={cake.name}
                        style={{ "--card-accent": accent }}
                      >
                        {/* Shine sweep on hover */}
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 z-20 -translate-x-[130%] skew-x-[-18deg] bg-[linear-gradient(100deg,transparent_30%,rgba(255,255,255,0.55)_50%,transparent_70%)] transition-transform duration-700 ease-out group-hover:translate-x-[130%] motion-reduce:hidden"
                        />
                        <div className="relative">
                          <ProductImageSlider
                            frameClassName="rounded-none shadow-none"
                            imageClassName="aspect-[4/3] transition-transform duration-700 ease-out group-hover:scale-[1.06] motion-reduce:transform-none"
                            images={images}
                            name={t(cake.name)}
                            resetKey={cake.name}
                            sizes="(min-width: 1024px) 24vw, (min-width: 640px) 46vw, 100vw"
                          />
                          <span
                            className="absolute left-4 top-4 rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#092a53] shadow-sm backdrop-blur-sm transition duration-500 ease-out group-hover:-rotate-3 group-hover:scale-110 group-hover:shadow-md motion-reduce:transform-none"
                            style={{ backgroundColor: accent }}
                          >
                            {t(
                              cakeTypeOf(cake.idName, cake.name) === "pies"
                                ? "Pie"
                                : cakeTypeOf(cake.idName, cake.name) === "birthday"
                                  ? "Birthday"
                                  : cakeTypeOf(cake.idName, cake.name) === "kids"
                                    ? "Kids"
                                    : "Signature",
                            )}
                          </span>
                          {soldOut && (
                            <span className="absolute right-4 top-4 rounded-full bg-[#092a53]/85 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-white shadow-sm backdrop-blur-sm">
                              {t("Sold out today")}
                            </span>
                          )}
                        </div>
                        <div
                          className="flex min-h-[190px] flex-1 flex-col justify-between gap-3 border-t-4 px-5 py-4 sm:px-6 sm:py-5"
                          style={{ borderColor: accent }}
                        >
                          <div>
                            <Link
                              className="line-clamp-2 min-h-[2.5em] font-display text-lg font-extrabold leading-tight text-[#092a53] transition-colors duration-300 hover:text-[#163e6b] focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] sm:text-xl"
                              to={`/menu?${new URLSearchParams({ category: "Cakes & Pies", item: cake.name })}`}
                            >
                              {t(cake.name)}
                            </Link>
                            <p className="mt-2 line-clamp-2 min-h-10 text-xs font-medium leading-5 text-[#123b68] sm:text-[13px]">
                              {t(cake.detail)}
                            </p>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`whitespace-nowrap font-display text-sm font-extrabold tabular-nums transition-colors duration-300 ${
                                added ? "animate-pulse text-green-700" : "text-[#092a53]"
                              }`}
                            >
                              {typeof cake.priceXaf === "number" ? formatPrice(cake.priceXaf) : ""}
                            </span>
                            <button
                              aria-label={
                                added
                                  ? t("Added to your bag")
                                  : t("Add {name} to your bag", { name: t(cake.name) })
                              }
                              className={`min-h-11 shrink-0 rounded-full px-4 text-xs font-extrabold transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2 group-hover:scale-105 motion-reduce:transform-none disabled:cursor-not-allowed disabled:bg-[#efece3] disabled:text-[#65748a] disabled:group-hover:scale-100 ${
                                added
                                  ? "bg-[#4caf50] text-white"
                                  : "bg-[#ffdc32] text-[#092a53] hover:bg-[#ffe76c]"
                              }`}
                              disabled={soldOut}
                              onClick={() => handleAddToCart(cake, "Cakes & Pies")}
                              type="button"
                            >
                              {soldOut ? t("Sold out") : added ? t("Added") : t("Add to bag")}
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="mt-8 text-xs leading-5 text-[#65748a]">
                {t(
                  "A taste of the cake menu. See all designs on the cakes page \u2014 or build your own.",
                )}
              </p>
          </div>
        </section>

        <section
          aria-labelledby="popular-flavors-heading"
          className="relative isolate overflow-hidden bg-[#fbfaf5] px-5 pb-20 pt-12 sm:px-8 sm:pb-24 sm:pt-14 lg:px-10 lg:pb-28 lg:pt-16"
          id="favorites"
          ref={popularSection}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-40 top-20 -z-10 size-[30rem] rounded-full bg-[radial-gradient(closest-side,rgb(255_220_50/0.1),rgb(255_220_50/0.1)_35%,transparent)]"
          />
          <div className="mx-auto max-w-[1320px]">
            <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                <p className="inline-flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#8a7000]">
                  <span aria-hidden="true" className="h-px w-10 bg-[#a48700]" />
                  {t("Our favorites")}
                </p>
                <h2
                  className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-[#092a53] sm:text-5xl"
                  id="popular-flavors-heading"
                >
                  {t("Fan favorites")}
                </h2>
                <p className="mt-4 flex max-w-xl flex-wrap items-center gap-x-4 gap-y-2 text-base leading-7 text-[#52647b]">
                  <span>
                    {t(
                      "Our most-loved signature creations, mixed to order on the frozen stone.",
                    )}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#fff8d6] px-3 py-1 text-xs font-bold text-[#8a7000] ring-1 ring-[#f0dfa0]">
                    <span aria-hidden="true">✨</span>{" "}
                    {t("Frozen stone special")}
                  </span>
                </p>
              </div>
              <Link
                className="inline-flex shrink-0 items-center gap-2 self-start rounded-full bg-[#092a53] px-6 py-3.5 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(9,42,83,0.2)] transition hover:-translate-y-0.5 hover:bg-[#163e6b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2 md:self-auto"
                to={`/menu?category=${encodeURIComponent("Ice Cream")}`}
              >
                {t("View all")} <ArrowIcon />
              </Link>
            </div>

            <div
              aria-busy={!popularLoaded}
              aria-label={!popularLoaded ? t("Loading favorites") : undefined}
              className="mt-12 grid gap-5 lg:grid-cols-12 lg:gap-6"
              role={!popularLoaded ? "status" : undefined}
            >
              {popularLoaded ? popularFlavors.map((item, index) => {
                const soldOut =
                  item.isAvailable === false || item.availableQuantity < 1;
                const featured = index === 0;
                const itemKey = item.id || item.name;
                const added = addedItemKey === itemKey;
                const itemLink = `/menu?category=${encodeURIComponent("Ice Cream")}`;
                const bagIcon = added ? (
                  <svg
                    aria-hidden="true"
                    className="size-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="m5 12.5 4.5 4.5L19 7.5"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                    />
                  </svg>
                ) : !soldOut ? (
                  <svg
                    aria-hidden="true"
                    className="size-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M5 8h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9L5 8Z"
                      stroke="currentColor"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />
                    <path
                      d="M9 8V6.5a3 3 0 0 1 6 0V8"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeWidth="1.8"
                    />
                  </svg>
                ) : null;
                const image = (
                  <img
                    decoding="async"
                    alt=""
                    className={`size-full object-cover transition-transform duration-500 group-hover:scale-[1.03] ${soldOut ? "grayscale-[60%]" : ""}`}
                    loading="lazy"
                    onError={photoErrorHandler(
                      item.image,
                      "/images/hero-ice-cream.jpg",
                    )}
                    sizes={
                      featured
                        ? "(min-width: 1024px) 40vw, 100vw"
                        : "(min-width: 1024px) 25vw, 50vw"
                    }
                    src={item.image}
                    srcSet={photoSrcSet(item.image)}
                  />
                );

                if (featured) {
                  return (
                    <article
                      className="group relative isolate flex min-h-[460px] flex-col justify-end overflow-hidden rounded-[32px] p-6 text-white shadow-[0_30px_70px_rgba(9,42,83,0.22)] sm:min-h-[520px] sm:p-8 lg:col-span-5 lg:row-span-4 lg:min-h-0"
                      key={itemKey}
                      style={{ backgroundColor: popularFlavorColors[index] }}
                    >
                      <div className="absolute inset-0 -z-20">{image}</div>
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 -z-10 bg-gradient-to-t from-[#061d3a] via-[#061d3a]/55 via-40% to-transparent"
                      />
                      {soldOut && (
                        <span className="absolute left-6 top-6 rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-red-700 shadow-sm backdrop-blur-sm sm:left-8 sm:top-8">
                          {t("Sold out")}
                        </span>
                      )}

                      <h3 className="font-display text-3xl font-extrabold leading-tight sm:text-4xl">
                        <Link
                          className="after:absolute after:inset-0 after:rounded-[32px] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-[#ffdc32]"
                          to={itemLink}
                        >
                          {t(item.name)}
                        </Link>
                      </h3>
                      <p className="mt-2 max-w-md text-sm leading-6 text-white/75 sm:text-base sm:leading-7">
                        {t(item.detail)}
                      </p>
                      <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-white/15 pt-5">
                        <div>
                          <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-white/55">
                            {t("Price")}
                          </p>
                          <p className={`mt-0.5 whitespace-nowrap font-display text-2xl font-extrabold tabular-nums transition-colors duration-300 sm:text-3xl ${added ? "animate-pulse text-white" : "text-[#ffdc32]"}`}>
                            {formatPrice(item.priceXaf)}
                          </p>
                        </div>
                        <button
                          aria-label={
                            soldOut
                              ? t("Sold out")
                              : t("Add {name} to your bag", {
                                  name: t(item.name),
                                })
                          }
                          className={`relative z-10 inline-flex items-center gap-2 whitespace-nowrap rounded-full px-6 py-3.5 text-sm font-extrabold transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#092a53] disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/60 ${
                            added
                              ? "bg-[#4caf50] text-white"
                              : "bg-[#ffdc32] text-[#092a53] hover:-translate-y-0.5 hover:bg-white"
                          }`}
                          disabled={soldOut}
                          onClick={() => handleAddToCart(item)}
                          type="button"
                        >
                          {bagIcon}
                          {soldOut
                            ? t("Sold out")
                            : added
                              ? t("Added")
                              : t("Add to bag")}
                        </button>
                      </div>
                    </article>
                  );
                }

                return (
                  <article
                    className="group relative flex items-center gap-4 rounded-[24px] bg-white p-3 pr-4 shadow-[0_1px_0_rgba(9,42,83,0.04),0_8px_24px_rgba(9,42,83,0.06)] ring-1 ring-[#ebe7dc] sm:gap-5 sm:p-4 sm:pr-5 lg:col-span-7"
                    key={itemKey}
                  >
                    <div
                      className="relative size-20 shrink-0 overflow-hidden rounded-[18px] sm:size-24"
                      style={{ backgroundColor: popularFlavorColors[index] }}
                    >
                      {image}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-base font-extrabold leading-snug text-[#092a53] sm:text-lg">
                        <Link
                          className="after:absolute after:inset-0 after:rounded-[24px] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-[#bd9c00]"
                          to={itemLink}
                        >
                          {t(item.name)}
                        </Link>
                      </h3>
                      <p className="mt-1 line-clamp-1 text-xs leading-5 text-[#65748a] sm:text-sm sm:leading-6">
                        {t(item.detail)}
                      </p>
                      <p className={`mt-1.5 whitespace-nowrap font-display text-sm font-extrabold tabular-nums transition-colors duration-300 sm:hidden ${added ? "animate-pulse text-green-700" : "text-[#8a7000]"}`}>
                        {soldOut ? t("Sold out") : formatPrice(item.priceXaf)}
                      </p>
                    </div>
                    <div className="hidden shrink-0 text-right sm:block">
                      <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#65748a]">
                        {soldOut ? t("Sold out") : t("Price")}
                      </p>
                      <p className={`mt-0.5 whitespace-nowrap font-display text-lg font-extrabold tabular-nums transition-colors duration-300 ${added ? "animate-pulse text-green-700" : "text-[#092a53]"}`}>
                        {formatPrice(item.priceXaf)}
                      </p>
                    </div>
                    <button
                      aria-label={
                        soldOut
                          ? t("Sold out")
                          : added
                            ? t("Added")
                            : t("Add {name} to your bag", {
                                name: t(item.name),
                              })
                      }
                      className={`relative z-10 grid size-11 shrink-0 place-items-center rounded-full transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#efece3] disabled:text-[#65748a] sm:size-12 ${
                        added
                          ? "bg-[#4caf50] text-white"
                          : "bg-[#ffdc32] text-[#092a53] hover:-translate-y-0.5 hover:bg-[#092a53] hover:text-white"
                      }`}
                      disabled={soldOut}
                      onClick={() => handleAddToCart(item)}
                      title={soldOut ? t("Sold out") : t("Add to bag")}
                      type="button"
                    >
                      {bagIcon || (
                        <svg
                          aria-hidden="true"
                          className="size-4"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M6 6l12 12M18 6 6 18"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeWidth="2"
                          />
                        </svg>
                      )}
                    </button>
                  </article>
                );
              }) : Array.from({ length: 5 }, (_, index) => (
                <div
                  aria-hidden="true"
                  className={`animate-pulse rounded-[24px] bg-[#e4e8ee] ${
                    index === 0
                      ? "min-h-[460px] sm:min-h-[520px] lg:col-span-5 lg:row-span-4"
                      : "min-h-28 lg:col-span-7"
                  }`}
                  key={`favorite-skeleton-${index}`}
                />
              ))}
            </div>

            {menuError && (
              <p className="mt-6 text-xs text-[#65748a]" role="status">
                {t("Menu availability could not be refreshed")}: {menuError}
              </p>
            )}
          </div>
        </section>

{/* Always shown: the reviews, or an invitation to write the first one. */}
        <div aria-hidden="true" className="h-px" ref={reviewsSentinel} />
        <ReviewsSection
          error={reviewsError}
          isLoaded={reviewsLoaded}
          language={language}
          reviews={reviews}
          stats={reviewStats}
          t={t}
        />

        {cartNotice && (
          <div
            aria-live="polite"
            className={`fixed bottom-24 left-1/2 z-50 flex w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 items-center justify-between gap-4 rounded-2xl px-4 py-3 text-sm font-semibold shadow-[0_16px_40px_rgba(9,42,83,0.28)] ring-1 ${
              cartNoticeIsError
                ? "bg-red-50 text-red-800 ring-red-200"
                : "bg-[#092a53] text-white ring-white/15"
            }`}
            role={cartNoticeIsError ? "alert" : "status"}
          >
            <span className="min-w-0">{cartNotice}</span>
            {!cartNoticeIsError && (
              <Link
                className="shrink-0 rounded-full bg-[#ffdc32] px-3 py-2 text-xs font-extrabold text-[#092a53] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                to="/cart"
              >
                {t("View bag")}
              </Link>
            )}
          </div>
        )}

        <section
          aria-labelledby="sunshine-heading"
          className="relative isolate overflow-hidden bg-[linear-gradient(115deg,#ffe9b0_0%,#fbd15c_45%,#f6b23a_100%)] px-5 py-12 sm:px-8 sm:py-14 lg:px-10 lg:py-16"
        >
          {/* Decorative sun rings */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-40 -top-40 size-[36rem] rounded-full border-[24px] border-white/25"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-24 -top-24 size-[24rem] rounded-full border-[16px] border-white/20"
          />
          {/* Scattered mango dots */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-[12%] top-[18%] size-16 rounded-full bg-[#ffb648]/40 blur-[2px]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[14%] right-[38%] size-10 rounded-full bg-[#ff8f3f]/35 blur-[2px]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-start justify-end overflow-hidden"
          >
            <span className="-mt-[6vw] font-display whitespace-nowrap text-[18vw] font-extrabold leading-none tracking-tight text-white/20 select-none sm:-mt-[5vw] sm:text-[16vw]">
              SUNSHINE
            </span>
          </div>
          <div className="relative mx-auto grid max-w-[1320px] items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <div className="relative order-2 lg:order-1">
              <div
                aria-hidden="true"
                className="absolute bottom-0 left-1/2 h-[50%] w-[90%] -translate-x-1/2 rounded-[50%] bg-[#e28c3f]/60 blur-[2px]"
              />
              {/* Rotating circular badge over the image */}
              <div className="absolute -right-2 -top-4 z-10 hidden sm:block">
                <div className="relative grid size-24 place-items-center rounded-full bg-[#092a53] text-center shadow-[0_12px_28px_rgba(9,42,83,0.35)]">
                  <span className="font-display px-3 text-[11px] font-extrabold uppercase leading-tight tracking-[0.14em] text-[#ffd45d]">
                    {t("100% real mango")}
                  </span>
                </div>
              </div>
              <img
                alt={t(
                  "Golden mango ice cream in a glass sundae dish with fresh mango slices",
                )}
                className="relative mx-auto aspect-square w-full max-w-[520px] rounded-3xl object-cover shadow-[0_24px_56px_rgba(9,42,83,0.25)] transition duration-500 hover:scale-[1.02]"
                decoding="async"
                loading="lazy"
                onError={photoErrorHandler("/images/ice.png")}
                sizes="(min-width: 1024px) 520px, (min-width: 640px) 80vw, 100vw"
                src={thumbnail("/images/ice.png")}
                srcSet={photoSrcSet("/images/ice.png")}
              />
            </div>
            <div className="order-1 max-w-xl lg:order-2">
              <p className="inline-flex items-center gap-2 rounded-full bg-white/50 px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#123b68]">
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full bg-[#f6a821]"
                />
                {t("A tropical scoop of vibe")}
              </p>
              <h2
                className="mt-5 font-display text-5xl font-extrabold leading-[1.02] tracking-tight text-[#092a53] sm:text-6xl lg:text-7xl"
                id="sunshine-heading"
              >
                {t("Hello, sunshine.")}
              </h2>
              <p className="mt-6 text-lg leading-8 font-medium text-[#123b68]">
                {t(
                  "Golden mango. A cool, creamy scoop. And a little daydream of somewhere sunny. This is your cue to take a sweet escape.",
                )}
              </p>
              <Link
                className="group mt-9 inline-flex min-h-14 items-center gap-3 rounded-full bg-[#092a53] px-8 py-3.5 text-base font-extrabold text-white shadow-[0_14px_32px_rgba(9,42,83,0.35)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#163e6b] hover:shadow-[0_18px_40px_rgba(9,42,83,0.42)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7c87e]"
                to="/menu?category=Ice%20Cream"
              >
                {t("Find your fruity mood")}
                <span
                  aria-hidden="true"
                  className="grid size-8 place-items-center rounded-full bg-[#ffd45d] text-[#092a53] transition duration-300 group-hover:scale-110"
                >
                  <ArrowIcon />
                </span>
              </Link>
            </div>
          </div>
          {/* Wavy bottom edge matching the next section's curve */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 -bottom-px"
          >
            <svg
              className="block h-16 w-full sm:h-20"
              viewBox="0 0 1440 96"
              preserveAspectRatio="none"
              fill="#e9f4f3"
            >
              <path d="M0 96h1440V66c-120-34-240-52-380-52-150 0-270 30-420 52-140 20-260 8-380-14-100-19-200-32-260-36Z" />
            </svg>
          </div>
        </section>

        <section
          aria-labelledby="moments-heading"
          className="relative isolate overflow-hidden bg-[#f8f6f1] px-5 py-16 sm:px-8 sm:py-20 lg:px-10 lg:py-28"
        >
          {/* Decorative sprinkles */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-32 -top-32 size-[28rem] rounded-full bg-[radial-gradient(closest-side,rgb(255_220_50/0.14),transparent)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-40 -right-24 size-[26rem] rounded-full bg-[radial-gradient(closest-side,rgb(9_42_83/0.10),transparent)]"
          />
          <div className="relative mx-auto grid max-w-[1320px] items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <div className="relative order-2 lg:order-1">
              <div
                aria-hidden="true"
                className="absolute -left-5 -top-5 h-full w-full rounded-[28px] border-[3px] border-[#092a53]/15"
              />
              <img
                alt={t(
                  "A hand scooping vanilla ice cream from a bowl with a strawberry scoop beside it",
                )}
                className="relative aspect-square w-full max-w-[640px] rounded-[28px] object-cover shadow-[0_24px_56px_rgba(9,42,83,0.18)]"
                decoding="async"
                loading="lazy"
                onError={photoErrorHandler("/images/vanilla.jpg")}
                sizes="(min-width: 1024px) 640px, 100vw"
                src={thumbnail("/images/vanilla.jpg")}
                srcSet={photoSrcSet("/images/vanilla.jpg")}
              />
              <div className="absolute -bottom-6 right-8 grid size-32 rotate-3 place-items-center rounded-[22px] bg-[#092a53] px-4 text-center shadow-[0_14px_32px_rgba(9,42,83,0.35)] sm:size-36">
                <span className="font-display text-base font-extrabold uppercase leading-tight text-[#ffd45d] sm:text-lg">
                  {t("Life's sweeter by the scoop")}
                </span>
              </div>
            </div>
            <div className="order-1 max-w-xl lg:order-2">
              <p className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#123b68]">
                <span
                  aria-hidden="true"
                  className="h-px w-10 bg-[#092a53]/60"
                />
                {t("The Cold Stone feeling")}
              </p>
              <h2
                className="mt-4 font-display text-5xl font-extrabold leading-[1.02] tracking-tight text-[#092a53] sm:text-6xl"
                id="moments-heading"
              >
                {t("Small moments. Sweet memories.")}
              </h2>
              <p className="mt-6 text-lg leading-8 font-medium text-[#123b68]">
                {t(
                  "The first lick of a cone. The spoon you don't want to share. The scoop that turns an ordinary afternoon into a little celebration.",
                )}
              </p>
              <p className="mt-4 text-base leading-7 text-[#123b68]/90">
                {t(
                  "Welcome to our world of ice cream — where there's always room for a little more happy.",
                )}
              </p>
              <Link
                className="group mt-9 inline-flex min-h-14 items-center gap-3 rounded-full bg-[#092a53] px-8 py-3.5 text-base font-extrabold text-white shadow-[0_14px_32px_rgba(9,42,83,0.3)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#163e6b] hover:shadow-[0_18px_40px_rgba(9,42,83,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f8f6f1]"
                to="/about"
              >
                {t("Step into our world")}
                <span
                  aria-hidden="true"
                  className="grid size-8 place-items-center rounded-full bg-[#ffd45d] text-[#092a53] transition duration-300 group-hover:scale-110"
                >
                  <ArrowIcon />
                </span>
              </Link>
            </div>
          </div>
        </section>

        
        <section
          aria-labelledby="home-menu-heading"
          className="bg-white px-5 py-14 sm:px-8 sm:py-16 lg:px-10 lg:py-20"
          id="menu"
        >
          <div className="mx-auto max-w-[1320px]">
            <h2
              className="text-center font-display text-3xl font-extrabold leading-none tracking-tight text-[#092a53] sm:text-4xl lg:text-5xl"
              id="home-menu-heading"
            >
              {t("Menu highlights")}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-center text-base leading-7 text-[#52647b]">
              {t("Explore signature creations and discover every flavor.")}
            </p>

            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:gap-8">
              {[
                {
                  title: "The full menu",
                  description: "Every category, from signature creations to sundaes and cakes.",
                  cta: "Browse the full menu",
                  to: "/menu",
                  image: "/menu-official/ice-cream/signature-creations/our-dubai-chocolate-creation.webp",
                  badge: "All categories",
                },
                {
                  title: "All flavors",
                  description: "Fruity, chocolatey or classic — browse the whole flavor collection.",
                  cta: "View flavors",
                  to: "/flavors",
                  image: "/menu-official/ice-cream/signature-creations/our-strawberry-blonde-2.webp",
                  badge: "Every flavor",
                },
              ].map((card, cardIndex) => (
                <Link
                  className="group relative block overflow-hidden rounded-[28px] shadow-[0_20px_50px_rgba(4,21,40,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32] focus-visible:ring-offset-4 focus-visible:ring-offset-[#092a53]"
                  key={card.to}
                  to={card.to}
                >
                  <div className="relative aspect-[16/10] overflow-hidden sm:aspect-[16/9]">
                    <img
                      alt=""
                      className="size-full object-cover transition duration-500 ease-out group-hover:scale-[1.03]"
                      decoding={cardIndex === 0 ? "sync" : "async"}
                      fetchPriority={cardIndex === 0 ? "high" : "auto"}
                      loading={cardIndex === 0 ? "eager" : "lazy"}
                      onError={photoErrorHandler(card.image)}
                      sizes="(min-width: 1024px) 50vw, 100vw"
                      src={card.image}
                      srcSet={photoSrcSet(card.image)}
                    />
                    {/* Readability gradient */}
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-t from-[#041528] via-[#041528]/55 via-45% to-transparent"
                    />
                    {/* Badge */}
                    <span className="absolute left-5 top-5 rounded-full bg-[#ffdc32] px-3.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#092a53] shadow-md">
                      {t(card.badge)}
                    </span>
                    {/* Content */}
                    <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
                      <h3 className="font-display text-2xl font-extrabold leading-tight text-white sm:text-3xl">
                        {t(card.title)}
                      </h3>
                      <p className="mt-2 max-w-md text-sm leading-6 text-white/75 sm:text-base">
                        {t(card.description)}
                      </p>
                      <span className="group/btn mt-5 inline-flex min-h-12 items-center gap-2.5 rounded-full bg-[#ffdc32] px-6 py-3 text-sm font-extrabold text-[#092a53] shadow-[0_10px_24px_rgba(255,220,50,0.3)] transition duration-300 group-hover:-translate-y-0.5 group-hover:bg-white group-hover:shadow-[0_14px_30px_rgba(255,220,50,0.4)]">
                        {t(card.cta)}
                        <span aria-hidden="true" className="grid size-6 place-items-center rounded-full bg-[#092a53] text-[#ffdc32] transition-transform duration-300 group-hover/btn:translate-x-0.5">
                          <ArrowIcon />
                        </span>
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Payment reassurance for first-time buyers */}
            <p className="mt-8 flex flex-wrap items-center justify-center gap-2 text-sm font-semibold text-[#52647b]">
              <span aria-hidden="true" className="text-lg">💳</span>
              {t("Cards & Mobile Money accepted")}
              <span aria-hidden="true" className="mx-1 h-1 w-1 rounded-full bg-[#c9d2dc]" />
              {t("Pay in FCFA with")}
              <span className="rounded-full bg-[#f4f1e7] px-3 py-1 text-xs font-extrabold text-[#092a53]">Visa</span>
              <span className="rounded-full bg-[#f4f1e7] px-3 py-1 text-xs font-extrabold text-[#092a53]">Mastercard</span>
              <span className="rounded-full bg-[#f4f1e7] px-3 py-1 text-xs font-extrabold text-[#092a53]">MTN MoMo</span>
              <span className="rounded-full bg-[#f4f1e7] px-3 py-1 text-xs font-extrabold text-[#092a53]">Orange Money</span>
            </p>
          </div>
        </section>

        {/* Sticky section sub-nav — appears after the hero, highlights the section in view.
            It sits at the bottom of the screen: at the top it covered headings and product
            names as the visitor scrolled past them. */}
        <nav
          aria-label={t("Page sections")}
          className={`fixed bottom-6 left-1/2 z-40 hidden -translate-x-1/2 transition duration-300 lg:block ${
            pillVisible
              ? "pointer-events-auto translate-y-0 opacity-100"
              : "pointer-events-none translate-y-3 opacity-0"
          }`}
        >
          <div className="flex items-center gap-1 rounded-full bg-[#092a53]/90 p-1.5 shadow-[0_12px_32px_rgba(9,42,83,0.35)] ring-1 ring-white/15 backdrop-blur-md">
            {homeSections.map(({ id, label }) => (
              <a
                aria-current={activeSection === id ? "true" : undefined}
                className={`rounded-full px-3 py-1.5 text-xs font-extrabold transition sm:px-4 sm:text-[13px] ${
                  activeSection === id
                    ? "bg-[#ffdc32] text-[#092a53]"
                    : "text-white/85 hover:bg-white/10 hover:text-white"
                }`}
                href={`#${id}`}
                key={id}
                onClick={(event) => {
                  event.preventDefault();
                  document
                    .getElementById(id)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                {t(label)}
              </a>
            ))}
          </div>
        </nav>

        {/* Back to top — appears after scrolling past the hero */}
        <button
          aria-label={t("Back to top")}
          className={`fixed bottom-24 right-6 z-40 grid size-12 place-items-center rounded-full bg-[#092a53] text-white shadow-[0_10px_24px_rgba(9,42,83,0.35)] transition duration-300 hover:bg-[#14467c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32] focus-visible:ring-offset-2 lg:bottom-6 ${
            showScrollTop
              ? "pointer-events-auto translate-y-0 opacity-100"
              : "pointer-events-none translate-y-4 opacity-0"
          }`}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          type="button"
        >
          <svg fill="none" viewBox="0 0 24 24" className="size-5">
            <path
              d="M12 19V5m0 0-6 6m6-6 6 6"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
        </button>

        {/* Sticky mobile order bar — the main action stays one tap away after the hero. */}
        <div
          className={`fixed inset-x-3 bottom-3 z-40 transition duration-300 lg:hidden ${
            showScrollTop
              ? "pointer-events-auto translate-y-0 opacity-100"
              : "pointer-events-none translate-y-6 opacity-0"
          }`}
        >
          <Link
            className="flex items-center justify-between gap-3 rounded-2xl bg-[#092a53]/95 py-3 pl-4 pr-3 text-white shadow-[0_16px_40px_rgba(9,42,83,0.45)] ring-1 ring-white/15 backdrop-blur-md"
            to="/menu"
          >
            <span className="min-w-0">
              <span className="block truncate font-display text-sm font-extrabold">
                {t("Order now")}
              </span>
              <span className="block truncate text-[11px] font-semibold text-[#ffdc32]">
                {t("Cards & Mobile Money accepted")}
              </span>
            </span>
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#ffdc32] text-[#092a53]">
              <ArrowIcon />
            </span>
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
