import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowIcon, Header } from '../../components/Layout'
import { PasswordField } from '../../components/PasswordField'
import { useAuth } from '../../context/useAuth'
import { getCustomerToken } from '../../api/api'
import { enablePromotionAlerts, isPushSupported } from '../../lib/pushNotifications'
import { photoSrcSet } from '../../lib/thumbnails'
import { useLanguage } from '../../language/useLanguage'
import { isEventType } from '../../../shared/eventTypes.js'
import './AuthPage.css'

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
  const canNotify = isSignup && isPushSupported() && Notification.permission !== 'denied'
  const [wantsNotifications, setWantsNotifications] = useState(true)

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

      // Ask during the verification tap, then link this device after the verified account exists.
      const notificationPermission = isSignup && canNotify && wantsNotifications
        ? (Notification.permission === 'granted' ? Promise.resolve('granted') : Notification.requestPermission().catch(() => 'default'))
        : null

      if (isSignup) {
        await signup({ verificationId, code: verificationCode.join('') })
        notificationPermission
          ?.then((permission) => (permission === 'granted' ? enablePromotionAlerts(getCustomerToken()) : null))
          .catch((alertError) => console.error('Unable to turn on notifications after sign-up.', alertError))
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
  const strengthColors = ['bg-[#e5e1d7]', 'bg-red-500', 'bg-[#f2a33a]', 'bg-[#d4ad00]', 'bg-[#4caf50]']
  const passwordsMatch = Boolean(confirmPassword) && password === confirmPassword
  const benefits = ['Track your orders', 'Save your favorites', 'Faster checkout']
  const brandImage = '/ice-images/ice-5.webp'
  const inputShellClass = `group relative mt-2 flex items-center bg-white ring-1 transition hover:ring-[#d6cfbd] focus-within:ring-[#bd9c00] ${isSignup ? 'rounded-xl ring-[#dce3eb]' : 'auth-login-input-shell rounded-xl ring-[#dce3eb]'}`;
  const inputClass = `w-full bg-transparent py-3.5 pl-12 pr-4 text-sm font-semibold text-[#092a53] outline-none! placeholder:font-normal placeholder:text-[#a5aebb] ${isSignup ? 'rounded-xl' : 'auth-login-input rounded-xl'}`
  const iconClass = 'pointer-events-none absolute left-4 size-[18px] text-[#65748a] transition group-focus-within:text-[#092a53]'
  const labelClass = isSignup
    ? 'text-[13px] font-bold text-[#334b65]'
    : 'auth-login-label text-[13px] font-bold text-[#334b65]'

  return (
    <div className={`flex min-h-screen flex-col text-[#092a53] ${isSignup ? 'auth-signup-page' : 'auth-login-page'}`}>
      <Header />
      <main id="main" tabIndex={-1} className={`flex flex-1 justify-center px-4 py-8 sm:px-8 sm:py-12 lg:py-16 ${isSignup ? 'auth-signup-main' : 'auth-login-main'}`}>
        <div className={`grid w-full max-w-[1160px] ${isSignup ? 'auth-signup-layout' : 'gap-8 lg:grid-cols-12 lg:gap-12 auth-login-layout'}`}>
          {/* Brand panel */}
          <aside className={isSignup
            ? 'auth-signup-brand relative isolate flex min-h-[320px] flex-col justify-between overflow-hidden bg-[#092a53] p-7 text-white sm:p-9 lg:min-h-[640px] lg:p-10 xl:p-12'
            : 'auth-login-brand relative isolate flex min-h-[250px] flex-col justify-between overflow-hidden bg-[#092a53] p-6 text-white sm:p-8 lg:col-span-5 lg:min-h-[620px] lg:p-10 xl:p-12'}>
            <img decoding="async" loading={isSignup ? 'lazy' : 'eager'} alt="" className={`absolute inset-0 size-full object-cover ${isSignup ? '-z-20' : 'z-0'}`} sizes="(min-width: 1024px) 560px, 100vw" src={brandImage} srcSet={photoSrcSet(brandImage)} />
            <div aria-hidden="true" className={isSignup ? 'absolute inset-0 -z-10 bg-gradient-to-t from-[#061d3a] via-[#061d3a]/70 to-[#061d3a]/25' : 'auth-login-photo-scrim absolute inset-0 z-10'} />
            <Link aria-label={t('Back to home')} className={`inline-flex w-fit items-center gap-3 transition hover:opacity-85 ${isSignup ? 'rounded-xl bg-[#092a53]/60 py-2 pl-2 pr-4' : 'auth-login-brand-home relative z-20'}`} to="/">
              <img decoding="async" loading="eager" alt="" aria-hidden="true" className="size-10 rounded-full" height={40} src="/logo.png" width={40} />
              <span className="font-display text-base font-extrabold leading-tight">Cold Stone<br /><span className="text-[#ffdc32]">Creamery</span></span>
            </Link>

            <div className={isSignup ? 'auth-signup-brand-copy' : 'auth-login-brand-copy relative z-20'}>
              <h2 className={`max-w-md font-display text-4xl font-extrabold leading-[1.05] tracking-tight xl:text-5xl ${isSignup ? 'mt-0' : 'auth-login-brand-title'}`}>
                {isSignup ? t('A little more joy in every visit.') : t('Made for moments worth sharing')}
              </h2>
              <ul className={`grid gap-3 ${isSignup ? 'mt-6' : 'auth-login-benefits'}`}>
                {benefits.map((benefit) => (
                  <li className="flex items-center gap-3 text-sm font-semibold text-white/85" key={benefit}>
                    <span aria-hidden="true" className="grid size-7 place-items-center rounded-full bg-[#ffdc32] text-[#092a53]">
                      <svg className="size-3.5" fill="none" viewBox="0 0 24 24">
                        <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
                      </svg>
                    </span>
                    {t(benefit)}
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* Form */}
          <section className={`flex min-w-0 flex-col justify-center ${isSignup ? 'auth-signup-form' : 'auth-login-form lg:col-span-7'}`}>
            <div className={`mx-auto w-full max-w-md ${isSignup ? 'auth-signup-form-inner' : 'auth-login-form-inner'}`}>
              <div aria-label={t('Account')} className={`grid grid-cols-2 ${isSignup ? 'auth-signup-tabs' : 'auth-login-tabs'}`} role="group">
                {[
                  { to: '/login', label: t('Log in'), active: !isSignup },
                  { to: '/signup', label: t('Sign up'), active: isSignup },
                ].map((tab) => (
                  <Link
                    aria-current={tab.active ? 'page' : undefined}
                    className={`${isSignup ? 'auth-signup-tab' : 'auth-login-tab'} ${
                      tab.active ? isSignup ? 'bg-[#092a53] text-white shadow-[0_6px_16px_rgba(9,42,83,0.2)]' : 'text-[#092a53]' : 'text-[#65748a] hover:text-[#092a53]'
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

              <h1 className={`mt-10 font-display text-4xl font-extrabold tracking-tight text-[#092a53] sm:text-5xl ${isSignup ? 'auth-signup-heading' : 'auth-login-heading'}`}>
                {passwordResetStep === 'request'
                  ? t('Reset your password')
                  : passwordResetStep === 'confirm'
                    ? t('Choose a new password')
                    : isSignup ? verificationId ? t('Verify your email') : t('Create an account') : t('Welcome back')}
              </h1>
              <p className={`mt-3 text-base leading-7 text-[#65748a] ${isSignup ? 'auth-signup-intro' : 'auth-login-intro'}`}>
                {passwordResetStep === 'request'
                  ? t('Enter the email address on your account and we’ll send you a reset code.')
                  : passwordResetStep === 'confirm'
                    ? t('Enter the 6-digit code from your email and choose a new password.')
                    : isSignup
                  ? verificationId
                    ? t('Enter the 6-digit code we sent to your email to finish creating your account.')
                    : t('Create an account to keep your scoop club details together.')
                  : t('Good to see you again. Enter your details below.')}
              </p>
              {checkoutNotice && (
                <p className="mt-5 flex gap-3 rounded-2xl bg-[#fffaf0] px-4 py-3.5 text-sm leading-6 text-[#624f00] ring-1 ring-[#ecdfa6]" role="status">
                  <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-[#ffdc32]/50 text-xs font-extrabold">i</span>
                  {checkoutNotice}
                </p>
              )}

              <form className={`mt-8 space-y-5 ${isSignup ? 'auth-signup-fields' : 'auth-login-fields'}`} onSubmit={handleSubmit}>
                {isSignup && !verificationId && passwordResetStep === 'idle' && (
                  <label className="block">
                    <span className={labelClass}>{t('Name')}</span>
                    <span className={inputShellClass}>
                      <svg aria-hidden="true" className={iconClass} fill="none" viewBox="0 0 24 24">
                        <circle cx="12" cy="8.5" r="3.5" stroke="currentColor" strokeWidth="1.8" />
                        <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
                      </svg>
                      <input autoComplete="name" className={inputClass} maxLength={100} name="name" onChange={(event) => setName(event.target.value)} required type="text" value={name} />
                    </span>
                  </label>
                )}

                {isSignup && verificationId ? (
                  <div className={isSignup ? 'auth-signup-verification' : 'rounded-2xl bg-white p-5 ring-1 ring-[#fbfaf5] sm:p-6'}>
                    <div className="mx-auto grid size-11 place-items-center rounded-2xl bg-[#092a53] text-[#ffdc32]">
                      <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
                        <rect height="14" rx="3" stroke="currentColor" strokeWidth="1.8" width="18" x="3" y="5" />
                        <path d="m4 7 8 6 8-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                      </svg>
                    </div>
                    <p className="mt-4 text-center text-sm font-semibold text-[#65748a]">
                      {t('We sent a verification code to')}
                    </p>
                    <p className="mt-1 break-all text-center text-sm font-extrabold text-[#092a53]">{email}</p>
                    <div
                      aria-label={t('6-digit verification code')}
                      className="mt-6 flex justify-center gap-2 sm:gap-3"
                      onPaste={handleVerificationPaste}
                      role="group"
                    >
                      {verificationCode.map((digit, index) => (
                        <input
                          aria-label={t('Digit {number} of 6', { number: index + 1 })}
                          autoComplete={index === 0 ? 'one-time-code' : 'off'}
                          className="size-11 rounded-xl border border-[#dbe3ec] bg-[#f4f6f8] text-center text-xl font-extrabold text-[#092a53] outline-none transition focus:border-[#bd9c00] focus:bg-white focus:ring-[3px] focus:ring-[#ffdc32]/45 sm:size-12"
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
                    <p className="mt-4 text-center text-xs leading-5 text-[#65748a]">{t('The code expires in 10 minutes.')}</p>
                    <div className="mt-3 text-center">
                      <button className="text-xs font-extrabold text-[#092a53] underline decoration-[#ffdc32] decoration-2 underline-offset-4 disabled:cursor-wait disabled:opacity-60" disabled={isSubmitting || resendCountdown > 0} onClick={resendVerificationCode} type="button">
                        {resendCountdown > 0 ? t('Resend code in {seconds}s', { seconds: resendCountdown }) : t('Resend code')}
                      </button>
                    </div>
                  </div>
                ) : passwordResetStep !== 'idle' ? (
                  <>
                    <label className="block">
                      <span className={labelClass}>{t('Email address')}</span>
                      <span className={inputShellClass}>
                        <svg aria-hidden="true" className={iconClass} fill="none" viewBox="0 0 24 24">
                          <rect height="14" rx="3" stroke="currentColor" strokeWidth="1.8" width="18" x="3" y="5" />
                          <path d="m4 7 8 6 8-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                        </svg>
                        <input autoComplete="email" className={inputClass} name="email" onChange={(event) => setEmail(event.target.value)} placeholder={t('you@example.com')} readOnly={passwordResetStep === 'confirm'} required type="email" value={email} />
                      </span>
                    </label>
                    {passwordResetStep === 'confirm' && (
                      <>
                        <div
                          aria-label={t('6-digit verification code')}
                          className="flex justify-center gap-2 sm:gap-3"
                          onPaste={handleVerificationPaste}
                          role="group"
                        >
                          {verificationCode.map((digit, index) => (
                            <input
                              aria-label={t('Digit {number} of 6', { number: index + 1 })}
                              autoComplete={index === 0 ? 'one-time-code' : 'off'}
                              className="size-11 rounded-xl border border-[#dbe3ec] bg-[#f4f6f8] text-center text-xl font-extrabold text-[#092a53] outline-none transition focus:border-[#bd9c00] focus:bg-white focus:ring-[3px] focus:ring-[#ffdc32]/45 sm:size-12"
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
                        <p className="text-center text-xs leading-5 text-[#65748a]">{t('The code expires in 10 minutes.')}</p>
                        <PasswordField
                          autoComplete="new-password"
                          label={t('New password')}
                          labelClassName="auth-login-label"
                          maxLength={128}
                          minLength={8}
                          name="newPassword"
                          onChange={(event) => setResetPassword(event.target.value)}
                          required
                          value={resetPassword}
                          variant="modern"
                        />
                        <PasswordField
                          autoComplete="new-password"
                          label={t('Confirm new password')}
                          labelClassName="auth-login-label"
                          maxLength={128}
                          minLength={8}
                          name="confirmNewPassword"
                          onChange={(event) => setResetPasswordConfirmation(event.target.value)}
                          required
                          value={resetPasswordConfirmation}
                          variant="modern"
                        />
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <label className="block">
                      <span className={labelClass}>{t('Email address')}</span>
                      <span className={inputShellClass}>
                        <svg aria-hidden="true" className={iconClass} fill="none" viewBox="0 0 24 24">
                          <rect height="14" rx="3" stroke="currentColor" strokeWidth="1.8" width="18" x="3" y="5" />
                          <path d="m4 7 8 6 8-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                        </svg>
                        <input autoComplete="email" className={inputClass} name="email" onChange={(event) => setEmail(event.target.value)} placeholder={t('you@example.com')} required type="email" value={email} />
                      </span>
                    </label>

                    <PasswordField
                      autoComplete={isSignup ? 'new-password' : 'current-password'}
                      label={t('Password')}
                      labelClassName={!isSignup ? 'auth-login-label' : undefined}
                      maxLength={128}
                      minLength={8}
                      name="password"
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      value={password}
                      variant="modern"
                    >
                      {isSignup && (
                        <span className="mt-2.5 block" aria-live="polite">
                          <span aria-hidden="true" className="grid grid-cols-4 gap-1.5">
                            {[1, 2, 3, 4].map((step) => (
                              <span className={`h-1 rounded-full transition-colors ${passwordScore >= step ? strengthColors[passwordScore] : 'bg-[#e5e1d7]'}`} key={step} />
                            ))}
                          </span>
                          <span className="mt-1.5 flex justify-between text-xs font-semibold text-[#65748a]">
                            <span>{t('At least 8 characters')}</span>
                            {passwordScore > 0 && <span className="text-[#65748a]">{t('Password strength')}: {t(strengthLabels[passwordScore])}</span>}
                          </span>
                        </span>
                      )}
                    </PasswordField>

                    {!isSignup && passwordResetStep === 'idle' && (
                      <div className="mt-3 text-right">
                        <button
                          className="text-xs font-extrabold text-[#092a53] underline decoration-[#ffdc32] decoration-2 underline-offset-4"
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
                        maxLength={128}
                        minLength={8}
                        name="confirmPassword"
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        required
                        value={confirmPassword}
                        variant="modern"
                      >
                        {passwordsMatch && (
                          <span className="mt-2 flex items-center gap-1.5 text-xs font-bold text-[#37632c]" role="status">
                            <svg aria-hidden="true" className="size-3.5" fill="none" viewBox="0 0 24 24">
                              <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
                            </svg>
                            {t('Passwords match')}
                          </span>
                        )}
                      </PasswordField>
                    )}
                  </>
                )}

                {verificationNotice && (
                  <p className="rounded-2xl bg-[#eaf6ee] px-4 py-3 text-sm font-semibold text-[#1f5d3c] ring-1 ring-[#cfe8d8]" role="status">{verificationNotice}</p>
                )}

                {canNotify && !verificationId && (
                  <label className={`flex cursor-pointer items-start gap-3 rounded-xl bg-white px-4 py-3.5 text-sm leading-5 text-[#65748a] ring-1 ring-[#e5e1d7] transition hover:ring-[#d6cfbd] ${isSignup ? 'auth-signup-notifications' : ''}`}>
                    <input
                      checked={wantsNotifications}
                      className="mt-0.5 size-4 shrink-0 accent-[#092a53]"
                      name="notifications"
                      onChange={(event) => setWantsNotifications(event.target.checked)}
                      type="checkbox"
                    />
                    <span>
                      <span className="block font-bold text-[#092a53]">{t('Notify me on this device')}</span>
                      {t('Get a welcome message, order updates and sweet deals as notifications.')}
                    </span>
                  </label>
                )}

                {error && (
                  <p className="flex gap-3 rounded-2xl bg-red-50 px-4 py-3.5 text-sm leading-5 text-red-700 ring-1 ring-red-100" role="alert">
                    <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center rounded-full bg-red-100 text-xs font-extrabold">!</span>
                    {error}
                  </p>
                )}

                <button
                  className={`inline-flex w-full items-center justify-center gap-2 px-6 py-4 text-sm font-extrabold transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#092a53] focus-visible:ring-offset-2 disabled:translate-y-0 disabled:cursor-wait disabled:opacity-70 ${isSignup ? 'rounded-lg bg-[#ffdc32] text-[#092a53] hover:bg-[#ffe76c]' : 'auth-login-submit'}`}
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
                  className="mt-5 w-full text-center text-sm font-extrabold text-[#092a53] underline decoration-[#ffdc32] decoration-2 underline-offset-4"
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

              <p className="mt-8 text-center text-sm text-[#65748a]">
                {isSignup ? t('Already have an account?') : t("New to this website's shop?")}{' '}
                <Link
                  className="font-extrabold text-[#092a53] underline decoration-[#ffdc32] decoration-2 underline-offset-4 transition hover:decoration-[#092a53]"
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
