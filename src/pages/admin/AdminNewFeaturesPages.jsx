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
  const [isSavingBranches, setIsSavingBranches] = useState(false)

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
    if (isSavingBranches) return
    setError('')
    setMessage('')
    setIsSavingBranches(true)
    try {
      await request('/admin/fulfillment-zones', {
        method: 'PUT',
        body: { zones: zones.map((zone) => ({ ...zone, deliveryFee: Number(zone.deliveryFee) })) },
      })
      setMessage(t('Fulfillment zones saved.'))
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setIsSavingBranches(false)
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
        <AdminStatCard accent="bg-[#fff4c2] text-[#bd9c00]" icon={adminIcons.box} label={t('Offer pickup')} value={activeZones.filter((zone) => zone.pickupEnabled).length} />
        <AdminStatCard accent="bg-[#e5f4ea] text-[#2c7a4f]" icon={adminIcons.truck} label={t('Offer delivery')} value={activeZones.filter((zone) => zone.deliveryEnabled).length} />
        <AdminStatCard accent="bg-[#f3ecfb] text-[#6b4aa0]" icon={adminIcons.clock} label={t('Active time slots')} value={slots.filter((slot) => slot.isActive).length} />
      </section>

      <form className="rounded-[20px] border border-[#dce3eb] bg-white" onSubmit={saveZones}>
        <div className="border-b border-[#f4f6f8] p-4 sm:p-5">
          <h2 className="font-display text-xl font-extrabold text-[#092a53]">{t('Store branches and service areas')}</h2>
          <p className="mt-0.5 text-xs text-[#65748a]">{t('Switch a branch off to hide it from checkout. The delivery fee is only used when delivery is on.')}</p>
        </div>
        <ul className="divide-y divide-[#f4f6f8]">
          {zones.map((zone) => (
            <li className={`grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center ${zone.isActive ? '' : 'bg-[#f4f6f8]'}`} key={zone.id}>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-extrabold text-[#092a53]">
                  {t(zone.storeName)}
                  {!zone.isActive && <span className="rounded-full bg-[#eef1f5] px-2 py-0.5 text-xs font-bold text-[#65748a]">{t('Hidden at checkout')}</span>}
                </p>
                <p className="mt-1 text-xs text-[#65748a]">{t(zone.location)}{zone.storeAddress ? ` · ${t(zone.storeAddress)}` : ''}</p>
                {zone.storePhone && <p className="mt-1 text-xs font-semibold text-[#65748a]">{zone.storePhone}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                <AdminToggle checked={zone.isActive} disabled={isSavingBranches} label={t('Active')} onChange={(isActive) => updateZone(zone.id, { isActive })} />
                <AdminToggle checked={zone.pickupEnabled} disabled={isSavingBranches || !zone.isActive} label={t('Pickup')} onChange={(pickupEnabled) => updateZone(zone.id, { pickupEnabled })} />
                <AdminToggle checked={zone.deliveryEnabled} disabled={isSavingBranches || !zone.isActive} label={t('Delivery')} onChange={(deliveryEnabled) => updateZone(zone.id, { deliveryEnabled })} />
                {zone.deliveryEnabled && (
                  <label className="flex items-center gap-2 text-xs font-bold text-[#65748a]">
                    {t('Delivery fee')}
                    <span className="flex items-center rounded-xl border border-[#dce3eb] bg-[#f4f6f8] pr-3 focus-within:border-[#bd9c00] focus-within:bg-white">
                      <input className="w-24 bg-transparent px-3 py-2 text-sm font-bold tabular-nums text-[#092a53] outline-none!" min="0" onChange={(event) => updateZone(zone.id, { deliveryFee: event.target.value })} type="number" value={zone.deliveryFee} />
                      <span className="text-xs font-extrabold text-[#65748a]">FCFA</span>
                    </span>
                  </label>
                )}
              </div>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[#f4f6f8] p-4 sm:p-5">
          {message && (
            <p className="text-sm font-semibold text-[#1f5d3c]" role="status">{message}</p>
          )}
          <button className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#092a53] px-5 text-sm font-bold text-white transition hover:bg-[#163e6b] disabled:opacity-70" disabled={isSavingBranches} type="submit">
            {isSavingBranches && <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white border-r-transparent motion-reduce:animate-none [animation-duration:2s]" />}
            {isSavingBranches ? t('Saving…') : t('Save branch availability')}
          </button>
        </div>
      </form>

      <form className="rounded-[20px] border border-[#dce3eb] bg-white" onSubmit={saveSlots}>
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#f4f6f8] p-4 sm:p-5">
          <div>
            <h2 className="font-display text-xl font-extrabold text-[#092a53]">{t('Available time slots')}</h2>
            <p className="mt-0.5 text-xs text-[#65748a]">{t('Customers choose one of the active slots at checkout.')}</p>
          </div>
          <button className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#dce3eb] px-4 text-sm font-bold text-[#092a53] transition hover:border-[#092a53] disabled:opacity-50" disabled={slots.length >= 20} onClick={() => setSlots((current) => [...current, { label: '', startTime: '10:00', endTime: '12:00', isActive: true }])} type="button">
            <AdminIcon path={adminIcons.plus} /> {t('Add time slot')}
          </button>
        </div>
        <ul className="divide-y divide-[#f4f6f8]">
          {slots.map((slot, index) => (
            <li className="grid items-end gap-3 p-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] sm:p-5" key={slot.id ?? `new-${index}`}>
              <label className="text-xs font-bold text-[#65748a]">{t('Slot label')}<input className={slotInputClassName} maxLength={60} onChange={(event) => updateSlot(index, { label: event.target.value })} required value={slot.label} /></label>
              <label className="text-xs font-bold text-[#65748a]">{t('Starts')}<input className={slotInputClassName} onChange={(event) => updateSlot(index, { startTime: event.target.value })} required type="time" value={slot.startTime} /></label>
              <label className="text-xs font-bold text-[#65748a]">{t('Ends')}<input className={slotInputClassName} onChange={(event) => updateSlot(index, { endTime: event.target.value })} required type="time" value={slot.endTime} /></label>
              <div className="pb-2"><AdminToggle checked={slot.isActive} label={t('Active')} onChange={(isActive) => updateSlot(index, { isActive })} /></div>
              <button aria-label={t('Remove time slot')} className="mb-1 grid size-9 place-items-center rounded-lg text-[#a3352f] transition hover:bg-red-50" onClick={() => setSlots((current) => current.filter((_, slotIndex) => slotIndex !== index))} title={t('Remove')} type="button">
                <AdminIcon path={adminIcons.trash} />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex justify-end border-t border-[#f4f6f8] p-4 sm:p-5">
          <button className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#092a53] px-5 text-sm font-bold text-white transition hover:bg-[#163e6b] disabled:opacity-50" disabled={!slots.length} type="submit">{t('Save time slots')}</button>
        </div>
      </form>
    </div>
  )
}

const slotInputClassName = 'mt-1.5 w-full rounded-xl border border-[#dce3eb] bg-[#f4f6f8] px-3.5 py-2.5 text-sm font-medium text-[#092a53] transition focus:border-[#bd9c00] focus:bg-white outline-none!'

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
        <AdminStatCard accent="bg-[#eef1f5] text-[#65748a]" icon={adminIcons.store} label={t('Unavailable')} value={unavailableCount} />
      </section>

      <section className="rounded-[20px] border border-[#dce3eb] bg-white">
        {items.length ? (
          <ul className="divide-y divide-[#f4f6f8]">
            {items.map((item) => {
              const soldOut = item.availableQuantity < 1
              return (
                <li className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5" key={item.itemId}>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-bold text-[#092a53]">
                      {item.name}
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${!item.isAvailable ? 'bg-[#eef1f5] text-[#65748a] ring-[#dce3eb]' : soldOut ? 'bg-red-50 text-red-700 ring-red-100' : 'bg-[#fff4e0] text-[#8a5200] ring-[#f3dcb0]'}`}>
                        {!item.isAvailable ? t('Unavailable') : soldOut ? t('Sold out') : t('Low stock')}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-[#65748a]">{t(item.category)} · {t('{count} left', { count: Math.max(0, item.availableQuantity) })}</p>
                  </div>
                  <div className="flex items-end gap-2">
                    <label className="text-xs font-bold text-[#65748a]">{t('Alert at or below')}
                      <input className="mt-1.5 block w-24 rounded-xl border border-[#dce3eb] bg-[#f4f6f8] px-3 py-2 text-sm font-bold tabular-nums text-[#092a53] outline-none! focus:border-[#bd9c00] focus:bg-white" min="0" onChange={(event) => setThresholds((current) => ({ ...current, [item.itemId]: event.target.value }))} type="number" value={thresholds[item.itemId] ?? 5} />
                    </label>
                    <button className="inline-flex min-h-10 items-center rounded-xl border border-[#dce3eb] px-4 text-sm font-bold text-[#092a53] transition hover:border-[#092a53]" onClick={() => saveThreshold(item)} type="button">{t('Save threshold')}</button>
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

const AREA_LABELS = { catalog: 'Catalog', orders: 'Orders', customers: 'Customers', promotions: 'Promotions', settings: 'Settings', account: 'Accounts and sign-in' }
const AREA_ICONS = { catalog: adminIcons.box, orders: adminIcons.truck, customers: adminIcons.user, promotions: adminIcons.check, settings: adminIcons.store, account: adminIcons.user }
const AREA_STYLES = {
  catalog: 'bg-[#fff4c2] text-[#bd9c00]',
  orders: 'bg-[#e9f1fa] text-[#315982]',
  customers: 'bg-[#f3ecfb] text-[#6b4aa0]',
  promotions: 'bg-[#e5f4ea] text-[#2c7a4f]',
  settings: 'bg-[#eef1f5] text-[#65748a]',
  account: 'bg-[#fdeaea] text-[#a3352f]',
}
const AREA_DOTS = {
  catalog: 'bg-[#bd9c00]',
  orders: 'bg-[#3d6f9e]',
  customers: 'bg-[#7a56b3]',
  promotions: 'bg-[#2e9d5b]',
  settings: 'bg-[#65748a]',
  account: 'bg-[#c44b44]',
}

function adminInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return (parts[0] || '?').slice(0, 2).toUpperCase()
}

function activityDateTime(value) {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : undefined
  return value || undefined
}

export function AdminActivityPage() {
  const request = useAdminRequest()
  const { t, language } = useLanguage()
  const [activity, setActivity] = useState(null)
  const [error, setError] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [person, setPerson] = useState('')
  const [area, setArea] = useState('')

  const refresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const result = await request('/admin/activity')
      setActivity(result?.activity ?? [])
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('Unable to load the activity log.'))
    } finally {
      setIsRefreshing(false)
    }
  }, [request, t])

  useEffect(() => {
    refresh()
  }, [refresh])

  const entries = useMemo(() => (activity || []).map((item) => {
    const described = describeAdminActivity(item.method, item.path)
    return { ...item, ...described, day: formatAdminDate(item.createdAt, language) || '' }
  }), [activity, language])

  const people = useMemo(() => [...new Set(entries.map((entry) => entry.adminName).filter(Boolean))].sort(), [entries])

  useEffect(() => {
    if (person && !people.includes(person)) setPerson('')
  }, [people, person])

  const shown = useMemo(
    () => entries.filter((entry) => (!person || entry.adminName === person) && (!area || entry.area === area)),
    [entries, person, area],
  )

  const summary = useMemo(() => {
    const todayLabel = formatAdminDate(new Date(), language) || ''
    const todayCount = entries.filter((entry) => entry.day === todayLabel).length
    const areaCounts = ACTIVITY_AREAS
      .map((value) => ({ value, count: entries.filter((entry) => entry.area === value).length }))
      .filter((row) => row.count > 0)
    const latest = entries[0] || null
    return {
      total: entries.length,
      people: people.length,
      today: todayCount,
      areaCounts,
      latest,
    }
  }, [entries, people, language])

  const dayGroups = useMemo(() => {
    const groups = []
    for (const entry of shown) {
      const day = entry.day || t('Unknown date')
      const last = groups[groups.length - 1]
      if (!last || last.day !== day) groups.push({ day, entries: [entry] })
      else last.entries.push(entry)
    }
    return groups
  }, [shown, t])

  return (
    <div className="min-w-0 space-y-6">
      <AdminPageHeader
        actions={(
          <button
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-[#123b68] ring-1 ring-[#dce4ed] transition hover:bg-[#f4f6f8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] disabled:cursor-wait disabled:opacity-60"
            disabled={isRefreshing}
            onClick={refresh}
            type="button"
          >
            <AdminIcon className={`size-4 ${isRefreshing ? 'animate-spin motion-reduce:animate-none' : ''}`} path={adminIcons.history} />
            {t('Refresh')}
          </button>
        )}
        description={t('A clear record of successful admin changes across the workspace.')}
        icon={adminIcons.history}
        section={t('Workspace')}
        t={t}
        title={t('Activity log')}
      />

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100" role="alert">
          <span className="inline-flex items-start gap-2">
            <AdminIcon className="mt-0.5 size-4 shrink-0" path={adminIcons.alert} />
            {error}
          </span>
          <button className="font-extrabold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700" onClick={refresh} type="button">{t('Try again')}</button>
        </div>
      )}

      {activity === null ? (error ? null : (
        <div aria-label={t('Loading…')} className="space-y-6" role="status">
          <div className="h-44 animate-pulse rounded-[24px] bg-[#f4f6f8]" />
          <div className="h-[28rem] animate-pulse rounded-[20px] bg-[#f4f6f8]" />
        </div>
      )) : (
        <>
          <section aria-labelledby="activity-overview-title" className="overflow-hidden rounded-[24px] border border-[#dce3eb] bg-white">
            <div className="border-b border-[#f4f6f8] bg-[#092a53] px-5 py-5 text-white sm:px-7 sm:py-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-white/65" id="activity-overview-title">{t('Activity overview')}</h2>
                  <p className="mt-2 font-display text-[2.1rem] font-extrabold leading-none tabular-nums tracking-tight sm:text-[2.5rem]">
                    {summary.total}
                  </p>
                  <p className="mt-2 text-sm text-white/70">
                    {summary.total === 1 ? t('1 recorded change') : t('{count} recorded changes', { count: summary.total })}
                    <span aria-hidden="true" className="mx-2 text-white/25">·</span>
                    {t('Latest 200 entries')}
                  </p>
                </div>
                {summary.latest && (
                  <p className="max-w-sm text-sm leading-5 text-white/75">
                    <span className="text-white/50">{t('Latest')}</span>{' '}
                    <span className="font-semibold text-[#ffdc32]">{t(summary.latest.label, { id: summary.latest.id ?? '' })}</span>
                    <span className="text-white/45"> · {summary.latest.adminName}</span>
                  </p>
                )}
              </div>
            </div>

            <dl className="grid grid-cols-2 divide-x divide-y divide-[#f4f6f8] sm:grid-cols-4 sm:divide-y-0">
              <div className="px-4 py-4 sm:px-5">
                <dt className="text-xs font-semibold text-[#65748a]">{t('Today')}</dt>
                <dd className="mt-1.5 font-display text-2xl font-extrabold tabular-nums leading-none tracking-tight text-[#092a53]">{summary.today}</dd>
              </div>
              <div className="px-4 py-4 sm:px-5">
                <dt className="text-xs font-semibold text-[#65748a]">{t('People')}</dt>
                <dd className="mt-1.5 font-display text-2xl font-extrabold tabular-nums leading-none tracking-tight text-[#092a53]">{summary.people}</dd>
              </div>
              <div className="px-4 py-4 sm:px-5">
                <dt className="text-xs font-semibold text-[#65748a]">{t('Areas touched')}</dt>
                <dd className="mt-1.5 font-display text-2xl font-extrabold tabular-nums leading-none tracking-tight text-[#092a53]">{summary.areaCounts.length}</dd>
              </div>
              <div className="px-4 py-4 sm:px-5">
                <dt className="text-xs font-semibold text-[#65748a]">{t('In this view')}</dt>
                <dd className="mt-1.5 font-display text-2xl font-extrabold tabular-nums leading-none tracking-tight text-[#092a53]">{shown.length}</dd>
              </div>
            </dl>

            {summary.areaCounts.length > 0 && (
              <div className="border-t border-[#f4f6f8] px-4 py-4 sm:px-5">
                <p className="text-xs font-semibold text-[#65748a]">{t('By area')}</p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {summary.areaCounts.map((row) => (
                    <li key={row.value}>
                      <button
                        aria-pressed={area === row.value}
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] ${
                          area === row.value ? 'bg-[#092a53] text-white' : 'bg-[#f4f6f8] text-[#123b68] hover:bg-[#e8edf4]'
                        }`}
                        onClick={() => setArea((current) => (current === row.value ? '' : row.value))}
                        type="button"
                      >
                        <span aria-hidden="true" className={`size-2 rounded-full ${area === row.value ? 'bg-[#ffdc32]' : AREA_DOTS[row.value]}`} />
                        {t(AREA_LABELS[row.value])}
                        <span className={`tabular-nums ${area === row.value ? 'text-white/70' : 'text-[#65748a]'}`}>{row.count}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section aria-labelledby="activity-timeline-title" className="overflow-hidden rounded-[20px] border border-[#dce3eb] bg-white">
            <div className="flex flex-col gap-3 border-b border-[#f4f6f8] px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-display text-lg font-extrabold text-[#092a53]" id="activity-timeline-title">{t('Change timeline')}</h2>
                <p className="mt-0.5 text-sm text-[#65748a]">
                  {t('Showing {shown} of {total} changes', { shown: shown.length, total: entries.length })}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#65748a]" id="activity-area-label">{t('Area')}</span>
                  <div aria-labelledby="activity-area-label" className="inline-flex flex-wrap rounded-xl bg-[#f4f6f8] p-1" role="group">
                    <button
                      aria-pressed={!area}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] ${!area ? 'bg-white text-[#092a53] shadow-sm' : 'text-[#65748a] hover:text-[#092a53]'}`}
                      onClick={() => setArea('')}
                      type="button"
                    >
                      {t('All areas')}
                    </button>
                    {ACTIVITY_AREAS.map((value) => {
                      const selected = area === value
                      return (
                        <button
                          aria-pressed={selected}
                          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] ${selected ? 'bg-white text-[#092a53] shadow-sm' : 'text-[#65748a] hover:text-[#092a53]'}`}
                          key={value}
                          onClick={() => setArea(value)}
                          type="button"
                        >
                          {t(AREA_LABELS[value])}
                        </button>
                      )
                    })}
                  </div>
                </div>
                {people.length > 1 && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-[#65748a]" htmlFor="activity-person">{t('Person')}</label>
                    <select
                      className="min-h-9 rounded-xl border border-[#dce3eb] bg-white px-3 text-xs font-bold text-[#092a53] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00]"
                      id="activity-person"
                      onChange={(event) => setPerson(event.target.value)}
                      value={person}
                    >
                      <option value="">{t('Everyone')}</option>
                      {people.map((name) => <option key={name} value={name}>{name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {!entries.length ? (
              <div className="px-6 py-14 text-center">
                <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#f1f5f9] text-[#123b68]">
                  <AdminIcon className="size-6" path={adminIcons.history} />
                </span>
                <p className="mt-4 font-display text-lg font-extrabold text-[#092a53]">{t('No admin changes have been recorded yet.')}</p>
                <p className="mt-1 text-sm text-[#65748a]">{t('Successful edits, orders and account changes will appear here.')}</p>
              </div>
            ) : !shown.length ? (
              <div className="px-6 py-14 text-center">
                <p className="font-display text-lg font-extrabold text-[#092a53]">{t('No matching changes')}</p>
                <p className="mt-1 text-sm text-[#65748a]">{t('Try another person or area filter.')}</p>
                <button
                  className="mt-4 text-sm font-bold text-[#123b68] underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00]"
                  onClick={() => { setPerson(''); setArea('') }}
                  type="button"
                >
                  {t('Clear filters')}
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[#f4f6f8]">
                {dayGroups.map((group) => (
                  <section aria-labelledby={`activity-day-${group.day}`} key={group.day}>
                    <div className="sticky top-[68px] z-10 flex items-center justify-between gap-3 border-b border-[#f4f6f8] bg-[#f4f6f8]/95 px-4 py-2.5 backdrop-blur-sm sm:px-5">
                      <h3 className="text-xs font-extrabold text-[#65748a]" id={`activity-day-${group.day}`}>{group.day}</h3>
                      <span className="text-xs font-semibold tabular-nums text-[#91a0b1]">
                        {group.entries.length === 1 ? t('1 change') : t('{count} changes', { count: group.entries.length })}
                      </span>
                    </div>
                    <ol className="relative">
                      <span aria-hidden="true" className="absolute bottom-4 left-[2.15rem] top-4 w-px bg-[#dce3eb] sm:left-[2.4rem]" />
                      {group.entries.map((entry) => {
                        const createdAtLabel = formatAdminTime(entry.createdAt, language)
                        return (
                          <li className="relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 px-4 py-4 sm:gap-4 sm:px-5" key={entry.id}>
                            <span aria-hidden="true" className={`relative z-[1] grid size-10 shrink-0 place-items-center rounded-xl ring-4 ring-white ${AREA_STYLES[entry.area]}`}>
                              <AdminIcon className="size-4" path={AREA_ICONS[entry.area]} />
                            </span>
                            <div className="min-w-0 pt-0.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-extrabold text-[#092a53]">{t(entry.label, { id: entry.id ?? '' })}</p>
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${AREA_STYLES[entry.area]}`}>
                                  {t(AREA_LABELS[entry.area])}
                                </span>
                              </div>
                              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#65748a]">
                                <span className="inline-flex items-center gap-1.5 font-semibold text-[#123b68]">
                                  <span aria-hidden="true" className="grid size-5 place-items-center rounded-full bg-[#f4f6f8] text-[9px] font-extrabold text-[#123b68]">
                                    {adminInitials(entry.adminName)}
                                  </span>
                                  {entry.adminName}
                                </span>
                                {!entry.known && (
                                  <span className="truncate font-mono text-xs text-[#91a0b1]">{entry.method} {entry.path}</span>
                                )}
                              </div>
                            </div>
                            {createdAtLabel && (
                              <time
                                className="inline-flex shrink-0 items-center gap-1.5 pt-1 text-xs font-semibold tabular-nums text-[#65748a]"
                                dateTime={activityDateTime(entry.createdAt)}
                              >
                                <AdminIcon className="size-3.5 text-[#b0bbc8]" path={adminIcons.clock} />
                                {createdAtLabel}
                              </time>
                            )}
                          </li>
                        )
                      })}
                    </ol>
                  </section>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
