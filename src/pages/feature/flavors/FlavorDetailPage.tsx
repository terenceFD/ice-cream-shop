import { useEffect, useRef, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { Header, Footer, ArrowIcon } from "../../../components/Layout";
import { useCart } from "../../../useCart";
import { type Flavor } from "../../../flavor-context/FlavorContext";
import { useFlavors } from "../../../flavor-context/useFlavors";
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
        <main className="mx-auto grid w-full max-w-[1320px] flex-1 gap-10 px-5 py-12 sm:px-8 lg:grid-cols-12 lg:px-12">
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
        <main className="grid flex-1 place-items-center px-5 py-20">
          <div className="flex max-w-md flex-col items-center text-center">
            <span aria-hidden="true" className="grid size-16 place-items-center rounded-full bg-white font-display text-2xl font-extrabold text-[#a48700] ring-1 ring-[#ebe7dc]">?</span>
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
  const infoTabs: { key: InfoTab; label: string }[] = [
    { key: "about", label: t("Description") },
    { key: "contains", label: t("Contains") },
    { key: "details", label: t("Details") },
  ];
  const relatedFlavors = [
    ...flavors.filter((item: Flavor) => item.id !== flavor.id && item.availableQuantity > 0 && item.tag === flavor.tag),
    ...flavors.filter((item: Flavor) => item.id !== flavor.id && item.availableQuantity > 0 && item.tag !== flavor.tag),
  ].slice(0, 4);

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

      <main>
        <section className="relative isolate overflow-hidden" style={{ backgroundColor: tint }}>
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -left-24 top-0 size-[38rem] rounded-full bg-white/60 blur-3xl" />
            <div className="absolute -bottom-40 right-0 size-[30rem] rounded-full bg-[#ffdc32]/25 blur-3xl" />
            <div className="absolute inset-0 bg-[radial-gradient(rgba(9,42,83,0.07)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_90%)]" />
            <p className="absolute inset-x-0 bottom-0 select-none overflow-hidden whitespace-nowrap text-center font-display text-[22vw] font-extrabold leading-[0.8] text-[#092a53]/[0.05] lg:text-[13rem]">
              {t(flavor.name)}
            </p>
          </div>

          <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-8 sm:px-8 sm:pb-20 sm:pt-10 lg:px-12 lg:pb-24">
            <nav aria-label={t("Breadcrumb")} className="mb-10 flex flex-wrap items-center gap-2 text-xs font-bold text-[#092a53]/60">
              <Link className="transition hover:text-[#092a53]" to="/">{t("Home")}</Link>
              <span aria-hidden="true" className="text-[#092a53]/30">/</span>
              <Link className="transition hover:text-[#092a53]" to="/flavors">{t("Online shop catalog")}</Link>
              {flavor.tag && (
                <>
                  <span aria-hidden="true" className="text-[#092a53]/30">/</span>
                  <Link className="transition hover:text-[#092a53]" to={`/flavors?tag=${encodeURIComponent(flavor.tag)}`}>{t(flavor.tag)}</Link>
                </>
              )}
              <span aria-hidden="true" className="text-[#092a53]/30">/</span>
              <span aria-current="page" className="max-w-[14rem] truncate text-[#092a53]">{t(flavor.name)}</span>
            </nav>

            <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-12">
              {/* Scoop photo */}
              <div className="relative mx-auto w-full max-w-[500px] lg:col-span-6">
                <div aria-hidden="true" className="absolute inset-[-6%] rounded-full border-2 border-dashed border-[#092a53]/15" />
                <figure className={`relative aspect-square overflow-hidden rounded-full shadow-[0_50px_90px_rgba(9,42,83,0.25)] ring-[12px] ring-white ${flavor.color}`}>
                  <img alt={t(flavor.name)} className="size-full object-cover" src={flavor.image} />
                </figure>

                <div aria-hidden="true" className="absolute -right-1 top-[4%] grid size-28 rotate-[10deg] place-items-center rounded-full bg-[#ffdc32] text-center text-[#092a53] shadow-[0_18px_36px_rgba(9,42,83,0.22)] ring-4 ring-white sm:right-0 sm:size-32">
                  <span>
                    <span className="block text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#806a00]">{t("Price per scoop")}</span>
                    <span className="mt-1 block font-display text-lg font-extrabold leading-tight tabular-nums sm:text-xl">
                      {formatCartMoney(flavor.price, "xaf", language)}
                    </span>
                  </span>
                </div>

                {flavor.tag && (
                  <span className="absolute bottom-[8%] left-0 inline-flex items-center gap-2 rounded-full bg-[#092a53] px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white shadow-[0_14px_30px_rgba(9,42,83,0.3)] sm:-left-2">
                    <span aria-hidden="true" className="text-[#ffdc32]">✦</span>
                    {t(flavor.tag)}
                  </span>
                )}
                {lowStock && (
                  <span className="absolute bottom-[2%] right-[8%] inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#806a00] shadow-lg">
                    <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-[#d4ad00] motion-reduce:animate-none" />
                    {t("{count} left", { count: flavor.availableQuantity })}
                  </span>
                )}
              </div>

              {/* Purchase card */}
              <div className="min-w-0 rounded-[32px] bg-white p-6 shadow-[0_30px_70px_rgba(9,42,83,0.14)] ring-1 ring-[#092a53]/5 sm:p-9 lg:col-span-6">
                {flavor.tag && (
                  <p className="inline-flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#a48700]">
                    <span aria-hidden="true" className="h-px w-10 bg-[#a48700]" />
                    {t(flavor.tag)}
                  </p>
                )}
                <h1 className="mt-4 break-words font-display text-4xl font-extrabold leading-[1.02] tracking-tight text-[#092a53] sm:text-5xl lg:text-6xl">
                  {t(flavor.name)}
                </h1>
                <p className="mt-4 text-lg font-semibold leading-8 text-[#52647b]">{t(flavor.detail)}</p>

                <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-y border-[#efebe1] py-5">
                  <p className="font-display text-4xl font-extrabold tabular-nums text-[#092a53]">
                    {formatCartMoney(flavor.price, "xaf", language)}
                    <span className="ml-2 font-sans text-sm font-bold text-[#8792a0] max-sm:hidden">/ {t("Price per scoop").toLocaleLowerCase()}</span>
                  </p>
                  <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-extrabold ${lowStock ? "bg-[#fff6dc] text-[#806a00]" : "bg-[#f3f8ef] text-[#37632c]"}`}>
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
                        ? "bg-[#4caf50] text-white shadow-[0_12px_28px_rgba(76,175,80,0.3)]"
                        : "bg-[#092a53] text-white shadow-[0_12px_28px_rgba(9,42,83,0.22)] hover:-translate-y-0.5 hover:bg-[#163e6b]"
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
                            selected ? "bg-white text-[#092a53] shadow-[0_6px_16px_rgba(9,42,83,0.1)]" : "text-[#65748a] hover:text-[#092a53]"
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
                        <div className="rounded-2xl bg-[#fbfaf5] p-4 ring-1 ring-[#ece8dc]">
                          <dt className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#8792a0]">{t("Origin")}</dt>
                          <dd className="mt-1 font-display text-lg font-extrabold text-[#092a53]">{t(flavor.origin)}</dd>
                        </div>
                        <div className="rounded-2xl bg-[#fbfaf5] p-4 ring-1 ring-[#ece8dc]">
                          <dt className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#8792a0]">{t("Servings")}</dt>
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
          <div className="relative isolate flex flex-col gap-6 overflow-hidden rounded-[28px] bg-[#ffdc32] p-6 text-[#092a53] sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div aria-hidden="true" className="absolute -right-16 -top-20 -z-10 size-64 rounded-full border-[40px] border-white/30" />
            <div className="flex items-center gap-5">
              <span aria-hidden="true" className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#092a53] font-display text-lg font-extrabold text-[#ffdc32]">3×</span>
              <div>
                <p className="font-display text-2xl font-extrabold">{t("More scoops, more smiles")}</p>
                <p className="mt-1 text-sm font-semibold text-[#092a53]/70">{t("Pick any three scoops and the lowest-priced one is on us.")}</p>
              </div>
            </div>
            <Link className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full bg-[#092a53] px-6 py-3.5 text-sm font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-[#163e6b]" to="/flavors">
              {t("Browse all flavors")} <ArrowIcon />
            </Link>
          </div>
          <p className="mt-4 flex gap-3 text-xs leading-5 text-[#8792a0]">
            <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center rounded-full bg-[#ffdc32]/40 text-[10px] font-extrabold text-[#806a00]">i</span>
            {t("Items and prices in the online catalog are set in FCFA by this website's operator and are not verified Cold Stone Cameroon products, menu prices or promotions.")}
          </p>
        </section>

        {relatedFlavors.length > 0 && (
          <section aria-labelledby="related-flavors-title" className="py-16 sm:py-20">
            <div className="mx-auto max-w-[1320px] px-5 sm:px-8 lg:px-12">
              <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="inline-flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#a48700]">
                    <span aria-hidden="true" className="h-px w-10 bg-[#a48700]" />
                    {t("Explore more flavors")}
                  </p>
                  <h2 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-[#092a53] sm:text-5xl" id="related-flavors-title">
                    {t("You might also love")}
                  </h2>
                </div>
                <Link className="inline-flex items-center gap-2 rounded-full border border-[#d9d4c7] bg-white px-5 py-3 text-sm font-extrabold text-[#092a53] transition hover:-translate-y-0.5 hover:border-[#092a53]" to="/flavors">
                  {t("Browse all flavors")} <ArrowIcon />
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
                {relatedFlavors.map((relatedFlavor) => {
                  const added = addedKey === `related-${relatedFlavor.id}`;
                  return (
                    <article
                      className="group relative flex flex-col rounded-[22px] bg-white p-1.5 sm:rounded-[28px] sm:p-2.5 shadow-[0_1px_0_rgba(9,42,83,0.04),0_8px_24px_rgba(9,42,83,0.06)] ring-1 ring-[#ebe7dc] transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_56px_rgba(9,42,83,0.14)] hover:ring-[#e2d39a]"
                      key={relatedFlavor.id}
                    >
                      <div className={`relative aspect-square overflow-hidden rounded-[17px] sm:rounded-[22px] ${relatedFlavor.color}`}>
                        <img alt="" className="size-full object-cover transition duration-700 ease-out group-hover:scale-[1.05]" loading="lazy" src={relatedFlavor.image} />
                        {relatedFlavor.tag && (
                          <span className="absolute left-2 top-2 max-w-[calc(100%-1rem)] truncate rounded-full bg-white/95 px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#52647b] shadow-sm backdrop-blur-sm sm:left-3 sm:top-3 sm:px-3 sm:py-1.5 sm:text-[10px]">
                            {t(relatedFlavor.tag)}
                          </span>
                        )}
                      </div>
                      <div className="@container flex flex-1 flex-col px-1.5 pb-1.5 pt-3 sm:px-4 sm:pb-3 sm:pt-5">
                        <h3 className="line-clamp-2 font-display text-[15px] font-extrabold leading-snug text-[#092a53] sm:text-xl">
                          <Link className="after:absolute after:inset-0 after:rounded-[28px] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-[#bd9c00]" to={`/flavor/${relatedFlavor.id}`}>
                            {t(relatedFlavor.name)}
                          </Link>
                        </h3>
                        <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-[#65748a] sm:mt-2 sm:text-sm sm:leading-6">{t(relatedFlavor.detail)}</p>
                        <div className="mt-auto flex flex-col gap-2.5 border-t border-dashed border-[#e7e2d4] pt-3 sm:gap-3 sm:pt-4 @[16.5rem]:flex-row @[16.5rem]:items-center @[16.5rem]:justify-between">
                          <span className="whitespace-nowrap font-display text-sm font-extrabold tabular-nums text-[#092a53] sm:text-lg">
                            {formatCartMoney(relatedFlavor.price, "xaf", language)}
                          </span>
                          <button
                            aria-label={t("Add {name} to your bag", { name: t(relatedFlavor.name) })}
                            className={`relative z-10 inline-flex w-full shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 py-2.5 text-xs font-extrabold transition sm:py-3 @[16.5rem]:w-auto @[16.5rem]:py-2.5 duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2 ${
                              added ? "bg-[#4caf50] text-white" : "bg-[#ffdc32] text-[#092a53] hover:-translate-y-0.5 hover:bg-[#092a53] hover:text-white"
                            }`}
                            onClick={() => {
                              if (addToCart(relatedFlavor)) flashAdded(`related-${relatedFlavor.id}`);
                            }}
                            type="button"
                          >
                            {added ? <CheckIcon /> : <BagIcon />}
                            <span aria-live="polite">{added ? t("Added") : t("Add to bag")}</span>
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
