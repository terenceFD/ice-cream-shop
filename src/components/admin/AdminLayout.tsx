import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../../pages/admin/useAdminAuth'
import { apiRequest, ADMIN_STORE_TOWN_KEY, ADMIN_WELCOME_KEY } from '../../api/api'
import { useLanguage } from '../../language/useLanguage'
import { AdminAccountSecurityDialog, type AccountSecurityTab } from './AdminAccountSecurityDialog'
import { AdminIdleGuard } from './AdminIdleGuard'

const MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024
const PROFILE_IMAGE_DIMENSION = 256

async function resizeProfilePicture(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choose an image file for the profile picture.')
  }
  if (file.size > MAX_PROFILE_IMAGE_SIZE) {
    throw new Error('Choose an image smaller than 5 MB.')
  }

  const image = await createImageBitmap(file)
  const scale = Math.min(1, PROFILE_IMAGE_DIMENSION / Math.max(image.width, image.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))
  const context = canvas.getContext('2d')
  if (!context) {
    image.close()
    throw new Error('Your browser could not prepare the profile picture.')
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  image.close()
  return canvas.toDataURL('image/jpeg', 0.8)
}

const navItems = [
  { to: '/admin/overview', label: 'Store overview', group: 'Overview', icon: 'overview' },
  { to: '/admin/stores', label: 'Stores', group: 'Overview', icon: 'store' },
  { to: '/admin', label: 'Flavors', group: 'Catalog', icon: 'icecream', end: true },
  { to: '/admin/menu', label: 'Menu management', group: 'Catalog', icon: 'menu' },
  { to: '/admin/inventory', label: 'Menu inventory', group: 'Catalog', icon: 'inventory' },
  { to: '/admin/categories', label: 'Categories', group: 'Catalog', icon: 'categories' },
  { to: '/admin/stock-alerts', label: 'Low-stock alerts', group: 'Catalog', icon: 'alerts' },
  { to: '/admin/orders', label: 'Orders', group: 'Sales', icon: 'orders' },
  { to: '/admin/notifications', label: 'Notifications', group: 'Sales', icon: 'notifications' },
  { to: '/admin/delivered', label: 'Delivered', group: 'Sales', icon: 'delivered' },
  { to: '/admin/payments', label: 'Payments', group: 'Sales', icon: 'payments' },
  { to: '/admin/promotions', label: 'Promotions', group: 'Sales', icon: 'promotions' },
  { to: '/admin/reports', label: 'Reports', group: 'Sales', icon: 'reports' },
  { to: '/admin/customers', label: 'Customer accounts', group: 'Customers', icon: 'customers' },
  { to: '/admin/reviews', label: 'Customer reviews', group: 'Customers', icon: 'reviews' },
  { to: '/admin/cake-requests', label: 'Cake requests', group: 'Customers', icon: 'cakes' },
  { to: '/admin/events', label: 'Event orders', group: 'Customers', icon: 'events' },
  { to: '/admin/fulfillment', label: 'Pickup & delivery', group: 'Workspace', icon: 'fulfillment' },
  { to: '/admin/admins', label: 'Admin accounts', group: 'Workspace', icon: 'admins' },
  { to: '/admin/activity', label: 'Activity log', group: 'Workspace', icon: 'activity' },
]

const navGroups = ['Overview', 'Catalog', 'Sales', 'Customers', 'Workspace']
const SIDEBAR_COLLAPSED_KEY = 'admin-sidebar-collapsed'

const navIconPaths: Record<string, string> = {
  overview: 'M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z',
  store: 'M4 10h16l-1.5-5h-13L4 10Zm0 0v10h16V10M9 20v-5h6v5',
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
  events: 'M5 5h14v15H5zM5 9h14M9 3v4m6-4v4m-6 6h2m2 0h2m-6 3h2',
  notifications: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12h4',
  admins: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0m-1-15 2 2 2-2',
  alerts: 'M12 9v4m0 3.5v.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  fulfillment: 'M3 6h11v9H3V6Zm11 3h4l3 3v3h-7V9ZM7 18.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm12 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z',
  activity: 'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
}

interface NavigationCounts {
  orderCount: number
  notificationCount: number
  cakeRequestCount: number
  reviewCount: number
  eventOrderCount: number
}

async function refreshNavigationCount<T>(
  label: string,
  request: Promise<T>,
  update: (result: T) => void,
): Promise<string> {
  try {
    update(await request)
    return ''
  } catch (error) {
    return `${label}: ${error instanceof Error ? error.message : 'Unable to load count.'}`
  }
}

interface DepositNotice {
  id: number
  customerName: string
  depositAmount: number
  eventType: string
  eventDate: string
  storeName: string | null
}

function formatDepositAmount(amount: number, language: string) {
  return `${new Intl.NumberFormat(language === 'fr' ? 'fr-CM' : 'en-US').format(Math.round(amount || 0))} FCFA`
}

export function AdminLayout() {
  const { currentAdmin, logout, sessionToken, updateProfilePicture } = useAdminAuth()
  const { t, language, setLanguage } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  const isOwner = currentAdmin?.role === 'owner'
  const isBranchAdmin = currentAdmin?.role === 'branch_admin'
  const hasTownScope = isOwner || isBranchAdmin
  const storeDisplayName = currentAdmin?.role === 'store_admin'
    ? currentAdmin.storeName?.replace(/\s+branch$/i, '').trim()
    : currentAdmin?.storeName
  const profilePictureInput = useRef<HTMLInputElement>(null)
  const sidebarNavRef = useRef<HTMLElement>(null)
  // Keep the current page's link visible when the sidebar list is taller than the screen.
  useEffect(() => {
    sidebarNavRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'center' })
  }, [location.pathname])
  const storeNavItems = navItems.filter((item) => [
    '/admin/overview',
    '/admin/stores',
    '/admin/orders',
    '/admin/delivered',
    '/admin/payments',
    '/admin/reports',
    '/admin/notifications',
    '/admin/customers',
    '/admin/reviews',
    '/admin/cake-requests',
    '/admin/events',
  ].includes(item.to))
  const visibleNavItems = isOwner ? navItems : storeNavItems
  const [logoutError, setLogoutError] = useState('')
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [navigationCounts, setNavigationCounts] = useState<NavigationCounts>({ orderCount: 0, notificationCount: 0, cakeRequestCount: 0, reviewCount: 0, eventOrderCount: 0 })
  const [countsError, setCountsError] = useState('')
  const [profilePictureError, setProfilePictureError] = useState('')
  const [isSavingProfilePicture, setIsSavingProfilePicture] = useState(false)
  const [profilePictureSaved, setProfilePictureSaved] = useState(false)
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const [isBranchMenuOpen, setIsBranchMenuOpen] = useState(false)
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false)
  const [branchMenuBox, setBranchMenuBox] = useState<{ top: number; left: number; width: number } | null>(null)
  const [selectedBranch, setSelectedBranch] = useState(() => {
    try {
      const savedBranch = sessionStorage.getItem(ADMIN_STORE_TOWN_KEY)
      if (savedBranch === 'all') return 'ALL'
      return savedBranch === 'Yaoundé' ? 'Yaoundé' : 'Douala'
    } catch {
      return 'Douala'
    }
  })
  const [securityDialogTab, setSecurityDialogTab] = useState<AccountSecurityTab | null>(null)
  const accountMenuRef = useRef<HTMLDivElement>(null)
  const branchMenuRef = useRef<HTMLDivElement>(null)
  const languageMenuRef = useRef<HTMLDivElement>(null)
  const currentNavItem = navItems.find((item) => item.to === location.pathname)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
    } catch {
      return false
    }
  })
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const [navQuery, setNavQuery] = useState('')
  const [showWelcome, setShowWelcome] = useState(false)
  const [depositNotices, setDepositNotices] = useState<DepositNotice[]>([])

  useEffect(() => {
    if (!currentAdmin) return undefined
    let shouldWelcome = false
    try {
      shouldWelcome = sessionStorage.getItem(ADMIN_WELCOME_KEY) === '1'
      sessionStorage.removeItem(ADMIN_WELCOME_KEY)
    } catch {
      shouldWelcome = false
    }
    if (shouldWelcome) setShowWelcome(true)
    return undefined
  }, [currentAdmin])

  useEffect(() => {
    if (!showWelcome) return undefined
    const timer = window.setTimeout(() => setShowWelcome(false), 7000)
    return () => window.clearTimeout(timer)
  }, [showWelcome])

  useEffect(() => {
    setIsAccountMenuOpen(false)
    setIsBranchMenuOpen(false)
    setIsLanguageMenuOpen(false)
    setIsMobileNavOpen(false)
    setNavQuery('')
  }, [location.pathname])

  function toggleSidebar() {
    setIsSidebarCollapsed((collapsed) => {
      const next = !collapsed
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0')
      } catch {
        // Storage can be unavailable in private browsing; the toggle still works for this visit.
      }
      return next
    })
  }

  useEffect(() => {
    if (!isAccountMenuOpen) return undefined
    function handlePointerDown(event: PointerEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) setIsAccountMenuOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsAccountMenuOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isAccountMenuOpen])

  function placeBranchMenu() {
    const trigger = branchMenuRef.current?.querySelector('button')
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const width = Math.min(352, window.innerWidth - 24)
    const left = Math.min(Math.max(12, rect.right - width), window.innerWidth - width - 12)
    setBranchMenuBox({ top: rect.bottom + 10, left, width })
  }

  useLayoutEffect(() => {
    if (!isBranchMenuOpen) return undefined
    placeBranchMenu()
    window.addEventListener('resize', placeBranchMenu)
    window.addEventListener('scroll', placeBranchMenu, true)
    return () => {
      window.removeEventListener('resize', placeBranchMenu)
      window.removeEventListener('scroll', placeBranchMenu, true)
    }
  }, [isBranchMenuOpen])

  useEffect(() => {
    if (!isBranchMenuOpen) return undefined
    function handlePointerDown(event: PointerEvent) {
      if (!branchMenuRef.current?.contains(event.target as Node)) setIsBranchMenuOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsBranchMenuOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isBranchMenuOpen])

  useEffect(() => {
    if (!isLanguageMenuOpen) return undefined
    function handlePointerDown(event: PointerEvent) {
      if (!languageMenuRef.current?.contains(event.target as Node)) setIsLanguageMenuOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsLanguageMenuOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isLanguageMenuOpen])

  useEffect(() => {
    const branch = isOwner ? selectedBranch : isBranchAdmin ? currentAdmin?.branchTown : null
    if (branch === 'ALL' && isOwner) {
      try {
        sessionStorage.setItem(ADMIN_STORE_TOWN_KEY, 'all')
      } catch {
        // The all-branches view remains selected for this page view.
      }
    } else if (branch === 'Douala' || branch === 'Yaoundé') {
      try {
        sessionStorage.setItem(ADMIN_STORE_TOWN_KEY, branch)
      } catch {
        // The branch remains selected for this page view.
      }
      if (selectedBranch !== branch) setSelectedBranch(branch)
    } else {
      try {
        sessionStorage.removeItem(ADMIN_STORE_TOWN_KEY)
      } catch {
        // Store-admin access is fixed by the server.
      }
    }
  }, [currentAdmin?.branchTown, isBranchAdmin, isOwner, selectedBranch])

  const refreshNavigationCounts = useCallback(async () => {
    const selectedStoreTown = selectedBranch === 'ALL' ? 'all' : selectedBranch
    const branchQuery = hasTownScope ? `?storeTown=${encodeURIComponent(selectedStoreTown)}` : ''
    const failures = await Promise.all([
      refreshNavigationCount(
        'Orders',
        apiRequest<{ orders: unknown[] }>(`/admin/orders${branchQuery}`, { token: sessionToken }),
        (result) => setNavigationCounts((counts) => ({ ...counts, orderCount: result.orders.length })),
      ),
      refreshNavigationCount(
        'Cake requests',
        apiRequest<{ requests: { status: string }[] }>(`/admin/cake-requests${branchQuery}`, { token: sessionToken }),
        (result) => setNavigationCounts((counts) => ({
          ...counts,
          cakeRequestCount: result.requests.filter((request) => request.status === 'new').length,
        })),
      ),
      refreshNavigationCount(
        'Customer reviews',
        apiRequest<{ pendingCount: number }>(`/admin/reviews${branchQuery ? `${branchQuery}&` : '?'}countOnly=true`, { token: sessionToken }),
        (result) => setNavigationCounts((counts) => ({ ...counts, reviewCount: result.pendingCount })),
      ),
      refreshNavigationCount(
        'Notifications',
        apiRequest<{ unreadCount: number }>(`/admin/notifications${branchQuery}`, { token: sessionToken }),
        (result) => setNavigationCounts((counts) => ({ ...counts, notificationCount: result.unreadCount })),
      ),
      refreshNavigationCount(
        'Event orders',
        apiRequest<{ count: number }>(`/admin/event-orders?countOnly=true${branchQuery ? `&${branchQuery.slice(1)}` : ''}`, { token: sessionToken }),
        (result) => setNavigationCounts((counts) => ({ ...counts, eventOrderCount: result.count })),
      ),
      apiRequest<{ notices: DepositNotice[] }>(`/admin/event-orders/deposit-notices${branchQuery}`, { token: sessionToken })
        .then((result) => setDepositNotices(result?.notices || []))
        .catch(() => {}),
    ])
    setCountsError(failures.filter(Boolean).join(' · '))
  }, [hasTownScope, selectedBranch, sessionToken])

  useEffect(() => {
    refreshNavigationCounts()
    const intervalId = window.setInterval(refreshNavigationCounts, 15000)
    window.addEventListener('focus', refreshNavigationCounts)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refreshNavigationCounts)
    }
  }, [refreshNavigationCounts])

  function hideDepositNotice(id: number) {
    setDepositNotices((current) => current.filter((notice) => notice.id !== id))
    apiRequest(`/admin/event-orders/${id}/deposit-notice`, { method: 'PATCH', token: sessionToken }).catch(() => {})
  }

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

  async function handleProfilePictureChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setProfilePictureError('')
    setProfilePictureSaved(false)
    setIsSavingProfilePicture(true)
    try {
      const profilePicture = await resizeProfilePicture(file)
      await updateProfilePicture(profilePicture)
      setProfilePictureSaved(true)
    } catch (error) {
      console.error('Unable to update admin profile picture.', error)
      setProfilePictureError(t(error instanceof Error ? error.message : 'Could not load this profile picture.'))
    } finally {
      setIsSavingProfilePicture(false)
    }
  }

  if (!isOwner && !storeNavItems.some((item) => item.to === location.pathname)) {
    return <Navigate replace to="/admin/overview" />
  }

  const branchChoices = [
    { id: 'ALL' as const, mark: 'ALL', title: t('All cities'), detail: t('Douala and Yaoundé') },
    { id: 'Douala' as const, mark: 'DLA', title: 'Douala', detail: t('Bonanjo, Bonamoussadi, Bonabéri, Ange Raphaël') },
    { id: 'Yaoundé' as const, mark: 'YDE', title: 'Yaoundé', detail: t('Bastos') },
  ].filter((choice) => isOwner || choice.id === selectedBranch)
  const currentBranch = branchChoices.find((choice) => choice.id === selectedBranch) || branchChoices[0]
  const languageChoices = [
    { id: 'en' as const, mark: 'EN', title: 'English', detail: t('English for the admin workspace') },
    { id: 'fr' as const, mark: 'FR', title: 'Français', detail: t('French for the admin workspace') },
  ]
  const currentLanguage = languageChoices.find((choice) => choice.id === language) || languageChoices[0]

  return (
    <div className="min-h-screen bg-[#f3f6fa] text-[#102c50]">
      <header className="sticky top-0 z-40 border-b border-[#e6ebf1] bg-white/90 backdrop-blur-xl supports-[backdrop-filter]:bg-white/80">
        <div aria-hidden="true" className="h-[3px] bg-gradient-to-r from-[#092a53] via-[#1d4f80] to-[#ffdc32]" />
        <div className="mx-auto flex h-[68px] max-w-[1600px] items-center gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8">
          <Link aria-label={t('Admin portal')} className="group flex min-w-0 shrink-0 items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#bd9c00]" to={isOwner ? '/admin' : '/admin/overview'}>
            <img decoding="async" loading="eager" alt="" aria-hidden="true" className="size-10 shrink-0 rounded-full shadow-[0_6px_14px_rgba(9,42,83,0.22)] transition group-hover:rotate-[-6deg]" height={40} src="/logo.png" width={40} />
            <span className="hidden min-w-0 sm:block">
              <span className="block truncate font-display text-[15px] font-extrabold leading-tight text-[#092a53]">
                Cold Stone <span className="text-[#bd9c00]">Creamery</span>
              </span>
              <span className="mt-0.5 block max-w-52 truncate text-[10px] font-bold uppercase tracking-[0.14em] text-[#8190a1]">
                {isOwner
                  ? t('Administration workspace')
                  : isBranchAdmin
                    ? t('Branch admin: {branch}', { branch: currentAdmin.branchTown || '' })
                    : t('Store: {store}', { store: storeDisplayName || t('Store admin') })}
              </span>
              {currentAdmin?.role === 'store_admin' && currentAdmin.storeTown && (
                <span className="block max-w-52 truncate text-[9px] font-semibold uppercase text-[#91a0b1]">{t('Branch: {branch}', { branch: currentAdmin.storeTown })}</span>
              )}
            </span>
          </Link>

          {currentNavItem && (
            <>
              <span aria-hidden="true" className="hidden h-7 w-px bg-[#e6ebf1] md:block" />
              <nav aria-label={t('Breadcrumb')} className="hidden min-w-0 items-center gap-2 text-sm md:flex">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#f1f5f9] text-[#355777]">
                  <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
                    <path d={navIconPaths[currentNavItem.icon]} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                  </svg>
                </span>
                <span className="text-xs font-semibold text-[#8190a1]">{t(currentNavItem.group)}</span>
                <svg aria-hidden="true" className="size-3.5 text-[#c3ccd7]" fill="none" viewBox="0 0 24 24">
                  <path d="m9 6 6 6-6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
                <span aria-current="page" className="truncate text-sm font-extrabold text-[#092a53]">{t(currentNavItem.label)}</span>
              </nav>
            </>
          )}

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2.5">
            {hasTownScope && currentBranch && (
              <div className="relative" ref={branchMenuRef}>
                <button
                  aria-controls="admin-branch-menu"
                  aria-expanded={isBranchMenuOpen}
                  aria-haspopup="menu"
                  className={`inline-flex min-h-11 items-center gap-2.5 rounded-2xl border px-2 py-1 pr-2.5 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] sm:pr-3 ${
                    isBranchMenuOpen
                      ? 'border-[#092a53] bg-[#092a53] text-white shadow-[0_8px_20px_rgba(9,42,83,0.18)]'
                      : 'border-[#e3e9f0] bg-white text-[#173654] hover:border-[#c5d2e0]'
                  }`}
                  onClick={() => {
                    setIsLanguageMenuOpen(false)
                    if (!isBranchMenuOpen) placeBranchMenu()
                    setIsBranchMenuOpen((open) => !open)
                  }}
                  type="button"
                >
                  <span className={`grid size-8 shrink-0 place-items-center rounded-xl font-display text-[11px] font-extrabold tracking-wide ${isBranchMenuOpen ? 'bg-[#ffdc32] text-[#092a53]' : 'bg-[#092a53] text-[#ffdc32]'}`}>
                    {currentBranch.mark}
                  </span>
                  <span className="min-w-0 text-left">
                    <span className={`block text-[10px] font-semibold ${isBranchMenuOpen ? 'text-white/60' : 'text-[#8190a1]'}`}>{t('City')}</span>
                    <span className="block max-w-20 truncate text-xs font-extrabold sm:max-w-36">{currentBranch.title}</span>
                  </span>
                  <svg aria-hidden="true" className={`size-3.5 shrink-0 transition ${isBranchMenuOpen ? 'rotate-180 text-white/70' : 'text-[#8190a1]'}`} fill="none" viewBox="0 0 24 24">
                    <path d="m6 9 6 6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </button>
                {isBranchMenuOpen && (
                  <div
                    className="admin-modal-panel fixed z-50 overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(9,42,83,0.22)] ring-1 ring-[#d7e0ea]"
                    style={branchMenuBox ?? undefined}
                    id="admin-branch-menu"
                    role="menu"
                  >
                    <div className="bg-[#092a53] px-4 py-3.5 text-white">
                      <p className="text-[11px] font-semibold text-white/60">{t('Current city')}</p>
                      <p className="mt-0.5 font-display text-lg font-extrabold leading-tight">{currentBranch.title}</p>
                      <p className="mt-1 text-xs leading-5 text-white/65">{t('Orders, customers and reports follow this city.')}</p>
                    </div>
                    <div className="p-1.5">
                      {branchChoices.map((choice) => {
                        const isSelected = selectedBranch === choice.id
                        return (
                          <button
                            aria-checked={isSelected}
                            className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#bd9c00] ${
                              isSelected ? 'bg-[#f4f7fb]' : 'hover:bg-[#f7f9fc]'
                            } disabled:cursor-default`}
                            disabled={!isOwner || isSelected}
                            key={choice.id}
                            onClick={() => {
                              if (!isOwner) return
                              try {
                                sessionStorage.setItem(ADMIN_STORE_TOWN_KEY, choice.id === 'ALL' ? 'all' : choice.id)
                              } catch {
                                // The city remains selected for this page view.
                              }
                              setSelectedBranch(choice.id)
                              setIsBranchMenuOpen(false)
                            }}
                            role="menuitemradio"
                            type="button"
                          >
                            <span className={`grid size-10 shrink-0 place-items-center rounded-xl font-display text-xs font-extrabold ${isSelected ? 'bg-[#092a53] text-[#ffdc32]' : 'bg-[#eef2f6] text-[#355777]'}`}>
                              {choice.mark}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-extrabold text-[#092a53]">{choice.title}</span>
                              <span className="mt-0.5 block text-xs leading-4 text-[#65748a]">{choice.detail}</span>
                            </span>
                            <span className={`grid size-5 shrink-0 place-items-center rounded-full ${isSelected ? 'bg-[#2e9d5b] text-white' : 'ring-1 ring-[#d5dee8]'}`}>
                              {isSelected && (
                                <svg aria-hidden="true" className="size-3" fill="none" viewBox="0 0 24 24">
                                  <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" />
                                </svg>
                              )}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="relative" ref={languageMenuRef}>
              <button
                aria-controls="admin-language-menu"
                aria-expanded={isLanguageMenuOpen}
                aria-haspopup="menu"
                aria-label={`${t('Language')}: ${currentLanguage.title}`}
                className={`inline-flex min-h-11 items-center gap-2.5 rounded-2xl border px-2 py-1 pr-2.5 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] sm:pr-3 ${
                  isLanguageMenuOpen
                    ? 'border-[#092a53] bg-[#092a53] text-white shadow-[0_8px_20px_rgba(9,42,83,0.18)]'
                    : 'border-[#e3e9f0] bg-white text-[#173654] hover:border-[#c5d2e0]'
                }`}
                onClick={() => {
                  setIsBranchMenuOpen(false)
                  setIsLanguageMenuOpen((open) => !open)
                }}
                type="button"
              >
                <span className={`grid size-8 shrink-0 place-items-center rounded-xl font-display text-[11px] font-extrabold tracking-wide ${isLanguageMenuOpen ? 'bg-[#ffdc32] text-[#092a53]' : 'bg-[#092a53] text-[#ffdc32]'}`}>
                  {currentLanguage.mark}
                </span>
                <span className="min-w-0 text-left">
                  <span className={`block text-[10px] font-semibold ${isLanguageMenuOpen ? 'text-white/60' : 'text-[#8190a1]'}`}>{t('Language')}</span>
                  <span className="block max-w-[4.5rem] truncate text-xs font-extrabold sm:max-w-none">{currentLanguage.title}</span>
                </span>
                <svg aria-hidden="true" className={`size-3.5 shrink-0 transition ${isLanguageMenuOpen ? 'rotate-180 text-white/70' : 'text-[#8190a1]'}`} fill="none" viewBox="0 0 24 24">
                  <path d="m6 9 6 6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </button>
              {isLanguageMenuOpen && (
                <div
                  className="admin-modal-panel absolute right-0 top-[calc(100%+10px)] z-50 w-[min(18.5rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(9,42,83,0.22)] ring-1 ring-[#d7e0ea]"
                  id="admin-language-menu"
                  role="menu"
                >
                  <div className="bg-[#092a53] px-4 py-3.5 text-white">
                    <p className="text-[11px] font-semibold text-white/60">{t('Select language')}</p>
                    <p className="mt-0.5 font-display text-lg font-extrabold leading-tight">{currentLanguage.title}</p>
                    <p className="mt-1 text-xs leading-5 text-white/65">{t('Menus, labels and reports switch with this choice.')}</p>
                  </div>
                  <div className="p-1.5">
                    {languageChoices.map((choice) => {
                      const isSelected = language === choice.id
                      return (
                        <button
                          aria-checked={isSelected}
                          className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#bd9c00] ${
                            isSelected ? 'bg-[#f4f7fb]' : 'hover:bg-[#f7f9fc]'
                          }`}
                          key={choice.id}
                          lang={choice.id}
                          onClick={() => {
                            setLanguage(choice.id)
                            setIsLanguageMenuOpen(false)
                          }}
                          role="menuitemradio"
                          type="button"
                        >
                          <span className={`grid size-10 shrink-0 place-items-center rounded-xl font-display text-xs font-extrabold ${isSelected ? 'bg-[#092a53] text-[#ffdc32]' : 'bg-[#eef2f6] text-[#355777]'}`}>
                            {choice.mark}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-extrabold text-[#092a53]">{choice.title}</span>
                            <span className="mt-0.5 block text-xs leading-4 text-[#65748a]">{choice.detail}</span>
                          </span>
                          <span className={`grid size-5 shrink-0 place-items-center rounded-full ${isSelected ? 'bg-[#2e9d5b] text-white' : 'ring-1 ring-[#d5dee8]'}`}>
                            {isSelected && (
                              <svg aria-hidden="true" className="size-3" fill="none" viewBox="0 0 24 24">
                                <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" />
                              </svg>
                            )}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <Link
              aria-label={t('View storefront')}
              className="hidden size-10 place-items-center rounded-full text-[#4f6379] transition hover:bg-[#f1f5f9] hover:text-[#092a53] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] sm:grid"
              title={t('View storefront')}
              to="/flavors"
            >
              <svg aria-hidden="true" className="size-[18px]" fill="none" viewBox="0 0 24 24">
                <path d="M4 10h16l-1.5-5h-13L4 10Zm0 0v10h16V10M9 20v-5h6v5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
              </svg>
            </Link>

            <Link
              aria-label={`${t('Notifications')}${navigationCounts.notificationCount ? ` (${navigationCounts.notificationCount})` : ''}`}
              className={`relative grid size-10 place-items-center rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] ${
                location.pathname === '/admin/notifications' ? 'bg-[#092a53] text-white' : 'text-[#4f6379] hover:bg-[#f1f5f9] hover:text-[#092a53]'
              }`}
              title={t('Notifications')}
              to="/admin/notifications"
            >
              <svg aria-hidden="true" className="size-[18px]" fill="none" viewBox="0 0 24 24">
                <path d={navIconPaths.notifications} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
              </svg>
              {navigationCounts.notificationCount > 0 && (
                <span className="absolute right-1 top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#e5484d] px-1 text-[10px] font-extrabold leading-none text-white ring-2 ring-white">
                  {navigationCounts.notificationCount > 99 ? '99+' : navigationCounts.notificationCount}
                </span>
              )}
            </Link>

            <span aria-hidden="true" className="mx-0.5 hidden h-7 w-px bg-[#e6ebf1] sm:block" />

            <div className="relative" ref={accountMenuRef}>
              <button
                aria-controls="admin-account-menu"
                aria-expanded={isAccountMenuOpen}
                aria-haspopup="menu"
                className={`flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] sm:pr-3 ${
                  isAccountMenuOpen ? 'bg-[#f1f5f9]' : 'hover:bg-[#f6f8fb]'
                }`}
                onClick={() => {
                  setIsBranchMenuOpen(false)
                  setIsLanguageMenuOpen(false)
                  setIsAccountMenuOpen((open) => !open)
                }}
                type="button"
              >
                <span className="relative">
                  {currentAdmin?.profilePicture ? (
                    <img decoding="async" loading="lazy" alt="" className="size-9 rounded-full object-cover ring-2 ring-white shadow-sm" src={currentAdmin.profilePicture} />
                  ) : (
                    <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-[#ffdc32] text-sm font-extrabold text-[#092a53] ring-2 ring-white">{currentAdmin?.name?.charAt(0).toUpperCase()}</span>
                  )}
                  <span aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-[#35a36b] ring-2 ring-white" />
                </span>
                <span className="hidden min-w-0 text-left lg:block">
                  <span className="block max-w-36 truncate text-xs font-extrabold text-[#173654]">{currentAdmin?.name}</span>
                  <span className="mt-0.5 block max-w-36 truncate text-[10px] font-semibold text-[#8190a1]">{isOwner ? t('Owner · all stores') : t(storeDisplayName || currentAdmin?.branchTown || 'Store admin')}</span>
                  {currentAdmin?.role === 'store_admin' && currentAdmin.storeTown && (
                    <span className="block max-w-36 truncate text-[9px] font-medium uppercase text-[#91a0b1]">{t('Branch: {branch}', { branch: currentAdmin.storeTown })}</span>
                  )}
                </span>
                <svg aria-hidden="true" className={`hidden size-4 text-[#8190a1] transition sm:block ${isAccountMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24">
                  <path d="m6 9 6 6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </button>

              {isAccountMenuOpen && (
                <div
                  className="admin-modal-panel absolute right-0 top-[calc(100%+10px)] w-72 overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(9,42,83,0.18)] ring-1 ring-[#e3e9f0]"
                  id="admin-account-menu"
                  role="menu"
                >
                  <div className="flex items-center gap-3 bg-gradient-to-br from-[#0d3566] to-[#092a53] p-4 text-white">
                    {currentAdmin?.profilePicture ? (
                      <img decoding="async" loading="lazy" alt="" className="size-11 rounded-xl object-cover ring-2 ring-white/25" src={currentAdmin.profilePicture} />
                    ) : (
                      <span aria-hidden="true" className="grid size-11 place-items-center rounded-xl bg-[#ffdc32] font-display text-lg font-extrabold text-[#092a53]">{currentAdmin?.name?.charAt(0).toUpperCase()}</span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold">{currentAdmin?.name}</p>
                      <p className="truncate text-[11px] text-white/65">{currentAdmin?.email}</p>
                      <span className="mt-1.5 inline-flex rounded-full bg-[#ffdc32] px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#092a53]">
                        {isOwner ? t('Owner') : t(isBranchAdmin ? 'Branch admin' : 'Store admin')}
                      </span>
                      {!isOwner && currentAdmin?.storeName && (
                        <p className="mt-1 truncate text-[10px] font-semibold text-white/75">{t(storeDisplayName || currentAdmin.storeName)}</p>
                      )}
                      {currentAdmin?.role === 'store_admin' && currentAdmin.storeTown && (
                        <p className="truncate text-[9px] font-medium uppercase text-white/55">{t('Branch: {branch}', { branch: currentAdmin.storeTown })}</p>
                      )}
                    </div>
                  </div>
                  <div className="p-1.5">
                    <button
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-[#355777] transition hover:bg-[#f4f7fa] hover:text-[#092a53] disabled:opacity-60"
                      disabled={isSavingProfilePicture}
                      onClick={() => { setIsAccountMenuOpen(false); profilePictureInput.current?.click() }}
                      role="menuitem"
                      type="button"
                    >
                      <svg aria-hidden="true" className="size-[18px] text-[#8190a1]" fill="none" viewBox="0 0 24 24">
                        <path d="M4 8h3l2-3h6l2 3h3v11H4V8Zm8 9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                      </svg>
                      {t(isSavingProfilePicture ? 'Saving…' : currentAdmin?.profilePicture ? 'Change profile picture' : 'Add profile picture')}
                    </button>
                    <Link
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-[#355777] transition hover:bg-[#f4f7fa] hover:text-[#092a53]"
                      onClick={() => setIsAccountMenuOpen(false)}
                      role="menuitem"
                      to="/flavors"
                    >
                      <svg aria-hidden="true" className="size-[18px] text-[#8190a1]" fill="none" viewBox="0 0 24 24">
                        <path d="M14 4h6v6m0-6L10 14M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                      </svg>
                      {t('View storefront')}
                    </Link>
                    {isOwner && (
                      <>
                        <button
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-[#355777] transition hover:bg-[#f4f7fa] hover:text-[#092a53]"
                          onClick={() => { setIsAccountMenuOpen(false); setSecurityDialogTab('password') }}
                          role="menuitem"
                          type="button"
                        >
                          <svg aria-hidden="true" className="size-[18px] text-[#8190a1]" fill="none" viewBox="0 0 24 24">
                            <path d="M6 11h12v9H6v-9Zm2 0V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                          </svg>
                          {t('Change password')}
                        </button>
                        <button
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-[#355777] transition hover:bg-[#f4f7fa] hover:text-[#092a53]"
                          onClick={() => { setIsAccountMenuOpen(false); setSecurityDialogTab('email') }}
                          role="menuitem"
                          type="button"
                        >
                          <svg aria-hidden="true" className="size-[18px] text-[#8190a1]" fill="none" viewBox="0 0 24 24">
                            <path d="M4 6h16v12H4V6Zm0 0 8 7 8-7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                          </svg>
                          {t('Change email')}
                        </button>
                      </>
                    )}
                    {isOwner && (
                      <Link
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-[#355777] transition hover:bg-[#f4f7fa] hover:text-[#092a53]"
                        onClick={() => setIsAccountMenuOpen(false)}
                        role="menuitem"
                        to="/admin/admins"
                      >
                        <svg aria-hidden="true" className="size-[18px] text-[#8190a1]" fill="none" viewBox="0 0 24 24">
                          <path d={navIconPaths.admins} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                        </svg>
                        {t('Admin accounts')}
                      </Link>
                    )}
                  </div>
                  <div className="border-t border-[#eef2f6] p-1.5">
                    <button
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-[#b2433a] transition hover:bg-red-50 disabled:opacity-60"
                      disabled={isLoggingOut}
                      onClick={() => { setIsAccountMenuOpen(false); handleLogout() }}
                      role="menuitem"
                      type="button"
                    >
                      <svg aria-hidden="true" className="size-[18px]" fill="none" viewBox="0 0 24 24">
                        <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l4-4-4-4M14 12H4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                      </svg>
                      {t(isLoggingOut ? 'Signing out…' : 'Log out')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      <AdminIdleGuard />
      {isOwner && securityDialogTab && (
        <AdminAccountSecurityDialog initialTab={securityDialogTab} onClose={() => setSecurityDialogTab(null)} />
      )}
      {showWelcome && currentAdmin && (
        <div
          aria-live="polite"
          className="admin-welcome-toast fixed right-4 top-[84px] z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-[#092a53] text-white shadow-[0_24px_60px_rgba(9,42,83,0.35)] ring-1 ring-white/10"
          role="status"
        >
          <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 size-36 rounded-full bg-[#ffdc32]/15 blur-2xl" />
          <div className="relative flex items-start gap-3.5 p-4 pr-3">
            {currentAdmin.profilePicture ? (
              <img decoding="async" loading="lazy" alt="" className="size-12 shrink-0 rounded-xl object-cover ring-2 ring-[#ffdc32]/60" src={currentAdmin.profilePicture} />
            ) : (
              <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#ffdc32] font-display text-xl font-extrabold text-[#092a53]">
                {currentAdmin.name?.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#ffdc32]">{t('Signed in successfully')}</p>
              <p className="mt-1 font-display text-lg font-extrabold leading-snug">
                {t('Welcome back, {name}!', { name: currentAdmin.name })} <span aria-hidden="true">👋</span>
              </p>
              <p className="mt-1 text-xs leading-5 text-white/70">
                {isOwner
                  ? t('You are signed in as the owner, with access to every store.')
                  : t('You are signed in to {store}. You can manage this store’s orders and customers.', { store: t(storeDisplayName || currentAdmin.storeName || 'your store') })}
              </p>
            </div>
            <button
              aria-label={t('Dismiss')}
              className="grid size-8 shrink-0 place-items-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white"
              onClick={() => setShowWelcome(false)}
              type="button"
            >
              <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
                <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
              </svg>
            </button>
          </div>
          <div aria-hidden="true" className="h-1 bg-white/10">
            <div className="admin-welcome-progress h-full bg-[#ffdc32]" />
          </div>
        </div>
      )}
      {depositNotices.length > 0 && (
        <div className={`fixed right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 ${showWelcome ? 'top-[248px]' : 'top-[84px]'}`}>
          {depositNotices.map((notice) => (
            <div className="flex gap-3 rounded-2xl bg-[#202124] p-3.5 text-white shadow-[0_24px_50px_rgba(0,0,0,0.35)]" key={notice.id} role="status">
              <img alt="" className="size-10 shrink-0 rounded-full" height={40} src="/icons/icon-192.png" width={40} />
              <Link
                className="min-w-0 flex-1 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffdc32]"
                onClick={() => hideDepositNotice(notice.id)}
                to={`/admin/events?event=${notice.id}`}
              >
                <p className="flex items-center gap-1.5 text-[11px] text-white/55">
                  <span className="truncate">{window.location.host}</span>
                  <span aria-hidden="true">·</span>
                  <span>{t('now')}</span>
                </p>
                <p className="mt-0.5 truncate text-sm font-semibold">{t('Deposit paid')}</p>
                <p className="mt-0.5 line-clamp-3 break-words text-[13px] leading-5 text-white/80">
                  {notice.storeName
                    ? t('{name} paid the {amount} deposit for event #{id} at {store}.', {
                      name: notice.customerName,
                      amount: formatDepositAmount(notice.depositAmount, language),
                      id: notice.id,
                      store: t(notice.storeName),
                    })
                    : t('{name} paid the {amount} deposit for event #{id}.', {
                      name: notice.customerName,
                      amount: formatDepositAmount(notice.depositAmount, language),
                      id: notice.id,
                    })}
                </p>
              </Link>
              <button
                aria-label={t('Dismiss')}
                className="grid size-7 shrink-0 place-items-center rounded-full text-white/55 transition hover:bg-white/10 hover:text-white"
                onClick={() => hideDepositNotice(notice.id)}
                type="button"
              >
                <svg aria-hidden="true" className="size-3.5" fill="none" viewBox="0 0 24 24">
                  <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
      <div className={`mx-auto grid max-w-[1600px] gap-5 px-3 py-5 sm:px-6 sm:py-7 lg:gap-7 lg:px-8 ${isSidebarCollapsed ? 'lg:grid-cols-[84px_minmax(0,1fr)]' : 'lg:grid-cols-[272px_minmax(0,1fr)]'}`}>
        <aside
          aria-label={t('Admin dashboard')}
          className="relative h-fit overflow-hidden rounded-[22px] bg-[#0b2e57] text-white shadow-[0_18px_40px_rgba(9,42,83,0.22)] ring-1 ring-[#1b4572] lg:sticky lg:top-[92px] lg:flex lg:max-h-[calc(100vh-112px)] lg:flex-col"
        >
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 size-48 rounded-full bg-[#ffdc32]/[0.07] blur-2xl" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

          <input
            accept="image/*"
            className="sr-only"
            disabled={isSavingProfilePicture}
            onChange={handleProfilePictureChange}
            ref={profilePictureInput}
            tabIndex={-1}
            type="file"
          />

          {/* Workspace card */}
          <div className={`relative flex items-center gap-3 border-b border-white/[0.08] ${isSidebarCollapsed ? 'lg:flex-col lg:px-2 lg:py-4' : ''} px-4 py-4`}>
            <button
              aria-label={t(currentAdmin?.profilePicture ? 'Change profile picture' : 'Add profile picture')}
              className="group/avatar relative shrink-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffdc32]"
              disabled={isSavingProfilePicture}
              onClick={() => profilePictureInput.current?.click()}
              title={t(currentAdmin?.profilePicture ? 'Change profile picture' : 'Add profile picture')}
              type="button"
            >
              {currentAdmin?.profilePicture ? (
                <img decoding="async" loading="lazy" alt="" className="size-11 rounded-xl object-cover ring-2 ring-white/15" src={currentAdmin.profilePicture} />
              ) : (
                <span className="grid size-11 place-items-center rounded-xl bg-[#ffdc32] font-display text-lg font-extrabold text-[#092a53]">{currentAdmin?.name?.charAt(0).toUpperCase()}</span>
              )}
              <span className="absolute inset-0 grid place-items-center rounded-xl bg-[#092a53]/70 opacity-0 transition group-hover/avatar:opacity-100">
                {isSavingProfilePicture ? (
                  <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
                ) : (
                  <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
                    <path d="M4 8h3l2-3h6l2 3h3v11H4V8Zm8 9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                  </svg>
                )}
              </span>
              <span aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-[#35d07f] ring-2 ring-[#0b2e57]" />
            </button>
            <div className={`min-w-0 flex-1 ${isSidebarCollapsed ? 'lg:hidden' : ''}`}>
              <p className="truncate text-sm font-bold">{currentAdmin?.name}</p>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-white/60">
                <span className={`inline-flex rounded px-1 py-px text-[9px] font-extrabold uppercase tracking-wide ${isOwner ? 'bg-[#ffdc32] text-[#092a53]' : 'bg-white/15 text-white'}`}>
                  {isOwner ? t('Owner') : t(isBranchAdmin ? 'Branch admin' : 'Store admin')}
                </span>
                {!isOwner && <span className="truncate">{t(storeDisplayName || currentAdmin?.branchTown || 'Store admin')}</span>}
              </p>
              {currentAdmin?.role === 'store_admin' && currentAdmin.storeTown && (
                <p className="truncate pl-1 text-[10px] uppercase text-white/45">{t('Branch: {branch}', { branch: currentAdmin.storeTown })}</p>
              )}
            </div>
            <button
              aria-expanded={!isSidebarCollapsed}
              aria-label={t(isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar')}
              className="hidden size-8 shrink-0 place-items-center rounded-lg text-white/55 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-[#ffdc32] lg:grid"
              onClick={toggleSidebar}
              title={t(isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar')}
              type="button"
            >
              <svg aria-hidden="true" className={`size-4 transition ${isSidebarCollapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24">
                <path d="M4 5h16v14H4V5Zm5 0v14m6-9-2 2 2 2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
              </svg>
            </button>
            <button
              aria-controls="admin-sidebar-nav"
              aria-expanded={isMobileNavOpen}
              className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg bg-white/10 px-3 text-xs font-bold text-white transition hover:bg-white/15 lg:hidden"
              onClick={() => setIsMobileNavOpen((open) => !open)}
              type="button"
            >
              {currentNavItem && (
                <svg aria-hidden="true" className="size-4 text-[#ffdc32]" fill="none" viewBox="0 0 24 24">
                  <path d={navIconPaths[currentNavItem.icon]} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                </svg>
              )}
              <span className="max-w-32 truncate">{currentNavItem ? t(currentNavItem.label) : t('Menu')}</span>
              <svg aria-hidden="true" className={`size-4 transition ${isMobileNavOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24">
                <path d="m6 9 6 6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </button>
          </div>
          {(profilePictureError || profilePictureSaved) && (
            <p className={`mx-3 mt-3 rounded-lg px-3 py-2 text-[11px] font-semibold ${profilePictureError ? 'bg-red-500/15 text-red-100' : 'bg-[#35d07f]/15 text-[#b9f3c8]'} ${isSidebarCollapsed ? 'lg:hidden' : ''}`} role={profilePictureError ? 'alert' : 'status'}>
              {profilePictureError || t('Profile picture saved.')}
            </p>
          )}

          <div className={`${isMobileNavOpen ? 'flex' : 'hidden'} min-h-0 flex-1 flex-col lg:flex`} id="admin-sidebar-nav">
            {/* Quick jump */}
            {!isSidebarCollapsed && visibleNavItems.length > 5 && (
              <label className="relative mx-3 mt-3 block">
                <span className="sr-only">{t('Jump to a page')}</span>
                <svg aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40" fill="none" viewBox="0 0 24 24">
                  <path d="m20 20-4.2-4.2M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
                </svg>
                <input
                  className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.06] pl-9 pr-3 text-xs font-medium text-white transition placeholder:text-white/40 hover:bg-white/[0.09] focus:border-[#ffdc32]/60 focus:bg-white/10 outline-none!"
                  onChange={(event) => setNavQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return
                    const query = navQuery.trim().toLowerCase()
                    const match = visibleNavItems.find((item) => t(item.label).toLowerCase().includes(query))
                    if (query && match) navigate(match.to)
                  }}
                  placeholder={t('Jump to…')}
                  type="search"
                  value={navQuery}
                />
              </label>
            )}

            <nav aria-label={t('Admin dashboard')} ref={sidebarNavRef} className={`min-w-0 overflow-y-auto px-3 pb-3 pt-1 lg:min-h-0 lg:flex-1 lg:pb-8 lg:[mask-image:linear-gradient(to_bottom,black_calc(100%-2rem),transparent)] [scrollbar-color:rgba(255,255,255,0.15)_transparent] [scrollbar-width:thin] ${isSidebarCollapsed ? 'lg:px-2' : ''}`}>
              {navGroups.filter((group) => visibleNavItems.some((item) => item.group === group)).map((group) => {
                const query = navQuery.trim().toLowerCase()
                const groupItems = visibleNavItems.filter((item) => item.group === group && (!query || t(item.label).toLowerCase().includes(query)))
                if (!groupItems.length) return null
                return (
                  <section key={group}>
                    <h2 className={`flex items-center gap-2 px-3 pb-1.5 pt-4 text-[10px] lg:pb-1 lg:pt-3 font-extrabold uppercase tracking-[0.16em] text-white/40 ${isSidebarCollapsed ? 'lg:justify-center lg:px-0' : ''}`}>
                      <span className={isSidebarCollapsed ? 'lg:hidden' : ''}>{t(group)}</span>
                      <span aria-hidden="true" className={`h-px flex-1 bg-white/[0.08] ${isSidebarCollapsed ? 'lg:max-w-6' : ''}`} />
                    </h2>
                    <ul className="space-y-0.5">
                      {groupItems.map((item) => {
                        const count = item.label === 'Orders'
                          ? navigationCounts.orderCount
                          : item.label === 'Customer reviews'
                            ? navigationCounts.reviewCount
                            : item.label === 'Notifications'
                              ? navigationCounts.notificationCount
                              : item.label === 'Event orders'
                                ? navigationCounts.eventOrderCount
                              : item.label === 'Cake requests'
                                ? navigationCounts.cakeRequestCount
                                : null
                        const countLabel = item.label === 'Orders'
                          ? t('{count} orders not delivered', { count: count || 0 })
                          : item.label === 'Customer reviews'
                            ? t('{count} pending customer reviews', { count: count || 0 })
                            : item.label === 'Notifications'
                              ? t('{count} unread notifications', { count: count || 0 })
                              : item.label === 'Event orders'
                                ? t('{count} event orders that need action', { count: count || 0 })
                              : t('{count} new cake requests', { count: count || 0 })
                        const isActive = location.pathname === item.to
                        return (
                          <li key={item.to}>
                            <NavLink
                              aria-label={isSidebarCollapsed ? `${t(item.label)}${count ? ` (${count})` : ''}` : undefined}
                              className={`group relative flex min-h-10 min-w-0 items-center gap-3 rounded-xl px-2.5 py-1.5 text-[13px] lg:min-h-9 lg:py-1 font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#ffdc32] ${
                                isActive
                                  ? 'bg-white text-[#092a53] shadow-[0_6px_16px_rgba(0,0,0,0.18)]'
                                  : 'text-white/70 hover:bg-white/[0.08] hover:text-white'
                              } ${isSidebarCollapsed ? 'lg:justify-center lg:px-0' : ''}`}
                              end={item.end}
                              title={isSidebarCollapsed ? t(item.label) : undefined}
                              to={item.to}
                            >
                              {isActive && <span aria-hidden="true" className="absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[#ffdc32]" />}
                              <span className={`relative grid size-8 shrink-0 place-items-center rounded-lg transition lg:size-7 ${
                                isActive ? 'bg-[#ffdc32] text-[#092a53]' : 'bg-white/[0.06] text-white/60 group-hover:bg-white/[0.12] group-hover:text-white'
                              }`}>
                                <svg aria-hidden="true" className="size-[17px]" fill="none" viewBox="0 0 24 24">
                                  <path d={navIconPaths[item.icon]} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
                                </svg>
                                {isSidebarCollapsed && count !== null && (
                                  item.label === 'Event orders'
                                    ? (
                                      <span
                                        aria-hidden="true"
                                        className="absolute -right-2 -top-1 hidden min-w-4 rounded-full bg-[#ffdc32] px-1 text-center text-[9px] font-extrabold leading-4 text-[#092a53] ring-2 ring-[#0b2e57] lg:block"
                                      >
                                        {count > 99 ? '99+' : count}
                                      </span>
                                    )
                                    : count > 0 && (
                                      <span aria-hidden="true" className="absolute -right-1 -top-1 hidden size-2.5 rounded-full bg-[#ff6b5e] ring-2 ring-[#0b2e57] lg:block" />
                                    )
                                )}
                              </span>
                              <span className={`min-w-0 flex-1 truncate ${isSidebarCollapsed ? 'lg:hidden' : ''}`}>{t(item.label)}</span>
                              {count !== null && (
                                <span
                                  aria-label={countLabel}
                                  className={`inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-extrabold tabular-nums ${
                                    count > 0
                                      ? isActive ? 'bg-[#092a53] text-white' : 'bg-[#ffdc32] text-[#092a53]'
                                      : isActive ? 'bg-[#eef2f6] text-[#8190a1]' : 'bg-white/10 text-white/50'
                                  } ${isSidebarCollapsed ? 'lg:hidden' : ''}`}
                                >
                                  {count > 99 ? '99+' : count}
                                </span>
                              )}
                            </NavLink>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )
              })}
              {navQuery.trim() && !visibleNavItems.some((item) => t(item.label).toLowerCase().includes(navQuery.trim().toLowerCase())) && (
                <p className="px-3 py-6 text-center text-xs text-white/45">{t('No matching pages')}</p>
              )}
            </nav>

            {countsError && (
              <p className={`mx-3 mb-3 rounded-lg bg-red-500/15 px-3 py-2 text-[11px] text-red-100 ${isSidebarCollapsed ? 'lg:hidden' : ''}`} role="status">
                {t('Unable to refresh navigation counts')}: {countsError}
              </p>
            )}

            <div className={`grid shrink-0 grid-cols-2 gap-1 border-t border-white/[0.08] bg-black/10 p-2 ${isSidebarCollapsed ? 'lg:grid-cols-1 lg:px-2' : ''}`}>
              <Link
                className={`flex min-h-10 min-w-0 items-center gap-2 rounded-xl px-2 text-[12px] font-semibold text-white/65 transition hover:bg-white/[0.08] hover:text-white ${isSidebarCollapsed ? 'lg:justify-center lg:px-0' : ''}`}
                title={isSidebarCollapsed ? t('View storefront') : undefined}
                to="/flavors"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/[0.06]">
                  <svg aria-hidden="true" className="size-[17px]" fill="none" viewBox="0 0 24 24">
                    <path d="M14 4h6v6m0-6L10 14M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
                  </svg>
                </span>
                <span className={`truncate ${isSidebarCollapsed ? 'lg:hidden' : ''}`}>{t('Storefront')}</span>
              </Link>
              <button
                className={`flex min-h-10 w-full min-w-0 items-center gap-2 rounded-xl px-2 text-left text-[12px] font-semibold text-white/65 transition hover:bg-red-500/15 hover:text-red-100 disabled:opacity-60 ${isSidebarCollapsed ? 'lg:justify-center lg:px-0' : ''}`}
                disabled={isLoggingOut}
                onClick={handleLogout}
                title={isSidebarCollapsed ? t('Log out') : undefined}
                type="button"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/[0.06]">
                  <svg aria-hidden="true" className="size-[17px]" fill="none" viewBox="0 0 24 24">
                    <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l4-4-4-4M14 12H4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
                  </svg>
                </span>
                <span className={`truncate ${isSidebarCollapsed ? 'lg:hidden' : ''}`}>{isLoggingOut ? t('Signing out…') : t('Log out')}</span>
              </button>
            </div>
            {logoutError && <p className="mx-3 mb-3 rounded-lg bg-red-500/15 px-3 py-2 text-xs text-red-100" role="alert">{logoutError}</p>}
          </div>
        </aside>

        <main data-scroll-reveal="skip" className="min-h-[60vh] min-w-0 rounded-[22px] border border-[#e2e8f0] bg-white p-4 shadow-[0_8px_28px_rgba(16,44,80,0.04)] sm:p-6 lg:p-8">
          <Suspense fallback={<div aria-busy="true" className="min-h-[50vh]" role="status" />}>
            <Outlet key={selectedBranch} />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
