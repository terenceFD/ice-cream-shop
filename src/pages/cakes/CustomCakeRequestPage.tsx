import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { photoSrcSet, thumbnail } from '../../lib/thumbnails'
import { useSearchParams } from 'react-router-dom'
import { apiRequest, getCustomerToken } from '../../api/api'
import { useAuth } from '../../context/useAuth'
import { ArrowIcon, Footer, Header } from '../../components/Layout'
import { PaymentStatusDialog, type PaymentStatus } from '../../components/PaymentStatusDialog'
import { useLanguage } from '../../language/useLanguage'
import { getCameroonDate } from '../../../shared/cameroonDate'
import { toInt } from '../../../shared/numbers.ts'

const toppingOptions = ['Sprinkles', 'Chocolate chips', 'Fresh fruit', 'Cookie pieces', 'Whipped cream']
const cakeGallery = [
  { photo: '/cake-images/cake-1.webp', name: 'Rose birthday cake' },
  { photo: '/cake-images/cake-2.webp', name: 'Blue celebration cake' },
  { photo: '/cake-images/cake-3.webp', name: 'Vanilla dream cake' },
  { photo: '/cake-images/cake-4.webp', name: 'Party ice cream cake' },
]

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

type PaymentDialogState = {
  status: PaymentStatus
  message?: string
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
  const [selectedCakePhoto, setSelectedCakePhoto] = useState(0)
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
  const [paymentDialog, setPaymentDialog] = useState<PaymentDialogState | null>(null)
  const [paymentCheckAttempt, setPaymentCheckAttempt] = useState(0)

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
      .catch(() => { })
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
      setPaymentDialog(null)
      return
    }
    let cancelled = false
    async function loadQuoteAndConfirmPayment() {
      const wasCancelled = searchParams.get('cancelled') === '1'
      const paymentFailed = searchParams.get('status') === 'failed'
      const returningFromPayment = Boolean(sessionId || paymentProvider === 'campay')
      if (returningFromPayment) setPaymentDialog({ status: 'checking' })
      try {
        const result = await apiRequest<{ request: CakeQuote }>(`/cake-requests/quote/${encodeURIComponent(token)}`)
        if (cancelled) return
        setPayTokenRequest(result.request)

        if (wasCancelled || paymentFailed) {
          setPaymentDialog({
            status: wasCancelled ? 'cancelled' : 'failed',
            message: t(wasCancelled
              ? 'Cake deposit payment was cancelled. You can try again below.'
              : 'The cake deposit payment did not go through. You can try again below.'),
          })
          const next = new URLSearchParams(searchParams)
          for (const key of ['session_id', 'provider', 'status', 'cancelled']) next.delete(key)
          setSearchParams(next, { replace: true })
          return
        }
        if (!returningFromPayment) return

        const confirmation = await apiRequest<{ request: CakeQuote; paid: boolean }>(
          `/cake-requests/quote/${encodeURIComponent(token)}/deposit/confirm`,
          { method: 'POST', body: sessionId ? { sessionId } : {} },
        )
        if (cancelled) return
        setPayTokenRequest(confirmation.request)
        setPaymentDialog({
          status: confirmation.paid ? 'success' : 'pending',
          message: t(confirmation.paid
            ? 'Deposit received. Your cake and pickup date are booked.'
            : "We're still waiting for the payment to be confirmed. Check again in a moment."),
        })
        if (customer) loadQuotes()

        if (confirmation.paid) {
          const next = new URLSearchParams(searchParams)
          for (const key of ['session_id', 'provider', 'status', 'cancelled']) next.delete(key)
          setSearchParams(next, { replace: true })
        }
      } catch (loadError) {
        if (!cancelled) {
          setPaymentDialog({
            status: 'error',
            message: loadError instanceof Error
              ? loadError.message
              : t('Unable to confirm the cake deposit. Please try again.'),
          })
        }
      }
    }
    loadQuoteAndConfirmPayment()
    return () => { cancelled = true }
  }, [token, sessionId, paymentProvider, paymentCheckAttempt, searchParams, setSearchParams, customer, loadQuotes, t])

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
          storeId: toInt(form.get('storeId'), 0),
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
    { label: 'Custom flavor — tell us below', swatch: 'bg-[#4b6d82]' },
  ]
  const selectedStore = stores.find((store) => String(store.storeId) === selectedStoreId)
  const previewCake = cakeGallery[selectedCakePhoto]
  const labelClass = 'block text-[13px] font-bold text-[#33455c]'
  const fieldClass = 'mt-2 w-full rounded-md bg-[#f4f6f8] px-4 py-3.5 text-sm font-semibold text-[#472a3b] outline-none! ring-1 ring-[#dce2e8] transition placeholder:font-normal placeholder:text-[#78879a] hover:bg-white hover:ring-[#9aa9ba] focus:bg-white focus:ring-2 focus:ring-[#b8721e]'
  const stepHeading = (title: string, hint: string, id: string) => (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
      <h3 className="font-display text-2xl font-extrabold tracking-tight text-[#472a3b]" id={id}>
        {t(title)}
      </h3>
      <p className="text-[13px] font-semibold text-[#65748a]">{t(hint)}</p>
    </div>
  )
  const formatDate = (value: string) =>
    value ? new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'long' }) : ''

  return (
    <div className="min-h-screen bg-[#f4f6f8] text-[#472a3b]">
      <Header />
      {paymentDialog && (
        <PaymentStatusDialog
          checkingMessage={t('Please wait while we verify your payment securely.')}
          closeLabel={t('Close')}
          eyebrow={t('Custom cake deposit')}
          message={paymentDialog.message || (paymentDialog.status === 'checking'
            ? t('Checking your cake deposit payment...')
            : t('Deposit received. Your cake and pickup date are booked.'))}
          onClose={() => setPaymentDialog(null)}
          onRetry={paymentDialog.status === 'pending' ? () => setPaymentCheckAttempt((attempt) => attempt + 1) : undefined}
          retryLabel={t('Check payment again')}
          status={paymentDialog.status}
          successLabel={t('Continue')}
          title={paymentDialog.status === 'checking'
            ? t('Confirming your deposit')
            : paymentDialog.status === 'success'
              ? t('Payment confirmed')
              : paymentDialog.status === 'pending'
                ? t('Payment is still processing')
                : paymentDialog.status === 'cancelled'
                  ? t('Payment cancelled')
                  : paymentDialog.status === 'failed'
                    ? t('Payment was not completed')
                    : t('We could not confirm your payment')}
        />
      )}
      <main id="main" tabIndex={-1}>
        <section className="bg-[#472a3b] text-white">
          <div className="grid lg:min-h-[min(82svh,760px)] lg:grid-cols-[58%_42%]">
            <div className="h-[48svh] min-h-[18rem] max-h-[34rem] overflow-hidden lg:h-auto lg:min-h-[min(82svh,760px)] lg:max-h-none">
              <img
                alt={t('Custom celebration cake')}
                className="size-full object-cover object-center"
                decoding="async"
                fetchPriority="high"
                sizes="(min-width: 1024px) 58vw, 100vw"
                src={thumbnail('/cake-images/cake-11.webp')}
                srcSet={photoSrcSet('/cake-images/cake-11.webp')}
              />
            </div>
            <div className="flex items-center px-6 py-12 text-right sm:px-10 lg:px-12 xl:px-20">
              <div className="ml-auto max-w-md">
                <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
                  {t('Custom ice cream cakes')}
                </h1>
                <p className="mt-5 text-base leading-7 text-white/80 sm:text-lg sm:leading-8">
                  {t('Creamy ice cream cakes for birthdays, parties, and every celebration.')}
                </p>
                <a
                  className="mt-8 inline-flex min-h-12 items-center justify-center bg-[#ffb84d] px-6 py-3 text-sm font-extrabold text-[#472a3b] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#472a3b]"
                  href="#cake-request-form"
                >
                  {t('Start your request')}
                </a>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="cake-gallery-title" className="bg-[#f4f6f8] px-5 py-16 sm:px-8 sm:py-24 lg:px-12">
          <div className="mx-auto grid max-w-[1320px] items-center gap-10 lg:grid-cols-12 lg:gap-16">
            <figure className="min-w-0 lg:col-span-8">
              <div className="aspect-[4/3] overflow-hidden bg-[#dce2e8] sm:aspect-[16/10]">
                <img
                  alt={t(previewCake.name)}
                  className="size-full object-cover"
                  decoding="async"
                  loading="lazy"
                  sizes="(min-width: 1024px) 58vw, 92vw"
                  src={thumbnail(previewCake.photo)}
                  srcSet={photoSrcSet(previewCake.photo)}
                />
              </div>
              <figcaption className="mt-4 text-sm font-bold text-[#33455c]">{t(previewCake.name)}</figcaption>
              <div aria-label={t('Custom cake request')} className="grid grid-cols-[repeat(auto-fill,4.5rem)] gap-3 mt-4" role="group">
                {cakeGallery.map((cake, index) => (
                  <button
                    aria-label={`${t('Custom celebration cake')} ${index + 1}`}
                    aria-pressed={selectedCakePhoto === index}
                    className={`size-[4.5rem] shrink-0 overflow-hidden bg-[#dce2e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#472a3b] focus-visible:ring-offset-2 ${selectedCakePhoto === index ? 'ring-2 ring-[#472a3b] ring-offset-2' : 'opacity-70 hover:opacity-100'}`}
                    key={cake.photo}
                    onClick={() => setSelectedCakePhoto(index)}
                    type="button"
                  >
                    <img
                      alt=""
                      className="size-full object-cover"
                      decoding="async"
                      loading="eager"
                      src={thumbnail(cake.photo, 'tiny')}
                    />
                  </button>
                ))}
              </div>
            </figure>
            <div className="lg:col-span-4">
              <h2 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-[#472a3b] sm:text-4xl" id="cake-gallery-title">
                {t('Cakes made here')}
              </h2>
              <p className="mt-5 text-base leading-7 text-[#33455c]">
                {t('Every one of these started as a request like yours — a size, a flavour and an idea. Yours is next.')}
              </p>
              <a
                className="mt-7 inline-flex min-h-12 items-center bg-[#472a3b] px-6 py-3 text-sm font-extrabold text-white transition-colors hover:bg-[#6b3f58] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8721e] focus-visible:ring-offset-2"
                href="#cake-request-form"
              >
                {t('Start your request')}
              </a>
            </div>
          </div>
        </section>

        <section className="bg-[#f4f6f8] px-5 py-14 sm:px-8 sm:py-20 lg:px-12">
          <div className="mx-auto grid max-w-[1320px] grid-cols-1 items-start gap-10 lg:grid-cols-12 lg:gap-12">
            {/* Form */}
            <form
              className="scroll-mt-6 bg-white p-6 sm:p-10 lg:col-span-8"
              id="cake-request-form"
              onSubmit={submitRequest}
            >
              <h2 className="font-display text-3xl font-extrabold tracking-tight text-[#472a3b] sm:text-4xl">{t('Tell us about your cake')}</h2>
              <p className="mt-3 max-w-xl text-base leading-7 text-[#65748a]">
                {t('Choose the size, flavour and finishing touches, then pick a store and date. Fields marked with an asterisk are required.')}
              </p>

              {/* Step 1 */}
              <section aria-labelledby="cake-design-heading" className="mt-10">
                {stepHeading('Design your cake', 'Size, flavour and toppings', 'cake-design-heading')}

                <fieldset className="mt-6">
                  <legend className={labelClass}>{t('Cake size')}</legend>
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    {sizeOptions.map((option) => {
                      const value = t(option.label)
                      const checked = size === option.label
                      return (
                        <label
                          className={`relative flex cursor-pointer flex-col items-center justify-end gap-3 rounded-md px-3 pb-4 pt-5 text-center ring-1 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#472a3b] ${checked ? 'bg-[#472a3b] text-white ring-[#472a3b]' : 'bg-white text-[#472a3b] ring-[#dce2e8] hover:ring-[#9aa9ba]'
                            }`}
                          key={option.label}
                        >
                          <input checked={checked} className="sr-only" name="size" onChange={() => setSize(option.label)} type="radio" value={value} />
                          <svg aria-hidden="true" className={`${option.icon} ${checked ? 'text-[#ffb84d]' : 'text-[#b8721e]'}`} fill="none" viewBox="0 0 24 24">
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
                          className={`inline-flex cursor-pointer items-center gap-2.5 rounded-md py-2 pl-2 pr-4 text-sm font-bold ring-1 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#472a3b] ${checked ? 'bg-[#fff7cc] text-[#472a3b] ring-[#b8721e]' : 'bg-white text-[#65748a] ring-[#dce2e8] hover:ring-[#9aa9ba]'
                            }`}
                          key={option.label}
                        >
                          <input checked={checked} className="sr-only" name="flavor" onChange={() => setFlavor(option.label)} type="radio" value={value} />
                          <span aria-hidden="true" className={`size-6 rounded-full ring-2 ring-white ${option.swatch} ${checked ? 'outline outline-2 outline-[#b8721e]' : 'outline outline-1 outline-[#dce2e8]'}`} />
                          {value}
                        </label>
                      )
                    })}
                  </div>
                </fieldset>

                <fieldset className="mt-7">
                  <legend className={labelClass}>{t('Toppings')} <span className="font-semibold normal-case tracking-normal text-[#65748a]">({t('optional')})</span></legend>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {toppingOptions.map((topping) => {
                      const checked = toppings.includes(topping)
                      return (
                        <label
                          className={`inline-flex cursor-pointer items-center gap-2 rounded-md px-4 py-2.5 text-sm font-bold ring-1 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#472a3b] ${checked ? 'bg-[#472a3b] text-white ring-[#472a3b]' : 'bg-white text-[#65748a] ring-[#dce2e8] hover:ring-[#9aa9ba]'
                            }`}
                          key={topping}
                        >
                          <input
                            checked={checked}
                            className="sr-only"
                            onChange={(event) => setToppings((current) => event.target.checked ? [...current, topping] : current.filter((value) => value !== topping))}
                            type="checkbox"
                          />
                          <span aria-hidden="true" className={`grid size-4 place-items-center rounded-full transition ${checked ? 'bg-[#ffb84d] text-[#472a3b]' : 'ring-1 ring-[#c9c3b4]'}`}>
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
                    <span className={labelClass}>{t('Message on cake or special instructions')} <span className="font-semibold normal-case tracking-normal text-[#65748a]">({t('optional')})</span></span>
                    <span className="shrink-0 text-[13px] font-semibold tabular-nums text-[#65748a]">{messageLength} / 200</span>
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
              <section aria-labelledby="cake-pickup-heading" className="mt-12">
                {stepHeading('Pickup details', 'Where and when to collect it', 'cake-pickup-heading')}
                <fieldset className="mt-6">
                  <legend className={labelClass}>{t('Selected store')} <span className="text-[#b8721e]">*</span></legend>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {stores.map((store) => {
                      const checked = String(store.storeId) === selectedStoreId
                      return (
                        <label
                          className={`flex min-w-0 cursor-pointer items-center gap-3 rounded-md p-3 ring-1 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#472a3b] ${checked ? 'bg-[#fff7cc] ring-[#b8721e]' : 'bg-white ring-[#dce2e8] hover:ring-[#9aa9ba]'
                            }`}
                          key={store.storeId}
                        >
                          <input checked={checked} className="sr-only" name="storeId" onChange={() => setSelectedStoreId(String(store.storeId))} required type="radio" value={store.storeId} />
                          <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-md transition ${checked ? 'bg-[#472a3b] text-[#ffb84d]' : 'bg-[#e9edf1] text-[#65748a]'}`}>
                            <svg className="size-[18px]" fill="none" viewBox="0 0 24 24">
                              <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 1 1 13 0c0 5.4-6.5 11-6.5 11Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
                              <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.8" />
                            </svg>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-extrabold text-[#472a3b]">{t(store.storeName)}</span>
                            <span className="mt-0.5 block truncate text-[13px] font-semibold text-[#65748a]">{t(store.storeAddress || store.location)}</span>
                          </span>
                          <span aria-hidden="true" className={`grid size-5 shrink-0 place-items-center rounded-full ring-2 ${checked ? 'bg-[#472a3b] ring-[#472a3b]' : 'ring-[#ddd6c4]'}`}>
                            {checked && <span className="size-2 rounded-full bg-[#ffb84d]" />}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </fieldset>
                <label className="mt-6 block sm:max-w-xs">
                  <span className={labelClass}>{t('Pickup date')} <span className="text-[#b8721e]">*</span></span>
                  <input className={fieldClass} max={maxPickupDate} min={minPickupDate} name="pickupDate" onChange={(event) => setPickupDate(event.target.value)} required type="date" />
                </label>
              </section>

              {/* Step 3 */}
              <section aria-labelledby="cake-contact-heading" className="mt-12">
                {stepHeading('Your contact details', 'So the store can reach you', 'cake-contact-heading')}
                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <label className="block">
                    <span className={labelClass}>{t('Full name')} <span className="text-[#b8721e]">*</span></span>
                    <input autoComplete="name" className={fieldClass} defaultValue={customer?.name || ''} maxLength={100} name="name" required />
                  </label>
                  <label className="block">
                    <span className={labelClass}>{t('Email address')} <span className="text-[#b8721e]">*</span></span>
                    <input autoComplete="email" className={fieldClass} defaultValue={customer?.email || ''} maxLength={254} name="email" required type="email" />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className={labelClass}>{t('Phone number')} <span className="text-[#b8721e]">*</span></span>
                    <input autoComplete="tel" className={fieldClass} defaultValue={customer?.phone || ''} maxLength={40} name="phone" required type="tel" />
                  </label>
                </div>
              </section>

              {(error || storeError) && (
                <p className="mt-8 flex gap-3 rounded-md bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-100" role="alert">
                  <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center rounded-full bg-red-100 text-[13px] font-extrabold">!</span>
                  {error || storeError}
                </p>
              )}
              {!storeError && !stores.length && (
                <p className="mt-8 rounded-md bg-[#fff7cc] p-4 text-sm text-[#624f00]" role="status">{t('No pickup locations are available right now. Please try again later.')}</p>
              )}
              {success && (
                <p className="mt-8 flex items-start gap-3 rounded-md bg-[#edf5ea] p-5 text-sm font-semibold leading-6 text-[#274d20]" role="status">
                  <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-[#4caf50] text-white">
                    <svg className="size-4" fill="none" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" /></svg>
                  </span>
                  {success}
                </p>
              )}

              <div className="mt-10 flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-6 text-[#65748a]">{t('We’ll be in touch to confirm your request.')}</p>
                <button
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#472a3b] px-8 py-3 text-sm font-extrabold text-white transition-colors hover:bg-[#6b3f58] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8721e] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isSubmitting || !stores.length || Boolean(storeError)}
                  type="submit"
                >
                  {isSubmitting ? t('Sending…') : t('Send cake request')}
                  {!isSubmitting && <ArrowIcon />}
                </button>
              </div>
            </form>

            {/* Live summary */}
            <aside className="space-y-8 lg:sticky lg:top-[calc(var(--site-header-offset,0px)+2rem)] lg:transition-[top] lg:duration-300 lg:col-span-4">
              <div className="overflow-hidden bg-[#472a3b] text-white">
                <div className="aspect-[16/10] overflow-hidden bg-[#6b3f58]">
                  <img
                    alt={t(previewCake.name)}
                    className="size-full object-cover"
                    decoding="async"
                    loading="lazy"
                    sizes="(min-width: 1024px) 30vw, 90vw"
                    src={thumbnail(previewCake.photo)}
                    srcSet={photoSrcSet(previewCake.photo)}
                  />
                </div>
                <div className="px-6 pb-5 pt-6">
                  <h2 className="font-display text-2xl font-extrabold">{t('Your cake')}</h2>
                  <p className="mt-1.5 text-base font-semibold text-white/80">{t('Your celebration, your cake')}</p>
                </div>
                <dl aria-live="polite" className="bg-[#6b3f58] px-6">
                  {[
                    { label: 'Cake size', value: t(size) },
                    { label: 'Cake flavor', value: t(flavor) },
                    { label: 'Toppings', value: toppings.length ? toppings.map((topping) => t(topping)).join(', ') : t('None') },
                    { label: 'Selected store', value: selectedStore ? t(selectedStore.storeName) : '' },
                    { label: 'Pickup date', value: formatDate(pickupDate) },
                  ].map((row) => (
                    <div className="flex items-start justify-between gap-4 py-3.5" key={row.label}>
                      <dt className="text-[13px] font-semibold text-white/60">{t(row.label)}</dt>
                      <dd className={`text-right text-sm font-extrabold ${row.value ? 'text-white' : 'text-white/35'}`}>{row.value || t('Not selected yet')}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <ol className="space-y-6">
                {[
                  { title: 'Tell us what you love', detail: 'Choose a size, flavor and toppings.' },
                  { title: 'Pick a store and date', detail: 'Select a pickup location and preferred day.' },
                  { title: 'Pay the deposit to book it', detail: 'The store sends a quote. Pay the deposit to hold the cake and pickup date.' },
                ].map((step) => (
                  <li key={step.title}>
                    <div>
                      <h3 className="text-base font-extrabold text-[#472a3b]">{t(step.title)}</h3>
                      <p className="mt-1 text-base leading-7 text-[#33455c]">{t(step.detail)}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="bg-[#fff1b8] p-5 text-[#472a3b]">
                <p className="text-base font-extrabold">{t('Please note')}</p>
                <p className="mt-2 text-base leading-7">{t('Sending this form is a request. The store will send a quote. The cake is booked when you pay the deposit.')}</p>
              </div>

              <dl className="grid grid-cols-2 gap-x-6 gap-y-6">
                {[
                  { label: 'Order at least', value: t('48 hours ahead') },
                  { label: 'Cakes are', value: t('Made to order') },
                  { label: 'Booking', value: t('Deposit required') },
                  { label: 'Serves', value: t('8 to 20 people') },
                ].map((fact) => (
                  <div key={fact.label}>
                    <dt className="text-base font-semibold text-[#33455c]">{t(fact.label)}</dt>
                    <dd className="mt-1 font-display text-lg font-extrabold text-[#472a3b]">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </aside>
          </div>

          {(payTokenRequest || quotes.length > 0) && (
            <div className="mx-auto mt-4 max-w-[1320px] px-5 pb-16 sm:px-8 lg:px-12">
              <h2 className="font-display text-2xl font-extrabold text-[#472a3b]">{t('Your cake quotes')}</h2>
              <ul className="mt-5 grid gap-4 md:grid-cols-2">
                {(payTokenRequest ? [payTokenRequest, ...quotes.filter((quote) => quote.id !== payTokenRequest.id)] : quotes).map((quote) => (
                  <li className="bg-white p-5 ring-1 ring-[#dce2e8]" key={quote.id}>
                    <p className="text-sm font-extrabold text-[#65748a]">#{quote.id}</p>
                    <h3 className="mt-1 font-display text-lg font-extrabold text-[#472a3b]">{t(quote.size)} {t(quote.flavor)}</h3>
                    <p className="mt-1 text-base text-[#65748a]">{t('Pickup date')}: {formatDate(quote.pickupDate)}{quote.storeName ? ` · ${t(quote.storeName)}` : ''}</p>
                    <p className="mt-3 inline-flex rounded-md bg-[#e9edf1] px-3 py-1.5 text-sm font-bold text-[#315982]">{t(CAKE_STATUS[quote.status] || quote.status)}</p>
                    {quote.quotedTotal && (
                      <p className="mt-3 text-sm font-extrabold text-[#472a3b]">
                        {t('Total')}: {formatXaf(quote.quotedTotal, language)}
                        {quote.depositAmount ? ` · ${t('Deposit')}: ${formatXaf(quote.depositAmount, language)}` : ''}
                      </p>
                    )}
                    {quote.adminNote && <p className="mt-2 text-base leading-7 text-[#5c4a00]">{quote.adminNote}</p>}
                    {quote.status === 'contacted' && quote.depositAmount && (
                      <div className="mt-4">
                        <div className="grid grid-cols-2 gap-2">
                          {methods.card && (
                            <button className={`rounded-md px-4 py-3 text-sm font-extrabold ${payMethod === 'card' ? 'bg-[#472a3b] text-white' : 'bg-[#e9edf1] text-[#472a3b]'}`} onClick={() => setPayMethod('card')} type="button">{t('Card')}</button>
                          )}
                          {methods.campayMobileMoney && (
                            <button className={`rounded-md px-4 py-3 text-sm font-extrabold ${payMethod === 'campay' ? 'bg-[#472a3b] text-white' : 'bg-[#e9edf1] text-[#472a3b]'}`} onClick={() => setPayMethod('campay')} type="button">{t('Mobile Money')}</button>
                          )}
                        </div>
                        {payMethod === 'campay' && (
                          <input className="mt-3 w-full rounded-md bg-white px-4 py-3 text-sm ring-1 ring-[#dce2e8] focus:outline-none focus:ring-2 focus:ring-[#b8721e]" onChange={(event) => setPayPhone(event.target.value)} placeholder="6XX XX XX XX" type="tel" value={payPhone} />
                        )}
                        {payError && payingId === quote.id && <p className="mt-2 text-sm font-semibold text-red-700">{payError}</p>}
                        <button
                          className="mt-3 w-full rounded-md bg-[#ffb84d] px-5 py-3 text-sm font-extrabold text-[#472a3b] transition-colors hover:bg-[#ffcf85] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#472a3b] focus-visible:ring-offset-2 disabled:opacity-60"
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
