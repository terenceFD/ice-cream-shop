import { useLocation } from 'react-router-dom'
import { FLAVOR_PATH, metaForPath } from './pageMeta.js'
import { useDocumentMeta } from './useDocumentMeta'

// Applies each route's title and description. Flavor pages set their own from the flavor's data.
export function RouteMeta() {
  const { pathname } = useLocation()
  useDocumentMeta(FLAVOR_PATH.test(pathname) ? null : metaForPath(pathname))
  return null
}
