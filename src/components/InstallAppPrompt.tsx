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
const SHOW_AFTER_MS = 2500
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
    function offerInstall(nextMode: Mode) {
      if (settled) return
      settled = true
      setMode(nextMode)
      window.clearTimeout(timer)
      markShownThisSession()
      timer = window.setTimeout(() => setIsVisible(true), SHOW_AFTER_MS)
    }
    if (getInstallPrompt()) offerInstall('install')
    else if (isAppleMobileDevice()) offerInstall('ios')
    const onAvailable = () => offerInstall('install')
    const onInstalled = () => { setIsVisible(false); setMode(null) }
    window.addEventListener(INSTALL_AVAILABLE_EVENT, onAvailable)
    window.addEventListener(APP_INSTALLED_EVENT, onInstalled)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener(INSTALL_AVAILABLE_EVENT, onAvailable)
      window.removeEventListener(APP_INSTALLED_EVENT, onInstalled)
    }
  }, [])

  function dismiss() {
    setIsVisible(false)
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

  if (!mode || !isVisible || QUIET_PATHS.some((path) => location.pathname.startsWith(path))) return null

  const benefits = [
    t('Open the menu from your home screen'),
    t('Browse the menu when you are offline'),
    t('Check your orders in one tap'),
  ]

  return (
    <section
      aria-labelledby="install-app-title"
      aria-describedby="install-app-description"
      className="install-app-card fixed inset-x-3 bottom-3 z-[55] max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[26rem]"
      role="dialog"
    >
      <div className="overflow-hidden rounded-2xl bg-white text-brand-navy shadow-[0_20px_56px_rgba(9,42,83,0.24)] ring-1 ring-brand-navy/10">
        <div className="flex items-center justify-between gap-4 bg-[#f6f8fb] px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3.5">
            <img decoding="async" loading="lazy" alt="" className="size-11 shrink-0 rounded-[12px] bg-white shadow-[0_1px_3px_rgba(9,42,83,0.12)]" height={44} src="/icons/icon-192.png" width={44} />
            <h2 className="min-w-0 font-display text-lg font-extrabold leading-tight text-brand-navy" id="install-app-title">
              {t('Cold Stone, one tap away')}
            </h2>
          </div>
          <button
            aria-label={t('Close')}
            className="grid size-9 shrink-0 place-items-center rounded-full text-[#65748a] transition-colors hover:bg-white hover:text-brand-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow-deep"
            onClick={dismiss}
            type="button"
          >
            <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
            </svg>
          </button>
        </div>

        <div className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
          {mode === 'install' ? (
            <>
              <p className="text-[15px] leading-6 text-[#344b66]" id="install-app-description">
                {t('Install for quick access to the menu and your orders.')}
              </p>
              <ul className="mt-4 grid gap-2.5">
                {benefits.map((benefit) => (
                  <li className="flex items-center gap-3 text-[15px] leading-6 text-brand-navy" key={benefit}>
                    <svg aria-hidden="true" className="size-[18px] shrink-0 text-brand-yellow-deep" fill="none" viewBox="0 0 24 24">
                      <path d="m5 12.5 4.5 4.5L19 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" />
                    </svg>
                    {benefit}
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  className="min-h-11 rounded-full px-4 text-sm font-bold text-[#65748a] transition-colors hover:bg-[#f4f6f8] hover:text-brand-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow-deep"
                  onClick={dismiss}
                  type="button"
                >
                  {t('Not now')}
                </button>
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand-yellow px-6 text-sm font-extrabold text-brand-navy transition hover:bg-brand-gold-light hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy disabled:translate-y-0 disabled:opacity-70"
                  disabled={isInstalling}
                  onClick={install}
                  type="button"
                >
                  <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
                    <path d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
                  </svg>
                  {t('Install app')}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-[15px] leading-6 text-[#344b66]" id="install-app-description">
                {t('Add the site to your home screen in two quick steps.')}
              </p>
              <ol className="mt-4 grid gap-3 text-[15px] leading-6 text-brand-navy">
                <li className="flex items-center gap-3">
                  <span aria-hidden="true" className="font-display text-lg font-extrabold text-brand-yellow-deep">1.</span>
                  <span>{t('Tap the Share button')} <span className="text-brand-navy"><ShareIcon /></span> {t('in your browser')}</span>
                </li>
                <li className="flex items-center gap-3">
                  <span aria-hidden="true" className="font-display text-lg font-extrabold text-brand-yellow-deep">2.</span>
                  <span>{t('Choose')} <strong className="font-extrabold">{t('Add to Home Screen')}</strong></span>
                </li>
              </ol>
              <button
                className="mt-6 min-h-11 w-full rounded-full bg-brand-yellow px-4 text-sm font-extrabold text-brand-navy transition hover:bg-brand-gold-light hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
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
