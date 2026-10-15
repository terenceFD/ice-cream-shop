import { useEffect, useState } from 'react'
import { useLanguage } from '../language/useLanguage'

const MIN_VISIBLE_MS = 900
const MAX_VISIBLE_MS = 2500
const EXIT_MS = 850

// Opening screen in the style of the navy page headers (PageHero): soft blue glows, dot
// pattern, the ✦ eyebrow pill, a dashed ring around the logo, and the yellow hand-drawn
// underline, which draws itself while the site loads. On exit the panel lifts away with
// the same curved edge as the headers. Styles: .website-loader in src/index.css.
export function WebsiteLoader() {
  const { t } = useLanguage()
  const [isLeaving, setIsLeaving] = useState(false)
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const startedAt = performance.now()
    let exitTimer = 0
    let removeTimer = 0

    const leave = () => {
      if (exitTimer) return
      const wait = Math.max(0, MIN_VISIBLE_MS - (performance.now() - startedAt))
      exitTimer = window.setTimeout(() => {
        setIsLeaving(true)
        removeTimer = window.setTimeout(() => setIsVisible(false), EXIT_MS)
      }, wait)
    }

    if (document.readyState === 'complete') leave()
    else window.addEventListener('load', leave, { once: true })
    const safetyTimer = window.setTimeout(leave, MAX_VISIBLE_MS)

    return () => {
      window.removeEventListener('load', leave)
      window.clearTimeout(safetyTimer)
      window.clearTimeout(exitTimer)
      window.clearTimeout(removeTimer)
    }
  }, [])

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
            <img alt="" className="website-loader__logo" decoding="async" height={96} loading="eager" src="/icons/icon-192.png" width={96} />
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
