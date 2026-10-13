import { Link } from 'react-router-dom'
import { Header, Footer, ArrowIcon } from '../../../components/Layout'
import { type CartItem } from '../../../CartContext'
import { useCart } from '../../../useCart'
import { formatCartMoney, getCartPricing } from '../../../cartPricing'
import { useLanguage } from '../../../language/useLanguage'

export function CartPage() {
  const { cartItems, removeFromCart, updateQuantity } = useCart()
  const { t } = useLanguage()
  const { cartCount, currency, subtotal, freeScoops, discount, total } = getCartPricing(cartItems)
  const hasUnavailableItems = cartItems.some((item: CartItem) => item.availableQuantity !== undefined && item.availableQuantity < item.quantity)
  const hasMenuItems = cartItems.some((item) => item.itemType === 'menu')

  return (
    <div className="min-h-screen bg-[#fbfaf5] text-[#102c50]">
      <Header />

      <main>
        <section className="bg-[#092a53] px-5 py-10 text-white sm:px-8 sm:py-14 lg:px-12">
          <div className="mx-auto max-w-[1240px]">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#ffdc32]">{t('Your shopping bag')}</p>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">{t('Your shopping bag')}</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
                  {cartItems.length === 0
                    ? t('Your bag is empty. Explore our flavors and add some happiness!')
                    : t('You have {count} scoop(s) across {flavors} flavor(s) in your bag.', { count: cartCount, flavors: cartItems.length })}
                </p>
              </div>
              {cartItems.length > 0 && (
                <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold">
                  <span aria-hidden="true" className="size-2 rounded-full bg-[#ffdc32]" />
                  {cartCount} {t('items in your bag')}
                </span>
              )}
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-[1240px] px-5 py-8 sm:px-8 sm:py-12 lg:px-12">
          <p className="mb-7 rounded-2xl border border-[#eadb8a] bg-[#fff9dc] px-4 py-3.5 text-sm leading-6 text-[#624f00] sm:px-5">
            {t(hasMenuItems
              ? 'Menu items and FCFA prices are illustrative examples, not confirmed local menu items or prices. Orders are handled by this independent website.'
              : "Items and prices in the online catalog are set in FCFA by this website's operator and are not verified Cold Stone Cameroon products, menu prices or promotions.")}
          </p>

          {cartItems.length === 0 ? (
            <section className="mx-auto max-w-3xl rounded-[28px] border border-[#e7e3d9] bg-white px-6 py-14 text-center shadow-[0_12px_40px_rgba(18,44,80,0.06)] sm:px-12 sm:py-20">
              <span aria-hidden="true" className="mx-auto grid size-20 place-items-center rounded-[26px] bg-[#fff0a8] text-4xl">🍦</span>
              <h2 className="mt-6 font-display text-2xl font-bold sm:text-3xl">{t('Your bag is empty')}</h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#65748a] sm:text-base">
                {t('Start adding your favorite flavors and get ready for a sweet treat!')}
              </p>
              <Link
                to="/flavors"
                className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#ffdc32] px-6 py-3.5 text-sm font-bold text-[#102c50] transition hover:-translate-y-0.5 hover:bg-[#ffe76c]"
              >
                {t('Explore flavors')} <ArrowIcon />
              </Link>
            </section>
          ) : (
            <div className="grid min-w-0 items-start gap-7 lg:grid-cols-[minmax(0,1fr)_360px] xl:gap-9">
              <section aria-labelledby="cart-items-heading" className="min-w-0">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="font-display text-xl font-bold sm:text-2xl" id="cart-items-heading">{t('Items in your bag')}</h2>
                  <Link className="text-sm font-semibold text-[#806a00] underline decoration-[#ffdc32] decoration-2 underline-offset-4 hover:text-[#102c50]" to={hasMenuItems ? '/menu' : '/flavors'}>
                    {t('Continue shopping')}
                  </Link>
                </div>

                <div className="space-y-4">
                  {cartItems.map((item) => (
                    <article
                      key={item.id}
                      className="relative flex min-w-0 gap-4 rounded-[22px] border border-[#e7e3d9] bg-white p-4 shadow-[0_6px_22px_rgba(18,44,80,0.04)] sm:gap-5 sm:p-5"
                    >
                      <Link
                        to={item.itemType === 'menu' ? '/menu' : `/flavor/${item.id}`}
                        aria-label={t(item.name)}
                        className={`relative size-20 shrink-0 overflow-hidden rounded-2xl ${item.color} sm:size-28`}
                      >
                        <img alt={t(item.name)} className="h-full w-full object-cover" src={item.image} />
                      </Link>

                      <div className="flex min-w-0 flex-1 flex-col justify-between gap-4">
                        <div className="min-w-0 pr-8 sm:pr-0">
                          <Link to={item.itemType === 'menu' ? '/menu' : `/flavor/${item.id}`} className="block truncate font-display text-base font-bold text-[#102c50] transition hover:text-[#806a00] sm:text-lg">
                            {t(item.name)}
                          </Link>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#7b8796] sm:text-sm">{t(item.detail)}</p>
                          {item.availableQuantity < item.quantity && (
                            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold leading-5 text-red-700" role="status">
                              {item.availableQuantity > 0
                                ? t('Only {count} available now. Quantity reduced to match stock.', { count: item.availableQuantity })
                                : t('Currently sold out or reserved by another checkout. Remove it or try again later.')}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <div className="inline-flex items-center rounded-full border border-[#e7e3d9] bg-[#fbfaf5] p-1">
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                className="grid size-8 place-items-center rounded-full text-lg text-[#52647b] transition hover:bg-white hover:text-[#102c50]"
                                aria-label={t('Add one {name} from your bag', { name: t(item.name) })}
                                type="button"
                              >
                                −
                              </button>
                              <span className="w-8 text-center text-sm font-bold text-[#102c50]">{item.quantity}</span>
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="grid size-8 place-items-center rounded-full text-lg text-[#52647b] transition hover:bg-white hover:text-[#102c50] disabled:cursor-not-allowed disabled:opacity-40"
                                aria-label={t('Add one {name} to your bag', { name: t(item.name) })}
                                disabled={item.quantity >= item.availableQuantity}
                                type="button"
                              >
                                +
                              </button>
                            </div>
                            {item.availableQuantity <= 3 && (
                              <span className="text-xs font-semibold text-[#8b5e00]">
                                {item.availableQuantity} {t('available')}
                              </span>
                            )}
                          </div>
                          <span className="font-display text-base font-bold text-[#102c50] sm:text-lg">
                            {formatCartMoney(item.price * item.quantity, currency)}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="absolute right-3 top-3 grid size-8 place-items-center rounded-full text-[#8792a0] transition hover:bg-red-50 hover:text-red-600 sm:right-4 sm:top-4"
                        aria-label={t('Remove {name} from cart', { name: t(item.name) })}
                        type="button"
                      >
                        <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                        </svg>
                      </button>
                    </article>
                  ))}
                </div>
              </section>

              <aside aria-labelledby="order-summary-heading" className="h-fit space-y-5 rounded-[24px] border border-[#e7e3d9] bg-white p-5 shadow-[0_12px_40px_rgba(18,44,80,0.07)] sm:p-7 lg:sticky lg:top-8">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#a48700]">{t('Your order')}</p>
                  <h2 className="mt-1 font-display text-2xl font-bold text-[#102c50]" id="order-summary-heading">{t('Order summary')}</h2>
                </div>

                <div className="space-y-3 border-y border-dashed border-[#d9d6cc] py-5">
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="text-[#65748a]">{t('Subtotal')}</span>
                    <span className="font-semibold text-[#102c50]">{formatCartMoney(subtotal, currency)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between gap-3 rounded-xl bg-[#eaf5d8] px-3 py-2.5 text-sm">
                      <span className="font-semibold text-[#274d20]">{t('Buy 2 Get 1 Free ({count} free)', { count: freeScoops })}</span>
                      <span className="font-bold text-[#274d20]">−{formatCartMoney(discount, currency)}</span>
                    </div>
                  )}
                  <div className="flex items-end justify-between gap-3 pt-1">
                    <span className="font-display text-lg font-bold text-[#102c50]">{t('Total')}</span>
                    <span className="font-display text-2xl font-extrabold text-[#102c50]">{formatCartMoney(total, currency)}</span>
                  </div>
                </div>

                {hasUnavailableItems ? (
                  <button
                    className="block w-full cursor-not-allowed rounded-full bg-[#e9e7df] px-5 py-3.5 text-center text-sm font-bold text-[#65748a]"
                    disabled
                    type="button"
                  >
                    {t('Update your bag to checkout')}
                  </button>
                ) : (
                  <Link to="/checkout" className="block w-full rounded-full bg-[#ffdc32] px-5 py-3.5 text-center text-sm font-bold text-[#102c50] transition hover:-translate-y-0.5 hover:bg-[#ffe76c]">
                    {t('Proceed to checkout')}
                  </Link>
                )}

                <Link
                  to={hasMenuItems ? '/menu' : '/flavors'}
                  className="block w-full rounded-full border border-[#d9d6cc] px-5 py-3 text-center text-sm font-bold text-[#52647b] transition hover:border-[#092a53] hover:bg-[#fbfaf5] hover:text-[#102c50]"
                >
                  {t('Continue shopping')}
                </Link>

                {discount > 0 && (
                  <p className="rounded-xl bg-[#fff7d2] px-3 py-2.5 text-center text-xs font-semibold leading-5 text-[#755f00]">
                    ✓ {t('You qualify for the Buy 2 Get 1 Free offer!')}
                  </p>
                )}
              </aside>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
