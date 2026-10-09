import { useEffect, useState } from 'react'
import { apiRequest } from '../../../api/api'
import { useAdminAuth } from './AdminAuthContext'
import { useLanguage } from '../../../language/LanguageContext'

const emptyCategory = { title: '', description: '', image: '', icon: '🍦', sortOrder: 0 }
const fieldClass = 'mt-1 w-full rounded-xl border border-[#d9d6cc] bg-white px-3 py-2.5 text-sm'

export function AdminCategoriesPage() {
  const { sessionToken } = useAdminAuth()
  const { t } = useLanguage()
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(emptyCategory)
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

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
    <div className="grid min-w-0 grid-cols-1 gap-8 xl:grid-cols-[minmax(280px,0.7fr)_minmax(0,1.3fr)]">
      <section className="min-w-0">
        <h1 className="font-display text-3xl font-bold">{t(editingId ? 'Edit category' : 'Menu categories')}</h1>
        <p className="mt-2 text-sm leading-6 text-[#65748a]">{t('Create, rename, and reorder categories. A category can only be deleted when it has no menu items.')}</p>
        <form className="mt-5 space-y-3 rounded-2xl border border-[#d9d6cc] bg-white p-5" onSubmit={submit}>
          <label className="block text-sm font-semibold">{t('Category name')}<input className={fieldClass} maxLength={80} onChange={(event) => setForm({ ...form, title: event.target.value })} required value={form.title} /></label>
          <label className="block text-sm font-semibold">{t('Description')}<textarea className={fieldClass} maxLength={300} onChange={(event) => setForm({ ...form, description: event.target.value })} value={form.description} /></label>
          <label className="block text-sm font-semibold">{t('Image URL or path')}<input className={fieldClass} onChange={(event) => setForm({ ...form, image: event.target.value })} value={form.image} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-semibold">{t('Icon')}<input className={fieldClass} maxLength={12} onChange={(event) => setForm({ ...form, icon: event.target.value })} value={form.icon} /></label>
            <label className="block text-sm font-semibold">{t('Display order')}<input className={fieldClass} min="0" onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} type="number" value={form.sortOrder} /></label>
          </div>
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
          {message && <p className="rounded-xl bg-green-50 p-3 text-sm text-green-800" role="status">{message}</p>}
          <div className="flex gap-2">
            <button className="rounded-full bg-[#ffdc32] px-5 py-2.5 text-sm font-bold" type="submit">{t(editingId ? 'Save category' : 'Add category')}</button>
            {editingId && <button className="rounded-full border px-4 py-2.5 text-sm font-bold" onClick={() => { setEditingId(null); setForm(emptyCategory) }} type="button">{t('Cancel')}</button>}
          </div>
        </form>
      </section>
      <section className="min-w-0">
        <h2 className="font-display text-2xl font-bold">{t('Current categories')}</h2>
        {loading ? <p className="mt-4 text-sm text-[#65748a]">{t('Loading…')}</p> : (
          <div className="mt-4 space-y-3">
            {categories.map((category) => (
              <article className="flex items-center gap-3 rounded-2xl border border-[#d9d6cc] bg-white p-3" key={category.id}>
                {category.image && <img alt="" className="size-14 rounded-xl object-cover" src={category.image} />}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{category.icon} {category.title}</p>
                  <p className="text-xs text-[#65748a]">{t('Order')}: {category.sortOrder}{category.baseTitle ? ` · ${t('Built-in category')}` : ''}</p>
                </div>
                <button className="rounded-full border px-3 py-1.5 text-xs font-bold" onClick={() => edit(category)} type="button">{t('Edit')}</button>
                <button className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700" onClick={() => remove(category)} type="button">{t('Delete')}</button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
