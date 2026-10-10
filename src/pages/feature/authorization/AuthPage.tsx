import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Header } from '../../../components/Layout'
import { PasswordField } from '../../../components/PasswordField'
import { useAuth } from '../../../authcontext/AuthContext'
import { useLanguage } from '../../../language/LanguageContext'

const PROFILE_IMAGE_DIMENSION = 256
const MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024

async function resizeProfilePicture(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choose an image file for the profile picture.')
  }
  if (file.size > MAX_PROFILE_IMAGE_SIZE) {
    throw new Error('Choose an image smaller than 5 MB.')
  }

  const imageBitmap = await createImageBitmap(file)
  const scale = Math.min(1, PROFILE_IMAGE_DIMENSION / Math.max(imageBitmap.width, imageBitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(imageBitmap.width * scale))
  canvas.height = Math.max(1, Math.round(imageBitmap.height * scale))

  const context = canvas.getContext('2d')
  if (!context) {
    imageBitmap.close()
    throw new Error('Your browser could not prepare the profile picture.')
  }

  context.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height)
  imageBitmap.close()
  return canvas.toDataURL('image/jpeg', 0.8)
}

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const isSignup = mode === 'signup'
  const { requestSignupCode, signup, login } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  const returnToCheckout = location.state?.from === '/checkout'
  const checkoutNotice = typeof location.state?.notice === 'string' ? location.state.notice : ''
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [profilePicture, setProfilePicture] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [verificationSent, setVerificationSent] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleProfilePictureChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setError('')
    try {
      setProfilePicture(await resizeProfilePicture(file))
    } catch (imageError) {
      console.error('Unable to prepare customer profile picture.', imageError)
      setProfilePicture('')
      setError(t(imageError instanceof Error ? imageError.message : 'Could not load this profile picture.'))
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (isSignup && password !== confirmPassword) {
      setError(t('Your passwords do not match. Please check them and try again.'))
      return
    }

    setIsSubmitting(true)
    try {
      if (isSignup) {
        if (verificationSent) {
          await signup({ email, code: verificationCode })
        } else {
          await requestSignupCode({ name, email, password, profilePicture })
          setVerificationSent(true)
        }
      } else {
        if (verificationSent) {
          await signup({ email, code: verificationCode })
        } else {
          const result = await login({ email, password })
          if (result.verificationRequired) {
            setVerificationSent(true)
            setError('')
            return
          }
        }
      }
      if (!isSignup || verificationSent) {
        navigate(returnToCheckout ? '/checkout' : '/', { replace: true })
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Unable to authenticate. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleResendCode() {
    setError('')
    setIsSubmitting(true)
    try {
      if (isSignup) {
        await requestSignupCode({ name, email, password, profilePicture })
      } else {
        const result = await login({ email, password })
        if (!result.verificationRequired) {
          navigate(returnToCheckout ? '/checkout' : '/', { replace: true })
          return
        }
      }
      setVerificationCode('')
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Unable to send a verification code. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f8f7f2] text-[#102c50]">
      <Header />
      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-7 sm:py-12">
        <section className="grid w-full max-w-[1080px] overflow-hidden rounded-[30px] border border-[#e7e3d9] bg-white shadow-[0_24px_70px_rgba(18,44,80,0.12)] lg:min-h-[640px] lg:grid-cols-[0.9fr_1.1fr]">
          <div className="relative isolate hidden min-h-full flex-col justify-between overflow-hidden bg-[#092a53] p-10 text-white lg:flex xl:p-12">
            <img alt="" className="absolute inset-0 -z-20 size-full object-cover opacity-35" src="/ice-images/ice-4.webp" />
            <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-br from-[#092a53]/95 via-[#092a53]/75 to-[#102c50]/70" />
            <div aria-hidden="true" className="absolute -right-24 top-1/3 -z-10 size-80 rounded-full border-[52px] border-white/[0.07]" />
            <Link aria-label={t('Back to home')} className="inline-flex w-fit items-center gap-3" to="/">
              <span aria-hidden="true" className="grid size-12 place-items-center rounded-2xl bg-[#ffdc32] text-2xl text-[#092a53]">🍦</span>
              <span className="font-display text-xl font-extrabold leading-tight">Cold Stone<br /><span className="text-[#ffdc32]">Cameroon</span></span>
            </Link>
            <div className="relative">
              <p className="inline-flex rounded-full border border-white/25 bg-white/10 px-3.5 py-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#ffdc32]">
                {isSignup ? t('Join the scoop club') : t('Welcome back')}
              </p>
              <h2 className="mt-5 max-w-md font-display text-4xl font-extrabold leading-tight xl:text-5xl">
                {isSignup ? t('A little more joy in every visit.') : t('Your next favorite scoop is waiting.')}
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-7 text-white/75">
                {isSignup ? t('Create an account to keep your scoop club details together.') : t('Good to see you again. Enter your details below.')}
              </p>
            </div>
            <div className="flex items-center gap-3 border-t border-white/15 pt-5 text-xs font-semibold text-white/70">
              <span aria-hidden="true" className="grid size-9 place-items-center rounded-xl bg-white/10 text-[#ffdc32]">✦</span>
              {t('Made for moments worth sharing')}
            </div>
          </div>

          <div className="flex min-w-0 flex-col justify-center p-6 sm:p-10 lg:px-12 lg:py-12">
            <Link aria-label={t('Back to home')} className="mb-8 inline-flex w-fit items-center gap-2 text-sm font-bold text-[#52647b] transition hover:text-[#092a53] lg:hidden" to="/">
              <span aria-hidden="true">←</span> Cold Stone Cameroon
            </Link>
            <p className="mb-2 inline-flex w-fit items-center gap-2 rounded-full bg-[#fff4bd] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#715e00]">
              <span aria-hidden="true">✦</span>{isSignup ? t('Join the scoop club') : t('Welcome back')}
            </p>
            <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{isSignup ? t('Create an account') : t('Log in')}</h1>
            <p className="mt-2 max-w-md text-sm leading-6 text-[#65748a]">
              {isSignup ? t('Create an account to keep your scoop club details together.') : t('Good to see you again. Enter your details below.')}
            </p>
            {checkoutNotice && (
              <p className="mt-4 rounded-xl border border-[#eadb8a] bg-[#fff9dc] px-4 py-3 text-sm leading-6 text-[#624f00]" role="status">
                {checkoutNotice}
              </p>
            )}

            <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
              {isSignup && !verificationSent && (
                <label className="block text-xs font-extrabold text-[#52647b]">
                  {t('Name')}
                  <input
                    autoComplete="name"
                    className="mt-2 w-full rounded-xl border border-[#d9d6cc] bg-[#fbfaf5] px-4 py-3 text-sm font-normal text-[#102c50] outline-none transition placeholder:text-[#9aa3ad] focus:border-[#bd9c00] focus:bg-white focus:ring-2 focus:ring-[#ffdc32]/40"
                    maxLength={100}
                    name="name"
                    onChange={(event) => setName(event.target.value)}
                    required
                    type="text"
                    value={name}
                  />
                </label>
              )}
              {!verificationSent && (
                <>
                  <label className="block text-xs font-extrabold text-[#52647b]">
                    {t('Email address')}
                    <input
                      autoComplete="email"
                      className="mt-2 w-full rounded-xl border border-[#d9d6cc] bg-[#fbfaf5] px-4 py-3 text-sm font-normal text-[#102c50] outline-none transition placeholder:text-[#9aa3ad] focus:border-[#bd9c00] focus:bg-white focus:ring-2 focus:ring-[#ffdc32]/40"
                      name="email"
                      onChange={(event) => setEmail(event.target.value)}
                      required
                      type="email"
                      value={email}
                    />
                  </label>
                  <PasswordField
                    autoComplete={isSignup ? 'new-password' : 'current-password'}
                    label={t('Password')}
                    maxLength={128}
                    minLength={8}
                    name="password"
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    value={password}
                  />
                </>
              )}
              {isSignup && !verificationSent && (
                <>
                  <PasswordField
                    autoComplete="new-password"
                    label={t('Confirm password')}
                    maxLength={128}
                    minLength={8}
                    name="confirmPassword"
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                    value={confirmPassword}
                  />

                  <label className="block text-xs font-extrabold text-[#52647b]">
                    {t('Profile picture')}
                    <input
                      accept="image/*"
                      className="mt-2 w-full rounded-xl border border-[#d9d6cc] bg-[#fbfaf5] px-3 py-2.5 text-sm font-normal outline-none transition file:mr-3 file:rounded-full file:border-0 file:bg-[#ffeb9c] file:px-3 file:py-1.5 file:text-xs file:font-bold focus:border-[#bd9c00] focus:ring-2 focus:ring-[#ffdc32]/40"
                      onChange={handleProfilePictureChange}
                      type="file"
                    />
                    <span className="mt-1.5 block text-xs font-normal leading-5 text-[#65748a]">{t('Optional. Image will be resized before saving (5 MB max).')}</span>
                  </label>
                  {profilePicture && (
                    <div className="flex items-center gap-3 rounded-2xl border border-[#e7e3d9] bg-[#fbfaf5] p-3">
                      <img alt={t('Profile preview')} className="size-12 rounded-full object-cover" src={profilePicture} />
                      <p className="text-sm font-semibold text-[#52647b]">{t('Profile picture ready')}</p>
                    </div>
                  )}
                </>
              )}
              {verificationSent && (
                <>
                  <p className="rounded-xl border border-[#eadb8a] bg-[#fff9dc] px-4 py-3 text-sm leading-6 text-[#624f00]" role="status">
                    {t('Enter the six-digit code sent to {email}.', { email })}
                  </p>
                  <label className="block text-xs font-extrabold text-[#52647b]">
                    {t('Verification code')}
                    <input
                      autoComplete="one-time-code"
                      className="mt-2 w-full rounded-xl border border-[#d9d6cc] bg-[#fbfaf5] px-4 py-3 text-lg font-bold tracking-[0.3em] text-[#102c50] outline-none transition placeholder:text-[#9aa3ad] focus:border-[#bd9c00] focus:bg-white focus:ring-2 focus:ring-[#ffdc32]/40"
                      inputMode="numeric"
                      maxLength={6}
                      name="verificationCode"
                      onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      pattern="\d{6}"
                      required
                      value={verificationCode}
                    />
                  </label>
                  <button
                    className="w-fit text-sm font-bold text-[#092a53] underline decoration-[#ffdc32] decoration-2 underline-offset-4 disabled:opacity-60"
                    disabled={isSubmitting}
                    onClick={handleResendCode}
                    type="button"
                  >
                    {t('Resend verification code')}
                  </button>
                </>
              )}
              {error && <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700" role="alert">{error}</p>}
              <button
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#092a53] px-6 py-3.5 text-sm font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-[#163e6b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd9c00] disabled:cursor-wait disabled:opacity-60"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting
                  ? t(verificationSent ? 'Verifying…' : isSignup ? 'Sending verification code…' : 'Please wait…')
                  : isSignup
                    ? verificationSent ? t('Verify email and create account') : t('Send verification code')
                    : verificationSent ? t('Verify email and sign in') : t('Log in')} {!isSubmitting && <span aria-hidden="true">→</span>}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-[#65748a]">
              {isSignup ? t('Already have an account?') : t("New to this website's shop?")}{' '}
              <Link
                className="font-extrabold text-[#092a53] underline decoration-[#ffdc32] decoration-2 underline-offset-4 hover:text-[#806a00]"
                state={location.state}
                to={isSignup ? '/login' : '/signup'}
              >
                {isSignup ? t('Log in') : t('Sign up')}
              </Link>
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
