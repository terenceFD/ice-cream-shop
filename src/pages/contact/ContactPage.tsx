import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { Footer, Header } from '../../components/Layout'
import { HeroBackground } from '../../components/HeroBackground'
import { apiRequest } from '../../api/api'
import { useLanguage } from '../../language/useLanguage'
import { ConsentCheckbox } from '../../components/ConsentCheckbox'
import { toInt } from '../../../shared/numbers.ts'

const inputClassName = 'mt-2 w-full min-h-12 rounded-lg border border-[#dce3eb] bg-white px-4 text-sm text-brand-navy outline-none! placeholder:text-[#65748a] focus:border-brand-navy'
const labelClassName = 'text-sm font-bold text-brand-navy'

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

interface StoreOption {
  value: string
  name: string
  location: string
}

const contactFaqs: { question: string; answer: string }[] = [
  {
    question: 'How do I place an order?',
    answer: 'Choose your treats from the menu or pick flavors by the scoop, add them to your bag and check out. You choose pickup or delivery and a time that suits you.',
  },
  {
    question: 'How can I pay?',
    answer: 'Pay securely online with a bank card or with Mobile Money. Your payment details are entered on the secure payment page and never stored on our site.',
  },
  {
    question: 'Do you deliver?',
    answer: 'Yes. Choose delivery at checkout and we bring your order to your door, or pick it up at your nearest branch. The delivery fee is shown before you pay.',
  },
  {
    question: 'Can I order a cake or ice cream for an event?',
    answer: 'Yes. Request a custom ice cream cake for a birthday or celebration, or order in bulk for parties, offices and weddings from the Parties & events page.',
  },
  {
    question: 'Where are your branches?',
    answer: 'We are in Douala and Yaoundé. Open the Locations page for addresses, phone numbers and directions.',
  },
  {
    question: 'How can I contact you?',
    answer: 'Use the form on this page or chat with us on WhatsApp. We reply as soon as we can.',
  },
]

function StoreSelect({
  disabled,
  label,
  onChange,
  placeholder,
  stores,
  value,
}: {
  disabled: boolean
  label: string
  onChange: (value: string) => void
  placeholder: string
  stores: StoreOption[]
  value: string
}) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const id = useId()
  const selectedIndex = stores.findIndex((store) => store.value === value)
  const selected = selectedIndex >= 0 ? stores[selectedIndex] : null

  useEffect(() => {
    if (!open) return undefined
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [open])

  useEffect(() => {
    if (open) listRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  const openList = () => {
    if (disabled || stores.length === 0) return
    setActiveIndex(Math.max(selectedIndex, 0))
    setOpen(true)
  }

  const choose = (index: number) => {
    onChange(stores[index].value)
    setOpen(false)
    buttonRef.current?.focus()
  }

  const onButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault()
      openList()
    }
  }

  const onListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const last = stores.length - 1
    const moves: Record<string, number> = {
      ArrowDown: Math.min(activeIndex + 1, last),
      ArrowUp: Math.max(activeIndex - 1, 0),
      Home: 0,
      End: last,
    }
    if (event.key in moves) {
      event.preventDefault()
      setActiveIndex(moves[event.key])
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      choose(activeIndex)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      buttonRef.current?.focus()
    } else if (event.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div className="relative z-20" ref={rootRef}>
      <span className={labelClassName} id={`${id}-label`}>{label}</span>

      {/* Keeps native "required" validation for the custom control. */}
      <input
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-6 h-px w-px opacity-0"
        name="storeId"
        onChange={() => undefined}
        onInvalid={() => requestAnimationFrame(() => buttonRef.current?.focus())}
        required
        tabIndex={-1}
        value={value}
      />

      <button
        aria-controls={`${id}-list`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-labelledby={`${id}-label ${id}-value`}
        className={`mt-2 flex min-h-12 w-full items-center gap-3 rounded-lg border bg-white px-4 text-left outline-none! transition disabled:cursor-not-allowed disabled:opacity-60 ${
          open ? 'border-brand-navy' : 'border-[#dce3eb]'
        }`}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onButtonKeyDown}
        ref={buttonRef}
        type="button"
      >
        <span className="min-w-0 flex-1" id={`${id}-value`}>
          {selected ? (
            <>
              <span className="block truncate text-sm font-bold text-brand-navy">{selected.name}</span>
              <span className="block truncate text-xs text-[#65748a]">{selected.location}</span>
            </>
          ) : (
            <span className="block truncate text-sm text-[#65748a]">{placeholder}</span>
          )}
        </span>
        <svg
          aria-hidden="true"
          className={`size-4 shrink-0 text-[#65748a] transition duration-200 ${open ? 'rotate-180 text-brand-navy' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
        >
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      </button>

      <ul
        aria-activedescendant={open ? `${id}-option-${activeIndex}` : undefined}
        aria-labelledby={`${id}-label`}
        className={`absolute inset-x-0 top-[calc(100%+8px)] z-40 max-h-80 overflow-y-auto overscroll-contain rounded-lg border border-[#dce3eb] bg-white p-1.5 outline-none! ${
          open ? '' : 'hidden'
        }`}
        id={`${id}-list`}
        onKeyDown={onListKeyDown}
        ref={listRef}
        role="listbox"
        tabIndex={-1}
      >
        {stores.map((store, index) => {
          const isSelected = index === selectedIndex
          const isActive = index === activeIndex
          return (
            <li
              aria-selected={isSelected}
              className={`cursor-pointer rounded-md px-3 py-2.5 ${isActive || isSelected ? 'bg-[#f4f6f8]' : ''}`}
              data-index={index}
              id={`${id}-option-${index}`}
              key={store.value}
              onClick={() => choose(index)}
              onMouseEnter={() => setActiveIndex(index)}
              role="option"
            >
              <span className="block truncate text-sm font-bold text-brand-navy">{store.name}</span>
              <span className="block truncate text-xs text-[#65748a]">{store.location}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
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
  const [consented, setConsented] = useState(false)

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
      await apiRequest('/contact', { method: 'POST', body: { ...form, storeId: toInt(form.storeId, 0) } })
      setForm({ name: '', email: '', phone: '', storeId: '', subject: '', message: '' })
      setSubmitted(true)
    } catch (submitError) {
      setError(t(submitError instanceof Error ? submitError.message : 'Unable to send your message.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const steps = [
    { title: 'Choose a store', detail: 'Choose a store and your message will be routed to that store’s admin team.' },
    { title: 'Write your message', detail: 'Please complete all required fields before sending.' },
    { title: 'Send message', detail: 'Choose the store you want to contact. Only that store’s admin team will receive your message.' },
  ]

  return (
    <div className="min-h-svh bg-white text-brand-navy">
      <Header />
      <main id="main" tabIndex={-1}>
        <section className="relative isolate overflow-hidden bg-brand-navy text-white">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-25">
            <HeroBackground animated quietOnMobile variant="navy" theme="ice-cream" />
          </div>
          <div className="relative mx-auto max-w-[1320px] px-5 py-12 sm:px-8 sm:py-16 lg:px-12">
            <h1 className="max-w-[12ch] font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
              {t('Contact us')}
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-white/75 sm:text-lg">
              {t('Have a question for a store? Choose its branch and send a message directly to that store’s team.')}
            </p>
          </div>
        </section>

        <section className="bg-[#f4f6f8]">
          <div className="grid grid-cols-1 mx-auto max-w-[1320px] items-start gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[minmax(240px,0.72fr)_minmax(0,1.28fr)] lg:gap-16 lg:px-12 lg:py-20">
            <aside>
              <h2 className="max-w-[16ch] font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
                {t('Your message goes to the right store')}
              </h2>
              <ol className="mt-8 space-y-6">
                {steps.map((step, index) => (
                  <li className="flex gap-4" key={step.title}>
                    <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-yellow font-display text-sm font-bold text-brand-navy">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="font-display text-lg font-bold leading-tight">{t(step.title)}</h3>
                      <p className="mt-1 text-sm leading-6 text-[#65748a]">{t(step.detail)}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-8 max-w-sm text-sm leading-6 text-[#65748a]">
                {t('For current store information, please contact a local branch through its public listing.')}
              </p>
              <Link
                className="mt-4 inline-flex min-h-12 items-center text-sm font-bold text-brand-navy underline decoration-[#ffb84d] decoration-2 underline-offset-4"
                to="/locations"
              >
                {t('Browse locations')}
              </Link>
            </aside>

            <section
              aria-labelledby="contact-form-title"
              id="contact-form"
              className="min-w-0 scroll-mt-28 rounded-[20px] border border-[#dce3eb] bg-white p-6 sm:p-8"
            >
              <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl" id="contact-form-title">
                {t('Send us a message')}
              </h2>

              {submitted ? (
                <div className="mt-8" role="status">
                  <p className="max-w-md font-display text-2xl font-extrabold leading-snug">
                    {t('Thanks for reaching out. Your message has been sent to our team.')}
                  </p>
                  <button
                    className="mt-6 inline-flex min-h-12 items-center rounded-lg bg-brand-navy px-6 text-sm font-bold text-white hover:bg-brand-blue"
                    onClick={() => setSubmitted(false)}
                    type="button"
                  >
                    {t('Send message')}
                  </button>
                </div>
              ) : (
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                  <div>
                    <StoreSelect
                      disabled={isLoadingStores || stores.length === 0}
                      label={t('Choose a store')}
                      onChange={(storeId) => {
                        setForm((currentForm) => ({ ...currentForm, storeId }))
                        setSubmitted(false)
                      }}
                      placeholder={isLoadingStores ? t('Loading stores…') : t('Select the store you want to contact')}
                      stores={stores.map((store) => ({
                        value: String(store.storeId),
                        name: t(store.storeName),
                        location: [t(store.storeTown), store.storeArea ? t(store.storeArea) : ''].filter(Boolean).join(', '),
                      }))}
                      value={form.storeId}
                    />
                    {storesError && <span className="mt-2 block text-sm text-red-700" role="alert">{storesError}</span>}
                    {!isLoadingStores && !storesError && stores.length === 0 && <span className="mt-2 block text-sm text-[#65748a]">{t('No active stores are available right now.')}</span>}
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <label className="block">
                      <span className={labelClassName}>{t('Your name')}</span>
                      <input autoComplete="name" className={inputClassName} maxLength={100} name="name" onChange={handleChange} placeholder={t('Enter your name')} required value={form.name} />
                    </label>
                    <label className="block">
                      <span className={labelClassName}>{t('Email address')}</span>
                      <input autoComplete="email" className={inputClassName} maxLength={254} name="email" onChange={handleChange} placeholder={t('you@example.com')} required type="email" value={form.email} />
                    </label>
                    <label className="block">
                      <span className={labelClassName}>
                        {t('Phone number')} <span className="font-semibold text-[#65748a]">{t('(optional)')}</span>
                      </span>
                      <input autoComplete="tel" className={inputClassName} maxLength={40} name="phone" onChange={handleChange} placeholder={t('Add a phone number if you prefer')} type="tel" value={form.phone} />
                    </label>
                    <label className="block">
                      <span className={labelClassName}>{t('Subject')}</span>
                      <input className={inputClassName} maxLength={150} name="subject" onChange={handleChange} placeholder={t('What is your message about?')} required value={form.subject} />
                    </label>
                  </div>

                  <label className="block">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className={labelClassName}>{t('Message')}</span>
                      <span className="text-xs font-semibold tabular-nums text-[#65748a]">{form.message.length} / 5000</span>
                    </span>
                    <textarea className={`${inputClassName} min-h-40 resize-y py-3 leading-7`} maxLength={5000} name="message" onChange={handleChange} placeholder={t('Write your message here…')} required value={form.message} />
                  </label>

                  {error && <p className="text-sm text-red-700" role="alert">{error}</p>}

                  <ConsentCheckbox checked={consented} onToggle={setConsented} />

                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm leading-6 text-[#65748a]">{t('Please complete all required fields before sending.')}</p>
                    <button
                      className="inline-flex min-h-12 items-center justify-center rounded-lg bg-brand-navy px-6 text-sm font-bold text-white hover:bg-brand-blue disabled:cursor-wait disabled:opacity-60"
                      disabled={!consented || isSubmitting || isLoadingStores || stores.length === 0}
                      type="submit"
                    >
                      {isSubmitting ? t('Sending message…') : t('Send message')}
                    </button>
                  </div>
                </form>
              )}
            </section>
          </div>
        </section>

        <section aria-labelledby="contact-faq-heading" className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
          <div className="grid gap-10 lg:grid-cols-[minmax(240px,0.7fr)_minmax(0,1.3fr)] lg:gap-16">
            <div>
              <h2 className="max-w-[14ch] font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl" id="contact-faq-heading">
                {t('Frequently Asked Questions')}
              </h2>
              <p className="mt-4 max-w-sm text-base leading-7 text-[#65748a]">
                {t('Quick answers about ordering, delivery, payment and our branches.')}
              </p>
              <p className="mt-6 max-w-sm text-sm leading-6 text-[#65748a]">
                {t('Send us a message and our team will get back to you, or find your nearest branch.')}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
                <a
                  className="inline-flex min-h-12 items-center text-sm font-bold text-brand-navy underline decoration-[#ffb84d] decoration-2 underline-offset-4"
                  href="#contact-form"
                >
                  {t('Send us a message')}
                </a>
                <Link
                  className="inline-flex min-h-12 items-center text-sm font-bold text-brand-navy underline decoration-[#ffb84d] decoration-2 underline-offset-4"
                  to="/locations"
                >
                  {t('Locations')}
                </Link>
              </div>
            </div>

            <div className="border-t border-[#dce3eb]">
              {contactFaqs.map(({ question, answer }) => (
                <details className="group border-b border-[#dce3eb]" key={question}>
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 marker:content-none [&::-webkit-details-marker]:hidden">
                    <span className="font-display text-lg font-bold leading-snug">{t(question)}</span>
                    <span aria-hidden="true" className="text-xl leading-none text-brand-yellow-deep group-open:hidden">+</span>
                    <span aria-hidden="true" className="hidden text-xl leading-none text-brand-yellow-deep group-open:inline">–</span>
                  </summary>
                  <p className="max-w-[62ch] pb-5 text-base leading-7 text-[#65748a]">{t(answer)}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
