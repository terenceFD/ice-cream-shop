import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useLanguage } from '../language/useLanguage'

// Show the loader immediately so the page never renders in front of it. The overlay still
// stays on screen for at least 1000ms before exiting, which keeps the splash visible long enough
// without feeling delayed or stuck. MAX_VISIBLE_MS is a safety net if a page never draws <main>.
const SHOW_DELAY_MS = 0
const MIN_VISIBLE_MS = 1000
const MAX_VISIBLE_MS = 2500
const EXIT_MS = 380

// Opening screen in the style of the navy page headers (PageHero): soft blue glows, dot
// pattern, the ✦ eyebrow pill, a dashed ring around the logo, and the yellow hand-drawn
// underline, which draws itself while the site loads. On exit the panel lifts away with
// the same curved edge as the headers. Styles: .website-loader in src/index.css.
export function WebsiteLoader() {
  const { t } = useLanguage()
  const { pathname } = useLocation()
  const [isLeaving, setIsLeaving] = useState(false)
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    setIsLeaving(false)
    setIsVisible(true)

    let exitTimer = 0
    let removeTimer = 0

    exitTimer = window.setTimeout(() => {
      setIsLeaving(true)
      removeTimer = window.setTimeout(() => setIsVisible(false), EXIT_MS)
    }, MIN_VISIBLE_MS)

    return () => {
      window.clearTimeout(exitTimer)
      window.clearTimeout(removeTimer)
    }
  }, [pathname])

  if (!isVisible) return null

  return (
    <div
      aria-label={t('Loading your sweet moments')}
      className={`website-loader${isLeaving ? ' website-loader--leaving' : ''}`}
      role="status"
    >
      <div className="website-loader__panel">
        <div aria-hidden="true" className="website-loader__glow website-loader__glow--top" />
        <div aria-hidden="true" className="website-loader__glow website-loader__glow--bottom" />
        <div aria-hidden="true" className="website-loader__dots" />

        <div className="website-loader__content">
          <p aria-hidden="true" className="website-loader__eyebrow">
            <span>✦</span>
            {t('Mixed fresh, just for you')}
          </p>

          <div aria-hidden="true" className="website-loader__mark">
            <span className="website-loader__ring" />
            <img alt="" className="website-loader__logo" decoding="async" height={96} loading="eager" src="/logo.png" width={96} />
          </div>

          <p aria-hidden="true" className="website-loader__wordmark">
            Cold Stone <span>Creamery</span>
          </p>
          <svg aria-hidden="true" className="website-loader__underline" fill="none" preserveAspectRatio="none" viewBox="0 0 200 12">
            <path d="M2 9C40 3 90 1.5 198 6" pathLength="100" />
          </svg>

          <p className="website-loader__message">{t('A little sweetness is on its way')}</p>
        </div>
      </div>

      {/* Curved bottom edge, the same curve as the bottom of the page headers. */}
      <svg aria-hidden="true" className="website-loader__wave" fill="currentColor" preserveAspectRatio="none" viewBox="0 0 1440 80">
        <path d="M0 80V42C240 4 480 0 720 22s480 44 720 4v54H0Z" />
      </svg>
    </div>
  )
}
