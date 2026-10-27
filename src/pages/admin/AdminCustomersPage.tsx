import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../../api/api'
import { useAdminAuth } from './useAdminAuth'
import { useLanguage } from '../../language/useLanguage'

interface CustomerAccount {
  id: number
  name: string
  email: string
  phone?: string
  deliveryCity?: string
  isBanned: boolean
  createdAt: string
}

type StatusFilter = 'all' | 'active' | 'banned' | 'whatsapp' | 'new'

const inputClassName = 'w-full rounded-lg border border-[#dce3eb] bg-white px-3 py-2 text-sm font-medium text-brand-navy transition placeholder:text-[#65748a] hover:border-[#bac7d5] focus:border-brand-yellow-deep focus:ring-2 focus:ring-brand-yellow/25 outline-none!'
const NEW_CUSTOMER_DAYS = 30
const WHATSAPP_PATH = 'M12.04 2a9.9 9.9 0 0 0-8.49 15l-1.3 4.75 4.86-1.27A9.96 9.96 0 1 0 12.04 2Zm0 18.1a8.1 8.1 0 0 1-4.13-1.13l-.3-.18-2.88.75.77-2.8-.2-.3A8.12 8.12 0 1 1 12.04 20.1Zm4.45-6.08c-.24-.12-1.43-.7-1.65-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.43-1.34-1.67-.14-.24-.02-.37.1-.49.1-.1.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.47-.4-.4-.54-.4h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.12 3.64.58.25 1.03.4 1.38.5.58.18 1.1.15 1.51.09.46-.07 1.43-.59 1.63-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.46-.28Z'

const icons = {
  users: 'M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20m17 0v-1.5a4 4 0 0 0-3-3.87M14 3.2a4 4 0 0 1 0 7.6M9.5 10.8a3.8 3.8 0 1 0 0-7.6 3.8 3.8 0 0 0 0 7.6Z',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  ban: 'M5.6 5.6l12.8 12.8M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  sparkle: 'M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5m7 7L18 18m0-12-2.5 2.5m-7 7L6 18',
  search: 'm20 20-4.2-4.2M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z',
  download: 'M12 4v12m0 0-5-5m5 5 5-5M5 20h14',
  refresh: 'M20 7v5h-5M4 17v-5h5m-4.1-2a7.5 7.5 0 0 1 12.2-2.4L20 12M4 12l2.9 4.4A7.5 7.5 0 0 0 19.1 14',
  megaphone: 'M4 10v4h3l6 4V6L7 10H4Zm13-1a4 4 0 0 1 0 6',
  close: 'M6 6l12 12M18 6 6 18',
  trash: 'M4 7h16M10 11v6m4-6v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3',
  alert: 'M12 8v5m0 3.5v.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  mail: 'M4 6h16v12H4V6Zm0 0 8 7 8-7',
  phone: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm3 15h2',
  pin: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  copy: 'M9 9h10v10H9V9Zm-4 6V5h10',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  unban: 'M6 11h12v9H6v-9Zm2 0V8a4 4 0 0 1 7.5-2',
  info: 'M12 11v5m0-8.5v.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
}

function Icon({ path, className = 'size-4' }: { path: string; className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d={path} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  )
}

function WhatsAppIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d={WHATSAPP_PATH} />
    </svg>
  )
}

function whatsappNumber(phone: string): string {
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (!digits.startsWith('237')) {
    if (digits.startsWith('0')) digits = digits.slice(1)
    digits = `237${digits}`
  }
  return digits.length >= 8 && digits.length <= 15 ? digits : ''
}

function parseJoined(value: string) {
  const date = new Date(`${String(value).replace(' ', 'T')}${/[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? '' : 'Z'}`)
  return Number.isNaN(date.getTime()) ? null : date
}

function initials(name: string) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || '?'
}

export function AdminCustomersPage() {
  const { currentAdmin, sessionToken } = useAdminAuth()
  const isOwner = currentAdmin?.role === 'owner'
  const { t, language } = useLanguage()
  const locale = language === 'fr' ? 'fr-CM' : 'en-CM'
  const [customers, setCustomers] = useState<CustomerAccount[]>([])
  const [promotionMessage, setPromotionMessage] = useState('')
  const [promotionCampaign, setPromotionCampaign] = useState<{
    recipients: CustomerAccount[]
    message: string
    currentIndex: number
  } | null>(null)
  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const [customerToBan, setCustomerToBan] = useState<CustomerAccount | null>(null)
  const [customerToDelete, setCustomerToDelete] = useState<CustomerAccount | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [cityFilter, setCityFilter] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const isOverlayOpen = isComposerOpen || Boolean(customerToBan) || Boolean(customerToDelete)

  useEffect(() => {
    let cancelled = false
    apiRequest<{ customers: CustomerAccount[] }>('/admin/customers', { token: sessionToken })
      .then((result) => {
        if (!cancelled) {
          setCustomers(result.customers)
          setError('')
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unable to load customer accounts.')
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
          setRefreshing(false)
        }
      })
    return () => { cancelled = true }
  }, [refreshKey, sessionToken])

  useEffect(() => {
    function refreshWhenVisible() {
      if (document.visibilityState === 'visible') {
        setRefreshing(true)
        setRefreshKey((current) => current + 1)
      }
    }
    const interval = window.setInterval(refreshWhenVisible, 30_000)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [sessionToken])

  useEffect(() => {
    if (!message) return undefined
    const timer = window.setTimeout(() => setMessage(''), 5000)
    return () => window.clearTimeout(timer)
  }, [message])

  useEffect(() => {
    if (!isOverlayOpen) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setIsComposerOpen(false)
      setCustomerToBan(null)
      setCustomerToDelete(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOverlayOpen])

  const now = Date.now()
  const isNew = (customer: CustomerAccount) => {
    const joined = parseJoined(customer.createdAt)
    return Boolean(joined && now - joined.getTime() <= NEW_CUSTOMER_DAYS * 86400000)
  }
  const hasWhatsapp = (customer: CustomerAccount) => Boolean(customer.phone && whatsappNumber(customer.phone))

  const counts = useMemo(() => ({
    active: customers.filter((customer) => !customer.isBanned).length,
    banned: customers.filter((customer) => customer.isBanned).length,
    whatsapp: customers.filter((customer) => !customer.isBanned && hasWhatsapp(customer)).length,
    new: customers.filter(isNew).length,
  }), [customers])

  const cities = useMemo(() => [...new Set(customers.map((customer) => customer.deliveryCity).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b)), [customers])

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return customers
      .filter((customer) => {
        const matchesSearch = !query || [customer.name, customer.email, customer.phone, customer.deliveryCity]
          .some((value) => value?.toLocaleLowerCase().includes(query))
        const matchesStatus = statusFilter === 'all'
          || (statusFilter === 'active' && !customer.isBanned)
          || (statusFilter === 'banned' && customer.isBanned)
          || (statusFilter === 'whatsapp' && !customer.isBanned && hasWhatsapp(customer))
          || (statusFilter === 'new' && isNew(customer))
        const matchesCity = !cityFilter || customer.deliveryCity === cityFilter
        return matchesSearch && matchesStatus && matchesCity
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name)
        const aTime = parseJoined(a.createdAt)?.getTime() || 0
        const bTime = parseJoined(b.createdAt)?.getTime() || 0
        return sortBy === 'oldest' ? aTime - bTime : bTime - aTime
      })
  }, [cityFilter, customers, search, sortBy, statusFilter])
  const hasActiveFilters = Boolean(search.trim() || statusFilter !== 'all' || cityFilter)

  async function setBan(customer: CustomerAccount, isBanned: boolean) {
    setError('')
    setMessage('')
    setSavingId(customer.id)
    try {
      await apiRequest(`/admin/customers/${customer.id}/ban`, {
        method: 'PATCH',
        token: sessionToken,
        body: { isBanned },
      })
      setCustomers((current) => current.map((entry) =>
        entry.id === customer.id ? { ...entry, isBanned } : entry,
      ))
      setCustomerToBan(null)
      setMessage(t(isBanned ? 'Customer banned.' : 'Customer unbanned.'))
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update customer access.')
    } finally {
      setSavingId(null)
    }
  }

  async function deleteBannedCustomer() {
    if (!customerToDelete) return
    const customer = customerToDelete
    setError('')
    setMessage('')
    setSavingId(customer.id)
    try {
      await apiRequest(`/admin/customers/${customer.id}`, { method: 'DELETE', token: sessionToken })
      setCustomers((current) => current.filter((entry) => entry.id !== customer.id))
      setCustomerToDelete(null)
      setMessage(t('Banned customer account deleted.'))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete customer account.')
    } finally {
      setSavingId(null)
    }
  }

  function whatsappLink(customer: CustomerAccount, text = promotionMessage.trim()): string | undefined {
    const number = customer.phone ? whatsappNumber(customer.phone) : ''
    if (!number) return undefined
    return text ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : `https://wa.me/${number}`
  }

  function sendPromotionToAll() {
    const text = promotionMessage.trim()
    if (!text) {
      setError(t('Enter a promotion message first.'))
      return
    }

    const recipients = customers.filter((customer) => !customer.isBanned && hasWhatsapp(customer))
    if (!recipients.length) {
      setError(t('No active customers have a valid WhatsApp number.'))
      return
    }

    const firstLink = whatsappLink(recipients[0], text)
    if (!firstLink) return
    window.open(firstLink, '_blank', 'noopener,noreferrer')
    setPromotionCampaign({ recipients, message: text, currentIndex: 0 })
    setIsComposerOpen(false)
    setError('')
    setMessage(t('WhatsApp opened for the first customer. Send the message, then continue through the list.'))
  }

  function openNextPromotionChat() {
    if (!promotionCampaign) return
    const nextIndex = promotionCampaign.currentIndex + 1
    if (nextIndex >= promotionCampaign.recipients.length) {
      setPromotionCampaign(null)
      setMessage(t('Promotion message list completed.'))
      return
    }

    const link = whatsappLink(promotionCampaign.recipients[nextIndex], promotionCampaign.message)
    if (!link) {
      setError(t('This customer phone number is invalid.'))
      return
    }
    window.open(link, '_blank', 'noopener,noreferrer')
    setPromotionCampaign({ ...promotionCampaign, currentIndex: nextIndex })
    setError('')
  }

  async function copyEmail(customer: CustomerAccount) {
    try {
      await navigator.clipboard.writeText(customer.email)
      setCopiedId(customer.id)
      window.setTimeout(() => setCopiedId((current) => (current === customer.id ? null : current)), 1800)
    } catch {
      setCopiedId(null)
    }
  }

  function exportCsv() {
    const escape = (value: unknown) => {
      const text = String(value ?? '')
      const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text
      return `"${safeText.replaceAll('"', '""')}"`
    }
    const rows = [
      ['Name', 'Email', 'Phone', 'City', 'Joined', 'Status'],
      ...filteredCustomers.map((customer) => [
        customer.name,
        customer.email,
        customer.phone || '',
        customer.deliveryCity || '',
        parseJoined(customer.createdAt)?.toISOString().slice(0, 10) || '',
        customer.isBanned ? 'Banned' : 'Active',
      ]),
    ]
    const blob = new Blob([`${rows.map((row) => row.map(escape).join(',')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  function joinedDate(value: string) {
    const date = parseJoined(value)
    return date ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date) : value
  }

  const templates = [
    t('This weekend only: buy 2 scoops and get the 3rd free at Cold Stone Cameroon!'),
    t('Planning a celebration? Order a custom ice cream cake today and we will make it unforgettable.'),
    t('New flavors just arrived! Come taste them first at your nearest Cold Stone store.'),
  ]

  const metrics: { key: StatusFilter; label: string; value: number }[] = [
    { key: 'active', label: 'Active accounts', value: counts.active },
    { key: 'new', label: 'New this month', value: counts.new },
    { key: 'banned', label: 'Restricted accounts', value: counts.banned },
  ]

  const currentRecipient = promotionCampaign ? promotionCampaign.recipients[promotionCampaign.currentIndex] : null
  const campaignProgress = promotionCampaign ? ((promotionCampaign.currentIndex + 1) / promotionCampaign.recipients.length) * 100 : 0

  return (
    <div className="min-w-0 space-y-4">
      <header className="flex items-start justify-between gap-2 border-b border-[#dce3eb] pb-4 sm:items-end sm:pb-5">
        <div className="min-w-0">
          <nav aria-label={t('Breadcrumb')} className="hidden text-xs font-medium text-[#65748a] sm:block">
            {t('Customer management')} <span aria-hidden="true" className="mx-1.5 text-[#a3b0bf]">/</span>
            <span className="font-semibold text-brand-blue">{t('Customer accounts')}</span>
          </nav>
          <h1 className="mt-0 whitespace-nowrap text-xl font-semibold tracking-tight text-brand-navy sm:text-2xl">{t('Customer accounts')}</h1>
          <p className="mt-1 hidden max-w-2xl text-sm leading-5 text-[#65748a] sm:block">{t('View registered customers, manage account access, and prepare promotion messages for WhatsApp.')}</p>
        </div>
        <div className="flex shrink-0 gap-1.5 sm:gap-2">
          <button
            aria-label={t('Refresh customer accounts')}
            className="inline-flex size-9 items-center justify-center gap-2 rounded-lg border border-[#dce3eb] bg-white px-2.5 text-sm font-semibold text-brand-blue transition hover:border-[#bacbdc] hover:bg-[#f4f6f8] hover:text-brand-navy disabled:opacity-50 sm:min-h-10 sm:w-auto sm:px-3.5"
            disabled={loading || refreshing}
            onClick={() => {
              setRefreshing(true)
              setRefreshKey((current) => current + 1)
            }}
            type="button"
          >
            <Icon className={refreshing ? 'size-4 animate-spin' : 'size-4'} path={icons.refresh} />
            <span className="hidden sm:inline">{t(refreshing ? 'Refreshing…' : 'Refresh')}</span>
          </button>
          <button
            aria-label={t('Export CSV')}
            className="inline-flex size-9 items-center justify-center gap-2 rounded-lg border border-[#dce3eb] bg-white px-2.5 text-sm font-semibold text-brand-blue transition hover:border-[#bacbdc] hover:bg-[#f4f6f8] hover:text-brand-navy disabled:opacity-50 sm:min-h-10 sm:w-auto sm:px-3.5"
            disabled={!filteredCustomers.length}
            onClick={exportCsv}
            type="button"
          >
            <Icon path={icons.download} />
            <span className="hidden sm:inline">{t('Export CSV')}</span>
          </button>
          {isOwner && (
            <button
              aria-label={t('WhatsApp campaign')}
              className="inline-flex size-9 items-center justify-center gap-2 rounded-lg bg-[#16733f] px-2.5 text-sm font-semibold text-white transition hover:bg-[#125f34] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow-deep disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-10 sm:w-auto sm:px-3.5"
              disabled={loading || promotionCampaign !== null}
              onClick={() => { setError(''); setIsComposerOpen(true) }}
              type="button"
            >
              <Icon path={icons.megaphone} />
              <span className="hidden sm:inline">{t('WhatsApp campaign')}</span>
            </button>
          )}
        </div>
      </header>

      {message && (
        <div className="flex items-center justify-between gap-3 rounded-md bg-[#eaf6ee] px-4 py-3 text-sm font-semibold text-[#1f5d3c] ring-1 ring-[#cfe8d8]" role="status">
          <span className="flex items-center gap-2"><Icon path={icons.check} />{message}</span>
          <button aria-label={t('Dismiss')} className="grid size-7 shrink-0 place-items-center rounded-lg transition hover:bg-[#d7eedf]" onClick={() => setMessage('')} type="button">
            <Icon className="size-3.5" path={icons.close} />
          </button>
        </div>
      )}
      {error && !isOverlayOpen && (
        <p className="flex items-start gap-2 rounded-md bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100" role="alert">
          <Icon className="mt-0.5 size-4 shrink-0" path={icons.alert} />
          {error}
        </p>
      )}

      {promotionCampaign && currentRecipient && (
        <section aria-label={t('WhatsApp campaign')} className="sticky top-[84px] z-20 overflow-hidden rounded-md bg-[#0f3d26] text-white shadow-[0_14px_32px_rgba(15,61,38,0.25)]">
          <div className="h-1 bg-white/10">
            <div className="h-full bg-[#25d366] transition-[width] duration-500" style={{ width: `${campaignProgress}%` }} />
          </div>
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-md bg-[#25d366] text-[#0f3d26]"><WhatsAppIcon className="size-5" /></span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white/70" role="status">
                  {t('Customer {current} of {total}', { current: promotionCampaign.currentIndex + 1, total: promotionCampaign.recipients.length })}
                </p>
                <p className="truncate font-bold">{currentRecipient.name} · <span className="font-medium text-white/70">{currentRecipient.phone}</span></p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                className="inline-flex min-h-9 items-center rounded-lg px-3 text-xs font-bold text-white/80 underline-offset-2 transition hover:bg-white/10 hover:text-white"
                href={whatsappLink(currentRecipient, promotionCampaign.message)}
                rel="noreferrer"
                target="_blank"
              >
                {t('Open current WhatsApp chat again')}
              </a>
              <button
                className="inline-flex min-h-9 items-center rounded-lg px-3 text-xs font-bold text-white/70 transition hover:bg-white/10 hover:text-white"
                onClick={() => { setPromotionCampaign(null); setMessage(t('Campaign stopped.')) }}
                type="button"
              >
                {t('Stop')}
              </button>
              <button
                className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-[#25d366] px-4 text-xs font-extrabold text-[#0f3d26] transition hover:bg-[#3ee07a]"
                onClick={openNextPromotionChat}
                type="button"
              >
                {promotionCampaign.currentIndex + 1 === promotionCampaign.recipients.length ? t('Finish campaign') : t('Open next WhatsApp chat')}
                <Icon path={icons.arrow} />
              </button>
            </div>
          </div>
        </section>
      )}

      <section aria-label={t('Customer overview')} className="grid grid-cols-3 divide-x divide-[#dce3eb] overflow-hidden rounded-md border border-[#dce3eb] bg-[#fbfcfe]">
        {metrics.map((metric) => {
          const isActive = statusFilter === metric.key && metric.key !== 'all'
          return (
            <button
              aria-pressed={isActive}
              className={`min-w-0 px-2.5 py-3 text-left transition hover:bg-white focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-yellow-deep sm:px-4 sm:py-3.5 ${isActive ? 'bg-[#fff9df]' : ''}`}
              key={metric.key}
              onClick={() => setStatusFilter(isActive || metric.key === 'all' ? 'all' : metric.key)}
              type="button"
            >
              <p className="text-xl font-semibold leading-none tracking-tight text-brand-navy tabular-nums">{metric.value.toLocaleString(locale)}</p>
              <p className="mt-1 text-xs font-semibold leading-4 text-[#65748a] sm:mt-1.5 sm:text-[13px]">{t(metric.label)}</p>
            </button>
          )
        })}
      </section>

      <section aria-labelledby="customer-directory-title" className="min-w-0">
        <div className="border-b border-[#dce3eb]">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 pb-3">
            <div className="flex min-w-0 flex-1 items-baseline justify-between gap-3 sm:flex-none sm:flex-col sm:gap-0">
              <h2 className="text-sm font-semibold text-brand-navy" id="customer-directory-title">{t('Customer directory')}</h2>
              <p aria-live="polite" className="shrink-0 text-xs font-medium text-[#65748a]">
                {t('Showing {shown} of {total} customers', { shown: filteredCustomers.length, total: customers.length })}
              </p>
            </div>
            {hasActiveFilters && (
              <button
                className="hidden min-h-9 items-center text-xs font-semibold text-brand-blue underline decoration-[#d1a900] decoration-2 underline-offset-4 hover:text-brand-navy sm:inline-flex"
                onClick={() => { setSearch(''); setStatusFilter('all'); setCityFilter('') }}
                type="button"
              >
                {t('Clear filters')}
              </button>
            )}
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2 pb-3 lg:grid-cols-[minmax(0,1fr)_10rem_10rem]">
            <label className="relative col-span-2 block min-w-0 lg:col-span-1">
              <span className="sr-only">{t('Search customers')}</span>
              <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#65748a]" path={icons.search} />
              <input className={`${inputClassName} pl-9`} onChange={(event) => setSearch(event.target.value)} placeholder={t('Name, email, or phone')} type="search" value={search} />
            </label>
            <label className="hidden min-w-0 lg:block">
              <span className="sr-only">{t('City')}</span>
              <select className={inputClassName} onChange={(event) => setCityFilter(event.target.value)} value={cityFilter}>
                <option value="">{t('All cities')}</option>
                {cities.map((city) => <option key={city} value={city}>{t(city)}</option>)}
              </select>
            </label>
            <label className="hidden min-w-0 lg:block">
              <span className="sr-only">{t('Sort by')}</span>
              <select className={inputClassName} onChange={(event) => setSortBy(event.target.value)} value={sortBy}>
                <option value="newest">{t('Sort: Newest first')}</option>
                <option value="oldest">{t('Sort: Oldest first')}</option>
                <option value="name">{t('Sort: Name (A–Z)')}</option>
              </select>
            </label>
            <details className="relative lg:col-span-2 lg:hidden">
              <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg border border-[#dce3eb] px-3 text-sm font-semibold text-brand-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow-deep [&::-webkit-details-marker]:hidden">
                {t('Filters')}
              </summary>
              <div className="absolute right-0 z-10 mt-2 grid w-[min(18rem,calc(100vw-3rem))] gap-2 rounded-lg border border-[#dce3eb] bg-white p-3">
                <label>
                  <span className="sr-only">{t('City')}</span>
                  <select className={inputClassName} onChange={(event) => setCityFilter(event.target.value)} value={cityFilter}>
                    <option value="">{t('All cities')}</option>
                    {cities.map((city) => <option key={city} value={city}>{t(city)}</option>)}
                  </select>
                </label>
                <label>
                  <span className="sr-only">{t('Sort by')}</span>
                  <select className={inputClassName} onChange={(event) => setSortBy(event.target.value)} value={sortBy}>
                    <option value="newest">{t('Sort: Newest first')}</option>
                    <option value="oldest">{t('Sort: Oldest first')}</option>
                    <option value="name">{t('Sort: Name (A–Z)')}</option>
                  </select>
                </label>
                {hasActiveFilters && (
                  <button
                    className="min-h-10 text-left text-sm font-semibold text-brand-blue"
                    onClick={() => { setSearch(''); setStatusFilter('all'); setCityFilter('') }}
                    type="button"
                  >
                    {t('Clear filters')}
                  </button>
                )}
              </div>
            </details>
          </div>
          <div aria-label={t('Status')} className="flex min-w-0 max-w-full gap-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group">
            {([
              { key: 'all', label: t('All'), count: customers.length },
              { key: 'active', label: t('Active'), count: counts.active },
              { key: 'whatsapp', label: t('Reachable on WhatsApp'), count: counts.whatsapp },
              { key: 'new', label: t('New this month'), count: counts.new },
              { key: 'banned', label: t('Banned'), count: counts.banned },
            ] as const).map((option) => (
              <button
                aria-pressed={statusFilter === option.key}
                className={`inline-flex min-h-10 shrink-0 items-center gap-2 border-b-2 px-1 text-xs font-semibold transition ${statusFilter === option.key ? 'border-[#d1a900] text-brand-navy' : 'border-transparent text-[#65748a] hover:text-brand-navy'}`}
                key={option.key}
                onClick={() => setStatusFilter(option.key)}
                type="button"
              >
                {option.label}
                <span className="tabular-nums text-[#65748a]">{option.count.toLocaleString(locale)}</span>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="divide-y divide-[#f4f6f8]" role="status">
            <span className="sr-only">{t('Loading customers…')}</span>
            {[0, 1, 2, 3].map((row) => (
              <div aria-hidden="true" className="grid grid-cols-2 gap-x-3 gap-y-3 py-4 xl:grid-cols-[minmax(13rem,1.6fr)_minmax(8rem,1fr)_minmax(6.5rem,.7fr)_minmax(6.5rem,.75fr)_auto] xl:items-center xl:gap-4" key={row}>
                <span className="col-span-2 flex items-center gap-3 xl:col-span-1">
                  <span className="size-10 shrink-0 rounded-full bg-[#e9edf2]" />
                  <span className="space-y-2">
                    <span className="block h-3 w-36 rounded bg-[#e9edf2]" />
                    <span className="block h-3 w-48 max-w-full rounded bg-[#e9edf2]" />
                  </span>
                </span>
                <span className="h-3 w-28 rounded bg-[#e9edf2]" />
                <span className="h-3 w-20 rounded bg-[#e9edf2]" />
                <span className="h-3 w-24 rounded bg-[#e9edf2]" />
                <span className="col-span-2 h-3 w-32 rounded bg-[#e9edf2] xl:col-span-1" />
              </div>
            ))}
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="border-y border-dashed border-[#dce3eb] py-8 text-center">
            <p className="text-sm font-semibold text-brand-navy">{t(customers.length ? 'No customers match your search.' : 'No customer accounts yet.')}</p>
            {!customers.length && <p className="mx-auto mt-1 max-w-sm text-sm text-[#65748a]">{t('Customers appear here as soon as they create an account on the website.')}</p>}
            {hasActiveFilters && (
              <button className="mt-3 min-h-10 rounded-lg px-3 text-sm font-semibold text-brand-blue underline decoration-[#d1a900] decoration-2 underline-offset-4" onClick={() => { setSearch(''); setStatusFilter('all'); setCityFilter('') }} type="button">
                {t('Clear filters')}
              </button>
            )}
          </div>
        ) : (
          <>
            <div aria-hidden="true" className="hidden grid-cols-[minmax(13rem,1.6fr)_minmax(8rem,1fr)_minmax(6.5rem,.7fr)_minmax(6.5rem,.75fr)_auto] gap-4 border-b border-[#dce3eb] px-3 py-2.5 text-xs font-medium text-[#65748a] xl:grid">
              <span>{t('Customer')}</span>
              <span>{t('Phone')}</span>
              <span>{t('City')}</span>
              <span>{t('Joined')}</span>
              <span className="text-right">{t('Status')}</span>
            </div>
            <ul className="divide-y divide-[#f4f6f8]">
            {filteredCustomers.map((customer) => {
                  const link = whatsappLink(customer)
                  const isCurrentRecipient = currentRecipient?.id === customer.id
                  return (
                    <li className={`grid grid-cols-2 gap-x-3 gap-y-3 px-3 py-4 transition-colors hover:bg-[#fbfcfe] sm:px-4 xl:grid-cols-[minmax(13rem,1.6fr)_minmax(8rem,1fr)_minmax(6.5rem,.7fr)_minmax(6.5rem,.75fr)_auto] xl:items-center xl:gap-4 xl:px-3 ${isCurrentRecipient ? 'bg-[#eefbf3]' : ''} ${savingId === customer.id ? 'opacity-60' : ''}`} key={customer.id}>
                      <div className="col-span-2 flex min-w-0 items-center gap-3 xl:col-span-1">
                          <span aria-hidden="true" className={`relative grid size-10 shrink-0 place-items-center rounded-full text-xs font-bold ${customer.isBanned ? 'bg-[#f4f6f8] text-[#65748a]' : 'bg-[#e9f1fa] text-[#245281]'}`}>
                            {initials(customer.name)}
                            {isNew(customer) && !customer.isBanned && <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-brand-yellow ring-2 ring-white" />}
                          </span>
                          <div className="min-w-0">
                            <p className={`truncate text-sm font-semibold ${customer.isBanned ? 'text-[#65748a] line-through decoration-[#c3ccd7]' : 'text-brand-navy'}`}>{customer.name}</p>
                            <button
                              className="flex min-h-8 max-w-full items-center gap-1 text-xs text-[#65748a] hover:text-brand-navy focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-brand-yellow-deep"
                              onClick={() => copyEmail(customer)}
                              title={t('Copy')}
                              type="button"
                            >
                              <span className="truncate">{customer.email}</span>
                              <Icon className="size-3.5 shrink-0" path={copiedId === customer.id ? icons.check : icons.copy} />
                            </button>
                          </div>
                      </div>
                      <div className="min-w-0 self-center">
                        <span className="mb-1 block text-xs font-medium text-[#65748a] xl:hidden">{t('Phone')}</span>
                        {customer.phone ? (
                          <a className="inline-flex min-h-8 items-center gap-1.5 text-xs font-medium text-brand-blue hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-brand-yellow-deep" href={`tel:${customer.phone}`}>
                            <Icon className="size-3.5 shrink-0 text-[#65748a]" path={icons.phone} />
                            <span className="truncate">{customer.phone}</span>
                          </a>
                        ) : (
                          <span className="text-xs text-[#65748a]">{t('No phone number provided')}</span>
                        )}
                      </div>
                      <div className="min-w-0 self-center">
                        <span className="mb-1 block text-xs font-medium text-[#65748a] xl:hidden">{t('City')}</span>
                        {customer.deliveryCity ? (
                          <span className="inline-flex max-w-full items-center gap-1.5 truncate text-xs font-medium text-[#65748a]">
                            <Icon className="size-3.5 shrink-0 text-[#65748a]" path={icons.pin} />
                            <span className="truncate">{t(customer.deliveryCity)}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-[#65748a]">—</span>
                        )}
                      </div>
                      <div className="self-center text-xs font-medium text-[#65748a]">
                        <span className="mb-1 block text-xs font-medium text-[#65748a] xl:hidden">{t('Joined')}</span>
                        {joinedDate(customer.createdAt)}
                      </div>
                      <div className="col-span-2 flex min-w-0 items-center justify-between gap-2 xl:col-span-1 xl:justify-end">
                        <span className={`inline-flex min-h-6 items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-xs font-semibold ${customer.isBanned ? 'bg-[#fdeeee] text-[#8e3731]' : 'bg-[#eaf6ee] text-[#246a46]'}`}>
                          <span aria-hidden="true" className={`size-1.5 rounded-full ${customer.isBanned ? 'bg-[#d2544b]' : 'bg-[#35a36b]'}`} />
                          {t(customer.isBanned ? 'Banned' : 'Active')}
                        </span>
                        <div className="flex shrink-0 items-center gap-1">
                          {link ? (
                            <a
                              aria-label={`${t('Message on WhatsApp')}: ${customer.name}`}
                              className="grid size-10 place-items-center rounded-lg text-[#1f8f4e] transition hover:bg-[#e7f7eb] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-yellow-deep xl:size-9"
                              href={link}
                              rel="noreferrer"
                              target="_blank"
                              title={t('Message on WhatsApp')}
                            >
                              <WhatsAppIcon />
                            </a>
                          ) : (
                            <span
                              aria-label={t(!customer.phone ? 'This customer has no phone number.' : 'This customer phone number is invalid.')}
                              className="grid size-10 cursor-not-allowed place-items-center rounded-lg text-[#c3ccd7] xl:size-9"
                              title={t(!customer.phone ? 'This customer has no phone number.' : 'This customer phone number is invalid.')}
                            >
                              <WhatsAppIcon />
                            </span>
                          )}
                          <a
                            aria-label={`${t('Email')}: ${customer.name}`}
                            className="grid size-10 place-items-center rounded-lg text-[#65748a] transition hover:bg-[#f4f6f8] hover:text-brand-navy focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-yellow-deep xl:size-9"
                            href={`mailto:${customer.email}`}
                            title={t('Email')}
                          >
                            <Icon path={icons.mail} />
                          </a>
                          {isOwner && (
                            customer.isBanned ? (
                              <>
                                <button
                                  className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold text-brand-blue transition hover:bg-[#f4f6f8] hover:text-brand-navy disabled:cursor-wait"
                                  disabled={savingId === customer.id}
                                  onClick={() => setBan(customer, false)}
                                  type="button"
                                >
                                  <Icon path={icons.unban} />
                                  {savingId === customer.id ? t('Saving…') : t('Unban customer')}
                                </button>
                                <button
                                  aria-label={`${t('Delete banned account')}: ${customer.name}`}
                                  className="grid size-10 place-items-center rounded-lg text-[#9b3530] transition hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-yellow-deep disabled:opacity-50 xl:size-9"
                                  disabled={savingId === customer.id}
                                  onClick={() => { setError(''); setCustomerToDelete(customer) }}
                                  title={t('Delete banned account')}
                                  type="button"
                                >
                                  <Icon path={icons.trash} />
                                </button>
                              </>
                            ) : (
                              <button
                                aria-label={`${t('Ban customer')}: ${customer.name}`}
                                className="grid size-10 place-items-center rounded-lg text-[#65748a] transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-yellow-deep xl:size-9"
                                onClick={() => { setError(''); setCustomerToBan(customer) }}
                                title={t('Ban customer')}
                                type="button"
                              >
                                <Icon path={icons.ban} />
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
            </ul>
          </>
        )}
      </section>

      {isComposerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
          <button aria-label={t('Close')} className="admin-drawer-backdrop absolute inset-0 bg-[#0b1e36]/45 backdrop-blur-[2px]" onClick={() => setIsComposerOpen(false)} tabIndex={-1} type="button" />
          <section aria-labelledby="campaign-title" aria-modal="true" className="admin-drawer-panel relative flex h-full w-full max-w-[32rem] flex-col bg-white shadow-[-24px_0_60px_rgba(9,42,83,0.18)]" role="dialog">
            <header className="flex items-start justify-between gap-4 border-b border-[#f4f6f8] px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-md bg-[#25d366] text-[#0f3d26]"><WhatsAppIcon className="size-5" /></span>
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#1f8f4e]">{t('WhatsApp campaign')}</p>
                  <h2 className="text-base font-semibold text-brand-navy" id="campaign-title">{t('Promotion message')}</h2>
                </div>
              </div>
              <button aria-label={t('Close')} className="grid size-9 shrink-0 place-items-center rounded-md text-[#65748a] transition hover:bg-[#f4f6f8] hover:text-brand-navy" onClick={() => setIsComposerOpen(false)} type="button">
                <Icon className="size-5" path={icons.close} />
              </button>
            </header>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6">
              <div className="flex items-center gap-3 rounded-md bg-[#eefbf3] p-4 ring-1 ring-[#cdeed9]">
                <span className="text-xl font-semibold tracking-tight text-[#1f8f4e]">{counts.whatsapp}</span>
                <p className="text-xs font-semibold leading-5 text-[#2c6a45]">{t('Active customers with a valid WhatsApp number will receive this message.')}</p>
              </div>

              <div>
                <label className="flex items-center justify-between gap-2 text-xs font-bold text-[#65748a]" htmlFor="promotion-message">
                  <span>{t('Message for customers')}</span>
                  <span className="font-semibold text-[#a3b0bf]">{promotionMessage.length}/1000</span>
                </label>
                <textarea
                  autoFocus
                  className={`${inputClassName} mt-1.5 min-h-32 resize-y leading-6`}
                  id="promotion-message"
                  maxLength={1000}
                  onChange={(event) => setPromotionMessage(event.target.value)}
                  placeholder={t('Write the promotion message to prepare in WhatsApp.')}
                  value={promotionMessage}
                />
                <p className="mt-3 text-xs font-extrabold uppercase tracking-[0.14em] text-[#65748a]">{t('Quick templates')}</p>
                <div className="mt-2 space-y-1.5">
                  {templates.map((template) => (
                    <button
                      className="block w-full rounded-md bg-[#f4f6f8] px-3 py-2 text-left text-xs leading-5 text-[#65748a] ring-1 ring-[#dce3eb] transition hover:bg-white hover:text-brand-navy hover:ring-[#dce3eb]"
                      key={template}
                      onClick={() => setPromotionMessage(template)}
                      type="button"
                    >
                      {template}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#65748a]">{t('Preview')}</p>
                <div className="mt-2 rounded-md bg-[#f4f6f8] p-4">
                  <div className="ml-auto max-w-[85%] rounded-md rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-sm leading-6 text-[#111b21]">
                    <p className="whitespace-pre-wrap break-words">{promotionMessage.trim() || t('Your message will appear here.')}</p>
                    <p className="mt-0.5 text-right text-xs text-[#667781]">
                      {new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 rounded-md bg-[#f4f6f8] p-3.5 text-xs leading-5 text-[#65748a] ring-1 ring-[#dce3eb]">
                <Icon className="mt-0.5 size-4 shrink-0 text-[#315982]" path={icons.info} />
                <span>
                  <span className="block font-bold text-[#65748a]">{t('Admin sends the message')}</span>
                  {t('Opens WhatsApp chats one at a time for active customers with valid phone numbers. You review and send each message.')}
                </span>
              </div>

              {error && (
                <p className="flex items-start gap-2 rounded-md bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100" role="alert">
                  <Icon className="mt-0.5 size-4 shrink-0" path={icons.alert} />
                  {error}
                </p>
              )}
            </div>

            <footer className="flex items-center justify-end gap-3 border-t border-[#f4f6f8] bg-[#f4f6f8] px-6 py-4">
              <button className="min-h-10 rounded-md px-4 text-sm font-bold text-[#65748a] transition hover:bg-[#f4f6f8] hover:text-brand-navy" onClick={() => setIsComposerOpen(false)} type="button">{t('Cancel')}</button>
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[#16733f] px-5 text-sm font-bold text-white transition hover:bg-[#125f34] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!promotionMessage.trim() || !counts.whatsapp}
                onClick={sendPromotionToAll}
                type="button"
              >
                <WhatsAppIcon />
                {t('Send to all')}
              </button>
            </footer>
          </section>
        </div>
      )}

      {customerToBan && (
        <div className="fixed inset-0 z-50 grid place-items-center px-5" role="presentation">
          <button aria-label={t('Cancel')} className="admin-drawer-backdrop absolute inset-0 bg-[#0b1e36]/45 backdrop-blur-[2px]" onClick={() => setCustomerToBan(null)} tabIndex={-1} type="button" />
          <section aria-labelledby="ban-customer-title" aria-modal="true" className="admin-modal-panel relative w-full max-w-md rounded-md bg-white p-6 shadow-[0_30px_80px_rgba(9,42,83,0.3)]" role="dialog">
            <span className="grid size-12 place-items-center rounded-md bg-red-50 text-red-600"><Icon className="size-6" path={icons.ban} /></span>
            <h2 className="mt-4 text-base font-semibold text-brand-navy" id="ban-customer-title">{t('Ban customer')}</h2>
            <div className="mt-4 flex items-center gap-3 rounded-md bg-[#f4f6f8] p-3 ring-1 ring-[#dce3eb]">
              <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-[#e9f1fa] text-xs font-bold text-[#245281]">{initials(customerToBan.name)}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-brand-navy">{customerToBan.name}</p>
                <p className="truncate text-xs text-[#65748a]">{customerToBan.email}</p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#65748a]">{t('They will no longer be able to sign in or place orders. You can unban them at any time.')}</p>
            {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700" role="alert">{error}</p>}
            <div className="mt-6 flex justify-end gap-2.5">
              <button className="min-h-10 rounded-md px-4 text-sm font-bold text-[#65748a] transition hover:bg-[#f4f6f8]" onClick={() => setCustomerToBan(null)} type="button">{t('Cancel')}</button>
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-md bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-wait disabled:opacity-60"
                disabled={savingId === customerToBan.id}
                onClick={() => setBan(customerToBan, true)}
                type="button"
              >
                <Icon path={icons.ban} />
                {savingId === customerToBan.id ? t('Saving…') : t('Ban customer')}
              </button>
            </div>
          </section>
        </div>
      )}
      {customerToDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center px-5" role="presentation">
          <button aria-label={t('Cancel')} className="admin-drawer-backdrop absolute inset-0 bg-[#0b1e36]/45 backdrop-blur-[2px]" onClick={() => setCustomerToDelete(null)} tabIndex={-1} type="button" />
          <section aria-labelledby="delete-customer-title" aria-modal="true" className="admin-modal-panel relative w-full max-w-md rounded-md bg-white p-6 shadow-[0_30px_80px_rgba(9,42,83,0.3)]" role="dialog">
            <span className="grid size-12 place-items-center rounded-md bg-red-50 text-red-600"><Icon className="size-6" path={icons.trash} /></span>
            <h2 className="mt-4 text-base font-semibold text-brand-navy" id="delete-customer-title">{t('Delete banned account')}</h2>
            <div className="mt-4 flex items-center gap-3 rounded-md bg-[#f4f6f8] p-3 ring-1 ring-[#dce3eb]">
              <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-[#e9f1fa] text-xs font-bold text-[#245281]">{initials(customerToDelete.name)}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-brand-navy">{customerToDelete.name}</p>
                <p className="truncate text-xs text-[#65748a]">{customerToDelete.email}</p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#65748a]">{t('This permanently deletes the banned customer account and associated account data. Existing order records are retained.')}</p>
            {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700" role="alert">{error}</p>}
            <div className="mt-6 flex justify-end gap-2.5">
              <button className="min-h-10 rounded-md px-4 text-sm font-bold text-[#65748a] transition hover:bg-[#f4f6f8]" disabled={savingId === customerToDelete.id} onClick={() => setCustomerToDelete(null)} type="button">{t('Cancel')}</button>
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-md bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-wait disabled:opacity-60"
                disabled={savingId === customerToDelete.id}
                onClick={deleteBannedCustomer}
                type="button"
              >
                <Icon path={icons.trash} />
                {savingId === customerToDelete.id ? t('Deleting…') : t('Delete account')}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
