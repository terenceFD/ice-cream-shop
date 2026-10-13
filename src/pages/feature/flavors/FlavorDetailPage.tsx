import { useParams, Link, Navigate, useNavigate } from "react-router-dom";
import { Header, Footer, ArrowIcon } from "../../../components/Layout";
import { useCart } from "../../../CartContext";
import { useFlavors, type Flavor } from "../../../flavor-context/FlavorContext";
import { useLanguage } from "../../../language/LanguageContext";
import { formatCartMoney } from "../../../cartPricing";

export function FlavorDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { flavors, loading, error } = useFlavors();
  const { t, language } = useLanguage();

  const flavor = flavors.find((item: Flavor) => item.id === Number(id));

  if (!flavor && loading) {
    return (
      <div className="flex min-h-screen flex-col bg-[#f8f7f2]">
        <Header />
        <main className="grid flex-1 place-items-center">
          <p className="text-sm font-semibold text-[#65748a]" role="status">
            {t("Loading flavor…")}
          </p>
        </main>
        <Footer />
      </div>
    );
  }

  if (!flavor) {
    return (
      <div className="min-h-screen bg-[#f8f7f2] flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-[#102c50] mb-4">
              {error ? t(error) : t("Flavor not found")}
            </h1>
            {error && (
              <p className="mb-4 text-sm text-red-700" role="alert">
                {error}
              </p>
            )}
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full bg-[#ffdc32] px-6 py-3 text-sm font-bold text-[#102c50] hover:bg-[#ffe76c]"
            >
              {t("Back to home")}
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (flavor.availableQuantity < 1) {
    return <Navigate to="/flavors" replace />;
  }

  const relatedFlavors = flavors
    .filter((item: Flavor) => item.id !== flavor.id && item.availableQuantity > 0)
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-[#fbfaf5] text-[#102c50]">
      <Header />

      <main>
        <section className="relative isolate overflow-hidden bg-gradient-to-b from-[#fffdf7] to-[#fbfaf5]">
          <div aria-hidden="true" className="absolute -right-40 top-12 -z-10 size-[30rem] rounded-full border-[65px] border-[#092a53]/[0.025]" />
          <div className="mx-auto max-w-[1440px] px-5 pb-14 pt-5 sm:px-8 sm:pb-20 sm:pt-8 lg:px-12">
            <button
              onClick={() => navigate(-1)}
              className="mb-6 inline-flex min-h-10 items-center gap-2 rounded-full border border-[#e7e3d9] bg-white px-4 text-sm font-bold text-[#52647b] shadow-sm transition hover:border-[#092a53] hover:text-[#092a53] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00]"
              type="button"
            >
              <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none">
                <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t("Back")}
            </button>

            <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-12 xl:gap-16">
              <div className="relative mx-auto w-full max-w-[680px] lg:sticky lg:top-24">
                <div aria-hidden="true" className="absolute -bottom-3 -right-3 h-[78%] w-[72%] rounded-[32px] bg-[#ffdc32] sm:-bottom-4 sm:-right-4 sm:rounded-[42px]" />
                <div className={`relative overflow-hidden rounded-[26px] border border-white/70 shadow-[0_24px_70px_rgba(16,44,80,0.14)] sm:rounded-[34px] ${flavor.color}`}>
                  <img
                    alt={t(flavor.name)}
                    className="aspect-[0.95] max-h-[760px] w-full object-cover sm:aspect-[1.02] lg:aspect-[0.94]"
                    src={flavor.image}
                  />
                  <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#092a53]/35 via-transparent to-[#092a53]/5" />
                  <span className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full border border-white/55 bg-white/90 px-4 py-2.5 text-xs font-extrabold text-[#092a53] shadow-lg backdrop-blur-sm sm:bottom-6 sm:left-6">
                    <svg aria-hidden="true" className="size-3.5 text-[#a48700]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z" />
                    </svg>
                    {t(flavor.tag)}
                  </span>
                  <span aria-hidden="true" className="absolute right-4 top-4 grid size-11 place-items-center rounded-2xl bg-[#ffdc32] text-[#092a53] shadow-lg sm:right-6 sm:top-6 sm:size-13">
                    <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z" />
                    </svg>
                  </span>
                </div>
                <div className="absolute -bottom-7 right-3 hidden items-center gap-3 rounded-2xl border border-[#e7e3d9] bg-white px-4 py-3 shadow-[0_14px_32px_rgba(16,44,80,0.14)] sm:flex lg:right-0">
                  <span aria-hidden="true" className="grid size-10 place-items-center rounded-xl bg-[#fff5c8] text-[#806a00]">
                    <svg className="size-5" viewBox="0 0 24 24" fill="none">
                      <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9 4.8 12 7l3-2.2M9 19.2 12 17l3 2.2M4.5 10.5l.3-3.7 3.5 1.1M19.5 13.5l-.3 3.7-3.5-1.1M8.3 16.1l-3.5 1.1-.3-3.7M15.7 7.9l3.5-1.1.3 3.7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-[9px] font-extrabold uppercase tracking-[0.13em] text-[#806a00]">{t("A treat made your way")}</p>
                    <p className="mt-0.5 text-xs font-bold text-[#102c50]">{t("Made for your moment")}</p>
                  </div>
                </div>
              </div>

              <div className="min-w-0 pt-1 sm:pt-3 lg:pt-8">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#eadb8a] bg-[#fff6cd] px-3.5 py-2 text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#806a00]">
                  <svg aria-hidden="true" className="size-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z" />
                  </svg>
                  {t(flavor.tag)}
                </div>
                <h1 className="mt-4 break-words font-display text-4xl font-extrabold leading-[1.04] tracking-tight text-[#092a53] sm:text-5xl lg:text-6xl">
                  {t(flavor.name)}
                </h1>
                <p className="mt-4 max-w-xl text-base font-semibold leading-7 text-[#65748a] sm:text-lg">
                  {t(flavor.detail)}
                </p>

                <div className="mt-8 rounded-[24px] border border-[#e7e3d9] bg-white p-5 shadow-[0_12px_36px_rgba(16,44,80,0.045)] sm:p-7">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#a48700]">{t("About this flavor")}</p>
                    <p className="mt-3 text-sm leading-7 text-[#52647b] sm:text-base sm:leading-8">{t(flavor.description)}</p>
                  </div>

                  <div className="mt-6 grid gap-3 border-t border-[#eeeae1] pt-5 sm:grid-cols-2">
                    <div className="rounded-2xl bg-[#f8f7f2] p-4">
                      <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#8792a0]">{t("Origin")}</p>
                      <p className="mt-1.5 font-display text-lg font-bold text-[#102c50]">{t(flavor.origin)}</p>
                    </div>
                    <div className="rounded-2xl bg-[#f8f7f2] p-4">
                      <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#8792a0]">{t("Servings")}</p>
                      <p className="mt-1.5 font-display text-lg font-bold text-[#102c50]">{flavor.servings}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#8792a0]">{t("Contains")}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(flavor.allergies || []).length ? (flavor.allergies || []).map((allergen) => (
                          <span key={allergen} className="inline-flex items-center gap-1.5 rounded-full border border-[#eadb8a] bg-[#fff9dc] px-3 py-1.5 text-xs font-semibold text-[#624f00]">
                            <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{t(allergen)}
                          </span>
                        )) : <span className="text-sm text-[#65748a]">{t("None listed")}</span>}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-[24px] bg-[#092a53] p-5 text-white shadow-[0_16px_38px_rgba(9,42,83,0.16)] sm:p-6">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/65">{t("Price per scoop")}</p>
                      <p className="mt-1 break-words font-display text-3xl font-extrabold leading-tight text-[#ffdc32] sm:text-4xl">
                        {formatCartMoney(flavor.price, "xaf", language)}
                      </p>
                    </div>
                    <span className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1.5 text-[10px] font-bold text-white/75">
                      <svg aria-hidden="true" className="size-3.5 text-[#ffdc32]" viewBox="0 0 24 24" fill="none">
                        <path d="m5 12 4 4L19 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
                      </svg>
                      {t("Online catalog")}
                    </span>
                  </div>
                  <p className="mt-3 border-t border-white/15 pt-3 text-[11px] leading-5 text-white/65">
                    {t("Items and prices in the online catalog are set in FCFA by this website's operator and are not verified Cold Stone Cameroon products, menu prices or promotions.")}
                  </p>
                  <div className="mt-5 grid grid-cols-1 gap-3 min-[440px]:grid-cols-2">
                    <button
                      onClick={() => addToCart(flavor)}
                      className="flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-full bg-[#ffdc32] px-5 py-3 text-sm font-extrabold text-[#092a53] shadow-md transition hover:-translate-y-0.5 hover:bg-[#ffe76c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#092a53] sm:text-base"
                      type="button"
                    >
                      <span>{t("Add to bag")}</span>
                      <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none">
                        <path d="M5 8h14l1 12H4L5 8Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                        <path d="M9 9V6a3 3 0 0 1 6 0v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                      </svg>
                    </button>
                    <Link
                      to="/cart"
                      className="flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-full border border-white/35 px-5 py-3 text-sm font-bold text-white transition hover:border-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32] sm:text-base"
                    >
                      <span>{t("View cart")}</span>
                      <ArrowIcon diagonal />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {relatedFlavors.length > 0 && (
          <section aria-labelledby="related-flavors-title" className="border-t border-[#e7e3d9] bg-white px-5 py-14 sm:px-8 sm:py-18 lg:px-12 lg:py-20">
            <div className="mx-auto max-w-[1320px]">
              <div className="mb-7 flex flex-wrap items-end justify-between gap-4 sm:mb-9">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#a48700]">{t("Explore more flavors")}</p>
                  <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-[#092a53] sm:text-4xl" id="related-flavors-title">
                    {t("You might also love")}
                  </h2>
                </div>
                <Link className="inline-flex items-center gap-2 rounded-full border border-[#d9d6cc] px-4 py-2.5 text-xs font-bold text-[#52647b] transition hover:border-[#092a53] hover:text-[#092a53]" to="/flavors">
                  {t("Browse all flavors")}<ArrowIcon />
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {relatedFlavors.map((relatedFlavor) => (
                  <article
                    key={relatedFlavor.id}
                    className="group overflow-hidden rounded-[24px] border border-[#e7e3d9] bg-[#fbfaf5] shadow-[0_8px_28px_rgba(16,44,80,0.05)] transition duration-300 hover:-translate-y-1 hover:border-[#d6c66b] hover:shadow-[0_18px_40px_rgba(16,44,80,0.12)]"
                  >
                    <Link className="relative block aspect-[1.25] overflow-hidden bg-[#f4f1e7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#bd9c00]" to={`/flavor/${relatedFlavor.id}`}>
                      <img
                        alt={t(relatedFlavor.name)}
                        className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.05]"
                        loading="lazy"
                        src={relatedFlavor.image}
                      />
                      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#092a53]/45 via-transparent to-transparent" />
                      <span className="absolute left-4 top-4 rounded-full border border-white/60 bg-white/90 px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#52647b] shadow-sm backdrop-blur-sm">
                        {t(relatedFlavor.tag)}
                      </span>
                      <span aria-hidden="true" className="absolute bottom-4 right-4 grid size-10 translate-y-1 place-items-center rounded-full bg-[#ffdc32] text-lg font-bold text-[#092a53] opacity-0 shadow-lg transition group-hover:translate-y-0 group-hover:opacity-100">
                        <svg className="size-4" viewBox="0 0 24 24" fill="none">
                          <path d="M7 17 17 7M8 7h9v9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                        </svg>
                      </span>
                    </Link>
                    <div className="p-4 sm:p-5">
                      <Link className="block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00]" to={`/flavor/${relatedFlavor.id}`}>
                        <h3 className="font-display text-xl font-extrabold leading-tight text-[#102c50] transition group-hover:text-[#806a00]">{t(relatedFlavor.name)}</h3>
                        <p className="mt-1.5 min-h-10 text-sm leading-5 text-[#65748a]">{t(relatedFlavor.detail)}</p>
                      </Link>
                      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#e7e3d9] pt-4">
                        <div className="min-w-0">
                          <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#8792a0]">{t("Price per scoop")}</p>
                          <p className="mt-1 truncate text-sm font-extrabold text-[#092a53]">{formatCartMoney(relatedFlavor.price, "xaf", language)}</p>
                        </div>
                        <button
                          aria-label={t("Add {name} to your bag", { name: t(relatedFlavor.name) })}
                          onClick={() => addToCart(relatedFlavor)}
                          className="grid size-10 shrink-0 place-items-center rounded-full bg-[#ffdc32] text-xl font-bold text-[#092a53] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#ffe76c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] focus-visible:ring-offset-2"
                          type="button"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
