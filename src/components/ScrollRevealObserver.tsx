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
    const revealObserverMap = new WeakMap<Element, IntersectionObserver>()

    // A React re-render can rewrite data-scroll-reveal back to '' on an element the visitor has
    // already scrolled past. Whatever is on screen (or above it) is revealed again in the next
    // frame; that is a handful of elements per frame, never a layout of the whole page.
    const pendingChecks = new Set<Element>()
    let checkFrame = 0
    function queueRevealCheck(element: Element) {
      pendingChecks.add(element)
      if (checkFrame) return
      checkFrame = window.requestAnimationFrame(() => {
        checkFrame = 0
        const checks = Array.from(pendingChecks)
        pendingChecks.clear()
        const tops = checks.map((element) => (element as HTMLElement).getBoundingClientRect().top)
        checks.forEach((element, index) => {
          if ((element as HTMLElement).dataset.scrollReveal !== '') return
          if (tops[index] < window.innerHeight) (element as HTMLElement).dataset.scrollReveal = 'revealed'
          else revealObserverMap.get(element)?.observe(element)
        })
      })
    }

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
        // Root elements of a page (<main> child) and of a <section> fade in as blocks by their
        // own position, so a page without sections (the admin dashboard) still animates.
        if (element.matches('main > *, section > *')) {
          element.style.setProperty('--scroll-reveal-delay', '0ms')
        }
        revealObserverMap.set(element, revealObserver)
        element.dataset.scrollReveal = ''
        revealObserver.observe(element)
      }
    })

    function observePageSections() {
      const elements = document.querySelectorAll<HTMLElement>('main > *, main section, main article, main form, main ul.grid > li, main section > *, footer')
      for (const element of elements) {
        if (trackedElements.has(element) || element.closest('[data-scroll-reveal="skip"]')) continue
        const isMainChild = element.parentElement?.tagName === 'MAIN'
        const containsAnimatedContent = element.matches('main > *')
          && !element.matches('section, article, form')
          && element.querySelector('section, article, form')
        // Page roots (<main> child) that only wrap a section are skipped, so their sections
        // animate instead of the whole block. Anything else at the top of a page - a plain
        // <div> holding a dashboard, for example - fades in as a block.
        if (isMainChild && containsAnimatedContent) continue
        trackedElements.add(element)
        revealObserverMap.set(element, revealObserver)
        firstLookObserver.observe(element)
      }
      document.documentElement.classList.add('scroll-reveal-enabled')
    }

    observePageSections()
    // Many small DOM changes (a countdown ticking, a slider moving) arrive together; scan the
    // page at most once per frame instead of once per change.
    let scanFrame = 0
    const mutationObserver = new MutationObserver((records) => {
      let hiddenAgain = false
      for (const record of records) {
        const target = record.target as HTMLElement
        if (record.type === 'attributes' && record.attributeName === 'data-scroll-reveal'
          && target.dataset.scrollReveal === '' && trackedElements.has(target)) {
          queueRevealCheck(target)
          hiddenAgain = true
        }
      }
      if (hiddenAgain || scanFrame) return
      scanFrame = window.requestAnimationFrame(() => {
        scanFrame = 0
        observePageSections()
      })
    })
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-scroll-reveal'],
    })

    return () => {
      window.cancelAnimationFrame(scanFrame)
      window.cancelAnimationFrame(checkFrame)
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
