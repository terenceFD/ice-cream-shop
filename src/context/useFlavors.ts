import { createContext, useContext } from 'react'
import type { FlavorContextValue } from './FlavorContext'

export const FlavorContext = createContext<FlavorContextValue | null>(null)

export function useFlavors() {
  const context = useContext(FlavorContext)
  if (!context) {
    throw new Error('useFlavors must be used within FlavorProvider')
  }
  return context
}
