import { Footer, Header } from '../../../components/Layout'
import { cameroonLocations } from '../../../data'
import { useLanguage } from '../../../language/LanguageContext'

export function LocationsPage() {
  const { t } = useLanguage()
  const cityCount = new Set(cameroonLocations.map((location) => location.town)).size

  return (
    <div className="min-h-screen bg-[#f8f7f2] text-[#102c50]">
      <Header />
      <main>
        <section className="px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8">
          <div className="relative isolate mx-auto max-w-[1440px] overflow-hidden rounded-[30px] bg-[#092a53] px-6 py-9 text-white shadow-[0_20px_60px_rgba(9,42,83,0.16)] sm:px-10 sm:py-12 lg:px-14 lg:py-14">
            <div aria-hidden="true" className="absolute -right-24 -top-36 -z-10 size-[28rem] rounded-full border-[62px] border-white/[0.045]" />
            <div aria-hidden="true" className="absolute -bottom-36 right-[28%] -z-10 size-72 rounded-full bg-[#ffdc32]/[0.08] blur-3xl" />
            <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_0.75fr] lg:gap-14">
              <div className="max-w-2xl">
                <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-2 text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#ffdc32]">
                  <svg aria-hidden="true" className="size-3.5" fill="none" viewBox="0 0 20 20">
                    <path d="M16 8.2c0 4.8-6 9.3-6 9.3S4 13 4 8.2a6 6 0 1 1 12 0Z" stroke="currentColor" strokeWidth="1.7" />
                    <circle cx="10" cy="8" r="2" stroke="currentColor" strokeWidth="1.7" />
                  </svg>
                  {t('Cameroon branch listings')}
                </p>
                <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                  {t('Find Cold Stone Creamery')}
                </h1>
                <p className="mt-4 max-w-xl text-sm leading-7 text-white/75 sm:text-base">
                  {t('Public listings currently point to locations in Douala and Yaounde. Details can change; check the map listing or local pages before you travel.')}
                </p>
                <a className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#ffdc32] px-5 py-3 text-sm font-extrabold text-[#092a53] transition hover:-translate-y-0.5 hover:bg-[#ffe76c]" href="#listed-locations">
                  {t('Explore listed locations')} <span aria-hidden="true">↓</span>
                </a>
              </div>

              <div className="relative mx-auto w-full max-w-md">
                <div className="rounded-[26px] border border-white/15 bg-white/[0.07] p-5 backdrop-blur-sm sm:p-6">
                  <div className="flex items-center justify-between gap-4 border-b border-white/15 pb-5">
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/55">{t('Location overview')}</p>
                      <p className="mt-1 font-display text-2xl font-extrabold">{t('{count} public listings', { count: cameroonLocations.length })}</p>
                    </div>
                    <span aria-hidden="true" className="grid size-12 place-items-center rounded-2xl bg-[#ffdc32] text-xl text-[#092a53]">⌖</span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {[...new Set(cameroonLocations.map((location) => location.town))].map((town) => (
                      <div className="rounded-2xl border border-white/10 bg-[#061f40]/40 p-4" key={town}>
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/55">{t('City')}</p>
                        <p className="mt-1 font-display text-lg font-extrabold">{t(town)}</p>
                        <p className="mt-1 text-xs text-white/65">{t('{count} listings', { count: cameroonLocations.filter((location) => location.town === town).length })}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-white/65">
                    <span aria-hidden="true" className="mt-px text-[#ffdc32]">ⓘ</span>
                    {t('Public listings are independently gathered and should be confirmed before travelling.')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1320px] px-5 py-10 sm:px-8 sm:py-14 lg:px-12" id="listed-locations">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#a48700]">{t('Explore by city')}</p>
              <h2 className="mt-1 font-display text-3xl font-extrabold tracking-tight">{t('Listed locations')}</h2>
            </div>
            <span className="rounded-full border border-[#e7e3d9] bg-white px-4 py-2 text-xs font-bold text-[#65748a]">
              {t('{count} cities', { count: cityCount })}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {cameroonLocations.map((location, index) => (
              <article className="group relative overflow-hidden rounded-[24px] border border-[#e7e3d9] bg-white shadow-[0_8px_28px_rgba(18,44,80,0.05)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_42px_rgba(18,44,80,0.1)]" key={`${location.town}-${location.area}`}>
                <div className="flex items-center justify-between gap-4 border-b border-[#eeeae1] bg-[#fffefa] px-5 py-4 sm:px-6">
                  <div className="flex items-center gap-3">
                    <span aria-hidden="true" className="grid size-11 place-items-center rounded-2xl bg-[#fff3b8] text-[#806a00]">
                      <svg className="size-5" fill="none" viewBox="0 0 20 20">
                        <path d="M16 8.2c0 4.8-6 9.3-6 9.3S4 13 4 8.2a6 6 0 1 1 12 0Z" stroke="currentColor" strokeWidth="1.7" />
                        <circle cx="10" cy="8" r="2" stroke="currentColor" strokeWidth="1.7" />
                      </svg>
                    </span>
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#a48700]">{t(location.town)}</p>
                      <h3 className="mt-0.5 font-display text-xl font-extrabold text-[#092a53]">{t(location.area)}</h3>
                    </div>
                  </div>
                  <span className="rounded-full bg-[#f1f3f5] px-3 py-1.5 text-[10px] font-bold text-[#65748a]">{t('Public listing')} · {String(index + 1).padStart(2, '0')}</span>
                </div>

                <div className="p-5 sm:p-6">
                  <div className="flex items-start gap-3">
                    <span aria-hidden="true" className="mt-0.5 text-[#bd9c00]">⌖</span>
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#8792a0]">{t('Address or landmark')}</p>
                      <p className="mt-1 text-sm font-semibold leading-6 text-[#52647b]">{t(location.address)}</p>
                    </div>
                  </div>
                  {location.phone && (
                    <a className="mt-4 inline-flex items-center gap-3 text-sm font-semibold text-[#52647b] transition hover:text-[#806a00]" href={`tel:${location.phone.replaceAll(' ', '')}`}>
                      <span aria-hidden="true" className="grid size-8 place-items-center rounded-lg bg-[#f1f5f8] text-[#092a53]">☎</span>
                      {location.phone}
                    </a>
                  )}
                  <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[#eeeae1] pt-4">
                    <a
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-[#092a53] px-5 py-3 text-xs font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-[#163e6b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] focus-visible:ring-offset-2"
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.mapQuery)}`}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {t('Check map listing')}
                      <svg aria-hidden="true" className="size-3.5" fill="none" viewBox="0 0 20 20">
                        <path d="M5 15 15 5M6 5h9v9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                      </svg>
                    </a>
                    <a className="inline-flex items-center gap-1.5 px-2 py-2 text-xs font-bold text-[#65748a] transition hover:text-[#092a53]" href={location.source} rel="noreferrer" target="_blank">
                      {t('Reference')} <span aria-hidden="true">↗</span>
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <aside className="mt-6 flex gap-4 rounded-[22px] border border-[#eadb8a] bg-[#fff9dc] p-5 sm:p-6">
            <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/80 text-lg text-[#806a00]">ⓘ</span>
            <div>
              <h2 className="font-display text-lg font-extrabold text-[#624f00]">{t('Please verify before visiting')}</h2>
              <p className="mt-1 text-sm leading-6 text-[#715e00]">{t('These neighborhood and address details come from publicly available map and local social listings, not direct confirmation from each shop. Opening hours, phone numbers and current operation may change.')}</p>
            </div>
          </aside>
        </section>
      </main>
      <Footer />
    </div>
  )
}
