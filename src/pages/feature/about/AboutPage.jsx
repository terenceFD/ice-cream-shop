import { Link } from 'react-router-dom'
import { Footer, Header } from '../../../components/Layout'
import { useLanguage } from '../../../LanguageContext'

const values = [
  {
    icon: '✿',
    title: 'Real ingredients',
    description: 'We keep the good stuff at the heart of every recipe, from creamy classics to bright, fruity scoops.',
  },
  {
    icon: '❄',
    title: 'Made fresh',
    description: 'Every batch is prepared with care so each visit feels like the start of a little celebration.',
  },
  {
    icon: '♥',
    title: 'A scoop for everyone',
    description: 'Our menu brings familiar favorites and playful new flavors together for sharing and discovering.',
  },
]

export function AboutPage() {
  const { t } = useLanguage()
  return (
    <div className="min-h-screen bg-[#fffefa] text-[#102c50]">
      <Header />
      <main>
        <section className="mx-auto max-w-[1320px] px-5 py-12 sm:px-8 sm:py-20 lg:px-12">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_0.9fr]">
            <div className="max-w-2xl">
              <p className="mb-3 inline-block rounded-full bg-[#ffeb9c] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em]">
                {t('Our story')}
              </p>
              <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl">
                {t('A little scoop of')} <span className="text-[#d7b400]">{t('joy')}.</span>
              </h1>
              <p className="mt-6 text-base leading-7 text-[#65748a] sm:text-lg sm:leading-8">
                {t('Antixor Icy is here for the everyday moments that deserve something special. We make ice cream with real ingredients, thoughtful recipes, and a whole lot of love.')}
              </p>
              <p className="mt-4 text-base leading-7 text-[#65748a] sm:text-lg sm:leading-8">
                {t('From the first taste of a familiar favorite to finding a new flavor to share, we want every scoop to bring people together and leave them smiling.')}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link className="rounded-full bg-[#ffdc32] px-6 py-3 text-sm font-bold transition hover:bg-[#ffe76c]" to="/flavors">
                  {t('Explore our flavors')}
                </Link>
                <Link className="rounded-full border-2 border-[#29415f] px-6 py-3 text-sm font-bold transition hover:bg-[#f4f1e7]" to="/contact">
                  {t('Get in touch')}
                </Link>
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-xl">
              <div aria-hidden="true" className="absolute -right-3 -top-3 size-24 rounded-full bg-[#ffdc32] sm:-right-5 sm:-top-5 sm:size-32" />
              <img
                alt={t('Colorful ice cream scoops ready to share')}
                className="relative aspect-[1.1] w-full rounded-[30px] object-cover shadow-[0_24px_60px_rgba(18,44,80,0.15)]"
                src="/images/hero-ice-cream.jpg"
              />
            </div>
          </div>
        </section>

        <section className="bg-[#092a53] px-5 py-14 text-white sm:px-8 sm:py-20">
          <div className="mx-auto max-w-[1160px]">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#ffdc32]">{t('What makes us Antixor Icy')}</p>
            <h2 className="mt-2 max-w-2xl font-display text-3xl font-bold sm:text-4xl">{t('Good ingredients, happy moments, and a reason to come back.')}</h2>
            <div className="mt-9 grid gap-5 md:grid-cols-3">
              {values.map((value) => (
                <article className="rounded-[22px] border border-white/10 bg-white/5 p-6" key={value.title}>
                  <span aria-hidden="true" className="grid size-12 place-items-center rounded-full bg-[#ffdc32] text-xl text-[#092a53]">{value.icon}</span>
                  <h3 className="mt-5 font-display text-xl font-bold">{t(value.title)}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/70">{t(value.description)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
