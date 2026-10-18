import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Footer,
  Header,
  ArrowIcon,
} from "../../components/Layout";
import { useCart } from "../../context/useCart";
import { apiRequest } from "../../api/api";
import { cameroonLocations, coldStoneMenuCategories, getMenuItemId } from "../../../shared/data";
import { useLanguage } from "../../language/useLanguage";
import { photoErrorHandler, photoSrcSet, thumbnail } from "../../lib/thumbnails";
import { HOME_SLIDE_SIZES } from "../../../shared/photoSizes.js";
import { numberFormatter } from "../../lib/cartPricing";

function mapsSearchUrl(location) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.mapQuery)}`;
}

function promoBarIsVisible() {
  return document.documentElement.hasAttribute("data-promo-visible");
}

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
const homeSlides = [
  {
    eyebrow: "A little happiness in every scoop",
    title: "Your next favorite",
    accent: "starts here.",
    description:
      "Browse signature creations, explore the online catalog, and discover publicly listed locations across Cameroon.",
    image: "/ice-images/ice-9.jpg",
    alt: "Colorful ice cream creations ready to enjoy",
    caption: "The signature experience",
  },
  {
    eyebrow: "Ice cream cakes for every celebration",
    title: "Celebrate with",
    accent: "a cake to remember.",
    description:
      "Layers of cake and creamy ice cream, finished with rich chocolate. Order one for birthdays, parties and every reason in between.",
    image: "/cake-images/cake-11.webp",
    alt: "A chocolate ice cream cake held up for a celebration",
    caption: "Made for celebrations",
  },
  {
    eyebrow: "Cool, creamy and full of crunch",
    title: "Fresh mint,",
    accent: "loaded with cookies.",
    description:
      "Mint ice cream mixed with chocolate cookies and fudge, served in a waffle cone. A Signature Creation made right in front of you.",
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

const STAR_PATH = "M12 2.75l2.83 5.74 6.33.92-4.58 4.47 1.08 6.3L12 17.2l-5.66 2.98 1.08-6.3-4.58-4.47 6.33-.92L12 2.75Z";

// Crisp SVG stars that can show part of a star, so an average such as 4.6 reads accurately.
function StarRating({ value, className = "size-4", filledClassName = "text-[#f5b301]", emptyClassName = "text-[#e4e8ee]", label }) {
  return (
    <span aria-label={label} className="inline-flex items-center gap-0.5" role="img">
      {[0, 1, 2, 3, 4].map((index) => {
        const fill = Math.max(0, Math.min(1, value - index));
        return (
          <span aria-hidden="true" className={`relative inline-block ${className}`} key={index}>
            <svg className={`absolute inset-0 size-full ${emptyClassName}`} fill="currentColor" viewBox="0 0 24 24">
              <path d={STAR_PATH} />
            </svg>
            {fill > 0 && (
              <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <svg className={`h-full ${className.split(" ").filter((name) => name.startsWith("size-")).join(" ")} ${filledClassName}`} fill="currentColor" viewBox="0 0 24 24">
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
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M12 2.5 14.4 4l2.8-.2 1.2 2.6 2.5 1.3-.2 2.8L22 13l-1.5 2.4.2 2.8-2.6 1.2-1.3 2.5-2.8-.2L12 23l-2.4-1.5-2.8.2-1.2-2.6-2.5-1.3.2-2.8L2 13l1.5-2.4-.2-2.8 2.6-1.2L7.2 4.1l2.8.2L12 2.5Z" fill="currentColor" />
      <path d="m8.5 12.5 2.4 2.4 4.6-5" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

// Review dates arrive as "2026-10-11 17:36:57" (SQLite, UTC) or an ISO string (PostgreSQL).
function parseReviewDate(value) {
  if (!value) return null;
  const text = String(value);
  const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(text) ? text : `${text.replace(" ", "T")}Z`;
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
    return days < 7 ? relative.format(-days, "day") : relative.format(-Math.round(days / 7), "week");
  }
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function ReviewerAvatar({ name, picture, className }) {
  return picture ? (
    <img decoding="async" alt="" className={`shrink-0 rounded-full object-cover ${className}`} loading="lazy" src={picture} />
  ) : (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full bg-[#092a53] font-display font-extrabold text-[#ffdc32] ${className}`}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

const LONG_REVIEW_LENGTH = 150;

function ReviewCard({ review, language, t }) {
  const [expanded, setExpanded] = useState(false);
  const customerName = review.customerName || t("Customer");
  const rawText = (review.review || "").trim();
  const text = rawText ? rawText.charAt(0).toUpperCase() + rawText.slice(1) : "";
  const isLong = text.length > LONG_REVIEW_LENGTH;
  const date = formatReviewDate(review.createdAt, language);
  const openQuote = language === "fr" ? "«" : "“";
  const closeQuote = language === "fr" ? "»" : "”";
  return (
    <li>
      <article className="flex h-full flex-col rounded-[24px] bg-white p-5 ring-1 ring-[#ebe7dc] transition duration-200 hover:-translate-y-1 hover:shadow-[0_18px_36px_rgba(9,42,83,0.18),0_6px_14px_rgba(9,42,83,0.1)] hover:ring-[#092a53] sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <StarRating
            className="size-4"
            emptyClassName="text-[#e7e1d2]"
            filledClassName="text-[#e2b100]"
            label={t("{rating} out of 5 stars", { rating: review.rating })}
            value={Number(review.rating) || 0}
          />
          {review.demo && (
            <span className="rounded-full bg-[#fff6cc] px-2.5 py-1 text-[11px] font-extrabold text-[#8a7000]">{t("Demo")}</span>
          )}
        </div>
        <div className="mt-4 flex-1">
          {text ? (
            <blockquote className={`max-w-3xl whitespace-pre-line text-[15px] leading-7 text-[#243044] ${isLong && !expanded ? "line-clamp-4" : ""}`}>
              <span aria-hidden="true" className="float-left mr-1.5 font-display text-[2.6rem] font-extrabold leading-[0.72] text-[#ffdc32]">{openQuote}</span>
              {text}
              <span aria-hidden="true" className="ml-1 inline-block translate-y-1 font-display text-[1.7rem] font-extrabold leading-none text-[#ffdc32]">{closeQuote}</span>
            </blockquote>
          ) : (
            <p className="text-sm text-[#8a8172]">{t("No written comment.")}</p>
          )}
          {isLong && (
            <button
              aria-expanded={expanded}
              className="mt-2 text-sm font-extrabold text-[#092a53] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2"
              onClick={() => setExpanded((current) => !current)}
              type="button"
            >
              {t(expanded ? "Show less" : "Read more")}
            </button>
          )}
        </div>
        <footer className="mt-5 flex items-center gap-3 border-t border-[#f0ece3] pt-4">
          <ReviewerAvatar className="size-10 text-sm" name={customerName} picture={review.profilePicture} />
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold text-[#092a53]">{customerName}</p>
            <p className="mt-0.5 truncate text-xs text-[#65748a]">
              {review.itemName ? t(review.itemName) : t("Verified purchase")}
              {date ? ` · ${date}` : ""}
            </p>
          </div>
        </footer>
      </article>
    </li>
  );
}

const DEMO_REVIEWS = [
  {
    rating: 5,
    review: "The mint cookie cone was mixed right in front of me and stayed creamy on the way home.",
    createdAt: "2026-10-16T10:00:00.000Z",
    customerName: "Amina",
    itemName: "Cookie Mintster",
  },
  {
    rating: 4,
    review: "Ordered the birthday cake for the office. It arrived looking just like the photo, and nothing was left.",
    createdAt: "2026-10-11T10:00:00.000Z",
    customerName: "Paul",
    itemName: "Birthday Cake Remix",
  },
  {
    rating: 5,
    review: "The Dubai chocolate scoop was rich without being too sweet. I finished it before we left the shop.",
    createdAt: "2026-10-04T10:00:00.000Z",
    customerName: "Nadia",
    itemName: "Our Dubai Chocolate Creation",
  },
  {
    rating: 5,
    review: "Founder’s Favorite had the pecans, brownie and caramel I wanted. Mixed on the stone, and gone in a few minutes.",
    createdAt: "2026-09-27T10:00:00.000Z",
    customerName: "Esther",
    itemName: "Founder’s Favorite",
  },
];

function demoReviews(t) {
  return DEMO_REVIEWS.map((review) => ({ ...review, demo: true, review: t(review.review) }));
}

function ReviewsSection({ reviews, stats, error, isLoaded, language, t }) {
  // Wait for the answer, so the "no reviews yet" message never flashes before real reviews.
  if (!isLoaded) return null;
  const hasReviews = reviews.length > 0;
  const showingDemo = !error && !hasReviews;
  const displayReviews = showingDemo ? demoReviews(t) : reviews;
  const average = showingDemo
    ? DEMO_REVIEWS.reduce((sum, review) => sum + review.rating, 0) / DEMO_REVIEWS.length
    : stats.average;
  const roundedAverage = Math.round(average * 10) / 10;
  const count = showingDemo ? DEMO_REVIEWS.length : stats.count;
  const distribution = showingDemo
    ? DEMO_REVIEWS.reduce((buckets, review) => {
        buckets[review.rating] = (buckets[review.rating] || 0) + 1;
        return buckets;
      }, {})
    : stats.distribution || {};
  const busiest = Math.max(1, ...[1, 2, 3, 4, 5].map((stars) => distribution[stars] || 0));
  return (
    <section aria-labelledby="real-reviews-heading" className="bg-white px-5 py-16 sm:px-8 sm:py-20 lg:px-10">
      <div className="mx-auto max-w-[1100px] rounded-[32px] bg-[#fbfaf5] px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        <div className={`flex flex-col gap-6 ${(hasReviews || showingDemo) ? "lg:flex-row lg:items-start lg:justify-between" : "items-center text-center"}`}>
          <div className={(hasReviews || showingDemo) ? "max-w-xl" : "max-w-2xl"}>
            <h2 className="font-display text-4xl font-extrabold leading-none tracking-tight text-[#092a53] sm:text-5xl" id="real-reviews-heading">
              {t("Real Reviews")}
            </h2>
            <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-[#092a53]">
              <VerifiedIcon className="size-4 text-[#2f8f4e]" />
              {t("Verified purchases only")}
            </p>
          </div>
          {(hasReviews || showingDemo) && (
            <div className="flex flex-wrap items-center gap-5 rounded-[24px] bg-white px-5 py-4 ring-1 ring-[#ebe7dc]">
              <div>
                <p className="font-display text-5xl font-extrabold leading-none tabular-nums text-[#092a53]">{roundedAverage.toFixed(1)}</p>
                <div className="mt-2">
                  <StarRating
                    className="size-4"
                    emptyClassName="text-[#e7e1d2]"
                    filledClassName="text-[#e2b100]"
                    label={t("{rating} out of 5 stars", { rating: roundedAverage.toFixed(1) })}
                    value={average}
                  />
                </div>
                <p className="mt-1 text-sm text-[#65748a]">
                  {showingDemo
                    ? t(count === 1 ? "Sample review" : "Sample reviews")
                    : t(count === 1 ? "Based on 1 review" : "Based on {count} reviews", { count })}
                </p>
              </div>
              <ol className="grid min-w-[9.5rem] gap-1.5">
                {[5, 4, 3, 2, 1].map((stars) => {
                  const bucket = distribution[stars] || 0;
                  return (
                    <li
                      aria-label={t("{count} reviews with {stars} stars", { count: bucket, stars })}
                      className="grid grid-cols-[1.25rem_1fr_1.25rem] items-center gap-2"
                      key={stars}
                    >
                      <span className="text-xs font-bold tabular-nums text-[#65748a]">{stars}</span>
                      <span className="h-1.5 overflow-hidden rounded-full bg-[#efeae0]">
                        <span
                          className="block h-full rounded-full bg-[#ffdc32]"
                          style={{ width: `${(bucket / busiest) * 100}%` }}
                        />
                      </span>
                      <span className="text-right text-xs tabular-nums text-[#65748a]">{bucket}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>

        {error ? (
          <p className="mt-8 max-w-xl text-base leading-7 text-[#52647b]" role="status">
            {t("Customer reviews could not be loaded")}: {error}
          </p>
        ) : (
          <ul className={`mt-8 grid gap-4 ${displayReviews.length > 1 ? "lg:grid-cols-3" : ""}`}>
            {displayReviews.map((review, index) => (
              <ReviewCard
                key={`${review.createdAt}-${review.itemId || review.itemName}-${index}`}
                language={language}
                review={review}
                t={t}
              />
            ))}
          </ul>
        )}

        <div className={`mt-8 flex flex-wrap gap-3 ${(hasReviews || showingDemo) ? "" : "justify-center"}`}>
          <Link
            className="inline-flex items-center gap-2 rounded-full bg-[#092a53] px-6 py-3.5 text-sm font-extrabold text-white transition hover:bg-[#163e6b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2"
            to="/account/orders"
          >
            {t("Write a review")} <ArrowIcon />
          </Link>
          <Link
            className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-extrabold text-[#092a53] ring-1 ring-[#d9d4c7] transition hover:ring-[#092a53] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2"
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
  const [popularFlavors, setPopularFlavors] = useState(() =>
    getPopularFlavors(coldStoneMenuCategories),
  );
  const [menuError, setMenuError] = useState("");
  const [cartNotice, setCartNotice] = useState("");
  const [reviews, setReviews] = useState([]);
  const [reviewStats, setReviewStats] = useState({ count: 0, average: 0, distribution: {} });
  const [reviewsError, setReviewsError] = useState("");
  const [reviewsLoaded, setReviewsLoaded] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [loadedSlides, setLoadedSlides] = useState([0]);
  const [addedItemKey, setAddedItemKey] = useState(null);
  const [cartNoticeIsError, setCartNoticeIsError] = useState(false);
  const addedTimer = useRef(undefined);
  const reviewsSentinel = useRef(null);
  const [promoBarVisible, setPromoBarVisible] = useState(promoBarIsVisible);

  useEffect(() => {
    const sync = () => setPromoBarVisible(promoBarIsVisible());
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-promo-visible"] });
    sync();
    return () => observer.disconnect();
  }, []);

  // Slide photos download only when needed: the one on screen, then the next one shortly before it
  // appears. Opening the page no longer downloads every slide photo at once.
  useEffect(() => {
    const show = (index) => setLoadedSlides((current) => (current.includes(index) ? current : [...current, index]));
    show(activeSlide);
    const timer = window.setTimeout(() => show((activeSlide + 1) % homeSlides.length), 3000);
    return () => window.clearTimeout(timer);
  }, [activeSlide]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timeoutId = window.setTimeout(() => {
      setActiveSlide((current) => (current + 1) % homeSlides.length);
    }, 12000);

    return () => window.clearTimeout(timeoutId);
  }, [activeSlide]);

  useEffect(() => {
    let cancelled = false;
    // Stock updates the cards that are already drawn from the built-in menu. Wait until the
    // hero photo has had the connection to itself.
    const timeoutId = window.setTimeout(() => {
      apiRequest("/menu")
        .then(({ categories }) => {
          if (!cancelled) {
            setPopularFlavors(getPopularFlavors(categories));
            setMenuError("");
          }
        })
        .catch((error) => {
          if (!cancelled) setMenuError(error.message);
        });
    }, 1600);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    const node = reviewsSentinel.current;
    if (!node) return undefined;
    let cancelled = false;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      apiRequest("/reviews")
        .then(({ reviews: approvedReviews }) => {
          if (!cancelled) {
            setReviews(approvedReviews.slice(0, 6));
            const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
            let total = 0;
            for (const review of approvedReviews) {
              const rating = Math.min(5, Math.max(1, Math.round(Number(review.rating) || 0)));
              distribution[rating] += 1;
              total += rating;
            }
            setReviewStats({
              count: approvedReviews.length,
              average: approvedReviews.length ? total / approvedReviews.length : 0,
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
    }, { rootMargin: "700px" });
    observer.observe(node);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);

  function handleAddToCart(item) {
    const added = addToCart({
      ...item,
      id: item.id || getMenuItemId("Ice Cream", item.name),
      itemType: "menu",
      categoryTitle: "Ice Cream",
    });
    setCartNoticeIsError(!added);
    setCartNotice(
      added
        ? t("Added {name} to your bag.", { name: t(item.name) })
        : t("This item could not be added to your bag. Please try again."),
    );
    if (added) {
      setAddedItemKey(item.id || item.name);
      window.clearTimeout(addedTimer.current);
      addedTimer.current = window.setTimeout(() => setAddedItemKey(null), 1800);
    }
  }

  useEffect(() => () => window.clearTimeout(addedTimer.current), []);


  const formatPrice = (price) =>
    `${numberFormatter(language === "fr" ? "fr-CM" : "en-CM").format(price)} FCFA`;

  return (
    <div className="min-h-screen overflow-clip bg-[#fbfaf5] text-[#102c50]">
      <Header />
      <main>
        <section
          id="home"
          className="relative isolate w-full overflow-clip bg-[#092a53] text-white"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-40 -top-40 -z-10 size-[38rem] rounded-full bg-[radial-gradient(closest-side,rgb(255_220_50/0.12),rgb(255_220_50/0.12)_35%,transparent)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-56 -left-40 -z-10 size-[34rem] rounded-full bg-[radial-gradient(closest-side,rgb(28_79_138/0.5),rgb(28_79_138/0.5)_35%,transparent)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 opacity-[0.06] [background-image:radial-gradient(#ffffff_1px,transparent_1px)] [background-size:28px_28px]"
          />

          <div className="mx-auto w-full max-w-[1320px] px-5 pt-10 sm:px-8 sm:pt-14 lg:px-12 lg:pt-16">
            <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-10">
              {/* Copy */}
              <div className="relative z-10 lg:col-span-6">
                <div className="home-hero-copy" key={activeSlide}>
                  <p className="inline-flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#ffdc32]">
                    <span aria-hidden="true" className="h-px w-10 bg-[#ffdc32]" />
                    {t(homeSlides[activeSlide].eyebrow)}
                  </p>
                  <h1 className="mt-6 font-display text-[clamp(2.9rem,6.6vw,5.75rem)] font-extrabold leading-[0.95] tracking-[-0.04em] text-white">
                    {t(homeSlides[activeSlide].title)}
                    <span className="mt-1 block text-[#ffdc32]">
                      {t(homeSlides[activeSlide].accent)}
                    </span>
                  </h1>
                  <p className="mt-7 max-w-lg text-base leading-7 text-white/70 sm:text-lg sm:leading-8">
                    {t(homeSlides[activeSlide].description)}
                  </p>
                </div>

                <div className="mt-9 flex flex-wrap items-center gap-3">
                  <Link
                    className="inline-flex items-center gap-2 rounded-full bg-[#ffdc32] px-7 py-4 text-sm font-extrabold text-[#092a53] shadow-[0_14px_34px_rgba(255,220,50,0.25)] transition hover:-translate-y-0.5 hover:bg-[#ffe76c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32] focus-visible:ring-offset-2 focus-visible:ring-offset-[#092a53]"
                    to={`/menu?category=${encodeURIComponent("Ice Cream")}`}
                  >
                    {t("Order now")} <ArrowIcon />
                  </Link>
                  <Link
                    className="inline-flex items-center gap-2 rounded-full border border-white/25 px-7 py-4 text-sm font-extrabold text-white transition hover:-translate-y-0.5 hover:border-white hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#092a53]"
                    to="/flavors"
                  >
                    {t("Explore flavors")} <ArrowIcon diagonal />
                  </Link>
                </div>
                <p className="mt-5 text-sm font-semibold text-white/80">
                  {t("Pickup or delivery in Douala and Yaoundé.")}
                </p>

                <ul className="mt-8 flex flex-wrap gap-x-8 gap-y-3 border-t border-white/10 pt-6 text-sm font-semibold text-white/80">
                  {["Signature creations", "A flavor for every mood", "Cameroon locations"].map((label) => (
                    <li className="inline-flex items-center gap-2.5" key={label}>
                      <span aria-hidden="true" className="grid size-5 place-items-center rounded-full bg-[#ffdc32]/15 text-[#ffdc32]">
                        <svg className="size-3" fill="none" viewBox="0 0 24 24">
                          <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
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
                      <img decoding="async"
                        alt={isActive ? t(slide.alt) : ""}
                        aria-hidden={!isActive}
                        className={`home-slide-image absolute inset-0 size-full object-cover object-center ${
                          isActive ? "scale-100 opacity-100" : "scale-[1.04] opacity-0"
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
                  <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#061d3a]/85 via-[#061d3a]/10 to-transparent" />

                  <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 p-5 sm:p-6">
                    <span className="rounded-full border border-white/25 bg-white/15 px-3.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-white backdrop-blur-md">
                      {t("Featured")}
                    </span>
                    <span aria-live="polite" className="font-display text-sm font-extrabold tabular-nums text-white">
                      {String(activeSlide + 1).padStart(2, "0")}
                      <span className="text-white/50"> / {String(homeSlides.length).padStart(2, "0")}</span>
                    </span>
                  </div>

                  <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                    <p className="max-w-xs font-display text-2xl font-extrabold leading-tight sm:text-3xl">
                      {t(homeSlides[activeSlide].caption)}
                    </p>
                    <div className="mt-5 flex items-center gap-3">
                      <div aria-hidden="true" className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/20">
                        <span className="home-hero-progress absolute inset-0 rounded-full bg-[#ffdc32]" key={activeSlide} />
                      </div>
                      <button
                        aria-label={t("Previous slide")}
                        className="grid size-11 place-items-center rounded-full border border-white/30 bg-white/10 text-white backdrop-blur-md transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32]"
                        onClick={() => setActiveSlide((activeSlide + homeSlides.length - 1) % homeSlides.length)}
                        type="button"
                      >
                        <svg aria-hidden="true" className="size-4 rotate-180" fill="none" viewBox="0 0 20 20">
                          <path d="M3.5 10h12m-5-5 5 5-5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                        </svg>
                      </button>
                      <button
                        aria-label={t("Next slide")}
                        className="grid size-11 place-items-center rounded-full bg-[#ffdc32] text-[#092a53] shadow-md transition hover:scale-105 hover:bg-[#ffe76c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        onClick={() => setActiveSlide((activeSlide + 1) % homeSlides.length)}
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
                        aria-label={t("Show slide {number}", { number: index + 1 })}
                        className={`relative size-16 overflow-hidden rounded-2xl transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32] ${
                          isActive ? "ring-2 ring-[#ffdc32]" : "opacity-60 hover:opacity-100"
                        }`}
                        key={slide.image}
                        onClick={() => setActiveSlide(index)}
                        type="button"
                      >
                        <img decoding="async" loading="lazy" alt="" className="size-full object-cover" onError={photoErrorHandler(slide.image)} src={thumbnail(slide.image, "tiny")} />
                      </button>
                    );
                  })}
                </div>
                <div aria-label={t("Choose a featured slide")} className="mt-2 flex justify-center sm:hidden" role="group">
                  {/* The dots stay small, but each one has a finger-sized (32px) tap area. */}
                  {homeSlides.map((slide, index) => (
                    <button
                      aria-current={activeSlide === index ? "true" : undefined}
                      aria-label={t("Show slide {number}", { number: index + 1 })}
                      className="grid h-8 min-w-8 place-items-center px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32] rounded-full"
                      key={slide.image}
                      onClick={() => setActiveSlide(index)}
                      type="button"
                    >
                      <span aria-hidden="true" className={`h-2 rounded-full transition-all ${activeSlide === index ? "w-8 bg-[#ffdc32]" : "w-2 bg-white/35"}`} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Quick links */}
          <div className="mt-16 border-t border-white/10 bg-[#061f40]/60 lg:mt-20">
            <ul className="mx-auto grid max-w-[1320px] sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: "pin", title: "Cameroon locations", detail: "Find a listed shop near you.", to: "/locations" },
                { icon: "✧", title: "Explore the menu", detail: "Browse signature creations and treats.", to: "/menu" },
                { icon: "✶", title: "Parties & events", detail: "Ice cream for birthdays, offices and celebrations.", to: "/events" },
                { icon: "✿", title: "Custom cake requests", detail: "Plan a cake for your celebration.", to: "/custom-cake" },
              ].map((feature, index) => (
                <li
                  className={`border-white/10 ${index > 0 ? "border-t sm:border-t-0" : ""} ${index % 2 === 1 ? "sm:border-l" : ""} ${index > 1 ? "sm:border-t lg:border-t-0" : ""} ${index === 2 ? "lg:border-l" : ""}`}
                  key={feature.title}
                >
                  <Link
                    className="group flex h-full items-center gap-4 px-5 py-6 transition hover:bg-white/[0.04] focus-visible:bg-white/[0.06] focus-visible:outline-none sm:px-8 lg:py-7"
                    to={feature.to}
                  >
                    <span
                      aria-hidden="true"
                      className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/[0.07] text-lg text-[#ffdc32] ring-1 ring-white/10 transition group-hover:bg-[#ffdc32] group-hover:text-[#092a53]"
                    >
                      {feature.icon === "pin" ? (
                        <svg className="size-5" fill="none" viewBox="0 0 24 24">
                          <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
                        </svg>
                      ) : (
                        feature.icon
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-extrabold text-white">{t(feature.title)}</span>
                      <span className="mt-1 block text-xs leading-5 text-white/55">{t(feature.detail)}</span>
                    </span>
                    <span aria-hidden="true" className="shrink-0 text-white/40 transition group-hover:translate-x-1 group-hover:text-[#ffdc32]">
                      <ArrowIcon />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="shops-heading" className="bg-white px-5 py-12 sm:px-8 lg:px-10 lg:py-14">
          <div className="mx-auto max-w-[1320px]">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-display text-3xl font-extrabold tracking-tight text-[#092a53] sm:text-4xl" id="shops-heading">
                {t("Shops")}
              </h2>
              <Link
                className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#092a53] px-4 py-2.5 text-sm font-extrabold text-white shadow-[0_8px_20px_rgba(9,42,83,0.16)] transition duration-200 hover:bg-[#163e6b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2 motion-safe:hover:-translate-y-0.5"
                to="/locations"
              >
                <svg aria-hidden="true" className="size-4 text-[#ffdc32]" fill="none" viewBox="0 0 24 24">
                  <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
                </svg>
                {t("All locations")}
                <ArrowIcon />
              </Link>
            </div>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {cameroonLocations.map((location) => (
                <li className="min-w-0" key={`${location.town}-${location.area}`}>
                  <a
                    className="group flex h-full flex-col rounded-[22px] bg-[#fbfaf5] p-5 ring-1 ring-[#ebe7dc] transition duration-200 hover:bg-white hover:shadow-[0_18px_36px_rgba(9,42,83,0.18),0_6px_14px_rgba(9,42,83,0.1)] hover:ring-[#092a53] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2 motion-safe:hover:-translate-y-1"
                    href={mapsSearchUrl(location)}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-[#092a53] ring-1 ring-[#ebe7dc] transition duration-200 group-hover:bg-[#092a53] group-hover:text-[#ffdc32] group-hover:ring-[#092a53]">
                        <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
                          <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
                        </svg>
                      </span>
                      <span className="text-xs font-bold text-[#65748a]">{t(location.town)}</span>
                    </span>
                    <span className="mt-4 font-display text-lg font-extrabold leading-tight text-[#092a53]">{location.area}</span>
                    <span className="mt-2 flex items-start gap-2 text-sm leading-5 text-[#52647b]">
                      <svg aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[#a48700]" fill="none" viewBox="0 0 24 24">
                        <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
                      </svg>
                      <span>{location.address}</span>
                    </span>
                    {location.phone && (
                      <span className="mt-2 flex items-center gap-2 text-sm font-semibold tabular-nums text-[#092a53]">
                        <svg aria-hidden="true" className="size-4 shrink-0 text-[#092a53]" fill="none" viewBox="0 0 24 24">
                          <path d="M5 4h3.5l1.7 4.2-2.2 1.4a11 11 0 0 0 6.4 6.4l1.4-2.2L20 15.5V19a1.5 1.5 0 0 1-1.6 1.5C10.6 20 4 13.4 3.5 5.6A1.5 1.5 0 0 1 5 4Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
                        </svg>
                        {location.phone}
                      </span>
                    )}
                    <span className="mt-auto block pt-5">
                      <span className="flex w-full items-center justify-center gap-1.5 rounded-full bg-[#092a53] px-3 py-2.5 text-xs font-extrabold text-white shadow-[0_8px_16px_rgba(9,42,83,0.16)] transition duration-200 group-hover:bg-[#ffdc32] group-hover:text-[#092a53]">
                        {t("Directions")}
                        <span className="transition duration-200 group-hover:translate-x-0.5">
                          <ArrowIcon diagonal />
                        </span>
                        <span className="sr-only">{t("Opens in Google Maps")}</span>
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {!promoBarVisible && (
          <section aria-label={t("Buy 2 scoops, get the 3rd free")} className="bg-white px-5 pb-12 sm:px-8 lg:px-10">
            <div className="mx-auto flex max-w-[1320px] flex-col gap-6 rounded-[28px] bg-[linear-gradient(100deg,#04162e_0%,#092a53_38%,#1e5a9a_100%)] p-6 text-white sm:flex-row sm:items-center sm:gap-8 sm:p-8">
              <div aria-hidden="true" className="flex shrink-0 items-center gap-2">
                <span className="grid size-12 place-items-center rounded-full bg-[#ffdc32] font-display text-xl font-extrabold text-[#092a53]">2</span>
                <span className="font-display text-2xl font-extrabold text-white/40">+</span>
                <span className="grid size-12 place-items-center rounded-full font-display text-xl font-extrabold text-[#ffdc32] ring-2 ring-[#ffdc32]">1</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-2xl font-extrabold leading-tight tracking-tight sm:text-[1.7rem]">
                  {t("Buy 2 scoops, get the 3rd free")}
                </p>
                <p className="mt-1 max-w-xl text-sm leading-6 text-white/70">
                  {t("Pick any three scoops and the lowest-priced one is on us.")}
                </p>
              </div>
              <Link
                className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full bg-[#ffdc32] px-5 py-3 text-sm font-extrabold text-[#092a53] shadow-[0_8px_18px_rgba(0,0,0,0.18)] transition duration-200 hover:bg-[#ffe76c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32] focus-visible:ring-offset-2 focus-visible:ring-offset-[#092a53] motion-safe:hover:-translate-y-0.5"
                to="/flavors"
              >
                {t("Explore flavors")}
                <ArrowIcon />
              </Link>
            </div>
          </section>
        )}

        <section
          aria-labelledby="popular-flavors-heading"
          className="relative isolate overflow-hidden bg-[#fbfaf5] px-5 pb-20 pt-12 sm:px-8 sm:pb-24 sm:pt-14 lg:px-10 lg:pb-28 lg:pt-16"
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
                <p className="mt-4 max-w-xl text-base leading-7 text-[#52647b]">
                  {t("Our most-loved signature creations, mixed to order on the frozen stone.")}
                </p>
              </div>
              <Link
                className="inline-flex shrink-0 items-center gap-2 self-start rounded-full bg-[#092a53] px-6 py-3.5 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(9,42,83,0.2)] transition hover:-translate-y-0.5 hover:bg-[#163e6b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2 md:self-auto"
                to={`/menu?category=${encodeURIComponent("Ice Cream")}`}
              >
                {t("View all")} <ArrowIcon />
              </Link>
            </div>

            <div className="mt-12 grid gap-5 lg:grid-cols-12 lg:gap-6">
              {popularFlavors.map((item, index) => {
                const soldOut = item.isAvailable === false || item.availableQuantity < 1;
                const featured = index === 0;
                const itemKey = item.id || item.name;
                const added = addedItemKey === itemKey;
                const rank = String(index + 1).padStart(2, "0");
                const itemLink = `/menu?category=${encodeURIComponent("Ice Cream")}`;
                const bagIcon = added ? (
                  <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
                    <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
                  </svg>
                ) : !soldOut ? (
                  <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
                    <path d="M5 8h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9L5 8Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
                    <path d="M9 8V6.5a3 3 0 0 1 6 0V8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
                  </svg>
                ) : null;
                const image = (
                  <img decoding="async"
                    alt=""
                    className={`size-full object-cover transition duration-700 ease-out group-hover:scale-[1.06] ${soldOut ? "grayscale-[60%]" : ""}`}
                    loading="lazy"
                    onError={photoErrorHandler(item.image, "/images/hero-ice-cream.jpg")}
                    sizes={featured ? "(min-width: 1024px) 40vw, 100vw" : "(min-width: 1024px) 25vw, 50vw"}
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
                      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-[#061d3a] via-[#061d3a]/55 via-40% to-transparent" />
                      <span className="absolute left-6 top-6 flex items-center gap-2 sm:left-8 sm:top-8">
                        <span className="grid size-12 place-items-center rounded-2xl bg-[#ffdc32] font-display text-base font-extrabold tabular-nums text-[#092a53] shadow-lg">
                          {rank}
                        </span>
                        <span className={`rounded-full px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] shadow-sm backdrop-blur-sm ${soldOut ? "bg-white/95 text-red-700" : "bg-white/90 text-[#092a53]"}`}>
                          {soldOut ? t("Sold out") : t("Popular pick")}
                        </span>
                      </span>

                      <h3 className="font-display text-3xl font-extrabold leading-tight sm:text-4xl">
                        <Link
                          className="after:absolute after:inset-0 after:rounded-[32px] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-[#ffdc32]"
                          to={itemLink}
                        >
                          {t(item.name)}
                        </Link>
                      </h3>
                      <p className="mt-2 max-w-md text-sm leading-6 text-white/75 sm:text-base sm:leading-7">{t(item.detail)}</p>
                      <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-white/15 pt-5">
                        <div>
                          <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-white/55">{t("Price")}</p>
                          <p className="mt-0.5 whitespace-nowrap font-display text-2xl font-extrabold tabular-nums text-[#ffdc32] sm:text-3xl">
                            {formatPrice(item.priceXaf)}
                          </p>
                        </div>
                        <button
                          aria-label={soldOut ? t("Sold out") : t("Add {name} to your bag", { name: t(item.name) })}
                          className={`relative z-10 inline-flex items-center gap-2 whitespace-nowrap rounded-full px-6 py-3.5 text-sm font-extrabold transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#092a53] disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/60 ${
                            added ? "bg-[#4caf50] text-white" : "bg-[#ffdc32] text-[#092a53] hover:-translate-y-0.5 hover:bg-white"
                          }`}
                          disabled={soldOut}
                          onClick={() => handleAddToCart(item)}
                          type="button"
                        >
                          {bagIcon}
                          {soldOut ? t("Sold out") : added ? t("Added") : t("Add to bag")}
                        </button>
                      </div>
                    </article>
                  );
                }

                return (
                  <article
                    className="group relative flex items-center gap-4 rounded-[24px] bg-white p-3 pr-4 shadow-[0_1px_0_rgba(9,42,83,0.04),0_8px_24px_rgba(9,42,83,0.06)] ring-1 ring-[#ebe7dc] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_44px_rgba(9,42,83,0.12)] hover:ring-[#e2d39a] sm:gap-5 sm:p-4 sm:pr-5 lg:col-span-7"
                    key={itemKey}
                  >
                    <span aria-hidden="true" className="hidden w-10 shrink-0 text-center font-display text-3xl font-extrabold tabular-nums text-[#092a53]/15 transition group-hover:text-[#bd9c00] sm:block">
                      {rank}
                    </span>
                    <div
                      className="relative size-20 shrink-0 overflow-hidden rounded-[18px] sm:size-24"
                      style={{ backgroundColor: popularFlavorColors[index] }}
                    >
                      {image}
                      <span aria-hidden="true" className="absolute left-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-[#092a53] font-display text-[10px] font-extrabold tabular-nums text-[#ffdc32] sm:hidden">
                        {index + 1}
                      </span>
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
                      <p className="mt-1 line-clamp-1 text-xs leading-5 text-[#65748a] sm:text-sm sm:leading-6">{t(item.detail)}</p>
                      <p className="mt-1.5 whitespace-nowrap font-display text-sm font-extrabold tabular-nums text-[#8a7000] sm:hidden">
                        {soldOut ? t("Sold out") : formatPrice(item.priceXaf)}
                      </p>
                    </div>
                    <div className="hidden shrink-0 text-right sm:block">
                      <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#65748a]">
                        {soldOut ? t("Sold out") : t("Price")}
                      </p>
                      <p className="mt-0.5 whitespace-nowrap font-display text-lg font-extrabold tabular-nums text-[#092a53]">
                        {formatPrice(item.priceXaf)}
                      </p>
                    </div>
                    <button
                      aria-label={soldOut ? t("Sold out") : added ? t("Added") : t("Add {name} to your bag", { name: t(item.name) })}
                      className={`relative z-10 grid size-11 shrink-0 place-items-center rounded-full transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#efece3] disabled:text-[#65748a] sm:size-12 ${
                        added ? "bg-[#4caf50] text-white" : "bg-[#ffdc32] text-[#092a53] hover:-translate-y-0.5 hover:bg-[#092a53] hover:text-white"
                      }`}
                      disabled={soldOut}
                      onClick={() => handleAddToCart(item)}
                      title={soldOut ? t("Sold out") : t("Add to bag")}
                      type="button"
                    >
                      {bagIcon || (
                        <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
                          <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                        </svg>
                      )}
                    </button>
                  </article>
                );
              })}
            </div>

            {menuError && (
              <p className="mt-6 text-xs text-[#65748a]" role="status">
                {t("Menu availability could not be refreshed")}: {menuError}
              </p>
            )}
            <p aria-live="polite" className={cartNotice && cartNoticeIsError ? "mt-6 text-sm font-semibold text-red-700" : "sr-only"}>
              {cartNotice}
            </p>
          </div>
        </section>

        <section
          aria-labelledby="home-menu-heading"
          className="bg-[#092a53] px-5 py-10 text-white sm:px-8 sm:py-12 lg:px-10"
        >
          <div className="mx-auto max-w-[1320px]">
            <div className="flex items-center justify-between gap-4">
              <h2
                className="font-display text-3xl font-extrabold leading-none tracking-tight sm:text-4xl"
                id="home-menu-heading"
              >
                {t("Menu highlights")}
              </h2>
              <Link
                className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#ffdc32] px-5 py-3 text-sm font-extrabold text-[#092a53] transition hover:bg-[#ffe76c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32] focus-visible:ring-offset-2 focus-visible:ring-offset-[#092a53]"
                to="/menu"
              >
                {t("View menu guide")} <ArrowIcon />
              </Link>
            </div>

            <ul className="-mx-5 mt-8 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 sm:mx-0 sm:gap-4 sm:px-0 lg:grid lg:grid-cols-6 lg:overflow-visible">
              {coldStoneMenuCategories.map((category) => (
                <li className="w-[7.25rem] shrink-0 snap-start sm:w-36 lg:w-auto" key={category.title}>
                  <Link
                    className="group flex h-full flex-col items-center rounded-3xl px-1 py-2 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32] focus-visible:ring-offset-4 focus-visible:ring-offset-[#092a53]"
                    to={`/menu?category=${encodeURIComponent(category.title)}`}
                  >
                    <span className="rounded-full bg-[#ffdc32] p-1 shadow-[0_10px_24px_rgba(0,0,0,0.25)] transition group-hover:bg-white">
                      <img
                        alt=""
                        className="size-[5.5rem] rounded-full object-cover sm:size-28"
                        decoding="async"
                        loading="lazy"
                        onError={photoErrorHandler(category.image)}
                        sizes="112px"
                        src={thumbnail(category.image, "small")}
                      />
                    </span>
                    <span className="mt-3 font-display text-sm font-extrabold leading-tight text-white sm:text-base">
                      {t(category.title)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-label={t("About us")} className="bg-[#fbfaf5] px-5 py-8 sm:px-8 lg:px-10">
          <div className="mx-auto flex max-w-[1320px] flex-col items-start justify-between gap-4 border-t border-[#e9e5da] pt-8 sm:flex-row sm:items-center">
            <p className="max-w-2xl text-base leading-7 text-[#52647b]">
              {t("Discover Cold Stone ice cream, signature creations, and the mix-ins that make every scoop a little more special.")}
            </p>
            <Link
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#092a53] px-6 py-3.5 text-sm font-extrabold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#163e6b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2"
              to="/about"
            >
              {t("Discover our story")} <ArrowIcon />
            </Link>
          </div>
        </section>

        {/* Always shown: the reviews, or an invitation to write the first one. */}
        <div aria-hidden="true" className="h-px" ref={reviewsSentinel} />
        <ReviewsSection error={reviewsError} isLoaded={reviewsLoaded} language={language} reviews={reviews} stats={reviewStats} t={t} />
      </main>
      <Footer />
    </div>
  );
}
