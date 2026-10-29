import { useLanguage } from '../language/useLanguage'

// Consent checkbox used on every form that collects personal information.
// The submit button of the form that renders it must be disabled until the
// visitor checks the box — that is what makes it real consent, not a
// pre-ticked assumption.
export function ConsentCheckbox({ checked, onToggle, error }: {
  checked: boolean
  error?: string
  onToggle: (checked: boolean) => void
}) {
  const { t } = useLanguage()

  return (
    <div>
      <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-[#44526a]">
        <input
          checked={checked}
          className="mt-1 size-5 shrink-0 rounded border-[#dce3eb] text-brand-navy accent-[#472a3b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2"
          onChange={(event) => onToggle(event.target.checked)}
          required
          type="checkbox"
        />
        <span>
          {t('I agree that my details may be used to handle this request, as described in the')}{' '}
          <a
            className="font-semibold text-brand-navy underline decoration-2 underline-offset-2 hover:text-brand-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2"
            href="/privacy"
            target="_blank"
            rel="noreferrer"
          >
            {t('privacy policy')}
          </a>
          {'.'}
        </span>
      </label>
      {error && (
        <p className="mt-1.5 text-sm font-semibold text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
