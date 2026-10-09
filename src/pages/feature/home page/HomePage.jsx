import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Footer, Header, ArrowIcon } from '../../../components/Layout'
import { useCart } from '../../../CartContext'
import { apiRequest } from '../../../api/api'
import { cameroonLocations, coldStoneMenuCategories, getMenuItemId } from '../../../data'
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
          const items = getPopularFlavors(categories)
          setPopularFlavors(items)
          setMenuError('')
          return Promise.all(items.map(async (item) => {
            const itemId = item.id || getMenuItemId('Ice Cream', item.name)
            const result = await apiRequest(`/menu/${encodeURIComponent(itemId)}/reviews`)
            return result.reviews.map((review) => ({ ...review, itemName: item.name }))
          }))
            .then((itemReviews) => {
              if (!cancelled) {
                setReviews(itemReviews.flat().sort((first, second) => (
                  new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()
                )).slice(0, 3))
                setReviewsError('')
              }
            })
            .catch((error) => {
              if (!cancelled) setReviewsError(error.message)
            })
        }
      })
      .catch((error) => {
        if (!cancelled) setMenuError(error.message)
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
    <div className="min-h-screen overflow-hidden bg-[#fbfaf5] text-[#102c50]">
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
                {t('Scoop happiness')}
                <span className="mt-2 block font-display font-bold italic tracking-[-0.045em] text-[#ffdc32]">{t('Every day!')}</span>
              </h1>
              <p className="mt-6 max-w-md text-sm leading-6 text-white/80 sm:text-base sm:leading-7">
                {t('Explore signature creations, discover the online catalog, and find publicly listed locations in Cameroon.')}
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
          <div className="relative z-10 mx-auto max-w-[1240px]">
            <div className="mb-7 flex items-end justify-between gap-4 sm:mb-9">
              <div>
                <p className="mb-2 inline-flex rounded-full bg-[#ffdc32] px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#102c50]">{t('Our favorites')}</p>
                <h2 className="font-display text-3xl font-extrabold leading-none tracking-tight text-[#102c50] sm:text-4xl" id="popular-flavors-heading">{t('Popular Flavors')}</h2>
                <p className="mt-2 max-w-xl text-xs leading-5 text-[#53667d] sm:text-sm">{t('From classic scoops to signature creations, find a new favorite.')}</p>
              </div>
              <div className="flex shrink-0 items-center">
                <Link
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#ffdc32] px-3 py-2 text-xs font-extrabold text-[#102c50] transition hover:bg-[#ffe76c] sm:px-4 sm:text-sm"
                  to={`/menu?category=${encodeURIComponent('Ice Cream')}`}
                >
                  {t('View all')} <ArrowIcon />
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
              {popularFlavors.map((item, index) => {
                const soldOut = item.isAvailable === false || item.availableQuantity < 1
                return (
                  <article className="overflow-hidden rounded-[20px] shadow-[0_8px_24px_rgba(18,44,80,0.07)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_14px_32px_rgba(18,44,80,0.12)]" key={item.id || item.name} style={{ backgroundColor: popularFlavorColors[index] }}>
                    <div className="aspect-square overflow-hidden p-2.5 sm:p-3" style={{ backgroundColor: popularFlavorColors[index] }}>
                      <img
                        alt={t(item.name)}
                        className="h-full w-full rounded-[14px] object-cover"
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.onerror = null
                          event.currentTarget.src = '/images/hero-ice-cream.jpg'
                        }}
                        src={item.image}
                      />
                    </div>
                    <div className="p-3 sm:p-3.5">
                      <h3 className="min-h-10 font-display text-sm font-bold leading-snug text-[#102c50] sm:text-base">{t(item.name)}</h3>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-xs font-extrabold text-[#102c50] sm:text-sm">{formatPrice(item.priceXaf)}</span>
                        <button
                          aria-label={soldOut ? t('Sold out') : t('Add {name} to your bag', { name: t(item.name) })}
                          className="grid size-8 shrink-0 place-items-center rounded-full bg-[#ffdc32] text-lg font-bold leading-none text-[#102c50] transition hover:scale-105 hover:bg-[#ffe76c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#102c50] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#d9d6cc] disabled:text-[#65748a]"
                          disabled={soldOut}
                          onClick={() => handleAddToCart(item)}
                          type="button"
                        >
                          {soldOut ? '–' : '+'}
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

        <section aria-labelledby="why-choose-us-heading" className="relative isolate overflow-hidden bg-[#092a53] px-5 pb-24 pt-10 text-white sm:px-8 sm:pb-28 sm:pt-14">
          <div className="relative z-10 mx-auto grid max-w-[1240px] items-center gap-10 md:grid-cols-[1fr_0.7fr]">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#ffdc32]">{t('Why choose us')}</p>
              <h2 className="mt-2 font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl" id="why-choose-us-heading">
                {t('More scoops. More smiles.')}
              </h2>
              <div className="mt-7 grid gap-x-8 gap-y-6 sm:grid-cols-2">
                {[
                  { icon: '✿', title: 'Natural ingredients', detail: 'Only the good stuff, always.', color: '#a8df62' },
                  { icon: '★', title: 'Unique flavors', detail: 'Classic to creative.', color: '#ffdc32' },
                  { icon: '❄', title: 'Freshly made', detail: 'A little joy, every day.', color: '#4fc4e8' },
                  { icon: '♡', title: 'Happy customers', detail: 'Your smile is our success.', color: '#f56586' },
                ].map((benefit) => (
                  <article className="flex items-center gap-3" key={benefit.title}>
                    <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-full text-xl font-bold text-[#102c50]" style={{ backgroundColor: benefit.color }}>
                      {benefit.icon}
                    </span>
                    <span>
                      <span className="block text-sm font-extrabold">{t(benefit.title)}</span>
                      <span className="mt-1 block text-xs leading-5 text-white/70">{t(benefit.detail)}</span>
                    </span>
                  </article>
                ))}
              </div>
            </div>
            <div aria-hidden="true" className="hidden justify-self-center text-center font-display text-4xl font-extrabold italic leading-tight text-white/90 md:block lg:text-5xl">
              <span className="block -rotate-6">{t('Small Scoops')}</span>
              <span className="block rotate-3 text-[#ffdc32]">{t('Big Smiles')}</span>
              <span className="mt-2 block text-5xl not-italic text-[#ffdc32]">☺</span>
            </div>
          </div>
          <svg aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-14 w-full sm:h-20" preserveAspectRatio="none" viewBox="0 0 1440 100">
            <path d="M0 36C170 80 310 3 500 38s310 51 480 15 270-16 460 20v27H0Z" fill="#5ac4d9" />
            <path d="M0 44c180-26 280 10 450 5s270-42 450-21 290 20 540-13v85H0Z" fill="#fbfaf5" />
          </svg>
        </section>

        <section className="mx-auto max-w-[1320px] px-5 py-14 sm:px-8 sm:py-20 lg:px-12">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="mb-2 inline-block rounded-full bg-[#ffeb9c] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em]">{t('The Cold Stone experience')}</p>
              <h2 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">{t('Menu highlights')}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#65748a]">{t('These categories appear on the global Cold Stone menu. Ask a Cameroon branch to confirm current selection.')}</p>
            </div>
            <Link className="mb-1 hidden items-center gap-2 text-sm font-bold transition hover:text-[#ccaa00] sm:inline-flex" to="/menu">
              {t('View menu guide')} <ArrowIcon diagonal />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {coldStoneMenuCategories.map((category) => (
              <article className="rounded-[22px] border border-[#d9d6cc] bg-white p-5 shadow-[0_8px_30px_rgba(18,44,80,0.05)]" key={category.title}>
                <span aria-hidden="true" className="grid size-12 place-items-center rounded-full bg-[#fff0a8] text-2xl">{category.icon}</span>
                <h3 className="mt-4 font-display text-xl font-bold">{t(category.title)}</h3>
                <p className="mt-2 text-sm leading-6 text-[#65748a]">{t(category.description)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="relative isolate overflow-hidden bg-[#092a53] px-5 pb-24 pt-24 text-white sm:px-8 sm:pb-28 sm:pt-28">
          <svg aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-14 w-full sm:h-20" preserveAspectRatio="none" viewBox="0 0 1440 100">
            <path d="M0 36C170 80 310 3 500 38s310 51 480 15 270-16 460 20v27H0Z" fill="#5ac4d9" transform="rotate(180 720 50)" />
            <path d="M0 44c180-26 280 10 450 5s270-42 450-21 290 20 540-13v85H0Z" fill="#fbfaf5" transform="rotate(180 720 50)" />
          </svg>
          <div className="relative z-10 mx-auto grid max-w-[1240px] items-center gap-8 md:grid-cols-[1fr_auto]">
            <div>
              <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.17em] text-[#ffdc32]">{t('Cameroon locations')}</p>
              <h2 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">{t('Find a nearby shop')}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">{t('Public listings point to several neighborhoods in Douala and to Bastos in Yaounde. Use the location guide to check the available details.')}</p>
            </div>
            <Link className="inline-flex items-center justify-center gap-2 rounded-full bg-[#ffdc32] px-6 py-3 text-sm font-bold text-[#102c50] transition hover:bg-[#ffe76c]" to="/locations">
              {t('See all listed locations')} <ArrowIcon />
            </Link>
          </div>
          <div className="mx-auto mt-8 grid max-w-[1240px] gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {cameroonLocations.map((location) => (
              <Link className="rounded-2xl border border-white/15 bg-white/5 p-4 transition hover:bg-white/10" key={location.area} to="/locations">
                <span className="block text-xs font-bold text-[#ffdc32]">{t(location.town)}</span>
                <span className="mt-1 block font-display text-lg font-bold">{t(location.area)}</span>
              </Link>
            ))}
          </div>
          <svg aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-14 w-full sm:h-20" preserveAspectRatio="none" viewBox="0 0 1440 100">
            <path d="M0 36C170 80 310 3 500 38s310 51 480 15 270-16 460 20v27H0Z" fill="#5ac4d9" />
            <path d="M0 44c180-26 280 10 450 5s270-42 450-21 290 20 540-13v85H0Z" fill="#fbfaf5" />
          </svg>
        </section>

        <section aria-labelledby="real-reviews-heading" className="relative overflow-hidden bg-[#fbfaf5] px-5 py-8 sm:px-8 sm:py-10">
          <div className="relative z-10 mx-auto max-w-[1160px]">
            <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#bd9c00]">{t('What our customers are saying')}</p>
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-[#102c50] sm:text-3xl" id="real-reviews-heading">{t('Real Reviews')}</h2>
            {reviewsError ? (
              <p className="mt-4 rounded-xl border border-[#d9d6cc] bg-white p-4 text-sm text-[#65748a]" role="status">
                {t('Customer reviews could not be loaded')}: {reviewsError}
              </p>
            ) : reviews.length ? (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {reviews.map((review, index) => {
                  const customerName = review.customerName || t('Customer')
                  return (
                    <article className="flex min-h-44 flex-col rounded-[16px] border border-[#d9d6cc] bg-white p-4 shadow-[0_6px_18px_rgba(9,42,83,0.06)] sm:p-5" key={`${review.createdAt}-${review.itemName}-${index}`}>
                      <p className="flex-1 text-sm leading-6 text-[#40536b]">“{review.review || t('No written comment.')}”</p>
                      <div className="mt-4 flex items-center gap-3 border-t border-[#d9d6cc] pt-3">
                        {review.profilePicture ? (
                          <img alt="" aria-hidden="true" className="size-9 shrink-0 rounded-full object-cover" src={review.profilePicture} />
                        ) : (
                          <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-[#ffdc32] font-display font-bold text-[#102c50]">
                            {customerName.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-[#102c50]">{customerName}</p>
                          <p className="truncate text-xs text-[#65748a]">{t(review.itemName)}</p>
                        </div>
                        <div aria-label={t('{rating} out of 5 stars', { rating: review.rating })} className="shrink-0 text-sm tracking-tight text-[#bd9c00]">
                          {'★'.repeat(review.rating)}<span className="text-[#d9d6cc]">{'★'.repeat(5 - review.rating)}</span>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="mt-4 rounded-[16px] border border-[#d9d6cc] bg-white p-5 text-sm text-[#65748a] shadow-[0_6px_18px_rgba(9,42,83,0.06)]">
                {t('No approved reviews yet.')}
              </div>
            )}
          </div>
        </section>

        <section aria-labelledby="instagram-heading" className="relative isolate overflow-hidden bg-[#ffdc32] px-5 pb-24 pt-24 text-[#092a53] sm:px-8 sm:pb-28 sm:pt-28">
          <svg aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-14 w-full sm:h-20" preserveAspectRatio="none" viewBox="0 0 1440 100">
            <path d="M0 36C170 80 310 3 500 38s310 51 480 15 270-16 460 20v27H0Z" fill="#5ac4d9" transform="rotate(180 720 50)" />
            <path d="M0 44c180-26 280 10 450 5s270-42 450-21 290 20 540-13v85H0Z" fill="#fbfaf5" transform="rotate(180 720 50)" />
          </svg>
          <div className="relative z-10 mx-auto grid max-w-[1160px] items-center gap-8 md:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.16em]">{t('Follow the fun.')}</p>
              <h2 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl" id="instagram-heading">
                {t('Follow us on Instagram')}
              </h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-[#092a53]/75">
                {t('Get a glimpse of our latest creations and sweet moments.')}
              </p>
              <a
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#092a53] px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#163e6b]"
                href="https://www.instagram.com/coldstonecameroon/"
                rel="noreferrer"
                target="_blank"
              >
                {t('Visit Instagram')}
                <ArrowIcon diagonal />
              </a>
            </div>
            <div className="grid grid-cols-3 items-center gap-2 sm:gap-4">
              <img alt={t('Ice cream treats')} className="aspect-[0.78] w-full rotate-[-4deg] rounded-xl object-cover shadow-lg sm:rounded-2xl" loading="lazy" src="/ice-images/ice-1.jpg" />
              <img alt={t('Celebration cake')} className="aspect-[0.78] w-full translate-y-3 rounded-xl object-cover shadow-lg sm:rounded-2xl" loading="lazy" src="/cake-images/cake-1.webp" />
              <img alt={t('Creamy dessert')} className="aspect-[0.78] w-full rotate-[4deg] rounded-xl object-cover shadow-lg sm:rounded-2xl" loading="lazy" src="/cream/cream%201.webp" />
            </div>
          </div>
          <svg aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-14 w-full sm:h-20" preserveAspectRatio="none" viewBox="0 0 1440 100">
            <path d="M0 36C170 80 310 3 500 38s310 51 480 15 270-16 460 20v27H0Z" fill="#5ac4d9" />
            <path d="M0 44c180-26 280 10 450 5s270-42 450-21 290 20 540-13v85H0Z" fill="#092a53" />
          </svg>
        </section>

      </main>
      <Footer />
    </div>
  )
}
