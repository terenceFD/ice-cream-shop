import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { photoSrcSet } from '../../lib/thumbnails'
import { Link, useSearchParams } from 'react-router-dom'
import { apiRequest, getCustomerToken } from '../../api/api'
import { useAuth } from '../../context/useAuth'
import { ArrowIcon, Footer, Header } from '../../components/Layout'
import { useLanguage } from '../../language/useLanguage'
import { getCameroonDate } from '../../../shared/cameroonDate'

const toppingOptions = ['Sprinkles', 'Chocolate chips', 'Fresh fruit', 'Cookie pieces', 'Whipped cream']

type CakeQuote = {
  id: number
  size: string
  flavor: string
  pickupDate: string
  storeName: string | null
  status: string
  quotedTotal: number | null
  depositAmount: number | null
  adminNote: string
  payToken?: string | null
}

const CAKE_STATUS: Record<string, string> = {
  new: 'Waiting for the store’s quote',
  contacted: 'Quote ready: pay the deposit',
  confirmed: 'Deposit paid',
  declined: 'Declined',
}

function formatXaf(amount: number, language: string) {
  return `${new Intl.NumberFormat(language === 'fr' ? 'fr-CM' : 'en-US').format(Math.round(amount || 0))} FCFA`
}

export function CustomCakeRequestPage() {
  const { customer } = useAuth()
  const { t, language } = useLanguage()
  const [searchParams, setSearchParams] = useSearchParams()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toppings, setToppings] = useState<string[]>([])
  const [stores, setStores] = useState<{ storeId: number; storeName: string; storeAddress: string; location: string; pickupEnabled: boolean }[]>([])
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [storeError, setStoreError] = useState('')
  const [minPickupDate] = useState(() => getCameroonDate())
  const [maxPickupDate] = useState(() => getCameroonDate(90))
  const [size, setSize] = useState('Medium')
  const [flavor, setFlavor] = useState('Vanilla')
  const [pickupDate, setPickupDate] = useState('')
  const [messageLength, setMessageLength] = useState(0)
  const [quotes, setQuotes] = useState<CakeQuote[]>([])
  const [payTokenRequest, setPayTokenRequest] = useState<CakeQuote | null>(null)
  const [methods, setMethods] = useState({ card: false, campayMobileMoney: false })
  const [payMethod, setPayMethod] = useState<'card' | 'campay'>('card')
  const [payPhone, setPayPhone] = useState('')
  const [payingId, setPayingId] = useState<number | null>(null)
  const [payError, setPayError] = useState('')
  const [paymentNotice, setPaymentNotice] = useState('')

  useEffect(() => {
    let cancelled = false
    apiRequest<{ zones: typeof stores }>('/fulfillment/options')
      .then(({ zones }) => {
        if (cancelled) return
        const pickupStores = zones.filter((zone) => zone.pickupEnabled)
        setStores(pickupStores)
        setSelectedStoreId(String(pickupStores[0]?.storeId || ''))
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setStoreError(loadError instanceof Error ? loadError.message : 'Unable to load available stores.')
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    apiRequest<{ methods: { card: boolean; campayMobileMoney: boolean } }>('/payment/methods')
      .then((result) => {
        setMethods(result.methods)
        setPayMethod(result.methods.card ? 'card' : 'campay')
      })
      .catch(() => {})
  }, [])

  const loadQuotes = useCallback(() => {
    if (!customer?.id) {
      setQuotes([])
      return
    }
    apiRequest<{ requests: CakeQuote[] }>('/customer/cake-requests', { token: getCustomerToken() || undefined })
      .then((result) => setQuotes(result.requests || []))
      .catch(() => setQuotes([]))
  }, [customer?.id])

  useEffect(() => { loadQuotes() }, [loadQuotes])

  const token = searchParams.get('pay')
  const sessionId = searchParams.get('session_id')
  const paymentProvider = searchParams.get('provider')

  useEffect(() => {
    if (!token) {
      setPayTokenRequest(null)
      setPaymentNotice('')
      return
    }
    let cancelled = false
    async function loadQuoteAndConfirmPayment() {
      try {
        if (sessionId || paymentProvider === 'campay') {
          setPaymentNotice(t('Checking your cake deposit payment...'))
        }
        const result = await apiRequest<{ request: CakeQuote }>(`/cake-requests/quote/${encodeURIComponent(token)}`)
        if (cancelled) return
        setPayTokenRequest(result.request)

        if (!sessionId && paymentProvider !== 'campay') return
        const confirmation = await apiRequest<{ request: CakeQuote; paid: boolean }>(
          `/cake-requests/quote/${encodeURIComponent(token)}/deposit/confirm`,
          { method: 'POST', body: sessionId ? { sessionId } : {} },
        )
        if (cancelled) return
        setPayTokenRequest(confirmation.request)
        setPaymentNotice(confirmation.paid
          ? t('Deposit received. Your cake and pickup date are booked.')
          : t("We're still waiting for the payment to be confirmed. Refresh this page in a minute."))
        if (customer) loadQuotes()

        if (confirmation.paid) {
          const next = new URLSearchParams(searchParams)
          next.delete('session_id')
          next.delete('provider')
          next.delete('status')
          setSearchParams(next, { replace: true })
        }
      } catch (loadError) {
        if (!cancelled) {
          setPaymentNotice(loadError instanceof Error
            ? loadError.message
            : t('Unable to confirm the cake deposit. Please refresh this page to try again.'))
        }
      }
    }
    loadQuoteAndConfirmPayment()
    return () => { cancelled = true }
  }, [token, sessionId, paymentProvider, searchParams, setSearchParams, customer, loadQuotes, t])

  async function payDeposit(quote: CakeQuote, token?: string) {
    setPayError('')
    setPayingId(quote.id)
    try {
      const path = token
        ? `/cake-requests/quote/${encodeURIComponent(token)}/deposit`
        : `/customer/cake-requests/${quote.id}/deposit`
      const result = await apiRequest<{ url: string }>(path, {
        method: 'POST',
        token: token ? undefined : getCustomerToken() || undefined,
        body: { method: payMethod, phone: payPhone },
      })
      if (result.url) window.location.assign(result.url)
    } catch (error) {
      setPayError(error instanceof Error ? error.message : 'The deposit payment could not be started.')
    } finally {
      setPayingId(null)
    }
  }

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    setError('')
    setSuccess('')
    setIsSubmitting(true)
    const form = new FormData(formElement)
    try {
      const result = await apiRequest<{ requestId: number }>('/cake-requests', {
        method: 'POST',
        token: getCustomerToken() || undefined,
        body: {
          name: form.get('name'),
          email: form.get('email'),
          phone: form.get('phone'),
          storeId: Number(form.get('storeId')),
          size: form.get('size'),
          flavor: form.get('flavor'),
          message: form.get('message'),
          toppings,
          pickupDate: form.get('pickupDate'),
        },
      })
      setSuccess(t('Request #{id} sent. The store will contact you to confirm the details and price.', { id: result.requestId }))
      formElement.reset()
      setToppings([])
      setSize('Medium')
      setFlavor('Vanilla')
      setPickupDate('')
      setMessageLength(0)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to send cake request.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const sizeOptions = [
    { label: 'Small', icon: 'size-7' },
    { label: 'Medium', icon: 'size-9' },
    { label: 'Large', icon: 'size-11' },
  ]
  const flavorOptions = [
    { label: 'Vanilla', swatch: 'bg-[#f6e7b9]' },
    { label: 'Chocolate', swatch: 'bg-[#6b3f26]' },
    { label: 'Strawberry', swatch: 'bg-[#f39bb0]' },
    { label: 'Mango', swatch: 'bg-[#f7b23b]' },
    { label: 'Custom flavor — tell us below', swatch: 'bg-[conic-gradient(#ffdc32,#f56586,#7b4bd8,#4fc4e8,#ffdc32)]' },
  ]
  const selectedStore = stores.find((store) => String(store.storeId) === selectedStoreId)
  const labelClass = 'text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#52647b]'
  const fieldClass = 'mt-2 w-full rounded-2xl bg-white px-4 py-3.5 text-sm font-semibold text-[#092a53] outline-none! ring-1 ring-[#e5e1d7] transition placeholder:font-normal placeholder:text-[#a5aebb] hover:ring-[#d6cfbd] focus:ring-[#c9b24a]'
  const stepHeading = (number: string, title: string, id: string) => (
    <h3 className="flex items-center gap-3 font-display text-xl font-extrabold text-[#092a53]" id={id}>
      <span className="grid size-9 place-items-center rounded-full bg-[#092a53] font-display text-sm text-[#ffdc32]">{number}</span>
      {t(title)}
    </h3>
  )
  const formatDate = (value: string) =>
    value ? new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'long' }) : ''

  return (
    <div className="min-h-screen bg-[#fbfaf5] text-[#102c50]">
      <Header />
      {paymentNotice && (
        <div className="mx-auto max-w-[1320px] px-5 pt-5 sm:px-8 lg:px-12">
          <p className={`rounded-2xl p-4 text-sm font-semibold leading-6 ring-1 ${paymentNotice === t('Deposit received. Your cake and pickup date are booked.') ? 'bg-[#f3f8ef] text-[#274d20] ring-[#cfe2c4]' : 'bg-[#fffaf0] text-[#624f00] ring-[#ecdfa6]'}`} role="status">
            {paymentNotice}
          </p>
        </div>
      )}
      <main>
        {/* Hero */}
        <section className="relative isolate overflow-hidden bg-[#092a53] text-white">
          <div aria-hidden="true" className="pointer-events-none absolute -right-32 -top-36 -z-10 size-[40rem] rounded-full bg-[radial-gradient(closest-side,rgb(255_220_50/0.16),rgb(255_220_50/0.16)_35%,transparent)]" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-52 -left-36 -z-10 size-[34rem] rounded-full bg-[radial-gradient(closest-side,rgb(28_79_138/0.55),rgb(28_79_138/0.55)_35%,transparent)]" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 opacity-[0.06] [background-image:radial-gradient(#ffffff_1px,transparent_1px)] [background-size:28px_28px]" />
          <div className="mx-auto grid max-w-[1320px] grid-cols-1 items-center gap-12 px-5 pb-16 pt-10 sm:px-8 sm:pt-14 lg:grid-cols-12 lg:gap-10 lg:px-12 lg:pb-20 lg:pt-16">
            <div className="lg:col-span-6">
              <nav aria-label={t('Breadcrumb')} className="flex items-center gap-2 text-xs font-bold text-white/55">
                <Link className="transition hover:text-white" to="/menu">{t('Menu')}</Link>
                <span aria-hidden="true" className="text-white/30">/</span>
                <span aria-current="page" className="text-white">{t('Custom cake request')}</span>
              </nav>
              <p className="mt-8 inline-flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#ffdc32]">
                <span aria-hidden="true" className="h-px w-10 bg-[#ffdc32]" />
                {t('Made for your celebration')}
              </p>
              <h1 className="mt-6 font-display text-5xl font-extrabold leading-[0.98] tracking-tight text-white sm:text-6xl lg:text-7xl">
                {t('Custom cake request')}
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-white/75 sm:text-lg sm:leading-8">
                {t('Choose your cake details and requested pickup date. This is a request, not a confirmed order; the store will contact you about availability and pricing.')}
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
                <a
                  className="inline-flex items-center gap-2 rounded-full bg-[#ffdc32] px-7 py-4 text-sm font-extrabold text-[#092a53] shadow-[0_14px_34px_rgba(255,220,50,0.25)] transition hover:-translate-y-0.5 hover:bg-[#ffe76c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffdc32] focus-visible:ring-offset-2 focus-visible:ring-offset-[#092a53]"
                  href="#cake-request-form"
                >
                  {t('Start your request')} <span aria-hidden="true">↓</span>
                </a>
                <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-white/80">
                  {['Choose your cake details', 'We’ll confirm the details'].map((label) => (
                    <li className="inline-flex items-center gap-2" key={label}>
                      <span aria-hidden="true" className="grid size-5 place-items-center rounded-full bg-[#ffdc32]/15 text-[#ffdc32]">
                        <svg className="size-3" fill="none" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" /></svg>
                      </span>
                      {t(label)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="relative lg:col-span-6">
              <div className="grid grid-cols-5 grid-rows-2 gap-3 sm:gap-4 [aspect-ratio:5/4]">
                <figure className="col-span-3 row-span-2 overflow-hidden rounded-[30px] bg-[#fff3b8] shadow-[0_28px_64px_rgba(9,42,83,0.18)]">
                  <img decoding="async" loading="lazy" alt={t('Custom celebration cake')} className="size-full object-cover" sizes="(min-width: 1024px) 360px, 60vw" src="/cake-images/cake-1.webp" srcSet={photoSrcSet('/cake-images/cake-1.webp')} />
                </figure>
                <figure className="col-span-2 overflow-hidden rounded-[24px] bg-[#fff3b8] shadow-[0_16px_36px_rgba(9,42,83,0.12)]">
                  <img decoding="async" loading="lazy" alt="" aria-hidden="true" className="size-full object-cover" sizes="(min-width: 1024px) 240px, 40vw" src="/cake-images/cake-3.webp" srcSet={photoSrcSet('/cake-images/cake-3.webp')} />
                </figure>
                <figure className="col-span-2 overflow-hidden rounded-[24px] bg-[#fff3b8] shadow-[0_16px_36px_rgba(9,42,83,0.12)]">
                  <img decoding="async" loading="lazy" alt="" aria-hidden="true" className="size-full object-cover" sizes="(min-width: 1024px) 240px, 40vw" src="/cake-images/cake-5.webp" srcSet={photoSrcSet('/cake-images/cake-5.webp')} />
                </figure>
              </div>
              <div className="absolute -bottom-6 left-4 flex max-w-[320px] items-center gap-3 rounded-2xl border border-[#eeeae1] bg-white/95 p-4 shadow-[0_18px_40px_rgba(9,42,83,0.14)] backdrop-blur-sm sm:left-8">
                <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#ffdc32] text-[#092a53]">
                  <svg className="size-6" fill="none" viewBox="0 0 24 24">
                    <path d="M4 20h16M5 20v-6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6M5 16c2 1 3-1 4.7 0s2.6 1 4.6 0 3 1 4.7 0M12 12V8m0-3v.01" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                  </svg>
                </span>
                <div className="leading-tight">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#8a7000]">{t('A treat made your way')}</p>
                  <p className="mt-1 text-xs font-bold leading-4 text-[#092a53]">{t('Share your ideas and we’ll help bring your celebration cake to life.')}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-5 py-14 sm:px-8 sm:py-20 lg:px-12">
          <div className="mx-auto grid max-w-[1320px] grid-cols-1 items-start gap-10 lg:grid-cols-12 lg:gap-12">
            {/* Form */}
            <form
              className="scroll-mt-6 rounded-[32px] bg-white p-6 shadow-[0_1px_0_rgba(9,42,83,0.04),0_24px_60px_rgba(9,42,83,0.08)] ring-1 ring-[#ebe7dc] sm:p-10 lg:col-span-8"
              id="cake-request-form"
              onSubmit={submitRequest}
            >
              <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#8a7000]">{t('A few details to get started')}</p>
              <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-[#092a53] sm:text-4xl">{t('Tell us about your cake')}</h2>
              <p className="mt-2 text-sm text-[#65748a]">{t('Fields marked with an asterisk are required.')}</p>

              {/* Step 1 */}
              <section aria-labelledby="cake-design-heading" className="mt-10 border-t border-[#efece3] pt-8">
                {stepHeading('1', 'Design your cake', 'cake-design-heading')}

                <fieldset className="mt-6">
                  <legend className={labelClass}>{t('Cake size')}</legend>
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    {sizeOptions.map((option) => {
                      const value = t(option.label)
                      const checked = size === option.label
                      return (
                        <label
                          className={`relative flex cursor-pointer flex-col items-center justify-end gap-3 rounded-2xl px-3 pb-4 pt-5 text-center ring-1 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#092a53] ${
                            checked ? 'bg-[#092a53] text-white ring-[#092a53]' : 'bg-[#fbfaf5] text-[#092a53] ring-[#ebe7dc] hover:ring-[#d6cfbd]'
                          }`}
                          key={option.label}
                        >
                          <input checked={checked} className="sr-only" name="size" onChange={() => setSize(option.label)} type="radio" value={value} />
                          <svg aria-hidden="true" className={`${option.icon} ${checked ? 'text-[#ffdc32]' : 'text-[#8a7000]'}`} fill="none" viewBox="0 0 24 24">
                            <path d="M4 20h16M5 20v-6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6M5 16c2 1 3-1 4.7 0s2.6 1 4.6 0 3 1 4.7 0M12 12V8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
                          </svg>
                          <span className="text-sm font-extrabold">{value}</span>
                        </label>
                      )
                    })}
                  </div>
                </fieldset>

                <fieldset className="mt-7">
                  <legend className={labelClass}>{t('Cake flavor')}</legend>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {flavorOptions.map((option) => {
                      const value = t(option.label)
                      const checked = flavor === option.label
                      return (
                        <label
                          className={`inline-flex cursor-pointer items-center gap-2.5 rounded-full py-2 pl-2 pr-4 text-sm font-bold ring-1 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#092a53] ${
                            checked ? 'bg-[#fbf6e3] text-[#092a53] ring-[#c9b24a]' : 'bg-white text-[#52647b] ring-[#e5e1d7] hover:ring-[#d6cfbd]'
                          }`}
                          key={option.label}
                        >
                          <input checked={checked} className="sr-only" name="flavor" onChange={() => setFlavor(option.label)} type="radio" value={value} />
                          <span aria-hidden="true" className={`size-6 rounded-full ring-2 ring-white ${option.swatch} ${checked ? 'shadow-[0_0_0_2px_#c9b24a]' : 'shadow-[0_0_0_1px_#e5e1d7]'}`} />
                          {value}
                        </label>
                      )
                    })}
                  </div>
                </fieldset>

                <fieldset className="mt-7">
                  <legend className={labelClass}>{t('Toppings')} <span className="font-semibold normal-case tracking-normal text-[#a5aebb]">({t('optional')})</span></legend>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {toppingOptions.map((topping) => {
                      const checked = toppings.includes(topping)
                      return (
                        <label
                          className={`inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold ring-1 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#092a53] ${
                            checked ? 'bg-[#092a53] text-white ring-[#092a53]' : 'bg-white text-[#52647b] ring-[#e5e1d7] hover:ring-[#d6cfbd]'
                          }`}
                          key={topping}
                        >
                          <input
                            checked={checked}
                            className="sr-only"
                            onChange={(event) => setToppings((current) => event.target.checked ? [...current, topping] : current.filter((value) => value !== topping))}
                            type="checkbox"
                          />
                          <span aria-hidden="true" className={`grid size-4 place-items-center rounded-full transition ${checked ? 'bg-[#ffdc32] text-[#092a53]' : 'ring-1 ring-[#c9c3b4]'}`}>
                            {checked && <svg className="size-2.5" fill="none" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" /></svg>}
                          </span>
                          {t(topping)}
                        </label>
                      )
                    })}
                  </div>
                </fieldset>

                <label className="mt-7 block">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className={labelClass}>{t('Message on cake or special instructions')} <span className="font-semibold normal-case tracking-normal text-[#a5aebb]">({t('optional')})</span></span>
                    <span className="shrink-0 text-[11px] font-semibold tabular-nums text-[#a5aebb]">{messageLength} / 200</span>
                  </span>
                  <textarea
                    className={`${fieldClass} resize-y leading-7`}
                    maxLength={200}
                    name="message"
                    onChange={(event) => setMessageLength(event.target.value.length)}
                    placeholder={t('Add a message or any details you’d like us to know.')}
                    rows={3}
                  />
                </label>
              </section>

              {/* Step 2 */}
              <section aria-labelledby="cake-pickup-heading" className="mt-10 border-t border-[#efece3] pt-8">
                {stepHeading('2', 'Pickup details', 'cake-pickup-heading')}
                <fieldset className="mt-6">
                  <legend className={labelClass}>{t('Selected store')} <span className="text-[#8a7000]">*</span></legend>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {stores.map((store) => {
                      const checked = String(store.storeId) === selectedStoreId
                      return (
                        <label
                          className={`flex min-w-0 cursor-pointer items-center gap-3 rounded-2xl p-3 ring-1 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#092a53] ${
                            checked ? 'bg-[#fbf6e3] ring-[#c9b24a]' : 'bg-white ring-[#e5e1d7] hover:ring-[#d6cfbd]'
                          }`}
                          key={store.storeId}
                        >
                          <input checked={checked} className="sr-only" name="storeId" onChange={() => setSelectedStoreId(String(store.storeId))} required type="radio" value={store.storeId} />
                          <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-xl transition ${checked ? 'bg-[#092a53] text-[#ffdc32]' : 'bg-[#f4f1e8] text-[#65748a]'}`}>
                            <svg className="size-[18px]" fill="none" viewBox="0 0 24 24">
                              <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 1 1 13 0c0 5.4-6.5 11-6.5 11Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
                              <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.8" />
                            </svg>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-extrabold text-[#092a53]">{t(store.storeName)}</span>
                            <span className="mt-0.5 block truncate text-xs font-semibold text-[#65748a]">{t(store.storeAddress || store.location)}</span>
                          </span>
                          <span aria-hidden="true" className={`grid size-5 shrink-0 place-items-center rounded-full ring-2 ${checked ? 'bg-[#092a53] ring-[#092a53]' : 'ring-[#ddd6c4]'}`}>
                            {checked && <span className="size-2 rounded-full bg-[#ffdc32]" />}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </fieldset>
                <label className="mt-6 block sm:max-w-xs">
                  <span className={labelClass}>{t('Pickup date')} <span className="text-[#8a7000]">*</span></span>
                  <input className={fieldClass} max={maxPickupDate} min={minPickupDate} name="pickupDate" onChange={(event) => setPickupDate(event.target.value)} required type="date" />
                </label>
              </section>

              {/* Step 3 */}
              <section aria-labelledby="cake-contact-heading" className="mt-10 border-t border-[#efece3] pt-8">
                {stepHeading('3', 'Your contact details', 'cake-contact-heading')}
                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <label className="block">
                    <span className={labelClass}>{t('Full name')} <span className="text-[#8a7000]">*</span></span>
                    <input autoComplete="name" className={fieldClass} defaultValue={customer?.name || ''} maxLength={100} name="name" required />
                  </label>
                  <label className="block">
                    <span className={labelClass}>{t('Email address')} <span className="text-[#8a7000]">*</span></span>
                    <input autoComplete="email" className={fieldClass} defaultValue={customer?.email || ''} maxLength={254} name="email" required type="email" />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className={labelClass}>{t('Phone number')} <span className="text-[#8a7000]">*</span></span>
                    <input autoComplete="tel" className={fieldClass} defaultValue={customer?.phone || ''} maxLength={40} name="phone" required type="tel" />
                  </label>
                </div>
              </section>

              {(error || storeError) && (
                <p className="mt-8 flex gap-3 rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-100" role="alert">
                  <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center rounded-full bg-red-100 text-xs font-extrabold">!</span>
                  {error || storeError}
                </p>
              )}
              {!storeError && !stores.length && (
                <p className="mt-8 rounded-2xl bg-[#fffaf0] p-4 text-sm text-[#624f00] ring-1 ring-[#ecdfa6]" role="status">{t('No pickup locations are available right now. Please try again later.')}</p>
              )}
              {success && (
                <p className="mt-8 flex items-start gap-3 rounded-2xl bg-[#f3f8ef] p-5 text-sm font-semibold leading-6 text-[#274d20] ring-1 ring-[#cfe2c4]" role="status">
                  <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-[#4caf50] text-white">
                    <svg className="size-4" fill="none" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" /></svg>
                  </span>
                  {success}
                </p>
              )}

              <div className="mt-8 flex flex-col-reverse gap-4 border-t border-[#efece3] pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-[#65748a]">{t('We’ll be in touch to confirm your request.')}</p>
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#092a53] px-8 py-4 text-sm font-extrabold text-white shadow-[0_12px_28px_rgba(9,42,83,0.22)] transition hover:-translate-y-0.5 hover:bg-[#163e6b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isSubmitting || !stores.length || Boolean(storeError)}
                  type="submit"
                >
                  {isSubmitting ? t('Sending…') : t('Send cake request')}
                  {!isSubmitting && <ArrowIcon />}
                </button>
              </div>
            </form>

            {/* Live summary */}
            <aside className="space-y-5 lg:sticky lg:top-[calc(var(--site-header-offset,0px)+2rem)] lg:transition-[top] lg:duration-300 lg:col-span-4">
              <div className="overflow-hidden rounded-[28px] bg-[#092a53] text-white shadow-[0_24px_60px_rgba(9,42,83,0.2)]">
                <div className="relative isolate p-6">
                  <span aria-hidden="true" className="absolute -right-10 -top-12 -z-10 size-36 rounded-full border-[22px] border-white/[0.06]" />
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#ffdc32]">{t('Your celebration, your cake')}</p>
                  <h2 className="mt-2 font-display text-2xl font-extrabold">{t('Your cake')}</h2>
                </div>
                <dl aria-live="polite" className="divide-y divide-white/10 border-t border-white/10 px-6">
                  {[
                    { label: 'Cake size', value: t(size) },
                    { label: 'Cake flavor', value: t(flavor) },
                    { label: 'Toppings', value: toppings.length ? toppings.map((topping) => t(topping)).join(', ') : t('None') },
                    { label: 'Selected store', value: selectedStore ? t(selectedStore.storeName) : '' },
                    { label: 'Pickup date', value: formatDate(pickupDate) },
                  ].map((row) => (
                    <div className="flex items-start justify-between gap-4 py-3.5" key={row.label}>
                      <dt className="text-xs font-semibold text-white/55">{t(row.label)}</dt>
                      <dd className={`text-right text-sm font-extrabold ${row.value ? 'text-white' : 'text-white/35'}`}>{row.value || t('Not selected yet')}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <ol className="space-y-4 rounded-[24px] bg-white p-6 ring-1 ring-[#ebe7dc]">
                {[
                  { title: 'Tell us what you love', detail: 'Choose a size, flavor and toppings.' },
                  { title: 'Pick a store and date', detail: 'Select a pickup location and preferred day.' },
                  { title: 'Pay the deposit to book it', detail: 'The store sends a quote. Pay the deposit to hold the cake and pickup date.' },
                ].map((step, index) => (
                  <li className="flex gap-3" key={step.title}>
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#fbf6e3] font-display text-xs font-extrabold tabular-nums text-[#8a7000]">{String(index + 1).padStart(2, '0')}</span>
                    <div>
                      <h3 className="text-sm font-extrabold text-[#092a53]">{t(step.title)}</h3>
                      <p className="mt-0.5 text-xs leading-5 text-[#65748a]">{t(step.detail)}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="flex gap-3 rounded-[22px] bg-[#fffaf0] p-5 ring-1 ring-[#ecdfa6]">
                <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-[#ffdc32]/40 font-display text-xs font-extrabold text-[#806a00]">i</span>
                <div className="text-xs leading-5 text-[#624f00]">
                  <p className="font-extrabold">{t('Please note')}</p>
                  <p className="mt-0.5">{t('Sending this form is a request. The store will send a quote. The cake is booked when you pay the deposit.')}</p>
                </div>
              </div>
            </aside>
          </div>

          {(payTokenRequest || quotes.length > 0) && (
            <div className="mx-auto mt-4 max-w-[1320px] px-5 pb-16 sm:px-8 lg:px-12">
              <h2 className="font-display text-2xl font-extrabold text-[#092a53]">{t('Your cake quotes')}</h2>
              <ul className="mt-5 grid gap-4 md:grid-cols-2">
                {(payTokenRequest ? [payTokenRequest, ...quotes.filter((quote) => quote.id !== payTokenRequest.id)] : quotes).map((quote) => (
                  <li className="rounded-[24px] bg-white p-5 ring-1 ring-[#ebe7dc]" key={quote.id}>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#8190a1]">#{quote.id}</p>
                    <h3 className="mt-1 font-display text-lg font-extrabold text-[#092a53]">{t(quote.size)} {t(quote.flavor)}</h3>
                    <p className="mt-1 text-sm text-[#65748a]">{t('Pickup date')}: {formatDate(quote.pickupDate)}{quote.storeName ? ` · ${t(quote.storeName)}` : ''}</p>
                    <p className="mt-3 inline-flex rounded-full bg-[#f3f6fa] px-2.5 py-1 text-xs font-bold text-[#315982]">{t(CAKE_STATUS[quote.status] || quote.status)}</p>
                    {quote.quotedTotal && (
                      <p className="mt-3 text-sm font-extrabold text-[#092a53]">
                        {t('Total')}: {formatXaf(quote.quotedTotal, language)}
                        {quote.depositAmount ? ` · ${t('Deposit')}: ${formatXaf(quote.depositAmount, language)}` : ''}
                      </p>
                    )}
                    {quote.adminNote && <p className="mt-2 text-sm leading-6 text-[#5c4a00]">{quote.adminNote}</p>}
                    {quote.status === 'contacted' && quote.depositAmount && (
                      <div className="mt-4">
                        <div className="grid grid-cols-2 gap-2">
                          {methods.card && (
                            <button className={`rounded-2xl px-4 py-3 text-sm font-extrabold ${payMethod === 'card' ? 'bg-[#092a53] text-white' : 'bg-[#f6f3ea] text-[#092a53]'}`} onClick={() => setPayMethod('card')} type="button">{t('Card')}</button>
                          )}
                          {methods.campayMobileMoney && (
                            <button className={`rounded-2xl px-4 py-3 text-sm font-extrabold ${payMethod === 'campay' ? 'bg-[#092a53] text-white' : 'bg-[#f6f3ea] text-[#092a53]'}`} onClick={() => setPayMethod('campay')} type="button">{t('Mobile Money')}</button>
                          )}
                        </div>
                        {payMethod === 'campay' && (
                          <input className="mt-3 w-full rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-[#e5e1d7]" onChange={(event) => setPayPhone(event.target.value)} placeholder="6XX XX XX XX" type="tel" value={payPhone} />
                        )}
                        {payError && payingId === quote.id && <p className="mt-2 text-sm font-semibold text-red-700">{payError}</p>}
                        <button
                          className="mt-3 w-full rounded-full bg-[#ffdc32] px-5 py-3 text-sm font-extrabold text-[#092a53] disabled:opacity-60"
                          disabled={payingId === quote.id}
                          onClick={() => payDeposit(quote, searchParams.get('pay') || quote.payToken || undefined)}
                          type="button"
                        >
                          {payingId === quote.id ? t('Opening payment…') : t('Pay {amount} deposit', { amount: formatXaf(quote.depositAmount, language) })}
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  )
}
