import { useEffect, useState } from 'react'
import { useLanguage } from '../language/useLanguage'

// Show on each full page load; the app-level component stays mounted during client-side navigation.
const EXIT_MS = 380

export function WebsiteLoader() {
  const { isReady, t } = useLanguage()
  const [isLeaving, setIsLeaving] = useState(false)
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    if (!isReady) return undefined
    let removeTimer = 0
    const exitTimer = window.setTimeout(() => {
      setIsLeaving(true)
      removeTimer = window.setTimeout(() => setIsVisible(false), EXIT_MS)
    }, 0)

    return () => {
      window.clearTimeout(exitTimer)
      window.clearTimeout(removeTimer)
    }
  }, [isReady])

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
