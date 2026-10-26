import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../../pages/admin/useAdminAuth'
import { useLanguage } from '../../language/useLanguage'

// Signs an admin out after a stretch without activity, so a dashboard left open on a shop
// computer does not stay usable by whoever walks up to it.
const IDLE_LIMIT_MS = 30 * 60 * 1000
const WARNING_MS = 60 * 1000
const CHECK_EVERY_MS = 1000
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'mousemove'] as const

// Read by the admin login page to explain why the admin was signed out. The admin route
// redirects to the login page on its own once the session ends, so the reason travels here.
export const IDLE_SIGN_OUT_KEY = 'cold-stone-admin-idle-sign-out'

export function AdminIdleGuard() {
  const { logout } = useAdminAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const lastActivityRef = useRef(0)
  const warningRef = useRef(false)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const stayButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!lastActivityRef.current) lastActivityRef.current = Date.now()
    function markActive() {
      // While the warning shows, only the button keeps the session; a stray mouse move does not.
      if (!warningRef.current) lastActivityRef.current = Date.now()
    }
    for (const eventName of ACTIVITY_EVENTS) window.addEventListener(eventName, markActive, { passive: true })

    let signingOut = false
    const intervalId = window.setInterval(() => {
      // Measuring elapsed time (instead of trusting timers) stays correct when the tab sleeps.
      const idleFor = Date.now() - lastActivityRef.current
      if (idleFor >= IDLE_LIMIT_MS) {
        if (signingOut) return
        signingOut = true
        window.clearInterval(intervalId)
        try {
          sessionStorage.setItem(IDLE_SIGN_OUT_KEY, '1')
        } catch {
          // Without storage the admin is still signed out; only the explanation is lost.
        }
        logout().catch(() => navigate('/admin/login', { replace: true }))
        return
      }
      if (idleFor >= IDLE_LIMIT_MS - WARNING_MS) {
        warningRef.current = true
        setSecondsLeft(Math.ceil((IDLE_LIMIT_MS - idleFor) / 1000))
      } else if (warningRef.current) {
        warningRef.current = false
        setSecondsLeft(null)
      }
    }, CHECK_EVERY_MS)

    return () => {
      window.clearInterval(intervalId)
      for (const eventName of ACTIVITY_EVENTS) window.removeEventListener(eventName, markActive)
    }
  }, [logout, navigate])

  const isWarning = secondsLeft !== null
  useEffect(() => {
    if (isWarning) stayButtonRef.current?.focus()
  }, [isWarning])

  function staySignedIn() {
    warningRef.current = false
    lastActivityRef.current = Date.now()
    setSecondsLeft(null)
  }

  if (secondsLeft === null) return null

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center px-4" role="presentation">
      <div className="admin-drawer-backdrop absolute inset-0 bg-[#0b1e36]/55 backdrop-blur-[3px]" />
      <section
        aria-describedby="idle-warning-text"
        aria-labelledby="idle-warning-title"
        aria-modal="true"
        className="admin-modal-panel relative w-full max-w-sm rounded-md bg-white p-6 text-center shadow-[0_30px_80px_rgba(9,42,83,0.35)]"
        role="alertdialog"
      >
        <span className="mx-auto grid size-12 place-items-center rounded-md bg-[#fff6d6] text-lg font-semibold tabular-nums text-[#8a6d00]">
          {secondsLeft}
        </span>
        <h2 className="mt-4 text-base font-semibold text-[#472a3b]" id="idle-warning-title">{t('Are you still there?')}</h2>
        <p className="mt-2 text-sm leading-6 text-[#65748a]" id="idle-warning-text">
          {t('For your security, you will be signed out in {seconds} seconds because the dashboard has been inactive.', { seconds: secondsLeft })}
        </p>
        <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
          <button
            className="min-h-10 rounded-md px-4 text-sm font-bold text-[#65748a] ring-1 ring-[#dce3eb] transition hover:bg-[#f4f6f8] hover:text-[#472a3b]"
            onClick={() => { lastActivityRef.current = 1 }}
            type="button"
          >
            {t('Sign out now')}
          </button>
          <button
            className="min-h-10 rounded-md bg-[#472a3b] px-4 text-sm font-bold text-white transition hover:bg-[#6b3f58] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b8721e]"
            onClick={staySignedIn}
            ref={stayButtonRef}
            type="button"
          >
            {t('Stay signed in')}
          </button>
        </div>
      </section>
    </div>
  )
}
