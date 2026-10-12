import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Footer,
  Header,
  ArrowIcon,
  InstagramSection,
} from "../../../components/Layout";
import { useCart } from "../../../CartContext";
import { apiRequest } from "../../../api/api";
import { coldStoneMenuCategories, getMenuItemId } from "../../../data";
import { useLanguage } from "../../../language/LanguageContext";

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
    image: "/ice-images/ice-5.webp",
    alt: "Colorful ice cream creations ready to enjoy",
    caption: "The signature experience",
  },
  {
    eyebrow: "Make room for something sweet",
    title: "Make every moment",
    accent: "a little sweeter.",
    description:
      "Find a treat for today, a new flavor to love, or something special to share.",
    image: "/ice-images/ice-4.webp",
    alt: "A delicious ice cream treat",
    caption: "A treat worth sharing",
  },
  {
    eyebrow: "Find your new favorite",
    title: "A world of flavor",
    accent: "is waiting.",
    description:
      "Explore the menu, discover signature combinations, and find a scoop that feels just right.",
    image: "/ice-images/ice-3.webp",
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

export function HomePage() {
  const { language, t } = useLanguage();
  const { addToCart } = useCart();
  const [popularFlavors, setPopularFlavors] = useState(() =>
    getPopularFlavors(coldStoneMenuCategories),
  );
  const [menuError, setMenuError] = useState("");
  const [cartNotice, setCartNotice] = useState("");
  const [reviews, setReviews] = useState([]);
  const [reviewsError, setReviewsError] = useState("");
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const intervalId = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % homeSlides.length);
    }, 6000);

    return () => window.clearInterval(intervalId);
  }, []);

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
          setReviews(approvedReviews.slice(0, 3));
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
    setCartNotice(
      added
        ? t("Added {name} to your bag.", { name: t(item.name) })
        : t("This item could not be added to your bag. Please try again."),
    );
  }

  const formatPrice = (price) =>
    `${new Intl.NumberFormat(language === "fr" ? "fr-CM" : "en-CM").format(price)} FCFA`;

  return (
    <div className="min-h-screen overflow-clip bg-[#fbfaf5] text-[#102c50]">
      <Header />
      <main>
        <section
          id="home"
          className="relative isolate w-full overflow-hidden bg-[#092a53] px-5 pb-20 pt-8 text-white sm:px-8 sm:pb-24 sm:pt-12 lg:px-12 lg:pt-14"
        >
          <div
            aria-hidden="true"
            className="absolute -right-20 top-16 size-44 rounded-full bg-[#ffdc32]/15 sm:size-64"
          />
          <div
            aria-hidden="true"
            className="absolute bottom-20 left-[42%] size-5 rounded-full bg-[#ffdc32]/80"
          />
          <div className="relative mx-auto w-full max-w-[1320px]">
            <div className="relative grid items-center gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-10">
              <div className="relative z-10 max-w-[590px]">
                <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#ffdc32] shadow-sm sm:text-xs">
                  <span aria-hidden="true" className="text-lg text-[#ffdc32]">
                    ✦
                  </span>
                  {t(homeSlides[activeSlide].eyebrow)}
                  <span aria-hidden="true" className="text-lg text-[#ffdc32]">
                    ✦
                  </span>
                </p>
                <h1 className="font-display text-[clamp(2.75rem,6.4vw,5.5rem)] font-extrabold leading-[0.96] tracking-[-0.065em] text-white">
                  {t(homeSlides[activeSlide].title)}
                  <span className="mt-1 block font-display font-bold italic tracking-[-0.045em] text-[#ffdc32]">
                    {t(homeSlides[activeSlide].accent)}
                  </span>
                </h1>
                <p className="mt-6 max-w-md text-sm leading-6 text-white/75 sm:text-base sm:leading-7">
                  {t(homeSlides[activeSlide].description)}
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    className="inline-flex items-center gap-2 rounded-xl bg-[#ffdc32] px-5 py-3 text-sm font-bold text-[#102c50] shadow-lg shadow-[#102c50]/15 transition hover:-translate-y-0.5 hover:bg-[#ffe665] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] focus-visible:ring-offset-2"
                    to={`/menu?category=${encodeURIComponent("Ice Cream")}`}
                  >
                    {t("Order now")} <ArrowIcon />
                  </Link>
                  <Link
                    className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/[0.08] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:border-[#ffdc32] hover:bg-white/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32] focus-visible:ring-offset-2 focus-visible:ring-offset-[#092a53]"
                    to="/flavors"
                  >
                    {t("Explore flavors")} <ArrowIcon diagonal />
                  </Link>
                </div>
                <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-white/85">
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden="true" className="text-lg text-[#ffdc32]">
                      ✧
                    </span>
                    {t("Signature creations")}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden="true" className="text-lg text-[#ffdc32]">
                      ♡
                    </span>
                    {t("A flavor for every mood")}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden="true" className="text-lg text-[#ffdc32]">
                      ⌖
                    </span>
                    {t("Cameroon locations")}
                  </span>
                </div>
                <p className="mt-6 max-w-lg text-[11px] leading-5 text-white/60">
                  {t(
                    "Independent information guide — not an official Cold Stone Creamery website.",
                  )}
                </p>
              </div>
              <div
                aria-label={t("Featured treats")}
                aria-roledescription={t("carousel")}
                className="relative mx-auto w-full max-w-[650px] lg:pr-3"
                role="region"
              >
                <div
                  aria-hidden="true"
                  className="absolute -right-4 top-6 size-20 rounded-full border-2 border-[#ffdc32] sm:-right-2 sm:size-28"
                />
                <div
                  aria-label={`${activeSlide + 1} / ${homeSlides.length}`}
                  aria-roledescription={t("slide")}
                  className="relative aspect-[1.08] overflow-hidden rounded-[32px] bg-[#ffdc32]/20 shadow-[0_28px_70px_rgba(9,42,83,0.18)] sm:aspect-[1.18] sm:rounded-[42px]"
                  role="group"
                >
                  {homeSlides.map((slide, index) => {
                    const isActive = activeSlide === index;
                    return (
                      <img
                        alt={isActive ? t(slide.alt) : ""}
                        aria-hidden={!isActive}
                        className={`home-slide-image absolute inset-0 size-full object-cover object-center ${
                          isActive
                            ? "scale-100 opacity-100"
                            : "scale-[1.025] opacity-0"
                        }`}
                        fetchPriority={index === 0 ? "high" : "auto"}
                        key={slide.image}
                        loading={index === 0 ? "eager" : "lazy"}
                        src={slide.image}
                      />
                    );
                  })}
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-gradient-to-t from-[#092a53]/85 via-[#092a53]/35 to-transparent px-4 pb-4 pt-16 sm:px-6 sm:pb-6">
                    <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                      <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-[#ffdc32] text-lg text-[#102c50] sm:size-10">
                        ✦
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[9px] font-extrabold uppercase tracking-[0.12em] text-white/75 sm:text-[10px]">
                          {t("Featured")}
                        </p>
                        <p className="truncate font-display text-sm font-bold text-white sm:text-base">
                          {t(homeSlides[activeSlide].caption)}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span aria-live="polite" className="mr-1 text-[10px] font-bold tabular-nums text-white/85 sm:text-xs">
                        {String(activeSlide + 1).padStart(2, "0")} / {String(homeSlides.length).padStart(2, "0")}
                      </span>
                      <button
                        aria-label={t("Previous slide")}
                        className="grid size-9 place-items-center rounded-full border border-white/40 bg-white/10 text-lg text-white backdrop-blur transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32] sm:size-10"
                        onClick={() => setActiveSlide((activeSlide + homeSlides.length - 1) % homeSlides.length)}
                        type="button"
                      >
                        <span aria-hidden="true">←</span>
                      </button>
                      <button
                        aria-label={t("Next slide")}
                        className="grid size-9 place-items-center rounded-full bg-[#ffdc32] text-lg text-[#102c50] shadow-md transition hover:scale-105 hover:bg-[#ffe665] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:size-10"
                        onClick={() => setActiveSlide((activeSlide + 1) % homeSlides.length)}
                        type="button"
                      >
                        <span aria-hidden="true">→</span>
                      </button>
                    </div>
                  </div>
                </div>
                <div aria-label={t("Choose a featured slide")} className="mt-4 flex items-center justify-center gap-2 lg:justify-start" role="group">
                  {homeSlides.map((slide, index) => (
                    <button
                      aria-current={activeSlide === index ? "true" : undefined}
                      aria-label={t("Show slide {number}", { number: index + 1 })}
                      className={`h-2.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] focus-visible:ring-offset-2 ${
                        activeSlide === index
                          ? "w-8 bg-[#ffdc32]"
                          : "w-2.5 bg-white/35 hover:bg-white/65"
                      }`}
                      key={slide.image}
                      onClick={() => setActiveSlide(index)}
                      type="button"
                    />
                  ))}
                  <span className="ml-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/65">
                    {t("Explore the collection")}
                  </span>
                </div>
              </div>
            </div>
            <div className="relative mt-12 grid gap-3 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">
              {[
                {
                  icon: "⌖",
                  title: "Cameroon locations",
                  detail: "Find a listed shop near you.",
                  to: "/locations",
                },
                {
                  icon: "✧",
                  title: "Explore the menu",
                  detail: "Browse signature creations and treats.",
                  to: "/menu",
                },
                {
                  icon: "♡",
                  title: "Explore flavors",
                  detail: "Find a new favorite in the catalog.",
                  to: "/flavors",
                },
                {
                  icon: "✿",
                  title: "Custom cake requests",
                  detail: "Plan a cake for your celebration.",
                  to: "/custom-cake",
                },
              ].map((feature) => (
                <Link
                  className="group flex min-h-[94px] items-center gap-3 rounded-2xl border border-[#e7e3d9] bg-white p-4 shadow-[0_8px_24px_rgba(9,42,83,0.045)] transition duration-300 hover:-translate-y-1 hover:border-[#e8d77b] hover:shadow-[0_15px_34px_rgba(9,42,83,0.1)] sm:p-5"
                  key={feature.title}
                  to={feature.to}
                >
                  <span
                    aria-hidden="true"
                    className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#fff3b8] text-xl text-[#102c50] transition group-hover:bg-[#ffdc32]"
                  >
                    {feature.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-extrabold text-[#102c50] sm:text-sm">
                      {t(feature.title)}
                    </span>
                    <span className="mt-1 block text-[11px] leading-4 text-[#65748a]">
                      {t(feature.detail)}
                    </span>
                  </span>
                  <span aria-hidden="true" className="ml-auto shrink-0 text-lg text-[#bd9c00] transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </Link>
              ))}
            </div>
          </div>
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-16 w-full sm:h-20"
            preserveAspectRatio="none"
            viewBox="0 0 1440 100"
          >
            <path
              d="M0 36C170 80 310 3 500 38s310 51 480 15 270-16 460 20v27H0Z"
              fill="#5ac4d9"
            />
            <path
              d="M0 44c180-26 280 10 450 5s270-42 450-21 290 20 540-13v85H0Z"
              fill="#fbfaf5"
            />
          </svg>
        </section>

        <section
          aria-labelledby="popular-flavors-heading"
          className="relative isolate overflow-hidden bg-white px-5 py-16 sm:px-8 sm:py-20 lg:px-10"
        >
          <div
            aria-hidden="true"
            className="absolute -right-28 top-16 -z-0 size-72 rounded-full border-[42px] border-[#ffdc32]/20"
          />
          <div className="relative z-10 mx-auto max-w-[1240px]">
            <div className="mb-7 flex flex-wrap items-end justify-between gap-4 sm:mb-9">
              <div>
                <p className="mb-3 inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#8a7500]">
                  <span aria-hidden="true" className="text-base">
                    ✦
                  </span>
                  {t("Our favorites")}
                </p>
                <h2
                  className="font-display text-3xl font-extrabold leading-tight tracking-tight text-[#092a53] sm:text-4xl lg:text-5xl"
                  id="popular-flavors-heading"
                >
                  {t("Popular Flavors")}
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-[#65748a]">
                  {t(
                    "From classic scoops to signature creations, find a new favorite.",
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center">
                <Link
                  className="inline-flex items-center gap-2 rounded-full border border-[#d9d6cc] bg-white px-4 py-2.5 text-xs font-extrabold text-[#092a53] shadow-sm transition hover:-translate-y-0.5 hover:border-[#bd9c00] hover:bg-[#fffbea] sm:text-sm"
                  to={`/menu?category=${encodeURIComponent("Ice Cream")}`}
                >
                  {t("View all")} <ArrowIcon />
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 min-[460px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
              {popularFlavors.map((item, index) => {
                const soldOut =
                  item.isAvailable === false || item.availableQuantity < 1;
                return (
                  <article
                    className="group overflow-hidden rounded-[26px] border border-[#ece9e1] bg-[#fbfaf5] shadow-[0_8px_26px_rgba(18,44,80,0.045)] transition duration-300 hover:-translate-y-1.5 hover:border-[#e7d77f] hover:shadow-[0_20px_44px_rgba(18,44,80,0.12)]"
                    key={item.id || item.name}
                  >
                    <div
                      className="relative aspect-[1.08] overflow-hidden"
                      style={{ backgroundColor: popularFlavorColors[index] }}
                    >
                      <img
                        alt={t(item.name)}
                        className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.07]"
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.src =
                            "/images/hero-ice-cream.jpg";
                        }}
                        src={item.image}
                      />
                      <span
                        className={`absolute left-4 top-4 rounded-full border border-white/70 px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-[0.1em] shadow-sm backdrop-blur-sm ${soldOut ? "bg-red-50/95 text-red-700" : "bg-white/95 text-[#37632c]"}`}
                      >
                        {soldOut ? t("Sold out") : t("Popular pick")}
                      </span>
                      <span
                        aria-hidden="true"
                        className="absolute bottom-4 right-4 grid size-10 translate-y-1 place-items-center rounded-full bg-[#ffdc32] text-lg font-bold text-[#092a53] opacity-0 shadow-md transition duration-300 group-hover:translate-y-0 group-hover:opacity-100"
                      >
                        ↗
                      </span>
                    </div>
                    <div className="p-4 sm:p-5">
                      <h3 className="min-h-12 font-display text-base font-extrabold leading-snug text-[#102c50] sm:text-lg">
                        {t(item.name)}
                      </h3>
                      <p className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-[#65748a]">
                        {t(item.detail)}
                      </p>
                      <div className="mt-4 flex items-end justify-between gap-2 border-t border-[#e7e3d9] pt-3">
                        <div>
                          <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#8792a0]">
                            {t("Illustrative price")}
                          </p>
                          <span className="mt-1 block text-sm font-extrabold text-[#092a53]">
                            {formatPrice(item.priceXaf)}
                          </span>
                        </div>
                        <button
                          aria-label={
                            soldOut
                              ? t("Sold out")
                              : t("Add {name} to your bag", {
                                  name: t(item.name),
                                })
                          }
                          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#092a53] px-4 text-xs font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-[#163e6b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#d9d6cc] disabled:text-[#65748a]"
                          disabled={soldOut}
                          onClick={() => handleAddToCart(item)}
                          type="button"
                        >
                          {soldOut ? (
                            t("Sold out")
                          ) : (
                            <>
                              {t("Add")} <span aria-hidden="true">+</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            {menuError && (
              <p className="mt-4 text-xs text-[#65748a]" role="status">
                {t("Menu availability could not be refreshed")}: {menuError}
              </p>
            )}
            {cartNotice && (
              <p
                aria-live="polite"
                className="mt-4 text-sm font-semibold text-[#315a36]"
              >
                {cartNotice}
              </p>
            )}
          </div>
          <svg
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 -z-0 h-10 w-full sm:h-14"
            preserveAspectRatio="none"
            viewBox="0 0 1440 80"
          >
            <path
              d="M0 43C170 80 310 3 500 38s310 51 480 15 270-16 460 20V80H0Z"
              fill="#102c50"
            />
            <path
              d="M0 56c180-26 280 10 450 5s270-42 450-21 290 20 540-13v53H0Z"
              fill="#5ac4d9"
              opacity=".75"
            />
          </svg>
        </section>

        <section
          aria-labelledby="why-choose-us-heading"
          className="relative isolate w-full overflow-hidden bg-[#f4f2e9] px-5 py-16 sm:px-8 sm:py-20 lg:px-10"
          data-scroll-reveal="skip"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full border-[42px] border-[#ffdc32]/20 sm:size-96"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -left-20 size-64 rounded-full border-[38px] border-[#092a53]/[0.04]"
          />
          <div className="relative z-10 mx-auto w-full max-w-[1240px]">
            <div className="mb-8 flex flex-col justify-between gap-4 sm:mb-10 sm:flex-row sm:items-end">
              <div className="max-w-2xl">
                <p className="mb-3 inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#8a7500]">
                  <span aria-hidden="true" className="text-base">
                    ✦
                  </span>
                  {t("Why choose us")}
                </p>
                <h2
                  className="font-display text-3xl font-extrabold leading-tight tracking-tight text-[#092a53] sm:text-4xl lg:text-5xl"
                  id="why-choose-us-heading"
                >
                  {t("More scoops. More smiles.")}
                </h2>
              </div>
              <p className="max-w-sm text-sm leading-6 text-[#65748a]">
                {t("A flavor for every mood")}
              </p>
            </div>
            <div className="grid overflow-hidden rounded-[26px] border border-[#e5e1d7] bg-white sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: "✿",
                  title: "Natural ingredients",
                  detail: "Only the good stuff, always.",
                  color: "#a8df62",
                },
                {
                  icon: "★",
                  title: "Unique flavors",
                  detail: "Classic to creative.",
                  color: "#ffdc32",
                },
                {
                  icon: "❄",
                  title: "Freshly made",
                  detail: "A little joy, every day.",
                  color: "#4fc4e8",
                },
                {
                  icon: "♡",
                  title: "Happy customers",
                  detail: "Your smile is our success.",
                  color: "#f56586",
                },
              ].map((benefit) => (
                <article
                  className="group relative border-b border-[#eeeae1] p-5 transition-colors duration-300 hover:bg-[#fffbea] sm:p-6 lg:border-b-0 lg:border-r last:border-0"
                  key={benefit.title}
                >
                  <span
                    aria-hidden="true"
                    className="grid size-12 place-items-center rounded-2xl text-xl font-bold text-[#102c50] shadow-sm transition duration-300 group-hover:rotate-[-4deg] group-hover:scale-105 sm:size-14"
                    style={{ backgroundColor: benefit.color }}
                  >
                    {benefit.icon}
                  </span>
                  <h3 className="mt-5 font-display text-lg font-extrabold text-[#092a53]">
                    {t(benefit.title)}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[#65748a]">
                    {t(benefit.detail)}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="relative isolate overflow-hidden bg-white px-4 py-16 sm:px-7 sm:py-20 lg:px-10">
          <div
            aria-hidden="true"
            className="absolute -left-24 top-16 -z-10 size-72 rounded-full border-[48px] border-[#ffdc32]/20"
          />
          <div className="mx-auto max-w-[1320px]">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4 sm:mb-10">
              <div>
                <p className="mb-3 inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#a48700]">
                  <span aria-hidden="true" className="text-base">
                    ✦
                  </span>
                  {t("The Cold Stone experience")}
                </p>
                <h2 className="font-display text-3xl font-extrabold tracking-tight text-[#092a53] sm:text-4xl lg:text-5xl">
                  {t("Menu highlights")}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#65748a]">
                  {t(
                    "These categories appear on the global Cold Stone menu. Ask a Cameroon branch to confirm current selection.",
                  )}
                </p>
              </div>
              <Link
                className="inline-flex items-center gap-2 rounded-full bg-[#092a53] px-5 py-3 text-xs font-extrabold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#163e6b] sm:text-sm"
                to="/menu"
              >
                {t("View menu guide")} <ArrowIcon diagonal />
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {coldStoneMenuCategories.map((category) => (
                <Link
                  aria-label={`${t(category.title)} — ${t("Browse the categories")}`}
                  className="group flex min-h-[340px] flex-col overflow-hidden rounded-[24px] border border-[#e7e3d9] bg-white shadow-[0_8px_28px_rgba(18,44,80,0.05)] transition duration-300 hover:-translate-y-1 hover:border-[#d9c76d] hover:shadow-[0_18px_40px_rgba(18,44,80,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] focus-visible:ring-offset-4"
                  key={category.title}
                  to={`/menu?category=${encodeURIComponent(category.title)}`}
                >
                  <div className="relative h-44 shrink-0 overflow-hidden bg-[#fff3b8]">
                    <img
                      alt=""
                      aria-hidden="true"
                      className="size-full object-cover transition duration-700 group-hover:scale-[1.05]"
                      loading="lazy"
                      src={category.image}
                    />
                    <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#092a53]/20 to-transparent" />
                    <span aria-hidden="true" className="absolute left-4 top-4 grid size-11 place-items-center rounded-2xl bg-white/95 text-2xl shadow-sm backdrop-blur-sm">
                      {category.icon}
                    </span>
                    <span className="absolute right-4 top-4 rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-extrabold text-[#52647b] shadow-sm backdrop-blur-sm">
                      {t("{count} items", { count: category.items.length })}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-5 sm:p-6">
                    <div className="flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        <p className="mb-1 text-[9px] font-extrabold uppercase tracking-[0.13em] text-[#a48700]">
                          {t("Menu category")}
                        </p>
                        <h3 className="font-display text-xl font-extrabold leading-tight text-[#092a53] sm:text-2xl">
                          {t(category.title)}
                        </h3>
                      </div>
                      <span
                        aria-hidden="true"
                        className="grid size-10 shrink-0 translate-x-1 place-items-center rounded-xl border border-[#e7e3d9] text-[#092a53] transition duration-300 group-hover:translate-x-0 group-hover:border-[#092a53] group-hover:bg-[#092a53] group-hover:text-white"
                      >
                        <ArrowIcon />
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#65748a]">
                      {t(category.description)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section
          aria-labelledby="home-about-heading"
          className="relative isolate overflow-hidden bg-[#fbfaf5] px-4 py-16 sm:px-7 sm:py-20 lg:px-10"
          data-scroll-reveal="skip"
        >
          <div
            aria-hidden="true"
            className="absolute -right-28 top-10 -z-10 size-72 rounded-full border-[44px] border-[#dff0ed]/70"
          />
          <div className="mx-auto grid max-w-[1320px] gap-5 lg:grid-cols-[0.95fr_1.05fr]">
            <article className="relative isolate flex min-h-[360px] overflow-hidden rounded-[28px] bg-[#ffdc32] text-[#092a53] shadow-[0_18px_46px_rgba(121,99,0,0.15)] sm:min-h-[410px]">
              <div
                aria-hidden="true"
                className="absolute inset-0 -z-10 bg-gradient-to-br from-[#ffe76c] via-[#ffdc32] to-[#f2c900]"
              />
              <div
                aria-hidden="true"
                className="absolute -left-20 -top-28 -z-10 size-64 rounded-full border-[40px] border-white/20"
              />
              <div className="relative z-10 flex w-[64%] flex-col items-start justify-center p-6 sm:w-[60%] sm:p-9 lg:p-11">
                <p className="inline-flex items-center gap-2 rounded-full border border-[#092a53]/10 bg-white/75 px-3.5 py-2 text-[9px] font-extrabold uppercase tracking-[0.15em]">
                  <span aria-hidden="true">✦</span>
                  {t("Explore the menu")}
                </p>
                <h2 className="mt-5 font-display text-3xl font-extrabold leading-[1.05] tracking-tight sm:text-4xl lg:text-5xl">
                  {t("A little joy")}
                  <span className="mt-1 block">{t("in every scoop.")}</span>
                </h2>
                <p className="mt-3 max-w-[260px] text-xs leading-5 text-[#092a53]/75 sm:text-sm sm:leading-6">
                  {t("Browse signature creations and treats.")}
                </p>
                <Link
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#092a53] px-5 py-3 text-xs font-extrabold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-[#163e6b] sm:text-sm"
                  to={`/menu?category=${encodeURIComponent("Ice Cream")}`}
                >
                  {t("Order now")} <ArrowIcon />
                </Link>
              </div>
              <div
                aria-hidden="true"
                className="absolute bottom-0 right-0 top-0 w-[46%] sm:w-[48%]"
              >
                <div className="absolute bottom-[-12%] right-[-9%] size-[115%] rounded-full border-[28px] border-white/20 sm:border-[38px]" />
                <img
                  alt={t("Ice cream cone")}
                  className="absolute bottom-[7%] right-[3%] h-[76%] w-[66%] rounded-[48%_48%_20%_20%] border-[5px] border-[#ffdc32] object-cover object-center shadow-2xl transition duration-500 hover:-translate-y-1"
                  loading="lazy"
                  src="/ice-images/ice-4.webp"
                />
                <img
                  alt={t("Ice cream sundae")}
                  className="absolute bottom-[7%] left-[-7%] h-[42%] w-[46%] rounded-[45%_45%_20%_20%] border-4 border-[#ffdc32] object-cover object-center shadow-xl sm:border-[5px]"
                  loading="lazy"
                  src="/ice-images/ice-1.jpg"
                />
                <img
                  alt={t("Ice cream treat")}
                  className="absolute right-[4%] top-[6%] h-[34%] w-[39%] rounded-[45%_45%_20%_20%] border-4 border-[#ffdc32] object-cover object-center shadow-xl sm:border-[5px]"
                  loading="lazy"
                  src="/ice-images/ice-3.webp"
                />
                <span className="absolute bottom-[8%] left-[28%] grid size-9 place-items-center rounded-full bg-white text-sm font-extrabold text-[#806a00] shadow-lg sm:size-11">
                  3×
                </span>
              </div>
            </article>

            <article className="relative isolate flex min-h-[340px] overflow-hidden rounded-[28px] border border-[#e7e3d9] bg-[#092a53] text-white shadow-[0_16px_42px_rgba(9,42,83,0.12)] sm:min-h-[390px]">
              <img
                alt={t("A child enjoying ice cream")}
                className="absolute inset-0 -z-20 size-full object-cover object-[58%_center]"
                loading="lazy"
                src="/ice-images/about-child.jpg"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 -z-10 bg-gradient-to-r from-[#092a53] via-[#092a53]/95 to-[#092a53]/15"
              />
              <div className="relative z-10 flex w-full flex-col items-start justify-center p-6 sm:w-[74%] sm:p-9 lg:p-11">
                <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-2 text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#ffdc32]">
                  <span aria-hidden="true">♡</span>
                  {t("About us")}
                </p>
                <h2
                  className="mt-5 max-w-sm font-display text-3xl font-extrabold leading-tight sm:text-4xl"
                  id="home-about-heading"
                >
                  {t("The joy is in the details.")}
                </h2>
                <p className="mt-3 max-w-sm text-xs leading-6 text-white/80 sm:text-sm sm:leading-7">
                  {t(
                    "Discover Cold Stone ice cream, signature creations, and the mix-ins that make every scoop a little more special.",
                  )}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {[
                    { icon: "✿", label: "Freshly made" },
                    { icon: "♡", label: "Quality ingredients" },
                    { icon: "☺", label: "Happy customers" },
                  ].map((item) => (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1.5 text-[9px] font-bold text-white/90 sm:text-[10px]"
                      key={item.label}
                    >
                      <span aria-hidden="true" className="text-[#ffdc32]">
                        {item.icon}
                      </span>
                      {t(item.label)}
                    </span>
                  ))}
                </div>
                <Link
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-xs font-extrabold text-[#092a53] transition hover:-translate-y-0.5 hover:bg-[#ffdc32] sm:text-sm"
                  to="/about"
                >
                  {t("Discover our story")} <ArrowIcon />
                </Link>
              </div>
              <div
                aria-hidden="true"
                className="absolute inset-y-0 right-0 -z-10 w-[40%] bg-gradient-to-l from-transparent to-[#092a53]/30"
              />
            </article>
          </div>
        </section>

        <section
          aria-labelledby="real-reviews-heading"
          className="relative isolate overflow-hidden bg-[#092a53] px-5 py-16 text-white sm:px-8 sm:py-20 lg:px-10"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full border-[42px] border-white/[0.06] sm:size-96"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 left-0 h-1.5 w-full bg-gradient-to-r from-[#ffdc32] via-[#ffdc32]/50 to-transparent"
          />
          <div className="relative z-10 mx-auto max-w-[1240px]">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-5 sm:mb-10">
              <div>
                <p className="mb-2 inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#ffdc32]">
                  <span aria-hidden="true" className="text-base">
                    ✦
                  </span>
                  {t("What our customers are saying")}
                </p>
                <h2
                  className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl"
                  id="real-reviews-heading"
                >
                  {t("Real Reviews")}
                </h2>
              </div>
              <Link
                className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-5 py-3 text-xs font-extrabold text-white transition hover:-translate-y-0.5 hover:border-[#ffdc32] hover:bg-[#ffdc32] hover:text-[#092a53] sm:text-sm"
                to="/menu"
              >
                {t("Explore the menu")} <ArrowIcon />
              </Link>
            </div>
            {reviewsError ? (
              <p
                className="rounded-2xl border border-white/15 bg-white/10 p-5 text-sm leading-6 text-white/85"
                role="status"
              >
                {t("Customer reviews could not be loaded")}: {reviewsError}
              </p>
            ) : reviews.length ? (
              <div className="grid gap-4 md:grid-cols-3">
                {reviews.map((review, index) => {
                  const customerName = review.customerName || t("Customer");
                  return (
                    <article
                      className="flex min-h-[260px] flex-col rounded-[24px] border border-white/70 bg-[#fffefa] p-5 text-[#102c50] shadow-[0_12px_34px_rgba(0,0,0,0.13)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_44px_rgba(0,0,0,0.2)] sm:p-6"
                      key={`${review.createdAt}-${review.itemName}-${index}`}
                    >
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div
                          aria-label={t("{rating} out of 5 stars", {
                            rating: review.rating,
                          })}
                          className="flex gap-0.5 text-base leading-none text-[#a48700]"
                        >
                          {"★".repeat(review.rating)}
                          <span className="text-[#d9d6cc]">
                            {"★".repeat(5 - review.rating)}
                          </span>
                        </div>
                        <span
                          aria-hidden="true"
                          className="grid size-9 place-items-center rounded-full bg-[#fff3b8] font-display text-2xl leading-none text-[#806a00]"
                        >
                          “
                        </span>
                      </div>
                      <p className="flex-1 font-display text-base font-semibold leading-7 text-[#334963] sm:text-[17px]">
                        “{review.review || t("No written comment.")}”
                      </p>
                      <div className="mt-5 flex items-center gap-3 border-t border-[#e7e3d9] pt-4">
                        {review.profilePicture ? (
                          <img
                            alt=""
                            aria-hidden="true"
                            className="size-11 shrink-0 rounded-full border-2 border-[#fff3b8] object-cover"
                            src={review.profilePicture}
                          />
                        ) : (
                          <span
                            aria-hidden="true"
                            className="grid size-11 shrink-0 place-items-center rounded-full bg-[#ffdc32] font-display text-lg font-bold text-[#102c50]"
                          >
                            {customerName.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-extrabold text-[#102c50]">
                            {customerName}
                          </p>
                          <p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-[0.1em] text-[#8a7500]">
                            {t(review.itemName)}
                          </p>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-8 text-center sm:py-10">
                <span
                  aria-hidden="true"
                  className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-[#ffdc32] text-xl text-[#092a53]"
                >
                  ✦
                </span>
                <p className="text-sm font-semibold text-white/85">
                  {t("No approved reviews yet.")}
                </p>
              </div>
            )}
          </div>
        </section>

        <section
          aria-labelledby="home-faq-heading"
          className="relative isolate overflow-hidden bg-white px-5 py-16 sm:px-8 sm:py-20 lg:px-10"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-24 top-12 size-64 rounded-full border-[38px] border-[#ffdc32]/20 sm:size-80"
          />
          <div className="relative z-10 mx-auto grid max-w-[1240px] gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
            <div className="lg:sticky lg:top-28 lg:h-fit">
              <p className="mb-3 inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#8a7500]">
                <span aria-hidden="true" className="text-base">
                  ✦
                </span>
                {t("Here to help")}
              </p>
              <h2
                className="font-display text-3xl font-extrabold leading-tight tracking-tight text-[#092a53] sm:text-4xl lg:text-5xl"
                id="home-faq-heading"
              >
                {t("Frequently Asked Questions")}
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-6 text-[#65748a]">
                {t(
                  "Find quick answers about this guide, local listings, and the information on our site.",
                )}
              </p>
              <Link
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#092a53] px-5 py-3 text-xs font-extrabold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#163e6b] sm:text-sm"
                to="/contact"
              >
                {t("Contact us")} <ArrowIcon />
              </Link>
            </div>
            <div className="space-y-3">
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
              ].map(({ question, answer }) => (
                <details
                  className="group rounded-2xl border border-[#e5e1d7] bg-[#fbfaf5] px-5 py-4 transition duration-200 hover:border-[#d9c76d] open:border-[#d9c76d] open:bg-white open:shadow-[0_14px_34px_rgba(18,44,80,0.08)] sm:px-6 sm:py-5"
                  key={question}
                >
                  <summary className="flex cursor-pointer list-none items-center gap-4 text-sm font-extrabold leading-6 text-[#092a53] marker:content-none sm:text-base">
                    <span
                      aria-hidden="true"
                      className="grid size-8 shrink-0 place-items-center rounded-full bg-[#fff3b8] text-xs font-extrabold text-[#806a00] transition group-open:bg-[#092a53] group-open:text-[#ffdc32]"
                    >
                      ?
                    </span>
                    <span className="flex-1">{t(question)}</span>
                    <span
                      aria-hidden="true"
                      className="grid size-8 shrink-0 place-items-center rounded-full border border-[#e7e3d9] text-[#65748a] transition duration-200 group-open:rotate-45 group-open:border-[#092a53] group-open:bg-[#092a53] group-open:text-white"
                    >
                      <svg className="size-4" fill="none" viewBox="0 0 24 24">
                        <path
                          d="M12 5v14M5 12h14"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeWidth="2"
                        />
                      </svg>
                    </span>
                  </summary>
                  <p className="ml-12 mt-3 max-w-2xl border-t border-[#eeeae1] pt-4 text-sm leading-6 text-[#65748a] sm:ml-12">
                    {t(answer)}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <InstagramSection />
      </main>
      <Footer />
    </div>
  );
}
