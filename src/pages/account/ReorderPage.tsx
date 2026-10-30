import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Footer, Header } from "../../components/Layout";
import { useCart } from "../../context/useCart";
import { useLanguage } from "../../language/useLanguage";
import { apiRequest } from "../../api/api";
import { loadCatalog, savedItemsToProducts } from "../../lib/savedForLater";

type ReorderResponse = {
  orderId: number;
  customerName?: string;
  items: { productId: string; quantity: number; name?: string }[];
};

/**
 * The page behind "Order the same again" in an order email.
 *
 * It puts the order's items back in the bag and opens checkout. Anything sold out or no
 * longer on the menu is skipped and named, so the customer knows what did not come back.
 */
export function ReorderPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addItemsToCart } = useCart();
  const { t } = useLanguage();
  const token = searchParams.get("token") || "";
  const [state, setState] = useState<"loading" | "done" | "partial" | "error">("loading");
  const [message, setMessage] = useState("");
  const [missing, setMissing] = useState<string[]>([]);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (!token) {
      setState("error");
      setMessage(t("This reorder link is incomplete. Open the order from your account instead."));
      return;
    }

    (async () => {
      try {
        const [order, products] = await Promise.all([
          apiRequest<ReorderResponse>(`/orders/reorder?token=${encodeURIComponent(token)}`),
          loadCatalog(),
        ]);
        const wanted = order.items;
        const available = savedItemsToProducts(wanted, products);
        const availableIds = new Set(available.map((item) => String((item as { id?: unknown }).id)));
        const skipped = wanted
          .filter((item) => !availableIds.has(item.productId))
          .map((item) => item.name || t("An item"))
          .slice(0, 6);

        const added = available.length ? addItemsToCart(available) : 0;
        if (added < 1) {
          setState("error");
          setMessage(t("None of the items in that order are available right now."));
          return;
        }

        setMissing(skipped);
        if (skipped.length) {
          // Stay here and say what did not come back, rather than quietly giving a smaller bag.
          setState("partial");
          setMessage(
            t("We put the rest in your bag. These were sold out or no longer on the menu:"),
          );
          return;
        }
        // Everything came back: straight to checkout, since the bag is already right.
        setState("done");
        navigate("/checkout", { replace: true });
      } catch (error) {
        setState("error");
        setMessage(error instanceof Error ? error.message : t("This reorder link could not be opened."));
      }
    })();
  }, [addItemsToCart, navigate, t, token]);

  return (
    <div className="min-h-screen bg-[#fbfaf5] text-brand-navy">
      <Header />
      <main className="mx-auto max-w-xl px-5 py-20" id="main" tabIndex={-1}>
        {state === "loading" ? (
          <div className="text-center" role="status">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-white ring-1 ring-[#e3dfd3]">
              <svg aria-hidden="true" className="size-6 animate-spin text-brand-navy motion-reduce:animate-none" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" fill="none" r="9" stroke="currentColor" strokeDasharray="20 44" strokeLinecap="round" strokeWidth="2.5" />
              </svg>
            </span>
            <p className="mt-5 font-display text-2xl font-extrabold">{t("Putting your order back in the bag…")}</p>
          </div>
        ) : (
          <div className="rounded-[28px] bg-white p-7 text-center ring-1 ring-[#e3dfd3] sm:p-10" role="alert">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#8b95a2]">{t("Reorder")}</p>
            <h1 className="mt-2 font-display text-2xl font-extrabold sm:text-3xl">
              {state === "partial" ? t("Some items were unavailable") : t("We could not rebuild that order")}
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#65748a]">{message}</p>
            {missing.length > 0 && (
              <ul className="mx-auto mt-4 max-w-sm space-y-1 text-left text-sm text-[#65748a]">
                {missing.map((name) => (
                  <li key={name}>· {name}</li>
                ))}
              </ul>
            )}
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand-yellow px-6 text-sm font-extrabold text-brand-navy" to="/menu">
                {t("Browse the menu")}
              </Link>
              <Link className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand-navy px-6 text-sm font-extrabold text-white" to="/cart">
                {state === "partial" ? t("Go to your bag") : t("Contact support")}
              </Link>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
