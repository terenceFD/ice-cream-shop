import { useCallback, useEffect, useMemo, useState } from 'react'
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
  const request = useAdminRequest()
  const { t, language } = useLanguage()
  const [requests, setRequests] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [updatingId, setUpdatingId] = useState(null)

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

  const counts = useMemo(() => requests.reduce((result, item) => {
    result.all += 1
    result[item.status] = (result[item.status] || 0) + 1
    return result
  }, { all: 0, new: 0, contacted: 0, confirmed: 0, declined: 0 }), [requests])

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase()
    return requests.filter((item) => {
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter
      const matchesSearch = !query || [
        item.id,
        item.customerName,
        item.customerEmail,
        item.customerPhone,
        item.flavor,
        item.size,
      ].some((value) => String(value || '').toLowerCase().includes(query))
      return matchesStatus && matchesSearch
    })
  }, [requests, search, statusFilter])

  async function updateStatus(id, status) {
    setError('')
    setUpdatingId(id)
    try {
      await request(`/admin/cake-requests/${id}/status`, { method: 'PATCH', body: { status } })
      await refresh()
    } catch (updateError) {
      setError(updateError.message)
    } finally {
      setUpdatingId(null)
    }
  }

  const statusOptions = ['new', 'contacted', 'confirmed', 'declined']
  const statusStyles = {
    new: 'border-amber-200 bg-amber-50 text-amber-800',
    contacted: 'border-sky-200 bg-sky-50 text-sky-800',
    confirmed: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    declined: 'border-rose-200 bg-rose-50 text-rose-800',
  }

  return (
    <div className="space-y-6">
      <section className="relative isolate overflow-hidden rounded-[24px] bg-gradient-to-br from-[#092a53] via-[#123b63] to-[#285777] px-5 py-6 text-white shadow-[0_14px_34px_rgba(9,42,83,0.16)] sm:px-7 sm:py-8">
        <div aria-hidden="true" className="absolute -right-12 -top-20 -z-10 size-64 rounded-full border-[38px] border-white/[0.06]" />
        <div aria-hidden="true" className="absolute -bottom-24 right-36 -z-10 size-44 rounded-full bg-[#ffdc32]/[0.08] blur-2xl" />
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#ffdc32]">
              <span aria-hidden="true">✦</span>{t('Made for your celebration')}
            </span>
            <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{t('Custom cake requests')}</h1>
            <p className="mt-2 max-w-lg text-sm leading-6 text-white/70">{t('Review each celebration, get in touch with the customer, and keep every request moving.')}</p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/[0.08] px-4 py-3">
            <span aria-hidden="true" className="grid size-10 place-items-center rounded-xl bg-[#ffdc32] text-xl text-[#092a53]">✧</span>
            <div>
              <p className="text-2xl font-extrabold leading-none">{counts.all}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/65">{t('Total requests')}</p>
            </div>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { status: 'new', color: 'bg-[#ffdc32]' },
            { status: 'contacted', color: 'bg-sky-300' },
            { status: 'confirmed', color: 'bg-emerald-300' },
            { status: 'declined', color: 'bg-rose-300' },
          ].map(({ status, color }) => (
            <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-[#061f3d]/25 px-3 py-2.5" key={status}>
              <span aria-hidden="true" className={`size-2 rounded-full ${color}`} />
              <span className="min-w-0 flex-1 truncate text-xs font-semibold text-white/75">{t(status)}</span>
              <span className="text-sm font-extrabold">{counts[status]}</span>
            </div>
          ))}
        </div>
      </section>

      <section aria-label={t('Filter cake requests')} className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div aria-label={t('Filter by request status')} className="flex gap-1.5 overflow-x-auto pb-1" role="group">
            {['all', ...statusOptions].map((status) => (
              <button
                aria-pressed={statusFilter === status}
                className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] ${
                  statusFilter === status
                    ? 'border-[#092a53] bg-[#092a53] text-white shadow-sm'
                    : 'border-[#e2e8f0] bg-white text-[#52647b] hover:border-[#bacbdc] hover:text-[#092a53]'
                }`}
                key={status}
                onClick={() => setStatusFilter(status)}
                type="button"
              >
                {t(status === 'all' ? 'All requests' : status)}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${statusFilter === status ? 'bg-white/15 text-white' : 'bg-[#f0f4f8] text-[#65748a]'}`}>
                  {counts[status]}
                </span>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <label className="relative min-w-0 flex-1 lg:w-64 lg:flex-none">
              <span className="sr-only">{t('Search requests')}</span>
              <svg aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8291a3]" fill="none" viewBox="0 0 20 20">
                <circle cx="8.8" cy="8.8" r="5.8" stroke="currentColor" strokeWidth="1.5" />
                <path d="m13.2 13.2 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
              </svg>
              <input
                className="min-h-10 w-full rounded-xl border border-[#e2e8f0] bg-white pl-9 pr-3 text-sm outline-none transition placeholder:text-[#9aa6b4] focus:border-[#6c8bab] focus:ring-2 focus:ring-[#dce8f4]"
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('Search by customer, flavor, or request number')}
                type="search"
                value={search}
              />
            </label>
            <button
              aria-label={t('Refresh requests')}
              className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#e2e8f0] bg-white text-[#52647b] transition hover:border-[#bacbdc] hover:text-[#092a53] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] disabled:cursor-wait disabled:opacity-50"
              disabled={loading}
              onClick={refresh}
              title={t('Refresh requests')}
              type="button"
            >
              <svg aria-hidden="true" className={`size-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 20 20">
                <path d="M16.5 8A6.7 6.7 0 0 0 4.7 5.2L3 7m0 0V3.5M3 7h3.5m-3 5A6.7 6.7 0 0 0 15.3 14.8L17 13m0 0v3.5M17 13h-3.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
              </svg>
            </button>
          </div>
        </div>
        <ErrorMessage>{error}</ErrorMessage>
      </section>

      {loading ? (
        <div aria-live="polite" className="grid gap-4 xl:grid-cols-2">
          {[0, 1, 2, 3].map((item) => (
            <div aria-hidden="true" className="h-56 animate-pulse rounded-2xl border border-[#e2e8f0] bg-[#f6f8fb]" key={item} />
          ))}
          <span className="sr-only">{t('Loading…')}</span>
        </div>
      ) : filteredRequests.length ? (
        <>
          <p aria-live="polite" className="text-xs font-semibold text-[#8190a1]">
            {t('Showing {shown} of {total} requests', { shown: filteredRequests.length, total: counts.all })}
          </p>
          <div className="grid gap-4 xl:grid-cols-2">
            {filteredRequests.map((item) => {
              const pickupDate = new Date(`${item.pickupDate}T12:00:00`)
              const formattedPickupDate = Number.isNaN(pickupDate.getTime())
                ? item.pickupDate
                : new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-GB', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  }).format(pickupDate)
              const toppings = Array.isArray(item.toppings) ? item.toppings : []
              const statusStyle = statusStyles[item.status] || 'border-slate-200 bg-slate-50 text-slate-700'

              return (
                <article className="group overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0_4px_18px_rgba(16,44,80,0.035)] transition hover:-translate-y-0.5 hover:border-[#c8d6e4] hover:shadow-[0_12px_26px_rgba(16,44,80,0.08)]" key={item.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eef1f5] px-5 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#fff6d4] text-xl text-[#987b00]">🎂</span>
                      <div className="min-w-0">
                        <h2 className="truncate font-display text-lg font-extrabold leading-tight text-[#102c50]">{item.size} {t('Cake')}</h2>
                        <p className="mt-1 text-[11px] font-semibold text-[#8390a0]">{t('Cake request #{id}', { id: item.id })}</p>
                        {item.storeName && <p className="mt-1 text-[10px] font-bold text-[#806a00]">{t('Selected store')}: {t(item.storeName)}</p>}
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-extrabold capitalize ${statusStyle}`}>
                      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                      {t(item.status)}
                    </span>
                  </div>

                  <div className="space-y-4 px-5 py-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-[#f6f8fb] p-3">
                        <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#8a97a7]">{t('Cake flavor')}</p>
                        <p className="mt-1.5 truncate text-sm font-bold text-[#173654]" title={item.flavor}>{item.flavor}</p>
                      </div>
                      <div className="rounded-xl bg-[#f6f8fb] p-3">
                        <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#8a97a7]">{t('Pickup date')}</p>
                        <p className="mt-1.5 text-sm font-bold text-[#173654]">{formattedPickupDate}</p>
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#8a97a7]">{t('Toppings')}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {toppings.length ? toppings.map((topping) => (
                          <span className="rounded-full border border-[#e7ebf0] bg-white px-2.5 py-1 text-[10px] font-semibold text-[#52647b]" key={topping}>{t(topping)}</span>
                        )) : <span className="text-xs text-[#8190a1]">{t('No toppings')}</span>}
                      </div>
                    </div>

                    {item.message && (
                      <div className="rounded-xl border-l-2 border-[#ffdc32] bg-[#fffaf0] px-3.5 py-3">
                        <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#927700]">{t('Special instructions')}</p>
                        <p className="mt-1.5 whitespace-pre-wrap break-words text-xs leading-5 text-[#62572e]">{item.message}</p>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eef1f5] pt-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-extrabold text-[#173654]">{item.customerName}</p>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-medium text-[#65748a]">
                          <a className="truncate underline decoration-[#c8d3df] underline-offset-2 hover:text-[#092a53]" href={`mailto:${encodeURIComponent(item.customerEmail || '')}`}>{item.customerEmail}</a>
                          <a className="hover:text-[#092a53]" href={`tel:${String(item.customerPhone || '').replace(/[^\d+]/g, '')}`}>{item.customerPhone}</a>
                        </div>
                      </div>
                      <label className="flex shrink-0 items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#8390a0]">
                        <span className="sr-only">{t('Request status')}</span>
                        <select
                          aria-label={t('Update status for cake request #{id}', { id: item.id })}
                          className="min-h-9 max-w-36 rounded-lg border border-[#dce4ed] bg-white px-2.5 text-xs font-bold normal-case tracking-normal text-[#173654] outline-none focus:border-[#6c8bab] focus:ring-2 focus:ring-[#dce8f4] disabled:cursor-wait disabled:opacity-60"
                          disabled={updatingId === item.id}
                          onChange={(event) => updateStatus(item.id, event.target.value)}
                          value={item.status}
                        >
                          {statusOptions.map((status) => <option key={status} value={status}>{t(status)}</option>)}
                        </select>
                      </label>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#d9e1ea] bg-[#f8fafc] px-5 py-12 text-center">
          <span aria-hidden="true" className="mx-auto grid size-14 place-items-center rounded-2xl bg-white text-2xl shadow-sm">🎂</span>
          <h2 className="mt-4 font-display text-lg font-extrabold text-[#173654]">
            {requests.length ? t('No requests match your search') : t('No custom cake requests yet.')}
          </h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-[#8190a1]">
            {requests.length ? t('Try a different search or status filter.') : t('New cake requests from the storefront will appear here.')}
          </p>
          {(search || statusFilter !== 'all') && (
            <button className="mt-4 text-xs font-extrabold text-[#092a53] underline decoration-[#ffdc32] decoration-2 underline-offset-4" onClick={() => { setSearch(''); setStatusFilter('all') }} type="button">
              {t('Clear filters')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function AdminReviewsPage() {
  const request = useAdminRequest()
  const { t, language } = useLanguage()
  const [reviews, setReviews] = useState([])
  const [showApproved, setShowApproved] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)
  const [search, setSearch] = useState('')
  const [ratingFilter, setRatingFilter] = useState('all')

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const result = await request(`/admin/reviews?status=${showApproved ? 'approved' : 'pending'}`)
      setReviews(result.reviews)
      setError('')
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }, [request, showApproved])

  useEffect(() => { refresh() }, [refresh])

  async function setApproval(review, isApproved) {
    setError('')
    setMessage('')
    setUpdatingId(review.id)
    try {
      await request(`/admin/reviews/${review.id}/approval`, { method: 'PATCH', body: { isApproved } })
      await refresh()
      setMessage(t(isApproved ? 'Review approved successfully.' : 'Review unpublished successfully.'))
    } catch (updateError) {
      setError(updateError.message)
    } finally {
      setUpdatingId(null)
    }
  }

  const normalizedSearch = search.trim().toLowerCase()
  const visibleReviews = reviews.filter((review) => {
    const matchesSearch = !normalizedSearch || [
      review.itemName,
      review.customerName,
      review.customerEmail,
      review.orderId,
      review.review,
    ].some((value) => String(value || '').toLowerCase().includes(normalizedSearch))
    const matchesRating = ratingFilter === 'all' || review.rating === Number(ratingFilter)
    return matchesSearch && matchesRating
  })
  const averageRating = reviews.length
    ? (reviews.reduce((total, review) => total + Number(review.rating || 0), 0) / reviews.length).toFixed(1)
    : '—'
  const fiveStarCount = reviews.filter((review) => review.rating === 5).length

  return (
    <div className="min-w-0 space-y-6">
      <section className="relative isolate overflow-hidden rounded-[26px] bg-gradient-to-br from-[#092a53] via-[#123b63] to-[#285777] px-5 py-7 text-white shadow-[0_16px_38px_rgba(9,42,83,0.16)] sm:px-8 sm:py-8">
        <div aria-hidden="true" className="absolute -right-12 -top-20 -z-10 size-64 rounded-full border-[36px] border-white/[0.05]" />
        <div aria-hidden="true" className="absolute -bottom-28 right-36 -z-10 size-52 rounded-full bg-[#ffdc32]/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#ffdf52]">
              <svg aria-hidden="true" className="size-3.5" fill="none" viewBox="0 0 20 20">
                <path d="m10 2 2.3 4.7 5.2.8-3.8 3.7.9 5.2L10 14l-4.6 2.4.9-5.2L2.5 7.5l5.2-.8L10 2Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.4" />
              </svg>
              {t('Review management')}
            </p>
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t('Customer reviews')}</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-blue-100/80">{t('Review customer feedback, approve what is ready to publish, and manage live reviews.')}</p>
          </div>
          <button
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/[0.08] px-4 text-sm font-bold text-white transition hover:bg-white/[0.15] disabled:cursor-wait disabled:opacity-60"
            disabled={loading}
            onClick={refresh}
            type="button"
          >
            <svg aria-hidden="true" className={`size-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 20 20">
              <path d="M16.5 8A6.5 6.5 0 0 0 5.4 4.1L3.5 6M3.5 6V2.5M3.5 6H7m-3.5 6A6.5 6.5 0 0 0 14.6 16l1.9-1.9m0 0v3.4m0-3.4H13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
            </svg>
            {t('Refresh')}
          </button>
        </div>
        <div className="relative mt-7 grid grid-cols-2 gap-3 sm:max-w-xl sm:grid-cols-3">
          {[
            { label: t('Reviews in this view'), value: reviews.length, icon: 'M4 5h16v12H8l-4 3V5Z' },
            { label: t('Average rating'), value: averageRating, icon: 'm12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z' },
            { label: t('5-star reviews'), value: fiveStarCount, icon: 'm12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z' },
          ].map((metric, index) => (
            <article className={`${index === 2 ? 'col-span-2 sm:col-span-1' : ''} rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3.5`} key={metric.label}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-100/65">{metric.label}</p>
                <svg aria-hidden="true" className="size-4 text-[#ffdc32]" fill="none" viewBox="0 0 24 24">
                  <path d={metric.icon} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
                </svg>
              </div>
              <p className="mt-1.5 font-display text-2xl font-bold">{metric.value}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-[22px] border border-[#e2e8f0] bg-white shadow-[0_8px_24px_rgba(16,44,80,0.04)]">
        <div className="border-b border-[#edf1f5] px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-display text-xl font-bold text-[#102c50]">{t(showApproved ? 'Approved reviews' : 'Pending reviews')}</h2>
              <p className="mt-1 text-xs text-[#718196]">{t('Review customer feedback, approve what is ready to publish, and manage live reviews.')}</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative block min-w-0 sm:w-64">
                <span className="sr-only">{t('Search reviews')}</span>
                <svg aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#8291a3]" fill="none" viewBox="0 0 20 20">
                  <circle cx="8.8" cy="8.8" r="5.8" stroke="currentColor" strokeWidth="1.5" />
                  <path d="m13.2 13.2 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
                </svg>
                <input
                  className="min-h-10 w-full rounded-xl border border-[#dce5ef] bg-[#f8fafc] pl-10 pr-3 text-sm text-[#102c50] outline-none transition placeholder:text-[#91a0b1] focus:border-[#8ca8c3] focus:bg-white focus:ring-2 focus:ring-[#dbe8f4]"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t('Search by product, customer, or order')}
                  type="search"
                  value={search}
                />
              </label>
              <label className="sr-only" htmlFor="review-rating-filter">{t('Filter by rating')}</label>
              <select
                className="min-h-10 rounded-xl border border-[#dce5ef] bg-[#f8fafc] px-3 text-sm font-semibold text-[#405a75] outline-none transition focus:border-[#8ca8c3] focus:bg-white focus:ring-2 focus:ring-[#dbe8f4]"
                id="review-rating-filter"
                onChange={(event) => setRatingFilter(event.target.value)}
                value={ratingFilter}
              >
                <option value="all">{t('All ratings')}</option>
                {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{t('{rating} stars', { rating })}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div aria-label={t('Review publication status')} className="inline-flex rounded-xl bg-[#f1f5f9] p-1" role="group">
              {[false, true].map((approved) => (
                <button
                  aria-pressed={showApproved === approved}
                  className={`inline-flex min-h-9 items-center gap-2 rounded-lg px-3.5 text-xs font-bold transition ${showApproved === approved ? 'bg-[#092a53] text-white shadow-sm' : 'text-[#63758b] hover:text-[#173654]'}`}
                  key={String(approved)}
                  onClick={() => {
                    setShowApproved(approved)
                    setSearch('')
                    setRatingFilter('all')
                    setMessage('')
                  }}
                  type="button"
                >
                  {t(approved ? 'Approved reviews' : 'Pending reviews')}
                  {!approved && reviews.length > 0 && !showApproved && <span className="rounded-md bg-white/15 px-1.5 py-0.5 text-[10px]">{reviews.length}</span>}
                </button>
              ))}
            </div>
            {!loading && <p aria-live="polite" className="text-xs font-semibold text-[#8190a1]">{t('Showing {shown} of {total} reviews', { shown: visibleReviews.length, total: reviews.length })}</p>}
          </div>
        </div>

        <ErrorMessage>{error}</ErrorMessage>
        {message && <p className="mx-4 mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800 sm:mx-6" role="status">{message}</p>}

        <div aria-live="polite" className="divide-y divide-[#edf1f5]">
          {loading ? (
            <div className="space-y-3 p-4 sm:p-6" role="status">
              <span className="sr-only">{t('Loading reviews…')}</span>
              {[0, 1, 2].map((row) => <div aria-hidden="true" className="h-36 animate-pulse rounded-xl bg-[#f3f6fa]" key={row} />)}
            </div>
          ) : visibleReviews.length ? visibleReviews.map((review) => {
            const createdAtLabel = formatAdminDate(review.createdAt, language)
            return (
            <article className="p-4 transition-colors hover:bg-[#fbfcfe] sm:p-6" key={review.id}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3.5">
                  <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#edf3f9] font-display text-base font-bold text-[#315982]">
                    {review.customerName?.trim().charAt(0).toUpperCase() || '?'}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h3 className="font-bold text-[#173654]">{review.customerName}</h3>
                      <span className="text-xs text-[#8190a1]">{review.customerEmail}</span>
                    </div>
                    <div aria-label={t('{rating} out of 5 stars', { rating: review.rating })} className="mt-1.5 flex items-center gap-1 text-[#bd9c00]" role="img">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <svg aria-hidden="true" className={`size-3.5 ${star <= review.rating ? 'fill-current' : 'fill-[#e2e8f0] text-[#e2e8f0]'}`} key={star} viewBox="0 0 20 20">
                          <path d="m10 1.8 2.5 5.1 5.7.8-4.1 4 .97 5.65L10 14.68l-5.1 2.67.97-5.65-4.1-4 5.7-.83L10 1.8Z" />
                        </svg>
                      ))}
                      <span className="ml-1 text-xs font-bold text-[#405a75]">{review.rating}/5</span>
                    </div>
                    <p className="mt-3 font-display text-base font-bold text-[#102c50]">{review.itemName}</p>
                    <p className="mt-1 text-sm leading-6 text-[#52647b]">{review.review || t('No written comment.')}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#8190a1]">
                      <span>{t('Order #{id}', { id: review.orderId })}</span>
                      {createdAtLabel && <span>{createdAtLabel}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 pl-[58px] sm:pl-0">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold ${showApproved ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`}>
                    <span aria-hidden="true" className={`size-1.5 rounded-full ${showApproved ? 'bg-green-500' : 'bg-amber-500'}`} />
                    {t(showApproved ? 'Published' : 'Awaiting approval')}
                  </span>
                  <button
                    className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-bold transition disabled:cursor-wait disabled:opacity-50 ${showApproved ? 'border border-[#dce5ef] text-[#50657d] hover:bg-[#f6f9fc]' : 'bg-[#092a53] text-white hover:bg-[#163e6b]'}`}
                    disabled={updatingId === review.id}
                    onClick={() => setApproval(review, !showApproved)}
                    type="button"
                  >
                    {updatingId === review.id ? t('Saving…') : t(showApproved ? 'Unpublish review' : 'Approve review')}
                  </button>
                </div>
              </div>
            </article>
          )}) : (
            <div className="px-5 py-12 text-center">
              <span aria-hidden="true" className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#f3f6fa] text-[#52708e]">
                <svg className="size-5" fill="none" viewBox="0 0 20 20">
                  <path d="M3 4.5h14v10H8l-5 3v-13ZM7 8h6m-6 3h4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" />
                </svg>
              </span>
              <h3 className="mt-4 font-display text-lg font-bold text-[#173654]">
                {reviews.length
                  ? t('No reviews match your filters.')
                  : t(showApproved ? 'No approved reviews yet.' : 'No reviews are awaiting approval.')}
              </h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-[#7c8a9b]">
                {reviews.length
                  ? t('Try a different search or rating filter.')
                  : t('New customer reviews will appear here.')}
              </p>
              {(search || ratingFilter !== 'all') && (
                <button className="mt-3 rounded-lg px-3 py-2 text-xs font-bold text-[#315982] transition hover:bg-[#f3f6fa]" onClick={() => { setSearch(''); setRatingFilter('all') }} type="button">
                  {t('Clear filters')}
                </button>
              )}
            </div>
          )}
        </div>
      </section>
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
