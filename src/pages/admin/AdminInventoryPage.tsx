import { Fragment, useEffect, useState } from 'react'
import { apiRequest } from '../../api/api'
import { useAdminAuth } from './useAdminAuth'
import { useLanguage } from '../../language/useLanguage'
import { thumbnail } from '../../lib/thumbnails'
import { stockBarPercent } from './stockMeter'
import { PINNED_ACTION_CELL, PINNED_ACTION_HEAD } from './adminTable'

const dietaryOptions = ['vegetarian', 'vegan', 'dairy-free', 'gluten-free', 'nut-free']
const DEFAULT_THRESHOLD = 5
type InventoryFilter = 'all' | 'available' | 'low' | 'unavailable'
type ItemStatus = 'ok' | 'low' | 'sold-out' | 'off'

interface InventoryItem {
  id: string
  name: string
  categoryTitle: string
  image?: string
  stock: number
  reservedStock: number
  availableQuantity: number
  isAvailable: boolean
  dietaryTags: string[]
  lowStockThreshold?: number
}

const inputClassName = 'mt-1.5 w-full rounded-xl border border-[#dde4ec] bg-[#f8fafc] px-3.5 py-2.5 text-sm font-medium text-[#102c50] transition placeholder:text-[#9aa5b3] hover:border-[#c9d4e0] focus:border-[#bd9c00] focus:bg-white focus:ring-4 focus:ring-[#ffdc32]/25 outline-none!'

const icons = {
  search: 'm20 20-4.2-4.2M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z',
  box: 'M4 8l8-4 8 4v8l-8 4-8-4V8Zm0 0 8 4m0 0 8-4m-8 4v8',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  alert: 'M12 8v5m0 3.5v.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  eyeOff: 'M3 3l18 18M10.6 5.1A9.7 9.7 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-2.6 3.4M6.6 6.6C3.9 8.3 2.5 12 2.5 12S6 19 12 19a9 9 0 0 0 4.4-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  edit: 'M4 20h4L19 9l-4-4L4 16v4Zm9-13 4 4',
  close: 'M6 6l12 12M18 6 6 18',
  download: 'M12 4v12m0 0-5-5m5 5 5-5M5 20h14',
  minus: 'M6 12h12',
  plus: 'M12 6v12M6 12h12',
  leaf: 'M5 19c0-8 6-14 14-14 0 8-6 14-14 14Zm0 0 7-7',
  image: 'M4 5h16v14H4V5Zm0 11 4.5-4.5L13 16m-2-2 2.5-2.5L20 18M15.5 9.5h.01',
}

function Icon({ path, className = 'size-4' }: { path: string; className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d={path} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  )
}

function threshold(item: InventoryItem) {
  return item.lowStockThreshold ?? DEFAULT_THRESHOLD
}

function isLowStock(item: InventoryItem) {
  return item.stock > 0 && item.stock <= threshold(item)
}

function itemStatus(item: InventoryItem): ItemStatus {
  if (item.isAvailable === false) return 'off'
  if (item.availableQuantity <= 0) return 'sold-out'
  if (isLowStock(item)) return 'low'
  return 'ok'
}

const statusStyles: Record<ItemStatus, { badge: string; dot: string; bar: string; label: string }> = {
  ok: { badge: 'bg-[#eaf6ee] text-[#246a46] ring-[#cfe8d8]', dot: 'bg-[#35a36b]', bar: 'bg-[#35a36b]', label: 'In stock' },
  low: { badge: 'bg-[#fff6e5] text-[#9a6200] ring-[#f6dfb0]', dot: 'bg-[#e0a100]', bar: 'bg-[#e0a100]', label: 'Low stock' },
  'sold-out': { badge: 'bg-[#fdeeee] text-[#a53f37] ring-[#f3d1ce]', dot: 'bg-[#d2544b]', bar: 'bg-[#d2544b]', label: 'Sold out' },
  off: { badge: 'bg-[#f1f4f8] text-[#5b6b7d] ring-[#e1e7ee]', dot: 'bg-[#94a3b4]', bar: 'bg-[#94a3b4]', label: 'Unavailable' },
}

function Thumb({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f1f4f8] text-[#a3b0bf]">
        <Icon path={icons.image} />
      </span>
    )
  }
  return <img decoding="async" alt="" className="size-10 shrink-0 rounded-xl bg-[#f1f4f8] object-cover" loading="lazy" onError={() => setFailed(true)} src={thumbnail(src, 'tiny')} />
}

function Switch({ checked, disabled, label, onChange }: { checked: boolean; disabled?: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <button
      aria-checked={checked}
      aria-label={label}
      className={`relative h-6 w-11 shrink-0 rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] disabled:cursor-wait disabled:opacity-50 ${checked ? 'bg-[#35a36b]' : 'bg-[#cfd7e1]'}`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      role="switch"
      type="button"
    >
      <span className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition ${checked ? 'translate-x-5' : ''}`} />
    </button>
  )
}

export function AdminInventoryPage() {
  const { sessionToken } = useAdminAuth()
  const { t } = useLanguage()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState('')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [inventoryFilter, setInventoryFilter] = useState<InventoryFilter>('all')
  const [sortBy, setSortBy] = useState('category')
  const [draft, setDraft] = useState<InventoryItem | null>(null)

  useEffect(() => {
    let cancelled = false
    apiRequest<{ categories: { title: string; items: InventoryItem[] }[] }>('/menu')
      .then(({ categories }) => {
        if (!cancelled) setItems(categories.flatMap((category) =>
          category.items.map((item) => ({ ...item, categoryTitle: category.title })),
        ))
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unable to load menu inventory.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!message) return undefined
    const timer = window.setTimeout(() => setMessage(''), 4000)
    return () => window.clearTimeout(timer)
  }, [message])

  useEffect(() => {
    if (!draft) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setDraft(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [draft])

  function updateItem(itemId: string, updates: Partial<InventoryItem>) {
    setItems((current) => current.map((item) => item.id === itemId ? { ...item, ...updates } : item))
  }

  async function saveItem(item: InventoryItem) {
    setError('')
    setMessage('')
    setSavingId(item.id)
    try {
      const updated = await apiRequest<InventoryItem>('/admin/menu-inventory', {
        method: 'PUT',
        token: sessionToken,
        body: {
          itemId: item.id,
          stock: Number(item.stock),
          isAvailable: item.isAvailable,
          dietaryTags: item.dietaryTags || [],
          lowStockThreshold: Number(item.lowStockThreshold ?? DEFAULT_THRESHOLD),
        },
      })
      updateItem(item.id, {
        ...updated,
        reservedStock: item.reservedStock || 0,
        availableQuantity: Math.max(0, updated.stock - (item.reservedStock || 0)),
      })
      setMessage(t('Inventory updated.'))
      return true
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update inventory.')
      return false
    } finally {
      setSavingId('')
    }
  }

  async function saveDraft() {
    if (!draft) return
    if (await saveItem(draft)) setDraft(null)
  }

  function exportCsv() {
    const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`
    const rows = [
      ['Item', 'Category', 'Stock', 'Reserved', 'Available', 'Low-stock threshold', 'Status', 'Dietary tags'],
      ...filteredItems.map((item) => [
        item.name,
        item.categoryTitle,
        item.stock,
        item.reservedStock || 0,
        item.availableQuantity,
        threshold(item),
        statusStyles[itemStatus(item)].label,
        (item.dietaryTags || []).join('; '),
      ]),
    ]
    const blob = new Blob([`﻿${rows.map((row) => row.map(escape).join(',')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `menu-inventory-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const categories = [...new Set(items.map((item) => item.categoryTitle))].sort((a, b) => a.localeCompare(b))
  const availableCount = items.filter((item) => item.isAvailable !== false && item.availableQuantity > 0).length
  const lowStockCount = items.filter(isLowStock).length
  const unavailableCount = items.filter((item) => item.isAvailable === false || item.availableQuantity === 0).length
  const unitsOnHand = items.reduce((total, item) => total + item.stock, 0)
  const reservedUnits = items.reduce((total, item) => total + (item.reservedStock || 0), 0)
  const normalizedSearch = search.trim().toLocaleLowerCase()
  const filteredItems = items
    .filter((item) => {
      const matchesSearch = !normalizedSearch
        || item.name.toLocaleLowerCase().includes(normalizedSearch)
        || item.categoryTitle.toLocaleLowerCase().includes(normalizedSearch)
        || t(item.categoryTitle).toLocaleLowerCase().includes(normalizedSearch)
      const matchesCategory = !categoryFilter || item.categoryTitle === categoryFilter
      const matchesStatus = inventoryFilter === 'all'
        || (inventoryFilter === 'available' && item.isAvailable !== false && item.availableQuantity > 0)
        || (inventoryFilter === 'low' && isLowStock(item))
        || (inventoryFilter === 'unavailable' && (item.isAvailable === false || item.availableQuantity === 0))
      return matchesSearch && matchesCategory && matchesStatus
    })
    .sort((a, b) => {
      if (sortBy === 'stock') return a.availableQuantity - b.availableQuantity
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      return a.categoryTitle.localeCompare(b.categoryTitle) || a.name.localeCompare(b.name)
    })
  const isGrouped = sortBy === 'category'
  const hasActiveFilters = Boolean(normalizedSearch || categoryFilter || inventoryFilter !== 'all')

  const metrics = [
    { label: 'Total items', value: items.length, icon: icons.list, accent: 'bg-[#e9f1fa] text-[#315982]', filter: 'all' as const },
    { label: 'Available', value: availableCount, icon: icons.check, accent: 'bg-[#e5f4ea] text-[#2c7a4f]', filter: 'available' as const },
    { label: 'Low stock', value: lowStockCount, icon: icons.alert, accent: 'bg-[#fff1dc] text-[#a86a00]', filter: 'low' as const },
    { label: 'Unavailable', value: unavailableCount, icon: icons.eyeOff, accent: 'bg-[#fdecea] text-[#b2433a]', filter: 'unavailable' as const },
  ]

  const draftAvailable = draft ? Math.max(0, Number(draft.stock || 0) - (draft.reservedStock || 0)) : 0

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-col gap-5 border-b border-[#edf1f5] pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#092a53] text-[#ffdc32]">
            <Icon className="size-7" path={icons.box} />
          </span>
          <div className="min-w-0">
            <nav aria-label={t('Breadcrumb')} className="text-[11px] font-bold text-[#8190a1]">
              {t('Catalog')} <span aria-hidden="true" className="mx-1">/</span>
              <span className="text-[#8a7000]">{t('Menu inventory')}</span>
            </nav>
            <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-[#092a53] sm:text-[1.9rem]">{t('Menu inventory')}</h1>
            <p className="mt-0.5 text-sm text-[#65748a]">{t('Set stock, availability, and dietary tags for every menu item.')}</p>
          </div>
        </div>
        <button
          className="inline-flex min-h-10 items-center gap-2 self-start rounded-xl border border-[#dce5ef] bg-white px-4 text-sm font-bold text-[#355777] transition hover:border-[#bacbdc] hover:bg-[#f6f9fc] hover:text-[#092a53] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] disabled:opacity-50 xl:self-auto"
          disabled={!filteredItems.length}
          onClick={exportCsv}
          type="button"
        >
          <Icon path={icons.download} />
          {t('Export CSV')}
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
      {error && !draft && (
        <p className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100" role="alert">
          <Icon className="mt-0.5 size-4 shrink-0" path={icons.alert} />
          {error}
        </p>
      )}

      <section aria-label={t('Inventory overview')} className="admin-stats grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map((metric) => {
          const isActive = inventoryFilter === metric.filter && metric.filter !== 'all'
          return (
            <button
              aria-pressed={isActive}
              className={`group rounded-2xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(18,44,80,0.07)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] sm:p-5 ${
                isActive ? 'border-[#092a53] shadow-[0_0_0_1px_#092a53]' : 'border-[#e5ebf3]'
              }`}
              key={metric.label}
              onClick={() => setInventoryFilter(isActive ? 'all' : metric.filter)}
              type="button"
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`grid size-9 place-items-center rounded-xl ${metric.accent}`}><Icon path={metric.icon} /></span>
                {metric.filter !== 'all' && (
                  <span className="text-[10px] font-bold text-[#a3b0bf] opacity-0 transition group-hover:opacity-100">
                    {t(isActive ? 'Clear filter' : 'Filter')}
                  </span>
                )}
              </div>
              <p className="mt-4 font-display text-[1.75rem] font-extrabold leading-none tracking-tight text-[#102c50]">{metric.value.toLocaleString()}</p>
              <p className="mt-1.5 text-xs font-semibold text-[#65748a]">{t(metric.label)}</p>
            </button>
          )
        })}
      </section>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl bg-[#f7f9fc] px-4 py-3 text-xs ring-1 ring-[#e8edf3]">
        <span className="flex items-center gap-2 font-bold text-[#4f6379]">
          <Icon className="size-4 text-[#8190a1]" path={icons.box} />
          {unitsOnHand.toLocaleString()} {t('Units on hand')}
        </span>
        <span className="font-semibold text-[#8190a1]">{reservedUnits.toLocaleString()} {t('reserved for pending checkouts.')}</span>
        {items.length > 0 && (
          <div aria-hidden="true" className="flex h-2 min-w-40 flex-1 overflow-hidden rounded-full bg-[#e6ebf1]">
            <span className="bg-[#35a36b]" style={{ width: `${((availableCount - items.filter((item) => itemStatus(item) === 'low').length) / items.length) * 100}%` }} />
            <span className="bg-[#e0a100]" style={{ width: `${(items.filter((item) => itemStatus(item) === 'low').length / items.length) * 100}%` }} />
            <span className="bg-[#d2544b]" style={{ width: `${(unavailableCount / items.length) * 100}%` }} />
          </div>
        )}
      </div>

      <section aria-labelledby="inventory-table-title" className="min-w-0 rounded-[20px] border border-[#e5ebf3] bg-white">
        <div className="flex flex-col gap-4 border-b border-[#edf1f5] p-4 sm:p-5">
          <div>
            <h2 className="font-display text-xl font-extrabold text-[#092a53]" id="inventory-table-title">{t('Stock levels')}</h2>
            <p aria-live="polite" className="mt-0.5 text-xs text-[#65748a]">
              {t('Showing {shown} of {total} items', { shown: filteredItems.length, total: items.length })}
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
            <label className="relative block">
              <span className="sr-only">{t('Search')}</span>
              <Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#8190a1]" path={icons.search} />
              <input className={`${inputClassName} mt-0 pl-10`} onChange={(event) => setSearch(event.target.value)} placeholder={t('Search items')} type="search" value={search} />
            </label>
            <label className="block">
              <span className="sr-only">{t('Category')}</span>
              <select className={`${inputClassName} mt-0 lg:w-48`} onChange={(event) => setCategoryFilter(event.target.value)} value={categoryFilter}>
                <option value="">{t('All categories')}</option>
                {categories.map((category) => <option key={category} value={category}>{t(category)}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="sr-only">{t('Sort by')}</span>
              <select className={`${inputClassName} mt-0 lg:w-48`} onChange={(event) => setSortBy(event.target.value)} value={sortBy}>
                <option value="category">{t('Group by category')}</option>
                <option value="name">{t('Sort: Name (A–Z)')}</option>
                <option value="stock">{t('Sort: Lowest stock first')}</option>
              </select>
            </label>
            <div aria-label={t('Status')} className="flex overflow-x-auto rounded-xl bg-[#f1f4f8] p-1" role="group">
              {([
                { key: 'all', label: t('All') },
                { key: 'available', label: t('Available') },
                { key: 'low', label: t('Low stock') },
                { key: 'unavailable', label: t('Unavailable') },
              ] as const).map((option) => (
                <button
                  aria-pressed={inventoryFilter === option.key}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition ${inventoryFilter === option.key ? 'bg-white text-[#092a53] shadow-sm' : 'text-[#65748a] hover:text-[#092a53]'}`}
                  key={option.key}
                  onClick={() => setInventoryFilter(option.key)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div aria-label={t('Loading menu items…')} className="space-y-3 p-4 sm:p-5" role="status">
            {[0, 1, 2, 3, 4].map((row) => (
              <div className="flex animate-pulse items-center gap-4" key={row}>
                <span className="size-10 rounded-xl bg-[#eef2f6]" />
                <span className="h-3 flex-1 rounded bg-[#eef2f6]" />
                <span className="h-3 w-28 rounded bg-[#eef2f6]" />
              </div>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#f1f4f8] text-[#8190a1]"><Icon className="size-5" path={icons.search} /></span>
            <p className="mt-4 font-display text-lg font-extrabold text-[#092a53]">
              {items.length ? t('No inventory items match your filters.') : t('No menu items yet.')}
            </p>
            {hasActiveFilters && (
              <button
                className="mt-4 min-h-9 rounded-xl border border-[#dce5ef] px-4 text-xs font-bold text-[#355777] transition hover:bg-[#f6f9fc]"
                onClick={() => { setSearch(''); setCategoryFilter(''); setInventoryFilter('all') }}
                type="button"
              >
                {t('Clear filters')}
              </button>
            )}
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#edf1f5] text-[11px] uppercase tracking-[0.08em] text-[#8190a1]">
                  <th className="px-5 py-3 font-extrabold" scope="col">{t('Item Name')}</th>
                  {!isGrouped && <th className="px-3 py-3 font-extrabold" scope="col">{t('Category')}</th>}
                  <th className="px-3 py-3 font-extrabold" scope="col">{t('Available')}</th>
                  <th className="px-3 py-3 text-center font-extrabold" scope="col">{t('Reserved')}</th>
                  <th className="px-3 py-3 font-extrabold" scope="col">{t('Dietary needs')}</th>
                  <th className="px-3 py-3 font-extrabold" scope="col">{t('Status')}</th>
                  <th className="px-3 py-3 text-center font-extrabold" scope="col">{t('On sale')}</th>
                  <th className={`px-5 py-3 ${PINNED_ACTION_HEAD}`} scope="col"><span className="sr-only">{t('Action')}</span></th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, index) => {
                  const status = itemStatus(item)
                  const style = statusStyles[status]
                  const percent = stockBarPercent(item.availableQuantity, threshold(item))
                  const showGroupHeader = isGrouped && (index === 0 || filteredItems[index - 1].categoryTitle !== item.categoryTitle)
                  const groupCount = showGroupHeader ? filteredItems.filter((other) => other.categoryTitle === item.categoryTitle).length : 0
                  return (
                    <Fragment key={item.id}>
                      {showGroupHeader && (
                        <tr className="bg-[#f7f9fc]">
                          <th className="border-y border-[#edf1f5] px-5 py-2 text-xs font-extrabold text-[#355777]" colSpan={7} scope="colgroup">
                            {t(item.categoryTitle)}
                            <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-[10px] text-[#8190a1] ring-1 ring-[#e3e9f0]">{groupCount}</span>
                          </th>
                        </tr>
                      )}
                      <tr className={`group border-b border-[#f0f3f7] transition hover:bg-[#fafbfd] ${savingId === item.id ? 'opacity-60' : ''}`}>
                        <td className="px-5 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <Thumb src={item.image} />
                            <span className="max-w-[13rem] truncate font-bold text-[#102c50]">{item.name}</span>
                          </div>
                        </td>
                        {!isGrouped && (
                          <td className="px-3 py-3">
                            <span className="inline-block max-w-[10rem] truncate rounded-full bg-[#eef3f9] px-2.5 py-1 text-[11px] font-bold text-[#355777]">{t(item.categoryTitle)}</span>
                          </td>
                        )}
                        <td className="px-3 py-3">
                          <div className="w-32">
                            <div className="flex items-baseline justify-between gap-2 text-xs">
                              <span className="font-extrabold tabular-nums text-[#102c50]">{item.availableQuantity}</span>
                              <span className="text-[11px] text-[#8190a1]">{t('{count} in stock', { count: item.stock })}</span>
                            </div>
                            <div className="relative mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#edf1f5]">
                              <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${percent}%` }} />
                            </div>
                            <p className="mt-1 text-[10px] font-semibold text-[#a3b0bf]">{t('Alert at {count}', { count: threshold(item) })}</p>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center text-xs font-bold tabular-nums text-[#65748a]">{item.reservedStock || 0}</td>
                        <td className="px-3 py-3">
                          {item.dietaryTags?.length ? (
                            <div className="flex max-w-[13rem] flex-wrap gap-1">
                              {item.dietaryTags.map((tag) => (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#eef7ee] px-2 py-0.5 text-[10px] font-bold text-[#2f6b3c]" key={tag}>
                                  <Icon className="size-3" path={icons.leaf} />
                                  {t(tag)}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[#c3ccd7]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${style.badge}`}>
                            <span aria-hidden="true" className={`size-1.5 rounded-full ${style.dot}`} />
                            {t(style.label)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <Switch
                            checked={item.isAvailable !== false}
                            disabled={savingId === item.id}
                            label={`${t('Available to order')}: ${item.name}`}
                            onChange={(checked) => saveItem({ ...item, isAvailable: checked })}
                          />
                        </td>
                        <td className={`px-5 py-3 text-right ${PINNED_ACTION_CELL}`}>
                          <button
                            aria-label={`${t('Edit')} ${item.name}`}
                            className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold text-[#355777] transition hover:bg-[#eef2f7] hover:text-[#092a53] focus-visible:outline-2 focus-visible:outline-[#bd9c00]"
                            onClick={() => { setError(''); setDraft({ ...item, dietaryTags: [...(item.dietaryTags || [])] }) }}
                            type="button"
                          >
                            <Icon path={icons.edit} />
                            {t('Edit')}
                          </button>
                        </td>
                      </tr>
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {draft && (
        <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
          <button aria-label={t('Close')} className="admin-drawer-backdrop absolute inset-0 bg-[#0b1e36]/45 backdrop-blur-[2px]" onClick={() => setDraft(null)} tabIndex={-1} type="button" />
          <section
            aria-labelledby="inventory-drawer-title"
            aria-modal="true"
            className="admin-drawer-panel relative flex h-full w-full max-w-[30rem] flex-col bg-white shadow-[-24px_0_60px_rgba(9,42,83,0.18)]"
            role="dialog"
          >
            <header className="flex items-start justify-between gap-4 border-b border-[#edf1f5] px-6 py-5">
              <div className="flex min-w-0 items-center gap-3">
                <Thumb src={draft.image} />
                <div className="min-w-0">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#8a7000]">{t(draft.categoryTitle)}</p>
                  <h2 className="truncate font-display text-xl font-extrabold text-[#092a53]" id="inventory-drawer-title">{draft.name}</h2>
                </div>
              </div>
              <button aria-label={t('Close')} className="grid size-9 shrink-0 place-items-center rounded-xl text-[#65748a] transition hover:bg-[#f1f4f8] hover:text-[#092a53]" onClick={() => setDraft(null)} type="button">
                <Icon className="size-5" path={icons.close} />
              </button>
            </header>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6">
              <dl className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: t('Stock'), value: Number(draft.stock || 0) },
                  { label: t('Reserved'), value: draft.reservedStock || 0 },
                  { label: t('Available'), value: draftAvailable },
                ].map((stat) => (
                  <div className="rounded-xl bg-[#f7f9fc] px-2 py-3 ring-1 ring-[#e8edf3]" key={stat.label}>
                    <dt className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#8190a1]">{stat.label}</dt>
                    <dd className="mt-1 font-display text-xl font-extrabold tabular-nums text-[#092a53]">{stat.value}</dd>
                  </div>
                ))}
              </dl>

              <fieldset>
                <legend className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#8190a1]">{t('Stock quantity')}</legend>
                <div className="flex items-center gap-2">
                  <button
                    aria-label={t('Decrease quantity')}
                    className="grid size-11 place-items-center rounded-xl border border-[#dde4ec] text-[#355777] transition hover:bg-[#f1f4f8] disabled:opacity-40"
                    disabled={Number(draft.stock) <= (draft.reservedStock || 0)}
                    onClick={() => setDraft({ ...draft, stock: Math.max(draft.reservedStock || 0, Number(draft.stock) - 1) })}
                    type="button"
                  >
                    <Icon path={icons.minus} />
                  </button>
                  <input
                    aria-label={t('Stock quantity')}
                    className={`${inputClassName} mt-0 text-center font-display text-lg font-extrabold tabular-nums`}
                    min={draft.reservedStock || 0}
                    onChange={(event) => setDraft({ ...draft, stock: Number(event.target.value) })}
                    type="number"
                    value={draft.stock}
                  />
                  <button
                    aria-label={t('Increase quantity')}
                    className="grid size-11 place-items-center rounded-xl border border-[#dde4ec] text-[#355777] transition hover:bg-[#f1f4f8]"
                    onClick={() => setDraft({ ...draft, stock: Number(draft.stock) + 1 })}
                    type="button"
                  >
                    <Icon path={icons.plus} />
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[10, 25, 50].map((amount) => (
                    <button
                      className="rounded-lg bg-[#f1f4f8] px-2.5 py-1 text-[11px] font-bold text-[#4f6379] transition hover:bg-[#e3e9f0] hover:text-[#092a53]"
                      key={amount}
                      onClick={() => setDraft({ ...draft, stock: Number(draft.stock) + amount })}
                      type="button"
                    >
                      +{amount}
                    </button>
                  ))}
                </div>
                {(draft.reservedStock || 0) > 0 && (
                  <p className="mt-2 text-[11px] font-medium text-[#8190a1]">{draft.reservedStock} {t('reserved for pending checkouts.')}</p>
                )}
              </fieldset>

              <label className="block text-xs font-bold text-[#4f6379]">
                {t('Low-stock threshold')}
                <input
                  className={inputClassName}
                  min="0"
                  onChange={(event) => setDraft({ ...draft, lowStockThreshold: Number(event.target.value) })}
                  type="number"
                  value={threshold(draft)}
                />
                <span className="mt-1 block text-[11px] font-medium text-[#8190a1]">{t('The item is flagged as low stock at or below this number.')}</span>
              </label>

              <div className="flex items-center gap-4 rounded-xl bg-[#f7f9fc] p-4 ring-1 ring-[#e8edf3]">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-[#102c50]">{t('Available to order')}</span>
                  <span className="block text-xs text-[#7b8796]">{t('Turn off to hide this item from the public menu.')}</span>
                </span>
                <Switch checked={draft.isAvailable !== false} label={t('Available to order')} onChange={(checked) => setDraft({ ...draft, isAvailable: checked })} />
              </div>

              <fieldset>
                <legend className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#8190a1]">{t('Dietary needs')}</legend>
                <div className="flex flex-wrap gap-2">
                  {dietaryOptions.map((tag) => {
                    const selected = draft.dietaryTags?.includes(tag) || false
                    return (
                      <label
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold ring-1 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#bd9c00] ${
                          selected ? 'bg-[#eef7ee] text-[#2f6b3c] ring-[#bfe0c6]' : 'bg-white text-[#4f6379] ring-[#dde4ec] hover:ring-[#c3cfdc]'
                        }`}
                        key={tag}
                      >
                        <input
                          checked={selected}
                          className="sr-only"
                          onChange={(event) => {
                            const tags = new Set(draft.dietaryTags || [])
                            if (event.target.checked) tags.add(tag)
                            else tags.delete(tag)
                            setDraft({ ...draft, dietaryTags: [...tags] })
                          }}
                          type="checkbox"
                        />
                        <Icon className="size-3.5" path={selected ? icons.check : icons.plus} />
                        {t(tag)}
                      </label>
                    )
                  })}
                </div>
              </fieldset>

              {error && (
                <p className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100" role="alert">
                  <Icon className="mt-0.5 size-4 shrink-0" path={icons.alert} />
                  {error}
                </p>
              )}
            </div>

            <footer className="flex items-center justify-end gap-3 border-t border-[#edf1f5] bg-[#fafbfd] px-6 py-4">
              <button className="min-h-10 rounded-xl px-4 text-sm font-bold text-[#4f6379] transition hover:bg-[#eef2f6] hover:text-[#092a53]" onClick={() => setDraft(null)} type="button">
                {t('Cancel')}
              </button>
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#092a53] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#163e6b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] disabled:cursor-wait disabled:opacity-60"
                disabled={savingId === draft.id}
                onClick={saveDraft}
                type="button"
              >
                <Icon path={icons.check} />
                {savingId === draft.id ? t('Saving…') : t('Save changes')}
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  )
}
