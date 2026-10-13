import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Footer, Header } from '../../../components/Layout'
import { apiRequest } from '../../../api/api'
import { useLanguage } from '../../../language/LanguageContext'

const inputClassName = 'mt-2 w-full rounded-xl border border-[#d9d6cc] bg-[#fbfaf5] px-4 py-3.5 text-sm font-normal text-[#102c50] outline-none transition placeholder:text-[#9aa4b1] focus:border-[#bd9c00] focus:bg-white focus:ring-2 focus:ring-[#ffdc32]/40'

interface ContactFormData {
  name: string
  email: string
  phone: string
  storeId: string
  subject: string
  message: string
}

interface ContactStore {
  storeId: number
  storeName: string
  storeTown: string
  storeArea: string
}

interface FulfillmentZone extends ContactStore {
  pickupEnabled: boolean
  deliveryEnabled: boolean
}

export function ContactPage() {
  const { t } = useLanguage()
  const [form, setForm] = useState<ContactFormData>({ name: '', email: '', phone: '', storeId: '', subject: '', message: '' })
  const [stores, setStores] = useState<ContactStore[]>([])
  const [isLoadingStores, setIsLoadingStores] = useState(true)
  const [storesError, setStoresError] = useState('')
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    apiRequest<{ zones: FulfillmentZone[] }>('/fulfillment/options')
      .then((result) => {
        if (!cancelled) {
          setStores(result.zones
            .filter((zone) => zone.pickupEnabled || zone.deliveryEnabled)
            .map(({ storeId, storeName, storeTown, storeArea }) => ({ storeId, storeName, storeTown, storeArea })))
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setStoresError(loadError instanceof Error ? loadError.message : t('Unable to load stores.'))
      })
      .finally(() => {
        if (!cancelled) setIsLoadingStores(false)
      })
    return () => {
      cancelled = true
    }
  }, [t])

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = event.target
    setForm((currentForm) => ({ ...currentForm, [name as keyof ContactFormData]: value }))
    setSubmitted(false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitted(false)
    setIsSubmitting(true)
    try {
      await apiRequest('/contact', { method: 'POST', body: { ...form, storeId: Number(form.storeId) } })
      setForm({ name: '', email: '', phone: '', storeId: '', subject: '', message: '' })
      setSubmitted(true)
    } catch (submitError) {
      setError(t(submitError instanceof Error ? submitError.message : 'Unable to send your message.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white text-[#102c50]">
      <Header />
      <main>
        <section className="relative isolate overflow-hidden bg-[#092a53] text-white">
          <div aria-hidden="true" className="absolute -right-24 -top-44 size-[30rem] rounded-full border-[70px] border-white/[0.04]" />
          <div className="relative mx-auto max-w-[1160px] px-5 py-14 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
            <div className="max-w-3xl">
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#ffdc32]">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-[#ffdc32]" />
                {t('We’d love to hear from you')}
              </p>
              <h1 className="font-display text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">{t('Contact us')}</h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/75 sm:text-lg sm:leading-8">
                {t('Have a question for a store? Choose its branch and send a message directly to that store’s team.')}
              </p>
            </div>
          </div>
        </section>

        <section className="bg-[#fbfaf5] px-5 py-12 sm:px-8 sm:py-16 lg:px-12 lg:py-20">
          <div className="mx-auto grid max-w-[1160px] items-start gap-6 lg:grid-cols-[0.78fr_1.22fr] lg:gap-8">
            <aside className="relative isolate overflow-hidden rounded-[24px] bg-[#092a53] p-6 text-white sm:p-8 lg:sticky lg:top-8">
              <div aria-hidden="true" className="absolute -bottom-20 -right-20 size-56 rounded-full border-[38px] border-white/[0.04]" />
              <div className="relative">
                <span aria-hidden="true" className="grid size-12 place-items-center rounded-2xl bg-[#ffdc32] text-xl text-[#092a53]">✉</span>
                <h2 className="mt-6 font-display text-2xl font-bold sm:text-3xl">{t('Say hello')}</h2>
                <p className="mt-3 text-sm leading-6 text-white/70">
                  {t('Choose a store and your message will be routed to that store’s admin team.')}
                </p>

                <div className="mt-8 space-y-5">
                  <div className="flex gap-3 border-t border-white/15 pt-5">
                    <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10 text-[#ffdc32]">◎</span>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#ffdc32]">{t('Local social page')}</p>
                      <a className="mt-1 inline-block text-sm font-semibold text-white transition hover:text-[#ffdc32]" href="https://www.instagram.com/coldstonecameroon/" rel="noreferrer" target="_blank">{t('Cold Stone Cameroon on Instagram')}</a>
                    </div>
                  </div>
                  <div className="flex gap-3 border-t border-white/15 pt-5">
                    <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10 text-[#ffdc32]">↗</span>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#ffdc32]">{t('Our story')}</p>
                      <Link className="mt-1 inline-block text-sm font-semibold text-white transition hover:text-[#ffdc32]" to="/about">{t('Read about this guide →')}</Link>
                    </div>
                  </div>
                </div>
                <p className="mt-8 rounded-2xl border border-white/15 bg-white/[0.06] p-4 text-xs leading-5 text-white/65">
                  {t('For current store information, please contact a local branch through its public listing.')}
                </p>
              </div>
            </aside>

            <section className="rounded-[24px] border border-[#e7e3d9] bg-white p-5 shadow-[0_12px_40px_rgba(18,44,80,0.07)] sm:p-8 lg:p-10">
              <div className="border-b border-[#e7e3d9] pb-5 sm:pb-6">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#a48700]">{t('Contact a store')}</p>
                <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">{t('Send us a message')}</h2>
                <p className="mt-2 text-sm leading-6 text-[#65748a]">{t('Choose the store you want to contact. Only that store’s admin team will receive your message.')}</p>
              </div>
              <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
                <label className="block text-sm font-semibold">
                  {t('Choose a store')}
                  <select className={inputClassName} disabled={isLoadingStores || stores.length === 0} name="storeId" onChange={handleChange} required value={form.storeId}>
                    <option value="">{isLoadingStores ? t('Loading stores…') : t('Select the store you want to contact')}</option>
                    {stores.map((store) => (
                      <option key={store.storeId} value={store.storeId}>
                        {t(store.storeName)} · {t(store.storeTown)}{store.storeArea ? ` — ${t(store.storeArea)}` : ''}
                      </option>
                    ))}
                  </select>
                  {storesError && <span className="mt-2 block text-sm font-normal text-red-700" role="alert">{storesError}</span>}
                  {!isLoadingStores && !storesError && stores.length === 0 && <span className="mt-2 block text-sm font-normal text-[#65748a]">{t('No active stores are available right now.')}</span>}
                </label>
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="block text-sm font-semibold">
                    {t('Your name')}
                    <input autoComplete="name" className={inputClassName} maxLength={100} name="name" onChange={handleChange} placeholder={t('Enter your name')} required value={form.name} />
                  </label>
                  <label className="block text-sm font-semibold">
                    {t('Email address')}
                    <input autoComplete="email" className={inputClassName} maxLength={254} name="email" onChange={handleChange} placeholder={t('you@example.com')} required type="email" value={form.email} />
                  </label>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="block text-sm font-semibold">
                    {t('Phone number')} <span className="font-normal text-[#8792a0]">{t('(optional)')}</span>
                    <input autoComplete="tel" className={inputClassName} maxLength={40} name="phone" onChange={handleChange} placeholder={t('Add a phone number if you prefer')} type="tel" value={form.phone} />
                  </label>
                  <label className="block text-sm font-semibold">
                    {t('Subject')}
                    <input className={inputClassName} maxLength={150} name="subject" onChange={handleChange} placeholder={t('What is your message about?')} required value={form.subject} />
                  </label>
                </div>
                <label className="block text-sm font-semibold">
                  {t('Message')}
                  <textarea className={`${inputClassName} min-h-40 resize-y`} maxLength={5000} name="message" onChange={handleChange} placeholder={t('Write your message here…')} required value={form.message} />
                </label>
                {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}
                {submitted && <p className="rounded-xl bg-[#eaf5d8] px-4 py-3 text-sm text-[#274d20]" role="status">{t('Thanks for reaching out. Your message has been sent to our team.')}</p>}
                <div className="flex flex-col gap-3 border-t border-[#e7e3d9] pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs leading-5 text-[#8792a0]">{t('Please complete all required fields before sending.')}</p>
                  <button className="inline-flex items-center justify-center gap-2 rounded-full bg-[#ffdc32] px-7 py-3.5 text-sm font-bold text-[#092a53] transition hover:-translate-y-0.5 hover:bg-[#ffe76c] disabled:cursor-wait disabled:opacity-60" disabled={isSubmitting || isLoadingStores || stores.length === 0} type="submit">
                    {isSubmitting ? t('Sending message…') : t('Send message')}
                    {!isSubmitting && <span aria-hidden="true">→</span>}
                  </button>
                </div>
              </form>
            </section>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
