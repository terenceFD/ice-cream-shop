import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../../api/api'
import { prepareImageForUpload, UPLOAD_IMAGE_TYPES, UPLOAD_MAX_BYTES } from '../../lib/prepareUploadImage'
import { useAdminAuth } from './useAdminAuth'
import { useLanguage } from '../../language/useLanguage'
import { stockBarPercent } from './stockMeter'
import { PINNED_ACTION_CELL, PINNED_ACTION_HEAD } from './adminTable'

const inputClassName = 'mt-1.5 w-full rounded-xl border border-[#dde4ec] bg-[#f8fafc] px-3.5 py-2.5 text-sm font-medium text-[#102c50] transition placeholder:text-[#9aa5b3] hover:border-[#c9d4e0] focus:border-[#bd9c00] focus:bg-white focus:ring-4 focus:ring-[#ffdc32]/25 outline-none!'
const labelClassName = 'block text-xs font-bold text-[#4f6379]'
const LOW_STOCK_THRESHOLD = 10
const FALLBACK_IMAGE = '/images/hero-ice-cream.jpg'
const initialForm = {
  categoryTitle: '',
  name: '',
  detail: '',
  image: '',
  priceXaf: '',
  stock: '100',
  isAvailable: true,
}

interface MenuItem {
  id: string
  categoryTitle: string
  name: string
  detail: string
  image: string
  priceXaf: number
  stock: number
  availableQuantity: number
  isAvailable: boolean
}

interface MenuCategory {
  title: string
}

type ItemStatus = 'ok' | 'low' | 'hidden' | 'sold-out'

const icons = {
  plus: 'M12 5v14M5 12h14',
  search: 'm20 20-4.2-4.2M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z',
  grid: 'M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  edit: 'M4 20h4L19 9l-4-4L4 16v4Zm9-13 4 4',
  trash: 'M4 7h16M10 11v6m4-6v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3',
  external: 'M14 4h6v6m0-6L10 14M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  close: 'M6 6l12 12M18 6 6 18',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  alert: 'M12 8v5m0 3.5v.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  menu: 'M5 4h14v16H5V4Zm4 4h6M9 12h6M9 16h4',
  eyeOff: 'M3 3l18 18M10.6 5.1A9.7 9.7 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-2.6 3.4M6.6 6.6C3.9 8.3 2.5 12 2.5 12S6 19 12 19a9 9 0 0 0 4.4-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2',
  box: 'M4 8l8-4 8 4v8l-8 4-8-4V8Zm0 0 8 4m0 0 8-4m-8 4v8',
  upload: 'M12 16V4m0 0L7 9m5-5 5 5M5 20h14',
  image: 'M4 5h16v14H4V5Zm0 11 4.5-4.5L13 16m-2-2 2.5-2.5L20 18M15.5 9.5h.01',
}

function Icon({ path, className = 'size-4' }: { path: string; className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d={path} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  )
}

function itemStatus(item: MenuItem): ItemStatus {
  if (!item.isAvailable) return 'hidden'
  if (item.availableQuantity <= 0) return 'sold-out'
  if (item.availableQuantity <= LOW_STOCK_THRESHOLD) return 'low'
  return 'ok'
}

const statusStyles: Record<ItemStatus, { badge: string; dot: string; bar: string; label: string }> = {
  ok: { badge: 'bg-[#eaf6ee] text-[#246a46] ring-[#cfe8d8]', dot: 'bg-[#35a36b]', bar: 'bg-[#35a36b]', label: 'Available' },
  low: { badge: 'bg-[#fff6e5] text-[#9a6200] ring-[#f6dfb0]', dot: 'bg-[#e0a100]', bar: 'bg-[#e0a100]', label: 'Low stock' },
  'sold-out': { badge: 'bg-[#fdeeee] text-[#a53f37] ring-[#f3d1ce]', dot: 'bg-[#d2544b]', bar: 'bg-[#d2544b]', label: 'Sold out' },
  hidden: { badge: 'bg-[#f1f4f8] text-[#5b6b7d] ring-[#e1e7ee]', dot: 'bg-[#94a3b4]', bar: 'bg-[#94a3b4]', label: 'Hidden' },
}

function Thumb({ src, className = 'size-12' }: { src: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (!src) {
    return (
      <span className={`${className} grid shrink-0 place-items-center rounded-xl bg-[#f1f4f8] text-[#a3b0bf]`}>
        <Icon className="size-5" path={icons.image} />
      </span>
    )
  }
  return (
    <img decoding="async"
      alt=""
      className={`${className} shrink-0 rounded-xl bg-[#f1f4f8] object-cover`}
      loading="lazy"
      onError={() => setFailed(true)}
      src={failed ? FALLBACK_IMAGE : src}
    />
  )
}

export function AdminMenuPage() {
  const { sessionToken } = useAdminAuth()
  const { t, language } = useLanguage()
  const [form, setForm] = useState(initialForm)
  const [items, setItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null)
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'low' | 'unavailable'>('all')
  const [sortBy, setSortBy] = useState('name')
  const [view, setView] = useState<'table' | 'grid'>('table')
  const availableCount = items.filter((item) => item.isAvailable && item.availableQuantity > 0).length
  const unavailableCount = items.length - availableCount
  const lowStockCount = items.filter((item) => itemStatus(item) === 'low').length
  const remainingUnits = items.reduce((total, item) => total + Math.max(0, item.availableQuantity || 0), 0)
  const formatPrice = (price: number) => `${new Intl.NumberFormat(language === 'fr' ? 'fr-CM' : 'en-CM').format(price)} FCFA`
  const isOverlayOpen = isEditorOpen || Boolean(itemToDelete)
  const usedCategories = [...new Set(items.map((item) => item.categoryTitle))].sort((a, b) => a.localeCompare(b))
  const filteredItems = items
    .filter((item) => {
      const query = search.trim().toLocaleLowerCase()
      const matchesSearch = !query || [item.name, item.detail, item.categoryTitle].some((value) =>
        value.toLocaleLowerCase().includes(query) || t(value).toLocaleLowerCase().includes(query))
      const matchesCategory = !categoryFilter || item.categoryTitle === categoryFilter
      const status = itemStatus(item)
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'available' && (status === 'ok' || status === 'low'))
        || (statusFilter === 'low' && status === 'low')
        || (statusFilter === 'unavailable' && (status === 'hidden' || status === 'sold-out'))
      return matchesSearch && matchesCategory && matchesStatus
    })
    .sort((a, b) => {
      if (sortBy === 'price-asc') return a.priceXaf - b.priceXaf
      if (sortBy === 'price-desc') return b.priceXaf - a.priceXaf
      if (sortBy === 'stock') return a.availableQuantity - b.availableQuantity
      if (sortBy === 'category') return a.categoryTitle.localeCompare(b.categoryTitle) || a.name.localeCompare(b.name)
      return a.name.localeCompare(b.name)
    })
  const hasActiveFilters = Boolean(search.trim() || categoryFilter || statusFilter !== 'all')

  useEffect(() => {
    let cancelled = false
    Promise.all([
      apiRequest<{ categories: { title: string; items: MenuItem[] }[] }>('/menu'),
      apiRequest<{ categories: MenuCategory[] }>('/admin/menu-categories', { token: sessionToken }),
    ])
      .then(([menuResult, categoryResult]) => {
        if (!cancelled) {
          setItems(menuResult.categories.flatMap((category) => category.items.filter((item) => item.id?.startsWith('menu:custom:'))))
          setCategories(categoryResult.categories)
          setForm((current) => ({ ...current, categoryTitle: current.categoryTitle || categoryResult.categories[0]?.title || '' }))
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unable to load menu items.')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [sessionToken])

  useEffect(() => {
    if (!message) return undefined
    const timer = window.setTimeout(() => setMessage(''), 5000)
    return () => window.clearTimeout(timer)
  }, [message])

  useEffect(() => {
    if (!isOverlayOpen) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setIsEditorOpen(false)
      setEditingItemId(null)
      setItemToDelete(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOverlayOpen])

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = event.target
    const nextValue = name === 'isAvailable' && event.target instanceof HTMLInputElement
      ? event.target.checked
      : value
    setForm((current) => ({ ...current, [name]: nextValue }))
  }

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setError('')
    if (!UPLOAD_IMAGE_TYPES.includes(file.type) || (file.type === 'image/gif' && file.size > UPLOAD_MAX_BYTES)) {
      setError(t('Choose a JPEG, PNG, WebP, or GIF image smaller than 5 MB.'))
      event.target.value = ''
      return
    }
    setIsUploading(true)
    try {
      const dataUrl = await prepareImageForUpload(file)
      const { image } = await apiRequest<{ image: string }>('/admin/uploads', {
        method: 'POST',
        token: sessionToken,
        body: { dataUrl },
      })
      setForm((current) => ({ ...current, image }))
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to upload the selected image.')
    } finally {
      setIsUploading(false)
      event.target.value = ''
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    setIsSaving(true)
    try {
      const isEditing = editingItemId !== null
      const itemId = isEditing ? editingItemId.split(':').at(-1) : null
      const { item } = await apiRequest<{ item: MenuItem }>(
        isEditing ? `/admin/menu-items/${itemId}` : '/admin/menu-items',
        {
          method: isEditing ? 'PUT' : 'POST',
          token: sessionToken,
          body: { ...form, priceXaf: Number(form.priceXaf), stock: Number(form.stock) },
        },
      )
      setItems((current) => isEditing
        ? current.map((existingItem) => existingItem.id === item.id ? item : existingItem)
        : [...current, item])
      setForm((current) => ({ ...initialForm, categoryTitle: current.categoryTitle }))
      setEditingItemId(null)
      setIsEditorOpen(false)
      setMessage(t(isEditing ? 'Menu item updated.' : 'Menu item added and is now available on the website.'))
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save menu item.')
    } finally {
      setIsSaving(false)
    }
  }

  function openAdd() {
    setEditingItemId(null)
    setForm((current) => ({ ...initialForm, categoryTitle: current.categoryTitle || categories[0]?.title || '' }))
    setError('')
    setIsEditorOpen(true)
  }

  function handleEdit(item: MenuItem) {
    setEditingItemId(item.id)
    setForm({
      categoryTitle: item.categoryTitle,
      name: item.name,
      detail: item.detail,
      image: item.image,
      priceXaf: String(item.priceXaf),
      stock: String(item.stock),
      isAvailable: item.isAvailable,
    })
    setError('')
    setMessage('')
    setIsEditorOpen(true)
  }

  function cancelEdit() {
    setEditingItemId(null)
    setIsEditorOpen(false)
    setForm((current) => ({ ...initialForm, categoryTitle: current.categoryTitle }))
    setError('')
  }

  async function handleDelete() {
    const item = itemToDelete
    if (!item) return
    setError('')
    setMessage('')
    setDeletingItemId(item.id)
    try {
      await apiRequest(`/admin/menu-items/${item.id.split(':').at(-1)}`, {
        method: 'DELETE',
        token: sessionToken,
      })
      setItems((current) => current.filter((existingItem) => existingItem.id !== item.id))
      if (editingItemId === item.id) cancelEdit()
      setItemToDelete(null)
      setMessage(t('Menu item deleted.'))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete menu item.')
    } finally {
      setDeletingItemId(null)
    }
  }

  const metrics = [
    { label: 'Custom menu items', value: items.length, icon: icons.menu, accent: 'bg-[#e9f1fa] text-[#315982]', filter: 'all' as const },
    { label: 'Available now', value: availableCount, icon: icons.check, accent: 'bg-[#e5f4ea] text-[#2c7a4f]', filter: 'available' as const },
    { label: 'Low stock', value: lowStockCount, icon: icons.alert, accent: 'bg-[#fff1dc] text-[#a86a00]', filter: 'low' as const },
    { label: 'Unavailable', value: unavailableCount, icon: icons.eyeOff, accent: 'bg-[#fdecea] text-[#b2433a]', filter: 'unavailable' as const },
  ]

  const StatusBadge = ({ item }: { item: MenuItem }) => {
    const style = statusStyles[itemStatus(item)]
    return (
      <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${style.badge}`}>
        <span aria-hidden="true" className={`size-1.5 rounded-full ${style.dot}`} />
        {t(style.label)}
      </span>
    )
  }

  const StockMeter = ({ item }: { item: MenuItem }) => {
    const style = statusStyles[itemStatus(item)]
    const percent = stockBarPercent(item.availableQuantity, LOW_STOCK_THRESHOLD)
    return (
      <div className="min-w-[7rem]">
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span className="font-extrabold tabular-nums text-[#102c50]">{item.availableQuantity}</span>
          <span className="text-[11px] text-[#8190a1]">{t('Alert at {count}', { count: LOW_STOCK_THRESHOLD })}</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#edf1f5]">
          <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${percent}%` }} />
        </div>
      </div>
    )
  }

  const rowActions = (item: MenuItem) => (
    <div className="flex items-center justify-end gap-1">
      <button
        aria-label={`${t('Edit')} ${item.name}`}
        className="grid size-8 place-items-center rounded-lg text-[#6b7d91] transition hover:bg-[#eef2f7] hover:text-[#092a53] focus-visible:outline-2 focus-visible:outline-[#bd9c00]"
        onClick={() => handleEdit(item)}
        title={t('Edit')}
        type="button"
      >
        <Icon path={icons.edit} />
      </button>
      <button
        aria-label={`${t('Delete')} ${item.name}`}
        className="grid size-8 place-items-center rounded-lg text-[#6b7d91] transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-red-400"
        onClick={() => { setError(''); setItemToDelete(item) }}
        title={t('Delete')}
        type="button"
      >
        <Icon path={icons.trash} />
      </button>
    </div>
  )

  const previewPrice = Number(form.priceXaf)

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-col gap-5 border-b border-[#edf1f5] pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#092a53] text-[#ffdc32]">
            <Icon className="size-7" path={icons.menu} />
          </span>
          <div className="min-w-0">
            <nav aria-label={t('Breadcrumb')} className="text-[11px] font-bold text-[#8190a1]">
              {t('Store management')} <span aria-hidden="true" className="mx-1">/</span>
              <span className="text-[#8a7000]">{t('Menu')}</span>
            </nav>
            <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-[#092a53] sm:text-[1.9rem]">
              {t('Menu management')}
            </h1>
            <p className="mt-0.5 max-w-2xl text-sm text-[#65748a]">
              {t('Add menu items to an existing category. New items are saved and shown in the public menu.')}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#dce5ef] bg-white px-4 text-sm font-bold text-[#355777] transition hover:border-[#bacbdc] hover:bg-[#f6f9fc] hover:text-[#092a53] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00]"
            to="/menu"
          >
            <Icon path={icons.external} />
            {t('View public menu')}
          </Link>
          <button
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#092a53] px-4 text-sm font-bold text-white shadow-[0_6px_16px_rgba(9,42,83,0.18)] transition hover:-translate-y-0.5 hover:bg-[#163e6b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!categories.length}
            onClick={openAdd}
            type="button"
          >
            <Icon path={icons.plus} />
            {t('Add a menu item')}
          </button>
        </div>
      </header>

      {message && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-[#eaf6ee] px-4 py-3 text-sm font-semibold text-[#1f5d3c] ring-1 ring-[#cfe8d8]" role="status">
          <span className="flex items-center gap-2">
            <Icon path={icons.check} />
            {message}
          </span>
          <button aria-label={t('Dismiss')} className="grid size-7 place-items-center rounded-lg transition hover:bg-[#d7eedf]" onClick={() => setMessage('')} type="button">
            <Icon className="size-3.5" path={icons.close} />
          </button>
        </div>
      )}

      <section aria-label={t('Menu inventory overview')} className="admin-stats grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map((metric) => {
          const isActive = statusFilter === metric.filter && metric.filter !== 'all'
          return (
            <button
              aria-pressed={isActive}
              className={`group rounded-2xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(18,44,80,0.07)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] sm:p-5 ${
                isActive ? 'border-[#092a53] shadow-[0_0_0_1px_#092a53]' : 'border-[#e5ebf3]'
              }`}
              key={metric.label}
              onClick={() => setStatusFilter(isActive ? 'all' : metric.filter)}
              type="button"
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`grid size-9 place-items-center rounded-xl ${metric.accent}`}>
                  <Icon path={metric.icon} />
                </span>
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
          {remainingUnits.toLocaleString()} {t('Remaining units')}
        </span>
        <span className="font-semibold text-[#8190a1]">
          {t('{count} categories in use', { count: usedCategories.length })}
        </span>
        <span className="font-semibold text-[#8190a1]">
          {t('Low stock = {count} or fewer available', { count: LOW_STOCK_THRESHOLD })}
        </span>
      </div>

      <section aria-labelledby="menu-catalog-title" className="min-w-0 rounded-[20px] border border-[#e5ebf3] bg-white">
        <div className="flex flex-col gap-4 border-b border-[#edf1f5] p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-extrabold text-[#092a53]" id="menu-catalog-title">{t('Added menu items')}</h2>
              <p aria-live="polite" className="mt-0.5 text-xs text-[#65748a]">
                {t('Showing {shown} of {total} items', { shown: filteredItems.length, total: items.length })}
              </p>
            </div>
            <div aria-label={t('View')} className="inline-flex rounded-xl bg-[#f1f4f8] p-1" role="group">
              {([
                { key: 'table', icon: icons.list, label: t('Table view') },
                { key: 'grid', icon: icons.grid, label: t('Grid view') },
              ] as const).map((option) => (
                <button
                  aria-label={option.label}
                  aria-pressed={view === option.key}
                  className={`grid size-8 place-items-center rounded-lg transition ${view === option.key ? 'bg-white text-[#092a53] shadow-sm' : 'text-[#8190a1] hover:text-[#092a53]'}`}
                  key={option.key}
                  onClick={() => setView(option.key)}
                  title={option.label}
                  type="button"
                >
                  <Icon path={option.icon} />
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
            <label className="relative block">
              <span className="sr-only">{t('Search menu items')}</span>
              <Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#8190a1]" path={icons.search} />
              <input
                className={`${inputClassName} mt-0 pl-10`}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('Search menu items')}
                type="search"
                value={search}
              />
            </label>
            <label className="block">
              <span className="sr-only">{t('Menu category')}</span>
              <select className={`${inputClassName} mt-0 lg:w-48`} onChange={(event) => setCategoryFilter(event.target.value)} value={categoryFilter}>
                <option value="">{t('All categories')}</option>
                {usedCategories.map((category) => (
                  <option key={category} value={category}>{t(category)}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="sr-only">{t('Sort by')}</span>
              <select className={`${inputClassName} mt-0 lg:w-44`} onChange={(event) => setSortBy(event.target.value)} value={sortBy}>
                <option value="name">{t('Sort: Name (A–Z)')}</option>
                <option value="category">{t('Sort: Category')}</option>
                <option value="price-asc">{t('Sort: Price, low to high')}</option>
                <option value="price-desc">{t('Sort: Price, high to low')}</option>
                <option value="stock">{t('Sort: Lowest stock first')}</option>
              </select>
            </label>
            <div aria-label={t('Availability')} className="flex overflow-x-auto rounded-xl bg-[#f1f4f8] p-1" role="group">
              {([
                { key: 'all', label: t('All') },
                { key: 'available', label: t('Available') },
                { key: 'low', label: t('Low stock') },
                { key: 'unavailable', label: t('Unavailable') },
              ] as const).map((option) => (
                <button
                  aria-pressed={statusFilter === option.key}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition ${statusFilter === option.key ? 'bg-white text-[#092a53] shadow-sm' : 'text-[#65748a] hover:text-[#092a53]'}`}
                  key={option.key}
                  onClick={() => setStatusFilter(option.key)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && !isOverlayOpen && (
          <p className="mx-4 mt-4 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100 sm:mx-5" role="alert">
            <Icon className="mt-0.5 size-4 shrink-0" path={icons.alert} />
            {error}
          </p>
        )}

        {isLoading ? (
          <div aria-label={t('Loading menu items…')} className="space-y-3 p-4 sm:p-5" role="status">
            {[0, 1, 2, 3].map((row) => (
              <div className="flex animate-pulse items-center gap-4" key={row}>
                <span className="size-12 rounded-xl bg-[#eef2f6]" />
                <span className="h-3 flex-1 rounded bg-[#eef2f6]" />
                <span className="h-3 w-24 rounded bg-[#eef2f6]" />
              </div>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#f1f4f8] text-[#8190a1]">
              <Icon className="size-5" path={items.length ? icons.search : icons.menu} />
            </span>
            <p className="mt-4 font-display text-lg font-extrabold text-[#092a53]">
              {t(items.length ? 'No menu items match your filters.' : 'No custom menu items yet.')}
            </p>
            {!items.length && (
              <p className="mx-auto mt-1 max-w-sm text-sm text-[#65748a]">
                {t('Add menu items to an existing category. New items are saved and shown in the public menu.')}
              </p>
            )}
            <div className="mt-4 flex justify-center">
              {hasActiveFilters ? (
                <button
                  className="min-h-9 rounded-xl border border-[#dce5ef] px-4 text-xs font-bold text-[#355777] transition hover:bg-[#f6f9fc]"
                  onClick={() => { setSearch(''); setCategoryFilter(''); setStatusFilter('all') }}
                  type="button"
                >
                  {t('Clear filters')}
                </button>
              ) : (
                <button
                  className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-[#092a53] px-4 text-xs font-bold text-white transition hover:bg-[#163e6b] disabled:opacity-50"
                  disabled={!categories.length}
                  onClick={openAdd}
                  type="button"
                >
                  <Icon path={icons.plus} />
                  {t('Add a menu item')}
                </button>
              )}
            </div>
          </div>
        ) : view === 'table' ? (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#edf1f5] text-[11px] uppercase tracking-[0.08em] text-[#8190a1]">
                  <th className="px-5 py-3 font-extrabold" scope="col">{t('Menu item')}</th>
                  <th className="px-3 py-3 font-extrabold" scope="col">{t('Category')}</th>
                  <th className="px-3 py-3 text-right font-extrabold" scope="col">{t('Price')}</th>
                  <th className="px-3 py-3 font-extrabold" scope="col">{t('Stock')}</th>
                  <th className="px-3 py-3 font-extrabold" scope="col">{t('Status')}</th>
                  <th className={`px-5 py-3 ${PINNED_ACTION_HEAD}`} scope="col"><span className="sr-only">{t('Actions')}</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f3f7]">
                {filteredItems.map((item) => (
                  <tr className={`group transition hover:bg-[#fafbfd] ${deletingItemId === item.id ? 'opacity-50' : ''}`} key={item.id}>
                    <td className="px-5 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Thumb src={item.image} />
                        <div className="min-w-0">
                          <p className="truncate font-bold text-[#102c50]">{item.name}</p>
                          <p className="max-w-[14rem] truncate text-xs text-[#7b8796]">{item.detail}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-block max-w-[11rem] truncate rounded-full bg-[#eef3f9] px-2.5 py-1 text-[11px] font-bold text-[#355777]">
                        {t(item.categoryTitle)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-bold tabular-nums text-[#102c50]">{formatPrice(item.priceXaf)}</td>
                    <td className="px-3 py-3"><StockMeter item={item} /></td>
                    <td className="px-3 py-3"><StatusBadge item={item} /></td>
                    <td className={`px-5 py-3 ${PINNED_ACTION_CELL}`}>{rowActions(item)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 2xl:grid-cols-3">
            {filteredItems.map((item) => (
              <article
                className="group flex flex-col overflow-hidden rounded-2xl border border-[#e7edf4] bg-white transition hover:-translate-y-0.5 hover:border-[#cbd8e6] hover:shadow-[0_14px_30px_rgba(16,44,80,0.09)]"
                key={item.id}
              >
                <div className="relative aspect-[1.75] overflow-hidden bg-[#f1f4f7]">
                  <img decoding="async"
                    alt={item.name}
                    className="size-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    loading="lazy"
                    onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = FALLBACK_IMAGE }}
                    src={item.image}
                  />
                  <span className="absolute left-3 top-3"><StatusBadge item={item} /></span>
                  <span className="absolute right-3 top-3 max-w-[50%] truncate rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold text-[#355777] shadow-sm">
                    {t(item.categoryTitle)}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-lg font-extrabold text-[#123253]">{item.name}</h3>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-[#65748a]">{item.detail}</p>
                    </div>
                    <p className="shrink-0 text-sm font-extrabold tabular-nums text-[#123253]">{formatPrice(item.priceXaf)}</p>
                  </div>
                  <div className="mt-auto flex items-end justify-between gap-3 border-t border-[#edf1f5] pt-3">
                    <StockMeter item={item} />
                    {rowActions(item)}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
          <button aria-label={t('Close')} className="admin-drawer-backdrop absolute inset-0 bg-[#0b1e36]/45 backdrop-blur-[2px]" onClick={cancelEdit} tabIndex={-1} type="button" />
          <section
            aria-labelledby="menu-drawer-title"
            aria-modal="true"
            className="admin-drawer-panel relative flex h-full w-full max-w-[34rem] flex-col bg-white shadow-[-24px_0_60px_rgba(9,42,83,0.18)]"
            role="dialog"
          >
            <header className="flex items-start justify-between gap-4 border-b border-[#edf1f5] px-6 py-5">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#8a7000]">{t(editingItemId ? 'Edit menu item' : 'Menu editor')}</p>
                <h2 className="mt-1 font-display text-2xl font-extrabold text-[#092a53]" id="menu-drawer-title">
                  {t(editingItemId ? 'Edit menu item' : 'Add a menu item')}
                </h2>
                <p className="mt-1 text-sm text-[#65748a]">
                  {t(editingItemId ? 'Changes will appear in the shop right away.' : 'Add menu items to an existing category. New items are saved and shown in the public menu.')}
                </p>
              </div>
              <button aria-label={t('Close')} className="grid size-9 shrink-0 place-items-center rounded-xl text-[#65748a] transition hover:bg-[#f1f4f8] hover:text-[#092a53]" onClick={cancelEdit} type="button">
                <Icon className="size-5" path={icons.close} />
              </button>
            </header>

            <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6">
                <div className="flex items-center gap-4 rounded-2xl bg-[#f7f9fc] p-3 ring-1 ring-[#e8edf3]">
                  <Thumb className="size-20" key={form.image} src={form.image.trim()} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#8190a1]">{t('Live preview')}</p>
                    <p className="mt-1 truncate font-display text-lg font-extrabold text-[#092a53]">{form.name || t('Menu item name')}</p>
                    <p className="truncate text-xs text-[#65748a]">{form.categoryTitle ? t(form.categoryTitle) : t('Select a category')}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-extrabold text-[#102c50]">
                        {Number.isFinite(previewPrice) && previewPrice > 0 ? formatPrice(previewPrice) : '— FCFA'}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${form.isAvailable ? 'bg-[#eaf6ee] text-[#246a46]' : 'bg-[#f1f4f8] text-[#5b6b7d]'}`}>
                        {t(form.isAvailable ? 'Available' : 'Hidden')}
                      </span>
                    </div>
                  </div>
                </div>

                <fieldset className="space-y-4">
                  <legend className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#8190a1]">{t('Basics')}</legend>
                  <label className={labelClassName}>
                    {t('Menu category')}
                    <select className={inputClassName} name="categoryTitle" onChange={handleChange} required value={form.categoryTitle}>
                      <option disabled value="">{t('Select a category')}</option>
                      {categories.map((category) => (
                        <option key={category.title} value={category.title}>{t(category.title)}</option>
                      ))}
                    </select>
                  </label>
                  <label className={labelClassName}>
                    {t('Menu item name')}
                    <input className={inputClassName} maxLength={120} name="name" onChange={handleChange} required value={form.name} />
                  </label>
                  <label className={labelClassName}>
                    <span className="flex justify-between gap-2">
                      {t('Short description')}
                      <span className="font-semibold text-[#a3b0bf]">{form.detail.length}/500</span>
                    </span>
                    <textarea className={`${inputClassName} min-h-24 resize-y`} maxLength={500} name="detail" onChange={handleChange} required value={form.detail} />
                  </label>
                </fieldset>

                <fieldset className="space-y-4">
                  <legend className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#8190a1]">{t('Pricing & stock')}</legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className={labelClassName}>
                      {t('Price (FCFA)')}
                      <span className="relative block">
                        <input className={`${inputClassName} pr-16`} min={1} name="priceXaf" onChange={handleChange} required step={1} type="number" value={form.priceXaf} />
                        <span className="pointer-events-none absolute right-3.5 top-1/2 mt-[3px] -translate-y-1/2 text-[11px] font-extrabold text-[#8190a1]">FCFA</span>
                      </span>
                    </label>
                    <label className={labelClassName}>
                      {t('Stock quantity')}
                      <input className={inputClassName} min={0} name="stock" onChange={handleChange} required step={1} type="number" value={form.stock} />
                    </label>
                  </div>
                  <label className="flex cursor-pointer items-center gap-4 rounded-xl bg-[#f7f9fc] p-4 ring-1 ring-[#e8edf3] transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#bd9c00]">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-[#102c50]">{t('Available to order')}</span>
                      <span className="block text-xs text-[#7b8796]">{t('Turn off to hide this item from the public menu.')}</span>
                    </span>
                    <input checked={form.isAvailable} className="peer sr-only" name="isAvailable" onChange={handleChange} type="checkbox" />
                    <span aria-hidden="true" className="relative h-6 w-11 shrink-0 rounded-full bg-[#cfd7e1] transition after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:bg-[#35a36b] peer-checked:after:translate-x-5" />
                  </label>
                </fieldset>

                <fieldset className="space-y-4">
                  <legend className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#8190a1]">{t('Image')}</legend>
                  <label
                    className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition has-[:focus-visible]:border-[#bd9c00] ${
                      isUploading ? 'cursor-wait border-[#e0c95a] bg-[#fffbea]' : 'border-[#d8e0ea] bg-[#fafbfd] hover:border-[#9fb3c8] hover:bg-[#f5f8fb]'
                    }`}
                  >
                    <span className={`grid size-10 place-items-center rounded-xl ${isUploading ? 'bg-[#ffdc32] text-[#092a53]' : 'bg-white text-[#355777] shadow-sm'}`}>
                      {isUploading
                        ? <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
                        : <Icon className="size-5" path={icons.upload} />}
                    </span>
                    <span className="text-sm font-bold text-[#102c50]">{isUploading ? t('Uploading image…') : t('Click to upload an image')}</span>
                    <span className="text-xs text-[#7b8796]">{t('Upload a JPEG, PNG, WebP, or GIF image (max 5 MB).')}</span>
                    <input accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" disabled={isUploading} onChange={handleImageUpload} type="file" />
                  </label>
                  <label className={labelClassName}>
                    {t('Image URL or path')}
                    <input className={inputClassName} maxLength={2000} name="image" onChange={handleChange} placeholder="/images/menu-item.webp" required value={form.image} />
                    <span className="mt-1 block text-[11px] font-medium text-[#8190a1]">{t('Use a site image path or an HTTPS image URL.')}</span>
                  </label>
                </fieldset>

                {error && (
                  <p className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100" role="alert">
                    <Icon className="mt-0.5 size-4 shrink-0" path={icons.alert} />
                    {error}
                  </p>
                )}
              </div>

              <footer className="flex items-center justify-end gap-3 border-t border-[#edf1f5] bg-[#fafbfd] px-6 py-4">
                <button className="min-h-10 rounded-xl px-4 text-sm font-bold text-[#4f6379] transition hover:bg-[#eef2f6] hover:text-[#092a53]" onClick={cancelEdit} type="button">
                  {t('Cancel')}
                </button>
                <button
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#092a53] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#163e6b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] disabled:cursor-wait disabled:opacity-60"
                  disabled={isSaving || isUploading}
                  type="submit"
                >
                  <Icon path={editingItemId ? icons.check : icons.plus} />
                  {isSaving ? t('Saving menu item…') : t(editingItemId ? 'Save changes' : 'Add menu item')}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {itemToDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center px-5" role="presentation">
          <button aria-label={t('Cancel')} className="admin-drawer-backdrop absolute inset-0 bg-[#0b1e36]/45 backdrop-blur-[2px]" onClick={() => setItemToDelete(null)} tabIndex={-1} type="button" />
          <section
            aria-labelledby="delete-menu-item-title"
            aria-modal="true"
            className="admin-modal-panel relative w-full max-w-md rounded-[22px] bg-white p-6 shadow-[0_30px_80px_rgba(9,42,83,0.3)]"
            role="dialog"
          >
            <span className="grid size-12 place-items-center rounded-2xl bg-red-50 text-red-600">
              <Icon className="size-6" path={icons.trash} />
            </span>
            <h2 className="mt-4 font-display text-xl font-extrabold text-[#092a53]" id="delete-menu-item-title">
              {t('Delete menu item "{name}"?', { name: itemToDelete.name })}
            </h2>
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-[#f7f9fc] p-3 ring-1 ring-[#e8edf3]">
              <Thumb src={itemToDelete.image} />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[#102c50]">{itemToDelete.name}</p>
                <p className="text-xs text-[#7b8796]">{t(itemToDelete.categoryTitle)} · {formatPrice(itemToDelete.priceXaf)}</p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#65748a]">{t('It will be removed from the public menu. This cannot be undone.')}</p>
            {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700" role="alert">{error}</p>}
            <div className="mt-6 flex justify-end gap-2.5">
              <button className="min-h-10 rounded-xl px-4 text-sm font-bold text-[#4f6379] transition hover:bg-[#eef2f6]" onClick={() => setItemToDelete(null)} type="button">
                {t('Cancel')}
              </button>
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-wait disabled:opacity-60"
                disabled={deletingItemId === itemToDelete.id}
                onClick={handleDelete}
                type="button"
              >
                <Icon path={icons.trash} />
                {deletingItemId === itemToDelete.id ? t('Deleting…') : t('Delete')}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
