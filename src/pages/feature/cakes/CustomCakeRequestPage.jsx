import { useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest, CUSTOMER_TOKEN_KEY } from '../../../api/api'
import { useAuth } from '../../../authcontext/AuthContext'
import { Footer, Header } from '../../../components/Layout'
import { useLanguage } from '../../../language/LanguageContext'
import { getCameroonDate } from '../../../../shared/cameroonDate'

const inputClass = 'mt-1.5 w-full rounded-xl border border-[#d9d6cc] bg-white px-4 py-3 text-sm'
const toppingOptions = ['Sprinkles', 'Chocolate chips', 'Fresh fruit', 'Cookie pieces', 'Whipped cream']

export function CustomCakeRequestPage() {
  const { customer } = useAuth()
  const { t } = useLanguage()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toppings, setToppings] = useState([])
  const [minPickupDate] = useState(() => getCameroonDate())
  const [maxPickupDate] = useState(() => getCameroonDate(90))

  async function submitRequest(event) {
    event.preventDefault()
    const formElement = event.currentTarget
    setError('')
    setSuccess('')
    setIsSubmitting(true)
    const form = new FormData(event.currentTarget)
    try {
      const result = await apiRequest('/cake-requests', {
        method: 'POST',
        token: sessionStorage.getItem(CUSTOMER_TOKEN_KEY) || undefined,
        body: {
          name: form.get('name'),
          email: form.get('email'),
          phone: form.get('phone'),
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
      setError(submitError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f7f2] text-[#102c50]">
      <Header />
      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <Link className="text-sm font-semibold underline" to="/menu">← {t('Back to menu')}</Link>
        <p className="mt-6 inline-block rounded-full bg-[#ffeb9c] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em]">{t('Made for your celebration')}</p>
        <h1 className="mt-3 font-display text-4xl font-bold sm:text-5xl">{t('Custom cake request')}</h1>
        <p className="mt-3 text-sm leading-6 text-[#65748a]">{t('Choose your cake details and requested pickup date. This is a request, not a confirmed order; the store will contact you about availability and pricing.')}</p>
        <form className="mt-7 space-y-5 rounded-3xl border border-[#d9d6cc] bg-white p-5 sm:p-8" onSubmit={submitRequest}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">{t('Full name')}<input autoComplete="name" className={inputClass} defaultValue={customer?.name || ''} maxLength={100} name="name" required /></label>
            <label className="text-sm font-semibold">{t('Email address')}<input autoComplete="email" className={inputClass} defaultValue={customer?.email || ''} maxLength={254} name="email" required type="email" /></label>
            <label className="text-sm font-semibold">{t('Phone number')}<input autoComplete="tel" className={inputClass} defaultValue={customer?.phone || ''} maxLength={40} name="phone" required type="tel" /></label>
            <label className="text-sm font-semibold">{t('Pickup date')}<input className={inputClass} max={maxPickupDate} min={minPickupDate} name="pickupDate" required type="date" /></label>
            <label className="text-sm font-semibold">{t('Cake size')}
              <select className={inputClass} name="size"><option>{t('Small')}</option><option>{t('Medium')}</option><option>{t('Large')}</option></select>
            </label>
            <label className="text-sm font-semibold">{t('Cake flavor')}
              <select className={inputClass} name="flavor"><option>{t('Vanilla')}</option><option>{t('Chocolate')}</option><option>{t('Strawberry')}</option><option>{t('Mango')}</option><option>{t('Custom flavor — tell us below')}</option></select>
            </label>
          </div>
          <fieldset>
            <legend className="text-sm font-bold">{t('Toppings')}</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {toppingOptions.map((topping) => <label className="flex items-center gap-2 text-sm" key={topping}>
                <input checked={toppings.includes(topping)} onChange={(event) => setToppings((current) => event.target.checked ? [...current, topping] : current.filter((value) => value !== topping))} type="checkbox" />
                {t(topping)}
              </label>)}
            </div>
          </fieldset>
          <label className="block text-sm font-semibold">{t('Message on cake or special instructions')}<textarea className={inputClass} maxLength={200} name="message" rows={3} /></label>
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
          {success && <p className="rounded-xl bg-green-50 p-3 text-sm text-green-800" role="status">{success}</p>}
          <button className="rounded-full bg-[#ffdc32] px-6 py-3 font-bold disabled:opacity-50" disabled={isSubmitting} type="submit">{isSubmitting ? t('Sending…') : t('Send cake request')}</button>
        </form>
      </main>
      <Footer />
    </div>
  )
}
