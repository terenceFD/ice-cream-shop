import { useEffect, useId, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowIcon, Footer, Header, InstagramSection } from "../../components/Layout";
import { coldStoneMenuCategories, getMenuItemId } from "../../../shared/data";
import { apiRequest, getCustomerToken } from "../../api/api";
import { useCart } from "../../context/useCart";
import { useLanguage } from "../../language/useLanguage";
import { normalizePhotoGallery } from "../../../shared/photoSizes.js";
import { useAuth } from "../../context/useAuth";
import { PageHero } from "../../components/PageHero";
import { ProductImageSlider } from "../../components/ProductImageSlider";
import { RatingBadge } from "../../components/RatingBadge";
import { photoErrorHandler, photoSrcSet, thumbnail } from "../../lib/thumbnails";
import { rankSimilar } from "../../lib/similarItems";
import { numberFormatter } from "../../lib/cartPricing";
import { RecentlyViewed } from "../../components/RecentlyViewed";
import { recordRecentlyViewed } from "../../lib/recentlyViewed";
import { stockSignal, stockSignalLabel } from "../../lib/stockSignal";
import { RestockNotice } from "../../components/RestockNotice";
import { AllergenInfo } from "../../components/AllergenInfo";
import { ShareProduct } from "../../components/ShareProduct";
import { useScrollReveal } from "../../lib/useScrollReveal";

const MAX_QUANTITY = 10;
const CAKE_SPECIMEN_FIELDS = [
  "bg-[#f1d9d0]",
  "bg-[#f2e8c9]",
  "bg-[#d9e5e9]",
  "bg-[#e6dced]",
];
const CATEGORY_HERO_THEMES = {
  "Ice Cream": { surface: "#472a3b", accent: "#ffb84d", imageSide: "right" },
  "Cakes & Pies": { surface: "#472a3b", accent: "#ffd0bd", imageSide: "left" },
  "Silk & Sorbet": { surface: "#472a3b", accent: "#f0c5db", imageSide: "right" },
  "Milkshakes & Smoothies": { surface: "#472a3b", accent: "#d9ed9a", imageSide: "left" },
  Novelties: { surface: "#472a3b", accent: "#ffd19a", imageSide: "right" },
  "Limited-Time Favorites": { surface: "#472a3b", accent: "#ffd37d", imageSide: "left" },
};
const DEFAULT_CATEGORY_HERO_THEME = {
  surface: "#472a3b",
  accent: "#ffb84d",
  imageSide: "right",
};

function BagIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
      <path d="M5 8h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9L5 8Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
      <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
    </svg>
  );
}

// small: always the small copy (tiny pictures). sizes: lets the browser choose the small copy
// or the full photo for the space the picture fills.
function MenuImage({ alt, className = "", sizes, small = false, src }) {
  return (
    <img decoding="async"
      alt={alt}
      className={className}
      loading="lazy"
      onError={photoErrorHandler(src, "/images/hero-ice-cream.jpg")}
      sizes={!small && sizes ? sizes : undefined}
      src={small ? thumbnail(src, "tiny") : src}
      srcSet={!small && sizes ? photoSrcSet(src) : undefined}
    />
  );
}

function FilterSelect({ label, onChange, options, value }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);
  const id = useId();
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const selected = options[selectedIndex];

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const openList = () => {
    setActiveIndex(selectedIndex);
    setOpen(true);
  };

  const choose = (index) => {
    onChange(options[index].value);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onButtonKeyDown = (event) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      openList();
    }
  };

  const onListKeyDown = (event) => {
    const last = options.length - 1;
    const moves = {
      ArrowDown: Math.min(activeIndex + 1, last),
      ArrowUp: Math.max(activeIndex - 1, 0),
      Home: 0,
      End: last,
    };
    if (event.key in moves) {
      event.preventDefault();
      setActiveIndex(moves[event.key]);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(activeIndex);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div className="relative lg:min-w-[180px]" ref={rootRef}>
      <button
        aria-controls={`${id}-list`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-labelledby={`${id}-label ${id}-value`}
        className={`flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left outline-none! transition ${
          open
            ? "bg-white ring-2 ring-brand-navy"
            : value
              ? "bg-[#fff3b8] ring-1 ring-[#e7d98b]"
              : "bg-white ring-1 ring-[#e4e7e3] hover:ring-[#9ca9b6]"
        }`}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onButtonKeyDown}
        ref={buttonRef}
        type="button"
      >
        <span className="min-w-0">
          <span
            className="block text-xs font-semibold text-[#65748a]"
            id={`${id}-label`}
          >
            {label}
          </span>
          <span
            className="mt-1 block truncate text-sm font-bold capitalize text-brand-navy"
            id={`${id}-value`}
          >
            {selected?.label}
          </span>
        </span>
        <svg
          aria-hidden="true"
          className={`size-4 shrink-0 text-[#65748a] transition duration-200 ${open ? "rotate-180 text-brand-navy" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
        >
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      </button>

      <ul
        aria-activedescendant={open ? `${id}-option-${activeIndex}` : undefined}
        aria-labelledby={`${id}-label`}
        className={`absolute inset-x-0 top-[calc(100%+8px)] z-40 max-h-72 origin-top sm:min-w-[200px] overflow-y-auto overscroll-contain rounded-2xl bg-white p-1.5 shadow-[0_24px_60px_rgba(9,42,83,0.18),0_2px_6px_rgba(9,42,83,0.06)] ring-1 ring-[#fbfaf5] outline-none! transition duration-150 ease-out ${
          open
            ? "visible translate-y-0 scale-100 opacity-100"
            : "invisible -translate-y-1 scale-[0.98] opacity-0"
        }`}
        id={`${id}-list`}
        onKeyDown={onListKeyDown}
        ref={listRef}
        role="listbox"
        tabIndex={-1}
      >
        {options.map((option, index) => {
          const isSelected = index === selectedIndex;
          const isActive = index === activeIndex;
          return (
            <li
              aria-selected={isSelected}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm capitalize transition-colors ${
                isActive                 ? "bg-[#f1f2ee]" : ""
              } ${isSelected ? "font-extrabold text-brand-navy" : "font-semibold text-[#65748a]"}`}
              data-index={index}
              id={`${id}-option-${index}`}
              key={option.value}
              onClick={() => choose(index)}
              onMouseEnter={() => setActiveIndex(index)}
              role="option"
            >
              <span className="truncate">{option.label}</span>
              <span
                aria-hidden="true"
                className={`grid size-5 shrink-0 place-items-center rounded-full transition ${
                  isSelected ? "bg-brand-navy text-white" : "text-transparent"
                }`}
              >
                <svg className="size-3" fill="none" viewBox="0 0 24 24">
                  <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
                </svg>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// onQuickAdd: adds one to the bag straight from the card, so ordering no longer needs the detail
// sheet. The card is a container with two separate buttons, because a button cannot hold a button.
function MenuProductCard({ category, item, itemIndex, onSelect, onQuickAdd, added, t, formatPrice }) {
  const soldOut = item.isAvailable === false || item.availableQuantity < 1;
  const isCakeCategory = category.title === "Cakes & Pies";
  return (
    <div className="scroll-reveal group relative flex h-full flex-col">
      <button
        className="flex flex-1 flex-col text-left"
        onClick={() => onSelect(category, item)}
        type="button"
      >
      <div
        className={`relative flex items-center justify-center overflow-hidden ${
          isCakeCategory
            ? `aspect-square ${CAKE_SPECIMEN_FIELDS[itemIndex % CAKE_SPECIMEN_FIELDS.length]}`
            : "aspect-square rounded-[20px] bg-[#f4f6f8]"
        }`}
      >
        <MenuImage
          alt={t(item.name)}
          className={`transition duration-700 ease-out motion-reduce:transition-none ${
            isCakeCategory
              ? "size-[90%] object-contain group-hover:scale-[1.04] group-focus-within:scale-[1.04]"
              : "size-full object-cover group-hover:scale-[1.04] group-focus-within:scale-[1.04]"
          } ${soldOut ? "opacity-70 grayscale-[70%]" : ""}`}
          sizes="(min-width: 1024px) 25vw, 50vw"
          src={item.image}
        />
        <span
          aria-hidden="true"
          className="menu-card-shine"
        />
        {soldOut && (
          <span className="absolute inset-x-0 bottom-0 z-10 bg-brand-navy px-3 py-2 text-center text-xs font-bold text-white">
            {t("Sold out")}
          </span>
        )}
      </div>

      <div className={`flex flex-1 flex-col ${isCakeCategory ? "pt-4 sm:pt-5" : "pt-4"}`}>
        <h3 className="line-clamp-2 font-display text-base font-extrabold leading-snug text-brand-navy sm:text-lg">
          {t(item.name)}
        </h3>
        {item.reviewCount > 0 && item.averageRating != null && (
          <div className="mt-1.5">
            <RatingBadge
              averageRating={item.averageRating}
              reviewCount={item.reviewCount}
            />
          </div>
        )}
        <p className={`mt-1.5 line-clamp-2 text-sm leading-6 text-[#65748a] ${
          isCakeCategory ? "min-h-[3.25rem]" : ""
        }`}>
          {t(item.detail)}
        </p>
        <span className="mt-auto pt-3 font-display text-base font-extrabold tabular-nums text-brand-navy sm:text-lg">
          {formatPrice(item.priceXaf)}
        </span>
      </div>
      </button>
      <button
        aria-label={
          soldOut
            ? t("{name} is sold out", { name: t(item.name) })
            : t("Add {name} to cart", { name: t(item.name) })
        }
        className={`mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg px-3 text-center text-sm font-bold leading-tight disabled:cursor-not-allowed ${
          added
            ? "bg-brand-yellow text-brand-navy"
            : soldOut
              ? "bg-[#f4f6f8] text-[#65748a]"
              : "bg-brand-navy text-white hover:bg-brand-blue"
        }`}
        disabled={soldOut}
        onClick={() => onQuickAdd?.(category, item)}
        type="button"
      >
        {added ? (
          <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
            <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
          </svg>
        ) : null}
        {soldOut ? t("Sold out") : added ? t("Added") : t("Add to cart")}
      </button>
    </div>
  );
}

// showCategory: only when the suggestion comes from another category than the product shown.
function SimilarProductCard({ category, item, onSelect, showCategory, t, formatPrice }) {
  const soldOut = item.isAvailable === false || item.availableQuantity < 1;
  return (
    <button
      className="scroll-reveal similar-card group flex h-full flex-col bg-white text-left text-brand-navy transition-opacity duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-4"
      onClick={() => onSelect(category, item)}
      type="button"
    >
      <span className="relative aspect-square overflow-hidden bg-[#e7e8e4]">
        <MenuImage
          alt=""
          className={`size-full object-cover transition duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.08] group-focus-visible:scale-[1.08] motion-reduce:transform-none motion-reduce:transition-none ${soldOut ? "grayscale" : ""}`}
          sizes="(min-width: 1024px) 25vw, 50vw"
          src={item.image}
        />
        <span aria-hidden="true" className="menu-card-shine" />
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 z-10 h-1 origin-left scale-x-0 bg-brand-yellow transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-100 group-focus-visible:scale-x-100 motion-reduce:transition-none"
        />
        {soldOut && (
          <span className="absolute left-0 top-0 z-10 bg-brand-navy px-3 py-2 text-xs font-extrabold text-white">
            {t("Sold out")}
          </span>
        )}
      </span>
      <span className="flex flex-1 flex-col px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
        {showCategory && (
          <span className="mb-1 truncate text-sm font-semibold text-[#65748a]">
            {t(category.title)}
          </span>
        )}
        <span className="line-clamp-2 font-display text-base font-extrabold leading-tight tracking-tight text-brand-navy underline decoration-[#ffb84d] decoration-2 underline-offset-[6px] decoration-transparent transition-[text-decoration-color] duration-300 group-hover:decoration-[#ffb84d] group-focus-visible:decoration-[#ffb84d] sm:text-lg">
          {t(item.name)}
        </span>
        <span className="mt-2 line-clamp-2 text-sm font-medium leading-6 text-[#40556f]">
          {t(item.detail)}
        </span>
        <span className="mt-auto flex items-center justify-between gap-3 pt-4">
          <span className="font-display text-base font-extrabold tabular-nums text-brand-navy">
            {formatPrice(item.priceXaf)}
          </span>
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center bg-brand-navy text-white transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-1 group-hover:-rotate-45 group-hover:bg-brand-yellow group-hover:text-brand-navy group-focus-visible:translate-x-1 group-focus-visible:-rotate-45 group-focus-visible:bg-brand-yellow group-focus-visible:text-brand-navy motion-reduce:transform-none"
          >
            <ArrowIcon />
          </span>
        </span>
      </span>
    </button>
  );
}

export function MenuPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { addItemsToCart } = useCart();
  const { customer } = useAuth();
  const { language, t } = useLanguage();
  const [selectedItemState, setSelectedItemState] = useState(null);
  const [search, setSearch] = useState("");
  const gridRef = useScrollReveal([selectedItemState, search]);
  const [categories, setCategories] = useState(coldStoneMenuCategories);
  const [menuError, setMenuError] = useState("");
  const productRef = useRef(null);
  const [cartNotice, setCartNotice] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const [quickAddedId, setQuickAddedId] = useState(null);
  const quickAddedTimer = useRef(undefined);
  const addedTimer = useRef(undefined);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [dietaryFilter, setDietaryFilter] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [favoriteError, setFavoriteError] = useState("");
  const [reviews, setReviews] = useState({
    averageRating: null,
    reviewCount: 0,
    reviews: [],
  });
  const requestedCategory = searchParams.get("category");
  const activeCategoryTitle = categories.some(
    (category) => category.title === requestedCategory,
  )
    ? requestedCategory
    : null;
  const activeCategory =
    categories.find((category) => category.title === activeCategoryTitle) ||
    null;
  const activeCategoryStats = {
    available: (activeCategory?.items ?? []).filter(
      (item) => item.isAvailable !== false && item.availableQuantity > 0,
    ).length,
    lowestPrice: activeCategory?.items.length
      ? Math.min(...activeCategory.items.map((item) => item.priceXaf))
      : null,
  };
  const activeCategoryTheme = activeCategory
    ? CATEGORY_HERO_THEMES[activeCategory.title] || DEFAULT_CATEGORY_HERO_THEME
    : DEFAULT_CATEGORY_HERO_THEME;
  const categoryHeroPreviews = (activeCategory?.items ?? [])
    .filter((item) => item.image && item.image !== activeCategory?.image)
    .slice(0, 2);
  const selectedItem =
    selectedItemState?.categoryTitle === activeCategoryTitle
      ? selectedItemState.item
      : null;
  const formatPrice = (price) =>
    `${numberFormatter(language === "fr" ? "fr-CM" : "en-CM").format(price)} FCFA`;

  // Links such as /menu?category=…&item=… (from the All menu page) open that product once the
  // live menu (with stock) has loaded; the item is then dropped from the address.
  const requestedItemName = searchParams.get("item");
  const liveMenuLoaded = categories !== coldStoneMenuCategories || Boolean(menuError);
  useEffect(() => {
    if (!requestedItemName || !activeCategory || !liveMenuLoaded) return;
    const item = activeCategory.items.find((entry) => entry.name === requestedItemName);
    if (item) setSelectedItemState({ categoryTitle: activeCategory.title, item });
    setSearchParams({ category: activeCategory.title }, { replace: true });
  }, [requestedItemName, activeCategory, liveMenuLoaded, setSearchParams]);
  const hasFilters = Boolean(
    search.trim() ||
    categoryFilter ||
    maxPrice ||
    dietaryFilter ||
    availabilityFilter,
  );
  const activeFilterCount = [
    search.trim(),
    categoryFilter,
    maxPrice,
    dietaryFilter,
    availabilityFilter,
  ].filter(Boolean).length;
  // Filters chosen behind the phone "Filters" button (search is always visible).
  const optionFilterCount = activeFilterCount - (search.trim() ? 1 : 0);
  const totalMenuItems = categories.reduce(
    (total, category) => total + category.items.length,
    0,
  );
  const featuredCategory =
    categories.find((category) => category.title === "Ice Cream") ||
    categories[0];
  const heroCategory = activeCategory || featuredCategory;
  const heroCategoryTheme = heroCategory
    ? CATEGORY_HERO_THEMES[heroCategory.title] || DEFAULT_CATEGORY_HERO_THEME
    : DEFAULT_CATEGORY_HERO_THEME;
  const heroCategoryStats = heroCategory
    ? {
        available: heroCategory.items.filter(
          (item) => item.isAvailable !== false && item.availableQuantity > 0,
        ).length,
        lowestPrice: heroCategory.items.length
          ? Math.min(...heroCategory.items.map((item) => item.priceXaf))
          : null,
      }
    : { available: 0, lowestPrice: null };
  // The category hero picture: a distinct composition per category, built from
  // that category's own product photos on its theme surface. Every category gets
  // its own arrangement, so switching categories visibly changes the hero.
  const heroItemPhotos = (heroCategory?.items ?? [])
    .filter((item) => item.image && item.image !== heroCategory?.image)
    .map((item) => item.image);
  const heroCategoryVisual = heroCategory && (() => {
    const title = heroCategory.title;
    const variant = {
      "Ice Cream": "stair",
      "Cakes & Pies": "stack",
      "Silk & Sorbet": "trio",
      "Milkshakes & Smoothies": "diagonal",
      Novelties: "ring",
      "Limited-Time Favorites": "banner",
    }[title] || "stair";
    const [photoA, photoB, photoC] = [
      heroCategory.image,
      ...heroItemPhotos,
      heroCategory.image,
    ].slice(0, 3);

    if (variant === "stack") {
      // Cakes & Pies: one wide cake on top, two squares beneath — a layer cake.
      return (
        <div className="flex size-full flex-col gap-3">
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-[28px] bg-white/10">
            <MenuImage
              alt={t(title)}
              className="size-full object-cover"
              sizes="(min-width: 1024px) 30vw, 60vw"
              src={photoA}
            />
            <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-extrabold text-brand-navy">
              {t("Slice or whole")}
            </span>
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
            {[photoB, photoC].map((photo, index) => (
              <div className="overflow-hidden rounded-[24px] bg-white/10" key={index}>
                <MenuImage alt="" className="size-full object-cover" small src={photo} />
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (variant === "trio") {
      // Silk & Sorbet: three round scoops in a row, the middle one bigger.
      return (
        <div className="flex size-full flex-row items-center justify-center gap-4">
          {[photoA, photoB, photoC].map((photo, index) => (
            <div
              className={`aspect-square shrink overflow-hidden rounded-full ring-4 ring-white/15 ${index === 1 ? "h-[62%]" : "h-[42%]"}`}
              key={index}
            >
              <MenuImage
                alt={index === 0 ? t(title) : ""}
                className="size-full object-cover"
                small={index !== 0}
                src={photo}
              />
            </div>
          ))}
        </div>
      );
    }

    if (variant === "diagonal") {
      // Milkshakes & Smoothies: three cups stepping up like a drinks board.
      return (
        <div className="flex size-full items-end justify-center gap-4 px-4">
          {[photoC, photoA, photoB].map((photo, index) => (
            <div
              className={`overflow-hidden rounded-[24px] bg-white/10 ${index === 1 ? "h-[88%] w-[38%]" : "h-[60%] w-[29%]"} ${index === 0 ? "mb-[8%]" : ""}`}
              key={index}
            >
              <MenuImage
                alt={index === 1 ? t(title) : ""}
                className="size-full object-cover"
                small={index !== 1}
                src={photo}
              />
            </div>
          ))}
        </div>
      );
    }

    if (variant === "ring") {
      // Novelties: one big centred treat with four small squares — a sweet-shop window.
      return (
        <div className="relative size-full">
          <div className="absolute left-[3%] top-[3%] size-[29%] overflow-hidden rounded-[22px] bg-white/10">
            <MenuImage alt="" className="size-full object-cover" small src={photoB} />
          </div>
          <div className="absolute right-[3%] top-[3%] size-[29%] overflow-hidden rounded-[22px] bg-white/10">
            <MenuImage alt="" className="size-full object-cover" small src={photoC} />
          </div>
          <div className="absolute left-1/2 top-1/2 size-[54%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full ring-4 ring-white/15">
            <MenuImage
              alt={t(title)}
              className="size-full object-cover"
              src={photoA}
              sizes="(min-width: 1024px) 30vw, 60vw"
            />
          </div>
          <div className="absolute bottom-[3%] left-[3%] size-[29%] overflow-hidden rounded-[22px] bg-white/10">
            <MenuImage alt="" className="size-full object-cover" small src={heroItemPhotos[1] || photoB} />
          </div>
          <div className="absolute bottom-[3%] right-[3%] size-[29%] overflow-hidden rounded-[22px] bg-white/10">
            <MenuImage alt="" className="size-full object-cover" small src={heroItemPhotos[2] || photoC} />
          </div>
        </div>
      );
    }

    if (variant === "banner") {
      // Limited-Time: full-bleed photo with a thick accent band under it — a poster.
      return (
        <div className="flex size-full flex-col overflow-hidden rounded-[28px]">
          <div className="min-h-0 flex-1 overflow-hidden">
            <MenuImage
              alt={t(title)}
              className="size-full object-cover"
              sizes="(min-width: 1024px) 30vw, 60vw"
              src={photoA}
            />
          </div>
          <div
            className="flex items-center justify-between px-6 py-5"
            style={{ backgroundColor: "var(--hero-accent)" }}
          >
            <span className="font-display text-xl font-extrabold text-brand-navy">
              {t("This month only")}
            </span>
            <span className="text-sm font-bold text-brand-navy/80">
              {t("{count} items", { count: heroCategory.items.length })}
            </span>
          </div>
        </div>
      );
    }

    // "stair" — Ice Cream (and the fallback): three tiles climbing like steps.
    return (
      <div className="grid size-full grid-cols-[2fr_3fr] grid-rows-2 gap-3">
        <div className="overflow-hidden rounded-[24px] bg-white/10">
          <MenuImage alt={t(title)} className="size-full object-cover" small src={photoA} />
        </div>
        <div className="row-span-2 overflow-hidden rounded-[24px] bg-white/10">
          <MenuImage alt="" className="size-full object-cover" sizes="(min-width: 1024px) 360px, 60vw" src={photoB} />
        </div>
        <div className="overflow-hidden rounded-[24px] bg-white/10">
          <MenuImage alt="" className="size-full object-cover" small src={photoC} />
        </div>
      </div>
    );
  })();

  const supportingCategories = categories.filter(
    (category) => category !== featuredCategory,
  );
  const clearFilters = () => {
    setSearch("");
    setCategoryFilter("");
    setMaxPrice("");
    setDietaryFilter("");
    setAvailabilityFilter("");
  };
  const filteredItems = categories.flatMap((category) =>
    category.items
      .filter(() => !categoryFilter || category.title === categoryFilter)
      .filter(
        () =>
          !activeCategoryTitle ||
          hasFilters ||
          category.title === activeCategoryTitle,
      )
      .filter(
        (item) =>
          !search.trim() ||
          `${item.name} ${item.detail} ${category.title}`
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
      )
      .filter((item) => !maxPrice || item.priceXaf <= Number(maxPrice))
      .filter(
        (item) => !dietaryFilter || item.dietaryTags?.includes(dietaryFilter),
      )
      .filter(
        (item) =>
          !availabilityFilter ||
          (availabilityFilter === "available"
            ? item.isAvailable !== false && item.availableQuantity > 0
            : item.isAvailable === false || item.availableQuantity < 1),
      )
      .map((item) => ({ category, item })),
  );
  // Sorting only reorders the matches.
  if (sortBy) {
    filteredItems.sort((a, b) => {
      if (sortBy === "price-asc") return a.item.priceXaf - b.item.priceXaf;
      if (sortBy === "price-desc") return b.item.priceXaf - a.item.priceXaf;
      return t(a.item.name).localeCompare(t(b.item.name));
    });
  }

  useEffect(() => {
    let cancelled = false;
    apiRequest("/menu")
      .then(({ categories: loadedCategories }) => {
        if (!cancelled) setCategories(loadedCategories);
      })
      .catch((loadError) => {
        if (!cancelled) setMenuError(loadError.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!customer) {
      setFavoriteIds(new Set());
      return undefined;
    }
    let cancelled = false;
    apiRequest("/customer/favorites", {
      token: getCustomerToken(),
    })
      .then(({ favorites }) => {
        if (!cancelled)
          setFavoriteIds(new Set(favorites.map((favorite) => favorite.itemId)));
      })
      .catch((error) => {
        if (!cancelled) setFavoriteError(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, [customer]);

  useEffect(() => {
    if (!selectedItem || !activeCategory) return undefined;
    const itemId =
      selectedItem.id || getMenuItemId(activeCategory.title, selectedItem.name);
    let cancelled = false;
    apiRequest(`/menu/${encodeURIComponent(itemId)}/reviews`)
      .then((result) => {
        if (!cancelled) setReviews(result);
      })
      .catch((error) => {
        if (!cancelled) setFavoriteError(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, [activeCategory, selectedItem]);

  const openedProductName = selectedItemState?.item?.name;
  useEffect(() => {
    setQuantity(1);
    setJustAdded(false);
    if (!openedProductName) return undefined;
    const frame = window.requestAnimationFrame(() => productRef.current?.scrollIntoView({ block: "start" }));
    return () => window.cancelAnimationFrame(frame);
  }, [openedProductName]);

  const showCategory = (category) => {
    setSearchParams({ category: category.title });
    setSelectedItemState(null);
    // The products change under a sticky tab bar, so put the first product row back on screen
    // instead of leaving the visitor part-way down the previous list.
    window.requestAnimationFrame(() =>
      document.getElementById("menu-category-items")?.scrollIntoView({ block: "start" }),
    );
  };

  const selectItem = (category, item) => {
    if (category.title !== activeCategoryTitle) {
      setSearchParams({ category: category.title });
    }
    setSelectedItemState({ categoryTitle: category.title, item });
    setCartNotice("");
    setSearch("");
    setCategoryFilter("");
    setMaxPrice("");
    setDietaryFilter("");
    setAvailabilityFilter("");
  };

  useEffect(() => () => window.clearTimeout(addedTimer.current), []);

  // Adds the chosen quantity and stays on the page, so customers can keep shopping.
  const addSelectedItem = () => {
    setCartNotice("");
    const added = addItemsToCart([{
      ...selectedItem,
      id:
        selectedItem.id ||
        getMenuItemId(activeCategory.title, selectedItem.name),
      itemType: "menu",
      categoryTitle: activeCategory.title,
      quantity,
    }]);
    if (added > 0) {
      setQuantity(1);
      setJustAdded(true);
      window.clearTimeout(addedTimer.current);
      addedTimer.current = window.setTimeout(() => setJustAdded(false), 1800);
    } else {
      setCartNotice(
        t("This item could not be added to your bag. Please try again."),
      );
    }
  };

  // Adds one to the bag from the product card, and ticks that card for a moment afterwards.
  const quickAddItem = (category, item) => {
    const id = item.id || getMenuItemId(category.title, item.name);
    const added = addItemsToCart([{
      ...item,
      id,
      itemType: "menu",
      categoryTitle: category.title,
      quantity: 1,
    }]);
    if (added > 0) {
      setQuickAddedId(id);
      window.clearTimeout(quickAddedTimer.current);
      quickAddedTimer.current = window.setTimeout(() => setQuickAddedId(null), 1800);
    } else {
      setCartNotice(
        t("This item could not be added to your bag. Please try again."),
      );
    }
  };

  async function saveFavorite() {
    if (!customer || !selectedItem || !activeCategory) return;
    const itemId =
      selectedItem.id || getMenuItemId(activeCategory.title, selectedItem.name);
    setFavoriteError("");
    try {
      if (favoriteIds.has(itemId)) {
        await apiRequest(`/customer/favorites/${encodeURIComponent(itemId)}`, {
          method: "DELETE",
          token: getCustomerToken(),
        });
        setFavoriteIds(
          (current) => new Set([...current].filter((id) => id !== itemId)),
        );
      } else {
        await apiRequest("/customer/favorites", {
          method: "POST",
          token: getCustomerToken(),
          body: { itemId },
        });
        setFavoriteIds((current) => new Set([...current, itemId]));
      }
    } catch (error) {
      setFavoriteError(error.message);
    }
  }

  // Eight suggestions: the same category first, then products sharing ingredients.
  const similarItems =
    selectedItem && activeCategory
      ? rankSimilar(
          { key: `${activeCategory.title}:${selectedItem.name}`, group: activeCategory.title, text: `${selectedItem.name} ${selectedItem.detail || ""}` },
          categories.flatMap((category) =>
            category.items.map((item) => ({ key: `${category.title}:${item.name}`, group: category.title, text: `${item.name} ${item.detail || ""}`, category, item })),
          ),
          8,
        )
      : [];
  const selectedSoldOut = Boolean(
    selectedItem &&
      (selectedItem.isAvailable === false || selectedItem.availableQuantity < 1),
  );
  const maxQuantity = Math.max(1, Math.min(MAX_QUANTITY, selectedItem?.availableQuantity ?? MAX_QUANTITY));
  const selectedStockSignal = stockSignal(selectedItem?.availableQuantity, {
    lowStockThreshold: selectedItem?.lowStockThreshold,
    soldOut: selectedSoldOut,
  });
  const selectedIsFavorite = Boolean(
    selectedItem &&
      activeCategory &&
      favoriteIds.has(
        selectedItem.id || getMenuItemId(activeCategory.title, selectedItem.name),
      ),
  );

  // Remember the product as soon as it is opened, for the recently viewed row.
  useEffect(() => {
    if (!selectedItem || !activeCategory) return;
    const id = selectedItem.id || getMenuItemId(activeCategory.title, selectedItem.name);
    recordRecentlyViewed({
      // The id already carries its "menu:" prefix; adding another broke the exclusion on
      // this page, so the row never appeared.
      key: String(id).startsWith("menu:") ? String(id) : `menu:${id}`,
      name: selectedItem.name,
      image: selectedItem.image,
      priceXaf: selectedItem.priceXaf,
      detail: selectedItem.detail,
      to: `/menu?${new URLSearchParams({ category: activeCategory.title, item: selectedItem.name })}`,
    });
  }, [selectedItem, activeCategory]);

  // The all-menu hero picture: the site's own product photography, set as a
  // flat block collage — one dominant tile, two supporting, cleanly aligned.
  const allMenuVisual = (
    <div className="grid size-full grid-cols-[2fr_3fr] grid-rows-2 gap-3">
      <MenuImage
        alt={t("Berry Berry Berry Good ice cream")}
        className="h-full w-full object-cover"
        small
        src="/menu-official/ice-cream/signature-creations/berry-berry-berry-good.webp"
      />
      <MenuImage
        alt={t("Birthday Cake Remix ice cream")}
        className="row-span-2 h-full w-full object-cover"
        sizes="(min-width: 1024px) 360px, 60vw"
        src="/menu-official/ice-cream/signature-creations/birthday-cake-remix.webp"
      />
      <MenuImage
        alt={t("Chocolate Devotion ice cream")}
        className="h-full w-full object-cover"
        small
        src="/menu-official/ice-cream/signature-creations/chocolate-devotion.webp"
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fbfaf5] text-brand-navy">
      <Header />
      <main id="main" tabIndex={-1}>
        {activeCategory ? (
          <PageHero
            compactOnMobile
            accent={activeCategoryTheme.accent}
            actions={
              <>
                <a className={PageHero.primary} href="#menu-category-items">
                  {t("Browse {title}", { title: t(activeCategory.title) })} <span aria-hidden="true">↓</span>
                </a>
                <Link className={PageHero.secondary} to="/custom-cake">
                  {t("Request a custom cake")}
                </Link>
              </>
            }
            badge={{
              mark: heroCategoryStats.lowestPrice !== null ? "₣" : "✦",
              eyebrow: t("Starting from"),
              text:
                heroCategoryStats.lowestPrice !== null
                  ? formatPrice(heroCategoryStats.lowestPrice)
                  : t("A treat made your way"),
            }}
            description={t(activeCategory.description)}
            eyebrow={t("{count} items on the menu", { count: activeCategory.items.length })}
            stats={[
              { label: t("Menu items"), value: activeCategory.items.length },
              { label: t("Available"), value: heroCategoryStats.available, accent: true },
            ]}
            surface={activeCategoryTheme.surface}
            title={t(activeCategory.title)}
            visual={heroCategoryVisual}
          />
        ) : (
          <PageHero
            compactOnMobile
            actions={
              <>
                <a className={PageHero.primary} href="#menu-content">
                  {t("Explore the menu")} <span aria-hidden="true">↓</span>
                </a>
                <Link className={PageHero.secondary} to="/custom-cake">
                  {t("Request a custom cake")}
                </Link>
              </>
            }
            badge={{
              mark: "✦",
              eyebrow: t("Signature creations"),
              text: t("A treat made your way"),
            }}
            description={t(
              "Signature creations, ice cream cakes and pies, shakes, smoothies and seasonal treats, made fresh for you. Order online for pickup or delivery.",
            )}
            eyebrow={t("The Cold Stone experience")}
            stats={[
              { label: t("Menu categories"), value: categories.length },
              { label: t("Menu items"), value: totalMenuItems, accent: true },
            ]}
            title={t("Menu & treats")}
            visual={allMenuVisual}
          />
        )}

        <div
          className="mx-auto max-w-[1320px] scroll-mt-4 px-5 py-10 sm:px-8 sm:py-14 lg:px-12"
          id="menu-content"
        >
          {menuError && (
            <p
              className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
              role="status"
            >
              {t("Some saved menu items may not be available right now.")}:{" "}
              {menuError}
            </p>
          )}

          <section
            aria-label={t("Search and filter menu")}
            className="relative z-40 mb-8 rounded-[24px] bg-[#f1f2ee] p-3 sm:mb-12 sm:p-4"
          >
            <div className="flex flex-col gap-3 xl:flex-row xl:items-stretch">
              <div className="flex flex-1 gap-2">
              <label className="group relative flex min-w-0 flex-1 items-center rounded-2xl bg-white ring-1 ring-transparent transition focus-within:ring-brand-navy">
                <span className="sr-only">{t("Search menu")}</span>
                <svg
                  aria-hidden="true"
                  className="pointer-events-none absolute left-5 size-5 text-[#65748a] transition group-focus-within:text-brand-navy"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                  <path d="m20 20-3.5-3.5" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                </svg>
                <input
                  className="w-full bg-transparent py-4 pl-14 pr-12 text-base font-semibold text-brand-navy outline-none! placeholder:font-medium placeholder:text-[#65748a]"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("Search menu")}
                  type="search"
                  value={search}
                />
                {search && (
                  <button
                    aria-label={t("Clear search")}
                    className="absolute right-3 grid size-8 place-items-center rounded-full text-[#65748a] transition hover:bg-[#fbfaf5] hover:text-brand-navy"
                    onClick={() => setSearch("")}
                    type="button"
                  >
                    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
                      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                    </svg>
                  </button>
                )}
              </label>
              {/* Phones: the filters fold away behind this button so food shows sooner. */}
              <button
                aria-controls="menu-filter-options"
                aria-expanded={filtersOpen}
                className={`relative inline-flex shrink-0 items-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow-deep sm:hidden ${
                  filtersOpen ? "bg-brand-navy text-white" : "bg-white text-brand-navy ring-1 ring-[#e4e7e3]"
                }`}
                onClick={() => setFiltersOpen((open) => !open)}
                type="button"
              >
                <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
                  <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                </svg>
                {t("Filters")}
                {optionFilterCount > 0 && (
                  <span className="grid size-5 place-items-center rounded-md bg-brand-yellow text-xs tabular-nums text-brand-navy">
                    {optionFilterCount}
                  </span>
                )}
              </button>
              </div>

              <div
                className={`grid-cols-2 gap-3 sm:grid sm:grid-cols-3 xl:flex xl:flex-none ${filtersOpen ? "grid" : "hidden"}`}
                id="menu-filter-options"
              >
                {[
                  {
                    label: "Category",
                    value: categoryFilter,
                    onChange: setCategoryFilter,
                    options: [
                      ["", "All categories"],
                      ...categories.map((category) => [category.title, category.title]),
                    ],
                  },
                  {
                    label: "Dietary needs",
                    value: dietaryFilter,
                    onChange: setDietaryFilter,
                    options: [
                      ["", "Any"],
                      ...["vegetarian", "vegan", "dairy-free", "gluten-free", "nut-free"].map((tag) => [tag, tag]),
                    ],
                  },
                  {
                    label: "Availability",
                    value: availabilityFilter,
                    onChange: setAvailabilityFilter,
                    options: [
                      ["", "Any"],
                      ["available", "In stock only"],
                      ["sold-out", "Sold out"],
                    ],
                  },
                  {
                    label: "Sort by",
                    value: sortBy,
                    onChange: setSortBy,
                    options: [
                      ["", "Recommended"],
                      ["price-asc", "Price: low to high"],
                      ["price-desc", "Price: high to low"],
                      ["name", "Name: A to Z"],
                    ],
                  },
                ].map((filter) => (
                  <FilterSelect
                    key={filter.label}
                    label={t(filter.label)}
                    onChange={filter.onChange}
                    options={filter.options.map(([value, label]) => ({
                      value,
                      label: t(label),
                    }))}
                    value={filter.value}
                  />
                ))}

                <label
                  className={`relative flex flex-col justify-center rounded-2xl px-4 py-3 ring-1 transition xl:w-[170px] ${
                    maxPrice ? "bg-[#fff3b8] ring-[#e7d98b]" : "bg-white ring-transparent hover:ring-[#9ca9b6]"
                  }`}
                >
                  <span className="truncate text-xs font-semibold text-[#65748a]">
                    {t("Maximum price")}
                  </span>
                  <span className="mt-0.5 flex items-baseline gap-1.5">
                    <input
                      className="w-full min-w-0 bg-transparent text-sm font-bold tabular-nums text-brand-navy outline-none! placeholder:font-medium placeholder:text-[#65748a]"
                      inputMode="numeric"
                      min="0"
                      onChange={(event) => setMaxPrice(event.target.value)}
                      placeholder={t("Any")}
                      step="500"
                      type="number"
                      value={maxPrice}
                    />
                    <span className="shrink-0 text-xs font-bold text-[#65748a]">FCFA</span>
                  </span>
                </label>
              </div>
            </div>

            {hasFilters && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#fbfaf5] px-2 pt-3">
                <p aria-live="polite" className="text-xs font-bold text-[#65748a]">
                  <span className="mr-2 inline-grid size-5 place-items-center rounded-full bg-brand-navy text-xs font-extrabold tabular-nums text-white">
                    {activeFilterCount}
                  </span>
                  {t("Filters")}
                  <span aria-hidden="true" className="mx-2 text-[#c9c3b4]">·</span>
                  {t("Matching menu items")}: {filteredItems.length}
                </p>
                <button
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold text-brand-navy underline decoration-[#ffb84d] decoration-2 underline-offset-4 transition hover:bg-[#fbfaf5]"
                  onClick={clearFilters}
                  type="button"
                >
                  {t("Clear filters")}
                </button>
              </div>
            )}
          </section>

          {hasFilters ? (
            <section aria-live="polite">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                <h2 className="font-display text-2xl font-bold">
                  {t("Matching menu items")} ({filteredItems.length})
                </h2>
              </div>
              {filteredItems.length ? (
                <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 sm:gap-y-12 lg:grid-cols-3 xl:grid-cols-4" ref={gridRef}>
                  {filteredItems.map(({ category, item }) => (
                    <MenuProductCard
                      category={category}
                      formatPrice={formatPrice}
                      item={item}
                      key={item.id || getMenuItemId(category.title, item.name)}
                      onSelect={selectItem}
                      t={t}
                    />
                  ))}
                </div>
              ) : (
                <p className="rounded-xl bg-[#f4f2f2] p-5 text-sm text-[#65748a]">
                  {t("No menu items match those filters.")}
                </p>
              )}
            </section>
          ) : selectedItem && activeCategory ? (
            <section aria-labelledby="menu-product-title" className="scroll-mt-24" ref={productRef}>
              <nav
                aria-label={t("Breadcrumb")}
                className="mb-8 flex flex-wrap items-center gap-2 text-xs font-bold text-[#65748a]"
              >
                <button
                  className="rounded-full transition hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow-deep"
                  onClick={() => setSearchParams({})}
                  type="button"
                >
                  {t("Menu")}
                </button>
                <span aria-hidden="true" className="text-[#c9c3b4]">/</span>
                <button
                  className="rounded-full transition hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow-deep"
                  onClick={() => setSelectedItemState(null)}
                  type="button"
                >
                  {t(activeCategory.title)}
                </button>
                <span aria-hidden="true" className="text-[#c9c3b4]">/</span>
                <span aria-current="page" className="max-w-[16rem] truncate text-brand-navy">
                  {t(selectedItem.name)}
                </span>
              </nav>

              <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:gap-14">
                <div className="lg:sticky lg:top-[calc(var(--site-header-offset,0px)+1.5rem)]">
                  <ProductImageSlider
                    frameClassName="rounded-[20px]! bg-[#f4f6f8] shadow-none!"
                    imageClassName={`aspect-[4/3] lg:aspect-[5/4] ${selectedSoldOut ? "grayscale-[60%]" : ""}`}
                    images={[selectedItem.image, ...normalizePhotoGallery(selectedItem.gallery)]}
                    name={t(selectedItem.name)}
                    priority
                    overlay={
                      selectedSoldOut ? (
                        <span className="absolute left-4 top-4 rounded-full bg-brand-navy px-3 py-1.5 text-xs font-bold text-white">
                          {t("Sold out")}
                        </span>
                      ) : null
                    }
                    resetKey={selectedItem.id || selectedItem.name}
                    showScrim={false}
                  />
                </div>

                <div className="flex min-w-0 flex-col lg:py-2">
                  <p className="w-fit text-sm font-bold text-brand-navy underline decoration-[#ffb84d] decoration-2 underline-offset-4">
                    {t(activeCategory.title)}
                  </p>
                  <h2
                    className="mt-3 break-words font-display text-4xl font-extrabold leading-[1.02] tracking-tight text-brand-navy sm:text-5xl"
                    id="menu-product-title"
                  >
                    {t(selectedItem.name)}
                  </h2>

                  {reviews.reviewCount > 0 && (
                    <a
                      aria-live="polite"
                      className="mt-4 inline-flex w-fit items-center gap-2 text-sm font-bold text-[#65748a] transition hover:text-brand-navy"
                      href="#menu-product-reviews"
                    >
                      <span
                        aria-label={t("{rating} out of 5 stars", {
                          rating: reviews.averageRating,
                        })}
                        className="text-base text-brand-yellow"
                      >
                        {"★".repeat(Math.round(reviews.averageRating))}
                        <span className="text-[#dce3eb]">
                          {"★".repeat(5 - Math.round(reviews.averageRating))}
                        </span>
                      </span>
                      <span className="text-brand-navy">{reviews.averageRating}</span>
                      <span className="underline decoration-[#ffb84d] decoration-2 underline-offset-4">
                        {reviews.reviewCount} {t("reviews")}
                      </span>
                    </a>
                  )}

                  <p className="mt-5 max-w-xl text-base leading-7 text-brand-blue">
                    {t(selectedItem.detail)}
                  </p>

                  <AllergenInfo
                    allergens={selectedItem.allergens}
                    allergensRecorded={selectedItem.allergensRecorded}
                    className="mt-5"
                    dietaryTags={selectedItem.dietaryTags || []}
                  />

                  <ShareProduct
                    className="mt-4"
                    text={selectedItem.detail}
                    title={selectedItem.name}
                  />

                  <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
                    <p className="font-display text-4xl font-extrabold tabular-nums leading-none text-brand-navy">
                      {formatPrice(selectedItem.priceXaf)}
                    </p>
                    {/* Plenty in stock gets a quiet confirmation; a thin stock gets a louder
                        one. Either way the shopper knows before adding to the bag. */}
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold ${
                        selectedSoldOut
                          ? "bg-[#f4f6f8] text-[#65748a]"
                          : selectedStockSignal.kind === "last-few"
                            ? "bg-[#ffe9e3] text-[#9b2c17]"
                            : selectedStockSignal.kind === "low"
                              ? "bg-[#fff6dc] text-brand-yellow-deep"
                              : "bg-[#f3f8ef] text-[#37632c]"
                      }`}
                      role="status"
                    >
                      {!selectedSoldOut && (
                        <span
                          aria-hidden="true"
                          className={`size-1.5 rounded-full ${
                            selectedStockSignal.kind === "last-few"
                              ? "animate-pulse bg-[#c0392b] motion-reduce:animate-none"
                              : selectedStockSignal.kind === "low"
                                ? "bg-[#d4ad00]"
                                : "bg-[#4caf50]"
                          }`}
                        />
                      )}
                      {selectedSoldOut ? (
                        t("Sold out")
                      ) : selectedStockSignal.kind === "last-few" || selectedStockSignal.kind === "low" ? (
                        stockSignalLabel(selectedStockSignal, t)
                      ) : (
                        t("In stock")
                      )}
                    </span>
                  </div>

                  {selectedSoldOut && (
                    <div className="mt-6">
                      <RestockNotice restockEta={selectedItem.restockEta} />
                    </div>
                  )}

                  <div className="mt-6 flex gap-3">
                    {!selectedSoldOut && (
                      <div aria-label={t("Quantity")} className="flex shrink-0 items-center rounded-lg bg-[#f4f6f8] p-1" role="group">
                        <button
                          aria-label={t("Decrease quantity")}
                          className="grid size-11 place-items-center rounded-md text-lg font-bold text-brand-navy transition hover:bg-white disabled:cursor-not-allowed disabled:text-[#65748a] disabled:hover:bg-transparent"
                          disabled={quantity <= 1}
                          onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                          type="button"
                        >
                          −
                        </button>
                        <output aria-live="polite" className="w-8 text-center font-display text-lg font-extrabold tabular-nums text-brand-navy">
                          {quantity}
                        </output>
                        <button
                          aria-label={t("Increase quantity")}
                          className="grid size-11 place-items-center rounded-md text-lg font-bold text-brand-navy transition hover:bg-white disabled:cursor-not-allowed disabled:text-[#65748a] disabled:hover:bg-transparent"
                          disabled={quantity >= maxQuantity}
                          onClick={() => setQuantity((current) => Math.min(maxQuantity, current + 1))}
                          type="button"
                        >
                          +
                        </button>
                      </div>
                    )}
                    <button
                      className={`inline-flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#dce3eb] disabled:text-[#65748a] sm:px-6 ${
                        justAdded ? "bg-[#3d8b40]" : "bg-brand-navy hover:bg-brand-blue"
                      }`}
                      disabled={selectedSoldOut}
                      onClick={addSelectedItem}
                      type="button"
                    >
                      {selectedSoldOut ? t("Sold out") : justAdded ? <CheckIcon /> : <BagIcon />}
                      {!selectedSoldOut && (
                        <span aria-live="polite">
                          {justAdded ? t("Added") : (
                            <>
                              {t("Add to bag")}
                              <span className="max-sm:hidden"> {formatPrice(selectedItem.priceXaf * quantity)}</span>
                            </>
                          )}
                        </span>
                      )}
                    </button>
                    {customer && (
                      <button
                        aria-label={
                          selectedIsFavorite
                            ? t("Remove from favorites")
                            : t("Save to favorites")
                        }
                        aria-pressed={selectedIsFavorite}
                        className={`grid size-12 shrink-0 place-items-center rounded-lg border text-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow-deep focus-visible:ring-offset-2 ${
                          selectedIsFavorite
                            ? "border-[#f56586] bg-[#fff0f3] text-[#e0435f]"
                            : "border-[#dce3eb] bg-white text-[#65748a] hover:border-brand-navy hover:text-brand-navy"
                        }`}
                        onClick={saveFavorite}
                        title={
                          selectedIsFavorite
                            ? t("Remove from favorites")
                            : t("Save to favorites")
                        }
                        type="button"
                      >
                        <span aria-hidden="true">{selectedIsFavorite ? "♥" : "♡"}</span>
                      </button>
                    )}
                  </div>
                  {cartNotice && (
                    <p className="mt-3 text-sm leading-5 text-red-700" role="alert">
                      {cartNotice}
                    </p>
                  )}
                  {favoriteError && (
                    <p className="mt-3 text-sm leading-5 text-red-700" role="alert">
                      {favoriteError}
                    </p>
                  )}
                  <Link
                    className="mt-4 w-fit text-sm font-extrabold text-brand-navy underline decoration-[#ffb84d] decoration-2 underline-offset-4"
                    to="/cart"
                  >
                    {t("View cart")}
                  </Link>

                  <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2">
                    {["Mixed to order", "Made to your taste", "Freshly made"].map((label) => (
                      <li className="inline-flex items-center gap-2 text-sm font-semibold text-brand-navy" key={label}>
                        <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-brand-yellow" />
                        {t(label)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {reviews.reviews.length > 0 && (
                <section
                  aria-labelledby="menu-product-reviews-title"
                  className="mt-20 scroll-mt-8 border-t border-[#fbfaf5] pt-14"
                  id="menu-product-reviews"
                >
                  <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
                    <div className="lg:col-span-4">
                      <h3
                        className="font-display text-3xl font-extrabold tracking-tight text-brand-navy sm:text-4xl"
                        id="menu-product-reviews-title"
                      >
                        {t("Customer reviews")}
                      </h3>
                      <div className="mt-6 flex items-end gap-4">
                        <span className="font-display text-6xl font-extrabold leading-none tabular-nums text-brand-navy">
                          {reviews.averageRating}
                        </span>
                        <div className="pb-1">
                          <p aria-hidden="true" className="text-lg tracking-[0.1em] text-[#d4ad00]">
                            {"★".repeat(Math.round(reviews.averageRating))}
                            <span className="text-[#e2ddd0]">
                              {"★".repeat(5 - Math.round(reviews.averageRating))}
                            </span>
                          </p>
                          <p className="text-xs font-bold text-[#65748a]">
                            {reviews.reviewCount} {t("reviews")}
                          </p>
                        </div>
                      </div>
                    </div>
                    <ul className="grid gap-4 sm:grid-cols-2 lg:col-span-8">
                      {reviews.reviews.map((review, index) => (
                        <li
                          className="flex flex-col rounded-[22px] border border-[#fbfaf5] bg-white p-6"
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
                              <img decoding="async" loading="lazy"
                                alt=""
                                className="size-9 rounded-full object-cover"
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
                  </div>
                </section>
              )}

              <section
                aria-labelledby="similar-products-title"
                className="-mx-5 mt-20 bg-[#f1f2ee] px-5 py-12 sm:-mx-8 sm:px-8 sm:py-16 lg:-mx-12 lg:px-12"
              >
                <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                  <h3
                    className="max-w-[14ch] font-display text-4xl font-extrabold leading-[1.02] tracking-tight text-brand-navy sm:text-5xl"
                    id="similar-products-title"
                  >
                    {t("Similar products")}
                  </h3>
                  <button
                    className="inline-flex min-h-12 shrink-0 items-center self-start bg-brand-navy px-5 py-3 text-sm font-extrabold text-white transition hover:bg-brand-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow focus-visible:ring-offset-2 sm:self-auto"
                    onClick={() => setSelectedItemState(null)}
                    type="button"
                  >
                    {t("Back to category")}: {t(activeCategory.title)}
                  </button>
                </div>
                <div className="similar-grid mt-10 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4" ref={gridRef}>
                  {similarItems.map(({ category, item }) => (
                    <SimilarProductCard
                      category={category}
                      formatPrice={formatPrice}
                      item={item}
                      key={item.name}
                      onSelect={selectItem}
                      showCategory={category.title !== activeCategory.title}
                      t={t}
                    />
                  ))}
                </div>
              </section>

              <section id="product-recently-viewed" className="mt-16">
                <RecentlyViewed
                  excludeKey={String(selectedItem.id || getMenuItemId(activeCategory.title, selectedItem.name)).replace("menu:", "menu:")}
                  onSelect={(entry) => {
                    // Open the remembered product in the same detail view instead of reloading.
                    const remembered = categories
                      .flatMap((category) => category.items.map((item) => ({ category, item })))
                      .find(({ category, item }) =>
                        String(item.id || getMenuItemId(category.title, item.name)).replace(/^(menu:)+/, "menu:") ===
                        entry.key.replace(/^(menu:)+/, "menu:"));
                    if (!remembered) return false;
                    selectItem(remembered.category, remembered.item);
                    return true;
                  }}
                  title={t("Recently viewed")}
                />
              </section>
            </section>
          ) : activeCategory ? (
            <section aria-labelledby="menu-category-title">
              <nav
                aria-label={t("Breadcrumb")}
                className="mb-6 flex flex-wrap items-center gap-2 text-xs font-bold text-[#65748a]"
              >
                <button
                  className="inline-flex items-center gap-1.5 rounded-full transition hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow-deep"
                  onClick={() => setSearchParams({})}
                  type="button"
                >
                  <span aria-hidden="true">←</span> {t("Back to categories")}
                </button>
                <span aria-hidden="true" className="text-[#c9c3b4]">/</span>
                <span aria-current="page" className="text-brand-navy">
                  {t(activeCategory.title)}
                </span>
              </nav>

              <div
                className="menu-category-hero overflow-hidden bg-[var(--category-hero-surface)] text-white"
                data-image-side={activeCategoryTheme.imageSide}
                data-theme={activeCategory.title}
                style={{
                  "--category-hero-surface": activeCategoryTheme.surface,
                  "--category-hero-accent": activeCategoryTheme.accent,
                }}
              >
                <div className="grid md:grid-cols-2">
                  <div className={`menu-category-hero-gallery order-first flex flex-col bg-white/[0.06] ${activeCategoryTheme.imageSide === "left" ? "md:order-first" : "md:order-last"}`}>
                    <MenuImage
                      alt={t(activeCategory.title)}
                      className="menu-category-hero-image aspect-[4/3] w-full bg-[#f4f6f8] object-cover md:min-h-[360px] md:flex-1"
                      sizes="(min-width: 768px) 50vw, 100vw"
                      src={activeCategory.image}
                    />
                    {categoryHeroPreviews.length > 0 && (
                      <ul aria-label={t("Menu items")} className="grid grid-cols-2 divide-x divide-white/15 px-3 py-3 sm:px-4 sm:py-4">
                        {categoryHeroPreviews.map((item) => (
                          <li className="flex min-w-0 items-center gap-3" key={item.id || item.name}>
                            <MenuImage
                              alt=""
                              className="size-14 shrink-0 object-cover sm:size-16"
                              small
                              src={item.image}
                            />
                            <span className="min-w-0">
                              <span className="block line-clamp-2 text-xs font-bold leading-4 sm:text-sm sm:leading-5">
                                {t(item.name)}
                              </span>
                              <span className="mt-1 block text-xs font-semibold tabular-nums text-white/70">
                                {formatPrice(item.priceXaf)}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className={`menu-category-hero-copy flex flex-col justify-between gap-8 p-6 sm:p-10 lg:p-12 ${activeCategoryTheme.imageSide === "left" ? "md:order-last" : "md:order-first"}`}>
                    <div>
                      <h2
                        className="font-display text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-5xl lg:text-6xl"
                        id="menu-category-title"
                      >
                        {t(activeCategory.title)}
                      </h2>
                      <p className="mt-5 max-w-xl text-base leading-7 text-white/85 sm:text-lg sm:leading-8">
                        {t(activeCategory.description)}
                      </p>
                    </div>

                    <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
                      <div>
                        <dt className="text-sm font-semibold text-white/75">
                          {t("Menu items")}
                        </dt>
                        <dd className="mt-1 font-display text-3xl font-extrabold tabular-nums text-white">
                          {activeCategory.items.length}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-semibold text-white/75">
                          {t("Available")}
                        </dt>
                        <dd className="mt-1 font-display text-3xl font-extrabold tabular-nums text-white">
                          {activeCategoryStats.available}
                        </dd>
                      </div>
                      {activeCategoryStats.lowestPrice !== null && (
                        <div className="col-span-2 sm:col-span-1">
                          <dt className="text-sm font-semibold text-white/75">
                            {t("Starting from")}
                          </dt>
                          <dd className="mt-1 font-display text-2xl font-extrabold tabular-nums text-[var(--category-hero-accent)] sm:text-3xl">
                            {formatPrice(activeCategoryStats.lowestPrice)}
                          </dd>
                        </div>
                      )}
                    </dl>

                    <a
                      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--category-hero-accent)] px-6 py-3.5 text-sm font-extrabold text-brand-navy transition-colors hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 sm:w-fit"
                      href="#menu-category-items"
                    >
                      {t("Browse items")} <span aria-hidden="true">↓</span>
                    </a>
                  </div>
                </div>
              </div>

              <nav
                aria-label={t("Menu categories")}
                className="sticky top-[var(--site-header-offset,0px)] z-30 -mx-5 mt-8 bg-white px-5 transition-[top] duration-300 sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12"
              >
                <ul className="flex gap-2 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {categories.map((category) => {
                    const active = category.title === activeCategory.title;
                    return (
                      <li className="shrink-0" key={category.title}>
                        <button
                          aria-current={active ? "page" : undefined}
                          className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-yellow-deep ${
                            active
                              ? "bg-brand-navy text-white"
                              : "bg-[#f1f2ee] text-[#65748a] hover:bg-[#e7e9e4] hover:text-brand-navy"
                          }`}
                          onClick={() => showCategory(category)}
                          type="button"
                        >
                          {t(category.title)}
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${
                              active ? "bg-white/15 text-white" : "bg-white text-[#65748a]"
                            }`}
                          >
                            {category.items.length}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              <div
                className="mb-8 mt-10 flex scroll-mt-24 flex-wrap items-end justify-between gap-4"
                id="menu-category-items"
              >
                <div>
                  <h3 className="font-display text-3xl font-extrabold tracking-tight text-brand-navy sm:text-4xl">
                    {t(activeCategory.title)}
                  </h3>
                  <p className="mt-2 text-sm font-semibold text-[#65748a]">
                    {t("Menu items")}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 sm:gap-y-12 lg:grid-cols-3 xl:grid-cols-4" ref={gridRef}>
                {activeCategory.items.map((item, itemIndex) => (
                  <MenuProductCard
                    added={
                      quickAddedId ===
                      (item.id || getMenuItemId(activeCategory.title, item.name))
                    }
                    category={activeCategory}
                    formatPrice={formatPrice}
                    item={item}
                    itemIndex={itemIndex}
                    key={
                      item.id || getMenuItemId(activeCategory.title, item.name)
                    }
                    onQuickAdd={quickAddItem}
                    onSelect={selectItem}
                    t={t}
                  />
                ))}
              </div>
            </section>
          ) : (
            <section
              aria-labelledby="menu-categories-title"
              className="-mx-5 bg-[#f4f6f8] px-5 py-10 sm:-mx-8 sm:px-8 sm:py-14 lg:-mx-12 lg:px-12"
            >
              <div className="mx-auto max-w-[1320px] bg-white p-5 sm:p-8 lg:p-10">
                <div className="mb-8 flex flex-wrap items-end justify-between gap-4 sm:mb-10">
                  <h2
                    className="font-display text-3xl font-extrabold leading-tight tracking-tight text-brand-navy sm:text-4xl"
                    id="menu-categories-title"
                  >
                    {t("Menu categories")}
                  </h2>
                  <p className="text-sm font-semibold text-[#65748a]">
                    {t("{count} categories", { count: categories.length })}
                  </p>
                </div>

                {featuredCategory && (
                  <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12">
                    <button
                      className="group flex min-w-0 flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-yellow-deep"
                      key={featuredCategory.title}
                      onClick={() => showCategory(featuredCategory)}
                      type="button"
                    >
                      <span className="relative block overflow-hidden">
                        <MenuImage
                          alt=""
                          className="aspect-[4/3] w-full bg-[#f4f6f8] object-cover transition duration-700 ease-out group-hover:scale-[1.04] motion-reduce:transition-none"
                          sizes="(min-width: 1024px) 40vw, 100vw"
                          src={featuredCategory.image}
                        />
                        <span aria-hidden="true" className="menu-card-shine" />
                      </span>
                      <span className="mt-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <span className="font-display text-2xl font-extrabold leading-tight tracking-tight text-brand-navy sm:text-3xl">
                          {t(featuredCategory.title)}
                        </span>
                        <span className="text-sm font-semibold text-[#65748a]">
                          {t("{count} items", { count: featuredCategory.items.length })}
                        </span>
                      </span>
                      <span className="mt-2 max-w-lg text-base leading-7 text-brand-navy">
                        {t(featuredCategory.description)}
                      </span>
                      <span className="mt-5 flex flex-wrap items-end justify-between gap-4">
                        <span>
                          <span className="block text-sm font-semibold text-[#65748a]">
                            {t("Starting from")}
                          </span>
                          <span className="mt-1 block font-display text-xl font-extrabold tabular-nums text-brand-yellow-deep">
                            {featuredCategory.items.length
                              ? formatPrice(
                                  Math.min(...featuredCategory.items.map((item) => item.priceXaf)),
                                )
                              : t("Unavailable")}
                          </span>
                        </span>
                        <span className="font-bold text-brand-navy underline decoration-[#ffb84d] decoration-2 underline-offset-4 transition-colors group-hover:text-brand-yellow-deep">
                          {t("Browse items")}
                        </span>
                      </span>
                    </button>

                    <ul className="space-y-2 sm:space-y-3">
                      {supportingCategories.map((category) => {
                        const lowestPrice = category.items.length
                          ? Math.min(...category.items.map((item) => item.priceXaf))
                          : null;

                        return (
                          <li key={category.title}>
                            <button
                              className="group flex min-h-28 w-full items-center gap-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-yellow-deep sm:gap-5 sm:py-4"
                              onClick={() => showCategory(category)}
                              type="button"
                            >
                              <span className="relative size-20 shrink-0 overflow-hidden sm:size-24">
                                <MenuImage
                                  alt=""
                                  className="size-full bg-[#f4f6f8] object-cover transition duration-700 ease-out group-hover:scale-[1.08] motion-reduce:transition-none"
                                  sizes="96px"
                                  src={category.image}
                                />
                                <span aria-hidden="true" className="menu-card-shine" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                  <span className="font-display text-lg font-extrabold leading-tight text-brand-navy sm:text-xl">
                                    {t(category.title)}
                                  </span>
                                  <span className="text-sm font-semibold text-[#65748a]">
                                    {t("{count} items", { count: category.items.length })}
                                  </span>
                                </span>
                                <span className="mt-1 block text-sm leading-5 text-brand-navy">
                                  {t(category.description)}
                                </span>
                                <span className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-sm font-bold tabular-nums text-brand-yellow-deep">
                                    {lowestPrice !== null
                                      ? formatPrice(lowestPrice)
                                      : t("Unavailable")}
                                  </span>
                                  <span className="text-sm font-bold text-brand-navy underline decoration-[#ffb84d] decoration-2 underline-offset-4 transition-colors group-hover:text-brand-yellow-deep">
                                    {t("Browse items")}
                                  </span>
                                </span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </main>

      <InstagramSection />
      <Footer />
    </div>
  );
}
