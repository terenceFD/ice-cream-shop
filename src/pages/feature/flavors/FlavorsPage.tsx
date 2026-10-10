import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useCart } from "../../../CartContext";
import { useFlavors, type Flavor } from "../../../flavor-context/FlavorContext";
import { ArrowIcon, Footer, Header } from "../../../components/Layout";
import { useLanguage } from "../../../language/LanguageContext";
import { formatCartMoney } from "../../../cartPricing";

export function FlavorsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { addToCart } = useCart();
  const { flavors, loading, error } = useFlavors();
  const { t, language } = useLanguage();
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
  const clearFilters = () => {
    setSearch("");
    setSearchParams({}, { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#fbfaf5] text-[#102c50]">
      <Header />

      <main>
        <section className="relative isolate overflow-hidden bg-[#092a53] text-white">
          <div aria-hidden="true" className="absolute -right-28 -top-40 size-[32rem] rounded-full border-[76px] border-white/[0.04]" />
          <div className="relative mx-auto grid max-w-[1320px] items-center gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[1fr_0.8fr] lg:px-12 lg:py-20">
            <div className="max-w-2xl">
              <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-white/65 transition hover:text-white">
                <span aria-hidden="true">←</span> {t("Home")}
              </Link>
              <p className="mt-7 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#ffdc32]">
                {t("This website's catalog")}
              </p>
              <h1 className="mt-4 font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                {t("Online shop catalog")}
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-white/75 sm:text-base sm:leading-7">
                {t("Browse products entered by this website's operator. This catalog is separate from Cold Stone Creamery Cameroon and is not a confirmed local menu or price list.")}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a className="inline-flex items-center gap-2 rounded-full bg-[#ffdc32] px-5 py-3 text-sm font-bold text-[#092a53] transition hover:-translate-y-0.5 hover:bg-[#ffe76c]" href="#shop-products">
                  {t("Find your flavors")} <span aria-hidden="true">↓</span>
                </a>
                <Link className="inline-flex items-center gap-2 rounded-full border border-white/30 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10" to="/cart">
                  {t("Go to your bag")} <ArrowIcon />
                </Link>
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-[500px] pb-4 pr-4 sm:pb-6 sm:pr-6">
              <div aria-hidden="true" className="absolute bottom-0 right-0 h-[68%] w-[72%] rounded-[28px] bg-[#ffdc32]" />
              <img alt={t("Colorful ice cream scoops ready to share")} className="relative z-10 aspect-[1.22] w-full rounded-[26px] object-cover shadow-[0_24px_60px_rgba(0,0,0,0.25)] sm:rounded-[32px]" src="/ice-images/ice-4.webp" />
              <div className="absolute -bottom-1 left-0 z-20 flex items-center gap-3 rounded-2xl border border-[#e7e3d9] bg-white p-3 text-[#102c50] shadow-lg sm:-left-4 sm:p-4">
                <img alt="" aria-hidden="true" className="size-12 rounded-xl object-cover sm:size-14" src="/ice-images/ice-3.webp" />
                <div>
                  <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#806a00]">{t("More scoops, more smiles")}</p>
                  <p className="mt-1 text-xs font-bold sm:text-sm">{t("Pick any three scoops and the lowest-priced one is on us.")}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-8 sm:py-12 lg:px-12">
          <p className="mb-8 rounded-2xl border border-[#eadb8a] bg-[#fff9dc] px-4 py-3.5 text-sm leading-6 text-[#624f00] sm:px-5">
            {t("Items and prices in the online catalog are set in FCFA by this website's operator and are not verified Cold Stone Cameroon products, menu prices or promotions.")}
          </p>

          <section aria-labelledby="shop-products-heading" id="shop-products">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#a48700]">{t("Find your flavors")}</p>
                <h2 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl" id="shop-products-heading">{t("A scoop for every mood")}</h2>
              </div>
              {!loading && !error && (
                <p className="text-sm font-semibold text-[#65748a]">{t("{count} flavors available", { count: filteredFlavors.length })}</p>
              )}
            </div>

            <div className="mb-6 grid gap-3 rounded-[22px] border border-[#e7e3d9] bg-white p-4 shadow-[0_8px_28px_rgba(18,44,80,0.05)] sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.45fr)] sm:p-5">
              <label className="block text-xs font-bold text-[#52647b]">
                {t("Search flavors")}
                <span className="relative mt-1.5 block">
                  <svg aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#8792a0]" fill="none" viewBox="0 0 20 20">
                    <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
                    <path d="m13 13 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
                  </svg>
                  <input
                    className="w-full rounded-xl border border-[#e7e3d9] bg-[#fbfaf5] py-3 pl-10 pr-4 text-sm font-normal text-[#102c50] outline-none transition placeholder:text-[#8792a0] focus:border-[#bd9c00] focus:bg-white focus:ring-2 focus:ring-[#ffdc32]/40"
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t("Search by flavor name or description")}
                    type="search"
                    value={search}
                  />
                </span>
              </label>
              <label className="block text-xs font-bold text-[#52647b]">
                {t("Flavor tag")}
                <select
                  className="mt-1.5 w-full rounded-xl border border-[#e7e3d9] bg-[#fbfaf5] px-4 py-3 text-sm font-normal text-[#102c50] outline-none transition focus:border-[#bd9c00] focus:bg-white focus:ring-2 focus:ring-[#ffdc32]/40"
                  onChange={(event) => {
                    const nextParams = new URLSearchParams(searchParams);
                    if (event.target.value) nextParams.set("tag", event.target.value);
                    else nextParams.delete("tag");
                    setSearchParams(nextParams, { replace: true });
                  }}
                  value={selectedTag}
                >
                  <option value="">{t("All tags")}</option>
                  {flavorTags.map((tag) => (
                    <option key={tag} value={tag}>{t(tag)}</option>
                  ))}
                </select>
              </label>
            </div>

            {flavorTags.length > 0 && (
              <div className="mb-6 flex flex-wrap gap-2" aria-label={t("Flavor tag")}>
                <button
                  className={`rounded-full px-4 py-2 text-xs font-bold transition ${selectedTag ? "border border-[#d9d6cc] bg-white text-[#65748a] hover:border-[#092a53] hover:text-[#092a53]" : "bg-[#092a53] text-white"}`}
                  onClick={() => setSearchParams({}, { replace: true })}
                  type="button"
                >
                  {t("All tags")}
                </button>
                {flavorTags.map((tag) => (
                  <button
                    className={`rounded-full px-4 py-2 text-xs font-bold transition ${selectedTag === tag ? "bg-[#092a53] text-white" : "border border-[#d9d6cc] bg-white text-[#65748a] hover:border-[#092a53] hover:text-[#092a53]"}`}
                    key={tag}
                    onClick={() => setSearchParams({ tag }, { replace: true })}
                    type="button"
                  >
                    {t(tag)}
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 lg:gap-5">
          {filteredFlavors.map((flavor) => (
            <article
              key={flavor.id}
              className="group overflow-hidden rounded-[22px] border border-[#e7e3d9] bg-white shadow-[0_8px_26px_rgba(18,44,80,0.05)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_16px_38px_rgba(18,44,80,0.12)]"
            >
              <Link
                to={`/flavor/${flavor.id}`}
                className={`relative block aspect-[0.94] overflow-hidden ${flavor.color}`}
              >
                <img
                  alt={`${t(flavor.name)} ${t("ice cream")}`}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  src={flavor.image}
                />
                <span className="absolute left-3 top-3 rounded-full border border-white/60 bg-white/95 px-2.5 py-1.5 text-[9px] font-bold text-[#52647b] shadow-sm">
                  {t(flavor.tag)}
                </span>
              </Link>
              <div className="p-3.5 sm:p-4">
                <Link
                  to={`/flavor/${flavor.id}`}
                  className="font-display text-base font-bold leading-tight text-[#102c50] hover:text-[#ccaa00] sm:text-lg"
                >
                  {t(flavor.name)}
                </Link>
                <p className="mt-1.5 min-h-10 text-[11px] leading-4 text-[#7b8796] sm:text-xs">
                  {t(flavor.detail)}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm font-extrabold text-[#102c50]">
                    {formatCartMoney(flavor.price, "xaf", language)}
                  </span>
                  <button
                    aria-label={t("Add {name} to your bag", {
                      name: t(flavor.name),
                    })}
                    className="grid size-9 place-items-center rounded-full bg-[#ffdc32] text-lg font-bold text-[#102c50] transition hover:-translate-y-0.5 hover:bg-[#ffe76c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#102c50]"
                    onClick={() => addToCart(flavor)}
                    type="button"
                  >
                    +
                  </button>
                </div>
              </div>
            </article>
          ))}
            </div>
        {!loading && !error && availableFlavors.length === 0 && (
          <p className="mt-6 rounded-2xl border border-[#eadb8a] bg-[#fff9dc] px-5 py-6 text-center text-sm text-[#624f00]">
            {t("All flavors are currently sold out. Please check back soon.")}
          </p>
        )}
        {!loading &&
          !error &&
          availableFlavors.length > 0 &&
          filteredFlavors.length === 0 && (
            <div className="mt-6 rounded-2xl border border-[#e7e3d9] bg-white px-5 py-10 text-center">
              <p className="font-display text-lg font-bold">{t("No flavors match your filters.")}</p>
              <button className="mt-3 text-sm font-bold text-[#806a00] underline decoration-[#ffdc32] underline-offset-4" onClick={clearFilters} type="button">{t("Clear filters")}</button>
            </div>
          )}
        {(loading || error) && (
          <p
            className={`mt-5 rounded-xl border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-[#eadb8a] bg-[#fff9dc] text-[#624f00]"}`}
            role={error ? "alert" : "status"}
          >
            {t(error || "Loading flavors…")}
          </p>
        )}

          </section>

          <section className="relative isolate mt-14 overflow-hidden rounded-[26px] bg-[#ffdc32] px-6 py-8 text-[#092a53] sm:px-10 sm:py-10">
            <div aria-hidden="true" className="absolute -right-12 -top-24 size-64 rounded-full border-[40px] border-[#092a53]/[0.06]" />
            <div className="relative flex flex-wrap items-center justify-between gap-6">
              <div>
                <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#624f00]">{t("This promotion applies only to this website's online catalog.")}</p>
                <h2 className="font-display text-2xl font-bold sm:text-3xl">{t("More scoops, more smiles")}</h2>
                <p className="mt-2 text-sm text-[#53647b]">{t("Pick any three scoops and the lowest-priced one is on us.")}</p>
              </div>
              <Link
                to="/cart"
                className="inline-flex items-center gap-2 rounded-full bg-[#092a53] px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#163e6b]"
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
