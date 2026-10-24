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
    t('Opens straight from your home screen'),
    t('Loads faster and works offline for browsing'),
    t('Track your orders in one tap'),
  ]

  return (
    <section
      aria-labelledby="install-app-title"
      className="install-app-card fixed inset-x-3 bottom-3 z-[55] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[24rem]"
      role="dialog"
    >
      <div className="relative overflow-hidden rounded-[24px] bg-[#0d3566] text-white shadow-[0_24px_60px_rgba(0,0,0,0.45)] ring-1 ring-white/25">
        <div aria-hidden="true" className="h-1 bg-gradient-to-r from-[#ffdc32] via-[#ffe98a] to-[#ffdc32]" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-16 size-44 rounded-full bg-[#ffdc32]/15 blur-2xl" />
        <button
          aria-label={t('Close')}
          className="absolute right-3 top-4 z-10 grid size-8 place-items-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-[#ffdc32]"
          onClick={dismiss}
          type="button"
        >
          <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
          </svg>
        </button>

        <div className="relative p-5 sm:p-6">
          <div className="flex items-center gap-3.5 pr-8">
            <img decoding="async" loading="lazy" alt="" className="size-14 shrink-0 rounded-2xl shadow-[0_8px_20px_rgba(0,0,0,0.3)] ring-1 ring-white/15" height={56} src="/icons/icon-192.png" width={56} />
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#ffdc32]">{t('Free app')}</p>
              <h2 className="mt-0.5 font-display text-lg font-extrabold leading-tight" id="install-app-title">
                {t('Install the Cold Stone Creamery app')}
              </h2>
            </div>
          </div>

          {mode === 'install' ? (
            <>
              <ul className="mt-4 space-y-2">
                {benefits.map((benefit) => (
                  <li className="flex items-center gap-2.5 text-[13px] text-white/80" key={benefit}>
                    <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center rounded-full bg-[#ffdc32] text-[#092a53]">
                      <svg className="size-3" fill="none" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" /></svg>
                    </span>
                    {benefit}
                  </li>
                ))}
              </ul>
              <div className="mt-5 grid grid-cols-[auto_1fr] gap-2.5">
                <button
                  className="min-h-11 rounded-xl px-4 text-sm font-bold text-white/80 ring-1 ring-white/20 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffdc32]"
                  onClick={dismiss}
                  type="button"
                >
                  {t('Not now')}
                </button>
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#ffdc32] px-4 text-sm font-extrabold text-[#092a53] shadow-[0_8px_20px_rgba(255,220,50,0.25)] transition hover:bg-[#ffe55c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-70"
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
              <p className="mt-4 text-[13px] leading-5 text-white/75">{t('Add it to your home screen in two quick steps:')}</p>
              <ol className="mt-3 space-y-2.5">
                <li className="flex items-center gap-3 rounded-xl bg-white/[0.07] px-3 py-2.5 text-[13px]">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#ffdc32] text-xs font-extrabold text-[#092a53]">1</span>
                  <span>{t('Tap the Share button')} <span className="text-[#ffdc32]"><ShareIcon /></span> {t('in your browser')}</span>
                </li>
                <li className="flex items-center gap-3 rounded-xl bg-white/[0.07] px-3 py-2.5 text-[13px]">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#ffdc32] text-xs font-extrabold text-[#092a53]">2</span>
                  <span>{t('Choose')} <strong className="font-extrabold">{t('Add to Home Screen')}</strong></span>
                </li>
              </ol>
              <button
                className="mt-4 min-h-11 w-full rounded-xl bg-[#ffdc32] px-4 text-sm font-extrabold text-[#092a53] transition hover:bg-[#ffe55c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
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
