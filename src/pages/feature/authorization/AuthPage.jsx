import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Footer, Header } from '../../../components/Layout'
import { PasswordField } from '../../../components/PasswordField'
import { useAuth } from '../../../AuthContext'
import { useLanguage } from '../../../LanguageContext'

export function AuthPage({ mode }) {
  const isSignup = mode === 'signup'
  const { signup, login } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

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
        await signup({ name, email, password })
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
    <div className="flex min-h-screen flex-col bg-[#fffefa] text-[#102c50]">
      <Header />
      <main className="flex flex-1 items-center justify-center px-5 py-12 sm:px-8">
        <section className="w-full max-w-md rounded-[28px] border border-[#ece8de] bg-white p-6 shadow-[0_12px_40px_rgba(18,44,80,0.08)] sm:p-9">
          <p className="mb-2 inline-block rounded-full bg-[#ffeb9c] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#102c50]">
            {isSignup ? t('Join the scoop club') : t('Welcome back')}
          </p>
          <h1 className="font-display text-4xl font-bold tracking-tight">{isSignup ? t('Create an account') : t('Log in')}</h1>
          <p className="mt-2 text-sm leading-6 text-[#65748a]">
            {isSignup ? t('Create an account to keep your scoop club details together.') : t('Good to see you again. Enter your details below.')}
          </p>

          <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
            {isSignup && (
              <label className="block text-sm font-semibold text-[#29415f]">
                {t('Name')}
                <input
                  autoComplete="name"
                  className="mt-1.5 w-full rounded-xl border border-[#d9d6cc] bg-[#fffefa] px-4 py-3 font-normal outline-none transition focus:border-[#bd9c00] focus:ring-2 focus:ring-[#ffdc32]/40"
                  maxLength={100}
                  name="name"
                  onChange={(event) => setName(event.target.value)}
                  required
                  type="text"
                  value={name}
                />
              </label>
            )}
            <label className="block text-sm font-semibold text-[#29415f]">
              {t('Email address')}
              <input
                autoComplete="email"
                className="mt-1.5 w-full rounded-xl border border-[#d9d6cc] bg-[#fffefa] px-4 py-3 font-normal outline-none transition focus:border-[#bd9c00] focus:ring-2 focus:ring-[#ffdc32]/40"
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
            {isSignup ? t('Already have an account?') : t('New to Antixor Icy?')}{' '}
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
