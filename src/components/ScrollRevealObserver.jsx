import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export function ScrollRevealObserver() {
  const { pathname } = useLocation()

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (reducedMotion.matches || !('IntersectionObserver' in window)) return undefined

    const revealedElements = new Set()
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add('is-scroll-revealed')
        observer.unobserve(entry.target)
      }
    }, {
      rootMargin: '0px 0px -32px 0px',
      threshold: 0,
    })

    function observePageSections() {
      const elements = document.querySelectorAll('main section, main article')
      for (const element of elements) {
        const parentSection = element.parentElement?.closest('main section, main article')
        if (parentSection || revealedElements.has(element)) continue
        element.dataset.scrollReveal = ''
        revealedElements.add(element)
        observer.observe(element)
      }
      document.documentElement.classList.add('scroll-reveal-enabled')
    }

    observePageSections()
    const mutationObserver = new MutationObserver(observePageSections)
    mutationObserver.observe(document.body, { childList: true, subtree: true })

    return () => {
      mutationObserver.disconnect()
      observer.disconnect()
      document.documentElement.classList.remove('scroll-reveal-enabled')
      for (const element of revealedElements) {
        delete element.dataset.scrollReveal
        element.classList.remove('is-scroll-revealed')
      }
    }
  }, [pathname])

  return null
}
