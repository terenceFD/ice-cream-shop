import { useEffect, useMemo, useState } from "react";
import { getCustomerToken } from "../../api/api";
import { Link, useParams } from "react-router-dom";
import { Footer, Header } from "../../components/Layout";
import { useCart } from "../../context/useCart";
import type { CartItem } from "../../context/CartContext";
import { formatCartMoney } from "../../lib/cartPricing";
import { useLanguage } from "../../language/useLanguage";
import { useCurrency } from "../../context/useCurrency";
import { useAuth } from "../../context/useAuth";
import { apiRequest } from "../../api/api";
import { coldStoneMenuCategories, getMenuItemId } from "../../../shared/data";
import { photoSrcSet } from "../../lib/thumbnails";

type SharedWishlist = {
  ownerName: string;
  items: { itemKey: string }[];
};

type MenuItemLike = {
  id: string;
  name: string;
  image: string;
  priceXaf: number;
  categoryTitle: string;
  availableQuantity?: number;
};

/**
 * The wishlist page has two modes:
 *  - signed in: the customer's own list, editable, with a share link to send to friends
 *  - a shared slug: a read-only view anyone with the link can browse
 */
export function WishlistPage() {
  const params = useParams();
  const sharedSlug = typeof params.slug === "string" ? params.slug : "";
  const { customer } = useAuth();
  const { addToCart } = useCart();
  const { t, language } = useLanguage();
  const { currency: displayCurrency } = useCurrency();

  const [items, setItems] = useState<{ itemKey: string; addedAt?: string }[]>(
    [],
  );
  const [shared, setShared] = useState<SharedWishlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const [shareSlug, setShareSlug] = useState("");

  const signedIn = Boolean(customer);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    if (sharedSlug) {
      apiRequest(`/wishlist/shared/${encodeURIComponent(sharedSlug)}`)
        .then((data) => {
          if (!cancelled) setShared(data);
        })
        .catch((wishlistError) => {
          if (!cancelled) setError(wishlistError.message);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }
    if (!signedIn) {
      if (!cancelled) setLoading(false);
      return () => {
        cancelled = true;
      };
    }
    apiRequest("/wishlist", { token: getCustomerToken() || undefined })
      .then((data) => {
        if (!cancelled) {
          setItems(data.items || []);
          setShareSlug(data.shareSlug || "");
        }
      })
      .catch((wishlistError) => {
        if (!cancelled) setError(wishlistError.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sharedSlug, signedIn]);

  const itemByKey = useMemo(() => {
    const map = new Map<string, MenuItemLike>();
    for (const category of coldStoneMenuCategories) {
      for (const item of category.items) {
        map.set(getMenuItemId(category.title, item.name), {
          ...item,
          id: getMenuItemId(category.title, item.name),
          categoryTitle: category.title,
        });
      }
    }
    return map;
  }, []);

  const resolvedItems = useMemo(
    () =>
      items
        .map((entry) => ({ ...entry, resolved: itemByKey.get(entry.itemKey) }))
        .filter((entry) => entry.resolved),
    [items, itemByKey],
  );

  const resolvedShared = useMemo(
    () =>
      (shared?.items || [])
        .map((entry) => itemByKey.get(entry.itemKey))
        .filter((item) => Boolean(item)),
    [shared, itemByKey],
  );

  const addItemToBag = (item: MenuItemLike) => {
    addToCart({
      id: item.id,
      name: item.name,
      image: item.image,
      priceXaf: item.priceXaf,
      itemType: "menu",
      categoryTitle: item.categoryTitle,
      quantity: 1,
    } as unknown as CartItem);
  };

  const removeItem = async (itemKey: string) => {
    setRemoving(itemKey);
    try {
      const data = await apiRequest(
        `/wishlist/items/${encodeURIComponent(itemKey)}`,
        { method: "DELETE", token: getCustomerToken() || undefined },
      );
      setItems(data.items || []);
    } catch (removeError) {
      setError(removeError.message);
    } finally {
      setRemoving(null);
    }
  };

  const money = (amount: number) =>
    formatCartMoney(amount, "xaf", language, displayCurrency);

  return (
    <div className="min-h-screen bg-[#fbfaf5] text-brand-navy">
      <Header />
      <main id="main" className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
          {sharedSlug ? t("A shared wishlist") : t("Your wishlist")}
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[#65748a]">
          {sharedSlug
            ? t(
                "Browse {name}'s saved treats and add any of them to your own bag.",
                { name: shared?.ownerName || "" },
              )
            : t(
                "Save treats you love, then share the list with family or friends. They can order straight from it.",
              )}
        </p>

        {loading && (
          <p className="mt-10 text-sm text-[#65748a]">{t("Loading…")}</p>
        )}
        {!loading && error && (
          <p className="mt-10 rounded-2xl bg-[#fdf2f0] p-4 text-sm font-semibold text-[#a4402f]">
            {error}
          </p>
        )}

        {!loading && !error && sharedSlug && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {resolvedShared.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl bg-white p-4 ring-1 ring-[#e5e9ee]"
              >
                <img
                  alt=""
                  className="aspect-[4/3] w-full rounded-xl object-cover"
                  src={item.image}
                />
                <h2 className="mt-3 font-display text-lg font-extrabold">
                  {item.name}
                </h2>
                <p className="mt-1 text-sm font-extrabold text-brand-navy">
                  {money(item.priceXaf)}
                </p>
                <button
                  className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-brand-navy px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-blue"
                  onClick={() => addItemToBag(item)}
                  type="button"
                >
                  {t("Add to bag")}
                </button>
              </article>
            ))}
            {resolvedShared.length === 0 && (
              <p className="text-sm text-[#65748a]">
                {t("Nothing saved here yet.")}
              </p>
            )}
          </div>
        )}

        {!loading && !error && !sharedSlug && !signedIn && (
          <div className="mt-8 rounded-2xl bg-white p-6 ring-1 ring-[#e5e9ee]">
            <p className="text-sm leading-6 text-[#65748a]">
              {t("Sign in to keep a wishlist that follows you across devices.")}
            </p>
            <Link
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-navy px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-blue"
              to="/login"
            >
              {t("Sign in")}
            </Link>
          </div>
        )}

        {!loading && !error && !sharedSlug && signedIn && (
          <>
            {shareSlug && (
              <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-[#e5e9ee]">
                <p className="text-xs font-bold text-[#65748a]">
                  {t("Share this list")}
                </p>
                <code className="max-w-full truncate rounded-lg bg-[#f4f6f8] px-3 py-2 text-xs text-brand-navy">
                  {`${window.location.origin}/wishlist/shared/${shareSlug}`}
                </code>
                <button
                  className="inline-flex min-h-9 items-center rounded-lg border border-[#d5dce5] px-3 py-2 text-xs font-bold text-[#65748a] transition-colors hover:border-brand-navy hover:text-brand-navy"
                  onClick={() => {
                    navigator.clipboard
                      ?.writeText(
                        `${window.location.origin}/wishlist/shared/${shareSlug}`,
                      )
                      .catch(() => {
                        /* clipboard may be blocked; the code is visible anyway */
                      });
                  }}
                  type="button"
                >
                  {t("Copy link")}
                </button>
              </div>
            )}
            {resolvedItems.length > 0 && (
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {resolvedItems.map((entry) => {
                  const item = entry.resolved!;
                  return (
                    <article
                      key={entry.itemKey}
                      className="rounded-2xl bg-white p-4 ring-1 ring-[#e5e9ee]"
                    >
                      <img
                        alt=""
                        className="aspect-[4/3] w-full rounded-xl object-cover"
                        loading="lazy"
                        onError={(event) => {
                          (
                            event.currentTarget as HTMLImageElement
                          ).style.opacity = "0.4";
                        }}
                        src={item.image}
                        srcSet={photoSrcSet(item.image)}
                      />
                      <h2 className="mt-3 font-display text-lg font-extrabold">
                        {item.name}
                      </h2>
                      <p className="mt-1 text-sm font-extrabold text-brand-navy">
                        {money(item.priceXaf)}
                      </p>
                      {(item.availableQuantity ?? 10) < 1 && (
                        <p className="mt-1 text-xs font-bold text-[#a4402f]">
                          {t("Sold out right now")}
                        </p>
                      )}
                      <div className="mt-3 flex gap-2">
                        <button
                          className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg bg-brand-navy px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-blue disabled:opacity-50"
                          disabled={(item.availableQuantity ?? 10) < 1}
                          onClick={() => addItemToBag(item)}
                          type="button"
                        >
                          {t("Add to bag")}
                        </button>
                        <button
                          aria-label={t("Remove from wishlist")}
                          className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-[#d5dce5] text-[#65748a] transition-colors hover:border-brand-navy hover:text-brand-navy"
                          disabled={removing === entry.itemKey}
                          onClick={() => removeItem(entry.itemKey)}
                          type="button"
                        >
                          ✕
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
            {resolvedItems.length === 0 && (
              <div className="mt-8 rounded-2xl bg-white p-6 ring-1 ring-[#e5e9ee]">
                <p className="text-sm leading-6 text-[#65748a]">
                  {t(
                    "Nothing saved yet. Tap the heart on any treat to keep it here.",
                  )}
                </p>
                <Link
                  className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-navy px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-blue"
                  to="/menu"
                >
                  {t("Browse the menu")}
                </Link>
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
