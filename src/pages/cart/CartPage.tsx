import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Header, Footer } from '../../components/Layout'
import { type CartItem } from '../../context/CartContext'
import { useCart } from '../../context/useCart'
import { formatCartMoney, getCartPricing } from '../../lib/cartPricing'
import { useLanguage } from '../../language/useLanguage'

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
  const { cartItems, removeFromCart, updateQuantity, clearCart } = useCart()
  const { t, language } = useLanguage()
  const [confirmClear, setConfirmClear] = useState(false)
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

  return (
    <div className="min-h-screen bg-[#f8f7f2] text-[#102c50]">
      <Header />

      <main>
        <section className="relative isolate overflow-hidden bg-[#092a53] px-5 pb-12 pt-9 text-white sm:px-8 sm:pb-16 sm:pt-12 lg:px-12">
          <div aria-hidden="true" className="absolute -right-32 -top-44 -z-10 size-[30rem] rounded-full border-[64px] border-white/[0.04]" />
          <div aria-hidden="true" className="absolute -bottom-40 left-[15%] -z-10 size-80 rounded-full bg-[radial-gradient(closest-side,rgb(255_220_50/0.08),rgb(255_220_50/0.08)_35%,transparent)]" />
          <div className="mx-auto max-w-[1240px]">
            <nav aria-label={t('Breadcrumb')} className="text-xs font-semibold text-white/55">
              <Link className="transition hover:text-[#ffdc32]" to="/">{t('Home')}</Link>
              <span aria-hidden="true" className="mx-2">/</span>
              <span aria-current="page" className="text-white">{t('Shopping bag')}</span>
            </nav>

            <div className="mt-6 flex flex-wrap items-end justify-between gap-8">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#ffdc32] before:h-px before:w-6 before:bg-[#ffdc32]/70">
                  {t('Your order')}
                </p>
                <h1 className="mt-3 font-display text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-[3.4rem]">
                  {t('Your shopping bag')}
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-6 text-white/65 sm:text-base">
                  {cartItems.length === 0
                    ? t('Your bag is empty. Explore our flavors and add some happiness!')
                    : t('You have {count} scoop(s) across {flavors} flavor(s) in your bag.', { count: cartCount, flavors: cartItems.length })}
                </p>
              </div>

              <ol aria-label={t('Checkout progress')} className="flex items-center gap-2 sm:gap-3">
                {steps.map((step, index) => (
                  <li className="flex items-center gap-2 sm:gap-3" key={step}>
                    <span
                      aria-current={index === 0 ? 'step' : undefined}
                      className={`flex items-center gap-2 whitespace-nowrap rounded-full py-1.5 pl-1.5 pr-3.5 text-xs font-extrabold ${
                        index === 0 ? 'bg-[#ffdc32] text-[#092a53]' : 'bg-white/[0.07] text-white/55 ring-1 ring-white/10'
                      }`}
                    >
                      <span className={`grid size-6 place-items-center rounded-full text-[11px] ${index === 0 ? 'bg-[#092a53] text-[#ffdc32]' : 'bg-white/10'}`}>
                        {index + 1}
                      </span>
                      {step}
                    </span>
                    {index < steps.length - 1 && <span aria-hidden="true" className="hidden h-px w-6 bg-white/20 sm:block" />}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-[1240px] px-5 py-8 sm:px-8 sm:py-12 lg:px-12">
          {cartItems.length === 0 ? (
            <section className="relative mx-auto max-w-3xl overflow-hidden rounded-[32px] bg-white px-6 py-14 text-center shadow-[0_18px_50px_rgba(18,44,80,0.07)] ring-1 ring-[#ebe7dc] sm:px-12 sm:py-20">
              <div aria-hidden="true" className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#fff6cc]/70 to-transparent" />
              <div className="relative">
                <span className="mx-auto grid size-24 place-items-center rounded-[30px] bg-[#092a53] text-[#ffdc32] shadow-[0_18px_36px_rgba(9,42,83,0.25)]">
                  <Icon className="size-10" path={icons.bag} />
                </span>
                <h2 className="mt-7 font-display text-3xl font-extrabold text-[#092a53] sm:text-4xl">{t('Your bag is empty')}</h2>
                <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#65748a] sm:text-base">
                  {t('Start adding your favorite flavors and get ready for a sweet treat!')}
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Link
                    className="inline-flex items-center gap-2 rounded-full bg-[#ffdc32] px-6 py-3.5 text-sm font-extrabold text-[#092a53] shadow-[0_10px_24px_rgba(255,220,50,0.3)] transition hover:-translate-y-0.5 hover:bg-[#ffe76c]"
                    to="/flavors"
                  >
                    {t('Explore flavors')} <Icon className="size-4" path={icons.arrow} />
                  </Link>
                  <Link
                    className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-extrabold text-[#092a53] ring-1 ring-[#dcd8cc] transition hover:bg-[#fbfaf5] hover:ring-[#092a53]"
                    to="/menu"
                  >
                    {t('Browse the menu')}
                  </Link>
                </div>
                <p className="mx-auto mt-10 inline-flex items-center gap-2 rounded-full bg-[#fbfaf5] px-4 py-2 text-xs font-bold text-[#715e00] ring-1 ring-[#efe4b0]">
                  <Icon className="size-4" path={icons.gift} />
                  {t('Buy 2 scoops, get the 3rd free')}
                </p>
              </div>
            </section>
          ) : (
            <div className="grid min-w-0 items-start gap-7 lg:grid-cols-[minmax(0,1fr)_380px] xl:gap-10">
              <section aria-labelledby="cart-items-heading" className="min-w-0 space-y-5">
                {scoopCount > 0 && (
                  <div className="flex flex-col gap-4 rounded-[24px] bg-white p-5 shadow-[0_10px_30px_rgba(18,44,80,0.05)] ring-1 ring-[#ebe7dc] sm:flex-row sm:items-center sm:p-6">
                    <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#fff6cc] text-[#8a7000]">
                      <Icon className="size-6" path={icons.gift} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-extrabold text-[#092a53]">
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
                            className={`h-2 rounded-full transition-colors duration-500 ${
                              scoopsTowardOffer === 0 || segment <= scoopsTowardOffer
                                ? segment === 3 || scoopsTowardOffer === 0
                                  ? 'bg-[#6c9c45]'
                                  : 'bg-[#ffdc32]'
                                : 'bg-[#eeebe1]'
                            }`}
                            key={segment}
                          />
                        ))}
                      </div>
                    </div>
                    <Link
                      className="inline-flex shrink-0 items-center gap-1.5 text-xs font-extrabold text-[#806a00] transition hover:text-[#092a53]"
                      to="/flavors"
                    >
                      {t('Add flavors')} <Icon className="size-4" path={icons.arrow} />
                    </Link>
                  </div>
                )}

                <div className="overflow-hidden rounded-[28px] bg-white shadow-[0_10px_30px_rgba(18,44,80,0.05)] ring-1 ring-[#ebe7dc]">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f0ece2] px-5 py-4 sm:px-7 sm:py-5">
                    <h2 className="flex items-center gap-2.5 font-display text-xl font-extrabold text-[#092a53]" id="cart-items-heading">
                      {t('Items in your bag')}
                      <span className="rounded-full bg-[#f1eee4] px-2.5 py-0.5 font-sans text-xs font-extrabold text-[#52647b]">{cartCount}</span>
                    </h2>
                    {confirmClear ? (
                      <span className="flex items-center gap-2 text-xs font-bold">
                        <span className="text-[#65748a]">{t('Remove everything?')}</span>
                        <button
                          className="rounded-full bg-red-600 px-3 py-1.5 text-white transition hover:bg-red-700"
                          onClick={() => {
                            clearCart()
                            setConfirmClear(false)
                          }}
                          type="button"
                        >
                          {t('Yes, clear')}
                        </button>
                        <button className="rounded-full px-3 py-1.5 text-[#52647b] ring-1 ring-[#dcd8cc] transition hover:ring-[#092a53]" onClick={() => setConfirmClear(false)} type="button">
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

                  <ul className="divide-y divide-[#f0ece2]">
                    {cartItems.map((item) => {
                      const isShort = item.availableQuantity !== undefined && item.availableQuantity < item.quantity
                      return (
                        <li className="group flex min-w-0 gap-4 px-5 py-5 transition hover:bg-[#fdfcf8] sm:gap-6 sm:px-7 sm:py-6" key={item.id}>
                          <Link
                            aria-label={t(item.name)}
                            className={`relative size-24 shrink-0 overflow-hidden rounded-[20px] ring-1 ring-black/5 ${item.color} sm:size-32`}
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
                                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#8a7000]">
                                  {t(item.itemType === 'menu' ? 'Menu' : 'Flavors')}
                                </p>
                                <Link
                                  className="mt-1 block truncate font-display text-lg font-extrabold text-[#092a53] transition hover:text-[#806a00] sm:text-xl"
                                  to={itemPath(item)}
                                >
                                  {t(item.name)}
                                </Link>
                                {item.detail && (
                                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#7b8796] sm:text-sm">{t(item.detail)}</p>
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
                                <div className="inline-flex items-center rounded-full bg-[#f6f4ec] p-1 ring-1 ring-[#ebe7dc]">
                                  <button
                                    aria-label={t('Decrease quantity')}
                                    className="grid size-8 place-items-center rounded-full text-[#52647b] transition hover:bg-white hover:text-[#092a53] hover:shadow-sm"
                                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                    type="button"
                                  >
                                    <Icon className="size-4" path="M6 12h12" />
                                  </button>
                                  <span aria-live="polite" className="w-9 text-center text-sm font-extrabold tabular-nums text-[#092a53]">
                                    {item.quantity}
                                  </span>
                                  <button
                                    aria-label={t('Increase quantity')}
                                    className="grid size-8 place-items-center rounded-full text-[#52647b] transition hover:bg-white hover:text-[#092a53] hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:shadow-none"
                                    disabled={item.quantity >= item.availableQuantity}
                                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                    type="button"
                                  >
                                    <Icon className="size-4" path="M12 6v12M6 12h12" />
                                  </button>
                                </div>
                                {item.availableQuantity <= 3 && !isShort && (
                                  <span className="rounded-full bg-[#fff3e0] px-2.5 py-1 text-[11px] font-bold text-[#8b5e00]">
                                    {t('{count} left', { count: item.availableQuantity })}
                                  </span>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="font-display text-lg font-extrabold tabular-nums text-[#092a53] sm:text-xl">
                                  {money(item.price * item.quantity)}
                                </p>
                                {item.quantity > 1 && (
                                  <p className="text-[11px] font-semibold text-[#8b95a2]">
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

                  <div className="border-t border-[#f0ece2] bg-[#fdfcf8] px-5 py-4 sm:px-7">
                    <Link className="inline-flex items-center gap-2 text-sm font-extrabold text-[#806a00] transition hover:gap-3 hover:text-[#092a53]" to={shopPath}>
                      <Icon className="size-4 rotate-180" path={icons.arrow} />
                      {t('Continue shopping')}
                    </Link>
                  </div>
                </div>

                <p className="flex gap-3 rounded-2xl bg-[#fffbea] px-4 py-3.5 text-xs leading-5 text-[#6b5800] ring-1 ring-[#f0e2a0] sm:px-5">
                  <Icon className="mt-0.5 size-4 shrink-0" path={icons.info} />
                  {t("Prices are in FCFA. Any delivery fee is shown at checkout before you pay.")}
                </p>
              </section>

              <aside aria-labelledby="order-summary-heading" className="relative z-10 space-y-4 lg:sticky lg:top-[calc(var(--site-header-offset,0px)+2rem)] lg:transition-[top] lg:duration-300">
                <div className="overflow-hidden rounded-[28px] bg-white shadow-[0_18px_50px_rgba(18,44,80,0.09)] ring-1 ring-[#ebe7dc]">
                  <div className="bg-[#092a53] px-6 py-5 text-white sm:px-7">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#ffdc32]">{t('Your order')}</p>
                    <h2 className="mt-1 font-display text-2xl font-extrabold" id="order-summary-heading">{t('Order summary')}</h2>
                  </div>

                  <div className="space-y-5 p-6 sm:p-7">
                    <dl className="space-y-3 text-sm">
                      <div className="flex justify-between gap-3">
                        <dt className="text-[#65748a]">
                          {t('Subtotal')} <span className="text-[#9aa3af]">({cartCount})</span>
                        </dt>
                        <dd className="font-bold tabular-nums text-[#102c50]">{money(subtotal)}</dd>
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

                    <div className="flex items-end justify-between gap-3 border-t border-dashed border-[#dcd8cc] pt-5">
                      <span className="font-display text-lg font-extrabold text-[#092a53]">{t('Total')}</span>
                      <span className="font-display text-3xl font-extrabold tabular-nums leading-none text-[#092a53]">{money(total)}</span>
                    </div>
                    {discount > 0 && (
                      <p className="-mt-2 text-right text-xs font-bold text-[#3f6b22]">
                        {t('You save {amount}', { amount: money(discount) })}
                      </p>
                    )}

                    {hasUnavailableItems ? (
                      <button
                        className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-full bg-[#ecebe5] px-5 py-4 text-sm font-extrabold text-[#8b95a2]"
                        disabled
                        type="button"
                      >
                        <Icon className="size-4" path={icons.info} />
                        {t('Update your bag to checkout')}
                      </button>
                    ) : (
                      <Link
                        className="group flex w-full items-center justify-center gap-2 rounded-full bg-[#ffdc32] px-5 py-4 text-sm font-extrabold text-[#092a53] shadow-[0_12px_26px_rgba(255,220,50,0.35)] transition hover:-translate-y-0.5 hover:bg-[#ffe76c]"
                        to="/checkout"
                      >
                        <Icon className="size-4" path={icons.lock} />
                        {t('Proceed to checkout')}
                        <Icon className="size-4 transition group-hover:translate-x-0.5" path={icons.arrow} />
                      </Link>
                    )}
                  </div>
                </div>

                <ul className="grid gap-2.5 rounded-[24px] bg-white p-5 text-xs ring-1 ring-[#ebe7dc]">
                  {[
                    { icon: icons.lock, title: t('Secure checkout'), body: t('Your payment details are protected.') },
                    { icon: icons.truck, title: t('Delivery or pickup'), body: t('Choose what suits you at checkout.') },
                    { icon: icons.clock, title: t('Made fresh'), body: t('Prepared when your order is confirmed.') },
                  ].map((perk) => (
                    <li className="flex items-center gap-3" key={perk.title}>
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f4f1e8] text-[#092a53]">
                        <Icon className="size-4" path={perk.icon} />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-extrabold text-[#102c50]">{perk.title}</span>
                        <span className="block text-[#7b8796]">{perk.body}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </aside>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
