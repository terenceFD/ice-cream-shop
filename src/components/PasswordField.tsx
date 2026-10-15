import { useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { useLanguage } from '../language/useLanguage'

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string
  variant?: 'default' | 'modern'
  children?: ReactNode
}

export function PasswordField({ label, variant = 'default', children, ...inputProps }: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false)
  const { t } = useLanguage()

  if (variant === 'modern') {
    return (
      <label className="block">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#52647b]">{label}</span>
        <span className="group relative mt-2 flex items-center rounded-2xl bg-white ring-1 ring-[#e5e1d7] transition hover:ring-[#d6cfbd] focus-within:ring-[#c9b24a]">
          <svg aria-hidden="true" className="pointer-events-none absolute left-4 size-[18px] text-[#65748a] transition group-focus-within:text-[#092a53]" fill="none" viewBox="0 0 24 24">
            <rect height="10" rx="2.5" stroke="currentColor" strokeWidth="1.8" width="16" x="4" y="10" />
            <path d="M8 10V7.5a4 4 0 0 1 8 0V10" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          </svg>
          <input
            {...inputProps}
            className="w-full rounded-2xl bg-transparent py-3.5 pl-12 pr-14 text-sm font-semibold text-[#092a53] outline-none! placeholder:font-normal placeholder:text-[#a5aebb]"
            type={isVisible ? 'text' : 'password'}
          />
          <button
            aria-label={`${t(isVisible ? 'Hide' : 'Show')} ${label.toLowerCase()}`}
            aria-pressed={isVisible}
            className="absolute right-2 grid size-10 place-items-center rounded-xl text-[#65748a] transition hover:bg-[#fbf6e3] hover:text-[#092a53] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9b24a]"
            onClick={() => setIsVisible((visible) => !visible)}
            type="button"
          >
            <svg aria-hidden="true" className="size-[18px]" fill="none" viewBox="0 0 24 24">
              <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
              <circle cx="12" cy="12" r="2.8" stroke="currentColor" strokeWidth="1.8" />
              {isVisible && <path d="M4 20 20 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />}
            </svg>
          </button>
        </span>
        {children}
      </label>
    )
  }

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
      {children}
    </label>
  )
}
