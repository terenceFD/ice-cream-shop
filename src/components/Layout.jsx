import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useCart } from "../CartContext";
import { useAuth } from "../authcontext/AuthContext";
import { useLanguage } from "../LanguageContext";

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

export function Header() {
  const { cartCount } = useCart();
  const { customer, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  const isHome = location.pathname === "/";

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
    <header className="relative z-10 mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-y-3 px-4 py-4 sm:px-8 lg:px-12">
      <Link
        className="flex items-center gap-2.5"
        to="/"
        aria-label="Antixor Icy home"
      >
        <span className="grid size-10 place-items-center rounded-full bg-[#ffdc32] text-xl">
          🍦
        </span>
        <span className="font-display text-[19px] font-bold leading-[0.95] tracking-tight text-[#102c50]">
          Antixor
          <br />
          <span className="text-[#efc900]">Icy.com</span>
        </span>
      </Link>

      <nav className="hidden items-center gap-8 text-[13px] font-semibold text-[#29415f] md:flex">
        <Link className="transition-colors hover:text-[#e5b900]" to="/#home">
          {t("Home")}
        </Link>
        <Link className="transition-colors hover:text-[#e5b900]" to="/flavors">
          {t("Flavors")}
        </Link>
        <Link
          className={`transition-colors hover:text-[#e5b900] ${location.pathname === "/about" ? "text-[#bd9c00]" : ""}`}
          to="/about"
        >
          {t("About us")}
        </Link>
        <Link className="transition-colors hover:text-[#e5b900]" to="/#reviews">
          {t("Reviews")}
        </Link>
        <Link
          className={`transition-colors hover:text-[#e5b900] ${location.pathname === "/contact" ? "text-[#bd9c00]" : ""}`}
          to="/contact"
        >
          {t("Contact")}
        </Link>
      </nav>

      <div className="flex items-center gap-3">
        <div
          aria-label={t("Language")}
          className="flex items-center rounded-full border border-[#ece8de] p-0.5 text-[11px] font-bold"
          role="group"
        >
          <button
            aria-pressed={language === "en"}
            className={`rounded-full px-2 py-1 transition ${language === "en" ? "bg-[#092a53] text-white" : "text-[#29415f]"}`}
            onClick={() => setLanguage("en")}
            type="button"
          >
            EN
          </button>
          <button
            aria-pressed={language === "fr"}
            className={`rounded-full px-2 py-1 transition ${language === "fr" ? "bg-[#092a53] text-white" : "text-[#29415f]"}`}
            onClick={() => setLanguage("fr")}
            type="button"
          >
            FR
          </button>
        </div>
        {customer ? (
          <>
            <span className="hidden max-w-32 truncate text-xs font-semibold text-[#29415f] xl:inline">
              {t("Hi, {name}", { name: customer.name })}
            </span>
            <button
              className="hidden text-xs font-bold text-[#29415f] transition-colors hover:text-[#bd9c00] md:inline-flex md:text-sm"
              onClick={handleLogout}
              type="button"
            >
              {t("Log out")}
            </button>
          </>
        ) : (
          <>
            <Link
              aria-current={location.pathname === "/login" ? "page" : undefined}
              className={`hidden text-xs font-bold transition-colors hover:text-[#bd9c00] md:inline-flex md:text-sm ${location.pathname === "/login" ? "text-[#bd9c00]" : "text-[#29415f]"}`}
              to="/login"
            >
              {t("Log in")}
            </Link>
            <Link
              aria-current={
                location.pathname === "/signup" ? "page" : undefined
              }
              className="hidden rounded-full bg-[#ffdc32] px-3 py-2 text-xs font-bold text-[#102c50] transition hover:bg-[#ffe665] md:inline-flex md:px-4 md:text-sm"
              to="/signup"
            >
              {t("Sign up")}
            </Link>
          </>
        )}
        <Link
          aria-label={t("Shopping bag, {count} items", { count: cartCount })}
          className="relative grid size-10 place-items-center rounded-full text-[#102c50] transition hover:bg-[#f4f1e7]"
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
          className="grid size-10 place-items-center rounded-full text-[#102c50] transition hover:bg-[#f4f1e7] md:hidden"
          onClick={() => setIsMobileMenuOpen((open) => !open)}
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
          <a
            className="hidden rounded-full bg-[#ffdc32] px-5 py-2.5 text-sm font-bold text-[#102c50] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#ffe665] sm:inline-flex"
            href="#flavors"
          >
            {t("Order now")}
          </a>
        )}
        {!isHome && (
          <Link
            to="/"
            className="hidden rounded-full bg-[#ffdc32] px-5 py-2.5 text-sm font-bold text-[#102c50] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#ffe665] sm:inline-flex"
          >
            {t("Home")}
          </Link>
        )}
      </div>
      {logoutError && (
        <p className="basis-full text-right text-xs text-red-700" role="alert">
          {logoutError}
        </p>
      )}
      {isMobileMenuOpen && (
        <nav
          aria-label={t("Mobile navigation")}
          className="basis-full rounded-2xl border border-[#ece8de] bg-white p-3 shadow-[0_8px_30px_rgba(18,44,80,0.08)] md:hidden"
          id="mobile-navigation"
        >
          <div className="grid grid-cols-2 gap-1 text-sm font-semibold text-[#29415f]">
            <Link
              className="rounded-xl px-3 py-2.5 hover:bg-[#fff9dc]"
              onClick={() => setIsMobileMenuOpen(false)}
              to="/#home"
            >
              {t("Home")}
            </Link>
            <Link
              className="rounded-xl px-3 py-2.5 hover:bg-[#fff9dc]"
              onClick={() => setIsMobileMenuOpen(false)}
              to="/flavors"
            >
              {t("Flavors")}
            </Link>
            <Link
              className="rounded-xl px-3 py-2.5 hover:bg-[#fff9dc]"
              onClick={() => setIsMobileMenuOpen(false)}
              to="/about"
            >
              {t("About us")}
            </Link>
            <Link
              className="rounded-xl px-3 py-2.5 hover:bg-[#fff9dc]"
              onClick={() => setIsMobileMenuOpen(false)}
              to="/#reviews"
            >
              {t("Reviews")}
            </Link>
            <Link
              className="rounded-xl px-3 py-2.5 hover:bg-[#fff9dc]"
              onClick={() => setIsMobileMenuOpen(false)}
              to="/contact"
            >
              {t("Contact")}
            </Link>
            {customer ? (
              <>
                <span className="rounded-xl px-3 py-2.5 text-[#65748a]">
                  {t("Hi, {name}", { name: customer.name })}
                </span>
                <button
                  className="rounded-xl bg-[#ffeb9c] px-3 py-2.5 text-left text-[#102c50] hover:bg-[#ffe665]"
                  onClick={handleLogout}
                  type="button"
                >
                  {t("Log out")}
                </button>
              </>
            ) : (
              <>
                <Link
                  className="rounded-xl px-3 py-2.5 hover:bg-[#fff9dc]"
                  onClick={() => setIsMobileMenuOpen(false)}
                  to="/login"
                >
                  {t("Log in")}
                </Link>
                <Link
                  className="rounded-xl bg-[#ffeb9c] px-3 py-2.5 text-[#102c50] hover:bg-[#ffe665]"
                  onClick={() => setIsMobileMenuOpen(false)}
                  to="/signup"
                >
                  {t("Sign up")}
                </Link>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
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
              Antixor
              <br />
              <span className="text-[#ffdc32]">Icy.com</span>
            </span>
          </Link>
          <p className="mt-4 max-w-xs text-xs leading-5 text-white/65">
            {t(
              "Real ice cream, made with love. Here's to little treats and big smiles.",
            )}
          </p>
          <p className="mt-4 text-xs text-white/55">
            © 2026 Antixor Icy. {t("All smiles reserved.")}
          </p>
        </div>
        <div>
          <h2 className="font-display text-base font-bold">
            {t("Quick links")}
          </h2>
          <ul className="mt-3 space-y-2 text-xs text-white/65">
            <li>
              <Link className="hover:text-[#ffdc32]" to="/flavors">
                {t("Our flavors")}
              </Link>
            </li>
            <li>
              <Link className="hover:text-[#ffdc32]" to="/about">
                {t("About us")}
              </Link>
            </li>
            <li>
              <Link className="hover:text-[#ffdc32]" to="/contact">
                {t("Contact us")}
              </Link>
            </li>
            <li>
              <Link className="hover:text-[#ffdc32]" to="/#reviews">
                {t("Reviews")}
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
          <h2 className="font-display text-base font-bold">{t("Say hello")}</h2>
          <a
            className="mt-3 inline-block text-xs text-white/65 transition hover:text-[#ffdc32]"
            href="mailto:hello@antixoricy.com"
          >
            hello@antixoricy.com
          </a>
          <p className="mt-2 text-xs text-white/65">
            {t("Fresh scoops, happy hearts.")}
          </p>
        </div>
      </div>
    </footer>
  );
}

export { ArrowIcon };
