import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Sections fade in as they scroll into view. Content that is already on screen when it appears
// is shown straight away (fading it in would only delay the moment the page looks ready), and
// elements stay visible until the browser has confirmed they are below the screen.
//
// Where an element is comes from IntersectionObserver, which the browser answers as part of
// its normal drawing. Asking with getBoundingClientRect() instead forces an extra layout of
// the whole page every time new content arrives, which was slow on long pages (All menu).
export function ScrollRevealObserver() {
  const { pathname } = useLocation()

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (reducedMotion.matches || !('IntersectionObserver' in window)) return undefined

    const trackedElements = new Set<HTMLElement>()

    // Reveals waiting elements as they scroll in.
    const revealObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        // Record the reveal in a data attribute rather than a class: React rewrites className
        // when a component re-renders (for example loading -> loaded), which would hide it again.
        ;(entry.target as HTMLElement).dataset.scrollReveal = 'revealed'
        revealObserver.unobserve(entry.target)
      }
    }, {
      rootMargin: '0px 0px -48px 0px',
      threshold: 0,
    })

    // First look at a new element: on screen now means shown as is; below the screen means it
    // is hidden and waits to fade in.
    const firstLookObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const element = entry.target as HTMLElement
        firstLookObserver.unobserve(element)
        if (entry.isIntersecting || entry.boundingClientRect.bottom <= 0) {
          element.dataset.scrollReveal = 'revealed'
          continue
        }
        if (element.matches('article, li')) {
          const siblingCards = Array.from(element.parentElement?.children ?? [])
            .filter((sibling) => sibling.tagName === element.tagName)
          const cardIndex = siblingCards.indexOf(element)
          element.style.setProperty('--scroll-reveal-delay', `${(cardIndex % 6) * 65}ms`)
        }
        element.dataset.scrollReveal = ''
        revealObserver.observe(element)
      }
    })

    function observePageSections() {
      const elements = document.querySelectorAll<HTMLElement>('main > *, main section, main article, main form, main ul.grid > li, footer')
      for (const element of elements) {
        if (trackedElements.has(element) || element.closest('[data-scroll-reveal="skip"]')) continue
        const isMainChild = element.parentElement?.tagName === 'MAIN'
        const containsAnimatedContent = element.matches('main > *')
          && !element.matches('section, article, form')
          && element.querySelector('section, article, form')
        if (isMainChild && containsAnimatedContent) continue
        trackedElements.add(element)
        firstLookObserver.observe(element)
      }
      document.documentElement.classList.add('scroll-reveal-enabled')
    }

    observePageSections()
    // Many small DOM changes (a countdown ticking, a slider moving) arrive together; scan the
    // page at most once per frame instead of once per change.
    let scanFrame = 0
    const mutationObserver = new MutationObserver(() => {
      if (scanFrame) return
      scanFrame = window.requestAnimationFrame(() => {
        scanFrame = 0
        observePageSections()
      })
    })
    mutationObserver.observe(document.body, { childList: true, subtree: true })

    return () => {
      window.cancelAnimationFrame(scanFrame)
      mutationObserver.disconnect()
      firstLookObserver.disconnect()
      revealObserver.disconnect()
      document.documentElement.classList.remove('scroll-reveal-enabled')
      for (const element of trackedElements) {
        delete element.dataset.scrollReveal
        element.style.removeProperty('--scroll-reveal-delay')
      }
    }
  }, [pathname])

  return null
}
