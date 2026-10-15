import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Footer, Header } from '../../../components/Layout'
import { useCart } from '../../../useCart'
import { formatCartMoney, getCartPricing } from '../../../cartPricing'
import { useLanguage } from '../../../language/useLanguage'
import { apiRequest } from '../../../api/api'
import { useAuth } from '../../../authcontext/useAuth'
import { getCameroonDate } from '../../../../shared/cameroonDate'

const inputClassName = 'mt-2 w-full rounded-2xl border border-[#e3dfd3] bg-[#fbfaf5] px-4 py-3.5 text-sm font-semibold text-[#102c50] transition placeholder:font-medium placeholder:text-[#9aa3af] hover:border-[#cfcabb] focus:border-[#bd9c00] focus:bg-white focus:ring-4 focus:ring-[#ffdc32]/25 outline-none!'
const labelClassName = 'block text-xs font-extrabold text-[#52647b]'

const icons = {
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
  store: 'M4 10h16l-1.5-5h-13L4 10Zm0 0v10h16V10M9 20v-5h6v5M4 10a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0',
  truck: 'M3 7h11v9H3V7Zm11 3h4l3 3v3h-7v-6ZM7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  calendar: 'M5 6h14v14H5V6Zm0 4h14M9 4v4m6-4v4',
  tag: 'M3 12V4h8l10 10-8 8L3 12Zm5-4.5v.01',
  star: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7L12 3Z',
  pin: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  lock: 'M6 11h12v9H6v-9Zm2 0V8a4 4 0 0 1 8 0v3',
  info: 'M12 11v5m0-8.5v.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  chevron: 'm6 9 6 6 6-6',
}

function Icon({ path, className = 'size-[18px]' }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d={path} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  )
}

function StepCard({ number, icon, title, description, children }) {
  return (
    <section className="rounded-[28px] bg-white p-5 shadow-[0_10px_30px_rgba(18,44,80,0.05)] ring-1 ring-[#ebe7dc] sm:p-8">
      <header className="mb-6 flex items-start gap-4">
        <span className="relative grid size-12 shrink-0 place-items-center rounded-2xl bg-[#092a53] text-[#ffdc32]">
          <Icon path={icon} />
          <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-[#ffdc32] text-[10px] font-extrabold text-[#092a53] ring-2 ring-white">
            {number}
          </span>
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-xl font-extrabold text-[#092a53] sm:text-2xl">{title}</h2>
          {description && <p className="mt-1 text-sm leading-6 text-[#65748a]">{description}</p>}
        </div>
      </header>
      {children}
    </section>
  )
}

function SelectField({ label, children, ...props }) {
  return (
    <label className={labelClassName}>
      {label}
      <span className="relative block">
        <select className={`${inputClassName} appearance-none pr-11`} {...props}>
          {children}
        </select>
        <Icon className="pointer-events-none absolute right-4 top-1/2 mt-1 size-4 -translate-y-1/2 text-[#8b95a2]" path={icons.chevron} />
      </span>
    </label>
  )
}

export function CheckoutPage() {
  const navigate = useNavigate()
  const { cartItems } = useCart()
  const { customer, isLoading } = useAuth()
  const { t, language } = useLanguage()
  const { cartCount, currency, subtotal, freeScoops, discount, total } = getCartPricing(cartItems)
  const money = (amount) => formatCartMoney(amount, currency, language)
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
  const grandTotal = Math.max(0, total - discountAmount - loyaltyDiscount + deliveryFee)
  const totalSavings = discount + (discountCode ? discountAmount : 0) + loyaltyDiscount
  const pickupAvailable = fulfillment.zones.some((zone) => zone.pickupEnabled)
  const deliveryAvailable = fulfillment.zones.some((zone) => zone.deliveryEnabled)
  const loyaltyBlocked = maxRedeemablePoints < 100 || Boolean(discountCode || discount)
  const canSubmit = !isLoading && selectedZone && selectedSlot && scheduledDate && !fulfillmentError

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

  const authState = { from: '/checkout', notice: t('Please sign in to continue placing your order.') }
  const steps = [t('Shopping bag'), t('Checkout'), t('Payment')]
  const fulfillmentOptions = [
    { value: 'delivery', icon: icons.truck, label: t('Delivery'), hint: t('Brought to your door'), available: deliveryAvailable },
    { value: 'pickup', icon: icons.store, label: t('Pickup'), hint: t('Collect it in store'), available: pickupAvailable },
  ]

  return (
    <div className="min-h-screen bg-[#f8f7f2] text-[#102c50]">
      <Header />

      <main>
        <section className="relative isolate overflow-hidden bg-[#092a53] px-5 pb-12 pt-9 text-white sm:px-8 sm:pb-16 sm:pt-12 lg:px-12">
          <div aria-hidden="true" className="absolute -right-32 -top-44 -z-10 size-[30rem] rounded-full border-[64px] border-white/[0.04]" />
          <div aria-hidden="true" className="absolute -bottom-40 left-[15%] -z-10 size-80 rounded-full bg-[#ffdc32]/[0.08] blur-3xl" />
          <div className="mx-auto max-w-[1240px]">
            <nav aria-label={t('Breadcrumb')} className="text-xs font-semibold text-white/55">
              <Link className="transition hover:text-[#ffdc32]" to="/">{t('Home')}</Link>
              <span aria-hidden="true" className="mx-2">/</span>
              <Link className="transition hover:text-[#ffdc32]" to="/cart">{t('Shopping bag')}</Link>
              <span aria-hidden="true" className="mx-2">/</span>
              <span aria-current="page" className="text-white">{t('Checkout')}</span>
            </nav>

            <div className="mt-6 flex flex-wrap items-end justify-between gap-8">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#ffdc32] before:h-px before:w-6 before:bg-[#ffdc32]/70">
                  {t('Almost there')}
                </p>
                <h1 className="mt-3 font-display text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-[3.4rem]">{t('Checkout')}</h1>
                <p className="mt-3 max-w-xl text-sm leading-6 text-white/65 sm:text-base">
                  {t('Add your contact and delivery details to review your order.')}
                </p>
              </div>

              <ol aria-label={t('Checkout progress')} className="flex items-center gap-2 sm:gap-3">
                {steps.map((step, index) => {
                  const isDone = index === 0
                  const isCurrent = index === 1
                  return (
                    <li className="flex items-center gap-2 sm:gap-3" key={step}>
                      <span
                        aria-current={isCurrent ? 'step' : undefined}
                        className={`flex items-center gap-2 whitespace-nowrap rounded-full py-1.5 pl-1.5 pr-3.5 text-xs font-extrabold ${
                          isCurrent
                            ? 'bg-[#ffdc32] text-[#092a53]'
                            : isDone
                              ? 'bg-white/10 text-white ring-1 ring-white/15'
                              : 'bg-white/[0.07] text-white/55 ring-1 ring-white/10'
                        }`}
                      >
                        <span
                          className={`grid size-6 place-items-center rounded-full text-[11px] ${
                            isCurrent ? 'bg-[#092a53] text-[#ffdc32]' : isDone ? 'bg-[#6c9c45] text-white' : 'bg-white/10'
                          }`}
                        >
                          {isDone ? <Icon className="size-3.5" path={icons.check} /> : index + 1}
                        </span>
                        {step}
                      </span>
                      {index < steps.length - 1 && (
                        <span aria-hidden="true" className={`hidden h-px w-6 sm:block ${isDone ? 'bg-[#ffdc32]/60' : 'bg-white/20'}`} />
                      )}
                    </li>
                  )
                })}
              </ol>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-[1240px] px-5 py-8 sm:px-8 sm:py-12 lg:px-12">
          {!customer && !isLoading && (
            <div className="mb-6 flex flex-col gap-4 rounded-[24px] bg-white p-5 shadow-[0_10px_30px_rgba(18,44,80,0.05)] ring-1 ring-[#efe0a0] sm:flex-row sm:items-center sm:p-6">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#fff6cc] text-[#8a7000]">
                <Icon className="size-6" path={icons.user} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold text-[#092a53]">{t('Please sign in to continue placing your order.')}</p>
                <p className="mt-0.5 text-xs leading-5 text-[#65748a]">{t('Your bag is saved — you will come right back here.')}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link className="rounded-full px-4 py-2.5 text-sm font-extrabold text-[#092a53] ring-1 ring-[#dcd8cc] transition hover:ring-[#092a53]" state={authState} to="/login">
                  {t('Log in')}
                </Link>
                <Link className="rounded-full bg-[#092a53] px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-[#163e6b]" state={authState} to="/signup">
                  {t('Sign up')}
                </Link>
              </div>
            </div>
          )}

          <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_390px] xl:gap-10">
            <form className="min-w-0 space-y-5" id="checkout-form" key={customer?.id || 'guest'} onSubmit={handleSubmit}>
              <StepCard
                description={t('We use this to send order updates.')}
                icon={icons.user}
                number={1}
                title={t('Contact information')}
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className={`${labelClassName} sm:col-span-2`}>
                    {t('Full name')}
                    <input autoComplete="name" className={inputClassName} defaultValue={customer?.name || ''} name="name" required />
                  </label>
                  <label className={labelClassName}>
                    {t('Email address')}
                    <input autoComplete="email" className={inputClassName} defaultValue={customer?.email || ''} name="email" required type="email" />
                  </label>
                  <label className={labelClassName}>
                    {t('Phone number')}
                    <input autoComplete="tel" className={inputClassName} defaultValue={customer?.phone || ''} inputMode="tel" name="phone" required type="tel" />
                  </label>
                </div>
              </StepCard>

              <StepCard
                description={t('Choose how you would like to receive your order.')}
                icon={icons.truck}
                number={2}
                title={t('Pickup or delivery')}
              >
                {fulfillmentError && (
                  <p className="mb-5 flex items-start gap-2 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700 ring-1 ring-red-100" role="alert">
                    <Icon className="mt-0.5 size-4 shrink-0" path={icons.info} />
                    {fulfillmentError}
                  </p>
                )}

                <fieldset>
                  <legend className="sr-only">{t('Fulfillment type')}</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {fulfillmentOptions.map((option) => {
                      const isSelected = fulfillmentType === option.value
                      return (
                        <label
                          className={`relative flex cursor-pointer items-center gap-4 rounded-[20px] p-4 ring-1 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#bd9c00] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-45 ${
                            isSelected
                              ? 'bg-[#fffbea] ring-2 ring-[#e8c400] shadow-[0_8px_20px_rgba(189,156,0,0.12)]'
                              : 'bg-white ring-[#e3dfd3] hover:ring-[#cfcabb]'
                          }`}
                          key={option.value}
                        >
                          <input
                            checked={isSelected}
                            className="sr-only"
                            disabled={!option.available}
                            name="fulfillmentType"
                            onChange={() => setFulfillmentType(option.value)}
                            type="radio"
                            value={option.value}
                          />
                          <span className={`grid size-11 shrink-0 place-items-center rounded-2xl transition ${isSelected ? 'bg-[#ffdc32] text-[#092a53]' : 'bg-[#f4f1e8] text-[#52647b]'}`}>
                            <Icon path={option.icon} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-extrabold text-[#092a53]">{option.label}</span>
                            <span className="block text-xs text-[#65748a]">{option.available ? option.hint : t('Not available right now')}</span>
                          </span>
                          <span className={`grid size-5 shrink-0 place-items-center rounded-full ring-2 transition ${isSelected ? 'bg-[#092a53] ring-[#092a53]' : 'ring-[#d4cfc0]'}`}>
                            {isSelected && <Icon className="size-3 text-white" path={icons.check} />}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </fieldset>

                <div className="mt-5 grid gap-5">
                  <SelectField
                    autoComplete="address-level2"
                    label={t('Store branch')}
                    name="city"
                    onChange={(event) => setSelectedCity(event.target.value)}
                    required
                    value={selectedZone?.location || ''}
                  >
                    {!compatibleZones.length && <option value="">{t('No locations enabled for this fulfillment type')}</option>}
                    {compatibleZones.map((zone) => (
                      <option key={zone.id} value={zone.location}>{t(zone.storeName)} · {t(zone.storeTown)}</option>
                    ))}
                  </SelectField>

                  {selectedZone && (
                    <div className="flex flex-col gap-4 rounded-[20px] bg-[#f3f6fa] p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[#092a53] shadow-sm">
                          <Icon path={icons.pin} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-extrabold text-[#092a53]">{t(selectedZone.storeName)}</p>
                          <p className="mt-0.5 text-xs leading-5 text-[#65748a]">{t(selectedZone.storeAddress)} · {t(selectedZone.storeTown)}</p>
                          {selectedZone.storePhone && <p className="mt-0.5 text-xs font-semibold text-[#52647b]">{selectedZone.storePhone}</p>}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        {fulfillmentType === 'delivery' && (
                          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-[#092a53] shadow-sm">
                            {deliveryFee > 0 ? `${t('Delivery fee')}: ${money(deliveryFee)}` : t('Free delivery')}
                          </span>
                        )}
                        {selectedZone.storeMapQuery && (
                          <a
                            className="inline-flex items-center gap-1 text-xs font-extrabold text-[#806a00] transition hover:text-[#092a53]"
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedZone.storeMapQuery)}`}
                            rel="noreferrer"
                            target="_blank"
                          >
                            {t('View map')} <Icon className="size-3.5 -rotate-45" path={icons.arrow} />
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {fulfillmentType === 'delivery' && (
                    <label className={labelClassName}>
                      {t('Your residence')}
                      <input autoComplete="address-line2" className={inputClassName} defaultValue={customer?.deliveryResidence || ''} name="residence" placeholder={t('Neighborhood, building, or residence details')} required />
                    </label>
                  )}
                </div>
              </StepCard>

              <StepCard
                description={t('Pick a day and a time window that works for you.')}
                icon={icons.calendar}
                number={3}
                title={t('Schedule')}
              >
                <label className={`${labelClassName} sm:max-w-xs`}>
                  {t('Scheduled date')}
                  <input className={inputClassName} max={latestScheduledDate} min={today} onChange={(event) => setScheduledDate(event.target.value)} required type="date" value={scheduledDate} />
                </label>
                <fieldset className="mt-5">
                  <legend className={labelClassName}>{t('Time slot')}</legend>
                  {fulfillment.slots.length ? (
                    <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                      {fulfillment.slots.map((slot) => {
                        const isSelected = String(slot.id) === selectedSlot
                        return (
                          <label
                            className={`flex cursor-pointer items-center justify-center rounded-2xl px-3 py-3 text-center text-sm font-extrabold ring-1 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#bd9c00] ${
                              isSelected
                                ? 'bg-[#092a53] text-white ring-[#092a53] shadow-[0_8px_18px_rgba(9,42,83,0.2)]'
                                : 'bg-[#fbfaf5] text-[#52647b] ring-[#e3dfd3] hover:text-[#092a53] hover:ring-[#cfcabb]'
                            }`}
                            key={slot.id}
                          >
                            <input
                              checked={isSelected}
                              className="sr-only"
                              name="slotId"
                              onChange={() => setSelectedSlot(String(slot.id))}
                              required
                              type="radio"
                              value={slot.id}
                            />
                            {t(slot.label)}
                          </label>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="mt-2 rounded-2xl bg-[#fbfaf5] p-4 text-sm text-[#65748a]">{t('Loading…')}</p>
                  )}
                </fieldset>
              </StepCard>

              <StepCard
                description={t('Apply a code or use your loyalty points.')}
                icon={icons.tag}
                number={4}
                title={t('Savings')}
              >
                <label className={labelClassName} htmlFor="discount-code">{t('Discount code')}</label>
                <div className="mt-2 flex gap-2 rounded-2xl bg-[#fbfaf5] p-1.5 ring-1 ring-[#e3dfd3] transition focus-within:bg-white focus-within:ring-2 focus-within:ring-[#e8c400]">
                  <input
                    autoComplete="off"
                    className="min-w-0 flex-1 bg-transparent px-3 text-sm font-extrabold uppercase tracking-[0.08em] text-[#092a53] placeholder:font-semibold placeholder:normal-case placeholder:tracking-normal placeholder:text-[#9aa3af] outline-none!"
                    id="discount-code"
                    onChange={(event) => { setDiscountInput(event.target.value); setDiscountCode(''); setDiscountAmount(0); setDiscountMessage('') }}
                    placeholder={t('Enter code')}
                    value={discountInput}
                  />
                  <button
                    className="shrink-0 rounded-xl bg-[#092a53] px-5 py-2.5 text-sm font-extrabold text-white transition hover:bg-[#163e6b] disabled:cursor-not-allowed disabled:bg-[#d8dce2] disabled:text-[#8b95a2]"
                    disabled={isCheckingCode || !discountInput.trim()}
                    onClick={applyDiscountCode}
                    type="button"
                  >
                    {isCheckingCode ? t('Checking…') : t('Apply code')}
                  </button>
                </div>
                {discountMessage && (
                  <p className={`mt-2 flex items-center gap-2 text-sm font-semibold ${discountCode ? 'text-[#3f6b22]' : 'text-red-700'}`} role="status">
                    <Icon className="size-4 shrink-0" path={discountCode ? icons.check : icons.info} />
                    {discountMessage}
                  </p>
                )}

                {customer && (
                  <label
                    className={`mt-5 flex items-center gap-4 rounded-[20px] p-4 ring-1 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#bd9c00] ${
                      loyaltyBlocked ? 'cursor-not-allowed bg-[#fbfaf5] ring-[#ece8dc]' : redeemLoyalty ? 'cursor-pointer bg-[#fffbea] ring-[#e8c400]' : 'cursor-pointer bg-white ring-[#e3dfd3] hover:ring-[#cfcabb]'
                    }`}
                  >
                    <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${loyaltyBlocked ? 'bg-[#f1eee4] text-[#9aa3af]' : 'bg-[#092a53] text-[#ffdc32]'}`}>
                      <Icon path={icons.star} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm font-extrabold ${loyaltyBlocked ? 'text-[#8b95a2]' : 'text-[#092a53]'}`}>
                        {maxRedeemablePoints >= 100
                          ? t('Use {points} points for {amount} off', { points: maxRedeemablePoints, amount: money(maxRedeemablePoints * 10) })
                          : t('Loyalty rewards')}
                      </span>
                      <span className="block text-xs text-[#65748a]">
                        {t('Your balance')}: {customer.loyaltyPoints || 0} {t('points')}
                        {maxRedeemablePoints >= 100 && (discountCode || discount) ? ` · ${t('Cannot be combined with other offers')}` : ''}
                      </span>
                    </span>
                    <input
                      checked={redeemLoyalty}
                      className="peer sr-only"
                      disabled={loyaltyBlocked}
                      onChange={(event) => {
                        const redeem = event.target.checked
                        setRedeemLoyalty(redeem)
                        if (redeem) {
                          setDiscountCode('')
                          setDiscountAmount(0)
                          setDiscountInput('')
                          setDiscountMessage('')
                        }
                      }}
                      type="checkbox"
                    />
                    <span aria-hidden="true" className="relative h-7 w-12 shrink-0 rounded-full bg-[#dcd8cc] transition after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:bg-[#6c9c45] peer-checked:after:translate-x-5 peer-disabled:opacity-50" />
                  </label>
                )}
              </StepCard>

              <p className="flex gap-3 rounded-2xl bg-[#fffbea] px-4 py-3.5 text-xs leading-5 text-[#6b5800] ring-1 ring-[#f0e2a0] sm:px-5">
                <Icon className="mt-0.5 size-4 shrink-0" path={icons.info} />
                <span>
                  {t('Your delivery details are stored with the order so we can prepare and deliver it.')}{' '}
                  {customer && t('Your contact and delivery details are saved to your account for future orders.')}{' '}
                  {t(hasMenuItems
                    ? 'Menu items and FCFA prices are illustrative examples, not confirmed local menu items or prices. Orders are handled by this independent website.'
                    : "Items and prices in the online catalog are set in FCFA by this website's operator and are not verified Cold Stone Cameroon products, menu prices or promotions.")}
                </span>
              </p>
            </form>

            <aside aria-labelledby="checkout-summary-heading" className="relative z-10 lg:sticky lg:top-[calc(var(--site-header-offset,0px)+2rem)] lg:transition-[top] lg:duration-300">
              <div className="overflow-hidden rounded-[28px] bg-white shadow-[0_18px_50px_rgba(18,44,80,0.09)] ring-1 ring-[#ebe7dc]">
                <div className="flex items-end justify-between gap-3 bg-[#092a53] px-6 py-5 text-white sm:px-7">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#ffdc32]">{t('Your order')}</p>
                    <h2 className="mt-1 font-display text-2xl font-extrabold" id="checkout-summary-heading">{t('Order summary')}</h2>
                  </div>
                  <Link className="text-xs font-bold text-white/70 underline-offset-4 transition hover:text-[#ffdc32] hover:underline" to="/cart">
                    {t('Edit bag')}
                  </Link>
                </div>

                <div className="p-6 sm:p-7">
                  <ul className="max-h-72 space-y-3.5 overflow-y-auto pr-1">
                    {cartItems.map((item) => (
                      <li className="flex items-center gap-3.5" key={item.id}>
                        <span className="relative shrink-0">
                          <img decoding="async" loading="lazy" alt="" className={`size-14 rounded-2xl object-cover ring-1 ring-black/5 ${item.color || 'bg-[#f4f1e7]'}`} src={item.image} />
                          <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#092a53] px-1 text-[10px] font-extrabold text-white ring-2 ring-white">
                            {item.quantity}
                          </span>
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-extrabold text-[#102c50]">{t(item.name)}</p>
                          <p className="text-xs text-[#8b95a2]">{money(item.price)} {t('each')}</p>
                        </div>
                        <span className="shrink-0 whitespace-nowrap text-sm font-bold tabular-nums text-[#102c50]">{money(item.price * item.quantity)}</span>
                      </li>
                    ))}
                  </ul>

                  <dl className="mt-6 space-y-3 border-t border-[#f0ece2] pt-5 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-[#65748a]">{t('Subtotal')} <span className="text-[#9aa3af]">({cartCount})</span></dt>
                      <dd className="font-bold tabular-nums">{money(subtotal)}</dd>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between gap-4 text-[#3f6b22]">
                        <dt className="min-w-0 font-semibold">{t('Buy 2 Get 1 Free ({count} free)', { count: freeScoops })}</dt>
                        <dd className="shrink-0 font-extrabold tabular-nums">−{money(discount)}</dd>
                      </div>
                    )}
                    {discountCode && discountAmount > 0 && (
                      <div className="flex justify-between gap-4 text-[#3f6b22]">
                        <dt className="min-w-0 font-semibold">{t('Discount code {code}', { code: discountCode })}</dt>
                        <dd className="shrink-0 font-extrabold tabular-nums">−{money(discountAmount)}</dd>
                      </div>
                    )}
                    {loyaltyDiscount > 0 && (
                      <div className="flex justify-between gap-4 text-[#3f6b22]">
                        <dt className="min-w-0 font-semibold">{t('Loyalty reward ({points} points)', { points: maxRedeemablePoints })}</dt>
                        <dd className="shrink-0 font-extrabold tabular-nums">−{money(loyaltyDiscount)}</dd>
                      </div>
                    )}
                    <div className="flex justify-between gap-4">
                      <dt className="text-[#65748a]">{fulfillmentType === 'delivery' ? t('Delivery fee') : t('Pickup')}</dt>
                      <dd className="shrink-0 font-bold tabular-nums">{deliveryFee > 0 ? money(deliveryFee) : t('Free')}</dd>
                    </div>
                  </dl>

                  <div className="mt-5 flex items-end justify-between gap-3 border-t border-dashed border-[#dcd8cc] pt-5">
                    <span className="font-display text-lg font-extrabold text-[#092a53]">{t('Total')}</span>
                    <span className="font-display text-3xl font-extrabold tabular-nums leading-none text-[#092a53]">{money(grandTotal)}</span>
                  </div>
                  {totalSavings > 0 && (
                    <p className="mt-2 text-right text-xs font-bold text-[#3f6b22]">{t('You save {amount}', { amount: money(totalSavings) })}</p>
                  )}

                  <button
                    className="group mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-[#ffdc32] px-6 py-4 text-sm font-extrabold text-[#092a53] shadow-[0_12px_26px_rgba(255,220,50,0.35)] transition hover:-translate-y-0.5 hover:bg-[#ffe76c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2 disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-[#ecebe5] disabled:text-[#8b95a2] disabled:shadow-none"
                    disabled={!canSubmit}
                    form="checkout-form"
                    type="submit"
                  >
                    <Icon className="size-4" path={icons.lock} />
                    {t('Review order')}
                    <Icon className="size-4 transition group-hover:translate-x-0.5" path={icons.arrow} />
                  </button>
                  <p className="mt-3 text-center text-[11px] font-medium text-[#8b95a2]">
                    {t('You can review everything before confirming your order.')}
                  </p>
                </div>
              </div>

              <Link className="mt-4 flex items-center justify-center gap-2 text-sm font-extrabold text-[#806a00] transition hover:text-[#092a53]" to="/cart">
                <Icon className="size-4 rotate-180" path={icons.arrow} />
                {t('Back to bag')}
              </Link>
            </aside>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
