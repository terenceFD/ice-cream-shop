import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { ADMIN_TOKEN_KEY, apiRequest } from '../api/api'

export interface Flavor {
  id: number;
  name: string;
  detail: string;
  description: string;
  price: number;
  image: string;
  tag: string;
  origin: string;
  stock: number;
  availableQuantity: number;
  color?: string;
  servings?: number;
  allergies?: string[];
  itemType?: string;
  currency?: string;
  quantity?: number;
}

type FlavorInput = Omit<Flavor, 'id' | 'availableQuantity'>

interface FlavorContextValue {
  flavors: Flavor[];
  loading: boolean;
  error: string;
  refreshFlavors: (options?: { showLoading?: boolean }) => Promise<void>;
  addFlavor: (flavor: FlavorInput) => Promise<Flavor>;
  deleteFlavor: (flavorId: number) => Promise<void>;
  updateFlavor: (flavorId: number, updates: Partial<Flavor>) => Promise<Flavor>;
}

const FlavorContext = createContext<FlavorContextValue | null>(null)

export function FlavorProvider({ children }: { children: ReactNode }) {
  const [flavors, setFlavors] = useState<Flavor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refreshFlavors = useCallback(async ({ showLoading = true }: { showLoading?: boolean } = {}) => {
    if (showLoading) setLoading(true)
    try {
      const result = await apiRequest<{ flavors: Flavor[] }>('/flavors')
      setFlavors(result.flavors)
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load flavors.')
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

  async function addFlavor(flavor: FlavorInput) {
    const result = await apiRequest<{ flavor: Flavor }>('/admin/flavors', {
      method: 'POST',
      token: sessionStorage.getItem(ADMIN_TOKEN_KEY),
      body: flavor,
    })
    setFlavors((currentFlavors) => [...currentFlavors, result.flavor])
    setError('')
    return result.flavor
  }

  async function deleteFlavor(flavorId: number) {
    await apiRequest(`/admin/flavors/${flavorId}`, {
      method: 'DELETE',
      token: sessionStorage.getItem(ADMIN_TOKEN_KEY),
    })
    setFlavors((currentFlavors) => currentFlavors.filter((flavor) => flavor.id !== flavorId))
    setError('')
  }

  async function updateFlavor(flavorId: number, updates: Partial<Flavor>) {
    const result = await apiRequest<{ flavor: Flavor }>(`/admin/flavors/${flavorId}`, {
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
