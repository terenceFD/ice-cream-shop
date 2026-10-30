import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/api";
import { useLanguage } from "../language/useLanguage";
import { formatCartMoney } from "../lib/cartPricing";
import { storeOpenState } from "../../shared/storeHours.js";
import { cameroonLocations } from "../../shared/data";

type Zone = {
  id: number;
  location: string;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  deliveryFee: number;
  storeName: string;
  storeTown: string;
  storeArea?: string;
  storeAddress?: string;
};

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const PinIcon = ({ className = "size-4" }: { className?: string }) => (
  <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
    <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </svg>
);

/**
 * Answers "do you deliver to me?" before the customer reaches checkout.
 *
 * The customer types a neighbourhood; the answer comes from the live fulfilment zones, so it
 * cannot drift from what checkout will actually accept.
 */
export function DeliveryCoverage({ compact = false }: { compact?: boolean }) {
  const { t, language } = useLanguage();
  const [zones, setZones] = useState<Zone[] | null>(null);
  const [area, setArea] = useState("");
  const [checked, setChecked] = useState("");

  useEffect(() => {
    let cancelled = false;
    apiRequest<{ zones: Zone[] }>("/fulfillment/options")
      .then((result) => {
        if (!cancelled) setZones(Array.isArray(result?.zones) ? result.zones : []);
      })
      .catch(() => {
        if (!cancelled) setZones([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const deliveryZones = useMemo(
    () => (zones || []).filter((zone) => zone.deliveryEnabled),
    [zones],
  );

  // Every neighbourhood we can deliver to. Zones are named "Douala — Bonapriso", so the part
  // after the dash is the neighbourhood a customer would type.
  const areas = useMemo(() => {
    const names = deliveryZones
      .map((zone) => {
        const [, area] = zone.location.split(/[—-]/).map((part) => part.trim());
        return { label: area || zone.location, zone };
      })
      // A zone named only by its town ("Douala") names no neighbourhood, so it cannot be
      // offered as one; it is still reachable by typing the town or a known street.
      .filter((entry) => fold(entry.label) !== fold(entry.zone.storeTown));
    const seen = new Set<string>();
    return names.filter((entry) => {
      const key = fold(entry.label);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [deliveryZones]);

  // Suggestions are the neighbourhoods, not the zone labels.
  const suggestions = useMemo(() => areas.map((entry) => entry.label), [areas]);

  const match = useMemo(() => {
    const needle = fold(checked);
    if (needle.length < 2) return null;
    // An exact neighbourhood wins; then a close one; then a street we know in that area.
    const exact = areas.find((entry) => fold(entry.label) === needle);
    if (exact) return exact.zone;
    const partial = areas.find(
      (entry) =>
        fold(entry.label).includes(needle) ||
        needle.includes(fold(entry.label)) ||
        fold(entry.zone.location).includes(needle),
    );
    if (partial) return partial.zone;
    const byStreet = areas.find((entry) => {
      const location = cameroonLocations.find((place) => place.area === entry.zone.storeArea);
      return location && fold(location.address).includes(needle);
    });
    return byStreet?.zone ?? null;
  }, [areas, checked]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setChecked(area);
  };

  if (zones === null) return null;
  if (deliveryZones.length === 0 && compact) return null;

  return (
    <section
      aria-labelledby="delivery-coverage-heading"
      className="overflow-hidden rounded-[24px] bg-white ring-1 ring-[#e3dfd3]"
    >
      <div className="flex items-start gap-3 border-b border-[#f1eee4] px-5 py-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#fff4c4] text-brand-navy">
          <PinIcon />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-extrabold text-brand-navy" id="delivery-coverage-heading">
            {t("Do we deliver to you?")}
          </h2>
          <p className="mt-0.5 text-xs leading-5 text-[#65748a]">
            {t("Check your neighbourhood before you fill in the address at checkout.")}
          </p>
        </div>
      </div>

      <form className="px-5 py-4" onSubmit={submit}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="min-w-0 flex-1">
            <span className="sr-only">{t("Your neighbourhood")}</span>
            <input
              autoComplete="off"
              className="min-h-11 w-full rounded-xl bg-[#f4f6f8] px-3.5 text-sm font-semibold text-brand-navy outline-none! ring-1 ring-transparent placeholder:font-normal placeholder:text-[#8b95a2] focus:ring-2 focus:ring-brand-yellow-deep"
              list="delivery-areas"
              onChange={(event) => {
                setArea(event.target.value);
                setChecked(event.target.value);
              }}
              placeholder={t("Neighbourhood, e.g. Bonapriso")}
              value={area}
            />
            <datalist id="delivery-areas">
              {suggestions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </label>
          <button
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-brand-navy px-5 text-sm font-extrabold text-white transition hover:bg-brand-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow focus-visible:ring-offset-2"
            type="submit"
          >
            {t("Check")}
          </button>
        </div>

        {checked.trim().length >= 2 && (
          <div className="mt-3" role="status">
            {match ? (
              <div className="rounded-xl bg-[#eef6e8] px-3.5 py-3">
                <p className="text-sm font-extrabold text-[#315d22]">
                  {t("Yes — we deliver to {area}.", { area: checked.trim() })}
                </p>
                <p className="mt-0.5 text-xs leading-5 text-[#3f6b22]">
                  {t("From {store}. Delivery fee {fee}. Open today until {close}.", {
                    store: t(match.storeName),
                    fee: match.deliveryFee > 0 ? formatCartMoney(match.deliveryFee, "xaf", language) : t("Free"),
                    close: storeOpenState(
                      cameroonLocations.find((entry) => entry.area === match.storeArea) ||
                      cameroonLocations.find((entry) => entry.town === match.storeTown),
                    ).closesAt,
                  })}
                </p>
              </div>
            ) : (
              <div className="rounded-xl bg-[#fff6dc] px-3.5 py-3">
                <p className="text-sm font-extrabold text-[#6b5800]">
                  {t("We do not deliver to “{area}” yet.", { area: checked.trim() })}
                </p>
                <p className="mt-0.5 text-xs leading-5 text-[#6b5800]">
                  {t("You can still collect from one of our branches:")}{" "}
                  {suggestions.slice(0, 4).map((name) => t(name)).join(", ")}.
                </p>
              </div>
            )}
          </div>
        )}

        {!compact && (
          <p className="mt-3 text-[11px] leading-5 text-[#8b95a2]">
            {t("We deliver across {areas}.", { areas: suggestions.map((name) => t(name)).join(", ") })}{" "}
            <Link className="font-bold text-brand-navy underline decoration-[#ffb84d] decoration-2 underline-offset-2" to="/contact">
              {t("Not on the list? Ask us")}
            </Link>
          </p>
        )}
      </form>
    </section>
  );
}
