import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Footer, Header, ArrowIcon } from "../../components/Layout";
import { HeroBackground } from "../../components/HeroBackground";
import { useCart } from "../../context/useCart";
import { useFlavors } from "../../context/useFlavors";
import { apiRequest } from "../../api/api";
import { coldStoneMenuCategories, getMenuItemId } from "../../../shared/data";
import { ProductImageSlider } from "../../components/ProductImageSlider";
import { RatingBadge } from "../../components/RatingBadge";
import { useLanguage } from "../../language/useLanguage";
import {
  photoErrorHandler,
  photoSrcSet,
  thumbnail,
} from "../../lib/thumbnails";
import {
  HOME_SLIDE_SIZES,
  normalizePhotoGallery,
} from "../../../shared/photoSizes.js";
import { numberFormatter } from "../../lib/cartPricing";

const popularFlavorNames = [
  "Chocolate Devotion",
  "Cheesecake Fantasy",
  "Founder’s Favorite",
  "Birthday Cake Remix",
];
const popularFlavorColors = [
  "#e9f6dd",
  "#fff0df",
  "#fff5d2",
  "#fff5c8",
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
    title: "A little joy",
    accent: "in each scoop.",
    description: "Signature creations, the full menu, and stores across Cameroon.",
    image: "/ice-images/ice-9.jpg",
    alt: "Colorful ice cream creations ready to enjoy",
    caption: "The signature experience",
  },
  {
    title: "Ice cream cakes",
    accent: "for celebrations.",
    description: "Creamy ice cream cakes for birthdays, parties, and every celebration.",
    image: "/cake-images/cake-11.webp",
    alt: "A chocolate ice cream cake held up for a celebration",
    caption: "Made for celebrations",
  },
  {
    title: "Cool, creamy mint",
    accent: "with cookie crunch.",
    description: "Mint ice cream with cookies and fudge, mixed fresh on a frozen stone.",
    image: "/menu-official/ice-cream/signature-creations/cookie-mintster.webp",
    alt: "Mint ice cream with chocolate cookies and fudge in a waffle cone",
    caption: "Mixed on a frozen stone",
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
    (flavor.images
      ? normalizePhotoGallery(flavor.images)
      : item?.image
        ? [item.image, ...normalizePhotoGallery(item.gallery)]
        : [flavor.image])
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
      decoding="async"
      alt=""
      className={`shrink-0 rounded-full object-cover ${className}`}
      fetchPriority={eager ? "high" : "auto"}
      loading={eager ? "eager" : "lazy"}
      src={picture}
    />
  ) : (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full bg-[#f4f6f8] font-display font-extrabold text-[#472a3b] ${className}`}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function ReviewCard({ review, language, t, eager = false }) {
  const customerName = review.customerName || t("Customer");
  const rawText = (review.review || "").trim();
  const text = rawText
    ? rawText.charAt(0).toUpperCase() + rawText.slice(1)
    : "";
  return (
    <li>
      <article className="flex h-full w-[min(88vw,22rem)] shrink-0 flex-col rounded-[20px] border border-[#dce3eb] bg-white p-5 sm:p-6">
        <StarRating
          className="size-4"
          emptyClassName="text-[#dce3eb]"
          filledClassName="text-[#b8721e]"
          label={t("{rating} out of 5 stars", { rating: review.rating })}
          value={Number(review.rating) || 0}
        />
        {text ? (
          <blockquote className="mt-3 max-w-[48ch] flex-1 text-base leading-7 text-[#472a3b]">
            {text}
          </blockquote>
        ) : (
          <p className="mt-3 flex-1 text-sm leading-7 text-[#65748a]">
            {t("No written comment.")}
          </p>
        )}
        <footer className="mt-5 flex items-center gap-3 border-t border-[#f4f6f8] pt-4">
          <ReviewerAvatar
            className="size-9 bg-white text-sm"
            eager={eager}
            name={customerName}
            picture={review.profilePicture}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[#472a3b]">
              {customerName}
            </p>
            <p className="mt-0.5 truncate text-xs font-medium text-[#65748a]">
              {review.itemName ? t(review.itemName) : t("Verified purchase")}
            </p>
            {review.createdAt && (
              <time
                className="mt-0.5 block text-xs font-medium text-[#65748a]"
                dateTime={review.createdAt}
              >
                {formatReviewDate(review.createdAt, language)}
              </time>
            )}
          </div>
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
      className={`animate-pulse w-[min(88vw,22rem)] shrink-0 rounded-[20px] border border-[#dce3eb] bg-white p-5 sm:p-6 ${className}`}
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
        className="bg-[#f4f6f8] px-5 py-16 sm:px-8 sm:py-20 lg:px-10 lg:py-24"
      >
        <div className="mx-auto max-w-[1320px]">
          <div className="h-10 w-56 animate-pulse rounded-lg bg-[#e1e7ed] sm:h-12" />
          <div className="mt-4 h-4 w-80 max-w-full animate-pulse rounded-md bg-[#e1e7ed]" />
          <div className="review-marquee mt-10">
            <div className="review-marquee-track">
              <div className="flex items-stretch gap-5 pr-5">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </div>
            </div>
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
  return (
    <section
      aria-labelledby="real-reviews-heading"
      className="scroll-mt-20 bg-[#f4f6f8] px-5 py-16 sm:px-8 sm:py-20 lg:px-10 lg:py-24"
      id="reviews"
    >
      <div className="mx-auto max-w-[1320px]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h2
              className="font-display text-4xl font-extrabold leading-[1.02] tracking-tight text-[#472a3b] sm:text-5xl"
              id="real-reviews-heading"
            >
              {t("Real Reviews")}
            </h2>
            <p className="mt-3 max-w-xl text-base leading-7 text-[#65748a]">
              {t(
                "Honest feedback from customers who ordered and tasted it themselves.",
              )}
            </p>
            {hasReviews && (
              <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-display text-2xl font-extrabold leading-none text-[#472a3b]">
                  {roundedAverage.toFixed(1)}
                </span>
                <StarRating
                  className="size-4"
                  emptyClassName="text-[#dce3eb]"
                  filledClassName="text-[#b8721e]"
                  label={t("{rating} out of 5 stars", {
                    rating: roundedAverage.toFixed(1),
                  })}
                  value={average}
                />
                <span className="text-sm font-semibold text-[#65748a]">
                  {t(
                    count === 1 ? "Based on 1 review" : "Based on {count} reviews",
                    { count },
                  )}
                </span>
              </p>
            )}
          </div>
        </div>

        {error ? (
          <p className="mt-8 max-w-xl text-base leading-7 text-[#65748a]" role="status">
            {t("Customer reviews could not be loaded")}: {error}
          </p>
        ) : !hasReviews ? (
          <div className="mt-8 max-w-xl">
            <p className="font-display text-2xl font-extrabold leading-tight text-[#472a3b]">
              {t("No reviews yet — be the first!")}
            </p>
            <p className="mt-2 text-base leading-7 text-[#65748a]">
              {t("Ordered from us before? Share how it tasted and help the next customer choose.")}
            </p>
          </div>
        ) : (
          <div className="review-marquee mt-10">
            {/* The track is rendered twice so the loop is seamless; the second copy is hidden from assistive tech. */}
            <div className="review-marquee-track items-stretch gap-5 pr-5">
              {[0, 1].map((copy) => (
                <ul
                  aria-hidden={copy === 1 ? "true" : undefined}
                  className="flex items-stretch gap-5 pr-5"
                  key={copy}
                >
                  {displayReviews.map((review, index) => (
                    <ReviewCard
                      eager={copy === 0 && index === 0}
                      key={`${review.createdAt}-${review.itemId || review.itemName}-${index}`}
                      language={language}
                      review={review}
                      t={t}
                    />
                  ))}
                </ul>
              ))}
            </div>
          </div>
        )}

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            className="inline-flex min-h-12 items-center rounded-lg bg-[#472a3b] px-6 text-sm font-bold text-white transition hover:bg-[#6b3f58] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffb84d] focus-visible:ring-offset-2"
            to="/account/orders"
          >
            {t("Write a review")}
          </Link>
          <Link
            className="inline-flex min-h-12 items-center rounded-lg px-4 text-sm font-bold text-[#472a3b] underline decoration-[#ffb84d] decoration-2 underline-offset-4"
            to="/menu"
          >
            {t("Explore the menu")}
          </Link>
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection({ t }) {
  const steps = [
    {
      step: "1",
      title: "Choose your treats",
      description: "Browse the menu and add favorites to your bag.",
    },
    {
      step: "2",
      title: "Order online",
      description: "Checkout with cards or Mobile Money in a few taps.",
    },
    {
      step: "3",
      title: "Pick up or get it delivered",
      description: "Ready in about 30 minutes at your chosen store.",
    },
  ];

  return (
    <section
      aria-labelledby="how-it-works-heading"
      className="scroll-mt-20 px-5 py-12 text-[#472a3b] sm:px-8 sm:py-16 lg:px-10"
      id="how-it-works"
    >
      <div className="mx-auto max-w-[1320px]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h2
              className="max-w-[16ch] font-display text-4xl font-extrabold leading-[1.02] tracking-tight text-[#472a3b] sm:text-5xl"
              id="how-it-works-heading"
            >
              {t("How it works")}
            </h2>
            <p className="mt-3 max-w-xl text-base leading-7 text-[#65748a]">
              {t("Choose your flavor, pay online, then collect your order or have it delivered.")}
            </p>
          </div>
          <Link
            className="inline-flex min-h-11 w-fit items-center gap-2 rounded-lg bg-[#472a3b] px-5 text-sm font-bold text-white transition hover:bg-[#6b3f58] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffb84d] focus-visible:ring-offset-2"
            to="/menu"
          >
            {t("Start an order")}
            <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
              <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
            </svg>
          </Link>
        </div>
        <ol className="mt-8 grid gap-4 sm:mt-12 sm:grid-cols-3 sm:gap-5">
          {steps.map(({ step, title, description }) => (
            <li
              className="relative flex gap-4 rounded-2xl border border-[#dce3eb] bg-white p-5 sm:flex-col sm:gap-5 sm:p-6"
              key={step}
            >
              <div className="flex min-w-0 items-start gap-4">
                <span
                  aria-hidden="true"
                  className="grid size-11 shrink-0 place-items-center rounded-full bg-[#ffb84d] text-lg font-extrabold leading-none text-[#472a3b]"
                >
                  {step}
                </span>
                <span className="block font-display text-lg font-bold leading-tight text-[#472a3b] sm:hidden">
                  {t(title)}
                </span>
              </div>
              <div className="min-w-0 sm:mt-0">
                <span className="hidden font-display text-lg font-bold leading-tight text-[#472a3b] sm:block">
                  {t(title)}
                </span>
                <span className="mt-1.5 block max-w-sm text-sm leading-6 text-[#65748a]">
                  {t(description)}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function MomentGallery({ t }) {
  const frames = [
    {
      id: "sunshine-heading",
      title: "Tropical mango sunshine.",
      src: "/images/mango.jpg",
      alt: "Mango ice cream scoops with a spoon",
      position: "object-[center_38%]",
      copy: [
        "Golden mango. A cool, creamy scoop. And a little daydream of somewhere sunny. This is your cue to take a sweet escape.",
      ],
      cta: "Find your fruity mood",
      to: "/menu?category=Ice%20Cream",
    },
    {
      id: "moments-heading",
      title: "Sweet moments at Cold Stone.",
      src: "/images/vanilla.jpg",
      alt: "A hand scooping vanilla ice cream from a bowl with a strawberry scoop beside it",
      position: "object-[center_28%]",
      copy: [
        "The first lick of a cone. The spoon you don't want to share. The scoop that turns an ordinary afternoon into a little celebration.",
        "Welcome to our world of ice cream — where there's always room for a little more happy.",
        "Life's sweeter by the scoop",
      ],
      cta: "Step into our world",
      to: "/about",
    },
  ];

  return (
    <section
      aria-labelledby="moments-gallery-heading"
      className="px-5 py-16 sm:px-8 sm:py-20 lg:px-10 lg:py-24"
    >
      <div className="mx-auto max-w-[1320px]">
        <h2 className="sr-only" id="moments-gallery-heading">
          {t("Sweet moments at Cold Stone.")}
        </h2>
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-5">
          {frames.map((frame) => (
            <Link
              className="moment-card group relative block overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#472a3b] lg:overflow-hidden"
              key={frame.id}
              to={frame.to}
            >
              <div className="relative h-[min(16rem,52svh)] overflow-hidden sm:h-[min(20rem,46svh)] lg:h-[min(30rem,calc(100svh-14rem))]">
                <img
                  alt={t(frame.alt)}
                  className={`size-full object-cover transition duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04] motion-reduce:transform-none motion-reduce:transition-none ${frame.position}`}
                  decoding="async"
                  loading="lazy"
                  onError={photoErrorHandler(frame.src)}
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  src={thumbnail(frame.src)}
                  srcSet={photoSrcSet(frame.src)}
                />
              </div>
              <div className="moment-copy mt-5 lg:absolute lg:inset-0 lg:z-10 lg:mt-0 lg:flex lg:flex-col lg:justify-end lg:bg-[#472a3b]/88 lg:p-8 xl:p-10">
                <h3
                  className="max-w-[18ch] font-display text-3xl font-extrabold leading-[0.95] tracking-[-0.03em] text-[#472a3b] lg:max-w-[14ch] lg:text-4xl lg:text-white"
                  id={frame.id}
                >
                  {t(frame.title)}
                </h3>
                {frame.copy.map((paragraph) => (
                  <p
                    className="mt-3 max-w-[42ch] text-sm font-medium leading-6 text-[#472a3b] lg:text-base lg:leading-7 lg:text-white"
                    key={paragraph}
                  >
                    {t(paragraph)}
                  </p>
                ))}
                <span className="mt-6 inline-flex min-h-12 w-fit items-center gap-3 bg-[#ffb84d] px-5 text-sm font-extrabold text-[#472a3b]">
                  {t(frame.cta)}
                  <span
                    aria-hidden="true"
                    className="transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-1 motion-reduce:transform-none"
                  >
                    <ArrowIcon />
                  </span>
                </span>
              </div>
            </Link>
          ))}
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
  const [showAllCakeResults, setShowAllCakeResults] = useState(false);
  const [loadedSlides, setLoadedSlides] = useState([0]);
  const [addedItemKey, setAddedItemKey] = useState(null);
  const [cartNoticeIsError, setCartNoticeIsError] = useState(false);
  // A gentle "back to top" helper for the long home page, shown after the first screen.
  const [showScrollTop, setShowScrollTop] = useState(false);
  const addedTimer = useRef(undefined);
  const cartNoticeTimer = useRef(undefined);
  const heroHoldTimer = useRef(undefined);
  const [heroPaused, setHeroPaused] = useState(false);
  const reviewsSentinel = useRef(null);
  const popularSection = useRef(null);

  // The photo on screen, plus the next one, so the crossfade has a picture ready.
  useEffect(() => {
    setLoadedSlides((current) => {
      const next = current.includes(activeSlide) ? current : [...current, activeSlide];
      const upcoming = (activeSlide + 1) % homeSlides.length;
      return next.includes(upcoming) ? next : [...next, upcoming];
    });
  }, [activeSlide]);

  // The hero photo moves on its own. Hover, focus, or the arrow keys hold it still.
  useEffect(() => {
    if (heroPaused) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const timer = window.setTimeout(
      () => setActiveSlide((current) => (current + 1) % homeSlides.length),
      6500,
    );
    return () => window.clearTimeout(timer);
  }, [activeSlide, heroPaused]);

  useEffect(() => () => window.clearTimeout(heroHoldTimer.current), []);

  const holdHero = () => {
    setHeroPaused(true);
    window.clearTimeout(heroHoldTimer.current);
  };

  const releaseHeroSoon = () => {
    window.clearTimeout(heroHoldTimer.current);
    heroHoldTimer.current = window.setTimeout(() => setHeroPaused(false), 4000);
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
  // Show the back-to-top control once the hero has left the screen.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setShowScrollTop(window.scrollY > window.innerHeight * 0.9);
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
  const visibleFlavors = flavorFiltersActive ? matchingFlavors : flavorInspiration.slice(0, 4);

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
    return hasActiveFilter || showAllCakeResults ? items : items.slice(0, 4);
  }, [cakeMenuCategory, selectedCakeType, cakeQuery, showAllCakeResults]);
  // Every cake card needs a slider (more than one photo), but many catalog items
  // only carry a single image and no gallery. For those, pair the item's own photo
  // with attractive cake photos from the same family (petite/sibling views of the
  // same design), so no card on the home page ever shows a lone static image.
  const relatedCakePhotos = useMemo(() => {
    const byDesign = new Map();
    for (const item of cakeMenuCategory.items || []) {
      const type = cakeTypeOf(item.id || item.name, item.name);
      const photos = [item.image, ...normalizePhotoGallery(item.gallery)].filter(Boolean);
      for (const photo of photos) {
        if (!byDesign.has(type)) byDesign.set(type, []);
        const bucket = byDesign.get(type);
        if (!bucket.includes(photo)) bucket.push(photo);
      }
    }
    return byDesign;
  }, [cakeMenuCategory]);
  const cakeImagesOf = (cake) => {
    const own = [...new Set([cake.image, ...normalizePhotoGallery(cake.gallery)].filter(Boolean))];
    if (own.length > 1) return own;
    const type = cakeTypeOf(cake.idName, cake.name);
    const related = (relatedCakePhotos.get(type) || []).filter(
      (photo) => !own.includes(photo),
    );
    const fallbacks = (cakeSliderFallbacks[type] || []).filter((photo) => !own.includes(photo));
    return [...new Set([...own, ...related, ...fallbacks])].slice(0, 4);
  };
  return (
    <div className="min-h-screen overflow-clip bg-[#fbfaf5] text-[#472a3b]">
      <Header />
      <main id="main" tabIndex={-1}>
        <section
          id="home"
          className="relative isolate w-full overflow-clip bg-[var(--brand-navy)] text-white"
        >
          <HeroBackground quietOnMobile variant="navy" />

          <div className="mx-auto w-full max-w-[1400px] px-5 pb-2 pt-3 sm:px-8 sm:pb-6 sm:pt-6 lg:px-12 lg:pb-8 lg:pt-8">
            <div className="grid items-center gap-4 lg:grid-cols-12 lg:gap-10">
              {/* Copy */}
              <div className="relative z-10 lg:col-span-6">
                <div className="home-hero-copy" key={activeSlide}>
                  <h1 className="max-w-none font-display text-[clamp(2.2rem,3.4vw,3.25rem)] font-extrabold leading-[1.04] tracking-[-0.04em] text-white">
                    {t(homeSlides[activeSlide].title)}
                    <span className="block text-white">
                      {t(homeSlides[activeSlide].accent)}
                    </span>
                  </h1>
                  <p className="mt-3 max-w-lg text-base leading-6 text-white/75 sm:mt-4 sm:text-lg sm:leading-7">
                    {t(homeSlides[activeSlide].description)}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 sm:mt-5">
                  <Link
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#ffb84d] px-4 py-3 text-xs font-extrabold text-[#472a3b] transition-colors hover:bg-[#ffcf85] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffb84d] focus-visible:ring-offset-2 focus-visible:ring-offset-[#472a3b] sm:min-h-12 sm:px-6 sm:text-sm"
                    to="/menu?category=Ice%20Cream"
                  >
                    {t("Order ice cream")} <ArrowIcon />
                  </Link>
                  <Link
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/30 px-4 py-3 text-xs font-bold text-white transition-colors hover:border-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#472a3b] sm:min-h-12 sm:px-5 sm:text-sm"
                    to="/flavors"
                  >
                    {t("Explore flavors")}{" "}
                    <ArrowIcon diagonal />
                  </Link>
                </div>

                <ul className="mt-5 hidden flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-white/80 sm:flex">
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
                        className="grid size-5 place-items-center bg-white/10 text-[#ffb84d]"
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
                    holdHero();
                    setActiveSlide(
                      (current) =>
                        (current + homeSlides.length - 1) % homeSlides.length,
                    );
                  } else if (event.key === "ArrowRight") {
                    event.preventDefault();
                    holdHero();
                    setActiveSlide(
                      (current) => (current + 1) % homeSlides.length,
                    );
                  }
                }}
                onMouseEnter={holdHero}
                onMouseLeave={releaseHeroSoon}
                role="region"
              >
                <div
                  aria-label={t(homeSlides[activeSlide].caption)}
                  aria-roledescription={t("slide")}
                  className="relative"
                  role="group"
                >
                  <div className="relative aspect-[2/1] overflow-hidden rounded-[20px] bg-[#6b3f58] ring-1 ring-white/15 sm:rounded-[24px] lg:aspect-[16/9]">
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
                  </div>

                  <div className="flex items-center justify-between gap-4 pt-3 text-white">
                    <p className="min-w-0 font-display text-lg font-bold leading-tight sm:text-xl">
                      {t(homeSlides[activeSlide].caption)}
                    </p>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        aria-label={t("Previous slide")}
                        className="grid size-11 place-items-center rounded-full border border-white/30 text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffb84d]"
                        onClick={() => {
                          setActiveSlide(
                            (current) =>
                              (current + homeSlides.length - 1) %
                              homeSlides.length,
                          );
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
                        className="grid size-11 place-items-center rounded-full bg-[#ffb84d] text-[#472a3b] transition-colors hover:bg-[#ffcf85] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        onClick={() => {
                          setActiveSlide(
                            (current) => (current + 1) % homeSlides.length,
                          );
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
                  className="mt-2 flex justify-center sm:hidden"
                  role="group"
                >
                  {homeSlides.map((slide, index) => (
                    <button
                      aria-current={activeSlide === index ? "true" : undefined}
                      aria-label={t("Show slide {number}", {
                        number: index + 1,
                      })}
                      className="grid h-11 min-w-11 place-items-center rounded-full px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffb84d]"
                      key={slide.image}
                      onClick={() => {
                        setActiveSlide(index);
                      }}
                      type="button"
                    >
                      <span
                        aria-hidden="true"
                        className={`h-2 rounded-full transition-all ${activeSlide === index ? "w-8 bg-[#ffb84d]" : "w-2 bg-white/35"}`}
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
              className="hero-blob-b pointer-events-none absolute -bottom-32 -right-24 -z-10 size-[20rem] rounded-full bg-[radial-gradient(closest-side,rgb(18_59_104/0.45),rgb(18_59_104/0.45)_35%,transparent)]"
            />
            <div className="mx-auto max-w-[1320px] px-5 pb-5 pt-4 sm:px-8 sm:pb-8 lg:px-12">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-xl font-extrabold text-white sm:text-2xl">
                  {t("Why people love us")}
                </h2>
                <Link
                  className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-white/70 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffb84d] lg:min-h-0"
                  to="/locations"
                >
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full bg-[#ffb84d]"
                  />
                  {t("Pickup or delivery in Douala and Yaoundé.")}
                </Link>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2.5 sm:mt-4 sm:gap-3 lg:grid-cols-4">
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
                    className="flex h-full min-w-0 flex-col items-start gap-2 rounded-2xl bg-white/[0.05] px-3 py-3 ring-1 ring-white/10 sm:flex-row sm:items-center sm:gap-3 sm:rounded-3xl sm:px-5 sm:py-4"
                    key={stat.label}
                    title={stat.title}
                  >
                    {/* Not a native tooltip: also on the label, so the redemption rule is
                        readable on touch screens and by keyboard users. */}
                    {stat.title && <span className="sr-only">{stat.title}</span>}
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#ffb84d]/15 text-[#ffb84d] ring-1 ring-[#ffb84d]/25 sm:size-10">
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
                      <span className="font-display text-[15px] font-extrabold leading-tight text-white sm:text-xl">
                        {stat.value}
                      </span>
                      <span className="text-xs font-semibold leading-4 text-balance text-white/70">
                        {stat.label}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="flavor-inspiration-heading"
          className="scroll-mt-20 bg-[#f4f6f8] px-5 py-16 text-[#472a3b] sm:px-8 sm:py-20 lg:px-10 lg:py-24"
          id="flavors"
        >
          <div className="mx-auto max-w-[1320px]">
            <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <h2
                  className="max-w-[650px] font-display text-4xl font-extrabold leading-[1.02] tracking-tight text-[#472a3b] sm:text-5xl lg:text-6xl"
                  id="flavor-inspiration-heading"
                >
                  {t("Find your flavor")}
                </h2>
                <p className="mt-3 max-w-[520px] text-base leading-7 font-medium text-[#6b3f58]">
                  {t(
                    "Fruity, chocolatey or beautifully classic. Let your cravings lead the way.",
                  )}
                </p>
              </div>
              <div className="max-w-[360px] lg:mb-2">
                <Link
                  className="group mt-6 inline-flex min-h-12 items-center gap-3 rounded-lg bg-[#472a3b] px-6 py-3 text-sm font-bold text-white transition-colors duration-300 hover:bg-[#6b3f58] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8721e] focus-visible:ring-offset-2"
                  to="/flavors"
                >
                  {t("Explore all flavors")}
                  <svg
                    aria-hidden="true"
                    className="size-4 transition-transform duration-300 group-hover:translate-x-0.5"
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

            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
                      className={`min-h-11 rounded-lg border px-4 py-2.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#472a3b] focus-visible:ring-offset-2 ${
                        selected
                          ? "border-[#472a3b] bg-[#472a3b] text-white"
                          : "border-[#dce3eb] bg-white text-[#6b3f58] hover:border-[#472a3b] hover:bg-[#f4f6f8]"
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
                  className="min-h-11 w-full rounded-lg border border-[#dce3eb] bg-white py-2.5 pl-12 pr-10 text-sm font-semibold text-[#472a3b] outline-none transition placeholder:text-[#65748a] focus:border-[#472a3b] focus:ring-2 focus:ring-[#472a3b]/15"
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
                    className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-[#65748a] transition before:absolute before:-inset-2 before:content-[''] hover:bg-[#f4f6f8] hover:text-[#472a3b]"
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
              <p aria-live="polite" className="mt-5 text-sm font-semibold text-[#65748a]">
                {t("Showing {shown} of {total} flavors", {
                  shown: matchingFlavors.length,
                  total: allFlavorCards.length,
                })}
              </p>
            )}
            {visibleFlavors.length === 0 ? (
              <p
                className="mt-8 rounded-xl bg-white px-5 py-8 text-center text-base leading-7 text-[#65748a]"
                role="status"
              >
                {t("No flavors match your filters.")}
              </p>
            ) : null}
            <ul
              id="home-flavor-results"
              className={visibleFlavors.length === 0 ? "hidden" : "mt-8 grid auto-rows-fr grid-cols-2 gap-3.5 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4 lg:gap-6"}
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
                    className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-xl bg-white ring-1 ring-transparent transition duration-500 ease-out hover:-translate-y-2 hover:rotate-[0.4deg] hover:shadow-[0_24px_48px_rgba(9,42,83,0.18)] hover:ring-[#ffb84d]/70 motion-reduce:transform-none motion-reduce:transition-none"
                    key={flavor.id}
                  >
                    {/* Shine sweep on hover */}
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 z-20 -translate-x-[130%] skew-x-[-18deg] bg-[linear-gradient(100deg,transparent_30%,rgba(255,255,255,0.55)_50%,transparent_70%)] transition-transform duration-700 ease-out group-hover:translate-x-[130%] motion-reduce:hidden"
                    />
                    <div className="relative bg-[#f4f6f8]">
                      <ProductImageSlider
                        frameClassName="rounded-none bg-[#f4f6f8] shadow-none"
                        imageClassName="aspect-square transition-transform duration-700 ease-out group-hover:scale-[1.06] motion-reduce:transform-none sm:aspect-[4/3]"
                        images={images}
                        name={t(flavor.title)}
                        resetKey={flavor.id}
                        sizes="(min-width: 1024px) 24vw, (min-width: 640px) 46vw, 100vw"
                        showScrim={false}
                        showThumbnails={false}
                      />
                      <span
                        className="absolute left-3 top-3 rounded-md bg-white px-2.5 py-1 text-[13px] font-bold text-[#472a3b] transition-transform duration-500 ease-out group-hover:-rotate-3 group-hover:scale-105 motion-reduce:transform-none sm:left-4 sm:top-4 sm:px-3 sm:py-1.5 sm:text-sm"
                      >
                        {t(
                          flavor.mood === "fruit"
                            ? "Fruity"
                            : flavor.mood === "chocolate"
                              ? "Chocolatey"
                              : "Classic",
                        )}
                      </span>
                      <span className="absolute bottom-4 right-4">
                        <RatingBadge
                          averageRating={item?.averageRating}
                          reviewCount={item?.reviewCount}
                        />
                      </span>
                      {soldOut && (
                        <span className="absolute right-4 top-4 rounded-md bg-[#472a3b] px-3 py-1.5 text-xs font-bold text-white">
                          {t("Sold out today")}
                        </span>
                      )}
                    </div>
                    <div
                      className="flex flex-1 flex-col justify-between gap-3 p-3.5 sm:gap-4 sm:p-5"
                    >
                      <div>
                        <Link
                          className="line-clamp-2 min-h-[2.5em] font-display text-base font-extrabold leading-tight text-[#472a3b] transition-colors duration-300 hover:text-[#6b3f58] focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#472a3b] sm:text-xl"
                          to={catalogFlavor
                            ? `/flavor/${catalogFlavor.id}`
                            : `/menu?${new URLSearchParams({ category: flavor.category, item: flavor.item })}`}
                        >
                          {t(flavor.title)}
                        </Link>
                        <p className="mt-1.5 line-clamp-2 min-h-10 text-[13px] font-medium leading-5 text-[#65748a] sm:text-sm">
                          {t(flavor.detail || "")}
                        </p>
                      </div>
                      <div className="flex flex-col items-stretch gap-2.5 sm:gap-3">
                        <span
                          className={`whitespace-nowrap font-display text-sm font-extrabold tabular-nums transition-colors duration-300 sm:text-base ${
                            added ? "animate-pulse text-green-700" : "text-[#472a3b]"
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
                            : t("Add {name} to cart", { name: t(flavor.item) })}
                          className={`min-h-10 w-full whitespace-nowrap rounded-lg px-2 text-[13px] font-bold transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#472a3b] focus-visible:ring-offset-2 motion-reduce:transform-none disabled:cursor-not-allowed disabled:bg-[#e3e8ed] disabled:text-[#65748a] sm:min-h-11 sm:px-4 sm:text-sm ${
                            added
                              ? "bg-[#4caf50] text-white"
                              : "bg-[#472a3b] text-white hover:bg-[#6b3f58]"
                          }`}
                          disabled={soldOut || !item}
                          onClick={() => catalogFlavor
                            ? handleCatalogFlavorAdd(catalogFlavor)
                            : item && handleAddToCart(item, flavor.category)}
                          type="button"
                        >
                          {soldOut ? t("Sold out") : added ? t("Added") : t("Add to cart")}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            {selectedFlavorMood === "all" && !flavorSearch.trim() && allFlavorCards.length > 4 && (
              <div className="mt-6 flex flex-col items-center gap-3">
                <p className="text-center text-sm leading-5 text-[#65748a]">
                  {t("Search or choose a craving to see more flavors.")}
                </p>
                <button
                  aria-controls="home-flavor-results"
                  aria-expanded={showAllFlavorResults}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#472a3b] bg-white px-5 py-2.5 text-sm font-bold text-[#472a3b] transition-colors hover:bg-[#472a3b] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#472a3b] focus-visible:ring-offset-2"
                  onClick={() => setShowAllFlavorResults((current) => !current)}
                  type="button"
                >
                  {t(showAllFlavorResults ? "Show fewer flavors" : "Show all {count} flavors", {
                    count: allFlavorCards.length,
                  })}
                </button>
              </div>
            )}

          </div>
        </section>

        <HowItWorksSection t={t} />

        {/* Cake cards — same card design/animations/search as "Follow your flavor", with a
            "Request a custom cake" button that leads to the cake builder page. */}
        <section
          aria-labelledby="cakes-heading"
          className="relative scroll-mt-20 overflow-hidden bg-[#f4f6f8] px-5 py-16 text-[#472a3b] sm:px-8 sm:py-20 lg:px-10 lg:py-24"
          id="cakes"
        >
          <div className="relative mx-auto max-w-[1320px]">
            <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <h2
                  className="max-w-[650px] font-display text-4xl font-extrabold leading-[1.02] tracking-tight text-[#472a3b] sm:text-5xl lg:text-6xl"
                  id="cakes-heading"
                >
                  {t("Cakes for every occasion")}
                </h2>
                <p className="mt-3 max-w-xl text-sm font-medium leading-6 text-[#65748a] sm:text-base">
                  {t("Creamy ice cream cakes for birthdays, parties, and every celebration.")}
                </p>
              </div>
              <div className="max-w-[360px] lg:mb-2">
                <Link
                  className="group inline-flex min-h-12 shrink-0 items-center gap-3 rounded-lg bg-[#472a3b] px-6 py-3 text-sm font-bold text-white transition duration-300 hover:-translate-y-0.5 hover:bg-[#6b3f58] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#472a3b] focus-visible:ring-offset-2"
                  to="/custom-cake"
                >
                  {t("Request a custom cake")}
                  <span
                    aria-hidden="true"
                    className="grid size-7 place-items-center rounded-full bg-[#ffb84d] text-[#472a3b] transition-transform duration-300 group-hover:translate-x-0.5"
                  >
                    <ArrowIcon />
                  </span>
                </Link>
              </div>
            </div>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
                      className={`min-h-11 rounded-lg border px-4 py-2.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#472a3b] focus-visible:ring-offset-2 ${
                        selected
                          ? "border-[#472a3b] bg-[#472a3b] text-white"
                          : "border-[#dce3eb] bg-white text-[#6b3f58] hover:border-[#472a3b] hover:bg-[#f4f6f8]"
                      }`}
                      key={id}
                      onClick={() => {
                        setSelectedCakeType(id);
                        if (id !== "all") setShowAllCakeResults(false);
                      }}
                      type="button"
                    >
                      {t(label)}
                    </button>
                  );
                })}
              </div>
              <label className="relative block w-full sm:max-w-xs">
                <span className="sr-only">{t("Search cakes")}</span>
                <div className="group relative">
                  <svg
                    aria-hidden="true"
                    className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#65748a] transition-colors group-focus-within:text-[#472a3b]"
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
                    className="min-h-11 w-full rounded-lg border border-[#dce3eb] bg-white py-2.5 pl-12 pr-4 text-sm font-semibold text-[#472a3b] outline-none transition placeholder:font-medium placeholder:text-[#65748a] hover:border-[#9eafc2] hover:shadow-[0_10px_28px_rgba(9,42,83,0.12)] focus:border-[#472a3b] focus:ring-2 focus:ring-[#472a3b]/15"
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
                  className="mt-8 rounded-xl bg-white px-5 py-8 text-center text-base leading-7 text-[#65748a]"
                  role="status"
                >
                  {t("No cakes match your search \u2014 try another name or filter.")}
                </p>
              ) : (
                <ul
                  className="mt-8 grid auto-rows-fr grid-cols-2 gap-3.5 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4 lg:gap-6"
                  id="home-cake-results"
                >
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
                        className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-xl bg-white ring-1 ring-transparent transition duration-500 ease-out hover:-translate-y-2 hover:rotate-[0.4deg] hover:shadow-[0_24px_48px_rgba(9,42,83,0.18)] hover:ring-[color:var(--card-accent)]/40 motion-reduce:transform-none motion-reduce:transition-none"
                        key={cake.name}
                        style={{ "--card-accent": accent }}
                      >
                        {/* Shine sweep on hover */}
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 z-20 -translate-x-[130%] skew-x-[-18deg] bg-[linear-gradient(100deg,transparent_30%,rgba(255,255,255,0.55)_50%,transparent_70%)] transition-transform duration-700 ease-out group-hover:translate-x-[130%] motion-reduce:hidden"
                        />
                        <div className="relative bg-[#f4f6f8]">
                          <ProductImageSlider
                            frameClassName="rounded-none bg-[#f4f6f8] shadow-none"
                            imageClassName="aspect-square transition-transform duration-700 ease-out group-hover:scale-[1.06] motion-reduce:transform-none sm:aspect-[4/3]"
                            images={images}
                            name={t(cake.name)}
                            resetKey={cake.name}
                            sizes="(min-width: 1024px) 24vw, (min-width: 640px) 46vw, 100vw"
                          />
                          <span
                            className="absolute left-3 top-3 rounded-md bg-white px-2.5 py-1 text-[13px] font-bold text-[#472a3b] transition duration-500 ease-out group-hover:-rotate-3 group-hover:scale-110 group-hover:shadow-md motion-reduce:transform-none sm:left-4 sm:top-4 sm:px-3 sm:py-1.5 sm:text-sm"
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
                          <span className="absolute bottom-4 right-4">
                            <RatingBadge
                                    averageRating={cake.averageRating}
                                    reviewCount={cake.reviewCount}
                            />
                          </span>
                          {soldOut && (
                            <span className="absolute right-4 top-4 rounded-md bg-[#472a3b] px-3 py-1.5 text-xs font-bold text-white">
                              {t("Sold out today")}
                            </span>
                          )}
                        </div>
                        <div
                          className="flex flex-1 flex-col justify-between gap-3 p-3.5 sm:gap-4 sm:p-5"
                        >
                          <div>
                            <Link
                              className="line-clamp-2 min-h-[2.5em] font-display text-base font-extrabold leading-tight text-[#472a3b] transition-colors duration-300 hover:text-[#6b3f58] focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#472a3b] sm:text-xl"
                              to={`/menu?${new URLSearchParams({ category: "Cakes & Pies", item: cake.name })}`}
                            >
                              {t(cake.name)}
                            </Link>
                            <p className="mt-1.5 line-clamp-2 min-h-10 text-[13px] font-medium leading-5 text-[#65748a] sm:text-sm">
                              {t(cake.detail)}
                            </p>
                          </div>
                          <div className="mt-auto flex flex-col items-stretch gap-2.5 sm:gap-3">
                            <span
                              className={`whitespace-nowrap font-display text-sm font-extrabold tabular-nums transition-colors duration-300 sm:text-base ${
                                added ? "animate-pulse text-green-700" : "text-[#472a3b]"
                              }`}
                            >
                              {typeof cake.priceXaf === "number" ? formatPrice(cake.priceXaf) : ""}
                            </span>
                            <button
                              aria-label={
                                added
                                  ? t("Added to your bag")
                                    : t("Add {name} to cart", { name: t(cake.name) })
                              }
                              className={`min-h-10 w-full whitespace-nowrap rounded-lg px-2 text-[13px] font-bold transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#472a3b] focus-visible:ring-offset-2 motion-reduce:transform-none disabled:cursor-not-allowed disabled:bg-[#e3e8ed] disabled:text-[#65748a] sm:min-h-11 sm:px-4 sm:text-sm ${
                                added
                                  ? "bg-[#4caf50] text-white"
                                  : "bg-[#472a3b] text-white hover:bg-[#6b3f58]"
                              }`}
                              disabled={soldOut}
                              onClick={() => handleAddToCart(cake, "Cakes & Pies")}
                              type="button"
                            >
                              {soldOut ? t("Sold out") : added ? t("Added") : t("Add to cart")}
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {selectedCakeType === "all" && !cakeQuery && cakeMenuCategory.items.length > 4 && (
                <div className="mt-6 flex justify-center">
                  <button
                    aria-controls="home-cake-results"
                    aria-expanded={showAllCakeResults}
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#472a3b] bg-white px-5 py-2.5 text-sm font-bold text-[#472a3b] transition-colors hover:bg-[#472a3b] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#472a3b] focus-visible:ring-offset-2"
                    onClick={() => setShowAllCakeResults((current) => !current)}
                    type="button"
                  >
                    {t(showAllCakeResults ? "Show fewer cakes" : "Show all {count} cakes", {
                      count: cakeMenuCategory.items.length,
                    })}
                  </button>
                </div>
              )}
              <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-xl text-sm leading-6 text-[#65748a]">
                  {t(
                    "A taste of the cake menu. See all designs on the cakes page \u2014 or build your own.",
                  )}
                </p>
                <Link
                  className="group inline-flex min-h-12 shrink-0 items-center justify-center gap-3 self-start rounded-md bg-[#472a3b] px-6 py-3 text-sm font-extrabold text-white transition duration-300 hover:bg-[#6b3f58] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffb84d] focus-visible:ring-offset-2 sm:self-auto"
                  to={`/menu?${new URLSearchParams({ category: "Cakes & Pies" })}`}
                >
                  {t("Explore all cakes")}
                  <span
                    aria-hidden="true"
                    className="grid size-7 place-items-center rounded-full bg-[#ffb84d] text-[#472a3b] transition-transform duration-300 group-hover:translate-x-0.5"
                  >
                    <ArrowIcon />
                  </span>
                </Link>
              </div>
          </div>
        </section>

        <section
          aria-labelledby="popular-flavors-heading"
          className="scroll-mt-20 bg-[#f4f6f8] px-5 pb-20 pt-12 sm:px-8 sm:pb-24 sm:pt-14 lg:px-10 lg:pb-28 lg:pt-16"
          id="favorites"
          ref={popularSection}
        >
          <div className="mx-auto max-w-[1320px]">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <h2
                  className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-[#472a3b] sm:text-5xl"
                  id="popular-flavors-heading"
                >
                  {t("Fan favorites")}
                </h2>
                <p className="mt-4 max-w-xl text-base leading-7 text-[#65748a]">
                  {t(
                    "Our most-loved signature creations, mixed to order on the frozen stone.",
                  )}
                </p>
              </div>
              <Link
                className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 self-start rounded-md bg-[#472a3b] px-6 py-3 text-sm font-extrabold text-white transition-colors hover:bg-[#6b3f58] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#472a3b] focus-visible:ring-offset-2 sm:self-auto"
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
                    className={`size-full object-cover transition-transform duration-500 group-hover:scale-[1.025] motion-reduce:transition-none ${soldOut ? "grayscale-[60%]" : ""}`}
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
                      className="group flex min-w-0 flex-col lg:col-span-5 lg:row-span-4"
                      key={itemKey}
                    >
                      <Link
                        aria-label={t(item.name)}
                        className="relative block aspect-[4/3] overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8721e] focus-visible:ring-offset-4"
                        style={{ backgroundColor: popularFlavorColors[index] }}
                        to={itemLink}
                      >
                        {image}
                        {soldOut && (
                          <span className="absolute left-4 top-4 rounded-sm bg-white px-3 py-1.5 text-xs font-bold text-red-700">
                            {t("Sold out")}
                          </span>
                        )}
                      </Link>

                      <div className="flex flex-1 flex-col pt-5 sm:pt-6">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="font-display text-2xl font-extrabold leading-tight text-[#472a3b] sm:text-3xl">
                            <Link
                              className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8721e] focus-visible:ring-offset-2"
                              to={itemLink}
                            >
                              {t(item.name)}
                            </Link>
                          </h3>
                          <RatingBadge
                            averageRating={item.averageRating}
                            reviewCount={item.reviewCount}
                          />
                        </div>
                        <p className="mt-2 max-w-lg text-sm leading-6 text-[#65748a] sm:text-base sm:leading-7">
                          {t(item.detail)}
                        </p>
                        <div className="mt-auto flex flex-wrap items-center justify-between gap-4 pt-5">
                          <p className={`whitespace-nowrap font-display text-xl font-extrabold tabular-nums transition-colors duration-300 sm:text-2xl ${added ? "text-green-700" : "text-[#472a3b]"}`}>
                            {soldOut ? t("Sold out") : formatPrice(item.priceXaf)}
                          </p>
                          <button
                            aria-label={
                              soldOut
                                ? t("Sold out")
                                : t("Add {name} to cart", {
                                    name: t(item.name),
                                  })
                            }
                            className={`relative z-10 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md px-6 py-3 text-sm font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#472a3b] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#dfe5e7] disabled:text-[#65748a] sm:w-auto ${
                              added
                                ? "bg-[#37632c] text-white"
                                : "bg-[#472a3b] text-white hover:bg-[#6b3f58]"
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
                                : t("Add to cart")}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                }

                return (
                  <article
                    className="group flex min-w-0 flex-wrap gap-3 bg-white/80 p-3 sm:flex-nowrap sm:items-center sm:gap-4 sm:p-4 lg:col-span-7"
                    key={itemKey}
                  >
                    <Link
                      aria-label={t(item.name)}
                      className="relative size-20 shrink-0 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8721e] focus-visible:ring-offset-2 sm:size-24"
                      style={{ backgroundColor: popularFlavorColors[index] }}
                      to={itemLink}
                    >
                      {image}
                    </Link>
                    <div className="min-w-0 flex-1 self-center">
                      <h3 className="font-display text-base font-extrabold leading-snug text-[#472a3b] sm:text-lg">
                        <Link
                          className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8721e] focus-visible:ring-offset-2"
                          to={itemLink}
                        >
                          {t(item.name)}
                        </Link>
                      </h3>
                      <div className="mt-1">
                        <RatingBadge
                          averageRating={item.averageRating}
                          reviewCount={item.reviewCount}
                        />
                      </div>
                      <p className="mt-1 line-clamp-1 text-xs leading-5 text-[#65748a] sm:text-sm sm:leading-6">
                        {t(item.detail)}
                      </p>
                      <p className={`mt-1 whitespace-nowrap font-display text-sm font-extrabold tabular-nums transition-colors duration-300 ${added ? "text-green-700" : "text-[#472a3b]"}`}>
                        {soldOut ? t("Sold out") : formatPrice(item.priceXaf)}
                      </p>
                    </div>
                    <button
                      aria-label={
                        soldOut
                          ? t("Sold out")
                          : added
                            ? t("Added")
                            : t("Add {name} to cart", {
                                name: t(item.name),
                              })
                      }
                      className={`relative z-10 mt-0 inline-flex min-h-10 w-full shrink-0 items-center justify-center gap-2 rounded-md px-4 text-xs font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#472a3b] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#dfe5e7] disabled:text-[#65748a] sm:w-auto sm:px-4 ${
                        added
                          ? "bg-[#37632c] text-white"
                          : "bg-[#472a3b] text-white hover:bg-[#6b3f58]"
                      }`}
                      disabled={soldOut}
                      onClick={() => handleAddToCart(item)}
                      title={soldOut ? t("Sold out") : t("Add to cart")}
                      type="button"
                    >
                      {bagIcon && (
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
                            strokeWidth="2"
                          />
                        </svg>
                      )}
                      {soldOut ? t("Sold out") : added ? t("Added") : t("Add to cart")}
                    </button>
                  </article>
                );
              }) : Array.from({ length: 5 }, (_, index) => (
                <div
                  aria-hidden="true"
                  className={`animate-pulse bg-[#e4e8ee] ${
                    index === 0
                      ? "aspect-[4/3] min-h-[400px] sm:min-h-[480px] lg:col-span-5 lg:row-span-4 lg:aspect-auto lg:min-h-[520px]"
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
            className={`fixed bottom-24 left-1/2 z-50 ${
              cartNoticeIsError ? "flex" : "hidden sm:flex"
            } w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 items-center justify-between gap-4 rounded-2xl px-4 py-3 text-sm font-semibold shadow-[0_16px_40px_rgba(9,42,83,0.28)] ring-1 ${
              cartNoticeIsError
                ? "bg-red-50 text-red-800 ring-red-200"
                : "bg-[#472a3b] text-white ring-white/15"
            }`}
            role={cartNoticeIsError ? "alert" : "status"}
          >
            <span className="min-w-0">{cartNotice}</span>
            {!cartNoticeIsError && (
              <Link
                className="shrink-0 rounded-full bg-[#ffb84d] px-3 py-2 text-xs font-extrabold text-[#472a3b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                to="/cart"
              >
                {t("View bag")}
              </Link>
            )}
          </div>
        )}

        <MomentGallery t={t} />

        <section
          aria-labelledby="home-menu-heading"
          className="scroll-mt-20 bg-[#f4f6f8] px-5 py-16 text-[#472a3b] sm:px-8 sm:py-20 lg:px-10 lg:py-24"
          id="menu"
        >
          <div className="mx-auto max-w-5xl">
            <div className="mx-auto max-w-2xl text-center">
              <h2
                className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl"
                id="home-menu-heading"
              >
                {t("Menu highlights")}
              </h2>
              <p className="mt-4 text-base leading-7 text-[#65748a] sm:text-lg">
                {t("Explore signature creations and discover every flavor.")}
              </p>
            </div>

            <ul className="mt-10 grid gap-10 sm:grid-cols-2 sm:gap-8 lg:gap-10">
              {[
                {
                  title: "The full menu",
                  description: "All categories, from signature creations to sundaes and cakes.",
                  cta: "Browse the full menu",
                  to: "/menu",
                  image: "/menu-official/ice-cream/signature-creations/our-dubai-chocolate-creation.webp",
                },
                {
                  title: "All flavors",
                  description: "Every flavor — fruity, chocolatey or classic — in one collection.",
                  cta: "View flavors",
                  to: "/flavors",
                  image: "/menu-official/ice-cream/signature-creations/our-strawberry-blonde-2.webp",
                },
              ].map((item, itemIndex) => (
                <li key={item.to}>
                  <Link className="group block" to={item.to}>
                    <span className="relative block aspect-[4/3] overflow-hidden rounded-[20px] bg-[#fbfaf5]">
                      <img
                        alt=""
                        className="size-full object-cover object-center transition duration-700 ease-out group-hover:scale-[1.03] group-focus-visible:scale-[1.03] motion-reduce:transition-none"
                        decoding="async"
                        fetchPriority={itemIndex === 0 ? "high" : "auto"}
                        loading={itemIndex === 0 ? "eager" : "lazy"}
                        onError={photoErrorHandler(item.image)}
                        sizes="(min-width: 1024px) 32rem, (min-width: 640px) 46vw, 100vw"
                        src={item.image}
                        srcSet={photoSrcSet(item.image)}
                      />
                    </span>
                    <span className="mt-5 block">
                      <h3 className="font-display text-2xl font-extrabold leading-tight tracking-tight text-[#472a3b] sm:text-3xl">
                        {t(item.title)}
                      </h3>
                      <p className="mt-2 text-base leading-7 text-[#65748a]">
                        {t(item.description)}
                      </p>
                      <span className="mt-3 inline-flex min-h-12 items-center font-bold text-[#472a3b] underline decoration-[#ffb84d] decoration-2 underline-offset-4">
                        {t(item.cta)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            <p className="mx-auto mt-10 max-w-2xl text-center text-sm leading-6 text-[#65748a]">
              {t("Cards & Mobile Money accepted")}. {t("Pay in FCFA with")} Visa, Mastercard, MTN MoMo, {t("Orange Money")}.
            </p>
          </div>
        </section>

        {/* Back to top — appears after scrolling past the hero */}
        <button
          aria-label={t("Back to top")}
          className={`fixed bottom-6 right-6 z-40 grid size-12 place-items-center rounded-full bg-[#472a3b] text-white shadow-[0_10px_24px_rgba(9,42,83,0.35)] transition duration-300 hover:bg-[#6b3f58] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffb84d] focus-visible:ring-offset-2 ${
            showScrollTop
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none hidden"
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

      </main>
      <Footer />
    </div>
  );
}
