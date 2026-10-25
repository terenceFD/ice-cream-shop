import { useEffect, useRef, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { Header, Footer, ArrowIcon } from "../../components/Layout";
import { ProductImageSlider } from "../../components/ProductImageSlider";
import { useCart } from "../../context/useCart";
import { type Flavor } from "../../context/FlavorContext";
import { useFlavors } from "../../context/useFlavors";
import { useLanguage } from "../../language/useLanguage";
import { formatCartMoney } from "../../lib/cartPricing";
import { coldStoneMenuCategories } from "../../../shared/data";
import { normalizePhotoGallery } from "../../../shared/photoSizes.js";
import { metaForFlavor, metaForPath } from "../../seo/pageMeta.js";
import { useDocumentMeta } from "../../seo/useDocumentMeta";
import { photoErrorHandler, photoSrcSet } from "../../lib/thumbnails";
import { FLAVOR_PHOTO_SIZES } from "../../../shared/photoSizes.js";
import { rankSimilar } from "../../lib/similarItems";

function BagIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M5 8h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9L5 8Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function CheckIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
    </svg>
  );
}

const MAX_QUANTITY = 10;

type InfoTab = "about" | "contains" | "details";

// Flavor colours are stored as Tailwind classes such as "bg-[#fff1cf]"; pull out the hex for inline tinting.
function flavorTint(color?: string) {
  const match = color?.match(/#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/i);
  return match ? match[0] : "#fff1cf";
}

function getFlavorImages(flavor: Flavor) {
  const menuItems = coldStoneMenuCategories.flatMap((category) => category.items || []);
  const matchingMenuItem = menuItems.find((item) =>
    [item.image, ...normalizePhotoGallery(item.gallery)].includes(flavor.image),
  );
  return [...new Set([
    flavor.image,
    ...(matchingMenuItem
      ? [matchingMenuItem.image, ...normalizePhotoGallery(matchingMenuItem.gallery)]
      : []),
  ].filter(Boolean))];
}

export function FlavorDetailPage() {
  const { id } = useParams();
  const { addToCart, addItemsToCart } = useCart();
  const { flavors, loading, error } = useFlavors();
  const { t, language } = useLanguage();
  const [quantity, setQuantity] = useState(1);
  const [addedKey, setAddedKey] = useState<string | null>(null);
  const [cartNotice, setCartNotice] = useState("");
  const [activeInfoTab, setActiveInfoTab] = useState<InfoTab>("about");
  const addedTimer = useRef<number | undefined>(undefined);

  const flavor = flavors.find((item: Flavor) => item.id === Number(id));
  useDocumentMeta(
    flavor
      ? { ...metaForFlavor(flavor), index: flavor.availableQuantity > 0 }
      : loading
        ? null
        : { ...metaForPath("/flavor-not-found"), path: `/flavor/${id}` },
  );

  useEffect(() => {
    setQuantity(1);
    setCartNotice("");
    setActiveInfoTab("about");
    window.scrollTo({ top: 0 });
  }, [id]);

  useEffect(() => () => window.clearTimeout(addedTimer.current), []);

  const flashAdded = (key: string) => {
    setAddedKey(key);
    window.clearTimeout(addedTimer.current);
    addedTimer.current = window.setTimeout(() => setAddedKey(null), 1800);
  };

  if (!flavor && loading) {
    return (
      <div className="flex min-h-screen flex-col bg-[#fbfaf5]">
        <Header />
        <main id="main" tabIndex={-1} className="mx-auto grid w-full max-w-[1320px] flex-1 gap-10 px-5 py-12 sm:px-8 lg:grid-cols-12 lg:px-12">
          <p className="sr-only" role="status">{t("Loading flavor…")}</p>
          <div aria-hidden="true" className="aspect-square animate-pulse rounded-[32px] bg-[#f1ede2] lg:col-span-7" />
          <div aria-hidden="true" className="space-y-5 lg:col-span-5 lg:pt-10">
            <div className="h-3 w-24 animate-pulse rounded-full bg-[#f1ede2]" />
            <div className="h-12 w-3/4 animate-pulse rounded-2xl bg-[#f1ede2]" />
            <div className="h-4 w-full animate-pulse rounded-full bg-[#f4f1e8]" />
            <div className="h-4 w-5/6 animate-pulse rounded-full bg-[#f4f1e8]" />
            <div className="h-24 w-full animate-pulse rounded-3xl bg-[#f4f1e8]" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!flavor) {
    return (
      <div className="flex min-h-screen flex-col bg-[#fbfaf5]">
        <Header />
        <main id="main" tabIndex={-1} className="grid flex-1 place-items-center px-5 py-20">
          <div className="flex max-w-md flex-col items-center text-center">
            <span aria-hidden="true" className="grid size-16 place-items-center rounded-full bg-white font-display text-2xl font-extrabold text-[#8a7000] ring-1 ring-[#ebe7dc]">?</span>
            <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight text-[#092a53]">
              {error ? t(error) : t("Flavor not found")}
            </h1>
            {error && (
              <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>
            )}
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link className="inline-flex items-center gap-2 rounded-full bg-[#092a53] px-6 py-3.5 text-sm font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-[#163e6b]" to="/flavors">
                {t("Browse all flavors")} <ArrowIcon />
              </Link>
              <Link className="inline-flex items-center gap-2 rounded-full border border-[#d9d4c7] bg-white px-6 py-3.5 text-sm font-extrabold text-[#092a53] transition hover:border-[#092a53]" to="/">
                {t("Back to home")}
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (flavor.availableQuantity < 1) {
    return <Navigate to="/flavors" replace />;
  }

  const maxQuantity = Math.max(1, Math.min(MAX_QUANTITY, flavor.availableQuantity));
  const lowStock = flavor.availableQuantity <= 5;
  const allergens = flavor.allergies || [];
  const mainAdded = addedKey === `main-${flavor.id}`;
  const tint = flavorTint(flavor.color);
  const flavorImages = getFlavorImages(flavor);
  const infoTabs: { key: InfoTab; label: string }[] = [
    { key: "about", label: t("Description") },
    { key: "contains", label: t("Contains") },
    { key: "details", label: t("Details") },
  ];
  // Eight in-stock flavors: same label first, then flavors sharing ingredients (chocolate, berry…).
  const relatedFlavors: Flavor[] = rankSimilar(
    { key: String(flavor.id), group: flavor.tag, text: `${flavor.name} ${flavor.detail}` },
    flavors
      .filter((item: Flavor) => item.id === flavor.id || item.availableQuantity > 0)
      .map((item: Flavor) => ({ key: String(item.id), group: item.tag, text: `${item.name} ${item.detail}`, flavor: item })),
    8,
  ).map((candidate: { flavor: Flavor }) => candidate.flavor);

  const addSelected = () => {
    setCartNotice("");
    const added = addItemsToCart([{ ...flavor, quantity }]);
    if (added > 0) {
      flashAdded(`main-${flavor.id}`);
      setQuantity(1);
    } else {
      setCartNotice(t("This item could not be added to your bag. Please try again."));
    }
  };

  return (
    <div className="min-h-screen bg-[#fbfaf5] text-[#102c50]">
      <Header />

      <main id="main" tabIndex={-1}>
        <section className="relative isolate overflow-hidden" style={{ backgroundColor: tint }}>
          <div className="mx-auto max-w-[1320px] px-5 pb-14 pt-7 sm:px-8 sm:pb-16 sm:pt-8 lg:px-12 lg:pb-20">
            <nav aria-label={t("Breadcrumb")} className="mb-8 flex flex-wrap items-center gap-2 text-sm font-semibold text-[#092a53]/70">
              <Link className="transition hover:text-[#092a53]" to="/">{t("Home")}</Link>
              <span aria-hidden="true" className="text-[#092a53]/30">/</span>
              <Link className="transition hover:text-[#092a53]" to="/flavors">{t("Flavors")}</Link>
              {flavor.tag && (
                <>
                  <span aria-hidden="true" className="text-[#092a53]/30">/</span>
                  <Link className="transition hover:text-[#092a53]" to={`/flavors?tag=${encodeURIComponent(flavor.tag)}`}>{t(flavor.tag)}</Link>
                </>
              )}
              <span aria-hidden="true" className="text-[#092a53]/30">/</span>
              <span aria-current="page" className="max-w-[14rem] truncate text-[#092a53]">{t(flavor.name)}</span>
            </nav>

            <div className="grid items-start gap-8 lg:grid-cols-12 lg:gap-12">
              <div className="relative mx-auto w-full max-w-[520px] lg:col-span-7 lg:max-w-none">
                <ProductImageSlider
                  frameClassName={`bg-[#e8edf2] ${flavor.color || ""}`}
                  imageClassName="aspect-[4/3] lg:aspect-[5/4]"
                  images={flavorImages}
                  name={t(flavor.name)}
                  overlay={
                    <>
                      {flavor.tag && (
                        <span className="absolute left-4 top-4 rounded-full border border-white/80 bg-white/95 px-3.5 py-2 text-[11px] font-extrabold text-[#092a53] shadow-sm backdrop-blur-sm sm:left-6 sm:top-6 sm:text-xs">
                          {t(flavor.tag)}
                        </span>
                      )}
                      {lowStock && (
                        <span className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full bg-white/95 px-3.5 py-2 text-xs font-bold text-[#806a00] shadow-sm backdrop-blur-sm sm:bottom-6 sm:left-6 sm:text-sm">
                          <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-[#d4ad00] motion-reduce:animate-none" />
                          {t("{count} left", { count: flavor.availableQuantity })}
                        </span>
                      )}
                    </>
                  }
                  priority
                  resetKey={flavor.id}
                  showScrim={false}
                  sizes={FLAVOR_PHOTO_SIZES}
                />
              </div>

              <div className="min-w-0 rounded-[24px] bg-white p-6 sm:p-9 lg:col-span-5">
                <h1 className="mt-4 break-words font-display text-4xl font-extrabold leading-[1.02] tracking-tight text-[#092a53] sm:text-5xl lg:text-6xl">
                  {t(flavor.name)}
                </h1>
                <p className="mt-4 text-lg font-semibold leading-8 text-[#52647b]">{t(flavor.detail)}</p>

                <div className="mt-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#f7f6f1] px-4 py-5">
                  <p className="font-display text-4xl font-extrabold tabular-nums text-[#092a53]">
                    {formatCartMoney(flavor.price, "xaf", language)}
                    <span className="ml-2 font-sans text-sm font-bold text-[#65748a] max-sm:hidden">/ {t("Price per scoop").toLocaleLowerCase()}</span>
                  </p>
                  <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold ${lowStock ? "bg-[#fff6dc] text-[#806a00]" : "bg-[#f3f8ef] text-[#37632c]"}`}>
                    <span aria-hidden="true" className={`size-1.5 rounded-full ${lowStock ? "bg-[#d4ad00]" : "bg-[#4caf50]"}`} />
                    {lowStock ? t("{count} left", { count: flavor.availableQuantity }) : t("In stock")}
                  </span>
                </div>

                {/* Quantity + add */}
                <div className="mt-6 flex gap-3">
                  <div aria-label={t("Quantity")} className="flex shrink-0 items-center rounded-full bg-[#fbfaf5] p-1 ring-1 ring-[#e5e1d7]" role="group">
                    <button
                      aria-label={t("Decrease quantity")}
                      className="grid size-11 place-items-center rounded-full text-lg font-bold text-[#092a53] transition hover:bg-white disabled:cursor-not-allowed disabled:text-[#c9c3b4] disabled:hover:bg-transparent"
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
                      className="grid size-11 place-items-center rounded-full text-lg font-bold text-[#092a53] transition hover:bg-white disabled:cursor-not-allowed disabled:text-[#c9c3b4] disabled:hover:bg-transparent"
                      disabled={quantity >= maxQuantity}
                      onClick={() => setQuantity((current) => Math.min(maxQuantity, current + 1))}
                      type="button"
                    >
                      +
                    </button>
                  </div>
                  <button
                    className={`inline-flex min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 py-4 text-sm font-extrabold transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2 sm:px-6 ${
                      mainAdded
                        ? "bg-[#4caf50] text-white"
                        : "bg-[#092a53] text-white hover:-translate-y-0.5 hover:bg-[#163e6b]"
                    }`}
                    onClick={addSelected}
                    type="button"
                  >
                    {mainAdded ? <CheckIcon /> : <BagIcon />}
                    <span aria-live="polite">
                      {mainAdded ? t("Added") : (
                        <>
                          {t("Add to bag")}
                          <span className="max-sm:hidden"> · {formatCartMoney(flavor.price * quantity, "xaf", language)}</span>
                        </>
                      )}
                    </span>
                  </button>
                </div>
                {cartNotice && (
                  <p className="mt-3 text-xs leading-5 text-red-700" role="alert">{cartNotice}</p>
                )}
                <Link
                  className="mt-4 inline-flex w-fit items-center gap-2 text-sm font-extrabold text-[#092a53] underline decoration-[#ffdc32] decoration-2 underline-offset-4 transition hover:decoration-[#092a53]"
                  to="/cart"
                >
                  {t("View cart")} <ArrowIcon diagonal />
                </Link>

                {/* Info tabs */}
                <div className="mt-8">
                  <div aria-label={t("Flavor details")} className="flex gap-1 rounded-full bg-[#f4f1e7] p-1" role="tablist">
                    {infoTabs.map((tab, index) => {
                      const selected = activeInfoTab === tab.key;
                      return (
                        <button
                          aria-controls={`flavor-panel-${tab.key}`}
                          aria-selected={selected}
                          className={`min-w-0 flex-1 truncate rounded-full px-3 py-2.5 text-xs font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] sm:text-sm ${
                            selected ? "bg-[#092a53] text-white" : "text-[#52647b] hover:bg-white hover:text-[#092a53]"
                          }`}
                          id={`flavor-tab-${tab.key}`}
                          key={tab.key}
                          onClick={() => setActiveInfoTab(tab.key)}
                          onKeyDown={(event) => {
                            const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
                            if (!step) return;
                            event.preventDefault();
                            const next = infoTabs[(index + step + infoTabs.length) % infoTabs.length];
                            setActiveInfoTab(next.key);
                            document.getElementById(`flavor-tab-${next.key}`)?.focus();
                          }}
                          role="tab"
                          tabIndex={selected ? 0 : -1}
                          type="button"
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  <div
                    aria-labelledby={`flavor-tab-${activeInfoTab}`}
                    className="min-h-28 px-1 pt-5"
                    id={`flavor-panel-${activeInfoTab}`}
                    role="tabpanel"
                    tabIndex={0}
                  >
                    {activeInfoTab === "about" && (
                      <p className="text-base leading-8 text-[#52647b]">{t(flavor.description)}</p>
                    )}
                    {activeInfoTab === "contains" && (
                      <ul className="flex flex-wrap gap-2">
                        {allergens.length ? (
                          allergens.map((allergen) => (
                            <li className="inline-flex items-center gap-1.5 rounded-full bg-[#fff6dc] px-3 py-1.5 text-xs font-bold text-[#806a00] ring-1 ring-[#ecdfa6]" key={allergen}>
                              <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                              {t(allergen)}
                            </li>
                          ))
                        ) : (
                          <li className="text-sm text-[#7b8796]">{t("None listed")}</li>
                        )}
                      </ul>
                    )}
                    {activeInfoTab === "details" && (
                      <dl className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-[#f7f6f1] p-4">
                          <dt className="text-xs font-bold text-[#52647b]">{t("Origin")}</dt>
                          <dd className="mt-1 font-display text-lg font-extrabold text-[#092a53]">{t(flavor.origin)}</dd>
                        </div>
                        <div className="rounded-2xl bg-[#f7f6f1] p-4">
                          <dt className="text-xs font-bold text-[#52647b]">{t("Servings")}</dt>
                          <dd className="mt-1 font-display text-lg font-extrabold tabular-nums text-[#092a53]">{flavor.servings}</dd>
                        </div>
                      </dl>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Offer */}
        <section className="mx-auto max-w-[1320px] px-5 pt-12 sm:px-8 sm:pt-16 lg:px-12">
          <div className="flex flex-col gap-6 rounded-[24px] bg-[#092a53] p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="flex items-center gap-5">
              <span aria-hidden="true" className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#ffdc32] font-display text-lg font-extrabold text-[#092a53]">3×</span>
              <div>
                <p className="font-display text-2xl font-extrabold">{t("More scoops, more smiles")}</p>
                <p className="mt-1 text-sm font-semibold text-white/75">{t("Pick any three scoops and the lowest-priced one is on us.")}</p>
              </div>
            </div>
            <Link className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full bg-[#ffdc32] px-6 py-3.5 text-sm font-extrabold text-[#092a53] transition hover:-translate-y-0.5 hover:bg-[#ffe76c]" to="/cart">
              <BagIcon /> {t("Go to your bag")}
            </Link>
          </div>
        </section>

        {relatedFlavors.length > 0 && (
          <section
            aria-labelledby="related-flavors-title"
            className="relative overflow-hidden bg-[#f4f6f8] px-5 py-16 text-[#092a53] sm:px-8 sm:py-20 lg:px-10 lg:py-24"
            id="related-flavors"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-40 -top-48 size-[32rem] rounded-full bg-[radial-gradient(closest-side,rgb(255_220_50/0.12),transparent)]"
            />
            <div className="relative mx-auto max-w-[1320px]">
              <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#123b68]">
                    {t("Follow your flavor")}
                  </p>
                  <h2
                    className="mt-4 max-w-[14ch] font-display text-4xl font-extrabold leading-[1.02] tracking-tight text-[#092a53] sm:text-5xl lg:text-6xl"
                    id="related-flavors-title"
                  >
                    {t("You might also love")}
                  </h2>
                </div>
                <Link
                  className="group inline-flex min-h-14 items-center gap-3 rounded-full border-2 border-[#092a53] bg-white/60 px-8 py-3.5 text-base font-extrabold text-[#092a53] shadow-[0_6px_18px_rgba(9,42,83,0.08)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#092a53] hover:text-white hover:shadow-[0_12px_28px_rgba(9,42,83,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2"
                  to="/flavors"
                >
                  {t("Browse all flavors")}
                  <ArrowIcon />
                </Link>
              </div>

              <div className="mt-8 grid auto-rows-fr grid-cols-2 gap-3.5 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4 lg:gap-6">
                {relatedFlavors.map((relatedFlavor) => {
                  const added = addedKey === `related-${relatedFlavor.id}`;
                  return (
                    <article
                      className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-lg bg-white ring-1 ring-[#d7dee7] transition duration-500 ease-out hover:-translate-y-2 hover:rotate-[0.4deg] hover:shadow-[0_24px_48px_rgba(9,42,83,0.18)] hover:ring-[#ffdc32]/70 focus-within:-translate-y-2 focus-within:rotate-[0.4deg] focus-within:shadow-[0_24px_48px_rgba(9,42,83,0.18)] focus-within:ring-[#ffdc32]/70 motion-reduce:transform-none motion-reduce:transition-none"
                      key={relatedFlavor.id}
                    >
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 z-20 -translate-x-[130%] skew-x-[-18deg] bg-[linear-gradient(100deg,transparent_30%,rgba(255,255,255,0.55)_50%,transparent_70%)] transition-transform duration-700 ease-out group-hover:translate-x-[130%] group-focus-within:translate-x-[130%] motion-reduce:hidden"
                      />
                      <div className="relative bg-[#e8edf2]">
                        <div className={`relative overflow-hidden ${relatedFlavor.color}`}>
                          <img
                            decoding="async"
                            alt=""
                            className="aspect-[4/3] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06] group-focus-within:scale-[1.06] motion-reduce:transform-none sm:aspect-[3/2]"
                            loading="lazy"
                            onError={photoErrorHandler(relatedFlavor.image)}
                            sizes="(min-width: 1024px) 25vw, 50vw"
                            src={relatedFlavor.image}
                            srcSet={photoSrcSet(relatedFlavor.image)}
                          />
                        </div>
                        {relatedFlavor.tag && (
                          <span className="absolute left-3 top-3 inline-flex max-w-[calc(100%-1.5rem)] items-center gap-2 border-l-[3px] border-[#ffdc32] bg-[#092a53] px-2.5 py-1.5 text-xs font-bold leading-tight text-white transition-transform duration-500 ease-out group-hover:-rotate-3 group-hover:scale-105 group-focus-within:-rotate-3 group-focus-within:scale-105 motion-reduce:transform-none sm:left-4 sm:top-4">
                            {t(relatedFlavor.tag)}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col justify-between gap-3 p-3 sm:gap-3.5 sm:p-4">
                        <div>
                          <Link
                            className="line-clamp-2 min-h-[2.4em] font-display text-base font-extrabold leading-tight text-[#092a53] transition-colors duration-300 hover:text-[#163e6b] focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] sm:text-lg"
                            to={`/flavor/${relatedFlavor.id}`}
                          >
                            {t(relatedFlavor.name)}
                          </Link>
                          <p className="mt-1 line-clamp-1 text-xs font-medium leading-5 text-[#52647b] sm:text-sm">
                            {t(relatedFlavor.detail)}
                          </p>
                        </div>
                        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                          <span className="whitespace-nowrap font-display text-sm font-extrabold tabular-nums text-[#092a53]">
                            {formatCartMoney(relatedFlavor.price, "xaf", language)}
                          </span>
                          <button
                            aria-label={t("Add {name} to cart", { name: t(relatedFlavor.name) })}
                            className={`min-h-9 w-full whitespace-nowrap rounded-md px-3 text-xs font-bold transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2 motion-reduce:transform-none sm:w-auto sm:px-3.5 ${
                              added ? "bg-[#4caf50] text-white" : "bg-[#092a53] text-white hover:bg-[#163e6b]"
                            }`}
                            onClick={() => {
                              if (addToCart(relatedFlavor)) flashAdded(`related-${relatedFlavor.id}`);
                            }}
                            type="button"
                          >
                            {added ? t("Added") : t("Add to cart")}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
