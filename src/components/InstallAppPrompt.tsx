import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useLanguage } from '../language/useLanguage'
import {
  APP_INSTALLED_EVENT,
  clearInstallPrompt,
  getInstallPrompt,
  INSTALL_AVAILABLE_EVENT,
  isAppleMobileDevice,
  isRunningAsInstalledApp,
} from '../lib/installPrompt'

// Shown at most once per browser session, so revisits within a visit never nag.
const SHOWN_THIS_SESSION_KEY = 'cold-stone-install-shown-this-session'
// Announced so the floating currency switcher can step aside while this card is open.
const INSTALL_CARD_EVENT = 'cold-stone-install-card'
// Long enough that the cookie banner (3s) has been seen — or answered — first, so
// the two never stack in the same corner and compete for the visitor's attention.
const SHOW_AFTER_MS = 8000
// Pages where a purchase or admin work is in progress are never interrupted.
const QUIET_PATHS = ['/admin', '/checkout', '/payment']

type Mode = 'install' | 'ios'

let hasShownThisRuntime = false

// One show per session, no matter how the card is closed or the site reloaded.
function shownThisSession() {
  if (hasShownThisRuntime) return true
  try {
    return sessionStorage.getItem(SHOWN_THIS_SESSION_KEY) === '1'
  } catch {
    return false
  }
}

function markShownThisSession() {
  hasShownThisRuntime = true
  try {
    sessionStorage.setItem(SHOWN_THIS_SESSION_KEY, '1')
  } catch {
    // The in-memory guard still prevents duplicate prompts until the page reloads.
  }
}

function ShareIcon() {
  return (
    <svg aria-hidden="true" className="inline size-4 align-[-3px]" fill="none" viewBox="0 0 24 24">
      <path d="M12 15V3m0 0L8 7m4-4 4 4M7 10H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  )
}

// Invites visitors to add the site to their home screen when it opens: the browser's own install
// dialog on Chrome, Edge and Android, and step-by-step instructions on iPhone and iPad.
export function InstallAppPrompt() {
  const { t } = useLanguage()
  const location = useLocation()
  const [mode, setMode] = useState<Mode | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [isInstalling, setIsInstalling] = useState(false)

  useEffect(() => {
    if (isRunningAsInstalledApp() || shownThisSession()) return undefined
    let timer = 0
    let settled = false
    // StrictMode runs this effect twice in development (mount, unmount, mount again). Without
    // this, the first timer is cleared on the remount while the old callback still fires.
    let cancelled = false
    function offerInstall(nextMode: Mode) {
      if (settled) return
      settled = true
      setMode(nextMode)
      window.clearTimeout(timer)
      timer = window.setTimeout(showCard, SHOW_AFTER_MS)
    }
    // The card counts as shown only when it is actually on screen. Marking it here, not when
    // the timer is scheduled, means a reload within the delay still gets its one invitation.
    function showCard() {
      if (cancelled) return
      markShownThisSession()
      setIsVisible(true)
    }

    if (getInstallPrompt()) offerInstall('install')
    else if (isAppleMobileDevice()) offerInstall('ios')
    const onAvailable = () => offerInstall('install')
    const onInstalled = () => {
      setIsVisible(false)
      setMode(null)
      window.dispatchEvent(new CustomEvent(INSTALL_CARD_EVENT, { detail: false }))
    }
    window.addEventListener(INSTALL_AVAILABLE_EVENT, onAvailable)
    window.addEventListener(APP_INSTALLED_EVENT, onInstalled)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      window.removeEventListener(INSTALL_AVAILABLE_EVENT, onAvailable)
      window.removeEventListener(APP_INSTALLED_EVENT, onInstalled)
    }
  }, [])

  function dismiss() {
    setIsVisible(false)
    window.dispatchEvent(new CustomEvent(INSTALL_CARD_EVENT, { detail: false }))
  }

  async function install() {
    const installPrompt = getInstallPrompt()
    if (!installPrompt) return
    setIsInstalling(true)
    try {
      await installPrompt.prompt()
      const { outcome } = await installPrompt.userChoice
      // The browser allows the dialog only once per signal.
      clearInstallPrompt()
      if (outcome === 'accepted') setIsVisible(false)
      else dismiss()
    } finally {
      setIsInstalling(false)
    }
  }

  // Tell the floating currency switcher to step aside for as long as this card is up.
  // Done in an effect, not during render: dispatching an event while rendering would
  // set state mid-render and React would warn (or loop).
  useEffect(() => {
    const shownIsVisible =
      Boolean(mode) &&
      isVisible &&
      !QUIET_PATHS.some((path) => location.pathname.startsWith(path))
    window.dispatchEvent(new CustomEvent(INSTALL_CARD_EVENT, { detail: shownIsVisible }))
  }, [mode, isVisible, location.pathname])

  if (!mode || !isVisible || QUIET_PATHS.some((path) => location.pathname.startsWith(path))) return null

  const benefits = [
    t('Open the menu from your home screen'),
    t('Browse the menu when you are offline'),
    t('Check your orders in one tap'),
  ]

  return (
    // Above the currency switcher (z-75) and the cookie banner (z-70): this card is a
    // one-off invitation, and it must not hide the price control or the consent
    // question while it is on screen.
    <section
      aria-labelledby="install-app-title"
      // The description is hidden on a phone, so it is only referenced when it is rendered.
      aria-describedby={mode === 'ios' ? 'install-app-description' : undefined}
      // On a phone the card is a compact sheet in the corner, not a full-width panel:
      // it must never cover the page or the currency switcher beside it. It sits below
      // the switcher (z-85) so the price control stays on top and reachable.
      className="install-app-card fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] right-3 z-[80] max-h-[calc(100dvh-2rem)] w-[min(21rem,calc(100vw-1.5rem))] overflow-y-auto overscroll-contain sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:right-[10rem] sm:w-[25rem]"
      role="dialog"
    >
      <div className="install-app-shell relative overflow-hidden rounded-[28px] bg-[linear-gradient(158deg,#5a3352_0%,#472a3b_46%,#341d2b_100%)] text-white shadow-[0_28px_70px_-12px_rgba(52,29,43,0.7)] ring-1 ring-white/10">
        {/* Two soft lights: a gold glow behind the icon and a plum wash at the foot, so the
            panel does not read as a flat rectangle. */}
        <span aria-hidden="true" className="pointer-events-none absolute -left-16 -top-20 size-56 rounded-full bg-[radial-gradient(circle,rgba(255,184,77,0.42),transparent_68%)] blur-[2px]" />
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-24 -right-10 size-52 rounded-full bg-[radial-gradient(circle,rgba(255,207,133,0.22),transparent_70%)]" />
        {/* A thin gold hairline along the top edge catches the eye first. */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,184,77,0.9),transparent)]" />

        <div className="relative px-4 pb-4 pt-4 sm:px-6 sm:pb-6 sm:pt-5">
          <button
            aria-label={t('Close')}
            className="absolute right-2.5 top-2.5 grid size-11 place-items-center rounded-full text-white/55 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow"
            onClick={dismiss}
            type="button"
          >
            <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
            </svg>
          </button>

          {/* The app icon floats on its own gold plinth. */}
          <div className="flex items-center gap-3 pr-10 sm:gap-4">
            <span className="install-app-icon relative grid size-11 shrink-0 place-items-center rounded-[14px] bg-[linear-gradient(150deg,#ffcf85,#ffb84d)] shadow-[0_12px_28px_-6px_rgba(255,184,77,0.75)] sm:size-14 sm:rounded-[18px]">
              <img decoding="async" loading="lazy" alt="" className="size-9 rounded-[10px] sm:size-11 sm:rounded-[13px]" height={44} src="/icons/icon-192.png" width={44} />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-brand-yellow">{t('Free · No download')}</p>
              <h2 className="mt-0.5 font-display text-[17px] font-extrabold leading-tight text-white sm:mt-1 sm:text-[20px]" id="install-app-title">
                {t('Cold Stone, one tap away')}
              </h2>
            </div>
          </div>

          {mode === 'install' ? (
            <>
              {/* On a phone the card is the title and the button only. The button opens
                  the browser's own install dialog, which explains the rest, so the
                  description and the benefit list are kept for wider screens where the
                  card has room. This keeps the phone card to about a quarter of the
                  screen instead of half of it. */}
              <p className="mt-3 hidden text-[14px] leading-6 text-white/70 sm:block" id="install-app-description" aria-hidden="true">
                {t('Install for quick access to the menu and your orders.')}
              </p>
              <ul className="mt-4 hidden gap-2 sm:grid">
                {benefits.map((benefit) => (
                  <li
                    className="flex items-center gap-3 rounded-xl bg-white/[0.06] px-3 py-2.5 text-[14px] leading-5 text-white/90 ring-1 ring-white/[0.07]"
                    key={benefit}
                  >
                    <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-yellow/15 text-brand-yellow">
                      <svg className="size-3.5" fill="none" viewBox="0 0 24 24">
                        <path d="m5 12.5 4.5 4.5L19 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
                      </svg>
                    </span>
                    {benefit}
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-center gap-2 sm:mt-5">
                <button
                  className="min-h-11 shrink-0 rounded-full px-4 text-sm font-bold text-white/55 transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow"
                  onClick={dismiss}
                  type="button"
                >
                  {t('Not now')}
                </button>
                <button
                  className="install-app-cta inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#ffcf85,#ffb84d)] px-5 text-sm font-extrabold text-[#3b2113] shadow-[0_10px_26px_-6px_rgba(255,184,77,0.8)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60"
                  disabled={isInstalling}
                  onClick={install}
                  type="button"
                >
                  <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
                    <path d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" />
                  </svg>
                  {isInstalling ? t('Installing…') : t('Install app')}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* iPhone has no install dialog, so the two steps are the whole instruction
                  and stay on every screen. They are tightened on a phone so the card
                  still fits in the corner. */}
              <p className="mt-2.5 text-[13px] leading-5 text-white/70 sm:mt-4 sm:text-[14px] sm:leading-6" id="install-app-description">
                {t('Add the site to your home screen in two quick steps.')}
              </p>
              <ol className="mt-2.5 grid gap-1.5 sm:mt-4 sm:gap-2">
                <li className="flex items-center gap-2.5 rounded-xl bg-white/[0.06] px-2.5 py-2 text-[13px] leading-5 text-white/90 ring-1 ring-white/[0.07] sm:gap-3 sm:px-3 sm:py-3 sm:text-[14px]">
                  <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-[linear-gradient(150deg,#ffcf85,#ffb84d)] font-display text-[11px] font-extrabold text-[#3b2113] sm:size-7 sm:text-xs">1</span>
                  <span>{t('Tap the Share button')} <span className="text-brand-yellow"><ShareIcon /></span> {t('in your browser')}</span>
                </li>
                <li className="flex items-center gap-2.5 rounded-xl bg-white/[0.06] px-2.5 py-2 text-[13px] leading-5 text-white/90 ring-1 ring-white/[0.07] sm:gap-3 sm:px-3 sm:py-3 sm:text-[14px]">
                  <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-[linear-gradient(150deg,#ffcf85,#ffb84d)] font-display text-[11px] font-extrabold text-[#3b2113] sm:size-7 sm:text-xs">2</span>
                  <span>{t('Choose')} <strong className="font-extrabold text-white">{t('Add to Home Screen')}</strong></span>
                </li>
              </ol>
              <button
                className="install-app-cta mt-3 min-h-11 w-full rounded-full bg-[linear-gradient(135deg,#ffcf85,#ffb84d)] px-4 text-sm font-extrabold text-[#3b2113] shadow-[0_10px_26px_-6px_rgba(255,184,77,0.8)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:mt-5 sm:min-h-12"
                onClick={dismiss}
                type="button"
              >
                {t('Got it')}
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
