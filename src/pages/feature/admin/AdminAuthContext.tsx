import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiRequest, ADMIN_TOKEN_KEY } from '../../../api/api'

export interface AdminAccount {
  id: number;
  name: string;
  email: string;
  profilePicture?: string;
}

interface AdminAuthContextValue {
  admins: AdminAccount[];
  currentAdmin: AdminAccount | null;
  isAdmin: boolean;
  isLoading: boolean;
  sessionToken: string;
  login: (email: string, password: string) => Promise<AdminAccount>;
  refreshAdmins: () => Promise<AdminAccount[]>;
  createAdmin: (details: { name: string; email: string; password: string; profilePicture: string }) => Promise<AdminAccount>;
  updateProfilePicture: (profilePicture: string) => Promise<AdminAccount>;
  logout: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null)

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [currentAdmin, setCurrentAdmin] = useState<AdminAccount | null>(null)
  const [admins, setAdmins] = useState<AdminAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sessionToken, setSessionToken] = useState(() => sessionStorage.getItem(ADMIN_TOKEN_KEY) || '')

  useEffect(() => {
    let cancelled = false
    if (!sessionToken) {
      setCurrentAdmin(null)
      setAdmins([])
      setIsLoading(false)
      return undefined
    }

    setIsLoading(true)
    apiRequest('/admin/me', { token: sessionToken })
      .then(({ admin }: { admin: AdminAccount }) => {
        if (!cancelled) setCurrentAdmin(admin)
      })
      .catch(() => {
        if (!cancelled) setCurrentAdmin(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [sessionToken])

  useEffect(() => {
    function clearExpiredSession() {
      setSessionToken('')
      setCurrentAdmin(null)
    }
    window.addEventListener('admin-session-expired', clearExpiredSession)
    return () => window.removeEventListener('admin-session-expired', clearExpiredSession)
  }, [])

  async function login(email: string, password: string) {
    const result = await apiRequest<{ token: string; admin: AdminAccount }>('/admin/login', { method: 'POST', body: { email, password } })
    sessionStorage.setItem(ADMIN_TOKEN_KEY, result.token)
    setCurrentAdmin(result.admin)
    setSessionToken(result.token)
    return result.admin
  }

  const refreshAdmins = useCallback(async () => {
    const result = await apiRequest<{ admins: AdminAccount[] }>('/admin/admins', { token: sessionToken })
    setAdmins(result.admins)
    return result.admins
  }, [sessionToken])

  async function createAdmin({ name, email, password, profilePicture }: { name: string; email: string; password: string; profilePicture: string }) {
    const result = await apiRequest<{ admin: AdminAccount }>('/admin/admins', {
      method: 'POST',
      token: sessionToken,
      body: { name, email, password, profilePicture },
    })
    setAdmins((currentAdmins) => [...currentAdmins, result.admin])
    return result.admin
  }

  async function updateProfilePicture(profilePicture: string) {
    const result = await apiRequest<{ admin: AdminAccount }>('/admin/profile-picture', {
      method: 'PUT',
      token: sessionToken,
      body: { profilePicture },
    })
    setCurrentAdmin(result.admin)
    setAdmins((currentAdmins) => currentAdmins.map((admin) =>
      admin.id === result.admin.id ? result.admin : admin,
    ))
    return result.admin
  }

  async function logout() {
    try {
      if (sessionToken) await apiRequest('/admin/logout', { method: 'POST', token: sessionToken })
    } finally {
      sessionStorage.removeItem(ADMIN_TOKEN_KEY)
      setSessionToken('')
      setCurrentAdmin(null)
      setAdmins([])
    }
  }

  return (
    <AdminAuthContext.Provider value={{
      admins,
      currentAdmin,
      isAdmin: Boolean(currentAdmin),
      isLoading,
      sessionToken,
      login,
      refreshAdmins,
      createAdmin,
      updateProfilePicture,
      logout,
    }}>
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext)
  if (!context) throw new Error('useAdminAuth must be used within AdminAuthProvider')
  return context
}
