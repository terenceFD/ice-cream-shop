import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useCart } from "../CartContext";
import { useAuth } from "../authcontext/AuthContext";
import { useFlavors } from "../flavor-context/FlavorContext";
import { useLanguage } from "../language/LanguageContext";
import { coldStoneMenuCategories } from "../data";

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

function NavigationDropdown({ active, label, links, mobile = false, onNavigate, subtitle, icon = '✦' }) {
  const activeClass = active
    ? "border-[#ffdc32] text-[#ffdc32]"
    : "border-transparent text-white hover:border-[#ffdc32] hover:text-[#ffdc32]";

  return (
    <details className={`group relative ${mobile ? "col-span-2" : ""}`}>
      <summary
        onClick={closeOtherDropdowns}
        className={`flex cursor-pointer list-none items-center justify-between gap-2 border-b-2 transition-all duration-200 [&::-webkit-details-marker]:hidden ${
          mobile
            ? `rounded-xl px-3 py-2.5 ${activeClass}`
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
                <p className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#a48700]">{label}</p>
                {subtitle && <p className="mt-1 text-xs text-[#8792a0]">{subtitle}</p>}
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
                <span aria-hidden="true" className={`grid size-9 shrink-0 place-items-center rounded-xl text-sm font-extrabold transition ${mobile ? "bg-white/10 text-[#ffdc32]" : "bg-[#f1f3f5] text-[#52647b] group-hover/link:bg-[#ffdc32] group-hover/link:text-[#092a53]"}`}>
                  {links.length > 5 ? String(index + 1).padStart(2, "0") : link.icon || "✦"}
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold">{link.label}</span>
                {!mobile && <span aria-hidden="true" className="translate-x-[-3px] text-[#a48700] opacity-0 transition group-hover/link:translate-x-0 group-hover/link:opacity-100">→</span>}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </details>
  );
}

function LanguageDropdown({ language, setLanguage, t }) {
  const languages = [
    { value: "en", label: "English", nativeLabel: "English", code: "EN", mark: "EN" },
    { value: "fr", label: "French", nativeLabel: "Français", code: "FR", mark: "FR" },
  ];
  const activeLanguage = languages.find((option) => option.value === language) || languages[0];
  return (
    <details className="group relative">
      <summary
        aria-label={`${t("Language")}: ${activeLanguage.nativeLabel}`}
        className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-white/30 bg-white/[0.06] px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:border-white/55 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32] focus-visible:ring-offset-2 focus-visible:ring-offset-[#092a53] [&::-webkit-details-marker]:hidden sm:px-3.5 sm:py-2.5"
        onClick={closeOtherDropdowns}
      >
        <span aria-hidden="true" className="grid size-6 place-items-center rounded-full bg-[#ffdc32] text-[9px] font-extrabold tracking-tight text-[#092a53]">{activeLanguage.mark}</span>
        <span className="hidden sm:inline">{activeLanguage.nativeLabel}</span>
        <span className="sm:hidden">{activeLanguage.code}</span>
        <svg aria-hidden="true" className="size-3 text-white/70 transition-transform duration-200 group-open:rotate-180" fill="none" viewBox="0 0 12 12">
          <path d="m2 4 4 4 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        </svg>
      </summary>
      <div className="invisible absolute right-0 top-full z-30 w-56 translate-y-1 pt-3 opacity-0 transition duration-200 group-open:visible group-open:translate-y-0 group-open:opacity-100">
        <div className="overflow-hidden rounded-2xl border border-[#e7e3d9] bg-white p-2 text-sm shadow-[0_18px_48px_rgba(9,42,83,0.2)] ring-1 ring-black/[0.02]">
          <p className="px-3 pb-2 pt-1 text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#8b95a2]">{t("Select language")}</p>
          {languages.map(({ value, label, nativeLabel, code }) => (
            <button
              aria-pressed={language === value}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#bd9c00] ${
                language === value
                  ? "bg-[#fff8dc] text-[#092a53]"
                  : "text-[#52647b] hover:bg-[#f8f7f2]"
              }`}
              key={value}
              onClick={(event) => {
                setLanguage(value);
                const details = event.currentTarget.closest("details");
                if (details) details.open = false;
              }}
              type="button"
            >
              <span aria-hidden="true" className={`grid size-9 shrink-0 place-items-center rounded-xl text-[10px] font-extrabold tracking-wide ${
                language === value ? "bg-[#ffdc32] text-[#092a53]" : "bg-[#f1f3f5] text-[#65748a]"
              }`}>{code}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-extrabold">{nativeLabel}</span>
                <span className="mt-0.5 block text-[10px] text-[#8792a0]">{label}</span>
              </span>
              {language === value && (
                <svg aria-hidden="true" className="size-4 shrink-0 text-[#806a00]" fill="none" viewBox="0 0 20 20">
                  <path d="m5 10 3.2 3.2L15.5 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>
    </details>
  );
}

function AccountDropdown({ customer, customerName, location, handleLogout, t, mobile = false, onNavigate }) {
  const accountActive = ["/account/orders", "/login", "/signup"].includes(location.pathname);
  const options = customer
    ? [{ label: t("My orders"), to: "/account/orders" }]
    : [
        { label: t("Log in"), to: "/login" },
        { label: t("Sign up"), to: "/signup" },
      ];

  function closeDropdown(event) {
    const details = event.currentTarget.closest("details");
    if (details) details.open = false;
    onNavigate?.();
  }

  return (
    <details className={`group relative ${mobile ? "col-span-2" : "hidden md:block"}`}>
      <summary
        className={`flex cursor-pointer list-none items-center border-b-2 transition-colors [&::-webkit-details-marker]:hidden ${
          mobile
            ? `justify-between rounded-xl px-3 py-2.5 ${accountActive ? "border-[#ffdc32] bg-white/[0.06] text-[#ffdc32]" : "border-transparent text-white hover:border-[#ffdc32] hover:bg-white/10"}`
            : `gap-2 rounded-full border-transparent px-2 py-1.5 text-xs font-bold text-white hover:border-white/25 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32] md:text-sm ${accountActive ? "bg-white/[0.1] text-[#ffdc32]" : ""}`
        }`}
        onClick={closeOtherDropdowns}
      >
        {customer && !mobile && (
          customer.profilePicture
            ? <img alt="" className="size-8 rounded-full border border-white/30 object-cover" src={customer.profilePicture} />
            : <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-[#ffdc32] text-xs font-extrabold text-[#092a53]">{(customer.name || "A").charAt(0).toUpperCase()}</span>
        )}
        <span className={mobile ? "hidden" : "hidden md:inline"}>{t("Account")}</span>
        {mobile && <span className="flex min-w-0 items-center gap-2">
          {customer && (customer.profilePicture
            ? <img alt="" className="size-8 rounded-full border border-white/30 object-cover" src={customer.profilePicture} />
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
                ? <img alt="" className="size-10 shrink-0 rounded-full object-cover" src={customer.profilePicture} />
                : <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-[#ffdc32] text-sm font-extrabold text-[#092a53]">{(customer.name || "A").charAt(0).toUpperCase()}</span>}
              <div className="min-w-0">
                <p className={`truncate text-sm font-extrabold ${mobile ? "text-white" : "text-[#092a53]"}`}>{customerName || t("Account")}</p>
                <p className={`truncate text-[10px] ${mobile ? "text-white/60" : "text-[#8792a0]"}`}>{customer.email}</p>
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

export function Header() {
  const { cartCount } = useCart();
  const { customer, logout } = useAuth();
  const { flavors } = useFlavors();
  const { language, setLanguage, t } = useLanguage();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  const isHome = location.pathname === "/";
  const isAdminPage = location.pathname.startsWith("/admin");
  const isShopActive =
    location.pathname === "/flavors" || location.pathname.startsWith("/flavor/");
  const isMenuActive = location.pathname === "/menu";
  const shopLinks = [
    { label: t("All flavors"), to: "/flavors", icon: "🍨" },
    ...[...new Set(flavors.map((flavor) => flavor.tag).filter(Boolean))]
      .sort((first, second) => first.localeCompare(second))
      .map((tag) => ({
        label: t(tag),
        to: `/flavors?tag=${encodeURIComponent(tag)}`,
      })),
  ];
  const menuLinks = coldStoneMenuCategories.map((category) => ({
    label: t(category.title),
    icon: category.icon,
    to: `/menu?category=${encodeURIComponent(category.title)}`,
  }));
  const customerSecondName = customer?.name.trim().split(/\s+/).at(-1) || "";
  const navLinkClassName = (isActive) =>
    `border-b-2 pb-1.5 transition-colors ${
      isActive
        ? "border-[#ffdc32] text-[#ffdc32]"
        : "border-transparent text-white hover:border-[#ffdc32] hover:text-[#ffdc32]"
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
    <div className="relative z-20 bg-[#092a53]">
      <header className="relative z-10 mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-y-3 px-4 py-4 text-white sm:px-8 lg:px-12">
      <Link
        className="flex items-center gap-2.5"
        to="/"
        aria-label="Cold Stone Creamery Cameroon home"
      >
        <span className="grid size-10 place-items-center rounded-full bg-[#ffdc32] text-xl">
          🍦
        </span>
        <span className="font-display text-[19px] font-bold leading-[0.95] tracking-tight text-white">
          Cold Stone
          <br />
          <span className="text-[#efc900]">{t("Cameroon")}</span>
        </span>
      </Link>

      {!isAdminPage && (
      <nav className={`order-last hidden w-full items-center justify-center gap-4 text-xs font-semibold text-white md:order-last md:flex md:basis-full md:gap-5 lg:gap-8 lg:text-[13px] ${isHome ? 'xl:order-none xl:w-auto xl:flex-1 xl:basis-auto' : ''}`}>
        <Link className={`${navLinkClassName(isHome)} whitespace-nowrap`} to="/#home">
          {t("Home")}
        </Link>
        <NavigationDropdown active={isShopActive} icon="▤" label={t("Shop catalog")} links={shopLinks} subtitle={t("Browse signature creations and treats.")} />
        <Link
          className={`${navLinkClassName(location.pathname === "/about")} whitespace-nowrap`}
          to="/about"
        >
          {t("About us")}
        </Link>
        <NavigationDropdown active={isMenuActive} icon="🍦" label={t("Menu")} links={menuLinks} subtitle={t("Browse signature creations and treats.")} />
        <Link
          className={`${navLinkClassName(location.pathname === "/contact")} whitespace-nowrap`}
          to="/contact"
        >
          {t("Contact")}
        </Link>
      </nav>
      )}

      {isAdminPage && (
        <div className="ml-auto">
          <LanguageDropdown language={language} setLanguage={setLanguage} t={t} />
        </div>
      )}

      {!isAdminPage && (
      <div className="flex items-center gap-3">
        <LanguageDropdown language={language} setLanguage={setLanguage} t={t} />
        <AccountDropdown
          customer={customer}
          customerName={customerSecondName}
          handleLogout={handleLogout}
          location={location}
          t={t}
        />
        <Link
          aria-label={t("Shopping bag, {count} items", { count: cartCount })}
          className="relative grid size-10 place-items-center rounded-full text-white transition hover:bg-white/10"
          to="/cart"
        >
          <svg
            aria-hidden="true"
            className="size-5"
            viewBox="0 0 24 24"
            fill="none"
          >
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
          {cartCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid size-5 place-items-center rounded-full bg-[#ffdc32] text-[10px] font-bold">
              {cartCount}
            </span>
          )}
        </Link>
        <button
          aria-controls="mobile-navigation"
          aria-expanded={isMobileMenuOpen}
          aria-label={t(isMobileMenuOpen ? "Close menu" : "Open menu")}
          className="grid size-10 place-items-center rounded-full text-white transition hover:bg-white/10 md:hidden"
          onClick={(event) => {
            closeOtherDropdowns(event);
            setIsMobileMenuOpen((open) => !open);
          }}
          type="button"
        >
          {isMobileMenuOpen ? (
            <svg
              aria-hidden="true"
              className="size-5"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="m6 6 12 12M18 6 6 18"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2"
              />
            </svg>
          ) : (
            <svg
              aria-hidden="true"
              className="size-5"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M4 7h16M4 12h16M4 17h16"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2"
              />
            </svg>
          )}
        </button>
        {isHome && (
          <Link
            className="hidden rounded-full bg-[#ffdc32] px-5 py-2.5 text-sm font-bold text-[#102c50] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#ffe665] xl:inline-flex"
            to="/flavors"
          >
            {t("Shop catalog")}
          </Link>
        )}
        {!isHome && (
          <Link
            to="/"
            className="hidden rounded-full bg-[#ffdc32] px-5 py-2.5 text-sm font-bold text-[#102c50] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#ffe665] xl:inline-flex"
          >
            {t("Home")}
          </Link>
        )}
      </div>
      )}
      {!isAdminPage && logoutError && (
        <p className="basis-full text-right text-xs text-red-700" role="alert">
          {logoutError}
        </p>
      )}
      {!isAdminPage && isMobileMenuOpen && (
        <nav
          aria-label={t("Mobile navigation")}
          className="basis-full rounded-2xl border border-white/20 bg-[#092a53] p-3 shadow-[0_8px_30px_rgba(18,44,80,0.08)] md:hidden"
          id="mobile-navigation"
        >
          <div className="grid grid-cols-2 gap-1 text-sm font-semibold text-white">
            <Link
              className={`rounded-xl border-b-2 px-3 py-2.5 ${isHome ? "border-[#ffdc32] text-[#ffdc32]" : "border-transparent text-white hover:border-[#ffdc32] hover:bg-white/10"}`}
              onClick={() => setIsMobileMenuOpen(false)}
              to="/#home"
            >
              {t("Home")}
            </Link>
            <NavigationDropdown active={isShopActive} label={t("Shop catalog")} links={shopLinks} mobile onNavigate={() => setIsMobileMenuOpen(false)} />
            <Link
              className={`rounded-xl border-b-2 px-3 py-2.5 ${location.pathname === "/about" ? "border-[#ffdc32] text-[#ffdc32]" : "border-transparent text-white hover:border-[#ffdc32] hover:bg-white/10"}`}
              onClick={() => setIsMobileMenuOpen(false)}
              to="/about"
            >
              {t("About us")}
            </Link>
            <NavigationDropdown active={isMenuActive} label={t("Menu")} links={menuLinks} mobile onNavigate={() => setIsMobileMenuOpen(false)} />
            <Link
              className={`rounded-xl border-b-2 px-3 py-2.5 ${location.pathname === "/contact" ? "border-[#ffdc32] text-[#ffdc32]" : "border-transparent text-white hover:border-[#ffdc32] hover:bg-white/10"}`}
              onClick={() => setIsMobileMenuOpen(false)}
              to="/contact"
            >
              {t("Contact")}
            </Link>
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
        </nav>
      )}
      </header>
      <svg aria-hidden="true" className="pointer-events-none absolute bottom-[-32px] left-0 h-8 w-full" preserveAspectRatio="none" viewBox="0 0 1440 40">
        <path d="M0 0H1440V10C1280 27 1130 32 960 20C780 7 650 8 480 22C300 36 160 33 0 17V0Z" fill="#092a53" />
      </svg>
    </div>
  );
}

export function InstagramSection() {
  const { t } = useLanguage();

  return (
    <section
      aria-labelledby="instagram-heading"
      className="relative isolate overflow-hidden bg-[#f4f2e9] px-5 py-14 sm:px-8 sm:py-16 lg:px-10 lg:py-20"
    >
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-28 size-80 rounded-full border-[44px] border-[#ffdc32]/20 sm:size-[430px]" />
      <div aria-hidden="true" className="pointer-events-none absolute bottom-0 left-0 h-1.5 w-full bg-gradient-to-r from-[#ffdc32] via-[#ffdc32]/50 to-transparent" />
      <div className="relative z-10 mx-auto grid max-w-[1160px] items-center gap-8 rounded-[28px] border border-[#e5e1d7] bg-white p-5 shadow-[0_18px_50px_rgba(9,42,83,0.08)] sm:gap-10 sm:p-8 md:grid-cols-[0.85fr_1.15fr] lg:p-10">
        <div className="relative z-10">
          <span aria-hidden="true" className="mb-5 grid size-12 place-items-center rounded-2xl bg-[#fff3b8] text-2xl text-[#806a00]">
            ◎
          </span>
          <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#8a7500]">
            {t("Follow the fun.")}
          </p>
          <h2 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-[#092a53] sm:text-4xl" id="instagram-heading">
            {t("Follow us on Instagram")}
          </h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-[#65748a]">
            {t("Get a glimpse of our latest creations and sweet moments.")}
          </p>
          <a
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#092a53] px-5 py-3 text-sm font-extrabold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#163e6b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] focus-visible:ring-offset-2"
            href="https://www.instagram.com/coldstonecameroon/"
            rel="noreferrer"
            target="_blank"
          >
            {t("Visit Instagram")}
            <ArrowIcon diagonal />
          </a>
        </div>
        <div className="grid grid-cols-3 items-center gap-2.5 sm:gap-4">
          <img alt={t("Ice cream treats")} className="aspect-[0.78] w-full rotate-[-3deg] rounded-2xl object-cover shadow-[0_12px_24px_rgba(9,42,83,0.16)] sm:rounded-[20px]" loading="lazy" src="/ice-images/ice-1.jpg" />
          <img alt={t("Celebration cake")} className="aspect-[0.78] w-full translate-y-3 rounded-2xl object-cover shadow-[0_12px_24px_rgba(9,42,83,0.16)] sm:rounded-[20px]" loading="lazy" src="/cake-images/cake-1.webp" />
          <img alt={t("Creamy dessert")} className="aspect-[0.78] w-full rotate-[3deg] rounded-2xl object-cover shadow-[0_12px_24px_rgba(9,42,83,0.16)] sm:rounded-[20px]" loading="lazy" src="/cream/cream%201.webp" />
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="relative isolate overflow-hidden border-t-4 border-[#ffdc32] bg-[#092a53] px-5 py-12 text-white sm:px-8 sm:py-14 lg:px-10">
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-32 size-80 rounded-full border-[46px] border-white/[0.04] sm:size-[420px]" />
      <div className="relative z-10 mx-auto max-w-[1160px]">
        <div className="grid gap-10 pb-10 sm:grid-cols-2 lg:grid-cols-[1.35fr_1fr_1fr] lg:gap-14">
          <div>
            <Link className="inline-flex items-center gap-3 rounded-2xl transition hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32] focus-visible:ring-offset-4 focus-visible:ring-offset-[#092a53]" to="/">
              <span className="grid size-12 place-items-center rounded-2xl bg-[#ffdc32] text-2xl shadow-[0_8px_20px_rgba(0,0,0,0.16)]">
              🍦
              </span>
              <span className="font-display text-xl font-extrabold leading-[0.95]">
                Cold Stone
                <br />
                <span className="text-[#ffdc32]">{t("Cameroon")}</span>
              </span>
            </Link>
            <p className="mt-5 max-w-sm text-sm leading-6 text-white/70">
              {t(
                "Independent guide to publicly listed Cold Stone Creamery locations in Cameroon.",
              )}
            </p>
          </div>
          <nav aria-label={t("Quick links")}>
            <h2 className="font-display text-base font-bold">{t("Quick links")}</h2>
            <ul className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 text-sm text-white/70">
              <li>
                <Link className="transition hover:text-[#ffdc32] focus-visible:text-[#ffdc32] focus-visible:outline-none" to="/menu">
                  {t("Menu")}
                </Link>
              </li>
              <li>
                <Link className="transition hover:text-[#ffdc32] focus-visible:text-[#ffdc32] focus-visible:outline-none" to="/about">
                  {t("About us")}
                </Link>
              </li>
              <li>
                <Link className="transition hover:text-[#ffdc32] focus-visible:text-[#ffdc32] focus-visible:outline-none" to="/locations">
                  {t("Locations")}
                </Link>
              </li>
              <li>
                <Link className="transition hover:text-[#ffdc32] focus-visible:text-[#ffdc32] focus-visible:outline-none" to="/flavors">
                  {t("Shop catalog")}
                </Link>
              </li>
              <li>
                <Link className="transition hover:text-[#ffdc32] focus-visible:text-[#ffdc32] focus-visible:outline-none" to="/contact">
                  {t("Contact us")}
                </Link>
              </li>
              <li>
                <Link className="transition hover:text-[#ffdc32] focus-visible:text-[#ffdc32] focus-visible:outline-none" to="/cart">
                  {t("Shopping cart")}
                </Link>
              </li>
            </ul>
          </nav>
          <div>
            <h2 className="font-display text-base font-bold">{t("Official local pages")}</h2>
            <a className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-3.5 py-3 text-sm font-semibold text-white/85 transition hover:border-[#ffdc32]/60 hover:bg-white/10 hover:text-[#ffdc32] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32]" href="https://www.instagram.com/coldstonecameroon/" target="_blank" rel="noreferrer">
              <span aria-hidden="true" className="grid size-7 place-items-center rounded-lg bg-white/10 text-base">◎</span>
              {t("Cold Stone Cameroon on Instagram")}
              <ArrowIcon diagonal />
            </a>
            <p className="mt-4 max-w-xs text-xs leading-5 text-white/60">
              {t("Independent guide — not an official Cold Stone Creamery website.")}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t border-white/15 pt-5 text-xs text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 {t("Independent Cameroon guide")}. {t("All smiles reserved.")}</p>
          <p>{t("Made for ice cream lovers in Cameroon.")}</p>
        </div>
      </div>
    </footer>
  );
}

export { ArrowIcon };
