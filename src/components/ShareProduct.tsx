import { useState } from "react";
import { useLanguage } from "../language/useLanguage";

type ShareProductProps = {
  title: string;
  /** A line to go with the link, usually the product description. */
  text?: string;
  className?: string;
};

const ShareIcon = ({ className = "size-4" }: { className?: string }) => (
  <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
    <path d="M12 16V4m0 0L8 8m4-4 4 4M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
  </svg>
);

const WhatsAppIcon = ({ className = "size-4" }: { className?: string }) => (
  <svg aria-hidden="true" className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 1.8a8.2 8.2 0 1 1-4.2 15.3l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 0 1 12 3.8Zm-3 4c-.2 0-.5.1-.7.4-.2.3-.8.9-.8 2s.8 2.3.9 2.4c.1.2 1.6 2.5 3.9 3.4 1.9.8 2.3.6 2.7.6.4 0 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1l-.5-.3-1.6-.8c-.2-.1-.4-.1-.6.1l-.7.9c-.1.2-.3.2-.5.1-.2-.1-1-.4-2-1.3-.7-.7-1.2-1.5-1.3-1.7-.1-.2 0-.3.1-.4l.4-.5.3-.5v-.5l-.8-1.9c-.2-.4-.4-.4-.6-.4h-.5Z" />
  </svg>
);

/**
 * Share a product to WhatsApp or the phone's share sheet.
 *
 * In Cameroon most sharing happens in WhatsApp groups, so that gets its own button rather
 * than hiding behind the generic share sheet.
 */
export function ShareProduct({ title, text, className = "" }: ShareProductProps) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  const url = typeof window === "undefined" ? "" : window.location.href;
  const shareText = text ? `${title} — ${text}` : title;

  // WhatsApp only turns a link into something tappable when it is a bare https:// URL, so
  // nothing (not even a closing bracket) may sit against it. The message ends with the link
  // on its own line and a plain space after it.
  const whatsappHref =
    "https://wa.me/?text=" + encodeURIComponent(`${shareText}\n\n${url} `);

  const shareWhatsApp = () => {
    window.open(whatsappHref, "_blank", "noopener,noreferrer");
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: shareText, url });
        return;
      } catch {
        // The customer dismissed the sheet; fall through to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {/* A real anchor: it can be long-pressed, middle-clicked and opened in a new tab. */}
      <a
        className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-extrabold text-brand-navy ring-1 ring-[#dcd8cc] transition hover:bg-white hover:ring-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2"
        href={whatsappHref}
        onClick={shareWhatsApp}
        rel="noopener noreferrer"
        target="_blank"
      >
        <WhatsAppIcon />
        {t("Share on WhatsApp")}
      </a>
      <button
        aria-live="polite"
        className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold text-[#65748a] transition hover:bg-white hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
        onClick={share}
        type="button"
      >
        <ShareIcon />
        {copied ? t("Link copied") : t("Share")}
      </button>
    </div>
  );
}
