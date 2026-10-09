import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from '../../../api/api'
import { useLanguage } from '../../../language/LanguageContext'
import { useAdminAuth } from './AdminAuthContext'

function useAdminRequest() {
  const { sessionToken } = useAdminAuth()
  const request = useCallback((path, options = {}) => apiRequest(path, { ...options, token: sessionToken }), [sessionToken])
  return request
}

function ErrorMessage({ children }) {
  return children ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{children}</p> : null
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
        <h2 className="font-display text-2xl font-bold">{t('Service areas')}</h2>
        {zones.map((zone) => (
          <article className="grid gap-3 rounded-xl border border-[#d9d6cc] bg-white p-4 sm:grid-cols-[minmax(140px,1fr)_auto_auto_150px_auto]" key={zone.id}>
            <p className="self-center text-sm font-bold">{t(zone.location)}</p>
            <label className="flex items-center gap-2 text-xs font-semibold"><input checked={zone.pickupEnabled} onChange={(event) => setZones((current) => current.map((entry) => entry.id === zone.id ? { ...entry, pickupEnabled: event.target.checked } : entry))} type="checkbox" />{t('Pickup')}</label>
            <label className="flex items-center gap-2 text-xs font-semibold"><input checked={zone.deliveryEnabled} onChange={(event) => setZones((current) => current.map((entry) => entry.id === zone.id ? { ...entry, deliveryEnabled: event.target.checked } : entry))} type="checkbox" />{t('Delivery')}</label>
            <label className="text-xs font-bold">{t('Delivery fee (FCFA)')}<input className="mt-1 w-full rounded-lg border border-[#d9d6cc] px-3 py-2 text-sm" min="0" onChange={(event) => setZones((current) => current.map((entry) => entry.id === zone.id ? { ...entry, deliveryFee: event.target.value } : entry))} type="number" value={zone.deliveryFee} /></label>
            <label className="flex items-center gap-2 self-center text-xs font-semibold"><input checked={zone.isActive} onChange={(event) => setZones((current) => current.map((entry) => entry.id === zone.id ? { ...entry, isActive: event.target.checked } : entry))} type="checkbox" />{t('Active')}</label>
          </article>
        ))}
        <button className="rounded-full bg-[#ffdc32] px-5 py-2.5 text-sm font-bold" type="submit">{t('Save service areas')}</button>
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
  const request = useAdminRequest()
  const { t } = useLanguage()
  const [requests, setRequests] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const result = await request('/admin/cake-requests')
      setRequests(result.requests)
      setError('')
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }, [request])

  useEffect(() => { refresh() }, [refresh])

  async function updateStatus(id, status) {
    setError('')
    try {
      await request(`/admin/cake-requests/${id}/status`, { method: 'PATCH', body: { status } })
      await refresh()
    } catch (updateError) {
      setError(updateError.message)
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">{t('Custom cake requests')}</h1>
      <ErrorMessage>{error}</ErrorMessage>
      {loading ? <p className="mt-5 text-sm">{t('Loading…')}</p> : requests.length ? <div className="mt-5 space-y-4">{requests.map((item) => (
        <article className="rounded-2xl border border-[#d9d6cc] bg-white p-5" key={item.id}>
          <div className="flex flex-wrap justify-between gap-3"><h2 className="font-display text-xl font-bold">{t('Cake request #{id}', { id: item.id })} · {item.size}</h2><span className="rounded-full bg-[#fff0a8] px-3 py-1 text-xs font-bold">{t(item.status)}</span></div>
          <p className="mt-2 text-sm">{item.flavor} · {item.toppings.join(', ') || t('No toppings')} · {t('Pickup date')}: {item.pickupDate}</p>
          <p className="mt-2 text-sm text-[#65748a]">{item.customerName} · <a className="underline" href={`mailto:${item.customerEmail}`}>{item.customerEmail}</a> · {item.customerPhone}</p>
          {item.message && <p className="mt-3 rounded-lg bg-[#f8f7f2] p-3 text-sm">{item.message}</p>}
          <label className="mt-4 inline-flex items-center gap-2 text-xs font-bold">{t('Request status')}
            <select className="rounded-lg border border-[#d9d6cc] bg-white px-3 py-2 text-sm" onChange={(event) => updateStatus(item.id, event.target.value)} value={item.status}>
              {['new', 'contacted', 'confirmed', 'declined'].map((status) => <option key={status} value={status}>{t(status)}</option>)}
            </select>
          </label>
        </article>
      ))}</div> : <p className="mt-5 text-sm text-[#65748a]">{t('No custom cake requests yet.')}</p>}
    </div>
  )
}

export function AdminReviewsPage() {
  const request = useAdminRequest()
  const { t } = useLanguage()
  const [reviews, setReviews] = useState([])
  const [showApproved, setShowApproved] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      const result = await request(`/admin/reviews?status=${showApproved ? 'approved' : 'pending'}`)
      setReviews(result.reviews)
      setError('')
    } catch (loadError) {
      setError(loadError.message)
    }
  }, [request, showApproved])

  useEffect(() => { refresh() }, [refresh])

  async function setApproval(review, isApproved) {
    try {
      await request(`/admin/reviews/${review.id}/approval`, { method: 'PATCH', body: { isApproved } })
      await refresh()
    } catch (updateError) {
      setError(updateError.message)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">{t('Customer reviews')}</h1>
        <button className="rounded-full border border-[#65748a] px-4 py-2 text-sm font-bold" onClick={() => setShowApproved((current) => !current)} type="button">{showApproved ? t('Pending reviews') : t('Approved reviews')}</button>
      </div>
      <ErrorMessage>{error}</ErrorMessage>
      {reviews.length ? <div className="mt-5 space-y-3">{reviews.map((review) => (
        <article className="rounded-2xl border border-[#d9d6cc] bg-white p-5" key={review.id}>
          <div className="flex flex-wrap justify-between gap-2"><h2 className="font-bold">{review.itemName} · ★ {review.rating}/5</h2><span className="text-xs text-[#65748a]">{t('Order #{id}', { id: review.orderId })}</span></div>
          <p className="mt-2 text-sm">{review.review || t('No written comment.')}</p>
          <p className="mt-2 text-xs text-[#65748a]">{review.customerName} · {review.customerEmail}</p>
          <button className="mt-3 text-sm font-bold underline" onClick={() => setApproval(review, !showApproved)} type="button">{showApproved ? t('Unpublish review') : t('Approve review')}</button>
        </article>
      ))}</div> : <p className="mt-5 text-sm text-[#65748a]">{showApproved ? t('No approved reviews yet.') : t('No reviews are awaiting approval.')}</p>}
    </div>
  )
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
      <div className="mt-5 space-y-2">{activity.map((item) => (
        <article className="grid gap-2 rounded-xl border border-[#d9d6cc] bg-white p-4 sm:grid-cols-[minmax(140px,0.6fr)_1fr_auto]" key={item.id}>
          <p className="text-sm font-bold">{item.adminName}</p><p className="break-all text-sm">{item.action}</p>
          <time className="text-xs text-[#65748a]" dateTime={item.createdAt}>{new Date(`${item.createdAt.replace(' ', 'T')}Z`).toLocaleString(language === 'fr' ? 'fr-CM' : 'en-CM')}</time>
        </article>
      ))}{!activity.length && <p className="text-sm text-[#65748a]">{t('No admin changes have been recorded yet.')}</p>}</div>
    </div>
  )
}
