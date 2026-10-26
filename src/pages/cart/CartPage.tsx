import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Header, Footer } from '../../components/Layout'
import { type CartItem } from '../../context/CartContext'
import { useCart } from '../../context/useCart'
import { formatCartMoney, getCartPricing } from '../../lib/cartPricing'
import { useLanguage } from '../../language/useLanguage'
import { apiRequest } from '../../api/api'
import { getMenuItemId } from '../../../shared/data'
import { photoErrorHandler, photoSrcSet } from '../../lib/thumbnails'
import { rankSimilar } from '../../lib/similarItems'

type MenuSuggestion = CartItem & {
  priceXaf: number
  isAvailable?: boolean
}

type MenuCategory = {
  title: string
  items: MenuSuggestion[]
}

function Icon({ path, className = 'size-[18px]' }: { path: string; className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d={path} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  )
}

const icons = {
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  bag: 'M6 7h12l-1 13H7L6 7Zm3 0V6a3 3 0 0 1 6 0v1',
  trash: 'M4 7h16M10 11v6m4-6v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3',
  gift: 'M4 11h16v9H4v-9Zm-1-4h18v4H3V7Zm9 0v13M12 7S10.5 3 8 3.5 7.5 7 12 7Zm0 0s1.5-4 4-3.5S16.5 7 12 7Z',
  lock: 'M6 11h12v9H6v-9Zm2 0V8a4 4 0 0 1 8 0v3',
  clock: 'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  truck: 'M3 7h11v9H3V7Zm11 3h4l3 3v3h-7v-6ZM7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  info: 'M12 11v5m0-8.5v.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
}

export function CartPage() {
  const { cartItems, addToCart, removeFromCart, updateQuantity, clearCart } = useCart()
  const { t, language } = useLanguage()
  const [confirmClear, setConfirmClear] = useState(false)
  const [suggestions, setSuggestions] = useState<MenuCategory[]>([])
  const [suggestionsError, setSuggestionsError] = useState('')
  const [suggestionsLoading, setSuggestionsLoading] = useState(true)
  const [suggestionError, setSuggestionError] = useState('')
  const [addedSuggestionId, setAddedSuggestionId] = useState<string | number | null>(null)
  const { cartCount, currency, subtotal, freeScoops, discount, total } = getCartPricing(cartItems)
  const money = (amount: number) => formatCartMoney(amount, currency, language)
  const hasUnavailableItems = cartItems.some((item: CartItem) => item.availableQuantity !== undefined && item.availableQuantity < item.quantity)
  const hasMenuItems = cartItems.some((item) => item.itemType === 'menu')
  const scoopCount = cartItems.filter((item) => item.itemType !== 'menu').reduce((sum, item) => sum + item.quantity, 0)
  const scoopsTowardOffer = scoopCount % 3
  const scoopsToNextFree = 3 - scoopsTowardOffer
  const shopPath = hasMenuItems ? '/menu' : '/flavors'
  const itemPath = (item: CartItem) => (item.itemType === 'menu' ? '/menu' : `/flavor/${item.id}`)

  const steps = [t('Shopping bag'), t('Checkout'), t('Payment')]

  useEffect(() => {
    let cancelled = false
    apiRequest<{ categories: MenuCategory[] }>('/menu')
      .then((result) => {
        if (!cancelled) {
          if (Array.isArray(result?.categories)) {
            setSuggestions(result.categories)
          } else {
            setSuggestionsError('Menu suggestions could not be loaded.')
          }
          setSuggestionsLoading(false)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setSuggestionsError(error instanceof Error ? error.message : 'Menu suggestions could not be loaded.')
          setSuggestionsLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const availableMenuItems = suggestions
    .flatMap((category) => category.items
      .filter((item) => item.isAvailable !== false && (item.availableQuantity === undefined || item.availableQuantity > 0))
      .map((item) => ({
        category,
        item,
        key: String(item.id || getMenuItemId(category.title, item.name)),
        group: category.title,
        text: `${item.name} ${item.detail || ''} ${category.title}`,
      })))
  const cartMenuIds = new Set(
    cartItems
      .filter((item) => item.itemType === 'menu')
      .map((item) => String(item.id)),
  )
  const menuItemsToRecommend = availableMenuItems.filter((candidate) => !cartMenuIds.has(candidate.key))
  const recommendationScores = new Map<string, number>()
  const orderedRecommendations: typeof menuItemsToRecommend = []

  if (cartItems.length === 0) {
    orderedRecommendations.push(...menuItemsToRecommend.slice(0, 8))
  } else {
    for (const cartItem of cartItems) {
      const group = cartItem.itemType === 'menu' ? cartItem.categoryTitle : 'Ice Cream'
      const ranked = rankSimilar(
        {
          key: String(cartItem.id),
          group,
          text: `${cartItem.name} ${cartItem.detail || ''} ${cartItem.tag || ''}`,
        },
        menuItemsToRecommend,
        menuItemsToRecommend.length,
      )
      ranked.forEach((candidate, index) => {
        const score = menuItemsToRecommend.length - index
        recommendationScores.set(
          candidate.key,
          (recommendationScores.get(candidate.key) || 0) + score,
        )
      })
    }
    const recommendationOrder = [...menuItemsToRecommend].sort((first, second) =>
      (recommendationScores.get(second.key) || 0) - (recommendationScores.get(first.key) || 0),
    )
    orderedRecommendations.push(...recommendationOrder.slice(0, 8))
  }

  const addSuggestion = (category: MenuCategory, item: MenuSuggestion) => {
    setSuggestionError('')
    const id = item.id || getMenuItemId(category.title, item.name)
    const added = addToCart({
      ...item,
      id,
      itemType: 'menu',
      categoryTitle: category.title,
      price: item.priceXaf,
    })
    if (added) {
      setAddedSuggestionId(id)
      window.setTimeout(() => setAddedSuggestionId((current) => current === id ? null : current), 1400)
    } else {
      setSuggestionError(t('This item could not be added to your bag. Please try again.'))
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f6f8] text-[#472a3b]">
      <Header />

      <main id="main" tabIndex={-1}>
        <section className="bg-[#472a3b] px-5 py-8 text-white sm:px-8 sm:py-10 lg:px-12">
          <div className="mx-auto max-w-[1240px]">
            <nav aria-label={t('Breadcrumb')} className="text-xs font-semibold text-white/55">
              <Link className="transition hover:text-[#ffb84d]" to="/">{t('Home')}</Link>
              <span aria-hidden="true" className="mx-2">/</span>
              <span aria-current="page" className="text-white">{t('Shopping bag')}</span>
            </nav>

            <div className="mt-7 flex flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <h1 className="font-display text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-5xl lg:text-6xl">
                  {t('Your shopping bag')}
                </h1>
                {cartItems.length > 0 && (
                  <p className="mt-3 max-w-xl text-sm leading-6 text-white/75 sm:text-base">
                    {t('You have {count} scoop(s) across {flavors} flavor(s) in your bag.', { count: cartCount, flavors: cartItems.length })}
                  </p>
                )}
              </div>

              <ol aria-label={t('Checkout progress')} className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-bold sm:gap-x-4">
                {steps.map((step, index) => (
                  <li className="flex items-center gap-2" key={step}>
                    <span
                      aria-current={index === 0 ? 'step' : undefined}
                      className={`inline-flex min-h-9 items-center gap-2 whitespace-nowrap ${index === 0 ? 'text-[#ffb84d]' : 'text-white/60'}`}
                    >
                      <span className={`grid size-6 place-items-center rounded-full text-xs ${index === 0 ? 'bg-[#ffb84d] text-[#472a3b]' : 'bg-white/10 text-white/75'}`}>
                        {index + 1}
                      </span>
                      {step}
                    </span>
                    {index < steps.length - 1 && <span aria-hidden="true" className="h-px w-4 bg-white/25 sm:w-6" />}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-[1240px] px-5 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12">
          {cartItems.length === 0 ? (
            <section className="mx-auto grid max-w-5xl gap-8 bg-white px-6 py-10 sm:px-10 sm:py-12 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-14 lg:px-14">
              <div>
                <span className="grid size-14 place-items-center rounded-full bg-[#f4f6f8] text-[#472a3b]">
                  <Icon className="size-7" path={icons.bag} />
                </span>
                <h2 className="mt-5 font-display text-3xl font-extrabold text-[#472a3b] sm:text-4xl">{t('Your bag is empty')}</h2>
                <p className="mt-3 max-w-md text-sm leading-6 text-[#65748a] sm:text-base sm:leading-7">
                  {t('Start adding your favorite flavors and get ready for a sweet treat!')}
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link
                    className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-[#ffb84d] px-6 py-3 text-sm font-extrabold text-[#472a3b] transition-colors hover:bg-[#ffcf85] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#472a3b] focus-visible:ring-offset-2"
                    to="/flavors"
                  >
                    {t('Explore flavors')} <Icon className="size-4" path={icons.arrow} />
                  </Link>
                  <Link
                    className="inline-flex min-h-12 items-center gap-2 rounded-lg px-5 py-3 text-sm font-bold text-[#472a3b] transition-colors hover:bg-[#f4f6f8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#472a3b] focus-visible:ring-offset-2"
                    to="/menu"
                  >
                    {t('Browse the menu')}
                  </Link>
                </div>
              </div>
              <p className="flex max-w-xs items-start gap-3 bg-[#fff8d8] p-5 text-sm font-semibold leading-6 text-[#5d4c00]">
                <Icon className="mt-0.5 size-5 shrink-0" path={icons.gift} />
                {t('Buy 2 scoops, get the 3rd free')}
              </p>
            </section>
          ) : (
            <div className="grid min-w-0 items-start gap-7 lg:grid-cols-[minmax(0,1fr)_380px] xl:gap-10">
              <section aria-labelledby="cart-items-heading" className="min-w-0 space-y-5">
                {scoopCount > 0 && (
                  <div className="flex flex-col gap-4 bg-[#f4f6f8] p-5 sm:flex-row sm:items-center sm:p-6">
                    <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white text-[#472a3b]">
                      <Icon className="size-6" path={icons.gift} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-extrabold text-[#472a3b]">
                        {scoopsTowardOffer === 0
                          ? t('{count} free scoop(s) unlocked — nice!', { count: freeScoops })
                          : t('Add {count} more scoop(s) to get one free', { count: scoopsToNextFree })}
                      </p>
                      <div
                        aria-label={t('Buy 2 Get 1 Free progress')}
                        aria-valuemax={3}
                        aria-valuemin={0}
                        aria-valuenow={scoopsTowardOffer === 0 ? 3 : scoopsTowardOffer}
                        className="mt-3 grid grid-cols-3 gap-1.5"
                        role="progressbar"
                      >
                        {[1, 2, 3].map((segment) => (
                          <span
                            className={`h-2 rounded-full transition-colors duration-500 ${scoopsTowardOffer === 0 || segment <= scoopsTowardOffer
                              ? segment === 3 || scoopsTowardOffer === 0
                                ? 'bg-[#6c9c45]'
                                : 'bg-[#ffb84d]'
                              : 'bg-[#cfd8e1]'
                              }`}
                            key={segment}
                          />
                        ))}
                      </div>
                    </div>
                    <Link
                      className="inline-flex shrink-0 items-center gap-1.5 text-sm font-bold text-[#472a3b] transition hover:text-[#b8721e]"
                      to="/flavors"
                    >
                      {t('Add flavors')} <Icon className="size-4" path={icons.arrow} />
                    </Link>
                  </div>
                )}

                <div className="overflow-hidden bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-[#f4f6f8] px-5 py-4 sm:px-7 sm:py-5">
                    <h2 className="flex items-center gap-2.5 font-display text-xl font-extrabold text-[#472a3b]" id="cart-items-heading">
                      {t('Items in your bag')}
                      <span className="rounded-full bg-white px-2.5 py-0.5 font-sans text-xs font-extrabold text-[#65748a]">{cartCount}</span>
                    </h2>
                    {confirmClear ? (
                      <span className="flex items-center gap-2 text-xs font-bold">
                        <span className="text-[#65748a]">{t('Remove everything?')}</span>
                        <button
                          className="rounded-md bg-red-700 px-3 py-1.5 text-white transition hover:bg-red-800"
                          onClick={() => {
                            clearCart()
                            setConfirmClear(false)
                          }}
                          type="button"
                        >
                          {t('Yes, clear')}
                        </button>
                        <button className="rounded-md px-3 py-1.5 text-[#65748a] transition hover:bg-white" onClick={() => setConfirmClear(false)} type="button">
                          {t('Cancel')}
                        </button>
                      </span>
                    ) : (
                      <button
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-[#65748a] transition hover:bg-red-50 hover:text-red-700"
                        onClick={() => setConfirmClear(true)}
                        type="button"
                      >
                        <Icon className="size-4" path={icons.trash} />
                        {t('Clear bag')}
                      </button>
                    )}
                  </div>

                  <ul className="divide-y divide-[#f4f6f8]">
                    {cartItems.map((item) => {
                      const isShort = item.availableQuantity !== undefined && item.availableQuantity < item.quantity
                      return (
                        <li className="group flex min-w-0 gap-4 px-5 py-5 transition-colors hover:bg-[#f4f6f8] sm:gap-6 sm:px-7 sm:py-6" key={item.id}>
                          <Link
                            aria-label={t(item.name)}
                            className={`relative size-24 shrink-0 overflow-hidden rounded-lg ${item.color} sm:size-32`}
                            to={itemPath(item)}
                          >
                            <img decoding="async" loading="lazy"
                              alt={t(item.name)}
                              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                              src={item.image}
                            />
                          </Link>

                          <div className="flex min-w-0 flex-1 flex-col gap-4">
                            <div className="flex min-w-0 items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-[#65748a]">
                                  {t(item.itemType === 'menu' ? 'Menu' : 'Flavors')}
                                </p>
                                <Link
                                  className="mt-1 block truncate font-display text-lg font-bold text-[#472a3b] transition hover:text-[#b8721e] sm:text-xl"
                                  to={itemPath(item)}
                                >
                                  {t(item.name)}
                                </Link>
                                {item.detail && (
                                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#65748a] sm:text-sm">{t(item.detail)}</p>
                                )}
                              </div>
                              <button
                                aria-label={t('Remove {name} from cart', { name: t(item.name) })}
                                className="grid size-9 shrink-0 place-items-center rounded-full text-[#9aa3af] transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                                onClick={() => removeFromCart(item.id)}
                                title={t('Remove')}
                                type="button"
                              >
                                <Icon className="size-[18px]" path={icons.trash} />
                              </button>
                            </div>

                            {isShort && (
                              <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-xs font-semibold leading-5 text-red-700 ring-1 ring-red-100" role="status">
                                <Icon className="mt-0.5 size-4 shrink-0" path={icons.info} />
                                {item.availableQuantity > 0
                                  ? t('Only {count} available now. Quantity reduced to match stock.', { count: item.availableQuantity })
                                  : t('Currently sold out or reserved by another checkout. Remove it or try again later.')}
                              </p>
                            )}

                            <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="inline-flex items-center rounded-lg bg-[#f4f6f8] p-1">
                                  <button
                                    aria-label={t('Decrease quantity')}
                                    className="grid size-8 place-items-center rounded-md text-[#65748a] transition hover:bg-white hover:text-[#472a3b]"
                                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                    type="button"
                                  >
                                    <Icon className="size-4" path="M6 12h12" />
                                  </button>
                                  <span aria-live="polite" className="w-9 text-center text-sm font-extrabold tabular-nums text-[#472a3b]">
                                    {item.quantity}
                                  </span>
                                  <button
                                    aria-label={t('Increase quantity')}
                                    className="grid size-8 place-items-center rounded-md text-[#65748a] transition hover:bg-white hover:text-[#472a3b] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
                                    disabled={item.quantity >= item.availableQuantity}
                                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                    type="button"
                                  >
                                    <Icon className="size-4" path="M12 6v12M6 12h12" />
                                  </button>
                                </div>
                                {item.availableQuantity <= 3 && !isShort && (
                                  <span className="rounded-full bg-[#fff3e0] px-2.5 py-1 text-xs font-bold text-[#8b5e00]">
                                    {t('{count} left', { count: item.availableQuantity })}
                                  </span>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="font-display text-lg font-extrabold tabular-nums text-[#472a3b] sm:text-xl">
                                  {money(item.price * item.quantity)}
                                </p>
                                {item.quantity > 1 && (
                                  <p className="text-xs font-semibold text-[#8b95a2]">
                                    {money(item.price)} {t('each')}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>

                  <div className="bg-[#f4f6f8] px-5 py-4 sm:px-7">
                    <Link className="inline-flex items-center gap-2 text-sm font-bold text-[#472a3b] transition hover:gap-3 hover:text-[#b8721e]" to={shopPath}>
                      <Icon className="size-4 rotate-180" path={icons.arrow} />
                      {t('Continue shopping')}
                    </Link>
                  </div>
                </div>

                <p className="flex gap-3 bg-[#f4f6f8] px-4 py-3.5 text-xs leading-5 text-[#334e6e] sm:px-5">
                  <Icon className="mt-0.5 size-4 shrink-0" path={icons.info} />
                  {t("Prices are in FCFA. Any delivery fee is shown at checkout before you pay.")}
                </p>
              </section>

              <aside aria-labelledby="order-summary-heading" className="relative z-10 space-y-4 lg:sticky lg:top-[calc(var(--site-header-offset,0px)+2rem)] lg:transition-[top] lg:duration-300">
                <div className="overflow-hidden bg-white">
                  <div className="bg-[#472a3b] px-6 py-5 text-white sm:px-7">
                    <h2 className="font-display text-2xl font-extrabold" id="order-summary-heading">{t('Order summary')}</h2>
                  </div>

                  <div className="space-y-5 p-6 sm:p-7">
                    <dl className="space-y-3 text-sm">
                      <div className="flex justify-between gap-3">
                        <dt className="text-[#65748a]">
                          {t('Subtotal')} <span className="text-[#9aa3af]">({cartCount})</span>
                        </dt>
                        <dd className="font-bold tabular-nums text-[#472a3b]">{money(subtotal)}</dd>
                      </div>
                      {discount > 0 && (
                        <div className="flex justify-between gap-3 rounded-xl bg-[#eef6e8] px-3 py-2.5 ring-1 ring-[#d6e8c7]">
                          <dt className="flex items-center gap-2 font-semibold text-[#3f6b22]">
                            <Icon className="size-4" path={icons.gift} />
                            {t('Buy 2 Get 1 Free ({count} free)', { count: freeScoops })}
                          </dt>
                          <dd className="font-extrabold tabular-nums text-[#3f6b22]">−{money(discount)}</dd>
                        </div>
                      )}
                      <div className="flex justify-between gap-3">
                        <dt className="text-[#65748a]">{t('Delivery')}</dt>
                        <dd className="text-xs font-semibold text-[#8b95a2]">{t('Calculated at checkout')}</dd>
                      </div>
                    </dl>

                    <div className="flex items-end justify-between gap-3 border-t border-[#f4f6f8] pt-5">
                      <span className="font-display text-lg font-extrabold text-[#472a3b]">{t('Total')}</span>
                      <span className="font-display text-3xl font-extrabold tabular-nums leading-none text-[#472a3b]">{money(total)}</span>
                    </div>
                    {discount > 0 && (
                      <p className="-mt-2 text-right text-xs font-bold text-[#3f6b22]">
                        {t('You save {amount}', { amount: money(discount) })}
                      </p>
                    )}

                    {hasUnavailableItems ? (
                      <button
                        className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-[#f4f6f8] px-5 py-4 text-sm font-extrabold text-[#65748a]"
                        disabled
                        type="button"
                      >
                        <Icon className="size-4" path={icons.info} />
                        {t('Update your bag to checkout')}
                      </button>
                    ) : (
                      <Link
                        className="group flex w-full items-center justify-center gap-2 rounded-lg bg-[#ffb84d] px-5 py-4 text-sm font-extrabold text-[#472a3b] transition-colors hover:bg-[#ffcf85] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#472a3b] focus-visible:ring-offset-2"
                        to="/checkout"
                      >
                        <Icon className="size-4" path={icons.lock} />
                        {t('Proceed to checkout')}
                        <Icon className="size-4 transition group-hover:translate-x-0.5" path={icons.arrow} />
                      </Link>
                    )}
                  </div>
                </div>

                <ul className="grid gap-2.5 bg-white p-5 text-xs">
                  {[
                    { icon: icons.lock, title: t('Secure checkout'), body: t('Your payment details are protected.') },
                    { icon: icons.truck, title: t('Delivery or pickup'), body: t('Choose what suits you at checkout.') },
                    { icon: icons.clock, title: t('Made fresh'), body: t('Prepared when your order is confirmed.') },
                  ].map((perk) => (
                    <li className="flex items-center gap-3" key={perk.title}>
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#f4f6f8] text-[#472a3b]">
                        <Icon className="size-4" path={perk.icon} />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-extrabold text-[#472a3b]">{perk.title}</span>
                        <span className="block text-[#65748a]">{perk.body}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </aside>
            </div>
          )}

          <section aria-labelledby="cart-suggestions-heading" className="mt-12">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <h2 className="font-display text-2xl font-extrabold text-[#472a3b]" id="cart-suggestions-heading">{t('You might also like')}</h2>
              <Link className="text-sm font-bold text-[#472a3b] underline decoration-[#ffb84d] decoration-2 underline-offset-4" to="/menu">{t('Browse the menu')}</Link>
            </div>
            {suggestionsLoading && (
              <p className="bg-white px-4 py-3 text-sm text-[#65748a]" role="status">{t('Loading menu suggestions…')}</p>
            )}
            {suggestionsError && (
              <p className="bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{t(suggestionsError)}</p>
            )}
            {!suggestionsLoading && !suggestionsError && orderedRecommendations.length > 0 && (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
                {orderedRecommendations.map(({ category, item }) => {
                  const itemId = item.id || getMenuItemId(category.title, item.name)
                  const added = addedSuggestionId === itemId
                  return (
                    <li className="group flex min-w-0 flex-col overflow-hidden bg-white p-2 sm:p-3" key={itemId}>
                      <Link className="relative overflow-hidden bg-[#f4f6f8]" to={`/menu?${new URLSearchParams({ category: category.title, item: item.name })}`}>
                        <img alt={t(item.name)} className="aspect-square w-full object-cover transition duration-700 ease-out group-hover:scale-[1.06] group-focus-within:scale-[1.06] motion-reduce:transition-none" loading="lazy" onError={photoErrorHandler(item.image)} sizes="(min-width: 1024px) 25vw, 50vw" src={item.image} srcSet={photoSrcSet(item.image)} />
                        <span aria-hidden="true" className="menu-card-shine" />
                      </Link>
                      <div className="flex flex-1 flex-col px-1 pb-1 pt-3 sm:px-1.5">
                        <h3 className="line-clamp-2 min-h-[2.5em] font-display text-sm font-extrabold leading-snug text-[#472a3b] sm:text-base">{t(item.name)}</h3>
                        <p className="mt-1 font-display text-sm font-extrabold tabular-nums text-[#472a3b]">{formatCartMoney(item.priceXaf, 'xaf', language)}</p>
                        <button
                          aria-label={added ? t('Added to your bag') : t('Add {name} to cart', { name: t(item.name) })}
                          className={`mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-md px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#472a3b] focus-visible:ring-offset-2 ${added ? 'bg-[#37632c] text-white' : 'bg-[#472a3b] text-white hover:bg-[#6b3f58]'}`}
                          onClick={() => addSuggestion(category, item)}
                          type="button"
                        >
                          {added ? t('Added') : t('Add to cart')}
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            {!suggestionsLoading && !suggestionsError && orderedRecommendations.length === 0 && (
              <p className="bg-white px-4 py-3 text-sm text-[#65748a]" role="status">{t('No menu suggestions are available right now.')}</p>
            )}
            {suggestionError && <p className="mt-3 text-sm font-semibold text-red-700" role="alert">{suggestionError}</p>}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}
