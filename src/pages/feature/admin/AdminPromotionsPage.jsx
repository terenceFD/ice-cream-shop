import { useEffect, useState } from 'react'
import { apiRequest } from '../../../api/api'
import { useAdminAuth } from './AdminAuthContext'
import { useLanguage } from '../../../language/LanguageContext'

const freshForm = { code: '', discountType: 'percent', discountValue: '', minimumTotal: 0, maxUses: '', expiresAt: '', isActive: true }
const fieldClass = 'mt-1 w-full rounded-xl border border-[#d9d6cc] bg-white px-3 py-2.5 text-sm'

export function AdminPromotionsPage() {
  const { sessionToken } = useAdminAuth()
  const { t } = useLanguage()
  const [codes, setCodes] = useState([])
  const [form, setForm] = useState(freshForm)
  const [editingId, setEditingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function refresh() {
    const result = await apiRequest('/admin/discount-codes', { token: sessionToken })
    setCodes(result.discountCodes)
  }

  useEffect(() => {
    let cancelled = false
    apiRequest('/admin/discount-codes', { token: sessionToken })
      .then((result) => { if (!cancelled) setCodes(result.discountCodes) })
      .catch((loadError) => { if (!cancelled) setError(loadError.message) })
    return () => { cancelled = true }
  }, [sessionToken])

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setMessage('')
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
      setError(saveError.message)
    }
  }

  function edit(code) {
    setEditingId(code.id)
    setForm({
      ...code,
      discountValue: String(code.discountValue),
      minimumTotal: String(code.minimumTotal),
      maxUses: code.maxUses == null ? '' : String(code.maxUses),
      expiresAt: code.expiresAt ? new Date(code.expiresAt).toISOString().slice(0, 16) : '',
    })
  }

  async function remove(code) {
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
      setError(deleteError.message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
      <section>
        <h1 className="font-display text-3xl font-bold">{t('Promotions and discount codes')}</h1>
        <p className="mt-2 text-sm leading-6 text-[#65748a]">{t('Create percentage or fixed FCFA discounts. Codes are validated and applied on the server when an order is created.')}</p>
        <form className="mt-5 space-y-3 rounded-2xl border border-[#d9d6cc] bg-white p-5" onSubmit={submit}>
          <label className="block text-sm font-semibold">{t('Code')}<input className={fieldClass} maxLength={30} onChange={(event) => setField('code', event.target.value.toUpperCase())} pattern="[A-Za-z0-9_\-]{3,30}" required value={form.code} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-semibold">{t('Discount type')}<select className={fieldClass} onChange={(event) => setField('discountType', event.target.value)} value={form.discountType}><option value="percent">{t('Percent')}</option><option value="fixed">{t('Fixed FCFA')}</option></select></label>
            <label className="block text-sm font-semibold">{t('Discount value')}<input className={fieldClass} min="1" onChange={(event) => setField('discountValue', event.target.value)} required type="number" value={form.discountValue} /></label>
          </div>
          <label className="block text-sm font-semibold">{t('Minimum order (FCFA)')}<input className={fieldClass} min="0" onChange={(event) => setField('minimumTotal', event.target.value)} type="number" value={form.minimumTotal} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-semibold">{t('Maximum uses')}<input className={fieldClass} min="1" onChange={(event) => setField('maxUses', event.target.value)} type="number" value={form.maxUses} /></label>
            <label className="block text-sm font-semibold">{t('Expires at')}<input className={fieldClass} onChange={(event) => setField('expiresAt', event.target.value)} type="datetime-local" value={form.expiresAt} /></label>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold"><input checked={form.isActive} onChange={(event) => setField('isActive', event.target.checked)} type="checkbox" />{t('Active')}</label>
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
          {message && <p className="rounded-xl bg-green-50 p-3 text-sm text-green-800" role="status">{message}</p>}
          <div className="flex gap-2">
            <button className="rounded-full bg-[#ffdc32] px-5 py-2.5 text-sm font-bold" type="submit">{t(editingId ? 'Save code' : 'Create code')}</button>
            {editingId && <button className="rounded-full border px-4 py-2.5 text-sm font-bold" onClick={() => { setEditingId(null); setForm(freshForm) }} type="button">{t('Cancel')}</button>}
          </div>
        </form>
      </section>
      <section>
        <h2 className="font-display text-2xl font-bold">{t('Current codes')}</h2>
        <div className="mt-4 space-y-3">
          {codes.map((code) => (
            <article className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#d9d6cc] bg-white p-4" key={code.id}>
              <div className="min-w-0 flex-1">
                <p className="font-bold">{code.code} · {code.discountType === 'percent' ? `${code.discountValue}%` : `${new Intl.NumberFormat('fr-CM').format(code.discountValue)} FCFA`}</p>
                <p className="mt-1 text-xs text-[#65748a]">{t('Used {used} times', { used: code.uses })}{code.maxUses ? ` / ${code.maxUses}` : ''} · {code.isActive ? t('Active') : t('Inactive')}</p>
              </div>
              <button className="rounded-full border px-3 py-1.5 text-xs font-bold" onClick={() => edit(code)} type="button">{t('Edit')}</button>
              <button className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 disabled:opacity-50" disabled={deletingId === code.id} onClick={() => remove(code)} type="button">{deletingId === code.id ? t('Deleting…') : t('Delete')}</button>
            </article>
          ))}
          {codes.length === 0 && <p className="rounded-xl bg-[#f4f2f2] p-4 text-sm text-[#65748a]">{t('No discount codes created yet.')}</p>}
        </div>
      </section>
    </div>
  )
}
