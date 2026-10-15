import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AdminAuthContext } from './useAdminAuth'
import { apiRequest, ADMIN_TOKEN_KEY, ADMIN_WELCOME_KEY } from '../../../api/api'

export interface AdminAccount {
  id: number;
  name: string;
  email: string;
  profilePicture?: string;
  role: 'owner' | 'store_admin';
  storeId: number | null;
  storeName: string | null;
}

export interface AdminAuthContextValue {
  admins: AdminAccount[];
  currentAdmin: AdminAccount | null;
  isAdmin: boolean;
  isLoading: boolean;
  sessionToken: string;
  login: (email: string, password: string) => Promise<AdminAccount>;
  refreshAdmins: () => Promise<AdminAccount[]>;
  createAdmin: (details: { name: string; email: string; password: string; profilePicture: string; storeId: number }) => Promise<AdminAccount>;
  removeAdmin: (id: number) => Promise<void>;
  updateProfilePicture: (profilePicture: string) => Promise<AdminAccount>;
  getSecurityPinStatus: () => Promise<boolean>;
  createSecurityPin: (pin: string) => Promise<void>;
  verifySecurityPin: (pin: string) => Promise<string>;
  changePassword: (currentPassword: string, newPassword: string, pinToken: string) => Promise<void>;
  changeEmail: (currentPassword: string, newEmail: string, pinToken: string) => Promise<AdminAccount>;
  logout: () => Promise<void>;
}


export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [currentAdmin, setCurrentAdmin] = useState<AdminAccount | null>(null)
  const [admins, setAdmins] = useState<AdminAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sessionToken, setSessionToken] = useState(() => sessionStorage.getItem(ADMIN_TOKEN_KEY) || '')
  // A token the server just issued alongside the admin's details needs no /admin/me round trip,
  // and skipping it keeps the dashboard from flashing its loading screen after a password change.
  const verifiedTokenRef = useRef('')

  useEffect(() => {
    let cancelled = false
    if (sessionToken && sessionToken === verifiedTokenRef.current) {
      setIsLoading(false)
      return undefined
    }
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
    // Picked up once by AdminLayout to greet the admin after this sign-in.
    sessionStorage.setItem(ADMIN_WELCOME_KEY, '1')
    setCurrentAdmin(result.admin)
    setSessionToken(result.token)
    return result.admin
  }

  const refreshAdmins = useCallback(async () => {
    const result = await apiRequest<{ admins: AdminAccount[] }>('/admin/admins', { token: sessionToken })
    setAdmins(result.admins)
    return result.admins
  }, [sessionToken])

  async function createAdmin({ name, email, password, profilePicture, storeId }: { name: string; email: string; password: string; profilePicture: string; storeId: number }) {
    const result = await apiRequest<{ admin: AdminAccount }>('/admin/admins', {
      method: 'POST',
      token: sessionToken,
      body: { name, email, password, profilePicture, storeId },
    })
    setAdmins((currentAdmins) => [...currentAdmins, result.admin])
    return result.admin
  }

  async function removeAdmin(id: number) {
    await apiRequest(`/admin/admins/${id}`, {
      method: 'DELETE',
      token: sessionToken,
    })
    setAdmins((currentAdmins) => currentAdmins.filter((admin) => admin.id !== id))
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

  async function getSecurityPinStatus() {
    const result = await apiRequest<{ hasPin: boolean }>('/admin/security-pin', { token: sessionToken })
    return result.hasPin
  }

  async function createSecurityPin(pin: string) {
    await apiRequest('/admin/security-pin', { method: 'POST', token: sessionToken, body: { pin } })
  }

  async function verifySecurityPin(pin: string) {
    const result = await apiRequest<{ pinToken: string }>('/admin/security-pin/verify', {
      method: 'POST',
      token: sessionToken,
      body: { pin },
    })
    return result.pinToken
  }

  async function changePassword(currentPassword: string, newPassword: string, pinToken: string) {
    const result = await apiRequest<{ token: string }>('/admin/password', {
      method: 'PUT',
      token: sessionToken,
      body: { currentPassword, newPassword, pinToken },
    })
    verifiedTokenRef.current = result.token
    sessionStorage.setItem(ADMIN_TOKEN_KEY, result.token)
    setSessionToken(result.token)
  }

  async function changeEmail(currentPassword: string, newEmail: string, pinToken: string) {
    const result = await apiRequest<{ admin: AdminAccount }>('/admin/email', {
      method: 'PUT',
      token: sessionToken,
      body: { currentPassword, newEmail, pinToken },
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
      removeAdmin,
      updateProfilePicture,
      getSecurityPinStatus,
      createSecurityPin,
      verifySecurityPin,
      changePassword,
      changeEmail,
      logout,
    }}>
      {children}
    </AdminAuthContext.Provider>
  )
}
