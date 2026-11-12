import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/api";
import { useCart } from "../context/useCart";
import { useLanguage } from "../language/useLanguage";
import { formatCartMoney } from "../lib/cartPricing";
import {
  MENU_QUIZ_ALLERGENS,
  menuNoMatchReason,
  menuQuizCatalog,
  pickMenuItem,
  type MenuCrowd,
  type MenuKind,
  type MenuQuizAnswers,
  type QuizMenuItem,
} from "../lib/menuQuiz";

// "What will it be?": the menu's own quiz, living in the live chat.
//
// Same rules as the flavor quiz — optional, off by default, two questions, a
// hard allergen filter, computed from the catalog the app already loaded — with
// a design of its own: a menu card, not a form card. It reads like a paper
// order pad: a tall header with the question set as a menu head, a grid of
// dishes with picture and price on the left of each choice, and the answer
// served as a receipt line with a photo.
//
// The catalog is fetched on first open rather than on mount: the menu is a few
// dozen items and nobody who never opens the quiz should pay for it.

const KIND_OPTIONS: {
  value: Exclude<MenuKind, "any">;
  label: string;
  hint: string;
  icon: string;
}[] = [
  {
    value: "scoop",
    label: "Ice cream",
    hint: "Cones, cups, sundaes",
    icon: "🍨",
  },
  {
    value: "share",
    label: "Cake or pie",
    hint: "Something to share",
    icon: "🎂",
  },
  {
    value: "sip",
    label: "Shake or smoothie",
    hint: "Something to sip",
    icon: "🥤",
  },
  {
    value: "grab",
    label: "Grab and go",
    hint: "Cupcakes, sandwiches",
    icon: "🧁",
  },
];

const CROWD_OPTIONS: {
  value: MenuCrowd;
  label: string;
  hint: string;
  icon: string;
}[] = [
  { value: "just", label: "Just me", hint: "One serving", icon: "🙂" },
  { value: "share", label: "Sharing", hint: "A few people", icon: "👥" },
  { value: "any", label: "Either", hint: "Show both", icon: "🔄" },
];

/** The quiz's allergen buttons, keyed by the label the logic understands. */
const ALLERGEN_LABELS: Record<(typeof MENU_QUIZ_ALLERGENS)[number], string> = {
  dairy: "Dairy",
  nuts: "Tree nuts",
  peanuts: "Peanuts",
  gluten: "Gluten",
  eggs: "Eggs",
  soy: "Soy",
};

type MenuQuizCardProps = {
  /** Shown expanded on first render (the chat's own button opened it). */
  forceOpen?: boolean;
  onClose?: () => void;
};

export function MenuQuizCard({
  forceOpen = false,
  onClose,
}: MenuQuizCardProps) {
  const { t, language } = useLanguage();
  const { addToCart } = useCart();
  const [open, setOpen] = useState(forceOpen);
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<MenuKind>("any");
  const [crowd, setCrowd] = useState<MenuCrowd>("any");
  const [avoid, setAvoid] = useState<string[]>([]);
  const [items, setItems] = useState<QuizMenuItem[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [added, setAdded] = useState(false);

  // Fetch the menu the first time the quiz is shown. It is cached in state for
  // the life of the card, so re-opening never waits on the network again.
  const ensureCatalog = () => {
    if (items || loadFailed) return;
    setLoadFailed(false);
    apiRequest("/menu")
      .then((result: { categories?: unknown }) => {
        const categories = Array.isArray(result?.categories)
          ? result.categories
          : [];
        // Build outside the state setter: a throw in the mapper must land in the
        // catch below, not become an error state React hides behind a spinner.
        return menuQuizCatalog(
          categories as Parameters<typeof menuQuizCatalog>[0],
        );
      })
      .then(setItems)
      .catch(() => setLoadFailed(true));
  };

  // Mounted already-open (the chat's button) still needs the catalog.
  useEffect(() => {
    if (open) ensureCatalog();
    // Opening is the only trigger; re-running on every render would refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const start = () => {
    setOpen(true);
    setStep(0);
    setKind("any");
    setCrowd("any");
    setAvoid([]);
    setAdded(false);
    ensureCatalog();
  };

  const close = () => {
    setOpen(false);
    setStep(0);
    setAdded(false);
    onClose?.();
  };

  const answers: MenuQuizAnswers = { kind, crowd, avoid };
  const result = useMemo(
    () => (step >= 2 && items ? pickMenuItem(items, answers) : null),
    // `answers` is rebuilt each render; its three fields are the real inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [step, kind, crowd, avoid, items],
  );

  const toggleAllergen = (label: string) => {
    setAvoid((current) =>
      current.includes(label)
        ? current.filter((entry) => entry !== label)
        : [...current, label],
    );
  };

  // Prices stay in FCFA, as the menu page charges them; the language only picks
  // the thousands separator.
  const money = (value: number) =>
    formatCartMoney(value, "xaf", language, "xaf");

  const openPath = (item: QuizMenuItem) =>
    `/menu?${new URLSearchParams({ category: item.category, item: item.name }).toString()}`;

  if (!open) {
    return (
      <div className="mt-2 w-full max-w-[16rem] sm:w-auto">
        <button
          className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl bg-brand-navy px-3.5 py-2.5 text-left text-white transition hover:bg-brand-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy active:scale-[0.98]"
          onClick={start}
          type="button"
        >
          <span className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-brand-yellow">
              {t("Menu quiz")}
            </span>
            <span className="block text-sm font-extrabold leading-5">
              {t("What will it be?")}
            </span>
          </span>
          <svg
            aria-hidden="true"
            className="size-4 shrink-0 text-brand-yellow"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              d="M9 6l6 6-6 6"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.4"
            />
          </svg>
        </button>
      </div>
    );
  }

  // A menu dish tile: picture, name, category and price. Selected reads as an
  // inked border and a tick, not a filled block.
  const tileClass = (active: boolean) =>
    `group relative flex flex-col overflow-hidden rounded-xl border bg-white text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy active:scale-[0.985] ${
      active
        ? "border-brand-navy ring-1 ring-brand-navy"
        : "border-brand-border-warm hover:border-brand-navy/35 hover:shadow-[0_4px_14px_rgba(71,42,59,0.10)]"
    }`;

  const allergenChip = (active: boolean) =>
    `inline-flex min-h-9 items-center gap-1 rounded-full border px-3 py-2 text-[13px] font-bold leading-none transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy active:scale-[0.97] sm:min-h-0 sm:px-2.5 sm:py-1.5 sm:text-[12.5px] ${
      active
        ? "border-brand-navy bg-brand-navy text-white"
        : "border-brand-border-warm bg-white text-brand-navy hover:bg-brand-cream"
    }`;

  const total = items?.length ?? 0;

  return (
    <div className="mt-2.5 w-full overflow-hidden rounded-[20px] border border-brand-border-warm bg-white shadow-[0_16px_38px_rgba(71,42,59,0.18)] sm:max-w-68">
      {/* The head: a menu card's title block. The question is set as the dish
          name, with the kitchen line beneath — the one memorable moment. */}
      <div className="relative border-b border-brand-border-warm bg-brand-cream px-3.5 pb-3 pt-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-muted">
              {t("The menu")} ·{" "}
              {step >= 2
                ? t("Your pick")
                : t("Question {n} of 2", { n: step + 1 })}
            </p>
            <p className="mt-1 font-display text-[18px] font-extrabold leading-[1.2] text-brand-navy sm:text-[17px]">
              {step === 0
                ? t("What are you in the mood for?")
                : step === 1
                  ? t("Who is it for?")
                  : t("Order this one")}
            </p>
          </div>
          <button
            aria-label={t("Close the quiz")}
            className="grid size-9 shrink-0 place-items-center rounded-full text-brand-muted transition hover:bg-brand-navy/5 hover:text-brand-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy sm:size-7"
            onClick={close}
            type="button"
          >
            <svg
              aria-hidden="true"
              className="size-3.5"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2.5"
              />
            </svg>
          </button>
        </div>
        {/* Rule-with-dots: the menu's "leader line", drawn in CSS. */}
        <div aria-hidden="true" className="mt-2.5 flex items-center gap-1.5">
          {[0, 1, 2].map((index) => (
            <span
              className={`h-0.75 flex-1 rounded-full transition-colors ${
                index <= step ? "bg-brand-yellow-deep" : "bg-brand-border-warm"
              }`}
              key={index}
            />
          ))}
        </div>
      </div>

      <div className="p-3">
        {loadFailed && (
          <div className="py-2 text-center">
            <p className="text-[13px] font-bold leading-5 text-brand-navy">
              {t(
                "The menu did not load. Ask the shop team, or browse the menu page.",
              )}
            </p>
            <Link
              className="mt-2 inline-flex min-h-8 items-center rounded-lg border border-brand-border-warm px-3 text-[12.5px] font-extrabold text-brand-navy transition hover:bg-brand-cream"
              to="/menu"
            >
              {t("Open the menu")}
            </Link>
          </div>
        )}

        {!loadFailed && !items && (
          <div className="grid grid-cols-2 gap-1.5" role="status">
            {[0, 1, 2, 3].map((index) => (
              <span
                className="h-[68px] animate-pulse rounded-xl bg-brand-surface"
                key={index}
              />
            ))}
          </div>
        )}

        {items && step === 0 && (
          <div>
            <div className="grid grid-cols-2 gap-2 sm:gap-1.5">
              {KIND_OPTIONS.map((option) => (
                <button
                  aria-pressed={kind === option.value}
                  className={tileClass(kind === option.value)}
                  key={option.value}
                  onClick={() => {
                    setKind(option.value);
                    setStep(1);
                  }}
                  type="button"
                >
                  <span
                    aria-hidden="true"
                    className="block bg-brand-surface py-2.5 text-center text-[26px] sm:py-2 sm:text-[22px]"
                  >
                    {option.icon}
                  </span>
                  <span className="flex-1 px-2 pb-2.5 pt-2 sm:pb-2 sm:pt-1.5">
                    <span className="block text-[13.5px] font-extrabold leading-4 text-brand-navy sm:text-[12.5px]">
                      {t(option.label)}
                    </span>
                    <span className="mt-0.5 block text-[11.5px] font-medium leading-4 text-brand-muted sm:text-[10.5px] sm:leading-3.5">
                      {t(option.hint)}
                    </span>
                  </span>
                  {kind === option.value && <Tick />}
                </button>
              ))}
            </div>
            <button
              className="mt-2 min-h-10 w-full rounded-full py-2 text-[13px] font-bold text-brand-muted underline decoration-brand-yellow decoration-2 underline-offset-[3px] transition hover:text-brand-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy sm:min-h-0 sm:py-1.5 sm:text-[12px]"
              onClick={() => {
                setKind("any");
                setStep(1);
              }}
              type="button"
            >
              {t("Surprise me, anything on the menu")}
            </button>
            <p className="mt-1 text-center text-[11.5px] text-brand-muted sm:text-[10.5px]">
              {t("{count} items on today's menu", { count: total })}
            </p>
          </div>
        )}

        {items && step === 1 && (
          <div>
            <div className="grid grid-cols-3 gap-2 sm:gap-1.5">
              {CROWD_OPTIONS.map((option) => (
                <button
                  aria-pressed={crowd === option.value}
                  className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2.5 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy active:scale-[0.97] sm:min-h-0 sm:py-2 ${
                    crowd === option.value
                      ? "border-brand-navy bg-brand-navy text-white"
                      : "border-brand-border-warm bg-white text-brand-navy hover:bg-brand-cream"
                  }`}
                  key={option.value}
                  onClick={() => setCrowd(option.value)}
                  type="button"
                >
                  <span aria-hidden="true" className="text-[20px] leading-none sm:text-[17px]">
                    {option.icon}
                  </span>
                  <span className="text-[12.5px] font-extrabold leading-4 sm:text-[11.5px] sm:leading-3.5">
                    {t(option.label)}
                  </span>
                  <span
                    className={`text-[11px] leading-3.5 sm:text-[10px] sm:leading-3 ${crowd === option.value ? "text-white/70" : "text-brand-muted"}`}
                  >
                    {t(option.hint)}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-3 flex items-baseline justify-between gap-2">
              <p className="text-[13.5px] font-extrabold text-brand-navy sm:text-[12.5px]">
                {t("Leave out any allergies?")}
              </p>
              <span className="text-[11.5px] font-semibold text-brand-muted sm:text-[10.5px]">
                {t("Optional")}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-2 sm:gap-1.5">
              {MENU_QUIZ_ALLERGENS.map((label) => (
                <button
                  aria-pressed={avoid.includes(label)}
                  className={allergenChip(avoid.includes(label))}
                  key={label}
                  onClick={() => toggleAllergen(label)}
                  type="button"
                >
                  {avoid.includes(label) && (
                    <svg
                      aria-hidden="true"
                      className="size-3"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M5 12.5l4.5 4.5L19 7.5"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="3"
                      />
                    </svg>
                  )}
                  {t(ALLERGEN_LABELS[label])}
                </button>
              ))}
            </div>

            <button
              className="mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-brand-yellow px-3 py-2.5 text-[15px] font-extrabold text-brand-navy shadow-[0_2px_10px_rgba(250,204,21,0.35)] transition hover:bg-brand-gold-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy active:scale-[0.98] sm:min-h-0 sm:text-[14px]"
              onClick={() => setStep(2)}
              type="button"
            >
              {t("Pick something for me")}
              <svg
                aria-hidden="true"
                className="size-4"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  d="M9 6l6 6-6 6"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.4"
                />
              </svg>
            </button>
          </div>
        )}

        {items && step >= 2 && result && (
          <div>
            {/* The answer as a receipt line: the photo, the dish, and the price
                set against it on the dotted leader, like a printed order pad. */}
            <Link
              className="group block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
              onClick={() =>
                window.dispatchEvent(new CustomEvent("chat:navigate"))
              }
              to={openPath(result)}
              aria-label={t("Open {name}", { name: result.name })}
            >
              <span className="flex items-start gap-2.5">
                <span className="relative size-18.5 shrink-0 overflow-hidden rounded-xl bg-brand-surface">
                  {result.image ? (
                    <img
                      alt=""
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.05]"
                      decoding="async"
                      loading="lazy"
                      src={result.image}
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="grid size-full place-items-center text-[22px]"
                    >
                      🍨
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1 pt-0.5">
                  <span className="block text-[10px] font-bold uppercase tracking-widest text-brand-yellow-deep">
                    {t(result.category)}
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-[14.5px] font-extrabold leading-tight text-brand-navy">
                    {result.name}
                  </span>
                  <span className="mt-1 flex items-baseline gap-1.5">
                    <span className="min-w-0 flex-1 border-b border-dotted border-brand-border-warm" />
                    <span className="shrink-0 text-[12.5px] font-extrabold text-brand-navy">
                      {money(result.price)}
                    </span>
                  </span>
                </span>
              </span>
            </Link>
            <p className="mt-2 line-clamp-3 text-[11.5px] leading-4 text-brand-muted">
              {result.detail}
            </p>

            <div className="mt-2.5 flex items-center gap-1.5">
              <button
                className={`min-h-11 flex-1 rounded-xl text-[14px] font-extrabold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy active:scale-[0.98] sm:min-h-9 sm:text-[13px] ${
                  added
                    ? "border border-[#cfe6d2] bg-[#eef7ef] text-[#2f6b37]"
                    : "bg-brand-yellow text-brand-navy shadow-[0_2px_8px_rgba(250,204,21,0.3)] hover:bg-brand-gold-light"
                }`}
                disabled={added}
                onClick={() => {
                  const ok = addToCart({
                    id: result.id,
                    name: result.name,
                    detail: result.detail,
                    image: result.image,
                    price: result.price,
                    itemType: "menu",
                    categoryTitle: result.category,
                    availableQuantity: 1,
                  });
                  if (ok) setAdded(true);
                }}
                type="button"
              >
                {added ? t("Added to your bag") : t("Add to bag")}
              </button>
              <button
                className="min-h-11 rounded-xl border border-brand-border-warm px-3 text-[13.5px] font-bold text-brand-navy transition hover:bg-brand-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy active:scale-[0.98] sm:min-h-9 sm:text-[12.5px]"
                onClick={() => {
                  setStep(0);
                  setAdded(false);
                }}
                type="button"
              >
                {t("Not this one")}
              </button>
            </div>

            <div className="mt-2 flex items-center justify-between gap-2 border-t border-brand-border-warm/70 pt-2">
              <button
                className="min-h-9 py-1 text-[12.5px] font-bold text-brand-navy underline decoration-brand-yellow decoration-2 underline-offset-[3px] transition hover:text-brand-navy/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy sm:min-h-0 sm:text-[11.5px]"
                onClick={() => {
                  setStep(0);
                  setKind("any");
                  setCrowd("any");
                  setAvoid([]);
                  setAdded(false);
                }}
                type="button"
              >
                {t("Start over")}
              </button>
              <Link
                className="min-h-9 py-1 text-[12.5px] font-bold text-brand-muted transition hover:text-brand-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy sm:min-h-0 sm:text-[11.5px]"
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("chat:navigate"))
                }
                to="/menu"
              >
                {t("See the whole menu")}
              </Link>
            </div>
          </div>
        )}

        {items && step >= 2 && !result && (
          <div className="py-1 text-center">
            <span
              aria-hidden="true"
              className="mx-auto grid size-10 place-items-center rounded-full bg-brand-cream text-[18px]"
            >
              🧾
            </span>
            <p className="mt-2 text-[13px] font-bold leading-5 text-brand-navy">
              {menuNoMatchReason(items, avoid) === "allergens"
                ? t(
                    "Nothing on the menu fits those allergies. Ask the shop team and they will find something safe.",
                  )
                : t(
                    "Nothing from the menu is in stock right now. Try again later or ask the shop team.",
                  )}
            </p>
            <button
              className="mt-2.5 min-h-11 w-full rounded-xl border border-brand-border-warm px-3 py-2 text-[13.5px] font-extrabold text-brand-navy transition hover:bg-brand-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy active:scale-[0.98] sm:min-h-0 sm:text-[12.5px]"
              onClick={() => {
                setStep(0);
                setAvoid([]);
              }}
              type="button"
            >
              {t("Start over")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** A small tick in the tile's corner: selected, without filling the tile. */
function Tick() {
  return (
    <span
      aria-hidden="true"
      className="absolute right-1.5 top-1.5 grid size-4 place-items-center rounded-full bg-brand-navy text-white"
    >
      <svg className="size-2.5" fill="none" viewBox="0 0 24 24">
        <path
          d="M5 12.5l4.5 4.5L19 7.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3.5"
        />
      </svg>
    </span>
  );
}
