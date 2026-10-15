import { useEffect, useState, type FormEvent } from 'react'
import { apiRequest } from '../../api/api'
import { useAdminAuth } from './useAdminAuth'
import { useLanguage } from '../../language/useLanguage'

const emptyCategory = { title: '', description: '', image: '', icon: '🍦', sortOrder: 0 }
const inputClassName = 'mt-1.5 w-full rounded-xl border border-[#dde4ec] bg-[#f8fafc] px-3.5 py-2.5 text-sm font-medium text-[#102c50] transition placeholder:text-[#9aa5b3] hover:border-[#c9d4e0] focus:border-[#bd9c00] focus:bg-white focus:ring-4 focus:ring-[#ffdc32]/25 outline-none!'
const labelClassName = 'block text-xs font-bold text-[#4f6379]'
const iconSuggestions = ['🍦', '🍨', '🍧', '🎂', '🧁', '🥤', '☕', '🍪', '🍫', '🍓']

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
    <span aria-hidden="true" className={`${className} grid place-items-center bg-gradient-to-br from-[#fff8dd] to-[#ffeaa0] text-2xl`}>
      {category.icon || '🍦'}
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
      setIsEditorOpen(false)
      setCategoryToDelete(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOverlayOpen])

  function openAdd() {
    setEditingId(null)
    setForm({ ...emptyCategory, sortOrder: categories.length ? Math.max(...categories.map((category) => category.sortOrder)) + 1 : 0 })
    setError('')
    setIsEditorOpen(true)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    setIsSaving(true)
    try {
      const { category } = await apiRequest<{ category: MenuCategory }>(
        editingId ? `/admin/menu-categories/${editingId}` : '/admin/menu-categories',
        { method: editingId ? 'PUT' : 'POST', token: sessionToken, body: { ...form, sortOrder: Number(form.sortOrder) } },
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
    { label: 'Total categories', value: categories.length, icon: icons.grid, accent: 'bg-[#fff4c2] text-[#8a6f00]', filter: 'all' as const },
    { label: 'Built-in categories', value: builtInCount, icon: icons.lock, accent: 'bg-[#e9f1fa] text-[#315982]', filter: 'built-in' as const },
    { label: 'Custom categories', value: customCount, icon: icons.sparkle, accent: 'bg-[#e5f4ea] text-[#2c7a4f]', filter: 'custom' as const },
  ]

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-col gap-5 border-b border-[#edf1f5] pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#092a53] text-[#ffdc32]">
            <Icon className="size-7" path={icons.grid} />
          </span>
          <div className="min-w-0">
            <nav aria-label={t('Breadcrumb')} className="text-[11px] font-bold text-[#8190a1]">
              {t('Catalog organization')} <span aria-hidden="true" className="mx-1">/</span>
              <span className="text-[#8a7000]">{t('Categories')}</span>
            </nav>
            <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-[#092a53] sm:text-[1.9rem]">{t('Menu categories')}</h1>
            <p className="mt-0.5 max-w-2xl text-sm text-[#65748a]">
              {t('Create, rename, and reorder categories. A category can only be deleted when it has no menu items.')}
            </p>
          </div>
        </div>
        <button
          className="inline-flex min-h-10 items-center gap-2 self-start rounded-xl bg-[#092a53] px-4 text-sm font-bold text-white shadow-[0_6px_16px_rgba(9,42,83,0.18)] transition hover:-translate-y-0.5 hover:bg-[#163e6b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] xl:self-auto"
          onClick={openAdd}
          type="button"
        >
          <Icon path={icons.plus} />
          {t('Add category')}
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
      {error && !isOverlayOpen && (
        <p className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100" role="alert">
          <Icon className="mt-0.5 size-4 shrink-0" path={icons.alert} />
          {error}
        </p>
      )}

      <section aria-label={t('Category overview')} className="admin-stats grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map((metric) => {
          const isActive = typeFilter === metric.filter && metric.filter !== 'all'
          return (
            <button
              aria-pressed={isActive}
              className={`group rounded-2xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(18,44,80,0.07)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] sm:p-5 ${
                isActive ? 'border-[#092a53] shadow-[0_0_0_1px_#092a53]' : 'border-[#e5ebf3]'
              }`}
              key={metric.label}
              onClick={() => setTypeFilter(isActive ? 'all' : metric.filter)}
              type="button"
            >
              <span className={`grid size-9 place-items-center rounded-xl ${metric.accent}`}><Icon path={metric.icon} /></span>
              <p className="mt-4 font-display text-[1.75rem] font-extrabold leading-none tracking-tight text-[#102c50]">{metric.value.toLocaleString()}</p>
              <p className="mt-1.5 text-xs font-semibold text-[#65748a]">{t(metric.label)}</p>
            </button>
          )
        })}
        <div className="rounded-2xl border border-dashed border-[#d8e0ea] bg-[#fafbfd] p-4 sm:p-5">
          <span className="grid size-9 place-items-center rounded-xl bg-[#f1f4f8] text-[#65748a]"><Icon path={icons.alert} /></span>
          <p className="mt-4 font-display text-[1.75rem] font-extrabold leading-none tracking-tight text-[#102c50]">{emptyCount}</p>
          <p className="mt-1.5 text-xs font-semibold text-[#65748a]">{t('Empty categories')}</p>
        </div>
      </section>

      <section aria-labelledby="category-list-title" className="min-w-0 rounded-[20px] border border-[#e5ebf3] bg-white">
        <div className="flex flex-col gap-4 border-b border-[#edf1f5] p-4 sm:p-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-display text-xl font-extrabold text-[#092a53]" id="category-list-title">{t('Current categories')}</h2>
            <p className="mt-0.5 text-xs text-[#65748a]">
              {canReorder ? t('Use the arrows to change the order customers see.') : t('Clear the search and filters to reorder categories.')}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="relative block sm:w-72">
              <span className="sr-only">{t('Search')}</span>
              <Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#8190a1]" path={icons.search} />
              <input className={`${inputClassName} mt-0 pl-10`} onChange={(event) => setSearch(event.target.value)} placeholder={t('Search categories')} type="search" value={search} />
            </label>
            <div aria-label={t('Category type')} className="flex rounded-xl bg-[#f1f4f8] p-1" role="group">
              {([
                { key: 'all', label: t('All') },
                { key: 'built-in', label: t('Built-in') },
                { key: 'custom', label: t('Custom') },
              ] as const).map((option) => (
                <button
                  aria-pressed={typeFilter === option.key}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition ${typeFilter === option.key ? 'bg-white text-[#092a53] shadow-sm' : 'text-[#65748a] hover:text-[#092a53]'}`}
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
          <div aria-label={t('Loading…')} className="space-y-3 p-4 sm:p-5" role="status">
            {[0, 1, 2, 3].map((row) => (
              <div className="flex animate-pulse items-center gap-4" key={row}>
                <span className="size-14 rounded-2xl bg-[#eef2f6]" />
                <span className="h-3 flex-1 rounded bg-[#eef2f6]" />
                <span className="h-3 w-24 rounded bg-[#eef2f6]" />
              </div>
            ))}
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#f1f4f8] text-[#8190a1]"><Icon className="size-5" path={icons.grid} /></span>
            <p className="mt-4 font-display text-lg font-extrabold text-[#092a53]">
              {t(categories.length ? 'No categories match your search.' : 'No categories yet.')}
            </p>
          </div>
        ) : (
          <ol className="divide-y divide-[#f0f3f7]">
            {filteredCategories.map((category) => {
              const index = categories.findIndex((entry) => entry.id === category.id)
              const count = itemCounts[category.title] ?? 0
              return (
                <li className={`group flex flex-col gap-4 px-4 py-4 transition hover:bg-[#fafbfd] sm:flex-row sm:items-center sm:px-5 ${movingId === category.id ? 'opacity-60' : ''}`} key={category.id}>
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <span className="w-7 shrink-0 text-center font-display text-sm font-extrabold tabular-nums text-[#a3b0bf]">{index + 1}</span>
                    <div className="relative shrink-0">
                      <CategoryVisual category={category} className="size-14 rounded-2xl ring-1 ring-black/5" />
                      <span aria-hidden="true" className="absolute -bottom-1.5 -right-1.5 grid size-7 place-items-center rounded-lg bg-white text-sm shadow-sm ring-1 ring-[#e3e9f0]">{category.icon}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-display text-base font-extrabold text-[#102c50]">{category.title}</h3>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${category.baseTitle ? 'bg-[#e9f1fa] text-[#315982]' : 'bg-[#e5f4ea] text-[#2c7a4f]'}`}>
                          <Icon className="size-3" path={category.baseTitle ? icons.lock : icons.sparkle} />
                          {category.baseTitle ? t('Built-in') : t('Custom')}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-1 max-w-xl text-xs text-[#7b8796]">{category.description || t('No description provided.')}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pl-11 sm:justify-end sm:pl-0">
                    <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${count ? 'bg-[#f1f4f8] text-[#355777]' : 'bg-[#fff6e5] text-[#9a6200]'}`}>
                      {t('{count} items', { count })}
                    </span>
                    <div className="flex items-center gap-1">
                      <div className="mr-1 flex rounded-lg ring-1 ring-[#e3e9f0]">
                        <button
                          aria-label={t('Move up')}
                          className="grid size-8 place-items-center rounded-l-lg text-[#6b7d91] transition hover:bg-[#eef2f7] hover:text-[#092a53] disabled:opacity-30 disabled:hover:bg-transparent"
                          disabled={!canReorder || index === 0 || movingId !== null}
                          onClick={() => move(category, -1)}
                          title={t('Move up')}
                          type="button"
                        >
                          <Icon path={icons.up} />
                        </button>
                        <button
                          aria-label={t('Move down')}
                          className="grid size-8 place-items-center rounded-r-lg border-l border-[#e3e9f0] text-[#6b7d91] transition hover:bg-[#eef2f7] hover:text-[#092a53] disabled:opacity-30 disabled:hover:bg-transparent"
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
                        className="grid size-8 place-items-center rounded-lg text-[#6b7d91] transition hover:bg-[#eef2f7] hover:text-[#092a53] focus-visible:outline-2 focus-visible:outline-[#bd9c00]"
                        onClick={() => edit(category)}
                        title={t('Edit')}
                        type="button"
                      >
                        <Icon path={icons.edit} />
                      </button>
                      <button
                        aria-label={`${t('Delete')} ${category.title}`}
                        className="grid size-8 place-items-center rounded-lg text-[#6b7d91] transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-red-400 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#6b7d91]"
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
          <button aria-label={t('Close')} className="admin-drawer-backdrop absolute inset-0 bg-[#0b1e36]/45 backdrop-blur-[2px]" onClick={() => setIsEditorOpen(false)} tabIndex={-1} type="button" />
          <section aria-labelledby="category-drawer-title" aria-modal="true" className="admin-drawer-panel relative flex h-full w-full max-w-[32rem] flex-col bg-white shadow-[-24px_0_60px_rgba(9,42,83,0.18)]" role="dialog">
            <header className="flex items-start justify-between gap-4 border-b border-[#edf1f5] px-6 py-5">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#8a7000]">{t(editingId ? 'Edit category' : 'Category setup')}</p>
                <h2 className="mt-1 font-display text-2xl font-extrabold text-[#092a53]" id="category-drawer-title">{t(editingId ? 'Edit category' : 'Add category')}</h2>
                <p className="mt-1 text-sm text-[#65748a]">{t('Define the name, visual identity, and order customers will see.')}</p>
              </div>
              <button aria-label={t('Close')} className="grid size-9 shrink-0 place-items-center rounded-xl text-[#65748a] transition hover:bg-[#f1f4f8] hover:text-[#092a53]" onClick={() => setIsEditorOpen(false)} type="button">
                <Icon className="size-5" path={icons.close} />
              </button>
            </header>

            <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6">
                <div className="overflow-hidden rounded-2xl ring-1 ring-[#e8edf3]">
                  <CategoryVisual category={form} className="aspect-[2.4] w-full" key={form.image} />
                  <div className="flex items-center gap-3 bg-[#f7f9fc] p-3">
                    <span aria-hidden="true" className="grid size-10 place-items-center rounded-xl bg-white text-xl shadow-sm">{form.icon || '🍦'}</span>
                    <div className="min-w-0">
                      <p className="truncate font-display text-base font-extrabold text-[#092a53]">{form.title || t('Category name')}</p>
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
                <label className={labelClassName}>
                  {t('Image URL or path')}
                  <input className={inputClassName} onChange={(event) => setForm({ ...form, image: event.target.value })} placeholder="/images/category.jpg" value={form.image} />
                  <span className="mt-1 block text-[11px] font-medium text-[#8190a1]">{t('Use a site image path or an HTTPS image URL.')}</span>
                </label>

                <fieldset>
                  <legend className={labelClassName}>{t('Icon')}</legend>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {iconSuggestions.map((icon) => (
                      <button
                        aria-label={icon}
                        aria-pressed={form.icon === icon}
                        className={`grid size-10 place-items-center rounded-xl text-lg transition ${form.icon === icon ? 'bg-[#fff6cc] ring-2 ring-[#e8c400]' : 'bg-[#f7f9fc] ring-1 ring-[#e3e9f0] hover:ring-[#c3cfdc]'}`}
                        key={icon}
                        onClick={() => setForm({ ...form, icon })}
                        type="button"
                      >
                        {icon}
                      </button>
                    ))}
                    <input
                      aria-label={t('Custom icon')}
                      className="h-10 w-20 rounded-xl border border-[#dde4ec] bg-[#f8fafc] px-2 text-center text-lg outline-none! focus:border-[#bd9c00] focus:ring-4 focus:ring-[#ffdc32]/25"
                      maxLength={12}
                      onChange={(event) => setForm({ ...form, icon: event.target.value })}
                      value={form.icon}
                    />
                  </div>
                </fieldset>

                <label className={labelClassName}>
                  {t('Display order')}
                  <input className={`${inputClassName} sm:w-40`} min="0" onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} type="number" value={form.sortOrder} />
                  <span className="mt-1 block text-[11px] font-medium text-[#8190a1]">{t('Lower numbers appear first on the menu.')}</span>
                </label>

                {error && (
                  <p className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100" role="alert">
                    <Icon className="mt-0.5 size-4 shrink-0" path={icons.alert} />
                    {error}
                  </p>
                )}
              </div>

              <footer className="flex items-center justify-end gap-3 border-t border-[#edf1f5] bg-[#fafbfd] px-6 py-4">
                <button className="min-h-10 rounded-xl px-4 text-sm font-bold text-[#4f6379] transition hover:bg-[#eef2f6] hover:text-[#092a53]" onClick={() => setIsEditorOpen(false)} type="button">
                  {t('Cancel')}
                </button>
                <button
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#092a53] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#163e6b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] disabled:cursor-wait disabled:opacity-60"
                  disabled={isSaving}
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
          <button aria-label={t('Cancel')} className="admin-drawer-backdrop absolute inset-0 bg-[#0b1e36]/45 backdrop-blur-[2px]" onClick={() => setCategoryToDelete(null)} tabIndex={-1} type="button" />
          <section aria-labelledby="delete-category-title" aria-modal="true" className="admin-modal-panel relative w-full max-w-md rounded-[22px] bg-white p-6 shadow-[0_30px_80px_rgba(9,42,83,0.3)]" role="dialog">
            <span className="grid size-12 place-items-center rounded-2xl bg-red-50 text-red-600"><Icon className="size-6" path={icons.trash} /></span>
            <h2 className="mt-4 font-display text-xl font-extrabold text-[#092a53]" id="delete-category-title">
              {t('Delete category "{name}"?', { name: categoryToDelete.title })}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#65748a]">{t('It will be removed from the public menu. This cannot be undone.')}</p>
            {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700" role="alert">{error}</p>}
            <div className="mt-6 flex justify-end gap-2.5">
              <button className="min-h-10 rounded-xl px-4 text-sm font-bold text-[#4f6379] transition hover:bg-[#eef2f6]" onClick={() => setCategoryToDelete(null)} type="button">{t('Cancel')}</button>
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-wait disabled:opacity-60"
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
