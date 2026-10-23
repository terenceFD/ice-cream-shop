import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Footer, Header } from "../../components/Layout";
import { PageHero } from "../../components/PageHero";
import { RatingBadge } from "../../components/RatingBadge";
import { coldStoneMenuCategories, getMenuItemId } from "../../../shared/data";
import { apiRequest } from "../../api/api";
import { useCart } from "../../context/useCart";
import { useLanguage } from "../../language/useLanguage";
import { photoErrorHandler, photoSrcSet } from "../../lib/thumbnails";
import { numberFormatter } from "../../lib/cartPricing";

const FALLBACK_IMAGE = "/images/hero-ice-cream.jpg";
const SORTS = [
  { value: "", label: "Featured" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "name", label: "Name: A to Z" },
];

function isSoldOut(item) {
  return item.isAvailable === false || item.availableQuantity < 1;
}

// The product page on /menu opens straight from this link.
function productLink(category, item) {
  return `/menu?${new URLSearchParams({ category: category.title, item: item.name })}`;
}

function SearchIcon({ className = "size-5" }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
      <path d="m16 16 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function MenuItemCard({ category, item, formatPrice, onAdd, added, showCategory, t }) {
  const soldOut = isSoldOut(item);
  return (
    <li className="group relative flex flex-col rounded-[24px] bg-white p-2 [content-visibility:auto] [contain-intrinsic-size:auto_420px] shadow-[0_1px_0_rgba(9,42,83,0.04),0_8px_24px_rgba(9,42,83,0.06)] ring-1 ring-[#ebe7dc] transition duration-300 hover:-translate-y-1 hover:shadow-[0_26px_52px_rgba(9,42,83,0.13)] hover:ring-[#e2d39a] sm:rounded-[28px] sm:p-2.5">
      <div className="relative aspect-square overflow-hidden rounded-[18px] bg-gradient-to-br from-[#fff8dd] via-[#fbfaf5] to-[#f1ede2] sm:rounded-[22px]">
        <img
          alt=""
          className={`size-full object-cover transition duration-700 ease-out group-hover:scale-[1.05] ${soldOut ? "opacity-70 grayscale-[70%]" : ""}`}
          decoding="async"
          loading="lazy"
          onError={photoErrorHandler(item.image, FALLBACK_IMAGE)}
          sizes="(min-width: 1280px) 290px, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 50vw"
          src={item.image}
          srcSet={photoSrcSet(item.image)}
        />
        {showCategory && <span className="absolute left-2 top-2 max-w-[calc(100%-1rem)] truncate rounded-full bg-white/90 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#52647b] shadow-sm backdrop-blur-sm sm:left-3 sm:top-3 sm:text-[10px]">
          <span aria-hidden="true" className="mr-1">{category.icon}</span>
          {t(category.title)}
        </span>}
        {soldOut && (
          <span className="absolute inset-x-0 bottom-0 bg-[#092a53]/85 py-1.5 text-center text-[10px] font-extrabold uppercase tracking-[0.16em] text-white">
            {t("Sold out")}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col px-1.5 pb-1 pt-3 sm:px-3 sm:pb-2 sm:pt-4">
        <h3 className="line-clamp-2 font-display text-[15px] font-extrabold leading-snug text-[#092a53] sm:text-lg">
          {/* The whole card opens the product; the add button sits above this link. */}
          <Link
            className="after:absolute after:inset-0 after:rounded-[24px] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-[#bd9c00] sm:after:rounded-[28px]"
            to={productLink(category, item)}
          >
            {t(item.name)}
          </Link>
        </h3>
        <div className="mt-1.5">
          <RatingBadge
            averageRating={item.averageRating}
            reviewCount={item.reviewCount}
          />
        </div>
        <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-[#65748a] sm:text-sm sm:leading-6">{t(item.detail)}</p>

        <div className="mt-auto flex flex-col gap-2 pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:pt-4">
          <span className="font-display text-sm font-extrabold tabular-nums text-[#8a7000] sm:text-lg">
            {formatPrice(item.priceXaf)}
          </span>
          <button
            aria-label={added ? t("Added to your bag") : t("Add {name} to cart", { name: t(item.name) })}
            className={`relative z-10 inline-flex min-h-10 w-full shrink-0 items-center justify-center gap-2 rounded-full px-3 text-[11px] font-extrabold transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#ece8de] disabled:text-[#a5aebb] sm:w-auto sm:px-4 sm:text-xs ${
              added ? "bg-[#37632c] text-white" : "bg-[#ffdc32] text-[#092a53] hover:-translate-y-0.5 hover:bg-[#ffe76c]"
            }`}
            disabled={soldOut}
            onClick={() => onAdd(category, item)}
            type="button"
          >
            {added && (
              <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
                <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.6" />
              </svg>
            )}
            <span>{added ? t("Added") : t("Add to cart")}</span>
          </button>
        </div>
      </div>
    </li>
  );
}

export function AllMenuPage() {
  const { language, t } = useLanguage();
  const { addToCart } = useCart();
  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState(coldStoneMenuCategories);
  const [menuError, setMenuError] = useState("");
  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  const [sortBy, setSortBy] = useState("");
  const [addedKey, setAddedKey] = useState("");
  const [cartError, setCartError] = useState("");
  // Keep the box in step with the URL (e.g. a hero search landing here with ?search=…),
  // so clearing the query in the address bar or pressing back works as expected.
  const urlSearch = searchParams.get("search") || "";
  useEffect(() => {
    setSearch((current) => (current === urlSearch ? current : urlSearch));
  }, [urlSearch]);

  // Start with the built-in menu, then switch to the live menu (stock, admin-added items).
  useEffect(() => {
    let cancelled = false;
    apiRequest("/menu")
      .then(({ categories: loaded }) => {
        if (!cancelled && Array.isArray(loaded)) setCategories(loaded);
      })
      .catch((error) => {
        if (!cancelled) setMenuError(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!addedKey) return undefined;
    const timer = window.setTimeout(() => setAddedKey(""), 1800);
    return () => window.clearTimeout(timer);
  }, [addedKey]);

  const requestedCategory = searchParams.get("category") || "";
  const activeCategory = categories.some((category) => category.title === requestedCategory) ? requestedCategory : "";
  const formatPrice = (price) => `${numberFormatter(language === "fr" ? "fr-CM" : "en-CM").format(price)} FCFA`;
  const allItems = categories.flatMap((category) => category.items.map((item) => ({ category, item })));
  const prices = allItems.map(({ item }) => item.priceXaf).filter((price) => Number.isFinite(price));
  const query = search.trim().toLowerCase();

  const matches = allItems.filter(({ category, item }) => {
    if (activeCategory && category.title !== activeCategory) return false;
    if (!query) return true;
    return [item.name, item.detail, t(item.name), t(item.detail), category.title, t(category.title)]
      .some((text) => String(text || "").toLowerCase().includes(query));
  });
  const sorted = [...matches].sort((first, second) => {
    if (sortBy === "price-asc") return first.item.priceXaf - second.item.priceXaf;
    if (sortBy === "price-desc") return second.item.priceXaf - first.item.priceXaf;
    if (sortBy === "name") return t(first.item.name).localeCompare(t(second.item.name), language);
    return 0;
  });
  // With no search or sort, the menu reads best grouped by category.
  const grouped = !query && !sortBy;
  const sections = grouped
    ? categories
        .filter((category) => !activeCategory || category.title === activeCategory)
        .map((category) => ({ category, entries: sorted.filter((entry) => entry.category === category) }))
        .filter((section) => section.entries.length > 0)
    : [];

  function chooseCategory(title) {
    const next = new URLSearchParams(searchParams);
    if (title) next.set("category", title);
    else next.delete("category");
    setSearchParams(next, { replace: true });
  }

  function addItem(category, item) {
    setCartError("");
    const key = `${category.title}:${item.name}`;
    const added = addToCart({
      ...item,
      id: item.id || getMenuItemId(category.title, item.name),
      itemType: "menu",
      categoryTitle: category.title,
    });
    if (added) setAddedKey(key);
    else setCartError(t("This item could not be added to your bag. Please try again."));
  }

  const renderGrid = (entries, showCategory = false) => (
    <ul className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
      {entries.map(({ category, item }) => (
        <MenuItemCard
          added={addedKey === `${category.title}:${item.name}`}
          category={category}
          formatPrice={formatPrice}
          item={item}
          key={`${category.title}:${item.id || item.name}`}
          onAdd={addItem}
          showCategory={showCategory}
          t={t}
        />
      ))}
    </ul>
  );

  return (
    <div className="min-h-screen bg-[#fbfaf5] text-[#102c50]">
      <Header />
      <main id="main" tabIndex={-1}>
        <PageHero
          compactOnMobile
          actions={
            <>
              <a className={PageHero.primary} href="#all-menu-items">
                {t("Browse every item")} <span aria-hidden="true">↓</span>
              </a>
              <Link className={PageHero.secondary} to="/menu">
                {t("Shop by category")}
              </Link>
            </>
          }
          badge={{ mark: "✦", eyebrow: t("Full menu"), text: t("Every treat in one place") }}
          breadcrumb={
            <nav aria-label={t("Breadcrumb")} className="flex items-center gap-2">
              <Link className="transition hover:text-white" to="/menu">{t("Menu")}</Link>
              <span aria-hidden="true">/</span>
              <span className="text-white/80">{t("All menu")}</span>
            </nav>
          }
          description={t("Signature creations, ice cream cakes and pies, shakes, smoothies and seasonal treats, all on one page. Search, filter by category or sort by price.")}
          eyebrow={t("The complete menu")}
          image={{ src: "/menu-official/ice-cream/signature-creations/founders-favorite.webp", alt: t("A Cold Stone signature creation") }}
          sideImages={["/menu-official/cakes/signature-cakes/midnight-delight.webp", "/menu-official/milkshakes-fruit-smoothies/milkshakes/cake-shake.webp"]}
          stats={[
            { label: t("Menu items"), value: allItems.length, accent: true },
            { label: t("Categories"), value: categories.length },
            ...(prices.length ? [{ label: t("From"), value: formatPrice(Math.min(...prices)) }] : []),
          ]}
          title={t("All menu")}
        />

        <div className="mx-auto max-w-[1320px] scroll-mt-4 px-5 py-10 sm:px-8 sm:py-14 lg:px-12" id="all-menu-items">
          {menuError && (
            <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
              {t("Some saved menu items may not be available right now.")}: {menuError}
            </p>
          )}

          {/* Search, sort and category filters */}
          <section aria-label={t("Search and filter menu")} className="rounded-[28px] bg-white p-3 shadow-[0_1px_0_rgba(9,42,83,0.04),0_14px_40px_rgba(9,42,83,0.07)] ring-1 ring-[#ebe7dc] sm:p-4">
            <div className="flex flex-col gap-3 md:flex-row">
              <label className="group relative flex flex-1 items-center rounded-[20px] bg-[#fbfaf5] transition focus-within:bg-white focus-within:ring-2 focus-within:ring-[#ffdc32]">
                <span className="sr-only">{t("Search menu")}</span>
                <SearchIcon className="pointer-events-none absolute left-5 size-5 text-[#65748a] transition group-focus-within:text-[#092a53]" />
                <input
                  className="w-full rounded-[20px] bg-transparent py-4 pl-14 pr-12 text-sm font-semibold text-[#092a53] outline-none! placeholder:font-normal placeholder:text-[#65748a]"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("Search cakes, shakes, mint, strawberry…")}
                  type="search"
                  value={search}
                />
                {search && (
                  <button
                    aria-label={t("Clear search")}
                    className="absolute right-3 grid size-8 place-items-center rounded-full text-[#65748a] transition hover:bg-[#f1ede2] hover:text-[#092a53]"
                    onClick={() => setSearch("")}
                    type="button"
                  >
                    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
                      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                    </svg>
                  </button>
                )}
              </label>
              <label className="relative flex items-center rounded-[20px] bg-[#fbfaf5] md:w-64">
                <span className="pointer-events-none absolute left-5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#65748a]">{t("Sort")}</span>
                <select
                  className="w-full cursor-pointer appearance-none rounded-[20px] bg-transparent py-4 pl-16 pr-10 text-sm font-bold text-[#092a53] outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32]"
                  onChange={(event) => setSortBy(event.target.value)}
                  value={sortBy}
                >
                  {SORTS.map((option) => <option key={option.value} value={option.value}>{t(option.label)}</option>)}
                </select>
                <svg aria-hidden="true" className="pointer-events-none absolute right-4 size-3 text-[#65748a]" fill="none" viewBox="0 0 12 12">
                  <path d="m2 4 4 4 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
                </svg>
              </label>
            </div>

            <div aria-label={t("Menu categories")} className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]" role="group">
              {[{ title: "", icon: "✦", count: allItems.length }, ...categories.map((category) => ({ title: category.title, icon: category.icon, count: category.items.length }))].map((chip) => {
                const isActive = activeCategory === chip.title;
                return (
                  <button
                    aria-pressed={isActive}
                    className={`inline-flex shrink-0 items-center gap-2 rounded-full py-2 pl-3 pr-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] ${
                      isActive ? "bg-[#092a53] text-white shadow-[0_8px_18px_rgba(9,42,83,0.22)]" : "bg-[#f4f1e7] text-[#092a53] hover:bg-[#ebe5d3]"
                    }`}
                    key={chip.title || "all"}
                    onClick={() => chooseCategory(chip.title)}
                    type="button"
                  >
                    <span aria-hidden="true">{chip.icon}</span>
                    {chip.title ? t(chip.title) : t("All items")}
                    <span className={`rounded-full px-2 py-0.5 text-[11px] tabular-nums ${isActive ? "bg-white/15 text-[#ffdc32]" : "bg-white text-[#65748a]"}`}>{chip.count}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="mb-8 mt-6 flex flex-wrap items-center justify-between gap-3">
            <p aria-live="polite" className="text-sm text-[#65748a]">
              {t(matches.length === 1 ? "Showing 1 item" : "Showing {count} items", { count: matches.length })}
              {activeCategory && <> · <span className="font-bold text-[#092a53]">{t(activeCategory)}</span></>}
            </p>
            {cartError && <p className="text-sm font-semibold text-red-700" role="alert">{cartError}</p>}
          </div>

          {matches.length === 0 ? (
            <div className="mx-auto max-w-md rounded-[28px] bg-white px-6 py-12 text-center ring-1 ring-[#ebe7dc]">
              <span aria-hidden="true" className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#fff3b8] text-[#092a53]"><SearchIcon className="size-6" /></span>
              <h2 className="mt-5 font-display text-2xl font-extrabold text-[#092a53]">{t("No items match your search")}</h2>
              <p className="mt-2 text-sm leading-6 text-[#65748a]">{t("Try another word, or show every category.")}</p>
              <button
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#092a53] px-6 py-3 text-sm font-extrabold text-white transition hover:bg-[#163e6b]"
                onClick={() => { setSearch(""); setSortBy(""); chooseCategory(""); }}
                type="button"
              >
                {t("Show all items")}
              </button>
            </div>
          ) : grouped ? (
            <div className="space-y-16">
              {sections.map(({ category, entries }, index) => (
                // Sections further down are laid out only when they come near the screen, which keeps
                // the first view quick with 90+ products on the page.
                <section aria-labelledby={`all-menu-${getMenuItemId(category.title, "section")}`} className={index > 0 ? "[content-visibility:auto] [contain-intrinsic-size:auto_1400px]" : undefined} key={category.title}>
                  <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-[#ebe7dc] pb-5">
                    <div className="flex items-center gap-4">
                      <span aria-hidden="true" className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#092a53] text-2xl shadow-[0_10px_24px_rgba(9,42,83,0.2)]">{category.icon}</span>
                      <div>
                        <h2 className="font-display text-2xl font-extrabold tracking-tight text-[#092a53] sm:text-3xl" id={`all-menu-${getMenuItemId(category.title, "section")}`}>
                          {t(category.title)}
                        </h2>
                        {category.description && <p className="mt-1 text-sm text-[#65748a]">{t(category.description)}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-[#fff3b8] px-3 py-1 text-xs font-extrabold text-[#806a00]">
                        {t(entries.length === 1 ? "1 item" : "{count} items", { count: entries.length })}
                      </span>
                      <Link className="-my-2 inline-flex items-center gap-1.5 py-3 text-sm font-extrabold text-[#092a53] underline-offset-4 hover:underline" to={`/menu?${new URLSearchParams({ category: category.title })}`}>
                        {t("Open category")} <span aria-hidden="true">→</span>
                      </Link>
                    </div>
                  </header>
                  {renderGrid(entries)}
                </section>
              ))}
            </div>
          ) : (
            renderGrid(sorted, true)
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
