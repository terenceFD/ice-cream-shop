import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export function ScrollRevealObserver() {
  const { pathname } = useLocation()

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (reducedMotion.matches || !('IntersectionObserver' in window)) return undefined

    const revealedElements = new Set<HTMLElement>()
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        // Record the reveal in a data attribute rather than a class: React rewrites className
        // when a component re-renders (for example loading -> loaded), which would hide it again.
        ;(entry.target as HTMLElement).dataset.scrollReveal = 'revealed'
        observer.unobserve(entry.target)
      }
    }, {
      rootMargin: '0px 0px -48px 0px',
      threshold: 0,
    })

    function observePageSections() {
      const elements = document.querySelectorAll<HTMLElement>('main > *, main section, main article, main form, main ul.grid > li, footer')
      for (const element of elements) {
        if (element.closest('[data-scroll-reveal="skip"]') || revealedElements.has(element)) continue
        const isMainChild = element.parentElement?.tagName === 'MAIN'
        const containsAnimatedContent = element.matches('main > *')
          && !element.matches('section, article, form')
          && element.querySelector('section, article, form')
        if (isMainChild && containsAnimatedContent) continue

        if (element.matches('article, li')) {
          const siblingCards = Array.from(element.parentElement?.children ?? [])
            .filter((sibling) => sibling.tagName === element.tagName)
          const cardIndex = siblingCards.indexOf(element)
          element.style.setProperty('--scroll-reveal-delay', `${(cardIndex % 6) * 65}ms`)
        }
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
        element.style.removeProperty('--scroll-reveal-delay')
      }
    }
  }, [pathname])

  return null
}
