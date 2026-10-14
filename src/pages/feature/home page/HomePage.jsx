import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Footer,
  Header,
  ArrowIcon,
  InstagramSection,
} from "../../../components/Layout";
import { useCart } from "../../../useCart";
import { apiRequest } from "../../../api/api";
import { coldStoneMenuCategories, getMenuItemId } from "../../../data";
import { useLanguage } from "../../../language/useLanguage";

const popularFlavorNames = [
  "Cookie Crunch Cone",
  "Caramel Crunch Cone",
  "Signature Mix-In Cup",
  "Cookie Crunch Cup",
  "Candy Mix-In Shake",
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
    eyebrow: "Make room for something sweet",
    title: "Make every moment",
    accent: "a little sweeter.",
    description:
      "Find a treat for today, a new flavor to love, or something special to share.",
    image: "/cream/cream%204.webp",
    alt: "A delicious ice cream treat",
    caption: "A treat worth sharing",
  },
  {
    eyebrow: "Find your new favorite",
    title: "A world of flavor",
    accent: "is waiting.",
    description:
      "Explore the menu, discover signature combinations, and find a scoop that feels just right.",
    image: "/ice-images/ice-10.jpg",
    alt: "A colorful ice cream creation",
    caption: "Choose. Mix. Make it yours.",
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
    <img alt="" className={`shrink-0 rounded-full object-cover ${className}`} loading="lazy" src={picture} />
  ) : (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full bg-[#092a53] font-display font-extrabold text-[#ffdc32] ${className}`}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

const LONG_REVIEW_LENGTH = 150;

// Card order: photo with the name beside it, verified purchase, ordered item, stars, then the review.
function ReviewCard({ review, language, t, className = "" }) {
  const [expanded, setExpanded] = useState(false);
  const customerName = review.customerName || t("Customer");
  const rawText = (review.review || "").trim();
  const text = rawText ? rawText.charAt(0).toUpperCase() + rawText.slice(1) : "";
  const isLong = text.length > LONG_REVIEW_LENGTH;
  const date = formatReviewDate(review.createdAt, language);
  return (
    <li className={`w-full sm:w-[calc(50%-0.625rem)] lg:w-[calc(33.333%-0.84rem)] lg:max-w-[400px] ${className}`}>
      <article className="flex h-full flex-col rounded-2xl bg-white p-5 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.55)] ring-1 ring-black/5 transition duration-300 hover:-translate-y-1 hover:shadow-[0_26px_50px_-22px_rgba(0,0,0,0.6)] sm:p-6">
        <header className="flex items-center gap-4">
          <ReviewerAvatar className="size-16 text-xl ring-4 ring-[#fff3c4]" name={customerName} picture={review.profilePicture} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-extrabold text-[#0f2340]">{customerName}</p>
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-[#1a7f4b]">
              <VerifiedIcon className="size-3.5" />
              {t("Verified purchase")}
            </p>
            {review.itemName && (
              <p className="mt-0.5 truncate text-xs text-[#8592a3]">
                {t("Ordered")}: <span className="font-semibold text-[#3a4a5e]">{t(review.itemName)}</span>
              </p>
            )}
          </div>
        </header>

        <div className="mt-4 flex items-center gap-2.5 border-t border-[#eef1f5] pt-4">
          <StarRating
            className="size-4"
            filledClassName="text-[#f5b301]"
            label={t("{rating} out of 5 stars", { rating: review.rating })}
            value={Number(review.rating) || 0}
          />
          {date && (
            <time className="text-xs text-[#8592a3]" dateTime={parseReviewDate(review.createdAt)?.toISOString()}>
              {date}
            </time>
          )}
        </div>

        <div className="mt-3 flex-1">
          {text ? (
            <blockquote className={`whitespace-pre-line text-[15px] leading-relaxed text-[#3a4a5e] ${isLong && !expanded ? "line-clamp-4" : ""}`}>
              “{text}”
            </blockquote>
          ) : (
            <p className="text-[15px] italic leading-relaxed text-[#8592a3]">{t("No written comment.")}</p>
          )}
          {isLong && (
            <button
              aria-expanded={expanded}
              className="mt-1 text-sm font-semibold text-[#0f4c8a] hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f4c8a]"
              onClick={() => setExpanded((current) => !current)}
              type="button"
            >
              {t(expanded ? "Show less" : "Read more")}
            </button>
          )}
        </div>
      </article>
    </li>
  );
}

function ReviewsSection({ reviews, stats, error, language, t }) {
  if (!reviews.length) return null;
  const average = stats.average;
  const roundedAverage = Math.round(average * 10) / 10;
  const count = stats.count;
  return (
    <section
      aria-labelledby="real-reviews-heading"
      className="relative isolate overflow-hidden bg-[#092a53] px-5 py-20 text-white sm:px-8 sm:py-24 lg:px-10"
    >
      {/* Same backdrop as the hero: navy with a yellow glow, a blue glow and a faint dot grid. */}
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-40 -z-10 size-[38rem] rounded-full bg-[#ffdc32]/[0.12] blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-56 -left-40 -z-10 size-[34rem] rounded-full bg-[#1c4f8a]/50 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 opacity-[0.06] [background-image:radial-gradient(#ffffff_1px,transparent_1px)] [background-size:28px_28px]" />

      <div className="mx-auto max-w-[1240px]">
        <header className="mx-auto max-w-2xl text-center">
          <p className="inline-flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#ffdc32]">
            <span aria-hidden="true" className="h-px w-8 bg-[#ffdc32]" />
            {t("What our customers are saying")}
            <span aria-hidden="true" className="h-px w-8 bg-[#ffdc32]" />
          </p>
          <h2 className="mt-4 font-display text-4xl font-extrabold tracking-tight sm:text-5xl" id="real-reviews-heading">
            {t("Real Reviews")}
          </h2>
          <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-2xl bg-white/[0.08] px-5 py-2.5 ring-1 ring-white/15 backdrop-blur-sm sm:rounded-full">
            <span className="font-display text-xl font-extrabold tabular-nums">{roundedAverage.toFixed(1)}</span>
            <StarRating
              className="size-4"
              emptyClassName="text-white/20"
              filledClassName="text-[#ffdc32]"
              label={t("{rating} out of 5 stars", { rating: roundedAverage.toFixed(1) })}
              value={average}
            />
            <span aria-hidden="true" className="hidden h-4 w-px bg-white/20 sm:block" />
            <span className="text-sm text-white/75">
              {t(count === 1 ? "Based on 1 review" : "Based on {count} reviews", { count })}
            </span>
            <span aria-hidden="true" className="hidden h-4 w-px bg-white/20 sm:block" />
            <span className="inline-flex items-center gap-1 text-sm font-medium text-[#7fe0a9]">
              <VerifiedIcon className="size-4" />
              {t("Verified purchases only")}
            </span>
          </div>
        </header>

        {error ? (
          <p className="mx-auto mt-12 max-w-xl rounded-2xl bg-white/[0.08] p-6 text-center text-sm text-white/80 ring-1 ring-white/15" role="status">
            {t("Customer reviews could not be loaded")}: {error}
          </p>
        ) : (
          <ul className="mt-12 flex flex-wrap justify-center gap-5">
            {reviews.map((review, index) => (
              <ReviewCard
                // Phones show the three newest reviews to keep the page short.
                className={index >= 3 ? "hidden sm:block" : ""}
                key={`${review.createdAt}-${review.itemId || review.itemName}-${index}`}
                language={language}
                review={review}
                t={t}
              />
            ))}
          </ul>
        )}

        <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <Link
            className="inline-flex items-center gap-2 rounded-full bg-[#ffdc32] px-6 py-3.5 text-sm font-extrabold text-[#092a53] transition hover:-translate-y-0.5 hover:bg-[#ffe76c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32] focus-visible:ring-offset-2 focus-visible:ring-offset-[#092a53]"
            to="/menu"
          >
            {t("Explore the menu")} <ArrowIcon />
          </Link>
          <Link
            className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-bold text-white ring-1 ring-white/30 transition hover:-translate-y-0.5 hover:bg-white/10 hover:ring-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            to="/account/orders"
          >
            {t("Write a review")}
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
  const [activeSlide, setActiveSlide] = useState(0);
  const [addedItemKey, setAddedItemKey] = useState(null);
  const [cartNoticeIsError, setCartNoticeIsError] = useState(false);
  const addedTimer = useRef(undefined);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timeoutId = window.setTimeout(() => {
      setActiveSlide((current) => (current + 1) % homeSlides.length);
    }, 6000);

    return () => window.clearTimeout(timeoutId);
  }, [activeSlide]);

  useEffect(() => {
    let cancelled = false;
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
      });
    return () => {
      cancelled = true;
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
    `${new Intl.NumberFormat(language === "fr" ? "fr-CM" : "en-CM").format(price)} FCFA`;

  return (
    <div className="min-h-screen overflow-clip bg-[#fbfaf5] text-[#102c50]">
      <Header />
      <main>
        <section
          id="home"
          className="relative isolate w-full overflow-hidden bg-[#092a53] text-white"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-40 -top-40 -z-10 size-[38rem] rounded-full bg-[#ffdc32]/[0.12] blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-56 -left-40 -z-10 size-[34rem] rounded-full bg-[#1c4f8a]/50 blur-3xl"
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

                <ul className="mt-12 flex flex-wrap gap-x-8 gap-y-3 border-t border-white/10 pt-6 text-sm font-semibold text-white/80">
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
                <p className="mt-5 text-[11px] leading-5 text-white/45">
                  {t("Independent information guide — not an official Cold Stone Creamery website.")}
                </p>
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
                    const isActive = activeSlide === index;
                    return (
                      <img
                        alt={isActive ? t(slide.alt) : ""}
                        aria-hidden={!isActive}
                        className={`home-slide-image absolute inset-0 size-full object-cover object-center ${
                          isActive ? "scale-100 opacity-100" : "scale-[1.04] opacity-0"
                        }`}
                        fetchPriority={index === 0 ? "high" : "auto"}
                        key={slide.image}
                        loading={index === 0 ? "eager" : "lazy"}
                        src={slide.image}
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

                {/* Thumbnails */}
                <div
                  aria-label={t("Choose a featured slide")}
                  className="absolute -left-4 top-1/2 hidden -translate-y-1/2 flex-col gap-3 rounded-[22px] bg-white/10 p-2 shadow-[0_20px_50px_rgba(0,0,0,0.25)] ring-1 ring-white/15 backdrop-blur-md sm:flex lg:-left-10"
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
                        <img alt="" className="size-full object-cover" src={slide.image} />
                      </button>
                    );
                  })}
                </div>
                <div aria-label={t("Choose a featured slide")} className="mt-4 flex justify-center gap-2 sm:hidden" role="group">
                  {homeSlides.map((slide, index) => (
                    <button
                      aria-current={activeSlide === index ? "true" : undefined}
                      aria-label={t("Show slide {number}", { number: index + 1 })}
                      className={`h-2 rounded-full transition-all ${activeSlide === index ? "w-8 bg-[#ffdc32]" : "w-2 bg-white/35"}`}
                      key={slide.image}
                      onClick={() => setActiveSlide(index)}
                      type="button"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Quick links */}
          <div className="mt-16 border-t border-white/10 bg-[#061f40]/60 lg:mt-20">
            <ul className="mx-auto grid max-w-[1320px] sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: "⌖", title: "Cameroon locations", detail: "Find a listed shop near you.", to: "/locations" },
                { icon: "✧", title: "Explore the menu", detail: "Browse signature creations and treats.", to: "/menu" },
                { icon: "♡", title: "Explore flavors", detail: "Find a new favorite in the catalog.", to: "/flavors" },
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
                      {feature.icon}
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

        <section
          aria-labelledby="popular-flavors-heading"
          className="relative isolate overflow-hidden bg-[#fbfaf5] px-5 py-20 sm:px-8 sm:py-24 lg:px-10 lg:py-28"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-40 top-20 -z-10 size-[30rem] rounded-full bg-[#ffdc32]/10 blur-3xl"
          />
          <div className="mx-auto max-w-[1320px]">
            <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                <p className="inline-flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#a48700]">
                  <span aria-hidden="true" className="h-px w-10 bg-[#a48700]" />
                  {t("Our favorites")}
                </p>
                <h2
                  className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-[#092a53] sm:text-5xl"
                  id="popular-flavors-heading"
                >
                  {t("Popular Flavors")}
                </h2>
                <p className="mt-4 max-w-xl text-base leading-7 text-[#52647b]">
                  {t("From classic scoops to signature creations, find a new favorite.")}
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
                  <img
                    alt=""
                    className={`size-full object-cover transition duration-700 ease-out group-hover:scale-[1.06] ${soldOut ? "grayscale-[60%]" : ""}`}
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = "/images/hero-ice-cream.jpg";
                    }}
                    src={item.image}
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
                          <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-white/55">{t("Illustrative price")}</p>
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
                      <p className="mt-1.5 whitespace-nowrap font-display text-sm font-extrabold tabular-nums text-[#a48700] sm:hidden">
                        {soldOut ? t("Sold out") : formatPrice(item.priceXaf)}
                      </p>
                    </div>
                    <div className="hidden shrink-0 text-right sm:block">
                      <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#8792a0]">
                        {soldOut ? t("Sold out") : t("Illustrative price")}
                      </p>
                      <p className="mt-0.5 whitespace-nowrap font-display text-lg font-extrabold tabular-nums text-[#092a53]">
                        {formatPrice(item.priceXaf)}
                      </p>
                    </div>
                    <button
                      aria-label={soldOut ? t("Sold out") : added ? t("Added") : t("Add {name} to your bag", { name: t(item.name) })}
                      className={`relative z-10 grid size-11 shrink-0 place-items-center rounded-full transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#efece3] disabled:text-[#8792a0] sm:size-12 ${
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
          aria-labelledby="why-choose-us-heading"
          className="relative isolate w-full overflow-hidden bg-[#092a53] px-5 py-20 text-white sm:px-8 sm:py-24 lg:px-10 lg:py-28"
          data-scroll-reveal="skip"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-40 -top-40 -z-10 size-[34rem] rounded-full bg-[#ffdc32]/10 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 opacity-[0.05] [background-image:radial-gradient(#ffffff_1px,transparent_1px)] [background-size:28px_28px]"
          />
          <div className="mx-auto grid w-full max-w-[1320px] items-center gap-14 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <p className="inline-flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#ffdc32]">
                <span aria-hidden="true" className="h-px w-10 bg-[#ffdc32]" />
                {t("Why choose us")}
              </p>
              <h2
                className="mt-5 font-display text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-5xl lg:text-6xl"
                id="why-choose-us-heading"
              >
                {t("More scoops. More smiles.")}
              </h2>
              <p className="mt-5 max-w-md text-base leading-7 text-white/65 sm:text-lg sm:leading-8">
                {t("Signature creations, bold mix-ins and a treat for every mood, at branches across Cameroon.")}
              </p>

              <div className="relative mt-10">
                <figure className="overflow-hidden rounded-[30px] shadow-[0_30px_70px_rgba(0,0,0,0.3)] ring-1 ring-white/10">
                  <img
                    alt=""
                    className="aspect-[16/10] w-full object-cover"
                    loading="lazy"
                    src="/cream/cream%202.webp"
                  />
                </figure>
                <div className="absolute -bottom-6 right-4 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-[#092a53] shadow-[0_20px_44px_rgba(0,0,0,0.25)] sm:right-6">
                  <span aria-hidden="true" className="grid size-10 place-items-center rounded-xl bg-[#ffdc32] text-[#092a53]">
                    <svg className="size-5" fill="none" viewBox="0 0 24 24">
                      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
                    </svg>
                  </span>
                  <span className="leading-tight">
                    <span className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#a48700]">{t("Signature creations")}</span>
                    <span className="mt-0.5 block text-sm font-bold">{t("A treat made your way")}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              <ul className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                {[
                  {
                    title: "Natural ingredients",
                    detail: "Only the good stuff, always.",
                    icon: (
                      <path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14Zm0 0 7-7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                    ),
                  },
                  {
                    title: "Unique flavors",
                    detail: "Classic to creative.",
                    icon: (
                      <path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7L12 3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
                    ),
                  },
                  {
                    title: "Freshly made",
                    detail: "A little joy, every day.",
                    icon: (
                      <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.8 12 6.5l2.5-1.7M9.5 19.2 12 17.5l2.5 1.7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                    ),
                  },
                  {
                    title: "Happy customers",
                    detail: "Your smile is our success.",
                    icon: (
                      <>
                        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                        <path d="M8.5 14.5c.9 1.2 2.1 1.8 3.5 1.8s2.6-.6 3.5-1.8M9 9.5h.01M15 9.5h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
                      </>
                    ),
                  },
                ].map((benefit, index) => (
                  <li
                    className={`group relative flex flex-col rounded-[26px] bg-white/[0.04] p-7 ring-1 ring-white/10 transition duration-300 hover:-translate-y-1 hover:bg-white/[0.07] hover:ring-[#ffdc32]/40 sm:p-8 ${
                      index % 2 === 1 ? "sm:translate-y-8 sm:hover:translate-y-7" : ""
                    }`}
                    key={benefit.title}
                  >
                    <div className="flex items-start justify-between">
                      <span
                        aria-hidden="true"
                        className="grid size-14 place-items-center rounded-2xl bg-[#ffdc32] text-[#092a53] shadow-[0_10px_24px_rgba(255,220,50,0.2)] transition duration-300 group-hover:-rotate-6 group-hover:scale-105"
                      >
                        <svg className="size-6" fill="none" viewBox="0 0 24 24">{benefit.icon}</svg>
                      </span>
                      <span aria-hidden="true" className="font-display text-sm font-extrabold tabular-nums text-white/30">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <h3 className="mt-8 font-display text-2xl font-extrabold leading-tight">
                      {t(benefit.title)}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-white/60">
                      {t(benefit.detail)}
                    </p>
                  </li>
                ))}
              </ul>
              <div className="mt-12 flex flex-wrap items-center gap-4 sm:mt-16">
                <Link
                  className="inline-flex items-center gap-2 rounded-full bg-[#ffdc32] px-7 py-4 text-sm font-extrabold text-[#092a53] transition hover:-translate-y-0.5 hover:bg-[#ffe76c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32] focus-visible:ring-offset-2 focus-visible:ring-offset-[#092a53]"
                  to="/menu"
                >
                  {t("Explore the menu")} <ArrowIcon />
                </Link>
                <p className="text-sm font-semibold text-white/55">{t("A flavor for every mood")}</p>
              </div>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="home-menu-heading"
          className="relative isolate overflow-hidden bg-white px-5 py-20 sm:px-8 sm:py-24 lg:px-10 lg:py-28"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-40 top-10 -z-10 size-[30rem] rounded-full bg-[#ffdc32]/10 blur-3xl"
          />
          <div className="mx-auto max-w-[1320px]">
            <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                <p className="inline-flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#a48700]">
                  <span aria-hidden="true" className="h-px w-10 bg-[#a48700]" />
                  {t("The Cold Stone experience")}
                </p>
                <h2
                  className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-[#092a53] sm:text-5xl"
                  id="home-menu-heading"
                >
                  {t("Menu highlights")}
                </h2>
                <p className="mt-4 max-w-xl text-base leading-7 text-[#52647b]">
                  {t(
                    "These categories appear on the global Cold Stone menu. Ask a Cameroon branch to confirm current selection.",
                  )}
                </p>
              </div>
              <Link
                className="inline-flex shrink-0 items-center gap-2 self-start rounded-full bg-[#092a53] px-6 py-3.5 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(9,42,83,0.2)] transition hover:-translate-y-0.5 hover:bg-[#163e6b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2 md:self-auto"
                to="/menu"
              >
                {t("View menu guide")} <ArrowIcon diagonal />
              </Link>
            </div>

            <div className="mt-12 grid auto-rows-[260px] gap-4 sm:grid-cols-2 sm:auto-rows-[240px] lg:grid-cols-4 lg:auto-rows-[220px] lg:gap-5">
              {coldStoneMenuCategories.map((category, index) => {
                const featured = index === 0;
                const layout = [
                  "sm:col-span-2 sm:row-span-2",
                  "lg:col-span-2",
                  "",
                  "",
                  "lg:col-span-2",
                  "sm:col-span-2 lg:col-span-2",
                ][index] ?? "";
                return (
                  <Link
                    aria-label={`${t(category.title)} — ${t("Browse the categories")}`}
                    className={`group relative isolate flex flex-col justify-end overflow-hidden rounded-[26px] bg-[#092a53] text-white shadow-[0_12px_32px_rgba(9,42,83,0.1)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_50px_rgba(9,42,83,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] focus-visible:ring-offset-4 ${layout}`}
                    key={category.title}
                    to={`/menu?category=${encodeURIComponent(category.title)}`}
                  >
                    <img
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 -z-20 size-full object-cover transition duration-700 ease-out group-hover:scale-[1.06]"
                      loading="lazy"
                      src={category.image}
                    />
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 -z-10 bg-gradient-to-t from-[#061d3a]/90 via-[#061d3a]/35 to-transparent transition duration-500 group-hover:from-[#061d3a]/95"
                    />

                    <div className="absolute inset-x-5 top-5 flex items-center justify-between sm:inset-x-6 sm:top-6">
                      <span className="font-display text-sm font-extrabold tabular-nums text-white/80">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-white backdrop-blur-md">
                        {t("{count} items", { count: category.items.length })}
                      </span>
                    </div>

                    <div className="flex items-end justify-between gap-4 p-5 sm:p-6">
                      <div className="min-w-0">
                        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#ffdc32]">
                          {t("Menu category")}
                        </p>
                        <h3
                          className={`mt-1.5 font-display font-extrabold leading-tight tracking-tight ${
                            featured ? "text-3xl sm:text-4xl lg:text-5xl" : "text-xl sm:text-2xl"
                          }`}
                        >
                          {t(category.title)}
                        </h3>
                        <p
                          className={`mt-2 max-w-md text-sm leading-6 text-white/75 ${
                            featured ? "line-clamp-2" : "line-clamp-2 sm:line-clamp-1 lg:line-clamp-2"
                          }`}
                        >
                          {t(category.description)}
                        </p>
                      </div>
                      <span
                        aria-hidden="true"
                        className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-[#092a53] shadow-md transition duration-300 group-hover:bg-[#ffdc32] group-hover:-rotate-45"
                      >
                        <ArrowIcon />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section
          aria-labelledby="home-about-heading"
          className="relative isolate overflow-hidden bg-[#fbfaf5] px-4 py-16 sm:px-7 sm:py-24 lg:px-10"
          data-scroll-reveal="skip"
        >
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-[#e5e1d7] to-transparent"
          />
          <div
            aria-hidden="true"
            className="absolute -right-40 top-1/3 -z-10 size-[28rem] rounded-full bg-[#ffdc32]/10 blur-3xl"
          />
          <div className="mx-auto max-w-[1320px]">
            <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
              <div className="relative lg:col-span-6">
                <div className="grid grid-cols-6 grid-rows-6 gap-3 sm:gap-4 [aspect-ratio:1/1] sm:[aspect-ratio:6/5]">
                  <figure className="relative col-span-4 row-span-6 overflow-hidden rounded-[28px] bg-[#fff3b8] shadow-[0_24px_60px_rgba(9,42,83,0.16)]">
                    <img
                      alt={t("A child enjoying ice cream")}
                      className="size-full object-cover object-[58%_30%] transition duration-700 hover:scale-[1.03]"
                      loading="lazy"
                      src="/ice-images/about-child.jpg"
                    />
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#092a53]/40 via-transparent to-transparent"
                    />
                  </figure>
                  <figure className="relative col-span-2 row-span-3 overflow-hidden rounded-[22px] bg-[#fff3b8] shadow-[0_14px_34px_rgba(9,42,83,0.12)]">
                    <img
                      alt={t("Ice cream cupcake")}
                      className="size-full object-cover transition duration-700 hover:scale-[1.05]"
                      loading="lazy"
                      src="/cream/cream%203.webp"
                    />
                  </figure>
                  <figure className="relative col-span-2 row-span-3 overflow-hidden rounded-[22px] bg-[#fff3b8] shadow-[0_14px_34px_rgba(9,42,83,0.12)]">
                    <img
                      alt={t("Chocolate ice cream cupcake")}
                      className="size-full object-cover transition duration-700 hover:scale-[1.05]"
                      loading="lazy"
                      src="/cream/cream%205.webp"
                    />
                  </figure>
                </div>
                <div className="absolute -bottom-6 left-4 flex items-center gap-3 rounded-2xl border border-[#eeeae1] bg-white/95 px-4 py-3 shadow-[0_18px_40px_rgba(9,42,83,0.14)] backdrop-blur-sm sm:left-8 sm:px-5 sm:py-4">
                  <div aria-hidden="true" className="flex -space-x-2.5">
                    {["/cream/cream%201.webp", "/ice-images/ice-7.webp", "/milk/mk-2.webp"].map((src) => (
                      <img
                        alt=""
                        className="size-9 rounded-full border-2 border-white object-cover"
                        key={src}
                        loading="lazy"
                        src={src}
                      />
                    ))}
                  </div>
                  <div className="leading-tight">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#a48700]">
                      {t("Happy customers")}
                    </p>
                    <p className="mt-0.5 text-sm font-bold text-[#092a53]">
                      {t("Your smile is our success.")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-6 lg:pl-4">
                <p className="inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#a48700]">
                  <span aria-hidden="true" className="h-px w-8 bg-[#a48700]" />
                  {t("About us")}
                </p>
                <h2
                  className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-[#092a53] sm:text-5xl"
                  id="home-about-heading"
                >
                  {t("The joy is in the details.")}
                </h2>
                <p className="mt-5 max-w-xl text-base leading-7 text-[#52647b]">
                  {t(
                    "Discover Cold Stone ice cream, signature creations, and the mix-ins that make every scoop a little more special.",
                  )}
                </p>

                <dl className="mt-8 divide-y divide-[#e9e5da] border-y border-[#e9e5da]">
                  {[
                    { number: "01", label: "Pickup or delivery", detail: "Choose what suits your day." },
                    { number: "02", label: "Loyalty rewards", detail: "Earn points on every order." },
                    { number: "03", label: "Custom cakes", detail: "Plan a cake for any celebration." },
                  ].map((item) => (
                    <div className="group flex items-baseline gap-5 py-4 sm:py-5" key={item.label}>
                      <span
                        aria-hidden="true"
                        className="font-display text-sm font-extrabold tabular-nums text-[#c9b24a] transition-colors group-hover:text-[#a48700]"
                      >
                        {item.number}
                      </span>
                      <div className="flex flex-1 flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                        <dt className="font-display text-lg font-extrabold text-[#092a53]">
                          {t(item.label)}
                        </dt>
                        <dd className="text-sm text-[#65748a]">{t(item.detail)}</dd>
                      </div>
                    </div>
                  ))}
                </dl>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link
                    className="inline-flex items-center gap-2 rounded-full bg-[#092a53] px-6 py-3.5 text-sm font-extrabold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#163e6b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2"
                    to="/about"
                  >
                    {t("Discover our story")} <ArrowIcon />
                  </Link>
                  <Link
                    className="inline-flex items-center gap-2 rounded-full border border-[#d9d4c7] px-6 py-3.5 text-sm font-extrabold text-[#092a53] transition hover:-translate-y-0.5 hover:border-[#092a53] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2"
                    to="/menu"
                  >
                    {t("Explore the menu")}
                  </Link>
                </div>
              </div>
            </div>

            <div className="relative isolate mt-20 overflow-hidden rounded-[28px] bg-[#ffdc32] px-6 py-8 text-[#092a53] shadow-[0_18px_46px_rgba(121,99,0,0.14)] sm:px-10 sm:py-10 lg:mt-24">
              <div
                aria-hidden="true"
                className="absolute inset-0 -z-10 bg-gradient-to-r from-[#ffe76c] via-[#ffdc32] to-[#f2c900]"
              />
              <div
                aria-hidden="true"
                className="absolute -right-16 -top-20 -z-10 size-56 rounded-full border-[36px] border-white/25"
              />
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#092a53]/75">
                    {t("Browse signature creations and treats.")}
                  </p>
                  <p className="mt-2 font-display text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
                    {t("Ready for your next scoop?")}
                  </p>
                </div>
                <Link
                  className="inline-flex shrink-0 items-center gap-2 self-start rounded-full bg-[#092a53] px-6 py-3.5 text-sm font-extrabold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-[#163e6b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2 focus-visible:ring-offset-[#ffdc32] md:self-auto"
                  to={`/menu?category=${encodeURIComponent("Ice Cream")}`}
                >
                  {t("Order now")} <ArrowIcon />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Shown once there is at least one approved review, so new visitors never see an empty block. */}
        <ReviewsSection error={reviewsError} language={language} reviews={reviews} stats={reviewStats} t={t} />

        <section
          aria-labelledby="home-faq-heading"
          className="relative isolate overflow-hidden bg-white px-5 py-20 sm:px-8 sm:py-24 lg:px-10 lg:py-28"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-40 top-24 -z-10 size-[30rem] rounded-full bg-[#ffdc32]/10 blur-3xl"
          />
          <div className="mx-auto grid max-w-[1240px] gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <div className="lg:sticky lg:top-28">
                <p className="inline-flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#a48700]">
                  <span aria-hidden="true" className="h-px w-10 bg-[#a48700]" />
                  {t("Here to help")}
                </p>
                <h2
                  className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-[#092a53] sm:text-5xl"
                  id="home-faq-heading"
                >
                  {t("Frequently Asked Questions")}
                </h2>
                <p className="mt-5 max-w-md text-base leading-7 text-[#52647b]">
                  {t(
                    "Find quick answers about this guide, local listings, and the information on our site.",
                  )}
                </p>

                <div className="relative isolate mt-10 overflow-hidden rounded-[26px] bg-[#092a53] p-7 text-white shadow-[0_20px_50px_rgba(9,42,83,0.18)] sm:p-8">
                  <div
                    aria-hidden="true"
                    className="absolute -right-14 -top-14 -z-10 size-44 rounded-full border-[28px] border-white/[0.06]"
                  />
                  <span
                    aria-hidden="true"
                    className="grid size-12 place-items-center rounded-2xl bg-[#ffdc32] text-[#092a53]"
                  >
                    <svg className="size-6" fill="none" viewBox="0 0 24 24">
                      <path
                        d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5V17H6.5A2.5 2.5 0 0 1 4 14.5v-8Z"
                        stroke="currentColor"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                      />
                      <path d="M8.5 9.5h7M8.5 12.5h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
                    </svg>
                  </span>
                  <h3 className="mt-6 font-display text-2xl font-extrabold leading-tight">
                    {t("Still have questions?")}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-white/70">
                    {t("Use the Contact page to send a message to the operator of this independent guide.")}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link
                      className="inline-flex items-center gap-2 rounded-full bg-[#ffdc32] px-5 py-3 text-sm font-extrabold text-[#092a53] transition hover:-translate-y-0.5 hover:bg-[#ffe76c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32] focus-visible:ring-offset-2 focus-visible:ring-offset-[#092a53]"
                      to="/contact"
                    >
                      {t("Contact us")} <ArrowIcon />
                    </Link>
                    <Link
                      className="inline-flex items-center gap-2 rounded-full border border-white/25 px-5 py-3 text-sm font-extrabold text-white transition hover:-translate-y-0.5 hover:border-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#092a53]"
                      to="/locations"
                    >
                      {t("Locations")}
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="border-t border-[#e5e1d7]">
                {[
                  {
                    question:
                      "Is this the official Cold Stone Creamery Cameroon website?",
                    answer:
                      "No. This is an independent information guide and is not affiliated with or operated by Cold Stone Creamery.",
                  },
                  {
                    question:
                      "Are the listed locations and opening hours always current?",
                    answer:
                      "Public business details can change. Please confirm a location and its hours through a current local listing before visiting.",
                  },
                  {
                    question: "Will every Cameroon location have the same menu?",
                    answer:
                      "Menus, flavors, and availability may vary by location. Contact your preferred shop to check what is currently available.",
                  },
                  {
                    question: "Can I order treats through this website?",
                    answer:
                      "This site has a separate online catalog and checkout managed by its operator. Those products and prices are not confirmed as Cold Stone Cameroon offerings.",
                  },
                  {
                    question: "How can I find a location near me?",
                    answer:
                      "Use the Locations page to browse the public listings and available address details for Cameroon.",
                  },
                  {
                    question: "How can I contact this website?",
                    answer:
                      "Use the Contact page to send a message to the operator of this independent guide.",
                  },
                ].map(({ question, answer }, index) => (
                  <details
                    className="group border-b border-[#e5e1d7] transition-colors open:border-[#092a53]/20"
                    key={question}
                    open={index === 0}
                  >
                    <summary className="flex cursor-pointer list-none items-start gap-5 py-6 marker:content-none focus-visible:outline-none sm:gap-7 sm:py-7 [&::-webkit-details-marker]:hidden">
                      <span
                        aria-hidden="true"
                        className="pt-1 font-display text-sm font-extrabold tabular-nums text-[#c9b24a] transition-colors group-open:text-[#a48700]"
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="flex-1 font-display text-lg font-extrabold leading-snug text-[#092a53] transition-colors group-hover:text-[#163e6b] sm:text-xl">
                        {t(question)}
                      </span>
                      <span
                        aria-hidden="true"
                        className="relative mt-0.5 grid size-9 shrink-0 place-items-center rounded-full border border-[#e5e1d7] text-[#092a53] transition duration-300 group-hover:border-[#092a53] group-open:border-[#ffdc32] group-open:bg-[#ffdc32]"
                      >
                        <span className="absolute h-0.5 w-3.5 rounded-full bg-current" />
                        <span className="absolute h-3.5 w-0.5 rounded-full bg-current transition duration-300 group-open:rotate-90 group-open:opacity-0" />
                      </span>
                    </summary>
                    <p className="-mt-2 max-w-2xl pb-7 pl-11 pr-14 text-base leading-7 text-[#52647b] sm:pl-14">
                      {t(answer)}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>

        <InstagramSection />
      </main>
      <Footer />
    </div>
  );
}
