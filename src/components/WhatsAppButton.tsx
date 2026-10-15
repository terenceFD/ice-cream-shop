import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { apiRequest } from "../api/api";
import { useLanguage } from "../language/useLanguage";
import { whatsappLink } from "../lib/whatsapp";
import { WhatsAppIcon } from "./WhatsAppIcon";

// Admin, checkout and payment pages stay free of extra buttons.
const HIDDEN_PATHS = ["/admin", "/checkout", "/payment"];

let numberRequest: Promise<string | null> | null = null;
function getShopWhatsAppNumber() {
  numberRequest ??= apiRequest<{ whatsappNumber: string | null }>("/site/contact")
    .then((result) => result?.whatsappNumber || null)
    .catch(() => null);
  return numberRequest;
}

/** A floating "Chat on WhatsApp" button, shown on customer pages when the shop has a WhatsApp number. */
export function WhatsAppButton() {
  const { t } = useLanguage();
  const location = useLocation();
  const [number, setNumber] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getShopWhatsAppNumber().then((value) => { if (!cancelled) setNumber(value); });
    return () => { cancelled = true; };
  }, []);

  if (!number || HIDDEN_PATHS.some((path) => location.pathname.startsWith(path))) return null;
  const href = whatsappLink(number, t("Hello Cold Stone Creamery! I have a question."));
  if (!href) return null;

  return (
    <a
      aria-label={t("Chat with us on WhatsApp")}
      className="group fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-[#25d366] p-3.5 text-white shadow-[0_12px_30px_rgba(18,140,70,0.45)] transition hover:-translate-y-0.5 hover:bg-[#1ebe5a] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#25d366]/40 sm:bottom-6 sm:right-6"
      href={href}
      rel="noopener noreferrer"
      target="_blank"
    >
      <WhatsAppIcon className="size-7" />
      <span className="hidden pr-1 text-sm font-bold sm:group-hover:inline">{t("Chat with us")}</span>
    </a>
  );
}
