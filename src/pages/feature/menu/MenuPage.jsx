import { useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowIcon, Footer, Header, InstagramSection } from "../../../components/Layout";
import { coldStoneMenuCategories, getMenuItemId } from "../../../data";
import { apiRequest, getCustomerToken } from "../../../api/api";
import { useCart } from "../../../useCart";
import { useLanguage } from "../../../language/useLanguage";
import { useAuth } from "../../../authcontext/useAuth";
import { PageHero } from "../../../components/PageHero";
import { ProductImageSlider } from "../../../components/ProductImageSlider";

function MenuImage({ alt, className = "", src }) {
  return (
    <img decoding="async"
      alt={alt}
      className={className}
      loading="lazy"
      onError={(event) => {
        event.currentTarget.onerror = null;
        event.currentTarget.src = "/images/hero-ice-cream.jpg";
      }}
      src={src}
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
        className={`flex w-full items-center justify-between gap-3 rounded-[20px] px-4 py-2.5 text-left ring-1 outline-none! transition ${
          open
            ? "bg-white ring-[#d9d4c7] shadow-[0_8px_24px_rgba(9,42,83,0.08)]"
            : value
              ? "bg-[#fff8dd] ring-[#ecdfa6]"
              : "bg-[#fbfaf5] ring-transparent hover:ring-[#e5e1d7]"
        }`}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onButtonKeyDown}
        ref={buttonRef}
        type="button"
      >
        <span className="min-w-0">
          <span
            className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#8792a0]"
            id={`${id}-label`}
          >
            {label}
          </span>
          <span
            className="mt-0.5 block truncate text-sm font-bold capitalize text-[#092a53]"
            id={`${id}-value`}
          >
            {selected?.label}
          </span>
        </span>
        <svg
          aria-hidden="true"
          className={`size-4 shrink-0 text-[#8792a0] transition duration-200 ${open ? "rotate-180 text-[#092a53]" : ""}`}
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
                isActive ? "bg-[#fbf6e3]" : ""
              } ${isSelected ? "font-extrabold text-[#092a53]" : "font-semibold text-[#52647b]"}`}
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

function MenuProductCard({ category, item, onSelect, t, formatPrice }) {
  const soldOut = item.isAvailable === false || item.availableQuantity < 1;
  return (
    <button
      className="group relative flex h-full flex-col rounded-[22px] bg-white p-1.5 text-left shadow-[0_1px_0_rgba(9,42,83,0.04),0_8px_24px_rgba(9,42,83,0.06)] ring-1 ring-[#ebe7dc] transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_56px_rgba(9,42,83,0.14)] hover:ring-[#e2d39a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] sm:rounded-[28px] sm:p-2.5"
      onClick={() => onSelect(category, item)}
      type="button"
    >
      <div className="relative aspect-square overflow-hidden rounded-[17px] bg-gradient-to-br from-[#fff8dd] via-[#fbfaf5] to-[#f1ede2] sm:rounded-[22px]">
        <MenuImage
          alt={t(item.name)}
          className={`size-full object-cover transition duration-700 ease-out group-hover:scale-[1.05] ${soldOut ? "opacity-70 grayscale-[70%]" : ""}`}
          src={item.image}
        />
        <span
          className={`absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.12em] shadow-sm backdrop-blur-sm sm:left-3 sm:top-3 sm:px-2.5 sm:text-[10px] ${
            soldOut ? "text-red-700" : "text-[#37632c]"
          }`}
        >
          <span aria-hidden="true" className={`size-1.5 rounded-full ${soldOut ? "bg-red-500" : "bg-[#4caf50]"}`} />
          {soldOut ? t("Sold out") : t("Available")}
        </span>
      </div>

      <div className="flex flex-1 flex-col px-1.5 pb-1.5 pt-3 sm:px-3 sm:pb-2.5 sm:pt-4">
        <h3 className="line-clamp-2 font-display text-[15px] font-extrabold leading-snug text-[#092a53] sm:text-lg">
          {t(item.name)}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-[#65748a] sm:mt-2 sm:text-sm sm:leading-6">
          {t(item.detail)}
        </p>

        <div className="mt-auto flex items-center justify-between gap-2 pt-3 sm:pt-4">
          <span className="font-display text-sm font-extrabold tabular-nums text-[#a48700] sm:text-lg">
            {formatPrice(item.priceXaf)}
          </span>
          <span className="inline-flex shrink-0 items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#8792a0] transition group-hover:text-[#092a53]">
            <span className="sr-only">{t("View details")}</span>
            <span
              aria-hidden="true"
              className="grid size-8 place-items-center rounded-full bg-[#f4f1e7] text-[#092a53] transition duration-300 group-hover:bg-[#092a53] group-hover:text-white sm:size-9"
            >
              <svg className="size-4" fill="none" viewBox="0 0 24 24">
                <path d="M5 12h14m-5-5 5 5-5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </span>
          </span>
        </div>
      </div>
    </button>
  );
}

function SimilarProductCard({ category, item, onSelect, t, formatPrice }) {
  const soldOut = item.isAvailable === false || item.availableQuantity < 1;
  return (
    <button
      className="group relative isolate flex aspect-[3/4] flex-col justify-end overflow-hidden rounded-[20px] bg-[#092a53] p-3.5 text-left text-white shadow-[0_12px_32px_rgba(9,42,83,0.1)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_26px_54px_rgba(9,42,83,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] focus-visible:ring-offset-4 sm:rounded-[26px] sm:p-6"
      onClick={() => onSelect(category, item)}
      type="button"
    >
      <MenuImage
        alt=""
        className={`absolute inset-0 -z-20 size-full object-cover transition duration-700 ease-out group-hover:scale-[1.07] ${soldOut ? "grayscale-[60%]" : ""}`}
        src={item.image}
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-[#061d3a]/95 via-[#061d3a]/25 via-45% to-transparent transition duration-500 group-hover:via-[#061d3a]/45"
      />

      <span className="absolute inset-x-3 top-3 flex items-start justify-between gap-2 sm:inset-x-6 sm:top-6 sm:gap-3">
        <span className="max-w-[70%] truncate rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] backdrop-blur-md max-sm:hidden">
          {t(category.title)}
        </span>
        {soldOut && (
          <span className="ml-auto rounded-full bg-white px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.1em] text-red-700 sm:px-3 sm:py-1.5 sm:text-[10px]">
            {t("Sold out")}
          </span>
        )}
      </span>

      <span className="line-clamp-2 font-display text-[15px] font-extrabold leading-snug sm:text-2xl">
        {t(item.name)}
      </span>
      <span className="mt-2 line-clamp-2 max-h-0 text-sm leading-6 max-sm:hidden text-white/75 opacity-0 transition-all duration-500 group-hover:max-h-12 group-hover:opacity-100 group-focus-visible:max-h-12 group-focus-visible:opacity-100">
        {t(item.detail)}
      </span>
      <span className="mt-2.5 flex items-center justify-between gap-2 border-t border-white/15 pt-2.5 sm:mt-4 sm:gap-3 sm:pt-4">
        <span className="font-display text-sm font-extrabold tabular-nums text-[#ffdc32] sm:text-lg">
          {formatPrice(item.priceXaf)}
        </span>
        <span
          aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-[#092a53] transition duration-300 group-hover:-rotate-45 group-hover:bg-[#ffdc32] sm:size-10"
        >
          <ArrowIcon />
        </span>
      </span>
    </button>
  );
}

export function MenuPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { addToCart } = useCart();
  const { customer } = useAuth();
  const { language, t } = useLanguage();
  const [categories, setCategories] = useState(coldStoneMenuCategories);
  const [menuError, setMenuError] = useState("");
  const [selectedItemState, setSelectedItemState] = useState(null);
  const [cartNotice, setCartNotice] = useState("");
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
  const selectedItem =
    selectedItemState?.categoryTitle === activeCategoryTitle
      ? selectedItemState.item
      : null;
  const formatPrice = (price) =>
    `${new Intl.NumberFormat(language === "fr" ? "fr-CM" : "en-CM").format(price)} FCFA`;
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
  const totalMenuItems = categories.reduce(
    (total, category) => total + category.items.length,
    0,
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

  const showCategory = (category) => {
    setSearchParams({ category: category.title });
    setSelectedItemState(null);
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

  const orderSelectedItem = () => {
    const added = addToCart({
      ...selectedItem,
      id:
        selectedItem.id ||
        getMenuItemId(activeCategory.title, selectedItem.name),
      itemType: "menu",
      categoryTitle: activeCategory.title,
    });
    if (added) {
      navigate("/cart");
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

  const similarItems =
    selectedItem && activeCategory
      ? [
          ...activeCategory.items
            .filter((item) => item.name !== selectedItem.name)
            .map((item) => ({ category: activeCategory, item })),
          ...categories
            .filter((category) => category.title !== activeCategory.title)
            .flatMap((category) =>
              category.items.map((item) => ({ category, item })),
            ),
        ].slice(0, 4)
      : [];
  const selectedSoldOut = Boolean(
    selectedItem &&
      (selectedItem.isAvailable === false || selectedItem.availableQuantity < 1),
  );
  const selectedIsFavorite = Boolean(
    selectedItem &&
      activeCategory &&
      favoriteIds.has(
        selectedItem.id || getMenuItemId(activeCategory.title, selectedItem.name),
      ),
  );

  return (
    <div className="min-h-screen bg-[#fbfaf5] text-[#102c50]">
      <Header />
      <main>
        <PageHero
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
          badge={{ mark: "✦", eyebrow: t("Signature creations"), text: t("A treat made your way") }}
          description={t(
            "The global Cold Stone menu features these treat categories. This is not a confirmed Cameroon branch menu; local selection and prices can vary.",
          )}
          eyebrow={t("The Cold Stone experience")}
          image={{ src: "/ice-images/ice-4.webp", alt: t("Ice cream treats") }}
          sideImages={["/milk/mk-1.webp", "/cake-images/cake-1.webp"]}
          stats={[
            { label: t("Menu categories"), value: categories.length },
            { label: t("Menu items"), value: totalMenuItems, accent: true },
          ]}
          title={t("Menu & treats")}
        />

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
            className="relative z-40 mb-12 rounded-[28px] bg-white p-3 shadow-[0_1px_0_rgba(9,42,83,0.04),0_14px_40px_rgba(9,42,83,0.07)] ring-1 ring-[#ebe7dc] sm:p-4"
          >
            <div className="flex flex-col gap-3 xl:flex-row xl:items-stretch">
              <label className="group relative flex flex-1 items-center rounded-[20px] bg-[#fbfaf5] ring-1 ring-transparent transition focus-within:bg-white">
                <span className="sr-only">{t("Search menu")}</span>
                <svg
                  aria-hidden="true"
                  className="pointer-events-none absolute left-5 size-5 text-[#8792a0] transition group-focus-within:text-[#092a53]"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                  <path d="m20 20-3.5-3.5" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                </svg>
                <input
                  className="w-full bg-transparent py-4 pl-14 pr-12 text-base font-semibold text-[#092a53] outline-none! placeholder:font-medium placeholder:text-[#8792a0]"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("Search menu")}
                  type="search"
                  value={search}
                />
                {search && (
                  <button
                    aria-label={t("Clear search")}
                    className="absolute right-3 grid size-8 place-items-center rounded-full text-[#8792a0] transition hover:bg-[#efece3] hover:text-[#092a53]"
                    onClick={() => setSearch("")}
                    type="button"
                  >
                    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
                      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                    </svg>
                  </button>
                )}
              </label>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:flex xl:flex-none">
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
                  className={`relative flex flex-col justify-center rounded-[20px] px-4 py-2.5 ring-1 transition xl:w-[170px] ${
                    maxPrice ? "bg-[#fff8dd] ring-[#ecdfa6]" : "bg-[#fbfaf5] ring-transparent hover:ring-[#e5e1d7]"
                  }`}
                >
                  <span className="truncate text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#8792a0]">
                    {t("Maximum price")}
                  </span>
                  <span className="mt-0.5 flex items-baseline gap-1.5">
                    <input
                      className="w-full min-w-0 bg-transparent text-sm font-bold tabular-nums text-[#092a53] outline-none! placeholder:font-medium placeholder:text-[#a5aebb]"
                      inputMode="numeric"
                      min="0"
                      onChange={(event) => setMaxPrice(event.target.value)}
                      placeholder={t("Any")}
                      step="500"
                      type="number"
                      value={maxPrice}
                    />
                    <span className="shrink-0 text-[10px] font-extrabold text-[#a5aebb]">FCFA</span>
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
                <p className="text-xs text-[#65748a]">
                  {t("Prices shown are illustrative estimates only.")}
                </p>
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
            <section aria-labelledby="menu-product-title">
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

              <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
                <div className="lg:col-span-7">
                  <div className="lg:sticky lg:top-[calc(var(--site-header-offset,0px)+2rem)] lg:transition-[top] lg:duration-300">
                    <ProductImageSlider
                      imageClassName={`aspect-[4/3] lg:aspect-[5/4] ${selectedSoldOut ? "grayscale-[60%]" : ""}`}
                      images={[selectedItem.image, ...(selectedItem.gallery || [])]}
                      name={t(selectedItem.name)}
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

                <div className="flex min-w-0 flex-col lg:col-span-5 lg:py-4">
                  <p className="inline-flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#a48700]">
                    <span aria-hidden="true" className="h-px w-10 bg-[#a48700]" />
                    {t(activeCategory.title)}
                  </p>
                  <h2
                    className="mt-5 break-words font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-[#092a53] sm:text-5xl"
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

                  <p className="mt-6 text-base leading-8 text-[#52647b] sm:text-lg sm:leading-8">
                    {t(selectedItem.detail)}
                  </p>

                  {selectedItem.dietaryTags?.length > 0 && (
                    <ul className="mt-6 flex flex-wrap gap-2">
                      {selectedItem.dietaryTags.map((tag) => (
                        <li
                          className="rounded-full border border-[#dfe9d8] bg-[#f3f8ef] px-3 py-1.5 text-xs font-bold capitalize text-[#37632c]"
                          key={tag}
                        >
                          {t(tag)}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-8 border-y border-[#ebe7dc] py-6">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#8792a0]">
                      {t("Illustrative price")}
                    </p>
                    <p className="mt-1 font-display text-4xl font-extrabold tabular-nums text-[#092a53]">
                      {formatPrice(selectedItem.priceXaf)}
                    </p>
                    <p className="mt-3 text-xs leading-5 text-[#7b8796]">
                      {t(
                        "This is an example price for illustration only, not a verified Cameroon price or an item for sale on this website.",
                      )}
                    </p>
                  </div>

                  <div className="mt-6 flex gap-3">
                    <button
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#092a53] px-7 py-4 text-sm font-extrabold text-white shadow-[0_12px_28px_rgba(9,42,83,0.22)] transition hover:-translate-y-0.5 hover:bg-[#163e6b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2 disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-[#e7e3d9] disabled:text-[#8792a0] disabled:shadow-none"
                      disabled={selectedSoldOut}
                      onClick={orderSelectedItem}
                      type="button"
                    >
                      {selectedSoldOut ? t("Sold out") : t("Order now")}
                      {!selectedSoldOut && <ArrowIcon />}
                    </button>
                    {customer && (
                      <button
                        aria-label={
                          selectedIsFavorite
                            ? t("Remove from favorites")
                            : t("Save to favorites")
                        }
                        aria-pressed={selectedIsFavorite}
                        className={`grid size-[52px] shrink-0 place-items-center rounded-full border text-xl transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] focus-visible:ring-offset-2 ${
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
                  {favoriteError && (
                    <p className="mt-3 text-xs leading-5 text-red-700" role="alert">
                      {favoriteError}
                    </p>
                  )}

                  <ul className="mt-8 grid grid-cols-3 divide-x divide-[#ebe7dc] rounded-2xl border border-[#ebe7dc] bg-white">
                    {["Mixed to order", "Made to your taste", "Freshly made"].map((label, index) => (
                      <li className="flex flex-col items-center gap-1.5 px-2 py-4 text-center" key={label}>
                        <span aria-hidden="true" className="font-display text-xs font-extrabold tabular-nums text-[#c9b24a]">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="text-xs font-bold leading-4 text-[#092a53]">{t(label)}</span>
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
                      <p className="inline-flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#a48700]">
                        <span aria-hidden="true" className="h-px w-10 bg-[#a48700]" />
                        {t("What our customers are saying")}
                      </p>
                      <h3
                        className="mt-4 font-display text-3xl font-extrabold tracking-tight text-[#092a53] sm:text-4xl"
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
                className="mt-20 border-t border-[#ebe7dc] pt-14"
              >
                <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="inline-flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#a48700]">
                      <span aria-hidden="true" className="h-px w-10 bg-[#a48700]" />
                      {t("You may also like")}
                    </p>
                    <h3
                      className="mt-4 font-display text-3xl font-extrabold tracking-tight text-[#092a53] sm:text-4xl"
                      id="similar-products-title"
                    >
                      {t("Similar products")}
                    </h3>
                  </div>
                  <button
                    className="inline-flex items-center gap-2 rounded-full border border-[#d9d4c7] bg-white px-5 py-3 text-sm font-extrabold text-[#092a53] transition hover:-translate-y-0.5 hover:border-[#092a53] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00]"
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

              <div className="relative isolate overflow-hidden rounded-[32px] bg-[#092a53] text-white shadow-[0_24px_60px_rgba(9,42,83,0.18)]">
                <MenuImage
                  alt=""
                  className="absolute inset-0 -z-20 size-full object-cover"
                  src={activeCategory.image}
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 -z-10 bg-gradient-to-r from-[#061d3a] via-[#061d3a]/85 to-[#061d3a]/20"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 -z-10 bg-gradient-to-t from-[#061d3a]/70 via-transparent to-transparent md:hidden"
                />
                <div className="flex min-h-[420px] flex-col justify-end p-7 sm:p-10 md:min-h-[460px] lg:p-14">
                  <div className="max-w-2xl">
                    <p className="inline-flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#ffdc32]">
                      <span aria-hidden="true" className="h-px w-10 bg-[#ffdc32]" />
                      {t("Menu category")}
                    </p>
                    <h2
                      className="mt-5 font-display text-5xl font-extrabold leading-[1] tracking-tight sm:text-6xl lg:text-7xl"
                      id="menu-category-title"
                    >
                      {t(activeCategory.title)}
                    </h2>
                    <p className="mt-5 max-w-xl text-base leading-7 text-white/75 sm:text-lg sm:leading-8">
                      {t(activeCategory.description)}
                    </p>
                  </div>

                  <div className="mt-10 flex flex-col gap-6 border-t border-white/15 pt-6 sm:flex-row sm:items-end sm:justify-between">
                    <dl className="flex flex-wrap gap-x-10 gap-y-4">
                      <div>
                        <dt className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/55">
                          {t("Menu items")}
                        </dt>
                        <dd className="mt-1 font-display text-3xl font-extrabold tabular-nums">
                          {activeCategory.items.length}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/55">
                          {t("Available")}
                        </dt>
                        <dd className="mt-1 font-display text-3xl font-extrabold tabular-nums">
                          {activeCategoryStats.available}
                        </dd>
                      </div>
                      {activeCategoryStats.lowestPrice !== null && (
                        <div>
                          <dt className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/55">
                            {t("Starting from")}
                          </dt>
                          <dd className="mt-1 font-display text-3xl font-extrabold tabular-nums text-[#ffdc32]">
                            {formatPrice(activeCategoryStats.lowestPrice)}
                          </dd>
                        </div>
                      )}
                    </dl>
                    <a
                      className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full bg-[#ffdc32] px-6 py-3.5 text-sm font-extrabold text-[#092a53] transition hover:-translate-y-0.5 hover:bg-[#ffe76c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32] focus-visible:ring-offset-2 focus-visible:ring-offset-[#092a53]"
                      href="#menu-category-items"
                    >
                      {t("Browse items")} <span aria-hidden="true">↓</span>
                    </a>
                  </div>
                </div>
              </div>

              <nav
                aria-label={t("Menu categories")}
                className="sticky top-[var(--site-header-offset,0px)] z-30 -mx-5 mt-8 border-b transition-[top] duration-300 border-[#ebe7dc] bg-[#fbfaf5]/90 px-5 backdrop-blur-md sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12"
              >
                <ul className="-mb-px flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {categories.map((category) => {
                    const active = category.title === activeCategory.title;
                    return (
                      <li className="shrink-0" key={category.title}>
                        <button
                          aria-current={active ? "page" : undefined}
                          className={`inline-flex items-center gap-2 border-b-2 px-4 py-4 text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#bd9c00] ${
                            active
                              ? "border-[#092a53] text-[#092a53]"
                              : "border-transparent text-[#7b8796] hover:border-[#d9d4c7] hover:text-[#092a53]"
                          }`}
                          onClick={() => showCategory(category)}
                          type="button"
                        >
                          {t(category.title)}
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] tabular-nums ${
                              active ? "bg-[#092a53] text-white" : "bg-[#efece3] text-[#7b8796]"
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
                  <p className="inline-flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#a48700]">
                    <span aria-hidden="true" className="h-px w-10 bg-[#a48700]" />
                    {t(activeCategory.title)}
                  </p>
                  <h3 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-[#092a53] sm:text-4xl">
                    {t("Menu items")}
                  </h3>
                </div>
                <p className="inline-flex items-center gap-2 rounded-full border border-[#ebe7dc] bg-white px-4 py-2 text-xs font-semibold text-[#65748a]">
                  <span aria-hidden="true" className="grid size-4 place-items-center rounded-full bg-[#ffdc32]/50 text-[9px] font-extrabold text-[#806a00]">i</span>
                  {t("Prices shown are illustrative estimates only.")}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
                {activeCategory.items.map((item) => (
                  <MenuProductCard
                    category={activeCategory}
                    formatPrice={formatPrice}
                    item={item}
                    key={
                      item.id || getMenuItemId(activeCategory.title, item.name)
                    }
                    onSelect={selectItem}
                    t={t}
                  />
                ))}
              </div>
            </section>
          ) : (
            <section aria-labelledby="menu-categories-title">
              <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="inline-flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#a48700]">
                    <span aria-hidden="true" className="h-px w-10 bg-[#a48700]" />
                    {t("Browse the categories")}
                  </p>
                  <h2
                    className="mt-4 font-display text-4xl font-extrabold tracking-tight text-[#092a53] sm:text-5xl"
                    id="menu-categories-title"
                  >
                    {t("Menu categories")}
                  </h2>
                </div>
                <p className="rounded-full border border-[#ebe7dc] bg-white px-4 py-2 text-xs font-bold text-[#65748a]">
                  {t("{count} categories", { count: categories.length })}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-7">
                {categories.map((category, index) => {
                  const lowestPrice = category.items.length
                    ? Math.min(...category.items.map((item) => item.priceXaf))
                    : null;
                  const previews = category.items.slice(0, 3);
                  return (
                    <button
                      className="group flex flex-col rounded-[30px] bg-white p-2.5 text-left shadow-[0_1px_0_rgba(9,42,83,0.04),0_10px_30px_rgba(9,42,83,0.06)] ring-1 ring-[#ebe7dc] transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_30px_60px_rgba(9,42,83,0.14)] hover:ring-[#e2d39a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00]"
                      key={category.title}
                      onClick={() => showCategory(category)}
                      type="button"
                    >
                      <div className="relative aspect-[5/4] overflow-hidden rounded-[24px] bg-[#f4f1e7]">
                        <MenuImage
                          alt=""
                          className="size-full object-cover transition duration-700 ease-out group-hover:scale-[1.06]"
                          src={category.image}
                        />
                        <span
                          aria-hidden="true"
                          className="absolute inset-0 bg-gradient-to-t from-[#061d3a]/55 via-transparent to-[#061d3a]/10"
                        />
                        <span className="absolute left-4 top-4 font-display text-sm font-extrabold tabular-nums text-white drop-shadow">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="absolute right-4 top-4 rounded-full border border-white/30 bg-white/20 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-white backdrop-blur-md">
                          {t("{count} items", { count: category.items.length })}
                        </span>
                        {previews.length > 0 && (
                          <span aria-hidden="true" className="absolute bottom-4 left-4 flex -space-x-2.5">
                            {previews.map((item) => (
                              <MenuImage
                                alt=""
                                className="size-10 rounded-full border-2 border-white object-cover shadow-md"
                                key={item.name}
                                src={item.image}
                              />
                            ))}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-1 flex-col px-4 pb-4 pt-6 sm:px-5">
                        <h3 className="font-display text-2xl font-extrabold leading-tight tracking-tight text-[#092a53]">
                          {t(category.title)}
                        </h3>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#65748a]">
                          {t(category.description)}
                        </p>
                        <div className="mt-auto flex items-center justify-between gap-3 pt-6">
                          {lowestPrice !== null ? (
                            <span>
                              <span className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#8792a0]">
                                {t("Starting from")}
                              </span>
                              <span className="mt-0.5 block font-display text-lg font-extrabold tabular-nums text-[#a48700]">
                                {formatPrice(lowestPrice)}
                              </span>
                            </span>
                          ) : (
                            <span />
                          )}
                          <span className="inline-flex items-center gap-3 text-sm font-extrabold text-[#092a53]">
                            <span className="hidden sm:inline">{t("Browse items")}</span>
                            <span
                              aria-hidden="true"
                              className="grid size-11 place-items-center rounded-full bg-[#092a53] text-white transition duration-300 group-hover:-rotate-45 group-hover:bg-[#ffdc32] group-hover:text-[#092a53]"
                            >
                              <ArrowIcon />
                            </span>
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="mt-6 text-xs text-[#8792a0]">
                {t("Prices shown are illustrative estimates only.")}
              </p>
            </section>
          )}
        </div>
      </main>

      <InstagramSection />
      <Footer />
    </div>
  );
}
