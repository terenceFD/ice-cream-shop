import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { cameroonLocations } from "../../shared/data";
import { apiRequest } from "../api/api";
import { useLanguage } from "../language/useLanguage";
import { whatsappLink } from "../lib/whatsapp";
import { WhatsAppIcon } from "./WhatsAppIcon";

const DEFAULT_MESSAGE = "Hello Cold Stone Creamery! I have a question.";
// Used when WHATSAPP_NUMBER is not set. The first published store number.
const FALLBACK_NUMBER = cameroonLocations.find((location) => location.phone)?.phone || "";

// Admin, checkout and payment pages stay free of extra buttons.
const HIDDEN_PATHS = ["/admin", "/checkout", "/payment"];

let numberRequest: Promise<string | null> | null = null;
function getShopWhatsAppNumber() {
  numberRequest ??= apiRequest<{ whatsappNumber: string | null }>("/site/contact")
    .then((result) => result?.whatsappNumber || null)
    .catch(() => null);
  return numberRequest;
}

/** A floating WhatsApp button, shown on customer pages when the shop has a WhatsApp number. */
export function WhatsAppButton() {
  const { t } = useLanguage();
  const location = useLocation();
  const [number, setNumber] = useState<string | null>(null);
  const [isPastHero, setIsPastHero] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getShopWhatsAppNumber().then((value) => { if (!cancelled) setNumber(value || FALLBACK_NUMBER); });
    return () => { cancelled = true; };
  }, []);

  // On the home page the hero fills the first screen and its trust badges reach
  // the bottom edge, where this button floats. The button stays hidden until the
  // visitor scrolls past the hero, so it never covers that content.
  useEffect(() => {
    if (location.pathname !== "/") { setIsPastHero(true); return undefined; }

    let frame = 0;
    const update = () => {
      // The hero mounts after this effect runs, so look it up on every tick.
      const hero = document.getElementById("home");
      if (!hero) { setIsPastHero(false); return; }
      // Show once the hero's bottom edge has scrolled above the middle of the screen.
      setIsPastHero(hero.getBoundingClientRect().bottom < window.innerHeight * 0.5);
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };

    // Check immediately, and again once the first paint has laid the page out.
    update();
    const settle = window.setTimeout(update, 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.clearTimeout(settle);
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [location.pathname]);

  if (!number || HIDDEN_PATHS.some((path) => location.pathname.startsWith(path))) return null;
  const message = t(DEFAULT_MESSAGE);
  const href = whatsappLink(number, message);
  if (!href) return null;

  return (
    <a
      aria-label={t("Chat with us on WhatsApp")}
      className={`whatsapp-fab group fixed bottom-6 left-5 z-40 transition-opacity duration-300 sm:left-6 ${isPastHero ? "opacity-100" : "pointer-events-none opacity-0"}`}
      href={href}
      rel="noopener noreferrer"
      tabIndex={isPastHero ? undefined : -1}
      target="_blank"
    >
      <span className="pointer-events-none absolute bottom-1 left-[calc(100%+0.75rem)] w-max max-w-[16rem] translate-y-1 rounded-2xl bg-white px-4 py-3 text-sm font-semibold leading-5 text-brand-navy opacity-0 shadow-[0_12px_30px_rgba(9,42,83,0.16)] transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 motion-reduce:transition-none">
        {message}
      </span>
      <span className="grid size-14 place-items-center rounded-full bg-[#25d366] text-white shadow-[0_12px_30px_rgba(18,140,70,0.45)] transition duration-300 group-hover:-translate-y-1 group-hover:bg-[#1ebe5a] group-hover:shadow-[0_16px_34px_rgba(18,140,70,0.5)] group-focus-visible:ring-4 group-focus-visible:ring-[#25d366]/40 motion-reduce:transform-none motion-reduce:transition-none">
        <WhatsAppIcon className="size-8 transition duration-300 group-hover:scale-110 group-hover:-rotate-6 motion-reduce:transform-none motion-reduce:transition-none" />
      </span>
    </a>
  );
}
