import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../../api/api'
import { useAdminAuth } from './useAdminAuth'
import { useLanguage } from '../../language/useLanguage'
import { AdminIcon, AdminPageHeader } from './AdminPageHeader'
import { adminIcons } from './adminIcons'

interface StoreSummary {
  id: number
  name: string
  town: string
  area: string
  address: string
  phone: string
  location: string
  isActive: boolean
  pickupEnabled: boolean
  deliveryEnabled: boolean
  deliveryFee: number
  orderCount: number
  paidOrderCount: number
  openOrderCount: number
  sales: number
  customerCount: number
  lastOrderAt: string | null
  eventOrderCount: number
  eventNeedsActionCount: number
  cakeRequestCount: number
  newCakeRequestCount: number
  reviewCount: number
  pendingReviewCount: number
  averageRating: number
}

type SortKey = 'sales' | 'rating' | 'attention' | 'name'

const REFRESH_MS = 60_000
const STORE_TONES = ['#ffdc32', '#7ec8ff', '#7fe0a9', '#f3b184', '#d7b3ff', '#9ad7d4', '#ffd0d0', '#e8edf5']

const icons = {
  refresh: 'M4 12a8 8 0 0 1 13.7-5.7L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.7L4 15.5M4 20v-4.5h4.5',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6m-6 4h3',
  calendar: 'M4 6h16v14H4V6Zm0 4h16M8 3v4m8-4v4',
  cake: 'M4 20h16M5 20v-7h14v7M8 13V9h8v4M12 9V5',
  chat: 'M4 5h16v11H9l-5 4V5Zm4 5h8m-8 3h5',
  pin: 'M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Zm0-9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z',
  truck: adminIcons.truck,
  clock: adminIcons.clock,
  check: adminIcons.check,
  alert: adminIcons.alert,
  store: adminIcons.store,
  close: 'M6 6l12 12M18 6 6 18',
  chevron: 'm9 6 6 6-6 6',
  users: 'M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20m17 0v-1.5a4 4 0 0 0-3-3.87M14 3.2a4 4 0 0 1 0 7.6M9.5 10.8a3.8 3.8 0 1 0 0-7.6 3.8 3.8 0 0 0 0 7.6Z',
  star: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7L12 3Z',
}

function formatXaf(value: number, language: string) {
  return `${new Intl.NumberFormat(language === 'fr' ? 'fr-CM' : 'en-CM').format(Number(value || 0))} FCFA`
}

function formatCount(value: number, language: string) {
  return new Intl.NumberFormat(language === 'fr' ? 'fr-CM' : 'en-CM').format(value)
}

function parseDate(value: string | null) {
  if (!value) return null
  const text = String(value).replace(' ', 'T')
  const date = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(text) ? text : `${text}Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

function relativeTime(date: Date, language: string) {
  const seconds = Math.round((date.getTime() - Date.now()) / 1000)
  const formatter = new Intl.RelativeTimeFormat(language === 'fr' ? 'fr' : 'en', { numeric: 'auto' })
  const elapsed = Math.abs(seconds)
  if (elapsed < 3600) return formatter.format(Math.round(seconds / 60), 'minute')
  if (elapsed < 86_400) return formatter.format(Math.round(seconds / 3600), 'hour')
  if (elapsed < 86_400 * 30) return formatter.format(Math.round(seconds / 86_400), 'day')
  return new Intl.DateTimeFormat(language === 'fr' ? 'fr-CM' : 'en-CM', { dateStyle: 'medium' }).format(date)
}

function fullDate(date: Date, language: string) {
  return new Intl.DateTimeFormat(language === 'fr' ? 'fr-CM' : 'en-CM', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function formatShare(share: number) {
  if (share <= 0) return '0%'
  if (share < 0.01) return '<1%'
  return `${Math.round(share * 100)}%`
}

function formatRating(value: number) {
  return value.toFixed(1)
}

function waitingCount(store: StoreSummary) {
  return store.openOrderCount + store.eventNeedsActionCount + store.newCakeRequestCount + store.pendingReviewCount
}

function storeInitials(store: StoreSummary) {
  const source = (store.area || store.name.replace(/\s+branch$/i, '')).trim()
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  const word = parts[0] || 'ST'
  if (/^bon/i.test(word) && word.length > 4) return word.replace(/^bon/i, '').slice(0, 2).toUpperCase()
  return word.slice(0, 2).toUpperCase()
}

function fulfillmentLabel(store: StoreSummary, t: (key: string) => string) {
  if (store.pickupEnabled && store.deliveryEnabled) return t('Pickup and delivery')
  if (store.pickupEnabled) return t('Pickup only')
  if (store.deliveryEnabled) return t('Delivery only')
  return t('No fulfillment enabled')
}

type Translate = (key: string, variables?: Record<string, string | number>) => string

function StarGlyph({ className = 'size-3.5' }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 3.2 14.5 9l6.3.7-4.7 4.3 1.4 6.2L12 17.2 6.5 20.2l1.4-6.2L3.2 9.7 9.5 9 12 3.2Z" />
    </svg>
  )
}

function StarRating({ value, reviews, language, t }: { value: number; reviews: number; language: string; t: Translate }) {
  if (!reviews) {
    return <span className="text-sm text-[#65748a]">{t('No reviews yet')}</span>
  }
  const clamped = Math.max(0, Math.min(5, value))
  return (
    <span className="inline-flex items-center gap-2" title={`${formatRating(clamped)} / 5`}>
      <span aria-hidden="true" className="relative inline-flex">
        <span className="flex gap-0.5 text-[#e4e9ef]">
          {Array.from({ length: 5 }, (_, index) => <StarGlyph key={`empty-${index}`} />)}
        </span>
        <span className="absolute inset-y-0 left-0 flex gap-0.5 overflow-hidden text-[#bd9c00]" style={{ width: `${(clamped / 5) * 100}%` }}>
          {Array.from({ length: 5 }, (_, index) => <StarGlyph className="size-3.5 shrink-0" key={`filled-${index}`} />)}
        </span>
      </span>
      <span className="font-display text-sm font-extrabold tabular-nums text-[#092a53]">{formatRating(clamped)}</span>
      <span className="text-xs text-[#65748a]">({formatCount(reviews, language)})</span>
    </span>
  )
}

function waitingItems(store: StoreSummary, t: Translate) {
  const plural = (count: number, one: string, many: string) => (count === 1 ? t(one) : t(many, { count }))
  return [
    { key: 'orders', count: store.openOrderCount, label: plural(store.openOrderCount, '1 open order', '{count} open orders'), to: '/admin/orders' },
    { key: 'events', count: store.eventNeedsActionCount, label: plural(store.eventNeedsActionCount, '1 event order needs action', '{count} event orders need action'), to: '/admin/events' },
    { key: 'cakes', count: store.newCakeRequestCount, label: plural(store.newCakeRequestCount, '1 new cake request', '{count} new cake requests'), to: '/admin/cake-requests' },
    { key: 'reviews', count: store.pendingReviewCount, label: plural(store.pendingReviewCount, '1 review to approve', '{count} reviews to approve'), to: '/admin/reviews' },
  ].filter((row) => row.count > 0)
}

export function AdminStoresPage() {
  const { sessionToken } = useAdminAuth()
  const { t, language } = useLanguage()
  const [stores, setStores] = useState<StoreSummary[] | null>(null)
  const [error, setError] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('sales')
  const [townFilter, setTownFilter] = useState('all')
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null)

  const refresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const result = await apiRequest<{ stores: StoreSummary[] }>('/admin/stores', { token: sessionToken })
      setStores(result?.stores ?? [])
      setLastUpdated(new Date())
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('Unable to load store summaries.'))
    } finally {
      setIsRefreshing(false)
    }
  }, [sessionToken, t])

  useEffect(() => {
    refresh()
    const timer = window.setInterval(refresh, REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [refresh])

  const towns = useMemo(() => [...new Set((stores || []).map((store) => store.town))], [stores])

  useEffect(() => {
    if (townFilter !== 'all' && !towns.includes(townFilter)) setTownFilter('all')
  }, [townFilter, towns])

  useEffect(() => {
    if (selectedStoreId == null) return undefined
    if (stores && !stores.some((store) => store.id === selectedStoreId)) setSelectedStoreId(null)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setSelectedStoreId(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedStoreId, stores])

  const network = useMemo(() => {
    const list = stores || []
    const visible = townFilter === 'all' ? list : list.filter((store) => store.town === townFilter)
    const totals = visible.reduce((summary, store) => ({
      orders: summary.orders + store.orderCount,
      paidOrders: summary.paidOrders + store.paidOrderCount,
      sales: summary.sales + store.sales,
      waiting: summary.waiting + waitingCount(store),
      active: summary.active + (store.isActive ? 1 : 0),
      customers: summary.customers + store.customerCount,
      reviews: summary.reviews + store.reviewCount,
      ratingPoints: summary.ratingPoints + store.averageRating * store.reviewCount,
    }), { orders: 0, paidOrders: 0, sales: 0, waiting: 0, active: 0, customers: 0, reviews: 0, ratingPoints: 0 })
    const averageRating = totals.reviews > 0 ? totals.ratingPoints / totals.reviews : 0
    const tones = new Map(list.map((store, index) => [store.id, STORE_TONES[index % STORE_TONES.length]]))
    const shares = new Map(visible.map((store) => [store.id, totals.sales > 0 ? store.sales / totals.sales : 0]))
    const townCounts = [...visible.reduce((counts, store) => counts.set(store.town, (counts.get(store.town) || 0) + 1), new Map<string, number>())]
    const sorted = [...visible].sort((first, second) => {
      if (sortKey === 'sales') return second.sales - first.sales || second.orderCount - first.orderCount || first.name.localeCompare(second.name)
      if (sortKey === 'rating') {
        const firstScore = first.reviewCount ? first.averageRating : -1
        const secondScore = second.reviewCount ? second.averageRating : -1
        return secondScore - firstScore || second.reviewCount - first.reviewCount || first.name.localeCompare(second.name)
      }
      if (sortKey === 'attention') return waitingCount(second) - waitingCount(first) || second.sales - first.sales || first.name.localeCompare(second.name)
      return first.name.localeCompare(second.name)
    })
    const leader = [...visible].sort((first, second) => second.sales - first.sales || first.name.localeCompare(second.name))[0]
    const topRated = [...visible]
      .filter((store) => store.reviewCount > 0)
      .sort((first, second) => second.averageRating - first.averageRating || second.reviewCount - first.reviewCount || first.name.localeCompare(second.name))[0]
    return { totals: { ...totals, averageRating }, tones, shares, townCounts, sorted, leader, topRated }
  }, [stores, sortKey, townFilter])

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: 'sales', label: t('Sales') },
    { key: 'rating', label: t('Rating') },
    { key: 'attention', label: t('Needs attention') },
    { key: 'name', label: t('Name') },
  ]
  const selectedStore = (stores || []).find((store) => store.id === selectedStoreId) || null
  const selectedShare = selectedStore ? (network.shares.get(selectedStore.id) || 0) : 0
  const selectedTone = selectedStore ? (network.tones.get(selectedStore.id) || STORE_TONES[0]) : STORE_TONES[0]

  return (
    <div className="min-w-0 space-y-6">
      <AdminPageHeader
        actions={(
          <>
            {lastUpdated && (
              <span className="text-xs text-[#8e9bab]" title={fullDate(lastUpdated, language)}>
                {Date.now() - lastUpdated.getTime() < 60_000
                  ? t('Updated just now')
                  : t('Updated {time}', { time: relativeTime(lastUpdated, language) })}
              </span>
            )}
            <button
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-[#123b68] ring-1 ring-[#dce4ed] transition hover:bg-[#f4f6f8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] disabled:cursor-wait disabled:opacity-60"
              disabled={isRefreshing}
              onClick={refresh}
              type="button"
            >
              <AdminIcon className={`size-4 ${isRefreshing ? 'animate-spin motion-reduce:animate-none' : ''}`} path={icons.refresh} />
              {t('Refresh')}
            </button>
          </>
        )}
        description={t('A clear summary of sales, customers and ratings across every branch.')}
        icon={icons.store}
        section={t('Overview')}
        t={t}
        title={t('Stores')}
      />

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100" role="alert">
          <span className="inline-flex items-start gap-2">
            <AdminIcon className="mt-0.5 size-4 shrink-0" path={icons.alert} />
            {error}
          </span>
          <button className="font-extrabold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700" onClick={refresh} type="button">{t('Try again')}</button>
        </div>
      )}

      {stores === null ? (error ? null : (
        <div aria-label={t('Loading…')} className="space-y-6" role="status">
          <div className="h-44 animate-pulse rounded-[24px] bg-[#f4f6f8]" />
          <div className="h-[28rem] animate-pulse rounded-[20px] bg-[#f4f6f8]" />
        </div>
      )) : !stores.length ? (
        <div className="rounded-[20px] border border-dashed border-[#dce3eb] bg-white px-6 py-14 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#f1f5f9] text-[#123b68]">
            <AdminIcon className="size-6" path={icons.store} />
          </span>
          <p className="mt-4 font-display text-lg font-extrabold text-[#092a53]">{t('No stores found.')}</p>
          <p className="mt-1 text-sm text-[#65748a]">{t('Stores in your assigned access area will appear here.')}</p>
        </div>
      ) : (
        <>
          <section aria-labelledby="network-title" className="overflow-hidden rounded-[24px] border border-[#dce3eb] bg-white">
            <div className="border-b border-[#f4f6f8] bg-[#092a53] px-5 py-5 text-white sm:px-7 sm:py-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-white/65" id="network-title">{t('Network overview')}</h2>
                  <p className="mt-2 font-display text-[2.1rem] font-extrabold leading-none tabular-nums tracking-tight sm:text-[2.5rem]">
                    {formatXaf(network.totals.sales, language)}
                  </p>
                  <p className="mt-2 text-sm text-white/70">
                    {t('Paid sales across {count} stores', { count: network.sorted.length })}
                    {network.townCounts.length > 0 && (
                      <>
                        <span aria-hidden="true" className="mx-2 text-white/25">·</span>
                        {network.townCounts.map(([town, count]) => t('{count} in {town}', { count, town })).join(', ')}
                      </>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/75">
                  {network.leader && network.totals.sales > 0 && (
                    <p>
                      <span className="text-white/50">{t('Top sales')}</span>{' '}
                      <span className="font-semibold text-[#ffdc32]">{network.leader.area || network.leader.name}</span>
                      <span className="text-white/45"> · {formatShare(network.shares.get(network.leader.id) || 0)}</span>
                    </p>
                  )}
                  {network.topRated && (
                    <p>
                      <span className="text-white/50">{t('Top rated')}</span>{' '}
                      <span className="font-semibold text-[#ffdc32]">{network.topRated.area || network.topRated.name}</span>
                      <span className="text-white/45"> · {formatRating(network.topRated.averageRating)}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            <dl className="grid grid-cols-2 divide-x divide-y divide-[#f4f6f8] sm:grid-cols-3 xl:grid-cols-6 xl:divide-y-0">
              {[
                { label: t('Paid orders'), value: formatCount(network.totals.paidOrders, language), hint: t('{paid} paid of {total} orders', { paid: formatCount(network.totals.paidOrders, language), total: formatCount(network.totals.orders, language) }) },
                { label: t('Customers'), value: formatCount(network.totals.customers, language) },
                {
                  label: t('Average rating'),
                  value: network.totals.reviews ? formatRating(network.totals.averageRating) : '—',
                  hint: network.totals.reviews
                    ? (network.totals.reviews === 1 ? t('1 review') : t('{count} reviews', { count: formatCount(network.totals.reviews, language) }))
                    : t('No reviews yet'),
                  accent: true,
                },
                { label: t('Active stores'), value: `${formatCount(network.totals.active, language)} / ${network.sorted.length}` },
                {
                  label: t('Waiting'),
                  value: formatCount(network.totals.waiting, language),
                  warn: network.totals.waiting > 0,
                },
                {
                  label: t('Reviews'),
                  value: formatCount(network.totals.reviews, language),
                },
              ].map((metric) => (
                <div className={`px-4 py-4 sm:px-5 ${metric.warn ? 'bg-[#fff8e8]' : ''}`} key={metric.label}>
                  <dt className={`text-xs font-semibold ${metric.warn ? 'text-[#bd9c00]' : 'text-[#65748a]'}`}>{metric.label}</dt>
                  <dd className={`mt-1.5 font-display text-2xl font-extrabold tabular-nums leading-none tracking-tight ${metric.warn ? 'text-[#bd9c00]' : metric.accent ? 'text-[#bd9c00]' : 'text-[#092a53]'}`}>
                    {metric.value}
                    {metric.accent && network.totals.reviews > 0 && (
                      <span className="ml-1 text-base font-bold text-[#bd9c00]/70">/ 5</span>
                    )}
                  </dd>
                  {metric.hint && <p className="mt-1.5 text-xs text-[#65748a]">{metric.hint}</p>}
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="stores-title" className="@container overflow-hidden rounded-[20px] border border-[#dce3eb] bg-white">
            <div className="flex flex-col gap-3 border-b border-[#f4f6f8] px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-display text-lg font-extrabold text-[#092a53]" id="stores-title">{t('Store summary')}</h2>
                <p className="mt-0.5 text-sm text-[#65748a]">
                  {townFilter === 'all'
                    ? (network.sorted.length === 1 ? t('1 store') : t('{count} stores', { count: network.sorted.length }))
                    : t('{count} in {town}', { count: network.sorted.length, town: townFilter })}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                {towns.length > 1 && (
                  <div className="flex items-center gap-2">
                    <span className="sr-only" id="stores-town-label">{t('Filter by town')}</span>
                    <div aria-labelledby="stores-town-label" className="inline-flex flex-wrap rounded-xl bg-[#f4f6f8] p-1" role="group">
                      {[{ value: 'all', label: t('All towns') }, ...towns.map((town) => ({ value: town, label: town }))].map((option) => {
                        const selected = townFilter === option.value
                        return (
                          <button
                            aria-pressed={selected}
                            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] ${selected ? 'bg-white text-[#092a53] shadow-sm' : 'text-[#65748a] hover:text-[#092a53]'}`}
                            key={option.value}
                            onClick={() => setTownFilter(option.value)}
                            type="button"
                          >
                            {option.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#65748a]" id="stores-sort-label">{t('Sort by')}</span>
                  <div aria-labelledby="stores-sort-label" className="inline-flex flex-wrap rounded-xl bg-[#f4f6f8] p-1" role="group">
                    {sortOptions.map((option) => {
                      const selected = sortKey === option.key
                      return (
                        <button
                          aria-pressed={selected}
                          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] ${selected ? 'bg-white text-[#092a53] shadow-sm' : 'text-[#65748a] hover:text-[#092a53]'}`}
                          key={option.key}
                          onClick={() => setSortKey(option.key)}
                          type="button"
                        >
                          {option.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            {!network.sorted.length ? (
              <p className="px-5 py-12 text-center text-sm text-[#65748a]">{t('No stores found.')}</p>
            ) : (
              <ul className="divide-y divide-[#f4f6f8]">
                <li className="hidden px-5 py-2.5 text-xs font-bold text-[#8e9bab] @[48rem]:grid @[48rem]:grid-cols-[minmax(13rem,1.4fr)_minmax(8rem,0.85fr)_minmax(9.5rem,1fr)_minmax(5.5rem,0.55fr)_minmax(6rem,0.6fr)]">
                  <span>{t('Store')}</span>
                  <span>{t('Paid sales')}</span>
                  <span>{t('Rating')}</span>
                  <span>{t('Customers')}</span>
                  <span className="text-right">{t('Waiting')}</span>
                </li>
                {network.sorted.map((store, index) => (
                  <StoreRow
                    isSelected={selectedStoreId === store.id}
                    key={store.id}
                    language={language}
                    onSelect={() => setSelectedStoreId(store.id)}
                    rank={index + 1}
                    share={network.shares.get(store.id) || 0}
                    store={store}
                    t={t}
                    tone={network.tones.get(store.id) || STORE_TONES[0]}
                  />
                ))}
              </ul>
            )}
          </section>

          {selectedStore && (
            <StoreDetailDrawer
              language={language}
              onClose={() => setSelectedStoreId(null)}
              share={selectedShare}
              store={selectedStore}
              t={t}
              tone={selectedTone}
            />
          )}
        </>
      )}
    </div>
  )
}

function StoreRow({
  store,
  tone,
  share,
  language,
  t,
  onSelect,
  isSelected,
  rank,
}: {
  store: StoreSummary
  tone: string
  share: number
  language: string
  t: Translate
  onSelect: () => void
  isSelected: boolean
  rank: number
}) {
  const waitingTotal = waitingCount(store)

  return (
    <li>
      <button
        aria-current={isSelected ? 'true' : undefined}
        className={`grid w-full gap-4 px-4 py-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#bd9c00] sm:px-5 @[48rem]:grid-cols-[minmax(13rem,1.4fr)_minmax(8rem,0.85fr)_minmax(9.5rem,1fr)_minmax(5.5rem,0.55fr)_minmax(6rem,0.6fr)] @[48rem]:items-center ${
          isSelected ? 'bg-[#f4f7fb]' : store.isActive ? 'hover:bg-[#f4f6f8]' : 'bg-[#fafbfc] hover:bg-[#f3f5f8]'
        }`}
        onClick={onSelect}
        type="button"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="w-5 shrink-0 text-center text-xs font-bold tabular-nums text-[#9aa7b5]">{rank}</span>
          <span
            aria-hidden="true"
            className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-[#092a53] font-display text-xs font-extrabold text-white"
          >
            <span className="absolute left-0 top-0 h-full w-1 rounded-l-xl" style={{ backgroundColor: tone }} />
            {storeInitials(store)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate font-display text-base font-extrabold text-[#092a53]">{store.area || store.name}</h3>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-bold ${store.isActive ? 'bg-[#eaf6ee] text-[#1f6b3e]' : 'bg-[#f3f4f6] text-[#6b7280]'}`}>
                <span aria-hidden="true" className={`size-1.5 rounded-full ${store.isActive ? 'bg-[#2e9d5b]' : 'bg-[#9aa3af]'}`} />
                {t(store.isActive ? 'Active' : 'Not taking orders')}
              </span>
            </div>
            <p className="mt-0.5 truncate text-sm text-[#65748a]">{store.town}</p>
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#8e9bab] @[48rem]:sr-only">{t('Paid sales')}</p>
          <p className="font-display text-lg font-extrabold tabular-nums leading-none tracking-tight text-[#092a53]">
            {formatXaf(store.sales, language)}
          </p>
          <div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#f4f6f8]">
            <div className="h-full rounded-full" style={{ width: `${Math.max(share > 0 ? 4 : 0, share * 100)}%`, backgroundColor: tone }} />
          </div>
          <p className="mt-1.5 text-xs text-[#65748a]">
            {store.paidOrderCount
              ? `${t('{count} paid', { count: formatCount(store.paidOrderCount, language) })} · ${formatShare(share)}`
              : t('No orders yet')}
          </p>
        </div>

        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#8e9bab] @[48rem]:sr-only">{t('Rating')}</p>
          <StarRating language={language} reviews={store.reviewCount} t={t} value={store.averageRating} />
        </div>

        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#8e9bab] @[48rem]:sr-only">{t('Customers')}</p>
          <p className="font-display text-lg font-extrabold tabular-nums leading-none text-[#092a53]">{formatCount(store.customerCount, language)}</p>
        </div>

        <div className="min-w-0 @[48rem]:text-right">
          <p className="text-xs font-semibold text-[#8e9bab] @[48rem]:sr-only">{t('Waiting')}</p>
          {waitingTotal > 0 ? (
            <p className="inline-flex items-center gap-1.5 rounded-full bg-[#fff6d6] px-2.5 py-1 text-xs font-bold text-[#7a5600]">
              {waitingTotal === 1 ? t('1 item waiting') : t('{count} items waiting', { count: waitingTotal })}
            </p>
          ) : (
            <p className="inline-flex items-center justify-end gap-1.5 text-sm text-[#2c7a4f]">
              <AdminIcon className="size-3.5" path={icons.check} />
              <span className="@[48rem]:sr-only">{t('Nothing is waiting here.')}</span>
            </p>
          )}
        </div>
      </button>
    </li>
  )
}

function StoreDetailDrawer({
  store,
  tone,
  share,
  language,
  t,
  onClose,
}: {
  store: StoreSummary
  tone: string
  share: number
  language: string
  t: Translate
  onClose: () => void
}) {
  const lastOrder = parseDate(store.lastOrderAt)
  const waiting = waitingItems(store, t)
  const waitingTotal = waitingCount(store)
  const address = store.address || store.location

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      <button
        aria-label={t('Close')}
        className="admin-drawer-backdrop absolute inset-0 bg-[#0b1e36]/45 backdrop-blur-[2px]"
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />
      <section
        aria-labelledby="store-drawer-title"
        aria-modal="true"
        className="admin-drawer-panel relative flex h-full w-full max-w-[32rem] flex-col bg-white shadow-[-24px_0_60px_rgba(9,42,83,0.18)]"
        role="dialog"
      >
        <header className="border-b border-[#f4f6f8] px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span
                aria-hidden="true"
                className="relative grid size-12 shrink-0 place-items-center rounded-2xl bg-[#092a53] font-display text-sm font-extrabold text-white"
              >
                <span className="absolute left-0 top-0 h-full w-1 rounded-l-2xl" style={{ backgroundColor: tone }} />
                {storeInitials(store)}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#bd9c00]">{store.town} · {store.area}</p>
                <h2 className="mt-0.5 font-display text-2xl font-extrabold leading-tight text-[#092a53]" id="store-drawer-title">
                  {store.name}
                </h2>
                <span className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${store.isActive ? 'bg-[#eaf6ee] text-[#1f6b3e]' : 'bg-[#f3f4f6] text-[#6b7280]'}`}>
                  <span aria-hidden="true" className={`size-1.5 rounded-full ${store.isActive ? 'bg-[#2e9d5b]' : 'bg-[#9aa3af]'}`} />
                  {t(store.isActive ? 'Active' : 'Not taking orders')}
                </span>
              </div>
            </div>
            <button
              aria-label={t('Close')}
              className="grid size-9 shrink-0 place-items-center rounded-xl text-[#65748a] transition hover:bg-[#f4f6f8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00]"
              onClick={onClose}
              type="button"
            >
              <AdminIcon className="size-4" path={icons.close} />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6">
          <section>
            <h3 className="text-xs font-semibold text-[#65748a]">{t('Contact')}</h3>
            <dl className="mt-3 space-y-3">
              <div className="rounded-2xl bg-[#f4f6f8] px-4 py-3">
                <dt className="text-xs text-[#8592a3]">{t('Address')}</dt>
                <dd className="mt-1 flex items-start gap-2 text-sm font-semibold text-[#092a53]">
                  <AdminIcon className="mt-0.5 size-4 shrink-0 text-[#65748a]" path={icons.pin} />
                  <span>{address || t('No address provided')}</span>
                </dd>
              </div>
              {store.phone && (
                <div className="rounded-2xl bg-[#f4f6f8] px-4 py-3">
                  <dt className="text-xs text-[#8592a3]">{t('Phone')}</dt>
                  <dd className="mt-1">
                    <a
                      className="inline-flex items-center gap-2 text-sm font-bold text-[#123b68] hover:text-[#092a53] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00]"
                      href={`tel:${store.phone}`}
                    >
                      <AdminIcon className="size-4 shrink-0" path={icons.phone} />
                      {store.phone}
                    </a>
                  </dd>
                </div>
              )}
              <div className="rounded-2xl bg-[#f4f6f8] px-4 py-3">
                <dt className="text-xs text-[#8592a3]">{t('Pickup & delivery')}</dt>
                <dd className="mt-1 flex items-start gap-2 text-sm font-semibold text-[#092a53]">
                  <AdminIcon className="mt-0.5 size-4 shrink-0 text-[#65748a]" path={icons.truck} />
                  <span>
                    {fulfillmentLabel(store, t)}
                    {store.deliveryEnabled && store.deliveryFee > 0
                      ? ` · ${t('Delivery fee')}: ${formatXaf(store.deliveryFee, language)}`
                      : ''}
                  </span>
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <h3 className="text-xs font-semibold text-[#65748a]">{t('Sales')}</h3>
            <div className="mt-3 rounded-2xl bg-[#092a53] px-5 py-4 text-white">
              <p className="text-xs font-semibold text-white/60">{t('Paid sales')}</p>
              <p className="mt-1 font-display text-[1.85rem] font-extrabold tabular-nums leading-none tracking-tight">
                {formatXaf(store.sales, language)}
              </p>
              <div aria-hidden="true" className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full" style={{ width: `${Math.max(share > 0 ? 4 : 0, share * 100)}%`, backgroundColor: tone }} />
              </div>
              <p className="mt-2 text-sm text-white/70">
                {networkShareLabel(share, t)}
                <span aria-hidden="true" className="mx-2 text-white/25">·</span>
                {t('{count} paid', { count: formatCount(store.paidOrderCount, language) })}
              </p>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[#f4f6f8] px-4 py-3">
                <dt className="text-xs text-[#8592a3]">{t('Customers')}</dt>
                <dd className="mt-1 font-display text-xl font-extrabold tabular-nums text-[#092a53]">{formatCount(store.customerCount, language)}</dd>
              </div>
              <div className="rounded-2xl bg-[#f4f6f8] px-4 py-3">
                <dt className="text-xs text-[#8592a3]">{t('Average rating')}</dt>
                <dd className="mt-1 font-display text-xl font-extrabold tabular-nums text-[#092a53]">
                  {store.reviewCount ? `${store.averageRating.toFixed(1)} / 5` : '—'}
                </dd>
              </div>
              <div className="col-span-2 rounded-2xl bg-[#f4f6f8] px-4 py-3">
                <dt className="text-xs text-[#8592a3]">{t('Latest order')}</dt>
                <dd className="mt-1 text-sm font-semibold text-[#092a53]" title={lastOrder ? fullDate(lastOrder, language) : undefined}>
                  {lastOrder ? relativeTime(lastOrder, language) : t('No orders yet')}
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-xs font-semibold text-[#65748a]">{t('Waiting on this store')}</h3>
              {waitingTotal > 0 && (
                <span className="text-xs font-bold text-[#bd9c00]">
                  {waitingTotal === 1 ? t('1 item waiting') : t('{count} items waiting', { count: waitingTotal })}
                </span>
              )}
            </div>
            {waiting.length ? (
              <ul className="mt-3 divide-y divide-[#f4f6f8] overflow-hidden rounded-2xl ring-1 ring-[#dce3eb]">
                {waiting.map((row) => (
                  <li key={row.key}>
                    <Link
                      className="flex items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-[#092a53] transition hover:bg-[#f4f6f8] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#bd9c00]"
                      onClick={onClose}
                      to={row.to}
                    >
                      <span className="inline-flex items-center gap-2">
                        <AdminIcon className="size-4 text-[#bd9c00]" path={row.key === 'orders' ? icons.receipt : row.key === 'events' ? icons.calendar : row.key === 'cakes' ? icons.cake : icons.chat} />
                        {row.label}
                      </span>
                      <AdminIcon className="size-3.5 shrink-0 text-[#9aa7b5]" path={icons.chevron} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-[#eaf6ee] px-4 py-3 text-sm font-semibold text-[#1f6b3e]">
                <AdminIcon className="size-4" path={icons.check} />
                {t('Nothing is waiting here.')}
              </p>
            )}
          </section>
        </div>

        <footer className="border-t border-[#f4f6f8] px-6 py-4">
          <Link
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#092a53] px-4 text-sm font-bold text-white transition hover:bg-[#0d355f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00]"
            onClick={onClose}
            to="/admin/orders"
          >
            {t('View orders')}
            <AdminIcon className="size-4" path={icons.chevron} />
          </Link>
        </footer>
      </section>
    </div>
  )
}

function networkShareLabel(share: number, t: Translate) {
  if (share <= 0) return t('{percent} of network sales', { percent: '0%' })
  return t('{percent} of network sales', { percent: formatShare(share) })
}
