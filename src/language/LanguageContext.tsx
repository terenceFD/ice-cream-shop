import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { LanguageContext } from './useLanguage'

import { getFrenchDictionary, initialLanguage, LANGUAGE_STORAGE_KEY, loadFrenchDictionary, type Language } from './languageLoader'

export interface LanguageContextValue {
  language: Language
  setLanguage: Dispatch<SetStateAction<Language>>
  t: (key: string, variables?: Record<string, string | number>) => string
}



export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(initialLanguage)
  // French text arrives on demand; main.tsx preloads it before the first render for French readers.
  const [french, setFrench] = useState(getFrenchDictionary)

  useEffect(() => {
    if (language !== 'fr' || french) return
    let cancelled = false
    loadFrenchDictionary()
      .then((dictionary) => { if (!cancelled) setFrench(dictionary) })
      .catch((error) => console.error('Unable to load the French translations.', error))
    return () => { cancelled = true }
  }, [language, french])

  useEffect(() => {
    document.documentElement.lang = language
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
    } catch (error) {
      console.error('Unable to save the language preference.', error)
    }
  }, [language])

  const value = useMemo(() => ({
    language,
    setLanguage,
    t(key: string, variables: Record<string, string | number> = {}) {
      let result = language === 'fr' ? french?.[key] || key : key
      for (const [name, replacement] of Object.entries(variables)) {
        result = result.replaceAll(`{${name}}`, String(replacement))
      }
      return result
    },
  }), [language, french])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}
