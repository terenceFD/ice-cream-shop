import { Footer, Header } from '../../../components/Layout'
import { cameroonLocations } from '../../../data'
import { useLanguage } from '../../../language/LanguageContext'

export function LocationsPage() {
  const { t } = useLanguage()

  return (
    <div className="min-h-screen bg-[#f8f7f2] text-[#102c50]">
      <Header />
      <main className="mx-auto max-w-[1160px] px-5 py-10 sm:px-8 sm:py-16 lg:px-12">
        <div className="mb-9 max-w-3xl">
          <p className="mb-2 inline-block rounded-full bg-[#ffeb9c] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em]">
            {t('Cameroon branch listings')}
          </p>
          <h1 className="font-display text-5xl font-bold tracking-tight sm:text-6xl">
            {t('Find Cold Stone Creamery')}
          </h1>
          <p className="mt-3 text-base leading-7 text-[#65748a]">
            {t('Public listings currently point to locations in Douala and Yaounde. Details can change; check the map listing or local pages before you travel.')}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {cameroonLocations.map((location) => (
            <article className="rounded-[24px] border border-[#d9d6cc] bg-white p-5 shadow-[0_8px_30px_rgba(18,44,80,0.05)] sm:p-6" key={`${location.town}-${location.area}`}>
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#bd9c00]">{t(location.town)}</p>
              <h2 className="mt-1 font-display text-2xl font-bold">{t(location.area)}</h2>
              <p className="mt-3 text-sm leading-6 text-[#65748a]">{t(location.address)}</p>
              {location.phone && (
                <a className="mt-2 inline-block text-sm font-semibold text-[#65748a] hover:text-[#bd9c00]" href={`tel:${location.phone.replaceAll(' ', '')}`}>
                  {location.phone}
                </a>
              )}
              <a
                className="mt-5 inline-flex rounded-full bg-[#ffdc32] px-5 py-2.5 text-sm font-bold text-[#102c50] transition hover:bg-[#ffe76c]"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.mapQuery)}`}
                rel="noreferrer"
                target="_blank"
              >
                {t('Check map listing')}
              </a>
              <a className="ml-4 text-sm font-semibold text-[#65748a] underline decoration-[#bd9c00] underline-offset-4 hover:text-[#bd9c00]" href={location.source} rel="noreferrer" target="_blank">
                {t('Reference')}
              </a>
            </article>
          ))}
        </div>

        <aside className="mt-8 rounded-[24px] border border-[#eadb8a] bg-[#fff9dc] p-5 text-sm leading-6 text-[#624f00] sm:p-6">
          <h2 className="font-bold">{t('Please verify before visiting')}</h2>
          <p className="mt-1">{t('These neighborhood and address details come from publicly available map and local social listings, not direct confirmation from each shop. Opening hours, phone numbers and current operation may change.')}</p>
        </aside>
      </main>
      <Footer />
    </div>
  )
}
