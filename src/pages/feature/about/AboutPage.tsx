import { Link } from 'react-router-dom'
import { ArrowIcon, Footer, Header } from '../../../components/Layout'
import { useLanguage } from '../../../language/useLanguage'

const experienceSteps: { number: string; title: string; description: string; image: string }[] = [
  {
    number: '01',
    title: 'Choose your favorite',
    description: 'Start with an ice cream flavor that sounds good to you.',
    image: '/ice-images/ice-5.webp',
  },
  {
    number: '02',
    title: 'Make it your own',
    description: 'Explore mix-ins and combinations from the signature creations.',
    image: '/ice-images/ice-6.webp',
  },
  {
    number: '03',
    title: 'Enjoy the moment',
    description: 'Savor a treat mixed to bring your chosen flavors together.',
    image: '/ice-images/ice-9.jpg',
  },
]

const guideSections: { eyebrow: string; title: string; description: string; to: string; cta: string }[] = [
  {
    eyebrow: 'Menu guide',
    title: 'Global treat categories',
    description: 'Ice cream creations, shakes, cakes and more from the global Cold Stone menu.',
    to: '/menu',
    cta: 'Discover the menu',
  },
  {
    eyebrow: 'Locations',
    title: 'Publicly listed branches',
    description: 'Browse public listings for locations in Douala and Yaounde.',
    to: '/locations',
    cta: 'Browse locations',
  },
  {
    eyebrow: 'Online catalog',
    title: 'Order from this site',
    description: 'A separate catalog and checkout managed by this site’s operator.',
    to: `/menu?category=${encodeURIComponent('Ice Cream')}`,
    cta: 'Order now',
  },
]

const highlights: { value: string; label: string }[] = [
  { value: '01', label: 'Mixed to order' },
  { value: '02', label: 'On a frozen granite stone' },
  { value: '03', label: 'Made to your taste' },
]

export function AboutPage() {
  const { t } = useLanguage()

  return (
    <div className="min-h-screen bg-white text-[#102c50]">
      <Header />
      <main>
        {/* Hero */}
        <section className="relative isolate overflow-hidden bg-[#fbfaf5]">
          <div aria-hidden="true" className="absolute -right-48 -top-48 -z-10 size-[36rem] rounded-full bg-[#ffdc32]/15 blur-3xl" />
          <div className="mx-auto grid max-w-[1320px] items-center gap-14 px-5 pb-20 pt-14 sm:px-8 sm:pt-20 lg:grid-cols-12 lg:gap-12 lg:px-12 lg:pb-28 lg:pt-24">
            <div className="lg:col-span-6">
              <p className="inline-flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#a48700]">
                <span aria-hidden="true" className="h-px w-10 bg-[#a48700]" />
                {t('Independent brand guide')}
              </p>
              <h1 className="mt-6 font-display text-5xl font-extrabold leading-[0.98] tracking-tight text-[#092a53] sm:text-6xl lg:text-[5.25rem]">
                {t('Cold Stone Creamery')}
                <span className="mt-3 block text-[#092a53]/45">{t('The joy is in the mix.')}</span>
              </h1>
              <p className="mt-8 max-w-xl text-base leading-7 text-[#52647b] sm:text-lg sm:leading-8">
                {t('An independent guide to Cold Stone’s signature ice cream experience and publicly listed locations in Cameroon.')}
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-3">
                <Link
                  className="inline-flex items-center gap-2 rounded-full bg-[#092a53] px-7 py-4 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(9,42,83,0.2)] transition hover:-translate-y-0.5 hover:bg-[#163e6b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2"
                  to="/menu"
                >
                  {t('Explore the menu')} <ArrowIcon />
                </Link>
                <Link
                  className="inline-flex items-center gap-2 rounded-full border border-[#d9d4c7] bg-white px-7 py-4 text-sm font-extrabold text-[#092a53] transition hover:-translate-y-0.5 hover:border-[#092a53] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2"
                  to="/locations"
                >
                  {t('Available locations')}
                </Link>
              </div>
            </div>

            <div className="relative lg:col-span-6">
              <div className="grid grid-cols-5 gap-4">
                <figure className="col-span-3 overflow-hidden rounded-[32px] bg-[#fff3b8] shadow-[0_30px_70px_rgba(9,42,83,0.18)]">
                  <img
                    alt={t('Ice cream treats')}
                    className="aspect-[3/4] size-full object-cover transition duration-700 hover:scale-[1.03]"
                    src="/images/hero-ice-cream.jpg"
                  />
                </figure>
                <div className="col-span-2 flex flex-col gap-4 pt-12">
                  <figure className="overflow-hidden rounded-[24px] bg-[#fff3b8] shadow-[0_18px_40px_rgba(9,42,83,0.12)]">
                    <img alt="" aria-hidden="true" className="aspect-square size-full object-cover transition duration-700 hover:scale-[1.05]" src="/ice-images/ice-3.webp" />
                  </figure>
                  <figure className="overflow-hidden rounded-[24px] bg-[#fff3b8] shadow-[0_18px_40px_rgba(9,42,83,0.12)]">
                    <img alt="" aria-hidden="true" className="aspect-[4/5] size-full object-cover transition duration-700 hover:scale-[1.05]" src="/ice-images/ice-4.webp" />
                  </figure>
                </div>
              </div>
              <div className="absolute -bottom-8 left-4 flex max-w-[280px] items-center gap-4 rounded-2xl border border-[#eeeae1] bg-white/95 p-4 shadow-[0_20px_44px_rgba(9,42,83,0.16)] backdrop-blur-sm sm:left-8">
                <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#ffdc32] font-display text-lg font-extrabold text-[#092a53]">✦</span>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#a48700]">{t('The signature experience')}</p>
                  <p className="mt-1 font-display text-base font-bold text-[#092a53]">{t('A treat made your way')}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-[#e9e5da] bg-white">
            <ul className="mx-auto grid max-w-[1320px] divide-y divide-[#e9e5da] px-5 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-8 lg:px-12">
              {highlights.map((item) => (
                <li className="flex items-center gap-4 py-6 sm:justify-center sm:px-6" key={item.label}>
                  <span aria-hidden="true" className="font-display text-sm font-extrabold tabular-nums text-[#c9b24a]">{item.value}</span>
                  <span className="font-display text-base font-extrabold text-[#092a53] sm:text-lg">{t(item.label)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Story */}
        <section aria-labelledby="about-guide-heading" className="px-5 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-32">
          <div className="mx-auto grid max-w-[1200px] gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <div className="lg:sticky lg:top-28">
                <p className="inline-flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#a48700]">
                  <span aria-hidden="true" className="h-px w-10 bg-[#a48700]" />
                  {t('About this guide')}
                </p>
                <h2 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-[#092a53] sm:text-5xl" id="about-guide-heading">
                  {t('A little more joy in every scoop.')}
                </h2>
                <figure className="mt-10 hidden overflow-hidden rounded-[28px] bg-[#fff3b8] shadow-[0_20px_50px_rgba(9,42,83,0.12)] lg:block">
                  <img alt={t('A child enjoying ice cream')} className="aspect-[4/3] w-full object-cover object-[58%_30%]" loading="lazy" src="/ice-images/about-child.jpg" />
                </figure>
              </div>
            </div>
            <div className="lg:col-span-7 lg:pt-14">
              <blockquote className="border-l-4 border-[#ffdc32] pl-6 font-display text-2xl font-bold leading-snug text-[#092a53] sm:pl-8 sm:text-3xl sm:leading-snug">
                {t('Cold Stone is known internationally for ice cream mixed to order on a frozen granite stone. Its signature approach brings chosen mix-ins together with ice cream for a treat made to your taste.')}
              </blockquote>
              <p className="mt-10 text-base leading-8 text-[#52647b] sm:text-lg sm:leading-9">
                {t('This independent website gathers information about the brand’s global treat categories and publicly listed locations in Cameroon. Local menus, availability, branch details and prices may differ or change.')}
              </p>
              <figure className="mt-10 overflow-hidden rounded-[28px] bg-[#fff3b8] lg:hidden">
                <img alt={t('A child enjoying ice cream')} className="aspect-[4/3] w-full object-cover object-[58%_30%]" loading="lazy" src="/ice-images/about-child.jpg" />
              </figure>
              <Link
                className="group mt-10 inline-flex items-center gap-3 border-b-2 border-[#ffdc32] pb-1 text-base font-extrabold text-[#092a53] transition hover:border-[#092a53]"
                to="/menu"
              >
                {t('Discover the menu')}
                <span className="transition group-hover:translate-x-1"><ArrowIcon /></span>
              </Link>
            </div>
          </div>
        </section>

        {/* Signature experience */}
        <section aria-labelledby="signature-experience-heading" className="bg-[#092a53] px-5 py-20 text-white sm:px-8 sm:py-24 lg:px-12 lg:py-28">
          <div className="mx-auto max-w-[1200px]">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-2xl">
                <p className="inline-flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#ffdc32]">
                  <span aria-hidden="true" className="h-px w-10 bg-[#ffdc32]" />
                  {t('The signature experience')}
                </p>
                <h2 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl" id="signature-experience-heading">
                  {t('A treat made your way')}
                </h2>
              </div>
              <p className="max-w-sm text-sm leading-6 text-white/65">
                {t('Discover the simple idea behind the signature mix-in experience. Menu and ingredient availability may vary by location.')}
              </p>
            </div>

            <ol className="mt-14 grid gap-6 md:grid-cols-3 md:gap-8">
              {experienceSteps.map((step) => (
                <li className="group" key={step.number}>
                  <figure className="overflow-hidden rounded-[24px] bg-white/5">
                    <img alt="" aria-hidden="true" className="aspect-[4/3] w-full object-cover opacity-90 transition duration-700 group-hover:scale-[1.04] group-hover:opacity-100" loading="lazy" src={step.image} />
                  </figure>
                  <div className="mt-6 flex items-center gap-4 border-t border-white/15 pt-6">
                    <span className="font-display text-sm font-extrabold tabular-nums text-[#ffdc32]">{step.number}</span>
                    <h3 className="font-display text-xl font-extrabold">{t(step.title)}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-white/65">{t(step.description)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* What you'll find */}
        <section aria-labelledby="guide-sections-heading" className="px-5 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-28">
          <div className="mx-auto max-w-[1200px]">
            <div className="max-w-2xl">
              <p className="inline-flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#a48700]">
                <span aria-hidden="true" className="h-px w-10 bg-[#a48700]" />
                {t('What you’ll find here')}
              </p>
              <h2 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-[#092a53] sm:text-5xl" id="guide-sections-heading">
                {t('Everything in one place.')}
              </h2>
            </div>
            <div className="mt-12 grid overflow-hidden rounded-[28px] border border-[#e7e3d9] md:grid-cols-3">
              {guideSections.map((section) => (
                <Link
                  className="group flex min-h-[260px] flex-col border-b border-[#e7e3d9] bg-white p-7 transition-colors duration-300 last:border-b-0 hover:bg-[#fffbea] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#bd9c00] sm:p-9 md:border-b-0 md:border-r md:last:border-r-0"
                  key={section.title}
                  to={section.to}
                >
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#a48700]">{t(section.eyebrow)}</p>
                  <h3 className="mt-4 font-display text-2xl font-extrabold leading-tight text-[#092a53]">{t(section.title)}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#65748a]">{t(section.description)}</p>
                  <span className="mt-auto inline-flex items-center gap-2 pt-8 text-sm font-extrabold text-[#092a53]">
                    {t(section.cta)}
                    <span className="grid size-8 place-items-center rounded-full border border-[#e7e3d9] transition duration-300 group-hover:border-[#092a53] group-hover:bg-[#092a53] group-hover:text-white">
                      <ArrowIcon />
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Notice + CTA */}
        <section className="px-5 pb-20 sm:px-8 sm:pb-24 lg:px-12">
          <div className="mx-auto max-w-[1200px] space-y-6">
            <aside aria-labelledby="independent-notice-heading" className="flex gap-5 rounded-[24px] border border-[#ecdfa6] bg-[#fffaf0] p-6 sm:p-8">
              <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-[#ffdc32]/40 font-display text-base font-extrabold text-[#806a00]">i</span>
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#806a00]" id="independent-notice-heading">{t('Independent information notice')}</p>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-[#624f00]">
                  {t('This website is an independent information guide and is not an official Cold Stone Creamery website. We are not confirming a business affiliation, branch hours, local menu or local prices. The separate online catalog and checkout on this site are managed by this site’s operator and are not confirmed Cold Stone Cameroon products or prices.')}
                </p>
              </div>
            </aside>

            <div className="relative isolate overflow-hidden rounded-[28px] bg-[#ffdc32] px-7 py-10 text-[#092a53] sm:px-12 sm:py-14">
              <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-[#ffe76c] via-[#ffdc32] to-[#f2c900]" />
              <div aria-hidden="true" className="absolute -right-20 -top-24 -z-10 size-72 rounded-full border-[44px] border-white/25" />
              <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
                <h2 className="max-w-xl font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
                  {t('A little joy')} <span className="text-[#092a53]/60">{t('in every scoop.')}</span>
                </h2>
                <div className="flex flex-wrap gap-3">
                  <Link
                    className="inline-flex items-center gap-2 rounded-full bg-[#092a53] px-7 py-4 text-sm font-extrabold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-[#163e6b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2 focus-visible:ring-offset-[#ffdc32]"
                    to="/menu"
                  >
                    {t('Explore the menu')} <ArrowIcon />
                  </Link>
                  <Link
                    className="inline-flex items-center gap-2 rounded-full border border-[#092a53]/25 px-7 py-4 text-sm font-extrabold text-[#092a53] transition hover:-translate-y-0.5 hover:border-[#092a53] hover:bg-white/40"
                    to="/locations"
                  >
                    {t('Browse locations')}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
