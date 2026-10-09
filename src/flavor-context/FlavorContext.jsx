import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { ADMIN_TOKEN_KEY, apiRequest } from '../api/api'

const FlavorContext = createContext(null)

export function FlavorProvider({ children }) {
  const [flavors, setFlavors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refreshFlavors = useCallback(async ({ showLoading = true } = {}) => {
    if (showLoading) setLoading(true)
    try {
      const result = await apiRequest('/flavors')
      setFlavors(result.flavors)
      setError('')
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshFlavors()
    const inventoryRefresh = window.setInterval(() => {
      refreshFlavors({ showLoading: false })
    }, 30000)
    return () => window.clearInterval(inventoryRefresh)
  }, [refreshFlavors])

  async function addFlavor(flavor) {
    const result = await apiRequest('/admin/flavors', {
      method: 'POST',
      token: sessionStorage.getItem(ADMIN_TOKEN_KEY),
      body: flavor,
    })
    setFlavors((currentFlavors) => [...currentFlavors, result.flavor])
    setError('')
    return result.flavor
  }

  async function deleteFlavor(flavorId) {
    await apiRequest(`/admin/flavors/${flavorId}`, {
      method: 'DELETE',
      token: sessionStorage.getItem(ADMIN_TOKEN_KEY),
    })
    setFlavors((currentFlavors) => currentFlavors.filter((flavor) => flavor.id !== flavorId))
    setError('')
  }

  async function updateFlavor(flavorId, updates) {
    const result = await apiRequest(`/admin/flavors/${flavorId}`, {
      method: 'PUT',
      token: sessionStorage.getItem(ADMIN_TOKEN_KEY),
      body: updates,
    })
    setFlavors((currentFlavors) =>
      currentFlavors.map((flavor) => flavor.id === flavorId ? result.flavor : flavor)
    )
    setError('')
    return result.flavor
  }

  return (
    <FlavorContext.Provider value={{ flavors, loading, error, refreshFlavors, addFlavor, deleteFlavor, updateFlavor }}>
      {children}
    </FlavorContext.Provider>
  )
}

export function useFlavors() {
  const context = useContext(FlavorContext)
  if (!context) {
    throw new Error('useFlavors must be used within FlavorProvider')
  }
  return context
}
