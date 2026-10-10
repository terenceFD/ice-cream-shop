import { useEffect, useState } from 'react'
import { apiRequest } from '../../../api/api'
import { useAdminAuth } from './AdminAuthContext'
import { useLanguage } from '../../../language/LanguageContext'

const emptyCategory = { title: '', description: '', image: '', icon: '🍦', sortOrder: 0 }
const fieldClass = 'mt-1.5 w-full rounded-xl border border-[#e7e3d9] bg-[#fbfaf5] px-4 py-3 text-sm font-normal text-[#102c50] outline-none transition focus:border-[#bd9c00] focus:bg-white focus:ring-2 focus:ring-[#ffdc32]/40'

export function AdminCategoriesPage() {
  const { sessionToken } = useAdminAuth()
  const { t } = useLanguage()
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(emptyCategory)
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const builtInCount = categories.filter((category) => category.baseTitle).length
  const customCount = categories.length - builtInCount

  async function refresh() {
    const { categories: rows } = await apiRequest('/admin/menu-categories', { token: sessionToken })
    setCategories(rows)
  }

  useEffect(() => {
    let cancelled = false
    apiRequest('/admin/menu-categories', { token: sessionToken })
      .then(({ categories: rows }) => { if (!cancelled) setCategories(rows) })
      .catch((loadError) => { if (!cancelled) setError(loadError.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [sessionToken])

  async function submit(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    try {
      const { category } = await apiRequest(
        editingId ? `/admin/menu-categories/${editingId}` : '/admin/menu-categories',
        { method: editingId ? 'PUT' : 'POST', token: sessionToken, body: { ...form, sortOrder: Number(form.sortOrder) } },
      )
      setCategories((current) => editingId
        ? current.map((entry) => entry.id === editingId ? category : entry).sort((a, b) => a.sortOrder - b.sortOrder)
        : [...current, category].sort((a, b) => a.sortOrder - b.sortOrder))
      setForm(emptyCategory)
      setEditingId(null)
      setMessage(t('Menu category saved.'))
    } catch (saveError) {
      setError(saveError.message)
    }
  }

  function edit(category) {
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
  }

  async function remove(category) {
    if (!window.confirm(t('Delete category "{name}"?', { name: category.title }))) return
    setError('')
    try {
      await apiRequest(`/admin/menu-categories/${category.id}`, { method: 'DELETE', token: sessionToken })
      await refresh()
      setMessage(t('Menu category deleted.'))
    } catch (deleteError) {
      setError(deleteError.message)
    }
  }

  return (
    <div className="min-w-0 space-y-6">
      <section className="relative isolate overflow-hidden rounded-[24px] bg-[#092a53] p-6 text-white shadow-[0_14px_36px_rgba(9,42,83,0.14)] sm:p-8">
        <div aria-hidden="true" className="absolute -right-16 -top-28 size-72 rounded-full border-[54px] border-white/[0.04]" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#ffdc32]">{t('Catalog organization')}</p>
            <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{t('Menu categories')}</h1>
            <p className="mt-2 text-sm leading-6 text-white/70">{t('Create, rename, and reorder categories. A category can only be deleted when it has no menu items.')}</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold">
            <span aria-hidden="true" className="size-2 rounded-full bg-[#ffdc32]" />
            {t('{count} categories', { count: categories.length })}
          </span>
        </div>
      </section>

      <section aria-label={t('Category overview')} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: 'Total categories', value: categories.length, icon: '▦', tone: 'bg-[#fff0a8] text-[#806a00]' },
          { label: 'Built-in categories', value: builtInCount, icon: '✓', tone: 'bg-[#e9f1fa] text-[#315982]' },
          { label: 'Custom categories', value: customCount, icon: '+', tone: 'bg-[#e5f3d8] text-[#37632c]' },
        ].map((metric) => (
          <article className="rounded-[18px] border border-[#e7e3d9] bg-white p-4 shadow-[0_6px_20px_rgba(18,44,80,0.04)] sm:p-5" key={metric.label}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[#65748a]">{t(metric.label)}</p>
              <span aria-hidden="true" className={`grid size-9 place-items-center rounded-xl text-sm font-bold ${metric.tone}`}>{metric.icon}</span>
            </div>
            <p className="mt-3 font-display text-2xl font-extrabold text-[#102c50]">{metric.value.toLocaleString()}</p>
          </article>
        ))}
      </section>

      <div className="grid min-w-0 grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(300px,0.72fr)_minmax(0,1.28fr)]">
        <section className="min-w-0 rounded-[22px] border border-[#e7e3d9] bg-white p-5 shadow-[0_10px_32px_rgba(18,44,80,0.06)] sm:p-7">
          <div className="mb-6 border-b border-[#e7e3d9] pb-5">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#a48700]">{t(editingId ? 'Edit category' : 'Category setup')}</p>
            <h2 className="mt-1 font-display text-2xl font-bold">{t(editingId ? 'Edit category' : 'Add category')}</h2>
            <p className="mt-2 text-sm leading-6 text-[#65748a]">{t('Define the name, visual identity, and order customers will see.')}</p>
          </div>
          <form className="space-y-4" onSubmit={submit}>
            <label className="block text-sm font-semibold">{t('Category name')}<input className={fieldClass} maxLength={80} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder={t('Enter a category name')} required value={form.title} /></label>
            <label className="block text-sm font-semibold">{t('Description')}<textarea className={`${fieldClass} min-h-24 resize-y`} maxLength={300} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder={t('Add a short description for customers')} value={form.description} /></label>
            <label className="block text-sm font-semibold">{t('Image URL or path')}<input className={fieldClass} onChange={(event) => setForm({ ...form, image: event.target.value })} placeholder="/images/category.jpg" value={form.image} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-semibold">{t('Icon')}<input className={fieldClass} maxLength={12} onChange={(event) => setForm({ ...form, icon: event.target.value })} value={form.icon} /></label>
              <label className="block text-sm font-semibold">{t('Display order')}<input className={fieldClass} min="0" onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} type="number" value={form.sortOrder} /></label>
            </div>
            {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
            {message && <p className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800" role="status">{message}</p>}
            <div className="flex flex-wrap gap-2 pt-1">
              <button className="rounded-xl bg-[#092a53] px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#163e6b]" type="submit">{t(editingId ? 'Save category' : 'Add category')}</button>
              {editingId && <button className="rounded-xl border border-[#d9d6cc] px-4 py-3 text-sm font-bold text-[#52647b] transition hover:bg-[#fbfaf5]" onClick={() => { setEditingId(null); setForm(emptyCategory) }} type="button">{t('Cancel')}</button>}
            </div>
          </form>
        </section>

        <section className="min-w-0">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#a48700]">{t('Category library')}</p>
              <h2 className="mt-1 font-display text-2xl font-bold">{t('Current categories')}</h2>
            </div>
            {!loading && <p className="text-sm text-[#65748a]">{t('{count} categories', { count: categories.length })}</p>}
          </div>
          {loading ? (
            <p className="rounded-[20px] border border-[#e7e3d9] bg-white p-6 text-sm text-[#65748a]" role="status">{t('Loading…')}</p>
          ) : error && categories.length === 0 ? (
            <p className="rounded-[20px] border border-red-200 bg-red-50 p-6 text-sm text-red-700" role="alert">{error}</p>
          ) : categories.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {categories.map((category) => (
                <article className="overflow-hidden rounded-[20px] border border-[#e7e3d9] bg-white shadow-[0_6px_22px_rgba(18,44,80,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(18,44,80,0.08)]" key={category.id}>
                  <div className="relative aspect-[1.8] bg-[#f4f1e7]">
                    {category.image ? (
                      <img alt="" className="size-full object-cover" src={category.image} />
                    ) : (
                      <div aria-hidden="true" className="grid size-full place-items-center bg-[#fff8dd] text-4xl">{category.icon}</div>
                    )}
                    <span className="absolute left-3 top-3 rounded-full border border-white/70 bg-white/95 px-3 py-1.5 text-[10px] font-bold text-[#52647b] shadow-sm">
                      {category.baseTitle ? t('Built-in category') : t('Custom category')}
                    </span>
                    <span className="absolute right-3 top-3 grid size-9 place-items-center rounded-xl bg-white/95 text-lg shadow-sm">{category.icon}</span>
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate font-display text-lg font-bold text-[#102c50]">{category.title}</h3>
                        <p className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-[#65748a]">{category.description || t('No description provided.')}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-[#fbfaf5] px-2.5 py-1 text-[10px] font-bold text-[#65748a]">{t('Order')}: {category.sortOrder}</span>
                    </div>
                    <div className="mt-4 flex gap-2 border-t border-[#eeeae1] pt-3">
                      <button className="flex-1 rounded-xl border border-[#d9d6cc] px-3 py-2 text-xs font-bold text-[#52647b] transition hover:border-[#092a53] hover:bg-[#fbfaf5] hover:text-[#092a53]" onClick={() => edit(category)} type="button">{t('Edit')}</button>
                      <button className="flex-1 rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-50" onClick={() => remove(category)} type="button">{t('Delete')}</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="rounded-[20px] border border-[#e7e3d9] bg-white p-8 text-center text-sm text-[#65748a]">{t('No categories yet.')}</p>
          )}
        </section>
      </div>
    </div>
  )
}
