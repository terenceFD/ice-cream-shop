import { useLayoutEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

// The router keeps the previous page's scroll position, so a link clicked low on a long
// page would open the next page at its footer. Start each new page at the top instead,
// except on back/forward, where the browser restores where the visitor was.
export function ScrollToTop() {
  const { pathname } = useLocation()
  const navigationType = useNavigationType()

  useLayoutEffect(() => {
    if (navigationType === 'POP') return
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname, navigationType])

  return null
}
