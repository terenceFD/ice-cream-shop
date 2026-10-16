import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../../api/api'
import { useAdminAuth } from './useAdminAuth'
import { useLanguage } from '../../language/useLanguage'

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

function formatXaf(value: number, language: string) {
  return `${new Intl.NumberFormat(language === 'fr' ? 'fr-CM' : 'en-CM').format(Number(value || 0))} FCFA`
}

function formatDate(value: string | null, language: string) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(language === 'fr' ? 'fr-CM' : 'en-CM', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function Metric({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-[#f7f9fc] px-3.5 py-3">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#8190a1]">{label}</p>
      <p className={`mt-1 font-display text-lg font-extrabold tabular-nums ${accent ? 'text-[#8a7000]' : 'text-[#092a53]'}`}>{value}</p>
    </div>
  )
}

export function AdminStoresPage() {
  const { sessionToken } = useAdminAuth()
  const { t, language } = useLanguage()
  const [stores, setStores] = useState<StoreSummary[] | null>(null)
  const [error, setError] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)

  const refresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const result = await apiRequest<{ stores: StoreSummary[] }>('/admin/stores', { token: sessionToken })
      setStores(result.stores)
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('Unable to load store summaries.'))
    } finally {
      setIsRefreshing(false)
    }
  }, [sessionToken, t])

  useEffect(() => {
    refresh()
    const timer = window.setInterval(refresh, 60_000)
    return () => window.clearInterval(timer)
  }, [refresh])

  const totals = useMemo(() => (stores || []).reduce((summary, store) => ({
    orders: summary.orders + store.orderCount,
    sales: summary.sales + store.sales,
    needsAction: summary.needsAction + store.openOrderCount + store.eventNeedsActionCount + store.newCakeRequestCount + store.pendingReviewCount,
  }), { orders: 0, sales: 0, needsAction: 0 }), [stores])

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#8a7000]">{t('Store network')}</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold text-[#092a53]">{t('Stores')}</h1>
          <p className="mt-1 text-sm text-[#65748a]">{t('A store-by-store view of sales, orders, customers, reviews and requests.')}</p>
        </div>
        <button
          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-[#355777] ring-1 ring-[#dce4ed] transition hover:bg-[#f7f9fc] disabled:cursor-wait disabled:opacity-60"
          disabled={isRefreshing}
          onClick={refresh}
          type="button"
        >
          <svg aria-hidden="true" className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24">
            <path d="M4 12a8 8 0 0 1 13.7-5.7L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.7L4 15.5M4 20v-4.5h4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          </svg>
          {t('Refresh')}
        </button>
      </header>

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100" role="alert">
          <span>{error}</span>
          <button className="font-extrabold underline underline-offset-2" onClick={refresh} type="button">{t('Try again')}</button>
        </div>
      )}

      {stores === null ? (
        <div aria-label={t('Loading…')} className="grid gap-4 md:grid-cols-2" role="status">
          {[0, 1, 2, 3].map((item) => <div className="h-72 animate-pulse rounded-[20px] bg-white ring-1 ring-[#e5ebf3]" key={item} />)}
        </div>
      ) : (
        <>
          <section aria-label={t('Network summary')} className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Metric label={t('Stores in view')} value={stores.length} />
            <Metric label={t('Total orders')} value={totals.orders} />
            <Metric label={t('Paid sales')} value={formatXaf(totals.sales, language)} accent />
            <Metric label={t('Items needing attention')} value={totals.needsAction} />
          </section>

          {!stores.length ? (
            <div className="rounded-[20px] border border-dashed border-[#d9e1ea] bg-white px-6 py-14 text-center">
              <p className="font-display text-lg font-extrabold text-[#092a53]">{t('No stores found.')}</p>
              <p className="mt-1 text-sm text-[#65748a]">{t('Stores in your assigned access area will appear here.')}</p>
            </div>
          ) : (
            <section aria-label={t('Store summaries')} className="grid gap-4 xl:grid-cols-2">
              {stores.map((store) => {
                const lastOrder = formatDate(store.lastOrderAt, language)
                return (
                  <article className="overflow-hidden rounded-[20px] border border-[#e5ebf3] bg-white shadow-[0_8px_22px_rgba(18,44,80,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-[#cbd8e6] hover:shadow-[0_14px_30px_rgba(16,44,80,0.09)] motion-reduce:transform-none motion-reduce:transition-none" key={store.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#edf1f5] px-5 py-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#edf3fa] text-[#245281]">
                          <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
                            <path d="M4 10h16l-1.5-5h-13L4 10Zm0 0v10h16V10M9 20v-5h6v5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                          </svg>
                        </span>
                        <div className="min-w-0">
                          <h2 className="truncate font-display text-lg font-extrabold text-[#092a53]">{store.name}</h2>
                          <p className="mt-0.5 truncate text-xs font-semibold text-[#65748a]">{store.town} · {store.area}</p>
                        </div>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] ${store.isActive ? 'bg-[#eaf6ee] text-[#1f6b3e]' : 'bg-[#fff0ed] text-[#a43d31]'}`}>
                        {t(store.isActive ? 'Active' : 'Inactive')}
                      </span>
                    </div>
                    <div className="space-y-4 p-5">
                      <div className="flex flex-wrap gap-2 text-xs font-semibold text-[#65748a]">
                        <span className="rounded-full bg-[#f3f6fa] px-3 py-1.5">{store.location}</span>
                        {store.phone && <a className="rounded-full bg-[#f3f6fa] px-3 py-1.5 transition-colors hover:bg-[#e8eef5] hover:text-[#092a53] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00]" href={`tel:${store.phone}`}>{store.phone}</a>}
                        <span className="rounded-full bg-[#f3f6fa] px-3 py-1.5">{store.pickupEnabled ? t('Pickup') : ''}{store.pickupEnabled && store.deliveryEnabled ? ' · ' : ''}{store.deliveryEnabled ? t('Delivery') : ''}{!store.pickupEnabled && !store.deliveryEnabled ? t('No fulfillment enabled') : ''}</span>
                      </div>
                      <p className="truncate text-xs text-[#8190a1]" title={store.address}>{store.address || t('No address provided')}</p>

                      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                        <Metric label={t('Total orders')} value={store.orderCount} />
                        <Metric label={t('Paid sales')} value={formatXaf(store.sales, language)} accent />
                        <Metric label={t('Open orders')} value={store.openOrderCount} />
                        <Metric label={t('Customers')} value={store.customerCount} />
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                        <Metric label={t('Event orders')} value={store.eventOrderCount} />
                        <Metric label={t('New cake requests')} value={store.newCakeRequestCount} />
                        <Metric label={t('Pending reviews')} value={store.pendingReviewCount} />
                        <Metric label={t('Average rating')} value={store.reviewCount ? `${store.averageRating.toFixed(1)} / 5` : '—'} />
                      </div>
                      <div className="flex flex-wrap justify-between gap-2 border-t border-[#edf1f5] pt-3 text-[11px] font-semibold text-[#8190a1]">
                        <span>{t('{count} paid orders', { count: store.paidOrderCount })}</span>
                        <span>{t('{count} event orders need action', { count: store.eventNeedsActionCount })}</span>
                        <span>{t('{count} cake requests', { count: store.cakeRequestCount })}</span>
                        <span>{t('{count} customer reviews', { count: store.reviewCount })}</span>
                        {lastOrder && <span>{t('Latest order')}: {lastOrder}</span>}
                      </div>
                    </div>
                  </article>
                )
              })}
            </section>
          )}
        </>
      )}
    </div>
  )
}
