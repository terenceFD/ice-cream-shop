import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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
  const { t, language } = useLanguage()
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
  const availableCount = items.filter((item) => item.isAvailable && item.availableQuantity > 0).length
  const unavailableCount = items.length - availableCount
  const remainingUnits = items.reduce((total, item) => total + Math.max(0, item.availableQuantity || 0), 0)
  const formatPrice = (price) => `${new Intl.NumberFormat(language === 'fr' ? 'fr-CM' : 'en-CM').format(price)} FCFA`

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
    <div className="min-w-0 space-y-6">
      <section className="relative isolate overflow-hidden rounded-[26px] bg-[#092a53] p-6 text-white shadow-[0_16px_42px_rgba(9,42,83,0.16)] sm:p-8">
        <div aria-hidden="true" className="absolute -right-16 -top-28 -z-10 size-72 rounded-full border-[52px] border-white/[0.05]" />
        <div aria-hidden="true" className="absolute -bottom-24 right-[30%] -z-10 size-52 rounded-full bg-[#ffdc32]/[0.08] blur-2xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl">
            <p className="mb-3 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#ffdc32]">{t('Store management')}</p>
            <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{t('Menu management')}</h1>
            <p className="mt-3 text-sm leading-6 text-white/75">{t('Add menu items to an existing category. New items are saved and shown in the public menu.')}</p>
          </div>
          <Link className="inline-flex items-center gap-2 rounded-full bg-[#ffdc32] px-5 py-3 text-sm font-extrabold text-[#092a53] transition hover:-translate-y-0.5 hover:bg-[#ffe76c]" to="/menu">
            {t('View public menu')} <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>

      <section aria-label={t('Menu inventory overview')} className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: 'Custom menu items', value: items.length, icon: '▤', accent: 'bg-[#edf3f9] text-[#092a53]' },
          { label: 'Available now', value: availableCount, icon: '✓', accent: 'bg-[#e5f3d8] text-[#37632c]' },
          { label: 'Unavailable', value: unavailableCount, icon: '!', accent: 'bg-[#fff0ed] text-[#b34334]' },
          { label: 'Remaining units', value: remainingUnits, icon: '◇', accent: 'bg-[#fff0a8] text-[#806a00]' },
        ].map((stat) => (
          <article className="flex min-w-0 items-center gap-3 rounded-[20px] border border-[#e7e3d9] bg-white p-4 shadow-[0_8px_24px_rgba(18,44,80,0.04)] sm:gap-4 sm:p-5" key={stat.label}>
            <span aria-hidden="true" className={`grid size-11 shrink-0 place-items-center rounded-2xl text-lg font-extrabold ${stat.accent}`}>{stat.icon}</span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-[#65748a]">{t(stat.label)}</p>
              <p className="mt-0.5 font-display text-2xl font-extrabold text-[#102c50]">{stat.value}</p>
            </div>
          </article>
        ))}
      </section>

      <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(300px,0.78fr)_minmax(0,1.22fr)]">
        <section className="min-w-0 overflow-hidden rounded-[24px] border border-[#e7e3d9] bg-white shadow-[0_10px_32px_rgba(18,44,80,0.06)]">
          <div className="border-b border-[#eeeae1] bg-[#fffefa] px-5 py-5 sm:px-7">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#a48700]">{t(editingItemId ? 'Edit menu item' : 'Menu editor')}</p>
            <h2 className="mt-1 font-display text-2xl font-extrabold">{t(editingItemId ? 'Edit menu item' : 'Add a menu item')}</h2>
            <p className="mt-2 text-sm leading-6 text-[#65748a]">{t('Add menu items to an existing category. New items are saved and shown in the public menu.')}</p>
          </div>
          <form className="space-y-4 p-5 sm:p-7" onSubmit={handleSubmit}>
            <label className="block text-xs font-extrabold text-[#52647b]">
              {t('Menu category')}
              <select className={inputClassName} name="categoryTitle" onChange={handleChange} required value={form.categoryTitle}>
                <option disabled value="">{t('Select a category')}</option>
                {categories.map((category) => (
                  <option key={category.title} value={category.title}>{t(category.title)}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-extrabold text-[#52647b]">
              {t('Menu item name')}
              <input className={inputClassName} maxLength="120" name="name" onChange={handleChange} required value={form.name} />
            </label>
            <label className="block text-xs font-extrabold text-[#52647b]">
              {t('Short description')}
              <textarea className={`${inputClassName} min-h-24 resize-y`} maxLength="500" name="detail" onChange={handleChange} required value={form.detail} />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-extrabold text-[#52647b]">
                {t('Price (FCFA)')}
                <input className={inputClassName} min="1" name="priceXaf" onChange={handleChange} required step="1" type="number" value={form.priceXaf} />
              </label>
              <label className="block text-xs font-extrabold text-[#52647b]">
                {t('Stock quantity')}
                <input className={inputClassName} min="0" name="stock" onChange={handleChange} required step="1" type="number" value={form.stock} />
              </label>
            </div>
            <label className="block text-xs font-extrabold text-[#52647b]">
              {t('Image URL or path')}
              <input className={inputClassName} maxLength="2000" name="image" onChange={handleChange} placeholder="/images/menu-item.webp" required value={form.image} />
              <span className="mt-1 block text-xs font-normal leading-5 text-[#65748a]">{t('Use a site image path or an HTTPS image URL.')}</span>
              <input accept="image/jpeg,image/png,image/webp,image/gif" className="mt-3 block w-full text-xs font-normal" disabled={isUploading} onChange={handleImageUpload} type="file" />
              <span className="mt-1 block text-xs font-normal text-[#65748a]">{isUploading ? t('Uploading image…') : t('Upload a JPEG, PNG, WebP, or GIF image (max 5 MB).')}</span>
            </label>
            {form.image && (
              <div className="flex items-center gap-3 rounded-2xl border border-[#e7e3d9] bg-[#fbfaf5] p-3">
                <img alt="" className="size-16 rounded-xl bg-white object-cover" src={form.image} />
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-[#52647b]">{t('Image preview')}</p>
                  <p className="mt-1 truncate text-xs text-[#8792a0]">{form.image}</p>
                </div>
              </div>
            )}
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#e7e3d9] bg-[#fbfaf5] p-4 text-sm font-bold text-[#52647b] transition hover:border-[#d9c76d]">
              <input className="size-4 accent-[#092a53]" checked={form.isAvailable} name="isAvailable" onChange={handleChange} type="checkbox" />
              <span className="flex-1">{t('Available to order')}</span>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${form.isAvailable ? 'bg-[#e5f3d8] text-[#37632c]' : 'bg-[#fff0ed] text-[#b34334]'}`}>{form.isAvailable ? t('Available') : t('Unavailable')}</span>
            </label>
            {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}
            {message && <p className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800" role="status">{message}</p>}
            <div className="flex flex-wrap gap-3 border-t border-[#eeeae1] pt-4">
              <button className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-[#092a53] px-5 py-3.5 text-sm font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-[#163e6b] disabled:cursor-wait disabled:opacity-60" disabled={isSaving || isUploading} type="submit">
                {isSaving || isUploading ? t('Saving menu item…') : t(editingItemId ? 'Save changes' : 'Add menu item')} {!isSaving && !isUploading && <span aria-hidden="true">→</span>}
              </button>
              {editingItemId && (
                <button className="rounded-full border border-[#d9d6cc] px-5 py-3.5 text-sm font-bold text-[#52647b] transition hover:bg-[#f4f1e7]" onClick={cancelEdit} type="button">
                  {t('Cancel')}
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="min-w-0">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#a48700]">{t('Menu inventory')}</p>
              <h2 className="mt-1 font-display text-2xl font-extrabold">{t('Added menu items')}</h2>
              <p className="mt-1 text-sm text-[#65748a]">{t('{count} items', { count: items.length })}</p>
            </div>
          </div>
          {isLoading ? (
            <p className="rounded-[22px] border border-[#e7e3d9] bg-white p-6 text-sm text-[#65748a]" role="status">{t('Loading menu items…')}</p>
          ) : items.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-[#d9d6cc] bg-white px-6 py-12 text-center">
              <span aria-hidden="true" className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#fff3b8] text-2xl text-[#806a00]">🍨</span>
              <h3 className="mt-4 font-display text-xl font-extrabold text-[#102c50]">{t('No custom menu items yet.')}</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#65748a]">{t('Add menu items to an existing category. New items are saved and shown in the public menu.')}</p>
            </div>
          ) : (
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              {items.map((item) => {
                const available = item.isAvailable && item.availableQuantity > 0
                return (
                  <article className="group min-w-0 overflow-hidden rounded-[22px] border border-[#e7e3d9] bg-white shadow-[0_8px_26px_rgba(18,44,80,0.05)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(18,44,80,0.1)]" key={item.id}>
                    <div className="relative aspect-[1.75] overflow-hidden bg-[#f4f1e7]">
                      <img alt={item.name} className="size-full object-cover transition duration-500 group-hover:scale-[1.04]" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/images/hero-ice-cream.jpg' }} src={item.image} />
                      <span className="absolute left-3 top-3 max-w-[60%] truncate rounded-full border border-white/70 bg-white/95 px-3 py-1.5 text-[10px] font-bold text-[#52647b] shadow-sm">{t(item.categoryTitle)}</span>
                      <span className={`absolute right-3 top-3 rounded-full px-3 py-1.5 text-[10px] font-extrabold shadow-sm ${available ? 'bg-[#edf8e9] text-[#37632c]' : 'bg-red-50 text-red-700'}`}>{available ? t('Available') : t('Unavailable')}</span>
                    </div>
                    <div className="p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate font-display text-lg font-extrabold text-[#102c50]">{item.name}</h3>
                          <p className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-[#65748a]">{item.detail}</p>
                        </div>
                        <p className="shrink-0 text-right font-display text-sm font-extrabold text-[#092a53]">{formatPrice(item.priceXaf)}</p>
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#eeeae1] pt-3 text-xs">
                        <p className="text-[#65748a]">{t('Stock')}: <span className="font-bold text-[#52647b]">{item.availableQuantity} / {item.stock}</span></p>
                        <div className="flex gap-2">
                          <button aria-label={`${t('Edit')} ${item.name}`} className="rounded-full border border-[#d9d6cc] px-3.5 py-2 font-bold text-[#52647b] transition hover:border-[#092a53] hover:bg-[#f7f9fb] hover:text-[#092a53] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00]" onClick={() => handleEdit(item)} type="button">
                            {t('Edit')}
                          </button>
                          <button aria-label={`${t('Delete')} ${item.name}`} className="rounded-full border border-red-200 px-3.5 py-2 font-bold text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:cursor-wait disabled:opacity-60" disabled={deletingItemId === item.id} onClick={() => handleDelete(item)} type="button">
                            {deletingItemId === item.id ? t('Deleting…') : t('Delete')}
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
