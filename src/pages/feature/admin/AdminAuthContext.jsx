import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { apiRequest, ADMIN_TOKEN_KEY } from '../../../api'

const AdminAuthContext = createContext(null)

export function AdminAuthProvider({ children }) {
  const [currentAdmin, setCurrentAdmin] = useState(null)
  const [admins, setAdmins] = useState([])
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
      .then(({ admin }) => {
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

  async function login(email, password) {
    const result = await apiRequest('/admin/login', { method: 'POST', body: { email, password } })
    sessionStorage.setItem(ADMIN_TOKEN_KEY, result.token)
    setCurrentAdmin(result.admin)
    setSessionToken(result.token)
    return result.admin
  }

  const refreshAdmins = useCallback(async () => {
    const result = await apiRequest('/admin/admins', { token: sessionToken })
    setAdmins(result.admins)
    return result.admins
  }, [sessionToken])

  async function createAdmin({ name, email, password, profilePicture }) {
    const result = await apiRequest('/admin/admins', {
      method: 'POST',
      token: sessionToken,
      body: { name, email, password, profilePicture },
    })
    setAdmins((currentAdmins) => [...currentAdmins, result.admin])
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
