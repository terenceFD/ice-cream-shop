import { useId } from "react";
import { useLanguage } from "../language/useLanguage";

// Allergens that must be called out on a food product. Anything a product lists that is not
// here is treated as an informational note ("Contains alcohol", "May contain nuts").
const COMMON_ALLERGENS = new Set([
  "dairy", "milk", "eggs", "egg", "wheat", "gluten", "soy", "peanuts", "tree nuts", "nuts",
  "almonds", "hazelnuts", "cashews", "pistachios", "walnuts", "pecans", "sesame",
  "fish", "shellfish", "crustaceans", "mustard", "sulphites", "sulfites", "celery", "lupin",
]);

// A product we cannot speak for. This is what shows when nobody has recorded the allergens,
// and it must never be silent: silence reads as "safe" to an allergic customer.
const UNRECORDED = new Set(["none common", "none listed", ""]);

function isCommonAllergen(entry: string) {
  return COMMON_ALLERGENS.has(entry.trim().toLowerCase());
}

function AllergenIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M12 3.5 22 20H2L12 3.5Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M12 10v4.5m0 2.5v.01" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

type AllergenInfoProps = {
  /** What the product lists. null means nobody has checked it; [] means checked and clear. */
  allergens?: string[] | null;
  /** False when the list is a category default rather than checked per item. */
  allergensRecorded?: boolean;
  /** Dietary tags (vegetarian, vegan, dairy-free…) shown as a separate, quiet row. */
  dietaryTags?: string[];
  className?: string;
};

export function AllergenInfo({
  allergens,
  allergensRecorded,
  dietaryTags = [],
  className = "",
}: AllergenInfoProps) {
  const { t } = useLanguage();
  const headingId = useId();

  const entries = (allergens || [])
    .map((entry) => entry.trim())
    .filter(Boolean);
  // An explicit empty list from the catalog means "checked, nothing in it"; an absent one means
  // "nobody checked". Those must not look the same to someone with an allergy.
  const checked = allergens !== undefined && allergens !== null && allergensRecorded !== false;
  const recorded =
    checked ||
    (entries.length > 0 && !entries.every((entry) => UNRECORDED.has(entry.toLowerCase())));
  const listed = entries.filter((entry) => recorded && !UNRECORDED.has(entry.toLowerCase()));
  const common = listed.filter(isCommonAllergen);
  const notes = listed.filter((entry) => !isCommonAllergen(entry));

  return (
    <section
      aria-labelledby={headingId}
      className={`rounded-2xl ring-1 ${className} ${recorded ? "bg-white ring-[#e3dfd3]" : "bg-[#fff6dc] ring-[#ecd9a0]"
        }`}
    >
      <div className="flex items-start gap-3 p-4 sm:p-5">
        <span
          className={`grid size-9 shrink-0 place-items-center rounded-full ${recorded ? "bg-[#f4f6f8] text-brand-navy" : "bg-[#f3d98b] text-[#6b5200]"
            }`}
        >
          <AllergenIcon />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-extrabold text-brand-navy" id={headingId}>
            {t("Allergens")}
          </h2>

          {!recorded ? (
            <p className="mt-1 text-sm leading-6 text-[#6b5800]">
              {t(
                "Allergen information has not been recorded for this item. Ask the store before ordering if you have an allergy.",
              )}
            </p>
          ) : common.length === 0 && notes.length === 0 ? (
            <p className="mt-1 text-sm leading-6 text-[#65748a]">
              {t("No common allergens are listed for this item.")}
            </p>
          ) : (
            <>
              <p className="mt-1 text-xs font-semibold text-[#65748a]">{t("Contains")}</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {common.map((allergen) => (
                  <li
                    className="rounded-md bg-[#fff1ec] px-2.5 py-1 text-xs font-extrabold text-[#9b2c17] ring-1 ring-[#f3d3c9]"
                    key={allergen}
                  >
                    {t(allergen)}
                  </li>
                ))}
                {notes.map((note) => (
                  <li
                    className="rounded-md bg-[#f4f6f8] px-2.5 py-1 text-xs font-bold text-[#334e6e] ring-1 ring-[#e3e8ee]"
                    key={note}
                  >
                    {t(note)}
                  </li>
                ))}
              </ul>
            </>
          )}

          {dietaryTags.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5 border-t border-[#f1eee4] pt-3">
              {dietaryTags.map((tag) => (
                <li
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#eef6e8] px-2.5 py-1 text-xs font-bold text-[#315d22]"
                  key={tag}
                >
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-[#4caf50]" />
                  {t(tag)}
                </li>
              ))}
            </ul>
          )}

          {recorded && allergensRecorded === false && listed.length > 0 && (
            <p className="mt-2 text-[11px] leading-5 text-[#8b95a2]">
              {t("Typical for this kind of item. Ask staff to confirm for this exact product.")}
            </p>
          )}

          <p className="mt-3 text-[11px] leading-5 text-[#8b95a2]">
            {t(
              "Made in a shop that also handles dairy, eggs, wheat, soy, peanuts and tree nuts. Ask staff about cross-contact.",
            )}
          </p>
        </div>
      </div>
    </section>
  );
}
