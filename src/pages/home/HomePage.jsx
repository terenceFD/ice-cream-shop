import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Footer, Header, ArrowIcon } from "../../components/Layout";
import { initialPromotionIsVisible } from "../../lib/promotion";
import { HeroBackground } from "../../components/HeroBackground";
import { useCart } from "../../context/useCart";
import { apiRequest } from "../../api/api";
import { coldStoneMenuCategories, getMenuItemId } from "../../../shared/data";
import { useLanguage } from "../../language/useLanguage";
import { photoErrorHandler, photoSrcSet, thumbnail } from "../../lib/thumbnails";
import { HOME_SLIDE_SIZES } from "../../../shared/photoSizes.js";
import { numberFormatter } from "../../lib/cartPricing";

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
const flavorInspiration = [
  {
    id: "strawberry",
    title: "Strawberry daydream",
    detail: "Berry-bright · soft & sweet",
    mood: "fruit",
    category: "Ice Cream",
    item: "Our Strawberry Blonde",
    image: "/menu-official/ice-cream/signature-creations/our-strawberry-blonde.webp",
    color: "#f7c8d9",
  },
  {
    id: "mango",
    title: "Mango sunshine",
    detail: "Tropical · golden & juicy",
    mood: "fruit",
    category: "Milkshakes & Smoothies",
    item: "Mango Pineapple Smoothie",
    image: "/menu-official/milkshakes-fruit-smoothies/smoothies/mango-pineapple.webp",
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
    image: "/menu-official/ice-cream/signature-creations/cookie-doughnt-you-want-some.webp",
    color: "#ded0ef",
  },
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
    primaryCta: "Order ice cream",
    primaryTo: "/menu?category=Ice%20Cream",
    secondaryCta: "Explore flavors",
    secondaryTo: "/flavors",
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
    primaryCta: "Order a cake",
    primaryTo: "/custom-cake",
    secondaryCta: "Explore the menu",
    secondaryTo: "/menu?category=Ice%20Cream%20Cakes%20and%20Pies",
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
  return (
    <li>
      <article className="group relative flex h-full flex-col rounded-2xl border border-[#e6ebf1] bg-gradient-to-b from-white to-[#fbfaf6] p-6 shadow-[0_1px_2px_rgba(9,42,83,0.04),0_12px_32px_rgba(9,42,83,0.06)] transition duration-300 hover:-translate-y-1 hover:border-[#d3dce5] hover:shadow-[0_2px_4px_rgba(9,42,83,0.05),0_24px_48px_rgba(9,42,83,0.12)] sm:p-7">
        <span aria-hidden="true" className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#e2c520] to-transparent opacity-60" />
        <div className="flex items-center justify-between gap-3">
          <StarRating
            className="size-3.5"
            emptyClassName="text-[#e5e9ef]"
            filledClassName="text-[#e2b100]"
            label={t("{rating} out of 5 stars", { rating: review.rating })}
            value={Number(review.rating) || 0}
          />
          {review.demo && (
            <span className="rounded-full border border-[#f0dda0] bg-[#fffdf2] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#8a741a]">{t("Demo")}</span>
          )}
        </div>
        <div className="mt-4 flex-1">
          {text ? (
            <blockquote className={`max-w-3xl whitespace-pre-line text-[15px] leading-[1.85] text-[#3a4a5f] ${isLong && !expanded ? "line-clamp-4" : ""}`}>
              <span aria-hidden="true" className="float-left mr-2 font-display text-[2.8rem] font-extrabold leading-[0.68] text-[#e8c62a]/80">{openQuote}</span>
              {text}
            </blockquote>
          ) : (
            <p className="text-sm italic leading-7 text-[#7b8794]">{t("No written comment.")}</p>
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
        <footer className="mt-6 flex items-center gap-3 border-t border-[#eef1f5] pt-5">
          <ReviewerAvatar className="ring-2 ring-[#ffdc32]/40 size-11 text-sm" name={customerName} picture={review.profilePicture} />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[#0d2c4e]">{customerName}</p>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs font-medium text-[#6e7a89]">
              {review.itemName ? t(review.itemName) : t("Verified purchase")}
              {date && <span aria-hidden="true" className="text-[#b6bfca]">·</span>}
              {date}
            </p>
          </div>
          <span aria-hidden="true" className="ml-auto font-display text-2xl leading-none text-[#e8c62a]/35 group-hover:text-[#e8c62a]/60 transition-colors">”</span>
        </footer>
      </article>
    </li>
  );
}

function ReviewsSection({ reviews, stats, error, isLoaded, language, t }) {
  // Wait for the answer, so the "no reviews yet" message never flashes before real reviews.
  if (!isLoaded) return null;
  const hasReviews = reviews.length > 0;
  // Social proof must always represent verified customer data, never placeholders.
  if (!hasReviews) return null;
  const displayReviews = reviews;
  const average = stats.average;
  const roundedAverage = Math.round(average * 10) / 10;
  const count = stats.count;
  const distribution = stats.distribution || {};
  const busiest = Math.max(1, ...[1, 2, 3, 4, 5].map((stars) => distribution[stars] || 0));
  return (
    <section aria-labelledby="real-reviews-heading" className="relative isolate overflow-hidden bg-white px-5 py-16 sm:px-8 sm:py-20 lg:px-10 lg:py-24">
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-6 rounded-t-[100%] bg-[#fbfaf5]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#dde4ec] to-transparent" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(9,42,83,0.045),transparent_42%)]" />
      <div className="relative mx-auto max-w-[1320px]">
        <div className="grid gap-8 lg:items-end lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.75fr)]">
          <div className="max-w-xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#e2e8ee] bg-[#f7f9fb] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#4a6282]">
              <VerifiedIcon className="size-4 text-[#2f8f4e]" />
              {t("Verified purchases only")}
            </p>
            <h2 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-[#092a53] sm:text-5xl lg:text-[3.5rem]" id="real-reviews-heading">
              {t("Real Reviews")}
            </h2>
            <p className="mt-4 max-w-md text-base leading-7 text-[#5b6d84]">
              {t("Honest feedback from customers who ordered and tasted it themselves.")}
            </p>
          </div>
          <div className="mx-auto grid w-full max-w-md gap-6 overflow-hidden rounded-2xl bg-[#0b2e55] p-6 text-white shadow-[0_1px_2px_rgba(9,42,83,0.2),0_20px_44px_rgba(9,42,83,0.18)] sm:grid-cols-[minmax(8.5rem,0.7fr)_minmax(0,1.3fr)] sm:p-7 lg:mx-0 lg:w-auto">
              <div className="flex flex-col justify-center">
                <p className="font-display text-6xl font-extrabold leading-none tabular-nums tracking-tight">{roundedAverage.toFixed(1)}</p>
                <div className="mt-3">
                  <StarRating
                    className="size-3.5"
                    emptyClassName="text-white/25"
                    filledClassName="text-[#ffdc32]"
                    label={t("{rating} out of 5 stars", { rating: roundedAverage.toFixed(1) })}
                    value={average}
                  />
                </div>
                <p className="mt-2 text-sm font-medium text-white/70">
                  {t(count === 1 ? "Based on 1 review" : "Based on {count} reviews", { count })}
                </p>
              </div>
              <ol className="grid content-center gap-2.5 border-t border-white/15 pt-5 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
                {[5, 4, 3, 2, 1].map((stars) => {
                  const bucket = distribution[stars] || 0;
                  return (
                    <li
                      aria-label={t("{count} reviews with {stars} stars", { count: bucket, stars })}
                      className="grid grid-cols-[1.25rem_minmax(0,1fr)_1.25rem] items-center gap-2.5"
                      key={stars}
                    >
                      <span className="text-xs font-bold tabular-nums text-white/75">{stars}</span>
                      <span className="h-2 overflow-hidden rounded-full bg-white/15">
                        <span
                          className="block h-full rounded-full bg-[#ffdc32]"
                          style={{ width: `${(bucket / busiest) * 100}%` }}
                        />
                      </span>
                      <span className="text-right text-xs font-medium tabular-nums text-white/60">{bucket}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
        </div>

        {error ? (
          <p className="mt-8 rounded-2xl border border-[#e6ebf1] bg-[#f9fbfd] px-5 py-4 text-base leading-7 text-[#52647b]" role="status">
            {t("Customer reviews could not be loaded")}: {error}
          </p>
        ) : (
          <ul className={`mt-10 grid items-stretch gap-5 ${displayReviews.length >= 3 ? "md:grid-cols-2 xl:grid-cols-3" : displayReviews.length === 2 ? "md:grid-cols-2" : "max-w-2xl"}`}>
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
  const [selectedFlavorMood, setSelectedFlavorMood] = useState("all");
  const [loadedSlides, setLoadedSlides] = useState([0]);
  const [addedItemKey, setAddedItemKey] = useState(null);
  const [cartNoticeIsError, setCartNoticeIsError] = useState(false);
  const addedTimer = useRef(undefined);
  const reviewsSentinel = useRef(null);
  const popularSection = useRef(null);
  const [promoBarVisible, setPromoBarVisible] = useState(initialPromotionIsVisible);

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
    const node = popularSection.current;
    if (!node) return undefined;
    let cancelled = false;
    // The cards are already drawn from the built-in menu. Stock is loaded when this section
    // is near the screen, so it does not compete with the hero photo.
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
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
    }, { rootMargin: "400px" });
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
          <HeroBackground animated={false} variant="navy" />

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
                    to={homeSlides[activeSlide].primaryTo}
                  >
                    {t(homeSlides[activeSlide].primaryCta)} <ArrowIcon />
                  </Link>
                  <Link
                    className="hidden items-center gap-2 rounded-full border border-white/25 px-7 py-4 text-sm font-extrabold text-white transition hover:-translate-y-0.5 hover:border-white hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#092a53] sm:inline-flex"
                    to={homeSlides[activeSlide].secondaryTo}
                  >
                    {t(homeSlides[activeSlide].secondaryCta)} <ArrowIcon diagonal />
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

          {/* Trust strip */}
          <div aria-label={t("Why people love us")} className="relative">
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
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
                <span className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/50">
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#ffdc32]" />
                  {t("Pickup or delivery in Douala and Yaoundé.")}
                </span>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {[
                  {
                    value: t("5 shops"),
                    label: t("Across Cameroon"),
                    icon: "M12 21s-7-4.6-7-10a7 7 0 0 1 14 0c0 5.4-7 10-7 10Zm0-7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
                  },
                  {
                    value: t("Pickup"),
                    label: t("Or delivery where available"),
                    icon: "M5 8h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9L5 8Z",
                  },
                  {
                    value: "EN · FR",
                    label: t("Shop in your language"),
                    icon: "M12 2.75l2.83 5.74 6.33.92-4.58 4.47 1.08 6.3L12 17.2l-5.66 2.98 1.08-6.3-4.58-4.47 6.33-.92L12 2.75Z",
                  },
                ].map((stat) => (
                  <div
                    className="group relative flex h-full items-center gap-4 overflow-hidden rounded-3xl bg-white/[0.05] px-6 py-6 ring-1 ring-white/10 backdrop-blur-md transition duration-300 hover:-translate-y-0.5 hover:bg-white/[0.09] hover:ring-[#ffdc32]/45 focus-within:ring-[#ffdc32]/45"
                    key={stat.label}
                  >
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute -right-10 -top-10 size-24 rounded-full bg-[radial-gradient(closest-side,rgb(255_220_50/0.14),transparent)] opacity-0 transition duration-500 group-hover:opacity-100"
                    />
                    <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#ffdc32]/15 text-[#ffdc32] ring-1 ring-[#ffdc32]/25 transition duration-300 group-hover:scale-105 group-hover:bg-[#ffdc32]/25">
                      <svg className="size-5" fill={stat.icon.startsWith("m5") ? "none" : "currentColor"} viewBox="0 0 24 24">
                        <path d={stat.icon} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={stat.icon.startsWith("m5") ? 2.4 : 0} />
                      </svg>
                    </span>
                    <span className="flex flex-col">
                      <span className="font-display text-2xl font-extrabold tabular-nums text-white">
                        {stat.value}
                        {stat.value === "4.9" && <span className="text-[#ffdc32]">★</span>}
                      </span>
                      <span className="text-xs font-semibold leading-4 text-white/70">{stat.label}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="flavor-inspiration-heading" className="relative overflow-hidden bg-[#fff9ed] px-5 py-16 text-[#4b2869] sm:px-8 sm:py-20 lg:px-10 lg:py-24">
          <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-48 size-[32rem] rounded-full bg-[radial-gradient(closest-side,rgb(255_224_176/0.35),transparent)]" />
          <div className="relative mx-auto max-w-[1320px]">
            <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#60417a]">
                  {t("Follow your flavor")}
                </p>
                <h2 className="mt-4 max-w-[650px] font-display text-4xl font-extrabold leading-[1.02] tracking-tight text-[#4b2869] sm:text-5xl lg:text-6xl" id="flavor-inspiration-heading">
                  {t("What’s your kind of happy?")}
                </h2>
              </div>
              <div className="max-w-[310px] lg:mb-1">
                <p className="text-base leading-7 text-[#685b70]">
                  {t("Fruity, chocolatey or beautifully classic. Let your cravings lead the way.")}
                </p>
                <Link
                  className="group mt-4 inline-flex min-h-12 items-center gap-3 rounded-full border border-[#806794] px-6 py-3 text-sm font-bold text-[#4b2869] transition hover:bg-[#4b2869] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4b2869] focus-visible:ring-offset-2"
                  to="/flavors"
                >
                  {t("Explore all flavors")}
                  <svg aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" fill="none" viewBox="0 0 24 24">
                    <path d="M7 17 17 7M8 7h9v9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                  </svg>
                </Link>
              </div>
            </div>

            <div aria-label={t("Filter flavor inspiration")} className="mt-8 flex flex-wrap gap-2.5" role="group">
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
                    className={`min-h-11 rounded-full border px-5 py-2.5 text-[13px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4b2869] focus-visible:ring-offset-2 ${
                      selected
                        ? "border-[#542b70] bg-[#542b70] text-white shadow-[0_6px_16px_rgba(84,43,112,0.18)]"
                        : "border-[#e5dcd0] bg-transparent text-[#59466b] hover:border-[#806794] hover:bg-white/70"
                    }`}
                    key={mood}
                    onClick={() => setSelectedFlavorMood(mood)}
                    type="button"
                  >
                    {t(label)}
                  </button>
                );
              })}
            </div>

            <ul className="mt-8 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
              {flavorInspiration
                .filter((flavor) => selectedFlavorMood === "all" || flavor.mood === selectedFlavorMood)
                .map((flavor) => (
                  <li className="min-w-0" key={flavor.id}>
                    <Link
                      className="group block h-full overflow-hidden rounded-[26px] bg-white shadow-[0_10px_30px_rgba(75,40,105,0.08)] ring-1 ring-[#4b2869]/[0.06] transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_42px_rgba(75,40,105,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4b2869] focus-visible:ring-offset-4"
                      style={{ backgroundColor: flavor.color }}
                      to={`/menu?${new URLSearchParams({ category: flavor.category, item: flavor.item })}`}
                    >
                      <div className="aspect-[4/3] overflow-hidden bg-[#f0e8dc]">
                        <img
                          alt={t(flavor.title)}
                          className="size-full object-cover transition duration-500 ease-out group-hover:scale-[1.04]"
                          decoding="async"
                          loading="lazy"
                          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                          src={flavor.image}
                        />
                      </div>
                      <div className="flex min-h-[112px] items-start justify-between gap-3 px-5 py-4 sm:px-6 sm:py-5">
                        <span className="min-w-0">
                          <span className="block font-display text-xl font-extrabold leading-tight text-[#4b2869] sm:text-2xl">
                            {t(flavor.title)}
                          </span>
                          <span className="mt-2 block text-xs font-medium leading-5 text-[#65536d] sm:text-[13px]">
                            {t(flavor.detail)}
                          </span>
                        </span>
                        <svg aria-hidden="true" className="mt-1 size-4 shrink-0 text-[#4b2869] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" fill="none" viewBox="0 0 24 24">
                          <path d="M7 17 17 7M8 7h9v9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                        </svg>
                      </div>
                    </Link>
                  </li>
                ))}
            </ul>
            <p className="mt-8 text-xs leading-5 text-[#827889]">
              {t("A little flavor inspiration. Discover the current selection in store.")}
            </p>
          </div>
        </section>


        <section
          aria-labelledby="popular-flavors-heading"
          className="relative isolate overflow-hidden bg-[#fbfaf5] px-5 pb-20 pt-12 sm:px-8 sm:pb-24 sm:pt-14 lg:px-10 lg:pb-28 lg:pt-16"
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
                  <span>{t("Our most-loved signature creations, mixed to order on the frozen stone.")}</span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#fff8d6] px-3 py-1 text-xs font-bold text-[#8a7000] ring-1 ring-[#f0dfa0]">
                    <span aria-hidden="true">✦</span> {t("Frozen stone special")}
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
          aria-labelledby="sunshine-heading"
          className="relative isolate overflow-hidden bg-[linear-gradient(120deg,#fbdf9a_0%,#f7c87e_45%,#f3b25e_100%)] px-5 py-14 sm:px-8 sm:py-16 lg:px-10 lg:py-20"
        >
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center">
            <span className="font-display whitespace-nowrap text-[18vw] font-extrabold leading-none tracking-tight text-white/25 select-none sm:text-[16vw]">
              SUNSHINE
            </span>
          </div>
          <div className="relative mx-auto grid max-w-[1320px] items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="relative">
              <div
                aria-hidden="true"
                className="absolute bottom-0 left-1/2 h-[42%] w-[78%] -translate-x-1/2 rounded-[50%] bg-[#e28c3f]/60 blur-[2px]"
              />
              <img
                alt={t("Golden mango ice cream in a glass sundae dish with fresh mango slices")}
                className="relative mx-auto max-h-[420px] w-auto max-w-full rounded-2xl object-contain mix-blend-multiply"
                decoding="async"
                loading="lazy"
                src="/images/mango.jpg"
              />
            </div>
            <div className="max-w-xl">
              <p className="text-xs font-extrabold uppercase tracking-[0.25em] text-[#5b2d8f]">
                {t("A tropical scoop of vibe")}
              </p>
              <h2
                className="mt-4 font-display text-5xl font-extrabold leading-[1.02] tracking-tight text-[#5b2d8f] sm:text-6xl"
                id="sunshine-heading"
              >
                {t("Hello, sunshine.")}
              </h2>
              <p className="mt-6 text-base leading-7 text-[#6b3fa0]">
                {t("Golden mango. A cool, creamy scoop. And a little daydream of somewhere sunny. This is your cue to take a sweet escape.")}
              </p>
              <Link
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#5b2d8f] px-7 py-3.5 text-sm font-extrabold text-white shadow-[0_12px_28px_rgba(91,45,143,0.35)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#4a2378] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b2d8f] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7c87e]"
                to="/menu?category=Ice%20Cream"
              >
                {t("Find your fruity mood")}
                <ArrowIcon />
              </Link>
              <p className="mt-5 text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#6b3fa0]">
                {t("Mango only, migrating constantly")}
              </p>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="lick-heading"
          className="relative isolate overflow-hidden bg-[#e9f4f3] px-5 pb-14 sm:px-8 sm:pb-16 lg:px-10 lg:pb-20"
        >
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-px h-24">
            <svg
              className="block h-full w-full"
              viewBox="0 0 1440 96"
              preserveAspectRatio="none"
              fill="#f3b25e"
            >
              <path d="M0 0h1440v30c-120 34-240 52-380 52-150 0-270-30-420-52-140-20-260-8-380 14-100 19-200 32-260 36Z" />
            </svg>
          </div>
          <div className="relative mx-auto mt-28 max-w-[1320px] sm:mt-32">
            <div className="grid items-end gap-8 lg:grid-cols-2 lg:gap-16">
              <div className="max-w-xl">
                <p className="text-xs font-extrabold uppercase tracking-[0.25em] text-[#5b2d8f]">
                  {t("Your happy, your way")}
                </p>
                <h2
                  className="mt-4 font-display text-5xl font-extrabold leading-[1.02] tracking-tight text-[#5b2d8f] sm:text-6xl"
                  id="lick-heading"
                >
                  {t("Pick it. Lick it. Love it.")}
                </h2>
              </div>
              <div className="max-w-xl lg:justify-self-end">
                <p className="text-base leading-7 text-[#6b3fa0]">
                  {t("A cone for the stroll. A cup for the pause. A scoop to share.")}
                </p>
                <Link
                  className="group mt-4 inline-flex items-center gap-2 rounded-full bg-[#5b2d8f] px-7 py-3.5 text-sm font-extrabold text-white shadow-[0_12px_28px_rgba(91,45,143,0.35)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#4a2378] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b2d8f] focus-visible:ring-offset-2 focus-visible:ring-offset-[#e9f4f3]"
                  to="/menu?category=Ice%20Cream"
                >
                  {t("Find your fruity mood")}
                  <ArrowIcon />
                </Link>
              </div>
            </div>
            <ul className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-7">
              {[
                { image: "/ice-images/ice-5.webp", key: "Chocolate-dipped cones" },
                { image: "/ice-images/ice-8.webp", key: "Cups with a swirl" },
                { image: "/ice-images/ice-10.jpg", key: "Crunchy waffle cones" },
                { image: "/ice-images/ice-9.jpg", key: "Pints to go" },
              ].map(({ image, key }, index) => (
                <li
                  className="group relative"
                  key={key}
                >
                  {/* Hover lift + glow behind the card */}
                  <div
                    aria-hidden="true"
                    className="absolute inset-x-4 bottom-0 top-6 rounded-[26px] bg-[#5b2d8f]/25 blur-2xl opacity-0 transition duration-500 group-hover:opacity-100"
                  />
                  <div className="relative rounded-[26px] bg-white p-3 pb-0 shadow-[0_6px_20px_rgba(91,45,143,0.10)] ring-1 ring-[#5b2d8f]/10 transition duration-500 ease-out group-hover:-translate-y-2 group-hover:shadow-[0_22px_44px_rgba(91,45,143,0.22)] group-hover:ring-[#5b2d8f]/25">
                    <div className="relative aspect-[4/5] overflow-hidden rounded-[18px] bg-[#f6f1fb]">
                      <img
                        alt={t(key)}
                        className="size-full object-cover transition duration-700 ease-out group-hover:scale-[1.07]"
                        decoding="async"
                        loading="lazy"
                        src={image}
                      />
                      {/* Soft sheen sweeping across on hover */}
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 -translate-x-full bg-[linear-gradient(115deg,transparent_30%,rgb(255_255_255/0.35)_50%,transparent_70%)] transition-transform duration-1000 ease-out group-hover:translate-x-full"
                      />
                      {/* Numbered badge */}
                      <span className="absolute left-3 top-3 grid size-9 place-items-center rounded-full bg-white/90 font-display text-sm font-extrabold text-[#5b2d8f] shadow-[0_4px_12px_rgba(91,45,143,0.18)] backdrop-blur-sm">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 px-3 py-4">
                      <p className="font-display text-lg font-extrabold leading-tight text-[#5b2d8f]">
                        {t(key)}
                      </p>
                      <span
                        aria-hidden="true"
                        className="grid size-8 shrink-0 place-items-center rounded-full bg-[#f3ecfb] text-[#5b2d8f] transition duration-300 group-hover:bg-[#5b2d8f] group-hover:text-white"
                      >
                        <ArrowIcon />
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {!promoBarVisible && (
          <section aria-label={t("Buy 2 scoops, get the 3rd free")} className="bg-[#fbfaf5] px-5 pb-14 sm:px-8 lg:px-10">
            <div className="relative mx-auto max-w-[1320px] overflow-hidden rounded-[28px] bg-[linear-gradient(105deg,#041528_0%,#092a53_42%,#14467c_78%,#1e5a9a_100%)] px-6 py-8 text-white shadow-[0_24px_60px_rgba(9,42,83,0.28)] sm:px-10 sm:py-10">
              {/* Decorative layers */}
              <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                <div className="hero-grid absolute inset-0 [background-image:radial-gradient(rgb(255_255_255/0.05)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:linear-gradient(105deg,transparent_30%,black_100%)]" />
                <div className="hero-blob-a absolute -right-32 -top-40 size-[30rem] rounded-full bg-[radial-gradient(closest-side,rgb(255_220_50/0.16),rgb(255_220_50/0.16)_35%,transparent)]" />
                <div className="hero-blob-b absolute -bottom-44 -left-24 size-[26rem] rounded-full bg-[radial-gradient(closest-side,rgb(94_164_234/0.22),rgb(94_164_234/0.22)_35%,transparent)]" />
                {[
                  { left: "70%", top: "18%", size: 13, delay: "-0.8s", duration: "3.6s", color: "#ffdc32" },
                  { left: "82%", top: "64%", size: 10, delay: "-2.4s", duration: "4.2s", color: "#ffffff" },
                  { left: "91%", top: "30%", size: 9, delay: "-1.5s", duration: "3.9s", color: "#ff8ab5" },
                  { left: "58%", top: "80%", size: 8, delay: "-3.5s", duration: "4.5s", color: "#ffdc32" },
                ].map((star, index) => (
                  <svg
                    className="hero-star absolute"
                    key={index}
                    style={{
                      left: star.left,
                      top: star.top,
                      width: star.size,
                      height: star.size,
                      color: star.color,
                      animationDelay: star.delay,
                      animationDuration: star.duration,
                    }}
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M12 2c.6 5.4 2 8 4.6 9.4C19.2 12.8 20.4 13.2 22 13.5c-5.4.6-8 2-9.4 4.6C11.2 20.7 10.8 21.9 10.5 23.5c-.6-5.4-2-8-4.6-9.4C3.4 12.7 2.2 12.3.6 12c5.4-.6 8-2 9.4-4.6C11.4 5.9 11.8 4.7 12 2Z"
                      fill="currentColor"
                    />
                    <circle cx="12" cy="12" r="1.6" fill="currentColor" />
                  </svg>
                ))}
              </div>

              {/* Content */}
              <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="grid size-14 place-items-center rounded-2xl bg-[#ffdc32] font-display text-2xl font-extrabold tabular-nums text-[#092a53] shadow-[0_10px_24px_rgba(255,220,50,0.35)]">2</span>
                  <span aria-hidden="true" className="font-display text-2xl font-extrabold text-white/35">+</span>
                  <span className="grid size-14 place-items-center rounded-2xl font-display text-2xl font-extrabold tabular-nums text-[#ffdc32] ring-2 ring-[#ffdc32]/80">1</span>
                  <span aria-hidden="true" className="ml-1.5 font-display text-2xl font-extrabold text-white/35">=</span>
                  <span className="grid h-14 place-items-center rounded-2xl bg-white/10 px-4 font-display text-lg font-extrabold uppercase tracking-[0.08em] text-white ring-1 ring-white/25 backdrop-blur-sm">Free</span>
                  <span className="sr-only">2 + 1 = free</span>
                  <span aria-hidden="true" className="ml-2 hidden h-10 w-px bg-white/15 sm:block" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#ffdc32]">
                    <span aria-hidden="true" className="h-px w-6 bg-[#ffdc32]/70" />
                    {t("Limited offer")}
                  </p>
                  <p className="mt-2 font-display text-2xl font-extrabold leading-tight tracking-tight sm:text-[1.7rem]">
                    {t("Buy 2 scoops, get the 3rd free")}
                  </p>
                  <p className="mt-1.5 max-w-xl text-sm leading-6 text-white/70">
                    {t("Pick any three scoops and the lowest-priced one is on us.")}
                  </p>
                </div>
                <Link
                  className="group/btn relative inline-flex w-fit shrink-0 items-center gap-2 overflow-hidden rounded-full bg-[#ffdc32] px-7 py-3.5 text-sm font-extrabold text-[#092a53] shadow-[0_10px_26px_rgba(255,220,50,0.3)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(255,220,50,0.42)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32] focus-visible:ring-offset-2 focus-visible:ring-offset-[#092a53]"
                  to="/flavors"
                >
                  {t("Explore flavors")}
                  <span aria-hidden="true" className="transition-transform duration-300 group-hover/btn:translate-x-1">
                    <ArrowIcon />
                  </span>
                </Link>
              </div>
            </div>
          </section>
        )}

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
