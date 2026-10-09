import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Footer, Header } from '../../../components/Layout'
import { PasswordField } from '../../../components/PasswordField'
import { useAuth } from '../../../authcontext/AuthContext'
import { useLanguage } from '../../../language/LanguageContext'

const PROFILE_IMAGE_DIMENSION = 256
const MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024

async function resizeProfilePicture(file) {
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

export function AuthPage({ mode }) {
  const isSignup = mode === 'signup'
  const { signup, login } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [profilePicture, setProfilePicture] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleProfilePictureChange(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setError('')
    try {
      setProfilePicture(await resizeProfilePicture(file))
    } catch (imageError) {
      console.error('Unable to prepare customer profile picture.', imageError)
      setProfilePicture('')
      setError(t(imageError.message || 'Could not load this profile picture.'))
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (isSignup && password !== confirmPassword) {
      setError(t('Your passwords do not match. Please check them and try again.'))
      return
    }

    setIsSubmitting(true)
    try {
      if (isSignup) {
        await signup({ name, email, password, profilePicture })
      } else {
        await login({ email, password })
      }
      navigate('/', { replace: true })
    } catch (authError) {
      setError(authError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f8f7f2] text-[#102c50]">
      <Header />
      <main className="flex flex-1 items-center justify-center px-5 py-12 sm:px-8">
        <section className="w-full max-w-md rounded-[28px] border border-[#d9d6cc] bg-white p-6 shadow-[0_12px_40px_rgba(18,44,80,0.08)] sm:p-9">
          <p className="mb-2 inline-block rounded-full bg-[#ffeb9c] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#102c50]">
            {isSignup ? t('Join the scoop club') : t('Welcome back')}
          </p>
          <h1 className="font-display text-4xl font-bold tracking-tight">{isSignup ? t('Create an account') : t('Log in')}</h1>
          <p className="mt-2 text-sm leading-6 text-[#65748a]">
            {isSignup ? t('Create an account to keep your scoop club details together.') : t('Good to see you again. Enter your details below.')}
          </p>

          <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
            {isSignup && (
              <label className="block text-sm font-semibold text-[#65748a]">
                {t('Name')}
                <input
                  autoComplete="name"
                  className="mt-1.5 w-full rounded-xl border border-[#d9d6cc] bg-[#f8f7f2] px-4 py-3 font-normal outline-none transition focus:border-[#bd9c00] focus:ring-2 focus:ring-[#ffdc32]/40"
                  maxLength={100}
                  name="name"
                  onChange={(event) => setName(event.target.value)}
                  required
                  type="text"
                  value={name}
                />
              </label>
            )}
            <label className="block text-sm font-semibold text-[#65748a]">
              {t('Email address')}
              <input
                autoComplete="email"
                className="mt-1.5 w-full rounded-xl border border-[#d9d6cc] bg-[#f8f7f2] px-4 py-3 font-normal outline-none transition focus:border-[#bd9c00] focus:ring-2 focus:ring-[#ffdc32]/40"
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
            {isSignup && (
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

                <label className="block text-sm font-semibold text-[#65748a]">
                  {t('Profile picture')}
                  <input
                    accept="image/*"
                    className="mt-1.5 w-full rounded-xl border border-[#d9d6cc] bg-[#f8f7f2] px-3 py-2.5 text-sm font-normal outline-none transition file:mr-3 file:rounded-full file:border-0 file:bg-[#ffeb9c] file:px-3 file:py-1.5 file:text-xs file:font-bold focus:border-[#bd9c00] focus:ring-2 focus:ring-[#ffdc32]/40"
                    onChange={handleProfilePictureChange}
                    type="file"
                  />
                  <span className="mt-1 block text-xs font-normal text-[#65748a]">{t('Optional. Image will be resized before saving (5 MB max).')}</span>
                </label>
                {profilePicture && (
                  <div className="flex items-center gap-3 rounded-2xl border border-[#d9d6cc] bg-[#fffdf5] p-3">
                    <img alt={t('Profile preview')} className="size-16 rounded-full object-cover" src={profilePicture} />
                    <p className="text-sm font-medium text-[#65748a]">{t('Profile picture ready')}</p>
                  </div>
                )}
              </>
            )}
            {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm leading-5 text-red-700" role="alert">{error}</p>}
            <button
              className="w-full rounded-full bg-[#ffdc32] px-6 py-3.5 text-sm font-bold text-[#102c50] transition hover:-translate-y-0.5 hover:bg-[#ffe76c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#102c50] disabled:cursor-wait disabled:opacity-60"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? t('Please wait…') : isSignup ? t('Create account') : t('Log in')}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-[#65748a]">
            {isSignup ? t('Already have an account?') : t("New to this website's shop?")}{' '}
            <Link
              className="font-bold text-[#102c50] underline decoration-[#ffdc32] decoration-2 underline-offset-4 hover:text-[#bd9c00]"
              to={isSignup ? '/login' : '/signup'}
            >
              {isSignup ? t('Log in') : t('Sign up')}
            </Link>
          </p>
        </section>
      </main>
      <Footer />
    </div>
  )
}
