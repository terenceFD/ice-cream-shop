import { Link } from 'react-router-dom'
import { Footer, Header } from '../../../components/Layout'
import { useLanguage } from '../../../language/LanguageContext'

const experienceSteps: { number: string; title: string; description: string; icon: string }[] = [
  {
    number: '01',
    title: 'Choose your favorite',
    description: 'Start with an ice cream flavor that sounds good to you.',
    icon: '✦',
  },
  {
    number: '02',
    title: 'Make it your own',
    description: 'Explore mix-ins and combinations from the signature creations.',
    icon: '＋',
  },
  {
    number: '03',
    title: 'Enjoy the moment',
    description: 'Savor a treat mixed to bring your chosen flavors together.',
    icon: '♡',
  },
]

export function AboutPage() {
  const { t } = useLanguage()

  return (
    <div className="min-h-screen bg-white text-[#102c50]">
      <Header />
      <main>
        <section className="relative isolate overflow-hidden bg-[#092a53] text-white">
          <div aria-hidden="true" className="absolute -right-28 -top-32 size-[28rem] rounded-full border-[70px] border-white/[0.04]" />
          <div className="relative mx-auto grid max-w-[1320px] items-center gap-12 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[0.95fr_1.05fr] lg:px-12 lg:py-24">
            <div className="relative z-10 max-w-2xl">
              <p className="mb-5 inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#ffdc32]">
                {t('Independent brand guide')}
              </p>
              <h1 className="font-display text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
                {t('Cold Stone Creamery')}
                <span className="mt-2 block text-[#ffdc32]">{t('The joy is in the mix.')}</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-white/75 sm:text-lg sm:leading-8">
                {t('An independent guide to Cold Stone’s signature ice cream experience and publicly listed locations in Cameroon.')}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link className="inline-flex items-center justify-center rounded-full bg-[#ffdc32] px-6 py-3.5 text-sm font-bold text-[#092a53] transition hover:-translate-y-0.5 hover:bg-[#ffe76c]" to="/menu">
                  {t('Explore the menu')}
                </Link>
                <Link className="inline-flex items-center justify-center rounded-full border border-white/35 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-white/10" to="/locations">
                  {t('Available locations')}
                </Link>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[610px] pb-5 pr-5 sm:pb-7 sm:pr-7">
              <div aria-hidden="true" className="absolute bottom-0 right-0 h-[72%] w-[72%] rounded-[34px] bg-[#ffdc32]" />
              <img
                alt={t('Ice cream treats')}
                className="relative z-10 aspect-[1.08] w-full rounded-[30px] object-cover shadow-[0_24px_70px_rgba(0,0,0,0.28)] sm:rounded-[38px]"
                src="/images/hero-ice-cream.jpg"
              />
              <div className="absolute -bottom-1 left-0 z-20 flex max-w-[245px] items-center gap-3 rounded-2xl border border-[#d9d6cc] bg-white p-3 text-[#102c50] shadow-[0_12px_32px_rgba(0,0,0,0.18)] sm:-left-5 sm:max-w-[290px] sm:p-4">
                <img alt="" aria-hidden="true" className="size-14 shrink-0 rounded-xl object-cover sm:size-16" src="/ice-images/ice-4.webp" />
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#806a00]">{t('The signature experience')}</p>
                  <p className="mt-1 font-display text-sm font-bold sm:text-base">{t('A treat made your way')}</p>
                </div>
              </div>
              <img alt="" aria-hidden="true" className="absolute -right-1 top-5 z-20 size-20 rounded-2xl border-4 border-[#092a53] object-cover shadow-lg sm:-right-3 sm:top-8 sm:size-28" src="/ice-images/ice-3.webp" />
            </div>
          </div>
        </section>

        <section aria-labelledby="about-guide-heading" className="px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
          <div className="mx-auto grid max-w-[1160px] gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#a48700]">{t('About this guide')}</p>
              <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl" id="about-guide-heading">
                {t('A little more joy in every scoop.')}
              </h2>
              <span aria-hidden="true" className="mt-5 block h-1 w-14 rounded-full bg-[#ffdc32]" />
            </div>
            <div className="space-y-5 text-base leading-7 text-[#65748a] sm:text-lg sm:leading-8">
              <p>{t('Cold Stone is known internationally for ice cream mixed to order on a frozen granite stone. Its signature approach brings chosen mix-ins together with ice cream for a treat made to your taste.')}</p>
              <p>{t('This independent website gathers information about the brand’s global treat categories and publicly listed locations in Cameroon. Local menus, availability, branch details and prices may differ or change.')}</p>
              <Link className="inline-flex items-center gap-2 font-bold text-[#102c50] underline decoration-[#ffdc32] decoration-2 underline-offset-4 transition hover:text-[#806a00]" to="/menu">
                {t('Discover the menu')}
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </section>

        <section aria-labelledby="signature-experience-heading" className="bg-[#fbfaf5] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
          <div className="mx-auto max-w-[1160px]">
            <div className="mx-auto mb-10 max-w-2xl text-center sm:mb-12">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#a48700]">{t('The signature experience')}</p>
              <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl" id="signature-experience-heading">
                {t('A treat made your way')}
              </h2>
              <p className="mt-4 text-sm leading-6 text-[#65748a] sm:text-base sm:leading-7">
                {t('Discover the simple idea behind the signature mix-in experience. Menu and ingredient availability may vary by location.')}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {experienceSteps.map((step) => (
                <article className="rounded-[22px] border border-[#e7e3d9] bg-white p-6 shadow-[0_8px_30px_rgba(18,44,80,0.05)] sm:p-7" key={step.number}>
                  <div className="flex items-center justify-between">
                    <span aria-hidden="true" className="grid size-12 place-items-center rounded-2xl bg-[#ffed9a] text-xl font-bold text-[#092a53]">{step.icon}</span>
                    <span className="font-display text-sm font-extrabold tracking-[0.12em] text-[#9c8a48]">{step.number}</span>
                  </div>
                  <h3 className="mt-6 font-display text-xl font-bold">{t(step.title)}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#65748a]">{t(step.description)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-12 sm:px-8 sm:py-16 lg:px-12">
          <div className="mx-auto grid max-w-[1160px] gap-8 rounded-[26px] bg-[#fff8dd] p-6 sm:p-9 lg:grid-cols-[1fr_auto] lg:items-center lg:p-10">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#806a00]">{t('Independent information notice')}</p>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#624f00] sm:text-base sm:leading-7">
                {t('This website is an independent information guide and is not an official Cold Stone Creamery website. We are not confirming a business affiliation, branch hours, local menu or local prices. The separate online catalog and checkout on this site are managed by this site’s operator and are not confirmed Cold Stone Cameroon products or prices.')}
              </p>
            </div>
            <Link className="inline-flex w-fit items-center justify-center rounded-full bg-[#092a53] px-6 py-3.5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#163e6b]" to="/locations">
              {t('Browse locations')}
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
