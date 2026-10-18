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

const inputClassName = 'w-full rounded-xl border border-[#dde4ec] bg-[#f8fafc] px-3.5 py-2.5 text-sm font-medium text-[#102c50] transition placeholder:text-[#9aa5b3] hover:border-[#c9d4e0] focus:border-[#bd9c00] focus:bg-white focus:ring-4 focus:ring-[#ffdc32]/25 outline-none!'
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
  alert: 'M12 8v5m0 3.5v.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  mail: 'M4 6h16v12H4V6Zm0 0 8 7 8-7',
  phone: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm3 15h2',
  pin: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  copy: 'M9 9h10v10H9V9Zm-4 6V5h10',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  unlock: 'M6 11h12v9H6v-9Zm2 0V8a4 4 0 0 1 7.5-2',
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

const avatarTones = ['bg-[#e9f1fa] text-[#245281]', 'bg-[#fff4c2] text-[#7a6300]', 'bg-[#e5f4ea] text-[#2c7a4f]', 'bg-[#efe9fb] text-[#5b3fa0]', 'bg-[#fdecea] text-[#a53f37]']

function avatarTone(name: string) {
  const sum = [...String(name)].reduce((total, character) => total + character.charCodeAt(0), 0)
  return avatarTones[sum % avatarTones.length]
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
  const isOverlayOpen = isComposerOpen || Boolean(customerToBan)

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
    const blob = new Blob([`﻿${rows.map((row) => row.map(escape).join(',')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' })
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
    t('🍦 This weekend only: buy 2 scoops and get the 3rd free at Cold Stone Cameroon!'),
    t('🎂 Planning a celebration? Order a custom ice cream cake today and we will make it unforgettable.'),
    t('✨ New flavors just arrived! Come taste them first at your nearest Cold Stone store.'),
  ]

  const metrics: { key: StatusFilter; label: string; value: number; icon: string; accent: string }[] = [
    { key: 'active', label: 'Active accounts', value: counts.active, icon: icons.check, accent: 'bg-[#e5f4ea] text-[#2c7a4f]' },
    { key: 'new', label: 'New this month', value: counts.new, icon: icons.sparkle, accent: 'bg-[#fff4c2] text-[#8a6f00]' },
    { key: 'banned', label: 'Restricted accounts', value: counts.banned, icon: icons.ban, accent: 'bg-[#fdecea] text-[#b2433a]' },
  ]

  const currentRecipient = promotionCampaign ? promotionCampaign.recipients[promotionCampaign.currentIndex] : null
  const campaignProgress = promotionCampaign ? ((promotionCampaign.currentIndex + 1) / promotionCampaign.recipients.length) * 100 : 0

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-col gap-5 border-b border-[#edf1f5] pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#092a53] text-[#ffdc32]">
            <Icon className="size-7" path={icons.users} />
          </span>
          <div className="min-w-0">
            <nav aria-label={t('Breadcrumb')} className="text-[11px] font-bold text-[#8190a1]">
              {t('Customer management')} <span aria-hidden="true" className="mx-1">/</span>
              <span className="text-[#8a7000]">{t('Customer accounts')}</span>
            </nav>
            <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-[#092a53] sm:text-[1.9rem]">{t('Customer accounts')}</h1>
            <p className="mt-0.5 max-w-2xl text-sm text-[#65748a]">{t('View registered customers, manage account access, and prepare promotion messages for WhatsApp.')}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            aria-label={t('Refresh customer accounts')}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#dce5ef] bg-white px-4 text-sm font-bold text-[#355777] transition hover:border-[#bacbdc] hover:bg-[#f6f9fc] hover:text-[#092a53] disabled:opacity-50"
            disabled={loading || refreshing}
            onClick={() => {
              setRefreshing(true)
              setRefreshKey((current) => current + 1)
            }}
            type="button"
          >
            <Icon className={refreshing ? 'size-4 animate-spin' : 'size-4'} path={icons.refresh} />
            {t(refreshing ? 'Refreshing…' : 'Refresh')}
          </button>
          <button
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#dce5ef] bg-white px-4 text-sm font-bold text-[#355777] transition hover:border-[#bacbdc] hover:bg-[#f6f9fc] hover:text-[#092a53] disabled:opacity-50"
            disabled={!filteredCustomers.length}
            onClick={exportCsv}
            type="button"
          >
            <Icon path={icons.download} />
            {t('Export CSV')}
          </button>
          {isOwner && (
            <button
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#16733f] px-4 text-sm font-bold text-white shadow-[0_6px_16px_rgba(22,115,63,0.22)] transition hover:-translate-y-0.5 hover:bg-[#125f34] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={loading || promotionCampaign !== null}
              onClick={() => { setError(''); setIsComposerOpen(true) }}
              type="button"
            >
              <Icon path={icons.megaphone} />
              {t('WhatsApp campaign')}
            </button>
          )}
        </div>
      </header>

      {message && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-[#eaf6ee] px-4 py-3 text-sm font-semibold text-[#1f5d3c] ring-1 ring-[#cfe8d8]" role="status">
          <span className="flex items-center gap-2"><Icon path={icons.check} />{message}</span>
          <button aria-label={t('Dismiss')} className="grid size-7 shrink-0 place-items-center rounded-lg transition hover:bg-[#d7eedf]" onClick={() => setMessage('')} type="button">
            <Icon className="size-3.5" path={icons.close} />
          </button>
        </div>
      )}
      {error && !isOverlayOpen && (
        <p className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100" role="alert">
          <Icon className="mt-0.5 size-4 shrink-0" path={icons.alert} />
          {error}
        </p>
      )}

      {promotionCampaign && currentRecipient && (
        <section aria-label={t('WhatsApp campaign')} className="sticky top-[84px] z-20 overflow-hidden rounded-2xl bg-[#0f3d26] text-white shadow-[0_14px_32px_rgba(15,61,38,0.25)]">
          <div className="h-1 bg-white/10">
            <div className="h-full bg-[#25d366] transition-[width] duration-500" style={{ width: `${campaignProgress}%` }} />
          </div>
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#25d366] text-[#0f3d26]"><WhatsAppIcon className="size-5" /></span>
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

      <section aria-label={t('Customer overview')} className="admin-stats grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map((metric) => {
          const isActive = statusFilter === metric.key && metric.key !== 'all'
          return (
            <button
              aria-pressed={isActive}
              className={`group rounded-2xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(18,44,80,0.07)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] sm:p-5 ${isActive ? 'border-[#092a53] shadow-[0_0_0_1px_#092a53]' : 'border-[#e5ebf3]'}`}
              key={metric.key}
              onClick={() => setStatusFilter(isActive || metric.key === 'all' ? 'all' : metric.key)}
              type="button"
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`grid size-9 place-items-center rounded-xl ${metric.accent}`}><Icon path={metric.icon} /></span>
                {metric.key !== 'all' && (
                  <span className="text-[10px] font-bold text-[#a3b0bf] opacity-0 transition group-hover:opacity-100">{t(isActive ? 'Clear filter' : 'Filter')}</span>
                )}
              </div>
              <p className="mt-4 font-display text-[1.75rem] font-extrabold leading-none tracking-tight text-[#102c50]">{metric.value.toLocaleString(locale)}</p>
              <p className="mt-1.5 text-xs font-semibold text-[#65748a]">{t(metric.label)}</p>
            </button>
          )
        })}
      </section>

      <section aria-labelledby="customer-directory-title" className="min-w-0 rounded-[20px] border border-[#e5ebf3] bg-white">
        <div className="flex flex-col gap-4 border-b border-[#edf1f5] p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-extrabold text-[#092a53]" id="customer-directory-title">{t('Customer directory')}</h2>
              <p aria-live="polite" className="mt-0.5 text-xs text-[#65748a]">
                {t('Showing {shown} of {total} customers', { shown: filteredCustomers.length, total: customers.length })}
              </p>
            </div>
            {hasActiveFilters && (
              <button
                className="text-xs font-bold text-[#355777] underline decoration-[#ffdc32] decoration-2 underline-offset-4 hover:text-[#092a53]"
                onClick={() => { setSearch(''); setStatusFilter('all'); setCityFilter('') }}
                type="button"
              >
                {t('Clear filters')}
              </button>
            )}
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
            <label className="relative block">
              <span className="sr-only">{t('Search customers')}</span>
              <Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#8190a1]" path={icons.search} />
              <input className={`${inputClassName} pl-10`} onChange={(event) => setSearch(event.target.value)} placeholder={t('Name, email, or phone')} type="search" value={search} />
            </label>
            <label className="block">
              <span className="sr-only">{t('City')}</span>
              <select className={`${inputClassName} lg:w-48`} onChange={(event) => setCityFilter(event.target.value)} value={cityFilter}>
                <option value="">{t('All cities')}</option>
                {cities.map((city) => <option key={city} value={city}>{t(city)}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="sr-only">{t('Sort by')}</span>
              <select className={`${inputClassName} lg:w-48`} onChange={(event) => setSortBy(event.target.value)} value={sortBy}>
                <option value="newest">{t('Sort: Newest first')}</option>
                <option value="oldest">{t('Sort: Oldest first')}</option>
                <option value="name">{t('Sort: Name (A–Z)')}</option>
              </select>
            </label>
          </div>
          <div aria-label={t('Status')} className="flex w-fit max-w-full overflow-x-auto rounded-xl bg-[#f1f4f8] p-1" role="group">
            {([
              { key: 'all', label: t('All') },
              { key: 'active', label: t('Active') },
              { key: 'whatsapp', label: t('Reachable on WhatsApp') },
              { key: 'new', label: t('New this month') },
              { key: 'banned', label: t('Banned') },
            ] as const).map((option) => (
              <button
                aria-pressed={statusFilter === option.key}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition ${statusFilter === option.key ? 'bg-white text-[#092a53] shadow-sm' : 'text-[#65748a] hover:text-[#092a53]'}`}
                key={option.key}
                onClick={() => setStatusFilter(option.key)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 p-4 sm:p-5" role="status">
            <span className="sr-only">{t('Loading customers…')}</span>
            {[0, 1, 2, 3].map((row) => (
              <div aria-hidden="true" className="flex animate-pulse items-center gap-4" key={row}>
                <span className="size-10 rounded-full bg-[#eef2f6]" />
                <span className="h-3 flex-1 rounded bg-[#eef2f6]" />
                <span className="h-3 w-24 rounded bg-[#eef2f6]" />
              </div>
            ))}
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#f1f4f8] text-[#8190a1]"><Icon className="size-5" path={customers.length ? icons.search : icons.users} /></span>
            <p className="mt-4 font-display text-lg font-extrabold text-[#092a53]">{t(customers.length ? 'No customers match your search.' : 'No customer accounts yet.')}</p>
            {!customers.length && <p className="mx-auto mt-1 max-w-sm text-sm text-[#8190a1]">{t('Customers appear here as soon as they create an account on the website.')}</p>}
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#edf1f5] text-[11px] uppercase tracking-[0.08em] text-[#8190a1]">
                  <th className="px-5 py-3 font-extrabold" scope="col">{t('Customer')}</th>
                  <th className="px-3 py-3 font-extrabold" scope="col">{t('Phone')}</th>
                  <th className="px-3 py-3 font-extrabold" scope="col">{t('City')}</th>
                  <th className="px-3 py-3 font-extrabold" scope="col">{t('Joined')}</th>
                  <th className="px-3 py-3 font-extrabold" scope="col">{t('Status')}</th>
                  <th className="px-5 py-3 text-right font-extrabold" scope="col"><span className="sr-only">{t('Action')}</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f3f7]">
                {filteredCustomers.map((customer) => {
                  const link = whatsappLink(customer)
                  const isCurrentRecipient = currentRecipient?.id === customer.id
                  return (
                    <tr className={`transition hover:bg-[#fafbfd] ${isCurrentRecipient ? 'bg-[#eefbf3]' : ''} ${savingId === customer.id ? 'opacity-60' : ''}`} key={customer.id}>
                      <td className="px-5 py-3.5">
                        <div className="flex min-w-0 items-center gap-3">
                          <span aria-hidden="true" className={`relative grid size-10 shrink-0 place-items-center rounded-full text-xs font-extrabold ${customer.isBanned ? 'bg-[#f1f4f8] text-[#94a3b4]' : avatarTone(customer.name)}`}>
                            {initials(customer.name)}
                            {isNew(customer) && !customer.isBanned && <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-[#ffdc32] ring-2 ring-white" />}
                          </span>
                          <div className="min-w-0">
                            <p className={`max-w-[14rem] truncate font-bold ${customer.isBanned ? 'text-[#8190a1] line-through decoration-[#c3ccd7]' : 'text-[#102c50]'}`}>{customer.name}</p>
                            <button
                              className="flex max-w-[14rem] items-center gap-1 text-[11px] text-[#8190a1] hover:text-[#092a53]"
                              onClick={() => copyEmail(customer)}
                              title={t('Copy')}
                              type="button"
                            >
                              <span className="truncate">{customer.email}</span>
                              <Icon className="size-3 shrink-0" path={copiedId === customer.id ? icons.check : icons.copy} />
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        {customer.phone ? (
                          <a className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#355777] hover:underline" href={`tel:${customer.phone}`}>
                            <Icon className="size-3.5 text-[#8190a1]" path={icons.phone} />
                            {customer.phone}
                          </a>
                        ) : (
                          <span className="text-xs text-[#a3b0bf]">{t('No phone number provided')}</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5">
                        {customer.deliveryCity ? (
                          <span className="inline-flex max-w-[11rem] items-center gap-1 truncate rounded-full bg-[#f1f4f8] px-2.5 py-1 text-[11px] font-bold text-[#4f6379]">
                            <Icon className="size-3 shrink-0" path={icons.pin} />
                            <span className="truncate">{t(customer.deliveryCity)}</span>
                          </span>
                        ) : (
                          <span className="text-[#c3ccd7]">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-xs font-semibold text-[#4f6379]">{joinedDate(customer.createdAt)}</td>
                      <td className="px-3 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${customer.isBanned ? 'bg-[#fdeeee] text-[#a53f37] ring-[#f3d1ce]' : 'bg-[#eaf6ee] text-[#246a46] ring-[#cfe8d8]'}`}>
                          <span aria-hidden="true" className={`size-1.5 rounded-full ${customer.isBanned ? 'bg-[#d2544b]' : 'bg-[#35a36b]'}`} />
                          {t(customer.isBanned ? 'Banned' : 'Active')}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          {link ? (
                            <a
                              aria-label={`${t('Message on WhatsApp')}: ${customer.name}`}
                              className="grid size-8 place-items-center rounded-lg text-[#1f8f4e] transition hover:bg-[#e7f7eb]"
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
                              className="grid size-8 cursor-not-allowed place-items-center rounded-lg text-[#c3ccd7]"
                              title={t(!customer.phone ? 'This customer has no phone number.' : 'This customer phone number is invalid.')}
                            >
                              <WhatsAppIcon />
                            </span>
                          )}
                          <a
                            aria-label={`${t('Email')}: ${customer.name}`}
                            className="grid size-8 place-items-center rounded-lg text-[#6b7d91] transition hover:bg-[#eef2f7] hover:text-[#092a53]"
                            href={`mailto:${customer.email}`}
                            title={t('Email')}
                          >
                            <Icon path={icons.mail} />
                          </a>
                          {isOwner && (
                            customer.isBanned ? (
                              <button
                                className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold text-[#355777] transition hover:bg-[#eef2f7] hover:text-[#092a53] disabled:cursor-wait"
                                disabled={savingId === customer.id}
                                onClick={() => setBan(customer, false)}
                                type="button"
                              >
                                <Icon path={icons.unlock} />
                                {savingId === customer.id ? t('Saving…') : t('Unban customer')}
                              </button>
                            ) : (
                              <button
                                aria-label={`${t('Ban customer')}: ${customer.name}`}
                                className="grid size-8 place-items-center rounded-lg text-[#6b7d91] transition hover:bg-red-50 hover:text-red-600"
                                onClick={() => { setError(''); setCustomerToBan(customer) }}
                                title={t('Ban customer')}
                                type="button"
                              >
                                <Icon path={icons.ban} />
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isComposerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
          <button aria-label={t('Close')} className="admin-drawer-backdrop absolute inset-0 bg-[#0b1e36]/45 backdrop-blur-[2px]" onClick={() => setIsComposerOpen(false)} tabIndex={-1} type="button" />
          <section aria-labelledby="campaign-title" aria-modal="true" className="admin-drawer-panel relative flex h-full w-full max-w-[32rem] flex-col bg-white shadow-[-24px_0_60px_rgba(9,42,83,0.18)]" role="dialog">
            <header className="flex items-start justify-between gap-4 border-b border-[#edf1f5] px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-[#25d366] text-[#0f3d26]"><WhatsAppIcon className="size-5" /></span>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#1f8f4e]">{t('WhatsApp campaign')}</p>
                  <h2 className="font-display text-xl font-extrabold text-[#092a53]" id="campaign-title">{t('Promotion message')}</h2>
                </div>
              </div>
              <button aria-label={t('Close')} className="grid size-9 shrink-0 place-items-center rounded-xl text-[#65748a] transition hover:bg-[#f1f4f8] hover:text-[#092a53]" onClick={() => setIsComposerOpen(false)} type="button">
                <Icon className="size-5" path={icons.close} />
              </button>
            </header>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6">
              <div className="flex items-center gap-3 rounded-2xl bg-[#eefbf3] p-4 ring-1 ring-[#cdeed9]">
                <span className="font-display text-3xl font-extrabold text-[#1f8f4e]">{counts.whatsapp}</span>
                <p className="text-xs font-semibold leading-5 text-[#2c6a45]">{t('Active customers with a valid WhatsApp number will receive this message.')}</p>
              </div>

              <div>
                <label className="flex items-center justify-between gap-2 text-xs font-bold text-[#4f6379]" htmlFor="promotion-message">
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
                <p className="mt-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#8190a1]">{t('Quick templates')}</p>
                <div className="mt-2 space-y-1.5">
                  {templates.map((template) => (
                    <button
                      className="block w-full rounded-xl bg-[#f7f9fc] px-3 py-2 text-left text-xs leading-5 text-[#4f6379] ring-1 ring-[#e8edf3] transition hover:bg-white hover:text-[#092a53] hover:ring-[#c3cfdc]"
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
                <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#8190a1]">{t('Preview')}</p>
                <div className="mt-2 rounded-2xl bg-[#e7ddd3] bg-[radial-gradient(#d8ccbf_1px,transparent_1px)] p-4 [background-size:14px_14px]">
                  <div className="ml-auto max-w-[85%] rounded-xl rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-sm leading-6 text-[#111b21] shadow-sm">
                    <p className="whitespace-pre-wrap break-words">{promotionMessage.trim() || t('Your message will appear here.')}</p>
                    <p className="mt-0.5 text-right text-[10px] text-[#667781]">
                      {new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })} ✓✓
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 rounded-xl bg-[#f7f9fc] p-3.5 text-[11px] leading-5 text-[#65748a] ring-1 ring-[#e8edf3]">
                <Icon className="mt-0.5 size-4 shrink-0 text-[#315982]" path={icons.info} />
                <span>
                  <span className="block font-bold text-[#4f6379]">{t('Admin sends the message')}</span>
                  {t('Opens WhatsApp chats one at a time for active customers with valid phone numbers. You review and send each message.')}
                </span>
              </div>

              {error && (
                <p className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100" role="alert">
                  <Icon className="mt-0.5 size-4 shrink-0" path={icons.alert} />
                  {error}
                </p>
              )}
            </div>

            <footer className="flex items-center justify-end gap-3 border-t border-[#edf1f5] bg-[#fafbfd] px-6 py-4">
              <button className="min-h-10 rounded-xl px-4 text-sm font-bold text-[#4f6379] transition hover:bg-[#eef2f6] hover:text-[#092a53]" onClick={() => setIsComposerOpen(false)} type="button">{t('Cancel')}</button>
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#16733f] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#125f34] disabled:cursor-not-allowed disabled:opacity-50"
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
          <section aria-labelledby="ban-customer-title" aria-modal="true" className="admin-modal-panel relative w-full max-w-md rounded-[22px] bg-white p-6 shadow-[0_30px_80px_rgba(9,42,83,0.3)]" role="dialog">
            <span className="grid size-12 place-items-center rounded-2xl bg-red-50 text-red-600"><Icon className="size-6" path={icons.ban} /></span>
            <h2 className="mt-4 font-display text-xl font-extrabold text-[#092a53]" id="ban-customer-title">{t('Ban customer')}</h2>
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-[#f7f9fc] p-3 ring-1 ring-[#e8edf3]">
              <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-full text-xs font-extrabold ${avatarTone(customerToBan.name)}`}>{initials(customerToBan.name)}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[#102c50]">{customerToBan.name}</p>
                <p className="truncate text-xs text-[#7b8796]">{customerToBan.email}</p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#65748a]">{t('They will no longer be able to sign in or place orders. You can unban them at any time.')}</p>
            {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700" role="alert">{error}</p>}
            <div className="mt-6 flex justify-end gap-2.5">
              <button className="min-h-10 rounded-xl px-4 text-sm font-bold text-[#4f6379] transition hover:bg-[#eef2f6]" onClick={() => setCustomerToBan(null)} type="button">{t('Cancel')}</button>
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-wait disabled:opacity-60"
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
    </div>
  )
}
