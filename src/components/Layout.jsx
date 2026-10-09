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

function NavigationDropdown({ active, label, links, mobile = false, onNavigate }) {
  const activeClass = active
    ? "border-[#ffdc32] text-[#ffdc32]"
    : "border-transparent text-white hover:border-[#ffdc32] hover:text-[#ffdc32]";

  return (
    <details className={`group relative ${mobile ? "col-span-2" : ""}`}>
      <summary
        onClick={closeOtherDropdowns}
        className={`flex cursor-pointer list-none items-center justify-between gap-2 border-b-2 pb-1.5 transition-colors [&::-webkit-details-marker]:hidden ${
          mobile
            ? `rounded-xl px-3 py-2.5 ${activeClass}`
            : `${activeClass} whitespace-nowrap`
        }`}
      >
        {label}
        <svg aria-hidden="true" className="size-3 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 12 12">
          <path d="m2 4 4 4 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        </svg>
      </summary>
      <div className={mobile
        ? "mt-1 grid gap-1 rounded-xl bg-[#163e6b] p-2"
        : "invisible absolute left-1/2 top-full z-30 w-56 -translate-x-1/2 pt-2 opacity-0 transition group-open:visible group-open:opacity-100"
      }>
        <div className={mobile ? "grid gap-1" : "rounded-xl border border-[#d9d6cc] bg-white p-2 text-sm shadow-[0_8px_30px_rgba(18,44,80,0.12)]"}>
          {links.map((link) => (
            <Link
              className={mobile
                ? "rounded-lg px-3 py-2 text-sm text-white hover:bg-white/10 hover:text-[#ffdc32]"
                : "block rounded-lg px-3 py-2.5 text-left text-[#65748a] hover:bg-[#fff9dc] hover:text-[#806a00]"
              }
              key={link.to}
              onClick={(event) => {
                if (mobile) onNavigate()
                const details = event.currentTarget.closest("details")
                if (details) details.open = false
              }}
              to={link.to}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </details>
  );
}

function LanguageDropdown({ language, setLanguage, t }) {
  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-white/40 px-3 py-2 text-xs font-bold text-white [&::-webkit-details-marker]:hidden" onClick={closeOtherDropdowns}>
        {t("Language")}
        <svg aria-hidden="true" className="size-3 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 12 12">
          <path d="m2 4 4 4 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        </svg>
      </summary>
      <div className="invisible absolute right-0 top-full z-30 w-32 pt-2 opacity-0 transition group-open:visible group-open:opacity-100">
        <div className="rounded-xl border border-[#d9d6cc] bg-white p-2 text-sm shadow-[0_8px_30px_rgba(18,44,80,0.12)]">
          {[
            ["en", "EN"],
            ["fr", "FR"],
          ].map(([value, label]) => (
            <button
              aria-pressed={language === value}
              className={`block w-full rounded-lg px-3 py-2 text-left ${language === value ? "bg-[#fff9dc] font-bold text-[#806a00]" : "text-[#65748a] hover:bg-[#f8f7f2]"}`}
              key={value}
              onClick={(event) => {
                setLanguage(value);
                const details = event.currentTarget.closest("details");
                if (details) details.open = false;
              }}
              type="button"
            >
              {label}
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
        className={`flex cursor-pointer list-none items-center gap-1.5 border-b-2 transition-colors [&::-webkit-details-marker]:hidden ${
          mobile
            ? `justify-between rounded-xl px-3 py-2.5 ${accountActive ? "border-[#ffdc32] text-[#ffdc32]" : "border-transparent text-white hover:border-[#ffdc32] hover:bg-white/10"}`
            : `whitespace-nowrap pb-1.5 text-xs font-bold md:text-sm ${accountActive ? "border-[#ffdc32] text-[#ffdc32]" : "border-transparent text-white hover:border-[#ffdc32] hover:text-[#ffdc32]"}`
        }`}
        onClick={closeOtherDropdowns}
      >
        {t("Account")}
        <svg aria-hidden="true" className="size-3 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 12 12">
          <path d="m2 4 4 4 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        </svg>
      </summary>
      <div className={mobile
        ? "mt-1 grid gap-1 rounded-xl bg-[#163e6b] p-2"
        : "invisible absolute right-0 top-full z-30 w-48 pt-2 opacity-0 transition group-open:visible group-open:opacity-100"
      }>
        <div className={mobile ? "grid gap-1" : "rounded-xl border border-[#d9d6cc] bg-white p-2 text-sm shadow-[0_8px_30px_rgba(18,44,80,0.12)]"}>
          {customer && customerName && (
            <p className="truncate px-3 py-2 text-xs font-semibold text-[#65748a]">
              {customerName}
            </p>
          )}
          {options.map((option) => (
            <Link
              aria-current={location.pathname === option.to ? "page" : undefined}
              className={mobile
                ? `rounded-lg px-3 py-2 text-sm ${location.pathname === option.to ? "bg-white/10 font-bold text-[#ffdc32]" : "text-white hover:bg-white/10 hover:text-[#ffdc32]"}`
                : `block rounded-lg px-3 py-2.5 text-left ${location.pathname === option.to ? "bg-[#fff9dc] font-bold text-[#806a00]" : "text-[#65748a] hover:bg-[#fff9dc] hover:text-[#806a00]"}`
              }
              key={option.to}
              onClick={closeDropdown}
              to={option.to}
            >
              {option.label}
            </Link>
          ))}
          {customer && (
            <button
              className={mobile
                ? "rounded-lg px-3 py-2 text-left text-sm text-[#65748a] hover:bg-white hover:text-[#806a00]"
                : "block w-full rounded-lg px-3 py-2.5 text-left text-[#65748a] hover:bg-[#fff9dc] hover:text-[#806a00]"
              }
              onClick={(event) => {
                closeDropdown(event);
                handleLogout();
              }}
              type="button"
            >
              {t("Log out")}
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
    { label: t("All flavors"), to: "/flavors" },
    ...[...new Set(flavors.map((flavor) => flavor.tag).filter(Boolean))]
      .sort((first, second) => first.localeCompare(second))
      .map((tag) => ({
        label: t(tag),
        to: `/flavors?tag=${encodeURIComponent(tag)}`,
      })),
  ];
  const menuLinks = coldStoneMenuCategories.map((category) => ({
    label: t(category.title),
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
        <NavigationDropdown active={isShopActive} label={t("Shop catalog")} links={shopLinks} />
        <Link
          className={`${navLinkClassName(location.pathname === "/about")} whitespace-nowrap`}
          to="/about"
        >
          {t("About us")}
        </Link>
        <NavigationDropdown active={isMenuActive} label={t("Menu")} links={menuLinks} />
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

export function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="bg-[#092a53] px-5 py-10 text-white sm:px-8 sm:py-12">
      <div className="mx-auto grid max-w-[1160px] gap-8 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <Link className="inline-flex items-center gap-2.5" to="/">
            <span className="grid size-10 place-items-center rounded-full bg-[#ffdc32] text-xl">
              🍦
            </span>
            <span className="font-display text-lg font-bold leading-[0.95]">
              Cold Stone
              <br />
              <span className="text-[#ffdc32]">{t("Cameroon")}</span>
            </span>
          </Link>
          <p className="mt-4 max-w-xs text-xs leading-5 text-white/65">
            {t(
              "Independent guide to publicly listed Cold Stone Creamery locations in Cameroon.",
            )}
          </p>
          <p className="mt-4 text-xs text-white/55">
            © 2026 {t("Independent Cameroon guide")}. {t("All smiles reserved.")}
          </p>
        </div>
        <div>
          <h2 className="font-display text-base font-bold">
            {t("Quick links")}
          </h2>
          <ul className="mt-3 space-y-2 text-xs text-white/65">
            <li>
              <Link className="hover:text-[#ffdc32]" to="/menu">
                {t("Menu")}
              </Link>
            </li>
            <li>
              <Link className="hover:text-[#ffdc32]" to="/about">
                {t("About us")}
              </Link>
            </li>
            <li>
              <Link className="hover:text-[#ffdc32]" to="/locations">
                {t("Locations")}
              </Link>
            </li>
            <li>
              <Link className="hover:text-[#ffdc32]" to="/flavors">
                {t("Shop catalog")}
              </Link>
            </li>
            <li>
              <Link className="hover:text-[#ffdc32]" to="/contact">
                {t("Contact us")}
              </Link>
            </li>
            <li>
              <Link className="hover:text-[#ffdc32]" to="/cart">
                {t("Shopping cart")}
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="font-display text-base font-bold">{t("Official local pages")}</h2>
          <a className="mt-3 inline-block text-xs text-white/65 transition hover:text-[#ffdc32]" href="https://www.instagram.com/coldstonecameroon/" target="_blank" rel="noreferrer">
            {t("Cold Stone Cameroon on Instagram")}
          </a>
          <p className="mt-2 text-xs text-white/65">
            {t("Independent guide — not an official Cold Stone Creamery website.")}
          </p>
        </div>
      </div>
    </footer>
  );
}

export { ArrowIcon };
