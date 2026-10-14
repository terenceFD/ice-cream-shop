import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../../../api/api'
import { useLanguage } from '../../../language/useLanguage'
import { useAdminAuth } from './useAdminAuth'
import { AdminReviewsBoard } from './AdminReviewsBoard'
import { AdminCakeRequestsBoard } from './AdminCakeRequestsBoard'

function useAdminRequest() {
  const { sessionToken } = useAdminAuth()
  const request = useCallback((path, options = {}) => apiRequest(path, { ...options, token: sessionToken }), [sessionToken])
  return request
}

function ErrorMessage({ children }) {
  return children ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{children}</p> : null
}

function formatAdminDate(value, language, includeTime = false) {
  if (!value) return null
  const date = value instanceof Date
    ? value
    : new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(String(value))
      ? String(value)
      : `${String(value).replace(' ', 'T')}Z`)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(language === 'fr' ? 'fr-CM' : 'en-CM', {
    dateStyle: 'medium',
    ...(includeTime ? { timeStyle: 'short' } : {}),
  }).format(date)
}

export function AdminFulfillmentPage() {
  const request = useAdminRequest()
  const { t } = useLanguage()
  const [zones, setZones] = useState([])
  const [slots, setSlots] = useState([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const refresh = useCallback(async () => {
    try {
      const result = await request('/admin/fulfillment-settings')
      setZones(result.zones)
      setSlots(result.slots)
    } catch (loadError) {
      setError(loadError.message)
    }
  }, [request])

  useEffect(() => { refresh() }, [refresh])

  async function saveZones(event) {
    event.preventDefault()
    setError('')
    try {
      await request('/admin/fulfillment-zones', {
        method: 'PUT',
        body: { zones: zones.map((zone) => ({ ...zone, deliveryFee: Number(zone.deliveryFee) })) },
      })
      setMessage(t('Fulfillment zones saved.'))
    } catch (saveError) {
      setError(saveError.message)
    }
  }

  async function saveSlots(event) {
    event.preventDefault()
    setError('')
    try {
      await request('/admin/fulfillment-slots', { method: 'PUT', body: { slots } })
      setMessage(t('Time slots saved.'))
      await refresh()
    } catch (saveError) {
      setError(saveError.message)
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">{t('Pickup and delivery settings')}</h1>
      <p className="mt-2 text-sm text-[#65748a]">{t('Enable service areas, set delivery prices, and control the appointment slots offered at checkout.')}</p>
      <ErrorMessage>{error}</ErrorMessage>
      {message && <p className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800" role="status">{message}</p>}
      <form className="mt-6 space-y-3" onSubmit={saveZones}>
        <h2 className="font-display text-2xl font-bold">{t('Store branches and service areas')}</h2>
        {zones.map((zone) => (
          <article className="grid gap-3 rounded-2xl border border-[#d9d6cc] bg-white p-4 sm:grid-cols-[minmax(190px,1fr)_auto_auto_150px_auto]" key={zone.id}>
            <div className="self-center">
              <p className="text-sm font-extrabold text-[#092a53]">{t(zone.storeName)}</p>
              <p className="mt-1 text-xs text-[#65748a]">{t(zone.location)}{zone.storeAddress ? ` · ${t(zone.storeAddress)}` : ''}</p>
              {zone.storePhone && <p className="mt-1 text-xs font-semibold text-[#52647b]">{zone.storePhone}</p>}
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold"><input checked={zone.pickupEnabled} onChange={(event) => setZones((current) => current.map((entry) => entry.id === zone.id ? { ...entry, pickupEnabled: event.target.checked } : entry))} type="checkbox" />{t('Pickup')}</label>
            <label className="flex items-center gap-2 text-xs font-semibold"><input checked={zone.deliveryEnabled} onChange={(event) => setZones((current) => current.map((entry) => entry.id === zone.id ? { ...entry, deliveryEnabled: event.target.checked } : entry))} type="checkbox" />{t('Delivery')}</label>
            <label className="text-xs font-bold">{t('Delivery fee (FCFA)')}<input className="mt-1 w-full rounded-lg border border-[#d9d6cc] px-3 py-2 text-sm" min="0" onChange={(event) => setZones((current) => current.map((entry) => entry.id === zone.id ? { ...entry, deliveryFee: event.target.value } : entry))} type="number" value={zone.deliveryFee} /></label>
            <label className="flex items-center gap-2 self-center text-xs font-semibold"><input checked={zone.isActive} onChange={(event) => setZones((current) => current.map((entry) => entry.id === zone.id ? { ...entry, isActive: event.target.checked } : entry))} type="checkbox" />{t('Active')}</label>
          </article>
        ))}
        <button className="rounded-full bg-[#ffdc32] px-5 py-2.5 text-sm font-bold" type="submit">{t('Save branch availability')}</button>
      </form>
      <form className="mt-10 space-y-3" onSubmit={saveSlots}>
        <h2 className="font-display text-2xl font-bold">{t('Available time slots')}</h2>
        {slots.map((slot, index) => (
          <div className="grid gap-3 rounded-xl border border-[#d9d6cc] bg-white p-4 sm:grid-cols-[1fr_1fr_1fr_auto_auto]" key={slot.id}>
            <label className="text-xs font-bold">{t('Slot label')}<input className="mt-1 w-full rounded-lg border border-[#d9d6cc] px-3 py-2 text-sm" maxLength={60} onChange={(event) => setSlots((current) => current.map((entry, slotIndex) => slotIndex === index ? { ...entry, label: event.target.value } : entry))} required value={slot.label} /></label>
            <label className="text-xs font-bold">{t('Starts')}<input className="mt-1 w-full rounded-lg border border-[#d9d6cc] px-3 py-2 text-sm" onChange={(event) => setSlots((current) => current.map((entry, slotIndex) => slotIndex === index ? { ...entry, startTime: event.target.value } : entry))} required type="time" value={slot.startTime} /></label>
            <label className="text-xs font-bold">{t('Ends')}<input className="mt-1 w-full rounded-lg border border-[#d9d6cc] px-3 py-2 text-sm" onChange={(event) => setSlots((current) => current.map((entry, slotIndex) => slotIndex === index ? { ...entry, endTime: event.target.value } : entry))} required type="time" value={slot.endTime} /></label>
            <label className="flex items-center gap-2 text-xs font-semibold"><input checked={slot.isActive} onChange={(event) => setSlots((current) => current.map((entry, slotIndex) => slotIndex === index ? { ...entry, isActive: event.target.checked } : entry))} type="checkbox" />{t('Active')}</label>
            <button aria-label={t('Remove time slot')} className="text-sm font-bold text-red-700 underline" onClick={() => setSlots((current) => current.filter((_, slotIndex) => slotIndex !== index))} type="button">{t('Remove')}</button>
          </div>
        ))}
        <div className="flex flex-wrap gap-3">
          <button className="rounded-full border border-[#65748a] px-5 py-2.5 text-sm font-bold" disabled={slots.length >= 20} onClick={() => setSlots((current) => [...current, { label: '', startTime: '10:00', endTime: '12:00', isActive: true }])} type="button">{t('Add time slot')}</button>
          <button className="rounded-full bg-[#ffdc32] px-5 py-2.5 text-sm font-bold" disabled={!slots.length} type="submit">{t('Save time slots')}</button>
        </div>
      </form>
    </div>
  )
}

export function AdminCakeRequestsPage() {
  return <AdminCakeRequestsBoard />
}

export function AdminReviewsPage() {
  return <AdminReviewsBoard />
}

export function AdminStockAlertsPage() {
  const request = useAdminRequest()
  const { t } = useLanguage()
  const [items, setItems] = useState([])
  const [thresholds, setThresholds] = useState({})
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const refresh = useCallback(async () => {
    try {
      const result = await request('/admin/stock-alerts')
      setItems(result.items)
      setThresholds(Object.fromEntries(result.items.map((item) => [item.itemId, item.lowStockThreshold])))
      setError('')
    } catch (loadError) {
      setError(loadError.message)
    }
  }, [request])

  useEffect(() => { refresh() }, [refresh])

  async function saveThreshold(item) {
    setError('')
    setMessage('')
    try {
      await request('/admin/menu-inventory', {
        method: 'PUT',
        body: {
          itemId: item.itemId,
          stock: item.stock,
          isAvailable: item.isAvailable,
          dietaryTags: item.dietaryTags || [],
          lowStockThreshold: Number(thresholds[item.itemId]),
        },
      })
      setMessage(t('Alert threshold saved.'))
      await refresh()
    } catch (saveError) {
      setError(saveError.message)
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">{t('Low-stock alerts')}</h1>
      <p className="mt-2 text-sm text-[#65748a]">{t('Items at or below their threshold and items marked unavailable appear here automatically.')}</p>
      <ErrorMessage>{error}</ErrorMessage>
      {message && <p className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800" role="status">{message}</p>}
      {items.length ? <div className="mt-5 space-y-3">{items.map((item) => (
        <article className="grid gap-3 rounded-xl border border-[#d9d6cc] bg-white p-4 sm:grid-cols-[1fr_auto_auto]" key={item.itemId}>
          <div><h2 className="font-bold">{item.name}</h2><p className="text-xs text-[#65748a]">{t(item.category)} · {t('Available')}: {item.availableQuantity} / {item.stock}{!item.isAvailable && ` · ${t('Unavailable')}`}</p></div>
          <label className="text-xs font-bold">{t('Alert at or below')}
            <input className="mt-1 w-24 rounded-lg border border-[#d9d6cc] px-3 py-2 text-sm" min="0" onChange={(event) => setThresholds((current) => ({ ...current, [item.itemId]: event.target.value }))} type="number" value={thresholds[item.itemId] ?? 5} />
          </label>
          <button className="self-center rounded-full border border-[#65748a] px-4 py-2 text-sm font-bold" onClick={() => saveThreshold(item)} type="button">{t('Save threshold')}</button>
        </article>
      ))}</div> : <p className="mt-5 rounded-xl bg-green-50 p-4 text-sm text-green-900">{t('Everything is above its low-stock threshold.')}</p>}
    </div>
  )
}

export function AdminActivityPage() {
  const request = useAdminRequest()
  const { t, language } = useLanguage()
  const [activity, setActivity] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    request('/admin/activity').then((result) => setActivity(result.activity)).catch((loadError) => setError(loadError.message))
  }, [request])

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">{t('Admin activity history')}</h1>
      <p className="mt-2 text-sm text-[#65748a]">{t('Recent successful admin changes, up to the latest 200 entries.')}</p>
      <ErrorMessage>{error}</ErrorMessage>
      <div className="mt-5 space-y-2">{activity.map((item) => {
        const createdAtLabel = formatAdminDate(item.createdAt, language, true)
        const dateTime = item.createdAt instanceof Date
          ? Number.isFinite(item.createdAt.getTime()) ? item.createdAt.toISOString() : undefined
          : item.createdAt
        return (
          <article className="grid gap-2 rounded-xl border border-[#d9d6cc] bg-white p-4 sm:grid-cols-[minmax(140px,0.6fr)_1fr_auto]" key={item.id}>
            <p className="text-sm font-bold">{item.adminName}</p><p className="break-all text-sm">{item.action}</p>
            {createdAtLabel && <time className="text-xs text-[#65748a]" dateTime={dateTime}>{createdAtLabel}</time>}
          </article>
        )
      })}{!activity.length && <p className="text-sm text-[#65748a]">{t('No admin changes have been recorded yet.')}</p>}</div>
    </div>
  )
}
