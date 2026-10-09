import { Link } from 'react-router-dom'
import { Header, Footer, ArrowIcon } from '../../../components/Layout'
import { useCart } from '../../../CartContext'
import { formatCartMoney, getCartPricing } from '../../../cartPricing'
import { useLanguage } from '../../../language/LanguageContext'

export function CartPage() {
  const { cartItems, removeFromCart, updateQuantity } = useCart()
  const { t } = useLanguage()
  const { cartCount, currency, subtotal, freeScoops, discount, total } = getCartPricing(cartItems)
  const hasUnavailableItems = cartItems.some((item) => item.availableQuantity < item.quantity)
  const hasMenuItems = cartItems.some((item) => item.itemType === 'menu')

  return (
    <div className="min-h-screen bg-[#f8f7f2] text-[#102c50]">
      <Header />

      <main className="mx-auto max-w-[1320px] px-5 py-8 sm:px-8 sm:py-12 lg:px-12">
        <div className="mb-8">
          <h1 className="font-display text-5xl font-bold tracking-tight text-[#102c50] sm:text-6xl">
            {t('Your shopping bag').split(' ')[0]} <span className="text-[#ffdc32]">{t('Your shopping bag').split(' ').slice(1).join(' ')}</span>
          </h1>
          <p className="mt-3 text-base text-[#65748a]">
            {cartItems.length === 0
              ? t('Your bag is empty. Explore our flavors and add some happiness!')
              : t('You have {count} scoop(s) across {flavors} flavor(s) in your bag.', { count: cartCount, flavors: cartItems.length })}
          </p>
          <p className="mt-3 rounded-xl border border-[#eadb8a] bg-[#fff9dc] px-4 py-3 text-sm leading-6 text-[#624f00]">
            {t(hasMenuItems
              ? 'Menu items and FCFA prices are illustrative examples, not confirmed local menu items or prices. Orders are handled by this independent website.'
              : "Items and prices in the online catalog are set in FCFA by this website's operator and are not verified Cold Stone Cameroon products, menu prices or promotions.")}
          </p>
        </div>

        {cartItems.length === 0 ? (
          <div className="rounded-[28px] border-2 border-dashed border-[#d4d0c4] bg-[#faf9f7] px-8 py-20 text-center">
            <div className="text-6xl mb-4">🍦</div>
            <h2 className="font-display text-2xl font-bold text-[#102c50] mb-2">{t('Your bag is empty')}</h2>
            <p className="text-[#65748a] mb-6">{t('Start adding your favorite flavors and get ready for a sweet treat!')}</p>
            <Link
              to={hasMenuItems ? '/menu' : '/flavors'}
              className="inline-flex items-center gap-2 rounded-full bg-[#ffdc32] px-6 py-3 text-sm font-bold text-[#102c50] transition hover:-translate-y-0.5 hover:bg-[#ffe76c]"
            >
              {t('Explore flavors')} <ArrowIcon />
            </Link>
          </div>
        ) : (
          <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-4">
              {cartItems.map((item) => (
                <article
                  key={item.id}
                  className="relative flex min-w-0 gap-3 rounded-[22px] border border-[#d9d6cc] bg-white p-3 sm:gap-6 sm:p-6"
                >
                  <Link
                    to={item.itemType === 'menu' ? '/menu' : `/flavor/${item.id}`}
                    className={`relative size-16 shrink-0 overflow-hidden rounded-[18px] ${item.color} sm:size-32`}
                  >
                    <img
                      alt={t(item.name)}
                      className="h-full w-full object-cover"
                      src={item.image}
                    />
                  </Link>

                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div>
                      <Link to={item.itemType === 'menu' ? '/menu' : `/flavor/${item.id}`} className="block truncate pr-8 font-display text-base font-bold text-[#102c50] hover:text-[#ccaa00] sm:pr-0 sm:text-lg">
                        {t(item.name)}
                      </Link>
                      <p className="mt-1 text-sm text-[#7b8796]">{t(item.detail)}</p>
                      {item.availableQuantity < item.quantity && (
                        <p className="mt-1 text-xs font-semibold text-red-700" role="status">
                          {item.availableQuantity > 0
                            ? t('Only {count} available now. Quantity reduced to match stock.', { count: item.availableQuantity })
                            : t('Currently sold out or reserved by another checkout. Remove it or try again later.')}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 sm:mt-0">
                      <div className="flex items-center gap-2 rounded-full bg-[#f4f1e7] p-1">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="grid size-8 place-items-center rounded-full text-[#65748a] transition hover:bg-white hover:text-[#102c50]"
                          aria-label={t('Add one {name} from your bag', { name: t(item.name) })}
                          type="button"
                        >
                          −
                        </button>
                        <span className="w-6 text-center font-semibold text-[#102c50]">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="grid size-8 place-items-center rounded-full text-[#65748a] transition hover:bg-white hover:text-[#102c50] disabled:cursor-not-allowed disabled:opacity-40"
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
                      <span className="text-lg font-extrabold text-[#102c50]">
                        {formatCartMoney(item.price * item.quantity, currency)}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="absolute right-2 top-2 flex size-9 shrink-0 items-center justify-center rounded-full text-[#65748a] transition hover:bg-red-50 hover:text-red-600 sm:static sm:ml-auto sm:size-10"
                    aria-label={t('Remove {name} from cart', { name: t(item.name) })}
                  >
                    <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
                    </svg>
                  </button>
                </article>
              ))}
            </div>

            <div className="sticky top-24 h-fit space-y-4 rounded-[28px] border border-[#d9d6cc] bg-white p-6 shadow-[0_8px_30px_rgba(18,44,80,0.06)]">
              <h2 className="font-display text-2xl font-bold text-[#102c50]">{t('Order summary')}</h2>

              <div className="space-y-3 border-t border-[#d9d6cc] pt-4">
                <div className="flex justify-between">
                  <span className="text-[#65748a]">{t('Subtotal')}</span>
                  <span className="font-semibold text-[#102c50]">{formatCartMoney(subtotal, currency)}</span>
                </div>

                {discount > 0 && (
                  <div className="flex justify-between rounded-lg bg-[#d8f29a] px-3 py-2">
                    <span className="text-[#163e35] font-semibold">{t('Buy 2 Get 1 Free ({count} free)', { count: freeScoops })}</span>
                    <span className="font-bold text-[#163e35]">−{formatCartMoney(discount, currency)}</span>
                  </div>
                )}

                <div className="flex justify-between border-t border-[#d9d6cc] pt-3">
                  <span className="font-display text-lg font-bold text-[#102c50]">{t('Total')}</span>
                  <span className="font-display text-2xl font-bold text-[#ffdc32]">
                    {formatCartMoney(total, currency)}
                  </span>
                </div>
              </div>

              {hasUnavailableItems ? (
                <button
                  className="block w-full cursor-not-allowed rounded-full bg-[#e9e7df] px-6 py-4 text-center text-lg font-bold text-[#65748a]"
                  disabled
                  type="button"
                >
                  {t('Update your bag to checkout')}
                </button>
              ) : (
                <Link to="/checkout" className="block w-full rounded-full bg-[#ffdc32] px-6 py-4 text-center text-lg font-bold text-[#102c50] shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-[#ffe76c]">
                  {t('Proceed to checkout')}
                </Link>
              )}

              <Link
                to={hasMenuItems ? '/menu' : '/flavors'}
                className="block w-full rounded-full border-2 border-[#65748a] px-6 py-4 text-center text-lg font-bold text-[#102c50] transition hover:bg-[#f4f1e7]"
              >
                {t('Continue shopping')}
              </Link>

              {discount > 0 && (
                <div className="rounded-lg bg-[#fff0a8] px-3 py-2 text-center text-xs font-semibold text-[#816900]">
                  ✓ {t('You qualify for the Buy 2 Get 1 Free offer!')}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
