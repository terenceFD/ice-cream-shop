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

const MAX_QUANTITY = 10;
const CAKE_SPECIMEN_FIELDS = [
  "bg-[#f1d9d0]",
  "bg-[#f2e8c9]",
  "bg-[#d9e5e9]",
  "bg-[#e6dced]",
];
const CATEGORY_HERO_THEMES = {
  "Ice Cream": { surface: "#092a53", accent: "#ffdc32", imageSide: "right" },
  "Cakes & Pies": { surface: "#472a3b", accent: "#ffd0bd", imageSide: "left" },
  "Silk & Sorbet": { surface: "#493447", accent: "#f0c5db", imageSide: "right" },
  "Milkshakes & Smoothies": { surface: "#174b43", accent: "#d9ed9a", imageSide: "left" },
  Novelties: { surface: "#4b352d", accent: "#ffd19a", imageSide: "right" },
  "Limited-Time Favorites": { surface: "#5a3048", accent: "#ffd37d", imageSide: "left" },
};
const DEFAULT_CATEGORY_HERO_THEME = {
  surface: "#092a53",
  accent: "#ffdc32",
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
            ? "bg-white ring-2 ring-[#092a53]"
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
            className="block text-xs font-semibold text-[#53657a]"
            id={`${id}-label`}
          >
            {label}
          </span>
          <span
            className="mt-1 block truncate text-sm font-bold capitalize text-[#102c50]"
            id={`${id}-value`}
          >
            {selected?.label}
          </span>
        </span>
        <svg
          aria-hidden="true"
          className={`size-4 shrink-0 text-[#65748a] transition duration-200 ${open ? "rotate-180 text-[#092a53]" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
        >
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      </button>

      <ul
        aria-activedescendant={open ? `${id}-option-${activeIndex}` : undefined}
        aria-labelledby={`${id}-label`}
        className={`absolute inset-x-0 top-[calc(100%+8px)] z-40 max-h-72 origin-top sm:min-w-[200px] overflow-y-auto overscroll-contain rounded-2xl bg-white p-1.5 shadow-[0_24px_60px_rgba(9,42,83,0.18),0_2px_6px_rgba(9,42,83,0.06)] ring-1 ring-[#ebe7dc] outline-none! transition duration-150 ease-out ${
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
              } ${isSelected ? "font-extrabold text-[#102c50]" : "font-semibold text-[#41546b]"}`}
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
                  isSelected ? "bg-[#092a53] text-white" : "text-transparent"
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
    <div
      className={`group relative flex h-full flex-col ${
        isCakeCategory
          ? ""
          : "rounded-[22px] bg-white p-1.5 shadow-[0_1px_0_rgba(9,42,83,0.04),0_8px_24px_rgba(9,42,83,0.06)] ring-1 ring-[#ebe7dc] transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_56px_rgba(9,42,83,0.14)] hover:ring-[#e2d39a] sm:rounded-[28px] sm:p-2.5"
      }`}
    >
      <button
        className={`flex flex-1 flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] focus-visible:ring-offset-2 ${
          isCakeCategory ? "" : "rounded-[22px] sm:rounded-[28px]"
        }`}
        onClick={() => onSelect(category, item)}
        type="button"
      >
      <div
        className={`relative flex items-center justify-center overflow-hidden ${
          isCakeCategory
            ? `aspect-square ${CAKE_SPECIMEN_FIELDS[itemIndex % CAKE_SPECIMEN_FIELDS.length]}`
            : "aspect-square rounded-[17px] bg-gradient-to-br from-[#fff8dd] via-[#fbfaf5] to-[#f1ede2] sm:rounded-[22px]"
        }`}
      >
        <MenuImage
          alt={t(item.name)}
          className={`transition duration-500 ease-out ${
            isCakeCategory
              ? "size-[90%] object-contain group-hover:scale-[1.02]"
              : "size-full object-cover group-hover:scale-[1.05]"
          } ${soldOut ? "opacity-70 grayscale-[70%]" : ""}`}
          sizes="(min-width: 1024px) 25vw, 50vw"
          src={item.image}
        />
        {(soldOut || !isCakeCategory) && (
          <span
            className={`absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.12em] shadow-sm backdrop-blur-sm sm:left-3 sm:top-3 sm:px-2.5 sm:text-[10px] ${
              soldOut ? "text-red-700" : "text-[#37632c]"
            }`}
          >
            <span aria-hidden="true" className={`size-1.5 rounded-full ${soldOut ? "bg-red-500" : "bg-[#4caf50]"}`} />
            {soldOut ? t("Sold out") : t("Available")}
          </span>
        )}
      </div>

      <div
        className={`flex flex-1 flex-col ${
          isCakeCategory
            ? "px-0 pb-0 pt-4 sm:pt-5"
            : "px-1.5 pb-1.5 pt-3 sm:px-3 sm:pb-2.5 sm:pt-4"
        }`}
      >
        <h3 className={`line-clamp-2 font-display font-extrabold leading-snug text-[#092a53] ${
          isCakeCategory
            ? "text-base sm:text-lg"
            : "text-[15px] sm:text-lg"
        }`}>
          {t(item.name)}
        </h3>
        <div className="mt-1.5">
          <RatingBadge
            averageRating={item.averageRating}
            reviewCount={item.reviewCount}
          />
        </div>
        <p className={`mt-1.5 line-clamp-2 text-xs leading-5 text-[#65748a] sm:mt-2 sm:text-sm sm:leading-6 ${
          isCakeCategory ? "min-h-[3.25rem]" : ""
        }`}>
          {t(item.detail)}
        </p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-3 sm:pt-4">
          <span className="font-display text-sm font-extrabold tabular-nums text-[#8a7000] sm:text-lg">
            {formatPrice(item.priceXaf)}
          </span>
          <span className="inline-flex shrink-0 items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#65748a] transition group-hover:text-[#092a53]">
              <span className="sr-only">{t("View details")}</span>
              <span
                aria-hidden="true"
                className={`grid size-8 place-items-center rounded-full transition duration-300 sm:size-9 ${
                  isCakeCategory
                    ? "bg-[#e9edf0] text-[#092a53] group-hover:bg-[#092a53] group-hover:text-white"
                    : "bg-[#f4f1e7] text-[#092a53] group-hover:bg-[#092a53] group-hover:text-white"
                }`}
              >
                <svg className="size-4" fill="none" viewBox="0 0 24 24">
                  <path d="M5 12h14m-5-5 5 5-5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </span>
          </span>
        </div>
      </div>
      </button>
      <button
        aria-label={
          soldOut
            ? t("{name} is sold out", { name: t(item.name) })
            : t("Add {name} to cart", { name: t(item.name) })
        }
        className={`mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 px-3 text-[11px] font-extrabold transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] focus-visible:ring-offset-2 disabled:cursor-not-allowed sm:text-xs ${
          isCakeCategory
            ? "rounded-md"
            : "rounded-full"
        } ${
          added
            ? "bg-[#4caf50] text-white"
            : soldOut
              ? "bg-[#e8ebe7] text-[#8793a0]"
              : "bg-[#092a53] text-white hover:-translate-y-0.5 hover:bg-[#163e6b] hover:shadow-[0_8px_20px_rgba(9,42,83,0.18)]"
        }`}
        disabled={soldOut}
        onClick={() => onQuickAdd(category, item)}
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
      className="group relative isolate flex aspect-[3/4] flex-col overflow-hidden rounded-[20px] bg-white text-left text-[#102c50] ring-1 ring-[#e4e7e3] transition duration-300 hover:-translate-y-1 hover:shadow-[0_26px_54px_rgba(9,42,83,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] focus-visible:ring-offset-4 sm:rounded-[26px]"
      onClick={() => onSelect(category, item)}
      type="button"
    >
      <span className="relative min-h-0 flex-1 overflow-hidden bg-[#f1f2ee]">
        <MenuImage
          alt=""
          className={`absolute inset-0 size-full object-cover transition duration-700 ease-out group-hover:scale-[1.07] ${soldOut ? "grayscale-[60%]" : ""}`}
          sizes="(min-width: 1024px) 25vw, 50vw"
          src={item.image}
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#061d3a] from-15% via-[#061d3a]/60 via-50% to-transparent to-75% transition duration-500 group-hover:via-[#061d3a]/70"
        />
        <span className="absolute inset-x-3 top-3 flex items-start justify-between gap-2 sm:inset-x-5 sm:top-5">
          {showCategory && (
            <span className="max-w-[80%] truncate rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-[#102c50] max-sm:hidden">
              {t(category.title)}
            </span>
          )}
          {soldOut && (
            <span className="ml-auto rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-red-700">
              {t("Sold out")}
            </span>
          )}
        </span>
      </span>

      <span className="flex flex-col p-3.5 sm:p-5">
        <span className="line-clamp-2 font-display text-base font-bold leading-snug text-[#102c50] sm:text-xl">
          {t(item.name)}
        </span>
        <span className="mt-1 line-clamp-2 max-h-0 text-sm leading-6 text-[#41546b] opacity-0 transition-all duration-500 group-hover:max-h-12 group-hover:opacity-100 group-focus-visible:max-h-12 group-focus-visible:opacity-100 max-sm:hidden">
          {t(item.detail)}
        </span>
        <span className="mt-3 flex items-center justify-between gap-2 border-t border-[#e4e7e3] pt-3 sm:mt-4 sm:pt-4">
          <span className="font-display text-sm font-bold tabular-nums text-[#102c50] sm:text-base">
            {formatPrice(item.priceXaf)}
          </span>
          <span
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#092a53] text-white transition duration-300 group-hover:-rotate-45 group-hover:bg-[#ffdc32] group-hover:text-[#092a53] sm:size-10"
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
  const [categories, setCategories] = useState(coldStoneMenuCategories);
  const [menuError, setMenuError] = useState("");
  const [selectedItemState, setSelectedItemState] = useState(null);
  const productRef = useRef(null);
  const [cartNotice, setCartNotice] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const [quickAddedId, setQuickAddedId] = useState(null);
  const quickAddedTimer = useRef(undefined);
  const addedTimer = useRef(undefined);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
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
            <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[11px] font-extrabold text-[#472a3b]">
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
            <span className="font-display text-xl font-extrabold text-[#092a53]">
              {t("This month only")}
            </span>
            <span className="text-sm font-bold text-[#092a53]/80">
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
  const selectedIsFavorite = Boolean(
    selectedItem &&
      activeCategory &&
      favoriteIds.has(
        selectedItem.id || getMenuItemId(activeCategory.title, selectedItem.name),
      ),
  );

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
    <div className="min-h-screen bg-[#fbfaf5] text-[#102c50]">
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
              <label className="group relative flex min-w-0 flex-1 items-center rounded-2xl bg-white ring-1 ring-transparent transition focus-within:ring-[#092a53]">
                <span className="sr-only">{t("Search menu")}</span>
                <svg
                  aria-hidden="true"
                  className="pointer-events-none absolute left-5 size-5 text-[#65748a] transition group-focus-within:text-[#092a53]"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                  <path d="m20 20-3.5-3.5" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                </svg>
                <input
                  className="w-full bg-transparent py-4 pl-14 pr-12 text-base font-semibold text-[#092a53] outline-none! placeholder:font-medium placeholder:text-[#65748a]"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("Search menu")}
                  type="search"
                  value={search}
                />
                {search && (
                  <button
                    aria-label={t("Clear search")}
                    className="absolute right-3 grid size-8 place-items-center rounded-full text-[#65748a] transition hover:bg-[#efece3] hover:text-[#092a53]"
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
                className={`relative inline-flex shrink-0 items-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] sm:hidden ${
                  filtersOpen ? "bg-[#092a53] text-white" : "bg-white text-[#102c50] ring-1 ring-[#e4e7e3]"
                }`}
                onClick={() => setFiltersOpen((open) => !open)}
                type="button"
              >
                <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
                  <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                </svg>
                {t("Filters")}
                {optionFilterCount > 0 && (
                  <span className="grid size-5 place-items-center rounded-md bg-[#ffdc32] text-[11px] tabular-nums text-[#092a53]">
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
                  <span className="truncate text-xs font-semibold text-[#53657a]">
                    {t("Maximum price")}
                  </span>
                  <span className="mt-0.5 flex items-baseline gap-1.5">
                    <input
                      className="w-full min-w-0 bg-transparent text-sm font-bold tabular-nums text-[#102c50] outline-none! placeholder:font-medium placeholder:text-[#7b8796]"
                      inputMode="numeric"
                      min="0"
                      onChange={(event) => setMaxPrice(event.target.value)}
                      placeholder={t("Any")}
                      step="500"
                      type="number"
                      value={maxPrice}
                    />
                    <span className="shrink-0 text-xs font-bold text-[#53657a]">FCFA</span>
                  </span>
                </label>
              </div>
            </div>

            {hasFilters && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#efece3] px-2 pt-3">
                <p aria-live="polite" className="text-xs font-bold text-[#52647b]">
                  <span className="mr-2 inline-grid size-5 place-items-center rounded-full bg-[#092a53] text-[10px] font-extrabold tabular-nums text-white">
                    {activeFilterCount}
                  </span>
                  {t("Filters")}
                  <span aria-hidden="true" className="mx-2 text-[#c9c3b4]">·</span>
                  {t("Matching menu items")}: {filteredItems.length}
                </p>
                <button
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold text-[#092a53] underline decoration-[#ffdc32] decoration-2 underline-offset-4 transition hover:bg-[#fbfaf5]"
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
                <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
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
                className="mb-8 flex flex-wrap items-center gap-2 text-xs font-bold text-[#7b8796]"
              >
                <button
                  className="rounded-full transition hover:text-[#092a53] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00]"
                  onClick={() => setSearchParams({})}
                  type="button"
                >
                  {t("Menu")}
                </button>
                <span aria-hidden="true" className="text-[#c9c3b4]">/</span>
                <button
                  className="rounded-full transition hover:text-[#092a53] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00]"
                  onClick={() => setSelectedItemState(null)}
                  type="button"
                >
                  {t(activeCategory.title)}
                </button>
                <span aria-hidden="true" className="text-[#c9c3b4]">/</span>
                <span aria-current="page" className="max-w-[16rem] truncate text-[#092a53]">
                  {t(selectedItem.name)}
                </span>
              </nav>

              <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
                <div className="lg:col-span-7">
                  <div className="lg:sticky lg:top-[calc(var(--site-header-offset,0px)+2rem)] lg:transition-[top] lg:duration-300">
                    <ProductImageSlider
                      imageClassName={`aspect-[4/3] lg:aspect-[5/4] ${selectedSoldOut ? "grayscale-[60%]" : ""}`}
                      images={[selectedItem.image, ...normalizePhotoGallery(selectedItem.gallery)]}
                      name={t(selectedItem.name)}
                      priority
                      overlay={
                        <span
                          className={`absolute left-5 top-5 inline-flex items-center gap-2 rounded-full bg-white/95 px-3.5 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em] shadow-sm backdrop-blur-sm sm:left-6 sm:top-6 ${selectedSoldOut ? "text-red-700" : "text-[#37632c]"}`}
                        >
                          <span
                            aria-hidden="true"
                            className={`size-1.5 rounded-full ${selectedSoldOut ? "bg-red-500" : "bg-[#4caf50]"}`}
                          />
                          {selectedSoldOut ? t("Sold out") : t("Available")}
                        </span>
                      }
                      resetKey={selectedItem.id || selectedItem.name}
                    />
                  </div>
                </div>

                <div className="flex min-w-0 flex-col rounded-[24px] bg-white p-5 sm:p-8 lg:col-span-5 lg:p-8">
                  <p className="inline-flex w-fit items-center rounded-lg bg-[#f1f2ee] px-3 py-1.5 text-sm font-bold text-[#102c50]">
                    {t(activeCategory.title)}
                  </p>
                  <h2
                    className="mt-5 break-words font-display text-4xl font-bold leading-[1.05] tracking-tight text-[#092a53] sm:text-5xl"
                    id="menu-product-title"
                  >
                    {t(selectedItem.name)}
                  </h2>

                  {reviews.reviewCount > 0 && (
                    <a
                      aria-live="polite"
                      className="mt-4 inline-flex w-fit items-center gap-2 text-sm font-bold text-[#52647b] transition hover:text-[#092a53]"
                      href="#menu-product-reviews"
                    >
                      <span
                        aria-label={t("{rating} out of 5 stars", {
                          rating: reviews.averageRating,
                        })}
                        className="text-base tracking-[0.1em] text-[#d4ad00]"
                      >
                        {"★".repeat(Math.round(reviews.averageRating))}
                        <span className="text-[#e2ddd0]">
                          {"★".repeat(5 - Math.round(reviews.averageRating))}
                        </span>
                      </span>
                      <span className="text-[#092a53]">{reviews.averageRating}</span>
                      <span aria-hidden="true">·</span>
                      <span className="underline decoration-[#d9d4c7] underline-offset-4">
                        {reviews.reviewCount} {t("reviews")}
                      </span>
                    </a>
                  )}

                  <p className="mt-6 text-base leading-7 text-[#263d57] sm:text-lg sm:leading-8">
                    {t(selectedItem.detail)}
                  </p>

                  {selectedItem.dietaryTags?.length > 0 && (
                    <ul className="mt-6 flex flex-wrap gap-2">
                      {selectedItem.dietaryTags.map((tag) => (
                        <li
                          className="rounded-lg bg-[#eaf2e7] px-3 py-1.5 text-sm font-semibold capitalize text-[#31572b]"
                          key={tag}
                        >
                          {t(tag)}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-8 rounded-2xl bg-[#f1f2ee] px-5 py-4">
                    <p className="text-sm font-semibold text-[#53657a]">
                      {t("Price")}
                    </p>
                    <p className="mt-1 font-display text-4xl font-bold tabular-nums text-[#092a53]">
                      {formatPrice(selectedItem.priceXaf)}
                    </p>
                  </div>

                  <div className="mt-6 flex gap-3">
                    {!selectedSoldOut && (
                      <div aria-label={t("Quantity")} className="flex shrink-0 items-center rounded-xl bg-[#f1f2ee] p-1" role="group">
                        <button
                          aria-label={t("Decrease quantity")}
                          className="grid size-11 place-items-center rounded-lg text-lg font-bold text-[#092a53] transition hover:bg-white disabled:cursor-not-allowed disabled:text-[#c9c3b4] disabled:hover:bg-transparent"
                          disabled={quantity <= 1}
                          onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                          type="button"
                        >
                          −
                        </button>
                        <output aria-live="polite" className="w-8 text-center font-display text-lg font-extrabold tabular-nums text-[#092a53]">
                          {quantity}
                        </output>
                        <button
                          aria-label={t("Increase quantity")}
                          className="grid size-11 place-items-center rounded-lg text-lg font-bold text-[#092a53] transition hover:bg-white disabled:cursor-not-allowed disabled:text-[#c9c3b4] disabled:hover:bg-transparent"
                          disabled={quantity >= maxQuantity}
                          onClick={() => setQuantity((current) => Math.min(maxQuantity, current + 1))}
                          type="button"
                        >
                          +
                        </button>
                      </div>
                    )}
                    <button
                      className={`inline-flex min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-4 text-sm font-extrabold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2 disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-[#e7e3d9] disabled:text-[#65748a] disabled:shadow-none sm:px-6 ${
                        justAdded
                          ? "bg-[#3d8b40]"
                          : "bg-[#092a53] hover:-translate-y-0.5 hover:bg-[#163e6b] hover:shadow-[0_12px_28px_rgba(9,42,83,0.22)]"
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
                              <span className="max-sm:hidden"> · {formatPrice(selectedItem.priceXaf * quantity)}</span>
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
                        className={`grid size-[52px] shrink-0 place-items-center rounded-xl border text-xl transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] focus-visible:ring-offset-2 ${
                          selectedIsFavorite
                            ? "border-[#f56586] bg-[#fff0f3] text-[#e0435f]"
                            : "border-[#d9d4c7] bg-white text-[#52647b] hover:border-[#092a53] hover:text-[#092a53]"
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
                    <p className="mt-3 text-xs leading-5 text-red-700" role="alert">
                      {cartNotice}
                    </p>
                  )}
                  <Link
                    className="mt-4 inline-flex w-fit items-center gap-2 text-sm font-extrabold text-[#092a53] underline decoration-[#ffdc32] decoration-2 underline-offset-4 transition hover:decoration-[#092a53]"
                    to="/cart"
                  >
                    {t("View cart")} <ArrowIcon />
                  </Link>
                  {favoriteError && (
                    <p className="mt-3 text-xs leading-5 text-red-700" role="alert">
                      {favoriteError}
                    </p>
                  )}

                  <ul className="mt-8 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {["Mixed to order", "Made to your taste", "Freshly made"].map((label) => (
                      <li className="flex items-center gap-2 rounded-xl bg-[#f1f2ee] px-3 py-3 text-sm font-semibold leading-5 text-[#102c50]" key={label}>
                        <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-[#d4ad00]" />
                        {t(label)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {reviews.reviews.length > 0 && (
                <section
                  aria-labelledby="menu-product-reviews-title"
                  className="mt-20 scroll-mt-8 border-t border-[#ebe7dc] pt-14"
                  id="menu-product-reviews"
                >
                  <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
                    <div className="lg:col-span-4">
                      <h3
                        className="font-display text-3xl font-extrabold tracking-tight text-[#092a53] sm:text-4xl"
                        id="menu-product-reviews-title"
                      >
                        {t("Customer reviews")}
                      </h3>
                      <div className="mt-6 flex items-end gap-4">
                        <span className="font-display text-6xl font-extrabold leading-none tabular-nums text-[#092a53]">
                          {reviews.averageRating}
                        </span>
                        <div className="pb-1">
                          <p aria-hidden="true" className="text-lg tracking-[0.1em] text-[#d4ad00]">
                            {"★".repeat(Math.round(reviews.averageRating))}
                            <span className="text-[#e2ddd0]">
                              {"★".repeat(5 - Math.round(reviews.averageRating))}
                            </span>
                          </p>
                          <p className="text-xs font-bold text-[#7b8796]">
                            {reviews.reviewCount} {t("reviews")}
                          </p>
                        </div>
                      </div>
                    </div>
                    <ul className="grid gap-4 sm:grid-cols-2 lg:col-span-8">
                      {reviews.reviews.map((review, index) => (
                        <li
                          className="flex flex-col rounded-[22px] border border-[#ebe7dc] bg-white p-6"
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
                            <p className="mt-3 text-sm leading-6 text-[#52647b]">
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
                                className="grid size-9 place-items-center rounded-full bg-[#ffeb9c] text-xs font-extrabold text-[#092a53]"
                              >
                                {review.customerName?.charAt(0)?.toUpperCase() || "A"}
                              </span>
                            )}
                            <p className="text-sm font-extrabold text-[#092a53]">
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
                className="mt-20 rounded-[24px] bg-[#f1f2ee] p-5 sm:p-8"
              >
                <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-[#53657a]">
                      {t("You may also like")}
                    </p>
                    <h3
                      className="mt-2 font-display text-3xl font-bold tracking-tight text-[#092a53] sm:text-4xl"
                      id="similar-products-title"
                    >
                      {t("Similar products")}
                    </h3>
                  </div>
                  <button
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#102c50] ring-1 ring-[#e4e7e3] transition hover:-translate-y-0.5 hover:ring-[#092a53] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00]"
                    onClick={() => setSelectedItemState(null)}
                    type="button"
                  >
                    {t("Back to category")}: {t(activeCategory.title)}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
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
            </section>
          ) : activeCategory ? (
            <section aria-labelledby="menu-category-title">
              <nav
                aria-label={t("Breadcrumb")}
                className="mb-6 flex flex-wrap items-center gap-2 text-xs font-bold text-[#7b8796]"
              >
                <button
                  className="inline-flex items-center gap-1.5 rounded-full transition hover:text-[#092a53] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00]"
                  onClick={() => setSearchParams({})}
                  type="button"
                >
                  <span aria-hidden="true">←</span> {t("Back to categories")}
                </button>
                <span aria-hidden="true" className="text-[#c9c3b4]">/</span>
                <span aria-current="page" className="text-[#092a53]">
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
                      className="menu-category-hero-image aspect-[4/3] w-full bg-[#e8edf2] object-cover md:min-h-[360px] md:flex-1"
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
                      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--category-hero-accent)] px-6 py-3.5 text-sm font-extrabold text-[#092a53] transition-colors hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 sm:w-fit"
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
                          className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#bd9c00] ${
                            active
                              ? "bg-[#092a53] text-white"
                              : "bg-[#f1f2ee] text-[#41546b] hover:bg-[#e7e9e4] hover:text-[#092a53]"
                          }`}
                          onClick={() => showCategory(category)}
                          type="button"
                        >
                          {t(category.title)}
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] tabular-nums ${
                              active ? "bg-white/15 text-white" : "bg-white text-[#53657a]"
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
                  <h3 className="font-display text-3xl font-extrabold tracking-tight text-[#092a53] sm:text-4xl">
                    {t(activeCategory.title)}
                  </h3>
                  <p className="mt-2 text-sm font-semibold text-[#65748a]">
                    {t("Menu items")}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
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
              className="-mx-5 bg-[#e8edf2] px-5 py-10 sm:-mx-8 sm:px-8 sm:py-14 lg:-mx-12 lg:px-12"
            >
              <div className="mx-auto max-w-[1320px] bg-white p-5 sm:p-8 lg:p-10">
                <div className="mb-8 flex flex-wrap items-end justify-between gap-4 sm:mb-10">
                  <h2
                    className="font-display text-3xl font-extrabold leading-tight tracking-tight text-[#092a53] sm:text-4xl"
                    id="menu-categories-title"
                  >
                    {t("Menu categories")}
                  </h2>
                  <p className="text-sm font-semibold text-[#41546b]">
                    {t("{count} categories", { count: categories.length })}
                  </p>
                </div>

                {featuredCategory && (
                  <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12">
                    <button
                      className="group flex min-w-0 flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#bd9c00]"
                      key={featuredCategory.title}
                      onClick={() => showCategory(featuredCategory)}
                      type="button"
                    >
                      <MenuImage
                        alt=""
                        className="aspect-[4/3] w-full bg-[#e8edf2] object-cover"
                        sizes="(min-width: 1024px) 40vw, 100vw"
                        src={featuredCategory.image}
                      />
                      <span className="mt-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <span className="font-display text-2xl font-extrabold leading-tight tracking-tight text-[#092a53] sm:text-3xl">
                          {t(featuredCategory.title)}
                        </span>
                        <span className="text-sm font-semibold text-[#41546b]">
                          {t("{count} items", { count: featuredCategory.items.length })}
                        </span>
                      </span>
                      <span className="mt-2 max-w-lg text-base leading-7 text-[#102c50]">
                        {t(featuredCategory.description)}
                      </span>
                      <span className="mt-5 flex flex-wrap items-end justify-between gap-4">
                        <span>
                          <span className="block text-sm font-semibold text-[#41546b]">
                            {t("Starting from")}
                          </span>
                          <span className="mt-1 block font-display text-xl font-extrabold tabular-nums text-[#8a7000]">
                            {featuredCategory.items.length
                              ? formatPrice(
                                  Math.min(...featuredCategory.items.map((item) => item.priceXaf)),
                                )
                              : t("Unavailable")}
                          </span>
                        </span>
                        <span className="font-bold text-[#092a53] underline decoration-[#ffdc32] decoration-2 underline-offset-4 transition-colors group-hover:text-[#8a7000]">
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
                              className="group flex min-h-28 w-full items-center gap-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#bd9c00] sm:gap-5 sm:py-4"
                              onClick={() => showCategory(category)}
                              type="button"
                            >
                              <MenuImage
                                alt=""
                                className="size-20 shrink-0 bg-[#e8edf2] object-cover sm:size-24"
                                sizes="96px"
                                src={category.image}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                  <span className="font-display text-lg font-extrabold leading-tight text-[#092a53] sm:text-xl">
                                    {t(category.title)}
                                  </span>
                                  <span className="text-sm font-semibold text-[#41546b]">
                                    {t("{count} items", { count: category.items.length })}
                                  </span>
                                </span>
                                <span className="mt-1 block text-sm leading-5 text-[#102c50]">
                                  {t(category.description)}
                                </span>
                                <span className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-sm font-bold tabular-nums text-[#8a7000]">
                                    {lowestPrice !== null
                                      ? formatPrice(lowestPrice)
                                      : t("Unavailable")}
                                  </span>
                                  <span className="text-sm font-bold text-[#092a53] underline decoration-[#ffdc32] decoration-2 underline-offset-4 transition-colors group-hover:text-[#8a7000]">
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
