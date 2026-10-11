import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { apiRequest, CUSTOMER_TOKEN_KEY } from '../../../api/api'
import { Footer, Header } from '../../../components/Layout'
import { useCart } from '../../../CartContext'
import { useAuth } from '../../../authcontext/AuthContext'
import { cameroonDeliveryLocations } from '../../../data'
import { useLanguage } from '../../../language/LanguageContext'

const fieldClass = 'mt-1.5 w-full rounded-xl border border-[#d9d6cc] bg-white px-4 py-3 text-sm'
const PROFILE_IMAGE_DIMENSION = 256
const MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024

async function resizeProfilePicture(file) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choose an image file for the profile picture.')
  }
  if (file.size > MAX_PROFILE_IMAGE_SIZE) {
    throw new Error('Choose an image smaller than 5 MB.')
  }

  const imageBitmap = await createImageBitmap(file)
  const scale = Math.min(1, PROFILE_IMAGE_DIMENSION / Math.max(imageBitmap.width, imageBitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(imageBitmap.width * scale))
  canvas.height = Math.max(1, Math.round(imageBitmap.height * scale))

  const context = canvas.getContext('2d')
  if (!context) {
    imageBitmap.close()
    throw new Error('Your browser could not prepare the profile picture.')
  }

  context.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height)
  imageBitmap.close()
  return canvas.toDataURL('image/jpeg', 0.8)
}

function orderStatus(order, t) {
  if (order.status === 'pending_payment') return t('Awaiting payment')
  if (order.status === 'payment_failed') return t('Payment failed')
  return t(order.deliveryStage || order.fulfillmentStatus || (order.status === 'delivered' ? 'delivered' : 'preparing'))
}

function OrderProgress({ order, t }) {
  const steps = [
    { key: 'preparing', label: 'Preparing' },
    { key: 'ready', label: 'Ready' },
    ...(order.fulfillmentType === 'delivery'
      ? [{ key: 'out_for_delivery', label: 'Out for delivery' }]
      : []),
    { key: 'delivered', label: 'Delivered' },
  ]
  const currentStage = order.status === 'delivered'
    ? 'delivered'
    : order.deliveryStage || order.fulfillmentStatus || 'preparing'
  const currentIndex = Math.max(
    0,
    steps.findIndex((step) => step.key === currentStage || (currentStage === 'accepted' && step.key === 'preparing')),
  )

  return (
    <section aria-label={t('Live order tracking')} aria-live="polite" aria-atomic="true" className="mt-4 rounded-2xl border border-[#e7e3d9] bg-[#fbfaf5] p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-extrabold text-[#102c50]">{t('Live order tracking')}</h4>
        <p className="text-xs font-semibold text-[#65748a]">{t(orderStatus(order, t))}</p>
      </div>
      <ol className="grid items-start" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((step, index) => {
          const isComplete = index < currentIndex
          const isCurrent = index === currentIndex
          return (
            <li aria-current={isCurrent ? 'step' : undefined} className="relative min-w-0 text-center" key={step.key}>
              {index < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`absolute left-1/2 top-4 h-0.5 w-full ${index < currentIndex ? 'bg-[#6c9c45]' : 'bg-[#d9d6cc]'}`}
                />
              )}
              <span className={`relative mx-auto grid size-8 place-items-center rounded-full border-2 text-xs font-extrabold ${
                isComplete
                  ? 'border-[#6c9c45] bg-[#6c9c45] text-white'
                  : isCurrent
                    ? 'border-[#bd9c00] bg-[#ffdc32] text-[#102c50]'
                    : 'border-[#d9d6cc] bg-white text-[#8b95a2]'
              }`}>
                {isComplete ? '✓' : index + 1}
              </span>
              <span className={`mt-2 block px-1 text-[10px] leading-4 sm:text-xs ${isCurrent || isComplete ? 'font-bold text-[#102c50]' : 'font-medium text-[#8b95a2]'}`}>
                {t(step.label)}
              </span>
            </li>
          )
        })}
      </ol>
      <p className="mt-4 text-center text-[11px] leading-5 text-[#65748a]">
        {t('This timeline refreshes automatically. Email updates are sent when your order status changes.')}
      </p>
    </section>
  )
}

function CustomerProfileDetails({ customer, onSave, t }) {
  const [profile, setProfile] = useState(() => ({
    name: customer.name || '',
    phone: customer.phone || '',
    deliveryCity: customer.deliveryCity || '',
    deliveryResidence: customer.deliveryResidence || '',
    profilePicture: customer.profilePicture || '',
  }))
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  async function handleProfilePictureChange(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setError('')
    try {
      const nextProfilePicture = await resizeProfilePicture(file)
      setProfile((current) => ({ ...current, profilePicture: nextProfilePicture }))
    } catch (imageError) {
      console.error('Unable to prepare customer profile picture.', imageError)
      setError(t(imageError.message || 'Could not load this profile picture.'))
    }
  }

  async function saveProfile(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    setIsSaving(true)
    try {
      await onSave(profile)
      setMessage(t('Saved delivery details updated.'))
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form className="mt-5 space-y-4" onSubmit={saveProfile}>
      <div className="flex items-center gap-4 rounded-2xl border border-[#e8e4da] bg-[#fbfaf5] p-4">
        {profile.profilePicture ? (
          <img alt={profile.name || 'Profile'} className="size-[68px] rounded-full border-2 border-white object-cover shadow-sm" src={profile.profilePicture} />
        ) : (
          <div className="flex size-[68px] shrink-0 items-center justify-center rounded-full bg-[#ffeb9c] text-xl font-extrabold text-[#102c50]">{(profile.name || 'A').charAt(0).toUpperCase()}</div>
        )}
        <label className="min-w-0 flex-1 text-sm font-bold text-[#102c50]">
          {t('Profile picture')}
          <input accept="image/*" className={`${fieldClass} mt-2 cursor-pointer file:mr-3 file:rounded-full file:border-0 file:bg-[#092a53] file:px-3 file:py-2 file:text-xs file:font-bold file:text-white`} onChange={handleProfilePictureChange} type="file" />
          <span className="mt-1.5 block text-xs font-normal leading-5 text-[#65748a]">{t('Optional. Image will be resized before saving (5 MB max).')}</span>
        </label>
      </div>
      <label className="block text-xs font-extrabold text-[#52647b]">{t('Full name')}<input className={`${fieldClass} mt-2 rounded-xl bg-[#fbfaf5] focus:border-[#bd9c00] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#ffdc32]/40`} maxLength={100} onChange={(event) => setProfile({ ...profile, name: event.target.value })} required value={profile.name} /></label>
      <label className="block text-xs font-extrabold text-[#52647b]">{t('Phone number')}<input className={`${fieldClass} mt-2 rounded-xl bg-[#fbfaf5] focus:border-[#bd9c00] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#ffdc32]/40`} maxLength={40} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} value={profile.phone} /></label>
      <label className="block text-xs font-extrabold text-[#52647b]">{t('City / Cold Stone location')}<select className={`${fieldClass} mt-2 rounded-xl bg-[#fbfaf5] focus:border-[#bd9c00] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#ffdc32]/40`} onChange={(event) => setProfile({ ...profile, deliveryCity: event.target.value })} value={profile.deliveryCity}><option value="">{t('Select a listed location')}</option>{cameroonDeliveryLocations.map((location) => <option key={location.value} value={location.value}>{t(location.town)} — {t(location.area)}</option>)}</select></label>
      <label className="block text-xs font-extrabold text-[#52647b]">{t('Your residence')}<input className={`${fieldClass} mt-2 rounded-xl bg-[#fbfaf5] focus:border-[#bd9c00] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#ffdc32]/40`} maxLength={150} onChange={(event) => setProfile({ ...profile, deliveryResidence: event.target.value })} value={profile.deliveryResidence} /></label>
      {error && <p className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
      {message && <p className="rounded-xl border border-green-100 bg-green-50 p-3 text-sm text-green-800" role="status">{message}</p>}
      <button className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#092a53] px-5 py-3.5 text-sm font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-[#163e6b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 sm:w-auto" disabled={isSaving} type="submit">{isSaving ? t('Saving…') : t('Save delivery details')} {!isSaving && <span aria-hidden="true">→</span>}</button>
    </form>
  )
}

function OrderReviewForm({ order, token, t }) {
  const [itemId, setItemId] = useState(order.items.find((item) => item.productId)?.productId || '')
  const [rating, setRating] = useState('5')
  const [review, setReview] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const items = order.items.filter((item) => item.productId)

  if (!items.length) return null

  async function submitReview(event) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')
    try {
      await apiRequest('/customer/reviews', {
        method: 'POST',
        token,
        body: { orderId: order.id, itemId, rating: Number(rating), review },
      })
      setMessage(t('Thanks! Your review is awaiting approval.'))
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="mt-4 border-t border-[#d9d6cc] pt-4" onSubmit={submitReview}>
      <h4 className="font-semibold">{t('Review a purchased item')}</h4>
      <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_110px]">
        <label className="text-xs font-bold">{t('Product')}
          <select className={fieldClass} onChange={(event) => setItemId(event.target.value)} value={itemId}>
            {items.map((item) => <option key={item.productId} value={item.productId}>{item.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold">{t('Rating')}
          <select className={fieldClass} onChange={(event) => setRating(event.target.value)} value={rating}>
            {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} / 5</option>)}
          </select>
        </label>
      </div>
      <label className="mt-3 block text-xs font-bold">{t('Your review')}
        <textarea className={fieldClass} maxLength={1000} onChange={(event) => setReview(event.target.value)} rows={3} value={review} />
      </label>
      {error && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}
      {message && <p className="mt-2 text-sm text-green-800" role="status">{message}</p>}
      {!message && <button className="mt-3 rounded-full border border-[#65748a] px-4 py-2 text-sm font-bold disabled:opacity-50" disabled={saving} type="submit">{saving ? t('Submitting…') : t('Submit review')}</button>}
    </form>
  )
}

export function CustomerOrdersPage() {
  const { customer, isLoading, updateProfile } = useAuth()
  const { t, language } = useLanguage()
  const navigate = useNavigate()
  const { addItemsToCart } = useCart()
  const [orders, setOrders] = useState([])
  const [favorites, setFavorites] = useState([])
  const [savedCarts, setSavedCarts] = useState([])
  const [loyalty, setLoyalty] = useState(null)
  const [accountError, setAccountError] = useState('')
  const [accountNotice, setAccountNotice] = useState('')
  const [showCartLink, setShowCartLink] = useState(false)
  const [reorderingId, setReorderingId] = useState(null)
  const [savingOrderId, setSavingOrderId] = useState(null)
  const [deletingSavedCartId, setDeletingSavedCartId] = useState(null)
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [error, setError] = useState('')

  const refreshOrders = useCallback(async () => {
    const token = sessionStorage.getItem(CUSTOMER_TOKEN_KEY)
    const result = await apiRequest('/customer/orders', { token })
    setOrders(result.orders)
  }, [])

  useEffect(() => {
    if (!customer) return undefined
    let cancelled = false
    const token = sessionStorage.getItem(CUSTOMER_TOKEN_KEY)
    Promise.all([
      apiRequest('/customer/favorites', { token }),
      apiRequest('/customer/saved-carts', { token }),
      apiRequest('/customer/loyalty', { token }),
    ]).then(([favoriteResult, savedCartResult, loyaltyResult]) => {
      if (cancelled) return
      setFavorites(favoriteResult.favorites)
      setSavedCarts(savedCartResult.savedCarts)
      setLoyalty(loyaltyResult)
    }).catch((loadError) => {
      if (!cancelled) setAccountError(loadError.message)
    })
    return () => { cancelled = true }
  }, [customer])

  useEffect(() => {
    if (!customer) return undefined
    let cancelled = false
    const loadOrders = () => refreshOrders()
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message)
      })
      .finally(() => {
        if (!cancelled) setLoadingOrders(false)
      })
    loadOrders()
    const intervalId = window.setInterval(loadOrders, 15000)
    window.addEventListener('focus', loadOrders)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      window.removeEventListener('focus', loadOrders)
    }
  }, [customer, refreshOrders])

  if (isLoading) return <p className="p-8 text-center">{t('Loading account…')}</p>
  if (!customer) return <Navigate replace to="/login" />

  const formatPrice = (amount) => `${new Intl.NumberFormat(language === 'fr' ? 'fr-CM' : 'en-CM').format(amount)} FCFA`

  async function removeFavorite(itemId) {
    try {
      await apiRequest(`/customer/favorites/${encodeURIComponent(itemId)}`, {
        method: 'DELETE',
        token: sessionStorage.getItem(CUSTOMER_TOKEN_KEY),
      })
      setFavorites((current) => current.filter((favorite) => favorite.itemId !== itemId))
    } catch (removeError) {
      setAccountError(removeError.message)
    }
  }

  async function reorderItems(items, actionId) {
    setReorderingId(actionId)
    setAccountError('')
    setAccountNotice('')
    setShowCartLink(false)
    try {
      const [menuResult, flavorResult] = await Promise.all([apiRequest('/menu'), apiRequest('/flavors')])
      const catalog = new Map([
        ...menuResult.categories.flatMap((category) => category.items.map((item) => [item.id, item])),
        ...flavorResult.flavors.map((flavor) => [`flavor:${flavor.id}`, flavor]),
      ])
      const products = items.flatMap((item) => {
        const product = catalog.get(item.productId)
        return product ? [{ ...product, quantity: item.quantity }] : []
      })
      const added = addItemsToCart(products)
      const requested = items.reduce((count, item) => count + item.quantity, 0)
      if (added > 0 && added === requested) navigate('/cart')
      else if (added > 0) {
        setAccountNotice(t('Added {added} of {requested} items. Some products are unavailable or limited by stock.', { added, requested }))
        setShowCartLink(true)
      } else setAccountError(t('The products in this order are currently unavailable.'))
    } catch (reorderError) {
      setAccountError(reorderError.message)
    } finally {
      setReorderingId(null)
    }
  }

  async function saveOrder(order) {
    setSavingOrderId(order.id)
    setAccountError('')
    setAccountNotice('')
    setShowCartLink(false)
    try {
      const result = await apiRequest('/customer/saved-carts', {
        method: 'POST',
        token: sessionStorage.getItem(CUSTOMER_TOKEN_KEY),
        body: { orderId: order.id },
      })
      setSavedCarts((current) => [
        result.savedCart,
        ...current.filter((savedCart) => savedCart.id !== result.savedCart.id),
      ])
      setAccountNotice(t('Saved {label} for later.', { label: result.savedCart.label }))
    } catch (saveError) {
      setAccountError(saveError.message)
    } finally {
      setSavingOrderId(null)
    }
  }

  async function removeSavedCart(savedCart) {
    setDeletingSavedCartId(savedCart.id)
    setAccountError('')
    setAccountNotice('')
    setShowCartLink(false)
    try {
      await apiRequest(`/customer/saved-carts/${savedCart.id}`, {
        method: 'DELETE',
        token: sessionStorage.getItem(CUSTOMER_TOKEN_KEY),
      })
      setSavedCarts((current) => current.filter((item) => item.id !== savedCart.id))
    } catch (deleteError) {
      setAccountError(deleteError.message)
    } finally {
      setDeletingSavedCartId(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f7f2] text-[#102c50]">
      <Header />
      <main className="mx-auto max-w-[1320px] px-4 py-7 sm:px-7 sm:py-10 lg:px-10 lg:py-12">
        <section className="relative isolate overflow-hidden rounded-[30px] bg-[#092a53] px-6 py-8 text-white shadow-[0_18px_50px_rgba(9,42,83,0.16)] sm:px-9 sm:py-10 lg:px-12 lg:py-12">
          <div aria-hidden="true" className="absolute -right-24 -top-32 -z-10 size-[25rem] rounded-full border-[54px] border-white/[0.05]" />
          <div aria-hidden="true" className="absolute -bottom-36 right-[28%] -z-10 size-72 rounded-full bg-[#ffdc32]/[0.08] blur-2xl" />
          <div className="relative flex flex-col justify-between gap-7 sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-center gap-4 sm:gap-5">
              {customer.profilePicture ? (
                <img alt={customer.name || t('My account')} className="size-[72px] shrink-0 rounded-full border-2 border-white/30 object-cover shadow-lg sm:size-20" src={customer.profilePicture} />
              ) : (
                <span aria-hidden="true" className="grid size-[72px] shrink-0 place-items-center rounded-full border-2 border-white/25 bg-[#ffdc32] font-display text-3xl font-extrabold text-[#092a53] shadow-lg sm:size-20">{(customer.name || 'A').charAt(0).toUpperCase()}</span>
              )}
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.17em] text-[#ffdc32]">{t('My account')}</p>
                <h1 className="mt-1 break-words font-display text-3xl font-extrabold leading-tight sm:text-4xl">{customer.name}</h1>
                <p className="mt-1 truncate text-sm text-white/70">{customer.email}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 sm:justify-end">
              <a className="inline-flex items-center justify-center gap-2 rounded-full bg-[#ffdc32] px-5 py-3 text-sm font-extrabold text-[#092a53] transition hover:-translate-y-0.5 hover:bg-[#ffe76c]" href="#account-orders">
                {t('Order history and status')} <span aria-hidden="true">↓</span>
              </a>
              <Link className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10" to="/menu">
                {t('Browse the menu')} <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </section>

        {accountError && <p className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700" role="alert">{accountError}</p>}
        {accountNotice && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-900" role="status">
            <span>{accountNotice}</span>
            {showCartLink && <Link className="font-bold underline underline-offset-2" to="/cart">{t('View shopping bag')}</Link>}
          </div>
        )}

        <section aria-label={t('Account summary')} className="mt-5 grid gap-3 sm:grid-cols-3">
          <article className="flex items-center gap-4 rounded-[22px] border border-[#e7e3d9] bg-white p-5 shadow-[0_8px_26px_rgba(18,44,80,0.04)]">
            <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#fff3b8] text-xl text-[#806a00]">✦</span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#65748a]">{t('Loyalty rewards')}</p>
              <p className="mt-1 font-display text-2xl font-extrabold">{loyalty?.points ?? customer.loyaltyPoints ?? 0} <span className="text-sm font-bold">{t('points')}</span></p>
            </div>
          </article>
          <article className="flex items-center gap-4 rounded-[22px] border border-[#e7e3d9] bg-white p-5 shadow-[0_8px_26px_rgba(18,44,80,0.04)]">
            <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#edf3f9] text-xl text-[#092a53]">▤</span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#65748a]">{t('Orders')}</p>
              <p className="mt-1 font-display text-2xl font-extrabold">{orders.length}</p>
            </div>
          </article>
          <article className="flex items-center gap-4 rounded-[22px] border border-[#e7e3d9] bg-white p-5 shadow-[0_8px_26px_rgba(18,44,80,0.04)]">
            <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#fff0ed] text-xl text-[#b44947]">♡</span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#65748a]">{t('Saved favorites')}</p>
              <p className="mt-1 font-display text-2xl font-extrabold">{favorites.length}</p>
            </div>
          </article>
        </section>

        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.75fr)]">
          <section aria-labelledby="account-orders" className="min-w-0">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#a48700]">{t('My account')}</p>
                <h2 className="mt-1 font-display text-2xl font-extrabold sm:text-3xl" id="account-orders">{t('Order history and status')}</h2>
              </div>
              <button className="inline-flex items-center gap-2 rounded-full border border-[#d9d6cc] bg-white px-4 py-2.5 text-xs font-bold text-[#52647b] transition hover:border-[#092a53] hover:text-[#092a53] disabled:opacity-50" disabled={loadingOrders} onClick={() => refreshOrders().catch((loadError) => setError(loadError.message))} type="button">
                <span aria-hidden="true">↻</span> {t('Refresh order status')}
              </button>
            </div>
            {error && <p className="mb-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
            {loadingOrders ? (
              <div className="rounded-[24px] border border-[#e7e3d9] bg-white p-8 text-center text-sm text-[#65748a]">{t('Loading orders…')}</div>
            ) : orders.length ? (
              <div className="space-y-4">
                {orders.map((order) => (
                  <article className="overflow-hidden rounded-[24px] border border-[#e7e3d9] bg-white shadow-[0_8px_26px_rgba(18,44,80,0.04)]" key={order.id}>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eeeae1] bg-[#fffefa] px-5 py-4 sm:px-6">
                      <div>
                        <h3 className="font-display text-lg font-extrabold">{t('Order #{id}', { id: order.id })}</h3>
                        <p className="mt-1 text-xs text-[#65748a]">{new Date(`${order.createdAt.replace(' ', 'T')}Z`).toLocaleString(language === 'fr' ? 'fr-CM' : 'en-CM')}</p>
                      </div>
                      <span className="rounded-full border border-[#eedb83] bg-[#fff5c7] px-3.5 py-1.5 text-xs font-extrabold text-[#715e00]">{orderStatus(order, t)}</span>
                    </div>
                    <div className="px-5 py-4 sm:px-6">
                      {order.scheduledFor && <p className="mb-3 inline-flex items-center gap-2 rounded-xl bg-[#f4f7fa] px-3 py-2 text-xs font-semibold text-[#52647b]"><span aria-hidden="true">◷</span>{t(order.fulfillmentType === 'pickup' ? 'Pickup scheduled' : 'Delivery scheduled')}: {new Date(order.scheduledFor).toLocaleString(language === 'fr' ? 'fr-CM' : 'en-CM')}</p>}
                    {order.status !== 'pending_payment' && order.status !== 'payment_failed' && <OrderProgress order={order} t={t} />}
                    <ul className="space-y-3">
                        {order.items.map((item, index) => <li className="flex items-center justify-between gap-4 text-sm" key={`${order.id}-${index}`}><span className="min-w-0 font-semibold text-[#52647b]">{item.name} <span className="text-[#8b95a2]">× {item.quantity}</span></span><span className="shrink-0 font-bold text-[#102c50]">{formatPrice(item.lineTotalCents)}</span></li>)}
                      </ul>
                      <div className="mt-4 flex items-center justify-between border-t border-[#eeeae1] pt-4">
                        <span className="text-sm font-bold text-[#65748a]">{t('Total')}</span>
                        <span className="font-display text-lg font-extrabold">{formatPrice(order.totalCents)}</span>
                      </div>
                      <div className="mt-4 rounded-xl border border-[#e6ebf1] bg-[#f7f9fc] px-3.5 py-3">
                        <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#8a7500]">{t('Assigned store')}</p>
                        <p className="mt-1 text-sm font-bold text-[#092a53]">{t(order.storeName || 'Store not recorded')}</p>
                        {order.storeAddress && <p className="mt-0.5 text-xs leading-5 text-[#65748a]">{t(order.storeAddress)}</p>}
                      </div>
                      <p className="mt-3 text-xs text-[#65748a]">{order.deliveryResidence ? `${order.deliveryResidence}, ` : ''}{order.deliveryCity}</p>
                      {order.status !== 'pending_payment' && order.status !== 'payment_failed' && <div className="mt-4 flex flex-wrap justify-end gap-3 border-t border-[#eeeae1] pt-4">
                        <button className="inline-flex items-center gap-2 rounded-full border border-[#d9d6cc] px-4 py-2.5 text-xs font-extrabold text-[#52647b] transition hover:border-[#092a53] hover:text-[#092a53] disabled:cursor-wait disabled:opacity-50" disabled={savingOrderId === order.id || savedCarts.some((savedCart) => savedCart.sourceOrderId === order.id)} onClick={() => saveOrder(order)} type="button">
                          {savingOrderId === order.id ? t('Saving…') : savedCarts.some((savedCart) => savedCart.sourceOrderId === order.id) ? t('Saved for later') : t('Save cart')}
                        </button>
                        <button className="inline-flex items-center gap-2 rounded-full bg-[#092a53] px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-[#163e6b] disabled:cursor-wait disabled:opacity-50" disabled={reorderingId === order.id} onClick={() => reorderItems(order.items, order.id)} type="button">{reorderingId === order.id ? t('Adding…') : t('Reorder')} <span aria-hidden="true">→</span></button>
                      </div>}
                      {order.status !== 'pending_payment' && order.status !== 'payment_failed' && <OrderReviewForm order={order} t={t} token={sessionStorage.getItem(CUSTOMER_TOKEN_KEY)} />}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-[24px] border border-[#e7e3d9] bg-white px-6 py-10 text-center shadow-[0_8px_26px_rgba(18,44,80,0.04)]">
                <span aria-hidden="true" className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#fff3b8] text-2xl text-[#806a00]">▤</span>
                <h3 className="mt-4 font-display text-xl font-extrabold">{t('No orders yet')}</h3>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#65748a]">{t('You have not placed any orders yet.')}</p>
                <Link className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#ffdc32] px-5 py-3 text-sm font-extrabold text-[#092a53] transition hover:-translate-y-0.5 hover:bg-[#ffe76c]" to="/menu">{t('Browse the menu')} <span aria-hidden="true">→</span></Link>
              </div>
            )}
          </section>

          <aside className="space-y-5">
            <section className="rounded-[24px] border border-[#e7e3d9] bg-white p-5 shadow-[0_8px_26px_rgba(18,44,80,0.04)] sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#a48700]">{t('Your collection')}</p>
                  <h2 className="mt-1 font-display text-xl font-extrabold">{t('Saved carts')}</h2>
                  <p className="mt-2 text-xs leading-5 text-[#65748a]">{t('Current prices and stock are checked when you add a saved cart.')}</p>
                </div>
                <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#fff3b8] text-lg text-[#806a00]">▤</span>
              </div>
              {savedCarts.length ? (
                <ul className="mt-4 divide-y divide-[#eeeae1]">
                  {savedCarts.map((savedCart) => (
                    <li className="py-3 first:pt-0 last:pb-0" key={savedCart.id}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-[#102c50]">{t(savedCart.label)}</p>
                          <p className="mt-1 text-xs text-[#65748a]">
                            {t('{count} items', { count: savedCart.items.reduce((count, item) => count + item.quantity, 0) })}
                          </p>
                        </div>
                        <button className="text-xs font-bold text-[#a34d4d] transition hover:text-red-800 disabled:opacity-50" disabled={deletingSavedCartId === savedCart.id} onClick={() => removeSavedCart(savedCart)} type="button">
                          {deletingSavedCartId === savedCart.id ? t('Removing…') : t('Remove')}
                        </button>
                      </div>
                      <button className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#092a53] px-4 py-2 text-xs font-extrabold text-white transition hover:bg-[#163e6b] disabled:cursor-wait disabled:opacity-50" disabled={reorderingId === `saved-${savedCart.id}`} onClick={() => reorderItems(savedCart.items, `saved-${savedCart.id}`)} type="button">
                        {reorderingId === `saved-${savedCart.id}` ? t('Adding…') : t('Add saved cart to bag')} <span aria-hidden="true">→</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 rounded-xl bg-[#fbfaf5] p-4 text-sm leading-6 text-[#65748a]">{t('No saved carts yet. Save a paid order to quickly rebuild its cart later.')}</p>
              )}
            </section>

            <section className="rounded-[24px] border border-[#e7e3d9] bg-white p-5 shadow-[0_8px_26px_rgba(18,44,80,0.04)] sm:p-6">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#a48700]">{t('Account profile')}</p>
                <h2 className="mt-1 font-display text-2xl font-extrabold">{t('Saved delivery details')}</h2>
                <p className="mt-2 text-sm leading-6 text-[#65748a]">{t('Keep your contact and delivery information up to date.')}</p>
              </div>
              <CustomerProfileDetails customer={customer} onSave={updateProfile} t={t} />
            </section>

            <section className="rounded-[24px] border border-[#e7e3d9] bg-white p-5 shadow-[0_8px_26px_rgba(18,44,80,0.04)] sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#a48700]">{t('Your collection')}</p>
                  <h2 className="mt-1 font-display text-xl font-extrabold">{t('Saved favorites')}</h2>
                </div>
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#fff0ed] text-lg text-[#b44947]" aria-hidden="true">♡</span>
              </div>
              {favorites.length ? <ul className="mt-4 divide-y divide-[#eeeae1]">{favorites.map((favorite) => (
                <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0" key={favorite.itemId}>
                  <img alt="" className="size-12 rounded-xl bg-[#f4f1e7] object-cover" src={favorite.item.image} />
                  <Link className="min-w-0 flex-1 truncate text-sm font-bold text-[#102c50] transition hover:text-[#806a00]" to={favorite.item.itemType === 'menu' ? '/menu' : '/flavors'}>{favorite.item.name}</Link>
                  <button className="shrink-0 text-xs font-bold text-[#a34d4d] transition hover:text-red-800" onClick={() => removeFavorite(favorite.itemId)} type="button">{t('Remove')}</button>
                </li>
              ))}</ul> : <p className="mt-4 rounded-xl bg-[#fbfaf5] p-4 text-sm leading-6 text-[#65748a]">{t('No saved favorites yet.')}</p>}
            </section>

            <section className="rounded-[24px] bg-[#092a53] p-5 text-white shadow-[0_10px_28px_rgba(9,42,83,0.12)] sm:p-6">
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="grid size-11 place-items-center rounded-2xl bg-[#ffdc32] text-xl text-[#092a53]">✦</span>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#ffdc32]">{t('Loyalty rewards')}</p>
                  <p className="mt-0.5 font-display text-2xl font-extrabold">{loyalty?.points ?? customer.loyaltyPoints ?? 0} <span className="text-sm">{t('points')}</span></p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-white/75">{t('Earn 1 point per 100 FCFA. Redeem 100 points for 1,000 FCFA off.')}</p>
              {loyalty?.entries?.length > 0 && <details className="mt-5 border-t border-white/15 pt-4">
                <summary className="cursor-pointer text-sm font-bold">{t('Points history')}</summary>
                <ul className="mt-3 space-y-2 text-sm text-white/80">{loyalty.entries.map((entry) => <li className="flex justify-between gap-3" key={entry.id}><span>{t(entry.entryType)} · {t('Order #{id}', { id: entry.orderId })}</span><span className="font-bold text-white">{entry.pointsDelta > 0 ? '+' : ''}{entry.pointsDelta}</span></li>)}</ul>
              </details>}
            </section>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  )
}
