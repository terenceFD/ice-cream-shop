// Captures the browser's "this site can be installed" signal. Chrome, Edge and Android fire
// beforeinstallprompt very early, often before React renders, so it is caught here at start-up
// and kept until the install card asks for it.
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export const INSTALL_AVAILABLE_EVENT = 'cold-stone-install-available'
export const APP_INSTALLED_EVENT = 'cold-stone-app-installed'

let deferredPrompt: BeforeInstallPromptEvent | null = null

window.addEventListener('beforeinstallprompt', (event) => {
  // Stop the browser's own mini-infobar; the site shows its own install card instead.
  event.preventDefault()
  deferredPrompt = event as BeforeInstallPromptEvent
  window.dispatchEvent(new Event(INSTALL_AVAILABLE_EVENT))
})

window.addEventListener('appinstalled', () => {
  deferredPrompt = null
  window.dispatchEvent(new Event(APP_INSTALLED_EVENT))
})

export function getInstallPrompt() {
  return deferredPrompt
}

export function clearInstallPrompt() {
  deferredPrompt = null
}

export function isRunningAsInstalledApp() {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

// iPhone and iPad browsers have no install dialog; visitors add the site from the Share menu.
export function isAppleMobileDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}
