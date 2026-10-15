import { useEffect } from 'react'

// The loader itself is plain HTML in index.html (shared/bootLoader.js), so it shows before any
// JavaScript arrives. This removes it as soon as the page has something on screen, with no
// minimum time, and fades it out. It renders nothing itself.
const FADE_MS = 350
const GIVE_UP_MS = 6000

export function WebsiteLoader() {
  useEffect(() => {
    const loader = document.getElementById('boot-loader')
    if (!loader) return undefined
    if (document.documentElement.classList.contains('boot-skip')) {
      loader.remove()
      return undefined
    }

    const startedAt = performance.now()
    let frame = 0
    let removeTimer = 0
    const finish = () => {
      loader.classList.add('boot-loader--done')
      removeTimer = window.setTimeout(() => loader.remove(), FADE_MS)
    }
    // Lazy pages render their <main> a moment after the app starts; wait for it.
    const check = () => {
      if (document.querySelector('main') || performance.now() - startedAt > GIVE_UP_MS) finish()
      else frame = window.requestAnimationFrame(check)
    }
    check()

    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(removeTimer)
    }
  }, [])

  return null
}
