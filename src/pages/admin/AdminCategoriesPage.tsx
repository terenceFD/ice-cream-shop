import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { apiRequest } from '../../api/api'
import { prepareImageForUpload, UPLOAD_IMAGE_TYPES, UPLOAD_MAX_BYTES } from '../../lib/prepareUploadImage'
import { useAdminAuth } from './useAdminAuth'
import { useLanguage } from '../../language/useLanguage'
import { toInt } from '../../../shared/numbers.ts'

const emptyCategory = { title: '', description: '', image: '', icon: '', sortOrder: 0 }
const inputClassName = 'mt-1.5 min-h-11 w-full rounded-md border border-[#dce3eb] bg-[#f4f6f8] px-3.5 py-2.5 text-sm font-medium text-brand-navy transition placeholder:text-[#9aa5b3] hover:border-[#dce3eb] focus:border-brand-yellow-deep focus:bg-white focus:ring-4 focus:ring-brand-yellow/25 outline-none!'
const labelClassName = 'block text-xs font-bold text-[#65748a]'

interface MenuCategory {
  id: number
  title: string
  description: string
  image: string
  icon: string
  sortOrder: number
  baseTitle?: string
}

interface CategoryForm {
  title: string
  description: string
  image: string
  icon: string
  sortOrder: number | string
}

const icons = {
  plus: 'M12 5v14M5 12h14',
  search: 'm20 20-4.2-4.2M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z',
  grid: 'M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z',
  edit: 'M4 20h4L19 9l-4-4L4 16v4Zm9-13 4 4',
  trash: 'M4 7h16M10 11v6m4-6v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3',
  close: 'M6 6l12 12M18 6 6 18',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  alert: 'M12 8v5m0 3.5v.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  up: 'm6 15 6-6 6 6',
  down: 'm6 9 6 6 6-6',
  lock: 'M6 11h12v9H6v-9Zm2 0V8a4 4 0 0 1 8 0v3',
  sparkle: 'M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5m7 7L18 18m0-12-2.5 2.5m-7 7L6 18',
  iceCream: 'M5 10a7 7 0 0 1 14 0H5Zm1 2 4 8h4l4-8H6Z',
  upload: 'M12 16V4m0 0L7 9m5-5 5 5M5 20h14',
}

function Icon({ path, className = 'size-4' }: { path: string; className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d={path} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  )
}

function CategoryVisual({ category, className }: { category: Pick<MenuCategory, 'image' | 'icon'>; className: string }) {
  const [failed, setFailed] = useState(false)
  if (category.image && !failed) {
    return <img decoding="async" alt="" className={`${className} object-cover`} loading="lazy" onError={() => setFailed(true)} src={category.image} />
  }
  return (
    <span aria-hidden="true" className={`${className} grid place-items-center bg-[#f4f6f8] text-[#53647a]`}>
      {category.icon || <Icon className="size-6" path={icons.iceCream} />}
    </span>
  )
}

export function AdminCategoriesPage() {
  const { sessionToken } = useAdminAuth()
  const { t } = useLanguage()
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({})
  const [form, setForm] = useState<CategoryForm>(emptyCategory)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState<MenuCategory | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [movingId, setMovingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'built-in' | 'custom'>('all')
  const builtInCount = categories.filter((category) => category.baseTitle).length
  const customCount = categories.length - builtInCount
  const emptyCount = categories.filter((category) => !itemCounts[category.title]).length
  const query = search.trim().toLocaleLowerCase()
  const filteredCategories = categories.filter((category) => {
    const matchesSearch = !query || [category.title, category.description].some((value) =>
      (value || '').toLocaleLowerCase().includes(query) || t(value || '').toLocaleLowerCase().includes(query))
    const matchesType = typeFilter === 'all' || (typeFilter === 'built-in' ? Boolean(category.baseTitle) : !category.baseTitle)
    return matchesSearch && matchesType
  })
  const canReorder = !query && typeFilter === 'all'
  const isOverlayOpen = isEditorOpen || Boolean(categoryToDelete)

  async function refresh() {
    const { categories: rows } = await apiRequest<{ categories: MenuCategory[] }>('/admin/menu-categories', { token: sessionToken })
    setCategories(rows)
  }

  useEffect(() => {
    let cancelled = false
    apiRequest<{ categories: MenuCategory[] }>('/admin/menu-categories', { token: sessionToken })
      .then(({ categories: rows }) => { if (!cancelled) setCategories(rows) })
      .catch((loadError: unknown) => { if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unable to load categories.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    apiRequest<{ categories: { title: string; items: unknown[] }[] }>('/menu')
      .then(({ categories: menu }) => {
        if (!cancelled) setItemCounts(Object.fromEntries(menu.map((category) => [category.title, category.items.length])))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [sessionToken])

  useEffect(() => {
    if (!message) return undefined
    const timer = window.setTimeout(() => setMessage(''), 4000)
    return () => window.clearTimeout(timer)
  }, [message])

  useEffect(() => {
    if (!isOverlayOpen) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (isUploading) return
      setIsEditorOpen(false)
      setCategoryToDelete(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOverlayOpen, isUploading])

  function openAdd() {
    setEditingId(null)
    setForm({ ...emptyCategory, sortOrder: categories.length ? Math.max(...categories.map((category) => category.sortOrder)) + 1 : 0 })
    setError('')
    setIsEditorOpen(true)
  }

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    setError('')
    if (!UPLOAD_IMAGE_TYPES.includes(file.type) || (file.type === 'image/gif' && file.size > UPLOAD_MAX_BYTES)) {
      setError(t('Choose a JPEG, PNG, WebP, or GIF image smaller than 5 MB.'))
      input.value = ''
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
      setError(uploadError instanceof Error ? uploadError.message : t('Unable to upload the selected image.'))
    } finally {
      setIsUploading(false)
      input.value = ''
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isUploading) return
    setError('')
    setMessage('')
    setIsSaving(true)
    try {
      const { category } = await apiRequest<{ category: MenuCategory }>(
        editingId ? `/admin/menu-categories/${editingId}` : '/admin/menu-categories',
        { method: editingId ? 'PUT' : 'POST', token: sessionToken, body: { ...form, sortOrder: toInt(form.sortOrder, 0) } },
      )
      setCategories((current) => editingId
        ? current.map((entry) => entry.id === editingId ? category : entry).sort((a, b) => a.sortOrder - b.sortOrder)
        : [...current, category].sort((a, b) => a.sortOrder - b.sortOrder))
      setForm(emptyCategory)
      setEditingId(null)
      setIsEditorOpen(false)
      setMessage(t('Menu category saved.'))
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save category.')
    } finally {
      setIsSaving(false)
    }
  }

  function edit(category: MenuCategory) {
    setEditingId(category.id)
    setForm({
      title: category.title,
      description: category.description,
      image: category.image,
      icon: category.icon,
      sortOrder: category.sortOrder,
    })
    setError('')
    setMessage('')
    setIsEditorOpen(true)
  }

  async function remove() {
    const category = categoryToDelete
    if (!category) return
    setError('')
    setIsDeleting(true)
    try {
      await apiRequest(`/admin/menu-categories/${category.id}`, { method: 'DELETE', token: sessionToken })
      await refresh()
      setCategoryToDelete(null)
      setMessage(t('Menu category deleted.'))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete category.')
    } finally {
      setIsDeleting(false)
    }
  }

  async function move(category: MenuCategory, direction: -1 | 1) {
    const ordered = [...categories]
    const index = ordered.findIndex((entry) => entry.id === category.id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= ordered.length) return
    ;[ordered[index], ordered[target]] = [ordered[target], ordered[index]]
    const changed = ordered
      .map((entry, position) => ({ entry, position }))
      .filter(({ entry, position }) => entry.sortOrder !== position)
    setError('')
    setMovingId(category.id)
    try {
      const saved = await Promise.all(changed.map(({ entry, position }) =>
        apiRequest<{ category: MenuCategory }>(`/admin/menu-categories/${entry.id}`, {
          method: 'PUT',
          token: sessionToken,
          body: { title: entry.title, description: entry.description, image: entry.image, icon: entry.icon, sortOrder: position },
        })))
      const savedById = new Map(saved.map(({ category: entry }) => [entry.id, entry]))
      setCategories(ordered.map((entry, position) => savedById.get(entry.id) || { ...entry, sortOrder: position }))
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : 'Unable to save category.')
      await refresh().catch(() => {})
    } finally {
      setMovingId(null)
    }
  }

  const metrics = [
    { label: 'Total categories', value: categories.length, filter: 'all' as const },
    { label: 'Built-in categories', value: builtInCount, filter: 'built-in' as const },
    { label: 'Custom categories', value: customCount, filter: 'custom' as const },
  ]

  return (
    <div className="min-w-0 space-y-5">
      <header className="flex flex-col gap-4 border-b border-[#e5e9ee] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <nav aria-label={t('Breadcrumb')} className="text-xs font-medium text-[#65748a]">
            {t('Catalog organization')} <span aria-hidden="true" className="mx-1">/</span>
            <span className="text-brand-navy">{t('Categories')}</span>
          </nav>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-brand-navy">{t('Menu categories')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-[#53647a]">
            {t('Create, rename, and reorder categories. A category can only be deleted when it has no menu items.')}
          </p>
        </div>
        <button
          className="inline-flex min-h-11 items-center gap-2 self-start rounded-lg bg-brand-navy px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow-deep sm:min-h-10 sm:self-auto"
          onClick={openAdd}
          type="button"
        >
          <Icon path={icons.plus} />
          {t('Add category')}
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
      {error && !isOverlayOpen && (
        <p className="flex items-start gap-2 rounded-md bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100" role="alert">
          <Icon className="mt-0.5 size-4 shrink-0" path={icons.alert} />
          {error}
        </p>
      )}

      <section aria-label={t('Category overview')} className="grid grid-cols-2 overflow-hidden rounded-md border border-[#dce3eb] bg-white sm:grid-cols-4">
        {metrics.map((metric, index) => {
          const isActive = typeFilter === metric.filter
          return (
            <button
              aria-pressed={isActive}
              className={`relative min-h-[5.5rem] border-[#e5e9ee] px-4 py-3 text-left transition-colors hover:bg-[#fbfcfd] focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-yellow-deep sm:px-5 ${
                index % 2 === 0 ? 'border-r' : ''
              } ${index < 2 ? 'border-b' : ''} ${index < metrics.length ? 'sm:border-r sm:border-b-0' : ''} ${
                isActive ? 'bg-[#f4f6f8]' : 'bg-white'
              }`}
              key={metric.label}
              onClick={() => setTypeFilter(isActive ? 'all' : metric.filter)}
              type="button"
            >
              <p className="text-xs font-medium text-[#53647a]">{t(metric.label)}</p>
              <p className="mt-1 text-2xl font-semibold leading-none tabular-nums text-brand-navy">{metric.value.toLocaleString()}</p>
              {isActive && <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-brand-navy" />}
            </button>
          )
        })}
        <div className="min-h-[5.5rem] border-[#e5e9ee] px-4 py-3 sm:px-5">
          <p className="text-xs font-medium text-[#53647a]">{t('Empty categories')}</p>
          <p className="mt-1 text-2xl font-semibold leading-none tabular-nums text-brand-navy">{emptyCount.toLocaleString()}</p>
        </div>
      </section>

      <section aria-labelledby="category-list-title" className="min-w-0 rounded-md border border-[#dce3eb] bg-white">
        <div className="flex flex-col gap-4 border-b border-[#e5e9ee] p-4 sm:p-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-brand-navy" id="category-list-title">{t('Current categories')}</h2>
            <p aria-live="polite" className="mt-1 text-xs text-[#53647a]">
              {t('Showing {shown} of {total} categories', { shown: filteredCategories.length, total: categories.length })}
            </p>
            <p className="mt-1 text-xs text-[#53647a]">
              {canReorder ? t('Use the arrows to change the order customers see.') : t('Clear the search and filters to reorder categories.')}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative block sm:w-72">
              <span className="sr-only">{t('Search')}</span>
              <Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#65748a]" path={icons.search} />
              <input className={`${inputClassName} mt-0 pl-10`} onChange={(event) => setSearch(event.target.value)} placeholder={t('Search categories')} type="search" value={search} />
            </label>
            <div aria-label={t('Category type')} className="flex w-fit rounded-lg bg-[#f4f6f8] p-1" role="group">
              {([
                { key: 'all', label: t('All') },
                { key: 'built-in', label: t('Built-in') },
                { key: 'custom', label: t('Custom') },
              ] as const).map((option) => (
                <button
                  aria-pressed={typeFilter === option.key}
                  className={`min-h-11 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-brand-yellow-deep sm:min-h-8 ${typeFilter === option.key ? 'bg-white text-brand-navy ring-1 ring-[#dce3eb]' : 'text-[#53647a] hover:text-brand-navy'}`}
                  key={option.key}
                  onClick={() => setTypeFilter(option.key)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div aria-label={t('Loading…')} className="divide-y divide-[#edf0f3] px-4 sm:px-5" role="status">
            {[0, 1, 2, 3].map((row) => (
              <div className="flex min-h-[76px] items-center gap-4 py-3" key={row}>
                <span className="size-12 shrink-0 rounded-lg bg-[#e5e9ee]" />
                <span className="h-3 flex-1 rounded bg-[#e5e9ee]" />
                <span className="h-3 w-24 rounded bg-[#e5e9ee]" />
              </div>
            ))}
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="mt-4 text-sm font-semibold text-brand-navy">
              {t(categories.length ? 'No categories match your search.' : 'No categories yet.')}
            </p>
            {categories.length ? (
              <button
                className="mt-4 min-h-11 rounded-lg border border-[#dce3eb] px-4 text-xs font-semibold text-brand-blue transition-colors hover:bg-[#f4f6f8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow-deep sm:min-h-9"
                onClick={() => { setSearch(''); setTypeFilter('all') }}
                type="button"
              >
                {t('Clear filters')}
              </button>
            ) : (
              <button
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-navy px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow-deep sm:min-h-10"
                onClick={openAdd}
                type="button"
              >
                <Icon path={icons.plus} />
                {t('Add category')}
              </button>
            )}
          </div>
        ) : (
          <ol className="divide-y divide-[#edf0f3]">
            {filteredCategories.map((category) => {
              const index = categories.findIndex((entry) => entry.id === category.id)
              const count = itemCounts[category.title] ?? 0
              return (
                <li className={`flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-5 ${movingId === category.id ? 'opacity-60' : ''}`} key={category.id}>
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="w-6 shrink-0 text-center text-sm font-semibold tabular-nums text-[#65748a]">{index + 1}</span>
                    <CategoryVisual category={category} className="size-12 shrink-0 rounded-lg ring-1 ring-[#e5e9ee]" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-brand-navy">{category.title}</h3>
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#53647a]">
                          <Icon className="size-3" path={category.baseTitle ? icons.lock : icons.sparkle} />
                          {category.baseTitle ? t('Built-in') : t('Custom')}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-1 max-w-xl text-xs text-[#53647a]">{category.description || t('No description provided.')}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pl-9 sm:justify-end sm:pl-0">
                    <span className="whitespace-nowrap text-xs font-medium tabular-nums text-[#53647a]">
                      {t('{count} items', { count })}
                    </span>
                    <div className="flex items-center gap-1">
                      <div aria-label={t('Reorder category')} className="mr-1 flex rounded-md border border-[#dce3eb]" role="group">
                        <button
                          aria-label={t('Move up')}
                          className="grid size-11 place-items-center rounded-l-md text-[#53647a] transition-colors hover:bg-[#f4f6f8] hover:text-brand-navy focus-visible:outline-2 focus-visible:outline-brand-yellow-deep disabled:opacity-30 disabled:hover:bg-transparent sm:size-9"
                          disabled={!canReorder || index === 0 || movingId !== null}
                          onClick={() => move(category, -1)}
                          title={t('Move up')}
                          type="button"
                        >
                          <Icon path={icons.up} />
                        </button>
                        <button
                          aria-label={t('Move down')}
                          className="grid size-11 place-items-center rounded-r-md border-l border-[#dce3eb] text-[#53647a] transition-colors hover:bg-[#f4f6f8] hover:text-brand-navy focus-visible:outline-2 focus-visible:outline-brand-yellow-deep disabled:opacity-30 disabled:hover:bg-transparent sm:size-9"
                          disabled={!canReorder || index === categories.length - 1 || movingId !== null}
                          onClick={() => move(category, 1)}
                          title={t('Move down')}
                          type="button"
                        >
                          <Icon path={icons.down} />
                        </button>
                      </div>
                      <button
                        aria-label={`${t('Edit')} ${category.title}`}
                        className="grid size-11 place-items-center rounded-md text-[#53647a] transition-colors hover:bg-[#f4f6f8] hover:text-brand-navy focus-visible:outline-2 focus-visible:outline-brand-yellow-deep sm:size-9"
                        onClick={() => edit(category)}
                        title={t('Edit')}
                        type="button"
                      >
                        <Icon path={icons.edit} />
                      </button>
                      <button
                        aria-label={`${t('Delete')} ${category.title}`}
                        className="grid size-11 place-items-center rounded-md text-[#53647a] transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-red-400 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#53647a] sm:size-9"
                        disabled={count > 0}
                        onClick={() => { setError(''); setCategoryToDelete(category) }}
                        title={count > 0 ? t('Move or remove all menu items before deleting this category.') : t('Delete')}
                        type="button"
                      >
                        <Icon path={icons.trash} />
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </section>

      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
          <button aria-label={t('Close')} className="admin-drawer-backdrop absolute inset-0 bg-[#0b1e36]/45" disabled={isUploading} onClick={() => setIsEditorOpen(false)} tabIndex={-1} type="button" />
          <section aria-labelledby="category-drawer-title" aria-modal="true" className="admin-drawer-panel relative flex h-full w-full max-w-[32rem] flex-col bg-white shadow-[-24px_0_60px_rgba(9,42,83,0.18)]" role="dialog">
            <header className="flex items-start justify-between gap-4 border-b border-[#e5e9ee] px-6 py-5">
              <div>
                <p className="text-xs font-medium text-[#53647a]">{t(editingId ? 'Edit category' : 'Category setup')}</p>
                <h2 className="mt-1 text-xl font-semibold text-brand-navy" id="category-drawer-title">{t(editingId ? 'Edit category' : 'Add category')}</h2>
                <p className="mt-1 text-sm text-[#65748a]">{t('Define the name, visual identity, and order customers will see.')}</p>
              </div>
              <button aria-label={t('Close')} className="grid size-11 shrink-0 place-items-center rounded-md text-[#65748a] transition hover:bg-[#f4f6f8] hover:text-brand-navy disabled:cursor-wait disabled:opacity-50 sm:size-9" disabled={isUploading} onClick={() => setIsEditorOpen(false)} type="button">
                <Icon className="size-5" path={icons.close} />
              </button>
            </header>

            <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6">
                <div className="overflow-hidden rounded-md border border-[#dce3eb]">
                  <CategoryVisual category={form} className="aspect-[2.4] w-full" key={form.image} />
                  <div className="flex items-center gap-3 border-t border-[#e5e9ee] p-3">
                    <span aria-hidden="true" className="grid size-10 place-items-center rounded-lg bg-[#f4f6f8] text-[#53647a]">
                      {form.icon || <Icon className="size-5" path={icons.iceCream} />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-brand-navy">{form.title || t('Category name')}</p>
                      <p className="truncate text-xs text-[#65748a]">{form.description || t('Add a short description for customers')}</p>
                    </div>
                  </div>
                </div>

                <label className={labelClassName}>
                  {t('Category name')}
                  <input className={inputClassName} maxLength={80} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder={t('Enter a category name')} required value={form.title} />
                </label>
                <label className={labelClassName}>
                  <span className="flex justify-between gap-2">
                    {t('Description')}
                    <span className="font-semibold text-[#a3b0bf]">{form.description.length}/300</span>
                  </span>
                  <textarea className={`${inputClassName} min-h-24 resize-y`} maxLength={300} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder={t('Add a short description for customers')} value={form.description} />
                </label>
                <div>
                  <p className={labelClassName}>{t('Category image')}</p>
                  <label className={`mt-2 flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-md bg-[#eef3f9] px-4 py-3 text-sm font-bold text-brand-blue transition-colors hover:bg-[#e4ebf3] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-yellow-deep ${isUploading ? 'cursor-wait opacity-70' : ''}`}>
                    {isUploading
                      ? <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
                      : <Icon className="size-4" path={icons.upload} />}
                    <span aria-live="polite">{isUploading ? t('Uploading image…') : t(form.image ? 'Replace image' : 'Upload from device')}</span>
                    <input
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="sr-only"
                      disabled={isUploading}
                      onChange={handleImageUpload}
                      type="file"
                    />
                  </label>
                  <p className="mt-2 text-xs font-medium text-[#65748a]">{t('Upload a JPEG, PNG, WebP, or GIF image (max 5 MB).')}</p>
                </div>

                <label className={labelClassName}>
                  {t('Image URL or path')}
                  <input className={inputClassName} onChange={(event) => setForm({ ...form, image: event.target.value })} placeholder="/images/category.jpg" value={form.image} />
                  <span className="mt-1 block text-xs font-medium text-[#65748a]">{t('Use a site image path or an HTTPS image URL.')}</span>
                </label>

                <label className={labelClassName}>
                  {t('Icon')}
                  <input
                    aria-label={t('Custom icon')}
                    className={inputClassName}
                    maxLength={12}
                    onChange={(event) => setForm({ ...form, icon: event.target.value })}
                    value={form.icon}
                  />
                  <span className="mt-1 block text-xs font-medium text-[#53647a]">{t('Use an emoji or short symbol to identify this category.')}</span>
                </label>

                <label className={labelClassName}>
                  {t('Display order')}
                  <input className={`${inputClassName} sm:w-40`} min="0" onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} type="number" value={form.sortOrder} />
                  <span className="mt-1 block text-xs font-medium text-[#65748a]">{t('Lower numbers appear first on the menu.')}</span>
                </label>

                {error && (
                  <p className="flex items-start gap-2 rounded-md bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100" role="alert">
                    <Icon className="mt-0.5 size-4 shrink-0" path={icons.alert} />
                    {error}
                  </p>
                )}
              </div>

              <footer className="flex items-center justify-end gap-3 border-t border-[#e5e9ee] px-6 py-4">
                <button className="min-h-10 rounded-md px-4 text-sm font-bold text-[#65748a] transition hover:bg-[#f4f6f8] hover:text-brand-navy disabled:cursor-wait disabled:opacity-50" disabled={isUploading} onClick={() => setIsEditorOpen(false)} type="button">
                  {t('Cancel')}
                </button>
                <button
                  className="inline-flex min-h-11 items-center gap-2 rounded-md bg-brand-navy px-5 text-sm font-bold text-white transition hover:bg-brand-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow-deep disabled:cursor-wait disabled:opacity-60 sm:min-h-10"
                  disabled={isSaving || isUploading}
                  type="submit"
                >
                  <Icon path={editingId ? icons.check : icons.plus} />
                  {isSaving ? t('Saving…') : t(editingId ? 'Save category' : 'Add category')}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {categoryToDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center px-5" role="presentation">
          <button aria-label={t('Cancel')} className="admin-drawer-backdrop absolute inset-0 bg-[#0b1e36]/45" onClick={() => setCategoryToDelete(null)} tabIndex={-1} type="button" />
          <section aria-labelledby="delete-category-title" aria-modal="true" className="admin-modal-panel relative w-full max-w-md rounded-md bg-white p-6 shadow-[0_30px_80px_rgba(9,42,83,0.3)]" role="dialog">
            <span className="grid size-12 place-items-center rounded-md bg-red-50 text-red-600"><Icon className="size-6" path={icons.trash} /></span>
            <h2 className="mt-4 text-base font-semibold text-brand-navy" id="delete-category-title">
              {t('Delete category "{name}"?', { name: categoryToDelete.title })}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#65748a]">{t('It will be removed from the public menu. This cannot be undone.')}</p>
            {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700" role="alert">{error}</p>}
            <div className="mt-6 flex justify-end gap-2.5">
              <button className="min-h-10 rounded-md px-4 text-sm font-bold text-[#65748a] transition hover:bg-[#f4f6f8]" onClick={() => setCategoryToDelete(null)} type="button">{t('Cancel')}</button>
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-md bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-wait disabled:opacity-60"
                disabled={isDeleting}
                onClick={remove}
                type="button"
              >
                <Icon path={icons.trash} />
                {isDeleting ? t('Deleting…') : t('Delete')}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
