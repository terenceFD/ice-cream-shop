import { useEffect, useState } from 'react'
import { useLanguage } from '../language/useLanguage'

// A short hold keeps the mark from flashing, then the page shows as soon as language is ready.
const MIN_VISIBLE_MS = 420
const EXIT_MS = 280

const GOLD = '#ffb84d'
const GOLD_LIGHT = '#ffcf85'
const CREAM = '#fff8f0'
const PINK = '#f7a8c4'
const STRAWBERRY = '#e8879b'
const MINT = '#8fd6b4'
const CHOCOLATE = '#8a5a3b'

// Floating treats drawn in the same spirit as the hero's themed shapes
// (HeroBackground.tsx), but with more items and each one a product the
// website sells. Positions/timings mirror the hero's FLOAT_POSITIONS style.
// Each entry: where it drifts, how big, its float timing and its palette.
const LOADER_TREATS = [
  { left: '5%', top: '18%', size: 30, delay: '-3s', duration: '13s', color: GOLD, shape: 'cone' },
  { left: '88%', top: '24%', size: 26, delay: '-6s', duration: '15s', color: PINK, shape: 'popsicle' },
  { left: '14%', top: '72%', size: 28, delay: '-8s', duration: '14s', color: STRAWBERRY, shape: 'sundae' },
  { left: '78%', top: '68%', size: 24, delay: '-5s', duration: '16s', color: GOLD_LIGHT, shape: 'milkshake' },
  { left: '30%', top: '10%', size: 26, delay: '-9s', duration: '13.5s', color: CREAM, shape: 'cake' },
  { left: '62%', top: '8%', size: 24, delay: '-4s', duration: '14.5s', color: GOLD, shape: 'cupcake' },
  { left: '44%', top: '84%', size: 24, delay: '-7s', duration: '12.5s', color: MINT, shape: 'pint' },
  { left: '70%', top: '42%', size: 22, delay: '-10s', duration: '15.5s', color: CHOCOLATE, shape: 'cookie' },
  { left: '24%', top: '40%', size: 22, delay: '-11s', duration: '14s', color: PINK, shape: 'donut' },
  { left: '93%', top: '50%', size: 22, delay: '-2s', duration: '13s', color: GOLD_LIGHT, shape: 'wafflecone' },
  { left: '8%', top: '46%', size: 20, delay: '-12s', duration: '16s', color: MINT, shape: 'mintcone' },
  { left: '52%', top: '58%', size: 20, delay: '-1.5s', duration: '13.5s', color: STRAWBERRY, shape: 'slice' },
] as const

// One inline SVG per treat. All draw inside a 24 x 36 viewBox so they share
// the hero shapes' sizing behavior, with soft opacity like the hero decor.
function TreatShape({ kind }: { kind: (typeof LOADER_TREATS)[number]['shape'] }) {
  switch (kind) {
    case 'cone':
      // Classic single-scoop cone
      return (
        <g>
          <circle cx="12" cy="9" r="7" fill="currentColor" opacity="0.4" />
          <path d="M7 16h10l-5 14-5-14Z" fill="currentColor" opacity="0.25" />
        </g>
      )
    case 'popsicle':
      // Popsicle on a stick
      return (
        <g>
          <rect x="7" y="3" width="10" height="18" rx="5" fill="currentColor" opacity="0.4" />
          <rect x="10.7" y="21" width="2.6" height="8" rx="1.3" fill={CREAM} opacity="0.45" />
        </g>
      )
    case 'sundae':
      // Sundae cup with two scoops and a cherry
      return (
        <g>
          <circle cx="9" cy="8" r="4" fill="currentColor" opacity="0.4" />
          <circle cx="15" cy="8" r="4" fill="currentColor" opacity="0.32" />
          <circle cx="12" cy="3.4" r="1.5" fill={GOLD_LIGHT} opacity="0.7" />
          <path d="M5 12h14l-2.5 9h-9L5 12Z" fill={CREAM} opacity="0.35" />
        </g>
      )
    case 'milkshake':
      // Milkshake glass with straw and swirl top
      return (
        <g>
          <path d="M9 2h1.6l2 5H16l-2 20h-4L8 7h1.8L9 2Z" fill="currentColor" opacity="0.3" />
          <path d="M14.5 2l3-1" stroke={GOLD_LIGHT} strokeWidth="1.6" strokeLinecap="round" opacity="0.6" />
          <path d="M7.4 8.6c3 .9 6.2.9 9.2 0l-.6 4.4H8L7.4 8.6Z" fill="currentColor" opacity="0.45" />
        </g>
      )
    case 'cake':
      // Two-layer birthday cake with a lit candle
      return (
        <g>
          <rect x="5" y="14" width="14" height="8" rx="1.5" fill="currentColor" opacity="0.28" />
          <rect x="7" y="10" width="10" height="4" rx="1.5" fill="currentColor" opacity="0.4" />
          <rect x="11.2" y="4" width="1.6" height="5" rx="0.8" fill="currentColor" opacity="0.5" />
          <circle cx="12" cy="3" r="1.4" fill={GOLD_LIGHT} opacity="0.7" />
        </g>
      )
    case 'cupcake':
      // Cupcake with frosting swirl and wrapper
      return (
        <g>
          <circle cx="9.5" cy="7" r="3.4" fill="currentColor" opacity="0.4" />
          <circle cx="14.5" cy="7" r="3.4" fill="currentColor" opacity="0.34" />
          <path d="M6 11h12l-2 12H8L6 11Z" fill={CREAM} opacity="0.35" />
          <path d="M7.5 15h9M8 19h8" stroke={GOLD_LIGHT} strokeWidth="1.2" opacity="0.4" />
        </g>
      )
    case 'pint':
      // Take-home pint tub with lid
      return (
        <g>
          <rect x="6" y="10" width="12" height="16" rx="2" fill="currentColor" opacity="0.3" />
          <rect x="5" y="7" width="14" height="4" rx="2" fill="currentColor" opacity="0.45" />
          <path d="M9 15h6" stroke={CREAM} strokeWidth="1.4" opacity="0.45" />
        </g>
      )
    case 'cookie':
      // Chocolate chip cookie
      return (
        <g>
          <circle cx="12" cy="14" r="9" fill="currentColor" opacity="0.35" />
          <circle cx="9" cy="11" r="1.5" fill={CHOCOLATE} opacity="0.6" />
          <circle cx="15" cy="13" r="1.3" fill={CHOCOLATE} opacity="0.55" />
          <circle cx="11" cy="17" r="1.3" fill={CHOCOLATE} opacity="0.5" />
          <circle cx="16" cy="17" r="1" fill={CHOCOLATE} opacity="0.45" />
        </g>
      )
    case 'donut':
      // Glazed donut with sprinkles
      return (
        <g>
          <circle cx="12" cy="14" r="9" fill="currentColor" opacity="0.4" />
          <circle cx="12" cy="14" r="3.4" fill="var(--brand-navy)" opacity="0.55" />
          <path d="M8 9.5l1.6 1M16 10l-1.4 1.1M7 16.5l1.7-.4M17 16l-1.6-.2" stroke={GOLD_LIGHT} strokeWidth="1.3" strokeLinecap="round" opacity="0.65" />
        </g>
      )
    case 'wafflecone':
      // Waffle cone with crisscross pattern and a scoop
      return (
        <g>
          <circle cx="12" cy="7.5" r="5.5" fill="currentColor" opacity="0.4" />
          <path d="M7.5 13h9L12 30l-4.5-17Z" fill="currentColor" opacity="0.25" />
          <path d="M8.4 15.5l6-2M9 19l4.6-1.6M10 22.5l2.8-1" stroke={CREAM} strokeWidth="1" opacity="0.45" />
        </g>
      )
    case 'mintcone':
      // Mint double-scoop cone
      return (
        <g>
          <circle cx="9" cy="7" r="4.2" fill="currentColor" opacity="0.42" />
          <circle cx="15" cy="8" r="4.2" fill="currentColor" opacity="0.32" />
          <path d="M7.5 12.5h9L12 28l-4.5-15.5Z" fill="currentColor" opacity="0.25" />
        </g>
      )
    case 'slice':
      // Cake slice on a plate
      return (
        <g>
          <path d="M4 22h16l-1 3H5l-1-3Z" fill={CREAM} opacity="0.35" />
          <path d="M6 12l10-5 2 13H6V12Z" fill="currentColor" opacity="0.35" />
          <path d="M6 12c3-2 7-3 10-5" stroke={GOLD_LIGHT} strokeWidth="1.4" opacity="0.55" fill="none" />
        </g>
      )
    default:
      return null
  }
}

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
      {/* Floating treats, using the hero section's shape float animation. */}
      <div aria-hidden="true" className="website-loader__shapes">
        {LOADER_TREATS.map((treat) => (
          <svg
            className="hero-shape website-loader__shape absolute"
            key={treat.shape}
            style={{
              left: treat.left,
              top: treat.top,
              width: treat.size,
              height: treat.size * 1.5,
              color: treat.color,
              animationDelay: treat.delay,
              animationDuration: treat.duration,
            }}
            viewBox="0 0 24 36"
          >
            <TreatShape kind={treat.shape} />
          </svg>
        ))}
      </div>
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
