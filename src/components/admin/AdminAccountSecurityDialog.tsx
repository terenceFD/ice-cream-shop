import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { PasswordField } from '../PasswordField'
import { passwordStrength } from '../passwordStrength'
import { useAdminAuth } from '../../pages/admin/useAdminAuth'
import { useLanguage } from '../../language/useLanguage'

const MIN_LENGTH = 8
const MAX_LENGTH = 128
const PIN_LENGTH = 6
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// The server answers with this message when the PIN confirmation is missing or has expired.
const PIN_REQUIRED_MESSAGE = 'Confirm your security PIN to continue.'

export type AccountSecurityTab = 'password' | 'email' | 'authenticator'
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
    <p className="flex items-start gap-2 rounded-md bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100" role="alert">
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
      <span className="mx-auto grid size-12 place-items-center rounded-md bg-[#e7f6ee] text-[#1f7a46]">
        <Icon className="size-6" path={iconPaths.check} />
      </span>
      <h3 className="mt-4 text-base font-semibold text-[#472a3b]">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#65748a]">{message}</p>
      <button
        className="mt-6 inline-flex min-h-10 w-full items-center justify-center rounded-md bg-[#472a3b] px-5 text-sm font-bold text-white transition hover:bg-[#6b3f58] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b8721e]"
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
    <footer className="flex items-center justify-end gap-3 border-t border-[#f4f6f8] bg-[#f4f6f8] px-6 py-4">
      <button
        className="min-h-10 rounded-md px-4 text-sm font-bold text-[#65748a] transition hover:bg-[#f4f6f8] hover:text-[#472a3b] disabled:opacity-50"
        disabled={isSaving}
        onClick={onCancel}
        type="button"
      >
        {cancelLabel || t('Cancel')}
      </button>
      <button
        className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[#472a3b] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#6b3f58] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b8721e] disabled:cursor-not-allowed disabled:opacity-50"
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
              className={`h-12 w-full min-w-0 rounded-md border-2 bg-[#f8f9fb] text-center text-base font-semibold text-[#472a3b] outline-none transition sm:h-13 ${
                invalid
                  ? 'border-[#e5a29c] bg-red-50'
                  : filled
                    ? 'border-[#472a3b] bg-white'
                    : 'border-[#dce3eb] focus:border-[#b8721e] focus:bg-white focus:ring-4 focus:ring-[#ffb84d]/30'
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
          <span className="mx-auto grid size-12 place-items-center rounded-md bg-[#fff6d6] text-[#b8721e]">
            <Icon className="size-6" path={iconPaths.key} />
          </span>
          <p className="mt-3 text-xs font-extrabold uppercase tracking-[0.16em] text-[#65748a]">
            {t('Step {step} of 2', { step: step === 'choose' ? 1 : 2 })}
          </p>
          <h3 className="mt-1 text-sm font-semibold text-[#472a3b]">
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
        <p className="flex items-start gap-2 rounded-md bg-[#f4f6f8] px-3.5 py-3 text-xs leading-5 text-[#65748a] ring-1 ring-[#dce3eb]">
          <Icon className="mt-0.5 size-4 shrink-0 text-[#6b3f58]" path={iconPaths.shield} />
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
          <span className="mx-auto grid size-12 place-items-center rounded-md bg-[#472a3b] text-[#ffb84d]">
            <Icon className="size-6" path={iconPaths.lock} />
          </span>
          <h3 className="mt-3 text-sm font-semibold text-[#472a3b]">{t('Enter your security PIN')}</h3>
          <p className="mx-auto mt-1.5 max-w-xs text-sm leading-6 text-[#65748a]">
            {t('Confirm it’s you before changing your sign-in details.')}
          </p>
        </div>
        {notice && (
          <p className="flex items-center justify-center gap-2 rounded-md bg-[#e7f6ee] px-3.5 py-2.5 text-xs font-bold text-[#1f7a46]" role="status">
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
        <p aria-live="polite" className="min-h-5 text-center text-xs font-semibold text-[#65748a]">
          {isVerifying && (
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="size-3.5 animate-spin rounded-full border-2 border-[#472a3b] border-r-transparent" />
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
    { label: t('Fair'), color: 'bg-[#b8721e]' },
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
                    className={`h-1.5 rounded-full transition-colors ${newPassword.length >= MIN_LENGTH && step <= strength ? strengthMeta.color : 'bg-[#dce3eb]'}`}
                    key={step}
                  />
                ))}
              </div>
              <span className="text-xs font-bold text-[#65748a]">{strengthMeta.label}</span>
            </div>
          )}
          <ul aria-label={t('Password tips')} className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
            {requirements.map((requirement) => (
              <li
                className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${requirement.met ? 'text-[#2c7a4f]' : 'text-[#65748a]'}`}
                key={requirement.label}
              >
                <Icon className="size-3.5 shrink-0" path={requirement.met ? iconPaths.check : iconPaths.dot} />
                {requirement.label}
              </li>
            ))}
          </ul>
          {isSameAsCurrent && (
            <p className="mt-2 text-xs font-bold text-[#b2433a]">{t('Choose a new password that is different from your current one.')}</p>
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
            <p className={`mt-1.5 flex items-center gap-1.5 text-xs font-bold ${passwordsMatch ? 'text-[#2c7a4f]' : 'text-[#b2433a]'}`}>
              <Icon className="size-3.5" path={passwordsMatch ? iconPaths.check : iconPaths.close} />
              {t(passwordsMatch ? 'Passwords match' : 'The passwords do not match.')}
            </p>
          )}
        </div>

        <p className="flex items-start gap-2 rounded-md bg-[#f4f6f8] px-3.5 py-3 text-xs leading-5 text-[#65748a] ring-1 ring-[#dce3eb]">
          <Icon className="mt-0.5 size-4 shrink-0 text-[#6b3f58]" path={iconPaths.shield} />
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
        message={<>{t('From now on, sign in with')} <strong className="font-bold text-[#472a3b]">{savedEmail}</strong>.</>}
        onClose={onClose}
        title={t('Email updated')}
      />
    )
  }

  return (
    <form noValidate onSubmit={handleSubmit}>
      <div className="space-y-5 px-6 py-6">
        <div className="rounded-md bg-[#f4f6f8] px-4 py-3 ring-1 ring-[#dce3eb]">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#65748a]">{t('Current sign-in email')}</p>
          <p className="mt-1 truncate text-sm font-bold text-[#472a3b]">{currentAdmin?.email}</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#65748a]">
            {t('New email address')}
            <input
              autoComplete="email"
              className="mt-1.5 w-full rounded-md border border-[#d9d6cc] bg-[#fbfaf5] px-4 py-3 font-normal outline-none transition focus:border-[#b8721e] focus:ring-2 focus:ring-[#ffb84d]/40"
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
            <p className="mt-1.5 text-xs font-bold text-[#b2433a]">{t('Enter a valid email address.')}</p>
          )}
          {isSameAsCurrent && (
            <p className="mt-1.5 text-xs font-bold text-[#b2433a]">{t('This is already your sign-in email.')}</p>
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

        <p className="flex items-start gap-2 rounded-md bg-[#fff6e5] px-3.5 py-3 text-xs leading-5 text-[#8a5a00]">
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

function AuthenticatorPanel({ pinToken, onPinExpired, onClose, onBusyChange }: {
  pinToken: string
  onPinExpired: () => void
  onClose: () => void
  onBusyChange: (busy: boolean) => void
}) {
  const { beginAuthenticatorReplacement, confirmAuthenticatorReplacement } = useAdminAuth()
  const { t } = useLanguage()
  const [currentPassword, setCurrentPassword] = useState('')
  const [currentCode, setCurrentCode] = useState('')
  const [newCode, setNewCode] = useState('')
  const [setup, setSetup] = useState<{ secret: string; authenticatorUri: string } | null>(null)
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  async function handleStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!currentPassword || !/^\d{6}$/.test(currentCode) || isSaving) return
    setError('')
    setIsSaving(true)
    onBusyChange(true)
    try {
      setSetup(await beginAuthenticatorReplacement(currentPassword, currentCode, pinToken))
      setCurrentPassword('')
      setCurrentCode('')
    } catch (submitError) {
      const message = errorMessage(submitError, 'Unable to start authenticator replacement.')
      if (message === PIN_REQUIRED_MESSAGE) onPinExpired()
      else setError(t(message))
    } finally {
      setIsSaving(false)
      onBusyChange(false)
    }
  }

  async function handleConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!setup || !/^\d{6}$/.test(newCode) || isSaving) return
    setError('')
    setIsSaving(true)
    onBusyChange(true)
    try {
      const result = await confirmAuthenticatorReplacement(newCode, pinToken)
      setRecoveryCodes(result.recoveryCodes)
      setSetup(null)
      setNewCode('')
    } catch (submitError) {
      const message = errorMessage(submitError, 'Unable to confirm the new authenticator.')
      if (message === PIN_REQUIRED_MESSAGE) onPinExpired()
      else setError(t(message))
    } finally {
      setIsSaving(false)
      onBusyChange(false)
    }
  }

  if (recoveryCodes.length > 0) {
    return (
      <div className="space-y-4 px-6 py-6">
        <div>
          <h3 className="text-sm font-semibold text-[#472a3b]">{t('Save your new recovery codes')}</h3>
          <p className="mt-1 text-sm leading-6 text-[#65748a]">{t('These codes replace your previous recovery codes. Each can only be used once.')}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-md bg-[#f4f6f8] p-3 font-mono text-sm font-bold tracking-wide text-[#472a3b]">
          {recoveryCodes.map((code) => <code key={code}>{code}</code>)}
        </div>
        <button
          className="inline-flex min-h-10 w-full items-center justify-center rounded-md bg-[#472a3b] px-5 text-sm font-bold text-white transition hover:bg-[#6b3f58]"
          onClick={onClose}
          type="button"
        >
          {t('I have saved these codes')}
        </button>
      </div>
    )
  }

  if (setup) {
    return (
      <form noValidate onSubmit={handleConfirm}>
        <div className="space-y-4 px-6 py-6">
          <div>
            <h3 className="text-sm font-semibold text-[#472a3b]">{t('Scan your new authenticator QR code')}</h3>
            <p className="mt-1 text-sm leading-6 text-[#65748a]">{t('The current authenticator remains active until you confirm a code from the new one.')}</p>
          </div>
          <div className="flex justify-center rounded-md bg-[#f4f6f8] p-4">
            <QRCodeSVG
              aria-label={t('Authenticator setup QR code')}
              bgColor="#ffffff"
              fgColor="#472a3b"
              includeMargin
              level="M"
              size={200}
              title={t('Authenticator setup QR code')}
              value={setup.authenticatorUri}
            />
          </div>
          <details className="rounded-md bg-[#f4f6f8] p-3 text-sm">
            <summary className="cursor-pointer font-bold text-[#65748a]">{t("Can't scan? Use manual setup")}</summary>
            <code className="mt-2 block break-all rounded-lg bg-white p-3 font-mono font-bold tracking-wider text-[#472a3b]">{setup.secret}</code>
            <code className="mt-2 block break-all rounded-lg bg-white p-3 text-xs text-[#65748a]">{setup.authenticatorUri}</code>
          </details>
          <label className="block text-sm font-semibold text-[#65748a]">
            {t('Code from your new authenticator')}
            <input
              autoComplete="one-time-code"
              autoFocus
              className="mt-1.5 w-full rounded-md border border-[#d9d6cc] bg-[#fbfaf5] px-4 py-3 text-center font-mono text-lg font-bold tracking-[0.2em] text-[#472a3b] outline-none focus:border-[#b8721e] focus:ring-2 focus:ring-[#ffb84d]/40"
              inputMode="numeric"
              maxLength={6}
              onChange={(event) => { setNewCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }}
              pattern="[0-9]{6}"
              placeholder="000000"
              required
              value={newCode}
            />
          </label>
          {error && <ErrorMessage>{error}</ErrorMessage>}
        </div>
        <FormFooter
          canSubmit={/^\d{6}$/.test(newCode) && !isSaving}
          isSaving={isSaving}
          onCancel={onClose}
          savingLabel={t('Verifying new authenticator…')}
          submitLabel={t('Confirm new authenticator')}
        />
      </form>
    )
  }

  return (
    <form noValidate onSubmit={handleStart}>
      <div className="space-y-5 px-6 py-6">
        <p className="text-sm leading-6 text-[#65748a]">{t('To replace your authenticator, confirm your current password and a fresh code from your current authenticator. Your existing setup stays active until the new one is verified.')}</p>
        <PasswordField
          autoComplete="current-password"
          label={t('Current password')}
          name="currentPassword"
          onChange={(event) => { setCurrentPassword(event.target.value); setError('') }}
          required
          value={currentPassword}
        />
        <label className="block text-sm font-semibold text-[#65748a]">
          {t('Code from your current authenticator')}
          <input
            autoComplete="one-time-code"
            className="mt-1.5 w-full rounded-md border border-[#d9d6cc] bg-[#fbfaf5] px-4 py-3 text-center font-mono text-lg font-bold tracking-[0.2em] text-[#472a3b] outline-none focus:border-[#b8721e] focus:ring-2 focus:ring-[#ffb84d]/40"
            inputMode="numeric"
            maxLength={6}
            onChange={(event) => { setCurrentCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }}
            pattern="[0-9]{6}"
            placeholder="000000"
            required
            value={currentCode}
          />
        </label>
        {error && <ErrorMessage>{error}</ErrorMessage>}
      </div>
      <FormFooter
        canSubmit={Boolean(currentPassword) && /^\d{6}$/.test(currentCode) && !isSaving}
        isSaving={isSaving}
        onCancel={onClose}
        savingLabel={t('Preparing new QR code…')}
        submitLabel={t('Set up a new authenticator')}
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
    { id: 'authenticator', label: t('Authenticator'), icon: iconPaths.key },
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
        className="admin-modal-panel relative w-full max-w-md overflow-hidden rounded-md bg-white shadow-[0_30px_80px_rgba(9,42,83,0.3)]"
        ref={dialogRef}
        role="dialog"
      >
        <header className={`border-b border-[#f4f6f8] px-6 ${stage === 'forms' ? 'pt-5' : 'py-5'}`}>
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-md bg-[#472a3b] text-[#ffb84d]">
              <Icon className="size-5" path={iconPaths.shield} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#b8721e]">{t('Owner account')}</p>
              <h2 className="mt-0.5 text-base font-semibold text-[#472a3b]" id="account-security-title">{t('Account security')}</h2>
              <p className="mt-0.5 truncate text-xs text-[#65748a]">{currentAdmin?.email}</p>
            </div>
            <button
              aria-label={t('Close')}
              className="grid size-9 shrink-0 place-items-center rounded-md text-[#65748a] transition hover:bg-[#f4f6f8] hover:text-[#472a3b] disabled:opacity-50"
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
                  className={`relative inline-flex min-h-10 items-center gap-2 rounded-t-xl px-4 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#b8721e] disabled:opacity-50 ${
                    tab === item.id ? 'text-[#472a3b]' : 'text-[#65748a] hover:bg-[#f4f6f8] hover:text-[#6b3f58]'
                  }`}
                  disabled={isBusy}
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  role="tab"
                  type="button"
                >
                  <Icon className="size-4" path={item.icon} />
                  {item.label}
                  {tab === item.id && <span aria-hidden="true" className="absolute inset-x-3 -bottom-px h-[3px] rounded-full bg-[#ffb84d]" />}
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
                  className="inline-flex min-h-10 items-center rounded-md bg-[#472a3b] px-5 text-sm font-bold text-white transition hover:bg-[#6b3f58]"
                  onClick={() => setStatusAttempt((attempt) => attempt + 1)}
                  type="button"
                >
                  {t('Try again')}
                </button>
              </div>
            ) : (
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-[#65748a]" role="status">
                <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-[#472a3b] border-r-transparent" />
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
              : tab === 'email'
                ? <EmailPanel key="email" onBusyChange={setIsBusy} onClose={onClose} onPinExpired={handlePinExpired} pinToken={pinToken} />
                : <AuthenticatorPanel key="authenticator" onBusyChange={setIsBusy} onClose={onClose} onPinExpired={handlePinExpired} pinToken={pinToken} />}
          </div>
        )}
      </section>
    </div>
  )
}
