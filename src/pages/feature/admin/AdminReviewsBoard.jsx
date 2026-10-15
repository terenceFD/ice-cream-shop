import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../../../api/api'
import { useLanguage } from '../../../language/useLanguage'
import { useAdminAuth } from './useAdminAuth'

const inputClassName =
  'w-full rounded-xl border border-[#dde4ec] bg-[#f8fafc] px-3.5 py-2.5 text-sm font-medium text-[#102c50] transition placeholder:text-[#9aa5b3] hover:border-[#c9d4e0] focus:border-[#bd9c00] focus:bg-white focus:ring-4 focus:ring-[#ffdc32]/25 outline-none!'
const STAR_PATH = 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7L12 3Z'

const icons = {
  chat: 'M4 5h16v11H9l-5 4V5Zm4 5h8m-8 3h5',
  refresh: 'M4 12a8 8 0 0 1 13.7-5.7L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.7L4 15.5M4 20v-4.5h4.5',
  search: 'm20 20-4.2-4.2M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z',
  clock: 'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  checks: 'm2 12.5 4.5 4.5L16 7.5m-2 9.5 1 1L22 7.5',
  eyeOff: 'M3 3l18 18M10.6 5.1A9.7 9.7 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-2.6 3.4M6.6 6.6C3.9 8.3 2.5 12 2.5 12S6 19 12 19a9 9 0 0 0 4.4-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2',
  alert: 'M12 8v5m0 3.5v.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  close: 'M6 6l12 12M18 6 6 18',
  scoop: 'M7 10a5 5 0 0 1 10 0M6 10h12l-6 11-6-11Z',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6',
  mail: 'M4 6h16v12H4V6Zm0 0 8 7 8-7',
  quote: 'M9 7H5v6h4v4l3-4V7H9Zm10 0h-4v6h4v4l3-4V7h-3Z',
}

function Icon({ path, className = 'size-4' }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d={path} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  )
}

function Stars({ rating, className = 'size-4' }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg aria-hidden="true" className={`${className} ${star <= rating ? 'text-[#f5b800]' : 'text-[#e2e8f0]'}`} fill="currentColor" key={star} viewBox="0 0 24 24">
          <path d={STAR_PATH} />
        </svg>
      ))}
    </span>
  )
}

function parseDate(value) {
  if (!value) return null
  const date = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(String(value)) ? String(value) : `${String(value).replace(' ', 'T')}Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

function relativeTime(value, language) {
  const date = parseDate(value)
  if (!date) return ''
  const seconds = Math.round((date.getTime() - Date.now()) / 1000)
  const formatter = new Intl.RelativeTimeFormat(language === 'fr' ? 'fr' : 'en', { numeric: 'auto' })
  const abs = Math.abs(seconds)
  if (abs < 3600) return formatter.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return formatter.format(Math.round(seconds / 3600), 'hour')
  if (abs < 86400 * 30) return formatter.format(Math.round(seconds / 86400), 'day')
  return date.toLocaleDateString(language === 'fr' ? 'fr-CM' : 'en-CM', { dateStyle: 'medium' })
}

function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || '?'
}

const avatarTones = ['bg-[#e9f1fa] text-[#245281]', 'bg-[#fff4c2] text-[#7a6300]', 'bg-[#e5f4ea] text-[#2c7a4f]', 'bg-[#efe9fb] text-[#5b3fa0]', 'bg-[#fdecea] text-[#a53f37]']

function avatarTone(name) {
  const sum = [...String(name)].reduce((total, character) => total + character.charCodeAt(0), 0)
  return avatarTones[sum % avatarTones.length]
}

export function AdminReviewsBoard() {
  const { sessionToken } = useAdminAuth()
  const request = useCallback((path, options = {}) => apiRequest(path, { ...options, token: sessionToken }), [sessionToken])
  const { t, language } = useLanguage()
  const [pendingReviews, setPendingReviews] = useState([])
  const [approvedReviews, setApprovedReviews] = useState([])
  const [showApproved, setShowApproved] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [updatingIds, setUpdatingIds] = useState([])
  const [search, setSearch] = useState('')
  const [ratingFilter, setRatingFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [bulkProgress, setBulkProgress] = useState(null)
  const [isConfirmingBulk, setIsConfirmingBulk] = useState(false)

  const refresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const [pending, approved] = await Promise.all([
        request('/admin/reviews?status=pending'),
        request('/admin/reviews?status=approved'),
      ])
      setPendingReviews(pending.reviews)
      setApprovedReviews(approved.reviews)
      setError('')
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [request])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    if (!message) return undefined
    const timer = window.setTimeout(() => setMessage(''), 4000)
    return () => window.clearTimeout(timer)
  }, [message])

  useEffect(() => {
    if (!isConfirmingBulk) return undefined
    function handleKeyDown(event) {
      if (event.key === 'Escape') setIsConfirmingBulk(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isConfirmingBulk])

  const reviews = showApproved ? approvedReviews : pendingReviews

  function moveReview(review, isApproved) {
    const updated = { ...review, isApproved }
    if (isApproved) {
      setPendingReviews((current) => current.filter((entry) => entry.id !== review.id))
      setApprovedReviews((current) => [updated, ...current.filter((entry) => entry.id !== review.id)])
    } else {
      setApprovedReviews((current) => current.filter((entry) => entry.id !== review.id))
      setPendingReviews((current) => [updated, ...current.filter((entry) => entry.id !== review.id)])
    }
  }

  async function setApproval(review, isApproved) {
    setError('')
    setMessage('')
    setUpdatingIds((current) => [...current, review.id])
    try {
      await request(`/admin/reviews/${review.id}/approval`, { method: 'PATCH', body: { isApproved } })
      moveReview(review, isApproved)
      setMessage(t(isApproved ? 'Review approved successfully.' : 'Review unpublished successfully.'))
    } catch (updateError) {
      setError(updateError.message)
    } finally {
      setUpdatingIds((current) => current.filter((id) => id !== review.id))
    }
  }

  const normalizedSearch = search.trim().toLowerCase()
  const visibleReviews = useMemo(() => reviews
    .filter((review) => {
      const matchesSearch = !normalizedSearch || [review.itemName, review.customerName, review.customerEmail, review.orderId, review.review]
        .some((value) => String(value || '').toLowerCase().includes(normalizedSearch))
      const matchesRating = ratingFilter === 'all' || Number(review.rating) === Number(ratingFilter)
      return matchesSearch && matchesRating
    })
    .sort((a, b) => {
      if (sortBy === 'highest') return b.rating - a.rating
      if (sortBy === 'lowest') return a.rating - b.rating
      const aTime = parseDate(a.createdAt)?.getTime() || 0
      const bTime = parseDate(b.createdAt)?.getTime() || 0
      return sortBy === 'oldest' ? aTime - bTime : bTime - aTime
    }), [normalizedSearch, ratingFilter, reviews, sortBy])

  async function approveAllVisible() {
    const targets = visibleReviews
    setIsConfirmingBulk(false)
    setError('')
    setMessage('')
    setBulkProgress({ done: 0, total: targets.length })
    let approved = 0
    for (const review of targets) {
      try {
        await request(`/admin/reviews/${review.id}/approval`, { method: 'PATCH', body: { isApproved: true } })
        moveReview(review, true)
        approved += 1
      } catch (updateError) {
        setError(updateError.message)
        break
      } finally {
        setBulkProgress({ done: approved, total: targets.length })
      }
    }
    setBulkProgress(null)
    if (approved) setMessage(t('{count} reviews approved.', { count: approved }))
  }

  const distribution = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: reviews.filter((review) => Number(review.rating) === rating).length,
  }))
  const maxBucket = Math.max(1, ...distribution.map((bucket) => bucket.count))
  const averageOf = (list) => (list.length ? list.reduce((total, review) => total + Number(review.rating || 0), 0) / list.length : 0)
  const publishedAverage = averageOf(approvedReviews)
  const viewAverage = averageOf(reviews)
  const fiveStarShare = approvedReviews.length ? Math.round((approvedReviews.filter((review) => review.rating === 5).length / approvedReviews.length) * 100) : 0
  const hasActiveFilters = Boolean(normalizedSearch || ratingFilter !== 'all')

  const metrics = [
    { label: 'Awaiting approval', value: pendingReviews.length.toLocaleString(), icon: icons.clock, accent: 'bg-[#fff1dc] text-[#a86a00]', onClick: () => setShowApproved(false), active: !showApproved },
    { label: 'Published', value: approvedReviews.length.toLocaleString(), icon: icons.check, accent: 'bg-[#e5f4ea] text-[#2c7a4f]', onClick: () => setShowApproved(true), active: showApproved },
    { label: 'Average rating', value: approvedReviews.length ? publishedAverage.toFixed(1) : '—', icon: STAR_PATH, accent: 'bg-[#fff4c2] text-[#a48700]', hint: t('Published reviews') },
    { label: '5-star reviews', value: approvedReviews.length ? `${fiveStarShare}%` : '—', icon: icons.chat, accent: 'bg-[#e9f1fa] text-[#315982]', hint: t('Of published reviews') },
  ]

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-col gap-5 border-b border-[#edf1f5] pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="relative grid size-14 shrink-0 place-items-center rounded-2xl bg-[#092a53] text-[#ffdc32]">
            <Icon className="size-7" path={icons.chat} />
            {pendingReviews.length > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#e0a100] px-1 text-[10px] font-extrabold text-white ring-2 ring-white">{pendingReviews.length}</span>
            )}
          </span>
          <div className="min-w-0">
            <nav aria-label={t('Breadcrumb')} className="text-[11px] font-bold text-[#8190a1]">
              {t('Review management')} <span aria-hidden="true" className="mx-1">/</span>
              <span className="text-[#a48700]">{t('Customer reviews')}</span>
            </nav>
            <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-[#092a53] sm:text-[1.9rem]">{t('Customer reviews')}</h1>
            <p className="mt-0.5 max-w-2xl text-sm text-[#65748a]">{t('Review customer feedback, approve what is ready to publish, and manage live reviews.')}</p>
          </div>
        </div>
        <button
          className="inline-flex min-h-10 items-center gap-2 self-start rounded-xl border border-[#dce5ef] bg-white px-4 text-sm font-bold text-[#355777] transition hover:border-[#bacbdc] hover:bg-[#f6f9fc] hover:text-[#092a53] disabled:cursor-wait disabled:opacity-60 xl:self-auto"
          disabled={isRefreshing || bulkProgress !== null}
          onClick={refresh}
          type="button"
        >
          <Icon className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} path={icons.refresh} />
          {t('Refresh')}
        </button>
      </header>

      {message && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-[#eaf6ee] px-4 py-3 text-sm font-semibold text-[#1f5d3c] ring-1 ring-[#cfe8d8]" role="status">
          <span className="flex items-center gap-2"><Icon path={icons.check} />{message}</span>
          <button aria-label={t('Dismiss')} className="grid size-7 place-items-center rounded-lg transition hover:bg-[#d7eedf]" onClick={() => setMessage('')} type="button">
            <Icon className="size-3.5" path={icons.close} />
          </button>
        </div>
      )}
      {error && (
        <p className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100" role="alert">
          <Icon className="mt-0.5 size-4 shrink-0" path={icons.alert} />
          {error}
        </p>
      )}

      <section aria-label={t('Review overview')} className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map((metric) => {
          const body = (
            <>
              <span className={`grid size-9 place-items-center rounded-xl ${metric.accent}`}>
                {metric.icon === STAR_PATH
                  ? <svg aria-hidden="true" className="size-4" fill="currentColor" viewBox="0 0 24 24"><path d={STAR_PATH} /></svg>
                  : <Icon path={metric.icon} />}
              </span>
              <p className="mt-4 font-display text-[1.75rem] font-extrabold leading-none tracking-tight text-[#102c50]">{metric.value}</p>
              <p className="mt-1.5 text-xs font-semibold text-[#65748a]">{t(metric.label)}</p>
              {metric.hint && <p className="mt-0.5 text-[11px] text-[#a3b0bf]">{metric.hint}</p>}
            </>
          )
          return metric.onClick ? (
            <button
              aria-pressed={metric.active}
              className={`rounded-2xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(18,44,80,0.07)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] sm:p-5 ${metric.active ? 'border-[#092a53] shadow-[0_0_0_1px_#092a53]' : 'border-[#e5ebf3]'}`}
              key={metric.label}
              onClick={() => { metric.onClick(); setRatingFilter('all') }}
              type="button"
            >
              {body}
            </button>
          ) : (
            <article className="rounded-2xl border border-[#e5ebf3] bg-white p-4 sm:p-5" key={metric.label}>{body}</article>
          )
        })}
      </section>

      <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[17rem_minmax(0,1fr)]">
        <aside aria-label={t('Rating breakdown')} className="rounded-[20px] border border-[#e5ebf3] bg-white p-5 xl:sticky xl:top-24">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#8190a1]">{t(showApproved ? 'Published' : 'Awaiting approval')}</p>
          <div className="mt-3 flex items-end gap-3">
            <p className="font-display text-5xl font-extrabold leading-none text-[#092a53]">{reviews.length ? viewAverage.toFixed(1) : '—'}</p>
            <div className="pb-1">
              <Stars className="size-4" rating={Math.round(viewAverage)} />
              <p className="mt-1 text-xs text-[#8190a1]">{t('{count} reviews', { count: reviews.length })}</p>
            </div>
          </div>
          <ul className="mt-5 space-y-1.5">
            {distribution.map((bucket) => {
              const isActive = String(bucket.rating) === String(ratingFilter)
              return (
                <li key={bucket.rating}>
                  <button
                    aria-pressed={isActive}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs transition ${isActive ? 'bg-[#fffbea] ring-1 ring-[#e8c400]' : 'hover:bg-[#f6f8fb]'} disabled:cursor-default disabled:hover:bg-transparent`}
                    disabled={!bucket.count}
                    onClick={() => setRatingFilter(isActive ? 'all' : String(bucket.rating))}
                    type="button"
                  >
                    <span className="flex w-8 items-center gap-0.5 font-bold text-[#4f6379]">
                      {bucket.rating}
                      <svg aria-hidden="true" className="size-3 text-[#f5b800]" fill="currentColor" viewBox="0 0 24 24"><path d={STAR_PATH} /></svg>
                    </span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-[#f1f4f8]">
                      <span className={`block h-full rounded-full ${bucket.rating >= 4 ? 'bg-[#35a36b]' : bucket.rating === 3 ? 'bg-[#e0a100]' : 'bg-[#d2544b]'}`} style={{ width: `${(bucket.count / maxBucket) * 100}%` }} />
                    </span>
                    <span className="w-6 text-right font-bold tabular-nums text-[#8190a1]">{bucket.count}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          {ratingFilter !== 'all' && (
            <button className="mt-3 text-xs font-bold text-[#355777] underline decoration-[#ffdc32] decoration-2 underline-offset-4" onClick={() => setRatingFilter('all')} type="button">
              {t('Show all ratings')}
            </button>
          )}
        </aside>

        <section aria-labelledby="review-queue-title" className="min-w-0 rounded-[20px] border border-[#e5ebf3] bg-white">
          <div className="flex flex-col gap-4 border-b border-[#edf1f5] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div aria-label={t('Review publication status')} className="inline-flex max-w-full overflow-x-auto rounded-xl bg-[#f1f4f8] p-1" role="group">
                {[false, true].map((approved) => (
                  <button
                    aria-pressed={showApproved === approved}
                    className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${showApproved === approved ? 'bg-white text-[#092a53] shadow-sm' : 'text-[#65748a] hover:text-[#092a53]'}`}
                    key={String(approved)}
                    onClick={() => { setShowApproved(approved); setRatingFilter('all'); setMessage('') }}
                    type="button"
                  >
                    {t(approved ? 'Approved reviews' : 'Pending reviews')}
                    <span className={`rounded-full px-1.5 text-[10px] ${approved ? 'bg-[#e6ebf1] text-[#65748a]' : pendingReviews.length ? 'bg-[#e0a100] text-white' : 'bg-[#e6ebf1] text-[#65748a]'}`}>
                      {approved ? approvedReviews.length : pendingReviews.length}
                    </span>
                  </button>
                ))}
              </div>
              {!showApproved && visibleReviews.length > 1 && (
                <button
                  className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-[#092a53] px-3.5 text-xs font-bold text-white transition hover:bg-[#163e6b] disabled:cursor-wait disabled:opacity-60"
                  disabled={bulkProgress !== null}
                  onClick={() => setIsConfirmingBulk(true)}
                  type="button"
                >
                  <Icon path={icons.checks} />
                  {bulkProgress
                    ? t('Approving {done} of {total}…', bulkProgress)
                    : t('Approve all shown ({count})', { count: visibleReviews.length })}
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <label className="relative block">
                <span className="sr-only">{t('Search reviews')}</span>
                <Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#8190a1]" path={icons.search} />
                <input className={`${inputClassName} pl-10`} onChange={(event) => setSearch(event.target.value)} placeholder={t('Search by product, customer, or order')} type="search" value={search} />
              </label>
              <label className="block">
                <span className="sr-only">{t('Sort by')}</span>
                <select className={`${inputClassName} sm:w-48`} onChange={(event) => setSortBy(event.target.value)} value={sortBy}>
                  <option value="newest">{t('Sort: Newest first')}</option>
                  <option value="oldest">{t('Sort: Oldest first')}</option>
                  <option value="highest">{t('Sort: Highest rating')}</option>
                  <option value="lowest">{t('Sort: Lowest rating')}</option>
                </select>
              </label>
            </div>
            <p aria-live="polite" className="text-xs font-semibold text-[#8190a1]">
              {t('Showing {shown} of {total} reviews', { shown: visibleReviews.length, total: reviews.length })}
            </p>
          </div>

          {loading ? (
            <div className="space-y-3 p-4 sm:p-5" role="status">
              <span className="sr-only">{t('Loading reviews…')}</span>
              {[0, 1, 2].map((row) => <div aria-hidden="true" className="h-36 animate-pulse rounded-2xl bg-[#f4f7fa]" key={row} />)}
            </div>
          ) : visibleReviews.length ? (
            <ul className="divide-y divide-[#f0f3f7]">
              {visibleReviews.map((review) => {
                const isUpdating = updatingIds.includes(review.id)
                const isLow = Number(review.rating) <= 2
                return (
                  <li className={`p-4 transition hover:bg-[#fafbfd] sm:p-5 ${isUpdating ? 'opacity-50' : ''}`} key={review.id}>
                    <article className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      <span aria-hidden="true" className={`grid size-11 shrink-0 place-items-center rounded-full text-sm font-extrabold ${avatarTone(review.customerName)}`}>
                        {initials(review.customerName)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <h3 className="font-bold text-[#102c50]">{review.customerName}</h3>
                          <span aria-label={t('{rating} out of 5 stars', { rating: review.rating })} role="img"><Stars className="size-3.5" rating={Number(review.rating)} /></span>
                          <span className="text-[11px] font-semibold text-[#a3b0bf]" title={parseDate(review.createdAt)?.toLocaleString() || ''}>{relativeTime(review.createdAt, language)}</span>
                          {isLow && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#fdeeee] px-2 py-0.5 text-[10px] font-bold text-[#a53f37]">
                              <Icon className="size-3" path={icons.alert} />
                              {t('Needs attention')}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#fff6cc] px-2.5 py-1 text-[11px] font-bold text-[#7a6300]">
                            <Icon className="size-3.5" path={icons.scoop} />
                            {review.itemName}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#f1f4f8] px-2.5 py-1 text-[11px] font-bold text-[#4f6379]">
                            <Icon className="size-3.5" path={icons.receipt} />
                            {t('Order #{id}', { id: review.orderId })}
                          </span>
                        </div>
                        {review.review ? (
                          <blockquote className="relative mt-3 rounded-xl bg-[#f7f9fc] py-3 pl-10 pr-4 text-sm leading-6 text-[#3f526a] ring-1 ring-[#eef2f6]">
                            <Icon className="absolute left-3 top-3 size-5 text-[#c3cfdc]" path={icons.quote} />
                            {review.review}
                          </blockquote>
                        ) : (
                          <p className="mt-3 text-sm italic text-[#a3b0bf]">{t('No written comment.')}</p>
                        )}
                        <a className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#8190a1] hover:text-[#092a53]" href={`mailto:${review.customerEmail}`}>
                          <Icon className="size-3.5" path={icons.mail} />
                          {review.customerEmail}
                        </a>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
                        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${showApproved ? 'bg-[#eaf6ee] text-[#246a46] ring-[#cfe8d8]' : 'bg-[#fff6e5] text-[#9a6200] ring-[#f6dfb0]'}`}>
                          <span aria-hidden="true" className={`size-1.5 rounded-full ${showApproved ? 'bg-[#35a36b]' : 'bg-[#e0a100]'}`} />
                          {t(showApproved ? 'Published' : 'Awaiting approval')}
                        </span>
                        {showApproved ? (
                          <button
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-[#4f6379] ring-1 ring-[#dde4ec] transition hover:bg-[#f6f8fb] hover:text-[#092a53] disabled:cursor-wait"
                            disabled={isUpdating || bulkProgress !== null}
                            onClick={() => setApproval(review, false)}
                            type="button"
                          >
                            <Icon path={icons.eyeOff} />
                            {isUpdating ? t('Saving…') : t('Unpublish review')}
                          </button>
                        ) : (
                          <button
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#35a36b] px-3.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#2c8a59] disabled:cursor-wait"
                            disabled={isUpdating || bulkProgress !== null}
                            onClick={() => setApproval(review, true)}
                            type="button"
                          >
                            <Icon path={icons.check} />
                            {isUpdating ? t('Saving…') : t('Approve review')}
                          </button>
                        )}
                      </div>
                    </article>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="px-6 py-14 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#f1f4f8] text-[#8190a1]">
                <Icon className="size-5" path={reviews.length ? icons.search : showApproved ? icons.chat : icons.check} />
              </span>
              <p className="mt-4 font-display text-lg font-extrabold text-[#092a53]">
                {reviews.length ? t('No reviews match your filters.') : t(showApproved ? 'No approved reviews yet.' : 'No reviews are awaiting approval.')}
              </p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-[#8190a1]">
                {reviews.length ? t('Try a different search or rating filter.') : t(showApproved ? 'New customer reviews will appear here.' : 'You’re all caught up.')}
              </p>
              {hasActiveFilters && (
                <button className="mt-4 min-h-9 rounded-xl border border-[#dce5ef] px-4 text-xs font-bold text-[#355777] transition hover:bg-[#f6f9fc]" onClick={() => { setSearch(''); setRatingFilter('all') }} type="button">
                  {t('Clear filters')}
                </button>
              )}
            </div>
          )}
        </section>
      </div>

      {isConfirmingBulk && (
        <div className="fixed inset-0 z-50 grid place-items-center px-5" role="presentation">
          <button aria-label={t('Cancel')} className="admin-drawer-backdrop absolute inset-0 bg-[#0b1e36]/45 backdrop-blur-[2px]" onClick={() => setIsConfirmingBulk(false)} tabIndex={-1} type="button" />
          <section aria-labelledby="bulk-approve-title" aria-modal="true" className="admin-modal-panel relative w-full max-w-md rounded-[22px] bg-white p-6 shadow-[0_30px_80px_rgba(9,42,83,0.3)]" role="dialog">
            <span className="grid size-12 place-items-center rounded-2xl bg-[#eaf6ee] text-[#2c7a4f]"><Icon className="size-6" path={icons.checks} /></span>
            <h2 className="mt-4 font-display text-xl font-extrabold text-[#092a53]" id="bulk-approve-title">
              {t('Approve all shown ({count})', { count: visibleReviews.length })}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#65748a]">
              {t('These reviews will be published on the website right away. Make sure you have read them first.')}
            </p>
            {visibleReviews.some((review) => Number(review.rating) <= 2) && (
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-[#fff6e5] px-3 py-2.5 text-xs font-semibold text-[#8a5a00]">
                <Icon className="mt-0.5 size-3.5 shrink-0" path={icons.alert} />
                {t('Some of these reviews have 1 or 2 stars.')}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2.5">
              <button className="min-h-10 rounded-xl px-4 text-sm font-bold text-[#4f6379] transition hover:bg-[#eef2f6]" onClick={() => setIsConfirmingBulk(false)} type="button">{t('Cancel')}</button>
              <button className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#35a36b] px-4 text-sm font-bold text-white transition hover:bg-[#2c8a59]" onClick={approveAllVisible} type="button">
                <Icon path={icons.checks} />
                {t('Approve')}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
