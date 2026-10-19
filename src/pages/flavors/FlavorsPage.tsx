import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useCart } from "../../context/useCart";
import { type Flavor } from "../../context/FlavorContext";
import { useFlavors } from "../../context/useFlavors";
import { ArrowIcon, Footer, Header } from "../../components/Layout";
import { PageHero } from "../../components/PageHero";
import { useLanguage } from "../../language/useLanguage";
import { formatCartMoney } from "../../lib/cartPricing";
import { photoErrorHandler, photoSrcSet } from "../../lib/thumbnails";

function BagIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M5 8h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9L5 8Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

export function FlavorsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { addToCart } = useCart();
  const { flavors, loading, error } = useFlavors();
  const { t, language } = useLanguage();
  const [addedId, setAddedId] = useState<Flavor["id"] | null>(null);
  const addedTimer = useRef<number | undefined>(undefined);
  const availableFlavors = flavors.filter(
    (flavor: Flavor) => flavor.availableQuantity > 0,
  );
  const [search, setSearch] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sortBy, setSortBy] = useState("recommended");
  const selectedTag = searchParams.get("tag") || "";
  // A tag only becomes a filter when it groups two or more flavors; a button that finds a
  // single flavor is noise. A tag opened from a link (?tag=) is always shown so it can be cleared.
  const tagCounts = new Map<string, number>();
  for (const flavor of availableFlavors) {
    if (flavor.tag) tagCounts.set(flavor.tag, (tagCounts.get(flavor.tag) || 0) + 1);
  }
  const flavorTags = [...tagCounts]
    .filter(([tag, count]) => count > 1 || tag === selectedTag)
    .map(([tag]) => tag)
    .sort((a, b) => a.localeCompare(b));
  const filteredFlavors = availableFlavors.filter((flavor: Flavor) => {
    const searchText = search.trim().toLocaleLowerCase();
    const matchesSearch =
      !searchText ||
      [flavor.name, flavor.detail, flavor.tag].some(
        (value) =>
          value.toLocaleLowerCase().includes(searchText) ||
          t(value).toLocaleLowerCase().includes(searchText),
      );
    const withinPrice = !maxPrice || flavor.price <= Number(maxPrice);
    return matchesSearch && withinPrice && (!selectedTag || flavor.tag === selectedTag);
  });
  // Sorting never changes which flavors match, only their order.
  const sortedFlavors = sortBy === "recommended"
    ? filteredFlavors
    : [...filteredFlavors].sort((a, b) => {
      if (sortBy === "price-asc") return a.price - b.price;
      if (sortBy === "price-desc") return b.price - a.price;
      return t(a.name).localeCompare(t(b.name));
    });
  const lowestPrice = availableFlavors.length
    ? Math.min(...availableFlavors.map((flavor) => flavor.price))
    : null;
  const hasFilters = Boolean(search.trim() || selectedTag || maxPrice);
  const clearFilters = () => {
    setSearch("");
    setMaxPrice("");
    setSearchParams({}, { replace: true });
  };
  const selectTag = (tag: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (tag) nextParams.set("tag", tag);
    else nextParams.delete("tag");
    setSearchParams(nextParams, { replace: true });
  };
  const addFlavor = (flavor: Flavor) => {
    if (!addToCart(flavor)) return;
    setAddedId(flavor.id);
    window.clearTimeout(addedTimer.current);
    addedTimer.current = window.setTimeout(() => setAddedId(null), 1800);
  };

  useEffect(() => () => window.clearTimeout(addedTimer.current), []);

  return (
    <div className="min-h-screen bg-[#fbfaf5] text-[#102c50]">
      <Header />

      <main>
        {/* Hero */}
        <PageHero
          compactOnMobile
          actions={
            <>
              <a className={PageHero.primary} href="#shop-products">
                {t("Find your flavors")} <span aria-hidden="true">↓</span>
              </a>
              <Link className={PageHero.secondary} to="/cart">
                <BagIcon /> {t("Go to your bag")}
              </Link>
            </>
          }
          badge={{ mark: "3×", eyebrow: t("More scoops, more smiles"), text: t("Pick any three scoops and the lowest-priced one is on us.") }}
          breadcrumb={
            <nav aria-label={t("Breadcrumb")} className="flex items-center gap-2">
              <Link className="transition hover:text-white" to="/">{t("Home")}</Link>
              <span aria-hidden="true" className="text-white/30">/</span>
              <span aria-current="page" className="text-white">{t("Flavors")}</span>
            </nav>
          }
          description={t("Pick your favorite flavors by the scoop and order online for pickup or delivery.")}
          eyebrow={t("Order by the scoop")}
          image={{ src: "/images/hero-ice-cream.jpg", alt: t("Colorful ice cream scoops ready to share") }}
          sideImages={["/ice-images/ice-3.webp", "/ice-images/ice-6.webp"]}
          stats={
            !loading && !error && availableFlavors.length > 0
              ? [
                  { label: t("Flavors"), value: availableFlavors.length },
                  ...(lowestPrice !== null
                    ? [{ label: t("Starting from"), value: formatCartMoney(lowestPrice, "xaf", language), accent: true }]
                    : []),
                ]
              : []
          }
          title={t("Ice cream flavors")}
        />

        <div className="mx-auto max-w-[1320px] px-5 py-12 sm:px-8 sm:py-16 lg:px-12">
          <section aria-labelledby="shop-products-heading" className="scroll-mt-4" id="shop-products">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="inline-flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#6f5a00]">
                  <span aria-hidden="true" className="h-px w-10 bg-[#a48700]" />
                  {t("Find your flavors")}
                </p>
                <h2 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-[#092a53] sm:text-5xl" id="shop-products-heading">
                  {t("A scoop for every mood")}
                </h2>
              </div>
              {!loading && !error && (
                <p aria-live="polite" className="rounded-full border border-[#ebe7dc] bg-white px-4 py-2 text-xs font-bold text-[#65748a]">
                  {t("{count} flavors available", { count: filteredFlavors.length })}
                </p>
              )}
            </div>

            {/* Search + tags */}
            <div className="relative z-30 mb-10 rounded-[28px] bg-white p-3 shadow-[0_1px_0_rgba(9,42,83,0.04),0_14px_40px_rgba(9,42,83,0.07)] ring-1 ring-[#ebe7dc] sm:p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
              <label className="group relative flex flex-1 items-center rounded-[20px] bg-[#fbfaf5] transition focus-within:bg-white focus-within:ring-1 focus-within:ring-[#c9b24a]">
                <span className="sr-only">{t("Search flavors")}</span>
                <svg aria-hidden="true" className="pointer-events-none absolute left-5 size-5 text-[#65748a] transition group-focus-within:text-[#092a53]" fill="none" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                  <path d="m20 20-3.5-3.5" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                </svg>
                <input
                  className="w-full bg-transparent py-4 pl-14 pr-12 text-base font-semibold text-[#092a53] outline-none! placeholder:font-medium placeholder:text-[#65748a] [&::-webkit-search-cancel-button]:hidden"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("Search flavors")}
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
                <div className="grid grid-cols-2 gap-3 lg:flex lg:flex-none">
                  <label className={`relative flex flex-col justify-center rounded-[20px] px-4 py-2.5 ring-1 transition lg:w-[170px] ${maxPrice ? "bg-[#fff8dd] ring-[#ecdfa6]" : "bg-[#fbfaf5] ring-transparent hover:ring-[#e5e1d7]"}`}>
                    <span className="truncate text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#65748a]">{t("Maximum price")}</span>
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
                      <span className="shrink-0 text-[10px] font-extrabold text-[#65748a]">FCFA</span>
                    </span>
                  </label>
                  <label className={`relative flex flex-col justify-center rounded-[20px] px-4 py-2.5 ring-1 transition lg:w-[190px] ${sortBy !== "recommended" ? "bg-[#fff8dd] ring-[#ecdfa6]" : "bg-[#fbfaf5] ring-transparent hover:ring-[#e5e1d7]"}`}>
                    <span className="truncate text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#65748a]">{t("Sort by")}</span>
                    <select
                      className="mt-0.5 w-full min-w-0 cursor-pointer appearance-none bg-transparent pr-5 text-sm font-bold text-[#092a53] outline-none!"
                      onChange={(event) => setSortBy(event.target.value)}
                      value={sortBy}
                    >
                      <option value="recommended">{t("Recommended")}</option>
                      <option value="price-asc">{t("Price: low to high")}</option>
                      <option value="price-desc">{t("Price: high to low")}</option>
                      <option value="name">{t("Name: A to Z")}</option>
                    </select>
                    <svg aria-hidden="true" className="pointer-events-none absolute bottom-3 right-3 size-4 text-[#65748a]" fill="none" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" stroke="currentColor" strokeLinecap="round" strokeWidth="2" /></svg>
                  </label>
                </div>
              </div>

              {!flavorTags.length && hasFilters && (
                <div className="mt-3 flex justify-end px-1">
                  <button className="text-xs font-extrabold text-[#092a53] underline decoration-[#ffdc32] decoration-2 underline-offset-4" onClick={clearFilters} type="button">
                    {t("Clear filters")}
                  </button>
                </div>
              )}

              {flavorTags.length > 0 && (
                <div className="mt-3 flex items-center gap-3 px-1">
                  <span className="hidden shrink-0 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#65748a] sm:inline">{t("Flavor tag")}</span>
                  {/* The faded right edge shows the row scrolls when the tags do not all fit. */}
                  <div aria-label={t("Flavor tag")} className="-my-1 flex min-w-0 flex-1 gap-2 overflow-x-auto py-1 pr-8 [mask-image:linear-gradient(to_right,black_calc(100%-2.5rem),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group">
                    {["", ...flavorTags].map((tag) => {
                      const active = selectedTag === tag;
                      return (
                        <button
                          aria-pressed={active}
                          className={`shrink-0 rounded-full px-4 py-2 text-xs font-extrabold transition first-letter:uppercase ${
                            active
                              ? "bg-[#092a53] text-white shadow-[0_6px_16px_rgba(9,42,83,0.2)]"
                              : "bg-[#fbfaf5] text-[#52647b] ring-1 ring-[#ebe7dc] hover:text-[#092a53] hover:ring-[#d9d4c7]"
                          }`}
                          key={tag || "all"}
                          onClick={() => selectTag(tag)}
                          type="button"
                        >
                          {tag ? t(tag) : t("All tags")}
                        </button>
                      );
                    })}
                  </div>
                  {hasFilters && (
                    <button
                      className="hidden shrink-0 text-xs font-extrabold text-[#092a53] underline decoration-[#ffdc32] decoration-2 underline-offset-4 sm:inline"
                      onClick={clearFilters}
                      type="button"
                    >
                      {t("Clear filters")}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Products */}
            <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
              {sortedFlavors.map((flavor) => {
                const added = addedId === flavor.id;
                const soldOut = flavor.availableQuantity < 1;
                return (
                  <article
                    className="group relative isolate flex flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_1px_2px_rgba(9,42,83,0.05),0_16px_40px_rgba(9,42,83,0.08)] ring-1 ring-[#ece8de] transition duration-300 ease-out hover:-translate-y-1.5 hover:shadow-[0_2px_4px_rgba(9,42,83,0.06),0_28px_60px_rgba(9,42,83,0.16)] hover:ring-[#e0dbcd]"
                    key={flavor.id}
                  >
                    {/* Framed image area */}
                    <div className="relative aspect-[4/3] overflow-hidden p-3 pb-0">
                      <div className="relative size-full overflow-hidden rounded-[18px] bg-[#f4f1e8]">
                        <Link
                          aria-hidden="true"
                          className="absolute inset-0 z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                          tabIndex={-1}
                          to={`/flavor/${flavor.id}`}
                        />
                        <img
                          decoding="async"
                          loading="lazy"
                          alt=""
                          className={`size-full object-cover transition duration-700 ease-out group-hover:scale-[1.07] ${soldOut ? "grayscale-[80%] opacity-70" : ""}`}
                          onError={photoErrorHandler(flavor.image)}
                          sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, 50vw"
                          src={flavor.image}
                          srcSet={photoSrcSet(flavor.image)}
                        />
                        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/25 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                        {flavor.tag && (
                          <span className="absolute left-3 top-3 max-w-[calc(100%-2rem)] truncate rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#092a53] shadow-[0_4px_12px_rgba(9,42,83,0.18)] backdrop-blur-sm">
                            {t(flavor.tag)}
                          </span>
                        )}
                        {!soldOut && flavor.availableQuantity <= 5 && (
                          <span className="absolute right-3 top-3 rounded-full border border-[#f3dcb0] bg-[#fff6dd]/95 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#7a5c00] shadow-sm backdrop-blur-sm">
                            {t("Only {count} left", { count: flavor.availableQuantity })}
                          </span>
                        )}
                        {soldOut && (
                          <span className="absolute inset-0 grid place-items-center bg-white/45 backdrop-blur-[3px]">
                            <span className="rounded-full bg-[#092a53] px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-white shadow-xl sm:text-xs">
                              {t("Sold out")}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex flex-1 flex-col p-4 sm:p-5">
                      <h3 className="line-clamp-1 font-display text-lg font-extrabold tracking-tight text-[#092a53] transition-colors group-hover:text-[#123f76] sm:text-xl">
                        {t(flavor.name)}
                      </h3>
                      <p className="mt-1.5 line-clamp-2 text-[13px] leading-5 text-[#65748a]">{t(flavor.detail)}</p>
                      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                        <span className="font-display text-lg font-extrabold tabular-nums text-[#092a53]">
                          {formatCartMoney(flavor.price, "xaf", language)}
                        </span>
                        <button
                          aria-label={t("Add {name} to your bag", { name: t(flavor.name) })}
                          className={`relative z-10 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-extrabold uppercase tracking-[0.08em] transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:bg-[#f1ede2] disabled:text-[#a5aebb] ${
                            added
                              ? "bg-[#4caf50] text-white"
                              : soldOut
                                ? "bg-[#f1ede2] text-[#a5aebb]"
                                : "bg-[#ffdc32] text-[#092a53] hover:-translate-y-0.5 hover:bg-[#ffe76c] hover:shadow-[0_8px_20px_rgba(255,220,50,0.35)]"
                          }`}
                          disabled={soldOut}
                          onClick={() => addFlavor(flavor)}
                          type="button"
                        >
                          {added ? (
                            <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
                              <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
                            </svg>
                          ) : (
                            <BagIcon className="size-4" />
                          )}
                          <span className="hidden sm:inline">{added ? t("Added") : t("Add")}</span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {!loading && !error && availableFlavors.length === 0 && (
              <div className="rounded-[28px] bg-white px-6 py-16 text-center ring-1 ring-[#ebe7dc]">
                <p className="font-display text-xl font-extrabold text-[#092a53]">{t("All flavors are currently sold out. Please check back soon.")}</p>
              </div>
            )}
            {!loading && !error && availableFlavors.length > 0 && filteredFlavors.length === 0 && (
              <div className="flex flex-col items-center rounded-[28px] bg-white px-6 py-16 text-center ring-1 ring-[#ebe7dc]">
                <span aria-hidden="true" className="grid size-14 place-items-center rounded-full bg-[#fbfaf5] text-[#65748a] ring-1 ring-[#ebe7dc]">
                  <svg className="size-6" fill="none" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                    <path d="m20 20-3.5-3.5" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                  </svg>
                </span>
                <p className="mt-5 font-display text-xl font-extrabold text-[#092a53]">{t("No flavors match your filters.")}</p>
                <button
                  className="mt-5 rounded-full bg-[#092a53] px-6 py-3 text-sm font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-[#163e6b]"
                  onClick={clearFilters}
                  type="button"
                >
                  {t("Clear filters")}
                </button>
              </div>
            )}
            {loading && !error && (
              <div aria-hidden="true" className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 4 }, (_, index) => (
                  <div className="rounded-[28px] bg-white p-2.5 ring-1 ring-[#ebe7dc]" key={index}>
                    <div className="aspect-square animate-pulse rounded-[22px] bg-[#f1ede2]" />
                    <div className="space-y-3 px-3 pb-3 pt-5">
                      <div className="h-5 w-2/3 animate-pulse rounded-full bg-[#f1ede2]" />
                      <div className="h-3 w-full animate-pulse rounded-full bg-[#f4f1e8]" />
                      <div className="h-3 w-4/5 animate-pulse rounded-full bg-[#f4f1e8]" />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {(loading || error) && (
              <p
                className={`mt-5 rounded-2xl px-5 py-4 text-sm ${error ? "bg-red-50 text-red-700" : "sr-only"}`}
                role={error ? "alert" : "status"}
              >
                {t(error || "Loading flavors…")}
              </p>
            )}

          </section>

          {/* Promo */}
          <section className="relative isolate mt-16 overflow-hidden rounded-[32px] bg-[#092a53] px-7 py-10 text-white sm:px-12 sm:py-14">
            <div aria-hidden="true" className="absolute -right-16 -top-24 -z-10 size-72 rounded-full border-[44px] border-white/[0.05]" />
            <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1.5 bg-gradient-to-r from-[#ffdc32] via-[#ffdc32]/50 to-transparent" />
            <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-5">
                <span aria-hidden="true" className="hidden size-16 shrink-0 place-items-center rounded-2xl bg-[#ffdc32] font-display text-xl font-extrabold text-[#092a53] sm:grid">3×</span>
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#ffdc32]">{t("Scoop deal")}</p>
                  <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{t("More scoops, more smiles")}</h2>
                  <p className="mt-2 max-w-lg text-sm leading-6 text-white/70">{t("Pick any three scoops and the lowest-priced one is on us.")}</p>
                </div>
              </div>
              <Link
                className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full bg-[#ffdc32] px-7 py-4 text-sm font-extrabold text-[#092a53] transition hover:-translate-y-0.5 hover:bg-[#ffe76c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32] focus-visible:ring-offset-2 focus-visible:ring-offset-[#092a53]"
                to="/cart"
              >
                {t("Go to your bag")} <ArrowIcon />
              </Link>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
