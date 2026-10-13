import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Footer, Header } from '../../../components/Layout'
import { useCart } from '../../../useCart'
import { formatCartMoney, getCartPricing } from '../../../cartPricing'
import { useLanguage } from '../../../language/useLanguage'
import { apiRequest } from '../../../api/api'
import { useAuth } from '../../../authcontext/useAuth'
import { getCameroonDate } from '../../../../shared/cameroonDate'

const inputClassName = 'mt-2 w-full rounded-xl border border-[#dce2ea] bg-[#fbfcfe] px-4 py-3.5 text-sm font-normal text-[#102c50] outline-none transition placeholder:text-[#9aa5b3] focus:border-[#bd9c00] focus:bg-white focus:ring-4 focus:ring-[#ffdc32]/20'

export function CheckoutPage() {
  const navigate = useNavigate()
  const { cartItems } = useCart()
  const { customer, isLoading } = useAuth()
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
    if (isLoading) return
    if (!customer) {
      navigate('/signup', {
        state: {
          from: '/checkout',
          notice: t('Please sign in to continue placing your order.'),
        },
      })
      return
    }

    const checkoutDetails = {
      ...Object.fromEntries(new FormData(event.currentTarget)),
      storeId: selectedZone?.storeId,
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

      <main className="mx-auto max-w-[1240px] px-4 py-7 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
        <Link to="/cart" className="inline-flex items-center gap-2 rounded-full border border-[#dce2ea] bg-white px-4 py-2.5 text-sm font-bold text-[#52647b] shadow-sm transition hover:border-[#092a53] hover:text-[#092a53] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00]">
          <span aria-hidden="true">←</span> {t('Back to bag')}
        </Link>
        <div className="mb-7 mt-6 rounded-[28px] bg-[#092a53] px-6 py-7 text-white shadow-[0_18px_45px_rgba(9,42,83,0.14)] sm:px-9 sm:py-9">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="mb-2 inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#ffdc32]">
                <span aria-hidden="true" className="text-base">✦</span>{t('Almost there')}
              </p>
              <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">{t('Checkout')}</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-white/70">{t('Add your contact and delivery details to review your order.')}</p>
            </div>
            <div aria-label={t('Checkout progress')} className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.1em] text-white/65 sm:gap-3">
              <span className="flex items-center gap-2 text-[#ffdc32]"><span className="grid size-7 place-items-center rounded-full bg-[#ffdc32] text-xs text-[#092a53]">1</span><span className="hidden sm:inline">{t('Your details')}</span></span>
              <span aria-hidden="true" className="h-px w-5 bg-white/25 sm:w-8" />
              <span className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-full border border-white/30 text-xs">2</span><span className="hidden sm:inline">{t('Review order')}</span></span>
            </div>
          </div>
        </div>
        <p className="mb-7 flex items-start gap-3 rounded-2xl border border-[#eadb8a] bg-[#fff9dc] px-4 py-4 text-sm leading-6 text-[#624f00] sm:px-5">
            <span aria-hidden="true" className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-[#ffdc32] text-xs font-extrabold">i</span>
            {t(hasMenuItems
              ? 'Menu items and FCFA prices are illustrative examples, not confirmed local menu items or prices. Orders are handled by this independent website.'
              : "Items and prices in the online catalog are set in FCFA by this website's operator and are not verified Cold Stone Cameroon products, menu prices or promotions.")}
        </p>
        {!customer && !isLoading && (
          <p className="mb-7 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#eadb8a] bg-[#fff9dc] px-4 py-4 text-sm leading-6 text-[#624f00] sm:px-5">
            <span>{t('Please sign in to continue placing your order.')}</span>
            <span className="flex items-center gap-3 font-bold">
              <Link className="underline" state={{ from: '/checkout', notice: t('Please sign in to continue placing your order.') }} to="/login">{t('Log in')}</Link>
              <Link className="rounded-full bg-[#ffdc32] px-4 py-2 text-[#102c50] no-underline" state={{ from: '/checkout', notice: t('Please sign in to continue placing your order.') }} to="/signup">{t('Sign up')}</Link>
            </span>
          </p>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_370px] lg:gap-8">
          <form className="space-y-0 overflow-hidden rounded-[28px] border border-[#e4e8ee] bg-white shadow-[0_12px_36px_rgba(18,44,80,0.07)]" key={customer?.id || 'guest'} onSubmit={handleSubmit}>
            <section className="p-5 sm:p-8">
              <div className="mb-5 flex items-center gap-3">
                <span aria-hidden="true" className="grid size-10 place-items-center rounded-xl bg-[#fff3b8] font-display text-lg font-bold text-[#806a00]">01</span>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#8a7500]">{t('Step 1')}</p>
                  <h2 className="font-display text-xl font-extrabold text-[#092a53] sm:text-2xl">{t('Contact information')}</h2>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-bold text-[#52647b]">
                  {t('Full name')}
                  <input autoComplete="name" className={inputClassName} defaultValue={customer?.name || ''} name="name" required />
                </label>
                <label className="block text-sm font-bold text-[#52647b]">
                  {t('Email address')}
                  <input autoComplete="email" className={inputClassName} defaultValue={customer?.email || ''} name="email" required type="email" />
                </label>
                <label className="block text-sm font-bold text-[#52647b]">
                  {t('Phone number')}
                  <input autoComplete="tel" className={inputClassName} defaultValue={customer?.phone || ''} name="phone" required type="tel" />
                </label>
              </div>
            </section>

            {fulfillmentError && <p className="mx-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:mx-8" role="alert">{fulfillmentError}</p>}
            <section className="border-t border-[#edf0f4] p-5 sm:p-8">
              <div className="mb-5 flex items-center gap-3">
                <span aria-hidden="true" className="grid size-10 place-items-center rounded-xl bg-[#eaf2fb] font-display text-lg font-bold text-[#092a53]">02</span>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#65748a]">{t('Step 2')}</p>
                  <h2 className="font-display text-xl font-extrabold text-[#092a53] sm:text-2xl">{t('Pickup or delivery')}</h2>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-bold text-[#52647b]">
                  {t('Fulfillment type')}
                  <select className={inputClassName} onChange={(event) => setFulfillmentType(event.target.value)} value={fulfillmentType}>
                    <option disabled={!fulfillment.zones.some((zone) => zone.pickupEnabled)} value="pickup">{t('Pickup')}</option>
                    <option disabled={!fulfillment.zones.some((zone) => zone.deliveryEnabled)} value="delivery">{t('Delivery')}</option>
                  </select>
                </label>
                <label className="block text-sm font-bold text-[#52647b]">
                  {t('Store branch')}
                  <select autoComplete="address-level2" className={inputClassName} name="city" onChange={(event) => setSelectedCity(event.target.value)} required value={selectedZone?.location || ''}>
                    {!compatibleZones.length && <option value="">{t('No locations enabled for this fulfillment type')}</option>}
                    {compatibleZones.map((zone) => (
                      <option key={zone.id} value={zone.location}>{t(zone.storeName)} · {t(zone.storeTown)}</option>
                    ))}
                  </select>
                </label>
                {selectedZone && (
                  <div className="rounded-2xl border border-[#dce5ef] bg-[#f7f9fc] p-4 sm:col-span-2 sm:flex sm:items-center sm:justify-between sm:gap-5">
                    <div className="flex items-start gap-3">
                      <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e6eef8] text-lg text-[#092a53]">⌖</span>
                      <div>
                        <p className="text-sm font-extrabold text-[#092a53]">{t(selectedZone.storeName)}</p>
                        <p className="mt-1 text-xs leading-5 text-[#65748a]">{t(selectedZone.storeAddress)} · {t(selectedZone.storeTown)}</p>
                        {selectedZone.storePhone && <p className="mt-1 text-xs font-semibold text-[#52647b]">{selectedZone.storePhone}</p>}
                      </div>
                    </div>
                    {selectedZone.storeMapQuery && (
                      <a
                        className="mt-3 inline-flex shrink-0 text-xs font-bold text-[#092a53] underline decoration-[#bd9c00] underline-offset-4 sm:mt-0"
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedZone.storeMapQuery)}`}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {t('View map')}
                      </a>
                    )}
                  </div>
                )}
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
              <p className="mt-4 inline-flex rounded-full bg-[#f3f6f9] px-3.5 py-2 text-xs font-bold text-[#52647b]">{t('Delivery fee')}: {formatCartMoney(deliveryFee, currency)}</p>
            </section>

            {customer && (
              <p className="text-xs leading-5 text-[#65748a]">{t('Your contact and delivery details are saved to your account for future orders.')}</p>
            )}
            <section className="border-t border-[#edf0f4] p-5 sm:px-8 sm:py-6">
              <label className="block text-sm font-bold text-[#52647b]">
                {t('Discount code')}
                <input autoComplete="off" className={inputClassName} onChange={(event) => { setDiscountInput(event.target.value); setDiscountCode(''); setDiscountAmount(0); setDiscountMessage('') }} value={discountInput} />
              </label>
              <button className="mt-3 rounded-full border border-[#dce2ea] bg-white px-4 py-2.5 text-sm font-bold text-[#092a53] transition hover:border-[#092a53] disabled:cursor-not-allowed disabled:opacity-50" disabled={isCheckingCode || !discountInput.trim()} onClick={applyDiscountCode} type="button">
                {isCheckingCode ? t('Checking…') : t('Apply code')}
              </button>
              {discountMessage && <p className={`mt-2 text-sm ${discountCode ? 'text-[#163e35]' : 'text-red-700'}`} role="status">{discountMessage}</p>}
            </section>
            {customer && (
              <label className="mx-5 flex items-start gap-3 border-t border-[#edf0f4] py-5 text-sm sm:mx-8">
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
            <div className="mx-5 mb-5 flex items-start gap-3 rounded-xl border border-[#eadb8a] bg-[#fff9dc] p-4 text-sm leading-5 text-[#624f00] sm:mx-8">
              <span aria-hidden="true" className="mt-0.5">ⓘ</span>
              {t('Your delivery details are stored with the order so we can prepare and deliver it.')}
            </div>
            <div className="border-t border-[#edf0f4] bg-[#fbfcfe] p-5 sm:px-8 sm:py-6">
              <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ffdc32] px-6 py-4 text-base font-extrabold text-[#102c50] shadow-[0_8px_18px_rgba(189,156,0,0.16)] transition hover:-translate-y-0.5 hover:bg-[#ffe76c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" disabled={isLoading || !selectedZone || !selectedSlot || !scheduledDate || Boolean(fulfillmentError)} type="submit">
                {t('Review order')} <span aria-hidden="true">→</span>
              </button>
              <p className="mt-3 text-center text-[11px] font-medium text-[#7b8796]">{t('You can review everything before confirming your order.')}</p>
            </div>
          </form>

          <aside className="h-fit overflow-hidden rounded-[28px] border border-[#e4e8ee] bg-white shadow-[0_12px_36px_rgba(18,44,80,0.07)] lg:sticky lg:top-6">
            <div className="bg-[#092a53] px-5 py-5 text-white sm:px-6">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#ffdc32]">{t('Almost there')}</p>
              <h2 className="mt-1 font-display text-2xl font-extrabold">{t('Order summary')}</h2>
            </div>
            <div className="p-5 sm:p-6">
              <div className="space-y-4">
              {cartItems.map((item) => (
                <div className="flex items-center gap-3" key={item.id}>
                  <img alt="" className="checkout-item-image rounded-xl border border-[#edf0f4] bg-[#f4f1e7]" src={item.image} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{t(item.name)}</p>
                    <p className="text-xs text-[#65748a]">{t('Qty: {quantity}', { quantity: item.quantity })}</p>
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-sm font-semibold">{formatCartMoney(item.price * item.quantity, currency)}</span>
                </div>
              ))}
              </div>
              <div className="mt-5 space-y-3 border-t border-dashed border-[#dce2ea] pt-4 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-[#65748a]">{t('Subtotal')}</span>
                <span className="font-semibold">{formatCartMoney(subtotal, currency)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between gap-4 text-[#163e35]">
                  <span className="min-w-0 font-semibold">{t('Buy 2 Get 1 Free ({count} free)', { count: freeScoops })}</span>
                  <span className="shrink-0 font-bold">−{formatCartMoney(discount, currency)}</span>
                </div>
              )}
              {discountCode && discountAmount > 0 && (
                <div className="flex justify-between gap-4 text-[#163e35]">
                  <span className="min-w-0 font-semibold">{t('Discount code {code}', { code: discountCode })}</span>
                  <span className="shrink-0 font-bold">−{formatCartMoney(discountAmount, currency)}</span>
                </div>
              )}
              {loyaltyDiscount > 0 && (
                <div className="flex justify-between gap-4 text-[#163e35]">
                  <span className="min-w-0 font-semibold">{t('Loyalty reward ({points} points)', { points: maxRedeemablePoints })}</span>
                  <span className="shrink-0 font-bold">−{formatCartMoney(loyaltyDiscount, currency)}</span>
                </div>
              )}
              {deliveryFee > 0 && (
                <div className="flex justify-between gap-4">
                  <span className="text-[#65748a]">{t('Delivery fee')}</span>
                  <span className="shrink-0 font-semibold">{formatCartMoney(deliveryFee, currency)}</span>
                </div>
              )}
              <div className="flex items-baseline justify-between gap-3 border-t border-[#dce2ea] pt-4">
                <span className="font-display text-lg font-bold">{t('Total')}</span>
                <span className="shrink-0 font-display text-xl font-extrabold text-[#092a53] sm:text-2xl">{formatCartMoney(Math.max(0, total - discountAmount - loyaltyDiscount + deliveryFee), currency)}</span>
              </div>
              </div>
            </div>
            <p className="border-t border-[#edf0f4] bg-[#fbfcfe] px-5 py-3 text-center text-[10px] font-semibold text-[#7b8796] sm:px-6">{t('Your total includes the delivery fee shown above.')}</p>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  )
}
