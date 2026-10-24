import { useEffect, useState } from 'react'
import { useLanguage } from '../language/useLanguage'

// Show on each full page load; the app-level component stays mounted during client-side navigation.
const MIN_VISIBLE_MS = 1000
const EXIT_MS = 380

export function WebsiteLoader() {
  const { t } = useLanguage()
  const [isLeaving, setIsLeaving] = useState(false)
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    let removeTimer = 0
    const exitTimer = window.setTimeout(() => {
      setIsLeaving(true)
      removeTimer = window.setTimeout(() => setIsVisible(false), EXIT_MS)
    }, MIN_VISIBLE_MS)

    return () => {
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
      <div className="website-loader__content">
        <div className="website-loader__brand">
          <img alt="" className="website-loader__logo" decoding="async" height={96} loading="eager" src="/logo.png" width={96} />
          <p className="website-loader__wordmark">
            Cold Stone <span>Creamery</span>
          </p>
        </div>

        <div aria-hidden="true" className="website-loader__scoop-track">
          <span className="website-loader__scoop" />
        </div>

        <p className="website-loader__message">{t('Preparing your Cold Stone experience')}</p>
      </div>
    </div>
  )
}
