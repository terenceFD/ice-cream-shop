import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Footer, Header, ArrowIcon, InstagramSection } from '../../../components/Layout'
import { useCart } from '../../../CartContext'
import { apiRequest } from '../../../api/api'
import { coldStoneMenuCategories, getMenuItemId } from '../../../data'
import { useLanguage } from '../../../language/LanguageContext'

const popularFlavorNames = [
  'Cookie Crunch Cone',
  'Caramel Crunch Cone',
  'Signature Mix-In Cup',
  'Cookie Crunch Cup',
  'Candy Mix-In Shake',
]
const popularFlavorColors = ['#e9f6dd', '#fff0df', '#fff5d2', '#fff5c8', '#ffeadc']

function getPopularFlavors(categories) {
  const iceCream = categories.find((category) => category.title === 'Ice Cream')
  return popularFlavorNames
    .map((name) => iceCream?.items.find((item) => item.name === name))
    .filter(Boolean)
}

export function HomePage() {
  const { language, t } = useLanguage()
  const { addToCart } = useCart()
  const [popularFlavors, setPopularFlavors] = useState(() => getPopularFlavors(coldStoneMenuCategories))
  const [menuError, setMenuError] = useState('')
  const [cartNotice, setCartNotice] = useState('')
  const [reviews, setReviews] = useState([])
  const [reviewsError, setReviewsError] = useState('')

  useEffect(() => {
    let cancelled = false
    apiRequest('/menu')
      .then(({ categories }) => {
        if (!cancelled) {
          setPopularFlavors(getPopularFlavors(categories))
          setMenuError('')
        }
      })
      .catch((error) => {
        if (!cancelled) setMenuError(error.message)
      })
    apiRequest('/reviews')
      .then(({ reviews: approvedReviews }) => {
        if (!cancelled) {
          setReviews(approvedReviews.slice(0, 3))
          setReviewsError('')
        }
      })
      .catch((error) => {
        if (!cancelled) setReviewsError(error.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function handleAddToCart(item) {
    const added = addToCart({
      ...item,
      id: item.id || getMenuItemId('Ice Cream', item.name),
      itemType: 'menu',
      categoryTitle: 'Ice Cream',
    })
    setCartNotice(added ? t('Added {name} to your bag.', { name: t(item.name) }) : t('This item could not be added to your bag. Please try again.'))
  }

  const formatPrice = (price) =>
    `${new Intl.NumberFormat(language === 'fr' ? 'fr-CM' : 'en-CM').format(price)} FCFA`

  return (
    <div className="min-h-screen overflow-clip bg-[#fbfaf5] text-[#102c50]">
      <Header />
      <main>
        <section id="home" className="relative isolate w-full overflow-hidden bg-[#092a53] px-5 pb-20 pt-8 text-white sm:px-8 sm:pb-24 sm:pt-12 lg:px-12 lg:pt-14">
          <div aria-hidden="true" className="absolute -right-20 top-16 size-44 rounded-full bg-[#ffdc32]/20 sm:size-64" />
          <div aria-hidden="true" className="absolute bottom-20 left-[42%] size-5 rounded-full bg-[#ffdc32]/80" />
          <div className="relative mx-auto w-full max-w-[1320px]">
          <div className="relative grid items-center gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-10">
            <div className="relative z-10 max-w-[590px]">
              <p className="mb-5 inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-[#ffdc32]">
                <span aria-hidden="true" className="text-lg text-[#bd9c00]">♡</span>
                {t('Independent Cameroon guide')}
                <span aria-hidden="true" className="text-lg text-[#bd9c00]">♡</span>
              </p>
              <h1 className="font-display text-[clamp(2.6rem,6.4vw,5rem)] font-extrabold leading-[0.88] tracking-[-0.065em] text-white">
                {t('Your next favorite')}
                <span className="mt-2 block font-display font-bold italic tracking-[-0.045em] text-[#ffdc32]">{t('starts here.')}</span>
              </h1>
              <p className="mt-6 max-w-md text-sm leading-6 text-white/80 sm:text-base sm:leading-7">
                {t('Browse signature creations, explore the online catalog, and discover publicly listed locations across Cameroon.')}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link className="inline-flex items-center gap-2 rounded-xl bg-[#ffdc32] px-5 py-3 text-sm font-bold text-[#102c50] shadow-lg shadow-[#102c50]/15 transition hover:-translate-y-0.5 hover:bg-[#ffe665]" to={`/menu?category=${encodeURIComponent('Ice Cream')}`}>
                  {t('Order now')} <ArrowIcon />
                </Link>
                <Link className="inline-flex items-center gap-2 rounded-xl border-2 border-white bg-white px-5 py-3 text-sm font-bold text-[#092a53] transition hover:bg-white/90" to="/flavors">
                  {t('Explore flavors')} <ArrowIcon diagonal />
                </Link>
              </div>
              <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-white/90">
                <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="text-lg text-[#bd9c00]">✧</span>{t('Signature creations')}</span>
                <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="text-lg text-[#bd9c00]">♡</span>{t('A flavor for every mood')}</span>
                <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="text-lg text-[#bd9c00]">⌖</span>{t('Cameroon locations')}</span>
              </div>
              <p className="mt-6 max-w-lg text-[11px] leading-5 text-white/65">{t('Independent information guide — not an official Cold Stone Creamery website.')}</p>
            </div>
            <div className="relative mx-auto w-full max-w-[650px] lg:pr-3">
              <div aria-hidden="true" className="absolute -right-4 top-6 size-20 rounded-full border-2 border-[#ffdc32] sm:-right-2 sm:size-28" />
              <div className="relative aspect-[1.18] overflow-hidden rounded-[32px] bg-[#ffdc32]/20 sm:rounded-[42px]">
                <img alt={t('Ice cream treats ready to share')} className="h-full w-full object-cover object-center" fetchPriority="high" src="/ice-images/ice-5.webp" />
              </div>
              <div className="absolute -bottom-4 left-3 flex items-center gap-3 rounded-2xl border border-[#d9d6cc] bg-white px-4 py-3 shadow-[0_12px_35px_rgba(9,42,83,0.14)] sm:bottom-5 sm:-left-7 sm:px-5">
                <span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-[#ffdc32] text-xl text-[#102c50]">✦</span>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#68809d]">{t('The signature experience')}</p>
                  <p className="mt-0.5 font-display text-base font-bold text-[#102c50] sm:text-lg">{t('Choose. Mix. Make it yours.')}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="relative mt-12 grid overflow-hidden rounded-2xl border border-[#d9d6cc] bg-white shadow-[0_12px_35px_rgba(9,42,83,0.08)] sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">
            {[
              { icon: '⌖', title: 'Cameroon locations', detail: 'Find a listed shop near you.', to: '/locations' },
              { icon: '✧', title: 'Explore the menu', detail: 'Browse signature creations and treats.', to: '/menu' },
              { icon: '♡', title: 'Explore flavors', detail: 'Find a new favorite in the catalog.', to: '/flavors' },
              { icon: '✿', title: 'Custom cake requests', detail: 'Plan a cake for your celebration.', to: '/custom-cake' },
            ].map((feature) => (
              <Link className="flex items-center gap-3 border-b border-[#d9d6cc] p-4 transition hover:bg-[#fff9dc] sm:p-5 lg:border-b-0 lg:border-r last:border-0" key={feature.title} to={feature.to}>
                <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-[#ffdc32]/50 text-xl text-[#102c50]">{feature.icon}</span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-extrabold text-[#102c50] sm:text-sm">{t(feature.title)}</span>
                  <span className="mt-1 block text-[11px] leading-4 text-[#65748a]">{t(feature.detail)}</span>
                </span>
              </Link>
            ))}
          </div>
          </div>
          <svg aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-16 w-full sm:h-20" preserveAspectRatio="none" viewBox="0 0 1440 100">
            <path d="M0 36C170 80 310 3 500 38s310 51 480 15 270-16 460 20v27H0Z" fill="#5ac4d9" />
            <path d="M0 44c180-26 280 10 450 5s270-42 450-21 290 20 540-13v85H0Z" fill="#fbfaf5" />
          </svg>
        </section>

        <section aria-labelledby="popular-flavors-heading" className="relative isolate overflow-hidden bg-[#fbfaf5] px-5 pb-20 pt-12 sm:px-8 sm:pb-24 sm:pt-16">
          <div aria-hidden="true" className="absolute -right-28 top-16 -z-0 size-72 rounded-full border-[42px] border-[#ffdc32]/20" />
          <div className="relative z-10 mx-auto max-w-[1240px]">
            <div className="mb-7 flex flex-wrap items-end justify-between gap-4 sm:mb-9">
              <div>
                <p className="mb-2 inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#a48700]">
                  <span aria-hidden="true" className="text-base">✦</span>{t('Our favorites')}
                </p>
                <h2 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-[#092a53] sm:text-4xl" id="popular-flavors-heading">{t('Popular Flavors')}</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-[#65748a]">{t('From classic scoops to signature creations, find a new favorite.')}</p>
              </div>
              <div className="flex shrink-0 items-center">
                <Link
                  className="inline-flex items-center gap-2 rounded-full border border-[#d9d6cc] bg-white px-4 py-2.5 text-xs font-extrabold text-[#092a53] shadow-sm transition hover:-translate-y-0.5 hover:border-[#bd9c00] hover:bg-[#fffbea] sm:text-sm"
                  to={`/menu?category=${encodeURIComponent('Ice Cream')}`}
                >
                  {t('View all')} <ArrowIcon />
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 min-[460px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
              {popularFlavors.map((item, index) => {
                const soldOut = item.isAvailable === false || item.availableQuantity < 1
                return (
                  <article className="group overflow-hidden rounded-[24px] border border-[#e7e3d9] bg-white shadow-[0_9px_30px_rgba(18,44,80,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_42px_rgba(18,44,80,0.12)]" key={item.id || item.name}>
                    <div className="relative aspect-[1.08] overflow-hidden p-2.5 sm:p-3" style={{ backgroundColor: popularFlavorColors[index] }}>
                      <img
                        alt={t(item.name)}
                        className="h-full w-full rounded-[19px] object-cover transition duration-700 group-hover:scale-[1.05]"
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.onerror = null
                          event.currentTarget.src = '/images/hero-ice-cream.jpg'
                        }}
                        src={item.image}
                      />
                      <span className={`absolute left-5 top-5 rounded-full border border-white/70 px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-[0.1em] shadow-sm backdrop-blur-sm ${soldOut ? 'bg-red-50/95 text-red-700' : 'bg-white/95 text-[#37632c]'}`}>
                        {soldOut ? t('Sold out') : t('Popular pick')}
                      </span>
                      <span aria-hidden="true" className="absolute bottom-5 right-5 grid size-9 translate-y-1 place-items-center rounded-full bg-[#ffdc32] text-lg font-bold text-[#092a53] opacity-0 shadow-md transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">↗</span>
                    </div>
                    <div className="p-4 sm:p-4.5">
                      <h3 className="min-h-12 font-display text-base font-extrabold leading-snug text-[#102c50] sm:text-lg">{t(item.name)}</h3>
                      <p className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-[#65748a]">{t(item.detail)}</p>
                      <div className="mt-4 flex items-end justify-between gap-2 border-t border-[#eeeae1] pt-3">
                        <div>
                          <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#8792a0]">{t('Illustrative price')}</p>
                          <span className="mt-1 block text-sm font-extrabold text-[#092a53]">{formatPrice(item.priceXaf)}</span>
                        </div>
                        <button
                          aria-label={soldOut ? t('Sold out') : t('Add {name} to your bag', { name: t(item.name) })}
                          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-[#092a53] px-4 text-xs font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-[#163e6b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#d9d6cc] disabled:text-[#65748a]"
                          disabled={soldOut}
                          onClick={() => handleAddToCart(item)}
                          type="button"
                        >
                          {soldOut ? t('Sold out') : <>{t('Add')} <span aria-hidden="true">+</span></>}
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
            {menuError && (
              <p className="mt-4 text-xs text-[#65748a]" role="status">
                {t('Menu availability could not be refreshed')}: {menuError}
              </p>
            )}
            {cartNotice && <p aria-live="polite" className="mt-4 text-sm font-semibold text-[#315a36]">{cartNotice}</p>}
          </div>
          <svg aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-0 h-10 w-full sm:h-14" preserveAspectRatio="none" viewBox="0 0 1440 80">
            <path d="M0 43C170 80 310 3 500 38s310 51 480 15 270-16 460 20V80H0Z" fill="#102c50" />
            <path d="M0 56c180-26 280 10 450 5s270-42 450-21 290 20 540-13v53H0Z" fill="#5ac4d9" opacity=".75" />
          </svg>
        </section>

        <section aria-labelledby="why-choose-us-heading" className="relative isolate w-full overflow-hidden bg-[#f4f2e9] px-5 py-14 sm:px-8 sm:py-18 lg:px-10 lg:py-20" data-scroll-reveal="skip">
          <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full border-[42px] border-[#ffdc32]/20 sm:size-96" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-20 size-64 rounded-full border-[38px] border-[#092a53]/[0.04]" />
          <div className="relative z-10 mx-auto w-full max-w-[1160px]">
            <div className="mx-auto mb-8 max-w-2xl text-center sm:mb-10">
              <p className="mb-3 inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#8a7500]">
                <span aria-hidden="true" className="text-base">✦</span>{t('Why choose us')}
              </p>
              <h2 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-[#092a53] sm:text-4xl" id="why-choose-us-heading">
                {t('More scoops. More smiles.')}
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { icon: '✿', title: 'Natural ingredients', detail: 'Only the good stuff, always.', color: '#a8df62' },
                  { icon: '★', title: 'Unique flavors', detail: 'Classic to creative.', color: '#ffdc32' },
                  { icon: '❄', title: 'Freshly made', detail: 'A little joy, every day.', color: '#4fc4e8' },
                  { icon: '♡', title: 'Happy customers', detail: 'Your smile is our success.', color: '#f56586' },
                ].map((benefit) => (
                  <article className="group rounded-[22px] border border-[#e5e1d7] bg-white p-5 shadow-[0_8px_26px_rgba(9,42,83,0.05)] transition duration-300 hover:-translate-y-1 hover:border-[#d9c76d] hover:shadow-[0_16px_34px_rgba(9,42,83,0.1)] sm:p-6" key={benefit.title}>
                    <span aria-hidden="true" className="grid size-12 place-items-center rounded-2xl text-xl font-bold text-[#102c50] shadow-sm transition duration-300 group-hover:rotate-[-4deg] group-hover:scale-105" style={{ backgroundColor: benefit.color }}>
                      {benefit.icon}
                    </span>
                    <h3 className="mt-5 font-display text-lg font-extrabold text-[#092a53]">{t(benefit.title)}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#65748a]">{t(benefit.detail)}</p>
                  </article>
                ))}
            </div>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center font-display text-lg font-extrabold sm:mt-9 sm:text-xl">
              <span className="text-[#092a53]">{t('Small Scoops')}</span>
              <span aria-hidden="true" className="text-[#a48700]">·</span>
              <span className="text-[#8a7500]">{t('Big Smiles')}</span>
            </div>
          </div>
        </section>

        <section className="relative isolate overflow-hidden bg-[#f4f2e9] px-4 py-12 sm:px-7 sm:py-16 lg:px-10 lg:py-20">
          <div aria-hidden="true" className="absolute -left-24 top-16 -z-10 size-72 rounded-full border-[48px] border-[#ffdc32]/20" />
          <div className="mx-auto max-w-[1320px]">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4 sm:mb-9">
            <div>
              <p className="mb-3 inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#a48700]">
                <span aria-hidden="true" className="text-base">✦</span>{t('The Cold Stone experience')}
              </p>
              <h2 className="font-display text-3xl font-extrabold tracking-tight text-[#092a53] sm:text-4xl lg:text-5xl">{t('Menu highlights')}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#65748a]">{t('These categories appear on the global Cold Stone menu. Ask a Cameroon branch to confirm current selection.')}</p>
            </div>
            <Link className="inline-flex items-center gap-2 rounded-full bg-[#092a53] px-5 py-3 text-xs font-extrabold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#163e6b] sm:text-sm" to="/menu">
              {t('View menu guide')} <ArrowIcon diagonal />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {coldStoneMenuCategories.map((category, index) => (
              <Link
                aria-label={`${t(category.title)} — ${t('Browse the categories')}`}
                className="group relative isolate flex min-h-[230px] flex-col overflow-hidden rounded-[24px] border border-[#e7e3d9] bg-white p-5 shadow-[0_8px_28px_rgba(18,44,80,0.05)] transition duration-300 hover:-translate-y-1 hover:border-[#d9c76d] hover:shadow-[0_18px_40px_rgba(18,44,80,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] focus-visible:ring-offset-4 sm:p-6"
                key={category.title}
                to={`/menu?category=${encodeURIComponent(category.title)}`}
              >
                <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 h-1.5 bg-gradient-to-r from-[#ffdc32] via-[#f0c925] to-transparent opacity-70 transition group-hover:opacity-100" />
                <div className="flex items-start justify-between gap-4">
                  <span aria-hidden="true" className="grid size-14 place-items-center rounded-2xl bg-[#fff3b8] text-2xl shadow-sm transition duration-300 group-hover:rotate-[-4deg] group-hover:scale-105">{category.icon}</span>
                  <span className="rounded-full bg-[#f4f6f8] px-3 py-1.5 text-[10px] font-extrabold text-[#65748a]">{t('{count} items', { count: category.items.length })}</span>
                </div>
                <div className="mt-auto pt-7">
                  <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <p className="mb-1 text-[9px] font-extrabold uppercase tracking-[0.13em] text-[#a48700]">{t('Menu category')}</p>
                      <h3 className="font-display text-xl font-extrabold leading-tight text-[#092a53] sm:text-2xl">{t(category.title)}</h3>
                    </div>
                    <span aria-hidden="true" className="grid size-10 shrink-0 translate-x-1 place-items-center rounded-full border border-[#e7e3d9] text-[#092a53] transition duration-300 group-hover:translate-x-0 group-hover:border-[#092a53] group-hover:bg-[#092a53] group-hover:text-white">
                      <ArrowIcon />
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#65748a]">{t(category.description)}</p>
                </div>
                <span aria-hidden="true" className="absolute right-6 top-14 text-[9px] font-extrabold tracking-[0.14em] text-[#c2c8cf]">{String(index + 1).padStart(2, '0')}</span>
              </Link>
            ))}
          </div>
          </div>
        </section>

        <section aria-labelledby="home-about-heading" className="relative isolate overflow-hidden bg-[#fbfaf5] px-4 py-10 sm:px-7 sm:py-14 lg:px-10 lg:py-16" data-scroll-reveal="skip">
          <div aria-hidden="true" className="absolute -right-28 top-10 -z-10 size-72 rounded-full border-[44px] border-[#dff0ed]/70" />
          <div className="mx-auto grid max-w-[1320px] gap-5 lg:grid-cols-[1.05fr_0.95fr]">
            <article className="relative isolate flex min-h-[340px] overflow-hidden rounded-[28px] bg-[#ffdc32] text-[#092a53] shadow-[0_16px_42px_rgba(121,99,0,0.13)] sm:min-h-[390px]">
              <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-br from-[#ffe76c] via-[#ffdc32] to-[#f2c900]" />
              <div aria-hidden="true" className="absolute -left-20 -top-28 -z-10 size-64 rounded-full border-[40px] border-white/20" />
              <div className="relative z-10 flex w-[58%] flex-col items-start justify-center p-6 sm:w-[56%] sm:p-9 lg:p-11">
                <p className="inline-flex items-center gap-2 rounded-full border border-[#092a53]/10 bg-white/75 px-3.5 py-2 text-[9px] font-extrabold uppercase tracking-[0.15em]">
                  <span aria-hidden="true">✦</span>{t('Sweet deals!')}
                </p>
                <h2 className="mt-5 font-display text-3xl font-extrabold leading-[1.05] tracking-tight sm:text-4xl lg:text-5xl">
                  {t('Buy 2 Scoops')}
                  <span className="mt-1 block">{t('Get 1 Free')}</span>
                </h2>
                <p className="mt-3 max-w-[260px] text-xs leading-5 text-[#092a53]/75 sm:text-sm sm:leading-6">{t('More scoops. More smiles. Everybody wins.')}</p>
                <Link className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#092a53] px-5 py-3 text-xs font-extrabold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-[#163e6b] sm:text-sm" to={`/menu?category=${encodeURIComponent('Ice Cream')}`}>
                  {t('Order now')} <ArrowIcon />
                </Link>
              </div>
              <div aria-hidden="true" className="absolute bottom-0 right-0 top-0 w-[50%] sm:w-[48%]">
                <div className="absolute bottom-[-12%] right-[-9%] size-[115%] rounded-full border-[28px] border-white/20 sm:border-[38px]" />
                <img alt={t('Ice cream cone')} className="absolute bottom-[7%] right-[3%] h-[76%] w-[59%] rounded-[48%_48%_20%_20%] border-[5px] border-[#ffdc32] object-cover object-center shadow-2xl transition duration-500 hover:-translate-y-1" loading="lazy" src="/ice-images/ice-4.webp" />
                <img alt={t('Ice cream sundae')} className="absolute bottom-[7%] left-[-7%] h-[48%] w-[46%] rounded-[45%_45%_20%_20%] border-4 border-[#ffdc32] object-cover object-center shadow-xl sm:border-[5px]" loading="lazy" src="/ice-images/ice-1.jpg" />
                <img alt={t('Ice cream treat')} className="absolute right-[4%] top-[6%] h-[34%] w-[39%] rounded-[45%_45%_20%_20%] border-4 border-[#ffdc32] object-cover object-center shadow-xl sm:border-[5px]" loading="lazy" src="/ice-images/ice-3.webp" />
                <span className="absolute bottom-[8%] left-[28%] grid size-9 place-items-center rounded-full bg-white text-sm font-extrabold text-[#806a00] shadow-lg sm:size-11">3×</span>
              </div>
            </article>

            <article className="relative isolate flex min-h-[340px] overflow-hidden rounded-[28px] border border-[#e7e3d9] bg-[#092a53] text-white shadow-[0_16px_42px_rgba(9,42,83,0.12)] sm:min-h-[390px]">
              <img alt={t('A child enjoying ice cream')} className="absolute inset-0 -z-20 size-full object-cover object-[58%_center]" loading="lazy" src="/ice-images/about-child.jpg" />
              <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-[#092a53] via-[#092a53]/95 to-[#092a53]/15" />
              <div className="relative z-10 flex w-full flex-col items-start justify-center p-6 sm:w-[74%] sm:p-9 lg:p-11">
                <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-2 text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#ffdc32]">
                  <span aria-hidden="true">♡</span>{t('About us')}
                </p>
                <h2 className="mt-5 max-w-sm font-display text-3xl font-extrabold leading-tight sm:text-4xl" id="home-about-heading">{t('The joy is in the details.')}</h2>
                <p className="mt-3 max-w-sm text-xs leading-6 text-white/80 sm:text-sm sm:leading-7">
                  {t('Discover Cold Stone ice cream, signature creations, and the mix-ins that make every scoop a little more special.')}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {[
                    { icon: '✿', label: 'Freshly made' },
                    { icon: '♡', label: 'Quality ingredients' },
                    { icon: '☺', label: 'Happy customers' },
                  ].map((item) => (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1.5 text-[9px] font-bold text-white/90 sm:text-[10px]" key={item.label}>
                      <span aria-hidden="true" className="text-[#ffdc32]">{item.icon}</span>{t(item.label)}
                    </span>
                  ))}
                </div>
                <Link className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-xs font-extrabold text-[#092a53] transition hover:-translate-y-0.5 hover:bg-[#ffdc32] sm:text-sm" to="/about">
                  {t('Discover our story')} <ArrowIcon />
                </Link>
              </div>
              <div aria-hidden="true" className="absolute inset-y-0 right-0 -z-10 w-[40%] bg-gradient-to-l from-transparent to-[#092a53]/30" />
            </article>
          </div>
        </section>

        <section aria-labelledby="real-reviews-heading" className="relative isolate overflow-hidden bg-[#092a53] px-5 py-12 text-white sm:px-8 sm:py-16 lg:px-10 lg:py-20">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full border-[42px] border-white/[0.06] sm:size-96" />
          <div aria-hidden="true" className="pointer-events-none absolute bottom-0 left-0 h-1.5 w-full bg-gradient-to-r from-[#ffdc32] via-[#ffdc32]/50 to-transparent" />
          <div className="relative z-10 mx-auto max-w-[1160px]">
            <div className="mb-7 flex flex-wrap items-end justify-between gap-5 sm:mb-9">
              <div>
                <p className="mb-2 inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#ffdc32]">
                  <span aria-hidden="true" className="text-base">✦</span>{t('What our customers are saying')}
                </p>
                <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl" id="real-reviews-heading">{t('Real Reviews')}</h2>
              </div>
              <Link className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-5 py-3 text-xs font-extrabold text-white transition hover:-translate-y-0.5 hover:border-[#ffdc32] hover:bg-[#ffdc32] hover:text-[#092a53] sm:text-sm" to="/menu">
                {t('Explore the menu')} <ArrowIcon />
              </Link>
            </div>
            {reviewsError ? (
              <p className="rounded-2xl border border-white/15 bg-white/10 p-5 text-sm leading-6 text-white/85" role="status">
                {t('Customer reviews could not be loaded')}: {reviewsError}
              </p>
            ) : reviews.length ? (
              <div className="grid gap-4 md:grid-cols-3">
                {reviews.map((review, index) => {
                  const customerName = review.customerName || t('Customer')
                  return (
                    <article className="flex min-h-[260px] flex-col rounded-[24px] border border-white/70 bg-[#fffefa] p-5 text-[#102c50] shadow-[0_18px_40px_rgba(0,0,0,0.16)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_48px_rgba(0,0,0,0.22)] sm:p-6" key={`${review.createdAt}-${review.itemName}-${index}`}>
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div aria-label={t('{rating} out of 5 stars', { rating: review.rating })} className="flex gap-0.5 text-base leading-none text-[#a48700]">
                          {'★'.repeat(review.rating)}<span className="text-[#d9d6cc]">{'★'.repeat(5 - review.rating)}</span>
                        </div>
                        <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-[#fff3b8] font-display text-2xl leading-none text-[#806a00]">“</span>
                      </div>
                      <p className="flex-1 font-display text-base font-semibold leading-7 text-[#334963] sm:text-[17px]">“{review.review || t('No written comment.')}”</p>
                      <div className="mt-5 flex items-center gap-3 border-t border-[#e7e3d9] pt-4">
                        {review.profilePicture ? (
                          <img alt="" aria-hidden="true" className="size-11 shrink-0 rounded-full border-2 border-[#fff3b8] object-cover" src={review.profilePicture} />
                        ) : (
                          <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-[#ffdc32] font-display text-lg font-bold text-[#102c50]">
                            {customerName.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-extrabold text-[#102c50]">{customerName}</p>
                          <p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-[0.1em] text-[#8a7500]">{t(review.itemName)}</p>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-8 text-center sm:py-10">
                <span aria-hidden="true" className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-[#ffdc32] text-xl text-[#092a53]">✦</span>
                <p className="text-sm font-semibold text-white/85">{t('No approved reviews yet.')}</p>
              </div>
            )}
          </div>
        </section>

        <section aria-labelledby="home-faq-heading" className="relative isolate overflow-hidden bg-[#f4f2e9] px-5 py-14 sm:px-8 sm:py-18 lg:px-10 lg:py-20">
          <div aria-hidden="true" className="pointer-events-none absolute -left-24 top-12 size-64 rounded-full border-[38px] border-[#ffdc32]/20 sm:size-80" />
          <div className="relative z-10 mx-auto grid max-w-[1160px] gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-14">
            <div className="lg:sticky lg:top-28 lg:h-fit">
              <p className="mb-3 inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#8a7500]">
                <span aria-hidden="true" className="text-base">✦</span>{t('Here to help')}
              </p>
              <h2 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-[#092a53] sm:text-4xl" id="home-faq-heading">
                {t('Frequently Asked Questions')}
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-6 text-[#65748a]">{t('Find quick answers about this guide, local listings, and the information on our site.')}</p>
              <Link className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#092a53] px-5 py-3 text-xs font-extrabold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#163e6b] sm:text-sm" to="/contact">
                {t('Contact us')} <ArrowIcon />
              </Link>
            </div>
            <div className="space-y-3">
              {[
                {
                  question: 'Is this the official Cold Stone Creamery Cameroon website?',
                  answer: 'No. This is an independent information guide and is not affiliated with or operated by Cold Stone Creamery.',
                },
                {
                  question: 'Are the listed locations and opening hours always current?',
                  answer: 'Public business details can change. Please confirm a location and its hours through a current local listing before visiting.',
                },
                {
                  question: 'Will every Cameroon location have the same menu?',
                  answer: 'Menus, flavors, and availability may vary by location. Contact your preferred shop to check what is currently available.',
                },
                {
                  question: 'Can I order treats through this website?',
                  answer: 'This site has a separate online catalog and checkout managed by its operator. Those products and prices are not confirmed as Cold Stone Cameroon offerings.',
                },
                {
                  question: 'How can I find a location near me?',
                  answer: 'Use the Locations page to browse the public listings and available address details for Cameroon.',
                },
                {
                  question: 'How can I contact this website?',
                  answer: 'Use the Contact page to send a message to the operator of this independent guide.',
                },
              ].map(({ question, answer }) => (
                <details className="group rounded-2xl border border-[#e5e1d7] bg-white px-5 py-4 shadow-[0_8px_24px_rgba(18,44,80,0.045)] transition duration-200 open:border-[#d9c76d] open:shadow-[0_14px_34px_rgba(18,44,80,0.09)] sm:px-6 sm:py-5" key={question}>
                  <summary className="flex cursor-pointer list-none items-center gap-4 text-sm font-extrabold leading-6 text-[#092a53] marker:content-none sm:text-base">
                    <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-[#fff3b8] text-xs font-extrabold text-[#806a00] transition group-open:bg-[#092a53] group-open:text-[#ffdc32]">?</span>
                    <span className="flex-1">{t(question)}</span>
                    <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full border border-[#e7e3d9] text-[#65748a] transition duration-200 group-open:rotate-45 group-open:border-[#092a53] group-open:bg-[#092a53] group-open:text-white">
                      <svg className="size-4" fill="none" viewBox="0 0 24 24">
                        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                      </svg>
                    </span>
                  </summary>
                  <p className="ml-12 mt-3 max-w-2xl border-t border-[#eeeae1] pt-4 text-sm leading-6 text-[#65748a] sm:ml-12">
                    {t(answer)}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <InstagramSection />

      </main>
      <Footer />
    </div>
  )
}
