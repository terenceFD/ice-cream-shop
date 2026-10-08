import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Footer, Header } from '../../../components/Layout'
import { useCart } from '../../../CartContext'
import { getCartPricing } from '../../../cartPricing'
import { useLanguage } from '../../../LanguageContext'

const inputClassName = 'mt-1.5 w-full rounded-xl border border-[#d9d6cc] bg-white px-4 py-3 text-sm font-normal text-[#102c50] outline-none transition focus:border-[#bd9c00] focus:ring-2 focus:ring-[#ffdc32]/40'

export function CheckoutPage() {
  const navigate = useNavigate()
  const { cartItems } = useCart()
  const { t } = useLanguage()
  const { subtotal, freeScoops, discount, total } = getCartPricing(cartItems)

  if (cartItems.length === 0 || cartItems.some((item) => item.availableQuantity < item.quantity)) {
    return <Navigate to="/cart" replace />
  }

  function handleSubmit(event) {
    event.preventDefault()
    const checkoutDetails = Object.fromEntries(new FormData(event.currentTarget))
    navigate('/payment', { state: { checkoutDetails } })
  }

  return (
    <div className="min-h-screen bg-[#fffefa] text-[#102c50]">
      <Header />

      <main className="mx-auto max-w-[1160px] px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
        <Link to="/cart" className="text-sm font-semibold text-[#65748a] transition hover:text-[#102c50]">
          ← {t('Back to bag')}
        </Link>
        <div className="mb-8 mt-6">
          <p className="mb-2 inline-block rounded-full bg-[#ffeb9c] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em]">
            {t('Almost there')}
          </p>
          <h1 className="font-display text-5xl font-bold tracking-tight sm:text-6xl">{t('Checkout')}</h1>
          <p className="mt-2 text-sm text-[#65748a]">{t('Add your contact and delivery details to review your order.')}</p>
        </div>

        <div className="grid items-start gap-8 lg:grid-cols-[1fr_380px]">
          <form className="space-y-6 rounded-[24px] border border-[#ece8de] bg-white p-5 shadow-[0_8px_30px_rgba(18,44,80,0.05)] sm:p-7" onSubmit={handleSubmit}>
            <section>
              <h2 className="font-display text-2xl font-bold">{t('Contact information')}</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-[#29415f]">
                  {t('Full name')}
                  <input autoComplete="name" className={inputClassName} name="name" required />
                </label>
                <label className="block text-sm font-semibold text-[#29415f]">
                  {t('Email address')}
                  <input autoComplete="email" className={inputClassName} name="email" required type="email" />
                </label>
                <label className="block text-sm font-semibold text-[#29415f] sm:col-span-2">
                  {t('Phone number')}
                  <input autoComplete="tel" className={inputClassName} name="phone" required type="tel" />
                </label>
              </div>
            </section>

            <section className="border-t border-[#ece8de] pt-6">
              <h2 className="font-display text-2xl font-bold">{t('Delivery address')}</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-[#29415f] sm:col-span-2">
                  {t('Street address')}
                  <input autoComplete="street-address" className={inputClassName} name="address" required />
                </label>
                <label className="block text-sm font-semibold text-[#29415f]">
                  {t('City')}
                  <input autoComplete="address-level2" className={inputClassName} name="city" required />
                </label>
                <label className="block text-sm font-semibold text-[#29415f]">
                  {t('Postal code')}
                  <input autoComplete="postal-code" className={inputClassName} name="postalCode" required />
                </label>
              </div>
            </section>

            <div className="rounded-xl border border-[#eadb8a] bg-[#fff9dc] p-4 text-sm leading-5 text-[#624f00]">
              {t('Your delivery details are stored with the order so we can prepare and deliver it.')}
            </div>
            <button className="w-full rounded-full bg-[#ffdc32] px-6 py-4 text-lg font-bold text-[#102c50] transition hover:-translate-y-0.5 hover:bg-[#ffe76c]" type="submit">
              {t('Review order')}
            </button>
          </form>

          <aside className="h-fit space-y-4 rounded-[28px] border border-[#ece8de] bg-white p-6 shadow-[0_8px_30px_rgba(18,44,80,0.06)]">
            <h2 className="font-display text-2xl font-bold">{t('Order summary')}</h2>
            <div className="space-y-4 border-t border-[#ece8de] pt-4">
              {cartItems.map((item) => (
                <div className="flex items-center gap-3" key={item.id}>
                  <img alt="" className="checkout-item-image rounded-xl bg-[#f4f1e7]" src={item.image} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{t(item.name)}</p>
                    <p className="text-xs text-[#65748a]">{t('Qty: {quantity}', { quantity: item.quantity })}</p>
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-sm font-semibold">${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="space-y-3 border-t border-[#ece8de] pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-[#65748a]">{t('Subtotal')}</span>
                <span className="font-semibold">${subtotal.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-[#163e35]">
                  <span className="font-semibold">{t('Buy 2 Get 1 Free ({count} free)', { count: freeScoops })}</span>
                  <span className="font-bold">-${discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-[#ece8de] pt-3">
                <span className="font-display text-lg font-bold">{t('Total')}</span>
                <span className="font-display text-2xl font-bold text-[#bd9c00]">${total.toFixed(2)}</span>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  )
}
