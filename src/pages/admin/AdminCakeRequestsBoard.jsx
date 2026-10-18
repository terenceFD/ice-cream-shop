import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../../api/api'
import { useLanguage } from '../../language/useLanguage'
import { useAdminAuth } from './useAdminAuth'

const STATUSES = ['new', 'contacted', 'confirmed', 'declined']
const inputClassName =
  'w-full rounded-xl border border-[#dde4ec] bg-[#f8fafc] px-3.5 py-2.5 text-sm font-medium text-[#102c50] transition placeholder:text-[#9aa5b3] hover:border-[#c9d4e0] focus:border-[#bd9c00] focus:bg-white focus:ring-4 focus:ring-[#ffdc32]/25 outline-none!'
const WHATSAPP_PATH = 'M12.04 2a9.9 9.9 0 0 0-8.49 15l-1.3 4.75 4.86-1.27A9.96 9.96 0 1 0 12.04 2Zm0 18.1a8.1 8.1 0 0 1-4.13-1.13l-.3-.18-2.88.75.77-2.8-.2-.3A8.12 8.12 0 1 1 12.04 20.1Zm4.45-6.08c-.24-.12-1.43-.7-1.65-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.43-1.34-1.67-.14-.24-.02-.37.1-.49.1-.1.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.47-.4-.4-.54-.4h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.12 3.64.58.25 1.03.4 1.38.5.58.18 1.1.15 1.51.09.46-.07 1.43-.59 1.63-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.46-.28Z'

const statusMeta = {
  new: { label: 'New request', badge: 'bg-[#fff6e5] text-[#9a6200] ring-[#f6dfb0]', dot: 'bg-[#e0a100]', column: 'bg-[#fffaf0]', icon: 'M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5m7 7L18 18m0-12-2.5 2.5m-7 7L6 18' },
  contacted: { label: 'Quote sent', badge: 'bg-[#e9f1fa] text-[#245281] ring-[#cfe0f2]', dot: 'bg-[#3b7dd8]', column: 'bg-[#f5f9fd]', icon: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z' },
  confirmed: { label: 'Deposit paid', badge: 'bg-[#eaf6ee] text-[#246a46] ring-[#cfe8d8]', dot: 'bg-[#35a36b]', column: 'bg-[#f4fbf6]', icon: 'm5 12.5 4.5 4.5L19 7.5' },
  declined: { label: 'declined', badge: 'bg-[#fdeeee] text-[#a53f37] ring-[#f3d1ce]', dot: 'bg-[#d2544b]', column: 'bg-[#fcf6f6]', icon: 'M6 6l12 12M18 6 6 18' },
}

const icons = {
  cake: 'M4 20h16M5 20v-7h14v7M8 13V9h8v4M12 9V5m-3 8c0 1.5 1.5 2 3 2s3-.5 3-2',
  refresh: 'M4 12a8 8 0 0 1 13.7-5.7L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.7L4 15.5M4 20v-4.5h4.5',
  search: 'm20 20-4.2-4.2M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z',
  board: 'M4 5h4v14H4V5Zm6 0h4v9h-4V5Zm6 0h4v11h-4V5Z',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  calendar: 'M5 6h14v14H5V6Zm0 4h14M9 4v4m6-4v4',
  alert: 'M12 8v5m0 3.5v.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  close: 'M6 6l12 12M18 6 6 18',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  mail: 'M4 6h16v12H4V6Zm0 0 8 7 8-7',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z',
  pin: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  note: 'M5 4h14v12l-4 4H5V4Zm10 16v-4h4M9 9h6M9 13h4',
  clock: 'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  chevron: 'm9 6 6 6-6 6',
}

function Icon({ path, className = 'size-4' }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d={path} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  )
}

function WhatsAppIcon({ className = 'size-4' }) {
  return (
    <svg aria-hidden="true" className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d={WHATSAPP_PATH} />
    </svg>
  )
}

function pickupInfo(value) {
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return { date: null, days: null }
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  return { date, days: Math.round((date.getTime() - today.getTime()) / 86400000) }
}

function whatsappNumber(phone) {
  let digits = String(phone || '').replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (!digits.startsWith('237')) {
    if (digits.startsWith('0')) digits = digits.slice(1)
    digits = `237${digits}`
  }
  return digits.length >= 8 && digits.length <= 15 ? digits : ''
}

function StatusBadge({ status, t }) {
  const meta = statusMeta[status] || { label: status, badge: 'bg-[#f1f4f8] text-[#5b6b7d] ring-[#e1e7ee]', dot: 'bg-[#94a3b4]' }
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ring-1 ${meta.badge}`}>
      <span aria-hidden="true" className={`size-1.5 rounded-full ${meta.dot}`} />
      {t(meta.label)}
    </span>
  )
}

export function AdminCakeRequestsBoard() {
  const { sessionToken } = useAdminAuth()
  const request = useCallback((path, options = {}) => apiRequest(path, { ...options, token: sessionToken }), [sessionToken])
  const { t, language } = useLanguage()
  const locale = language === 'fr' ? 'fr-CM' : 'en-CM'
  const [requests, setRequests] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('pickup')
  const [view, setView] = useState('board')
  const [updatingId, setUpdatingId] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [quotedTotal, setQuotedTotal] = useState('')
  const [depositAmount, setDepositAmount] = useState('')
  const [adminNote, setAdminNote] = useState('')
  const [pickupDate, setPickupDate] = useState('')
  const [quoteError, setQuoteError] = useState('')

  const refresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const result = await request('/admin/cake-requests')
      setRequests(result.requests)
      setError('')
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [request])

  useEffect(() => { refresh() }, [refresh])

  const selected = requests.find((item) => item.id === selectedId) || null

  useEffect(() => {
    if (!selected) return
    const total = selected.quotedTotal || selected.suggestedTotal || 22000
    setQuotedTotal(String(total))
    setDepositAmount(String(selected.depositAmount || Math.min(total, Math.ceil((total * 0.3) / 100) * 100)))
    setAdminNote(selected.adminNote || '')
    setPickupDate(selected.pickupDate || '')
    setQuoteError('')
  }, [selected?.id])

  useEffect(() => {
    if (!selected) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function handleKeyDown(event) {
      if (event.key === 'Escape') setSelectedId(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [selected])

  async function sendQuote() {
    if (!selected) return
    setQuoteError('')
    setUpdatingId(selected.id)
    try {
      const result = await request(`/admin/cake-requests/${selected.id}`, {
        method: 'PATCH',
        body: { action: 'quote', quotedTotal: Number(quotedTotal), depositAmount: Number(depositAmount), adminNote, pickupDate },
      })
      setRequests((current) => current.map((item) => (item.id === selected.id ? { ...item, ...result.request } : item)))
    } catch (updateError) {
      setQuoteError(updateError.message)
    } finally {
      setUpdatingId(null)
    }
  }

  async function updateStatus(id, status) {
    setError('')
    setUpdatingId(id)
    try {
      await request(`/admin/cake-requests/${id}/status`, { method: 'PATCH', body: { status } })
      setRequests((current) => current.map((item) => (item.id === id ? { ...item, status } : item)))
    } catch (updateError) {
      setError(updateError.message)
    } finally {
      setUpdatingId(null)
    }
  }

  const isDueSoon = (item) => {
    const { days } = pickupInfo(item.pickupDate)
    return item.status !== 'declined' && item.status !== 'confirmed' && days !== null && days <= 7
  }

  const counts = useMemo(() => requests.reduce((result, item) => {
    result.all += 1
    result[item.status] = (result[item.status] || 0) + 1
    if (isDueSoon(item)) result.due += 1
    return result
  }, { all: 0, new: 0, contacted: 0, confirmed: 0, declined: 0, due: 0 }), [requests])

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase()
    return requests
      .filter((item) => {
        const matchesStatus = statusFilter === 'all' || (statusFilter === 'due' ? isDueSoon(item) : item.status === statusFilter)
        const matchesSearch = !query || [item.id, item.customerName, item.customerEmail, item.customerPhone, item.flavor, item.size, item.storeName]
          .some((value) => String(value || '').toLowerCase().includes(query))
        return matchesStatus && matchesSearch
      })
      .sort((a, b) => {
        if (sortBy === 'newest') return b.id - a.id
        const aDays = pickupInfo(a.pickupDate).days ?? Infinity
        const bDays = pickupInfo(b.pickupDate).days ?? Infinity
        return aDays - bDays
      })
  }, [requests, search, sortBy, statusFilter])

  function pickupLabel(item) {
    const { date, days } = pickupInfo(item.pickupDate)
    if (!date) return { text: item.pickupDate, tone: 'text-[#4f6379]', badge: null }
    const text = date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })
    const formatter = new Intl.RelativeTimeFormat(language === 'fr' ? 'fr' : 'en', { numeric: 'auto' })
    const active = item.status !== 'declined' && item.status !== 'confirmed'
    if (days < 0 && active) return { text, tone: 'text-[#a53f37]', badge: { label: t('Overdue'), className: 'bg-[#fdeeee] text-[#a53f37]' } }
    if (days <= 2 && days >= 0 && item.status !== 'declined') return { text, tone: 'text-[#9a6200]', badge: { label: formatter.format(days, 'day'), className: 'bg-[#fff6e5] text-[#9a6200]' } }
    return { text, tone: 'text-[#4f6379]', badge: days >= 0 && item.status !== 'declined' ? { label: formatter.format(days, 'day'), className: 'bg-[#f1f4f8] text-[#65748a]' } : null }
  }

  const metrics = [
    { key: 'new', label: 'New requests', value: counts.new },
    { key: 'contacted', label: 'Quote sent', value: counts.contacted },
    { key: 'confirmed', label: 'Deposit paid', value: counts.confirmed },
    { key: 'due', label: 'Due within 7 days', value: counts.due },
  ]

  async function sendQuote() {
    if (!selected) return
    setUpdatingId(selected.id)
    setQuoteError('')
    try {
      const result = await request(`/admin/cake-requests/${selected.id}`, {
        method: 'PATCH',
        body: {
          action: 'quote',
          quotedTotal: Number(quotedTotal),
          depositAmount: Number(depositAmount),
          adminNote,
          pickupDate,
        },
      })
      setRequests((current) => current.map((item) => (item.id === selected.id ? { ...item, ...result.request } : item)))
    } catch (error) {
      setQuoteError(error.message)
    } finally {
      setUpdatingId(null)
    }
  }

  const requestCard = (item) => {
    const pickup = pickupLabel(item)
    const toppings = Array.isArray(item.toppings) ? item.toppings : []
    return (
      <li key={item.id}>
        <article
          className={`group cursor-pointer rounded-2xl bg-white p-4 ring-1 ring-[#e3e9f0] transition hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(16,44,80,0.08)] hover:ring-[#c3cfdc] ${updatingId === item.id ? 'opacity-60' : ''}`}
          onClick={() => setSelectedId(item.id)}
          onKeyDown={(event) => { if (event.key === 'Enter') setSelectedId(item.id) }}
          role="button"
          tabIndex={0}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#a3b0bf]">#{item.id}</p>
              <h3 className="mt-0.5 truncate font-display text-base font-extrabold text-[#092a53]">{item.size} {t('Cake')}</h3>
              <p className="truncate text-xs font-semibold text-[#65748a]">{item.flavor}</p>
            </div>
            <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#fff6cc] text-[#8a7000]"><Icon path={icons.cake} /></span>
          </div>
          <div className={`mt-3 flex flex-wrap items-center gap-1.5 text-xs font-bold ${pickup.tone}`}>
            <Icon className="size-3.5" path={icons.calendar} />
            {pickup.text}
            {pickup.badge && <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${pickup.badge.className}`}>{pickup.badge.label}</span>}
          </div>
          {toppings.length > 0 && (
            <p className="mt-1.5 truncate text-[11px] text-[#8190a1]">{toppings.map((topping) => t(topping)).join(' · ')}</p>
          )}
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#f0f3f7] pt-3">
            <p className="min-w-0 truncate text-xs font-bold text-[#355777]">{item.customerName}</p>
            {item.quotedTotal ? (
              <span className="text-[11px] font-extrabold text-[#092a53]">{Number(item.quotedTotal).toLocaleString(locale)} FCFA</span>
            ) : ['new', 'contacted'].includes(item.status) ? (
              <span className="text-[11px] font-bold text-[#8a7000]">{t('Send quote')}</span>
            ) : null}
          </div>
        </article>
      </li>
    )
  }

  const selectedPickup = selected ? pickupLabel(selected) : null
  const selectedWhatsapp = selected ? whatsappNumber(selected.customerPhone) : ''

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-col gap-5 border-b border-[#edf1f5] pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="relative grid size-14 shrink-0 place-items-center rounded-2xl bg-[#092a53] text-[#ffdc32]">
            <Icon className="size-7" path={icons.cake} />
            {counts.new > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#e0a100] px-1 text-[10px] font-extrabold text-white ring-2 ring-white">{counts.new}</span>}
          </span>
          <div className="min-w-0">
            <nav aria-label={t('Breadcrumb')} className="text-[11px] font-bold text-[#8190a1]">
              {t('Customers')} <span aria-hidden="true" className="mx-1">/</span>
              <span className="text-[#8a7000]">{t('Cake requests')}</span>
            </nav>
            <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-[#092a53] sm:text-[1.9rem]">{t('Custom cake requests')}</h1>
            <p className="mt-0.5 max-w-2xl text-sm text-[#65748a]">{t('Review each celebration, get in touch with the customer, and keep every request moving.')}</p>
          </div>
        </div>
        <button
          className="inline-flex min-h-10 items-center gap-2 self-start rounded-xl border border-[#dce5ef] bg-white px-4 text-sm font-bold text-[#355777] transition hover:border-[#bacbdc] hover:bg-[#f6f9fc] hover:text-[#092a53] disabled:cursor-wait disabled:opacity-60 xl:self-auto"
          disabled={isRefreshing}
          onClick={refresh}
          type="button"
        >
          <Icon className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} path={icons.refresh} />
          {t('Refresh requests')}
        </button>
      </header>

      {error && !selected && (
        <p className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100" role="alert">
          <Icon className="mt-0.5 size-4 shrink-0" path={icons.alert} />
          {error}
        </p>
      )}

      <section aria-label={t('Request overview')} className="admin-stats grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map((metric) => {
          const isActive = statusFilter === metric.key
          const meta = statusMeta[metric.key]
          return (
            <button
              aria-pressed={isActive}
              className={`group rounded-2xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(18,44,80,0.07)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] sm:p-5 ${isActive ? 'border-[#092a53] shadow-[0_0_0_1px_#092a53]' : 'border-[#e5ebf3]'}`}
              key={metric.key}
              onClick={() => { setStatusFilter(isActive ? 'all' : metric.key); if (!isActive && metric.key !== 'due') setView('list') }}
              type="button"
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`grid size-9 place-items-center rounded-xl ${metric.key === 'due' ? 'bg-[#fdecea] text-[#b2433a]' : `${meta.badge.split(' ').slice(0, 2).join(' ')}`}`}>
                  <Icon path={metric.key === 'due' ? icons.clock : meta.icon} />
                </span>
                <span className="text-[10px] font-bold text-[#a3b0bf] opacity-0 transition group-hover:opacity-100">{t(isActive ? 'Clear filter' : 'Filter')}</span>
              </div>
              <p className="mt-4 font-display text-[1.75rem] font-extrabold leading-none tracking-tight text-[#102c50]">{metric.value}</p>
              <p className="mt-1.5 text-xs font-semibold capitalize text-[#65748a]">{t(metric.label)}</p>
            </button>
          )
        })}
      </section>

      <section aria-labelledby="cake-requests-title" className="min-w-0 rounded-[20px] border border-[#e5ebf3] bg-white">
        <div className="flex flex-col gap-4 border-b border-[#edf1f5] p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-extrabold text-[#092a53]" id="cake-requests-title">{t(view === 'board' ? 'Request pipeline' : 'All requests')}</h2>
              <p aria-live="polite" className="mt-0.5 text-xs text-[#65748a]">{t('Showing {shown} of {total} requests', { shown: filteredRequests.length, total: counts.all })}</p>
            </div>
            <div aria-label={t('View')} className="inline-flex rounded-xl bg-[#f1f4f8] p-1" role="group">
              {[
                { key: 'board', icon: icons.board, label: t('Board view') },
                { key: 'list', icon: icons.list, label: t('Table view') },
              ].map((option) => (
                <button
                  aria-label={option.label}
                  aria-pressed={view === option.key}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold transition ${view === option.key ? 'bg-white text-[#092a53] shadow-sm' : 'text-[#8190a1] hover:text-[#092a53]'}`}
                  key={option.key}
                  onClick={() => setView(option.key)}
                  title={option.label}
                  type="button"
                >
                  <Icon path={option.icon} />
                  <span className="hidden sm:inline">{option.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
            <label className="relative block">
              <span className="sr-only">{t('Search requests')}</span>
              <Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#8190a1]" path={icons.search} />
              <input className={`${inputClassName} pl-10`} onChange={(event) => setSearch(event.target.value)} placeholder={t('Search cake requests')} type="search" value={search} />
            </label>
            <label className="block">
              <span className="sr-only">{t('Sort by')}</span>
              <select className={`${inputClassName} lg:w-52`} onChange={(event) => setSortBy(event.target.value)} value={sortBy}>
                <option value="pickup">{t('Sort: Pickup date (soonest)')}</option>
                <option value="newest">{t('Sort: Newest first')}</option>
              </select>
            </label>
            {view === 'list' && (
              <div aria-label={t('Filter by request status')} className="flex overflow-x-auto rounded-xl bg-[#f1f4f8] p-1" role="group">
                {['all', ...STATUSES].map((status) => (
                  <button
                    aria-pressed={statusFilter === status}
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition ${statusFilter === status ? 'bg-white text-[#092a53] shadow-sm' : 'text-[#65748a] hover:text-[#092a53]'}`}
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    type="button"
                  >
                    {t(status === 'all' ? 'All' : status)}
                    <span className="rounded-full bg-[#e6ebf1] px-1.5 text-[10px] text-[#65748a]">{counts[status]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div aria-live="polite" className="grid gap-4 p-4 sm:p-5 lg:grid-cols-4">
            {[0, 1, 2, 3].map((item) => <div aria-hidden="true" className="h-64 animate-pulse rounded-2xl bg-[#f4f7fa]" key={item} />)}
            <span className="sr-only">{t('Loading…')}</span>
          </div>
        ) : !requests.length ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#fff6cc] text-[#8a7000]"><Icon className="size-5" path={icons.cake} /></span>
            <p className="mt-4 font-display text-lg font-extrabold text-[#092a53]">{t('No custom cake requests yet.')}</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-[#8190a1]">{t('New cake requests from the storefront will appear here.')}</p>
          </div>
        ) : view === 'board' ? (
          <div className="grid gap-3 overflow-x-auto p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-4">
            {STATUSES.map((status) => {
              const columnItems = filteredRequests.filter((item) => item.status === status && (statusFilter !== 'due' || isDueSoon(item)))
              const meta = statusMeta[status]
              return (
                <section aria-label={t(status)} className={`flex min-w-0 flex-col rounded-2xl p-3 ring-1 ring-[#eef2f6] ${meta.column}`} key={status}>
                  <header className="mb-3 flex items-center justify-between gap-2 px-1">
                    <span className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.12em] text-[#4f6379]">
                      <span aria-hidden="true" className={`size-2 rounded-full ${meta.dot}`} />
                      {t(status)}
                    </span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-extrabold text-[#65748a] ring-1 ring-[#e3e9f0]">{columnItems.length}</span>
                  </header>
                  {columnItems.length ? (
                    <ul className="space-y-2.5">{columnItems.map(requestCard)}</ul>
                  ) : (
                    <p className="rounded-xl border border-dashed border-[#d8e0ea] px-3 py-6 text-center text-xs font-semibold text-[#a3b0bf]">{t('Nothing here')}</p>
                  )}
                </section>
              )
            })}
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#f1f4f8] text-[#8190a1]"><Icon className="size-5" path={icons.search} /></span>
            <p className="mt-4 font-display text-lg font-extrabold text-[#092a53]">{t('No requests match your search')}</p>
            <p className="mt-1 text-sm text-[#8190a1]">{t('Try a different search or status filter.')}</p>
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#edf1f5] text-[11px] uppercase tracking-[0.08em] text-[#8190a1]">
                  <th className="px-5 py-3 font-extrabold" scope="col">{t('Cake')}</th>
                  <th className="px-3 py-3 font-extrabold" scope="col">{t('Customer')}</th>
                  <th className="px-3 py-3 font-extrabold" scope="col">{t('Pickup date')}</th>
                  <th className="px-3 py-3 font-extrabold" scope="col">{t('Selected store')}</th>
                  <th className="px-3 py-3 font-extrabold" scope="col">{t('Status')}</th>
                  <th className="px-5 py-3" scope="col"><span className="sr-only">{t('Action')}</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f3f7]">
                {filteredRequests.map((item) => {
                  const pickup = pickupLabel(item)
                  return (
                    <tr className={`cursor-pointer transition hover:bg-[#fafbfd] ${updatingId === item.id ? 'opacity-60' : ''}`} key={item.id} onClick={() => setSelectedId(item.id)}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#fff6cc] text-[#8a7000]"><Icon path={icons.cake} /></span>
                          <div className="min-w-0">
                            <p className="font-bold text-[#102c50]">{item.size} {t('Cake')} <span className="text-xs font-semibold text-[#a3b0bf]">#{item.id}</span></p>
                            <p className="max-w-[12rem] truncate text-xs text-[#7b8796]">{item.flavor}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <p className="max-w-[11rem] truncate font-bold text-[#102c50]">{item.customerName}</p>
                        <p className="max-w-[11rem] truncate text-[11px] text-[#8190a1]">{item.customerPhone}</p>
                      </td>
                      <td className="px-3 py-3.5">
                        <p className={`flex items-center gap-1.5 text-xs font-bold ${pickup.tone}`}>{pickup.text}</p>
                        {pickup.badge && <span className={`mt-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${pickup.badge.className}`}>{pickup.badge.label}</span>}
                      </td>
                      <td className="max-w-[11rem] truncate px-3 py-3.5 text-xs font-semibold text-[#4f6379]">{item.storeName ? t(item.storeName) : '—'}</td>
                      <td className="px-3 py-3.5"><StatusBadge status={item.status} t={t} /></td>
                      <td className="px-5 py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button aria-label={t('View details')} className="grid size-8 place-items-center rounded-lg text-[#6b7d91] transition hover:bg-[#eef2f7] hover:text-[#092a53]" onClick={() => setSelectedId(item.id)} type="button">
                            <Icon path={icons.chevron} />
                          </button>
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

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
          <button aria-label={t('Close')} className="admin-drawer-backdrop absolute inset-0 bg-[#0b1e36]/45 backdrop-blur-[2px]" onClick={() => setSelectedId(null)} tabIndex={-1} type="button" />
          <section aria-labelledby="cake-drawer-title" aria-modal="true" className="admin-drawer-panel relative flex h-full w-full max-w-[32rem] flex-col bg-white shadow-[-24px_0_60px_rgba(9,42,83,0.18)]" role="dialog">
            <header className="flex items-start justify-between gap-4 border-b border-[#edf1f5] px-6 py-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#fff6cc] text-[#8a7000]"><Icon className="size-6" path={icons.cake} /></span>
                <div className="min-w-0">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#8a7000]">{t('Cake request #{id}', { id: selected.id })}</p>
                  <h2 className="truncate font-display text-xl font-extrabold text-[#092a53]" id="cake-drawer-title">{selected.size} {t('Cake')}</h2>
                </div>
              </div>
              <button aria-label={t('Close')} className="grid size-9 shrink-0 place-items-center rounded-xl text-[#65748a] transition hover:bg-[#f1f4f8] hover:text-[#092a53]" onClick={() => setSelectedId(null)} type="button">
                <Icon className="size-5" path={icons.close} />
              </button>
            </header>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6">
              {error && (
                <p className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100" role="alert">
                  <Icon className="mt-0.5 size-4 shrink-0" path={icons.alert} />
                  {error}
                </p>
              )}

              <section>
                <h3 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#8190a1]">{t('Request status')}</h3>
                <div className="mt-3 grid grid-cols-4 gap-1.5">
                  {STATUSES.map((status) => {
                    const isCurrent = selected.status === status
                    const meta = statusMeta[status]
                    return (
                      <button
                        aria-pressed={isCurrent}
                        className={`flex flex-col items-center gap-1.5 rounded-xl px-1 py-2.5 text-[11px] font-bold capitalize transition disabled:cursor-wait ${isCurrent ? `${meta.badge} ring-2` : 'text-[#65748a] ring-1 ring-[#e8edf3] hover:bg-[#f7f9fc] hover:text-[#092a53]'}`}
                        disabled={updatingId === selected.id}
                        key={status}
                        onClick={() => { if (!isCurrent) updateStatus(selected.id, status) }}
                        type="button"
                      >
                        <Icon path={meta.icon} />
                        {t(status)}
                      </button>
                    )
                  })}
                </div>
              </section>

              <dl className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-[#f7f9fc] p-4 ring-1 ring-[#e8edf3]">
                  <dt className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#8190a1]">{t('Cake flavor')}</dt>
                  <dd className="mt-1.5 font-bold text-[#102c50]">{selected.flavor}</dd>
                </div>
                <div className="rounded-2xl bg-[#f7f9fc] p-4 ring-1 ring-[#e8edf3]">
                  <dt className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#8190a1]">{t('Pickup date')}</dt>
                  <dd className={`mt-1.5 font-bold ${selectedPickup.tone}`}>{selectedPickup.text}</dd>
                  {selectedPickup.badge && <dd className={`mt-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${selectedPickup.badge.className}`}>{selectedPickup.badge.label}</dd>}
                </div>
                {selected.storeName && (
                  <div className="col-span-2 flex items-center gap-3 rounded-2xl bg-[#f7f9fc] p-4 ring-1 ring-[#e8edf3]">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-[#092a53] shadow-sm"><Icon path={icons.pin} /></span>
                    <div>
                      <dt className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#8190a1]">{t('Selected store')}</dt>
                      <dd className="text-sm font-bold text-[#092a53]">{t(selected.storeName)}</dd>
                    </div>
                  </div>
                )}
              </dl>

              <section>
                <h3 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#8190a1]">{t('Toppings')}</h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Array.isArray(selected.toppings) && selected.toppings.length
                    ? selected.toppings.map((topping) => <span className="rounded-full bg-[#fff6cc] px-2.5 py-1 text-xs font-bold text-[#7a6300]" key={topping}>{t(topping)}</span>)
                    : <span className="text-sm text-[#a3b0bf]">{t('No toppings')}</span>}
                </div>
              </section>

              {['new', 'contacted'].includes(selected.status) && (
                <section className="rounded-2xl bg-[#f7f9fc] p-4 ring-1 ring-[#e8edf3]">
                  <h3 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#8190a1]">{t('Quote and deposit')}</h3>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <label className="text-[11px] font-bold text-[#52647b]">
                      {t('Total (FCFA)')}
                      <input className={`${inputClassName} mt-1`} inputMode="numeric" onChange={(event) => setQuotedTotal(event.target.value)} type="number" value={quotedTotal} />
                    </label>
                    <label className="text-[11px] font-bold text-[#52647b]">
                      {t('Deposit (FCFA)')}
                      <input className={`${inputClassName} mt-1`} inputMode="numeric" onChange={(event) => setDepositAmount(event.target.value)} type="number" value={depositAmount} />
                    </label>
                    <label className="col-span-2 text-[11px] font-bold text-[#52647b]">
                      {t('Pickup date')}
                      <input className={`${inputClassName} mt-1`} onChange={(event) => setPickupDate(event.target.value)} type="date" value={pickupDate} />
                    </label>
                    <label className="col-span-2 text-[11px] font-bold text-[#52647b]">
                      {t('Note to the customer')}
                      <textarea className={`${inputClassName} mt-1 min-h-20`} onChange={(event) => setAdminNote(event.target.value)} value={adminNote} />
                    </label>
                  </div>
                  {quoteError && <p className="mt-2 text-sm font-semibold text-[#a53f37]" role="alert">{quoteError}</p>}
                </section>
              )}
              {selected.quotedTotal && selected.status !== 'new' && (
                <p className="rounded-2xl bg-[#eaf6ee] px-4 py-3 text-sm font-bold text-[#246a46]">
                  {t('Quote')}: {Number(selected.quotedTotal).toLocaleString(locale)} FCFA · {t('Deposit')}: {Number(selected.depositAmount || 0).toLocaleString(locale)} FCFA
                  {selected.depositPaidAt ? ` · ${t('Deposit paid')}` : ''}
                </p>
              )}
              {selected.message && (
                <section className="rounded-2xl border-l-4 border-[#ffdc32] bg-[#fffbea] p-4">
                  <h3 className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#927700]">
                    <Icon className="size-3.5" path={icons.note} />
                    {t('Special instructions')}
                  </h3>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[#5a4d1c]">{selected.message}</p>
                </section>
              )}

              <section className="rounded-2xl ring-1 ring-[#e8edf3]">
                <div className="border-b border-[#f0f3f7] px-4 py-3">
                  <h3 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#8190a1]">{t('Customer')}</h3>
                  <p className="mt-1 font-bold text-[#102c50]">{selected.customerName}</p>
                  <p className="text-xs text-[#7b8796]">{selected.customerEmail} · {selected.customerPhone}</p>
                </div>
                <div className="grid grid-cols-3 divide-x divide-[#f0f3f7]">
                  <a className="flex flex-col items-center gap-1 py-3 text-xs font-bold text-[#355777] transition hover:bg-[#f7f9fc] hover:text-[#092a53]" href={`tel:${String(selected.customerPhone || '').replace(/[^\d+]/g, '')}`}>
                    <Icon path={icons.phone} />
                    {t('Call')}
                  </a>
                  <a className="flex flex-col items-center gap-1 py-3 text-xs font-bold text-[#355777] transition hover:bg-[#f7f9fc] hover:text-[#092a53]" href={`mailto:${selected.customerEmail || ''}?subject=${encodeURIComponent(t('Cake request #{id}', { id: selected.id }))}`}>
                    <Icon path={icons.mail} />
                    {t('Email')}
                  </a>
                  {selectedWhatsapp ? (
                    <a className="flex flex-col items-center gap-1 py-3 text-xs font-bold text-[#1f8f4e] transition hover:bg-[#eefbf3]" href={`https://wa.me/${selectedWhatsapp}`} rel="noreferrer" target="_blank">
                      <WhatsAppIcon />
                      WhatsApp
                    </a>
                  ) : (
                    <span className="flex flex-col items-center gap-1 py-3 text-xs font-bold text-[#c3ccd7]"><WhatsAppIcon />WhatsApp</span>
                  )}
                </div>
              </section>
            </div>

            <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-[#edf1f5] bg-[#fafbfd] px-6 py-4">
              {selected.status !== 'declined' && selected.status !== 'confirmed' && (
                <button
                  className="mr-auto inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-bold text-[#b2433a] transition hover:bg-red-50 disabled:cursor-wait"
                  disabled={updatingId === selected.id}
                  onClick={() => updateStatus(selected.id, 'declined')}
                  type="button"
                >
                  <Icon path={statusMeta.declined.icon} />
                  {t('Decline')}
                </button>
              )}
              <button className="min-h-10 rounded-xl px-4 text-sm font-bold text-[#4f6379] transition hover:bg-[#eef2f6] hover:text-[#092a53]" onClick={() => setSelectedId(null)} type="button">{t('Close')}</button>
              {['new', 'contacted'].includes(selected.status) && (
                <button
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#092a53] px-4 text-sm font-bold text-white transition hover:bg-[#163e6b] disabled:cursor-wait disabled:opacity-60"
                  disabled={updatingId === selected.id}
                  onClick={sendQuote}
                  type="button"
                >
                  {updatingId === selected.id ? t('Sending…') : selected.quotedTotal ? t('Update quote') : t('Send quote')}
                </button>
              )}
            </footer>
          </section>
        </div>
      )}
    </div>
  )
}
