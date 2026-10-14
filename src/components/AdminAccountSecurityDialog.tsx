import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { PasswordField } from './PasswordField'
import { passwordStrength } from './passwordStrength'
import { useAdminAuth } from '../pages/feature/admin/useAdminAuth'
import { useLanguage } from '../language/useLanguage'

const MIN_LENGTH = 8
const MAX_LENGTH = 128
const PIN_LENGTH = 6
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// The server answers with this message when the PIN confirmation is missing or has expired.
const PIN_REQUIRED_MESSAGE = 'Confirm your security PIN to continue.'

export type AccountSecurityTab = 'password' | 'email'
type Stage = 'checking' | 'create-pin' | 'enter-pin' | 'forms'

const iconPaths = {
  shield: 'M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Zm-3 9 2 2 4-4',
  lock: 'M6 11h12v9H6v-9Zm2 0V8a4 4 0 0 1 8 0v3',
  mail: 'M4 6h16v12H4V6Zm0 0 8 7 8-7',
  key: 'M15 7a4 4 0 1 1-3.9 4.9L4 19v-3h3v-3h3l1.1-1.1A4 4 0 0 1 15 7Zm1 3h.01',
  check: 'm5 12 4 4L19 6',
  close: 'M6 6l12 12M18 6 6 18',
  alert: 'M12 8v5m0 3h.01M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z',
  dot: 'M12 12h.01',
  back: 'M15 6l-6 6 6 6',
}

function Icon({ path, className = 'size-4' }: { path: string; className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d={path} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  )
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function ErrorMessage({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100" role="alert">
      <Icon className="mt-0.5 size-4 shrink-0" path={iconPaths.alert} />
      {children}
    </p>
  )
}

function SuccessPanel({ title, message, onClose }: { title: string; message: ReactNode; onClose: () => void }) {
  const { t } = useLanguage()
  const doneButtonRef = useRef<HTMLButtonElement>(null)
  useEffect(() => doneButtonRef.current?.focus(), [])
  return (
    <div className="px-6 py-8 text-center sm:px-8" role="status">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#e7f6ee] text-[#1f7a46]">
        <Icon className="size-7" path={iconPaths.check} />
      </span>
      <h3 className="mt-4 font-display text-xl font-extrabold text-[#092a53]">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#65748a]">{message}</p>
      <button
        className="mt-6 inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-[#092a53] px-5 text-sm font-bold text-white transition hover:bg-[#163e6b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00]"
        onClick={onClose}
        ref={doneButtonRef}
        type="button"
      >
        {t('Done')}
      </button>
    </div>
  )
}

function FormFooter({ canSubmit, isSaving, savingLabel, submitLabel, onCancel, cancelLabel }: {
  canSubmit: boolean
  isSaving: boolean
  savingLabel: string
  submitLabel: string
  onCancel: () => void
  cancelLabel?: string
}) {
  const { t } = useLanguage()
  return (
    <footer className="flex items-center justify-end gap-3 border-t border-[#edf1f5] bg-[#fafbfd] px-6 py-4">
      <button
        className="min-h-10 rounded-xl px-4 text-sm font-bold text-[#4f6379] transition hover:bg-[#eef2f6] hover:text-[#092a53] disabled:opacity-50"
        disabled={isSaving}
        onClick={onCancel}
        type="button"
      >
        {cancelLabel || t('Cancel')}
      </button>
      <button
        className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#092a53] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#163e6b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!canSubmit}
        type="submit"
      >
        {isSaving && <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white border-r-transparent" />}
        {isSaving ? savingLabel : submitLabel}
      </button>
    </footer>
  )
}

// Six single-digit boxes that behave like one field: typing advances, Backspace steps back, and a pasted PIN fills every box.
function PinInput({ value, onChange, label, disabled = false, invalid = false, shakeKey = 0 }: {
  value: string
  onChange: (value: string) => void
  label: string
  disabled?: boolean
  invalid?: boolean
  shakeKey?: number
}) {
  const { t } = useLanguage()
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (!disabled) inputsRef.current[Math.min(value.length, PIN_LENGTH - 1)]?.focus()
    // Only refocus when the field is reset or re-enabled, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, shakeKey])

  function setDigit(index: number, digit: string) {
    const digits = value.padEnd(PIN_LENGTH, ' ').split('')
    digits[index] = digit
    const next = digits.join('').replace(/\s+$/, '')
    onChange(next.replace(/\s/g, ''))
  }

  function handleInput(index: number, raw: string) {
    let digits = raw.replace(/\D/g, '')
    // Typing into a box that already holds a digit delivers both; keep the new one.
    if (digits.length === 2 && value[index]) digits = digits.replace(value[index], '') || value[index]
    if (!digits) return
    if (digits.length > 1) {
      const next = (value.slice(0, index) + digits).slice(0, PIN_LENGTH)
      onChange(next)
      inputsRef.current[Math.min(next.length, PIN_LENGTH - 1)]?.focus()
      return
    }
    setDigit(index, digits)
    inputsRef.current[index + 1]?.focus()
  }

  function handleKeyDown(index: number, event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace') {
      event.preventDefault()
      if (value[index]) {
        onChange(value.slice(0, index) + value.slice(index + 1))
      } else if (index > 0) {
        onChange(value.slice(0, index - 1) + value.slice(index))
        inputsRef.current[index - 1]?.focus()
      }
    } else if (event.key === 'ArrowLeft' && index > 0) {
      inputsRef.current[index - 1]?.focus()
    } else if (event.key === 'ArrowRight' && index < PIN_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus()
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault()
    const digits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, PIN_LENGTH)
    if (!digits) return
    onChange(digits)
    inputsRef.current[Math.min(digits.length, PIN_LENGTH - 1)]?.focus()
  }

  return (
    <fieldset>
      <legend className="sr-only">{label}</legend>
      <div className={`mx-auto grid max-w-[22rem] grid-cols-6 gap-2 sm:gap-2.5 ${invalid ? 'admin-pin-shake' : ''}`} key={shakeKey}>
        {Array.from({ length: PIN_LENGTH }, (_, index) => {
          const filled = Boolean(value[index])
          return (
            <input
              aria-label={t('Digit {number} of {total}', { number: index + 1, total: PIN_LENGTH })}
              autoComplete="one-time-code"
              className={`h-12 w-full min-w-0 rounded-xl border-2 bg-[#f8f9fb] text-center font-display text-xl font-extrabold text-[#092a53] outline-none transition sm:h-13 ${
                invalid
                  ? 'border-[#e5a29c] bg-red-50'
                  : filled
                    ? 'border-[#092a53] bg-white'
                    : 'border-[#dfe5ec] focus:border-[#bd9c00] focus:bg-white focus:ring-4 focus:ring-[#ffdc32]/30'
              } disabled:opacity-60`}
              disabled={disabled}
              inputMode="numeric"
              key={index}
              maxLength={PIN_LENGTH}
              onChange={(event) => handleInput(index, event.target.value)}
              onFocus={(event) => event.target.select()}
              onKeyDown={(event) => handleKeyDown(index, event)}
              onPaste={handlePaste}
              pattern="[0-9]*"
              ref={(element) => { inputsRef.current[index] = element }}
              type="password"
              value={value[index] || ''}
            />
          )
        })}
      </div>
    </fieldset>
  )
}

function CreatePinStep({ onCreated, onCancel, onBusyChange }: { onCreated: () => void; onCancel: () => void; onBusyChange: (busy: boolean) => void }) {
  const { createSecurityPin } = useAdminAuth()
  const { t } = useLanguage()
  const [step, setStep] = useState<'choose' | 'confirm'>('choose')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState('')
  const [shakeKey, setShakeKey] = useState(0)
  const [isSaving, setIsSaving] = useState(false)

  const digits = [...pin].map(Number)
  const steps = new Set(digits.slice(1).map((digit, index) => digit - digits[index]))
  const isEasilyGuessed = pin.length === PIN_LENGTH && steps.size === 1 && [0, 1, -1].includes([...steps][0])

  function fail(message: string) {
    setError(message)
    setShakeKey((key) => key + 1)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (step === 'choose') {
      if (pin.length !== PIN_LENGTH) return
      if (isEasilyGuessed) {
        fail(t('Avoid repeated or sequential digits such as 111111 or 123456.'))
        return
      }
      setStep('confirm')
      return
    }
    if (confirmPin !== pin) {
      setConfirmPin('')
      fail(t('The PINs do not match. Try again.'))
      return
    }
    setIsSaving(true)
    onBusyChange(true)
    try {
      await createSecurityPin(pin)
      onCreated()
    } catch (submitError) {
      fail(t(errorMessage(submitError, 'Unable to save your PIN.')))
    } finally {
      setIsSaving(false)
      onBusyChange(false)
    }
  }

  const value = step === 'choose' ? pin : confirmPin
  return (
    <form noValidate onSubmit={handleSubmit}>
      <div className="space-y-5 px-6 py-6">
        <div className="text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#fff6d6] text-[#a48700]">
            <Icon className="size-6" path={iconPaths.key} />
          </span>
          <p className="mt-3 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#8190a1]">
            {t('Step {step} of 2', { step: step === 'choose' ? 1 : 2 })}
          </p>
          <h3 className="mt-1 font-display text-lg font-extrabold text-[#092a53]">
            {t(step === 'choose' ? 'Create your security PIN' : 'Confirm your security PIN')}
          </h3>
          <p className="mx-auto mt-1.5 max-w-xs text-sm leading-6 text-[#65748a]">
            {t(step === 'choose'
              ? 'Choose 6 digits. You will enter this PIN every time you change your password or email.'
              : 'Enter the same 6 digits again.')}
          </p>
        </div>
        <PinInput
          disabled={isSaving}
          invalid={Boolean(error)}
          key={step}
          label={t(step === 'choose' ? 'Create your security PIN' : 'Confirm your security PIN')}
          onChange={(next) => { setError(''); if (step === 'choose') setPin(next); else setConfirmPin(next) }}
          shakeKey={shakeKey}
          value={value}
        />
        <p className="flex items-start gap-2 rounded-xl bg-[#f7f9fc] px-3.5 py-3 text-xs leading-5 text-[#65748a] ring-1 ring-[#e8edf3]">
          <Icon className="mt-0.5 size-4 shrink-0 text-[#355777]" path={iconPaths.shield} />
          {t('Keep this PIN private and different from your password. Avoid dates or repeated digits.')}
        </p>
        {error && <ErrorMessage>{error}</ErrorMessage>}
      </div>
      <FormFooter
        canSubmit={value.length === PIN_LENGTH && !isSaving}
        cancelLabel={step === 'confirm' ? t('Back') : undefined}
        isSaving={isSaving}
        onCancel={step === 'confirm' ? () => { setStep('choose'); setConfirmPin(''); setError('') } : onCancel}
        savingLabel={t('Saving PIN…')}
        submitLabel={t(step === 'choose' ? 'Continue' : 'Save PIN')}
      />
    </form>
  )
}

function EnterPinStep({ notice, onVerified, onCancel, onBusyChange }: {
  notice: string
  onVerified: (pinToken: string) => void
  onCancel: () => void
  onBusyChange: (busy: boolean) => void
}) {
  const { verifySecurityPin } = useAdminAuth()
  const { t } = useLanguage()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [shakeKey, setShakeKey] = useState(0)
  const [isVerifying, setIsVerifying] = useState(false)

  async function verify(candidate: string) {
    if (candidate.length !== PIN_LENGTH || isVerifying) return
    setError('')
    setIsVerifying(true)
    onBusyChange(true)
    try {
      const pinToken = await verifySecurityPin(candidate)
      onVerified(pinToken)
    } catch (verifyError) {
      setPin('')
      setError(t(errorMessage(verifyError, 'Unable to check your PIN.')))
      setShakeKey((key) => key + 1)
    } finally {
      setIsVerifying(false)
      onBusyChange(false)
    }
  }

  function handleChange(next: string) {
    setError('')
    setPin(next)
    // Check the PIN as soon as the last digit is typed.
    if (next.length === PIN_LENGTH) void verify(next)
  }

  return (
    <form noValidate onSubmit={(event) => { event.preventDefault(); void verify(pin) }}>
      <div className="space-y-5 px-6 py-6">
        <div className="text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#092a53] text-[#ffdc32]">
            <Icon className="size-6" path={iconPaths.lock} />
          </span>
          <h3 className="mt-3 font-display text-lg font-extrabold text-[#092a53]">{t('Enter your security PIN')}</h3>
          <p className="mx-auto mt-1.5 max-w-xs text-sm leading-6 text-[#65748a]">
            {t('Confirm it’s you before changing your sign-in details.')}
          </p>
        </div>
        {notice && (
          <p className="flex items-center justify-center gap-2 rounded-xl bg-[#e7f6ee] px-3.5 py-2.5 text-xs font-bold text-[#1f7a46]" role="status">
            <Icon className="size-4 shrink-0" path={iconPaths.check} />
            {notice}
          </p>
        )}
        <PinInput
          disabled={isVerifying}
          invalid={Boolean(error)}
          label={t('Enter your security PIN')}
          onChange={handleChange}
          shakeKey={shakeKey}
          value={pin}
        />
        <p aria-live="polite" className="min-h-5 text-center text-xs font-semibold text-[#8190a1]">
          {isVerifying && (
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="size-3.5 animate-spin rounded-full border-2 border-[#092a53] border-r-transparent" />
              {t('Checking PIN…')}
            </span>
          )}
        </p>
        {error && <ErrorMessage>{error}</ErrorMessage>}
      </div>
      <FormFooter
        canSubmit={pin.length === PIN_LENGTH && !isVerifying}
        isSaving={isVerifying}
        onCancel={onCancel}
        savingLabel={t('Checking PIN…')}
        submitLabel={t('Continue')}
      />
    </form>
  )
}

function PasswordPanel({ pinToken, onPinExpired, onClose, onBusyChange }: {
  pinToken: string
  onPinExpired: () => void
  onClose: () => void
  onBusyChange: (busy: boolean) => void
}) {
  const { changePassword } = useAdminAuth()
  const { t } = useLanguage()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isDone, setIsDone] = useState(false)

  const strength = passwordStrength(newPassword)
  const strengthMeta = [
    { label: t('Too short'), color: 'bg-[#d2544b]' },
    { label: t('Weak'), color: 'bg-[#d2544b]' },
    { label: t('Fair'), color: 'bg-[#e0a100]' },
    { label: t('Good'), color: 'bg-[#35a36b]' },
    { label: t('Strong'), color: 'bg-[#1f7a46]' },
  ][newPassword.length >= MIN_LENGTH ? strength : 0]
  const requirements = [
    { label: t('At least 8 characters'), met: newPassword.length >= MIN_LENGTH },
    { label: t('Upper- and lowercase letters'), met: /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) },
    { label: t('A number'), met: /\d/.test(newPassword) },
    { label: t('A symbol'), met: /[^A-Za-z0-9]/.test(newPassword) },
  ]
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword
  const isSameAsCurrent = newPassword.length > 0 && newPassword === currentPassword
  const canSubmit = currentPassword.length > 0
    && newPassword.length >= MIN_LENGTH
    && newPassword.length <= MAX_LENGTH
    && passwordsMatch
    && !isSameAsCurrent
    && !isSaving

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return
    setError('')
    setIsSaving(true)
    onBusyChange(true)
    try {
      await changePassword(currentPassword, newPassword, pinToken)
      setIsDone(true)
    } catch (submitError) {
      const message = errorMessage(submitError, 'Unable to change your password.')
      if (message === PIN_REQUIRED_MESSAGE) onPinExpired()
      else setError(t(message))
    } finally {
      setIsSaving(false)
      onBusyChange(false)
    }
  }

  if (isDone) {
    return (
      <SuccessPanel
        message={t('You are still signed in here. Any other devices using this account have been signed out and will need the new password.')}
        onClose={onClose}
        title={t('Password updated')}
      />
    )
  }

  return (
    <form noValidate onSubmit={handleSubmit}>
      <div className="space-y-5 px-6 py-6">
        <PasswordField
          autoComplete="current-password"
          label={t('Current password')}
          name="currentPassword"
          onChange={(event) => { setCurrentPassword(event.target.value); setError('') }}
          required
          value={currentPassword}
        />

        <div>
          <PasswordField
            autoComplete="new-password"
            label={t('New password')}
            maxLength={MAX_LENGTH}
            minLength={MIN_LENGTH}
            name="newPassword"
            onChange={(event) => { setNewPassword(event.target.value); setError('') }}
            required
            value={newPassword}
          />
          {newPassword && (
            <div className="mt-2 flex items-center gap-3">
              <div aria-hidden="true" className="grid flex-1 grid-cols-4 gap-1">
                {[1, 2, 3, 4].map((step) => (
                  <span
                    className={`h-1.5 rounded-full transition-colors ${newPassword.length >= MIN_LENGTH && step <= strength ? strengthMeta.color : 'bg-[#e6ebf1]'}`}
                    key={step}
                  />
                ))}
              </div>
              <span className="text-[11px] font-bold text-[#65748a]">{strengthMeta.label}</span>
            </div>
          )}
          <ul aria-label={t('Password tips')} className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
            {requirements.map((requirement) => (
              <li
                className={`flex items-center gap-1.5 text-[11px] font-semibold transition-colors ${requirement.met ? 'text-[#2c7a4f]' : 'text-[#8190a1]'}`}
                key={requirement.label}
              >
                <Icon className="size-3.5 shrink-0" path={requirement.met ? iconPaths.check : iconPaths.dot} />
                {requirement.label}
              </li>
            ))}
          </ul>
          {isSameAsCurrent && (
            <p className="mt-2 text-[11px] font-bold text-[#b2433a]">{t('Choose a new password that is different from your current one.')}</p>
          )}
        </div>

        <div>
          <PasswordField
            autoComplete="new-password"
            label={t('Confirm new password')}
            maxLength={MAX_LENGTH}
            name="confirmPassword"
            onChange={(event) => { setConfirmPassword(event.target.value); setError('') }}
            required
            value={confirmPassword}
          />
          {confirmPassword && (
            <p className={`mt-1.5 flex items-center gap-1.5 text-[11px] font-bold ${passwordsMatch ? 'text-[#2c7a4f]' : 'text-[#b2433a]'}`}>
              <Icon className="size-3.5" path={passwordsMatch ? iconPaths.check : iconPaths.close} />
              {t(passwordsMatch ? 'Passwords match' : 'The passwords do not match.')}
            </p>
          )}
        </div>

        <p className="flex items-start gap-2 rounded-xl bg-[#f7f9fc] px-3.5 py-3 text-xs leading-5 text-[#65748a] ring-1 ring-[#e8edf3]">
          <Icon className="mt-0.5 size-4 shrink-0 text-[#355777]" path={iconPaths.shield} />
          {t('For your security, other devices signed in to this account will be signed out after the change.')}
        </p>

        {error && <ErrorMessage>{error}</ErrorMessage>}
      </div>
      <FormFooter
        canSubmit={canSubmit}
        isSaving={isSaving}
        onCancel={onClose}
        savingLabel={t('Updating password…')}
        submitLabel={t('Update password')}
      />
    </form>
  )
}

function EmailPanel({ pinToken, onPinExpired, onClose, onBusyChange }: {
  pinToken: string
  onPinExpired: () => void
  onClose: () => void
  onBusyChange: (busy: boolean) => void
}) {
  const { currentAdmin, changeEmail } = useAdminAuth()
  const { t } = useLanguage()
  const [newEmail, setNewEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [savedEmail, setSavedEmail] = useState('')

  const trimmedEmail = newEmail.trim().toLowerCase()
  const isValidEmail = EMAIL_PATTERN.test(trimmedEmail)
  const isSameAsCurrent = trimmedEmail.length > 0 && trimmedEmail === currentAdmin?.email.toLowerCase()
  const canSubmit = isValidEmail && !isSameAsCurrent && currentPassword.length > 0 && !isSaving

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return
    setError('')
    setIsSaving(true)
    onBusyChange(true)
    try {
      const admin = await changeEmail(currentPassword, trimmedEmail, pinToken)
      setSavedEmail(admin.email)
    } catch (submitError) {
      const message = errorMessage(submitError, 'Unable to change your email address.')
      if (message === PIN_REQUIRED_MESSAGE) onPinExpired()
      else setError(t(message))
    } finally {
      setIsSaving(false)
      onBusyChange(false)
    }
  }

  if (savedEmail) {
    return (
      <SuccessPanel
        message={<>{t('From now on, sign in with')} <strong className="font-bold text-[#092a53]">{savedEmail}</strong>.</>}
        onClose={onClose}
        title={t('Email updated')}
      />
    )
  }

  return (
    <form noValidate onSubmit={handleSubmit}>
      <div className="space-y-5 px-6 py-6">
        <div className="rounded-2xl bg-[#f7f9fc] px-4 py-3 ring-1 ring-[#e8edf3]">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#8190a1]">{t('Current sign-in email')}</p>
          <p className="mt-1 truncate text-sm font-bold text-[#092a53]">{currentAdmin?.email}</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#65748a]">
            {t('New email address')}
            <input
              autoComplete="email"
              className="mt-1.5 w-full rounded-xl border border-[#d9d6cc] bg-[#f8f7f2] px-4 py-3 font-normal outline-none transition focus:border-[#bd9c00] focus:ring-2 focus:ring-[#ffdc32]/40"
              inputMode="email"
              maxLength={254}
              name="newEmail"
              onChange={(event) => { setNewEmail(event.target.value); setError('') }}
              placeholder="name@example.com"
              required
              type="email"
              value={newEmail}
            />
          </label>
          {newEmail.trim() && !isValidEmail && (
            <p className="mt-1.5 text-[11px] font-bold text-[#b2433a]">{t('Enter a valid email address.')}</p>
          )}
          {isSameAsCurrent && (
            <p className="mt-1.5 text-[11px] font-bold text-[#b2433a]">{t('This is already your sign-in email.')}</p>
          )}
        </div>

        <PasswordField
          autoComplete="current-password"
          label={t('Confirm with your password')}
          name="currentPassword"
          onChange={(event) => { setCurrentPassword(event.target.value); setError('') }}
          required
          value={currentPassword}
        />

        <p className="flex items-start gap-2 rounded-xl bg-[#fff6e5] px-3.5 py-3 text-xs leading-5 text-[#8a5a00]">
          <Icon className="mt-0.5 size-4 shrink-0" path={iconPaths.mail} />
          {t('Use an address you can access. It becomes the email you sign in with right away.')}
        </p>

        {error && <ErrorMessage>{error}</ErrorMessage>}
      </div>
      <FormFooter
        canSubmit={canSubmit}
        isSaving={isSaving}
        onCancel={onClose}
        savingLabel={t('Updating email…')}
        submitLabel={t('Update email')}
      />
    </form>
  )
}

export function AdminAccountSecurityDialog({ initialTab = 'password', onClose }: { initialTab?: AccountSecurityTab; onClose: () => void }) {
  const { currentAdmin, getSecurityPinStatus } = useAdminAuth()
  const { t } = useLanguage()
  const [stage, setStage] = useState<Stage>('checking')
  const [statusError, setStatusError] = useState('')
  const [pinNotice, setPinNotice] = useState('')
  const [pinToken, setPinToken] = useState('')
  const [tab, setTab] = useState<AccountSecurityTab>(initialTab)
  const [isBusy, setIsBusy] = useState(false)
  const [statusAttempt, setStatusAttempt] = useState(0)
  const dialogRef = useRef<HTMLElement>(null)

  useEffect(() => {
    let cancelled = false
    setStatusError('')
    getSecurityPinStatus()
      .then((hasPin) => {
        if (!cancelled) setStage(hasPin ? 'enter-pin' : 'create-pin')
      })
      .catch((error) => {
        if (!cancelled) setStatusError(t(errorMessage(error, 'Unable to check your security PIN.')))
      })
    return () => {
      cancelled = true
    }
    // Check once per open (or retry); the context functions change identity on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusAttempt])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    if (stage === 'forms') dialogRef.current?.querySelector<HTMLInputElement>('form input')?.focus()
  }, [stage, tab])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isBusy) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isBusy, onClose])

  function handlePinExpired() {
    setPinToken('')
    setPinNotice('')
    setStage('enter-pin')
  }

  const tabs: { id: AccountSecurityTab; label: string; icon: string }[] = [
    { id: 'password', label: t('Password'), icon: iconPaths.lock },
    { id: 'email', label: t('Email'), icon: iconPaths.mail },
  ]

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto px-4 py-8" role="presentation">
      <button
        aria-label={t('Close')}
        className="admin-drawer-backdrop absolute inset-0 bg-[#0b1e36]/45 backdrop-blur-[2px]"
        disabled={isBusy}
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />
      <section
        aria-labelledby="account-security-title"
        aria-modal="true"
        className="admin-modal-panel relative w-full max-w-md overflow-hidden rounded-[22px] bg-white shadow-[0_30px_80px_rgba(9,42,83,0.3)]"
        ref={dialogRef}
        role="dialog"
      >
        <header className={`border-b border-[#edf1f5] px-6 ${stage === 'forms' ? 'pt-5' : 'py-5'}`}>
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#092a53] text-[#ffdc32]">
              <Icon className="size-5" path={iconPaths.shield} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#a48700]">{t('Owner account')}</p>
              <h2 className="mt-0.5 font-display text-xl font-extrabold text-[#092a53]" id="account-security-title">{t('Account security')}</h2>
              <p className="mt-0.5 truncate text-xs text-[#65748a]">{currentAdmin?.email}</p>
            </div>
            <button
              aria-label={t('Close')}
              className="grid size-9 shrink-0 place-items-center rounded-xl text-[#65748a] transition hover:bg-[#f1f4f8] hover:text-[#092a53] disabled:opacity-50"
              disabled={isBusy}
              onClick={onClose}
              type="button"
            >
              <Icon className="size-5" path={iconPaths.close} />
            </button>
          </div>
          {stage === 'forms' && (
            <div aria-label={t('Account security')} className="mt-4 flex gap-1" role="tablist">
              {tabs.map((item) => (
                <button
                  aria-selected={tab === item.id}
                  className={`relative inline-flex min-h-10 items-center gap-2 rounded-t-xl px-4 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#bd9c00] disabled:opacity-50 ${
                    tab === item.id ? 'text-[#092a53]' : 'text-[#8190a1] hover:bg-[#f6f8fb] hover:text-[#355777]'
                  }`}
                  disabled={isBusy}
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  role="tab"
                  type="button"
                >
                  <Icon className="size-4" path={item.icon} />
                  {item.label}
                  {tab === item.id && <span aria-hidden="true" className="absolute inset-x-3 -bottom-px h-[3px] rounded-full bg-[#ffdc32]" />}
                </button>
              ))}
            </div>
          )}
        </header>

        {stage === 'checking' && (
          <div className="px-6 py-10 text-center">
            {statusError ? (
              <div className="space-y-4">
                <ErrorMessage>{statusError}</ErrorMessage>
                <button
                  className="inline-flex min-h-10 items-center rounded-xl bg-[#092a53] px-5 text-sm font-bold text-white transition hover:bg-[#163e6b]"
                  onClick={() => setStatusAttempt((attempt) => attempt + 1)}
                  type="button"
                >
                  {t('Try again')}
                </button>
              </div>
            ) : (
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-[#65748a]" role="status">
                <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-[#092a53] border-r-transparent" />
                {t('Checking your account security…')}
              </p>
            )}
          </div>
        )}
        {stage === 'create-pin' && (
          <CreatePinStep
            onBusyChange={setIsBusy}
            onCancel={onClose}
            onCreated={() => {
              setPinNotice(t('PIN created. Enter it once more to continue.'))
              setStage('enter-pin')
            }}
          />
        )}
        {stage === 'enter-pin' && (
          <EnterPinStep
            notice={pinNotice}
            onBusyChange={setIsBusy}
            onCancel={onClose}
            onVerified={(token) => {
              setPinToken(token)
              setStage('forms')
            }}
          />
        )}
        {stage === 'forms' && (
          <div role="tabpanel">
            {tab === 'password'
              ? <PasswordPanel key="password" onBusyChange={setIsBusy} onClose={onClose} onPinExpired={handlePinExpired} pinToken={pinToken} />
              : <EmailPanel key="email" onBusyChange={setIsBusy} onClose={onClose} onPinExpired={handlePinExpired} pinToken={pinToken} />}
          </div>
        )}
      </section>
    </div>
  )
}
