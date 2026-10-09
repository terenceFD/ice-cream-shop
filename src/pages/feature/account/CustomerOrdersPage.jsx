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
    <form className="mt-4 space-y-3" onSubmit={saveProfile}>
      <div className="flex items-center gap-4 rounded-2xl border border-[#d9d6cc] bg-[#fffdf5] p-3">
        {profile.profilePicture ? (
          <img alt={profile.name || 'Profile'} className="size-16 rounded-full object-cover" src={profile.profilePicture} />
        ) : (
          <div className="flex size-16 items-center justify-center rounded-full bg-[#ffeb9c] text-lg font-bold text-[#102c50]">{(profile.name || 'A').charAt(0).toUpperCase()}</div>
        )}
        <label className="flex-1 text-sm font-semibold text-[#65748a]">
          {t('Profile picture')}
          <input accept="image/*" className={`${fieldClass} mt-1`} onChange={handleProfilePictureChange} type="file" />
          <span className="mt-1 block text-xs font-normal text-[#65748a]">{t('Optional. Image will be resized before saving (5 MB max).')}</span>
        </label>
      </div>
      <label className="block text-sm font-semibold">{t('Full name')}<input className={fieldClass} maxLength={100} onChange={(event) => setProfile({ ...profile, name: event.target.value })} required value={profile.name} /></label>
      <label className="block text-sm font-semibold">{t('Phone number')}<input className={fieldClass} maxLength={40} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} value={profile.phone} /></label>
      <label className="block text-sm font-semibold">{t('City / Cold Stone location')}<select className={fieldClass} onChange={(event) => setProfile({ ...profile, deliveryCity: event.target.value })} value={profile.deliveryCity}><option value="">{t('Select a listed location')}</option>{cameroonDeliveryLocations.map((location) => <option key={location.value} value={location.value}>{t(location.town)} — {t(location.area)}</option>)}</select></label>
      <label className="block text-sm font-semibold">{t('Your residence')}<input className={fieldClass} maxLength={150} onChange={(event) => setProfile({ ...profile, deliveryResidence: event.target.value })} value={profile.deliveryResidence} /></label>
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
      {message && <p className="rounded-xl bg-green-50 p-3 text-sm text-green-800" role="status">{message}</p>}
      <button className="rounded-full bg-[#ffdc32] px-5 py-3 text-sm font-bold disabled:opacity-50" disabled={isSaving} type="submit">{isSaving ? t('Saving…') : t('Save delivery details')}</button>
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
  const [loyalty, setLoyalty] = useState(null)
  const [accountError, setAccountError] = useState('')
  const [reorderingId, setReorderingId] = useState(null)
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
      apiRequest('/customer/loyalty', { token }),
    ]).then(([favoriteResult, loyaltyResult]) => {
      if (cancelled) return
      setFavorites(favoriteResult.favorites)
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

  async function reorder(order) {
    setReorderingId(order.id)
    setAccountError('')
    try {
      const [menuResult, flavorResult] = await Promise.all([apiRequest('/menu'), apiRequest('/flavors')])
      const catalog = new Map([
        ...menuResult.categories.flatMap((category) => category.items.map((item) => [item.id, item])),
        ...flavorResult.flavors.map((flavor) => [`flavor:${flavor.id}`, flavor]),
      ])
      const products = order.items.flatMap((item) => {
        const product = catalog.get(item.productId)
        return product ? [{ ...product, quantity: item.quantity }] : []
      })
      const added = addItemsToCart(products)
      if (added > 0) navigate('/cart')
      else setAccountError(t('The products in this order are currently unavailable.'))
    } catch (reorderError) {
      setAccountError(reorderError.message)
    } finally {
      setReorderingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f7f2] text-[#102c50]">
      <Header />
      <main className="mx-auto max-w-[1100px] px-5 py-10 sm:px-8 sm:py-14">
        <h1 className="font-display text-4xl font-bold">{t('My account')}</h1>
        {accountError && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{accountError}</p>}
        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-[#d9d6cc] bg-white p-5">
            <h2 className="font-display text-xl font-bold">{t('Loyalty rewards')}</h2>
            <p className="mt-2 text-3xl font-bold">{loyalty?.points ?? customer.loyaltyPoints ?? 0} <span className="text-sm font-semibold">{t('points')}</span></p>
            <p className="mt-1 text-sm text-[#65748a]">{t('Earn 1 point per 100 FCFA. Redeem 100 points for 1,000 FCFA off.')}</p>
          </article>
          <article className="rounded-2xl border border-[#d9d6cc] bg-white p-5">
            <h2 className="font-display text-xl font-bold">{t('Saved favorites')}</h2>
            {favorites.length ? <ul className="mt-3 space-y-2">{favorites.map((favorite) => (
              <li className="flex items-center gap-3" key={favorite.itemId}>
                <img alt="" className="size-12 rounded-lg object-cover" src={favorite.item.image} />
                <Link className="min-w-0 flex-1 truncate text-sm font-semibold underline" to={favorite.item.itemType === 'menu' ? '/menu' : '/flavors'}>{favorite.item.name}</Link>
                <button className="text-xs font-bold text-red-700 underline" onClick={() => removeFavorite(favorite.itemId)} type="button">{t('Remove')}</button>
              </li>
            ))}</ul> : <p className="mt-2 text-sm text-[#65748a]">{t('No saved favorites yet.')}</p>}
          </article>
        </section>
        {loyalty?.entries?.length > 0 && <details className="mt-4 rounded-xl border border-[#d9d6cc] bg-white p-4">
          <summary className="cursor-pointer text-sm font-bold">{t('Points history')}</summary>
          <ul className="mt-3 space-y-2 text-sm">{loyalty.entries.map((entry) => <li className="flex justify-between gap-3" key={entry.id}><span>{t(entry.entryType)} · {t('Order #{id}', { id: entry.orderId })}</span><span className="font-bold">{entry.pointsDelta > 0 ? '+' : ''}{entry.pointsDelta}</span></li>)}</ul>
        </details>}
        <div className="mt-7 grid items-start gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <section className="rounded-2xl border border-[#d9d6cc] bg-white p-5 sm:p-7">
            <h2 className="font-display text-2xl font-bold">{t('Saved delivery details')}</h2>
            <CustomerProfileDetails customer={customer} onSave={updateProfile} t={t} />
          </section>
          <section>
            <h2 className="font-display text-2xl font-bold">{t('Order history and status')}</h2>
            {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
            {loadingOrders ? <p className="mt-4 text-sm text-[#65748a]">{t('Loading orders…')}</p> : orders.length ? (
              <div className="mt-4 space-y-4">
                {orders.map((order) => (
                  <article className="rounded-2xl border border-[#d9d6cc] bg-white p-5" key={order.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div><h3 className="font-display text-xl font-bold">{t('Order #{id}', { id: order.id })}</h3><p className="mt-1 text-xs text-[#65748a]">{new Date(`${order.createdAt.replace(' ', 'T')}Z`).toLocaleString()}</p></div>
                      <span className="rounded-full bg-[#fff0a8] px-3 py-1 text-xs font-bold">{orderStatus(order, t)}</span>
                    </div>
                    {order.scheduledFor && <p className="mt-2 text-xs text-[#65748a]">{t(order.fulfillmentType === 'pickup' ? 'Pickup scheduled' : 'Delivery scheduled')}: {new Date(order.scheduledFor).toLocaleString(language === 'fr' ? 'fr-CM' : 'en-CM')}</p>}
                    <ul className="mt-4 space-y-1 border-t border-[#d9d6cc] pt-3 text-sm">
                      {order.items.map((item, index) => <li className="flex justify-between gap-3" key={`${order.id}-${index}`}><span>{item.name} × {item.quantity}</span><span>{formatPrice(item.lineTotalCents)}</span></li>)}
                    </ul>
                    <div className="mt-3 flex justify-between border-t border-[#d9d6cc] pt-3 font-bold"><span>{t('Total')}</span><span>{formatPrice(order.totalCents)}</span></div>
                    <p className="mt-2 text-xs text-[#65748a]">{order.deliveryResidence}, {order.deliveryCity}</p>
                    {order.status !== 'pending_payment' && order.status !== 'payment_failed' && <div className="mt-4 flex flex-wrap justify-between gap-3 border-t border-[#d9d6cc] pt-3">
                      <button className="text-sm font-bold underline disabled:opacity-50" disabled={reorderingId === order.id} onClick={() => reorder(order)} type="button">{reorderingId === order.id ? t('Adding…') : t('Reorder')}</button>
                    </div>}
                    {order.status !== 'pending_payment' && order.status !== 'payment_failed' && <OrderReviewForm order={order} t={t} token={sessionStorage.getItem(CUSTOMER_TOKEN_KEY)} />}
                  </article>
                ))}
              </div>
            ) : <p className="mt-4 rounded-xl bg-white p-5 text-sm text-[#65748a]">{t('You have not placed any orders yet.')} <Link className="font-bold underline" to="/menu">{t('Browse the menu')}</Link></p>}
            <button className="mt-4 text-sm font-bold text-[#65748a] underline" onClick={() => refreshOrders().catch((loadError) => setError(loadError.message))} type="button">{t('Refresh order status')}</button>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
