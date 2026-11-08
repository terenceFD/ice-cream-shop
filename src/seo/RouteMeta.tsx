import { useLocation } from 'react-router-dom'
import { findMenuItemBySlug } from '../../shared/data.js'
import { FLAVOR_PATH, TREAT_PATH, metaForMenuItem, metaForPath } from './pageMeta.js'
import { useDocumentMeta } from './useDocumentMeta'

// Applies each route's title and description. Flavor pages set their own from the flavor's data.
export function RouteMeta() {
  const { pathname } = useLocation()
  const treat = pathname.match(TREAT_PATH)
  const found = treat ? findMenuItemBySlug(treat[1], treat[2]) : null
  const meta = FLAVOR_PATH.test(pathname)
    ? null
    : found
      ? metaForMenuItem(found.category, found.item)
      : treat
        ? metaForPath('/__missing__')
        : metaForPath(pathname)
  useDocumentMeta(meta)
  return null
}
