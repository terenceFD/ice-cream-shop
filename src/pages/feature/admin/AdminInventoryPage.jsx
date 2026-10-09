import { useEffect, useState } from 'react'
import { apiRequest } from '../../../api/api'
import { useAdminAuth } from './AdminAuthContext'
import { useLanguage } from '../../../language/LanguageContext'

const dietaryOptions = ['vegetarian', 'vegan', 'dairy-free', 'gluten-free', 'nut-free']

export function AdminInventoryPage() {
  const { sessionToken } = useAdminAuth()
  const { t } = useLanguage()
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState('')

  useEffect(() => {
    let cancelled = false
    apiRequest('/menu')
      .then(({ categories }) => {
        if (!cancelled) setItems(categories.flatMap((category) =>
          category.items.map((item) => ({ ...item, categoryTitle: category.title })),
        ))
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  function updateItem(itemId, updates) {
    setItems((current) => current.map((item) => item.id === itemId ? { ...item, ...updates } : item))
  }

  async function saveItem(item) {
    setError('')
    setMessage('')
    setSavingId(item.id)
    try {
      const updated = await apiRequest('/admin/menu-inventory', {
        method: 'PUT',
        token: sessionToken,
        body: {
          itemId: item.id,
          stock: Number(item.stock),
          isAvailable: item.isAvailable,
          dietaryTags: item.dietaryTags || [],
          lowStockThreshold: Number(item.lowStockThreshold ?? 5),
        },
      })
      updateItem(item.id, {
        ...updated,
        reservedStock: item.reservedStock || 0,
        availableQuantity: Math.max(0, updated.stock - (item.reservedStock || 0)),
      })
      setMessage(t('Inventory updated.'))
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSavingId('')
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">{t('Menu inventory')}</h1>
      <p className="mt-2 text-sm leading-6 text-[#65748a]">{t('Set stock, availability, and dietary tags for every menu item.')}</p>
      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
      {message && <p className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800" role="status">{message}</p>}
      {loading ? <p className="mt-6 text-sm text-[#65748a]">{t('Loading menu items…')}</p> : (
        <div className="mt-6 grid gap-3">
          {items.map((item) => (
            <article className="grid gap-4 rounded-2xl border border-[#d9d6cc] bg-white p-4 lg:grid-cols-[minmax(150px,1fr)_110px_130px_160px_minmax(210px,1.4fr)_auto]" key={item.id}>
              <div className="min-w-0">
                <p className="truncate font-bold">{item.name}</p>
                <p className="mt-1 text-xs text-[#65748a]">{t(item.categoryTitle)}</p>
                <p className="mt-1 text-xs text-[#65748a]">{item.availableQuantity} {t('available now')}</p>
              </div>
              <label className="text-xs font-bold">
                {t('Stock quantity')}
                <input className="mt-1 w-full rounded-lg border border-[#d9d6cc] px-3 py-2 text-sm" min={item.reservedStock || 0} onChange={(event) => updateItem(item.id, { stock: Number(event.target.value) })} type="number" value={item.stock} />
              </label>
              <label className="text-xs font-bold">
                {t('Low-stock threshold')}
                <input className="mt-1 w-full rounded-lg border border-[#d9d6cc] px-3 py-2 text-sm" min="0" onChange={(event) => updateItem(item.id, { lowStockThreshold: Number(event.target.value) })} type="number" value={item.lowStockThreshold ?? 5} />
              </label>
              <label className="flex items-center gap-2 self-center text-sm font-semibold">
                <input checked={item.isAvailable !== false} onChange={(event) => updateItem(item.id, { isAvailable: event.target.checked })} type="checkbox" />
                {t('Available to order')}
              </label>
              <fieldset className="flex flex-wrap gap-x-3 gap-y-2">
                <legend className="mb-2 w-full text-xs font-bold">{t('Dietary needs')}</legend>
                {dietaryOptions.map((tag) => (
                  <label className="flex items-center gap-1.5 text-xs" key={tag}>
                    <input checked={item.dietaryTags?.includes(tag) || false} onChange={(event) => {
                      const tags = new Set(item.dietaryTags || [])
                      if (event.target.checked) tags.add(tag)
                      else tags.delete(tag)
                      updateItem(item.id, { dietaryTags: [...tags] })
                    }} type="checkbox" />
                    {t(tag)}
                  </label>
                ))}
              </fieldset>
              <button className="self-center rounded-full bg-[#ffdc32] px-4 py-2 text-sm font-bold disabled:opacity-50" disabled={savingId === item.id} onClick={() => saveItem(item)} type="button">
                {savingId === item.id ? t('Saving…') : t('Save')}
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
