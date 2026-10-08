import { Navigate, useLocation } from 'react-router-dom'
import { useAdminAuth } from '../AdminAuthContext'
import { useLanguage } from '../LanguageContext'

export function AdminRoute({ children }) {
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
