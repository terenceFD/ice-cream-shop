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
    <div className="min-h-screen bg-[#f8f7f2] text-[#102c50]">
      <Header />

      <main>
        <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-8 lg:px-12">
          <button
            onClick={() => navigate(-1)}
            className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[#65748a] transition hover:text-[#102c50]"
          >
            <svg className="size-4" viewBox="0 0 24 24" fill="none">
              <path
                d="M15 19l-7-7 7-7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {t("Back")}
          </button>
        </div>

        <section className="mx-auto max-w-[1320px] px-5 pb-20 sm:px-8 lg:px-12">
          <div className="grid items-start gap-12 lg:grid-cols-[0.9fr_1.1fr]">
            <div
              className={`sticky top-24 overflow-hidden rounded-[28px] ${flavor.color}`}
            >
              <img
                alt={t(flavor.name)}
                className="aspect-square h-full w-full object-cover"
                src={flavor.image}
              />
            </div>

            <div>
              <div className="mb-4 inline-block rounded-full bg-[#ffeb9c] px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-[0.12em] text-[#102c50]">
                {t(flavor.tag)}
              </div>

              <h1 className="font-display text-5xl font-bold leading-tight tracking-tight text-[#102c50] sm:text-6xl">
                {t(flavor.name)}
              </h1>

              <p className="mt-4 text-base font-semibold text-[#65748a]">
                {t(flavor.detail)}
              </p>

              <div className="mt-8 space-y-6">
                <div>
                  <h2 className="font-display text-2xl font-bold text-[#102c50]">
                    {t("About this flavor")}
                  </h2>
                  <p className="mt-3 text-base leading-7 text-[#65748a]">
                    {t(flavor.description)}
                  </p>
                </div>

                <div className="grid gap-8 sm:grid-cols-2">
                  <div>
                    <h3 className="font-display text-sm font-bold uppercase tracking-[0.08em] text-[#65748a]">
                      {t("Origin")}
                    </h3>
                    <p className="mt-1 text-lg font-semibold text-[#102c50]">
                      {t(flavor.origin)}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-bold uppercase tracking-[0.08em] text-[#65748a]">
                      {t("Servings")}
                    </h3>
                    <p className="mt-1 text-lg font-semibold text-[#102c50]">
                      {flavor.servings}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <h3 className="font-display text-sm font-bold uppercase tracking-[0.08em] text-[#65748a]">
                      {t("Contains")}
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(flavor.allergies || []).map((allergen) => (
                        <span
                          key={allergen}
                          className="inline-block rounded-full bg-[#fff1cf] px-3 py-1.5 text-sm font-medium text-[#65748a]"
                        >
                          {t(allergen)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-[#65748a]">
                    {t("Price per scoop")}
                  </p>
                  <p className="font-display text-5xl font-bold text-[#ffdc32]">
                    {formatCartMoney(flavor.price, "xaf", language)}
                  </p>
                  <p className="mt-1 max-w-sm text-xs leading-5 text-[#65748a]">
                    {t("Items and prices in the online catalog are set in FCFA by this website's operator and are not verified Cold Stone Cameroon products, menu prices or promotions.")}
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    onClick={() => addToCart(flavor)}
                    className="flex items-center justify-center gap-2 rounded-full bg-[#ffdc32] px-8 py-4 text-lg font-bold text-[#102c50] shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-[#ffe76c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#102c50]"
                  >
                    <span>{t("Add to bag")}</span>
                    <svg className="size-5" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M5 8h14l1 12H4L5 8Z"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M9 9V6a3 3 0 0 1 6 0v3"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                  <Link
                    to="/cart"
                    className="flex items-center justify-center gap-2 rounded-full border-2 border-[#65748a] px-8 py-4 text-lg font-bold text-[#102c50] transition hover:bg-[#f4f1e7]"
                  >
                    <span>{t("View cart")}</span>
                    <ArrowIcon diagonal />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {relatedFlavors.length > 0 && (
          <section className="border-t border-[#d9d6cc] px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
            <div className="mx-auto max-w-[1320px]">
              <h2 className="font-display text-3xl font-bold text-[#102c50] sm:text-4xl">
                {t("You might also love")}
              </h2>
              <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {relatedFlavors.map((relatedFlavor) => (
                  <Link
                    key={relatedFlavor.id}
                    to={`/flavor/${relatedFlavor.id}`}
                    className="group overflow-hidden rounded-[22px] border border-[#d9d6cc] bg-white shadow-[0_8px_30px_rgba(18,44,80,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_14px_38px_rgba(18,44,80,0.12)]"
                  >
                    <div
                      className={`relative aspect-[0.9] overflow-hidden ${relatedFlavor.color}`}
                    >
                      <img
                        alt={t(relatedFlavor.name)}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        src={relatedFlavor.image}
                      />
                      <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[9px] font-bold text-[#65748a] shadow-sm">
                        {t(relatedFlavor.tag)}
                      </span>
                    </div>
                    <div className="p-4">
                      <h3 className="font-display text-lg font-bold text-[#102c50]">
                        {t(relatedFlavor.name)}
                      </h3>
                      <p className="mt-1 text-xs text-[#7b8796]">
                        {t(relatedFlavor.detail)}
                      </p>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-sm font-extrabold text-[#102c50]">
                          {formatCartMoney(relatedFlavor.price, "xaf", language)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            addToCart(relatedFlavor);
                          }}
                          className="grid size-9 place-items-center rounded-full bg-[#ffdc32] text-lg font-bold text-[#102c50] transition hover:rotate-90 hover:bg-[#ffe76c]"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </Link>
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
