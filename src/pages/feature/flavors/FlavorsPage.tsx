import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useCart } from "../../../useCart";
import { type Flavor } from "../../../flavor-context/FlavorContext";
import { useFlavors } from "../../../flavor-context/useFlavors";
import { ArrowIcon, Footer, Header } from "../../../components/Layout";
import { PageHero } from "../../../components/PageHero";
import { useLanguage } from "../../../language/useLanguage";
import { formatCartMoney } from "../../../cartPricing";

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
  const selectedTag = searchParams.get("tag") || "";
  const flavorTags = [
    ...new Set(availableFlavors.map((flavor) => flavor.tag).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));
  const filteredFlavors = availableFlavors.filter((flavor: Flavor) => {
    const searchText = search.trim().toLocaleLowerCase();
    const matchesSearch =
      !searchText ||
      [flavor.name, flavor.detail, flavor.tag].some(
        (value) =>
          value.toLocaleLowerCase().includes(searchText) ||
          t(value).toLocaleLowerCase().includes(searchText),
      );
    return matchesSearch && (!selectedTag || flavor.tag === selectedTag);
  });
  const lowestPrice = availableFlavors.length
    ? Math.min(...availableFlavors.map((flavor) => flavor.price))
    : null;
  const hasFilters = Boolean(search.trim() || selectedTag);
  const clearFilters = () => {
    setSearch("");
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
              <span aria-current="page" className="text-white">{t("Online shop catalog")}</span>
            </nav>
          }
          description={t("Browse products entered by this website's operator. This catalog is separate from Cold Stone Creamery Cameroon and is not a confirmed local menu or price list.")}
          eyebrow={t("This website's catalog")}
          image={{ src: "/images/hero-ice-cream.jpg", alt: t("Colorful ice cream scoops ready to share") }}
          sideImages={["/ice-images/ice-3.webp", "/ice-images/ice-6.webp"]}
          stats={
            !loading && !error && availableFlavors.length > 0
              ? [
                  { label: t("Flavors"), value: availableFlavors.length },
                  { label: t("Tags"), value: flavorTags.length },
                  ...(lowestPrice !== null
                    ? [{ label: t("Starting from"), value: formatCartMoney(lowestPrice, "xaf", language), accent: true }]
                    : []),
                ]
              : []
          }
          title={t("Online shop catalog")}
        />

        <div className="mx-auto max-w-[1320px] px-5 py-12 sm:px-8 sm:py-16 lg:px-12">
          <section aria-labelledby="shop-products-heading" className="scroll-mt-4" id="shop-products">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="inline-flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#a48700]">
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
              <label className="group relative flex items-center rounded-[20px] bg-[#fbfaf5] transition focus-within:bg-white focus-within:ring-1 focus-within:ring-[#c9b24a]">
                <span className="sr-only">{t("Search flavors")}</span>
                <svg aria-hidden="true" className="pointer-events-none absolute left-5 size-5 text-[#8792a0] transition group-focus-within:text-[#092a53]" fill="none" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                  <path d="m20 20-3.5-3.5" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                </svg>
                <input
                  className="w-full bg-transparent py-4 pl-14 pr-12 text-base font-semibold text-[#092a53] outline-none! placeholder:font-medium placeholder:text-[#8792a0] [&::-webkit-search-cancel-button]:hidden"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("Search by flavor name or description")}
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

              {flavorTags.length > 0 && (
                <div className="mt-3 flex items-center gap-3 px-1">
                  <span className="hidden shrink-0 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#8792a0] sm:inline">{t("Flavor tag")}</span>
                  <div aria-label={t("Flavor tag")} className="-my-1 flex flex-1 gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group">
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
              {filteredFlavors.map((flavor) => {
                const added = addedId === flavor.id;
                return (
                  <article
                    className="group relative flex flex-col rounded-[22px] bg-white p-1.5 sm:rounded-[28px] sm:p-2.5 shadow-[0_1px_0_rgba(9,42,83,0.04),0_8px_24px_rgba(9,42,83,0.06)] ring-1 ring-[#ebe7dc] transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_56px_rgba(9,42,83,0.14)] hover:ring-[#e2d39a]"
                    key={flavor.id}
                  >
                    <Link
                      aria-hidden="true"
                      className={`relative block aspect-square overflow-hidden rounded-[17px] sm:rounded-[22px] ${flavor.color}`}
                      tabIndex={-1}
                      to={`/flavor/${flavor.id}`}
                    >
                      <img
                        alt=""
                        className="size-full object-cover transition duration-700 ease-out group-hover:scale-[1.05]"
                        src={flavor.image}
                      />
                      {flavor.tag && (
                        <span className="absolute left-2 top-2 max-w-[calc(100%-1rem)] truncate rounded-full bg-white/95 px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#52647b] shadow-sm backdrop-blur-sm sm:left-3 sm:top-3 sm:px-3 sm:py-1.5 sm:text-[10px]">
                          {t(flavor.tag)}
                        </span>
                      )}
                      {flavor.availableQuantity <= 5 && (
                        <span className="absolute bottom-2 left-2 rounded-full bg-[#092a53]/85 px-2 py-1 text-[9px] sm:bottom-auto sm:left-auto sm:right-3 sm:top-3 sm:px-3 sm:py-1.5 sm:text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#ffdc32] backdrop-blur-sm">
                          {t("{count} left", { count: flavor.availableQuantity })}
                        </span>
                      )}
                    </Link>

                    <div className="@container flex flex-1 flex-col px-1.5 pb-1.5 pt-3 sm:px-4 sm:pb-3 sm:pt-5">
                      <h3 className="line-clamp-2 font-display text-[15px] font-extrabold leading-snug text-[#092a53] sm:text-xl">
                        <Link className="after:absolute after:inset-0 after:rounded-[28px] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-[#bd9c00]" to={`/flavor/${flavor.id}`}>
                          {t(flavor.name)}
                        </Link>
                      </h3>
                      <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-[#65748a] sm:mt-2 sm:text-sm sm:leading-6">{t(flavor.detail)}</p>

                      <div className="mt-auto flex flex-col gap-2.5 border-t border-dashed border-[#e7e2d4] pt-3 sm:gap-3 sm:pt-4 @[16.5rem]:flex-row @[16.5rem]:items-center @[16.5rem]:justify-between">
                        <span className="whitespace-nowrap font-display text-sm font-extrabold tabular-nums text-[#092a53] sm:text-lg">
                          {formatCartMoney(flavor.price, "xaf", language)}
                        </span>
                        <button
                          aria-label={t("Add {name} to your bag", { name: t(flavor.name) })}
                          className={`relative z-10 inline-flex w-full shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 py-2.5 text-xs font-extrabold transition sm:py-3 @[16.5rem]:w-auto @[16.5rem]:py-2.5 duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2 ${
                            added
                              ? "bg-[#4caf50] text-white"
                              : "bg-[#ffdc32] text-[#092a53] hover:-translate-y-0.5 hover:bg-[#092a53] hover:text-white"
                          }`}
                          onClick={() => addFlavor(flavor)}
                          type="button"
                        >
                          {added ? (
                            <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
                              <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
                            </svg>
                          ) : (
                            <BagIcon />
                          )}
                          <span aria-live="polite">{added ? t("Added") : t("Add to bag")}</span>
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
                <span aria-hidden="true" className="grid size-14 place-items-center rounded-full bg-[#fbfaf5] text-[#8792a0] ring-1 ring-[#ebe7dc]">
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

            <p className="mt-8 flex gap-3 text-xs leading-5 text-[#8792a0]">
              <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center rounded-full bg-[#ffdc32]/40 text-[10px] font-extrabold text-[#806a00]">i</span>
              {t("Items and prices in the online catalog are set in FCFA by this website's operator and are not verified Cold Stone Cameroon products, menu prices or promotions.")}
            </p>
          </section>

          {/* Promo */}
          <section className="relative isolate mt-16 overflow-hidden rounded-[32px] bg-[#092a53] px-7 py-10 text-white sm:px-12 sm:py-14">
            <div aria-hidden="true" className="absolute -right-16 -top-24 -z-10 size-72 rounded-full border-[44px] border-white/[0.05]" />
            <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1.5 bg-gradient-to-r from-[#ffdc32] via-[#ffdc32]/50 to-transparent" />
            <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-5">
                <span aria-hidden="true" className="hidden size-16 shrink-0 place-items-center rounded-2xl bg-[#ffdc32] font-display text-xl font-extrabold text-[#092a53] sm:grid">3×</span>
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#ffdc32]">{t("This promotion applies only to this website's online catalog.")}</p>
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
