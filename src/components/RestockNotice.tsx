import { useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/api";
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
      <NotifyMeForm t={t} />
      {!customer && (
        <p className="mt-3 text-xs leading-5 text-[#8b95a2]">
          {t("Sign in to save it to your favorites and find it again in one tap.")}
        </p>
      )}
    </div>
  );
}

/** Lets a shopper leave an email to be told when this item is back in stock. */
function NotifyMeForm({ t }: { t: (key: string, vars?: Record<string, unknown>) => string }) {
  const { customer } = useAuth();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function subscribe(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setState("saving");
    try {
      const itemId = typeof window !== "undefined"
        ? decodeURIComponent(window.location.pathname.split("/").pop() || "")
        : "";
      await apiRequest("/restock-notifications", {
        method: "POST",
        body: { email, itemId },
      });
      setState("done");
      setMessage(t("You will hear from us the moment it is back."));
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : t("Please try again."));
    }
  }

  if (state === "done") {
    return (
      <p className="mt-4 flex items-center gap-2 rounded-xl bg-[#eef6e8] px-4 py-3 text-sm font-bold text-[#315d22]" role="status">
        <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
          <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
        {message}
      </p>
    );
  }

  return (
    <form className="mt-4" onSubmit={subscribe}>
      <label className="block text-xs font-extrabold text-[#65748a]" htmlFor="restock-email">
        {t("Get an email when it is back")}
      </label>
      <div className="mt-2 flex gap-2 rounded-2xl bg-white p-1.5 ring-1 ring-[#e3dfd3] transition focus-within:ring-2 focus-within:ring-brand-yellow-deep">
        <input
          autoComplete="email"
          className="min-w-0 flex-1 bg-transparent px-3 text-sm font-semibold text-brand-navy outline-none!"
          id="restock-email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder={t("you@example.com")}
          required
          type="email"
          value={email}
        />
        <button
          className="shrink-0 rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-brand-blue disabled:cursor-not-allowed disabled:bg-[#d8dce2]"
          disabled={state === "saving"}
          type="submit"
        >
          {state === "saving" ? t("Saving…") : t("Notify me")}
        </button>
      </div>
      {state === "error" && message && (
        <p className="mt-2 text-sm font-semibold text-red-700" role="alert">{message}</p>
      )}
    </form>
  );
}
