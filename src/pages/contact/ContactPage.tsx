import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowIcon, Footer, Header } from '../../components/Layout'
import { PageHero } from '../../components/PageHero'
import { apiRequest } from '../../api/api'
import { cameroonLocations } from '../../../shared/data'
import { useLanguage } from '../../language/useLanguage'

const inputClassName = 'w-full rounded-2xl border border-transparent bg-[#fbfaf5] px-5 py-4 text-sm font-medium text-[#092a53] outline-none! ring-1 ring-[#ebe7dc] transition placeholder:font-normal placeholder:text-[#a5aebb] hover:ring-[#ddd6c4] focus:bg-white focus:ring-[#c9b24a]'
const labelClassName = 'text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#52647b]'

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

function PinIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 1 1 13 0c0 5.4-6.5 11-6.5 11Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <rect height="14" rx="3" stroke="currentColor" strokeWidth="1.8" width="18" x="3" y="5" />
      <path d="m4 7 8 6 8-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  )
}

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
        className={`mt-2 flex w-full items-center gap-4 rounded-2xl px-4 py-3 text-left ring-1 outline-none! transition disabled:cursor-not-allowed disabled:opacity-60 ${
          open
            ? 'bg-white shadow-[0_10px_30px_rgba(9,42,83,0.08)] ring-[#c9b24a]'
            : 'bg-[#fbfaf5] ring-[#ebe7dc] hover:ring-[#ddd6c4]'
        }`}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onButtonKeyDown}
        ref={buttonRef}
        type="button"
      >
        <span
          aria-hidden="true"
          className={`grid size-10 shrink-0 place-items-center rounded-xl transition ${
            selected ? 'bg-[#092a53] text-[#ffdc32]' : 'bg-white text-[#65748a] ring-1 ring-[#ebe7dc]'
          }`}
        >
          <PinIcon />
        </span>
        <span className="min-w-0 flex-1" id={`${id}-value`}>
          {selected ? (
            <>
              <span className="block truncate text-sm font-extrabold text-[#092a53]">{selected.name}</span>
              <span className="mt-0.5 block truncate text-xs font-semibold text-[#7b8796]">{selected.location}</span>
            </>
          ) : (
            <span className="block truncate text-sm font-medium text-[#a5aebb]">{placeholder}</span>
          )}
        </span>
        <svg
          aria-hidden="true"
          className={`size-4 shrink-0 text-[#65748a] transition duration-200 ${open ? 'rotate-180 text-[#092a53]' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
        >
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      </button>

      <ul
        aria-activedescendant={open ? `${id}-option-${activeIndex}` : undefined}
        aria-labelledby={`${id}-label`}
        className={`absolute inset-x-0 top-[calc(100%+8px)] z-40 max-h-80 origin-top overflow-y-auto overscroll-contain rounded-2xl bg-white p-2 shadow-[0_28px_64px_rgba(9,42,83,0.18),0_2px_6px_rgba(9,42,83,0.06)] ring-1 ring-[#ebe7dc] outline-none! transition duration-150 ease-out ${
          open ? 'visible translate-y-0 scale-100 opacity-100' : 'invisible -translate-y-1 scale-[0.98] opacity-0'
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
              className={`flex cursor-pointer items-center gap-4 rounded-xl px-3 py-3 transition-colors ${isActive ? 'bg-[#fbf6e3]' : ''}`}
              data-index={index}
              id={`${id}-option-${index}`}
              key={store.value}
              onClick={() => choose(index)}
              onMouseEnter={() => setActiveIndex(index)}
              role="option"
            >
              <span
                aria-hidden="true"
                className={`grid size-9 shrink-0 place-items-center rounded-lg transition ${
                  isSelected ? 'bg-[#092a53] text-[#ffdc32]' : isActive ? 'bg-white text-[#8a7000]' : 'bg-[#fbfaf5] text-[#65748a]'
                }`}
              >
                <PinIcon />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-sm ${isSelected ? 'font-extrabold text-[#092a53]' : 'font-bold text-[#24405f]'}`}>
                  {store.name}
                </span>
                <span className="mt-0.5 block truncate text-xs font-semibold text-[#65748a]">{store.location}</span>
              </span>
              <span
                aria-hidden="true"
                className={`grid size-5 shrink-0 place-items-center rounded-full transition ${isSelected ? 'bg-[#092a53] text-white' : 'text-transparent'}`}
              >
                <svg className="size-3" fill="none" viewBox="0 0 24 24">
                  <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
                </svg>
              </span>
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

  const steps = [
    { title: 'Choose a store', detail: 'Choose a store and your message will be routed to that store’s admin team.' },
    { title: 'Write your message', detail: 'Please complete all required fields before sending.' },
    { title: 'Send message', detail: 'Choose the store you want to contact. Only that store’s admin team will receive your message.' },
  ]

  return (
    <div className="min-h-screen bg-[#fbfaf5] text-[#102c50]">
      <Header />
      <main>
        <PageHero
          actions={
            <>
              <a className={PageHero.primary} href="#contact-form">
                {t('Send us a message')} <span aria-hidden="true">↓</span>
              </a>
              <Link className={PageHero.secondary} to="/about">
                {t('About us →')}
              </Link>
            </>
          }
          description={t('Have a question for a store? Choose its branch and send a message directly to that store’s team.')}
          eyebrow={t('We’d love to hear from you')}
          title={t('Contact us')}
          visualClassName="flex flex-col gap-3 sm:block sm:aspect-[6/5]"
          visual={
            <>
              <div aria-hidden="true" className="absolute right-[4%] top-[6%] size-[80%] rounded-full border border-dashed border-white/20 max-sm:hidden" />

              <a
                className="group relative block rounded-[28px] bg-white p-5 sm:absolute sm:left-0 sm:top-[4%] sm:w-[78%] text-[#092a53] shadow-[0_40px_80px_rgba(2,12,28,0.45)] transition duration-300 hover:-translate-y-1 sm:p-6"
                href="#contact-form"
              >
                <span className="flex items-center gap-3">
                  <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#092a53] text-[#ffdc32]">
                    <MailIcon />
                  </span>
                  <span className="leading-tight">
                    <span className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#8a7000]">{t('Contact a store')}</span>
                    <span className="mt-0.5 block font-display text-base font-extrabold sm:text-lg">{t('Send us a message')}</span>
                  </span>
                </span>
                <span aria-hidden="true" className="mt-5 block space-y-2.5">
                  <span className="block h-9 rounded-xl bg-[#fbfaf5] ring-1 ring-[#ebe7dc]" />
                  <span className="block h-14 rounded-xl bg-[#fbfaf5] ring-1 ring-[#ebe7dc]" />
                </span>
                <span aria-hidden="true" className="mt-4 flex justify-end">
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#092a53] px-4 py-2 text-xs font-extrabold text-white transition group-hover:bg-[#163e6b]">
                    {t('Send message')} <ArrowIcon />
                  </span>
                </span>
              </a>

              <a
                className="relative flex items-center gap-3 sm:absolute sm:right-0 sm:top-[64%] sm:w-[60%] rounded-[22px] border border-white/15 bg-[#0f3a6c]/90 p-4 text-white shadow-[0_24px_50px_rgba(2,12,28,0.4)] backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:border-white/30"
                href="https://www.instagram.com/coldstonecameroon/"
                rel="noreferrer"
                target="_blank"
              >
                <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#ffdc32] via-[#f56586] to-[#7b4bd8] p-[2px]">
                  <span className="grid size-full place-items-center rounded-full bg-[#0f3a6c]">
                    <svg className="size-[18px]" fill="none" viewBox="0 0 24 24">
                      <rect height="18" rx="5" stroke="currentColor" strokeWidth="1.8" width="18" x="3" y="3" />
                      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
                      <circle cx="17.25" cy="6.75" fill="currentColor" r="1.1" />
                    </svg>
                  </span>
                </span>
                <span className="min-w-0 leading-tight">
                  <span className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#ffdc32]">{t('Local social page')}</span>
                  <span className="mt-0.5 block truncate text-sm font-extrabold">@coldstonecameroon</span>
                </span>
              </a>

              <Link
                className="relative flex items-center gap-3 sm:absolute sm:bottom-[-2%] sm:left-[4%] sm:w-[52%] rounded-[22px] bg-[#ffdc32] p-4 text-[#092a53] shadow-[0_24px_50px_rgba(2,12,28,0.4)] transition duration-300 hover:-translate-y-1 hover:bg-[#ffe76c]"
                to="/locations"
              >
                <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#092a53] text-[#ffdc32]">
                  <PinIcon className="size-5" />
                </span>
                <span className="min-w-0 leading-tight">
                  <span className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#806a00]">{t('Listed locations')}</span>
                  <span className="mt-0.5 block truncate text-sm font-extrabold">{t('{count} public listings', { count: cameroonLocations.length })}</span>
                </span>
              </Link>
            </>
          }
        />

        <section className="pb-20 pt-10 sm:pb-24 sm:pt-14 lg:pb-28">
          <div className="mx-auto grid max-w-[1320px] grid-cols-1 items-start gap-10 px-5 sm:px-8 lg:grid-cols-12 lg:gap-14 lg:px-12">
            <aside className="lg:sticky lg:top-[calc(var(--site-header-offset,0px)+2rem)] lg:transition-[top] lg:duration-300 lg:col-span-4">
              <p className="inline-flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#8a7000]">
                <span aria-hidden="true" className="h-px w-10 bg-[#a48700]" />
                {t('How it works')}
              </p>
              <h2 className="mt-4 font-display text-3xl font-extrabold leading-tight tracking-tight text-[#092a53] sm:text-4xl">
                {t('Say hello')}
              </h2>

              <ol className="relative mt-8 space-y-7 before:absolute before:bottom-6 before:left-[23px] before:top-6 before:w-0.5 before:bg-gradient-to-b before:from-[#ffdc32] before:to-[#ebe7dc]">
                {steps.map((step, index) => (
                  <li className="group relative flex gap-5" key={step.title}>
                    <span className="relative z-10 grid size-12 shrink-0 place-items-center rounded-2xl bg-[#092a53] font-display text-sm font-extrabold tabular-nums text-[#ffdc32] shadow-[0_10px_22px_rgba(9,42,83,0.2)] ring-4 ring-[#fbfaf5] transition duration-300 group-hover:-rotate-6 group-hover:bg-[#ffdc32] group-hover:text-[#092a53]">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div className="pt-2">
                      <h3 className="font-display text-lg font-extrabold text-[#092a53]">{t(step.title)}</h3>
                      <p className="mt-1 text-sm leading-6 text-[#65748a]">{t(step.detail)}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="relative mt-10 overflow-hidden rounded-[24px] bg-[#092a53] p-6 text-white shadow-[0_20px_44px_rgba(9,42,83,0.2)]">
                <div aria-hidden="true" className="absolute -right-12 -top-12 size-36 rounded-full border-[24px] border-white/[0.05]" />
                <span aria-hidden="true" className="grid size-11 place-items-center rounded-2xl bg-[#ffdc32] text-[#092a53]">
                  <PinIcon className="size-5" />
                </span>
                <p className="mt-4 text-sm leading-6 text-white/75">
                  {t('For current store information, please contact a local branch through its public listing.')}
                </p>
                <Link className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-extrabold text-[#092a53] transition hover:-translate-y-0.5 hover:bg-[#ffdc32]" to="/locations">
                  {t('Browse locations')} <ArrowIcon />
                </Link>
              </div>
            </aside>

            <section
              aria-labelledby="contact-form-title"
              id="contact-form"
              className="relative scroll-mt-28 overflow-hidden rounded-[32px] bg-white p-6 before:absolute before:inset-x-0 before:top-0 before:h-1.5 before:bg-gradient-to-r before:from-[#ffdc32] before:via-[#ffe76c] before:to-[#ffdc32] shadow-[0_1px_0_rgba(9,42,83,0.04),0_24px_60px_rgba(9,42,83,0.08)] ring-1 ring-[#ebe7dc] sm:p-10 lg:col-span-8 lg:p-12"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#8a7000]">{t('Contact a store')}</p>
                  <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-[#092a53] sm:text-4xl" id="contact-form-title">
                    {t('Send us a message')}
                  </h2>
                </div>
                <span aria-hidden="true" className="grid size-14 place-items-center rounded-2xl bg-[#092a53] text-[#ffdc32] shadow-[0_12px_26px_rgba(9,42,83,0.22)] max-sm:hidden">
                  <MailIcon />
                </span>
              </div>

              {submitted ? (
                <div className="mt-10 flex flex-col items-center rounded-[24px] bg-[#f3f8ef] px-6 py-14 text-center" role="status">
                  <span aria-hidden="true" className="grid size-16 place-items-center rounded-full bg-[#4caf50] text-white shadow-[0_12px_30px_rgba(76,175,80,0.35)]">
                    <svg className="size-8" fill="none" viewBox="0 0 24 24">
                      <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
                    </svg>
                  </span>
                  <p className="mt-6 max-w-md font-display text-xl font-extrabold leading-snug text-[#274d20]">
                    {t('Thanks for reaching out. Your message has been sent to our team.')}
                  </p>
                  <button
                    className="mt-8 inline-flex items-center gap-2 rounded-full border border-[#cfe2c4] bg-white px-6 py-3 text-sm font-extrabold text-[#274d20] transition hover:-translate-y-0.5"
                    onClick={() => setSubmitted(false)}
                    type="button"
                  >
                    {t('Send message')} <span aria-hidden="true">→</span>
                  </button>
                </div>
              ) : (
                <form className="mt-10 space-y-6" onSubmit={handleSubmit}>
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
                        location: [t(store.storeTown), store.storeArea ? t(store.storeArea) : ''].filter(Boolean).join(' · '),
                      }))}
                      value={form.storeId}
                    />
                    {storesError && <span className="mt-2 block text-sm text-red-700" role="alert">{storesError}</span>}
                    {!isLoadingStores && !storesError && stores.length === 0 && <span className="mt-2 block text-sm text-[#65748a]">{t('No active stores are available right now.')}</span>}
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <label className="block">
                      <span className={labelClassName}>{t('Your name')}</span>
                      <input autoComplete="name" className={`${inputClassName} mt-2`} maxLength={100} name="name" onChange={handleChange} placeholder={t('Enter your name')} required value={form.name} />
                    </label>
                    <label className="block">
                      <span className={labelClassName}>{t('Email address')}</span>
                      <input autoComplete="email" className={`${inputClassName} mt-2`} maxLength={254} name="email" onChange={handleChange} placeholder={t('you@example.com')} required type="email" value={form.email} />
                    </label>
                    <label className="block">
                      <span className={labelClassName}>
                        {t('Phone number')} <span className="font-semibold normal-case tracking-normal text-[#a5aebb]">{t('(optional)')}</span>
                      </span>
                      <input autoComplete="tel" className={`${inputClassName} mt-2`} maxLength={40} name="phone" onChange={handleChange} placeholder={t('Add a phone number if you prefer')} type="tel" value={form.phone} />
                    </label>
                    <label className="block">
                      <span className={labelClassName}>{t('Subject')}</span>
                      <input className={`${inputClassName} mt-2`} maxLength={150} name="subject" onChange={handleChange} placeholder={t('What is your message about?')} required value={form.subject} />
                    </label>
                  </div>

                  <label className="block">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className={labelClassName}>{t('Message')}</span>
                      <span className="text-[11px] font-semibold tabular-nums text-[#a5aebb]">{form.message.length} / 5000</span>
                    </span>
                    <textarea className={`${inputClassName} mt-2 min-h-44 resize-y leading-7`} maxLength={5000} name="message" onChange={handleChange} placeholder={t('Write your message here…')} required value={form.message} />
                  </label>

                  {error && <p className="flex gap-3 rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700" role="alert"><span aria-hidden="true" className="font-extrabold">!</span>{error}</p>}

                  <div className="flex flex-col-reverse gap-4 border-t border-[#efece3] pt-6 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs leading-5 text-[#65748a]">{t('Please complete all required fields before sending.')}</p>
                    <button
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-[#092a53] px-8 py-4 text-sm font-extrabold text-white shadow-[0_12px_28px_rgba(9,42,83,0.22)] transition hover:-translate-y-0.5 hover:bg-[#163e6b] disabled:translate-y-0 disabled:cursor-wait disabled:opacity-60"
                      disabled={isSubmitting || isLoadingStores || stores.length === 0}
                      type="submit"
                    >
                      {isSubmitting ? t('Sending message…') : t('Send message')}
                      {!isSubmitting && <ArrowIcon />}
                    </button>
                  </div>
                </form>
              )}
            </section>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
