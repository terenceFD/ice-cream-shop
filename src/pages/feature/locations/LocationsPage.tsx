import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowIcon, Footer, Header } from '../../../components/Layout'
import { PageHero } from '../../../components/PageHero'
import { cameroonLocations } from '../../../data'
import { useLanguage } from '../../../language/useLanguage'

type CameroonLocation = (typeof cameroonLocations)[number]

const PIN_PATH = 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z'
const PHONE_PATH = 'M5 4h3.5l1.7 4.2-2.2 1.4a11 11 0 0 0 6.4 6.4l1.4-2.2L20 15.5V19a1.5 1.5 0 0 1-1.6 1.5C10.6 20 4 13.4 3.5 5.6A1.5 1.5 0 0 1 5 4Z'

// Rough positions on the illustrated map, in percent of its width and height.
const MAP_PINS: Record<string, { left: string; top: string }> = {
  Douala: { left: '30%', top: '60%' },
  Yaoundé: { left: '68%', top: '46%' },
}

function Icon({ path, className = 'size-5' }: { path: string; className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d={path} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  )
}

function mapsUrl(location: CameroonLocation) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.mapQuery)}`
}

export function LocationsPage() {
  const { t } = useLanguage()
  const [city, setCity] = useState('')
  const towns = [...new Set(cameroonLocations.map((location: CameroonLocation) => location.town))]
  const countIn = (town: string) => cameroonLocations.filter((location: CameroonLocation) => location.town === town).length
  const listingsLabel = (count: number) => (count === 1 ? t('{count} listing', { count }) : t('{count} listings', { count }))
  const visibleLocations = cameroonLocations.filter((location: CameroonLocation) => !city || location.town === city)

  const mapVisual = (
    <div className="absolute inset-0 overflow-hidden rounded-[36px] border border-white/10 bg-[#0c3463] shadow-[0_40px_80px_rgba(2,12,28,0.45)]">
      <svg aria-hidden="true" className="absolute inset-0 size-full" preserveAspectRatio="none" viewBox="0 0 600 500">
        <defs>
          <pattern height="40" id="map-grid" patternUnits="userSpaceOnUse" width="40">
            <path d="M40 0H0v40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect fill="url(#map-grid)" height="500" width="600" />
        <path d="M0 0h150c-20 70 30 120 10 190s-70 110-40 190 10 120 0 120H0Z" fill="#071f3d" />
        <path d="M150 0c-20 70 30 120 10 190s-70 110-40 190 10 120 0 120" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="2" />
        <path d="M60 470c40-30 90-40 120-20" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
        <path d="M180 300c60-40 120-20 170-60s90-30 58-10" fill="none" stroke="rgba(255,255,255,0.08)" strokeDasharray="3 7" strokeWidth="2" />
        <path d="M180 300c70-10 120-60 230-70" fill="none" stroke="#ffdc32" strokeDasharray="8 10" strokeLinecap="round" strokeOpacity="0.7" strokeWidth="3" />
      </svg>

      <span className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/80 backdrop-blur-sm">
        <Icon className="size-3.5 text-[#ffdc32]" path={PIN_PATH} />
        {t('Cameroon')}
      </span>
      <span aria-hidden="true" className="absolute right-5 top-5 grid size-10 place-items-center rounded-full border border-white/15 bg-white/5 font-display text-xs font-extrabold text-white/70">N</span>

      {towns.map((town) => {
        const position = MAP_PINS[town] || { left: '50%', top: '50%' }
        return (
          <div className="absolute -translate-x-1/2 -translate-y-full" key={town} style={position}>
            <div className="flex flex-col items-center">
              <div className="mb-2 whitespace-nowrap rounded-2xl bg-white px-3.5 py-2 text-center text-[#092a53] shadow-[0_16px_36px_rgba(2,12,28,0.35)]">
                <p className="font-display text-sm font-extrabold leading-tight sm:text-base">{t(town)}</p>
                <p className="text-[10px] font-bold text-[#65748a]">{listingsLabel(countIn(town))}</p>
              </div>
              <span className="relative grid size-11 place-items-center">
                <span aria-hidden="true" className="absolute inset-0 rounded-full bg-[#ffdc32]/40 motion-safe:animate-ping" />
                <span className="relative grid size-11 place-items-center rounded-full bg-[#ffdc32] text-[#092a53] shadow-[0_10px_24px_rgba(255,220,50,0.35)] ring-4 ring-[#0c3463]">
                  <Icon path={PIN_PATH} />
                </span>
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="min-h-screen bg-[#fbfaf5] text-[#102c50]">
      <Header />
      <main>
        <PageHero
          actions={
            <>
              <a className={PageHero.primary} href="#listed-locations">
                {t('Explore listed locations')} <span aria-hidden="true">↓</span>
              </a>
              <Link className={PageHero.secondary} to="/menu">
                {t('Explore the menu')}
              </Link>
            </>
          }
          badge={{ mark: 'i', eyebrow: t('Please verify before visiting'), text: t('Public listings are independently gathered and should be confirmed before travelling.') }}
          description={t('Public listings currently point to locations in Douala and Yaounde. Details can change; check the map listing or local pages before you travel.')}
          eyebrow={t('Cameroon branch listings')}
          stats={[
            { label: t('Listings'), value: cameroonLocations.length },
            { label: t('Cities'), value: towns.length, accent: true },
          ]}
          title={t('Find Cold Stone Creamery')}
          visual={mapVisual}
        />

        <section aria-labelledby="listed-locations-heading" className="mx-auto max-w-[1320px] scroll-mt-4 px-5 py-14 sm:px-8 sm:py-16 lg:px-12" id="listed-locations">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="inline-flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#8a7000]">
                <span aria-hidden="true" className="h-px w-10 bg-[#a48700]" />
                {t('Explore by city')}
              </p>
              <h2 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-[#092a53] sm:text-5xl" id="listed-locations-heading">
                {t('Listed locations')}
              </h2>
            </div>
            <div aria-label={t('Filter by city')} className="flex max-w-full gap-1 overflow-x-auto rounded-full bg-white p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-2 shadow-[0_1px_0_rgba(9,42,83,0.04),0_8px_24px_rgba(9,42,83,0.06)] ring-1 ring-[#ebe7dc]" role="group">
              {['', ...towns].map((town) => {
                const active = city === town
                return (
                  <button
                    aria-pressed={active}
                    className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-extrabold transition sm:px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] ${
                      active ? 'bg-[#092a53] text-white shadow-[0_6px_16px_rgba(9,42,83,0.2)]' : 'text-[#52647b] hover:bg-[#fbfaf5] hover:text-[#092a53]'
                    }`}
                    key={town || 'all'}
                    onClick={() => setCity(town)}
                    type="button"
                  >
                    {town ? t(town) : t('All cities')}
                    <span className={`grid min-w-5 place-items-center rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${active ? 'bg-[#ffdc32] text-[#092a53]' : 'bg-[#f1ede2] text-[#65748a]'}`}>
                      {town ? countIn(town) : cameroonLocations.length}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <p aria-live="polite" className="sr-only">{listingsLabel(visibleLocations.length)}</p>

          <ul className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {visibleLocations.map((location: CameroonLocation) => {
              const number = cameroonLocations.indexOf(location) + 1
              return (
                <li key={`${location.town}-${location.area}`}>
                  <article className="group flex h-full flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_1px_0_rgba(9,42,83,0.04),0_10px_30px_rgba(9,42,83,0.06)] ring-1 ring-[#ebe7dc] transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_56px_rgba(9,42,83,0.12)] hover:ring-[#e2d39a]">
                    <div className="relative h-28 shrink-0 bg-[#092a53]">
                      <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
                        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.09)_1px,transparent_1px)] [background-size:18px_18px]" />
                        <svg className="absolute inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 400 112">
                          <path d="M-10 80C60 40 120 96 200 60s140-10 220-40" stroke="rgba(255,220,50,0.35)" strokeDasharray="6 8" strokeWidth="2" />
                          <path d="M-10 30C70 50 150 10 230 34s120 40 190 20" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
                        </svg>
                        <div className="absolute -right-10 -top-16 size-44 rounded-full bg-[#3f86d6]/30 blur-2xl" />
                      </div>
                      <span className="absolute left-5 top-5 inline-flex items-center gap-1.5 rounded-full bg-[#ffdc32] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#092a53]">
                        <Icon className="size-3.5" path={PIN_PATH} />
                        {t(location.town)}
                      </span>
                      <span aria-hidden="true" className="absolute right-5 top-3 font-display text-5xl font-extrabold tabular-nums text-white/10">
                        {String(number).padStart(2, '0')}
                      </span>
                      <span aria-hidden="true" className="absolute -bottom-6 left-5 grid size-12 place-items-center rounded-2xl bg-white text-[#092a53] shadow-[0_12px_26px_rgba(9,42,83,0.18)] ring-1 ring-[#ebe7dc] transition duration-300 group-hover:-rotate-6 group-hover:bg-[#ffdc32]">
                        <Icon path={PIN_PATH} />
                      </span>
                    </div>

                    <div className="flex flex-1 flex-col px-5 pb-5 pt-10 sm:px-6 sm:pb-6">
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#65748a]">{t('Public listing')}</p>
                      <h3 className="mt-1 font-display text-2xl font-extrabold text-[#092a53]">{t(location.area)}</h3>

                      <dl className="mt-5 space-y-3">
                        <div className="flex items-start gap-3">
                          <dt className="sr-only">{t('Address or landmark')}</dt>
                          <span aria-hidden="true" className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-[#fff6d1] text-[#806a00]">
                            <Icon className="size-4" path={PIN_PATH} />
                          </span>
                          <dd className="text-sm font-semibold leading-6 text-[#52647b]">{t(location.address)}</dd>
                        </div>
                        <div className="flex items-center gap-3">
                          <dt className="sr-only">{t('Phone')}</dt>
                          <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#f1f5f8] text-[#092a53]">
                            <Icon className="size-4" path={PHONE_PATH} />
                          </span>
                          <dd className={`text-sm font-semibold ${location.phone ? 'tabular-nums text-[#52647b]' : 'text-[#9aa5b3]'}`}>
                            {location.phone || t('Phone not listed')}
                          </dd>
                        </div>
                      </dl>

                      <div className="mt-auto flex items-center gap-2 border-t border-[#efebe1] pt-5">
                        <a
                          className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#092a53] px-4 py-3 text-xs font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-[#163e6b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] focus-visible:ring-offset-2"
                          href={mapsUrl(location)}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {t('Check map listing')} <ArrowIcon diagonal />
                        </a>
                        {location.phone && (
                          <a
                            aria-label={`${t('Call')} ${t(location.area)}`}
                            className="grid size-11 shrink-0 place-items-center rounded-full bg-[#ffdc32] text-[#092a53] transition hover:-translate-y-0.5 hover:bg-[#ffe76c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] focus-visible:ring-offset-2"
                            href={`tel:${location.phone.replaceAll(' ', '')}`}
                          >
                            <Icon className="size-[18px]" path={PHONE_PATH} />
                          </a>
                        )}
                        <a
                          className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-3 text-xs font-bold text-[#65748a] transition hover:bg-[#fbfaf5] hover:text-[#092a53]"
                          href={location.source}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <span className="max-sm:sr-only">{t('Reference')}</span> <span aria-hidden="true">↗</span>
                        </a>
                      </div>
                    </div>
                  </article>
                </li>
              )
            })}
          </ul>

          <aside className="mt-10 flex flex-col gap-5 rounded-[28px] bg-white p-6 shadow-[0_1px_0_rgba(9,42,83,0.04),0_10px_30px_rgba(9,42,83,0.06)] ring-1 ring-[#ebe7dc] sm:flex-row sm:items-center sm:p-8">
            <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#092a53] font-display text-lg font-extrabold text-[#ffdc32]">i</span>
            <div className="flex-1">
              <h2 className="font-display text-lg font-extrabold text-[#092a53]">{t('Please verify before visiting')}</h2>
              <p className="mt-1 text-sm leading-6 text-[#65748a]">{t('These neighborhood and address details come from publicly available map and local social listings, not direct confirmation from each shop. Opening hours, phone numbers and current operation may change.')}</p>
            </div>
            <Link className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full border border-[#d9d4c7] px-5 py-3 text-xs font-extrabold text-[#092a53] transition hover:-translate-y-0.5 hover:border-[#092a53]" to="/contact">
              {t('Contact us')} <ArrowIcon />
            </Link>
          </aside>
        </section>
      </main>
      <Footer />
    </div>
  )
}
