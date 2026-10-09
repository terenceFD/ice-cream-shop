import { useEffect, useState } from 'react'
import { apiRequest } from '../../../api/api'
import { useAdminAuth } from './AdminAuthContext'
import { useLanguage } from '../../../language/LanguageContext'

const inputClassName = 'mt-1.5 w-full rounded-xl border border-[#d9d6cc] bg-white px-4 py-3 text-sm font-normal text-[#102c50] outline-none transition focus:border-[#bd9c00] focus:ring-2 focus:ring-[#ffdc32]/40'
const initialForm = {
  categoryTitle: '',
  name: '',
  detail: '',
  image: '',
  priceXaf: '',
  stock: '100',
  isAvailable: true,
}

export function AdminMenuPage() {
  const { sessionToken } = useAdminAuth()
  const { t } = useLanguage()
  const [form, setForm] = useState(initialForm)
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [deletingItemId, setDeletingItemId] = useState(null)
  const [editingItemId, setEditingItemId] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([
      apiRequest('/menu'),
      apiRequest('/admin/menu-categories', { token: sessionToken }),
    ])
      .then(([menuResult, categoryResult]) => {
        if (!cancelled) {
          setItems(menuResult.categories.flatMap((category) => category.items.filter((item) => item.id?.startsWith('menu:custom:'))))
          setCategories(categoryResult.categories)
          setForm((current) => ({ ...current, categoryTitle: current.categoryTitle || categoryResult.categories[0]?.title || '' }))
        }
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [sessionToken])

  function handleChange(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: name === 'isAvailable' ? event.target.checked : value }))
  }

  async function handleImageUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setError('')
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError(t('Choose a JPEG, PNG, WebP, or GIF image smaller than 5 MB.'))
      event.target.value = ''
      return
    }
    setIsUploading(true)
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(new Error('Could not read the selected image.'))
        reader.readAsDataURL(file)
      })
      const { image } = await apiRequest('/admin/uploads', {
        method: 'POST',
        token: sessionToken,
        body: { dataUrl },
      })
      setForm((current) => ({ ...current, image }))
    } catch (uploadError) {
      setError(uploadError.message)
    } finally {
      setIsUploading(false)
      event.target.value = ''
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    setIsSaving(true)
    try {
      const isEditing = editingItemId !== null
      const itemId = isEditing ? editingItemId.split(':').at(-1) : null
      const { item } = await apiRequest(
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
      setMessage(t(isEditing ? 'Menu item updated.' : 'Menu item added and is now available on the website.'))
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setIsSaving(false)
    }
  }

  function handleEdit(item) {
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
  }

  function cancelEdit() {
    setEditingItemId(null)
    setForm((current) => ({ ...initialForm, categoryTitle: current.categoryTitle }))
    setError('')
    setMessage('')
  }

  async function handleDelete(item) {
    if (!window.confirm(t('Delete menu item "{name}"?', { name: item.name }))) return
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
      setMessage(t('Menu item deleted.'))
    } catch (deleteError) {
      setError(deleteError.message)
    } finally {
      setDeletingItemId(null)
    }
  }

  return (
    <div className="min-w-0">
      <div className="mb-8">
        <p className="mb-2 inline-block rounded-full bg-[#ffeb9c] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em]">
          {t('Store management')}
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t('Menu management')}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#65748a]">
          {t('Add menu items to an existing category. New items are saved and shown in the public menu.')}
        </p>
      </div>

      <div className="grid min-w-0 items-start gap-8 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section className="min-w-0 rounded-[24px] border border-[#d9d6cc] bg-white p-5 shadow-[0_8px_30px_rgba(18,44,80,0.05)] sm:p-7">
          <h2 className="font-display text-2xl font-bold">{t(editingItemId ? 'Edit menu item' : 'Add a menu item')}</h2>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <label className="block text-sm font-semibold">
              {t('Menu category')}
              <select className={inputClassName} name="categoryTitle" onChange={handleChange} value={form.categoryTitle}>
                {categories.map((category) => (
                  <option key={category.title} value={category.title}>{t(category.title)}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              {t('Menu item name')}
              <input className={inputClassName} maxLength="120" name="name" onChange={handleChange} required value={form.name} />
            </label>
            <label className="block text-sm font-semibold">
              {t('Short description')}
              <textarea className={`${inputClassName} min-h-24 resize-y`} maxLength="500" name="detail" onChange={handleChange} required value={form.detail} />
            </label>
            <label className="block text-sm font-semibold">
              {t('Image URL or path')}
              <input className={inputClassName} maxLength="2000" name="image" onChange={handleChange} placeholder="/images/menu-item.webp" required value={form.image} />
              <span className="mt-1 block text-xs font-normal text-[#65748a]">{t('Use a site image path or an HTTPS image URL.')}</span>
              <input accept="image/jpeg,image/png,image/webp,image/gif" className="mt-3 block w-full text-xs font-normal" disabled={isUploading} onChange={handleImageUpload} type="file" />
              <span className="mt-1 block text-xs font-normal text-[#65748a]">{isUploading ? t('Uploading image…') : t('Upload a JPEG, PNG, WebP, or GIF image (max 5 MB).')}</span>
            </label>
            <label className="block text-sm font-semibold">
              {t('Price (FCFA)')}
              <input className={inputClassName} min="1" name="priceXaf" onChange={handleChange} required step="1" type="number" value={form.priceXaf} />
            </label>
            <label className="block text-sm font-semibold">
              {t('Stock quantity')}
              <input className={inputClassName} min="0" name="stock" onChange={handleChange} required step="1" type="number" value={form.stock} />
            </label>
            <label className="flex items-center gap-3 text-sm font-semibold">
              <input checked={form.isAvailable} name="isAvailable" onChange={handleChange} type="checkbox" />
              {t('Available to order')}
            </label>
            {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}
            {message && <p className="rounded-xl bg-[#fff0a8] px-4 py-3 text-sm text-[#624f00]" role="status">{message}</p>}
            <div className="flex flex-wrap gap-3">
              <button className="min-w-0 flex-1 rounded-full bg-[#ffdc32] px-6 py-3.5 text-sm font-bold transition hover:-translate-y-0.5 hover:bg-[#ffe76c] disabled:cursor-wait disabled:opacity-60" disabled={isSaving || isUploading} type="submit">
                {isSaving || isUploading ? t('Saving menu item…') : t(editingItemId ? 'Save changes' : 'Add menu item')}
              </button>
              {editingItemId && (
                <button className="rounded-full border border-[#d9d6cc] px-5 py-3.5 text-sm font-bold transition hover:bg-[#f4f1e7]" onClick={cancelEdit} type="button">
                  {t('Cancel')}
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="min-w-0">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold">{t('Added menu items')}</h2>
              <p className="mt-1 text-sm text-[#65748a]">{items.length} {t('custom menu items')}</p>
            </div>
          </div>
          {isLoading ? (
            <p className="rounded-xl bg-[#f4f2f2] px-4 py-3 text-sm text-[#65748a]">{t('Loading menu items…')}</p>
          ) : items.length === 0 ? (
            <p className="rounded-xl bg-[#f4f2f2] px-4 py-3 text-sm text-[#65748a]">{t('No custom menu items yet.')}</p>
          ) : (
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              {items.map((item) => (
                <article className="flex min-w-0 gap-3 rounded-2xl border border-[#d9d6cc] bg-white p-3" key={item.id}>
                  <img alt="" className="size-20 shrink-0 rounded-xl object-cover" src={item.image} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{item.name}</p>
                    <p className="mt-1 text-xs text-[#65748a]">{t(item.categoryTitle)}</p>
                    <p className="mt-1 text-sm font-semibold">{new Intl.NumberFormat('fr-CM').format(item.priceXaf)} FCFA</p>
                    <p className="mt-1 text-xs text-[#65748a]">{t('Stock')}: {item.availableQuantity} / {item.stock} · {item.isAvailable ? t('Available') : t('Unavailable')}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button className="rounded-full border border-[#d9d6cc] px-3 py-1.5 text-xs font-bold text-[#65748a] transition hover:border-[#bd9c00] hover:text-[#806a00]" onClick={() => handleEdit(item)} type="button">
                        {t('Edit')}
                      </button>
                      <button className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-60" disabled={deletingItemId === item.id} onClick={() => handleDelete(item)} type="button">
                        {deletingItemId === item.id ? t('Deleting…') : t('Delete')}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
