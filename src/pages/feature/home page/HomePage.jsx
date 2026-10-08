import { Link } from 'react-router-dom'
import { Header, Footer, ArrowIcon } from '../../../components/Layout'
import { benefits, reviews } from '../../../data'
import { useCart } from '../../../CartContext'
import { useFlavors } from '../../../FlavorContext'
import { useLanguage } from '../../../LanguageContext'

export function HomePage() {
  const { addToCart } = useCart()
  const { flavors, loading, error } = useFlavors()
  const { t } = useLanguage()
  const availableFlavors = flavors.filter((flavor) => flavor.availableQuantity > 0)

  return (
    <div className="min-h-screen overflow-hidden bg-[#fffefa] text-[#102c50]">
      <Header />

      <main>
        <section
          id="home"
          className="relative mx-auto max-w-[1320px] overflow-hidden bg-[#092a53] px-5 py-12 text-white sm:px-8 sm:py-16 lg:rounded-[30px] lg:px-16 lg:py-20"
        >
          <div aria-hidden="true" className="absolute -right-14 top-10 size-44 rounded-full bg-[#ffdb32] sm:size-60" />
          <div aria-hidden="true" className="absolute -bottom-20 -left-16 size-48 rounded-full bg-[#ffdb32] sm:size-64" />
          <div className="relative grid items-center gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:gap-8">
            <div className="relative z-10 max-w-[610px]">
              <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#ffe35c]">
                {t('Real ice cream. Real happiness.')}
              </p>
              <h1 className="font-display text-[clamp(3.5rem,9vw,7.4rem)] font-bold leading-[0.82] tracking-[-0.065em] text-white">
                Antixor
                <span className="mt-2 block text-[#ffdc32]">Icy.com<span className="text-[#ffdc32]">.</span></span>
              </h1>
              <p className="mt-7 max-w-md text-base leading-7 text-white/80 sm:text-lg">
                {t('A little scoop of joy, made fresh with real ingredients and a whole lot of love. Find your new favorite flavor.')}
              </p>
              <a
                className="mt-7 inline-flex items-center gap-3 rounded-full bg-[#ffdc32] px-6 py-3.5 text-sm font-bold text-[#092a53] shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-[#ffe76c]"
                href="#flavors"
              >
                {t('Explore flavors')} <ArrowIcon />
              </a>
              <div className="mt-8 flex flex-wrap gap-x-5 gap-y-3 text-xs font-medium text-white/80">
                <span className="inline-flex items-center gap-2"><span className="text-[#d6f19a]">●</span> {t('Fresh every day')}</span>
                <span className="inline-flex items-center gap-2"><span className="text-[#ffdc32]">●</span> {t('Made with real cream')}</span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[590px] lg:-mr-2">
              <div aria-hidden="true" className="absolute -left-5 top-10 z-10 grid size-16 -rotate-12 place-items-center rounded-full bg-[#ffdc32] font-display text-center text-[11px] font-bold leading-tight text-[#092a53] shadow-lg sm:-left-9 sm:size-20">
                {t('SCOOP')}
                <br />
                {t('THE JOY!')}
              </div>
              <div className="aspect-[1.16] overflow-hidden rounded-[30px] border-[7px] border-white/15 bg-[#f8f5eb] shadow-[0_25px_70px_rgba(0,0,0,0.25)] sm:rounded-[38px]">
                <img
                  alt="Colorful scoops of ice cream in waffle cones"
                  className="h-full w-full object-cover object-center"
                  fetchPriority="high"
                  src="/images/hero-ice-cream.jpg"
                />
              </div>
              <div className="absolute -bottom-5 -right-1 rounded-2xl bg-white px-4 py-3 text-[#102c50] shadow-xl sm:bottom-5 sm:-right-6 sm:px-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#68809d]">{t('Happiness, by the scoop')}</p>
                <p className="mt-1 font-display text-lg font-bold">{t('Made fresh for you')} <span className="text-[#efc900]">♥</span></p>
              </div>
            </div>
          </div>
        </section>

        <section id="flavors" className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
          <div className="mb-8 flex items-end justify-between gap-4 sm:mb-10">
            <div>
              <p className="mb-2 inline-block rounded-full bg-[#ffeb9c] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#102c50]">{t('A scoop for every mood')}</p>
              <h2 className="font-display text-4xl font-bold tracking-tight text-[#102c50] sm:text-5xl">{t('Popular flavors')}</h2>
              <p className="mt-2 text-sm text-[#65748a] sm:text-base">{t('From classic favorites to little flavor adventures.')}</p>
            </div>
            <Link className="mb-1 hidden items-center gap-2 text-sm font-bold text-[#102c50] transition hover:text-[#ccaa00] sm:inline-flex" to="/flavors">
              {t('View all flavors')} <ArrowIcon diagonal />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 lg:gap-5">
            {availableFlavors.map((flavor) => (
              <article key={flavor.id} className="group overflow-hidden rounded-[22px] border border-[#ece8de] bg-white shadow-[0_8px_30px_rgba(18,44,80,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_14px_38px_rgba(18,44,80,0.12)]">
                <Link to={`/flavor/${flavor.id}`} className={`relative aspect-[0.92] overflow-hidden block ${flavor.color}`}>
                  <img
                    alt={`${t(flavor.name)} ${t('ice cream')}`}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    loading="lazy"
                    src={flavor.image}
                  />
                  <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[9px] font-bold text-[#29415f] shadow-sm">{t(flavor.tag)}</span>
                </Link>
                <div className="p-3.5 sm:p-4">
                  <Link to={`/flavor/${flavor.id}`} className="font-display text-base font-bold leading-tight text-[#102c50] sm:text-lg hover:text-[#ccaa00]">
                    {t(flavor.name)}
                  </Link>
                  <p className="mt-1.5 min-h-8 text-[11px] leading-4 text-[#7b8796] sm:text-xs">{t(flavor.detail)}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm font-extrabold text-[#102c50]">${flavor.price.toFixed(2)}</span>
                    <button
                      aria-label={t('Add {name} to your bag', { name: flavor.name })}
                      className="grid size-9 place-items-center rounded-full bg-[#ffdc32] text-lg font-bold text-[#102c50] transition hover:rotate-90 hover:bg-[#ffe76c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#102c50]"
                      onClick={() => addToCart(flavor)}
                      type="button"
                    >
                      +
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {!loading && !error && availableFlavors.length === 0 && (
            <p className="mt-6 rounded-2xl bg-[#fff9dc] px-5 py-6 text-center text-sm text-[#624f00]">
              {t('All flavors are currently sold out. Please check back soon.')}
            </p>
          )}
          {(loading || error) && (
            <p className={`mt-5 rounded-xl px-4 py-3 text-sm ${error ? 'bg-red-50 text-red-700' : 'bg-[#fff9dc] text-[#624f00]'}`} role={error ? 'alert' : 'status'}>
              {error || t('Loading flavors…')}
            </p>
          )}
        </section>

        <section id="about" className="relative overflow-hidden bg-[#092a53] px-5 py-14 text-white sm:px-8 sm:py-16">
          <div aria-hidden="true" className="absolute -right-24 top-0 size-64 rounded-full bg-[#173f70] blur-2xl" />
          <div className="relative mx-auto grid max-w-[1160px] items-center gap-10 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.17em] text-[#ffdc32]">{t('Good things inside')}</p>
              <h2 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
                    {t('Why choose')}
                <br />
                <span className="text-[#ffdc32]">Antixor Icy?</span>
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-6 text-white/70">
                We believe the little things make the sweetest difference:
                beautiful ingredients, thoughtful recipes, and a fresh scoop
                whenever you need one.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
              {benefits.map((benefit) => (
                <div key={benefit.title} className="flex items-center gap-3.5">
                  <span className={`grid size-12 shrink-0 place-items-center rounded-full text-xl ${benefit.color}`}>{benefit.icon}</span>
                  <div>
                    <h3 className="font-display text-base font-bold">{t(benefit.title)}</h3>
                    <p className="mt-0.5 text-xs text-white/65">{t(benefit.text)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1320px] px-5 py-14 sm:px-8 sm:py-20 lg:px-12">
          <div className="relative isolate overflow-hidden rounded-[30px] bg-[#ffdc32] px-6 py-10 sm:px-10 sm:py-12 lg:px-16">
            <div aria-hidden="true" className="absolute -right-8 -top-20 -z-10 size-56 rounded-full border-[32px] border-white/20 sm:right-10 sm:top-[-7rem] sm:size-80" />
            <div className="grid items-center gap-8 sm:grid-cols-[0.9fr_1.1fr]">
              <div className="mx-auto w-full max-w-[410px] overflow-hidden rounded-[26px] border-4 border-white/60 shadow-xl">
                <img alt="Colorful scoops and cones, ready to share" className="aspect-[1.25] h-full w-full object-cover" loading="lazy" src="/images/hero-ice-cream.jpg" />
              </div>
              <div className="text-center sm:text-left">
                <p className="mb-3 inline-flex rounded-full bg-[#092a53] px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.15em] text-white">{t('A very good idea')}</p>
                <h2 className="font-display text-4xl font-bold leading-[0.98] tracking-tight text-[#092a53] sm:text-5xl lg:text-6xl">
                  {t('Buy 2, get 1')}
                  <span className="mt-1 block text-[#fffefa]">{t('FREE!')}</span>
                </h2>
                <p className="mt-3 text-sm font-medium text-[#29415f]">{t('More scoops. More smiles. Everybody wins.')}</p>
                <Link className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#092a53] px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#164674]" to="/#flavors">
                  {t('Find your flavors')} <ArrowIcon />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section id="reviews" className="mx-auto max-w-[1320px] px-5 pb-16 sm:px-8 sm:pb-20 lg:px-12">
          <div className="mx-auto mb-8 max-w-xl text-center">
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.15em] text-[#bd9c00]">{t('The sweetest words')}</p>
            <h2 className="font-display text-4xl font-bold tracking-tight text-[#102c50] sm:text-5xl">{t('Real scoops, real reviews')}</h2>
            <p className="mt-3 text-sm text-[#65748a]">{t("Don't just take our word for it. Here's a little love from our lovely customers.")}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {reviews.map((review) => (
              <figure key={review.name} className="flex min-h-48 flex-col justify-between rounded-[22px] border border-[#ece8de] bg-white p-5 shadow-[0_8px_30px_rgba(18,44,80,0.05)] sm:p-6">
                <div>
                  <div aria-label="5 out of 5 stars" className="mb-3 text-sm tracking-[0.15em] text-[#e7bd00]">★★★★★</div>
                  <blockquote className="text-sm leading-6 text-[#354963]">{t(review.quote)}</blockquote>
                </div>
                <figcaption className="mt-5 flex items-center gap-3">
                  <span className={`grid size-10 place-items-center rounded-full font-display text-base font-bold ${review.color}`}>{review.avatar}</span>
                  <span><span className="block text-sm font-bold text-[#102c50]">{review.name}</span><span className="text-xs text-[#8792a0]">{t(review.flavor)}</span></span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="bg-[#fff0a8] px-5 py-10 sm:px-8 sm:py-12">
          <div className="mx-auto grid max-w-[1160px] items-center gap-8 md:grid-cols-[1fr_0.8fr]">
            <div>
              <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.15em] text-[#816900]">{t('A little scoop of your feed')}</p>
              <h2 className="font-display text-4xl font-bold tracking-tight text-[#102c50] sm:text-5xl">{t('Follow the fun.')}</h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-[#53647b]">{t('Tag your happy moments with')} <span className="font-bold text-[#102c50]">#AntixorIcy</span> {t('and come say hello on Instagram.')}</p>
              <a className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#092a53] px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#164674]" href="https://www.instagram.com/" target="_blank" rel="noreferrer">
                {t('Visit Instagram')} <ArrowIcon diagonal />
              </a>
            </div>
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
              {flavors.slice(1, 4).map((flavor) => (
                <img key={flavor.id} alt={`${flavor.name} from Antixor Icy`} className="aspect-square w-full rounded-2xl object-cover shadow-md" loading="lazy" src={flavor.image} />
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
