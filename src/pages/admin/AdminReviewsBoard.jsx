import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../../api/api'
import { useLanguage } from '../../language/useLanguage'
import { useAdminAuth } from './useAdminAuth'

const inputClassName =
  'w-full rounded-lg border border-[#dce3eb] bg-white px-3 py-2 text-sm font-medium text-[#092a53] transition placeholder:text-[#65748a] hover:border-[#bac7d5] focus:border-[#bd9c00] focus:ring-2 focus:ring-[#ffdc32]/25 outline-none!'
const STAR_PATH = 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7L12 3Z'

const icons = {
  chat: 'M4 5h16v11H9l-5 4V5Zm4 5h8m-8 3h5',
  refresh: 'M4 12a8 8 0 0 1 13.7-5.7L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.7L4 15.5M4 20v-4.5h4.5',
  search: 'm20 20-4.2-4.2M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z',
  clock: 'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  checks: 'm2 12.5 4.5 4.5L16 7.5m-2 9.5 1 1L22 7.5',
  trash: 'M4 7h16m-10 4v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3',
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
  const [reviewToReject, setReviewToReject] = useState(null)
  const [deletingReviewId, setDeletingReviewId] = useState(null)

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

  useEffect(() => {
    refresh()
    const interval = window.setInterval(() => {
      if (!document.hidden) refresh()
    }, 30_000)
    function handleVisibilityChange() {
      if (!document.hidden) refresh()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [refresh])

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

  async function rejectReview() {
    if (!reviewToReject) return
    const review = reviewToReject
    setError('')
    setMessage('')
    setDeletingReviewId(review.id)
    try {
      await request(`/admin/reviews/${review.id}`, { method: 'DELETE' })
      setPendingReviews((current) => current.filter((entry) => entry.id !== review.id))
      setApprovedReviews((current) => current.filter((entry) => entry.id !== review.id))
      setReviewToReject(null)
      setMessage(t('Review rejected and deleted.'))
    } catch (deleteError) {
      setError(deleteError.message)
    } finally {
      setDeletingReviewId(null)
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
  const averageOf = (list) => (list.length ? list.reduce((total, review) => total + Number(review.rating || 0), 0) / list.length : 0)
  const publishedAverage = averageOf(approvedReviews)
  const fiveStarShare = approvedReviews.length ? Math.round((approvedReviews.filter((review) => review.rating === 5).length / approvedReviews.length) * 100) : 0
  const hasActiveFilters = Boolean(normalizedSearch || ratingFilter !== 'all')

  const metrics = [
    { label: 'Average rating', value: approvedReviews.length ? publishedAverage.toFixed(1) : '—', hint: t('Published reviews') },
    { label: '5-star reviews', value: approvedReviews.length ? `${fiveStarShare}%` : '—', hint: t('Of published reviews') },
  ]

  return (
    <div className="min-w-0 space-y-4">
      <header className="flex items-start justify-between gap-3 border-b border-[#dce3eb] pb-4 sm:items-end sm:pb-5">
        <div className="min-w-0 flex-1">
          <nav aria-label={t('Breadcrumb')} className="hidden text-xs font-medium text-[#65748a] sm:block">
            {t('Review management')} <span aria-hidden="true" className="mx-1.5 text-[#a3b0bf]">/</span>
            <span className="font-semibold text-[#123b68]">{t('Customer reviews')}</span>
          </nav>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-[#092a53]">{t('Customer reviews')}</h1>
          <p aria-label={t('Review overview')} className="mt-1 text-xs font-medium text-[#65748a] sm:hidden">
            {t('Average rating')} <span className="font-semibold text-[#092a53]">{approvedReviews.length ? publishedAverage.toFixed(1) : '—'}</span>
            <span aria-hidden="true" className="mx-1.5 text-[#a3b0bf]">·</span>
            {t('5-star reviews')} <span className="font-semibold text-[#092a53]">{approvedReviews.length ? `${fiveStarShare}%` : '—'}</span>
          </p>
          <p className="mt-1 hidden max-w-2xl text-sm leading-5 text-[#65748a] sm:block">{t('Review customer feedback, approve what is ready to publish, and manage live reviews.')}</p>
        </div>
        <button
          aria-label={t('Refresh')}
          className="inline-flex min-h-10 min-w-10 items-center justify-center gap-2 rounded-lg border border-[#dce3eb] bg-white px-2.5 text-sm font-semibold text-[#123b68] transition hover:border-[#bacbdc] hover:bg-[#f4f6f8] hover:text-[#092a53] disabled:cursor-wait disabled:opacity-60 sm:min-w-0 sm:px-3.5"
          disabled={isRefreshing || bulkProgress !== null}
          onClick={refresh}
          type="button"
        >
          <Icon className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} path={icons.refresh} />
          <span className="hidden sm:inline">{t('Refresh')}</span>
        </button>
      </header>

      {message && (
        <div className="flex items-center justify-between gap-3 rounded-md bg-[#eaf6ee] px-4 py-3 text-sm font-semibold text-[#1f5d3c] ring-1 ring-[#cfe8d8]" role="status">
          <span className="flex items-center gap-2"><Icon path={icons.check} />{message}</span>
          <button aria-label={t('Dismiss')} className="grid size-7 place-items-center rounded-lg transition hover:bg-[#d7eedf]" onClick={() => setMessage('')} type="button">
            <Icon className="size-3.5" path={icons.close} />
          </button>
        </div>
      )}
      {error && (
        <p className="flex items-start gap-2 rounded-md bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100" role="alert">
          <Icon className="mt-0.5 size-4 shrink-0" path={icons.alert} />
          {error}
        </p>
      )}

      <section aria-label={t('Review overview')} className="hidden grid-cols-2 divide-x divide-[#dce3eb] overflow-hidden rounded-md border border-[#dce3eb] bg-[#fbfcfe] sm:grid">
        {metrics.map((metric) => {
          const body = (
            <div className="flex min-h-16 flex-col justify-center gap-1.5 px-3 py-2.5 sm:min-h-[76px] sm:px-4 sm:py-3">
              <p className="text-xs font-semibold leading-4 text-[#65748a] sm:text-[13px]">{t(metric.label)}</p>
              <p className="text-xl font-semibold leading-none tracking-tight text-[#092a53] tabular-nums">{metric.value}</p>
              {metric.hint && <p className="text-xs leading-4 text-[#65748a]">{metric.hint}</p>}
            </div>
          )
          return <article className="min-w-0" key={metric.label}>{body}</article>
        })}
      </section>

      <section aria-labelledby="review-queue-title" className="min-w-0">
        <h2 className="sr-only" id="review-queue-title">{t(showApproved ? 'Approved reviews' : 'Pending reviews')}</h2>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dce3eb]">
          <div aria-label={t('Review publication status')} className="flex min-w-0 max-w-full gap-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group">
            {[false, true].map((approved) => (
              <button
                aria-pressed={showApproved === approved}
                className={`inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-1 text-sm font-semibold transition ${showApproved === approved ? 'border-[#d1a900] text-[#092a53]' : 'border-transparent text-[#65748a] hover:text-[#092a53]'}`}
                key={String(approved)}
                onClick={() => { setShowApproved(approved); setRatingFilter('all'); setMessage('') }}
                type="button"
              >
                {t(approved ? 'Approved reviews' : 'Pending reviews')}
                <span className="rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums text-[#65748a]">{approved ? approvedReviews.length : pendingReviews.length}</span>
              </button>
            ))}
          </div>
          {!showApproved && visibleReviews.length > 1 && (
            <button
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#092a53] px-3.5 text-sm font-semibold text-white transition hover:bg-[#163e6b] disabled:cursor-wait disabled:opacity-60"
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

        <div className="space-y-3 pt-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2.5">
            <label className="relative block min-w-0">
              <span className="sr-only">{t('Search reviews')}</span>
              <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#65748a]" path={icons.search} />
              <input className={`${inputClassName} pl-9`} onChange={(event) => setSearch(event.target.value)} placeholder={t('Search reviews')} type="search" value={search} />
            </label>
            <label className="block min-w-0">
              <span className="sr-only">{t('Sort by')}</span>
              <select className={`${inputClassName} w-32 sm:w-44`} onChange={(event) => setSortBy(event.target.value)} value={sortBy}>
                <option value="newest">{t('Sort: Newest first')}</option>
                <option value="oldest">{t('Sort: Oldest first')}</option>
                <option value="highest">{t('Sort: Highest rating')}</option>
                <option value="lowest">{t('Sort: Lowest rating')}</option>
              </select>
            </label>
          </div>

          <div aria-label={t('Rating breakdown')} className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group">
            <button
              aria-pressed={ratingFilter === 'all'}
              className={`inline-flex min-h-9 shrink-0 items-center rounded-lg border px-2.5 text-xs font-semibold transition ${ratingFilter === 'all' ? 'border-[#d1a900] bg-[#fff9df] text-[#bd9c00]' : 'border-[#dce3eb] text-[#65748a] hover:bg-[#f4f6f8]'}`}
              onClick={() => setRatingFilter('all')}
              type="button"
            >
              {t('Show all ratings')}
            </button>
            {distribution.map((bucket) => {
              const isActive = String(bucket.rating) === String(ratingFilter)
              return (
                <button
                  aria-label={`${t('{rating} out of 5 stars', { rating: bucket.rating })}, ${t('{count} reviews', { count: bucket.count })}`}
                  aria-pressed={isActive}
                  className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold tabular-nums transition disabled:cursor-default disabled:opacity-50 ${isActive ? 'border-[#d1a900] bg-[#fff9df] text-[#bd9c00]' : 'border-[#dce3eb] text-[#65748a] hover:bg-[#f4f6f8]'}`}
                  disabled={!bucket.count}
                  key={bucket.rating}
                  onClick={() => setRatingFilter(isActive ? 'all' : String(bucket.rating))}
                  type="button"
                >
                  {bucket.rating}
                  <svg aria-hidden="true" className="size-3.5 text-[#d1a900]" fill="currentColor" viewBox="0 0 24 24"><path d={STAR_PATH} /></svg>
                  <span className="text-[#65748a]">{bucket.count}</span>
                </button>
              )
            })}
          </div>
          <p aria-live="polite" className="text-xs font-medium text-[#65748a]">
            {t('Showing {shown} of {total} reviews', { shown: visibleReviews.length, total: reviews.length })}
          </p>
        </div>

        {loading ? (
          <div className="divide-y divide-[#f4f6f8]" role="status">
            <span className="sr-only">{t('Loading reviews…')}</span>
            {[0, 1, 2].map((row) => (
              <div aria-hidden="true" className="flex gap-3 py-5" key={row}>
                <span className="size-10 shrink-0 rounded-full bg-[#e9edf2]" />
                <span className="flex-1 space-y-3 pt-1">
                  <span className="block h-4 w-40 rounded bg-[#e9edf2]" />
                  <span className="block h-3 w-56 max-w-full rounded bg-[#e9edf2]" />
                  <span className="block h-3 w-4/5 rounded bg-[#e9edf2]" />
                </span>
              </div>
            ))}
          </div>
        ) : visibleReviews.length ? (
          <ul className="divide-y divide-[#f4f6f8]">
            {visibleReviews.map((review) => {
              const isUpdating = updatingIds.includes(review.id)
              return (
                <li className={`py-5 transition-opacity ${isUpdating ? 'opacity-50' : ''}`} key={review.id}>
                  <article className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                    <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-[#f4f6f8] text-sm font-bold text-[#123b68]">
                      {initials(review.customerName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <h3 className="font-semibold text-[#092a53]">{review.customerName}</h3>
                        <span aria-label={t('{rating} out of 5 stars', { rating: review.rating })} role="img"><Stars className="size-3.5" rating={Number(review.rating)} /></span>
                        <span className="text-xs font-medium text-[#65748a]" title={parseDate(review.createdAt)?.toLocaleString() || ''}>{relativeTime(review.createdAt, language)}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-[#123b68]">
                          <Icon className="size-3.5 text-[#65748a]" path={icons.scoop} />
                          {review.itemName}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-[#65748a]">
                          <Icon className="size-3.5" path={icons.receipt} />
                          {t('Order #{id}', { id: review.orderId })}
                        </span>
                      </div>
                      {review.review ? (
                        <blockquote className="mt-3 border-l-2 border-[#d1a900] pl-3.5 text-sm leading-6 text-[#3f526a]">
                          {review.review}
                        </blockquote>
                      ) : (
                        <p className="mt-3 text-sm italic text-[#65748a]">{t('No written comment.')}</p>
                      )}
                      <a className="mt-2 inline-flex min-h-8 items-center gap-1.5 text-xs font-medium text-[#65748a] hover:text-[#092a53]" href={`mailto:${review.customerEmail}`}>
                        <Icon className="size-3.5" path={icons.mail} />
                        {review.customerEmail}
                      </a>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                      <span className={`inline-flex min-h-7 items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-xs font-semibold ${showApproved ? 'bg-[#f4f6f8] text-[#65748a]' : 'bg-[#fff6cc] text-[#705b00]'}`}>
                        <span aria-hidden="true" className={`size-1.5 rounded-full ${showApproved ? 'bg-[#65748a]' : 'bg-[#bd9c00]'}`} />
                        {t(showApproved ? 'Published' : 'Awaiting approval')}
                      </span>
                      {showApproved ? (
                        <button
                          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-[#65748a] transition hover:bg-[#f4f6f8] hover:text-[#092a53] disabled:cursor-wait sm:min-h-9"
                          disabled={isUpdating || bulkProgress !== null}
                          onClick={() => setApproval(review, false)}
                          type="button"
                        >
                          <Icon path={icons.eyeOff} />
                          {isUpdating ? t('Saving…') : t('Unpublish review')}
                        </button>
                      ) : (
                        <>
                          <button
                            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-[#092a53] px-3.5 text-xs font-semibold text-white transition hover:bg-[#163e6b] disabled:cursor-wait sm:min-h-9"
                            disabled={isUpdating || bulkProgress !== null}
                            onClick={() => setApproval(review, true)}
                            type="button"
                          >
                            <Icon path={icons.check} />
                            {isUpdating ? t('Saving…') : t('Approve review')}
                          </button>
                          <button
                            className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#e8c8c4] px-3 text-xs font-semibold text-[#a53f37] transition hover:bg-[#fff4f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d2544b] disabled:cursor-wait disabled:opacity-60 sm:min-h-9"
                            disabled={isUpdating || bulkProgress !== null}
                            onClick={() => { setError(''); setMessage(''); setReviewToReject(review) }}
                            type="button"
                          >
                            <Icon path={icons.trash} />
                            {t('Reject')}
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="py-12 text-center">
            <p className="text-sm font-semibold text-[#092a53]">
              {reviews.length ? t('No reviews match your filters.') : t(showApproved ? 'No approved reviews yet.' : 'No reviews are awaiting approval.')}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-[#65748a]">
              {reviews.length ? t('Try a different search or rating filter.') : t(showApproved ? 'New customer reviews will appear here.' : 'You’re all caught up.')}
            </p>
            {hasActiveFilters && (
              <button className="mt-4 min-h-10 rounded-lg border border-[#dce3eb] px-4 text-sm font-semibold text-[#123b68] transition hover:bg-[#f4f6f8]" onClick={() => { setSearch(''); setRatingFilter('all') }} type="button">
                {t('Clear filters')}
              </button>
            )}
          </div>
        )}
      </section>

      {isConfirmingBulk && (
        <div className="fixed inset-0 z-50 grid place-items-center px-5" role="presentation">
          <button aria-label={t('Cancel')} className="admin-drawer-backdrop absolute inset-0 bg-[#0b1e36]/45 backdrop-blur-[2px]" onClick={() => setIsConfirmingBulk(false)} tabIndex={-1} type="button" />
          <section aria-labelledby="bulk-approve-title" aria-modal="true" className="admin-modal-panel relative w-full max-w-md rounded-md bg-white p-6 shadow-[0_30px_80px_rgba(9,42,83,0.3)]" role="dialog">
            <span className="grid size-12 place-items-center rounded-md bg-[#eaf6ee] text-[#2c7a4f]"><Icon className="size-6" path={icons.checks} /></span>
            <h2 className="mt-4 text-base font-semibold text-[#092a53]" id="bulk-approve-title">
              {t('Approve all shown ({count})', { count: visibleReviews.length })}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#65748a]">
              {t('These reviews will be published on the website right away. Make sure you have read them first.')}
            </p>
            {visibleReviews.some((review) => Number(review.rating) <= 2) && (
              <p className="mt-3 flex items-start gap-2 rounded-md bg-[#fff6e5] px-3 py-2.5 text-xs font-semibold text-[#8a5a00]">
                <Icon className="mt-0.5 size-3.5 shrink-0" path={icons.alert} />
                {t('Some of these reviews have 1 or 2 stars.')}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2.5">
              <button className="min-h-10 rounded-md px-4 text-sm font-bold text-[#65748a] transition hover:bg-[#f4f6f8]" onClick={() => setIsConfirmingBulk(false)} type="button">{t('Cancel')}</button>
              <button className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[#35a36b] px-4 text-sm font-bold text-white transition hover:bg-[#2c8a59]" onClick={approveAllVisible} type="button">
                <Icon path={icons.checks} />
                {t('Approve')}
              </button>
            </div>
          </section>
        </div>
      )}
      {reviewToReject && (
        <div className="fixed inset-0 z-50 grid place-items-center px-5" role="presentation">
          <button
            aria-label={t('Cancel')}
            className="admin-drawer-backdrop absolute inset-0 bg-[#0b1e36]/45 backdrop-blur-[2px]"
            disabled={deletingReviewId === reviewToReject.id}
            onClick={() => setReviewToReject(null)}
            tabIndex={-1}
            type="button"
          />
          <section
            aria-labelledby="reject-review-title"
            aria-modal="true"
            className="admin-modal-panel relative w-full max-w-md rounded-md bg-white p-6 shadow-[0_30px_80px_rgba(9,42,83,0.3)]"
            role="dialog"
          >
            <span className="grid size-12 place-items-center rounded-md bg-red-50 text-red-600">
              <Icon className="size-6" path={icons.trash} />
            </span>
            <h2 className="mt-4 text-base font-semibold text-[#092a53]" id="reject-review-title">
              {t('Reject and delete this review?')}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#65748a]">
              {t('This will permanently delete the review from {name}. This cannot be undone.', { name: reviewToReject.customerName })}
            </p>
            {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700" role="alert">{error}</p>}
            <div className="mt-6 flex justify-end gap-2.5">
              <button
                className="min-h-10 rounded-md px-4 text-sm font-bold text-[#65748a] transition hover:bg-[#f4f6f8] disabled:opacity-60"
                disabled={deletingReviewId === reviewToReject.id}
                onClick={() => setReviewToReject(null)}
                type="button"
              >
                {t('Cancel')}
              </button>
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-md bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-wait disabled:opacity-60"
                disabled={deletingReviewId === reviewToReject.id}
                onClick={rejectReview}
                type="button"
              >
                <Icon path={icons.trash} />
                {deletingReviewId === reviewToReject.id ? t('Deleting…') : t('Reject review')}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
