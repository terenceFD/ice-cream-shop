import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../../api/api'
import { useLanguage } from '../../language/useLanguage'
import { useAdminAuth } from './useAdminAuth'
import { AdminReviewsBoard } from './AdminReviewsBoard'
import { AdminCakeRequestsBoard } from './AdminCakeRequestsBoard'
import { AdminIcon, AdminNotice, AdminPageHeader, AdminStatCard, AdminToggle } from './AdminPageHeader'
import { adminIcons } from './adminIcons'
import { ACTIVITY_AREAS, describeAdminActivity } from './describeAdminActivity'

function useAdminRequest() {
  const { sessionToken } = useAdminAuth()
  const request = useCallback((path, options = {}) => apiRequest(path, { ...options, token: sessionToken }), [sessionToken])
  return request
}

function parseAdminDate(value) {
  if (!value) return null
  const date = value instanceof Date
    ? value
    : new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(String(value))
      ? String(value)
      : `${String(value).replace(' ', 'T')}Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatAdminDate(value, language) {
  const date = parseAdminDate(value)
  return date ? new Intl.DateTimeFormat(language === 'fr' ? 'fr-CM' : 'en-CM', { dateStyle: 'medium' }).format(date) : null
}

function formatAdminTime(value, language) {
  const date = parseAdminDate(value)
  return date ? new Intl.DateTimeFormat(language === 'fr' ? 'fr-CM' : 'en-CM', { timeStyle: 'short' }).format(date) : null
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

  const updateZone = (id, changes) => setZones((current) => current.map((entry) => entry.id === id ? { ...entry, ...changes } : entry))
  const updateSlot = (index, changes) => setSlots((current) => current.map((entry, slotIndex) => slotIndex === index ? { ...entry, ...changes } : entry))
  const activeZones = zones.filter((zone) => zone.isActive)

  return (
    <div className="min-w-0 space-y-6">
      <AdminPageHeader
        description={t('Enable service areas, set delivery prices, and control the appointment slots offered at checkout.')}
        icon={adminIcons.truck}
        section={t('Workspace')}
        t={t}
        title={t('Pickup and delivery settings')}
      />
      <AdminNotice tone="error">{error}</AdminNotice>
      <AdminNotice>{message}</AdminNotice>

      <section aria-label={t('Overview')} className="admin-stats grid grid-cols-2 gap-3 lg:grid-cols-4">
        <AdminStatCard accent="bg-[#e9f1fa] text-[#315982]" icon={adminIcons.store} label={t('Active branches')} value={activeZones.length} />
        <AdminStatCard accent="bg-[#fff4c2] text-[#8a6f00]" icon={adminIcons.box} label={t('Offer pickup')} value={activeZones.filter((zone) => zone.pickupEnabled).length} />
        <AdminStatCard accent="bg-[#e5f4ea] text-[#2c7a4f]" icon={adminIcons.truck} label={t('Offer delivery')} value={activeZones.filter((zone) => zone.deliveryEnabled).length} />
        <AdminStatCard accent="bg-[#f3ecfb] text-[#6b4aa0]" icon={adminIcons.clock} label={t('Active time slots')} value={slots.filter((slot) => slot.isActive).length} />
      </section>

      <form className="rounded-[20px] border border-[#e5ebf3] bg-white" onSubmit={saveZones}>
        <div className="border-b border-[#edf1f5] p-4 sm:p-5">
          <h2 className="font-display text-xl font-extrabold text-[#092a53]">{t('Store branches and service areas')}</h2>
          <p className="mt-0.5 text-xs text-[#65748a]">{t('Switch a branch off to hide it from checkout. The delivery fee is only used when delivery is on.')}</p>
        </div>
        <ul className="divide-y divide-[#f0f3f7]">
          {zones.map((zone) => (
            <li className={`grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center ${zone.isActive ? '' : 'bg-[#fafbfd]'}`} key={zone.id}>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-extrabold text-[#092a53]">
                  {t(zone.storeName)}
                  {!zone.isActive && <span className="rounded-full bg-[#eef1f5] px-2 py-0.5 text-[10px] font-bold text-[#65748a]">{t('Hidden at checkout')}</span>}
                </p>
                <p className="mt-1 text-xs text-[#65748a]">{t(zone.location)}{zone.storeAddress ? ` · ${t(zone.storeAddress)}` : ''}</p>
                {zone.storePhone && <p className="mt-1 text-xs font-semibold text-[#52647b]">{zone.storePhone}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                <AdminToggle checked={zone.isActive} label={t('Active')} onChange={(isActive) => updateZone(zone.id, { isActive })} />
                <AdminToggle checked={zone.pickupEnabled} disabled={!zone.isActive} label={t('Pickup')} onChange={(pickupEnabled) => updateZone(zone.id, { pickupEnabled })} />
                <AdminToggle checked={zone.deliveryEnabled} disabled={!zone.isActive} label={t('Delivery')} onChange={(deliveryEnabled) => updateZone(zone.id, { deliveryEnabled })} />
                {zone.deliveryEnabled && (
                  <label className="flex items-center gap-2 text-xs font-bold text-[#4f6379]">
                    {t('Delivery fee')}
                    <span className="flex items-center rounded-xl border border-[#dde4ec] bg-[#f8fafc] pr-3 focus-within:border-[#bd9c00] focus-within:bg-white">
                      <input className="w-24 bg-transparent px-3 py-2 text-sm font-bold tabular-nums text-[#102c50] outline-none!" min="0" onChange={(event) => updateZone(zone.id, { deliveryFee: event.target.value })} type="number" value={zone.deliveryFee} />
                      <span className="text-[10px] font-extrabold text-[#8190a1]">FCFA</span>
                    </span>
                  </label>
                )}
              </div>
            </li>
          ))}
        </ul>
        <div className="flex justify-end border-t border-[#edf1f5] p-4 sm:p-5">
          <button className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#092a53] px-5 text-sm font-bold text-white transition hover:bg-[#163e6b]" type="submit">{t('Save branch availability')}</button>
        </div>
      </form>

      <form className="rounded-[20px] border border-[#e5ebf3] bg-white" onSubmit={saveSlots}>
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#edf1f5] p-4 sm:p-5">
          <div>
            <h2 className="font-display text-xl font-extrabold text-[#092a53]">{t('Available time slots')}</h2>
            <p className="mt-0.5 text-xs text-[#65748a]">{t('Customers choose one of the active slots at checkout.')}</p>
          </div>
          <button className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#dde4ec] px-4 text-sm font-bold text-[#092a53] transition hover:border-[#092a53] disabled:opacity-50" disabled={slots.length >= 20} onClick={() => setSlots((current) => [...current, { label: '', startTime: '10:00', endTime: '12:00', isActive: true }])} type="button">
            <AdminIcon path={adminIcons.plus} /> {t('Add time slot')}
          </button>
        </div>
        <ul className="divide-y divide-[#f0f3f7]">
          {slots.map((slot, index) => (
            <li className="grid items-end gap-3 p-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] sm:p-5" key={slot.id ?? `new-${index}`}>
              <label className="text-xs font-bold text-[#4f6379]">{t('Slot label')}<input className={slotInputClassName} maxLength={60} onChange={(event) => updateSlot(index, { label: event.target.value })} required value={slot.label} /></label>
              <label className="text-xs font-bold text-[#4f6379]">{t('Starts')}<input className={slotInputClassName} onChange={(event) => updateSlot(index, { startTime: event.target.value })} required type="time" value={slot.startTime} /></label>
              <label className="text-xs font-bold text-[#4f6379]">{t('Ends')}<input className={slotInputClassName} onChange={(event) => updateSlot(index, { endTime: event.target.value })} required type="time" value={slot.endTime} /></label>
              <div className="pb-2"><AdminToggle checked={slot.isActive} label={t('Active')} onChange={(isActive) => updateSlot(index, { isActive })} /></div>
              <button aria-label={t('Remove time slot')} className="mb-1 grid size-9 place-items-center rounded-lg text-[#a3352f] transition hover:bg-red-50" onClick={() => setSlots((current) => current.filter((_, slotIndex) => slotIndex !== index))} title={t('Remove')} type="button">
                <AdminIcon path={adminIcons.trash} />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex justify-end border-t border-[#edf1f5] p-4 sm:p-5">
          <button className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#092a53] px-5 text-sm font-bold text-white transition hover:bg-[#163e6b] disabled:opacity-50" disabled={!slots.length} type="submit">{t('Save time slots')}</button>
        </div>
      </form>
    </div>
  )
}

const slotInputClassName = 'mt-1.5 w-full rounded-xl border border-[#dde4ec] bg-[#f8fafc] px-3.5 py-2.5 text-sm font-medium text-[#102c50] transition focus:border-[#bd9c00] focus:bg-white outline-none!'

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

  const unavailableCount = items.filter((item) => !item.isAvailable).length
  const soldOutCount = items.filter((item) => item.isAvailable && item.availableQuantity < 1).length

  return (
    <div className="min-w-0 space-y-6">
      <AdminPageHeader
        description={t('Items at or below their threshold and items marked unavailable appear here automatically.')}
        icon={adminIcons.alert}
        section={t('Catalog')}
        t={t}
        title={t('Low-stock alerts')}
      />
      <AdminNotice tone="error">{error}</AdminNotice>
      <AdminNotice>{message}</AdminNotice>

      <section aria-label={t('Overview')} className="admin-stats grid grid-cols-3 gap-3">
        <AdminStatCard accent="bg-[#fff4e0] text-[#a35f00]" icon={adminIcons.alert} label={t('Need attention')} value={items.length} />
        <AdminStatCard accent="bg-red-50 text-red-700" icon={adminIcons.box} label={t('Sold out')} value={soldOutCount} />
        <AdminStatCard accent="bg-[#eef1f5] text-[#52647b]" icon={adminIcons.store} label={t('Unavailable')} value={unavailableCount} />
      </section>

      <section className="rounded-[20px] border border-[#e5ebf3] bg-white">
        {items.length ? (
          <ul className="divide-y divide-[#f0f3f7]">
            {items.map((item) => {
              const soldOut = item.availableQuantity < 1
              return (
                <li className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5" key={item.itemId}>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-bold text-[#102c50]">
                      {item.name}
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${!item.isAvailable ? 'bg-[#eef1f5] text-[#52647b] ring-[#dde4ec]' : soldOut ? 'bg-red-50 text-red-700 ring-red-100' : 'bg-[#fff4e0] text-[#8a5200] ring-[#f3dcb0]'}`}>
                        {!item.isAvailable ? t('Unavailable') : soldOut ? t('Sold out') : t('Low stock')}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-[#65748a]">{t(item.category)} · {t('{count} left', { count: Math.max(0, item.availableQuantity) })}</p>
                  </div>
                  <div className="flex items-end gap-2">
                    <label className="text-xs font-bold text-[#4f6379]">{t('Alert at or below')}
                      <input className="mt-1.5 block w-24 rounded-xl border border-[#dde4ec] bg-[#f8fafc] px-3 py-2 text-sm font-bold tabular-nums text-[#102c50] outline-none! focus:border-[#bd9c00] focus:bg-white" min="0" onChange={(event) => setThresholds((current) => ({ ...current, [item.itemId]: event.target.value }))} type="number" value={thresholds[item.itemId] ?? 5} />
                    </label>
                    <button className="inline-flex min-h-10 items-center rounded-xl border border-[#dde4ec] px-4 text-sm font-bold text-[#092a53] transition hover:border-[#092a53]" onClick={() => saveThreshold(item)} type="button">{t('Save threshold')}</button>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-[#e5f4ea] text-[#2c7a4f]"><AdminIcon className="size-6" path={adminIcons.check} /></span>
            <p className="font-display text-lg font-extrabold text-[#092a53]">{t('Everything is above its low-stock threshold.')}</p>
          </div>
        )}
      </section>
    </div>
  )
}

export function AdminActivityPage() {
  const request = useAdminRequest()
  const { t, language } = useLanguage()
  const [activity, setActivity] = useState([])
  const [error, setError] = useState('')

  const [person, setPerson] = useState('')
  const [area, setArea] = useState('')

  useEffect(() => {
    request('/admin/activity').then((result) => setActivity(result.activity)).catch((loadError) => setError(loadError.message))
  }, [request])

  const entries = useMemo(() => activity.map((item) => {
    const described = describeAdminActivity(item.method, item.path)
    return { ...item, ...described, day: formatAdminDate(item.createdAt, language) || '' }
  }), [activity, language])
  const people = useMemo(() => [...new Set(entries.map((entry) => entry.adminName))].sort(), [entries])
  const shown = entries.filter((entry) => (!person || entry.adminName === person) && (!area || entry.area === area))

  return (
    <div className="min-w-0 space-y-6">
      <AdminPageHeader
        description={t('Recent successful admin changes, up to the latest 200 entries.')}
        icon={adminIcons.history}
        section={t('Workspace')}
        t={t}
        title={t('Admin activity history')}
      />
      <AdminNotice tone="error">{error}</AdminNotice>

      <section className="rounded-[20px] border border-[#e5ebf3] bg-white">
        <div className="flex flex-col gap-3 border-b border-[#edf1f5] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <p className="text-xs font-semibold text-[#65748a]">{t('Showing {shown} of {total} changes', { shown: shown.length, total: entries.length })}</p>
          <div className="flex flex-wrap gap-2">
            <label className="sr-only" htmlFor="activity-person">{t('Person')}</label>
            <select className="min-h-10 rounded-xl border border-[#dde4ec] bg-white px-3 text-sm font-semibold text-[#102c50]" id="activity-person" onChange={(event) => setPerson(event.target.value)} value={person}>
              <option value="">{t('Everyone')}</option>
              {people.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <label className="sr-only" htmlFor="activity-area">{t('Area')}</label>
            <select className="min-h-10 rounded-xl border border-[#dde4ec] bg-white px-3 text-sm font-semibold text-[#102c50]" id="activity-area" onChange={(event) => setArea(event.target.value)} value={area}>
              <option value="">{t('All areas')}</option>
              {ACTIVITY_AREAS.map((value) => <option key={value} value={value}>{t(AREA_LABELS[value])}</option>)}
            </select>
          </div>
        </div>
        {shown.length ? (
          <ol className="divide-y divide-[#f0f3f7]">
            {shown.map((entry, index) => {
              const createdAtLabel = formatAdminTime(entry.createdAt, language)
              const dateTime = entry.createdAt instanceof Date
                ? Number.isFinite(entry.createdAt.getTime()) ? entry.createdAt.toISOString() : undefined
                : entry.createdAt
              const newDay = index === 0 || shown[index - 1].day !== entry.day
              return (
                <li key={entry.id}>
                  {newDay && entry.day && <p className="bg-[#f7f9fc] px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#8190a1] sm:px-5">{entry.day}</p>}
                  <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <span aria-hidden="true" className={`grid size-9 shrink-0 place-items-center rounded-xl ${AREA_STYLES[entry.area]}`}>
                      <AdminIcon path={AREA_ICONS[entry.area]} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[#102c50]">{t(entry.label, { id: entry.id ?? '' })}</p>
                      <p className="mt-0.5 truncate text-xs text-[#65748a]">
                        {entry.adminName}
                        {!entry.known && <span className="ml-1 font-mono text-[11px] text-[#a3b0bf]">· {entry.method} {entry.path}</span>}
                      </p>
                    </div>
                    {createdAtLabel && <time className="shrink-0 text-xs tabular-nums text-[#65748a]" dateTime={dateTime}>{createdAtLabel}</time>}
                  </div>
                </li>
              )
            })}
          </ol>
        ) : (
          <p className="px-6 py-14 text-center text-sm text-[#65748a]">{t('No admin changes have been recorded yet.')}</p>
        )}
      </section>
    </div>
  )
}

const AREA_LABELS = { catalog: 'Catalog', orders: 'Orders', customers: 'Customers', promotions: 'Promotions', settings: 'Settings', account: 'Accounts and sign-in' }
const AREA_ICONS = { catalog: adminIcons.box, orders: adminIcons.truck, customers: adminIcons.user, promotions: adminIcons.check, settings: adminIcons.store, account: adminIcons.user }
const AREA_STYLES = {
  catalog: 'bg-[#fff4c2] text-[#8a6f00]',
  orders: 'bg-[#e9f1fa] text-[#315982]',
  customers: 'bg-[#f3ecfb] text-[#6b4aa0]',
  promotions: 'bg-[#e5f4ea] text-[#2c7a4f]',
  settings: 'bg-[#eef1f5] text-[#52647b]',
  account: 'bg-[#fdeaea] text-[#a3352f]',
}
