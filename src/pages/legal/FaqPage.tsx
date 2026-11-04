import { useState } from "react";
import { Link } from "react-router-dom";
import { Footer, Header } from "../../components/Layout";
import { useLanguage } from "../../language/useLanguage";
import { metaForPath } from "../../seo/pageMeta";
import { useDocumentMeta } from "../../seo/useDocumentMeta";
import {
  deliveryAreaSummary,
  fulfillmentWindowSummary,
} from "../../../shared/faqData.js";

type FaqItem = { question: string; answer: string };

// Questions are grouped so a shopper can jump to what they came for. Every
// answer is a plain sentence or two; the whole page stays readable in one scroll.
const GROUPS: { heading: string; items: FaqItem[] }[] = [
  {
    heading: "Ordering & payment",
    items: [
      {
        question: "How do I order?",
        answer:
          "Browse the menu or flavors, add what you want to your bag, then checkout. You can pay by card (Stripe) or Mobile Money (CamPay), and you can check out as a guest or with an account.",
      },
      {
        question: "Do I need an account to order?",
        answer:
          "No. Tap “Continue as guest” at checkout and enter your name, email and phone. An account keeps your details saved, tracks loyalty points, and lets you reorder in one tap, but it is never required.",
      },
      {
        question: "Can I add a note to my order?",
        answer:
          "Yes. On checkout there is an optional “Note for the store” field — use it for a gift message, allergies, or a landmark that helps the rider find you.",
      },
      {
        question: "Do you take custom cakes and party orders?",
        answer:
          "Yes. Request a custom cake on the /custom-cake page, and bulk event orders on the /events page. You choose the details, we send a quote, and a 30% deposit books the date.",
      },
    ],
  },
  {
    heading: "Delivery & pickup",
    items: [
      {
        question: "Which areas do you deliver to?",
        answer: deliveryAreaSummary(),
      },
      {
        question: "How much does delivery cost?",
        answer:
          "Each branch sets its own fee, shown on checkout before you pay. If a branch offers free delivery, that shows too. Pickup is always free.",
      },
      {
        question: "How fast can I get my order?",
        answer: fulfillmentWindowSummary(),
      },
      {
        question: "Can I pick up my order instead?",
        answer:
          "Yes — choose Pickup at checkout, pick the branch, a date and a time slot, and collect it there. You will get a notification when it is ready.",
      },
    ],
  },
  {
    heading: "Discounts & loyalty",
    items: [
      {
        question: "How do I use a discount code?",
        answer:
          "Enter it in the “Savings” step at checkout and tap Apply code. The discount is confirmed again on the server when you pay, so the final total is always correct.",
      },
      {
        question: "How do loyalty points work?",
        answer:
          "Earn points when you order, then redeem 100 points for 1,000 FCFA off. Points cannot be combined with a discount code, and there is a buy-2-get-1-free offer on scoops as well.",
      },
      {
        question: "My code says it is invalid. Why?",
        answer:
          "Codes can expire, run out of uses, need a minimum number of items, or be switched off by the store. The message at checkout says which one applies.",
      },
    ],
  },
  {
    heading: "After you order",
    items: [
      {
        question: "How do I track my order?",
        answer:
          "Every step (preparing, ready, out for delivery, delivered) is sent as a device notification, an email and a WhatsApp message. You can also look an order up on the Track order page with the order number and the email used at checkout.",
      },
      {
        question: "What if something is wrong with my order?",
        answer:
          "Contact us within 24 hours with your order number (and a photo if the problem is visible). We replace or refund — the refund policy page has the details.",
      },
      {
        question: "Can I cancel my order?",
        answer:
          "Once the store starts preparing, an order cannot be cancelled. If it has not started, message the branch quickly through the contact form or WhatsApp and we will help.",
      },
    ],
  },
];

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
  const { t } = useLanguage();
  const meta = metaForPath("/faq");
  useDocumentMeta(meta);

  // The same questions, marked up for search engines, so Google can show the
  // answers directly in results.
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: GROUPS.flatMap((group) =>
      group.items.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    ),
  };

  return (
    <div className="min-h-svh bg-white text-brand-navy">
      <Header />
      <script type="application/ld+json">
        {JSON.stringify(faqSchema).replace(/</g, "\\u003c")}
      </script>
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
