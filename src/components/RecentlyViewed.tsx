import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../language/useLanguage";
import { formatCartMoney } from "../lib/cartPricing";
import { photoErrorHandler, photoSrcSet } from "../lib/thumbnails";
import { readRecentlyViewed, subscribeToRecentlyViewed, type RecentView } from "../lib/recentlyViewed";

type RecentlyViewedProps = {
  /** The product currently open; it is left out so the row never repeats itself. */
  excludeKey?: string;
  /**
   * Open a remembered product in place instead of navigating. The menu page uses this so a
   * remembered product reopens its detail view without a reload; the card design stays here.
   * Return false to fall back to the entry's link.
   */
  onSelect?: (view: RecentView) => boolean | void;
  title?: string;
};

function HistoryIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3.5 4.5V9H8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M12 7.5V12l3 1.8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
      <path
        d={direction === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
    </svg>
  );
}

function BagIcon({ className = "size-[18px]" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M5 8h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9L5 8Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

/** How long ago a product was opened, in the reader's own words. */
function viewedAgo(viewedAt: number | undefined, t: (key: string, vars?: Record<string, unknown>) => string) {
  if (!viewedAt) return "";
  const minutes = Math.floor((Date.now() - viewedAt) / 60_000);
  if (minutes < 1) return t("Just now");
  if (minutes < 60) return t("{count} min ago", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("{count} h ago", { count: hours });
  return t("{count} d ago", { count: Math.floor(hours / 24) });
}

export function RecentlyViewed({ excludeKey, onSelect, title }: RecentlyViewedProps) {
  const { t, language } = useLanguage();
  const [entries, setEntries] = useState<RecentView[]>([]);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const railRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const load = () => setEntries(readRecentlyViewed());
    load();
    return subscribeToRecentlyViewed(load);
  }, []);

  const visible = entries.filter((entry) => entry.key !== excludeKey).slice(0, 8);

  // The rail itself scrolls horizontally on small screens; the arrows only appear when there
  // is somewhere to go, so the controls never sit there dead.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return undefined;
    const update = () => {
      setCanScrollLeft(rail.scrollLeft > 4);
      setCanScrollRight(rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 4);
    };
    update();
    rail.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(rail);
    return () => {
      rail.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [visible.length]);

  if (visible.length === 0) return null;

  const scrollBy = (direction: 1 | -1) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({ left: direction * Math.max(260, rail.clientWidth * 0.8), behavior: "smooth" });
  };

  const heading = title ? t(title) : t("Recently viewed");

  return (
    <section className="relative mt-16 overflow-hidden bg-[#f4f6f8]" aria-labelledby="recently-viewed-heading">
      {/* A faint arc keeps the block from reading as a flat grey slab. */}
      <div aria-hidden="true" className="pointer-events-none absolute -right-32 -top-40 size-[26rem] rounded-full bg-[radial-gradient(closest-side,rgb(255_184_77/0.13),transparent)]" />

      <div className="relative mx-auto max-w-[1320px] px-5 py-12 sm:px-8 sm:py-14 lg:px-12">
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-[#dde3ea] pb-6">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#65748a]">
              <HistoryIcon className="size-3.5" />
              {t("Your history")}
            </p>
            <h2 className="mt-2.5 font-display text-3xl font-extrabold leading-tight tracking-tight text-brand-navy sm:text-4xl" id="recently-viewed-heading">
              {heading}
            </h2>
            <p className="mt-1.5 text-sm font-medium text-[#65748a]">
              {t("Pick up where you left off — your last {count} products.", { count: visible.length })}
            </p>
          </div>

          {canScrollLeft || canScrollRight ? (
            <div className="flex items-center gap-2">
              <button
                aria-label={t("Scroll left")}
                className="grid size-11 place-items-center rounded-full bg-white text-brand-navy ring-1 ring-[#dde3ea] transition hover:bg-brand-navy hover:text-white hover:ring-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-white disabled:hover:text-brand-navy disabled:hover:ring-[#dde3ea]"
                disabled={!canScrollLeft}
                onClick={() => scrollBy(-1)}
                type="button"
              >
                <ArrowIcon direction="left" />
              </button>
              <button
                aria-label={t("Scroll right")}
                className="grid size-11 place-items-center rounded-full bg-white text-brand-navy ring-1 ring-[#dde3ea] transition hover:bg-brand-navy hover:text-white hover:ring-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-white disabled:hover:text-brand-navy disabled:hover:ring-[#dde3ea]"
                disabled={!canScrollRight}
                onClick={() => scrollBy(1)}
                type="button"
              >
                <ArrowIcon direction="right" />
              </button>
            </div>
          ) : null}
        </header>

        <ul
          className="-mx-5 mt-7 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-5 pb-2 sm:-mx-8 sm:px-8 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          ref={railRef}
        >
          {visible.map((entry) => {
            const price = formatCartMoney(entry.priceXaf, "xaf", language);
            const ago = viewedAgo(entry.viewedAt, t);
            const body = (
              <>
                <span className="relative block aspect-[4/3] overflow-hidden bg-[#e9edf2]">
                  <img
                    alt=""
                    className="size-full object-cover transition duration-700 ease-out group-hover:scale-[1.06] group-focus-visible:scale-[1.06] motion-reduce:transform-none motion-reduce:transition-none"
                    loading="lazy"
                    onError={photoErrorHandler(entry.image)}
                    sizes="(min-width: 1024px) 25vw, 70vw"
                    src={entry.image}
                    srcSet={photoSrcSet(entry.image)}
                  />
                  {ago && (
                    <span className="absolute left-3 top-3 rounded-full bg-[#0a2550]/80 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                      {ago}
                    </span>
                  )}
                  {/* A quick way back to the bag without opening the product again. */}
                  <span className="pointer-events-none absolute inset-x-3 bottom-3 flex translate-y-2 items-center justify-center gap-2 rounded-full bg-white/95 py-2 text-xs font-extrabold text-brand-navy opacity-0 shadow-[0_8px_20px_rgba(9,42,83,0.18)] backdrop-blur-sm transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 motion-reduce:transition-none">
                    <BagIcon className="size-4" />
                    {t("View product")}
                  </span>
                </span>
                <span className="flex flex-1 flex-col px-4 pb-4 pt-3.5">
                  <span className="line-clamp-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[#8b95a2]">
                    {entry.detail ? t(entry.detail) : t("Flavor")}
                  </span>
                  <span className="mt-1 line-clamp-2 min-h-[2.6em] font-display text-base font-extrabold leading-snug text-brand-navy">
                    {t(entry.name)}
                  </span>
                  <span className="mt-auto flex items-center justify-between gap-2 pt-3">
                    <span className="font-display text-base font-extrabold tabular-nums text-brand-navy">{price}</span>
                    <span className="grid size-8 place-items-center rounded-full bg-[#f4f6f8] text-brand-navy transition group-hover:bg-brand-navy group-hover:text-white">
                      <ArrowIcon direction="right" />
                    </span>
                  </span>
                </span>
              </>
            );

            const cardClass =
              "group flex h-full flex-col overflow-hidden rounded-2xl bg-white text-left ring-1 ring-[#e1e6ec] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_44px_rgba(9,42,83,0.16)] hover:ring-[#e2d39a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none";

            // When the page can open the product in place, the card is a button; otherwise a link.
            const opensInPlace = Boolean(onSelect);
            return (
              <li className="w-[72%] shrink-0 snap-start sm:w-[46%] lg:w-auto" key={entry.key}>
                {opensInPlace && onSelect ? (
                  <button
                    className={`${cardClass} w-full`}
                    onClick={() => {
                      if (onSelect(entry) === false) window.location.assign(entry.to);
                    }}
                    type="button"
                  >
                    {body}
                  </button>
                ) : (
                  <Link className={cardClass} to={entry.to}>
                    {body}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
