import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { FlavorContext } from './useFlavors'
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

export interface FlavorContextValue {
  flavors: Flavor[];
  loading: boolean;
  error: string;
  refreshFlavors: (options?: { showLoading?: boolean }) => Promise<void>;
  addFlavor: (flavor: FlavorInput) => Promise<Flavor>;
  deleteFlavor: (flavorId: number) => Promise<void>;
  updateFlavor: (flavorId: number, updates: Partial<Flavor>) => Promise<Flavor>;
}


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
    // The homepage already has its menu photos. Give those the connection first.
    const delay = window.location.pathname === '/' ? 1600 : 0
    let inventoryRefresh = 0
    const start = window.setTimeout(() => {
      refreshFlavors()
      inventoryRefresh = window.setInterval(() => {
        if (document.visibilityState === 'hidden') return
        refreshFlavors({ showLoading: false })
      }, 30000)
    }, delay)
    return () => {
      window.clearTimeout(start)
      window.clearInterval(inventoryRefresh)
    }
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
