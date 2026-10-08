import { useState } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../../../CartContext";
import { useFlavors } from "../../../FlavorContext";
import { ArrowIcon, Footer, Header } from "../../../components/Layout";
import { useLanguage } from "../../../LanguageContext";

export function FlavorsPage() {
  const { addToCart } = useCart();
  const { flavors, loading, error } = useFlavors();
  const { t } = useLanguage();
  const availableFlavors = flavors.filter(
    (flavor) => flavor.availableQuantity > 0,
  );
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const flavorTags = [
    ...new Set(availableFlavors.map((flavor) => flavor.tag).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));
  const filteredFlavors = availableFlavors.filter((flavor) => {
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

  return (
    <div className="min-h-screen bg-[#fffefa] text-[#102c50]">
      <Header />

      <main className="mx-auto max-w-[1320px] px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#65748a] transition hover:text-[#102c50]"
        >
          <span aria-hidden="true">←</span> {t("Home")}
        </Link>

        <div className="mt-8 max-w-2xl">
          <p className="mb-2 inline-block rounded-full bg-[#ffeb9c] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#102c50]">
            {t("A scoop for every mood")}
          </p>
          <h1 className="font-display text-5xl font-bold tracking-tight text-[#102c50] sm:text-6xl">
            {t("All the")}{" "}
            <span className="text-[#e5bf00]">{t("Flavors").toLowerCase()}</span>
          </h1>
          <p className="mt-3 text-base leading-7 text-[#65748a]">
            {t(
              "Find your new favorite, made fresh with real ingredients and a whole lot of love.",
            )}
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.5fr)]">
          <label className="block text-sm font-semibold text-[#29415f]">
            {t("Search flavors")}
            <input
              className="mt-1.5 w-full rounded-xl border border-[#d9d6cc] bg-white px-4 py-3 text-sm font-normal text-[#102c50] outline-none transition focus:border-[#bd9c00] focus:ring-2 focus:ring-[#ffdc32]/40"
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("Search by flavor name or description")}
              type="search"
              value={search}
            />
          </label>
          <label className="block text-sm font-semibold text-[#29415f]">
            {t("Flavor tag")}
            <select
              className="mt-1.5 w-full rounded-xl border border-[#d9d6cc] bg-white px-4 py-3 text-sm font-normal text-[#102c50] outline-none transition focus:border-[#bd9c00] focus:ring-2 focus:ring-[#ffdc32]/40"
              onChange={(event) => setSelectedTag(event.target.value)}
              value={selectedTag}
            >
              <option value="">{t("All tags")}</option>
              {flavorTags.map((tag) => (
                <option key={tag} value={tag}>
                  {t(tag)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 lg:gap-5">
          {filteredFlavors.map((flavor) => (
            <article
              key={flavor.id}
              className="group overflow-hidden rounded-[22px] border border-[#ece8de] bg-white shadow-[0_8px_30px_rgba(18,44,80,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_14px_38px_rgba(18,44,80,0.12)]"
            >
              <Link
                to={`/flavor/${flavor.id}`}
                className={`relative block aspect-[0.92] overflow-hidden ${flavor.color}`}
              >
                <img
                  alt={`${t(flavor.name)} ${t("ice cream")}`}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  src={flavor.image}
                />
                <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[9px] font-bold text-[#29415f] shadow-sm">
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
                <p className="mt-1.5 min-h-8 text-[11px] leading-4 text-[#7b8796] sm:text-xs">
                  {t(flavor.detail)}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm font-extrabold text-[#102c50]">
                    ${flavor.price.toFixed(2)}
                  </span>
                  <button
                    aria-label={t("Add {name} to your bag", {
                      name: t(flavor.name),
                    })}
                    className="grid size-9 place-items-center rounded-full bg-[#ffdc32] text-lg font-bold text-[#102c50] transition hover:rotate-90 hover:bg-[#ffe76c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#102c50]"
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
          <p className="mt-6 rounded-2xl bg-[#fff9dc] px-5 py-6 text-center text-sm text-[#624f00]">
            {t("All flavors are currently sold out. Please check back soon.")}
          </p>
        )}
        {!loading &&
          !error &&
          availableFlavors.length > 0 &&
          filteredFlavors.length === 0 && (
            <p className="mt-6 rounded-2xl bg-[#f8f6f0] px-5 py-6 text-center text-sm text-[#65748a]">
              {t("No flavors match your filters.")}
            </p>
          )}
        {(loading || error) && (
          <p
            className={`mt-5 rounded-xl px-4 py-3 text-sm ${error ? "bg-red-50 text-red-700" : "bg-[#fff9dc] text-[#624f00]"}`}
            role={error ? "alert" : "status"}
          >
            {t(error || "Loading flavors…")}
          </p>
        )}

        <div className="mt-12 rounded-[24px] bg-[#fff0a8] px-6 py-8 text-center sm:px-10">
          <h2 className="font-display text-2xl font-bold text-[#102c50] sm:text-3xl">
            {t("More scoops, more smiles")}
          </h2>
          <p className="mt-2 text-sm text-[#53647b]">
            {t("Pick any three scoops and the lowest-priced one is on us.")}
          </p>
          <Link
            to="/cart"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#092a53] px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#164674]"
          >
            {t("Go to your bag")} <ArrowIcon />
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
