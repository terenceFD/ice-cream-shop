import { useState } from 'react'
import { useLanguage } from '../language/LanguageContext'

export function PasswordField({ label, ...inputProps }) {
  const [isVisible, setIsVisible] = useState(false)
  const { t } = useLanguage()

  return (
    <label className="block text-sm font-semibold text-[#65748a]">
      {label}
      <span className="relative mt-1.5 block">
        <input
          {...inputProps}
          className="w-full rounded-xl border border-[#d9d6cc] bg-[#f8f7f2] px-4 py-3 pr-16 font-normal outline-none transition focus:border-[#bd9c00] focus:ring-2 focus:ring-[#ffdc32]/40"
          type={isVisible ? 'text' : 'password'}
        />
        <button
          aria-label={`${t(isVisible ? 'Hide' : 'Show')} ${label.toLowerCase()}`}
          aria-pressed={isVisible}
          className="absolute inset-y-0 right-3 my-auto h-fit rounded px-1 py-1 text-xs font-bold text-[#53647b] transition hover:text-[#102c50] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00]"
          onClick={() => setIsVisible((visible) => !visible)}
          type="button"
        >
          {isVisible ? t('Hide') : t('Show')}
        </button>
      </span>
    </label>
  )
}
