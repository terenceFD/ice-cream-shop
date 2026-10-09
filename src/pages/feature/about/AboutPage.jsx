import { Link } from 'react-router-dom'
import { Footer, Header } from '../../../components/Layout'
import { useLanguage } from '../../../language/LanguageContext'

export function AboutPage() {
  const { t } = useLanguage()

  return (
    <div className="min-h-screen bg-[#f8f7f2] text-[#102c50]">
      <Header />
      <main>
        <section className="mx-auto max-w-[1320px] px-5 py-12 sm:px-8 sm:py-20 lg:px-12">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_0.9fr]">
            <div className="max-w-2xl">
              <p className="mb-3 inline-block rounded-full bg-[#ffeb9c] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em]">
                {t('Independent brand guide')}
              </p>
              <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl">
                {t('Cold Stone Creamery')}
              </h1>
              <p className="mt-6 text-base leading-7 text-[#65748a] sm:text-lg sm:leading-8">
                {t('Cold Stone is known internationally for ice cream mixed to order on a frozen granite stone. This independent guide brings together public information about its Cameroon listings and the brand’s global treat categories.')}
              </p>
              <p className="mt-4 text-base leading-7 text-[#65748a] sm:text-lg sm:leading-8">
                {t('Local public listings point to neighborhoods in Douala and Yaounde. Branch details, operating status, menu and prices can change, so confirm with a current local listing before visiting.')}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link className="rounded-full bg-[#ffdc32] px-6 py-3 text-sm font-bold transition hover:bg-[#ffe76c]" to="/locations">
                  {t('Available locations')}
                </Link>
                <Link className="rounded-full border-2 border-[#65748a] px-6 py-3 text-sm font-bold transition hover:bg-[#f4f1e7]" to="/menu">
                  {t('Explore the menu')}
                </Link>
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-xl">
              <div aria-hidden="true" className="absolute -right-3 -top-3 size-24 rounded-full bg-[#ffdc32] sm:-right-5 sm:-top-5 sm:size-32" />
              <img
                alt={t('Ice cream treats')}
                className="relative aspect-[1.1] w-full rounded-[30px] object-cover shadow-[0_24px_60px_rgba(18,44,80,0.15)]"
                src="/images/hero-ice-cream.jpg"
              />
            </div>
          </div>
        </section>

        <section className="bg-[#092a53] px-5 py-14 text-white sm:px-8 sm:py-20">
          <div className="mx-auto max-w-[1160px]">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#ffdc32]">{t('The signature experience')}</p>
            <h2 className="mt-2 max-w-2xl font-display text-3xl font-bold sm:text-4xl">{t('A treat made your way')}</h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/75 sm:text-base">
              {t('The brand’s signature approach is to combine ice cream with chosen mix-ins on a frozen granite stone. Its global menu also features Signature Creations, cakes and pies, cupcakes, shakes and smoothies. Cameroon branches may offer a different selection.')}
            </p>
          </div>
        </section>

        <aside className="mx-auto my-10 max-w-[1160px] rounded-[24px] border border-[#eadb8a] bg-[#fff9dc] p-5 text-sm leading-6 text-[#624f00] sm:my-14 sm:p-7">
          <h2 className="font-bold">{t('Independent information notice')}</h2>
          <p className="mt-1">{t('This website is an independent information guide and is not an official Cold Stone Creamery website. We are not confirming a business affiliation, branch hours, local menu or local prices. The separate online catalog and checkout on this site are managed by this site’s operator and are not confirmed Cold Stone Cameroon products or prices.')}</p>
        </aside>
      </main>
      <Footer />
    </div>
  )
}
