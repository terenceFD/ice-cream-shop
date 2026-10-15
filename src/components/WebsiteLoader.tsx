import { useEffect, useState } from 'react'
import { useLanguage } from '../language/useLanguage'

const MIN_VISIBLE_MS = 900
const MAX_VISIBLE_MS = 2500
const EXIT_MS = 700

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
      <div aria-hidden="true" className="website-loader__dots-bg" />
      <div aria-hidden="true" className="website-loader__halo" />

      <div className="website-loader__content">
        <div aria-hidden="true" className="website-loader__mark">
          <svg className="website-loader__ring" viewBox="0 0 120 120">
            <circle className="website-loader__ring-track" cx="60" cy="60" r="54" />
            <circle className="website-loader__ring-progress" cx="60" cy="60" r="54" />
          </svg>
          <img decoding="async" loading="eager" alt="" className="website-loader__logo" height={88} src="/logo.png" width={88} />
        </div>

        <p aria-hidden="true" className="website-loader__wordmark">
          Cold Stone
          <span>Creamery</span>
        </p>
        <p className="website-loader__message">{t('A little sweetness is on its way')}</p>

        <div aria-hidden="true" className="website-loader__bar">
          <span />
        </div>
      </div>
    </div>
  )
}
