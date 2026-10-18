import { useEffect, useRef, useState } from "react";
import { photoErrorHandler, photoSrcSet, thumbnail } from "../lib/thumbnails";
import { Link, useLocation } from "react-router-dom";
import { apiRequest } from "../api/api";
import { useCart } from "../context/useCart";
import { useAuth } from "../context/useAuth";
import { useFlavors } from "../context/useFlavors";
import { useLanguage } from "../language/useLanguage";
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

function closeOtherDropdowns(event) {
  const current = event.currentTarget.closest("details");
  document.querySelectorAll("header details[open]").forEach((dropdown) => {
    if (dropdown !== current) dropdown.open = false;
  });
}

// How many flavor categories the "Flavors" dropdown lists after "All flavors".
const SHOP_DROPDOWN_TAG_LIMIT = 4;

function NavigationDropdown({ active, label, links, mobile = false, onNavigate, subtitle, icon = '✦', feature }) {
  const detailsRef = useRef(null);
  // Photos sit inside the closed menu, which is still on screen, so the browser would download
  // them with the page. Load them only after the menu is opened.
  const [showImages, setShowImages] = useState(false);
  const activeClass = active
    ? "border-[#ffdc32] text-[#ffdc32]"
    : "border-transparent text-white hover:border-[#ffdc32] hover:text-[#ffdc32]";

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
          className={`flex h-10 cursor-pointer list-none items-center justify-between gap-1.5 whitespace-nowrap rounded-full pl-1.5 pr-2.5 text-[13px] font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32] [&::-webkit-details-marker]:hidden ${
            active ? "bg-white/[0.12] text-[#ffdc32]" : "text-white/85 hover:bg-white/[0.08] hover:text-white group-open:bg-white/[0.1] group-open:text-white"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className={`grid size-6 place-items-center rounded-full text-[11px] ${active ? "bg-[#ffdc32] text-[#092a53]" : "bg-white/10 text-[#ffdc32]"}`}>{icon}</span>
            <span>{label}</span>
          </span>
          <svg aria-hidden="true" className="size-3 shrink-0 transition-transform duration-200 group-open:rotate-180" fill="none" viewBox="0 0 12 12">
            <path d="m2 4 4 4 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
          </svg>
        </summary>

        <div className="invisible absolute left-1/2 top-full z-30 w-[min(44rem,calc(100vw-2rem))] -translate-x-1/2 translate-y-2 pt-3 opacity-0 transition duration-200 ease-out group-open:visible group-open:translate-y-0 group-open:opacity-100">
          <div className="grid overflow-hidden rounded-[26px] bg-white p-2 text-sm text-[#092a53] shadow-[0_30px_80px_rgba(6,29,58,0.35),0_2px_8px_rgba(6,29,58,0.08)] ring-1 ring-black/[0.04] sm:grid-cols-[15rem_1fr]">
            {feature && (
              <Link
                className="group/feature relative isolate hidden min-h-[17rem] flex-col justify-end overflow-hidden rounded-[20px] bg-[#092a53] p-5 text-white sm:flex"
                onClick={closeAfterNavigate}
                to={feature.to}
              >
                {feature.image && showImages && (
                  <img decoding="async" alt="" className="absolute inset-0 -z-20 size-full object-cover transition duration-700 group-hover/feature:scale-[1.06]" loading="lazy" onError={photoErrorHandler(feature.image)} src={thumbnail(feature.image)} />
                )}
                <span aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-[#061d3a] via-[#061d3a]/60 to-[#061d3a]/10" />
                <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#ffdc32]">{label}</span>
                <span className="mt-2 font-display text-xl font-extrabold leading-tight">{feature.title}</span>
                {subtitle && <span className="mt-1.5 text-xs leading-5 text-white/70">{subtitle}</span>}
                <span className="mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-[#ffdc32] px-4 py-2 text-xs font-extrabold text-[#092a53] transition group-hover/feature:bg-white">
                  {feature.cta} <ArrowIcon />
                </span>
              </Link>
            )}

            <div className="p-2 sm:p-3">
              <p className="px-2 pb-2 pt-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#65748a]">{feature?.listTitle || label}</p>
              <ul className={`grid gap-1 ${links.length > 4 ? "sm:grid-cols-2" : ""}`}>
                {links.map((link) => (
                  <li key={link.to}>
                    <Link
                      className="group/link flex min-w-0 items-center gap-3 rounded-2xl p-2 pr-3 transition hover:bg-[#fbf6e3] focus-visible:bg-[#fbf6e3] focus-visible:outline-none"
                      onClick={closeAfterNavigate}
                      to={link.to}
                    >
                      {link.image && showImages ? (
                        <img decoding="async" alt="" aria-hidden="true" className="size-12 shrink-0 rounded-xl object-cover ring-1 ring-black/5 transition duration-300 group-hover/link:scale-[1.04]" loading="lazy" onError={photoErrorHandler(link.image, "/images/hero-ice-cream.jpg")} src={thumbnail(link.image, "tiny")} />
                      ) : (
                        <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#fff3b8] text-lg">{link.icon || "✦"}</span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 block text-sm font-extrabold leading-snug text-[#092a53]">{link.label}</span>
                        {link.meta && <span className="mt-0.5 block truncate text-xs font-semibold text-[#65748a]">{link.meta}</span>}
                      </span>
                      <span aria-hidden="true" className="grid size-7 shrink-0 -translate-x-1 place-items-center rounded-full text-[#8a7000] opacity-0 transition group-hover/link:translate-x-0 group-hover/link:opacity-100 group-focus-visible/link:translate-x-0 group-focus-visible/link:opacity-100">
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
        className={`flex cursor-pointer list-none items-center justify-between gap-2 border-b-2 transition-all duration-200 [&::-webkit-details-marker]:hidden ${
          mobile
            ? `min-h-12 rounded-2xl border-transparent px-4 text-base font-bold ${active ? "bg-[#ffdc32] text-[#092a53]" : "text-white hover:bg-white/[0.08] group-open:bg-white/[0.08]"}`
            : `whitespace-nowrap rounded-full border-transparent px-2.5 py-2 ${active ? "bg-white/[0.1] text-[#ffdc32]" : "text-white hover:bg-white/[0.07] hover:text-[#ffdc32]"} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32]`
        }`}
      >
        <span className="flex items-center gap-2">
          {!mobile && <span aria-hidden="true" className={`grid size-7 place-items-center rounded-lg text-sm ${active ? "bg-[#ffdc32] text-[#092a53]" : "bg-white/10 text-[#ffdc32]"}`}>{icon}</span>}
          <span>{label}</span>
        </span>
        <svg aria-hidden="true" className="size-3 shrink-0 transition-transform duration-200 group-open:rotate-180" fill="none" viewBox="0 0 12 12">
          <path d="m2 4 4 4 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        </svg>
      </summary>
      <div className={mobile
        ? "mt-2 grid gap-1 rounded-2xl border border-white/10 bg-[#061f40]/70 p-2"
        : `invisible absolute left-1/2 top-full z-30 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 translate-y-1 pt-3 opacity-0 transition duration-200 group-open:visible group-open:translate-y-0 group-open:opacity-100 ${links.length > 5 ? "lg:w-[min(38rem,calc(100vw-2rem))]" : ""}`
      }>
        <div className={mobile ? "grid gap-1" : "overflow-hidden rounded-2xl border border-[#e7e3d9] bg-white p-3 text-sm shadow-[0_20px_52px_rgba(9,42,83,0.2)] ring-1 ring-black/[0.02]"}>
          {!mobile && (
            <div className="mb-2 flex items-center justify-between gap-3 border-b border-[#eeeae1] px-2 pb-3 pt-1">
              <div>
                <p className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#8a7000]">{label}</p>
                {subtitle && <p className="mt-1 text-xs text-[#65748a]">{subtitle}</p>}
              </div>
              <span aria-hidden="true" className="grid size-9 place-items-center rounded-xl bg-[#fff3b8] text-[#806a00]">{icon}</span>
            </div>
          )}
          <div className={links.length > 5 && !mobile ? "grid gap-1 sm:grid-cols-2" : "grid gap-1"}>
            {links.map((link, index) => (
              <Link
                className={mobile
                  ? "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/85 transition hover:bg-white/10 hover:text-[#ffdc32]"
                  : "group/link flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[#52647b] transition hover:bg-[#fff9dc] hover:text-[#092a53] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#bd9c00]"
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
                  <img decoding="async" alt="" aria-hidden="true" className="size-10 shrink-0 rounded-xl object-cover ring-1 ring-white/10" loading="lazy" onError={photoErrorHandler(link.image, "/images/hero-ice-cream.jpg")} src={thumbnail(link.image, "tiny")} />
                ) : (
                  <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 text-sm font-extrabold text-[#ffdc32]">
                    {link.icon || String(index + 1).padStart(2, "0")}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{link.label}</span>
                  {link.meta && <span className="mt-0.5 block truncate text-xs text-white/50">{link.meta}</span>}
                </span>
                {!mobile && <span aria-hidden="true" className="translate-x-[-3px] text-[#8a7000] opacity-0 transition group-hover/link:translate-x-0 group-hover/link:opacity-100">→</span>}
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
        className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-white/25 bg-white/[0.06] py-1.5 pl-1.5 pr-3 text-xs font-bold text-white transition hover:border-white/50 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32] focus-visible:ring-offset-2 focus-visible:ring-offset-[#092a53] group-open:border-[#ffdc32]/60 group-open:bg-white/10 [&::-webkit-details-marker]:hidden sm:pr-3.5"
        onClick={closeOtherDropdowns}
      >
        <span aria-hidden="true" className="grid size-7 place-items-center rounded-full bg-[#ffdc32] text-[9px] font-extrabold tracking-tight text-[#092a53]">{activeLanguage.mark}</span>
        <span className="hidden xl:inline">{activeLanguage.nativeLabel}</span>
        <svg aria-hidden="true" className="size-3 text-white/70 transition-transform duration-200 group-open:rotate-180" fill="none" viewBox="0 0 12 12">
          <path d="m2 4 4 4 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        </svg>
      </summary>
      <div className="invisible absolute right-0 top-full z-30 w-72 translate-y-2 pt-3 opacity-0 transition duration-200 ease-out group-open:visible group-open:translate-y-0 group-open:opacity-100">
        <div className="overflow-hidden rounded-[22px] bg-white p-2 text-sm text-[#092a53] shadow-[0_30px_80px_rgba(6,29,58,0.35),0_2px_8px_rgba(6,29,58,0.08)] ring-1 ring-black/[0.04]">
          <div className="flex items-center gap-3 px-3 pb-3 pt-2">
            <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-[#fbf6e3] text-[#8a7000]">
              <svg className="size-4" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </span>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#65748a]">{t("Select language")}</p>
          </div>
          <div className="grid gap-1" role="group" aria-label={t("Select language")}>
            {languages.map(({ value, nativeLabel, code, region }) => {
              const selected = language === value;
              return (
                <button
                  aria-pressed={selected}
                  className={`group/lang flex w-full items-center gap-3 rounded-2xl p-2.5 pr-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#bd9c00] ${
                    selected ? "bg-[#092a53] text-white" : "hover:bg-[#fbf6e3]"
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
                  <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-xl font-display text-xs font-extrabold tracking-wide ${
                    selected ? "bg-[#ffdc32] text-[#092a53]" : "bg-[#f4f1e8] text-[#52647b] group-hover/lang:bg-white"
                  }`}>{code}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-extrabold">{nativeLabel}</span>
                    <span className={`mt-0.5 block text-[11px] font-semibold ${selected ? "text-white/60" : "text-[#65748a]"}`}>{region}</span>
                  </span>
                  <span aria-hidden="true" className={`grid size-5 shrink-0 place-items-center rounded-full ring-2 ${selected ? "bg-[#ffdc32] ring-[#ffdc32]" : "ring-[#ddd6c4]"}`}>
                    {selected && <span className="size-2 rounded-full bg-[#092a53]" />}
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
      <span aria-hidden="true" className={`${size} grid shrink-0 place-items-center rounded-full bg-[#ffdc32] font-display font-extrabold text-[#092a53]`}>
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
          className={`flex cursor-pointer list-none items-center gap-2 rounded-full py-1.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32] md:text-sm [&::-webkit-details-marker]:hidden ${
            customer ? "pl-1.5 pr-3" : "px-3"
          } ${accountActive ? "bg-white/[0.1] text-[#ffdc32]" : "text-white hover:bg-white/[0.07] group-open:bg-white/[0.1]"}`}
          aria-label={t("Account")}
          onClick={closeOtherDropdowns}
        >
          {customer ? (
            <span className="relative">
              {avatar("size-8 text-xs ring-2 ring-white/20")}
              <span aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-[#4caf50] ring-2 ring-[#092a53]" />
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

        <div className="invisible absolute right-0 top-full z-30 w-80 translate-y-2 pt-3 opacity-0 transition duration-200 ease-out group-open:visible group-open:translate-y-0 group-open:opacity-100">
          <div className="overflow-hidden rounded-[24px] bg-white text-sm text-[#092a53] shadow-[0_30px_80px_rgba(6,29,58,0.35),0_2px_8px_rgba(6,29,58,0.08)] ring-1 ring-black/[0.04]">
            {customer ? (
              <>
                <div className="relative isolate flex items-center gap-4 overflow-hidden bg-[#092a53] p-5 text-white">
                  <span aria-hidden="true" className="absolute -right-10 -top-12 -z-10 size-36 rounded-full border-[22px] border-white/[0.06]" />
                  {avatar("size-14 text-lg ring-4 ring-white/10")}
                  <div className="min-w-0">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#ffdc32]">{t("Welcome back")}</p>
                    <p className="mt-1 truncate font-display text-lg font-extrabold leading-tight">{customerName || customer.name || t("Account")}</p>
                    <p className="truncate text-xs text-white/60">{customer.email}</p>
                  </div>
                </div>
                <nav aria-label={t("Account")} className="grid gap-1 p-2">
                  {menuItems.map((item) => {
                    const current = location.pathname === item.to;
                    return (
                      <Link
                        aria-current={current ? "page" : undefined}
                        className={`group/item flex items-center gap-3 rounded-2xl p-2.5 pr-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#bd9c00] ${
                          current ? "bg-[#fbf6e3]" : "hover:bg-[#fbf6e3]"
                        }`}
                        key={item.to}
                        onClick={closeDropdown}
                        to={item.to}
                      >
                        <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-xl transition ${current ? "bg-[#ffdc32] text-[#092a53]" : "bg-[#f4f1e8] text-[#52647b] group-hover/item:bg-white group-hover/item:text-[#092a53]"}`}>
                          <svg className="size-[18px]" fill="none" viewBox="0 0 24 24">{item.icon}</svg>
                        </span>
                        <span className="flex-1 font-extrabold">{item.label}</span>
                        <span aria-hidden="true" className="-translate-x-1 text-[#8a7000] opacity-0 transition group-hover/item:translate-x-0 group-hover/item:opacity-100">
                          <ArrowIcon />
                        </span>
                      </Link>
                    );
                  })}
                </nav>
                <div className="border-t border-[#efece3] p-2">
                  <button
                    className="group/logout flex w-full items-center gap-3 rounded-2xl p-2.5 text-left font-extrabold text-[#52647b] transition hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-300"
                    onClick={(event) => {
                      closeDropdown(event);
                      handleLogout();
                    }}
                    type="button"
                  >
                    <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f4f1e8] transition group-hover/logout:bg-red-100">
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
                <span aria-hidden="true" className="grid size-12 place-items-center rounded-2xl bg-[#ffdc32] text-[#092a53]">
                  <svg className="size-6" fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="8.5" r="3.5" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
                  </svg>
                </span>
                <p className="mt-4 font-display text-xl font-extrabold leading-tight">{t("Welcome")}</p>
                <p className="mt-1.5 text-xs leading-5 text-[#65748a]">{t("Sign in to see your orders and favorites.")}</p>
                <div className="mt-5 grid gap-2">
                  <Link
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#092a53] px-5 py-3 text-sm font-extrabold text-white transition hover:bg-[#163e6b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2"
                    onClick={closeDropdown}
                    to="/login"
                  >
                    {t("Log in")} <ArrowIcon />
                  </Link>
                  <Link
                    className="inline-flex items-center justify-center rounded-full border border-[#d9d4c7] px-5 py-3 text-sm font-extrabold text-[#092a53] transition hover:border-[#092a53] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2"
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
            ? `min-h-12 justify-between rounded-2xl border-transparent px-4 text-base font-bold ${accountActive ? "bg-[#ffdc32] text-[#092a53]" : "text-white hover:bg-white/[0.08] group-open:bg-white/[0.08]"}`
            : `gap-2 rounded-full border-transparent px-2 py-1.5 text-xs font-bold text-white hover:border-white/25 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32] md:text-sm ${accountActive ? "bg-white/[0.1] text-[#ffdc32]" : ""}`
        }`}
        onClick={closeOtherDropdowns}
      >
        {customer && !mobile && (
          customer.profilePicture
            ? <img decoding="async" loading="lazy" alt="" className="size-8 rounded-full border border-white/30 object-cover" src={customer.profilePicture} />
            : <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-[#ffdc32] text-xs font-extrabold text-[#092a53]">{(customer.name || "A").charAt(0).toUpperCase()}</span>
        )}
        <span className={mobile ? "hidden" : "hidden md:inline"}>{t("Account")}</span>
        {mobile && <span className="flex min-w-0 items-center gap-2">
          {customer && (customer.profilePicture
            ? <img decoding="async" loading="lazy" alt="" className="size-8 rounded-full border border-white/30 object-cover" src={customer.profilePicture} />
            : <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-[#ffdc32] text-xs font-extrabold text-[#092a53]">{(customer.name || "A").charAt(0).toUpperCase()}</span>)}
          <span className="truncate">{customer ? customerName || t("Account") : t("Account")}</span>
        </span>}
        <svg aria-hidden="true" className="size-3 shrink-0 transition-transform duration-200 group-open:rotate-180" fill="none" viewBox="0 0 12 12">
          <path d="m2 4 4 4 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        </svg>
      </summary>
      <div className={mobile
        ? "mt-2 grid gap-1 rounded-2xl border border-white/10 bg-[#061f40]/70 p-2"
        : "invisible absolute right-0 top-full z-30 w-64 translate-y-1 pt-3 opacity-0 transition duration-200 group-open:visible group-open:translate-y-0 group-open:opacity-100"
      }>
        <div className={mobile ? "grid gap-1" : "overflow-hidden rounded-2xl border border-[#e7e3d9] bg-white p-2 text-sm shadow-[0_18px_48px_rgba(9,42,83,0.2)] ring-1 ring-black/[0.02]"}>
          {customer && (
            <div className={mobile
              ? "mb-1 flex min-w-0 items-center gap-3 rounded-xl border-b border-white/10 px-2 py-3"
              : "mb-1 flex min-w-0 items-center gap-3 rounded-xl bg-[#f8f7f2] px-3 py-3"
            }>
              {customer.profilePicture
                ? <img decoding="async" loading="lazy" alt="" className="size-10 shrink-0 rounded-full object-cover" src={customer.profilePicture} />
                : <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-[#ffdc32] text-sm font-extrabold text-[#092a53]">{(customer.name || "A").charAt(0).toUpperCase()}</span>}
              <div className="min-w-0">
                <p className={`truncate text-sm font-extrabold ${mobile ? "text-white" : "text-[#092a53]"}`}>{customerName || t("Account")}</p>
                <p className={`truncate text-[10px] ${mobile ? "text-white/60" : "text-[#65748a]"}`}>{customer.email}</p>
              </div>
            </div>
          )}
          {options.map((option) => (
            <Link
              aria-current={location.pathname === option.to ? "page" : undefined}
              className={mobile
                ? `flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${location.pathname === option.to ? "bg-white/10 font-extrabold text-[#ffdc32]" : "text-white/85 hover:bg-white/10 hover:text-white"}`
                : `flex items-center gap-3 rounded-xl px-3 py-3 text-left transition ${location.pathname === option.to ? "bg-[#fff8dc] font-extrabold text-[#806a00]" : "font-semibold text-[#52647b] hover:bg-[#f8f7f2] hover:text-[#092a53]"}`
              }
              key={option.to}
              onClick={closeDropdown}
              to={option.to}
            >
              <span aria-hidden="true" className={`grid size-9 shrink-0 place-items-center rounded-xl ${mobile ? "bg-white/10" : "bg-[#edf3f9]"} ${location.pathname === option.to ? "text-[#806a00]" : mobile ? "text-white" : "text-[#092a53]"}`}>
                {customer ? "▤" : option.to === "/login" ? "↪" : "＋"}
              </span>
              <span className="min-w-0 flex-1">{option.label}</span>
              {location.pathname === option.to && <span aria-hidden="true" className="text-xs">✓</span>}
            </Link>
          ))}
          {customer && (
            <button
              aria-label={t("Log out")}
              className={mobile
                ? "mt-1 flex w-full items-center gap-3 rounded-xl border-t border-white/10 px-3 py-3 text-left text-sm text-white/75 transition hover:bg-red-500/15 hover:text-white"
                : "mt-1 flex w-full items-center gap-3 rounded-xl border-t border-[#eeeae1] px-3 py-3 text-left font-semibold text-[#65748a] transition hover:bg-red-50 hover:text-red-700"
              }
              onClick={(event) => {
                closeDropdown(event);
                handleLogout();
              }}
              type="button"
            >
              <span aria-hidden="true" className={`grid size-9 shrink-0 place-items-center rounded-xl ${mobile ? "bg-white/10" : "bg-[#f1f3f5]"}`}>↪</span>
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
  const { cartCount } = useCart();
  const { customer, logout } = useAuth();
  const { flavors } = useFlavors();
  const { language, setLanguage, t } = useLanguage();
  const location = useLocation();
  const headerRef = useRef(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const { isScrolled, isHidden } = useHeaderVisibility(headerRef);

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
    `relative inline-flex h-10 items-center whitespace-nowrap rounded-full px-2 text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32] xl:px-2.5 ${
      isActive
        ? "bg-white/[0.12] text-[#ffdc32] after:absolute after:bottom-1 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-[#ffdc32]"
        : "text-white/85 hover:bg-white/[0.08] hover:text-white"
    }`;
  const mobileLinkClassName = (isActive) =>
    `flex min-h-12 items-center justify-between rounded-2xl px-4 text-base font-bold transition ${
      isActive ? "bg-[#ffdc32] text-[#092a53]" : "text-white hover:bg-white/[0.08]"
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
      {!isAdminPage && <PromotionCountdown />}
      <div
        className={`sticky top-0 z-50 transition-[transform,background-color,box-shadow] duration-300 ${isHidden && !isMobileMenuOpen ? "-translate-y-full" : "translate-y-0"} ${
          isScrolled ? "bg-[#092a53] shadow-[0_10px_30px_rgba(5,22,46,0.28)]" : "bg-[#092a53]"
        }`}
        ref={headerRef}
      >
        <div aria-hidden="true" className={`pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent transition-opacity ${isScrolled ? "opacity-100" : "opacity-0"}`} />
        <header className={`relative mx-auto flex max-w-[1320px] items-center gap-2 px-4 text-white transition-[height] duration-300 sm:px-6 lg:gap-2 lg:px-3 xl:gap-4 xl:px-12 ${isScrolled ? "h-[68px]" : "h-[80px]"}`}>
          <Link aria-label="Cold Stone Creamery Cameroon home" className="group flex shrink-0 items-center gap-3 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32]" to="/">
            <BrandMark compact={isScrolled} />
            <span className="font-display text-[18px] font-extrabold leading-[0.95] tracking-tight text-white sm:text-[19px]">
              Cold Stone
              <span className="block text-[#ffdc32]">Creamery</span>
            </span>
          </Link>

          {!isAdminPage && (
            <nav aria-label={t("Main navigation")} className="hidden flex-1 items-center justify-center lg:flex">
              <div className="flex items-center gap-0.5 rounded-full bg-white/[0.05] p-1 ring-1 ring-white/10 xl:gap-3">
                <Link className={desktopLinkClassName(isHome)} to="/#home">
                  {t("Home")}
                </Link>
                <NavigationDropdown active={isShopActive} feature={shopFeature} icon="▤" label={t("Flavors")} links={shopLinks} subtitle={t("Browse signature creations and treats.")} />
                <NavigationDropdown active={isMenuActive} feature={menuFeature} icon="🍦" label={t("Menu")} links={menuLinks} subtitle={t("Browse signature creations and treats.")} />
                <NavigationDropdown active={isEventsActive} feature={eventFeature} icon="🎂" label={t("Events")} links={eventLinks} subtitle={t("Ice cream for birthdays, offices and celebrations")} />
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
                <Link
                  aria-label={t("Shopping bag, {count} items", { count: cartCount })}
                  className={`relative grid size-11 shrink-0 place-items-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32] ${
                    location.pathname === "/cart" ? "bg-[#ffdc32] text-[#092a53]" : "text-white hover:bg-white/10"
                  }`}
                  to="/cart"
                >
                  <BagIcon />
                  {cartCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#ffdc32] px-1 text-[10px] font-extrabold text-[#092a53] ring-2 ring-[#092a53]">
                      {cartCount > 99 ? "99+" : cartCount}
                    </span>
                  )}
                </Link>
                <Link
                  className="group hidden h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-[#ffdc32] px-3 text-[13px] font-extrabold leading-none text-[#092a53] shadow-[0_8px_20px_rgba(255,220,50,0.25)] transition hover:-translate-y-0.5 hover:bg-[#ffe665] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white lg:inline-flex xl:px-4 xl:text-sm"
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
                  className="grid size-11 place-items-center rounded-full bg-white/[0.08] text-white ring-1 ring-white/10 transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32] lg:hidden"
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
            className="site-drawer-panel absolute inset-y-0 right-0 flex w-[min(24rem,88vw)] flex-col overflow-y-auto bg-[#092a53] text-white shadow-[-24px_0_60px_rgba(5,22,46,0.4)]"
            id="mobile-navigation"
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
              <Link className="group flex items-center gap-3" onClick={() => setIsMobileMenuOpen(false)} to="/">
                <BrandMark compact />
                <span className="font-display text-lg font-extrabold leading-[0.95]">
                  Cold Stone
                  <span className="block text-[#ffdc32]">Creamery</span>
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

            <div className="flex-1 space-y-2.5 px-3 py-4">
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
              <div aria-label={t("Select language")} className="flex rounded-full bg-white/[0.06] p-1 ring-1 ring-white/10" role="group">
                {[["en", "English"], ["fr", "Français"]].map(([code, label]) => (
                  <button
                    aria-pressed={language === code}
                    className={`flex-1 rounded-full py-2 text-sm font-bold transition ${language === code ? "bg-white text-[#092a53]" : "text-white/70 hover:text-white"}`}
                    key={code}
                    onClick={() => setLanguage(code)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <Link
                className="flex h-12 items-center justify-center gap-2 rounded-full bg-[#ffdc32] text-sm font-extrabold text-[#092a53] transition hover:bg-[#ffe665]"
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

const PROMOTION_DISMISSED_KEY = "cold-stone-promotion-dismissed";

// The server sends the active promotion with the page (server/seo.js), so the bar is there from
// the first paint instead of pushing the page down a moment later.
function readInitialPromotion() {
  try {
    const data = document.getElementById("initial-promotion")?.textContent;
    return data ? JSON.parse(data).promotion || null : null;
  } catch {
    return null;
  }
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
    const firstRefresh = window.setTimeout(loadPromotion, hasEmbeddedPromotion ? 15_000 : 0);
    const refreshInterval = window.setInterval(loadPromotion, 60_000);
    return () => {
      cancelled = true;
      window.clearTimeout(firstRefresh);
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
  const units = [
    [days, t("d")],
    [hours, t("h")],
    [minutes, t("m")],
    [seconds, t("s")],
  ].filter(([value], index) => index > 0 || value > 0);

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

  return (
    <aside
      aria-label={t("Limited-time promotion")}
      className="relative z-[51] overflow-hidden bg-gradient-to-r from-[#ffdc32] via-[#ffe566] to-[#ffdc32] text-[#092a53]"
    >
      <div aria-hidden="true" className="promo-shimmer pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/45 to-transparent" />
      <div className="relative mx-auto flex min-h-11 max-w-[1320px] items-center gap-2 px-3 py-1.5 sm:gap-4 sm:px-8 lg:px-12">
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2 sm:gap-3">
          <span className="hidden shrink-0 rounded-full bg-[#092a53] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#ffdc32] sm:inline-flex">
            {t("Limited-time offer")}
          </span>
          <p className="min-w-0 truncate text-[13px] font-extrabold sm:text-sm">
            {discount}
            {promotion.minimumTotal > 0 && (
              <span className="hidden font-semibold text-[#092a53]/70 md:inline">
                {" · "}{t("Minimum order: {count} items", { count: numberFormat.format(promotion.minimumTotal) })}
              </span>
            )}
          </p>
          <button
            aria-label={t("Copy code {code}", { code: promotion.code })}
            className="group inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-dashed border-[#092a53]/40 bg-white/70 px-2 py-1 font-mono text-xs font-extrabold tracking-wider transition hover:border-[#092a53] hover:bg-white"
            onClick={copyCode}
            title={t("Copy")}
            type="button"
          >
            {promotion.code}
            <svg aria-hidden="true" className="size-3.5 opacity-60 transition group-hover:opacity-100" fill="none" viewBox="0 0 24 24">
              <path d={copied ? "m5 12.5 4.5 4.5L19 7.5" : "M9 9h10v10H9V9Zm-4 6V5h10"} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </button>
          <span className="sr-only" aria-live="polite">{copied ? t("Copied") : ""}</span>
          <div aria-label={t("Offer countdown")} className="hidden shrink-0 items-center gap-1 sm:flex" role="timer">
            <span className="mr-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#092a53]/60">{t("Ends in")}</span>
            {units.map(([value, label]) => (
              <span className="inline-flex min-w-[2.4rem] items-baseline justify-center gap-0.5 rounded-md bg-[#092a53] px-1.5 py-0.5 font-mono text-xs font-bold tabular-nums text-white" key={label}>
                {String(value).padStart(2, "0")}
                <span className="text-[9px] font-semibold text-[#ffdc32]">{label}</span>
              </span>
            ))}
          </div>
          <Link className="hidden shrink-0 items-center gap-1 text-xs font-extrabold underline decoration-2 underline-offset-4 transition hover:decoration-[#092a53]/40 lg:inline-flex" to="/flavors">
            {t("Shop offer")}
            <svg aria-hidden="true" className="size-3.5" fill="none" viewBox="0 0 24 24">
              <path d="M5 12h14m-5-5 5 5-5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </Link>
        </div>
        <button
          aria-label={t("Dismiss")}
          className="grid size-8 shrink-0 place-items-center rounded-full text-[#092a53]/70 transition hover:bg-[#092a53]/10 hover:text-[#092a53]"
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
    { alt: "Celebration cake", src: "/cake-images/cake-4.webp" },
    { alt: "Milkshake", src: "/milk/mk-5.webp" },
    { alt: "Ice cream shake", src: "/ice-images/ice-2.jpg" },
    { alt: "Custom ice cream cake", src: "/cake-images/cake-9.webp" },
    { alt: "Fruit smoothie", src: "/milk/mk-9.webp" },
  ];

  return (
    <section
      aria-labelledby="instagram-heading"
      className="relative isolate overflow-hidden border-t border-[#eeeae1] bg-[#fbfaf5] py-20 sm:py-24"
    >
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-40 -z-10 size-[32rem] rounded-full bg-[radial-gradient(closest-side,rgb(255_220_50/0.15),rgb(255_220_50/0.15)_35%,transparent)]" />
      {/* Same width and side padding as the page content above, so the edges line up. */}
      <div className="mx-auto max-w-[1320px] px-5 sm:px-8 lg:px-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#8a7000]">
              <span aria-hidden="true" className="h-px w-10 bg-[#a48700]" />
              {t("Sweet moments, shared.")}
            </p>
            <h2
              className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-[#092a53] sm:text-5xl"
              id="instagram-heading"
            >
              {t("A little more joy in your feed.")}
            </h2>
            <p className="mt-4 max-w-lg text-base leading-7 text-[#52647b]">
              {t("Get a glimpse of our latest creations and sweet moments.")}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-start gap-4 sm:flex-row sm:items-center md:flex-col md:items-end lg:flex-row lg:items-center">
            <a
              className="group flex items-center gap-3 rounded-full border border-[#e5e1d7] bg-white py-2 pl-2 pr-5 shadow-sm transition hover:border-[#d9c76d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] focus-visible:ring-offset-2"
              href={instagramUrl}
              rel="noreferrer"
              target="_blank"
            >
              <span className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-[#ffdc32] via-[#f56586] to-[#7b4bd8] p-[2px]">
                <span className="grid size-full place-items-center rounded-full bg-white text-[#092a53]">
                  <InstagramGlyph className="size-[18px]" />
                </span>
              </span>
              <span className="leading-tight">
                <span className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#8a7000]">{t("Follow the fun.")}</span>
                <span className="block text-sm font-extrabold text-[#092a53]">@coldstonecameroon</span>
              </span>
            </a>
            <a
              className="inline-flex items-center gap-2 rounded-full bg-[#092a53] px-6 py-3.5 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(9,42,83,0.2)] transition hover:-translate-y-0.5 hover:bg-[#163e6b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2"
              href={instagramUrl}
              rel="noreferrer"
              target="_blank"
            >
              {t("Visit Instagram")}
              <ArrowIcon diagonal />
            </a>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:grid-rows-2 lg:gap-5">
          {instagramImages.map((image, index) => (
            <a
              aria-label={`${t(image.alt)} — ${t("Visit Instagram")}`}
              className={`group relative overflow-hidden rounded-[22px] bg-[#fff3b8] shadow-[0_10px_30px_rgba(9,42,83,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] focus-visible:ring-offset-4 lg:rounded-[26px] ${
                index === 0 ? "col-span-2 aspect-[4/3] lg:row-span-2 lg:aspect-auto" : "aspect-square"
              }`}
              href={instagramUrl}
              key={image.src}
              rel="noreferrer"
              target="_blank"
            >
              <img decoding="async"
                alt={t(image.alt)}
                className="size-full object-cover transition duration-700 ease-out group-hover:scale-[1.06]"
                loading="lazy"
                onError={photoErrorHandler(image.src)}
                sizes={index === 0 ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1024px) 25vw, 50vw"}
                src={image.src}
                srcSet={photoSrcSet(image.src)}
              />
              <span
                aria-hidden="true"
                className="absolute inset-0 grid place-items-center bg-[#092a53]/0 transition duration-300 group-hover:bg-[#092a53]/45 group-focus-visible:bg-[#092a53]/45"
              >
                <span className="grid size-12 scale-75 place-items-center rounded-full bg-white text-[#092a53] opacity-0 shadow-lg transition duration-300 group-hover:scale-100 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100">
                  <InstagramGlyph />
                </span>
              </span>
            </a>
          ))}
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
    <footer className="relative isolate overflow-hidden bg-[#061f40] text-white">
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-40 -z-10 size-[34rem] rounded-full bg-[radial-gradient(closest-side,rgb(255_220_50/0.08),rgb(255_220_50/0.08)_35%,transparent)]" />
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#ffdc32] via-[#ffdc32]/60 to-transparent" />

      <div className="mx-auto max-w-[1320px] px-5 sm:px-8 lg:px-12">
        {/* Brand statement */}
        <div className="flex flex-col gap-8 border-b border-white/10 py-14 md:flex-row md:items-end md:justify-between lg:py-16">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#ffdc32]">
              <span aria-hidden="true" className="h-px w-10 bg-[#ffdc32]" />
              {t("Made for ice cream lovers in Cameroon.")}
            </p>
            <p className="mt-5 font-display text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-5xl">
              {t("A little joy")} <span className="text-[#ffdc32]">{t("in every scoop.")}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="inline-flex items-center gap-2 rounded-full bg-[#ffdc32] px-6 py-3.5 text-sm font-extrabold text-[#092a53] transition hover:-translate-y-0.5 hover:bg-[#ffe76c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32] focus-visible:ring-offset-2 focus-visible:ring-offset-[#061f40]"
              to="/menu"
            >
              {t("Explore the menu")} <ArrowIcon />
            </Link>
            <a
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3.5 text-sm font-extrabold text-white transition hover:-translate-y-0.5 hover:border-white hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              href={instagramUrl}
              rel="noreferrer"
              target="_blank"
            >
              <InstagramGlyph className="size-4" /> {t("Visit Instagram")}
            </a>
          </div>
        </div>

        {/* Columns */}
        <div className="grid gap-12 py-14 sm:grid-cols-2 lg:grid-cols-12 lg:gap-10">
          <div className="sm:col-span-2 lg:col-span-5">
            <Link
              className="inline-flex items-center gap-3 rounded-2xl transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32] focus-visible:ring-offset-4 focus-visible:ring-offset-[#061f40]"
              to="/"
            >
              <img decoding="async" loading="eager" alt="" aria-hidden="true" className="size-14 shrink-0 rounded-full shadow-[0_8px_20px_rgba(0,0,0,0.3)]" height={56} src="/logo.png" width={56} />
              <span className="font-display text-xl font-extrabold leading-[0.95]">
                Cold Stone
                <br />
                <span className="text-[#ffdc32]">Creamery</span>
              </span>
            </Link>
            <p className="mt-6 max-w-sm text-sm leading-6 text-white/60">
              {t("Ice cream mixed to order on a frozen stone. Order online for pickup or delivery in Douala and Yaoundé.")}
            </p>
            <a
              className="group mt-6 inline-flex items-center gap-3 rounded-full bg-white/[0.06] py-1.5 pl-1.5 pr-4 ring-1 ring-white/10 transition hover:bg-white/10 hover:ring-[#ffdc32]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32]"
              href={instagramUrl}
              rel="noreferrer"
              target="_blank"
            >
              <span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-[#ffdc32] via-[#f56586] to-[#7b4bd8] p-[2px]">
                <span className="grid size-full place-items-center rounded-full bg-[#061f40] text-white">
                  <InstagramGlyph className="size-4" />
                </span>
              </span>
              <span className="leading-tight">
                <span className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#ffdc32]">{t("Official local pages")}</span>
                <span className="block text-sm font-bold">@coldstonecameroon</span>
              </span>
            </a>
          </div>

          {linkGroups.map((group) => (
            <nav aria-label={group.title} className="lg:col-span-2" key={group.title}>
              <h2 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/45">{group.title}</h2>
              <ul className="mt-5 grid gap-3.5">
                {group.links.map((link) => (
                  <li key={link.to}>
                    <Link
                      className="group inline-flex items-center text-sm font-semibold text-white/80 transition hover:text-[#ffdc32] focus-visible:text-[#ffdc32] focus-visible:outline-none"
                      to={link.to}
                    >
                      <span aria-hidden="true" className="h-px w-0 bg-[#ffdc32] transition-all duration-300 group-hover:mr-2 group-hover:w-3" />
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div className="sm:col-span-2 lg:col-span-3">
            <div className="rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-white/10">
              <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-[#ffdc32]/15 font-display text-sm font-extrabold text-[#ffdc32]">✦</span>
              <p className="mt-3 text-xs leading-5 text-white/60">
                {t("Freshly made treats for pickup or delivery. Questions about an order? We are happy to help.")}
              </p>
              <Link className="mt-3 inline-flex items-center gap-1.5 text-xs font-extrabold text-[#ffdc32] hover:underline" to="/contact">
                {t("Contact us")} <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col gap-4 border-t border-white/10 py-6 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Cold Stone Creamery Cameroon. {t("All smiles reserved.")}</p>
          <button
            className="group inline-flex w-fit items-center gap-2 rounded-full px-3 py-2 font-bold text-white/70 transition hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32]"
            onClick={() => window.scrollTo({ top: 0 })}
            type="button"
          >
            {t("Back to top")}
            <span aria-hidden="true" className="grid size-7 place-items-center rounded-full bg-white/10 transition group-hover:-translate-y-0.5 group-hover:bg-[#ffdc32] group-hover:text-[#092a53]">
              <svg className="size-3.5" fill="none" viewBox="0 0 24 24">
                <path d="M12 19V5m-6 6 6-6 6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
              </svg>
            </span>
          </button>
        </div>
      </div>

      <p
        aria-hidden="true"
        className="pointer-events-none -mb-[0.22em] select-none overflow-hidden whitespace-nowrap text-center font-display text-[clamp(4rem,17vw,15rem)] font-extrabold leading-none tracking-tight text-white/[0.04]"
      >
        Cold Stone
      </p>
    </footer>
  );
}

export { ArrowIcon };
