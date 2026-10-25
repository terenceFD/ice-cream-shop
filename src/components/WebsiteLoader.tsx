import { useEffect, useState } from 'react'
import { useLanguage } from '../language/useLanguage'

// Hold long enough for the bar to fill, then leave once the language pack is ready.
const MIN_VISIBLE_MS = 1100
const EXIT_MS = 420

export function WebsiteLoader() {
  const { isReady, t } = useLanguage()
  const [hasHeld, setHasHeld] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const holdTimer = window.setTimeout(() => setHasHeld(true), MIN_VISIBLE_MS)
    return () => window.clearTimeout(holdTimer)
  }, [])

  useEffect(() => {
    if (!isReady || !hasHeld) return undefined
    setIsLeaving(true)
    const removeTimer = window.setTimeout(() => setIsVisible(false), EXIT_MS)
    return () => window.clearTimeout(removeTimer)
  }, [hasHeld, isReady])

  if (!isVisible) return null

  return (
    <div
      aria-label={t('Loading your sweet moments')}
      className={`website-loader${isLeaving ? ' website-loader--leaving' : ''}`}
      role="status"
    >
      <div className="website-loader__content">
        <img
          alt=""
          className="website-loader__logo"
          decoding="async"
          height={80}
          loading="eager"
          src="/logo.png"
          width={80}
        />
        <p className="website-loader__wordmark">
          <span>Cold Stone</span>
          <span>Creamery</span>
        </p>
        <div aria-hidden="true" className="website-loader__bar">
          <span className="website-loader__fill" />
        </div>
        <p className="website-loader__message">{t('Preparing your Cold Stone experience')}</p>
      </div>
    </div>
  )
}
