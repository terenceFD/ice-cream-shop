import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest, CUSTOMER_TOKEN_KEY } from '../../../api/api'
import { useAuth } from '../../../authcontext/useAuth'
import { Footer, Header } from '../../../components/Layout'
import { useLanguage } from '../../../language/useLanguage'
import { getCameroonDate } from '../../../../shared/cameroonDate'

const inputClass = 'mt-2 w-full rounded-xl border border-[#e2e3e4] bg-[#fcfcfb] px-4 py-3.5 text-sm text-[#102c50] shadow-sm transition placeholder:text-[#9aa3ae] hover:border-[#bdc5cf] focus:border-[#bd9c00] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#ffdc32]/20'
const toppingOptions = ['Sprinkles', 'Chocolate chips', 'Fresh fruit', 'Cookie pieces', 'Whipped cream']

export function CustomCakeRequestPage() {
  const { customer } = useAuth()
  const { t } = useLanguage()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toppings, setToppings] = useState<string[]>([])
  const [stores, setStores] = useState<{ storeId: number; storeName: string; storeAddress: string; location: string; pickupEnabled: boolean }[]>([])
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [storeError, setStoreError] = useState('')
  const [minPickupDate] = useState(() => getCameroonDate())
  const [maxPickupDate] = useState(() => getCameroonDate(90))

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
        token: sessionStorage.getItem(CUSTOMER_TOKEN_KEY) || undefined,
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
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to send cake request.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#fbfaf5] text-[#102c50]">
      <Header />
      <main>
        <section className="relative isolate overflow-hidden bg-[#092a53] text-white">
          <div aria-hidden="true" className="absolute -right-40 -top-48 size-[34rem] rounded-full border-[70px] border-white/[0.035]" />
          <div aria-hidden="true" className="absolute -bottom-52 -left-32 size-[27rem] rounded-full border-[55px] border-[#ffdc32]/[0.08]" />
          <div className="relative mx-auto grid max-w-[1320px] items-center gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[1fr_0.9fr] lg:gap-14 lg:px-12 lg:py-20">
            <div className="relative z-10 max-w-2xl">
              <Link className="inline-flex items-center gap-2 text-sm font-semibold text-white/70 transition hover:text-[#ffdc32]" to="/menu">
                <span aria-hidden="true">←</span>{t('Back to menu')}
              </Link>
              <p className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#ffdc32] sm:text-[11px]">
                <span aria-hidden="true" className="text-sm">✦</span>{t('Made for your celebration')}
              </p>
              <h1 className="mt-5 max-w-xl font-display text-4xl font-extrabold leading-[1.06] tracking-tight sm:text-5xl lg:text-6xl">
                {t('Custom cake request')}
              </h1>
              <p className="mt-5 max-w-xl text-sm leading-7 text-white/75 sm:text-base sm:leading-8">
                {t('Choose your cake details and requested pickup date. This is a request, not a confirmed order; the store will contact you about availability and pricing.')}
              </p>
              <a className="mt-7 inline-flex items-center justify-center gap-3 rounded-full bg-[#ffdc32] px-6 py-3.5 text-sm font-extrabold text-[#092a53] shadow-[0_12px_28px_rgba(255,220,50,0.17)] transition hover:-translate-y-0.5 hover:bg-[#ffe76c] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40" href="#cake-request-form">
                {t('Start your request')}<span aria-hidden="true">↓</span>
              </a>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-white/75 sm:text-sm">
                <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="grid size-6 place-items-center rounded-full bg-white/10 text-[#ffdc32]">✓</span>{t('Made for your celebration')}</span>
                <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="grid size-6 place-items-center rounded-full bg-white/10 text-[#ffdc32]">✓</span>{t('Choose your cake details')}</span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[570px] pb-6 pr-5 sm:pb-8 sm:pr-8">
              <div aria-hidden="true" className="absolute bottom-0 right-0 h-[72%] w-[73%] rounded-[30px] bg-[#ffdc32] sm:rounded-[38px]" />
              <img
                alt={t('Custom celebration cake')}
                className="relative z-10 aspect-[1.2] w-full rounded-[26px] object-cover shadow-[0_24px_70px_rgba(0,0,0,0.28)] sm:rounded-[34px]"
                src="/cake-images/cake-1.webp"
              />
              <img
                alt=""
                aria-hidden="true"
                className="absolute -right-1 top-5 z-20 size-20 rounded-2xl border-4 border-[#092a53] object-cover shadow-xl sm:-right-2 sm:top-8 sm:size-28"
                src="/cake-images/cake-3.webp"
              />
              <div className="absolute -bottom-1 left-0 z-20 flex max-w-[250px] items-center gap-3 rounded-2xl border border-[#e7e3d9] bg-white p-3 text-[#102c50] shadow-[0_14px_35px_rgba(0,0,0,0.2)] sm:-left-4 sm:max-w-[300px] sm:p-4">
                <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#fff3b8] text-xl text-[#806a00] sm:size-14">✦</span>
                <div>
                  <p className="text-[9px] font-extrabold uppercase tracking-[0.13em] text-[#806a00]">{t('A treat made your way')}</p>
                  <p className="mt-1 text-xs font-bold leading-5 sm:text-sm">{t('Share your ideas and we’ll help bring your celebration cake to life.')}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-5 py-10 sm:px-8 sm:py-14 lg:px-12 lg:py-16">
          <div className="mx-auto grid max-w-[1160px] items-start gap-7 lg:grid-cols-[0.72fr_1.28fr] lg:gap-10">
            <aside className="space-y-5 lg:sticky lg:top-8">
              <div className="rounded-[24px] border border-[#e7e3d9] bg-white p-6 shadow-[0_12px_35px_rgba(16,44,80,0.05)] sm:p-7">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#a48700]">{t('Your celebration, your cake')}</p>
                <h2 className="mt-3 font-display text-2xl font-extrabold leading-tight sm:text-3xl">{t('Let’s make it memorable.')}</h2>
                <p className="mt-3 text-sm leading-6 text-[#65748a]">{t('Share the details that matter most. The selected store will follow up to confirm availability and pricing.')}</p>
                <div className="mt-6 space-y-4 border-t border-[#eeeae1] pt-5">
                  {[
                    { number: '01', title: 'Tell us what you love', detail: 'Choose a size, flavor and toppings.' },
                    { number: '02', title: 'Pick a store and date', detail: 'Select a pickup location and preferred day.' },
                    { number: '03', title: 'We’ll confirm the details', detail: 'The store will contact you before your request is confirmed.' },
                  ].map((step) => (
                    <div className="flex gap-3" key={step.number}>
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#fff5c8] text-xs font-extrabold text-[#806a00]">{step.number}</span>
                      <div>
                        <h3 className="text-sm font-bold">{t(step.title)}</h3>
                        <p className="mt-1 text-xs leading-5 text-[#65748a]">{t(step.detail)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-[#eadb8a] bg-[#fff9dc] p-5 text-sm leading-6 text-[#624f00]">
                <p className="font-extrabold">{t('Please note')}</p>
                <p className="mt-1">{t('Sending this form is a request only. Your order is not confirmed until the store contacts you.')}</p>
              </div>
            </aside>

            <form className="scroll-mt-6 rounded-[24px] border border-[#e7e3d9] bg-white p-5 shadow-[0_16px_45px_rgba(16,44,80,0.07)] sm:p-8 lg:p-9" id="cake-request-form" onSubmit={submitRequest}>
              <div className="mb-7 border-b border-[#eeeae1] pb-6">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#a48700]">{t('A few details to get started')}</p>
                <h2 className="mt-2 font-display text-2xl font-extrabold sm:text-3xl">{t('Tell us about your cake')}</h2>
                <p className="mt-2 text-sm leading-6 text-[#65748a]">{t('Fields marked with an asterisk are required.')}</p>
              </div>

              <section aria-labelledby="cake-contact-heading">
                <h3 className="mb-4 flex items-center gap-3 text-sm font-extrabold" id="cake-contact-heading">
                  <span className="grid size-8 place-items-center rounded-xl bg-[#092a53] text-xs text-[#ffdc32]">1</span>{t('Your contact details')}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-semibold">{t('Full name')} <span className="text-[#a48700]">*</span><input autoComplete="name" className={inputClass} defaultValue={customer?.name || ''} maxLength={100} name="name" required /></label>
                  <label className="text-sm font-semibold">{t('Email address')} <span className="text-[#a48700]">*</span><input autoComplete="email" className={inputClass} defaultValue={customer?.email || ''} maxLength={254} name="email" required type="email" /></label>
                  <label className="text-sm font-semibold sm:col-span-2">{t('Phone number')} <span className="text-[#a48700]">*</span><input autoComplete="tel" className={inputClass} defaultValue={customer?.phone || ''} maxLength={40} name="phone" required type="tel" /></label>
                </div>
              </section>

              <section aria-labelledby="cake-design-heading" className="mt-8 border-t border-[#eeeae1] pt-7">
                <h3 className="mb-4 flex items-center gap-3 text-sm font-extrabold" id="cake-design-heading">
                  <span className="grid size-8 place-items-center rounded-xl bg-[#092a53] text-xs text-[#ffdc32]">2</span>{t('Design your cake')}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-semibold">{t('Cake size')}
                    <select className={inputClass} name="size"><option>{t('Small')}</option><option>{t('Medium')}</option><option>{t('Large')}</option></select>
                  </label>
                  <label className="text-sm font-semibold">{t('Cake flavor')}
                    <select className={inputClass} name="flavor"><option>{t('Vanilla')}</option><option>{t('Chocolate')}</option><option>{t('Strawberry')}</option><option>{t('Mango')}</option><option>{t('Custom flavor — tell us below')}</option></select>
                  </label>
                </div>
                <fieldset className="mt-5">
                  <legend className="text-sm font-semibold">{t('Toppings')} <span className="font-normal text-[#8792a0]">({t('optional')})</span></legend>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {toppingOptions.map((topping) => (
                      <label className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-sm transition ${toppings.includes(topping) ? 'border-[#bd9c00] bg-[#fff9dc] text-[#102c50]' : 'border-[#e7e3d9] bg-[#fcfcfb] text-[#52647b] hover:border-[#c9c5b8] hover:bg-[#fbfaf5]'}`} key={topping}>
                        <input checked={toppings.includes(topping)} className="size-4 accent-[#bd9c00]" onChange={(event) => setToppings((current) => event.target.checked ? [...current, topping] : current.filter((value) => value !== topping))} type="checkbox" />
                        {t(topping)}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="mt-5 block text-sm font-semibold">{t('Message on cake or special instructions')} <span className="font-normal text-[#8792a0]">({t('optional')})</span>
                  <textarea className={`${inputClass} resize-y`} maxLength={200} name="message" placeholder={t('Add a message or any details you’d like us to know.')} rows={4} />
                  <span className="mt-1.5 block text-right text-xs font-normal text-[#8792a0]">{t('Maximum 200 characters')}</span>
                </label>
              </section>

              <section aria-labelledby="cake-pickup-heading" className="mt-8 border-t border-[#eeeae1] pt-7">
                <h3 className="mb-4 flex items-center gap-3 text-sm font-extrabold" id="cake-pickup-heading">
                  <span className="grid size-8 place-items-center rounded-xl bg-[#092a53] text-xs text-[#ffdc32]">3</span>{t('Pickup details')}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-semibold">{t('Selected store')} <span className="text-[#a48700]">*</span>
                    <select className={inputClass} name="storeId" onChange={(event) => setSelectedStoreId(event.target.value)} required value={selectedStoreId}>
                      {stores.map((store) => <option key={store.storeId} value={store.storeId}>{t(store.storeName)}{store.storeAddress ? ` · ${t(store.storeAddress)}` : ` · ${t(store.location)}`}</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-semibold">{t('Pickup date')} <span className="text-[#a48700]">*</span>
                    <input className={inputClass} max={maxPickupDate} min={minPickupDate} name="pickupDate" required type="date" />
                  </label>
                </div>
              </section>

              {(error || storeError) && <p className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">{error || storeError}</p>}
              {!storeError && !stores.length && <p className="mt-6 rounded-xl border border-[#eadb8a] bg-[#fff9dc] p-4 text-sm text-[#624f00]" role="status">{t('No pickup locations are available right now. Please try again later.')}</p>}
              {success && <p className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800" role="status">{success}</p>}
              <div className="mt-7 flex flex-col gap-3 border-t border-[#eeeae1] pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-[#65748a]">{t('We’ll be in touch to confirm your request.')}</p>
                <button className="inline-flex w-full items-center justify-center gap-3 rounded-full bg-[#ffdc32] px-7 py-3.5 text-sm font-extrabold text-[#092a53] shadow-[0_8px_22px_rgba(189,156,0,0.17)] transition hover:-translate-y-0.5 hover:bg-[#ffe76c] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#ffdc32]/40 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto" disabled={isSubmitting || !stores.length || Boolean(storeError)} type="submit">
                  {isSubmitting ? t('Sending…') : t('Send cake request')}<span aria-hidden="true">→</span>
                </button>
              </div>
            </form>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
