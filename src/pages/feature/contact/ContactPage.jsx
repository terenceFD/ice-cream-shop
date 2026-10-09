import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Footer, Header } from '../../../components/Layout'
import { apiRequest } from '../../../api/api'
import { useLanguage } from '../../../language/LanguageContext'

const inputClassName = 'mt-1.5 w-full rounded-xl border border-[#d9d6cc] bg-white px-4 py-3 text-sm font-normal text-[#102c50] outline-none transition focus:border-[#bd9c00] focus:ring-2 focus:ring-[#ffdc32]/40'

export function ContactPage() {
  const { t } = useLanguage()
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' })
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function handleChange(event) {
    const { name, value } = event.target
    setForm((currentForm) => ({ ...currentForm, [name]: value }))
    setSubmitted(false)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitted(false)
    setIsSubmitting(true)
    try {
      await apiRequest('/contact', { method: 'POST', body: form })
      setForm({ name: '', email: '', phone: '', subject: '', message: '' })
      setSubmitted(true)
    } catch (submitError) {
      setError(t(submitError.message))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f7f2] text-[#102c50]">
      <Header />
      <main className="mx-auto max-w-[1160px] px-5 py-10 sm:px-8 sm:py-16 lg:px-12">
        <div className="mb-9 max-w-2xl">
          <p className="mb-2 inline-block rounded-full bg-[#ffeb9c] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em]">{t('We’d love to hear from you')}</p>
          <h1 className="font-display text-5xl font-bold tracking-tight sm:text-6xl">{t('Contact us')}</h1>
          <p className="mt-3 text-base leading-7 text-[#65748a]">
            {t('Have a question about this independent guide? Send us a message. For current store updates, check Cold Stone Cameroon’s public social page.')}
          </p>
        </div>

        <div className="grid items-start gap-8 lg:grid-cols-[0.72fr_1.28fr]">
          <aside className="space-y-5 rounded-[24px] bg-[#092a53] p-6 text-white sm:p-8">
            <h2 className="font-display text-2xl font-bold">{t('Say hello')}</h2>
            <p className="text-sm leading-6 text-white/70">{t('This form reaches the operator of this independent information website, not a Cold Stone Creamery branch.')}</p>
            <div className="border-t border-white/15 pt-5">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#ffdc32]">{t('Local social page')}</p>
              <a className="mt-2 inline-block text-sm font-semibold hover:text-[#ffdc32]" href="https://www.instagram.com/coldstonecameroon/" rel="noreferrer" target="_blank">{t('Cold Stone Cameroon on Instagram')}</a>
            </div>
            <div className="border-t border-white/15 pt-5">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#ffdc32]">{t('Our story')}</p>
              <Link className="mt-2 inline-block text-sm font-semibold hover:text-[#ffdc32]" to="/about">{t('Read about this guide →')}</Link>
            </div>
          </aside>

          <section className="rounded-[24px] border border-[#d9d6cc] bg-white p-5 shadow-[0_8px_30px_rgba(18,44,80,0.05)] sm:p-8">
            <h2 className="font-display text-2xl font-bold">{t('Send us a message')}</h2>
            <p className="mt-1 text-sm text-[#65748a]">{t('Your message will be sent to the operator of this independent website, not to a store.')}</p>
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold">
                  {t('Your name')}
                  <input autoComplete="name" className={inputClassName} maxLength={100} name="name" onChange={handleChange} required value={form.name} />
                </label>
                <label className="block text-sm font-semibold">
                  {t('Email address')}
                  <input autoComplete="email" className={inputClassName} maxLength={254} name="email" onChange={handleChange} required type="email" value={form.email} />
                </label>
              </div>
              <label className="block text-sm font-semibold">
                {t('Phone number')} <span className="font-normal text-[#8792a0]">{t('(optional)')}</span>
                <input autoComplete="tel" className={inputClassName} maxLength={40} name="phone" onChange={handleChange} type="tel" value={form.phone} />
              </label>
              <label className="block text-sm font-semibold">
                {t('Subject')}
                <input className={inputClassName} maxLength={150} name="subject" onChange={handleChange} required value={form.subject} />
              </label>
              <label className="block text-sm font-semibold">
                {t('Message')}
                <textarea className={`${inputClassName} min-h-36 resize-y`} maxLength={5000} name="message" onChange={handleChange} required value={form.message} />
              </label>
              {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}
              {submitted && <p className="rounded-xl bg-[#d8f29a] px-4 py-3 text-sm text-[#163e35]" role="status">{t('Thanks for reaching out. Your message has been sent to our team.')}</p>}
              <button className="w-full rounded-full bg-[#ffdc32] px-6 py-3.5 text-sm font-bold transition hover:-translate-y-0.5 hover:bg-[#ffe76c] disabled:cursor-wait disabled:opacity-60" disabled={isSubmitting} type="submit">
                {isSubmitting ? t('Sending message…') : t('Send message')}
              </button>
            </form>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
