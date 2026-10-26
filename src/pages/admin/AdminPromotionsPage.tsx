import { useEffect, useState, type FormEvent } from 'react'
import { apiRequest } from '../../api/api'
import { useAdminAuth } from './useAdminAuth'
import { useLanguage } from '../../language/useLanguage'

const freshForm: DiscountCodeForm = { code: '', discountType: 'percent', discountValue: '', minimumTotal: 0, maxUses: '', expiresAt: '', isActive: true }
const inputClassName = 'mt-1.5 w-full rounded-lg border border-[#dce3eb] bg-white px-3 py-2 text-sm font-medium text-[#092a53] transition placeholder:text-[#9aa5b3] hover:border-[#bac7d5] focus:border-[#092a53] focus:ring-2 focus:ring-[#092a53]/10 outline-none!'
const labelClassName = 'block text-sm font-medium text-[#092a53]'
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

const statusMeta: Record<CodeStatus, { label: string; badge: string; dot: string }> = {
  active: { label: 'Active', badge: 'bg-[#dcfae5] text-[#04250e] border-[#c4e7d0]', dot: 'bg-[#247b50]' },
  inactive: { label: 'Inactive', badge: 'bg-[#f4f6f8] text-[#5f6368] border-[#e8e8e8]', dot: 'bg-[#94a3b4]' },
  expired: { label: 'Expired', badge: 'bg-[#ffedea] text-[#831c1e] border-[#f3d1ce]', dot: 'bg-[#c4242a]' },
  exhausted: { label: 'Fully redeemed', badge: 'bg-[#fff6e5] text-[#92400e] border-[#f6dfb0]', dot: 'bg-[#92400e]' },
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
    { label: 'Total codes', value: counts.all, filter: 'all' as const },
    { label: 'Active now', value: counts.active, filter: 'active' as const },
    { label: 'Expired', value: counts.expired, filter: 'expired' as const },
    { label: 'Total redemptions', value: totalUses, filter: null },
  ]

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-[#092a53]">{t('Promotions and discount codes')}</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#5f6368]">{t('Create percentage or fixed FCFA discounts. Codes are validated and applied on the server when an order is created.')}</p>
        </div>
        <button
          className="inline-flex min-h-9 shrink-0 items-center gap-2 self-start whitespace-nowrap rounded-lg bg-[#092a53] px-4 text-sm font-semibold text-white transition hover:bg-[#163e6b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#092a53] xl:self-auto"
          onClick={openCreate}
          type="button"
        >
          <Icon path={icons.plus} />
          {t('Create a discount')}
        </button>
      </header>

      {pushStatus && (
        <p className={`flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm font-medium border ${pushStatus.configured ? 'bg-[#f6f8fa] text-[#33475e] border-[#e8e8e8]' : 'bg-[#fffbeb] text-[#92400e] border-[#fde68a]'}`} role="status">
          <Icon className="mt-0.5 size-4 shrink-0" path={pushStatus.configured ? icons.bell : icons.alert} />
          <span>
            {pushStatus.configured
              ? t('Promotion alerts are ready. {count} customer devices have them turned on.', { count: pushStatus.devices })
              : t('Promotion alerts are not working: {problem}', { problem: pushStatus.problem })}
          </span>
        </p>
      )}
      {message && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-[#dcfae5] px-4 py-3 text-sm font-medium text-[#04250e]" role="status">
          <span className="flex items-center gap-2"><Icon path={icons.check} />{message}</span>
          <button aria-label={t('Dismiss')} className="grid size-7 place-items-center rounded-md transition hover:bg-[#c4e7d0]" onClick={() => setMessage('')} type="button">
            <Icon className="size-3.5" path={icons.close} />
          </button>
        </div>
      )}
      {error && !isOverlayOpen && (
        <p className="flex items-start gap-2 rounded-lg bg-[#ffedea] px-4 py-3 text-sm font-medium text-[#831c1e]" role="alert">
          <Icon className="mt-0.5 size-4 shrink-0" path={icons.alert} />
          {error}
        </p>
      )}

      <section aria-label={t('Promotion overview')} className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[#e8e8e8] bg-[#e8e8e8] xl:grid-cols-4">
        {metrics.map((metric) => {
          const isActive = metric.filter !== null && metric.filter !== 'all' && statusFilter === metric.filter
          const body = (
            <>
              <p className="text-xs font-medium text-[#5f6368]">{t(metric.label)}</p>
              <p className="mt-1 text-2xl font-semibold leading-none tabular-nums text-[#092a53]">{metric.value.toLocaleString()}</p>
            </>
          )
          return metric.filter ? (
            <button
              aria-pressed={isActive}
              className={`bg-white p-4 text-left transition first:rounded-tl-lg last:rounded-br-lg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#092a53] hover:bg-[#f9fafb] ${isActive ? 'bg-[#f6f8fa] shadow-[inset_0_0_0_1.5px_#092a53]' : ''}`}
              key={metric.label}
              onClick={() => setStatusFilter(isActive || metric.filter === 'all' ? 'all' : metric.filter!)}
              type="button"
            >
              {body}
            </button>
          ) : (
            <div className="bg-white p-4" key={metric.label}>{body}</div>
          )
        })}
      </section>

      <section aria-labelledby="promo-library-title" className="min-w-0 rounded-lg border border-[#e8e8e8] bg-white">
        <div className="flex flex-col gap-4 border-b border-[#f2f2f2] p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#092a53]" id="promo-library-title">{t('Current codes')}</h2>
            <p className="mt-0.5 text-xs text-[#5f6368]">{t('{count} codes', { count: visibleCodes.length })}</p>
          </div>
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
            <label className="relative block shrink-0 sm:w-60">
              <span className="sr-only">{t('Search')}</span>
              <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#5f6368]" path={icons.search} />
              <input className="w-full rounded-md border border-[#dce3eb] bg-white py-2 pl-9 pr-3 text-sm font-medium text-[#092a53] transition placeholder:text-[#9aa5b3] hover:border-[#bac7d5] focus:border-[#092a53] focus:ring-2 focus:ring-[#092a53]/10 outline-none! font-mono uppercase placeholder:font-sans placeholder:normal-case" onChange={(event) => setSearch(event.target.value)} placeholder={t('Search codes')} type="search" value={search} />
            </label>
            <div aria-label={t('Status')} className="flex min-w-0 overflow-x-auto rounded-md bg-[#f4f6f8] p-1" role="group">
              {([
                { key: 'all', label: t('All') },
                { key: 'active', label: t('Active') },
                { key: 'inactive', label: t('Inactive') },
                { key: 'expired', label: t('Expired') },
                { key: 'exhausted', label: t('Fully redeemed') },
              ] as const).map((option) => (
                <button
                  aria-pressed={statusFilter === option.key}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded px-3 py-1.5 text-xs font-medium transition ${statusFilter === option.key ? 'bg-white text-[#092a53] shadow-[0_1px_2px_rgba(9,42,83,0.08)]' : 'text-[#5f6368] hover:text-[#092a53]'}`}
                  key={option.key}
                  onClick={() => setStatusFilter(option.key)}
                  type="button"
                >
                  {option.label}
                  <span className="rounded-full bg-[#e8e8e8] px-1.5 text-xs tabular-nums text-[#5f6368]">{counts[option.key]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div aria-live="polite" className="grid gap-4 p-4 sm:p-5 lg:grid-cols-2 2xl:grid-cols-3">
            {[0, 1, 2].map((item) => <div aria-hidden="true" className="h-36 animate-pulse rounded-lg bg-[#f4f6f8]" key={item} />)}
            <p className="sr-only">{t('Loading discount codes…')}</p>
          </div>
        ) : visibleCodes.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-base font-semibold text-[#092a53]">{codes.length ? t('No codes match your filters.') : t('No discount codes yet')}</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-[#5f6368]">{t('Your new codes will appear here after you create them.')}</p>
            {!codes.length && (
              <button className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-lg bg-[#092a53] px-4 text-xs font-semibold text-white transition hover:bg-[#163e6b]" onClick={openCreate} type="button">
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
                  className={`group relative flex overflow-hidden rounded-lg bg-white border border-[#e8e8e8] transition hover:border-[#bac7d5] ${deletingId === code.id ? 'opacity-50' : ''}`}
                  key={code.id}
                >
                  <div className="relative flex w-24 shrink-0 flex-col items-center justify-center border-r border-[#f2f2f2] bg-[#f9fafb] px-3 py-5 text-center">
                    <p className="text-2xl font-semibold leading-none tabular-nums text-[#092a53]">
                      {code.discountType === 'percent' ? `${code.discountValue}%` : numberFormat.format(code.discountValue)}
                    </p>
                    <p className="mt-1 text-xs font-medium text-[#5f6368]">{code.discountType === 'percent' ? t('off') : `FCFA ${t('off')}`}</p>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col p-4">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        className="flex min-w-0 items-center gap-1.5 rounded font-mono text-base font-semibold text-[#092a53] hover:text-[#123b68]"
                        onClick={() => copyCode(code)}
                        title={t('Copy')}
                        type="button"
                      >
                        <span className="truncate">{code.code}</span>
                        <Icon className="size-3.5 shrink-0 text-[#5f6368]" path={copiedId === code.id ? icons.check : icons.copy} />
                      </button>
                      <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${meta.badge}`}>
                        <span aria-hidden="true" className={`size-1.5 rounded-full ${meta.dot}`} />
                        {t(meta.label)}
                      </span>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                      <dt className="text-[#5f6368]">{t('Minimum order')}</dt>
                      <dd className="text-right font-medium tabular-nums text-[#092a53]">{Number(code.minimumTotal) ? `${numberFormat.format(code.minimumTotal)} ${t('items')}` : t('None')}</dd>
                      <dt className="text-[#5f6368]">{t('Expires at')}</dt>
                      <dd className="truncate text-right font-medium text-[#092a53]" title={expiry || undefined}>{expiry || t('No expiry')}</dd>
                    </dl>
                    <div className="mt-3">
                      <div className="flex justify-between text-xs">
                        <span className="text-[#5f6368]">{t('Redemptions')}</span>
                        <span className="font-medium tabular-nums text-[#092a53]">{code.uses}{code.maxUses != null ? ` / ${code.maxUses}` : ` · ${t('No limit')}`}</span>
                      </div>
                      {code.maxUses != null && (
                        <div aria-label={t('{used} of {max} redemptions', { used: code.uses, max: code.maxUses })} className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#f4f6f8]" role="img">
                          <span className={`block h-full rounded-full ${status === 'exhausted' ? 'bg-[#92400e]' : 'bg-[#092a53]'}`} style={{ width: `${usagePercent}%` }} />
                        </div>
                      )}
                    </div>
                    <div className="mt-auto flex justify-end gap-1 pt-3">
                      {code.isActive && (
                        <button aria-label={`${t('Notify customers')} ${code.code}`} className="grid size-8 place-items-center rounded-md text-[#5f6368] transition hover:bg-[#f4f6f8] hover:text-[#092a53]" onClick={() => { setNotifyError(''); setResendMessage(''); setCodeToNotify(code) }} title={t('Notify customers')} type="button">
                          <Icon path={icons.bell} />
                        </button>
                      )}
                      <button aria-label={`${t('Edit')} ${code.code}`} className="grid size-8 place-items-center rounded-md text-[#5f6368] transition hover:bg-[#f4f6f8] hover:text-[#092a53]" onClick={() => edit(code)} title={t('Edit')} type="button">
                        <Icon path={icons.edit} />
                      </button>
                      <button aria-label={`${t('Delete')} ${code.code}`} className="grid size-8 place-items-center rounded-md text-[#5f6368] transition hover:bg-[#ffedea] hover:text-[#831c1e]" onClick={() => { setError(''); setCodeToDelete(code) }} title={t('Delete')} type="button">
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
          <button aria-label={t('Close')} className="admin-drawer-backdrop absolute inset-0 bg-[#0b1e36]/45" onClick={() => setIsEditorOpen(false)} tabIndex={-1} type="button" />
          <section aria-labelledby="promo-drawer-title" aria-modal="true" className="admin-drawer-panel relative flex h-full w-full max-w-[32rem] flex-col bg-white shadow-[-24px_0_60px_rgba(9,42,83,0.18)]" role="dialog">
            <header className="flex items-start justify-between gap-4 border-b border-[#f2f2f2] px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-[#092a53]" id="promo-drawer-title">{t(editingId ? 'Edit discount code' : 'Create a discount')}</h2>
                <p className="mt-1 text-sm text-[#5f6368]">{t('Set up an offer customers can use at checkout.')}</p>
              </div>
              <button aria-label={t('Close')} className="grid size-9 shrink-0 place-items-center rounded-md text-[#5f6368] transition hover:bg-[#f4f6f8] hover:text-[#092a53]" onClick={() => setIsEditorOpen(false)} type="button">
                <Icon className="size-5" path={icons.close} />
              </button>
            </header>

            <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6">
                <div className="flex overflow-hidden rounded-lg border border-[#e8e8e8]">
                  <div className="flex w-24 shrink-0 flex-col items-center justify-center border-r border-[#f2f2f2] bg-[#f9fafb] px-3 py-5 text-center">
                    <p className="text-2xl font-semibold leading-none tabular-nums text-[#092a53]">{form.discountValue ? (form.discountType === 'percent' ? `${form.discountValue}%` : numberFormat.format(Number(form.discountValue))) : '—'}</p>
                    <p className="mt-1 text-xs font-medium text-[#5f6368]">{form.discountType === 'percent' ? t('off') : `FCFA ${t('off')}`}</p>
                  </div>
                  <div className="min-w-0 flex-1 p-4">
                    <p className="text-xs font-medium text-[#5f6368]">{t('Offer preview')}</p>
                    <p className="mt-1 truncate font-mono text-lg font-semibold text-[#092a53]">{form.code || t('Your code')}</p>
                    <p className="mt-1 text-xs text-[#5f6368]">
                      {previewValue} {t('off')}
                      {Number(form.minimumTotal) ? ` · ${t('Minimum order')} ${numberFormat.format(Number(form.minimumTotal))} ${t('items')}` : ''}
                    </p>
                  </div>
                </div>

                <label className={labelClassName}>
                  {t('Code')}
                  <span className="mt-1.5 flex gap-2">
                    <span className="relative block flex-1">
                      <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#5f6368]" path={icons.tag} />
                      <input className={`${inputClassName} mt-0 pl-9 font-mono font-semibold uppercase`} maxLength={30} onChange={(event) => setField('code', event.target.value.toUpperCase())} pattern="[A-Za-z0-9_\-]{3,30}" placeholder="SWEET10" required value={form.code} />
                    </span>
                    <button
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#dce3eb] bg-white px-3 text-xs font-semibold text-[#092a53] transition hover:border-[#bac7d5]"
                      onClick={() => setField('code', randomCode())}
                      type="button"
                    >
                      <Icon path={icons.spark} />
                      {t('Generate')}
                    </button>
                  </span>
                  <span className="mt-1 block text-xs font-medium text-[#65748a]">{t('3–30 letters, numbers, dashes or underscores.')}</span>
                </label>

                <fieldset>
                  <legend className={labelClassName}>{t('Discount type')}</legend>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    {([
                      { key: 'percent', label: t('Percent'), hint: '%' },
                      { key: 'fixed', label: t('Fixed FCFA'), hint: 'FCFA' },
                    ] as const).map((option) => (
                      <label
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-3 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[#092a53] ${form.discountType === option.key ? 'border-[#092a53] bg-[#f6f8fa]' : 'border-[#e8e8e8] bg-white hover:border-[#bac7d5]'}`}
                        key={option.key}
                      >
                        <input checked={form.discountType === option.key} className="sr-only" name="discountType" onChange={() => setField('discountType', option.key)} type="radio" />
                        <span className="text-sm font-medium text-[#092a53]">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className={labelClassName}>
                    {t('Discount value')}
                    <span className="relative block">
                      <input className={`${inputClassName} pr-14`} max={form.discountType === 'percent' ? 100 : undefined} min="1" onChange={(event) => setField('discountValue', event.target.value)} required type="number" value={form.discountValue} />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[#5f6368]">{form.discountType === 'percent' ? '%' : 'FCFA'}</span>
                    </span>
                  </label>
                  <label className={labelClassName}>
                    {t('Minimum order')}
                    <span className="relative block">
                      <input className={`${inputClassName} pr-14`} min="0" onChange={(event) => setField('minimumTotal', event.target.value)} step="1" type="number" value={form.minimumTotal} />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[#5f6368]">{t('items')}</span>
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
                      className="rounded-md border border-[#e8e8e8] bg-white px-2.5 py-1 text-xs font-medium text-[#5f6368] transition hover:border-[#bac7d5] hover:text-[#092a53]"
                      key={preset.label}
                      onClick={() => setExpiryInDays(preset.days)}
                      type="button"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <label className="flex cursor-pointer items-center gap-4 rounded-lg border border-[#e8e8e8] p-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[#092a53]">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-[#092a53]">{t('Active')}</span>
                    <span className="block text-xs text-[#5f6368]">{t('Available for customers to use')}</span>
                  </span>
                  <input checked={form.isActive} className="peer sr-only" onChange={(event) => setField('isActive', event.target.checked)} type="checkbox" />
                  <span aria-hidden="true" className="relative h-6 w-11 shrink-0 rounded-full bg-[#dce3eb] transition after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:transition peer-checked:bg-[#247b50] peer-checked:after:translate-x-5" />
                </label>

                {!editingId && (
                  <fieldset className="space-y-4 rounded-lg border border-[#e8e8e8] p-4">
                    <legend className="px-1 text-sm font-medium text-[#092a53]">{t('Customer notification')}</legend>
                    <label className="flex cursor-pointer items-center gap-4 has-[:focus-visible]:rounded-md has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[#092a53]">
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-[#092a53]">{t('Notify customers')}</span>
                        <span className="block text-xs text-[#5f6368]">
                          {form.isActive
                            ? t('Sends a notification to every customer account that turned on promotion alerts.')
                            : t('Inactive codes are saved quietly. Turn on Active to notify customers.')}
                        </span>
                      </span>
                      <input checked={notifyCustomers} className="peer sr-only" disabled={!form.isActive} onChange={(event) => setNotifyCustomers(event.target.checked)} type="checkbox" />
                      <span aria-hidden="true" className="relative h-6 w-11 shrink-0 rounded-full bg-[#dce3eb] transition after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:transition peer-checked:bg-[#247b50] peer-checked:after:translate-x-5 peer-disabled:opacity-50" />
                    </label>

                    {notifyCustomers && form.isActive && (
                      <>
                        <label className={labelClassName}>
                          <span className="flex items-baseline justify-between gap-3">
                            <span>{t('Notification message')}</span>
                            <span className={`font-semibold tabular-nums ${notificationMessage.length > MAX_NOTIFICATION_MESSAGE - 20 ? 'text-[#92400e]' : 'text-[#9aa5b3]'}`}>
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
                          <span className="mt-1.5 block font-medium text-[#5f6368]">
                            {t('Optional. Leave empty to use a message written from the discount details. The code is added if your message leaves it out.')}
                          </span>
                        </label>

                        {(() => {
                          const preview = previewNotification(form, notificationMessage)
                          return (
                            <div>
                              <p className="text-xs font-medium text-[#5f6368]">{t('Preview on a phone')}</p>
                              <div className="mt-2 flex gap-3 rounded-lg bg-[#202124] p-3.5 text-white">
                                <img decoding="async" loading="lazy" alt="" className="size-10 shrink-0 rounded-full" height={40} src="/icons/icon-192.png" width={40} />
                                <div className="min-w-0 flex-1">
                                  <p className="flex items-center gap-1.5 text-xs text-white/55">
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
                  <p className="flex items-start gap-2 rounded-lg bg-[#ffedea] px-4 py-3 text-sm font-medium text-[#831c1e]" role="alert">
                    <Icon className="mt-0.5 size-4 shrink-0" path={icons.alert} />
                    {error}
                  </p>
                )}
              </div>

              <footer className="flex items-center justify-end gap-3 border-t border-[#f2f2f2] bg-[#f9fafb] px-6 py-4">
                <button className="min-h-9 rounded-lg border border-[#e8e8e8] bg-white px-4 text-sm font-semibold text-[#092a53] transition hover:border-[#bac7d5]" onClick={() => setIsEditorOpen(false)} type="button">{t('Cancel')}</button>
                <button
                  className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-[#092a53] px-5 text-sm font-semibold text-white transition hover:bg-[#163e6b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#092a53] disabled:cursor-wait disabled:opacity-60"
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
            <button aria-label={t('Cancel')} className="admin-drawer-backdrop absolute inset-0 bg-[#0b1e36]/45" onClick={() => setCodeToNotify(null)} tabIndex={-1} type="button" />
            <section aria-labelledby="notify-code-title" aria-modal="true" className="admin-modal-panel relative w-full max-w-md rounded-lg bg-white p-6 shadow-[0_30px_80px_rgba(9,42,83,0.3)]" role="dialog">
              <h2 className="text-lg font-semibold text-[#092a53]" id="notify-code-title">{t('Notify customers about {code}', { code: codeToNotify.code })}</h2>
              <p className="mt-1 text-sm leading-6 text-[#5f6368]">
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
              <div className="mt-3 flex gap-3 rounded-lg bg-[#202124] p-3.5 text-white">
                <img decoding="async" loading="lazy" alt="" className="size-10 shrink-0 rounded-full" height={40} src="/icons/icon-192.png" width={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{preview.title}</p>
                  <p className="mt-0.5 line-clamp-3 break-words text-[13px] leading-5 text-white/80">{preview.body}</p>
                </div>
              </div>
              {notifyError && <p className="mt-3 rounded-lg bg-[#ffedea] px-3 py-2.5 text-sm font-medium text-[#831c1e]" role="alert">{notifyError}</p>}
              <div className="mt-6 flex justify-end gap-2.5">
                <button className="min-h-9 rounded-lg border border-[#e8e8e8] bg-white px-4 text-sm font-semibold text-[#092a53] transition hover:border-[#bac7d5]" onClick={() => setCodeToNotify(null)} type="button">{t('Cancel')}</button>
                <button
                  className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-[#092a53] px-4 text-sm font-semibold text-white transition hover:bg-[#163e6b] disabled:cursor-wait disabled:opacity-60"
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
          <button aria-label={t('Cancel')} className="admin-drawer-backdrop absolute inset-0 bg-[#0b1e36]/45" onClick={() => setCodeToDelete(null)} tabIndex={-1} type="button" />
          <section aria-labelledby="delete-code-title" aria-modal="true" className="admin-modal-panel relative w-full max-w-md rounded-lg bg-white p-6 shadow-[0_30px_80px_rgba(9,42,83,0.3)]" role="dialog">
            <h2 className="text-lg font-semibold text-[#092a53]" id="delete-code-title">{t('Delete discount code "{code}"?', { code: codeToDelete.code })}</h2>
            <p className="mt-2 text-sm leading-6 text-[#5f6368]">
              {codeToDelete.uses > 0
                ? t('It has been redeemed {count} times. Customers will no longer be able to use it.', { count: codeToDelete.uses })
                : t('Customers will no longer be able to use it.')}
            </p>
            {codeToDelete.isActive && (
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-[#f9fafb] px-3 py-2.5 text-xs font-medium text-[#5f6368]">
                <Icon className="mt-0.5 size-3.5 shrink-0" path={icons.pause} />
                {t('Tip: switch it to inactive instead if you may reuse it later.')}
              </p>
            )}
            {error && <p className="mt-3 rounded-lg bg-[#ffedea] px-3 py-2.5 text-sm font-medium text-[#831c1e]" role="alert">{error}</p>}
            <div className="mt-6 flex justify-end gap-2.5">
              <button className="min-h-9 rounded-lg border border-[#e8e8e8] bg-white px-4 text-sm font-semibold text-[#092a53] transition hover:border-[#bac7d5]" onClick={() => setCodeToDelete(null)} type="button">{t('Cancel')}</button>
              <button
                className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-[#c4242a] px-4 text-sm font-semibold text-white transition hover:bg-[#a51e23] disabled:cursor-wait disabled:opacity-60"
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
