import { useEffect, useRef, useState } from "react";
import { photoErrorHandler, photoSrcSet, thumbnail } from "../lib/thumbnails";
import { Link, useLocation } from "react-router-dom";
import { apiRequest } from "../api/api";
import { numberFormatter } from "../lib/cartPricing";
import { useCart } from "../context/useCart";
import { useAuth } from "../context/useAuth";
import { useFlavors } from "../context/useFlavors";
import { useLanguage } from "../language/useLanguage";
import { PROMOTION_DISMISSED_KEY, readInitialPromotion } from "../lib/promotion";
import { coldStoneMenuCategories } from "../../shared/data";
import { EVENT_OCCASIONS } from "../../shared/eventTypes.js";

function ArrowIcon({ diagonal = false }) {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 20 20" fill="none">
      {diagonal ? (
        <path
          d="M5 15 15 5M6 5h9v9"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      ) : (
        <path
          d="M3.5 10h12m-5-5 5 5-5 5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      )}
    </svg>
  );
}

export function StoreTrustBadges({ className = "" }) {
  const { t } = useLanguage();
  const badges = [
    { label: t("5 shops"), title: t("Across Cameroon") },
    { label: t("30 min pickup"), title: t("Pickup at your chosen store") },
    { label: t("FCFA + MoMo"), title: t("Cards and Mobile Money accepted") },
    {
      label: t("1 pt / 100 FCFA"),
      title: t("Every 100 FCFA earns a point — 100 points = 1,000 FCFA off"),
    },
  ];

  return (
    <ul
      aria-label={t("Store benefits")}
      className={`flex flex-wrap gap-2 ${className}`}
    >
      {badges.map((badge) => (
        <li
          className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-bold text-white/90"
          key={badge.label}
          title={badge.title}
        >
          {badge.label}
        </li>
      ))}
    </ul>
  );
}

function closeOtherDropdowns(event) {
  const current = event.currentTarget.closest("details");
  document.querySelectorAll("header details[open]").forEach((dropdown) => {
    if (dropdown !== current) dropdown.open = false;
  });
}

// How many flavor categories the "Flavors" dropdown lists after "All flavors".
const SHOP_DROPDOWN_TAG_LIMIT = 4;

function NavigationDropdown({ active, label, links, mobile = false, onNavigate, subtitle, feature }) {
  const detailsRef = useRef(null);
  // Photos sit inside the closed menu, which is still on screen, so the browser would download
  // them with the page. Load them only after the menu is opened.
  const [showImages, setShowImages] = useState(false);
  useDismissableDetails(detailsRef, !mobile);

  const closeAfterNavigate = (event) => {
    if (mobile) onNavigate();
    const details = event.currentTarget.closest("details");
    if (details) details.open = false;
  };

  if (!mobile) {
    return (
      <details className="group relative" onToggle={(event) => { if (event.currentTarget.open) setShowImages(true); }} ref={detailsRef}>
        <summary
          onClick={closeOtherDropdowns}
          className={`relative flex h-10 cursor-pointer list-none items-center justify-between gap-1.5 whitespace-nowrap px-2 text-[13px] font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow [&::-webkit-details-marker]:hidden ${
            active
              ? "text-white after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-brand-yellow after:content-['']"
              : "text-white/75 after:content-[''] hover:text-white group-open:text-white"
          }`}
        >
          <span>{label}</span>
          <svg aria-hidden="true" className="size-3 shrink-0 transition-transform duration-200 group-open:rotate-180" fill="none" viewBox="0 0 12 12">
            <path d="m2 4 4 4 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
          </svg>
        </summary>

        <div className="menu-popover absolute left-1/2 top-full z-30 w-[min(44rem,calc(100vw-2rem))] -translate-x-1/2 pt-3">
          <div className="grid overflow-hidden rounded-xl bg-white p-2 text-sm text-brand-navy shadow-[0_18px_44px_rgba(6,29,58,0.24)] ring-1 ring-[#dce3eb] sm:grid-cols-[15rem_1fr]">
            {feature && (
              <Link
                className="group/feature relative isolate hidden min-h-[17rem] flex-col justify-end overflow-hidden rounded-lg bg-brand-navy p-5 text-white sm:flex"
                onClick={closeAfterNavigate}
                to={feature.to}
              >
                {feature.image && showImages && (
                  <img decoding="async" alt="" className="absolute inset-0 -z-20 size-full object-cover transition duration-700 group-hover/feature:scale-[1.06]" loading="lazy" onError={photoErrorHandler(feature.image)} src={thumbnail(feature.image)} />
                )}
                <span aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-[#061d3a] via-[#061d3a]/60 to-[#061d3a]/10" />
                <span className="mt-2 font-display text-xl font-extrabold leading-tight">{feature.title}</span>
                {subtitle && <span className="mt-1.5 text-xs leading-5 text-white/70">{subtitle}</span>}
                <span className="mt-4 inline-flex w-fit items-center gap-2 rounded-md bg-brand-yellow px-4 py-2.5 text-xs font-extrabold text-brand-navy transition-colors group-hover/feature:bg-white">
                  {feature.cta} <ArrowIcon />
                </span>
              </Link>
            )}

            <div className="p-2 sm:p-3">
              <p className="px-2 pb-3 pt-1 text-sm font-bold text-brand-navy">{feature?.listTitle || label}</p>
              <ul className={`grid gap-1 ${links.length > 4 ? "sm:grid-cols-2" : ""}`}>
                {links.map((link) => (
                  <li key={link.to}>
                    <Link
                      className="group/link flex min-w-0 items-center gap-3 rounded-md p-2.5 pr-3 transition-colors hover:bg-[#f1f5f8] focus-visible:bg-[#f1f5f8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-yellow-deep"
                      onClick={closeAfterNavigate}
                      to={link.to}
                    >
                      {link.image && showImages ? (
                        <img decoding="async" alt="" aria-hidden="true" className="size-11 shrink-0 rounded-md object-cover transition duration-300 group-hover/link:scale-[1.04]" loading="lazy" onError={photoErrorHandler(link.image, "/images/hero-ice-cream.jpg")} src={thumbnail(link.image, "tiny")} />
                      ) : (
                        <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-md bg-[#f4f6f8] font-display text-base font-bold text-brand-navy">{link.label.slice(0, 1)}</span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 block text-sm font-extrabold leading-snug text-brand-navy">{link.label}</span>
                        {link.meta && <span className="mt-0.5 block truncate text-xs font-semibold text-[#65748a]">{link.meta}</span>}
                      </span>
                      <span aria-hidden="true" className="grid size-7 shrink-0 -translate-x-1 place-items-center rounded-full text-brand-yellow-deep opacity-0 transition group-hover/link:translate-x-0 group-hover/link:opacity-100 group-focus-visible/link:translate-x-0 group-focus-visible/link:opacity-100">
                        <ArrowIcon />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </details>
    );
  }

  return (
    <details className="group relative" onToggle={(event) => { if (event.currentTarget.open) setShowImages(true); }}>
      <summary
        onClick={closeOtherDropdowns}
        className={`relative flex cursor-pointer list-none items-center justify-between gap-2 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-yellow [&::-webkit-details-marker]:hidden ${
          mobile
            ? `min-h-12 px-4 text-[15px] font-semibold ${active ? "text-brand-yellow after:absolute after:bottom-3 after:left-0 after:top-3 after:w-0.5 after:rounded-full after:bg-brand-yellow after:content-['']" : "text-white/80 hover:text-white group-open:text-white"}`
            : `whitespace-nowrap rounded-full border-transparent px-2.5 py-2 ${active ? "bg-white/[0.1] text-brand-yellow" : "text-white hover:bg-white/[0.07] hover:text-brand-yellow"} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow`
        }`}
      >
        <span className="flex items-center gap-2">
          <span>{label}</span>
        </span>
        <svg aria-hidden="true" className="size-3 shrink-0 transition-transform duration-200 group-open:rotate-180" fill="none" viewBox="0 0 12 12">
          <path d="m2 4 4 4 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        </svg>
      </summary>
      <div className={mobile
        ? "mt-1 grid gap-1 rounded-md bg-[color:var(--brand-blue)] p-1.5"
        : `menu-popover absolute left-1/2 top-full z-30 -translate-x-1/2 pt-3 ${links.length > 5 ? "lg:w-[min(38rem,calc(100vw-2rem))]" : "w-[min(24rem,calc(100vw-2rem))]"}`
      }>
        <div className={mobile ? "grid gap-1" : "overflow-hidden rounded-xl bg-white p-3 text-sm shadow-[0_18px_44px_rgba(9,42,83,0.2)] ring-1 ring-[#dce3eb]"}>
          {!mobile && (
            <div className="mb-2 flex items-center justify-between gap-3 px-2 pb-3 pt-1">
              <div>
                <p className="text-sm font-bold text-brand-navy">{label}</p>
                {subtitle && <p className="mt-1 text-xs text-[#65748a]">{subtitle}</p>}
              </div>
            </div>
          )}
          <div className={links.length > 5 && !mobile ? "grid gap-1 sm:grid-cols-2" : "grid gap-1"}>
            {links.map((link) => (
              <Link
                className={mobile
                  ? "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-white/85 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-yellow"
                  : "group/link flex min-w-0 items-center gap-3 rounded-md px-3 py-2.5 text-left text-[#65748a] transition-colors hover:bg-[#f1f5f8] hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-yellow-deep"
                }
                key={link.to}
                onClick={(event) => {
                  if (mobile) onNavigate()
                  const details = event.currentTarget.closest("details")
                  if (details) details.open = false
                }}
                to={link.to}
              >
                {link.image && showImages ? (
                  <img decoding="async" alt="" aria-hidden="true" className="size-10 shrink-0 rounded-md object-cover" loading="lazy" onError={photoErrorHandler(link.image, "/images/hero-ice-cream.jpg")} src={thumbnail(link.image, "tiny")} />
                ) : (
                  <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-md text-sm font-extrabold ${mobile ? "bg-white/10 text-brand-yellow" : "bg-[#f4f6f8] text-brand-navy"}`}>
                    {link.label.slice(0, 1)}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{link.label}</span>
                  {link.meta && <span className={`mt-0.5 block truncate text-xs ${mobile ? "text-white/55" : "text-[#65748a]"}`}>{link.meta}</span>}
                </span>
                {!mobile && <span aria-hidden="true" className="translate-x-[-3px] text-brand-navy opacity-0 transition group-hover/link:translate-x-0 group-hover/link:opacity-100"><ArrowIcon /></span>}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </details>
  );
}

function useDismissableDetails(ref, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;
    const closeOnOutside = (event) => {
      const details = ref.current;
      if (details?.open && !details.contains(event.target)) details.open = false;
    };
    const closeOnEscape = (event) => {
      const details = ref.current;
      if (event.key === "Escape" && details?.open) {
        details.open = false;
        details.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [ref, enabled]);
}

function LanguageDropdown({ language, setLanguage, t }) {
  const detailsRef = useRef(null);
  useDismissableDetails(detailsRef);
  const languages = [
    { value: "en", label: "English", nativeLabel: "English", code: "EN", mark: "EN", region: "Cameroon · English" },
    { value: "fr", label: "French", nativeLabel: "Français", code: "FR", mark: "FR", region: "Cameroun · Français" },
  ];
  const activeLanguage = languages.find((option) => option.value === language) || languages[0];
  return (
    <details className="group relative" ref={detailsRef}>
      <summary
        aria-label={`${t("Language")}: ${activeLanguage.nativeLabel}`}
        className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-white/25 bg-white/[0.06] py-1.5 pl-1.5 pr-3 text-xs font-bold text-white transition hover:border-white/50 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy group-open:border-brand-yellow/60 group-open:bg-white/10 [&::-webkit-details-marker]:hidden sm:pr-3.5"
        onClick={closeOtherDropdowns}
      >
        <span aria-hidden="true" className="grid size-7 place-items-center rounded-full bg-brand-yellow text-[9px] font-extrabold tracking-tight text-brand-navy">{activeLanguage.mark}</span>
        <span className="hidden xl:inline">{activeLanguage.nativeLabel}</span>
        <svg aria-hidden="true" className="size-3 text-white/70 transition-transform duration-200 group-open:rotate-180" fill="none" viewBox="0 0 12 12">
          <path d="m2 4 4 4 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        </svg>
      </summary>
      <div className="menu-popover absolute right-0 top-full z-30 w-72 pt-3">
        <div className="overflow-hidden rounded-xl bg-white p-2 text-sm text-brand-navy shadow-[0_18px_44px_rgba(6,29,58,0.24)] ring-1 ring-[#dce3eb]">
          <div className="px-3 pb-3 pt-2">
            <p className="text-sm font-bold text-brand-navy">{t("Select language")}</p>
          </div>
          <div className="grid gap-1" role="group" aria-label={t("Select language")}>
            {languages.map(({ value, nativeLabel, code, region }) => {
              const selected = language === value;
              return (
                <button
                  aria-pressed={selected}
                  className={`group/lang flex w-full items-center gap-3 rounded-md p-2.5 pr-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-yellow-deep ${
                    selected ? "bg-[#f4f6f8] text-brand-navy" : "hover:bg-[#f4f6f8]"
                  }`}
                  key={value}
                  lang={value}
                  onClick={(event) => {
                    setLanguage(value);
                    const details = event.currentTarget.closest("details");
                    if (details) details.open = false;
                  }}
                  type="button"
                >
                  <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-md font-display text-xs font-extrabold tracking-wide ${
                    selected ? "bg-brand-navy text-white" : "bg-[#f4f6f8] text-[#65748a] group-hover/lang:bg-white"
                  }`}>{code}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-extrabold">{nativeLabel}</span>
                    <span className="mt-0.5 block text-xs font-semibold text-[#65748a]">{region}</span>
                  </span>
                  <span aria-hidden="true" className={`grid size-5 shrink-0 place-items-center rounded-full ${selected ? "bg-brand-navy text-white" : "text-transparent"}`}>
                    {selected && <svg className="size-3" fill="none" viewBox="0 0 16 16"><path d="m3 8 3.2 3.2L13 4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </details>
  );
}

function AccountDropdown({ customer, customerName, location, handleLogout, t, mobile = false, onNavigate }) {
  const accountActive = ["/account/orders", "/login", "/signup"].includes(location.pathname);
  const options = customer
    ? [{ label: t("My account"), to: "/account/orders" }]
    : [
        { label: t("Log in"), to: "/login" },
        { label: t("Sign up"), to: "/signup" },
      ];

  const detailsRef = useRef(null);
  useDismissableDetails(detailsRef, !mobile);

  function closeDropdown(event) {
    const details = event.currentTarget.closest("details");
    if (details) details.open = false;
    onNavigate?.();
  }

  const avatar = (size) =>
    customer?.profilePicture ? (
      <img decoding="async" loading="lazy" alt="" className={`${size} shrink-0 rounded-full object-cover`} src={customer.profilePicture} />
    ) : (
      <span aria-hidden="true" className={`${size} grid shrink-0 place-items-center rounded-full bg-brand-yellow font-display font-extrabold text-brand-navy`}>
        {(customer?.name || "A").charAt(0).toUpperCase()}
      </span>
    );

  if (!mobile) {
    const menuItems = customer
      ? [
          {
            label: t("My account"),
            to: "/account/orders",
            icon: <path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />,
          },
          {
            label: t("Shopping cart"),
            to: "/cart",
            icon: (
              <>
                <path d="M5 8h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9L5 8Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
                <path d="M9 8V6.5a3 3 0 0 1 6 0V8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
              </>
            ),
          },
        ]
      : [];

    return (
      <details className="group relative hidden md:block" ref={detailsRef}>
        <summary
          className={`flex cursor-pointer list-none items-center gap-2 rounded-full py-1.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow md:text-sm [&::-webkit-details-marker]:hidden ${
            customer ? "pl-1.5 pr-3" : "px-3"
          } ${accountActive ? "bg-white/[0.1] text-brand-yellow" : "text-white hover:bg-white/[0.07] group-open:bg-white/[0.1]"}`}
          aria-label={t("Account")}
          onClick={closeOtherDropdowns}
        >
          {customer ? (
            <span className="relative">
              {avatar("size-8 text-xs ring-2 ring-white/20")}
              <span aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-[#4caf50] ring-2 ring-brand-navy" />
            </span>
          ) : (
            <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="8.5" r="3.5" stroke="currentColor" strokeWidth="1.8" />
              <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
            </svg>
          )}
          <span className="hidden xl:inline">{t("Account")}</span>
          <svg aria-hidden="true" className="size-3 shrink-0 transition-transform duration-200 group-open:rotate-180" fill="none" viewBox="0 0 12 12">
            <path d="m2 4 4 4 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
          </svg>
        </summary>

        <div className="menu-popover absolute right-0 top-full z-30 w-80 pt-3">
          <div className="overflow-hidden rounded-xl bg-white text-sm text-brand-navy shadow-[0_18px_44px_rgba(6,29,58,0.24)] ring-1 ring-[#dce3eb]">
            {customer ? (
              <>
                <div className="flex items-center gap-4 bg-brand-navy p-5 text-white">
                  {avatar("size-12 text-base")}
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg font-bold leading-tight">{customerName || customer.name || t("Account")}</p>
                    <p className="mt-1 truncate text-xs text-white/70">{customer.email}</p>
                  </div>
                </div>
                <nav aria-label={t("Account")} className="grid gap-1 p-2">
                  {menuItems.map((item) => {
                    const current = location.pathname === item.to;
                    return (
                      <Link
                        aria-current={current ? "page" : undefined}
                        className={`group/item flex items-center gap-3 rounded-md p-2.5 pr-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-yellow-deep ${
                          current ? "bg-[#f4f6f8]" : "hover:bg-[#f4f6f8]"
                        }`}
                        key={item.to}
                        onClick={closeDropdown}
                        to={item.to}
                      >
                        <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-md transition ${current ? "bg-brand-navy text-white" : "bg-[#f4f6f8] text-[#65748a] group-hover/item:bg-white group-hover/item:text-brand-navy"}`}>
                          <svg className="size-[18px]" fill="none" viewBox="0 0 24 24">{item.icon}</svg>
                        </span>
                        <span className="flex-1 font-extrabold">{item.label}</span>
                        <span aria-hidden="true" className="-translate-x-1 text-brand-navy opacity-0 transition group-hover/item:translate-x-0 group-hover/item:opacity-100">
                          <ArrowIcon />
                        </span>
                      </Link>
                    );
                  })}
                </nav>
                <div className="bg-[#f4f6f8] p-2">
                  <button
                    className="group/logout flex w-full items-center gap-3 rounded-md p-2.5 text-left font-bold text-[#65748a] transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-300"
                    onClick={(event) => {
                      closeDropdown(event);
                      handleLogout();
                    }}
                    type="button"
                  >
                    <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-md bg-white transition group-hover/logout:bg-red-100">
                      <svg className="size-[18px]" fill="none" viewBox="0 0 24 24">
                        <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l4-4-4-4M14 12H4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                      </svg>
                    </span>
                    {t("Log out")}
                  </button>
                </div>
              </>
            ) : (
              <div className="p-5">
                <span aria-hidden="true" className="grid size-12 place-items-center rounded-md bg-[#f4f6f8] text-brand-navy">
                  <svg className="size-6" fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="8.5" r="3.5" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
                  </svg>
                </span>
                <p className="mt-4 font-display text-xl font-extrabold leading-tight">{t("Welcome")}</p>
                <p className="mt-1.5 text-xs leading-5 text-[#65748a]">{t("Sign in to see your orders and favorites.")}</p>
                <div className="mt-5 grid gap-2">
                  <Link
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-brand-navy px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2"
                    onClick={closeDropdown}
                    to="/login"
                  >
                    {t("Log in")} <ArrowIcon />
                  </Link>
                  <Link
                    className="inline-flex min-h-11 items-center justify-center rounded-md px-5 py-3 text-sm font-bold text-brand-navy transition-colors hover:bg-[#f4f6f8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2"
                    onClick={closeDropdown}
                    to="/signup"
                  >
                    {t("Create an account")}
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </details>
    );
  }

  return (
    <details className={`group relative ${mobile ? "col-span-2" : "hidden md:block"}`}>
      <summary
      className={`flex cursor-pointer list-none items-center border-b-2 transition-colors [&::-webkit-details-marker]:hidden ${
          mobile
          ? `min-h-12 justify-between rounded-md border-transparent px-4 text-base font-semibold ${accountActive ? "bg-white/[0.12] text-brand-yellow" : "text-white/90 hover:bg-white/[0.08] group-open:bg-white/[0.08]"}`
          : `gap-2 rounded-md border-transparent px-2 py-1.5 text-xs font-bold text-white hover:border-white/25 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow md:text-sm ${accountActive ? "bg-white/[0.1] text-brand-yellow" : ""}`
        }`}
        onClick={closeOtherDropdowns}
      >
        {customer && !mobile && (
          customer.profilePicture
            ? <img decoding="async" loading="lazy" alt="" className="size-8 rounded-full border border-white/30 object-cover" src={customer.profilePicture} />
            : <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-brand-yellow text-xs font-extrabold text-brand-navy">{(customer.name || "A").charAt(0).toUpperCase()}</span>
        )}
        <span className={mobile ? "hidden" : "hidden md:inline"}>{t("Account")}</span>
        {mobile && <span className="flex min-w-0 items-center gap-2">
          {customer && (customer.profilePicture
            ? <img decoding="async" loading="lazy" alt="" className="size-8 rounded-full border border-white/30 object-cover" src={customer.profilePicture} />
            : <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-brand-yellow text-xs font-extrabold text-brand-navy">{(customer.name || "A").charAt(0).toUpperCase()}</span>)}
          <span className="truncate">{customer ? customerName || t("Account") : t("Account")}</span>
        </span>}
        <svg aria-hidden="true" className="size-3 shrink-0 transition-transform duration-200 group-open:rotate-180" fill="none" viewBox="0 0 12 12">
          <path d="m2 4 4 4 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        </svg>
      </summary>
      <div className={mobile
        ? "mt-1 grid gap-1 rounded-md bg-white/[0.04] p-2 ring-1 ring-white/10"
        : "menu-popover absolute right-0 top-full z-30 w-64 pt-3"
      }>
        <div className={mobile ? "grid gap-1" : "overflow-hidden rounded-2xl border border-[#e7e3d9] bg-white p-2 text-sm shadow-[0_18px_48px_rgba(9,42,83,0.2)] ring-1 ring-black/[0.02]"}>
          {customer && (
            <div className={mobile
              ? "mb-1 flex min-w-0 items-center gap-3 rounded-md bg-white/[0.05] px-3 py-3"
              : "mb-1 flex min-w-0 items-center gap-3 rounded-xl bg-[#fbfaf5] px-3 py-3"
            }>
              {customer.profilePicture
                ? <img decoding="async" loading="lazy" alt="" className="size-10 shrink-0 rounded-full object-cover" src={customer.profilePicture} />
                : <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-yellow text-sm font-extrabold text-brand-navy">{(customer.name || "A").charAt(0).toUpperCase()}</span>}
              <div className="min-w-0">
                <p className={`truncate text-sm font-extrabold ${mobile ? "text-white" : "text-brand-navy"}`}>{customerName || t("Account")}</p>
                <p className={`truncate text-xs ${mobile ? "text-white/60" : "text-[#65748a]"}`}>{customer.email}</p>
              </div>
            </div>
          )}
          {options.map((option) => (
            <Link
              aria-current={location.pathname === option.to ? "page" : undefined}
              className={mobile
                ? `flex items-center gap-3 rounded-md px-3 py-3 text-sm transition ${location.pathname === option.to ? "bg-white/[0.12] font-bold text-brand-yellow" : "text-white/85 hover:bg-white/[0.08] hover:text-white"}`
                : `flex items-center gap-3 rounded-xl px-3 py-3 text-left transition ${location.pathname === option.to ? "bg-[#fff8dc] font-extrabold text-brand-yellow-deep" : "font-semibold text-[#65748a] hover:bg-[#fbfaf5] hover:text-brand-navy"}`
              }
              key={option.to}
              onClick={closeDropdown}
              to={option.to}
            >
              <span aria-hidden="true" className={`grid size-9 shrink-0 place-items-center rounded-md ${mobile ? "bg-white/10" : "bg-[#edf3f9]"} ${location.pathname === option.to ? "text-brand-yellow" : mobile ? "text-white/80" : "text-brand-navy"}`}>
                <svg className="size-[18px]" fill="none" viewBox="0 0 24 24">
                  {customer ? (
                    <>
                      <path d="M7 3.75h7l4 4v12.5H7a2 2 0 0 1-2-2v-12.5a2 2 0 0 1 2-2Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
                      <path d="M14 4v4h4M9 13h6M9 16.5h6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
                    </>
                  ) : option.to === "/login" ? (
                    <path d="M13 5h5a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5M10 16l4-4-4-4m4 4H4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                  ) : (
                    <>
                      <circle cx="10" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.7" />
                      <path d="M4 19c.7-3 2.8-4.5 6-4.5 1.2 0 2.2.2 3 .6M18 13v6m-3-3h6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
                    </>
                  )}
                </svg>
              </span>
              <span className="min-w-0 flex-1">{option.label}</span>
              {location.pathname === option.to && <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 16 16"><path d="m3 8 3.2 3.2L13 4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>}
            </Link>
          ))}
          {customer && (
            <button
              aria-label={t("Log out")}
              className={mobile
                ? "mt-1 flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm text-white/75 transition hover:bg-red-500/15 hover:text-white"
                : "mt-1 flex w-full items-center gap-3 rounded-xl border-t border-[#eeeae1] px-3 py-3 text-left font-semibold text-[#65748a] transition hover:bg-red-50 hover:text-red-700"
              }
              onClick={(event) => {
                closeDropdown(event);
                handleLogout();
              }}
              type="button"
            >
              <span aria-hidden="true" className={`grid size-9 shrink-0 place-items-center rounded-md ${mobile ? "bg-white/10" : "bg-[#f1f3f5]"}`}>
                <svg className="size-[18px]" fill="none" viewBox="0 0 24 24">
                  <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l4-4-4-4M14 12H4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                </svg>
              </span>
              <span className="flex-1">{t("Log out")}</span>
            </button>
          )}
        </div>
      </div>
    </details>
  );
}

function BrandMark({ compact = false }) {
  return (
    <img decoding="async" loading="eager"
      alt=""
      aria-hidden="true"
      className={`shrink-0 rounded-full shadow-[0_8px_20px_rgba(0,0,0,0.3)] transition-all group-hover:rotate-[-6deg] ${compact ? "size-11" : "size-12"}`}
      height={48}
      src="/logo.png"
      width={48}
    />
  );
}

// Mini-cart popover: shows the last items, subtotal and quick links, so the visitor
// can confirm the bag without leaving the page. Opens on hover/focus (desktop) and
// on tap (mobile), closes on outside click or Escape.
function BagMenu({ cartItems, cartCount, cartTotal, language, location, t }) {
  const [isOpen, setIsOpen] = useState(false);
  const [bagJustUpdated, setBagJustUpdated] = useState(false);
  const wrapperRef = useRef(null);
  const closeTimer = useRef(undefined);
  const bagPulseTimer = useRef(undefined);
  const previousCartCount = useRef(cartCount);
  const formatPrice = (price) =>
    `${numberFormatter(language === "fr" ? "fr-CM" : "en-CM").format(price)} FCFA`;

  useEffect(() => {
    if (!isOpen) return undefined;
    const onPointerDown = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setIsOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  useEffect(() => {
    if (cartCount > previousCartCount.current) {
      setBagJustUpdated(true);
      window.clearTimeout(bagPulseTimer.current);
      bagPulseTimer.current = window.setTimeout(
        () => setBagJustUpdated(false),
        1600,
      );
    }
    previousCartCount.current = cartCount;
  }, [cartCount]);

  useEffect(() => () => window.clearTimeout(bagPulseTimer.current), []);

  const open = () => {
    window.clearTimeout(closeTimer.current);
    setIsOpen(true);
  };

  const openWithDelay = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setIsOpen(true), 180);
  };

  const closeSoon = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setIsOpen(false), 220);
  };

  const isCartPage = location.pathname === "/cart";
  const lastItems = [...cartItems].slice(-3).reverse();

  return (
    <div
      className="relative"
      onPointerEnter={openWithDelay}
      onPointerLeave={closeSoon}
      ref={wrapperRef}
    >
      <Link
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={t("Shopping bag, {count} items", { count: cartCount })}
        className={`relative grid size-11 shrink-0 place-items-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow ${
          isCartPage || isOpen ? "bg-brand-yellow text-brand-navy" : "text-white hover:bg-white/10"
        }`}
        onClick={() => setIsOpen(false)}
        to="/cart"
      >
        <BagIcon />
        {cartCount > 0 && (
          <span
            className={`absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full px-1 text-xs font-extrabold ring-2 ring-brand-navy ${
              bagJustUpdated
                ? "animate-bag-pulse bg-[#4caf50] text-white"
                : "bg-brand-yellow text-brand-navy"
            }`}
          >
            {cartCount > 99 ? "99+" : cartCount}
          </span>
        )}
      </Link>
      {isOpen && (
        <div
          aria-label={t("Shopping bag")}
          className="admin-modal-panel absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(9,42,83,0.25)] ring-1 ring-[#dce3eb]"
          role="dialog"
        >
          <div className="bg-brand-navy px-4 py-3 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
              {t("Your bag")}
            </p>
            <p className="mt-0.5 font-display text-lg font-extrabold">
              {t(
                cartCount === 1 ? "1 item" : "{count} items",
                { count: cartCount },
              )}
            </p>
          </div>
          {lastItems.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm leading-6 text-[#65748a]">
                {t("Your bag is empty — add something sweet!")}
              </p>
            </div>
          ) : (
            <>
              <ul className="max-h-64 overflow-y-auto p-2">
                {lastItems.map((entry) => (
                  <li
                    className="flex items-center gap-3 rounded-xl px-2 py-2"
                    key={entry.itemId}
                  >
                    <img
                      alt=""
                      className="size-11 shrink-0 rounded-lg object-cover"
                      loading="lazy"
                      src={thumbnail(entry.image, "tiny")}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-brand-navy">
                        {t(entry.name)}
                      </span>
                      <span className="block text-xs text-[#65748a]">
                        {t("Qty")} {entry.quantity}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-extrabold tabular-nums text-brand-navy">
                      {formatPrice((entry.price ?? 0) * entry.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-[#dce3eb] px-4 py-3">
                <p className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-[#65748a]">{t("Subtotal")}</span>
                  <span className="font-display text-base font-extrabold tabular-nums text-brand-navy">
                    {formatPrice(cartTotal)}
                  </span>
                </p>
              </div>
            </>
          )}
          <div className="flex gap-2 border-t border-[#dce3eb] p-3">
            <Link
              className="flex-1 rounded-full bg-brand-navy px-4 py-2.5 text-center text-sm font-extrabold text-white transition hover:bg-brand-blue"
              onClick={() => setIsOpen(false)}
              to="/cart"
            >
              {t("View cart")}
            </Link>
            <Link
              className="flex-1 rounded-full border border-[#cfd8e1] px-4 py-2.5 text-center text-sm font-extrabold text-brand-blue transition hover:border-brand-navy"
              onClick={() => setIsOpen(false)}
              to="/menu"
            >
              {t("Keep shopping")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function BagIcon({ className = "size-5" }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M5 8h14l1 12H4L5 8Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
      <path d="M9 9V6a3 3 0 0 1 6 0v3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    </svg>
  );
}

function useHeaderVisibility(headerRef) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let frame = 0;
    function update() {
      frame = 0;
      const y = window.scrollY;
      const height = headerRef.current?.offsetHeight || 0;
      setIsScrolled(y > 8);
      // Hide while reading downwards, reveal as soon as the visitor scrolls back up.
      if (y > height + 120 && y > lastY + 4) setIsHidden(true);
      else if (y < lastY - 4 || y <= height) setIsHidden(false);
      lastY = y;
    }
    function onScroll() {
      if (!frame) frame = window.requestAnimationFrame(update);
    }
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [headerRef]);

  // Other sticky elements (menu tabs, order summaries) read this to sit below the header.
  useEffect(() => {
    const root = document.documentElement;
    function publish() {
      const height = headerRef.current?.offsetHeight || 0;
      root.style.setProperty("--site-header-offset", `${isHidden ? 0 : height}px`);
    }
    publish();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(publish);
    if (observer && headerRef.current) observer.observe(headerRef.current);
    return () => {
      observer?.disconnect();
    };
  }, [headerRef, isHidden]);

  useEffect(() => () => document.documentElement.style.removeProperty("--site-header-offset"), []);

  return { isScrolled, isHidden };
}

export function Header() {
  const { cartCount, cartItems, cartTotal } = useCart();
  const { customer, logout } = useAuth();
  const { flavors } = useFlavors();
  const { language, setLanguage, t } = useLanguage();
  const location = useLocation();
  const headerRef = useRef(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  // The bag badge pulses briefly when an item is added, so the visitor sees exactly
  // where their item went — feedback anchored to the bag, not a distant message.
  const [bagJustUpdated, setBagJustUpdated] = useState(false);
  const bagPulseTimer = useRef(undefined);
  const previousCartCount = useRef(cartCount);
  const { isScrolled, isHidden } = useHeaderVisibility(headerRef);

  useEffect(() => {
    if (cartCount > previousCartCount.current) {
      setBagJustUpdated(true);
      window.clearTimeout(bagPulseTimer.current);
      bagPulseTimer.current = window.setTimeout(
        () => setBagJustUpdated(false),
        1600,
      );
    }
    previousCartCount.current = cartCount;
  }, [cartCount]);

  useEffect(() => () => window.clearTimeout(bagPulseTimer.current), []);

  const isHome = location.pathname === "/";
  const isAdminPage = location.pathname.startsWith("/admin");
  const isShopActive =
    location.pathname === "/flavors" || location.pathname.startsWith("/flavor/");
  const isMenuActive = location.pathname === "/menu" || location.pathname === "/menu/all";
  const isEventsActive = location.pathname === "/events";
  const shopFlavors = flavors.filter((flavor) => flavor.availableQuantity > 0);
  const shopLinks = [
    {
      label: t("All flavors"),
      to: "/flavors",
      icon: "🍨",
      image: shopFlavors[0]?.image,
      meta: t(shopFlavors.length === 1 ? "1 flavor" : "{count} flavors", { count: shopFlavors.length }),
    },
    // The dropdown keeps a short list: the labels of the longest-standing flavors (lowest ids).
    // Newer flavors are listed on the "All flavors" page, not as extra dropdown links.
    ...[...new Set([...shopFlavors].sort((first, second) => first.id - second.id).map((flavor) => flavor.tag).filter(Boolean))]
      .slice(0, SHOP_DROPDOWN_TAG_LIMIT)
      .sort((first, second) => first.localeCompare(second))
      .map((tag) => {
        const tagged = shopFlavors.filter((flavor) => flavor.tag === tag);
        return {
          label: t(tag),
          to: `/flavors?tag=${encodeURIComponent(tag)}`,
          image: tagged[0]?.image,
          meta: t(tagged.length === 1 ? "1 flavor" : "{count} flavors", { count: tagged.length }),
        };
      }),
  ];
  const menuLinks = [
    {
      label: t("All menu"),
      icon: "🍽️",
      image: "/menu-official/ice-cream/signature-creations/founders-favorite.webp",
      // No count here: admin-added products are on the page but not in the built-in list.
      meta: t("Every item on one page"),
      to: "/menu/all",
    },
    ...coldStoneMenuCategories.map((category) => ({
      label: t(category.title),
      icon: category.icon,
      image: category.image,
      meta: t("{count} items", { count: category.items.length }),
      to: `/menu?category=${encodeURIComponent(category.title)}`,
    })),
  ];
  const shopFeature = {
    to: "/flavors",
    image: "/ice-images/ice-4.webp",
    title: t("Ice cream by the scoop"),
    cta: t("Browse all flavors"),
    listTitle: t("Flavor tag"),
  };
  const menuFeature = {
    to: "/menu",
    image: "/ice-images/ice-5.webp",
    title: t("Menu & treats"),
    cta: t("Explore the menu"),
    listTitle: t("Menu categories"),
  };
  const eventLinks = EVENT_OCCASIONS.map((event) => ({
    label: t(event.label),
    to: `/events?type=${event.id}`,
    image: event.image,
    meta: t(event.detail),
  }));
  const eventFeature = {
    to: "/events",
    image: "/cake-images/cake-11.webp",
    title: t("Plan the order"),
    cta: t("Start an event order"),
    listTitle: t("Type of event"),
  };
  const customerSecondName = customer?.name.trim().split(/\s+/).at(-1) || "";

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!isMobileMenuOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event) {
      if (event.key === "Escape") setIsMobileMenuOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isMobileMenuOpen]);

  const desktopLinkClassName = (isActive) =>
    `relative inline-flex h-10 items-center whitespace-nowrap px-2 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow xl:px-2.5 ${
      isActive
        ? "text-white after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-brand-yellow after:content-['']"
        : "text-white/75 hover:text-white"
    }`;
  const mobileLinkClassName = (isActive) =>
    `relative flex min-h-12 items-center justify-between px-4 text-[15px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-yellow ${
      isActive
        ? "text-brand-yellow after:absolute after:bottom-3 after:left-0 after:top-3 after:w-0.5 after:rounded-full after:bg-brand-yellow after:content-['']"
        : "text-white/80 hover:text-white"
    }`;

  async function handleLogout() {
    setLogoutError("");
    try {
      await logout();
      setIsMobileMenuOpen(false);
    } catch (error) {
      setLogoutError(error.message);
    }
  }

  return (
    <>
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-full focus:bg-brand-yellow focus:px-5 focus:py-3 focus:text-sm focus:font-extrabold focus:text-brand-navy focus:shadow-[0_14px_32px_rgba(9,42,83,0.35)] focus:outline-none focus:ring-2 focus:ring-white"
        href="#main"
      >
        {t("Skip to main content")}
      </a>
      {!isAdminPage && <PromotionCountdown />}
      <div
        className={`sticky top-0 z-50 transition-[transform,background-color,box-shadow] duration-300 ${isHidden && !isMobileMenuOpen ? "-translate-y-full" : "translate-y-0"} ${
          isScrolled ? "bg-brand-navy shadow-[0_10px_30px_rgba(71,42,59,0.35)]" : "bg-brand-navy"
        }`}
        ref={headerRef}
      >
        <div aria-hidden="true" className={`pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent transition-opacity ${isScrolled ? "opacity-100" : "opacity-0"}`} />
        <header className={`relative mx-auto flex max-w-[1320px] items-center gap-2 px-4 text-white transition-[height] duration-300 sm:px-6 lg:gap-2 lg:px-3 xl:gap-4 xl:px-12 ${isScrolled ? "h-[68px]" : "h-[80px]"}`}>
          <Link aria-label="Cold Stone Creamery Cameroon home" className="group flex shrink-0 items-center gap-3 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow" to="/">
            <BrandMark compact={isScrolled} />
            <span className="font-display text-[18px] font-extrabold leading-[0.95] tracking-tight text-white sm:text-[19px]">
              Cold Stone
              <span className="block text-brand-yellow">Creamery</span>
            </span>
          </Link>

          {!isAdminPage && (
            <nav aria-label={t("Main navigation")} className="hidden flex-1 items-center justify-center lg:flex">
              <div className="flex items-center gap-0.5 xl:gap-4">
                <Link className={desktopLinkClassName(isHome)} to="/#home">
                  {t("Home")}
                </Link>
                <NavigationDropdown active={isShopActive} feature={shopFeature} label={t("Flavors")} links={shopLinks} subtitle={t("Browse signature creations and treats.")} />
                <NavigationDropdown active={isMenuActive} feature={menuFeature} label={t("Menu")} links={menuLinks} subtitle={t("Browse signature creations and treats.")} />
                <NavigationDropdown active={isEventsActive} feature={eventFeature} label={t("Events")} links={eventLinks} subtitle={t("Ice cream for birthdays, offices and celebrations")} />
                <Link className={desktopLinkClassName(location.pathname === "/about")} to="/about">
                  {t("About us")}
                </Link>
                <Link className={desktopLinkClassName(location.pathname === "/contact")} to="/contact">
                  {t("Contact")}
                </Link>
              </div>
            </nav>
          )}

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2 lg:ml-0">
            <div className="hidden sm:block">
              <LanguageDropdown language={language} setLanguage={setLanguage} t={t} />
            </div>
            {!isAdminPage && (
              <>
                <div className="hidden lg:block">
                  <AccountDropdown
                    customer={customer}
                    customerName={customerSecondName}
                    handleLogout={handleLogout}
                    location={location}
                    t={t}
                  />
                </div>
                <BagMenu
                  cartCount={cartCount}
                  cartItems={cartItems}
                  cartTotal={cartTotal}
                  language={language}
                  location={location}
                  t={t}
                />
                <Link
                  className="group hidden h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-brand-yellow px-3 text-[13px] font-extrabold leading-none text-brand-navy shadow-[0_8px_20px_rgba(255,220,50,0.25)] transition hover:-translate-y-0.5 hover:bg-brand-gold-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white lg:inline-flex xl:px-4 xl:text-sm"
                  to="/flavors"
                >
                  {t("Order now")}
                  <svg aria-hidden="true" className="size-4 transition group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24">
                    <path d="M5 12h14m-5-5 5 5-5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </Link>
                <button
                  aria-controls="mobile-navigation"
                  aria-expanded={isMobileMenuOpen}
                  aria-label={t(isMobileMenuOpen ? "Close menu" : "Open menu")}
                  className="grid size-11 place-items-center rounded-full bg-white/[0.08] text-white ring-1 ring-white/10 transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow lg:hidden"
                  onClick={(event) => {
                    closeOtherDropdowns(event);
                    setIsMobileMenuOpen((open) => !open);
                  }}
                  type="button"
                >
                  <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
                    {isMobileMenuOpen ? (
                      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                    ) : (
                      <path d="M4 7h16M4 12h10M4 17h16" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                    )}
                  </svg>
                </button>
              </>
            )}
          </div>
        </header>
        {!isAdminPage && logoutError && (
          <p className="mx-auto max-w-[1320px] px-4 pb-2 text-right text-xs text-red-200 sm:px-8 lg:px-12" role="alert">
            {logoutError}
          </p>
        )}
      </div>

      {!isAdminPage && isMobileMenuOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden" role="presentation">
          <button aria-label={t("Close menu")} className="site-drawer-backdrop absolute inset-0 bg-[#05162e]/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} tabIndex={-1} type="button" />
          <nav
            aria-label={t("Mobile navigation")}
            className="site-drawer-panel absolute inset-y-0 right-0 flex w-[min(24rem,88vw)] flex-col overflow-y-auto bg-brand-navy text-white shadow-[-24px_0_60px_rgba(71,42,59,0.45)]"
            id="mobile-navigation"
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
              <Link className="group flex items-center gap-3" onClick={() => setIsMobileMenuOpen(false)} to="/">
                <BrandMark compact />
                <span className="font-display text-lg font-extrabold leading-[0.95]">
                  Cold Stone
                  <span className="block text-brand-yellow">Creamery</span>
                </span>
              </Link>
              <button
                aria-label={t("Close menu")}
                className="grid size-10 place-items-center rounded-full bg-white/[0.08] transition hover:bg-white/15"
                onClick={() => setIsMobileMenuOpen(false)}
                type="button"
              >
                <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
                  <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                </svg>
              </button>
            </div>

            <div className="flex-1 space-y-0 px-5 py-5">
              <Link className={mobileLinkClassName(isHome)} onClick={() => setIsMobileMenuOpen(false)} to="/#home">
                {t("Home")}
              </Link>
              <NavigationDropdown active={isShopActive} label={t("Flavors")} links={shopLinks} mobile onNavigate={() => setIsMobileMenuOpen(false)} />
              <NavigationDropdown active={isMenuActive} label={t("Menu")} links={menuLinks} mobile onNavigate={() => setIsMobileMenuOpen(false)} />
              <NavigationDropdown active={isEventsActive} label={t("Events")} links={eventLinks} mobile onNavigate={() => setIsMobileMenuOpen(false)} />
              <Link className={mobileLinkClassName(location.pathname === "/about")} onClick={() => setIsMobileMenuOpen(false)} to="/about">
                {t("About us")}
              </Link>
              <Link className={mobileLinkClassName(location.pathname === "/contact")} onClick={() => setIsMobileMenuOpen(false)} to="/contact">
                {t("Contact")}
              </Link>
              <Link className={mobileLinkClassName(location.pathname === "/custom-cake")} onClick={() => setIsMobileMenuOpen(false)} to="/custom-cake">
                {t("Custom cake request")}
              </Link>
              <div className="mt-3 border-t border-white/10 pt-3">
                <AccountDropdown
                  customer={customer}
                  customerName={customerSecondName}
                  handleLogout={handleLogout}
                  location={location}
                  mobile
                  onNavigate={() => setIsMobileMenuOpen(false)}
                  t={t}
                />
              </div>
            </div>

            <div className="space-y-3 border-t border-white/10 p-4">
              <div aria-label={t("Select language")} className="flex rounded-md bg-[color:var(--brand-blue)] p-1 ring-1 ring-white/10" role="group">
                {[["en", "English"], ["fr", "Français"]].map(([code, label]) => (
                  <button
                    aria-pressed={language === code}
                    className={`min-h-11 flex-1 rounded-sm text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-yellow ${language === code ? "bg-brand-yellow text-brand-navy" : "text-white/75 hover:bg-white/[0.08] hover:text-white"}`}
                    key={code}
                    onClick={() => setLanguage(code)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <Link
                className="flex h-12 items-center justify-center gap-2 rounded-full bg-brand-yellow text-sm font-extrabold text-brand-navy transition hover:bg-brand-gold-light"
                onClick={() => setIsMobileMenuOpen(false)}
                to="/flavors"
              >
                {t("Order now")}
                <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
                  <path d="M5 12h14m-5-5 5 5-5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </Link>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}

function PromotionCountdown() {
  const { language, t } = useLanguage();
  const [promotion, setPromotion] = useState(readInitialPromotion);
  const [now, setNow] = useState(() => (promotion ? Date.now() : null));
  const [copied, setCopied] = useState(false);
  const [dismissedCode, setDismissedCode] = useState(() => {
    try {
      return sessionStorage.getItem(PROMOTION_DISMISSED_KEY) || "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    let cancelled = false;
    const loadPromotion = async () => {
      try {
        const result = await apiRequest("/promotions/active");
        if (!cancelled) {
          setNow(Date.now());
          setPromotion(result?.promotion || null);
        }
      } catch (error) {
        if (!cancelled) console.error("Unable to load the active promotion.", error);
      }
    };

    // The live page already includes the promotion in the HTML. Wait before asking again
    // so this request does not compete with the hero photo. Development has no embedded copy.
    const hasEmbeddedPromotion = Boolean(document.getElementById("initial-promotion"));
    const firstRefresh = hasEmbeddedPromotion ? null : window.setTimeout(loadPromotion, 0);
    const refreshInterval = window.setInterval(loadPromotion, 60_000);
    return () => {
      cancelled = true;
      if (firstRefresh !== null) window.clearTimeout(firstRefresh);
      window.clearInterval(refreshInterval);
    };
  }, []);

  const remaining = promotion && now !== null ? Date.parse(promotion.expiresAt) - now : NaN;
  const promoVisible = Boolean(
    promotion &&
    now !== null &&
    dismissedCode !== promotion.code &&
    Number.isFinite(remaining) &&
    remaining > 0,
  );

  useEffect(() => {
    if (!promotion) return undefined;
    const ticker = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(ticker);
  }, [promotion]);

  useEffect(() => {
    document.documentElement.toggleAttribute("data-promo-visible", promoVisible);
    return () => document.documentElement.removeAttribute("data-promo-visible");
  }, [promoVisible]);

  if (!promoVisible) return null;

  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  const numberFormat = new Intl.NumberFormat(language === "fr" ? "fr-FR" : "en-US");
  const discount = promotion.discountType === "percent"
    ? `${promotion.discountValue}% ${t("off")}`
    : `${numberFormat.format(promotion.discountValue)} FCFA ${t("off")}`;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(promotion.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  function dismiss() {
    setDismissedCode(promotion.code);
    try {
      sessionStorage.setItem(PROMOTION_DISMISSED_KEY, promotion.code);
    } catch {
      // The banner still hides for this page view when storage is unavailable.
    }
  }

  const clock = (value) => String(value).padStart(2, "0");
  const countdown = days > 0
    ? `${days}${t("d")} ${clock(hours)}${t("h")} ${clock(minutes)}${t("m")}`
    : `${clock(hours)}${t("h")} ${clock(minutes)}${t("m")} ${clock(seconds)}${t("s")}`;
  const minimum = promotion.minimumTotal > 0
    ? t("Minimum order: {count} items", { count: numberFormat.format(promotion.minimumTotal) })
    : "";

  return (
    <aside
      aria-label={t("Limited-time promotion")}
      className="relative z-[51] border-b border-brand-yellow-deep bg-brand-yellow text-brand-navy"
    >
      <div className="relative mx-auto flex max-w-[1320px] items-center gap-x-2 gap-y-1.5 px-3 py-2 pr-14 sm:gap-5 sm:px-8 sm:pr-8 lg:px-12">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 sm:gap-x-3">
          <div className="min-w-0 flex-1 basis-full sm:basis-auto">
            <p className="font-display text-lg font-extrabold leading-none tracking-[-0.03em] sm:text-2xl">
              {discount}
            </p>
            {minimum && (
              <p className="mt-1 text-[13px] font-medium leading-4 text-brand-blue sm:hidden">{minimum}</p>
            )}
          </div>
          {minimum && (
            <p className="hidden text-sm font-medium text-brand-blue sm:block">{minimum}</p>
          )}
          <button
            aria-label={t("Copy code {code}", { code: promotion.code })}
            className="order-2 mr-auto inline-flex min-h-9 max-w-full items-center truncate rounded-md bg-brand-navy px-2.5 text-sm font-bold text-brand-yellow outline-none! hover:bg-brand-blue focus-visible:outline-2! focus-visible:outline-offset-2 focus-visible:outline-brand-navy sm:order-none sm:mr-0"
            onClick={copyCode}
            type="button"
          >
            {copied ? t("Copied") : promotion.code}
          </button>
          <span className="sr-only" aria-live="polite">{copied ? t("Copied") : ""}</span>
          <p className="order-4 w-full text-xs font-semibold tabular-nums sm:order-none sm:ml-auto sm:w-auto sm:text-sm" role="timer">
            <span className="sr-only">{t("Offer countdown")}. </span>
            {t("Ends in")} {countdown}
          </p>
          <Link
            className="order-3 inline-flex min-h-9 items-center justify-self-end py-1 text-sm font-bold underline decoration-2 decoration-[#472a3b] underline-offset-4 outline-none! focus-visible:outline-2! focus-visible:outline-offset-2 focus-visible:outline-brand-navy sm:order-none sm:min-h-11 sm:ml-auto sm:py-0"
            to="/flavors"
          >
            {t("Shop offer")}
          </Link>
        </div>
        <button
          aria-label={t("Dismiss")}
          className="absolute right-1.5 top-1/2 grid size-11 -translate-y-1/2 shrink-0 place-items-center rounded-md text-brand-navy outline-none! hover:bg-brand-navy/10 focus-visible:outline-2! focus-visible:outline-offset-2 focus-visible:outline-brand-navy sm:relative sm:right-auto sm:top-auto sm:translate-y-0 sm:self-center"
          onClick={dismiss}
          type="button"
        >
          <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
            <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
          </svg>
        </button>
      </div>
    </aside>
  );
}


function InstagramGlyph({ className = "size-5" }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <rect height="18" rx="5" stroke="currentColor" strokeWidth="1.8" width="18" x="3" y="3" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.25" cy="6.75" fill="currentColor" r="1.1" />
    </svg>
  );
}

export function InstagramSection() {
  const { t } = useLanguage();
  const instagramUrl = "https://www.instagram.com/coldstonecameroon/";
  const instagramImages = [
    { alt: "Custom ice cream cake", src: "/cake-images/cake-9.webp" },
    { alt: "Celebration cake", src: "/cake-images/cake-4.webp" },
    { alt: "Milkshake", src: "/milk/mk-5.webp" },
    { alt: "Ice cream shake", src: "/ice-images/ice-2.jpg" },
    { alt: "Fruit smoothie", src: "/milk/mk-9.webp" },
  ];
  const [featured, ...feed] = instagramImages;

  return (
    <section
      aria-labelledby="instagram-heading"
      className="bg-[#f1f2ee] py-20 sm:py-24 lg:py-28"
    >
      <div className="mx-auto max-w-[1320px] px-5 sm:px-8 lg:px-12">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
          <h2
            className="max-w-[12em] font-display text-4xl font-extrabold leading-[0.95] tracking-[-0.03em] text-brand-navy sm:text-6xl"
            id="instagram-heading"
          >
            {t("A little more joy in your feed.")}
          </h2>
          <div className="flex max-w-sm flex-col items-start gap-6 lg:items-end lg:text-right">
            <p className="text-base font-medium leading-7 text-brand-navy sm:text-lg">
              {t("Get a glimpse of our latest creations and sweet moments.")}
            </p>
            <a
              className="inline-flex min-h-12 items-center gap-3 bg-brand-navy px-5 text-sm font-extrabold text-white transition duration-300 hover:bg-brand-yellow hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow focus-visible:ring-offset-2 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none"
              href={instagramUrl}
              rel="noreferrer"
              target="_blank"
            >
              <InstagramGlyph className="size-5" />
              @coldstonecameroon
            </a>
          </div>
        </div>

        <div className="instagram-grid mt-12 grid gap-2 sm:mt-14 sm:gap-3 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:items-stretch">
          <a
            aria-label={`${t(featured.alt)} — ${t("Visit Instagram")}`}
            className="instagram-photo group relative block aspect-[4/3] overflow-hidden bg-[#e7e8e4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-4 lg:aspect-auto lg:h-full"
            href={instagramUrl}
            rel="noreferrer"
            target="_blank"
          >
            <img
              alt={t(featured.alt)}
              className="size-full object-cover object-[center_35%] transition duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06] group-focus-visible:scale-[1.06] motion-reduce:transform-none motion-reduce:transition-none lg:absolute lg:inset-0 lg:h-full"
              decoding="async"
              loading="lazy"
              onError={photoErrorHandler(featured.src)}
              sizes="(min-width: 1024px) 55vw, 100vw"
              src={featured.src}
              srcSet={photoSrcSet(featured.src)}
            />
            <span
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 z-10 h-1 origin-left scale-x-0 bg-brand-yellow transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-100 group-focus-visible:scale-x-100 motion-reduce:transition-none"
            />
          </a>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {feed.map((image) => (
              <a
                aria-label={`${t(image.alt)} — ${t("Visit Instagram")}`}
                className="instagram-photo group relative block aspect-square overflow-hidden bg-[#e7e8e4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-4"
                href={instagramUrl}
                key={image.src}
                rel="noreferrer"
                target="_blank"
              >
                <img
                  alt={t(image.alt)}
                  className="size-full object-cover transition duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06] group-focus-visible:scale-[1.06] motion-reduce:transform-none motion-reduce:transition-none"
                  decoding="async"
                  loading="lazy"
                  onError={photoErrorHandler(image.src)}
                  sizes="(min-width: 1024px) 22vw, 50vw"
                  src={image.src}
                  srcSet={photoSrcSet(image.src)}
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 z-10 h-1 origin-left scale-x-0 bg-brand-yellow transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-100 group-focus-visible:scale-x-100 motion-reduce:transition-none"
                />
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  const { t } = useLanguage();
  const instagramUrl = "https://www.instagram.com/coldstonecameroon/";
  const linkGroups = [
    {
      title: t("Explore"),
      links: [
        { label: t("Menu"), to: "/menu" },
        { label: t("Flavors"), to: "/flavors" },
        { label: t("Locations"), to: "/locations" },
        { label: t("Custom cake requests"), to: "/custom-cake" },
        { label: t("Parties & events"), to: "/events" },
      ],
    },
    {
      title: t("Help"),
      links: [
        { label: t("About us"), to: "/about" },
        { label: t("Contact us"), to: "/contact" },
        { label: t("Shopping cart"), to: "/cart" },
        { label: t("My account"), to: "/account/orders" },
      ],
    },
  ];

  return (
    <footer className="bg-brand-navy text-white">
      <div className="mx-auto max-w-[1320px] px-5 sm:px-8 lg:px-12">
        <div className="flex flex-col gap-8 py-12 sm:flex-row sm:items-end sm:justify-between sm:py-14 lg:py-16">
          <div>
            <Link
              className="inline-flex items-center gap-4 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow focus-visible:ring-offset-4 focus-visible:ring-offset-brand-navy"
              to="/"
            >
              <img
                alt=""
                aria-hidden="true"
                className="size-14 shrink-0 rounded-full sm:size-16"
                decoding="async"
                height={64}
                loading="eager"
                src="/logo.png"
                width={64}
              />
              <span className="font-display text-3xl font-extrabold leading-none tracking-tight sm:text-4xl">
                Cold Stone Creamery
              </span>
            </Link>
            <p className="mt-4 max-w-xl text-base leading-7 text-white/70 sm:text-lg">
              {t("A little joy")} {t("in every scoop.")}
            </p>
          </div>
          <Link
            className="inline-flex min-h-12 w-fit items-center justify-center gap-3 rounded-lg bg-brand-yellow px-6 py-3 text-sm font-extrabold text-brand-navy transition-colors hover:bg-brand-gold-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy"
            to="/menu"
          >
            {t("Explore the menu")} <ArrowIcon />
          </Link>
        </div>

        <div className="grid gap-10 py-10 sm:grid-cols-2 lg:grid-cols-[1.45fr_1fr_1fr_1.15fr] lg:gap-12 lg:py-12">
          <div>
            <p className="max-w-sm text-sm leading-6 text-white/70 sm:text-base sm:leading-7">
              {t("Ice cream mixed to order on a frozen stone. Order online for pickup or delivery in Douala and Yaoundé.")}
            </p>
            <a
              className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-white/80 transition-colors hover:text-brand-yellow focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow focus-visible:ring-offset-4 focus-visible:ring-offset-brand-navy"
              href={instagramUrl}
              rel="noreferrer"
              target="_blank"
            >
              <InstagramGlyph className="size-4" />
              @coldstonecameroon
            </a>
          </div>

          {linkGroups.map((group) => (
            <nav aria-label={group.title} key={group.title}>
              <h2 className="text-base font-bold text-white">{group.title}</h2>
              <ul className="mt-4 grid gap-3">
                {group.links.map((link) => (
                  <li key={link.to}>
                    <Link
                      className="inline-flex min-h-6 items-center text-sm font-medium text-white/70 transition-colors hover:text-brand-yellow focus-visible:rounded-sm focus-visible:text-brand-yellow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow"
                      to={link.to}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div>
            <p className="max-w-xs text-sm leading-6 text-white/70">
              {t("Freshly made treats for pickup or delivery. Questions about an order? We are happy to help.")}
            </p>
            <Link
              className="mt-4 inline-flex min-h-10 items-center text-sm font-bold text-brand-yellow transition-colors hover:text-white focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow"
              to="/contact"
            >
              {t("Contact us")} <ArrowIcon />
            </Link>
          </div>
        </div>
      </div>

      <div className="bg-brand-navy">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-3 px-5 py-5 text-sm text-white/60 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12 border-t border-white/10">
          <p>© 2026 Cold Stone Creamery Cameroon. {t("All smiles reserved.")}</p>
          <button
            className="group inline-flex min-h-10 w-fit items-center gap-2 font-bold text-white/75 transition-colors hover:text-white focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow"
            onClick={() => window.scrollTo({ top: 0 })}
            type="button"
          >
            {t("Back to top")}
            <svg aria-hidden="true" className="size-4 transition-transform group-hover:-translate-y-0.5" fill="none" viewBox="0 0 24 24">
              <path d="M12 19V5m-6 6 6-6 6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
            </svg>
          </button>
        </div>
      </div>
    </footer>
  );
}

export { ArrowIcon };
