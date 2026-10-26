import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowIcon, Footer, Header } from '../../components/Layout'
import { cameroonLocations } from '../../../shared/data'
import { useLanguage } from '../../language/useLanguage'
import './LocationsPage.css'

type CameroonLocation = (typeof cameroonLocations)[number]

const PIN_PATH = 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z'
const PHONE_PATH = 'M5 4h3.5l1.7 4.2-2.2 1.4a11 11 0 0 0 6.4 6.4l1.4-2.2L20 15.5V19a1.5 1.5 0 0 1-1.6 1.5C10.6 20 4 13.4 3.5 5.6A1.5 1.5 0 0 1 5 4Z'

const neighborhoodPhotos = [
  {
    src: '/images/locations/rond-point-bonanjo-douala.jpg',
    alt: 'Roundabout in Bonanjo, Douala',
    label: 'Bonanjo, Douala',
    className: 'col-span-2 row-span-1',
    width: 1280,
    height: 853,
    title: 'Rond Point Bonanjo Douala',
    creator: 'Minette Lontsie',
    via: 'Wikimedia Commons',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    sourceUrl: 'https://commons.wikimedia.org/w/index.php?curid=89170322',
  },
  {
    src: '/images/locations/rue-de-narvik-yaounde-cameroon.jpg',
    alt: 'Street scene in Yaoundé, Cameroon',
    label: 'Yaoundé',
    className: 'col-start-3 row-span-2',
    width: 1280,
    height: 720,
    title: 'Rue De Narvik, Yaounde, Cameroon',
    creator: 'Ambo64',
    via: 'Wikimedia Commons',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Rue_De_Narvik,_Yaounde,_Cameroon.jpg',
  },
  {
    src: '/images/locations/rue-de-bonamoussadi-quifeurou.jpg',
    alt: 'Street in Bonamoussadi, Douala',
    label: 'Bonamoussadi, Douala',
    className: 'col-start-1 row-start-2',
    width: 1280,
    height: 720,
    title: 'Rue de Bonamoussadi - Quifeurou',
    creator: 'Serieminou',
    via: 'Wikimedia Commons',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Rue_de_Bonamoussadi_-_Quifeurou.jpg',
  },
  {
    src: '/images/locations/carrefour-bastos.jpg',
    alt: 'Carrefour in Bastos, Yaoundé',
    label: 'Bastos, Yaoundé',
    className: 'col-start-2 row-start-2',
    width: 1024,
    height: 768,
    title: 'Carrefour Bastos',
    creator: 'EOS Cameroun',
    via: 'Flickr',
    license: 'CC BY-SA 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/',
    sourceUrl: 'https://www.flickr.com/photos/89095162@N00/7576504658',
  },
]

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

function extraLink(location: CameroonLocation) {
  try {
    const host = new URL(location.source).hostname
    if (host.includes('facebook.com')) return { href: location.source, label: 'Facebook' }
  } catch {
    return null
  }
  return null
}

export function LocationsPage() {
  const { t } = useLanguage()
  const [city, setCity] = useState('')
  const towns = [...new Set(cameroonLocations.map((location: CameroonLocation) => location.town))]
  const countIn = (town: string) => cameroonLocations.filter((location: CameroonLocation) => location.town === town).length
  const listingsLabel = (count: number) => (count === 1 ? t('{count} listing', { count }) : t('{count} listings', { count }))
  const visibleLocations = cameroonLocations.filter((location: CameroonLocation) => !city || location.town === city)

  return (
    <div className="min-h-[100svh] bg-[#f5f8fb] text-[#092a53]">
      <Header />
      <main id="main" tabIndex={-1}>
        <section className="relative overflow-hidden bg-[#edf3f8]">
          <svg aria-hidden="true" className="pointer-events-none absolute -right-56 top-[30rem] h-[26rem] w-[22rem] text-[#ffdc32]/25 sm:-right-32 sm:top-[22rem] sm:h-[38rem] sm:w-[32rem] lg:-top-64 lg:h-[44rem] lg:w-[38rem]" fill="currentColor" viewBox="0 0 400 500">
            <path d="M200 486C162 430 31 300 31 199a169 169 0 1 1 338 0c0 101-131 231-169 287Z" />
          </svg>
          <div className="relative mx-auto grid max-w-[1320px] items-center gap-12 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-12 lg:gap-14 lg:px-12 lg:py-24">
            <div className="lg:col-span-5">
              <h1 className="location-reveal max-w-[12ch] font-display text-5xl font-extrabold leading-[0.98] tracking-tight text-[#092a53] text-balance sm:text-6xl lg:text-7xl">
                {t('Find us in Cameroon')}
              </h1>
              <p className="location-reveal mt-6 max-w-[60ch] text-base leading-7 text-[#334c63] sm:text-lg sm:leading-8" style={{ animationDelay: '70ms' }}>
                {t('Browse five public listings across Douala and Yaoundé. Open a listing for directions, and call ahead where a number is shown.')}
              </p>
              <div className="location-reveal mt-8 flex flex-wrap gap-3" style={{ animationDelay: '140ms' }}>
                <a
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#092a53] px-6 py-3 text-sm font-extrabold text-white transition-colors hover:bg-[#174477] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] focus-visible:ring-offset-2"
                  href="#listed-locations"
                >
                  {t('Browse locations')}
                  <span aria-hidden="true">↓</span>
                </a>
                <Link
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-extrabold text-[#092a53] transition-colors hover:bg-[#fff4c4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] focus-visible:ring-offset-2"
                  to="/menu"
                >
                  {t('Explore the menu')}
                </Link>
              </div>
            </div>

            <div className="lg:col-span-7">
              <h2 className="location-reveal mb-4 text-sm font-bold text-[#334c63]" id="neighborhood-heading" style={{ animationDelay: '80ms' }}>
                {t('Street scenes around our listed locations')}
              </h2>
              <ul aria-labelledby="neighborhood-heading" className="grid aspect-[1.3] grid-cols-3 grid-rows-2 gap-2.5 sm:aspect-[1.1] sm:gap-4">
                {neighborhoodPhotos.map((photo, index) => (
                  <li className={`location-reveal group relative isolate min-h-0 overflow-hidden rounded-[22px] bg-[#dce6ee] ${photo.className}`} key={photo.src} style={{ animationDelay: `${140 + index * 70}ms` }}>
                    <img
                      alt={photo.alt}
                      className="size-full object-cover transition-transform duration-500 motion-reduce:transition-none motion-reduce:group-hover:scale-100 sm:group-hover:scale-[1.03]"
                      decoding="async"
                      data-location-shutter={index === 0 ? '' : undefined}
                      fetchPriority={index === 0 ? 'high' : 'auto'}
                      height={photo.height}
                      loading="eager"
                      src={photo.src}
                      width={photo.width}
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-black/55 px-3 py-2.5 text-[13px] font-bold text-white sm:px-4 sm:py-3 sm:text-sm">
                      {t(photo.label)}
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[13px] leading-5 text-[#334c63]">
                {t('These photos show neighborhood context, not Cold Stone shop interiors.')}
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="listed-locations-heading" className="mx-auto max-w-[1320px] scroll-mt-4 px-5 py-14 sm:px-8 sm:py-20 lg:px-12" id="listed-locations">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="location-reveal font-display text-4xl font-extrabold tracking-tight text-[#092a53] text-balance sm:text-5xl" id="listed-locations-heading">
                {t('Listed locations')}
              </h2>
            </div>
            <div aria-label={t('Filter by city')} className="location-reveal flex max-w-full flex-wrap gap-2" role="group" style={{ animationDelay: '80ms' }}>
              {['', ...towns].map((town) => {
                const active = city === town
                return (
                  <button
                    aria-pressed={active}
                    className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] focus-visible:ring-offset-2 ${
                      active
                        ? 'bg-[#092a53] text-white'
                        : 'bg-[#e6edf3] text-[#334c63] hover:bg-[#dce6ee] hover:text-[#092a53]'
                    }`}
                    key={town || 'all'}
                    onClick={() => setCity(town)}
                    type="button"
                  >
                    {town ? t(town) : t('All cities')}
                    <span className={`grid min-w-6 place-items-center rounded-full px-1.5 py-0.5 text-[13px] tabular-nums ${active ? 'bg-[#ffdc32] text-[#092a53]' : 'bg-[#edf3f8] text-[#334c63]'}`}>
                      {town ? countIn(town) : cameroonLocations.length}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <p aria-live="polite" className="sr-only">{listingsLabel(visibleLocations.length)}</p>

          <ul className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleLocations.map((location: CameroonLocation, index) => {
              const more = extraLink(location)
              return (
                <li className="location-reveal" key={`${location.town}-${location.area}`} style={{ animationDelay: `${index * 60}ms` }}>
                  <article className="flex h-full flex-col rounded-[24px] bg-white p-5 sm:p-6">
                    <div className="flex items-center gap-2 text-sm font-bold text-[#334c63]">
                      <span className="grid size-8 place-items-center rounded-full bg-[#fff4c4] text-[#092a53]">
                        <Icon className="size-4" path={PIN_PATH} />
                      </span>
                      {t(location.town)}
                      <span aria-hidden="true" className="ml-auto rounded-full bg-[#edf3f8] px-3 py-1 text-[13px] font-semibold">
                        {t('Public listing')}
                      </span>
                    </div>

                    <h3 className="mt-5 font-display text-2xl font-extrabold text-[#092a53]">{t(location.area)}</h3>
                    <p className="mt-1 text-base font-semibold leading-6 text-[#334c63]">{t(location.address)}</p>

                    {location.phone ? (
                      <a
                        className="mt-4 inline-flex w-fit items-center gap-2 text-sm font-bold tabular-nums text-[#092a53] underline decoration-[#e2bb00] decoration-2 underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00]"
                        href={`tel:${location.phone.replaceAll(' ', '')}`}
                      >
                        <Icon className="size-4" path={PHONE_PATH} />
                        {location.phone}
                      </a>
                    ) : (
                      <p className="mt-4 text-base text-[#334c63]">{t('Phone not listed')}</p>
                    )}

                    <div className="mt-auto flex flex-wrap items-center gap-2 rounded-full bg-[#f5f8fb] p-1">
                      <a
                        className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#092a53] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#174477] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] focus-visible:ring-offset-2"
                        href={mapsUrl(location)}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {t('Directions')} <ArrowIcon diagonal />
                      </a>
                      {location.phone && (
                        <a
                          aria-label={`${t('Call')} ${t(location.area)}`}
                          className="grid size-11 shrink-0 place-items-center rounded-full bg-[#ffdc32] text-[#092a53] transition-colors hover:bg-[#ffe76c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] focus-visible:ring-offset-2"
                          href={`tel:${location.phone.replaceAll(' ', '')}`}
                        >
                          <Icon className="size-[18px]" path={PHONE_PATH} />
                        </a>
                      )}
                      {more && (
                        <a
                          className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-bold text-[#092a53] underline decoration-[#e2bb00] decoration-2 underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00]"
                          href={more.href}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {t(more.label)}
                        </a>
                      )}
                    </div>
                  </article>
                </li>
              )
            })}
          </ul>

          <aside className="location-reveal mt-8 flex flex-col gap-4 rounded-[24px] bg-[#edf3f8] p-5 sm:flex-row sm:items-center sm:p-6">
            <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-[#ffdc32] text-[#092a53]">
              <Icon className="size-5" path={PIN_PATH} />
            </span>
            <div className="flex-1">
              <h2 className="font-display text-lg font-extrabold text-[#092a53]">{t('Before you go')}</h2>
              <p className="mt-1 max-w-[60ch] text-base leading-6 text-[#334c63]">{t('Hours are not listed. Directions open each public listing in Google Maps. Where a phone number is shown, call ahead to confirm today’s hours.')}</p>
            </div>
            <Link className="inline-flex min-h-11 w-fit shrink-0 items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-bold text-[#092a53] transition-colors hover:bg-[#fff4c4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] focus-visible:ring-offset-2" to="/contact">
              {t('Contact us')} <ArrowIcon />
            </Link>
          </aside>

        </section>
      </main>
      <Footer />
      <div className="bg-[#092a53] px-5 pb-6 text-white/75 sm:px-8 lg:px-12">
        <details className="mx-auto max-w-[1320px] text-[13px]">
          <summary className="w-fit cursor-pointer font-bold underline decoration-[#ffdc32] underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32]">
            {t('Photo credits and licences')}
          </summary>
          <ul className="mt-3 space-y-2 leading-5">
            {neighborhoodPhotos.map((photo) => (
              <li key={photo.src}>
                <a className="font-semibold underline underline-offset-2" href={photo.sourceUrl} rel="noreferrer" target="_blank">
                  {photo.title}
                </a>
                {' '}{t('by')} {photo.creator}.{' '}
                <a className="underline underline-offset-2" href={photo.licenseUrl} rel="noreferrer" target="_blank">{photo.license}</a>
                {' '}{t('via')} {t(photo.via)}.
              </li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  )
}
