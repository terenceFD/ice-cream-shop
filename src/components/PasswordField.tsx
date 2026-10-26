import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { useLanguage } from '../language/useLanguage'

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string
  labelClassName?: string
  variant?: 'default' | 'modern' | 'plain'
  children?: ReactNode
}

export function PasswordField({ label, labelClassName, variant = 'default', children, ...inputProps }: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false)
  const labelId = useId()
  const { t } = useLanguage()

  if (variant === 'plain') {
    return (
      <label className="block">
        <span className={labelClassName ?? 'text-sm font-bold text-brand-navy'}>{label}</span>
        <span className="relative mt-2 flex items-center bg-[#f4f6f8] focus-within:ring-2 focus-within:ring-brand-navy">
          <input
            {...inputProps}
            className="w-full bg-transparent py-3.5 pl-4 pr-14 text-sm font-semibold text-brand-navy outline-none placeholder:font-normal placeholder:text-[#8b97a8]"
            type={isVisible ? 'text' : 'password'}
          />
          <button
            aria-label={`${t(isVisible ? 'Hide' : 'Show')} ${label.toLowerCase()}`}
            aria-pressed={isVisible}
            className="absolute right-1 grid size-10 place-items-center text-[#65748a] transition hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
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

  if (variant === 'modern') {
    return (
      <div>
        <span className={labelClassName ?? 'text-sm font-bold text-brand-navy'} id={labelId}>{label}</span>
        <span className="relative mt-2 flex items-center">
          <input
            {...inputProps}
            aria-labelledby={labelId}
            className="min-h-12 w-full rounded-lg border border-[#dce3eb] bg-white px-4 pr-16 text-sm font-semibold text-brand-navy outline-none! placeholder:font-normal placeholder:text-[#65748a] focus:border-brand-navy"
            type={isVisible ? 'text' : 'password'}
          />
          <button
            aria-label={`${t(isVisible ? 'Hide' : 'Show')} ${label.toLowerCase()}`}
            aria-pressed={isVisible}
            className="absolute right-2 text-sm font-bold text-[#65748a] outline-none! hover:text-brand-navy focus-visible:outline-2! focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
            onClick={() => setIsVisible((visible) => !visible)}
            type="button"
          >
            {isVisible ? t('Hide') : t('Show')}
          </button>
        </span>
        {children}
      </div>
    )
  }

  return (
    <label className="block text-sm font-semibold text-[#65748a]">
      {label}
      <span className="relative mt-1.5 block">
        <input
          {...inputProps}
          className="w-full rounded-xl border border-[#d9d6cc] bg-[#fbfaf5] px-4 py-3 pr-16 font-normal outline-none transition focus:border-brand-yellow-deep focus:ring-2 focus:ring-brand-yellow/40"
          type={isVisible ? 'text' : 'password'}
        />
        <button
          aria-label={`${t(isVisible ? 'Hide' : 'Show')} ${label.toLowerCase()}`}
          aria-pressed={isVisible}
          className="absolute inset-y-0 right-3 my-auto h-fit rounded px-1 py-1 text-xs font-bold text-[#65748a] transition hover:text-brand-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow-deep"
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
