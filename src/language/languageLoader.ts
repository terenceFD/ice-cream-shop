export const LANGUAGE_STORAGE_KEY = 'cold-stone-language'
export type Language = 'en' | 'fr'

let frenchDictionary: Record<string, string> | null = null

/** The French dictionary if it has already been downloaded. */
export function getFrenchDictionary() {
  return frenchDictionary
}

/** Downloads the French dictionary once; later calls reuse it. */
export async function loadFrenchDictionary() {
  frenchDictionary ??= (await import('./french')).default
  return frenchDictionary
}

/** The saved language, or French when the browser prefers it. */
export function initialLanguage(): Language {
  try {
    const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (savedLanguage === 'en' || savedLanguage === 'fr') return savedLanguage
  } catch (error) {
    console.error('Unable to read the saved language preference.', error)
  }
  return navigator.languages?.some((value) => value.toLowerCase().startsWith('fr'))
    || navigator.language?.toLowerCase().startsWith('fr')
    ? 'fr'
    : 'en'
}
