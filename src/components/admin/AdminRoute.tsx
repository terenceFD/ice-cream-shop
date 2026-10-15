import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAdminAuth } from '../../pages/admin/useAdminAuth'
import { useLanguage } from '../../language/useLanguage'

export function AdminRoute({ children }: { children: ReactNode }) {
  const { isAdmin, isLoading } = useAdminAuth()
  const { t } = useLanguage()
  const location = useLocation()

  if (isLoading) {
    return <div className="grid min-h-screen place-items-center text-sm font-semibold text-[#65748a]">{t('Checking admin session…')}</div>
  }

  if (!isAdmin) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />
  }

  return children
}
