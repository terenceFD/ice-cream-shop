import { useEffect, useState } from 'react'
import { useLanguage } from '../language/useLanguage'

export function WebsiteLoader() {
  const { t } = useLanguage()
  const [isLeaving, setIsLeaving] = useState(false)
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const exitTimer = window.setTimeout(() => setIsLeaving(true), 850)
    const removeTimer = window.setTimeout(() => setIsVisible(false), 1250)

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
      <div aria-hidden="true" className="website-loader__glow website-loader__glow--top" />
      <div aria-hidden="true" className="website-loader__glow website-loader__glow--bottom" />
      <div className="website-loader__content">
        <div aria-hidden="true" className="website-loader__illustration">
          <span className="website-loader__orbit" />
          <svg className="website-loader__cone" fill="none" viewBox="0 0 72 76">
            <path d="M18 40h36L43 70a7 7 0 0 1-14 0L18 40Z" fill="#F3B866" />
            <path d="m22 49 25 17M29 42l22 15M26 60l11-17m-5 24 15-24" stroke="#CF8840" strokeLinecap="round" strokeWidth="1.8" />
            <path d="M19 41c-5 0-8-4-8-9 0-4 3-7 7-8-1-7 5-12 12-10 4-9 18-8 20 2 7-1 12 4 11 10 5 1 8 5 8 10 0 3-2 5-6 5H19Z" fill="#FFDC32" />
            <path d="M20 35c4-4 8 3 13-1s7 3 12 0 8 3 13-1" stroke="#FFEFA6" strokeLinecap="round" strokeWidth="2.5" />
            <circle cx="29" cy="24" r="1.7" fill="#F19A88" />
            <circle cx="45" cy="19" r="1.7" fill="#F19A88" />
            <circle cx="52" cy="31" r="1.7" fill="#F19A88" />
          </svg>
        </div>
        <p className="website-loader__eyebrow">COLD STONE <span aria-hidden="true">·</span> CAMEROON</p>
        <p className="website-loader__message">{t('A little sweetness is on its way')}</p>
        <div aria-hidden="true" className="website-loader__dots">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  )
}
