import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest, getCustomerToken } from "../api/api";
import { useAuth } from "../context/useAuth";
import { useLanguage } from "../language/useLanguage";

// Heart toggle for the wishlist. Guests get a sign-in link instead of a button
// that would silently drop their tap.
export function WishlistHeart({
  itemKey,
  className = "",
}: {
  itemKey: string;
  className?: string;
}) {
  const { customer } = useAuth();
  const { t } = useLanguage();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!customer) return;
    let cancelled = false;
    apiRequest("/wishlist", { token: getCustomerToken() || undefined })
      .then((data) => {
        if (!cancelled) {
          setSaved(
            (data.items || []).some(
              (entry: { itemKey: string }) => entry.itemKey === itemKey,
            ),
          );
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [customer, itemKey]);

  if (!customer) {
    return (
      <Link
        aria-label={t("Sign in to save this")}
        className={`grid size-10 place-items-center rounded-full bg-white/90 text-brand-navy shadow-sm ring-1 ring-black/5 transition-colors hover:text-brand-yellow-deep ${className}`}
        title={t("Sign in to save this")}
        to="/login"
      >
        <HeartSvg filled={false} />
      </Link>
    );
  }

  const toggle = async () => {
    setBusy(true);
    try {
      if (saved) {
        await apiRequest(`/wishlist/items/${encodeURIComponent(itemKey)}`, {
          method: "DELETE",
          token: getCustomerToken() || undefined,
        });
        setSaved(false);
      } else {
        await apiRequest("/wishlist/items", {
          method: "POST",
          body: { itemKey },
          token: getCustomerToken() || undefined,
        });
        setSaved(true);
      }
    } catch {
      // The heart keeps its previous state; the shopper can retry.
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      aria-label={saved ? t("Remove from wishlist") : t("Save to wishlist")}
      aria-pressed={saved}
      className={`grid size-10 place-items-center rounded-full bg-white/90 shadow-sm ring-1 ring-black/5 transition-colors hover:text-brand-yellow-deep disabled:opacity-60 ${
        saved ? "text-[#c2415c]" : "text-brand-navy"
      } ${className}`}
      disabled={busy}
      onClick={toggle}
      type="button"
    >
      <HeartSvg filled={saved} />
    </button>
  );
}

function HeartSvg({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      fill={filled ? "currentColor" : "none"}
      viewBox="0 0 24 24"
    >
      <path
        d="M12 21s-7.5-4.7-9.5-9.2C1 8.2 3 5 6.2 5c2 0 3.6 1.2 4.4 2.6h2.8C14.2 6.2 15.8 5 17.8 5 21 5 23 8.2 21.5 11.8 19.5 16.3 12 21 12 21Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
