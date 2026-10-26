import { Link } from 'react-router-dom'
import { Footer, Header } from '../../components/Layout'
import { useLanguage } from '../../language/useLanguage'

export function NotFoundPage() {
  const { t } = useLanguage()
  return (
    <div className="flex min-h-screen flex-col bg-[#fbfaf5] text-brand-navy">
      <Header />
      <main id="main" tabIndex={-1} className="flex flex-1 items-center justify-center px-5 py-16 text-center">
        <div>
          <p className="font-display text-7xl font-bold text-brand-yellow">404</p>
          <h1 className="mt-3 font-display text-3xl font-bold">{t('This scoop is nowhere to be found.')}</h1>
          <p className="mt-3 text-[#65748a]">{t('That page may have melted away. Let’s find you something sweet.')}</p>
          <Link to="/" className="mt-7 inline-flex rounded-full bg-brand-yellow px-6 py-3 text-sm font-bold transition hover:bg-brand-gold-light">
            {t('Back to home')}
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  )
}
