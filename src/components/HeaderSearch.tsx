import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../api/api";
import { useFlavors } from "../context/useFlavors";
import { useLanguage } from "../language/useLanguage";
import { formatCartMoney } from "../lib/cartPricing";
import { coldStoneMenuCategories, getMenuItemId } from "../../shared/data";

type MenuCategory = (typeof coldStoneMenuCategories)[number];
type MenuItem = MenuCategory["items"][number] & {
  id?: string;
  itemType?: string;
  availableQuantity?: number;
  isAvailable?: boolean;
};

type SearchResult = {
  key: string;
  name: string;
  detail: string;
  image?: string;
  priceXaf?: number;
  to: string;
  group: "menu" | "flavors" | "pages";
  soldOut?: boolean;
};

// Fold accents and case so "mocha" finds "Moka" and "crème" finds "creme".
function fold(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const MAX_RESULTS = 8;

// A short list of things customers look for by name but that live outside the catalog.
const PAGE_RESULTS = [
  { name: "Custom cake", detail: "Order a cake for a birthday or celebration", to: "/custom-cake" },
  { name: "Parties and events", detail: "Bulk orders for offices and celebrations", to: "/events" },
  { name: "Track my order", detail: "Check where your order is", to: "/track-order" },
  { name: "Locations", detail: "Douala and Yaoundé branches", to: "/locations" },
  { name: "Contact", detail: "Ask a store a question", to: "/contact" },
];

function matches(haystack: string, query: string) {
  const hay = fold(haystack);
  // Every word must appear somewhere, so "mint cake" still finds the mint cake.
  return fold(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => hay.includes(word));
}

function score(item: { name: string; detail?: string }, query: string) {
  const name = fold(item.name);
  const needle = fold(query).trim();
  if (name === needle) return 3;
  if (name.startsWith(needle)) return 2;
  if (name.includes(needle)) return 1;
  return 0;
}

function SearchIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.9" />
      <path d="m16 16 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
    </svg>
  );
}

function CloseIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

/**
 * The search behind the header magnifier. The built-in menu is searched at once, so typing
 * returns results before any network request; the live menu (stock and admin products) and
 * the flavor catalog refine the list when they arrive.
 */
export function useCatalogSearch(query: string) {
  const { flavors } = useFlavors();
  const [categories, setCategories] = useState<MenuCategory[]>(coldStoneMenuCategories);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiRequest("/menu")
      .then((result) => {
        if (!cancelled && Array.isArray(result?.categories)) {
          setCategories(result.categories);
          setLoaded(true);
        }
      })
      .catch(() => {
        // The built-in menu still answers, so a failed refresh is not worth a message here.
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => {
    const term = query.trim();
    if (term.length < 2) return { results: [] as SearchResult[], total: 0, loaded };

    const menuHits: SearchResult[] = [];
    for (const category of categories) {
      for (const item of category.items as MenuItem[]) {
        if (!matches(`${item.name} ${item.detail} ${category.title}`, term)) continue;
        const available = item.availableQuantity;
        menuHits.push({
          key: `menu-${item.id || getMenuItemId(category.title, item.name)}`,
          name: item.name,
          detail: category.title,
          image: item.image,
          priceXaf: item.priceXaf,
          to: `/menu?${new URLSearchParams({ category: category.title, item: item.name })}`,
          group: "menu",
          soldOut: item.isAvailable === false || available === 0,
        });
      }
    }
    menuHits.sort((a, b) => score(b, term) - score(a, term) || Number(a.soldOut) - Number(b.soldOut));

    const flavorHits: SearchResult[] = flavors
      .filter((flavor) => matches(`${flavor.name} ${flavor.detail} ${flavor.tag}`, term))
      .sort((a, b) => score(b, term) - score(a, term))
      .map((flavor) => ({
        key: `flavor-${flavor.id}`,
        name: flavor.name,
        detail: flavor.tag,
        image: flavor.image,
        priceXaf: flavor.price,
        to: `/flavor/${flavor.id}`,
        group: "flavors",
        soldOut: flavor.availableQuantity < 1,
      }));

    const pageHits: SearchResult[] = PAGE_RESULTS
      .filter((page) => matches(`${page.name} ${page.detail}`, term))
      .map((page) => ({ key: `page-${page.to}`, name: page.name, detail: page.detail, to: page.to, group: "pages" }));

    const ordered = [...menuHits, ...flavorHits, ...pageHits];
    return { results: ordered.slice(0, MAX_RESULTS), total: ordered.length, loaded };
  }, [categories, flavors, loaded, query]);
}

type HeaderSearchProps = {
  /** Called after a result is chosen, so the mobile drawer can close itself. */
  onNavigate?: () => void;
  /** "overlay" lives in the header bar; "inline" sits in the mobile drawer. */
  variant?: "overlay" | "inline";
  /** Lets the header hide every other control while the search is open. */
  onOpenChange?: (open: boolean) => void;
};

export function HeaderSearch({ onNavigate, variant = "overlay", onOpenChange }: HeaderSearchProps) {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(variant === "inline");
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const { results, loaded } = useCatalogSearch(query);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  // The header uses this to hide the navigation and the other controls while searching.
  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => setActiveIndex(0), [query]);

  useEffect(() => {
    if (!open || variant === "inline") return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, variant]);

  const go = (result: SearchResult) => {
    onNavigate?.();
    close();
    navigate(result.to);
  };

  const searchEverything = () => {
    if (!query.trim()) return;
    onNavigate?.();
    close();
    navigate(`/menu/all?${new URLSearchParams({ search: query.trim() })}`);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (query) setQuery("");
      else close();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const target = results[activeIndex];
      if (target) go(target);
      else searchEverything();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!results.length) return;
      event.preventDefault();
      setActiveIndex((current) =>
        event.key === "ArrowDown"
          ? (current + 1) % results.length
          : (current - 1 + results.length) % results.length,
      );
    }
  };

  const money = (amount?: number) =>
    typeof amount === "number" ? formatCartMoney(amount, "xaf", language) : "";

  // In the dark mobile drawer the field and results sit on navy; elsewhere they sit on white.
  const dark = variant === "inline";

  const panel = (
    // The wrapper is the positioning context for the results panel.
    <div className="relative w-full">
      <div className="flex w-full items-center gap-2.5 rounded-full bg-white py-1 pl-5 pr-1.5">
        <SearchIcon className="size-5 shrink-0 text-[#65748a]" />
        <input
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open && query.trim().length >= 2}
          aria-label={t("Search the menu and flavors")}
          autoComplete="off"
          /* No outline or focus ring: the white pill against the navy bar is the focus cue. */
          className="min-w-0 flex-1 appearance-none border-0 bg-transparent py-2.5 text-base font-semibold text-brand-navy shadow-none outline-none! ring-0! placeholder:font-normal placeholder:text-[#8b95a2] focus:outline-none! focus:ring-0! [&::-webkit-search-cancel-button]:appearance-none"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t("Search cakes, shakes, mint…")}
          ref={inputRef}
          role="combobox"
          type="search"
          value={query}
        />
        {query ? (
          <button
            aria-label={t("Clear search")}
            className="grid size-9 shrink-0 place-items-center rounded-full text-[#65748a] transition hover:bg-[#f4f6f8] hover:text-brand-navy"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            type="button"
          >
            <CloseIcon />
          </button>
        ) : null}
        {variant === "overlay" && open && (
          <button
            aria-label={t("Close search")}
            className="grid size-9 shrink-0 place-items-center rounded-full text-[#65748a] transition hover:bg-[#f4f6f8] hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow"
            onClick={close}
            type="button"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      {query.trim().length >= 2 && (
        // Absolutely positioned so the results hang *below* the header bar instead of
        // stretching the 80px row and being squeezed up behind the logo.
        <div
          className={`absolute inset-x-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-2xl shadow-[0_24px_60px_rgba(6,29,58,0.32)] ring-1 ${dark ? "bg-[#0a2550] text-white ring-white/15" : "bg-white text-brand-navy ring-[#dce3eb]"
            }`}
        >
          {results.length > 0 ? (
            <>
              <ul aria-label={t("Search results")} className="max-h-[min(60vh,26rem)] overflow-y-auto p-2" id={listId} role="listbox">
                {results.map((result, index) => (
                  <li key={result.key} role="presentation">
                    <button
                      aria-selected={index === activeIndex}
                      className={`flex w-full items-center gap-3 rounded-xl p-2 text-left transition ${index === activeIndex
                          ? dark ? "bg-white/10" : "bg-[#f1f5f8]"
                          : dark ? "hover:bg-white/[0.06]" : "hover:bg-[#f7f9fb]"
                        }`}
                      onClick={() => go(result)}
                      onMouseEnter={() => setActiveIndex(index)}
                      role="option"
                      type="button"
                    >
                      {result.image ? (
                        <img
                          alt=""
                          className={`size-11 shrink-0 rounded-lg object-cover ${result.soldOut ? "opacity-60 grayscale" : ""}`}
                          height={44}
                          loading="lazy"
                          src={result.image}
                          width={44}
                        />
                      ) : (
                        <span aria-hidden="true" className={`grid size-11 shrink-0 place-items-center rounded-lg ${dark ? "bg-white/10 text-white/70" : "bg-[#f4f6f8] text-[#65748a]"}`}>
                          <SearchIcon className="size-4" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-extrabold leading-snug">{t(result.name)}</span>
                        <span className={`mt-0.5 block truncate text-xs font-semibold ${dark ? "text-white/65" : "text-[#65748a]"}`}>
                          {t(result.group === "menu" ? "Menu" : result.group === "flavors" ? "Flavor" : "Page")}
                          {" · "}
                          {t(result.detail)}
                          {result.soldOut ? ` · ${t("Sold out")}` : ""}
                        </span>
                      </span>
                      {result.priceXaf !== undefined && (
                        <span className={`shrink-0 text-xs font-extrabold tabular-nums ${dark ? "text-brand-yellow" : "text-brand-navy"}`}>{money(result.priceXaf)}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
              <div className={`p-2 ${dark ? "border-t border-white/10" : "border-t border-[#eef1f5]"}`}>
                <button
                  className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-extrabold transition ${dark ? "text-brand-yellow hover:bg-white/[0.06]" : "text-brand-navy hover:bg-[#f7f9fb]"
                    }`}
                  onClick={searchEverything}
                  type="button"
                >
                  <span>{t("See all results for “{query}”", { query: query.trim() })}</span>
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </>
          ) : loaded ? (
            <p className={`px-4 py-6 text-center text-sm font-semibold ${dark ? "text-white/70" : "text-[#65748a]"}`} role="status">
              {t("Nothing matches “{query}”. Try “mint”, “cake” or “shake”.", { query: query.trim() })}
            </p>
          ) : (
            <p className={`px-4 py-6 text-center text-sm font-semibold ${dark ? "text-white/70" : "text-[#65748a]"}`} role="status">
              {t("Searching…")}
            </p>
          )}
        </div>
      )}
    </div>
  );

  if (variant === "inline") {
    return panel;
  }

  const buttonClass = "grid size-11 shrink-0 place-items-center rounded-full bg-white/[0.08] text-white ring-1 ring-white/10 transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow";

  // Closed: just the magnifier. Open: the field takes the whole header bar, so the search has
  // the space the navigation and the other controls leave behind.
  return (
    <div className={open ? "relative flex-1" : "relative shrink-0"} ref={rootRef}>
      {!open && (
        <button
          aria-expanded={false}
          aria-label={t("Search")}
          className={buttonClass}
          onClick={() => setOpen(true)}
          type="button"
        >
          <SearchIcon />
        </button>
      )}
      {open && panel}
    </div>
  );
}
