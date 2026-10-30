import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { useLanguage } from "../language/useLanguage";

/**
 * Shown instead of a bare "Sold out" when the shop is out of an item.
 *
 * Staff can leave a note saying when the next batch arrives; the shopper is also pointed at
 * something to do now, so a sold-out product is not a dead end.
 */
export function RestockNotice({ restockEta }: { restockEta?: string | null }) {
  const { t } = useLanguage();
  const { customer } = useAuth();
  const [copied, setCopied] = useState(false);
  const note = (restockEta || "").trim();

  // A bare date reads better as a date; anything else staff typed is shown as written.
  const formattedNote = (() => {
    if (!note) return "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(note)) return note;
    const date = new Date(`${note}T12:00:00`);
    return Number.isNaN(date.getTime())
      ? note
      : date.toLocaleDateString(undefined, { day: "numeric", month: "long" });
  })();

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-2xl bg-[#f4f6f8] p-4 ring-1 ring-[#e3dfd3]" role="status">
      <p className="flex items-center gap-2 text-sm font-extrabold text-brand-navy">
        <span aria-hidden="true" className="size-2 rounded-full bg-[#c0392b]" />
        {t("Sold out for now")}
      </p>
      <p className="mt-1.5 text-sm leading-6 text-[#65748a]">
        {formattedNote
          ? t("Expected back: {when}. We restock this regularly.", { when: formattedNote })
          : t("This one is out of stock right now. We restock our menu regularly, so check back soon.")}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand-navy px-5 text-sm font-extrabold text-white transition hover:bg-brand-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow focus-visible:ring-offset-2"
          to="/menu"
        >
          {t("See what is in stock")}
        </Link>
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-extrabold text-brand-navy ring-1 ring-[#dcd8cc] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
          onClick={copyLink}
          type="button"
        >
          {copied ? t("Link copied") : t("Save this page")}
        </button>
      </div>
      {!customer && (
        <p className="mt-3 text-xs leading-5 text-[#8b95a2]">
          {t("Sign in to save it to your favorites and find it again in one tap.")}
        </p>
      )}
    </div>
  );
}
