import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../AdminAuthContext'
import { Footer, Header } from './Layout'
import { useLanguage } from '../LanguageContext'

const navItems = [
  { to: '/admin', label: 'Flavors', end: true, icon: '🍦' },
  { to: '/admin/orders', label: 'Orders', icon: '▤' },
  { to: '/admin/delivered', label: 'Delivered', icon: '✓' },
  { to: '/admin/payments', label: 'Payments', icon: '$' },
  { to: '/admin/notifications', label: 'Notifications', icon: '✉' },
  { to: '/admin/admins', label: 'Admin accounts', icon: '♙' },
]

export function AdminLayout() {
  const { currentAdmin, logout } = useAdminAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [logoutError, setLogoutError] = useState('')
  const [isLoggingOut, setIsLoggingOut] = useState(false)

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
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#ffdc32] font-display text-lg font-bold text-[#092a53]">
                {currentAdmin?.name?.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{currentAdmin?.name}</p>
              <p className="text-xs text-white/60">{t('Admin portal')}</p>
            </div>
          </div>

          <nav aria-label={t('Admin dashboard')} className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
            {navItems.map((item) => (
              <NavLink
                className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-left text-xs font-bold transition sm:text-sm ${
                  isActive ? 'bg-[#ffdc32] text-[#092a53]' : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
                end={item.end}
                key={item.to}
                to={item.to}
              >
                <span aria-hidden="true" className="text-base">{item.icon}</span>
                {t(item.label)}
              </NavLink>
            ))}
          </nav>

          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/15 pt-4 lg:mt-auto lg:grid-cols-1">
            <NavLink className="rounded-xl px-3 py-2.5 text-xs font-bold text-white/75 transition hover:bg-white/10 hover:text-white sm:text-sm" to="/flavors">
              {t('View storefront')}
            </NavLink>
            <button className="rounded-xl px-3 py-2.5 text-left text-xs font-bold text-white/75 transition hover:bg-white/10 hover:text-white disabled:opacity-60 sm:text-sm" disabled={isLoggingOut} onClick={handleLogout} type="button">
              {isLoggingOut ? t('Signing out…') : t('Log out')}
            </button>
          </div>
          {logoutError && <p className="mt-3 rounded-xl bg-red-100 px-3 py-2 text-xs text-red-800" role="alert">{logoutError}</p>}
        </aside>

        <main className="min-w-0 rounded-[24px] border border-[#ece8de] bg-[#fffefa] p-4 shadow-[0_8px_30px_rgba(18,44,80,0.04)] sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
      <Footer />
    </div>
  )
}
