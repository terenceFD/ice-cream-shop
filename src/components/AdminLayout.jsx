import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../pages/feature/admin/AdminAuthContext'
import { Footer, Header } from './Layout'
import { apiRequest } from '../api/api'
import { useLanguage } from '../language/LanguageContext'

const navItems = [
  { to: '/admin', label: 'Flavors', end: true, icon: '🍦' },
  { to: '/admin/menu', label: 'Menu management', icon: '☰' },
  { to: '/admin/inventory', label: 'Menu inventory', icon: '▣' },
  { to: '/admin/categories', label: 'Categories', icon: '▦' },
  { to: '/admin/promotions', label: 'Promotions', icon: '%' },
  { to: '/admin/reports', label: 'Reports', icon: '▥' },
  { to: '/admin/reviews', label: 'Customer reviews', icon: '★' },
  { to: '/admin/orders', label: 'Orders', icon: '▤' },
  { to: '/admin/delivered', label: 'Delivered', icon: '✓' },
  { to: '/admin/payments', label: 'Payments', icon: 'CFA' },
  { to: '/admin/notifications', label: 'Notifications', icon: '✉' },
  { to: '/admin/customers', label: 'Customer accounts', icon: '♧' },
  { to: '/admin/admins', label: 'Admin accounts', icon: '♙' },
]

export function AdminLayout() {
  const { currentAdmin, logout, sessionToken } = useAdminAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [logoutError, setLogoutError] = useState('')
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [navigationCounts, setNavigationCounts] = useState({ orderCount: 0, notificationCount: 0 })
  const [countsError, setCountsError] = useState('')

  const refreshNavigationCounts = useCallback(async () => {
    try {
      const [ordersResult, notificationsResult] = await Promise.all([
        apiRequest('/admin/orders', { token: sessionToken }),
        apiRequest('/admin/notifications', { token: sessionToken }),
      ])
      setNavigationCounts({
        orderCount: ordersResult.orders.length,
        notificationCount: notificationsResult.unreadCount,
      })
      setCountsError('')
    } catch (error) {
      setCountsError(error.message)
    }
  }, [sessionToken])

  useEffect(() => {
    refreshNavigationCounts()
    const intervalId = window.setInterval(refreshNavigationCounts, 15000)
    window.addEventListener('focus', refreshNavigationCounts)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refreshNavigationCounts)
    }
  }, [refreshNavigationCounts])

  async function handleLogout() {
    setLogoutError('')
    setIsLoggingOut(true)
    try {
      await logout()
      navigate('/admin/login', { replace: true })
    } catch (error) {
      setLogoutError(error.message)
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f7f2] text-[#102c50]">
      <Header />
      <div className="mx-auto grid max-w-[1440px] gap-5 px-4 pb-8 sm:px-6 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-7 lg:px-8">
        <aside className="h-fit rounded-[24px] bg-[#092a53] p-4 text-white shadow-[0_12px_36px_rgba(9,42,83,0.12)] lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:p-5">
          <div className="flex items-center gap-3 border-b border-white/15 px-2 pb-4">
            {currentAdmin?.profilePicture ? (
              <img alt="" className="size-11 shrink-0 rounded-full object-cover" src={currentAdmin.profilePicture} />
            ) : (
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#ffdc32] font-display text-lg font-bold text-[#102c50]">
                {currentAdmin?.name?.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{currentAdmin?.name}</p>
              <p className="text-xs text-white/60">{t('Admin portal')}</p>
            </div>
          </div>

          <nav aria-label={t('Admin dashboard')} className="mt-4 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:min-h-0 lg:flex-1 lg:grid-cols-1 lg:overflow-y-auto lg:pr-1">
            {navItems.map((item) => (
              <NavLink
                className={({ isActive }) => `flex min-h-11 w-full min-w-0 items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold transition sm:gap-3 sm:text-sm ${
                  isActive ? 'border-b-2 border-[#ffdc32] text-[#ffdc32]' : 'border-b-2 border-transparent text-white/80 hover:border-white/50 hover:bg-white/10 hover:text-white'
                }`}
                end={item.end}
                key={item.to}
                to={item.to}
              >
                <span className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                  <span aria-hidden="true" className="text-base">{item.icon}</span>
                  <span className="min-w-0 break-words leading-tight">{t(item.label)}</span>
                </span>
                {(item.label === 'Orders' || item.label === 'Notifications') && (() => {
                  const count = item.label === 'Orders'
                    ? navigationCounts.orderCount
                    : navigationCounts.notificationCount
                  const countLabel = item.label === 'Orders'
                    ? t('{count} orders not delivered', { count })
                    : t('{count} unread notifications', { count })
                  return (
                    <span
                      aria-label={countLabel}
                      className={`ml-auto inline-flex min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-extrabold leading-none ${
                        count > 0
                          ? 'bg-[#ffdc32] text-[#102c50]'
                          : 'bg-white/15 text-white/80'
                      }`}
                    >
                      {count}
                    </span>
                  )
                })()}
              </NavLink>
            ))}
          </nav>
          {countsError && (
            <p className="mt-3 rounded-xl bg-red-100 px-3 py-2 text-xs text-red-800" role="status">
              {t('Unable to refresh navigation counts')}: {countsError}
            </p>
          )}

          <div className="mt-4 grid shrink-0 grid-cols-2 gap-2 border-t border-white/15 pt-4 lg:mt-auto lg:grid-cols-1">
            <NavLink className="rounded-xl px-3 py-2.5 text-xs font-bold text-white/75 transition hover:bg-white/10 hover:text-white sm:text-sm" to="/flavors">
              {t('View storefront')}
            </NavLink>
            <button className="rounded-xl px-3 py-2.5 text-left text-xs font-bold text-white/75 transition hover:bg-white/10 hover:text-white disabled:opacity-60 sm:text-sm" disabled={isLoggingOut} onClick={handleLogout} type="button">
              {isLoggingOut ? t('Signing out…') : t('Log out')}
            </button>
          </div>
          {logoutError && <p className="mt-3 rounded-xl bg-red-100 px-3 py-2 text-xs text-red-800" role="alert">{logoutError}</p>}
        </aside>

        <main className="min-w-0 rounded-[24px] border border-[#d9d6cc] bg-[#f8f7f2] p-4 shadow-[0_8px_30px_rgba(18,44,80,0.04)] sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
      <Footer />
    </div>
  )
}
