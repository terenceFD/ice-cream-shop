import { useEffect, useState } from 'react'
import { apiRequest } from '../../../api/api'
import { useAdminAuth } from './AdminAuthContext'
import { useLanguage } from '../../../language/LanguageContext'

const dietaryOptions = ['vegetarian', 'vegan', 'dairy-free', 'gluten-free', 'nut-free']
type InventoryFilter = 'all' | 'low' | 'unavailable'

interface InventoryItem {
  id: string
  name: string
  categoryTitle: string
  stock: number
  reservedStock: number
  availableQuantity: number
  isAvailable: boolean
  dietaryTags: string[]
  lowStockThreshold?: number
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
  const [expandedId, setExpandedId] = useState<string>('')

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
      setError(saveError instanceof Error ? saveError.message : 'Unable to update inventory.')
    } finally {
      setSavingId('')
    }
  }

  const categories = [...new Set(items.map((item) => item.categoryTitle))].sort((a, b) => a.localeCompare(b))
  const availableCount = items.filter((item) => item.isAvailable !== false && item.availableQuantity > 0).length
  const lowStockCount = items.filter((item) => item.stock > 0 && item.stock <= (item.lowStockThreshold ?? 5)).length
  const unitsOnHand = items.reduce((total, item) => total + item.stock, 0)
  const normalizedSearch = search.trim().toLocaleLowerCase()
  const filteredItems = items.filter((item) => {
    const matchesSearch = !normalizedSearch
      || item.name.toLocaleLowerCase().includes(normalizedSearch)
      || item.categoryTitle.toLocaleLowerCase().includes(normalizedSearch)
    const matchesCategory = !categoryFilter || item.categoryTitle === categoryFilter
    const matchesStatus = inventoryFilter === 'all'
      || (inventoryFilter === 'low' && item.stock > 0 && item.stock <= (item.lowStockThreshold ?? 5))
      || (inventoryFilter === 'unavailable' && (item.isAvailable === false || item.availableQuantity === 0))
    return matchesSearch && matchesCategory && matchesStatus
  })

  return (
    <div className="min-w-0 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-[#102c50]">{t('Menu inventory')}</h1>
          <p className="mt-2 text-sm text-[#65748a]">{t('Set stock, availability, and dietary tags for every menu item.')}</p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-[#e5f3d8] px-4 py-2 text-xs font-semibold text-[#37632c]">
          <span className="size-2 rounded-full bg-[#37632c]" />
          {items.length} {t('Menu items')}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: t('Available'), value: availableCount, icon: '✓', color: 'bg-green-50 text-green-700 border-green-200' },
          { label: t('Low stock'), value: lowStockCount, icon: '!', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
          { label: t('Units on hand'), value: unitsOnHand, icon: '📦', color: 'bg-blue-50 text-blue-700 border-blue-200' },
          { label: t('Total items'), value: items.length, icon: '▤', color: 'bg-gray-50 text-gray-700 border-gray-200' },
        ].map((stat, idx) => (
          <div key={idx} className={`rounded-lg border p-4 ${stat.color}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium opacity-75">{stat.label}</p>
                <p className="mt-1 text-2xl font-bold">{stat.value}</p>
              </div>
              <div className="text-3xl">{stat.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="flex gap-3 rounded-lg border border-red-300 bg-red-50 p-4 text-red-800" role="alert">
          <span className="text-lg">⚠️</span>
          <span>{error}</span>
        </div>
      )}
      {message && (
        <div className="flex gap-3 rounded-lg border border-green-300 bg-green-50 p-4 text-green-800" role="status">
          <span className="text-lg">✓</span>
          <span>{message}</span>
        </div>
      )}

      {/* Filters Section */}
      <div className="rounded-lg border border-[#e7e3d9] bg-white p-4 sm:p-6">
        <h2 className="mb-4 text-sm font-semibold text-[#102c50]">{t('Filters & Search')}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-[#52647b]">{t('Search')}</label>
            <div className="relative mt-2">
              <svg className="absolute left-3 top-3 size-5 text-[#8290a1]" fill="none" viewBox="0 0 20 20">
                <circle cx="8.8" cy="8.8" r="5.8" stroke="currentColor" strokeWidth="1.6" />
                <path d="m13.2 13.2 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
              </svg>
              <input
                className="w-full rounded-lg border border-[#dce5ef] bg-white py-2 pl-10 pr-3 text-sm outline-none focus:border-[#bd9c00]"
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('Search by name or category')}
                type="search"
                value={search}
              />
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-sm font-medium text-[#52647b]">{t('Category')}</label>
            <select
              className="mt-2 w-full rounded-lg border border-[#dce5ef] bg-white py-2 px-3 text-sm text-[#355777] outline-none focus:border-[#bd9c00]"
              onChange={(event) => setCategoryFilter(event.target.value)}
              value={categoryFilter}
            >
              <option value="">{t('All categories')}</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {t(category)}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-[#52647b]">{t('Status')}</label>
            <select
              className="mt-2 w-full rounded-lg border border-[#dce5ef] bg-white py-2 px-3 text-sm text-[#355777] outline-none focus:border-[#bd9c00]"
              onChange={(event) => setInventoryFilter(event.target.value as InventoryFilter)}
              value={inventoryFilter}
            >
              <option value="all">{t('All inventory')}</option>
              <option value="low">{t('Low stock')}</option>
              <option value="unavailable">{t('Unavailable')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Items Table/Grid */}
      <div className="overflow-hidden rounded-lg border border-[#e7e3d9] bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <span className="text-[#65748a]">{t('Loading menu items…')}</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <span className="text-4xl">⌕</span>
            <p className="mt-4 font-semibold text-[#102c50]">
              {items.length ? t('No inventory items match your filters.') : t('No menu items yet.')}
            </p>
            {items.length > 0 && (
              <button
                className="mt-4 text-sm font-semibold text-[#315982] underline"
                onClick={() => {
                  setSearch('')
                  setCategoryFilter('')
                  setInventoryFilter('all')
                }}
              >
                {t('Clear filters')}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-[#e7e3d9] bg-[#f8f8f8]">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-[#52647b]">{t('Item Name')}</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-[#52647b]">{t('Category')}</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-[#52647b]">{t('Stock')}</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-[#52647b]">{t('Reserved')}</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-[#52647b]">{t('Available')}</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-[#52647b]">{t('Status')}</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-[#52647b]">{t('Action')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, idx) => {
                  const threshold = item.lowStockThreshold ?? 5
                  const isLowStock = item.stock > 0 && item.stock <= threshold
                  const statusBadge =
                    item.isAvailable === false
                      ? { label: t('Unavailable'), color: 'bg-red-100 text-red-800' }
                      : item.availableQuantity === 0
                        ? { label: t('Sold out'), color: 'bg-gray-100 text-gray-800' }
                        : isLowStock
                          ? { label: t('Low stock'), color: 'bg-yellow-100 text-yellow-800' }
                          : { label: t('In stock'), color: 'bg-green-100 text-green-800' }

                  return (
                    <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#f9f9f9]'}>
                      <td className="px-6 py-4 text-sm font-semibold text-[#102c50]">{item.name}</td>
                      <td className="px-6 py-4 text-sm text-[#65748a]">{t(item.categoryTitle)}</td>
                      <td className="px-6 py-4 text-center text-sm font-semibold text-[#102c50]">{item.stock}</td>
                      <td className="px-6 py-4 text-center text-sm text-[#65748a]">{item.reservedStock || 0}</td>
                      <td className="px-6 py-4 text-center text-sm font-semibold text-[#315982]">{item.availableQuantity}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadge.color}`}>
                          {statusBadge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          className="text-sm font-semibold text-[#315982] hover:text-[#102c50]"
                          onClick={() => setExpandedId(expandedId === item.id ? '' : item.id)}
                        >
                          {expandedId === item.id ? t('Hide') : t('Edit')}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Expanded Edit Row */}
        {expandedId && filteredItems.find((i) => i.id === expandedId) && (
          <div className="border-t border-[#e7e3d9] bg-[#f8f8f8] p-6">
            {(() => {
              const item = filteredItems.find((i) => i.id === expandedId)!
              const threshold = item.lowStockThreshold ?? 5
              return (
                <div className="space-y-6">
                  <h3 className="text-lg font-bold text-[#102c50]">{t('Edit')}: {item.name}</h3>

                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Stock Quantity */}
                    <div>
                      <label className="block text-sm font-semibold text-[#52647b]">{t('Stock quantity')}</label>
                      <input
                        className="mt-2 w-full rounded-lg border border-[#dce5ef] bg-white px-3 py-2 text-sm outline-none focus:border-[#bd9c00]"
                        min={item.reservedStock || 0}
                        onChange={(event) => updateItem(item.id, { stock: Number(event.target.value) })}
                        type="number"
                        value={item.stock}
                      />
                    </div>

                    {/* Low Stock Threshold */}
                    <div>
                      <label className="block text-sm font-semibold text-[#52647b]">{t('Low-stock threshold')}</label>
                      <input
                        className="mt-2 w-full rounded-lg border border-[#dce5ef] bg-white px-3 py-2 text-sm outline-none focus:border-[#bd9c00]"
                        min="0"
                        onChange={(event) => updateItem(item.id, { lowStockThreshold: Number(event.target.value) })}
                        type="number"
                        value={threshold}
                      />
                    </div>
                  </div>

                  {/* Availability Toggle */}
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-[#dce5ef] bg-white p-4">
                    <input
                      className="size-4 accent-[#092a53]"
                      checked={item.isAvailable !== false}
                      onChange={(event) => updateItem(item.id, { isAvailable: event.target.checked })}
                      type="checkbox"
                    />
                    <span className="flex-1 font-semibold text-[#52647b]">{t('Available to order')}</span>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${item.isAvailable !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {item.isAvailable !== false ? t('On') : t('Off')}
                    </span>
                  </label>

                  {/* Dietary Tags */}
                  <div>
                    <label className="block text-sm font-semibold text-[#52647b]">{t('Dietary needs')}</label>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {dietaryOptions.map((tag) => (
                        <label
                          className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#dce5ef] bg-white px-3 py-2 text-sm font-medium text-[#52647b] hover:border-[#bd9c00]"
                          key={tag}
                        >
                          <input
                            className="size-4 accent-[#092a53]"
                            checked={item.dietaryTags?.includes(tag) || false}
                            onChange={(event) => {
                              const tags = new Set(item.dietaryTags || [])
                              if (event.target.checked) tags.add(tag)
                              else tags.delete(tag)
                              updateItem(item.id, { dietaryTags: [...tags] })
                            }}
                            type="checkbox"
                          />
                          {t(tag)}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="flex justify-end gap-3 border-t border-[#e7e3d9] pt-6">
                    <button
                      className="rounded-lg border border-[#dce5ef] bg-white px-5 py-2 font-semibold text-[#52647b] hover:bg-[#f8f8f8]"
                      onClick={() => setExpandedId('')}
                      type="button"
                    >
                      {t('Cancel')}
                    </button>
                    <button
                      className="rounded-lg bg-[#ffdc32] px-6 py-2 font-semibold text-[#092a53] transition hover:bg-[#ffe76c] disabled:opacity-50"
                      disabled={savingId === item.id}
                      onClick={() => saveItem(item)}
                      type="button"
                    >
                      {savingId === item.id ? t('Saving…') : t('Save changes')}
                    </button>
                  </div>
                </div>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
