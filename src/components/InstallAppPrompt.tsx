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
      <div className="overflow-hidden rounded-[20px] bg-white text-[#472a3b] shadow-[0_20px_56px_rgba(9,42,83,0.24)] ring-1 ring-[#472a3b]/10">
        <div className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
          <div className="flex min-w-0 items-center gap-3.5">
            <img decoding="async" loading="lazy" alt="" className="size-12 shrink-0 rounded-[14px] bg-[#f4f6f8]" height={48} src="/icons/icon-192.png" width={48} />
            <h2 className="font-display text-xl font-bold leading-tight text-[#472a3b]" id="install-app-title">
              {t('Cold Stone, one tap away')}
            </h2>
          </div>
          <button
            aria-label={t('Close')}
            className="grid size-9 shrink-0 place-items-center rounded-full text-[#65748a] transition-colors hover:bg-[#f4f6f8] hover:text-[#472a3b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b8721e]"
            onClick={dismiss}
            type="button"
          >
            <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
            </svg>
          </button>
        </div>

        <div className="px-5 pb-5 pt-3 sm:px-6 sm:pb-6">
          {mode === 'install' ? (
            <>
              <p className="text-sm leading-6 text-[#65748a]" id="install-app-description">
                {t('Install for quick access to the menu and your orders.')}
              </p>
              <ul className="mt-4 grid gap-2.5">
                {benefits.map((benefit) => (
                  <li className="flex items-center gap-2.5 text-sm leading-5 text-[#344b66]" key={benefit}>
                    <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center rounded-full bg-[#fff4b8] text-[#472a3b]">
                      <svg className="size-3" fill="none" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" /></svg>
                    </span>
                    {benefit}
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex items-center justify-end gap-3">
                <button
                  className="min-h-11 rounded-lg px-4 text-sm font-bold text-[#65748a] transition-colors hover:bg-[#f4f6f8] hover:text-[#472a3b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b8721e]"
                  onClick={dismiss}
                  type="button"
                >
                  {t('Not now')}
                </button>
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#ffb84d] px-5 text-sm font-extrabold text-[#472a3b] transition-colors hover:bg-[#ffcf85] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#472a3b] disabled:opacity-70"
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
              <p className="text-sm leading-6 text-[#65748a]" id="install-app-description">
                {t('Add the site to your home screen in two quick steps.')}
              </p>
              <ol className="mt-4 grid gap-3 text-sm leading-5 text-[#344b66]">
                <li className="flex items-center gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#fff4b8] text-sm font-bold text-[#472a3b]">1</span>
                  <span>{t('Tap the Share button')} <span className="text-[#472a3b]"><ShareIcon /></span> {t('in your browser')}</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#fff4b8] text-sm font-bold text-[#472a3b]">2</span>
                  <span>{t('Choose')} <strong className="font-extrabold">{t('Add to Home Screen')}</strong></span>
                </li>
              </ol>
              <button
                className="mt-5 min-h-11 w-full rounded-lg bg-[#ffb84d] px-4 text-sm font-extrabold text-[#472a3b] transition-colors hover:bg-[#ffcf85] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#472a3b]"
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
