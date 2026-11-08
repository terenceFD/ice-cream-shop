export const LANGUAGE_STORAGE_KEY = 'cold-stone-language'
export type Language = 'en' | 'fr'

let frenchDictionary: Record<string, string> | null = null
let frenchDictionaryRequest: Promise<Record<string, string>> | null = null

/** The French dictionary if it has already been downloaded. */
export function getFrenchDictionary() {
  return frenchDictionary
}

/** Downloads the French dictionary once; concurrent callers share the same request. */
export function loadFrenchDictionary() {
  frenchDictionaryRequest ??= import('./french')
    .then(({ default: dictionary }) => {
      frenchDictionary = dictionary
      return dictionary
    })
    .catch((error: unknown) => {
      frenchDictionaryRequest = null
      throw error
    })
  return frenchDictionaryRequest
}

/** French pages are the addresses under /fr. Every other address stays as it was. */
export function languageUrl(next: Language): string | null {
  const path = window.location.pathname
  const onFrench = path === '/fr' || path.startsWith('/fr/')
  const bare = onFrench ? (path.slice(3) || '/') : path
  const suffix = `${window.location.search}${window.location.hash}`
  if (next === 'fr' && !onFrench) return `/fr${bare === '/' ? '' : bare}${suffix}`
  if (next === 'en' && onFrench) return `${bare}${suffix}`
  return null
}

/** English on every load. A /fr address is the French page, so that address stays French. */
export function initialLanguage(): Language {
  try {
    const path = window.location.pathname
    if (path === '/fr' || path.startsWith('/fr/')) return 'fr'
  } catch (error) {
    console.error('Unable to read the page address for the language.', error)
  }
  return 'en'
}
