import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Footer, Header } from '../../../components/Layout'
import { useCart } from '../../../CartContext'
import { formatCartMoney, getCartPricing } from '../../../cartPricing'
import { useLanguage } from '../../../language/LanguageContext'
import { apiRequest } from '../../../api/api'
import { useAuth } from '../../../authcontext/AuthContext'
import { getCameroonDate } from '../../../../shared/cameroonDate'

const inputClassName = 'mt-1.5 w-full rounded-xl border border-[#d9d6cc] bg-white px-4 py-3 text-sm font-normal text-[#102c50] outline-none transition focus:border-[#bd9c00] focus:ring-2 focus:ring-[#ffdc32]/40'

export function CheckoutPage() {
  const navigate = useNavigate()
  const { cartItems } = useCart()
  const { customer } = useAuth()
  const { t } = useLanguage()
  const { currency, subtotal, freeScoops, discount, total } = getCartPricing(cartItems)
  const hasMenuItems = cartItems.some((item) => item.itemType === 'menu')
  const [fulfillment, setFulfillment] = useState({ zones: [], slots: [] })
  const [fulfillmentError, setFulfillmentError] = useState('')
  const [fulfillmentType, setFulfillmentType] = useState('pickup')
  const [selectedCity, setSelectedCity] = useState(customer?.deliveryCity || '')
  const [selectedSlot, setSelectedSlot] = useState('')
  const [today] = useState(() => getCameroonDate())
  const [latestScheduledDate] = useState(() => getCameroonDate(60))
  const [scheduledDate, setScheduledDate] = useState(() => getCameroonDate(1))
  const [redeemLoyalty, setRedeemLoyalty] = useState(false)
  const [discountInput, setDiscountInput] = useState('')
  const [discountCode, setDiscountCode] = useState('')
  const [discountAmount, setDiscountAmount] = useState(0)
  const [discountMessage, setDiscountMessage] = useState('')
  const [isCheckingCode, setIsCheckingCode] = useState(false)
  const compatibleZones = fulfillment.zones.filter((zone) =>
    fulfillmentType === 'pickup' ? zone.pickupEnabled : zone.deliveryEnabled,
  )
  const selectedZone = compatibleZones.find((zone) => zone.location === selectedCity) || compatibleZones[0]
  const deliveryFee = fulfillmentType === 'delivery' ? selectedZone?.deliveryFee || 0 : 0
  const maxRedeemablePoints = Math.floor(Math.min(
    customer?.loyaltyPoints || 0,
    Math.floor(subtotal / 10),
  ) / 100) * 100
  const loyaltyDiscount = redeemLoyalty ? maxRedeemablePoints * 10 : 0

  useEffect(() => {
    let cancelled = false
    apiRequest('/fulfillment/options')
      .then((options) => {
        if (cancelled) return
        setFulfillment(options)
        if (options.zones.some((zone) => zone.deliveryEnabled)) setFulfillmentType('delivery')
        const preferredZone = options.zones.find((zone) => zone.location === (customer?.deliveryCity || ''))
          || options.zones.find((zone) => zone.pickupEnabled || zone.deliveryEnabled)
        if (preferredZone) setSelectedCity(preferredZone.location)
        if (options.slots[0]) setSelectedSlot(String(options.slots[0].id))
      })
      .catch((error) => {
        if (!cancelled) setFulfillmentError(error.message)
      })
    return () => { cancelled = true }
  }, [customer?.deliveryCity])

  useEffect(() => {
    if (!compatibleZones.some((zone) => zone.location === selectedCity) && compatibleZones[0]) {
      setSelectedCity(compatibleZones[0].location)
    }
  }, [compatibleZones, selectedCity])

  if (cartItems.length === 0 || cartItems.some((item) => item.availableQuantity < item.quantity)) {
    return <Navigate to="/cart" replace />
  }

  function handleSubmit(event) {
    event.preventDefault()
    const checkoutDetails = {
      ...Object.fromEntries(new FormData(event.currentTarget)),
      fulfillmentType,
      scheduledDate,
      slotId: selectedSlot,
      timeSlotLabel: fulfillment.slots.find((slot) => String(slot.id) === selectedSlot)?.label || '',
      deliveryFee,
      redeemLoyaltyPoints: redeemLoyalty,
      loyaltyPointsToRedeem: redeemLoyalty ? maxRedeemablePoints : 0,
      discountCode,
      discountAmount,
    }
    navigate('/payment', { state: { checkoutDetails, redeemLoyaltyPoints: redeemLoyalty } })
  }

  async function applyDiscountCode() {
    setDiscountMessage('')
    setIsCheckingCode(true)
    try {
      const result = await apiRequest('/discount-codes/validate', {
        method: 'POST',
        body: { code: discountInput, subtotal },
      })
      setDiscountCode(result.code)
      setDiscountAmount(result.discountCents)
      setRedeemLoyalty(false)
      setDiscountMessage(t('Discount code applied. The final discount is confirmed at checkout.'))
    } catch (error) {
      setDiscountCode('')
      setDiscountAmount(0)
      setDiscountMessage(error.message)
    } finally {
      setIsCheckingCode(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f7f2] text-[#102c50]">
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
          <p className="mt-3 rounded-xl border border-[#eadb8a] bg-[#fff9dc] px-4 py-3 text-sm leading-6 text-[#624f00]">
            {t(hasMenuItems
              ? 'Menu items and FCFA prices are illustrative examples, not confirmed local menu items or prices. Orders are handled by this independent website.'
              : "Items and prices in the online catalog are set in FCFA by this website's operator and are not verified Cold Stone Cameroon products, menu prices or promotions.")}
          </p>
        </div>

        <div className="grid items-start gap-8 lg:grid-cols-[1fr_380px]">
          <form className="space-y-6 rounded-[24px] border border-[#d9d6cc] bg-white p-5 shadow-[0_8px_30px_rgba(18,44,80,0.05)] sm:p-7" key={customer?.id || 'guest'} onSubmit={handleSubmit}>
            <section>
              <h2 className="font-display text-2xl font-bold">{t('Contact information')}</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-[#65748a] sm:col-span-2">
                  {t('Full name')}
                  <input autoComplete="name" className={inputClassName} defaultValue={customer?.name || ''} name="name" required />
                </label>
                <label className="block text-sm font-semibold text-[#65748a] sm:col-span-2">
                  {t('Email address')}
                  <input autoComplete="email" className={inputClassName} defaultValue={customer?.email || ''} name="email" required type="email" />
                </label>
                <label className="block text-sm font-semibold text-[#65748a] sm:col-span-2">
                  {t('Phone number')}
                  <input autoComplete="tel" className={inputClassName} defaultValue={customer?.phone || ''} name="phone" required type="tel" />
                </label>
              </div>
            </section>

            {fulfillmentError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{fulfillmentError}</p>}
            <section className="border-t border-[#d9d6cc] pt-6">
              <h2 className="font-display text-2xl font-bold">{t('Pickup or delivery')}</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-[#65748a] sm:col-span-2">
                  {t('Fulfillment type')}
                  <select className={inputClassName} onChange={(event) => setFulfillmentType(event.target.value)} value={fulfillmentType}>
                    <option disabled={!fulfillment.zones.some((zone) => zone.pickupEnabled)} value="pickup">{t('Pickup')}</option>
                    <option disabled={!fulfillment.zones.some((zone) => zone.deliveryEnabled)} value="delivery">{t('Delivery')}</option>
                  </select>
                </label>
                <label className="block text-sm font-semibold text-[#65748a] sm:col-span-2">
                  {t('Location')}
                  <select autoComplete="address-level2" className={inputClassName} name="city" onChange={(event) => setSelectedCity(event.target.value)} required value={selectedZone?.location || ''}>
                    {!compatibleZones.length && <option value="">{t('No locations enabled for this fulfillment type')}</option>}
                    {compatibleZones.map((zone) => (
                      <option key={zone.id} value={zone.location}>{t(zone.location)}</option>
                    ))}
                  </select>
                </label>
                {fulfillmentType === 'delivery' && <label className="block text-sm font-semibold text-[#65748a] sm:col-span-2">
                  {t('Your residence')}
                  <input autoComplete="address-line2" className={inputClassName} defaultValue={customer?.deliveryResidence || ''} name="residence" placeholder={t('Neighborhood, building, or residence details')} required />
                </label>}
                <label className="block text-sm font-semibold text-[#65748a]">
                  {t('Scheduled date')}
                  <input className={inputClassName} max={latestScheduledDate} min={today} onChange={(event) => setScheduledDate(event.target.value)} required type="date" value={scheduledDate} />
                </label>
                <label className="block text-sm font-semibold text-[#65748a]">
                  {t('Time slot')}
                  <select className={inputClassName} onChange={(event) => setSelectedSlot(event.target.value)} required value={selectedSlot}>
                    {fulfillment.slots.map((slot) => <option key={slot.id} value={slot.id}>{t(slot.label)}</option>)}
                  </select>
                </label>
              </div>
              <p className="mt-3 text-sm text-[#65748a]">{t('Delivery fee')}: {formatCartMoney(deliveryFee, currency)}</p>
            </section>

            {customer && (
              <p className="text-xs leading-5 text-[#65748a]">{t('Your contact and delivery details are saved to your account for future orders.')}</p>
            )}
            <section className="border-t border-[#d9d6cc] pt-5">
              <label className="block text-sm font-semibold text-[#65748a]">
                {t('Discount code')}
                <input autoComplete="off" className={inputClassName} onChange={(event) => { setDiscountInput(event.target.value); setDiscountCode(''); setDiscountAmount(0); setDiscountMessage('') }} value={discountInput} />
              </label>
              <button className="mt-3 rounded-full border border-[#d9d6cc] px-4 py-2 text-sm font-bold disabled:opacity-50" disabled={isCheckingCode || !discountInput.trim()} onClick={applyDiscountCode} type="button">
                {isCheckingCode ? t('Checking…') : t('Apply code')}
              </button>
              {discountMessage && <p className={`mt-2 text-sm ${discountCode ? 'text-[#163e35]' : 'text-red-700'}`} role="status">{discountMessage}</p>}
            </section>
            {customer && (
              <label className="flex items-start gap-3 border-t border-[#d9d6cc] pt-5 text-sm">
                <input checked={redeemLoyalty} disabled={maxRedeemablePoints < 100 || Boolean(discountCode || discount)} onChange={(event) => {
                  const redeem = event.target.checked
                  setRedeemLoyalty(redeem)
                  if (redeem) {
                    setDiscountCode('')
                    setDiscountAmount(0)
                    setDiscountInput('')
                    setDiscountMessage('')
                  }
                }} type="checkbox" />
                <span>{t('Use {points} points for {amount} off', {
                  points: maxRedeemablePoints,
                  amount: formatCartMoney(maxRedeemablePoints * 10, currency),
                })} · {t('Your balance')}: {customer.loyaltyPoints || 0}</span>
              </label>
            )}
            <div className="rounded-xl border border-[#eadb8a] bg-[#fff9dc] p-4 text-sm leading-5 text-[#624f00]">
              {t('Your delivery details are stored with the order so we can prepare and deliver it.')}
            </div>
            <button className="w-full rounded-full bg-[#ffdc32] px-6 py-4 text-lg font-bold text-[#102c50] transition hover:-translate-y-0.5 hover:bg-[#ffe76c] disabled:cursor-not-allowed disabled:opacity-50" disabled={!selectedZone || !selectedSlot || !scheduledDate || Boolean(fulfillmentError)} type="submit">
              {t('Review order')}
            </button>
          </form>

          <aside className="h-fit space-y-4 rounded-[28px] border border-[#d9d6cc] bg-white p-6 shadow-[0_8px_30px_rgba(18,44,80,0.06)]">
            <h2 className="font-display text-2xl font-bold">{t('Order summary')}</h2>
            <div className="space-y-4 border-t border-[#d9d6cc] pt-4">
              {cartItems.map((item) => (
                <div className="flex items-center gap-3" key={item.id}>
                  <img alt="" className="checkout-item-image rounded-xl bg-[#f4f1e7]" src={item.image} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{t(item.name)}</p>
                    <p className="text-xs text-[#65748a]">{t('Qty: {quantity}', { quantity: item.quantity })}</p>
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-sm font-semibold">{formatCartMoney(item.price * item.quantity, currency)}</span>
                </div>
              ))}
            </div>
            <div className="space-y-3 border-t border-[#d9d6cc] pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-[#65748a]">{t('Subtotal')}</span>
                <span className="font-semibold">{formatCartMoney(subtotal, currency)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-[#163e35]">
                  <span className="font-semibold">{t('Buy 2 Get 1 Free ({count} free)', { count: freeScoops })}</span>
                  <span className="font-bold">−{formatCartMoney(discount, currency)}</span>
                </div>
              )}
              {discountCode && discountAmount > 0 && (
                <div className="flex justify-between text-[#163e35]">
                  <span className="font-semibold">{t('Discount code {code}', { code: discountCode })}</span>
                  <span className="font-bold">−{formatCartMoney(discountAmount, currency)}</span>
                </div>
              )}
              {loyaltyDiscount > 0 && (
                <div className="flex justify-between text-[#163e35]">
                  <span className="font-semibold">{t('Loyalty reward ({points} points)', { points: maxRedeemablePoints })}</span>
                  <span className="font-bold">−{formatCartMoney(loyaltyDiscount, currency)}</span>
                </div>
              )}
              {deliveryFee > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#65748a]">{t('Delivery fee')}</span>
                  <span className="font-semibold">{formatCartMoney(deliveryFee, currency)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-[#d9d6cc] pt-3">
                <span className="font-display text-lg font-bold">{t('Total')}</span>
                <span className="font-display text-2xl font-bold text-[#bd9c00]">{formatCartMoney(Math.max(0, total - discountAmount - loyaltyDiscount + deliveryFee), currency)}</span>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  )
}
