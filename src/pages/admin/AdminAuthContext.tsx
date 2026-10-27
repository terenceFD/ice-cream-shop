import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { AdminAuthContext } from './useAdminAuth'
import { apiRequest, ADMIN_TOKEN_KEY, ADMIN_WELCOME_KEY, ADMIN_CREDENTIALS_CHANGED_KEY } from '../../api/api'

export interface AdminAccount {
  id: number;
  name: string;
  email: string;
  profilePicture?: string;
  role: 'owner' | 'store_admin' | 'branch_admin';
  storeId: number | null;
  storeName: string | null;
  storeTown?: string | null;
  branchTown?: string | null;
}

export interface AdminAuthContextValue {
  admins: AdminAccount[];
  currentAdmin: AdminAccount | null;
  isAdmin: boolean;
  isLoading: boolean;
  sessionToken: string;
  login: (email: string, password: string) => Promise<{ challengeToken: string; setupRequired: boolean }>;
  beginAdminMfaSetup: (challengeToken: string) => Promise<{ secret: string; authenticatorUri: string }>;
  confirmAdminMfaSetup: (challengeToken: string, code: string) => Promise<{ token: string; admin: AdminAccount; recoveryCodes: string[] }>;
  verifyAdminMfaLogin: (challengeToken: string, code: string) => Promise<{ token: string; admin: AdminAccount }>;
  completeLogin: (result: { token: string; admin: AdminAccount }) => void;
  refreshAdmins: () => Promise<AdminAccount[]>;
  createAdmin: (details: { name: string; email: string; password: string; profilePicture: string; storeId?: number; branchTown?: string; role?: 'owner' }) => Promise<AdminAccount>;
  removeAdmin: (id: number) => Promise<void>;
  updateProfilePicture: (profilePicture: string) => Promise<AdminAccount>;
  getSecurityPinStatus: () => Promise<boolean>;
  createSecurityPin: (pin: string) => Promise<void>;
  verifySecurityPin: (pin: string) => Promise<string>;
  changePassword: (currentPassword: string, newPassword: string, pinToken: string) => Promise<void>;
  changeEmail: (currentPassword: string, newEmail: string, pinToken: string) => Promise<string>;
  beginAuthenticatorReplacement: (currentPassword: string, code: string, pinToken: string) => Promise<{ secret: string; authenticatorUri: string }>;
  confirmAuthenticatorReplacement: (code: string, pinToken: string) => Promise<{ recoveryCodes: string[] }>;
  logout: () => Promise<void>;
}


export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const [currentAdmin, setCurrentAdmin] = useState<AdminAccount | null>(null)
  const [admins, setAdmins] = useState<AdminAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sessionToken, setSessionToken] = useState(() => sessionStorage.getItem(ADMIN_TOKEN_KEY) || '')
  // A token the server just issued alongside the admin's details needs no /admin/me round trip,
  // and skipping it keeps the dashboard from flashing its loading screen after a password change.
  const verifiedTokenRef = useRef('')
  const devAutoLoginAttemptedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    if (sessionToken && sessionToken === verifiedTokenRef.current) {
      setIsLoading(false)
      return undefined
    }
    if (!sessionToken) {
      setCurrentAdmin(null)
      setAdmins([])
      if (import.meta.env.DEV && location.pathname.startsWith('/admin') && !devAutoLoginAttemptedRef.current) {
        devAutoLoginAttemptedRef.current = true
        setIsLoading(true)
        apiRequest<{ token: string; admin: AdminAccount }>('/admin/dev-login', { method: 'POST' })
          .then((result) => {
            if (cancelled) return
            verifiedTokenRef.current = result.token
            sessionStorage.setItem(ADMIN_TOKEN_KEY, result.token)
            setCurrentAdmin(result.admin)
            setSessionToken(result.token)
          })
          .catch((error: unknown) => {
            if (!cancelled) console.error('Development admin sign-in failed:', error)
          })
          .finally(() => {
            if (!cancelled) setIsLoading(false)
          })
        return () => {
          cancelled = true
        }
      }
      setIsLoading(false)
      return undefined
    }

    setIsLoading(true)
    apiRequest('/admin/me', { token: sessionToken })
      .then(({ admin }: { admin: AdminAccount }) => {
        if (!cancelled) setCurrentAdmin(admin)
      })
      .catch(() => {
        if (!cancelled) {
          setCurrentAdmin(null)
          setSessionToken('')
          try {
            sessionStorage.removeItem(ADMIN_TOKEN_KEY)
          } catch {
            // The in-memory session is still cleared when storage is unavailable.
          }
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [sessionToken, location.pathname])

  useEffect(() => {
    function clearExpiredSession() {
      setSessionToken('')
      setCurrentAdmin(null)
    }
    window.addEventListener('admin-session-expired', clearExpiredSession)
    return () => window.removeEventListener('admin-session-expired', clearExpiredSession)
  }, [])

  async function login(email: string, password: string) {
    const result = await apiRequest<{
      challengeToken: string;
      mfaSetupRequired: boolean;
    }>('/admin/login', { method: 'POST', body: { email, password } })
    return { challengeToken: result.challengeToken, setupRequired: result.mfaSetupRequired }
  }

  async function beginAdminMfaSetup(challengeToken: string) {
    return apiRequest<{ secret: string; authenticatorUri: string }>('/admin/login/mfa/setup', {
      method: 'POST',
      body: { challengeToken },
    })
  }

  async function confirmAdminMfaSetup(challengeToken: string, code: string) {
    return apiRequest<{ token: string; admin: AdminAccount; recoveryCodes: string[] }>('/admin/login/mfa/verify-setup', {
      method: 'POST',
      body: { challengeToken, code },
    })
  }

  async function verifyAdminMfaLogin(challengeToken: string, code: string) {
    return apiRequest<{ token: string; admin: AdminAccount }>('/admin/login/mfa/verify', {
      method: 'POST',
      body: { challengeToken, code },
    })
  }

  function completeLogin(result: { token: string; admin: AdminAccount }) {
    verifiedTokenRef.current = result.token
    sessionStorage.setItem(ADMIN_TOKEN_KEY, result.token)
    // Picked up once by AdminLayout to greet the admin after this sign-in.
    sessionStorage.setItem(ADMIN_WELCOME_KEY, '1')
    setCurrentAdmin(result.admin)
    setSessionToken(result.token)
  }

  const refreshAdmins = useCallback(async () => {
    const result = await apiRequest<{ admins: AdminAccount[] }>('/admin/admins', { token: sessionToken })
    setAdmins(result.admins)
    return result.admins
  }, [sessionToken])

  async function createAdmin({ name, email, password, profilePicture, storeId, branchTown, role }: { name: string; email: string; password: string; profilePicture: string; storeId?: number; branchTown?: string; role?: 'owner' }) {
    const result = await apiRequest<{ admin: AdminAccount }>('/admin/admins', {
      method: 'POST',
      token: sessionToken,
      body: { name, email, password, profilePicture, storeId, branchTown, role },
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
    await apiRequest<{ changed: boolean }>('/admin/password', {
      method: 'PUT',
      token: sessionToken,
      body: { currentPassword, newPassword, pinToken },
    })
    signOutAfterCredentialChange()
  }

  async function changeEmail(currentPassword: string, newEmail: string, pinToken: string) {
    await apiRequest<{ changed: boolean }>('/admin/email', {
      method: 'PUT',
      token: sessionToken,
      body: { currentPassword, newEmail, pinToken },
    })
    signOutAfterCredentialChange()
    return newEmail
  }

  function signOutAfterCredentialChange() {
    verifiedTokenRef.current = ''
    devAutoLoginAttemptedRef.current = true
    try {
      sessionStorage.setItem(ADMIN_CREDENTIALS_CHANGED_KEY, '1')
      sessionStorage.removeItem(ADMIN_TOKEN_KEY)
    } catch (error) {
      console.warn('Unable to save the admin sign-in notice after credential changes:', error)
    }
    setSessionToken('')
    setCurrentAdmin(null)
    setAdmins([])
  }

  async function beginAuthenticatorReplacement(currentPassword: string, code: string, pinToken: string) {
    return apiRequest<{ secret: string; authenticatorUri: string }>('/admin/authenticator/replace', {
      method: 'POST',
      token: sessionToken,
      body: { currentPassword, code, pinToken },
    })
  }

  async function confirmAuthenticatorReplacement(code: string, pinToken: string) {
    return apiRequest<{ recoveryCodes: string[] }>('/admin/authenticator/replace/confirm', {
      method: 'POST',
      token: sessionToken,
      body: { code, pinToken },
    })
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
      beginAdminMfaSetup,
      confirmAdminMfaSetup,
      verifyAdminMfaLogin,
      completeLogin,
      refreshAdmins,
      createAdmin,
      removeAdmin,
      updateProfilePicture,
      getSecurityPinStatus,
      createSecurityPin,
      verifySecurityPin,
      changePassword,
      changeEmail,
      beginAuthenticatorReplacement,
      confirmAuthenticatorReplacement,
      logout,
    }}>
      {children}
    </AdminAuthContext.Provider>
  )
}
