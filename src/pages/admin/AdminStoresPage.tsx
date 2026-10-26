import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../../api/api'
import { useAdminAuth } from './useAdminAuth'
import { useLanguage } from '../../language/useLanguage'
import { AdminIcon } from './AdminPageHeader'
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

const icons = {
  refresh: 'M4 12a8 8 0 0 1 13.7-5.7L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.7L4 15.5M4 20v-4.5h4.5',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6m-6 4h3',
  calendar: 'M4 6h16v14H4V6Zm0 4h16M8 3v4m8-4v4',
  cake: 'M4 20h16M5 20v-7h14v7M8 13V9h8v4M12 9V5',
  chat: 'M4 5h16v11H9l-5 4V5Zm4 5h8m-8 3h5',
  pin: 'M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Zm0-9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z',
  truck: adminIcons.truck,
  alert: adminIcons.alert,
  close: 'M6 6l12 12M18 6 6 18',
  chevron: 'm9 6 6 6-6 6',
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
    return <span className="text-sm text-[#5f6368]">{t('No reviews yet')}</span>
  }
  const clamped = Math.max(0, Math.min(5, value))
  return (
    <span className="inline-flex items-center gap-2" title={`${formatRating(clamped)} / 5`}>
      <span aria-hidden="true" className="relative inline-flex">
        <span className="flex gap-0.5 text-[#e8e8e8]">
          {Array.from({ length: 5 }, (_, index) => <StarGlyph key={`empty-${index}`} />)}
        </span>
        <span className="absolute inset-y-0 left-0 flex gap-0.5 overflow-hidden text-[#b8721e]" style={{ width: `${(clamped / 5) * 100}%` }}>
          {Array.from({ length: 5 }, (_, index) => <StarGlyph className="size-3.5 shrink-0" key={`filled-${index}`} />)}
        </span>
      </span>
      <span className="text-sm font-medium tabular-nums text-[#111]">{formatRating(clamped)}</span>
      <span className="text-xs text-[#5f6368]">({formatCount(reviews, language)})</span>
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
    return { totals: { ...totals, averageRating }, shares, townCounts, sorted, leader, topRated }
  }, [stores, sortKey, townFilter])

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: 'sales', label: t('Sales') },
    { key: 'rating', label: t('Rating') },
    { key: 'attention', label: t('Needs attention') },
    { key: 'name', label: t('Name') },
  ]
  const selectedStore = (stores || []).find((store) => store.id === selectedStoreId) || null
  const selectedShare = selectedStore ? (network.shares.get(selectedStore.id) || 0) : 0

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-col gap-4 border-b border-[#e8e8e8] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <nav aria-label={t('Breadcrumb')} className="text-xs font-medium text-[#5f6368]">
            {t('Overview')} <span aria-hidden="true" className="mx-1">/</span>
            <span className="text-[#472a3b]">{t('Stores')}</span>
          </nav>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#111]">{t('Stores')}</h1>
          <p className="mt-1 text-sm text-[#5f6368]">
            {stores && network.totals.waiting > 0 ? (
              <>
                <span className="tabular-nums text-[#111]">{formatCount(network.totals.waiting, language)}</span>
                {' '}
                {network.totals.waiting === 1 ? t('1 item waiting') : t('{count} items waiting', { count: network.totals.waiting })}
                {network.leader ? (
                  <>
                    {' · '}
                    {t('Top sales')}
                    {' '}
                    <span className="text-[#111]">{network.leader.area || network.leader.name}</span>
                  </>
                ) : null}
              </>
            ) : (
              t('A clear summary of sales, customers and ratings across every branch.')
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {lastUpdated && (
            <span className="text-xs font-medium text-[#5f6368]" title={fullDate(lastUpdated, language)}>
              {Date.now() - lastUpdated.getTime() < 60_000
                ? t('Updated just now')
                : t('Updated {time}', { time: relativeTime(lastUpdated, language) })}
            </span>
          )}
          <button
            className="inline-flex h-8 items-center gap-2 border border-[#d1d5db] bg-white px-3 text-sm font-medium text-[#111] transition hover:border-[#472a3b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#472a3b] disabled:cursor-wait disabled:opacity-60"
            disabled={isRefreshing}
            onClick={refresh}
            type="button"
          >
            <AdminIcon className={`size-3.5 ${isRefreshing ? 'animate-spin motion-reduce:animate-none' : ''}`} path={icons.refresh} />
            {t('Refresh')}
          </button>
        </div>
      </header>

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#ffedea] px-4 py-3 text-sm font-medium text-[#831c1e]" role="alert">
          <span className="inline-flex items-start gap-2">
            <AdminIcon className="mt-0.5 size-4 shrink-0" path={icons.alert} />
            {error}
          </span>
          <button className="font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#831c1e]" onClick={refresh} type="button">{t('Try again')}</button>
        </div>
      )}

      {stores === null ? (error ? null : (
        <div aria-label={t('Loading…')} className="space-y-0 border border-[#e8e8e8] bg-white" role="status">
          {[0, 1, 2, 3, 4].map((row) => (
            <div className="flex h-12 items-center gap-4 border-b border-[#f2f2f2] px-4 last:border-b-0" key={row}>
              <span className="h-3 w-24 bg-[#eeeeee]" />
              <span className="h-3 flex-1 bg-[#eeeeee]" />
              <span className="h-3 w-16 bg-[#eeeeee]" />
            </div>
          ))}
        </div>
      )) : !stores.length ? (
        <div className="border border-dashed border-[#e8e8e8] bg-white px-4 py-10">
          <p className="text-sm font-semibold text-[#111]">{t('No stores found.')}</p>
          <p className="mt-1 text-sm text-[#5f6368]">{t('Stores in your assigned access area will appear here.')}</p>
        </div>
      ) : (
        <>
          <section aria-labelledby="network-title" className="border border-[#e8e8e8] bg-white">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#e8e8e8] px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-[#111]" id="network-title">{t('Network overview')}</h2>
                <p className="mt-0.5 text-xs text-[#5f6368]">
                  {t('Paid sales across {count} stores', { count: network.sorted.length })}
                  {network.townCounts.length > 0 && (
                    <>
                      <span aria-hidden="true" className="mx-1.5">·</span>
                      {network.townCounts.map(([town, count]) => t('{count} in {town}', { count, town })).join(', ')}
                    </>
                  )}
                </p>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#5f6368]">
                {network.leader && network.totals.sales > 0 && (
                  <p>
                    {t('Top sales')}{' '}
                    <span className="font-medium text-[#111]">{network.leader.area || network.leader.name}</span>
                    <span> · {formatShare(network.shares.get(network.leader.id) || 0)}</span>
                  </p>
                )}
                {network.topRated && (
                  <p>
                    {t('Top rated')}{' '}
                    <span className="font-medium text-[#111]">{network.topRated.area || network.topRated.name}</span>
                    <span> · {formatRating(network.topRated.averageRating)}</span>
                  </p>
                )}
              </div>
            </div>

            <dl className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
              {([
                { label: t('Paid sales'), value: formatXaf(network.totals.sales, language), lead: true },
                {
                  label: t('Waiting'),
                  value: formatCount(network.totals.waiting, language),
                  warn: network.totals.waiting > 0,
                },
                { label: t('Paid orders'), value: formatCount(network.totals.paidOrders, language), hint: t('{paid} paid of {total} orders', { paid: formatCount(network.totals.paidOrders, language), total: formatCount(network.totals.orders, language) }) },
                { label: t('Customers'), value: formatCount(network.totals.customers, language) },
                {
                  label: t('Average rating'),
                  value: network.totals.reviews ? `${formatRating(network.totals.averageRating)} / 5` : '—',
                  hint: network.totals.reviews
                    ? (network.totals.reviews === 1 ? t('1 review') : t('{count} reviews', { count: formatCount(network.totals.reviews, language) }))
                    : t('No reviews yet'),
                },
                { label: t('Active stores'), value: `${formatCount(network.totals.active, language)} / ${network.sorted.length}` },
              ] as { label: string; value: string; lead?: boolean; warn?: boolean; hint?: string }[]).map((metric, index) => (
                <div
                  className={`px-4 py-4 ${index % 2 === 1 ? 'border-l border-[#e8e8e8]' : ''} ${index > 1 ? 'border-t border-[#e8e8e8] sm:border-t-0' : ''} ${index > 0 ? 'sm:border-l sm:border-[#e8e8e8]' : ''} ${index > 2 ? 'sm:border-t xl:border-t-0' : ''} ${metric.warn ? 'bg-[#fff8e8]' : ''}`}
                  key={metric.label}
                >
                  <dt className={`text-xs font-medium ${metric.warn ? 'text-[#7a4e00]' : 'text-[#5f6368]'}`}>{metric.label}</dt>
                  <dd className={`mt-1 font-medium tabular-nums tracking-tight ${metric.lead ? 'text-[1.875rem] text-[#111]' : 'text-2xl'} ${metric.warn ? 'text-[#7a4e00]' : 'text-[#111]'}`}>
                    {metric.value}
                  </dd>
                  {metric.hint && <p className="mt-1.5 text-xs text-[#5f6368]">{metric.hint}</p>}
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="stores-title" className="@container border border-[#e8e8e8] bg-white">
            <div className="flex flex-col gap-3 border-b border-[#e8e8e8] px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-base font-semibold text-[#111]" id="stores-title">{t('Store summary')}</h2>
                <p className="mt-0.5 text-xs text-[#5f6368]">
                  {townFilter === 'all'
                    ? (network.sorted.length === 1 ? t('1 store') : t('{count} stores', { count: network.sorted.length }))
                    : t('{count} in {town}', { count: network.sorted.length, town: townFilter })}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                {towns.length > 1 && (
                  <div aria-labelledby="stores-town-label" className="flex h-9 flex-wrap border border-[#d1d5db]" role="group">
                    <span className="sr-only" id="stores-town-label">{t('Filter by town')}</span>
                    {[{ value: 'all', label: t('All towns') }, ...towns.map((town) => ({ value: town, label: town }))].map((option) => {
                      const selected = townFilter === option.value
                      return (
                        <button
                          aria-pressed={selected}
                          className={`px-3 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#472a3b] ${selected ? 'bg-[#111] text-white' : 'bg-white text-[#5f6368] hover:text-[#111]'}`}
                          key={option.value}
                          onClick={() => setTownFilter(option.value)}
                          type="button"
                        >
                          {option.label}
                        </button>
                      )
                    })}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[#5f6368]" id="stores-sort-label">{t('Sort by')}</span>
                  <div aria-labelledby="stores-sort-label" className="flex h-9 flex-wrap border border-[#d1d5db]" role="group">
                    {sortOptions.map((option) => {
                      const selected = sortKey === option.key
                      return (
                        <button
                          aria-pressed={selected}
                          className={`px-3 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#472a3b] ${selected ? 'bg-[#111] text-white' : 'bg-white text-[#5f6368] hover:text-[#111]'}`}
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
              <p className="border-t border-dashed border-[#e8e8e8] px-4 py-10 text-sm text-[#5f6368]">{t('No stores found.')}</p>
            ) : (
              <ul>
                <li className="hidden px-4 py-2.5 text-xs font-medium text-[#5f6368] @[48rem]:grid @[48rem]:grid-cols-[minmax(13rem,1.4fr)_minmax(8rem,0.85fr)_minmax(9.5rem,1fr)_minmax(5.5rem,0.55fr)_minmax(6rem,0.6fr)]">
                  <span>{t('Store')}</span>
                  <span className="text-right">{t('Paid sales')}</span>
                  <span>{t('Rating')}</span>
                  <span className="text-right">{t('Customers')}</span>
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
                    isLeader={network.leader?.id === store.id && network.totals.sales > 0}
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
            />
          )}
        </>
      )}
    </div>
  )
}

function StoreRow({
  store,
  share,
  language,
  t,
  onSelect,
  isSelected,
  isLeader,
  rank,
}: {
  store: StoreSummary
  share: number
  language: string
  t: Translate
  onSelect: () => void
  isSelected: boolean
  isLeader: boolean
  rank: number
}) {
  const waitingTotal = waitingCount(store)

  return (
    <li className="border-t border-[#f2f2f2]">
      <button
        aria-current={isSelected ? 'true' : undefined}
        className={`grid w-full gap-4 px-4 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#472a3b] @[48rem]:grid-cols-[minmax(13rem,1.4fr)_minmax(8rem,0.85fr)_minmax(9.5rem,1fr)_minmax(5.5rem,0.55fr)_minmax(6rem,0.6fr)] @[48rem]:items-center ${
          isSelected ? 'bg-[#f4f6f8]' : 'bg-white hover:bg-[#fafafa]'
        }`}
        onClick={onSelect}
        type="button"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="w-5 shrink-0 text-center text-xs font-medium tabular-nums text-[#5f6368]">{rank}</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-[#111]">{store.area || store.name}</h3>
              {!store.isActive && (
                <span className="inline-flex items-center bg-[#f4f6f8] px-2 py-0.5 text-[11px] font-medium text-[#5f6368]">
                  {t('Not taking orders')}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-[13px] text-[#5f6368]">{store.town}</p>
          </div>
        </div>

        <div className="min-w-0 @[48rem]:text-right">
          <p className="text-xs font-medium text-[#5f6368] @[48rem]:sr-only">{t('Paid sales')}</p>
          <p className="text-sm font-semibold tabular-nums tracking-tight text-[#111]">
            {formatXaf(store.sales, language)}
          </p>
          <div aria-hidden="true" className="mt-2 h-0.5 overflow-hidden bg-[#e8e8e8] @[48rem]:ml-auto @[48rem]:max-w-[7.5rem]">
            <div
              className={`h-full ${isLeader ? 'bg-[#472a3b]' : 'bg-[#c7c7c7]'}`}
              style={{ width: `${Math.max(share > 0 ? 4 : 0, share * 100)}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-[#5f6368]">
            {store.paidOrderCount
              ? `${t('{count} paid', { count: formatCount(store.paidOrderCount, language) })} · ${formatShare(share)}`
              : t('No orders yet')}
          </p>
        </div>

        <div className="min-w-0">
          <p className="text-xs font-medium text-[#5f6368] @[48rem]:sr-only">{t('Rating')}</p>
          <StarRating language={language} reviews={store.reviewCount} t={t} value={store.averageRating} />
        </div>

        <div className="min-w-0 @[48rem]:text-right">
          <p className="text-xs font-medium text-[#5f6368] @[48rem]:sr-only">{t('Customers')}</p>
          <p className="text-sm font-semibold tabular-nums text-[#111]">{formatCount(store.customerCount, language)}</p>
        </div>

        <div className="min-w-0 @[48rem]:text-right">
          <p className="text-xs font-medium text-[#5f6368] @[48rem]:sr-only">{t('Waiting')}</p>
          {waitingTotal > 0 ? (
            <p className="inline-flex items-center bg-[#fff8e8] px-2 py-0.5 text-[11px] font-medium text-[#7a4e00]">
              {waitingTotal === 1 ? t('1 item waiting') : t('{count} items waiting', { count: waitingTotal })}
            </p>
          ) : (
            <p className="text-xs text-[#5f6368]">—</p>
          )}
        </div>
      </button>
    </li>
  )
}

function StoreDetailDrawer({
  store,
  share,
  language,
  t,
  onClose,
}: {
  store: StoreSummary
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
        className="admin-drawer-backdrop absolute inset-0 bg-[#111]/40"
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />
      <section
        aria-labelledby="store-drawer-title"
        aria-modal="true"
        className="admin-drawer-panel relative flex h-full w-full max-w-[32rem] flex-col border-l border-[#e8e8e8] bg-white"
        role="dialog"
      >
        <header className="border-b border-[#e8e8e8] px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-[#111]" id="store-drawer-title">
                  {store.name}
                </h2>
                {!store.isActive && (
                  <span className="inline-flex items-center bg-[#f4f6f8] px-2 py-0.5 text-[11px] font-medium text-[#5f6368]">
                    {t('Not taking orders')}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-[#5f6368]">{store.town} · {store.area}</p>
            </div>
            <button
              aria-label={t('Close')}
              className="grid size-9 shrink-0 place-items-center text-[#5f6368] transition hover:bg-[#f4f6f8] hover:text-[#111]"
              onClick={onClose}
              type="button"
            >
              <AdminIcon className="size-5" path={icons.close} />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <section className="grid gap-px bg-[#e8e8e8] sm:grid-cols-2">
            <div className="bg-white p-4">
              <h3 className="text-xs font-medium text-[#5f6368]">{t('Address')}</h3>
              <p className="mt-2 flex items-start gap-2 text-sm font-semibold text-[#111]">
                <AdminIcon className="mt-0.5 size-4 shrink-0 text-[#5f6368]" path={icons.pin} />
                <span>{address || t('No address provided')}</span>
              </p>
            </div>
            <div className="bg-white p-4">
              <h3 className="text-xs font-medium text-[#5f6368]">{t('Phone')}</h3>
              {store.phone ? (
                <a className="mt-2 flex items-center gap-1.5 text-sm font-medium text-[#472a3b] hover:underline" href={`tel:${store.phone}`}>
                  <AdminIcon className="size-3.5 shrink-0" path={icons.phone} />
                  {store.phone}
                </a>
              ) : (
                <p className="mt-2 text-sm text-[#5f6368]">—</p>
              )}
            </div>
            <div className="bg-white p-4 sm:col-span-2">
              <h3 className="text-xs font-medium text-[#5f6368]">{t('Pickup & delivery')}</h3>
              <p className="mt-2 flex items-start gap-2 text-sm font-semibold text-[#111]">
                <AdminIcon className="mt-0.5 size-4 shrink-0 text-[#5f6368]" path={icons.truck} />
                <span>
                  {fulfillmentLabel(store, t)}
                  {store.deliveryEnabled && store.deliveryFee > 0
                    ? ` · ${t('Delivery fee')}: ${formatXaf(store.deliveryFee, language)}`
                    : ''}
                </span>
              </p>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-medium text-[#5f6368]">{t('Sales')}</h3>
            <dl className="mt-2 space-y-2 text-sm">
              <div className="flex items-end justify-between gap-3 border-b border-[#e8e8e8] pb-3">
                <dt className="font-semibold text-[#111]">{t('Paid sales')}</dt>
                <dd className="text-2xl font-semibold tabular-nums tracking-tight text-[#111]">{formatXaf(store.sales, language)}</dd>
              </div>
              <p className="text-xs text-[#5f6368]">
                {networkShareLabel(share, t)}
                <span aria-hidden="true" className="mx-1.5">·</span>
                {t('{count} paid', { count: formatCount(store.paidOrderCount, language) })}
              </p>
            </dl>
            <dl className="mt-4 grid grid-cols-2 gap-px bg-[#e8e8e8]">
              <div className="bg-white p-4">
                <dt className="text-xs font-medium text-[#5f6368]">{t('Customers')}</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums text-[#111]">{formatCount(store.customerCount, language)}</dd>
              </div>
              <div className="bg-white p-4">
                <dt className="text-xs font-medium text-[#5f6368]">{t('Average rating')}</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums text-[#111]">
                  {store.reviewCount ? `${store.averageRating.toFixed(1)} / 5` : '—'}
                </dd>
              </div>
              <div className="bg-white p-4 sm:col-span-2">
                <dt className="text-xs font-medium text-[#5f6368]">{t('Latest order')}</dt>
                <dd className="mt-1 text-sm font-medium text-[#111]" title={lastOrder ? fullDate(lastOrder, language) : undefined}>
                  {lastOrder ? relativeTime(lastOrder, language) : t('No orders yet')}
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-xs font-medium text-[#5f6368]">{t('Waiting on this store')}</h3>
              {waitingTotal > 0 && (
                <span className="text-xs font-medium text-[#7a4e00]">
                  {waitingTotal === 1 ? t('1 item waiting') : t('{count} items waiting', { count: waitingTotal })}
                </span>
              )}
            </div>
            {waiting.length ? (
              <ul className="mt-2 divide-y divide-[#f2f2f2] border border-[#e8e8e8]">
                {waiting.map((row) => (
                  <li key={row.key}>
                    <Link
                      className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium text-[#111] transition hover:bg-[#fafafa]"
                      onClick={onClose}
                      to={row.to}
                    >
                      <span className="inline-flex items-center gap-2">
                        <AdminIcon className="size-4 text-[#5f6368]" path={row.key === 'orders' ? icons.receipt : row.key === 'events' ? icons.calendar : row.key === 'cakes' ? icons.cake : icons.chat} />
                        {row.label}
                      </span>
                      <AdminIcon className="size-3.5 shrink-0 text-[#5f6368]" path={icons.chevron} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 border border-dashed border-[#e8e8e8] px-3 py-3 text-sm text-[#5f6368]">
                {t('Nothing is waiting here.')}
              </p>
            )}
          </section>
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-[#e8e8e8] bg-white px-5 py-3">
          <button className="h-9 px-3 text-sm font-medium text-[#5f6368] transition hover:bg-[#f4f6f8] hover:text-[#111]" onClick={onClose} type="button">
            {t('Close')}
          </button>
          <Link
            className="inline-flex h-9 items-center gap-2 bg-[#111] px-4 text-sm font-semibold text-white transition hover:bg-[#472a3b]"
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
