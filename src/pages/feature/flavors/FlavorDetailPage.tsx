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

export function FlavorDetailPage() {
  const { id } = useParams();
  const { addToCart, addItemsToCart } = useCart();
  const { flavors, loading, error } = useFlavors();
  const { t, language } = useLanguage();
  const [quantity, setQuantity] = useState(1);
  const [addedKey, setAddedKey] = useState<string | null>(null);
  const [cartNotice, setCartNotice] = useState("");
  const addedTimer = useRef<number | undefined>(undefined);

  const flavor = flavors.find((item: Flavor) => item.id === Number(id));

  useEffect(() => {
    setQuantity(1);
    setCartNotice("");
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
        <section className="relative isolate overflow-hidden">
          <div aria-hidden="true" className="pointer-events-none absolute -right-48 -top-48 -z-10 size-[36rem] rounded-full bg-[#ffdc32]/15 blur-3xl" />
          <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-8 sm:px-8 sm:pb-20 sm:pt-10 lg:px-12">
            <nav aria-label={t("Breadcrumb")} className="mb-8 flex flex-wrap items-center gap-2 text-xs font-bold text-[#7b8796]">
              <Link className="transition hover:text-[#092a53]" to="/">{t("Home")}</Link>
              <span aria-hidden="true" className="text-[#c9c3b4]">/</span>
              <Link className="transition hover:text-[#092a53]" to="/flavors">{t("Online shop catalog")}</Link>
              {flavor.tag && (
                <>
                  <span aria-hidden="true" className="text-[#c9c3b4]">/</span>
                  <Link className="transition hover:text-[#092a53]" to={`/flavors?tag=${encodeURIComponent(flavor.tag)}`}>{t(flavor.tag)}</Link>
                </>
              )}
              <span aria-hidden="true" className="text-[#c9c3b4]">/</span>
              <span aria-current="page" className="max-w-[14rem] truncate text-[#092a53]">{t(flavor.name)}</span>
            </nav>

            <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
              {/* Image */}
              <div className="lg:col-span-7">
                <div className="lg:sticky lg:top-[calc(var(--site-header-offset,0px)+2rem)] lg:transition-[top] lg:duration-300">
                  <div className={`relative overflow-hidden rounded-[32px] shadow-[0_30px_70px_rgba(9,42,83,0.16)] ${flavor.color}`}>
                    <img
                      alt={t(flavor.name)}
                      className="aspect-square w-full object-cover"
                      src={flavor.image}
                    />
                    <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#061d3a]/25 via-transparent to-transparent" />
                    {lowStock && (
                      <span className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full bg-[#092a53]/85 px-3.5 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#ffdc32] backdrop-blur-sm sm:left-6 sm:top-6">
                        <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-[#ffdc32]" />
                        {t("{count} left", { count: flavor.availableQuantity })}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="flex min-w-0 flex-col lg:col-span-5 lg:py-4">
                {flavor.tag && (
                  <p className="inline-flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#a48700]">
                    <span aria-hidden="true" className="h-px w-10 bg-[#a48700]" />
                    {t(flavor.tag)}
                  </p>
                )}
                <h1 className="mt-5 break-words font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-[#092a53] sm:text-5xl lg:text-6xl">
                  {t(flavor.name)}
                </h1>
                <p className="mt-5 text-lg font-semibold leading-8 text-[#52647b]">
                  {t(flavor.detail)}
                </p>

                <div className="mt-8 flex items-end justify-between gap-4 border-y border-[#ebe7dc] py-6">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#8792a0]">{t("Price per scoop")}</p>
                    <p className="mt-1 font-display text-4xl font-extrabold tabular-nums text-[#092a53]">
                      {formatCartMoney(flavor.price, "xaf", language)}
                    </p>
                  </div>
                  <span className={`mb-1 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-extrabold ${lowStock ? "bg-[#fff6dc] text-[#806a00]" : "bg-[#f3f8ef] text-[#37632c]"}`}>
                    <span aria-hidden="true" className={`size-1.5 rounded-full ${lowStock ? "bg-[#d4ad00]" : "bg-[#4caf50]"}`} />
                    {lowStock ? t("{count} left", { count: flavor.availableQuantity }) : t("In stock")}
                  </span>
                </div>

                {/* Quantity + add */}
                <div className="mt-6 flex gap-3">
                  <div aria-label={t("Quantity")} className="flex shrink-0 items-center rounded-full bg-white p-1 ring-1 ring-[#e5e1d7]" role="group">
                    <button
                      aria-label={t("Decrease quantity")}
                      className="grid size-11 place-items-center rounded-full text-lg font-bold text-[#092a53] transition hover:bg-[#fbfaf5] disabled:cursor-not-allowed disabled:text-[#c9c3b4] disabled:hover:bg-transparent"
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
                      className="grid size-11 place-items-center rounded-full text-lg font-bold text-[#092a53] transition hover:bg-[#fbfaf5] disabled:cursor-not-allowed disabled:text-[#c9c3b4] disabled:hover:bg-transparent"
                      disabled={quantity >= maxQuantity}
                      onClick={() => setQuantity((current) => Math.min(maxQuantity, current + 1))}
                      type="button"
                    >
                      +
                    </button>
                  </div>
                  <button
                    className={`inline-flex flex-1 items-center justify-center gap-2 rounded-full px-6 py-4 text-sm font-extrabold transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2 ${
                      mainAdded
                        ? "bg-[#4caf50] text-white shadow-[0_12px_28px_rgba(76,175,80,0.3)]"
                        : "bg-[#092a53] text-white shadow-[0_12px_28px_rgba(9,42,83,0.22)] hover:-translate-y-0.5 hover:bg-[#163e6b]"
                    }`}
                    onClick={addSelected}
                    type="button"
                  >
                    {mainAdded ? <CheckIcon /> : <BagIcon />}
                    <span aria-live="polite">
                      {mainAdded ? t("Added") : `${t("Add to bag")} · ${formatCartMoney(flavor.price * quantity, "xaf", language)}`}
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

                {/* Facts */}
                <dl className="mt-10 grid grid-cols-2 divide-x divide-[#ebe7dc] rounded-2xl bg-white ring-1 ring-[#ebe7dc]">
                  <div className="p-5">
                    <dt className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#8792a0]">{t("Origin")}</dt>
                    <dd className="mt-1.5 font-display text-lg font-extrabold text-[#092a53]">{t(flavor.origin)}</dd>
                  </div>
                  <div className="p-5">
                    <dt className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#8792a0]">{t("Servings")}</dt>
                    <dd className="mt-1.5 font-display text-lg font-extrabold tabular-nums text-[#092a53]">{flavor.servings}</dd>
                  </div>
                </dl>

                {/* About */}
                <div className="mt-10">
                  <h2 className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#a48700]">{t("About this flavor")}</h2>
                  <p className="mt-3 text-base leading-8 text-[#52647b]">{t(flavor.description)}</p>
                </div>

                <div className="mt-8">
                  <h2 className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#a48700]">{t("Contains")}</h2>
                  <ul className="mt-3 flex flex-wrap gap-2">
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
                </div>

                <div className="mt-10 flex gap-4 rounded-2xl bg-[#092a53] p-5 text-white">
                  <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#ffdc32] font-display text-sm font-extrabold text-[#092a53]">3×</span>
                  <div>
                    <p className="font-display text-base font-extrabold">{t("More scoops, more smiles")}</p>
                    <p className="mt-1 text-xs leading-5 text-white/70">{t("Pick any three scoops and the lowest-priced one is on us.")}</p>
                  </div>
                </div>

                <p className="mt-6 flex gap-3 text-xs leading-5 text-[#8792a0]">
                  <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center rounded-full bg-[#ffdc32]/40 text-[10px] font-extrabold text-[#806a00]">i</span>
                  {t("Items and prices in the online catalog are set in FCFA by this website's operator and are not verified Cold Stone Cameroon products, menu prices or promotions.")}
                </p>
              </div>
            </div>
          </div>
        </section>

        {relatedFlavors.length > 0 && (
          <section aria-labelledby="related-flavors-title" className="border-t border-[#ebe7dc] px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
            <div className="mx-auto max-w-[1320px]">
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
              <div className="grid grid-cols-1 gap-5 min-[480px]:grid-cols-2 lg:grid-cols-4">
                {relatedFlavors.map((relatedFlavor) => {
                  const added = addedKey === `related-${relatedFlavor.id}`;
                  return (
                    <article
                      className="group relative flex flex-col rounded-[28px] bg-white p-2.5 shadow-[0_1px_0_rgba(9,42,83,0.04),0_8px_24px_rgba(9,42,83,0.06)] ring-1 ring-[#ebe7dc] transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_56px_rgba(9,42,83,0.14)] hover:ring-[#e2d39a]"
                      key={relatedFlavor.id}
                    >
                      <div className={`relative aspect-square overflow-hidden rounded-[22px] ${relatedFlavor.color}`}>
                        <img alt="" className="size-full object-cover transition duration-700 ease-out group-hover:scale-[1.05]" loading="lazy" src={relatedFlavor.image} />
                        {relatedFlavor.tag && (
                          <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#52647b] shadow-sm backdrop-blur-sm">
                            {t(relatedFlavor.tag)}
                          </span>
                        )}
                      </div>
                      <div className="@container flex flex-1 flex-col px-3 pb-3 pt-5 sm:px-4">
                        <h3 className="font-display text-xl font-extrabold leading-snug text-[#092a53]">
                          <Link className="after:absolute after:inset-0 after:rounded-[28px] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-[#bd9c00]" to={`/flavor/${relatedFlavor.id}`}>
                            {t(relatedFlavor.name)}
                          </Link>
                        </h3>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#65748a]">{t(relatedFlavor.detail)}</p>
                        <div className="mt-auto flex flex-col gap-3 border-t border-dashed border-[#e7e2d4] pt-4 @[16.5rem]:flex-row @[16.5rem]:items-center @[16.5rem]:justify-between">
                          <span className="whitespace-nowrap font-display text-lg font-extrabold tabular-nums text-[#092a53]">
                            {formatCartMoney(relatedFlavor.price, "xaf", language)}
                          </span>
                          <button
                            aria-label={t("Add {name} to your bag", { name: t(relatedFlavor.name) })}
                            className={`relative z-10 inline-flex w-full shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 py-3 text-xs font-extrabold transition @[16.5rem]:w-auto @[16.5rem]:py-2.5 duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2 ${
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
