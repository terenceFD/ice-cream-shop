import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Footer, Header, InstagramSection } from '../../../components/Layout'
import { coldStoneMenuCategories, getMenuItemId } from '../../../data'
import { apiRequest, CUSTOMER_TOKEN_KEY } from '../../../api/api'
import { useCart } from '../../../CartContext'
import { useLanguage } from '../../../language/LanguageContext'
import { useAuth } from '../../../authcontext/AuthContext'

function MenuImage({ alt, className = '', src }) {
  return (
    <img
      alt={alt}
      className={className}
      loading="lazy"
      onError={(event) => {
        event.currentTarget.onerror = null
        event.currentTarget.src = '/images/hero-ice-cream.jpg'
      }}
      src={src}
    />
  )
}

function MenuProductCard({ category, item, onSelect, t, formatPrice }) {
  const soldOut = item.isAvailable === false || item.availableQuantity < 1
  return (
    <button
      className="group flex h-full flex-col overflow-hidden rounded-[26px] border border-[#e7e3d9] bg-white text-left shadow-[0_10px_30px_rgba(18,44,80,0.06)] transition duration-300 hover:-translate-y-1 hover:border-[#d9c76d] hover:shadow-[0_20px_44px_rgba(18,44,80,0.13)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] focus-visible:ring-offset-4"
      onClick={() => onSelect(category, item)}
      type="button"
    >
      <div className="relative aspect-[1.14] overflow-hidden bg-[#f4f1e7] p-2.5 sm:p-3">
        <MenuImage
          alt={t(item.name)}
          className="h-full w-full rounded-[20px] object-cover transition duration-700 group-hover:scale-[1.06]"
          src={item.image}
        />
        <span className="absolute left-5 top-5 max-w-[60%] truncate rounded-full border border-white/70 bg-white/90 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#52647b] shadow-sm backdrop-blur-sm">
          {t(category.title)}
        </span>
        <span className={`absolute right-5 top-5 rounded-full px-3 py-1.5 text-[10px] font-bold shadow-sm ${soldOut ? 'bg-red-50 text-red-700' : 'bg-[#f0f8ed]/95 text-[#37632c]'}`}>
          {soldOut ? t('Sold out') : t('Available')}
        </span>
        <span aria-hidden="true" className="absolute bottom-5 right-5 grid size-10 translate-y-1 place-items-center rounded-full bg-[#ffdc32] text-lg font-bold text-[#092a53] opacity-0 shadow-lg transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">↗</span>
      </div>
      <div className="flex flex-1 flex-col px-5 pb-5 pt-4 sm:px-5 sm:pb-6">
        <h3 className="font-display text-xl font-bold leading-snug text-[#102c50]">{t(item.name)}</h3>
        <p className="mt-2 line-clamp-2 min-h-12 text-sm leading-6 text-[#65748a]">{t(item.detail)}</p>
        <div className="mt-auto pt-5">
          <div className="mb-4 flex items-end justify-between gap-3 border-t border-[#eeeae1] pt-4">
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#8792a0]">{t('Illustrative price')}</p>
              <span className="mt-1 block font-display text-base font-bold text-[#102c50]">{formatPrice(item.priceXaf)}</span>
            </div>
            <span aria-hidden="true" className="text-xl text-[#bd9c00]">✦</span>
          </div>
          <span className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-extrabold transition group-hover:-translate-y-0.5 ${soldOut ? 'border border-red-200 bg-red-50 text-red-700' : 'bg-[#092a53] text-white group-hover:bg-[#163e6b]'}`}>
            {soldOut ? t('Sold out') : t('View details')} <span aria-hidden="true">→</span>
          </span>
        </div>
      </div>
    </button>
  )
}

export function MenuPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { addToCart } = useCart()
  const { customer } = useAuth()
  const { language, t } = useLanguage()
  const [categories, setCategories] = useState(coldStoneMenuCategories)
  const [menuError, setMenuError] = useState('')
  const [selectedItemState, setSelectedItemState] = useState(null)
  const [cartNotice, setCartNotice] = useState('')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [dietaryFilter, setDietaryFilter] = useState('')
  const [availabilityFilter, setAvailabilityFilter] = useState('')
  const [favoriteIds, setFavoriteIds] = useState(new Set())
  const [favoriteError, setFavoriteError] = useState('')
  const [reviews, setReviews] = useState({ averageRating: null, reviewCount: 0, reviews: [] })
  const requestedCategory = searchParams.get('category')
  const activeCategoryTitle = categories.some((category) => category.title === requestedCategory)
    ? requestedCategory
    : null
  const activeCategory = categories.find((category) => category.title === activeCategoryTitle) || null
  const selectedItem = selectedItemState?.categoryTitle === activeCategoryTitle
    ? selectedItemState.item
    : null
  const formatPrice = (price) => `${new Intl.NumberFormat(language === 'fr' ? 'fr-CM' : 'en-CM').format(price)} FCFA`
  const hasFilters = Boolean(search.trim() || categoryFilter || maxPrice || dietaryFilter || availabilityFilter)
  const filteredItems = categories.flatMap((category) => category.items
    .filter(() => !categoryFilter || category.title === categoryFilter)
    .filter(() => !activeCategoryTitle || hasFilters || category.title === activeCategoryTitle)
    .filter((item) => !search.trim() || `${item.name} ${item.detail} ${category.title}`.toLowerCase().includes(search.trim().toLowerCase()))
    .filter((item) => !maxPrice || item.priceXaf <= Number(maxPrice))
    .filter((item) => !dietaryFilter || item.dietaryTags?.includes(dietaryFilter))
    .filter((item) => !availabilityFilter || (availabilityFilter === 'available'
      ? item.isAvailable !== false && item.availableQuantity > 0
      : item.isAvailable === false || item.availableQuantity < 1))
    .map((item) => ({ category, item })))

  useEffect(() => {
    let cancelled = false
    apiRequest('/menu')
      .then(({ categories: loadedCategories }) => {
        if (!cancelled) setCategories(loadedCategories)
      })
      .catch((loadError) => {
        if (!cancelled) setMenuError(loadError.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!customer) {
      setFavoriteIds(new Set())
      return undefined
    }
    let cancelled = false
    apiRequest('/customer/favorites', { token: sessionStorage.getItem(CUSTOMER_TOKEN_KEY) })
      .then(({ favorites }) => {
        if (!cancelled) setFavoriteIds(new Set(favorites.map((favorite) => favorite.itemId)))
      })
      .catch((error) => {
        if (!cancelled) setFavoriteError(error.message)
      })
    return () => { cancelled = true }
  }, [customer])

  useEffect(() => {
    if (!selectedItem || !activeCategory) return undefined
    const itemId = selectedItem.id || getMenuItemId(activeCategory.title, selectedItem.name)
    let cancelled = false
    apiRequest(`/menu/${encodeURIComponent(itemId)}/reviews`)
      .then((result) => {
        if (!cancelled) setReviews(result)
      })
      .catch((error) => {
        if (!cancelled) setFavoriteError(error.message)
      })
    return () => { cancelled = true }
  }, [activeCategory, selectedItem])

  const showCategory = (category) => {
    setSearchParams({ category: category.title })
    setSelectedItemState(null)
  }

  const selectItem = (category, item) => {
    if (category.title !== activeCategoryTitle) {
      setSearchParams({ category: category.title })
    }
    setSelectedItemState({ categoryTitle: category.title, item })
    setCartNotice('')
    setSearch('')
    setCategoryFilter('')
    setMaxPrice('')
    setDietaryFilter('')
    setAvailabilityFilter('')
  }

  const orderSelectedItem = () => {
    const added = addToCart({
      ...selectedItem,
      id: selectedItem.id || getMenuItemId(activeCategory.title, selectedItem.name),
      itemType: 'menu',
      categoryTitle: activeCategory.title,
    })
    if (added) {
      navigate('/cart')
    } else {
      setCartNotice(t('This item could not be added to your bag. Please try again.'))
    }
  }

  async function saveFavorite() {
    if (!customer || !selectedItem || !activeCategory) return
    const itemId = selectedItem.id || getMenuItemId(activeCategory.title, selectedItem.name)
    setFavoriteError('')
    try {
      if (favoriteIds.has(itemId)) {
        await apiRequest(`/customer/favorites/${encodeURIComponent(itemId)}`, {
          method: 'DELETE',
          token: sessionStorage.getItem(CUSTOMER_TOKEN_KEY),
        })
        setFavoriteIds((current) => new Set([...current].filter((id) => id !== itemId)))
      } else {
        await apiRequest('/customer/favorites', {
          method: 'POST',
          token: sessionStorage.getItem(CUSTOMER_TOKEN_KEY),
          body: { itemId },
        })
        setFavoriteIds((current) => new Set([...current, itemId]))
      }
    } catch (error) {
      setFavoriteError(error.message)
    }
  }

  const similarItems = selectedItem && activeCategory
    ? [
        ...activeCategory.items
          .filter((item) => item.name !== selectedItem.name)
          .map((item) => ({ category: activeCategory, item })),
        ...categories
          .filter((category) => category.title !== activeCategory.title)
          .flatMap((category) => category.items.map((item) => ({ category, item }))),
      ].slice(0, 4)
    : []

  return (
    <div className="min-h-screen bg-[#fbfaf5] text-[#102c50]">
      <Header />
      <main>
        <section className="px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8">
          <div className="relative mx-auto grid max-w-[1440px] items-center gap-8 overflow-hidden rounded-[28px] bg-[#092a53] px-6 py-8 text-white sm:px-10 sm:py-12 lg:grid-cols-[1fr_0.8fr] lg:px-14 lg:py-14">
            <div aria-hidden="true" className="absolute -right-24 -top-36 size-[28rem] rounded-full border-[66px] border-white/[0.04]" />
            <div className="relative z-10 max-w-2xl">
              <p className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#ffdc32]">
                {t('The Cold Stone experience')}
              </p>
              <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">{t('Menu & treats')}</h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-white/75 sm:text-base sm:leading-7">
                {t('The global Cold Stone menu features these treat categories. This is not a confirmed Cameroon branch menu; local selection and prices can vary.')}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a className="inline-flex items-center gap-2 rounded-full bg-[#ffdc32] px-5 py-3 text-sm font-bold text-[#092a53] transition hover:-translate-y-0.5 hover:bg-[#ffe76c]" href="#menu-content">
                  {t('Explore the menu')} <span aria-hidden="true">↓</span>
                </a>
                <Link className="inline-flex items-center rounded-full border border-white/30 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10" to="/custom-cake">
                  {t('Request a custom cake')}
                </Link>
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-[520px] pb-4 pr-4 sm:pb-6 sm:pr-6">
              <div aria-hidden="true" className="absolute bottom-0 right-0 h-[70%] w-[72%] rounded-[28px] bg-[#ffdc32]" />
              <MenuImage alt={t('Ice cream treats')} className="relative z-10 aspect-[1.25] w-full rounded-[24px] object-cover shadow-[0_24px_60px_rgba(0,0,0,0.25)] sm:rounded-[30px]" src="/ice-images/ice-4.webp" />
              <div className="absolute -bottom-1 left-0 z-20 flex items-center gap-3 rounded-2xl border border-[#e7e3d9] bg-white p-3 text-[#102c50] shadow-lg sm:-left-4 sm:p-4">
                <span aria-hidden="true" className="grid size-11 place-items-center rounded-xl bg-[#fff0a8] text-xl">✦</span>
                <div>
                  <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#806a00]">{t('Signature creations')}</p>
                  <p className="mt-1 text-xs font-bold sm:text-sm">{t('A treat made your way')}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-[1320px] px-5 py-9 sm:px-8 sm:py-12 lg:px-12" id="menu-content">
        <p className="mb-7 rounded-2xl border border-[#eadb8a] bg-[#fff9dc] px-4 py-3.5 text-sm leading-6 text-[#624f00] sm:px-5">
          {t('The global Cold Stone menu features these treat categories. This is not a confirmed Cameroon branch menu; local selection and prices can vary.')}
        </p>
        {menuError && <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">{t('Some saved menu items may not be available right now.')}: {menuError}</p>}

        <section aria-label={t('Search and filter menu')} className="mb-9 grid gap-3 rounded-[22px] border border-[#e7e3d9] bg-white p-4 shadow-[0_8px_28px_rgba(18,44,80,0.05)] sm:grid-cols-2 sm:p-5 lg:grid-cols-5">
          <label className="text-xs font-bold text-[#52647b]">
            {t('Search menu')}
            <input className="mt-1.5 w-full rounded-xl border border-[#e7e3d9] bg-[#fbfaf5] px-3 py-3 text-sm font-normal text-[#102c50] outline-none transition placeholder:text-[#8792a0] focus:border-[#bd9c00] focus:bg-white focus:ring-2 focus:ring-[#ffdc32]/40" onChange={(event) => setSearch(event.target.value)} placeholder={t('Name or description')} value={search} />
          </label>
          <label className="text-xs font-bold text-[#52647b]">
            {t('Category')}
            <select className="mt-1.5 w-full rounded-xl border border-[#e7e3d9] bg-[#fbfaf5] px-3 py-3 text-sm font-normal text-[#102c50] outline-none transition focus:border-[#bd9c00] focus:bg-white focus:ring-2 focus:ring-[#ffdc32]/40" onChange={(event) => setCategoryFilter(event.target.value)} value={categoryFilter}>
              <option value="">{t('All categories')}</option>
              {categories.map((category) => <option key={category.title} value={category.title}>{t(category.title)}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-[#52647b]">
            {t('Maximum price (FCFA)')}
            <input className="mt-1.5 w-full rounded-xl border border-[#e7e3d9] bg-[#fbfaf5] px-3 py-3 text-sm font-normal text-[#102c50] outline-none transition focus:border-[#bd9c00] focus:bg-white focus:ring-2 focus:ring-[#ffdc32]/40" min="0" onChange={(event) => setMaxPrice(event.target.value)} type="number" value={maxPrice} />
          </label>
          <label className="text-xs font-bold text-[#52647b]">
            {t('Dietary needs')}
            <select className="mt-1.5 w-full rounded-xl border border-[#e7e3d9] bg-[#fbfaf5] px-3 py-3 text-sm font-normal text-[#102c50] outline-none transition focus:border-[#bd9c00] focus:bg-white focus:ring-2 focus:ring-[#ffdc32]/40" onChange={(event) => setDietaryFilter(event.target.value)} value={dietaryFilter}>
              <option value="">{t('Any')}</option>
              {['vegetarian', 'vegan', 'dairy-free', 'gluten-free', 'nut-free'].map((tag) => <option key={tag} value={tag}>{t(tag)}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-[#52647b]">
            {t('Availability')}
            <select className="mt-1.5 w-full rounded-xl border border-[#e7e3d9] bg-[#fbfaf5] px-3 py-3 text-sm font-normal text-[#102c50] outline-none transition focus:border-[#bd9c00] focus:bg-white focus:ring-2 focus:ring-[#ffdc32]/40" onChange={(event) => setAvailabilityFilter(event.target.value)} value={availabilityFilter}>
              <option value="">{t('Any')}</option>
              <option value="available">{t('Available')}</option>
              <option value="sold-out">{t('Sold out')}</option>
            </select>
          </label>
        </section>

        {hasFilters ? (
          <section aria-live="polite">
            <h2 className="mb-4 font-display text-2xl font-bold">{t('Matching menu items')} ({filteredItems.length})</h2>
            {filteredItems.length ? (
              <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredItems.map(({ category, item }) => (
                  <MenuProductCard category={category} formatPrice={formatPrice} item={item} key={item.id || getMenuItemId(category.title, item.name)} onSelect={selectItem} t={t} />
                ))}
              </div>
            ) : <p className="rounded-xl bg-[#f4f2f2] p-5 text-sm text-[#65748a]">{t('No menu items match those filters.')}</p>}
          </section>
        ) : selectedItem && activeCategory ? (
          <section aria-labelledby="menu-product-title">
            <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
              <button
                className="inline-flex items-center gap-2 rounded-full border border-[#d8d2c5] bg-white px-4 py-2.5 text-sm font-bold text-[#52647b] transition hover:border-[#092a53] hover:text-[#092a53] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00]"
                onClick={() => setSelectedItemState(null)}
                type="button"
              >
                <span aria-hidden="true">←</span> {t('Back to category')}: {t(activeCategory.title)}
              </button>
              <p className="text-xs font-medium text-[#7b8796]">{t(activeCategory.title)} <span aria-hidden="true">/</span> {t(selectedItem.name)}</p>
            </div>

            <div className="overflow-hidden rounded-[30px] border border-[#e7e3d9] bg-white shadow-[0_18px_54px_rgba(18,44,80,0.09)]">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_0.95fr]">
                <div className="relative min-h-[320px] overflow-hidden bg-[#f2efe5] p-3 sm:min-h-[460px] sm:p-5">
                  <MenuImage
                    alt={t(selectedItem.name)}
                    className="absolute inset-3 size-[calc(100%-1.5rem)] rounded-[24px] object-cover sm:inset-5 sm:size-[calc(100%-2.5rem)] sm:rounded-[26px]"
                    src={selectedItem.image}
                  />
                  <div aria-hidden="true" className="absolute inset-3 rounded-[24px] bg-gradient-to-t from-[#092a53]/55 via-transparent to-[#092a53]/10 sm:inset-5 sm:rounded-[26px]" />
                  <div className="absolute left-7 top-7 flex flex-wrap gap-2 sm:left-9 sm:top-9">
                    <span className="rounded-full border border-white/60 bg-white/90 px-3.5 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#092a53] shadow-sm backdrop-blur-sm">{t(activeCategory.title)}</span>
                    <span className={`rounded-full px-3.5 py-2 text-[10px] font-extrabold uppercase tracking-[0.08em] shadow-sm ${selectedItem.isAvailable === false || selectedItem.availableQuantity < 1 ? 'bg-red-50 text-red-700' : 'bg-[#eff8e9] text-[#37632c]'}`}>
                      {selectedItem.isAvailable === false || selectedItem.availableQuantity < 1 ? t('Sold out') : t('Available')}
                    </span>
                  </div>
                  <span aria-hidden="true" className="absolute bottom-8 right-8 grid size-12 place-items-center rounded-full bg-[#ffdc32] text-xl text-[#092a53] shadow-lg">✦</span>
                </div>
                <div className="flex min-w-0 flex-col justify-center p-6 sm:p-9 lg:p-12">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#a48700]">{t('Menu category')}</p>
                  <h2 className="mt-3 break-words font-display text-3xl font-extrabold leading-tight tracking-tight text-[#092a53] sm:text-5xl" id="menu-product-title">
                    {t(selectedItem.name)}
                  </h2>
                  {reviews.reviewCount > 0 && <p className="mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-[#fff9dc] px-3.5 py-2 text-sm font-bold text-[#806a00]" aria-live="polite"><span aria-hidden="true">★</span> {reviews.averageRating} · {reviews.reviewCount} {t('reviews')}</p>}
                  <p className="mt-5 text-sm leading-7 text-[#52647b] sm:text-base sm:leading-8">{t(selectedItem.detail)}</p>
                  <div className="mt-7 rounded-2xl border border-[#ece8dd] bg-[#fbfaf5] p-5">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#65748a]">{t('Illustrative price')}</p>
                    <p className="mt-1 font-display text-3xl font-extrabold text-[#092a53]">{formatPrice(selectedItem.priceXaf)}</p>
                    <p className="mt-2 text-xs leading-5 text-[#65748a]">{t('This is an example price for illustration only, not a verified Cameroon price or an item for sale on this website.')}</p>
                  </div>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <button
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#ffdc32] px-6 py-3.5 text-sm font-extrabold text-[#092a53] transition hover:-translate-y-0.5 hover:bg-[#ffe76c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
                      onClick={orderSelectedItem}
                      disabled={selectedItem.isAvailable === false || selectedItem.availableQuantity < 1}
                      type="button"
                    >
                      {selectedItem.isAvailable === false || selectedItem.availableQuantity < 1 ? t('Sold out') : t('Order now')} {! (selectedItem.isAvailable === false || selectedItem.availableQuantity < 1) && <span aria-hidden="true">→</span>}
                    </button>
                    {customer && <button className="inline-flex items-center justify-center gap-2 rounded-full border border-[#d8d2c5] px-5 py-3.5 text-sm font-bold text-[#52647b] transition hover:border-[#092a53] hover:text-[#092a53] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00]" onClick={saveFavorite} type="button">
                      <span aria-hidden="true">{favoriteIds.has(selectedItem.id || getMenuItemId(activeCategory.title, selectedItem.name)) ? '♥' : '♡'}</span>
                      {favoriteIds.has(selectedItem.id || getMenuItemId(activeCategory.title, selectedItem.name)) ? t('Remove from favorites') : t('Save to favorites')}
                    </button>}
                  </div>
                  {cartNotice && <p className="mt-3 text-xs leading-5 text-red-700" role="alert">{cartNotice}</p>}
                  {favoriteError && <p className="mt-3 text-xs leading-5 text-red-700" role="alert">{favoriteError}</p>}
                </div>
              </div>
            </div>
            {reviews.reviews.length > 0 && <section className="mt-6 rounded-2xl border border-[#d9d6cc] bg-white p-5">
              <h3 className="font-display text-xl font-bold">{t('Customer reviews')}</h3>
              <ul className="mt-3 space-y-3">{reviews.reviews.map((review, index) => <li className="border-t border-[#d9d6cc] pt-3" key={`${review.createdAt}-${index}`}>
                <div className="flex items-center gap-3">
                  {review.profilePicture ? <img alt={review.customerName} className="size-10 rounded-full object-cover" src={review.profilePicture} /> : <div className="flex size-10 items-center justify-center rounded-full bg-[#ffeb9c] text-sm font-bold text-[#102c50]">{review.customerName?.charAt(0)?.toUpperCase() || 'A'}</div>}
                  <p className="font-semibold">★ {review.rating}/5 · {review.customerName}</p>
                </div>
                {review.review && <p className="mt-2 text-sm text-[#65748a]">{review.review}</p>}
              </li>)}</ul>
            </section>}

            <section aria-labelledby="similar-products-title" className="mt-12">
              <div className="mb-6">
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#806a00]">{t('You may also like')}</p>
                <h2 className="mt-1 font-display text-3xl font-bold" id="similar-products-title">{t('Similar products')}</h2>
              </div>
              <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-4">
                {similarItems.map(({ category, item }) => (
                  <MenuProductCard
                    category={category}
                    formatPrice={formatPrice}
                    item={item}
                    key={item.name}
                    onSelect={selectItem}
                    t={t}
                  />
                ))}
              </div>
            </section>
          </section>
        ) : activeCategory ? (
          <section aria-labelledby="menu-category-title">
            <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
              <button
                className="inline-flex items-center gap-2 rounded-full border border-[#d8d2c5] bg-white px-4 py-2.5 text-sm font-bold text-[#52647b] transition hover:border-[#092a53] hover:text-[#092a53] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00]"
                onClick={() => setSearchParams({})}
                type="button"
              >
                <span aria-hidden="true">←</span> {t('Back to categories')}
              </button>
              <p className="text-xs font-medium text-[#7b8796]">{t('The Cold Stone experience')} <span aria-hidden="true">/</span> {t(activeCategory.title)}</p>
            </div>

            <div className="mb-10 grid overflow-hidden rounded-[28px] border border-[#e7e3d9] bg-white shadow-[0_14px_44px_rgba(18,44,80,0.09)] md:min-h-[390px] md:grid-cols-[1.05fr_0.95fr]">
              <div
                className="relative isolate flex flex-col justify-center overflow-hidden p-6 text-[#092a53] sm:p-9 lg:p-12"
                style={{
                  backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.84), rgba(255, 255, 255, 0.84)), url("${activeCategory.image}")`,
                  backgroundPosition: 'center',
                  backgroundSize: 'cover',
                }}
              >
                <div aria-hidden="true" className="absolute -right-16 -top-20 -z-10 size-56 rounded-full border-[36px] border-[#c7772c]/10" />
                <p className="inline-flex w-fit items-center gap-2 rounded-full border border-[#d9d6cc] bg-white/75 px-3.5 py-2 text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#806a00] sm:text-xs">
                  <span aria-hidden="true" className="text-base">{activeCategory.icon}</span>
                  {t('Menu category')}
                </p>
                <h2 className="mt-5 max-w-2xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl" id="menu-category-title">
                  {t(activeCategory.title)}
                </h2>
                <p className="mt-4 max-w-xl text-base leading-7 text-[#52647b] sm:text-lg sm:leading-8">{t(activeCategory.description)}</p>
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <a className="inline-flex items-center gap-2 rounded-full bg-[#092a53] px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#163e6b]" href="#menu-category-items">
                    {t('Browse items')} <span aria-hidden="true">↓</span>
                  </a>
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#d9d6cc] bg-white/75 px-4 py-2.5 text-xs font-bold text-[#52647b]">
                    {t('{count} items', { count: activeCategory.items.length })}
                  </span>
                </div>
              </div>
              <div className="relative min-h-64 overflow-hidden bg-[#f4f1e7] md:min-h-full">
                <MenuImage alt={t(activeCategory.title)} className="absolute inset-0 size-full object-cover" src={activeCategory.image} />
                <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#092a53]/20 via-transparent to-white/10" />
                <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3 sm:bottom-6 sm:left-6 sm:right-6">
                  <span className="rounded-full border border-white/50 bg-white/90 px-4 py-2 text-xs font-bold text-[#092a53] shadow-sm">
                    {t('Signature creations')}
                  </span>
                  <span aria-hidden="true" className="grid size-11 place-items-center rounded-full bg-[#ffdc32] text-xl text-[#092a53] shadow-md">{activeCategory.icon}</span>
                </div>
              </div>
            </div>

            <div className="mb-5 flex flex-wrap items-end justify-between gap-3" id="menu-category-items">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#a48700]">{t(activeCategory.title)}</p>
                <h3 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{t('Menu items')}</h3>
              </div>
              <p className="text-xs leading-5 text-[#65748a]">{t('Prices shown are illustrative estimates only.')}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {activeCategory.items.map((item) => (
                <MenuProductCard
                  category={activeCategory}
                  formatPrice={formatPrice}
                  item={item}
                  key={item.id || getMenuItemId(activeCategory.title, item.name)}
                  onSelect={selectItem}
                  t={t}
                />
              ))}
            </div>
          </section>
        ) : (
          <section aria-labelledby="menu-categories-title">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#a48700]">{t('Browse the categories')}</p>
                <h2 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl" id="menu-categories-title">{t('Menu categories')}</h2>
              </div>
              <p className="text-sm text-[#65748a]">{t('{count} categories', { count: categories.length })}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {categories.map((category) => (
                <button
                  className="group overflow-hidden rounded-[24px] border border-[#e7e3d9] bg-white text-left shadow-[0_8px_26px_rgba(18,44,80,0.05)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_16px_38px_rgba(18,44,80,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] focus-visible:ring-offset-4"
                  key={category.title}
                  onClick={() => showCategory(category)}
                  type="button"
                >
                  <div className="relative aspect-[1.12] overflow-hidden bg-[#f4f1e7] p-3 sm:p-4">
                    <MenuImage
                      alt={t(category.title)}
                      className="h-full w-full rounded-[18px] object-cover transition duration-500 group-hover:scale-[1.05]"
                      src={category.image}
                    />
                    <span className="absolute bottom-5 right-5 grid size-10 place-items-center rounded-full bg-white/95 text-lg text-[#092a53] shadow-sm transition group-hover:bg-[#ffdc32]">
                      <span aria-hidden="true">→</span>
                    </span>
                  </div>
                  <div className="px-4 pb-5 pt-4 sm:px-5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display text-lg font-bold leading-tight text-[#102c50] sm:text-xl">{t(category.title)}</h3>
                      <span className="shrink-0 rounded-full bg-[#fff8dd] px-2.5 py-1 text-[10px] font-bold text-[#806a00]">{t('{count} items', { count: category.items.length })}</span>
                    </div>
                    <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-[#65748a]">{t(category.description)}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
        </div>
      </main>

      <InstagramSection />
      <Footer />
    </div>
  )
}
