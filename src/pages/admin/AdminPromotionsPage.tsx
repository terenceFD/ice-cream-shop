import { useEffect, useState, type FormEvent } from 'react'
import { apiRequest } from '../../api/api'
import { useAdminAuth } from './useAdminAuth'
import { useLanguage } from '../../language/useLanguage'

const freshForm: DiscountCodeForm = { code: '', discountType: 'percent', discountValue: '', minimumTotal: 0, maxUses: '', expiresAt: '', isActive: true }
const inputClassName = 'mt-1.5 w-full rounded-xl border border-[#dde4ec] bg-[#f8fafc] px-3.5 py-2.5 text-sm font-medium text-[#102c50] transition placeholder:text-[#9aa5b3] hover:border-[#c9d4e0] focus:border-[#bd9c00] focus:bg-white focus:ring-4 focus:ring-[#ffdc32]/25 outline-none!'
const labelClassName = 'block text-xs font-bold text-[#4f6379]'
const MAX_NOTIFICATION_MESSAGE = 180

interface NotificationResult {
  requested: boolean
  devices: number
  sent?: number
  failed?: number
  removed?: number
  pending?: boolean
  skipped?: boolean
  problem?: string
  errors?: string[]
}

interface PushStatus {
  configured: boolean
  problem: string
  devices: number
}

type Translate = (key: string, variables?: Record<string, string | number>) => string

// Plain-language outcome of a send, so the owner knows whether customers were actually reached.
function describeNotification(result: NotificationResult | undefined, t: Translate): { ok: boolean; text: string } {
  if (!result || result.skipped) return { ok: true, text: '' }
  if (!result.requested) return { ok: false, text: t('No notification was sent: {problem}', { problem: result.problem || t('promotion alerts are not set up on the server.') }) }
  if (result.devices === 0) return { ok: true, text: t('No customers have turned on promotion alerts yet, so nobody was notified.') }
  if (result.pending) return { ok: true, text: t('The notification is still being sent to {count} devices.', { count: result.devices }) }
  const sent = result.sent ?? 0
  const failed = result.failed ?? 0
  if (failed === 0) return { ok: true, text: t('Notification delivered to {sent} of {count} customer devices.', { sent, count: result.devices }) }
  return {
    ok: sent > 0,
    text: t('Notification reached {sent} of {count} devices. {failed} failed: {reason}', {
      sent,
      count: result.devices,
      failed,
      reason: result.errors?.[0] || t('unknown error'),
    }),
  }
}

// Mirrors the server's wording so the preview matches what customers receive.
function previewNotification(form: { code: string; discountType: string; discountValue: string; minimumTotal: string | number; expiresAt: string }, message: string) {
  const amountValue = Number(form.discountValue) || 0
  const amount = form.discountType === 'percent' ? `${amountValue}% off` : `${amountValue.toLocaleString('en-US')} FCFA off`
  const code = form.code || 'CODE'
  const minimum = Number(form.minimumTotal) || 0
  const until = form.expiresAt ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(form.expiresAt)) : ''
  const details = [minimum > 0 ? `on orders of ${minimum.toLocaleString('en-US')}+ items` : '', until ? `until ${until}` : ''].filter(Boolean).join(' ')
  const cleaned = message.replace(/\s+/g, ' ').trim()
  return {
    title: amountValue > 0 ? `Cold Stone Creamery: ${amount}` : 'Cold Stone Creamery: New promotion',
    body: cleaned
      ? (cleaned.toUpperCase().includes(code.toUpperCase()) ? cleaned : `${cleaned} Code: ${code}`)
      : `Use code ${code} at checkout${details ? ` ${details}` : ''}. Tap to order now.`,
  }
}

type DiscountType = 'percent' | 'fixed'
type CodeStatus = 'active' | 'inactive' | 'expired' | 'exhausted'
type StatusFilter = 'all' | CodeStatus

interface DiscountCode {
  id: number
  code: string
  discountType: DiscountType
  discountValue: number
  minimumTotal: number
  maxUses: number | null
  expiresAt: string | null
  isActive: boolean
  uses: number
}

interface DiscountCodeForm {
  code: string
  discountType: DiscountType
  discountValue: string
  minimumTotal: number | string
  maxUses: string
  expiresAt: string
  isActive: boolean
}

const icons = {
  tag: 'm20 13-7 7-10-10V3h7l10 10ZM7.5 7.5h.01',
  plus: 'M12 5v14M5 12h14',
  search: 'm20 20-4.2-4.2M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  close: 'M6 6l12 12M18 6 6 18',
  edit: 'M4 20h4L19 9l-4-4L4 16v4Zm9-13 4 4',
  trash: 'M4 7h16M10 11v6m4-6v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3',
  copy: 'M9 9h10v10H9V9Zm-4 6V5h10',
  bell: 'M6 9a6 6 0 1 1 12 0c0 4.5 1.5 6.5 2.5 7.5h-17C4.5 15.5 6 13.5 6 9Zm4 10.5a2.2 2.2 0 0 0 4 0',
  alert: 'M12 8v5m0 3.5v.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  spark: 'M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5m7 7L18 18m0-12-2.5 2.5m-7 7L6 18',
  clock: 'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  chart: 'M4 19V5m0 14h16M8 15v-3m4 3V8m4 7v-5',
  pause: 'M9 6v12m6-12v12',
}

function Icon({ path, className = 'size-4' }: { path: string; className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d={path} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  )
}

function isExpired(code: DiscountCode) {
  return Boolean(code.expiresAt && Date.parse(code.expiresAt) <= Date.now())
}

function codeStatus(code: DiscountCode): CodeStatus {
  if (!code.isActive) return 'inactive'
  if (isExpired(code)) return 'expired'
  if (code.maxUses != null && code.uses >= code.maxUses) return 'exhausted'
  return 'active'
}

const statusMeta: Record<CodeStatus, { label: string; badge: string; dot: string; stub: string }> = {
  active: { label: 'Active', badge: 'bg-[#eaf6ee] text-[#246a46] ring-[#cfe8d8]', dot: 'bg-[#35a36b]', stub: 'bg-[#092a53] text-[#ffdc32]' },
  inactive: { label: 'Inactive', badge: 'bg-[#f1f4f8] text-[#5b6b7d] ring-[#e1e7ee]', dot: 'bg-[#94a3b4]', stub: 'bg-[#e6ebf1] text-[#65748a]' },
  expired: { label: 'Expired', badge: 'bg-[#fdeeee] text-[#a53f37] ring-[#f3d1ce]', dot: 'bg-[#d2544b]', stub: 'bg-[#e6ebf1] text-[#65748a]' },
  exhausted: { label: 'Fully redeemed', badge: 'bg-[#fff6e5] text-[#9a6200] ring-[#f6dfb0]', dot: 'bg-[#e0a100]', stub: 'bg-[#e6ebf1] text-[#65748a]' },
}

function formatExpiry(value: string | null, language: string) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(language === 'fr' ? 'fr-CM' : 'en-CM', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function toLocalInput(date: Date) {
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function randomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const suffix = Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
  return `SWEET${suffix}`
}

export function AdminPromotionsPage() {
  const { sessionToken } = useAdminAuth()
  const { t, language } = useLanguage()
  const numberFormat = new Intl.NumberFormat(language === 'fr' ? 'fr-CM' : 'en-CM')
  const [codes, setCodes] = useState<DiscountCode[]>([])
  const [form, setForm] = useState<DiscountCodeForm>(freshForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [codeToDelete, setCodeToDelete] = useState<DiscountCode | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [notifyCustomers, setNotifyCustomers] = useState(true)
  const [notificationMessage, setNotificationMessage] = useState('')
  const [pushStatus, setPushStatus] = useState<PushStatus | null>(null)
  const [codeToNotify, setCodeToNotify] = useState<DiscountCode | null>(null)
  const [resendMessage, setResendMessage] = useState('')
  const [isNotifying, setIsNotifying] = useState(false)
  const [notifyError, setNotifyError] = useState('')
  const isOverlayOpen = isEditorOpen || Boolean(codeToDelete) || Boolean(codeToNotify)

  async function refreshPushStatus() {
    try {
      setPushStatus(await apiRequest<PushStatus>('/admin/push/status', { token: sessionToken }))
    } catch {
      setPushStatus(null)
    }
  }

  async function sendResend() {
    if (!codeToNotify) return
    setIsNotifying(true)
    setNotifyError('')
    try {
      const result = await apiRequest<{ notification: NotificationResult }>(`/admin/discount-codes/${codeToNotify.id}/notify`, {
        method: 'POST',
        token: sessionToken,
        body: { notificationMessage: resendMessage.trim() },
      })
      const outcome = describeNotification(result?.notification, t)
      if (outcome.ok) {
        setCodeToNotify(null)
        setResendMessage('')
        setMessage(outcome.text)
      } else {
        setNotifyError(outcome.text)
      }
      refreshPushStatus()
    } catch (sendError) {
      setNotifyError(sendError instanceof Error ? sendError.message : t('The notification could not be sent.'))
    } finally {
      setIsNotifying(false)
    }
  }

  async function refresh() {
    const result = await apiRequest<{ discountCodes: DiscountCode[] }>('/admin/discount-codes', { token: sessionToken })
    setCodes(result.discountCodes)
  }

  useEffect(() => {
    let cancelled = false
    apiRequest<{ discountCodes: DiscountCode[] }>('/admin/discount-codes', { token: sessionToken })
      .then((result) => { if (!cancelled) setCodes(result.discountCodes) })
      .catch((loadError: unknown) => { if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unable to load discount codes.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [sessionToken])

  useEffect(() => {
    let cancelled = false
    apiRequest<PushStatus>('/admin/push/status', { token: sessionToken })
      .then((status) => { if (!cancelled) setPushStatus(status) })
      .catch(() => { if (!cancelled) setPushStatus(null) })
    return () => { cancelled = true }
  }, [sessionToken])

  useEffect(() => {
    if (!message) return undefined
    // Notification results carry details worth reading, so they stay longer.
    const timer = window.setTimeout(() => setMessage(''), message.length > 60 ? 12000 : 4000)
    return () => window.clearTimeout(timer)
  }, [message])

  useEffect(() => {
    if (!isOverlayOpen) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setIsEditorOpen(false)
      setCodeToDelete(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOverlayOpen])

  function setField<K extends keyof DiscountCodeForm>(name: K, value: DiscountCodeForm[K]) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  function openCreate() {
    setEditingId(null)
    setForm(freshForm)
    setNotifyCustomers(true)
    setNotificationMessage('')
    setError('')
    setIsEditorOpen(true)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    setSaving(true)
    const payload = {
      ...form,
      discountValue: Number(form.discountValue),
      minimumTotal: Number(form.minimumTotal),
      maxUses: form.maxUses === '' ? null : Number(form.maxUses),
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : '',
      ...(editingId ? {} : { notifyCustomers, notificationMessage: notificationMessage.trim() }),
    }
    try {
      const result = await apiRequest<{ notification?: { requested: boolean; devices: number } }>(editingId ? `/admin/discount-codes/${editingId}` : '/admin/discount-codes', {
        method: editingId ? 'PUT' : 'POST',
        token: sessionToken,
        body: payload,
      })
      await refresh()
      const wantedAlert = !editingId && notifyCustomers && form.isActive
      setForm(freshForm)
      setEditingId(null)
      setIsEditorOpen(false)
      setNotificationMessage('')
      const outcome = wantedAlert ? describeNotification(result?.notification as NotificationResult | undefined, t) : { ok: true, text: '' }
      if (outcome.ok) setMessage(outcome.text ? `${t('Discount code saved.')} ${outcome.text}` : t('Discount code saved.'))
      else {
        setMessage(t('Discount code saved.'))
        setError(outcome.text)
      }
      refreshPushStatus()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save discount code.')
    } finally {
      setSaving(false)
    }
  }

  function edit(code: DiscountCode) {
    setEditingId(code.id)
    setForm({
      code: code.code,
      discountType: code.discountType,
      isActive: code.isActive,
      discountValue: String(code.discountValue),
      minimumTotal: String(code.minimumTotal),
      maxUses: code.maxUses == null ? '' : String(code.maxUses),
      expiresAt: code.expiresAt ? toLocalInput(new Date(code.expiresAt)) : '',
    })
    setMessage('')
    setError('')
    setIsEditorOpen(true)
  }

  async function remove() {
    const code = codeToDelete
    if (!code) return
    setError('')
    setMessage('')
    setDeletingId(code.id)
    try {
      await apiRequest(`/admin/discount-codes/${code.id}`, { method: 'DELETE', token: sessionToken })
      await refresh()
      if (editingId === code.id) {
        setEditingId(null)
        setForm(freshForm)
      }
      setCodeToDelete(null)
      setMessage(t('Discount code deleted.'))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete discount code.')
    } finally {
      setDeletingId(null)
    }
  }

  async function copyCode(code: DiscountCode) {
    try {
      await navigator.clipboard.writeText(code.code)
      setCopiedId(code.id)
      window.setTimeout(() => setCopiedId((current) => (current === code.id ? null : current)), 1800)
    } catch {
      setCopiedId(null)
    }
  }

  function setExpiryInDays(days: number | null) {
    if (days === null) {
      setField('expiresAt', '')
      return
    }
    const date = new Date()
    date.setDate(date.getDate() + days)
    date.setHours(23, 59, 0, 0)
    setField('expiresAt', toLocalInput(date))
  }

  const valueLabel = (type: DiscountType, value: number | string) =>
    type === 'percent' ? `${value}%` : `${numberFormat.format(Number(value))} FCFA`

  const counts = codes.reduce<Record<StatusFilter, number>>((result, code) => {
    result.all += 1
    result[codeStatus(code)] += 1
    return result
  }, { all: 0, active: 0, inactive: 0, expired: 0, exhausted: 0 })
  const totalUses = codes.reduce((total, code) => total + code.uses, 0)
  const query = search.trim().toLowerCase()
  const visibleCodes = codes.filter((code) =>
    (statusFilter === 'all' || codeStatus(code) === statusFilter) && (!query || code.code.toLowerCase().includes(query)))
  const previewValue = form.discountValue ? valueLabel(form.discountType, form.discountValue) : '—'

  const metrics = [
    { label: 'Total codes', value: counts.all, icon: icons.tag, accent: 'bg-[#e9f1fa] text-[#315982]', filter: 'all' as const },
    { label: 'Active now', value: counts.active, icon: icons.check, accent: 'bg-[#e5f4ea] text-[#2c7a4f]', filter: 'active' as const },
    { label: 'Expired', value: counts.expired, icon: icons.clock, accent: 'bg-[#fff1dc] text-[#a86a00]', filter: 'expired' as const },
    { label: 'Total redemptions', value: totalUses, icon: icons.chart, accent: 'bg-[#fff4c2] text-[#8a6f00]', filter: null },
  ]

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-col gap-5 border-b border-[#edf1f5] pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#092a53] text-[#ffdc32]">
            <Icon className="size-7" path={icons.tag} />
          </span>
          <div className="min-w-0">
            <nav aria-label={t('Breadcrumb')} className="text-[11px] font-bold text-[#8190a1]">
              {t('Sales promotions')} <span aria-hidden="true" className="mx-1">/</span>
              <span className="text-[#8a7000]">{t('Promotions')}</span>
            </nav>
            <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-[#092a53] sm:text-[1.9rem]">{t('Promotions and discount codes')}</h1>
            <p className="mt-0.5 max-w-2xl text-sm text-[#65748a]">{t('Create percentage or fixed FCFA discounts. Codes are validated and applied on the server when an order is created.')}</p>
          </div>
        </div>
        <button
          className="inline-flex min-h-10 shrink-0 items-center gap-2 self-start whitespace-nowrap rounded-xl bg-[#092a53] px-4 text-sm font-bold text-white shadow-[0_6px_16px_rgba(9,42,83,0.18)] transition hover:-translate-y-0.5 hover:bg-[#163e6b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] xl:self-auto"
          onClick={openCreate}
          type="button"
        >
          <Icon path={icons.plus} />
          {t('Create a discount')}
        </button>
      </header>

      {pushStatus && (
        <p className={`flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm font-semibold ring-1 ${pushStatus.configured ? 'bg-[#f4f7fb] text-[#33475e] ring-[#e3e9f1]' : 'bg-amber-50 text-amber-800 ring-amber-200'}`} role="status">
          <Icon className="mt-0.5 size-4 shrink-0" path={pushStatus.configured ? icons.bell : icons.alert} />
          <span>
            {pushStatus.configured
              ? t('Promotion alerts are ready. {count} customer devices have them turned on.', { count: pushStatus.devices })
              : t('Promotion alerts are not working: {problem}', { problem: pushStatus.problem })}
          </span>
        </p>
      )}
      {message && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-[#eaf6ee] px-4 py-3 text-sm font-semibold text-[#1f5d3c] ring-1 ring-[#cfe8d8]" role="status">
          <span className="flex items-center gap-2"><Icon path={icons.check} />{message}</span>
          <button aria-label={t('Dismiss')} className="grid size-7 place-items-center rounded-lg transition hover:bg-[#d7eedf]" onClick={() => setMessage('')} type="button">
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

      <section aria-label={t('Promotion overview')} className="admin-stats grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map((metric) => {
          const isActive = metric.filter !== null && metric.filter !== 'all' && statusFilter === metric.filter
          const body = (
            <>
              <span className={`grid size-9 place-items-center rounded-xl ${metric.accent}`}><Icon path={metric.icon} /></span>
              <p className="mt-4 font-display text-[1.75rem] font-extrabold leading-none tracking-tight text-[#102c50]">{metric.value.toLocaleString()}</p>
              <p className="mt-1.5 text-xs font-semibold text-[#65748a]">{t(metric.label)}</p>
            </>
          )
          return metric.filter ? (
            <button
              aria-pressed={isActive}
              className={`rounded-2xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(18,44,80,0.07)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] sm:p-5 ${isActive ? 'border-[#092a53] shadow-[0_0_0_1px_#092a53]' : 'border-[#e5ebf3]'}`}
              key={metric.label}
              onClick={() => setStatusFilter(isActive || metric.filter === 'all' ? 'all' : metric.filter!)}
              type="button"
            >
              {body}
            </button>
          ) : (
            <article className="rounded-2xl border border-[#e5ebf3] bg-white p-4 sm:p-5" key={metric.label}>{body}</article>
          )
        })}
      </section>

      <section aria-labelledby="promo-library-title" className="min-w-0 rounded-[20px] border border-[#e5ebf3] bg-white">
        <div className="flex flex-col gap-4 border-b border-[#edf1f5] p-4 sm:p-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-display text-xl font-extrabold text-[#092a53]" id="promo-library-title">{t('Current codes')}</h2>
            <p className="mt-0.5 text-xs text-[#65748a]">{t('{count} codes', { count: visibleCodes.length })}</p>
          </div>
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
            <label className="relative block shrink-0 sm:w-60">
              <span className="sr-only">{t('Search')}</span>
              <Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#8190a1]" path={icons.search} />
              <input className={`${inputClassName} mt-0 pl-10 font-mono uppercase placeholder:font-sans placeholder:normal-case`} onChange={(event) => setSearch(event.target.value)} placeholder={t('Search codes')} type="search" value={search} />
            </label>
            <div aria-label={t('Status')} className="flex min-w-0 overflow-x-auto rounded-xl bg-[#f1f4f8] p-1" role="group">
              {([
                { key: 'all', label: t('All') },
                { key: 'active', label: t('Active') },
                { key: 'inactive', label: t('Inactive') },
                { key: 'expired', label: t('Expired') },
                { key: 'exhausted', label: t('Fully redeemed') },
              ] as const).map((option) => (
                <button
                  aria-pressed={statusFilter === option.key}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition ${statusFilter === option.key ? 'bg-white text-[#092a53] shadow-sm' : 'text-[#65748a] hover:text-[#092a53]'}`}
                  key={option.key}
                  onClick={() => setStatusFilter(option.key)}
                  type="button"
                >
                  {option.label}
                  <span className="rounded-full bg-[#e6ebf1] px-1.5 text-[10px] text-[#65748a]">{counts[option.key]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div aria-live="polite" className="grid gap-4 p-4 sm:p-5 lg:grid-cols-2 2xl:grid-cols-3">
            {[0, 1, 2].map((item) => <div aria-hidden="true" className="h-40 animate-pulse rounded-2xl bg-[#f4f7fa]" key={item} />)}
            <p className="sr-only">{t('Loading discount codes…')}</p>
          </div>
        ) : visibleCodes.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#f1f4f8] text-[#8190a1]"><Icon className="size-5" path={icons.tag} /></span>
            <p className="mt-4 font-display text-lg font-extrabold text-[#092a53]">{codes.length ? t('No codes match your filters.') : t('No discount codes yet')}</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-[#8190a1]">{t('Your new codes will appear here after you create them.')}</p>
            {!codes.length && (
              <button className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-xl bg-[#092a53] px-4 text-xs font-bold text-white transition hover:bg-[#163e6b]" onClick={openCreate} type="button">
                <Icon path={icons.plus} />
                {t('Create a discount')}
              </button>
            )}
          </div>
        ) : (
          <ul className="grid gap-4 p-4 sm:p-5 lg:grid-cols-2 2xl:grid-cols-3">
            {visibleCodes.map((code) => {
              const status = codeStatus(code)
              const meta = statusMeta[status]
              const usagePercent = code.maxUses ? Math.min(100, (code.uses / code.maxUses) * 100) : 0
              const expiry = formatExpiry(code.expiresAt, language)
              return (
                <li
                  className={`group relative flex overflow-hidden rounded-2xl bg-white ring-1 ring-[#e3e9f0] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(16,44,80,0.09)] ${deletingId === code.id ? 'opacity-50' : ''}`}
                  key={code.id}
                >
                  <div className={`relative flex w-28 shrink-0 flex-col items-center justify-center px-3 py-5 text-center ${meta.stub}`}>
                    <p className="font-display text-2xl font-extrabold leading-none">
                      {code.discountType === 'percent' ? `${code.discountValue}%` : numberFormat.format(code.discountValue)}
                    </p>
                    <p className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.14em] opacity-80">{code.discountType === 'percent' ? t('off') : `FCFA ${t('off')}`}</p>
                    <span aria-hidden="true" className="absolute -right-2.5 -top-2.5 size-5 rounded-full bg-white ring-1 ring-[#e3e9f0]" />
                    <span aria-hidden="true" className="absolute -bottom-2.5 -right-2.5 size-5 rounded-full bg-white ring-1 ring-[#e3e9f0]" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col border-l-2 border-dashed border-[#e3e9f0] p-4">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        className="flex min-w-0 items-center gap-1.5 rounded-lg font-mono text-base font-extrabold tracking-wide text-[#102c50] hover:text-[#355777]"
                        onClick={() => copyCode(code)}
                        title={t('Copy')}
                        type="button"
                      >
                        <span className="truncate">{code.code}</span>
                        <Icon className="size-3.5 shrink-0 text-[#8190a1]" path={copiedId === code.id ? icons.check : icons.copy} />
                      </button>
                      <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${meta.badge}`}>
                        <span aria-hidden="true" className={`size-1.5 rounded-full ${meta.dot}`} />
                        {t(meta.label)}
                      </span>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                      <dt className="text-[#8190a1]">{t('Minimum order')}</dt>
                      <dd className="text-right font-bold text-[#355777]">{Number(code.minimumTotal) ? `${numberFormat.format(code.minimumTotal)} ${t('items')}` : t('None')}</dd>
                      <dt className="text-[#8190a1]">{t('Expires at')}</dt>
                      <dd className="truncate text-right font-bold text-[#355777]" title={expiry || undefined}>{expiry || t('No expiry')}</dd>
                    </dl>
                    <div className="mt-3">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-[#8190a1]">{t('Redemptions')}</span>
                        <span className="font-bold text-[#355777]">{code.uses}{code.maxUses != null ? ` / ${code.maxUses}` : ` · ${t('No limit')}`}</span>
                      </div>
                      {code.maxUses != null && (
                        <div aria-label={t('{used} of {max} redemptions', { used: code.uses, max: code.maxUses })} className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#edf1f5]" role="img">
                          <span className={`block h-full rounded-full ${status === 'exhausted' ? 'bg-[#e0a100]' : 'bg-[#35a36b]'}`} style={{ width: `${usagePercent}%` }} />
                        </div>
                      )}
                    </div>
                    <div className="mt-auto flex justify-end gap-1 pt-3">
                      {code.isActive && (
                        <button aria-label={`${t('Notify customers')} ${code.code}`} className="grid size-8 place-items-center rounded-lg text-[#6b7d91] transition hover:bg-[#fff6d6] hover:text-[#8a6d00]" onClick={() => { setNotifyError(''); setResendMessage(''); setCodeToNotify(code) }} title={t('Notify customers')} type="button">
                          <Icon path={icons.bell} />
                        </button>
                      )}
                      <button aria-label={`${t('Edit')} ${code.code}`} className="grid size-8 place-items-center rounded-lg text-[#6b7d91] transition hover:bg-[#eef2f7] hover:text-[#092a53]" onClick={() => edit(code)} title={t('Edit')} type="button">
                        <Icon path={icons.edit} />
                      </button>
                      <button aria-label={`${t('Delete')} ${code.code}`} className="grid size-8 place-items-center rounded-lg text-[#6b7d91] transition hover:bg-red-50 hover:text-red-600" onClick={() => { setError(''); setCodeToDelete(code) }} title={t('Delete')} type="button">
                        <Icon path={icons.trash} />
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
          <button aria-label={t('Close')} className="admin-drawer-backdrop absolute inset-0 bg-[#0b1e36]/45 backdrop-blur-[2px]" onClick={() => setIsEditorOpen(false)} tabIndex={-1} type="button" />
          <section aria-labelledby="promo-drawer-title" aria-modal="true" className="admin-drawer-panel relative flex h-full w-full max-w-[32rem] flex-col bg-white shadow-[-24px_0_60px_rgba(9,42,83,0.18)]" role="dialog">
            <header className="flex items-start justify-between gap-4 border-b border-[#edf1f5] px-6 py-5">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#8a7000]">{t('Promotion library')}</p>
                <h2 className="mt-1 font-display text-2xl font-extrabold text-[#092a53]" id="promo-drawer-title">{t(editingId ? 'Edit discount code' : 'Create a discount')}</h2>
                <p className="mt-1 text-sm text-[#65748a]">{t('Set up an offer customers can use at checkout.')}</p>
              </div>
              <button aria-label={t('Close')} className="grid size-9 shrink-0 place-items-center rounded-xl text-[#65748a] transition hover:bg-[#f1f4f8] hover:text-[#092a53]" onClick={() => setIsEditorOpen(false)} type="button">
                <Icon className="size-5" path={icons.close} />
              </button>
            </header>

            <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6">
                <div className="flex overflow-hidden rounded-2xl ring-1 ring-[#e3e9f0]">
                  <div className={`relative flex w-28 shrink-0 flex-col items-center justify-center px-3 py-5 text-center ${form.isActive ? 'bg-[#092a53] text-[#ffdc32]' : 'bg-[#e6ebf1] text-[#65748a]'}`}>
                    <p className="font-display text-2xl font-extrabold leading-none">{form.discountValue ? (form.discountType === 'percent' ? `${form.discountValue}%` : numberFormat.format(Number(form.discountValue))) : '—'}</p>
                    <p className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.14em] opacity-80">{form.discountType === 'percent' ? t('off') : `FCFA ${t('off')}`}</p>
                  </div>
                  <div className="min-w-0 flex-1 border-l-2 border-dashed border-[#e3e9f0] bg-[#fafbfd] p-4">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#8190a1]">{t('Offer preview')}</p>
                    <p className="mt-1 truncate font-mono text-lg font-extrabold tracking-wide text-[#102c50]">{form.code || t('Your code')}</p>
                    <p className="mt-1 text-xs text-[#65748a]">
                      {previewValue} {t('off')}
                      {Number(form.minimumTotal) ? ` · ${t('Minimum order')} ${numberFormat.format(Number(form.minimumTotal))} ${t('items')}` : ''}
                    </p>
                  </div>
                </div>

                <label className={labelClassName}>
                  {t('Code')}
                  <span className="mt-1.5 flex gap-2">
                    <span className="relative block flex-1">
                      <Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#8190a1]" path={icons.tag} />
                      <input className={`${inputClassName} mt-0 pl-10 font-mono font-bold uppercase tracking-[0.08em]`} maxLength={30} onChange={(event) => setField('code', event.target.value.toUpperCase())} pattern="[A-Za-z0-9_\-]{3,30}" placeholder="SWEET10" required value={form.code} />
                    </span>
                    <button
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#dde4ec] bg-white px-3 text-xs font-bold text-[#355777] transition hover:border-[#c3cfdc] hover:text-[#092a53]"
                      onClick={() => setField('code', randomCode())}
                      type="button"
                    >
                      <Icon path={icons.spark} />
                      {t('Generate')}
                    </button>
                  </span>
                  <span className="mt-1 block text-[11px] font-medium text-[#8190a1]">{t('3–30 letters, numbers, dashes or underscores.')}</span>
                </label>

                <fieldset>
                  <legend className={labelClassName}>{t('Discount type')}</legend>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    {([
                      { key: 'percent', label: t('Percent'), hint: '%' },
                      { key: 'fixed', label: t('Fixed FCFA'), hint: 'FCFA' },
                    ] as const).map((option) => (
                      <label
                        className={`flex cursor-pointer items-center gap-3 rounded-xl px-3.5 py-3 ring-1 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#bd9c00] ${form.discountType === option.key ? 'bg-[#fffbea] ring-2 ring-[#e8c400]' : 'bg-white ring-[#dde4ec] hover:ring-[#c3cfdc]'}`}
                        key={option.key}
                      >
                        <input checked={form.discountType === option.key} className="sr-only" name="discountType" onChange={() => setField('discountType', option.key)} type="radio" />
                        <span className={`grid size-8 place-items-center rounded-lg text-xs font-extrabold ${form.discountType === option.key ? 'bg-[#092a53] text-[#ffdc32]' : 'bg-[#f1f4f8] text-[#65748a]'}`}>{option.hint === '%' ? '%' : 'F'}</span>
                        <span className="text-sm font-bold text-[#102c50]">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className={labelClassName}>
                    {t('Discount value')}
                    <span className="relative block">
                      <input className={`${inputClassName} pr-14`} max={form.discountType === 'percent' ? 100 : undefined} min="1" onChange={(event) => setField('discountValue', event.target.value)} required type="number" value={form.discountValue} />
                      <span className="pointer-events-none absolute right-3.5 top-1/2 mt-[3px] -translate-y-1/2 text-[11px] font-extrabold text-[#8190a1]">{form.discountType === 'percent' ? '%' : 'FCFA'}</span>
                    </span>
                  </label>
                  <label className={labelClassName}>
                    {t('Minimum order')}
                    <span className="relative block">
                      <input className={`${inputClassName} pr-14`} min="0" onChange={(event) => setField('minimumTotal', event.target.value)} step="1" type="number" value={form.minimumTotal} />
                      <span className="pointer-events-none absolute right-3.5 top-1/2 mt-[3px] -translate-y-1/2 text-[11px] font-extrabold text-[#8190a1]">{t('items')}</span>
                    </span>
                  </label>
                  <label className={labelClassName}>
                    {t('Maximum uses')}
                    <input className={inputClassName} min="1" onChange={(event) => setField('maxUses', event.target.value)} placeholder={t('No limit')} type="number" value={form.maxUses} />
                  </label>
                  <label className={labelClassName}>
                    {t('Expires at')}
                    <input className={inputClassName} onChange={(event) => setField('expiresAt', event.target.value)} type="datetime-local" value={form.expiresAt} />
                  </label>
                </div>
                <div className="-mt-3 flex flex-wrap gap-1.5">
                  {[
                    { label: t('7 days'), days: 7 },
                    { label: t('30 days'), days: 30 },
                    { label: t('90 days'), days: 90 },
                    { label: t('No expiry'), days: null },
                  ].map((preset) => (
                    <button
                      className="rounded-lg bg-[#f1f4f8] px-2.5 py-1 text-[11px] font-bold text-[#4f6379] transition hover:bg-[#e3e9f0] hover:text-[#092a53]"
                      key={preset.label}
                      onClick={() => setExpiryInDays(preset.days)}
                      type="button"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <label className="flex cursor-pointer items-center gap-4 rounded-xl bg-[#f7f9fc] p-4 ring-1 ring-[#e8edf3] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#bd9c00]">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-[#102c50]">{t('Active')}</span>
                    <span className="block text-xs text-[#7b8796]">{t('Available for customers to use')}</span>
                  </span>
                  <input checked={form.isActive} className="peer sr-only" onChange={(event) => setField('isActive', event.target.checked)} type="checkbox" />
                  <span aria-hidden="true" className="relative h-6 w-11 shrink-0 rounded-full bg-[#cfd7e1] transition after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:bg-[#35a36b] peer-checked:after:translate-x-5" />
                </label>

                {!editingId && (
                  <fieldset className="space-y-4 rounded-2xl p-4 ring-1 ring-[#e8edf3]">
                    <legend className="px-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#8190a1]">{t('Customer notification')}</legend>
                    <label className="flex cursor-pointer items-center gap-4 has-[:focus-visible]:rounded-lg has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#bd9c00]">
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-[#102c50]">{t('Notify customers')}</span>
                        <span className="block text-xs text-[#7b8796]">
                          {form.isActive
                            ? t('Sends a notification to every customer account that turned on promotion alerts.')
                            : t('Inactive codes are saved quietly. Turn on Active to notify customers.')}
                        </span>
                      </span>
                      <input checked={notifyCustomers} className="peer sr-only" disabled={!form.isActive} onChange={(event) => setNotifyCustomers(event.target.checked)} type="checkbox" />
                      <span aria-hidden="true" className="relative h-6 w-11 shrink-0 rounded-full bg-[#cfd7e1] transition after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:bg-[#35a36b] peer-checked:after:translate-x-5 peer-disabled:opacity-50" />
                    </label>

                    {notifyCustomers && form.isActive && (
                      <>
                        <label className={labelClassName}>
                          <span className="flex items-baseline justify-between gap-3">
                            <span>{t('Notification message')}</span>
                            <span className={`font-semibold tabular-nums ${notificationMessage.length > MAX_NOTIFICATION_MESSAGE - 20 ? 'text-[#a46200]' : 'text-[#9aa5b3]'}`}>
                              {notificationMessage.length}/{MAX_NOTIFICATION_MESSAGE}
                            </span>
                          </span>
                          <textarea
                            className={`${inputClassName} min-h-24 resize-y leading-6`}
                            maxLength={MAX_NOTIFICATION_MESSAGE}
                            onChange={(event) => setNotificationMessage(event.target.value)}
                            placeholder={t('Example: Weekend treat! 20% off every sundae until Sunday.')}
                            value={notificationMessage}
                          />
                          <span className="mt-1.5 block font-medium text-[#8190a1]">
                            {t('Optional. Leave empty to use a message written from the discount details. The code is added if your message leaves it out.')}
                          </span>
                        </label>

                        {(() => {
                          const preview = previewNotification(form, notificationMessage)
                          return (
                            <div>
                              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#8190a1]">{t('Preview on a phone')}</p>
                              <div className="mt-2 flex gap-3 rounded-2xl bg-[#202124] p-3.5 text-white shadow-inner">
                                <img decoding="async" loading="lazy" alt="" className="size-10 shrink-0 rounded-full" height={40} src="/icons/icon-192.png" width={40} />
                                <div className="min-w-0 flex-1">
                                  <p className="flex items-center gap-1.5 text-[11px] text-white/55">
                                    <span className="truncate">{window.location.host}</span>
                                    <span aria-hidden="true">·</span>
                                    <span>{t('now')}</span>
                                  </p>
                                  <p className="mt-0.5 truncate text-sm font-semibold">{preview.title}</p>
                                  <p className="mt-0.5 line-clamp-3 break-words text-[13px] leading-5 text-white/80">{preview.body}</p>
                                </div>
                              </div>
                            </div>
                          )
                        })()}
                      </>
                    )}
                  </fieldset>
                )}

                {error && (
                  <p className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100" role="alert">
                    <Icon className="mt-0.5 size-4 shrink-0" path={icons.alert} />
                    {error}
                  </p>
                )}
              </div>

              <footer className="flex items-center justify-end gap-3 border-t border-[#edf1f5] bg-[#fafbfd] px-6 py-4">
                <button className="min-h-10 rounded-xl px-4 text-sm font-bold text-[#4f6379] transition hover:bg-[#eef2f6] hover:text-[#092a53]" onClick={() => setIsEditorOpen(false)} type="button">{t('Cancel')}</button>
                <button
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#092a53] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#163e6b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] disabled:cursor-wait disabled:opacity-60"
                  disabled={saving}
                  type="submit"
                >
                  <Icon path={editingId ? icons.check : icons.plus} />
                  {saving ? t('Saving…') : t(editingId ? 'Save code' : notifyCustomers && form.isActive ? 'Create code & notify' : 'Create code')}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {codeToNotify && (() => {
        const preview = previewNotification({
          code: codeToNotify.code,
          discountType: codeToNotify.discountType,
          discountValue: String(codeToNotify.discountValue),
          minimumTotal: codeToNotify.minimumTotal,
          expiresAt: codeToNotify.expiresAt || '',
        }, resendMessage)
        return (
          <div className="fixed inset-0 z-50 grid place-items-center px-5" role="presentation">
            <button aria-label={t('Cancel')} className="admin-drawer-backdrop absolute inset-0 bg-[#0b1e36]/45 backdrop-blur-[2px]" onClick={() => setCodeToNotify(null)} tabIndex={-1} type="button" />
            <section aria-labelledby="notify-code-title" aria-modal="true" className="admin-modal-panel relative w-full max-w-md rounded-[22px] bg-white p-6 shadow-[0_30px_80px_rgba(9,42,83,0.3)]" role="dialog">
              <span className="grid size-12 place-items-center rounded-2xl bg-[#fff6d6] text-[#8a6d00]"><Icon className="size-6" path={icons.bell} /></span>
              <h2 className="mt-4 font-display text-xl font-extrabold text-[#092a53]" id="notify-code-title">{t('Notify customers about {code}', { code: codeToNotify.code })}</h2>
              <p className="mt-1 text-sm leading-6 text-[#65748a]">
                {pushStatus?.configured
                  ? t('Sends a notification to the {count} customer devices that have promotion alerts turned on.', { count: pushStatus.devices })
                  : t('Promotion alerts are not working: {problem}', { problem: pushStatus?.problem || '' })}
              </p>
              <label className={`${labelClassName} mt-4`}>
                <span className="flex items-baseline justify-between gap-3">
                  <span>{t('Notification message')}</span>
                  <span className="font-semibold tabular-nums text-[#9aa5b3]">{resendMessage.length}/{MAX_NOTIFICATION_MESSAGE}</span>
                </span>
                <textarea
                  className={`${inputClassName} min-h-20 resize-y leading-6`}
                  maxLength={MAX_NOTIFICATION_MESSAGE}
                  onChange={(event) => setResendMessage(event.target.value)}
                  placeholder={t('Example: Weekend treat! 20% off every sundae until Sunday.')}
                  value={resendMessage}
                />
              </label>
              <div className="mt-3 flex gap-3 rounded-2xl bg-[#202124] p-3.5 text-white">
                <img decoding="async" loading="lazy" alt="" className="size-10 shrink-0 rounded-full" height={40} src="/icons/icon-192.png" width={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{preview.title}</p>
                  <p className="mt-0.5 line-clamp-3 break-words text-[13px] leading-5 text-white/80">{preview.body}</p>
                </div>
              </div>
              {notifyError && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700" role="alert">{notifyError}</p>}
              <div className="mt-6 flex justify-end gap-2.5">
                <button className="min-h-10 rounded-xl px-4 text-sm font-bold text-[#4f6379] transition hover:bg-[#eef2f6]" onClick={() => setCodeToNotify(null)} type="button">{t('Cancel')}</button>
                <button
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#092a53] px-4 text-sm font-bold text-white transition hover:bg-[#163e6b] disabled:cursor-wait disabled:opacity-60"
                  disabled={isNotifying || !pushStatus?.configured}
                  onClick={sendResend}
                  type="button"
                >
                  <Icon path={icons.bell} />
                  {isNotifying ? t('Sending…') : t('Send notification')}
                </button>
              </div>
            </section>
          </div>
        )
      })()}

      {codeToDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center px-5" role="presentation">
          <button aria-label={t('Cancel')} className="admin-drawer-backdrop absolute inset-0 bg-[#0b1e36]/45 backdrop-blur-[2px]" onClick={() => setCodeToDelete(null)} tabIndex={-1} type="button" />
          <section aria-labelledby="delete-code-title" aria-modal="true" className="admin-modal-panel relative w-full max-w-md rounded-[22px] bg-white p-6 shadow-[0_30px_80px_rgba(9,42,83,0.3)]" role="dialog">
            <span className="grid size-12 place-items-center rounded-2xl bg-red-50 text-red-600"><Icon className="size-6" path={icons.trash} /></span>
            <h2 className="mt-4 font-display text-xl font-extrabold text-[#092a53]" id="delete-code-title">{t('Delete discount code "{code}"?', { code: codeToDelete.code })}</h2>
            <p className="mt-2 text-sm leading-6 text-[#65748a]">
              {codeToDelete.uses > 0
                ? t('It has been redeemed {count} times. Customers will no longer be able to use it.', { count: codeToDelete.uses })
                : t('Customers will no longer be able to use it.')}
            </p>
            {codeToDelete.isActive && (
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-[#f7f9fc] px-3 py-2.5 text-xs font-semibold text-[#4f6379]">
                <Icon className="mt-0.5 size-3.5 shrink-0" path={icons.pause} />
                {t('Tip: switch it to inactive instead if you may reuse it later.')}
              </p>
            )}
            {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700" role="alert">{error}</p>}
            <div className="mt-6 flex justify-end gap-2.5">
              <button className="min-h-10 rounded-xl px-4 text-sm font-bold text-[#4f6379] transition hover:bg-[#eef2f6]" onClick={() => setCodeToDelete(null)} type="button">{t('Cancel')}</button>
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-wait disabled:opacity-60"
                disabled={deletingId === codeToDelete.id}
                onClick={remove}
                type="button"
              >
                <Icon path={icons.trash} />
                {deletingId === codeToDelete.id ? t('Deleting…') : t('Delete')}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
