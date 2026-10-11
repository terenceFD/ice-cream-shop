import { useEffect, useState, type FormEvent } from 'react'
import { apiRequest } from '../../../api/api'
import { useAdminAuth } from './AdminAuthContext'
import { useLanguage } from '../../../language/LanguageContext'

const freshForm: DiscountCodeForm = { code: '', discountType: 'percent', discountValue: '', minimumTotal: 0, maxUses: '', expiresAt: '', isActive: true }
const fieldClass = 'mt-1.5 w-full rounded-xl border border-[#dce5ef] bg-white px-3.5 py-3 text-sm text-[#102c50] outline-none transition placeholder:text-[#93a1b1] hover:border-[#b8c9dc] focus:border-[#bd9c00] focus:ring-4 focus:ring-[#ffdc32]/20'

type DiscountType = 'percent' | 'fixed'

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

function isExpired(code: DiscountCode) {
  return Boolean(code.expiresAt && Date.parse(code.expiresAt) <= Date.now())
}

function formatExpiry(value: string | null, language: string) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(language === 'fr' ? 'fr-CM' : 'en-CM', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function AdminPromotionsPage() {
  const { sessionToken } = useAdminAuth()
  const { t, language } = useLanguage()
  const [codes, setCodes] = useState<DiscountCode[]>([])
  const [form, setForm] = useState<DiscountCodeForm>(freshForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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

  function setField<K extends keyof DiscountCodeForm>(name: K, value: DiscountCodeForm[K]) {
    setForm((current) => ({ ...current, [name]: value }))
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
    }
    try {
      await apiRequest(editingId ? `/admin/discount-codes/${editingId}` : '/admin/discount-codes', {
        method: editingId ? 'PUT' : 'POST',
        token: sessionToken,
        body: payload,
      })
      await refresh()
      setForm(freshForm)
      setEditingId(null)
      setMessage(t('Discount code saved.'))
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save discount code.')
    } finally {
      setSaving(false)
    }
  }

  function edit(code: DiscountCode) {
    setEditingId(code.id)
    setForm({
      ...code,
      discountValue: String(code.discountValue),
      minimumTotal: String(code.minimumTotal),
      maxUses: code.maxUses == null ? '' : String(code.maxUses),
      expiresAt: code.expiresAt ? new Date(code.expiresAt).toISOString().slice(0, 16) : '',
    })
    setMessage('')
    setError('')
  }

  async function remove(code: DiscountCode) {
    if (!window.confirm(t('Delete discount code "{code}"?', { code: code.code }))) return
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
      setMessage(t('Discount code deleted.'))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete discount code.')
    } finally {
      setDeletingId(null)
    }
  }

  const activeCount = codes.filter((code) => code.isActive && !isExpired(code) && !(code.maxUses != null && code.uses >= code.maxUses)).length
  const totalUses = codes.reduce((total, code) => total + code.uses, 0)
  const previewValue = form.discountValue
    ? form.discountType === 'percent'
      ? `${form.discountValue}%`
      : `${new Intl.NumberFormat(language === 'fr' ? 'fr-CM' : 'en-CM').format(Number(form.discountValue))} FCFA`
    : '—'

  return (
    <div className="space-y-7">
      <section className="relative isolate overflow-hidden rounded-[26px] bg-[#092a53] px-5 py-7 text-white shadow-[0_18px_40px_rgba(9,42,83,0.16)] sm:px-8 sm:py-9">
        <div aria-hidden="true" className="absolute -right-10 -top-24 -z-10 size-72 rounded-full border-[38px] border-white/[0.045]" />
        <div aria-hidden="true" className="absolute -bottom-28 right-36 -z-10 size-52 rounded-full bg-[#ffdc32]/10 blur-2xl" />
        <div className="relative max-w-2xl">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#ffe875]">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-[#ffdc32]" />
            {t('Sales promotions')}
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t('Promotions and discount codes')}</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-blue-100/80">{t('Create percentage or fixed FCFA discounts. Codes are validated and applied on the server when an order is created.')}</p>
        </div>
        <div className="relative mt-7 grid grid-cols-2 gap-3 sm:max-w-xl sm:grid-cols-3">
          {[
            { label: t('Total codes'), value: codes.length, icon: 'M4 8h16M4 16h16M7 5v14m10-14v14' },
            { label: t('Active now'), value: activeCount, icon: 'm5 12 4 4L19 6' },
            { label: t('Total redemptions'), value: totalUses, icon: 'M12 8v8m-4-4h8M5 5h14v14H5z' },
          ].map((metric, index) => (
            <article className={`${index === 2 ? 'col-span-2 sm:col-span-1' : ''} rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3.5 backdrop-blur-sm`} key={metric.label}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-100/65">{metric.label}</p>
                <svg aria-hidden="true" className="size-4 text-[#ffdc32]" fill="none" viewBox="0 0 24 24">
                  <path d={metric.icon} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
                </svg>
              </div>
              <p className="mt-1.5 font-display text-2xl font-bold">{metric.value}</p>
            </article>
          ))}
        </div>
      </section>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700" role="alert">{error}</p>}
      {message && <p className="rounded-xl border border-green-200 bg-green-50 p-3.5 text-sm text-green-800" role="status">{message}</p>}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(310px,0.82fr)_minmax(0,1.18fr)]">
        <section className="overflow-hidden rounded-[22px] border border-[#e2e8f0] bg-[#f8fafc] shadow-[0_8px_24px_rgba(16,44,80,0.04)]">
          <div className="border-b border-[#e6ebf1] px-5 py-5 sm:px-6">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#ffdc32] text-[#092a53]">
                <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
                  <path d="M12 5v14m-7-7h14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                </svg>
              </span>
              <div>
                <h2 className="font-display text-xl font-bold">{t(editingId ? 'Edit discount code' : 'Create a discount')}</h2>
                <p className="mt-1 text-xs leading-5 text-[#65748a]">{t('Set up an offer customers can use at checkout.')}</p>
              </div>
            </div>
          </div>

          <form className="space-y-4 p-5 sm:p-6" onSubmit={submit}>
            <label className="block text-xs font-bold text-[#344d69]">
              {t('Code')}
              <div className="relative mt-1.5">
                <svg aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#8495a8]" fill="none" viewBox="0 0 24 24">
                  <path d="m20 13-7 7-10-10V3h7l10 10ZM7.5 7.5h.01" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
                </svg>
                <input className={`${fieldClass} pl-10 font-mono font-bold uppercase tracking-[0.08em]`} maxLength={30} onChange={(event) => setField('code', event.target.value.toUpperCase())} pattern="[A-Za-z0-9_\-]{3,30}" placeholder="SWEET10" required value={form.code} />
              </div>
            </label>

            <div className="grid grid-cols-[1fr_0.8fr] gap-3">
              <label className="block text-xs font-bold text-[#344d69]">
                {t('Discount type')}
                <select className={fieldClass} onChange={(event) => setField('discountType', event.target.value === 'fixed' ? 'fixed' : 'percent')} value={form.discountType}>
                  <option value="percent">{t('Percent')}</option>
                  <option value="fixed">{t('Fixed FCFA')}</option>
                </select>
              </label>
              <label className="block text-xs font-bold text-[#344d69]">
                {t('Discount value')}
                <div className="relative">
                  <input className={`${fieldClass} pr-10`} min="1" onChange={(event) => setField('discountValue', event.target.value)} required type="number" value={form.discountValue} />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#8796a8]">{form.discountType === 'percent' ? '%' : 'FCFA'}</span>
                </div>
              </label>
            </div>

            <div className="rounded-2xl border border-dashed border-[#cbd8e5] bg-white p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#fff5c4] text-[#806a00]">
                    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 20 20">
                      <path d="M16.5 10.5 10 17l-7-7V3.5h6.5l7 7ZM6 6h.01" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#75869a]">{t('Offer preview')}</p>
                    <p className="mt-0.5 truncate font-mono text-sm font-extrabold tracking-wide text-[#102c50]">{form.code || t('Your code')}</p>
                  </div>
                </div>
                <span className="shrink-0 rounded-lg bg-[#092a53] px-3 py-1.5 font-display text-sm font-bold text-[#ffdc32]">{previewValue}</span>
              </div>
            </div>

            <label className="block text-xs font-bold text-[#344d69]">
              {t('Minimum order (FCFA)')}
              <input className={fieldClass} min="0" onChange={(event) => setField('minimumTotal', event.target.value)} type="number" value={form.minimumTotal} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-bold text-[#344d69]">
                {t('Maximum uses')}
                <input className={fieldClass} min="1" onChange={(event) => setField('maxUses', event.target.value)} placeholder={t('No limit')} type="number" value={form.maxUses} />
              </label>
              <label className="block text-xs font-bold text-[#344d69]">
                {t('Expires at')}
                <input className={fieldClass} onChange={(event) => setField('expiresAt', event.target.value)} type="datetime-local" value={form.expiresAt} />
              </label>
            </div>
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[#e2e8f0] bg-white px-3.5 py-3">
              <span>
                <span className="block text-xs font-bold text-[#344d69]">{t('Active')}</span>
                <span className="mt-0.5 block text-[11px] text-[#8190a1]">{t('Available for customers to use')}</span>
              </span>
              <input checked={form.isActive} className="size-4 accent-[#092a53]" onChange={(event) => setField('isActive', event.target.checked)} type="checkbox" />
            </label>

            <div className="flex flex-wrap gap-2 pt-1">
              <button className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#092a53] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#163e6b] disabled:cursor-wait disabled:opacity-60" disabled={saving} type="submit">
                {saving ? t('Saving…') : t(editingId ? 'Save code' : 'Create code')}
                {!saving && <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 20 20"><path d="M4 10h12m-5-5 5 5-5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" /></svg>}
              </button>
              {editingId && <button className="min-h-11 rounded-xl border border-[#ccd8e4] bg-white px-4 py-2.5 text-sm font-bold text-[#50657d] transition hover:bg-[#f1f5f9]" onClick={() => { setEditingId(null); setForm(freshForm); setError(''); setMessage('') }} type="button">{t('Cancel')}</button>}
            </div>
          </form>
        </section>

        <section className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#bd9c00]">{t('Promotion library')}</p>
              <h2 className="font-display text-2xl font-bold tracking-tight">{t('Current codes')}</h2>
            </div>
            {!loading && <span className="rounded-full bg-[#f1f5f9] px-3 py-1.5 text-xs font-bold text-[#65748a]">{t('{count} codes', { count: codes.length })}</span>}
          </div>

          <div className="mt-4 space-y-3">
            {loading ? (
              <div aria-live="polite" className="grid gap-3">
                {[0, 1, 2].map((item) => <div aria-hidden="true" className="h-32 animate-pulse rounded-2xl border border-[#e2e8f0] bg-[#f4f7fa]" key={item} />)}
                <p className="sr-only">{t('Loading discount codes…')}</p>
              </div>
            ) : codes.map((code) => {
              const expired = isExpired(code)
              const exhausted = code.maxUses != null && code.uses >= code.maxUses
              const isCurrent = code.isActive && !expired && !exhausted
              const usagePercent = code.maxUses ? Math.min(100, (code.uses / code.maxUses) * 100) : 0
              const expiry = formatExpiry(code.expiresAt, language)
              return (
                <article className="group relative overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-[0_4px_14px_rgba(16,44,80,0.035)] transition hover:border-[#c5d3e1] hover:shadow-[0_10px_26px_rgba(16,44,80,0.08)] sm:p-5" key={code.id}>
                  <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${isCurrent ? 'bg-[#ffdc32]' : 'bg-[#dce5ef]'}`} />
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#f2f6fb] text-[#294f74]">
                        <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
                          <path d="m20 13-7 7-10-10V3h7l10 10ZM7.5 7.5h.01" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
                        </svg>
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate font-mono text-base font-extrabold tracking-wide text-[#102c50]">{code.code}</h3>
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${isCurrent ? 'bg-green-50 text-green-800' : 'bg-[#f1f4f7] text-[#65748a]'}`}>
                            {isCurrent ? t('Active') : !code.isActive ? t('Inactive') : expired ? t('Expired') : t('Fully redeemed')}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[#65748a]">
                          {code.discountType === 'percent' ? `${code.discountValue}% ${t('off')}` : `${new Intl.NumberFormat(language === 'fr' ? 'fr-CM' : 'en-CM').format(code.discountValue)} FCFA ${t('off')}`}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-xl bg-[#fff8d7] px-3 py-2 text-right">
                      <p className="font-display text-lg font-bold leading-none text-[#806a00]">{code.discountType === 'percent' ? `${code.discountValue}%` : `${new Intl.NumberFormat(language === 'fr' ? 'fr-CM' : 'en-CM').format(code.discountValue)}`}</p>
                      <p className="mt-1 text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#8c7615]">{code.discountType === 'percent' ? t('off') : 'FCFA'}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-[#edf1f5] pt-3 sm:grid-cols-3">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.11em] text-[#8796a8]">{t('Redemptions')}</p>
                      <p className="mt-1 text-xs font-bold text-[#344d69]">{code.uses}{code.maxUses != null ? ` / ${code.maxUses}` : ''}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.11em] text-[#8796a8]">{t('Minimum order')}</p>
                      <p className="mt-1 text-xs font-bold text-[#344d69]">{new Intl.NumberFormat(language === 'fr' ? 'fr-CM' : 'en-CM').format(code.minimumTotal)} FCFA</p>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <p className="text-[9px] font-bold uppercase tracking-[0.11em] text-[#8796a8]">{t('Expires at')}</p>
                      <p className="mt-1 text-xs font-bold text-[#344d69]">{expiry || t('No expiry')}</p>
                    </div>
                  </div>

                  {code.maxUses != null && (
                    <div aria-label={t('{used} of {max} redemptions', { used: code.uses, max: code.maxUses })} className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#edf1f5]" role="img">
                      <span className="block h-full rounded-full bg-[#ffdc32] transition-all" style={{ width: `${usagePercent}%` }} />
                    </div>
                  )}

                  <div className="mt-4 flex justify-end gap-2">
                    <button className="min-h-9 rounded-lg border border-[#dce5ef] px-3 text-xs font-bold text-[#355777] transition hover:border-[#b8c9dc] hover:bg-[#f6f9fc]" onClick={() => edit(code)} type="button">{t('Edit')}</button>
                    <button className="min-h-9 rounded-lg border border-red-200 px-3 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-50" disabled={deletingId === code.id} onClick={() => remove(code)} type="button">{deletingId === code.id ? t('Deleting…') : t('Delete')}</button>
                  </div>
                </article>
              )
            })}
            {!loading && codes.length === 0 && (
              <div className="rounded-2xl border border-dashed border-[#cbd8e5] bg-[#f8fafc] px-6 py-10 text-center">
                <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-white text-[#8293a7] shadow-sm">
                  <svg aria-hidden="true" className="size-6" fill="none" viewBox="0 0 24 24">
                    <path d="m20 13-7 7-10-10V3h7l10 10ZM7.5 7.5h.01" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
                  </svg>
                </span>
                <h3 className="mt-4 font-display text-lg font-bold">{t('No discount codes yet')}</h3>
                <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-[#65748a]">{t('Your new codes will appear here after you create them.')}</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
