import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../pages/feature/admin/AdminAuthContext'
import { apiRequest } from '../api/api'
import { useLanguage } from '../language/LanguageContext'

const navItems = [
  { to: '/admin', label: 'Flavors', group: 'Catalog', icon: 'icecream', end: true },
  { to: '/admin/menu', label: 'Menu management', group: 'Catalog', icon: 'menu' },
  { to: '/admin/inventory', label: 'Menu inventory', group: 'Catalog', icon: 'inventory' },
  { to: '/admin/categories', label: 'Categories', group: 'Catalog', icon: 'categories' },
  { to: '/admin/orders', label: 'Orders', group: 'Sales', icon: 'orders' },
  { to: '/admin/delivered', label: 'Delivered', group: 'Sales', icon: 'delivered' },
  { to: '/admin/payments', label: 'Payments', group: 'Sales', icon: 'payments' },
  { to: '/admin/promotions', label: 'Promotions', group: 'Sales', icon: 'promotions' },
  { to: '/admin/reports', label: 'Reports', group: 'Sales', icon: 'reports' },
  { to: '/admin/customers', label: 'Customer accounts', group: 'Customers', icon: 'customers' },
  { to: '/admin/reviews', label: 'Customer reviews', group: 'Customers', icon: 'reviews' },
  { to: '/admin/cake-requests', label: 'Cake requests', group: 'Customers', icon: 'cakes' },
  { to: '/admin/notifications', label: 'Notifications', group: 'Customers', icon: 'notifications' },
  { to: '/admin/admins', label: 'Admin accounts', group: 'Workspace', icon: 'admins' },
]

const navGroups = ['Catalog', 'Sales', 'Customers', 'Workspace']

const navIconPaths: Record<string, string> = {
  icecream: 'M12 3a6 6 0 0 0-3.55 10.84L12 21l3.55-7.16A6 6 0 0 0 12 3Zm-3.5 7h7',
  menu: 'M4 6h16M4 12h16M4 18h16',
  inventory: 'M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9ZM4 7.5l8 4.5m0 0 8-4.5m-8 4.5V21',
  categories: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  orders: 'M7 3h8l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm8 0v5h4m-7 4h3m-3 4h3',
  delivered: 'm5 12 4 4L19 6',
  payments: 'M3 6h18v12H3zM3 10h18m-14 4h4',
  promotions: 'm20 13-7 7-10-10V3h7l10 10ZM7.5 7.5h.01',
  reports: 'M4 19V5m0 14h17M8 15l3-4 3 2 5-7',
  customers: 'M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20m17 0v-1.5a4 4 0 0 0-3-3.87M14 3.2a4 4 0 0 1 0 7.6M9.5 10.8a3.8 3.8 0 1 0 0-7.6 3.8 3.8 0 0 0 0 7.6Z',
  reviews: 'm12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z',
  cakes: 'M4 11h16v9H4zm0 0 2-6h12l2 6m-9 0v3m3-3v3M8 5V3m8 2V3',
  notifications: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12h4',
  admins: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0m-1-15 2 2 2-2',
}

interface NavigationCounts {
  orderCount: number
  notificationCount: number
  cakeRequestCount: number
  reviewCount: number
}

export function AdminLayout() {
  const { currentAdmin, logout, sessionToken } = useAdminAuth()
  const { t, language, setLanguage } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  const [logoutError, setLogoutError] = useState('')
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [navigationCounts, setNavigationCounts] = useState<NavigationCounts>({ orderCount: 0, notificationCount: 0, cakeRequestCount: 0, reviewCount: 0 })
  const [countsError, setCountsError] = useState('')

  const refreshNavigationCounts = useCallback(async () => {
    try {
      const [ordersResult, notificationsResult, cakeRequestsResult, reviewsResult] = await Promise.all([
        apiRequest<{ orders: unknown[] }>('/admin/orders', { token: sessionToken }),
        apiRequest<{ unreadCount: number }>('/admin/notifications', { token: sessionToken }),
        apiRequest<{ requests: { status: string }[] }>('/admin/cake-requests', { token: sessionToken }),
        apiRequest<{ pendingCount: number }>('/admin/reviews?countOnly=true', { token: sessionToken }),
      ])
      setNavigationCounts({
        orderCount: ordersResult.orders.length,
        notificationCount: notificationsResult.unreadCount,
        cakeRequestCount: cakeRequestsResult.requests.filter((request) => request.status === 'new').length,
        reviewCount: reviewsResult.pendingCount,
      })
      setCountsError('')
    } catch (error) {
      setCountsError(error instanceof Error ? error.message : 'Unable to refresh navigation counts.')
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
      setLogoutError(error instanceof Error ? error.message : 'Unable to sign out.')
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f3f6fa] text-[#102c50]">
      <header className="sticky top-0 z-40 border-b border-[#e6ebf1] bg-white/95 shadow-[0_3px_16px_rgba(16,44,80,0.04)] backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link aria-label={t('Admin portal')} className="flex min-w-0 items-center gap-3" to="/admin">
            <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#092a53] text-xl text-[#ffdc32] shadow-sm">🍦</span>
            <span className="min-w-0">
              <span className="block truncate font-display text-base font-extrabold leading-tight text-[#092a53] sm:text-lg">Cold Stone <span className="text-[#bd9c00]">Cameroon</span></span>
              <span className="mt-0.5 hidden text-[10px] font-bold uppercase tracking-[0.15em] text-[#7b899a] sm:block">{t('Administration workspace')}</span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <div aria-label={t('Select language')} className="inline-flex items-center rounded-lg border border-[#dce5ef] bg-[#f6f9fc] p-0.5" role="group">
              {(['en', 'fr'] as const).map((option) => (
                <button
                  aria-pressed={language === option}
                  className={`min-h-8 min-w-9 rounded-md px-2 text-[10px] font-extrabold tracking-wide transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#bd9c00] ${
                    language === option ? 'bg-[#092a53] text-white shadow-sm' : 'text-[#65748a] hover:text-[#092a53]'
                  }`}
                  key={option}
                  onClick={() => setLanguage(option)}
                  type="button"
                >
                  {option.toUpperCase()}
                </button>
              ))}
            </div>
            <span className="hidden rounded-full border border-[#dce5ef] bg-[#f6f9fc] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#50657d] md:inline-flex">{t('Admin portal')}</span>
            <span aria-hidden="true" className="hidden h-8 w-px bg-[#e7ebf0] sm:block" />
            {currentAdmin?.profilePicture ? (
              <img alt="" className="size-9 rounded-full object-cover ring-2 ring-[#e8eef5]" src={currentAdmin.profilePicture} />
            ) : (
              <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-[#ffdc32] text-sm font-extrabold text-[#092a53]">{currentAdmin?.name?.charAt(0).toUpperCase()}</span>
            )}
            <span className="hidden min-w-0 sm:block">
              <span className="block max-w-40 truncate text-xs font-bold text-[#173654]">{currentAdmin?.name}</span>
              <span className="mt-0.5 block text-[10px] text-[#8190a1]">{t('Administrator')}</span>
            </span>
            <Link className="ml-1 inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#dce5ef] px-3 text-xs font-bold text-[#355777] transition hover:border-[#bacbdc] hover:bg-[#f6f9fc] hover:text-[#092a53] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00]" to="/flavors">
              <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 20 20">
                <path d="M3 9.5 10 4l7 5.5v7a1 1 0 0 1-1 1h-4v-5H8v5H4a1 1 0 0 1-1-1v-7Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
              </svg>
              <span className="hidden sm:inline">{t('View storefront')}</span>
            </Link>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1600px] gap-5 px-3 py-5 sm:px-6 sm:py-7 lg:grid-cols-[268px_minmax(0,1fr)] lg:gap-7 lg:px-8">
        <aside className="h-fit overflow-hidden rounded-[22px] border border-[#183d63] bg-gradient-to-b from-[#123b63] via-[#0d3157] to-[#092a4c] text-white shadow-[0_12px_34px_rgba(9,42,83,0.18)] lg:sticky lg:top-[92px] lg:flex lg:max-h-[calc(100vh-112px)] lg:flex-col">
          <div className="border-b border-white/10 bg-white/[0.035] px-5 py-5">
            <div className="flex items-center gap-3">
              {currentAdmin?.profilePicture ? (
                <img alt="" className="size-11 shrink-0 rounded-xl object-cover ring-2 ring-white/20" src={currentAdmin.profilePicture} />
              ) : (
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#ffdc32] font-display text-lg font-extrabold text-[#102c50]">{currentAdmin?.name?.charAt(0).toUpperCase()}</span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{currentAdmin?.name}</p>
                <p className="mt-0.5 truncate text-[11px] text-white/65">{currentAdmin?.email}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 border-t border-white/15 pt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-white/70">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-[#9ee6b1] shadow-[0_0_0_3px_rgba(158,230,177,0.13)]" />
              {t('Signed in to admin')}
            </div>
          </div>

          <nav aria-label={t('Admin dashboard')} className="grid min-w-0 grid-cols-2 gap-x-2 gap-y-4 p-3 sm:grid-cols-3 lg:min-h-0 lg:flex-1 lg:grid-cols-1 lg:gap-0 lg:overflow-y-auto lg:p-3">
            {navGroups.map((group) => (
              <section className="contents lg:block" key={group}>
                <h2 className="hidden px-3 pb-1 pt-4 text-[9px] font-extrabold uppercase tracking-[0.16em] text-white/45 first:pt-1 lg:block">{t(group)}</h2>
                <div className="contents lg:block">
                  {navItems.filter((item) => item.group === group).map((item) => {
                    const count = item.label === 'Orders'
                      ? navigationCounts.orderCount
                      : item.label === 'Customer reviews'
                        ? navigationCounts.reviewCount
                      : item.label === 'Notifications'
                        ? navigationCounts.notificationCount
                        : item.label === 'Cake requests'
                          ? navigationCounts.cakeRequestCount
                          : null
                    const countLabel = item.label === 'Orders'
                      ? t('{count} orders not delivered', { count: count || 0 })
                      : item.label === 'Customer reviews'
                        ? t('{count} pending customer reviews', { count: count || 0 })
                      : item.label === 'Notifications'
                        ? t('{count} unread notifications', { count: count || 0 })
                        : t('{count} new cake requests', { count: count || 0 })
                    return (
                      <NavLink
                        className={({ isActive }) => `group flex min-h-11 min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-[11px] font-semibold transition sm:gap-2.5 sm:px-3 sm:text-xs lg:mb-1 lg:border-transparent lg:px-3 ${
                          isActive
                            ? 'border-[#ffdc32]/40 bg-[#ffdc32] text-[#092a53] shadow-[inset_3px_0_0_#092a53]'
                            : 'border-transparent text-white/75 hover:bg-white/10 hover:text-white'
                        }`}
                        end={item.end}
                        key={item.to}
                        to={item.to}
                      >
                        <span className={`grid size-8 shrink-0 place-items-center rounded-lg transition ${
                          location.pathname === item.to || (item.end && location.pathname === item.to)
                            ? 'bg-[#092a53]/10 text-[#092a53]'
                            : 'bg-white/10 text-white/65 group-hover:bg-white/20 group-hover:text-white'
                        }`}>
                          <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
                            <path d={navIconPaths[item.icon]} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
                          </svg>
                        </span>
                        <span className="min-w-0 flex-1 leading-tight">{t(item.label)}</span>
                        {count !== null && (
                          <span
                            aria-label={countLabel}
                            className={`inline-flex min-w-5 shrink-0 items-center justify-center rounded-md px-1.5 py-1 text-[10px] font-extrabold leading-none ${
                              count > 0 ? 'bg-[#ffdc32] text-[#092a53]' : 'bg-white/15 text-white/75'
                            }`}
                          >
                            {count}
                          </span>
                        )}
                      </NavLink>
                    )
                  })}
                </div>
              </section>
            ))}
          </nav>
          {countsError && (
            <p className="mx-3 mb-3 rounded-xl border border-red-200/20 bg-red-500/15 px-3 py-2 text-[11px] text-red-100" role="status">
              {t('Unable to refresh navigation counts')}: {countsError}
            </p>
          )}

          <div className="grid shrink-0 grid-cols-1 gap-2 border-t border-white/10 bg-[#082746]/45 p-3">
            <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold text-white/75 transition hover:bg-white/10 hover:text-white disabled:opacity-60 lg:justify-start" disabled={isLoggingOut} onClick={handleLogout} type="button">
              <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 20 20">
                <path d="M8 4H4.5A1.5 1.5 0 0 0 3 5.5v9A1.5 1.5 0 0 0 4.5 16H8m4-9 4 3-4 3m4-3H7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
              </svg>
              {isLoggingOut ? t('Signing out…') : t('Log out')}
            </button>
          </div>
          {logoutError && <p className="mx-3 mb-3 rounded-xl border border-red-200/20 bg-red-500/15 px-3 py-2 text-xs text-red-100" role="alert">{logoutError}</p>}
        </aside>

        <main className="min-h-[60vh] min-w-0 rounded-[22px] border border-[#e2e8f0] bg-white p-4 shadow-[0_8px_28px_rgba(16,44,80,0.04)] sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
