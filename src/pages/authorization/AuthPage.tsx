import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowIcon } from '../../components/Layout'
import { PasswordField } from '../../components/PasswordField'
import { useAuth } from '../../context/useAuth'
import { photoSrcSet } from '../../lib/thumbnails'
import { useLanguage } from '../../language/useLanguage'
import { isEventType } from '../../../shared/eventTypes.js'

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const isSignup = mode === 'signup'
  const { requestSignupVerification, signup, requestPasswordReset, confirmPasswordReset, login } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  const returnToCheckout = location.state?.from === '/checkout'
  const returnToAccount = location.state?.from === '/account/orders'
  const returnToEvent = location.state?.from === '/events'
    ? `/events${isEventType(location.state?.type) ? `?type=${location.state.type}` : ''}`
    : ''
  const checkoutNotice = typeof location.state?.notice === 'string' ? location.state.notice : ''
  const previousPath = typeof location.state?.from === 'string' ? location.state.from : ''

  function goBack() {
    if (previousPath.startsWith('/') && previousPath !== '/login' && previousPath !== '/signup') {
      navigate(previousPath)
      return
    }
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate('/')
  }
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [verificationId, setVerificationId] = useState('')
  const [verificationCode, setVerificationCode] = useState<string[]>(Array(6).fill(''))
  const [verificationNotice, setVerificationNotice] = useState('')
  const [passwordResetStep, setPasswordResetStep] = useState<'idle' | 'request' | 'confirm'>('idle')
  const [resetVerificationId, setResetVerificationId] = useState('')
  const [resetPassword, setResetPassword] = useState('')
  const [resetPasswordConfirmation, setResetPasswordConfirmation] = useState('')
  const [resendAvailableAt, setResendAvailableAt] = useState(0)
  const [resendCountdown, setResendCountdown] = useState(0)
  const verificationInputs = useRef<(HTMLInputElement | null)[]>([])
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!verificationId || !resendAvailableAt) return undefined
    const updateCountdown = () => setResendCountdown(Math.max(0, Math.ceil((resendAvailableAt - Date.now()) / 1000)))
    updateCountdown()
    const timer = window.setInterval(updateCountdown, 1000)
    return () => window.clearInterval(timer)
  }, [resendAvailableAt, verificationId])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setVerificationNotice('')
    if (passwordResetStep === 'request') {
      setIsSubmitting(true)
      try {
        const result = await requestPasswordReset(email)
        if (!result.verificationId) throw new Error('Unable to start a password reset. Please try again.')
        setResetVerificationId(result.verificationId)
        setVerificationCode(Array(6).fill(''))
        setPasswordResetStep('confirm')
        setVerificationNotice(result.message || t('If an account uses that email, a reset code is on its way. Check your inbox.'))
        window.setTimeout(() => verificationInputs.current[0]?.focus(), 0)
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : t('Unable to send a reset code. Please try again.'))
      } finally {
        setIsSubmitting(false)
      }
      return
    }

    if (passwordResetStep === 'confirm') {
      if (verificationCode.some((digit) => !digit)) {
        setError(t('Enter the 6-digit code sent to your email.'))
        verificationInputs.current[0]?.focus()
        return
      }
      if (resetPassword !== resetPasswordConfirmation) {
        setError(t('Your passwords do not match. Please check them and try again.'))
        return
      }
      setIsSubmitting(true)
      try {
        await confirmPasswordReset({ verificationId: resetVerificationId, code: verificationCode.join(''), password: resetPassword })
        setPassword(resetPassword)
        setResetPassword('')
        setResetPasswordConfirmation('')
        setVerificationCode(Array(6).fill(''))
        setResetVerificationId('')
        setPasswordResetStep('idle')
        setVerificationNotice(t('Your password has been reset. Sign in with your new password.'))
      } catch (resetError) {
        setError(resetError instanceof Error ? resetError.message : t('Unable to reset your password. Please try again.'))
      } finally {
        setIsSubmitting(false)
      }
      return
    }

    if (isSignup && !verificationId && password !== confirmPassword) {
      setError(t('Your passwords do not match. Please check them and try again.'))
      return
    }
    if (isSignup && verificationId && verificationCode.some((digit) => !digit)) {
      setError(t('Enter the 6-digit code sent to your email.'))
      verificationInputs.current[0]?.focus()
      return
    }

    setIsSubmitting(true)
    try {
      if (isSignup && !verificationId) {
        const result = await requestSignupVerification({ name, email, password })
        setVerificationId(result.verificationId)
        setVerificationCode(Array(6).fill(''))
        setResendAvailableAt(Date.now() + 60_000)
        setVerificationNotice(t('A 6-digit verification code was sent to {email}.', { email }))
        window.setTimeout(() => verificationInputs.current[0]?.focus(), 0)
        return
      }

      if (isSignup) {
        await signup({ verificationId, code: verificationCode.join('') })
      } else {
        await login({ email, password })
      }
      navigate(
        returnToCheckout ? '/checkout' : returnToAccount ? '/account/orders' : returnToEvent ? returnToEvent : isSignup ? '/' : '/account/orders',
        { replace: true },
      )
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Unable to authenticate. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function resendVerificationCode() {
    setError('')
    setVerificationNotice('')
    setIsSubmitting(true)
    try {
      const result = await requestSignupVerification({ name, email, password })
      setVerificationId(result.verificationId)
      setVerificationCode(Array(6).fill(''))
      setResendAvailableAt(Date.now() + 60_000)
      setVerificationNotice(t('A new 6-digit verification code was sent to {email}.', { email }))
      window.setTimeout(() => verificationInputs.current[0]?.focus(), 0)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('Unable to send a verification code. Please try again.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  function updateVerificationCode(index: number, rawValue: string) {
    const digits = rawValue.replace(/\D/g, '')
    if (!digits) {
      setVerificationCode((current) => current.map((digit, digitIndex) => digitIndex === index ? '' : digit))
      return
    }
    if (digits.length > 1) {
      const pastedCode = digits.slice(0, 6)
      setVerificationCode([...pastedCode, ...Array(6 - pastedCode.length).fill('')])
      verificationInputs.current[Math.min(pastedCode.length, 5)]?.focus()
      return
    }
    setVerificationCode((current) => current.map((digit, digitIndex) => digitIndex === index ? digits : digit))
    if (index < 5) verificationInputs.current[index + 1]?.focus()
  }

  function handleVerificationKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !verificationCode[index] && index > 0) {
      verificationInputs.current[index - 1]?.focus()
    } else if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault()
      verificationInputs.current[index - 1]?.focus()
    } else if (event.key === 'ArrowRight' && index < 5) {
      event.preventDefault()
      verificationInputs.current[index + 1]?.focus()
    }
  }

  function handleVerificationPaste(event: ClipboardEvent<HTMLDivElement>) {
    const digits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!digits) return
    event.preventDefault()
    setVerificationCode([...digits, ...Array(6 - digits.length).fill('')])
    verificationInputs.current[Math.min(digits.length, 5)]?.focus()
  }

  const passwordScore = !password
    ? 0
    : [password.length >= 8, password.length >= 12, /[A-Z]/.test(password) && /[a-z]/.test(password), /\d/.test(password) || /[^A-Za-z0-9]/.test(password)].filter(Boolean).length
  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong']
  const passwordsMatch = Boolean(confirmPassword) && password === confirmPassword
  const brandImage = '/ice-images/ice-5.webp'
  const labelClass = 'text-sm font-bold text-[#092a53]'
  const inputShellClass = 'mt-2 flex bg-[#f4f6f8] focus-within:ring-2 focus-within:ring-[#092a53]'
  const inputClass = 'w-full bg-transparent px-4 py-3.5 text-sm font-semibold text-[#092a53] outline-none placeholder:font-normal placeholder:text-[#8b97a8]'
  const codeInputClass = 'size-12 bg-[#f4f6f8] text-center text-xl font-extrabold text-[#092a53] outline-none focus:ring-2 focus:ring-[#092a53] sm:size-14'

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#092a53]">
      <button
        className="fixed left-5 top-5 z-20 inline-flex items-center gap-2 bg-[#092a53] px-4 py-3 text-sm font-extrabold text-white transition duration-300 hover:bg-[#ffdc32] hover:text-[#092a53] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2 sm:left-8 sm:top-8"
        onClick={goBack}
        type="button"
      >
        <span className="inline-flex rotate-180">
          <ArrowIcon />
        </span>
        {t('Back')}
      </button>
      <main className="flex flex-1 items-center px-5 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-10" id="main" tabIndex={-1}>
        <div className="mx-auto grid w-full max-w-[1100px] overflow-hidden bg-white shadow-[0_22px_48px_rgba(9,42,83,0.2)] lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="relative h-56 overflow-hidden sm:h-72 lg:h-auto lg:min-h-full">
            <img
              alt=""
              className="absolute inset-0 size-full object-cover"
              decoding="async"
              loading="eager"
              sizes="(min-width: 1024px) 46vw, 100vw"
              src={brandImage}
              srcSet={photoSrcSet(brandImage)}
            />
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#061d3a] via-[#061d3a]/65 to-[#061d3a]/30" />
            <img
              alt=""
              className="absolute left-6 top-6 size-16 sm:left-8 sm:top-8 sm:size-20 lg:left-10 lg:top-10"
              decoding="async"
              height={80}
              src="/logo.png"
              width={80}
            />
            <p className="absolute inset-x-0 bottom-0 p-6 font-display text-3xl font-extrabold leading-[0.95] tracking-[-0.03em] text-white sm:p-8 sm:text-4xl lg:p-10 lg:text-5xl">
              {isSignup ? t('A little more joy in every visit.') : t('Made for moments worth sharing')}
            </p>
          </div>

          <section className="flex min-w-0 items-center px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12">
            <div className="w-full max-w-md">
              <div aria-label={t('Account')} className="flex gap-6" role="group">
                {[
                  { to: '/login', label: t('Log in'), active: !isSignup },
                  { to: '/signup', label: t('Sign up'), active: isSignup },
                ].map((tab) => (
                  <Link
                    aria-current={tab.active ? 'page' : undefined}
                    className={`pb-2 text-sm font-extrabold transition ${
                      tab.active
                        ? 'text-[#092a53] underline decoration-[#ffdc32] decoration-[3px] underline-offset-8'
                        : 'text-[#65748a] hover:text-[#092a53]'
                    }`}
                    key={tab.to}
                    replace
                    state={location.state}
                    to={tab.to}
                  >
                    {tab.label}
                  </Link>
                ))}
              </div>

              <h1 className="mt-6 font-display text-4xl font-extrabold leading-[0.95] tracking-[-0.03em] text-[#092a53] sm:text-5xl">
                {passwordResetStep === 'request'
                  ? t('Reset your password')
                  : passwordResetStep === 'confirm'
                    ? t('Choose a new password')
                    : isSignup ? verificationId ? t('Verify your email') : t('Create an account') : t('Welcome back')}
              </h1>
              {!(isSignup && !verificationId && passwordResetStep === 'idle') && (
                <p className="mt-4 max-w-[42ch] text-base font-medium leading-7 text-[#092a53]">
                  {passwordResetStep === 'request'
                    ? t('Enter the email address on your account and we’ll send you a reset code.')
                    : passwordResetStep === 'confirm'
                      ? t('Enter the 6-digit code from your email and choose a new password.')
                      : isSignup
                        ? t('Enter the 6-digit code we sent to your email to finish creating your account.')
                        : t('Good to see you again. Enter your details below.')}
                </p>
              )}
              {checkoutNotice && (
                <p className="mt-5 bg-[#fff6cc] px-4 py-3 text-sm font-semibold leading-6 text-[#092a53]" role="status">
                  {checkoutNotice}
                </p>
              )}

              <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                {isSignup && !verificationId && passwordResetStep === 'idle' && (
                  <label className="block">
                    <span className={labelClass}>{t('Name')}</span>
                    <span className={inputShellClass}>
                      <input autoComplete="name" className={inputClass} maxLength={100} name="name" onChange={(event) => setName(event.target.value)} required type="text" value={name} />
                    </span>
                  </label>
                )}

                {isSignup && verificationId ? (
                  <div>
                    <p className="text-sm font-semibold text-[#092a53]">
                      {t('We sent a verification code to')}
                    </p>
                    <p className="mt-1 break-all text-sm font-extrabold text-[#092a53]">{email}</p>
                    <div
                      aria-label={t('6-digit verification code')}
                      className="mt-5 flex gap-2"
                      onPaste={handleVerificationPaste}
                      role="group"
                    >
                      {verificationCode.map((digit, index) => (
                        <input
                          aria-label={t('Digit {number} of 6', { number: index + 1 })}
                          autoComplete={index === 0 ? 'one-time-code' : 'off'}
                          className={codeInputClass}
                          inputMode="numeric"
                          key={index}
                          maxLength={6}
                          onChange={(event) => updateVerificationCode(index, event.target.value)}
                          onKeyDown={(event) => handleVerificationKeyDown(index, event)}
                          pattern="[0-9]*"
                          ref={(element) => { verificationInputs.current[index] = element }}
                          required
                          type="text"
                          value={digit}
                        />
                      ))}
                    </div>
                    <p className="mt-3 text-sm font-medium leading-6 text-[#092a53]">{t('The code expires in 10 minutes.')}</p>
                    <button className="mt-3 text-sm font-extrabold text-[#092a53] underline decoration-[#ffdc32] decoration-2 underline-offset-4 disabled:cursor-wait disabled:opacity-60" disabled={isSubmitting || resendCountdown > 0} onClick={resendVerificationCode} type="button">
                      {resendCountdown > 0 ? t('Resend code in {seconds}s', { seconds: resendCountdown }) : t('Resend code')}
                    </button>
                  </div>
                ) : passwordResetStep !== 'idle' ? (
                  <>
                    <label className="block">
                      <span className={labelClass}>{t('Email address')}</span>
                      <span className={inputShellClass}>
                        <input autoComplete="email" className={inputClass} name="email" onChange={(event) => setEmail(event.target.value)} placeholder={t('you@example.com')} readOnly={passwordResetStep === 'confirm'} required type="email" value={email} />
                      </span>
                    </label>
                    {passwordResetStep === 'confirm' && (
                      <>
                        <div
                          aria-label={t('6-digit verification code')}
                          className="flex gap-2"
                          onPaste={handleVerificationPaste}
                          role="group"
                        >
                          {verificationCode.map((digit, index) => (
                            <input
                              aria-label={t('Digit {number} of 6', { number: index + 1 })}
                              autoComplete={index === 0 ? 'one-time-code' : 'off'}
                              className={codeInputClass}
                              inputMode="numeric"
                              key={index}
                              maxLength={6}
                              onChange={(event) => updateVerificationCode(index, event.target.value)}
                              onKeyDown={(event) => handleVerificationKeyDown(index, event)}
                              pattern="[0-9]*"
                              ref={(element) => { verificationInputs.current[index] = element }}
                              required
                              type="text"
                              value={digit}
                            />
                          ))}
                        </div>
                        <p className="text-sm font-medium leading-6 text-[#092a53]">{t('The code expires in 10 minutes.')}</p>
                        <PasswordField
                          autoComplete="new-password"
                          label={t('New password')}
                          labelClassName={labelClass}
                          maxLength={128}
                          minLength={8}
                          name="newPassword"
                          onChange={(event) => setResetPassword(event.target.value)}
                          required
                          value={resetPassword}
                          variant="plain"
                        />
                        <PasswordField
                          autoComplete="new-password"
                          label={t('Confirm new password')}
                          labelClassName={labelClass}
                          maxLength={128}
                          minLength={8}
                          name="confirmNewPassword"
                          onChange={(event) => setResetPasswordConfirmation(event.target.value)}
                          required
                          value={resetPasswordConfirmation}
                          variant="plain"
                        />
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <label className="block">
                      <span className={labelClass}>{t('Email address')}</span>
                      <span className={inputShellClass}>
                        <input autoComplete="email" className={inputClass} name="email" onChange={(event) => setEmail(event.target.value)} placeholder={t('you@example.com')} required type="email" value={email} />
                      </span>
                    </label>

                    <PasswordField
                      autoComplete={isSignup ? 'new-password' : 'current-password'}
                      label={t('Password')}
                      labelClassName={labelClass}
                      maxLength={128}
                      minLength={8}
                      name="password"
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      value={password}
                      variant="plain"
                    >
                      {isSignup && (
                        <span aria-live="polite" className="mt-2.5 block">
                          <span aria-hidden="true" className="grid grid-cols-4 gap-1.5">
                            {[1, 2, 3, 4].map((step) => (
                              <span className={`h-1.5 ${passwordScore >= step ? 'bg-[#092a53]' : 'bg-[#e4e8ee]'}`} key={step} />
                            ))}
                          </span>
                          <span className="mt-1.5 flex justify-between text-sm font-semibold text-[#092a53]">
                            <span>{t('At least 8 characters')}</span>
                            {passwordScore > 0 && <span>{t('Password strength')}: {t(strengthLabels[passwordScore])}</span>}
                          </span>
                        </span>
                      )}
                    </PasswordField>

                    {!isSignup && passwordResetStep === 'idle' && (
                      <div className="text-right">
                        <button
                          className="text-sm font-extrabold text-[#092a53] underline decoration-[#ffdc32] decoration-2 underline-offset-4"
                          onClick={() => {
                            setError('')
                            setVerificationNotice('')
                            setResetVerificationId('')
                            setPasswordResetStep('request')
                          }}
                          type="button"
                        >
                          {t('Forgot password?')}
                        </button>
                      </div>
                    )}

                    {isSignup && (
                      <PasswordField
                        autoComplete="new-password"
                        label={t('Confirm password')}
                        labelClassName={labelClass}
                        maxLength={128}
                        minLength={8}
                        name="confirmPassword"
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        required
                        value={confirmPassword}
                        variant="plain"
                      >
                        {passwordsMatch && (
                          <span className="mt-2 block text-sm font-bold text-[#14532d]" role="status">
                            {t('Passwords match')}
                          </span>
                        )}
                      </PasswordField>
                    )}
                  </>
                )}

                {verificationNotice && (
                  <p className="bg-[#e7f5ec] px-4 py-3 text-sm font-semibold leading-6 text-[#14532d]" role="status">{verificationNotice}</p>
                )}

                {error && (
                  <p className="bg-[#fde8e8] px-4 py-3 text-sm font-semibold leading-6 text-[#9f1239]" role="alert">
                    {error}
                  </p>
                )}

                <button
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 bg-[#ffdc32] px-6 text-sm font-extrabold text-[#092a53] transition duration-300 hover:bg-[#092a53] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2 active:scale-[0.99] disabled:cursor-wait disabled:opacity-70 motion-reduce:transform-none"
                  disabled={isSubmitting || Boolean(isSignup && verificationId && verificationCode.some((digit) => !digit))}
                  type="submit"
                >
                  {isSubmitting && (
                    <svg aria-hidden="true" className="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" opacity="0.25" r="9" stroke="currentColor" strokeWidth="3" />
                      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
                    </svg>
                  )}
                  {isSubmitting
                    ? t(passwordResetStep === 'request' ? 'Sending reset code…' : passwordResetStep === 'confirm' ? 'Resetting password…' : isSignup ? verificationId ? 'Verifying code…' : 'Sending verification code…' : 'Please wait…')
                    : passwordResetStep === 'request' ? t('Send reset code') : passwordResetStep === 'confirm' ? t('Reset password') : isSignup ? t(verificationId ? 'Verify email' : 'Create account') : t('Log in')}
                  {!isSubmitting && <ArrowIcon />}
                </button>
              </form>

              {passwordResetStep !== 'idle' && (
                <button
                  className="mt-5 text-sm font-extrabold text-[#092a53] underline decoration-[#ffdc32] decoration-2 underline-offset-4"
                  onClick={() => {
                    setPasswordResetStep('idle')
                    setResetVerificationId('')
                    setResetPassword('')
                    setResetPasswordConfirmation('')
                    setVerificationCode(Array(6).fill(''))
                    setError('')
                    setVerificationNotice('')
                  }}
                  type="button"
                >
                  {t('Back to log in')}
                </button>
              )}

              <p className="mt-6 text-sm font-medium text-[#092a53]">
                {isSignup ? t('Already have an account?') : t("New to this website's shop?")}{' '}
                <Link
                  className="font-extrabold underline decoration-[#ffdc32] decoration-2 underline-offset-4 transition hover:decoration-[#092a53]"
                  replace
                  state={location.state}
                  to={isSignup ? '/login' : '/signup'}
                >
                  {isSignup ? t('Log in') : t('Sign up')}
                </Link>
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
