import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Footer, Header } from "../../components/Layout";
import { useLanguage } from "../../language/useLanguage";
import { metaForPath } from "../../seo/pageMeta";
import { useDocumentMeta } from "../../seo/useDocumentMeta";
import { FAQ_GROUPS, faqSchema } from "../../../shared/faqContent.js";

type FaqItem = { question: string; answer: string };

const GROUPS = FAQ_GROUPS;

function Question({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();
  return (
    <div className="rounded-2xl bg-[#fbfaf5] ring-1 ring-[#eee9db] transition hover:ring-[#e2d39a]">
      <button
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
        onClick={() => setOpen(!open)}
        type="button"
      >
        <span className="text-sm font-extrabold text-brand-navy sm:text-base">
          {t(item.question)}
        </span>
        <span
          aria-hidden="true"
          className={`grid size-7 shrink-0 place-items-center rounded-full bg-white text-brand-navy ring-1 ring-[#e3dfd3] transition ${open ? "rotate-45" : ""}`}
        >
          <svg className="size-3.5" fill="none" viewBox="0 0 24 24">
            <path
              d="M12 5v14M5 12h14"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="2.4"
            />
          </svg>
        </span>
      </button>
      {open && (
        <p className="px-5 pb-5 text-sm leading-6 text-[#44526a]">
          {t(item.answer)}
        </p>
      )}
    </div>
  );
}

export function FaqPage() {
  const { t, language } = useLanguage();
  const meta = metaForPath("/faq");
  useDocumentMeta(meta);
  // The server already puts this in the first HTML. Add it only when that tag
  // is missing, which is a visit that did not reload the page.
  useEffect(() => {
    if (document.querySelector("script[data-faq-schema]")) return undefined;
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.dataset.faqSchema = "true";
    script.text = JSON.stringify(faqSchema(language)).replace(/</g, "\\u003c");
    document.head.appendChild(script);
    return () => script.remove();
  }, [language]);

  return (
    <div className="min-h-svh bg-white text-brand-navy">
      <Header />
      <main
        className="mx-auto max-w-[820px] px-5 py-12 sm:px-8 sm:py-16"
        id="main"
        tabIndex={-1}
      >
        <p className="text-sm font-bold uppercase tracking-wide text-brand-muted">
          {t("Help center")}
        </p>
        <h1 className="mt-2 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
          {t("Frequently asked questions")}
        </h1>
        <p className="mt-5 text-base leading-7 text-brand-muted sm:text-lg sm:leading-8">
          {t(
            "Ordering, delivery, discounts and what happens after you pay — answered. Anything else, the contact form or WhatsApp chat reaches a real person.",
          )}
        </p>
        <div className="mt-10 flex flex-col gap-9">
          {GROUPS.map((group) => (
            <section key={group.heading}>
              <h2 className="font-display text-2xl font-extrabold leading-tight sm:text-[1.7rem]">
                {t(group.heading)}
              </h2>
              <div className="mt-4 flex flex-col gap-3">
                {group.items.map((item) => (
                  <Question item={item} key={item.question} />
                ))}
              </div>
            </section>
          ))}
        </div>
        <div className="mt-12 flex flex-wrap gap-3">
          <Link
            className="inline-flex min-h-12 items-center rounded-md bg-brand-navy px-6 py-3 text-sm font-extrabold text-white transition hover:bg-brand-blue"
            to="/contact"
          >
            {t("Contact us")}
          </Link>
          <Link
            className="inline-flex min-h-12 items-center rounded-md px-6 py-3 text-sm font-extrabold text-brand-navy ring-1 ring-[#e3dfd3] transition hover:bg-[#fbfaf5]"
            to="/locations"
          >
            {t("Find a store")}
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
