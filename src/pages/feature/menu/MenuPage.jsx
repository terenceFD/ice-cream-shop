import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Footer, Header } from '../../../components/Layout'
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
      className="group overflow-hidden rounded-[25px] bg-[#f4f2f2] text-left transition duration-200 hover:-translate-y-1 hover:shadow-[0_16px_35px_rgba(18,44,80,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] focus-visible:ring-offset-4"
      onClick={() => onSelect(category, item)}
      type="button"
    >
      <div className="aspect-[1.08] overflow-hidden p-3 sm:p-4">
        <MenuImage
          alt={t(item.name)}
          className="h-full w-full rounded-[20px] object-cover transition duration-300 group-hover:scale-[1.03]"
          src={item.image}
        />
      </div>
      <div className="px-4 pb-5 pt-1 sm:px-5">
        <h3 className="font-display text-lg font-bold leading-snug text-[#102c50]">{t(item.name)}</h3>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#65748a]">{t(item.detail)}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="font-bold text-[#102c50]">{formatPrice(item.priceXaf)}</span>
          <span className={`text-xs font-bold underline underline-offset-4 ${soldOut ? 'text-red-700 decoration-red-500' : 'text-[#806a00] decoration-[#bd9c00]'}`}>
            {soldOut ? t('Sold out') : t('View details')}
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
    <div className="min-h-screen bg-[#f8f7f2] text-[#102c50]">
      <Header />
      <main className="mx-auto max-w-[1320px] px-5 py-10 sm:px-8 sm:py-16 lg:px-12">
        <div className="mb-9 max-w-3xl">
          <p className="mb-2 inline-block rounded-full bg-[#ffeb9c] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em]">
            {t('The Cold Stone experience')}
          </p>
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-6xl">{t('Menu & treats')}</h1>
          <p className="mt-3 text-base leading-7 text-[#65748a]">
            {t('The global Cold Stone menu features these treat categories. This is not a confirmed Cameroon branch menu; local selection and prices can vary.')}
          </p>
          <Link className="mt-4 inline-flex rounded-full bg-[#ffdc32] px-5 py-3 text-sm font-bold text-[#102c50] transition hover:bg-[#ffe76c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00]" to="/custom-cake">
            {t('Request a custom cake')}
          </Link>
        </div>
        {menuError && <p className="mb-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">{t('Some saved menu items may not be available right now.')}: {menuError}</p>}

        <section aria-label={t('Search and filter menu')} className="mb-8 grid gap-3 rounded-2xl border border-[#d9d6cc] bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-xs font-bold text-[#52647b]">
            {t('Search menu')}
            <input className="mt-1.5 w-full rounded-xl border border-[#d9d6cc] px-3 py-2.5 text-sm font-normal" onChange={(event) => setSearch(event.target.value)} placeholder={t('Name or description')} value={search} />
          </label>
          <label className="text-xs font-bold text-[#52647b]">
            {t('Category')}
            <select className="mt-1.5 w-full rounded-xl border border-[#d9d6cc] bg-white px-3 py-2.5 text-sm font-normal" onChange={(event) => setCategoryFilter(event.target.value)} value={categoryFilter}>
              <option value="">{t('All categories')}</option>
              {categories.map((category) => <option key={category.title} value={category.title}>{t(category.title)}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-[#52647b]">
            {t('Maximum price (FCFA)')}
            <input className="mt-1.5 w-full rounded-xl border border-[#d9d6cc] px-3 py-2.5 text-sm font-normal" min="0" onChange={(event) => setMaxPrice(event.target.value)} type="number" value={maxPrice} />
          </label>
          <label className="text-xs font-bold text-[#52647b]">
            {t('Dietary needs')}
            <select className="mt-1.5 w-full rounded-xl border border-[#d9d6cc] bg-white px-3 py-2.5 text-sm font-normal" onChange={(event) => setDietaryFilter(event.target.value)} value={dietaryFilter}>
              <option value="">{t('Any')}</option>
              {['vegetarian', 'vegan', 'dairy-free', 'gluten-free', 'nut-free'].map((tag) => <option key={tag} value={tag}>{t(tag)}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-[#52647b]">
            {t('Availability')}
            <select className="mt-1.5 w-full rounded-xl border border-[#d9d6cc] bg-white px-3 py-2.5 text-sm font-normal" onChange={(event) => setAvailabilityFilter(event.target.value)} value={availabilityFilter}>
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
            <button
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#d8d2c5] px-4 py-2 text-sm font-bold text-[#65748a] transition hover:bg-[#f4f2f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00]"
              onClick={() => setSelectedItemState(null)}
              type="button"
            >
              <span aria-hidden="true">←</span> {t('Back to category')}: {t(activeCategory.title)}
            </button>

            <div className="grid grid-cols-[0.8fr_1.2fr] items-start gap-3 rounded-[30px] bg-[#f4f2f2] p-3 sm:gap-8 sm:p-6 lg:grid-cols-[1fr_0.9fr] lg:gap-12 lg:p-8">
              <div className="aspect-square min-w-0 overflow-hidden rounded-[18px] bg-white sm:rounded-[24px]">
                <MenuImage
                  alt={t(selectedItem.name)}
                  className="h-full w-full object-cover"
                  src={selectedItem.image}
                />
              </div>
              <div className="flex min-w-0 flex-col justify-center py-1 sm:py-5">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#806a00] sm:text-xs sm:tracking-[0.15em]">{t(activeCategory.title)}</p>
                <h2 className="mt-2 break-words font-display text-xl font-bold leading-tight tracking-tight sm:mt-3 sm:text-5xl" id="menu-product-title">
                  {t(selectedItem.name)}
                </h2>
                <p className="mt-2 text-xs leading-5 text-[#52647b] sm:mt-4 sm:text-base sm:leading-7">{t(selectedItem.detail)}</p>
                <div className="mt-3 rounded-xl bg-white px-3 py-2 sm:mt-7 sm:rounded-2xl sm:px-5 sm:py-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#65748a] sm:text-xs sm:tracking-[0.12em]">{t('Illustrative price')}</p>
                <p className="mt-1 break-words font-display text-lg font-bold text-[#102c50] sm:text-3xl">{formatPrice(selectedItem.priceXaf)}</p>
                </div>
                {reviews.reviewCount > 0 && <p className="mt-3 text-sm font-semibold" aria-live="polite">★ {reviews.averageRating} · {reviews.reviewCount} {t('reviews')}</p>}
                <p className="mt-2 text-[10px] leading-4 text-[#65748a] sm:mt-4 sm:text-xs sm:leading-5">{t('This is an example price for illustration only, not a verified Cameroon price or an item for sale on this website.')}</p>
                {customer && <button className="mt-3 inline-flex w-fit items-center justify-center rounded-full border border-[#65748a] px-5 py-2.5 text-sm font-bold" onClick={saveFavorite} type="button">
                  {favoriteIds.has(selectedItem.id || getMenuItemId(activeCategory.title, selectedItem.name)) ? t('Remove from favorites') : t('Save to favorites')}
                </button>}
                <button
                  className="mt-4 inline-flex w-fit items-center justify-center rounded-full bg-[#ffdc32] px-5 py-3 text-sm font-bold text-[#102c50] transition hover:bg-[#ffe76c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
                  onClick={orderSelectedItem}
                  disabled={selectedItem.isAvailable === false || selectedItem.availableQuantity < 1}
                  type="button"
                >
                  {selectedItem.isAvailable === false || selectedItem.availableQuantity < 1 ? t('Sold out') : t('Order now')}
                </button>
                {cartNotice && <p className="mt-3 text-xs leading-5 text-red-700" role="alert">{cartNotice}</p>}
                {favoriteError && <p className="mt-3 text-xs leading-5 text-red-700" role="alert">{favoriteError}</p>}
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
            <button
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#d8d2c5] px-4 py-2 text-sm font-bold text-[#65748a] transition hover:bg-[#f4f2f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00]"
              onClick={() => setSearchParams({})}
              type="button"
            >
              <span aria-hidden="true">←</span> {t('Back to categories')}
            </button>

            <div className="mb-8 grid overflow-hidden rounded-[28px] bg-[#f4f2f2] md:grid-cols-[1.1fr_0.9fr]">
              <div className="flex flex-col justify-center p-6 sm:p-9 lg:p-12">
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#806a00]">{t('Menu category')}</p>
                <h2 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl" id="menu-category-title">{t(activeCategory.title)}</h2>
                <p className="mt-3 max-w-xl text-base leading-7 text-[#52647b]">{t(activeCategory.description)}</p>
                <p className="mt-4 text-sm leading-6 text-[#65748a]">{t('Select a product to see its details, image, sample price, and similar treats.')}</p>
              </div>
              <div className="aspect-[1.35] min-h-56 overflow-hidden md:aspect-auto">
                <MenuImage alt={t(activeCategory.title)} className="h-full w-full object-cover" src={activeCategory.image} />
              </div>
            </div>

            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <h3 className="font-display text-2xl font-bold">{t('Menu items')}</h3>
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
            <h2 className="sr-only" id="menu-categories-title">{t('Menu categories')}</h2>
            <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-4">
              {categories.map((category) => (
                <button
                  className="group overflow-hidden rounded-[30px] bg-[#f4f2f2] text-left transition duration-200 hover:-translate-y-1 hover:shadow-[0_16px_35px_rgba(18,44,80,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] focus-visible:ring-offset-4"
                  key={category.title}
                  onClick={() => showCategory(category)}
                  type="button"
                >
                  <div className="aspect-[1.04] overflow-hidden p-3 sm:p-4">
                    <MenuImage
                      alt={t(category.title)}
                      className="h-full w-full rounded-[23px] object-cover transition duration-300 group-hover:scale-[1.03]"
                      src={category.image}
                    />
                  </div>
                  <div className="min-h-[76px] px-4 pb-5 text-center sm:px-5">
                    <h2 className="font-display text-xl font-bold uppercase tracking-[0.035em] text-[#806a56] sm:text-2xl">{t(category.title)}</h2>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="mt-12 rounded-[24px] bg-[#092a53] p-6 text-white sm:p-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#ffdc32]">{t('How the signature mix-in works')}</p>
          <h2 className="mt-2 font-display text-3xl font-bold">{t('Choose. Mix. Make it yours.')}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/75">
            {t('Cold Stone is known for mixing chosen ingredients into ice cream on a frozen granite stone. Ask your local branch which flavors, mix-ins and treats are available today.')}
          </p>
          <Link className="mt-6 inline-flex rounded-full bg-[#ffdc32] px-5 py-3 text-sm font-bold text-[#102c50] transition hover:bg-[#ffe76c]" to="/locations">
            {t('Available locations')}
          </Link>
        </section>

        <p className="mt-7 text-xs leading-5 text-[#65748a]">
          {t('Product categories are summarized from the global brand menu. Cameroon-specific stock, recipes and prices have not been independently confirmed.')}
        </p>
      </main>
      <Footer />
    </div>
  )
}
