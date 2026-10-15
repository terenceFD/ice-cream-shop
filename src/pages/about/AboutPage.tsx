import { Link } from 'react-router-dom'
import { photoSrcSet } from '../../../thumbnails'
import { ArrowIcon, Footer, Header } from '../../../components/Layout'
import { PageHero } from '../../../components/PageHero'
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

const guideSections: { eyebrow: string; title: string; description: string; to: string; cta: string; icon: string }[] = [
  {
    eyebrow: 'Menu guide',
    title: 'Global treat categories',
    description: 'Ice cream creations, shakes, cakes and more from the global Cold Stone menu.',
    to: '/menu',
    cta: 'Discover the menu',
    icon: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Zm0 13a3 3 0 0 1 3-3h11M9 8h6',
  },
  {
    eyebrow: 'Locations',
    title: 'Publicly listed branches',
    description: 'Browse public listings for locations in Douala and Yaounde.',
    to: '/locations',
    cta: 'Browse locations',
    icon: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  },
  {
    eyebrow: 'Online catalog',
    title: 'Order from this site',
    description: 'A separate catalog and checkout managed by this site’s operator.',
    to: `/menu?category=${encodeURIComponent('Ice Cream')}`,
    cta: 'Order now',
    icon: 'M5 8h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9L5 8Zm4 0V6.5a3 3 0 0 1 6 0V8',
  },
]

const highlights: { value: string; label: string; icon: string }[] = [
  { value: '01', label: 'Mixed to order', icon: 'M13.6 4.6c1.9-1.9 4.6-1.8 5.8-.6s1.3 3.9-.6 5.8-4.5 2.1-5.6 1-1.5-4.3.4-6.2ZM13.2 10.8 4.5 19.5' },
  { value: '02', label: 'On a frozen granite stone', icon: 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5' },
  { value: '03', label: 'Made to your taste', icon: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z' },
]

export function AboutPage() {
  const { t } = useLanguage()

  return (
    <div className="min-h-screen bg-white text-[#102c50]">
      <Header />
      <main>
        {/* Hero */}
        <PageHero
          actions={
            <>
              <Link className={PageHero.primary} to="/menu">
                {t('Explore the menu')} <ArrowIcon />
              </Link>
              <Link className={PageHero.secondary} to="/locations">
                {t('Available locations')}
              </Link>
            </>
          }
          badge={{ mark: '✦', eyebrow: t('The signature experience'), text: t('A treat made your way') }}
          curveClassName="text-white"
          description={t('Ice cream mixed to order on a frozen granite stone with the mix-ins you love, at our branches in Douala and Yaoundé.')}
          eyebrow={t('Our story')}
          image={{ src: '/ice-images/about-child.jpg', alt: t('A child enjoying ice cream'), position: '74% 40%' }}
          sideImages={['/ice-images/ice-10.jpg', '/ice-images/ice-1.jpg']}
          subtitle={t('The joy is in the mix.')}
          title={t('Cold Stone Creamery')}
        />
        <div className="relative z-10 mx-auto -mt-6 max-w-[1320px] px-5 sm:-mt-10 sm:px-8 lg:-mt-14 lg:px-12">
          <ul className="relative grid overflow-hidden rounded-[28px] bg-white shadow-[0_24px_60px_rgba(9,42,83,0.14)] ring-1 ring-[#ebe7dc] before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-[#ffdc32] before:via-[#ffe76c] before:to-[#ffdc32] md:grid-cols-3">
            {highlights.map((item, index) => (
              <li
                className={`group flex items-center gap-4 px-6 py-5 transition-colors duration-300 hover:bg-[#fffbea] sm:px-8 sm:py-7 ${
                  index > 0 ? 'border-t border-[#efebe1] md:border-l md:border-t-0' : ''
                }`}
                key={item.label}
              >
                <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#092a53] text-[#ffdc32] shadow-[0_10px_22px_rgba(9,42,83,0.2)] transition duration-300 group-hover:-rotate-6 group-hover:bg-[#ffdc32] group-hover:text-[#092a53]">
                  <svg className="size-6" fill="none" viewBox="0 0 24 24">
                    <path d={item.icon} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                  </svg>
                </span>
                <span className="min-w-0">
                  <span aria-hidden="true" className="block text-[10px] font-extrabold tabular-nums tracking-[0.18em] text-[#8a7000]">{item.value}</span>
                  <span className="mt-0.5 block font-display text-base font-extrabold leading-snug text-[#092a53] sm:text-lg">{t(item.label)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Story */}
        <section aria-labelledby="about-guide-heading" className="relative isolate overflow-hidden px-5 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-32">
          <div aria-hidden="true" className="absolute -left-40 top-1/3 -z-10 size-[28rem] rounded-full bg-[#ffdc32]/10 blur-3xl" />
          <div className="mx-auto grid max-w-[1200px] items-center gap-14 lg:grid-cols-12 lg:gap-16">
            <div className="relative mx-auto w-full max-w-[500px] lg:col-span-5 lg:max-w-none">
              <div aria-hidden="true" className="absolute -left-3 -top-3 h-full w-full rotate-[-4deg] rounded-[36px] bg-[#ffdc32] sm:-left-5 sm:-top-5" />
              <figure className="relative overflow-hidden rounded-[32px] bg-[#fff3b8] shadow-[0_30px_70px_rgba(9,42,83,0.18)]">
                <img decoding="async" alt={t('Ice cream treats')} className="aspect-[4/3] w-full object-cover sm:aspect-[4/5]" loading="lazy" sizes="(min-width: 1024px) 480px, 90vw" src="/images/hero-ice-cream.jpg" srcSet={photoSrcSet('/images/hero-ice-cream.jpg')} />
              </figure>
              <div className="absolute -bottom-6 right-4 flex items-center gap-3 rounded-2xl bg-white p-3 pr-5 shadow-[0_20px_44px_rgba(9,42,83,0.18)] ring-1 ring-[#eeeae1] sm:-right-6 sm:bottom-10 sm:p-4 sm:pr-6">
                <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#092a53] font-display text-base font-extrabold text-[#ffdc32]">✦</span>
                <div className="leading-tight">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#8a7000]">{t('Mixed to order')}</p>
                  <p className="mt-1 font-display text-sm font-extrabold text-[#092a53] sm:text-base">{t('On a frozen granite stone')}</p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              <p className="inline-flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#8a7000]">
                <span aria-hidden="true" className="h-px w-10 bg-[#a48700]" />
                {t('About us')}
              </p>
              <h2 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-[#092a53] sm:text-5xl" id="about-guide-heading">
                {t('A little more joy in every scoop.')}
              </h2>

              <figure className="relative mt-10 overflow-hidden rounded-[28px] bg-[#092a53] p-7 text-white shadow-[0_24px_54px_rgba(9,42,83,0.2)] sm:p-9">
                <div aria-hidden="true" className="absolute -right-14 -top-14 size-44 rounded-full border-[28px] border-white/[0.05]" />
                <span aria-hidden="true" className="block font-display text-7xl font-extrabold leading-[0.6] text-[#ffdc32]">“</span>
                <blockquote className="relative mt-4 font-display text-xl font-bold leading-snug sm:text-2xl sm:leading-snug">
                  {t('Cold Stone is known internationally for ice cream mixed to order on a frozen granite stone. Its signature approach brings chosen mix-ins together with ice cream for a treat made to your taste.')}
                </blockquote>
              </figure>

              <p className="mt-8 text-base leading-8 text-[#52647b] sm:text-lg sm:leading-9">
                {t('Choose your ice cream, pick your mix-ins and watch it all come together on the frozen stone. Visit us in Douala or Yaoundé, or order online for pickup or delivery.')}
              </p>
              <Link
                className="group mt-8 inline-flex items-center gap-3 rounded-full bg-[#092a53] py-2 pl-6 pr-2 text-sm font-extrabold text-white shadow-[0_12px_28px_rgba(9,42,83,0.2)] transition hover:-translate-y-0.5 hover:bg-[#163e6b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2"
                to="/menu"
              >
                {t('Discover the menu')}
                <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-[#ffdc32] text-[#092a53] transition group-hover:translate-x-0.5">
                  <ArrowIcon />
                </span>
              </Link>
            </div>
          </div>
        </section>

        {/* Signature experience */}
        <section aria-labelledby="signature-experience-heading" className="relative isolate overflow-hidden bg-[#092a53] px-5 py-20 text-white sm:px-8 sm:py-24 lg:px-12 lg:py-28">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -right-32 -top-32 size-[30rem] rounded-full bg-[#3f86d6]/30 blur-[120px]" />
            <div className="absolute -bottom-40 -left-24 size-[26rem] rounded-full bg-[#ffdc32]/10 blur-[110px]" />
            <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_80%)]" />
          </div>
          <div className="mx-auto max-w-[1200px]">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-2xl">
                <p className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.06] py-1.5 pl-2 pr-4 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#ffdc32]">
                  <span aria-hidden="true" className="grid size-5 place-items-center rounded-full bg-[#ffdc32] text-[10px] text-[#092a53]">✦</span>
                  {t('The signature experience')}
                </p>
                <h2 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl" id="signature-experience-heading">
                  {t('A treat made your way')}
                </h2>
              </div>
              <p className="max-w-sm border-l-2 border-[#ffdc32] pl-4 text-sm leading-6 text-white/70">
                {t('Discover the simple idea behind the signature mix-in experience. Menu and ingredient availability may vary by location.')}
              </p>
            </div>

            <ol className="relative mt-16 grid gap-6 md:grid-cols-3 md:gap-8">
              {experienceSteps.map((step, index) => (
                <li className="group relative flex flex-col rounded-[28px] border border-white/10 bg-white/[0.04] p-3 backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:border-white/25 hover:bg-white/[0.07]" key={step.number}>
                  <figure className="relative overflow-hidden rounded-[22px] bg-white/5">
                    <img decoding="async" alt="" aria-hidden="true" className="aspect-[4/3] w-full object-cover transition duration-700 group-hover:scale-[1.05]" loading="lazy" sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw" src={step.image} srcSet={photoSrcSet(step.image)} />
                    <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#061d3a]/50 via-transparent to-transparent" />
                  </figure>
                  <span
                    aria-hidden="true"
                    className="relative z-10 -mt-8 ml-5 grid size-16 place-items-center rounded-2xl bg-[#ffdc32] font-display text-xl font-extrabold tabular-nums text-[#092a53] shadow-[0_14px_30px_rgba(2,12,28,0.35)] ring-[6px] ring-[#0d3060] transition duration-300 group-hover:-rotate-6"
                  >
                    {step.number}
                  </span>
                  {index < experienceSteps.length - 1 && (
                    <span aria-hidden="true" className="absolute -right-[30px] top-[38%] z-20 hidden size-7 place-items-center rounded-full bg-[#ffdc32] text-[#092a53] shadow-lg md:grid">
                      <svg className="size-3.5" fill="none" viewBox="0 0 24 24">
                        <path d="m9 6 6 6-6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.6" />
                      </svg>
                    </span>
                  )}
                  <div className="px-5 pb-5 pt-5">
                    <h3 className="font-display text-xl font-extrabold sm:text-2xl">{t(step.title)}</h3>
                    <p className="mt-2 text-sm leading-6 text-white/65">{t(step.description)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* What you'll find */}
        <section aria-labelledby="guide-sections-heading" className="bg-[#fbfaf5] px-5 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-28">
          <div className="mx-auto max-w-[1200px]">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-2xl">
                <p className="inline-flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#8a7000]">
                  <span aria-hidden="true" className="h-px w-10 bg-[#a48700]" />
                  {t('What you’ll find here')}
                </p>
                <h2 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-[#092a53] sm:text-5xl" id="guide-sections-heading">
                  {t('Everything in one place.')}
                </h2>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#ebe7dc] bg-white px-4 py-2 text-xs font-bold text-[#65748a]">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-[#ffdc32]" />
                {t('Our story')}
              </span>
            </div>

            <ul className="mt-12 grid gap-5 md:grid-cols-3 lg:gap-6">
              {guideSections.map((section, index) => {
                const featured = index === guideSections.length - 1
                return (
                  <li key={section.title}>
                    <Link
                      className={`group relative isolate flex h-full min-h-[300px] flex-col overflow-hidden rounded-[28px] p-7 transition duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] focus-visible:ring-offset-2 sm:p-8 ${
                        featured
                          ? 'bg-[#092a53] text-white shadow-[0_24px_54px_rgba(9,42,83,0.25)] hover:shadow-[0_32px_64px_rgba(9,42,83,0.32)]'
                          : 'bg-white text-[#092a53] shadow-[0_1px_0_rgba(9,42,83,0.04),0_10px_30px_rgba(9,42,83,0.06)] ring-1 ring-[#ebe7dc] hover:shadow-[0_28px_56px_rgba(9,42,83,0.12)] hover:ring-[#e2d39a]'
                      }`}
                      to={section.to}
                    >
                      <span
                        aria-hidden="true"
                        className={`absolute -right-2 -top-6 -z-10 font-display text-[8rem] font-extrabold leading-none tabular-nums ${featured ? 'text-white/[0.06]' : 'text-[#092a53]/[0.05]'}`}
                      >
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span
                        aria-hidden="true"
                        className={`grid size-14 place-items-center rounded-2xl transition duration-300 group-hover:-rotate-6 ${featured ? 'bg-[#ffdc32] text-[#092a53]' : 'bg-[#092a53] text-[#ffdc32]'}`}
                      >
                        <svg className="size-6" fill="none" viewBox="0 0 24 24">
                          <path d={section.icon} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                        </svg>
                      </span>
                      <p className={`mt-8 text-[10px] font-extrabold uppercase tracking-[0.16em] ${featured ? 'text-[#ffdc32]' : 'text-[#8a7000]'}`}>{t(section.eyebrow)}</p>
                      <h3 className="mt-3 font-display text-2xl font-extrabold leading-tight">{t(section.title)}</h3>
                      <p className={`mt-3 text-sm leading-6 ${featured ? 'text-white/70' : 'text-[#65748a]'}`}>{t(section.description)}</p>
                      <span className={`mt-auto flex items-center justify-between gap-3 border-t pt-5 text-sm font-extrabold ${featured ? 'border-white/15' : 'border-[#efebe1]'}`}>
                        {t(section.cta)}
                        <span
                          aria-hidden="true"
                          className={`grid size-10 place-items-center rounded-full transition duration-300 group-hover:translate-x-1 ${
                            featured ? 'bg-white text-[#092a53] group-hover:bg-[#ffdc32]' : 'bg-[#f4f1e7] text-[#092a53] group-hover:bg-[#092a53] group-hover:text-white'
                          }`}
                        >
                          <ArrowIcon />
                        </span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-[#fbfaf5] px-5 pb-20 sm:px-8 sm:pb-24 lg:px-12">
          <div className="mx-auto max-w-[1200px]">
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
